import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createConnectedAppRouteSupabase({
  agents = [],
  connections = [],
  enablements = [],
  bookingIntegrations = [],
  inboundThreads = [],
  inboundEvents = [],
  outboundMessages = [],
} = {}) {
  const state = {
    agents: agents.map(clone),
    connected_app_connections: connections.map(clone),
    agent_connected_app_enablements: enablements.map(clone),
    agent_booking_integrations: bookingIntegrations.map(clone),
    connected_app_inbound_threads: inboundThreads.map(clone),
    connected_app_inbound_events: inboundEvents.map(clone),
    connected_app_outbound_messages: outboundMessages.map(clone),
    insertCounts: {
      connected_app_connections: 0,
      agent_connected_app_enablements: 0,
      agent_booking_integrations: 0,
      connected_app_inbound_threads: 0,
      connected_app_inbound_events: 0,
      connected_app_outbound_messages: 0,
    },
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "connected_app_connections") {
      return state.connected_app_connections;
    }

    if (table === "agent_connected_app_enablements") {
      return state.agent_connected_app_enablements;
    }

    if (table === "agent_booking_integrations") {
      return state.agent_booking_integrations;
    }

    if (table === "connected_app_inbound_threads") {
      return state.connected_app_inbound_threads;
    }

    if (table === "connected_app_inbound_events") {
      return state.connected_app_inbound_events;
    }

    if (table === "connected_app_outbound_messages") {
      return state.connected_app_outbound_messages;
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function buildQuery(table) {
    return {
      filters: [],
      insertPayload: null,
      upsertPayload: null,
      updatePayload: null,
      conflictColumns: [],
      orderSpec: null,
      select() {
        return this;
      },
      eq(column, value) {
        this.filters.push({ column, value });
        return this;
      },
      insert(payload) {
        this.insertPayload = clone(payload);
        return this;
      },
      upsert(payload, options = {}) {
        this.upsertPayload = clone(payload);
        this.conflictColumns = String(options.onConflict || "id")
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);
        return this;
      },
      update(payload) {
        this.updatePayload = clone(payload);
        return this;
      },
      order(column, options = {}) {
        this.orderSpec = { column, ascending: options.ascending !== false };
        return this;
      },
      resolveRows() {
        let rows = rowsFor(table).filter((row) =>
          this.filters.every(({ column, value }) => row[column] === value)
        );

        if (this.orderSpec) {
          const { column, ascending } = this.orderSpec;
          rows = [...rows].sort((left, right) => {
            const result = String(left[column] || "").localeCompare(String(right[column] || ""));
            return ascending ? result : -result;
          });
        }

        return rows.map(clone);
      },
      async limit(limit) {
        return {
          data: this.resolveRows().slice(0, limit),
          error: null,
        };
      },
      async maybeSingle() {
        if (this.updatePayload) {
          const row = rowsFor(table).find((candidate) =>
            this.filters.every(({ column, value }) => candidate[column] === value)
          );

          if (!row) {
            return { data: null, error: null };
          }

          Object.assign(row, this.updatePayload);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
      async single() {
        if (this.upsertPayload) {
          const rows = rowsFor(table);
          const existing = rows.find((candidate) =>
            this.conflictColumns.length > 0
            && this.conflictColumns.every((column) => candidate[column] === this.upsertPayload[column])
          );

          if (existing) {
            Object.assign(existing, this.upsertPayload);
            return { data: clone(existing), error: null };
          }

          state.insertCounts[table] += 1;
          const row = {
            id: `${table}-${state.insertCounts[table]}`,
            created_at: new Date().toISOString(),
            ...this.upsertPayload,
          };

          rows.push(row);
          return { data: clone(row), error: null };
        }

        if (this.insertPayload) {
          state.insertCounts[table] += 1;
          const prefix = table === "connected_app_connections"
            ? "connection"
            : table === "agent_connected_app_enablements"
              ? "enablement"
              : table === "connected_app_inbound_threads"
                ? "thread"
                : table === "connected_app_inbound_events"
                  ? "event"
                  : "outbound";
          const now = new Date().toISOString();
          const row = {
            id: `${prefix}-${state.insertCounts[table]}`,
            created_at: now,
            updated_at: now,
            ...this.insertPayload,
          };

          rowsFor(table).push(row);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
    };
  }

  return {
    state,
    from(table) {
      return buildQuery(table);
    },
  };
}

function connection(overrides = {}) {
  return {
    id: "connection-1",
    owner_user_id: "owner-1",
    provider: "google",
    app_key: "google.calendar",
    capability_keys: ["google.calendar.read"],
    status: "active",
    provider_account_id: "google-account-1",
    provider_account_label: "owner@example.com",
    scopes_granted: ["https://www.googleapis.com/auth/calendar.readonly"],
    webhook_status: "not_required",
    token_secret_ref: "vault/google/secret-ref",
    metadata: {},
    created_at: "2026-06-02T10:00:00.000Z",
    updated_at: "2026-06-02T10:00:00.000Z",
    ...overrides,
  };
}

function enablement(overrides = {}) {
  return {
    id: "enablement-1",
    owner_user_id: "owner-1",
    agent_id: "agent-1",
    connection_id: "connection-1",
    capability_keys: ["google.calendar.read"],
    enabled: true,
    approval_mode: "manual_review",
    allowed_surfaces: ["operator"],
    package_key: "front_desk_general",
    metadata: {},
    created_at: "2026-06-02T10:00:00.000Z",
    updated_at: "2026-06-02T10:00:00.000Z",
    ...overrides,
  };
}

function recentInboundTimestamp() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

function inboundThread(overrides = {}) {
  const lastInboundAt = overrides.last_event_at
    || overrides.metadata?.lastInboundMessageAt
    || recentInboundTimestamp();

  return {
    id: "thread-1",
    owner_user_id: "owner-1",
    connection_id: "connection-1",
    agent_id: null,
    provider: "whatsapp",
    app_key: "whatsapp.business",
    capability_key: "whatsapp.business.webhook",
    external_thread_key_hash: "a".repeat(64),
    external_thread_label: "WhatsApp conversation",
    status: "open",
    last_event_id: "event-1",
    last_event_at: lastInboundAt,
    last_event_type: "message",
    last_message_type: "text",
    unread_count: 1,
    assigned_owner_user_id: null,
    metadata: {
      inboundReviewOnly: true,
      noAutomaticWhatsAppMessages: true,
      noAiReplies: true,
      noAiHandoff: true,
      lastInboundMessageAt: lastInboundAt,
    },
    created_at: lastInboundAt,
    updated_at: lastInboundAt,
    ...overrides,
  };
}

function inboundEvent(overrides = {}) {
  const receivedAt = overrides.received_at
    || overrides.receivedAt
    || overrides.provider_timestamp
    || recentInboundTimestamp();

  return {
    id: "event-1",
    owner_user_id: "owner-1",
    connection_id: "connection-1",
    agent_id: null,
    provider: "whatsapp",
    app_key: "whatsapp.business",
    capability_key: "whatsapp.business.webhook",
    provider_event_id: null,
    provider_event_type: "message",
    provider_message_id: "wamid.safe",
    provider_timestamp: receivedAt,
    source_account_id: "123456789012345",
    source_channel_id: "987654321098765",
    event_direction: "inbound",
    event_status: "received",
    normalized_message_text: "Can you help with availability tonight?",
    normalized: {
      eventType: "message",
      messageType: "text",
      metadata: {
        hasText: true,
        textLength: 41,
        contactPresent: true,
      },
    },
    redaction_summary: {
      messageBodyStored: false,
      contactFieldsStored: false,
      providerPayloadStored: false,
    },
    dedupe_key: "whatsapp:message:wamid.safe",
    thread_id: "thread-1",
    metadata: {
      signatureStatus: "not_configured",
    },
    received_at: receivedAt,
    created_at: receivedAt,
    ...overrides,
  };
}

function createApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    limitWidgetBootstrap: (_req, _res, next) => next(),
    limitPublicInstallSignal: (_req, _res, next) => next(),
    limitPublicInstallCta: (_req, _res, next) => next(),
    limitAuthAdjacent: (_req, _res, next) => next(),
    limitInstallVerify: (_req, _res, next) => next(),
    ...deps,
  }));
  return app;
}

