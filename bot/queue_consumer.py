"""
Читает задачи из Redis-очереди и запускает отправку сообщений через Telethon.

Форматы задач (JSON):
  {"type": "new_application", "application_id": "uuid", "telegram_username": "@u"}
  {"type": "send_message",    "telegram_username": "@u", "text": "...", "application_id": "uuid"}
  {"type": "notify_candidate","match_id": "uuid", "candidate_telegram": "@u",
                               "candidate_name": "...", "application_id": "uuid",
                               "specialization": "..."}
  {"type": "notify_client",   "application_id": "uuid", "client_telegram": "@u", "text": "..."}
"""
import asyncio
import json
import logging
from redis.asyncio import Redis
from telethon.errors import UsernameNotOccupiedError, PeerIdInvalidError

import bot.script_engine as engine
import bot.api_client as api
from bot.config import BOT_TASK_QUEUE
from bot.telegram.client import get_client

log = logging.getLogger(__name__)

WELCOME_PREFIX = (
    "👋 Здравствуйте! Это GoodPeople Agency — профессиональный подбор домашнего персонала.\n\n"
    "Мы получили вашу заявку и уже готовы помочь! Чтобы подобрать идеального специалиста, "
    "я задам несколько уточняющих вопросов.\n\n"
)

CANDIDATE_OFFER_TEMPLATE = (
    "👋 Здравствуйте, {name}!\n\n"
    "GoodPeople Agency приглашает вас рассмотреть предложение о работе"
    "{spec_part}.\n\n"
    "Если вас интересует это предложение, ответьте «Да» — и наш менеджер "
    "свяжется с вами для уточнения деталей.\n"
    "Если предложение не подходит, ответьте «Нет»."
)


async def run_consumer(redis: Redis) -> None:
    """Бесконечный цикл чтения задач из Redis (BRPOP)."""
    log.info("Bot queue consumer started, listening on '%s'", BOT_TASK_QUEUE)
    while True:
        try:
            item = await redis.brpop(BOT_TASK_QUEUE, timeout=5)
            if item is None:
                continue

            _, raw = item
            task = json.loads(raw)
            log.info("Received task: %s", task)

            await _process_task(redis, task)

        except asyncio.CancelledError:
            break
        except Exception as e:
            log.exception("Error processing bot task: %s", e)
            await asyncio.sleep(2)


async def _process_task(redis: Redis, task: dict) -> None:
    task_type = task.get("type")

    if task_type == "new_application":
        await _handle_new_application(redis, task)
    elif task_type == "send_message":
        await _handle_send_message(task)
    elif task_type == "notify_candidate":
        await _handle_notify_candidate(redis, task)
    elif task_type == "notify_client":
        await _handle_notify_client(task)
    else:
        log.warning("Unknown task type: %s", task_type)


async def _handle_send_message(task: dict) -> None:
    """Менеджер отправляет произвольное сообщение из CRM."""
    telegram_username = task.get("telegram_username")
    text = task.get("text", "")
    application_id = task.get("application_id")

    if not telegram_username or not text:
        log.warning("send_message task missing fields: %s", task)
        return

    client = get_client()

    try:
        entity = await client.get_entity(telegram_username)
    except (UsernameNotOccupiedError, PeerIdInvalidError, ValueError) as e:
        log.warning("Cannot find Telegram entity '%s': %s", telegram_username, e)
        return

    await client.send_message(entity, text)
    log.info("Sent manual message to %s for application %s", telegram_username, application_id)


async def _handle_notify_candidate(redis: Redis, task: dict) -> None:
    """
    Уведомляет соискателя о предложении работы.
    Сохраняет match_id в Redis, чтобы при ответе 'Да'/'Нет' обновить статус.
    """
    tg = task.get("candidate_telegram")
    name = task.get("candidate_name", "")
    match_id = task.get("match_id", "")
    application_id = task.get("application_id", "")
    specialization = task.get("specialization", "")

    if not tg or not match_id:
        log.warning("notify_candidate task missing fields: %s", task)
        return

    spec_part = f" ({specialization})" if specialization else ""
    text = CANDIDATE_OFFER_TEMPLATE.format(name=name, spec_part=spec_part)

    client = get_client()
    try:
        entity = await client.get_entity(tg)
    except (UsernameNotOccupiedError, PeerIdInvalidError, ValueError) as e:
        log.warning("Cannot find candidate entity '%s': %s", tg, e)
        return

    user_id = entity.id

    # Сохраняем pending offer в Redis (TTL 7 дней)
    offer_key = f"offer:tg:{user_id}"
    await _redis_set(redis, offer_key, json.dumps({
        "match_id": match_id,
        "application_id": application_id,
    }), ttl=604800)

    await client.send_message(entity, text)
    log.info("Sent candidate offer to %s (match %s)", tg, match_id)

    # Save outgoing message to DB
    try:
        await api.save_message(application_id, "telegram", "outgoing", text)
    except Exception as e:
        log.warning("Failed to save candidate offer message: %s", e)


