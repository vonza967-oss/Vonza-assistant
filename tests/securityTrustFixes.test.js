import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createChatRouter } from "../src/routes/chatRoutes.js";
import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { createPublicRouter } from "../src/routes/publicRoutes.js";
import { handleChatRequest } from "../src/services/chat/chatService.js";
import {
  listAgents,
  requirePublicFullPageAccess,
  requireActiveAgentAccess,
  requirePreClaimAgentAccess,
} from "../src/services/agents/agentService.js";
import {
  completeGoogleConnection,
  createGoogleConnectionStart,
} from "../src/services/operator/operatorWorkspaceService.js";
import { clearChatRateLimitForTests } from "../src/utils/httpGuards.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createFakeSupabase(initialState = {}) {
  const state = Object.fromEntries(
    Object.entries({
      agents: [],
      businesses: [],
      widget_configs: [],
      website_content: [],
      messages: [],
      agent_contact_leads: [],
      agent_follow_up_workflows: [],
      agent_action_queue_statuses: [],
      agent_widget_events: [],
      agent_visitor_reply_feedback: [],
      agent_installations: [],
      google_oauth_states: [],
      google_connected_accounts: [],
      operator_audit_logs: [],
      operator_workspace_activations: [],
      ...initialState,
    }).map(([key, rows]) => [key, (rows || []).map((row) => ({ ...row }))])
  );
  const counters = new Map();
  const nextId = (table) => {
    const next = (counters.get(table) || 0) + 1;
    counters.set(table, next);
    return `${table}-${next}`;
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.mode = "select";
      this.filters = [];
      this.payload = null;
      this.orderBy = null;
      this.limitValue = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select() {
      return this;
    }

    insert(payload) {
      this.mode = "insert";
      this.payload = Array.isArray(payload) ? payload : [payload];
      return this;
    }

    update(payload) {
      this.mode = "update";
      this.payload = payload;
      return this;
    }

    eq(field, value) {
      this.filters.push({ type: "eq", field, value });
      return this;
    }

    is(field, value) {
      this.filters.push({ type: "is", field, value });
      return this;
    }

    in(field, values) {
      this.filters.push({ type: "in", field, values });
      return this;
    }

    gte(field, value) {
      this.filters.push({ type: "gte", field, value });
      return this;
    }

    order(field, options = {}) {
      this.orderBy = { field, ascending: options.ascending !== false };
      return this;
    }

    limit(value) {
      this.limitValue = value;
      return this;
    }

    single() {
      this.expectSingle = true;
      return this.execute();
    }

    maybeSingle() {
      this.expectMaybeSingle = true;
      return this.execute();
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    getRows() {
      if (!state[this.table]) {
        state[this.table] = [];
      }
      return state[this.table];
    }

    applyFilters(rows) {
      let result = rows.filter((row) =>
        this.filters.every((filter) => {
          if (filter.type === "eq") {
            return String(row[filter.field] ?? "") === String(filter.value ?? "");
          }

          if (filter.type === "is") {
            return filter.value === null
              ? row[filter.field] === null || row[filter.field] === undefined
              : row[filter.field] === filter.value;
          }

          if (filter.type === "in") {
            return (filter.values || []).includes(row[filter.field]);
          }

          if (filter.type === "gte") {
            return new Date(row[filter.field] || 0).getTime() >= new Date(filter.value || 0).getTime();
          }

          return true;
        })
      );

      if (this.orderBy) {
        const { field, ascending } = this.orderBy;
        result = [...result].sort((left, right) => {
          const leftValue = new Date(left[field] || 0).getTime();
          const rightValue = new Date(right[field] || 0).getTime();
          return ascending ? leftValue - rightValue : rightValue - leftValue;
        });
      }

      if (Number.isFinite(this.limitValue)) {
        result = result.slice(0, this.limitValue);
      }

      return result;
    }

    finish(rows) {
      if (this.expectSingle || this.expectMaybeSingle) {
        return Promise.resolve({ data: rows[0] || null, error: null });
      }

      return Promise.resolve({ data: rows, error: null });
    }

    async execute() {
      const rows = this.getRows();

      if (this.mode === "insert") {
        const inserted = this.payload.map((entry) => {
          const row = {
            id: entry.id || nextId(this.table),
            created_at: entry.created_at || new Date().toISOString(),
            ...entry,
          };
          rows.push(row);
          return { ...row };
        });
        return this.finish(inserted);
      }

      if (this.mode === "update") {
        const updated = this.applyFilters(rows).map((row) => {
          Object.assign(row, this.payload);
          return { ...row };
        });
        return this.finish(updated);
      }

      return this.finish(this.applyFilters(rows).map((row) => ({ ...row })));
    }
  }

  return {
    state,
    from(table) {
      return new QueryBuilder(table);
    },
  };
}

