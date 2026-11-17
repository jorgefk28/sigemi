"""Business rules for medical instructions (UCE-REC-10 a REC-13, RF-02).

Three fields are mandatory — ``titulo``, ``contenido`` and ``tipo_analisis_id``
— and UCE-REC-10 excepción del paso 4 is explicit about the last one: «si el
contenido está vacío o no se seleccionó un Tipo de Análisis, el sistema muestra
una alerta de validación y no persiste». Both answer ``400`` with ``campo``.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agenda import IndicacionMedica
from app.models.catalogs import TipoAnalisis
from app.services.usuarios import ReglaDeUsuario, normalizar_texto

ACTIVA = "activa"
INACTIVA = "inactiva"


def normalizar_titulo(valor: str) -> str:
    """Trim the title and reject a blank one."""
    return normalizar_texto("titulo", "El título", valor)


def normalizar_contenido(valor: str) -> str:
    """Trim the content and reject a blank one."""
    return normalizar_texto("contenido", "El contenido", valor)


def resolver_tipo_analisis(db: Session, tipo_id: uuid.UUID) -> TipoAnalisis:
    """Return the analysis type or reject with the field that failed.

    A missing type is answered as a field rejection and not as ``404``: the id
    travels inside the body of a create/update, so the user has to fix the
    field, not the URL. This mirrors how the patient form treats a duplicated
    DNI.
    """
    tipo = db.get(TipoAnalisis, tipo_id)
    if tipo is None:
        raise ReglaDeUsuario(
            "El tipo de análisis seleccionado no existe", "tipo_analisis_id"
        )
    return tipo


def serializar(
    db: Session, indicaciones: list[IndicacionMedica]
) -> list[dict[str, object]]:
    """Shape rows with their analysis-type name resolved in one query."""
    if not indicaciones:
        return []

    tipos = {
        tipo.id: tipo.nombre
        for tipo in db.scalars(
            select(TipoAnalisis).where(
                TipoAnalisis.id.in_({fila.tipo_analisis_id for fila in indicaciones})
            )
        )
    }

    return [
        {
            "id": fila.id,
            "titulo": fila.titulo,
            "contenido": fila.contenido,
            "tipo_analisis_id": fila.tipo_analisis_id,
            "tipo_analisis_nombre": tipos.get(fila.tipo_analisis_id, ""),
            "estado": fila.estado,
            "fecha_creacion": fila.fecha_creacion,
            "fecha_modificacion": fila.fecha_modificacion,
        }
        for fila in indicaciones
    ]


def serializar_una(db: Session, indicacion: IndicacionMedica) -> dict[str, object]:
    """Shape a single row (a list of one keeps the resolution in one place)."""
    return serializar(db, [indicacion])[0]
