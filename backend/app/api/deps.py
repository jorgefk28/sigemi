"""Shared API dependencies: OAuth2 bearer scheme and current-user resolution.

These dependencies are reused by every protected endpoint across the five
subsystems, so their contracts (status codes, ``detail`` messages, and the
``WWW-Authenticate`` header) are fixed here in one place.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.models.access import Usuario
from app.models.enums import EstadoActivo
from app.services.access import roles_de_usuario

OAUTH_TOKEN_URL = f"{settings.api_v1_prefix}/auth/login"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=OAUTH_TOKEN_URL)


def _unauthorized() -> HTTPException:
    """Build the 401 response shared by every authentication failure."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> Usuario:
    """Decode the bearer token and return the matching active user.

    Raises 401 for a missing/invalid token, an invalid ``sub`` UUID, or an
    unknown user; raises 403 for an inactive user.
    """
    try:
        payload = decode_access_token(token)
    except InvalidTokenError:
        raise _unauthorized() from None

    try:
        usuario_id = uuid.UUID(payload.sub)
    except (ValueError, TypeError):
        raise _unauthorized() from None

    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise _unauthorized()

    if usuario.estado != EstadoActivo.ACTIVO.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    return usuario


def require_roles(*codigos: str) -> Callable[..., Usuario]:
    """Return a dependency requiring the user to hold at least one of *codigos*.

    The returned dependency loads the current user's role codes through
    ``roles_de_usuario`` and raises 403 when the intersection with *codigos*
    is empty.
    """

    def _dependency(
        usuario: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Usuario:
        actuales = set(roles_de_usuario(db, usuario.id))
        if actuales.isdisjoint(codigos):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return usuario

    return _dependency
