"""Unit tests for custom external source integrations."""


def test_import_external_responses_creates_vacancy_and_deduplicates():
    from app.services.source_integrations import import_external_responses

    state = {
        "vacancies": [],
        "responses": [],
        "source_sync_runs": [],
        "source_integrations": [],
    }

    summary = import_external_responses(
        state,
        source="pomogatel",
        rows=[
            {
                "external_id": "pmg-1",
                "vacancy_title": "Няня на вечер",
                "candidate_name": "Анна Иванова",
                "phone": "+79990000000",
                "message": "Готова выйти на пробный день",
                "source_url": "https://pomogatel.ru/respond/1",
            },
            {
                "external_id": "pmg-1",
                "vacancy_title": "Няня на вечер",
                "candidate_name": "Анна Иванова",
                "phone": "+79990000000",
                "message": "Повторный дубль",
                "source_url": "https://pomogatel.ru/respond/1",
            },
        ],
        actor={"actor_user_id": "hr-1", "actor_name": "Анна HR"},
    )

    assert summary["source"] == "pomogatel"
    assert summary["created_vacancies"] == 1
    assert summary["created_responses"] == 1
    assert summary["duplicates"] == 1
    assert state["vacancies"][0]["title"] == "Няня на вечер"
    assert state["responses"][0]["candidate_name"] == "Анна Иванова"
    assert state["responses"][0]["external_id"] == "pmg-1"
    assert state["responses"][0]["responsible_user_id"] == "hr-1"


def test_build_integrations_status_uses_last_sync_run():
    from app.services.source_integrations import build_integrations_status

    state = {
        "source_sync_runs": [
            {
                "id": "run-1",
                "source": "hh",
                "status": "blocked",
                "message": "hh.ru returned 451",
                "created_at": "2026-05-14T10:00:00+00:00",
                "summary": {"created_responses": 0},
            }
        ],
        "source_integrations": [],
    }

    statuses = build_integrations_status(state)
    hh = next(item for item in statuses if item["source"] == "hh")

    assert hh["label"] == "HH.ru"
    assert hh["last_status"] == "blocked"
    assert hh["last_message"] == "hh.ru returned 451"
    assert hh["last_summary"] == {"created_responses": 0}
