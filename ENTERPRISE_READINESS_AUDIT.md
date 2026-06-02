# Vonza Enterprise Readiness Audit

Date: 2026-05-23
Scope: full repository scan of the Vonza Assistant codebase on `main`, with no production behavior changes.

## Executive verdict

- Overall readiness score: 56/100
- Beta readiness: Not ready for real customer beta. Conditionally usable for a tightly controlled internal pilot after P0s are fixed.
- Top 5 blockers:
  1. Unauthenticated product event ingestion can write analytics/funnel events for arbitrary `client_id` and `agent_id`.
  2. Static admin-token routes can list all agents, read analytics across tenants, and change access state without RBAC, audit logging, or rate limiting.
  3. Temporary instant workspace access can bypass payment/access gating if enabled and is not blocked by deploy readiness.
  4. Render health checks only prove that Express responds, not that Supabase, OpenAI, Stripe, rate limiting, or schema are usable.
  5. Clean database validation did not run because `CLEAN_DATABASE_URL`/`DATABASE_URL` is missing, so a fresh production build is not proven from migrations.
- Biggest trust risk: customer-facing assistant errors can expose raw backend error messages, and admin/test tooling can surface live customer data in logs.
- Biggest technical risk: the app relies heavily on Supabase service-role access with route-level tenant checks; a single missed check becomes cross-tenant impact.
- Biggest product polish risk: the dashboard/operator workspace has many unfinished, duplicated, or "preview" surfaces and 11 open PRs that appear directly related to readiness.

## Audit commands and results

- `git status --short`: dirty/untracked local files were present before audit, including `.DS_Store`, `.agents/`, `docs/audits/`, multiple docs, `output/`, `skills-lock.json`, and `supabase/.temp/`.
- `git branch --show-current`: `main`.
- `git log --oneline -20`: recent history includes readiness/dashboard work such as `df270ba Update marketing site for AI Front Desk`, `a032caf Add controlled beta readiness docs`, dashboard CSS splits, lint/test isolation debt reduction, billing/access fixes, and full-page assistant bootstrap work.
- `npm install`: skipped because `node_modules` was already present.
- `package.json` scripts inspected: `start`, `start:prod`, `dev`, `lint`, `test:smoke`, `test:supabase`, `check:schema-sync`, `validate:clean-db`, `verify:prod-schema`, `verify:deploy-readiness`.
- `npm run test:smoke`: passed, 625 tests.
- `npm run lint`: passed with warnings in `embed.js`, `frontend/script.js`, and `src/services/knowledge/knowledgeFixService.js`.
- `npm run check:schema-sync`: passed, 38 tracked persistence tables.
- `npm run verify:deploy-readiness`: passed against configured environment.
- `npm run validate:clean-db`: failed because `CLEAN_DATABASE_URL` or `DATABASE_URL` is not configured.
- `node --check frontend/dashboard.js`: passed.
- `node --check frontend/script.js`: passed.
- `node --check assistant-embed.js`: passed.
- `node --check src/app/createApp.js`: passed.
- `npm run verify:prod-schema`: passed.
- `npm run test:supabase`: passed, but it performs live read/write/delete and prints row data, which is itself a readiness concern.
- `gh pr list --limit 20`: 11 open PRs, including dashboard/settings/operator workspace changes: #22, #21, #19, #18, #17, #15, #14, #13, #11 draft, #9, #3.
- `gh issue list --limit 20`: no open issues returned.

## P0 - Must fix before real customer beta

### 1. Unauthenticated product-event ingestion accepts arbitrary tenant identifiers

- Severity: P0
- Area: Security and tenant isolation, analytics integrity
- Evidence: `src/routes/agentRoutes.js:3302-3321` authenticates optionally, falls back to `user = null`, then calls `trackProductEventImpl` with request body `client_id`, `agent_id`, `event_name`, `source`, `metadata`, and `dedupe_key`. There is no required owner auth, signed install context, active access check, public install check, or rate limiter on this route.
- Why this is risky: any script or server-side caller can pollute funnel analytics for arbitrary agents, store untrusted metadata, and damage customer reporting. CORS does not protect against non-browser requests, and the route writes through the service-role client.
- Recommended fix: split owner events from public events. Require Supabase auth for dashboard events. For public events, require a signed install token or validated install ID plus allowed origin, and apply rate limiting and schema validation.
- Acceptance criteria: unauthenticated POSTs without a valid public install context return 401/403; requests with mismatched `agent_id`/install context fail; metadata is size/type constrained; smoke tests cover forged events and valid widget events.

### 2. Static admin token provides broad cross-tenant control without enterprise controls

- Severity: P0
- Area: Security, tenant isolation, operations
- Evidence: `src/routes/agentRoutes.js:993-1005` exposes `/agents/admin-list` via `ensureAdminAccess(req)` and returns `listAllAgents` plus funnel summary. `src/routes/agentRoutes.js:1875-1900` lets admin-token callers access `/dashboard/analytics` and supply `owner_user_id`. `src/routes/agentRoutes.js:3521-3539` lets admin-token callers update agent `access_status`. `src/utils/httpGuards.js:167-190` implements admin access as a shared static `ADMIN_TOKEN`.
- Why this is risky: a single bearer-style token can enumerate tenants, read analytics, and alter billing/access state. There is no named admin identity, audit trail, rotation workflow, permission granularity, or rate limit shown at the route boundary.
- Recommended fix: replace static admin-token routes with authenticated admin users, explicit RBAC, audit logging, and per-action authorization. If a break-glass token remains, keep it out of customer-data routes and require IP allowlisting plus rate limits.
- Acceptance criteria: every admin action records admin user, timestamp, target agent/owner, reason, and before/after state; `/agents/admin-list`, `/dashboard/analytics` admin mode, and `/agents/access-status` reject static-token-only access in production.

