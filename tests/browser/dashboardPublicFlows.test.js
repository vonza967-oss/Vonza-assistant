import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { createApp } from "../../src/app/createApp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

let server;
let baseUrl;
let browser;
const previousEnv = new Map();

function setTestEnv(overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    previousEnv.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function restoreTestEnv() {
  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function startAppServer() {
  const app = createApp({ rootDir: repoRoot });
  const nextServer = http.createServer(app);
  await new Promise((resolve) => nextServer.listen(0, "127.0.0.1", resolve));
  const address = nextServer.address();

  return {
    server: nextServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(nextServer) {
  await new Promise((resolve, reject) => nextServer.close((error) => (error ? reject(error) : resolve())));
}

async function newPage({ clientId = "browser-fixture-client", dashboardLanguage, importPollIntervalMs } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.setDefaultTimeout(8000);
  await page.addInitScript(({ nextClientId, nextImportPollIntervalMs }) => {
    localStorage.setItem("vonza_client_id", nextClientId);
    if (nextImportPollIntervalMs !== undefined) {
      globalThis.VONZA_IMPORT_POLL_INTERVAL_MS = nextImportPollIntervalMs;
    }
  }, {
    nextClientId: clientId,
    nextImportPollIntervalMs: importPollIntervalMs,
  });
  if (dashboardLanguage) {
    await page.addInitScript((language) => {
      localStorage.setItem("vonza_dashboard_language", language);
    }, dashboardLanguage);
  }
  await page.route("**/product-events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/install/outcomes/ping", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  return page;
}

async function assertVisibleText(page, text) {
  await page.waitForFunction((expectedText) => globalThis.document.body?.innerText.includes(expectedText), text);
}

async function assertNoVisibleEnglishLeaks(page, deniedPhrases) {
  const visibleText = await page.locator("body").innerText();
  const leakedPhrases = deniedPhrases.filter((phrase) => visibleText.includes(phrase));
  assert.deepEqual(leakedPhrases, []);
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function buildDashboardFixtureAgent(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: "local-agent-1",
    name: "Local fixture workspace",
    assistantName: "Local front desk",
    ownerName: "Local Owner",
    ownerEmail: "local.owner@example.test",
    businessName: "Local Services",
    websiteUrl: "https://local.example.test",
    publicAgentKey: "local-public-agent",
    installId: "local-install-1",
    welcomeMessage: "Hi, I can help with services, booking, quotes, and support.",
    buttonLabel: "Ask a question",
    tone: "professional",
    accessStatus: "active",
    allowedDomains: ["local.example.test"],
    knowledge: {
      state: "limited",
      description: "Website import needs review before the assistant can rely on it fully.",
      pageCount: 5,
      contentLength: 1200,
      ...(overrides.knowledge || {}),
    },
    installStatus: {
      state: "seen_recently",
      label: "Live install detected",
      host: "local.example.test",
      pageUrl: "https://local.example.test/",
      lastSeenAt: now,
      lastSeenUrl: "https://local.example.test/",
      lastVerifiedAt: now,
      verificationStatus: "ok",
      verificationTargetUrl: "https://local.example.test/",
      verificationOrigin: "server",
      verificationDetails: {},
      allowedDomains: ["local.example.test"],
      installId: "local-install-1",
      installedAt: now,
    },
    ...overrides,
  };
}

async function stubDashboardWorkspaceApis(page, { agent = buildDashboardFixtureAgent() } = {}) {
  const fulfillJson = async (route, body) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };

  await page.route("**/agents/list**", (route) => fulfillJson(route, {
    agents: [agent],
    bridgeAgent: null,
  }));
  await page.route("**/agents/messages**", (route) => fulfillJson(route, {
    messages: [],
  }));
  await page.route("**/agents/operator-workspace**", (route) => fulfillJson(route, {
    enabled: true,
    featureEnabled: true,
    contacts: { list: [] },
    businessProfile: {
      readiness: {
        totalSections: 4,
        completedSections: 4,
        missingCount: 0,
        missingSections: [],
      },
    },
  }));
  await page.route("**/agents/action-queue**", (route) => fulfillJson(route, {
    items: [],
    people: [],
    summary: { total: 0, new: 0, attentionNeeded: 0 },
    peopleSummary: { totalPeople: 0, returningPeople: 0 },
    analyticsSummary: { conversationCount: 0, totalMessages: 0 },
  }));
  await page.route("**/agents/front-desk/training-items**", (route) => fulfillJson(route, {
    items: [],
    persistenceAvailable: true,
    migrationRequired: false,
  }));
  await page.route("**/dashboard/analytics**", (route) => fulfillJson(route, {
    ok: true,
    metrics: {
      totalConversations: 0,
      leadsCaptured: 0,
      conversionRate: 0,
    },
    assistantSource: {
      totalConversations: 0,
      totalMessages: 0,
    },
  }));
  await page.route("**/agents/install-status**", (route) => fulfillJson(route, {
    agent,
  }));
  await page.route("**/agents/activation-wizard**", (route) => fulfillJson(route, {
    wizard: null,
  }));
}

async function stubAsyncKnowledgeImport(page, {
  agentId = "local-agent-1",
  agentKey = "local-public-agent",
  websiteUrl = "https://local.example.test",
  statusSequence,
  waitForFirstStatusRelease = false,
} = {}) {
  const importRequests = [];
  const statusRequests = [];
  const firstStatusGate = waitForFirstStatusRelease ? createDeferred() : null;
  let importCount = 0;
  let statusCount = 0;

  await page.route("**/knowledge/import", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    importCount += 1;
    importRequests.push({
      method: request.method(),
      body,
    });

    const jobId = `browser-import-job-${importCount}`;
    const clientId = body?.client_id || "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "async",
        agentId,
        websiteUrl,
        import: {
          jobId,
          status: "queued",
          reused: false,
        },
        statusUrl: `/api/agents/${encodeURIComponent(agentId)}/knowledge/import/status?job_id=${encodeURIComponent(jobId)}&client_id=${encodeURIComponent(clientId)}`,
      }),
    });
  });

  await page.route("**/api/agents/*/knowledge/import/status**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    statusRequests.push({
      method: request.method(),
      pathname: url.pathname,
      jobId: url.searchParams.get("job_id"),
      clientId: url.searchParams.get("client_id"),
    });

    if (statusCount === 0 && firstStatusGate) {
      await firstStatusGate.promise;
    }

    const status = statusSequence[Math.min(statusCount, statusSequence.length - 1)];
    statusCount += 1;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agentId,
        websiteUrl,
        ...status,
      }),
    });
  });

  return {
    agentKey,
    importRequests,
    releaseFirstStatus: firstStatusGate?.resolve || (() => {}),
    statusRequests,
  };
}

