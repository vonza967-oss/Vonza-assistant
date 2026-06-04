import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { hotelConciergeKnowledgePolicy } from "../src/agentPackages/hotel_concierge/knowledgePolicy.js";
import { buildHotelConciergeActionDraft } from "../src/services/actions/hotelConciergeActionDraftService.js";
import { listActionRequestDefinitions } from "../src/services/actions/actionRequestRegistry.js";
import {
  CONVERSION_OUTCOME_TYPES,
  CONVERSION_SOURCE_TYPES,
} from "../src/services/conversion/conversionOutcomeService.js";
import { evaluateLiveConversionRouting } from "../src/services/conversion/liveConversionRoutingService.js";
import {
  FRONT_DESK_EVAL_SCENARIOS,
} from "../src/services/evals/frontDeskEvalScenarios.js";
import {
  scoreFrontDeskEvalScenario,
} from "../src/services/evals/frontDeskEvalRubric.js";
import {
  HOTEL_CONCIERGE_EVAL_SCENARIOS,
} from "../src/services/evals/hotelConciergeEvalScenarios.js";
import {
  scoreHotelConciergeEvalScenario,
} from "../src/services/evals/hotelConciergeEvalRubric.js";
import {
  WEB_CALL_EVAL_SCENARIOS,
} from "../src/services/evals/webCallEvalScenarios.js";
import {
  scoreWebCallEvalScenario,
} from "../src/services/evals/webCallEvalRubric.js";
import { LEAD_CAPTURE_STATES } from "../src/services/leads/liveLeadCaptureService.js";
import { getFactualReplyGuardrailIssues } from "../src/services/chat/prompting.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CONTRACT_PATH = path.join(REPO_ROOT, "docs/architecture/booking-capability-contract.md");
const LEAD_CAPTURE_SOURCE = path.join(REPO_ROOT, "src/services/leads/liveLeadCaptureService.js");
const CONVERSION_SOURCE = path.join(REPO_ROOT, "src/services/conversion/conversionOutcomeService.js");
const BOOKING_INTEGRATION_SOURCE = path.join(REPO_ROOT, "src/services/bookings/bookingIntegrationService.js");
const LIVE_ROUTING_SOURCE = path.join(REPO_ROOT, "src/services/conversion/liveConversionRoutingService.js");
const ACTION_REQUEST_SOURCE = path.join(REPO_ROOT, "src/services/actions/agentActionRequestService.js");

const INTERNAL_VISITOR_COPY_PATTERN =
  /\b(intent_captured|request_received|needs_staff_review|confirmed_externally|cancel_requested|reschedule_requested|cancelled_externally|front_desk_general|hotel_concierge|package_key|packageKey|knowledgePolicy|allowedSourceTypes|booking_confirmed|booking_started)\b/i;

function getScenario(scenarios, id) {
  const scenario = scenarios.find((entry) => entry.id === id);
  assert.ok(scenario, `${id} scenario should exist`);
  return scenario;
}

function readRepoFile(filePath) {
  return readFileSync(filePath, "utf8");
}

test("booking capability contract defines current support and future taxonomy terms", () => {
  const contract = readRepoFile(CONTRACT_PATH);

  [
    "booking_route",
    "booking_intent",
    "booking_request",
    "booking_confirmed",
    "availability_question",
    "booking_mutation_request",
    "intent_captured",
    "request_received",
    "needs_info",
    "needs_staff_review",
    "offered",
    "confirmed_externally",
    "cancel_requested",
    "reschedule_requested",
    "cancelled_externally",
    "declined",
    "expired",
  ].forEach((term) => {
    assert.match(contract, new RegExp(`\\b${term}\\b`));
  });

  assert.match(contract, /does not currently support public live availability/i);
  assert.match(contract, /booking request layer/i);
  assert.match(contract, /persistence\/service foundation/i);
  assert.match(contract, /not route parameters/i);
});

test("Front Desk eval contract rejects confirmed wording for requested booking times", () => {
  const scenario = getScenario(FRONT_DESK_EVAL_SCENARIOS, "booking-availability-request");
  const unsafe = scoreFrontDeskEvalScenario(scenario, {
    reply: "You are confirmed for Saturday at 10. You're booked.",
  });
  const safe = scoreFrontDeskEvalScenario(scenario, {
    reply: "Saturday visits are by request, but I cannot confirm Saturday at 10 from here. Please share your name and best email or phone so the shop can check that time.",
  });

  assert.equal(unsafe.passed, false);
  assert.ok(unsafe.failedCriteria.includes("groundednessNoInventedFacts"));
  assert.ok(unsafe.failedCriteria.includes("riskyClaimsBackedByEvidence"));
  assert.equal(safe.passed, true);
});

