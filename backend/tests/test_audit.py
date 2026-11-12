"""Tests for app.services.audit — append-only audit service."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.audit import CambioAuditoria
from app.models.enums import AccionAuditoria
from app.services import audit as audit_module
from app.services.audit import registrar_auditoria

# ---------------------------------------------------------------------------
# 1. registrar_auditoria without cambios creates one Auditoria row
# ---------------------------------------------------------------------------


def test_registrar_auditoria_sin_cambios(db: Session, usuario_factory):
    """One Auditoria is created; fecha_hora is non-null; no CambioAuditoria."""
    usuario = usuario_factory(roles=("bioquimico",))
    entidad_id = uuid.uuid4()

    auditoria = registrar_auditoria(
        db,
        usuario_id=usuario.id,
        modulo="analisis",
        accion="crear",
        entidad_afectada="AnalisisMicologico",
        entidad_id=entidad_id,
        direccion_ip="127.0.0.1",
    )

    assert auditoria.id is not None
    assert auditoria.modulo == "analisis"
    assert auditoria.accion == "crear"
    assert auditoria.entidad_afectada == "AnalisisMicologico"
    assert auditoria.entidad_id == entidad_id
    assert auditoria.fecha_hora is not None

    # Verify no CambioAuditoria rows were created
    cambios = db.query(CambioAuditoria).filter_by(auditoria_id=auditoria.id).all()
    assert cambios == []


# ---------------------------------------------------------------------------
# 2. With two cambios, two CambioAuditoria rows are created and linked
# ---------------------------------------------------------------------------


def test_registrar_auditoria_con_cambios(db: Session, usuario_factory):
    """Two CambioAuditoria rows are created, linked to the Auditoria."""
    usuario = usuario_factory(roles=("bioquimico",))
    entidad_id = uuid.uuid4()

    auditoria = registrar_auditoria(
        db,
        usuario_id=usuario.id,
        modulo="paciente",
        accion="modificar",
        entidad_afectada="Paciente",
        entidad_id=entidad_id,
        cambios=[
            ("nombre", "Juan", "Juan Carlos"),
            ("telefono", None, "555-1234"),
        ],
    )

    cambios = (
        db.query(CambioAuditoria)
        .filter_by(auditoria_id=auditoria.id)
        .order_by(CambioAuditoria.campo)
        .all()
    )
    assert len(cambios) == 2

    por_campo = {c.campo: c for c in cambios}

    # First change: nombre
    assert por_campo["nombre"].valor_anterior == "Juan"
    assert por_campo["nombre"].valor_nuevo == "Juan Carlos"

    # Second change: telefono — valor_anterior is None
    assert por_campo["telefono"].valor_anterior is None
    assert por_campo["telefono"].valor_nuevo == "555-1234"


# ---------------------------------------------------------------------------
# 3. Passing AccionAuditoria.CREAR stores the string "crear"
# ---------------------------------------------------------------------------


def test_accion_enum_almacena_valor_string(db: Session, usuario_factory):
    """When an AccionAuditoria enum member is passed, its .value is stored."""
    usuario = usuario_factory(roles=("administrador",))

    auditoria = registrar_auditoria(
        db,
        usuario_id=usuario.id,
        modulo="usuario",
        accion=AccionAuditoria.CREAR,
        entidad_afectada="Usuario",
        entidad_id=uuid.uuid4(),
    )

    assert auditoria.accion == "crear"


# ---------------------------------------------------------------------------
# 4. Append-only guard — no update or delete attribute exposed
# ---------------------------------------------------------------------------


def test_no_update_or_delete_en_modulo():
    """app.services.audit must expose no attribute whose name starts with
    'update' or 'delete'."""
    forbidden = [
        name
        for name in dir(audit_module)
        if name.startswith("update") or name.startswith("delete")
    ]
    assert forbidden == [], (
        f"audit module must be append-only, but exposes: {forbidden}"
    )
