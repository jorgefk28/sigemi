"""Inventory models: categoria_insumo, ubicacion_almacenamiento, insumo, lote, movimiento_inventario.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section «Inventario de Insumos».
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import EstadoActivo, LoteEstado


class CategoriaInsumo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "categoria_insumo"

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)

    __table_args__ = (
        UniqueConstraint("nombre", name="uq_categoria_insumo_nombre"),
    )


class UbicacionAlmacenamiento(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ubicacion_almacenamiento"

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class Insumo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "insumo"

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    unidad_medida: Mapped[str] = mapped_column(nullable=False)
    categoria_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categoria_insumo.id"), nullable=False
    )
    ubicacion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ubicacion_almacenamiento.id"), nullable=False
    )
    umbral_minimo: Mapped[Decimal] = mapped_column(nullable=False)
    dias_alerta_vencimiento: Mapped[int] = mapped_column(nullable=False, default=30)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)
    fecha_creacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)

    # stock_actual is intentionally NOT a column.
    # Stock is derived at query time as SUM(lote.cantidad_actual) filtered by insumo_id
    # (level 3 decision, section «Inventario de Insumos» — see S6 in the ODD task).

    __table_args__ = (
        Index("ix_insumo_categoria_id", "categoria_id"),
        Index("ix_insumo_umbral_minimo", "umbral_minimo"),
    )


class Lote(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "lote"

    insumo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("insumo.id"), nullable=False
    )
    numero_lote: Mapped[str] = mapped_column(nullable=False)
    fecha_ingreso: Mapped[date] = mapped_column(nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(nullable=False)
    cantidad_inicial: Mapped[Decimal] = mapped_column(nullable=False)
    cantidad_actual: Mapped[Decimal] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(nullable=False, default=LoteEstado.ACTIVO.value)

    __table_args__ = (
        Index("ix_lote_insumo_id", "insumo_id"),
        Index("ix_lote_fecha_vencimiento", "fecha_vencimiento"),
    )


class MovimientoInventario(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "movimiento_inventario"

    lote_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lote.id"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    ubicacion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ubicacion_almacenamiento.id"), nullable=False
    )
    analisis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=True
    )
    # Self-referential FK: points to the original movement this entry reverses.
    devolucion_referencia_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("movimiento_inventario.id"), nullable=True
    )
    tipo_movimiento: Mapped[str] = mapped_column(nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(nullable=False)
    practica_educativa: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, default=False
    )
    fecha: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)

    __table_args__ = (
        Index("ix_movimiento_inventario_lote_id", "lote_id"),
        Index("ix_movimiento_inventario_fecha", "fecha"),
    )