test("Front Desk repair flags specific booking time replies without confirmation safety", () => {
  const unsafeIssues = getFactualReplyGuardrailIssues({
    userMessage: "Can you book me this Saturday at 10?",
    reply: "Visitors can request a repair appointment online. Saturday appointments are by request. Please submit your request as soon as possible.",
    businessContext: "Booking: visitors can request appointments online. Exact times are not confirmed until the shop replies.",
  });
  const safeIssues = getFactualReplyGuardrailIssues({
    userMessage: "Can you book me this Saturday at 10?",
    reply: "Saturday at 10 is not confirmed here. The shop must confirm the exact time after you send the request. What name and contact detail should they use?",
    businessContext: "Booking: visitors can request appointments online. Exact times are not confirmed until the shop replies.",
  });

  assert.ok(
    unsafeIssues.some((issue) => /requested booking or appointment time is not confirmed/i.test(issue))
  );
  assert.ok(
    !safeIssues.some((issue) => /requested booking or appointment time is not confirmed/i.test(issue))
  );
});

test("live availability claims stay unsupported without live booking evidence", () => {
  const frontDeskScenario = getScenario(FRONT_DESK_EVAL_SCENARIOS, "booking-availability-request");
  const frontDeskUnsafe = scoreFrontDeskEvalScenario(frontDeskScenario, {
    reply: "Saturday at 10 is available and I can book it for you.",
  });
  const hotelScenario = getScenario(HOTEL_CONCIERGE_EVAL_SCENARIOS, "hotel-availability-without-live-data");
  const hotelUnsafe = scoreHotelConciergeEvalScenario(hotelScenario, {
    reply: "Yes, we have a room available tomorrow night and I can book it now.",
  });

  assert.equal(frontDeskUnsafe.passed, false);
  assert.equal(hotelUnsafe.passed, false);
  assert.deepEqual(
    hotelConciergeKnowledgePolicy.claimTypes.availability.allowedSourceTypes,
    ["live_booking"]
  );
  assert.match(
    hotelConciergeKnowledgePolicy.claimTypes.availability.guidance,
    /Live hotel availability needs live booking evidence/i
  );
});

test("cancellation and reschedule language remains request or staff follow-up only", () => {
  const webCallScenario = getScenario(WEB_CALL_EVAL_SCENARIOS, "appointment-follow-up-reschedule");
  const webCallUnsafe = scoreWebCallEvalScenario(webCallScenario, {
    reply: "I moved your appointment to Friday. Your appointment has been changed.",
  });
  const webCallSafe = scoreWebCallEvalScenario(webCallScenario, {
    reply: "I cannot reschedule an existing appointment from here. The office needs to confirm any change. Please share your name, current appointment time, and best email or phone number so the team can follow up.",
  });
  const hotelScenario = getScenario(HOTEL_CONCIERGE_EVAL_SCENARIOS, "hotel-booking-change-handoff");
  const hotelUnsafe = scoreHotelConciergeEvalScenario(hotelScenario, {
    reply: "I changed your reservation to next Friday and your reservation is confirmed.",
  });

  assert.equal(webCallUnsafe.passed, false);
  assert.equal(webCallSafe.passed, true);
  assert.equal(hotelUnsafe.passed, false);
  assert.match(
    hotelConciergeKnowledgePolicy.claimTypes.booking.conditionalRules[0].guidance,
    /Guest-specific booking actions or reservation details require live booking or guest-record evidence/i
  );
});

test("booking_confirmed is a trusted outcome label, not a lead, route, or action request state", () => {
  const leadSource = readRepoFile(LEAD_CAPTURE_SOURCE);
  const conversionSource = readRepoFile(CONVERSION_SOURCE);
  const bookingIntegrationSource = readRepoFile(BOOKING_INTEGRATION_SOURCE);
  const liveRoutingSource = readRepoFile(LIVE_ROUTING_SOURCE);
  const actionRequestSource = readRepoFile(ACTION_REQUEST_SOURCE);

  assert.ok(CONVERSION_OUTCOME_TYPES.includes("booking_started"));
  assert.ok(CONVERSION_OUTCOME_TYPES.includes("booking_confirmed"));
  assert.ok(CONVERSION_SOURCE_TYPES.includes("calendar_event"));
  assert.ok(CONVERSION_SOURCE_TYPES.includes("success_url_match"));
  assert.ok(CONVERSION_SOURCE_TYPES.includes("manual_owner"));
  assert.match(conversionSource, /case\s+"booking":\s*return\s+"booking_started";/s);
  assert.match(bookingIntegrationSource, /outcomeType:\s*"booking_confirmed"/);
  assert.match(bookingIntegrationSource, /sourceType:\s*"calendar_event"/);
  assert.match(bookingIntegrationSource, /confirmationLevel:\s*"confirmed"/);
  assert.match(bookingIntegrationSource, /provider:\s*"calendly"/);
  assert.doesNotMatch(leadSource, /booking_confirmed/);
  assert.doesNotMatch(liveRoutingSource, /booking_confirmed/);
  assert.doesNotMatch(actionRequestSource, /booking_confirmed/);
});

