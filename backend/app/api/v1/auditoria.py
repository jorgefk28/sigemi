"""Audit log read endpoints (UCE-SEG-04, RF-14).

The log is **append-only**: this module exposes read routes only. There is no
update or delete path, and no route writes an audit row — RF-14 audits
significant events, not read-only consultations.

Both routes are ``administrador``-only (UCE-SEG-04, precondición). The listing
answers the repository pagination envelope and filters by ``usuario_id``,
``fecha_desde`` / ``fecha_hasta`` and ``accion``; the detail adds the polymorphic
``entidad_id`` and the 0..N ``cambio_auditoria`` rows of the event.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.access import Usuario
from app.models.audit import Auditoria, CambioAuditoria
from app.schemas.audit import (
    AuditoriaDetalle,
    AuditoriaList,
    AuditoriaRead,
    CambioAuditoriaRead,
)

router = APIRouter(prefix="/auditoria", tags=["auditoria"])

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100

#: Closed set the ``accion`` filter accepts (decision D6 of ``## Screens``).
#: A value stored in the table but absent here — such as ``acceder``, written by
#: the login flow — is not offered by the filter and still shows up in the
#: unfiltered listing, exactly as D6 prescribes.
ACCIONES_FILTRABLES = ("crear", "modificar", "eliminar", "consultar")

#: Never echoed, even if a row ever records one (SEG-U05 rule).
CAMPOS_OCULTOS = frozenset({"contrasena_hash", "contrasena"})


def _rechazo(campo: str, detail: str) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": detail, "campo": campo},
    )


def _condiciones(
    usuario_id: uuid.UUID | None,
    fecha_desde: date | None,
    fecha_hasta: date | None,
    accion: str | None,
):
    """Build the WHERE conditions shared by the listing and its count.

    ``fecha_hora`` is stored timezone-aware in UTC, so the day boundaries are
    UTC days and the upper one is exclusive of the next midnight: both ends of
    the requested range are inclusive at day granularity.
    """
    condiciones = []

    if usuario_id is not None:
        condiciones.append(Auditoria.usuario_id == usuario_id)

    if fecha_desde is not None:
        condiciones.append(
            Auditoria.fecha_hora >= datetime.combine(fecha_desde, time.min, tzinfo=UTC)
        )

    if fecha_hasta is not None:
        condiciones.append(
            Auditoria.fecha_hora
            < datetime.combine(fecha_hasta + timedelta(days=1), time.min, tzinfo=UTC)
        )

    if accion is not None:
        condiciones.append(Auditoria.accion == accion)

    return condiciones


def _a_read(auditoria: Auditoria, nombre: str, apellido: str) -> AuditoriaRead:
    """Build the listing row from the event and its author."""
    return AuditoriaRead(
        id=auditoria.id,
        fecha_hora=auditoria.fecha_hora,
        usuario_id=auditoria.usuario_id,
        usuario_nombre=nombre,
        usuario_apellido=apellido,
        modulo=auditoria.modulo,
        accion=auditoria.accion,
        entidad_afectada=auditoria.entidad_afectada,
        direccion_ip=auditoria.direccion_ip,
    )


def _a_cambio(cambio: CambioAuditoria) -> CambioAuditoriaRead:
    """Build one change row, masking the value of every secret field."""
    if cambio.campo in CAMPOS_OCULTOS:
        return CambioAuditoriaRead(
            campo=cambio.campo, valor_anterior=None, valor_nuevo=None
        )
    return CambioAuditoriaRead(
        campo=cambio.campo,
        valor_anterior=cambio.valor_anterior,
        valor_nuevo=cambio.valor_nuevo,
    )


@router.get("", response_model=AuditoriaList)
def listar_eventos(
    usuario_id: uuid.UUID | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    accion: str | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> AuditoriaList | JSONResponse:
    """List audit events (UCE-SEG-04, pasos 2-4), newest first."""
    accion = accion.strip() if accion and accion.strip() else None
    if accion is not None and accion not in ACCIONES_FILTRABLES:
        return _rechazo(
            "accion",
            "El tipo de acción debe ser crear, modificar, eliminar o consultar",
        )
    if (
        fecha_desde is not None
        and fecha_hasta is not None
        and fecha_desde > fecha_hasta
    ):
        return _rechazo(
            "fecha_desde",
            "La fecha desde no puede ser posterior a la fecha hasta",
        )

    limite = min(limit, LIMITE_MAXIMO)
    condiciones = _condiciones(usuario_id, fecha_desde, fecha_hasta, accion)

    total = (
        db.scalar(select(func.count()).select_from(Auditoria).where(*condiciones)) or 0
    )
    filas = db.execute(
        select(Auditoria, Usuario.nombre, Usuario.apellido)
        .join(Usuario, Usuario.id == Auditoria.usuario_id)
        .where(*condiciones)
        .order_by(Auditoria.fecha_hora.desc(), Auditoria.id.desc())
        .limit(limite)
        .offset(offset)
    ).all()

    return AuditoriaList(
        items=[
            _a_read(auditoria, nombre, apellido)
            for auditoria, nombre, apellido in filas
        ],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/{auditoria_id}", response_model=AuditoriaDetalle)
def obtener_evento(
    auditoria_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> AuditoriaDetalle:
    """Return one audit event with its field-level changes (UCE-SEG-04, pasos 5-6)."""
    fila = db.execute(
        select(Auditoria, Usuario.nombre, Usuario.apellido)
        .join(Usuario, Usuario.id == Auditoria.usuario_id)
        .where(Auditoria.id == auditoria_id)
    ).first()
    if fila is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el evento",
        )

    auditoria, nombre, apellido = fila
    cambios = db.scalars(
        select(CambioAuditoria)
        .where(CambioAuditoria.auditoria_id == auditoria.id)
        .order_by(CambioAuditoria.campo)
    ).all()

    return AuditoriaDetalle(
        **_a_read(auditoria, nombre, apellido).model_dump(),
        entidad_id=auditoria.entidad_id,
        cambios=[_a_cambio(cambio) for cambio in cambios],
    )
