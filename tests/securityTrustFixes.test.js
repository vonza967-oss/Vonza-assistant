import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createChatRouter } from "../src/routes/chatRoutes.js";
import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { handleChatRequest } from "../src/services/chat/chatService.js";
import {
  listAgents,
  requireActiveAgentAccess,
} from "../src/services/agents/agentService.js";
import {
  completeGoogleConnection,
  createGoogleConnectionStart,
} from "../src/services/operator/operatorWorkspaceService.js";

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

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

test("/chat rejects disallowed origins when install_id is present", async () => {
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

  try {
    const response = await postJson(server.baseUrl, "/chat", {
      install_id: "install-1",
      origin: "https://evil.example",
      page_url: "https://evil.example/page",
      message: "What does this cost?",
    });

    assert.equal(response.status, 403);
    assert.match(response.json.error, /origin is not allowed/i);
    assert.equal(openAiCalled, false);
  } finally {
    await server.close();
  }
});

test("/chat/capture rejects disallowed origins when install_id is present", async () => {
  const supabase = createFakeSupabase(buildChatState());
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => supabase,
  }));
  const server = await startServer(app);

  try {
    const response = await postJson(server.baseUrl, "/chat/capture", {
      install_id: "install-1",
      origin: "https://evil.example",
      page_url: "https://evil.example/page",
      action: "decline",
      reference_message: "What does this cost?",
    });

    assert.equal(response.status, 403);
    assert.match(response.json.error, /origin is not allowed/i);
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

test("admin APIs reject query-string tokens and accept header tokens", async () => {
  await withEnv({ ADMIN_TOKEN: "admin-1234" }, async () => {
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
    }));
    const server = await startServer(app);

    try {
      const queryTokenResponse = await getJson(
        server.baseUrl,
        "/agents/admin-list?token=admin-1234"
      );
      assert.equal(queryTokenResponse.status, 401);
      assert.match(queryTokenResponse.json.error, /admin token/i);

      const headerTokenResponse = await getJson(
        server.baseUrl,
        "/agents/admin-list",
        {
          headers: {
            "x-admin-token": "admin-1234",
          },
        }
      );
      assert.equal(headerTokenResponse.status, 200);
      assert.equal(headerTokenResponse.json.agents.length, 1);
    } finally {
      await server.close();
    }
  });
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
  assert.match(script, /function renderVisitorIdentityGate/);
  assert.match(script, /function persistVisitorIdentityChoice/);
  assert.match(script, /identityPanel\.hidden = identityReady/);
  assert.match(script, /welcomeContent\.hidden = !identityReady/);
  assert.doesNotMatch(script, /data-lead-capture-submit/);
  assert.match(script, /appendMessage\(chat, "bot"/);
  assert.match(script, /action: normalized\.mode === "guest" \? "choose_guest" : "submit"/);
  assert.match(script, /\.\.\.buildVisitorIdentityPayload\(\)/);
  assert.doesNotMatch(script, /saveVisitorIdentity\(\{\s*mode:\s*"guest"/);
  assert.match(widget, /identity-choice-panel/);
  assert.match(widget, /Continue as guest/);
  assert.match(widget, /Continue with email/);
  assert.match(script, /fetch\(\"\/chat\/capture\"/);
  assert.match(script, /reveal_capture/);
  assert.doesNotMatch(script, /contactHash/);
  assert.doesNotMatch(script, /replyHash/);
});

test("admin rendering escapes dynamic data and avoids query-string token APIs", () => {
  const admin = readFileSync(path.join(repoRoot, "admin.html"), "utf8");

  assert.match(admin, /function escapeHtml/);
  assert.match(admin, /x-admin-token/);
  assert.match(admin, /replaceState/);
  assert.doesNotMatch(admin, /access-status\?token/);
  assert.doesNotMatch(admin, /admin-list[\s\S]{0,120}searchParams\.set\("token"/);
});

test("dashboard preview starter prompts do not force-reset a loaded iframe", () => {
  const dashboard = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboard, /Preview is still loading\. Try the starter again in a moment\./);
  assert.match(dashboard, /if \(!previewFrame\.getAttribute\("src"\)\)/);
});

test("test:supabase cleans up the live row it writes", () => {
  const script = readFileSync(path.join(repoRoot, "test-supabase.js"), "utf8");

  assert.match(script, /\.delete\(\)/);
  assert.match(script, /Cleanup DELETE succeeded/);
  assert.match(script, /SELECT, INSERT, and cleanup DELETE worked/);
});
