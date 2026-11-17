"""Tests for medical instructions (UCE-REC-10 a REC-13, RF-02).

Rules pinned here:

- the module is ``bioquimico``/``administrador``; ``profesor`` never sees it;
- the three fields are mandatory and a missing one answers ``400`` + ``campo``,
  including the analysis type (UCE-REC-10 excepción del paso 4);
- the listing resolves ``tipo_analisis_nombre`` and filters by ``estado``,
  ``tipo_analisis_id`` and free text;
- deleting is the logical ``inactiva`` transition of UCE-REC-12 paso 5, audited
  and idempotent: historical appointments keep pointing at the instruction.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.agenda import IndicacionMedica
from app.models.audit import Auditoria
from app.models.catalogs import TipoAnalisis

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
INDICACIONES_URL = f"{settings.api_v1_prefix}/indicaciones-medicas"


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _tipo(
    db: Session, nombre: str = "Cultivo de uñas", estado: str = "activo"
) -> TipoAnalisis:
    tipo = TipoAnalisis(nombre=nombre, descripcion=None, estado=estado)
    db.add(tipo)
    db.flush()
    return tipo


def _auditorias(db: Session, entidad_id: uuid.UUID) -> list[Auditoria]:
    return list(
        db.scalars(
            select(Auditoria).where(
                Auditoria.entidad_afectada == "indicacion_medica",
                Auditoria.entidad_id == entidad_id,
            )
        )
    )


def test_listado_resuelve_el_tipo_y_devuelve_el_sobre(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    tipo = _tipo(db, "Directo micológico")
    db.add(
        IndicacionMedica(
            titulo="Ayuno",
            contenido="No aplicar cremas 48 horas antes.",
            tipo_analisis_id=tipo.id,
            estado="activa",
        )
    )
    db.flush()

    response = client.get(
        INDICACIONES_URL,
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert set(cuerpo) == {"items", "total", "limit", "offset"}
    fila = cuerpo["items"][0]
    assert fila["tipo_analisis_nombre"] == "Directo micológico"
    assert set(fila) == {
        "id",
        "titulo",
        "contenido",
        "tipo_analisis_id",
        "tipo_analisis_nombre",
        "estado",
        "fecha_creacion",
        "fecha_modificacion",
    }


def test_profesor_no_accede(client: TestClient, usuario_factory) -> None:
    profesor = usuario_factory(roles=("profesor",))

    response = client.get(
        INDICACIONES_URL, headers=_headers(_token(client, profesor.correo_electronico))
    )

    assert response.status_code == 403, response.text


def test_crear_exige_los_tres_campos(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _tipo(db)
    headers = _headers(_token(client, admin.correo_electronico))

    vacio = client.post(
        INDICACIONES_URL,
        json={"titulo": "  ", "contenido": "texto", "tipo_analisis_id": str(tipo.id)},
        headers=headers,
    )
    assert vacio.status_code == 400, vacio.text
    assert vacio.json() == {
        "detail": "El título no puede estar vacío",
        "campo": "titulo",
    }

    sin_contenido = client.post(
        INDICACIONES_URL,
        json={"titulo": "Ayuno", "contenido": " ", "tipo_analisis_id": str(tipo.id)},
        headers=headers,
    )
    assert sin_contenido.status_code == 400, sin_contenido.text
    assert sin_contenido.json()["campo"] == "contenido"


def test_crear_con_un_tipo_inexistente_responde_400_con_campo(
    client: TestClient, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))

    response = client.post(
        INDICACIONES_URL,
        json={
            "titulo": "Ayuno",
            "contenido": "texto",
            "tipo_analisis_id": str(uuid.uuid4()),
        },
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 400, response.text
    assert response.json()["campo"] == "tipo_analisis_id"


def test_crear_audita_y_devuelve_el_tipo_resuelto(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    tipo = _tipo(db, "Cultivo")

    response = client.post(
        INDICACIONES_URL,
        json={
            "titulo": "  Retirar esmalte  ",
            "contenido": "Retirar el esmalte de la uña afectada.",
            "tipo_analisis_id": str(tipo.id),
        },
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 201, response.text
    creada = response.json()
    assert creada["titulo"] == "Retirar esmalte"
    assert creada["estado"] == "activa"
    assert creada["tipo_analisis_nombre"] == "Cultivo"

    filas = _auditorias(db, uuid.UUID(creada["id"]))
    assert len(filas) == 1
    assert filas[0].accion == "crear"
    assert filas[0].modulo == "indicaciones_medicas"


def test_editar_parcial_y_patch_vacio(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _tipo(db)
    creada = client.post(
        INDICACIONES_URL,
        json={
            "titulo": "Ayuno",
            "contenido": "Texto",
            "tipo_analisis_id": str(tipo.id),
        },
        headers=_headers(_token(client, admin.correo_electronico)),
    ).json()
    headers = _headers(_token(client, admin.correo_electronico))

    editada = client.patch(
        f"{INDICACIONES_URL}/{creada['id']}",
        json={"contenido": "Nuevo"},
        headers=headers,
    )
    assert editada.status_code == 200, editada.text
    assert editada.json()["contenido"] == "Nuevo"
    assert editada.json()["titulo"] == "Ayuno"

    vacio = client.patch(f"{INDICACIONES_URL}/{creada['id']}", json={}, headers=headers)
    assert vacio.status_code == 400, vacio.text


def test_baja_logica_e_idempotente(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    tipo = _tipo(db)
    creada = client.post(
        INDICACIONES_URL,
        json={
            "titulo": "Ayuno",
            "contenido": "Texto",
            "tipo_analisis_id": str(tipo.id),
        },
        headers=_headers(_token(client, admin.correo_electronico)),
    ).json()
    headers = _headers(_token(client, admin.correo_electronico))
    indicacion_id = uuid.UUID(creada["id"])

    primera = client.post(f"{INDICACIONES_URL}/{indicacion_id}/baja", headers=headers)
    assert primera.status_code == 200, primera.text
    assert primera.json()["estado"] == "inactiva"
    assert len(_auditorias(db, indicacion_id)) == 2  # crear + modificar

    segunda = client.post(f"{INDICACIONES_URL}/{indicacion_id}/baja", headers=headers)
    assert segunda.status_code == 200, segunda.text
    assert len(_auditorias(db, indicacion_id)) == 2

    # The row survives: a historical appointment still resolves its instruction.
    assert db.get(IndicacionMedica, indicacion_id) is not None


def test_filtros_por_estado_tipo_y_texto(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    cultivo = _tipo(db, "Cultivo")
    directo = _tipo(db, "Directo")
    db.add_all(
        [
            IndicacionMedica(
                titulo="Ayuno",
                contenido="Sin cremas",
                tipo_analisis_id=cultivo.id,
                estado="activa",
            ),
            IndicacionMedica(
                titulo="Ropa suelta",
                contenido="Ventar la zona",
                tipo_analisis_id=directo.id,
                estado="inactiva",
            ),
        ]
    )
    db.flush()
    headers = _headers(_token(client, bioquimico.correo_electronico))

    porEstado = client.get(
        INDICACIONES_URL, params={"estado": "inactiva"}, headers=headers
    ).json()
    assert [item["titulo"] for item in porEstado["items"]] == ["Ropa suelta"]

    porTipo = client.get(
        INDICACIONES_URL, params={"tipo_analisis_id": str(cultivo.id)}, headers=headers
    ).json()
    assert [item["titulo"] for item in porTipo["items"]] == ["Ayuno"]

    porTexto = client.get(
        INDICACIONES_URL, params={"q": "cremas"}, headers=headers
    ).json()
    assert [item["titulo"] for item in porTexto["items"]] == ["Ayuno"]

    invalido = client.get(
        INDICACIONES_URL, params={"estado": "borrada"}, headers=headers
    )
    assert invalido.status_code == 400, invalido.text


def test_obtener_una_inexistente_responde_404(
    client: TestClient, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))

    response = client.get(
        f"{INDICACIONES_URL}/{uuid.uuid4()}",
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 404, response.text
