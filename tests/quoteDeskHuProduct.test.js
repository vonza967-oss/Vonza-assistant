import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createApp as createFullApp } from "../src/app/createApp.js";
import { createQuoteDeskHuRouter } from "../src/routes/quoteDeskHuRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createApiApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createQuoteDeskHuRouter({
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
    listAgentQuoteRequests: async () => [],
    updateAgentQuoteRequestStatus: async (_supabase, options) => ({
      id: options.requestId,
      ownerUserId: options.ownerUserId,
      status: options.status,
      statusReason: options.statusReason || null,
      staffNotes: options.staffNotes || null,
    }),
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

test("QDH dashboard route renders a separate Hungarian product shell", async () => {
  const server = await startServer(createFullApp({ rootDir: repoRoot }));

  try {
    for (const pathname of ["/qdh/dashboard", "/quote-desk-hu/dashboard"]) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") || "", /html/);
      assert.match(html, /<html lang="hu">/);
      assert.match(html, /Quote Desk HU/);
      assert.match(html, /Ajánlatkérési munkaterület/);
      assert.match(html, /qdh-dashboard\.css/);
      assert.match(html, /qdh-dashboard\.js/);
      assert.doesNotMatch(html, /src="\/dashboard\.js/);
      assert.doesNotMatch(html, /data-quote-request-review/);
      assert.doesNotMatch(html, /AI Front Desk/i);
    }
  } finally {
    await server.close();
  }
});

