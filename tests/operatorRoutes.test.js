import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import cors from "cors";
import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(createAgentRouter(deps));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

function buildRouteDeps(overrides = {}) {
  return {
    getSupabaseClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async () => ({
      id: "agent-1",
      businessId: "business-1",
    }),
    getAgentWorkspaceSnapshot: async () => ({
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Operator",
      assistantName: "Vonza Operator",
    }),
    createGoogleConnectionStart: async () => ({
      ok: true,
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
    }),
    completeGoogleConnection: async () => ({
      redirectUrl: "/dashboard?google=connected",
    }),
    getOperatorWorkspaceSnapshot: async () => ({
      enabled: true,
      featureEnabled: true,
      status: {
        enabled: true,
        featureEnabled: true,
        googleConnected: true,
      },
      activation: {
        checklist: [{ key: "connect_google", complete: true }],
      },
      connectedAccounts: [{ status: "connected", accountEmail: "owner@example.com" }],
      inbox: { threads: [{ id: "thread-1" }], attentionCount: 1 },
      calendar: { events: [{ id: "event-1" }], suggestedSlots: [], dailySummary: "Busy day." },
      automations: { tasks: [{ id: "task-1" }], campaigns: [], followUps: [] },
      contacts: {
        list: [{ id: "contact-1", name: "Taylor Reed" }],
        filters: { quick: [{ key: "all", label: "All", count: 1 }], sources: [] },
        summary: { totalContacts: 1, contactsNeedingAttention: 1 },
        health: { persistenceAvailable: true, migrationRequired: false, loadError: "" },
      },
      summary: { inboxNeedingAttention: 1 },
      briefing: { text: "Review today." },
      nextAction: { key: "review_inbox", title: "Review inbox" },
      businessProfile: {
        id: "profile-1",
        businessSummary: "Emergency plumbing and installs.",
        readiness: {
          totalSections: 8,
          completedSections: 6,
          missingCount: 2,
          missingSections: ["Policies", "Operating hours"],
          summary: "6 of 8 business context areas are filled. Missing: Policies, Operating hours.",
        },
      },
    }),
    getOperatorBusinessProfile: async () => ({
      id: "profile-1",
      businessSummary: "Emergency plumbing and installs.",
      services: [{ name: "Emergency plumbing" }],
      pricing: [{ label: "Diagnostics", amount: "$149" }],
      approvedContactChannels: ["website_chat", "email"],
      approvalPreferences: {
        followUpDrafts: "owner_required",
        contactNextSteps: "owner_required",
      },
      readiness: {
        totalSections: 8,
        completedSections: 6,
        missingCount: 2,
        missingSections: ["Policies", "Operating hours"],
        summary: "6 of 8 business context areas are filled. Missing: Policies, Operating hours.",
      },
    }),
    upsertOperatorBusinessProfile: async (_supabase, { profile }) => ({
      id: "profile-1",
      ...profile,
      readiness: {
        totalSections: 8,
        completedSections: 8,
        missingCount: 0,
        missingSections: [],
        summary: "All core business context areas are filled for Vonza.",
      },
    }),
    getStoredWebsiteContent: async () => ({
      businessId: "business-1",
      content: "Emergency plumbing\nPricing starts at $149\nMon-Fri | 9am-5pm",
    }),
    draftInboxReply: async () => ({
      draft: { id: "draft-1", subject: "Re: Hello" },
    }),
    sendInboxReply: async () => ({
      message: { id: "sent-1" },
    }),
    draftCalendarAction: async () => ({
      event: { id: "draft-event-1", approvalStatus: "pending_owner" },
    }),
    approveCalendarAction: async () => ({
      event: { id: "event-1", approvalStatus: "approved" },
    }),
    resolveCalendarAppointmentReview: async (_supabase, payload) => ({
      ok: true,
      resolution: payload.resolution,
      event: { id: payload.eventId },
    }),
    createCampaignDraft: async () => ({
      id: "campaign-1",
      steps: [{ id: "step-1" }],
      recipients: [{ id: "recipient-1" }],
    }),
    approveCampaignDraft: async () => ({
      id: "campaign-1",
      status: "active",
      recipients: [{ id: "recipient-1", nextSendAt: "2026-04-06T10:00:00.000Z" }],
    }),
    sendDueCampaignSteps: async () => ({
      campaignId: "campaign-1",
      sentRecipients: [{ id: "recipient-1" }],
    }),
    updateOperatorTaskStatus: async () => ({
      id: "task-1",
      status: "resolved",
    }),
    createManualFollowUpWorkflow: async () => ({
      followUp: { id: "follow-up-1", status: "draft" },
      persistenceAvailable: true,
    }),
    updateOperatorContactLifecycleState: async () => ({
      id: "contact-1",
      lifecycleState: "customer",
    }),
    updateOperatorOnboardingState: async () => ({
      googleConnected: true,
      inboxContextSelected: true,
      calendarContextSelected: true,
    }),
    findTodayCopilotProposal: (copilot, proposalKey) =>
      (copilot?.proposals || []).find((proposal) => proposal.key === proposalKey) || null,
    applyTodayCopilotProposal: async () => ({
      ok: true,
      proposal: {
        key: "follow-up-draft:contact-1",
        type: "create_follow_up_draft",
        state: "applied",
      },
      result: {
        type: "follow_up_workflow",
        id: "follow-up-1",
        section: "automations",
      },
    }),
    dismissTodayCopilotProposal: async () => ({
      ok: true,
      persistenceAvailable: true,
    }),
    ...overrides,
  };
}

