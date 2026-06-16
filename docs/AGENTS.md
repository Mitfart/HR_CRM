# Docs DOX

## Purpose

`docs/` owns durable project documentation: design documents, product notes, research summaries, implementation plans, and decisions that should remain understandable beyond a single agent turn.

## Ownership

- `design/` owns site, brand, UX, and information-architecture design documents.
- Future docs subtrees should add their own `AGENTS.md` when they gain durable local rules or workflow contracts.

## Local Contracts

- Keep docs actionable and current; prefer clear present-tense guidance over historical notes.
- Do not store secrets, credentials, private client data, or raw third-party scraped content.
- Summarize external references in original wording instead of copying long passages.
- When a document defines product or workflow behavior, update it when that behavior changes.

## Verification

- For docs-only changes, review rendered Markdown structure and links.
- For docs tied to frontend behavior, verify the corresponding frontend page or component still matches the documented intent.
