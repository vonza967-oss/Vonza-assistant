import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerQuestionSummaries,
  buildAnalyticsSummary,
  createEmptyAnalyticsSummary,
  summarizeCustomerQuestionIntent,
} from "../src/services/analytics/analyticsSummaryService.js";

const VAGUE_SUMMARY_PATTERN =
  /general business questions|customer inquiry|asking questions|business information|service question/i;

test("analytics summary keeps live message, CTA, and contact counts aligned", () => {
  const summary = buildAnalyticsSummary({
    messages: [
      { role: "user", content: "How much does it cost?", createdAt: "2026-04-03T09:00:00.000Z" },
      { role: "assistant", content: "Pricing depends on scope.", createdAt: "2026-04-03T09:00:05.000Z" },
      { role: "user", content: "Can someone contact me?", createdAt: "2026-04-03T09:01:00.000Z" },
      { role: "assistant", content: "Yes, share the best email.", createdAt: "2026-04-03T09:01:05.000Z" },
    ],
    actionQueue: {
      items: [
        { actionType: "pricing_interest" },
        { actionType: "lead_follow_up", weakAnswer: true },
      ],
      summary: {
        attentionNeeded: 1,
      },
      conversionSummary: {
        highIntentConversations: 2,
        directCtasShown: 1,
        ctaClicks: 1,
        ctaClickThroughRate: 1,
        contactsCaptured: 1,
      },
      outcomeSummary: {
        assistedConversions: 1,
      },
    },
    widgetMetrics: {
      conversationsSinceInstall: 2,
    },
    installStatus: {
      state: "seen_recently",
    },
  });

  assert.equal(summary.totalMessages, 4);
  assert.equal(summary.conversationCount, 2);
  assert.equal(summary.visitorQuestions, 2);
  assert.equal(summary.highIntentSignals, 2);
  assert.equal(summary.directCtasShown, 1);
  assert.equal(summary.ctaClicks, 1);
  assert.equal(summary.ctaClickThroughRate, 1);
  assert.equal(summary.contactsCaptured, 1);
  assert.equal(summary.assistedOutcomes, 1);
  assert.equal(summary.weakAnswerCount, 1);
  assert.equal(summary.attentionNeeded, 1);
  assert.equal(summary.syncState, "ready");
  assert.match(summary.operatorSignal.copy, /high-intent customer signal/i);
  assert.ok(summary.customerQuestionSummaries.some((entry) => entry.summary === "Requesting pricing or quote details"));
  assert.ok(summary.customerQuestionSummaries.some((entry) => entry.summary === "Asking how to contact the business directly"));
});

test("analytics summary exposes pending sync instead of misleading zeros", () => {
  const summary = buildAnalyticsSummary({
    messages: [],
    actionQueue: {
      ...createEmptyAnalyticsSummary(),
    },
    widgetMetrics: {
      conversationsSinceInstall: 1,
      lastConversationAt: "2026-04-03T10:00:00.000Z",
    },
    installStatus: {
      state: "seen_recently",
      lastSeenAt: "2026-04-03T10:00:00.000Z",
    },
  });

  assert.equal(summary.totalMessages, 0);
  assert.equal(summary.visitorQuestions, 0);
  assert.equal(summary.conversationCount, 1);
  assert.equal(summary.syncState, "pending");
  assert.match(summary.recentActivity.description, /syncing/i);
});

test("customer question summaries avoid vague fallback labels", () => {
  const summaries = buildCustomerQuestionSummaries([
    { role: "user", content: "Can you help me choose the right option for my team?", createdAt: "2026-04-03T09:00:00.000Z" },
    { role: "user", content: "Do you have webshop setup options?", createdAt: "2026-04-03T09:05:00.000Z" },
    { role: "user", content: "How long does delivery usually take?", createdAt: "2026-04-03T09:10:00.000Z" },
  ]);

  assert.ok(summaries.length >= 3);
  assert.ok(summaries.some((entry) => entry.summary === "Trying to understand which service fits their needs"));
  assert.ok(summaries.some((entry) => entry.summary === "Asking about webshop options and next steps"));
  assert.ok(summaries.some((entry) => entry.summary === "Looking for delivery timing or service turnaround"));

  for (const entry of summaries) {
    assert.doesNotMatch(entry.summary, VAGUE_SUMMARY_PATTERN);
  }
});

test("customer question summaries do not copy raw chat text", () => {
  const rawQuestion = "Hey there, can you tell me the exact price for the premium window cleaning package next Thursday morning?";
  const summary = summarizeCustomerQuestionIntent(rawQuestion);

  assert.equal(summary, "Requesting pricing or quote details");
  assert.notEqual(summary, rawQuestion);
  assert.doesNotMatch(summary, /premium window cleaning package next Thursday morning/i);
  assert.doesNotMatch(summary, VAGUE_SUMMARY_PATTERN);
});

test("Hungarian customer questions keep useful Hungarian summaries", () => {
  assert.equal(
    summarizeCustomerQuestionIntent("Mennyibe kerul a webaruhaz keszitese?"),
    "Árakat vagy árajánlat részleteit kéri"
  );
  assert.equal(
    summarizeCustomerQuestionIntent("Van szabad idopont jovo hetre?"),
    "Időpontot vagy elérhetőséget keres"
  );
});

test("dashboard language controls dashboard-facing analytics summaries", () => {
  const english = buildAnalyticsSummary({
    dashboardLanguage: "en",
    messages: [
      { role: "user", content: "Mennyibe kerul a webaruhaz keszitese?", createdAt: "2026-04-03T09:00:00.000Z" },
    ],
  });
  const hungarian = buildAnalyticsSummary({
    dashboardLanguage: "hu",
    messages: [
      { role: "user", content: "How much does the webshop setup cost?", createdAt: "2026-04-03T09:00:00.000Z" },
    ],
  });

  assert.equal(english.customerQuestionSummaries[0].summary, "Requesting pricing or quote details");
  assert.equal(hungarian.customerQuestionSummaries[0].summary, "Árakat vagy árajánlat részleteit kéri");
});
