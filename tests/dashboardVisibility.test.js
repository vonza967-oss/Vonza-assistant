import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dashboardBundlePath = path.join(repoRoot, "frontend", "dashboard.js");
const settingsShellBundlePath = path.join(repoRoot, "frontend", "settings", "SettingsShell.js");

function createStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createDashboardHarness({
  search = "?from=app",
  hash = "",
  session = {
    access_token: "token-1",
    user: {
      id: "owner-1",
      email: "owner@example.com",
    },
  },
  agents = [],
  getSessionError = null,
  customFetch = null,
  operatorWorkspaceFlag = true,
} = {}) {
  const settingsShellScript = readFileSync(settingsShellBundlePath, "utf8");
  const script = readFileSync(dashboardBundlePath, "utf8");
  const elements = new Map();
  const fetchCalls = [];

  class TestElement {
    constructor(id = "") {
      this.id = id;
      this.dataset = {};
      this.style = {};
      this.hidden = false;
      this.disabled = false;
      this.value = "";
      this.attributes = new Map();
      this.listeners = new Map();
      this._innerHTML = "";
      this._textContent = "";
    }

    get innerHTML() {
      return this._innerHTML;
    }

    set innerHTML(value) {
      this._innerHTML = String(value || "");
      const idMatches = [...this._innerHTML.matchAll(/id="([^"]+)"/g)];

      idMatches.forEach((match) => {
        if (!elements.has(match[1])) {
          elements.set(match[1], new TestElement(match[1]));
        }
      });
    }

    get textContent() {
      return this._textContent;
    }

    set textContent(value) {
      this._textContent = String(value || "");
    }

    addEventListener(type, handler) {
      const handlers = this.listeners.get(type) || [];
      handlers.push(handler);
      this.listeners.set(type, handlers);
    }

    removeEventListener(type, handler) {
      const handlers = this.listeners.get(type) || [];
      this.listeners.set(type, handlers.filter((entry) => entry !== handler));
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }
  }

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };

  elements.set("dashboard-root", new TestElement("dashboard-root"));
  elements.set("status-banner", new TestElement("status-banner"));
  elements.set("topbar-meta", new TestElement("topbar-meta"));

  const location = {
    origin: "https://vonza-assistant.onrender.com",
    pathname: "/dashboard",
    search,
    hash,
    href: `https://vonza-assistant.onrender.com/dashboard${search}${hash}`,
    reload() {},
  };

  const buildResponse = ({ status = 200, body, text } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    async text() {
      if (text !== undefined) {
        return text;
      }

      return body === undefined ? "" : JSON.stringify(body);
    },
  });

  const fetchImpl = async (input, options = {}) => {
    const resolvedUrl = new URL(String(input), location.origin);
    fetchCalls.push({
      url: resolvedUrl.toString(),
      pathname: resolvedUrl.pathname,
      options,
    });

    if (typeof customFetch === "function") {
      const customResponse = await customFetch({
        url: resolvedUrl.toString(),
        pathname: resolvedUrl.pathname,
        options,
        buildResponse,
      });

      if (customResponse) {
        return customResponse;
      }
    }

    const resolvedAgents = typeof agents === "function" ? agents() : agents;

    if (resolvedUrl.pathname === "/product-events") {
      return buildResponse({ status: 200, body: { ok: true } });
    }

    if (resolvedUrl.pathname === "/agents/list") {
      return buildResponse({
        status: 200,
        body: {
          agents: resolvedAgents,
          bridgeAgent: null,
        },
      });
    }

    if (resolvedUrl.pathname === "/agents/messages") {
      return buildResponse({
        status: 200,
        body: {
          messages: [],
        },
      });
    }

    if (resolvedUrl.pathname === "/agents/action-queue") {
      return buildResponse({
        status: 200,
        body: {
          items: [],
          people: [],
          peopleSummary: {},
          summary: {},
          persistenceAvailable: true,
          migrationRequired: false,
        },
      });
    }

    if (resolvedUrl.pathname === "/agents/operator-workspace") {
      return buildResponse({
        status: 200,
        body: {
          connectedAccounts: [],
          inbox: {
            threads: [],
            attentionCount: 0,
          },
          calendar: {
            events: [],
            suggestedSlots: [],
            dailySummary: "Calendar context is beta. Home works without it for now.",
            missedBookingOpportunities: [],
          },
          automations: {
            tasks: [],
            campaigns: [],
            followUps: [],
          },
          summary: {},
          capabilities: {
            featureEnabled: true,
            googleAvailable: true,
            googleMissingEnv: [],
            persistenceAvailable: true,
            migrationRequired: false,
            missingTables: [],
            status: "ready",
          },
          alerts: [],
        },
      });
    }

    return buildResponse({ status: 404, body: { error: `Unhandled fetch path: ${resolvedUrl.pathname}` } });
  };

  const storage = createStorageMock();
  const sessionStorage = createStorageMock();
  const window = {
    document,
    location,
    history: {
      replaceState(_state, _title, nextUrl) {
        const parsed = new URL(nextUrl, location.origin);
        location.href = parsed.toString();
        location.search = parsed.search;
        location.hash = parsed.hash;
      },
    },
    localStorage: storage,
    sessionStorage,
    requestAnimationFrame(callback) {
      callback();
    },
    addEventListener() {},
    setTimeout,
    clearTimeout,
    crypto: {
      randomUUID() {
        return "client-1";
      },
    },
    VONZA_PUBLIC_APP_URL: "https://vonza-assistant.onrender.com",
    VONZA_OPERATOR_WORKSPACE_V1: operatorWorkspaceFlag,
    VONZA_SUPABASE_URL: "https://example.supabase.co",
    VONZA_SUPABASE_ANON_KEY: "anon-key",
    VONZA_DEV_FAKE_BILLING: false,
    supabase: {
      createClient() {
        return {
          auth: {
            async getSession() {
              if (getSessionError) {
                throw getSessionError;
              }

              return { data: { session } };
            },
            async signOut() {
              return { error: null };
            },
            onAuthStateChange() {},
          },
        };
      },
    },
  };

  const context = {
    window,
    document,
    console,
    fetch: fetchImpl,
    FormData: class {
      constructor(form) {
        this.entriesList = Array.isArray(form?.__formDataEntries)
          ? form.__formDataEntries.map(([key, value]) => [key, value])
          : [];
      }

      get(name) {
        const match = this.entriesList.find(([key]) => key === name);
        return match ? match[1] : null;
      }

      has(name) {
        return this.entriesList.some(([key]) => key === name);
      }

      entries() {
        return this.entriesList[Symbol.iterator]();
      }

      [Symbol.iterator]() {
        return this.entries();
      }
    },
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    globalThis: null,
  };

  context.globalThis = context;
  window.fetch = fetchImpl;

  vm.runInNewContext(settingsShellScript, context, { filename: "frontend/settings/SettingsShell.js" });
  vm.runInNewContext(script, context, { filename: "frontend/dashboard.js" });

  return {
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    getRootHtml() {
      return elements.get("dashboard-root")?.innerHTML || "";
    },
    getStatus() {
      return elements.get("status-banner")?.textContent || "";
    },
    getGlobal(name) {
      return context[name];
    },
    getLocation() {
      return location;
    },
    fetchCalls,
  };
}

