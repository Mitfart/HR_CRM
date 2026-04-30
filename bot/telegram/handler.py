"""Обработчик входящих сообщений от пользователей Telegram."""
import logging
from telethon import events
from redis.asyncio import Redis

import bot.script_engine as engine
import bot.api_client as api
from bot.queue_consumer import handle_candidate_reply
from bot.telegram.client import get_client

log = logging.getLogger(__name__)


def register_handlers(redis: Redis) -> None:
    client = get_client()

    @client.on(events.NewMessage(incoming=True))
    async def on_message(event: events.NewMessage.Event) -> None:
        # Игнорируем групповые чаты и каналы
        if not event.is_private:
            return

        user_id = event.sender_id
        text = event.raw_text.strip()

        if not text:
            return

        # Сначала проверяем — есть ли pending предложение для этого пользователя (кандидат)
        handled = await handle_candidate_reply(redis, user_id, text)
        if handled:
            log.info("Handled candidate offer reply from user %s", user_id)
            return

        # Есть ли активный скрипт-диалог?
        if not await engine.has_active_conversation(redis, user_id):
            return  # не наш пользователь — игнорируем

        # Получаем application_id для сохранения сообщения
        application_id = await engine.get_application_id(redis, user_id)

        # Сохраняем входящее сообщение
        if application_id:
            try:
                await api.save_message(application_id, "telegram", "incoming", text)
            except Exception as e:
                log.warning("Failed to save incoming message: %s", e)

        # Обрабатываем ответ и получаем следующий вопрос
        reply = await engine.handle_reply(redis, user_id, text)

        if reply:
            await event.respond(reply)

            # Сохраняем исходящее сообщение
            if application_id:
                try:
                    await api.save_message(application_id, "telegram", "outgoing", reply)
                except Exception as e:
                    log.warning("Failed to save outgoing message: %s", e)

        log.info("Handled message from user %s: step processed", user_id)
