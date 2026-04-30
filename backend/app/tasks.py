import json

import redis as sync_redis

from app.celery_app import celery_app
from app.config import settings

BOT_TASK_QUEUE = "bot:tasks:telegram"


def _redis_client():
    return sync_redis.from_url(settings.redis_url, decode_responses=True)


@celery_app.task(name="tasks.trigger_bot_for_application")
def trigger_bot_for_application(application_id: str, telegram_username: str | None = None):
    """Публикует задачу в Redis-очередь бота при создании заявки."""
    if not telegram_username:
        return

    payload = json.dumps({
        "type": "new_application",
        "application_id": application_id,
        "telegram_username": telegram_username,
    })

    r = _redis_client()
    r.lpush(BOT_TASK_QUEUE, payload)


@celery_app.task(name="tasks.notify_candidates")
def notify_candidates(match_ids: list[str]):
    """Уведомляет соискателей через бота о поступившем предложении."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session, joinedload

    from app.models.match import Match

    engine = create_engine(settings.database_url.replace("+asyncpg", ""), pool_pre_ping=True)
    r = _redis_client()

    with Session(engine) as session:
        for match_id in match_ids:
            try:
                match = session.execute(
                    select(Match)
                    .where(Match.id == match_id)
                    .options(joinedload(Match.candidate), joinedload(Match.application))
                ).scalar_one_or_none()

                if not match:
                    continue

                candidate = match.candidate
                tg = (candidate.contacts or {}).get("telegram") if candidate.contacts else None
                if not tg:
                    continue

                payload = json.dumps({
                    "type": "notify_candidate",
                    "match_id": match_id,
                    "candidate_telegram": tg,
                    "candidate_name": candidate.full_name,
                    "application_id": str(match.application_id),
                    "specialization": match.application.search_params.get("specialization", "")
                    if match.application.search_params else "",
                })
                r.lpush(BOT_TASK_QUEUE, payload)

            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("notify_candidates: match %s error: %s", match_id, exc)

    engine.dispose()


@celery_app.task(name="tasks.notify_client_about_candidates")
def notify_client_about_candidates(
    application_id: str,
    client_telegram: str,
    candidate_lines: list[str],
):
    """Отправляет клиенту список согласованных кандидатов через бота."""
    list_text = "\n".join(candidate_lines)
    text = (
        "✅ GoodPeople Agency — мы подобрали для вас специалистов:\n\n"
        f"{list_text}\n\n"
        "Наш менеджер свяжется с вами для организации собеседований."
    )

    payload = json.dumps({
        "type": "notify_client",
        "application_id": application_id,
        "client_telegram": client_telegram,
        "text": text,
    })

    r = _redis_client()
    r.lpush(BOT_TASK_QUEUE, payload)


@celery_app.task(name="tasks.send_interview_reminder")
def send_interview_reminder(application_id: str, client_telegram: str, interview_at: str, video_link: str | None = None):
    """Напоминание клиенту о собеседовании (запускается за 1 час)."""
    text = f"⏰ Напоминание: ваше собеседование через 1 час ({interview_at})."
    if video_link:
        text += f"\n🔗 Ссылка на видеовстречу: {video_link}"

    payload = json.dumps({
        "type": "reminder",
        "application_id": application_id,
        "client_telegram": client_telegram,
        "text": text,
    })

    r = _redis_client()
    r.lpush(BOT_TASK_QUEUE, payload)


@celery_app.task(name="tasks.send_contract_to_client")
def send_contract_to_client(application_id: str, client_telegram: str, contract_id: str):
    """Уведомляет клиента о готовом договоре через бота."""
    text = (
        "📄 GoodPeople Agency — ваш договор готов!\n\n"
        "Менеджер отправит вам PDF-файл договора для ознакомления и подписания."
    )

    payload = json.dumps({
        "type": "contract_ready",
        "application_id": application_id,
        "client_telegram": client_telegram,
        "contract_id": contract_id,
        "text": text,
    })

    r = _redis_client()
    r.lpush(BOT_TASK_QUEUE, payload)
