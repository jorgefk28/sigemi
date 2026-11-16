"""Authentication endpoints: login, current-user profile and password change."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    token_expires_in_seconds,
    verify_password,
)
from app.db.base import utcnow
from app.db.session import get_db
from app.models.access import Usuario
from app.models.enums import AccionAuditoria, EstadoActivo
from app.schemas.access import UsuarioRead
from app.schemas.auth import CambioContrasena, Token
from app.services.access import roles_de_usuario, serializar_usuario
from app.services.audit import registrar_auditoria
from app.services.usuarios import ReglaDeUsuario, validar_contrasena

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate by email + password and issue a JWT access token."""
    correo = form.username.strip().lower()

    usuario = db.scalar(
        select(Usuario).where(func.lower(Usuario.correo_electronico) == correo)
    )

    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if usuario.estado != EstadoActivo.ACTIVO.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    if usuario.bloqueado_hasta is not None and usuario.bloqueado_hasta > utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Usuario bloqueado temporalmente",
        )

    if not verify_password(form.password, usuario.contrasena_hash):
        usuario.intentos_fallidos += 1
        if usuario.intentos_fallidos >= settings.login_max_failed_attempts:
            usuario.bloqueado_hasta = utcnow() + timedelta(
                minutes=settings.login_lock_minutes
            )
            registrar_auditoria(
                db,
                usuario_id=usuario.id,
                modulo="seguridad",
                accion=AccionAuditoria.BLOQUEAR,
                entidad_afectada="usuario",
                entidad_id=usuario.id,
                direccion_ip=client_ip(request),
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    access_token = create_access_token(usuario.id, roles_de_usuario(db, usuario.id))
    registrar_auditoria(
        db,
        usuario_id=usuario.id,
        modulo="seguridad",
        accion=AccionAuditoria.ACCEDER,
        entidad_afectada="usuario",
        entidad_id=usuario.id,
        direccion_ip=client_ip(request),
    )
    db.commit()

    return Token(access_token=access_token, expires_in=token_expires_in_seconds())


@router.get("/me", response_model=UsuarioRead)
def me(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UsuarioRead:
    """Return the authenticated user's profile."""
    return serializar_usuario(db, usuario)


def _rechazo_campo(regla: ReglaDeUsuario) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_contrasena(
    request: Request,
    datos: CambioContrasena,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Change the authenticated user's password (UCE-SEG-08, pasos 4-8).

    Field rejections are ``400`` with ``campo`` — a wrong current password is
    field validation over a valid session, not an authentication failure, so
    it never emits the OAuth2 challenge.
    """
    try:
        if not verify_password(datos.contrasena_actual, usuario.contrasena_hash):
            raise ReglaDeUsuario(
                "La contraseña actual es incorrecta", "contrasena_actual"
            )
        validar_contrasena(datos.contrasena_nueva, campo="contrasena_nueva")
    except ReglaDeUsuario as regla:
        return _rechazo_campo(regla)

    usuario.contrasena_hash = hash_password(datos.contrasena_nueva)
    registrar_auditoria(
        db,
        usuario_id=usuario.id,
        modulo="seguridad",
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada="usuario",
        entidad_id=usuario.id,
        direccion_ip=client_ip(request),
        # The field name documents what changed; the invariant forbids storing
        # the hash, so both values stay ``None`` (``AGENTS.md``, "Security
        # invariants").
        cambios=[("contrasena_hash", None, None)],
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