test("QDH public acquisition and setup routes are product-specific and separate", async () => {
  const server = await startServer(createFullApp({ rootDir: repoRoot }));

  try {
    const publicResponse = await fetch(`${server.baseUrl}/qdh`);
    const publicHtml = await publicResponse.text();
    const aliasResponse = await fetch(`${server.baseUrl}/quote-desk-hu`);
    const setupResponse = await fetch(`${server.baseUrl}/qdh/setup`);
    const setupHtml = await setupResponse.text();

    assert.equal(publicResponse.status, 200);
    assert.equal(aliasResponse.status, 200);
    assert.equal(setupResponse.status, 200);
    assert.match(publicHtml, /<html lang="hu">/);
    assert.match(publicHtml, /Quote Desk HU/);
    assert.match(publicHtml, /statikus “Kérjen ajánlatot” űrlap helyett/);
    assert.match(publicHtml, /href="\/qdh\/setup"/);
    assert.match(publicHtml, /href="\/qdh\/dashboard"/);
    assert.match(publicHtml, /Request intake és review fázis/);
    assert.match(publicHtml, /nem ígér automatikus végső árat/i);
    assert.match(publicHtml, /nem küld ajánlatot az ügyfélnek/i);
    assert.match(setupHtml, /QDH setup magyar ajánlatkérésekhez/);
    assert.match(setupHtml, /qdh-setup\.js/);
    assert.doesNotMatch(publicHtml, /src="\/dashboard\.js/);
    assert.doesNotMatch(setupHtml, /src="\/dashboard\.js/);
    assert.doesNotMatch(publicHtml, /AI Front Desk magyar ügyfélkérdésekhez/);
    assert.doesNotMatch(setupHtml, /\/dashboard\?from=site/);
  } finally {
    await server.close();
  }
});

test("QDH frontend stays request-review only and avoids generic dashboard/widget dependencies", () => {
  const html = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.html"), "utf8");
  const source = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.js"), "utf8");
  const css = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.css"), "utf8");
  const setupSource = readFileSync(path.join(repoRoot, "frontend", "qdh-setup.js"), "utf8");
  const productCss = readFileSync(path.join(repoRoot, "frontend", "qdh-product.css"), "utf8");

  assert.match(html, /Quote Desk HU/);
  assert.match(source, /\/quote-desk-hu\/requests/);
  assert.match(source, /\/quote-desk-hu\/setup-state/);
  assert.match(setupSource, /\/quote-desk-hu\/setup/);
  assert.match(setupSource, /signInWithPassword/);
  assert.match(setupSource, /signInWithOtp/);
  assert.match(setupSource, /signUp/);
  assert.match(source, /Új/);
  assert.match(source, /Hiányzó adat/);
  assert.match(source, /Ellenőrzés alatt/);
  assert.match(source, /Elutasítva \/ Archivált/);
  assert.match(source, /végső árakat a vállalkozás erősíti meg/i);
  assert.match(source, /nem készít automatikus garantált ajánlatot/i);

  assert.doesNotMatch(source, /\/agents\/quote-requests/);
  assert.doesNotMatch(source, /buildQuoteRequestReviewCard|data-quote-request-review/);
  assert.doesNotMatch(source, /data-qdh-status-action="\$\{escapeHtml\(record\.status\)\}"/);
  assert.doesNotMatch(source, /data-qdh-status-action="request_received"/);
  assert.doesNotMatch(source, /quoted_externally|accepted_externally/);
  assert.doesNotMatch(source, /Árajánlat elküldve|Elfogadva|accepted quote|send final quote/i);
  assert.doesNotMatch(source, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
  assert.doesNotMatch(source, /whatsapp|google|external provider/i);
  assert.doesNotMatch(css, /orb|bokeh|hero/i);
  assert.doesNotMatch(setupSource, /service_role|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET/i);
  assert.doesNotMatch(productCss, /orb|bokeh|purple/i);
});

test("QDH setup APIs require auth and persist owner-scoped setup readiness", async () => {
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  const setupCalls = [];
  const server = await startServer(createApiApp({
    getAuthenticatedUser: async (_supabase, req) => {
      if (!req.headers.authorization) {
        throw authError;
      }
      return { id: "owner-1", email: "owner@example.hu" };
    },
    getQuoteDeskHuSetup: async (_supabase, options) => {
      setupCalls.push(["get", options]);
      return null;
    },
    saveQuoteDeskHuSetup: async (_supabase, options) => {
      setupCalls.push(["save", options]);
      return {
        ownerUserId: options.ownerUserId,
        businessName: options.businessName,
        websiteUrl: "https://pelda.hu",
        serviceType: options.serviceType,
        serviceArea: options.serviceArea,
        handlingPreference: options.handlingPreference,
        ownerContactEmail: options.ownerContactEmail,
        servicesOffered: options.servicesOffered,
        setupStatus: "ready_for_review",
      };
    },
  }));

  try {
    const unauthenticatedGet = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state", {
      auth: false,
    });
    const authenticatedGet = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state");
    const unauthenticatedPost = await requestJson(server.baseUrl, "/quote-desk-hu/setup", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ business_name: "Példa Kft." }),
    });
    const authenticatedPost = await requestJson(server.baseUrl, "/quote-desk-hu/setup", {
      method: "POST",
      body: JSON.stringify({
        business_name: "Példa Kft.",
        website_url: "https://pelda.hu",
        service_type: "tetőfedés",
        service_area: "Budapest",
        handling_preference: "staff_review",
        owner_contact_email: "owner@example.hu",
        services_offered: ["Tetőjavítás", "Bádogozás"],
      }),
    });

    assert.equal(unauthenticatedGet.status, 401);
    assert.equal(authenticatedGet.status, 200);
    assert.equal(authenticatedGet.json.product, "quote_desk_hu");
    assert.equal(authenticatedGet.json.setupComplete, false);
    assert.equal(authenticatedGet.json.nextUrl, "/qdh/setup");
    assert.equal(unauthenticatedPost.status, 401);
    assert.equal(authenticatedPost.status, 200);
    assert.equal(authenticatedPost.json.product, "quote_desk_hu");
    assert.equal(authenticatedPost.json.setupComplete, true);
    assert.equal(authenticatedPost.json.nextUrl, "/qdh/dashboard");
    assert.equal(authenticatedPost.json.setup.ownerUserId, "owner-1");
    assert.deepEqual(setupCalls, [
      ["get", { ownerUserId: "owner-1" }],
      ["save", {
        ownerUserId: "owner-1",
        businessName: "Példa Kft.",
        websiteUrl: "https://pelda.hu",
        serviceType: "tetőfedés",
        serviceArea: "Budapest",
        handlingPreference: "staff_review",
        ownerContactEmail: "owner@example.hu",
        servicesOffered: ["Tetőjavítás", "Bádogozás"],
      }],
    ]);
  } finally {
    await server.close();
  }
});