function buildAgentRow(overrides = {}) {
  return {
    id: "agent-1",
    business_id: "business-1",
    client_id: "client-1",
    owner_user_id: "",
    access_status: "active",
    public_agent_key: "agent-key",
    name: "Vonza",
    purpose: "help",
    system_prompt: "",
    tone: "friendly",
    language: "English",
    is_active: true,
    created_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildChatState() {
  return {
    agents: [
      buildAgentRow({
        owner_user_id: "owner-1",
      }),
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza Plumbing",
        website_url: "https://allowed.example",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        install_id: "install-1",
        allowed_domains: ["allowed.example"],
        assistant_name: "Vonza Plumbing",
        welcome_message: "Welcome",
        button_label: "Send",
        primary_color: "#111111",
        secondary_color: "#222222",
        launcher_text: "CHAT",
        theme_mode: "dark",
      },
    ],
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Vonza Plumbing",
        meta_description: "Plumbing help",
        content: "sensitive-business-reference\nPricing starts at $100.\nBook emergency plumbing online.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
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

async function postJson(baseUrl, pathname, body, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

async function getJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: options.headers || {},
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

function withEnv(overrides, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("post-claim client_id access is rejected and missing bearer auth returns 401", async () => {
  const supabase = createFakeSupabase({
    agents: [
      buildAgentRow({
        owner_user_id: "owner-1",
      }),
    ],
  });

  await assert.rejects(
    requireActiveAgentAccess(supabase, {
      agentId: "agent-1",
      clientId: "client-1",
    }),
    (error) => error.statusCode === 401 && /authenticated owner/i.test(error.message)
  );

  await assert.rejects(
    requireActiveAgentAccess(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-2",
      clientId: "client-1",
    }),
    (error) => error.statusCode === 403
  );

  const agent = await requireActiveAgentAccess(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    clientId: "client-1",
  });

  assert.equal(agent.id, "agent-1");
});

test("client_id-only listing only returns pre-claim onboarding assistants", async () => {
  const supabase = createFakeSupabase({
    agents: [
      buildAgentRow({
        id: "claimed-agent",
        owner_user_id: "owner-1",
      }),
      buildAgentRow({
        id: "preclaim-agent",
        owner_user_id: null,
        public_agent_key: "preclaim-key",
      }),
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://allowed.example",
      },
    ],
    widget_configs: [
      {
        agent_id: "preclaim-agent",
        assistant_name: "Preclaim",
        install_id: "install-preclaim",
        allowed_domains: ["allowed.example"],
      },
    ],
  });

  const result = await listAgents(supabase, {
    clientId: "client-1",
  });

  assert.deepEqual(result.agents.map((agent) => agent.id), ["preclaim-agent"]);
});

test("expired pre-claim client_id tokens cannot access setup-only agent routes", async () => {
  await withEnv({ AGENT_PRECLAIM_TOKEN_TTL_HOURS: "1" }, async () => {
    const supabase = createFakeSupabase({
      agents: [
        buildAgentRow({
          owner_user_id: "",
          client_id: "client-1",
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });

    await assert.rejects(
      () => requirePreClaimAgentAccess(supabase, {
        agentId: "agent-1",
        clientId: "client-1",
      }),
      (error) => error.statusCode === 401 && error.code === "preclaim_token_expired"
    );
  });
});

test("public full-page access requires an active claimed owner context", () => {
  const baseContext = {
    agent: {
      id: "agent-1",
      ownerUserId: "owner-1",
      accessStatus: "active",
    },
    widgetConfig: {
      fullPageConfig: {
        publicPageEnabled: true,
        publicPageKey: "page-key-1",
      },
    },
  };

  assert.doesNotThrow(() => requirePublicFullPageAccess(baseContext, {
    publicPageKey: "page-key-1",
  }));

  assert.throws(
    () => requirePublicFullPageAccess({
      ...baseContext,
      agent: {
        ...baseContext.agent,
        ownerUserId: "",
      },
    }, {
      publicPageKey: "page-key-1",
    }),
    /public assistant page is not available/i
  );

  assert.throws(
    () => requirePublicFullPageAccess({
      ...baseContext,
      agent: {
        ...baseContext.agent,
        accessStatus: "pending",
      },
    }, {
      publicPageKey: "page-key-1",
    }),
    /public assistant page is not available/i
  );
});

test("page-mode public bootstrap returns a generic unavailable error", async () => {
  const app = express();
  app.use(createAgentRouter({
    getSupabaseClient: () => ({}),
    getWidgetBootstrap: async () => {
      const error = new Error("Agent not found");
      error.statusCode = 404;
      error.code = "public_widget_not_found";
      throw error;
    },
    limitWidgetBootstrap: (_req, _res, next) => next(),
  }));
  const server = await startServer(app);

  try {
    const response = await getJson(server.baseUrl, "/widget/bootstrap?agent_id=bad-id&mode=page");

    assert.equal(response.status, 404);
    assert.deepEqual(response.json, { error: "Assistant unavailable" });
  } finally {
    await server.close();
  }
});

test("claimed owner routes reject unauthenticated client_id fallback", async () => {
  const supabase = createFakeSupabase({
    agents: [
      buildAgentRow({
        owner_user_id: "owner-1",
      }),
    ],
  });
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async () => {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    },
    listAgentMessages: async () => {
      throw new Error("messages should not be read without owner auth");
    },
    buildActionQueue: () => {
      throw new Error("action queue should not be built without owner auth");
    },
    updateAgentSettings: async () => {
      throw new Error("claimed agent should not be updated without owner auth");
    },
    deleteAgent: async () => {
      throw new Error("claimed agent should not be deleted without owner auth");
    },
  }));
  const server = await startServer(app);

  try {
    const messageRead = await getJson(
      server.baseUrl,
      "/agents/messages?agent_id=agent-1&client_id=client-1"
    );
    const queueRead = await getJson(
      server.baseUrl,
      "/agents/action-queue?agent_id=agent-1&client_id=client-1"
    );
    const update = await postJson(server.baseUrl, "/agents/update", {
      agent_id: "agent-1",
      client_id: "client-1",
      assistant_name: "Unsafe update",
    });
    const deletion = await postJson(server.baseUrl, "/agents/delete", {
      agent_id: "agent-1",
      client_id: "client-1",
    });

    assert.equal(messageRead.status, 401);
    assert.equal(queueRead.status, 401);
    assert.equal(update.status, 401);
    assert.equal(deletion.status, 401);
  } finally {
    await server.close();
  }
});

test("widget reply feedback persists once per assistant message without raw contact details", async () => {
  clearChatRateLimitForTests();
  const supabase = createFakeSupabase({
    ...buildChatState(),
    agent_visitor_reply_feedback: [],
  });
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
  }));
  const server = await startServer(app);
  const body = {
    install_id: "install-1",
    origin: "https://allowed.example",
    page_url: "https://allowed.example/pricing",
    session_key: "session-1",
    assistant_message_key: "session-1::0::101",
    rating: "not_helpful",
    message_context: {
      reply_length: 142,
      visitor_email: "must-not-store@example.com",
    },
  };

  try {
    const first = await postJson(server.baseUrl, "/chat/feedback", body);
    const duplicate = await postJson(server.baseUrl, "/chat/feedback", body);

    assert.equal(first.status, 200);
    assert.equal(first.json.duplicate, false);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.json.duplicate, true);
    assert.equal(supabase.state.agent_visitor_reply_feedback.length, 1);
    assert.equal(supabase.state.agent_visitor_reply_feedback[0].rating, "not_helpful");
    assert.deepEqual(supabase.state.agent_visitor_reply_feedback[0].message_context, {
      replyLength: 142,
      conversationIndex: 0,
    });
    assert.equal(JSON.stringify(supabase.state.agent_visitor_reply_feedback).includes("must-not-store"), false);
  } finally {
    await server.close();
  }
});

