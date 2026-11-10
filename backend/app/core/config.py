"""Application configuration.

All configuration comes from environment variables (manifest section 4:
"Variables de entorno para toda la configuración, nunca valores hardcodeados").
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings loaded from the environment (and `.env` in dev)."""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_env: str = "dev"
    app_name: str = "SIGEMI"
    api_v1_prefix: str = "/api/v1"

    # Security
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    login_max_failed_attempts: int = 5
    login_lock_minutes: int = 15

    # Database
    database_url: str = "postgresql+psycopg://sigemi:sigemi@localhost:5433/sigemi"
    db_echo: bool = False

    # Broker / cache
    redis_url: str = "redis://localhost:6380/0"
    celery_broker_url: str = "redis://localhost:6380/1"
    celery_result_backend: str = "redis://localhost:6380/2"

    # CORS
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    # OTP (RNF-02: TTL maximo de 7 dias corridos)
    otp_ttl_days: int = 7

    # WhatsApp Cloud API
    whatsapp_api_url: str = "https://graph.facebook.com/v20.0"
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_verify_token: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _reject_dev_defaults_in_production(self) -> Settings:
        """Fail fast when production runs on the development fallbacks.

        The defaults below exist only so a fresh checkout boots against
        ``docker compose``. They are never a valid production configuration.
        """

        if not self.is_production:
            return self

        if self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be set in production")
        if "sigemi:sigemi@localhost" in self.database_url:
            raise ValueError("DATABASE_URL must be set in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""

    return Settings()


settings = get_settings()
