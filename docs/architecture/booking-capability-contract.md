# Booking Capability Contract

Contract date: 2026-06-02

This document defines what "booking" means in Vonza today. It is a product and engine contract. Booking Phase 3 adds generic request persistence and internal service helpers. Booking Phase 4 adds an authenticated owner review API. Booking Phase 5 adds an authenticated dashboard review UI for existing owner-scoped booking requests only. Booking Phase 6 adds feature-flagged public chat request creation only, off by default behind `BOOKING_REQUESTS_FROM_CHAT_ENABLED`. These phases do not add widget/embed behavior, provider integrations, package activation, live availability, slot holds, confirmed booking behavior from chat, or policy enforcement.

Booking Phase 7 is a smoke/docs record, not a capability expansion. The 2026-06-02 controlled target rerun is recorded in `docs/architecture/booking-request-staging-smoke-test.md`. It passed after `public.agent_booking_requests` was applied and exposed through the configured Supabase target's PostgREST schema cache. Phase 7 made no booking behavior, integration, dashboard, widget, embed, package activation, live availability, confirmation, cancellation, or reschedule changes.

## Current Boundary

Vonza currently supports booking routing, booking-intent lead capture, trusted external/operator outcome recording, staff follow-up workflows, authenticated owner review of request rows, and feature-flagged request-only chat booking requests.

Vonza does not currently support public live availability, public slot holds, public confirmed bookings, chat-driven cancellation mutation, chat-driven reschedule mutation, or chat-driven changes to external booking, calendar, PMS, payment, rate, checkout, or guest-record systems.

The safe foundation now implemented is the booking request layer: a staff-visible request lifecycle that stores what the visitor asked for without treating it as confirmed. Direct live confirmation should wait for explicit availability, hold, provider proof, staff approval, audit, and customer verification contracts.

Booking Phase 2 documented that request layer in `docs/architecture/booking-request-layer-plan.md`. Booking Phase 3 implements only the persistence/service foundation: `public.agent_booking_requests`, owner-scoped authenticated select RLS, and internal service helpers for create/list/status update. Booking Phase 4 exposes `GET /agents/booking-requests` and `POST /agents/booking-requests/status` for authenticated owner review. Booking Phase 5 exposes those existing requests in the authenticated dashboard with safe review status controls only. Booking Phase 6 lets public chat create staff-review request rows only when `BOOKING_REQUESTS_FROM_CHAT_ENABLED` is explicitly enabled with `1`, `true`, `enabled`, or `on`. It still adds no public create route, no widget/embed behavior, no dashboard UI changes, no package activation, no provider integration, no policy enforcement, no live availability, no external cancellation/reschedule mutation, and no confirmed booking behavior from chat.

The Phase 7 smoke rerun did not strengthen the current support level beyond the request-only layer. The contract therefore remains exactly request-only and feature-flagged off by default.

## Capability Terms

