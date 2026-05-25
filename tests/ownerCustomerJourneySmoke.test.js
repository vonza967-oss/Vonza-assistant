import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import cors from "cors";
import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { buildContactWorkspaceFromRecords } from "../src/services/operator/contactWorkspaceService.js";

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(createAgentRouter({
    limitWidgetBootstrap: (_req, _res, next) => next(),
    limitPublicInstallSignal: (_req, _res, next) => next(),
    limitAuthAdjacent: (_req, _res, next) => next(),
    limitInstallVerify: (_req, _res, next) => next(),
    ...deps,
  }));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner-token",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

function normalizeLead(record = {}) {
  return {
    ...record,
    contactName: String(record.contactName || "").trim(),
    contactEmail: String(record.contactEmail || "").trim().toLowerCase(),
    contactPhone: String(record.contactPhone || "").trim(),
    contactPhoneNormalized: String(record.contactPhoneNormalized || record.contactPhone || "").replace(/\D/g, ""),
    relatedActionKeys: Array.isArray(record.relatedActionKeys) ? record.relatedActionKeys : [],
  };
}

function createJourneyFixtures() {
  const agents = [
    {
      id: "agent-1",
      businessId: "business-1",
      ownerUserId: "owner-1",
      accessStatus: "active",
      name: "Front Desk",
      assistantName: "Vonza Front Desk",
      vertical: "home_services",
      widgetMetrics: {
        conversationStartedCount: 1,
        uniqueSessionCount: 1,
        ctaClicks: 1,
        ctaClickThroughRate: 1,
      },
      installStatus: { state: "seen_recently" },
    },
    {
      id: "agent-2",
      businessId: "business-2",
      ownerUserId: "owner-2",
      accessStatus: "active",
      name: "Other Front Desk",
      assistantName: "Other Front Desk",
      widgetMetrics: { conversationStartedCount: 99 },
    },
  ];
  const messages = [
    {
      id: "msg-1",
      agentId: "agent-1",
      ownerUserId: "owner-1",
      businessId: "business-1",
      role: "user",
      content: "Can I book a front desk demo? My email is CUSTOMER@EXAMPLE.COM",
      sessionKey: "page-session-1",
      visitorIdentityMode: "identified",
      visitorEmail: "CUSTOMER@EXAMPLE.COM",
      visitorName: " Taylor Customer ",
      displayMode: "page",
      createdAt: "2026-05-20T10:00:00.000Z",
    },
    {
      id: "msg-2",
      agentId: "agent-1",
      ownerUserId: "owner-1",
      businessId: "business-1",
      role: "assistant",
      content: "The website does not list live availability. Please contact the business directly.",
      sessionKey: "page-session-1",
      displayMode: "page",
      createdAt: "2026-05-20T10:00:03.000Z",
    },
    {
      id: "msg-cross-owner",
      agentId: "agent-2",
      ownerUserId: "owner-2",
      businessId: "business-2",
      role: "user",
      content: "Cross Owner Secret should never appear.",
      sessionKey: "other-session",
      visitorEmail: "intruder@example.com",
      displayMode: "page",
      createdAt: "2026-05-20T11:00:00.000Z",
    },
  ];
  const leadCaptures = [
    {
      id: "lead-1",
      agentId: "agent-1",
      businessId: "business-1",
      ownerUserId: "owner-1",
      leadKey: "email:customer@example.com",
      personKey: "person:email:customer@example.com",
      visitorSessionKey: "page-session-1",
      captureState: "captured",
      preferredChannel: "email",
      contactName: " Taylor Customer ",
      contactEmail: "CUSTOMER@EXAMPLE.COM",
      contactPhone: " (555) 101-2020 ",
      contactPhoneNormalized: "5551012020",
      sourcePageUrl: "https://example.test/front-desk",
      sourceOrigin: "https://example.test",
      latestIntentType: "booking",
      latestActionType: "booking_intent",
      latestActionKey: "operator:person:email:customer@example.com:booking_intent",
      latestMessageId: "msg-1",
      relatedActionKeys: [
        "conversation:msg-1",
        "operator:conversation:msg-1",
        "operator:person:email:customer@example.com:booking_intent",
      ],
      promptCount: 1,
      capturedAt: "2026-05-20T10:01:00.000Z",
      firstSeenAt: "2026-05-20T10:00:00.000Z",
      lastSeenAt: "2026-05-20T10:01:00.000Z",
      captureTrigger: "booking_intent",
      captureReason: "Visitor asked to book from the hosted Front Desk page.",
      captureSource: "hosted_front_desk",
      createdAt: "2026-05-20T10:00:10.000Z",
      updatedAt: "2026-05-20T10:01:00.000Z",
    },
    {
      id: "lead-cross-owner",
      agentId: "agent-2",
      businessId: "business-2",
      ownerUserId: "owner-2",
      visitorSessionKey: "other-session",
      captureState: "captured",
      contactEmail: "intruder@example.com",
      lastSeenAt: "2026-05-20T11:01:00.000Z",
    },
  ];
  const feedback = [
    {
      id: "feedback-1",
      agentId: "agent-1",
      ownerUserId: "owner-1",
      sessionKey: "page-session-1",
      assistantMessageKey: "msg-2",
      rating: "not_helpful",
      reason: "missing_business_fact",
      note: "Availability answer needs a better owner follow-up path.",
      displayMode: "page",
      sourceRoute: "hosted_front_desk",
      sourceType: "visitor_feedback",
      createdAt: "2026-05-20T10:02:00.000Z",
    },
    {
      id: "feedback-cross-owner",
      agentId: "agent-2",
      ownerUserId: "owner-2",
      sessionKey: "other-session",
      assistantMessageKey: "other-msg",
      rating: "not_helpful",
      note: "Cross owner feedback should never appear.",
      createdAt: "2026-05-20T11:02:00.000Z",
    },
  ];
  const conversionOutcomes = [
    {
      id: "outcome-1",
      agentId: "agent-1",
      ownerUserId: "owner-1",
      businessId: "business-1",
      outcomeType: "booking_requested",
      label: "Booking requested",
      sourceType: "hosted_front_desk",
      sourceLabel: "Front Desk page",
      attributionPath: "hosted_front_desk",
      leadId: "lead-1",
      actionKey: "operator:person:email:customer@example.com:booking_intent",
      personKey: "person:email:customer@example.com",
      sessionId: "page-session-1",
      pageUrl: "https://example.test/front-desk",
      relatedIntentType: "booking",
      occurredAt: "2026-05-20T10:03:00.000Z",
    },
    {
      id: "outcome-cross-owner",
      agentId: "agent-2",
      ownerUserId: "owner-2",
      outcomeType: "checkout_completed",
      label: "Cross Owner Secret Outcome",
      sessionId: "other-session",
      occurredAt: "2026-05-20T11:03:00.000Z",
    },
  ];
  const widgetEvents = [
    {
      id: "event-1",
      agentId: "agent-1",
      eventName: "cta_shown",
      sessionId: "page-session-1",
      pageUrl: "https://example.test/front-desk",
      metadata: {
        ctaType: "booking",
        targetType: "contact_capture",
        relatedIntentType: "booking",
        relatedActionKey: "operator:person:email:customer@example.com:booking_intent",
        relatedPersonKey: "person:email:customer@example.com",
        routingMode: "hosted_front_desk",
      },
      createdAt: "2026-05-20T10:00:05.000Z",
    },
    {
      id: "event-2",
      agentId: "agent-1",
      eventName: "cta_clicked",
      sessionId: "page-session-1",
      pageUrl: "https://example.test/front-desk",
      metadata: {
        ctaType: "booking",
        targetType: "contact_capture",
        relatedIntentType: "booking",
        relatedActionKey: "operator:person:email:customer@example.com:booking_intent",
        relatedPersonKey: "person:email:customer@example.com",
        routingMode: "hosted_front_desk",
      },
      createdAt: "2026-05-20T10:00:06.000Z",
    },
  ];

  return {
    agents,
    messages,
    leadCaptures,
    feedback,
    conversionOutcomes,
    widgetEvents,
  };
}

