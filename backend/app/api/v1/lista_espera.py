"""Wait-list endpoints (UCE-REC-28, REC-29).

Consultation is read-only and ordered by the derived priority (decision A9):
``fecha_solicitud`` ascending, then ``tipo_analisis_id`` ascending.  Removing
an entry is a logical ``retirado`` transition audited as ``modificar`` (A8).
There is no manual-alta route: REC-23 has no level-1 sequence (gap G8).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.access import Usuario
from app.models.agenda import ListaEspera
from app.models.enums import AccionAuditoria, ListaEsperaEstado
from app.schemas.lista_espera import ListaEsperaList, ListaEsperaRead
from app.services.audit import registrar_auditoria
from app.services.lista_espera import serializar_entrada, serializar_entradas

router = APIRouter(prefix="/lista-espera", tags=["lista_espera"])

MODULO = "lista_espera"
ENTIDAD = "lista_espera"

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


def _condiciones(
    tipo_analisis_id: uuid.UUID | None,
    estado: str | None,
    fecha_desde: date | None,
    fecha_hasta: date | None,
) -> list:
    """Build the WHERE conditions shared by the listing and its count.

    ``fecha_solicitud`` is stored timezone-aware in UTC, so the day boundaries
    are UTC days and the upper bound is exclusive of the next midnight, like
    the audit listing.
    """
    condiciones = []

    if tipo_analisis_id is not None:
        condiciones.append(ListaEspera.tipo_analisis_id == tipo_analisis_id)

    if estado and estado.strip():
        condiciones.append(ListaEspera.estado == estado.strip())

    if fecha_desde is not None:
        condiciones.append(
            ListaEspera.fecha_solicitud
            >= datetime.combine(fecha_desde, time.min, tzinfo=UTC)
        )

    if fecha_hasta is not None:
        condiciones.append(
            ListaEspera.fecha_solicitud
            < datetime.combine(fecha_hasta + timedelta(days=1), time.min, tzinfo=UTC)
        )

    return condiciones


@router.get("", response_model=ListaEsperaList)
def listar_entradas(
    tipo_analisis_id: uuid.UUID | None = None,
    estado: str | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> ListaEsperaList:
    """List the wait list ordered by priority (UCE-REC-29, pasos 2-3)."""
    limite = min(limit, LIMITE_MAXIMO)
    condiciones = _condiciones(tipo_analisis_id, estado, fecha_desde, fecha_hasta)

    total = (
        db.scalar(select(func.count()).select_from(ListaEspera).where(*condiciones))
        or 0
    )
    entradas = list(
        db.scalars(
            select(ListaEspera)
            .where(*condiciones)
            .order_by(ListaEspera.fecha_solicitud, ListaEspera.tipo_analisis_id)
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return ListaEsperaList(
        items=serializar_entradas(db, entradas),
        total=total,
        limit=limite,
        offset=offset,
    )


@router.post("/{entrada_id}/quitar", response_model=ListaEsperaRead)
def quitar_entrada(
    request: Request,
    entrada_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("administrador")),
) -> ListaEsperaRead:
    """Remove an entry logically (UCE-REC-28, pasos 3-7), audited as modificar."""
    entrada = db.get(ListaEspera, entrada_id)
    if entrada is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la entrada en la lista de espera",
        )

    if entrada.estado == ListaEsperaEstado.RETIRADO.value:
        # Already removed: idempotent, no new audit row.
        return serializar_entrada(db, entrada)

    anterior = entrada.estado
    entrada.estado = ListaEsperaEstado.RETIRADO.value
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=entrada.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", anterior, ListaEsperaEstado.RETIRADO.value)],
    )
    db.commit()

    return serializar_entrada(db, entrada)