test.before(async () => {
  setTestEnv({
    NODE_ENV: "test",
    PUBLIC_APP_URL: "http://127.0.0.1:3000",
    SUPABASE_URL: undefined,
    SUPABASE_ANON_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
  });
  const started = await startAppServer();
  server = started.server;
  baseUrl = started.baseUrl;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser?.close();
  if (server) {
    await closeServer(server);
  }
  restoreTestEnv();
});

test("signed-out dashboard loads a visible auth shell", async () => {
  const page = await newPage();

  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.locator(".auth-card").waitFor({ state: "visible" });
    await assertVisibleText(page, "Create your Vonza account");
    await assertVisibleText(page, "Sign in");
  } finally {
    await page.close();
  }
});

test("signed-in mock dashboard home loads visible shell content", async () => {
  const page = await newPage();

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-app-shell]").waitFor({ state: "visible" });
    await assertVisibleText(page, "Home");
    await assertVisibleText(page, "Your AI customer service snapshot for today");
    await assertVisibleText(page, "Conversations today");
  } finally {
    await page.close();
  }
});

test("Settings save flow shows success only after backend confirmation", async () => {
  const page = await newPage();
  let releaseSave;
  const saveConfirmed = new Promise((resolve) => {
    releaseSave = resolve;
  });
  let updateRequested = false;

  await page.route("**/agents/update", async (route) => {
    updateRequested = true;
    await saveConfirmed;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        agent: {
          id: "local-agent-1",
          name: "Local fixture workspace",
          assistantName: "Confirmed Front Desk",
          accessStatus: "active",
        },
      }),
    });
  });

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#settings/front-desk`, { waitUntil: "domcontentloaded" });
    const form = page.locator('form[data-form-kind="customize"]').first();
    await form.waitFor({ state: "visible" });
    await form.locator('[name="assistant_name"]').fill("Confirmed Front Desk");
    await form.getByRole("button", { name: /save front desk/i }).click();
    await assertVisibleText(page, "Saving changes...");
    assert.equal(updateRequested, true);
    assert.equal(
      await page.locator("#status-banner").evaluate((element) =>
        element.textContent.includes("Your assistant has been updated.")
      ),
      false
    );

    releaseSave();
    await page.waitForFunction(() =>
      globalThis.document
        .getElementById("status-banner")
        ?.textContent.includes("Your assistant has been updated.")
    );
  } finally {
    await page.close();
  }
});

