"""
Google Sheets → CRM real-time sync (Celery task, runs every N seconds via beat).

Architecture (two-layer ingestion):
  Layer 1 — raw_legacy_rows: row stored verbatim (raw_data JSON), no parsing failures lost.
  Layer 2 — normalized_deal: structured fields mapped to crm_deals columns.

Sheets handled:
  вакансии 26 / вакансии 25 / вакансии 24 / ранжирование  →  Deal (pipeline "Вакансии")
  ⭐️НУР, 🎀 НАСТЯ🎀, 🧸 АНЯ ХАБ🧸,
  💎ЛЕРА💎, ОТЧ Аня №1, актуализация базы               →  Candidate
  ПАРОЛИ                                                  →  SKIPPED (credentials)
"""

import hashlib
import logging
import re
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any

from app.celery_app import celery_app
from app.config import settings

log = logging.getLogger(__name__)

# ── Sheet classification ─────────────────────────────────────────────────────

VACANCY_SHEETS = {"вакансии 26", "вакансии 25", "вакансии 24", "ранжирование"}
CANDIDATE_SHEETS = {
    "⭐️НУР⭐️", "🎀 НАСТЯ🎀", "🧸 АНЯ ХАБ🧸", "💎ЛЕРА💎",
    "ОТЧ Аня №1", "актуализация базы",
}
SKIP_SHEETS = {"ПАРОЛИ"}

# ── Standardized vacancy pipeline stages ────────────────────────────────────
# These are the canonical stage names used in CRM (no emoji)
STANDARD_STAGES = [
    ("Новая",                "#a0aec0", False, False),
    ("Бриф подтверждён",     "#63b3ed", False, False),
    ("Поиск кандидатов",     "#4299e1", False, False),
    ("Шорт-лист отправлен",  "#9f7aea", False, False),
    ("Собеседования",        "#f6ad55", False, False),
    ("Оффер",                "#68d391", False, False),
    ("Выход/пробные дни",    "#b794f4", False, False),
    ("Закрыт успешно",       "#48bb78", True,  False),
    ("Отменён",              "#fc8181", False, True),
]

# Legacy emoji-status → canonical stage mapping
EMOJI_TO_STAGE: dict[str, str] = {
    "✅✔️": "Закрыт успешно",
    "✅‼️": "Поиск кандидатов",
    "✔️":   "Закрыт успешно",
    "‼️":   "Поиск кандидатов",
    "✅":   "Поиск кандидатов",
}

# Legacy emoji → priority mapping
EMOJI_TO_PRIORITY: dict[str, str] = {
    "✅‼️": "urgent",
    "‼️":   "urgent",
    "✅✔️": "normal",
    "✔️":   "normal",
    "✅":   "normal",
}

# Source channel abbreviations
SOURCE_MAP = {
    "тг": "Telegram",
    "хх": "HeadHunter",
    "пм": "Помогатор",
    "pm": "Помогатор",
    "hh": "HeadHunter",
    "ав": "Авито",
    "avito": "Авито",
}

