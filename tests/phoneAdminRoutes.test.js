import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { findPhoneNumberContextByTo } from "../src/services/phone/phoneNumberService.js";

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
        id: "agent-2",
        business_id: "business-2",
        owner_user_id: "owner-2",
        access_status: "active",
        is_active: true,
      },
    ],
    agent_phone_numbers: [],
    admin_audit_logs: [],
    ...overrides.state,
  };
  const counters = new Map();
  const nextId = (table) => {
    const next = (counters.get(table) || 0) + 1;
    counters.set(table, next);
    return `${table}-${next}`;
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
      this.filters.push((row) => String(row[column] ?? "") === String(value ?? ""));
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = Array.isArray(values) ? values : [values];
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    maybeSingle() {
      const result = this.#execute();
      return Promise.resolve({
        data: Array.isArray(result.data) && result.data[0] ? result.data[0] : null,
        error: result.error,
      });
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

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#matches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "insert") {
        const rows = this.#rows();
        const inserted = this.values.map((value) => {
          const row = {
            id: value.id || nextId(this.table),
            ...value,
          };
          rows.push(row);
          return { ...row };
        });

        return {
          data: inserted,
          error: null,
        };
      }

      if (this.operation === "update") {
        const updated = this.#matches().map((row) => {
          Object.assign(row, this.values);
          return { ...row };
        });

        return {
          data: updated,
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
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async (_supabase, req) => {
      const authHeader = String(req.headers.authorization || "");

      if (authHeader === "Bearer admin-session") {
        return { id: "admin-user-1", email: "admin@example.com" };
      }

      if (authHeader === "Bearer owner-session") {
        return { id: "owner-1", email: "owner@example.com" };
      }

      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    },
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

async function getJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  return {
    status: response.status,
    json: await response.json(),
  };
}

async function postJson(baseUrl, path, body, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    json: await response.json(),
  };
}

const adminHeaders = {
  Authorization: "Bearer admin-session",
};

const ownerHeaders = {
  Authorization: "Bearer owner-session",
};

test("phone number admin endpoints reject non-admin users", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const upsert = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        phone_number_e164: "+15551230010",
        status: "active",
        phone_channel_enabled: true,
      }, {
        headers: ownerHeaders,
      });
      const list = await getJson(
        server.baseUrl,
        "/admin/phone-numbers?agent_id=agent-1",
        { headers: ownerHeaders }
      );

      assert.equal(upsert.status, 403);
      assert.equal(list.status, 403);
      assert.equal(supabase.state.agent_phone_numbers.length, 0);
    } finally {
      await server.close();
    }
  });
});

test("admin can assign a valid phone number to an existing agent", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const response = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        phone_number_e164: "+1 (555) 123-0010",
        label: "Pilot line",
        status: "active",
        phone_channel_enabled: true,
        greeting_text: "Thanks for calling.",
        disclosure_text: "This call may be logged.",
        fallback_mode: "callback_only",
      }, {
        headers: adminHeaders,
      });
      const context = await findPhoneNumberContextByTo(supabase, {
        provider: "twilio",
        to: "+15551230010",
      });

      assert.equal(response.status, 200);
      assert.equal(response.json.phoneNumber.agentId, "agent-1");
      assert.equal(response.json.phoneNumber.phoneNumberE164, "+15551230010");
      assert.equal(response.json.phoneNumber.phoneChannelEnabled, true);
      assert.equal(context.phoneNumber.phoneNumberE164, "+15551230010");
      assert.equal(context.agent.id, "agent-1");
    } finally {
      await server.close();
    }
  });
});