test("widget reply feedback rejects session-level spam while preserving idempotent repeats", async () => {
  clearChatRateLimitForTests();
  const existingFeedback = Array.from({ length: 25 }, (_entry, index) => ({
    id: `feedback-${index + 1}`,
    agent_id: "agent-1",
    install_id: "install-1",
    session_key: "session-1",
    assistant_message_key: `session-1::${index + 1}::101`,
    rating: "not_helpful",
    message_context: {},
    created_at: "2026-04-01T12:00:00.000Z",
  }));
  const supabase = createFakeSupabase({
    ...buildChatState(),
    agent_visitor_reply_feedback: existingFeedback,
  });
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
  }));
  const server = await startServer(app);
  const baseBody = {
    install_id: "install-1",
    origin: "https://allowed.example",
    page_url: "https://allowed.example/pricing",
    session_key: "session-1",
    rating: "not_helpful",
  };

  try {
    const duplicate = await postJson(server.baseUrl, "/chat/feedback", {
      ...baseBody,
      assistant_message_key: "session-1::1::101",
    });
    const spam = await postJson(server.baseUrl, "/chat/feedback", {
      ...baseBody,
      assistant_message_key: "session-1::26::999",
    });

    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.json.duplicate, true);
    assert.equal(spam.status, 429);
    assert.equal(supabase.state.agent_visitor_reply_feedback.length, 25);
  } finally {
    await server.close();
  }
});

test("widget reply feedback rejects assistant-message keys replayed from another session", async () => {
  clearChatRateLimitForTests();
  const supabase = createFakeSupabase({
    ...buildChatState(),
    agent_visitor_reply_feedback: [],
  });
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
  }));
  const server = await startServer(app);

  try {
    const response = await postJson(server.baseUrl, "/chat/feedback", {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      session_key: "session-1",
      assistant_message_key: "other-session::0::101",
      rating: "not_helpful",
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.error, "The request could not be processed.");
    assert.equal(response.json.code, "feedback_session_mismatch");
    assert.equal(supabase.state.agent_visitor_reply_feedback.length, 0);
  } finally {
    await server.close();
  }
});

test("owner feedback API requires authenticated owner access", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    agent_visitor_reply_feedback: [
      {
        id: "feedback-1",
        agent_id: "agent-1",
        install_id: "install-1",
        session_key: "session-1",
        assistant_message_key: "assistant-message-1",
        rating: "helpful",
        message_context: {
          replyLength: 80,
        },
        created_at: "2026-04-01T12:00:00.000Z",
      },
    ],
  });
  const unauthenticatedApp = express();
  unauthenticatedApp.use(express.json());
  unauthenticatedApp.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async () => {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    },
  }));
  const authenticatedApp = express();
  authenticatedApp.use(express.json());
  authenticatedApp.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
  }));
  const unauthenticatedServer = await startServer(unauthenticatedApp);
  const authenticatedServer = await startServer(authenticatedApp);

  try {
    const rejected = await getJson(
      unauthenticatedServer.baseUrl,
      "/dashboard/feedback?agent_id=agent-1&client_id=client-1"
    );
    const accepted = await getJson(
      authenticatedServer.baseUrl,
      "/dashboard/feedback?agent_id=agent-1"
    );

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.summary.total, 1);
    assert.equal(accepted.json.records[0].rating, "helpful");
  } finally {
    await unauthenticatedServer.close();
    await authenticatedServer.close();
  }
});

test("/chat rejects disallowed origins across install_id, website_url, agent_id, and agent_key", async () => {
  const supabase = createFakeSupabase(buildChatState());
  let openAiCalled = false;
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
    getOpenAIClient: () => ({
      chat: {
        completions: {
          create: async () => {
            openAiCalled = true;
            return { choices: [{ message: { content: "not reached" } }] };
          },
        },
      },
    }),
  }));
  const server = await startServer(app);
  const resolutionCases = [
    {
      label: "install_id",
      body: {
        install_id: "install-1",
      },
    },
    {
      label: "website_url",
      body: {
        website_url: "https://allowed.example",
      },
    },
    {
      label: "agent_id",
      body: {
        agent_id: "agent-1",
      },
    },
    {
      label: "agent_key",
      body: {
        agent_key: "agent-key",
      },
    },
  ];

  try {
    for (const entry of resolutionCases) {
      const response = await postJson(server.baseUrl, "/chat", {
        ...entry.body,
        origin: "https://evil.example",
        page_url: "https://evil.example/page",
        message: "What does this cost?",
      });

      assert.equal(response.status, 403, `${entry.label} blocks an unapproved origin`);
      assert.equal(response.json.error, "You do not have access to this resource.");
      assert.equal(response.json.code, "domain_blocked");
    }

    assert.equal(openAiCalled, false);
  } finally {
    await server.close();
  }
});

