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

async function newPage({ dashboardLanguage } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.setDefaultTimeout(8000);
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
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
}

async function assertNoVisibleEnglishLeaks(page, deniedPhrases) {
  const visibleText = await page.locator("body").innerText();
  const leakedPhrases = deniedPhrases.filter((phrase) => visibleText.includes(phrase));
  assert.deepEqual(leakedPhrases, []);
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
    await assertVisibleText(page, "Practice with Front Desk");
    await assertVisibleText(page, "Ask a question as if you were a visitor");
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
    await assertVisibleText(page, "Example Front Desk");
    await page.locator("#input").waitFor({ state: "visible" });
  } finally {
    await page.close();
  }
});
