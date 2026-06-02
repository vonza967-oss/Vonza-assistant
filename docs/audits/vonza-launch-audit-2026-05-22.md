# Vonza Launch Audit

Audit date: 2026-05-22
Repository: `/Users/matepetki/Documents/New project/Vonza `
HEAD: `eede64d` (`Harden public launch surfaces`)
Scope: full production-readiness audit for an independent pre-revenue SaaS launch of Vonza, an AI Front Desk / AI business operator for small businesses.

## Executive summary

Overall verdict: not ready for a real public SaaS launch.

Vonza has meaningful hardening already: route-scoped CORS, dashboard CSP, public assistant access keys, service-role secrets isolated to the backend, safe logging, SSRF checks for scraping, RLS in the canonical schema, schema-sync checks, a sizeable smoke suite, and no obvious secret exposure in the files inspected. That is a stronger base than most early products.

The product is still not launch-ready because the remaining gaps sit exactly where public SaaS products fail: legal/privacy surfaces are incomplete, the production deploy config does not prove distributed rate limiting and proxy identity are ready, pre-claim setup authority is too broad, public assistant framing is intentionally wide but not controlled per customer domain, and OpenAI cost-abuse controls are not strong enough for anonymous public traffic.

Estimated readiness: 62%.

Reasoning: core app flows are present and the required checks mostly pass, but public launch readiness is not only "does it run". The repository needs a hardening sprint across legal, rate limiting, access boundaries, abuse controls, monitoring, and product simplification before exposing it broadly.

Top 5 blockers:

1. Legal and privacy pages are still placeholder-driven and missing operator-specific details.
2. Production deploy config is still labeled staging and does not include Redis/Upstash or trusted proxy rate-limit configuration.
3. The pre-claim `client_id` flow can create, list, update, import, and verify unclaimed agents without user auth.
4. Public assistant pages/scripts use broad embedding policy (`frame-ancestors *`) without domain-scoped frame control.
5. Anonymous public chat can spend OpenAI budget before an atomic cost reservation succeeds, and usage recording failures do not block the response.

Top 5 high-impact improvements:

1. Convert setup/onboarding authority from long-lived `client_id` bearer behavior to short-lived signed setup tokens with narrow scopes.
2. Add Redis/Upstash rate limiting, trusted proxy configuration, per-agent budgets, and Turnstile risk triggers before opening public traffic.
3. Finalize Hungarian/EU legal pages, privacy notices, retention jobs, export/delete surfaces, and public assistant privacy copy.
4. Add a RAG evaluation suite for SMB truthfulness, especially prices, services, availability, policies, and owner-approved overrides.
5. Simplify the install/product UX to one default hosted assistant path, one widget path, and the WordPress plugin, with advanced embed modes hidden.

## Severity legend

- P0 = launch blocker / critical security or data risk
- P1 = must fix before public launch
- P2 = should fix soon after or before serious customers
- P3 = polish / medium priority
- P4 = later roadmap

Finding count:

- P0: 2
- P1: 14
- P2: 35
- P3: 13
- P4: 2
- Total: 66

## Current repo state

Initial `git status --short`:

```text
 M .DS_Store
?? docs/clean-db-validation.md
?? docs/paid-pilot-plan.md
?? docs/repo-cleanup-plan.md
?? docs/staging-readiness.md
?? output/
```

Initial revision:

```text
git rev-parse --short HEAD: eede64d
git log -1 --oneline: eede64d Harden public launch surfaces
```

The audit did not modify production code. The only intended file change is this report.

## Files inspected

Representative files inspected:

- App/bootstrap/security: `src/app/createApp.js`, `src/utils/corsPolicy.js`, `src/utils/securityHeaders.js`, `src/utils/httpGuards.js`, `src/utils/rateLimiter.js`, `src/utils/safeLogger.js`, `src/clients/supabaseClient.js`, `src/config/env.js`, `src/config/legalContent.js`
- Routes: `src/routes/publicRoutes.js`, `src/routes/agentRoutes.js`, `src/routes/chatRoutes.js`, `src/routes/agentRoutes/*`, `src/routes/businessRoutes.js`
- Services: `src/services/agents/agentService.js`, `src/services/chat/chatService.js`, `src/services/chat/prompting.js`, `src/services/training/frontDeskTrainingService.js`, `src/services/analytics/visitorReplyFeedbackService.js`, `src/services/privacy/privacyControlService.js`, `src/services/scraping/websiteContentService.js`, `src/services/billing/*`, `src/services/operator/*`, `src/services/schema/*`
- Frontend/public assistant: `frontend/dashboard.js`, `frontend/script.js`, `frontend/settings/SettingsShell.js`, `frontend/dashboard.css`, `frontend/settings/settings.css`, `assistant-embed.js`, `embed.js`, `embed-lite.js`, `service-worker.js`, public assistant templates and CSS
- Database/migrations: `db/schema.sql`, `supabase/migrations/*`, `scripts/check-schema-sync.js`, `scripts/verify-deploy-readiness.js`
- WordPress plugin: `wordpress/vonza-front-desk/vonza-front-desk.php`, `wordpress/vonza-front-desk/includes/*`, `wordpress/vonza-front-desk/templates/*`, `wordpress/vonza-front-desk/assets/*`, `wordpress/vonza-front-desk/readme.txt`
- Deploy/config/tests: `render.yaml`, `package.json`, `.env.example`, presence and key names in `.env`, `tests/*`

Secrets note: `.env` was inspected only for variable names and presence. No secret values were printed or copied into this report.

## Checks run

Required checks:

| Check | Result |
| --- | --- |
| `node --check frontend/dashboard.js` | Pass |
| `node --check frontend/script.js` | Pass |
| `node --check frontend/settings/SettingsShell.js` | Pass |
| `node --check assistant-embed.js` | Pass |
| `npm run test:smoke` | Pass, 557 tests passed |
| `npm run check:schema-sync` | Pass, 37 tracked persistence tables |
| `npm run lint` | Pass exit code, but reported 108 warnings |
| `git diff --check` | Pass before report creation |

Additional check:

| Check | Result |
| --- | --- |
| `npm audit --omit=dev --audit-level=moderate` | Fail, moderate `ws` advisory |

Because a check failed and the working tree already had unrelated dirty files, this report should not be committed automatically.

## Findings

### SEC-001 - Production rate-limit backend is not proven in deploy config