### 3. Temporary instant workspace access can bypass paid access

- Severity: P0
- Area: Billing and access control
- Evidence: `src/services/agents/agentService.js:239-248` defines `shouldGrantTemporaryInstantWorkspaceAccess` with comment "Temporary testing mode" and grants access when `TEMP_INSTANT_WORKSPACE_ACCESS` is enabled. `src/config/env.js:177-183` exposes `TEMP_INSTANT_WORKSPACE_ACCESS`.
- Why this is risky: payment and access enforcement can be bypassed by environment configuration. Tests confirm the bypass behavior exists. Deploy readiness does not appear to hard-fail when this flag is true for staging/production.
- Recommended fix: remove the bypass, or make deploy readiness fail if `TEMP_INSTANT_WORKSPACE_ACCESS=true` outside local automated tests. Prefer explicit beta entitlement records over environment-wide bypasses.
- Acceptance criteria: production/staging startup fails if the flag is enabled; access tests prove unpaid users cannot open the workspace unless they have a real entitlement/beta grant record.

### 4. Production health check can be green while critical dependencies are broken

- Severity: P0
- Area: Reliability and operations
- Evidence: `src/routes/publicRoutes.js:1112-1121` returns `{ ok: true, version, buildSha, operatorWorkspaceV1Enabled, launchMode }` without checking Supabase, schema readiness, OpenAI, Stripe, or rate-limit backend. `render.yaml:7` uses `/health` as Render's health check.
- Why this is risky: Render can keep serving and routing traffic to an instance that cannot answer customers, write messages, bill users, enforce limits, or connect to Supabase. This creates silent customer-facing failure.
- Recommended fix: keep `/health` lightweight for liveness, but add `/ready` for dependency readiness and use it for deploy gates where feasible. It should check Supabase reachability, required schema, rate-limit backend mode, and required environment presence without exposing values.
- Acceptance criteria: readiness returns non-200 when DB/schema/rate-limit backend is unavailable; deploy/startup checks use readiness semantics; health responses never expose secrets.

### 5. Fresh database/migration readiness is not proven

- Severity: P0
- Area: Database, migrations, deployment
- Evidence: `npm run validate:clean-db` failed with missing `CLEAN_DATABASE_URL`/`DATABASE_URL`. `db/schema.sql` is canonical per repo rules, and `npm run check:schema-sync` passed against tracked schema, but a clean database build was not validated.
- Why this is risky: beta deployments can depend on live database drift or manual migration order. A customer-facing release should prove that migrations can build a fresh environment from scratch and match `db/schema.sql`.
- Recommended fix: provide an isolated clean database URL in CI/staging and make clean DB validation part of release readiness. Keep destructive validation away from production.
- Acceptance criteria: `npm run validate:clean-db` passes against disposable infrastructure; CI fails on schema drift; no production data is used for clean validation.

## P1 - Should fix before broader beta

### 6. Live Supabase test prints data and writes to the configured database

- Severity: P1
- Area: Privacy, operations, testing
- Evidence: `test-supabase.js:35-47` selects from `businesses` and logs `sampleRow`. `test-supabase.js:55-66` inserts and logs the inserted row before deleting it.
- Why this is risky: a routine readiness command can expose customer data in terminal/CI logs and can write into production if pointed at production credentials.
- Recommended fix: make the test require an explicit non-production database, redact selected rows, and avoid printing row contents. Use a dedicated smoke table or isolated schema.
- Acceptance criteria: production environment refuses to run `test:supabase`; logs show counts/status only; test data is namespaced and cleaned even on partial failure.

### 7. Global error handler and many route handlers return raw error messages

- Severity: P1
- Area: Security, customer trust, reliability
- Evidence: `src/app/createApp.js:53-59` returns `err.message` for non-503 errors. Many route catches mirror this pattern, for example `src/routes/agentRoutes.js:1868-1871`, `src/routes/agentRoutes.js:3322-3326`, and `src/routes/agentRoutes.js:3533-3537`. `frontend/script.js:3578-3580` appends backend `data.error` into the public assistant chat bubble.
- Why this is risky: internal schema/config/provider errors can be exposed to visitors or customers, and customer-facing failures feel technical and unpolished.
- Recommended fix: return stable public error codes/messages, log detailed errors server-side with correlation IDs, and map assistant failures to friendly fallback text.
- Acceptance criteria: public assistant never displays raw backend messages; API responses expose only safe `code` and generic `message`; server logs include request correlation IDs.

### 8. Service-role client makes route-level scoping the primary isolation boundary

- Severity: P1
- Area: Security and tenant isolation
- Evidence: `src/clients/supabaseClient.js:5-21` initializes Supabase with `SUPABASE_SERVICE_ROLE_KEY`. `db/schema.sql:1267-1588` enables RLS and policies, but service-role access bypasses RLS. Several tables rely on indirect agent ownership rather than direct `owner_user_id`, for example `messages` in `db/schema.sql:49-63`.
- Why this is risky: database-side protections cannot save a missed route check. The `/product-events` issue demonstrates the failure mode.
- Recommended fix: use service role only in narrow server-side service modules; add route tests for every tenant-scoped endpoint; consider RPCs with explicit tenant checks or direct owner columns/triggers for high-value records.
- Acceptance criteria: every service-role query path has a tenant-access test; unauthenticated routes have a documented public trust model; high-risk records include tenant ownership or immutable agent ownership constraints.

