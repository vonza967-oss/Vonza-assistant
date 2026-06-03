import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { createIntegrationRouter } from "../src/routes/integrationRoutes.js";
import {
  buildMetaWebhookSignature,
  getMetaWebhookSignatureHeader,
  buildWhatsAppVerifyTokenSecretRef,
  deriveWhatsAppVerifyTokenHash,
  extractWhatsAppWebhookEvents,
  normalizeWhatsAppWebhookPayload,
  parseWhatsAppWebhookPayload,
  recordWhatsAppWebhookReceipt,
  verifyMetaWebhookSignature,
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
const META_TEST_SIGNING_KEY = "test-signing-key";

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
                  wa_id: "whatsapp-test-sender",
                  profile: {
                    name: "Test Contact",
                  },
                },
              ],
              messages: [
                {
                  from: "whatsapp-test-sender",
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
                  recipient_id: "whatsapp-test-sender",
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

function unknownWhatsAppPayload() {
  return whatsappPayload({
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
            },
          },
        ],
      },
    ],
  });
}

function createSupabaseStub({ connections = [whatsappConnection()] } = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    connected_app_inbound_events: [],
    connected_app_inbound_threads: [],
    messages: [],
    leads: [],
    agent_action_requests: [],
    agent_booking_requests: [],
    booking_requests: [],
    queriedTables: [],
    insertCounts: {
      connected_app_inbound_events: 0,
      connected_app_inbound_threads: 0,
    },
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
      this.insertPayload = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    is(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    update(payload) {
      this.updatePayload = clone(payload);
      return this;
    }

    insert(payload) {
      this.insertPayload = clone(payload);
      return this;
    }

    resolveRows() {
      return rowsFor(this.table)
        .filter((candidate) =>
          this.filters.every(({ column, value }) => candidate[column] === value)
        )
        .map(clone);
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

    single() {
      if (this.insertPayload) {
        const duplicate = rowsFor(this.table).find((row) => {
          if (this.table === "connected_app_inbound_events") {
            return row.owner_user_id === this.insertPayload.owner_user_id
              && row.provider === this.insertPayload.provider
              && row.dedupe_key
              && row.dedupe_key === this.insertPayload.dedupe_key;
          }

          if (this.table === "connected_app_inbound_threads") {
            return row.owner_user_id === this.insertPayload.owner_user_id
              && row.connection_id === this.insertPayload.connection_id
              && row.provider === this.insertPayload.provider
              && row.app_key === this.insertPayload.app_key
              && row.capability_key === this.insertPayload.capability_key
              && (row.agent_id || null) === (this.insertPayload.agent_id || null)
              && row.external_thread_key_hash === this.insertPayload.external_thread_key_hash;
          }

          return false;
        });

        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          });
        }

        state.insertCounts[this.table] += 1;
        const now = new Date().toISOString();
        const prefix = this.table === "connected_app_inbound_threads" ? "thread" : this.table;
        const row = {
          id: `${prefix}-${state.insertCounts[this.table]}`,
          created_at: now,
          updated_at: now,
          ...this.insertPayload,
        };

        rowsFor(this.table).push(row);
        return Promise.resolve({
          data: clone(row),
          error: null,
        });
      }

      return Promise.resolve({
        data: this.resolveRows()[0] || null,
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

function startIntegrationServer(supabase, deps = {}) {
  const app = express();
  app.use("/integrations/whatsapp/webhook", express.raw({ type: "application/json", limit: "96kb" }));
  app.use(express.json({ limit: "96kb" }));
  app.use(createIntegrationRouter({
    getSupabaseClient: () => supabase,
    limitWhatsAppWebhook: (_req, _res, next) => next(),
    ...deps,
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

test("Meta webhook signature helper verifies valid sha256 signatures", () => {
  const rawBody = JSON.stringify(whatsappPayload());
  const signatureHeader = buildMetaWebhookSignature(rawBody, META_TEST_SIGNING_KEY);

  assert.match(signatureHeader, /^sha256=[a-f0-9]{64}$/);
  assert.equal(
    getMetaWebhookSignatureHeader({ "X-Hub-Signature-256": signatureHeader }),
    signatureHeader
  );
  assert.deepEqual(
    verifyMetaWebhookSignature({
      rawBody,
      signatureHeader,
      appSecret: META_TEST_SIGNING_KEY,
    }),
    {
      ok: true,
      verified: true,
      status: "verified",
    }
  );
});

test("Meta webhook signature helper rejects missing malformed and invalid signatures when configured", () => {
  const rawBody = JSON.stringify(whatsappPayload());
  const validSignature = buildMetaWebhookSignature(rawBody, META_TEST_SIGNING_KEY);
  const lastHex = validSignature.slice(-1);
  const invalidSameLengthSignature = `${validSignature.slice(0, -1)}${lastHex === "0" ? "1" : "0"}`;

  assert.equal(
    verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: "",
      appSecret: META_TEST_SIGNING_KEY,
    }).status,
    "missing"
  );
  assert.equal(
    verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: "sha1=abc",
      appSecret: META_TEST_SIGNING_KEY,
    }).status,
    "malformed"
  );
  assert.equal(
    verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: invalidSameLengthSignature,
      appSecret: META_TEST_SIGNING_KEY,
    }).status,
    "invalid"
  );
});

test("Meta webhook signature helper reports not_configured without false verification", () => {
  const rawBody = JSON.stringify(whatsappPayload());
  const signatureHeader = buildMetaWebhookSignature(rawBody, META_TEST_SIGNING_KEY);

  assert.deepEqual(
    verifyMetaWebhookSignature({
      rawBody,
      signatureHeader,
      appSecret: "",
    }),
    {
      ok: false,
      verified: false,
      status: "not_configured",
    }
  );
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
          token: "unsafe-token-should-not-survive",
          webhookEndpointUrl: "https://graph.facebook.com/webhook",
          graphApiVersion: "https://graph.facebook.com/v23.0",
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
    eventTypes: ["message", "status"],
    messageTypes: ["text"],
    signatureStatus: "not_configured",
  });
  assert.equal(metadata.lastWebhookReceivedAt, receivedAt);
  assert.equal(metadata.lastWebhookObject, "whatsapp_business_account");
  assert.deepEqual(metadata.lastWebhookEventTypes, ["message", "status"]);
  assert.deepEqual(metadata.lastWebhookMessageTypes, ["text"]);
  assert.equal(metadata.lastWebhookSignatureStatus, "not_configured");
  assert.equal(Object.hasOwn(metadata, "token"), false);
  assert.equal(Object.hasOwn(metadata, "webhookEndpointUrl"), false);
  assert.equal(Object.hasOwn(metadata, "graphApiVersion"), false);
  assert.equal(serializedMetadata.includes("Please book the private suite"), false);
  assert.equal(serializedMetadata.includes("whatsapp-test-sender"), false);
  assert.equal(serializedMetadata.includes("Test Contact"), false);
  assert.equal(serializedMetadata.includes("https://"), false);
  assert.equal(supabase.state.messages.length, 0);
  assert.equal(supabase.state.leads.length, 0);
  assert.equal(supabase.state.agent_action_requests.length, 0);
  assert.equal(supabase.state.agent_booking_requests.length, 0);
  assert.equal(supabase.state.booking_requests.length, 0);
  assert.equal(supabase.state.connected_app_inbound_events.length, 2);
  assert.equal(supabase.state.connected_app_inbound_threads.length, 1);
  assert.equal(supabase.state.connected_app_inbound_threads[0].external_thread_label, "WhatsApp conversation");
  assert.equal(supabase.state.connected_app_inbound_threads[0].unread_count, 1);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("Please book"), false);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("whatsapp-test-sender"), false);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("Test Contact"), false);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_threads).includes("whatsapp-test-sender"), false);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_threads).includes("Test Contact"), false);
  assert.deepEqual(
    [...new Set(supabase.state.queriedTables)],
    ["connected_app_connections", "connected_app_inbound_events", "connected_app_inbound_threads"]
  );
});