function buildRouteDeps(supabase, { ownerUserId = "owner-1", providerCalls = [], overrides = {} } = {}) {
  const providerCall = async () => {
    providerCalls.push("called");
    return {};
  };

  return {
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async (_supabase, req) => {
      if (!req.headers.authorization) {
        const error = new Error("Unauthorized");
        error.statusCode = 401;
        throw error;
      }

      return { id: ownerUserId, email: `${ownerUserId}@example.com` };
    },
    requireActiveAgentAccess: async (_supabase, options) => {
      const agent = supabase.state.agents.find((record) =>
        record.id === options.agentId && record.owner_user_id === options.ownerUserId
      );

      if (!agent) {
        const error = new Error("Agent not found");
        error.statusCode = 404;
        error.code = "agent_not_found";
        throw error;
      }

      return { id: agent.id, ownerUserId: agent.owner_user_id };
    },
    createGoogleConnectionStart: providerCall,
    completeGoogleConnection: providerCall,
    draftCalendarAction: providerCall,
    approveCalendarAction: providerCall,
    draftInboxReply: providerCall,
    sendInboxReply: providerCall,
    createCampaignDraft: providerCall,
    approveCampaignDraft: providerCall,
    sendDueCampaignSteps: providerCall,
    ...overrides,
  };
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
  const headers = {
    "Content-Type": "application/json",
    ...(options.auth === false ? {} : { Authorization: "Bearer owner-token" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null,
    text,
  };
}

test("connected app capability route rejects unauthenticated requests", async () => {
  const supabase = createConnectedAppRouteSupabase();
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/connected-app-capabilities", {
      auth: false,
    });

    assert.equal(response.status, 401);
    assert.equal(response.json.error, "Unauthorized");
  } finally {
    await server.close();
  }
});