### 9. Admin analytics can be queried with caller-supplied owner context

- Severity: P1
- Area: Security, tenant isolation, analytics
- Evidence: `src/routes/agentRoutes.js:1875-1900` bypasses normal auth when `hasAdminAccess(req)` is true, then uses `req.query.owner_user_id` as owner context fallback for analytics aggregation.
- Why this is risky: analytics queries can be steered across tenant boundaries by whoever holds the admin token.
- Recommended fix: remove query-supplied owner context from admin analytics. Resolve owner from the target agent and require admin RBAC plus audit.
- Acceptance criteria: analytics owner context always comes from the authenticated user's permitted tenant or from the target agent record after admin authorization.

### 10. Public preview routes are exposed in production router

- Severity: P1
- Area: Product trust, security hardening
- Evidence: `src/routes/publicRoutes.js:969-975` serves `/dashboard-v2-preview` and `/full-page-assistant-v2-preview` without the local fixture guard used by nearby routes at `src/routes/publicRoutes.js:960-967` and `src/routes/publicRoutes.js:977-986`.
- Why this is risky: preview/prototype surfaces can be indexed, shared, or evaluated by customers and investors. They may expose stale UX, fixture assumptions, or unfinished positioning.
- Recommended fix: gate preview routes behind local/dev conditions or authenticated internal admin access.
- Acceptance criteria: production requests to preview routes return 404 unless an explicit internal preview flag and auth are present.

### 11. Public assistant CSP is intentionally broad but not enterprise hardened

- Severity: P1
- Area: Security, widget embed readiness
- Evidence: `src/utils/securityHeaders.js:71-84` sets public assistant CSP with `frame-ancestors *`, `script-src 'self' 'unsafe-inline'`, and `connect-src 'self' https:`. Dashboard CSP also allows inline script/style at `src/utils/securityHeaders.js:45-68`.
- Why this is risky: widget embedding requires flexibility, but broad CSP reduces XSS containment and allows the assistant page to be framed by any site. Enterprise buyers will expect explicit domain controls and a hardened script policy.
- Recommended fix: keep embeddability but pair it with per-install allowed domain validation, nonce/hash-based scripts where practical, and documented CSP tradeoffs. Consider install-specific frame policy for full-page assistant.
- Acceptance criteria: CSP review documented; inline script usage reduced or nonce-protected; allowed-domain enforcement tests cover framing/bootstrap/chat paths.

### 12. Website import is synchronous and coordinated only in memory

- Severity: P1
- Area: Reliability, scalability, operations
- Evidence: `src/services/scraping/websiteImportCoordinator.js:6` stores active imports in an in-memory `Map`; `src/services/scraping/websiteImportCoordinator.js:81-144` starts imports in-process; `src/config/constants.js:33` allows up to 8 crawl pages and `src/services/scraping/websiteContentService.js:892-947` allows 15 seconds per fetch.
- Why this is risky: imports can duplicate across instances, disappear on restart, or tie up a Render worker during slow customer sites. Customers can see inconsistent import status.
- Recommended fix: move imports to a durable job table/queue with status, retry, timeout, and cancellation. Keep request handlers fast.
- Acceptance criteria: import request returns a job ID quickly; job survives process restart; dashboard shows durable progress/errors; duplicate jobs dedupe by agent/business.

### 13. Expensive AI/indexing routes need stronger abuse and cost controls

- Severity: P1
- Area: Performance, cost, abuse protection
- Evidence: `/knowledge/import` is authenticated or pre-claim accessible at `src/routes/agentRoutes.js:3250-3300` and can run website extraction plus RAG indexing. Chat usage recording warns and continues on failure at `src/services/chat/chatService.js:661-672`.
- Why this is risky: website imports, RAG reindexing, practice messages, and chat completions can create OpenAI/Supabase costs. If usage recording fails, plan caps can drift while requests still complete.
- Recommended fix: apply per-owner and per-agent rate limits to expensive routes, use durable usage accounting, and fail closed or degrade when quota ledger writes are unavailable.
- Acceptance criteria: tests prove capped/ledger-failure behavior; repeated import/reindex/chat requests are throttled per tenant; owner-visible usage remains consistent after provider errors.

### 14. Owner custom prompts are appended after hard safety rules

- Severity: P1
- Area: AI assistant safety
- Evidence: `src/services/chat/prompting.js:225-352` builds the system prompt and appends `agent.systemPrompt` near the end after extensive hard rules.
- Why this is risky: custom owner instructions can accidentally or deliberately override factual-answer guardrails, lead capture boundaries, or refusal behavior because they appear later in the same system message.
- Recommended fix: treat owner instructions as constrained business style/configuration, validate them, and place them in a lower-priority section that explicitly cannot override safety, privacy, or factual rules.
- Acceptance criteria: prompt-injection tests show owner instructions cannot override "do not invent", privacy, or contact-detail rules; dashboard warns/rejects unsafe custom instructions.

### 15. Public CTA tracking endpoint redirects to caller-provided targets