function createActiveAgent(overrides = {}) {
  return {
    id: "agent-1",
    accessStatus: "active",
    name: "Vonza Assistant",
    assistantName: "Vonza Assistant",
    websiteUrl: "https://example.com/",
    publicAgentKey: "agent-key",
    tone: "friendly",
    welcomeMessage: "Welcome",
    installStatus: {
      state: "not_detected",
      label: "Not detected on a live site yet",
    },
    knowledge: {
      state: "ready",
      description: "Knowledge is ready.",
      pageCount: 2,
      contentLength: 1200,
    },
    ...overrides,
  };
}

test("dashboard bundle parses cleanly", () => {
  const bundle = readFileSync(dashboardBundlePath, "utf8");
  assert.doesNotThrow(() => {
    new vm.Script(bundle, { filename: "frontend/dashboard.js" });
  });
});

test("dashboard shows a visible loading state before workspace data resolves", async () => {
  const agent = createActiveAgent();
  let resolveList;
  const listPromise = new Promise((resolve) => {
    resolveList = resolve;
  });

  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/list") {
        await listPromise;
        return buildResponse({
          status: 200,
          body: {
            agents: [agent],
            bridgeAgent: null,
          },
        });
      }

      return null;
    },
  });

  assert.match(harness.getRootHtml(), /Loading your workspace/i);
  assert.match(harness.getRootHtml(), /Getting your customer service dashboard ready\./i);
  assert.doesNotMatch(harness.getRootHtml(), /approvals/i);

  resolveList();
  await harness.settle();
});

test("dashboard renders visible shell content when data loads normally", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getRootHtml(), /Vonza Assistant/);
  assert.match(harness.getRootHtml(), /Home/);
  assert.match(harness.getRootHtml(), /Front Desk/);
  assert.match(harness.getRootHtml(), /Analytics/);
});

