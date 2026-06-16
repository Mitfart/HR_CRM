from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.app_setting import AppSetting
from app.models.user import User
from app.services.activity_history import append_activity_event

router = APIRouter()

HR_TIME_KEY = "hr_time_tracking_v1"


class TimeActionIn(BaseModel):
    action: str  # start | pause | resume | stop


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _empty_user_state() -> dict:
    return {
        "active_session": None,
        "history": [],
    }


def _compute_worked_seconds(active_session: dict | None) -> int:
    if not active_session:
        return 0
    start_at = _parse_iso(active_session.get("start_at"))
    if not start_at:
        return 0
    now = _now()
    total = int((now - start_at).total_seconds())
    paused_total = int(active_session.get("total_paused_seconds") or 0)
    if active_session.get("paused") and active_session.get("pause_started_at"):
        pause_started = _parse_iso(active_session.get("pause_started_at"))
        if pause_started:
            paused_total += int((now - pause_started).total_seconds())
    return max(total - paused_total, 0)


@router.get("/status")
async def get_time_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    row = await db.get(AppSetting, HR_TIME_KEY)
    payload = row.value if row and isinstance(row.value, dict) else {}

    uid = str(current_user.id)
    user_state = payload.get(uid) if isinstance(payload.get(uid), dict) else _empty_user_state()
    active = user_state.get("active_session")

    now = _now()
    today = now.astimezone(timezone.utc).date()
    worked_today = 0
    breaks_today = 0
    for session in user_state.get("history", []):
        end_dt = _parse_iso(session.get("end_at"))
        if end_dt and end_dt.date() == today:
            worked_today += int(session.get("worked_seconds") or 0)
            breaks_today += len(session.get("pauses") or [])

    if active:
        start_dt = _parse_iso(active.get("start_at"))
        if start_dt and start_dt.date() == today:
            worked_today += _compute_worked_seconds(active)
            breaks_today += len(active.get("pauses") or [])

    return {
        "active_session": active,
        "worked_seconds_current": _compute_worked_seconds(active),
        "worked_seconds_today": worked_today,
        "breaks_today": breaks_today,
    }


@router.post("/action")
async def do_time_action(
    body: TimeActionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    action = body.action.strip().lower()
    if action not in {"start", "pause", "resume", "stop"}:
        raise HTTPException(status_code=400, detail="Unsupported action")

    row = await db.get(AppSetting, HR_TIME_KEY)
    payload = row.value if row and isinstance(row.value, dict) else {}
    payload = dict(payload)

    uid = str(current_user.id)
    user_state = payload.get(uid) if isinstance(payload.get(uid), dict) else _empty_user_state()
    active = user_state.get("active_session")
    now = _now()

    if action == "start":
        if active:
            return {"ok": True, "message": "Session already active", "active_session": active}
        user_state["active_session"] = {
            "start_at": _iso(now),
            "paused": False,
            "pause_started_at": None,
            "total_paused_seconds": 0,
            "pauses": [],
        }
    elif action == "pause":
        if not active:
            raise HTTPException(status_code=400, detail="No active session")
        if active.get("paused"):
            return {"ok": True, "message": "Already paused", "active_session": active}
        active["paused"] = True
        active["pause_started_at"] = _iso(now)
        user_state["active_session"] = active
    elif action == "resume":
        if not active:
            raise HTTPException(status_code=400, detail="No active session")
        if not active.get("paused"):
            return {"ok": True, "message": "Already running", "active_session": active}
        pause_started = _parse_iso(active.get("pause_started_at"))
        pause_seconds = int((now - pause_started).total_seconds()) if pause_started else 0
        active["total_paused_seconds"] = int(active.get("total_paused_seconds") or 0) + max(pause_seconds, 0)
        pauses = list(active.get("pauses") or [])
        pauses.append(
            {
                "start_at": active.get("pause_started_at"),
                "end_at": _iso(now),
                "seconds": max(pause_seconds, 0),
            }
        )
        active["pauses"] = pauses
        active["paused"] = False
        active["pause_started_at"] = None
        user_state["active_session"] = active
    elif action == "stop":
        if not active:
            raise HTTPException(status_code=400, detail="No active session")
        if active.get("paused") and active.get("pause_started_at"):
            pause_started = _parse_iso(active.get("pause_started_at"))
            pause_seconds = int((now - pause_started).total_seconds()) if pause_started else 0
            active["total_paused_seconds"] = int(active.get("total_paused_seconds") or 0) + max(pause_seconds, 0)
            pauses = list(active.get("pauses") or [])
            pauses.append(
                {
                    "start_at": active.get("pause_started_at"),
                    "end_at": _iso(now),
                    "seconds": max(pause_seconds, 0),
                }
            )
            active["pauses"] = pauses
            active["paused"] = False
            active["pause_started_at"] = None

        start_dt = _parse_iso(active.get("start_at"))
        if not start_dt:
            raise HTTPException(status_code=400, detail="Invalid session state")
        total_seconds = max(int((now - start_dt).total_seconds()), 0)
        paused_seconds = int(active.get("total_paused_seconds") or 0)
        worked_seconds = max(total_seconds - paused_seconds, 0)

        session_item = {
            "start_at": active.get("start_at"),
            "end_at": _iso(now),
            "total_seconds": total_seconds,
            "worked_seconds": worked_seconds,
            "pauses": active.get("pauses") or [],
        }
        history = list(user_state.get("history") or [])
        history.append(session_item)
        cutoff = _now() - timedelta(days=120)
        history = [h for h in history if (_parse_iso(h.get("end_at")) or now) >= cutoff]
        user_state["history"] = history
        user_state["active_session"] = None

    payload[uid] = user_state
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key=HR_TIME_KEY, value=payload))
    await db.flush()

    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action=f"time_{action}",
        entity_type="hr_time",
        entity_id=uid,
        details={"active": bool(user_state.get("active_session"))},
    )

    return {"ok": True, "action": action, "active_session": user_state.get("active_session")}
