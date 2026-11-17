"""Tests for the clinical record (UCE-DIAG-01, DIAG-06, DIAG-07).

Rules pinned here:

- the field catalog is served by the API (A-04), so the screen never keeps a
  second copy; the two mandatory fields answer ``400`` + ``campo`` when blank;
- the professional comes from the session (A-03): a user without a ``profesional``
  row gets ``400`` and never a record signed by someone else;
- modifying keeps the previous version in ``version_ficha_clinica``;
- once the patient has a validated analysis the modification is rejected with the
  reason of UCE-DIAG-07 excepción del paso 1.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.access import Profesional
from app.models.audit import Auditoria
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    DatoClinico,
    FichaClinica,
    Muestra,
    Paciente,
    VersionFichaClinica,
)

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
FICHAS_URL = f"{settings.api_v1_prefix}/fichas-clinicas"

DATOS_OK = {"motivo_consulta": "Uña con mancha", "sintomas": "Prurito"}


def _token(client: TestClient, correo: str) -> str:
    response = client.post(
        LOGIN_URL, data={"username": correo, "password": "Secreta123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _paciente(db: Session, dni: str = "30111222") -> Paciente:
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
        usuario_id=usuario.id,
        matricula="MP-1234",
        especialidad="Micologia",
        estado="activo",
    )
    db.add(profesional)
    db.flush()
    return profesional


def test_campos_expone_el_catalogo_declarado(
    client: TestClient, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))

    response = client.get(
        f"{FICHAS_URL}/campos",
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    campos = response.json()
    claves = [campo["campo"] for campo in campos]
    assert claves[0] == "motivo_consulta"
    assert "sintomas" in claves
    assert all(set(campo) == {"campo", "etiqueta", "obligatorio"} for campo in campos)


def test_crear_exige_perfil_profesional(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    paciente = _paciente(db)

    response = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    # A-03: sin perfil profesional no se firma nada.
    assert response.status_code == 400, response.text
    assert response.json()["campo"] == "profesional"


def test_crear_valida_los_obligatorios_y_los_campos_desconocidos(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))

    sin_motivo = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": {"sintomas": "Prurito"}},
        headers=headers,
    )
    assert sin_motivo.status_code == 400, sin_motivo.text
    assert sin_motivo.json()["campo"] == "motivo_consulta"

    desconocido = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": {**DATOS_OK, "inventado": "x"}},
        headers=headers,
    )
    assert desconocido.status_code == 400, desconocido.text
    assert desconocido.json()["campo"] == "inventado"


def test_crear_guarda_los_datos_y_audita(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    profesional = _profesional(db, bioquimico)
    paciente = _paciente(db)

    response = client.post(
        FICHAS_URL,
        json={
            "paciente_id": str(paciente.id),
            "datos": {**DATOS_OK, "antecedentes": "  Ninguno  "},
        },
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 201, response.text
    ficha = response.json()
    assert ficha["paciente_apellido"] == "Garcia"
    assert ficha["paciente_dni"] == "30111222"
    assert ficha["profesional_id"] == str(profesional.id)
    assert ficha["profesional_nombre"] == "Test User1"
    assert ficha["datos"]["antecedentes"] == "Ninguno"
    assert ficha["version_actual"] == 1

    auditorias = list(
        db.scalars(
            select(Auditoria).where(
                Auditoria.entidad_afectada == "ficha_clinica",
                Auditoria.entidad_id == uuid.UUID(ficha["id"]),
            )
        )
    )
    assert len(auditorias) == 1
    assert auditorias[0].accion == "crear"


def test_editar_conserva_la_version_anterior(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))
    ficha = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=headers,
    ).json()
    ficha_id = uuid.UUID(ficha["id"])

    editada = client.patch(
        f"{FICHAS_URL}/{ficha_id}",
        json={"datos": {"sintomas": "Prurito intenso"}},
        headers=headers,
    )

    assert editada.status_code == 200, editada.text
    assert editada.json()["datos"]["sintomas"] == "Prurito intenso"
    assert editada.json()["datos"]["motivo_consulta"] == "Uña con mancha"
    assert editada.json()["version_actual"] == 2

    version = db.scalar(
        select(VersionFichaClinica).where(
            VersionFichaClinica.ficha_clinica_id == ficha_id
        )
    )
    assert version is not None
    assert version.numero_version == 2
    assert version.datos_previos["sintomas"] == "Prurito"
    assert version.datos_nuevos["sintomas"] == "Prurito intenso"


def test_editar_sin_cambios_no_crea_version(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))
    ficha = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=headers,
    ).json()
    ficha_id = uuid.UUID(ficha["id"])

    respuesta = client.patch(
        f"{FICHAS_URL}/{ficha_id}", json={"datos": DATOS_OK}, headers=headers
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["version_actual"] == 1
    assert (
        db.scalar(
            select(VersionFichaClinica).where(
                VersionFichaClinica.ficha_clinica_id == ficha_id
            )
        )
        is None
    )


def test_un_analisis_validado_bloquea_la_edicion(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    profesional = _profesional(db, bioquimico)
    paciente = _paciente(db)
    headers = _headers(_token(client, bioquimico.correo_electronico))
    ficha = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=headers,
    ).json()
    ficha_id = uuid.UUID(ficha["id"])

    tipo_analisis = TipoAnalisis(nombre="Cultivo", descripcion=None, estado="activo")
    tipo_muestra = TipoMuestra(nombre="Uña", descripcion=None, estado="activo")
    db.add_all([tipo_analisis, tipo_muestra])
    db.flush()
    muestra = Muestra(
        paciente_id=paciente.id,
        tipo_muestra_id=tipo_muestra.id,
        usuario_id=bioquimico.id,
        observaciones=None,
    )
    db.add(muestra)
    db.flush()
    db.add(
        AnalisisMicologico(
            ficha_clinica_id=ficha_id,
            tipo_analisis_id=tipo_analisis.id,
            muestra_id=muestra.id,
            profesional_responsable_id=profesional.id,
            estado="validado",
        )
    )
    db.flush()

    response = client.patch(
        f"{FICHAS_URL}/{ficha_id}",
        json={"datos": {"sintomas": "Otro"}},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert "análisis validado" in response.json()["detail"]


def test_listar_por_paciente_ordena_por_fecha_desc(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db)
    db.add_all(
        [
            FichaClinica(
                paciente_id=paciente.id,
                profesional_id=db.scalars(select(Profesional.id)).first(),
                fecha_consulta=datetime(2026, 1, 1, tzinfo=UTC),
                version_actual=1,
                estado="activa",
            ),
            FichaClinica(
                paciente_id=paciente.id,
                profesional_id=db.scalars(select(Profesional.id)).first(),
                fecha_consulta=datetime(2026, 5, 1, tzinfo=UTC),
                version_actual=1,
                estado="activa",
            ),
        ]
    )
    db.flush()

    response = client.get(
        FICHAS_URL,
        params={"paciente_id": str(paciente.id)},
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    )

    assert response.status_code == 200, response.text
    fechas = [fila["fecha_consulta"] for fila in response.json()["items"]]
    assert fechas == sorted(fechas, reverse=True)


def test_administrador_lee_pero_no_escribe(
    client: TestClient, db: Session, usuario_factory
) -> None:
    admin = usuario_factory(roles=("administrador",))
    paciente = _paciente(db)
    headers = _headers(_token(client, admin.correo_electronico))

    assert client.get(FICHAS_URL, headers=headers).status_code == 200

    response = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=headers,
    )
    assert response.status_code == 403, response.text


def test_profesor_no_accede(client: TestClient, usuario_factory) -> None:
    profesor = usuario_factory(roles=("profesor",))

    response = client.get(
        FICHAS_URL, headers=_headers(_token(client, profesor.correo_electronico))
    )

    assert response.status_code == 403, response.text


def test_los_datos_se_guardan_en_dato_clinico(
    client: TestClient, db: Session, usuario_factory
) -> None:
    bioquimico = usuario_factory(roles=("bioquimico",))
    _profesional(db, bioquimico)
    paciente = _paciente(db)

    ficha = client.post(
        FICHAS_URL,
        json={"paciente_id": str(paciente.id), "datos": DATOS_OK},
        headers=_headers(_token(client, bioquimico.correo_electronico)),
    ).json()

    filas = list(
        db.scalars(
            select(DatoClinico).where(
                DatoClinico.ficha_clinica_id == uuid.UUID(ficha["id"])
            )
        )
    )
    assert {fila.campo for fila in filas} == {"motivo_consulta", "sintomas"}
    assert all(fila.tipo_dato == "texto" for fila in filas)