test("connected app capabilities route returns safe registry metadata only", async () => {
  const supabase = createConnectedAppRouteSupabase();
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/connected-app-capabilities");

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.capabilities.length > 0, true);
    assert.equal(
      response.json.capabilities.some((capability) => capability.key === "whatsapp.business.webhook"),
      true
    );
    assert.equal(
      response.json.capabilities.some((capability) => capability.key === "whatsapp.business.send.template"),
      true
    );
    assert.equal(
      response.json.capabilities.some((capability) => capability.key === "whatsapp.business.send.session.reply"),
      true
    );

    for (const capability of response.json.capabilities) {
      assert.equal(capability.publicChatCallable, false);
      assert.equal(Object.hasOwn(capability, "handler"), false);
      assert.equal(Object.hasOwn(capability, "providerClient"), false);
      assert.equal(Object.hasOwn(capability, "oauthUrl"), false);
      assert.equal(Object.hasOwn(capability, "token"), false);
      assert.equal(Object.hasOwn(capability, "secret"), false);
    }

    const serialized = JSON.stringify(response.json);
    assert.doesNotMatch(serialized, /https?:\/\/(?:accounts\.google\.com|oauth2\.googleapis\.com|graph\.facebook\.com|api\.stripe\.com|api\.twilio\.com|api\.calendly\.com)/i);
    assert.doesNotMatch(serialized, /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret|whsec)_[A-Za-z0-9._-]{10,}\b/);
  } finally {
    await server.close();
  }
});

test("owner can create list and update an own connected app connection", async () => {
  const supabase = createConnectedAppRouteSupabase();
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const createResponse = await requestJson(server.baseUrl, "/agents/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        status: "active",
        provider_account_id: "google-account-1",
        provider_account_label: "owner@example.com",
        scopes: ["calendar.read"],
        webhook_status: "not_required",
        metadata: { setup: "manual" },
      }),
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.json.connection.ownerUserId, "owner-1");
    assert.equal(createResponse.json.connection.hasTokenSecretRef, false);

    const listResponse = await requestJson(server.baseUrl, "/agents/connected-apps?provider=google&status=active");

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listResponse.json.connections.map((record) => record.id), ["connection-1"]);

    const updateResponse = await requestJson(server.baseUrl, "/agents/connected-apps/status", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-1",
        status: "needs_attention",
        webhook_status: "needs_attention",
        needs_attention_reason: "manual_review_required",
        metadata: { checkedBy: "internal" },
      }),
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.connection.status, "needs_attention");
    assert.equal(updateResponse.json.connection.needsAttentionReason, "manual_review_required");
    assert.doesNotMatch(JSON.stringify(updateResponse.json), /token_secret_ref|secret-ref|tokenSecretRef/);

    const whatsappResponse = await requestJson(server.baseUrl, "/agents/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: [
          "whatsapp.business.webhook",
          "whatsapp.business.send.template",
        ],
        status: "active",
        provider_account_id: "123456789012345",
        provider_account_label: "Acme WhatsApp Business",
        webhook_status: "active",
        metadata: {
          whatsappBusinessAccountId: "123456789012345",
          phoneNumberId: "987654321098765",
          displayPhoneNumber: "+15551234567",
          businessDisplayName: "Acme Front Desk",
          webhookVerifyStatus: "verified",
          graphApiVersion: "v23.0",
        },
      }),
    });

    assert.equal(whatsappResponse.status, 201);
    assert.equal(whatsappResponse.json.connection.provider, "whatsapp");
    assert.deepEqual(whatsappResponse.json.connection.capabilityKeys, [
      "whatsapp.business.webhook",
      "whatsapp.business.send.template",
    ]);
    assert.doesNotMatch(JSON.stringify(whatsappResponse.json), /accessToken|appSecret|verifyToken|token_secret_ref/i);
  } finally {
    await server.close();
  }
});

