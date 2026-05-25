import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import express from "express";

import { createPhoneRouter } from "../src/routes/phoneRoutes.js";
import {
  clearPhoneRateLimitForTests,
  computeTwilioSignature,
} from "../src/services/phone/twilioWebhookService.js";

const TWILIO_AUTH_TOKEN = "test-twilio-auth-token";

function withEnv(overrides, fn) {
  const previous = new Map();

  Object.entries(overrides).forEach(([key, value]) => {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      previous.forEach((value, key) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    });
}

function createSupabaseStub(overrides = {}) {
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
        id: "agent-suspended",
        business_id: "business-1",
        owner_user_id: "owner-1",
        access_status: "suspended",
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
    agent_phone_numbers: [
      {
        id: "phone-1",
        agent_id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        provider: "twilio",
        phone_number_e164: "+15551230001",
        label: "Main",
        status: "active",
        phone_channel_enabled: true,
        greeting_text: "Hello <VIP> & friends",
        disclosure_text: "Calls are logged & reviewed <securely>.",
        fallback_mode: "callback_only",
      },
      {
        id: "phone-disabled",
        agent_id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        provider: "twilio",
        phone_number_e164: "+15551230002",
        status: "active",
        phone_channel_enabled: false,
        fallback_mode: "callback_only",
      },
      {
        id: "phone-pending",
        agent_id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        provider: "twilio",
        phone_number_e164: "+15551230003",
        status: "pending",
        phone_channel_enabled: true,
        fallback_mode: "callback_only",
      },
      {
        id: "phone-suspended",
        agent_id: "agent-suspended",
        business_id: "business-1",
        owner_user_id: "owner-1",
        provider: "twilio",
        phone_number_e164: "+15551230004",
        status: "active",
        phone_channel_enabled: true,
        fallback_mode: "callback_only",
      },
      {
        id: "phone-2",
        agent_id: "agent-2",
        business_id: "business-2",
        owner_user_id: "owner-2",
        provider: "twilio",
        phone_number_e164: "+15551239999",
        status: "active",
        phone_channel_enabled: true,
        fallback_mode: "callback_only",
      },
    ],
    agent_phone_call_sessions: [],
    ...overrides.state,
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
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

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #rows() {
      if (!state[this.table]) {
        state[this.table] = [];
      }

      return state[this.table];
    }

    #matches() {
      return this.#rows().filter((row) => this.filters.every((filter) => filter(row)));
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];

      return {
        data: rows[0] ? { ...rows[0] } : null,
        error: null,
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

function createApp(supabase, deps = {}) {
  const app = express();
  app.use(createPhoneRouter({
    getSupabaseClient: () => supabase,
    getOwnerBillingSnapshot: async () => ({
      ownerUserId: "owner-1",
      usage: { isCapped: false },
    }),
    limitPhoneWebhook: (_req, _res, next) => next(),
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

function signTwilioRequest(url, params) {
  return computeTwilioSignature({
    url,
    params,
    authToken: TWILIO_AUTH_TOKEN,
  });
}

async function postTwilioForm(server, path, params, options = {}) {
  const body = new URLSearchParams(params);
  const signature = options.signature === undefined
    ? signTwilioRequest(`${server.baseUrl}${path}`, params)
    : options.signature;
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (signature) {
    headers["X-Twilio-Signature"] = signature;
  }

  return fetch(`${server.baseUrl}${path}`, {
    method: "POST",
    headers,
    body,
  });
}

function inboundParams(overrides = {}) {
  return {
    CallSid: "CA11111111111111111111111111111111",
    AccountSid: "AC11111111111111111111111111111111",
    From: "+15557654321",
    To: "+15551230001",
    CallStatus: "ringing",
    Direction: "inbound",
    ApiVersion: "2010-04-01",
    ...overrides,
  };
}

test.beforeEach(() => {
  clearPhoneRateLimitForTests();
});

test.afterEach(() => {
  clearPhoneRateLimitForTests();
});

test("Twilio inbound webhook rejects missing and invalid signatures", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const missing = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams(), {
        signature: "",
      });
      const invalid = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams({
        CallSid: "CA22222222222222222222222222222222",
      }), {
        signature: "bad-signature",
      });

      assert.equal(missing.status, 403);
      assert.equal(invalid.status, 403);
      assert.equal(supabase.state.agent_phone_call_sessions.length, 0);
    } finally {
      await server.close();
    }
  });
});

test("valid inbound call creates a scoped session and returns escaped static TwiML", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const response = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams());
      const twiml = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/xml/);
      assert.match(twiml, /Calls are logged &amp; reviewed &lt;securely&gt;\./);
      assert.match(twiml, /Hello &lt;VIP&gt; &amp; friends/);
      assert.match(twiml, /not fully live yet/i);
      assert.doesNotMatch(twiml, /<Gather/i);
      assert.equal(supabase.state.agent_phone_call_sessions.length, 1);
      assert.deepEqual(
        {
          phone_number_id: supabase.state.agent_phone_call_sessions[0].phone_number_id,
          agent_id: supabase.state.agent_phone_call_sessions[0].agent_id,
          business_id: supabase.state.agent_phone_call_sessions[0].business_id,
          owner_user_id: supabase.state.agent_phone_call_sessions[0].owner_user_id,
          caller_phone_e164: supabase.state.agent_phone_call_sessions[0].caller_phone_e164,
          called_phone_e164: supabase.state.agent_phone_call_sessions[0].called_phone_e164,
          status: supabase.state.agent_phone_call_sessions[0].status,
        },
        {
          phone_number_id: "phone-1",
          agent_id: "agent-1",
          business_id: "business-1",
          owner_user_id: "owner-1",
          caller_phone_e164: "+15557654321",
          called_phone_e164: "+15551230001",
          status: "greeting",
        }
      );
    } finally {
      await server.close();
    }
  });
});

