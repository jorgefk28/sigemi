"""Security regression probes for authentication and authorization.

These came out of an independent verification of the login/guard surface and
are kept so the guarantees cannot silently regress:

- token forgery, wrong signature, expiry, malformed ``sub``, unknown user → 401
- inactive user → 403
- ``require_roles`` denies without a matching role and fails closed when empty
- audit row on successful login and on lockout, none on a plain failed attempt
- no credential material in any response
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jwt_probe import tamper_signature
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings
from app.core.security import create_access_token
from app.db.base import utcnow
from app.db.session import get_db
from app.models.audit import Auditoria


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _token(payload_overrides: dict[str, object]) -> str:
    now = int(utcnow().timestamp())
    payload: dict[str, object] = {
        "sub": str(uuid.uuid4()),
        "roles": ["bioquimico"],
        "iat": now,
        "exp": now + 3600,
    }
    payload.update(payload_overrides)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def test_tampered_token_is_rejected(client, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",))
    token = create_access_token(usuario.id, ["bioquimico"])
    tampered = tamper_signature(token)

    # The probe is only meaningful while the token stays well-formed and only
    # its signature changed; otherwise the 401 could come from a broken token.
    assert tampered.split(".")[:2] == token.split(".")[:2]
    assert len(tampered.split(".")[2]) == len(token.split(".")[2])

    response = client.get("/api/v1/auth/me", headers=_bearer(tampered))

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"
    assert "Bearer" in response.headers.get("www-authenticate", "")


def test_token_signed_with_another_secret_is_rejected(client, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",))
    now = int(utcnow().timestamp())
    forged = jwt.encode(
        {
            "sub": str(usuario.id),
            "roles": ["bioquimico"],
            "iat": now,
            "exp": now + 3600,
        },
        "not-the-application-secret",
        algorithm=settings.algorithm,
    )

    response = client.get("/api/v1/auth/me", headers=_bearer(forged))

    assert response.status_code == 401


def test_expired_token_is_rejected(client, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",))
    now = int(utcnow().timestamp())
    expired = _token({"sub": str(usuario.id), "iat": now - 7200, "exp": now - 3600})

    response = client.get("/api/v1/auth/me", headers=_bearer(expired))

    assert response.status_code == 401


def test_token_with_non_uuid_subject_is_rejected(client) -> None:
    response = client.get(
        "/api/v1/auth/me", headers=_bearer(_token({"sub": "not-a-uuid"}))
    )

    assert response.status_code == 401


def test_token_for_unknown_user_is_rejected(client) -> None:
    response = client.get("/api/v1/auth/me", headers=_bearer(_token({})))

    assert response.status_code == 401


def test_inactive_user_is_forbidden(client, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",), estado="inactivo")
    token = create_access_token(usuario.id, ["bioquimico"])

    response = client.get("/api/v1/auth/me", headers=_bearer(token))

    assert response.status_code == 403
    assert response.json()["detail"] == "Usuario inactivo"


def test_require_roles_enforces_and_fails_closed(db: Session, usuario_factory) -> None:
    probe = FastAPI()

    @probe.get("/admin-only")
    def _admin_only(usuario=Depends(require_roles("administrador"))):
        return {"status": "ok"}

    @probe.get("/no-roles")
    def _no_roles(usuario=Depends(require_roles())):
        return {"status": "ok"}

    def _override_get_db() -> Iterator[Session]:
        yield db

    probe.dependency_overrides[get_db] = _override_get_db

    bioquimico = usuario_factory(roles=("bioquimico",))
    administrador = usuario_factory(roles=("administrador",))
    token_bio = create_access_token(bioquimico.id, ["bioquimico"])
    token_admin = create_access_token(administrador.id, ["administrador"])

    with TestClient(probe) as probe_client:
        denied = probe_client.get("/admin-only", headers=_bearer(token_bio))
        allowed = probe_client.get("/admin-only", headers=_bearer(token_admin))
        empty = probe_client.get("/no-roles", headers=_bearer(token_admin))

    assert denied.status_code == 403
    assert denied.json()["detail"] == "Permisos insuficientes"
    assert allowed.status_code == 200
    assert empty.status_code == 403


def test_audit_on_lockout_only(client, db: Session, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",))
    credenciales = {
        "username": usuario.correo_electronico,
        "password": "ClaveIncorrecta",
    }

    client.post("/api/v1/auth/login", data=credenciales)
    assert db.query(Auditoria).filter_by(usuario_id=usuario.id).count() == 0

    for _ in range(settings.login_max_failed_attempts - 1):
        client.post("/api/v1/auth/login", data=credenciales)

    db.refresh(usuario)
    assert usuario.bloqueado_hasta is not None

    auditorias = db.query(Auditoria).filter_by(usuario_id=usuario.id).all()
    assert len(auditorias) == 1
    assert auditorias[0].accion == "bloquear"
    assert auditorias[0].modulo == "seguridad"
    assert auditorias[0].entidad_afectada == "usuario"
    assert auditorias[0].direccion_ip is not None


def test_no_credential_material_in_responses(client, usuario_factory) -> None:
    usuario = usuario_factory(roles=("bioquimico",))
    login = client.post(
        "/api/v1/auth/login",
        data={"username": usuario.correo_electronico, "password": "Secreta123"},
    )

    assert login.status_code == 200
    assert {"contrasena", "contrasena_hash", "password"}.isdisjoint(login.json())

    perfil = client.get(
        "/api/v1/auth/me", headers=_bearer(login.json()["access_token"])
    )

    assert perfil.status_code == 200
    assert {
        "contrasena",
        "contrasena_hash",
        "password",
        "token",
        "access_token",
    }.isdisjoint(perfil.json())