function createRouteDeps(overrides = {}) {
  const fixtures = createJourneyFixtures();
  const calls = {
    access: [],
    leads: [],
    statuses: [],
    outcomes: [],
    feedback: [],
  };
  const findAgent = (agentId) => fixtures.agents.find((agent) => agent.id === agentId) || null;
  const scopedMessages = (agentId) => fixtures.messages
    .filter((message) => message.agentId === agentId)
    .map(({ agentId: _agentId, ownerUserId: _ownerUserId, businessId: _businessId, ...message }) => message);
  const scopedLeads = ({ agentId, ownerUserId }) => fixtures.leadCaptures
    .filter((lead) => lead.agentId === agentId && lead.ownerUserId === ownerUserId)
    .map(normalizeLead);
  const scopedFeedback = ({ agentId, ownerUserId }) => fixtures.feedback
    .filter((record) => record.agentId === agentId && record.ownerUserId === ownerUserId);
  const scopedOutcomes = ({ agentId, ownerUserId }) => fixtures.conversionOutcomes
    .filter((record) => record.agentId === agentId && record.ownerUserId === ownerUserId);

  const deps = {
    getSupabaseClient: () => ({}),
    getOpenAIClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async (_supabase, options) => {
      calls.access.push({ ...options });
      const agent = findAgent(options.agentId);

      if (!agent || agent.ownerUserId !== options.ownerUserId || agent.accessStatus !== "active") {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }

      return agent;
    },
    getAgentWorkspaceSnapshot: async (_supabase, agentId) => findAgent(agentId),
    listAgents: async (_supabase, options = {}) => ({
      agents: fixtures.agents.filter((agent) => agent.ownerUserId === options.ownerUserId),
      bridgeAgent: null,
    }),
    listAgentMessages: async (_supabase, agentId) => scopedMessages(agentId),
    listActionQueueStatuses: async (_supabase, options = {}) => {
      calls.statuses.push({ ...options });
      return {
        records: [],
        persistenceAvailable: true,
      };
    },
    listLeadCaptures: async (_supabase, options = {}) => {
      calls.leads.push({ ...options });
      return {
        records: scopedLeads(options),
        persistenceAvailable: true,
      };
    },
    listConversionOutcomesForAgent: async (_supabase, options = {}) => {
      calls.outcomes.push({ ...options });
      const records = scopedOutcomes(options);
      return {
        records,
        summary: {
          total: records.length,
          assistedConversions: records.length,
          directOutcomeCount: records.length,
        },
        recentOutcomes: records,
        persistenceAvailable: true,
      };
    },
    listVisitorReplyFeedbackForOwner: async (_supabase, options = {}) => {
      calls.feedback.push({ ...options });
      const records = scopedFeedback(options);
      const helpful = records.filter((record) => record.rating === "helpful").length;
      const notHelpful = records.filter((record) => record.rating === "not_helpful").length;

      return {
        records,
        summary: {
          total: records.length,
          helpful,
          notHelpful,
          needsReview: notHelpful,
        },
        persistenceAvailable: true,
      };
    },
    listWidgetRoutingEventsByAgentId: async (_supabase, options = {}) =>
      fixtures.widgetEvents.filter((event) => event.agentId === options.agentId),
    getStoredWebsiteContent: async (_supabase, businessId) => ({
      businessId,
      content: "Hosted Front Desk demos are available after owner confirmation.",
    }),
    syncFollowUpWorkflows: async (_supabase, options = {}) => {
      const item = (options.queueItems || []).find((queueItem) => queueItem.followUpSupported);
      return {
        records: item ? [{
          id: "follow-up-1",
          status: "draft",
          sourceActionKey: item.key,
          linkedActionKeys: [item.key],
          contactName: "Taylor Customer",
          contactEmail: "customer@example.com",
          subject: "Front Desk demo follow-up",
          topic: "Booking request from hosted Front Desk",
          createdAt: "2026-05-20T10:02:30.000Z",
        }] : [],
        persistenceAvailable: true,
      };
    },
    syncKnowledgeFixWorkflows: async (_supabase, options = {}) => {
      const item = (options.queueItems || []).find((queueItem) => queueItem.knowledgeFixSupported);
      return {
        records: item ? [{
          id: "knowledge-fix-1",
          status: "draft",
          sourceActionKey: item.key,
          linkedActionKeys: [item.key],
          issueSummary: "Availability answer did not give a clear booking handoff.",
          proposedGuidance: "When availability is not listed, explain that the owner must confirm and capture booking contact details.",
          evidence: {
            question: item.question,
            currentResponse: item.reply,
          },
          createdAt: "2026-05-20T10:02:45.000Z",
        }] : [],
        persistenceAvailable: true,
      };
    },
    listHumanFollowUpStatusRows: async () => ({
      records: [],
      persistenceAvailable: true,
    }),
    buildHumanFollowUpWorkflow: (queue = {}) => ({
      items: [],
      topItems: [],
      summary: {
        total: 0,
        open: 0,
        highPriority: (queue.items || []).filter((item) => item.priority === "high").length,
      },
      persistenceAvailable: true,
    }),
    syncOwnerNotifications: async () => ({
      records: [],
      summary: { unread: 0, read: 0, dismissed: 0, active: 0, total: 0 },
      persistenceAvailable: true,
    }),
    getOwnerBillingSnapshot: async () => ({
      planKey: "growth",
      displayName: "Growth",
      includedAiBudgetCents: 3000,
      usage: {
        usedCents: 120,
        includedCents: 3000,
        remainingCents: 2880,
        percentUsed: 4,
        statusLabel: "Within the included monthly capacity",
      },
    }),
    getOperatorWorkspaceSnapshot: async (_supabase, { agent, ownerUserId }) => {
      const contacts = buildContactWorkspaceFromRecords({
        businessId: agent.businessId,
        leads: scopedLeads({ agentId: agent.id, ownerUserId }),
        messages: scopedMessages(agent.id),
        outcomes: scopedOutcomes({ agentId: agent.id, ownerUserId }),
        followUps: [{
          id: "follow-up-1",
          status: "draft",
          contactName: "Taylor Customer",
          contactEmail: "customer@example.com",
          personKey: "person:email:customer@example.com",
          linkedLeadIds: ["lead-1"],
          sourceActionKey: "operator:person:email:customer@example.com:booking_intent",
          subject: "Front Desk demo follow-up",
          createdAt: "2026-05-20T10:02:30.000Z",
        }],
      });

      return {
        enabled: true,
        featureEnabled: true,
        status: {
          enabled: true,
          featureEnabled: true,
        },
        contacts: {
          list: contacts.list,
          filters: contacts.filters,
          summary: contacts.summary,
          health: {
            persistenceAvailable: true,
            migrationRequired: false,
            loadError: "",
          },
        },
        inbox: { threads: [], attentionCount: 0 },
        calendar: { events: [], suggestedSlots: [] },
        automations: {
          tasks: [{
            id: "task-1",
            type: "customer_follow_up",
            title: "Review hosted Front Desk booking request",
            relatedLeadId: "lead-1",
          }],
          campaigns: [],
          followUps: [{ id: "follow-up-1", status: "draft" }],
        },
        summary: {
          contactsNeedingAttention: contacts.summary.contactsNeedingAttention,
        },
        nextAction: {
          key: "review_follow_up",
          title: "Review follow-up",
        },
      };
    },
    assertMessagesSchemaReady: async () => {},
    assertWidgetTelemetrySchemaReady: async () => {},
    assertLeadCaptureSchemaReady: async () => {},
    assertConversionOutcomeSchemaReady: async () => {},
    ...overrides,
  };

  return {
    deps,
    calls,
  };
}

