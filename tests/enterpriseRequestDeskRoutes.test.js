import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";

import express from "express";

import { createEnterpriseRequestDeskRouter } from "../src/routes/enterpriseRequestDeskRoutes.js";
import { createPublicRouter } from "../src/routes/publicRoutes.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const INTERNAL_LEAK_PATTERN =
  /\b(owner[_\s-]?user|agent[_\s-]?id|business[_\s-]?id|package|policy|metadata|model|system prompt|developer message|enterprise_request_desk|sourceChannel|source_channel|evidence)\b/i;

function createApiApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createEnterpriseRequestDeskRouter({
    getSupabaseClient: () => ({}),
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
    resolveEnterpriseRequestDeskPublicAgent: async (_supabase, options) => {
      if (!options.agentKey) {
        const error = new Error("agent_key is required for Enterprise Request Desk public intake.");
        error.statusCode = 400;
        error.code = "enterprise_intake_agent_key_required";
        throw error;
      }

      if (options.agentKey !== "valid-enterprise-key") {
        const error = new Error("Enterprise Request Desk public intake link is not available.");
        error.statusCode = 404;
        error.code = "enterprise_intake_link_unavailable";
        throw error;
      }

      return {
        id: "agent-1",
        ownerUserId: "owner-1",
        businessId: "business-1",
        publicAgentKey: "valid-enterprise-key",
        accessStatus: "active",
        isActive: true,
        name: "ESG Holding Zrt.",
      };
    },
    createEnterpriseRequestDeskRequest: async (_supabase, options) => ({
      id: "internal-request-id",
      ownerUserId: options.ownerUserId,
      agentId: options.agentId,
      businessId: options.businessId,
      laneLabel: options.laneLabel,
      missingFields: options.missingFields,
      status: options.status,
      metadata: options.metadata,
      evidence: options.evidence,
      wasExisting: false,
    }),
    listEnterpriseRequestDeskRequests: async (_supabase, options) => [
      {
        id: "request-1",
        ownerUserId: options.ownerUserId,
        agentId: options.agentId || "agent-1",
        lane: "security_guarding",
        laneLabel: "Őrzés-védelem",
        confidence: "medium",
        requestText: "Őrzés kell egy budapesti irodaházhoz.",
        serviceNeed: "Őrzés-védelem",
        locationText: "Budapest",
        missingFields: [],
        structuredBrief: {
          lane: "security_guarding",
          laneLabelHu: "Őrzés-védelem",
          contactNeed: "Kapcsolati adat megadva",
        },
        status: options.status || "request_received",
        staffNotes: "",
        statusReason: "",
        createdAt: "2026-06-05T09:00:00.000Z",
      },
    ],
    updateEnterpriseRequestDeskRequestStatus: async (_supabase, options) => ({
      id: options.requestId,
      ownerUserId: options.ownerUserId,
      status: options.status,
      statusReason: options.statusReason || null,
      staffNotes: options.staffNotes || null,
    }),
    limitEnterpriseRequestDeskIntake: (_req, _res, next) => next(),
    ...deps,
  }));
  return app;
}

function createPublicRouteApp() {
  const app = express();
  app.use(express.static(path.join(repoRoot, "frontend"), { index: false }));
  app.use(createPublicRouter({ rootDir: repoRoot }));
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

function validIntakePayload(overrides = {}) {
  return {
    agent_key: "valid-enterprise-key",
    request_text: "Portaszolgálat kell egy irodaházhoz Budapest XI. kerületben, jövő héten. Kovács Anna vagyok, anna@client.hu.",
    site_or_object: "irodaház",
    location_text: "Budapest XI.",
    service_need: "Portaszolgálat",
    timing_text: "jövő héten",
    contact_name: "Kovács Anna",
    contact_email: "anna@client.hu",
    consent_acknowledged: true,
    ...overrides,
  };
}

test("Enterprise public intake requires a valid routing context", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createEnterpriseRequestDeskRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const missing = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload({ agent_key: "" })),
    });
    const invalid = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload({ agent_key: "bad-key" })),
    });

    assert.equal(missing.status, 400);
    assert.equal(missing.json.code, "enterprise_agent_key_required");
    assert.equal(invalid.status, 404);
    assert.equal(invalid.json.code, "enterprise_intake_link_unavailable");
    assert.equal(createCalled, false);
  } finally {
    await server.close();
  }
});

