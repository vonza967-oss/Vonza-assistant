# Enterprise Request Desk Product Plan

Plan date: 2026-06-05

Enterprise Request Desk is a separate product layer on top of the Vonza Engine. It is not Quote Desk HU, and it must not inherit QDH routes, naming, setup flow, dashboard, or `agent_quote_requests` persistence.

Target hierarchy:

- Vonza Engine
  - AI Front Desk
  - Quote Desk HU
  - Enterprise Request Desk / ESG Request Desk

## Phase 1 Scope

Phase 1 creates a qualified enterprise intake layer for ESG-style enquiries:

- public qualified intake behavior, represented in service/test/eval code only;
- service-lane classification;
- one qualifying follow-up question at a time;
- structured internal brief DTO for owner/staff review;
- ESG-style fixture context for tests/evals only.

No public route, dashboard selector, persistence table, schema migration, widget/embed change, external provider call, quote calculation, or operations cockpit is added in this phase.

## Phase 2 Demo / Pilot Surface

Phase 2 adds the first visible pilot surface for the same ESG-style enterprise intake:

- `/enterprise-request-desk/demo` and `/esg-request-desk/demo` render a static internal/demo intake page.
- `/enterprise-request-desk/demo/analyze` and `/esg-request-desk/demo/analyze` run a rate-limited, non-persistent demo analysis against the deterministic Enterprise Request Desk assistant/lane service.
- The page classifies broad Hungarian enterprise, security, FM, and compliance enquiries into lanes and shows missing fields, one qualifying question, and a structured internal brief preview.
- The API response intentionally returns only public-safe lane labels, missing-field labels, and brief fields. It does not expose owner IDs, agent IDs, package/policy metadata, prompts, model information, internal source labels, or secrets.

Phase 2 still does not register `enterprise_request_desk` in the runtime package registry, add a dashboard selector, create persistence, add a schema migration, activate customer self-serve onboarding, touch widget/embed behavior, call external providers, create tickets, generate compliance documents, or produce final pricing/quote guarantees.

The Phase 2 surface is a product demonstration of qualified intake plus structured handoff. Operations cockpit work remains deferred.

## Phase 3 Working Pilot Loop

Phase 3 adds the minimum controlled end-to-end pilot loop:

- public ESG-style intake page:
  - `/enterprise-request-desk/intake?agent_key=...`
  - `/esg-request-desk/intake?agent_key=...`
- public intake API:
  - `POST /enterprise-request-desk/intake-requests`
  - `POST /esg-request-desk/intake-requests`
- owner/staff review dashboard:
  - `/enterprise-request-desk/dashboard`
  - `/esg-request-desk/dashboard`
- owner-scoped review APIs:
  - `GET /enterprise-request-desk/requests`
  - `POST /enterprise-request-desk/requests/status`
  - ESG aliases under `/esg-request-desk/...`

The public intake requires a valid active `agent_key`. The server resolves the key to an owner-scoped agent, runs the Enterprise Request Desk classifier/assistant, sanitizes all public text, and persists a request-only row. The public response returns only safe request outcome fields: created/deduped state, lane label, missing fields, missing-field labels, and a boundary-safe message.

The owner dashboard is separate from QDH and from the generic `/dashboard`. It shows a queue, lane, structured brief, missing fields, contact need, review statuses, status reason, and staff notes. It does not include SLA clocks, QR reporting, vendor panels, provider actions, compliance document generation, final pricing, or quote guarantees.

Local-only browser QA fixtures are available outside production:

- `/enterprise-request-desk/intake-fixture`
- `/enterprise-request-desk/dashboard-fixture`
- `/esg-request-desk/intake-fixture`
- `/esg-request-desk/dashboard-fixture`

The fixture stores rows in browser local storage only. It is not a production bypass for auth, RLS, or server-side persistence.

## Phase 4 Product Shell, Auth, And Setup Flow

Phase 4 turns the working pilot loop into a standalone product journey:

- public product/acquisition pages:
  - `/enterprise-request-desk`
  - `/esg-request-desk`
- setup/auth pages:
  - `/enterprise-request-desk/setup`
  - `/esg-request-desk/setup`
- customer-facing intake links:
  - `/enterprise-request-desk/intake?agent_key=<public_agent_key>`
  - `/esg-request-desk/intake?agent_key=<public_agent_key>`
- staff dashboard pages:
  - `/enterprise-request-desk/dashboard`
  - `/esg-request-desk/dashboard`

The setup and dashboard surfaces use the existing Supabase browser auth pattern. They support password sign-in, sign-up where Supabase auth allows it, and magic-link sign-in. The UI makes session state explicit with “Bejelentkezve: <email>” and a sign-out button, so an existing Vonza session no longer feels like unexplained auto-login.

Dashboard access now follows the owner journey:

- not logged in: render the branded Enterprise Request Desk auth gate;
- logged in with no setup: render setup-required state and link to setup;
- logged in with setup complete: load the dashboard and show the customer intake link guidance;
- setup complete but no active public agent key: show the `/enterprise-request-desk/intake?agent_key=<public_agent_key>` requirement without exposing owner IDs.

