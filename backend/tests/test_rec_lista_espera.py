"""Tests for the wait list (UCE-REC-28, REC-29).

Rules pinned here:

- the whole module is ``administrador``-only;
- the listing resolves ``paciente_nombre``/``paciente_apellido``/``paciente_dni``
  and orders by the derived priority (A9): ``fecha_solicitud`` ascending, then
  ``tipo_analisis_id`` ascending;
- removing an entry is a logical ``retirado`` transition audited as
  ``modificar`` (A8), and is idempotent once already removed.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models.access import Usuario
from app.models.agenda import ListaEspera
from app.models.audit import Auditoria, CambioAuditoria
from app.models.catalogs import TipoAnalisis
from app.models.clinical import Paciente

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
LISTA_URL = f"{settings.api_v1_prefix}/lista-espera"


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _rol_token(client: TestClient, usuario_factory, roles) -> tuple[str, Usuario]:
    usuario = usuario_factory(roles=roles)
    return _token(client, usuario.correo_electronico), usuario


def _paciente(db: Session, dni: str = "12345678") -> Paciente:
    paciente_id = uuid.uuid4()
    paciente = Paciente(
        id=paciente_id,
        numero_registro=f"PAC-{paciente_id.hex[:8].upper()}",
        dni=dni,
        nombre="Ana",
        apellido="Perez",
        fecha_nacimiento=datetime(1990, 1, 1).date(),
        telefono="123456",
        nivel_registro="completo",
        estado="activo",
        fecha_ingreso=utcnow(),
    )
    db.add(paciente)
    db.flush()
    return paciente


def _tipo_analisis(db: Session, nombre: str) -> TipoAnalisis:
    tipo = TipoAnalisis(nombre=nombre)
    db.add(tipo)
    db.flush()
    return tipo


def _entrada(
    db: Session,
    paciente: Paciente,
    *,
    tipo_analisis_id: uuid.UUID | None = None,
    fecha_solicitud: datetime | None = None,
    estado: str = "pendiente",
) -> ListaEspera:
    entrada = ListaEspera(
        paciente_id=paciente.id,
        tipo_analisis_id=tipo_analisis_id,
        fecha_solicitud=fecha_solicitud or utcnow(),
        estado=estado,
    )
    db.add(entrada)
    db.flush()
    return entrada


def _auditorias_of(db: Session, entidad_id) -> list[Auditoria]:
    return db.query(Auditoria).filter_by(entidad_id=entidad_id).all()


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def test_module_requires_administrador(
    client: TestClient, db: Session, usuario_factory
):
    bioquimico = usuario_factory(roles=("bioquimico",))
    token = _token(client, bioquimico.correo_electronico)
    paciente = _paciente(db)
    entrada = _entrada(db, paciente)

    sin_token_list = client.get(LISTA_URL)
    otro_rol_list = client.get(LISTA_URL, headers=_headers(token))
    otro_rol_quitar = client.post(
        f"{LISTA_URL}/{entrada.id}/quitar", headers=_headers(token)
    )

    assert sin_token_list.status_code == 401
    assert otro_rol_list.status_code == 403
    assert otro_rol_quitar.status_code == 403
    assert otro_rol_list.json()["detail"] == "Permisos insuficientes"


# ---------------------------------------------------------------------------
# Consulta (UCE-REC-29)
# ---------------------------------------------------------------------------


def test_list_resolves_paciente_fields(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111")
    _entrada(db, paciente)

    response = client.get(LISTA_URL, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["limit"] == 20
    assert payload["offset"] == 0
    item = payload["items"][0]
    assert item["paciente_id"] == str(paciente.id)
    assert item["paciente_nombre"] == "Ana"
    assert item["paciente_apellido"] == "Perez"
    assert item["paciente_dni"] == "11111111"


def test_list_orders_by_fecha_solicitud(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    vieja = _entrada(db, paciente, fecha_solicitud=base)
    media = _entrada(db, paciente, fecha_solicitud=base + timedelta(days=1))
    nueva = _entrada(db, paciente, fecha_solicitud=base + timedelta(days=2))

    response = client.get(LISTA_URL, headers=_headers(token))

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(vieja.id), str(media.id), str(nueva.id)]


def test_list_breaks_tie_by_tipo_analisis_id(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    ta1 = _tipo_analisis(db, "Micológico directo")
    ta2 = _tipo_analisis(db, "Cultivo")
    menor, mayor = sorted([ta1, ta2], key=lambda tipo: tipo.id)
    base = datetime(2026, 1, 1, tzinfo=UTC)

    e_mayor = _entrada(db, paciente, tipo_analisis_id=mayor.id, fecha_solicitud=base)
    e_menor = _entrada(db, paciente, tipo_analisis_id=menor.id, fecha_solicitud=base)

    response = client.get(LISTA_URL, headers=_headers(token))

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(e_menor.id), str(e_mayor.id)]


def test_list_filters_by_tipo_analisis_id(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    ta1 = _tipo_analisis(db, "Micológico directo")
    ta2 = _tipo_analisis(db, "Cultivo")
    _entrada(db, paciente, tipo_analisis_id=ta1.id)
    _entrada(db, paciente, tipo_analisis_id=ta2.id)

    response = client.get(
        LISTA_URL, params={"tipo_analisis_id": str(ta1.id)}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["tipo_analisis_id"] == str(ta1.id)


def test_list_filters_by_estado(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    _entrada(db, paciente, estado="pendiente")
    _entrada(db, paciente, estado="retirado")

    response = client.get(
        LISTA_URL, params={"estado": "retirado"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["estado"] == "retirado"


def test_list_filters_by_fecha_rango(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    _entrada(db, paciente, fecha_solicitud=base)
    _entrada(db, paciente, fecha_solicitud=base + timedelta(days=10))

    response = client.get(
        LISTA_URL,
        params={"fecha_desde": "2026-01-05", "fecha_hasta": "2026-01-20"},
        headers=_headers(token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["fecha_solicitud"].startswith("2026-01-1")


def test_list_clamps_limit_to_100(client: TestClient, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))

    response = client.get(LISTA_URL, params={"limit": 500}, headers=_headers(token))

    assert response.status_code == 200
    assert response.json()["limit"] == 100


# ---------------------------------------------------------------------------
# Quitar (UCE-REC-28)
# ---------------------------------------------------------------------------


def test_quitar_sets_retirado_and_audits(
    client: TestClient, db: Session, usuario_factory
):
    token, actor = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    entrada = _entrada(db, paciente)

    response = client.post(f"{LISTA_URL}/{entrada.id}/quitar", headers=_headers(token))

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "retirado"

    db.refresh(entrada)
    assert entrada.estado == "retirado"

    auditorias = _auditorias_of(db, entrada.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "modificar"
    assert auditorias[0].modulo == "lista_espera"
    assert auditorias[0].usuario_id == actor.id
    cambios = db.query(CambioAuditoria).filter_by(auditoria_id=auditorias[0].id).all()
    assert [(c.campo, c.valor_anterior, c.valor_nuevo) for c in cambios] == [
        ("estado", "pendiente", "retirado")
    ]


def test_quitar_already_retirado_is_idempotent(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db)
    entrada = _entrada(db, paciente, estado="retirado")

    response = client.post(f"{LISTA_URL}/{entrada.id}/quitar", headers=_headers(token))

    assert response.status_code == 200
    assert response.json()["estado"] == "retirado"
    assert _auditorias_of(db, entrada.id) == []


def test_quitar_unknown_returns_404(client: TestClient, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))

    response = client.post(
        f"{LISTA_URL}/00000000-0000-0000-0000-000000000000/quitar",
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert (
        response.json()["detail"] == "No se encontró la entrada en la lista de espera"
    )
