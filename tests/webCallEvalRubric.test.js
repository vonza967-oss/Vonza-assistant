import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_CALL_EVAL_SCENARIOS,
} from "../src/services/evals/webCallEvalScenarios.js";
import {
  buildWebCallEvalTelemetryMetadata,
  sanitizeWebCallEvalNote,
  scoreWebCallEvalScenario,
} from "../src/services/evals/webCallEvalRubric.js";

function getScenario(id) {
  return WEB_CALL_EVAL_SCENARIOS.find((scenario) => scenario.id === id);
}

test("Web Call eval scenario pack has required coverage", () => {
  assert.ok(WEB_CALL_EVAL_SCENARIOS.length >= 30);
  assert.ok(WEB_CALL_EVAL_SCENARIOS.length <= 50);

  const categories = new Set(WEB_CALL_EVAL_SCENARIOS.flatMap((scenario) => scenario.categories));
  [
    "pricing",
    "booking_requests",
    "service_availability",
    "unclear_noisy_input",
    "angry_visitor",
    "competitor_comparison",
    "emergency_or_unsupported",
    "asks_for_owner_or_human",
    "lead_capture",
    "appointment_follow_up",
    "vague_first_message",
    "multi_turn_clarification",
  ].forEach((category) => {
    assert.ok(categories.has(category), `${category} should be covered`);
  });
});

test("rubric passes a grounded concise Web Call reply", () => {
  const scenario = getScenario("pricing-cleaning-starting-price");
  const result = scoreWebCallEvalScenario(scenario, {
    reply: "Adult cleanings start at $120. Final cost can change after the dentist's exam and insurance.\n\nWould you like to request an appointment?",
  });

  assert.equal(result.passed, true);
  assert.equal(result.score, result.maxScore);
  assert.deepEqual(result.failedCriteria, []);
});

test("rubric fails hallucinated services and missing handoff", () => {
  const scenario = getScenario("service-root-canal-unsupported");
  const result = scoreWebCallEvalScenario(scenario, {
    reply: "Yes, BrightSide can do a root canal today and the appointment is confirmed.",
  });

  assert.equal(result.passed, false);
  assert.ok(result.failedCriteria.includes("factualCorrectness"));
  assert.ok(result.failedCriteria.includes("safeHandoffEscalation"));
  assert.ok(result.failedCriteria.includes("noHallucinatedClaims"));
});

test("Web Call eval telemetry metadata does not retain transcript PII or secrets", () => {
  const result = {
    scenarioId: "lead-callback-request",
    categories: ["lead_capture"],
    passed: false,
    score: 5,
    maxScore: 8,
    failedCriteria: ["leadContactCapture"],
    notes: [
      "Raw visitor said email me at visitor@person.test or call +1 415 222 3322 with sk-secret1234567890.",
    ],
  };
  const metadata = buildWebCallEvalTelemetryMetadata(result, {
    mode: "dry-run",
    runId: "run-token-123456789",
  });
  const serialized = JSON.stringify(metadata);

  assert.equal(metadata.source, "web_call_eval");
  assert.equal(metadata.scenario_id, "lead-callback-request");
  assert.doesNotMatch(serialized, /visitor@person\.test/i);
  assert.doesNotMatch(serialized, /\+1 415 222 3322/);
  assert.doesNotMatch(serialized, /sk-secret1234567890/);
  assert.match(metadata.notes, /\[email\]/);
  assert.match(metadata.notes, /\[phone\]/);
  assert.match(sanitizeWebCallEvalNote("openai_api_key=sk-secret1234567890"), /openai_api_key=\[redacted\]/);
});
