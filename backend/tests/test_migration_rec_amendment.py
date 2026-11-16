"""Guard tests for the REC amendment migration (spec S11).

``d4e2a91f7b30`` tightens ``NOT NULL`` on nine ``paciente`` columns and on
``indicacion_medica.tipo_analisis_id``. A ``SET NOT NULL`` that fails halfway
through leaves the migration half applied, which is worse than a migration that
refuses to start, so the revision counts the blocking rows first and aborts with
a message naming the column and the count.

These tests seed the blocking row inside the ``db`` transaction (rolled back at
teardown) and assert the refusal. The revision cannot be replayed end to end
here because it is already applied to the lane database, so the guard function
it calls before every ``SET NOT NULL`` is exercised directly.
"""

from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Connection
from test_schema_fidelity import PACIENTE_REQUIRED_COLUMNS

_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "d4e2a91f7b30_rec_amendment_lista_espera_nullability.py"
)


def _migration_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "rec_amendment_migration", _MIGRATION_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _seed_paciente(connection: Connection, *, fecha_nacimiento: str | None) -> None:
    """Insert one patient row, leaving ``fecha_nacimiento`` as asked."""

    connection.execute(
        text(
            "INSERT INTO paciente (id, numero_registro, dni, nombre, apellido, "
            "telefono, nivel_registro, estado, fecha_ingreso, fecha_nacimiento) "
            "VALUES (:id, :numero_registro, :dni, 'Ada', 'Lovelace', '555-0100', "
            "'completo', 'activo', now(), :fecha_nacimiento)"
        ),
        {
            "id": uuid.uuid4(),
            "numero_registro": f"MR-{uuid.uuid4()}",
            "dni": f"DNI-{uuid.uuid4()}",
            "fecha_nacimiento": fecha_nacimiento,
        },
    )


def test_guard_refuses_to_start_when_a_row_holds_null(db) -> None:
    module = _migration_module()
    connection = db.connection()
    # The column is NOT NULL once the revision is applied; relax it inside the
    # rolled-back transaction so the blocking row can exist.
    connection.execute(
        text("ALTER TABLE paciente ALTER COLUMN fecha_nacimiento DROP NOT NULL")
    )
    _seed_paciente(connection, fecha_nacimiento=None)

    with pytest.raises(module.MigrationGuardError) as raised:
        module.guard_no_nulls(connection, "paciente", "fecha_nacimiento")

    message = str(raised.value)
    assert "paciente.fecha_nacimiento" in message
    assert "1 row(s)" in message
    # The guard only reads: the blocking row is untouched.
    still_null = connection.execute(
        text("SELECT count(*) FROM paciente WHERE fecha_nacimiento IS NULL")
    ).scalar_one()
    assert still_null == 1


def test_guard_passes_when_no_row_holds_null(db) -> None:
    module = _migration_module()
    connection = db.connection()
    connection.execute(
        text("ALTER TABLE paciente ALTER COLUMN fecha_nacimiento DROP NOT NULL")
    )
    _seed_paciente(connection, fecha_nacimiento="1990-05-04")

    module.guard_no_nulls(connection, "paciente", "fecha_nacimiento")


def test_guard_covers_every_column_the_revision_tightens() -> None:
    module = _migration_module()
    expected = {("paciente", name) for name in PACIENTE_REQUIRED_COLUMNS}
    expected.add(("indicacion_medica", "tipo_analisis_id"))
    assert set(module.NOT_NULL_TARGETS) == expected


def test_lista_espera_estado_is_a_closed_catalog() -> None:
    """The state set lives in ``enums.py``, not as a literal in the model (S11)."""
    from app.models.agenda import ListaEspera
    from app.models.enums import ListaEsperaEstado

    assert {estado.value for estado in ListaEsperaEstado} == {
        "pendiente",
        "asignado",
        "retirado",
    }
    default = ListaEspera.__table__.c.estado.default.arg
    assert default == ListaEsperaEstado.PENDIENTE.value