test("inbound calls only greet active enabled phone numbers", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const disabled = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams({
        CallSid: "CAdisabled1111111111111111111111111",
        To: "+15551230002",
      }));
      const pending = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams({
        CallSid: "CApending11111111111111111111111111",
        To: "+15551230003",
      }));
      const disabledTwiml = await disabled.text();
      const pendingTwiml = await pending.text();

      assert.equal(disabled.status, 200);
      assert.equal(pending.status, 200);
      assert.match(disabledTwiml, /not available right now/i);
      assert.match(pendingTwiml, /not available right now/i);
      assert.equal(supabase.state.agent_phone_call_sessions.length, 2);
      assert.equal(supabase.state.agent_phone_call_sessions[0].status, "blocked");
      assert.equal(supabase.state.agent_phone_call_sessions[0].block_reason, "phone_channel_disabled");
      assert.equal(supabase.state.agent_phone_call_sessions[1].block_reason, "phone_number_inactive");
    } finally {
      await server.close();
    }
  });
});

test("suspended and capped owners are blocked before greeting", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase, {
      getOwnerBillingSnapshot: async (_supabase, options) => ({
        ownerUserId: options.ownerUserId,
        usage: { isCapped: options.ownerUserId === "owner-1" },
      }),
    }));

    try {
      const suspended = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams({
        CallSid: "CAsuspended11111111111111111111111",
        To: "+15551230004",
      }));
      const capped = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams({
        CallSid: "CAcapped11111111111111111111111111",
        To: "+15551230001",
      }));
      const suspendedTwiml = await suspended.text();
      const cappedTwiml = await capped.text();

      assert.equal(suspended.status, 200);
      assert.equal(capped.status, 200);
      assert.doesNotMatch(suspendedTwiml, /Hello/);
      assert.doesNotMatch(cappedTwiml, /Hello/);
      assert.equal(supabase.state.agent_phone_call_sessions[0].block_reason, "owner_access_inactive");
      assert.equal(supabase.state.agent_phone_call_sessions[1].block_reason, "owner_billing_capped");
    } finally {
      await server.close();
    }
  });
});

test("caller rate limiting blocks scoped inbound calls", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase, {
      checkCallerRateLimit: async () => ({
        allowed: false,
        reason: "caller_rate_limited",
      }),
    }));

    try {
      const response = await postTwilioForm(server, "/phone/twilio/inbound", inboundParams());
      const twiml = await response.text();

      assert.equal(response.status, 200);
      assert.match(twiml, /not available right now/i);
      assert.equal(supabase.state.agent_phone_call_sessions[0].status, "blocked");
      assert.equal(supabase.state.agent_phone_call_sessions[0].block_reason, "caller_rate_limited");
    } finally {
      await server.close();
    }
  });
});

test("status callback updates only a matching scoped phone session", async () => {
  await withEnv({ TWILIO_AUTH_TOKEN }, async () => {
    const supabase = createSupabaseStub({
      state: {
        agent_phone_call_sessions: [
          {
            id: "session-1",
            phone_number_id: "phone-1",
            agent_id: "agent-1",
            business_id: "business-1",
            owner_user_id: "owner-1",
            provider: "twilio",
            provider_call_sid: "CAstatus1111111111111111111111111",
            caller_phone_e164: "+15557654321",
            called_phone_e164: "+15551230001",
            status: "greeting",
            metadata: {},
          },
        ],
      },
    });
    const server = await startServer(createApp(supabase));

    try {
      const wrongScope = await postTwilioForm(server, "/phone/twilio/status", inboundParams({
        CallSid: "CAstatus1111111111111111111111111",
        To: "+15551239999",
        CallStatus: "completed",
        CallDuration: "12",
      }));

      assert.equal(wrongScope.status, 200);
      assert.equal(supabase.state.agent_phone_call_sessions[0].status, "greeting");
      assert.equal(supabase.state.agent_phone_call_sessions[0].ended_at, undefined);

      const correctScope = await postTwilioForm(server, "/phone/twilio/status", inboundParams({
        CallSid: "CAstatus1111111111111111111111111",
        To: "+15551230001",
        CallStatus: "completed",
        CallDuration: "12",
      }));
      const twiml = await correctScope.text();

      assert.equal(correctScope.status, 200);
      assert.match(twiml, /<Response><\/Response>/);
      assert.equal(supabase.state.agent_phone_call_sessions[0].status, "completed");
      assert.ok(supabase.state.agent_phone_call_sessions[0].ended_at);
      assert.equal(
        supabase.state.agent_phone_call_sessions[0].metadata.status_callback.call_duration,
        "12"
      );
    } finally {
      await server.close();
    }
  });
});

test("phone schema and owner-scoped policies are represented in schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260525000000_phone_front_desk_phase_1b.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_phone_numbers/i);
    assert.match(sql, /create table if not exists public\.agent_phone_call_sessions/i);
    assert.match(sql, /alter table public\.agent_phone_numbers enable row level security/i);
    assert.match(sql, /alter table public\.agent_phone_call_sessions enable row level security/i);
    assert.match(sql, /owner_user_id = \(select auth\.uid\(\)\)/i);
  });
});
