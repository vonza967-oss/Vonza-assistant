import test from "node:test";
import assert from "node:assert/strict";

import {
  QUOTE_DESK_HU_AI_INTAKE_EVAL_SCENARIOS,
  QUOTE_DESK_HU_EVAL_SCENARIOS,
  QUOTE_DESK_HU_EVAL_SOURCE,
} from "../src/services/evals/quoteDeskHuEvalScenarios.js";
import {
  formatQuoteDeskHuEvalReport,
  runQuoteDeskHuEvaluation,
} from "../src/services/evals/quoteDeskHuEvalRunner.js";

test("Quote Desk HU eval dry run covers deterministic quote scenarios", async () => {
  const report = await runQuoteDeskHuEvaluation({
    mode: "dry-run",
    runId: "test-quote-desk-hu-run",
  });

  assert.equal(report.mode, "dry-run");
  assert.equal(report.source, QUOTE_DESK_HU_EVAL_SOURCE);
  assert.equal(
    report.scenarioCount,
    QUOTE_DESK_HU_EVAL_SCENARIOS.length + QUOTE_DESK_HU_AI_INTAKE_EVAL_SCENARIOS.length
  );
  assert.equal(report.summary.total, report.scenarioCount);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passRate, 100);
  assert.deepEqual(report.summary.failedScenarioIds, []);
  assert.ok(report.sideEffects.quoteCreateAttempts > 0);
  assert.ok(report.sideEffects.modelCalls > 0);
  assert.ok(report.results.some((result) => result.quoteRequest?.created === true));
  assert.ok(report.results.some((result) => result.quoteRequest === null));
  assert.ok(report.results.some((result) => result.source === "qdh_ai_intake"));
  assert.ok(report.results.some((result) => result.aiIntake?.readyToSubmit === true));
  assert.ok(report.results.some((result) => result.aiIntake?.safetyFlags?.pricingGuaranteeRequested === true));
});

test("Quote Desk HU eval runner supports scoped reporting", async () => {
  const report = await runQuoteDeskHuEvaluation({
    mode: "dry-run",
    runId: "test-quote-desk-hu-scoped",
    scenarioIds: ["hu-roof-quote-flag-on"],
  });
  const rendered = formatQuoteDeskHuEvalReport(report);

  assert.equal(report.scenarioCount, 1);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.sideEffects.modelCalls, 0);
  assert.equal(report.sideEffects.quoteCreateAttempts, 1);
  assert.match(rendered, /Quote Desk HU eval summary/);
  assert.match(rendered, /Pass rate: 100\.0%/);
});
