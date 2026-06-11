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

async function newPage({
  clientId = "browser-fixture-client",
  dashboardLanguage,
  importPollIntervalMs,
  viewport = { width: 1280, height: 820 },
} = {}) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const closePage = page.close.bind(page);
  page.close = async (...args) => {
    if (!page.isClosed()) {
      await closePage(...args);
    }
    await context.close().catch(() => {});
  };
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
  await page.route(/\/product-events(?:[?#]|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/install\/outcomes\/ping(?:[?#]|$)/, async (route) => {
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

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    const body = globalThis.document.body;
    return {
      rootClientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
    };
  });

  assert.ok(
    overflow.rootScrollWidth <= overflow.rootClientWidth + 1,
    `document overflows horizontally: ${JSON.stringify(overflow)}`
  );
  assert.ok(
    overflow.bodyScrollWidth <= overflow.bodyClientWidth + 1,
    `body overflows horizontally: ${JSON.stringify(overflow)}`
  );
}

async function assertNoVisibleEnglishLeaks(page, deniedPhrases) {
  const visibleText = await page.locator("body").innerText();
  const leakedPhrases = deniedPhrases.filter((phrase) => visibleText.includes(phrase));
  assert.deepEqual(leakedPhrases, []);
}

function assertNoOwnerOnlyFields(payload) {
  const serialized = JSON.stringify(payload);
  const deniedPatterns = [
    /owner_user_id/i,
    /ownerUserId/,
    /owner_email/i,
    /ownerEmail/,
    /dashboard_client_id/i,
    /dashboardClientId/,
    /supabase/i,
    /service_role/i,
    /stripe/i,
  ];

  for (const pattern of deniedPatterns) {
    assert.equal(
      pattern.test(serialized),
      false,
      `public assistant payload included owner-only data matching ${pattern}: ${serialized}`
    );
  }
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

async function stubDashboardWorkspaceApis(page, {
  agent = buildDashboardFixtureAgent(),
  connectedAppThreads = [],
  connectedAppEvents = [],
  manualReplies = { enabled: false, status: "disabled", lastOutbound: null },
} = {}) {
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
  await page.route("**/dashboard/preferences**", (route) => fulfillJson(route, {
    ok: true,
    persistenceAvailable: true,
    dashboardLanguage: "en",
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
  await page.route("**/agents/action-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
  }));
  await page.route("**/agents/booking-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
  }));
  await page.route("**/agents/quote-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
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
  await page.route("**/agents/connected-app-capabilities**", (route) => fulfillJson(route, {
    capabilities: [],
  }));
  await page.route("**/agents/connected-apps**", (route) => fulfillJson(route, {
    connections: [],
  }));
  await page.route("**/agents/*/connected-apps**", (route) => fulfillJson(route, {
    enablements: [],
  }));
  await page.route("**/agents/*/connected-app-readiness**", (route) => fulfillJson(route, {
    report: {
      reportOnly: true,
      status: "ready",
      requirements: [],
      summary: {
        ready: 0,
        warning: 0,
        blocked: 0,
        requiredBlocked: 0,
        optionalWarnings: 0,
      },
    },
    context: {
      requiredCapabilities: [],
      optionalCapabilities: [],
      connectedCapabilities: [],
      providerStatuses: {},
      scopeGrants: {},
      webhookStatuses: {},
      approvalMode: "manual",
      surface: "operator",
      executionRequested: false,
    },
  }));
  await page.route("**/agents/connected-app-inbound-threads**", (route) => fulfillJson(route, {
    threads: connectedAppThreads,
    manualReplies,
  }));
  await page.route("**/agents/connected-app-inbound-events**", (route) => fulfillJson(route, {
    events: connectedAppEvents,
  }));
}

async function stubWebsiteWidgetDashboardLaunchApis(page, {
  agent = buildDashboardFixtureAgent({
    assistantName: "Launch widget assistant",
    buttonLabel: "Ask us",
    welcomeMessage: "Ask about services, pricing, or booking.",
  }),
} = {}) {
  const fulfillJson = async (route, body) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };

  await page.route("**/public-config.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
window.VONZA_PUBLIC_APP_URL = ${JSON.stringify(baseUrl)};
window.VONZA_SUPABASE_URL = "https://supabase.example.test";
window.VONZA_SUPABASE_ANON_KEY = "anon-test-key";
window.VONZA_DEV_FAKE_BILLING = false;
window.VONZA_OPERATOR_WORKSPACE_V1_ENABLED = true;
window.VONZA_OPERATOR_WORKSPACE_V1 = true;
window.VONZA_TODAY_COPILOT_V1_ENABLED = false;
window.VONZA_DASHBOARD_V2_ENABLED = true;
window.VONZA_APP_VERSION = "browser-test";
window.VONZA_BUILD_SHA = "browser-test";
window.VONZA_LAUNCH_PROFILE = {};
window.VONZA_BILLING_PLANS = [
  { key: "starter", displayName: "Starter", monthlyPriceCents: 2000, monthlyPriceUsd: 20, monthlyPriceHuf: 19900, monthlyPriceLabel: "19,900 HUF/month", billingCurrency: "HUF", checkoutLabel: "Start with Starter", marketing: { audience: "For one Hungarian SME", summary: "A simple way to launch a Hungarian Website Widget" } },
  { key: "growth", displayName: "Growth", monthlyPriceCents: 5000, monthlyPriceUsd: 50, monthlyPriceHuf: 49900, monthlyPriceLabel: "49,900 HUF/month", billingCurrency: "HUF", checkoutLabel: "Start with Growth", recommended: true, marketing: { audience: "For regular customer questions", summary: "Best for most growing Hungarian SMEs" } },
  { key: "pro", displayName: "Pro", monthlyPriceCents: 10000, monthlyPriceUsd: 100, monthlyPriceHuf: 99900, monthlyPriceLabel: "99,900 HUF/month", billingCurrency: "HUF", checkoutLabel: "Start with Pro", marketing: { audience: "For busier Website Widget workspaces", summary: "More room for higher monthly customer volume" } }
];`.trim(),
    });
  });
  await page.route("**/supabase-auth.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
window.supabase = {
  createClient() {
    const session = {
      access_token: "browser-launch-token",
      user: { id: "owner-browser-1", email: "owner@example.test" }
    };
    return {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signOut() {
          return { error: null };
        },
        async signInWithPassword() {
          return { data: { session }, error: null };
        },
        async signInWithOtp() {
          return { error: null };
        }
      }
    };
  }
};`.trim(),
    });
  });
  await page.route("**/dashboard/preferences**", (route) => fulfillJson(route, {
    ok: true,
    persistenceAvailable: true,
    dashboardLanguage: "en",
  }));
  await page.route("**/agents/action-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
  }));
  await page.route("**/agents/booking-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
  }));
  await page.route("**/agents/quote-requests**", (route) => fulfillJson(route, {
    records: [],
    persistenceAvailable: true,
  }));
  await stubDashboardWorkspaceApis(page, { agent });
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
  const page = await newPage({ dashboardLanguage: "en" });

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
  const page = await newPage({ dashboardLanguage: "en" });

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-app-shell]").waitFor({ state: "visible" });
    await assertVisibleText(page, "Home");
    await assertVisibleText(page, "Your AI customer service snapshot for today");
    await assertVisibleText(page, "Website Widget");
  } finally {
    await page.close();
  }
});