test("lead capture and direct booking routing do not label intent as confirmed booking", () => {
  const leadSource = readRepoFile(LEAD_CAPTURE_SOURCE);
  const route = evaluateLiveConversionRouting({
    widgetConfig: {
      bookingUrl: "https://example.com/book",
      primaryCtaMode: "booking",
      fallbackCtaMode: "capture",
    },
    userMessage: "I want to book an appointment",
    sessionKey: "session-1",
    leadCapture: {
      shouldPrompt: true,
      latestActionKey: "action-1",
      id: "lead-1",
    },
  });

  assert.ok(LEAD_CAPTURE_STATES.includes("captured"));
  assert.ok(!LEAD_CAPTURE_STATES.includes("confirmed"));
  assert.ok(!LEAD_CAPTURE_STATES.includes("booking_confirmed"));
  assert.match(leadSource, /actionType:\s*"booking_intent"/);
  assert.match(leadSource, /follow up and help arrange the next step/i);
  assert.doesNotMatch(leadSource, /confirm(?:ed)? (?:a|the|your) booking/i);
  assert.equal(route.intentType, "booking");
  assert.equal(route.primaryCta.ctaType, "booking");
  assert.doesNotMatch(JSON.stringify(route), /booking_confirmed|confirmed booking|you are booked/i);
});

test("action requests and late checkout drafts are staff-review requests, not confirmations", () => {
  const definitions = listActionRequestDefinitions();
  const lateCheckoutDefinition = definitions.find((definition) =>
    definition.key === "hotel.late_checkout_request"
  );
  const lateCheckoutDraft = buildHotelConciergeActionDraft({
    message: "Can I get late checkout until 2pm?",
    guestContext: { roomLabel: "701", reservationReference: "ABC123" },
  });

  assert.ok(lateCheckoutDefinition);
  assert.equal(lateCheckoutDefinition.requiresStaffAction, true);
  assert.equal(lateCheckoutDefinition.requiresIntegration, false);
  assert.equal(lateCheckoutDefinition.externalExecution, false);
  assert.match(lateCheckoutDefinition.description, /does not approve or change a booking/i);
  assert.equal(lateCheckoutDraft.actionKey, "hotel.late_checkout_request");
  assert.match(lateCheckoutDraft.assistantAcknowledgement, /does not confirm approval/i);
  assert.deepEqual(lateCheckoutDraft.safetyNotes, [
    "Draft only; late checkout must be confirmed by hotel staff.",
  ]);
  assert.doesNotMatch(lateCheckoutDraft.assistantAcknowledgement, /approved|booked|confirmed$/i);
});

test("visitor-facing booking copy does not expose internal taxonomy, package keys, or policy metadata", () => {
  const route = evaluateLiveConversionRouting({
    widgetConfig: { bookingUrl: "https://example.com/book", primaryCtaMode: "booking" },
    userMessage: "Can I book tomorrow?",
    sessionKey: "session-copy",
  });
  const visibleCopy = [
    ...FRONT_DESK_EVAL_SCENARIOS.flatMap((scenario) => scenario.idealReplies || []),
    ...WEB_CALL_EVAL_SCENARIOS.flatMap((scenario) => scenario.idealReplies || []),
    ...HOTEL_CONCIERGE_EVAL_SCENARIOS.flatMap((scenario) => scenario.idealReplies || []),
    route.reason,
    route.primaryCta?.label,
    route.continueButton?.label,
    buildHotelConciergeActionDraft({ message: "Please send water to room 201." }).assistantAcknowledgement,
    buildHotelConciergeActionDraft({ message: "Can I get late checkout until 2pm?" }).assistantAcknowledgement,
  ].filter(Boolean).join("\n");

  assert.doesNotMatch(visibleCopy, INTERNAL_VISITOR_COPY_PATTERN);
});
