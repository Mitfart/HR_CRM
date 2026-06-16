import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.application import Application
from app.models.app_setting import AppSetting
from app.models.crm_notification import Notification
from app.models.user import User

router = APIRouter()


def _client_mirror_key(application_id: uuid.UUID) -> str:
    return f"client_portal_mirror_v1:{application_id}"


async def _ensure_client(current_user: User) -> None:
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Client access only")


@router.get("/applications")
async def list_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_client(current_user)
    rows = (
        await db.execute(
            select(Application)
            .where(Application.email == current_user.email)
            .order_by(Application.created_at.desc())
            .limit(100)
        )
    ).scalars().all()
    return [
        {
            "id": str(a.id),
            "description": a.description,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in rows
    ]


@router.get("/applications/{application_id}")
async def get_my_application_portal(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_client(current_user)
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj or app_obj.email != current_user.email:
        raise HTTPException(status_code=404, detail="Application not found")

    mirror_row = await db.get(AppSetting, _client_mirror_key(application_id))
    mirror = mirror_row.value if mirror_row and isinstance(mirror_row.value, dict) else {}

    notif_rows = (
        await db.execute(
            select(Notification)
            .where(Notification.user_id == current_user.id, Notification.entity_id == application_id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    ).scalars().all()

    notifications = [
        {
            "id": str(n.id),
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notif_rows
    ]
    return {
        "application": {
            "id": str(app_obj.id),
            "description": app_obj.description,
            "status": app_obj.status,
            "created_at": app_obj.created_at.isoformat() if app_obj.created_at else None,
        },
        "mirror": mirror,
        "notifications": notifications,
    }
