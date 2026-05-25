import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dashboardAnalyticsScript = readFileSync(path.join(repoRoot, "frontend", "dashboardAnalytics.js"), "utf8");

function loadAnalyticsModule() {
  const context = {
    window: {},
    Intl,
    Date,
  };
  vm.runInNewContext(dashboardAnalyticsScript, context, { filename: "frontend/dashboardAnalytics.js" });
  return context.window.VonzaDashboardAnalytics;
}

function createRenderOptions() {
  return {
    renderIcon(name = "") {
      return `<svg data-icon="${name}"></svg>`;
    },
    renderIconBadge(name = "", tone = "blue") {
      return `<span class="v2-icon-badge ${tone}" data-icon="${name}"></span>`;
    },
    renderButton(label = "") {
      return `<button class="v2-button" type="button">${label}</button>`;
    },
  };
}

test("Analytics module namespace loads", () => {
  const analytics = loadAnalyticsModule();

  assert.equal(typeof analytics, "object");
  assert.equal(typeof analytics.renderAnalyticsPageFragment, "function");
});

test("Analytics source labels map owner-facing sources", () => {
  const analytics = loadAnalyticsModule();

  assert.equal(analytics.getAnalyticsSourceLabel("page"), "Front Desk page");
  assert.equal(analytics.getAnalyticsSourceLabel("full_page_assistant"), "Front Desk page");
  assert.equal(analytics.getAnalyticsSourceLabel("web_call"), "Web Call");
  assert.equal(analytics.getAnalyticsSourceLabel("widget_chat"), "Website widget");
  assert.equal(analytics.getAnalyticsSourceLabel("embedded_assistant"), "Embedded assistant");
  assert.equal(analytics.normalizeAnalyticsSource("display_mode"), "unknown");
});

test("Analytics unknown and legacy source mapping stays explicit", () => {
  const analytics = loadAnalyticsModule();

  assert.equal(analytics.getAnalyticsSourceLabel("legacy"), "Legacy/unknown");
  assert.equal(analytics.getAnalyticsSourceLabel(null), "Legacy/unknown");
  assert.match(analytics.getAnalyticsSourceDescription("legacy"), /Older activity/);
});

test("Analytics metric formatting is stable", () => {
  const analytics = loadAnalyticsModule();

  assert.equal(analytics.formatMetricValue(1234.4), "1,234");
  assert.equal(analytics.formatMetricDelta(12), "+12%");
  assert.equal(analytics.formatConversationCount(1), "1 conversation");
  assert.equal(analytics.formatMessageCount(2), "2 messages");
  assert.equal(analytics.formatLeadCount(3), "3 leads");
});

test("Analytics assistant source rows include real sources and hide empty legacy", () => {
  const analytics = loadAnalyticsModule();
  const rows = analytics.buildAssistantSourceRows({
    widget: { key: "widget", conversationCount: 2, messageCount: 4, leadsCaptured: 1 },
    page: { key: "page", conversationCount: 3, messageCount: 5 },
    web_call: { key: "web_call", conversationCount: 1, messageCount: 2 },
    embedded: { key: "embedded", conversationCount: 1, messageCount: 2 },
    unknown: { key: "unknown", conversationCount: 0, messageCount: 0 },
  });

  assert.equal(JSON.stringify(rows.map((row) => row.label)), JSON.stringify([
    "Website widget",
    "Front Desk page",
    "Web Call",
    "Embedded assistant",
  ]));
  assert.equal(rows.find((row) => row.key === "widget").leadsCaptured, 1);
  assert.equal(rows.some((row) => row.key === "unknown"), false);
});

test("Analytics assistant source rows render legacy only when data exists", () => {
  const analytics = loadAnalyticsModule();
  const rows = analytics.buildAssistantSourceRows({
    unknown: { key: "unknown", conversationCount: 1, messageCount: 1 },
  });

  assert.ok(rows.some((row) => row.label === "Legacy/unknown"));
});

test("Analytics empty state and top question rendering are safe", () => {
  const analytics = loadAnalyticsModule();
  const emptyMarkup = analytics.renderAnalyticsEmptyState("No live analytics yet.");
  const questionsMarkup = analytics.renderTopQuestionsList([
    { label: "<Pricing question>", count: 2 },
  ], createRenderOptions());

  assert.match(emptyMarkup, /placeholder-card/);
  assert.match(emptyMarkup, /No live analytics yet\./);
  assert.match(questionsMarkup, /Top customer questions/);
  assert.match(questionsMarkup, /&lt;Pricing question&gt;/);
  assert.doesNotMatch(questionsMarkup, /<Pricing question>/);
});

test("Analytics page fragment preserves real values without QR or raw display mode labels", () => {
  const analytics = loadAnalyticsModule();
  const markup = analytics.renderAnalyticsPageFragment(
    {
      conversationCount: 6,
      autonomousHandledCount: 4,
      autonomousHandledRate: 67,
      contactsCaptured: 3,
      conversionRate: 50,
      estimatedHoursSaved: 1.5,
      guestUsers: 1,
      identifiedUsers: 2,
      emailUsers: 1,
      contactMixCopy: "Vonza is turning a healthy share of conversations into known customer records.",
      conversationSeries: {
        values: [1, 2, 3],
        labels: ["May 20", "May 21", "May 22"],
      },
    },
    {
      assistantSource: {
        widget: { key: "widget", conversationCount: 2, messageCount: 5, leadsCaptured: 1 },
        page: { key: "page", conversationCount: 3, messageCount: 7, leadsCaptured: 2 },
        web_call: { key: "web_call", conversationCount: 1, messageCount: 2, leadsCaptured: 0 },
        embedded: { key: "embedded", conversationCount: 1, messageCount: 2, leadsCaptured: 0 },
        unknown: { key: "display_mode", conversationCount: 0, messageCount: 0 },
        totalConversations: 7,
      },
    },
    [{ label: "Booking availability", count: 2 }],
    [{ createdAt: "2026-05-22T10:00:00Z" }],
    createRenderOptions()
  );

  assert.match(markup, /Total conversations/);
  assert.match(markup, />6</);
  assert.match(markup, /Website widget/);
  assert.match(markup, /Front Desk page/);
  assert.match(markup, /Web Call/);
  assert.match(markup, /Embedded assistant/);
  assert.match(markup, /Booking availability/);
  assert.match(markup, /Conversion rate/);
  assert.doesNotMatch(markup, /Legacy\/unknown/);
  assert.doesNotMatch(markup, /display_mode/);
  assert.doesNotMatch(markup, /QR scans|QR code|QR scan analytics unavailable/i);
});
