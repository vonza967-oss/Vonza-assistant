import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";

import express from "express";

import { createBookingRouter } from "../src/routes/bookingRoutes.js";
import {
  encryptBookingWebhookSecret,
  hashBookingWebhookEndpointToken,
} from "../src/services/bookings/bookingIntegrationService.js";
import { clearRateLimitForTests } from "../src/utils/rateLimiter.js";

const ENDPOINT_TOKEN = "calendly-endpoint-token";
const WEBHOOK_SECRET = "calendly-webhook-secret";

function signPayload(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

function createInviteeCreatedPayload(overrides = {}) {
  const payloadOverrides = overrides.payload || {};
  const topLevelOverrides = { ...overrides };
  delete topLevelOverrides.payload;

  return {
    event: "invitee.created",
    created_at: "2026-05-23T10:00:00.000Z",
    payload: {
      uri: "https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1",
      event: {
        uri: "https://api.calendly.com/scheduled_events/event-1",
      },
      event_type: {
        uri: "https://api.calendly.com/event_types/type-1",
      },
      tracking: {
        agent_id: "agent-evil",
        owner_user_id: "owner-evil",
        utm_source: "visitor-1",
        utm_content: "session-1",
      },
      ...payloadOverrides,
    },
    ...topLevelOverrides,
  };
}

function createSupabaseStub() {
  const state = {
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        access_status: "active",
        is_active: true,
      },
      {
        id: "agent-2",
        business_id: "business-2",
        owner_user_id: "owner-2",
        access_status: "active",
        is_active: true,
      },
    ],
    widget_configs: [
      {
        agent_id: "agent-1",
        install_id: "11111111-1111-4111-8111-111111111111",
        booking_url: "https://calendly.com/acme/demo",
      },
    ],
    agent_booking_integrations: [
      {
        id: "integration-1",
        agent_id: "agent-1",
        owner_user_id: "owner-1",
        provider: "calendly",
        status: "active",
        booking_url: "https://calendly.com/acme/demo",
        webhook_endpoint_token_hash: hashBookingWebhookEndpointToken(ENDPOINT_TOKEN),
        webhook_secret_encrypted: encryptBookingWebhookSecret(WEBHOOK_SECRET),
        provider_event_type_id: "https://api.calendly.com/event_types/type-1",
        metadata: {},
      },
    ],
    agent_contact_leads: [],
    agent_conversion_outcomes: [],
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.limitCount = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    in(column, values) {
      const lookup = new Set(values);
      this.filters.push((row) => lookup.has(row[column]));
      return this;
    }

    order() {
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.#executeSingle());
    }

    single() {
      return Promise.resolve(this.#executeSingle());
    }

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #rows() {
      return state[this.table] || [];
    }

    #matches() {
      let rows = this.#rows().filter((row) => this.filters.every((filter) => filter(row)));

      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }

      return rows;
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];

      return {
        data: rows[0] ? { ...rows[0] } : null,
        error: result.error || null,
      };
    }

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#matches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "insert") {
        const values = Array.isArray(this.values) ? this.values : [this.values];
        const rows = this.#rows();
        const inserted = values.map((value, index) => ({
          id: value.id || `${this.table}-${rows.length + index + 1}`,
          ...value,
        }));
        rows.push(...inserted);

        return {
          data: inserted.map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "update") {
        const matches = this.#matches();
        matches.forEach((row) => Object.assign(row, this.values));

        return {
          data: matches.map((row) => ({ ...row })),
          error: null,
        };
      }

      throw new Error(`Unsupported operation ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

function createApp(supabase) {
  const app = express();
  app.use("/bookings/webhooks/calendly", express.raw({ type: "application/json" }));
  app.use(createBookingRouter({
    getSupabaseClient: () => supabase,
    limitBookingWebhook: (_req, _res, next) => next(),
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

async function postWebhook(server, payload, headers = {}) {
  const rawBody = JSON.stringify(payload);

  return await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: rawBody,
  });
}

test.beforeEach(() => {
  process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET = "test-encryption-secret";
  clearRateLimitForTests();
});

test.afterEach(() => {
  delete process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET;
  clearRateLimitForTests();
});

test("Calendly webhook rejects missing signature", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));

  try {
    const response = await postWebhook(server, createInviteeCreatedPayload());
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid webhook request.");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});

test("Calendly webhook rejects bad signature", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));

  try {
    const response = await postWebhook(server, createInviteeCreatedPayload(), {
      "Calendly-Webhook-Signature": `t=${Math.floor(Date.now() / 1000)},v1=badbad`,
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid webhook request.");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});

test("Calendly webhook accepts valid invitee.created and records booking_confirmed", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const payload = createInviteeCreatedPayload();
  const rawBody = JSON.stringify(payload);

  try {
    const response = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Calendly-Webhook-Signature": signPayload(rawBody),
      },
      body: rawBody,
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.received, true);
    assert.equal(supabase.state.agent_conversion_outcomes.length, 1);
    assert.equal(supabase.state.agent_conversion_outcomes[0].outcome_type, "booking_confirmed");
    assert.equal(supabase.state.agent_conversion_outcomes[0].confirmation_level, "confirmed");
    assert.equal(supabase.state.agent_conversion_outcomes[0].source_type, "calendar_event");
    assert.equal(supabase.state.agent_conversion_outcomes[0].agent_id, "agent-1");
    assert.equal(supabase.state.agent_conversion_outcomes[0].owner_user_id, "owner-1");
  } finally {
    await server.close();
  }
});

test("Calendly webhook dedupes repeated provider events", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const payload = createInviteeCreatedPayload();
  const rawBody = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "Calendly-Webhook-Signature": signPayload(rawBody),
  };

  try {
    const first = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers,
      body: rawBody,
    });
    const second = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers,
      body: rawBody,
    });
    const secondBody = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(secondBody.duplicate, true);
    assert.equal(supabase.state.agent_conversion_outcomes.length, 1);
  } finally {
    await server.close();
  }
});

test("Calendly webhook payload cannot write to another agent or owner", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const payload = createInviteeCreatedPayload({
    payload: {
      tracking: {
        agent_id: "agent-2",
        owner_user_id: "owner-2",
        utm_source: "visitor-2",
        utm_content: "session-2",
      },
    },
  });
  const rawBody = JSON.stringify(payload);

  try {
    const response = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Calendly-Webhook-Signature": signPayload(rawBody),
      },
      body: rawBody,
    });

    assert.equal(response.status, 200);
    assert.equal(supabase.state.agent_conversion_outcomes.length, 1);
    assert.equal(supabase.state.agent_conversion_outcomes[0].agent_id, "agent-1");
    assert.equal(supabase.state.agent_conversion_outcomes[0].owner_user_id, "owner-1");
  } finally {
    await server.close();
  }
});

test("Calendly webhook ignores unsupported cancellation events safely", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const payload = createInviteeCreatedPayload({ event: "invitee.canceled" });
  const rawBody = JSON.stringify(payload);

  try {
    const response = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Calendly-Webhook-Signature": signPayload(rawBody),
      },
      body: rawBody,
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.received, true);
    assert.equal(body.ignored, true);
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});

test("Calendly webhook rejects stale timestamp", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const payload = createInviteeCreatedPayload();
  const rawBody = JSON.stringify(payload);
  const staleTimestamp = Math.floor(Date.now() / 1000) - 600;

  try {
    const response = await fetch(`${server.baseUrl}/bookings/webhooks/calendly/${ENDPOINT_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Calendly-Webhook-Signature": signPayload(rawBody, staleTimestamp),
      },
      body: rawBody,
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid webhook request.");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});