test("Calendly connect route creates provider webhook and safe connected app enablement", async () => {
  const previousEncryptionSecret = process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET;
  process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET = "test-booking-webhook-encryption-secret";
  const calendlyRequests = [];
  const supabase = createConnectedAppRouteSupabase({
    agents: [
      {
        id: "agent-1",
        owner_user_id: "owner-1",
        access_status: "active",
        is_active: true,
      },
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      getPublicAppUrl: () => "https://app.example",
      env: {
        CALENDLY_PERSONAL_ACCESS_TOKEN: "calendly-test-token",
        CALENDLY_USER_URI: "https://api.calendly.com/users/USER123",
        CALENDLY_WEBHOOK_SCOPE: "user",
      },
      fetch: async (url, options = {}) => {
        calendlyRequests.push({
          url,
          headers: options.headers || {},
          body: JSON.parse(options.body || "{}"),
        });
        return new Response(JSON.stringify({
          resource: {
            uri: "https://api.calendly.com/webhook_subscriptions/SUB123",
            user: "https://api.calendly.com/users/USER123",
            scope: "user",
            events: ["invitee.created", "invitee.canceled"],
          },
        }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps/calendly/connect", {
      method: "POST",
      body: JSON.stringify({
        booking_url: "https://calendly.com/acme/demo",
      }),
    });
    const serializedResponse = JSON.stringify(response.json);
    const bookingIntegration = supabase.state.agent_booking_integrations[0];
    const connection = supabase.state.connected_app_connections[0];
    const enablement = supabase.state.agent_connected_app_enablements[0];

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.providerConnected, true);
    assert.equal(response.json.backendConfigured, true);
    assert.equal(response.json.integration.status, "active");
    assert.equal(response.json.integration.providerAccountId, "USER123");
    assert.equal(response.json.integration.providerEventTypeId, "SUB123");
    assert.equal(calendlyRequests.length, 1);
    assert.equal(calendlyRequests[0].url, "https://api.calendly.com/webhook_subscriptions");
    assert.match(calendlyRequests[0].body.url, /^https:\/\/app\.example\/bookings\/webhooks\/calendly\//);
    assert.deepEqual(calendlyRequests[0].body.events, ["invitee.created", "invitee.canceled"]);
    assert.equal(calendlyRequests[0].body.user, "https://api.calendly.com/users/USER123");
    assert.equal(calendlyRequests[0].body.scope, "user");
    assert.equal(typeof calendlyRequests[0].body.signing_key, "string");
    assert.equal(bookingIntegration.status, "active");
    assert.equal(bookingIntegration.booking_url, "https://calendly.com/acme/demo");
    assert.equal(bookingIntegration.provider_account_id, "USER123");
    assert.equal(bookingIntegration.provider_event_type_id, "SUB123");
    assert.equal(bookingIntegration.webhook_endpoint_token_hash.length, 64);
    assert.equal(bookingIntegration.webhook_endpoint_token_hash.includes("/bookings/webhooks"), false);
    assert.equal(bookingIntegration.webhook_secret_encrypted.includes(calendlyRequests[0].body.signing_key), false);
    assert.equal(connection.provider, "calendly");
    assert.equal(connection.app_key, "calendly.booking");
    assert.deepEqual(connection.capability_keys, ["calendly.booking.webhook"]);
    assert.equal(connection.status, "active");
    assert.equal(connection.webhook_status, "active");
    assert.equal(connection.token_secret_ref, null);
    assert.equal(enablement.agent_id, "agent-1");
    assert.equal(enablement.enabled, true);
    assert.deepEqual(enablement.capability_keys, ["calendly.booking.webhook"]);
    assert.deepEqual(enablement.allowed_surfaces, ["webhook", "internal"]);
    assert.doesNotMatch(
      serializedResponse,
      /calendly-test-token|signing_key|webhookSecret|webhook_secret|endpointToken|webhookUrl|webhook_url|api\.calendly\.com/i
    );

    const unsafeResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps/calendly/connect", {
      method: "POST",
      body: JSON.stringify({
        booking_url: "https://calendly.com/acme/demo",
        accessToken: "raw-token",
      }),
    });

    assert.equal(unsafeResponse.status, 400);
    assert.equal(unsafeResponse.json.code, "calendly_connect_field_rejected");
  } finally {
    if (previousEncryptionSecret === undefined) {
      delete process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET;
    } else {
      process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET = previousEncryptionSecret;
    }
    await server.close();
  }
});

test("connected app connection create rejects unknown capabilities and unsafe fields", async () => {
  const supabase = createConnectedAppRouteSupabase();
  const server = await startServer(createApp(buildRouteDeps(supabase)));
  const fakeMetaAccessToken = ["EAA", "FakeMetaAccessTokenValue1234567890"].join("");

  try {
    const unknownResponse = await requestJson(server.baseUrl, "/agents/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["unknown.provider.capability"],
      }),
    });

    assert.equal(unknownResponse.status, 400);
    assert.equal(unknownResponse.json.code, "unknown_connected_app_capability");

    for (const body of [
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        accessToken: "raw-token",
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        oauth_url: "https://accounts.google.com/o/oauth2/v2/auth",
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        token_secret_ref: "vault/google/secret-ref",
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        tokenSecretRef: "vault/google/secret-ref",
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        metadata: { secret: "raw-secret" },
      },
      {
        provider: "google",
        app_key: "google.calendar",
        capabilities: ["google.calendar.read"],
        metadata: { source: "sk-proj_secretLookingValue1234567890" },
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        appSecret: "raw-app-secret",
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        verify_token: "raw-verify-token",
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        cloud_api_url: "graph.facebook.com/v23.0/123/messages",
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        webhook_endpoint_url: "graph.facebook.com/webhooks",
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        metadata: { whatsappAccessToken: "raw-token" },
      },
      {
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capabilities: ["whatsapp.business.send.template"],
        metadata: { source: fakeMetaAccessToken },
      },
    ]) {
      const response = await requestJson(server.baseUrl, "/agents/connected-apps", {
        method: "POST",
        body: JSON.stringify(body),
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "connected_app_secret_or_execution_field_rejected");
    }
  } finally {
    await server.close();
  }
});

