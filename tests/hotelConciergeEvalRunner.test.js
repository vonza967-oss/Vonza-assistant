import test from "node:test";
import assert from "node:assert/strict";

import {
  HOTEL_CONCIERGE_EVAL_SCENARIOS,
  HOTEL_CONCIERGE_EVAL_SOURCE,
} from "../src/services/evals/hotelConciergeEvalScenarios.js";
import {
  formatHotelConciergeEvalReport,
  runHotelConciergeEvaluation,
} from "../src/services/evals/hotelConciergeEvalRunner.js";

const totalTurns = HOTEL_CONCIERGE_EVAL_SCENARIOS.reduce(
  (sum, scenario) => sum + scenario.turns.length,
  0
);

test("Hotel Concierge eval dry run executes all scenarios without real side effects", async () => {
  const report = await runHotelConciergeEvaluation({
    mode: "dry-run",
    runId: "test-hotel-concierge-run",
  });

  assert.equal(report.mode, "dry-run");
  assert.equal(report.source, HOTEL_CONCIERGE_EVAL_SOURCE);
  assert.equal(report.scenarioCount, HOTEL_CONCIERGE_EVAL_SCENARIOS.length);
  assert.equal(report.summary.total, report.scenarioCount);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passRate, 100);
  assert.deepEqual(report.summary.failedScenarioIds, []);
  assert.equal(report.sideEffects.forbiddenDbWrites, 0);
  assert.deepEqual(report.sideEffects.forbiddenTables, {});
  assert.equal(report.sideEffects.billingEvents, 0);
  assert.equal(report.sideEffects.webCallSessions, 0);
  assert.equal(report.sideEffects.outboundMessages, 0);
  assert.equal(report.sideEffects.productEvents, 0);
  assert.equal(report.sideEffects.modelCalls, totalTurns);
  assert.ok(report.sideEffects.localMessagePersistenceAttempts > 0);
  assert.ok(report.sideEffects.leadCaptureEvaluations > 0);
  assert.ok(report.results.every((result) => !("sanitizedReplies" in result)));
  assert.ok(report.results.every((result) => Array.isArray(result.evidence) && result.evidence.length === result.turnCount));
  assert.ok(report.results.every((result) => result.evidence.every((entry) =>
    entry.confidence
      && entry.counts
      && Array.isArray(entry.items)
      && entry.items.every((item) =>
        Object.keys(item).sort().join(",") === "id,sourceType,trustLevel"
      )
      && !("content" in entry)
  )));
  assert.ok(report.sideEffects.storedMessageMetadata.every((entry) =>
    entry.conversationSource === HOTEL_CONCIERGE_EVAL_SOURCE
      && entry.displayMode === "page"
      && entry.webCallSessionIdPresent === false
      && !("content" in entry)
  ));
});

test("Hotel Concierge eval runner supports scoped dry runs and concise reporting", async () => {
  const report = await runHotelConciergeEvaluation({
    mode: "dry-run",
    runId: "test-hotel-concierge-scoped",
    scenarioIds: ["hotel-booking-change-handoff"],
    includeReplies: true,
  });
  const rendered = formatHotelConciergeEvalReport(report);

  assert.equal(report.scenarioCount, 1);
  assert.equal(report.results[0].turnCount, 1);
  assert.equal(report.sideEffects.modelCalls, 1);
  assert.ok(report.results[0].sanitizedReplies[0].includes("[phone]"));
  assert.doesNotMatch(report.results[0].sanitizedReplies[0], /206\s?555\s?0148/);
  assert.match(rendered, /Hotel Concierge eval summary/);
  assert.match(rendered, /Pass rate: 100\.0%/);
});