- Severity: P1
- Area: Security
- Finding: The rate limiter defaults to Redis/Upstash outside local/test, but `render.yaml` does not include `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`, `REDIS_TOKEN`, or `TRUSTED_PROXY_IPS`.
- Evidence from repo: `src/utils/rateLimiter.js` fails closed with `Distributed rate limit backend is not configured.` when Redis/Upstash envs are missing. `render.yaml` omits those env vars.
- Risk: Public chat, feedback, install, and auth-adjacent endpoints can either return 503 in production or rate-limit the wrong proxy identity. This is both availability risk and abuse-control risk.
- Recommended fix: Add explicit Upstash/Redis envs, configure trusted proxy IPs for Render, add a deploy-readiness check for rate-limit backend reachability, and run a staging load test.
- Estimated effort: M
- Suggested owner: backend, ops
- Launch-blocking: Yes

### SEC-002 - Public assistant frame policy is too broad for launch

- Severity: P1
- Area: Security
- Finding: Public assistant pages and embed scripts use `frame-ancestors *`.
- Evidence from repo: `src/utils/securityHeaders.js` builds public assistant CSP with `frame-ancestors *`; `/widget`, `/a/:slug`, `/assistant/:slug`, `/embed.js`, `/embed-lite.js`, and `/assistant-embed.js` share that policy.
- Risk: Any site can frame a public assistant URL. That supports embedding, but it also enables brand impersonation, clickjacking-style UI capture, and unapproved third-party distribution.
- Recommended fix: Generate CSP per assistant/install using allowed domains. Keep a narrowly scoped fallback for intentional universal hosted links, and add owner-visible revoke/regenerate controls.
- Estimated effort: M
- Suggested owner: backend, frontend
- Launch-blocking: Yes

### SEC-003 - Pre-claim setup authority is too broad

- Severity: P1
- Area: Security
- Finding: Unauthenticated clients with `client_id` can operate meaningful setup flows before claim.
- Evidence from repo: `src/routes/agentRoutes.js` allows `client_id`-based access for create/list/update/import/install verification paths. `src/services/agents/agentService.js` includes `requirePreClaimAgentAccess` and related pre-claim access paths.
- Risk: A leaked browser `client_id` acts as a bearer secret for unclaimed agents. An attacker can alter setup settings, import website content, or interfere with installation before the owner claims the account.
- Recommended fix: Replace broad pre-claim `client_id` authority with signed setup tokens that have short TTLs, one-time claim binding, route scopes, and strict rate limits. Restrict unauthenticated updates to only fields required for onboarding.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: Yes

### SEC-004 - Error responses can expose internal messages

- Severity: P2
- Area: Security
- Finding: The global error handler returns `err.message` for most errors.
- Evidence from repo: `src/app/createApp.js` sends `{ error: err.message || "Internal server error" }` outside the special 503 case.
- Risk: Database, provider, rate-limit, validation, or implementation details can leak to public callers.
- Recommended fix: Map known client errors to safe public messages and log internal details server-side only. Add tests for public route error bodies.
- Estimated effort: S
- Suggested owner: backend
- Launch-blocking: No

### SEC-005 - Public preview routes remain exposed

- Severity: P2
- Area: Security
- Finding: Preview routes are public while fixture/debug routes are local-guarded.
- Evidence from repo: `src/routes/publicRoutes.js` exposes `/dashboard-v2-preview` and `/full-page-assistant-v2-preview`; `/dashboard-v2-fixture` and `/assistant-embed-matrix` have local-only guards.
- Risk: Stale or experimental UI can be indexed, shared, or confused with the production app.
- Recommended fix: Remove preview routes in production or guard them behind the same local/dev condition used for fixtures.
- Estimated effort: S
- Suggested owner: frontend, backend
- Launch-blocking: No

### SEC-006 - Full-page QR route leaks the page key in a response header

- Severity: P2
- Area: Security
- Finding: The private QR SVG endpoint includes the target full-page URL in `X-Vonza-QR-Target`.
- Evidence from repo: `src/routes/agentRoutes.js` QR route returns a header containing the public assistant URL, which includes the page key.
- Risk: Browser extensions, logs, proxies, or support tooling can capture the public page key. The route is private, but the header is still unnecessary secret surface.
- Recommended fix: Remove the header or return only non-sensitive metadata. Show the URL in the authenticated dashboard UI where needed.
- Estimated effort: S
- Suggested owner: backend
- Launch-blocking: No

### SEC-007 - Upload validation is incomplete for public assets

- Severity: P2
- Area: Security
- Finding: Background uploads validate declared MIME and file extensions but not magic bytes or malware/content safety.
- Evidence from repo: `src/routes/agentRoutes.js` parses multipart uploads for front desk backgrounds, limits image/video size, validates extension/MIME, and stores assets in Supabase storage.
- Risk: Polyglot files, mislabeled content, or malicious media can be hosted under Vonza-controlled public asset URLs.
- Recommended fix: Add magic-byte validation, metadata stripping, image/video re-encoding where practical, optional malware scan, and storage bucket policies that keep uploads scoped per owner/agent.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### SEC-008 - RLS policy coverage needs a strict inventory

- Severity: P2
- Area: Security
- Finding: RLS is enabled broadly, but policy coverage is not visibly complete for every operator/Google table in the canonical schema.
- Evidence from repo: `db/schema.sql` enables RLS and defines many owner policies, but several operator/Google tables should be explicitly inventoried against policies and tests.
- Risk: If any of these tables are exposed through Supabase browser clients later, missing policies can cause either access failure or accidental exposure depending on future changes.
- Recommended fix: Add an automated schema test that every RLS-enabled table has expected select/insert/update/delete policies or is explicitly marked server-only.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### SEC-009 - Inline script/style CSP weakens browser protection

