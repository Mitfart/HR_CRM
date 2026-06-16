from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())

SOURCE_DEFINITIONS: dict[str, dict[str, str]] = {
    "pomogatel": {
        "label": "Pomogatel.ru",
        "base_url": "https://pomogatel.ru/",
        "purpose": "Отклики на вакансии домашнего персонала",
    },
    "hh": {
        "label": "HH.ru",
        "base_url": "https://hh.ru/account/login",
        "purpose": "Отклики и резюме с HeadHunter",
    },
}


def supported_source(source: str) -> str:
    normalized = source.strip().lower()
    if normalized not in SOURCE_DEFINITIONS:
        raise ValueError(f"Unsupported source: {source}")
    return normalized


def ensure_integration_state(state: dict[str, list[dict[str, Any]]]) -> None:
    state.setdefault("vacancies", [])
    state.setdefault("responses", [])
    state.setdefault("source_integrations", [])
    state.setdefault("source_sync_runs", [])


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _find_vacancy_by_title(state: dict[str, list[dict[str, Any]]], title: str, source: str) -> dict[str, Any] | None:
    normalized_title = title.casefold()
    return next(
        (
            vacancy
            for vacancy in state["vacancies"]
            if _norm_text(vacancy.get("title")).casefold() == normalized_title
            and _norm_text(vacancy.get("source") or source).casefold() == source
        ),
        None,
    )


def _find_response_duplicate(
    state: dict[str, list[dict[str, Any]]],
    *,
    source: str,
    external_id: str,
    source_url: str,
    vacancy_id: str,
    candidate_name: str,
) -> dict[str, Any] | None:
    for response in state["responses"]:
        if _norm_text(response.get("source")).casefold() != source:
            continue
        if external_id and _norm_text(response.get("external_id")) == external_id:
            return response
        if source_url and _norm_text(response.get("source_url")) == source_url:
            return response
        same_candidate = _norm_text(response.get("candidate_name")).casefold() == candidate_name.casefold()
        same_vacancy = _norm_text(response.get("vacancy_id")) == vacancy_id
        if same_candidate and same_vacancy:
            return response
    return None


def _create_vacancy(
    state: dict[str, list[dict[str, Any]]],
    *,
    source: str,
    title: str,
    actor: dict[str, str | None],
) -> dict[str, Any]:
    item = {
        "id": new_id(),
        "title": title,
        "client_name": None,
        "requirements": None,
        "conditions": None,
        "source": source,
        "status": "active",
        "responsible_user_id": actor.get("actor_user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **actor,
    }
    state["vacancies"].insert(0, item)
    return item


def _integration_record(state: dict[str, list[dict[str, Any]]], source: str) -> dict[str, Any]:
    found = next((item for item in state["source_integrations"] if item.get("source") == source), None)
    if found:
        return found
    definition = SOURCE_DEFINITIONS[source]
    item = {
        "id": new_id(),
        "source": source,
        "label": definition["label"],
        "status": "configured",
        "enabled": True,
        "base_url": definition["base_url"],
        "purpose": definition["purpose"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    state["source_integrations"].append(item)
    return item


def record_sync_run(
    state: dict[str, list[dict[str, Any]]],
    *,
    source: str,
    status: str,
    message: str,
    summary: dict[str, Any] | None = None,
    actor: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    ensure_integration_state(state)
    source = supported_source(source)
    integration = _integration_record(state, source)
    run = {
        "id": new_id(),
        "source": source,
        "status": status,
        "message": message,
        "summary": summary or {},
        "created_at": now_iso(),
        **(actor or {"actor_user_id": None, "actor_name": "system"}),
    }
    state["source_sync_runs"].insert(0, run)
    state["source_sync_runs"] = state["source_sync_runs"][:200]
    integration["status"] = status
    integration["last_run_at"] = run["created_at"]
    integration["last_message"] = message
    integration["last_summary"] = summary or {}
    integration["updated_at"] = now_iso()
    return run


def build_integrations_status(state: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    ensure_integration_state(state)
    result = []
    for source, definition in SOURCE_DEFINITIONS.items():
        record = _integration_record(state, source)
        last_run = next((run for run in state["source_sync_runs"] if run.get("source") == source), None)
        result.append(
            {
                "id": record["id"],
                "source": source,
                "label": definition["label"],
                "enabled": record.get("enabled", True),
                "base_url": definition["base_url"],
                "purpose": definition["purpose"],
                "last_status": (last_run or record).get("status", "not_checked"),
                "last_message": (last_run or record).get("message") or record.get("last_message"),
                "last_run_at": (last_run or record).get("created_at") or record.get("last_run_at"),
                "last_summary": (last_run or record).get("summary") or record.get("last_summary") or {},
            }
        )
    return result


def import_external_responses(
    state: dict[str, list[dict[str, Any]]],
    *,
    source: str,
    rows: list[dict[str, Any]],
    actor: dict[str, str | None],
    default_vacancy_id: str | None = None,
) -> dict[str, Any]:
    ensure_integration_state(state)
    source = supported_source(source)
    _integration_record(state, source)
    summary = {
        "source": source,
        "received": len(rows),
        "created_vacancies": 0,
        "created_responses": 0,
        "duplicates": 0,
        "skipped": 0,
    }
    for row in rows:
        candidate_name = _norm_text(row.get("candidate_name") or row.get("name"))
        if not candidate_name:
            summary["skipped"] += 1
            continue

        vacancy_id = _norm_text(row.get("vacancy_id") or default_vacancy_id)
        vacancy_title = _norm_text(row.get("vacancy_title") or row.get("vacancy") or "Вакансия из " + SOURCE_DEFINITIONS[source]["label"])
        vacancy = None
        if vacancy_id:
            vacancy = next((item for item in state["vacancies"] if item.get("id") == vacancy_id), None)
        if not vacancy:
            vacancy = _find_vacancy_by_title(state, vacancy_title, source)
        if not vacancy:
            vacancy = _create_vacancy(state, source=source, title=vacancy_title, actor=actor)
            summary["created_vacancies"] += 1
        vacancy_id = str(vacancy["id"])

        external_id = _norm_text(row.get("external_id") or row.get("id"))
        source_url = _norm_text(row.get("source_url") or row.get("url"))
        duplicate = _find_response_duplicate(
            state,
            source=source,
            external_id=external_id,
            source_url=source_url,
            vacancy_id=vacancy_id,
            candidate_name=candidate_name,
        )
        if duplicate:
            duplicate["updated_at"] = now_iso()
            duplicate["last_seen_at"] = now_iso()
            summary["duplicates"] += 1
            continue

        item = {
            "id": new_id(),
            "vacancy_id": vacancy_id,
            "responsible_user_id": vacancy.get("responsible_user_id") or actor.get("actor_user_id"),
            "candidate_name": candidate_name,
            "source": source,
            "external_id": external_id or None,
            "source_url": source_url or None,
            "phone": _norm_text(row.get("phone")) or None,
            "email": _norm_text(row.get("email")) or None,
            "message": _norm_text(row.get("message") or row.get("comment")) or None,
            "status": _norm_text(row.get("status")) or "new",
            "received_at": _norm_text(row.get("received_at")) or now_iso(),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            **actor,
        }
        state["responses"].insert(0, item)
        summary["created_responses"] += 1
    return summary
