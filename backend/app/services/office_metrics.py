from __future__ import annotations

from datetime import datetime
from typing import Any


ACTION_COUNTERS = {
    "pomogatel_response_processed": "responses_processed",
    "resume_version_created": "resumes_created",
    "client_transfer_created": "client_transfers",
    "resume_returned_for_revision": "resume_revisions",
    "candidate_file_uploaded": "candidate_files_uploaded",
    "worker_contract_sent": "worker_contracts_sent",
    "deletion_request_created": "deletion_requests",
}

KPI_WEIGHTS = {
    "responses_processed": 2,
    "resumes_created": 6,
    "client_transfers": 8,
    "candidate_files_uploaded": 1,
    "worker_contracts_sent": 5,
    "incoming_messages": 1,
    "outgoing_messages": 1,
    "cold_outreach": 3,
}


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _in_period(item: dict[str, Any], since: str | None, until: str | None) -> bool:
    created = _parse_dt(str(item.get("created_at") or ""))
    since_dt = _parse_dt(since)
    until_dt = _parse_dt(until)
    if created and since_dt and created < since_dt:
        return False
    if created and until_dt and created > until_dt:
        return False
    return True


def _empty_report(user_id: str, name: str) -> dict[str, Any]:
    return {
        "actor_user_id": user_id,
        "actor_name": name,
        "responses_processed": 0,
        "resumes_created": 0,
        "client_transfers": 0,
        "resume_revisions": 0,
        "candidate_files_uploaded": 0,
        "worker_contracts_sent": 0,
        "deletion_requests": 0,
        "incoming_messages": 0,
        "outgoing_messages": 0,
        "cold_outreach": 0,
        "manual_messages": 0,
        "template_messages": 0,
        "overdue_items": 0,
        "avg_first_response_seconds": None,
        "kpi_points": 0,
        "quality_index": 100,
        "engagement_index": 0,
    }


def build_employee_reports(
    *,
    events: list[dict[str, Any]],
    messages: list[dict[str, Any]] | None = None,
    since: str | None = None,
    until: str | None = None,
) -> dict[str, dict[str, Any]]:
    reports: dict[str, dict[str, Any]] = {}
    first_response_values: dict[str, list[int]] = {}

    for event in events:
        if not isinstance(event, dict) or not _in_period(event, since, until):
            continue
        user_id = str(event.get("actor_user_id") or "system")
        name = str(event.get("actor_name") or "Система")
        report = reports.setdefault(user_id, _empty_report(user_id, name))
        action = str(event.get("action") or "")
        counter = ACTION_COUNTERS.get(action)
        if counter:
            report[counter] += 1
        details = event.get("details") if isinstance(event.get("details"), dict) else {}
        if details.get("overdue"):
            report["overdue_items"] += 1

    for message in messages or []:
        if not isinstance(message, dict) or not _in_period(message, since, until):
            continue
        user_id = str(message.get("owner_user_id") or message.get("actor_user_id") or "unassigned")
        name = str(message.get("owner_name") or message.get("actor_name") or "Не назначен")
        report = reports.setdefault(user_id, _empty_report(user_id, name))
        direction = str(message.get("direction") or "")
        if direction == "incoming":
            report["incoming_messages"] += 1
        elif direction == "outgoing":
            report["outgoing_messages"] += 1
        if message.get("cold_outreach"):
            report["cold_outreach"] += 1
        if message.get("template_key"):
            report["template_messages"] += 1
        else:
            report["manual_messages"] += 1
        first_response = message.get("first_response_seconds")
        if isinstance(first_response, int) and first_response >= 0:
            first_response_values.setdefault(user_id, []).append(first_response)

    for user_id, report in reports.items():
        values = first_response_values.get(user_id, [])
        if values:
            report["avg_first_response_seconds"] = round(sum(values) / len(values))
        points = sum(int(report.get(key) or 0) * weight for key, weight in KPI_WEIGHTS.items())
        points -= int(report.get("resume_revisions") or 0) * 2
        points -= int(report.get("overdue_items") or 0) * 3
        report["kpi_points"] = max(points, 0)
        result_actions = (
            int(report["responses_processed"])
            + int(report["resumes_created"])
            + int(report["client_transfers"])
            + int(report["worker_contracts_sent"])
        )
        activity_actions = int(report["incoming_messages"]) + int(report["outgoing_messages"])
        report["engagement_index"] = min(result_actions * 10 + activity_actions * 2, 100)
        penalties = int(report["resume_revisions"]) * 8 + int(report["overdue_items"]) * 10
        report["quality_index"] = max(100 - penalties, 0)

    return reports


def build_admin_attention(
    reports: dict[str, dict[str, Any]],
    deletion_requests: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    attention: list[dict[str, Any]] = []
    for req in deletion_requests or []:
        if req.get("status") == "pending":
            attention.append(
                {
                    "kind": "pending_deletion_request",
                    "priority": "high",
                    "title": "Запрос на удаление",
                    "body": f"{req.get('actor_name') or 'Сотрудник'} просит удалить {req.get('entity_type')} {req.get('entity_id')}",
                    "entity_id": req.get("id"),
                }
            )

    for report in reports.values():
        name = report.get("actor_name") or "Сотрудник"
        activity = (
            int(report.get("responses_processed") or 0)
            + int(report.get("outgoing_messages") or 0)
            + int(report.get("resumes_created") or 0)
            + int(report.get("client_transfers") or 0)
        )
        if activity == 0:
            attention.append(
                {
                    "kind": "low_activity",
                    "priority": "medium",
                    "title": "Нет активности за период",
                    "body": f"{name}: нет обработанных откликов, сообщений, резюме или передач клиентскому менеджеру.",
                    "entity_id": report.get("actor_user_id"),
                }
            )
        if int(report.get("overdue_items") or 0) > 0:
            attention.append(
                {
                    "kind": "overdue_work",
                    "priority": "high",
                    "title": "Есть просроченные задачи",
                    "body": f"{name}: просрочено {report.get('overdue_items')} задач.",
                    "entity_id": report.get("actor_user_id"),
                }
            )
    priority_order = {"high": 0, "medium": 1, "low": 2}
    attention.sort(key=lambda item: priority_order.get(str(item.get("priority")), 9))
    return attention
