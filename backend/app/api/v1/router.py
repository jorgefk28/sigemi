"""Version 1 API router: aggregates every v1 sub-router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    auditoria,
    auth,
    catalogos,
    lista_espera,
    pacientes,
    roles,
    usuarios,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(usuarios.router)
api_router.include_router(roles.router)
api_router.include_router(auditoria.router)
api_router.include_router(pacientes.router)
api_router.include_router(lista_espera.router)
api_router.include_router(catalogos.router)
