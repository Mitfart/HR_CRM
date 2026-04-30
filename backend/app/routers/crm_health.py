"""Health & monitoring endpoints.

Endpoints:
  GET /api/health              — basic liveness (no auth)
  GET /api/health/celery       — Celery worker + beat status (admin only)
  GET /api/health/sync         — Google Sheets sync summary (manager+)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.database import get_db
from app.dependencies import require_admin, require_manager
from app.models.raw_legacy_row import RawLegacyRow
from app.models.sync_error import SyncError
from app.models.user import User

router = APIRouter()


# ── Celery helpers ────────────────────────────────────────────────────────────

def _inspect_celery() -> dict[str, Any]:
    """Query Celery inspect interface (synchronous, short timeout)."""
    try:
        inspector = celery_app.control.inspect(timeout=2.0)
        active: dict | None = inspector.active()
        scheduled: dict | None = inspector.scheduled()
        registered: dict | None = inspector.registered()
        stats: dict | None = inspector.stats()

        worker_names = list((active or {}).keys())
        workers = []
        for name in worker_names:
            worker_stats = (stats or {}).get(name, {})
            pool_info = worker_stats.get("pool", {})
            workers.append({
                "name": name,
                "active_tasks": len((active or {}).get(name, [])),
                "scheduled_tasks": len((scheduled or {}).get(name, [])),
                "registered_tasks": (registered or {}).get(name, []),
                "concurrency": pool_info.get("max-concurrency"),
                "processes": pool_info.get("processes", []),
            })

        return {
            "reachable": True,
            "worker_count": len(workers),
            "workers": workers,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "reachable": False,
            "worker_count": 0,
            "workers": [],
            "error": str(exc),
        }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/celery")
async def celery_health(
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    """Return Celery worker liveness and basic queue metrics (admin only).

    Checks:
    - Which workers are reachable (inspect.active with 2 s timeout)
    - How many tasks are currently active / scheduled
    - Which periodic beat tasks are registered in conf
    """
    inspect_result = _inspect_celery()

    # Beat schedule summary — read from in-process config (doesn't need a worker)
    beat_tasks = []
    for name, cfg in (celery_app.conf.beat_schedule or {}).items():
        beat_tasks.append({
            "name": name,
            "task": cfg.get("task"),
            "schedule_seconds": cfg.get("schedule"),
        })

    status = "ok" if inspect_result["reachable"] and inspect_result["worker_count"] > 0 else "degraded"

    return {
        "status": status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        **inspect_result,
        "beat_schedule": beat_tasks,
    }


@router.get("/sync")
async def sync_health(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
) -> dict[str, Any]:
    """Return Google Sheets sync status summary (manager+).

    Reports:
    - Last successful ingest timestamp
    - Counts by parse_status in last 24 h
    - Open (unresolved) sync errors count by error_code
    - Recent error samples
    """
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)

    # Last ingested row timestamp
    last_ingest_row = await db.execute(
        select(func.max(RawLegacyRow.ingested_at))
    )
    last_ingest_at: datetime | None = last_ingest_row.scalar_one_or_none()

    # Counts by parse_status in last 24 h
    status_counts_q = await db.execute(
        select(RawLegacyRow.parse_status, func.count())
        .where(RawLegacyRow.ingested_at >= since_24h)
        .group_by(RawLegacyRow.parse_status)
    )
    parse_status_counts = {row[0]: row[1] for row in status_counts_q.all()}

    # Open sync errors by error_code
    open_errors_q = await db.execute(
        select(SyncError.error_code, func.count())
        .where(SyncError.status.in_(["new", "acknowledged"]))
        .group_by(SyncError.error_code)
        .order_by(func.count().desc())
    )
    open_errors_by_code = [
        {"error_code": row[0], "count": row[1]}
        for row in open_errors_q.all()
    ]
    total_open_errors = sum(r["count"] for r in open_errors_by_code)

    # 5 most recent errors
    recent_errors_q = await db.execute(
        select(
            SyncError.id,
            SyncError.spreadsheet_id,
            SyncError.sheet_name,
            SyncError.row_number,
            SyncError.error_code,
            SyncError.error_message,
            SyncError.status,
            SyncError.created_at,
        )
        .where(SyncError.status.in_(["new", "acknowledged"]))
        .order_by(SyncError.created_at.desc())
        .limit(5)
    )
    recent_errors = [
        {
            "id": str(row.id),
            "spreadsheet_id": row.spreadsheet_id,
            "sheet_name": row.sheet_name,
            "row_number": row.row_number,
            "error_code": row.error_code,
            "error_message": row.error_message,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in recent_errors_q.all()
    ]

    # Determine sync health
    minutes_since_sync: float | None = None
    sync_status = "unknown"
    if last_ingest_at:
        minutes_since_sync = (now - last_ingest_at).total_seconds() / 60
        if minutes_since_sync < 5:
            sync_status = "ok"
        elif minutes_since_sync < 15:
            sync_status = "warning"
        else:
            sync_status = "stale"

    if total_open_errors >= 10:
        sync_status = "degraded"

    return {
        "status": sync_status,
        "checked_at": now.isoformat(),
        "last_ingest_at": last_ingest_at.isoformat() if last_ingest_at else None,
        "minutes_since_last_ingest": round(minutes_since_sync, 1) if minutes_since_sync is not None else None,
        "parse_status_last_24h": parse_status_counts,
        "open_errors_total": total_open_errors,
        "open_errors_by_code": open_errors_by_code,
        "recent_errors": recent_errors,
    }
