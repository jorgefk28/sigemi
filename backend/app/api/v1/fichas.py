"""Clinical record endpoints (UCE-DIAG-01, DIAG-06, DIAG-07).

The record is created from the patient's screen (REC-U06 → REC-U07 → «Nueva
consulta»), read by whoever consults the history and modified only while no
analysis of that patient is validated — UCE-DIAG-07 excepción del paso 1 says
that once an analysis is validated the edition is restricted to non-clinical
fields, and every field of this record is clinical, so the modification is
rejected with the reason.

Writing is ``bioquimico``-only (A-12)); reading also allows ``administrador``,
which is what UCE-DIAG-06 preconditions say.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.base import utcnow
from app.db.session import get_db
from app.models.access import Usuario
from app.models.clinical import (
    AnalisisMicologico,
    DatoClinico,
    FichaClinica,
    Paciente,
    VersionFichaClinica,
)
from app.models.enums import AccionAuditoria
from app.schemas.fichas import (
    CampoClinico,
    FichaClinicaCreate,
    FichaClinicaList,
    FichaClinicaRead,
    FichaClinicaUpdate,
)
from app.services.audit import registrar_auditoria
from app.services.fichas import (
    CAMPOS_CLINICOS,
    MOTIVO_VERSION,
    resolver_profesional,
    serializar,
    serializar_una,
    validar_datos,
)
from app.services.usuarios import ReglaDeUsuario

router = APIRouter(prefix="/fichas-clinicas", tags=["fichas"])

MODULO = "fichas_clinicas"
ENTIDAD = "ficha_clinica"

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100

LECTURA = ("bioquimico", "administrador")
ESCRITURA = ("bioquimico",)

ESTADO_ANALISIS_VALIDADO = "validado"


def _rechazo(regla: ReglaDeUsuario) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _obtener(db: Session, ficha_id: uuid.UUID) -> FichaClinica:
    ficha = db.get(FichaClinica, ficha_id)
    if ficha is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la ficha clínica",
        )
    return ficha


def _paciente(db: Session, paciente_id: uuid.UUID) -> Paciente:
    paciente = db.get(Paciente, paciente_id)
    if paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado"
        )
    return paciente


def _tiene_analisis_validado(db: Session, paciente_id: uuid.UUID) -> bool:
    """Whether the patient has any validated analysis (UCE-DIAG-07 excepción)."""
    return (
        db.scalar(
            select(AnalisisMicologico.id)
            .join(FichaClinica, FichaClinica.id == AnalisisMicologico.ficha_clinica_id)
            .where(
                FichaClinica.paciente_id == paciente_id,
                AnalisisMicologico.estado == ESTADO_ANALISIS_VALIDADO,
            )
            .limit(1)
        )
        is not None
    )


def _datos_actuales(db: Session, ficha_id: uuid.UUID) -> dict[str, str]:
    return {
        dato.campo: dato.valor
        for dato in db.scalars(
            select(DatoClinico).where(DatoClinico.ficha_clinica_id == ficha_id)
        )
    }


@router.get("/campos", response_model=list[CampoClinico])
def listar_campos(
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> list[CampoClinico]:
    """The catalog of clinical fields (A-04), so the form renders from it."""
    return [
        CampoClinico(campo=campo, etiqueta=etiqueta, obligatorio=obligatorio)
        for campo, etiqueta, obligatorio in CAMPOS_CLINICOS
    ]


@router.get("", response_model=FichaClinicaList)
def listar_fichas(
    paciente_id: uuid.UUID | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> FichaClinicaList:
    """List clinical records (UCE-DIAG-06 paso 4: ordered by date)."""
    limite = min(limit, LIMITE_MAXIMO)
    condiciones = [FichaClinica.paciente_id == paciente_id] if paciente_id else []

    total = (
        db.scalar(select(func.count()).select_from(FichaClinica).where(*condiciones))
        or 0
    )
    fichas = list(
        db.scalars(
            select(FichaClinica)
            .where(*condiciones)
            .order_by(FichaClinica.fecha_consulta.desc())
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return FichaClinicaList(
        items=[
            FichaClinicaRead.model_validate(fila) for fila in serializar(db, fichas)
        ],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/{ficha_id}", response_model=FichaClinicaRead)
def obtener_ficha(
    ficha_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> FichaClinicaRead:
    """Return one clinical record (UCE-DIAG-06 paso 5)."""
    return FichaClinicaRead.model_validate(serializar_una(db, _obtener(db, ficha_id)))


@router.post("", response_model=FichaClinicaRead, status_code=status.HTTP_201_CREATED)
def crear_ficha(
    request: Request,
    datos: FichaClinicaCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> FichaClinicaRead | JSONResponse:
    """Register a clinical record (UCE-DIAG-01 pasos 5-9)."""
    paciente = _paciente(db, datos.paciente_id)

    try:
        profesional = resolver_profesional(db, actor)
        normalizados = validar_datos(datos.datos, parcial=False)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    ficha = FichaClinica(
        paciente_id=paciente.id,
        profesional_id=profesional.id,
        fecha_consulta=utcnow(),
        version_actual=1,
        estado="activa",
    )
    db.add(ficha)
    db.flush()

    for campo, valor in normalizados.items():
        if valor:
            db.add(
                DatoClinico(
                    ficha_clinica_id=ficha.id,
                    campo=campo,
                    valor=valor,
                    tipo_dato="texto",
                )
            )
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD,
        entidad_id=ficha.id,
        direccion_ip=client_ip(request),
        cambios=[("paciente_id", None, str(paciente.id))],
    )
    db.commit()

    return FichaClinicaRead.model_validate(serializar_una(db, ficha))


@router.patch("/{ficha_id}", response_model=FichaClinicaRead)
def actualizar_ficha(
    request: Request,
    ficha_id: uuid.UUID,
    datos: FichaClinicaUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> FichaClinicaRead | JSONResponse:
    """Modify a clinical record, keeping the previous version (UCE-DIAG-07)."""
    ficha = _obtener(db, ficha_id)

    # UCE-DIAG-07 excepción del paso 1: with a validated analysis the edition is
    # restricted to non-clinical fields, and this record only has clinical ones.
    if _tiene_analisis_validado(db, ficha.paciente_id):
        return _rechazo(
            ReglaDeUsuario(
                "La ficha no se puede modificar: el paciente tiene un análisis validado",
                "datos",
            )
        )

    try:
        normalizados = validar_datos(datos.datos, parcial=True)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    previos = _datos_actuales(db, ficha.id)
    if all(previos.get(campo) == valor for campo, valor in normalizados.items()):
        # Nothing changed: no version, no audit row, same answer.
        return FichaClinicaRead.model_validate(serializar_una(db, ficha))

    for campo, valor in normalizados.items():
        existente = db.scalar(
            select(DatoClinico).where(
                DatoClinico.ficha_clinica_id == ficha.id, DatoClinico.campo == campo
            )
        )
        if existente is None:
            db.add(
                DatoClinico(
                    ficha_clinica_id=ficha.id,
                    campo=campo,
                    valor=valor,
                    tipo_dato="texto",
                )
            )
        else:
            existente.valor = valor

    nuevos = {**previos, **normalizados}
    ficha.version_actual += 1
    db.add(
        VersionFichaClinica(
            ficha_clinica_id=ficha.id,
            numero_version=ficha.version_actual,
            datos_previos=previos,
            datos_nuevos=nuevos,
            usuario_id=actor.id,
            motivo=MOTIVO_VERSION,
        )
    )
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=ficha.id,
        direccion_ip=client_ip(request),
        cambios=[
            (campo, previos.get(campo), nuevos.get(campo)) for campo in normalizados
        ],
    )
    db.commit()

    return FichaClinicaRead.model_validate(serializar_una(db, ficha))
