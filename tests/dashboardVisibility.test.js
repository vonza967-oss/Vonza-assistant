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
const dashboardI18nPath = path.join(repoRoot, "frontend", "i18n", "dashboardI18n.js");
const dashboardHelpersPath = path.join(repoRoot, "frontend", "dashboardHelpers.js");
const dashboardStatePath = path.join(repoRoot, "frontend", "dashboardState.js");
const dashboardLabelsPath = path.join(repoRoot, "frontend", "dashboardLabels.js");
const dashboardInstallPath = path.join(repoRoot, "frontend", "dashboardInstall.js");
const dashboardFrontDeskPath = path.join(repoRoot, "frontend", "dashboardFrontDesk.js");
const dashboardCustomersPath = path.join(repoRoot, "frontend", "dashboardCustomers.js");
const dashboardAnalyticsPath = path.join(repoRoot, "frontend", "dashboardAnalytics.js");
const dashboardTodayPath = path.join(repoRoot, "frontend", "dashboardToday.js");
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
  initialLocalStorage = {},
} = {}) {
  const settingsShellScript = readFileSync(settingsShellBundlePath, "utf8");
  const dashboardI18nScript = readFileSync(dashboardI18nPath, "utf8");
  const dashboardStateScript = readFileSync(dashboardStatePath, "utf8");
  const dashboardLabelsScript = readFileSync(dashboardLabelsPath, "utf8");
  const dashboardInstallScript = readFileSync(dashboardInstallPath, "utf8");
  const dashboardFrontDeskScript = readFileSync(dashboardFrontDeskPath, "utf8");
  const dashboardCustomersScript = readFileSync(dashboardCustomersPath, "utf8");
  const dashboardAnalyticsScript = readFileSync(dashboardAnalyticsPath, "utf8");
  const dashboardTodayScript = readFileSync(dashboardTodayPath, "utf8");
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

    if (resolvedUrl.pathname === "/agents/front-desk/training-items") {
      return buildResponse({
        status: 200,
        body: {
          items: [],
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
  Object.entries(initialLocalStorage).forEach(([key, value]) => {
    storage.setItem(key, value);
  });
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

  vm.runInNewContext(dashboardI18nScript, context, { filename: "frontend/i18n/dashboardI18n.js" });
  vm.runInNewContext(settingsShellScript, context, { filename: "frontend/settings/SettingsShell.js" });
  vm.runInNewContext(dashboardStateScript, context, { filename: "frontend/dashboardState.js" });
  vm.runInNewContext(dashboardLabelsScript, context, { filename: "frontend/dashboardLabels.js" });
  vm.runInNewContext(dashboardInstallScript, context, { filename: "frontend/dashboardInstall.js" });
  vm.runInNewContext(dashboardFrontDeskScript, context, { filename: "frontend/dashboardFrontDesk.js" });
  vm.runInNewContext(dashboardCustomersScript, context, { filename: "frontend/dashboardCustomers.js" });
  vm.runInNewContext(dashboardAnalyticsScript, context, { filename: "frontend/dashboardAnalytics.js" });
  vm.runInNewContext(dashboardTodayScript, context, { filename: "frontend/dashboardToday.js" });
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

function parseFetchJsonBody(options = {}) {
  try {
    return JSON.parse(String(options.body || "{}"));
  } catch {
    return {};
  }
}

function createOperatorWorkspaceWithContacts(contacts = [], overrides = {}) {
  return {
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
    contacts: {
      list: contacts,
      summary: {
        totalContacts: contacts.length,
        contactsNeedingAttention: contacts.filter((contact) => ["needs_reply", "needs_review"].includes(contact.lifecycleState)).length,
        complaintRiskContacts: contacts.filter((contact) => contact.lifecycleState === "complaint_risk").length,
        leadsWithoutNextStep: contacts.filter((contact) => ["new", "active_lead", "qualified"].includes(contact.lifecycleState)).length,
        customersAwaitingFollowUp: contacts.filter((contact) => contact.email || contact.phone).length,
        contactsWithOutcomes: 0,
        highValueWithoutOutcome: 0,
      },
      health: {
        persistenceAvailable: true,
        migrationRequired: false,
        partialData: false,
      },
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
    ...overrides,
  };
}

function getContactRowHtml(html, contactId) {
  const pattern = new RegExp(`<article[^>]*class="contact-row customer-row"[^>]*data-contact-id="${contactId}"[\\s\\S]*?<\\/article>`);
  const match = html.match(pattern);
  return match ? match[0] : "";
}

function getContactDetailHtml(html, contactId) {
  const pattern = new RegExp(`<article[^>]*class="contact-detail-panel customer-detail-panel[^"]*"[^>]*data-contact-id="${contactId}"[\\s\\S]*?<\\/article>`);
  const match = html.match(pattern);
  return match ? match[0] : "";
}

test("dashboard bundle parses cleanly", () => {
  const bundle = readFileSync(dashboardBundlePath, "utf8");
  assert.doesNotThrow(() => {
    new vm.Script(bundle, { filename: "frontend/dashboard.js" });
  });
});

test("dashboard helper bundle parses and exposes low-risk utility helpers", () => {
  const helperBundle = readFileSync(dashboardHelpersPath, "utf8");
  const stateBundle = readFileSync(dashboardStatePath, "utf8");
  const labelsBundle = readFileSync(dashboardLabelsPath, "utf8");
  const installBundle = readFileSync(dashboardInstallPath, "utf8");
  const frontDeskBundle = readFileSync(dashboardFrontDeskPath, "utf8");
  const customersBundle = readFileSync(dashboardCustomersPath, "utf8");
  const analyticsBundle = readFileSync(dashboardAnalyticsPath, "utf8");
  const todayBundle = readFileSync(dashboardTodayPath, "utf8");
  const context = { window: {}, URLSearchParams };

  assert.doesNotThrow(() => {
    new vm.Script(helperBundle, { filename: "frontend/dashboardHelpers.js" }).runInNewContext(context);
    new vm.Script(stateBundle, { filename: "frontend/dashboardState.js" }).runInNewContext(context);
    new vm.Script(labelsBundle, { filename: "frontend/dashboardLabels.js" }).runInNewContext(context);
    new vm.Script(installBundle, { filename: "frontend/dashboardInstall.js" }).runInNewContext(context);
    new vm.Script(frontDeskBundle, { filename: "frontend/dashboardFrontDesk.js" }).runInNewContext(context);
    new vm.Script(customersBundle, { filename: "frontend/dashboardCustomers.js" }).runInNewContext(context);
    new vm.Script(analyticsBundle, { filename: "frontend/dashboardAnalytics.js" }).runInNewContext(context);
    new vm.Script(todayBundle, { filename: "frontend/dashboardToday.js" }).runInNewContext(context);
  });

  assert.equal(context.window.VonzaDashboardHelpers.escapeHtml("<b>Vonza</b>"), "&lt;b&gt;Vonza&lt;/b&gt;");
  assert.equal(context.window.VonzaDashboardHelpers.trimText("  Vonza  "), "Vonza");
  assert.equal(typeof context.window.VonzaDashboardToday.createTodayHelpers, "function");
  assert.equal(
    context.window.VonzaDashboardHelpers.normalizeBillingPlanKey("starter", [{ key: "starter" }], "growth"),
    "starter"
  );
  assert.equal(context.window.VonzaDashboardHelpers.normalizeBillingPlanKey("bad", [{ key: "starter" }], "growth"), "growth");
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.VonzaDashboardState.getDashboardUiStateHashUpdates("#front-desk/customization/voice"))),
    { frontDeskTab: "customization", settingsFrontDeskTab: "voice" }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.VonzaDashboardState.getDashboardUiStateHashUpdates("#install/qr"))),
    { installMethod: "qr" }
  );
  assert.equal(context.window.VonzaDashboardState.getInstallMethodPanelKey("full-page-assistant"), "page");
  assert.equal(context.window.VonzaDashboardState.getInstallMethodPanelKey("front-desk-page"), "page");
  assert.equal(context.window.VonzaDashboardState.getInstallMethodPanelKey("qr-code"), "qr");
  assert.equal(context.window.VonzaDashboardState.normalizeSettingsMainTab("front-desk"), "front_desk");
  assert.equal(context.window.VonzaDashboardState.normalizeSettingsFrontDeskTab("widget-appearance"), "appearance");
  assert.equal(context.window.VonzaDashboardState.normalizeSettingsFrontDeskTab("optional-widget"), "appearance");
  assert.equal(context.window.VonzaDashboardState.getSettingsFrontDeskTabHashSegment("full_page"), "full-page-assistant");
  assert.equal(context.window.VonzaDashboardState.getSettingsFrontDeskTabHashSegment("appearance"), "optional-widget");
  assert.equal(context.window.VonzaDashboardLabels.getCustomerSourceLabel("full_page_assistant"), "Front Desk page");
  assert.equal(context.window.VonzaDashboardLabels.getCustomerSourceLabel("widget_chat"), "Website widget");
  assert.equal(context.window.VonzaDashboardLabels.getActionQueueStatusLabel("reviewed", ["new", "reviewed"]), "Reviewed");
  assert.equal(context.window.VonzaDashboardLabels.getFollowUpStatusLabel("missing_contact"), "Missing contact");
  assert.equal(typeof context.window.VonzaDashboardInstall.createInstallHelpers, "function");
  assert.equal(typeof context.window.VonzaDashboardFrontDesk.createFrontDeskHelpers, "function");
  assert.equal(context.window.VonzaDashboardAnalytics.getAnalyticsSourceLabel("page"), "Front Desk page");
  assert.equal(typeof context.window.VonzaDashboardCustomers.createCustomerHelpers, "function");
  assert.equal(context.window.VonzaDashboardCustomers.getCustomerSourceLabel("embedded_assistant"), "Embedded assistant");
  const customerHelpers = context.window.VonzaDashboardCustomers.createCustomerHelpers({
    getCustomerSourceLabel: context.window.VonzaDashboardLabels.getCustomerSourceLabel,
    isCapabilityVisibleForWorkspace: (capability) => capability === "automations",
    formatSeenAt: (value) => `seen:${value}`,
    getUiIconMarkup: () => "",
    formatAnalyticsReportNumber: (value) => String(value),
    formatDashboardCountLabel: (count, singular, plural) => `${count} ${Number(count) === 1 ? singular : plural}`,
    formatContactLifecycleLabel: (value) => value,
  });
  const guestContact = {
    id: "guest-1",
    name: "Anonymous visitor",
    partialIdentity: true,
    lifecycleState: "needs_review",
    flags: ["follow up due"],
    sources: [],
    latestMessageId: "message-1",
    chatMessages: [{ role: "customer", label: "Customer", content: "Can I get pricing?", createdAt: "2026-05-13T10:00:00.000Z" }],
    timeline: [{ label: "Visitor message", source: "chat", summary: "Asked about pricing." }],
  };
  const identifiedContact = {
    id: "identified-1",
    name: "Avery Hart",
    email: "avery@example.com",
    lifecycleState: "active_lead",
    flags: ["follow up due"],
    sources: ["widget_chat", "full_page_assistant", "embedded_assistant"],
    latestMessageId: "message-2",
    chatMessages: [{ role: "customer", label: "Customer", content: "Can you help?", createdAt: "2026-05-13T10:00:00.000Z" }],
  };
  assert.equal(customerHelpers.deriveCustomerReachability(guestContact).missingContactDetails, true);
  assert.equal(customerHelpers.deriveCustomerReachability(identifiedContact).replyPossible, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(customerHelpers.deriveCustomerStatusBadges(guestContact).map((badge) => badge.label).slice(0, 3))),
    ["Guest visitor", "Needs review", "Missing contact details"]
  );
  assert.equal(customerHelpers.getCustomerPrimaryAction(guestContact).label, "Review conversation");
  assert.notEqual(customerHelpers.getCustomerPrimaryAction(guestContact).label, "Follow-up");
  assert.equal(customerHelpers.getCustomerPrimaryAction(identifiedContact, { capabilities: {} }).label, "Review suggested reply");
  assert.match(customerHelpers.deriveCustomerReachability(guestContact).reason, /No contact details captured yet/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(["widget_chat", "full_page_assistant", "embedded_assistant", ""].map((source) => customerHelpers.getCustomerSourceLabel(source) || "Unknown source"))),
    ["Website widget", "Front Desk page", "Embedded assistant", "Unknown source"]
  );
  const rowMarkup = customerHelpers.renderCustomerRow(guestContact);
  assert.match(rowMarkup, /data-contact-id="guest-1"/);
  assert.match(rowMarkup, /data-contact-source-labels="Unknown source"/);
  assert.match(rowMarkup, /data-contact-missing-contact-details="true"/);
  const detailMarkup = customerHelpers.renderCustomerDetailPanel({}, identifiedContact, { capabilities: {} }, true);
  assert.match(detailMarkup, /data-customer-primary-action/);
  assert.match(detailMarkup, /Review suggested reply/);
  assert.doesNotMatch(detailMarkup, /Send AI draft/);
  assert.equal(context.window.VonzaDashboardFrontDesk.normalizeFrontDeskTab("answer-library"), "library");
  assert.equal(context.window.VonzaDashboardFrontDesk.normalizeFrontDeskTab("bad-tab"), "practice");
  assert.equal(context.window.VonzaDashboardFrontDesk.getFrontDeskTabLabel("launch"), "Launch");
  assert.equal(context.window.VonzaDashboardFrontDesk.formatTrainingItemSource({ sourceType: "conversation" }), "Conversation");
  assert.equal(context.window.VonzaDashboardFrontDesk.formatTrainingItemReason("missing-details"), "Missing details");
  assert.equal(
    context.window.VonzaDashboardFrontDesk.buildKnowledgeStatusSummary({
      agent: { websiteUrl: "https://example.com" },
      setup: { knowledgePageCount: 2, knowledgeReady: true },
      businessReadiness: { missingCount: 0 },
      profileContentSummary: "2 business profile areas filled: services, pricing.",
    }).customerImpact,
    "The Front Desk is ready to answer with solid business context."
  );
  const frontDeskHelpers = context.window.VonzaDashboardFrontDesk.createFrontDeskHelpers({
    getBadgeClass(value) {
      return `badge-${String(value).toLowerCase().replaceAll(" ", "-")}`;
    },
    formatSeenAt() {
      return "today";
    },
  });
  const queueMarkup = frontDeskHelpers.renderTrainingQueueItem({
    question: "Do you offer emergency visits?",
    reply: "Current answer",
    feedbackId: "feedback-1",
    feedbackReason: "too_vague",
    sourceType: "visitor_feedback",
    sourceRoute: "/assistant/demo?embedded=1",
    lastSeenAt: "2026-05-22T10:00:00Z",
  });
  assert.match(queueMarkup, /Do you offer emergency visits\?/);
  assert.match(queueMarkup, /Reason: Too vague/);
  assert.match(queueMarkup, /Assistant source: Embedded assistant/);
  assert.match(queueMarkup, /data-frontdesk-feedback-status="ignored"/);
  const approvedMarkup = frontDeskHelpers.renderApprovedAnswerCard({
    id: "answer-1",
    title: "Emergency visits",
    triggerText: "emergency visits",
    answerText: "Call us for urgent availability.",
    tags: ["urgent", "booking"],
    sourceType: "manual",
    updatedAt: "2026-05-22T10:00:00Z",
  });
  assert.match(approvedMarkup, /data-frontdesk-training-item="answer-1"/);
  assert.match(approvedMarkup, /Source: Owner/);
  assert.match(approvedMarkup, /data-frontdesk-edit-library-answer/);
  assert.match(approvedMarkup, /data-frontdesk-archive-approved-answer/);
  assert.match(approvedMarkup, /data-frontdesk-test-answer="emergency visits"/);
  assert.equal(context.window.VonzaDashboardInstall.getPublicPageKey({
    fullPageConfig: { publicPageKey: "page-key" },
  }), "page-key");
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

  assert.match(harness.getRootHtml(), /Preparing your workspace/i);
  assert.match(harness.getRootHtml(), /Connecting your assistant, loading your business data, and getting your front desk ready\./i);
  assert.match(harness.getRootHtml(), /Syncing customer conversations/i);
  assert.match(harness.getRootHtml(), /dashboard-skeleton-preview/i);
  assert.doesNotMatch(harness.getRootHtml(), /\b72%/);
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

test("dashboard hash routes open the matching interior section", async () => {
  const hashRoutes = [
    ["#today", /data-shell-target="overview"[\s\S]{0,260}aria-current="page"/],
    ["#customers", /data-shell-target="contacts"[\s\S]{0,260}aria-current="page"/],
    ["#front-desk", /data-shell-target="customize"[\s\S]{0,260}aria-current="page"/],
    ["#analytics", /data-shell-target="analytics"[\s\S]{0,260}aria-current="page"/],
    ["#install", /data-shell-target="install"[\s\S]{0,260}aria-current="page"/],
    ["#settings", /data-shell-target="settings"[\s\S]{0,260}aria-current="page"/],
  ];

  for (const [hash, expectedMarkup] of hashRoutes) {
    const harness = createDashboardHarness({
      hash,
      agents: () => [createActiveAgent()],
    });
    await harness.settle();

    assert.match(harness.getRootHtml(), expectedMarkup, `${hash} should render the expected dashboard section`);
  }
});

test("Hungarian dashboard shipped hash routes render localized primary labels", async () => {
  const hashRoutes = [
    ["#today", "overview", [/Kezdőlap/, /Mai AI ügyfélszolgálati áttekintés/]],
    ["#customers", "contacts", [/Ügyfelek/, /Minden ügyfél|Válaszra vár/]],
    ["#front-desk", "customize", [/Front Desk/, /Gyakorold azt a választ|Gyakorlás a Front Deskkel|Front Desk kipróbálása/]],
    ["#analytics", "analytics", [/Elemzések/, /Teljesítmény|Rögzített érdeklődők/]],
    ["#install", "install", [/Telepítés/, /Telepítés ellenőrzése|Kód megtekintése/]],
    ["#settings", "settings", [/Beállítások/, /Irányítópult nyelve/]],
  ];
  const obviousEnglishLabels = /Your AI customer service snapshot for today|Show customers needing help|Performance insights for your AI front desk|Verify installation|Dashboard language|Create Front Desk|Sign in/i;

  function getSectionHtml(html, sectionKey) {
    const marker = `data-shell-section="${sectionKey}"`;
    const start = html.indexOf(marker);
    if (start < 0) return html;
    const next = html.indexOf('data-shell-section="', start + marker.length);
    return html.slice(start, next > start ? next : undefined);
  }

  for (const [hash, sectionKey, expectedLabels] of hashRoutes) {
    const harness = createDashboardHarness({
      hash,
      agents: () => [createActiveAgent()],
      initialLocalStorage: {
        vonza_dashboard_language: "hu",
      },
    });
    await harness.settle();

    const html = harness.getRootHtml();
    const activeSectionHtml = getSectionHtml(html, sectionKey);
    expectedLabels.forEach((pattern) => {
      assert.match(html, pattern, `${hash} should render ${pattern}`);
    });
    assert.doesNotMatch(activeSectionHtml, obviousEnglishLabels, `${hash} should not leak obvious shipped English labels`);
  }
});

test("Install dashboard renders website platform guidance cards", async () => {
  const harness = createDashboardHarness({
    hash: "#install",
    agents: () => [createActiveAgent({
      installId: "install-1",
      fullPageConfig: {
        publicPageEnabled: true,
        publicPageKey: "page-key-1",
      },
    })],
  });
  await harness.settle();

  const html = harness.getRootHtml();
  assert.match(html, /Platform quick guides/);
  assert.match(html, /Install-only website guidance/);
  ["Generic HTML / smart embed", "WordPress / WooCommerce", "Wix", "Shopify", "Webflow", "Squarespace"].forEach((platform) => {
    assert.match(html, new RegExp(platform.replace(/\//g, "\\/")), `${platform} should render`);
  });
  assert.match(html, /data-install-platform="generic-html-smart-embed"/);
  assert.match(html, /data-install-platform="wordpress-woocommerce"/);
  assert.match(html, /data-install-platform="shopify"/);
  assert.match(html, /Use the hosted Front Desk page for the fastest launch/);
  assert.match(html, /Website widget bubble/);
  assert.match(html, /data-install-id=&quot;install-1&quot;|data-install-id="install-1"/);
  assert.match(html, /data-agent-id=&quot;agent-1&quot;|data-agent-id="agent-1"/);
  assert.match(html, /data-public-page-key=&quot;page-key-1&quot;|data-public-page-key="page-key-1"/);
  assert.doesNotMatch(html, /(?:Shopify|Wix|WooCommerce)[\s\S]{0,180}(?:API token|access token|secret key|consumer key|consumer secret|OAuth|marketplace)/i);
  assert.doesNotMatch(html, /<input[^>]+(?:shopify|wix|woocommerce)[^>]+(?:token|secret|api|key)/i);
});

test("Hungarian Install dashboard localizes platform guidance", async () => {
  const harness = createDashboardHarness({
    hash: "#install",
    agents: () => [createActiveAgent({
      installId: "install-1",
      fullPageConfig: {
        publicPageEnabled: true,
        publicPageKey: "page-key-1",
      },
    })],
    initialLocalStorage: {
      vonza_dashboard_language: "hu",
    },
  });
  await harness.settle();

  const html = harness.getRootHtml();
  const marker = 'data-shell-section="install"';
  const start = html.indexOf(marker);
  const next = html.indexOf('data-shell-section="', start + marker.length);
  const installHtml = html.slice(start, next > start ? next : undefined);
  assert.match(installHtml, /Platform gyors útmutatók/);
  assert.match(installHtml, /Csak telepítési weboldal útmutató/);
  assert.match(installHtml, /Általános HTML \/ okos beágyazás/);
  assert.match(installHtml, /Beillesztés vagy link/);
  assert.match(installHtml, /Hosztolt oldal vagy beágyazás/);
  assert.match(installHtml, /Korlát/);
  assert.match(installHtml, /Ez a telepítési lépés nem kapcsol WooCommerce termék- vagy rendelési adatokat/);
  assert.match(installHtml, /Ez a telepítési lépés nem kapcsol termékeket, kosarakat vagy rendeléseket/);
  assert.match(installHtml, /Egyes Wix területek korlátozhatják az egyéni kódot/);
  assert.doesNotMatch(installHtml, /Platform quick guides|Install-only website guidance|Start with the hosted AI Front Desk page|Paste or link|Hosted page vs embed|Limitation|Products, carts, and orders are not connected|Some Wix areas can restrict custom code/i);
});

test("Hungarian launch path copy localizes release-facing Install Front Desk and Settings strings", async () => {
  const routes = [
    {
      hash: "#install",
      marker: 'data-shell-section="install"',
      expected: [/Élesítési útvonalak sorrendje/, /Hosztolt Front Desk oldal/, /WordPress \/ okos beágyazás/, /Weboldali widget buborék/],
      englishLeak: /Launch path hierarchy|Fastest launch path|Website widget bubble|Copy website bubble code|Use this QR code/i,
    },
    {
      hash: "#front-desk/knowledge",
      marker: 'data-frontdesk-section="knowledge"',
      expected: [/Weboldali részletek/, /Üzleti profil áttekintése|Import újrapróbálása/],
      englishLeak: /Ground answers in the real website|Only saved website knowledge|Review business profile/i,
    },
    {
      hash: "#front-desk/launch",
      marker: 'data-frontdesk-section="launch"',
      expected: [/Publikus Front Desk oldal/, /QR \/ direkt link/, /Telepítés megnyitása|Gyakorolj először/],
      englishLeak: /A few essentials still need attention|Use Install for page takeover|Optional website widget|Why Install still lives separately/i,
    },
    {
      hash: "#front-desk/customization/full-page-assistant",
      marker: 'data-frontdesk-section="customization"',
      expected: [/Teljes oldalas asszisztens és hosztolt oldal/, /Tartalom/, /Dizájn/, /Elrendezés/, /A Front Desk oldalad/],
      englishLeak: /Full-page assistant and hosted page|Front Desk page customization sections|Your Front Desk page is disabled|Customize the primary Front Desk page/i,
    },
    {
      hash: "#front-desk/customization/voice",
      marker: 'data-frontdesk-section="customization"',
      expected: [/Tulajdonosi hang QA szimulátor/, /A hangtesztek AI-kapacitást használnak/, /Átirat előnézete/, /Használat Gyakorlásban/],
      englishLeak: /Owner voice QA simulator|Voice tests use AI capacity|Transcript preview|Use in Practice/i,
    },
    {
      hash: "#settings/business-profile",
      marker: 'data-settings-section="business_profile"',
      expected: [/Üzleti profil készenléte/, /Weboldali tudás/, /Weboldal mentése/],
      englishLeak: /Business Profile readiness|Set the website Vonza should learn from|Changing this website uses|Save website/i,
    },
  ];

  function getMarkedHtml(html, marker) {
    const start = html.indexOf(marker);
    const next = html.indexOf('data-shell-section="', start + marker.length);
    return start >= 0 ? html.slice(start, next > start ? next : undefined) : html;
  }

  for (const route of routes) {
    const harness = createDashboardHarness({
      hash: route.hash,
      agents: () => [createActiveAgent({
        installId: "install-1",
        fullPageConfig: {
          publicPageEnabled: true,
          publicPageKey: "page-key-1",
        },
        knowledge: {
          state: "limited",
          description: "Website import needs review.",
          importStatus: {
            state: "limited",
            label: "Website import",
            message: "Website import status will appear here.",
            retryable: true,
          },
        },
      })],
      initialLocalStorage: {
        vonza_dashboard_language: "hu",
      },
    });
    await harness.settle();

    const routeHtml = getMarkedHtml(harness.getRootHtml(), route.marker);
    const visibleRouteHtml = routeHtml.replace(/\b[\w:-]+="[^"]*"/g, "");
    route.expected.forEach((pattern) => {
      assert.match(visibleRouteHtml, pattern, `${route.hash} should render ${pattern}`);
    });
    assert.doesNotMatch(visibleRouteHtml, route.englishLeak, `${route.hash} should not leak release-facing English copy`);
  }
});

test("front desk nested hash routes open the matching tab", async () => {
  const tabRoutes = [
    ["#front-desk", "practice", "Practice"],
    ["#front-desk/practice", "practice", "Practice"],
    ["#front-desk/improvements", "improvements", "Improvements"],
    ["#front-desk/knowledge", "knowledge", "Knowledge"],
    ["#front-desk/answer-library", "library", "Answer library"],
    ["#front-desk/launch", "launch", "Launch"],
  ];

  for (const [hash, tabKey, label] of tabRoutes) {
    const harness = createDashboardHarness({
      hash,
      agents: () => [createActiveAgent()],
    });
    await harness.settle();

    const html = harness.getRootHtml();
    const tabSection = html.match(new RegExp(`<section[^>]+data-frontdesk-section="${tabKey}"[^>]*>`))?.[0] || "";
    assert.equal(harness.getGlobal("getActiveFrontDeskSection")(), tabKey, `${hash} should select ${label}`);
    assert.match(tabSection, /data-frontdesk-section=/, `${hash} should render ${label}`);
    assert.doesNotMatch(tabSection, /\bhidden\b/, `${hash} should show ${label}`);
  }
});

test("front desk and install tab clicks sync explicit nested hashes", async () => {
  const harness = createDashboardHarness({
    hash: "#front-desk/practice",
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  harness.getGlobal("setActiveFrontDeskSection")("knowledge", { syncHash: true });
  assert.equal(harness.getLocation().hash, "#front-desk/knowledge");

  harness.getGlobal("syncShellSectionHash")("install", { installMethod: "qr" });
  assert.equal(harness.getLocation().hash, "#install/qr");

  harness.getGlobal("syncShellSectionHash")("install", { installMethod: "widget" });
  assert.equal(harness.getLocation().hash, "#install/embed");

  const embedHarness = createDashboardHarness({
    hash: "#install/embed",
    agents: () => [createActiveAgent()],
  });
  await embedHarness.settle();
  assert.match(embedHarness.getRootHtml(), /class="install-option-card active" id="install-panel-widget"/);
});

test("legacy Settings Front Desk hash redirects to Front Desk customization content", async () => {
  const harness = createDashboardHarness({
    hash: "#settings/front-desk",
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  assert.equal(harness.getLocation().hash, "#front-desk/customization/identity-welcome");
  assert.match(harness.getRootHtml(), /data-shell-target="customize"[\s\S]{0,260}aria-current="page"/);
  assert.match(harness.getRootHtml(), /data-frontdesk-target="customization"[\s\S]{0,260}aria-pressed="true"/);
  assert.match(harness.getRootHtml(), /<h2 class="settings-shell-page-title">Front Desk<\/h2>/);
  assert.match(harness.getRootHtml(), /Front Desk purpose/);
  assert.match(harness.getRootHtml(), /Front Desk page/);
  assert.match(harness.getRootHtml(), /id="settings-front-desk-full-page"/);
  assert.match(harness.getRootHtml(), /placeholder="Front Desk"/);
  assert.match(harness.getRootHtml(), /Leave blank to show the default title, Front Desk\./);
  assert.match(harness.getRootHtml(), /data-full-page-settings-tab="design"/);
  assert.match(harness.getRootHtml(), /Preset/);
  assert.match(harness.getRootHtml(), /Dark Professional/);
  assert.match(harness.getRootHtml(), /Clean Light Abstract/);
  assert.match(harness.getRootHtml(), /Dark Gold Abstract/);
  assert.match(harness.getRootHtml(), /Bright Abstract Motion/);
  assert.match(harness.getRootHtml(), /Dark Abstract Motion/);
  assert.match(harness.getRootHtml(), /vonza_front_desk_bright_poster\.png/);
  assert.match(harness.getRootHtml(), /vonza_front_desk_dark_poster\.png/);
  assert.match(harness.getRootHtml(), /data-frontdesk-settings-tab="voice"/);
  assert.match(harness.getRootHtml(), /Enable voice input/);
  assert.match(harness.getRootHtml(), /Enable spoken replies/);
  assert.match(harness.getRootHtml(), /Auto-send transcript after speaking/);
  assert.match(harness.getRootHtml(), /Auto-play spoken replies/);
  assert.match(harness.getRootHtml(), /Voice style/);
  assert.match(harness.getRootHtml(), /Language behavior/);
  assert.match(harness.getRootHtml(), /Visitors can speak their question/);
  assert.match(harness.getRootHtml(), /Spoken replies are AI-generated on demand/);
  assert.match(harness.getRootHtml(), /Owner voice QA simulator/);
  assert.match(harness.getRootHtml(), /Record sample/);
  assert.match(harness.getRootHtml(), /Transcript preview/);
  assert.match(harness.getRootHtml(), /Use in Practice/);
  assert.match(harness.getRootHtml(), /data-voice-qa-panel/);
  assert.match(harness.getRootHtml(), /aria-live="polite"/);
  assert.match(harness.getRootHtml(), /name="full_page_background_source"/);
  assert.match(harness.getRootHtml(), /name="full_page_background_scope"/);
  assert.match(harness.getRootHtml(), /Assistant section \(recommended\)/);
  assert.match(harness.getRootHtml(), /Iframe only/);
  assert.match(harness.getRootHtml(), /name="full_page_background_preset"/);
  assert.match(harness.getRootHtml(), /name="full_page_background_image_file"/);
  assert.match(harness.getRootHtml(), /name="full_page_background_video_file"/);
  assert.match(harness.getRootHtml(), /data-full-page-background-control="image video"/);
  assert.match(harness.getRootHtml(), /data-full-page-background-control="video"/);
  assert.match(harness.getRootHtml(), /name="full_page_background_video_url"/);
  assert.match(harness.getRootHtml(), /data-full-page-design-preview/);
  assert.match(harness.getRootHtml(), /Type your question\.\.\./);
  assert.doesNotMatch(harness.getRootHtml(), /placeholder="How can we help\?"/);
  assert.doesNotMatch(harness.getRootHtml(), /<h2 class="settings-shell-page-title">Business profile<\/h2>/);
});

test("General settings tab does not show full-page assistant customization", async () => {
  const harness = createDashboardHarness({
    hash: "#settings/general",
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  const html = harness.getRootHtml();
  const settingsStart = html.indexOf('data-shell-section="settings"');
  const nextShell = html.indexOf('data-shell-section="', settingsStart + 1);
  const settingsHtml = settingsStart >= 0 ? html.slice(settingsStart, nextShell > settingsStart ? nextShell : undefined) : html;

  assert.match(html, /data-shell-target="settings"[\s\S]{0,260}aria-current="page"/);
  assert.match(settingsHtml, /Workspace status/);
  assert.doesNotMatch(settingsHtml, /id="settings-front-desk-full-page"/);
  assert.doesNotMatch(settingsHtml, /Action cards/);
});

test("dashboard Home renders the real-data V2 snapshot without command-center placeholders", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/action-queue") {
        return buildResponse({
          status: 200,
          body: {
            items: [],
            summary: {
              total: 0,
              attentionNeeded: 0,
            },
            humanFollowUps: {
              summary: {
                open: 0,
                highPriority: 0,
              },
              items: [],
              topItems: [],
              emptyState: "No customers need a human reply right now.",
            },
            ownerNotifications: {
              records: [],
              summary: {
                unread: 0,
              },
            },
            persistenceAvailable: true,
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  const html = harness.getRootHtml();

  assert.match(html, /Review replies/);
  assert.match(html, /View analytics/);
  assert.match(html, /Conversations today/);
  assert.match(html, /Leads captured/);
  assert.match(html, /Needs reply/);
  assert.match(html, /AI handled/);
  assert.match(html, /Today.?s priority/);
  assert.match(html, /not available yet/);
  assert.doesNotMatch(html, /data-target-id="knowledge-improvement"/);
  assert.doesNotMatch(html, /data-target-id="notifications"/);
});

test("Customers labels separate guest review from reachable follow-up", async () => {
  const now = "2026-05-21T09:00:00.000Z";
  const contacts = [
    {
      id: "guest-no-contact",
      customerRowKey: "guest-no-contact",
      name: "Anonymous visitor",
      partialIdentity: true,
      lifecycleState: "needs_review",
      sources: ["chat"],
      latestMessageId: "message-guest",
      latestSummary: "Asked for a quote without leaving contact details.",
      lastMessageAt: now,
      nextAction: {
        title: "Review open question",
        description: "Review the conversation before deciding whether more contact details are needed.",
      },
      timeline: [
        { at: now, label: "Visitor message", source: "chat", summary: "Asked for a quote without leaving contact details." },
      ],
    },
    {
      id: "identified-email",
      customerRowKey: "identified-email",
      name: "Mara Lane",
      email: "mara@example.test",
      lifecycleState: "needs_review",
      source: "page",
      latestMessageId: "message-identified",
      latestSummary: "Asked for pricing and wants an email reply.",
      lastMessageAt: now,
      timeline: [
        { at: now, label: "Front Desk page", source: "page", summary: "Pricing question needs owner review." },
      ],
    },
    {
      id: "active-chat",
      customerRowKey: "active-chat",
      name: "Anonymous visitor",
      partialIdentity: true,
      lifecycleState: "needs_reply",
      source: "widget",
      activeChat: true,
      latestMessageId: "message-active",
      latestSummary: "Waiting in the active chat.",
      lastMessageAt: now,
      nextAction: {
        title: "Reply now",
        description: "The visitor is still in the chat session.",
      },
      chatMessages: [
        { role: "customer", label: "Customer", content: "Are you available today?", createdAt: now },
      ],
      timeline: [
        { at: now, label: "Widget conversation", source: "chat", summary: "Active replyable chat." },
      ],
    },
  ];
  const harness = createDashboardHarness({
    hash: "#customers",
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 200,
          body: createOperatorWorkspaceWithContacts(contacts),
        });
      }

      return null;
    },
  });
  await harness.settle();

  const html = harness.getRootHtml();
  const guestRow = getContactRowHtml(html, "guest-no-contact");
  const identifiedRow = getContactRowHtml(html, "identified-email");
  const activeChatRow = getContactRowHtml(html, "active-chat");
  const guestDetail = getContactDetailHtml(html, "guest-no-contact");
  const identifiedDetail = getContactDetailHtml(html, "identified-email");

  assert.match(guestRow, /Guest visitor/);
  assert.match(guestRow, /Needs review/);
  assert.match(guestRow, /Missing contact details/);
  assert.match(guestRow, /data-contact-follow-up-possible="false"/);
  assert.doesNotMatch(guestRow, /Needs follow-up|Follow-up possible/);
  assert.match(guestRow, /Chat unavailable/);
  assert.match(guestRow, /Guest visitor only\. No contact details captured yet\./);

  assert.match(identifiedRow, /Identified/);
  assert.match(identifiedRow, /Needs follow-up/);
  assert.match(identifiedRow, /data-contact-follow-up-possible="true"/);
  assert.match(identifiedDetail, /Review conversation/);
  assert.doesNotMatch(identifiedDetail, /Review suggested reply/);
  assert.doesNotMatch(identifiedDetail, /Send AI draft/);

  assert.match(activeChatRow, /Needs reply/);
  assert.match(activeChatRow, /data-contact-reply-possible="true"/);
  assert.match(activeChatRow, />View chat<\/button>/);

  assert.match(guestDetail, /Review conversation/);
  assert.match(guestDetail, /Mark reviewed/);
  assert.doesNotMatch(guestDetail, /Review suggested reply|Follow up later|Send AI draft/);

  assert.match(html, /<span>Needs review<\/span>\s*<strong>\d+<\/strong>/);
  assert.match(html, /<span>Follow-up possible<\/span>\s*<strong>\d+<\/strong>/);
  assert.match(html, /<span>Website widget<\/span>\s*<strong>\d+<\/strong>/);
  assert.match(html, /<span>Front Desk page<\/span>\s*<strong>\d+<\/strong>/);
});

test("Home review actions route to Customers while analytics actions say analytics", async () => {
  const now = "2026-05-21T09:00:00.000Z";
  const contacts = [
    {
      id: "needs-review-contact",
      customerRowKey: "needs-review-contact",
      name: "Riley Price",
      email: "riley@example.test",
      lifecycleState: "needs_review",
      source: "widget",
      latestMessageId: "message-review",
      latestSummary: "Needs an owner reply.",
      lastMessageAt: now,
      nextAction: {
        title: "Prepare reply",
        description: "Prepare a direct owner reply.",
      },
      timeline: [
        { at: now, label: "Widget conversation", source: "chat", summary: "Needs an owner reply." },
      ],
    },
  ];
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 200,
          body: createOperatorWorkspaceWithContacts(contacts),
        });
      }

      return null;
    },
  });
  await harness.settle();

  const html = harness.getRootHtml();

  assert.match(html, /data-overview-target="contacts" data-contact-filter="needs_review"[\s\S]{0,600}Review replies/);
  assert.match(html, /data-overview-target="contacts" data-contact-filter="needs_review"[\s\S]{0,600}Review open needs/);
  assert.match(html, /data-overview-target="analytics"[\s\S]{0,600}View analytics/);
  assert.doesNotMatch(html, /data-overview-target="analytics"[\s\S]{0,80}>Review(?:\s|<)/);
});

test("access-locked checkout view renders Starter, Growth, and Pro plan choices", async () => {
  const harness = createDashboardHarness({
    agents: () => [createActiveAgent({ accessStatus: "pending" })],
    search: "?from=site&plan=pro",
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Simple monthly plans/);
  assert.match(harness.getRootHtml(), /Starter/);
  assert.match(harness.getRootHtml(), /Growth/);
  assert.match(harness.getRootHtml(), /Pro/);
  assert.match(harness.getRootHtml(), /Continue with Pro/);
  assert.doesNotMatch(harness.getRootHtml(), /token|api[- ]?spend|model cost/i);
});

test("workspace settings keep legal pages reachable from the logged-in app", async () => {
  const harness = createDashboardHarness({
    hash: "#settings/privacy-legal",
    agents: () => [createActiveAgent()],
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Privacy &amp; Legal|Privacy & Legal/);
  assert.match(harness.getRootHtml(), /public legal and privacy pages/);
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

test("signed-out auth shell honors Hungarian dashboard language across auth copy and controls", async () => {
  const harness = createDashboardHarness({
    session: null,
  });
  await harness.settle();

  harness.getGlobal("window").VonzaDashboardI18n = {
    normalizeLanguage(value) {
      return String(value || "").trim().toLowerCase() === "hu" ? "hu" : "en";
    },
  };
  harness.getGlobal("window").localStorage.setItem("vonza_dashboard_language", "hu");
  harness.getGlobal("applyDashboardLanguage")("hu");
  harness.getGlobal("renderAuthEntry")();

  const html = harness.getRootHtml();

  assert.match(html, /Hozd létre a Vonza fiókodat/);
  assert.match(html, /Fiók létrehozása/);
  assert.match(html, /Bejelentkezés/);
  assert.match(html, /Email cím/);
  assert.match(html, /Jelszó/);
  assert.match(html, /Jelszó megerősítése/);
  assert.match(html, /Használj inkább emailes linket/);
  assert.doesNotMatch(
    html,
    /Create your Vonza account|Create account|Sign in to continue into Vonza|Sign in|Email address|Password|Confirm password/
  );
});

test("one failed sub-request keeps the dashboard visible and surfaces an explicit warning", async () => {
  const harness = createDashboardHarness({
    hash: "#settings/account-billing",
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
  assert.match(harness.getRootHtml(), /Customers/);
  assert.match(harness.getRootHtml(), /Front Desk/);
  assert.match(harness.getRootHtml(), /Analytics/);
  assert.match(harness.getRootHtml(), /Your AI customer service snapshot for today/i);
  assert.match(harness.getRootHtml(), /Ready to use/i);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="inbox"/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="calendar"/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="automations"/);
  assert.equal(
    harness.fetchCalls.some((call) => call.pathname === "/agents/operator-workspace"),
    true
  );
});

test("workspace settings show current plan, usage progress, and upgrade actions", async () => {
  const harness = createDashboardHarness({
    hash: "#settings/account-billing",
    agents: () => [createActiveAgent()],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/agents/operator-workspace") {
        return buildResponse({
          status: 200,
          body: {
            billing: {
              planKey: "growth",
              displayName: "Growth",
              monthlyPriceLabel: "$50/month",
              currentPeriodStart: "2026-04-01T00:00:00.000Z",
              currentPeriodEnd: "2026-05-01T00:00:00.000Z",
              subscriptionStatus: "active",
              hasActiveSubscription: true,
              usage: {
                percentUsed: 82,
                tone: "warning",
                statusLabel: "Approaching the monthly capacity",
                ownerMessage:
                  "This workspace has used about 80% of its included monthly AI capacity. It is a good time to plan an upgrade if traffic is rising.",
                isCapped: false,
              },
              upgradeOptions: [
                {
                  planKey: "pro",
                  displayName: "Pro",
                  monthlyPriceLabel: "$100/month",
                  checkoutLabel: "Start with Pro",
                },
              ],
            },
          },
        });
      }

      return null;
    },
  });
  await harness.settle();

  assert.match(harness.getRootHtml(), /Billing and usage/);
  assert.match(harness.getRootHtml(), /Growth · \$50\/month/);
  assert.match(harness.getRootHtml(), /82% used/);
  assert.match(harness.getRootHtml(), /Approaching the monthly capacity/);
  assert.match(harness.getRootHtml(), /data-billing-plan-key="pro"/);
  assert.match(harness.getRootHtml(), /Subscription status: active\./);
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
  assert.match(harness.getRootHtml(), /Front Desk/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="calendar"/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="automations"/);
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
  assert.match(harness.getRootHtml(), /Front Desk/);
  assert.doesNotMatch(harness.getRootHtml(), /data-shell-target="calendar"/);
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
  assert.match(harness.getRootHtml(), /Conversations over time/i);
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
  assert.match(harness.getRootHtml(), /Conversations over time/);
});

test("dashboard website import starts async and polls to terminal success", async () => {
  const agent = createActiveAgent({ knowledge: { state: "limited", description: "Needs import.", pageCount: 0 } });
  const statuses = [
    {
      ok: true,
      agentId: "agent-1",
      websiteUrl: "https://example.com/",
      job: {
        id: "job-1",
        status: "running",
        phase: "crawling",
        pageCount: 0,
        contentLength: 0,
        stalled: false,
        indexing: { status: "not_started" },
      },
      knowledge: null,
    },
    {
      ok: true,
      agentId: "agent-1",
      websiteUrl: "https://example.com/",
      job: {
        id: "job-1",
        status: "success",
        phase: "success",
        pageCount: 3,
        contentLength: 900,
        stalled: false,
        indexing: { status: "indexed" },
      },
      knowledge: { pageCount: 3, contentLength: 900 },
    },
  ];
  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, buildResponse }) => {
      if (pathname === "/knowledge/import") {
        return buildResponse({
          status: 202,
          body: {
            ok: true,
            mode: "async",
            agentId: "agent-1",
            businessId: "business-1",
            websiteUrl: "https://example.com/",
            import: { jobId: "job-1", status: "queued", reused: false },
            statusUrl: "/api/agents/agent-1/knowledge/import/status?job_id=job-1&client_id=client-1",
          },
        });
      }
      if (pathname === "/api/agents/agent-1/knowledge/import/status") {
        return buildResponse({ status: 200, body: statuses.shift() || statuses.at(-1) });
      }
      return null;
    },
  });
  harness.getGlobal("window").VONZA_IMPORT_POLL_INTERVAL_MS = 0;

  const result = await harness.getGlobal("importKnowledge")(agent);
  await harness.settle();
  await harness.settle();

  const startCall = harness.fetchCalls.find((call) => call.pathname === "/knowledge/import");
  assert.equal(parseFetchJsonBody(startCall.options).async, true);
  assert.equal(result.pending, true);
  assert.match(result.importStatus.message, /queued/i);
  assert.ok(harness.fetchCalls.some((call) => call.pathname === "/api/agents/agent-1/knowledge/import/status"));
  assert.equal(harness.getGlobal("getKnowledgeImportDisplayState")("agent-1").state, "success");
});

test("dashboard async import limited and failed states stay owner-safe and retry with force", async () => {
  const agent = createActiveAgent();
  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, options, buildResponse }) => {
      if (pathname === "/knowledge/import") {
        const body = parseFetchJsonBody(options);
        return buildResponse({
          status: 202,
          body: {
            ok: true,
            mode: "async",
            agentId: "agent-1",
            businessId: "business-1",
            websiteUrl: "https://example.com/",
            import: { jobId: body.force ? "job-retry" : "job-limited", status: "queued", reused: false },
            statusUrl: `/api/agents/agent-1/knowledge/import/status?job_id=${body.force ? "job-retry" : "job-limited"}&client_id=client-1`,
          },
        });
      }
      if (pathname === "/api/agents/agent-1/knowledge/import/status") {
        return buildResponse({
          status: 200,
          body: {
            ok: true,
            agentId: "agent-1",
            websiteUrl: "https://example.com/",
            job: {
              id: "job-limited",
              status: "success",
              phase: "success",
              pageCount: 2,
              contentLength: 800,
              stalled: false,
              indexing: {
                status: "partial",
                message: "raw OpenAI sk-secret stack trace",
                errorCount: 1,
              },
            },
            knowledge: { pageCount: 2, contentLength: 800 },
          },
        });
      }
      return null;
    },
  });
  harness.getGlobal("window").VONZA_IMPORT_POLL_INTERVAL_MS = 0;

  await harness.getGlobal("importKnowledge")(agent);
  await harness.settle();
  const limitedState = harness.getGlobal("getKnowledgeImportDisplayState")("agent-1");

  assert.equal(limitedState.state, "limited");
  assert.match(limitedState.message, /semantic indexing/i);
  assert.doesNotMatch(JSON.stringify(limitedState), /sk-secret|stack trace|OpenAI/);

  await harness.getGlobal("importKnowledge")(agent, { force: true });
  const retryCall = harness.fetchCalls
    .filter((call) => call.pathname === "/knowledge/import")
    .at(-1);
  assert.equal(parseFetchJsonBody(retryCall.options).force, true);
});

