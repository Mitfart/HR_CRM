"""
Task Engine — auto-creates tasks from TaskTemplate definitions when a deal enters a stage.

Called by:
  - run_automation_rules Celery task (existing automation path)
  - Direct call from crm_deals router on stage change

Also exposes:
  - check_overdue_tasks()  — Celery beat task to mark tasks overdue and escalate
  - seed_default_templates() — one-time seeding of stage task templates
"""
import logging
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from typing import Any

log = logging.getLogger(__name__)

# ── Standard vacancy pipeline stages with task templates ─────────────────────
# Format: stage_name → list of {title, description, priority, sla_hours, assignee_role, template_key}

DEFAULT_TEMPLATES: dict[str, list[dict]] = {
    "Новая": [
        {
            "title": "Проверить и заполнить бриф вакансии",
            "description": "Убедиться, что заполнены все обязательные поля: тип персонала, тип занятости, зарплата, локация. При необходимости — уточнить у клиента.",
            "priority": "high",
            "sla_hours": 4,
            "assignee_role": "owner",
            "template_key": "new_fill_brief",
        },
        {
            "title": "Опубликовать вакансию в каналах",
            "description": "Разместить в Telegram, HeadHunter, Помогатор согласно настройкам вакансии.",
            "priority": "normal",
            "sla_hours": 8,
            "assignee_role": "owner",
            "template_key": "new_publish_channels",
        },
    ],
    "Бриф подтверждён": [
        {
            "title": "Начать активный поиск кандидатов",
            "description": "Открыть поиск по базе и внешним источникам. Цель — минимум 5 релевантных кандидатов.",
            "priority": "high",
            "sla_hours": 24,
            "assignee_role": "owner",
            "template_key": "brief_start_search",
        },
    ],
    "Поиск кандидатов": [
        {
            "title": "Набрать шорт-лист: минимум 3 кандидата",
            "description": "Отобрать кандидатов, соответствующих требованиям вакансии. Записать результаты в карточку.",
            "priority": "high",
            "sla_hours": 48,
            "assignee_role": "owner",
            "template_key": "search_collect_shortlist",
        },
    ],
    "Шорт-лист отправлен": [
        {
            "title": "Получить обратную связь от клиента по шорт-листу",
            "description": "Позвонить или написать клиенту, уточнить мнение по кандидатам, скорректировать список при необходимости.",
            "priority": "normal",
            "sla_hours": 48,
            "assignee_role": "owner",
            "template_key": "shortlist_get_feedback",
        },
    ],
    "Собеседования": [
        {
            "title": "Follow-up с клиентом: итоги собеседований",
            "description": "Через 48 часов уточнить у клиента результаты интервью и следующие шаги.",
            "priority": "normal",
            "sla_hours": 48,
            "assignee_role": "owner",
            "template_key": "interview_followup",
        },
    ],
    "Оффер": [
        {
            "title": "Проверить документы кандидата",
            "description": "Убедиться в наличии необходимых документов: паспорт, санкнижка, рекомендации.",
            "priority": "high",
            "sla_hours": 24,
            "assignee_role": "owner",
            "template_key": "offer_check_docs",
        },
        {
            "title": "Согласовать дату выхода с клиентом и кандидатом",
            "description": "Зафиксировать дату начала работы в карточке вакансии (поле start_date_planned).",
            "priority": "high",
            "sla_hours": 48,
            "assignee_role": "owner",
            "template_key": "offer_confirm_start_date",
        },
    ],
    "Выход/пробные дни": [
        {
            "title": "Фидбек: 1-й день",
            "description": "Связаться с клиентом и кандидатом после первого рабочего дня.",
            "priority": "high",
            "sla_hours": 28,
            "assignee_role": "owner",
            "template_key": "trial_feedback_day1",
        },
        {
            "title": "Фидбек: 3-й день",
            "description": "Связаться с клиентом и кандидатом на третий день испытательного срока.",
            "priority": "normal",
            "sla_hours": 72,
            "assignee_role": "owner",
            "template_key": "trial_feedback_day3",
        },
        {
            "title": "Фидбек: 7-й день",
            "description": "Итоговая проверка по окончании испытательной недели.",
            "priority": "normal",
            "sla_hours": 168,
            "assignee_role": "owner",
            "template_key": "trial_feedback_day7",
        },
    ],
    "Закрыт успешно": [
        {
            "title": "Зафиксировать успешное закрытие и причину",
            "description": "Заполнить комментарий к вакансии, убедиться, что все открытые задачи закрыты.",
            "priority": "normal",
            "sla_hours": 4,
            "assignee_role": "owner",
            "template_key": "closed_won_finalize",
        },
    ],
    "Отменён": [
        {
            "title": "Зафиксировать причину отмены",
            "description": "Указать причину отмены в notes вакансии и закрыть все открытые задачи.",
            "priority": "normal",
            "sla_hours": 4,
            "assignee_role": "owner",
            "template_key": "cancelled_finalize",
        },
    ],
}