test("Settings save flow shows success only after backend confirmation", async () => {
  const page = await newPage({ dashboardLanguage: "en" });
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
    await page.goto(`${baseUrl}/dashboard-v2-fixture#front-desk/customization`, { waitUntil: "domcontentloaded" });
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

test("Website Widget launch dashboard routes render Widget-first surfaces", async () => {
  for (const route of [
    {
      path: "/website-widget/dashboard",
      visibleSelector: '[data-app-shell][data-website-widget-dashboard="dedicated"]',
      expectedText: "Website Widget overview",
    },
    {
      path: "/website-widget/dashboard#install",
      visibleSelector: '[data-shell-section="install"]:not([hidden])',
      expectedText: "Install Website Widget",
    },
    {
      path: "/website-widget/dashboard#settings",
      visibleSelector: '[data-shell-section="settings"]:not([hidden])',
      expectedText: "Widget configuration",
    },
    {
      path: "/website-widget/dashboard#settings/widget/identity-welcome",
      visibleSelector: '[data-shell-section="settings"]:not([hidden])',
      expectedText: "Saved changes shape future widget replies",
    },
    {
      path: "/website-widget/dashboard#preferences",
      visibleSelector: '[data-shell-section="preferences"]:not([hidden])',
      expectedText: "Dashboard language",
    },
  ]) {
    const page = await newPage({ dashboardLanguage: "en" });
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        runtimeErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });
    await stubWebsiteWidgetDashboardLaunchApis(page);

    try {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
      await page.locator(route.visibleSelector).waitFor({ state: "visible" });
      await assertVisibleText(page, route.expectedText);
      assert.equal(
        await page.locator('[data-app-shell][data-dashboard-product="website_widget"]').count(),
        1
      );
      await assertNoHorizontalOverflow(page);

      const visibleText = await page.locator("body").innerText();
      assert.equal(visibleText.includes("Publish your AI Front Desk page"), false);
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await page.close();
    }
  }
});