function assertNoCrossOwnerLeak(payload) {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("Cross Owner Secret"), false);
  assert.equal(serialized.includes("intruder@example.com"), false);
  assert.equal(serialized.includes("owner-2"), false);
  assert.equal(serialized.includes("agent-2"), false);
  assert.equal(serialized.includes("business-2"), false);
}

test("owner dashboard aggregation keeps a hosted Front Desk customer journey owner-scoped", async () => {
  const harness = createRouteDeps();
  const server = await startServer(createApp(harness.deps));

  try {
    const workspace = await requestJson(server.baseUrl, "/agents/operator-workspace?agent_id=agent-1");
    const actionQueue = await requestJson(server.baseUrl, "/agents/action-queue?agent_id=agent-1");
    const analytics = await requestJson(server.baseUrl, "/dashboard/analytics/summary?agent_id=agent-1");

    assert.equal(workspace.status, 200);
    assert.equal(actionQueue.status, 200);
    assert.equal(analytics.status, 200);

    assert.ok(harness.calls.access.length >= 3);
    assert.ok(harness.calls.access.every((call) => call.agentId === "agent-1"));
    assert.ok(harness.calls.access.every((call) => call.ownerUserId === "owner-1"));
    assert.ok(harness.calls.leads.every((call) => call.agentId === "agent-1" && call.ownerUserId === "owner-1"));
    assert.ok(harness.calls.outcomes.every((call) => call.agentId === "agent-1" && call.ownerUserId === "owner-1"));
    assert.ok(harness.calls.feedback.every((call) => call.agentId === "agent-1" && call.ownerUserId === "owner-1"));

    assert.equal(workspace.json.contacts.summary.totalContacts, 1);
    assert.equal(workspace.json.contacts.summary.contactsNeedingAttention, 1);
    assert.equal(workspace.json.contacts.list[0].email, "customer@example.com");
    assert.equal(workspace.json.contacts.list[0].name, "Taylor Customer");
    assert.ok(workspace.json.contacts.list[0].sources.includes("chat"));
    assert.equal(workspace.json.contacts.list[0].counts.leads, 1);
    assert.equal(workspace.json.contacts.list[0].counts.messages, 2);
    assert.equal(workspace.json.contacts.list[0].leadId, "lead-1");
    assert.equal(Object.hasOwn(workspace.json.contacts.list[0], "ownerUserId"), false);

    const bookingItem = actionQueue.json.items.find((item) => item.actionType === "booking_intent");
    assert.ok(bookingItem);
    assert.equal(bookingItem.contactCaptured, true);
    assert.equal(bookingItem.contactInfo.email, "customer@example.com");
    assert.equal(bookingItem.leadCapture.contact.email, "customer@example.com");
    assert.equal(bookingItem.leadCapture.contact.name, "Taylor Customer");
    assert.equal(bookingItem.routing.offered, true);
    assert.equal(bookingItem.routing.clicked, true);
    assert.equal(actionQueue.json.conversionSummary.contactsCaptured, 1);
    assert.equal(actionQueue.json.conversionSummary.bookingCaptures, 1);
    assert.equal(actionQueue.json.recentLeadCaptures[0].contact.email, "customer@example.com");

    const weakAnswerItem = actionQueue.json.items.find((item) =>
      item.actionType === "knowledge_gap" && item.feedbackId === "feedback-1"
    );
    assert.ok(weakAnswerItem);
    assert.equal(weakAnswerItem.knowledgeFix.id, "knowledge-fix-1");
    assert.match(weakAnswerItem.question, /front desk demo/i);

    assert.equal(analytics.json.ok, true);
    assert.equal(analytics.json.agent.id, "agent-1");
    assert.equal(analytics.json.agent.businessId, "business-1");
    assert.equal(analytics.json.metrics.totalConversations, 1);
    assert.equal(analytics.json.metrics.leadsCaptured, 1);
    assert.equal(analytics.json.metrics.assistedConversions, 1);
    assert.equal(analytics.json.metrics.missedQuestionCount, 1);
    assert.equal(analytics.json.assistantSource.page.conversationCount, 1);
    assert.equal(analytics.json.assistantSource.page.messageCount, 2);
    assert.equal(analytics.json.assistantSource.page.visitorQuestionCount, 1);
    assert.equal(analytics.json.assistantSource.page.leadsCaptured, 1);
    assert.equal(analytics.json.customerSatisfaction.notHelpful, 1);
    assert.equal(analytics.json.knowledgeImprovement.total, 1);
    assert.match(analytics.json.missedQuestions[0].question, /book a front desk demo/i);
    assert.equal(analytics.json.leadCapture.records[0].contactEmail, "customer@example.com");
    assert.equal(analytics.json.conversions.summary.assistedConversions, 1);

    assertNoCrossOwnerLeak(workspace.json);
    assertNoCrossOwnerLeak(actionQueue.json);
    assertNoCrossOwnerLeak(analytics.json);
  } finally {
    await server.close();
  }
});

