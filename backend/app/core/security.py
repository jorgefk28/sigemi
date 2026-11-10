"""Security utilities for SIGEMI.

Provides password hashing with bcrypt and JWT creation/validation.
No secrets or token values are ever printed or logged.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import bcrypt
import jwt

from app.core.config import settings
from app.schemas.auth import TokenPayload


class InvalidTokenError(Exception):
    """Raised when a JWT cannot be decoded or is structurally invalid."""


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password* at cost factor 12.

    bcrypt silently truncates input at 72 bytes, so we truncate explicitly
    to make the behaviour visible and testable (passwords longer than 72 bytes
    still produce a verifiable hash without silent data loss).
    """
    # bcrypt only uses the first 72 bytes of the UTF-8 encoded input.
    # We truncate explicitly so the boundary is enforced at the application
    # layer and not hidden inside the C extension.
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return *True* if *plain_password* matches *hashed_password*.

    Returns *False* (never raises) when *hashed_password* is malformed.
    """
    # Same 72-byte truncation applied during hashing must be applied here.
    password_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        # hashed_password is not a valid bcrypt hash; treat as no match.
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(subject: uuid.UUID | str, roles: list[str]) -> str:
    """Build and sign a JWT access token for *subject* with the given *roles*.

    Claims:
        sub  — string representation of the subject (user UUID or username).
        roles — list of role code strings.
        iat  — issued-at as a UTC epoch integer (seconds).
        exp  — expiry as a UTC epoch integer (seconds).
    """
    now = datetime.now(tz=timezone.utc)
    expire_seconds = settings.access_token_expire_minutes * 60
    exp = int(now.timestamp()) + expire_seconds

    payload: dict[str, object] = {
        "sub": str(subject),
        "roles": roles,
        "iat": int(now.timestamp()),
        "exp": exp,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> TokenPayload:
    """Decode and validate *token*; return its payload as a :class:`TokenPayload`.

    Raises:
        InvalidTokenError: for any expired, tampered, malformed, or missing-sub token.
    """
    try:
        raw: dict[str, object] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    if not raw.get("sub"):
        raise InvalidTokenError("Token is missing the 'sub' claim.")

    return TokenPayload(
        sub=str(raw["sub"]),
        roles=list(raw.get("roles", [])),
        iat=int(raw["iat"]),
        exp=int(raw["exp"]),
    )


def token_expires_in_seconds() -> int:
    """Return the access token lifetime in seconds."""
    return settings.access_token_expire_minutes * 60
