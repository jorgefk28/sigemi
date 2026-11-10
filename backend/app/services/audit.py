"""Audit service — append-only write helper.

This module exposes a single public function ``registrar_auditoria`` that
creates one ``Auditoria`` row and optional ``CambioAuditoria`` detail rows.

**Append-only contract**: this module must never expose any update or delete
function.  Audit records are immutable after creation by design; altering or
removing them would destroy the integrity of the audit trail.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.audit import Auditoria, CambioAuditoria
from app.models.enums import AccionAuditoria


def registrar_auditoria(
    db: Session,
    *,
    usuario_id: uuid.UUID,
    modulo: str,
    accion: str | AccionAuditoria,
    entidad_afectada: str,
    entidad_id: uuid.UUID,
    direccion_ip: str | None = None,
    cambios: Iterable[tuple[str, str | None, str | None]] | None = None,
) -> Auditoria:
    """Create one ``Auditoria`` row and zero or more ``CambioAuditoria`` rows.

    Parameters
    ----------
    db:
        The active SQLAlchemy session.  The caller owns the transaction;
        this function only calls ``flush()`` — never ``commit()``.
    usuario_id:
        UUID of the user who triggered the action.
    modulo:
        Application module that produced the event (e.g. ``"analisis"``).
    accion:
        The action performed.  Accepts an ``AccionAuditoria`` member **or**
        its string value.  When an enum member is passed the stored value is
        ``accion.value`` (e.g. ``"crear"``).
    entidad_afectada:
        Name of the affected entity / table (e.g. ``"AnalisisMicologico"``).
    entidad_id:
        UUID of the specific row that was affected.  There is intentionally no
        FK constraint — the reference is polymorphic.
    direccion_ip:
        Optional originating IP address of the request.
    cambios:
        Optional iterable of ``(campo, valor_anterior, valor_nuevo)`` triples.
        Each triple produces one ``CambioAuditoria`` row.  Either value may be
        ``None`` (e.g. when creating a record ``valor_anterior`` is ``None``).

    Returns
    -------
    Auditoria
        The flushed (but not committed) audit record.

    Notes
    -----
    **Append-only**: this module exposes no update or delete function.
    """
    # Normalise accion to its string value regardless of whether an enum
    # member or a bare string was supplied.
    if isinstance(accion, AccionAuditoria):
        accion_str: str = accion.value
    else:
        accion_str = accion

    auditoria = Auditoria(
        usuario_id=usuario_id,
        modulo=modulo,
        accion=accion_str,
        entidad_afectada=entidad_afectada,
        entidad_id=entidad_id,
        direccion_ip=direccion_ip,
    )
    db.add(auditoria)
    db.flush()  # Obtain auditoria.id before inserting detail rows.

    if cambios is not None:
        for campo, valor_anterior, valor_nuevo in cambios:
            db.add(
                CambioAuditoria(
                    auditoria_id=auditoria.id,
                    campo=campo,
                    valor_anterior=valor_anterior,
                    valor_nuevo=valor_nuevo,
                )
            )
        db.flush()

    return auditoria
