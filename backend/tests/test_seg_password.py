"""Tests for the password-change endpoint (UCE-SEG-08, T8 parte 1).

The endpoint lives in ``app/api/v1/auth.py`` and reuses the S6 strength rule
from ``app/services/usuarios.py::validar_contrasena``; the current-password
check is a field rejection over a valid session, never an authentication
failure.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit import Auditoria, CambioAuditoria

PASSWORD_URL = f"{settings.api_v1_prefix}/auth/password"
LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"

CONTRASENA_ACTUAL = "Secreta123"
CONTRASENA_NUEVA = "NuevaClave456"


def _login(client, correo: str, contrasena: str):
    return client.post(
        LOGIN_URL,
        data={"username": correo, "password": contrasena},
    )


def _token(client, correo: str, contrasena: str) -> str:
    return _login(client, correo, contrasena).json()["access_token"]


def _cambiar(client, token: str, contrasena_actual: str, contrasena_nueva: str):
    return client.post(
        PASSWORD_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={
            "contrasena_actual": contrasena_actual,
            "contrasena_nueva": contrasena_nueva,
        },
    )


# ---------------------------------------------------------------------------
# 1. Happy path: 204 with no body; the new password works, the old one does not
# ---------------------------------------------------------------------------


def test_cambio_ok_devuelve_204_y_actualiza_el_hash(client, usuario_factory):
    usuario = usuario_factory(contrasena=CONTRASENA_ACTUAL)
    token = _token(client, usuario.correo_electronico, CONTRASENA_ACTUAL)

    response = _cambiar(client, token, CONTRASENA_ACTUAL, CONTRASENA_NUEVA)

    assert response.status_code == 204
    assert response.content == b""
    assert (
        _login(client, usuario.correo_electronico, CONTRASENA_NUEVA).status_code == 200
    )
    assert (
        _login(client, usuario.correo_electronico, CONTRASENA_ACTUAL).status_code == 401
    )


# ---------------------------------------------------------------------------
# 2. Wrong current password: 400 with campo and an intact hash
# ---------------------------------------------------------------------------


def test_cambio_con_actual_incorrecta_responde_400_y_conserva_hash(
    client, db: Session, usuario_factory
):
    usuario = usuario_factory(contrasena=CONTRASENA_ACTUAL)
    hash_original = usuario.contrasena_hash
    token = _token(client, usuario.correo_electronico, CONTRASENA_ACTUAL)

    response = _cambiar(client, token, "Incorrecta999", CONTRASENA_NUEVA)

    assert response.status_code == 400
    assert response.json() == {
        "detail": "La contraseña actual es incorrecta",
        "campo": "contrasena_actual",
    }
    db.refresh(usuario)
    assert usuario.contrasena_hash == hash_original
    assert (
        _login(client, usuario.correo_electronico, CONTRASENA_ACTUAL).status_code == 200
    )


# ---------------------------------------------------------------------------
# 3. Each S6 rule on the new password: 400 with campo=contrasena_nueva
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("contrasena_nueva", "regla_esperada"),
    [
        pytest.param("Corta1", "al menos 8 caracteres", id="menos_de_8_caracteres"),
        pytest.param(
            "Á" * 37, "no puede superar los 72 bytes", id="mas_de_72_bytes_utf8"
        ),
        pytest.param("SolamenteLetras", "al menos un dígito", id="sin_digito"),
        pytest.param("12345678", "al menos una letra", id="sin_letra"),
    ],
)
def test_cambio_con_nueva_debil_responde_400_con_campo(
    client,
    db: Session,
    usuario_factory,
    contrasena_nueva: str,
    regla_esperada: str,
):
    usuario = usuario_factory(contrasena=CONTRASENA_ACTUAL)
    hash_original = usuario.contrasena_hash
    token = _token(client, usuario.correo_electronico, CONTRASENA_ACTUAL)

    response = _cambiar(client, token, CONTRASENA_ACTUAL, contrasena_nueva)

    assert response.status_code == 400
    body = response.json()
    assert body["campo"] == "contrasena_nueva"
    assert regla_esperada in body["detail"]
    db.refresh(usuario)
    assert usuario.contrasena_hash == hash_original


# ---------------------------------------------------------------------------
# 4. Audit: one modificar row with a contrasena_hash change whose values are
#    NULL, and no hash value stored anywhere in the audit trail
# ---------------------------------------------------------------------------


def test_cambio_audita_modificar_y_nunca_guarda_el_hash(
    client, db: Session, usuario_factory
):
    usuario = usuario_factory(contrasena=CONTRASENA_ACTUAL)
    token = _token(client, usuario.correo_electronico, CONTRASENA_ACTUAL)

    response = _cambiar(client, token, CONTRASENA_ACTUAL, CONTRASENA_NUEVA)

    assert response.status_code == 204
    filas = (
        db.query(Auditoria).filter_by(entidad_id=usuario.id, accion="modificar").all()
    )
    assert len(filas) == 1
    assert filas[0].usuario_id == usuario.id
    assert filas[0].modulo == "seguridad"
    assert filas[0].entidad_afectada == "usuario"

    cambios = db.query(CambioAuditoria).filter_by(auditoria_id=filas[0].id).all()
    assert len(cambios) == 1
    assert cambios[0].campo == "contrasena_hash"
    assert cambios[0].valor_anterior is None
    assert cambios[0].valor_nuevo is None

    hash_actual = usuario.contrasena_hash
    valores_auditados = [
        valor
        for cambio in db.query(CambioAuditoria).all()
        for valor in (cambio.valor_anterior, cambio.valor_nuevo)
        if valor is not None
    ]
    assert hash_actual not in valores_auditados


# ---------------------------------------------------------------------------
# 5. No session: 401 with the WWW-Authenticate challenge, from deps
# ---------------------------------------------------------------------------


def test_cambio_sin_sesion_responde_401_con_desafio(client):
    response = client.post(
        PASSWORD_URL,
        json={
            "contrasena_actual": CONTRASENA_ACTUAL,
            "contrasena_nueva": CONTRASENA_NUEVA,
        },
    )

    assert response.status_code == 401
    assert "Bearer" in response.headers.get("www-authenticate", "")
