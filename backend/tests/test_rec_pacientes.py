"""Tests for patient administration (UCE-REC-16/17/18/19, S-01).

Rules pinned here:

- only ``bioquimico`` or ``administrador`` reach the module; ``baja`` is
  ``administrador``-only;
- alta validates dni/telefono/correo/fecha_nacimiento, derives
  ``numero_registro`` and does **not** audit (A7);
- ``dni`` is normalized (dots/spaces stripped, 7-8 digits) and unique;
- modification audits each changed field, rejects a dni owned by another
  patient, and keeps ``fecha_nacimiento`` immutable once the patient has
  analyses (A5);
- ``baja`` is logical, requires a motivo, rejects future vigentes turnos
  (A10) and an already-inactive patient.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models.access import Profesional, Usuario
from app.models.agenda import Turno
from app.models.audit import Auditoria, CambioAuditoria
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    FichaClinica,
    Muestra,
    Paciente,
)

LOGIN_URL = f"{settings.api_v1_prefix}/auth/login"
PACIENTES_URL = f"{settings.api_v1_prefix}/pacientes"


def _token(client: TestClient, correo: str, contrasena: str = "Secreta123") -> str:
    response = client.post(
        LOGIN_URL,
        data={"username": correo, "password": contrasena},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _rol_token(client: TestClient, usuario_factory, roles) -> tuple[str, Usuario]:
    usuario = usuario_factory(roles=roles)
    return _token(client, usuario.correo_electronico), usuario


def _paciente(db: Session, **overrides) -> Paciente:
    """Build (without committing) a patient with valid defaults."""
    datos = {
        "dni": "12345678",
        "nombre": "Ana",
        "apellido": "Perez",
        "fecha_nacimiento": date(1990, 1, 1),
        "telefono": "+54 9 11 1234-5678",
        "estado": "activo",
    }
    datos.update(overrides)
    paciente_id = uuid.uuid4()
    paciente = Paciente(
        id=paciente_id,
        numero_registro=f"PAC-{paciente_id.hex[:8].upper()}",
        **datos,
        nivel_registro="completo",
        fecha_ingreso=utcnow(),
    )
    db.add(paciente)
    db.flush()
    return paciente


def _auditorias_of(db: Session, entidad_id) -> list[Auditoria]:
    return db.query(Auditoria).filter_by(entidad_id=entidad_id).all()


def _cambios_of(db: Session, auditoria_id) -> list[CambioAuditoria]:
    return db.query(CambioAuditoria).filter_by(auditoria_id=auditoria_id).all()


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def test_create_requires_bioquimico_o_administrador(
    client: TestClient, usuario_factory
):
    profesor = usuario_factory(roles=("profesor",))
    token = _token(client, profesor.correo_electronico)
    cuerpo = {
        "dni": "12345678",
        "nombre": "Ana",
        "apellido": "Perez",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "123456",
    }

    sin_token = client.post(PACIENTES_URL, json=cuerpo)
    otro_rol = client.post(PACIENTES_URL, json=cuerpo, headers=_headers(token))

    assert sin_token.status_code == 401
    assert otro_rol.status_code == 403
    assert otro_rol.json()["detail"] == "Permisos insuficientes"


def test_baja_requires_administrador(client: TestClient, db: Session, usuario_factory):
    paciente = _paciente(db)
    bioquimico = usuario_factory(roles=("bioquimico",))
    token = _token(client, bioquimico.correo_electronico)

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "No corresponde"},
        headers=_headers(token),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Permisos insuficientes"


# ---------------------------------------------------------------------------
# Alta (UCE-REC-16)
# ---------------------------------------------------------------------------


def test_create_persists_and_derives_numero_registro(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))

    response = client.post(
        PACIENTES_URL,
        json={
            "dni": "12.345.678",
            "nombre": "Ana",
            "apellido": "Perez",
            "fecha_nacimiento": "1990-01-01",
            "telefono": "+54 9 11 1234-5678",
            "correo_electronico": "ANA@Sigma.test",
            "domicilio": "Av. Siempre Viva 123",
            "obra_social": "OSDE",
        },
        headers=_headers(token),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["dni"] == "12345678"
    assert payload["nombre"] == "Ana"
    assert payload["correo_electronico"] == "ana@sigma.test"
    assert payload["estado"] == "activo"
    assert payload["nivel_registro"] == "completo"
    # A1: PAC- + first 8 hex of the row UUID, uppercase.
    esperado = "PAC-" + payload["id"].replace("-", "")[:8].upper()
    assert payload["numero_registro"] == esperado
    assert re.fullmatch(r"PAC-[0-9A-F]{8}", payload["numero_registro"])
    assert "sexo" not in payload

    paciente = db.get(Paciente, payload["id"])
    assert paciente is not None
    assert paciente.dni == "12345678"
    assert _auditorias_of(db, paciente.id) == []  # A7: el alta no audita


def test_create_duplicate_dni_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    _paciente(db, dni="12345678")

    response = client.post(
        PACIENTES_URL,
        json={
            "dni": "12.345.678",
            "nombre": "Otra",
            "apellido": "Persona",
            "fecha_nacimiento": "1980-05-05",
            "telefono": "123456",
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El paciente ya se encuentra registrado",
        "campo": "dni",
    }
    assert db.query(Paciente).count() == 1


def test_create_invalid_dni_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    base = {
        "nombre": "Ana",
        "apellido": "Perez",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "123456",
    }

    for dni in ("12345", "123456789", "12-345-678", "abcdefgh"):
        response = client.post(
            PACIENTES_URL,
            json={**base, "dni": dni},
            headers=_headers(token),
        )
        assert response.status_code == 400, (dni, response.text)
        assert response.json() == {
            "detail": "El DNI debe tener 7 u 8 dígitos",
            "campo": "dni",
        }
    assert db.query(Paciente).count() == 0


def test_create_invalid_telefono_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    base = {
        "dni": "12345678",
        "nombre": "Ana",
        "apellido": "Perez",
        "fecha_nacimiento": "1990-01-01",
    }

    for telefono, detalle in (
        ("12", "El teléfono debe tener entre 6 y 20 caracteres"),
        ("abc123", "El teléfono sólo admite dígitos, espacios, +, -, ( y )"),
    ):
        response = client.post(
            PACIENTES_URL,
            json={**base, "telefono": telefono},
            headers=_headers(token),
        )
        assert response.status_code == 400, (telefono, response.text)
        assert response.json() == {"detail": detalle, "campo": "telefono"}
    assert db.query(Paciente).count() == 0


def test_create_invalid_correo_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))

    response = client.post(
        PACIENTES_URL,
        json={
            "dni": "12345678",
            "nombre": "Ana",
            "apellido": "Perez",
            "fecha_nacimiento": "1990-01-01",
            "telefono": "123456",
            "correo_electronico": "no-es-un-correo",
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El correo electrónico no tiene un formato válido",
        "campo": "correo_electronico",
    }
    assert db.query(Paciente).count() == 0


def test_create_future_fecha_nacimiento_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    manana = date.today() + timedelta(days=1)

    response = client.post(
        PACIENTES_URL,
        json={
            "dni": "12345678",
            "nombre": "Ana",
            "apellido": "Perez",
            "fecha_nacimiento": manana.isoformat(),
            "telefono": "123456",
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "La fecha de nacimiento no puede ser futura",
        "campo": "fecha_nacimiento",
    }
    assert db.query(Paciente).count() == 0


def test_create_blank_obligatorio_is_rejected_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    base = {
        "dni": "12345678",
        "nombre": "Ana",
        "apellido": "Perez",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "123456",
    }

    for campo, detalle in (
        ("nombre", "El nombre no puede estar vacío"),
        ("apellido", "El apellido no puede estar vacío"),
    ):
        response = client.post(
            PACIENTES_URL,
            json={**base, campo: "   "},
            headers=_headers(token),
        )
        assert response.status_code == 400, (campo, response.text)
        assert response.json() == {"detail": detalle, "campo": campo}
    assert db.query(Paciente).count() == 0


# ---------------------------------------------------------------------------
# Listado (UCE-REC-18, S-01)
# ---------------------------------------------------------------------------


def test_list_returns_pagination_envelope(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    _paciente(db, dni="11111111", apellido="Gonzalez")
    _paciente(db, dni="22222222", apellido="Alvarez")

    response = client.get(PACIENTES_URL, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["limit"] == 20
    assert payload["offset"] == 0
    assert [item["apellido"] for item in payload["items"]] == ["Alvarez", "Gonzalez"]
    assert "sexo" not in payload["items"][0]


def test_list_filters_by_estado(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    _paciente(db, dni="11111111", estado="inactivo")
    _paciente(db, dni="22222222", estado="activo")

    response = client.get(
        PACIENTES_URL, params={"estado": "inactivo"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["dni"] == "11111111"


def test_list_filters_by_dni_exact(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    _paciente(db, dni="11111111")
    _paciente(db, dni="22222222")

    response = client.get(
        PACIENTES_URL, params={"dni": "22222222"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["dni"] == "22222222"


def test_list_filters_by_dni_with_separators(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    encontrado = _paciente(db, dni="30123456")
    _paciente(db, dni="22222222")

    response = client.get(
        PACIENTES_URL, params={"dni": "30.123.456"}, headers=_headers(token)
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == str(encontrado.id)


def test_list_searches_by_q_partial(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    encontrado = _paciente(db, dni="11111111", apellido="Gonzalez")
    _paciente(db, dni="22222222", apellido="Alvarez")

    response = client.get(PACIENTES_URL, params={"q": "gonz"}, headers=_headers(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == str(encontrado.id)


def test_list_clamps_limit_to_100(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))

    response = client.get(PACIENTES_URL, params={"limit": 500}, headers=_headers(token))

    assert response.status_code == 200
    assert response.json()["limit"] == 100


# ---------------------------------------------------------------------------
# Detalle (UCE-REC-18)
# ---------------------------------------------------------------------------


def test_get_patient_returns_patient(client: TestClient, db: Session, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    paciente = _paciente(db, dni="11111111")

    response = client.get(f"{PACIENTES_URL}/{paciente.id}", headers=_headers(token))

    assert response.status_code == 200
    assert response.json()["id"] == str(paciente.id)
    assert response.json()["dni"] == "11111111"


def test_get_unknown_patient_returns_404(client: TestClient, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))

    response = client.get(
        f"{PACIENTES_URL}/00000000-0000-0000-0000-000000000000",
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Paciente no encontrado"


# ---------------------------------------------------------------------------
# Modificación (UCE-REC-17)
# ---------------------------------------------------------------------------


def test_update_changes_fields_and_audits_each(
    client: TestClient, db: Session, usuario_factory
):
    token, actor = _rol_token(client, usuario_factory, ("bioquimico",))
    paciente = _paciente(db, dni="11111111")

    response = client.patch(
        f"{PACIENTES_URL}/{paciente.id}",
        json={"nombre": "Roberto", "telefono": "999888"},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["nombre"] == "Roberto"
    assert response.json()["telefono"] == "999888"

    db.refresh(paciente)
    assert paciente.nombre == "Roberto"

    auditorias = _auditorias_of(db, paciente.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "modificar"
    assert auditorias[0].modulo == "pacientes"
    assert auditorias[0].usuario_id == actor.id

    cambios = {
        c.campo: (c.valor_anterior, c.valor_nuevo)
        for c in _cambios_of(db, auditorias[0].id)
    }
    assert cambios["nombre"] == ("Ana", "Roberto")
    assert cambios["telefono"] == ("+54 9 11 1234-5678", "999888")


def test_update_rejects_duplicate_dni_with_field(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    _paciente(db, dni="11111111")
    otro = _paciente(db, dni="22222222")

    response = client.patch(
        f"{PACIENTES_URL}/{otro.id}",
        json={"dni": "11111111"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El DNI ingresado ya corresponde a otro paciente",
        "campo": "dni",
    }


def test_update_without_fields_is_rejected(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    paciente = _paciente(db)

    response = client.patch(
        f"{PACIENTES_URL}/{paciente.id}", json={}, headers=_headers(token)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No se enviaron campos para modificar"


def test_update_unknown_patient_returns_404(client: TestClient, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))

    response = client.patch(
        f"{PACIENTES_URL}/00000000-0000-0000-0000-000000000000",
        json={"nombre": "Roberto"},
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Paciente no encontrado"


def test_update_rejects_before_apply_preserves_row_state(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("bioquimico",))
    paciente = _paciente(db, dni="11111111")
    nombre_original = paciente.nombre

    response = client.patch(
        f"{PACIENTES_URL}/{paciente.id}",
        json={"nombre": "NuevoNombre", "telefono": "abc"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    db.refresh(paciente)
    assert paciente.nombre == nombre_original
    assert db.query(Auditoria).filter_by(entidad_id=paciente.id).count() == 0


def test_update_fecha_nacimiento_blocked_when_has_analisis(
    client: TestClient, db: Session, usuario_factory
):
    token, actor = _rol_token(client, usuario_factory, ("bioquimico",))
    paciente = _paciente(db, dni="11111111")

    profesional = Profesional(usuario_id=actor.id, matricula="MP-0001")
    db.add(profesional)
    tipo_analisis = TipoAnalisis(nombre="Micológico directo")
    db.add(tipo_analisis)
    tipo_muestra = TipoMuestra(nombre="Uña")
    db.add(tipo_muestra)
    db.flush()
    ficha = FichaClinica(paciente_id=paciente.id, profesional_id=profesional.id)
    db.add(ficha)
    db.flush()
    muestra = Muestra(
        paciente_id=paciente.id,
        tipo_muestra_id=tipo_muestra.id,
        usuario_id=actor.id,
    )
    db.add(muestra)
    db.flush()
    db.add(
        AnalisisMicologico(
            ficha_clinica_id=ficha.id,
            tipo_analisis_id=tipo_analisis.id,
            muestra_id=muestra.id,
            profesional_responsable_id=profesional.id,
        )
    )
    db.flush()

    response = client.patch(
        f"{PACIENTES_URL}/{paciente.id}",
        json={"fecha_nacimiento": "1985-06-15"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "No se puede modificar la fecha de nacimiento de un paciente "
        "con análisis registrados",
        "campo": "fecha_nacimiento",
    }


# ---------------------------------------------------------------------------
# Baja lógica (UCE-REC-19)
# ---------------------------------------------------------------------------


def test_baja_sets_inactive_and_audits_motivo(
    client: TestClient, db: Session, usuario_factory
):
    token, actor = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111")

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "Traslado a otra ciudad"},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "inactivo"

    existe = db.get(Paciente, paciente.id)
    assert existe is not None
    assert existe.estado == "inactivo"

    auditorias = _auditorias_of(db, paciente.id)
    assert len(auditorias) == 1
    assert auditorias[0].accion == "modificar"
    assert auditorias[0].usuario_id == actor.id
    cambios = [
        (c.campo, c.valor_anterior, c.valor_nuevo)
        for c in _cambios_of(db, auditorias[0].id)
    ]
    assert cambios == [("motivo_baja", None, "Traslado a otra ciudad")]


def test_baja_with_future_turno_is_rejected(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111")
    db.add(
        Turno(
            paciente_id=paciente.id,
            fecha_hora=datetime.now(UTC) + timedelta(days=1),
            telefono_contacto="123456",
            estado="confirmado",
        )
    )
    db.flush()

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "Ya no"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El paciente tiene turnos vigentes; cancelalos antes de desactivarlo"
    }
    db.refresh(paciente)
    assert paciente.estado == "activo"


def test_baja_past_turno_does_not_block(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111")
    db.add(
        Turno(
            paciente_id=paciente.id,
            fecha_hora=datetime.now(UTC) - timedelta(days=1),
            telefono_contacto="123456",
            estado="confirmado",
        )
    )
    db.flush()

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "Ya no"},
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "inactivo"


def test_baja_already_inactive_is_rejected(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111", estado="inactivo")

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "Otra vez"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "El paciente ya está inactivo"}


def test_baja_empty_motivo_is_rejected(
    client: TestClient, db: Session, usuario_factory
):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))
    paciente = _paciente(db, dni="11111111")

    response = client.post(
        f"{PACIENTES_URL}/{paciente.id}/baja",
        json={"motivo": "   "},
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "El motivo de la baja no puede estar vacío",
        "campo": "motivo",
    }
    db.refresh(paciente)
    assert paciente.estado == "activo"


def test_baja_unknown_patient_returns_404(client: TestClient, usuario_factory):
    token, _ = _rol_token(client, usuario_factory, ("administrador",))

    response = client.post(
        f"{PACIENTES_URL}/00000000-0000-0000-0000-000000000000/baja",
        json={"motivo": "No existe"},
        headers=_headers(token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Paciente no encontrado"
