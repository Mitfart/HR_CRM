from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.user import User
from app.services.deletion_history import get_deletion_events

router = APIRouter()


@router.get("")
async def list_deletion_history(
    scope: str = Query("mine"),
    limit: int = Query(200, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    events = await get_deletion_events(db)
    if scope == "all" and current_user.role == "admin":
        return events[:limit]

    uid = str(current_user.id)
    mine = [e for e in events if e.get("actor_user_id") == uid]
    return mine[:limit]
