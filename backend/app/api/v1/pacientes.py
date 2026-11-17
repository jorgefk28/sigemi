"""Patient administration endpoints (UCE-REC-16/17/18/19, S-01).

Registration, modification, read-only consultation and logical deactivation of
patients.  Every rejection is field-scoped where it belongs to a request field.
The audit trail follows the UCE: modification (REC-17) and deactivation
(REC-19, with the motivo) write audit rows; registration (REC-16) does not
(decision A7).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.base import utcnow
from app.db.session import get_db
from app.models.access import Usuario
from app.models.clinical import Paciente
from app.models.enums import AccionAuditoria, EstadoActivo, NivelRegistro
from app.schemas.pacientes import (
    PacienteBaja,
    PacienteCreate,
    PacienteList,
    PacienteRead,
    PacienteUpdate,
)
from app.services.audit import registrar_auditoria
from app.services.pacientes import (
    ReglaDePaciente,
    limpiar_dni,
    normalizar_correo,
    normalizar_dni,
    normalizar_optional,
    normalizar_texto,
    paciente_tiene_analisis,
    serializar_paciente,
    serializar_pacientes,
    tiene_turnos_vigentes,
    validar_fecha_nacimiento,
    validar_telefono,
)

router = APIRouter(prefix="/pacientes", tags=["pacientes"])

MODULO = "pacientes"
ENTIDAD = "paciente"

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


def _rechazo(regla: ReglaDePaciente) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _obtener(db: Session, paciente_id: uuid.UUID) -> Paciente:
    """Return the patient or raise ``404`` (UCE-REC-18/19, paso 4)."""
    paciente = db.get(Paciente, paciente_id)
    if paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente no encontrado",
        )
    return paciente


def _dni_en_uso(db: Session, dni: str, excluir: uuid.UUID | None = None) -> bool:
    """Whether *dni* already belongs to a patient, ignoring *excluir*."""
    statement = select(Paciente.id).where(Paciente.dni == dni)
    if excluir is not None:
        statement = statement.where(Paciente.id != excluir)
    return db.scalar(statement) is not None


def _escape_like(texto: str) -> str:
    """Escape the LIKE wildcards so ``q`` matches them literally."""
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _condiciones(
    q: str | None,
    dni: str | None,
    nombre: str | None,
    apellido: str | None,
    estado: str | None,
) -> list:
    """Build the WHERE conditions shared by the listing and its count."""
    condiciones = []

    if q and q.strip():
        patron = f"%{_escape_like(q.strip())}%"
        condiciones.append(
            or_(
                Paciente.dni.ilike(patron, escape="\\"),
                Paciente.nombre.ilike(patron, escape="\\"),
                Paciente.apellido.ilike(patron, escape="\\"),
            )
        )

    # S-01: the ``dni`` criterion is an exact match on the stored (normalized)
    # value; partial dni lookups go through ``q``.
    if dni and dni.strip():
        condiciones.append(Paciente.dni == limpiar_dni(dni))

    if nombre and nombre.strip():
        patron = f"%{_escape_like(nombre.strip())}%"
        condiciones.append(Paciente.nombre.ilike(patron, escape="\\"))

    if apellido and apellido.strip():
        patron = f"%{_escape_like(apellido.strip())}%"
        condiciones.append(Paciente.apellido.ilike(patron, escape="\\"))

    if estado:
        condiciones.append(Paciente.estado == estado)

    return condiciones


@router.get("", response_model=PacienteList)
def listar_pacientes(
    q: str | None = None,
    dni: str | None = None,
    nombre: str | None = None,
    apellido: str | None = None,
    estado: str | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("bioquimico", "administrador")),
) -> PacienteList:
    """List patients (UCE-REC-18, paso 2; UCE-REC-S-01) with the envelope."""
    limite = min(limit, LIMITE_MAXIMO)
    condiciones = _condiciones(q, dni, nombre, apellido, estado)

    total = (
        db.scalar(select(func.count()).select_from(Paciente).where(*condiciones)) or 0
    )
    pacientes = list(
        db.scalars(
            select(Paciente)
            .where(*condiciones)
            .order_by(Paciente.apellido, Paciente.nombre, Paciente.dni)
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return PacienteList(
        items=serializar_pacientes(pacientes),
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/{paciente_id}", response_model=PacienteRead)
def obtener_paciente(
    paciente_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("bioquimico", "administrador")),
) -> PacienteRead:
    """Return one patient's record (UCE-REC-18, paso 6)."""
    return serializar_paciente(_obtener(db, paciente_id))


