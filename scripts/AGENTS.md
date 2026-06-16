# Scripts DOX

## Purpose

Root-level scripts own operational helpers for scraping, CRM deployment, and data import workflows outside the main app packages.

## Ownership

- `deploy_crm.py` and `deploy_to_server.py` own deployment helpers.
- `friendwork_scraper.py` owns FriendWork scraping/import preparation.

## Local Contracts

- Keep credentials, hostnames, tokens, and local machine paths environment-driven or clearly documented as operator-provided inputs.
- Treat scraped HR data as sensitive.
- Preserve cross-platform intent when editing `.cmd`, `.ps1`, or Python script variants.

## Work Guidance

- Before editing an operational script, inspect the consuming README/instruction docs and any backend import endpoint or model it targets.
- Prefer explicit dry-run or logging behavior for deployment/import changes.

## Verification

- No shared script test command is documented yet. Run the edited script in a safe dry-run or help mode when available.

## Child DOX Index

This scripts area is not yet split into deeper DOX children.