test("workspace settings keep legal pages reachable from the logged-in app", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Legal and trust/);
  assert.match(harness.getRootHtml(), /These public pages cover the website, app, widget, and hosted checkout legal surface/);
  assert.match(harness.getRootHtml(), /href="\/aszf"/);
  assert.match(harness.getRootHtml(), /href="\/impresszum"/);
  assert.match(harness.getRootHtml(), /href="\/adatkezelesi-tajekoztato"/);
  assert.match(harness.getRootHtml(), /href="\/cookie-tajekoztato"/);
});

test("auth bootstrap failures render a visible error state instead of a blank shell", async () => {
  const harness = createDashboardHarness({
    getSessionError: new Error("Malformed session payload"),
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /We couldn&#39;t load your Vonza workspace/);
  assert.match(harness.getRootHtml(), /Try again/);
  assert.match(harness.getStatus(), /Malformed session payload/);
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/list"),
    false
  );
});

test("expired magic link callback renders a clean retry UI instead of booting the dashboard", async () => {
  const harness = createDashboardHarness({
    search: "?from=app&error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    session: null,
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /That email link has expired/);
  assert.match(harness.getRootHtml(), /Send new magic link/);
  assert.match(harness.getRootHtml(), /Sign in with password/);
  assert.match(harness.getRootHtml(), /Reset password instead/);
  assert.doesNotMatch(harness.getRootHtml(), /otp_expired|access_denied/);
  assert.match(harness.getStatus(), /email link expired/i);
  assert.doesNotMatch(harness.getStatus(), /otp_expired|access_denied/);
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/list"),
    false
  );
  assert.equal(harness.getLocation().search, "?from=app");
});

test("invalid auth callback hash renders recovery options and clears bad callback state", async () => {
  const harness = createDashboardHarness({
    hash: "#error=access_denied&error_description=Email+link+is+invalid",
    session: null,
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /That email link could not be used/);
  assert.match(harness.getRootHtml(), /Send new magic link/);
  assert.match(harness.getRootHtml(), /Reset password instead/);
  assert.doesNotMatch(harness.getRootHtml(), /access_denied/);
  assert.equal(harness.getLocation().hash, "");
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/list"),
    false
  );
});

test("null auth user session renders the auth shell without fetching dashboard data", async () => {
  const harness = createDashboardHarness({
    session: {
      access_token: "token-without-user",
      user: null,
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Create your Vonza account|Sign in to continue into Vonza/);
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/list"),
    false
  );
});

test("signed-out auth shell shows legal links and signup acknowledgement", async () => {
  const harness = createDashboardHarness({
    session: null,
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Creating an account means you acknowledge the ÁSZF and the Adatkezelési tájékoztató/);
  assert.match(harness.getRootHtml(), /href="\/aszf"/);
  assert.match(harness.getRootHtml(), /href="\/impresszum"/);
  assert.match(harness.getRootHtml(), /href="\/adatkezelesi-tajekoztato"/);
  assert.match(harness.getRootHtml(), /href="\/cookie-tajekoztato"/);
});

test("one failed sub-request keeps the dashboard visible and surfaces an explicit warning", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/action-queue") {
        return buildResponse({
          status: 500,
          body: {
            error: "Missing required message persistence schema for 'messages'. Apply the latest database migration before running this build.",
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getStatus(), /Vonza loaded with partial data/i);
  assert.match(harness.getStatus(), /Missing required message persistence schema/i);
});

test("operator workspace disabled still keeps the dashboard visible", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    operatorWorkspaceFlag: false,
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getRootHtml(), /Home/);
  assert.match(harness.getRootHtml(), /Front Desk/);
  assert.match(harness.getRootHtml(), /Analytics/);
  assert.match(harness.getRootHtml(), /Your core workspace is ready/i);
  assert.match(harness.getRootHtml(), /Connected tools are beta/i);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="inbox"/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="calendar"/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="automations"/);
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/operator-workspace"),
    false
  );
});

test("missing Google env shows a visible non-breaking operator fallback state", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 200,
          body: {
            capabilities: {
              featureEnabled: true,
              googleAvailable: false,
              googleMissingEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
              persistenceAvailable: true,
              migrationRequired: false,
              missingTables: [],
              status: "google_unavailable",
            },
            alerts: [
              "Google integration is not configured on this deployment yet. Set the required Google OAuth env vars to unlock Gmail and Calendar connection.",
            ],
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getRootHtml(), /Connected tools/i);
});

test("missing operator tables show a visible migration fallback state", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 200,
          body: {
            capabilities: {
              featureEnabled: true,
              googleAvailable: true,
              googleMissingEnv: [],
              persistenceAvailable: false,
              migrationRequired: true,
              missingTables: ["google_connected_accounts", "operator_inbox_threads"],
              status: "migration_required",
            },
            alerts: [
              "Operator workspace tables are missing on this deployment. Run the production deploy workflow so Supabase applies the latest workspace migrations before enabling connected Inbox, Calendar, and Automations. Missing tables: google_connected_accounts, operator_inbox_threads.",
            ],
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getRootHtml(), /Calendar/i);
});