test("public Widget launch routes serve /widget and /embed.js", async () => {
  const page = await newPage();

  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-widget-1",
          publicAgentKey: "widget-key",
        },
        business: {
          id: "business-widget-1",
          name: "Widget Services",
          websiteUrl: "https://widget.example.test",
        },
        widgetConfig: {
          assistantName: "Widget Services Assistant",
          welcomeMessage: "Ask about services or next steps.",
          launcherText: "Website assistant",
          primaryColor: "#2563eb",
          secondaryColor: "#0f766e",
        },
      }),
    });
  });

  try {
    await page.goto(`${baseUrl}/widget?agent_id=agent-widget-1&embedded=1`, { waitUntil: "domcontentloaded" });
    await page.locator("#assistant-name").waitFor({ state: "visible" });
    await assertVisibleText(page, "Widget Services Assistant");

    const embedResponse = await page.goto(`${baseUrl}/embed.js`, { waitUntil: "domcontentloaded" });
    assert.equal(embedResponse.status(), 200);
    await assertVisibleText(page, "__VonzaAssistantWidgetLoaded__");
  } finally {
    await page.close();
  }
});

test("public embed renders malicious owner config as inert text", async () => {
  const page = await newPage();
  const maliciousButtonLabel = 'Árvíztűrő kérdés <img src=x onerror="window.__vonzaXss=1">';
  const maliciousAssistantName = 'Ügyfélszolgálat <svg onload="window.__vonzaXss=2"></svg>';
  const scriptSchemeUrl = ["java", "script:alert(1)"].join("");
  const scriptConfig = JSON.stringify({
    installId: "install-xss-1",
    buttonLabel: maliciousButtonLabel,
    primaryColor: `red; background-image:url(${scriptSchemeUrl})`,
    secondaryColor: "#12zzzz",
  }).replaceAll("<", "\\u003c");

  await page.route("**/embed-xss-host", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html>
<html>
  <head><meta charset="UTF-8"><title>Embed XSS host</title></head>
  <body>
    <h1>Customer site</h1>
    <script>
      window.__vonzaXss = 0;
      window.VonzaWidgetConfig = ${scriptConfig};
    </script>
    <script async src="/embed.js"></script>
  </body>
</html>`,
    });
  });
  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        install: {
          installId: "install-xss-1",
        },
        widgetConfig: {
          assistantName: maliciousAssistantName,
          buttonLabel: '<button onclick="window.__vonzaXss=3">Bad</button>',
          primaryColor: "expression(alert(1))",
          secondaryColor: scriptSchemeUrl,
          logoUrl: scriptSchemeUrl,
          widgetLogoUrl: scriptSchemeUrl,
          avatarUrl: "data:image/svg+xml,<svg onload=alert(1)>",
        },
      }),
    });
  });
  for (const installPath of ["/install/ping", "/install/events"]) {
    await page.route(`**${installPath}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
  }

  try {
    await page.goto(`${baseUrl}/embed-xss-host`, { waitUntil: "domcontentloaded" });
    await page.locator("#vonza-widget-root").waitFor({ state: "attached" });
    await page.waitForFunction(() => globalThis.document.getElementById("vonza-widget-root")?.shadowRoot);

    const embedState = await page.evaluate(() => {
      const host = globalThis.document.getElementById("vonza-widget-root");
      const shadow = host.shadowRoot;
      return {
        xss: globalThis.__vonzaXss,
        launcherText: shadow.querySelector(".launcher-label")?.textContent || "",
        launcherAria: shadow.querySelector(".launcher")?.getAttribute("aria-label") || "",
        statusCopy: shadow.querySelector(".status-copy")?.textContent || "",
        iframeTitle: shadow.querySelector(".frame")?.getAttribute("title") || "",
        primaryColor: host.style.getPropertyValue("--widget-primary"),
        secondaryColor: host.style.getPropertyValue("--widget-secondary"),
        executableNodeCount: shadow.querySelectorAll("script, img, svg, [onload], [onerror], [onclick]").length,
      };
    });

    assert.equal(embedState.xss, 0);
    assert.equal(embedState.executableNodeCount, 0);
    assert.equal(embedState.launcherText, maliciousButtonLabel);
    assert.equal(embedState.launcherAria, maliciousButtonLabel);
    assert.equal(embedState.iframeTitle, maliciousAssistantName);
    assert.equal(embedState.statusCopy, `We're getting ${maliciousAssistantName} ready.`);
    assert.equal(embedState.primaryColor, "#5b61ff");
    assert.equal(embedState.secondaryColor, "#7c4dff");
  } finally {
    await page.close();
  }
});