- Severity: P1
- Area: Security, privacy, analytics integrity
- Evidence: `frontend/script.js:2102-2124` builds `/install/cta` URLs with `target_url`, session, visitor, fingerprint, page, origin, lead, and conversation metadata. `src/routes/agentRoutes.js:710-747` records and redirects. `src/services/conversion/conversionOutcomeService.js:955-1067` normalizes `targetUrl` and appends tracking params, but does not show a comparison to a tenant-approved CTA allowlist in this path.
- Why this is risky: an attacker with a valid install ID can use Vonza as an open redirect/tracking endpoint and inject noisy conversion records. Query strings can also carry PII-like lead/conversation identifiers into logs and third-party targets.
- Recommended fix: only redirect to configured, tenant-approved CTA destinations or same-business domains; move sensitive attribution identifiers server-side behind opaque event IDs.
- Acceptance criteria: arbitrary `target_url` values are rejected; redirect URLs are allowlisted; public URL query strings do not include raw lead/conversation/person identifiers.

### 16. Guest/pre-claim flows rely on browser-held `client_id`

- Severity: P1
- Area: Security, onboarding, tenant isolation
- Evidence: unauthenticated agent creation/list/import support pre-claim access via `client_id`, including `src/routes/agentRoutes.js:857-952`, `src/routes/agentRoutes.js:970-991`, and `src/routes/agentRoutes.js:3250-3300`. `requireAgentAccess` allows unowned agent access by matching `client_id` in `src/services/agents/agentService.js:3194-3236`.
- Why this is risky: this may be acceptable for early onboarding, but it is not enterprise-grade tenant identity. A leaked browser token can access unclaimed workspace state and trigger expensive actions.
- Recommended fix: shorten pre-claim token lifetime, store hashed setup tokens, add explicit setup-session records, and require owner auth before high-cost or customer-visible operations.
- Acceptance criteria: pre-claim tokens expire; high-risk routes require authenticated owners; tests cover leaked/stale client IDs.

### 17. Full billing lifecycle is only partially proven

- Severity: P1
- Area: Billing and access control
- Evidence: checkout session creation/verification is strong in `src/services/billing/checkoutService.js:108-209`, and webhook verification is present at `src/services/billing/checkoutService.js:211-228`. Subscription status mapping exists in `src/services/billing/billingUsageService.js:15-72`. However, tests observed focus on smoke behavior, and no end-to-end Stripe checkout/webhook/cancel/failed-payment flow was exercised in this audit.
- Why this is risky: real beta customers will hit failed payments, cancellations, upgrades, duplicate webhooks, and delayed webhook ordering.
- Recommended fix: add integration tests using Stripe test clocks/fixtures or mocked webhook payloads for checkout completed, subscription updated, canceled, past_due, unpaid, and plan change.
- Acceptance criteria: access state transitions are deterministic for every subscription status; duplicate/out-of-order webhooks are idempotent; owner UI shows clear billing failure states.

### 18. Public config exposes environment and feature-state details

- Severity: P1
- Area: Security hardening, product polish
- Evidence: `src/routes/publicRoutes.js:1025-1046` emits Supabase URL/anon key, dev fake billing flag result, operator/today feature flags, app version, build SHA, launch profile, and billing plans.
- Why this is risky: anon key and public plans may be intentional, but build SHA and feature flags make it easier to fingerprint deployments and expose unfinished product direction.
- Recommended fix: publish only client-required config; keep internal launch/profile/build diagnostics behind authenticated support/admin routes.
- Acceptance criteria: public config contains no internal-only flags; tests assert OpenAI/Stripe/service role secrets remain absent and internal diagnostics are not public.

### 19. Widget identity and telemetry need stronger consent framing

- Severity: P1
- Area: Privacy, EU/GDPR readiness
- Evidence: `frontend/widget.html:183-190` and `frontend/widget.html:254-259` link to privacy/terms/cookies. However, `frontend/script.js:1999-2048` posts identity choices to `/chat/capture`, and `frontend/script.js:2102-2124` sends visitor/session/fingerprint/page/origin/lead metadata in CTA tracking. Local storage is used for visitor/session identity in `frontend/script.js`.
- Why this is risky: legal links exist, but users are not clearly asked for telemetry/cookie-like consent before persistent visitor/session tracking and CTA attribution.
- Recommended fix: document storage/telemetry in privacy/cookie notices, add an explicit consent or legitimate-interest design decision, and minimize identifiers in URLs.
- Acceptance criteria: privacy/cookie notices describe localStorage/session tracking and AI message handling; customer sites can configure consent mode; telemetry is disabled or limited until consent where required.

### 20. Customer-facing fallback copy exposes implementation details

- Severity: P1
- Area: Product trust, assistant quality
- Evidence: `src/services/chat/chatService.js:473-491` returns fallback text when no website content is available and mentions asking an admin to run content import.
- Why this is risky: visitors should not see internal operational tasks. It makes the assistant feel unfinished and can reduce trust in the business using it.
- Recommended fix: visitors should receive a business-friendly fallback and a contact/lead capture path; owners should see import status separately in the dashboard.
- Acceptance criteria: visitor fallback never mentions admin/import internals; owner dashboard shows actionable import health.

### 21. Operator/dashboard readiness appears fragmented

- Severity: P1
- Area: Dashboard/workspace maturity
- Evidence: `frontend/dashboard.js` is 18,551 lines and `src/routes/agentRoutes.js` is 3,542 lines. GitHub shows 11 open PRs with titles related to Settings shell, operator workspace, Today review drawer, and calendar/operator slices.
- Why this is risky: the core workspace surface is the primary product. Open overlapping PRs suggest unresolved information architecture and incomplete workflow implementation.
- Recommended fix: reconcile open dashboard/operator PRs before beta, close obsolete branches, and choose one workspace architecture.
- Acceptance criteria: no beta-critical dashboard/operator PR remains open; navigation and settings map to shipped features only; dashboard smoke/e2e tests cover the final architecture.

