"""Generic transversal report model: reporte (REP-01).

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section «Reportes (Transversal)».

Note: ``reporte_residuos`` and ``reporte_inventario`` are specialized tables that
live in ``waste.py``; they are NOT merged into this table (level 3 decision — S6).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow


class Reporte(UUIDPrimaryKeyMixin, Base):
    """Generic report table covering all report types (REP-01)."""

    __tablename__ = "reporte"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    tipo_reporte: Mapped[str] = mapped_column(nullable=False)
    rango_fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    rango_fecha_fin: Mapped[date] = mapped_column(nullable=False)
    ruta_archivo: Mapped[str] = mapped_column(nullable=False)
    formato_archivo: Mapped[str] = mapped_column(nullable=False)
    fecha_generacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    # Format: 'YYYY-MM' — only populated for monthly reports.
    mes_anio: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_reporte_usuario_id", "usuario_id"),
        Index("ix_reporte_fecha_generacion", "fecha_generacion"),
    )
