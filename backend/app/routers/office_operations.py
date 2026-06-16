from __future__ import annotations

import html
import io
import re
import uuid
import zipfile
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.candidate import Candidate
from app.models.crm_notification import Notification
from app.models.user import User
from app.services.activity_history import append_activity_event, get_activity_events
from app.services.office_metrics import build_admin_attention, build_employee_reports
from app.services.office_operations_store import (
    actor_payload,
    create_deletion_request_record,
    find_by_id,
    get_office_state,
    new_id,
    now_iso,
    save_office_state,
)
from app.services.source_integrations import (
    SOURCE_DEFINITIONS,
    build_integrations_status,
    import_external_responses,
    record_sync_run,
    supported_source,
)

router = APIRouter()


class VacancyIn(BaseModel):
    title: str
    client_name: str | None = None
    requirements: str | None = None
    conditions: str | None = None
    source: str = "manual"
    status: str = "active"
    responsible_user_id: str | None = None


class VacancyPatch(BaseModel):
    title: str | None = None
    client_name: str | None = None
    requirements: str | None = None
    conditions: str | None = None
    status: str | None = None
    responsible_user_id: str | None = None


class ResponseIn(BaseModel):
    candidate_name: str
    source: str = "pomogatel"
    source_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    message: str | None = None
    status: str = "new"


class StatusPatch(BaseModel):
    status: str
    comment: str | None = None


class UnifiedMessageIn(BaseModel):
    candidate_id: str | None = None
    vacancy_id: str | None = None
    response_id: str | None = None
    channel: Literal["telegram", "whatsapp", "max", "email", "sms", "phone", "pomogatel"]
    direction: Literal["incoming", "outgoing"]
    text: str
    cold_outreach: bool = False
    template_key: str | None = None
    first_response_seconds: int | None = None


class ResumeVersionIn(BaseModel):
    candidate_id: str
    title: str = "Резюме кандидата"
    content: str
    hidden_fields: list[str] = []
    status: str = "draft"


class ClientTransferIn(BaseModel):
    candidate_id: str
    resume_version_id: str
    vacancy_id: str | None = None
    target_crm: str = "client-managers-crm"
    comment: str | None = None


class ClientTransferPatch(BaseModel):
    status: str
    comment: str | None = None


class WorkerContractIn(BaseModel):
    candidate_id: str
    title: str = "Договор оферты с соискателем"
    template_text: str
    email: EmailStr | None = None
    phone: str | None = None


class SmsConfirmIn(BaseModel):
    code: str


class DeletionRequestIn(BaseModel):
    entity_type: str
    entity_id: str
    reason: str


class DeletionRequestPatch(BaseModel):
    status: Literal["approved", "rejected", "restored"]
    admin_comment: str | None = None


class ExternalResponseRow(BaseModel):
    external_id: str | None = None
    vacancy_id: str | None = None
    vacancy_title: str | None = None
    candidate_name: str | None = None
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    message: str | None = None
    comment: str | None = None
    source_url: str | None = None
    url: str | None = None
    status: str | None = None
    received_at: str | None = None


class ExternalImportIn(BaseModel):
    rows: list[ExternalResponseRow]
    default_vacancy_id: str | None = None


def _sort(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda x: str(x.get("created_at") or ""), reverse=True)


def _clean_filename(name: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9а-яА-Я._-]+", "_", name).strip("._")
    return base[:120] or "file"


async def _candidate_payload(db: AsyncSession, candidate_id: str) -> dict[str, Any]:
    try:
        candidate_uuid = uuid.UUID(candidate_id)
    except ValueError:
        return {}
    candidate = await db.get(Candidate, candidate_uuid)
    if not candidate:
        return {}
    contacts = candidate.contacts if isinstance(candidate.contacts, dict) else {}
    return {
        "candidate_name": candidate.full_name,
        "candidate_specialization": candidate.specialization or "",
        "candidate_age": str(candidate.age or ""),
        "candidate_phone": contacts.get("phone") or contacts.get("whatsapp") or "",
        "candidate_email": contacts.get("email") or "",
        "candidate_notes": candidate.notes or "",
    }


