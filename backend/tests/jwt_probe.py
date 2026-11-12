"""Deterministic JWT signature tampering for the security probes.

An HS256 signature is 32 bytes encoded as 43 base64url characters. The last
character carries only 4 significant bits, so replacing it
(``token[:-1] + "A"``) leaves the decoded signature bytes identical about one
time in sixteen; when that happens the "tampered" token is still valid and the
probe fails without any defect in the code under test.

Flipping a bit in the decoded signature is deterministic: the bytes PyJWT
verifies always change, so the token is always invalid and always for the
signature reason, never because it stopped being well-formed.
"""

from __future__ import annotations

import base64

_SIGNATURE_BIT = 0x01


def tamper_signature(token: str) -> str:
    """Return ``token`` with the low bit of its first signature byte flipped.

    The header and payload segments are returned untouched, so the token keeps
    its structure and length; only the signature differs.
    """

    header, payload, signature = token.split(".")
    padding = "=" * (-len(signature) % 4)
    raw = base64.urlsafe_b64decode(signature + padding)

    flipped = bytes([raw[0] ^ _SIGNATURE_BIT, *raw[1:]])
    encoded = base64.urlsafe_b64encode(flipped).rstrip(b"=").decode("ascii")

    return f"{header}.{payload}.{encoded}"
