# DOX framework

DOX is installed here as a project-level `AGENTS.md` hierarchy. These files are binding work contracts for their subtrees.

## Core Contract

- Read the applicable DOX chain before editing: root `AGENTS.md`, then every child `AGENTS.md` on the path to the files you will touch.
- The closest `AGENTS.md` controls local details; parent docs still apply for broad project rules.
- Keep work products, source materials, instructions, records, assets, and durable docs understandable from the nearest applicable `AGENTS.md` plus its parents.
- After meaningful changes, run a DOX pass: update nearest owning docs when purpose, structure, contracts, workflows, constraints, outputs, or durable behavior changes.
- Remove stale or contradictory guidance instead of documenting history.

## Purpose

This repository contains an HR CRM for an agency: a FastAPI backend, Next.js frontend, data import/parser tooling, Docker deployment assets, and project documentation.

## Ownership

- `backend/` owns API, persistence, CRM business logic, async jobs, migrations, and backend tests.
- `frontend/site/` owns the Next.js web experience for public pages, candidate/client entry points, and CRM operator screens.
- `Parser/` owns the standalone web data extractor and macOS launcher/build artifacts.
- `scripts/` owns root-level operational import/deploy helpers.
- `nginx/` owns reverse-proxy configuration and certificate mounts.
- Root docs and compose files own repository-wide setup, deployment, and product context.

## Local Contracts

- Do not revert unrelated working-tree changes.
- Keep secrets and credentials out of source; `.env`, Google credentials, and certificates are runtime inputs.
- Keep local agent/tool settings out of source; `.claude/` is a local workspace directory.
- Prefer existing domain names and Russian CRM terminology already present in UI and tests.
- Generated caches and build outputs such as `__pycache__`, `.DS_Store`, `Parser/build`, `Parser/dist`, and virtualenv contents are not product source.

## Work Guidance

- Use `rg`/`rg --files` for project discovery.
- Before backend edits, inspect the relevant router, schema, model, service, and tests together.
- Before frontend edits, inspect the route, composed component, shared API helpers, global styles, and navigation context.
- Prefer narrow changes that match existing file organization over broad rewrites.
- When changing user-facing behavior, update nearby docs if the workflow or durable contract changes.

## Verification

- Backend: from `backend/`, run `pytest` when backend logic changes.
- Frontend: from `frontend/site/`, run `npm run lint` and `npm run build` when frontend behavior or types change.
- Full local stack: use `docker compose up` from the repository root when integration behavior needs validation.

## User Preferences

- After sufficiently large changes, create a pull request instead of leaving the work only as local changes.

## Child DOX Index

- `backend/AGENTS.md` - FastAPI backend, database, migrations, Celery tasks, services, and backend tests.
- `frontend/site/AGENTS.md` - Next.js app routes, React components, styling, API proxy routes, and frontend build checks.
- `Parser/AGENTS.md` - standalone parser GUI, extractor script, macOS launcher, and packaged build outputs.
- `scripts/AGENTS.md` - root operational scripts for imports, scraping, deployment, and bot startup helpers.
- `nginx/AGENTS.md` - reverse-proxy configuration and TLS mount expectations.
