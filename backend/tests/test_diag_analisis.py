"""Tests for the analysis cycle (UCE-DIAG-02 a DIAG-09, DIAG-13, DIAG-14).

Rules pinned here:

- the sample entry creates the sample **and** its first analysis in
  ``pendiente``, and needs a clinical record of the patient (A-13);
- the state machine only walks ``pendiente -> en_proceso -> terminado`` and
  ``validado`` is reached only through validation (DIAG-03 paso 5, DIAG-04);
- ``invalidado`` needs its motive, the validated analysis is definitive, and the
  sample rejection uses the same state with its observation (DIAG-08, DIAG-14);
- the addendum creates a version and never touches the original (DIAG-13);
- the panel filters by state, type, patient and date (DIAG-09 paso 3).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.access import Profesional
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    FichaClinica,
    HallazgoAnalisis,
    Paciente,
    VersionAnalisis,
)

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
MUESTRAS_URL = f"{settings.api_v1_prefix}/muestras"
ANALISIS_URL = f"{settings.api_v1_prefix}/analisis"


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _paciente(db: Session, dni: str = "30555666") -> Paciente:
    paciente_id = uuid.uuid4()
    paciente = Paciente(
        id=paciente_id,
        numero_registro=f"PAC-{paciente_id.hex[:8].upper()}",
        dni=dni,
        nombre="Ana",
        apellido="Garcia",
        fecha_nacimiento=datetime(1990, 1, 1).date(),
        telefono="123456",
        nivel_registro="completo",
        estado="activo",
        fecha_ingreso=datetime.now(UTC),
    )
    db.add(paciente)
    db.flush()
    return paciente


def _profesional(db: Session, usuario) -> Profesional:
    profesional = Profesional(
        usuario_id=usuario.id, matricula="MP-1", especialidad=None, estado="activo"
    )
    db.add(profesional)
    db.flush()
    return profesional


def _ficha(db: Session, paciente: Paciente, profesional: Profesional) -> FichaClinica:
    ficha = FichaClinica(
        paciente_id=paciente.id,
        profesional_id=profesional.id,
        fecha_consulta=datetime.now(UTC),
        version_actual=1,
        estado="activa",
    )
    db.add(ficha)
    db.flush()
    return ficha


def _catalogo(db: Session) -> tuple[TipoAnalisis, TipoMuestra]:
    tipo_analisis = TipoAnalisis(
        nombre="Cultivo de uñas", descripcion=None, estado="activo"
    )
    tipo_muestra = TipoMuestra(nombre="Uña", descripcion=None, estado="activo")
    db.add_all([tipo_analisis, tipo_muestra])
    db.flush()
    return tipo_analisis, tipo_muestra


def _escenario(client: TestClient, db: Session, usuario_factory):
    """A biochemist with profile, a patient with a record and the catalogs."""
    bioquimico = usuario_factory(roles=("bioquimico",))
    profesional = _profesional(db, bioquimico)
    paciente = _paciente(db)
    _ficha(db, paciente, profesional)
    tipo_analisis, tipo_muestra = _catalogo(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))
    return bioquimico, profesional, paciente, tipo_analisis, tipo_muestra, headers


def _ingresar_muestra(client, headers, paciente, tipo_analisis, tipo_muestra) -> dict:
    response = client.post(
        MUESTRAS_URL,
        json={
            "paciente_id": str(paciente.id),
            "tipo_muestra_id": str(tipo_muestra.id),
            "tipo_analisis_id": str(tipo_analisis.id),
            "observaciones": "Muestra de uña del pie derecho",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_ingresar_muestra_crea_la_muestra_y_el_primer_analisis(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )

    respuesta = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )

    assert respuesta["observaciones"] == "Muestra de uña del pie derecho"
    analisis = respuesta["analisis"]
    assert analisis["estado"] == "pendiente"
    assert analisis["tipo_analisis_nombre"] == "Cultivo de uñas"
    assert analisis["tipo_muestra_nombre"] == "Uña"
    assert analisis["paciente_dni"] == "30555666"
    assert analisis["profesional_responsable_nombre"] == "Test User1"
    assert analisis["version_actual"] == 1
    assert analisis["hallazgos"] == []
    assert analisis["addendum"] is None


def test_ingresar_muestra_sin_ficha_clinica_responde_400(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db, dni="30777888")
    tipo_analisis, tipo_muestra = _catalogo(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))

    response = client.post(
        MUESTRAS_URL,
        json={
            "paciente_id": str(paciente.id),
            "tipo_muestra_id": str(tipo_muestra.id),
            "tipo_analisis_id": str(tipo_analisis.id),
        },
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert response.json()["campo"] == "ficha_clinica_id"


def test_el_flujo_avanza_solo_con_las_transiciones_validas(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    salto = client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={"estado": "terminado"},
        headers=headers,
    )
    assert salto.status_code == 400, salto.text
    assert salto.json()["campo"] == "estado"

    a_proceso = client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={
            "estado": "en_proceso",
            "hallazgos": [
                {"tipo_hallazgo": "examen_directo", "dato": "Sin hifas visibles"}
            ],
        },
        headers=headers,
    )
    assert a_proceso.status_code == 200, a_proceso.text
    assert a_proceso.json()["estado"] == "en_proceso"
    assert len(a_proceso.json()["hallazgos"]) == 1

    a_terminado = client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={
            "estado": "terminado",
            "hallazgos": [{"tipo_hallazgo": "cultivo", "dato": "Dermatofito"}],
        },
        headers=headers,
    )
    assert a_terminado.status_code == 200, a_terminado.text
    assert a_terminado.json()["estado"] == "terminado"
    assert len(a_terminado.json()["hallazgos"]) == 2


def test_un_hallazgo_con_tipo_desconocido_responde_400(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    response = client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={
            "estado": "en_proceso",
            "hallazgos": [{"tipo_hallazgo": "inventado", "dato": "x"}],
        },
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert response.json()["campo"] == "tipo_hallazgo"


def test_validar_exige_terminado_y_registra_al_validador(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, profesional, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    temprano = client.post(f"{ANALISIS_URL}/{analisis_id}/validar", headers=headers)
    assert temprano.status_code == 400, temprano.text

    for estado in ("en_proceso", "terminado"):
        client.patch(
            f"{ANALISIS_URL}/{analisis_id}/estado",
            json={"estado": estado},
            headers=headers,
        )

    validado = client.post(f"{ANALISIS_URL}/{analisis_id}/validar", headers=headers)

    assert validado.status_code == 200, validado.text
    cuerpo = validado.json()
    assert cuerpo["estado"] == "validado"
    assert cuerpo["profesional_validador_id"] == str(profesional.id)
    assert cuerpo["fecha_validacion"] is not None

    # A validated analysis is definitive: no further updates.
    bloqueado = client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={"estado": "en_proceso"},
        headers=headers,
    )
    assert bloqueado.status_code == 400, bloqueado.text


def test_el_administrador_no_valida(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]
    for estado in ("en_proceso", "terminado"):
        client.patch(
            f"{ANALISIS_URL}/{analisis_id}/estado",
            json={"estado": estado},
            headers=headers,
        )

    admin = usuario_factory(roles=("administrador",))
    response = client.post(
        f"{ANALISIS_URL}/{analisis_id}/validar",
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 403, response.text


def test_invalidar_exige_motivo_y_admite_administrador(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    sin_motivo = client.post(
        f"{ANALISIS_URL}/{analisis_id}/invalidar",
        json={"motivo": "  "},
        headers=headers,
    )
    assert sin_motivo.status_code == 400, sin_motivo.text
    assert sin_motivo.json()["campo"] == "motivo"

    admin = usuario_factory(roles=("administrador",))
    response = client.post(
        f"{ANALISIS_URL}/{analisis_id}/invalidar",
        json={"motivo": "El paciente desistió"},
        headers=_headers(_token(client, admin.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "invalidado"
    assert response.json()["motivo_invalidacion"] == "El paciente desistió"


def test_un_analisis_validado_no_se_invalida(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]
    for estado in ("en_proceso", "terminado"):
        client.patch(
            f"{ANALISIS_URL}/{analisis_id}/estado",
            json={"estado": estado},
            headers=headers,
        )
    client.post(f"{ANALISIS_URL}/{analisis_id}/validar", headers=headers)

    response = client.post(
        f"{ANALISIS_URL}/{analisis_id}/invalidar", json={"motivo": "x"}, headers=headers
    )

    assert response.status_code == 400, response.text
    assert "definitivo" in response.json()["detail"]


def test_rechazar_muestra_pide_motivo_y_observacion(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    sin_observacion = client.post(
        f"{ANALISIS_URL}/{analisis_id}/rechazar",
        json={"motivo": "Contaminada", "observacion": " "},
        headers=headers,
    )
    assert sin_observacion.status_code == 400, sin_observacion.text
    assert sin_observacion.json()["campo"] == "observacion"

    response = client.post(
        f"{ANALISIS_URL}/{analisis_id}/rechazar",
        json={"motivo": "Contaminada", "observacion": "Recipiente abierto"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "invalidado"
    assert "Contaminada" in response.json()["motivo_invalidacion"]


def test_el_addendum_crea_version_sin_modificar_el_original(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]
    for estado in ("en_proceso", "terminado"):
        client.patch(
            f"{ANALISIS_URL}/{analisis_id}/estado",
            json={"estado": estado},
            headers=headers,
        )
    client.post(f"{ANALISIS_URL}/{analisis_id}/validar", headers=headers)

    response = client.post(
        f"{ANALISIS_URL}/{analisis_id}/addendum",
        json={
            "motivo": "Error de tipeo",
            "contenido": "Donde dice hifas, dice esporas",
        },
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["version_actual"] == 2
    assert response.json()["addendum"]["contenido"] == "Donde dice hifas, dice esporas"

    version = db.scalar(
        select(VersionAnalisis).where(
            VersionAnalisis.analisis_id == uuid.UUID(analisis_id)
        )
    )
    assert version is not None
    assert version.numero_version == 2
    assert version.datos_previos["estado"] == "validado"
    # The original row keeps its state: only the version counter moved.
    assert db.get(AnalisisMicologico, uuid.UUID(analisis_id)).estado == "validado"


def test_el_panel_filtra_por_estado_paciente_y_texto(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    _ingresar_muestra(client, headers, paciente, tipo_analisis, tipo_muestra)

    porEstado = client.get(
        ANALISIS_URL, params={"estado": "pendiente"}, headers=headers
    ).json()
    assert porEstado["total"] == 1
    assert set(porEstado) == {"items", "total", "limit", "offset"}

    porPaciente = client.get(
        ANALISIS_URL, params={"paciente_id": str(paciente.id)}, headers=headers
    ).json()
    assert porPaciente["total"] == 1

    porTexto = client.get(ANALISIS_URL, params={"q": "Garcia"}, headers=headers).json()
    assert porTexto["total"] == 1

    vacio = client.get(ANALISIS_URL, params={"q": "NoExiste"}, headers=headers).json()
    assert vacio["total"] == 0

    invalido = client.get(
        ANALISIS_URL, params={"estado": "cualquiera"}, headers=headers
    )
    assert invalido.status_code == 400, invalido.text


def test_tipos_hallazgo_expone_el_catalogo(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))

    response = client.get(
        f"{settings.api_v1_prefix}/tipos-hallazgo",
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    codigos = [fila["codigo"] for fila in response.json()]
    assert "examen_directo" in codigos
    assert "observacion" in codigos


def test_los_hallazgos_quedan_en_la_tabla(
    client: TestClient, db: Session, usuario_factory
) -> None:
    _, _, paciente, tipo_analisis, tipo_muestra, headers = _escenario(
        client, db, usuario_factory
    )
    analisis_id = _ingresar_muestra(
        client, headers, paciente, tipo_analisis, tipo_muestra
    )["analisis"]["id"]

    client.patch(
        f"{ANALISIS_URL}/{analisis_id}/estado",
        json={
            "estado": "en_proceso",
            "hallazgos": [
                {"tipo_hallazgo": "observacion", "dato": "Muestra escasa"},
                {"tipo_hallazgo": "cultivo", "dato": "Crecimiento a las 72 h"},
            ],
        },
        headers=headers,
    )

    filas = list(
        db.scalars(
            select(HallazgoAnalisis).where(
                HallazgoAnalisis.analisis_id == uuid.UUID(analisis_id)
            )
        )
    )
    assert {fila.tipo_hallazgo for fila in filas} == {"observacion", "cultivo"}
