# Agent Package Delivery Summary

## Scope

This summary consolidates the package architecture work through Phase 2 PR H. It confirms the final state after the service-only Hotel Concierge persistence step, staff action request visibility, report-only package activation readiness checks, feature-flagged Hotel Concierge chat action request creation, and the PR H controlled smoke attempt.

## What Changed

- Packages: `front_desk_general` remains the default package. `hotel_concierge` is registered for internal code, tests, evals, and controlled service-level assignment.
- Prompt compiler: package role metadata, prompt blocks, risk rules, Front Desk vertical helpers, widget purpose helpers, and web-call style guidance compile into the existing prompt path without changing public response contracts.
- Resolver: package resolution defaults missing, blank, unknown, or malformed keys to `front_desk_general`; persisted agent package fields and eval overrides can resolve `hotel_concierge`.
- Schema: `agents.package_key` and `agents.package_version` are present. `package_key` defaults to `front_desk_general`; the DB check permits `front_desk_general` and `hotel_concierge`.
- Service assignment: `updateAgentPackageAssignment()` is the only internal service helper for persisted package changes. It validates package keys, defaults the version from the manifest, and scopes updates by both `id` and `owner_user_id`.
- Tools metadata: package tool declarations are metadata-only. The registry validates declarations and reports package/tool compatibility; it has no executable handlers or provider calls.
- Staff action requests: PR E adds authenticated owner dashboard/API visibility for existing `agent_action_requests` records and lets staff move requests through `new`, `accepted`, `done`, and `dismissed` with optional staff notes.
- Activation readiness: PR F adds `src/services/agents/agentPackageActivationReadinessService.js`, a report-only/service-only evaluator that returns machine-readable package readiness requirements and summary status.
- Chat action request creation: PR G adds `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED`, off by default. When explicitly enabled with `1`, `true`, `enabled`, or `on`, only resolved `hotel_concierge` agents can create supported staff-visible `agent_action_requests` from deterministic chat drafts. Created-request acknowledgements are deterministic and do not call OpenAI.
- Knowledge policy metadata: package policies are normalized to `report-only` and produce source-type support metadata only.
- Evals: Front Desk and Hotel Concierge package eval suites exist with Answer Contract and Claim Verifier metadata. Hotel dry-run passed in this review; Hotel live pass is documented in the Hotel Concierge baseline. Front Desk dry-run passed in this review.
- Staging smoke: after the DB constraint allowed `hotel_concierge`, the service-only smoke assigned one temporary owner-scoped agent through `updateAgentPackageAssignment()`, exercised public chat prompts, rolled the agent back to `front_desk_general`, deleted temporary rows, and verified cleanup.
- Phase 2 PR H smoke record: a controlled HTTP smoke was attempted with `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED=1` and a temporary owner-scoped Hotel Concierge agent. The configured Supabase target returned `PGRST205` for `public.agent_action_requests`, so no live action request row, staff queue retrieval, status update, safety prompt, or default-off row assertion could be marked passed on that target. Cleanup verified 0 remaining smoke-created agents, businesses, website content rows, widget configs, and messages; the temporary auth user was deleted.
- Docs: package contract, creation guide, eval requirements, activation readiness, Front Desk baseline, and Hotel Concierge baseline describe the current package boundaries.
- Booking Phase 1: `docs/architecture/booking-capability-contract.md` defines booking capability terms, proof requirements, and future request/status taxonomy as docs/tests only. It adds no booking engine, schema, runtime chat behavior, dashboard/admin UI, widget/embed behavior, package activation, provider integration, or enforcement.
- Booking Phase 2: `docs/architecture/booking-request-layer-plan.md` designs the generic booking request layer as the next safe booking capability. It is request-only and staff-reviewable, with proposed object fields, lifecycle/proof semantics, future chat behavior, future staff/dashboard behavior, and eval gates. It adds no schema, migrations, runtime chat behavior, dashboard/admin UI, widget/embed behavior, package activation, provider integration, policy enforcement, external booking/calendar/PMS mutation, or confirmed booking behavior.
- Booking Phase 3: `public.agent_booking_requests` and `src/services/bookings/agentBookingRequestService.js` add the generic booking request persistence/service foundation only. The table is owner scoped with authenticated owner-select RLS, idempotency dedupe, request lifecycle statuses, and proof-gated external confirmation/cancellation transitions. It adds no public chat booking request creation, dashboard/admin UI, widget/embed behavior, provider integration, package activation, live availability, or confirmed booking behavior from chat.
- Booking Phase 4: `GET /agents/booking-requests` and `POST /agents/booking-requests/status` expose the request layer to authenticated owners for owner-scoped review only. The API lists mapped request rows, supports agent/status/limit filters, and delegates status transitions and proof requirements to `updateAgentBookingRequestStatus()`. It adds no public create route, no public chat booking request creation, no dashboard UI, no widget/embed change, no external booking integration, no live availability, and no confirmed booking behavior from chat.
- Booking Phase 5: `frontend/dashboard.js` adds a compact authenticated "Booking requests" review surface for existing `agent_booking_requests`. The dashboard fetches `GET /agents/booking-requests`, shows requested service/time/contact/status/status reason/staff notes/created time, and posts safe review status updates to `POST /agents/booking-requests/status`. Casual controls expose only `needs_info`, `needs_staff_review`, `offered`, `declined`, and `expired`; proof-required `confirmed_externally` and `cancelled_externally` are not exposed as casual confirm/cancel buttons. It adds no schema or migration changes, no public chat booking request creation, no widget/embed change, no external booking integration, no live availability, no confirmed booking behavior from chat, no package selector, and no public package switching.
- Booking Phase 6: public chat can create generic `agent_booking_requests` only when `BOOKING_REQUESTS_FROM_CHAT_ENABLED` is explicitly enabled with `1`, `true`, `enabled`, or `on`. The flag is off by default. The path uses deterministic drafting, calls only `createAgentBookingRequest()`, returns deterministic safe acknowledgements without OpenAI, and exposes only safe public metadata such as `{ created, status }`. It adds no schema or migration changes, no dashboard UI changes, no widget/embed changes, no external booking/calendar/PMS/provider integration, no live availability, no slot holds, no confirmed booking behavior from chat, no cancellation mutation, and no reschedule mutation.
- Booking Phase 7: a controlled local/staging rerun was completed against the configured Supabase target `wjrgzvprxkkgbjppxphk.supabase.co` with `BOOKING_REQUESTS_FROM_CHAT_ENABLED=1` after `public.agent_booking_requests` was exposed through PostgREST. Service/internal insert, effective owner-select RLS behavior, feature-flagged chat creation, owner `GET /agents/booking-requests`, owner `POST /agents/booking-requests/status`, authenticated dashboard rendering, safety prompts, default-off behavior, and cleanup passed. The created booking request captured `a dental cleaning`, `Saturday at 10`, `Anna Kovacs`, request-only evidence, and public-chat metadata; the placeholder `anna@example.com` address was intentionally suppressed. The same target still does not expose unrelated `public.agent_action_requests`, so the dashboard action-request list route now degrades to an authenticated empty migration-required payload instead of producing a console error. Phase 7 added only scoped contract fixes for deterministic booking request creation and dashboard list filtering; it added no external booking integration, no live availability, no confirmed booking behavior from chat, and no chat cancellation/reschedule mutation.

