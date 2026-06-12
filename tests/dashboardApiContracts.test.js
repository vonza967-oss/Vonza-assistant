import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import cors from "cors";
import express from "express";

import { OWNER_AI_USAGE_LEDGER_TABLE, OWNER_BILLING_ACCOUNT_TABLE } from "../src/config/constants.js";
import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { syncOwnerBillingState } from "../src/services/billing/billingUsageService.js";
import {
  validateDashboardActionQueueContract,
  validateDashboardAgentContract,
} from "../src/contracts/dashboardApiContracts.js";

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

function createRouteDeps(overrides = {}) {
  const agent = {
    id: "agent-1",
    businessId: "business-1",
    ownerUserId: "owner-1",
    accessStatus: "active",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    assistantName: "Vonza Front Desk",
    installStatus: { state: "seen_recently", label: "Live install detected" },
    fullPageConfig: { publicPageEnabled: true, publicPageKey: "page-key" },
  };
  const actionQueue = {
    items: [],
    people: [],
    summary: { total: 0, attentionNeeded: 0 },
    conversionSummary: { contactsCaptured: 0 },
    outcomeSummary: { total: 0 },
    recentOutcomes: [],
    recentLeadCaptures: [],
    persistenceAvailable: true,
    migrationRequired: false,
  };

  return {
    getSupabaseClient: () => ({}),
    getOpenAIClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async () => agent,
    getAgentWorkspaceSnapshot: async () => agent,
    listAgents: async () => ({ agents: [agent], bridgeAgent: null }),
    listAgentMessages: async () => [
      {
        id: "message-1",
        agent_id: "agent-1",
        role: "user",
        content: "Can I book an appointment?",
        created_at: "2026-05-01T10:00:00.000Z",
      },
      {
        id: "message-2",
        agent_id: "agent-1",
        role: "assistant",
        content: "Yes, share your preferred time.",
        created_at: "2026-05-01T10:01:00.000Z",
      },
    ],
    listActionQueueStatuses: async () => ({ records: [], persistenceAvailable: true }),
    buildActionQueue: () => actionQueue,
    listVisitorReplyFeedbackForOwner: async () => ({
      records: [],
      summary: { total: 0, helpful: 0, notHelpful: 0, needsReview: 0 },
      persistenceAvailable: true,
    }),
    listLeadCaptures: async () => ({ records: [], persistenceAvailable: true }),
    listConversionOutcomesForAgent: async () => ({
      records: [],
      summary: { total: 0 },
      recentOutcomes: [],
      persistenceAvailable: true,
    }),
    listWidgetRoutingEventsByAgentId: async () => [],
    getStoredWebsiteContent: async () => null,
    syncFollowUpWorkflows: async () => ({ records: [], persistenceAvailable: true }),
    syncKnowledgeFixWorkflows: async () => ({ records: [], persistenceAvailable: true }),
    listHumanFollowUpStatusRows: async () => ({ records: [], persistenceAvailable: true }),
    buildHumanFollowUpWorkflow: () => ({
      items: [],
      topItems: [],
      summary: { total: 0, open: 0, highPriority: 0 },
      persistenceAvailable: true,
    }),
    syncOwnerNotifications: async () => ({
      records: [],
      summary: { unread: 0, read: 0, dismissed: 0, active: 0, total: 0 },
      persistenceAvailable: true,
    }),
    assertMessagesSchemaReady: async () => {},
    assertWidgetTelemetrySchemaReady: async () => {},
    assertLeadCaptureSchemaReady: async () => {},
    assertConversionOutcomeSchemaReady: async () => {},
    getWidgetBootstrap: async () => ({
      ok: true,
      agentId: "agent-1",
      businessId: "business-1",
      displayMode: "page",
      widgetConfig: {
        assistantName: "Vonza Front Desk",
        welcomeMessage: "How can we help?",
        buttonLabel: "Ask",
      },
    }),
    ...overrides,
  };
}

