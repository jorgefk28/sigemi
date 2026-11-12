"""Tests for user and role administration (UCE-SEG-02, RF-13 + RF-14).

Rules pinned here:

- only an ``administrador`` reaches the module;
- alta validates e-mail uniqueness, role existence and password strength (S6);
- ``baja`` is logical (``estado = inactivo``), never a physical delete;
- every alta, baja and modification writes exactly one audit record (RF-14).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.models.access import Usuario, UsuarioRol
from app.models.audit import Auditoria, CambioAuditoria

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
USUARIOS_URL = f"{settings.api_v1_prefix}/usuarios"
ROLES_URL = f"{settings.api_v1_prefix}/roles"


def _token(client: TestClient, correo: str, contrasena: str = "Secreta123") -> str:
    response = client.post(
        LOGIN_URL,
        data={"username": correo, "password": contrasena},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _admin_token(client: TestClient, usuario_factory) -> tuple[str, Usuario]:
    admin = usuario_factory(roles=("administrador",))
    return _token(client, admin.correo_electronico), admin


def _auditorias_of(db: Session, entidad_id) -> list[Auditoria]:
    return db.query(Auditoria).filter_by(entidad_id=entidad_id).all()


# ---------------------------------------------------------------------------
# Authorization: the whole module is administrador-only
# ---------------------------------------------------------------------------


def test_module_requires_administrador_role(client: TestClient, usuario_factory):
    bioquimico = usuario_factory(roles=("bioquimico",))
    token = _token(client, bioquimico.correo_electronico)
    cuerpo = {
        "nombre": "Ana",
        "apellido": "Perez",
        "correo_electronico": "ana@sigemi.test",
        "contrasena": "Secreta123",
        "roles": ["profesor"],
    }

    sin_token = client.get(USUARIOS_URL)
    otro_rol = client.post(USUARIOS_URL, json=cuerpo, headers=_headers(token))
    catalogo = client.get(ROLES_URL, headers=_headers(token))

    assert sin_token.status_code == 401
    assert otro_rol.status_code == 403
    assert otro_rol.json()["detail"] == "Permisos insuficientes"
    assert catalogo.status_code == 403


# ---------------------------------------------------------------------------
# Alta: persistence, hashed password, audit
# ---------------------------------------------------------------------------


def test_create_user_persists_hashed_account(
    client: TestClient, db: Session, usuario_factory
):
    token, admin = _admin_token(client, usuario_factory)

    response = client.post(
        USUARIOS_URL,
        json={
            "nombre": "Ana",
            "apellido": "Perez",
            "correo_electronico": "ANA@Sigma.test",
            "contrasena": "Secreta123",
            "roles": ["profesor"],
        },
        headers=_headers(token),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["estado"] == "activo"
    assert payload["roles"] == ["profesor"]
    assert "contrasena" not in payload
    assert "contrasena_hash" not in payload

    usuario = db.get(Usuario, payload["id"])
    assert usuario is not None
    assert usuario.correo_electronico == "ana@sigma.test"
    assert usuario.contrasena_hash != "Secreta123"
    assert verify_password("Secreta123", usuario.contrasena_hash)

    auditorias = _auditorias_of(db, usuario.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "crear"
    assert auditorias[0].modulo == "seguridad"
    assert auditorias[0].entidad_afectada == "usuario"
    assert auditorias[0].usuario_id == admin.id

    cambios = db.query(CambioAuditoria).filter_by(auditoria_id=auditorias[0].id).all()
    campos = {cambio.campo for cambio in cambios}
    assert {"correo_electronico", "estado", "roles"} <= campos
    assert all("Secreta123" not in (cambio.valor_nuevo or "") for cambio in cambios)


def test_create_duplicate_email_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="ana@sigemi.test", roles=("profesor",))

    response = client.post(
        USUARIOS_URL,
        json={
            "nombre": "Ana",
            "apellido": "Perez",
            "correo_electronico": "ANA@sigemi.test",
            "contrasena": "Secreta123",
            "roles": ["profesor"],
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Ya existe un usuario con ese correo electrónico",
        "campo": "correo_electronico",
    }
    assert db.query(Usuario).count() == 2


def test_create_unknown_role_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)

    response = client.post(
        USUARIOS_URL,
        json={
            "nombre": "Ana",
            "apellido": "Perez",
            "correo_electronico": "ana@sigemi.test",
            "contrasena": "Secreta123",
            "roles": ["superusuario"],
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El rol indicado no existe en el catálogo",
        "campo": "roles",
    }
    assert db.query(Usuario).count() == 1


@pytest.mark.parametrize(
    "contrasena",
    [
        "Abc1234",  # 7 characters, below the minimum length
        "abcdefgh",  # 8 characters, no digit
        "12345678",  # 8 characters, no letter
        "ñ" * 37,  # 37 characters, 74 bytes: over the bcrypt limit
    ],
)
def test_create_weak_password_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory, contrasena: str
):
    token, _ = _admin_token(client, usuario_factory)

    response = client.post(
        USUARIOS_URL,
        json={
            "nombre": "Ana",
            "apellido": "Perez",
            "correo_electronico": "ana@sigemi.test",
            "contrasena": contrasena,
            "roles": ["profesor"],
        },
        headers=_headers(token),
    )

    assert response.status_code == 400, response.text
    cuerpo = response.json()
    assert cuerpo["campo"] == "contrasena"
    assert cuerpo["detail"].startswith("La contraseña")
    assert db.query(Usuario).count() == 1


def test_create_accepts_a_password_of_exactly_72_bytes(
    client: TestClient, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)
    contrasena = "a" * 71 + "1"

    response = client.post(
        USUARIOS_URL,
        json={
            "nombre": "Ana",
            "apellido": "Perez",
            "correo_electronico": "ana@sigemi.test",
            "contrasena": contrasena,
            "roles": ["profesor"],
        },
        headers=_headers(token),
    )

    assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Listado: pagination envelope, filters, limit cap
# ---------------------------------------------------------------------------


def test_list_returns_pagination_envelope(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="beto@sigemi.test", roles=("bioquimico",))

    response = client.get(USUARIOS_URL, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["limit"] == 20
    assert payload["offset"] == 0
    assert len(payload["items"]) == 2
    assert payload["items"][0]["apellido"] <= payload["items"][1]["apellido"]
    assert "contrasena_hash" not in payload["items"][0]


def test_list_filters_by_estado(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="beto@sigemi.test", estado="inactivo")

    response = client.get(
        USUARIOS_URL, params={"estado": "inactivo"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["correo_electronico"] == "beto@sigemi.test"


def test_list_filters_by_rol(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="beto@sigemi.test", roles=("bioquimico", "profesor"))
    usuario_factory(correo="carla@sigemi.test", roles=("profesor",))

    response = client.get(
        USUARIOS_URL, params={"rol": "bioquimico"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["correo_electronico"] == "beto@sigemi.test"


def test_list_filters_by_correo_electronico(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="beto@sigemi.test")

    response = client.get(
        USUARIOS_URL,
        params={"correo_electronico": "BETO@sigemi.test"},
        headers=_headers(token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["correo_electronico"] == "beto@sigemi.test"


def test_list_searches_by_q(client: TestClient, db: Session, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    encontrado = usuario_factory(correo="gonzalez@sigemi.test")
    encontrado.apellido = "Gonzalez"
    usuario_factory(correo="otro@sigemi.test")
    db.flush()

    response = client.get(USUARIOS_URL, params={"q": "gonz"}, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == str(encontrado.id)


def test_list_clamps_limit_to_100(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)

    response = client.get(USUARIOS_URL, params={"limit": 500}, headers=_headers(token))

    assert response.status_code == 200
    assert response.json()["limit"] == 100


# ---------------------------------------------------------------------------
# Detalle
# ---------------------------------------------------------------------------


def test_get_user_returns_profile(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(
        correo="beto@sigemi.test", roles=("bioquimico", "profesor")
    )

    response = client.get(f"{USUARIOS_URL}/{usuario.id}", headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(usuario.id)
    assert payload["roles"] == ["bioquimico", "profesor"]


def test_get_unknown_user_returns_404(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)

    response = client.get(
        f"{USUARIOS_URL}/00000000-0000-0000-0000-000000000000",
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado"


# ---------------------------------------------------------------------------
# Modificación y baja lógica
# ---------------------------------------------------------------------------


def test_update_changes_fields_and_audits_each_one(
    client: TestClient, db: Session, usuario_factory
):
    token, admin = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.patch(
        f"{USUARIOS_URL}/{usuario.id}",
        json={"nombre": "Roberto", "correo_electronico": "roberto@sigemi.test"},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["nombre"] == "Roberto"
    assert payload["correo_electronico"] == "roberto@sigemi.test"

    db.refresh(usuario)
    assert usuario.nombre == "Roberto"

    auditorias = _auditorias_of(db, usuario.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "modificar"
    assert auditorias[0].usuario_id == admin.id

    cambios = {
        cambio.campo: (cambio.valor_anterior, cambio.valor_nuevo)
        for cambio in db.query(CambioAuditoria)
        .filter_by(auditoria_id=auditorias[0].id)
        .all()
    }
    assert cambios["nombre"] == ("Test", "Roberto")
    assert cambios["correo_electronico"] == ("beto@sigemi.test", "roberto@sigemi.test")


def test_update_rejects_duplicate_email_with_field(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario_factory(correo="beto@sigemi.test")
    otro = usuario_factory(correo="carla@sigemi.test")

    response = client.patch(
        f"{USUARIOS_URL}/{otro.id}",
        json={"correo_electronico": "beto@sigemi.test"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Ya existe un usuario con ese correo electrónico",
        "campo": "correo_electronico",
    }


def test_update_invalid_estado_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.patch(
        f"{USUARIOS_URL}/{usuario.id}",
        json={"estado": "borrado"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El estado debe ser activo o inactivo",
        "campo": "estado",
    }
    db.refresh(usuario)
    assert usuario.estado == "activo"


def test_update_without_fields_is_rejected(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.patch(
        f"{USUARIOS_URL}/{usuario.id}", json={}, headers=_headers(token)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No se enviaron campos para modificar"


def test_admin_cannot_deactivate_own_account(
    client: TestClient, db: Session, usuario_factory
):
    token, admin = _admin_token(client, usuario_factory)

    response = client.patch(
        f"{USUARIOS_URL}/{admin.id}",
        json={"estado": "inactivo"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No puede desactivar su propia cuenta"
    db.refresh(admin)
    assert admin.estado == "activo"
    # The login above writes an "acceder" row; the rejected patch adds nothing.
    assert [
        auditoria
        for auditoria in _auditorias_of(db, admin.id)
        if auditoria.accion == "modificar"
    ] == []


def test_deactivation_is_logical_and_blocks_login(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.patch(
        f"{USUARIOS_URL}/{usuario.id}",
        json={"estado": "inactivo"},
        headers=_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "inactivo"

    existe = db.get(Usuario, usuario.id)
    assert existe is not None
    assert existe.estado == "inactivo"

    login = client.post(
        LOGIN_URL,
        data={"username": "beto@sigemi.test", "password": "Secreta123"},
    )
    assert login.status_code == 403


def test_update_unknown_user_returns_404(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)

    response = client.patch(
        f"{USUARIOS_URL}/00000000-0000-0000-0000-000000000000",
        json={"nombre": "Roberto"},
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado"


# ---------------------------------------------------------------------------
# Asignación de roles
# ---------------------------------------------------------------------------


def test_replace_roles_replaces_the_set(
    client: TestClient, db: Session, usuario_factory
):
    token, admin = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test", roles=("bioquimico",))

    response = client.put(
        f"{USUARIOS_URL}/{usuario.id}/roles",
        json={"roles": ["profesor", "administrador"]},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["roles"] == ["administrador", "profesor"]

    filas = db.query(UsuarioRol).filter_by(usuario_id=usuario.id).all()
    assert len(filas) == 2

    auditorias = _auditorias_of(db, usuario.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "modificar"
    assert auditorias[0].usuario_id == admin.id
    cambios = db.query(CambioAuditoria).filter_by(auditoria_id=auditorias[0].id).all()
    assert [(c.campo, c.valor_anterior, c.valor_nuevo) for c in cambios] == [
        ("roles", "bioquimico", "administrador,profesor")
    ]


def test_replace_roles_rejects_unknown_code(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test", roles=("bioquimico",))

    response = client.put(
        f"{USUARIOS_URL}/{usuario.id}/roles",
        json={"roles": ["profesor", "superusuario"]},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El rol indicado no existe en el catálogo",
        "campo": "roles",
    }
    filas = db.query(UsuarioRol).filter_by(usuario_id=usuario.id).all()
    assert len(filas) == 1


def test_replace_roles_rejects_empty_list(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.put(
        f"{USUARIOS_URL}/{usuario.id}/roles",
        json={"roles": []},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Debe asignar al menos un rol al usuario",
        "campo": "roles",
    }


def test_replace_roles_unknown_user_returns_404(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)

    response = client.put(
        f"{USUARIOS_URL}/00000000-0000-0000-0000-000000000000/roles",
        json={"roles": ["profesor"]},
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado"


# ---------------------------------------------------------------------------
# Catálogo cerrado de roles
# ---------------------------------------------------------------------------


def test_roles_catalog_lists_the_closed_roles(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)

    response = client.get(ROLES_URL, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert [rol["codigo"] for rol in payload["items"]] == [
        "administrador",
        "bioquimico",
        "profesor",
    ]
    assert set(payload["items"][0]) == {"id", "codigo", "nombre"}


# ---------------------------------------------------------------------------
# No physical delete is exposed
# ---------------------------------------------------------------------------


def test_delete_is_not_exposed(client: TestClient, usuario_factory):
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    response = client.delete(f"{USUARIOS_URL}/{usuario.id}", headers=_headers(token))

    assert response.status_code == 405


# ---------------------------------------------------------------------------
# Regresión de la verificación independiente: blancos y comodines
# ---------------------------------------------------------------------------


def test_create_user_rejects_blank_fields_with_field(
    client: TestClient, usuario_factory
):
    """Blank text is business validation: 400 + campo, never a stored ``""``."""
    admin = usuario_factory(roles=("administrador",))
    token = _token(client, admin.correo_electronico)

    base = {
        "nombre": "Ana",
        "apellido": "Perez",
        "correo_electronico": "ana@sigemi.test",
        "contrasena": "Secreta123",
        "roles": ["profesor"],
    }

    for campo, detalle in (
        ("nombre", "El nombre no puede estar vacío"),
        ("apellido", "El apellido no puede estar vacío"),
        ("correo_electronico", "El correo electrónico no puede estar vacío"),
    ):
        response = client.post(
            USUARIOS_URL,
            json={**base, campo: "   "},
            headers=_headers(token),
        )

        assert response.status_code == 400, (campo, response.text)
        assert response.json() == {"detail": detalle, "campo": campo}


def test_update_user_rejects_blank_fields_with_field(
    client: TestClient, db: Session, usuario_factory
):
    """The same normalization applies on modification."""
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")

    for campo, detalle in (
        ("nombre", "El nombre no puede estar vacío"),
        ("apellido", "El apellido no puede estar vacío"),
        ("correo_electronico", "El correo electrónico no puede estar vacío"),
    ):
        response = client.patch(
            f"{USUARIOS_URL}/{usuario.id}",
            json={campo: "   "},
            headers=_headers(token),
        )

        assert response.status_code == 400, (campo, response.text)
        assert response.json() == {"detail": detalle, "campo": campo}

    db.refresh(usuario)
    assert usuario.correo_electronico == "beto@sigemi.test"


def test_validate_before_apply_preserves_row_state(
    client: TestClient, db: Session, usuario_factory
):
    """A payload rejected in one field must not half-apply the others."""
    token, _ = _admin_token(client, usuario_factory)
    usuario = usuario_factory(correo="beto@sigemi.test")
    nombre_original = usuario.nombre

    response = client.patch(
        f"{USUARIOS_URL}/{usuario.id}",
        json={"nombre": "NuevoNombre", "estado": "invalido"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    db.refresh(usuario)
    assert usuario.nombre == nombre_original
    modificaciones = (
        db.query(Auditoria).filter_by(entidad_id=usuario.id, accion="modificar").count()
    )
    assert modificaciones == 0


def test_list_escapes_like_wildcards_literally(
    client: TestClient, db: Session, usuario_factory
):
    """``q`` matches ``_`` and ``%`` literally instead of as wildcards."""
    token, _ = _admin_token(client, usuario_factory)
    con_guion_bajo = usuario_factory(correo="a_b@sigemi.test")
    con_guion_bajo.nombre = "A_B"
    sin_guion_bajo = usuario_factory(correo="axb@sigemi.test")
    sin_guion_bajo.nombre = "AxB"
    db.flush()

    response = client.get(USUARIOS_URL, params={"q": "_"}, headers=_headers(token))

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert str(con_guion_bajo.id) in ids
    assert str(sin_guion_bajo.id) not in ids
