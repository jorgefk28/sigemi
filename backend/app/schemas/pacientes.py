"""Patient schemas (UCE-REC-16/17/18/19, S-01).

``sexo`` is intentionally absent from every schema: no UCE governs it (gap
G13), so the API neither accepts nor exposes it.  Field-level format rules
(dni, telefono, correo, fecha_nacimiento) are business validation and answer
``400`` + ``campo`` from ``app.services.pacientes``; no schema bound pre-empts
them with the automatic ``422``.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.access import Paginacion


class PacienteRead(BaseModel):
    """A patient as exposed by the API (level-3 columns, minus ``sexo``)."""

    id: uuid.UUID
    numero_registro: str
    dni: str
    nombre: str
    apellido: str
    fecha_nacimiento: date
    domicilio: str | None
    telefono: str
    correo_electronico: str | None
    obra_social: str | None
    nivel_registro: str
    estado: str
    fecha_ingreso: datetime


class PacienteCreate(BaseModel):
    """Payload for a new patient (UCE-REC-16, paso 2).

    Required: ``dni``, ``nombre``, ``apellido``, ``fecha_nacimiento`` and
    ``telefono``.  ``domicilio``, ``correo_electronico`` and ``obra_social``
    are optional.  ``numero_registro``, ``nivel_registro``, ``estado`` and
    ``fecha_ingreso`` are derived by the service, never accepted from the
    client.
    """

    dni: str
    nombre: str
    apellido: str
    fecha_nacimiento: date
    telefono: str
    domicilio: str | None = None
    correo_electronico: str | None = None
    obra_social: str | None = None


class PacienteUpdate(BaseModel):
    """Partial modification payload (UCE-REC-17)."""

    dni: str | None = None
    nombre: str | None = None
    apellido: str | None = None
    fecha_nacimiento: date | None = None
    telefono: str | None = None
    domicilio: str | None = None
    correo_electronico: str | None = None
    obra_social: str | None = None


class PacienteBaja(BaseModel):
    """Deactivation payload (UCE-REC-19): the motivo is mandatory."""

    motivo: str


class PacienteList(Paginacion):
    items: list[PacienteRead]