def _get_engine():
    from sqlalchemy import create_engine
    from app.config import settings
    url = settings.database_url.replace("+asyncpg", "")
    return create_engine(url, pool_pre_ping=True)


def seed_default_templates(session) -> int:
    """
    Seed DEFAULT_TEMPLATES into crm_task_templates for the Вакансии pipeline.
    Safe to call multiple times — uses template_key to avoid duplicates.
    Returns count of templates inserted.
    """
    from sqlalchemy import select
    from app.models.crm_pipeline import Pipeline, Stage
    from app.models.crm_task_template import TaskTemplate

    pipeline = session.execute(
        select(Pipeline).where(Pipeline.name == "Вакансии", Pipeline.entity_type == "deal")
    ).scalar_one_or_none()

    if not pipeline:
        log.warning("seed_default_templates: pipeline 'Вакансии' not found, skipping")
        return 0

    stages = session.execute(
        select(Stage).where(Stage.pipeline_id == pipeline.id)
    ).scalars().all()
    stage_map = {s.name: s.id for s in stages}

    inserted = 0
    for stage_name, templates in DEFAULT_TEMPLATES.items():
        stage_id = stage_map.get(stage_name)
        if not stage_id:
            log.warning("seed_default_templates: stage '%s' not found, skipping", stage_name)
            continue

        for t in templates:
            existing = session.execute(
                select(TaskTemplate).where(TaskTemplate.template_key == t["template_key"])
            ).scalar_one_or_none()
            if existing:
                continue

            session.add(TaskTemplate(
                stage_id=stage_id,
                title=t["title"],
                description_template=t.get("description"),
                priority=t.get("priority", "normal"),
                sla_hours=t.get("sla_hours"),
                assignee_role=t.get("assignee_role", "owner"),
                template_key=t["template_key"],
                is_active=True,
                sort_order=t.get("sort_order", 0),
            ))
            inserted += 1

    session.flush()
    log.info("seed_default_templates: inserted %d templates", inserted)
    return inserted


def spawn_tasks_for_stage(
    session,
    entity_type: str,
    entity_id: _uuid.UUID,
    stage_id: _uuid.UUID,
    owner_id: _uuid.UUID | None,
) -> int:
    """
    Create tasks from TaskTemplate definitions for a given stage.
    Skips templates whose template_key already exists for this entity (idempotent).
    Returns number of tasks created.
    """
    from sqlalchemy import select
    from app.models.crm_task import Task
    from app.models.crm_task_template import TaskTemplate

    templates = session.execute(
        select(TaskTemplate).where(
            TaskTemplate.stage_id == stage_id,
            TaskTemplate.is_active == True,
        ).order_by(TaskTemplate.sort_order)
    ).scalars().all()

    created = 0
    now = datetime.now(timezone.utc)

    for tmpl in templates:
        # Idempotency: skip if task with this template_key already exists for entity
        if tmpl.template_key:
            already = session.execute(
                select(Task).where(
                    Task.entity_type == entity_type,
                    Task.entity_id == entity_id,
                    Task.template_key == tmpl.template_key,
                    Task.status.not_in(["cancelled"]),
                )
            ).scalar_one_or_none()
            if already:
                continue

        # Resolve assignee
        assignee_id: _uuid.UUID | None = None
        if tmpl.assignee_role == "owner":
            assignee_id = owner_id
        elif tmpl.assignee_role:
            # Could be a UUID string of a specific user
            try:
                assignee_id = _uuid.UUID(tmpl.assignee_role)
            except ValueError:
                assignee_id = owner_id  # fallback

        # Compute SLA deadline
        sla_due_at: datetime | None = None
        due_at: datetime | None = None
        if tmpl.sla_hours:
            sla_due_at = now + timedelta(hours=tmpl.sla_hours)
            due_at = sla_due_at

        task = Task(
            title=tmpl.title,
            description=tmpl.description_template,
            status="new",
            priority=tmpl.priority,
            due_at=due_at,
            sla_hours=tmpl.sla_hours,
            sla_due_at=sla_due_at,
            assignee_id=assignee_id,
            entity_type=entity_type,
            entity_id=entity_id,
            template_key=tmpl.template_key,
        )
        session.add(task)
        created += 1

    return created


