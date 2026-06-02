# Product Runtime Engine Plan

## Purpose

Phase 2 evolves Vonza from prompt and eval agent packages into real product packages. A package should eventually be able to declare its own customer surfaces, settings schema, data requirements, allowed actions and tools, staff workflows, eval gates, and activation requirements without rewriting core chat for each new product.

This plan started as docs-only in PR A. Later Phase 2 PRs add only the specifically scoped pieces listed below; any runtime code, schema, dashboard/API surface, chat behavior, widget/embed behavior, tool execution, or policy enforcement remains out of scope until its own PR explicitly introduces it.

The first concrete target product is `hotel_concierge`, but the engine concepts must remain package-neutral enough for a later package such as `flight_attendant`.

## Current Boundary

The current package manifest contract is v1 and intentionally limited:

- `supportedSurfaces` is descriptive only. It tells docs, tests, and diagnostics where a package is intended to appear, but it does not activate, route, render, or expose a surface.
- `tools` are metadata-only declarations. They are validated against the registry, but they are not callable handlers, provider integrations, permission grants, or runtime execution paths.
- `knowledgePolicy` is report-only. It can describe source expectations and produce metadata, but it does not block, rewrite, hide, or mutate visitor-facing answers.
- Activation readiness now has a report-only service in `src/services/agents/agentPackageActivationReadinessService.js`. It returns machine-readable package readiness results, but it is not wired into activation enforcement and does not prevent runtime traffic by itself.
- Phase 2 PR G adds one controlled runtime behavior: when `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED` is explicitly enabled, a resolved `hotel_concierge` chat turn may create a staff-visible `agent_action_requests` record for supported guest service messages. The flag is off by default. This path does not execute providers or tools and does not apply policy enforcement.
- Phase 2 PR H is verification/docs-only. A controlled HTTP smoke was attempted with `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED=1`, a temporary owner-scoped `hotel_concierge` agent, and the water-to-room request prompt. The configured Supabase target blocked the action-request insert because `public.agent_action_requests` was not available in the PostgREST schema cache (`PGRST205`). The temporary auth user, business, agent, widget config cascade, website content, and messages were cleaned up to 0 remaining rows. No runtime code, schema, migration, route, selector, widget/embed, external execution, policy enforcement, or public package switching change was needed or made for PR H.
- Booking Phase 1 is spec/test-only. `docs/architecture/booking-capability-contract.md` defines booking capability terms and future status taxonomy without adding schema, runtime chat behavior, dashboard/admin UI, widget/embed behavior, package activation, provider integrations, or enforcement.
- Booking Phase 2 is docs/tests-only. `docs/architecture/booking-request-layer-plan.md` designs the generic booking request layer as request-only staff review, with proposed fields, lifecycle/proof rules, chat behavior, staff/dashboard behavior, and eval gates. Later Booking Phases 3-7 added the request-only table/service, authenticated owner review API, dashboard review surface, feature-flagged public chat request creation, and staging smoke record. They add no widget/embed behavior, package activation, provider integration, policy enforcement, live availability, or confirmed booking behavior from chat.

Phase 2 should preserve those safety boundaries until each new capability is explicitly implemented, tested, and activated behind scoped controls.

## Booking Capability Boundary

Vonza currently supports booking routing, booking-intent lead capture, trusted external/operator outcome recording, staff follow-up, and feature-flagged request-only chat booking requests. It does not currently support public live availability, slot holds, confirmed bookings, cancellation mutation, or reschedule mutation from chat.

Package actions and tools must keep that boundary intact. `booking_route` can send a visitor to a configured external URL. `booking_intent` can trigger lead capture or staff follow-up. `booking_request` is an implemented request/review layer, not a confirmation. `booking_confirmed` is a trusted outcome label only when backed by an external/provider or owner/operator proof source.

The safe booking foundation is the implemented booking request layer with request-only semantics and staff review. Direct confirmed booking, availability lookup, holds, cancellation, and reschedule mutations require a separate scoped provider/proof/audit design.

The implemented request layer must stay separate from the generic action request layer. It may link to leads, package action requests, conversion outcomes, Calendly webhook outcomes, and operator Google Calendar outcomes, but none of those existing records become canonical booking records. The request lifecycle is `request_received`, `needs_info`, `needs_staff_review`, `offered`, `confirmed_externally`, `declined`, `cancel_requested`, `reschedule_requested`, `cancelled_externally`, and `expired`; proof-backed states require trusted external/provider or verified operator evidence before any customer-visible confirmation wording.

## Product Package Contract v2

The v2 contract should separate product declaration from runtime implementation. A package manifest should describe what the product needs and allows; the product runtime engine should be responsible for interpreting those declarations later.

Proposed future manifest sections:

