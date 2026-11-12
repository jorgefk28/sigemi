"""Structural tests for the persistence layer.

Complements ``test_schema_fidelity.py`` (the level-3 contract) with checks that
only make sense on the compiled schema: PostgreSQL DDL generation and foreign
key resolution. No live database is required.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable
from test_schema_fidelity import LEVEL3_COLUMNS

import app.models  # noqa: F401  (registers every table)
from app.db.base import Base

EXPECTED_TABLES = set(LEVEL3_COLUMNS)


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
