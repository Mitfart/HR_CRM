from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.crm_audit_log import AuditLog
from app.models.user import User
from app.services.activity_history import append_activity_event
from app.services.activity_history import get_activity_events
from app.services.deletion_history import get_deletion_events

router = APIRouter()


class AiActionIn(BaseModel):
    application_id: str
    action: str
    details: dict | None = None


@router.get("")
async def list_history(
    scope: str = Query("mine"),  # mine | all
    category: str = Query("all"),  # all | employee | ai | deletion | audit
    limit: int = Query(300, ge=1, le=3000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    uid = str(current_user.id)
    is_admin = current_user.role == "admin"

    out: list[dict] = []

    if category in ("all", "employee", "ai"):
        events = await get_activity_events(db)
        for e in events:
            if scope == "mine" and e.get("actor_user_id") != uid:
                continue
            if category == "employee" and e.get("category") != "employee":
                continue
            if category == "ai" and e.get("category") != "ai":
                continue
            out.append(
                {
                    "source": "activity",
                    "created_at": e.get("created_at"),
                    "actor_name": e.get("actor_name"),
                    "actor_user_id": e.get("actor_user_id"),
                    "category": e.get("category"),
                    "action": e.get("action"),
                    "entity_type": e.get("entity_type"),
                    "entity_id": e.get("entity_id"),
                    "details": e.get("details") or {},
                }
            )

    if category in ("all", "deletion"):
        dels = await get_deletion_events(db)
        for d in dels:
            if scope == "mine" and d.get("actor_user_id") != uid:
                continue
            out.append(
                {
                    "source": "deletion",
                    "created_at": d.get("created_at"),
                    "actor_name": d.get("actor_name"),
                    "actor_user_id": d.get("actor_user_id"),
                    "category": "deletion",
                    "action": d.get("action"),
                    "entity_type": d.get("entity_type"),
                    "entity_id": d.get("entity_id"),
                    "details": d.get("details") or {},
                }
            )

    if category in ("all", "audit"):
        q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 500))
        if scope == "mine":
            q = q.where(AuditLog.user_id == current_user.id)
        elif scope == "all" and not is_admin:
            q = q.where(AuditLog.user_id == current_user.id)
        rows = (await db.execute(q)).scalars().all()
        for r in rows:
            out.append(
                {
                    "source": "audit",
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "actor_name": r.user_label,
                    "actor_user_id": str(r.user_id) if r.user_id else None,
                    "category": "employee",
                    "action": r.action,
                    "entity_type": r.entity_type,
                    "entity_id": str(r.entity_id),
                    "details": {
                        "summary": r.summary,
                        "changes": r.changes,
                    },
                }
            )

    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return out[:limit]


@router.post("/ai-action")
async def log_ai_action(
    body: AiActionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    await append_activity_event(
        db,
        actor=current_user,
        category="ai",
        action=body.action,
        entity_type="application",
        entity_id=body.application_id,
        details=body.details or {},
    )
    await db.flush()
    return {"ok": True}
