# Vonza Repo Guide

## Structure
- `frontend/`: marketing page, dashboard UI, CSS, and static frontend assets
- `src/app/`: app bootstrap and Express app creation
- `src/routes/`: HTTP routes for public pages, dashboard APIs, Stripe webhook, and business/admin flows
- `src/services/`: product logic for agents, analytics, billing, chat, install, auth, and scraping
- `db/`: SQL schema and incremental migration files
- `tests/`: smoke coverage for core app flow
- `render.yaml`: Render deployment config

## Working Rules
- Product direction: the full-page AI Front Desk is the primary customer-facing surface; the website widget is secondary.
- Production-ready changes must target `main` because Render deploys from `main`.
- `db/schema.sql` is canonical. Keep it aligned with any migration file you add.
- `/dashboard` is the main app route.
- Do not touch `/widget`, `/embed.js`, `/embed-lite.js`, or chat logic unless the task truly requires it.
- Do not weaken public access, auth, owner/agent scoping, RLS expectations, security checks, or factual-answer guardrails to make tests pass.
- Never expose secrets or commit `.env` values.
- Do not expose Supabase service role keys, OpenAI API keys, Stripe secrets, public keys that are not already intentionally public, or any copied secret values.
- Do not add broad new features during bug fixes.
- Prefer minimal safe diffs over broad refactors.
- Preserve existing auth, `owner_user_id`, `access_status`, billing, and install flows unless the task explicitly changes them.

## Common Commands
- Install deps: `npm install`
- Start app: `npm start`
- Run smoke tests: `npm run test:smoke`
- Run Supabase connectivity check: `npm run test:supabase`

## Delivery Checklist
- Required checks before commit:
  - `node --check frontend/dashboard.js`
  - `node --check frontend/script.js`
  - `node --check frontend/settings/SettingsShell.js`
  - `node --check assistant-embed.js`
  - `npm run test:smoke`
  - `npm run check:schema-sync`
  - `npm run lint`
  - `git diff --check`
- If WordPress plugin files are touched, run WordPress plugin/static tests.
- If public assistant, widget, or embed behavior is touched, browser-check affected public routes.
- If dashboard UI is touched, browser-check relevant dashboard hash routes.
- Summarize the files changed and any required migration or deploy step.
- Keep local-only files such as `.env`, env backups, and editor/system artifacts out of commits.