test("WhatsApp payload normalization returns safe message and status summaries", () => {
  const events = extractWhatsAppWebhookEvents(whatsappPayload());
  const summary = normalizeWhatsAppWebhookPayload(whatsappPayload());

  assert.deepEqual(events, [
    {
      object: "whatsapp_business_account",
      entryId: WABA_ID,
      phoneNumberId: "987654321098765",
      eventType: "message",
      messageId: "wamid.test",
      messageType: "text",
      timestamp: "1780430000",
      status: "",
      metadata: {
        hasText: true,
        textLength: 41,
        contactPresent: true,
      },
    },
    {
      object: "whatsapp_business_account",
      entryId: WABA_ID,
      phoneNumberId: "987654321098765",
      eventType: "status",
      messageId: "wamid.status",
      messageType: "",
      timestamp: "1780430001",
      status: "delivered",
      metadata: {},
    },
  ]);
  assert.deepEqual(summary.eventTypes, ["message", "status"]);
  assert.deepEqual(summary.messageTypes, ["text"]);
  assert.equal(JSON.stringify(events).includes("Please book the private suite"), false);
  assert.equal(JSON.stringify(events).includes("whatsapp-test-sender"), false);
  assert.equal(JSON.stringify(events).includes("Test Contact"), false);
});

test("WhatsApp payload parser recognizes object message/status event and message types", () => {
  const summary = parseWhatsAppWebhookPayload(whatsappPayload());

  assert.deepEqual(summary, {
    object: "whatsapp_business_account",
    entryIds: [WABA_ID],
    eventTypes: ["message", "status"],
    messageTypes: ["text"],
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
    assert.equal(supabase.state.leads.length, 0);
    assert.equal(supabase.state.agent_action_requests.length, 0);
    assert.equal(supabase.state.agent_booking_requests.length, 0);
    assert.equal(supabase.state.booking_requests.length, 0);
    assert.equal(supabase.state.connected_app_inbound_events.length, 2);
    assert.equal(supabase.state.connected_app_inbound_threads.length, 1);
    assert.equal(supabase.state.connected_app_inbound_threads[0].unread_count, 1);
    assert.equal(supabase.state.connected_app_inbound_events[0].thread_id, "thread-1");
    assert.equal(supabase.state.connected_app_inbound_events[1].thread_id, "thread-1");
    assert.deepEqual(
      supabase.state.connected_app_inbound_events.map((event) => ({
        ownerUserId: event.owner_user_id,
        connectionId: event.connection_id,
        agentId: event.agent_id,
        provider: event.provider,
        appKey: event.app_key,
        capabilityKey: event.capability_key,
        eventType: event.provider_event_type,
        messageId: event.provider_message_id,
        dedupeKey: event.dedupe_key,
      })),
      [
        {
          ownerUserId: OWNER_ID,
          connectionId: CONNECTION_ID,
          agentId: null,
          provider: "whatsapp",
          appKey: "whatsapp.business",
          capabilityKey: "whatsapp.business.webhook",
          eventType: "message",
          messageId: "wamid.test",
          dedupeKey: "whatsapp:message:wamid.test",
        },
        {
          ownerUserId: OWNER_ID,
          connectionId: CONNECTION_ID,
          agentId: null,
          provider: "whatsapp",
          appKey: "whatsapp.business",
          capabilityKey: "whatsapp.business.webhook",
          eventType: "status",
          messageId: "wamid.status",
          dedupeKey: "whatsapp:message:wamid.status",
        },
      ]
    );
    assert.equal(
      supabase.state.connected_app_connections[0].metadata.lastWebhookSignatureStatus,
      "not_configured"
    );
    assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes("Please book"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes("whatsapp-test-sender"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_connections).includes("Test Contact"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("Please book"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("whatsapp-test-sender"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("Test Contact"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_threads).includes("Please book"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_threads).includes("whatsapp-test-sender"), false);
    assert.equal(JSON.stringify(supabase.state.connected_app_inbound_threads).includes("Test Contact"), false);
  } finally {
    await server.close();
  }
});

test("WhatsApp duplicate POST dedupes inbound event rows without side effects", async () => {
  const supabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
      }),
    ],
  });
  const server = await startIntegrationServer(supabase);
  const url = `${server.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`;
  const request = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(whatsappPayload()),
  };

  try {
    const firstResponse = await fetch(url, request);
    const secondResponse = await fetch(url, request);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(supabase.state.connected_app_inbound_events.length, 2);
    assert.equal(supabase.state.connected_app_inbound_threads.length, 1);
    assert.equal(supabase.state.connected_app_inbound_threads[0].unread_count, 1);
    assert.equal(supabase.state.messages.length, 0);
    assert.equal(supabase.state.leads.length, 0);
    assert.equal(supabase.state.agent_action_requests.length, 0);
    assert.equal(supabase.state.agent_booking_requests.length, 0);
    assert.equal(supabase.state.booking_requests.length, 0);
  } finally {
    await server.close();
  }
});

