"""Medical instruction schemas (UCE-REC-10 a REC-13, RF-02).

The listing resolves ``tipo_analisis_nombre`` alongside ``tipo_analisis_id`` so
the table never issues a second request per row — the same rule the wait list
follows with its patient fields.

No length bound lives here: UCE-REC-10 only says the three fields must be
present, and a Pydantic bound would pre-empt that with the automatic ``422``
that ``AGENTS.md`` forbids as a user-facing contract.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.access import Paginacion


class IndicacionRead(BaseModel):
    """One medical instruction with its analysis type resolved."""

    id: uuid.UUID
    titulo: str
    contenido: str
    tipo_analisis_id: uuid.UUID
    tipo_analisis_nombre: str
    estado: str
    fecha_creacion: datetime
    fecha_modificacion: datetime


class IndicacionCreate(BaseModel):
    """Payload for a new instruction (UCE-REC-10 paso 2): all three required."""

    titulo: str
    contenido: str
    tipo_analisis_id: uuid.UUID


class IndicacionUpdate(BaseModel):
    """Partial modification (UCE-REC-11 paso 3): only what travels changes."""

    titulo: str | None = None
    contenido: str | None = None
    tipo_analisis_id: uuid.UUID | None = None


class IndicacionList(Paginacion):
    items: list[IndicacionRead]
