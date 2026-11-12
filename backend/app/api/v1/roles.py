"""Closed role catalog endpoint (UCE-SEG-02, paso 5).

The catalog is seeded by a data migration and never managed from the API: the
Administrador picks from it, but does not create or redefine roles (level 2
§6.2, S3).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.access import Rol, Usuario
from app.schemas.access import RolList, RolRead

router = APIRouter(prefix="/roles", tags=["roles"])

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


@router.get("", response_model=RolList)
def listar_roles(
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> RolList:
    """List the closed role catalog, ordered by ``codigo``."""
    limite = min(limit, LIMITE_MAXIMO)

    total = db.scalar(select(func.count()).select_from(Rol)) or 0
    roles = list(
        db.scalars(select(Rol).order_by(Rol.codigo).limit(limite).offset(offset)).all()
    )

    return RolList(
        items=[RolRead.model_validate(rol) for rol in roles],
        total=total,
        limit=limite,
        offset=offset,
    )
