"""Report endpoints (UCE-REP-01, RF-15).

Two operations of the same generator (pattern P8): preview a few rows and export
the whole set. Only the **clinical** report is available today — the inventory
and waste reports read subsystems that have no data yet, and offering them would
produce an empty file that looks like a bug.

Both are ``bioquimico``/``administrador``: UCE-REP-01 preconditions say so.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.access import Usuario
from app.schemas.reportes import ReporteClinicoPreview, ReporteClinicoRow
from app.services.reportes import (
    COLUMNAS,
    a_csv,
    filas_clinicas,
    total_clinico,
)

router = APIRouter(prefix="/reportes", tags=["reportes"])

LIMITE_PREVIA = 10
LIMITE_MAXIMO = 100

ROLES = ("bioquimico", "administrador")

TIPOS_DISPONIBLES = ("clinico",)
TIPOS_PENDIENTES = ("inventario", "desechos")


def _verificar_tipo(tipo: str) -> None:
    if tipo in TIPOS_DISPONIBLES:
        return
    if tipo in TIPOS_PENDIENTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El reporte de inventario y el de desechos dependen de un subsistema "
                "que todavía no tiene datos"
            ),
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de reporte desconocido"
    )


@router.get("/{tipo}", response_model=ReporteClinicoPreview)
def previsualizar(
    tipo: str,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    limit: int = Query(LIMITE_PREVIA, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*ROLES)),
) -> ReporteClinicoPreview:
    """Preview the processed set (UCE-REP-01 pasos 4-6)."""
    _verificar_tipo(tipo)
    limite = min(limit, LIMITE_MAXIMO)

    filas = filas_clinicas(db, fecha_desde, fecha_hasta, limit=limite, offset=offset)

    return ReporteClinicoPreview(
        items=[ReporteClinicoRow.model_validate(fila) for fila in filas],
        total=total_clinico(db, fecha_desde, fecha_hasta),
        limit=limite,
        offset=offset,
        columnas=list(COLUMNAS),
    )


@router.get("/{tipo}/exportar")
def exportar(
    tipo: str,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*ROLES)),
) -> Response:
    """Export the whole set as CSV (UCE-REP-01 pasos 7-9)."""
    _verificar_tipo(tipo)

    contenido = a_csv(filas_clinicas(db, fecha_desde, fecha_hasta))
    nombre = f"reporte-{tipo}{'-' + str(fecha_desde) if fecha_desde else ''}.csv"

    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