test("owner cannot see or update another owner's connected app connection", async () => {
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({ id: "connection-1", owner_user_id: "owner-1" }),
      connection({ id: "connection-2", owner_user_id: "owner-2", provider_account_id: "google-account-2" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const listResponse = await requestJson(server.baseUrl, "/agents/connected-apps");

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listResponse.json.connections.map((record) => record.id), ["connection-1"]);

    const updateResponse = await requestJson(server.baseUrl, "/agents/connected-apps/status", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-2",
        status: "disabled",
      }),
    });

    assert.equal(updateResponse.status, 404);
    assert.equal(updateResponse.json.code, "connected_app_connection_not_found");
  } finally {
    await server.close();
  }
});

test("connected app inbound inbox routes are authenticated owner scoped and read only", async () => {
  const supabase = createConnectedAppRouteSupabase({
    inboundThreads: [
      inboundThread({ id: "thread-1", owner_user_id: "owner-1" }),
      inboundThread({
        id: "thread-2",
        owner_user_id: "owner-2",
        connection_id: "connection-2",
        external_thread_key_hash: "b".repeat(64),
      }),
    ],
    inboundEvents: [
      inboundEvent({ id: "event-1", owner_user_id: "owner-1", thread_id: "thread-1" }),
      inboundEvent({
        id: "event-2",
        owner_user_id: "owner-2",
        connection_id: "connection-2",
        thread_id: "thread-2",
        provider_message_id: "wamid.other",
        dedupe_key: "whatsapp:message:wamid.other",
      }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads", {
      auth: false,
    });

    assert.equal(unauthenticated.status, 401);

    const threadsResponse = await requestJson(
      server.baseUrl,
      "/agents/connected-app-inbound-threads?provider=whatsapp&status=open"
    );

    assert.equal(threadsResponse.status, 200);
    assert.equal(threadsResponse.json.ok, true);
    assert.deepEqual(threadsResponse.json.threads.map((thread) => thread.id), ["thread-1"]);
    assert.equal(threadsResponse.json.threads[0].externalThreadLabel, "WhatsApp conversation");
    assert.equal(Object.hasOwn(threadsResponse.json.threads[0], "externalThreadKeyHash"), false);

    const eventsResponse = await requestJson(
      server.baseUrl,
      "/agents/connected-app-inbound-events?provider=whatsapp&threadId=thread-1"
    );

    assert.equal(eventsResponse.status, 200);
    assert.deepEqual(eventsResponse.json.events.map((event) => event.id), ["event-1"]);
    assert.equal(JSON.stringify(eventsResponse.json).includes("Please book"), false);
    assert.equal(JSON.stringify(eventsResponse.json).includes("Test Contact"), false);

    const statusResponse = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/status", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
        status: "reviewing",
      }),
    });

    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.json.thread.status, "reviewing");
    assert.equal(statusResponse.json.thread.unreadCount, 0);

    const otherOwnerUpdate = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/status", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-2",
        status: "resolved",
      }),
    });

    assert.equal(otherOwnerUpdate.status, 404);
    assert.equal(otherOwnerUpdate.json.code, "connected_app_inbound_thread_not_found");
  } finally {
    await server.close();
  }
});

