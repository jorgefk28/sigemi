"""Access-control queries shared by the API layer and the services."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access import Rol, Usuario, UsuarioRol
from app.schemas.access import UsuarioRead


def roles_de_usuario(db: Session, usuario_id: uuid.UUID) -> list[str]:
    """Return the role codes a user holds, sorted for stable output."""

    statement = (
        select(Rol.codigo)
        .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
        .where(UsuarioRol.usuario_id == usuario_id)
        .order_by(Rol.codigo)
    )
    return list(db.scalars(statement).all())


def serializar_usuario(db: Session, usuario: Usuario) -> UsuarioRead:
    """Build the API representation of a user."""

    return UsuarioRead(
        id=usuario.id,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        correo_electronico=usuario.correo_electronico,
        estado=usuario.estado,
        roles=roles_de_usuario(db, usuario.id),
    )