## Current Safety Boundaries

- `front_desk_general` remains the production default.
- `hotel_concierge` is registered and persistable only through controlled internal/service assignment.
- No dashboard package selector exists.
- No admin UI package selector exists.
- No public, widget, embed, or anonymous package switching exists.
- No widget or embed changes were made for Hotel Concierge activation.
- Chat creates Hotel Concierge action requests only when `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED` is explicitly enabled and the resolved package is `hotel_concierge`.
- With the flag off, chat behavior remains unchanged and no chat-created action requests are produced.
- `front_desk_general` never creates Hotel Concierge action requests.
- Action requests remain staff-visible records only; they do not execute tools, call providers, notify external services, or complete real-world work.
- Chat acknowledgements may say a request was sent to staff only after creation succeeds. They must not say service was delivered, approved, completed, booked, changed, cancelled, or guaranteed.
- Activation readiness checks are not wired into public/runtime behavior.
- Tools are metadata-only and are not wired to runtime execution.
- Knowledge policy checks are report-only.
- Answer Contract and Claim Verifier remain report-only.
- No package enforcement, rewrite, blocking, routing mutation, provider action, or runtime tool execution was added.
- No dashboard/admin package selector, public package switching, or widget/embed package parameter behavior was added by PR G.
- No PMS, booking, checkout, rate, availability, payment, or guest-record mutation was added.
- Hotel live room availability is not implemented; `hotel.booking_availability` remains planned metadata only.
- Vonza currently supports booking routing, booking-intent lead capture, trusted external/operator outcome recording, staff follow-up, and feature-flagged request-only chat booking requests.
- Vonza does not currently support public live availability, slot holds, confirmed bookings, cancellation mutation, or reschedule mutation from chat.
- The safe booking foundation is the implemented request layer with staff review, not direct confirmed booking or provider-side mutation.
- The booking request lifecycle is `request_received`, `needs_info`, `needs_staff_review`, `offered`, `confirmed_externally`, `declined`, `cancel_requested`, `reschedule_requested`, `cancelled_externally`, and `expired`. Proof-backed states require trusted external/provider or verified operator evidence; leads, action requests, routing clicks, and conversion analytics are not booking records by themselves.
- Booking request review is authenticated-owner only through the API and the compact dashboard review surface. Public chat request creation is feature-flagged off by default and request-only when enabled. No widget/embed surface, live availability checker, calendar mutation, PMS/provider mutation, package selector, public package switching, or public confirmation behavior is active.
- Booking Phase 7 did not change those boundaries. The configured staging target now supports the feature-flagged `agent_booking_requests` flow end to end; the unrelated `agent_action_requests` surface remains marked migration-required on that target until its migration/schema cache is ready.