| Capability | Definition | Current support level | Allowed visitor-facing wording | Forbidden visitor-facing wording | Required proof/source before stronger claims | Current codebase locations |
| --- | --- | --- | --- | --- | --- | --- |
| `booking_route` | Vonza sends the visitor to an external booking URL or booking CTA. | Supported | "You can use the booking link." "Book now." "Open the online booking request." | "Vonza booked this." "Your booking is confirmed." "This slot is held." | Configured owner-scoped booking URL for routing; signed provider webhook or trusted operator outcome before confirmation wording. | `widget_configs.booking_url`, `booking_start_url`, `booking_success_url`; `src/services/conversion/liveConversionRoutingService.js`; `src/services/conversion/conversionOutcomeService.js`; `src/services/bookings/bookingIntegrationService.js`; `src/routes/bookingRoutes.js`. |
| `booking_intent` | A visitor wants to book, schedule, reserve, check availability, change, or cancel. | Supported as an intent signal only | "The team can follow up." "Please share your contact details so staff can check." "Requested times are not confirmed until the business replies." | "You are booked." "Your appointment is confirmed." "I scheduled you." | A later booking request/staff/provider result can strengthen the state; intent alone is never proof. | `src/services/leads/liveLeadCaptureService.js`; `src/services/analytics/analyticsSummaryService.js`; eval scenarios in `src/services/evals/*`. |
| `booking_request` | A staff-visible request for follow-up. It is not a confirmed appointment, stay, reservation, or slot. | Supported as generic persistence/service, authenticated owner list/status review API, authenticated dashboard review UI, and feature-flagged public chat request creation only. | "I can pass this to staff." "This is a request for staff review." "The business can confirm the next step." "No time is confirmed in this chat." | "Staff accepted the booking." "The time is reserved." "The appointment is confirmed." | Staff/operator approval or trusted provider confirmation before any confirmed-booking claim. The request model stores requested service, time window, timezone, contact, source message, status, and proof references. | `agent_booking_requests`; `src/services/bookings/agentBookingRequestService.js`; `src/services/bookings/bookingRequestDraftService.js`; `src/services/chat/chatService.js`; `GET /agents/booking-requests`; `POST /agents/booking-requests/status`; `frontend/dashboard.js`; `agent_contact_leads`; `agent_action_requests`; `agent_conversion_outcomes`. |
| `booking_confirmed` | A trusted external or operator-confirmed outcome that a booking-like event happened outside the public chat booking flow. It is not a canonical booking record. | Partially supported as conversion/outcome recording | "A booking confirmation was recorded from Calendly." "A calendar booking outcome was recorded." | "Vonza has a booking engine." "Chat confirmed this booking." "Lead capture confirms the booking." | Signed Calendly webhook, configured external success proof, or owner/operator-approved calendar outcome with matching owner/agent scope. Confirmation claims need source type, confirmation level, and proof metadata. | `agent_conversion_outcomes`; `src/services/bookings/bookingIntegrationService.js`; `src/services/conversion/conversionOutcomeService.js`; `tests/bookingCalendlyWebhook.test.js`; `tests/conversionOutcomeService.test.js`. |
| `availability_question` | A visitor asks about open times, slots, rooms, same-day availability, or whether a service/visit type is available. | Partially supported for documented service/hours facts; not supported for public live slot availability. | "I cannot confirm live availability here." "That service is listed, but exact times need staff confirmation." "Share dates so staff can check." | "Saturday at 10 is available." "Rooms are available tonight." "I found an open slot." | Live availability provider evidence, live booking evidence, or a staff-approved offered slot before slot-specific availability claims. Business hours or website text are not live inventory. | `src/services/chat/promptCompiler.js`; `src/services/chat/evidencePackService.js`; `src/agentPackages/hotel_concierge/knowledgePolicy.js`; `src/agentPackages/hotel_concierge/promptBlocks.js`; Front Desk and Hotel Concierge eval scenarios. |
| `booking_mutation_request` | A visitor asks to cancel, reschedule, change, move, extend, shorten, or confirm a booking/reservation/appointment/stay. | Not supported from public chat; supported only as handoff/request language. | "I cannot change or cancel that from here." "Staff needs to verify and confirm any change." "Share safe contact details for follow-up." | "I cancelled it." "I moved your appointment." "Your reservation has been changed." "Late checkout is approved." | Verified customer identity, existing booking record lookup, policy authority, provider/PMS/calendar mutation authority, staff approval where required, and audit proof. | Web-call and Hotel Concierge eval scenarios; `src/services/actions/hotelConciergeActionDraftService.js`; `src/agentPackages/hotel_concierge/knowledgePolicy.js`; `src/agentPackages/hotel_concierge/promptBlocks.js`. |

## Booking Request Layer Boundary

The generic booking request layer is request-only. It records requested service, requested time text, optional normalized time windows, timezone, contact details, source message, source channel/display mode, lifecycle status, staff notes, evidence/proof references, timestamps, optional expiry, and an idempotency key in `public.agent_booking_requests`.

