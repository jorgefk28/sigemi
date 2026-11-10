"""Structural tests for the persistence layer.

They do not need a live database: every table definition is compiled with the
PostgreSQL dialect, which is enough to prove that the ORM metadata produces
valid DDL for the target engine and that every foreign key resolves.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db.base import Base
import app.models  # noqa: F401  (registers every table)

# Every table declared by `Diagramas/modelo_esquema_bd_sigemi.md` (level 3).
EXPECTED_TABLES = {
    # Nucleo clinico
    "paciente",
    "ficha_clinica",
    "dato_clinico",
    "version_ficha_clinica",
    "muestra",
    "analisis_micologico",
    "hallazgo_analisis",
    "version_analisis",
    "informe_resultados",
    "otp",
    # Personas y acceso
    "usuario",
    "rol",
    "usuario_rol",
    "profesional",
    # Agenda y atencion
    "turno",
    "indicacion_medica",
    "espacio_atencion",
    "grupo_espacio",
    "tipo_bloqueo",
    "configuracion_agenda",
    "periodo_inhabilitado",
    "bloqueo_agenda",
    "disponibilidad_profesional",
    "ausencia_profesional",
    "oferta_reagendacion",
    # Catalogos de analisis
    "tipo_analisis",
    "tipo_muestra",
    "tipo_analisis_tipo_muestra",
    # Inventario
    "categoria_insumo",
    "ubicacion_almacenamiento",
    "insumo",
    "lote",
    "movimiento_inventario",
    # Residuos
    "categoria_residuo",
    "instruccion_almacenamiento",
    "residuo_quimico",
    "disposicion_final",
    "reporte_residuos",
    "reporte_inventario",
    # Equipos
    "tipo_equipo",
    "equipo",
    "mantenimiento_equipo",
    # Transversales
    "auditoria",
    "cambio_auditoria",
    "reporte",
}


def test_every_level_3_table_is_modeled() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_no_extra_tables() -> None:
    assert set(Base.metadata.tables) - EXPECTED_TABLES == set()


@pytest.mark.parametrize("table_name", sorted(EXPECTED_TABLES))
def test_table_has_uuid_primary_key_named_id(table_name: str) -> None:
    table = Base.metadata.tables[table_name]
    primary_key = list(table.primary_key.columns)
    assert [column.name for column in primary_key] == ["id"], table_name
    column = primary_key[0]
    assert isinstance(column.type, postgresql.UUID), table_name
    assert column.default is not None, f"{table_name}.id must default to uuid4"
    assert getattr(column.default.arg, "__name__", "") == "uuid4", table_name
    # The default must produce a UUID when the column is not supplied.
    generated = column.default.arg(None)
    assert isinstance(generated, uuid.UUID), table_name


@pytest.mark.parametrize("table_name", sorted(EXPECTED_TABLES))
def test_table_compiles_to_postgres_ddl(table_name: str) -> None:
    table = Base.metadata.tables[table_name]
    ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    assert f"CREATE TABLE {table_name}" in ddl
    for index in table.indexes:
        str(CreateIndex(index).compile(dialect=postgresql.dialect()))


def test_foreign_keys_resolve_to_existing_tables() -> None:
    """`sorted_tables` raises when a FK points at a missing table."""

    ordered = Base.metadata.sorted_tables
    assert len(ordered) == len(EXPECTED_TABLES)


def test_sorted_tables_cover_every_expected_table() -> None:
    """Dependency ordering covers the whole schema (no orphan/cyclic table)."""

    names = {table.name for table in Base.metadata.sorted_tables}
    assert names == EXPECTED_TABLES