function createBillingTransitionSupabase() {
  const state = {
    [OWNER_BILLING_ACCOUNT_TABLE]: [],
    [OWNER_AI_USAGE_LEDGER_TABLE]: [],
    agents: [
      { id: "agent-1", owner_user_id: "owner-1", access_status: "pending" },
      { id: "agent-2", owner_user_id: "owner-2", access_status: "active" },
    ],
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.values = null;
      this.filters = [];
      this.selected = false;
    }

    select() {
      this.selected = true;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    limit() {
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    maybeSingle() {
      const result = this.#execute();
      return Promise.resolve({
        data: result.data?.[0] || null,
        error: result.error || null,
      });
    }

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #rows() {
      return state[this.table] || [];
    }

    #matches() {
      return this.#rows().filter((row) =>
        this.filters.every(([column, value]) => row[column] === value)
      );
    }

    #execute() {
      if (this.operation === "select") {
        return { data: this.#matches().map((row) => ({ ...row })), error: null };
      }

      if (this.operation === "insert") {
        const rows = Array.isArray(this.values) ? this.values : [this.values];
        this.#rows().push(...rows.map((row) => ({ ...row })));
        return { data: this.selected ? rows.map((row) => ({ ...row })) : null, error: null };
      }

      if (this.operation === "update") {
        const matches = this.#matches();
        matches.forEach((row) => Object.assign(row, this.values));
        return { data: this.selected ? matches.map((row) => ({ ...row })) : null, error: null };
      }

      throw new Error(`Unsupported operation: ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

test("dashboard action queue API response keeps the frontend contract shape", async () => {
  const server = await startServer(createApp(createRouteDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/action-queue?agent_id=agent-1&client_id=client-1");

    assert.equal(response.status, 200);
    const validation = validateDashboardActionQueueContract(response.json);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
  } finally {
    await server.close();
  }
});

test("owner-scoped dashboard APIs deny access before returning workspace data", async () => {
  let snapshotRequested = false;
  let accessCheck = null;
  const server = await startServer(createApp(createRouteDeps({
    getAuthenticatedUser: async () => ({ id: "owner-2", email: "other@example.com" }),
    requireActiveAgentAccess: async (_supabase, options) => {
      accessCheck = options;
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    },
    getAgentWorkspaceSnapshot: async () => {
      snapshotRequested = true;
      return {};
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/install-status?agent_id=agent-1&client_id=client-1");

    assert.equal(response.status, 403);
    assert.equal(response.json.error, "Forbidden");
    assert.deepEqual(accessCheck, {
      agentId: "agent-1",
      ownerUserId: "owner-2",
      clientId: "client-1",
    });
    assert.equal(snapshotRequested, false);
  } finally {
    await server.close();
  }
});

test("Web Call review actions use authenticated owner scope", async () => {
  let updatePayload = null;
  const server = await startServer(createApp(createRouteDeps({
    updateActionQueueStatus: async (_supabase, payload) => {
      updatePayload = payload;
      return {
        item: {
          agentId: payload.agentId,
          ownerUserId: payload.ownerUserId,
          actionKey: payload.actionKey,
          status: payload.status,
          followUpNeeded: payload.followUpNeeded,
        },
        persistenceAvailable: true,
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/action-queue/status", {
      method: "POST",
      body: JSON.stringify({
        client_id: "client-1",
        agent_id: "agent-1",
        action_key: "web_call_review:call-1",
        status: "reviewed",
        follow_up_needed: true,
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(updatePayload.agentId, "agent-1");
    assert.equal(updatePayload.ownerUserId, "owner-1");
    assert.equal(updatePayload.actionKey, "web_call_review:call-1");
    assert.equal(updatePayload.followUpNeeded, true);
  } finally {
    await server.close();
  }
});

test("billing sync transitions only the paid owner's workspace access_status", async () => {
  const supabase = createBillingTransitionSupabase();

  const nonPilotFreeSnapshot = await syncOwnerBillingState(supabase, {
    ownerUserId: "owner-1",
    planKey: "growth",
    subscriptionStatus: "free",
    currentPeriodStart: "2026-05-01T00:00:00.000Z",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(nonPilotFreeSnapshot.hasPlanAccess, false);
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-1").access_status, "pending");

  const activeSnapshot = await syncOwnerBillingState(supabase, {
    ownerUserId: "owner-1",
    planKey: "growth",
    subscriptionStatus: "active",
    currentPeriodStart: "2026-05-01T00:00:00.000Z",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(activeSnapshot.hasActiveSubscription, true);
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-1").access_status, "active");
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-2").access_status, "active");

  const suspendedSnapshot = await syncOwnerBillingState(supabase, {
    ownerUserId: "owner-1",
    planKey: "growth",
    subscriptionStatus: "past_due",
    currentPeriodStart: "2026-05-01T00:00:00.000Z",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(suspendedSnapshot.hasActiveSubscription, false);
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-1").access_status, "suspended");
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-2").access_status, "active");
});

test("admin pilot widget plan route activates the internal free widget plan", async () => {
  let activationPayload = null;
  const auditEvents = [];
  const server = await startServer(createApp(createRouteDeps({
    getAuthenticatedUser: async () => ({
      id: "admin-1",
      email: "admin@example.com",
      app_metadata: {
        role: "admin",
      },
    }),
    activatePilotWidgetPlan: async (_supabase, payload) => {
      activationPayload = payload;
      return {
        ok: true,
        ownerUserId: payload.ownerUserId,
        planKey: "pilot_free_widget",
        accessStatus: "active",
        billing: {
          planKey: "pilot_free_widget",
          hasPlanAccess: true,
          hasActiveSubscription: false,
        },
        entitlement: {
          product_key: "website_widget",
          entitlement_status: "free",
          source: "manual_free",
        },
      };
    },
    recordAdminAuditEvent: async (_supabase, event) => {
      auditEvents.push(event);
      return { ok: true };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/billing/pilot-widget-plan", {
      method: "POST",
      body: JSON.stringify({
        owner_user_id: "owner-pilot",
        reason: "manual pilot",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.planKey, "pilot_free_widget");
    assert.equal(response.json.entitlement.product_key, "website_widget");
    assert.equal(activationPayload.ownerUserId, "owner-pilot");
    assert.equal(activationPayload.activatedByUserId, "admin-1");
    assert.equal(activationPayload.reason, "manual pilot");
    assert.equal(auditEvents.some((event) => event.action === "billing.pilot_widget_plan.activate"), true);
    assert.equal(auditEvents.some((event) => event.action === "billing.pilot_widget_plan.activated"), true);
  } finally {
    await server.close();
  }
});

test("public assistant bootstrap uses page mode and hides unsafe denial detail", async () => {
  const server = await startServer(createApp(createRouteDeps({
    getWidgetBootstrap: async (_supabase, payload) => ({
      ok: true,
      agentId: payload.agentId,
      displayMode: payload.displayMode,
      widgetConfig: { assistantName: "Public Front Desk" },
    }),
  })));

  try {
    const success = await requestJson(server.baseUrl, "/widget/bootstrap?agent_id=agent-1&display_mode=page");

    assert.equal(success.status, 200);
    assert.equal(success.json.displayMode, "page");
    assert.equal(success.json.widgetConfig.assistantName, "Public Front Desk");
  } finally {
    await server.close();
  }

  const denialServer = await startServer(createApp(createRouteDeps({
    getWidgetBootstrap: async () => {
      const error = new Error("This assistant is already claimed by another account.");
      error.statusCode = 403;
      throw error;
    },
  })));

  try {
    const denial = await requestJson(denialServer.baseUrl, "/widget/bootstrap?agent_id=agent-1&display_mode=page", {
      headers: {},
    });

    assert.equal(denial.status, 403);
    assert.equal(denial.json.error, "Assistant unavailable");
  } finally {
    await denialServer.close();
  }
});

test("schema readiness failures fail dashboard APIs before partial payloads are emitted", async () => {
  const schemaError = new Error("[request] Missing required message persistence schema.");
  schemaError.statusCode = 500;
  schemaError.code = "schema_not_ready";

  const server = await startServer(createApp(createRouteDeps({
    assertMessagesSchemaReady: async () => {
      throw schemaError;
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/action-queue?agent_id=agent-1&client_id=client-1");

    assert.equal(response.status, 500);
    assert.match(response.json.error, /missing required message persistence schema/i);
  } finally {
    await server.close();
  }
});

test("dashboard agent contract helper rejects ambiguous access payloads", () => {
  assert.equal(validateDashboardAgentContract({
    id: "agent-1",
    accessStatus: "active",
    installStatus: {},
    fullPageConfig: {},
  }).ok, true);

  const validation = validateDashboardAgentContract({
    id: "agent-1",
    accessStatus: "paid",
  });

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors, ["agent.accessStatus must be pending, active, or suspended"]);
});
