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
- Enterprise Request Desk Phase 1 adds an unregistered `enterprise_request_desk` product metadata skeleton plus deterministic intake lane services/evals only. It is not imported into the runtime package registry, not persistable under the current DB package-key constraint, not public, not dashboard-selectable, and not wired to QDH, widget/embed, provider execution, operations cockpit, or quote pricing behavior.
- Activation readiness now has a report-only service in `src/services/agents/agentPackageActivationReadinessService.js`. It returns machine-readable package readiness results, but it is not wired into activation enforcement and does not prevent runtime traffic by itself.
- Phase 2 PR G adds one controlled runtime behavior: when `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED` is explicitly enabled, a resolved `hotel_concierge` chat turn may create a staff-visible `agent_action_requests` record for supported guest service messages. The flag is off by default. This path does not execute providers or tools and does not apply policy enforcement.
- Phase 2 PR H is verification/docs-only. A controlled HTTP smoke was attempted with `HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED=1`, a temporary owner-scoped `hotel_concierge` agent, and the water-to-room request prompt. The configured Supabase target blocked the action-request insert because `public.agent_action_requests` was not available in the PostgREST schema cache (`PGRST205`). The temporary auth user, business, agent, widget config cascade, website content, and messages were cleaned up to 0 remaining rows. No runtime code, schema, migration, route, selector, widget/embed, external execution, policy enforcement, or public package switching change was needed or made for PR H.
- Booking Phase 1 is spec/test-only. `docs/architecture/booking-capability-contract.md` defines booking capability terms and future status taxonomy without adding schema, runtime chat behavior, dashboard/admin UI, widget/embed behavior, package activation, provider integrations, or enforcement.
- Booking Phase 2 is docs/tests-only. `docs/architecture/booking-request-layer-plan.md` designs the generic booking request layer as request-only staff review, with proposed fields, lifecycle/proof rules, chat behavior, staff/dashboard behavior, and eval gates. Later Booking Phases 3-7 added the request-only table/service, authenticated owner review API, dashboard review surface, feature-flagged public chat request creation, and staging smoke record. They add no widget/embed behavior, package activation, provider integration, policy enforcement, live availability, or confirmed booking behavior from chat.
- Connected Apps Phase 1 adds `src/services/integrations/connectedAppRegistry.js` as a report-only capability registry for existing provider-specific Google, Calendly, Stripe, and Twilio surfaces. Phase 10 extends that registry with WhatsApp Business capability foundation metadata. These phases add no runtime chat behavior, OAuth/provider setup, WhatsApp webhook receiver, WhatsApp sender, provider execution, package activation enforcement, or external API calls.
- Connected Apps Phase 2 adds `src/services/integrations/connectedAppReadinessService.js` as a provider-neutral, report-only readiness service over the Phase 1 registry. It reports `ready`, `warning`, or `blocked` requirement details from supplied metadata only. It adds no user-facing Connected Apps setup, runtime permission enforcement, OAuth/provider setup, external provider execution, package activation enforcement, dashboard/widget/embed behavior, or chat changes.
- Connected Apps Phase 3 lets package activation readiness attach that connected-app readiness result as optional report-only `connectedApps` metadata when callers explicitly pass connected-app context. It does not change package activation status, enforce activation, create setup flows, call providers, execute external APIs, or change dashboard/widget/embed/chat behavior.
- Connected Apps Phase 4 adds `docs/architecture/connected-apps-data-model-plan.md` as a design-only generic persistence model. It separates future owner/workspace app connections from agent-level app enablements, webhook endpoint state, OAuth state, secret storage, permission evaluation, RLS, product UX, and adapter-first migration. It adds no schema, migration, runtime chat behavior, dashboard/widget/embed changes, OAuth/provider setup, external API/provider execution, package activation enforcement, or secrets.
- Connected Apps Phase 5 adds generic `connected_app_connections` and `agent_connected_app_enablements` persistence plus internal service helpers only. The records are status/configuration records, not runtime provider permissions.
- Connected Apps Phase 6 adds explicit report-only readiness context derivation from those generic records. Activation readiness still does not query Supabase automatically.
- Connected Apps Phase 7 adds authenticated owner-scoped `/agents/...` API routes for safe registry metadata, owner connection records, agent enablements, and report-only readiness reports. It adds no dashboard UI, widget/embed exposure, runtime chat behavior, public/anonymous routes, OAuth/provider setup, provider execution, package activation enforcement, or secrets.
- Connected Apps Phase 8 adds a compact authenticated dashboard/settings `Connected apps` management surface over the Phase 7 routes. It is manual/status-only for non-adapter records, labels report-only readiness, and adds no schema/migration changes, runtime chat behavior, widget/embed exposure, public/anonymous routes, OAuth/provider setup, provider execution, package activation enforcement, package switching, or secrets.
- Connected Apps Phase 9 adds Google Calendar as the first adapter into the generic Connected Apps model. It reuses the existing Google operator connection flow, mirrors redacted Calendar connection status into `connected_app_connections`, and keeps agent enablement explicit through the generic endpoint. It adds no new Google scopes, runtime chat/tool execution, widget/embed exposure, public/anonymous routes, package activation enforcement, generic provider execution, package switching, automatic enablement, or secrets.
- Connected Apps Phase 10 adds WhatsApp Business as a capability foundation only. It declares `whatsapp.business.webhook`, `whatsapp.business.send.template`, and `whatsapp.business.send.session.reply`; supports safe manual/status-only connection metadata and readiness reporting; and later dashboard copy now makes the WhatsApp inbox boundary explicit with `Manual staff reply`, `No AI reply`, `No automatic WhatsApp messages`, and `No Meta OAuth/Embedded Signup yet`. The manual staff reply milestone adds feature-flagged staff-authored session replies only after owner/thread/connection/capability/agent/session-window/server-credential checks pass. It adds no runtime public chat behavior, widget/embed exposure, Meta OAuth/Embedded Signup, Twilio WhatsApp API calls, automatic replies, AI replies, package activation enforcement, generic provider execution, or secrets.

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
  connectedAppRequirements: {
    reportOnly: true,
    requiredCapabilities: [],
    optionalCapabilities: []
  },
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

