"""
Google Sheets → CRM deals sync.

This version syncs sheet rows directly into existing `applications` records
that are shown in the Deals tab. It avoids deprecated CRM deal models.
"""

import logging
import re
from datetime import datetime
from typing import Any

from app.celery_app import celery_app
from app.config import settings

log = logging.getLogger(__name__)

# ── Sheet classification ─────────────────────────────────────────────────────

VACANCY_SHEETS = ("вакансии 26", "вакансии 25", "вакансии 24", "ранжирование")
DEAL_MARKER_PREFIX = "[deal-sync]"

# ── Helpers ──────────────────────────────────────────────────────────────────

def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _marker(sheet_name: str, row_number: int) -> str:
    return f"{DEAL_MARKER_PREFIX} {sheet_name}#{row_number}"


def _get_engine():
    from sqlalchemy import create_engine
    url = settings.database_url.replace("+asyncpg", "")
    return create_engine(url, pool_pre_ping=True)


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


def _is_data_row(client_value: str | None) -> bool:
    if not client_value:
        return False
    low = client_value.lower()
    if low in {"клиент", "client", "кому"}:
        return False
    if re.match(r"^[А-Яа-яЁёA-Za-z]+$", client_value) and len(client_value) < 15:
        return False
    return True


@celery_app.task(name="tasks.sync_google_sheets", bind=True, max_retries=3)
def sync_google_sheets(self):
    """Upsert Google Sheets rows into applications for Deals tab."""
    spreadsheet_id = settings.google_sheets_spreadsheet_id
    if not spreadsheet_id:
        log.info("sync_google_sheets: GOOGLE_SHEETS_SPREADSHEET_ID not set, skipping")
        return {"status": "skipped", "reason": "no spreadsheet_id"}

    engine = _get_engine()
    stats = {
        "processed": 0,
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
    }

    try:
        from sqlalchemy import select
        from sqlalchemy.orm import Session
        from app.models.application import Application

        with Session(engine) as session:
            for sheet_name in VACANCY_SHEETS:
                try:
                    rows = _fetch_sheet_via_csv(spreadsheet_id, sheet_name)
                    if not rows:
                        continue

                    for row_idx, row in enumerate(rows):
                        if row_idx == 0:
                            continue
                        if not any(_clean(cell) for cell in row):
                            continue

                        stats["processed"] += 1
                        cols = list(row) + [None] * 10
                        date_raw, manager_raw, client_raw, source_raw, schedule_raw, pos_raw, salary_raw, loc_raw = cols[:8]
                        client = _clean(client_raw)
                        if not _is_data_row(client):
                            stats["skipped"] += 1
                            continue

                        marker = _marker(sheet_name, row_idx)
                        manager = _clean(manager_raw)
                        parts = [
                            f"Клиент: {client}",
                            f"Позиция: {_clean(pos_raw) or 'не указана'}",
                            f"График: {_clean(schedule_raw) or 'не указан'}",
                            f"Локация: {_clean(loc_raw) or 'не указана'}",
                            f"Источник: {_clean(source_raw) or 'не указан'}",
                            f"Оплата: {_clean(salary_raw) or 'не указана'}",
                        ]
                        if _clean(date_raw):
                            parts.append(f"Дата: {_clean(date_raw)}")
                        description = " | ".join(parts)
                        search_payload = {
                            "sheet_name": sheet_name,
                            "sheet_row": row_idx,
                            "manager": manager,
                            "client_raw": client,
                            "position": _clean(pos_raw),
                            "schedule": _clean(schedule_raw),
                            "salary_text": _clean(salary_raw),
                            "location": _clean(loc_raw),
                            "source": _clean(source_raw),
                            "date_raw": _clean(date_raw),
                            "synced_at": datetime.utcnow().isoformat(),
                        }
                        notes = marker + (f" | Менеджер: {manager}" if manager else "")

                        existing = session.execute(
                            select(Application).where(Application.manager_notes.ilike(f"{marker}%"))
                        ).scalar_one_or_none()
                        if existing:
                            existing.description = description
                            existing.max_contact = client
                            existing.manager_notes = notes
                            existing.search_params = search_payload
                            stats["updated"] += 1
                        else:
                            session.add(
                                Application(
                                    description=description,
                                    status="new",
                                    max_contact=client,
                                    manager_notes=notes,
                                    search_params=search_payload,
                                )
                            )
                            stats["created"] += 1

                    session.commit()
                    log.info("sync sheet '%s': done", sheet_name)
                except Exception as exc:
                    log.warning("sync sheet '%s' failed: %s", sheet_name, exc)
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