## P2 - Professional polish / enterprise maturity

### 22. Large monolithic files slow safe development

- Severity: P2
- Area: Code quality and maintainability
- Evidence: `frontend/dashboard.js` has 18,551 lines; `src/routes/agentRoutes.js` has 3,542 lines; `frontend/script.js` has 3,980 lines; `assistant-embed.js` has 1,203 lines; `src/services/scraping/websiteContentService.js` has 1,129 lines.
- Why this is risky: large files make tenant checks, UI states, and regressions harder to review.
- Recommended fix: split by feature boundaries after beta blockers: dashboard routes, billing routes, public install routes, operator routes, widget state, lead capture.
- Acceptance criteria: new changes land in feature-sized modules with focused tests; no single route/UI file owns unrelated surfaces.

### 23. Lint warnings point to dead or disconnected code

- Severity: P2
- Area: Code quality, product reliability
- Evidence: `npm run lint` reported unused or useless assignments in `embed.js:240`, `frontend/script.js:2050`, `frontend/script.js:2276`, and `src/services/knowledge/knowledgeFixService.js:25`.
- Why this is risky: unused lead-capture functions in the public widget are a signal that UI behavior may be partially wired or stale.
- Recommended fix: remove dead code or wire it intentionally with tests.
- Acceptance criteria: lint runs with zero warnings; lead-capture UI path has automated coverage.

### 24. Public embed assets are cached for one year

- Severity: P2
- Area: Widget readiness, operations
- Evidence: `src/routes/publicRoutes.js:934-941` serves `/embed.js` and `/embed-lite.js` with `public, max-age=31536000, immutable`.
- Why this is risky: customers can be stuck on broken embed code after a bad release unless URLs are versioned or cache-busted.
- Recommended fix: include content-hashed or versioned embed URLs, or use short cache for unversioned stable paths.
- Acceptance criteria: install instructions use versioned embed URL; emergency rollback/cache-bust procedure is documented and tested.

### 25. Dashboard and public assistant rely on inline script allowances

- Severity: P2
- Area: Security hardening
- Evidence: dashboard and public assistant CSP include `script-src 'self' 'unsafe-inline'` in `src/utils/securityHeaders.js:65-67` and `src/utils/securityHeaders.js:81-83`.
- Why this is risky: inline script allowance weakens XSS mitigation, especially with large browser-rendered HTML surfaces.
- Recommended fix: migrate inline event handlers and scripts to external modules or nonce/hash-based CSP.
- Acceptance criteria: no inline event handlers in customer-facing pages; CSP blocks unexpected inline script in staging tests.

### 26. Legal pages exist but are not yet enough for enterprise privacy expectations

- Severity: P2
- Area: Privacy, legal, compliance
- Evidence: legal routes exist at `src/routes/publicRoutes.js:989-1023`, and widget links are visible at `frontend/widget.html:183-190`. Data deletion/export owner routes exist at `src/routes/agentRoutes.js:2390-2539`.
- Why this is risky: enterprise buyers will expect retention, subprocessors, DPA, AI data use, deletion/export SLAs, and visitor rights handling, not just basic policy pages.
- Recommended fix: add a privacy readiness pack: retention policy, subprocessors, data export/deletion procedures, DPA path, AI provider data-use statement, and support contact.
- Acceptance criteria: legal footer and dashboard account area link to complete privacy materials; support workflow for visitor/owner deletion/export is documented.

### 27. LocalStorage/session identity is pervasive

- Severity: P2
- Area: Privacy, reliability
- Evidence: `frontend/script.js` uses localStorage for agent key, visitor session, identity choice, and dismissed route state, including `frontend/script.js:2061-2083`.
- Why this is risky: localStorage can be blocked, cleared, shared across browser profiles, or considered consent-relevant under EU regimes.
- Recommended fix: centralize storage access with consent mode, expiration, clear/reset, and graceful no-storage fallback.
- Acceptance criteria: widget works when localStorage is unavailable; storage keys and retention periods are documented.

### 28. Customer-visible naming is inconsistent

- Severity: P2
- Area: Product maturity and copy
- Evidence: code and UI use "assistant", "widget", "AI Front Desk", "operator workspace", "Today", "Copilot", "workspace", and "Vonza AI" across files such as `frontend/widget.html:124-130`, `src/config/billingPlans.js:7-23`, and dashboard/operator PR titles.
- Why this is risky: enterprise buyers need a clear mental model of what they are buying and operating.
- Recommended fix: define a naming system: product, customer-facing assistant, dashboard workspace, optional operator features.
- Acceptance criteria: marketing, dashboard nav, install copy, billing copy, and public assistant use consistent terminology.

### 29. Public assistant default copy is generic

- Severity: P2
- Area: Product polish
- Evidence: `frontend/widget.html:124-130` defaults to "Vonza AI", "AI front desk for your website", "Quick answers", and "Hi! How can we help today?"
- Why this is risky: if bootstrap/config fails, customers see generic platform branding rather than a polished business-specific assistant.
- Recommended fix: make no-config/bad-config states explicit and professional. In valid installs, require business-specific assistant name/copy.
- Acceptance criteria: invalid config shows a support-safe message; valid installs always show tenant-specific branding or an intentional fallback.

### 30. Schema naming and ownership conventions are inconsistent

