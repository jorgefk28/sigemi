"""Wait-list schemas (UCE-REC-28/29).

The listing resolves ``paciente_nombre``, ``paciente_apellido`` and
``paciente_dni`` alongside ``paciente_id``, the same way the user listing
resolves role codes, so a screen never issues a second request per row.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.access import Paginacion


class ListaEsperaRead(BaseModel):
    """One wait-list entry with its patient's identifying fields resolved."""

    id: uuid.UUID
    paciente_id: uuid.UUID
    paciente_nombre: str
    paciente_apellido: str
    paciente_dni: str
    tipo_analisis_id: uuid.UUID | None
    fecha_solicitud: datetime
    estado: str
    observaciones: str | None


class ListaEsperaList(Paginacion):
    items: list[ListaEsperaRead]
