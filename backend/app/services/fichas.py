"""Business rules for the clinical record (UCE-DIAG-01, DIAG-06, DIAG-07).

Two things live here and nowhere else:

1. **The catalog of clinical fields (A-04).** No level enumerates the keys of
   ``dato_clinico``; this tuple is the declared assumption, and the API exposes
   it so the form renders from it instead of keeping a second copy. Change this
   tuple and both the backend and the screen follow.
2. **The professional of the session (A-03).** ``ficha_clinica.profesional_id``
   is NOT NULL and ``profesional`` holds a real ``matricula``, so the identity is
   resolved from the signed-in user and never accepted from the client.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access import Profesional, Usuario
from app.models.clinical import FichaClinica
from app.services.usuarios import ReglaDeUsuario

#: Declared catalog of clinical fields. ``(campo, etiqueta, obligatorio)``.
CAMPOS_CLINICOS: tuple[tuple[str, str, bool], ...] = (
    ("motivo_consulta", "Motivo de consulta", True),
    ("sintomas", "Síntomas", True),
    ("tiempo_evolucion", "Tiempo de evolución", False),
    ("antecedentes", "Antecedentes", False),
    ("tratamiento_previo", "Tratamiento previo", False),
    ("observaciones", "Observaciones", False),
)

CLAVES = tuple(campo for campo, _, _ in CAMPOS_CLINICOS)
OBLIGATORIOS = tuple(campo for campo, _, obligatorio in CAMPOS_CLINICOS if obligatorio)

#: Motivo stored in ``version_ficha_clinica``. The column is NOT NULL and
#: UCE-DIAG-07 does not ask the user for one, so a fixed description is written.
MOTIVO_VERSION = "Modificación de ficha clínica"


def resolver_profesional(db: Session, actor: Usuario) -> Profesional:
    """Return the professional profile of the signed-in user (A-03)."""
    profesional = db.scalar(
        select(Profesional).where(Profesional.usuario_id == actor.id)
    )
    if profesional is None:
        raise ReglaDeUsuario(
            "El usuario no tiene perfil profesional; pedile al administrador que lo cargue",
            "profesional",
        )
    return profesional


def validar_datos(datos: dict[str, str], *, parcial: bool) -> dict[str, str]:
    """Validate and normalize the record's data.

    ``parcial`` is the edition case: only the keys that travelled are validated,
    and the obligations are checked against the merged result by the caller.
    """
    desconocidos = [clave for clave in datos if clave not in CLAVES]
    if desconocidos:
        raise ReglaDeUsuario(
            f"Campo clínico desconocido: «{desconocidos[0]}»", desconocidos[0]
        )

    normalizados: dict[str, str] = {}
    for clave, valor in datos.items():
        if not isinstance(valor, str):
            raise ReglaDeUsuario(f"El valor de «{clave}» debe ser texto", clave)
        normalizados[clave] = valor.strip()

    if not parcial:
        for clave in OBLIGATORIOS:
            if not normalizados.get(clave):
                raise ReglaDeUsuario(
                    f"El campo «{etiqueta(clave)}» no puede estar vacío", clave
                )
    else:
        for clave, valor in normalizados.items():
            if clave in OBLIGATORIOS and not valor:
                raise ReglaDeUsuario(
                    f"El campo «{etiqueta(clave)}» no puede estar vacío", clave
                )

    return normalizados


def etiqueta(campo: str) -> str:
    """Visible label of a clinical field."""
    for clave, texto, _ in CAMPOS_CLINICOS:
        if clave == campo:
            return texto
    return campo


def serializar(
    db: Session,
    fichas: list[FichaClinica],
) -> list[dict[str, object]]:
    """Shape records with their patient, professional and data resolved."""
    if not fichas:
        return []

    from app.models.clinical import DatoClinico, Paciente

    pacientes = {
        fila.id: fila
        for fila in db.scalars(
            select(Paciente).where(
                Paciente.id.in_({ficha.paciente_id for ficha in fichas})
            )
        )
    }
    profesionales = {
        fila.id: fila
        for fila in db.scalars(
            select(Profesional).where(
                Profesional.id.in_({ficha.profesional_id for ficha in fichas})
            )
        )
    }
    usuarios = {
        fila.id: fila
        for fila in db.scalars(
            select(Usuario).where(
                Usuario.id.in_(
                    {profesional.usuario_id for profesional in profesionales.values()}
                )
            )
        )
    }
    datos: dict[uuid.UUID, dict[str, str]] = {ficha.id: {} for ficha in fichas}
    for dato in db.scalars(
        select(DatoClinico).where(
            DatoClinico.ficha_clinica_id.in_({ficha.id for ficha in fichas})
        )
    ):
        datos[dato.ficha_clinica_id][dato.campo] = dato.valor

    resultado: list[dict[str, object]] = []
    for ficha in fichas:
        paciente = pacientes.get(ficha.paciente_id)
        profesional = profesionales.get(ficha.profesional_id)
        usuario = usuarios.get(profesional.usuario_id) if profesional else None
        resultado.append(
            {
                "id": ficha.id,
                "paciente_id": ficha.paciente_id,
                "paciente_apellido": paciente.apellido if paciente else "",
                "paciente_nombre": paciente.nombre if paciente else "",
                "paciente_dni": paciente.dni if paciente else "",
                "profesional_id": ficha.profesional_id,
                "profesional_nombre": (
                    f"{usuario.nombre} {usuario.apellido}" if usuario else ""
                ),
                "fecha_consulta": ficha.fecha_consulta,
                "version_actual": ficha.version_actual,
                "estado": ficha.estado,
                "datos": datos[ficha.id],
            }
        )
    return resultado


def serializar_una(db: Session, ficha: FichaClinica) -> dict[str, object]:
    """Shape a single record."""
    return serializar(db, [ficha])[0]
