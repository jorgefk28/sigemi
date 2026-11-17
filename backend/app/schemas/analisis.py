"""Analysis schemas (UCE-DIAG-02 a DIAG-09, DIAG-13, DIAG-14, RF-06/RF-21).

The listing resolves the patient, the analysis type, the sample type and both
professionals, so the panel and the detail never issue a query per row.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.access import Paginacion


class HallazgoRead(BaseModel):
    """One finding of an analysis (``hallazgo_analisis``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tipo_hallazgo: str
    dato: str
    estado_alcanzado: str | None
    fecha: datetime


class HallazgoCreate(BaseModel):
    """Payload of a finding loaded while the analysis advances (DIAG-03 paso 3)."""

    tipo_hallazgo: str
    dato: str
    estado_alcanzado: str | None = None


class AnalisisRead(BaseModel):
    """An analysis with everything both screens display."""

    id: uuid.UUID
    ficha_clinica_id: uuid.UUID
    paciente_id: uuid.UUID
    paciente_apellido: str
    paciente_nombre: str
    paciente_dni: str
    tipo_analisis_id: uuid.UUID
    tipo_analisis_nombre: str
    muestra_id: uuid.UUID
    tipo_muestra_nombre: str
    profesional_responsable_id: uuid.UUID
    profesional_responsable_nombre: str
    profesional_validador_id: uuid.UUID | None
    profesional_validador_nombre: str | None
    version_actual: int
    estado: str
    fecha_creacion: datetime
    fecha_validacion: datetime | None
    motivo_invalidacion: str | None
    hallazgos: list[HallazgoRead]
    addendum: dict[str, str] | None


class MuestraCreate(BaseModel):
    """Sample entry (UCE-DIAG-02 paso 3 + G5 resolution A-08).

    ``ficha_clinica_id`` is optional: when absent the most recent record of the
    patient is used (A-13), because DIAG-02 says the patient must already have one.
    """

    paciente_id: uuid.UUID
    tipo_muestra_id: uuid.UUID
    tipo_analisis_id: uuid.UUID
    ficha_clinica_id: uuid.UUID | None = None
    observaciones: str | None = None


class MuestraRead(BaseModel):
    """The sample plus the first analysis created on it."""

    id: uuid.UUID
    paciente_id: uuid.UUID
    tipo_muestra_id: uuid.UUID
    fecha_ingreso: datetime
    observaciones: str | None
    analisis: AnalisisRead


class EstadoUpdate(BaseModel):
    """Advance the state of an analysis (DIAG-03 paso 4)."""

    estado: str
    hallazgos: list[HallazgoCreate] = []


class MotivoRequest(BaseModel):
    """Mandatory motive of an invalidation or a sample rejection."""

    motivo: str
    observacion: str | None = None


class AddendumRequest(BaseModel):
    """Correction of a validated analysis (DIAG-13 paso 3)."""

    motivo: str
    contenido: str


class AnalisisList(Paginacion):
    items: list[AnalisisRead]