test("connected app inbound inbox status API rejects reply send and AI handoff payloads", async () => {
  const supabase = createConnectedAppRouteSupabase({
    inboundThreads: [inboundThread()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    for (const body of [
      { thread_id: "thread-1", status: "reviewing", replyText: "hello" },
      { thread_id: "thread-1", status: "reviewing", sendMessage: true },
      { thread_id: "thread-1", status: "reviewing", aiDraft: true },
      { thread_id: "thread-1", status: "reviewing", chatHandoff: true },
    ]) {
      const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/status", {
        method: "POST",
        body: JSON.stringify(body),
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "connected_app_secret_or_execution_field_rejected");
    }

  } finally {
    await server.close();
  }
});

test("connected app AI draft route requires auth and feature flag before OpenAI", async () => {
  const openaiCalls = [];
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_keys: [
          "whatsapp.business.webhook",
          "whatsapp.business.send.session.reply",
        ],
        status: "active",
      }),
    ],
    inboundThreads: [inboundThread()],
    inboundEvents: [inboundEvent()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: {
        WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
      },
      openai: {
        responses: {
          create: async () => {
            openaiCalls.push("called");
            return { output_text: "Draft" };
          },
        },
      },
    },
  })));

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/ai-draft", {
      auth: false,
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
      }),
    });

    assert.equal(unauthenticated.status, 401);

    const disabled = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/ai-draft", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
      }),
    });

    assert.equal(disabled.status, 403);
    assert.equal(disabled.json.code, "whatsapp_ai_reply_drafts_disabled");
    assert.deepEqual(openaiCalls, []);
    assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
  } finally {
    await server.close();
  }
});

test("connected app AI draft route rejects token phone provider payload and auto-send fields", async () => {
  const supabase = createConnectedAppRouteSupabase({
    inboundThreads: [inboundThread()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: {
        WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
        WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "true",
      },
    },
  })));

  try {
    for (const body of [
      { thread_id: "thread-1", accessToken: "raw-token" },
      { thread_id: "thread-1", phone: "+15551234567" },
      { thread_id: "thread-1", to: "+15551234567" },
      { thread_id: "thread-1", provider_payload: { raw: true } },
      { thread_id: "thread-1", payload: { messaging_product: "whatsapp" } },
      { thread_id: "thread-1", autoSend: true },
      { thread_id: "thread-1", message_text: "Use this arbitrary dashboard context." },
    ]) {
      const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/ai-draft", {
        method: "POST",
        body: JSON.stringify(body),
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "connected_app_ai_draft_field_rejected");
    }
  } finally {
    await server.close();
  }
});

test("connected app AI draft route creates draft-only audit and does not call provider send", async () => {
  const openaiCalls = [];
  const providerCalls = [];
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_keys: [
          "whatsapp.business.webhook",
          "whatsapp.business.send.session.reply",
        ],
        status: "active",
      }),
    ],
    inboundThreads: [inboundThread({ agent_id: "agent-1" })],
    inboundEvents: [inboundEvent({ agent_id: "agent-1" })],
    enablements: [
      enablement({
        agent_id: "agent-1",
        connection_id: "connection-1",
        capability_keys: ["whatsapp.business.send.session.reply"],
        allowed_surfaces: ["dashboard"],
      }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: {
        WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
        WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "true",
      },
      openai: {
        responses: {
          create: async (payload) => {
            openaiCalls.push(payload);
            return {
              output_text: "Thanks for reaching out. Our team will check availability and reply here shortly.",
            };
          },
        },
      },
      whatsappProviderClient: async () => providerCalls.push("called"),
    },
  })));

  try {
    const listResponse = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads?provider=whatsapp");

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.aiDrafts.enabled, true);

    const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/ai-draft", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
        agent_id: "agent-1",
        staff_instructions: "Keep it concise.",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.status, "draft");
    assert.match(response.json.draftText, /Our team will check availability/);
    assert.equal(response.json.aiDraftOnly, true);
    assert.equal(response.json.requiresStaffApproval, true);
    assert.equal(response.json.noAutomaticWhatsAppReplies, true);
    assert.equal(Object.hasOwn(response.json, "outbound"), false);
    assert.equal(JSON.stringify(response.json).includes("connection-1"), false);
    assert.equal(JSON.stringify(response.json).includes("owner-1"), false);
    assert.equal(JSON.stringify(response.json).includes("whatsapp.business.send.session.reply"), false);
    assert.deepEqual(providerCalls, []);
    assert.equal(openaiCalls.length, 1);
    assert.equal(supabase.state.connected_app_outbound_messages.length, 1);
    assert.equal(supabase.state.connected_app_outbound_messages[0].status, "draft");
    assert.equal(supabase.state.connected_app_outbound_messages[0].sent_at, null);
    assert.equal(supabase.state.connected_app_outbound_messages[0].provider_message_id, null);
  } finally {
    await server.close();
  }
});

