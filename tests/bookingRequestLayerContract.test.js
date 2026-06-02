import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const BOOKING_REQUEST_PLAN_PATH = path.join(
  REPO_ROOT,
  "docs/architecture/booking-request-layer-plan.md"
);
const BOOKING_CAPABILITY_CONTRACT_PATH = path.join(
  REPO_ROOT,
  "docs/architecture/booking-capability-contract.md"
);
const BOOKING_ENGINE_INSPECTION_PATH = path.join(
  REPO_ROOT,
  "docs/architecture/booking-engine-inspection.md"
);
const PRODUCT_RUNTIME_PLAN_PATH = path.join(
  REPO_ROOT,
  "docs/architecture/product-runtime-engine-plan.md"
);
const DELIVERY_SUMMARY_PATH = path.join(
  REPO_ROOT,
  "docs/architecture/agent-package-delivery-summary.md"
);
const LEAD_CAPTURE_SOURCE_PATH = path.join(
  REPO_ROOT,
  "src/services/leads/liveLeadCaptureService.js"
);
const ACTION_REQUEST_SOURCE_PATH = path.join(
  REPO_ROOT,
  "src/services/actions/agentActionRequestService.js"
);
const CONVERSION_OUTCOME_SOURCE_PATH = path.join(
  REPO_ROOT,
  "src/services/conversion/conversionOutcomeService.js"
);
const BOOKING_INTEGRATION_SOURCE_PATH = path.join(
  REPO_ROOT,
  "src/services/bookings/bookingIntegrationService.js"
);
const SCHEMA_PATH = path.join(REPO_ROOT, "db/schema.sql");

const REQUEST_LAYER_STATES = [
  "request_received",
  "needs_info",
  "needs_staff_review",
  "offered",
  "confirmed_externally",
  "declined",
  "cancel_requested",
  "reschedule_requested",
  "cancelled_externally",
  "expired",
];

function readRepoFile(filePath) {
  return readFileSync(filePath, "utf8");
}

function assertContainsAll(haystack, values) {
  values.forEach((value) => {
    assert.match(haystack, new RegExp(`\\b${value}\\b`), `${value} should be documented`);
  });
}

test("booking request layer plan is documented as request-only and non-runtime", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);

  assert.match(plan, /request-only/i);
  assert.match(plan, /staff-reviewable/i);
  assert.match(plan, /Phase 3 adds the persistence and service foundation/i);
  assert.match(plan, /Phase 5 adds a compact authenticated dashboard review surface/i);
  assert.match(plan, /dashboard UI is authenticated owner review only/i);
  assert.match(plan, /Phase 6 adds feature-flagged public chat request creation only/i);
  assert.match(plan, /BOOKING_REQUESTS_FROM_CHAT_ENABLED/i);
  assert.match(plan, /off by default/i);
  assert.match(plan, /does not add schema or migration changes/i);
  assert.match(plan, /No confirmed booking/i);
  assert.match(plan, /No public live availability lookup/i);
  assert.match(plan, /No slot holding/i);
  assert.match(plan, /No chat-driven cancellation or rescheduling/i);
  assert.match(plan, /No direct Google Calendar, Calendly, PMS, CRM, payment, checkout, rate, guest-record, or provider mutation/i);
});

test("booking request plan defines object fields and schema stays request-only", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);
  const schema = readRepoFile(SCHEMA_PATH);

  assertContainsAll(plan, [
    "owner_user_id",
    "agent_id",
    "business_id",
    "visitor_session_key",
    "source_message_id",
    "source_channel",
    "display_mode",
    "requested_service",
    "requested_time_text",
    "requested_time_window_start",
    "requested_time_window_end",
    "timezone",
    "customer_name",
    "customer_email",
    "customer_phone",
    "status",
    "status_reason",
    "staff_notes",
    "evidence",
    "created_at",
    "updated_at",
    "expires_at",
    "idempotency_key",
  ]);
  assert.match(plan, /idempotency/i);
  assert.match(plan, /dedupe/i);
  assert.match(schema, /create table if not exists public\.agent_booking_requests/i);
  assert.match(schema, /status text not null default 'request_received'/i);
  assert.doesNotMatch(schema, /create table if not exists public\.booking_requests/i);
  assert.doesNotMatch(schema, /create table if not exists public\.confirmed_bookings/i);
});

test("booking request lifecycle includes proof-required states and safe transitions", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);
  const capabilityContract = readRepoFile(BOOKING_CAPABILITY_CONTRACT_PATH);

  assertContainsAll(plan, REQUEST_LAYER_STATES);
  assertContainsAll(capabilityContract, REQUEST_LAYER_STATES);
  assert.match(plan, /confirmed_externally.+Yes.+Yes/s);
  assert.match(plan, /cancelled_externally.+Yes.+Yes/s);
  assert.match(plan, /offered.+Yes, for the offered option source/s);
  assert.match(plan, /request_received.+confirmed_externally.+without trusted external\/provider or verified operator proof/s);
  assert.match(plan, /cancel_requested.+cancelled_externally.+without trusted external\/provider or verified operator proof/s);
  assert.match(plan, /reschedule_requested.+confirmed_externally.+without trusted external\/provider or verified operator proof/s);
});

