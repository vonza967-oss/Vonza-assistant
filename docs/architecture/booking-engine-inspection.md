# Booking Engine Inspection

Inspection date: 2026-06-02

This is a documentation-only architecture audit of booking, appointment, availability, reservation, and scheduling behavior in Vonza. It does not propose or rely on any production behavior change.

## Executive summary

Vonza does not currently have a generic public booking engine.

Booking Phase 1 adds the capability contract in `docs/architecture/booking-capability-contract.md`. That contract defines `booking_route`, `booking_intent`, `booking_request`, `booking_confirmed`, `availability_question`, and `booking_mutation_request` as engine terms and locks the rule that request, route, lead, and action-queue signals are not confirmed bookings.

Booking Phase 2 adds `docs/architecture/booking-request-layer-plan.md` as a docs/tests-only design for the first real booking capability Vonza should add: a generic, staff-reviewable booking request layer. It proposes request-only object fields, lifecycle semantics, proof rules, chat behavior, staff/dashboard behavior, and eval gates. Later phases added persistence, authenticated owner review, dashboard review, and Phase 6 feature-flagged public chat request creation only. Phase 6 is off by default behind `BOOKING_REQUESTS_FROM_CHAT_ENABLED` and does not add schema, migrations, dashboard/admin UI, widget/embed behavior, package activation, external booking/calendar/PMS/provider integration, policy enforcement, live availability, cancellation/reschedule mutation, or confirmed booking behavior.

The current system has booking-like signals and workflows:

- Public chat can discuss booking requests, availability questions, cancellations, and rescheduling using prompt guardrails and owner-approved context.
- Booking-intent messages can become lead-capture prompts, direct booking CTAs, dashboard action-queue items, package-specific staff action requests, or feature-flagged generic `agent_booking_requests` for staff review.
- Owners can configure booking URLs, including Calendly URLs, and Vonza can route visitors to those URLs.
- A signed Calendly webhook can record a trusted `booking_confirmed` conversion outcome after the booking is completed in Calendly.
- The operator workspace can sync Google Calendar events, suggest internal slots, draft calendar actions, and owner-approve calendar mutations.

Those pieces are not a real booking system. Vonza does not store a canonical appointment record, expose live availability to public chat, hold slots, reserve times, confirm visitor-requested bookings, cancel existing bookings, reschedule existing bookings, or mutate an external calendar/PMS/provider from chat.

Put plainly: Vonza currently supports routing, lead capture, trusted outcome recording, staff follow-up, and feature-flagged request-only chat booking requests. Vonza does not currently support public live availability, slot holds, confirmed bookings, cancellation mutation, or reschedule mutation from chat.

The honest classification is:

- Real public booking: no.
- Booking request storage: yes, generic request-only `agent_booking_requests`; public chat creation is feature-flagged and staff-review only.
- Lead capture: yes, for booking/scheduling/availability intent.
- Prompt-only booking behavior: yes, most chat handling is model/prompt-driven with repair guardrails.
- External booking confirmation recording: yes, only for trusted Calendly webhook events and some operator calendar flows.

## Current booking capability

| Area | What exists | What it means | Is it real booking? |
| --- | --- | --- | --- |
| Public chat booking questions | Prompt rules, evidence grounding, repair checks, lead capture, optional booking CTA routing, and feature-flagged request-only row creation | The assistant should avoid confirming unavailable facts and can collect contact details, route to a configured URL, or send a request to staff for review | No |
| Booking URL / Calendly URL | `widget_configs` stores booking URLs and routing URLs; settings can validate Calendly booking links | Visitors can be sent to an external booking page | No, Vonza is only routing |
| `booking_started` outcome | Conversion outcome recorded when a visitor starts a booking route | Analytics event for CTA/routing | No |
| `booking_confirmed` outcome | Conversion outcome recorded by signed Calendly webhook or operator calendar flows | Proof/analytics that an external or owner-approved event happened | Not a booking engine record |
| Calendly webhook | Signed inbound webhook for `invitee.created` | Vonza can trust an already-confirmed Calendly booking and record an outcome | External confirmation only |
| Operator Google Calendar | Owner workspace can sync events, suggest internal slots, draft actions, and owner-approve calendar changes | Staff/operator workflow, not public booking inventory | Owner-side calendar mutation only |
| Hotel action requests | Package-specific service requests such as water, towels, housekeeping, maintenance, late checkout review | Staff-visible request queue with status | No booking or reservation mutation |
| Front Desk evals | Scenarios require "request" and "not confirmed" wording | Safety expectations around booking-like language | Prompt/eval coverage only |

