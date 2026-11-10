"""ORM models package.

Importing this package registers every table on ``Base.metadata``.
Modules are imported in dependency order for readability; SQLAlchemy resolves
foreign keys by table name, so the order is not a correctness requirement.
"""

from __future__ import annotations

from app.models import access, agenda, audit, catalogs, clinical, equipment, inventory, reports, waste

__all__ = [
    "access",
    "agenda",
    "audit",
    "catalogs",
    "clinical",
    "equipment",
    "inventory",
    "reports",
    "waste",
]
