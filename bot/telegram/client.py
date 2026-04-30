from telethon import TelegramClient
from telethon.sessions import StringSession

from bot.config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION

# Singleton Telethon client
_client: TelegramClient | None = None


def get_client() -> TelegramClient:
    global _client
    if _client is None:
        _client = TelegramClient(
            StringSession(TELEGRAM_SESSION),
            TELEGRAM_API_ID,
            TELEGRAM_API_HASH,
        )
    return _client
