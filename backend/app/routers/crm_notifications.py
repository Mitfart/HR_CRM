import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.crm_notification import Notification
from app.models.user import User
from app.schemas.crm import NotificationOut
from app.services.activity_history import append_activity_event

router = APIRouter()


class StickyReminderIn(BaseModel):
    application_id: uuid.UUID
    sticky_id: str
    text: str
    remind_at: str | None = None


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    skip: int = 0,
    limit: int = 30,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Notification.created_at.desc())
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
    )
    obj = result.scalar_one_or_none()
    if obj:
        obj.is_read = True
        await db.flush()
    return obj


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    for n in result.scalars().all():
        n.is_read = True


@router.post("/sticky-reminder")
async def create_sticky_reminder(
    data: StickyReminderIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    marker = f"[sticky:{data.application_id}:{data.sticky_id}]"
    cutoff = datetime.now(timezone.utc) - timedelta(days=2)
    existing = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.body.ilike(f"%{marker}%"),
            Notification.created_at >= cutoff,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "deduped": True}

    n = Notification(
        user_id=current_user.id,
        title="Напоминание по задаче",
        body=f"{data.text}\n{marker}\nВремя: {data.remind_at or 'сейчас'}",
        entity_type="application",
        entity_id=data.application_id,
    )
    db.add(n)
    await db.flush()
    await append_activity_event(
      db,
      actor=current_user,
      category="ai",
      action="sticky_reminder_created",
      entity_type="application",
      entity_id=str(data.application_id),
      details={"sticky_id": data.sticky_id, "remind_at": data.remind_at, "text": data.text},
    )
    return {"ok": True, "notification_id": str(n.id)}
