"""ORM models for user access and professional identity.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, section
"Área: Acceso y personas" (level 3).

Tables: ``usuario``, ``rol``, ``usuario_rol``, ``profesional``.

``rol.codigo`` is the closed catalog ``RolCodigo`` defined in
``app.models.enums``; the allowed values are ``bioquimico``,
``profesor``, and ``administrador``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import EstadoActivo


class Usuario(UUIDPrimaryKeyMixin, Base):
    """Application user (any role)."""

    __tablename__ = "usuario"

    nombre: Mapped[str] = mapped_column(nullable=False)
    apellido: Mapped[str] = mapped_column(nullable=False)
    correo_electronico: Mapped[str] = mapped_column(nullable=False)
    contrasena_hash: Mapped[str] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoActivo.ACTIVO.value
    )
    intentos_fallidos: Mapped[int] = mapped_column(nullable=False, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(nullable=True)
    fecha_registro: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)

    __table_args__ = (
        UniqueConstraint("correo_electronico", name="uq_usuario_correo_electronico"),
    )


class Rol(UUIDPrimaryKeyMixin, Base):
    """Role catalog. ``codigo`` is bounded by ``RolCodigo``.

    Allowed values: ``bioquimico``, ``profesor``, ``administrador``.
    """

    __tablename__ = "rol"

    codigo: Mapped[str] = mapped_column(nullable=False)
    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (UniqueConstraint("codigo", name="uq_rol_codigo"),)


class UsuarioRol(UUIDPrimaryKeyMixin, Base):
    """Many-to-many join between ``usuario`` and ``rol``."""

    __tablename__ = "usuario_rol"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    rol_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rol.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "usuario_id", "rol_id", name="uq_usuario_rol_usuario_id_rol_id"
        ),
        Index("ix_usuario_rol_rol_id", "rol_id"),
    )


class Profesional(UUIDPrimaryKeyMixin, Base):
    """Professional profile linked 1:1 to a ``usuario`` with role ``bioquimico``."""

    __tablename__ = "profesional"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    matricula: Mapped[str] = mapped_column(nullable=False)
    especialidad: Mapped[str | None] = mapped_column(nullable=True)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoActivo.ACTIVO.value
    )

    __table_args__ = (UniqueConstraint("usuario_id", name="uq_profesional_usuario_id"),)


__all__ = [
    "Profesional",
    "Rol",
    "Usuario",
    "UsuarioRol",
]
