"""Wait-list queries and serialization (UCE-REC-28/29).

The listing resolves each entry's patient fields in one query (the same shape
as ``roles_por_usuario``), so serializing a page of N entries costs N + 1
queries instead of N + N.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agenda import ListaEspera
from app.models.clinical import Paciente
from app.schemas.lista_espera import ListaEsperaRead


def _datos_pacientes(
    db: Session, paciente_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, tuple[str, str, str]]:
    """Return ``{paciente_id: (nombre, apellido, dni)}`` in one query."""
    ids = list(dict.fromkeys(paciente_ids))
    if not ids:
        return {}
    statement = select(
        Paciente.id, Paciente.nombre, Paciente.apellido, Paciente.dni
    ).where(Paciente.id.in_(ids))
    return {
        paciente_id: (nombre, apellido, dni)
        for paciente_id, nombre, apellido, dni in db.execute(statement).all()
    }


def serializar_entradas(
    db: Session, entradas: Sequence[ListaEspera] | Iterable[ListaEspera]
) -> list[ListaEsperaRead]:
    """Build the API representation of several wait-list entries."""
    entradas = list(entradas)
    pacientes = _datos_pacientes(db, [entrada.paciente_id for entrada in entradas])
    resultado: list[ListaEsperaRead] = []
    for entrada in entradas:
        nombre, apellido, dni = pacientes.get(entrada.paciente_id, ("", "", ""))
        resultado.append(
            ListaEsperaRead(
                id=entrada.id,
                paciente_id=entrada.paciente_id,
                paciente_nombre=nombre,
                paciente_apellido=apellido,
                paciente_dni=dni,
                tipo_analisis_id=entrada.tipo_analisis_id,
                fecha_solicitud=entrada.fecha_solicitud,
                estado=entrada.estado,
                observaciones=entrada.observaciones,
            )
        )
    return resultado


def serializar_entrada(db: Session, entrada: ListaEspera) -> ListaEsperaRead:
    """Build the API representation of one wait-list entry."""
    return serializar_entradas(db, [entrada])[0]
