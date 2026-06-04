import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createApp(deps = {}) {
  const app = express();
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

function createQuoteRequestSupabase({ requests = [] } = {}) {
  const state = {
    agent_quote_requests: requests.map(clone),
  };

  function rowsFor(table) {
    if (table === "agent_quote_requests") {
      return state.agent_quote_requests;
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function buildQuery(table) {
    return {
      filters: [],
      updatePayload: null,
      orderSpec: null,
      select() {
        return this;
      },
      eq(column, value) {
        this.filters.push({ column, value });
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
    };
  }

  return {
    state,
    from(table) {
      return buildQuery(table);
    },
  };
}

function buildRouteDeps(supabase, overrides = {}) {
  return {
    getSupabaseClient: () => supabase,
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async (_supabase, options) => {
      if (options.agentId === "agent-2") {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }

      return {
        id: options.agentId || "agent-1",
        ownerUserId: options.ownerUserId,
      };
    },
    ...overrides,
  };
}

function createRequest(overrides = {}) {
  return {
    id: "request-1",
    owner_user_id: "owner-1",
    agent_id: "agent-1",
    business_id: "business-1",
    requested_service: "Roof repair",
    project_details: "Leak near chimney",
    location_text: "Budapest",
    urgency: "this week",
    budget_text: "not sure",
    customer_email: "owner@example.com",
    language: "Hungarian",
    status: "request_received",
    status_reason: null,
    staff_notes: "Initial note",
    evidence: {},
    metadata: {},
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

test("quote request list rejects unauthenticated owners", async () => {
  const supabase = createQuoteRequestSupabase();
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  let listCalled = false;
  const server = await startServer(createApp(buildRouteDeps(supabase, {
    getAuthenticatedUser: async () => {
      throw authError;
    },
    listAgentQuoteRequests: async () => {
      listCalled = true;
      return [];
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/quote-requests", {
      auth: false,
    });

    assert.equal(response.status, 401);
    assert.equal(response.json.error, "Unauthorized");
    assert.equal(listCalled, false);
  } finally {
    await server.close();
  }
});

test("authenticated owner can list own quote requests without exposing other owners", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      createRequest({ id: "request-1", owner_user_id: "owner-1", created_at: "2026-06-01T10:00:00.000Z" }),
      createRequest({ id: "request-2", owner_user_id: "owner-2", agent_id: "agent-2", created_at: "2026-06-01T11:00:00.000Z" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/quote-requests");

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.deepEqual(response.json.records.map((request) => request.id), ["request-1"]);
    assert.equal(response.json.records[0].ownerUserId, "owner-1");
    assert.equal(response.json.records[0].requestedService, "Roof repair");
  } finally {
    await server.close();
  }
});

test("quote request list filters by agent, status, and limit", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      createRequest({ id: "request-1", agent_id: "agent-1", status: "needs_staff_review", created_at: "2026-06-01T10:00:00.000Z" }),
      createRequest({ id: "request-2", agent_id: "agent-1", status: "needs_staff_review", created_at: "2026-06-01T11:00:00.000Z" }),
      createRequest({ id: "request-3", agent_id: "agent-1", status: "request_received", created_at: "2026-06-01T12:00:00.000Z" }),
      createRequest({ id: "request-4", agent_id: "agent-2", status: "needs_staff_review", created_at: "2026-06-01T13:00:00.000Z" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(
      server.baseUrl,
      "/agents/quote-requests?agent_id=agent-1&status=needs_staff_review&limit=1&client_id=client-1"
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.records.map((request) => request.id), ["request-2"]);
  } finally {
    await server.close();
  }
});

test("quote request list returns forbidden when an agent filter is outside owner access", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      createRequest({ id: "request-2", owner_user_id: "owner-2", agent_id: "agent-2" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/quote-requests?agent_id=agent-2");

    assert.equal(response.status, 403);
    assert.equal(response.json.error, "Forbidden");
  } finally {
    await server.close();
  }
});

test("authenticated owner can update an allowed quote request status and blank staff notes normalize", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [createRequest()],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/quote-requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "needs_staff_review",
        staff_notes: "   ",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.request.status, "needs_staff_review");
    assert.equal(response.json.request.staffNotes, null);
    assert.equal(supabase.state.agent_quote_requests[0].staff_notes, null);
  } finally {
    await server.close();
  }
});

test("quoted_externally requires trusted proof at the route boundary", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [createRequest({ status: "needs_staff_review" })],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const missingProof = await requestJson(server.baseUrl, "/agents/quote-requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "quoted_externally",
      }),
    });
    const trustedProof = await requestJson(server.baseUrl, "/agents/quote-requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "quoted_externally",
        evidence: {
          proof_source_type: "staff_quote",
          quote_document_id: "quote-document-1",
        },
      }),
    });

    assert.equal(missingProof.status, 400);
    assert.equal(missingProof.json.code, "quote_request_proof_required");
    assert.equal(trustedProof.status, 200);
    assert.equal(trustedProof.json.request.status, "quoted_externally");
    assert.deepEqual(trustedProof.json.request.evidence, {
      proof_source_type: "staff_quote",
      quote_document_id: "quote-document-1",
    });
  } finally {
    await server.close();
  }
});

