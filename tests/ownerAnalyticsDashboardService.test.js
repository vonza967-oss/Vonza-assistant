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

test("owner analytics dashboard breaks assistant activity down by widget, page, Web Call, and legacy source", () => {
  const dashboard = buildOwnerAnalyticsDashboard({
    agent: {
      id: "agent-1",
      name: "Front Desk",
    },
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Widget question",
        sessionKey: "widget-session",
        displayMode: "widget",
        createdAt: "2026-05-13T08:00:00.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "Widget answer",
        sessionKey: "widget-session",
        displayMode: "widget",
        createdAt: "2026-05-13T08:00:02.000Z",
      },
      {
        id: "message-3",
        role: "user",
        content: "Page question",
        sessionKey: "page-session",
        displayMode: "page",
        createdAt: "2026-05-13T09:00:00.000Z",
      },
      {
        id: "message-4",
        role: "assistant",
        content: "Page answer",
        sessionKey: "page-session",
        displayMode: "page",
        createdAt: "2026-05-13T09:00:02.000Z",
      },
      {
        id: "message-5",
        role: "user",
        content: "Web Call question",
        sessionKey: "web-call-session",
        displayMode: "web_call",
        createdAt: "2026-05-13T09:30:00.000Z",
      },
      {
        id: "message-6",
        role: "assistant",
        content: "Web Call answer",
        sessionKey: "web-call-session",
        displayMode: "web_call",
        createdAt: "2026-05-13T09:30:02.000Z",
      },
      {
        id: "message-7",
        role: "user",
        content: "Legacy question",
        sessionKey: "legacy-session",
        displayMode: null,
        createdAt: "2026-05-13T10:00:00.000Z",
      },
    ],
    leadCaptures: {
      records: [
        {
          captureState: "captured",
          contactEmail: "page@example.com",
          visitorSessionKey: "page-session",
        },
        {
          captureState: "captured",
          contactEmail: "call@example.com",
          visitorSessionKey: "web-call-session",
        },
      ],
      persistenceAvailable: true,
    },
    actionQueue: {
      items: [],
      summary: {},
    },
  });

  assert.equal(dashboard.assistantSource.widget.conversationCount, 1);
  assert.equal(dashboard.assistantSource.widget.messageCount, 2);
  assert.equal(dashboard.assistantSource.widget.visitorQuestionCount, 1);
  assert.equal(dashboard.assistantSource.page.conversationCount, 1);
  assert.equal(dashboard.assistantSource.page.messageCount, 2);
  assert.equal(dashboard.assistantSource.page.visitorQuestionCount, 1);
  assert.equal(dashboard.assistantSource.page.leadsCaptured, 1);
  assert.equal(dashboard.assistantSource.web_call.label, "Web Call");
  assert.equal(dashboard.assistantSource.web_call.conversationCount, 1);
  assert.equal(dashboard.assistantSource.web_call.messageCount, 2);
  assert.equal(dashboard.assistantSource.web_call.visitorQuestionCount, 1);
  assert.equal(dashboard.assistantSource.web_call.leadsCaptured, 1);
  assert.equal(dashboard.assistantSource.unknown.conversationCount, 1);
  assert.equal(dashboard.assistantSource.unknown.messageCount, 1);
  assert.equal(dashboard.assistantSource.totalConversations, 4);
  assert.equal(dashboard.assistantSource.totalMessages, 7);
});

test("owner analytics dashboard exposes only safe Web Call health aggregates", () => {
  const dashboard = buildOwnerAnalyticsDashboard({
    agent: {
      id: "agent-1",
      name: "Front Desk",
    },
    messages: [],
    actionQueue: {
      items: [],
      summary: {},
    },
    webCallHealth: {
      starts: 2,
      endedCalls: 1,
      averageDurationSeconds: 62,
      averageTurns: 2,
      contactFallbackSubmissions: 1,
      failureCounts: {
        garbled_transcript: 1,
      },
      failureCategories: [
        {
          category: "garbled_transcript",
          label: "Garbled transcript",
          count: 1,
          rawProviderError: "provider error for lead@example.com",
        },
      ],
      failureTotal: 1,
      latestActivityAt: "2026-05-20T11:00:05.000Z",
      transcriptText: "I need a quote",
      assistantReplyText: "Sure, I can help.",
      contactEmail: "lead@example.com",
      speechToken: "token-123",
    },
  });

  assert.equal(dashboard.webCallHealth.starts, 2);
  assert.equal(dashboard.webCallHealth.endedCalls, 1);
  assert.equal(dashboard.webCallHealth.averageDurationSeconds, 62);
  assert.equal(dashboard.webCallHealth.averageTurns, 2);
  assert.equal(dashboard.webCallHealth.contactFallbackSubmissions, 1);
  assert.equal(dashboard.webCallHealth.failureCounts.garbled_transcript, 1);
  assert.equal(dashboard.webCallHealth.failureCategories[0].label, "Garbled Transcript");
  assert.equal(dashboard.webCallHealth.latestActivityAt, "2026-05-20T11:00:05.000Z");

  const serialized = JSON.stringify(dashboard.webCallHealth);
  assert.doesNotMatch(serialized, /I need a quote|Sure, I can help|lead@example\.com|token-123|provider error/i);
});

