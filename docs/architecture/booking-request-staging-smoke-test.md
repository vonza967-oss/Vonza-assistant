# Booking Request Staging Smoke Test

Smoke date: 2026-06-02

## Scope

Booking Phase 7 is a controlled local/staging verification pass for the feature-flagged public chat booking request path. It does not add product behavior.

The smoke target was the configured Supabase project `wjrgzvprxkkgbjppxphk.supabase.co` through the local Express app. Secrets, tokens, and copied key values are intentionally omitted from this record.

## Prerequisite Result

The local migration file exists:

- `supabase/migrations/20260602135522_agent_booking_requests.sql`

Rerun result after applying the migration on the configured target:

- Service-role PostgREST OpenAPI returned 200 and included `agent_booking_requests`.
- Service-role REST select on `public.agent_booking_requests` succeeded.
- Service/internal insert created a prerequisite test row, then deleted it.
- Authenticated owner select returned the owner row; a different authenticated user saw zero rows. This verifies the effective owner-select RLS behavior on the target.

The anon OpenAPI request returned 401 in this local harness, so schema-cache visibility was recorded from the service-role OpenAPI response and direct table REST probes. Secrets, tokens, and copied key values are intentionally omitted.

## Controlled Smoke Attempt

The smoke created a temporary auth user, owner-scoped business, active Front Desk/default-package agent, widget config, website content, and billing account. The app was started locally with:

```bash
BOOKING_REQUESTS_FROM_CHAT_ENABLED=1
```

The public chat prompt was sent through `POST /chat`:

```text
Can I book Saturday at 10 for a dental cleaning? My name is Anna Kovacs and my email is anna@example.com.
```

The chat path created one `agent_booking_requests` row and returned a deterministic safe acknowledgement:

- It included `Saturday at 10`.
- It said the business needs to confirm directly and that no time is confirmed in chat.
- It did not claim the visit was booked, reserved, available, guaranteed, or positively confirmed.
- Public response metadata was limited to `bookingRequest: { created: true, status: "needs_info" }`.
- No `booking_confirmed` conversion outcome was created.

The row status was `needs_info` because the exact smoke email uses the placeholder `example.com` domain, which the contact extractor intentionally suppresses. The row still captured the supported safe fields:

```json
{
  "source_channel": "public_chat",
  "display_mode": "page",
  "requested_service": "a dental cleaning",
  "requested_time_text": "Saturday at 10",
  "customer_name": "Anna Kovacs",
  "customer_email": null,
  "status": "needs_info",
  "status_reason": "Public chat request for staff review only.",
  "evidence": { "proof_source_type": "request_only" },
  "metadata": { "source": "public_chat", "intent_type": "booking_request" }
}
```

## Result Matrix

| Area | Result |
| --- | --- |
| Environment/target | Local Express app against configured Supabase target `wjrgzvprxkkgbjppxphk.supabase.co`. |
| Migration/cache | Passed. `agent_booking_requests` is visible through service-role OpenAPI and REST. |
| RLS/policy behavior | Passed by behavior. Owner authenticated select returned the owner row; a different authenticated user saw zero rows. |
| Service/internal insert | Passed. A prerequisite row was inserted and deleted. |
| Flag-on booking prompt | Passed. One row was created with safe acknowledgement and safe public metadata only. |
| Created booking request shape | Captured service `a dental cleaning`, time `Saturday at 10`, name `Anna Kovacs`, status `needs_info`, request-only evidence, and public-chat metadata. Placeholder `anna@example.com` was intentionally suppressed. |
| Owner API | Passed. Authenticated `GET /agents/booking-requests` returned the row; `POST /agents/booking-requests/status` updated it to `needs_staff_review` with staff notes. |
| Dashboard | Passed. Authenticated Playwright smoke showed `/dashboard` rendered the Booking requests card and row (`a dental cleaning`, `Saturday at 10`, `Anna Kovacs`) with zero console errors. The unrelated missing `public.agent_action_requests` target schema now degrades to an empty migration-required action-request payload instead of a dashboard resource error. |
| Safety prompts | Passed for booking requests. `Cancel my appointment` created `cancel_requested` without claiming cancellation. `Do you have availability Saturday?` created a request with `needs_info` and did not claim availability. Emergency, prompt-injection, and vague messages created no booking request and no `bookingRequest` metadata. |
| Default-off | Passed. With `BOOKING_REQUESTS_FROM_CHAT_ENABLED` unset, the same booking prompt created no booking request and no `bookingRequest` metadata. |
| Cleanup | Passed. Temporary booking requests, messages, widget config, website content, owner billing account, agent, business, auth users, and related smoke records were cleaned up to zero detected remnants. |
| Bug fixes | Four scoped fixes were made from smoke findings: inline name extraction stops before contact clauses, initial create statuses allow `cancel_requested`/`reschedule_requested`, blank action-request package filters no longer 400 the dashboard route, and missing action-request schema degrades after auth/access checks instead of causing dashboard console errors. |

## Cleanup Verification

Cleanup verification after the passed target rerun:

| Record type | Remaining smoke records |
| --- | ---: |
| `agent_booking_requests` for smoke agent/prefix | 0 |
| `messages` with smoke session prefix | 0 |
| `widget_configs` for smoke agent | 0 |
| `website_content` for smoke business | 0 |
| `owner_billing_accounts` for smoke owner | 0 |
| `agent_contact_leads` with smoke prefix/agent | 0 |
| `agent_follow_up_workflows` with smoke prefix/agent | 0 |
| `agent_action_queue_statuses` with smoke prefix/agent | 0 |
| `agents` with smoke client prefix | 0 |
| `businesses` with smoke website prefix | 0 |
| temporary auth users | 0 |

Extra prefix verification for `booking-phase7-%` also returned zero rows in `messages`, `agent_booking_requests`, `agent_contact_leads`, `agent_follow_up_workflows`, `agent_action_queue_statuses`, `businesses`, and `agents`.

## Safety Confirmation

Phase 7 did not add booking product capability beyond the already-scoped feature flag path. The smoke fixes aligned implementation with the documented Phase 6/7 contract.

Confirmed unchanged:

- Feature remains off by default unless `BOOKING_REQUESTS_FROM_CHAT_ENABLED` is explicitly enabled.
- No external booking, calendar, Calendly, PMS, CRM, payment, checkout, or provider integration was added.
- No live availability lookup was added.
- No confirmed booking behavior from chat was added.
- No cancellation or reschedule mutation from chat was added.
- No widget or embed behavior was changed.
- No package activation behavior was changed.

## Dashboard Note

The authenticated dashboard smoke proved the Booking requests card can display the live row with no console errors. This target still does not expose `public.agent_action_requests`, so the action-request list route returns an authenticated empty `migrationRequired` payload for that unrelated surface until `supabase/migrations/20260601185631_agent_action_requests.sql` is applied/exposed and PostgREST is reloaded.