The current booking capability is therefore "request or route, then record signals." It is not "check live availability and confirm an appointment."

## Current data model

The schema has several booking-adjacent tables, but no canonical booking model.

### Booking-adjacent tables

- `widget_configs`
  - Stores public routing and CTA fields such as `booking_url`, `booking_start_url`, `booking_success_url`, `primary_cta_mode`, `fallback_cta_mode`, `business_hours_note`, and contact channels.
  - This config enables booking links and availability notes. It does not store appointment inventory or bookings.

- `agent_contact_leads`
  - Stores captured visitor contact details and intent metadata: `capture_state`, `contact_name`, `contact_email`, `contact_phone`, `latest_intent_type`, `latest_action_type`, `latest_action_key`, `capture_reason`, `capture_prompt`, and `capture_metadata`.
  - Booking-like messages are stored as lead/contact intent, commonly `booking_intent`.
  - This is lead capture, not a booking request lifecycle.

- `agent_action_queue_statuses`
  - Stores owner action queue status and follow-up metadata for message-derived items.
  - Booking-like messages can be categorized as `booking` or `booking_intent`, but this is dashboard triage state.
  - It does not represent a confirmed appointment or requested slot.

- `agent_action_requests`
  - Stores package action requests with owner/agent/business scope, `package_key`, `request_type`, `status`, `guest_context`, `payload`, `source_message`, and `staff_notes`.
  - Current registry entries are package-specific, mainly Hotel Concierge staff/service requests.
  - The lifecycle is `new`, `accepted`, `done`, `dismissed`. That is not sufficient for booking states such as requested, held, offered, confirmed, cancel requested, cancelled, or rescheduled.

- `agent_conversion_outcomes`
  - Stores analytics/proof outcomes, including `booking_started` and `booking_confirmed`, with optional `lead_id`, `contact_id`, `calendar_event_id`, `source_type`, and `confirmation_level`.
  - This table can record that a booking was started or confirmed elsewhere. It is not the booking itself.

- `agent_booking_integrations`
  - Stores owner-scoped Calendly webhook integration metadata: provider, status, booking URL, token hash, encrypted webhook signing secret, provider account/event type ids, and metadata.
  - The schema catalog describes it as Calendly webhook storage for trusted booking confirmations.
  - It does not store slots, services, staff, customer booking state, or availability rules.

- `operator_business_profiles`
  - Stores profile context such as services, operating hours, approved contact channels, policies, and related operator metadata.
  - These fields can inform chat, but they are business facts, not live availability.

- `operator_calendar_events`
  - Stores synced or drafted calendar events in the connected operator workspace: provider event id, action type, source kind, status, approval status, title, start/end times, attendees, linked contact/lead, and metadata.
  - This is operator calendar context. It is not a public booking inventory or generic appointment engine.

### What is missing

There is no generic booking engine table for:

- Booking services, durations, resources, locations, staff, or capacity.
- Availability windows, exceptions, blackouts, holidays, or per-resource rules.
- Slot holds or conflict resolution.
- Confirmed appointments with customer-visible confirmation codes.
- Cancellation or reschedule mutations.
- Booking audit events with proof, actor, source, and lifecycle transitions.

`db/schema.sql` is canonical and currently aligns with booking-adjacent migration/catalog entries, including Calendly integration, action requests, conversion outcomes, operator calendar records, and the generic `agent_booking_requests` request table. The recovery SQL and schema catalog show the same overall shape: a request-only booking foundation exists, but there is no confirmed-booking engine schema for services, capacity, live availability, holds, appointments, or provider mutation.

## Current chat flow

The public chat path is mostly prompt-and-guardrail behavior plus deterministic lead/routing side effects.

At a high level:

1. `chatService.js` resolves public context, access status, website/business context, package context, and persisted conversation state.
2. For Hotel Concierge only, it may run deterministic action-request drafting before the normal model answer path.
3. When `BOOKING_REQUESTS_FROM_CHAT_ENABLED` is explicitly enabled, clear booking, availability, cancellation, or reschedule intent may create a generic staff-review `agent_booking_requests` row before model generation.
4. Prompt compilation injects hard rules: do not invent services, prices, policies, availability, booking times, contact routes, guarantees, discounts, or legal claims.
5. Evidence Pack context is built from owner-approved answers, reviewed business profile facts, and retrieved website/manual content. It defines `live_booking` and `guest_record` as possible source types, but the current public chat path does not provide live booking evidence.
6. Answer Contract and Claim Verifier can produce report-only metadata for risky claims, including availability and booking claims. They do not currently enforce, rewrite, block, persist, or change the final visitor reply.
7. The model answer is repaired when guardrail issues are detected.
8. Final deterministic validation handles placeholder/untrusted contact details and a narrow unsupported-service correction path.
9. Lead capture and direct conversion routing run after the reply.

### Deterministic behavior

The following parts are code-driven rather than merely prompt-driven:

- Booking, appointment, scheduling, availability, reservation, consultation, and demo terms can trigger `booking_intent` lead capture.
- The booking lead-capture prompt asks for contact details so the business can follow up and help arrange the next step.
- Direct routing can attach a booking CTA when a configured booking URL exists.
- Contact safety strips or replaces untrusted contact details for contact-intent replies.
- Hotel Concierge action requests block emergency, payment/rate, booking, reservation, and guest-record mutation requests from becoming normal staff action requests.
- Feature-flagged generic booking requests use deterministic extraction only and call `createAgentBookingRequest()`; they do not call OpenAI, Calendly, calendar, PMS, provider, action-request, or conversion-outcome mutation paths.
- Factual guardrail repair checks can flag invented policy, availability, discount, or booking details when the user intent is classified as policy and no trusted evidence exists.

### Prompt-only or model-dependent behavior

The following behavior is not a deterministic booking workflow:

- Avoiding all possible booking-confirmation phrasing in the final natural-language answer.
- Handling generic cancellation or reschedule requests when `BOOKING_REQUESTS_FROM_CHAT_ENABLED` is off.

The prompt is strong, and evals cover important booking phrasing. But the public chat runtime does not have a deterministic "no booking confirmation" final replacement for every unsupported booking statement. The repair loop can catch many cases, but final validation only has a narrow hard replacement for unsupported service denial, not a booking-specific replacement.

### Visitor examples

For "Can I book tomorrow at 10?":

- Vonza cannot reserve or confirm tomorrow at 10.
- With `BOOKING_REQUESTS_FROM_CHAT_ENABLED` on, Vonza can create a staff-review request and use deterministic copy that says the business must confirm details and no time is confirmed in chat.
- With the flag off, the expected safe answer is that the time is not confirmed or cannot be confirmed from chat.
- Lead capture may ask for name/email/phone.
- A booking CTA may appear if a booking URL is configured.

For "Do you have availability Saturday?":

- Vonza does not perform a live availability lookup.
- The expected safe answer is that live availability is not available or cannot be confirmed unless owner-approved context states a limited policy such as "Saturday by request."
- With the flag on, this can become a staff-review booking request. It must not claim a time is available.

For "Cancel my appointment":

- Vonza does not cancel appointments from public chat.
- With the flag on, this can become a `cancel_requested` staff-review booking request. It must not claim cancellation happened.
- Hotel Concierge explicitly treats booking/reservation mutations as staff-only/PMS-handled and blocks normal action-request creation.
- With the flag off, Generic Front Desk should route to contact/follow-up through the existing prompt, lead, and routing behavior.

For "Change my booking":

- Vonza does not change bookings from public chat.
- With the flag on, this can become a `reschedule_requested` staff-review booking request. It must not claim a reschedule happened.
- Hotel Concierge has explicit safety handling for reservation changes.
- Generic Front Desk has no generic reschedule mutation path.

For "What times are available?":

- Vonza does not expose live slot availability.
- Operator calendar can compute internal suggested slots from synced events, but those suggestions are not public chat availability and should not be treated as bookable inventory.

## Current dashboard/staff flow

Dashboard/operator behavior is triage and operations support, not a generic booking console.

### Action queue

`/agents/action-queue` builds owner-scoped action items from messages, lead captures, conversion outcomes, routing events, follow-up drafts, and knowledge-fix signals. Booking-like messages can appear as "Booking" or `booking_intent` items with follow-up metadata. Owners can update status and notes.