test("a failed operator workspace sub-request does not blank the dashboard", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 500,
          body: {
            error: "operator workspace fetch failed",
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /workspace-shell/);
  assert.match(harness.getRootHtml(), /Home/i);
});

test("dashboard shows visible empty states when no analytics data exists", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Home|AI priorities/);
  assert.match(harness.getRootHtml(), /What stands out right now/i);
});

test("Home surfaces weak pricing guidance as an AI priority", async () => {
  const agent = createActiveAgent({
    installStatus: {
      state: "seen_recently",
      label: "Seen recently",
      host: "example.com",
    },
  });
  const messages = [
    {
      id: "message-pricing-1",
      role: "user",
      content: "How much does your monthly package cost?",
      sessionKey: "session-pricing",
      createdAt: "2026-04-14T09:00:00.000Z",
    },
    {
      id: "message-pricing-2",
      role: "assistant",
      content: "Pricing is not mentioned on the website. Please contact the business directly.",
      sessionKey: "session-pricing",
      createdAt: "2026-04-14T09:00:05.000Z",
    },
  ];
  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/messages") {
        return buildResponse({ status: 200, body: { messages } });
      }

      if (pathname === "/agents/action-queue") {
        return buildResponse({
          status: 200,
          body: {
            items: [],
            people: [],
            peopleSummary: {},
            summary: {},
            analyticsSummary: {
              totalMessages: 2,
              visitorQuestions: 1,
              highIntentSignals: 1,
              weakAnswerCount: 1,
              contactsCaptured: 0,
            },
            persistenceAvailable: true,
            migrationRequired: false,
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Clarify pricing guidance/);
  assert.match(harness.getRootHtml(), /Pricing questions usually come from customers who are close to deciding/);
  assert.match(harness.getRootHtml(), /Add clearer pricing ranges, quote guidance, or the exact details customers should share/);
});

test("customer filters and summaries no longer render Helped", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  const buildCustomerFilterDefinitions = harness.getGlobal("buildCustomerFilterDefinitions");
  const buildCustomerSummaryItems = harness.getGlobal("buildCustomerSummaryItems");

  assert.equal(
    buildCustomerFilterDefinitions([{ nextAction: { key: "no_action_needed" }, flags: [], lifecycleState: "new" }])
      .some((item) => item.label === "Helped"),
    false
  );
  assert.equal(
    buildCustomerSummaryItems([{ nextAction: { key: "no_action_needed" }, flags: [], lifecycleState: "new" }])
      .some((item) => item.label === "Helped"),
    false
  );
});

test("Analytics question labels are specific and not raw customer messages", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  const getQuestionThemeLabel = harness.getGlobal("getQuestionThemeLabel");
  const getWeakAnswerThemeLabel = harness.getGlobal("getWeakAnswerThemeLabel");

  assert.equal(
    getQuestionThemeLabel("What is the best way to email or call you?", "contact"),
    "Asking how to contact the business directly"
  );
  assert.equal(
    getQuestionThemeLabel("Can I get a quote for the monthly package?", "pricing"),
    "Requesting pricing or quote details"
  );
  assert.equal(
    getWeakAnswerThemeLabel("Can I get a quote for the monthly package?", "pricing"),
    "Pricing questions need clearer answers"
  );
  assert.equal(
    getWeakAnswerThemeLabel("Which service should I choose?", "services"),
    "Service explanations are too vague"
  );
});

test("Connected Tools heading shows Coming soon as the main state", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  const markup = harness.getGlobal("buildConnectedToolsSettingsPanel")(
    createActiveAgent(),
    harness.getGlobal("createEmptyOperatorWorkspace")()
  );

  assert.match(markup, /<h2 class="settings-section-title">Connected Tools<\/h2>\s*<span class="settings-title-badge">coming soon<\/span>/);
  assert.doesNotMatch(markup, /<span class="badge pending">Beta<\/span>/);
});

test("tab switching still leaves the selected section rendered as the active view", async () => {
  const agent = createActiveAgent();
  const harness = createDashboardHarness({
    agents: () => [agent],
  });
  await harness.settle();

  harness.getGlobal("setActiveShellSection")("analytics");
  harness.getGlobal("renderReadyState")(agent, [], harness.getGlobal("createEmptyActionQueue")());

  assert.equal(harness.getGlobal("getActiveShellSection")(), "analytics");
  assert.match(
    harness.getRootHtml(),
    /shell-nav-button active"[\s\S]*data-shell-target="analytics"/
  );
  assert.match(harness.getRootHtml(), /Customer conversations and successful actions/);
});