test("future chat and staff contracts do not allow unproved booking mutation or confirmation", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);

  assert.match(plan, /Booking request creation can acknowledge only that a request was received or sent to staff/i);
  assert.match(plan, /must never say "confirmed", "booked", "reserved", or "scheduled" unless trusted external\/operator proof exists/i);
  assert.match(plan, /Availability questions become requests or routes, not live answers/i);
  assert.match(plan, /Cancellation and reschedule requests become staff-review requests/i);
  assert.match(plan, /The chat producer calls only `createAgentBookingRequest\(\)`/i);
  assert.match(plan, /It does not call calendar, Calendly, PMS, CRM, provider, checkout, payment, or live availability functions/i);
  assert.match(plan, /does not create `booking_confirmed` outcomes/i);
  assert.match(plan, /ask for the minimum missing details: name, contact, preferred time, requested service, timezone, or existing booking reference/i);
  assert.match(plan, /Owner-scoped list/i);
  assert.match(plan, /Status update controls/i);
  assert.match(plan, /Staff notes/i);
  assert.match(plan, /Link to related lead\/contact, conversation\/source message, and conversion outcome\/proof/i);
  assert.match(plan, /No direct calendar mutation in v1/i);
  assert.match(plan, /No customer-visible confirmed state unless/i);
});

test("leads and action requests are not confirmed booking records in source", () => {
  const leadCaptureSource = readRepoFile(LEAD_CAPTURE_SOURCE_PATH);
  const actionRequestSource = readRepoFile(ACTION_REQUEST_SOURCE_PATH);

  assert.match(leadCaptureSource, /"booking_intent"/);
  assert.doesNotMatch(leadCaptureSource, /booking_confirmed/);
  assert.doesNotMatch(leadCaptureSource, /\bconfirmed_externally\b/);
  assert.doesNotMatch(leadCaptureSource, /\bcancelled_externally\b/);
  assert.match(actionRequestSource, /new", "accepted", "done", "dismissed/);
  assert.doesNotMatch(actionRequestSource, /booking_confirmed/);
  assert.doesNotMatch(actionRequestSource, /\bconfirmed_externally\b/);
  assert.doesNotMatch(actionRequestSource, /\bcancelled_externally\b/);
});

test("trusted confirmation remains tied to existing outcome proof paths", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);
  const conversionSource = readRepoFile(CONVERSION_OUTCOME_SOURCE_PATH);
  const bookingIntegrationSource = readRepoFile(BOOKING_INTEGRATION_SOURCE_PATH);

  assert.match(plan, /signed, fresh, active, owner-scoped Calendly `invitee\.created` webhook/i);
  assert.match(plan, /configured success URL proof/i);
  assert.match(plan, /verified operator\/owner calendar outcome/i);
  assert.match(conversionSource, /"success_url_match"/);
  assert.match(conversionSource, /"manual_owner"/);
  assert.match(conversionSource, /"calendar_event"/);
  assert.match(bookingIntegrationSource, /parsedEvent\.eventType !== "invitee\.created"/);
  assert.match(bookingIntegrationSource, /outcomeType:\s*"booking_confirmed"/);
  assert.match(bookingIntegrationSource, /sourceType:\s*"calendar_event"/);
  assert.match(bookingIntegrationSource, /confirmationLevel:\s*"confirmed"/);
  assert.match(bookingIntegrationSource, /provider:\s*"calendly"/);
});

test("architecture docs do not claim live booking exists today", () => {
  const docs = [
    BOOKING_REQUEST_PLAN_PATH,
    BOOKING_CAPABILITY_CONTRACT_PATH,
    BOOKING_ENGINE_INSPECTION_PATH,
    PRODUCT_RUNTIME_PLAN_PATH,
    DELIVERY_SUMMARY_PATH,
  ].map(readRepoFile).join("\n");

  assert.match(docs, /does not currently support public live availability/i);
  assert.match(docs, /feature-flagged request-only chat booking requests/i);
  assert.match(docs, /does not currently support public live availability, slot holds, confirmed bookings, cancellation mutation, or reschedule mutation from chat/i);
  assert.match(docs, /does not create, cancel, or reschedule Calendly events/i);
  assert.match(docs, /No direct calendar mutation in v1/i);
  assert.match(docs, /Phase 7 .*passed after `public\.agent_booking_requests` was applied and exposed through the configured Supabase target's PostgREST schema cache/i);
  assert.doesNotMatch(docs, /blocked on the configured Supabase target until `public\.agent_booking_requests`/i);
  assert.doesNotMatch(docs, /there is no generic booking engine schema/i);
  assert.doesNotMatch(docs, /booking_request` is a future request\/review layer/i);
  assert.doesNotMatch(docs, /Vonza currently supports public live availability/i);
  assert.doesNotMatch(docs, /Vonza has a generic public booking engine/i);
  assert.doesNotMatch(docs, /chat can confirm bookings/i);
  assert.doesNotMatch(docs, /slot holds are implemented/i);
});

test("future eval gates cover request, availability, mutation, trust, malicious, and Hungarian scenarios", () => {
  const plan = readRepoFile(BOOKING_REQUEST_PLAN_PATH);

  [
    "Book tomorrow at 10.",
    "Are you available Saturday?",
    "Cancel my appointment.",
    "Reschedule my appointment.",
    "Missing phone/email",
    "No configured booking URL",
    "Configured Calendly URL",
    "Trusted Calendly confirmation",
    "Malicious prompt trying to force confirmation",
    "Multilingual Hungarian booking request",
  ].forEach((scenario) => {
    assert.match(plan, new RegExp(scenario.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