test("dashboard ignores stale async import starts after a newer retry begins", async () => {
  const agent = createActiveAgent();
  const importStarts = [];
  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, options, url, buildResponse }) => {
      if (pathname === "/knowledge/import") {
        const body = parseFetchJsonBody(options);
        return new Promise((resolve) => {
          importStarts.push({
            body,
            resolve: () => resolve(buildResponse({
              status: 202,
              body: {
                ok: true,
                mode: "async",
                agentId: "agent-1",
                businessId: "business-1",
                websiteUrl: "https://example.com/",
                import: { jobId: body.force ? "job-new" : "job-old", status: "queued", reused: false },
                statusUrl: `/api/agents/agent-1/knowledge/import/status?job_id=${body.force ? "job-new" : "job-old"}&client_id=client-1`,
              },
            })),
          });
        });
      }

      if (pathname === "/api/agents/agent-1/knowledge/import/status") {
        const jobId = new URL(url).searchParams.get("job_id");
        return buildResponse({
          status: 200,
          body: {
            ok: true,
            agentId: "agent-1",
            websiteUrl: "https://example.com/",
            job: {
              id: jobId,
              status: "success",
              phase: "success",
              pageCount: 4,
              contentLength: 1200,
              stalled: false,
              indexing: { status: "indexed" },
            },
            knowledge: { pageCount: 4, contentLength: 1200 },
          },
        });
      }

      return null;
    },
  });
  harness.getGlobal("window").VONZA_IMPORT_POLL_INTERVAL_MS = 0;

  const firstImport = harness.getGlobal("importKnowledge")(agent);
  await harness.settle();
  const retryImport = harness.getGlobal("importKnowledge")(agent, { force: true });
  await harness.settle();

  assert.equal(importStarts.length, 2);
  importStarts[1].resolve();
  await retryImport;
  await harness.settle();

  importStarts[0].resolve();
  await firstImport;
  await harness.settle();

  assert.equal(harness.getGlobal("getKnowledgeImportDisplayState")("agent-1").jobId, "job-new");
  assert.ok(
    harness.fetchCalls.some((call) => call.pathname === "/api/agents/agent-1/knowledge/import/status" && call.url.includes("job_id=job-new"))
  );
  assert.ok(
    !harness.fetchCalls.some((call) => call.pathname === "/api/agents/agent-1/knowledge/import/status" && call.url.includes("job_id=job-old"))
  );
});

test("dashboard import falls back to sync when async start shape is unexpected", async () => {
  const agent = createActiveAgent();
  const harness = createDashboardHarness({
    agents: () => [agent],
    customFetch: async ({ pathname, options, buildResponse }) => {
      if (pathname !== "/knowledge/import") {
        return null;
      }

      const body = parseFetchJsonBody(options);
      if (body.async === true) {
        return buildResponse({ status: 200, body: { ok: true } });
      }

      return buildResponse({
        status: 200,
        body: {
          ok: true,
          content: "Useful imported website content for the Front Desk.",
          pageCount: 1,
        },
      });
    },
  });

  const result = await harness.getGlobal("importKnowledge")(agent);
  const importBodies = harness.fetchCalls
    .filter((call) => call.pathname === "/knowledge/import")
    .map((call) => parseFetchJsonBody(call.options));

  assert.equal(importBodies[0].async, true);
  assert.equal(Boolean(importBodies[1].async), false);
  assert.equal(result.knowledgeState, "ready");
  assert.equal(result.hadError, false);
});