### `connectedAppRequirements`

Declares future connected app capability requirements for report-only readiness review. Examples:

- `google.calendar.read`
- `google.calendar.write`
- `calendly.booking.webhook`
- `stripe.billing.webhook`
- `twilio.phone.webhook`
- `whatsapp.business.webhook`
- `whatsapp.business.send.template`
- `whatsapp.business.send.session.reply`

Connected app requirements must validate against `src/services/integrations/connectedAppRegistry.js`, but they are not permission grants. They must not start OAuth, create connections, expose provider scopes, install webhook handlers, activate packages, call providers, or make public chat callable.

`src/services/integrations/connectedAppReadinessService.js` can evaluate future required and optional requirement keys against supplied connected-capability, provider-status, scope-grant, and webhook-status metadata. `src/services/agents/agentPackageActivationReadinessService.js` can include that result in a separate `connectedApps` report block when `context.connectedApps` is supplied. The output is report-only and redacted. It can warn or block inside the connected-app metadata, but it must not enforce activation, change the activation status, or grant runtime execution.

Current registered packages do not declare connected app requirements. Existing providers remain provider-specific, and no generic OAuth/provider Connected Apps setup exists yet. Phase 7 exposes authenticated owner/internal setup APIs for generic status records only. Phase 8 exposes those records in the authenticated dashboard as manual/status-only management and report-only readiness. Phase 9 mirrors Google Calendar from the existing Google operator flow into generic records; it does not make package requirements executable. Phase 10 represents WhatsApp Business as manual/status-only capability metadata; it does not make WhatsApp package requirements executable.

Connected Apps Phase 4 designed the persistence model for those requirements. Phases 5-8 now implement generic records, report-only readiness derivation, authenticated owner APIs, and a manual/status-only authenticated dashboard surface over those records. Phase 9 adds the Google Calendar adapter into those records. Phase 10 adds WhatsApp Business foundation metadata over the same generic manual/status model. An owner/workspace `connected_app_connections` record proves only that an owner has a redacted provider/app/capability status record. An `agent_connected_app_enablements` record proves only that an owner enabled a subset of connected capabilities for one agent. Neither record, the Phase 7 API, the Phase 8 dashboard controls, the Phase 9 adapter, nor the Phase 10 WhatsApp foundation are sufficient by themselves for runtime execution; a later permission service must also check package declaration, provider scopes/webhook state, allowed surface, approval mode, billing/access state, execution policy, provider proof, safe logging, and audit logging.

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

Connected Apps Phase 3 extends the evaluator input with optional `connectedApps` context and attaches the connected-app readiness result as metadata only. Connected-app readiness status is not an activation requirement in this phase.

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
- Connected app requirements declared for readiness: optional future package requirements can report missing app capabilities, but they do not grant provider execution or activate packages.
- Generic connection records designed separately: owner connections and agent enablements now exist as generic status/configuration records and authenticated owner APIs, but they remain separate from package activation and are not runtime provider permissions.
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

