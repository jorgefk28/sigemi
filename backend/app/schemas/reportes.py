"""Report schemas (UCE-REP-01, RF-15).

The clinical report is **anonymized**: it never carries a name, a DNI, a phone,
an e-mail or an address. What it does carry is a stable opaque key per patient so
rows can be grouped without identifying anyone (A-10 of the decision log).
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.schemas.access import Paginacion


class ReporteClinicoRow(BaseModel):
    """One anonymized row of the clinical report."""

    paciente_clave: str
    fecha: date
    tipo_analisis: str
    tipo_muestra: str
    estado: str
    edad: int | None


class ReporteClinicoPreview(Paginacion):
    """The preview of REP-01 paso 6: a few rows of the processed set."""

    items: list[ReporteClinicoRow]
    columnas: list[str]
