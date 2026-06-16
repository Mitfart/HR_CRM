import uuid
import hashlib
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_manager
from app.config import settings
from app.models.application import Application
from app.models.app_setting import AppSetting
from app.models.bot_message import BotMessage
from app.models.crm_notification import Notification
from app.models.candidate import Candidate
from app.models.match import Match
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationOut, ApplicationUpdate
from app.schemas.candidate import CandidateOut
from app.schemas.match import MatchOut
from app.services.activity_history import append_activity_event

router = APIRouter()
DOCS_ROOT = Path("/tmp/crm_uploads")
DOCS_ROOT.mkdir(parents=True, exist_ok=True)


class SearchParams(BaseModel):
    specialization: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    salary_max: Optional[float] = None
    experience_min: Optional[int] = None


class MatchWithCandidateOut(MatchOut):
    candidate: CandidateOut


class ComplianceUpdate(BaseModel):
    offer_accepted: Optional[bool] = None
    pdn_accepted: Optional[bool] = None
    verification_method: Optional[str] = None  # sms_otp | call_4digits
    verification_status: Optional[str] = None  # pending | verified | failed
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    email_duplicate_sent: Optional[bool] = None


class MeetingCreateIn(BaseModel):
    title: str
    candidate_id: Optional[str] = None
    starts_at: Optional[str] = None
    use_permanent_link: bool = False
    send_to_client: bool = True
    send_to_candidate: bool = False
    channel_for_send: Optional[str] = None


class MeetingPatchIn(BaseModel):
    status: Optional[str] = None  # planned | done | cancelled
    transcript: Optional[str] = None
    manager_summary: Optional[str] = None
    ai_analysis: Optional[str] = None
    share_ai_to_client: Optional[bool] = None


class RobokassaPreviewIn(BaseModel):
    amount: float
    description: str
    invoice_id: Optional[str] = None


def _docs_key(application_id: uuid.UUID) -> str:
    return f"application_documents_v1:{application_id}"


def _security_key(application_id: uuid.UUID) -> str:
    return f"application_security_checks_v1:{application_id}"


def _meetings_key(application_id: uuid.UUID) -> str:
    return f"application_meetings_v1:{application_id}"


def _client_mirror_key(application_id: uuid.UUID) -> str:
    return f"client_portal_mirror_v1:{application_id}"


def _candidate_security_key(candidate_id: str) -> str:
    return f"candidate_security_checks_v1:{candidate_id}"


def _parse_document_metadata(filename: str, content_type: str | None, size: int) -> dict:
    ext = (Path(filename).suffix or "").lower()
    guessed = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    doc_type = "other"
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        doc_type = "photo"
    elif ext in {".pdf", ".doc", ".docx", ".rtf"}:
        doc_type = "document"
    elif ext in {".mp4", ".mov", ".avi", ".mkv"}:
        doc_type = "video"
    elif ext in {".xls", ".xlsx", ".csv"}:
        doc_type = "table"
    return {
        "detected_type": doc_type,
        "content_type": guessed,
        "size": size,
        "extension": ext,
        "needs_review": True,
    }


async def _upsert_client_mirror_section(db: AsyncSession, application_id: uuid.UUID, section: str, value: object) -> None:
    key = _client_mirror_key(application_id)
    row = await db.get(AppSetting, key)
    store = dict(row.value) if row and isinstance(row.value, dict) else {}
    store[section] = value
    store["updated_at"] = datetime.now(timezone.utc).isoformat()
    if row:
        row.value = store
    else:
        db.add(AppSetting(key=key, value=store))


async def _notify_client_mirror_update(
    db: AsyncSession,
    application_id: uuid.UUID,
    title: str,
    body: str,
) -> None:
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj or not app_obj.email:
        return
    user = (await db.execute(select(User).where(User.email == app_obj.email, User.role == "client"))).scalar_one_or_none()
    if not user:
        return
    db.add(
        Notification(
            user_id=user.id,
            title=title,
            body=body,
            entity_type="application",
            entity_id=application_id,
        )
    )


