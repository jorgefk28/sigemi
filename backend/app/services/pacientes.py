"""Patient administration rules (UCE-REC-16/17/18/19, S-01).

The rules live outside the HTTP layer so the endpoints stay thin.  Pure
validation and the ``numero_registro`` derivation are here; the endpoint layer
adds the DB-adjacent checks (dni uniqueness) and the audit trail, mirroring
``app/api/v1/usuarios.py``.

Every rejection carries a Spanish, user-facing ``detail`` and, when the message
belongs to a request field, the ``campo`` it should be attached to
(``AGENTS.md``, "Response contract").  The shared e-mail shape rule is reused
from ``app.services.usuarios`` so it has one source of truth (decision A4).
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agenda import Turno
from app.models.clinical import AnalisisMicologico, Muestra, Paciente
from app.models.enums import TurnoEstado
from app.schemas.pacientes import PacienteRead
from app.services.usuarios import ReglaDeUsuario, validar_correo


class ReglaDePaciente(Exception):
    """A rejected operation with a Spanish, user-facing message."""

    def __init__(self, detail: str, campo: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.campo = campo


#: A2: after removing dots and spaces, the DNI must be 7-8 digits.
PATRON_DNI = re.compile(r"\d{7,8}")
#: A3: 6-20 characters drawn only from the allowed set.
PATRON_TELEFONO = re.compile(r"^[0-9\s+\-()]+$")


def normalizar_texto(campo: str, etiqueta: str, valor: str) -> str:
    """Trim *valor* and reject a blank result."""
    normalizado = valor.strip()
    if not normalizado:
        raise ReglaDePaciente(f"{etiqueta} no puede estar vacío", campo)
    return normalizado


def normalizar_optional(valor: str | None) -> str | None:
    """Trim an optional field; a blank input is treated as absent."""
    if valor is None:
        return None
    normalizado = valor.strip()
    return normalizado or None


def limpiar_dni(valor: str) -> str:
    """Strip the separators a DNI is typed with, without validating (A2).

    Used by the listing filter so ``30.123.456`` finds the patient stored as
    ``30123456``: both sides of the comparison are the normalized value.
    """
    return re.sub(r"[.\s]", "", valor)


def normalizar_dni(valor: str) -> str:
    """Normalize a DNI and enforce the 7-8 digit rule (A2)."""
    normalizado = limpiar_dni(valor)
    if PATRON_DNI.fullmatch(normalizado) is None:
        raise ReglaDePaciente("El DNI debe tener 7 u 8 dígitos", "dni")
    return normalizado


def validar_telefono(valor: str) -> str:
    """Enforce the phone rule (A3): 6-20 chars, allowed set only."""
    normalizado = valor.strip()
    if not 6 <= len(normalizado) <= 20:
        raise ReglaDePaciente(
            "El teléfono debe tener entre 6 y 20 caracteres", "telefono"
        )
    if PATRON_TELEFONO.fullmatch(normalizado) is None:
        raise ReglaDePaciente(
            "El teléfono sólo admite dígitos, espacios, +, -, ( y )", "telefono"
        )
    return normalizado


def validar_fecha_nacimiento(fecha: date) -> None:
    """Reject a future birth date (A5)."""
    if fecha > date.today():
        raise ReglaDePaciente(
            "La fecha de nacimiento no puede ser futura", "fecha_nacimiento"
        )


def normalizar_correo(valor: str | None) -> str | None:
    """Optionally normalize and validate the e-mail (A4).

    The field is optional: a blank value is stored as ``None``.  When present,
    the format rule is ``app.services.usuarios.validar_correo``.
    """
    if valor is None:
        return None
    correo = valor.strip()
    if not correo:
        return None
    correo = correo.lower()
    try:
        validar_correo(correo)
    except ReglaDeUsuario as regla:
        raise ReglaDePaciente(regla.detail, regla.campo) from None
    return correo


def paciente_tiene_analisis(db: Session, paciente_id: uuid.UUID) -> bool:
    """Whether the patient has at least one analysis (paciente → muestra →
    análisis micológico), the A5 immutability precondition."""
    statement = (
        select(AnalisisMicologico.id)
        .join(Muestra, Muestra.id == AnalisisMicologico.muestra_id)
        .where(Muestra.paciente_id == paciente_id)
        .limit(1)
    )
    return db.scalar(statement) is not None


def tiene_turnos_vigentes(db: Session, paciente_id: uuid.UUID) -> bool:
    """Whether the patient has a future ``confirmado``/``pendiente`` turno (A10).

    ``fecha_hora`` is stored in UTC, so "today" is the current UTC day boundary
    and a turno on that day or later counts as vigente.
    """
    desde = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)
    statement = (
        select(Turno.id)
        .where(
            Turno.paciente_id == paciente_id,
            Turno.estado.in_(
                (TurnoEstado.CONFIRMADO.value, TurnoEstado.PENDIENTE.value)
            ),
            Turno.fecha_hora >= desde,
        )
        .limit(1)
    )
    return db.scalar(statement) is not None


def serializar_paciente(paciente: Paciente) -> PacienteRead:
    """Build the API representation of one patient."""
    return PacienteRead(
        id=paciente.id,
        numero_registro=paciente.numero_registro,
        dni=paciente.dni,
        nombre=paciente.nombre,
        apellido=paciente.apellido,
        fecha_nacimiento=paciente.fecha_nacimiento,
        sexo=paciente.sexo,
        domicilio=paciente.domicilio,
        telefono=paciente.telefono,
        correo_electronico=paciente.correo_electronico,
        obra_social=paciente.obra_social,
        nivel_registro=paciente.nivel_registro,
        estado=paciente.estado,
        fecha_ingreso=paciente.fecha_ingreso,
    )


def serializar_pacientes(pacientes: list[Paciente]) -> list[PacienteRead]:
    """Build the API representation of several patients."""
    return [serializar_paciente(paciente) for paciente in pacientes]