This helps staff notice a booking-intent conversation. It does not create, accept, deny, or confirm a booking.

### Staff action requests

`/agents/action-requests` and `/agents/action-requests/status` list and update package action requests. The dashboard renders a "Guest service requests" queue with statuses such as new, accepted, done, and dismissed.

Current action requests are Hotel Concierge service/staff requests. `hotel.late_checkout_request` is explicitly a staff review request and does not approve or change a booking. Front Desk declares no action request types.

### Customers and Today views

Customer and Today surfaces show booking-related signals such as booking outcomes, review tasks, appointment review, follow-up, and manual outcome controls. These are useful operator workflows, but they are not appointment lifecycle management.

### Operator calendar

The operator workspace can:

- Sync Google Calendar events.
- Link events to contacts or leads by attendee email.
- Suggest internal open slots from synced events.
- Draft calendar actions.
- Require owner approval before creating, updating, or cancelling Google Calendar events.
- Record `booking_confirmed` conversion outcomes for non-cancelled synced/approved calendar events.

This is the closest real mutation path, but it is owner-authenticated operator workflow, not public booking. It also does not define a generic service/resource/slot booking model.

## Existing package/action-request system

`agent_action_requests` can become part of a future foundation, but it is not enough by itself.

What is useful:

- Owner, agent, business, and package scoping are already present.
- There is a package registry and a validation boundary.
- Request payloads and guest context can store structured data.
- Staff status updates and notes already exist.
- Front Desk is explicitly not allowed to create Hotel Concierge requests.
- The registry currently has no executable handlers/provider clients, which avoids accidental external execution.

What is not yet booking-ready:

- No generic Front Desk booking request type.
- No normalized requested service, staff/resource, time window, timezone, or duration schema.
- No lifecycle that distinguishes requested, needs info, offered, held, confirmed, declined, cancel requested, cancelled, or rescheduled.
- No idempotency or dedupe contract for repeated visitor messages.
- No slot availability, hold, conflict, or provider confirmation semantics.
- No customer verification path for existing appointment changes.
- Existing Hotel Concierge action safety deliberately blocks booking/reservation mutations.

The action-request system is a reasonable staff-request substrate. It should not be treated as a booking engine until booking-specific models, lifecycle, proof, and dashboard semantics exist.

## External integrations

### Calendly

Vonza has a Calendly webhook integration path:

- Settings/provisioning can store Calendly booking URL and webhook metadata.
- The webhook endpoint verifies a hashed endpoint token and signed Calendly payload.
- Stale timestamps are rejected.
- Disabled or unhealthy integrations are rejected.
- Only `invitee.created` is treated as a confirmed booking signal.
- Event type mismatches are ignored.
- Duplicate events are deduped.
- Tracking payloads cannot rewrite owner or agent scope.
- `invitee.canceled` is ignored.

The result is a `booking_confirmed` conversion outcome. Vonza does not create, cancel, or reschedule Calendly events and does not expose Calendly live availability through chat.

### Google Calendar

Google Calendar is used by the operator workspace:

- Read access can sync events into `operator_calendar_events`.
- Optional write access can create/update/cancel events after owner approval.
- Synced or approved non-cancelled events can be recorded as `booking_confirmed` outcomes.

This is owner/operator workflow. It is not a public booking provider integration.

### PMS, CRM, and booking providers

No live PMS, generic CRM booking, Google Calendar public booking, Calendly booking creation, Calendly cancellation/reschedule, webhook-to-appointment table, or live availability lookup exists in the current inspected paths.

## Current eval coverage

### Front Desk and web-call evals

Front Desk evals cover:

- Booking/availability request: "Can you book me this Saturday at 10?"
- New patient booking requests.
- Specific appointment time requests.
- After-hours appointment requests.
- Walk-in requests.
- Same-day availability unknown.
- Follow-up on an appointment request.
- Reschedule follow-up: "I already booked. Can you move my appointment to Friday?"

The expected behavior is consistently request/follow-up language, not confirmation. Forbidden patterns include "you're booked", "you are confirmed", "confirmed for", and similar unsupported availability guarantees.

### Hotel Concierge evals

Hotel Concierge evals cover:

- Live room availability missing.
- Vague room availability questions.
- Supported cancellation policy from fixture facts.
- Booking modification handoff.
- Guest privacy for reservation details.
- Prompt-injection around policy/discounts.

