"""seed closed role catalog

Revision ID: c1bf7c1dd493
Revises: 8f5956edf3e4
Create Date: 2026-11-10 19:21:34.677209
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'c1bf7c1dd493'
down_revision: str | None = '8f5956edf3e4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Fixed UUIDs so downgrade() can remove them precisely.
_ROLES = [
    {
        "id": uuid.UUID("a1b2c3d4-0001-4000-8000-000000000001"),
        "codigo": "bioquimico",
        "nombre": "Bioquímico",
        "descripcion": (
            "Realiza análisis micológicos clínicos, registra muestras, "
            "emite informes de laboratorio y valida resultados diagnósticos."
        ),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0002-4000-8000-000000000002"),
        "codigo": "profesor",
        "nombre": "Profesor",
        "descripcion": (
            "Supervisa prácticas académicas, coordina actividades docentes "
            "y hace seguimiento de alumnos en el laboratorio de micología."
        ),
    },
    {
        "id": uuid.UUID("a1b2c3d4-0003-4000-8000-000000000003"),
        "codigo": "administrador",
        "nombre": "Administrador",
        "descripcion": (
            "Gestiona catálogos del sistema, administra usuarios y roles, "
            "y configura parámetros operativos del sistema SIGEMI."
        ),
    },
]

_CODIGOS = [r["codigo"] for r in _ROLES]


def upgrade() -> None:
    conn = op.get_bind()
    # Idempotent-safe: only insert roles not already present.
    for role in _ROLES:
        conn.execute(
            sa.text(
                "INSERT INTO rol (id, codigo, nombre, descripcion) "
                "VALUES (:id, :codigo, :nombre, :descripcion) "
                "ON CONFLICT (codigo) DO NOTHING"
            ),
            {
                "id": role["id"],
                "codigo": role["codigo"],
                "nombre": role["nombre"],
                "descripcion": role["descripcion"],
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM rol WHERE codigo = ANY(:codigos)"),
        {"codigos": _CODIGOS},
    )