test("Front Desk practice route renders", async () => {
  const page = await newPage({ dashboardLanguage: "en" });

  try {
    await page.goto(`${baseUrl}/dashboard-v2-fixture#front-desk/practice`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-shell-section="customize"]').waitFor({ state: "visible" });
    await assertVisibleText(page, "Practice the answer customers will see.");
    await assertVisibleText(page, "Run a visitor-style question");
  } finally {
    await page.close();
  }
});

test("Connected apps inbox renders disabled manual staff reply composer without layout overlap", async () => {
  for (const viewport of [
    { width: 1280, height: 820 },
    { width: 390, height: 844 },
  ]) {
    const page = await newPage({ viewport, dashboardLanguage: "en" });
    await stubDashboardWorkspaceApis(page, {
      connectedAppThreads: [
        {
          id: "whatsapp-thread-1",
          provider: "whatsapp",
          appKey: "whatsapp.business",
          externalThreadLabel: "WhatsApp customer thread",
          status: "reviewing",
          unreadCount: 1,
          lastEventAt: "2026-05-25T12:00:00.000Z",
          lastEventType: "message_received",
          lastMessageType: "text",
        },
      ],
      connectedAppEvents: [
        {
          id: "whatsapp-event-1",
          threadId: "whatsapp-thread-1",
          providerEventType: "message_received",
          eventStatus: "received",
          receivedAt: "2026-05-25T12:00:00.000Z",
          normalized: { messageType: "text" },
        },
      ],
    });

    try {
      await page.goto(`${baseUrl}/dashboard-v2-fixture#settings/connected-apps`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-settings-section="connected_apps"]').waitFor({ state: "visible" });
      await page.locator(".settings-connected-app-thread-row").first().waitFor({ state: "visible" });
      await assertVisibleText(page, "Manual staff reply");
      await assertVisibleText(page, "Staff must review before sending. No automatic WhatsApp replies.");
      await assertVisibleText(page, "Sending is disabled by server feature flag.");
      await assertNoHorizontalOverflow(page);

      const layout = await page.locator(".settings-connected-app-thread-row").first().evaluate((row) => {
        const statusForm = row.querySelector("[data-connected-app-inbox-status-form]");
        const disabledComposer = Array.from(row.querySelectorAll(".settings-connected-app-empty"))
          .find((element) => element.textContent.includes("Sending is disabled"));
        const rectFor = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };
        };

        return {
          statusForm: rectFor(statusForm),
          disabledComposer: rectFor(disabledComposer),
          viewportWidth: globalThis.document.documentElement.clientWidth,
        };
      });

      assert.ok(
        layout.disabledComposer.top >= layout.statusForm.bottom - 1,
        `disabled manual reply panel overlaps status form: ${JSON.stringify(layout)}`
      );
      assert.ok(layout.disabledComposer.width > 120, `disabled manual reply panel is too narrow: ${JSON.stringify(layout)}`);
      assert.ok(
        layout.disabledComposer.right <= layout.viewportWidth + 1,
        `disabled manual reply panel overflows: ${JSON.stringify(layout)}`
      );
      assert.equal(await page.locator("[data-connected-app-manual-reply-form]").count(), 0);
    } finally {
      await page.close();
    }
  }
});

