# Bot DOX

## Purpose

The bot folder owns Telegram automation that connects operators/users to the CRM backend and queue-based workflows.

## Ownership

- `main.py` owns bot startup.
- `config.py` owns runtime configuration.
- `api_client.py` owns CRM API calls.
- `queue_consumer.py` owns queue processing.
- `script_engine.py` owns scripted bot behavior.
- `telegram/` owns Telegram client and handlers.
- `Dockerfile` and `requirements.txt` own bot runtime packaging.

## Local Contracts

- Keep API URLs and credentials environment-driven.
- Keep bot behavior compatible with the backend API contracts it calls.
- Do not commit Telegram session files, tokens, or local operator credentials.

## Work Guidance

- For handler changes, inspect `telegram/handler.py`, `api_client.py`, and any backend endpoint involved.
- Keep network and Telegram client calls mockable where possible.
- Prefer clear failure handling around backend or queue outages.

## Verification

- No dedicated bot test command is documented yet. Use backend/API mocks or local Docker stack checks when changing runtime behavior.

## Child DOX Index

This bot is not yet split into deeper DOX children.