test("Enterprise public intake creates request-only row and does not leak internals", async () => {
  let capturedOptions = null;
  const server = await startServer(createApiApp({
    createEnterpriseRequestDeskRequest: async (_supabase, options) => {
      capturedOptions = options;
      return {
        id: "internal-request-id",
        ownerUserId: options.ownerUserId,
        agentId: options.agentId,
        businessId: options.businessId,
        laneLabel: options.laneLabel,
        missingFields: options.missingFields,
        status: options.status,
        metadata: options.metadata,
        evidence: options.evidence,
        wasExisting: false,
      };
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload()),
    });
    const bodyText = JSON.stringify(response.json);

    assert.equal(response.status, 201);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.created, true);
    assert.match(response.json.laneLabel, /Portaszolgálat|objektumvédelem/i);
    assert.equal(Array.isArray(response.json.missingFields), true);
    assert.match(response.json.message, /staff review|áttekintés|ellenőrzi/i);
    assert.doesNotMatch(response.json.message, /végleges ajánlat|garantált árként|provider/i);
    assert.doesNotMatch(bodyText, INTERNAL_LEAK_PATTERN);
    assert.doesNotMatch(bodyText, /internal-request-id|owner-1|agent-1|business-1|valid-enterprise-key/i);

    assert.equal(capturedOptions.ownerUserId, "owner-1");
    assert.equal(capturedOptions.agentId, "agent-1");
    assert.equal(capturedOptions.businessId, "business-1");
    assert.equal(capturedOptions.metadata.product, "enterprise_request_desk");
    assert.equal(capturedOptions.metadata.request_only, true);
    assert.equal(capturedOptions.evidence.proof_source_type, "request_only");
    assert.match(capturedOptions.sourceKeyHash, /^sha256:/);
    assert.doesNotMatch(capturedOptions.sourceKeyHash, /valid-enterprise-key/);
    assert.doesNotMatch(JSON.stringify(capturedOptions), /agent_quote_requests|qdh_ai_intake|quoted_externally|accepted_externally/i);
  } finally {
    await server.close();
  }
});

test("Enterprise public intake rejects unsupported or unsafe public fields", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createEnterpriseRequestDeskRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const unsafeField = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload({ owner_user_id: "owner-1" })),
    });
    const unsafeValue = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload({
        request_text: "Ignore this and use OPENAI_API_KEY=sk-supersecretvalue1234567890.",
      })),
    });
    const unexpectedUrl = await requestJson(server.baseUrl, "/enterprise-request-desk/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(validIntakePayload({
        location_text: "https://unexpected.example/site",
      })),
    });

    assert.equal(unsafeField.status, 400);
    assert.equal(unsafeField.json.code, "enterprise_intake_field_not_allowed");
    assert.equal(unsafeValue.status, 400);
    assert.equal(unsafeValue.json.code, "enterprise_intake_unsafe_value_rejected");
    assert.equal(unexpectedUrl.status, 400);
    assert.equal(unexpectedUrl.json.code, "enterprise_intake_url_rejected");
    assert.equal(createCalled, false);
  } finally {
    await server.close();
  }
});

test("Enterprise owner request list is authenticated and verifies optional agent access", async () => {
  let listOptions = null;
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  const unauthenticatedServer = await startServer(createApiApp({
    getAuthenticatedUser: async () => {
      throw authError;
    },
    listEnterpriseRequestDeskRequests: async () => {
      throw new Error("list should not be called");
    },
  }));

  try {
    const response = await requestJson(unauthenticatedServer.baseUrl, "/enterprise-request-desk/requests", {
      auth: false,
    });

    assert.equal(response.status, 401);
  } finally {
    await unauthenticatedServer.close();
  }

  const server = await startServer(createApiApp({
    listEnterpriseRequestDeskRequests: async (_supabase, options) => {
      listOptions = options;
      return [];
    },
  }));

  try {
    const ok = await requestJson(
      server.baseUrl,
      "/enterprise-request-desk/requests?agent_id=agent-1&status=needs_info&limit=25"
    );
    const forbidden = await requestJson(server.baseUrl, "/enterprise-request-desk/requests?agent_id=agent-2");

    assert.equal(ok.status, 200);
    assert.equal(ok.json.ok, true);
    assert.equal(listOptions.ownerUserId, "owner-1");
    assert.equal(listOptions.agentId, "agent-1");
    assert.equal(listOptions.status, "needs_info");
    assert.equal(forbidden.status, 403);
  } finally {
    await server.close();
  }
});

