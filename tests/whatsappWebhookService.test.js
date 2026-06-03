import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { createIntegrationRouter } from "../src/routes/integrationRoutes.js";
import {
  buildWhatsAppVerifyTokenSecretRef,
  deriveWhatsAppVerifyTokenHash,
  parseWhatsAppWebhookPayload,
  recordWhatsAppWebhookReceipt,
  verifyWhatsAppWebhookChallenge,
} from "../src/services/integrations/whatsappWebhookService.js";
import {
  evaluateConnectedAppReadiness,
} from "../src/services/integrations/connectedAppReadinessService.js";

const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_ID = "33333333-3333-4333-8333-333333333333";
const WABA_ID = "123456789012345";
const VERIFY_TOKEN = "meta-verify-token-1";
const CHALLENGE = "1158201444";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function whatsappConnection(overrides = {}) {
  return {
    id: CONNECTION_ID,
    owner_user_id: OWNER_ID,
    provider: "whatsapp",
    app_key: "whatsapp.business",
    capability_keys: ["whatsapp.business.webhook"],
    status: "active",
    provider_account_id: WABA_ID,
    webhook_status: "pending",
    token_secret_ref: buildWhatsAppVerifyTokenSecretRef({
      connectionId: CONNECTION_ID,
      verifyToken: VERIFY_TOKEN,
    }),
    metadata: {
      whatsappBusinessAccountId: WABA_ID,
      businessDisplayName: "Acme Front Desk",
      webhookVerifyStatus: "pending",
      graphApiVersion: "v23.0",
    },
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function whatsappPayload(overrides = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+15551230000",
                phone_number_id: "987654321098765",
              },
              contacts: [
                {
                  wa_id: "15559876543",
                  profile: {
                    name: "Customer Name",
                  },
                },
              ],
              messages: [
                {
                  from: "15559876543",
                  id: "wamid.test",
                  timestamp: "1780430000",
                  text: {
                    body: "Please book the private suite for Friday.",
                  },
                  type: "text",
                },
              ],
              statuses: [
                {
                  id: "wamid.status",
                  recipient_id: "15559876543",
                  status: "delivered",
                  timestamp: "1780430001",
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createSupabaseStub({ connections = [whatsappConnection()] } = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    messages: [],
    agent_action_requests: [],
    queriedTables: [],
  };

  function rowsFor(table) {
    if (!Object.hasOwn(state, table)) {
      throw new Error(`Unexpected table ${table}`);
    }

    return state[table];
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.updatePayload = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    update(payload) {
      this.updatePayload = clone(payload);
      return this;
    }

    maybeSingle() {
      const rows = rowsFor(this.table);
      const row = rows.find((candidate) =>
        this.filters.every(({ column, value }) => candidate[column] === value)
      );

      if (this.updatePayload && row) {
        Object.assign(row, this.updatePayload);
      }

      return Promise.resolve({
        data: row ? clone(row) : null,
        error: null,
      });
    }
  }

  return {
    state,
    from(table) {
      state.queriedTables.push(table);
      return new QueryBuilder(table);
    },
  };
}

function startIntegrationServer(supabase) {
  const app = express();
  app.use(express.json({ limit: "96kb" }));
  app.use(createIntegrationRouter({
    getSupabaseClient: () => supabase,
    limitWhatsAppWebhook: (_req, _res, next) => next(),
  }));

  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function requirementByKey(readiness, key) {
  return readiness.requirements.find((requirement) => requirement.key === key);
}

test("WhatsApp verify token helper derives a deterministic non-raw secret ref", () => {
  const hash = deriveWhatsAppVerifyTokenHash({
    connectionId: CONNECTION_ID,
    verifyToken: VERIFY_TOKEN,
  });
  const secretRef = buildWhatsAppVerifyTokenSecretRef({
    connectionId: CONNECTION_ID,
    verifyToken: VERIFY_TOKEN,
  });

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.match(secretRef, /^whatsapp-webhook-verify-token-sha256:[a-f0-9]{64}$/);
  assert.equal(secretRef.includes(VERIFY_TOKEN), false);
});

test("valid WhatsApp webhook verification returns only the challenge and activates webhook status", async () => {
  const verifiedAt = "2026-06-03T10:00:00.000Z";
  const supabase = createSupabaseStub();
  const result = await verifyWhatsAppWebhookChallenge(supabase, {
    connectionId: CONNECTION_ID,
    query: {
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": CHALLENGE,
    },
    now: verifiedAt,
  });

  assert.deepEqual(result, {
    ok: true,
    challenge: CHALLENGE,
    connectionId: CONNECTION_ID,
    webhookStatus: "active",
  });
  assert.equal(supabase.state.connected_app_connections[0].webhook_status, "active");
  assert.equal(supabase.state.connected_app_connections[0].last_verified_at, verifiedAt);
  assert.equal(supabase.state.connected_app_connections[0].metadata.webhookVerifiedAt, verifiedAt);
  assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes(VERIFY_TOKEN), false);
});

test("invalid WhatsApp verification mode token and connection fail safely", async () => {
  const invalidModeSupabase = createSupabaseStub();

  await assert.rejects(
    () => verifyWhatsAppWebhookChallenge(invalidModeSupabase, {
      connectionId: CONNECTION_ID,
      query: {
        "hub.mode": "unsubscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": CHALLENGE,
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_webhook_verification_invalid");
      return true;
    }
  );

  const invalidTokenSupabase = createSupabaseStub();

  await assert.rejects(
    () => verifyWhatsAppWebhookChallenge(invalidTokenSupabase, {
      connectionId: CONNECTION_ID,
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": CHALLENGE,
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_webhook_verification_invalid");
      assert.equal(JSON.stringify(error).includes("wrong-token"), false);
      return true;
    }
  );

  const missingConnectionSupabase = createSupabaseStub({ connections: [] });

  await assert.rejects(
    () => verifyWhatsAppWebhookChallenge(missingConnectionSupabase, {
      connectionId: CONNECTION_ID,
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": CHALLENGE,
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "whatsapp_webhook_connection_not_found");
      return true;
    }
  );
});

test("WhatsApp POST parsing records only safe status metadata and no message side effects", async () => {
  const receivedAt = "2026-06-03T10:10:00.000Z";
  const supabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
        metadata: {
          whatsappBusinessAccountId: WABA_ID,
          businessDisplayName: "Acme Front Desk",
          token: "sk-proj_should_not_survive_1234567890",
        },
      }),
    ],
  });
  const result = await recordWhatsAppWebhookReceipt(supabase, {
    connectionId: CONNECTION_ID,
    payload: whatsappPayload(),
    now: receivedAt,
  });
  const metadata = supabase.state.connected_app_connections[0].metadata;
  const serializedMetadata = JSON.stringify(metadata);

  assert.deepEqual(result, {
    ok: true,
    received: true,
    ignored: false,
    eventTypes: ["messages", "statuses"],
  });
  assert.equal(metadata.lastWebhookReceivedAt, receivedAt);
  assert.equal(metadata.lastWebhookObject, "whatsapp_business_account");
  assert.deepEqual(metadata.lastWebhookEventTypes, ["messages", "statuses"]);
  assert.equal(Object.hasOwn(metadata, "token"), false);
  assert.equal(serializedMetadata.includes("Please book the private suite"), false);
  assert.equal(serializedMetadata.includes("15559876543"), false);
  assert.equal(supabase.state.messages.length, 0);
  assert.equal(supabase.state.agent_action_requests.length, 0);
  assert.deepEqual([...new Set(supabase.state.queriedTables)], ["connected_app_connections"]);
});

test("WhatsApp payload parser recognizes only object and message/status event types", () => {
  const summary = parseWhatsAppWebhookPayload(whatsappPayload());

  assert.deepEqual(summary, {
    object: "whatsapp_business_account",
    entryIds: [WABA_ID],
    eventTypes: ["messages", "statuses"],
  });
});

test("WhatsApp route returns challenge on valid verification and safe error on invalid token", async () => {
  const supabase = createSupabaseStub();
  const server = await startIntegrationServer(supabase);

  try {
    const url = new URL(`${server.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", CHALLENGE);

    const validResponse = await fetch(url);
    const validBody = await validResponse.text();

    assert.equal(validResponse.status, 200);
    assert.equal(validBody, CHALLENGE);
    assert.equal(validBody.includes(VERIFY_TOKEN), false);

    url.searchParams.set("hub.verify_token", "wrong-token");
    const invalidResponse = await fetch(url);
    const invalidBody = await invalidResponse.json();

    assert.equal(invalidResponse.status, 403);
    assert.deepEqual(invalidBody, { error: "Invalid webhook request." });
  } finally {
    await server.close();
  }
});

test("WhatsApp route accepts POST payload without creating messages replies or action requests", async () => {
  const supabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
      }),
    ],
  });
  const server = await startIntegrationServer(supabase);

  try {
    const response = await fetch(
      `${server.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(whatsappPayload()),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { received: true });
    assert.equal(supabase.state.messages.length, 0);
    assert.equal(supabase.state.agent_action_requests.length, 0);
    assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes("Please book"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes("15559876543"), false);
  } finally {
    await server.close();
  }
});

test("WhatsApp webhook service does not call external WhatsApp Cloud or Twilio APIs", async () => {
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = () => {
    fetchCalled = true;
    throw new Error("unexpected external call");
  };

  try {
    const supabase = createSupabaseStub();
    await verifyWhatsAppWebhookChallenge(supabase, {
      connectionId: CONNECTION_ID,
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": CHALLENGE,
      },
    });
    await recordWhatsAppWebhookReceipt(supabase, {
      connectionId: CONNECTION_ID,
      payload: whatsappPayload(),
    });

    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("WhatsApp webhook readiness is ready only after active webhook and agent enablement", () => {
  const baseInput = {
    packageKey: "front_desk_general",
    agentId: AGENT_ID,
    requiredCapabilities: ["whatsapp.business.webhook"],
    providerStatuses: {
      whatsapp: "active",
    },
    surface: "dashboard",
    approvalMode: "manual_review",
  };

  const missingEnablement = evaluateConnectedAppReadiness({
    ...baseInput,
    connectedCapabilities: [],
    webhookStatuses: {
      "whatsapp.business.webhook": "active",
    },
  });

  assert.equal(missingEnablement.status, "blocked");
  assert.equal(
    requirementByKey(missingEnablement, "required.whatsapp.business.webhook").connected,
    false
  );

  const missingWebhook = evaluateConnectedAppReadiness({
    ...baseInput,
    connectedCapabilities: ["whatsapp.business.webhook"],
    webhookStatuses: {},
  });

  assert.equal(missingWebhook.status, "blocked");
  assert.equal(
    requirementByKey(missingWebhook, "required.whatsapp.business.webhook").webhookActive,
    false
  );

  const ready = evaluateConnectedAppReadiness({
    ...baseInput,
    connectedCapabilities: ["whatsapp.business.webhook"],
    webhookStatuses: {
      "whatsapp.business.webhook": "active",
    },
  });

  assert.equal(ready.status, "ready");
  assert.equal(requirementByKey(ready, "required.whatsapp.business.webhook").status, "ready");
});
