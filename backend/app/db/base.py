"""Declarative base and shared column building blocks.

Conventions fixed by `Diagramas/modelo_esquema_bd_sigemi.md` (level 3):

- Primary keys are ``UUID`` generated in the application (never in the server).
- Timestamps are stored in UTC (timezone-aware columns).
- State columns are ``VARCHAR`` bounded by the application (see
  ``app.models.enums``), not native ``ENUM`` types.

The ``type_annotation_map`` lets every model declare plain Python types
(``uuid.UUID``, ``datetime``, ``date``, ``time``, ``Decimal``, ``str``, ``int``,
``bool``) and get the correct PostgreSQL type automatically.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

from sqlalchemy import DateTime, MetaData
from sqlalchemy import Date as SADate
from sqlalchemy import Time as SATime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import Boolean, Integer, Numeric, String

# Deterministic constraint names keep Alembic diffs stable across environments.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""

    return datetime.now(UTC)


class Base(DeclarativeBase):
    """Declarative base for every SIGEMI ORM model."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    type_annotation_map = {
        uuid.UUID: PG_UUID(as_uuid=True),
        datetime: DateTime(timezone=True),
        date: SADate(),
        time: SATime(),
        Decimal: Numeric(),
        str: String(),
        int: Integer(),
        bool: Boolean(),
    }


class UUIDPrimaryKeyMixin:
    """Adds the application-generated ``uuid`` primary key."""

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """Adds ``fecha_creacion`` / ``fecha_modificacion`` columns.

    Only used by tables whose level-3 definition declares those exact columns.
    Tables with a different timestamp naming keep their own columns.
    """

    fecha_creacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    fecha_modificacion: Mapped[datetime] = mapped_column(
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


__all__ = [
    "Base",
    "NAMING_CONVENTION",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "utcnow",
]