### Connected Apps Phase 1: Report-Only Capability Registry

- Add `src/services/integrations/connectedAppRegistry.js` with frozen, copy-safe metadata for existing provider-specific capabilities.
- Keep every current connected app capability `publicChatCallable: false` and `packageActivatable: false`.
- Validate unknown and malformed capability keys safely.
- Keep tool registry declarations separate from connected app capability declarations.
- Keep package manifests free of active provider execution requirements.
- Add docs/tests only; do not add schema, OAuth, dashboard UI, runtime chat behavior, widget/embed behavior, provider execution, package activation enforcement, or external API calls.

### Connected Apps Phase 2: Report-Only Readiness Service

- Add `src/services/integrations/connectedAppReadinessService.js` with pure helpers for package/agent readiness reports.
- Return overall `ready`, `warning`, or `blocked` plus requirement details.
- Treat unknown required capabilities, missing required capabilities, required `disabled`/`needs_attention` providers, missing required OAuth scope grants, and missing required webhook status as blocked.
- Treat missing optional capabilities as warnings.
- Keep execution requests blocked unless all required capabilities are connected and the registry allows external execution for the requested non-public surface.
- Keep public chat execution blocked for all current capabilities.
- Keep current registered packages free of connected-app requirements and package activation enforcement.
- Add service/tests/docs only; do not add schema, migrations, OAuth/provider setup, dashboard UI, runtime chat behavior, widget/embed behavior, provider execution, external API calls, package activation enforcement, or secrets.

### Connected Apps Phase 3: Activation Readiness Reporting

- Thread `evaluateConnectedAppReadiness()` into `agentPackageActivationReadinessService` only for explicit `context.connectedApps` input.
- Include report-only `connectedApps` metadata with overall connected-app `ready`, `warning`, or `blocked` status, requirement entries, and summary counts.
- Preserve current package activation readiness output when no connected-app context is supplied.
- Keep current registered package manifests free of connected-app requirements.
- Keep connected-app readiness separate from package activation enforcement and activation status.
- Add service/tests/docs only; do not add schema, migrations, OAuth/provider setup, dashboard UI, runtime chat behavior, widget/embed behavior, provider execution, external API calls, package activation enforcement, or secrets.

### Connected Apps Phase 4: Generic Connection Model Design

- Add `docs/architecture/connected-apps-data-model-plan.md`.
- Define future `connected_app_connections` owner/workspace connection records.
- Define future `agent_connected_app_enablements` agent-level capability enablements.
- Define future `connected_app_webhooks` endpoint/proof registry state.
- Define OAuth state/session, secret/token storage, permission evaluation, RLS/security, product UX, and adapter-first migration contracts.
- Require existing `agent_booking_integrations`, Google OAuth/account tables, Stripe billing/webhook handling, Twilio phone webhook handling, and future WhatsApp execution-specific records to coexist through adapters before any destructive migration.
- Keep public chat execution blocked by default.
- Add docs/tests only; do not add schema, migrations, OAuth/provider setup, dashboard UI, runtime chat behavior, widget/embed behavior, provider execution, external API calls, package activation enforcement, package activation changes, or secrets.

### Connected Apps Phase 5: Generic Persistence and Service Foundation

- Add `connected_app_connections` and `agent_connected_app_enablements` to the canonical schema and migration set.
- Keep rows owner scoped and redacted.
- Keep authenticated owner-select-only RLS and service/internal write expectations.
- Add service helpers for owner connection status and agent enablement CRUD.
- Validate registry providers/capabilities, owned agents, connection ownership, allowed non-public surfaces, and capability membership.
- Return DTOs without raw tokens, token secret refs, secrets, OAuth URLs, provider clients, handlers, or execution fields.
- Add schema/migration/service/tests/docs only; do not add dashboard UI, runtime chat behavior, widget/embed behavior, OAuth/provider setup, provider execution, external API calls, package activation enforcement, or secrets.

### Connected Apps Phase 6: Generic-Record Readiness Context

- Add `buildConnectedAppReadinessContext()` as an explicit helper over the Phase 5 records.
- Read only generic owner connections and owner/agent enablements.
- Build report-only context for `evaluateConnectedAppReadiness()`.
- Keep activation readiness pure: callers must explicitly supply connected-app context.
- Exclude token refs, metadata secrets, OAuth URLs, provider clients, account payloads, and provider-specific legacy tables.
- Add service/tests/docs only; do not add schema/migration changes, dashboard UI, runtime chat behavior, widget/embed behavior, OAuth/provider setup, provider execution, external API calls, package activation enforcement, or secrets.