test("WhatsApp duplicate POST dedupes unknown inbound event summaries", async () => {
  const supabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
      }),
    ],
  });
  const server = await startIntegrationServer(supabase);
  const url = `${server.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`;
  const request = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(unknownWhatsAppPayload()),
  };

  try {
    const firstResponse = await fetch(url, request);
    const secondResponse = await fetch(url, request);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(supabase.state.connected_app_inbound_events.length, 1);
    assert.equal(supabase.state.connected_app_inbound_threads.length, 0);
    assert.equal(
      supabase.state.connected_app_inbound_events[0].dedupe_key.startsWith("whatsapp:summary:"),
      true
    );
    assert.equal(supabase.state.messages.length, 0);
    assert.equal(supabase.state.leads.length, 0);
    assert.equal(supabase.state.agent_action_requests.length, 0);
    assert.equal(supabase.state.agent_booking_requests.length, 0);
    assert.equal(supabase.state.booking_requests.length, 0);
  } finally {
    await server.close();
  }
});

test("WhatsApp route enforces POST signature when service-only app secret is supplied", async () => {
  const validSupabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
      }),
    ],
  });
  const validServer = await startIntegrationServer(validSupabase, {
    getWhatsAppWebhookAppSecret: () => META_TEST_SIGNING_KEY,
  });
  const rawBody = JSON.stringify(whatsappPayload());
  const signatureHeader = buildMetaWebhookSignature(rawBody, META_TEST_SIGNING_KEY);

  try {
    const validResponse = await fetch(
      `${validServer.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signatureHeader,
        },
        body: rawBody,
      }
    );

    assert.equal(validResponse.status, 200);
    assert.equal(
      validSupabase.state.connected_app_connections[0].metadata.lastWebhookSignatureStatus,
      "verified"
    );
  } finally {
    await validServer.close();
  }

  const invalidSupabase = createSupabaseStub({
    connections: [
      whatsappConnection({
        webhook_status: "active",
      }),
    ],
  });
  const invalidServer = await startIntegrationServer(invalidSupabase, {
    getWhatsAppWebhookAppSecret: () => META_TEST_SIGNING_KEY,
  });

  try {
    const invalidResponse = await fetch(
      `${invalidServer.baseUrl}/integrations/whatsapp/webhook/${CONNECTION_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": buildMetaWebhookSignature(`${rawBody} `, META_TEST_SIGNING_KEY),
        },
        body: rawBody,
      }
    );
    const invalidBody = await invalidResponse.json();

    assert.equal(invalidResponse.status, 403);
    assert.deepEqual(invalidBody, { error: "Invalid webhook request." });
    assert.equal(
      Object.hasOwn(invalidSupabase.state.connected_app_connections[0].metadata, "lastWebhookReceivedAt"),
      false
    );
  } finally {
    await invalidServer.close();
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

  const publicChatExecution = evaluateConnectedAppReadiness({
    ...baseInput,
    connectedCapabilities: ["whatsapp.business.webhook"],
    webhookStatuses: {
      "whatsapp.business.webhook": "active",
    },
    surface: "public_chat",
    executionRequested: true,
  });

  assert.equal(publicChatExecution.status, "blocked");
  assert.equal(
    requirementByKey(publicChatExecution, "execution.requested").reasons
      .some((reason) => reason.code === "public_chat_execution_blocked"),
    true
  );
});
