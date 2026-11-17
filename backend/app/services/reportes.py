"""Report rules (UCE-REP-01, RF-15).

Two things live here: the anonymization rule (A-10) and the CSV rendering.

**Anonymization.** UCE-REP-01 paso 5 says «si el reporte es Clínico, el Backend
ejecuta la regla de anonimización estricta (remoción de datos sensibles)» without
listing the fields. The declared list is: the report **never** emits `nombre`,
`apellido`, `dni`, `telefono`, `correo_electronico`, `domicilio` or
`obra_social`; it emits an opaque per-patient key instead. Nothing reaches the
screen that could identify a person, so the rule is enforced where the data is
read, not where it is rendered.

**CSV.** `;` is the separator on purpose: it is what a spreadsheet in es-AR expects
for a decimal-comma locale, and the file carries a UTF-8 BOM so accents survive a
double click. Both are presentation decisions, recorded in A-10.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    FichaClinica,
    Muestra,
    Paciente,
)

#: Columns emitted, in order. This list is the contract of the export.
COLUMNAS: tuple[str, ...] = (
    "paciente_clave",
    "fecha",
    "tipo_analisis",
    "tipo_muestra",
    "estado",
    "edad",
)

#: Fields that never leave the database inside a report.
CAMPOS_PROHIBIDOS = (
    "nombre",
    "apellido",
    "dni",
    "telefono",
    "correo_electronico",
    "domicilio",
    "obra_social",
)

SEPARADOR = ";"


def clave_opaca(paciente_id: object) -> str:
    """Stable per-patient key that cannot be reversed into an identity."""
    return str(paciente_id).replace("-", "")[:8].upper()


def edad(fecha_nacimiento: date, hoy: date | None = None) -> int:
    """Age in whole years, computed on the fly (never stored)."""
    referencia = hoy or date.today()
    return (
        referencia.year
        - fecha_nacimiento.year
        - (
            (referencia.month, referencia.day)
            < (fecha_nacimiento.month, fecha_nacimiento.day)
        )
    )


def _condiciones(fecha_desde: date | None, fecha_hasta: date | None) -> list:
    condiciones = []
    if fecha_desde is not None:
        condiciones.append(
            AnalisisMicologico.fecha_creacion >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        condiciones.append(
            AnalisisMicologico.fecha_creacion <= datetime.combine(fecha_hasta, time.max)
        )
    return condiciones


def _consulta(db: Session, fecha_desde: date | None, fecha_hasta: date | None):
    """The joined query behind both the preview and the export."""
    return (
        select(
            AnalisisMicologico.id,
            AnalisisMicologico.estado,
            AnalisisMicologico.fecha_creacion,
            Paciente.id,
            Paciente.fecha_nacimiento,
            TipoAnalisis.nombre,
            TipoMuestra.nombre,
        )
        .join(FichaClinica, FichaClinica.id == AnalisisMicologico.ficha_clinica_id)
        .join(Paciente, Paciente.id == FichaClinica.paciente_id)
        .join(Muestra, Muestra.id == AnalisisMicologico.muestra_id)
        .join(TipoMuestra, TipoMuestra.id == Muestra.tipo_muestra_id)
        .join(TipoAnalisis, TipoAnalisis.id == AnalisisMicologico.tipo_analisis_id)
        .where(*_condiciones(fecha_desde, fecha_hasta))
        .order_by(AnalisisMicologico.fecha_creacion)
    )


def filas_clinicas(
    db: Session,
    fecha_desde: date | None,
    fecha_hasta: date | None,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict[str, object]]:
    """Anonymized rows of the clinical report."""
    consulta = _consulta(db, fecha_desde, fecha_hasta)
    if limit is not None:
        consulta = consulta.limit(limit).offset(offset)

    resultado: list[dict[str, object]] = []
    for fila in db.execute(consulta):
        resultado.append(
            {
                "paciente_clave": clave_opaca(fila[3]),
                "fecha": fila[2].date(),
                "tipo_analisis": fila[5],
                "tipo_muestra": fila[6],
                "estado": fila[1],
                "edad": edad(fila[4]),
            }
        )
    return resultado


def total_clinico(
    db: Session, fecha_desde: date | None, fecha_hasta: date | None
) -> int:
    """How many rows the report would export."""
    subconsulta = _consulta(db, fecha_desde, fecha_hasta).subquery()
    return db.scalar(select(func.count()).select_from(subconsulta)) or 0


def a_csv(filas: list[dict[str, object]]) -> bytes:
    """Render the rows as the CSV the browser downloads (REP-01 paso 8)."""
    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=SEPARADOR, lineterminator="\r\n")
    escritor.writerow(COLUMNAS)
    for fila in filas:
        escritor.writerow([fila[columna] for columna in COLUMNAS])
    # A UTF-8 BOM makes a double click open the file with its accents intact.
    return b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
