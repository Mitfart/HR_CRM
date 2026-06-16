# Frontend DOX

## Purpose

The frontend is a Next.js 14 application for the public site, candidate/client entry points, and CRM operator workspace.

## Ownership

- `app/` owns routes, layouts, global CSS, and Next.js route handlers.
- `components/` owns reusable React UI and CRM page components.
- `lib/` owns frontend/server helper APIs such as auth and backend proxy access.
- `tailwind.config.ts`, `postcss.config.mjs`, and `next.config.mjs` own build and styling configuration.

## Local Contracts

- Keep CRM navigation and route structure consistent between `app/crm/*` pages and `components/CrmNav.tsx`.
- Keep API route handlers aligned with backend endpoints and auth expectations.
- Prefer existing Tailwind styling conventions and `lucide-react` icons.
- Preserve Russian UI copy unless the requested change explicitly changes language or wording.

## Work Guidance

- For CRM screen edits, inspect both the route file and corresponding component in `components/crm/` or `components/`.
- Keep client/server boundaries explicit; only add `"use client"` where interactivity requires it.
- Avoid layout shifts in dense CRM screens: use stable widths, predictable grids, and compact controls.
- Do not add a marketing landing page when the requested work is an app workflow.

## Verification

- Run `npm run lint` from `frontend/site/` for frontend edits.
- Run `npm run build` when changing routes, types, imports, or server/client boundaries.

## Child DOX Index

This frontend is not yet split into deeper DOX children. Add child docs when `app/`, `components/`, or a CRM domain gains durable local rules.