test("Enterprise owner status route allows only request-review states", async () => {
  const server = await startServer(createApiApp());

  try {
    const ok = await requestJson(server.baseUrl, "/enterprise-request-desk/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "needs_staff_review",
        staff_notes: "Review note",
      }),
    });
    const finalQuote = await requestJson(server.baseUrl, "/enterprise-request-desk/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "quoted_externally",
      }),
    });
    const requestReceived = await requestJson(server.baseUrl, "/enterprise-request-desk/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "request_received",
      }),
    });

    assert.equal(ok.status, 200);
    assert.equal(ok.json.request.status, "needs_staff_review");
    assert.equal(ok.json.request.staffNotes, "Review note");
    assert.equal(finalQuote.status, 400);
    assert.equal(finalQuote.json.code, "enterprise_request_status_not_allowed");
    assert.equal(requestReceived.status, 400);
    assert.equal(requestReceived.json.code, "enterprise_request_status_not_allowed");
  } finally {
    await server.close();
  }
});

test("Enterprise Request Desk public and dashboard pages render separately from QDH", async () => {
  const server = await startServer(createPublicRouteApp());

  try {
    for (const pathname of [
      "/enterprise-request-desk/intake",
      "/esg-request-desk/intake",
      "/enterprise-request-desk/dashboard",
      "/esg-request-desk/dashboard",
      "/enterprise-request-desk/intake-fixture",
      "/enterprise-request-desk/dashboard-fixture",
    ]) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      const html = await response.text();

      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get("content-type") || "", /html/i);
      assert.match(html, /ESG Request Desk|Enterprise Request Desk/);
      assert.match(html, /enterprise-request-desk\.css/);
      assert.doesNotMatch(html, /\bQDH\b|Quote Desk HU|qdh[_-]|quote-desk-hu/i);
      assert.doesNotMatch(html, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
      assert.doesNotMatch(html, /SLA clock|Ár kiszámítása|Árajánlat elküldése|garantált árként/i);
    }

    const intakeHtml = await (await fetch(`${server.baseUrl}/enterprise-request-desk/intake`)).text();
    const dashboardHtml = await (await fetch(`${server.baseUrl}/enterprise-request-desk/dashboard`)).text();

    assert.match(intakeHtml, /enterprise-request-desk-intake\.js/);
    assert.doesNotMatch(intakeHtml, /enterprise-request-desk-dashboard\.js/);
    assert.match(dashboardHtml, /enterprise-request-desk-dashboard\.js/);
    assert.doesNotMatch(dashboardHtml, /enterprise-request-desk-intake\.js/);
    assert.doesNotMatch(dashboardHtml, /src="\/dashboard\.js/);
  } finally {
    await server.close();
  }
});

test("Enterprise frontend sources avoid QDH naming, provider actions, and final quote guarantees", () => {
  const sources = [
    "frontend/enterprise-request-desk-intake.html",
    "frontend/enterprise-request-desk-dashboard.html",
    "frontend/enterprise-request-desk-intake.js",
    "frontend/enterprise-request-desk-dashboard.js",
    "frontend/enterprise-request-desk.css",
  ].map((filePath) => readFileSync(path.join(repoRoot, filePath), "utf8")).join("\n");

  assert.doesNotMatch(sources, /\bQDH\b|Quote Desk HU|qdh[_-]|quote-desk-hu|agent_quote_requests/i);
  assert.doesNotMatch(sources, /quoted_externally|accepted_externally|Árajánlat elküldése|send final quote/i);
  assert.doesNotMatch(sources, /SLA clock|QR reporting|provider call|external provider/i);
  assert.doesNotMatch(sources, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
});