test("google connect start route returns an auth URL for the owner workspace", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/google/connect/start", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
      }),
    });

    assert.equal(response.status, 200);
    assert.match(response.json.authUrl, /accounts\.google\.com/);
  } finally {
    await server.close();
  }
});

test("operator workspace route exposes inbox, calendar, and automations surfaces", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator-workspace?agent_id=agent-1");

    assert.equal(response.status, 200);
    assert.equal(response.json.enabled, true);
    assert.equal(response.json.inbox.attentionCount, 1);
    assert.equal(response.json.calendar.events[0].id, "event-1");
    assert.equal(response.json.automations.tasks[0].id, "task-1");
    assert.equal(response.json.contacts.list[0].id, "contact-1");
    assert.equal(response.json.nextAction.key, "review_inbox");
    assert.equal(response.json.businessProfile.id, "profile-1");
  } finally {
    await server.close();
  }
});

test("product help route returns Vonza-scoped guidance with current page context", async () => {
  let capturedPayload = null;
  const server = await startServer(createApp(buildRouteDeps({
    getOpenAIClient: () => ({
      responses: {
        create: async () => ({
          output_text: "not used by this route unit test",
        }),
      },
    }),
    answerVonzaProductHelp: async (payload) => {
      capturedPayload = payload;
      return {
        answer: "Today is your main Vonza workspace for the next best action and setup guidance.",
        usedFallback: false,
        context: {
          sectionLabel: "Today",
        },
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/product-help", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        question: "What does this page do?",
        history: [
          { role: "user", content: "How do I use Vonza?" },
        ],
        current_section: "overview",
      }),
    });

    assert.equal(response.status, 200);
    assert.match(response.json.answer, /Today is your main Vonza workspace/i);
    assert.equal(capturedPayload.currentSection, "overview");
    assert.equal(capturedPayload.openai.responses.create instanceof Function, true);
    assert.equal(capturedPayload.agent.id, "agent-1");
    assert.equal(capturedPayload.operatorWorkspace.nextAction.key, "review_inbox");
  } finally {
    await server.close();
  }
});

test("product help route returns an explicit temporary fallback when OpenAI is unavailable", async () => {
  let serviceCalled = false;
  const server = await startServer(createApp(buildRouteDeps({
    getOpenAIClient: () => {
      const error = new Error("Missing environment variables: OPENAI_API_KEY");
      error.statusCode = 500;
      throw error;
    },
    answerVonzaProductHelp: async () => {
      serviceCalled = true;
      return {
        answer: "This should not be used.",
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/product-help", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        question: "Why is my install not verified?",
        current_section: "install",
      }),
    });

    assert.equal(response.status, 500);
    assert.equal(response.json.error, "I couldn't load Vonza help right now. Please try again.");
    assert.equal(serviceCalled, false);
  } finally {
    await server.close();
  }
});

test("business profile routes stay owner-scoped and return hydrated context", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const getResponse = await requestJson(server.baseUrl, "/agents/operator/business-profile?agent_id=agent-1");
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.json.profile.id, "profile-1");
    assert.equal(getResponse.json.profile.prefill.available, true);

    const postResponse = await requestJson(server.baseUrl, "/agents/operator/business-profile", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        profile: {
          businessSummary: "Emergency plumbing and water heater installs.",
          services: [{ name: "Water heater install" }],
          approvedContactChannels: ["website_chat", "phone"],
          approvalPreferences: {
            followUpDrafts: "owner_required",
            contactNextSteps: "recommend_only",
          },
        },
      }),
    });

    assert.equal(postResponse.status, 200);
    assert.equal(postResponse.json.ok, true);
    assert.equal(postResponse.json.profile.businessSummary, "Emergency plumbing and water heater installs.");
    assert.equal(postResponse.json.profile.prefill.available, true);
  } finally {
    await server.close();
  }
});