def _render_template(template: str, data: dict[str, Any]) -> str:
    result = template
    for key, value in data.items():
        result = result.replace("{{" + key + "}}", str(value or ""))
    return result


def _pdf_bytes(title: str, text: str) -> bytes:
    # Compact built-in PDF generator for text previews. It intentionally keeps
    # formatting plain until a legal PDF renderer is wired in.
    body = f"{title}\n\n{text}".replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    lines = body.splitlines()[:55]
    stream_lines = ["BT", "/F1 12 Tf", "50 790 Td"]
    for idx, line in enumerate(lines):
        if idx:
            stream_lines.append("0 -16 Td")
        stream_lines.append(f"({line[:95]}) Tj")
    stream_lines.append("ET")
    stream = "\n".join(stream_lines).encode("utf-8", "ignore")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        b"5 0 obj << /Length " + str(len(stream)).encode() + b" >> stream\n" + stream + b"\nendstream endobj",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj + b"\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return out.getvalue()


def _docx_bytes(title: str, text: str) -> bytes:
    paragraphs = [title, "", *text.splitlines()]
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        + "".join(f"<w:p><w:r><w:t>{html.escape(p)}</w:t></w:r></w:p>" for p in paragraphs)
        + "</w:body></w:document>"
    )
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""")
        z.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""")
        z.writestr("word/document.xml", document_xml)
    return out.getvalue()


async def _notify_admins(
    db: AsyncSession,
    *,
    title: str,
    body: str,
    entity_type: str,
    entity_id: str | None = None,
) -> None:
    admins = (
        await db.execute(select(User).where(User.role == "admin", User.is_active == True))
    ).scalars().all()
    parsed_id = None
    if entity_id:
        try:
            parsed_id = uuid.UUID(entity_id)
        except ValueError:
            parsed_id = None
    for admin in admins:
        db.add(
            Notification(
                user_id=admin.id,
                title=title,
                body=body,
                entity_type=entity_type,
                entity_id=parsed_id,
            )
        )


async def _check_source_availability(source: str) -> dict[str, Any]:
    definition = SOURCE_DEFINITIONS[source]
    url = definition["base_url"]
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "GoodPeopleCRM/1.0 integration-health-check",
                    "Accept-Language": "ru-RU,ru;q=0.9",
                },
            )
    except httpx.HTTPError as exc:
        return {
            "source": source,
            "status": "unreachable",
            "http_status": None,
            "url": url,
            "message": str(exc),
        }
    if response.status_code in (401, 403, 451):
        return {
            "source": source,
            "status": "blocked",
            "http_status": response.status_code,
            "url": str(response.url),
            "message": f"Источник отвечает, но доступ ограничен статусом {response.status_code}",
        }
    if response.status_code >= 400:
        return {
            "source": source,
            "status": "error",
            "http_status": response.status_code,
            "url": str(response.url),
            "message": f"Источник вернул ошибку {response.status_code}",
        }
    return {
        "source": source,
        "status": "reachable",
        "http_status": response.status_code,
        "url": str(response.url),
        "message": "Публичная страница источника доступна",
    }


@router.get("/integrations")
async def list_integrations(db: AsyncSession = Depends(get_db), _: User = Depends(require_manager)):
    state = await get_office_state(db)
    return build_integrations_status(state)