## Checks Last Run

Run date: 2026-06-02.

| Command | Result |
| --- | --- |
| Booking Phase 7 controlled local/staging smoke | Passed against `wjrgzvprxkkgbjppxphk.supabase.co` after `public.agent_booking_requests` migration/schema-cache exposure. PostgREST visibility, service insert/cleanup, effective owner-select RLS behavior, feature-flagged chat creation, owner review/status update, authenticated dashboard row rendering, safety prompts, default-off behavior, and cleanup counts passed. |
| `node --check src/services/chat/chatService.js` / `node --check src/services/bookings/bookingRequestDraftService.js` / `node --check src/services/bookings/agentBookingRequestService.js` / `node --check src/routes/agentRoutes.js` / `node --check frontend/dashboard.js` / `node --check frontend/script.js` / `node --check frontend/settings/SettingsShell.js` / `node --check assistant-embed.js` | Passed. |
| `node --test tests/agentBookingRequestService.test.js tests/agentBookingRequestRoutes.test.js tests/chatAgentPackageIntegration.test.js tests/bookingRequestLayerContract.test.js tests/agentActionRequestService.test.js` | Passed, 60/60 focused booking/action tests. |
| `node --test tests/operatorRoutes.test.js` | Passed, 28/28 route tests. |
| `npm run eval:front-desk:json -- --answer-contract` | Passed, 12/12 scenarios. Side-effect guards clean for forbidden writes, billing events, outbound messages, web-call sessions, and product events. |
| `npm run test:smoke` | Passed, 1084/1084 tests. |
| `npm run check:schema-sync` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

## Live Eval Variance Notes

- Hotel Concierge live validation is documented in `docs/evals/hotel-concierge-baseline.md` as passing 12/12 after scoped hotel package/eval wording fixes.
- Hotel Concierge staging smoke validated the service-only persisted assignment path without adding customer-facing package selection or runtime execution.
- Phase 2 PR H did not require code changes. The configured target needs the existing action-request schema deployed/exposed before the live action-request row and staff queue checks can be completed.
- Front Desk dry-run is stable at 12/12 in this review.
- Front Desk live evals can show safe wording variance, especially around missing-contact fallback wording, concise style thresholds, or equivalent grounded phrasing. Treat those as review items before changing runtime behavior.
- Report-only Answer Contract, Claim Verifier, and knowledge policy metadata can show unsupported policy signals even when the visitor-facing answer remains safe; these signals are for review, not enforcement.

## Recommended Next Steps

- Use `docs/architecture/product-runtime-engine-plan.md` as the Phase 2 architecture plan for evolving packages into product runtime declarations.
- If Hotel Concierge needs operational activation, add an optional admin-only route behind auth or a seed script rather than public/dashboard selection.
- Keep the dashboard selector hidden.
- Keep admin UI package selection unimplemented until it is explicitly scoped.
- Keep enforcement off.
- Review report-only policy metrics before any enforcement decision.
- Design runtime tool execution later as a separate scoped project with provider, permission, audit, rollback, and safety controls.