test("admin can enable and disable the phone channel for an assigned number", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub({
      state: {
        agent_phone_numbers: [
          {
            id: "phone-1",
            agent_id: "agent-1",
            business_id: "business-1",
            owner_user_id: "owner-1",
            provider: "twilio",
            phone_number_e164: "+15551230020",
            status: "active",
            phone_channel_enabled: false,
            greeting_text: "Existing greeting",
            disclosure_text: "Existing disclosure",
            fallback_mode: "callback_only",
          },
        ],
      },
    });
    const server = await startServer(createApp(supabase));

    try {
      const enabled = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        phone_number_e164: "+15551230020",
        status: "active",
        phone_channel_enabled: true,
        fallback_mode: "callback_only",
      }, {
        headers: adminHeaders,
      });
      const disabled = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        phone_number_e164: "+15551230020",
        status: "disabled",
        phone_channel_enabled: false,
        fallback_mode: "callback_only",
      }, {
        headers: adminHeaders,
      });

      assert.equal(enabled.status, 200);
      assert.equal(enabled.json.phoneNumber.phoneChannelEnabled, true);
      assert.equal(disabled.status, 200);
      assert.equal(disabled.json.phoneNumber.status, "disabled");
      assert.equal(disabled.json.phoneNumber.phoneChannelEnabled, false);
      assert.equal(disabled.json.phoneNumber.greetingText, "Existing greeting");
      assert.equal(disabled.json.phoneNumber.disclosureText, "Existing disclosure");
      assert.equal(supabase.state.agent_phone_numbers.length, 1);
    } finally {
      await server.close();
    }
  });
});

test("admin phone number upsert rejects invalid E.164 numbers", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const response = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        phone_number_e164: "555-123",
        status: "active",
        phone_channel_enabled: true,
      }, {
        headers: adminHeaders,
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "invalid_phone_number_e164");
      assert.equal(supabase.state.agent_phone_numbers.length, 0);
    } finally {
      await server.close();
    }
  });
});

test("admin phone number upsert rejects owner and business mismatches", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub();
    const server = await startServer(createApp(supabase));

    try {
      const ownerMismatch = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        owner_user_id: "owner-2",
        phone_number_e164: "+15551230030",
        status: "active",
        phone_channel_enabled: true,
      }, {
        headers: adminHeaders,
      });
      const businessMismatch = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        business_id: "business-2",
        phone_number_e164: "+15551230031",
        status: "active",
        phone_channel_enabled: true,
      }, {
        headers: adminHeaders,
      });

      assert.equal(ownerMismatch.status, 400);
      assert.equal(ownerMismatch.json.code, "agent_owner_mismatch");
      assert.equal(businessMismatch.status, 400);
      assert.equal(businessMismatch.json.code, "agent_business_mismatch");
      assert.equal(supabase.state.agent_phone_numbers.length, 0);
    } finally {
      await server.close();
    }
  });
});

test("admin phone number upsert rejects duplicate active assignment", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub({
      state: {
        agent_phone_numbers: [
          {
            id: "phone-active",
            agent_id: "agent-2",
            business_id: "business-2",
            owner_user_id: "owner-2",
            provider: "twilio",
            phone_number_e164: "+15551230040",
            status: "active",
            phone_channel_enabled: true,
            fallback_mode: "callback_only",
          },
        ],
      },
    });
    const server = await startServer(createApp(supabase));

    try {
      const response = await postJson(server.baseUrl, "/admin/phone-numbers/upsert", {
        agent_id: "agent-1",
        phone_number_e164: "+15551230040",
        status: "active",
        phone_channel_enabled: true,
      }, {
        headers: adminHeaders,
      });

      assert.equal(response.status, 409);
      assert.equal(response.json.code, "duplicate_active_phone_number");
      assert.equal(supabase.state.agent_phone_numbers[0].agent_id, "agent-2");
    } finally {
      await server.close();
    }
  });
});

test("admin phone number list is scoped by agent", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1" }, async () => {
    const supabase = createSupabaseStub({
      state: {
        agent_phone_numbers: [
          {
            id: "phone-1",
            agent_id: "agent-1",
            business_id: "business-1",
            owner_user_id: "owner-1",
            provider: "twilio",
            phone_number_e164: "+15551230050",
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
            phone_number_e164: "+15551230051",
            status: "active",
            phone_channel_enabled: true,
            fallback_mode: "callback_only",
          },
        ],
      },
    });
    const server = await startServer(createApp(supabase));

    try {
      const response = await getJson(
        server.baseUrl,
        "/admin/phone-numbers?agent_id=agent-1",
        { headers: adminHeaders }
      );

      assert.equal(response.status, 200);
      assert.equal(response.json.phoneNumbers.length, 1);
      assert.equal(response.json.phoneNumbers[0].agentId, "agent-1");
      assert.equal(response.json.phoneNumbers[0].phoneNumberE164, "+15551230050");
    } finally {
      await server.close();
    }
  });
});
