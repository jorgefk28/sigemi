"""Authentication schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Token(BaseModel):
    """Response of a successful login."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str
    roles: list[str] = Field(default_factory=list)
    iat: int
    exp: int
