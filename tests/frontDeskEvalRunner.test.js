import test from "node:test";
import assert from "node:assert/strict";

import {
  FRONT_DESK_EVAL_SCENARIOS,
  FRONT_DESK_EVAL_SOURCE,
} from "../src/services/evals/frontDeskEvalScenarios.js";
import {
  formatFrontDeskEvalReport,
  runFrontDeskEvaluation,
} from "../src/services/evals/frontDeskEvalRunner.js";

test("Front Desk eval dry run executes all scenarios without real side effects", async () => {
  const report = await runFrontDeskEvaluation({
    mode: "dry-run",
    runId: "test-front-desk-run",
  });

  assert.equal(report.mode, "dry-run");
  assert.equal(report.source, FRONT_DESK_EVAL_SOURCE);
  assert.equal(report.scenarioCount, FRONT_DESK_EVAL_SCENARIOS.length);
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
  assert.equal(
    report.sideEffects.modelCalls,
    FRONT_DESK_EVAL_SCENARIOS.reduce((sum, scenario) => sum + scenario.turns.length, 0)
  );
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
    entry.conversationSource === FRONT_DESK_EVAL_SOURCE
      && entry.displayMode === "page"
      && entry.webCallSessionIdPresent === false
      && !("content" in entry)
  ));
});

test("Front Desk eval runner supports scoped dry runs and concise reporting", async () => {
  const report = await runFrontDeskEvaluation({
    mode: "dry-run",
    runId: "test-front-desk-scoped",
    scenarioIds: ["contact-known-details"],
    includeReplies: true,
  });
  const rendered = formatFrontDeskEvalReport(report);

  assert.equal(report.scenarioCount, 1);
  assert.equal(report.results[0].turnCount, 1);
  assert.equal(report.sideEffects.modelCalls, 1);
  assert.ok(report.results[0].sanitizedReplies[0].includes("[email]"));
  assert.ok(report.results[0].sanitizedReplies[0].includes("[phone]"));
  assert.match(rendered, /Front Desk eval summary/);
  assert.match(rendered, /Pass rate: 100\.0%/);
});

test("Front Desk eval JSON report shape is stable", async () => {
  const report = await runFrontDeskEvaluation({
    mode: "dry-run",
    runId: "test-front-desk-json-shape",
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

test("Front Desk eval runner includes redacted Answer Contract metadata when enabled", async () => {
  const report = await runFrontDeskEvaluation({
    mode: "dry-run",
    runId: "test-front-desk-answer-contract",
    limit: 1,
    answerContractMode: true,
  });
  const result = report.results[0];

  assert.ok(Array.isArray(result.answerContract));
  assert.equal(result.answerContract.length, result.turnCount);
  assert.ok(result.answerContract.every((entry) =>
    entry.parseStatus === "parsed"
      && Number(entry.claimCount) >= 1
      && Array.isArray(entry.riskTypes)
      && Number(entry.evidenceIdCoverageCount) >= 1
      && Array.isArray(entry.invalidEvidenceIds)
      && Array.isArray(entry.warnings)
      && entry.claimVerifier?.status === "checked"
      && Number(entry.claimVerifier.claimsChecked) >= 1
      && Array.isArray(entry.claimVerifier.results)
      && entry.claimVerifier.results.every((verifierResult) =>
        typeof verifierResult.riskType === "string"
          && typeof verifierResult.verdict === "string"
          && Number.isFinite(verifierResult.evidenceIdCount)
          && !("evidenceIds" in verifierResult)
      )
      && !("claims" in entry)
  ));
});
