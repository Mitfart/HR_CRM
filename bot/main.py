"""
Точка входа бот-сервиса.

Запускает параллельно:
  1. Telethon userbot (слушает входящие сообщения)
  2. Redis queue consumer (слушает исходящие задачи)
"""
import asyncio
import logging

from redis.asyncio import Redis

from bot.config import REDIS_URL
from bot.telegram.client import get_client
from bot.telegram.handler import register_handlers
from bot.queue_consumer import run_consumer
import bot.script_engine as engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


async def main() -> None:
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    client = get_client()

    # Загружаем скрипт вопросов
    await engine.reload_script()

    # Регистрируем обработчики входящих сообщений
    register_handlers(redis)

    # Подключаемся к Telegram
    await client.start()
    me = await client.get_me()
    log.info("Telegram userbot connected as: %s (id=%s)", me.username or me.first_name, me.id)

    # Запускаем оба цикла параллельно
    await asyncio.gather(
        client.run_until_disconnected(),
        run_consumer(redis),
    )


if __name__ == "__main__":
    asyncio.run(main())
