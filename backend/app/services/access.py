"""Access-control queries shared by the API layer and the services."""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence

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


def roles_por_usuario(
    db: Session, usuario_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    """Return the role codes of every user in *usuario_ids* in one query.

    Listings serialize a page of users at a time; a per-user query would make the
    number of round trips grow with the page size.
    """

    ids = list(usuario_ids)
    if not ids:
        return {}

    statement = (
        select(UsuarioRol.usuario_id, Rol.codigo)
        .join(Rol, Rol.id == UsuarioRol.rol_id)
        .where(UsuarioRol.usuario_id.in_(ids))
        .order_by(UsuarioRol.usuario_id, Rol.codigo)
    )
    agrupado: dict[uuid.UUID, list[str]] = {usuario_id: [] for usuario_id in ids}
    for usuario_id, codigo in db.execute(statement).all():
        agrupado[usuario_id].append(codigo)
    return agrupado


def serializar_usuarios(
    db: Session, usuarios: Sequence[Usuario] | Iterable[Usuario]
) -> list[UsuarioRead]:
    """Build the API representation of several users."""

    usuarios = list(usuarios)
    roles = roles_por_usuario(db, [usuario.id for usuario in usuarios])
    return [
        UsuarioRead(
            id=usuario.id,
            nombre=usuario.nombre,
            apellido=usuario.apellido,
            correo_electronico=usuario.correo_electronico,
            estado=usuario.estado,
            roles=roles.get(usuario.id, []),
        )
        for usuario in usuarios
    ]


def serializar_usuario(db: Session, usuario: Usuario) -> UsuarioRead:
    """Build the API representation of a user."""

    return serializar_usuarios(db, [usuario])[0]
