import test from "node:test";
import assert from "node:assert/strict";

import { getAgentPackage } from "../src/agentPackages/index.js";
import {
  evaluateClaimEvidencePolicy,
  getAllowedEvidenceSourceTypes,
  normalizeKnowledgePolicy,
  summarizeKnowledgePolicyForDebug,
} from "../src/services/chat/knowledgePolicyService.js";

test("Front Desk policy allows current strong sources for risky claim types", () => {
  const agentPackage = getAgentPackage("front_desk_general");
  const expectedStrongSources = [
    "approved_answer",
    "business_profile",
    "website",
    "manual",
  ];

  for (const riskType of ["pricing", "contact", "service", "availability", "policy", "booking"]) {
    assert.deepEqual(
      getAllowedEvidenceSourceTypes(agentPackage, riskType),
      expectedStrongSources
    );
  }

  assert.equal(Object.isFrozen(agentPackage.knowledgePolicy), true);
  assert.equal(normalizeKnowledgePolicy(agentPackage).mode, "report-only");
});

test("Hotel availability requires future live booking evidence", () => {
  const evaluation = evaluateClaimEvidencePolicy({
    agentPackage: getAgentPackage("hotel_concierge"),
    claim: {
      text: "Rooms are available tonight.",
      riskType: "availability",
      evidenceIds: ["business_profile:facts", "manual:hotel"],
    },
    evidenceItems: [
      {
        id: "business_profile:facts",
        sourceType: "business_profile",
      },
      {
        id: "manual:hotel",
        sourceType: "manual",
      },
    ],
  });

  assert.equal(evaluation.status, "checked");
  assert.equal(evaluation.allowed, false);
  assert.deepEqual(evaluation.allowedSourceTypes, ["live_booking"]);
  assert.deepEqual(evaluation.matchedSourceTypes, ["business_profile", "manual"]);
  assert.ok(evaluation.notes.includes("source_type_not_allowed_by_package_policy"));
});

test("Hotel documented fee claims can use documented sources", () => {
  const evaluation = evaluateClaimEvidencePolicy({
    agentPackage: getAgentPackage("hotel_concierge"),
    claim: {
      text: "Valet parking is $32 per night.",
      riskType: "pricing",
      evidenceIds: ["website:parking"],
    },
    evidenceItems: [
      {
        id: "website:parking",
        sourceType: "website",
      },
    ],
  });

  assert.equal(evaluation.status, "checked");
  assert.equal(evaluation.allowed, true);
  assert.deepEqual(evaluation.allowedSourceTypes, [
    "approved_answer",
    "business_profile",
    "website",
    "manual",
  ]);
});

test("Hotel live room-rate claims require live booking source types", () => {
  const websiteEvaluation = evaluateClaimEvidencePolicy({
    agentPackage: getAgentPackage("hotel_concierge"),
    claim: {
      text: "The current room rate is $220 tonight.",
      riskType: "pricing",
      evidenceIds: ["website:rates"],
    },
    evidenceItems: [
      {
        id: "website:rates",
        sourceType: "website",
      },
    ],
  });
  const liveBookingEvaluation = evaluateClaimEvidencePolicy({
    agentPackage: getAgentPackage("hotel_concierge"),
    claim: {
      text: "The current room rate is $220 tonight.",
      riskType: "pricing",
      evidenceIds: ["live_booking:rates"],
    },
    evidenceItems: [
      {
        id: "live_booking:rates",
        sourceType: "live_booking",
      },
    ],
  });

  assert.equal(websiteEvaluation.allowed, false);
  assert.equal(websiteEvaluation.ruleKey, "live_room_rate");
  assert.deepEqual(websiteEvaluation.allowedSourceTypes, ["live_booking"]);
  assert.equal(liveBookingEvaluation.allowed, true);
});

test("Keyword fallback is not allowed as strong package policy support", () => {
  const evaluation = evaluateClaimEvidencePolicy({
    agentPackage: getAgentPackage("front_desk_general"),
    claim: {
      text: "The cancellation policy is listed in fallback text.",
      riskType: "policy",
      evidenceIds: ["keyword_fallback:context"],
    },
    evidenceItems: [
      {
        id: "keyword_fallback:context",
        sourceType: "keyword_fallback",
      },
    ],
  });

  assert.equal(evaluation.allowed, false);
  assert.deepEqual(evaluation.matchedSourceTypes, ["keyword_fallback"]);
  assert.ok(!evaluation.allowedSourceTypes.includes("keyword_fallback"));
});

test("Knowledge policy debug summary is safe metadata only", () => {
  const summary = summarizeKnowledgePolicyForDebug(getAgentPackage("hotel_concierge"));
  const serialized = JSON.stringify(summary);

  assert.equal(summary.packageKey, "hotel_concierge");
  assert.equal(summary.mode, "report-only");
  assert.deepEqual(summary.claimTypes.availability.allowedSourceTypes, ["live_booking"]);
  assert.ok(summary.claimTypes.pricing.conditionalRules.some((rule) =>
    rule.key === "live_room_rate"
  ));
  assert.doesNotMatch(serialized, /Aurora Harbor|parking is \$32|guest@example/i);
});
