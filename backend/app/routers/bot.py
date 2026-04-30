import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.models.application import Application
from app.models.app_setting import AppSetting
from app.models.bot_message import BotMessage
from app.models.user import User
from app.routers.ws import notify_application

BOT_TASK_QUEUE = "bot:tasks:telegram"
BOT_SCRIPTS_KEY = "bot_scripts"

DEFAULT_SCRIPT = [
    {"step": 1, "question": "Добрый день! Расскажите подробнее, какой специалист вам нужен?"},
    {"step": 2, "question": "Какой опыт работы предпочтителен?"},
    {"step": 3, "question": "Какой уровень оплаты вы рассматриваете?"},
    {"step": 4, "question": "Когда вам удобно переговорить с менеджером?"},
]


async def _get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def _load_scripts(db: AsyncSession) -> list[dict]:
    row = await db.get(AppSetting, BOT_SCRIPTS_KEY)
    if row and row.value:
        return row.value
    return DEFAULT_SCRIPT


router = APIRouter()


class BotMessageIn(BaseModel):
    application_id: uuid.UUID
    channel: str   # telegram | whatsapp | max | email
    direction: str  # incoming | outgoing
    text: str


class BotMessageOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    channel: str
    direction: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Scripts ───────────────────────────────────────────────────────────

@router.get("/scripts")
async def get_bot_scripts(db: AsyncSession = Depends(get_db)):
    """Public endpoint — readable by bot engine and CRM users."""
    return await _load_scripts(db)


@router.put("/scripts")
async def update_bot_scripts(
    scripts: list[dict],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin-only: persist bot question script to DB."""
    row = await db.get(AppSetting, BOT_SCRIPTS_KEY)
    if row:
        row.value = scripts
    else:
        row = AppSetting(key=BOT_SCRIPTS_KEY, value=scripts)
        db.add(row)
    await db.flush()
    return {"message": "Scripts updated", "count": len(scripts)}


# ── Messages ──────────────────────────────────────────────────────────

@router.post("/messages", response_model=BotMessageOut, status_code=status.HTTP_201_CREATED)
async def save_bot_message(data: BotMessageIn, db: AsyncSession = Depends(get_db)):
    msg = BotMessage(
        application_id=data.application_id,
        channel=data.channel,
        direction=data.direction,
        text=data.text,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    # Уведомляем CRM через WebSocket
    await notify_application(str(data.application_id), {
        "event": "new_message",
        "channel": data.channel,
        "direction": data.direction,
        "text": data.text,
    })

    return msg


@router.get("/messages/{application_id}", response_model=list[BotMessageOut])
async def get_messages(application_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BotMessage)
        .where(BotMessage.application_id == application_id)
        .order_by(BotMessage.created_at)
    )
    return result.scalars().all()


class SendMessageIn(BaseModel):
    text: str


@router.post("/send/{application_id}", response_model=BotMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message_to_candidate(
    application_id: uuid.UUID,
    body: SendMessageIn,
    db: AsyncSession = Depends(get_db),
):
    """Менеджер пишет сообщение соискателю из CRM — отправляется в Telegram."""
    app_obj = await db.get(Application, application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    # Сохраняем исходящее сообщение
    msg = BotMessage(
        application_id=application_id,
        channel="telegram",
        direction="outgoing",
        text=body.text,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    # Уведомляем CRM через WebSocket
    await notify_application(str(application_id), {
        "event": "new_message",
        "channel": "telegram",
        "direction": "outgoing",
        "text": body.text,
    })

    # Отправляем в Telegram через бот-сервис
    if app_obj.telegram_username:
        redis = await _get_redis()
        try:
            await redis.lpush(BOT_TASK_QUEUE, json.dumps({
                "type": "send_message",
                "application_id": str(application_id),
                "telegram_username": app_obj.telegram_username,
                "text": body.text,
            }))
        finally:
            await redis.aclose()

    return msg