test("Install page renders copy and verification state", async () => {
  const page = await newPage();

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#install`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-shell-section="install"]').waitFor({ state: "visible" });
    await assertVisibleText(page, "Publish your AI Front Desk page");
    await assertVisibleText(page, "Copy Front Desk page link");
    await assertVisibleText(page, "Verify installation");
    await assertVisibleText(page, "Live install detected");
  } finally {
    await page.close();
  }
});

test("Front Desk practice route renders", async () => {
  const page = await newPage();

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#front-desk/practice`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-shell-section="customize"]').waitFor({ state: "visible" });
    await assertVisibleText(page, "Practice the answer customers will see.");
    await assertVisibleText(page, "Run a visitor-style question");
  } finally {
    await page.close();
  }
});

test("dashboard website import starts async polling and reaches owner-safe limited status", async () => {
  const page = await newPage({ importPollIntervalMs: 10 });
  await stubDashboardWorkspaceApis(page);
  const importHarness = await stubAsyncKnowledgeImport(page, {
    waitForFirstStatusRelease: true,
    statusSequence: [
      {
        state: "queued",
        job: { id: "browser-import-job-1", status: "queued" },
      },
      {
        state: "indexing",
        job: { id: "browser-import-job-1", status: "running", phase: "indexing", pageCount: 5 },
      },
      {
        state: "success",
        job: {
          id: "browser-import-job-1",
          status: "success",
          pageCount: 5,
          contentLength: 1200,
        },
        knowledge: { pageCount: 5, contentLength: 1200 },
        indexing: {
          status: "failed",
          errorCount: 1,
          error: "OpenAI vector provider 500 stack trace sk-test-secret should stay internal",
        },
      },
    ],
  });

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#settings/business`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-app-shell]").waitFor({ state: "visible" });

    await page.locator('[data-settings-section="business_profile"] [data-action="import-knowledge"]').click();
    await assertVisibleText(page, "Website import is queued");

    assert.equal(importHarness.importRequests.length, 1);
    assert.equal(importHarness.importRequests[0].method, "POST");
    assert.equal(importHarness.importRequests[0].body.agent_key, importHarness.agentKey);
    assert.equal(importHarness.importRequests[0].body.client_id, "browser-fixture-client");
    assert.equal(importHarness.importRequests[0].body.async, true);
    assert.equal(importHarness.importRequests[0].body.force, undefined);

    importHarness.releaseFirstStatus();

    await page.waitForFunction(() =>
      globalThis.VonzaDashboardImportStatus?.getDisplayState("local-agent-1")?.state === "limited"
    );
    await assertVisibleText(page, "Partial indexing");
    await assertVisibleText(page, "Website content is available for the Front Desk");

    assert.ok(importHarness.statusRequests.length >= 3);
    assert.equal(importHarness.statusRequests[0].method, "GET");
    assert.equal(importHarness.statusRequests[0].pathname, "/api/agents/local-agent-1/knowledge/import/status");
    assert.equal(importHarness.statusRequests[0].jobId, "browser-import-job-1");
    assert.equal(importHarness.statusRequests[0].clientId, "browser-fixture-client");

    const visibleText = await page.locator("body").innerText();
    assert.equal(visibleText.includes("OpenAI vector provider"), false);
    assert.equal(visibleText.includes("sk-test-secret"), false);
    assert.equal(visibleText.includes("stack trace"), false);
  } finally {
    await page.close();
  }
});