test("connected app manual reply route requires auth and feature flag", async () => {
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_keys: [
          "whatsapp.business.webhook",
          "whatsapp.business.send.session.reply",
        ],
        status: "active",
        webhook_status: "active",
        token_secret_ref: "vault/whatsapp/token",
        metadata: {
          phoneNumberId: "987654321098765",
          graphApiVersion: "v25.0",
        },
      }),
    ],
    inboundThreads: [inboundThread()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: {},
      getWhatsAppDestinationRef: async () => ({ destinationRef: "+15551234567" }),
      whatsappProviderClient: async () => ({ messages: [{ id: "wamid.sent" }] }),
    },
  })));

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/reply", {
      auth: false,
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
        message_text: "Manual staff reply",
      }),
    });

    assert.equal(unauthenticated.status, 401);

    const disabled = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/reply", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
        message_text: "Manual staff reply",
      }),
    });

    assert.equal(disabled.status, 403);
    assert.equal(disabled.json.code, "whatsapp_manual_replies_disabled");
    assert.equal(supabase.state.connected_app_outbound_messages.length, 1);
    assert.equal(supabase.state.connected_app_outbound_messages[0].status, "blocked");
  } finally {
    await server.close();
  }
});

test("connected app manual reply route rejects token phone and provider payload fields", async () => {
  const supabase = createConnectedAppRouteSupabase({
    inboundThreads: [inboundThread()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: { WHATSAPP_MANUAL_REPLIES_ENABLED: "true" },
    },
  })));

  try {
    for (const body of [
      { thread_id: "thread-1", message_text: "Manual", accessToken: "raw-token" },
      { thread_id: "thread-1", message_text: "Manual", phone: "+15551234567" },
      { thread_id: "thread-1", message_text: "Manual", to: "+15551234567" },
      { thread_id: "thread-1", message_text: "Manual", phone_number_id: "987654321098765" },
      { thread_id: "thread-1", message_text: "Manual", provider_payload: { raw: true } },
      { thread_id: "thread-1", message_text: "Manual", payload: { messaging_product: "whatsapp" } },
    ]) {
      const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/reply", {
        method: "POST",
        body: JSON.stringify(body),
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "connected_app_reply_field_rejected");
    }
  } finally {
    await server.close();
  }
});

test("connected app manual reply route sends owner-scoped staff text through injected WhatsApp provider", async () => {
  const providerCalls = [];
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_keys: [
          "whatsapp.business.webhook",
          "whatsapp.business.send.session.reply",
        ],
        status: "active",
        webhook_status: "active",
        token_secret_ref: "vault/whatsapp/token",
        metadata: {
          phoneNumberId: "987654321098765",
          graphApiVersion: "v25.0",
        },
      }),
    ],
    inboundThreads: [inboundThread()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: {
        WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
      },
      now: () => new Date().toISOString(),
      getWhatsAppDestinationRef: async () => ({ destinationRef: "+15551234567" }),
      getWhatsAppCloudApiCredentials: async () => ({ accessToken: "server-token" }),
      whatsappProviderClient: async (request) => {
        providerCalls.push(request);
        return { messages: [{ id: "wamid.route.sent", message_status: "accepted" }] };
      },
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/reply", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-1",
        message_text: "Manual staff-authored route reply",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.outbound.status, "sent");
    assert.equal(response.json.outbound.providerMessageId, "wamid.route.sent");
    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].payload.text.body, "Manual staff-authored route reply");
    assert.equal(JSON.stringify(response.json).includes("+15551234567"), false);
    assert.equal(JSON.stringify(response.json).includes("server-token"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_outbound_messages).includes("Manual staff-authored route reply"), false);
  } finally {
    await server.close();
  }
});