test("QDH setup missing-table error is product-specific and safe", async () => {
  const missingTableError = new Error("Quote Desk HU setup storage is not available.");
  missingTableError.statusCode = 503;
  missingTableError.code = "qdh_setup_table_missing";
  const server = await startServer(createApiApp({
    getQuoteDeskHuSetup: async () => {
      throw missingTableError;
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state");

    assert.equal(response.status, 503);
    assert.equal(response.json.code, "qdh_setup_table_missing");
    assert.equal(response.json.error, "This service is temporarily unavailable. Please try again shortly.");
  } finally {
    await server.close();
  }
});

test("QDH request list is authenticated and passes owner scope to the quote service", async () => {
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  let listOptions = null;
  const server = await startServer(createApiApp({
    getAuthenticatedUser: async (_supabase, req) => {
      if (!req.headers.authorization) {
        throw authError;
      }
      return { id: "owner-1", email: "owner@example.com" };
    },
    listAgentQuoteRequests: async (_supabase, options) => {
      listOptions = options;
      return [
        {
          id: "request-1",
          ownerUserId: options.ownerUserId,
          agentId: options.agentId,
          requestedService: "Tetőjavítás",
          status: "request_received",
          createdAt: "2026-06-04T08:00:00.000Z",
        },
        {
          id: "request-final",
          ownerUserId: options.ownerUserId,
          agentId: options.agentId,
          requestedService: "Proof-backed external quote",
          status: "quoted_externally",
          createdAt: "2026-06-04T09:00:00.000Z",
        },
      ];
    },
  }));

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/quote-desk-hu/requests", {
      auth: false,
    });
    const authenticated = await requestJson(
      server.baseUrl,
      "/quote-desk-hu/requests?agent_id=agent-1&status=request_received&limit=20&client_id=client-1"
    );

    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.json.error, "Unauthorized");
    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.json.product, "quote_desk_hu");
    assert.equal(authenticated.json.phase, "request_intake_review");
    assert.deepEqual(authenticated.json.safeStatuses, [
      "needs_info",
      "needs_staff_review",
      "declined",
      "archived",
    ]);
    assert.deepEqual(authenticated.json.visibleStatuses, [
      "request_received",
      "needs_info",
      "needs_staff_review",
      "declined",
      "archived",
    ]);
    assert.equal(authenticated.json.summary.total, 1);
    assert.deepEqual(authenticated.json.records.map((record) => record.id), ["request-1"]);
    assert.deepEqual(listOptions, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      status: "request_received",
      limit: "20",
    });
  } finally {
    await server.close();
  }
});

test("QDH request list rejects final lifecycle status filters", async () => {
  let listCalled = false;
  const server = await startServer(createApiApp({
    listAgentQuoteRequests: async () => {
      listCalled = true;
      return [];
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/requests?status=quoted_externally");

    assert.equal(response.status, 400);
    assert.equal(response.json.code, "qdh_status_not_allowed");
    assert.equal(listCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH request list rejects agent filters outside owner access", async () => {
  let listCalled = false;
  const server = await startServer(createApiApp({
    listAgentQuoteRequests: async () => {
      listCalled = true;
      return [];
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/requests?agent_id=agent-2");

    assert.equal(response.status, 403);
    assert.equal(response.json.error, "Forbidden");
    assert.equal(listCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH status route uses quote request service rules but only exposes safe review states", async () => {
  const updateCalls = [];
  const server = await startServer(createApiApp({
    updateAgentQuoteRequestStatus: async (_supabase, options) => {
      updateCalls.push(options);
      return {
        id: options.requestId,
        ownerUserId: options.ownerUserId,
        status: options.status,
        statusReason: options.statusReason || null,
        staffNotes: options.staffNotes || null,
      };
    },
  }));

  try {
    const allowed = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "needs_info",
        status_reason: "Hiányzik a pontos helyszín.",
        staff_notes: "Kérjünk fotót.",
      }),
    });
    const finalSent = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "quoted_externally",
      }),
    });
    const finalAccepted = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "accepted_externally",
      }),
    });
    const requestReceived = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "request_received",
      }),
    });

    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.request.status, "needs_info");
    assert.deepEqual(updateCalls, [
      {
        ownerUserId: "owner-1",
        requestId: "request-1",
        status: "needs_info",
        statusReason: "Hiányzik a pontos helyszín.",
        staffNotes: "Kérjünk fotót.",
      },
    ]);
    assert.equal(finalSent.status, 400);
    assert.equal(finalSent.json.code, "qdh_status_not_allowed");
    assert.equal(finalAccepted.status, 400);
    assert.equal(finalAccepted.json.code, "qdh_status_not_allowed");
    assert.equal(requestReceived.status, 400);
    assert.equal(requestReceived.json.code, "qdh_status_not_allowed");
    assert.equal(updateCalls.length, 1);
  } finally {
    await server.close();
  }
});