Phase 4 setup APIs:

- `GET /enterprise-request-desk/setup-state`
- `GET /esg-request-desk/setup-state`
- `POST /enterprise-request-desk/setup`
- `POST /esg-request-desk/setup`

The setup DTO intentionally excludes internal owner IDs, agent IDs, business IDs, raw public keys outside the URL, evidence, policy metadata, prompts, service secrets, and provider credentials. Setup input rejects unsupported fields and secret-looking values.

## Phase 6 Conversational AI Intake

Phase 6 makes the public intake an AI-guided request desk instead of a static form-first surface:

- public assistant endpoints:
  - `POST /enterprise-request-desk/intake-assistant`
  - `POST /esg-request-desk/intake-assistant`
- customer-facing chat UI on the existing intake pages;
- compact recognized-detail progress chips;
- structured brief preview;
- secondary manual details editor;
- confirmation-only request creation into `enterprise_request_desk_requests`.

The assistant endpoint requires a valid active `agent_key`, accepts bounded conversation history plus current extracted fields, and returns only a safe DTO: assistant reply, lane key/label, extracted public fields, missing fields, missing-field labels, structured brief preview, next question, readiness/confirmation state, and a recorded-request acknowledgement when a request is created.

Request creation happens only when the deterministic Enterprise readiness layer has all required fields and the visitor explicitly confirms. The persisted row remains owner-scoped through the resolved public agent, stores a hashed source key rather than the raw public key, and uses the existing `enterprise_request_desk_requests` table. No schema or migration is added in Phase 6.

The service layer reuses Vonza/QDH engine patterns where safe:

- bounded public conversation history;
- deterministic extraction and fallback before any generated wording;
- service-question handling separate from request creation;
- safe public DTO shaping;
- prompt-injection, secret-looking input, and exact-price boundary handling;
- optional shared Front Desk turn injection remains available for service tests, while the production public endpoint does not add an external provider call.

The frontend keeps Enterprise Request Desk visual identity and does not expose customer-visible internal terms such as source labels, metadata, package/policy details, model details, or owner/agent identifiers. It does not create QDH quote requests and does not touch widget/embed behavior.

## Shared Engine vs Product Layer

Shared Vonza Engine patterns:

- Front Desk business-context grounding for supported service questions;
- package prompt-block shape and risk-rule metadata;
- deterministic safety boundaries for missing facts, exact pricing, prompt injection, and internal metadata;
- report-only eval and readiness style;
- QDH-style public assistant turn orchestration, bounded history, confirmation gate, and safe response shaping.

Enterprise-specific layer:

- `enterprise_request_desk` unregistered product/package metadata skeleton;
- ESG-style intake lane taxonomy;
- enterprise request field extraction for service need, location/site, timing/urgency, and contact route;
- structured owner/staff handoff brief;
- owner-scoped Phase 3 request persistence in `enterprise_request_desk_requests`;
- Phase 6 conversational readiness and confirmation layer for public intake;
- Enterprise eval scenarios and CLI command.

The adapter can accept an injected shared Front Desk turn for service questions, but default public intake behavior is deterministic and does not add external provider calls.

## ESG-Style First Pilot

Fixture context is limited to safe test/eval positioning:

- business name: ESG Holding Zrt.;
- service area: országos, Budapest központtal;
- service types: őrzés-védelem, portaszolgálat / objektumvédelem, facility management, biztonságtechnika, audit / compliance.

The fixture does not scrape ESG, use private data, claim customer references, claim certifications, or assert unverified proof. It exists only to exercise the first target use case.

## Lane Taxonomy

Phase 1 through Phase 3 lanes:

- `security_guarding`: őrzés-védelem, vagyonőr, élőerős guarding, járőr.
- `reception_object_protection`: portaszolgálat, objektumvédelem, recepciós/beléptetési security.
- `facility_management`: létesítményüzemeltetés, karbantartás, takarítás, FM support.
- `security_technology`: CCTV, kamera, beléptető, access control, riasztó, biztonságtechnika.
- `audit_compliance`: audit, compliance, szabályzat, kockázatértékelés, megfelelőség.
- `mixed_enterprise_request`: több lane-t érintő enterprise igény.
- `general_enquiry`: biztonságos fallback általános kérdésekre vagy hiányos megkeresésre.

Each lane defines Hungarian label, coverage notes, qualifying questions, safe required fields, and the handoff summary shape. The required brief fields are service need, location/site, timing/urgency, and contact route.

## Persistence

Phase 3 adds `public.enterprise_request_desk_requests` through:

- canonical schema: `db/schema.sql`;
- migration: `supabase/migrations/20260605120000_enterprise_request_desk_requests.sql`;
- catalog entry: `enterprise_request_desk_requests`;
- schema hint: `PERSISTENCE_SCHEMA_HINTS.enterprise_request_desk_requests`.

The table stores request-only intake fields:

- owner and routed agent scope: `owner_user_id`, `agent_id`, `business_id`;
- safe source fingerprint: `source_key_hash` rather than raw public key;
- lane, lane label, confidence;
- request text, site/object, location, service need, timing, urgency;
- contact name/email/phone;
- missing fields, structured brief, safe evidence, safe metadata;
- request-review status, staff notes, status reason, idempotency key, timestamps.