- Severity: P2
- Area: Database maintainability
- Evidence: most tenant tables use `owner_user_id`, while `front_desk_training_items` uses `owner_id` in `db/schema.sql:546-583`.
- Why this is risky: inconsistent ownership column names increase the chance of incorrect scoping, migrations, and RLS policy bugs.
- Recommended fix: standardize naming or document exceptions with compatibility views.
- Acceptance criteria: new tables follow one owner-column convention; lint/schema checks catch deviations.

### 31. Messages depend on indirect tenant ownership

- Severity: P2
- Area: Database, tenant isolation
- Evidence: `messages` in `db/schema.sql:49-63` references `agent_id` but does not include `owner_user_id`; RLS policies later use joins through agents.
- Why this is risky: indirect scoping works only if agent ownership is immutable and every query joins correctly. It is harder to audit and index.
- Recommended fix: consider denormalized `owner_user_id` with trigger enforcement for high-volume tenant tables.
- Acceptance criteria: message queries can be scoped by owner directly and are covered by indexes/tests.

### 32. Setup doctor exposes diagnostic structure in local fake-billing mode

- Severity: P2
- Area: Security hardening, operations
- Evidence: `src/routes/publicRoutes.js:1049-1080` exposes env key presence, embedding model/dimensions, and rate-limit readiness when `isLocalDevBillingRequestAllowed(req)` permits.
- Why this is risky: the values are not secrets, but diagnostic endpoint exposure should be impossible in hosted beta environments.
- Recommended fix: require explicit local environment plus loopback host plus non-production node env, and include deploy readiness assertion.
- Acceptance criteria: production/staging request always returns 404 regardless of fake-billing variables.

### 33. Render deployment configuration mixes production URL with staging label

- Severity: P2
- Area: Deployment clarity
- Evidence: `render.yaml` uses `PUBLIC_APP_URL` for `https://vonza-assistant.onrender.com` while setting `VONZA_DEPLOY_ENV=staging`, and `autoDeploy: false`.
- Why this is risky: staging/production semantics can confuse logs, readiness gates, billing mode, and customer support.
- Recommended fix: separate staging and production services, URLs, databases, Stripe modes, and env labels.
- Acceptance criteria: each environment has an explicit purpose, data boundary, and deploy runbook.

### 34. Open PR backlog indicates unresolved beta direction

- Severity: P2
- Area: Maintainability, product readiness
- Evidence: `gh pr list --limit 20` returned 11 open PRs, many directly related to Settings, operator workspace, Today, and dashboard architecture.
- Why this is risky: unmerged work can conflict with main or represent beta-critical functionality that is not in the deployed branch.
- Recommended fix: triage PRs into merge, close, or defer; rebase the chosen work onto `main`.
- Acceptance criteria: beta branch has no unresolved critical PR dependency.

## P3 - Later improvements

### 35. Add a formal threat model for public assistant/install surfaces

- Severity: P3
- Area: Security maturity
- Evidence: public endpoints include `/chat`, `/chat/capture`, `/widget/bootstrap`, `/install/*`, full-page assistant routes, and embed scripts.
- Why this is risky: public, cross-origin, embedded AI surfaces have unusual abuse paths.
- Recommended fix: document trust boundaries, attacker capabilities, allowed origins, token types, data flows, and residual risks.
- Acceptance criteria: threat model exists and is updated with every public surface change.

### 36. Add observability beyond console logging

- Severity: P3
- Area: Reliability and operations
- Evidence: route handlers and services use `console.error`, `console.warn`, and `console.info` broadly.
- Why this is risky: production incidents need structured logs, trace IDs, alerting, and dashboards.
- Recommended fix: introduce structured logging with redaction, correlation IDs, and alerts for provider failures, webhook failures, import failures, and quota failures.
- Acceptance criteria: on-call view shows error rate, dependency failures, chat latency, import failures, Stripe webhook failures, and rate-limit activity.

### 37. Add versioned API contracts for widget/dashboard

- Severity: P3
- Area: Long-term maintainability
- Evidence: frontend JS calls many JSON endpoints directly, and public embed scripts can be long cached.
- Why this is risky: endpoint shape changes can break installed customer widgets.
- Recommended fix: version public widget/bootstrap/chat contracts and keep backward-compatible handlers.
- Acceptance criteria: contract tests pin public response schemas; breaking changes require version bump.

### 38. Build a customer-facing status and incident process

- Severity: P3
- Area: Enterprise maturity
- Evidence: no status-page or incident-response workflow was visible in repo inspection.
- Why this is risky: beta customers need credible communication during outages.
- Recommended fix: define status page, support SLA, escalation owner, and incident template.
- Acceptance criteria: incidents can be announced, updated, and closed with customer-safe language.

## Route/API audit table

