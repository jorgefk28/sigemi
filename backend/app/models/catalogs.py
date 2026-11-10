"""Analysis type and sample type catalog models.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``,
section "Catálogos de Análisis" (tables: tipo_analisis, tipo_muestra,
tipo_analisis_tipo_muestra).
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import EstadoActivo


class TipoAnalisis(UUIDPrimaryKeyMixin, Base):
    """Catalog of analysis types available in the laboratory."""

    __tablename__ = "tipo_analisis"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_tipo_analisis_nombre"),
    )

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class TipoMuestra(UUIDPrimaryKeyMixin, Base):
    """Catalog of sample types accepted by the laboratory."""

    __tablename__ = "tipo_muestra"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_tipo_muestra_nombre"),
    )

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class TipoAnalisisTipoMuestra(UUIDPrimaryKeyMixin, Base):
    """Association table: which sample types are valid for each analysis type."""

    __tablename__ = "tipo_analisis_tipo_muestra"
    __table_args__ = (
        UniqueConstraint(
            "tipo_analisis_id",
            "tipo_muestra_id",
            name="uq_tipo_analisis_tipo_muestra_tipo_analisis_id_tipo_muestra_id",
        ),
        Index("ix_tipo_analisis_tipo_muestra_tipo_analisis_id", "tipo_analisis_id"),
        Index("ix_tipo_analisis_tipo_muestra_tipo_muestra_id", "tipo_muestra_id"),
    )

    tipo_analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_analisis.id"), nullable=False
    )
    tipo_muestra_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_muestra.id"), nullable=False
    )


__all__ = [
    "TipoAnalisis",
    "TipoAnalisisTipoMuestra",
    "TipoMuestra",
]
