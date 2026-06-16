"""Unit tests for notification task stubs."""
from unittest.mock import patch


def test_trigger_bot_for_application_is_disabled():
    from app.tasks import trigger_bot_for_application

    with patch("app.tasks._redis_client") as redis_client:
        result = trigger_bot_for_application("app-1", "@client")

    assert result is None
    redis_client.assert_not_called()


def test_client_notification_task_is_disabled():
    from app.tasks import notify_client_about_candidates

    with patch("app.tasks._redis_client") as redis_client:
        result = notify_client_about_candidates("app-1", "@client", ["Candidate"])

    assert result is None
    redis_client.assert_not_called()
