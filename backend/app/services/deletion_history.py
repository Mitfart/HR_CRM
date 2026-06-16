from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.user import User

DELETION_HISTORY_KEY = "crm_deletion_history_v1"
MAX_DELETION_EVENTS = 5000


async def get_deletion_events(db: AsyncSession) -> list[dict[str, Any]]:
    row = await db.get(AppSetting, DELETION_HISTORY_KEY)
    if not row or not isinstance(row.value, list):
        return []
    return [x for x in row.value if isinstance(x, dict)]


async def append_deletion_event(
    db: AsyncSession,
    *,
    actor: User | None,
    entity_type: str,
    entity_id: str,
    action: str,
    details: dict[str, Any] | None = None,
) -> None:
    events = await get_deletion_events(db)
    event = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "actor_user_id": str(actor.id) if actor else None,
        "actor_name": (actor.full_name or actor.email) if actor else "system",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "details": details or {},
    }
    events.insert(0, event)
    events = events[:MAX_DELETION_EVENTS]

    row = await db.get(AppSetting, DELETION_HISTORY_KEY)
    if row:
        row.value = events
    else:
        db.add(AppSetting(key=DELETION_HISTORY_KEY, value=events))