test("lead, action, and request-only proof are rejected for quoted state", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      createRequest({ id: "request-lead", status: "needs_staff_review" }),
      createRequest({ id: "request-action", status: "needs_staff_review" }),
      createRequest({ id: "request-only", status: "needs_staff_review" }),
    ],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    for (const [requestId, proofSourceType] of [
      ["request-lead", "agent_contact_lead"],
      ["request-action", "agent_action_request"],
      ["request-only", "quote_request"],
    ]) {
      const response = await requestJson(server.baseUrl, "/agents/quote-requests/status", {
        method: "POST",
        body: JSON.stringify({
          request_id: requestId,
          status: "quoted_externally",
          evidence: { proof_source_type: proofSourceType },
        }),
      });

      assert.equal(response.status, 400);
      assert.equal(response.json.code, "quote_request_proof_required");
    }
  } finally {
    await server.close();
  }
});

test("owner cannot update another owner's quote request", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [createRequest({ id: "request-2", owner_user_id: "owner-2", agent_id: "agent-2" })],
  });
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const response = await requestJson(server.baseUrl, "/agents/quote-requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-2",
        status: "needs_staff_review",
      }),
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.code, "quote_request_not_found");
  } finally {
    await server.close();
  }
});

test("no public or authenticated owner route exists for creating quote requests", async () => {
  const supabase = createQuoteRequestSupabase();
  const server = await startServer(createApp(buildRouteDeps(supabase)));

  try {
    const publicCreate = await requestJson(server.baseUrl, "/quote-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ agent_id: "agent-1" }),
    });
    const agentCreate = await requestJson(server.baseUrl, "/agents/quote-requests", {
      method: "POST",
      body: JSON.stringify({ agent_id: "agent-1" }),
    });

    assert.equal(publicCreate.status, 404);
    assert.equal(agentCreate.status, 404);
  } finally {
    await server.close();
  }
});

test("widget, embed, and public routes do not expose quote request APIs", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const targets = [
    "assistant-embed.js",
    "embed.js",
    "embed-lite.js",
    "src/routes/publicRoutes.js",
    "src/routes/bookingRoutes.js",
  ];
  const files = [];

  function collect(targetPath) {
    const absolutePath = path.join(repoRoot, targetPath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      readdirSync(absolutePath).forEach((entry) => collect(path.join(targetPath, entry)));
      return;
    }

    if (/\.(js|html)$/.test(targetPath)) {
      files.push(absolutePath);
    }
  }

  targets.forEach(collect);

  files.forEach((filePath) => {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /agentQuoteRequestService|createAgentQuoteRequest|updateAgentQuoteRequestStatus|listAgentQuoteRequests|\/agents\/quote-requests|agent_quote_requests/,
      `${filePath} should not expose quote request internals or routes`
    );
  });

  const chatServiceSource = readFileSync(path.join(repoRoot, "src/services/chat/chatService.js"), "utf8");
  assert.match(chatServiceSource, /QUOTE_REQUESTS_FROM_CHAT_ENABLED|quoteRequestsFromChatEnabled/);
  assert.match(chatServiceSource, /createAgentQuoteRequest/);
  assert.doesNotMatch(chatServiceSource, /updateAgentQuoteRequestStatus|listAgentQuoteRequests|\/agents\/quote-requests|agent_quote_requests/);
});

test("dashboard exposes only authenticated quote request review endpoints and safe statuses", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const dashboardSource = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardSource, /\/agents\/quote-requests/);
  assert.match(dashboardSource, /\/agents\/quote-requests\/status/);
  assert.doesNotMatch(dashboardSource, /createAgentQuoteRequest|agentQuoteRequestService|agent_quote_requests/);
  assert.doesNotMatch(dashboardSource, /fetchJson\("\/agents\/quote-requests",\s*\{[\s\S]{0,200}method:\s*"POST"/);
  assert.doesNotMatch(dashboardSource, /fetchJson\("\/quote-requests/);
  const reviewStatusBlock = dashboardSource.match(/const QUOTE_REQUEST_REVIEW_STATUSES = Object\.freeze\(\[[\s\S]*?\]\);/)?.[0] || "";
  assert.match(reviewStatusBlock, /needs_info/);
  assert.match(reviewStatusBlock, /needs_staff_review/);
  assert.match(reviewStatusBlock, /declined/);
  assert.match(reviewStatusBlock, /expired/);
  assert.match(reviewStatusBlock, /archived/);
  assert.doesNotMatch(reviewStatusBlock, /quoted_externally|accepted_externally|Quote sent|Accepted quote/i);
});
