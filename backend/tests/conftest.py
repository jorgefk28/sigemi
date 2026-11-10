"""Test fixtures.

Database-backed tests run against the real PostgreSQL instance (the same one
`docker compose` provides) inside a transaction that is rolled back at the end
of each test, so the development database is never left dirty.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from app.db.session import engine as app_engine


@pytest.fixture(scope="session")
def engine():
    """The application engine (PostgreSQL from `docker compose`)."""

    return app_engine


@pytest.fixture
def db(engine) -> Iterator[Session]:
    """A session bound to a transaction that is rolled back after the test."""

    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def roles(db: Session) -> dict[str, object]:
    """The closed role catalog, as seeded by the data migration."""

    from app.models.access import Rol

    return {rol.codigo: rol for rol in db.query(Rol).all()}


@pytest.fixture
def usuario_factory(db: Session):
    """Build (without committing) a user with the given role codes."""

    from app.core.security import hash_password
    from app.models.access import Rol, Usuario, UsuarioRol

    counter = {"n": 0}

    def _create(
        *,
        correo: str | None = None,
        contrasena: str = "Secreta123",
        roles: tuple[str, ...] = ("bioquimico",),
        estado: str = "activo",
    ) -> Usuario:
        counter["n"] += 1
        usuario = Usuario(
            nombre="Test",
            apellido=f"User{counter['n']}",
            correo_electronico=correo or f"user{counter['n']}@sigemi.test",
            contrasena_hash=hash_password(contrasena),
            estado=estado,
        )
        db.add(usuario)
        db.flush()
        for codigo in roles:
            rol = db.query(Rol).filter_by(codigo=codigo).one()
            db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
        db.flush()
        return usuario

    return _create


@pytest.fixture
def client(db: Session):
    """A TestClient whose `get_db` dependency is the rolled-back session."""

    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