# Manager name → CRM user login (adjust to match real user emails)
MANAGER_MAP = {
    "нурия": "nuriya",
    "аня": "anya",
    "аня оди": "anya_odi",
    "аня хаб": "anya_hab",
    "настя": "nastya",
    "лера": "lera",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def _row_hash(row: list[Any]) -> str:
    text = "|".join(str(c) if c is not None else "" for c in row)
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _strip_emojis(text: str) -> str:
    return re.sub(r"^[\u2705\u2714\ufe0f\u203c\ufe0f\u2b50\ufe0f\s]+", "", text).strip()


def _detect_legacy_mark(raw: str) -> str:
    """Return the raw emoji prefix found in the client cell."""
    for emoji in EMOJI_TO_STAGE:
        if raw.startswith(emoji):
            return emoji
    if "✅" in raw and "✔️" in raw:
        return "✅✔️"
    if "‼️" in raw:
        return "‼️"
    if "✅" in raw:
        return "✅"
    return ""


def _detect_stage(raw: str) -> str:
    legacy = _detect_legacy_mark(raw)
    return EMOJI_TO_STAGE.get(legacy, "Новая")


def _detect_priority(raw: str) -> str:
    legacy = _detect_legacy_mark(raw)
    return EMOJI_TO_PRIORITY.get(legacy, "normal")


def _parse_sources(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[/\s,]+", raw.lower())
    return [SOURCE_MAP[p] for p in parts if p in SOURCE_MAP]


def _parse_salary(raw: Any) -> tuple[float | None, float | None]:
    """
    Parse salary text into (salary_from, salary_to).
    Handles: '154 000', '80000-100000', '8 000 - 10 000', '8т'.
    """
    if raw is None:
        return None, None
    s = str(raw).replace("\u00a0", "").replace(" ", "").replace(".", "").lower()
    # Handle shorthand like "8т" = 8000
    s = re.sub(r"(\d+)т", lambda m: str(int(m.group(1)) * 1000), s)
    # Extract all numbers
    nums = re.findall(r"\d+", s)
    if not nums:
        return None, None
    if len(nums) == 1:
        return float(nums[0]), None
    return float(nums[0]), float(nums[1])


def _normalize_phone(raw: Any) -> str | None:
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return "+" + digits if digits else None


def _get_engine():
    from sqlalchemy import create_engine
    url = settings.database_url.replace("+asyncpg", "")
    return create_engine(url, pool_pre_ping=True)


# ── Stage / pipeline cache ───────────────────────────────────────────────────

_pipeline_cache: dict[str, _uuid.UUID] = {}
_stage_cache: dict[str, _uuid.UUID] = {}
_user_cache: dict[str, _uuid.UUID] = {}


def _ensure_vacancy_pipeline(session) -> _uuid.UUID:
    from sqlalchemy import select
    from app.models.crm_pipeline import Pipeline, Stage

    if "vacancies" in _pipeline_cache:
        return _pipeline_cache["vacancies"]

    pipeline = session.execute(
        select(Pipeline).where(Pipeline.name == "Вакансии", Pipeline.entity_type == "deal")
    ).scalar_one_or_none()

    if not pipeline:
        pipeline = Pipeline(name="Вакансии", entity_type="deal", is_default=True)
        session.add(pipeline)
        session.flush()

    # Ensure all standard stages exist
    existing_stages = session.execute(
        select(Stage).where(Stage.pipeline_id == pipeline.id)
    ).scalars().all()
    existing_names = {s.name for s in existing_stages}

    for order, (name, color, is_won, is_lost) in enumerate(STANDARD_STAGES):
        if name not in existing_names:
            session.add(Stage(
                pipeline_id=pipeline.id,
                name=name,
                sort_order=order,
                color=color,
                is_won=is_won,
                is_lost=is_lost,
            ))

    session.flush()

    _pipeline_cache["vacancies"] = pipeline.id

    # Refresh stage cache
    stages = session.execute(select(Stage).where(Stage.pipeline_id == pipeline.id)).scalars().all()
    for s in stages:
        _stage_cache[s.name] = s.id

    return pipeline.id


def _get_stage_id(session, stage_name: str) -> _uuid.UUID | None:
    _ensure_vacancy_pipeline(session)
    return _stage_cache.get(stage_name) or _stage_cache.get("Новая")


def _get_owner_id(session, manager_raw: str | None) -> _uuid.UUID | None:
    if not manager_raw:
        return None
    key = manager_raw.strip().lower()
    if key in _user_cache:
        return _user_cache[key]

    from sqlalchemy import select
    from app.models.user import User

    user = session.execute(
        select(User).where(
            (User.full_name.ilike(f"%{key}%")) | (User.email.ilike(f"%{key}%"))
        )
    ).scalar_one_or_none()

    if user:
        _user_cache[key] = user.id
        return user.id
    return None


# ── Layer 1: Save raw row ────────────────────────────────────────────────────

def _upsert_raw_row(session, row: list[Any], sheet_name: str, row_num: int,
                    spreadsheet_id: str) -> "RawLegacyRow":
    from sqlalchemy import select
    from app.models.raw_legacy_row import RawLegacyRow

    existing = session.execute(
        select(RawLegacyRow).where(
            RawLegacyRow.spreadsheet_id == spreadsheet_id,
            RawLegacyRow.sheet_name == sheet_name,
            RawLegacyRow.row_number == row_num,
        )
    ).scalar_one_or_none()

    raw_list = [str(c) if c is not None else None for c in row]

    if existing:
        existing.raw_data = raw_list
        existing.updated_at = datetime.now(timezone.utc)
        return existing

    rec = RawLegacyRow(
        spreadsheet_id=spreadsheet_id,
        sheet_name=sheet_name,
        row_number=row_num,
        raw_data=raw_list,
        parse_status="ok",
    )
    session.add(rec)
    session.flush()
    return rec


def _record_sync_error(session, spreadsheet_id: str, sheet_name: str,
                        row_num: int | None, error_code: str, error_msg: str):
    from app.models.sync_error import SyncError
    session.add(SyncError(
        spreadsheet_id=spreadsheet_id,
        sheet_name=sheet_name,
        row_number=row_num,
        error_code=error_code,
        error_message=error_msg,
        status="new",
    ))


# ── Layer 2: Normalize and upsert Deal ──────────────────────────────────────

def _parse_vacancy_row(row: list[Any], sheet_name: str, spreadsheet_id: str) -> dict:
    """
    Parse a vacancy row into a normalized dict.
    Column order: date, manager, client, source%, schedule, position, salary, location
    """
    col = list(row) + [None] * 10
    date_raw, manager_raw, client_raw, source_raw, schedule_raw, pos_raw, salary_raw, loc_raw = col[:8]

    if not client_raw:
        return {}

    client_str = str(client_raw).strip()
    if not client_str or client_str.lower() in ("клиент", "client"):
        return {}

    legacy_mark = _detect_legacy_mark(client_str)
    stage_name = EMOJI_TO_STAGE.get(legacy_mark, "Новая")
    priority = EMOJI_TO_PRIORITY.get(legacy_mark, "normal")
    client_name = _strip_emojis(client_str)
    sources = _parse_sources(str(source_raw) if source_raw else None)
    salary_from, salary_to = _parse_salary(salary_raw)

    order_date = None
    if isinstance(date_raw, datetime):
        order_date = date_raw
    elif date_raw:
        for fmt in ("%d.%m.%Y", "%d.%m.%y", "%-d.%-m.%Y"):
            try:
                order_date = datetime.strptime(str(date_raw), fmt)
                break
            except ValueError:
                pass

    manager_name = str(manager_raw).strip() if manager_raw else None
    schedule = str(schedule_raw).strip() if schedule_raw else None
    position = str(pos_raw).strip() if pos_raw else None
    location = str(loc_raw).strip() if loc_raw else None

    title = f"{client_name} — {position or 'вакансия'}".strip(" —")
    legacy_row_ref = f"{spreadsheet_id}:{sheet_name}:{0}"  # row_num set by caller

    return {
        "title": title,
        "client_name": client_name,
        "client_str": client_str,
        "stage_name": stage_name,
        "priority": priority,
        "legacy_mark": legacy_mark,
        "manager_name": manager_name,
        "vacancy_type": position,
        "schedule": schedule,
        "salary_from": salary_from,
        "salary_to": salary_to,
        "source_channels": sources,
        "location_text": location,
        "order_date": order_date.isoformat() if order_date else None,
        "manager_name_legacy": manager_name,
        # custom_fields carries legacy data for traceability
        "custom_fields": {
            "sheet_name": sheet_name,
            "spreadsheet_id": spreadsheet_id,
            "order_date": order_date.isoformat() if order_date else None,
            "client_raw": client_str,
            "salary_text": str(salary_raw).strip() if salary_raw else None,
        },
    }


def _upsert_deal(session, row: list[Any], sheet_name: str, row_num: int, spreadsheet_id: str,
                 raw_rec=None) -> bool:
    """
    Layer-2: Parse row and upsert Deal. Returns True if created/updated.
    raw_rec: RawLegacyRow from layer-1 (updated with entity link on success).
    """
    from sqlalchemy import select
    from app.models.crm_deal import Deal
    from app.models.sheets_sync import SheetSyncRow

    h = _row_hash(row)

    # Check SheetSyncRow for change detection (unchanged → skip)
    sync_rec = session.execute(
        select(SheetSyncRow).where(
            SheetSyncRow.spreadsheet_id == spreadsheet_id,
            SheetSyncRow.sheet_name == sheet_name,
            SheetSyncRow.row_number == row_num,
        )
    ).scalar_one_or_none()

    if sync_rec and sync_rec.row_hash == h:
        return False  # unchanged

    parsed = _parse_vacancy_row(row, sheet_name, spreadsheet_id)
    if not parsed:
        return False

    # Update legacy_row_ref with actual row number
    parsed["legacy_row_ref"] = f"{spreadsheet_id}:{sheet_name}:{row_num}"

    pipeline_id = _ensure_vacancy_pipeline(session)
    stage_id = _get_stage_id(session, parsed["stage_name"])
    owner_id = _get_owner_id(session, parsed.get("manager_name"))

    # Determine quality flag
    missing = []
    if not parsed.get("vacancy_type"):
        missing.append("vacancy_type")
    if not parsed.get("salary_from"):
        missing.append("salary_from")
    if not parsed.get("location_text"):
        missing.append("location")
    quality_flag = "manual_review" if missing else "ok"

    deal: Deal | None = None

    if sync_rec and sync_rec.entity_id:
        deal = session.get(Deal, sync_rec.entity_id)

    if deal is None:
        # Duplicate guard by client_raw + sheet_name
        client_str = parsed["client_str"]
        existing = session.execute(
            select(Deal).where(
                Deal.custom_fields["client_raw"].astext == client_str,
                Deal.custom_fields["sheet_name"].astext == sheet_name,
            )
        ).scalars().first()
        deal = existing

    if deal:
        # Update existing deal
        deal.title = parsed["title"]
        deal.amount = parsed.get("salary_from")
        deal.pipeline_id = pipeline_id
        deal.stage_id = stage_id
        deal.owner_id = owner_id
        deal.vacancy_type = parsed.get("vacancy_type")
        deal.schedule = parsed.get("schedule")
        deal.salary_from = parsed.get("salary_from")
        deal.salary_to = parsed.get("salary_to")
        deal.source_channels = parsed.get("source_channels") or []
        deal.location_text = parsed.get("location_text")
        deal.manager_name_legacy = parsed.get("manager_name_legacy")
        deal.legacy_row_ref = parsed["legacy_row_ref"]
        deal.legacy_mark = parsed.get("legacy_mark")
        deal.priority = parsed.get("priority", "normal")
        deal.quality_flag = quality_flag
        deal.custom_fields = parsed.get("custom_fields")
    else:
        deal = Deal(
            title=parsed["title"],
            amount=parsed.get("salary_from"),
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            owner_id=owner_id,
            vacancy_type=parsed.get("vacancy_type"),
            schedule=parsed.get("schedule"),
            salary_from=parsed.get("salary_from"),
            salary_to=parsed.get("salary_to"),
            source_channels=parsed.get("source_channels") or [],
            location_text=parsed.get("location_text"),
            manager_name_legacy=parsed.get("manager_name_legacy"),
            legacy_row_ref=parsed["legacy_row_ref"],
            legacy_mark=parsed.get("legacy_mark"),
            priority=parsed.get("priority", "normal"),
            quality_flag=quality_flag,
            custom_fields=parsed.get("custom_fields"),
        )
        session.add(deal)
        session.flush()

    # Update SheetSyncRow
    if sync_rec:
        sync_rec.entity_id = deal.id
        sync_rec.row_hash = h
        sync_rec.sync_error = None
        sync_rec.last_synced_at = datetime.now(timezone.utc)
    else:
        session.add(SheetSyncRow(
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            row_number=row_num,
            row_hash=h,
            entity_type="deal",
            entity_id=deal.id,
        ))

    # Update layer-1 raw_rec with entity link and parsed data
    if raw_rec:
        raw_rec.entity_type = "deal"
        raw_rec.entity_id = deal.id
        raw_rec.parsed_data = parsed
        raw_rec.parse_status = quality_flag if quality_flag != "ok" else "ok"

    return True


# ── Candidate row → Candidate ────────────────────────────────────────────────

def _upsert_candidate(session, row: list[Any], sheet_name: str, row_num: int, spreadsheet_id: str):
    from sqlalchemy import select
    from app.models.candidate import Candidate
    from app.models.sheets_sync import SheetSyncRow

    h = _row_hash(row)

    sync_rec = session.execute(
        select(SheetSyncRow).where(
            SheetSyncRow.spreadsheet_id == spreadsheet_id,
            SheetSyncRow.sheet_name == sheet_name,
            SheetSyncRow.row_number == row_num,
        )
    ).scalar_one_or_none()

    if sync_rec and sync_rec.row_hash == h:
        return

    col = list(row) + [None] * 10
    _num, _date_raw, name_raw, age_raw, spec_raw, phone_raw, site_raw, result_raw = col[:8]

    if not name_raw:
        return
    name_str = str(name_raw).strip()
    if not name_str or name_str.lower() in ("фио", "имя", "name"):
        return

    phone = _normalize_phone(phone_raw)
    spec = str(spec_raw).strip() if spec_raw else None
    site = str(site_raw).strip() if site_raw else None
    result = str(result_raw).strip() if result_raw else None

    contacts: dict = {}
    if phone:
        contacts["phone"] = phone

    age: int | None = None
    if age_raw:
        try:
            age = int(float(str(age_raw)))
        except (ValueError, TypeError):
            pass

    notes_parts = []
    if site:
        notes_parts.append(f"Источник: {site}")
    if result:
        notes_parts.append(f"Результат собеседования: {result}")
    notes_parts.append(f"Лист менеджера: {sheet_name}")
    notes_text = "\n".join(notes_parts)

    tags = [t for t in [spec, site, sheet_name] if t]

    if sync_rec and sync_rec.entity_id:
        cand = session.get(Candidate, sync_rec.entity_id)
        if cand:
            cand.full_name = name_str
            cand.age = age
            cand.specialization = spec
            cand.contacts = contacts
            cand.notes = notes_text
            cand.tags = tags
            sync_rec.row_hash = h
            sync_rec.sync_error = None
            sync_rec.last_synced_at = datetime.now(timezone.utc)
            return
    else:
        existing = None
        if phone:
            existing = session.execute(
                select(Candidate).where(
                    Candidate.contacts["phone"].astext == phone
                )
            ).scalar_one_or_none()

        if existing:
            cand = existing
        else:
            cand = Candidate(
                full_name=name_str,
                age=age,
                specialization=spec,
                contacts=contacts,
                notes=notes_text,
                tags=tags,
            )
            session.add(cand)
            session.flush()

    if sync_rec:
        sync_rec.entity_id = cand.id
        sync_rec.row_hash = h
        sync_rec.sync_error = None
        sync_rec.last_synced_at = datetime.now(timezone.utc)
    else:
        session.add(SheetSyncRow(
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            row_number=row_num,
            row_hash=h,
            entity_type="candidate",
            entity_id=cand.id,
        ))


# ── Comment → Task note ──────────────────────────────────────────────────────

def _save_comment_as_task(session, comment_text: str, entity_id: _uuid.UUID, entity_type: str,
                           author: str | None):
    from app.models.crm_task import Task
    from sqlalchemy import select

    existing = session.execute(
        select(Task).where(
            Task.entity_type == entity_type,
            Task.entity_id == entity_id,
            Task.description == comment_text,
        )
    ).scalar_one_or_none()

    if existing:
        return

    title = f"Комментарий: {author or 'из таблицы'}"
    session.add(Task(
        title=title,
        description=comment_text,
        entity_type=entity_type,
        entity_id=entity_id,
        status="done",
        priority="normal",
    ))


# ── Spreadsheet reader ───────────────────────────────────────────────────────

def _open_spreadsheet():
    if not settings.google_credentials_file or not settings.google_sheets_spreadsheet_id:
        return None
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ]
        creds = Credentials.from_service_account_file(settings.google_credentials_file, scopes=scopes)
        gc = gspread.authorize(creds)
        return gc.open_by_key(settings.google_sheets_spreadsheet_id)
    except Exception as exc:
        log.warning("gspread open failed: %s", exc)
        return None


def _fetch_sheet_rows_gspread(spreadsheet, sheet_name: str) -> list[list[Any]]:
    try:
        ws = spreadsheet.worksheet(sheet_name)
        return ws.get_all_values()
    except Exception as exc:
        log.warning("gspread fetch sheet '%s' failed: %s", sheet_name, exc)
        return []


def _fetch_sheet_comments_gspread(spreadsheet, sheet_name: str) -> dict[tuple[int, int], str]:
    comments: dict[tuple[int, int], str] = {}
    if not settings.google_credentials_file or not settings.google_sheets_spreadsheet_id:
        return comments
    try:
        import google.auth.transport.requests
        import requests as _requests
        from google.oauth2.service_account import Credentials

        scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        creds = Credentials.from_service_account_file(settings.google_credentials_file, scopes=scopes)
        creds.refresh(google.auth.transport.requests.Request())

        ws = spreadsheet.worksheet(sheet_name)
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{settings.google_sheets_spreadsheet_id}"
            f"?includeGridData=false&ranges={sheet_name}"
            f"&fields=sheets(data/rowData/values/note)"
        )
        resp = _requests.get(url, headers={"Authorization": f"Bearer {creds.token}"})
        data = resp.json()

        for sheet_data in data.get("sheets", []):
            for r_idx, row_data in enumerate(sheet_data.get("data", [{}])[0].get("rowData", [])):
                for c_idx, cell in enumerate(row_data.get("values", [])):
                    note = cell.get("note", "").strip()
                    if note:
                        comments[(r_idx, c_idx)] = note
    except Exception as exc:
        log.debug("fetch comments failed: %s", exc)
    return comments


