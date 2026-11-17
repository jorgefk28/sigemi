"""Clinical record schemas (UCE-DIAG-01, DIAG-06, DIAG-07).

The record is a key-value store in level 3 (``dato_clinico.campo`` /
``valor``), so the payload is a map. The **catalog of accepted keys** does not
exist in any level and is declared in A-04 of ``odd/DECISIONES-AUTONOMAS.md``;
the API exposes it through ``GET /fichas-clinicas/campos`` so the form never
hardcodes a second copy.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.access import Paginacion


class CampoClinico(BaseModel):
    """One field of the clinical record, with its label and obligation."""

    campo: str
    etiqueta: str
    obligatorio: bool


class FichaClinicaRead(BaseModel):
    """A clinical record with its data resolved."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    paciente_id: uuid.UUID
    paciente_apellido: str
    paciente_nombre: str
    paciente_dni: str
    profesional_id: uuid.UUID
    profesional_nombre: str
    fecha_consulta: datetime
    version_actual: int
    estado: str
    datos: dict[str, str]


class FichaClinicaCreate(BaseModel):
    """Payload for a new record (UCE-DIAG-01 paso 5)."""

    paciente_id: uuid.UUID
    datos: dict[str, str]


class FichaClinicaUpdate(BaseModel):
    """Payload for a modification (UCE-DIAG-07 paso 3): only the fields sent."""

    datos: dict[str, str]


class FichaClinicaList(Paginacion):
    items: list[FichaClinicaRead]