test("Hotel Concierge eval JSON report shape is stable", async () => {
  const report = await runHotelConciergeEvaluation({
    mode: "dry-run",
    runId: "test-hotel-concierge-json-shape",
    limit: 1,
  });
  const parsed = JSON.parse(JSON.stringify(report));

  assert.deepEqual(Object.keys(parsed).sort(), [
    "mode",
    "results",
    "runId",
    "scenarioCount",
    "sideEffects",
    "source",
    "summary",
  ].sort());
  assert.deepEqual(Object.keys(parsed.summary).sort(), [
    "failed",
    "failedScenarioIds",
    "failedScenarios",
    "failureReasons",
    "improvementNotes",
    "passRate",
    "passed",
    "total",
  ].sort());
  assert.deepEqual(Object.keys(parsed.sideEffects).sort(), [
    "billingEvents",
    "forbiddenDbWrites",
    "forbiddenTables",
    "leadCaptureEvaluations",
    "localMessagePersistenceAttempts",
    "modelCalls",
    "outboundMessages",
    "productEvents",
    "promptSnapshots",
    "resolvedPackages",
    "storedMessageMetadata",
    "webCallSessions",
  ].sort());
  assert.ok([
    "scenarioId",
    "categories",
    "passed",
    "score",
    "maxScore",
    "failedCriteria",
    "evidence",
    "criteria",
    "replyWordCounts",
    "turnCount",
    "notes",
    "title",
    "source",
    "mode",
  ].every((key) => Object.hasOwn(parsed.results[0], key)));
});

test("Hotel Concierge eval runner includes redacted Answer Contract metadata when enabled", async () => {
  const report = await runHotelConciergeEvaluation({
    mode: "dry-run",
    runId: "test-hotel-concierge-answer-contract",
    scenarioIds: ["hotel-booking-change-handoff"],
    includeReplies: true,
    answerContractMode: true,
  });
  const result = report.results[0];
  const serialized = JSON.stringify(report);

  assert.ok(Array.isArray(result.answerContract));
  assert.equal(result.answerContract.length, result.turnCount);
  assert.ok(result.answerContract.every((entry) =>
    entry.parseStatus === "parsed"
      && Number(entry.claimCount) >= 1
      && Array.isArray(entry.riskTypes)
      && Number(entry.evidenceIdCoverageCount) >= 1
      && Array.isArray(entry.invalidEvidenceIds)
      && Array.isArray(entry.warnings)
      && entry.needsHandoff === true
      && entry.claimVerifier?.status === "checked"
      && entry.claimVerifier.knowledgePolicy?.packageKey === "hotel_concierge"
      && Number(entry.claimVerifier.claimsChecked) >= 1
      && Number(entry.claimVerifier.policyCheckedClaims) >= 1
      && Array.isArray(entry.claimVerifier.results)
      && entry.claimVerifier.results.every((verifierResult) =>
        typeof verifierResult.riskType === "string"
          && typeof verifierResult.verdict === "string"
          && Number.isFinite(verifierResult.evidenceIdCount)
          && verifierResult.policyEvaluation?.mode === "report-only"
          && verifierResult.policyEvaluation?.packageKey === "hotel_concierge"
          && typeof verifierResult.policyEvaluation?.allowed === "boolean"
          && !("evidenceIds" in verifierResult)
      )
      && Array.isArray(entry.claims)
      && entry.claims.every((claim) => !/206\s?555\s?0148/.test(claim.text || ""))
  ));
  assert.match(serialized, /\[phone\]/);
  assert.doesNotMatch(serialized, /stay@auroraharbor\.example/i);
  assert.doesNotMatch(serialized, /206\s?555\s?0148/);
});

test("Hotel Concierge eval path resolves the synthetic hotel_concierge package", async () => {
  const report = await runHotelConciergeEvaluation({
    mode: "dry-run",
    runId: "test-hotel-concierge-package-resolution",
    limit: 2,
  });

  assert.equal(report.sideEffects.resolvedPackages.length, 2);
  assert.ok(report.sideEffects.resolvedPackages.every((entry) =>
    entry.agentPackageKey === "hotel_concierge"
      && entry.agentPackageVersion === "0.1.0"
      && entry.resolvedKey === "hotel_concierge"
      && entry.resolvedVersion === "0.1.0"
  ));
  assert.equal(report.sideEffects.promptSnapshots.length, 2);
  assert.ok(report.sideEffects.promptSnapshots.every((entry) =>
    entry.hasHotelPromptBlock === true
      && entry.hasPackageRiskRules === true
  ));
});
