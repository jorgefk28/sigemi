"""Audit models: auditoria, cambio_auditoria.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section «Auditoría».
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow


class Auditoria(UUIDPrimaryKeyMixin, Base):
    """Append-only audit log — rows are never updated or deleted."""

    __tablename__ = "auditoria"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_hora: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    direccion_ip: Mapped[str | None] = mapped_column(nullable=True)
    modulo: Mapped[str] = mapped_column(nullable=False)
    accion: Mapped[str] = mapped_column(nullable=False)
    entidad_afectada: Mapped[str] = mapped_column(nullable=False)
    # entidad_id has NO ForeignKey constraint: it is polymorphic (can reference any
    # table). Referential integrity is enforced at the application layer, not the DB.
    entidad_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    __table_args__ = (
        Index("ix_auditoria_fecha_hora", "fecha_hora"),
        Index("ix_auditoria_entidad_afectada_entidad_id", "entidad_afectada", "entidad_id"),
        Index("ix_auditoria_usuario_id", "usuario_id"),
    )


class CambioAuditoria(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "cambio_auditoria"

    auditoria_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auditoria.id"), nullable=False
    )
    campo: Mapped[str] = mapped_column(nullable=False)
    valor_anterior: Mapped[str | None] = mapped_column(nullable=True)
    valor_nuevo: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_cambio_auditoria_auditoria_id", "auditoria_id"),
    )
