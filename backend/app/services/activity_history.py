from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.user import User

ACTIVITY_HISTORY_KEY = "crm_activity_history_v1"
MAX_ACTIVITY_EVENTS = 10000


async def get_activity_events(db: AsyncSession) -> list[dict[str, Any]]:
    row = await db.get(AppSetting, ACTIVITY_HISTORY_KEY)
    if not row or not isinstance(row.value, list):
        return []
    return [x for x in row.value if isinstance(x, dict)]


async def append_activity_event(
    db: AsyncSession,
    *,
    actor: User | None,
    category: str,  # employee | ai | system
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    events = await get_activity_events(db)
    event = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "actor_user_id": str(actor.id) if actor else None,
        "actor_name": (actor.full_name or actor.email) if actor else "system",
        "category": category,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }
    events.insert(0, event)
    events = events[:MAX_ACTIVITY_EVENTS]

    row = await db.get(AppSetting, ACTIVITY_HISTORY_KEY)
    if row:
        row.value = events
    else:
        db.add(AppSetting(key=ACTIVITY_HISTORY_KEY, value=events))