test("dashboard website import starts async polling and reaches owner-safe limited status", async () => {
  const page = await newPage({ importPollIntervalMs: 10, dashboardLanguage: "en" });
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
  const page = await newPage({ importPollIntervalMs: 10, dashboardLanguage: "en" });
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

    const retryImportResponse = page.waitForResponse((response) =>
      response.url().includes("/knowledge/import") && response.request().method() === "POST"
    );
    await retryButton.click();
    await retryImportResponse;

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
    "Installation methods",
    "Website Widget embed",
    "Copy widget snippet",
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
    "#front-desk/customization",
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

test("hosted full-page Front Desk sends customer question and captures contact details", async () => {
  const page = await newPage({ dashboardLanguage: "en" });
  const consoleErrors = [];
  const bootstrapRequests = [];
  const chatRequests = [];
  const captureRequests = [];
  const installEvents = [];
  const phoneOrTelephonyRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (/\/phone(?:[/?#]|$)|twilio/i.test(url)) {
      phoneOrTelephonyRequests.push(url);
    }
  });

  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });

  await page.route("**/widget/bootstrap**", async (route) => {
    const url = new URL(route.request().url());
    bootstrapRequests.push({
      method: route.request().method(),
      params: Object.fromEntries(url.searchParams.entries()),
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-page-1",
          publicAgentKey: "page-key",
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
          voice_config: {
            voice_input_enabled: true,
            spoken_replies_enabled: true,
            web_call_enabled: true,
            auto_play_spoken_replies: false,
            voice: "sage",
          },
        },
      }),
    });
  });
  await page.route(/\/chat(?:[?#]|$)/, async (route) => {
    const request = route.request();
    chatRequests.push({
      method: request.method(),
      body: request.postDataJSON(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Yes. Example Services handles urgent repair requests and can prepare a quote after a few details.",
        agentId: "agent-page-1",
        agentKey: "page-key",
        businessId: "business-1",
        visitorIdentity: {
          mode: "guest",
          email: "",
          name: "",
        },
      }),
    });
  });
  await page.route(/\/chat\/capture(?:[?#]|$)/, async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    captureRequests.push({
      method: request.method(),
      body,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        visitorIdentity: body.visitor_identity || {
          mode: "identified",
          email: "customer@example.test",
          name: "Customer Example",
        },
        leadCapture: {
          id: "lead-page-1",
          state: "captured",
          message: "Thanks. I saved those details so the team can follow up.",
          preferredChannel: "email",
          contact: {
            email: "customer@example.test",
          },
        },
      }),
    });
  });
  await page.route(/\/install\/events(?:[?#]|$)/, async (route) => {
    const request = route.request();
    installEvents.push({
      method: request.method(),
      body: request.postDataJSON(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/install\/outcomes\/detect(?:[?#]|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/chat\/feedback(?:[?#]|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  try {
    const hostedUrl = new URL(`${baseUrl}/assistant/page-key`);
    hostedUrl.searchParams.set("k", "page-key");
    hostedUrl.searchParams.set("session_id", "session-page-1");
    hostedUrl.searchParams.set("install_id", "install-page-1");
    hostedUrl.searchParams.set("origin", "https://customer.example.test");
    hostedUrl.searchParams.set("page_url", "https://customer.example.test/front-desk");

    await page.goto(hostedUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await assertVisibleText(page, "Example Services");
    await assertVisibleText(page, "Example Services Front Desk");
    await page.locator("#call-front-desk-panel").waitFor({ state: "visible" });
    await assertVisibleText(page, "Talk to the Front Desk");
    await assertVisibleText(page, "Ready for browser voice");
    await assertVisibleText(page, "Duration 00:00");
    await assertVisibleText(page, "Turns 0");
    await page.locator("#input").waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(page);

    assert.equal(bootstrapRequests.length, 1);
    assert.equal(bootstrapRequests[0].method, "GET");
    assert.equal(bootstrapRequests[0].params.agent_key, "page-key");
    assert.equal(bootstrapRequests[0].params.k, "page-key");
    assert.equal(bootstrapRequests[0].params.mode, "page");

    await page.locator("#input").fill("Do you offer emergency plumbing repairs and how can I request a quote?");
    await page.locator("#send-button").click();
    await assertVisibleText(
      page,
      "Yes. Example Services handles urgent repair requests and can prepare a quote after a few details."
    );

    assert.equal(chatRequests.length, 1);
    assert.equal(chatRequests[0].method, "POST");
    assert.equal(chatRequests[0].body.message, "Do you offer emergency plumbing repairs and how can I request a quote?");
    assert.equal(chatRequests[0].body.display_mode, "page");
    assert.equal(chatRequests[0].body.agent_key, "page-key");
    assert.equal(chatRequests[0].body.public_page_key, "page-key");
    assert.equal(chatRequests[0].body.visitor_session_key, "session-page-1");
    assert.equal(chatRequests[0].body.visitor_identity_mode, "guest");
    assert.equal(Object.hasOwn(chatRequests[0].body, "conversation_source"), false);
    assertNoOwnerOnlyFields(chatRequests[0].body);

    await page.locator('[data-canvas-answer-action="contact"]').click();
    await page.locator("#page-identity-email-form").waitFor({ state: "visible" });
    await page.locator("#page-identity-name").fill("  Customer Example  ");
    await page.locator("#page-identity-email").fill("CUSTOMER@EXAMPLE.TEST");
    await page.locator("#page-identity-email-submit").click();
    await page.waitForFunction(() =>
      globalThis.document
        .getElementById("composer-status")
        ?.textContent.includes("customer@example.test")
    );

    assert.equal(captureRequests.length, 1);
    assert.equal(captureRequests[0].method, "POST");
    assert.equal(captureRequests[0].body.action, "submit");
    assert.equal(captureRequests[0].body.display_mode, "page");
    assert.equal(captureRequests[0].body.agent_key, "page-key");
    assert.equal(captureRequests[0].body.public_page_key, "page-key");
    assert.equal(captureRequests[0].body.visitor_session_key, "session-page-1");
    assert.equal(captureRequests[0].body.name, "Customer Example");
    assert.equal(captureRequests[0].body.email, "customer@example.test");
    assert.equal(captureRequests[0].body.preferred_channel, "email");
    assert.equal(captureRequests[0].body.visitor_identity.mode, "identified");
    assert.equal(captureRequests[0].body.visitor_identity.email, "customer@example.test");
    assertNoOwnerOnlyFields(captureRequests[0].body);
    for (const event of installEvents) {
      assert.equal(event.method, "POST");
      assert.equal(event.body.display_mode, "page");
      assert.equal(event.body.public_page_key, "page-key");
      assert.equal(event.body.session_id, "session-page-1");
      assertNoOwnerOnlyFields(event.body);
    }
    assert.deepEqual(phoneOrTelephonyRequests, []);
    await assertNoHorizontalOverflow(page);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await page.close();
  }
});

test("hosted full-page Front Desk hides call CTA when voice input is disabled", async () => {
  const page = await newPage({ dashboardLanguage: "en" });

  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-page-1",
          publicAgentKey: "page-key",
        },
        business: {
          id: "business-1",
          name: "Example Services",
          websiteUrl: "https://example.com",
        },
        widgetConfig: {
          assistantName: "Example Front Desk",
          voice_config: {
            voice_input_enabled: false,
            spoken_replies_enabled: true,
          },
          fullPageConfig: {
            publicPageEnabled: true,
            publicPageKey: "page-key",
            headline: "Example Services Front Desk",
          },
        },
      }),
    });
  });

  try {
    const hostedUrl = new URL(`${baseUrl}/assistant/page-key`);
    hostedUrl.searchParams.set("k", "page-key");
    hostedUrl.searchParams.set("session_id", "session-page-voice-disabled");
    hostedUrl.searchParams.set("install_id", "install-page-1");
    hostedUrl.searchParams.set("origin", "https://customer.example.test");
    hostedUrl.searchParams.set("page_url", "https://customer.example.test/front-desk");

    await page.goto(hostedUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await page.locator("#input").waitFor({ state: "visible" });

    assert.equal(await page.locator("#call-front-desk-panel").isVisible(), false);
  } finally {
    await page.close();
  }
});

