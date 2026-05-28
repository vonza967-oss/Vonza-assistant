import test from "node:test";
import assert from "node:assert/strict";

import { normalizePublicConversationSource } from "../src/services/chat/chatService.js";
import {
  WEB_CALL_EVAL_CONVERSATION_SOURCE,
} from "../src/services/evals/webCallEvalScenarios.js";
import {
  formatWebCallEvalReport,
  runWebCallEvaluation,
} from "../src/services/evals/webCallEvalRunner.js";

test("web_call_eval is accepted only for the full-page Front Desk surface", () => {
  assert.equal(
    normalizePublicConversationSource("web_call_eval", { displayMode: "page" }),
    WEB_CALL_EVAL_CONVERSATION_SOURCE
  );
  assert.equal(
    normalizePublicConversationSource("web_call_eval", { displayMode: "widget" }),
    ""
  );
});

test("Web Call eval dry run executes all scenarios without real side effects", async () => {
  const report = await runWebCallEvaluation({
    mode: "dry-run",
    runId: "test-run",
  });

  assert.equal(report.mode, "dry-run");
  assert.equal(report.source, WEB_CALL_EVAL_CONVERSATION_SOURCE);
  assert.ok(report.scenarioCount >= 30);
  assert.ok(report.scenarioCount <= 50);
  assert.equal(report.summary.total, report.scenarioCount);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passRate, 100);
  assert.equal(report.sideEffects.forbiddenDbWrites, 0);
  assert.deepEqual(report.sideEffects.forbiddenTables, {});
  assert.equal(report.sideEffects.billingEvents, 0);
  assert.equal(report.sideEffects.webCallSessions, 0);
  assert.equal(report.sideEffects.outboundMessages, 0);
  assert.equal(report.sideEffects.productEvents, 0);
  assert.ok(report.sideEffects.localMessagePersistenceAttempts > 0);
  assert.ok(report.sideEffects.leadCaptureEvaluations > 0);
  assert.ok(report.results.every((result) => result.promptStyleApplied === true));
  assert.ok(report.results.every((result) => !("sanitizedReplies" in result)));
  assert.ok(report.sideEffects.storedMessageMetadata.every((entry) =>
    entry.conversationSource === WEB_CALL_EVAL_CONVERSATION_SOURCE
      && entry.displayMode === "page"
      && entry.webCallSessionIdPresent === false
      && !("content" in entry)
  ));
});

test("Web Call eval runner supports scoped dry runs and concise reporting", async () => {
  const report = await runWebCallEvaluation({
    mode: "dry-run",
    runId: "test-run-scoped",
    scenarioIds: ["multi-turn-price-clarification"],
  });
  const rendered = formatWebCallEvalReport(report);

  assert.equal(report.scenarioCount, 1);
  assert.equal(report.results[0].turnCount, 2);
  assert.equal(report.sideEffects.modelCalls, 2);
  assert.match(rendered, /Web Call eval summary/);
  assert.match(rendered, /Pass rate: 100\.0%/);
  assert.doesNotMatch(rendered, /For whitening/);
});
