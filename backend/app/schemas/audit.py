"""Audit log read schemas (UCE-SEG-04, RF-14).

The listing (SEG-U04) shows one row per event; the detail (SEG-U05) adds the
polymorphic ``entidad_id`` and the field-level changes. Neither schema ever
carries a password hash: the endpoint masks those values before building the
response.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.access import Paginacion


class CambioAuditoriaRead(BaseModel):
    """One field-level change of an audit event (``cambio_auditoria``)."""

    campo: str
    valor_anterior: str | None
    valor_nuevo: str | None


class AuditoriaRead(BaseModel):
    """One audit event as the listing shows it (SEG-U04 columns)."""

    id: uuid.UUID
    fecha_hora: datetime
    usuario_id: uuid.UUID
    usuario_nombre: str
    usuario_apellido: str
    modulo: str
    accion: str
    entidad_afectada: str
    direccion_ip: str | None


class AuditoriaDetalle(AuditoriaRead):
    """One audit event with its header extras and its changes (SEG-U05)."""

    entidad_id: uuid.UUID
    cambios: list[CambioAuditoriaRead]


class AuditoriaList(Paginacion):
    items: list[AuditoriaRead]