test("agents update route preserves explicit blanks and omits untouched fields", async () => {
  let capturedPayload = null;
  const server = await startServer(createApp(buildRouteDeps({
    updateAgentSettings: async (_supabase, payload) => {
      capturedPayload = payload;
      return {
        id: payload.agentId,
        assistantName: "Vonza",
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/update", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        welcome_message: "",
        button_label: "",
        website_url: "",
        primary_color: "",
        secondary_color: "",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(capturedPayload.welcomeMessage, "");
    assert.equal(capturedPayload.buttonLabel, "");
    assert.equal(capturedPayload.websiteUrl, "");
    assert.equal(capturedPayload.primaryColor, "");
    assert.equal(capturedPayload.secondaryColor, "");
    assert.equal(
      Object.prototype.hasOwnProperty.call(capturedPayload, "tone"),
      true
    );
    assert.equal(capturedPayload.tone, undefined);
  } finally {
    await server.close();
  }
});

test("copilot proposal apply route executes the selected proposal without autonomous sends", async () => {
  const server = await startServer(createApp(buildRouteDeps({
    getOperatorWorkspaceSnapshot: async () => ({
      enabled: true,
      featureEnabled: true,
      copilot: {
        proposals: [
          {
            key: "follow-up-draft:contact-1",
            type: "create_follow_up_draft",
          },
        ],
      },
    }),
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/copilot/proposals/apply", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        proposal_key: "follow-up-draft:contact-1",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.proposal.state, "applied");
    assert.equal(response.json.result.id, "follow-up-1");
  } finally {
    await server.close();
  }
});

test("copilot proposal dismiss route persists the dismissal", async () => {
  const server = await startServer(createApp(buildRouteDeps({
    getOperatorWorkspaceSnapshot: async () => ({
      enabled: true,
      featureEnabled: true,
      copilot: {
        proposals: [
          {
            key: "follow-up-draft:contact-1",
            type: "create_follow_up_draft",
          },
        ],
      },
    }),
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/copilot/proposals/dismiss", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        proposal_key: "follow-up-draft:contact-1",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.proposal.state, "dismissed");
  } finally {
    await server.close();
  }
});

test("action queue route stays visible when outcome reporting fails", async () => {
  const server = await startServer(createApp(buildRouteDeps({
    assertMessagesSchemaReady: async () => {},
    assertWidgetTelemetrySchemaReady: async () => {},
    assertLeadCaptureSchemaReady: async () => {},
    assertConversionOutcomeSchemaReady: async () => {},
    listAgentMessages: async () => [],
    listActionQueueStatuses: async () => ({ records: [], persistenceAvailable: true }),
    buildActionQueue: () => ({
      items: [],
      summary: { attentionNeeded: 0 },
      conversionSummary: {},
      outcomeSummary: {},
      recentOutcomes: [],
      recentLeadCaptures: [],
      persistenceAvailable: true,
    }),
    syncFollowUpWorkflows: async () => ({ records: [], persistenceAvailable: true }),
    syncKnowledgeFixWorkflows: async () => ({ records: [], persistenceAvailable: true }),
    listLeadCaptures: async () => ({ records: [], persistenceAvailable: true }),
    listWidgetRoutingEventsByAgentId: async () => [],
    listAgents: async () => ({
      agents: [{ id: "agent-1", businessId: "business-1" }],
    }),
    getStoredWebsiteContent: async () => null,
    listConversionOutcomesForAgent: async () => {
      throw new Error("Outcome query failed");
    },
    getAgentWorkspaceSnapshot: async () => ({
      id: "agent-1",
      businessId: "business-1",
      widgetMetrics: {},
      installStatus: {},
    }),
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/action-queue?agent_id=agent-1");

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(response.json.items), true);
    assert.equal(response.json.analyticsSummary.assistedOutcomes, 0);
  } finally {
    await server.close();
  }
});

test("operator activation route persists onboarding progress for the owner scope", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/activation", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        selected_mailbox: "IMPORTANT",
        mark_inbox_reviewed: true,
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.activation.inboxContextSelected, true);
    assert.equal(response.json.activation.calendarContextSelected, true);
  } finally {
    await server.close();
  }
});

test("feature-flag-off snapshot falls back safely without operator surfaces", async () => {
  const server = await startServer(createApp(buildRouteDeps({
    getOperatorWorkspaceSnapshot: async () => ({
      enabled: false,
      featureEnabled: false,
      status: {
        enabled: false,
        featureEnabled: false,
        googleConnected: false,
      },
      activation: {
        checklist: [],
      },
      connectedAccounts: [],
      inbox: { threads: [], attentionCount: 0 },
      calendar: { events: [], suggestedSlots: [], dailySummary: "Disabled." },
      automations: { tasks: [], campaigns: [], followUps: [] },
      summary: { inboxNeedingAttention: 0 },
      nextAction: { key: "legacy_workspace", title: "Continue setup" },
    }),
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator-workspace?agent_id=agent-1");

    assert.equal(response.status, 200);
    assert.equal(response.json.enabled, false);
    assert.equal(response.json.nextAction.key, "legacy_workspace");
  } finally {
    await server.close();
  }
});

test("operator mutation routes cover reply drafting, calendar approvals, and campaigns", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const draftReply = await requestJson(server.baseUrl, "/agents/operator/inbox/draft-reply", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        thread_id: "thread-1",
      }),
    });
    assert.equal(draftReply.status, 200);
    assert.equal(draftReply.json.draft.id, "draft-1");

    const approveCalendar = await requestJson(server.baseUrl, "/agents/operator/calendar/approve", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        event_id: "event-1",
      }),
    });
    assert.equal(approveCalendar.status, 200);
    assert.equal(approveCalendar.json.event.approvalStatus, "approved");

    const draftCampaign = await requestJson(server.baseUrl, "/agents/operator/campaigns/draft", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        goal: "welcome",
      }),
    });
    assert.equal(draftCampaign.status, 200);
    assert.equal(draftCampaign.json.campaign.id, "campaign-1");

    const draftContactFollowUp = await requestJson(server.baseUrl, "/agents/operator/contacts/follow-up/draft", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        contact_email: "contact@example.com",
      }),
    });
    assert.equal(draftContactFollowUp.status, 200);
    assert.equal(draftContactFollowUp.json.followUp.id, "follow-up-1");
  } finally {
    await server.close();
  }
});

