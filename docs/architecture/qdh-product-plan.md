# Quote Desk HU Product Plan

Plan date: 2026-06-04

Quote Desk HU (QDH) is a separate Vonza product experience for Hungarian businesses that want to replace static "Kérjen ajánlatot" website buttons with a structured quote-intake assistant and staff review workspace.

QDH reuses Vonza engine services where they fit, especially `public.agent_quote_requests`, authenticated owner scoping, safe quote request status rules, and Quote Desk HU evals. It is not a generic card inside the Vonza dashboard and it is not presented as AI Front Desk.

## Product Boundary

QDH owns its product shell, dashboard route, visual language, copy, and workflows.

Current owner routes:

- `/qdh`
- `/quote-desk-hu`
- `/qdh/setup`
- `/quote-desk-hu/setup`
- `/qdh/dashboard`
- `/quote-desk-hu/dashboard`

Current customer-facing intake routes:

- `/qdh/intake?agent_key=<public_agent_key>`
- `/quote-desk-hu/intake?agent_key=<public_agent_key>`

Current authenticated owner API routes:

- `GET /quote-desk-hu/setup-state`
- `POST /quote-desk-hu/setup`
- `GET /quote-desk-hu/requests`
- `POST /quote-desk-hu/requests/status`

Current public customer-intake API routes:

- `GET /quote-desk-hu/intake-context?agent_key=<public_agent_key>`
- `POST /quote-desk-hu/intake-requests`

Public QDH intake creation is server-mediated and requires an active public agent key plus a saved QDH setup for that agent owner. It does not grant anonymous database insert access and does not accept owner IDs, agent IDs, package metadata, policy metadata, or arbitrary public write scope. Public quote request creation from generic chat remains separately feature-flagged by `QUOTE_REQUESTS_FROM_CHAT_ENABLED`.

## Phase 3 Customer Intake

Phase 3 adds the customer-facing quote intake surface that a Hungarian business can place behind its website's "Kérjen ajánlatot" button.

Customer page behavior:

- loads at `/qdh/intake?agent_key=<public_agent_key>` and `/quote-desk-hu/intake?agent_key=<public_agent_key>`;
- validates the public key through `GET /quote-desk-hu/intake-context`;
- shows only safe public business context: business name, service type, service area, and services offered;
- collects requested service, project details, city/location, urgency, optional approximate budget, customer name, customer email or phone, and request-only acknowledgement;
- posts to `POST /quote-desk-hu/intake-requests`;
- creates `public.agent_quote_requests` through `createAgentQuoteRequest`;
- stores `source_channel = 'qdh_public_intake'`, `display_mode = 'qdh_public_intake'`, status `request_received`, request-only evidence, and request-only metadata;
- returns only safe public response fields: product, phase, request status, source channel, and staff-review acknowledgement.

Customer page non-goals:

- no final quote calculation;
- no guaranteed price;
- no automatic quote send;
- no email, WhatsApp, CRM, proposal, booking, or provider call;
- no owner ID, agent ID, business ID, setup metadata, policy metadata, package key, evidence, or raw internal response leak;
- no widget/embed/public assistant behavior change.

Owner link workflow:

- The authenticated setup/dashboard API returns `customerIntake` when setup exists.
- `customerIntake.path` is the primary link: `/qdh/intake?agent_key=<public_agent_key>`.
- `customerIntake.aliasPath` is the alias: `/quote-desk-hu/intake?agent_key=<public_agent_key>`.
- The owner dashboard and setup page show this link only when an active owner-scoped agent has an intentionally public `public_agent_key`.
- If no active public agent key exists, the owner sees the required pattern and a prerequisite note instead of a working customer link.
- The owner places the full URL behind the website's "Kérjen ajánlatot" button.

Requests submitted through this route appear in `/qdh/dashboard` because the dashboard already lists owner-scoped `agent_quote_requests` filtered to QDH-visible request/review statuses. The source channel is visible as `qdh_public_intake` / "QDH ügyfél link".

## Phase 2 Self-Serve Access

Phase 2 adds the missing acquisition, access, and onboarding layer while keeping QDH separate from the generic Vonza dashboard.

Self-serve now:

- `/qdh` and `/quote-desk-hu` serve a Hungarian-first QDH acquisition page.
- `/qdh/setup` and `/quote-desk-hu/setup` serve a QDH-branded auth/setup page.
- The setup page uses the existing Supabase browser auth configuration and supports email/password sign-in, email/password signup, and magic link.
- Authenticated setup saves an owner-scoped `public.qdh_owner_setups` row through `POST /quote-desk-hu/setup`.
- The QDH dashboard reads `GET /quote-desk-hu/setup-state` and clearly shows setup complete, setup incomplete, setup load failure, or missing migration states.
- Successful setup routes the owner to `/qdh/dashboard`.

The setup record collects:

- business name;
- website URL;
- service type;
- service area / city;
- quote request handling preference;
- owner contact email;
- basic services offered.

The setup record is intentionally a QDH setup-readiness record, not a final business/agent activation. It does not create final quotes, send customer messages, call external providers, or calculate prices.

