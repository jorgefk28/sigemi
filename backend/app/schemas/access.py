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
    nombre: str = Field(min_length=1, max_length=120)
    apellido: str = Field(min_length=1, max_length=120)
    correo_electronico: str = Field(min_length=3, max_length=255)
    contrasena: str = Field(min_length=8, max_length=128)
    roles: list[str] = Field(min_length=1)


class UsuarioUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    apellido: str | None = Field(default=None, min_length=1, max_length=120)
    correo_electronico: str | None = Field(default=None, min_length=3, max_length=255)
    estado: str | None = None


class RolesUpdate(BaseModel):
    roles: list[str] = Field(min_length=1)
