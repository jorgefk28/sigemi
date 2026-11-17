"""Tests for the clinical report (UCE-REP-01, RF-15).

Rules pinned here:

- the report is **anonymized**: no name, DNI, phone, e-mail or address in the
  preview nor in the CSV, and a stable opaque key per patient instead (A-10);
- the preview carries the envelope and the column list; the export carries a BOM,
  the `;` separator and the same columns;
- only the clinical report is available: inventory and waste answer ``400``
  because their subsystems have no data yet;
- both operations are ``bioquimico``/``administrador``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.access import Profesional
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    FichaClinica,
    Muestra,
    Paciente,
)

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
REPORTES_URL = f"{settings.api_v1_prefix}/reportes"


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _escenario(db: Session, usuario) -> Paciente:
    profesional = Profesional(
        usuario_id=usuario.id, matricula="MP-9", especialidad=None, estado="activo"
    )
    db.add(profesional)
    db.flush()

    paciente_id = uuid.uuid4()
    paciente = Paciente(
        id=paciente_id,
        numero_registro=f"PAC-{paciente_id.hex[:8].upper()}",
        dni="30999888",
        nombre="NombreSecreto",
        apellido="ApellidoSecreto",
        fecha_nacimiento=datetime(1990, 6, 15).date(),
        telefono="3764000000",
        correo_electronico="secreto@correo.com",
        domicilio="Calle Secreta 123",
        obra_social="ObraSecreta",
        nivel_registro="completo",
        estado="activo",
        fecha_ingreso=datetime.now(UTC),
    )
    db.add(paciente)
    db.flush()

    ficha = FichaClinica(
        paciente_id=paciente.id,
        profesional_id=profesional.id,
        fecha_consulta=datetime.now(UTC),
        version_actual=1,
        estado="activa",
    )
    tipo_analisis = TipoAnalisis(nombre="Cultivo", descripcion=None, estado="activo")
    tipo_muestra = TipoMuestra(nombre="Uña", descripcion=None, estado="activo")
    db.add_all([ficha, tipo_analisis, tipo_muestra])
    db.flush()

    muestra = Muestra(
        paciente_id=paciente.id,
        tipo_muestra_id=tipo_muestra.id,
        usuario_id=usuario.id,
        observaciones=None,
    )
    db.add(muestra)
    db.flush()
    db.add(
        AnalisisMicologico(
            ficha_clinica_id=ficha.id,
            tipo_analisis_id=tipo_analisis.id,
            muestra_id=muestra.id,
            profesional_responsable_id=profesional.id,
            estado="validado",
        )
    )
    db.flush()
    return paciente


def test_la_previsualizacion_no_lleva_datos_identificatorios(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _escenario(db, bioquimico)

    response = client.get(
        f"{REPORTES_URL}/clinico",
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert set(cuerpo) == {"items", "total", "limit", "offset", "columnas"}
    assert cuerpo["total"] == 1
    assert cuerpo["columnas"] == [
        "paciente_clave",
        "fecha",
        "tipo_analisis",
        "tipo_muestra",
        "estado",
        "edad",
    ]

    fila = cuerpo["items"][0]
    assert set(fila) == set(cuerpo["columnas"])
    texto = response.text
    for prohibido in (
        "NombreSecreto",
        "ApellidoSecreto",
        "30999888",
        "3764000000",
        "secreto@correo.com",
        "Calle Secreta",
        "ObraSecreta",
    ):
        assert prohibido not in texto, f"el reporte filtró {prohibido}"


def test_la_clave_opaca_es_estable_y_no_es_el_id(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    paciente = _escenario(db, bioquimico)
    headers = _headers(_token(client, bioquimico.correo_electronico))

    primera = client.get(f"{REPORTES_URL}/clinico", headers=headers).json()["items"][0]
    segunda = client.get(f"{REPORTES_URL}/clinico", headers=headers).json()["items"][0]

    assert primera["paciente_clave"] == segunda["paciente_clave"]
    assert primera["paciente_clave"] != str(paciente.id)
    assert len(primera["paciente_clave"]) == 8


def test_la_exportacion_es_csv_con_bom_y_separador(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _escenario(db, bioquimico)

    response = client.get(
        f"{REPORTES_URL}/clinico/exportar",
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]

    cuerpo = response.content
    assert cuerpo.startswith(b"\xef\xbb\xbf")
    lineas = cuerpo.decode("utf-8-sig").splitlines()
    assert lineas[0] == "paciente_clave;fecha;tipo_analisis;tipo_muestra;estado;edad"
    assert len(lineas) == 2
    assert "NombreSecreto" not in cuerpo.decode("utf-8-sig")


def test_sin_datos_el_reporte_esta_vacio_pero_responde(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))

    response = client.get(
        f"{REPORTES_URL}/clinico",
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0
    assert response.json()["items"] == []


def test_el_filtro_por_fecha_acota_el_conjunto(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _escenario(db, bioquimico)
    headers = _headers(_token(client, bioquimico.correo_electronico))

    futuro = date(2099, 1, 1)
    response = client.get(
        f"{REPORTES_URL}/clinico",
        params={"fecha_desde": str(futuro)},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0


def test_los_reportes_sin_datos_avisan_en_vez_de_exportar_vacio(
    client: TestClient, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    headers = _headers(_token(client, bioquimico.correo_electronico))

    for tipo in ("inventario", "desechos"):
        response = client.get(f"{REPORTES_URL}/{tipo}", headers=headers)
        assert response.status_code == 400, response.text
        assert "todavía no tiene datos" in response.json()["detail"]

    desconocido = client.get(f"{REPORTES_URL}/otro", headers=headers)
    assert desconocido.status_code == 400


def test_profesor_no_accede(client: TestClient, usuario_factory) -> None:
    profesor = usuario_factory(roles=("profesor",))

    response = client.get(
        f"{REPORTES_URL}/clinico",
        headers=_headers(_token(client, profesor.correo_electronico)),
    )

    assert response.status_code == 403, response.text
