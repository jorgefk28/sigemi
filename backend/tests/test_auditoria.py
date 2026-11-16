"""Tests for the audit log read API (UCE-SEG-04, RF-14).

Rules pinned here:

- only an ``administrador`` reaches the module, and the log is read-only
  (no update or delete route exists);
- the listing answers the pinned ``{items, total, limit, offset}`` envelope,
  ordered chronologically descending, and filters by ``usuario_id``,
  ``fecha_desde`` / ``fecha_hasta`` and ``accion``;
- the closed ``accion`` filter set is the one fixed by D6;
- every read is free: a query never writes an audit row (RF-14 audits
  significant events, not read-only consultations);
- the detail shows the header plus 0..N field changes and never echoes a
  password value.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models.access import Usuario
from app.models.audit import Auditoria, CambioAuditoria

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
AUDITORIA_URL = f"{settings.api_v1_prefix}/auditoria"


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


def _evento(
    db: Session,
    *,
    actor: Usuario,
    accion: str = "crear",
    modulo: str = "seguridad",
    entidad_afectada: str = "usuario",
    entidad_id: uuid.UUID | None = None,
    fecha_hora: datetime | None = None,
    direccion_ip: str | None = "203.0.113.9",
    cambios: list[tuple[str, str | None, str | None]] | None = None,
) -> Auditoria:
    """Insert one audit event (plus its field changes) directly."""
    auditoria = Auditoria(
        usuario_id=actor.id,
        fecha_hora=fecha_hora or utcnow(),
        modulo=modulo,
        accion=accion,
        entidad_afectada=entidad_afectada,
        entidad_id=entidad_id or uuid.uuid4(),
        direccion_ip=direccion_ip,
    )
    db.add(auditoria)
    db.flush()
    for campo, anterior, nuevo in cambios or []:
        db.add(
            CambioAuditoria(
                auditoria_id=auditoria.id,
                campo=campo,
                valor_anterior=anterior,
                valor_nuevo=nuevo,
            )
        )
    db.flush()
    return auditoria


def _total_auditorias(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Auditoria)) or 0


# ---------------------------------------------------------------------------
# Authorization: the module is administrador-only
# ---------------------------------------------------------------------------


def test_module_requires_administrador_role(client: TestClient, usuario_factory):
    bioquimico = usuario_factory(roles=("bioquimico",))
    profesor = usuario_factory(roles=("profesor",))

    sin_token = client.get(AUDITORIA_URL)

    assert sin_token.status_code == 401
    for usuario in (bioquimico, profesor):
        token = _token(client, usuario.correo_electronico)
        listado = client.get(AUDITORIA_URL, headers=_headers(token))
        detalle = client.get(f"{AUDITORIA_URL}/{uuid.uuid4()}", headers=_headers(token))
        assert listado.status_code == 403
        assert listado.json()["detail"] == "Permisos insuficientes"
        assert detalle.status_code == 403


# ---------------------------------------------------------------------------
# Listing: envelope, ordering, filters
# ---------------------------------------------------------------------------


def test_list_answers_pinned_envelope_and_columns(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    _evento(db, actor=actor)

    response = client.get(
        AUDITORIA_URL, params={"usuario_id": str(actor.id)}, headers=_headers(token)
    )

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert set(cuerpo) == {"items", "total", "limit", "offset"}
    assert cuerpo["total"] == 1
    assert cuerpo["limit"] == 20
    assert cuerpo["offset"] == 0
    assert set(cuerpo["items"][0]) == {
        "id",
        "fecha_hora",
        "usuario_id",
        "usuario_nombre",
        "usuario_apellido",
        "modulo",
        "accion",
        "entidad_afectada",
        "direccion_ip",
    }
    assert cuerpo["items"][0]["usuario_nombre"] == actor.nombre
    assert cuerpo["items"][0]["usuario_apellido"] == actor.apellido


def test_list_is_chronologically_descending(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    viejo = _evento(db, actor=actor, fecha_hora=datetime(2026, 3, 10, 8, 0, tzinfo=UTC))
    nuevo = _evento(db, actor=actor, fecha_hora=datetime(2026, 3, 10, 9, 0, tzinfo=UTC))
    medio = _evento(
        db, actor=actor, fecha_hora=datetime(2026, 3, 10, 8, 30, tzinfo=UTC)
    )

    response = client.get(
        AUDITORIA_URL, params={"usuario_id": str(actor.id)}, headers=_headers(token)
    )

    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(nuevo.id), str(medio.id), str(viejo.id)]


def test_list_filters_by_usuario_id(client: TestClient, db: Session, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    otro = usuario_factory(roles=("profesor",))
    propio = _evento(db, actor=actor)
    _evento(db, actor=otro)

    response = client.get(
        AUDITORIA_URL, params={"usuario_id": str(actor.id)}, headers=_headers(token)
    )

    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(propio.id)]


def test_date_range_includes_both_ends(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    inicio = _evento(
        db, actor=actor, fecha_hora=datetime(2026, 3, 10, 0, 0, tzinfo=UTC)
    )
    fin = _evento(
        db, actor=actor, fecha_hora=datetime(2026, 3, 10, 23, 59, 59, tzinfo=UTC)
    )
    fuera = _evento(db, actor=actor, fecha_hora=datetime(2026, 3, 11, 0, 0, tzinfo=UTC))

    response = client.get(
        AUDITORIA_URL,
        params={
            "usuario_id": str(actor.id),
            "fecha_desde": "2026-03-10",
            "fecha_hasta": "2026-03-10",
        },
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(fin.id), str(inicio.id)]
    assert str(fuera.id) not in ids


def test_list_filters_by_accion(client: TestClient, db: Session, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    _evento(db, actor=actor, accion="crear")
    modificado = _evento(db, actor=actor, accion="modificar")

    response = client.get(
        AUDITORIA_URL,
        params={"usuario_id": str(actor.id), "accion": "modificar"},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(modificado.id)]


def test_list_rejects_action_outside_the_closed_set(
    client: TestClient, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)

    # The closed catalog has six actions (level 3); anything else is rejected.
    for accion in ("borrar", "retirar"):
        response = client.get(
            AUDITORIA_URL, params={"accion": accion}, headers=_headers(token)
        )
        assert response.status_code == 400
        cuerpo = response.json()
        assert cuerpo["campo"] == "accion"
        assert cuerpo["detail"] == (
            "El tipo de acción debe ser crear, modificar, eliminar, "
            "consultar, acceder o bloquear"
        )


def test_list_filters_by_acceder_and_bloquear(
    client: TestClient, db: Session, usuario_factory
):
    """Both login events are offered by the filter (level 3 closed catalog)."""
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    accedido = _evento(db, actor=actor, accion="acceder")
    bloqueado = _evento(db, actor=actor, accion="bloquear")
    _evento(db, actor=actor, accion="crear")

    acceder = client.get(
        AUDITORIA_URL,
        params={"usuario_id": str(actor.id), "accion": "acceder"},
        headers=_headers(token),
    )
    bloquear = client.get(
        AUDITORIA_URL,
        params={"usuario_id": str(actor.id), "accion": "bloquear"},
        headers=_headers(token),
    )

    assert acceder.status_code == 200, acceder.text
    assert [item["id"] for item in acceder.json()["items"]] == [str(accedido.id)]
    assert bloquear.status_code == 200, bloquear.text
    assert [item["id"] for item in bloquear.json()["items"]] == [str(bloqueado.id)]


def test_list_rejects_inverted_date_range(client: TestClient, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)

    response = client.get(
        AUDITORIA_URL,
        params={"fecha_desde": "2026-03-11", "fecha_hasta": "2026-03-10"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    cuerpo = response.json()
    assert cuerpo["campo"] == "fecha_desde"
    assert cuerpo["detail"] == (
        "La fecha desde no puede ser posterior a la fecha hasta"
    )


def test_list_caps_limit_at_one_hundred(client: TestClient, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)

    response = client.get(AUDITORIA_URL, params={"limit": 500}, headers=_headers(token))

    assert response.status_code == 200, response.text
    assert response.json()["limit"] == 100


# ---------------------------------------------------------------------------
# Detail: header, field changes, secrets
# ---------------------------------------------------------------------------


def test_detail_returns_header_and_ordered_changes(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    entidad_id = uuid.uuid4()
    evento = _evento(
        db,
        actor=actor,
        accion="modificar",
        entidad_afectada="usuario",
        entidad_id=entidad_id,
        cambios=[
            ("estado", "activo", "inactivo"),
            ("correo_electronico", "viejo@sigma.test", "nuevo@sigma.test"),
        ],
    )

    response = client.get(f"{AUDITORIA_URL}/{evento.id}", headers=_headers(token))

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["id"] == str(evento.id)
    assert cuerpo["usuario_id"] == str(actor.id)
    assert cuerpo["usuario_nombre"] == actor.nombre
    assert cuerpo["usuario_apellido"] == actor.apellido
    assert cuerpo["modulo"] == "seguridad"
    assert cuerpo["accion"] == "modificar"
    assert cuerpo["entidad_afectada"] == "usuario"
    assert cuerpo["entidad_id"] == str(entidad_id)
    assert cuerpo["direccion_ip"] == "203.0.113.9"
    assert cuerpo["cambios"] == [
        {
            "campo": "correo_electronico",
            "valor_anterior": "viejo@sigma.test",
            "valor_nuevo": "nuevo@sigma.test",
        },
        {"campo": "estado", "valor_anterior": "activo", "valor_nuevo": "inactivo"},
    ]


def test_detail_without_changes_returns_empty_list(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    evento = _evento(db, actor=actor)

    response = client.get(f"{AUDITORIA_URL}/{evento.id}", headers=_headers(token))

    assert response.status_code == 200, response.text
    assert response.json()["cambios"] == []


def test_detail_masks_password_values(client: TestClient, db: Session, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    evento = _evento(
        db,
        actor=actor,
        cambios=[
            ("contrasena_hash", "$2b$12$viejo", "$2b$12$nuevo"),
            ("estado", "activo", "inactivo"),
        ],
    )

    response = client.get(f"{AUDITORIA_URL}/{evento.id}", headers=_headers(token))

    assert response.status_code == 200, response.text
    assert "$2b$" not in response.text
    cambios = {cambio["campo"]: cambio for cambio in response.json()["cambios"]}
    assert cambios["contrasena_hash"]["valor_anterior"] is None
    assert cambios["contrasena_hash"]["valor_nuevo"] is None
    assert cambios["estado"]["valor_nuevo"] == "inactivo"


def test_detail_answers_404_for_unknown_event(client: TestClient, usuario_factory):
    token, _admin = _admin_token(client, usuario_factory)

    response = client.get(f"{AUDITORIA_URL}/{uuid.uuid4()}", headers=_headers(token))

    assert response.status_code == 404
    assert response.json()["detail"] == "No se encontró el evento"


# ---------------------------------------------------------------------------
# Read-only contract
# ---------------------------------------------------------------------------


def test_reads_do_not_write_audit_rows(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    evento = _evento(db, actor=actor)
    antes = _total_auditorias(db)

    listado = client.get(
        AUDITORIA_URL, params={"usuario_id": str(actor.id)}, headers=_headers(token)
    )
    detalle = client.get(f"{AUDITORIA_URL}/{evento.id}", headers=_headers(token))

    assert listado.status_code == 200, listado.text
    assert detalle.status_code == 200, detalle.text
    assert _total_auditorias(db) == antes


def test_write_methods_are_not_exposed(
    client: TestClient, db: Session, usuario_factory
):
    token, _admin = _admin_token(client, usuario_factory)
    actor = usuario_factory(roles=("bioquimico",))
    evento = _evento(db, actor=actor)
    headers = _headers(token)

    assert client.post(AUDITORIA_URL, headers=headers, json={}).status_code == 405
    assert (
        client.patch(
            f"{AUDITORIA_URL}/{evento.id}", headers=headers, json={}
        ).status_code
        == 405
    )
    assert (
        client.put(f"{AUDITORIA_URL}/{evento.id}", headers=headers, json={}).status_code
        == 405
    )
    assert (
        client.delete(f"{AUDITORIA_URL}/{evento.id}", headers=headers).status_code
        == 405
    )