| Route/API | Public or authenticated | Tenant scoped? | Risk | Recommendation |
|---|---:|---:|---|---|
| `/` marketing pages | Public | N/A | Low | Keep legal/footer links visible. |
| `/dashboard` | Public HTML, JS auth | Client-side shell only | Medium | Ensure all dashboard data APIs enforce server auth; avoid sensitive HTML bootstrap. |
| `/dashboard-v2-preview` | Public | N/A | High | Gate behind local/internal auth or remove from production. |
| `/full-page-assistant-v2-preview` | Public | N/A | High | Gate behind local/internal auth or remove from production. |
| `/public-config.js` | Public | N/A | Medium | Publish only required public config; remove internal flags/build details. |
| `/setup-doctor` | Local fake-billing gated | N/A | Medium | Ensure impossible in hosted env; deploy gate should assert. |
| `/health` | Public | N/A | High | Add dependency readiness endpoint and use it for deploy checks. |
| `/widget`, `/:a/:agentSlug`, `/assistant/:agentSlug` | Public | Via bootstrap/chat | Medium | Keep page public but require install/key validation for data. |
| `/embed.js`, `/embed-lite.js` | Public | N/A | Medium | Use versioned URLs if cached immutable. |
| `/assistant-embed.js` | Public | N/A | Medium | Keep shorter cache and contract tests. |
| `/widget/bootstrap` | Public | Yes, via install/origin/key checks | Medium | Keep rate limits and add forged-origin tests. |
| `/chat` | Public | Yes, via public context resolver | Medium | Continue strict origin/install checks; add CAPTCHA/abuse controls for high traffic. |
| `/chat/capture` | Public | Yes, via public context resolver | Medium | Add consent/retention clarity and rate-limit assertions. |
| `/chat/feedback` | Public | Expected by message/session | Medium | Ensure feedback cannot target other tenants/messages. |
| `/api/voice/transcribe` | Public-ish assistant | Expected by assistant context | Medium | Keep rate limits and privacy disclosure for audio processing. |
| `/install/ping` | Public | Install scoped | Medium | Keep rate limit and origin validation. |
| `/install/events` | Public | Install scoped | Medium | Validate event schema and throttle. |
| `/install/outcomes` | Public | Install scoped | Medium | Validate event schema and throttle. |
| `/install/cta` | Public redirect | Install scoped, target not clearly allowlisted | High | Rate limit and allowlist redirect targets. |
| `/agents/create` | Optional auth/pre-claim | Owner or client ID | Medium | Limit pre-claim scope and expire setup tokens. |
| `/agents/list` | Optional auth/pre-claim | Owner or client ID | Medium | Avoid listing via long-lived browser IDs. |
| `/agents/admin-list` | Static admin token | No tenant restriction | Critical | Replace with RBAC admin auth and audit. |
| `/agents/messages` and dashboard data routes | Authenticated | Agent/owner active access | Medium | Add route-level tests for every route. |
| `/dashboard/analytics` | Auth or admin token | Auth path scoped, admin broad | High | Remove query owner override; audit admin use. |
| `/knowledge/import` | Auth or pre-claim | Owner/client active/preclaim | High | Move to durable job and throttle. |
| `/product-events` | Optional auth | No enforced tenant proof when unauth | Critical | Require auth or signed public event context. |
| `/create-checkout-session` | Authenticated | Owner | Medium | Continue Stripe price validation; add lifecycle tests. |
| `/billing/change-plan` | Authenticated | Owner | Medium | Test proration/failure states. |
| `/stripe/webhook` | Public Stripe-signed | Stripe signature | Medium | Good signature verification; add webhook replay/order tests. |
| `/privacy/*` owner routes | Authenticated | Owner/agent access | Medium | Add visitor-facing deletion/export process. |
| Operator inbox/calendar/campaign routes | Authenticated | Owner/agent access | Medium | Verify UI promises match functional implementation. |
| Business/admin scrape routes | Admin or protected routes | Varies | High | Ensure no static-token broad scrape in production. |

## Customer-facing UX/copy audit

| Surface | Problem | Why it feels unprofessional | Suggested direction |
|---|---|---|---|
| Public assistant fallback | Mentions admin/content import internals. | Visitors should not see operational setup failures. | Use business-friendly fallback plus contact capture. |
| Widget identity choice | "Continue as guest" says anonymous while telemetry/session tracking exists. | "Anonymous" can conflict with fingerprint/session attribution. | Use "Continue without email" and disclose session tracking. |
| Powered-by/footer | "We're here to help | Powered by Vonza" is generic. | Looks template-like on customer websites. | Tenant-specific assistant status plus subtle Vonza attribution. |
| Dashboard previews | Public preview routes can show unfinished surfaces. | Buyers may evaluate prototype UI as product. | Remove/gate previews in production. |
| Billing copy | Plans sell "same core Front Desk" while access can be environment-bypassed. | Trust gap if internal entitlements are unclear. | Make beta entitlement and paid plan states explicit. |
| Operator workspace | Many open PRs indicate direction is unsettled. | Enterprise buyers expect coherent workflows, not shells. | Ship a smaller complete workspace. |
| Error states | Public chat displays raw backend error. | Technical failures feel scary and may leak internals. | Friendly fallback, retry guidance, support reference. |
| Legal/trust | Legal links exist, but consent/storage language is thin. | EU customers will ask about cookies, retention, subprocessors, and AI processing. | Add privacy pack and configurable consent mode. |

## Security/privacy checklist

| Item | Status | Evidence/notes |
|---|---|---|
| Dashboard APIs require auth | Partial | Most routes authenticate and call active access checks, but `/product-events` is optional auth. |
| Tenant scoping by `owner_user_id`/`agent_id` | Partial | Many routes enforce access; service-role bypass means missed checks are high impact. |
| Public widget allowed-domain checks | Partial pass | Context resolver and install checks exist; keep forged-origin tests. |
| CORS/origin validation | Partial | Public CORS reflects origin for public endpoints; private CORS relies on trusted origin logic. |
| Admin routes enterprise-safe | Fail | Static `ADMIN_TOKEN`, broad data/control, no RBAC/audit/rate limit. |
| Service-role leakage prevention | Partial | Secrets not printed, but service role is broadly used. |
| RLS enabled | Pass/partial | RLS exists in schema, but app service role bypasses it. |
| Rate limiting | Partial | Public chat/capture/bootstrap have limits; expensive authenticated routes need more. |
| Input validation | Partial | Good SSRF URL validation; event/metadata endpoints need stricter schemas. |
| XSS protections | Partial | Escaping exists in places, but broad `innerHTML` and `unsafe-inline` remain. |
| CSRF/session risk | Partial | Bearer-token API lowers cookie CSRF risk; admin token and public routes need hardening. |
| Secrets/env handling | Partial pass | Public-config tests protect major secrets; test scripts/logs need redaction. |
| Webhook verification | Pass | Stripe signature verification is present. |
| Dev-only bypass prevention | Fail | Temporary instant access exists and needs deploy hard-fail. |
| Privacy links before identity capture | Partial pass | Links visible in widget, but telemetry/localStorage consent is not explicit enough. |
| Data deletion/export expectations | Partial | Owner routes exist; visitor rights workflow unclear. |