test("hosted full-page Front Desk hides call CTA when web call is disabled", async () => {
  const page = await newPage({ dashboardLanguage: "en" });
  const voiceRequests = [];

  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
  await page.route("**/api/voice/**", async (route) => {
    voiceRequests.push(route.request().url());
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "passive voice request should not happen" }),
    });
  });
  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-page-1",
          publicAgentKey: "page-key",
        },
        business: {
          id: "business-1",
          name: "Example Services",
          websiteUrl: "https://example.com",
        },
        widgetConfig: {
          assistantName: "Example Front Desk",
          voice_config: {
            voice_input_enabled: true,
            spoken_replies_enabled: true,
            web_call_enabled: false,
          },
          fullPageConfig: {
            publicPageEnabled: true,
            publicPageKey: "page-key",
            headline: "Example Services Front Desk",
          },
        },
      }),
    });
  });

  try {
    const hostedUrl = new URL(`${baseUrl}/assistant/page-key`);
    hostedUrl.searchParams.set("k", "page-key");
    hostedUrl.searchParams.set("session_id", "session-page-web-call-disabled");
    hostedUrl.searchParams.set("install_id", "install-page-1");
    hostedUrl.searchParams.set("origin", "https://customer.example.test");
    hostedUrl.searchParams.set("page_url", "https://customer.example.test/front-desk");

    await page.goto(hostedUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await page.locator("#input").waitFor({ state: "visible" });

    assert.equal(await page.locator("#call-front-desk-panel").isVisible(), false);
    assert.deepEqual(voiceRequests, []);
  } finally {
    await page.close();
  }
});