The Phase 4 route boundary, Phase 5 dashboard surface, and Phase 6 chat producer are also request-only. Authenticated owners can list their own mapped request rows and move requests through the service-defined review lifecycle. The route code must not bypass the service transition matrix or the trusted-proof requirement for `confirmed_externally` and `cancelled_externally`. The dashboard exposes only `needs_info`, `needs_staff_review`, `offered`, `declined`, and `expired` as casual review controls. Public chat can create only `request_received`, `needs_info`, `needs_staff_review`, `cancel_requested`, or `reschedule_requested` rows when the feature flag is enabled. It must not treat leads, action requests, booking routes, request-only evidence, or conversion intent as confirmed booking proof.

The request layer must link to existing tables without changing their meaning:

- `agent_contact_leads` remains lead/contact capture and may link contact details to a request.
- `agent_action_requests` remains package staff-work; its `new`, `accepted`, `done`, and `dismissed` lifecycle is not a booking lifecycle.
- `agent_conversion_outcomes` remains analytics/proof; `booking_confirmed` is an outcome label, not a canonical booking record.
- Calendly webhooks can provide trusted external proof only after the signed webhook path records the outcome.
- Operator Google Calendar workflows can provide operator proof only through owner-authenticated calendar/outcome paths; internal suggested slots are not public live availability.

The proposed request lifecycle is `request_received`, `needs_info`, `needs_staff_review`, `offered`, `confirmed_externally`, `declined`, `cancel_requested`, `reschedule_requested`, `cancelled_externally`, and `expired`. `confirmed_externally`, `cancelled_externally`, and proof-backed `offered` states require external/provider or verified operator proof. None of these states permit public "booked", "reserved", "scheduled", "held", or "confirmed" wording without proof.

## Future-Safe Status Taxonomy

These are contract terms for request-layer lifecycle values. They are not route parameters, package keys, or visitor-facing labels.

| Status | Meaning |
| --- | --- |
| `intent_captured` | The visitor expressed booking-related intent. No request or booking exists yet. |
| `request_received` | Vonza recorded a staff-visible booking request for follow-up. Not confirmed. |
| `needs_info` | More visitor details are needed before staff can review or follow up safely. |
| `needs_staff_review` | Staff must review missing details, policy, identity, availability, or operational risk. |
| `offered` | Staff or a trusted provider offered a slot/option. It is not confirmed until accepted and confirmed through the required proof path. |
| `confirmed_externally` | A trusted external provider or owner/operator-confirmed calendar outcome says the booking is confirmed. |
| `cancel_requested` | The visitor requested cancellation. No cancellation has happened yet. |
| `reschedule_requested` | The visitor requested a change/reschedule. No change has happened yet. |
| `cancelled_externally` | A trusted external provider or verified operator outcome says the booking was cancelled. |
| `declined` | Staff/provider declined the request or cannot fulfill it. |
| `expired` | The request, offer, or hold is no longer actionable. |

These terms must not appear in visitor-facing copy. Public copy should use plain language such as "the team can follow up", "staff needs to confirm", or "I cannot confirm that from here."

## Proof Rules

- `booking_intent` is never proof of a booking.
- `booking_route` is never proof of a booking; it proves only that the visitor was offered or clicked an external destination.
- `booking_request` is never proof of a booking; it proves only that staff has something to review.
- `booking_started` is not `booking_confirmed`.
- `booking_confirmed` is an outcome/proof label, not a booking table or appointment lifecycle.
- Public live availability claims require live booking evidence, not website copy, business profile notes, or inferred operating hours.
- Cancellation, reschedule, guest-record, payment, rate, checkout, and PMS mutations require verified authority and must not be claimed from public chat.
- Manual/operator outcome labels must show their proof/source level clearly and must not be silently upgraded into provider-confirmed booking state.

## Naming Risks

The current name `booking_confirmed` is potentially stronger than the underlying architecture. It can be valid as an analytics/proof outcome from a signed Calendly webhook or owner/operator calendar flow, but it is not a generic booking record and does not mean Vonza has a public booking engine.

Current action queue labels such as "Booking" and action types such as `booking_intent` are also potentially easy to overread. They mean visitor intent or staff follow-up, not a confirmed booking. Do not rename production fields in this phase; tests should lock the intended meaning until a later migration can introduce clearer booking request and booking proof models.