test("failed dashboard website import shows safe retry guidance and retries with force", async () => {
  const page = await newPage({ importPollIntervalMs: 10 });
  await stubDashboardWorkspaceApis(page);
  const importHarness = await stubAsyncKnowledgeImport(page, {
    waitForFirstStatusRelease: true,
    statusSequence: [
      {
        state: "failed",
        job: {
          id: "browser-import-job-1",
          status: "failed",
          error: "ProviderError: OpenAI API key sk-test-secret rejected at internalCrawler.js:42",
        },
      },
    ],
  });

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#settings/business`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-app-shell]").waitFor({ state: "visible" });

    await page.locator('[data-settings-section="business_profile"] [data-action="import-knowledge"]').click();
    await assertVisibleText(page, "Website import is queued");
    importHarness.releaseFirstStatus();

    await page.waitForFunction(() =>
      globalThis.VonzaDashboardImportStatus?.getDisplayState("local-agent-1")?.state === "failed"
    );
    await assertVisibleText(page, "Website import could not finish. Check that the site is reachable, then retry.");
    const retryButton = page.locator('[data-settings-section="business_profile"] [data-action="import-knowledge"]').filter({ hasText: "Retry website import" });
    await retryButton.waitFor({ state: "visible" });

    const visibleText = await page.locator("body").innerText();
    assert.equal(visibleText.includes("ProviderError"), false);
    assert.equal(visibleText.includes("OpenAI API key"), false);
    assert.equal(visibleText.includes("sk-test-secret"), false);
    assert.equal(visibleText.includes("internalCrawler.js"), false);

    await retryButton.click();
    await page.waitForFunction(() =>
      globalThis.VonzaDashboardImportStatus?.getDisplayState("local-agent-1")?.jobId === "browser-import-job-2"
    );

    assert.equal(importHarness.importRequests.length, 2);
    assert.equal(importHarness.importRequests[1].method, "POST");
    assert.equal(importHarness.importRequests[1].body.agent_key, importHarness.agentKey);
    assert.equal(importHarness.importRequests[1].body.client_id, "browser-fixture-client");
    assert.equal(importHarness.importRequests[1].body.async, true);
    assert.equal(importHarness.importRequests[1].body.force, true);
  } finally {
    await page.close();
  }
});

test("Hungarian dashboard fixture routes do not show audited operator English", async () => {
  const deniedPhrases = [
    "Your AI customer service snapshot for today",
    "Conversations today",
    "Guided to next step",
    "Open issues",
    "Track leads, guests, follow-ups, and recent conversations.",
    "Search by name, email, phone, or conversation",
    "All customers",
    "Source",
    "Intent",
    "Status",
    "Practice with Front Desk",
    "Ask a question as if you were a visitor",
    "Prompt starters",
    "Embedded preview",
    "Performance insights for your AI front desk.",
    "Total conversations",
    "Live customer conversations",
    "Top customer questions",
    "Performance by source",
    "Avg. time to first response",
    "Publish your AI Front Desk page",
    "Copy Front Desk page link",
    "Live install detected",
    "Choose method",
    "Configure",
    "Installation methods",
    "Website widget bubble",
    "Copy website bubble code",
    "Adjust how the customer-facing Front Desk speaks",
    "Identity & welcome",
    "What should your customer-facing",
    "Answer customer questions",
    "Booking / next step guidance",
    "Accent color",
    "Account and billing",
    "Current account status",
    "Billing and monthly usage",
    "Plan options",
    "TELEPÍTÉSATION",
    "Nemrégly",
  ];
  const routes = [
    "#home",
    "#customers",
    "#front-desk",
    "#front-desk/practice",
    "#analytics",
    "#install",
    "#settings",
    "#settings/front-desk",
  ];

  for (const routeHash of routes) {
    const page = await newPage({ dashboardLanguage: "hu" });

    try {
      await page.goto(`${baseUrl}/dashboard-v2-fixture${routeHash}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-app-shell]").waitFor({ state: "visible" });
      await assertNoVisibleEnglishLeaks(page, deniedPhrases);
    } finally {
      await page.close();
    }
  }
});

test("public full-page assistant route renders", async () => {
  const page = await newPage();

  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-1",
          publicAgentKey: "public-agent",
        },
        business: {
          id: "business-1",
          name: "Example Services",
          websiteUrl: "https://example.com",
        },
        widgetConfig: {
          assistantName: "Example Front Desk",
          welcomeMessage: "Ask about services, pricing, quotes, or booking.",
          buttonLabel: "Ask",
          launcherText: "AI front desk",
          primaryColor: "#2563eb",
          secondaryColor: "#0f766e",
          fullPageConfig: {
            publicPageEnabled: true,
            publicPageKey: "page-key",
            headline: "Example Services Front Desk",
            subtitle: "Ask about services, pricing, quotes, or booking.",
          },
        },
      }),
    });
  });

  try {
    await page.goto(`${baseUrl}/assistant/public-agent?k=page-key`, { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await assertVisibleText(page, "Example Services");
    await assertVisibleText(page, "Example Services Front Desk");
    await page.locator("#input").waitFor({ state: "visible" });
  } finally {
    await page.close();
  }
});
