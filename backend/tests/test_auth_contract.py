"""Contract probes: the auth endpoints must keep the shape the SPA depends on.

The frontend work unit (`odd/tasks/03-shell-frontend.md`, S2) sends
`application/x-www-form-urlencoded` with `username` + `password` and calls
`/me` with a `Bearer` token. These tests pin that contract so a future change
to the backend cannot silently break the SPA while the backend suite stays green.
"""

from fastapi.testclient import TestClient


def test_login_rejects_a_json_body(client: TestClient) -> None:
    """`OAuth2PasswordRequestForm` only accepts form-encoded bodies."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "alguien@unam.edu.ar", "password": "Secreta123"},
    )

    assert response.status_code == 422


def test_login_rejects_a_form_that_uses_email_instead_of_username(
    client: TestClient,
) -> None:
    """The form field is named `username`; `email` is not accepted."""
    response = client.post(
        "/api/v1/auth/login",
        data={"email": "alguien@unam.edu.ar", "password": "Secreta123"},
    )

    assert response.status_code == 422


def test_me_requires_a_bearer_token(client: TestClient) -> None:
    """`/me` answers 401 without a token or with a non-Bearer scheme."""
    without_header = client.get("/api/v1/auth/me")
    wrong_scheme = client.get(
        "/api/v1/auth/me", headers={"Authorization": "token-without-bearer"}
    )

    assert without_header.status_code == 401
    assert wrong_scheme.status_code == 401