def close_open_tasks_for_entity(session, entity_type: str, entity_id: _uuid.UUID) -> int:
    """
    Auto-close all open tasks for an entity when it's marked as won/lost.
    Returns number of tasks closed.
    """
    from sqlalchemy import select, update
    from app.models.crm_task import Task

    result = session.execute(
        update(Task)
        .where(
            Task.entity_type == entity_type,
            Task.entity_id == entity_id,
            Task.status.in_(["new", "in_progress"]),
        )
        .values(status="cancelled")
        .returning(Task.id)
    )
    count = len(result.fetchall())
    return count


# ── Celery tasks ──────────────────────────────────────────────────────────────

from app.celery_app import celery_app  # noqa: E402


@celery_app.task(name="tasks.check_overdue_tasks", bind=True)
def check_overdue_tasks(self):
    """
    Celery Beat task — runs every 15 minutes.
    1. Marks tasks overdue when sla_due_at has passed.
    2. Escalates tasks that are overdue AND haven't been escalated within 2 hours.
    3. Creates escalation notifications for the deal owner / team lead.
    """
    from sqlalchemy import create_engine, select, update
    from sqlalchemy.orm import Session

    from app.config import settings
    from app.models.crm_task import Task
    from app.models.crm_notification import Notification
    from app.models.crm_deal import Deal

    engine = create_engine(settings.database_url.replace("+asyncpg", ""), pool_pre_ping=True)
    now = datetime.now(timezone.utc)
    escalation_window = timedelta(hours=2)

    stats = {"newly_overdue": 0, "newly_escalated": 0}

    try:
        with Session(engine) as session:
            # 1. Mark newly overdue (sla_due_at passed, not yet marked, not done/cancelled)
            overdue_result = session.execute(
                update(Task)
                .where(
                    Task.sla_due_at <= now,
                    Task.is_overdue == False,
                    Task.status.not_in(["done", "cancelled"]),
                )
                .values(is_overdue=True)
                .returning(Task.id, Task.entity_type, Task.entity_id, Task.assignee_id, Task.title, Task.sla_due_at)
            )
            newly_overdue = overdue_result.fetchall()
            stats["newly_overdue"] = len(newly_overdue)

            # Notify assignees about overdue tasks
            for row in newly_overdue:
                task_id, ent_type, ent_id, assignee_id, title, sla_due = row
                if assignee_id:
                    session.add(Notification(
                        user_id=assignee_id,
                        title=f"Просроченная задача: {title}",
                        body=f"SLA истёк {sla_due.strftime('%d.%m %H:%M') if sla_due else ''}. Пожалуйста, обновите статус задачи.",
                        entity_type=ent_type or "deal",
                        entity_id=ent_id,
                    ))

            session.flush()

            # 2. Escalate tasks overdue for > 2 hours and not yet escalated
            escalate_cutoff = now - escalation_window
            tasks_to_escalate = session.execute(
                select(Task).where(
                    Task.is_overdue == True,
                    Task.is_escalated == False,
                    Task.sla_due_at <= escalate_cutoff,
                    Task.status.not_in(["done", "cancelled"]),
                )
            ).scalars().all()

            for task in tasks_to_escalate:
                task.is_escalated = True
                task.escalated_at = now

                # Find the deal owner to notify
                notify_user_id = task.assignee_id
                if task.entity_type == "deal" and task.entity_id:
                    deal = session.get(Deal, task.entity_id)
                    if deal and deal.owner_id:
                        notify_user_id = deal.owner_id

                if notify_user_id:
                    session.add(Notification(
                        user_id=notify_user_id,
                        title=f"ЭСКАЛАЦИЯ: задача просрочена более 2 часов",
                        body=f"Задача «{task.title}» требует немедленного внимания руководителя.",
                        entity_type=task.entity_type or "deal",
                        entity_id=task.entity_id,
                    ))
                stats["newly_escalated"] += 1

            session.commit()
    except Exception as exc:
        log.error("check_overdue_tasks error: %s", exc)
        raise self.retry(exc=exc, countdown=120)
    finally:
        engine.dispose()

    log.info("check_overdue_tasks: %s", stats)
    return stats


@celery_app.task(name="tasks.seed_task_templates")
def seed_task_templates_task():
    """One-shot task to seed default templates into DB. Safe to re-run."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.config import settings

    engine = create_engine(settings.database_url.replace("+asyncpg", ""), pool_pre_ping=True)
    with Session(engine) as session:
        count = seed_default_templates(session)
        session.commit()
    engine.dispose()
    return {"seeded": count}