# Public: submit a new application (from the website form)
@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(data: ApplicationCreate, db: AsyncSession = Depends(get_db)):
    app_obj = Application(**data.model_dump())
    db.add(app_obj)
    await db.flush()
    await db.refresh(app_obj)

    return app_obj


# CRM: list all applications — managers/admins only
@router.get("", response_model=list[ApplicationOut])
async def list_applications(
    skip: int = 0,
    limit: int = 50,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    query = select(Application).offset(skip).limit(limit).order_by(Application.created_at.desc())
    if status:
        query = query.where(Application.status == status)
    result = await db.execute(query)
    return result.scalars().all()


# CRM: get single application — managers/admins only
@router.get("/{application_id}", response_model=ApplicationOut)
async def get_application(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return obj


# CRM: update application — managers/admins only
@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: uuid.UUID,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


# CRM: search candidates for application — managers/admins only
@router.post("/{application_id}/search", response_model=list[CandidateOut])
async def search_candidates(
    application_id: uuid.UUID,
    params: SearchParams,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    saved = app_obj.search_params or {}
    spec = params.specialization or saved.get("specialization")
    age_min = params.age_min if params.age_min is not None else saved.get("age_min")
    age_max = params.age_max if params.age_max is not None else saved.get("age_max")
    salary_max = params.salary_max if params.salary_max is not None else saved.get("salary_max")
    exp_min = params.experience_min if params.experience_min is not None else saved.get("experience_min")

    query = select(Candidate).limit(100)
    if spec:
        query = query.where(Candidate.specialization.ilike(f"%{spec}%"))
    if age_min is not None:
        query = query.where(Candidate.age >= age_min)
    if age_max is not None:
        query = query.where(Candidate.age <= age_max)
    if salary_max is not None:
        query = query.where(Candidate.salary_min <= salary_max)
    if exp_min is not None:
        query = query.where(Candidate.experience_years >= exp_min)

    candidates = await db.execute(query)
    return candidates.scalars().all()


# CRM: get matches for application — managers/admins only
@router.get("/{application_id}/matches", response_model=list[MatchWithCandidateOut])
async def get_application_matches(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(
        select(Match)
        .where(Match.application_id == application_id)
        .options(selectinload(Match.candidate))
        .order_by(Match.sent_at.desc())
    )
    matches = result.scalars().all()
    out = []
    for m in matches:
        out.append(
            MatchWithCandidateOut(
                id=m.id,
                application_id=m.application_id,
                candidate_id=m.candidate_id,
                status=m.status,
                sent_at=m.sent_at,
                responded_at=m.responded_at,
                candidate=CandidateOut.model_validate(m.candidate),
            )
        )
    return out


@router.get("/{application_id}/documents")
async def list_application_documents(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    row = await db.get(AppSetting, _docs_key(application_id))
    if not row or not isinstance(row.value, list):
        return []
    return [x for x in row.value if isinstance(x, dict)]


@router.post("/{application_id}/documents")
async def upload_application_document(
    application_id: uuid.UUID,
    file: UploadFile = File(...),
    category: str = Form("general"),
    notes: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}_{Path(file.filename or 'file').name}"
    app_dir = DOCS_ROOT / str(application_id)
    app_dir.mkdir(parents=True, exist_ok=True)
    disk_path = app_dir / safe_name

    raw = await file.read()
    disk_path.write_bytes(raw)
    parsed = _parse_document_metadata(file.filename or safe_name, file.content_type, len(raw))
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": doc_id,
        "filename": file.filename or safe_name,
        "stored_name": safe_name,
        "path": str(disk_path),
        "category": category or "general",
        "notes": notes or "",
        "parsed": parsed,
        "uploaded_at": now,
        "updated_at": now,
        "uploaded_by_id": str(current_user.id),
        "uploaded_by_name": current_user.full_name or current_user.email or "manager",
        "locked_for_external": True,
    }

    key = _docs_key(application_id)
    row = await db.get(AppSetting, key)
    current = list(row.value) if row and isinstance(row.value, list) else []
    current.insert(0, item)
    if row:
        row.value = current
    else:
        db.add(AppSetting(key=key, value=current))
    await _upsert_client_mirror_section(db, application_id, "documents", current)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Новый документ в заявке",
        f"Менеджер добавил документ: {item['filename']}",
    )
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="application_document_uploaded",
        entity_type="application",
        entity_id=str(application_id),
        details={"document_id": doc_id, "filename": item["filename"], "category": item["category"]},
    )
    await db.flush()
    return item


@router.patch("/{application_id}/documents/{document_id}")
async def update_application_document(
    application_id: uuid.UUID,
    document_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _docs_key(application_id))
    items = list(row.value) if row and isinstance(row.value, list) else []
    target = next((x for x in items if isinstance(x, dict) and x.get("id") == document_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Document not found")
    for field in ("filename", "category", "notes"):
        if field in payload and isinstance(payload[field], str):
            target[field] = payload[field].strip()
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    row.value = items
    await _upsert_client_mirror_section(db, application_id, "documents", items)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Документ обновлен",
        f"Обновлен документ: {target.get('filename') or document_id}",
    )
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="application_document_updated",
        entity_type="application",
        entity_id=str(application_id),
        details={"document_id": document_id},
    )
    await db.flush()
    return target


@router.delete("/{application_id}/documents/{document_id}")
async def delete_application_document(
    application_id: uuid.UUID,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _docs_key(application_id))
    items = list(row.value) if row and isinstance(row.value, list) else []
    idx = next((i for i, x in enumerate(items) if isinstance(x, dict) and x.get("id") == document_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Document not found")
    target = items[idx]
    path = Path(target.get("path", ""))
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass
    items.pop(idx)
    row.value = items
    await _upsert_client_mirror_section(db, application_id, "documents", items)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Документ удален",
        f"Удален документ: {target.get('filename')}",
    )
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="application_document_deleted",
        entity_type="application",
        entity_id=str(application_id),
        details={"document_id": document_id, "filename": target.get("filename")},
    )
    await db.flush()
    return {"ok": True}


@router.get("/{application_id}/documents/{document_id}/download")
async def download_application_document(
    application_id: uuid.UUID,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _docs_key(application_id))
    items = list(row.value) if row and isinstance(row.value, list) else []
    target = next((x for x in items if isinstance(x, dict) and x.get("id") == document_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(target.get("path", ""))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file missing")
    filename = target.get("filename") or path.name
    media = (target.get("parsed") or {}).get("content_type") or "application/octet-stream"
    return FileResponse(path=str(path), media_type=media, filename=filename)


@router.get("/{application_id}/compliance")
async def get_application_compliance(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    sp = app_obj.search_params or {}
    compliance = sp.get("compliance") if isinstance(sp, dict) else None
    return compliance or {
        "offer_accepted": False,
        "pdn_accepted": False,
        "verification_method": None,
        "verification_status": "pending",
        "email_duplicate_sent": False,
    }


@router.patch("/{application_id}/compliance")
async def patch_application_compliance(
    application_id: uuid.UUID,
    body: ComplianceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    sp = app_obj.search_params or {}
    if not isinstance(sp, dict):
        sp = {}
    cur = sp.get("compliance") if isinstance(sp.get("compliance"), dict) else {}
    patch = body.model_dump(exclude_none=True)
    next_val = {**cur, **patch}
    next_val["updated_at"] = datetime.now(timezone.utc).isoformat()
    next_val["updated_by_user_id"] = str(current_user.id)
    next_val["updated_by_name"] = current_user.full_name or current_user.email or "manager"
    sp["compliance"] = next_val
    app_obj.search_params = sp
    await _upsert_client_mirror_section(db, application_id, "compliance", next_val)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Обновлены согласия",
        "В карточке обновлены статусы оферты/ПДн или верификации.",
    )
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="application_compliance_updated",
        entity_type="application",
        entity_id=str(application_id),
        details=patch,
    )
    await db.flush()
    await db.refresh(app_obj)
    return next_val


@router.get("/{application_id}/client-portal")
async def get_client_portal_mirror(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _client_mirror_key(application_id))
    if not row or not isinstance(row.value, dict):
        return {"documents": [], "compliance": {}, "security_checks": [], "meetings": [], "notifications": []}
    return row.value


@router.get("/{application_id}/security-checks")
async def list_security_checks(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _security_key(application_id))
    if not row or not isinstance(row.value, list):
        return []
    return row.value


@router.post("/{application_id}/security-checks")
async def create_security_check(
    application_id: uuid.UUID,
    file: UploadFile = File(...),
    status: str = Form("pending"),  # pending | passed | failed
    notes: str = Form(""),
    candidate_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    sec_id = str(uuid.uuid4())
    safe_name = f"sb_{sec_id}_{Path(file.filename or 'security_file').name}"
    app_dir = DOCS_ROOT / str(application_id) / "security"
    app_dir.mkdir(parents=True, exist_ok=True)
    disk_path = app_dir / safe_name
    raw = await file.read()
    disk_path.write_bytes(raw)
    item = {
        "id": sec_id,
        "status": status,
        "notes": notes,
        "candidate_id": candidate_id or None,
        "filename": file.filename or safe_name,
        "path": str(disk_path),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by_name": current_user.full_name or current_user.email,
        "locked_for_external": True,
    }

    row = await db.get(AppSetting, _security_key(application_id))
    checks = list(row.value) if row and isinstance(row.value, list) else []
    checks.insert(0, item)
    if row:
        row.value = checks
    else:
        db.add(AppSetting(key=_security_key(application_id), value=checks))

    await _upsert_client_mirror_section(db, application_id, "security_checks", checks)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Добавлена проверка СБ",
        f"Статус: {status}. Файл: {item['filename']}",
    )

    if candidate_id:
        crow = await db.get(AppSetting, _candidate_security_key(candidate_id))
        citems = list(crow.value) if crow and isinstance(crow.value, list) else []
        citems.insert(0, {**item, "application_id": str(application_id)})
        if crow:
            crow.value = citems
        else:
            db.add(AppSetting(key=_candidate_security_key(candidate_id), value=citems))

    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="security_check_attached",
        entity_type="application",
        entity_id=str(application_id),
        details={"security_id": sec_id, "status": status, "candidate_id": candidate_id or None},
    )
    await db.flush()
    return item


@router.get("/{application_id}/meetings")
async def list_meetings(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _meetings_key(application_id))
    if not row or not isinstance(row.value, list):
        return []
    return row.value


@router.post("/{application_id}/meetings")
async def create_meeting(
    application_id: uuid.UUID,
    body: MeetingCreateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    app_obj = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    meeting_id = str(uuid.uuid4())
    link_token = str(uuid.uuid4())
    meeting_link = f"https://meet.goodpeople.agency/room/{link_token}"
    if body.use_permanent_link:
        meeting_link = f"https://meet.goodpeople.agency/permanent/{application_id}"
    meeting = {
        "id": meeting_id,
        "title": body.title,
        "candidate_id": body.candidate_id or None,
        "starts_at": body.starts_at,
        "meeting_link": meeting_link,
        "status": "planned",
        "recording_url": None,
        "transcript": "",
        "manager_summary": "",
        "ai_analysis": "",
        "share_ai_to_client": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_name": current_user.full_name or current_user.email,
    }
    row = await db.get(AppSetting, _meetings_key(application_id))
    items = list(row.value) if row and isinstance(row.value, list) else []
    items.insert(0, meeting)
    if row:
        row.value = items
    else:
        db.add(AppSetting(key=_meetings_key(application_id), value=items))
    await _upsert_client_mirror_section(db, application_id, "meetings", items)

    # Candidate link sending is tracked as event placeholder for adapter implementation.
    if body.send_to_candidate and body.candidate_id:
        cand = (await db.execute(select(Candidate).where(Candidate.id == uuid.UUID(body.candidate_id)))).scalar_one_or_none()
        candidate_contacts = cand.contacts if cand and isinstance(cand.contacts, dict) else {}
        c_text = f"Ссылка на онлайн-встречу: {meeting_link}"
        sent_any = False
        wa = (candidate_contacts.get("whatsapp") or "").strip()
        if wa:
            db.add(BotMessage(application_id=application_id, channel="whatsapp", direction="outgoing", text=f"[to-candidate] {c_text}"))
            sent_any = True
        em = (candidate_contacts.get("email") or "").strip()
        if em:
            db.add(BotMessage(application_id=application_id, channel="email", direction="outgoing", text=f"[to-candidate] {c_text} ({em})"))
            sent_any = True
        await append_activity_event(
            db,
            actor=current_user,
            category="system",
            action="meeting_link_candidate_dispatch_queued",
            entity_type="meeting",
            entity_id=meeting_id,
            details={
                "candidate_id": body.candidate_id,
                "channel": body.channel_for_send or "disabled",
                "sent_any": sent_any,
                "telegram": False,
                "whatsapp": bool(wa),
                "email": bool(em),
            },
        )

    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="meeting_created",
        entity_type="application",
        entity_id=str(application_id),
        details={"meeting_id": meeting_id, "meeting_link": meeting_link},
    )
    await _notify_client_mirror_update(
        db,
        application_id,
        "Назначена онлайн-встреча",
        f"Создана встреча: {body.title}",
    )
    await db.flush()
    return meeting


@router.patch("/{application_id}/meetings/{meeting_id}")
async def patch_meeting(
    application_id: uuid.UUID,
    meeting_id: str,
    body: MeetingPatchIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    row = await db.get(AppSetting, _meetings_key(application_id))
    items = list(row.value) if row and isinstance(row.value, list) else []
    target = next((x for x in items if isinstance(x, dict) and x.get("id") == meeting_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Meeting not found")
    patch = body.model_dump(exclude_none=True)
    for k, v in patch.items():
        target[k] = v
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    row.value = items
    await _upsert_client_mirror_section(db, application_id, "meetings", items)
    await _notify_client_mirror_update(
        db,
        application_id,
        "Обновлена онлайн-встреча",
        f"Встреча {meeting_id} обновлена менеджером.",
    )
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="meeting_updated",
        entity_type="application",
        entity_id=str(application_id),
        details={"meeting_id": meeting_id, "patch": patch},
    )
    await db.flush()
    return target


@router.post("/{application_id}/payments/robokassa/preview")
async def create_robokassa_preview(
    application_id: uuid.UUID,
    body: RobokassaPreviewIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    _ = (await db.execute(select(Application).where(Application.id == application_id))).scalar_one_or_none()
    if not _:
        raise HTTPException(status_code=404, detail="Application not found")
    merchant = settings.robokassa_merchant_login or "demo"
    invoice_id = body.invoice_id or f"{application_id.hex[:10]}-{int(datetime.now(timezone.utc).timestamp())}"
    amount = f"{max(body.amount, 0):.2f}"
    signature_src = f"{merchant}:{amount}:{invoice_id}:{settings.robokassa_pass1 or 'demo_pass1'}"
    signature = hashlib.md5(signature_src.encode("utf-8")).hexdigest()
    params = {
        "MerchantLogin": merchant,
        "OutSum": amount,
        "InvId": invoice_id,
        "Description": body.description[:120],
        "SignatureValue": signature,
        "IsTest": "1" if settings.robokassa_test_mode else "0",
    }
    pay_url = f"{settings.robokassa_base_url}?{urlencode(params)}"
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="robokassa_payment_preview_created",
        entity_type="application",
        entity_id=str(application_id),
        details={"amount": amount, "invoice_id": invoice_id},
    )
    await db.flush()
    return {"payment_url": pay_url, "invoice_id": invoice_id, "amount": amount, "merchant": merchant}
