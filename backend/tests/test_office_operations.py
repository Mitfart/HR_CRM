"""Unit tests for office activity reports and protected deletion policy."""


def test_build_employee_reports_counts_activity_and_quality():
    from app.services.office_metrics import build_employee_reports

    events = [
        {
            "created_at": "2026-05-13T08:00:00+00:00",
            "actor_user_id": "hr-1",
            "actor_name": "Анна HR",
            "category": "employee",
            "action": "pomogatel_response_processed",
            "entity_type": "job_response",
            "entity_id": "resp-1",
            "details": {},
        },
        {
            "created_at": "2026-05-13T09:00:00+00:00",
            "actor_user_id": "hr-1",
            "actor_name": "Анна HR",
            "category": "employee",
            "action": "resume_version_created",
            "entity_type": "candidate",
            "entity_id": "cand-1",
            "details": {},
        },
        {
            "created_at": "2026-05-13T10:00:00+00:00",
            "actor_user_id": "hr-1",
            "actor_name": "Анна HR",
            "category": "employee",
            "action": "client_transfer_created",
            "entity_type": "client_transfer",
            "entity_id": "transfer-1",
            "details": {},
        },
        {
            "created_at": "2026-05-13T11:00:00+00:00",
            "actor_user_id": "hr-1",
            "actor_name": "Анна HR",
            "category": "employee",
            "action": "resume_returned_for_revision",
            "entity_type": "client_transfer",
            "entity_id": "transfer-1",
            "details": {},
        },
        {
            "created_at": "2026-05-13T12:00:00+00:00",
            "actor_user_id": "hr-2",
            "actor_name": "Игорь HR",
            "category": "employee",
            "action": "worker_contract_sent",
            "entity_type": "worker_contract",
            "entity_id": "contract-1",
            "details": {},
        },
    ]
    messages = [
        {
            "created_at": "2026-05-13T08:05:00+00:00",
            "owner_user_id": "hr-1",
            "owner_name": "Анна HR",
            "direction": "incoming",
            "cold_outreach": False,
            "first_response_seconds": 420,
        },
        {
            "created_at": "2026-05-13T08:10:00+00:00",
            "owner_user_id": "hr-1",
            "owner_name": "Анна HR",
            "direction": "outgoing",
            "cold_outreach": True,
            "first_response_seconds": None,
        },
    ]

    reports = build_employee_reports(events=events, messages=messages)

    anna = reports["hr-1"]
    assert anna["actor_name"] == "Анна HR"
    assert anna["responses_processed"] == 1
    assert anna["resumes_created"] == 1
    assert anna["client_transfers"] == 1
    assert anna["resume_revisions"] == 1
    assert anna["incoming_messages"] == 1
    assert anna["outgoing_messages"] == 1
    assert anna["cold_outreach"] == 1
    assert anna["avg_first_response_seconds"] == 420
    assert anna["kpi_points"] > 0

    igor = reports["hr-2"]
    assert igor["worker_contracts_sent"] == 1


def test_admin_attention_flags_deletion_requests_and_low_activity():
    from app.services.office_metrics import build_admin_attention

    reports = {
        "hr-1": {
            "actor_user_id": "hr-1",
            "actor_name": "Анна HR",
            "responses_processed": 0,
            "outgoing_messages": 0,
            "resumes_created": 0,
            "client_transfers": 0,
            "resume_revisions": 0,
            "overdue_items": 2,
        }
    }
    deletion_requests = [
        {
            "id": "del-1",
            "status": "pending",
            "entity_type": "candidate",
            "entity_id": "cand-1",
            "actor_name": "Анна HR",
            "reason": "дубль",
        }
    ]

    attention = build_admin_attention(reports, deletion_requests)

    kinds = {item["kind"] for item in attention}
    assert "pending_deletion_request" in kinds
    assert "low_activity" in kinds
    assert "overdue_work" in kinds


def test_hard_delete_requires_admin_for_sensitive_entities():
    from app.services.office_policy import can_hard_delete

    assert can_hard_delete("admin", "candidate") is True
    assert can_hard_delete("manager", "candidate") is False
    assert can_hard_delete("manager", "resume") is False
    assert can_hard_delete("manager", "candidate_file") is False
    assert can_hard_delete("manager", "temporary_note") is True
