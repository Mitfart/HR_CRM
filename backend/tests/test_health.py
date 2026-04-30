"""Unit tests for crm_health helpers."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


# ── _inspect_celery ───────────────────────────────────────────────────────────

def test_inspect_celery_reachable():
    """_inspect_celery returns worker info when Celery responds."""
    from app.routers.crm_health import _inspect_celery

    mock_inspector = MagicMock()
    mock_inspector.active.return_value = {
        "celery@worker1": [{"id": "task-1", "name": "tasks.sync_google_sheets"}]
    }
    mock_inspector.scheduled.return_value = {"celery@worker1": []}
    mock_inspector.registered.return_value = {
        "celery@worker1": ["tasks.sync_google_sheets", "tasks.check_overdue_tasks"]
    }
    mock_inspector.stats.return_value = {
        "celery@worker1": {"pool": {"max-concurrency": 4, "processes": [1234, 1235]}}
    }

    with patch("app.routers.crm_health.celery_app") as mock_app:
        mock_app.control.inspect.return_value = mock_inspector
        result = _inspect_celery()

    assert result["reachable"] is True
    assert result["worker_count"] == 1
    assert result["workers"][0]["name"] == "celery@worker1"
    assert result["workers"][0]["active_tasks"] == 1
    assert result["workers"][0]["concurrency"] == 4


def test_inspect_celery_no_workers():
    """_inspect_celery handles empty worker list gracefully."""
    from app.routers.crm_health import _inspect_celery

    mock_inspector = MagicMock()
    mock_inspector.active.return_value = {}
    mock_inspector.scheduled.return_value = {}
    mock_inspector.registered.return_value = {}
    mock_inspector.stats.return_value = {}

    with patch("app.routers.crm_health.celery_app") as mock_app:
        mock_app.control.inspect.return_value = mock_inspector
        result = _inspect_celery()

    assert result["reachable"] is True
    assert result["worker_count"] == 0
    assert result["workers"] == []


def test_inspect_celery_timeout():
    """_inspect_celery returns reachable=False on exception (e.g. broker down)."""
    from app.routers.crm_health import _inspect_celery

    with patch("app.routers.crm_health.celery_app") as mock_app:
        mock_app.control.inspect.side_effect = Exception("Connection refused")
        result = _inspect_celery()

    assert result["reachable"] is False
    assert result["worker_count"] == 0
    assert "Connection refused" in result["error"]


def test_inspect_celery_inspect_returns_none():
    """_inspect_celery handles None returns from inspect methods (no workers up)."""
    from app.routers.crm_health import _inspect_celery

    mock_inspector = MagicMock()
    mock_inspector.active.return_value = None
    mock_inspector.scheduled.return_value = None
    mock_inspector.registered.return_value = None
    mock_inspector.stats.return_value = None

    with patch("app.routers.crm_health.celery_app") as mock_app:
        mock_app.control.inspect.return_value = mock_inspector
        result = _inspect_celery()

    assert result["reachable"] is True
    assert result["worker_count"] == 0