```js
{
  key: "hotel_concierge",
  version: "2.0.0",
  label: "Hotel Concierge",

  surfaces: [],
  settingsSchema: {},
  dataRequirements: [],
  allowedActions: [],
  allowedTools: [],
  staffWorkflows: [],
  evalGates: [],
  activationRequirements: []
}
```

### `surfaces`

Declares package-owned customer and staff surfaces. Examples:

- `guest_chat`
- `in_room_qr`
- `full_page`
- `staff_queue`
- `crew_dashboard`

This should eventually replace the descriptive-only `supportedSurfaces` field with an engine-readable surface declaration. A surface declaration should not automatically expose a public route; activation still needs routing, auth, install, and gate checks.

### `settingsSchema`

Declares package settings that a future admin/dashboard UI can validate and edit. Examples:

- Hotel breakfast hours.
- Pet policy display rules.
- Late checkout request policy.
- Staff escalation destination.
- Emergency handling copy and routing.

The schema should describe types, labels, defaults, validation rules, and which settings are required before activation. It should not store secrets directly in the manifest.

### `dataRequirements`

Declares the minimum package knowledge required for safe answers. Examples:

- Hotel house rules.
- Breakfast, amenity, parking, pet, checkout, and cleaning policies.
- Maintenance contact or escalation process.
- Food service menu or availability policy.

Data requirements should distinguish required, recommended, and optional data. They should also define accepted source types, freshness expectations, and whether missing data should block activation or only warn.

### `allowedActions`

Phase 2 PR C introduces this as package manifest `actions` declarations backed by `src/services/actions/actionRequestRegistry.js`. These are action-request declarations only: they describe staff-visible request types a package is allowed to create in later scoped work. They are not executable tools, do not call providers, do not create request records by themselves, and do not wire anything into chat, dashboard, widget, embed, routes, or policy enforcement.

Declares action request types the package may create. Examples:

- `hotel.bring_water`
- `hotel.extra_towels`
- `hotel.food_request`
- `hotel.room_cleaning`
- `hotel.maintenance`
- `hotel.staff_help`
- `hotel.late_checkout_request`

Allowed actions are not external tool executions. In the MVP, they create staff-visible requests only. Each action should define payload metadata, required visitor/session context, staff visibility expectations, lifecycle states, and audit fields.

### `allowedTools`

Declares package-compatible provider or internal tools for a later execution layer. Examples:

- PMS availability lookup.
- PMS booking record lookup.
- Staff notification provider.
- Work order provider.
- Food ordering provider.

Allowed tools must remain separate from allowed actions. A package may allow an action request without allowing live provider execution. No tool should execute unless an integration is explicitly configured and activation gates allow it.

### `staffWorkflows`

Declares the staff workflow required to handle package actions. Examples:

- Staff queue for guest requests.
- Accept/done/dismiss lifecycle.
- Staff escalation path for emergency or safety requests.
- Internal note requirements.
- Owner/agent scoping requirements.

Any package that enables guest-created real-world requests must have a staff-visible workflow before public activation.

### `evalGates`

Declares eval suites required before activation. Examples:

- Product baseline eval.
- Safety boundary eval.
- Action request creation eval.
- Missing-data eval.
- Multilingual eval when the package is public in multilingual contexts.

Eval gates should be package-specific and should run before activation. They should prove that the package does not invent live availability, rates, policy changes, operational facts, or provider-side mutations.

### `activationRequirements`

Declares package-specific gates required before a package can be exposed beyond controlled internal assignment. Examples:

- Required package data exists.
- Eval suite exists and passes.
- Action request types are registered.
- Staff workflow is enabled when actions are enabled.
- Integrations are explicitly configured before live provider actions.
- Public package switching is disabled unless intentionally designed.
- Report-only policy has been reviewed before any enforcement mode is enabled.

Phase 2 PR F adds a service-only readiness evaluator for these requirements. It checks package registration, action declaration validity, action request registry confirmation, staff workflow flags, required hotel data, eval results, exposure flags, integration execution flags, and report-only policy mode. The evaluator returns plain objects for review and automation, but it does not enforce activation, mutate answers, create requests, expose package selection, or wire public/runtime behavior.

Activation requirements may become engine-enforced later, but enforcement requires a separate scoped PR.

## Generic Action Request Layer

Phase 2 needs a package-neutral action request concept so product packages can request staff-visible work without embedding product logic inside core chat.

Proposed future action request fields:

- `owner_user_id`: owner scope.
- `agent_id`: agent scope.
- `package_key`: package that created the request, such as `hotel_concierge`.
- `request_type`: stable type key, such as `hotel.bring_water`.
- `visitor_context`: guest/passenger/session identifiers available to the assistant.
- `session_context`: chat/session/page/mode metadata needed for traceability.
- `payload`: structured request metadata, such as room number, requested item, quantity, notes, preferred time, or urgency.
- `status`: `new`, `accepted`, `done`, or `dismissed`.
- `created_at`, `accepted_at`, `done_at`, `dismissed_at`, `updated_at`: audit timestamps.
- `created_by`: assistant, staff, or system source.
- `handled_by`: staff user or integration identity when applicable.

MVP constraints:

- Owner and agent scoping is required.
- No external provider/tool execution is included.
- Action registry metadata does not expose handlers, callables, provider clients, or integration execution.
- Package `actions` declarations must stay separate from package `tools`; tools remain provider/tool metadata and action requests remain staff-work metadata.
- Requests are staff-visible before any real-world action happens.
- The assistant should not claim that a real-world action was completed. It may say that a request was sent to staff only after a request record exists.
- The lifecycle is intentionally small: `new`, `accepted`, `done`, `dismissed`.
- Provider integrations, notifications, retries, SLAs, and webhooks belong in later scoped work.

Phase 2 PR G is the first scoped chat producer for this layer. It is limited to resolved `hotel_concierge` agents, requires `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED` to be set to `1`, `true`, `enabled`, or `on`, and creates only staff-visible action requests such as water, towels, housekeeping, maintenance, room service review, staff help, or late checkout review. `front_desk_general` remains unchanged and must not create Hotel Concierge action requests, even when the flag is enabled.

PR G explicitly does not approve, complete, book, change, cancel, or guarantee real-world service. It does not mutate PMS, booking, checkout, rate, availability, payment, or guest-record data. Emergency/safety language and booking, reservation, payment, or guest-record mutation requests stay out of normal action request creation and continue through safe hotel chat handling.

Phase 2 PR H did not add product surface area. Its live smoke attempt confirmed the deployed/configured Supabase target must have the existing `agent_action_requests` schema available before the end-to-end action-request path can be marked passed. The attempt used only existing service assignment and existing `/chat` plus owner-scoped staff queue routes; it left the feature off by default and left no smoke-created records behind.

## Hotel Concierge MVP Target

`hotel_concierge` should become a product package for guest-facing hotel support. The primary surface is an in-room QR or guest chat experience. The assistant should answer grounded questions and create staff-visible requests when guests need real-world help.

Intended customer surface:

- In-room QR or guest chat surface.
- Optional full-page guest concierge surface.
- Staff queue for hotel team follow-up.

Expected guest questions:

- Hotel rules.
- Breakfast.
- Amenities.
- Pets.
- Parking.
- Checkout.
- Cleaning.
- Maintenance.
- Front desk or staff help.

Expected action requests:

- Bring water.
- Extra towels.
- Food request.
- Room cleaning.
- Maintenance.
- Staff help.
- Late checkout request.

Late checkout should create a staff request unless a PMS integration exists and is explicitly configured. Cancellation, booking-record changes, payment changes, room changes, and guest-record access require staff or PMS integration and must not be invented by the assistant.

Safety boundaries:

- Do not invent live room availability.
- Do not invent rates, fees, checkout changes, or booking changes.
- Do not claim access to guest records without an integration.
- Do not promise that a staff task has been completed before staff completes it.
- Route emergencies to front desk, staff, local emergency services, or the property's documented emergency process.
- Treat medical, fire, violence, gas leak, flooding, lockout, and active safety issues as escalation cases, not routine concierge tasks.

## Flight Attendant Example

The same contract should support a future `flight_attendant` package without hotel-specific assumptions.

Possible package declarations:

- `surfaces`: passenger QR/chat surface, seatback or cabin chat, crew dashboard workflow.
- `dataRequirements`: airline safety rules, cabin policy, meal options, allergy policy, service timing, baggage policy, accessibility guidance.
- `allowedActions`: `flight.water`, `flight.blanket`, `flight.call_attendant`, `flight.meal_request`, `flight.cleaning_request`.
- `staffWorkflows`: crew queue grouped by flight, cabin, seat, priority, and service status.
- `evalGates`: safety and operational claim evals, passenger request evals, missing-data evals, emergency escalation evals.
- `activationRequirements`: flight/crew scoping, required policy data, action registry, crew-visible workflow, and integration gates before live operational provider actions.

Safety boundaries:

- Do not invent operational facts such as delays, turbulence, gate changes, aircraft status, or safety instructions.
- Do not override crew instructions.
- Escalate medical emergencies, security concerns, smoke/fire, severe allergic reactions, or safety-critical events to crew and emergency procedures.
- Do not claim a meal, blanket, medical item, or operational change is available unless grounded in package data or staff/provider confirmation.

## Activation Gates

Future activation gates should be explicit, auditable, and package-scoped.

Gate categories:

- Required package data present: required data requirements are satisfied with accepted source types and freshness where applicable.
- Eval suite exists and passes: package-specific evals prove grounded answers, missing-data behavior, action boundaries, and safety escalations.
- Action request types registered: every `allowedActions` key maps to a known request type with payload validation and lifecycle rules.
- Staff workflow enabled when actions are enabled: public guest/passenger actions cannot activate without a staff-visible queue or equivalent internal workflow.
- Integrations explicitly configured before live provider actions: external PMS, crew systems, notification, food service, maintenance, or booking tools cannot run from declarations alone.
- No public package switching unless intentionally designed: public traffic must not select arbitrary package keys.
- Report-only policy reviewed before enforcement: Answer Contract, Claim Verifier, knowledge policy, action policy, or tool policy enforcement requires review of report-only signals and a separate scoped PR.

Current PR F behavior:

- `evaluateAgentPackageActivationReadiness(packageOrKey, context)` returns `ready`, `blocked`, or `warning` plus individual requirement results and summary counts.
- `listAgentPackageActivationRequirements(packageOrKey)` returns the same requirement objects without wiring any activation behavior.
- `front_desk_general` can report ready by default because it has no hotel-specific action workflow or data requirements.
- `hotel_concierge` can report ready for internal activation only when the caller supplies passing context for action registry validation, staff queue availability, required hotel data, Hotel Concierge evals, disabled public switching/widget package parameters, disabled external execution, and report-only policy mode.
- `hotel_concierge` remains blocked for public/dashboard activation unless a later explicit safety marker is provided by context and a future activation PR decides how to use it.
- Live booking and PMS integrations are not required for MVP readiness. If external execution is enabled without explicit integration readiness, the service reports blocked.
- The service does not read eval files, call Supabase/OpenAI/providers, create action requests, expose dashboard/admin UI, add public routes, touch widget/embed behavior, enforce policy, or enable package selectors/public package switching.

## Recommended Phase 2 PR Sequence

### PR A: Docs and Contract Only

- Add the Product Runtime Engine plan.
- Extend the package manifest contract with v2 future sections.
- Keep all runtime, schema, migration, UI, chat, widget, embed, tool execution, and enforcement behavior unchanged.

### PR B: Action Request Schema and Service Skeleton

- Add a minimal action request schema and owner/agent-scoped service skeleton.
- Keep it unwired from public chat.
- Add lifecycle validation for `new`, `accepted`, `done`, and `dismissed`.
- Add tests for scoping and lifecycle behavior.

### PR C: Package Action Declaration Registry

- Add a registry for package `actions` action-request declarations.
- Validate manifest declarations against registered action types.
- Keep registry behavior metadata-only at first.
- Do not create requests, execute external tools, call provider clients, wire chat/dashboard/routes/widget/embed surfaces, or enforce policy.

### PR D: Hotel Concierge Controlled Action Creation

- Allow `hotel_concierge` to create action requests in report-only or controlled internal mode.
- Keep external provider execution off.
- Ensure every created request is staff-visible before the assistant claims handoff.
- Prove no booking, checkout, rate, availability, or guest-record mutation occurs.

### PR E: Staff Queue Dashboard Surface

- Add authenticated owner dashboard/API visibility for existing `agent_action_requests` records.
- Support `new`, `accepted`, `done`, and `dismissed` lifecycle transitions plus optional staff notes.
- Preserve owner/agent scoping and auth.
- Keep request creation from chat out of scope.
- Keep public routes, widget/embed changes, external provider/tool execution, policy enforcement, package selectors, and public package switching out of scope.
- Requests can only exist if created by internal/service paths; PR E does not create requests itself.

### PR F: Activation Gate Checks

- Add report-only/service-only checks for data requirements, eval gates, action registration, staff workflow availability, integration configuration, exposure flags, and report-only policy mode.
- Keep the service unwired from public/runtime behavior. It must not enforce activation, mutate answers, create requests, expose package selection, add dashboard/admin UI, add public routes, touch widget/embed behavior, execute external tools/providers, or enable public package switching.

### PR G: Second Product Package Proof

- Add a second package proof such as `flight_attendant`.
- Reuse the same `surfaces`, `settingsSchema`, `dataRequirements`, `allowedActions`, `allowedTools`, `staffWorkflows`, `evalGates`, and `activationRequirements` concepts.
- Prove the engine is package-neutral and not hotel-specific.

## Non-Goals

- No broad runtime code outside the explicitly scoped Phase 2 PR.
- No database schema or migrations except the scoped action request persistence PR.
- No dashboard, admin, staff queue, widget, embed, or chat behavior changes unless the scoped PR explicitly adds that surface.
- No live provider/tool execution.
- No policy enforcement.
- No public package switching.
- No broad feature work outside the product runtime engine plan.
