"""User administration rules (UCE-SEG-02, UCE-SEG-08).

The rules live outside the HTTP layer so the endpoints stay thin and the same
checks can be reused by the password-change flow (UCE-SEG-08).

Every rejection carries a Spanish, user-facing ``detail`` and, when the message
belongs to a request field, the ``campo`` it should be attached to
(``AGENTS.md``, "Response contract").
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.access import Rol, UsuarioRol
from app.models.enums import EstadoActivo

#: S6: declared assumption, decided by the repository owner on 2026-11-11.
MIN_PASSWORD_CHARS = 8
#: bcrypt hashes at most 72 bytes; the ceiling is enforced in UTF-8 bytes.
MAX_PASSWORD_BYTES = 72


class ReglaDeUsuario(Exception):
    """A rejected operation with a Spanish, user-facing message."""

    def __init__(self, detail: str, campo: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.campo = campo


def validar_contrasena(contrasena: str) -> None:
    """Enforce the strength rule declared in S6.

    Checks run in a fixed order so the reported rule is deterministic: minimum
    length, UTF-8 byte ceiling, at least one letter, at least one digit.
    """
    if len(contrasena) < MIN_PASSWORD_CHARS:
        raise ReglaDeUsuario(
            f"La contraseña debe tener al menos {MIN_PASSWORD_CHARS} caracteres",
            "contrasena",
        )

    if len(contrasena.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ReglaDeUsuario(
            f"La contraseña no puede superar los {MAX_PASSWORD_BYTES} bytes",
            "contrasena",
        )

    if not any(caracter.isalpha() for caracter in contrasena):
        raise ReglaDeUsuario(
            "La contraseña debe incluir al menos una letra",
            "contrasena",
        )

    if not any(caracter.isdigit() for caracter in contrasena):
        raise ReglaDeUsuario(
            "La contraseña debe incluir al menos un dígito",
            "contrasena",
        )


def validar_estado(estado: str) -> None:
    """Reject any ``estado`` outside the closed ``activo``/``inactivo`` set."""
    if estado not in {EstadoActivo.ACTIVO.value, EstadoActivo.INACTIVO.value}:
        raise ReglaDeUsuario("El estado debe ser activo o inactivo", "estado")


def normalizar_texto(campo: str, etiqueta: str, valor: str) -> str:
    """Trim *valor* and reject a blank result."""
    normalizado = valor.strip()
    if not normalizado:
        raise ReglaDeUsuario(f"{etiqueta} no puede estar vacío", campo)
    return normalizado


def resolver_roles(db: Session, codigos: Iterable[str]) -> list[Rol]:
    """Return the catalog rows for *codigos*, rejecting unknown codes (S3).

    The catalog is read from the ``rol`` table (seeded by a data migration) so
    the closed set has one source of truth. The result is ordered by ``codigo``
    to keep every response and audit entry stable.
    """
    solicitados = sorted(
        {codigo.strip() for codigo in codigos if codigo and codigo.strip()}
    )
    if not solicitados:
        raise ReglaDeUsuario("Debe asignar al menos un rol al usuario", "roles")

    roles = list(db.scalars(select(Rol).where(Rol.codigo.in_(solicitados))).all())
    if len(roles) != len(solicitados):
        raise ReglaDeUsuario("El rol indicado no existe en el catálogo", "roles")

    return sorted(roles, key=lambda rol: rol.codigo)


def asignar_roles(db: Session, usuario_id: uuid.UUID, roles: Iterable[Rol]) -> None:
    """Replace the user's whole role set with *roles*."""
    db.execute(delete(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id))

    vistos: set[uuid.UUID] = set()
    for rol in roles:
        if rol.id in vistos:
            continue
        vistos.add(rol.id)
        db.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))

    db.flush()
