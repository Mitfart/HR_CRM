from celery import Celery

from app.config import settings

celery_app = Celery(
    "crm_agency",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks", "app.tasks_sheets", "app.task_engine"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Moscow",
    enable_utc=True,
    # ── Periodic tasks (Celery Beat) ──────────────────────────────────────
    beat_schedule={
        "sync-google-sheets-every-2-min": {
            "task": "tasks.sync_google_sheets",
            "schedule": settings.sheets_sync_interval_seconds,  # seconds
        },
        "check-overdue-tasks-every-15-min": {
            "task": "tasks.check_overdue_tasks",
            "schedule": 900,  # 15 minutes
        },
    },
)
