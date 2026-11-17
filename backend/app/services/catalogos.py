"""Business rules for the clinical catalogs (UCE-DIAG-10, RF-16).

Two rules are shared by both catalogs and live here, once: the name is trimmed
and cannot be blank, and it is unique inside its catalog. The uniqueness check
runs before the flush and the ``IntegrityError`` is translated on top, so a race
answers the same ``400`` + ``campo`` instead of a ``500``.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.services.usuarios import ReglaDeUsuario, normalizar_texto

#: Field-scoped rejections answer ``400`` with this key (``AGENTS.md``).
CAMPO_NOMBRE = "nombre"


def normalizar_nombre(valor: str) -> str:
    """Trim the name and reject a blank one."""
    return normalizar_texto(CAMPO_NOMBRE, "El nombre", valor)


def limpiar_descripcion(valor: str | None) -> str | None:
    """Trim an optional description; a blank input is stored as absent."""
    if valor is None:
        return None
    normalizado = valor.strip()
    return normalizado or None


def nombre_en_uso[CatalogoT: (TipoAnalisis, TipoMuestra)](
    db: Session,
    modelo: type[CatalogoT],
    nombre: str,
    excluir: uuid.UUID | None = None,
) -> bool:
    """Whether *nombre* already exists in that catalog, ignoring *excluir*.

    The comparison is case-insensitive on purpose: ``Cultivo de uñas`` and
    ``cultivo de uñas`` are the same type for a user, and level 3 declares the
    column ``unique`` — the application keeps that promise from being a
    surprise at flush time.
    """
    statement = select(modelo.id).where(modelo.nombre.ilike(nombre))
    if excluir is not None:
        statement = statement.where(modelo.id != excluir)
    return db.scalar(statement) is not None


def rechazo_nombre_duplicado(nombre: str) -> ReglaDeUsuario:
    """The ``400`` a duplicated name answers."""
    return ReglaDeUsuario(f"Ya existe un tipo con el nombre «{nombre}»", CAMPO_NOMBRE)


def rechazo_carrera_de_unicidad() -> ReglaDeUsuario:
    """The same rejection for a uniqueness race lost at flush time."""
    return ReglaDeUsuario("Ya existe un tipo con ese nombre", CAMPO_NOMBRE)
