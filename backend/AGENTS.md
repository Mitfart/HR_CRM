# Backend DOX

## Purpose

The backend is a FastAPI service for the HR CRM. It owns authentication, CRM entities, calendar/contracts/office workflows, audit/history data, Google Sheets imports, source integrations, Celery jobs, database models, migrations, and backend tests.

## Ownership

- `app/main.py` wires the FastAPI app and routers.
- `app/routers/` owns HTTP endpoints.
- `app/models/` owns SQLAlchemy persistence models.
- `app/schemas/` owns Pydantic request/response contracts.
- `app/services/` owns reusable business logic that can be tested without HTTP.
- `app/tasks.py`, `app/tasks_sheets.py`, `app/celery_app.py`, and `app/task_engine.py` own async/background workflows.
- `alembic/` owns schema migrations.
- `tests/` owns backend unit tests and regression coverage.

## Local Contracts

- Keep router response shapes aligned with schemas and frontend expectations.
- Keep database changes paired with Alembic migrations when schema changes are durable.
- Keep side-effecting integrations isolated behind services or tasks so tests can mock them.
- Do not commit runtime credentials such as `google_credentials.json` or environment-specific secrets.

## Work Guidance

- For endpoint changes, inspect the router, schema, model/service, and any frontend caller before editing.
- Prefer service-level tests for business logic and narrow router tests only when HTTP behavior matters.
- Preserve timezone-aware datetime handling; existing tests use explicit UTC-aware timestamps.
- Keep Russian domain labels and CRM stage names consistent with existing tests and UI strings.

## Verification

- Run `pytest` from `backend/` after backend logic changes.
- Run targeted tests first when changing a single service or router, then broader tests if shared contracts changed.

## Child DOX Index

This backend is not yet split into deeper DOX children. Add child docs when a subfolder gains durable local rules beyond this file.