### Connected Apps Phase 7: Authenticated Owner API

- Add authenticated owner-scoped routes under existing `/agents/...` dashboard API conventions.
- Return safe registry metadata through `GET /agents/connected-app-capabilities` with every current capability `publicChatCallable: false`.
- List, create, and update only the authenticated owner's generic connection status records through `/agents/connected-apps`.
- List, create, and update agent enablements only after verifying owner access to the URL agent through `/agents/:agentId/connected-apps`.
- Validate connection owner scope, known capability keys, and capability membership on the selected connection.
- Add `GET /agents/:agentId/connected-app-readiness` for report-only readiness context/report from generic records.
- Reject raw token, secret, token-secret-ref, OAuth URL, provider client, handler, public callable, and execution fields.
- Add routes/service/tests/docs only; do not add schema/migration changes, dashboard UI, widget/embed exposure, runtime chat behavior, public/anonymous routes, OAuth/provider setup, provider execution, external API calls, package activation enforcement, runtime permission enforcement, or secrets.

### Connected Apps Phase 8: Authenticated Dashboard Management Surface

- Add a compact `Connected apps` surface in authenticated dashboard/settings only.
- Fetch `GET /agents/connected-app-capabilities`, `GET /agents/connected-apps`, `GET /agents/:agentId/connected-apps`, and `GET /agents/:agentId/connected-app-readiness`.
- Show provider/capability labels, connection status, provider account label, scopes/capability summary, webhook status, agent enablement, approval mode, allowed surfaces, and report-only readiness warnings.
- Allow owners to create manual/status-only connection records, update connection status, and enable/disable selected capabilities for the selected agent.
- Label non-adapter records as manual/status-only and label Google Calendar as using the existing Google connection flow with no chat execution and no provider action without approval.
- Do not show or accept raw tokens, secrets, OAuth URLs, webhook URLs, provider client fields, executable handler fields, public chat callable controls, package selector controls, or package switching controls.
- Add dashboard UI/tests/docs only; do not add schema/migration changes, runtime chat behavior, widget/embed behavior, public/anonymous routes, OAuth/provider setup, provider execution, external API calls, package activation enforcement, runtime permission enforcement, package switching, or secrets.

### Connected Apps Phase 9: Google Calendar Adapter

- Add a Google Calendar adapter over the existing Google operator connection flow.
- Upsert a redacted `connected_app_connections` row after successful existing Google OAuth finalization.
- Mirror Google token/scope attention states into generic connection status without exposing tokens, OAuth codes, state secrets, or client secrets.
- Grant `google.calendar.read` only when Calendar read/write scope is granted.
- Grant `google.calendar.write` only when Calendar write scope is granted.
- Reuse the existing Google connect dashboard action from the Connected Apps surface.
- Keep `agent_connected_app_enablements` explicit through the existing generic endpoint; do not automatically enable any agent.
- Add adapter/tests/docs/dashboard-copy alignment only; do not add schema/migration changes, new Google scopes, runtime chat/tool execution, widget/embed behavior, public/anonymous routes, package activation enforcement, generic provider execution, package switching, or secrets.

### Connected Apps Phase 10: WhatsApp Business Foundation

- Add WhatsApp Business registry declarations for `whatsapp.business.webhook`, `whatsapp.business.send.template`, and `whatsapp.business.send.session.reply`.
- Keep receive/webhook readiness, approved-template outbound messaging, and customer-service-window session replies as separate capabilities.
- Allow only safe non-secret manual metadata such as WhatsApp Business Account ID, phone number ID, business display name, webhook verification status, and Graph API version.
- Reject access tokens, app secrets, verify tokens, webhook secrets, OAuth codes, API keys, and access-token-looking values from metadata and route responses.
- Show dashboard copy for `Manual/internal setup`, `Manual staff reply`, `No AI reply`, `No automatic WhatsApp messages`, and `No Meta OAuth/Embedded Signup yet`.
- Keep all WhatsApp capabilities non-public, non-package-activatable, and non-executable in this phase.
- Add metadata/readiness/manual-status/dashboard-copy/tests/docs only; do not add schema/migration changes, runtime chat behavior, widget/embed behavior, WhatsApp webhook routes, Meta OAuth/Embedded Signup, WhatsApp Cloud API calls, Twilio WhatsApp API calls, outbound messages, inbound message processing, package activation enforcement, generic provider execution, or secrets.

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
