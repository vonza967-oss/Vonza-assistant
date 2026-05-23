# Refactor Safety Checklist

Use this sequence for maintainability refactors, especially changes that touch dashboard, public assistant, install, billing, auth, owner scoping, or schema boundaries.

## Required Local Checks

1. `node --check frontend/dashboard.js`
2. `node --check frontend/script.js`
3. `node --check frontend/settings/SettingsShell.js`
4. `node --check assistant-embed.js`
5. `npm run test:smoke`
6. `npm run check:schema-sync`
7. `npm run lint`
8. `git diff --check`

## Browser Checks

Run browser coverage whenever dashboard UI, public assistant UI, install UI, Settings, or shared frontend state is touched:

1. `npm run test:browser`
2. Signed-out `/dashboard` shows the auth shell.
3. Mock signed-in `/dashboard-v2-fixture` shows the dashboard shell.
4. Settings saves show success only after the backend confirms.
5. Install renders copy, QR or verification state, and no stale placeholder workflow.
6. Front Desk Practice renders from the direct route.
7. Public full-page assistant routes render with mocked bootstrap data.

## Schema and Deploy Notes

- Keep `db/schema.sql` aligned with every migration file added or changed.
- Treat `schema_not_ready` test failures as release blockers.
- Production-ready changes must land on `main`, because Render deploys from `main`.
- Do not relax auth, owner scoping, access checks, billing gates, RLS expectations, or factual-answer guardrails to make tests pass.