@router.get("/integrations/sync-runs")
async def list_integration_sync_runs(
    source: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    items = state.get("source_sync_runs", [])
    if source:
        items = [item for item in items if item.get("source") == source]
    return _sort(items)


@router.post("/integrations/{source}/check")
async def check_integration(
    source: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    try:
        source = supported_source(source)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = await _check_source_availability(source)
    state = await get_office_state(db)
    record_sync_run(
        state,
        source=source,
        status=result["status"],
        message=result["message"],
        summary={"http_status": result["http_status"], "url": result["url"]},
        actor=actor_payload(current_user),
    )
    await save_office_state(db, state)
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="source_integration_checked",
        entity_type="source_integration",
        entity_id=source,
        details=result,
    )
    return result


@router.post("/integrations/{source}/import", status_code=status.HTTP_201_CREATED)
async def import_integration_responses(
    source: str,
    body: ExternalImportIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    try:
        source = supported_source(source)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    state = await get_office_state(db)
    if body.default_vacancy_id and not find_by_id(state["vacancies"], body.default_vacancy_id):
        raise HTTPException(status_code=404, detail="Default vacancy not found")
    summary = import_external_responses(
        state,
        source=source,
        rows=[row.model_dump(exclude_none=True) for row in body.rows],
        actor=actor_payload(current_user),
        default_vacancy_id=body.default_vacancy_id,
    )
    run = record_sync_run(
        state,
        source=source,
        status="imported",
        message=f"Импортировано откликов: {summary['created_responses']}, дублей: {summary['duplicates']}",
        summary=summary,
        actor=actor_payload(current_user),
    )
    await save_office_state(db, state)
    await append_activity_event(
        db,
        actor=current_user,
        category="employee",
        action="source_integration_imported",
        entity_type="source_integration",
        entity_id=source,
        details={"run_id": run["id"], **summary},
    )
    return {"run": run, "summary": summary}


@router.get("/vacancies")
async def list_vacancies(db: AsyncSession = Depends(get_db), _: User = Depends(require_manager)):
    state = await get_office_state(db)
    return _sort(state["vacancies"])


@router.post("/vacancies", status_code=status.HTTP_201_CREATED)
async def create_vacancy(
    body: VacancyIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    responsible_user_id = body.responsible_user_id or str(current_user.id)
    item = {
        "id": new_id(),
        "title": body.title,
        "client_name": body.client_name,
        "requirements": body.requirements,
        "conditions": body.conditions,
        "source": body.source,
        "status": body.status,
        "responsible_user_id": responsible_user_id,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **actor_payload(current_user),
    }
    state["vacancies"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="vacancy_created", entity_type="vacancy", entity_id=item["id"], details={"title": item["title"]})
    return item


@router.patch("/vacancies/{vacancy_id}")
async def patch_vacancy(
    vacancy_id: str,
    body: VacancyPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["vacancies"], vacancy_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    for key, value in body.model_dump(exclude_none=True).items():
        item[key] = value
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="vacancy_updated", entity_type="vacancy", entity_id=vacancy_id, details=body.model_dump(exclude_none=True))
    return item


@router.get("/responses")
async def list_responses(
    vacancy_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    items = state["responses"]
    if vacancy_id:
        items = [item for item in items if item.get("vacancy_id") == vacancy_id]
    return _sort(items)


@router.post("/vacancies/{vacancy_id}/responses", status_code=status.HTTP_201_CREATED)
async def create_response(
    vacancy_id: str,
    body: ResponseIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    vacancy = find_by_id(state["vacancies"], vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    item = {
        "id": new_id(),
        "vacancy_id": vacancy_id,
        "responsible_user_id": vacancy.get("responsible_user_id") or str(current_user.id),
        "candidate_name": body.candidate_name,
        "source": body.source,
        "source_url": body.source_url,
        "phone": body.phone,
        "email": str(body.email) if body.email else None,
        "message": body.message,
        "status": body.status,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **actor_payload(current_user),
    }
    state["responses"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="pomogatel_response_imported", entity_type="job_response", entity_id=item["id"], details={"vacancy_id": vacancy_id, "candidate_name": body.candidate_name})
    return item


@router.patch("/responses/{response_id}")
async def patch_response_status(
    response_id: str,
    body: StatusPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["responses"], response_id)
    if not item:
        raise HTTPException(status_code=404, detail="Response not found")
    item["status"] = body.status
    item["comment"] = body.comment
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="pomogatel_response_processed", entity_type="job_response", entity_id=response_id, details={"status": body.status, "comment": body.comment})
    return item


@router.get("/messages")
async def list_messages(
    candidate_id: str | None = None,
    vacancy_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    items = state["messages"]
    if candidate_id:
        items = [item for item in items if item.get("candidate_id") == candidate_id]
    if vacancy_id:
        items = [item for item in items if item.get("vacancy_id") == vacancy_id]
    return _sort(items)


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_unified_message(
    body: UnifiedMessageIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = {
        "id": new_id(),
        "candidate_id": body.candidate_id,
        "vacancy_id": body.vacancy_id,
        "response_id": body.response_id,
        "channel": body.channel,
        "direction": body.direction,
        "text": body.text,
        "cold_outreach": body.cold_outreach,
        "template_key": body.template_key,
        "first_response_seconds": body.first_response_seconds,
        "owner_user_id": str(current_user.id),
        "owner_name": current_user.full_name or current_user.email,
        "created_at": now_iso(),
    }
    state["messages"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="unified_message_created", entity_type="message", entity_id=item["id"], details={"channel": body.channel, "direction": body.direction, "cold_outreach": body.cold_outreach})
    return item


@router.get("/candidates/{candidate_id}/files")
async def list_candidate_files(candidate_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_manager)):
    state = await get_office_state(db)
    return _sort([item for item in state["candidate_files"] if item.get("candidate_id") == candidate_id])


@router.post("/candidates/{candidate_id}/files", status_code=status.HTTP_201_CREATED)
async def upload_candidate_file(
    candidate_id: str,
    file_type: str = Form("document"),
    note: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    upload_root = Path("uploads/candidates") / candidate_id
    upload_root.mkdir(parents=True, exist_ok=True)
    safe_name = _clean_filename(file.filename or "file")
    dest = upload_root / f"{new_id()}_{safe_name}"
    dest.write_bytes(await file.read())

    state = await get_office_state(db)
    item = {
        "id": new_id(),
        "candidate_id": candidate_id,
        "file_type": file_type,
        "filename": safe_name,
        "path": str(dest),
        "note": note,
        "created_at": now_iso(),
        **actor_payload(current_user),
    }
    state["candidate_files"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="candidate_file_uploaded", entity_type="candidate_file", entity_id=item["id"], details={"candidate_id": candidate_id, "file_type": file_type, "filename": safe_name})
    return item


@router.get("/resume-versions")
async def list_resume_versions(
    candidate_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    items = state["resume_versions"]
    if candidate_id:
        items = [item for item in items if item.get("candidate_id") == candidate_id]
    return _sort(items)


@router.post("/resume-versions", status_code=status.HTTP_201_CREATED)
async def create_resume_version(
    body: ResumeVersionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = {
        "id": new_id(),
        "candidate_id": body.candidate_id,
        "title": body.title,
        "content": body.content,
        "hidden_fields": body.hidden_fields,
        "status": body.status,
        "created_at": now_iso(),
        **actor_payload(current_user),
    }
    state["resume_versions"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="resume_version_created", entity_type="candidate", entity_id=body.candidate_id, details={"resume_version_id": item["id"], "hidden_fields": body.hidden_fields})
    return item


@router.get("/resume-versions/{resume_id}/export")
async def export_resume(
    resume_id: str,
    format: Literal["txt", "pdf", "docx"] = "pdf",
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["resume_versions"], resume_id)
    if not item:
        raise HTTPException(status_code=404, detail="Resume version not found")
    title = str(item.get("title") or "resume")
    content = str(item.get("content") or "")
    filename = _clean_filename(title)
    if format == "docx":
        return Response(_docx_bytes(title, content), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'})
    if format == "pdf":
        html_doc = (
            "<!doctype html><html><head><meta charset='utf-8'>"
            "<style>body{font-family:Arial,sans-serif;line-height:1.5;padding:32px;white-space:pre-wrap}</style>"
            f"</head><body><h1>{html.escape(title)}</h1>{html.escape(content)}</body></html>"
        )
        try:
            from weasyprint import HTML

            return Response(HTML(string=html_doc).write_pdf(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'})
        except ImportError:
            return Response(html_doc, media_type="text/html; charset=utf-8")
    return Response(content, media_type="text/plain; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}.txt"'})


@router.get("/client-transfers")
async def list_client_transfers(db: AsyncSession = Depends(get_db), _: User = Depends(require_manager)):
    state = await get_office_state(db)
    return _sort(state["client_transfers"])


@router.post("/client-transfers", status_code=status.HTTP_201_CREATED)
async def create_client_transfer(
    body: ClientTransferIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    if not find_by_id(state["resume_versions"], body.resume_version_id):
        raise HTTPException(status_code=404, detail="Resume version not found")
    item = {
        "id": new_id(),
        "candidate_id": body.candidate_id,
        "resume_version_id": body.resume_version_id,
        "vacancy_id": body.vacancy_id,
        "target_crm": body.target_crm,
        "comment": body.comment,
        "status": "sent_to_client_manager",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **actor_payload(current_user),
    }
    state["client_transfers"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="client_transfer_created", entity_type="client_transfer", entity_id=item["id"], details={"candidate_id": body.candidate_id, "resume_version_id": body.resume_version_id, "target_crm": body.target_crm})
    return item


@router.patch("/client-transfers/{transfer_id}")
async def patch_client_transfer(
    transfer_id: str,
    body: ClientTransferPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["client_transfers"], transfer_id)
    if not item:
        raise HTTPException(status_code=404, detail="Client transfer not found")
    item["status"] = body.status
    item["last_comment"] = body.comment
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    action = "resume_returned_for_revision" if body.status == "needs_revision" else "client_transfer_updated"
    await append_activity_event(db, actor=current_user, category="employee", action=action, entity_type="client_transfer", entity_id=transfer_id, details={"status": body.status, "comment": body.comment})
    if body.status == "needs_revision":
        await _notify_admins(db, title="Резюме вернули на правку", body=body.comment or "Клиентский менеджер запросил правки.", entity_type="client_transfer", entity_id=transfer_id)
    return item


@router.get("/worker-contracts")
async def list_worker_contracts(
    candidate_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    state = await get_office_state(db)
    items = state["worker_contracts"]
    if candidate_id:
        items = [item for item in items if item.get("candidate_id") == candidate_id]
    return _sort(items)


@router.post("/worker-contracts", status_code=status.HTTP_201_CREATED)
async def create_worker_contract(
    body: WorkerContractIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    candidate_data = await _candidate_payload(db, body.candidate_id)
    rendered_text = _render_template(body.template_text, candidate_data)
    email = str(body.email) if body.email else candidate_data.get("candidate_email") or None
    phone = body.phone or candidate_data.get("candidate_phone") or None
    state = await get_office_state(db)
    item = {
        "id": new_id(),
        "candidate_id": body.candidate_id,
        "title": body.title,
        "template_text": body.template_text,
        "rendered_text": rendered_text,
        "email": email,
        "phone": phone,
        "status": "draft",
        "sms_code": None,
        "sent_at": None,
        "signed_at": None,
        "created_at": now_iso(),
        **actor_payload(current_user),
    }
    state["worker_contracts"].insert(0, item)
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="worker_contract_created", entity_type="worker_contract", entity_id=item["id"], details={"candidate_id": body.candidate_id, "email": email})
    return item


@router.post("/worker-contracts/{contract_id}/send-email")
async def send_worker_contract_email(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["worker_contracts"], contract_id)
    if not item:
        raise HTTPException(status_code=404, detail="Worker contract not found")
    if not item.get("email"):
        raise HTTPException(status_code=400, detail="Candidate email is missing")
    item["status"] = "sent"
    item["sent_at"] = now_iso()
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="worker_contract_sent", entity_type="worker_contract", entity_id=contract_id, details={"email": item.get("email")})
    return {"ok": True, "status": item["status"], "email": item.get("email")}


@router.post("/worker-contracts/{contract_id}/sms-signature/request")
async def request_sms_signature(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["worker_contracts"], contract_id)
    if not item:
        raise HTTPException(status_code=404, detail="Worker contract not found")
    if not item.get("phone"):
        raise HTTPException(status_code=400, detail="Candidate phone is missing")
    code = str(abs(hash(f"{contract_id}:{now_iso()}")))[:6].zfill(6)
    item["sms_code"] = code
    item["status"] = "awaiting_sms_signature"
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="worker_contract_sms_requested", entity_type="worker_contract", entity_id=contract_id, details={"phone": item.get("phone")})
    return {"ok": True, "status": item["status"], "demo_code": code}


@router.post("/worker-contracts/{contract_id}/sms-signature/confirm")
async def confirm_sms_signature(
    contract_id: str,
    body: SmsConfirmIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    item = find_by_id(state["worker_contracts"], contract_id)
    if not item:
        raise HTTPException(status_code=404, detail="Worker contract not found")
    if body.code != item.get("sms_code"):
        raise HTTPException(status_code=400, detail="Invalid SMS code")
    item["status"] = "signed"
    item["signed_at"] = now_iso()
    item["updated_at"] = now_iso()
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action="worker_contract_sms_signed", entity_type="worker_contract", entity_id=contract_id, details={"phone": item.get("phone"), "email": item.get("email")})
    return item


@router.get("/deletion-requests")
async def list_deletion_requests(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)):
    state = await get_office_state(db)
    items = state["deletion_requests"]
    if current_user.role != "admin":
        uid = str(current_user.id)
        items = [item for item in items if item.get("actor_user_id") == uid]
    return _sort(items)


@router.post("/deletion-requests", status_code=status.HTTP_201_CREATED)
async def create_deletion_request(
    body: DeletionRequestIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    record = await create_deletion_request_record(db, actor=current_user, entity_type=body.entity_type, entity_id=body.entity_id, reason=body.reason)
    await append_activity_event(db, actor=current_user, category="employee", action="deletion_request_created", entity_type=body.entity_type, entity_id=body.entity_id, details={"request_id": record["id"], "reason": body.reason})
    await _notify_admins(db, title="Запрос на удаление", body=f"{current_user.full_name or current_user.email}: {body.reason}", entity_type=body.entity_type, entity_id=body.entity_id)
    return record


@router.patch("/deletion-requests/{request_id}")
async def resolve_deletion_request(
    request_id: str,
    body: DeletionRequestPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can resolve deletion requests")
    state = await get_office_state(db)
    item = find_by_id(state["deletion_requests"], request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Deletion request not found")
    item["status"] = body.status
    item["admin_comment"] = body.admin_comment
    item["resolved_at"] = now_iso()
    item["resolved_by_user_id"] = str(current_user.id)
    item["resolved_by_name"] = current_user.full_name or current_user.email
    await save_office_state(db, state)
    await append_activity_event(db, actor=current_user, category="employee", action=f"deletion_request_{body.status}", entity_type=item.get("entity_type") or "unknown", entity_id=str(item.get("entity_id") or request_id), details={"request_id": request_id, "admin_comment": body.admin_comment})
    return item


@router.get("/reports/employees")
async def employee_reports(
    since: str | None = Query(None),
    until: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    state = await get_office_state(db)
    reports = build_employee_reports(events=await get_activity_events(db), messages=state["messages"], since=since, until=until)
    if current_user.role != "admin":
        return [reports.get(str(current_user.id))] if reports.get(str(current_user.id)) else []
    return sorted(reports.values(), key=lambda item: int(item.get("kpi_points") or 0), reverse=True)


@router.get("/admin-attention")
async def admin_attention(
    since: str | None = Query(None),
    until: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if current_user.role != "admin":
        return []
    state = await get_office_state(db)
    reports = build_employee_reports(events=await get_activity_events(db), messages=state["messages"], since=since, until=until)
    return build_admin_attention(reports, state["deletion_requests"])


@router.post("/pomogatel/sync-preview")
async def pomogatel_sync_preview(
    vacancy_id: str,
    responses: list[ResponseIn],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    created = []
    for response in responses:
        created.append(await create_response(vacancy_id, response, db, current_user))
    return {"created": len(created), "responses": created}
