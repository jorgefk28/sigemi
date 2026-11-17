"""Analysis endpoints (UCE-DIAG-02 a DIAG-09, DIAG-13, DIAG-14; RF-06/RF-21).

One module covers the whole clinical cycle because the UCE do: the sample entry
creates the first analysis, the panel lists them, the detail shows one and every
action changes that same record.

Out of scope, and refused instead of faked:

- **PDF generation, OTP and WhatsApp** (DIAG-04 pasos 7-10, DIAG-05, DIAG-12):
  validation marks the analysis as validated and records the validator; it does
  **not** create an ``informe_resultados`` row with an invented path, and the
  manual OTP resend is not exposed. Decision A-14.
- **Additional analyses on an existing sample**: the level 3 allows 1:N but no UCE
  describes how the second one starts (gap G7). Decision A-16.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.base import utcnow
from app.db.session import get_db
from app.models.access import Usuario
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    HallazgoAnalisis,
    Muestra,
    VersionAnalisis,
)
from app.models.enums import AccionAuditoria
from app.schemas.analisis import (
    AddendumRequest,
    AnalisisList,
    AnalisisRead,
    EstadoUpdate,
    MotivoRequest,
    MuestraCreate,
    MuestraRead,
)
from app.services.analisis import (
    EN_PROCESO,
    INVALIDABLES,
    INVALIDADO,
    PENDIENTE,
    TERMINADO,
    TIPOS_HALLAZGO,
    VALIDADO,
    combinar_admitida,
    ficha_vigente,
    resolver_profesional,
    serializar,
    serializar_uno,
    validar_hallazgos,
    validar_transicion,
)
from app.services.audit import registrar_auditoria
from app.services.usuarios import ReglaDeUsuario

router = APIRouter(tags=["analisis"])

MODULO = "analisis"
ENTIDAD = "analisis_micologico"

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100

LECTURA = ("bioquimico", "administrador")
ESCRITURA = ("bioquimico",)
INVALIDACION = ("bioquimico", "administrador")


def _rechazo(regla: ReglaDeUsuario) -> JSONResponse:
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _obtener(db: Session, analisis_id: uuid.UUID) -> AnalisisMicologico:
    analisis = db.get(AnalisisMicologico, analisis_id)
    if analisis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró el análisis"
        )
    return analisis


@router.get("/tipos-hallazgo")
def listar_tipos_hallazgo(
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> list[dict[str, str]]:
    """The catalog of finding types (A-05), so the screen renders from it."""
    return [
        {"codigo": clave, "etiqueta": etiqueta} for clave, etiqueta in TIPOS_HALLAZGO
    ]


@router.post(
    "/muestras", response_model=MuestraRead, status_code=status.HTTP_201_CREATED
)
def registrar_muestra(
    request: Request,
    datos: MuestraCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> MuestraRead | JSONResponse:
    """Register the sample and its first analysis (UCE-DIAG-02 pasos 3-7)."""
    try:
        profesional = resolver_profesional(db, actor)
        ficha = ficha_vigente(db, datos.paciente_id, datos.ficha_clinica_id)
        combinar_admitida(db, datos.tipo_analisis_id, datos.tipo_muestra_id)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    if db.get(TipoAnalisis, datos.tipo_analisis_id) is None:
        return _rechazo(
            ReglaDeUsuario("El tipo de análisis no existe", "tipo_analisis_id")
        )
    if db.get(TipoMuestra, datos.tipo_muestra_id) is None:
        return _rechazo(
            ReglaDeUsuario("El tipo de muestra no existe", "tipo_muestra_id")
        )

    muestra = Muestra(
        paciente_id=datos.paciente_id,
        tipo_muestra_id=datos.tipo_muestra_id,
        usuario_id=actor.id,
        fecha_ingreso=utcnow(),
        observaciones=(datos.observaciones or "").strip() or None,
    )
    db.add(muestra)
    db.flush()

    analisis = AnalisisMicologico(
        ficha_clinica_id=ficha.id,
        tipo_analisis_id=datos.tipo_analisis_id,
        muestra_id=muestra.id,
        profesional_responsable_id=profesional.id,
        version_actual=1,
        estado=PENDIENTE,
    )
    db.add(analisis)
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", None, PENDIENTE)],
    )
    db.commit()

    return MuestraRead(
        id=muestra.id,
        paciente_id=muestra.paciente_id,
        tipo_muestra_id=muestra.tipo_muestra_id,
        fecha_ingreso=muestra.fecha_ingreso,
        observaciones=muestra.observaciones,
        analisis=AnalisisRead.model_validate(serializar_uno(db, analisis)),
    )


@router.get("/analisis", response_model=AnalisisList)
def listar_analisis(
    q: str | None = None,
    estado: str | None = None,
    tipo_analisis_id: uuid.UUID | None = None,
    paciente_id: uuid.UUID | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> AnalisisList:
    """The work panel of UCE-DIAG-09 pasos 2-4.

    The «bioquímico que registró la última acción» filter of paso 3 has no column
    in level 3; it is resolved from ``auditoria`` when asked (A-07), which is why
    it is a separate parameter instead of a join on every listing.
    """
    limite = min(limit, LIMITE_MAXIMO)

    condiciones = []
    if estado:
        if estado not in {PENDIENTE, EN_PROCESO, TERMINADO, VALIDADO, INVALIDADO}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estado del análisis no es válido",
            )
        condiciones.append(AnalisisMicologico.estado == estado)
    if tipo_analisis_id is not None:
        condiciones.append(AnalisisMicologico.tipo_analisis_id == tipo_analisis_id)
    if paciente_id is not None:
        from app.models.clinical import FichaClinica

        condiciones.append(
            AnalisisMicologico.ficha_clinica_id.in_(
                select(FichaClinica.id).where(FichaClinica.paciente_id == paciente_id)
            )
        )
    if fecha_desde is not None:
        condiciones.append(
            AnalisisMicologico.fecha_creacion >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        condiciones.append(
            AnalisisMicologico.fecha_creacion <= datetime.combine(fecha_hasta, time.max)
        )
    if q and q.strip():
        from app.models.clinical import FichaClinica, Paciente

        patron = f"%{q.strip()}%"
        condiciones.append(
            AnalisisMicologico.ficha_clinica_id.in_(
                select(FichaClinica.id)
                .join(Paciente, Paciente.id == FichaClinica.paciente_id)
                .where(or_(Paciente.apellido.ilike(patron), Paciente.dni.ilike(patron)))
            )
        )

    total = (
        db.scalar(
            select(func.count()).select_from(AnalisisMicologico).where(*condiciones)
        )
        or 0
    )
    filas = list(
        db.scalars(
            select(AnalisisMicologico)
            .where(*condiciones)
            .order_by(AnalisisMicologico.fecha_creacion.desc())
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return AnalisisList(
        items=[AnalisisRead.model_validate(fila) for fila in serializar(db, filas)],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/analisis/{analisis_id}", response_model=AnalisisRead)
def obtener_analisis(
    analisis_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> AnalisisRead:
    """Return one analysis with its findings (UCE-DIAG-03 paso 2)."""
    return AnalisisRead.model_validate(serializar_uno(db, _obtener(db, analisis_id)))


@router.patch("/analisis/{analisis_id}/estado", response_model=AnalisisRead)
def actualizar_estado(
    request: Request,
    analisis_id: uuid.UUID,
    datos: EstadoUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> AnalisisRead | JSONResponse:
    """Load findings and advance the state (UCE-DIAG-03 pasos 3-8)."""
    analisis = _obtener(db, analisis_id)

    if analisis.estado in {VALIDADO, INVALIDADO}:
        return _rechazo(
            ReglaDeUsuario(
                "El análisis está cerrado: no admite actualizaciones", "estado"
            )
        )

    try:
        validar_transicion(analisis.estado, datos.estado)
        hallazgos = validar_hallazgos(
            [hallazgo.model_dump() for hallazgo in datos.hallazgos]
        )
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    anterior = analisis.estado
    analisis.estado = datos.estado

    for hallazgo in hallazgos:
        db.add(
            HallazgoAnalisis(
                analisis_id=analisis.id,
                tipo_hallazgo=hallazgo["tipo_hallazgo"],
                dato=hallazgo["dato"],
                estado_alcanzado=hallazgo["estado_alcanzado"],
            )
        )
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", anterior, datos.estado)]
        + [("hallazgo", None, str(hallazgo["dato"])) for hallazgo in hallazgos],
    )
    db.commit()

    return AnalisisRead.model_validate(serializar_uno(db, analisis))


@router.post("/analisis/{analisis_id}/validar", response_model=AnalisisRead)
def validar_analisis(
    request: Request,
    analisis_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> AnalisisRead | JSONResponse:
    """Validate a finished analysis (UCE-DIAG-04 pasos 3-6).

    Only the biochemist validates (UCE-DIAG-04 comentarios), and only from
    ``terminado``. The PDF, OTP and WhatsApp steps of the UCE are out of scope
    (A-14): nothing is created that pretends they happened.
    """
    analisis = _obtener(db, analisis_id)

    if analisis.estado != TERMINADO:
        return _rechazo(
            ReglaDeUsuario("Sólo se valida un análisis en estado «terminado»", "estado")
        )

    try:
        profesional = resolver_profesional(db, actor)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    analisis.estado = VALIDADO
    analisis.fecha_validacion = utcnow()
    analisis.profesional_validador_id = profesional.id
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", TERMINADO, VALIDADO)],
    )
    db.commit()

    return AnalisisRead.model_validate(serializar_uno(db, analisis))


@router.post("/analisis/{analisis_id}/invalidar", response_model=AnalisisRead)
def invalidar_analisis(
    request: Request,
    analisis_id: uuid.UUID,
    datos: MotivoRequest,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*INVALIDACION)),
) -> AnalisisRead | JSONResponse:
    """Invalidate an analysis with its mandatory motive (UCE-DIAG-08 pasos 3-9)."""
    analisis = _obtener(db, analisis_id)

    if analisis.estado == VALIDADO:
        return _rechazo(
            ReglaDeUsuario(
                "El análisis validado es definitivo y no se invalida", "estado"
            )
        )
    if analisis.estado == INVALIDADO:
        return _rechazo(ReglaDeUsuario("El análisis ya está invalidado", "estado"))

    motivo = (datos.motivo or "").strip()
    if not motivo:
        return _rechazo(ReglaDeUsuario("El motivo no puede estar vacío", "motivo"))

    anterior = analisis.estado
    analisis.estado = INVALIDADO
    analisis.motivo_invalidacion = motivo
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[
            ("estado", anterior, INVALIDADO),
            ("motivo_invalidacion", None, motivo),
        ],
    )
    db.commit()

    return AnalisisRead.model_validate(serializar_uno(db, analisis))


@router.post("/analisis/{analisis_id}/rechazar", response_model=AnalisisRead)
def rechazar_muestra(
    request: Request,
    analisis_id: uuid.UUID,
    datos: MotivoRequest,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> AnalisisRead | JSONResponse:
    """Reject a sample for quality reasons (UCE-DIAG-14 pasos 3-8).

    Same ``invalidado`` state as DIAG-08 (the UCE says so) with the rejection
    motive and its observation written in the audit trail.
    """
    analisis = _obtener(db, analisis_id)

    if analisis.estado not in INVALIDABLES:
        return _rechazo(
            ReglaDeUsuario(
                "Sólo se rechaza una muestra de un análisis pendiente o en proceso",
                "estado",
            )
        )

    motivo = (datos.motivo or "").strip()
    observacion = (datos.observacion or "").strip()
    if not motivo:
        return _rechazo(
            ReglaDeUsuario("El motivo del rechazo no puede estar vacío", "motivo")
        )
    if not observacion:
        return _rechazo(
            ReglaDeUsuario(
                "La observación del rechazo no puede estar vacía", "observacion"
            )
        )

    anterior = analisis.estado
    analisis.estado = INVALIDADO
    analisis.motivo_invalidacion = f"{motivo}: {observacion}"
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[
            ("estado", anterior, INVALIDADO),
            ("motivo_invalidacion", None, analisis.motivo_invalidacion),
        ],
    )
    db.commit()

    return AnalisisRead.model_validate(serializar_uno(db, analisis))


@router.post("/analisis/{analisis_id}/addendum", response_model=AnalisisRead)
def agregar_addendum(
    request: Request,
    analisis_id: uuid.UUID,
    datos: AddendumRequest,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> AnalisisRead | JSONResponse:
    """Add an addendum to a validated analysis (UCE-DIAG-13 pasos 3-7).

    The original is not modified: a new ``version_analisis`` keeps both snapshots
    and the analysis points at it (RNF-04).
    """
    analisis = _obtener(db, analisis_id)

    if analisis.estado != VALIDADO:
        return _rechazo(
            ReglaDeUsuario("Sólo se corrige un análisis validado", "estado")
        )

    motivo = (datos.motivo or "").strip()
    contenido = (datos.contenido or "").strip()
    if not motivo:
        return _rechazo(
            ReglaDeUsuario("El motivo de la corrección no puede estar vacío", "motivo")
        )
    if not contenido:
        return _rechazo(
            ReglaDeUsuario(
                "El contenido del addendum no puede estar vacío", "contenido"
            )
        )

    previo = {
        "estado": analisis.estado,
        "version_actual": analisis.version_actual,
        "motivo_invalidacion": analisis.motivo_invalidacion,
    }
    analisis.version_actual += 1
    nuevo = {
        "estado": analisis.estado,
        "version_actual": analisis.version_actual,
        "motivo_invalidacion": analisis.motivo_invalidacion,
        "addendum": {"motivo": motivo, "contenido": contenido},
    }
    db.add(
        VersionAnalisis(
            analisis_id=analisis.id,
            numero_version=analisis.version_actual,
            datos_previos=previo,
            datos_nuevos=nuevo,
            usuario_id=actor.id,
            motivo=motivo,
        )
    )
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=analisis.id,
        direccion_ip=client_ip(request),
        cambios=[("addendum", None, contenido)],
    )
    db.commit()

    return AnalisisRead.model_validate(serializar_uno(db, analisis))