## Production/deploy checklist

| Item | Status | Evidence/notes |
|---|---|---|
| Smoke tests pass | Pass | `npm run test:smoke` passed 625 tests. |
| Lint clean | Partial | Lint exits 0 but warnings remain. |
| Schema sync passes | Pass | `npm run check:schema-sync` passed. |
| Deploy readiness passes | Pass | `npm run verify:deploy-readiness` passed. |
| Production schema verification passes | Pass | `npm run verify:prod-schema` passed. |
| Clean DB validation passes | Fail | Missing clean DB URL. |
| Health checks dependencies | Fail | `/health` is liveness only. |
| Rate-limit backend production-ready | Unknown/pass from deploy script | Verify actual runtime Upstash and proxy settings before beta. |
| Production/staging separation | Partial | Render config says staging while public URL appears production-like. |
| Rollback/cache strategy for embeds | Partial | Unversioned immutable embed cache is risky. |
| Open PRs reconciled | Fail | 11 open PRs, many beta-relevant. |
| Browser checks for dashboard/widget | Not run in this audit | Needed after fixes and before beta invite. |

## Test coverage gaps

- Signup/login end-to-end with Supabase auth and dashboard redirect.
- Create assistant as a new owner from empty account.
- Pre-claim setup token expiry and invalid/stolen token behavior.
- Website import happy path, slow site, blocked SSRF/private host, timeout, restart, duplicate import.
- RAG retrieval quality and "no answer in source" refusal behavior.
- Public assistant full-page flow: valid config, bad config, no config, mobile viewport.
- Widget embed flow on an allowed domain and a disallowed domain.
- Visitor sends message, identifies with email, continues without email, resets identity.
- Lead capture appears in dashboard with correct owner/agent/customer scoping.
- Owner views conversation and cannot view another owner's conversation.
- `/product-events` forged tenant/event rejection after fix.
- CTA redirect allowlist and attribution privacy behavior.
- Stripe checkout completed, webhook replay, subscription updated, cancellation, past_due, unpaid, upgrade/downgrade.
- Temporary/beta entitlement state distinct from paid subscription state.
- Google connect/callback flow if enabled for beta.
- Browser-level dashboard hash route checks for settings, analytics, customers, install, front desk, billing.
- Browser-level public assistant XSS tests for imported content, owner prompts, and user messages.
- Clean database migration build and schema parity against `db/schema.sql`.

## Suggested fix order

1. First PR: close P0 security holes. Lock down `/product-events`, replace/gate static admin routes, and add tests for forged unauthenticated access.
2. Second PR: remove or hard-gate temporary instant workspace access and add beta entitlement records if needed.
3. Third PR: add production readiness endpoint, improve Render/deploy checks, and make clean DB validation pass in disposable infrastructure.
4. Fourth PR: sanitize public/customer-facing errors and add correlation IDs/log redaction.
5. Fifth PR: harden public install/widget telemetry: CTA allowlist, consent/storage framing, identifier minimization, rate limits.
6. Sixth PR: move website import/RAG indexing to a durable job model with visible status.
7. Seventh PR: reconcile dashboard/operator/settings PRs and ship one coherent workspace.
8. Eighth PR: add billing lifecycle integration tests and access-state edge cases.
9. Ninth PR: reduce monolith risk by extracting routes/UI modules around stable boundaries.
10. Tenth PR: run full browser QA across dashboard, widget, full-page assistant, legal, and billing routes.

## Final beta gate

Before inviting real customers, all of the following must be true:

- All P0 findings are fixed and covered by automated tests.
- Static admin-token access is removed from customer-data/control routes or replaced with audited RBAC.
- No environment-wide access bypass can be enabled in staging/production.
- `npm run validate:clean-db` passes against disposable infrastructure.
- `/ready` or equivalent dependency readiness fails closed for Supabase/schema/rate-limit misconfiguration.
- Public assistant never displays raw backend/provider/schema errors.
- Public event/CTA/telemetry endpoints require valid install context, rate limits, and schema validation.
- Privacy/cookie/legal copy covers localStorage, visitor/session tracking, AI message handling, retention, subprocessors, and deletion/export rights.
- Dashboard beta-critical PRs are merged or explicitly closed/deferred.
- Stripe lifecycle tests pass for checkout, webhook replay, cancel, past_due/unpaid, and plan change.
- Browser QA passes for signup/login, create assistant, import website, preview assistant, install widget, visitor chat, visitor email capture, lead in dashboard, billing, and legal links.
- Production/staging environments have separate URLs, databases, Stripe modes, env labels, and runbooks.
- The beta runbook documents deployment, rollback, incident response, support contact, and customer data deletion/export.
