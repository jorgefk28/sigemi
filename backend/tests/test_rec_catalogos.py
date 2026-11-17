"""Tests for the clinical catalogs (UCE-DIAG-10, RF-16).

Rules pinned here:

- reading the catalogs is open to ``bioquimico`` and ``administrador`` (they feed
  the selectors of the clinical screens); writing is ``administrador``-only, as
  the UCE precondition says, and ``profesor`` never sees them;
- the name is trimmed, cannot be blank and is unique case-insensitively inside
  its own catalog, and the duplicate answers ``400`` + ``campo = "nombre"``;
- deactivating is logical and idempotent: the row survives so historical
  analyses keep resolving their type, and a second click adds no audit row;
- clearing the optional ``descripcion`` travels as an empty string, because the
  ``PATCH`` serializer drops ``null`` (the trap detected in review F-001).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit import Auditoria
from app.models.catalogs import TipoAnalisis, TipoMuestra

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
ANALISIS_URL = f"{settings.api_v1_prefix}/tipos-analisis"
MUESTRA_URL = f"{settings.api_v1_prefix}/tipos-muestra"


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _crear_tipo(
    db: Session, nombre: str, *, estado: str = "activo", descripcion: str | None = None
) -> TipoAnalisis:
    tipo = TipoAnalisis(nombre=nombre, descripcion=descripcion, estado=estado)
    db.add(tipo)
    db.flush()
    return tipo


def _auditorias(db: Session, entidad_id: uuid.UUID) -> list[Auditoria]:
    return list(
        db.scalars(
            select(Auditoria).where(
                Auditoria.entidad_afectada == "tipo_analisis",
                Auditoria.entidad_id == entidad_id,
            )
        )
    )


# --------------------------------------------------------------------------
# Lectura
# --------------------------------------------------------------------------


def test_listado_devuelve_el_sobre_y_ordena_por_nombre(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _crear_tipo(db, "Zeta micologico")
    _crear_tipo(db, "Agar Sabouraud")

    response = client.get(
        ANALISIS_URL, headers=_headers(_token(client, bioquimico.correo_electronico))
    )

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert set(cuerpo) == {"items", "total", "limit", "offset"}
    assert cuerpo["limit"] == 20
    assert cuerpo["offset"] == 0
    nombres = [item["nombre"] for item in cuerpo["items"]]
    assert nombres == sorted(nombres), nombres
    assert cuerpo["total"] == len(cuerpo["items"])
    assert set(cuerpo["items"][0]) == {"id", "nombre", "descripcion", "estado"}


def test_profesor_no_accede_al_catalogo(client: TestClient, usuario_factory) -> None:
    profesor = usuario_factory(roles=("profesor",))

    response = client.get(
        ANALISIS_URL, headers=_headers(_token(client, profesor.correo_electronico))
    )

    assert response.status_code == 403, response.text


def test_sin_token_responde_401(client: TestClient) -> None:
    assert client.get(ANALISIS_URL).status_code == 401


def test_filtros_por_texto_y_estado(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _crear_tipo(db, "Cultivo de uñas")
    _crear_tipo(db, "Directo micologico", estado="inactivo")
    headers = _headers(_token(client, bioquimico.correo_electronico))

    porTexto = client.get(ANALISIS_URL, params={"q": "cultivo"}, headers=headers).json()
    assert [item["nombre"] for item in porTexto["items"]] == ["Cultivo de uñas"]

    porEstado = client.get(
        ANALISIS_URL, params={"estado": "inactivo"}, headers=headers
    ).json()
    assert [item["nombre"] for item in porEstado["items"]] == ["Directo micologico"]

    invalido = client.get(ANALISIS_URL, params={"estado": "borrado"}, headers=headers)
    assert invalido.status_code == 400
    assert "activo o inactivo" in invalido.json()["detail"]


# --------------------------------------------------------------------------
# Escritura
# --------------------------------------------------------------------------


def test_bioquimico_no_puede_crear(client: TestClient, usuario_factory) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))

    response = client.post(
        ANALISIS_URL,
        json={"nombre": "Cultivo"},
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 403, response.text


def test_administrador_crea_y_audita(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))

    response = client.post(
        ANALISIS_URL,
        json={"nombre": "  Cultivo de uñas  ", "descripcion": "  Hongos filamentosos "},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 201, response.text
    creado = response.json()
    assert creado["nombre"] == "Cultivo de uñas"
    assert creado["descripcion"] == "Hongos filamentosos"
    assert creado["estado"] == "activo"

    filas = _auditorias(db, uuid.UUID(creado["id"]))
    assert len(filas) == 1
    assert filas[0].accion == "crear"
    assert filas[0].modulo == "catalogos"


def test_nombre_vacio_responde_400_con_campo(
    client: TestClient, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))

    response = client.post(
        ANALISIS_URL,
        json={"nombre": "   "},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 400, response.text
    assert response.json() == {
        "detail": "El nombre no puede estar vacío",
        "campo": "nombre",
    }


def test_nombre_duplicado_sin_importar_mayusculas(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    _crear_tipo(db, "Cultivo de uñas")
    headers = _headers(_token(client, admin.correo_electronico))

    response = client.post(
        ANALISIS_URL, json={"nombre": "CULTIVO DE UÑAS"}, headers=headers
    )

    assert response.status_code == 400, response.text
    assert response.json()["campo"] == "nombre"
    assert "ya existe" in response.json()["detail"].lower()


def test_editar_con_otro_tamano_del_mismo_nombre_es_valido(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _crear_tipo(db, "Cultivo de uñas")

    response = client.patch(
        f"{ANALISIS_URL}/{tipo.id}",
        json={"nombre": "CULTIVO DE UÑAS"},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    assert response.json()["nombre"] == "CULTIVO DE UÑAS"


def test_un_patch_vacio_responde_400(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _crear_tipo(db, "Cultivo")

    response = client.patch(
        f"{ANALISIS_URL}/{tipo.id}",
        json={},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 400, response.text


def test_vaciar_la_descripcion_la_limpia_y_audita(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _crear_tipo(db, "Cultivo", descripcion="Texto viejo")

    response = client.patch(
        f"{ANALISIS_URL}/{tipo.id}",
        # `null` would be dropped by `exclude_none=True`; `''` survives and the
        # service turns it into NULL.
        json={"descripcion": ""},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    assert response.json()["descripcion"] is None
    filas = _auditorias(db, tipo.id)
    assert len(filas) == 1
    assert filas[0].accion == "modificar"


def test_baja_logica_e_idempotente(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _crear_tipo(db, "Cultivo")
    headers = _headers(_token(client, admin.correo_electronico))

    primera = client.post(f"{ANALISIS_URL}/{tipo.id}/baja", headers=headers)
    assert primera.status_code == 200, primera.text
    assert primera.json()["estado"] == "inactivo"

    filas = _auditorias(db, tipo.id)
    assert len(filas) == 1

    # A second click is not an error and does not duplicate the audit trail.
    segunda = client.post(f"{ANALISIS_URL}/{tipo.id}/baja", headers=headers)
    assert segunda.status_code == 200, segunda.text
    assert segunda.json()["estado"] == "inactivo"
    assert len(_auditorias(db, tipo.id)) == 1

    # The row survives: history keeps resolving the type.
    assert db.get(TipoAnalisis, tipo.id) is not None


def test_baja_de_un_tipo_inexistente_responde_404(
    client: TestClient, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))

    response = client.post(
        f"{ANALISIS_URL}/{uuid.uuid4()}/baja",
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 404, response.text


# --------------------------------------------------------------------------
# Tipos de muestra: mismas reglas, catálogo distinto
# --------------------------------------------------------------------------


def test_tipos_muestra_comparten_las_reglas_y_son_un_catalogo_aparte(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    headers = _headers(_token(client, admin.correo_electronico))

    # The same name can exist in both catalogs: they are different catalogs.
    db.add(TipoAnalisis(nombre="Uña", descripcion=None, estado="activo"))
    db.flush()

    creada = client.post(MUESTRA_URL, json={"nombre": "Uña"}, headers=headers)
    assert creada.status_code == 201, creada.text
    assert creada.json()["nombre"] == "Uña"

    duplicada = client.post(MUESTRA_URL, json={"nombre": "uña"}, headers=headers)
    assert duplicada.status_code == 400, duplicada.text
    assert duplicada.json()["campo"] == "nombre"

    listado = client.get(MUESTRA_URL, headers=headers).json()
    assert set(listado) == {"items", "total", "limit", "offset"}
    assert db.scalar(select(func.count()).select_from(TipoMuestra)) >= 1
