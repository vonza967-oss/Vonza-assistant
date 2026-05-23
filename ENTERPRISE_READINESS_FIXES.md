# Vonza Enterprise Readiness Fixes

Date: 2026-05-23
Scope: non-billing enterprise-readiness hardening for the Front Desk, dashboard APIs, public widget, readiness checks, and website import durability.

## Implemented changes

### Security and tenant isolation

- `/product-events` now requires either an authenticated owner request or a validated public install context.
- Dashboard product events now include the owner bearer token and are skipped before auth is available.
- Product event metadata is sanitized, source values are bounded, and default dedupe keys are generated from tenant/event context.
- Static admin-token access was removed from the broad admin routes:
  - `/agents/admin-list`
  - `/dashboard/analytics` admin mode
  - `/agents/access-status`
  - business scrape admin routes
- Admin access now requires an authenticated Supabase user with one of:
  - `app_metadata.role` / `user_metadata.role` matching an admin role
  - `app_metadata.roles` / `user_metadata.roles` including an admin role
  - user ID listed in `VONZA_ADMIN_USER_IDS`
  - email listed in `VONZA_ADMIN_EMAILS`
- Admin actions write to `admin_audit_logs` when the table is available.
- Pre-claim `client_id` setup access now expires via `AGENT_PRECLAIM_TOKEN_TTL_HOURS` with a 24 hour default.
- `/knowledge/import` now requires authenticated active owner access. Pre-claim setup tokens can no longer run that high-cost operation.

### Readiness and deploy behavior

- Added `GET /ready`.
- `/ready` checks:
  - Supabase connectivity
  - startup schema readiness
  - OpenAI client configuration
  - rate-limit backend readiness
- Render `healthCheckPath` now points to `/ready` instead of shallow `/health`.
- `/health` remains a lightweight liveness/build endpoint.

### Error handling

- Added shared safe error helpers in `src/utils/httpErrors.js`.
- Public chat routes now log details internally and return sanitized public errors.
- The public Front Desk no longer displays raw backend errors in chat bubbles.
- Global Express error handling now returns safe JSON and logs request context.

### Privacy and consent

- The Front Desk widget now avoids persistent visitor session storage until the visitor explicitly continues with email or guest mode.
- Widget copy now states that continuing stores the chat session for replies, safety, and follow-up.
- Widget telemetry is skipped until explicit visitor storage consent.
- CTA redirect URLs no longer include raw session, visitor, fingerprint, conversation, person, lead, or follow-up identifiers.

### Front Desk polish

- Default public copy was moved away from generic "AI front desk for your website" language.
- Legacy `Vonza AI` assistant names are treated as non-business branding in page mode, so business-specific names are preferred.
- Website-content-missing fallback copy no longer tells visitors to ask an admin to run an import. It now gives a professional "I do not know that yet" contact fallback.
- Public preview routes `/dashboard-v2-preview` and `/full-page-assistant-v2-preview` are now local/dev gated.

### Widget embed

- Added `/embed-v1.js` as a versioned alias for the current embed script.
- Reduced cache TTL for `/embed.js`, `/embed-v1.js`, and `/embed-lite.js` to `max-age=300` with stale revalidation for emergency cache-bust capability.

### Website import durability

- Added durable `website_import_jobs` persistence.
- Website import jobs now record queued/running/success/limited/failed status, owner/agent/business context, timestamps, page count, content length, error details, and result metadata.
- Existing in-process dedupe remains for same-process efficiency, but status is now persisted when the table exists.

### Database

- Added migration `supabase/migrations/20260523000000_enterprise_readiness_hardening.sql`.
- Updated `db/schema.sql` with:
  - `admin_audit_logs`
  - `website_import_jobs`
  - owner-readable product event policy
  - owner-readable website import job policy

## New and updated tests

- Product events require auth or validated public context.
- Product event metadata and dedupe behavior remains covered.
- Admin APIs require RBAC admin auth and reject static token headers/query strings.
- Expired pre-claim setup tokens cannot access setup-only agent routes.
- Readiness service reports dependency status and fails closed.
- Widget visitor session storage starts only after explicit identity consent.
- Public widget/front desk copy expectations were updated for the new professional defaults.
- Website import coordinator tests continue to prove in-process reuse and queueing.

## Environment variables

- `VONZA_ADMIN_USER_IDS`: comma-separated Supabase auth user IDs allowed to perform platform admin actions.
- `VONZA_ADMIN_EMAILS`: comma-separated admin emails allowed to perform platform admin actions.
- `AGENT_PRECLAIM_TOKEN_TTL_HOURS`: optional TTL for pre-claim setup tokens. Defaults to `24`.
- Existing readiness variables still apply:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `RATE_LIMIT_BACKEND`
  - Upstash/Redis variables when distributed rate limiting is required

## Staging runbook

1. Deploy to a staging Render service with staging Supabase, staging OpenAI project/key, and non-production Stripe settings kept separate from production.
2. Apply `supabase/migrations/20260523000000_enterprise_readiness_hardening.sql`.
3. Configure `VONZA_ADMIN_USER_IDS` or `VONZA_ADMIN_EMAILS` for named internal admins.
4. Confirm `ADMIN_TOKEN` is not used for dashboard/admin routes.
5. Run:
   - `npm run check:schema-sync`
   - `npm run verify:deploy-readiness`
   - `npm run test:smoke`
6. Open `/ready`; it must return `200` and all checks must be `ok: true`.
7. Browser-check:
   - hosted Front Desk page
   - widget embed
   - identity consent choices
   - visitor chat error fallback
   - dashboard analytics
   - website import

## Production runbook

1. Confirm staging has passed `/ready`, smoke tests, and browser checks.
2. Back up production Supabase before migration.
3. Apply the enterprise hardening migration.
4. Deploy from `main`.
5. Confirm `/ready` returns `200`.
6. Confirm `/health` still returns build/liveness metadata.
7. Confirm admin actions require Supabase admin users and write `admin_audit_logs`.
8. Confirm public Front Desk error states show safe, business-friendly copy.
9. Monitor logs for:
   - `[route] request failed`
   - `[admin audit] failed`
   - `[knowledge/import] Website knowledge import failed`
   - readiness check failures

## Rollback runbook

1. Roll back the Render deploy to the previous stable release.
2. Keep the new database tables in place; they are additive and should not break older code.
3. If `/ready` blocks traffic because a dependency is degraded, temporarily point Render health checks back to `/health` only after confirming customer impact and documenting the incident.
4. Re-disable any admin users by removing them from `VONZA_ADMIN_USER_IDS` / `VONZA_ADMIN_EMAILS`.
5. If a widget release needs emergency cache busting, use `/embed-v1.js` or update install snippets to add a version query string.

## Deferred work

The following requests are intentionally not completed in this pass because they require larger product or architectural reconciliation:

- Merging and reconciling PRs #22, #21, #19, #18, #17, #15, #14, #13, and #11.
- Full dashboard information architecture rewrite and settings flattening.
- Splitting `frontend/dashboard.js`, `frontend/script.js`, and `src/routes/agentRoutes.js` into feature modules.
- Removing all CSP `'unsafe-inline'` usage and replacing it with nonce/hash based script execution.
- Restricting `frame-ancestors` per install domain at the HTTP header level. The current install/domain validation remains enforced at bootstrap/chat/event boundaries.
- Fully async website import workers with retry execution after process restart. This pass persists job state; a separate worker is still needed for true restart-resumable execution.
- Full signup/login/create assistant/install/widget/billing/Google browser E2E suite. Billing/payment tests were intentionally not changed in this pass.
