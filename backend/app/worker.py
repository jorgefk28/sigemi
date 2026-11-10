"""Celery application (manifest section 1: worker + beat).

Background work that is not tied to an HTTP request lives here: OTP rotation
(RF-07), monthly waste report generation (RF-12), scheduled backups (RNF-04)
and WhatsApp notifications.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "sigemi",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)

celery_app.conf.beat_schedule = {
    # Placeholder schedule; concrete tasks are registered as each subsystem
    # lands. Kept explicit so Beat always starts with a valid configuration.
    "expire-stale-otp-tokens": {
        "task": "app.tasks.otp.expire_stale_tokens",
        "schedule": crontab(minute=0, hour="*/6"),
    },
}
