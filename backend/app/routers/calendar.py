import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.calendar_slot import CalendarSlot
from app.models.application import Application
from app.models.user import User

router = APIRouter()


class SlotCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime


class SlotOut(BaseModel):
    id: uuid.UUID
    manager_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    is_available: bool
    booked_by_application_id: Optional[uuid.UUID] = None
    video_service: Optional[str] = None
    video_link: Optional[str] = None

    model_config = {"from_attributes": True}


class BookSlotRequest(BaseModel):
    slot_id: uuid.UUID
    application_id: uuid.UUID
    video_service: Optional[str] = None  # "tolk" | "yandex" | "most"


class VideoLinkRequest(BaseModel):
    application_id: uuid.UUID
    video_service: str  # "tolk" | "yandex" | "most"


# Public: get available slots (for bot to show clients)
@router.get("/slots", response_model=list[SlotOut])
async def get_available_slots(
    manager_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(CalendarSlot).where(CalendarSlot.is_available == True)
    if manager_id:
        query = query.where(CalendarSlot.manager_id == manager_id)
    query = query.order_by(CalendarSlot.starts_at)
    result = await db.execute(query)
    return result.scalars().all()


# Manager: create available slot
@router.post("/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED)
async def create_slot(
    data: SlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    slot = CalendarSlot(
        manager_id=current_user.id,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        is_available=True,
    )
    db.add(slot)
    await db.flush()
    await db.refresh(slot)
    return slot


# Manager: delete a slot
@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slot(
    slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(
        select(CalendarSlot).where(
            and_(CalendarSlot.id == slot_id, CalendarSlot.manager_id == current_user.id)
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    await db.delete(slot)


# Book a slot (client confirmed via bot)
@router.post("/book", response_model=SlotOut)
async def book_slot(
    data: BookSlotRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarSlot).where(
            and_(CalendarSlot.id == data.slot_id, CalendarSlot.is_available == True)
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not available")

    # Verify application exists
    app_result = await db.execute(select(Application).where(Application.id == data.application_id))
    app_obj = app_result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    slot.is_available = False
    slot.booked_by_application_id = data.application_id
    if data.video_service:
        slot.video_service = data.video_service

    # Update application
    app_obj.interview_at = slot.starts_at
    app_obj.status = "interview_scheduled"
    if data.video_service:
        app_obj.video_service = data.video_service

    await db.flush()
    await db.refresh(slot)
    return slot


# Create video link for a slot (manager action)
@router.post("/video-link", response_model=dict)
async def create_video_link(
    data: VideoLinkRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Generate a video meeting link for the given application.
    Currently returns a placeholder URL — integrate Tolq/Yandex/Most API here.
    """
    service_urls = {
        "tolk": "https://tolk.vk.com/room/",
        "yandex": "https://telemost.yandex.ru/j/",
        "most": "https://most.video/",
    }
    base = service_urls.get(data.video_service, "https://meet.example.com/")
    video_link = f"{base}{uuid.uuid4().hex[:12]}"

    # Save to application
    app_result = await db.execute(select(Application).where(Application.id == data.application_id))
    app_obj = app_result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    app_obj.video_link = video_link
    app_obj.video_service = data.video_service
    await db.flush()

    return {"video_link": video_link, "service": data.video_service}
