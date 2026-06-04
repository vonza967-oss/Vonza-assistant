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
- `POST /quote-desk-hu/intake-assistant`
- `POST /quote-desk-hu/intake-requests`

Public QDH intake creation is server-mediated and requires an active public agent key plus a saved QDH setup for that agent owner. It does not grant anonymous database insert access and does not accept owner IDs, agent IDs, package metadata, policy metadata, or arbitrary public write scope. Public quote request creation from generic chat remains separately feature-flagged by `QUOTE_REQUESTS_FROM_CHAT_ENABLED`.

## Phase 9 Premium Interaction Cues

Phase 9 keeps the Phase 7/8 customer intake layout and adds a restrained interaction layer so visitors can feel the assistant organizing their request without turning the page into a flashy AI demo.

Customer page behavior:

- the main textarea has frontend-only live recognition cues for obvious request, location, timing, name, and email or phone details;
- typing recognition is deterministic, local to the browser draft, and does not call the model, submit data, persist data, or create requests;
- while an assistant turn is in flight, the chat shows a calm organizing state with `Átnézem a részleteket...`;
- newly extracted details briefly highlight in the progress strip and captured-details summary, with `prefers-reduced-motion` support;
- missing-detail follow-ups appear as focused assistant clarification cards;
- when required details are present, the ready state says `Az ajánlatkérés összeállt` and summarizes the request fields that will be forwarded;
- the success state is a completed handoff: `Köszönjük, továbbítottuk az ajánlatkérést.` and the business contacts the visitor through the provided contact details.

Safety and data behavior remain unchanged:

- still request-only and staff-confirmed pricing;
- no final quote calculation;
- no guaranteed pricing;
- no external send/provider call;
- no widget/embed behavior change;
- no schema or migration change.

## Phase 8 Shared Front Desk Conversation Layer

Phase 8 changes the QDH assistant from a standalone intake/extraction layer into a product layer on top of Vonza's shared AI Front Desk chat engine.

The shared Front Desk engine handles:

- business context from setup-derived content, stored website content, approved answers, business profile facts, RAG, evidence packs, and answer-contract/report-only checks where available;
- language handling, prompt compilation, package prompt blocks, factuality repair, and safe missing-information behavior;
- normal visitor questions about services, service area, timing, and business details when the answer is supported by available context.

The QDH layer handles:

- Hungarian quote-desk prompt instructions and product-specific fallback wording;
- quote intent versus business-question distinction;
- deterministic quote-readiness extraction and validation;
- bounded, sanitized conversation history so follow-up answers can complete missing fields;
- one-missing-detail follow-up behavior;
- explicit request-only acknowledgement before creating `agent_quote_requests`;
- safe customer DTOs for the custom intake UI.

Request creation remains deterministic and confirmation-gated:

- required fields are kért szolgáltatás, projekt részletei, város/helyszín, sürgősség, név, and email or phone;
- `source_channel = 'qdh_ai_intake'` remains request-only;
- no final quote, guaranteed price, exact quote calculation, external send, provider call, WhatsApp/email/CRM/proposal send, or accepted-quote state is created by QDH chat;
- public responses do not expose owner IDs, agent IDs, business IDs, package metadata, policy metadata, evidence internals, prompts, model metadata, or raw shared-engine internals.

## Phase 7 Business-Specific Intake Copy

Phase 7 polishes the customer-facing intake so the first-screen copy matches the business context instead of showing generic or mismatched examples.

The copy system is deterministic and layered:

- public setup context is the only input: business name, service type, service area, and services offered;
- a small broad-category map chooses Hungarian service groups such as takarítás, építés/felújítás/otthoni szolgáltatás, garázskapuk/kapuk, web/marketing/kreatív stúdió, egészség/klinika, szépség/wellness, javítás/szerviz, oktatás/tanácsadás, rendezvény/vendéglátás, or general services;
- each category supplies a natural textarea placeholder, opening assistant line, short "what helps us answer faster" hint, and optional wording for missing details;
- when no category matches, the generic fallback remains natural and safe;
- OpenAI can refine the conversation when configured, but the baseline UI copy and deterministic follow-up wording do not depend on OpenAI.

Phase 7 also tightens customer polish:

- the initial intake UI shows the exact-pricing safety line once;
- progress copy uses natural Hungarian such as `Elküldés előtt ellenőrzi`;
- assistant bubbles are labeled `Asszisztens`, not the business name speaking as a person;
- the manual editor remains available as a secondary connected disclosure under the main assistant surface.

Safety and data behavior remain unchanged:

- no final quote calculation;
- no guaranteed pricing;
- no automatic customer message send;
- no email, WhatsApp, CRM, proposal, booking, or provider call;
- no widget/embed behavior change;
- no schema or migration change.

## Phase 6 Business-Branded Intake Receptionist

Phase 6 rebuilds the customer-facing intake page as a business-branded AI receptionist surface for the website "Ajánlatkérés" destination.

Customer page behavior:

- the business identity leads the page: business name, service category, and city/service area;
- the first interaction is one calm assistant surface with a natural Hungarian request input;
- the old split hero/details-panel composition is removed so the page no longer reads like a QDH dashboard, admin screen, or compliance workflow;
- captured details are summarized through compact progress/details strips instead of a large missing-field or warning wall;
- the manual editor remains available behind `Részletek szerkesztése`, but it is secondary to the conversation;
- customer-visible source, channel, status, package, policy, and setup internals are not exposed in the public intake HTML/JS copy;
- success copy remains `Köszönjük, továbbítottuk az ajánlatkérést.` and explains the next step naturally.

Safety and data behavior remain unchanged:

- existing assistant endpoint behavior is preserved;
- existing manual request creation is preserved;
- existing `agent_key` context resolution is preserved;
- submitted requests still appear in the QDH dashboard for owner review;
- no final quote calculation;
- no guaranteed pricing;
- no automatic customer message send;
- no email, WhatsApp, CRM, proposal, booking, or provider call;
- no widget/embed behavior change;
- no schema or migration change.

## Phase 5 Customer AI Receptionist UX

Phase 5 corrects the customer-facing AI intake experience from system/admin language to business-branded receptionist language.

Customer page behavior:

- the public intake first screen leads with natural Hungarian quote-request copy, not QDH/internal taxonomy;
- the business name and service context are the primary visible context after the public intake link resolves;
- QDH/source/status labels are hidden from the customer surface;
- internal labels such as `Request-only`, `Staff review`, `AI-assisted Staff review`, `Hiányos`, `qdh_ai_intake`, package metadata, and policy metadata are not shown in the public intake HTML/JS copy;
- visitors can type a natural Hungarian request first, with no warning wall of missing fields before they start;
- captured details are shown as a calm progress panel;
- the manual details form is available behind `Részletek szerkesztése`;
- the final submit control appears only after required details are present;
- success copy says `Köszönjük, továbbítottuk az ajánlatkérést.` and explains that the business reviews the request and confirms exact pricing.

Assistant behavior:

- missing-info replies ask for one next detail at a time while the structured response still returns the full `missingFields` array for validation and owner review;
- exact/final/guaranteed price requests are refused in natural Hungarian;
- customer-facing assistant replies avoid internal system labels while still preserving backend safety flags and request-only storage.

Backend safety remains unchanged:

- no final quote calculation;
- no guaranteed pricing;
- no automatic customer message send;
- no email, WhatsApp, CRM, proposal, booking, or provider call;
- no widget/embed behavior change;
- no schema or migration change.

## Phase 4 AI Intake Assistant

Phase 4 makes the customer intake page AI-assisted while keeping QDH request-only and staff-review-only.

Customer page behavior:

- `/qdh/intake?agent_key=<public_agent_key>` and `/quote-desk-hu/intake?agent_key=<public_agent_key>` now open with a Hungarian conversational intake assistant;
- the assistant helps visitors describe the project naturally in Hungarian and extracts structured fields into a visible details panel;
- required fields are kért szolgáltatás, projekt részletei, város/helyszín, sürgősség, név, and email or phone;
- körülbelüli keret remains optional;
- the old structured form remains available as a manual details fallback;
- the confirm button is enabled only after required fields are present and the visitor acknowledges that the request is staff-review-only.

New AI endpoint:

- `POST /quote-desk-hu/intake-assistant`
- requires a valid public `agent_key`;
- resolves only the safe QDH public setup context;
- rate limited through `public_qdh_intake_assistant`;
- rejects unsupported public fields, unsafe nested keys, and secret-looking values before model analysis;
- returns only safe public fields: assistant reply, extracted fields, missing fields, readiness, safe public safety flags, and request status when created;
- does not return owner IDs, agent IDs, business IDs, setup metadata, evidence, package/policy metadata, prompts, raw model output, usage, or model metadata.

AI helper behavior:

- implemented in `src/services/quotes/quoteDeskHuIntakeAssistantService.js`;
- QDH-specific and separate from generic Front Desk prompt code;
- uses deterministic Hungarian extraction for service, project details, location, urgency, budget, name, email, and phone;
- may use the existing OpenAI client path when `OPENAI_API_KEY` is configured;
- expects JSON output from the model, validates the object, recalculates readiness server-side, and falls back to deterministic extraction if the model output is invalid or unavailable;
- never lets model output directly create a quote request;
- never calculates final prices, guarantees pricing, sends quotes, calls WhatsApp/email/CRM/provider integrations, or changes widget/embed behavior.

Quote request creation:

- AI-assisted requests are created only after explicit confirmation and request-only acknowledgement;
- source channel is `qdh_ai_intake`;
- display mode is `qdh_ai_intake`;
- initial status remains `request_received`;
- evidence uses `proof_source_type = 'request_only'`;
- safe staff summary and safe flags may be stored under `evidence.qdh_ai_intake` for owner review;
- metadata remains request-only and avoids final quote or guaranteed price claims.

Dashboard behavior:

- `/qdh/dashboard` labels `qdh_ai_intake` as "AI-assisted QDH intake";
- safe AI staff summaries are shown in the request details panel when present;
- owner actions remain review-only: needs info, needs staff review, declined, archived, and note save;
- no final quote, quote send, external send, or accepted-quote control is exposed.

Safety boundaries:

- Pricing questions receive intake guidance and staff-review wording, not a final price;
- guaranteed/exact/fixed-price attempts are refused safely;
- prompt injection attempts are ignored and do not expose prompts or internal metadata;
- secret-looking content is rejected at the public route boundary;
- emergency-like messages are not treated as normal quote requests;
- out-of-scope services can be captured only for staff review and are flagged for owner confirmation.

Environment/config:

- `OPENAI_API_KEY` enables the existing OpenAI client path for QDH assistant JSON analysis;
- `QDH_AI_INTAKE_MODEL` can override the default model for the QDH intake helper;
- if OpenAI is unavailable or returns invalid output, deterministic extraction remains available and safe;
- production should keep distributed rate limiting configured as described by the existing rate-limit readiness checks.

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
- QDH AI intake assistant requires valid public agent context and rejects unsafe/secret-looking public payloads.
- QDH AI intake assistant asks for missing required fields and creates only confirmed request-only records with `source_channel = 'qdh_ai_intake'`.
- QDH AI intake evals cover pricing boundary, prompt injection, secret-like input, missing location/contact, mixed Hungarian/English, urgent requests, and out-of-scope services.
- Widget/embed files remain untouched.
- No external provider calls are introduced.
- Quote Desk HU evals still pass with the answer contract.

## Deployment Notes

QDH Phase 2 adds setup-readiness storage:

- `supabase/migrations/20260604143000_qdh_owner_setups.sql`

Before production rollout, ensure the quote request migration is deployed and visible through the configured Supabase/PostgREST target:

- `supabase/migrations/20260604120000_agent_quote_requests.sql`

QDH Phase 4 and Phase 5 do not add a new migration. They depend on:

- an applied `agent_quote_requests` migration;
- an applied `qdh_owner_setups` migration;
- an active owner-scoped agent row with a non-empty `public_agent_key`;
- server-side Supabase service role availability for the mediated public create endpoint.
- `OPENAI_API_KEY` when model-assisted JSON analysis is desired; deterministic fallback remains safe without it.
- production-ready public rate limiting for `public_qdh_intake_assistant`.

The canonical schema is `db/schema.sql`; keep it aligned with both migrations.

Render still deploys from `main`; production-ready QDH changes must land on `main`.