@router.post("", response_model=PacienteRead, status_code=status.HTTP_201_CREATED)
def crear_paciente(
    request: Request,
    datos: PacienteCreate,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("bioquimico", "administrador")),
) -> PacienteRead | JSONResponse:
    """Register a patient (UCE-REC-16, pasos 3-5). No audit (A7)."""
    try:
        dni = normalizar_dni(datos.dni)
        nombre = normalizar_texto("nombre", "El nombre", datos.nombre)
        apellido = normalizar_texto("apellido", "El apellido", datos.apellido)
        validar_fecha_nacimiento(datos.fecha_nacimiento)
        telefono = validar_telefono(datos.telefono)
        correo = normalizar_correo(datos.correo_electronico)
        domicilio = normalizar_optional(datos.domicilio)
        obra_social = normalizar_optional(datos.obra_social)
        sexo = normalizar_optional(datos.sexo)
    except ReglaDePaciente as regla:
        return _rechazo(regla)

    if _dni_en_uso(db, dni):
        return _rechazo(
            ReglaDePaciente("El paciente ya se encuentra registrado", "dni")
        )

    # A1: ``numero_registro`` is application-generated from the row UUID.  The
    # id is pre-generated so the NOT NULL column is populated before flush.
    paciente_id = uuid.uuid4()
    paciente = Paciente(
        id=paciente_id,
        numero_registro=f"PAC-{paciente_id.hex[:8].upper()}",
        dni=dni,
        nombre=nombre,
        apellido=apellido,
        fecha_nacimiento=datos.fecha_nacimiento,
        telefono=telefono,
        correo_electronico=correo,
        domicilio=domicilio,
        obra_social=obra_social,
        sexo=sexo,
        nivel_registro=NivelRegistro.COMPLETO.value,
        estado=EstadoActivo.ACTIVO.value,
        fecha_ingreso=utcnow(),
    )
    db.add(paciente)
    db.commit()

    return serializar_paciente(paciente)


@router.patch("/{paciente_id}", response_model=PacienteRead)
def actualizar_paciente(
    request: Request,
    paciente_id: uuid.UUID,
    datos: PacienteUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("bioquimico", "administrador")),
) -> PacienteRead | JSONResponse:
    """Modify a patient (UCE-REC-17, pasos 7-11)."""
    paciente = _obtener(db, paciente_id)

    enviados = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not enviados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para modificar",
        )

    # Validate every field before touching the row: a rejected request must not
    # leave a half-applied change behind.
    normalizados: dict[str, object] = {}
    try:
        if "dni" in enviados:
            dni = normalizar_dni(enviados["dni"])
            if _dni_en_uso(db, dni, excluir=paciente.id):
                raise ReglaDePaciente(
                    "El DNI ingresado ya corresponde a otro paciente", "dni"
                )
            normalizados["dni"] = dni

        if "nombre" in enviados:
            normalizados["nombre"] = normalizar_texto(
                "nombre", "El nombre", enviados["nombre"]
            )

        if "apellido" in enviados:
            normalizados["apellido"] = normalizar_texto(
                "apellido", "El apellido", enviados["apellido"]
            )

        if "telefono" in enviados:
            normalizados["telefono"] = validar_telefono(enviados["telefono"])

        if "fecha_nacimiento" in enviados:
            # A5 / REC-17 comment: immutability once the patient has analyses.
            if paciente_tiene_analisis(db, paciente.id):
                raise ReglaDePaciente(
                    "No se puede modificar la fecha de nacimiento de un paciente "
                    "con análisis registrados",
                    "fecha_nacimiento",
                )
            validar_fecha_nacimiento(enviados["fecha_nacimiento"])
            normalizados["fecha_nacimiento"] = enviados["fecha_nacimiento"]

        if "correo_electronico" in enviados:
            normalizados["correo_electronico"] = normalizar_correo(
                enviados["correo_electronico"]
            )

        if "domicilio" in enviados:
            normalizados["domicilio"] = normalizar_optional(enviados["domicilio"])

        if "obra_social" in enviados:
            normalizados["obra_social"] = normalizar_optional(enviados["obra_social"])

        if "sexo" in enviados:
            normalizados["sexo"] = normalizar_optional(enviados["sexo"])
    except ReglaDePaciente as regla:
        return _rechazo(regla)

    cambios: list[tuple[str, str | None, str | None]] = []
    for campo, valor in normalizados.items():
        anterior = getattr(paciente, campo)
        if anterior == valor:
            continue
        setattr(paciente, campo, valor)
        if campo == "fecha_nacimiento":
            cambios.append((campo, anterior.isoformat(), valor.isoformat()))
        else:
            cambios.append(
                (campo, str(anterior) if anterior is not None else None, valor)
            )

    if cambios:
        registrar_auditoria(
            db,
            usuario_id=actor.id,
            modulo=MODULO,
            accion=AccionAuditoria.MODIFICAR,
            entidad_afectada=ENTIDAD,
            entidad_id=paciente.id,
            direccion_ip=client_ip(request),
            cambios=cambios,
        )
    db.commit()

    return serializar_paciente(paciente)


@router.post("/{paciente_id}/baja", response_model=PacienteRead)
def desactivar_paciente(
    request: Request,
    paciente_id: uuid.UUID,
    datos: PacienteBaja,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("administrador")),
) -> PacienteRead | JSONResponse:
    """Deactivate a patient logically (UCE-REC-19, pasos 8-11)."""
    paciente = _obtener(db, paciente_id)

    try:
        motivo = normalizar_texto("motivo", "El motivo de la baja", datos.motivo)
    except ReglaDePaciente as regla:
        return _rechazo(regla)

    if paciente.estado == EstadoActivo.INACTIVO.value:
        return _rechazo(ReglaDePaciente("El paciente ya está inactivo"))

    if tiene_turnos_vigentes(db, paciente.id):
        return _rechazo(
            ReglaDePaciente(
                "El paciente tiene turnos vigentes; cancelalos antes de desactivarlo"
            )
        )

    paciente.estado = EstadoActivo.INACTIVO.value
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=paciente.id,
        direccion_ip=client_ip(request),
        cambios=[("motivo_baja", None, motivo)],
    )
    db.commit()

    return serializar_paciente(paciente)
