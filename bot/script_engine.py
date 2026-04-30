"""
Движок скрипта разговора.

Состояние одного диалога хранится в Redis:
  conv:tg:{telegram_user_id}  →  JSON {
    application_id: str,
    step: int,           # текущий шаг (0 = ещё не начат)
    answers: {str: str}  # step_number → ответ пользователя
  }
"""
import json
import logging
from redis.asyncio import Redis

from bot.config import CONV_KEY_PREFIX, CONV_TTL
import bot.api_client as api

log = logging.getLogger(__name__)

# Скрипт вопросов (загружается при старте из API, обновляется через reload_script)
_script: list[dict] = []


async def reload_script() -> None:
    global _script
    try:
        _script = await api.get_bot_scripts()
        log.info("Bot script loaded: %d steps", len(_script))
    except Exception as e:
        log.warning("Could not load bot script from API: %s — using defaults", e)
        _script = [
            {"step": 1, "question": "Добрый день! Расскажите подробнее, какой специалист вам нужен?"},
            {"step": 2, "question": "Какой опыт работы предпочтителен?"},
            {"step": 3, "question": "Какой уровень оплаты вы рассматриваете?"},
            {"step": 4, "question": "Когда вам удобно переговорить с менеджером?"},
        ]


def _conv_key(user_id: int) -> str:
    return f"{CONV_KEY_PREFIX}{user_id}"


async def start_conversation(redis: Redis, user_id: int, application_id: str) -> str:
    """Начинает новый диалог. Возвращает текст первого сообщения."""
    state = {"application_id": application_id, "step": 0, "answers": {}}
    await redis.setex(_conv_key(user_id), CONV_TTL, json.dumps(state))
    return await _next_message(redis, user_id)


async def handle_reply(redis: Redis, user_id: int, text: str) -> str | None:
    """
    Обрабатывает ответ пользователя.
    Возвращает следующий вопрос или None если диалог завершён.
    """
    raw = await redis.get(_conv_key(user_id))
    if not raw:
        return None  # нет активного диалога

    state: dict = json.loads(raw)
    current_step = state["step"]

    # Сохраняем ответ на текущий шаг
    if current_step > 0:
        state["answers"][str(current_step)] = text

    # Переходим к следующему шагу
    state["step"] = current_step + 1
    await redis.setex(_conv_key(user_id), CONV_TTL, json.dumps(state))

    return await _next_message(redis, user_id)


async def _next_message(redis: Redis, user_id: int) -> str:
    """Возвращает вопрос для текущего шага или финальное сообщение."""
    raw = await redis.get(_conv_key(user_id))
    state: dict = json.loads(raw)
    step = state["step"]

    # Найти вопрос для текущего шага
    question = next((s["question"] for s in _script if s["step"] == step + 1), None)

    if question:
        # Обновляем шаг на «задали вопрос»
        state["step"] = step + 1
        await redis.setex(_conv_key(user_id), CONV_TTL, json.dumps(state))
        return question

    # Скрипт завершён — сохранить ответы в backend и закрыть диалог
    application_id = state["application_id"]
    await api.update_application(
        application_id,
        search_params={"bot_answers": state["answers"]},
        status="awaiting_call",
    )
    await redis.delete(_conv_key(user_id))
    log.info("Conversation finished for application %s", application_id)
    return (
        "Отлично! Мы получили всю необходимую информацию. "
        "Наш менеджер свяжется с вами в ближайшее время для согласования деталей. "
        "Спасибо, что выбрали GoodPeople Agency! 🙏"
    )


async def get_application_id(redis: Redis, user_id: int) -> str | None:
    """Возвращает application_id активного диалога пользователя."""
    raw = await redis.get(_conv_key(user_id))
    if not raw:
        return None
    return json.loads(raw).get("application_id")


async def has_active_conversation(redis: Redis, user_id: int) -> bool:
    return await redis.exists(_conv_key(user_id)) == 1
