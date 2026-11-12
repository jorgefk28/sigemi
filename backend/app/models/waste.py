"""Waste models: categoria_residuo, instruccion_almacenamiento, residuo_quimico,
disposicion_final, reporte_residuos, reporte_inventario.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section «Gestión de Residuos».
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import EstadoActivo


class CategoriaResiduo(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "categoria_residuo"

    nombre: Mapped[str] = mapped_column(nullable=False)
    clase_peligrosidad: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoActivo.ACTIVO.value
    )

    __table_args__ = (UniqueConstraint("nombre", name="uq_categoria_residuo_nombre"),)


class InstruccionAlmacenamiento(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "instruccion_almacenamiento"

    categoria_residuo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categoria_residuo.id"), nullable=False
    )
    paso: Mapped[int] = mapped_column(nullable=False)
    # Level 3 defines this column type as text (long form instructions).
    instruccion: Mapped[str] = mapped_column(Text(), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "categoria_residuo_id",
            "paso",
            name="uq_instruccion_almacenamiento_categoria_residuo_id_paso",
        ),
        Index(
            "ix_instruccion_almacenamiento_categoria_residuo_id", "categoria_residuo_id"
        ),
    )


class DisposicionFinal(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "disposicion_final"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    metodo_tratamiento: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)


class ResiduoQuimico(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "residuo_quimico"

    categoria_residuo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categoria_residuo.id"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    analisis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=True
    )
    disposicion_final_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("disposicion_final.id"), nullable=True
    )
    fecha_hora: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    volumen: Mapped[Decimal | None] = mapped_column(nullable=True)
    peso: Mapped[Decimal | None] = mapped_column(nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)

    __table_args__ = (
        Index("ix_residuo_quimico_fecha_hora", "fecha_hora"),
        Index("ix_residuo_quimico_categoria_residuo_id", "categoria_residuo_id"),
    )


class ReporteResiduos(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reporte_residuos"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    # Format: 'YYYY-MM'
    mes_anio: Mapped[str] = mapped_column(nullable=False)
    rango_fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    rango_fecha_fin: Mapped[date] = mapped_column(nullable=False)
    ruta_archivo: Mapped[str] = mapped_column(nullable=False)
    fecha_generacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)


class ReporteInventario(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reporte_inventario"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    rango_fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    rango_fecha_fin: Mapped[date] = mapped_column(nullable=False)
    ruta_archivo: Mapped[str] = mapped_column(nullable=False)
    fecha_generacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
