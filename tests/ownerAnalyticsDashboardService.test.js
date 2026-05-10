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
        id: "msg-a1",
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
    feedback: {
      records: [
        {
          id: "feedback-1",
          sessionKey: "s1",
          assistantMessageKey: "msg-a1",
          rating: "not_helpful",
          createdAt: "2026-05-10T08:01:00.000Z",
        },
        {
          id: "feedback-2",
          sessionKey: "s2",
          assistantMessageKey: "msg-a2",
          rating: "helpful",
          createdAt: "2026-05-10T09:01:00.000Z",
        },
      ],
      persistenceAvailable: true,
    },
    actionQueue: {
      items: [
        {
          key: "conversation:msg-a1",
          actionType: "knowledge_gap",
          question: "How much does a website cost?",
          reply: "Fixed pricing is not listed publicly.",
          whyFlagged: "Visitor marked the answer not helpful.",
          knowledgeFixSupported: true,
          knowledgeFix: {
            id: "knowledge-fix-1",
            status: "draft",
            targetLabel: "Advanced guidance / system prompt",
            issueSummary: "The answer did not give a clear quote path.",
            proposedGuidance: "If exact pricing is not listed, say that and direct visitors to the quote path.",
            occurrenceCount: 1,
            evidence: {
              question: "How much does a website cost?",
              currentResponse: "Fixed pricing is not listed publicly.",
            },
          },
        },
      ],
    },
  });

  assert.equal(dashboard.metrics.totalConversations, 2);
  assert.equal(dashboard.metrics.leadsCaptured, 1);
  assert.equal(dashboard.metrics.assistedConversions, 1);
  assert.equal(dashboard.metrics.conversionRate, 50);
  assert.equal(dashboard.metrics.missedQuestionCount, 1);
  assert.equal(dashboard.agent.vertical, "web_studio");
  assert.equal(dashboard.aiUsage.percentUsed, 25);
  assert.equal(dashboard.customerSatisfaction.totalFeedback, 2);
  assert.equal(dashboard.customerSatisfaction.notHelpful, 1);
  assert.equal(dashboard.customerSatisfaction.negativeRate, 50);
  assert.match(dashboard.customerSatisfaction.unhappyAnswers[0].question, /website cost/i);
  assert.ok(dashboard.customerSatisfaction.recoveryActions.some((action) => action.type === "fix_knowledge"));
  assert.equal(dashboard.knowledgeImprovement.total, 1);
  assert.equal(dashboard.knowledgeImprovement.openCount, 1);
  assert.equal(dashboard.knowledgeImprovement.items[0].status, "new");
  assert.equal(dashboard.knowledgeImprovement.items[0].knowledgeFixId, "knowledge-fix-1");
  assert.match(dashboard.knowledgeImprovement.items[0].suggestedFix, /quote path/i);
  assert.match(dashboard.knowledgeImprovement.guardrail, /avoid inventing business facts/i);
  assert.ok(dashboard.notifications.some((notification) => notification.type === "unhappy_customers"));
  assert.ok(dashboard.topVisitorQuestions.length >= 1);
  assert.match(dashboard.missedQuestions[0].question, /website cost/i);
});

test("owner analytics dashboard keeps sparse knowledge improvement state honest", () => {
  const dashboard = buildOwnerAnalyticsDashboard({
    agent: {
      id: "agent-1",
      name: "Front Desk",
    },
    messages: [],
    feedback: {
      records: [],
      persistenceAvailable: true,
    },
    actionQueue: {
      items: [],
      summary: {},
    },
  });

  assert.equal(dashboard.knowledgeImprovement.total, 0);
  assert.equal(dashboard.knowledgeImprovement.openCount, 0);
  assert.deepEqual(dashboard.knowledgeImprovement.items, []);
  assert.match(dashboard.knowledgeImprovement.copy, /No weak-answer pattern is active yet/i);
});