## Phase 1 Scope

Phase 1 is request intake/review only.

Implemented:

- standalone public QDH acquisition page;
- QDH-specific auth/setup route;
- owner-scoped QDH setup-readiness persistence;
- standalone Hungarian-first QDH dashboard shell;
- overview counts from real returned quote request rows;
- pipeline columns for `Új`, `Hiányzó adat`, `Ellenőrzés alatt`, and `Elutasítva / Archivált`;
- request detail panel for service, project, location, urgency, budget text, customer contact, language, source channel, created time, status reason, and staff notes;
- staff workflow for safe review statuses only;
- setup/readiness checklist for Hungarian business configuration;
- product safety copy explaining request-only behavior.

Not implemented:

- final quote calculation;
- guaranteed pricing;
- automatic customer messaging;
- external provider calls;
- WhatsApp, Google, booking, CRM, or proposal-system expansion;
- package activation enforcement;
- widget/embed changes;
- automatic assistant deployment from setup.
- automatic business/agent creation from QDH setup.

## Manual Steps That Remain

The QDH setup flow prepares owner readiness only. These still require manual deploy/config or a future controlled activation flow:

- applying `supabase/migrations/20260604143000_qdh_owner_setups.sql`;
- ensuring `supabase/migrations/20260604120000_agent_quote_requests.sql` is applied and PostgREST schema cache is reloaded;
- ensuring the owner has an active agent with an intentionally public `public_agent_key`;
- copying `/qdh/intake?agent_key=<public_agent_key>` or `/quote-desk-hu/intake?agent_key=<public_agent_key>` into the business website button;
- enabling `QUOTE_REQUESTS_FROM_CHAT_ENABLED` only where the quote request producer is intentionally activated;
- package/product entitlement decisions;
- any external email, WhatsApp, CRM, proposal, or provider integration.

## Engine Reuse

QDH delegates storage and status transitions to `src/services/quotes/agentQuoteRequestService.js`.

The service remains the authority for:

- owner scope;
- agent filter access checks;
- request field normalization;
- allowed lifecycle transitions;
- rejecting final quote or guaranteed price claims in metadata;
- requiring trusted proof for proof-backed final outcomes.

The QDH API wraps that service with product-specific routes. It can display newly received requests plus request-review states:

- `request_received`
- `needs_info`
- `needs_staff_review`
- `declined`
- `archived`

It allows staff status actions only for request-review statuses:

- `needs_info`
- `needs_staff_review`
- `declined`
- `archived`

Proof-backed final states such as `quoted_externally` and `accepted_externally` remain service-supported for trusted future flows, but QDH Phase 1 does not expose them as casual dashboard actions.

## Dashboard Principles

- Hungarian-first operational copy.
- Dense but readable staff workflow.
- QDH brand and navigation stay separate from `/dashboard`.
- Metrics must come from returned records or show an explicit unavailable state such as `Nincs adat`.
- No marketing hero, generic AI branding, decorative orb layout, or nested dashboard card treatment.
- Buttons must be review actions only: needs info, reviewing, declined, archived, and note save.
- Safety copy must state that QDH collects quote requests and the business confirms final prices.

## Verification Gates

Required focused checks for QDH Phase 1:

- QDH public acquisition route serves the correct product page.
- QDH setup routes are separate from generic `/dashboard`.
- Unauthenticated setup/dashboard access shows auth gate or returns auth-required safely.
- Authenticated setup APIs preserve owner scope.
- QDH dashboard route renders a separate shell.
- QDH dashboard does not depend on the generic dashboard quote card.
- QDH API routes require auth and preserve owner scope.
- QDH uses Hungarian-first copy.
- QDH exposes no final quote or guaranteed pricing controls.
- Status updates go through the quote request service rules.
- Public customer intake route serves QDH-specific UI.
- Public customer intake create rejects missing/invalid `agent_key`.
- Public customer intake create validates required request fields.
- Public customer intake create writes request-only `agent_quote_requests` with `source_channel = 'qdh_public_intake'`.
- Public customer intake responses do not expose owner IDs, agent IDs, setup metadata, policy metadata, package keys, evidence, or secrets.
- Widget/embed files remain untouched.
- No external provider calls are introduced.
- Quote Desk HU evals still pass with the answer contract.

## Deployment Notes

QDH Phase 2 adds setup-readiness storage:

- `supabase/migrations/20260604143000_qdh_owner_setups.sql`

Before production rollout, ensure the quote request migration is deployed and visible through the configured Supabase/PostgREST target:

- `supabase/migrations/20260604120000_agent_quote_requests.sql`

QDH Phase 3 does not add a new migration. It depends on:

- an applied `agent_quote_requests` migration;
- an applied `qdh_owner_setups` migration;
- an active owner-scoped agent row with a non-empty `public_agent_key`;
- server-side Supabase service role availability for the mediated public create endpoint.

The canonical schema is `db/schema.sql`; keep it aligned with both migrations.

Render still deploys from `main`; production-ready QDH changes must land on `main`.