test("hosted full-page Front Desk shows call CTA on mobile when web call is enabled", async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 }, dashboardLanguage: "en" });

  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-page-1",
          publicAgentKey: "page-key",
        },
        business: {
          id: "business-1",
          name: "Example Services",
          websiteUrl: "https://example.com",
        },
        widgetConfig: {
          assistantName: "Example Front Desk",
          voice_config: {
            voice_input_enabled: true,
            spoken_replies_enabled: true,
            web_call_enabled: true,
          },
          fullPageConfig: {
            publicPageEnabled: true,
            publicPageKey: "page-key",
            headline: "Example Services Front Desk",
          },
        },
      }),
    });
  });

  try {
    const hostedUrl = new URL(`${baseUrl}/assistant/page-key`);
    hostedUrl.searchParams.set("k", "page-key");
    hostedUrl.searchParams.set("session_id", "session-page-mobile-web-call");
    hostedUrl.searchParams.set("install_id", "install-page-1");
    hostedUrl.searchParams.set("origin", "https://customer.example.test");
    hostedUrl.searchParams.set("page_url", "https://customer.example.test/front-desk");

    await page.goto(hostedUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await page.locator("#call-front-desk-panel").waitFor({ state: "visible" });
    await assertVisibleText(page, "Talk to the Front Desk");
    await assertNoHorizontalOverflow(page);
  } finally {
    await page.close();
  }
});

