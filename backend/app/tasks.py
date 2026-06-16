from app.celery_app import celery_app


def _redis_client():
    raise RuntimeError("Telegram bot runtime is disabled")


@celery_app.task(name="tasks.trigger_bot_for_application")
def trigger_bot_for_application(application_id: str, telegram_username: str | None = None):
    """Telegram bot startup is disabled; keep task name for compatibility."""
    return None


@celery_app.task(name="tasks.notify_candidates")
def notify_candidates(match_ids: list[str]):
    """Telegram bot startup is disabled; keep task name for compatibility."""
    return None


@celery_app.task(name="tasks.notify_client_about_candidates")
def notify_client_about_candidates(
    application_id: str,
    client_telegram: str,
    candidate_lines: list[str],
):
    """Telegram bot startup is disabled; keep task name for compatibility."""
    return None


@celery_app.task(name="tasks.send_interview_reminder")
def send_interview_reminder(application_id: str, client_telegram: str, interview_at: str, video_link: str | None = None):
    """Telegram bot startup is disabled; keep task name for compatibility."""
    return None


@celery_app.task(name="tasks.send_contract_to_client")
def send_contract_to_client(application_id: str, client_telegram: str, contract_id: str):
    """Telegram bot startup is disabled; keep task name for compatibility."""
    return None
