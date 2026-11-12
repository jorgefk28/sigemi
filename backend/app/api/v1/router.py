"""Version 1 API router: aggregates every v1 sub-router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auditoria, auth, roles, usuarios

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(usuarios.router)
api_router.include_router(roles.router)
api_router.include_router(auditoria.router)