Allowed statuses are intentionally limited to:

- `request_received`
- `needs_info`
- `needs_staff_review`
- `routed`
- `declined`
- `archived`

There are no quote-sent, accepted, expired, cancellation, pricing, contract, or provider execution states.

RLS is enabled. Direct Supabase access grants authenticated owner select only. There is no anon select/write policy and no authenticated insert/update/delete policy; server-side service/internal code writes through the existing backend Supabase path.

Indexes:

- owner created queue;
- agent created queue;
- owner/status created queue;
- agent/status created queue;
- owner/lane created queue;
- owner/agent/idempotency unique dedupe.

Phase 4 adds `public.enterprise_request_desk_owner_setups` through:

- canonical schema: `db/schema.sql`;
- migration: `supabase/migrations/20260605153000_enterprise_request_desk_owner_setups.sql`;
- catalog entry: `enterprise_request_desk_owner_setups`;
- schema hint: `PERSISTENCE_SCHEMA_HINTS.enterprise_request_desk_owner_setups`;
- recovery SQL: `docs/sql/prod_recovery_full_current_main.sql`.

The setup table stores owner-scoped product readiness only:

- `owner_user_id`;
- `organization_name`;
- `website_url`;
- `service_area`;
- `service_lines`;
- `intake_positioning`;
- `routing_preference`;
- `owner_contact_email`;
- `setup_status`;
- `metadata`;
- timestamps.

RLS is enabled. Authenticated owners can manage only their own setup row where `auth.uid() = owner_user_id`. There is no anon access policy.

## Explicit Deferrals

Deferred out of Phase 3:

- operations cockpit;
- QR site reporting;
- SLA clocks, tickets, or operational lifecycle;
- vendor panels;
- compliance document generation;
- external integrations or provider calls;
- final quote calculation, exact pricing, or guaranteed pricing;
- QDH request creation or QDH dashboard integration;
- customer self-serve setup flow beyond active `agent_key` routing.

Deferred out of Phase 4:

- full operations cockpit;
- QR reporting;
- SLA clocks and operational lifecycle;
- vendor panels;
- compliance or audit document generation;
- external provider calls;
- final quote/pricing guarantees;
- QDH merge or QDH setup reuse;
- website widget, embed, or chat behavior changes.

Deferred out of Phase 6:

- full operations cockpit;
- QR reporting;
- SLA clocks, tickets, and operational lifecycle;
- vendor panels;
- compliance or audit document generation;
- external provider calls;
- final quote/pricing guarantees;
- QDH merge or QDH setup reuse;
- website widget, embed, or chat behavior changes.

## Activation Boundary

`src/agentPackages/enterprise_request_desk/manifest.js` is intentionally not imported by `src/agentPackages/index.js`.

This means:

- `enterprise_request_desk` is not a known runtime package key;
- persisted `agents.package_key` is unchanged;
- no dashboard package selector is added;
- no public package switching is added;
- no widget/embed behavior changes;
- Phase 3 persistence exists only for the separate request loop.

Future broader activation requires a separate scoped PR covering onboarding/setup decisions, entitlement, dashboard selector behavior, operational lifecycle design, eval gates, RLS/owner scoping, and deployment checks.

## Migration / Deploy Notes

Deploy the migrations before pitching the product shell:

1. Apply `supabase/migrations/20260605120000_enterprise_request_desk_requests.sql`.
2. Apply `supabase/migrations/20260605153000_enterprise_request_desk_owner_setups.sql`.
3. Verify the PostgREST schema cache sees both `enterprise_request_desk_requests` and `enterprise_request_desk_owner_setups`.
4. Deploy `main` so Render serves the new route and frontend assets.
5. Owners start at `/enterprise-request-desk/setup` or `/esg-request-desk/setup`.
6. Use an active agent with `public_agent_key`, `access_status = 'active'`, and `is_active = true`.
7. Share `/enterprise-request-desk/intake?agent_key=<public_agent_key>` or `/esg-request-desk/intake?agent_key=<public_agent_key>` for intake after setup.
8. Owners process rows at `/enterprise-request-desk/dashboard` or `/esg-request-desk/dashboard` after signing in.

Phase 6 has no migration step. Deploying `main` is enough after the Phase 3/4 tables already exist.

First-client readiness after Phase 4:

- ready for controlled first-client setup and intake review pilot;
- not ready for final pricing, provider execution, QR/SLA reporting, vendor workflows, or compliance generation;
- requires a deployed migration, active public agent key, Supabase auth configuration, and owner setup row.

## Verification Surface

Focused checks:

- `node --test tests/enterpriseRequestDeskProduct.test.js`
- `node --test tests/enterpriseRequestDeskRequestService.test.js`
- `node --test tests/enterpriseRequestDeskRoutes.test.js`
- `node --test tests/enterpriseRequestDeskSetupService.test.js`
- `npm run eval:enterprise-request-desk:json`

Broader regression checks still include QDH, Front Desk, smoke, schema sync, lint, and diff checks before commit.