test("/chat allows approved origins across install_id, website_url, agent_id, and agent_key", async () => {
  const supabase = createFakeSupabase(buildChatState());
  let openAiCalls = 0;
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
    getOpenAIClient: () => ({
      chat: {
        completions: {
          create: async () => {
            openAiCalls += 1;
            return { choices: [{ message: { content: "Approved path works." } }] };
          },
        },
      },
    }),
  }));
  const server = await startServer(app);
  const resolutionCases = [
    {
      label: "install_id",
      body: {
        install_id: "install-1",
      },
    },
    {
      label: "website_url",
      body: {
        website_url: "https://allowed.example",
      },
    },
    {
      label: "agent_id",
      body: {
        agent_id: "agent-1",
      },
    },
    {
      label: "agent_key",
      body: {
        agent_key: "agent-key",
      },
    },
  ];

  try {
    for (const entry of resolutionCases) {
      const response = await postJson(server.baseUrl, "/chat", {
        ...entry.body,
        origin: "https://allowed.example",
        page_url: "https://allowed.example/pricing",
        message: "Hello there",
      });

      assert.equal(response.status, 200, `${entry.label} allows the approved origin`);
      assert.equal(response.json.agentId, "agent-1");
      assert.equal(response.json.agentKey, "agent-key");
      assert.equal(response.json.businessId, "business-1");
      assert.equal(response.json.reply, "Approved path works.");
    }

    assert.ok(openAiCalls >= resolutionCases.length);
  } finally {
    await server.close();
  }
});

