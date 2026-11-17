"""Clinical catalog schemas (UCE-DIAG-10, RF-16).

``tipo_analisis`` and ``tipo_muestra`` have the same shape in level 3 (a unique
``nombre``, a ``descripcion`` and an ``estado``), so they share one set of
schemas instead of duplicating four classes with different names.

No field carries a Pydantic length bound: the only rule level 1 gives is that
the name must exist and be unique, and a bound here would pre-empt it with the
automatic ``422`` that ``AGENTS.md`` forbids as a user-facing contract.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.access import Paginacion


class TipoAnalisisRead(BaseModel):
    """One row of the ``tipo_analisis`` catalog."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    estado: str


class TipoAnalisisCreate(BaseModel):
    """Payload for a new analysis type (UCE-DIAG-10, subflujo Crear)."""

    nombre: str
    descripcion: str | None = None


class TipoAnalisisUpdate(BaseModel):
    """Partial modification: only the fields that travelled change."""

    nombre: str | None = None
    descripcion: str | None = None


class TipoAnalisisList(Paginacion):
    items: list[TipoAnalisisRead]


class TipoMuestraRead(BaseModel):
    """One row of the ``tipo_muestra`` catalog."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    estado: str


class TipoMuestraCreate(BaseModel):
    """Payload for a new sample type (UCE-DIAG-10, subflujo Crear)."""

    nombre: str
    descripcion: str | None = None


class TipoMuestraUpdate(BaseModel):
    """Partial modification for a sample type."""

    nombre: str | None = None
    descripcion: str | None = None


class TipoMuestraList(Paginacion):
    items: list[TipoMuestraRead]
