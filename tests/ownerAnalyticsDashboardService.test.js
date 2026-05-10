import test from "node:test";
import assert from "node:assert/strict";

import { buildOwnerAnalyticsDashboard } from "../src/services/analytics/ownerAnalyticsDashboardService.js";

test("owner analytics dashboard aggregates conversations, leads, conversions, missed questions, and AI usage", () => {
  const dashboard = buildOwnerAnalyticsDashboard({
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Front Desk",
      vertical: "web_studio",
    },
    messages: [
      {
        role: "user",
        content: "How much does a website cost?",
        sessionKey: "s1",
        createdAt: "2026-05-10T08:00:00.000Z",
      },
      {
        role: "assistant",
        content: "Fixed pricing is not listed publicly.",
        sessionKey: "s1",
        createdAt: "2026-05-10T08:00:02.000Z",
      },
      {
        role: "user",
        content: "Can you build an ecommerce site?",
        sessionKey: "s2",
        createdAt: "2026-05-10T09:00:00.000Z",
      },
    ],
    leadCaptures: {
      records: [
        {
          captureState: "captured",
          contactEmail: "lead@example.com",
        },
      ],
      persistenceAvailable: true,
    },
    conversionOutcomes: {
      summary: {
        assistedConversions: 1,
      },
      recentOutcomes: [],
      persistenceAvailable: true,
    },
    widgetMetrics: {
      conversationStartedCount: 2,
      uniqueSessionCount: 2,
      ctaClicks: 1,
      ctaClickThroughRate: 0.5,
    },
    billingSnapshot: {
      planKey: "growth",
      displayName: "Growth",
      includedAiBudgetCents: 3000,
      usage: {
        usedCents: 750,
        includedCents: 3000,
        remainingCents: 2250,
        percentUsed: 25,
        statusLabel: "Within the included monthly capacity",
      },
    },
  });

  assert.equal(dashboard.metrics.totalConversations, 2);
  assert.equal(dashboard.metrics.leadsCaptured, 1);
  assert.equal(dashboard.metrics.assistedConversions, 1);
  assert.equal(dashboard.metrics.conversionRate, 50);
  assert.equal(dashboard.metrics.missedQuestionCount, 1);
  assert.equal(dashboard.agent.vertical, "web_studio");
  assert.equal(dashboard.aiUsage.percentUsed, 25);
  assert.ok(dashboard.topVisitorQuestions.length >= 1);
  assert.match(dashboard.missedQuestions[0].question, /website cost/i);
});
