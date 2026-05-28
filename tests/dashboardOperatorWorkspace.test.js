import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createFakeElement(id) {
  const style = {
    setProperty(name, value) {
      this[name] = String(value);
    },
    getPropertyValue(name) {
      return this[name] || "";
    },
    removeProperty(name) {
      const previousValue = this[name] || "";
      delete this[name];
      return previousValue;
    },
  };

  return {
    id,
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    dataset: {},
    style,
    className: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    focus() {},
    reset() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    matches() {
      return false;
    },
  };
}

function createDashboardHarness({ windowFlags = {}, fetchImpl } = {}) {
  const i18nScript = readFileSync(path.join(repoRoot, "frontend", "i18n", "dashboardI18n.js"), "utf8");
  const settingsShellScript = readFileSync(path.join(repoRoot, "frontend", "settings", "SettingsShell.js"), "utf8");
  const dashboardStateScript = readFileSync(path.join(repoRoot, "frontend", "dashboardState.js"), "utf8");
  const dashboardLabelsScript = readFileSync(path.join(repoRoot, "frontend", "dashboardLabels.js"), "utf8");
  const dashboardInstallScript = readFileSync(path.join(repoRoot, "frontend", "dashboardInstall.js"), "utf8");
  const dashboardFrontDeskScript = readFileSync(path.join(repoRoot, "frontend", "dashboardFrontDesk.js"), "utf8");
  const dashboardCustomersScript = readFileSync(path.join(repoRoot, "frontend", "dashboardCustomers.js"), "utf8");
  const dashboardAnalyticsScript = readFileSync(path.join(repoRoot, "frontend", "dashboardAnalytics.js"), "utf8");
  const dashboardTodayScript = readFileSync(path.join(repoRoot, "frontend", "dashboardToday.js"), "utf8");
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8")
    .replace(/\nboot\(\)\.catch\(\(error\) => \{\n\s*handleFatalDashboardError\(error, "boot-unhandled"\);\n\}\);\s*$/, "\n")
    .replace(/\nboot\(\);\s*$/, "\n");
  const storage = new Map();
  const elements = new Map();
  const document = {
    body: createFakeElement("body"),
    documentElement: createFakeElement("documentElement"),
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createFakeElement(id));
      }
      return elements.get(id);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    ...windowFlags,
    document,
    location: {
      origin: "http://127.0.0.1:3000",
      href: "http://127.0.0.1:3000/dashboard",
      search: "",
      pathname: "/dashboard",
    },
    history: {
      replaceState() {},
      pushState() {},
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    sessionStorage: {
      getItem(key) {
        return storage.has(`session:${key}`) ? storage.get(`session:${key}`) : null;
      },
      setItem(key, value) {
        storage.set(`session:${key}`, String(value));
      },
      removeItem(key) {
        storage.delete(`session:${key}`);
      },
    },
    crypto: {
      randomUUID() {
        return "client-test-id";
      },
    },
    navigator: {
      clipboard: {
        async writeText() {},
      },
    },
    matchMedia() {
      return {
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      };
    },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  };
  const context = {
    window,
    document,
    console,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl || (async () => ({
      ok: true,
      async json() {
        return {};
      },
    })),
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(i18nScript, context, { filename: "frontend/i18n/dashboardI18n.js" });
  vm.runInNewContext(settingsShellScript, context, { filename: "frontend/settings/SettingsShell.js" });
  vm.runInNewContext(dashboardStateScript, context, { filename: "frontend/dashboardState.js" });
  vm.runInNewContext(dashboardLabelsScript, context, { filename: "frontend/dashboardLabels.js" });
  vm.runInNewContext(dashboardInstallScript, context, { filename: "frontend/dashboardInstall.js" });
  vm.runInNewContext(dashboardFrontDeskScript, context, { filename: "frontend/dashboardFrontDesk.js" });
  vm.runInNewContext(dashboardCustomersScript, context, { filename: "frontend/dashboardCustomers.js" });
  vm.runInNewContext(dashboardAnalyticsScript, context, { filename: "frontend/dashboardAnalytics.js" });
  vm.runInNewContext(dashboardTodayScript, context, { filename: "frontend/dashboardToday.js" });
  vm.runInNewContext(script, context, { filename: "frontend/dashboard.js" });
  return context;
}

function buildSettingsSection(harness, section, agent = {}, setup = {}, workspace = harness.createEmptyOperatorWorkspace()) {
  harness.window.location.hash = "";
  harness.window.localStorage.setItem("vonza_dashboard_settings_section", section);
  return harness.buildSettingsPanel(agent, setup, workspace);
}

function createDashboardUiStateAgent(overrides = {}) {
  return {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza Front Desk",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    publicAgentKey: "public-key",
    installId: "install-1",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "ready",
      description: "Knowledge ready.",
      pageCount: 2,
    },
    installStatus: {
      state: "installed_unseen",
      label: "Installed, waiting for first live visit",
      host: "example.com",
    },
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key",
    },
    accessStatus: "active",
    ...overrides,
  };
}

function createDashboardUiStateFetch(agent) {
  return async (url) => {
    const parsed = new URL(url);

    if (parsed.pathname === "/agents/install-status") {
      return {
        ok: true,
        async json() {
          return { agent };
        },
      };
    }

    if (parsed.pathname === "/agents/messages") {
      return {
        ok: true,
        async json() {
          return { messages: [] };
        },
      };
    }

    if (parsed.pathname === "/agents/front-desk/training-items") {
      return {
        ok: true,
        async json() {
          return { items: [] };
        },
      };
    }

    if (parsed.pathname === "/agents/action-queue") {
      return {
        ok: true,
        async json() {
          return {
            items: [],
            summary: { total: 0, attentionNeeded: 0 },
            analyticsSummary: {
              totalMessages: 0,
              visitorQuestions: 0,
              syncState: "ready",
            },
          };
        },
      };
    }

    if (parsed.pathname === "/agents/operator-workspace") {
      return {
        ok: true,
        async json() {
          return {
            enabled: true,
            featureEnabled: true,
            contacts: { list: [], summary: { totalContacts: 0 } },
          };
        },
      };
    }

    return {
      ok: true,
      async json() {
        return {};
      },
    };
  };
}