test("contact lifecycle route preserves owner-scoped lifecycle updates", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/contacts/update", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        contact_id: "contact-1",
        lifecycle_state: "customer",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.contact.id, "contact-1");
    assert.equal(response.json.contact.lifecycleState, "customer");
  } finally {
    await server.close();
  }
});

test("campaign approval and send routes preserve owner approval before outbound send", async () => {
  const server = await startServer(createApp(buildRouteDeps()));

  try {
    const approve = await requestJson(server.baseUrl, "/agents/operator/campaigns/approve", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        campaign_id: "campaign-1",
      }),
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.json.campaign.status, "active");
    assert.ok(approve.json.campaign.recipients[0].nextSendAt);

    const sendDue = await requestJson(server.baseUrl, "/agents/operator/campaigns/send-due", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        campaign_id: "campaign-1",
      }),
    });
    assert.equal(sendDue.status, 200);
    assert.equal(sendDue.json.sentRecipients.length, 1);
  } finally {
    await server.close();
  }
});

test("appointment review route stays owner-scoped and forwards the chosen resolution", async () => {
  let receivedPayload = null;
  let receivedDeps = null;
  const server = await startServer(createApp(buildRouteDeps({
    resolveCalendarAppointmentReview: async (_supabase, payload, deps) => {
      receivedPayload = payload;
      receivedDeps = deps;
      return {
        ok: true,
        resolution: payload.resolution,
        event: { id: payload.eventId },
        followUp: { id: "follow-up-1" },
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/calendar/reviews/resolve", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        event_id: "event-1",
        resolution: "prepare_follow_up",
        contact_id: "contact-1",
        outcome_type: "quote_requested",
        note: "Owner wants a follow-up draft before tomorrow morning.",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.resolution, "prepare_follow_up");
    assert.equal(receivedPayload.agent.id, "agent-1");
    assert.equal(receivedPayload.ownerUserId, "owner-1");
    assert.equal(receivedPayload.eventId, "event-1");
    assert.equal(receivedPayload.resolution, "prepare_follow_up");
    assert.equal(receivedPayload.contactId, "contact-1");
    assert.equal(receivedPayload.outcomeType, "quote_requested");
    assert.equal(receivedPayload.note, "Owner wants a follow-up draft before tomorrow morning.");
    assert.equal(typeof receivedDeps.createManualFollowUpWorkflow, "function");
    assert.equal(typeof receivedDeps.markManualConversionOutcome, "function");
  } finally {
    await server.close();
  }
});

test("operator routes enforce active agent access", async () => {
  const server = await startServer(createApp(buildRouteDeps({
    requireActiveAgentAccess: async () => {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/operator/tasks/update", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        task_id: "task-1",
        status: "resolved",
      }),
    });

    assert.equal(response.status, 403);
    assert.equal(response.json.error, "Forbidden");
  } finally {
    await server.close();
  }
});
