# Render and Supabase Deploy Note

Render deploys Vonza application code only. It does not apply Supabase SQL migrations for you.

Current main has two schema layers:

- Startup-critical schema: required for the app process to boot. If these tables or columns are missing, startup schema validation exits the process. Recovery bundle: `docs/sql/prod_recovery_startup.sql`
- Feature-gated schema: later workspace and attribution layers that can stay unavailable without blocking basic app startup. Full parity bundle: `docs/sql/prod_recovery_full_current_main.sql`

Practical deploy flow:

1. Apply the required Supabase SQL bundle before or alongside the Render deploy.
2. Confirm startup env vars exist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`.
3. Redeploy Render.
4. Verify `GET /build`, `GET /health`, and `GET /dashboard`.
