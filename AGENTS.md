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
- `db/schema.sql` is canonical. Keep it aligned with any migration file you add.
- `/dashboard` is the main app route.
- Do not touch `/widget`, `/embed.js`, `/embed-lite.js`, or chat logic unless the task truly requires it.
- Never expose secrets or commit `.env` values.
- Prefer minimal safe diffs over broad refactors.
- Preserve existing auth, `owner_user_id`, `access_status`, billing, and install flows unless the task explicitly changes them.

## Common Commands
- Install deps: `npm install`
- Start app: `npm start`
- Run smoke tests: `npm run test:smoke`
- Run Supabase connectivity check: `npm run test:supabase`

## Delivery Checklist
- Run the relevant checks before finishing.
- Summarize the files changed and any required migration or deploy step.
- Keep local-only files such as `.env`, env backups, and editor/system artifacts out of commits.