test("customer journey labels Web Call messages without changing normal hosted page source", () => {
  const workspace = buildContactWorkspaceFromRecords({
    businessId: "business-1",
    messages: [
      {
        id: "msg-page",
        role: "user",
        content: "Can I book?",
        sessionKey: "page-session",
        displayMode: "page",
        createdAt: "2026-05-20T10:00:00.000Z",
      },
      {
        id: "msg-call",
        role: "user",
        content: "Can I talk to someone?",
        sessionKey: "call-session",
        displayMode: "web_call",
        createdAt: "2026-05-20T10:05:00.000Z",
      },
    ],
    leads: [
      {
        id: "lead-call",
        visitorSessionKey: "lead-call-session",
        captureState: "captured",
        contactEmail: "caller@example.com",
        captureSource: "web_call",
        captureMetadata: {
          displayMode: "page",
          conversationSource: "web_call",
        },
        lastSeenAt: "2026-05-20T10:08:00.000Z",
      },
    ],
  });

  const pageContact = workspace.list.find((contact) => contact.latestMessageId === "msg-page");
  const webCallContact = workspace.list.find((contact) => contact.latestMessageId === "msg-call");
  const webCallLead = workspace.list.find((contact) => contact.email === "caller@example.com");

  assert.ok(pageContact);
  assert.ok(webCallContact);
  assert.ok(webCallLead);
  assert.ok(pageContact.sources.includes("full page assistant"));
  assert.ok(pageContact.sources.includes("chat"));
  assert.ok(webCallContact.sources.includes("web call"));
  assert.ok(webCallContact.sources.includes("chat"));
  assert.ok(webCallLead.sources.includes("web call"));
  assert.ok(webCallLead.sources.includes("chat"));
});

