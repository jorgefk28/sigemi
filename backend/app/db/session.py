"""Engine and session management.

The project uses synchronous SQLAlchemy so that the same engine/session
pattern works for the FastAPI request cycle (handlers run in the threadpool)
and for Celery workers, without duplicating an async driver configuration.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session]:
    """FastAPI dependency that yields a request-scoped session."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