async def _handle_notify_client(task: dict) -> None:
    """Отправляет клиенту сообщение с кандидатами."""
    tg = task.get("client_telegram")
    text = task.get("text", "")
    application_id = task.get("application_id", "")

    if not tg or not text:
        log.warning("notify_client task missing fields: %s", task)
        return

    client = get_client()
    try:
        entity = await client.get_entity(tg)
    except (UsernameNotOccupiedError, PeerIdInvalidError, ValueError) as e:
        log.warning("Cannot find client entity '%s': %s", tg, e)
        return

    await client.send_message(entity, text)
    log.info("Sent client notification to %s for application %s", tg, application_id)

    # Save to chat history
    try:
        await api.save_message(application_id, "telegram", "outgoing", text)
    except Exception as e:
        log.warning("Failed to save client notification message: %s", e)


async def _handle_new_application(redis: Redis, task: dict) -> None:
    application_id = task["application_id"]
    telegram_username = task.get("telegram_username")

    if not telegram_username:
        log.info("No telegram_username for application %s — skip", application_id)
        return

    client = get_client()

    try:
        entity = await client.get_entity(telegram_username)
    except (UsernameNotOccupiedError, PeerIdInvalidError, ValueError) as e:
        log.warning("Cannot find Telegram entity '%s': %s", telegram_username, e)
        return

    user_id = entity.id

    first_question = await engine.start_conversation(redis, user_id, application_id)
    full_message = WELCOME_PREFIX + first_question

    await client.send_message(entity, full_message)

    try:
        await api.save_message(application_id, "telegram", "outgoing", full_message)
    except Exception as e:
        log.warning("Failed to save welcome message to DB: %s", e)

    log.info(
        "Started Telegram conversation for application %s with user %s",
        application_id, telegram_username,
    )


# ── helpers ──────────────────────────────────────────────────────────────────

async def _redis_set(redis: Redis | None, key: str, value: str, ttl: int = 3600) -> None:
    """Safe Redis set — used to store pending offer state for candidates."""
    if redis is None:
        return
    try:
        await redis.setex(key, ttl, value)
    except Exception as e:
        log.warning("Redis setex failed for key %s: %s", key, e)


async def handle_candidate_reply(redis: Redis, user_id: int, text: str) -> bool:
    """
    Проверяет, есть ли pending offer для данного пользователя.
    Если да — обрабатывает ответ 'Да'/'Нет' и обновляет статус match.
    Возвращает True если ответ был обработан как предложение, иначе False.
    """
    offer_key = f"offer:tg:{user_id}"
    raw = await redis.get(offer_key)
    if not raw:
        return False

    data = json.loads(raw)
    match_id = data.get("match_id")
    application_id = data.get("application_id", "")

    answer = text.strip().lower()
    if answer in ("да", "yes", "👍", "+"):
        new_status = "accepted"
        reply = (
            "Отлично! Мы передали ваш ответ менеджеру. "
            "Он свяжется с вами в ближайшее время для уточнения деталей. Спасибо! 🙏"
        )
    elif answer in ("нет", "no", "👎", "-"):
        new_status = "declined"
        reply = (
            "Понял вас. Если в будущем появятся другие предходящие предложения — "
            "мы обязательно напишем. Спасибо!"
        )
    else:
        # Not a clear answer — don't consume the key, let script engine handle it
        return False

    # Update match status
    try:
        await api.update_match_status(match_id, new_status)
    except Exception as e:
        log.warning("Failed to update match %s status: %s", match_id, e)

    # Save incoming reply to DB
    try:
        await api.save_message(application_id, "telegram", "incoming", text)
    except Exception as e:
        log.warning("Failed to save candidate reply: %s", e)

    # Remove pending offer key
    await redis.delete(offer_key)

    # Send confirmation back to candidate
    client = get_client()
    try:
        await client.send_message(user_id, reply)
        await api.save_message(application_id, "telegram", "outgoing", reply)
    except Exception as e:
        log.warning("Failed to send confirmation to candidate %s: %s", user_id, e)

    return True