test("hosted full-page Web Call turn sends source marker without phone traffic", async () => {
  const page = await newPage({ dashboardLanguage: "en" });
  const chatRequests = [];
  const voiceRequests = [];
  const speechRequests = [];
  const captureRequests = [];
  const productEventRequests = [];
  const phoneOrTelephonyRequests = [];

  page.on("request", (request) => {
    const url = request.url();
    if (/\/phone(?:[/?#]|$)|twilio/i.test(url)) {
      phoneOrTelephonyRequests.push(url);
    }
  });

  await page.addInitScript(() => {
    class TestMediaRecorder {
      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
        this.listeners = new Map();
      }

      static isTypeSupported() {
        return true;
      }

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.listeners.get("dataavailable")?.({
          data: new Blob(["audio"], { type: this.mimeType }),
        });
        this.listeners.get("stop")?.();
      }
    }

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    });
    globalThis.MediaRecorder = TestMediaRecorder;
    globalThis.Audio = class TestAudio {
      constructor() {
        this.listeners = new Map();
        this.currentTime = 0;
      }

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }

      async play() {
        return undefined;
      }

      pause() {}
    };
  });

  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "",
    });
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
  await page.route("**/widget/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        agent: {
          id: "agent-page-1",
          publicAgentKey: "page-key",
        },
        business: {
          id: "business-1",
          name: "Example Services",
          websiteUrl: "https://example.com",
        },
        widgetConfig: {
          assistantName: "Example Front Desk",
          voice_config: {
            voice_input_enabled: true,
            spoken_replies_enabled: true,
            web_call_enabled: true,
            voice: "sage",
          },
          fullPageConfig: {
            publicPageEnabled: true,
            publicPageKey: "page-key",
            headline: "Example Services Front Desk",
          },
        },
      }),
    });
  });
  await page.route(/\/api\/voice\/realtime\/session(?:[?#]|$)/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Realtime Web Call is unavailable in this browser smoke.",
        code: "openai_realtime_unavailable",
      }),
    });
  });
  await page.route(/\/api\/voice\/transcribe(?:[?#]|$)/, async (route) => {
    voiceRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Can I request a quote by voice?" }),
    });
  });
  await page.route(/\/chat(?:[?#]|$)/, async (route) => {
    const request = route.request();
    chatRequests.push({
      method: request.method(),
      body: request.postDataJSON(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Yes. I can help collect quote details.",
        agentId: "agent-page-1",
        agentKey: "page-key",
        businessId: "business-1",
        speech: {
          token: "browser-call-speech-token",
          expiresAt: "2026-05-25T12:05:00.000Z",
        },
        visitorIdentity: {
          mode: "guest",
          email: "",
          name: "",
        },
      }),
    });
  });
  await page.route(/\/api\/voice\/speech(?:[?#]|$)/, async (route) => {
    speechRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      body: Buffer.from("mp3"),
    });
  });
  await page.route(/\/chat\/capture(?:[?#]|$)/, async (route) => {
    const body = route.request().postDataJSON();
    captureRequests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        visitorIdentity: body.visitor_identity,
        leadCapture: {
          id: "lead-web-call-1",
          state: "captured",
          message: "Thanks. I saved those details so the team can follow up.",
          preferredChannel: "email",
          contact: {
            email: body.email,
            name: body.name,
          },
        },
      }),
    });
  });
  await page.route(/\/product-events(?:[?#]|$)/, async (route) => {
    productEventRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/install\/events(?:[?#]|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  try {
    const hostedUrl = new URL(`${baseUrl}/assistant/page-key`);
    hostedUrl.searchParams.set("k", "page-key");
    hostedUrl.searchParams.set("session_id", "session-page-web-call-turn");
    hostedUrl.searchParams.set("install_id", "install-page-1");
    hostedUrl.searchParams.set("origin", "https://customer.example.test");
    hostedUrl.searchParams.set("page_url", "https://customer.example.test/front-desk");

    await page.goto(hostedUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#page-assistant-hero").waitFor({ state: "visible" });
    await page.locator("#call-front-desk-panel").waitFor({ state: "visible" });

    await page.locator("#call-front-desk-start").click();
    await page.locator("#call-front-desk-stop").waitFor({ state: "visible" });
    await page.locator("#call-front-desk-stop").click();
    await assertVisibleText(page, "Yes. I can help collect quote details.");

    assert.equal(voiceRequests.length, 1);
    assert.equal(chatRequests.length, 1);
    assert.equal(chatRequests[0].method, "POST");
    assert.equal(chatRequests[0].body.message, "Can I request a quote by voice?");
    assert.equal(chatRequests[0].body.display_mode, "page");
    assert.equal(chatRequests[0].body.conversation_source, "web_call");
    assert.equal(chatRequests[0].body.public_page_key, "page-key");
    assert.equal(chatRequests[0].body.visitor_session_key, "session-page-web-call-turn");
    assertNoOwnerOnlyFields(chatRequests[0].body);
    assert.equal(speechRequests.length, 1);
    assert.equal(speechRequests[0].display_mode, "page");
    assert.equal(speechRequests[0].speech_token, "browser-call-speech-token");

    await page.locator("#call-front-desk-end").click();
    await assertVisibleText(page, "Browser voice ended");
    await assertVisibleText(page, "Leave contact details");
    await page.locator("#call-front-desk-contact").click();
    await page.locator("#page-identity-email-form").waitFor({ state: "visible" });
    await page.locator("#page-identity-name").fill("Web Caller");
    await page.locator("#page-identity-email").fill("WEB.CALLER@EXAMPLE.TEST");
    await page.locator("#page-identity-email-submit").click();
    await page.waitForFunction(() =>
      globalThis.document
        .getElementById("composer-status")
        ?.textContent.includes("web.caller@example.test")
    );
    await page.waitForTimeout(100);

    assert.equal(captureRequests.length, 1);
    assert.equal(captureRequests[0].display_mode, "page");
    assert.equal(captureRequests[0].conversation_source, "web_call");
    assert.equal(captureRequests[0].web_call_id, productEventRequests[0].metadata.web_call_id);
    assert.equal(captureRequests[0].public_page_key, "page-key");
    assert.equal(captureRequests[0].visitor_session_key, "session-page-web-call-turn");
    assert.equal(captureRequests[0].email, "web.caller@example.test");
    const productEventNames = productEventRequests.map((body) => body.event_name);
    assert.ok(productEventNames.includes("web_call_started"));
    assert.ok(productEventNames.includes("web_call_ended"));
    assert.ok(productEventNames.includes("web_call_contact_opened"));
    assert.ok(productEventNames.includes("web_call_contact_submitted"));
    assert.equal(productEventRequests.every((body) => body.source === "public_web_call"), true);
    assert.equal(productEventRequests.every((body) => body.metadata.conversation_source === "web_call"), true);
    assert.doesNotMatch(JSON.stringify(productEventRequests), /Can I request a quote by voice|Yes\. I can help|WEB\.CALLER|web\.caller@example\.test|browser-call-speech-token/i);
    assert.deepEqual(phoneOrTelephonyRequests, []);
  } finally {
    await page.close();
  }
});
