# Staging Readiness

## Required Env Vars

Core runtime:

- `PUBLIC_APP_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ADMIN_TOKEN`

Staging/production billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER_MONTHLY`
- `STRIPE_PRICE_ID_GROWTH_MONTHLY`
- `STRIPE_PRICE_ID_PRO_MONTHLY`

Set `NODE_ENV=production` and `VONZA_DEPLOY_ENV=staging` for the Render staging service so `npm run verify:deploy-readiness` fails clearly when paid checkout config is incomplete.

## Optional Env Vars

- `VONZA_OPERATOR_WORKSPACE_V1`: leave unset or `false` unless the Google-connected operator workspace is in the staging test scope.
- `GOOGLE_CLIENT_ID`: required only when `VONZA_OPERATOR_WORKSPACE_V1=true`.
- `GOOGLE_CLIENT_SECRET`: required only when `VONZA_OPERATOR_WORKSPACE_V1=true`.
- `GOOGLE_OAUTH_REDIRECT_URI`: required only when `VONZA_OPERATOR_WORKSPACE_V1=true`.
- `GOOGLE_TOKEN_ENCRYPTION_SECRET`: required only when `VONZA_OPERATOR_WORKSPACE_V1=true`.
- `VONZA_TODAY_COPILOT_V1`
- `DEV_FAKE_BILLING`: local development only. Do not enable in staging or production.
- `TEMP_INSTANT_WORKSPACE_ACCESS`: temporary local testing only. Do not enable in staging or production.
- `TRUSTED_PROXY_IPS`: only set to known proxy IPs if forwarded client IP rate-limit attribution is required.

## Migration Order

1. Apply the Supabase migration sequence in `supabase/migrations/` in filename order.
2. If manual recovery is required, use `docs/sql/prod_recovery_startup.sql` for startup-critical repair or `docs/sql/prod_recovery_full_current_main.sql` for full current-main parity.
3. Keep `db/schema.sql` aligned with every migration. `db/schema.sql` remains canonical.
4. Confirm local and remote migration history match before triggering Render.

## Verification Commands

Run before staging deploy:

```bash
npm run test:smoke
npm run check:schema-sync
npm run verify:deploy-readiness
npm audit --omit=dev
npm run validate:clean-db
```

`npm run validate:clean-db` requires `CLEAN_DATABASE_URL` or `DATABASE_URL` pointing at a throwaway database. See `docs/clean-db-validation.md`.

## Browser QA Checklist

- Homepage loads and pricing CTAs point to `/dashboard`.
- Signup shell loads in `/dashboard`.
- Login shell loads in `/dashboard`.
- Dashboard shell loads safely for signed-out and sparse-data states.
- Checkout gate renders for unpaid owners.
- Assistant creation/configuration path creates or updates an assistant for an authenticated owner.
- Website import succeeds for an authenticated owner with a public website URL, or fails clearly when auth/data is missing.
- Agent preview loads at `/widget`.
- Chat send path works with seeded test data, or fails clearly when install/auth setup is missing.
- Lead capture path works with seeded test data, or fails clearly when install/auth setup is missing.
- Analytics and customers surfaces render safely with sparse data.

## Stripe Test Checkout Checklist

- Use Stripe test mode keys and test-mode monthly Price IDs only.
- Unauthenticated `POST /create-checkout-session` returns a clean auth error.
- Authenticated checkout maps selected plans to:
  - `starter` -> `STRIPE_PRICE_ID_STARTER_MONTHLY`
  - `growth` -> `STRIPE_PRICE_ID_GROWTH_MONTHLY`
  - `pro` -> `STRIPE_PRICE_ID_PRO_MONTHLY`
- Missing plan-specific prices fail clearly before creating a checkout session.
- Checkout confirmation verifies the session owner, paid status, and configured Vonza monthly plan before syncing billing.
- Webhooks require `STRIPE_WEBHOOK_SECRET`.

## Known Local Blockers

- Clean database validation cannot run without `CLEAN_DATABASE_URL` or `DATABASE_URL` for a throwaway database.
- Full end-to-end signup and payment require Supabase Auth redirect settings and Stripe test-mode prices in the target environment.
- Google OAuth cannot be tested unless `VONZA_OPERATOR_WORKSPACE_V1=true` and the Google OAuth credentials/callback are configured for the staging URL.

## Go/No-Go Criteria

Go to staging when:

- Required commands pass.
- Clean database validation passes against a throwaway database.
- Render env vars match this document.
- Stripe test checkout creates sessions for all three plans.
- Main browser QA checklist passes or has documented staging-only blockers.
- No known P0/P1 security regression remains in RLS, SSRF hardening, LLM context handling, rate limiting, billing, or auth.

Do not go when:

- Required Stripe price env vars are missing for staging.
- Startup schema validation fails.
- Checkout can be opened unauthenticated.
- Website import can fetch local, private, metadata, or non-HTML targets.
- Dashboard/core auth flows fail without a clear user-facing error.