function getTagWithAttribute(html, attributeName, attributeValue) {
  const escapedValue = attributeValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<[^>]+${attributeName}="${escapedValue}"[^>]*>`);
  const match = html.match(pattern);
  return match ? match[0] : "";
}

function assertSettingsFrontDeskTabActive(html, tabKey) {
  const button = getTagWithAttribute(html, "data-frontdesk-settings-tab", tabKey);
  const panel = getTagWithAttribute(html, "data-frontdesk-settings-panel", tabKey);

  assert.match(button, /active/);
  assert.match(button, /aria-selected="true"/);
  assert.doesNotMatch(panel, /\shidden(?:\s|>|=)/);
}

function assertInstallMethodActive(html, panelKey) {
  const button = getTagWithAttribute(html, "data-install-method-tab", panelKey);
  const panel = getTagWithAttribute(html, "data-install-method-panel", panelKey);

  assert.match(button, /active/);
  assert.match(button, /aria-selected="true"/);
  assert.match(panel, /active/);
  assert.doesNotMatch(panel, /\shidden(?:\s|>|=)/);
}

test("dashboard flag resolver prefers the canonical browser flag and falls back safely", () => {
  const canonicalHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  assert.equal(canonicalHarness.isOperatorWorkspaceFlagEnabled(), true);

  const legacyHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
  });
  assert.equal(legacyHarness.isOperatorWorkspaceFlagEnabled(), true);

  const canonicalOffHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
  });
  assert.equal(canonicalOffHarness.isOperatorWorkspaceFlagEnabled(), false);
});

test("dashboard V2 shell renders behind the production flag without preview-only chrome", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_DASHBOARD_V2_ENABLED: true,
    },
  });
  const agent = {
    id: "agent-1",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    websiteUrl: "https://example.com",
    assistantName: "Example assistant",
    accessStatus: "active",
  };
  const setup = harness.inferSetup(agent);

  harness.renderAssistantShell(
    agent,
    [],
    setup,
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  const markup = harness.document.getElementById("dashboard-root").innerHTML;
  assert.match(markup, /dashboard-v2-shell/);
  assert.match(markup, /data-dashboard-v2="enabled"/);
  assert.match(markup, />Home</);
  assert.match(markup, />Customers</);
  assert.match(markup, />Front Desk</);
  assert.match(markup, />Analytics</);
  assert.match(markup, />Install</);
  assert.match(markup, />Settings</);
  assert.doesNotMatch(markup, /dashboard-help-fab/);
  assert.doesNotMatch(markup, /Ask Vonza/);
  assert.doesNotMatch(markup, /Growth Plan/);
  assert.doesNotMatch(markup, /\$50\/month/);
});

test("dashboard V2 Home uses real metrics, activity, readiness, and source empty states", () => {
  const harness = createDashboardHarness();
  const agent = {
    id: "agent-1",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    websiteUrl: "https://example.com",
    assistantName: "Example assistant",
    accessStatus: "active",
  };
  const setup = harness.inferSetup(agent);
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    conversionSummary: {
      ...harness.createEmptyActionQueue().conversionSummary,
      contactsCaptured: 3,
    },
    humanFollowUps: {
      ...harness.createEmptyActionQueue().humanFollowUps,
      summary: {
        ...harness.createEmptyActionQueue().humanFollowUps.summary,
        open: 2,
      },
    },
    analyticsSummary: {
      ...harness.createEmptyAnalyticsSummary(),
      contactsCaptured: 3,
      assistedOutcomes: 4,
    },
  };
  const operatorWorkspace = {
    ...harness.createEmptyOperatorWorkspace(),
    today: {
      ...harness.createEmptyOperatorWorkspace().today,
      messagesToday: 5,
      assistedOutcomes: 4,
    },
  };

  const markup = harness.buildOverviewPanel(
    agent,
    [
      { createdAt: "2026-05-13T09:00:00.000Z", role: "user", content: "Can I book a consult?" },
      { createdAt: "2026-05-13T09:01:00.000Z", role: "assistant", content: "Yes, here is the next step." },
    ],
    setup,
    actionQueue,
    operatorWorkspace
  );

  assert.match(markup, /Conversations today/);
  assert.match(markup, /Leads captured/);
  assert.match(markup, /Needs reply/);
  assert.match(markup, /AI handled/);
  assert.match(markup, /Recent activity/);
  assert.match(markup, /Can I book a consult\?/);
  assert.match(markup, /Front Desk readiness/);
  assert.match(markup, /Source activity/);
  assert.match(markup, /not available yet/);
  assert.doesNotMatch(markup, /Jessica Smith|Dylan Lee|Katherine Hall|Michael Miller|Sarah Brown|James Taylor|Lauren Martinez|David Carter/);

  const emptyMarkup = harness.buildOverviewPanel(
    agent,
    [],
    setup,
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assert.match(emptyMarkup, /not available yet/);
  assert.match(emptyMarkup, /Leads captured/);
  assert.match(emptyMarkup, /Source activity/);
});

test("Front Desk and Settings render async import progress and safe retry guidance", () => {
  const harness = createDashboardHarness();
  const agent = createDashboardUiStateAgent({
    knowledge: {
      state: "limited",
      description: "Website content is partial.",
      pageCount: 2,
    },
  });
  const setup = {
    ...harness.inferSetup(agent),
    importStatus: {
      state: "limited",
      label: "Partial indexing",
      message: "Website content is available for the Front Desk, but semantic indexing did not fully finish. Retry import to refresh indexing.",
      retryable: true,
      indexingMessage: "raw OpenAI sk-secret stack trace",
    },
  };
  const workspace = harness.createEmptyOperatorWorkspace();

  const frontDesk = harness.buildFrontDeskPanel(agent, setup, workspace);
  const settings = buildSettingsSection(harness, "business_profile", agent, setup, workspace);

  assert.match(frontDesk, /Partial indexing/);
  assert.match(frontDesk, /Retry website import/);
  assert.match(frontDesk, /full-page Front Desk knowledge/);
  assert.match(settings, /semantic indexing did not fully finish/);
  assert.match(settings, /data-import-force="true"/);
  assert.doesNotMatch(`${frontDesk}\n${settings}`, /sk-secret|stack trace|OpenAI/);
});

test("dashboard V2 Install keeps real widget, full-page assistant, QR, copy, and verification controls", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_PUBLIC_APP_URL: "https://app.example.com",
    },
  });
  const agent = {
    id: "agent-1",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    websiteUrl: "https://example.com",
    assistantName: "Example assistant",
    welcomeMessage: "Welcome",
    buttonLabel: "Chat",
    accessStatus: "active",
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key-1",
    },
  };
  const setup = harness.inferSetup(agent);
  const markup = harness.buildInstallPanel(
    agent,
    setup,
    harness.createEmptyOperatorWorkspace(),
    [],
    harness.createEmptyActionQueue()
  );

  assert.match(markup, /Website widget/);
  assert.match(markup, /data-action="copy-install"/);
  assert.match(markup, /data-action="verify-install"/);
  assert.match(markup, /https:\/\/app\.example\.com\/embed\.js/);
  assert.match(markup, /data-install-id=(?:"|&quot;)install-1(?:"|&quot;)/);
  assert.match(markup, /Front Desk page/);
  assert.match(markup, /https:\/\/app\.example\.com\/a\/public-agent-key/);
  assert.match(markup, /data-action="copy-full-page-url"/);
  assert.match(markup, /assistant-embed\.js/);
  assert.match(markup, /data-action="copy-section-assistant-smart-embed"/);
  assert.match(markup, /data-action="copy-full-page-assistant-smart-embed"/);
  assert.match(markup, /data-action="copy-full-page-iframe"/);
  assert.match(markup, /Recommended smart snippet/);
  assert.match(markup, /Advanced iframe snippet/);
  assert.match(markup, /QR code/);
  assert.match(markup, /data-full-page-qr-preview/);
  assert.match(markup, /data-action="download-full-page-qr"/);
  assert.doesNotMatch(markup, /Scan tracking|QR scans|scans today/i);
  assert.match(markup, /Launch readiness/);
  assert.match(markup, /Domain status/);
  assert.match(markup, /Launch shortcuts/);
  assert.doesNotMatch(markup, /Open Home/);
  assert.doesNotMatch(markup, /Open Analytics/);
  assert.doesNotMatch(markup, /Home already has conversations/);
  assert.doesNotMatch(markup, /weak-answer feedback/);
  assert.doesNotMatch(markup, /Setup checklist/);
  assert.doesNotMatch(markup, /First test conversation complete/);
  assert.doesNotMatch(markup, /cdn\.vonza\.com/);
});

test("dashboard sections keep section-specific content boundaries", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_PUBLIC_APP_URL: "https://app.example.com",
    },
  });
  const agent = {
    id: "agent-1",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    websiteUrl: "https://example.com",
    assistantName: "Example assistant",
    welcomeMessage: "Welcome",
    buttonLabel: "Chat",
    accessStatus: "active",
    installStatus: {
      state: "seen_recently",
      label: "Live install detected",
      host: "example.com",
      allowedDomains: ["example.com"],
      lastSeenAt: "2026-05-10T08:00:00.000Z",
    },
  };
  const setup = harness.inferSetup(agent);
  const workspace = harness.createEmptyOperatorWorkspace();
  const actionQueue = harness.createEmptyActionQueue();
  const home = harness.buildOverviewPanel(agent, [], setup, actionQueue, workspace);
  const customers = harness.buildContactsPanel(agent, workspace);
  const analytics = harness.buildAnalyticsPanel(agent, [], setup, actionQueue, workspace);
  const install = harness.buildInstallPanel(agent, setup, workspace, [], actionQueue);
  const settings = harness.buildSettingsPanel(agent, setup, workspace);

  assert.doesNotMatch(home, /install-script-output|full-page-assistant-iframe|download-full-page-qr|data-action="copy-install"/);
  assert.doesNotMatch(customers, /install-script-output|copy-install|download-full-page-qr|Verify installation/);
  assert.doesNotMatch(analytics, /install-script-output|copy-install|download-full-page-qr|Verify installation/);
  assert.doesNotMatch(install, /Open Home|Open Analytics|First test conversation complete|weak-answer feedback/);
  assert.doesNotMatch(settings, /Team access|Invite member|Integrations|No active billing plan data|data-privacy-export|Save privacy preference|install-script-output/);
});

test("dashboard V2 Analytics source cards render real widget, page, and legacy counts only", () => {
  const harness = createDashboardHarness();
  const agent = {
    id: "agent-1",
    publicAgentKey: "public-agent-key",
    installId: "install-1",
    accessStatus: "active",
  };
  const setup = harness.inferSetup(agent);
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    ownerAnalyticsDashboard: {
      ok: true,
      metrics: {
        totalConversations: 6,
        leadsCaptured: 3,
        conversionRate: 50,
      },
      assistantSource: {
        widget: {
          key: "widget",
          label: "Website widget",
          conversationCount: 2,
          messageCount: 5,
          visitorQuestionCount: 2,
          leadsCaptured: 1,
        },
        page: {
          key: "page",
          label: "Front Desk page",
          conversationCount: 3,
          messageCount: 7,
          visitorQuestionCount: 3,
          leadsCaptured: 2,
        },
        unknown: {
          key: "unknown",
          label: "Legacy/unknown",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        totalConversations: 6,
        totalMessages: 14,
      },
    },
  };
  const markup = harness.buildAnalyticsPanel(
    agent,
    [],
    setup,
    actionQueue,
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(markup, /Entry point \/ source breakdown/);
  assert.match(markup, /Website widget/);
  assert.match(markup, /Front Desk page/);
  assert.match(markup, /Legacy\/unknown/);
  assert.match(markup, /Performance by source/);
  assert.doesNotMatch(markup, /QR scans/);
  assert.doesNotMatch(markup, /QR code/);
  assert.doesNotMatch(markup, /QR scan analytics unavailable/);

  const emptyMarkup = harness.buildAnalyticsPanel(
    agent,
    [],
    setup,
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assert.match(emptyMarkup, /Front Desk page/);
  assert.doesNotMatch(emptyMarkup, /QR scans/);
  assert.doesNotMatch(emptyMarkup, /QR code/);
  assert.doesNotMatch(emptyMarkup, /QR scan analytics unavailable/);
  assert.doesNotMatch(emptyMarkup, /Legacy\/unknown/);
});

test("dashboard loading screen uses premium workspace preparation UI", () => {
  const html = readFileSync(path.join(repoRoot, "dashboard.html"), "utf8");
  const css = readFileSync(path.join(repoRoot, "frontend", "dashboard.css"), "utf8");
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(html, /dashboard-loading-screen/);
  assert.match(html, /Preparing your workspace/);
  assert.match(html, /Connecting your assistant, loading your business data, and getting your front desk ready\./);
  assert.match(html, /Loading business profile/);
  assert.match(html, /Syncing customer conversations/);
  assert.match(html, /Preparing dashboard/);
  assert.match(html, /dashboard-skeleton-preview/);
  assert.match(html, /This usually takes a few seconds/);
  assert.doesNotMatch(html, /\b72%/);
  assert.doesNotMatch(html, /approvals/i);

  assert.match(script, /Preparing your workspace/);
  assert.match(script, /Connecting your assistant, loading your business data, and getting your front desk ready\./);
  assert.match(script, /dashboard-loading-progress/);
  assert.match(script, /dashboard-skeleton-preview/);
  assert.doesNotMatch(script, /\b72%/);
  assert.doesNotMatch(script.match(/function renderLoadingState\(\)[\s\S]*?\n}/)?.[0] || "", /approvals/i);

  const loadingStyles = css.match(/\.dashboard-loading-screen\s*\{[\s\S]*?\n}/)?.[0] || "";
  assert.match(loadingStyles, /min-height:\s*min\(680px,\s*calc\(100vh - 150px\)\)/);
  assert.match(loadingStyles, /align-content:\s*center/);
  assert.match(loadingStyles, /justify-items:\s*center/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.dashboard-loading-steps\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.dashboard-skeleton-preview\s*\{[^}]*grid-template-columns:\s*150px minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(loadingStyles, /position:\s*absolute|top:\s*0|left:\s*0/i);
});

test("settings saves only show success after backend confirmation", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");
  const saveAssistantSource = script.match(/async function saveAssistant[\s\S]*?\n}\n\nasync function copyInstallCode/)?.[0] || "";
  const businessProfileParserSource = script.match(/function parseBusinessProfilePayload[\s\S]*?\n}/)?.[0] || "";
  const voiceConfigParserSource = script.match(/function parseVoiceConfigPayload[\s\S]*?\n}/)?.[0] || "";

  assert.match(saveAssistantSource, /saveData\?\.ok !== true \|\| !saveData\.profile/);
  assert.match(saveAssistantSource, /Business Profile was not confirmed by the server/);
  assert.match(saveAssistantSource, /updateData\?\.ok !== true \|\| !updateData\.agent/);
  assert.match(saveAssistantSource, /Front Desk changes were not confirmed by the server/);
  assert.match(saveAssistantSource, /Could not save Business Profile/);
  assert.match(saveAssistantSource, /Could not save changes/);
  assert.match(saveAssistantSource, /formData\.has\("web_call_enabled"\)/);
  assert.match(voiceConfigParserSource, /web_call_enabled:\s*formData\.has\("web_call_enabled"\)/);
  assert.doesNotMatch(businessProfileParserSource, /approvedContactChannels|approvalPreferences|approved_contact|approval_/);
});

test("dashboard theme and background preferences persist and render Settings controls", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  assert.equal(harness.getDashboardTheme(), "bright");
  assert.equal(harness.applyDashboardTheme(), "bright");
  assert.equal(harness.document.documentElement.dataset.dashboardAppearance, "bright");
  assert.equal(harness.document.documentElement.dataset.dashboardTheme, "bright");

  assert.equal(harness.saveDashboardTheme("dark"), "dark");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_theme"), "dark");
  assert.equal(harness.document.documentElement.dataset.dashboardAppearance, "dark");
  assert.equal(harness.document.documentElement.dataset.dashboardTheme, "dark");

  assert.equal(harness.saveDashboardTheme("system"), "system");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_theme"), "system");
  assert.equal(harness.document.documentElement.dataset.dashboardAppearance, "system");
  assert.equal(harness.document.documentElement.dataset.dashboardTheme, "bright");

  assert.equal(harness.getDashboardBackground(), "skyline-atrium");
  assert.equal(harness.applyDashboardBackground(), "skyline-atrium");
  assert.equal(harness.document.documentElement.dataset.dashboardBackground, "skyline-atrium");

  assert.equal(harness.saveDashboardBackground("midnight-suite"), "midnight-suite");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_background"), "midnight-suite");
  assert.equal(harness.document.documentElement.dataset.dashboardBackground, "midnight-suite");
  assert.equal(harness.document.body.dataset.dashboardBackground, "midnight-suite");

  assert.equal(harness.getDashboardBackgroundBlur(), 10);
  assert.equal(harness.applyDashboardBackgroundBlur(), 10);
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundBlur, "10");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--dashboard-background-blur"), "10px");

  assert.equal(harness.saveDashboardBackgroundBlur("18.4"), 18);
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_background_blur"), "18");
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundBlur, "18");
  assert.equal(harness.document.body.dataset.dashboardBackgroundBlur, "18");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--dashboard-background-blur"), "18px");

  assert.equal(harness.saveDashboardBackgroundBlur("99"), 24);
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_background_blur"), "24");
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundBlur, "24");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--dashboard-background-blur"), "24px");

  assert.equal(harness.getDashboardGlassTransparency(), 70);
  assert.equal(harness.applyDashboardGlassTransparency(), 70);
  assert.equal(harness.document.documentElement.dataset.dashboardGlassTransparency, "70");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-top-alpha"), "0.29");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-bottom-alpha"), "0.18");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-blur"), "30px");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-inner-shadow"), "0.13");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-sheen-alpha"), "0.14");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-glass-top-alpha"), "0.29");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-glass-bottom-alpha"), "0.18");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-glass-blur"), "30px");

  assert.equal(harness.saveDashboardGlassTransparency("100"), 100);
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-top-alpha"), "0.16");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-bottom-alpha"), "0.08");
  assert.equal(harness.document.documentElement.style.getPropertyValue("--vz-liquid-blur"), "34px");

  assert.equal(harness.saveDashboardGlassTransparency("82.2"), 82);
  assert.equal(harness.window.localStorage.getItem("vonza:glass-transparency"), "82");
  assert.equal(harness.document.documentElement.dataset.dashboardGlassTransparency, "82");
  assert.equal(harness.document.body.dataset.dashboardGlassTransparency, "82");

  assert.equal(harness.getDashboardBackgroundDim(), "balanced");
  assert.equal(harness.applyDashboardBackgroundDim(), "balanced");
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundDim, "balanced");

  assert.equal(harness.saveDashboardBackgroundDim("dim"), "dim");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_background_dim"), "dim");
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundDim, "dim");
  assert.equal(harness.document.body.dataset.dashboardBackgroundDim, "dim");

  assert.equal(harness.getDashboardAccentGlow(), "soft");
  assert.equal(harness.applyDashboardAccentGlow(), "soft");
  assert.equal(harness.document.documentElement.dataset.dashboardAccentGlow, "soft");

  assert.equal(harness.saveDashboardAccentGlow("vivid"), "vivid");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_accent_glow"), "vivid");
  assert.equal(harness.document.documentElement.dataset.dashboardAccentGlow, "vivid");
  assert.equal(harness.document.body.dataset.dashboardAccentGlow, "vivid");

  assert.equal(harness.getDashboardDensity(), "comfortable");
  assert.equal(harness.applyDashboardDensity(), "comfortable");
  assert.equal(harness.document.documentElement.dataset.dashboardDensity, "comfortable");

  assert.equal(harness.saveDashboardDensity("compact"), "compact");
  assert.equal(harness.window.localStorage.getItem("vonza_dashboard_density"), "compact");
  assert.equal(harness.document.documentElement.dataset.dashboardDensity, "compact");
  assert.equal(harness.document.body.dataset.dashboardDensity, "compact");

  const settingsPanel = harness.window.VonzaSettingsShell.buildSettingsPanel({
    agent: {},
    setup: {},
  });

  assert.match(settingsPanel, /Theme/);
  assert.match(settingsPanel, /data-dashboard-theme-choice/);
  assert.match(settingsPanel, /Bright Glass/);
  assert.match(settingsPanel, /Dark Glass/);
  assert.match(settingsPanel, /System/);
  assert.match(settingsPanel, /value="system"[\s\S]*checked/);
  assert.match(settingsPanel, /Dashboard background/);
  assert.match(settingsPanel, /data-dashboard-background-choice/);
  assert.match(settingsPanel, /Skyline Atrium/);
  assert.match(settingsPanel, /Midnight Suite/);
  assert.match(settingsPanel, /value="midnight-suite"[\s\S]*checked/);
  assert.match(settingsPanel, /Background blur/);
  assert.match(settingsPanel, /data-dashboard-background-blur-control/);
  assert.match(settingsPanel, /name="dashboard_background_blur"/);
  assert.match(settingsPanel, /min="0"/);
  assert.match(settingsPanel, /max="24"/);
  assert.match(settingsPanel, /value="24"/);
  assert.match(settingsPanel, /24px/);
  assert.match(settingsPanel, /Glass transparency/);
  assert.match(settingsPanel, /data-dashboard-glass-transparency-control/);
  assert.match(settingsPanel, /name="dashboard_glass_transparency"/);
  assert.match(settingsPanel, /value="82"/);
  assert.match(settingsPanel, /82%/);
  assert.match(settingsPanel, /Background dim/);
  assert.match(settingsPanel, /data-dashboard-background-dim-choice/);
  assert.match(settingsPanel, /name="dashboard_background_dim"/);
  assert.match(settingsPanel, /value="dim"[\s\S]*checked/);
  assert.match(settingsPanel, /Accent glow/);
  assert.match(settingsPanel, /data-dashboard-accent-glow-choice/);
  assert.match(settingsPanel, /name="dashboard_accent_glow"/);
  assert.match(settingsPanel, /value="vivid"[\s\S]*checked/);
  assert.match(settingsPanel, /Dashboard density/);
  assert.match(settingsPanel, /data-dashboard-density-choice/);
  assert.match(settingsPanel, /name="dashboard_density"/);
  assert.match(settingsPanel, /value="compact"[\s\S]*checked/);
  assert.match(settingsPanel, /Comfortable/);

  const dashboardHtml = readFileSync(path.join(repoRoot, "dashboard.html"), "utf8");
  assert.match(dashboardHtml, /vonza:glass-transparency/);
  assert.match(dashboardHtml, /dataset\.dashboardGlassTransparency/);
  assert.match(dashboardHtml, /vonza_dashboard_background_dim/);
  assert.match(dashboardHtml, /dataset\.dashboardBackgroundDim/);
  assert.match(dashboardHtml, /vonza_dashboard_accent_glow/);
  assert.match(dashboardHtml, /dataset\.dashboardAccentGlow/);
  assert.match(dashboardHtml, /vonza_dashboard_density/);
  assert.match(dashboardHtml, /dataset\.dashboardDensity/);
});

test("dashboard appearance preferences reject invalid stored values safely", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.window.localStorage.setItem("vonza:glass-transparency", "transparent");
  harness.window.localStorage.setItem("vonza_dashboard_background_dim", "blackout");
  harness.window.localStorage.setItem("vonza_dashboard_accent_glow", "neon");
  harness.window.localStorage.setItem("vonza_dashboard_density", "tiny");

  assert.equal(harness.getDashboardGlassTransparency(), 70);
  assert.equal(harness.getDashboardBackgroundDim(), "balanced");
  assert.equal(harness.getDashboardAccentGlow(), "soft");
  assert.equal(harness.getDashboardDensity(), "comfortable");

  assert.equal(harness.applyDashboardGlassTransparency(harness.getDashboardGlassTransparency()), 70);
  assert.equal(harness.applyDashboardBackgroundDim(harness.getDashboardBackgroundDim()), "balanced");
  assert.equal(harness.applyDashboardAccentGlow(harness.getDashboardAccentGlow()), "soft");
  assert.equal(harness.applyDashboardDensity(harness.getDashboardDensity()), "comfortable");

  assert.equal(harness.document.documentElement.dataset.dashboardGlassTransparency, "70");
  assert.equal(harness.document.documentElement.dataset.dashboardBackgroundDim, "balanced");
  assert.equal(harness.document.documentElement.dataset.dashboardAccentGlow, "soft");
  assert.equal(harness.document.documentElement.dataset.dashboardDensity, "comfortable");
});

test("first-time dashboard language chooser renders and translation fallback is safe", () => {
  const harness = createDashboardHarness();

  assert.equal(harness.t("nav.home"), "Home");
  assert.equal(harness.t("missing.translation.key"), "missing.translation.key");

  harness.renderDashboardLanguageChooser();
  const chooser = harness.document.getElementById("dashboard-root").innerHTML;

  assert.match(chooser, /Choose your dashboard language/);
  assert.match(chooser, /English/);
  assert.match(chooser, /Magyar/);
  assert.match(chooser, /Continue/);
});

test("Hungarian loading state stays fully Hungarian", () => {
  const harness = createDashboardHarness();
  harness.cacheDashboardLanguage("hu");

  harness.renderLoadingState();
  const loading = harness.document.getElementById("dashboard-root").innerHTML;

  assert.match(loading, /Előkészítjük a munkaterületedet/);
  assert.match(loading, /Csatlakoztatjuk az asszisztenst, betöltjük az üzleti adatokat, és előkészítjük a front desket\./);
  assert.match(loading, /Ez általában csak néhány másodperc/);
  assert.match(loading, /Ügyfélbeszélgetések szinkronizálása/);
  assert.doesNotMatch(loading, /Loading your workspace/);
  assert.doesNotMatch(loading, /Getting your customer service dashboard ready\./);
  assert.doesNotMatch(loading, /Syncing customer conversations/);
});

test("Hungarian dashboard language translates navigation, customer labels, settings, and analytics labels", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  harness.cacheDashboardLanguage("hu");

  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    installStatus: { state: "not_installed", label: "Not installed yet" },
  };
  const setup = harness.inferSetup({
    ...agent,
    websiteUrl: "https://example.com",
    publicAgentKey: "agent-key",
    welcomeMessage: "Hello",
    tone: "friendly",
    knowledge: { state: "ready" },
  });
  const workspace = harness.createEmptyOperatorWorkspace();
  workspace.contacts.list = [
    {
      id: "contact-guest",
      partialIdentity: true,
      sources: ["chat"],
      chatMessages: [],
    },
    {
      id: "contact-identified",
      name: "Alex Harper",
      email: "alex@example.com",
      lifecycleState: "active_lead",
      nextAction: {
        key: "schedule_call",
        title: "Schedule call",
        description: "A clear reply is still needed.",
      },
      sources: ["chat"],
      chatMessages: [
        { role: "customer", label: "Customer", content: "Hello", createdAt: "2026-04-03T09:00:00.000Z" },
        { role: "vonza", label: "Vonza", content: "Hi", createdAt: "2026-04-03T09:00:05.000Z" },
      ],
    },
    {
      id: "contact-no-chat",
      name: "Pat Minimal",
      email: "pat@example.com",
      nextAction: {
        title: "Review open question",
        description: "A reply is still needed.",
      },
      sources: ["chat"],
      chatMessages: [],
    },
  ];

  const sidebar = harness.buildSidebarShell(agent, setup, harness.createEmptyActionQueue(), workspace, "overview");
  const contacts = harness.buildContactsPanel(agent, workspace);
  const settings = harness.buildSettingsPanel(agent, setup, workspace);
  const analytics = harness.buildAnalyticsPanel(agent, [], setup, harness.createEmptyActionQueue(), workspace);
  const connectedTools = harness.buildConnectedToolsSettingsPanel(agent, workspace);

  assert.match(sidebar, /Kezdőlap/);
  assert.match(sidebar, /Ügyfelek/);
  assert.match(sidebar, /Elemzések/);
  assert.match(sidebar, /Beállítások/);
  assert.match(contacts, /Ügyfelek/);
  assert.match(contacts, /Utolsó üzenet/);
  assert.match(contacts, /Chat megnyitása/);
  assert.match(contacts, /Chat nem elérhető/);
  assert.match(contacts, /Vendég látogató/);
  assert.match(contacts, /Válaszra vár/);
  assert.match(contacts, /Érdeklődő/);
  assert.match(contacts, /Ügyfél/);
  assert.match(contacts, /Vonza/);
  assert.match(contacts, /Még nincs ügyfélüzenet/);
  assert.match(settings, /Irányítópult nyelve/);
  assert.match(analytics, /Beszélgetések időben/);
  assert.match(connectedTools, /Kapcsolt eszközök/);
  assert.match(connectedTools, /hamarosan/);
  assert.equal(harness.t("common.hideChat"), "Chat elrejtése");
});

const HUNGARIAN_DASHBOARD_ENGLISH_LEAKS = [
  "Business profile",
  "Setup status",
  "Core business facts",
  "Before you go live",
  "Open Home",
  "Open Analytics",
  "Needs reply",
  "No chat yet",
  "Review open needs",
  "Mostly healthy",
  "Improve service answers",
  "Move Vonza from preview into the live website",
  "Medium lost-customer risk",
  "Current day",
  "Home at a glance",
  "Approval-first proposals",
  "Messages today",
  "Guided customers",
  "Results today",
  "Why this recommendation",
  "Review context",
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNoHungarianDashboardEnglishLeaks(html, label) {
  for (const phrase of HUNGARIAN_DASHBOARD_ENGLISH_LEAKS) {
    assert.doesNotMatch(
      html,
      new RegExp(escapeRegExp(phrase)),
      `${label} still contains English dashboard UI phrase: ${phrase}`
    );
  }
}

function createHungarianCompletenessFixture(harness) {
  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    websiteUrl: "https://example.com",
    publicAgentKey: "agent-key",
    installId: "install-1",
    welcomeMessage: "Hello",
    tone: "friendly",
    purpose: "support",
    installStatus: {
      state: "not_installed",
      label: "Not installed yet",
      allowedDomains: [],
    },
  };
  const setup = harness.inferSetup({
    ...agent,
    knowledge: { state: "ready" },
  });
  const workspace = harness.createEmptyOperatorWorkspace();
  workspace.contacts.list = [
    {
      id: "contact-1",
      partialIdentity: true,
      sources: ["chat"],
      lifecycleState: "needs_reply",
      nextAction: {
        description: "This contact does not have a higher-priority owner next step right now.",
      },
      chatMessages: [],
      latestCustomerMessageSummary: "",
      timeline: [],
    },
  ];
  workspace.contacts.summary = {
    ...workspace.contacts.summary,
    contactsNeedingAttention: 1,
    leadsWithoutNextStep: 1,
  };
  workspace.today = {
    ...workspace.today,
    messagesToday: 25,
    contactsDealtToday: 22,
    needsAttentionCount: 1,
    contactsNeedingAttention: 1,
  };
  workspace.businessProfile.readiness = {
    completedSections: 1,
    totalSections: 4,
    missingCount: 3,
    summary: "Business profile readiness will appear here.",
  };

  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    items: [
      {
        key: "queue-1",
        type: "contact",
        actionType: "unanswered_question",
        status: "new",
        label: "Open customer question",
        whyFlagged: "A customer still needs a clear reply.",
      },
      {
        key: "queue-2",
        type: "knowledge_fix",
        actionType: "knowledge_fix",
        status: "new",
        weakAnswer: true,
        label: "Weak service answer",
        whyFlagged: "Improve service answers",
      },
    ],
    summary: {
      ...harness.createEmptyActionQueue().summary,
      total: 2,
      attentionNeeded: 2,
    },
    conversionSummary: {
      ...harness.createEmptyActionQueue().conversionSummary,
      highIntentConversations: 4,
      contactsCaptured: 1,
    },
    analyticsSummary: {
      ...harness.createEmptyActionQueue().analyticsSummary,
      conversationCount: 25,
      totalMessages: 50,
      visitorQuestions: 25,
      highIntentSignals: 4,
      contactsCaptured: 1,
      weakAnswerCount: 1,
      attentionNeeded: 2,
      customerQuestionSummaries: [
        { summary: "Árakat vagy árajánlat részleteit kéri", count: 2 },
      ],
    },
  };

  return { agent, setup, workspace, actionQueue };
}

test("Hungarian dashboard completeness covers Home, Customers, Front Desk, Analytics, Install, and Settings leak phrases", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });
  harness.cacheDashboardLanguage("hu");
  const { agent, setup, workspace, actionQueue } = createHungarianCompletenessFixture(harness);

  const pages = {
    Home: harness.buildOverviewPanel(
      agent,
      [
        { role: "user", content: "How much does setup cost?", createdAt: "2026-04-03T09:00:00.000Z" },
        { role: "assistant", content: "I am not sure.", createdAt: "2026-04-03T09:00:05.000Z" },
      ],
      setup,
      actionQueue,
      workspace
    ),
    Customers: harness.buildContactsPanel(agent, workspace),
    "Front Desk": harness.buildFrontDeskPanel(agent, setup, workspace),
    Analytics: harness.buildAnalyticsPanel(
      agent,
      [
        { role: "user", content: "How much does setup cost?", createdAt: "2026-04-03T09:00:00.000Z" },
        { role: "assistant", content: "I am not sure.", createdAt: "2026-04-03T09:00:05.000Z" },
      ],
      setup,
      actionQueue,
      workspace
    ),
    Install: harness.buildInstallPanel(agent, setup, workspace),
    Settings: harness.buildSettingsPanel(agent, setup, workspace),
  };

  for (const [label, html] of Object.entries(pages)) {
    assertNoHungarianDashboardEnglishLeaks(html, label);
  }

  assert.match(pages.Home, /Nyitott igények áttekintése|Szolgáltatásválaszok javítása/);
  assert.match(pages.Analytics, /Beszélgetések időben/);
  assert.match(pages.Install, /Telepítés|Telepítőkód másolása/);
  assert.match(pages.Settings, /Irányítópult nyelve/);
});

test("English dashboard still renders the supported dashboard UI in English", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  harness.cacheDashboardLanguage("en");
  const { agent, setup, workspace, actionQueue } = createHungarianCompletenessFixture(harness);
  const settings = harness.buildSettingsPanel(agent, setup, workspace);
  const install = harness.buildInstallPanel(agent, setup, workspace);
  const analytics = harness.buildAnalyticsPanel(agent, [], setup, actionQueue, workspace);

  assert.match(settings, /Workspace preferences/);
  assert.match(settings, /Dashboard language/);
  assert.match(install, /View Front Desk page setup/);
  assert.match(analytics, /Conversations over time/);
  assert.equal(harness.t("settings.title"), "Settings");
});

test("Hungarian supported dashboard keys do not fall back to key names or English for core screens", () => {
  const harness = createDashboardHarness();
  harness.cacheDashboardLanguage("hu");

  const expected = new Map([
    ["nav.home", "Kezdőlap"],
    ["nav.customers", "Ügyfelek"],
    ["nav.frontDesk", "Front Desk"],
    ["nav.analytics", "Elemzések"],
    ["nav.install", "Telepítés"],
    ["nav.settings", "Beállítások"],
    ["language.settingsTitle", "Irányítópult nyelve"],
    ["settings.theme", "Téma"],
    ["install.copyInstallCode", "Telepítőkód másolása"],
    ["customers.needsReply", "Válaszra vár"],
  ]);

  for (const [key, value] of expected.entries()) {
    assert.equal(harness.t(key), value);
    assert.notEqual(harness.t(key), key);
  }
});

test("Hungarian core dashboard screens surface missing translation keys through the shared registry", () => {
  const harness = createDashboardHarness();
  const hasTranslation = harness.window.VonzaDashboardI18n?.hasTranslation;

  assert.equal(typeof hasTranslation, "function");

  const requiredKeys = [
    "app.loading.title",
    "app.loading.copy",
    "nav.home",
    "nav.customers",
    "nav.frontDesk",
    "nav.analytics",
    "nav.install",
    "nav.settings",
    "home.title",
    "home.aiPriorities",
    "customers.title",
    "customers.needsReply",
    "analytics.title",
    "analytics.estimatedSatisfaction",
    "install.title",
    "install.copyInstallCode",
    "install.verifyInstallation",
    "settings.title",
    "settings.theme",
    "language.settingsTitle",
  ];

  for (const key of requiredKeys) {
    assert.equal(
      hasTranslation(key, "hu"),
      true,
      `Missing Hungarian dashboard translation key: ${key}`
    );
  }
});

test("dashboard language preference requests stay separate from widget reply language", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");
  const chatPrompt = readFileSync(path.join(repoRoot, "src", "services", "chat", "prompting.js"), "utf8");

  assert.match(dashboardScript, /vonza_dashboard_language/);
  assert.match(dashboardScript, /\/dashboard\/preferences/);
  assert.doesNotMatch(chatPrompt, /dashboard_language|vonza_dashboard_language/);
  assert.match(chatPrompt, /same language as the customer's latest message/);
});

test("home AI priorities translate raw signals into practical business recommendations", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "unanswered_question",
      title: "\"General business questions\" may be waiting too long",
    }).title,
    "Give open customer questions a clear next step"
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "knowledge_fix",
      summary: "Weak service explanation in a customer answer.",
    }).title,
    "Make service answers clearer"
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "pricing_gap",
      summary: "Pricing confusion without a clear quote next step.",
    }).title,
    "Clarify pricing guidance"
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "contact_next_step",
      summary: "Contact intent without a clear path.",
    }).title,
    "Make contacting you easier"
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "support_risk_review",
      summary: "Complaint frustration needs owner review.",
    }).title,
    "Improve complaint handling"
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "general_status",
      summary: "No strong customer friction signal.",
    }),
    null
  );
  assert.equal(
    harness.getBusinessPriorityCopy({
      type: "booking_intent",
      summary: "Booking and quote request path is unclear.",
    }).title,
    "Strengthen quote or booking guidance"
  );

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      recommendations: [
        {
          type: "unanswered_question",
          title: "\"General business questions\" may be waiting too long",
          summary: "Improve Vonza for a raw category.",
          priority: "high",
        },
        {
          type: "knowledge_fix",
          title: "Weak answer",
          summary: "A weak service explanation needs better knowledge.",
          priority: "medium",
        },
        {
          type: "pricing_gap",
          title: "Close pricing-follow-up gap",
          summary: "Pricing confusion without a clear next step.",
          priority: "high",
        },
        {
          type: "contact_next_step",
          title: "Fourth item should stay out of the three-card priority view.",
          summary: "Contact intent without a clear path.",
          priority: "high",
        },
      ],
    },
  });
  const overview = harness.buildOperatorOverviewSection({}, workspace);

  assert.match(overview, /What to improve next/);
  assert.match(overview, /These are the changes most likely to improve customer satisfaction and save time/);
  assert.match(overview, /Give open customer questions a clear next step/);
  assert.match(overview, /Make service answers clearer/);
  assert.match(overview, /Clarify pricing guidance/);
  assert.doesNotMatch(overview, /Make contacting you easier/);
  assert.doesNotMatch(overview, /General business questions/);
  assert.doesNotMatch(overview, /may be waiting too long/);
  assert.doesNotMatch(overview, /Improve Vonza/);

  const emptyState = harness.buildTodayRecommendationsSection(harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      recommendations: [],
    },
  }));
  assert.match(emptyState, /No urgent improvements right now/);
});

test("Hungarian operator home overview stays Hungarian for suggestions, context, and supporting detail", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });
  harness.cacheDashboardLanguage("hu");

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConnected: false,
      migrationRequired: false,
    },
    summary: {
      followUpsNeedingApproval: 1,
    },
    today: {
      campaignsAwaitingApproval: 2,
      highValueWithoutOutcome: 3,
      overdueHighValueContacts: 1,
      complaintRiskContacts: 2,
      campaignReplies: 4,
      campaignConversions: 1,
      contactsWithProgression: 5,
      lifecycleCounts: {
        customer: 2,
        qualified: 1,
        activeLead: 2,
      },
      recentSuccessfulOutcomes: [],
    },
    businessProfile: {
      readiness: {
        totalSections: 6,
        completedSections: 2,
        missingCount: 4,
        missingSections: ["Services", "Pricing", "Policies", "Operating hours"],
        summary: "2 of 6 business profile areas are filled. Missing: Services, Pricing, Policies, Operating hours.",
      },
      prefill: {
        available: true,
        fieldCount: 4,
        sourceSummary:
          "Suggestions are based on imported website knowledge plus current assistant contact settings. Nothing is saved until the owner reviews and submits.",
      },
    },
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      headline: "Vonza is ready.",
      summary: "Vonza is summarizing your current workspace only.",
      fallback: {
        title: "Vonza needs a little more context",
        description: "There is not enough live workspace data yet for strong recommendations.",
        guidance: [
          "Fill the business context foundation next: Services, Pricing, Policies, Operating hours.",
        ],
      },
      context: {
        warnings: [
          "messages is temporarily unavailable. The rest of the dashboard is still usable.",
        ],
        businessProfile: {
          readiness: {
            totalSections: 6,
            completedSections: 2,
            missingCount: 4,
            missingSections: ["Services", "Pricing", "Policies", "Operating hours"],
            summary: "2 of 6 business profile areas are filled. Missing: Services, Pricing, Policies, Operating hours.",
          },
        },
      },
      summaryCards: [],
      proposals: [],
      proposalSummary: {},
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);

  assert.doesNotMatch(overview, /Home suggestions/);
  assert.doesNotMatch(overview, /View-only summaries and draft suggestions/);
  assert.doesNotMatch(overview, /Vonza is ready\./);
  assert.doesNotMatch(overview, /View only/);
  assert.doesNotMatch(overview, /Review first/);
  assert.doesNotMatch(overview, /Daily Schedule/);
  assert.doesNotMatch(overview, /Appointments Needing Follow-up/);
  assert.doesNotMatch(overview, /Show supporting detail/);
  assert.doesNotMatch(overview, /temporarily unavailable/);
  assert.doesNotMatch(overview, /business profile areas are filled/);
  assert.doesNotMatch(overview, /Suggestions are based on imported website knowledge/);

  assert.match(overview, /Kezdőlap javaslatai/);
  assert.match(overview, /Csak megtekintés/);
  assert.match(overview, /Mai időbeosztás/);
  assert.match(overview, /Kiegészítő részletek megjelenítése/);
  assert.match(overview, /vállalkozási profil terület kitöltve/);
});

test("home overview AI priorities use business-facing wording and a calm empty state", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const setup = {
    isReady: true,
    knowledgeReady: true,
    knowledgeLimited: false,
  };
  const agent = {
    installStatus: {
      state: "seen_recently",
    },
  };
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    items: [
      {
        key: "queue-1",
        type: "contact",
        status: "new",
        label: "Open customer question",
        whyFlagged: "A customer still needs a clear reply.",
      },
    ],
    summary: {
      ...harness.createEmptyActionQueue().summary,
      attentionNeeded: 1,
    },
  };

  const panel = harness.buildOverviewPanel(
    agent,
    [
      { createdAt: "2026-04-04T08:00:00.000Z", role: "user", content: "What services do you offer?" },
      { createdAt: "2026-04-04T08:01:00.000Z", role: "assistant", content: "I do not have that information on the website." },
    ],
    setup,
    actionQueue,
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(panel, /Today&#39;s priority|Today's priority/);
  assert.match(panel, /Focused work that needs owner attention/);
  assert.match(panel, /Warm lead \/ booking intent/);
  assert.match(panel, /Open customer question/);
  assert.match(panel, /What to improve next/);
  assert.doesNotMatch(panel, /What matters most right now/);
  assert.doesNotMatch(panel, /may be waiting too long/);
  assert.doesNotMatch(panel, /Improve Vonza/);

  const emptyPanel = harness.buildOverviewPanel(
    agent,
    [],
    setup,
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assert.match(emptyPanel, /not available yet/);
});

test("dashboard normalizes sparse operator payloads without forcing the legacy shell", async () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          enabled: true,
          featureEnabled: true,
          status: {
            enabled: true,
            featureEnabled: true,
            googleConnected: false,
            migrationRequired: true,
          },
          connectedAccounts: null,
          contacts: {
            health: {
              migrationRequired: true,
            },
          },
        };
      },
    }),
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");

  assert.equal(workspace.enabled, true);
  assert.deepEqual(Array.from(workspace.connectedAccounts), []);
  assert.deepEqual(Array.from(workspace.inbox.threads), []);
  assert.deepEqual(Array.from(workspace.calendar.events), []);
  assert.deepEqual(Array.from(workspace.calendar.scheduleItems), []);
  assert.deepEqual(Array.from(workspace.calendar.reviewItems), []);
  assert.deepEqual(Array.from(workspace.calendar.followUpItems), []);
  assert.deepEqual(Array.from(workspace.calendar.unlinkedItems), []);
  assert.deepEqual(Array.from(workspace.automations.tasks), []);
  assert.deepEqual(Array.from(workspace.contacts.list), []);
  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "install", "settings"]
  );

  assert.match(harness.buildOperatorOverviewSection({}, workspace), /Home at a glance/);
  assert.match(harness.buildOperatorOverviewSection({}, workspace), /Show supporting detail/);
  assert.match(harness.buildInboxPanel({}, workspace), /Beta/);
  assert.doesNotMatch(harness.buildInboxPanel({}, workspace), /Connect Gmail/);
  assert.match(harness.buildCalendarPanel({}, workspace), /Beta/);
  assert.doesNotMatch(harness.buildCalendarPanel({}, workspace), /Connect Google/);
  assert.match(harness.buildAutomationsPanel({}, workspace), /Beta/);
  assert.doesNotMatch(harness.buildAutomationsPanel({}, workspace), /Connect Google/);
});

test("dashboard renders a simplified Today command page and read-only calendar mode", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConnected: true,
      googleConfigReady: true,
      googleCapabilities: {
        identity: true,
        calendarRead: true,
        calendarWrite: false,
        gmailRead: false,
      },
    },
    connectedAccounts: [
      {
        id: "account-1",
        status: "connected",
        accountEmail: "owner@example.com",
        capabilities: {
          identity: true,
          calendarRead: true,
          calendarWrite: false,
          gmailRead: false,
        },
      },
    ],
    calendar: {
      dailySummary: "1 upcoming event, 1 recent appointment needs follow-up, and 1 attendee still needs contact linking.",
      events: [
        {
          id: "event-1",
          title: "Morning estimate",
          startAt: "2026-04-05T09:00:00.000Z",
          endAt: "2026-04-05T09:30:00.000Z",
          status: "confirmed",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
        },
      ],
      scheduleItems: [
        {
          id: "event-1",
          title: "Morning estimate",
          startAt: "2026-04-05T09:00:00.000Z",
          endAt: "2026-04-05T09:30:00.000Z",
          status: "confirmed",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
          linkedContactId: "contact-1",
          linkedContactName: "Taylor Reed",
          actionTargetSection: "contacts",
          actionTargetId: "contact-1",
          actionLabel: "Open Contact",
        },
      ],
      followUpItems: [
        {
          id: "event-2",
          title: "Quote review",
          followUpReason: "The appointment ended recently and no follow-up, task, or non-booking outcome is visible yet.",
          actionTargetSection: "calendar",
          actionTargetId: "event-2",
          actionLabel: "Open Calendar",
        },
      ],
      unlinkedItems: [
        {
          id: "event-3",
          title: "Site visit",
          unlinkedReason: "Jordan Lane is not linked to a contact yet, so follow-up and outcome tracking can fragment.",
          actionTargetSection: "calendar",
          actionTargetId: "event-3",
          actionLabel: "Open Calendar",
        },
      ],
    },
    today: {
      upcomingBookings: 1,
      appointmentsNeedingFollowUp: 1,
      unlinkedAppointments: 1,
      openAvailabilityCount: 2,
      nextEventTitle: "Morning estimate",
    },
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "install", "settings"]
  );

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Home at a glance/);
  assert.match(overview, /Messages today/);
  assert.match(overview, /Approval-first proposals/);
  assert.match(overview, /What to improve next/);
  assert.match(overview, /Show supporting detail/);

  const calendarPanel = harness.buildCalendarPanel({}, workspace);
  assert.match(calendarPanel, /Beta/);
  assert.doesNotMatch(calendarPanel, /Run your first calendar sync/);
  assert.doesNotMatch(calendarPanel, /Connect Google/);
  assert.doesNotMatch(calendarPanel, /Create event draft/);
});

test("Home command center consolidates setup, priority workflows, and mobile-safe markup", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    summary: {
      ...harness.createEmptyActionQueue().summary,
      attentionNeeded: 2,
    },
    humanFollowUps: {
      ...harness.createEmptyActionQueue().humanFollowUps,
      summary: {
        open: 1,
        highPriority: 1,
      },
      topItems: [
        {
          customerLabel: "Taylor Reed",
          priority: "high",
          safeSummary: "Asked for a quote and still needs an owner reply.",
          recommendedNextAction: "Reply with the quote path and timing.",
          whyItMatters: [
            {
              label: "High-intent lead",
              copy: "This customer is close to booking and should not wait on AI alone.",
            },
          ],
        },
      ],
    },
    ownerAnalyticsDashboard: {
      ok: true,
      knowledgeImprovement: {
        openCount: 1,
      },
    },
    ownerNotifications: {
      summary: {
        unread: 1,
      },
      records: [],
    },
  };

  const overview = harness.buildOverviewPanel(
    {
      installId: "install-1",
      installStatus: { state: "not_installed", label: "Not installed yet" },
    },
    [],
    {
      isReady: false,
      knowledgeReady: false,
      knowledgeLimited: true,
    },
    actionQueue,
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(overview, /data-mobile-safe="true"/);
  assert.match(overview, /Today&#39;s priority|Today's priority/);
  assert.match(overview, /Taylor Reed needs a human reply/);
  assert.match(overview, /This customer is close to booking and should not wait on AI alone/);
  assert.doesNotMatch(overview, /data-target-id="human-follow-ups"/);
  assert.doesNotMatch(overview, /Knowledge Improvement/);
  assert.doesNotMatch(overview, /data-target-id="knowledge-improvement"/);
  assert.match(overview, /Review replies/);
  assert.match(overview, /View analytics/);
  assert.match(overview, /Front Desk readiness/);
  assert.match(overview, /Public Front Desk page/);
  assert.match(overview, /Distribution channel selected/);

  const sparseOverview = harness.buildOverviewPanel(
    { installId: "install-1", installStatus: { state: "seen_recently", label: "Seen recently" } },
    [],
    { isReady: true, knowledgeReady: true, knowledgeLimited: false },
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(sparseOverview, /not available yet/);
  assert.match(sparseOverview, /Today&#39;s priority|Today's priority/);
  assert.doesNotMatch(sparseOverview, /Notifications/);

  const css = readFileSync(path.join(repoRoot, "frontend", "dashboard.css"), "utf8");
  assert.match(css, /\.dashboard-v2-production-shell \.v2-home-two-col\s*\{\s*\n\s*display:\s*grid;/);
});

test("today copilot stays hidden when the browser flag is off", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: false,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      headline: "Copilot would be here",
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.doesNotMatch(overview, /Today Copilot/);
});

test("today copilot renders inside Today when the flag is on", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      headline: "1 thing needs attention today.",
      summary: "Vonza is summarizing stable-core data only.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "One pricing gap needs follow-up.",
          confidence: "high",
          rationale: "Grounded in the action queue.",
        },
      ],
      answers: [
        {
          question: "What needs attention today?",
          answer: "One pricing gap needs follow-up.",
          confidence: "high",
          rationale: "Grounded in the action queue.",
        },
      ],
      recommendations: [
        {
          title: "Close the pricing-follow-up gap",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          priority: "high",
          confidence: "medium",
          rationale: "Pricing intent is high-buying-intent.",
          targetSection: "contacts",
          targetId: "contact-1",
          surfaceLabel: "Open Customers",
        },
      ],
      drafts: [
        {
          title: "Draft follow-up for Taylor Reed",
          subject: "Vonza Plumbing: following up on pricing",
          body: "Hi Taylor,\n\nFollowing up on pricing.\n\nVonza Plumbing",
          channel: "email",
          confidence: "high",
          targetSection: "automations",
          targetId: "follow-up-1",
          surfaceLabel: "Open Automations",
        },
      ],
      proposals: [
        {
          key: "follow-up-draft:contact-1",
          type: "create_follow_up_draft",
          title: "Draft follow-up for Taylor Reed",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          whatHappens: "Create or refresh a real approval-first follow-up draft using the deterministic follow-up workflow service.",
          approvalNote: "This only prepares the draft. Nothing is sent automatically.",
          applyLabel: "Create draft",
          openLabel: "Open Automations",
          dismissLabel: "Dismiss",
          target: {
            section: "automations",
            id: "follow-up-1",
            label: "Open Automations",
          },
          state: "new",
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "All core business context areas are filled for Vonza.",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "All core business context areas are filled for Vonza.",
        missingCount: 0,
      },
      prefill: {
        available: true,
        fieldCount: 6,
        sourceSummary: "Suggestions are based on imported website knowledge plus current assistant contact settings.",
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Home at a glance/);
  assert.match(overview, /Approval-first proposals/);
  assert.match(overview, /What to improve next/);
  assert.match(overview, /Show supporting detail/);
  assert.match(overview, /Draft follow-up for Taylor Reed/);
  assert.match(overview, /Create draft/);
  const agent = {
    name: "Vonza",
    assistantName: "Vonza Front Desk",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    buttonLabel: "Chat",
    websiteUrl: "https://example.com",
    accessStatus: "active",
  };
  const setup = {
    knowledgeState: "missing",
    knowledgeDescription: "Add a real website to import knowledge.",
  };
  const general = buildSettingsSection(harness, "general", agent, setup, workspace);
  const frontDeskSettingsFallback = buildSettingsSection(harness, "front_desk", agent, setup, workspace);
  const frontDeskCustomization = harness.window.VonzaSettingsShell.buildFrontDeskSettingsForm({
    agent,
    setup,
    operatorWorkspace: workspace,
  });
  const businessProfile = buildSettingsSection(harness, "business_profile", agent, setup, workspace);
  const accountBilling = buildSettingsSection(harness, "account_billing", agent, setup, workspace);
  const privacyLegal = buildSettingsSection(harness, "privacy_legal", agent, setup, workspace);

  assert.match(general, /Workspace preferences/);
  assert.match(general, /data-dashboard-language-form/);
  assert.match(general, /data-dashboard-theme-choice/);
  assert.match(general, /data-dashboard-background-choice/);
  assert.match(general, /data-dashboard-background-blur-control/);
  assert.doesNotMatch(general, /<h2 class="settings-shell-page-title">Front Desk<\/h2>/);
  assert.doesNotMatch(general, /<h2 class="settings-shell-page-title">Business profile<\/h2>/);
  assert.doesNotMatch(general, /Front Desk purpose|business-summary|assistant-welcome|Website knowledge/);

  assert.match(frontDeskSettingsFallback, /Workspace preferences/);
  assert.doesNotMatch(frontDeskSettingsFallback, /<h2 class="settings-shell-page-title">Front Desk<\/h2>|Front Desk purpose/);

  assert.match(frontDeskCustomization, /<h2 class="settings-shell-page-title">Front Desk<\/h2>/);
  assert.match(frontDeskCustomization, /Front Desk purpose/);
  assert.match(frontDeskCustomization, /assistant-welcome/);
  assert.match(frontDeskCustomization, /assistant-tone/);
  assert.match(frontDeskCustomization, /settings-primary-color/);
  assert.match(frontDeskCustomization, /Enable Web Call Front Desk/);
  assert.match(frontDeskCustomization, /name="web_call_enabled"/);
  assert.match(frontDeskCustomization, /Web Call setup/);
  assert.match(frontDeskCustomization, /Voice input[\s\S]*Enable voice input first/);
  assert.match(frontDeskCustomization, /Spoken replies[\s\S]*Enable spoken replies next/);
  assert.match(frontDeskCustomization, /Web Call Front Desk[\s\S]*Enable Web Call Front Desk last/);
  assert.match(frontDeskCustomization, /Internet calling over the visitor's browser, not a phone number/);
  assert.match(frontDeskCustomization, /Open owner voice QA simulator/);
  const completeWebCallSettings = harness.window.VonzaSettingsShell.buildFrontDeskSettingsForm({
    agent: {
      ...agent,
      voiceConfig: {
        voiceInputEnabled: true,
        spokenRepliesEnabled: true,
        webCallEnabled: true,
      },
    },
    setup,
    operatorWorkspace: workspace,
  });
  assert.match(completeWebCallSettings, /data-web-call-readiness-badge[^>]*>Ready<\/span>/);
  assert.match(completeWebCallSettings, /Voice input[\s\S]*Ready for microphone recording/);
  assert.match(completeWebCallSettings, /Spoken replies[\s\S]*Ready to generate browser audio/);
  assert.match(completeWebCallSettings, /Web Call Front Desk[\s\S]*Ready on the hosted Front Desk page/);
  assert.match(frontDeskCustomization, /Current live readout/);
  assert.match(frontDeskCustomization, /data-settings-form data-form-kind="customize"/);
  assert.doesNotMatch(frontDeskCustomization, /business-summary|business-services|Save Business Profile|Website knowledge/);

  assert.match(businessProfile, /<h2 class="settings-shell-page-title">Business profile<\/h2>/);
  assert.match(businessProfile, /Website knowledge/);
  assert.match(businessProfile, /business-website-url/);
  assert.match(businessProfile, /business-summary/);
  assert.match(businessProfile, /business-services/);
  assert.match(businessProfile, /Save Business Profile/);
  assert.match(businessProfile, /data-form-kind="business-context"/);
  assert.match(businessProfile, /data-form-kind="customize"/);
  assert.doesNotMatch(businessProfile, /assistant-welcome|assistant-tone|Front Desk purpose|Launcher text/);

  assert.match(accountBilling, /<h2 class="settings-shell-page-title">Account &amp; Billing<\/h2>|<h2 class="settings-shell-page-title">Account & Billing<\/h2>/);
  assert.match(accountBilling, /Billing and usage/);
  assert.doesNotMatch(accountBilling, /Team access|Invite member|Integrations|Pro Plan|\$50\/month|View billing history/);

  assert.match(privacyLegal, /Privacy &amp; Legal|Privacy & Legal/);
  assert.match(privacyLegal, /ÁSZF|Impresszum|Adatkezelési tájékoztató|Cookie tájékoztató/);
  assert.doesNotMatch(privacyLegal, /business-summary|assistant-welcome|Billing and usage|Invite member|Integrations/);

  assert.match(general, /data-settings-nav="desktop"/);
  assert.doesNotMatch(`${general}${frontDeskCustomization}${businessProfile}${accountBilling}${privacyLegal}`, /Team management|Connected tools<\/h2>|data-settings-section="connected_tools"|Save privacy preference|data-privacy-export|install-script-output/);
});

test("today workspace render uses a dominant queue and support rail shell", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const operatorWorkspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    nextAction: {
      title: "Review ended appointment",
    },
    contacts: {
      list: [
        {
          id: "contact-1",
          displayName: "Taylor Reed",
          primaryEmail: "taylor@example.com",
        },
      ],
    },
    calendar: {
      reviewItems: [
        {
          id: "event-2",
          title: "Quote review",
          attendeeLabel: "Taylor Reed",
          linkedContactId: "contact-1",
          linkedContactName: "Taylor Reed",
          linkedContactEmail: "taylor@example.com",
          endAt: "2026-04-05T11:30:00.000Z",
          reviewReason: "Missing follow-up after the appointment ended.",
          reviewWhyItMatters: "Vonza wants a single explicit resolution before the appointment drops out of context.",
          appointmentReviewState: {},
        },
      ],
      scheduleItems: [
        {
          id: "event-1",
          title: "Morning estimate",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
        },
      ],
    },
    today: {
      recentSuccessfulOutcomes: [
        {
          outcomeType: "quote_requested",
          sourceLabel: "Follow-up",
          occurredAt: "2026-04-05T09:00:00.000Z",
        },
      ],
    },
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      headline: "Close the pricing follow-up gap first.",
      summary: "Vonza is summarizing stable-core data only.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "One pricing follow-up still needs owner review.",
        },
      ],
      proposals: [
        {
          key: "follow-up-draft:contact-1",
          type: "create_follow_up_draft",
          title: "Draft follow-up for Taylor Reed",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          whatHappens: "Create or refresh a real approval-first follow-up draft using the deterministic follow-up workflow service.",
          approvalNote: "This only prepares the draft. Nothing is sent automatically.",
          applyLabel: "Create draft",
          openLabel: "Open Automations",
          dismissLabel: "Dismiss",
          target: {
            section: "automations",
            id: "follow-up-1",
            label: "Open Automations",
          },
          state: "new",
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "All core business context areas are filled for Vonza.",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "All core business context areas are filled for Vonza.",
        missingCount: 0,
      },
      prefill: {
        available: true,
        fieldCount: 6,
        sourceSummary: "Suggestions are based on imported website knowledge plus current assistant contact settings.",
      },
    },
  });

  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    {
      isReady: true,
      knowledgeDescription: "Knowledge ready.",
    },
    {
      ...harness.createEmptyActionQueue(),
      items: [
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Review pricing follow-up",
          whyFlagged: "A quote request still needs owner review.",
          messageId: "message-1",
        },
      ],
      summary: {
        total: 1,
        attentionNeeded: 1,
      },
    },
    operatorWorkspace
  );

  assert.match(overviewPanel, /Home/);
  assert.match(overviewPanel, /Your AI customer service snapshot for today/);
  assert.match(overviewPanel, /Conversations today/);
  assert.match(overviewPanel, /Leads captured/);
  assert.match(overviewPanel, /Needs reply/);
  assert.match(overviewPanel, /AI handled/);
  assert.doesNotMatch(overviewPanel, /Customers helped today/);
  assert.match(overviewPanel, /Today&#39;s priority|Today's priority/);
  assert.match(overviewPanel, /Taylor Reed/);
  assert.match(overviewPanel, /Warm lead \/ booking intent|Follow-up due|Needs reply/);
  assert.match(overviewPanel, /A quote request still needs owner review/);
  assert.match(overviewPanel, /Review replies/);
  assert.match(overviewPanel, /satisfaction|confidence|trust|friction/i);
  assert.match(overviewPanel, /FAQ|pricing|contact|quote|booking|follow-up|next-step/i);
  assert.doesNotMatch(overviewPanel, /Vonza needs stronger support context/);
  assert.doesNotMatch(overviewPanel, /Finish the live launch/);
  assert.match(overviewPanel, /Recent activity/);
  assert.match(overviewPanel, /Front Desk readiness/);
  assert.match(overviewPanel, /Source activity/);
  assert.match(overviewPanel, /What to improve next/);
  assert.doesNotMatch(overviewPanel, /Today Copilot/);
  assert.doesNotMatch(overviewPanel, /today-side-column/);
  assert.doesNotMatch(overviewPanel, /Follow-up feed/);
  assert.doesNotMatch(overviewPanel, /Start next step/);
  assert.doesNotMatch(overviewPanel, /data-refresh-operator data-force-sync="true">Refresh/);
});

test("home attention list prioritizes customer needs with reasons and next actions", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    { isReady: true, knowledgeDescription: "Knowledge ready.", knowledgeReady: true },
    {
      ...harness.createEmptyActionQueue(),
      items: [
        {
          key: "support-1",
          type: "support",
          status: "new",
          label: "Morgan is frustrated",
          whyFlagged: "Customer sounded frustrated about a missed appointment.",
          suggestedAction: "Open the customer and prepare a recovery reply.",
          contactName: "Morgan Lee",
        },
        {
          key: "quote-1",
          type: "pricing",
          status: "new",
          label: "Quote request",
          whyFlagged: "A visitor asked for an estimate and has no outcome yet.",
          suggestedAction: "Confirm quote details and send the next step.",
          contactEmail: "lead@example.com",
        },
        {
          key: "knowledge-1",
          type: "weak_answer",
          status: "new",
          label: "Repeated service question",
          whyFlagged: "The same service area question came up twice.",
          suggestedAction: "Add a clearer FAQ answer.",
          knowledgeFix: {
            id: "fix-1",
            issueSummary: "Repeated service area question.",
          },
        },
      ],
      summary: {
        total: 3,
        attentionNeeded: 3,
      },
    },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
    })
  );

  assert.match(overviewPanel, /Unhappy or frustrated customer/);
  assert.match(overviewPanel, /Morgan Lee|Morgan is frustrated/);
  assert.match(overviewPanel, /Customer sounded frustrated about a missed appointment/);
  assert.match(overviewPanel, /Warm lead \/ booking intent/);
  assert.match(overviewPanel, /lead@example.com|Quote request/);
  assert.match(overviewPanel, /Unanswered or repeated question/);
  assert.match(overviewPanel, /Add a clearer FAQ answer/);
});

test("today overview dedupes repeated queue and review items by stable keys", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    {
      isReady: true,
      knowledgeDescription: "Knowledge ready.",
    },
    {
      ...harness.createEmptyActionQueue(),
      items: [
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Call with mail@example.com",
          whyFlagged: "A quote request still needs owner review.",
        },
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Call with mail@example.com",
          whyFlagged: "A quote request still needs owner review.",
        },
      ],
    },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      calendar: {
        reviewItems: [
          {
            id: "event-2",
            title: "Quote review",
            attendeeLabel: "Taylor Reed",
            reviewReason: "Missing follow-up after the appointment ended.",
          },
          {
            id: "event-2",
            title: "Quote review",
            attendeeLabel: "Taylor Reed",
            reviewReason: "Missing follow-up after the appointment ended.",
          },
        ],
      },
    })
  );

  assert.equal(overviewPanel.match(/A quote request still needs owner review/g)?.length || 0, 1);
  assert.equal(overviewPanel.match(/Missing follow-up after the appointment ended/g)?.length || 0, 1);
});

test("home review actions route to customers while analytics keeps analytics label", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    {
      isReady: true,
      knowledgeDescription: "Knowledge ready.",
      knowledgeReady: true,
      knowledgeLimited: false,
    },
    {
      ...harness.createEmptyActionQueue(),
      humanFollowUps: {
        ...harness.createEmptyActionQueue().humanFollowUps,
        summary: {
          ...harness.createEmptyActionQueue().humanFollowUps.summary,
          open: 1,
        },
        topItems: [
          {
            contactId: "contact-home-1",
            customerLabel: "Taylor Reed",
            priority: "high",
            safeSummary: "Taylor asked for pricing.",
            recommendedNextAction: "Review the conversation and prepare the reply.",
          },
        ],
      },
    },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        summary: {
          contactsNeedingAttention: 1,
        },
      },
    })
  );

  assert.match(overviewPanel, /Review replies/);
  assert.match(overviewPanel, /Review replies<\/button>/);
  assert.match(overviewPanel, /data-overview-target="contacts" data-contact-filter="needs_review"[\s\S]*Review replies/);
  assert.match(overviewPanel, /data-overview-target="analytics"[\s\S]*View analytics/);
  assert.match(overviewPanel, /data-overview-target="contacts"[\s\S]*data-contact-filter="needs_review"[\s\S]*Review/);
  assert.doesNotMatch(overviewPanel, /data-overview-target="analytics"[^>]*>[\s\S]{0,80}Review<\/button>/);
  assert.doesNotMatch(overviewPanel, /data-overview-target="analytics"[^>]*>[\s\S]{0,120}Review pricing questions<\/button>/);
});

test("today and contacts avoid dead automations CTAs when Google beta is hidden", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConfigReady: false,
      googleConnected: false,
    },
    contacts: {
      list: [
        {
          id: "contact-1",
          name: "Taylor Reed",
          email: "taylor@example.com",
          lifecycleState: "active_lead",
          nextAction: {
            followUpId: "follow-up-1",
          },
        },
      ],
      filters: {
        quick: [],
        sources: [],
      },
    },
  });

  const todayActions = harness.buildTodayReviewDrawerActions({
    key: "action-1",
    queueType: "action_queue",
    contactId: "contact-1",
    contactInfo: {
      name: "Taylor Reed",
      email: "taylor@example.com",
    },
    followUp: {
      id: "follow-up-1",
    },
  }, workspace);
  const contactActions = harness.buildContactQuickActions({
    id: "contact-1",
    name: "Taylor Reed",
    email: "taylor@example.com",
    lifecycleState: "active_lead",
    nextAction: {
      followUpId: "follow-up-1",
    },
  }, workspace);
  const contactsPanel = harness.buildContactsPanel({}, workspace);

  assert.doesNotMatch(todayActions, /data-open-follow-up/);
  assert.match(todayActions, /data-shell-target="analytics"/);
  assert.match(todayActions, /data-target-id="action-1"/);
  assert.doesNotMatch(contactActions, /data-open-follow-up/);
  assert.match(contactActions, /data-shell-target="contacts"/);
  assert.match(contactActions, /data-target-id="contact-1"/);
  assert.doesNotMatch(contactsPanel, />Draft follow-up</);
});

test("today contact CTAs carry the intended contact id", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConfigReady: false,
      googleConnected: false,
    },
  });

  const appointmentRow = harness.buildTodayQueueRow({
    id: "event-2",
    queueType: "appointment_review",
    linkedContactId: "contact-2",
    linkedContactName: "Morgan Hale",
    attendeeLabel: "Morgan Hale",
  }, "", workspace);
  const queueActions = harness.buildTodayReviewDrawerActions({
    key: "action-2",
    queueType: "action_queue",
    contactId: "contact-9",
    contactInfo: {
      name: "Jordan Rivers",
      email: "jordan@example.com",
    },
  }, workspace);

  assert.match(appointmentRow, /Open linked contact/);
  assert.match(appointmentRow, /data-target-id="contact-2"/);
  assert.match(queueActions, /Open customer/);
  assert.match(queueActions, /data-target-id="contact-9"/);
});

test("today knowledge-fix CTAs route to the actionable analytics workflow", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
  });

  const rowMarkup = harness.buildTodayQueueRow({
    key: "action-knowledge",
    queueType: "action_queue",
    type: "weak_answer",
    label: "Weak answer needs guidance",
    contactId: "contact-3",
    contactInfo: {
      name: "Casey Quinn",
    },
    knowledgeFix: {
      id: "fix-1",
    },
  }, "", workspace);
  const drawerMarkup = harness.buildTodayReviewDrawerActions({
    key: "action-knowledge",
    queueType: "action_queue",
    type: "weak_answer",
    contactId: "contact-3",
    contactInfo: {
      name: "Casey Quinn",
    },
    knowledgeFix: {
      id: "fix-1",
    },
  }, workspace);

  assert.match(rowMarkup, /Open guidance fix/);
  assert.match(rowMarkup, /data-shell-target="analytics"/);
  assert.match(rowMarkup, /data-target-id="action-knowledge"/);
  assert.doesNotMatch(rowMarkup, /data-settings-target="front_desk"/);
  assert.match(drawerMarkup, /Review fix/);
  assert.match(drawerMarkup, /data-shell-target="analytics"/);
  assert.match(drawerMarkup, /data-target-id="action-knowledge"/);
});

test("customers render as a polished workspace without inactive controls", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const contactsPanel = harness.buildContactsPanel(
    { manualOutcomeMode: false },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        list: [
          {
            id: "contact-1",
            name: "Taylor Reed",
            email: "taylor@example.com",
            lifecycleState: "active_lead",
            lastCustomerMessageAt: "2026-04-05T09:00:00.000Z",
            mostRecentActivityAt: "2026-04-05T09:00:00.000Z",
            latestCustomerMessageSummary: "Visitor asked for pricing.",
            chatMessages: [
              {
                label: "Customer",
                role: "customer",
                content: "Can you tell me the price?",
                createdAt: "2026-04-05T09:00:00.000Z",
              },
              {
                label: "Vonza",
                role: "vonza",
                content: "Pricing depends on the project.",
                createdAt: "2026-04-05T09:00:05.000Z",
              },
            ],
            nextAction: {
              title: "Draft follow-up",
              description: "Pricing question still needs a response.",
            },
            counts: {
              leads: 1,
              outcomes: 0,
            },
            timeline: [
              {
                at: "2026-04-05T09:00:00.000Z",
                label: "Lead captured",
                summary: "Visitor asked for pricing.",
              },
            ],
          },
        ],
      },
    })
  );

  assert.match(contactsPanel, /contacts-workspace/);
  assert.match(contactsPanel, />Customers</);
  assert.match(contactsPanel, /Track leads, guests, follow-ups, and recent conversations/);
  assert.match(contactsPanel, /New leads/);
  assert.match(contactsPanel, /Warm leads/);
  assert.match(contactsPanel, /Guests/);
  assert.match(contactsPanel, /Needs review/);
  assert.match(contactsPanel, /Follow-up possible/);
  assert.match(contactsPanel, /Missing contact details/);
  assert.match(contactsPanel, /Trend unavailable/);
  assert.match(contactsPanel, /Show customers needing review/);
  assert.match(contactsPanel, /data-contact-filter="identified"/);
  assert.match(contactsPanel, /data-contact-filter="guests"/);
  assert.match(contactsPanel, /data-contact-filter="needs_review"/);
  assert.match(contactsPanel, /data-contact-filter="needs_follow_up"/);
  assert.match(contactsPanel, /data-contact-filter="website_widget"/);
  assert.match(contactsPanel, /data-contact-filter="full_page_assistant"/);
  assert.doesNotMatch(contactsPanel, /Show filters/);
  assert.doesNotMatch(contactsPanel, /Export customers/);
  assert.match(contactsPanel, /data-contact-row/);
  assert.match(contactsPanel, /data-contact-detail/);
  assert.match(contactsPanel, /contacts-detail-shell/);
  assert.match(contactsPanel, /customer-status-chip/);
  assert.match(contactsPanel, /<strong class="contact-row-name">Taylor Reed<\/strong>/);
  assert.match(contactsPanel, /<p class="customer-row-identity">Email user · taylor@example\.com<\/p>/);
  assert.match(contactsPanel, /Visitor asked for pricing/);
  assert.match(contactsPanel, /Last message/);
  assert.match(contactsPanel, /What happened/);
  assert.match(contactsPanel, /Why it matters/);
  assert.match(contactsPanel, /Next action/);
  assert.match(contactsPanel, /View chat/);
  assert.match(contactsPanel, /data-customer-chat-panel/);
  assert.match(contactsPanel, />Customer</);
  assert.match(contactsPanel, />Vonza</);
  assert.doesNotMatch(contactsPanel, /Last active/);
  assert.doesNotMatch(contactsPanel, />Draft follow-up<\/button>\s*<details class="row-action-menu"/);
});

test("sidebar uses Customers as the replacement label for the contacts workspace", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const sidebar = harness.buildSidebarShell(
    {},
    { isReady: true, knowledgeReady: true, knowledgeLimited: false },
    { summary: { attentionNeeded: 0 } },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        summary: {
          contactsNeedingAttention: 2,
        },
      },
    }),
    "contacts"
  );

  assert.match(sidebar, /Customers/);
  assert.doesNotMatch(sidebar, />Contacts</);
});

test("shell copy normalizes outdated Outcomes labels to Analytics", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    nextAction: {
      title: "Open Outcomes",
      description: "Today, Customize, and Outcomes stay available while the website front desk continues to work.",
      targetSection: "analytics",
      targetId: "action-1",
    },
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      summaryCards: [],
      proposals: [
        {
          key: "analytics-proposal",
          title: "Review the queue",
          summary: "A queue item still needs attention.",
          openLabel: "Open Outcomes",
          applyLabel: "Apply",
          dismissLabel: "Dismiss",
          target: {
            section: "analytics",
            id: "action-1",
            label: "Open Outcomes",
          },
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "Ready",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "Ready",
        missingCount: 0,
      },
      prefill: {
        available: false,
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  const proposals = harness.buildCopilotProposalList(workspace.copilot, workspace);

  assert.equal(harness.normalizeShellCopy("Open Outcomes"), "Open Analytics");
  assert.match(overview, /Open Analytics/);
  assert.match(overview, /What to improve next/);
  assert.doesNotMatch(overview, /Open Outcomes/);
  assert.match(proposals, /Open Analytics/);
  assert.doesNotMatch(proposals, /Open Outcomes/);
});
test("front desk workspace uses focused sub-navigation and one dominant panel", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.setActiveFrontDeskSection("launch");

  const workspace = harness.normalizeOperatorWorkspace({
    businessProfile: {
      readiness: {
        summary: "Service areas and approvals are filled in, but pricing still needs owner review.",
        missingCount: 1,
      },
    },
  });

  const panel = harness.buildFrontDeskPanel(
    {
      publicAgentKey: "agent-key",
      buttonLabel: "Ask us",
      primaryCtaMode: "booking",
      websiteUrl: "https://acme.example",
      tone: "professional",
      systemPrompt: "Keep replies concise and route bookings quickly.",
      installId: "install-123",
    },
    {
      personalityReady: true,
      knowledgeReady: false,
      knowledgeLimited: true,
      knowledgeState: "limited",
      knowledgeDescription: "Website knowledge is usable, but still needs another review pass before launch.",
      knowledgePageCount: 5,
      isReady: false,
    },
    workspace
  );

  assert.match(panel, /Practice, teach, and publish the answers customers see/);
  assert.match(panel, /<span>Practice<\/span>/);
  assert.match(panel, /<span>Improvements<\/span>/);
  assert.match(panel, /<span>Knowledge<\/span>/);
  assert.match(panel, /<span>Answer library<\/span>/);
  assert.match(panel, /<span>Launch<\/span>/);
  assert.match(panel, /<span>Customization<\/span>/);
  assert.match(panel, /Open customization/);
  assert.match(panel, /Practice the answer customers will see/);
  assert.match(panel, /Next action/);
  assert.match(panel, /Prepare the hosted Front Desk page/);
  assert.match(panel, /Ask a question as if you were a visitor/);
  assert.match(panel, /Practice mode — visitors will not see this conversation/);
  assert.match(panel, /Draft improvements/);
  assert.match(panel, /Feedback needing review/);
  assert.match(panel, /Recently published improvements/);
  assert.match(panel, /Published answers Front Desk can use when visitors ask similar questions/);
  assert.match(panel, /Open install/);
  assert.match(panel, /Optional website bubble/);
  assert.match(panel, /Front Desk page link/);
  assert.match(panel, /QR code/);
  assert.match(panel, /distribution channels and verification/);
  assert.doesNotMatch(panel, /display_mode/);
  assert.doesNotMatch(panel, /primaryCtaMode/);
  assert.match(panel, /frontdesk-polished-panel frontdesk-practice-panel/);
  assert.match(panel, /frontdesk-polished-panel frontdesk-improvements-panel/);
  assert.match(panel, /frontdesk-polished-panel frontdesk-context-panel/);
  assert.match(panel, /data-frontdesk-section="library"/);
  assert.match(panel, /data-frontdesk-section="improvements"/);
  assert.match(panel, /data-frontdesk-section="practice"/);
  assert.match(panel, /class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel" data-frontdesk-section="launch"/);
  assert.match(panel, /data-frontdesk-section="launch"/);
  assert.match(panel, /frontdesk-main-panel/);
  assert.doesNotMatch(panel, /settings-summary-grid/);
  assert.doesNotMatch(panel, /frontdesk-context-grid/);
  assert.doesNotMatch(panel, /Approved answers|Training queue|Test Front Desk/);
});

test("bare front desk hash opens Practice even after another tab was persisted", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.window.localStorage.setItem("vonza_dashboard_frontdesk_section", "knowledge");
  harness.window.sessionStorage.setItem("vonza_dashboard_ui_state", JSON.stringify({ frontDeskTab: "knowledge" }));
  harness.window.location.hash = "#front-desk";

  assert.equal(harness.getActiveFrontDeskSection(), "practice");
});

test("front desk improvements render feedback metadata with owner-friendly labels", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const markup = harness.buildImprovementsSection(harness.createEmptyFrontDeskTraining(), {
    items: [
      {
        key: "feedback:feedback-1",
        type: "knowledge_gap",
        actionType: "knowledge_gap",
        question: "Do you offer Saturday appointments?",
        reply: "Please contact the business.",
        whyFlagged: "Flagged because visitor feedback marked this answer not helpful.",
        feedbackId: "feedback-1",
        feedbackReason: "missing_details",
        feedbackNote: "Visitor needed the Saturday cutoff.",
        source: "visitor_feedback",
        displayMode: "widget",
        sourceRoute: "public_widget",
        lastSeenAt: "2026-05-20T10:00:00.000Z",
      },
    ],
  }, "improvements");

  assert.match(markup, /Do you offer Saturday appointments\?/);
  assert.match(markup, /Please contact the business\./);
  assert.match(markup, /Needs review/);
  assert.match(markup, /Reason: Missing details/);
  assert.match(markup, /Note: Visitor needed the Saturday cutoff\./);
  assert.match(markup, /Assistant source: Website widget/);
  assert.match(markup, />Open in practice<\/button>/);
  assert.match(markup, />Improve answer<\/button>/);
  assert.match(markup, />Ignore<\/button>/);
  assert.doesNotMatch(markup, /display_mode|sourceRoute|public_widget/);
});

test("front desk improvements hide empty notes and maps page and embedded sources", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const noNoteMarkup = harness.buildImprovementsSection(harness.createEmptyFrontDeskTraining(), {
    items: [
      {
        key: "feedback:feedback-2",
        type: "knowledge_gap",
        actionType: "knowledge_gap",
        question: "Where are you located?",
        reply: "Please contact the business.",
        whyFlagged: "Flagged because visitor feedback marked this answer not helpful.",
        feedbackId: "feedback-2",
        feedbackReason: "incorrect",
        displayMode: "page",
        sourceRoute: "/assistant/agent-key",
      },
    ],
  }, "improvements");
  const embeddedMarkup = harness.buildImprovementsSection(harness.createEmptyFrontDeskTraining(), {
    items: [
      {
        key: "feedback:feedback-3",
        type: "knowledge_gap",
        actionType: "knowledge_gap",
        question: "Can I book online?",
        reply: "Please contact the business.",
        whyFlagged: "Flagged because visitor feedback marked this answer not helpful.",
        feedbackId: "feedback-3",
        feedbackReason: "did_not_answer",
        displayMode: "page",
        sourceRoute: "/a/agent-key?embedded=1",
      },
    ],
  }, "improvements");

  assert.match(noNoteMarkup, /Reason: Incorrect/);
  assert.match(noNoteMarkup, /Assistant source: Front Desk page/);
  assert.doesNotMatch(noNoteMarkup, /Note:/);
  assert.doesNotMatch(noNoteMarkup, /\/assistant\/agent-key|displayMode|sourceRoute/);
  assert.match(embeddedMarkup, /Reason: Did not answer/);
  assert.match(embeddedMarkup, /Assistant source: Embedded assistant/);
  assert.doesNotMatch(embeddedMarkup, /embedded=1|displayMode|sourceRoute/);
});

test("front desk practice and launch CTAs use primary treatment", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const agent = {
    publicAgentKey: "agent-key",
    installId: "install-123",
    websiteUrl: "https://acme.example",
  };
  const setup = {
    personalityReady: true,
    knowledgeReady: true,
    knowledgeLimited: false,
    knowledgeState: "ready",
    knowledgeDescription: "Website knowledge is ready.",
    isReady: true,
  };
  const workspace = harness.normalizeOperatorWorkspace({});

  harness.setActiveFrontDeskSection("practice");
  const practicePanel = harness.buildFrontDeskPanel(agent, setup, workspace);
  assert.match(practicePanel, /data-frontdesk-practice-form/);
  assert.match(practicePanel, /<button class="primary-button" type="submit">Send<\/button>/);

  harness.setActiveFrontDeskSection("launch");
  const launchPanel = harness.buildFrontDeskPanel(agent, setup, workspace);
  assert.match(launchPanel, /<button class="primary-button"[^>]*>Open install<\/button>/);
});

test("front desk practice section renders a clean owner-only conversation without fake customer data", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.setActiveFrontDeskSection("practice");
  const panel = harness.buildFrontDeskPanel(
    {
      name: "Acme Services",
      websiteUrl: "https://acme.example",
    },
    {
      personalityReady: true,
      knowledgeReady: true,
      knowledgeLimited: false,
      knowledgeState: "ready",
      knowledgeDescription: "Website knowledge is ready.",
      isReady: true,
    },
    harness.normalizeOperatorWorkspace({})
  );

  assert.match(panel, /Practice the answer customers will see/);
  assert.match(panel, /Practice mode — visitors will not see this conversation/);
  assert.match(panel, /data-frontdesk-practice-form/);
  assert.doesNotMatch(panel, /<iframe/);
  assert.doesNotMatch(panel, /Customer:|Assistant:/);
});

test("analytics weak-answer areas use actionable summaries instead of raw questions", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const rawQuestion = "Can you send the exact custom enterprise pricing for three locations?";
  const panel = harness.buildAnalyticsPanel(
    {},
    [
      { id: "m1", role: "user", content: rawQuestion, createdAt: "2026-04-14T09:03:55.000Z" },
      { id: "m2", role: "assistant", content: "I'm not sure.", createdAt: "2026-04-14T09:04:20.000Z" },
    ],
    {
      knowledgeDescription: "Knowledge ready.",
      knowledgeReady: true,
      knowledgeLimited: false,
      knowledgePageCount: 4,
    },
    harness.createEmptyActionQueue()
  );

  assert.match(panel, /Pricing questions need clearer answers/);
  assert.doesNotMatch(panel, new RegExp(rawQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(panel, /sharpening answers like/);
});

test("customer rows for email users show email, customer question, and persisted customer message time", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-1",
    name: "Can you send the pricing package?",
    bestIdentifier: "Alex Harper",
    email: "alex@example.com",
    lifecycleState: "active_lead",
    sources: ["chat"],
    flags: ["follow up due"],
    lastCustomerMessageAt: "2026-04-14T09:03:55.000Z",
    mostRecentActivityAt: "2026-04-16T12:34:56.000Z",
    latestCustomerMessageSummary: "Can you send pricing?",
    nextAction: {
      key: "draft_quote_follow_up",
      title: "Draft quote follow-up",
      description: "Follow up on pricing.",
    },
    timeline: [
      {
        at: "2026-04-14T09:04:20.000Z",
        label: "Assistant message",
        source: "chat",
        summary: "Vonza can help with pricing.",
      },
    ],
    counts: { messages: 2 },
  });

  const nameIndex = row.indexOf("Alex Harper");
  const questionIndex = row.indexOf("Can you send pricing?");
  const emailIndex = row.indexOf("alex@example.com");
  const timeIndex = row.indexOf("2026,");

  assert.ok(nameIndex >= 0);
  assert.ok(questionIndex > nameIndex);
  assert.ok(emailIndex >= 0);
  assert.ok(emailIndex > nameIndex);
  assert.ok(timeIndex > emailIndex);
  assert.match(row, /<strong class="contact-row-name">Alex Harper<\/strong>/);
  assert.match(row, /<p class="customer-row-summary">Can you send pricing\?<\/p>/);
  assert.match(row, /<p class="customer-row-identity">Email user · alex@example.com<\/p>/);
  assert.match(row, /data-contact-last-activity="2026-04-14T09:03:55\.000Z"/);
  assert.doesNotMatch(row, /2026-04-16T12:34:56\.000Z/);
  assert.doesNotMatch(row, /Last active/);
  assert.doesNotMatch(row, /Vonza/);
});

test("customer rows separate guest identity from the widget question text and summarize the conversation", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-question",
    name: "hey, what services do you offer",
    bestIdentifier: "hey, what services do you offer",
    lifecycleState: "active_lead",
    sources: ["chat"],
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    nextAction: {
      key: "no_action_needed",
      title: "No action needed",
      description: "This contact does not have a higher-priority owner next step right now.",
    },
    timeline: [
      {
        at: "2026-04-16T09:47:46.000Z",
        label: "Visitor message",
        source: "chat",
        summary: "",
      },
    ],
  });

  assert.match(row, /<strong class="contact-row-name">Guest visitor<\/strong>/);
  assert.match(row, /<p class="customer-row-summary">Asked which service fits their needs<\/p>/);
  assert.doesNotMatch(row, /<strong class="contact-row-name">hey, what services do you offer<\/strong>/);
  assert.doesNotMatch(row, /<p class="customer-row-summary">hey, what services do you offer<\/p>/);
  assert.doesNotMatch(row, /No action needed/);
});

test("customer rows upgrade guest sessions to identified email state", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-upgraded",
    name: "Avery Hart",
    bestIdentifier: "Session continuity only",
    email: "avery@example.com",
    lifecycleState: "active_lead",
    partialIdentity: false,
    sources: ["chat"],
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    latestCustomerMessageSummary: "Can you send pricing?",
    timeline: [],
  });

  assert.match(row, /<strong class="contact-row-name">Avery Hart<\/strong>/);
  assert.match(row, /<p class="customer-row-identity">Email user · avery@example.com<\/p>/);
  assert.doesNotMatch(row, /<strong class="contact-row-name">Guest visitor<\/strong>/);
});

test("guest customer rows show stored customer message summary and last message time", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-guest",
    name: "Anonymous visitor",
    bestIdentifier: "Session continuity only",
    lifecycleState: "active_lead",
    partialIdentity: true,
    sources: ["chat"],
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    latestCustomerMessageSummary: "Do you offer weekend appointments?",
    timeline: [],
  });

  assert.match(row, /<strong class="contact-row-name">Guest visitor<\/strong>/);
  assert.match(row, /Needed help with booking or availability/);
  assert.doesNotMatch(row, /Do you offer weekend appointments\?/);
  assert.match(row, /data-contact-last-activity="2026-04-16T09:47:46\.000Z"/);
  assert.doesNotMatch(row, /No customer message yet/);
});

test("customer rows do not invent Last message timestamps without a customer-authored message", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-2",
    email: "no-message@example.com",
    lifecycleState: "customer",
    mostRecentActivityAt: "2026-04-16T12:34:56.000Z",
    latestOutcome: {
      label: "Quote accepted",
      occurredAt: "2026-04-15T10:00:00.000Z",
    },
  });

  assert.match(row, /class="customer-row-last-seen">No customer message yet<\/strong>/);
  assert.match(row, /No customer message yet/);
  assert.match(row, /data-contact-last-activity=""/);
  assert.doesNotMatch(row, /Last active/);
  assert.doesNotMatch(row, /2026-04-16T12:34:56\.000Z/);
  assert.doesNotMatch(row, /2026-04-15T10:00:00\.000Z/);
});

test("customer row chat expansion markup stays inline and chronological", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-chat",
    name: "Taylor Reed",
    email: "taylor@example.com",
    lifecycleState: "active_lead",
    sources: ["chat"],
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    latestCustomerMessageSummary: "First customer message.",
    chatMessages: [
      {
        label: "Customer",
        role: "customer",
        content: "First customer message.",
        createdAt: "2026-04-16T09:47:46.000Z",
      },
      {
        label: "Vonza",
        role: "vonza",
        content: "First Vonza reply.",
        createdAt: "2026-04-16T09:47:50.000Z",
      },
      {
        label: "Customer",
        role: "customer",
        content: "Second customer message.",
        createdAt: "2026-04-16T09:48:00.000Z",
      },
    ],
  });

  assert.match(row, /data-toggle-customer-chat/);
  assert.match(row, /aria-expanded="false"/);
  assert.match(row, /data-customer-chat-panel/);
  assert.ok(row.indexOf("First customer message.") < row.indexOf("First Vonza reply."));
  assert.ok(row.indexOf("First Vonza reply.") < row.indexOf("Second customer message."));
  const chatPanelMarkup = row.slice(
    row.indexOf('class="customer-chat-panel"'),
    row.indexOf("</article>", row.indexOf('class="customer-chat-panel"'))
  );
  assert.doesNotMatch(chatPanelMarkup, /operator|workflow|queue|copilot|approval|automation/i);
});

test("guest customer rows stay summary-only even if chat messages are present in data", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-guest-chat",
    name: "Anonymous visitor",
    lifecycleState: "active_lead",
    partialIdentity: true,
    sources: ["chat"],
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    latestCustomerMessageSummary: "First customer message.",
    chatMessages: [
      {
        label: "Customer",
        role: "customer",
        content: "First customer message.",
        createdAt: "2026-04-16T09:47:46.000Z",
      },
      {
        label: "Vonza",
        role: "vonza",
        content: "First Vonza reply.",
        createdAt: "2026-04-16T09:47:50.000Z",
      },
    ],
  });

  assert.match(row, /data-toggle-customer-chat/);
  assert.match(row, /disabled/);
  assert.match(row, /Chat unavailable/);
  assert.doesNotMatch(row, /No chat yet/);
  assert.doesNotMatch(row, /data-customer-chat-panel/);
});

test("guest customer rows with no contact details use review and missing-contact labels", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const row = harness.buildContactRow({
    id: "contact-guest-review",
    name: "Anonymous visitor",
    partialIdentity: true,
    sources: ["chat"],
    flags: ["follow up due"],
    latestCustomerMessageSummary: "Can you send pricing?",
    lastCustomerMessageAt: "2026-04-16T09:47:46.000Z",
    timeline: [
      {
        label: "Visitor message",
        source: "chat",
        summary: "Can you send pricing?",
        at: "2026-04-16T09:47:46.000Z",
      },
    ],
  });

  assert.match(row, /Guest visitor/);
  assert.match(row, /Needs review/);
  assert.match(row, /Missing contact details/);
  assert.match(row, /Guest visitor only\. No contact details captured yet\./);
  assert.doesNotMatch(row, /Needs follow-up/);
});

test("identified customer rows can show follow-up while guests without contact cannot", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const identifiedRow = harness.buildContactRow({
    id: "contact-follow-up",
    name: "Riley Hart",
    email: "riley@example.com",
    sources: ["chat"],
    flags: ["follow up due"],
    latestCustomerMessageSummary: "Please send the quote.",
  });
  const guestRow = harness.buildContactRow({
    id: "contact-guest-follow-up",
    name: "Anonymous visitor",
    partialIdentity: true,
    sources: ["chat"],
    flags: ["follow up due"],
    latestCustomerMessageSummary: "Please send the quote.",
  });

  assert.match(identifiedRow, /Needs follow-up/);
  assert.doesNotMatch(guestRow, /Needs follow-up/);
  assert.match(guestRow, /Needs review/);
});

test("customer detail actions prepare replies and explain unavailable guest chat", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_LAUNCH_PROFILE: {
        matrix: {
          automations: { state: "stable", label: "Automations" },
        },
      },
    },
  });
  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConfigReady: true,
      googleConnected: true,
    },
  });
  const identifiedPanel = harness.buildContactDetailPanel({}, {
    id: "contact-identified-reply",
    name: "Jordan Lee",
    email: "jordan@example.com",
    sources: ["chat"],
    latestCustomerMessageSummary: "Can you confirm pricing?",
  }, workspace, true);
  const guestPanel = harness.buildContactDetailPanel({}, {
    id: "contact-guest-detail",
    name: "Anonymous visitor",
    partialIdentity: true,
    sources: ["chat"],
    latestMessageId: "message-1",
    latestCustomerMessageSummary: "Can you confirm pricing?",
    nextAction: {
      title: "Review open question",
      description: "A reply is still needed.",
    },
  }, workspace, true);

  assert.match(identifiedPanel, /Review suggested reply/);
  assert.doesNotMatch(identifiedPanel, /Send AI draft/);
  assert.match(guestPanel, /Review conversation/);
  assert.match(guestPanel, /Mark reviewed/);
  assert.match(guestPanel, /Guest visitor only\. No contact details captured yet\./);
  assert.doesNotMatch(guestPanel, /Review suggested reply/);
  assert.doesNotMatch(guestPanel, /Prepare reply/);
});

test("contacts panel still renders rows when a contact only has the needs-reply state", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const contactsPanel = harness.buildContactsPanel(
    {},
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        list: [
          {
            id: "contact-needs-reply-only",
            name: "Pat Minimal",
            email: "pat@example.com",
            nextAction: {
              title: "Review open question",
              description: "A reply is still needed.",
            },
            sources: ["chat"],
            chatMessages: [],
          },
        ],
      },
    })
  );

  assert.match(contactsPanel, /contacts-workspace/);
  assert.match(contactsPanel, /Pat Minimal/);
  assert.match(contactsPanel, /Needs reply/);
  assert.doesNotMatch(contactsPanel, /Your customers will show up here/);
});

test("sidebar rail keeps primary and utility navigation without placeholder connected tools", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const sidebar = harness.buildSidebarShell(
    { assistantName: "Vonza", websiteUrl: "https://example.com" },
    {
      isReady: true,
      knowledgeReady: true,
      knowledgeLimited: false,
    },
    harness.createEmptyActionQueue(),
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      status: {
        googleConnected: true,
        googleConfigReady: true,
      },
      connectedAccounts: [
        {
          id: "account-1",
          status: "connected",
          accountEmail: "owner@example.com",
          capabilities: {
            identity: true,
            gmailRead: true,
            calendarRead: true,
          },
        },
      ],
    }),
    "overview"
  );

  assert.match(sidebar, /Operate/);
  assert.match(sidebar, /Front Desk is the primary customer surface/);
  assert.doesNotMatch(sidebar, /Connected Tools/);
  assert.doesNotMatch(sidebar, /\(coming soon\)/);
  assert.doesNotMatch(sidebar, /Email[\s\S]{0,80}Beta/);
  assert.doesNotMatch(sidebar, /Calendar[\s\S]{0,80}Beta/);
  assert.doesNotMatch(sidebar, /Automations[\s\S]{0,80}Beta/);
  assert.doesNotMatch(sidebar, /Optional/);
  assert.match(sidebar, /Setup/);
  assert.match(sidebar, /Workspace/);
  assert.match(sidebar, /Knowledge/);
  assert.match(sidebar, /Install/);
});

test("analytics page renders the approved V2 analytics composition with real data", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const analyticsPanel = harness.buildAnalyticsPanel(
    { installStatus: { label: "Seen recently", state: "seen_recently" } },
    [
      { id: "m1", role: "user", content: "Can I book an appointment?" },
      { id: "m2", role: "assistant", content: "Yes, I can help with that." },
      { id: "m3", role: "user", content: "Yeah I'd like to contact the boss" },
      { id: "m4", role: "assistant", content: "Here is the best contact path." },
    ],
    {
      knowledgeDescription: "Knowledge ready.",
      knowledgeReady: true,
      knowledgeLimited: false,
      knowledgePageCount: 4,
    },
    {
      ...harness.createEmptyActionQueue(),
      recentOutcomes: [
        {
          outcomeType: "booking_confirmed",
          sourceLabel: "Booking CTA",
          occurredAt: "2026-04-05T09:00:00.000Z",
        },
      ],
    }
  );

  assert.match(analyticsPanel, /Performance insights for your AI front desk/);
  assert.match(analyticsPanel, /Conversations over time/);
  assert.doesNotMatch(analyticsPanel, /Is Vonza helping customer service\?/);
  assert.doesNotMatch(analyticsPanel, /Service report/);
  assert.match(analyticsPanel, /Entry point \/ source breakdown/);
  assert.match(analyticsPanel, /AI vs Human handling/);
  assert.match(analyticsPanel, /Performance by source/);
  assert.match(analyticsPanel, /What to improve next/);
  assert.match(analyticsPanel, /Top questions and weak answers/);
  assert.match(analyticsPanel, /Conversion rate/);
  assert.match(analyticsPanel, /Looking for booking or availability/);
  assert.match(analyticsPanel, /Asking how to contact the business directly/);
  assert.match(analyticsPanel, /AI vs Human handling/);
  assert.doesNotMatch(analyticsPanel, /answered without needing a team reply/);
  assert.doesNotMatch(analyticsPanel, /Yeah I'd like to contact the boss/);
  assert.doesNotMatch(analyticsPanel, /data-refresh-operator data-force-sync="true">Refresh/);
});

test("analytics surfaces feedback recovery and owner-visible notifications", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    ownerAnalyticsDashboard: {
      ok: true,
      metrics: {
        totalConversations: 2,
      },
      customerSatisfaction: {
        totalFeedback: 2,
        helpful: 1,
        notHelpful: 1,
        negativeRate: 50,
        unhappyAnswers: [
          {
            question: "How much does the website package cost?",
            recommendedAction: "Fix knowledge or reply to the customer before similar questions repeat.",
          },
        ],
        recoveryActions: [
          {
            type: "fix_knowledge",
            label: "Fix knowledge",
            count: 1,
            copy: "Negative reply feedback lines up with knowledge-fix work in the queue.",
          },
        ],
        persistenceAvailable: true,
      },
      notifications: [
        {
          type: "unhappy_customers",
          title: "Unhappy answer feedback",
          copy: "1 answer marked not helpful needs review.",
        },
      ],
    },
  };

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [],
    { knowledgeReady: true },
    actionQueue
  );

  assert.match(analyticsPanel, /Feedback recovery loop/);
  assert.match(analyticsPanel, /Unhappy answer feedback/);
  assert.match(analyticsPanel, /How much does the website package cost/);
  assert.match(analyticsPanel, /Fix knowledge/);
  assert.match(analyticsPanel, /50% negative/);
});

test("analytics renders assistant source breakdown for widget, page, and legacy activity", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    ownerAnalyticsDashboard: {
      ok: true,
      metrics: {
        totalConversations: 3,
      },
      assistantSource: {
        widget: {
          key: "widget",
          label: "Website widget",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        page: {
          key: "page",
          label: "Front Desk page",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 1,
        },
        embedded: {
          key: "embedded",
          label: "Embedded assistant",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        unknown: {
          key: "unknown",
          label: "Legacy/unknown",
          conversationCount: 1,
          messageCount: 1,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        totalConversations: 4,
        totalMessages: 7,
      },
    },
  };

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [],
    { knowledgeReady: true },
    actionQueue,
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(analyticsPanel, /Entry point \/ source breakdown/);
  assert.match(analyticsPanel, /Performance by source/);
  assert.match(analyticsPanel, /Website widget/);
  assert.match(analyticsPanel, /Front Desk page/);
  assert.match(analyticsPanel, /Embedded assistant/);
  assert.match(analyticsPanel, /Legacy\/unknown/);
  assert.match(analyticsPanel, /Conversion rate/);
  assert.match(analyticsPanel, /AI handled/);
  assert.doesNotMatch(analyticsPanel, /display_mode/);
});

test("analytics assistant source shows clean full-page empty state", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    ownerAnalyticsDashboard: {
      ok: true,
      assistantSource: {
        widget: {
          key: "widget",
          label: "Website widget",
          conversationCount: 1,
          messageCount: 2,
        },
        page: {
          key: "page",
          label: "Front Desk page",
          conversationCount: 0,
          messageCount: 0,
        },
        unknown: {
          key: "unknown",
          label: "Legacy/unknown",
          conversationCount: 0,
          messageCount: 0,
        },
        totalConversations: 1,
        totalMessages: 2,
      },
    },
  };

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [],
    { knowledgeReady: true },
    actionQueue,
    harness.createEmptyOperatorWorkspace()
  );

  assert.match(analyticsPanel, /Front Desk page/);
  assert.match(analyticsPanel, /Not tracked/);
  assert.doesNotMatch(analyticsPanel, /Legacy\/unknown/);
});

test("customers panel renders searchable records with real identity, source, and detail surfaces", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const workspace = harness.createEmptyOperatorWorkspace();
  workspace.contacts.list = [
    {
      id: "contact-identified",
      name: "Alex Customer",
      email: "alex@example.com",
      lifecycleState: "active_lead",
      sources: ["chat"],
      nextAction: {
        title: "Send a follow-up",
        description: "Answer the open pricing question.",
      },
      chatMessages: [
        { role: "customer", label: "Customer", content: "Can I get pricing?", createdAt: "2026-05-13T10:00:00.000Z" },
        { role: "vonza", label: "Vonza", content: "I can help with that.", createdAt: "2026-05-13T10:00:05.000Z" },
      ],
      timeline: [
        { label: "Visitor message", source: "chat", summary: "Asked about pricing.", at: "2026-05-13T10:00:00.000Z" },
      ],
    },
    {
      id: "contact-page",
      partialIdentity: true,
      lifecycleState: "new",
      sources: ["page", "qr"],
      timeline: [
        { label: "Visitor message", source: "chat", summary: "Asked which service fits.", at: "2026-05-13T10:05:00.000Z" },
      ],
    },
    {
      id: "contact-web-call",
      partialIdentity: true,
      lifecycleState: "new",
      sources: ["web_call"],
      timeline: [
        { label: "Visitor message", source: "chat", summary: "Asked by Web Call.", at: "2026-05-13T10:10:00.000Z" },
      ],
    },
  ];

  const contactsPanel = harness.buildContactsPanel({}, workspace);

  assert.match(contactsPanel, /data-contact-search/);
  assert.match(contactsPanel, /New leads/);
  assert.match(contactsPanel, /Warm leads/);
  assert.match(contactsPanel, /Guests/);
  assert.match(contactsPanel, /Needs review/);
  assert.match(contactsPanel, /Follow-up possible/);
  assert.match(contactsPanel, /Missing contact details/);
  assert.match(contactsPanel, /Identified/);
  assert.match(contactsPanel, /Guest visitor/);
  assert.match(contactsPanel, /Website widget/);
  assert.match(contactsPanel, /Front Desk page/);
  assert.match(contactsPanel, /Web Call/);
  assert.match(contactsPanel, /QR \/ direct link/);
  assert.match(contactsPanel, /data-contact-identity="identified"/);
  assert.match(contactsPanel, /data-contact-identity="guest"/);
  assert.match(contactsPanel, /data-contact-source-labels="Website widget"/);
  assert.match(contactsPanel, /data-contact-source-labels="Front Desk page\|QR \/ direct link"/);
  assert.match(contactsPanel, /data-contact-source-labels="Web Call"/);
  assert.match(contactsPanel, /View chat/);
  assert.match(contactsPanel, /contacts-detail-shell/);
  assert.match(contactsPanel, /What happened/);
  assert.match(contactsPanel, /Why it matters/);
  assert.match(contactsPanel, /Next action/);
  assert.match(contactsPanel, /Chat unavailable/);
  assert.doesNotMatch(contactsPanel, /display_mode/);
  assert.doesNotMatch(contactsPanel, /Sophia|Marcus|Olivia|Growth Plan/);
});

test("customer filters separate needs review from follow-up possible counts", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    contacts: {
      list: [
        {
          id: "guest-review",
          name: "Anonymous visitor",
          partialIdentity: true,
          sources: ["chat"],
          flags: ["follow up due"],
          latestCustomerMessageSummary: "Can you send pricing?",
        },
        {
          id: "identified-follow-up",
          name: "Avery Customer",
          email: "avery@example.com",
          sources: ["chat"],
          flags: ["follow up due"],
        },
      ],
    },
  });
  const contactsPanel = harness.buildContactsPanel({}, workspace);

  assert.match(contactsPanel, /<span>Needs review<\/span>\s*<strong>2<\/strong>/);
  assert.match(contactsPanel, /<span>Follow-up possible<\/span>\s*<strong>1<\/strong>/);
  assert.match(contactsPanel, /data-contact-id="guest-review"[\s\S]*data-contact-follow-up-possible="false"/);
  assert.match(contactsPanel, /data-contact-id="identified-follow-up"[\s\S]*data-contact-follow-up-possible="true"/);
  assert.match(contactsPanel, /<span>Guests<\/span>\s*<strong>1<\/strong>/);
  assert.match(contactsPanel, /<span>Identified<\/span>\s*<strong>1<\/strong>/);
  assert.match(contactsPanel, /data-contact-filter="website_widget"/);
  assert.match(contactsPanel, /data-contact-filter="full_page_assistant"/);
});

test("customers panel uses a polished empty state with no preview customer data", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.createEmptyOperatorWorkspace();
  workspace.contacts.list = [];
  const contactsPanel = harness.buildContactsPanel({}, workspace);

  assert.match(contactsPanel, /No customer conversations yet/);
  assert.match(contactsPanel, /customer records, lead context, and follow-up signals will appear here/);
  assert.doesNotMatch(contactsPanel, /Install Vonza or open your assistant preview to start testing/);
  assert.doesNotMatch(contactsPanel, /Sophia|Marcus|Olivia|Growth Plan/);
  assert.doesNotMatch(contactsPanel, /fake|mock/i);
});

test("analytics panel omits standalone knowledge improvement center", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const actionQueue = {
    ...harness.createEmptyActionQueue(),
    items: [
      {
        key: "feedback:feedback-1",
        actionType: "knowledge_gap",
        knowledgeFixSupported: true,
        question: "How much does emergency service cost?",
        reply: "Please contact the business directly.",
        whyFlagged: "Flagged because a visitor explicitly marked this answer not helpful.",
        suggestedAction: "Use verified quote guidance and do not invent prices.",
        count: 1,
        knowledgeFix: {
          id: "knowledge-fix-1",
          status: "draft",
          proposedGuidance: "If emergency pricing is not published, say that clearly and direct the visitor to request a quote.",
          issueSummary: "The answer did not explain the quote path.",
          targetLabel: "Advanced guidance / system prompt",
          occurrenceCount: 1,
          evidence: {
            question: "How much does emergency service cost?",
            currentResponse: "Please contact the business directly.",
          },
        },
      },
    ],
    ownerAnalyticsDashboard: {
      ok: true,
      knowledgeImprovement: {
        title: "Knowledge Improvement",
        copy: "Weak, repeated, and not-helpful answers are ready for owner review and grounded guidance.",
        total: 1,
        openCount: 1,
        approvedFixedCount: 0,
        dismissedCount: 0,
        guardrail: "Approved guidance must not override safety rules, contact verification, or the rule to avoid inventing business facts.",
        items: [],
      },
    },
  };

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [],
    { knowledgeReady: true },
    actionQueue
  );

  assert.doesNotMatch(analyticsPanel, /id="knowledge-improvement"/);
  assert.doesNotMatch(analyticsPanel, /data-knowledge-improvement-center/);
  assert.doesNotMatch(analyticsPanel, /Close the weak-answer loop/);
  assert.doesNotMatch(analyticsPanel, /How much does emergency service cost/);
});

test("install section stays focused on install methods and verification", () => {
  const harness = createDashboardHarness();
  const markup = harness.buildInstallSection({
    id: "agent-1",
    publicAgentKey: "agent-key",
    installId: "install-1",
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key-1",
    },
    installStatus: {
      state: "seen_recently",
      label: "Seen recently",
      host: "example.com",
      allowedDomains: ["example.com"],
      lastSeenAt: "2026-05-10T08:00:00.000Z",
    },
  });
  const widgetPanel = markup.slice(
    markup.indexOf('id="install-panel-widget"'),
    markup.indexOf('id="install-panel-page"')
  );
  const pagePanel = markup.slice(
    markup.indexOf('id="install-panel-page"'),
    markup.indexOf('id="install-panel-qr"')
  );
  const qrPanel = markup.slice(markup.indexOf('id="install-panel-qr"'));

  assert.match(markup, /Install setup stages/);
  assert.match(markup, /Choose method/);
  assert.match(markup, /Configure/);
  assert.match(markup, /Verify/);
  assert.match(markup, /Go live/);
  assert.match(markup, /Allowed domains/);
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /data-install-method-tab="widget"/);
  assert.match(markup, /data-install-method-tab="page"/);
  assert.match(markup, /data-install-method-tab="qr"/);
  assert.match(markup, />Website widget bubble</);
  assert.match(markup, />Front Desk page</);
  assert.match(markup, />QR \/ direct link</);
  assert.match(markup, /id="install-panel-widget"/);
  assert.match(markup, /id="install-panel-page" role="tabpanel" data-install-method-panel="page"/);
  assert.match(markup, /id="install-panel-qr" role="tabpanel" data-install-method-panel="qr" hidden/);
  assert.match(widgetPanel, /Website widget bubble code/);
  assert.match(widgetPanel, /data-action="copy-install"/);
  assert.match(widgetPanel, /Paste this once into your site header only when you want the optional bubble\./);
  assert.match(widgetPanel, /Detected install status/);
  assert.match(widgetPanel, /example\.com/);
  assert.match(widgetPanel, /data-action="verify-install"/);
  assert.match(widgetPanel, /Test website bubble/);
  assert.doesNotMatch(widgetPanel, /full-page-assistant-iframe|Iframe snippet|data-full-page-qr-preview|Target URL/);
  assert.match(pagePanel, /Choose how customers should open the AI Front Desk page/);
  assert.match(pagePanel, /Front Desk page link/);
  assert.match(pagePanel, /Use this for QR codes, buttons, menus, emails, and direct links\./);
  assert.match(pagePanel, /Smart embed/);
  assert.match(pagePanel, /Place the Front Desk inside part of an existing page\./);
  assert.match(pagePanel, /Dedicated page embed/);
  assert.match(pagePanel, /Use this when Front Desk is the main content of a page on your website\./);
  assert.match(pagePanel, /True page takeover/);
  assert.match(pagePanel, /Advanced\. Use this on a blank dedicated page when you want Front Desk to own the full page area\./);
  assert.match(pagePanel, /Raw iframe fallback/);
  assert.match(pagePanel, /Use this for builders that block scripts\./);
  assert.match(pagePanel, /id="full-page-option-share" role="tabpanel" data-full-page-option-panel="share"/);
  assert.match(pagePanel, /id="full-page-option-section" role="tabpanel" data-full-page-option-panel="section" hidden/);
  assert.match(pagePanel, /id="full-page-option-dedicated" role="tabpanel" data-full-page-option-panel="dedicated" hidden/);
  assert.match(pagePanel, /id="full-page-option-takeover" role="tabpanel" data-full-page-option-panel="takeover" hidden/);
  assert.match(pagePanel, /id="full-page-option-iframe" role="tabpanel" data-full-page-option-panel="iframe" hidden/);
  assert.match(pagePanel, /http:\/\/127\.0\.0\.1:3000\/a\/agent-key/);
  assert.match(pagePanel, /data-action="copy-full-page-url"/);
  assert.match(pagePanel, /data-action="copy-section-assistant-smart-embed"/);
  assert.match(pagePanel, /data-action="copy-section-assistant-iframe"/);
  assert.match(pagePanel, /data-action="copy-full-page-assistant-smart-embed"/);
  assert.match(pagePanel, /data-action="copy-full-page-assistant-true-page-takeover"/);
  assert.match(pagePanel, /data-action="copy-full-page-iframe"/);
  assert.match(pagePanel, /Copy smart snippet/);
  assert.match(pagePanel, /Copy iframe snippet/);
  assert.match(pagePanel, /Recommended\. Automatically adjusts to most website layouts\./);
  assert.match(pagePanel, /Advanced fallback\. Use this if your website builder does not allow scripts\./);
  assert.match(pagePanel, /Recommended smart snippet/);
  assert.match(pagePanel, /Dedicated page embed snippet/);
  assert.match(pagePanel, /True page takeover snippet/);
  assert.match(pagePanel, /Advanced iframe snippet/);
  assert.match(pagePanel, /Raw iframe fallback/);
  assert.match(pagePanel, /data-vonza-assistant/);
  assert.match(pagePanel, /data-agent-id=(?:"|&quot;)agent-1(?:"|&quot;)/);
  assert.match(pagePanel, /data-layout=(?:"|&quot;)page-takeover(?:"|&quot;)/);
  assert.match(pagePanel, /data-background-scope=(?:"|&quot;)viewport(?:"|&quot;)/);
  assert.match(pagePanel, /data-background-scope=(?:"|&quot;)page(?:"|&quot;)/);
  assert.match(pagePanel, /data-page-reset=(?:"|&quot;)true(?:"|&quot;)/);
  assert.match(pagePanel, /data-hide-page-footer=(?:"|&quot;)true(?:"|&quot;)/);
  assert.match(pagePanel, /assistant-embed\.js/);
  assert.match(pagePanel, /mode=page&amp;embedded=1&amp;size=standard|mode=page&embedded=1&size=standard/);
  assert.match(pagePanel, /min-height:640px;border:0;border-radius:18px;overflow:hidden/);
  assert.match(pagePanel, /Dedicated page embed makes the Front Desk the page body below your site header/);
  assert.match(pagePanel, /Use this on a blank assistant page\. It may hide the page footer and remove extra page spacing\./);
  assert.match(pagePanel, /Raw iframe backgrounds stay inside the iframe\. Use the smart dedicated page embed when you want the background to fill the page area\./);
  assert.match(pagePanel, /height:calc\(100vh - 120px\);min-height:760px;border:0;display:block/);
  assert.match(pagePanel, /Platform quick guides/);
  assert.match(pagePanel, /Install-only website guidance/);
  assert.match(pagePanel, /data-install-platform="generic-html-smart-embed"/);
  assert.match(pagePanel, /data-install-platform="wordpress-woocommerce"/);
  assert.match(pagePanel, /data-install-platform="wix"/);
  assert.match(pagePanel, /data-install-platform="shopify"/);
  assert.match(pagePanel, /data-install-platform="webflow"/);
  assert.match(pagePanel, /data-install-platform="squarespace"/);
  assert.match(pagePanel, /Start with the hosted AI Front Desk page/);
  assert.match(pagePanel, /Use embeds when you want Front Desk inside a website page/);
  assert.match(pagePanel, /WooCommerce product and order data are not connected by this install step/);
  assert.match(pagePanel, /Products, carts, and orders are not connected by this install step/);
  assert.match(pagePanel, /Some Wix areas can restrict custom code/);
  assert.match(pagePanel, /Some templates and editing areas can limit script embeds/);
  assert.match(pagePanel, /data-public-page-key=(?:"|&quot;)page-key-1(?:"|&quot;)/);
  assert.doesNotMatch(pagePanel, /(?:Shopify|Wix|WooCommerce)[\s\S]{0,160}(?:API token|access token|secret key|consumer key|consumer secret|OAuth|marketplace)/i);
  assert.doesNotMatch(pagePanel, /<input[^>]+(?:shopify|wix|woocommerce)[^>]+(?:token|secret|api|key)/i);
  assert.doesNotMatch(pagePanel, /Show embed title/);
  assert.doesNotMatch(pagePanel, /data-full-page-title-toggle checked/);
  assert.doesNotMatch(pagePanel, /Assistant area height/);
  assert.doesNotMatch(pagePanel, /Website header height/);
  assert.doesNotMatch(pagePanel, /If your website has a sticky header, adjust the 120px value\./);
  assert.doesNotMatch(pagePanel, /full-width wrapper snippet/);
  assert.doesNotMatch(pagePanel, /Use <code>size=compact<\/code>|Use <code>surface=flat<\/code>/);
  assert.doesNotMatch(pagePanel, /min-height:520px/);
  assert.match(pagePanel, /Customize Front Desk page/);
  assert.doesNotMatch(pagePanel, /install-script-output|Website widget bubble code|Allowed domains/);
  assert.match(qrPanel, /data-full-page-qr-preview/);
  assert.match(qrPanel, /Download QR code/);
  assert.match(qrPanel, /Copy Front Desk page link/);
  assert.match(qrPanel, /Front Desk page link/);
  assert.match(qrPanel, /http:\/\/127\.0\.0\.1:3000\/a\/agent-key/);
  assert.match(qrPanel, /opens the same customer-facing Front Desk page link/);
  assert.doesNotMatch(qrPanel, /\d+\s+scans|scan rate|scans today/i);
  assert.doesNotMatch(markup, /You are live/);
  assert.doesNotMatch(markup, /weak answers, leads, and follow-up needs/);
  assert.doesNotMatch(markup, /Open Home/);
  assert.doesNotMatch(markup, /Open Analytics/);
  assert.doesNotMatch(markup, /QR code option coming soon\./);
  assert.doesNotMatch(markup, /TODO/);
});

test("install section disables full-page sharing controls when public page is disabled", () => {
  const harness = createDashboardHarness();
  const markup = harness.buildInstallSection({
    id: "agent-1",
    publicAgentKey: "agent-key",
    installId: "install-1",
    fullPageConfig: {
      publicPageEnabled: false,
      publicPageKey: "page-key-1",
    },
    installStatus: {
      state: "not_installed",
      label: "Not installed yet",
    },
  });
  const pagePanel = markup.slice(
    markup.indexOf('id="install-panel-page"'),
    markup.indexOf('id="install-panel-qr"')
  );
  const qrPanel = markup.slice(markup.indexOf('id="install-panel-qr"'));

  assert.match(pagePanel, /Your Front Desk page is disabled/);
  assert.match(pagePanel, /Enable public Front Desk page access/);
  assert.match(pagePanel, /data-action="copy-full-page-url" disabled/);
  assert.doesNotMatch(pagePanel, /http:\/\/127\.0\.0\.1:3000\/a\/agent-key/);
  assert.match(qrPanel, /Enable the public Front Desk page before downloading or sharing a QR code/);
  assert.match(qrPanel, /data-action="copy-full-page-url" disabled/);
  assert.match(qrPanel, /data-action="download-full-page-qr" disabled/);
});

test("install panel shows real status, progress, and resources without unrelated workspace content", () => {
  const harness = createDashboardHarness();
  const agent = {
    id: "agent-1",
    publicAgentKey: "agent-key",
    installId: "install-1",
    assistantName: "Acme assistant",
    welcomeMessage: "How can we help?",
    tone: "professional",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "ready",
      description: "Website knowledge is ready.",
    },
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key-1",
      headline: "Ask Acme",
      suggestedQuestions: ["What services do you offer?"],
    },
    installStatus: {
      state: "seen_recently",
      label: "Seen recently",
      host: "example.com",
      allowedDomains: ["example.com"],
      lastSeenAt: "2026-05-10T08:00:00.000Z",
      lastSeenUrl: "https://example.com/contact",
    },
  };
  const panel = harness.buildInstallPanel(
    agent,
    harness.inferSetup(agent),
    harness.createEmptyOperatorWorkspace(),
    [{ role: "user", content: "Can I book?" }],
    harness.createEmptyActionQueue()
  );

  assert.match(panel, />Install</);
  assert.match(panel, /Publish your AI Front Desk page through WordPress, smart embed, QR\/direct link, or the optional website widget bubble\./);
  assert.match(panel, /data-action="verify-install"/);
  assert.match(panel, /data-install-method-jump="widget"/);
  assert.match(panel, /Installation status/);
  assert.match(panel, /Seen recently/);
  assert.match(panel, /Domain status/);
  assert.match(panel, /Detected domain/);
  assert.match(panel, /Last seen/);
  assert.match(panel, /https:\/\/example\.com\/contact/);
  assert.match(panel, /Front Desk page/);
  assert.match(panel, /Your Front Desk page is live/);
  assert.match(panel, /QR code/);
  assert.match(panel, /Downloadable/);
  assert.match(panel, /Setup progress/);
  assert.match(panel, /Front Desk created/);
  assert.match(panel, /Training and knowledge ready/);
  assert.match(panel, /Public Front Desk page enabled/);
  assert.match(panel, /Launch path selected/);
  assert.match(panel, /First test conversation/);
  assert.match(panel, /Front Desk customized/);
  assert.match(panel, /Copy Front Desk page link/);
  assert.match(panel, /Customize Front Desk page/);
  assert.doesNotMatch(panel, /Open Home|Open Analytics|Customers dashboard|Front Desk inbox|Settings content/);
  assert.doesNotMatch(panel, /\d+\s+scans|scan rate|scans today/i);
});

test("install copy helpers write the current install code and full-page sharing values", async () => {
  const copied = [];
  const agent = {
    id: "agent-1",
    publicAgentKey: "agent-key",
    installId: "install-1",
    assistantName: "Acme assistant",
    welcomeMessage: "How can we help?",
    tone: "professional",
    websiteUrl: "https://example.com",
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key-1",
    },
    installStatus: {
      state: "not_installed",
      label: "Not installed yet",
      allowedDomains: ["example.com"],
    },
  };
  const harness = createDashboardHarness({
    fetchImpl: async (url) => ({
      ok: true,
      async json() {
        const requestUrl = String(url);
        if (requestUrl.includes("/agents/install-status")) {
          return { agent };
        }
        if (requestUrl.includes("/agents/messages")) {
          return { messages: [] };
        }
        if (requestUrl.includes("/agents/activation-wizard")) {
          return { wizard: null };
        }
        return {};
      },
    }),
  });
  harness.navigator = harness.window.navigator;
  harness.window.navigator.clipboard.writeText = async (value) => {
    copied.push(value);
  };

  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  await harness.copyInstallCode(agent);
  await harness.copyFullPageAssistantUrl(agent);
  await harness.copySectionAssistantSmartEmbed(agent);
  await harness.copySectionAssistantIframe(agent);
  await harness.copyFullPageAssistantSmartEmbed(agent);
  await harness.copyFullPageAssistantTruePageTakeover(agent);
  await harness.copyFullPageAssistantIframe(agent);

  assert.match(copied[0], /\/embed\.js/);
  assert.match(copied[0], /data-install-id="install-1"/);
  assert.equal(copied[1], "http://127.0.0.1:3000/a/agent-key?k=page-key-1");
  assert.match(copied[2], /data-vonza-assistant/);
  assert.match(copied[2], /data-agent-id="agent-1"/);
  assert.match(copied[2], /data-public-page-key="page-key-1"/);
  assert.match(copied[2], /data-layout="section"/);
  assert.match(copied[2], /\/assistant-embed\.js/);
  assert.match(copied[3], /<iframe/);
  assert.match(copied[3], /allow="microphone; autoplay"/);
  assert.match(copied[3], /\/widget\?agent_id=agent-1&mode=page&embedded=1&size=standard&k=page-key-1/);
  assert.match(copied[3], /min-height:640px;border:0;border-radius:18px;overflow:hidden/);
  assert.doesNotMatch(copied[3], /100vh|min-height:520px/);
  assert.match(copied[4], /data-vonza-assistant/);
  assert.match(copied[4], /data-agent-id="agent-1"/);
  assert.match(copied[4], /data-public-page-key="page-key-1"/);
  assert.match(copied[4], /data-layout="page-takeover"/);
  assert.match(copied[4], /data-surface="flat"/);
  assert.match(copied[4], /data-background-scope="viewport"/);
  assert.doesNotMatch(copied[4], /data-page-reset="true"/);
  assert.doesNotMatch(copied[4], /data-height="full-page"/);
  assert.match(copied[4], /\/assistant-embed\.js/);
  assert.match(copied[5], /data-vonza-assistant/);
  assert.match(copied[5], /data-agent-id="agent-1"/);
  assert.match(copied[5], /data-public-page-key="page-key-1"/);
  assert.match(copied[5], /data-layout="page-takeover"/);
  assert.match(copied[5], /data-surface="flat"/);
  assert.match(copied[5], /data-background-scope="page"/);
  assert.match(copied[5], /data-page-reset="true"/);
  assert.match(copied[5], /data-hide-page-footer="true"/);
  assert.match(copied[5], /\/assistant-embed\.js/);
  assert.match(copied[6], /^<iframe/);
  assert.match(copied[6], /allow="microphone; autoplay"/);
  assert.doesNotMatch(copied[6], /width:100vw;margin-left/);
  assert.match(copied[6], /\/widget\?agent_id=agent-1&mode=page&embedded=1&size=full&surface=flat&layout=canvas&k=page-key-1/);
  assert.match(copied[6], /height:calc\(100vh - 120px\);min-height:760px;border:0;display:block/);
});

test("install section falls back to widget page URL when public slug is missing", () => {
  const harness = createDashboardHarness();
  const markup = harness.buildInstallSection({
    id: "agent-1",
    installId: "install-1",
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key-2",
    },
    installStatus: {
      state: "not_installed",
      label: "Not installed yet",
    },
  });

  assert.match(markup, /data-install-method-tab="widget"/);
  assert.match(markup, /data-install-method-tab="page"/);
  assert.match(markup, /data-install-method-tab="qr"/);
  assert.match(markup, /http:\/\/127\.0\.0\.1:3000\/widget\?agent_id=agent-1&amp;mode=page&amp;k=page-key-2/);
  assert.match(markup, /data-action="copy-full-page-url"/);
  assert.match(markup, /data-action="copy-full-page-iframe"/);
  assert.match(markup, /data-action="download-full-page-qr"/);
});

test("analytics customer-question summaries stay specific without copying chat text", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const rawQuestion = "Hello, can you explain whether your premium webshop setup includes checkout and next steps for launch?";
  const summary = harness.summarizeCustomerQuestionIntent(rawQuestion);
  const analytics = harness.analyzeConversationSignals([
    { role: "user", content: rawQuestion, createdAt: "2026-04-04T08:00:00.000Z" },
    { role: "assistant", content: "Yes, here is what is included.", createdAt: "2026-04-04T08:01:00.000Z" },
    { role: "user", content: "How quickly can delivery happen?", createdAt: "2026-04-04T08:02:00.000Z" },
  ]);

  assert.equal(summary, "Asking about webshop options and next steps");
  assert.ok(analytics.recentQuestions.includes("Looking for delivery timing or service turnaround"));
  assert.ok(analytics.topQuestions.some((entry) => entry.label === "Asking about webshop options and next steps"));
  assert.doesNotMatch(summary, /general business questions|customer inquiry|asking questions|business information|service question/i);
  assert.doesNotMatch(summary, /premium webshop setup includes checkout/i);
});

test("analytics priorities map weak-answer pricing and contact signals to business-friendly wording", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [
      { createdAt: "2026-04-04T08:00:00.000Z", role: "user", content: "What services do you offer?" },
      { createdAt: "2026-04-04T08:01:00.000Z", role: "assistant", content: "I do not have that information on the website." },
      { createdAt: "2026-04-04T08:02:00.000Z", role: "user", content: "How much does it cost?" },
      { createdAt: "2026-04-04T08:03:00.000Z", role: "assistant", content: "Pricing is not mentioned on the website." },
      { createdAt: "2026-04-04T08:04:00.000Z", role: "user", content: "Can someone contact me?" },
      { createdAt: "2026-04-04T08:05:00.000Z", role: "assistant", content: "Please contact the business directly." },
    ],
    { knowledgeReady: true },
    harness.createEmptyActionQueue()
  );

  assert.match(analyticsPanel, /What to improve next/);
  assert.match(analyticsPanel, /Make service answers clearer/);
  assert.match(analyticsPanel, /Clarify pricing guidance/);
  assert.match(analyticsPanel, /Make contacting you easier/);
  assert.doesNotMatch(analyticsPanel, /Weak answers/);
  assert.doesNotMatch(analyticsPanel, /General business questions/);
});

test("analytics contact mix uses customer records instead of stale guest-only queue identities", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const analyticsPanel = harness.buildAnalyticsPanel(
    {},
    [
      { createdAt: "2026-04-04T08:00:00.000Z", role: "user", content: "I need a quote." },
      { createdAt: "2026-04-04T08:01:00.000Z", role: "assistant", content: "I can help with that." },
    ],
    { knowledgeReady: true },
    {
      ...harness.createEmptyActionQueue(),
      people: [
        { identityType: "session" },
        { identityType: "session" },
        { identityType: "session" },
      ],
      peopleSummary: {
        total: 3,
      },
    },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        list: [
          {
            id: "contact-email",
            name: "Jordan Lane",
            email: "jordan@example.com",
          },
          {
            id: "contact-name",
            name: "Riley Stone",
          },
          {
            id: "contact-guest",
            name: "Anonymous visitor",
            bestIdentifier: "Session continuity only",
          },
        ],
      },
    })
  );

  assert.match(analyticsPanel, /<span>Guest users<\/span>\s*<strong>1<\/strong>/);
  assert.match(analyticsPanel, /<span>Identified users<\/span>\s*<strong>2<\/strong>/);
  assert.match(analyticsPanel, /<span>Email users<\/span>\s*<strong>1<\/strong>/);
  assert.match(analyticsPanel, /Vonza is turning a healthy share of conversations into known customer records/);
});

test("sparse-data copilot rendering stays honest and points back to business context setup", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: true,
      headline: "Vonza sees the foundation, but not enough live operating data yet.",
      summary: "Vonza is intentionally read-first and draft-first.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "Stable-core activity is still sparse.",
        },
      ],
      context: {
        businessProfile: {
          readiness: {
            summary: "2 of 8 business context areas are filled. Missing: Pricing, Policies.",
            missingCount: 2,
          },
        },
      },
      fallback: {
        title: "Vonza needs a little more real operating context",
        description: "There is not enough stable-core activity yet for strong recommendations.",
        guidance: ["Fill the business context foundation next: Pricing, Policies."],
      },
    },
    businessProfile: {
      readiness: {
        summary: "2 of 8 business context areas are filled. Missing: Pricing, Policies.",
        missingCount: 2,
      },
      prefill: {
        available: false,
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Vonza needs a little more real operating context/);
  assert.match(overview, /Open business context/);
});

test("launch profile keeps the stable core visible and hides Google workspace surfaces", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_LAUNCH_PROFILE: {
        mode: "public_cohort_v1",
        matrix: {
          today: { state: "stable" },
          contacts: { state: "stable" },
          inbox: { state: "hidden" },
          calendar: { state: "hidden" },
          automations: { state: "hidden" },
          customize: { state: "stable" },
          outcomes: { state: "stable" },
          advanced_guidance: { state: "hidden" },
          manual_outcome_marks: { state: "hidden" },
          knowledge_fix_workflows: { state: "hidden" },
        },
      },
    },
  });

  assert.equal(harness.getCapabilityState("today"), "stable");
  assert.equal(harness.getCapabilityState("inbox"), "hidden");
  assert.equal(harness.getCapabilityState("manual_outcome_marks"), "hidden");
  assert.equal(harness.isCapabilityStable("contacts"), true);
  assert.equal(harness.isCapabilityBeta("calendar"), false);
});

test("launch mode hides Google beta tabs when Google config is unavailable", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      enabled: true,
      featureEnabled: true,
      googleConfigReady: false,
      googleConnected: false,
    },
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "install", "settings"]
  );
  assert.equal(harness.getWorkspaceMode(workspace).key, "operator_without_google_beta");
});

test("front-desk-only mode keeps the stable non-operator shell available", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: false,
    featureEnabled: false,
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "install", "settings"]
  );
  assert.equal(harness.getWorkspaceMode(workspace).key, "front_desk_only");
});

test("dashboard renders inbox threads safely when thread messages are missing", async () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          enabled: true,
          featureEnabled: true,
          status: {
            enabled: true,
            featureEnabled: true,
            googleConnected: true,
          },
          activation: {
            inboxSynced: true,
          },
          connectedAccounts: [
            {
              status: "connected",
              accountEmail: "owner@example.com",
            },
          ],
          inbox: {
            threads: [
              {
                id: "thread-1",
                subject: "Need help",
              },
            ],
          },
        };
      },
    }),
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");
  const markup = harness.buildInboxPanel({}, workspace);

  assert.equal(Array.isArray(workspace.inbox.threads[0].messages), true);
  assert.match(markup, /Beta/);
  assert.doesNotMatch(markup, /Need help/);
  assert.doesNotMatch(markup, /Read-only/i);
  assert.doesNotMatch(markup, /Approve and send/i);
});

test("dashboard keeps the launch-core shell when the operator flag is off", async () => {
  let fetchCalls = 0;
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");

  assert.equal(fetchCalls, 1);
  assert.equal(workspace.enabled, false);
  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "install", "settings"]
  );
});

test("dashboard refresh reloads live agent messages, summaries, and workspace data", async () => {
  const calls = [];
  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    publicAgentKey: "public-key",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "ready",
      description: "Knowledge ready.",
    },
    installStatus: {
      state: "seen_recently",
      label: "Live",
      host: "example.com",
    },
    accessStatus: "active",
  };
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      calls.push(`${parsed.pathname}${parsed.search}`);

      if (parsed.pathname === "/agents/install-status") {
        return {
          ok: true,
          async json() {
            return { agent };
          },
        };
      }

      if (parsed.pathname === "/agents/messages") {
        return {
          ok: true,
          async json() {
            return {
              messages: [
                {
                  id: "message-1",
                  role: "user",
                  content: "Fresh live question",
                  sessionKey: "session-1",
                  createdAt: "2026-04-14T09:03:55.000Z",
                },
              ],
            };
          },
        };
      }

      if (parsed.pathname === "/agents/action-queue") {
        return {
          ok: true,
          async json() {
            return {
              items: [],
              summary: { total: 0, attentionNeeded: 0 },
              analyticsSummary: {
                totalMessages: 1,
                visitorQuestions: 1,
                syncState: "ready",
                recentActivity: {
                  lastActivityAt: "2026-04-14T09:03:55.000Z",
                },
              },
            };
          },
        };
      }

      if (parsed.pathname === "/agents/operator-workspace") {
        return {
          ok: true,
          async json() {
            return {
              enabled: true,
              featureEnabled: true,
              contacts: {
                list: [
                  {
                    id: "contact-1",
                    name: "Anonymous visitor",
                    bestIdentifier: "Session continuity only",
                    mostRecentActivityAt: "2026-04-14T09:03:55.000Z",
                    sources: ["chat"],
                    counts: { messages: 1 },
                    timeline: [
                      {
                        at: "2026-04-14T09:03:55.000Z",
                        label: "Visitor message",
                        summary: "Fresh live question",
                      },
                    ],
                  },
                ],
                summary: {
                  totalContacts: 1,
                },
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
  });

  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  await harness.refreshAgentInstallState("agent-1", { forceSync: true });

  assert.ok(calls.some((call) => call.startsWith("/agents/install-status?")));
  assert.ok(calls.some((call) => call.startsWith("/agents/messages?")));
  assert.ok(calls.some((call) => call.startsWith("/agents/action-queue?")));
  assert.ok(calls.some((call) => call.includes("/agents/operator-workspace?") && call.includes("force_sync=true")));
  assert.match(harness.document.getElementById("dashboard-root").innerHTML, /Asked for help choosing a next step/);
  assert.doesNotMatch(harness.document.getElementById("dashboard-root").innerHTML, /<p class="customer-row-summary">Fresh live question<\/p>/);
  assert.match(harness.document.getElementById("dashboard-root").innerHTML, /Guest visitor/);
});

test("background dashboard refresh does not render the full preparing workspace screen after boot", async () => {
  const agent = createDashboardUiStateAgent();
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: createDashboardUiStateFetch(agent),
  });

  harness.window.location.hash = "#front-desk/customization/voice";
  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  const beforeRefresh = harness.document.getElementById("dashboard-root").innerHTML;
  assert.match(beforeRefresh, /dashboard-v2-shell/);
  assert.doesNotMatch(beforeRefresh, /Preparing your workspace/);
  assert.equal(harness._getDashboardRuntimeState().hasBooted, true);

  await harness.refreshDashboardInBackground({
    agentId: "agent-1",
    activeAction: "settings-save",
  });

  const afterRefresh = harness.document.getElementById("dashboard-root").innerHTML;
  assert.match(afterRefresh, /dashboard-v2-shell/);
  assert.doesNotMatch(afterRefresh, /Preparing your workspace/);
  assertSettingsFrontDeskTabActive(afterRefresh, "voice");
  assert.deepEqual(JSON.parse(JSON.stringify(harness._getDashboardRuntimeState())), {
    hasBooted: true,
    isBootLoading: false,
    isBackgroundRefreshing: false,
    activeAction: null,
  });
});

test("dashboard action handlers use background refresh instead of boot loader reloads", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");
  const frontDeskScript = readFileSync(path.join(repoRoot, "frontend", "dashboardFrontDesk.js"), "utf8");
  const saveAssistantSource = dashboardScript.match(/async function saveAssistant[\s\S]*?\n}\n\nasync function copyInstallCode/)?.[0] || "";
  const sharedEventsSource = dashboardScript.match(/function bindSharedDashboardEvents[\s\S]*?\n}\n\nasync function boot/)?.[0] || "";
  const frontDeskEventsSource = frontDeskScript.match(/function bindFrontDeskEvents[\s\S]*?\n\s*return \{\n\s*getApprovedAnswerItems/)?.[0] || "";

  assert.match(saveAssistantSource, /refreshDashboardInBackground/);
  assert.doesNotMatch(saveAssistantSource, /await boot\(\)/);
  assert.match(sharedEventsSource, /refreshDashboardInBackground/);
  assert.doesNotMatch(sharedEventsSource, /await boot\(\)/);
  assert.match(frontDeskEventsSource, /refreshDashboard/);
  assert.doesNotMatch(frontDeskEventsSource, /await boot\(\)/);
});

test("Front Desk customization subtabs survive workspace refresh and nested hashes", async () => {
  const agent = createDashboardUiStateAgent();
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: createDashboardUiStateFetch(agent),
  });

  harness.window.location.hash = "#front-desk/customization/voice";
  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "voice");

  await harness.refreshAgentInstallState("agent-1");
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "voice");

  harness.window.location.hash = "#front-desk/customization/full-page-assistant";
  harness.setDashboardUiStateValue("settingsFrontDeskTab", "full-page-assistant");
  await harness.refreshAgentInstallState("agent-1");
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "full_page");

  harness.window.location.hash = "#front-desk/customization/routing";
  harness.setDashboardUiStateValue("settingsFrontDeskTab", "routing");
  await harness.refreshAgentInstallState("agent-1");
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "routing");

  harness.window.location.hash = "#front-desk/customization/optional-widget";
  harness.setDashboardUiStateValue("settingsFrontDeskTab", "optional-widget");
  await harness.refreshAgentInstallState("agent-1");
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "appearance");
});

test("Settings Front Desk routing renders booking provider status", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const agent = createDashboardUiStateAgent({
    bookingUrl: "https://calendly.com/acme/demo",
    bookingIntegrationStatus: {
      provider: "calendly",
      status: "active",
      state: "connected",
      webhookConnected: true,
    },
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key",
      bookingProvider: "calendly",
    },
  });

  harness.window.location.hash = "#front-desk/customization/routing";
  harness.setDashboardUiStateValue("settingsFrontDeskTab", "routing");
  const settingsPanel = harness.window.VonzaSettingsShell.buildFrontDeskSettingsForm({
    agent,
    setup: {},
    operatorWorkspace: harness.createEmptyOperatorWorkspace(),
  });

  assert.match(settingsPanel, /Booking provider/);
  assert.match(settingsPanel, /Manual booking link/);
  assert.match(settingsPanel, /Calendly/);
  assert.match(settingsPanel, /value="calendly" selected/);
  assert.match(settingsPanel, /Calendly link connected/);
  assert.match(settingsPanel, /Webhook connected/);
  assert.match(settingsPanel, /https:\/\/calendly\.com\/acme\/demo/);
  assert.doesNotMatch(settingsPanel, /webhook-secret|calendly-webhook-secret|secret-encryption|whsec/i);
});

test("Settings Front Desk routing renders Calendly webhook missing status without secrets", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  const agent = createDashboardUiStateAgent({
    bookingUrl: "https://calendly.com/acme/demo",
    bookingIntegrationStatus: {
      provider: "calendly",
      status: "pending",
      state: "not_connected",
      webhookConnected: false,
    },
    fullPageConfig: {
      publicPageEnabled: true,
      publicPageKey: "page-key",
      bookingProvider: "calendly",
    },
  });

  harness.window.location.hash = "#front-desk/customization/routing";
  harness.setDashboardUiStateValue("settingsFrontDeskTab", "routing");
  const settingsPanel = harness.window.VonzaSettingsShell.buildFrontDeskSettingsForm({
    agent,
    setup: {},
    operatorWorkspace: harness.createEmptyOperatorWorkspace(),
  });

  assert.match(settingsPanel, /Calendly link connected/);
  assert.match(settingsPanel, /Webhook not connected/);
  assert.doesNotMatch(settingsPanel, /webhook-secret|calendly-webhook-secret|secret-encryption|whsec/i);
});

test("Install selected method survives install status refresh and nested hashes", async () => {
  const agent = createDashboardUiStateAgent();
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: createDashboardUiStateFetch(agent),
  });

  harness.window.location.hash = "#install/full-page";
  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assertInstallMethodActive(harness.document.getElementById("dashboard-root").innerHTML, "page");

  await harness.refreshAgentInstallState("agent-1");
  assertInstallMethodActive(harness.document.getElementById("dashboard-root").innerHTML, "page");

  harness.window.location.hash = "#install/qr";
  harness.setDashboardUiStateValue("installMethod", "qr");
  await harness.refreshAgentInstallState("agent-1");
  assertInstallMethodActive(harness.document.getElementById("dashboard-root").innerHTML, "qr");

  harness.window.location.hash = "#install/widget";
  harness.setDashboardUiStateValue("installMethod", "widget");
  await harness.refreshAgentInstallState("agent-1");
  assertInstallMethodActive(harness.document.getElementById("dashboard-root").innerHTML, "widget");
});

test("invalid nested dashboard hashes fall back without breaking default UI state", () => {
  const agent = createDashboardUiStateAgent();
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.window.location.hash = "#front-desk/customization/not-a-tab";
  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assertSettingsFrontDeskTabActive(harness.document.getElementById("dashboard-root").innerHTML, "identity");

  harness.window.location.hash = "#install/not-a-method";
  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );
  assertInstallMethodActive(harness.document.getElementById("dashboard-root").innerHTML, "page");
});

test("dashboard refresh buttons use the full live reload path", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /refreshAgentInstallState\(agent\.id,\s*\{\s*forceSync\s*\}\)/);
});

test("dashboard coalesces partial workspace failures without blanking the shell", () => {
  const harness = createDashboardHarness();

  const state = harness.coalesceWorkspaceLoadState({
    messagesResult: {
      status: "fulfilled",
      value: [{ id: "message-1", content: "Hello" }],
    },
    actionQueueResult: {
      status: "rejected",
      reason: new Error("queue failed"),
    },
    operatorResult: {
      status: "fulfilled",
      value: harness.createEmptyOperatorWorkspace(),
    },
  });

  assert.equal(state.messages.length, 1);
  assert.equal(Array.isArray(state.actionQueue.items), true);
  assert.equal(state.operatorWorkspace.health.globalError, "");
  assert.equal(state.hasPartialFailure, true);
});

test("dashboard help assistant stays out of the dashboard shell for now", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    publicAgentKey: "public-key",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "limited",
    },
    installStatus: {
      state: "not_installed",
    },
  };

  harness.renderSetupState(
    agent,
    [],
    harness.inferSetup(agent),
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  const rootMarkup = harness.document.getElementById("dashboard-root").innerHTML;

  assert.doesNotMatch(rootMarkup, /Ask Vonza/);
  assert.doesNotMatch(rootMarkup, /AI guide and support inside the app/);
  assert.doesNotMatch(rootMarkup, /data-dashboard-help/);
  assert.doesNotMatch(rootMarkup, /data-help-toggle/);
  assert.doesNotMatch(rootMarkup, /dashboard-help-drawer/);
});

test("dashboard help prompt chips submit real AI questions instead of canned answers", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /await submitDashboardHelpQuestion\(button\.dataset\.helpPrompt \|\| ""\);/);
  assert.match(dashboardScript, /fetchJson\("\/agents\/product-help"/);
  assert.doesNotMatch(dashboardScript, /data-help-answer/);
  assert.doesNotMatch(dashboardScript, /buildDashboardHelpFallbackAnswer/);
});

test("dashboard help shows a clean explicit fallback when AI support fails", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /DASHBOARD_HELP_UNAVAILABLE_MESSAGE = "I couldn't load Vonza help right now\. Please try again\."/);
  assert.match(dashboardScript, /content: DASHBOARD_HELP_UNAVAILABLE_MESSAGE/);
  assert.doesNotMatch(dashboardScript, /I couldn't load a Vonza help answer just yet/);
});