test("/chat rate limiting does not trust spoofed x-forwarded-for from untrusted clients", async () => {
  clearChatRateLimitForTests();
  const supabase = createFakeSupabase(buildChatState());
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
    getOpenAIClient: () => ({
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: "Allowed." } }] }),
        },
      },
    }),
  }));
  const server = await startServer(app);

  try {
    let lastResponse = null;

    for (let index = 0; index < 21; index += 1) {
      const response = await fetch(`${server.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `203.0.113.${index}`,
        },
        body: JSON.stringify({
          install_id: "install-1",
          session_id: "session-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/pricing",
          message: "Hello there",
        }),
      });

      lastResponse = {
        status: response.status,
        json: await response.json(),
      };
    }

    assert.equal(lastResponse.status, 429);
    assert.match(lastResponse.json.error, /too many chat requests/i);
  } finally {
    await server.close();
    clearChatRateLimitForTests();
  }
});

test("/chat/capture rejects disallowed origins across install_id, website_url, agent_id, and agent_key", async () => {
  const supabase = createFakeSupabase(buildChatState());
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
  }));
  const server = await startServer(app);
  const resolutionCases = [
    {
      label: "install_id",
      body: {
        install_id: "install-1",
      },
    },
    {
      label: "website_url",
      body: {
        website_url: "https://allowed.example",
      },
    },
    {
      label: "agent_id",
      body: {
        agent_id: "agent-1",
      },
    },
    {
      label: "agent_key",
      body: {
        agent_key: "agent-key",
      },
    },
  ];

  try {
    for (const entry of resolutionCases) {
      const response = await postJson(server.baseUrl, "/chat/capture", {
        ...entry.body,
        origin: "https://evil.example",
        page_url: "https://evil.example/page",
        action: "decline",
        reference_message: "What does this cost?",
      });

      assert.equal(response.status, 403, `${entry.label} blocks an unapproved origin`);
      assert.equal(response.json.error, "You do not have access to this resource.");
      assert.equal(response.json.code, "domain_blocked");
    }
  } finally {
    await server.close();
  }
});

test("protected owner routes return 401 when bearer auth is missing", async () => {
  const supabase = createFakeSupabase();
  let accessChecked = false;
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    requireActiveAgentAccess: async () => {
      accessChecked = true;
      return { id: "agent-1" };
    },
  }));
  const server = await startServer(app);

  try {
    const response = await getJson(server.baseUrl, "/agents/operator-workspace?agent_id=agent-1");

    assert.equal(response.status, 401);
    assert.match(response.json.error, /unauthorized/i);
    assert.equal(accessChecked, false);
  } finally {
    await server.close();
  }
});

test("admin APIs require authenticated RBAC admins and reject static tokens", async () => {
  await withEnv({ VONZA_ADMIN_USER_IDS: "admin-user-1", ADMIN_TOKEN: "admin-1234" }, async () => {
    const supabase = createFakeSupabase({
      agents: [
        buildAgentRow({
          name: "Admin Safe Agent",
          owner_user_id: "owner-1",
        }),
      ],
      businesses: [
        {
          id: "business-1",
          name: "Vonza",
          website_url: "https://allowed.example",
        },
      ],
      widget_configs: [
        {
          agent_id: "agent-1",
          assistant_name: "Admin Safe Agent",
          install_id: "install-1",
          allowed_domains: ["allowed.example"],
        },
      ],
    });
    const app = express();
    app.use(express.json());
    app.use(createAgentRouter({
      getSupabaseClient: () => supabase,
      getAuthenticatedUser: async (_supabase, req) => {
        const authHeader = String(req.headers.authorization || "");
        if (authHeader === "Bearer admin-session") {
          return { id: "admin-user-1", email: "admin@example.com" };
        }
        const error = new Error("Unauthorized");
        error.statusCode = 401;
        throw error;
      },
    }));
    const server = await startServer(app);

    try {
      const queryTokenResponse = await getJson(
        server.baseUrl,
        "/agents/admin-list?token=admin-1234"
      );
      assert.equal(queryTokenResponse.status, 401);
      assert.match(queryTokenResponse.json.error, /unauthorized/i);

      const headerTokenResponse = await getJson(
        server.baseUrl,
        "/agents/admin-list",
        {
          headers: {
            "x-admin-token": "admin-1234",
          },
        }
      );
      assert.equal(headerTokenResponse.status, 401);

      const rbacResponse = await getJson(
        server.baseUrl,
        "/agents/admin-list",
        {
          headers: {
            Authorization: "Bearer admin-session",
          },
        }
      );
      assert.equal(rbacResponse.status, 200);
      assert.equal(rbacResponse.json.agents.length, 1);
      assert.equal(supabase.state.admin_audit_logs.length >= 1, true);
    } finally {
      await server.close();
    }
  });
});

test("/product-events requires owner auth or validated public install context", async () => {
  const supabase = createFakeSupabase({
    agents: [
      buildAgentRow({
        id: "agent-1",
        owner_user_id: "owner-1",
        access_status: "active",
      }),
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://allowed.example",
      },
    ],
    widget_configs: [
      {
        agent_id: "agent-1",
        assistant_name: "Front Desk",
        install_id: "install-1",
        allowed_domains: ["allowed.example"],
      },
    ],
  });
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async (_supabase, req) => {
      if (req.headers.authorization === "Bearer owner-token") {
        return { id: "owner-1", email: "owner@example.com" };
      }
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    },
  }));
  const server = await startServer(app);

  try {
    const forged = await postJson(server.baseUrl, "/product-events", {
      client_id: "client-1",
      agent_id: "agent-1",
      event_name: "preview_opened",
      source: "forged",
    });

    assert.equal(forged.status, 400);
    assert.equal(forged.json.code, "origin_required");

    const ownerEvent = await postJson(server.baseUrl, "/product-events", {
      client_id: "client-1",
      agent_id: "agent-1",
      event_name: "preview_opened",
      source: "dashboard",
      metadata: {
        visitor_email: "person@example.com",
        surface: "front_desk",
      },
    }, {
      headers: {
        Authorization: "Bearer owner-token",
      },
    });

    assert.equal(ownerEvent.status, 200);
    assert.equal(ownerEvent.json.ok, true);
    assert.equal(supabase.state.product_events.length, 1);
    assert.equal(supabase.state.product_events[0].owner_user_id, "owner-1");
    assert.deepEqual(supabase.state.product_events[0].metadata, { surface: "front_desk" });

    const duplicate = await postJson(server.baseUrl, "/product-events", {
      client_id: "client-1",
      agent_id: "agent-1",
      event_name: "preview_opened",
      source: "dashboard",
    }, {
      headers: {
        Authorization: "Bearer owner-token",
      },
    });

    assert.equal(duplicate.status, 200);
    assert.equal(supabase.state.product_events.length, 2);
    assert.equal(supabase.state.product_events[0].dedupe_key, supabase.state.product_events[1].dedupe_key);
  } finally {
    await server.close();
  }
});

test("/admin is not publicly reachable as a normal route", async () => {
  const app = express();
  app.use(createPublicRouter({ rootDir: repoRoot }));
  const server = await startServer(app);

  try {
    const response = await getJson(server.baseUrl, "/admin");

    assert.equal(response.status, 404);
    assert.equal(response.json.error, "Not found");
  } finally {
    await server.close();
  }
});

test("/chat with only an unknown agent_id fails consistently instead of falling into business validation", async () => {
  const supabase = createFakeSupabase();
  let openAiCalled = false;

  await assert.rejects(
    handleChatRequest({
      supabase,
      openai: {
        chat: {
          completions: {
            create: async () => {
              openAiCalled = true;
              return { choices: [{ message: { content: "not reached" } }] };
            },
          },
        },
      },
      body: {
        agent_id: "missing-agent",
        message: "Hello",
      },
    }),
    (error) => error.statusCode === 404 && /agent not found/i.test(error.message)
  );

  assert.equal(openAiCalled, false);
});

test("chat logging emits metadata without raw conversation or business content", async () => {
  const supabase = createFakeSupabase(buildChatState());
  const records = [];
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args) => records.push(args);
  console.info = (...args) => records.push(args);
  console.warn = (...args) => records.push(args);
  console.error = (...args) => records.push(args);

  try {
    const result = await handleChatRequest({
      supabase,
      openai: {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: "generated-reply-secret",
                  },
                },
              ],
            }),
          },
        },
      },
      body: {
        install_id: "install-1",
        origin: "https://allowed.example",
        page_url: "https://allowed.example/pricing",
        visitor_session_key: "session-1",
        message: "Please never log secret-chat-phrase or customer@example.com. What does this cost?",
        history: [
          {
            role: "user",
            content: "history-secret-phrase",
          },
        ],
      },
    });

    assert.equal(result.reply, "generated-reply-secret");
  } finally {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }

  const logged = records.map((entry) => JSON.stringify(entry)).join("\n");
  assert.doesNotMatch(logged, /secret-chat-phrase/);
  assert.doesNotMatch(logged, /customer@example\.com/);
  assert.doesNotMatch(logged, /history-secret-phrase/);
  assert.doesNotMatch(logged, /sensitive-business-reference/);
  assert.doesNotMatch(logged, /generated-reply-secret/);
  assert.match(logged, /messageLength/);
});

test("/chat returns speech authorization only for final replies when spoken replies are enabled", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "chat-speech-token-secret" }, async () => {
    const records = [];
    const originalConsole = {
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    console.info = (...args) => records.push(args);
    console.warn = (...args) => records.push(args);
    console.error = (...args) => records.push(args);

    try {
      const disabledResult = await handleChatRequest({
        supabase: createFakeSupabase(buildChatState()),
        openai: {
          chat: {
            completions: {
              create: async () => ({ choices: [{ message: { content: "Spoken replies are disabled." } }] }),
            },
          },
        },
        body: {
          install_id: "install-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/services",
          visitor_session_key: "session-1",
          message: "What services do you offer?",
        },
      });

      assert.equal(disabledResult.speech, undefined);

      const enabledState = buildChatState();
      enabledState.widget_configs[0].voice_config = {
        voice_input_enabled: true,
        spoken_replies_enabled: true,
        auto_send_transcript: false,
        auto_play_spoken_replies: false,
        voice: "sage",
        language_behavior: "auto",
      };
      const enabledResult = await handleChatRequest({
        supabase: createFakeSupabase(enabledState),
        openai: {
          chat: {
            completions: {
              create: async () => ({ choices: [{ message: { content: "We can explain the available services." } }] }),
            },
          },
        },
        body: {
          install_id: "install-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/services",
          visitor_session_key: "session-1",
          message: "What services do you offer?",
        },
      });

      assert.equal(enabledResult.reply, "We can explain the available services.");
      assert.match(enabledResult.speech?.token || "", /^vst1\./);
      assert.match(enabledResult.speech?.expiresAt || "", /^\d{4}-\d{2}-\d{2}T/);

      const logged = records.map((entry) => JSON.stringify(entry)).join("\n");
      assert.doesNotMatch(logged, new RegExp(enabledResult.speech.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(logged, /chat-speech-token-secret/);
    } finally {
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    }
  });
});

test("chat response language follows customer messages instead of website context", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Magyar szolgáltató",
        meta_description: "Webshop készítés és karbantartás.",
        content: "Webshop készítés, keresőoptimalizálás és karbantartás. Email: hello@pelda.hu. Telefon: +36 30 123 4567.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });
  const calls = [];

  await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            const systemPrompt = payload.messages.find((message) => message.role === "system")?.content || "";
            return {
              choices: [
                {
                  message: {
                    content: systemPrompt.includes("Reply in Hungarian")
                      ? "Igen, segítek. Miben segíthetek?"
                      : "Sure, I can help. What would you like next?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      visitor_session_key: "session-language",
      message: "Yes please, I want a webshop.",
    },
  });

  assert.match(calls[0].messages[0].content, /Reply in English/);
  assert.match(calls[0].messages[0].content, /Do not choose the response language from the business website language/);

  calls.length = 0;
  await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: "Igen, segítek. Miben segíthetek?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      visitor_session_key: "session-language",
      message: "ok",
      history: [
        {
          role: "user",
          content: "Webshopot szeretnék.",
        },
      ],
    },
  });

  assert.match(calls[0].messages[0].content, /Reply in Hungarian/);
});

test("web call chat requests add spoken-friendly prompt guidance without weakening guardrails", async () => {
  const chatState = buildChatState();
  chatState.widget_configs[0].full_page_config = {
    public_page_enabled: true,
    public_page_key: "page-key",
  };
  const supabase = createFakeSupabase(chatState);
  const calls = [];

  await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: "Pricing starts at $100. Would you like to leave contact details for a quote?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/front-desk",
      display_mode: "page",
      conversation_source: "web_call",
      public_page_key: "page-key",
      visitor_session_key: "session-web-call-prompt",
      message: "Can I get pricing?",
    },
  });

  const systemPrompt = calls[0].messages.find((message) => message.role === "system")?.content || "";
  assert.match(systemPrompt, /Web Call spoken response style/i);
  assert.match(systemPrompt, /one or two short paragraphs maximum/i);
  assert.match(systemPrompt, /Ask only one follow-up question at a time/i);
  assert.match(systemPrompt, /Preserve all factual guardrails/i);
  assert.match(systemPrompt, /Do not invent facts, services, prices, or guarantees/i);
});

test("normal hosted page chat does not add web call spoken prompt guidance", async () => {
  const chatState = buildChatState();
  chatState.widget_configs[0].full_page_config = {
    public_page_enabled: true,
    public_page_key: "page-key",
  };
  const supabase = createFakeSupabase(chatState);
  const calls = [];

  await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: "Pricing starts at $100. Would you like the booking link?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/front-desk",
      display_mode: "page",
      public_page_key: "page-key",
      visitor_session_key: "session-page-prompt",
      message: "Can I get pricing?",
    },
  });

  const systemPrompt = calls[0].messages.find((message) => message.role === "system")?.content || "";
  assert.doesNotMatch(systemPrompt, /Web Call spoken response style/i);
  assert.match(systemPrompt, /Use short, readable answers with 1-2 sentence paragraphs/i);
});

test("front-desk answers use low temperature and repair invented pricing when pricing data is missing", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Vonza Plumbing",
        meta_description: "Plumbing help",
        content: "Vonza Plumbing handles customer requests through a contact form. No prices are published.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });
  const calls = [];

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: calls.length === 1
                      ? "Emergency plumbing starts at $99. What time do you need help?"
                      : "I do not have a published emergency plumbing price from the business details here. Would you like to share what happened so the team can quote the right next step?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      visitor_session_key: "session-pricing-guard",
      message: "What is the emergency plumbing price?",
    },
  });

  assert.equal(calls[0].temperature, 0.3);
  assert.equal(calls[1].temperature, 0.25);
  assert.doesNotMatch(result.reply, /\$99/);
  assert.match(result.reply, /do not have a published emergency plumbing price/i);
});

test("front-desk answer repair removes invented services when service data is missing", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Vonza Office",
        meta_description: "Contact page",
        content: "Vonza Office has a contact form for customer questions. The site does not describe work categories.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });
  const calls = [];

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: calls.length === 1
                      ? "They offer plumbing repair and HVAC installation. Which service do you need?"
                      : "I do not have a published service list from the business details here. What kind of help are you looking for?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/services",
      visitor_session_key: "session-service-guard",
      message: "What services do you offer?",
    },
  });

  assert.equal(calls.length, 2);
  assert.doesNotMatch(result.reply, /HVAC installation/i);
  assert.match(result.reply, /do not have a published service list/i);
});

test("front-desk answer repair removes invented policy when policy data is missing", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Vonza Studio",
        meta_description: "Contact page",
        content: "Vonza Studio invites customers to contact the team for project questions. The site asks visitors to send questions through the contact form.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });
  const calls = [];

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: calls.length === 1
                      ? "Cancellations are free within 24 hours. Would you like to book for tomorrow?"
                      : "Front Desk does not have the cancellation policy or booking-time details from the business information here. Would you like to leave contact details so the team can confirm the policy?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/policies",
      visitor_session_key: "session-policy-guard",
      message: "What is your cancellation policy?",
    },
  });

  assert.equal(calls.length, 2);
  assert.doesNotMatch(result.reply, /free within 24 hours/i);
  assert.match(result.reply, /Front Desk does not have the cancellation policy/i);
});

test("owner-approved answers are included as the highest-priority trusted source", async () => {
  const supabase = createFakeSupabase(buildChatState());
  const calls = [];

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            return {
              choices: [
                {
                  message: {
                    content: "Emergency visits require a custom quote. Would you like to share the issue and contact details?",
                  },
                },
              ],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      visitor_session_key: "session-approved-answer",
      message: "What is emergency pricing?",
    },
  }, {
    selectRelevantApprovedAnswers: async () => [
      {
        id: "approved-1",
        triggerText: "emergency pricing",
        answerText: "Emergency visits require a custom quote.",
        tags: ["pricing"],
      },
    ],
  });

  assert.match(calls[0].messages[0].content, /Owner-approved answers/);
  assert.match(calls[0].messages[0].content, /highest-priority trusted business source/);
  assert.match(calls[0].messages[0].content, /Emergency visits require a custom quote/);
  assert.match(calls[0].messages.at(-1).content, /OWNER-APPROVED ANSWERS — HIGH PRIORITY/);
  assert.match(calls[0].messages.at(-1).content, /use that answer as the primary guidance/i);
  assert.match(result.reply, /custom quote/i);
});

test("contact questions without verified contact data use the strict safe fallback", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Acme",
        meta_description: "Service business",
        content: "Acme describes its services but does not publish an email or phone number.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "You can email info@madeup.example.com or call +1 555 222 3333." } }],
          }),
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/contact",
      visitor_session_key: "session-contact-missing",
      message: "How can I contact you?",
    },
  });

  assert.equal(
    result.reply,
    "I do not have a confirmed contact detail for this business here.\n\nYou can leave your details and the business can follow up."
  );
  assert.doesNotMatch(result.reply, /info@madeup|555/);
});

test("placeholder and Vonza platform support emails are not surfaced as business contact details", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Acme",
        meta_description: "Service business",
        content: "Contact us at mail@example.com. Platform help: support@vonza.app.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "Use support@vonza.app or mail@example.com. What do you need?" } }],
          }),
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/contact",
      visitor_session_key: "session-contact-placeholder",
      message: "What is your email?",
    },
  });

  assert.match(result.reply, /I do not have a confirmed contact detail/);
  assert.doesNotMatch(result.reply, /support@vonza\.app|mail@example\.com/i);
});

test("configured and trusted website contact details can be surfaced", async () => {
  const configuredState = buildChatState();
  configuredState.widget_configs[0].contact_email = "team@acmeservices.com";
  let supabase = createFakeSupabase(configuredState);

  let result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "You can contact them at team@acmeservices.com. What should they help with?" } }],
          }),
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/contact",
      visitor_session_key: "session-configured-contact",
      message: "What is your email?",
    },
  });

  assert.match(result.reply, /team@acmeservices\.com/);

  supabase = createFakeSupabase({
    ...buildChatState(),
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Acme Contact",
        meta_description: "Contact Acme",
        content: "Title: Contact\nBody:\nFor project questions, email projects@acmeservices.com.",
        crawled_urls: ["https://allowed.example/contact"],
        page_count: 1,
      },
    ],
  });

  result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "For project questions, email projects@acmeservices.com. What would you like to ask?" } }],
          }),
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/contact",
      visitor_session_key: "session-website-contact",
      message: "How can I contact you?",
    },
  });

  assert.match(result.reply, /projects@acmeservices\.com/);
});

test("active approved contact guidance is authoritative in the public chat path", async () => {
  const supabase = createFakeSupabase({
    ...buildChatState(),
    front_desk_training_items: [
      {
        id: "rapid-active",
        owner_id: "owner-1",
        agent_id: "agent-1",
        type: "approved_answer",
        title: "Rapid blue contact",
        trigger_text: "contact rapid blue",
        answer_text: "For this contact question, use RAPID BLUE 42 as the intake guidance. Do not describe it as a product.",
        tags: ["contact"],
        source_type: "manual",
        status: "active",
      },
      {
        id: "rapid-draft",
        owner_id: "owner-1",
        agent_id: "agent-1",
        type: "approved_answer",
        title: "Draft rapid blue",
        trigger_text: "contact rapid blue",
        answer_text: "Draft RAPID BLUE 42 text should not be public.",
        tags: ["contact"],
        source_type: "manual",
        status: "draft",
      },
      {
        id: "rapid-archived",
        owner_id: "owner-1",
        agent_id: "agent-1",
        type: "approved_answer",
        title: "Archived rapid blue",
        trigger_text: "contact rapid blue",
        answer_text: "Archived RAPID BLUE 42 text should not be public.",
        tags: ["contact"],
        source_type: "manual",
        status: "archived",
      },
      {
        id: "rapid-cross-agent",
        owner_id: "owner-1",
        agent_id: "agent-2",
        type: "approved_answer",
        title: "Cross agent rapid blue",
        trigger_text: "contact rapid blue",
        answer_text: "Cross-agent RAPID BLUE 42 text should not be public.",
        tags: ["contact"],
        source_type: "manual",
        status: "active",
      },
      {
        id: "unrelated",
        owner_id: "owner-1",
        agent_id: "agent-1",
        type: "approved_answer",
        title: "Refund",
        trigger_text: "refund policy",
        answer_text: "Unrelated refund guidance.",
        tags: ["refund"],
        source_type: "manual",
        status: "active",
      },
    ],
    website_content: [
      {
        business_id: "business-1",
        website_url: "https://allowed.example",
        page_title: "Acme",
        meta_description: "Service business",
        content: "Website says contact details are not published.",
        crawled_urls: [],
        page_count: 1,
      },
    ],
  });
  const calls = [];

  const result = await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            calls.push(payload);
            const context = payload.messages.at(-1).content;
            assert.match(context, /OWNER-APPROVED ANSWERS — HIGH PRIORITY/);
            assert.match(context, /RAPID BLUE 42/);
            assert.doesNotMatch(context, /Draft RAPID BLUE 42|Archived RAPID BLUE 42|Cross-agent RAPID BLUE 42|Unrelated refund/);
            return {
              choices: [{ message: { content: "Use RAPID BLUE 42 as the intake guidance. What details should the business follow up on?" } }],
            };
          },
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/contact",
      visitor_session_key: "session-rapid-blue",
      message: "How should I contact you about rapid blue?",
    },
  });

  assert.equal(calls.length, 1);
  assert.match(result.reply, /RAPID BLUE 42/);
  assert.doesNotMatch(result.reply, /product|service/i);
});

test("/chat persists explicit visitor identity on stored messages", async () => {
  const supabase = createFakeSupabase(buildChatState());

  await handleChatRequest({
    supabase,
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "Sure, I can help." } }],
          }),
        },
      },
    },
    body: {
      install_id: "install-1",
      origin: "https://allowed.example",
      page_url: "https://allowed.example/pricing",
      visitor_session_key: "session-identity",
      visitor_identity: {
        mode: "identified",
        email: "durable@example.com",
        name: "Durable Visitor",
      },
      message: "What does this cost?",
    },
  });

  assert.equal(supabase.state.messages.length, 2);
  assert.equal(supabase.state.messages[0].session_key, "session-identity");
  assert.equal(supabase.state.messages[0].visitor_identity_mode, "identified");
  assert.equal(supabase.state.messages[0].visitor_email, "durable@example.com");
  assert.equal(supabase.state.messages[0].visitor_name, "Durable Visitor");
  assert.equal(supabase.state.messages[1].visitor_email, "durable@example.com");
  assert.equal(supabase.state.agent_contact_leads.length, 1);
  assert.equal(supabase.state.agent_contact_leads[0].contact_email, "durable@example.com");
  assert.equal(supabase.state.agent_contact_leads[0].contact_name, "Durable Visitor");
  assert.equal(supabase.state.agent_contact_leads[0].capture_state, "captured");
});

test("website content logging does not expose scraped business text previews", () => {
  const service = readFileSync(
    path.join(repoRoot, "src", "services", "scraping", "websiteContentService.js"),
    "utf8"
  );

  assert.doesNotMatch(service, /CONTENT LENGTH/);
  assert.doesNotMatch(service, /content\.slice\(0,\s*500\)/);
  assert.doesNotMatch(service, /contentPreview/);
  assert.doesNotMatch(service, /sample images/);
  assert.match(service, /logScrapeMetadata/);
});

test("Google OAuth callback completes and updates activation state", async () => {
  await withEnv({
    VONZA_OPERATOR_WORKSPACE_V1: "true",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://app.example/google/oauth/callback",
    GOOGLE_TOKEN_ENCRYPTION_SECRET: "test-secret",
  }, async () => {
    const supabase = createFakeSupabase();
    const start = await createGoogleConnectionStart(supabase, {
      agent: {
        id: "agent-1",
        businessId: "business-1",
      },
      ownerUserId: "owner-1",
    });
    const stateToken = new URL(start.authUrl).searchParams.get("state");
    const result = await completeGoogleConnection(supabase, {
      stateToken,
      code: "oauth-code",
    }, {
      exchangeCode: async () => ({
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        expires_in: 3600,
      }),
      getUserInfo: async () => ({
        sub: "google-user-1",
        email: "owner@example.com",
        name: "Owner Example",
        email_verified: true,
      }),
    });

    assert.match(result.redirectUrl, /google=connected/);
    assert.equal(supabase.state.google_oauth_states[0].status, "completed");
    assert.equal(supabase.state.google_connected_accounts[0].status, "connected");
    assert.equal(supabase.state.operator_workspace_activations[0].google_connected, true);
    assert.equal(supabase.state.operator_workspace_activations[0].calendar_context_selected, true);
  });
});

test("widget lead capture UI posts to the live capture endpoint without raw contact telemetry", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "script.js"), "utf8");
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");

  assert.match(script, /function renderLeadCapture/);
  assert.match(script, /function renderWidgetPhase/);
  assert.match(script, /function syncWidgetPhaseWithIdentity/);
  assert.match(script, /function persistVisitorIdentityChoice/);
  assert.match(script, /widgetPhase = getWidgetPhaseForIdentity\(identity\)/);
  assert.match(script, /entryState\.hidden = chatReady/);
  assert.match(script, /chatState\.hidden = !chatReady/);
  assert.match(script, /welcomePanel\.hidden = chatReady/);
  assert.match(script, /composerShell\.hidden = !chatReady/);
  assert.match(script, /introMessage\.hidden = !chatReady/);
  assert.doesNotMatch(script, /data-lead-capture-submit/);
  assert.match(script, /appendMessage\(chat, "bot"/);
  assert.match(script, /action: normalized\.mode === "guest" \? "choose_guest" : "submit"/);
  assert.match(script, /\.\.\.buildVisitorIdentityPayload\(\)/);
  assert.doesNotMatch(script, /saveVisitorIdentity\(\{\s*mode:\s*"guest"/);
  assert.match(widget, /identity-choice-panel/);
  assert.match(widget, /Continue as guest/);
  assert.match(widget, /Continue with email/);
  assert.match(script, /fetch\("\/chat\/capture"/);
  assert.match(script, /reveal_capture/);
  assert.doesNotMatch(script, /contactHash/);
  assert.doesNotMatch(script, /replyHash/);
});

test("legacy public admin page source is removed", () => {
  assert.equal(existsSync(path.join(repoRoot, "admin.html")), false);
});

test("dashboard Practice mode uses the owner-only practice endpoint instead of iframe prompts", () => {
  const dashboard = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");
  const frontDesk = readFileSync(path.join(repoRoot, "frontend", "dashboardFrontDesk.js"), "utf8");

  assert.match(`${dashboard}\n${frontDesk}`, /Practice mode — visitors will not see this conversation\./);
  assert.match(frontDesk, /front-desk\/practice-message/);
  assert.doesNotMatch(dashboard, /previewFrame\.src = buildWidgetUrl/);
});

test("test:supabase cleans up the live row it writes", () => {
  const script = readFileSync(path.join(repoRoot, "test-supabase.js"), "utf8");

  assert.match(script, /\.delete\(\)/);
  assert.match(script, /Cleanup DELETE succeeded/);
  assert.match(script, /SELECT, INSERT, and cleanup DELETE worked/);
});