test("owner analytics dashboard aggregates recent Web Calls without cross-owner leakage", () => {
  const dashboard = buildOwnerAnalyticsDashboard({
    ownerUserId: "owner-1",
    agent: {
      id: "agent-1",
      name: "Front Desk",
    },
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Can you help with a quote?",
        sessionKey: "session-call-1",
        displayMode: "web_call",
        createdAt: "2026-05-20T10:00:12.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "I can help collect details.",
        sessionKey: "session-call-1",
        displayMode: "web_call",
        createdAt: "2026-05-20T10:00:14.000Z",
      },
      {
        id: "message-3",
        role: "user",
        content: "Other source",
        sessionKey: "session-widget",
        displayMode: "widget",
        createdAt: "2026-05-20T11:00:00.000Z",
      },
    ],
    leadCaptures: {
      records: [
        {
          id: "lead-1",
          ownerUserId: "owner-1",
          contactId: "contact-1",
          captureState: "captured",
          contactEmail: "caller@example.com",
          visitorSessionKey: "session-call-1",
          captureSource: "web_call",
          captureMetadata: {
            conversationSource: "web_call",
          },
        },
        {
          id: "lead-2",
          ownerUserId: "owner-2",
          contactId: "contact-2",
          captureState: "captured",
          contactEmail: "other-owner@example.com",
          visitorSessionKey: "session-call-2",
          captureSource: "web_call",
          captureMetadata: {
            conversationSource: "web_call",
          },
        },
      ],
    },
    webCallEvents: [
      {
        id: "event-1",
        owner_user_id: "owner-1",
        event_name: "web_call_started",
        created_at: "2026-05-20T10:00:00.000Z",
        metadata: {
          web_call_id: "call-1",
          transcript_text: "Can you help with a quote?",
        },
      },
      {
        id: "event-2",
        owner_user_id: "owner-1",
        event_name: "web_call_contact_opened",
        created_at: "2026-05-20T10:00:20.000Z",
        metadata: {
          web_call_id: "call-1",
        },
      },
      {
        id: "event-3",
        owner_user_id: "owner-1",
        event_name: "web_call_speech_failed",
        created_at: "2026-05-20T10:00:30.000Z",
        metadata: {
          web_call_id: "call-1",
          failure_category: "speech_failed",
          provider_error: "caller@example.com failed",
        },
      },
      {
        id: "event-4",
        owner_user_id: "owner-1",
        event_name: "web_call_ended",
        created_at: "2026-05-20T10:01:02.000Z",
        metadata: {
          web_call_id: "call-1",
          duration_seconds: 62,
          turn_count: 1,
          assistant_reply_text: "I can help collect details.",
        },
      },
      {
        id: "event-5",
        owner_user_id: "owner-2",
        event_name: "web_call_ended",
        created_at: "2026-05-20T12:01:02.000Z",
        metadata: {
          web_call_id: "call-other-owner",
          duration_seconds: 300,
          turn_count: 9,
        },
      },
    ],
    actionQueue: {
      items: [],
      summary: {},
    },
    actionStatuses: [
      {
        ownerUserId: "owner-1",
        actionKey: "web_call_review:call-1",
        status: "reviewed",
        followUpNeeded: true,
        note: "Owner marked this Web Call as needing follow-up.",
      },
      {
        ownerUserId: "owner-2",
        actionKey: "web_call_review:call-other-owner",
        status: "reviewed",
        followUpNeeded: true,
        note: "Cross-owner status should not appear.",
      },
    ],
  });

  assert.equal(dashboard.webCallRecentCalls.available, true);
  assert.equal(dashboard.webCallRecentCalls.calls.length, 1);
  assert.equal(dashboard.webCallRecentCalls.calls[0].webCallId, "call-1");
  assert.equal(dashboard.webCallRecentCalls.calls[0].conversationSource, "web_call");
  assert.equal(dashboard.webCallRecentCalls.calls[0].turnCount, 1);
  assert.equal(dashboard.webCallRecentCalls.calls[0].durationSeconds, 62);
  assert.equal(dashboard.webCallRecentCalls.calls[0].contactFallbackOpened, true);
  assert.equal(dashboard.webCallRecentCalls.calls[0].contactFallbackSubmitted, true);
  assert.equal(dashboard.webCallRecentCalls.calls[0].hadFailures, true);
  assert.deepEqual(dashboard.webCallRecentCalls.calls[0].failureCategories, ["speech_failed"]);
  assert.equal(dashboard.webCallRecentCalls.calls[0].actionKey, "web_call_review:call-1");
  assert.equal(dashboard.webCallRecentCalls.calls[0].review.status, "reviewed");
  assert.equal(dashboard.webCallRecentCalls.calls[0].review.followUpNeeded, true);
  assert.equal(dashboard.webCallRecentCalls.calls[0].latestQuestion, "Can you help with a quote?");
  assert.equal(dashboard.webCallRecentCalls.calls[0].latestAnswer, "I can help collect details.");
  assert.equal(dashboard.webCallRecentCalls.calls[0].messages.length, 2);
  assert.equal(dashboard.webCallRecentCalls.calls[0].action.contactId, "contact-1");

  const serialized = JSON.stringify(dashboard.webCallRecentCalls);
  assert.doesNotMatch(serialized, /caller@example\.com|provider_error|other-owner|call-other-owner|300|9|Cross-owner status/i);
});
