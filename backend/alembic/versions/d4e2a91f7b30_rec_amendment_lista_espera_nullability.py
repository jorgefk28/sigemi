"""rec amendment: lista_espera and nullability

Revision ID: d4e2a91f7b30
Revises: c1bf7c1dd493
Create Date: 2026-11-16 19:05:00.000000

Materialises the level-3 amendment authorised by the repository owner and
recorded in L2 of ``odd/tasks/04-recepcion-turnos.md`` (spec S11):

- new table ``lista_espera`` with indexes on ``estado`` and ``fecha_solicitud``;
- ``turno`` gains ``tipo_analisis_id`` (FK), ``serie_id`` (plain UUID, no FK) and
  ``motivo_inasistencia``; ``profesional_id`` and ``espacio_id`` become nullable
  because no use case assigns them when the appointment is created;
- ``indicacion_medica.tipo_analisis_id`` becomes required (level 1, UCE-REC-10);
- ``paciente`` gains the requiredness rule: nine columns NOT NULL, four
  demographics left optional.

Every ``SET NOT NULL`` is preceded by :func:`guard_no_nulls`. A ``SET NOT NULL``
that fails halfway leaves the migration half applied, so the revision refuses to
start when stored rows still hold NULL for the column it is about to tighten.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "d4e2a91f7b30"
down_revision: str | None = "c1bf7c1dd493"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class MigrationGuardError(RuntimeError):
    """Raised when stored data blocks a ``NOT NULL`` tightening."""


# Columns this revision leaves NOT NULL. The downgrade relaxes the same set, so
# one declaration keeps both directions in step.
NOT_NULL_TARGETS: tuple[tuple[str, str], ...] = (
    ("paciente", "numero_registro"),
    ("paciente", "dni"),
    ("paciente", "nombre"),
    ("paciente", "apellido"),
    ("paciente", "fecha_nacimiento"),
    ("paciente", "telefono"),
    ("paciente", "estado"),
    ("paciente", "fecha_ingreso"),
    ("paciente", "nivel_registro"),
    ("indicacion_medica", "tipo_analisis_id"),
)

# ``alter_column`` needs the current type; it is not inferred from the models.
_COLUMN_TYPES: dict[tuple[str, str], sa.types.TypeEngine] = {
    ("paciente", "numero_registro"): sa.String(),
    ("paciente", "dni"): sa.String(),
    ("paciente", "nombre"): sa.String(),
    ("paciente", "apellido"): sa.String(),
    ("paciente", "fecha_nacimiento"): sa.Date(),
    ("paciente", "telefono"): sa.String(),
    ("paciente", "estado"): sa.String(),
    ("paciente", "fecha_ingreso"): sa.DateTime(timezone=True),
    ("paciente", "nivel_registro"): sa.String(),
    ("indicacion_medica", "tipo_analisis_id"): sa.UUID(),
}

# Columns whose ``NOT NULL`` the downgrade restores (they were required before).
_DOWNGRADE_REQUIRED_TARGETS: tuple[tuple[str, str], ...] = (
    ("turno", "profesional_id"),
    ("turno", "espacio_id"),
)

_TURNO_FK = "fk_turno_tipo_analisis_id_tipo_analisis"


def guard_no_nulls(bind: sa.engine.Connection, table: str, column: str) -> None:
    """Abort when ``table.column`` still holds NULL in stored rows.

    ``table`` and ``column`` are module constants, never caller input, so the
    interpolated statement carries no injection surface.
    """

    blocking = bind.execute(
        sa.text(f"SELECT count(*) FROM {table} WHERE {column} IS NULL")
    ).scalar_one()
    if blocking:
        raise MigrationGuardError(
            f"Cannot set NOT NULL on {table}.{column}: {blocking} row(s) still "
            "hold NULL. Backfill or delete those rows, then re-run the migration."
        )


def upgrade() -> None:
    op.create_table(
        "lista_espera",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("paciente_id", sa.UUID(), nullable=False),
        sa.Column("tipo_analisis_id", sa.UUID(), nullable=True),
        sa.Column("fecha_solicitud", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["paciente_id"],
            ["paciente.id"],
            name=op.f("fk_lista_espera_paciente_id_paciente"),
        ),
        sa.ForeignKeyConstraint(
            ["tipo_analisis_id"],
            ["tipo_analisis.id"],
            name=op.f("fk_lista_espera_tipo_analisis_id_tipo_analisis"),
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_lista_espera_usuario_id_usuario"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lista_espera")),
    )
    op.create_index(
        "ix_lista_espera_estado", "lista_espera", ["estado"], unique=False
    )
    op.create_index(
        "ix_lista_espera_fecha_solicitud",
        "lista_espera",
        ["fecha_solicitud"],
        unique=False,
    )

    op.add_column("turno", sa.Column("tipo_analisis_id", sa.UUID(), nullable=True))
    op.add_column("turno", sa.Column("serie_id", sa.UUID(), nullable=True))
    op.add_column(
        "turno", sa.Column("motivo_inasistencia", sa.String(), nullable=True)
    )
    op.create_foreign_key(
        _TURNO_FK, "turno", "tipo_analisis", ["tipo_analisis_id"], ["id"]
    )

    op.alter_column("turno", "profesional_id", existing_type=sa.UUID(), nullable=True)
    op.alter_column("turno", "espacio_id", existing_type=sa.UUID(), nullable=True)

    bind = op.get_bind()
    # Every guard runs before the first ALTER, so a blocked migration refuses to
    # start instead of stopping halfway through the NOT NULL tightening.
    for table, column in NOT_NULL_TARGETS:
        guard_no_nulls(bind, table, column)
    for table, column in NOT_NULL_TARGETS:
        op.alter_column(
            table,
            column,
            existing_type=_COLUMN_TYPES[(table, column)],
            nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    # Restoring the pre-amendment requiredness can fail for the same reason the
    # upgrade can: rows booked without a professional or a space.
    for table, column in _DOWNGRADE_REQUIRED_TARGETS:
        guard_no_nulls(bind, table, column)

    for table, column in reversed(NOT_NULL_TARGETS):
        op.alter_column(
            table,
            column,
            existing_type=_COLUMN_TYPES[(table, column)],
            nullable=True,
        )

    for table, column in _DOWNGRADE_REQUIRED_TARGETS:
        op.alter_column(table, column, existing_type=sa.UUID(), nullable=False)

    op.drop_constraint(_TURNO_FK, "turno", type_="foreignkey")
    op.drop_column("turno", "motivo_inasistencia")
    op.drop_column("turno", "serie_id")
    op.drop_column("turno", "tipo_analisis_id")

    op.drop_index("ix_lista_espera_fecha_solicitud", table_name="lista_espera")
    op.drop_index("ix_lista_espera_estado", table_name="lista_espera")
    op.drop_table("lista_espera")