- Severity: P3
- Area: Security
- Finding: Dashboard and public assistant CSP allow `unsafe-inline`.
- Evidence from repo: `src/utils/securityHeaders.js` includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`.
- Risk: CSP provides less protection against XSS if any injection bug lands.
- Recommended fix: Move inline scripts/styles to static files or add nonces/hashes. Start with dashboard because it is authenticated.
- Estimated effort: M
- Suggested owner: frontend
- Launch-blocking: No

### SEC-010 - HSTS is missing

- Severity: P3
- Area: Security
- Finding: Security headers do not include `Strict-Transport-Security`.
- Evidence from repo: `src/utils/securityHeaders.js` sets content type, referrer, permissions policy, CSP, and X-Frame-Options, but no HSTS.
- Risk: Users can be downgraded on first visit in some network scenarios unless the platform handles this externally.
- Recommended fix: Add HSTS in production after confirming HTTPS-only operation on all public domains.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: No

### SEC-011 - Admin token model is too coarse for real operations

- Severity: P3
- Area: Security
- Finding: Admin operations use a static `ADMIN_TOKEN`.
- Evidence from repo: `src/utils/httpGuards.js` implements `requireAdminToken`; admin endpoints in `src/routes/agentRoutes.js` accept this header/Bearer token.
- Risk: One leaked token grants broad admin powers with no user identity, role separation, or granular audit.
- Recommended fix: Keep it for early ops only if necessary, but move admin actions to authenticated operator users with role claims, rotation, IP restrictions, and audit logs.
- Estimated effort: M
- Suggested owner: backend, ops
- Launch-blocking: No

### ABUSE-001 - Anonymous public chat lacks atomic cost reservation

- Severity: P1
- Area: Abuse/rate limiting
- Finding: Chat usage is recorded after the OpenAI call, and failures to record usage do not block the answer.
- Evidence from repo: `src/services/chat/chatService.js` checks billing caps before generation, then logs usage after response; usage recording failures are warning-level.
- Risk: High-volume requests or transient database failures can create unbilled/untracked OpenAI spend.
- Recommended fix: Add atomic per-agent budget reservation before model calls, decrement or finalize after completion, and fail closed when usage cannot be reserved.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: Yes

### ABUSE-002 - Route-specific abuse controls are incomplete

- Severity: P1
- Area: Abuse/rate limiting
- Finding: Public chat, capture, feedback, bootstrap, install signal, auth-adjacent, and install verify have limits, but not every public write/redirect path has explicit controls.
- Evidence from repo: `src/utils/rateLimiter.js` defines named limits. `src/routes/agentRoutes.js` has public paths such as `/install/cta` and `/product-events` that need explicit review.
- Risk: Attackers can spam analytics/product events, inflate install metrics, or use redirect/tracking routes for noisy abuse.
- Recommended fix: Add a route-by-route public endpoint table with per-IP, per-agent, per-session, and per-install limits. Cover redirects and analytics writes.
- Estimated effort: S
- Suggested owner: backend
- Launch-blocking: Yes

### ABUSE-003 - Turnstile is optional and not productized

- Severity: P2
- Area: Abuse/rate limiting
- Finding: Turnstile hooks exist but are controlled by backend envs and are not clearly wired as a risk-based product behavior.
- Evidence from repo: `src/utils/httpGuards.js` checks `REQUIRE_PUBLIC_CHAT_TURNSTILE` and `TURNSTILE_SECRET_KEY`; `.env.example` includes Turnstile env names.
- Risk: The product either has no challenge during abuse or challenges all public chat traffic without UX preparation.
- Recommended fix: Add risk-triggered Turnstile after repeated requests, suspicious user agents, high token spend, or feedback spam. Include frontend state and owner-visible docs.
- Estimated effort: M
- Suggested owner: backend, frontend
- Launch-blocking: No

### ABUSE-004 - Repeated-message detection is too narrow

- Severity: P2
- Area: Abuse/rate limiting
- Finding: Repeated-message protection is local to recent request payload history and does not provide durable per-agent abuse memory.
- Evidence from repo: `src/utils/httpGuards.js` enforces message length, history length, and repeated-message checks.
- Risk: Low-sophistication spam is blocked, but distributed or slow abuse can still burn model tokens.
- Recommended fix: Track short rolling fingerprints in Redis by agent/session/IP and block repeated or near-duplicate prompts across windows.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### ABUSE-005 - Contact capture and feedback spam need moderation paths

- Severity: P2
- Area: Abuse/rate limiting
- Finding: Public feedback and contact capture are rate-limited and length-limited, but the operational workflow for spam review is thin.
- Evidence from repo: `src/utils/httpGuards.js` limits capture/feedback sizes; `src/services/analytics/visitorReplyFeedbackService.js` stores feedback and status.
- Risk: Owners can receive polluted customer records and low-quality training suggestions.
- Recommended fix: Add spam scoring, hidden moderation status, per-agent blocklists, and "ignore this visitor/session" controls.
- Estimated effort: M
- Suggested owner: backend, product
- Launch-blocking: No

### ABUSE-006 - Bot controls rely too much on user-agent checks

- Severity: P3
- Area: Abuse/rate limiting
- Finding: Bot user-agent blocking exists but is weak and bypassable.
- Evidence from repo: `src/utils/httpGuards.js` has user-agent logic for public chat.
- Risk: Real abuse will not identify itself with obvious bot user agents.
- Recommended fix: Combine WAF rules, Redis counters, session fingerprints, ASN/IP reputation, payload heuristics, and Turnstile.
- Estimated effort: M
- Suggested owner: backend, ops
- Launch-blocking: No

### AUTH-001 - Temporary instant workspace access is dangerous if enabled

- Severity: P1
- Area: Auth/billing/access
- Finding: `TEMP_INSTANT_WORKSPACE_ACCESS` can bypass active access checks for owner flows.
- Evidence from repo: `src/services/agents/agentService.js` references the temporary access override; startup warnings exist, but the audit did not find a hard production reject in deploy config.
- Risk: A forgotten env flag can turn paid/private gating into a soft check.
- Recommended fix: Make deploy readiness fail in production when this flag is truthy. Add a test that `NODE_ENV=production` cannot boot with it.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: Yes

### AUTH-002 - Dev fake billing needs a production kill switch test

- Severity: P1
- Area: Auth/billing/access
- Finding: Fake billing is guarded for local use, but production safety should be enforced at deploy-readiness level.
- Evidence from repo: `src/routes/publicRoutes.js` exposes `VONZA_DEV_FAKE_BILLING` only under local dev guard; `.env.example` references billing/test flags.
- Risk: Any fake-billing bypass in production would undermine paid access.
- Recommended fix: Add a deploy-readiness assertion that all fake/dev billing flags are absent or false for production.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: Yes

### AUTH-003 - Some service-layer owner filters are weaker than route gates

- Severity: P2
- Area: Auth/billing/access
- Finding: Several services rely on route-level agent ownership instead of also filtering by owner in the data operation.
- Evidence from repo: `src/services/analytics/visitorReplyFeedbackService.js` lists/updates feedback by agent id; `src/services/privacy/privacyControlService.js` exports/deletes messages by agent/session/email after route gating.
- Risk: A future route bug or reused service call could become object-level authorization failure.
- Recommended fix: Require `owner_user_id` or an owner-validated agent context in service functions and add regression tests.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### AUTH-004 - High-impact operator actions need stronger confirmation

- Severity: P2
- Area: Auth/billing/access
- Finding: Operator actions such as inbox replies and campaign approvals are high-impact business operations.
- Evidence from repo: `src/routes/agentRoutes.js` wires operator/business actions behind authenticated active access; operator services exist under `src/services/operator/*`.
- Risk: A compromised session can send messages or approve campaigns without a second guard.
- Recommended fix: Add explicit confirmation, audit logging, and optional re-auth for send/approve actions before public operator launch.
- Estimated effort: M
- Suggested owner: backend, product
- Launch-blocking: No

### AUTH-005 - Public/private boundary is complex and needs test coverage per route

- Severity: P2
- Area: Auth/billing/access
- Finding: `src/routes/agentRoutes.js` mixes public install/widget paths, pre-claim paths, authenticated dashboard paths, admin-token paths, billing paths, and upload paths.
- Evidence from repo: `src/routes/agentRoutes.js` is over 3,000 lines and contains many route-specific auth branches.
- Risk: New routes can accidentally land in the wrong access model.
- Recommended fix: Add a generated route inventory test that asserts auth mode, CORS mode, rate-limit mode, and billing gate for each route.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### PRIV-001 - Legal pages are not launch-ready

- Severity: P0
- Area: Privacy/legal
- Finding: Public legal content still contains placeholder/missing operator-specific legal fields.
- Evidence from repo: `src/config/legalContent.js` contains Hungarian legal/privacy pages and explicit missing-field style content.
- Risk: A public SaaS handling visitor names, emails, phone numbers, chat content, business data, and potentially EU/Hungarian users cannot launch with incomplete legal documents.
- Recommended fix: Finalize `aszf`, `impresszum`, privacy notice, cookie notice, processor/subprocessor language, controller/processor roles, contact details, retention, deletion/export, and Stripe/payment terms with legal review.
- Estimated effort: M
- Suggested owner: legal, product
- Launch-blocking: Yes

### PRIV-002 - Data retention settings are not enforced automatically

- Severity: P1
- Area: Privacy/legal
- Finding: Retention settings exist, but no scheduled deletion job was found.
- Evidence from repo: `src/services/privacy/privacyControlService.js` defines retention defaults and settings; no cron/automation path for applying them was identified.
- Risk: Vonza can retain visitor/customer personal data longer than promised.
- Recommended fix: Add a scheduled retention job for messages, leads, feedback, analytics events, and operator records. Log aggregate deletion counts, not raw PII.
- Estimated effort: M
- Suggested owner: backend, legal
- Launch-blocking: Yes

### PRIV-003 - Public assistant lacks clear just-in-time privacy notice

- Severity: P1
- Area: Privacy/legal
- Finding: Visitor identity/contact capture exists, but the public assistant surfaces need clearer privacy notice and consent text.
- Evidence from repo: `frontend/script.js` stores visitor identity in localStorage and supports contact capture; `src/routes/publicRoutes.js` serves legal pages; public assistant UI should link them directly.
- Risk: Visitors may submit personal data without knowing who receives it, why it is stored, and how to request deletion.
- Recommended fix: Add concise privacy microcopy and legal links in widget/full-page modes, including owner business name, Vonza role, retention/deletion language, and contact path.
- Estimated effort: S
- Suggested owner: frontend, legal
- Launch-blocking: Yes

### PRIV-004 - LocalStorage identity behavior needs cookie/storage disclosure

- Severity: P2
- Area: Privacy/legal
- Finding: Visitor identity/session data is stored client-side.
- Evidence from repo: `frontend/script.js` uses localStorage identity behavior with a 30-day style TTL.
- Risk: EU/Hungarian launch requires clear cookie/local storage disclosure, especially when identity is captured.
- Recommended fix: Update cookie notice and public assistant footer copy. Provide owner setting for contact capture and identity memory.
- Estimated effort: S
- Suggested owner: frontend, legal
- Launch-blocking: No

### PRIV-005 - Export/delete is present but not complete as a product surface

- Severity: P2
- Area: Privacy/legal
- Finding: Privacy export/delete services exist, but launch needs a complete owner-facing workflow and support process.
- Evidence from repo: `src/services/privacy/privacyControlService.js` implements export/delete logic for visitor/person/contact/lead/action scopes.
- Risk: Manual or partial DSAR handling creates compliance and trust risk.
- Recommended fix: Add dashboard UX for data subject lookup, export, delete, retention settings, and audit log. Document support escalation.
- Estimated effort: M
- Suggested owner: backend, frontend, legal
- Launch-blocking: No

### PRIV-006 - Logs are safer than average but need retention policy

- Severity: P3
- Area: Privacy/legal
- Finding: Safe logging redacts many PII fields, but operational log retention is not defined in repo config.
- Evidence from repo: `src/utils/safeLogger.js` redacts secrets, emails, phone numbers, and production PII fields.
- Risk: Platform logs can still contain metadata that becomes personal data under EU rules.
- Recommended fix: Define log retention, access control, incident export rules, and sample checks in ops docs.
- Estimated effort: S
- Suggested owner: ops, legal
- Launch-blocking: No

### RAG-001 - Owner custom prompt can weaken non-negotiable answer rules

- Severity: P1
- Area: RAG/answer quality
- Finding: Owner-provided agent instructions are appended inside the prompt after hard reliability rules.
- Evidence from repo: `src/services/chat/prompting.js` includes hard rules and then appends `Additional agent instructions`.
- Risk: A well-meaning owner can accidentally tell the assistant to improvise prices, policies, or guarantees, weakening the product's core safety promise.
- Recommended fix: Split non-overridable system policy from owner instructions. Validate or sandbox owner instructions, and add tests that owner prompts cannot override "never invent" rules.
- Estimated effort: M
- Suggested owner: backend, product
- Launch-blocking: Yes

### RAG-002 - Approved-answer retrieval is too weak for launch claims

- Severity: P1
- Area: RAG/answer quality
- Finding: Approved answers use token-overlap scoring, not semantic retrieval or deterministic intent matching.
- Evidence from repo: `src/services/training/frontDeskTrainingService.js` computes approved answer relevance from token overlap and returns top matches.
- Risk: Owner-approved answers may not override weak context when the visitor asks the same thing differently.
- Recommended fix: Add semantic retrieval for approved answers, exact normalized question matching, and tests that approved answers win over scraped context.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: Yes

### RAG-003 - Website knowledge can go stale without owner warning

- Severity: P2
- Area: RAG/answer quality
- Finding: Website import stores scraped content, but no staleness workflow was found.
- Evidence from repo: `src/services/scraping/websiteContentService.js` imports and stores website content; dashboard tests cover import status, but no scheduled recrawl was identified.
- Risk: The assistant can answer from outdated prices, opening hours, services, or policies.
- Recommended fix: Add `last_crawled_at` surfacing, stale warnings, owner-triggered recrawl, and optional scheduled recrawl with change summary.
- Estimated effort: M
- Suggested owner: backend, frontend
- Launch-blocking: No

### RAG-004 - No SMB answer-quality evaluation suite

- Severity: P2
- Area: RAG/answer quality
- Finding: Smoke tests are broad, but there is no dedicated truthfulness/evaluation suite for common small-business questions.
- Evidence from repo: `tests/*` covers many flows; no eval fixture set for prices, services, policies, availability, contact capture, and uncertainty behavior was identified.
- Risk: Regressions in answer quality can ship unnoticed.
- Recommended fix: Add deterministic evals for "known", "unknown", "policy", "price", "opening hours", "contact capture", "approved override", and "cross-agent leakage" scenarios.
- Estimated effort: M
- Suggested owner: backend, product
- Launch-blocking: No

### RAG-005 - Temperature is high for factual front-desk answering

- Severity: P2
- Area: RAG/answer quality
- Finding: The chat model uses a relatively high temperature for a factual assistant.
- Evidence from repo: `src/services/chat/chatService.js` uses `gpt-4o-mini` with `temperature: 0.85`.
- Risk: Higher variability increases the chance of invented phrasing, weak uncertainty handling, or inconsistency across repeated questions.
- Recommended fix: Lower temperature for grounded answers, or use route-level policies where factual answers are low-temperature and creative rewrite paths are separate.
- Estimated effort: S
- Suggested owner: backend, product
- Launch-blocking: No

### RAG-006 - Prompt-injection defense relies mostly on prompting

- Severity: P2
- Area: RAG/answer quality
- Finding: Scraped website content is marked untrusted, but defensive handling is mostly prompt-based.
- Evidence from repo: `src/services/chat/prompting.js` tells the model to ignore instructions from retrieved content; `src/services/scraping/websiteContentService.js` strips scripts and blocks unsafe URLs.
- Risk: Malicious or compromised website text can still attempt prompt injection or instruction confusion.
- Recommended fix: Add retrieval content sanitization/classification, prompt-injection evals, and warnings for suspicious imported content.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### DASH-001 - Dashboard code is too large and fragile

- Severity: P2
- Area: Dashboard UX
- Finding: `frontend/dashboard.js` is very large and lint warns about dead/unused/unreachable code.
- Evidence from repo: `frontend/dashboard.js` is over 20,000 lines. `npm run lint` exits 0 but reports many warnings across dashboard code.
- Risk: Product changes are risky, regressions are hard to isolate, and no-op or stale UI can survive unnoticed.
- Recommended fix: Split dashboard into page modules, shared state/api helpers, and reusable components. Make lint warnings fail for touched files.
- Estimated effort: L
- Suggested owner: frontend
- Launch-blocking: No

### DASH-002 - Install UX exposes too many modes too early

- Severity: P2
- Area: Dashboard UX
- Finding: The product exposes normal widget, hosted page, assistant route, smart embed, section embed, full-page canvas, QR, WordPress template mode, and more.
- Evidence from repo: `assistant-embed.js`, `frontend/script.js`, dashboard install/full-page settings, and WordPress plugin all support multiple modes.
- Risk: A founder/operator user will not know which path is the recommended launch path.
- Recommended fix: Make defaults explicit: hosted page, standard widget snippet, and WordPress plugin. Hide section/smart/page-takeover/custom canvas behind "Advanced".
- Estimated effort: M
- Suggested owner: product, frontend
- Launch-blocking: No

### DASH-003 - Settings language is still too technical

- Severity: P2
- Area: Dashboard UX
- Finding: Full-page assistant customization and install controls expose technical concepts as product choices.
- Evidence from repo: dashboard settings/install code references embed modes, full-page/background/customization controls, QR, smart embed, and WordPress integration.
- Risk: Non-technical small-business owners can misconfigure public assistant behavior or fail to launch.
- Recommended fix: Rename settings around outcomes: "Public assistant page", "Website chat button", "WordPress setup", "Share QR code", and "Advanced embed options".
- Estimated effort: M
- Suggested owner: product, frontend
- Launch-blocking: No

### DASH-004 - Mobile dashboard needs manual QA before pilots

- Severity: P3
- Area: Dashboard UX
- Finding: Responsive CSS exists, but no browser/mobile visual verification was run in this audit.
- Evidence from repo: `frontend/dashboard.css`, `frontend/settings/settings.css`, and smoke tests exist; this audit did not run Playwright screenshots.
- Risk: A mobile-heavy SMB owner may hit layout overflow or unusable controls.
- Recommended fix: Add a Playwright screenshot checklist for Home, Customers, Training, Analytics, Install, and Settings at mobile/tablet/desktop widths.
- Estimated effort: M
- Suggested owner: frontend
- Launch-blocking: No

### DASH-005 - AI draft/send copy should be audited for exact action semantics

- Severity: P3
- Area: Dashboard UX
- Finding: Any button that sounds like it sends a customer message must only appear when it actually sends.
- Evidence from repo: dashboard and operator code includes AI draft/reply concepts and inbox workflows.
- Risk: Operators can misunderstand whether an AI response is a draft, a prepared reply, or a sent customer message.
- Recommended fix: Use "Prepare draft" for drafts, "Send reply" only for irreversible sending, and add confirmation for live outbound messages.
- Estimated effort: S
- Suggested owner: product, frontend
- Launch-blocking: No

### PUX-001 - Public page key is a bearer secret with limited owner-facing lifecycle

- Severity: P1
- Area: Public assistant UX
- Finding: Hosted full-page assistant access depends on a public page key in the URL.
- Evidence from repo: `src/services/agents/agentService.js` requires `publicPageEnabled` and public page key for full-page access; QR/full-page routes generate/share that URL.
- Risk: If a URL is forwarded, indexed, or leaked, anyone with it can access the assistant until the owner disables/regenerates it.
- Recommended fix: Add obvious dashboard controls for enable, disable, regenerate, last used, and copied/shared state. Consider optional custom slug without secret for public pages plus domain/install restrictions where appropriate.
- Estimated effort: M
- Suggested owner: backend, frontend, product
- Launch-blocking: Yes

### PUX-002 - Public assistant needs visible legal/privacy footer links

- Severity: P2
- Area: Public assistant UX
- Finding: Public assistant modes should carry privacy/legal links close to the identity and contact capture surfaces.
- Evidence from repo: legal routes exist in `src/routes/publicRoutes.js`; `frontend/script.js` handles identity and contact capture.
- Risk: Visitor trust and compliance suffer, especially in QR/full-page contexts where the assistant is the whole experience.
- Recommended fix: Add compact footer links and owner business identity in widget, hosted page, and WordPress template modes.
- Estimated effort: S
- Suggested owner: frontend, legal
- Launch-blocking: No

### PUX-003 - Feedback UI can pollute training workflows

- Severity: P2
- Area: Public assistant UX
- Finding: Public helpful/not helpful feedback is valuable but can be abused or low-quality.
- Evidence from repo: `frontend/script.js` supports feedback controls; `src/services/analytics/visitorReplyFeedbackService.js` stores and dedupes feedback.
- Risk: Owner training queues can be polluted by spam, sarcasm, or prompt attacks.
- Recommended fix: Separate visitor feedback from owner-approved training by default. Add spam score, ignore actions, and clear owner review states.
- Estimated effort: M
- Suggested owner: backend, frontend
- Launch-blocking: No

### PUX-004 - Embed debug logging should be removed

- Severity: P3
- Area: Public assistant UX
- Finding: Lightweight embed code logs iframe URL details to the browser console.
- Evidence from repo: `embed-lite.js` logs iframe URL information.
- Risk: Console logs can expose assistant URLs and look unfinished to technical customers.
- Recommended fix: Remove public debug logs or gate them behind an explicit debug query parameter.
- Estimated effort: S
- Suggested owner: frontend
- Launch-blocking: No

### PUX-005 - Smart embed/page takeover needs a compatibility matrix

- Severity: P3
- Area: Public assistant UX
- Finding: `assistant-embed.js` mutates host pages and supports multiple layout modes.
- Evidence from repo: `assistant-embed.js` handles smart embed, section/full-page/page-takeover behavior, reset selectors, title/footer hiding, resize messaging, and background controls.
- Risk: Host websites can break in hard-to-debug ways, especially page builders and WordPress themes.
- Recommended fix: Treat smart/page-takeover embed as experimental until tested against a compatibility matrix.
- Estimated effort: M
- Suggested owner: frontend, product
- Launch-blocking: No

### WP-001 - WordPress plugin is private-launch quality, not WordPress.org-ready

- Severity: P2
- Area: WordPress plugin
- Finding: The plugin has solid nonce/capability/sanitization basics, but it lacks WordPress.org packaging rigor.
- Evidence from repo: `wordpress/vonza-front-desk/includes/class-vonza-front-desk-plugin.php`, admin, renderer, template, assets, and readme are present. No PHPCS/uninstall cleanup workflow was identified.
- Risk: Public directory submission would likely fail review or create support burden.
- Recommended fix: Keep private for pilots. Add PHPCS, uninstall cleanup, stable `tested up to`, translation/i18n pass, privacy section, screenshots, changelog, and release packaging workflow.
- Estimated effort: M
- Suggested owner: frontend, ops
- Launch-blocking: No

### WP-002 - Plugin app URL can point to arbitrary hosts

- Severity: P2
- Area: WordPress plugin
- Finding: Admins can configure the Vonza app URL to any valid URL.
- Evidence from repo: WordPress admin settings sanitize and validate URL shape, but do not enforce an expected Vonza origin.
- Risk: Misconfiguration can load third-party scripts into the customer site. Admins have authority, but this is still a sharp edge.
- Recommended fix: Default to official Vonza origin, warn on non-Vonza origins, and optionally restrict in release builds.
- Estimated effort: S
- Suggested owner: frontend, product
- Launch-blocking: No

### WP-003 - Template takeover can conflict with themes/builders

- Severity: P2
- Area: WordPress plugin
- Finding: The plugin can adopt/create a page and replace template output.
- Evidence from repo: WordPress `template_include` behavior, shortcode fallback, page adoption, and template file exist under `wordpress/vonza-front-desk`.
- Risk: Themes, SEO plugins, caching plugins, multilingual plugins, and page builders can conflict with the template.
- Recommended fix: Provide shortcode-first fallback, document known conflicts, add theme/page-builder matrix, and make template takeover opt-in with clear preview.
- Estimated effort: M
- Suggested owner: frontend, product
- Launch-blocking: No

### WP-004 - Footer/title hiding selectors are broad

- Severity: P3
- Area: WordPress plugin
- Finding: Template mode can hide theme footer/title areas using broad selectors.
- Evidence from repo: WordPress renderer/admin settings include hide title/footer behavior and CSS/template controls.
- Risk: The plugin can unintentionally hide unrelated content on some themes.
- Recommended fix: Scope hiding to the selected assistant page only, use safer body classes, and expose preview warnings.
- Estimated effort: S
- Suggested owner: frontend
- Launch-blocking: No

### WP-005 - Block editor integration is later roadmap

- Severity: P4
- Area: WordPress plugin
- Finding: The plugin is settings/shortcode/template oriented and does not include a Gutenberg block.
- Evidence from repo: Plugin file structure includes shortcode/template/admin assets, not a block build.
- Risk: Not a blocker, but WordPress users increasingly expect block insertion and live preview.
- Recommended fix: Add a simple block once the private plugin path is stable.
- Estimated effort: M
- Suggested owner: frontend
- Launch-blocking: No

### ARCH-001 - Backend depends heavily on route-level authorization with service-role database access

- Severity: P2
- Area: Architecture
- Finding: The server uses Supabase service role by design, which bypasses RLS for backend operations.
- Evidence from repo: `src/clients/supabaseClient.js` uses `SUPABASE_SERVICE_ROLE_KEY`; services perform owner and agent checks in application code.
- Risk: Any route authorization mistake can become a database-level data exposure or mutation issue.
- Recommended fix: Keep service role server-only, but enforce owner context inside service functions, add object-authorization unit tests, and avoid direct service methods that accept only `agent_id`.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### ARCH-002 - Frontend scripts need modularization

- Severity: P2
- Area: Architecture
- Finding: Dashboard, widget, and embed scripts carry too much behavior in large files.
- Evidence from repo: `frontend/dashboard.js` is over 20,000 lines, `frontend/script.js` over 3,000 lines, and `assistant-embed.js` over 1,000 lines.
- Risk: Releases become slow and risky. Dead code, duplicate states, and unclear button behavior accumulate.
- Recommended fix: Split into modules by page/feature, define API clients, and add focused tests around each module.
- Estimated effort: L
- Suggested owner: frontend
- Launch-blocking: No

### ARCH-003 - Schema/migration process is good but should include RLS policy assertions

- Severity: P2
- Area: Architecture
- Finding: Schema sync is checked, but RLS/policy expectations need stronger automated coverage.
- Evidence from repo: `npm run check:schema-sync` passed and `scripts/check-schema-sync.js` tracks 37 persistence tables; RLS policy coverage needs separate assertions.
- Risk: A migration can add a table or enable RLS without the intended owner policy shape.
- Recommended fix: Extend schema checks to require policy inventory, key indexes, and owner columns for customer data tables.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### ARCH-004 - CSS and UI state are sprawling

- Severity: P3
- Area: Architecture
- Finding: Dashboard/settings/public assistant styling is spread across large CSS and JS-driven states.
- Evidence from repo: `frontend/dashboard.css`, `frontend/settings/settings.css`, `frontend/script.js`, and dashboard code implement many UI modes.
- Risk: Visual regressions and mobile overflow become hard to prevent.
- Recommended fix: Introduce a small design token layer, component-level CSS organization, and screenshot tests for key views.
- Estimated effort: M
- Suggested owner: frontend
- Launch-blocking: No

### ARCH-005 - Browser E2E and WordPress QA are missing from automated checks

- Severity: P2
- Area: Architecture
- Finding: Smoke/unit tests are strong, but full browser and WordPress integration checks are not part of the required checks.
- Evidence from repo: `tests/*` passes; no Playwright/browser screenshot run or WordPress integration test was run by the repo commands.
- Risk: Public assistant rendering, iframe behavior, mobile layout, and WP template behavior can regress while unit tests pass.
- Recommended fix: Add Playwright tests for dashboard/public assistant/install and a manual WP QA checklist for each release.
- Estimated effort: M
- Suggested owner: frontend, ops
- Launch-blocking: No

### PERF-001 - Website import runs in request path

- Severity: P2
- Area: Performance
- Finding: Website crawl/import work appears synchronous in backend request flows.
- Evidence from repo: `src/services/scraping/websiteContentService.js` fetches and crawls pages with SSRF checks and page limits; routes invoke import behavior directly.
- Risk: Slow customer websites can tie up web workers and create poor onboarding latency.
- Recommended fix: Move import to a queue/background job with progress states, cancellation, retries, and crawl budget limits.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### PERF-002 - Dashboard and public assets need bundle budgets

- Severity: P2
- Area: Performance
- Finding: Public and dashboard scripts are large static files without an obvious bundling/code-splitting strategy.
- Evidence from repo: Large `frontend/dashboard.js`, `frontend/script.js`, `assistant-embed.js`; `src/app/createApp.js` serves them directly from `frontend`.
- Risk: Load time, parse time, and cache invalidation will degrade as features grow.
- Recommended fix: Define size budgets, minify/hash public assets, split dashboard pages, and keep embed script tiny.
- Estimated effort: L
- Suggested owner: frontend
- Launch-blocking: No

### PERF-003 - Analytics queries may undercount or slow down at growth

- Severity: P2
- Area: Performance
- Finding: Some analytics flows use capped message fetches and application aggregation.
- Evidence from repo: `src/services/analytics/*` and dashboard analytics routes read recent messages/events for summaries.
- Risk: Early dashboards may underreport once agents have larger histories, and queries can become expensive.
- Recommended fix: Add materialized daily summaries, pagination, and query/index review for messages, events, feedback, leads, and billing usage.
- Estimated effort: M
- Suggested owner: backend
- Launch-blocking: No

### PERF-004 - Service worker adds complexity without clear product value

- Severity: P3
- Area: Performance
- Finding: A service worker is present while dashboard assets are explicitly no-store.
- Evidence from repo: `service-worker.js` exists; `src/app/createApp.js` sets no-store headers for dashboard assets.
- Risk: Cache behavior can be confusing during launches, especially if the app is not intended as a PWA yet.
- Recommended fix: Keep the service worker minimal, document what it caches, or remove it until PWA behavior is intentional.
- Estimated effort: S
- Suggested owner: frontend
- Launch-blocking: No

### PERF-005 - Model/router optimization is later roadmap

- Severity: P4
- Area: Performance
- Finding: The current chat path uses a single model class for public assistant answers.
- Evidence from repo: `src/services/chat/chatService.js` uses OpenAI chat generation with `gpt-4o-mini`.
- Risk: Not a blocker, but cost and latency can improve with intent routing, answer caching, and cheap deterministic paths.
- Recommended fix: After launch hardening, add a router for FAQ/approved answer direct returns, low-cost extraction, and high-confidence cached answers.
- Estimated effort: L
- Suggested owner: backend, product
- Launch-blocking: No

### OPS-001 - Deploy config still says staging

- Severity: P0
- Area: Launch/ops
- Finding: Render deploy config uses production `NODE_ENV` but `VONZA_DEPLOY_ENV=staging`.
- Evidence from repo: `render.yaml` sets `NODE_ENV` to `production` and `VONZA_DEPLOY_ENV` to `staging`.
- Risk: Launch operations can confuse staging and production behavior, monitoring, secrets, analytics, and billing.
- Recommended fix: Create separate staging and production service configs or parameterized deploy environments. Production must explicitly say production and pass a deploy-readiness checklist.
- Estimated effort: S
- Suggested owner: ops
- Launch-blocking: Yes

### OPS-002 - Dependency audit has a moderate vulnerability

- Severity: P1
- Area: Launch/ops
- Finding: `npm audit --omit=dev --audit-level=moderate` fails.
- Evidence from repo: Audit reports a moderate `ws` advisory in the dependency tree.
- Risk: A public SaaS launch should not start with known moderate production dependency advisories.
- Recommended fix: Run dependency update/audit fix in a controlled branch, rerun smoke/schema/lint, and inspect lockfile changes.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: Yes

### OPS-003 - Monitoring and alerting are not launch-grade

- Severity: P1
- Area: Launch/ops
- Finding: The repo contains health/build endpoints and logging, but no complete monitoring, alerting, or incident workflow.
- Evidence from repo: `src/routes/publicRoutes.js` exposes `/health` and `/build`; `render.yaml` uses `/health`; no alerting/runbook config was found.
- Risk: The founder may not know when public chat is down, OpenAI spend spikes, Stripe webhooks fail, Supabase errors rise, or rate limiting is misconfigured.
- Recommended fix: Add error tracking, uptime checks, rate-limit alerts, OpenAI spend alerts, Stripe webhook failure alerts, Supabase error alerts, and a simple incident/rollback runbook.
- Estimated effort: M
- Suggested owner: ops
- Launch-blocking: Yes

### OPS-004 - Health endpoint is too shallow for readiness

- Severity: P2
- Area: Launch/ops
- Finding: `/health` confirms the app responds but does not prove dependencies are usable.
- Evidence from repo: `src/routes/publicRoutes.js` health/build routes expose status/build metadata; startup checks Supabase reachability separately.
- Risk: Render can consider the app healthy while Supabase, OpenAI, Stripe, or Redis are broken.
- Recommended fix: Keep `/health` shallow, but add a private `/ready` or setup-doctor style production-safe readiness check for dependencies and env completeness.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: No

### OPS-005 - Backup and recovery plan is missing

- Severity: P2
- Area: Launch/ops
- Finding: No database backup, restore, or incident recovery process was found in repo docs/config.
- Evidence from repo: Deploy/config docs and scripts focus on schema sync and readiness, not recovery.
- Risk: Data loss or bad migrations can become unrecoverable operational incidents.
- Recommended fix: Document Supabase backup settings, restore drill, migration rollback process, and owner/customer communication plan.
- Estimated effort: M
- Suggested owner: ops
- Launch-blocking: No

### OPS-006 - Package/app naming still carries old identity

- Severity: P2
- Area: Launch/ops
- Finding: Package metadata still uses an old product name.
- Evidence from repo: `package.json` name is `ai-shop-assistant`.
- Risk: Logs, deployment dashboards, dependency metadata, and future public artifacts can look inconsistent or unprofessional.
- Recommended fix: Rename package metadata and any old internal references in a controlled cleanup branch.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: No

### OPS-007 - Public build metadata should be intentional

- Severity: P3
- Area: Launch/ops
- Finding: `/build` publicly exposes build metadata.
- Evidence from repo: `src/routes/publicRoutes.js` returns version/build SHA/environment-style metadata.
- Risk: Usually acceptable, but it gives attackers versioning information and can confuse customers if exposed.
- Recommended fix: Keep only minimal public metadata or require admin auth for detailed build information.
- Estimated effort: S
- Suggested owner: backend, ops
- Launch-blocking: No

## Prioritized fix plan

### Immediate P0/P1 fixes

1. Finalize legal/privacy/cookie/terms pages with real operator details, retention, DSAR, processor/subprocessor language, contact details, and payment terms.
2. Split staging and production deploy config. Add Redis/Upstash, trusted proxy, Turnstile, production env, and fake-access flag checks to deploy readiness.
3. Replace broad pre-claim `client_id` authority with short-lived scoped setup tokens.
4. Add atomic OpenAI cost reservation and fail closed when budget cannot be reserved.
5. Scope public assistant framing to allowed domains or introduce explicit hosted-public versus embedded-private access models.
6. Fix the `ws` advisory and rerun required checks.
7. Add monitoring/alerts for app health, Redis/rate limit, OpenAI spend, Stripe webhooks, Supabase errors, and 5xx spikes.
8. Protect `TEMP_INSTANT_WORKSPACE_ACCESS` and fake billing with production boot/deploy failures.
9. Make approved answers semantically reliable and non-overridable by owner prompt text.
10. Add clear public assistant privacy notice and data-retention enforcement job.

### 1-week hardening sprint

1. Build a route inventory: auth mode, CORS mode, rate-limit mode, billing/access gate, owner/object checks.
2. Add service-layer owner filters for feedback, privacy export/delete, and any service accepting only `agent_id`.
3. Add route-specific rate limits for install CTA, product events, public analytics writes, and setup/import paths.
4. Remove public preview routes in production and remove public embed debug logs.
5. Add upload magic-byte validation and safer public storage handling.
6. Add RLS policy inventory checks to schema sync.
7. Add private readiness checks for Supabase, Stripe webhook config, OpenAI key presence, Redis, and env mode.
8. Add first Playwright screenshot checks for dashboard and public assistant mobile/desktop.

### 2-4 week product quality sprint

1. Simplify install IA around three defaults: hosted assistant, website widget, WordPress plugin.
2. Modularize `frontend/dashboard.js`, `frontend/script.js`, and `assistant-embed.js`.
3. Add SMB RAG evals and a dashboard answer-quality audit workflow.
4. Add stale website content warnings, scheduled recrawl, and import queue/progress.
5. Add owner-facing data export/delete/retention dashboard UX.
6. Harden WordPress private plugin release packaging and compatibility matrix.
7. Add materialized analytics summaries and pagination for growing customers.
8. Add outbound operator action confirmation, audit logging, and clearer draft/send labels.

### Later roadmap

1. Gutenberg block for WordPress.
2. Intent router and low-cost deterministic answer paths.
3. Advanced owner-configurable abuse controls.
4. Full admin console with role-based access instead of static admin token.
5. Stronger CSP with nonces/hashes and reduced inline code.

## Recommended next Codex prompts

1. "Implement production deploy-readiness hardening for Vonza: fail production boot/checks if Redis/Upstash rate limiting, trusted proxy config, legal env mode, fake billing flags, or TEMP_INSTANT_WORKSPACE_ACCESS are unsafe. Do not change product behavior beyond the checks. Run smoke, schema sync, lint, and git diff check."
2. "Refactor Vonza pre-claim onboarding security. Replace broad client_id authority with short-lived scoped setup tokens for create/list/update/import/install verify, keep existing onboarding UX working, and add tests for expired, wrong-scope, claimed-agent, and leaked-token cases."
3. "Add atomic OpenAI cost protection for public chat in Vonza. Reserve per-agent/per-session budget before model calls, fail closed when reservation cannot be made, finalize usage after response, and add tests for budget exhaustion and usage-recording failure."
4. "Make Vonza public assistant privacy/legal surfaces launch-ready in UI: add concise privacy notice and links in widget, hosted full-page assistant, QR/full-page mode, and WordPress template mode. Do not rewrite legal text beyond linking and surface copy."
5. "Build a Vonza RAG reliability test suite for SMB scenarios: prices, services, opening hours, policies, availability, unknown answers, approved-answer override, stale website content, and cross-agent leakage. Do not change production code unless needed for testability."
