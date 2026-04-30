import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_API_ID   = int(os.environ["TELEGRAM_API_ID"])
TELEGRAM_API_HASH = os.environ["TELEGRAM_API_HASH"]
TELEGRAM_SESSION  = os.environ["TELEGRAM_SESSION"]

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
API_URL   = os.environ.get("API_URL",   "http://backend:8000")

# Redis key for outgoing task queue (LPUSH / BRPOP)
BOT_TASK_QUEUE = "bot:tasks:telegram"
# Redis key prefix for conversation state
CONV_KEY_PREFIX = "conv:tg:"
CONV_TTL        = 60 * 60 * 24  # 24 hours
