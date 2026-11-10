"""Tests for app.core.security (no database required)."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    token_expires_in_seconds,
    verify_password,
)


# ---------------------------------------------------------------------------
# 1. hash_password produces a bcrypt hash, not plaintext; salts differ
# ---------------------------------------------------------------------------

class TestHashPassword:
    def test_returns_bcrypt_prefix(self):
        h = hash_password("secret")
        assert h.startswith("$2b$"), f"Expected bcrypt hash, got: {h!r}"

    def test_does_not_store_plaintext(self):
        password = "my-secret-password"
        h = hash_password(password)
        assert password not in h

    def test_two_hashes_of_same_password_differ(self):
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2, "Same password must produce different hashes (salt)"


# ---------------------------------------------------------------------------
# 2. verify_password: correct → True, wrong → False
# ---------------------------------------------------------------------------

class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        h = hash_password("correct")
        assert verify_password("correct", h) is True

    def test_wrong_password_returns_false(self):
        h = hash_password("correct")
        assert verify_password("wrong", h) is False


# ---------------------------------------------------------------------------
# 3. Passwords longer than 72 bytes still verify correctly
# ---------------------------------------------------------------------------

class TestLongPassword:
    def test_password_over_72_bytes_verifies(self):
        # 80 ASCII characters → 80 bytes UTF-8 (exceeds the 72-byte bcrypt limit)
        long_password = "a" * 80
        h = hash_password(long_password)
        assert verify_password(long_password, h) is True

    def test_password_over_72_bytes_truncation_behaviour(self):
        # The first 72 bytes are shared; byte 73+ is irrelevant.
        base = "b" * 72
        password_a = base + "X"
        password_b = base + "Y"
        h = hash_password(password_a)
        # Both must verify because truncation makes them equal at 72 bytes.
        assert verify_password(password_b, h) is True


# ---------------------------------------------------------------------------
# 4. verify_password returns False (not raises) for a malformed hash
# ---------------------------------------------------------------------------

class TestMalformedHash:
    def test_malformed_hash_returns_false(self):
        result = verify_password("any-password", "this-is-not-a-bcrypt-hash")
        assert result is False

    def test_empty_hash_returns_false(self):
        result = verify_password("any-password", "")
        assert result is False


# ---------------------------------------------------------------------------
# 5. create_access_token + decode_access_token round-trip
# ---------------------------------------------------------------------------

class TestRoundTrip:
    def test_sub_and_roles_survive_round_trip(self):
        user_id = uuid.uuid4()
        roles = ["bioquimico", "administrador"]
        token = create_access_token(subject=user_id, roles=roles)
        payload = decode_access_token(token)
        assert payload.sub == str(user_id)
        assert payload.roles == roles

    def test_sub_as_string_survives_round_trip(self):
        token = create_access_token(subject="user@example.com", roles=["profesor"])
        payload = decode_access_token(token)
        assert payload.sub == "user@example.com"
        assert payload.roles == ["profesor"]

    def test_empty_roles_list_survives_round_trip(self):
        user_id = uuid.uuid4()
        token = create_access_token(subject=user_id, roles=[])
        payload = decode_access_token(token)
        assert payload.roles == []

    def test_iat_and_exp_are_integers(self):
        token = create_access_token(subject=uuid.uuid4(), roles=[])
        payload = decode_access_token(token)
        assert isinstance(payload.iat, int)
        assert isinstance(payload.exp, int)
        assert payload.exp > payload.iat


# ---------------------------------------------------------------------------
# 6. decode_access_token raises InvalidTokenError for tampered / garbage input
# ---------------------------------------------------------------------------

class TestDecodeErrors:
    def test_tampered_signature_raises(self):
        token = create_access_token(subject=uuid.uuid4(), roles=["bioquimico"])
        # Flip the last character to corrupt the signature.
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        with pytest.raises(InvalidTokenError):
            decode_access_token(tampered)

    def test_garbage_string_raises(self):
        with pytest.raises(InvalidTokenError):
            decode_access_token("this.is.garbage")

    def test_empty_string_raises(self):
        with pytest.raises(InvalidTokenError):
            decode_access_token("")

    def test_token_signed_with_wrong_key_raises(self):
        payload = {
            "sub": str(uuid.uuid4()),
            "roles": [],
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        bad_token = jwt.encode(payload, "wrong-secret-key", algorithm=settings.algorithm)
        with pytest.raises(InvalidTokenError):
            decode_access_token(bad_token)


# ---------------------------------------------------------------------------
# 7. Expired token raises InvalidTokenError
# ---------------------------------------------------------------------------

class TestExpiredToken:
    def test_expired_token_raises(self):
        now = int(time.time())
        # Build a token that expired 10 seconds ago.
        payload = {
            "sub": str(uuid.uuid4()),
            "roles": ["bioquimico"],
            "iat": now - 20,
            "exp": now - 10,
        }
        expired_token = jwt.encode(
            payload, settings.secret_key, algorithm=settings.algorithm
        )
        with pytest.raises(InvalidTokenError):
            decode_access_token(expired_token)


# ---------------------------------------------------------------------------
# token_expires_in_seconds
# ---------------------------------------------------------------------------

class TestTokenExpiresInSeconds:
    def test_returns_minutes_times_sixty(self):
        expected = settings.access_token_expire_minutes * 60
        assert token_expires_in_seconds() == expected
