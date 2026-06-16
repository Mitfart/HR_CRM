from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.user import User

OFFICE_OPERATIONS_KEY = "crm_office_operations_v1"
OFFICE_COLLECTIONS = (
    "vacancies",
    "responses",
    "messages",
    "resume_versions",
    "client_transfers",
    "candidate_files",
    "worker_contracts",
    "deletion_requests",
    "source_integrations",
    "source_sync_runs",
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def actor_payload(actor: User | None) -> dict[str, str | None]:
    if not actor:
        return {"actor_user_id": None, "actor_name": "system"}
    return {
        "actor_user_id": str(actor.id),
        "actor_name": actor.full_name or actor.email,
    }


def ensure_state(value: Any) -> dict[str, list[dict[str, Any]]]:
    state: dict[str, list[dict[str, Any]]] = {}
    src = value if isinstance(value, dict) else {}
    for name in OFFICE_COLLECTIONS:
        raw = src.get(name)
        state[name] = [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
    return state


async def get_office_state(db: AsyncSession) -> dict[str, list[dict[str, Any]]]:
    row = await db.get(AppSetting, OFFICE_OPERATIONS_KEY)
    return ensure_state(row.value if row else None)


async def save_office_state(db: AsyncSession, state: dict[str, list[dict[str, Any]]]) -> None:
    payload = ensure_state(state)
    row = await db.get(AppSetting, OFFICE_OPERATIONS_KEY)
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key=OFFICE_OPERATIONS_KEY, value=payload))


def find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    return next((item for item in items if str(item.get("id")) == str(item_id)), None)


async def create_deletion_request_record(
    db: AsyncSession,
    *,
    actor: User | None,
    entity_type: str,
    entity_id: str,
    reason: str,
) -> dict[str, Any]:
    state = await get_office_state(db)
    record = {
        "id": new_id(),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "reason": reason,
        "status": "pending",
        "created_at": now_iso(),
        "resolved_at": None,
        **actor_payload(actor),
    }
    state["deletion_requests"].insert(0, record)
    await save_office_state(db, state)
    return record
