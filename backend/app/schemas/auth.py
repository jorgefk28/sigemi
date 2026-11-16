"""Authentication schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Token(BaseModel):
    """Response of a successful login."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")


class CambioContrasena(BaseModel):
    """Payload of the password change (UCE-SEG-08, pasos 2-3).

    No bounds live here. Both checks — current password and the S6 strength
    rule — are business validation and must answer ``400`` with ``campo``;
    a schema bound would pre-empt them with the automatic ``422`` instead
    (``AGENTS.md``, "Response contract").
    """

    contrasena_actual: str
    contrasena_nueva: str


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str
    roles: list[str] = Field(default_factory=list)
    iat: int
    exp: int