def _get_rows_for_sheet(spreadsheet, spreadsheet_id: str, sheet_name: str) -> list[list[Any]]:
    if spreadsheet:
        rows = _fetch_sheet_rows_gspread(spreadsheet, sheet_name)
        if rows:
            return rows
    return _fetch_sheet_via_csv(spreadsheet_id, sheet_name)


def _fetch_sheet_via_csv(spreadsheet_id: str, sheet_name: str) -> list[list[Any]]:
    import csv
    import io
    import urllib.request
    import urllib.parse

    url = (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        f"/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        return list(reader)
    except Exception as exc:
        log.warning("CSV fetch for sheet '%s' failed: %s", sheet_name, exc)
        return []


def _attach_row_comments(session, comments: dict[tuple[int, int], str],
                          row_idx: int, sheet_name: str, spreadsheet_id: str):
    from sqlalchemy import select
    from app.models.sheets_sync import SheetSyncRow

    sync_rec = session.execute(
        select(SheetSyncRow).where(
            SheetSyncRow.spreadsheet_id == spreadsheet_id,
            SheetSyncRow.sheet_name == sheet_name,
            SheetSyncRow.row_number == row_idx,
        )
    ).scalar_one_or_none()

    if not sync_rec or not sync_rec.entity_id:
        return

    for (r, _c), note in comments.items():
        if r == row_idx:
            _save_comment_as_task(
                session, note, sync_rec.entity_id, sync_rec.entity_type or "deal", author=None
            )


# ── Main sync task ───────────────────────────────────────────────────────────

@celery_app.task(name="tasks.sync_google_sheets", bind=True, max_retries=3)
def sync_google_sheets(self):
    """
    Main Google Sheets → CRM sync task.
    Scheduled every N seconds by Celery Beat.
    """
    spreadsheet_id = settings.google_sheets_spreadsheet_id
    if not spreadsheet_id:
        log.info("sync_google_sheets: GOOGLE_SHEETS_SPREADSHEET_ID not set, skipping")
        return {"status": "skipped", "reason": "no spreadsheet_id"}

    engine = _get_engine()
    spreadsheet = _open_spreadsheet()

    stats = {
        "deals_created": 0,
        "deals_updated": 0,
        "candidates_created": 0,
        "skipped": 0,
        "errors": 0,
    }

    try:
        from sqlalchemy.orm import Session
        with Session(engine) as session:

            # ── Vacancy sheets → Deals ────────────────────────────────────────
            for sheet_name in VACANCY_SHEETS:
                try:
                    rows = _get_rows_for_sheet(spreadsheet, spreadsheet_id, sheet_name)
                    comments = _fetch_sheet_comments_gspread(spreadsheet, sheet_name) if spreadsheet else {}

                    for row_idx, row in enumerate(rows):
                        if row_idx == 0:
                            continue  # header
                        if not any(c for c in row if c):
                            continue  # fully empty

                        # Layer 1: save raw
                        try:
                            raw_rec = _upsert_raw_row(session, row, sheet_name, row_idx, spreadsheet_id)
                        except Exception as exc:
                            log.warning("raw_row save error row %d sheet '%s': %s", row_idx, sheet_name, exc)
                            raw_rec = None

                        # Layer 2: normalize and upsert deal
                        try:
                            changed = _upsert_deal(session, row, sheet_name, row_idx, spreadsheet_id,
                                                   raw_rec=raw_rec)
                            if changed:
                                stats["deals_updated"] += 1
                            else:
                                stats["skipped"] += 1

                            # Attach sheet comments as task notes
                            if comments:
                                _attach_row_comments(session, comments, row_idx, sheet_name, spreadsheet_id)
                        except Exception as exc:
                            log.warning("deal upsert error row %d sheet '%s': %s", row_idx, sheet_name, exc)
                            _record_sync_error(
                                session, spreadsheet_id, sheet_name, row_idx,
                                "parse_error", str(exc),
                            )
                            if raw_rec:
                                raw_rec.parse_status = "error"
                                raw_rec.parse_error = str(exc)
                            stats["errors"] += 1

                    session.commit()
                    log.info("sync sheet '%s': done", sheet_name)
                except Exception as exc:
                    log.warning("sync sheet '%s' failed: %s", sheet_name, exc)
                    _record_sync_error(session, spreadsheet_id, sheet_name, None,
                                       "sheet_error", str(exc))
                    try:
                        session.commit()
                    except Exception:
                        session.rollback()
                    stats["errors"] += 1

            # ── Candidate sheets → Candidates ──────────────────────────────
            for sheet_name in CANDIDATE_SHEETS:
                try:
                    rows = _get_rows_for_sheet(spreadsheet, spreadsheet_id, sheet_name)

                    for row_idx, row in enumerate(rows):
                        if row_idx == 0:
                            continue
                        if not any(c for c in row if c):
                            continue
                        try:
                            _upsert_candidate(session, row, sheet_name, row_idx, spreadsheet_id)
                            stats["candidates_created"] += 1
                        except Exception as exc:
                            log.warning("candidate upsert error row %d sheet '%s': %s", row_idx, sheet_name, exc)
                            _record_sync_error(session, spreadsheet_id, sheet_name, row_idx,
                                               "parse_error", str(exc))
                            stats["errors"] += 1

                    session.commit()
                    log.info("sync sheet '%s': done", sheet_name)
                except Exception as exc:
                    log.warning("sync sheet '%s' failed: %s", sheet_name, exc)
                    _record_sync_error(session, spreadsheet_id, sheet_name, None,
                                       "sheet_error", str(exc))
                    try:
                        session.commit()
                    except Exception:
                        session.rollback()
                    stats["errors"] += 1

    except Exception as exc:
        log.error("sync_google_sheets fatal error: %s", exc)
        raise self.retry(exc=exc, countdown=60)
    finally:
        engine.dispose()

    log.info("sync_google_sheets finished: %s", stats)
    return stats
