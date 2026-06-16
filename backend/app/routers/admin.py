"""Admin router — user management (admin-only).

Endpoints:
  GET    /api/admin/users          — list all users
  POST   /api/admin/users          — create admin or manager account
  PATCH  /api/admin/users/{id}     — update role / active status / full_name
  DELETE /api/admin/users/{id}     — deactivate user (soft delete)
"""
import uuid
from datetime import datetime
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.application import Application
from app.models.app_setting import AppSetting
from app.models.bot_message import BotMessage
from app.models.crm_audit_log import AuditLog
from app.models.user import User
from app.services.deletion_history import append_deletion_event
from app.services.activity_history import append_activity_event

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
HR_TIME_KEY = "hr_time_tracking_v1"


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateUserIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "manager"  # only admin / manager allowed here


class UpdateUserIn(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


class QuestionnaireUpsertIn(BaseModel):
    profession: str
    questions: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: CreateUserIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if data.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin panel can only create 'admin' or 'manager' accounts",
        )
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=pwd_context.hash(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    data: UpdateUserIn,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent admin from deactivating themselves
    if data.is_active is False and user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        if data.role not in ("admin", "manager"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role (allowed: admin, manager)")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password:
        user.hashed_password = pwd_context.hash(data.password)

    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    user.is_active = False
    await db.flush()
    await append_deletion_event(
        db,
        actor=current_admin,
        entity_type="user",
        entity_id=str(user.id),
        action="user_deactivated",
        details={"email": user.email, "full_name": user.full_name},
    )


def _extract_position(app: Application) -> str:
    sp = app.search_params or {}
    position = sp.get("position") or sp.get("specialization")
    if isinstance(position, str) and position.strip():
        return position.strip()
    desc = (app.description or "").lower()
    for key in ["няня", "домработница", "гувернантка", "повар", "водитель", "помощник", "охранник"]:
        if key in desc:
            return key
    return "не указано"


@router.get("/hr-stats")
async def hr_stats(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    now = datetime.utcnow()
    managers = (
        await db.execute(
            select(User).where(User.role.in_(["manager", "admin"]), User.is_active == True)
        )
    ).scalars().all()
    manager_ids = {str(u.id): u for u in managers}

    logs = (
        await db.execute(
            select(AuditLog).where(AuditLog.created_at >= datetime.utcfromtimestamp(now.timestamp() - days * 86400))
        )
    ).scalars().all()

    apps = (await db.execute(select(Application))).scalars().all()
    bot_messages = (await db.execute(select(BotMessage))).scalars().all()

    by_user: dict[str, dict] = {}
    for u in managers:
        by_user[str(u.id)] = {
            "user_id": str(u.id),
            "name": u.full_name or u.email,
            "hours_estimate": 0.0,
            "breaks_count": 0,
            "touches": 0,
            "applications_updates": 0,
            "status_changes": 0,
            "notes_updates": 0,
            "candidate_actions": 0,
            "calls_made": 0,
            "calls_answered": 0,
            "messages_answered": 0,
            "responses_processed": 0,
            "resumes_made": 0,
            "kpi_points": 0,
            "game_level": 1,
            "badge": "Новичок",
        }

    logs_by_user: dict[str, list[AuditLog]] = defaultdict(list)
    for log in logs:
        uid = str(log.user_id) if log.user_id else None
        if uid and uid in by_user:
            logs_by_user[uid].append(log)
            by_user[uid]["touches"] += 1
            if log.entity_type == "application":
                by_user[uid]["applications_updates"] += 1
            if log.action in {"stage_changed", "status_changed"}:
                by_user[uid]["status_changes"] += 1
            if isinstance(log.changes, dict) and "manager_notes" in log.changes:
                by_user[uid]["notes_updates"] += 1
            if log.entity_type == "candidate":
                by_user[uid]["candidate_actions"] += 1

    # Real tracked hours/breaks from hr_time_tracking_v1.
    time_row = await db.get(AppSetting, HR_TIME_KEY)
    time_payload = time_row.value if time_row and isinstance(time_row.value, dict) else {}
    period_start = datetime.utcfromtimestamp(now.timestamp() - days * 86400)
    for uid in by_user:
        user_time = time_payload.get(uid) if isinstance(time_payload.get(uid), dict) else {}
        history = user_time.get("history") if isinstance(user_time.get("history"), list) else []
        worked_seconds = 0
        breaks_count = 0
        for sess in history:
            if not isinstance(sess, dict):
                continue
            end_at = sess.get("end_at")
            try:
                end_dt = datetime.fromisoformat(end_at) if isinstance(end_at, str) else None
            except Exception:
                end_dt = None
            if not end_dt or end_dt < period_start:
                continue
            worked_seconds += int(sess.get("worked_seconds") or 0)
            pauses = sess.get("pauses") if isinstance(sess.get("pauses"), list) else []
            breaks_count += len(pauses)
        by_user[uid]["hours_estimate"] = round(worked_seconds / 3600, 1)
        by_user[uid]["breaks_count"] = breaks_count

    # Approximate communication metrics (global distribution by activity share).
    total_outgoing = len([m for m in bot_messages if m.direction == "outgoing"])
    total_incoming = len([m for m in bot_messages if m.direction == "incoming"])
    total_touches = sum(v["touches"] for v in by_user.values()) or 1
    for uid, row in by_user.items():
        share = row["touches"] / total_touches
        row["messages_answered"] = int(total_outgoing * share)
        row["calls_made"] = int(row["status_changes"] * 0.6)
        row["calls_answered"] = int(total_incoming * share * 0.4)
        row["responses_processed"] = int((row["applications_updates"] + row["messages_answered"]) * 0.5)
        row["resumes_made"] = int(row["candidate_actions"] * 0.7)

        points = (
            row["applications_updates"] * 2
            + row["status_changes"] * 3
            + row["messages_answered"] * 1
            + row["responses_processed"] * 2
            + row["resumes_made"] * 2
            + int(row["hours_estimate"] * 2)
        )
        row["kpi_points"] = points
        if points >= 350:
            row["game_level"] = 4
            row["badge"] = "Легенда подбора"
        elif points >= 220:
            row["game_level"] = 3
            row["badge"] = "Супер HR"
        elif points >= 120:
            row["game_level"] = 2
            row["badge"] = "Профи"

    # Vacancy/site table for KPI.
    vacancy_map: dict[str, dict] = defaultdict(lambda: {
        "vacancy": "",
        "applications_count": 0,
        "responses_processed": 0,
        "calls_made": 0,
        "calls_answered": 0,
        "messages_answered": 0,
        "resumes_made": 0,
    })
    for app in apps:
        position = _extract_position(app)
        row = vacancy_map[position]
        row["vacancy"] = position
        row["applications_count"] += 1
        row["responses_processed"] += 1
        row["messages_answered"] += 1 if app.manager_notes else 0

    # Scale vacancy stats from aggregated user actions.
    sum_calls_made = sum(v["calls_made"] for v in by_user.values())
    sum_calls_answered = sum(v["calls_answered"] for v in by_user.values())
    sum_resumes = sum(v["resumes_made"] for v in by_user.values())
    total_vacancy_apps = sum(v["applications_count"] for v in vacancy_map.values()) or 1
    for row in vacancy_map.values():
        share = row["applications_count"] / total_vacancy_apps
        row["calls_made"] = int(sum_calls_made * share)
        row["calls_answered"] = int(sum_calls_answered * share)
        row["resumes_made"] = int(sum_resumes * share)

    leaderboard = sorted(by_user.values(), key=lambda x: x["kpi_points"], reverse=True)
    return {
        "period_days": days,
        "generated_at": datetime.utcnow().isoformat(),
        "leaderboard": leaderboard,
        "vacancy_table": sorted(vacancy_map.values(), key=lambda x: x["applications_count"], reverse=True),
        "totals": {
            "hours": round(sum(v["hours_estimate"] for v in by_user.values()), 1),
            "touches": sum(v["touches"] for v in by_user.values()),
            "applications_updates": sum(v["applications_updates"] for v in by_user.values()),
            "status_changes": sum(v["status_changes"] for v in by_user.values()),
            "calls_made": sum(v["calls_made"] for v in by_user.values()),
            "messages_answered": sum(v["messages_answered"] for v in by_user.values()),
            "responses_processed": sum(v["responses_processed"] for v in by_user.values()),
            "resumes_made": sum(v["resumes_made"] for v in by_user.values()),
        },
    }


@router.get("/questionnaires")
async def list_questionnaires(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = await db.get(AppSetting, "ai_profession_questionnaires_v1")
    payload = row.value if row and isinstance(row.value, dict) else {}
    return payload


@router.post("/questionnaires")
async def upsert_questionnaire(
    data: QuestionnaireUpsertIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    profession = data.profession.strip().lower()
    if not profession:
        raise HTTPException(status_code=400, detail="profession is required")
    questions = [q.strip() for q in data.questions if q and q.strip()]
    if not questions:
        raise HTTPException(status_code=400, detail="at least one question is required")

    row = await db.get(AppSetting, "ai_profession_questionnaires_v1")
    payload = dict(row.value) if row and isinstance(row.value, dict) else {}
    payload[profession] = questions
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key="ai_profession_questionnaires_v1", value=payload))
    await db.flush()
    await append_activity_event(
        db,
        actor=_,
        category="ai",
        action="questionnaire_upserted",
        entity_type="questionnaire",
        entity_id=profession,
        details={"questions_count": len(questions)},
    )
    return {"ok": True, "profession": profession, "questions_count": len(questions)}


@router.post("/questionnaires/upload")
async def upload_questionnaires_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    # Format:
    # [profession]
    # q1
    # q2
    # ---
    # [profession2]
    # ...
    parsed: dict[str, list[str]] = {}
    current_prof = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            current_prof = line[1:-1].strip().lower()
            parsed.setdefault(current_prof, [])
            continue
        if line == "---":
            current_prof = ""
            continue
        if current_prof:
            parsed[current_prof].append(line)

    if not parsed:
        raise HTTPException(status_code=400, detail="file format invalid")

    row = await db.get(AppSetting, "ai_profession_questionnaires_v1")
    payload = dict(row.value) if row and isinstance(row.value, dict) else {}
    for prof, qs in parsed.items():
        payload[prof] = qs
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key="ai_profession_questionnaires_v1", value=payload))
    await db.flush()
    await append_activity_event(
        db,
        actor=_,
        category="ai",
        action="questionnaire_bulk_uploaded",
        entity_type="questionnaire",
        entity_id="bulk",
        details={"count": len(parsed), "professions": list(parsed.keys())},
    )
    return {"ok": True, "professions": list(parsed.keys()), "count": len(parsed)}
