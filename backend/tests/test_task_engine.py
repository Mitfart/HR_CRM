"""Unit tests for task_engine helpers."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest


def _make_template(key: str, sla_hours: int = 24, priority: str = "normal"):
    t = MagicMock()
    t.id = uuid.uuid4()
    t.title = f"Задача {key}"
    t.description_template = None
    t.priority = priority
    t.sla_hours = sla_hours
    t.assignee_role = "owner"
    t.template_key = key
    return t


def _make_session(templates=None, existing_task=None):
    session = MagicMock()

    # Mock select().where().order_by() chain for templates
    template_result = MagicMock()
    template_result.scalars.return_value.all.return_value = templates or []

    # Mock select().where() chain for existing task check
    task_check = MagicMock()
    task_check.scalar_one_or_none.return_value = existing_task

    session.execute.side_effect = [template_result, task_check] * 10
    return session


def test_spawn_tasks_creates_task():
    """spawn_tasks_for_stage creates a task with correct SLA."""
    from app.task_engine import spawn_tasks_for_stage
    from app.models.crm_task import Task

    tmpl = _make_template("test_key", sla_hours=8, priority="high")
    session = MagicMock()
    session.execute.return_value.scalars.return_value.all.return_value = [tmpl]

    # No existing task with this key
    check_result = MagicMock()
    check_result.scalar_one_or_none.return_value = None
    session.execute.side_effect = [
        MagicMock(**{"scalars.return_value.all.return_value": [tmpl]}),
        check_result,
    ]

    entity_id = uuid.uuid4()
    stage_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    before = datetime.now(timezone.utc)
    count = spawn_tasks_for_stage(session, "deal", entity_id, stage_id, owner_id)
    after = datetime.now(timezone.utc)

    assert count == 1
    assert session.add.called
    added_task = session.add.call_args[0][0]
    assert isinstance(added_task, Task)
    assert added_task.title == tmpl.title
    assert added_task.priority == "high"
    assert added_task.template_key == "test_key"
    assert added_task.assignee_id == owner_id
    assert added_task.entity_id == entity_id
    # SLA due_at should be ~8h from now
    assert added_task.sla_due_at is not None
    assert before + timedelta(hours=7) < added_task.sla_due_at < after + timedelta(hours=9)


def test_spawn_tasks_skips_duplicate():
    """spawn_tasks_for_stage skips tasks whose template_key already exists."""
    from app.task_engine import spawn_tasks_for_stage

    tmpl = _make_template("existing_key", sla_hours=24)
    existing_task = MagicMock()  # simulate already-existing task

    session = MagicMock()
    session.execute.side_effect = [
        MagicMock(**{"scalars.return_value.all.return_value": [tmpl]}),
        MagicMock(**{"scalar_one_or_none.return_value": existing_task}),
    ]

    count = spawn_tasks_for_stage(session, "deal", uuid.uuid4(), uuid.uuid4(), uuid.uuid4())
    assert count == 0
    session.add.assert_not_called()


def test_close_open_tasks():
    """close_open_tasks_for_entity returns count of cancelled tasks."""
    from app.task_engine import close_open_tasks_for_entity

    session = MagicMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("id1",), ("id2",)]  # 2 tasks cancelled
    session.execute.return_value = mock_result

    count = close_open_tasks_for_entity(session, "deal", uuid.uuid4())
    assert count == 2