test("connected app manual reply route remains owner scoped", async () => {
  const supabase = createConnectedAppRouteSupabase({
    connections: [
      connection({
        id: "connection-2",
        owner_user_id: "owner-2",
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_keys: ["whatsapp.business.send.session.reply"],
        status: "active",
      }),
    ],
    inboundThreads: [
      inboundThread({
        id: "thread-2",
        owner_user_id: "owner-2",
        connection_id: "connection-2",
        external_thread_key_hash: "b".repeat(64),
      }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    overrides: {
      env: { WHATSAPP_MANUAL_REPLIES_ENABLED: "true" },
      getWhatsAppDestinationRef: async () => ({ destinationRef: "+15551234567" }),
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/connected-app-inbound-threads/reply", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread-2",
        message_text: "Manual staff reply",
      }),
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.code, "connected_app_inbound_thread_not_found");
    assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
  } finally {
    await server.close();
  }
});

test("owner can enable update and list a connected app for an owned agent", async () => {
  const supabase = createConnectedAppRouteSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [
      connection({
        capability_keys: ["google.calendar.read", "google.calendar.write"],
      }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const enableResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
        approval_mode: "manual_review",
        allowed_surfaces: ["operator"],
        package_key: "front_desk_general",
      }),
    });

    assert.equal(enableResponse.status, 201);
    assert.equal(enableResponse.json.enablement.ownerUserId, "owner-1");
    assert.equal(enableResponse.json.enablement.agentId, "agent-1");
    assert.equal(enableResponse.json.enablement.enabled, true);

    const updateResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        enablement_id: "enablement-1",
        enabled: false,
        approval_mode: "disabled",
        allowed_surfaces: ["internal"],
      }),
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.enablement.enabled, false);
    assert.equal(updateResponse.json.enablement.approvalMode, "disabled");

    const listResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps");

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listResponse.json.enablements.map((record) => record.id), ["enablement-1"]);
  } finally {
    await server.close();
  }
});

test("connected app enablement route rejects cross-owner agents connections and missing connection capabilities", async () => {
  const supabase = createConnectedAppRouteSupabase({
    agents: [
      { id: "agent-1", owner_user_id: "owner-1" },
      { id: "agent-2", owner_user_id: "owner-2" },
    ],
    connections: [
      connection({ id: "connection-1", owner_user_id: "owner-1", capability_keys: ["google.calendar.read"] }),
      connection({ id: "connection-2", owner_user_id: "owner-2", provider_account_id: "google-account-2" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const otherConnectionResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-2",
        capability_keys: ["google.calendar.read"],
      }),
    });

    assert.equal(otherConnectionResponse.status, 404);
    assert.equal(otherConnectionResponse.json.code, "connected_app_connection_not_found");

    const otherAgentResponse = await requestJson(server.baseUrl, "/agents/agent-2/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
      }),
    });

    assert.equal(otherAgentResponse.status, 404);
    assert.equal(otherAgentResponse.json.code, "agent_not_found");

    const missingCapabilityResponse = await requestJson(server.baseUrl, "/agents/agent-1/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-1",
        capability_keys: ["google.calendar.write"],
      }),
    });

    assert.equal(missingCapabilityResponse.status, 400);
    assert.equal(missingCapabilityResponse.json.code, "connected_app_capability_not_on_connection");
    assert.equal(supabase.state.agent_connected_app_enablements.length, 0);
  } finally {
    await server.close();
  }
});

test("connected app readiness route builds report-only readiness from generic records", async () => {
  const supabase = createConnectedAppRouteSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [connection()],
    enablements: [enablement()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(
      server.baseUrl,
      "/agents/agent-1/connected-app-readiness?required_capabilities=google.calendar.read&surface=operator"
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.deepEqual(response.json.context.connectedCapabilities, ["google.calendar.read"]);
    assert.equal(response.json.report.reportOnly, true);
    assert.equal(response.json.report.status, "ready");

    const publicChatResponse = await requestJson(
      server.baseUrl,
      "/agents/agent-1/connected-app-readiness?required_capabilities=google.calendar.read&surface=public_chat&execution_requested=true"
    );

    assert.equal(publicChatResponse.status, 200);
    assert.equal(publicChatResponse.json.report.status, "blocked");
    assert.equal(
      publicChatResponse.json.report.requirements.some((requirement) =>
        requirement.key === "execution.requested"
        && requirement.reasons.some((reason) => reason.code === "public_chat_execution_blocked")
      ),
      true
    );
  } finally {
    await server.close();
  }
});

test("connected app routes do not call provider setup or execution dependencies", async () => {
  const providerCalls = [];
  const supabase = createConnectedAppRouteSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [connection()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase, { providerCalls })));

  try {
    await requestJson(server.baseUrl, "/agents/connected-app-capabilities");
    await requestJson(server.baseUrl, "/agents/connected-apps");
    await requestJson(server.baseUrl, "/agents/agent-1/connected-apps", {
      method: "POST",
      body: JSON.stringify({
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
        allowed_surfaces: ["operator"],
      }),
    });

    assert.deepEqual(providerCalls, []);
  } finally {
    await server.close();
  }
});

test("connected app API is not exposed through widget embed or chat bundles", () => {
  for (const filePath of [
    "assistant-embed.js",
    "embed.js",
    "embed-lite.js",
    "src/routes/chatRoutes.js",
    "src/services/chat/chatService.js",
  ]) {
    const source = readFileSync(filePath, "utf8");

    assert.doesNotMatch(source, /connected-app-capabilities|connected-apps|connected-app-readiness/i);
  }
});