test("owner customer journey aggregation endpoints deny non-owner access before loading data", async () => {
  const requestedSnapshots = [];
  const authError = new Error("Authentication required");
  authError.statusCode = 401;
  const unauthorizedHarness = createRouteDeps({
    getAuthenticatedUser: async () => {
      throw authError;
    },
    getOperatorWorkspaceSnapshot: async () => {
      requestedSnapshots.push("operator");
      return {};
    },
    listAgentMessages: async () => {
      requestedSnapshots.push("messages");
      return [];
    },
  });
  const forbiddenHarness = createRouteDeps({
    getAuthenticatedUser: async () => ({ id: "owner-2", email: "other@example.com" }),
    getOperatorWorkspaceSnapshot: async () => {
      requestedSnapshots.push("operator");
      return {};
    },
    listAgentMessages: async () => {
      requestedSnapshots.push("messages");
      return [];
    },
  });
  const endpoints = [
    "/agents/operator-workspace?agent_id=agent-1",
    "/agents/action-queue?agent_id=agent-1",
    "/dashboard/analytics/summary?agent_id=agent-1",
  ];
  const unauthorizedServer = await startServer(createApp(unauthorizedHarness.deps));
  const forbiddenServer = await startServer(createApp(forbiddenHarness.deps));

  try {
    for (const endpoint of endpoints) {
      const response = await requestJson(unauthorizedServer.baseUrl, endpoint);
      assert.equal(response.status, 401);
      assert.equal(response.json.error, "Authentication required");
    }

    for (const endpoint of endpoints) {
      const response = await requestJson(forbiddenServer.baseUrl, endpoint);
      assert.equal(response.status, 403);
      assert.equal(response.json.error, "Forbidden");
    }

    assert.deepEqual(requestedSnapshots, []);
    assert.ok(forbiddenHarness.calls.access.every((call) => call.ownerUserId === "owner-2"));
  } finally {
    await unauthorizedServer.close();
    await forbiddenServer.close();
  }
});
