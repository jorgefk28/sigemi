"""Tests for the authentication API: login and current-user profile."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.base import utcnow
from app.models.audit import Auditoria

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
ME_URL = f"{settings.api_v1_prefix}/auth/me"


def _login(client, correo: str, contrasena: str):
    return client.post(
        LOGIN_URL,
        data={"username": correo, "password": contrasena},
    )


# ---------------------------------------------------------------------------
# 1. Successful login: 200, bearer token, sub and roles decode correctly
# ---------------------------------------------------------------------------


def test_login_success_returns_token(client, usuario_factory):
    usuario = usuario_factory(roles=("bioquimico",))

    response = _login(client, usuario.correo_electronico, "Secreta123")

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == settings.access_token_expire_minutes * 60

    decoded = decode_access_token(payload["access_token"])
    assert decoded.sub == str(usuario.id)
    assert decoded.roles == ["bioquimico"]


# ---------------------------------------------------------------------------
# 2. Wrong password: 401 and intentos_fallidos increments to 1
# ---------------------------------------------------------------------------


def test_login_wrong_password_increments_failed_attempts(
    client, db: Session, usuario_factory
):
    usuario = usuario_factory(roles=("bioquimico",))

    response = _login(client, usuario.correo_electronico, "WrongPass123")

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"
    db.refresh(usuario)
    assert usuario.intentos_fallidos == 1


# ---------------------------------------------------------------------------
# 3. Lock-out: after max attempts bloqueado_hasta is set and a correct
#    password is then rejected with 423
# ---------------------------------------------------------------------------


def test_login_locks_account_after_max_attempts(client, db: Session, usuario_factory):
    usuario = usuario_factory(roles=("bioquimico",))

    for _ in range(settings.login_max_failed_attempts):
        response = _login(client, usuario.correo_electronico, "WrongPass123")
        assert response.status_code == 401

    db.refresh(usuario)
    assert usuario.bloqueado_hasta is not None

    response = _login(client, usuario.correo_electronico, "Secreta123")
    assert response.status_code == 423
    assert response.json()["detail"] == "Usuario bloqueado temporalmente"


# ---------------------------------------------------------------------------
# 4. Unknown email: 401 (without revealing whether the email exists)
# ---------------------------------------------------------------------------


def test_login_unknown_email_returns_401(client, usuario_factory):
    usuario_factory(roles=("bioquimico",))

    response = _login(client, "nobody@sigemi.test", "Secreta123")

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"


# ---------------------------------------------------------------------------
# 5. Inactive user: 403
# ---------------------------------------------------------------------------


def test_login_inactive_user_returns_403(client, usuario_factory):
    usuario = usuario_factory(roles=("bioquimico",), estado="inactivo")

    response = _login(client, usuario.correo_electronico, "Secreta123")

    assert response.status_code == 403
    assert response.json()["detail"] == "Usuario inactivo"


# ---------------------------------------------------------------------------
# 6. Successful login resets failed attempts and clears an expired lock
# ---------------------------------------------------------------------------


def test_login_success_resets_failed_attempts_and_lock(
    client, db: Session, usuario_factory
):
    usuario = usuario_factory(roles=("bioquimico",))
    usuario.intentos_fallidos = 3
    usuario.bloqueado_hasta = utcnow() - timedelta(minutes=1)
    db.flush()

    response = _login(client, usuario.correo_electronico, "Secreta123")

    assert response.status_code == 200
    db.refresh(usuario)
    assert usuario.intentos_fallidos == 0
    assert usuario.bloqueado_hasta is None


# ---------------------------------------------------------------------------
# 7. /me with a valid token returns the user (roles == ["bioquimico"])
# ---------------------------------------------------------------------------


def test_me_returns_current_user(client, usuario_factory):
    usuario = usuario_factory(roles=("bioquimico",))
    token = _login(client, usuario.correo_electronico, "Secreta123").json()[
        "access_token"
    ]

    response = client.get(
        ME_URL,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(usuario.id)
    assert payload["correo_electronico"] == usuario.correo_electronico
    assert payload["roles"] == ["bioquimico"]


# ---------------------------------------------------------------------------
# 8. /me without a token: 401
# ---------------------------------------------------------------------------


def test_me_unauthorized_without_token(client):
    response = client.get(ME_URL)

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 9. Successful login writes exactly one Auditoria row (accion == "acceder")
# ---------------------------------------------------------------------------


def test_login_writes_single_audit_row(client, db: Session, usuario_factory):
    usuario = usuario_factory(roles=("bioquimico",))

    response = _login(client, usuario.correo_electronico, "Secreta123")

    assert response.status_code == 200
    auditorias = db.query(Auditoria).filter_by(entidad_id=usuario.id).all()
    assert len(auditorias) == 1
    assert auditorias[0].accion == "acceder"
    assert auditorias[0].usuario_id == usuario.id
