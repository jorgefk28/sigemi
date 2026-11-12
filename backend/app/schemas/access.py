"""Access-control schemas: users and roles."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class RolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    nombre: str


class UsuarioRead(BaseModel):
    """A user as exposed by the API, with its role codes."""

    id: uuid.UUID
    nombre: str
    apellido: str
    correo_electronico: str
    estado: str
    roles: list[str] = Field(default_factory=list)


class UsuarioCreate(BaseModel):
    """Payload for a new user (UCE-SEG-02, paso 4).

    Only upper bounds live here. Lower bounds and the strength rule (S6) are
    business validation and must answer ``400`` with ``campo``; a schema bound
    would pre-empt them with the automatic ``422`` instead. Blank and oversized
    values are rejected by ``app.services.usuarios``.
    """

    nombre: str = Field(max_length=120)
    apellido: str = Field(max_length=120)
    correo_electronico: str = Field(max_length=255)
    contrasena: str
    roles: list[str]


class UsuarioUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    apellido: str | None = Field(default=None, max_length=120)
    correo_electronico: str | None = Field(default=None, max_length=255)
    estado: str | None = None


class RolesUpdate(BaseModel):
    """Full replacement of a user's role set; the closed catalog decides."""

    roles: list[str]


class Paginacion(BaseModel):
    """Envelope every list endpoint answers (``AGENTS.md``)."""

    total: int
    limit: int
    offset: int


class UsuarioList(Paginacion):
    items: list[UsuarioRead]


class RolList(Paginacion):
    items: list[RolRead]
