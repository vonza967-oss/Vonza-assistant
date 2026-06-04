# Quote Desk HU Product Plan

Plan date: 2026-06-04

Quote Desk HU (QDH) is a separate Vonza product experience for Hungarian businesses that want to replace static "Kérjen ajánlatot" website buttons with a structured quote-intake assistant and staff review workspace.

QDH reuses Vonza engine services where they fit, especially `public.agent_quote_requests`, authenticated owner scoping, safe quote request status rules, and Quote Desk HU evals. It is not a generic card inside the Vonza dashboard and it is not presented as AI Front Desk.

## Product Boundary

QDH owns its product shell, dashboard route, visual language, copy, and workflows.

Current owner routes:

- `/qdh/dashboard`
- `/quote-desk-hu/dashboard`

Current authenticated owner API routes:

- `GET /quote-desk-hu/requests`
- `POST /quote-desk-hu/requests/status`

The public/customer product route is intentionally not expanded in this phase. Public quote request creation remains available only through the existing feature-flagged chat path controlled by `QUOTE_REQUESTS_FROM_CHAT_ENABLED`.

## Phase 1 Scope

Phase 1 is request intake/review only.

Implemented:

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
- public create route outside the existing feature-flagged chat producer.

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

- QDH dashboard route renders a separate shell.
- QDH dashboard does not depend on the generic dashboard quote card.
- QDH API routes require auth and preserve owner scope.
- QDH uses Hungarian-first copy.
- QDH exposes no final quote or guaranteed pricing controls.
- Status updates go through the quote request service rules.
- Widget/embed files remain untouched.
- No external provider calls are introduced.
- Quote Desk HU evals still pass with the answer contract.

## Deployment Notes

No new migration is required for QDH Phase 1 because it reuses `public.agent_quote_requests`.

Before production rollout, ensure the quote request migration is deployed and visible through the configured Supabase/PostgREST target:

- `supabase/migrations/20260604120000_agent_quote_requests.sql`

Render still deploys from `main`; production-ready QDH changes must land on `main`.