The rubric has explicit `availabilitySafety` and `privacyAndHandoffSafety` criteria. It flags invented room availability, "I can book", unsupported booking confirmations, room numbers, and guest-specific reservation disclosures.

### What the evals guard against

The current evals guard against:

- Confirming a requested appointment time.
- Inventing same-day or live room availability.
- Saying the visitor is booked or confirmed.
- Treating appointment requests as already received by the business.
- Changing an existing appointment/reservation in chat.
- Disclosing guest-specific reservation details.
- Inventing unsupported booking policies, fees, discounts, or provider facts.

### Eval gaps

Important gaps remain:

- Generic Front Desk cancellation is less directly covered than reschedule.
- Generic "What times are available?" without a booking URL or approved answer should be covered explicitly.
- Booking CTA flows should be tested to ensure `booking_started` is never phrased as confirmed booking.
- Calendly configured-but-webhook-missing mode should be tested so the assistant and dashboard do not imply trusted confirmation.
- Operator suggested slots should be covered by tests that ensure they are not exposed as public live availability.
- Manual `booking_confirmed` outcomes should be tested or constrained so unsupported manual proof does not get treated like provider confirmation.
- Final answer validation should have booking-specific negative tests for unsupported "you are booked", "I booked you", "available today", and "confirmed for" phrasing.

## Current safety guarantees

The strongest current guarantees are operational:

- Public chat does not call a booking provider, PMS, or calendar mutation endpoint.
- Public chat does not have live slot inventory.
- Calendly confirmation recording requires a signed webhook, endpoint token, fresh timestamp, matching active integration, active agent, and dedupe.
- Hotel Concierge deterministic action requests refuse normal request creation for booking/reservation/payment/guest-record mutations.
- Front Desk declares no action request types.
- Owner routes and action-request status updates are owner scoped and require active agent access.
- Operator Google Calendar writes require owner authentication and calendar write scope.
- Service role keys and other secrets are not intentionally exposed by the booking paths.

Prompt and eval safety is also meaningful:

- Prompt compiler rules forbid invented availability and booking times.
- Approved answers can state "requested times are not confirmed until the business replies."
- Hotel package prompt blocks explicitly forbid live room availability claims without live booking evidence.
- Evals forbid common unsupported confirmation phrases.

However, prompt behavior is not the same as a deterministic guarantee. The model may still vary. The final public reply path does not currently hard-replace every unsupported booking-confirmation phrase.

## Gaps and risks

### Highest-risk gap

The highest-risk gap is that booking-like language and analytics exist without a canonical booking lifecycle. `booking_started`, `booking_confirmed`, "Booking" action queue items, booking CTAs, and operator calendar outcomes can look more mature than they are. That creates product and safety risk if users, staff, or future code treat lead capture or outcome analytics as confirmed appointment state.

### Other risks

- No live availability source, slot hold, or conflict control exists.
- No service/resource/staff/timezone model exists.
- No public confirmed-booking lifecycle exists; the public chat request producer is feature-flagged and request-only.
- No deterministic final filter fully prevents unsupported booking confirmation language.
- `booking_confirmed` is overloaded: Calendly webhook proof is strong, while operator calendar sync/approval and manual outcomes may be less specific to booking intent.
- Google Calendar sync can record non-cancelled events as booking-confirmed outcomes even if the event is not a customer appointment.
- Manual fallback outcome controls can mark `booking_confirmed` without provider proof when enabled.
- A future booking action request could be misread if it reuses generic statuses like `accepted` instead of booking-specific status labels.
- Cancellation/reschedule needs visitor identity verification before exposing or changing existing booking state.
- Live availability would introduce race conditions, stale slots, time zone errors, PII handling, provider webhook trust boundaries, audit requirements, and RLS/service-role risks.

## Recommended next architecture

If Vonza wants a generic booking engine later, it should be designed as a separate capability with explicit modes. Do not retrofit real booking semantics into leads, conversion outcomes, or generic action requests.

The safe foundation now implemented is the booking request layer, not direct confirmed booking. That layer stores visitor-requested service/time/contact details and exposes staff review without claiming a confirmed appointment until a trusted external/provider or staff-approved proof path exists.

Phase 2 defines that layer as request-only:

- Proposed fields include owner, agent, business, visitor session, source message, source channel/display mode, requested service, requested time text, optional normalized time window, timezone, optional customer contact, status, status reason, staff notes, evidence/proof references, timestamps, optional expiry, and idempotency key.
- Lifecycle states are `request_received`, `needs_info`, `needs_staff_review`, `offered`, `confirmed_externally`, `declined`, `cancel_requested`, `reschedule_requested`, `cancelled_externally`, and `expired`.
- `offered`, `confirmed_externally`, and `cancelled_externally` require proof appropriate to the claim.
- Availability questions become requests or external routes, not live answers.
- Cancellation and reschedule requests become staff-review requests unless a later verified integration and customer-verification contract exists.
- Staff can list, annotate, and update request status in a future owner-scoped workflow, but v1 must not directly mutate calendars, Calendly, PMS, CRM, payment, checkout, guest records, or provider systems.

Recommended building blocks:

1. Capability contract
   - Define explicit modes: `no_booking`, `request_only`, `external_link_only`, `trusted_external_confirmation`, `staff_reviewed_booking`, `live_availability`, and `live_booking`.
   - Inject this mode into prompts and response validation.
   - Use it to determine whether chat may say "request", "route", "availability", "held", or "confirmed."

2. Booking request model
   - Add a dedicated future `booking_requests` concept with owner/agent/business scope, visitor/session/contact linkage, requested service, requested staff/resource, requested time window, timezone, status, source message, and idempotency key.
   - Do not use `agent_contact_leads` as the booking lifecycle.
   - Start with request-only statuses from the Booking Phase 1 contract before any live availability or confirmation behavior.

3. Service and resource model
   - Define services, durations, prep rules, buffers, locations, staff/resources, capacity, public/private flags, and owner approval requirements.

4. Availability model
   - Define availability windows, exceptions, holidays, blackouts, provider sync state, slot generation, and per-resource conflict checks.
   - Keep business hours/profile facts separate from bookable availability.

5. Hold and confirmation model
   - Add slot holds with expiration, idempotent confirm operations, conflict handling, and provider proof.
   - Store confirmed appointments separately from conversion outcomes.

6. Cancellation and reschedule model
   - Add customer verification, existing booking lookup, allowed policy windows, reschedule offers, cancellation requests, and audit events.
   - Do not let public chat mutate existing booking state without verified identity and provider/backend authority.

7. Provider abstraction
   - Build provider adapters for read availability, hold, confirm, cancel, reschedule, and webhook ingest.
   - Start with request-only or staff-reviewed mode before enabling live provider mutation.

8. Dashboard workflow
   - Build a booking-specific inbox, not a generic action queue rename.
   - Use statuses and copy that distinguish requested, awaiting contact, offered, confirmed, declined, cancel requested, cancelled, and rescheduled.
   - Show proof source and whether confirmation is provider-verified, staff-entered, or manual.

9. Deterministic chat enforcement
   - Add booking-specific final-response validation that hard-blocks unsupported "booked", "confirmed", "available today", "I scheduled you", and similar phrases unless the current capability mode and evidence support them.
   - Treat Answer Contract and Claim Verifier as candidates for enforcement only after report-only false positive rates are understood.

10. Evals and tests
    - Add evals for every capability mode and every lifecycle transition.
    - Include no-live-availability, request-only, external-link-only, webhook-confirmed, staff-reviewed, live-booking, cancellation, reschedule, privacy, and time-zone scenarios.

## Do not build yet

Do not build or activate a live generic booking engine yet.

The Booking Phase 1 safe step is a docs/spec/test-only phase:

- Write a booking capability contract and status taxonomy.
- Add eval scenarios for generic Front Desk cancellation, "what times are available", booking CTA safety, Calendly webhook missing/untrusted confirmation, and unsupported confirmation wording.
- Audit and tighten outcome labeling so `booking_confirmed` clearly distinguishes provider-verified, owner-approved, synced-calendar, and manual sources.
- Decide whether booking requests should be separate from `agent_action_requests` or implemented as a typed booking-specific request family with a richer lifecycle.
- Add deterministic final-response tests before any schema or runtime booking changes.

Until those pieces exist, Vonza should honestly present booking as lead capture, request routing, external link routing, or trusted outcome recording after an external/provider event. It should not present lead capture or action queue triage as confirmed booking.
