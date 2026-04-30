"""
Запустить один раз для генерации TELEGRAM_SESSION:

    pip install telethon python-dotenv
    python bot/gen_session.py

Скопируй полученную строку в .env → TELEGRAM_SESSION=
"""

import os
from dotenv import load_dotenv
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

load_dotenv()

API_ID   = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]
PHONE    = os.environ["TELEGRAM_PHONE"]

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    client.start(phone=PHONE)
    print("\n✅ TELEGRAM_SESSION=", client.session.save(), "\n")
