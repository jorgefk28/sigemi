"""Medical instruction endpoints (UCE-REC-10 a REC-13, RF-02).

The module is for ``bioquimico`` and ``administrador``: the four UCE declare that
precondition in the same words. Deleting is logical (UCE-REC-12 paso 5:
«cambia el estado de la indicación a INACTIVA»), because historical appointments
still point at the instruction they used — the UCE comment says exactly that.

Instructions are the template sent to the patient when an appointment is booked;
the sending itself belongs to the WhatsApp agent and is out of scope here.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.access import Usuario
from app.models.agenda import IndicacionMedica
from app.models.enums import AccionAuditoria
from app.schemas.indicaciones import (
    IndicacionCreate,
    IndicacionList,
    IndicacionRead,
    IndicacionUpdate,
)
from app.services.audit import registrar_auditoria
from app.services.indicaciones import (
    ACTIVA,
    INACTIVA,
    normalizar_contenido,
    normalizar_titulo,
    resolver_tipo_analisis,
    serializar,
    serializar_una,
)
from app.services.usuarios import ReglaDeUsuario

router = APIRouter(prefix="/indicaciones-medicas", tags=["indicaciones"])

MODULO = "indicaciones_medicas"
ENTIDAD = "indicacion_medica"

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100

ROLES = ("bioquimico", "administrador")


def _rechazo(regla: ReglaDeUsuario) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _obtener(db: Session, indicacion_id: uuid.UUID) -> IndicacionMedica:
    indicacion = db.get(IndicacionMedica, indicacion_id)
    if indicacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la indicación médica",
        )
    return indicacion


@router.get("", response_model=IndicacionList)
def listar_indicaciones(
    q: str | None = None,
    estado: str | None = None,
    tipo_analisis_id: uuid.UUID | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*ROLES)),
) -> IndicacionList:
    """List the instructions with the filters of UCE-REC-13 paso 4."""
    limite = min(limit, LIMITE_MAXIMO)

    condiciones = []
    if q and q.strip():
        patron = f"%{q.strip()}%"
        condiciones.append(
            or_(
                IndicacionMedica.titulo.ilike(patron),
                IndicacionMedica.contenido.ilike(patron),
            )
        )
    if estado:
        if estado not in {ACTIVA, INACTIVA}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estado debe ser activa o inactiva",
            )
        condiciones.append(IndicacionMedica.estado == estado)
    if tipo_analisis_id is not None:
        condiciones.append(IndicacionMedica.tipo_analisis_id == tipo_analisis_id)

    total = (
        db.scalar(
            select(func.count()).select_from(IndicacionMedica).where(*condiciones)
        )
        or 0
    )
    filas = list(
        db.scalars(
            select(IndicacionMedica)
            .where(*condiciones)
            .order_by(IndicacionMedica.titulo)
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return IndicacionList(
        items=[IndicacionRead.model_validate(fila) for fila in serializar(db, filas)],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/{indicacion_id}", response_model=IndicacionRead)
def obtener_indicacion(
    indicacion_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*ROLES)),
) -> IndicacionRead:
    """Return one instruction, used by the edition form on a cold load."""
    return IndicacionRead.model_validate(
        serializar_una(db, _obtener(db, indicacion_id))
    )


@router.post("", response_model=IndicacionRead, status_code=status.HTTP_201_CREATED)
def crear_indicacion(
    request: Request,
    datos: IndicacionCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ROLES)),
) -> IndicacionRead | JSONResponse:
    """Create an instruction (UCE-REC-10 pasos 2-7)."""
    try:
        titulo = normalizar_titulo(datos.titulo)
        contenido = normalizar_contenido(datos.contenido)
        resolver_tipo_analisis(db, datos.tipo_analisis_id)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    indicacion = IndicacionMedica(
        titulo=titulo,
        contenido=contenido,
        tipo_analisis_id=datos.tipo_analisis_id,
        estado=ACTIVA,
    )
    db.add(indicacion)
    db.flush()

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD,
        entidad_id=indicacion.id,
        direccion_ip=client_ip(request),
        cambios=[("titulo", None, titulo), ("contenido", None, contenido)],
    )
    db.commit()

    return IndicacionRead.model_validate(serializar_una(db, indicacion))


@router.patch("/{indicacion_id}", response_model=IndicacionRead)
def actualizar_indicacion(
    request: Request,
    indicacion_id: uuid.UUID,
    datos: IndicacionUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ROLES)),
) -> IndicacionRead | JSONResponse:
    """Modify an instruction (UCE-REC-11 pasos 3-4)."""
    indicacion = _obtener(db, indicacion_id)

    enviados = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not enviados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para modificar",
        )

    cambios: list[tuple[str, str | None, str | None]] = []

    if "titulo" in enviados:
        try:
            titulo = normalizar_titulo(enviados["titulo"])
        except ReglaDeUsuario as regla:
            return _rechazo(regla)
        if indicacion.titulo != titulo:
            cambios.append(("titulo", indicacion.titulo, titulo))
            indicacion.titulo = titulo

    if "contenido" in enviados:
        try:
            contenido = normalizar_contenido(enviados["contenido"])
        except ReglaDeUsuario as regla:
            return _rechazo(regla)
        if indicacion.contenido != contenido:
            cambios.append(("contenido", indicacion.contenido, contenido))
            indicacion.contenido = contenido

    if "tipo_analisis_id" in enviados:
        try:
            resolver_tipo_analisis(db, enviados["tipo_analisis_id"])
        except ReglaDeUsuario as regla:
            return _rechazo(regla)
        if indicacion.tipo_analisis_id != enviados["tipo_analisis_id"]:
            cambios.append(
                (
                    "tipo_analisis_id",
                    str(indicacion.tipo_analisis_id),
                    str(enviados["tipo_analisis_id"]),
                )
            )
            indicacion.tipo_analisis_id = enviados["tipo_analisis_id"]

    if cambios:
        registrar_auditoria(
            db,
            usuario_id=actor.id,
            modulo=MODULO,
            accion=AccionAuditoria.MODIFICAR,
            entidad_afectada=ENTIDAD,
            entidad_id=indicacion.id,
            direccion_ip=client_ip(request),
            cambios=cambios,
        )
        db.commit()

    return IndicacionRead.model_validate(serializar_una(db, indicacion))


@router.post("/{indicacion_id}/baja", response_model=IndicacionRead)
def dar_de_baja_indicacion(
    request: Request,
    indicacion_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ROLES)),
) -> IndicacionRead | JSONResponse:
    """Deactivate an instruction (UCE-REC-12 pasos 3-6), logically and audited."""
    indicacion = _obtener(db, indicacion_id)

    if indicacion.estado == INACTIVA:
        # Idempotent: a second confirmation is not an error and adds no audit.
        return IndicacionRead.model_validate(serializar_una(db, indicacion))

    anterior = indicacion.estado
    indicacion.estado = INACTIVA
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=indicacion.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", anterior, INACTIVA)],
    )
    db.commit()

    return IndicacionRead.model_validate(serializar_una(db, indicacion))
