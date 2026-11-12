"""Durable regression probes for the audit read API (T7: S2, SEG-U04, SEG-U05, D6).

These probes came from the independent verifier of the T7 candidate: they pin
what the unit tests in ``test_auditoria.py`` do not — the empty listing contract,
day boundaries at microsecond precision, ordering across page boundaries, and
byte-identical reads with exact secret masking.

Every query is scoped by ``usuario_id`` on purpose: a test must not depend on the
lane database being empty. Tokens are minted directly instead of going through
``POST /auth/login``, because a successful login writes its own ``acceder`` audit
row and would perturb the expected sets.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.models.access import Usuario
from app.models.audit import Auditoria, CambioAuditoria

AUDITORIA_URL = f"{settings.api_v1_prefix}/auditoria"


def _admin_headers(usuario_factory) -> tuple[dict[str, str], Usuario]:
    admin = usuario_factory(roles=("administrador",))
    token = create_access_token(admin.id, ["administrador"])
    return {"Authorization": f"Bearer {token}"}, admin


def _make_event(
    db: Session,
    *,
    actor: Usuario,
    fecha_hora: datetime,
    accion: str = "crear",
    modulo: str = "seguridad",
    entidad_afectada: str = "usuario",
    entidad_id: uuid.UUID | None = None,
    direccion_ip: str | None = "192.168.1.1",
    cambios: list[tuple[str, str | None, str | None]] | None = None,
) -> Auditoria:
    evento = Auditoria(
        usuario_id=actor.id,
        fecha_hora=fecha_hora,
        modulo=modulo,
        accion=accion,
        entidad_afectada=entidad_afectada,
        entidad_id=entidad_id or uuid.uuid4(),
        direccion_ip=direccion_ip,
    )
    db.add(evento)
    db.flush()
    for campo, anterior, nuevo in cambios or []:
        db.add(
            CambioAuditoria(
                auditoria_id=evento.id,
                campo=campo,
                valor_anterior=anterior,
                valor_nuevo=nuevo,
            )
        )
    db.flush()
    return evento


def _ids(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


def test_empty_listing_answers_200_with_the_envelope(
    client: TestClient, usuario_factory
):
    """An empty result set is a valid answer, never a 4xx (UCE-SEG-04, exc. pasos 2 y 4)."""
    headers, _admin = _admin_headers(usuario_factory)

    response = client.get(
        AUDITORIA_URL, params={"usuario_id": str(uuid.uuid4())}, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


def test_date_boundaries_are_inclusive_and_each_end_works_alone(
    client: TestClient, db: Session, usuario_factory
):
    """``fecha_desde`` / ``fecha_hasta`` are day-inclusive and independent."""
    headers, admin = _admin_headers(usuario_factory)

    previo = _make_event(
        db, actor=admin, fecha_hora=datetime(2026, 3, 9, 23, 59, 59, tzinfo=UTC)
    )
    inicio = _make_event(
        db, actor=admin, fecha_hora=datetime(2026, 3, 10, 0, 0, 0, tzinfo=UTC)
    )
    medio = _make_event(
        db, actor=admin, fecha_hora=datetime(2026, 3, 10, 12, 0, 0, tzinfo=UTC)
    )
    fin = _make_event(
        db,
        actor=admin,
        fecha_hora=datetime(2026, 3, 10, 23, 59, 59, 999999, tzinfo=UTC),
    )
    siguiente = _make_event(
        db, actor=admin, fecha_hora=datetime(2026, 3, 11, 0, 0, 0, tzinfo=UTC)
    )
    actor = {"usuario_id": str(admin.id)}

    rango = client.get(
        AUDITORIA_URL,
        params={
            **actor,
            "fecha_desde": "2026-03-10",
            "fecha_hasta": "2026-03-10",
        },
        headers=headers,
    )
    hasta = client.get(
        AUDITORIA_URL,
        params={**actor, "fecha_hasta": "2026-03-10"},
        headers=headers,
    )
    desde = client.get(
        AUDITORIA_URL,
        params={**actor, "fecha_desde": "2026-03-10"},
        headers=headers,
    )

    assert _ids(rango) == [str(fin.id), str(medio.id), str(inicio.id)]
    assert _ids(hasta) == [str(fin.id), str(medio.id), str(inicio.id), str(previo.id)]
    assert _ids(desde) == [
        str(siguiente.id),
        str(fin.id),
        str(medio.id),
        str(inicio.id),
    ]


def test_ordering_holds_across_page_boundaries(
    client: TestClient, db: Session, usuario_factory
):
    """Descending chronological order spans pages; ``total`` is page-independent."""
    headers, admin = _admin_headers(usuario_factory)

    base = datetime(2026, 3, 20, 10, 0, 0, tzinfo=UTC)
    for minuto in range(25):
        _make_event(db, actor=admin, fecha_hora=base + timedelta(minutes=minuto))

    paginas = [
        client.get(
            AUDITORIA_URL,
            params={"usuario_id": str(admin.id), "limit": 10, "offset": offset},
            headers=headers,
        ).json()
        for offset in (0, 10, 20)
    ]

    items = [item for pagina in paginas for item in pagina["items"]]
    assert len(items) == 25
    assert all(pagina["total"] == 25 for pagina in paginas)
    for anterior, posterior in zip(items, items[1:], strict=False):
        assert datetime.fromisoformat(anterior["fecha_hora"]) >= datetime.fromisoformat(
            posterior["fecha_hora"]
        )


def test_reads_are_byte_identical_and_mask_every_secret(
    client: TestClient, db: Session, usuario_factory
):
    """Repeated reads change nothing and never leak a hash or a clear password."""
    headers, admin = _admin_headers(usuario_factory)

    secreto = "SuperSecretPassword123"
    hash_crudo = "$2b$12$eX4mPL3H4shV4lu3N07L34k3d"
    evento = _make_event(
        db,
        actor=admin,
        fecha_hora=datetime(2026, 3, 21, 10, 0, 0, tzinfo=UTC),
        cambios=[
            ("contrasena_hash", hash_crudo, hash_crudo),
            ("contrasena", secreto, secreto),
            ("nombre", "Old", "New"),
        ],
    )

    primera = client.get(
        AUDITORIA_URL, params={"usuario_id": str(admin.id)}, headers=headers
    )
    segunda = client.get(
        AUDITORIA_URL, params={"usuario_id": str(admin.id)}, headers=headers
    )
    detalle = client.get(f"{AUDITORIA_URL}/{evento.id}", headers=headers)

    assert primera.status_code == 200, primera.text
    assert primera.content == segunda.content
    assert detalle.status_code == 200, detalle.text
    assert secreto not in detalle.text
    assert hash_crudo not in detalle.text

    cambios = {cambio["campo"]: cambio for cambio in detalle.json()["cambios"]}
    assert cambios["contrasena_hash"]["valor_anterior"] is None
    assert cambios["contrasena_hash"]["valor_nuevo"] is None
    assert cambios["contrasena"]["valor_anterior"] is None
    assert cambios["contrasena"]["valor_nuevo"] is None
    assert cambios["nombre"]["valor_anterior"] == "Old"
    assert cambios["nombre"]["valor_nuevo"] == "New"
