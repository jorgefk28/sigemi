"""Equipment models: tipo_equipo, equipo, mantenimiento_equipo.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section «Gestión de Equipos».
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import EquipoEstado


class TipoEquipo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "tipo_equipo"

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    criticidad: Mapped[str] = mapped_column(nullable=False)

    __table_args__ = (UniqueConstraint("nombre", name="uq_tipo_equipo_nombre"),)


class Equipo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "equipo"

    tipo_equipo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_equipo.id"), nullable=False
    )
    # numero_serie is indexed but NOT unique: the supplier does not always guarantee
    # uniqueness across different equipment types (level 3 decision).
    numero_serie: Mapped[str] = mapped_column(nullable=False)
    nombre: Mapped[str] = mapped_column(nullable=False)
    marca: Mapped[str | None] = mapped_column(nullable=True)
    proveedor: Mapped[str | None] = mapped_column(nullable=True)
    fecha_adquisicion: Mapped[date | None] = mapped_column(nullable=True)
    garantia_inicio: Mapped[date | None] = mapped_column(nullable=True)
    garantia_fin: Mapped[date | None] = mapped_column(nullable=True)
    ubicacion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ubicacion_almacenamiento.id"), nullable=False
    )
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EquipoEstado.OPERATIVO.value
    )
    requisitos_uso: Mapped[str | None] = mapped_column(Text(), nullable=True)

    __table_args__ = (
        Index("ix_equipo_tipo_equipo_id", "tipo_equipo_id"),
        Index("ix_equipo_ubicacion_id", "ubicacion_id"),
        Index("ix_equipo_numero_serie", "numero_serie"),
    )


class MantenimientoEquipo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "mantenimiento_equipo"

    equipo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("equipo.id"), nullable=False
    )
    prestador: Mapped[str] = mapped_column(nullable=False)
    tipo_mantenimiento: Mapped[str] = mapped_column(nullable=False)
    fecha: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    proximo_mantenimiento: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_mantenimiento_equipo_equipo_id_fecha", "equipo_id", "fecha"),
    )
