import test from "node:test";
import assert from "node:assert/strict";

import { parseAnswerContractOutput } from "../src/services/chat/answerContractService.js";
import {
  summarizeClaimVerifierForDebug,
  verifyClaimSupport,
} from "../src/services/chat/claimVerifierService.js";

function makeEvidencePack() {
  return {
    version: 1,
    confidence: "high",
    items: [
      {
        id: "approved_answer:pricing",
        sourceType: "approved_answer",
        trustLevel: "owner_approved",
      },
      {
        id: "business_profile:facts",
        sourceType: "business_profile",
        trustLevel: "reviewed_business_fact",
      },
      {
        id: "website:services",
        sourceType: "website",
        trustLevel: "retrieved_website",
      },
      {
        id: "keyword_fallback:context",
        sourceType: "keyword_fallback",
        trustLevel: "weak_fallback",
      },
    ],
  };
}

function makeContract(claims = []) {
  return {
    version: 1,
    parseStatus: "parsed",
    answer: "Visitor answer.",
    claims,
    confidence: "high",
    needsHandoff: false,
    warnings: [],
  };
}

test("Claim Verifier skips missing or fallback Answer Contracts", () => {
  const missingReport = verifyClaimSupport(null, makeEvidencePack());
  const fallbackReport = verifyClaimSupport({
    version: 1,
    parseStatus: "fallback",
    claims: [],
  }, makeEvidencePack());

  assert.equal(missingReport.status, "skipped");
  assert.equal(fallbackReport.status, "skipped");
  assert.deepEqual(missingReport.results, []);
  assert.ok(fallbackReport.warnings.includes("answer_contract_not_parsed"));
});

test("Claim Verifier supports risky claims with approved answer evidence", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "Tune-ups start at $85.",
      riskType: "pricing",
      confidence: "high",
      evidenceIds: ["approved_answer:pricing"],
    },
  ]), makeEvidencePack());

  assert.equal(report.status, "checked");
  assert.equal(report.results[0].verdict, "supported");
  assert.equal(report.supportedRiskyClaims, 1);
});

test("Claim Verifier supports risky claims with business profile evidence", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "The shop is open Tuesday through Friday.",
      riskType: "availability",
      confidence: "medium",
      evidenceIds: ["business_profile:facts"],
    },
  ]), makeEvidencePack());

  assert.equal(report.results[0].verdict, "supported");
  assert.equal(report.supportedRiskyClaims, 1);
});

test("Claim Verifier supports risky claims with website evidence", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "The shop offers brake adjustments.",
      riskType: "service",
      confidence: "high",
      evidenceIds: ["website:services"],
    },
  ]), makeEvidencePack());

  assert.equal(report.results[0].verdict, "supported");
  assert.equal(report.supportedRiskyClaims, 1);
});

test("Claim Verifier marks risky claims with no evidence unsupported", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "Appointments are guaranteed today.",
      riskType: "booking",
      confidence: "medium",
      evidenceIds: [],
    },
  ]), makeEvidencePack());

  assert.equal(report.results[0].verdict, "unsupported");
  assert.equal(report.unsupportedRiskyClaims, 1);
});

test("Claim Verifier marks invalid evidence IDs unknown_evidence", () => {
  const evidencePack = makeEvidencePack();
  const contract = parseAnswerContractOutput(JSON.stringify({
    version: 1,
    answer: "Use the listed phone number.",
    claims: [
      {
        text: "The shop has a listed phone number.",
        riskType: "contact",
        confidence: "high",
        evidenceIds: ["website:services", "website:missing"],
      },
    ],
    confidence: "high",
  }), { evidencePack });
  const report = verifyClaimSupport(contract, evidencePack);

  assert.equal(report.results[0].verdict, "unknown_evidence");
  assert.deepEqual(report.results[0].invalidEvidenceIds, ["website:missing"]);
  assert.equal(report.invalidEvidenceReferences, 1);
});

test("Claim Verifier marks risky claims with only keyword fallback low_confidence", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "The policy is listed in fallback text.",
      riskType: "policy",
      confidence: "medium",
      evidenceIds: ["keyword_fallback:context"],
    },
  ]), makeEvidencePack());

  assert.equal(report.results[0].verdict, "low_confidence");
  assert.equal(report.lowConfidenceClaims, 1);
});

test("Claim Verifier marks non-risky other claims not_risky", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "The answer uses a friendly greeting.",
      riskType: "other",
      confidence: "low",
      evidenceIds: [],
    },
  ]), makeEvidencePack());

  assert.equal(report.results[0].verdict, "not_risky");
  assert.equal(report.supportedRiskyClaims, 0);
  assert.equal(report.unsupportedRiskyClaims, 0);
});

test("Claim Verifier summary counts are stable and redacted", () => {
  const report = verifyClaimSupport(makeContract([
    {
      text: "Tune-ups start at $85.",
      riskType: "pricing",
      confidence: "high",
      evidenceIds: ["approved_answer:pricing"],
    },
    {
      text: "Guaranteed walk-ins are available.",
      riskType: "booking",
      confidence: "medium",
      evidenceIds: [],
    },
    {
      text: "Fallback-only policy detail.",
      riskType: "policy",
      confidence: "none",
      evidenceIds: ["keyword_fallback:context"],
    },
    {
      text: "Friendly wording.",
      riskType: "other",
      confidence: "low",
      evidenceIds: [],
    },
  ]), makeEvidencePack());
  const summary = summarizeClaimVerifierForDebug(report);

  assert.equal(summary.status, "checked");
  assert.equal(summary.claimsChecked, 4);
  assert.equal(summary.supportedRiskyClaims, 1);
  assert.equal(summary.unsupportedRiskyClaims, 1);
  assert.equal(summary.lowConfidenceClaims, 1);
  assert.deepEqual(summary.verdicts, {
    supported: 1,
    unsupported: 1,
    low_confidence: 1,
    not_risky: 1,
  });
  assert.equal("evidenceIds" in summary.results[0], false);
});
