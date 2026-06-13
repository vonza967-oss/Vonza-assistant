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
  assert.equal(analytics.getAnalyticsSourceLabel("widget_chat"), "Website Agent");
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
    "Website Agent",
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
      webCallHealth: {
        starts: 2,
        endedCalls: 1,
        averageDurationSeconds: 62,
        averageTurns: 2,
        contactFallbackSubmissions: 1,
        failureCategories: [
          { category: "garbled_transcript", label: "Garbled transcript", count: 1 },
        ],
        failureTotal: 1,
        latestActivityAt: "2026-05-20T11:00:05.000Z",
        transcriptText: "I need a quote",
        assistantReplyText: "Sure, I can help.",
        contactEmail: "lead@example.com",
        speechToken: "token-123",
      },
      webCallRecentCalls: {
        available: true,
        total: 1,
        calls: [
          {
            id: "call-1",
            webCallId: "call-1",
            latestActivityAt: "2026-05-20T11:00:05.000Z",
            turnCount: 2,
            durationSeconds: 62,
            contactFallbackOpened: true,
            contactFallbackSubmitted: true,
            hadFailures: true,
            failureCategories: ["garbled_transcript"],
            failureCategoryLabels: ["Garbled transcript"],
            conversationSource: "web_call",
            actionKey: "web_call_review:call-1",
            review: {
              status: "reviewed",
              followUpNeeded: true,
            },
            messages: [
              {
                id: "message-question",
                role: "user",
                content: "I need a quote",
                createdAt: "2026-05-20T11:00:01.000Z",
              },
              {
                id: "message-1",
                role: "assistant",
                content: "Sure, I can help.",
                createdAt: "2026-05-20T11:00:03.000Z",
              },
            ],
            latestQuestion: "I need a quote",
            latestAnswer: "Sure, I can help.",
            latestAssistantMessageId: "message-1",
            action: {
              type: "conversation",
              label: "Open related conversation",
              messageId: "message-1",
            },
            transcriptText: "I need a quote",
            contactEmail: "lead@example.com",
          },
        ],
      },
    },
    [{ label: "Booking availability", count: 2 }],
    [{ createdAt: "2026-05-22T10:00:00Z" }],
    createRenderOptions()
  );

  assert.match(markup, /Total conversations/);
  assert.match(markup, />6</);
  assert.match(markup, /Website Agent/);
  assert.match(markup, /Front Desk page/);
  assert.match(markup, /Web Call/);
  assert.match(markup, /Embedded assistant/);
  assert.match(markup, /Booking availability/);
  assert.match(markup, /Conversion rate/);
  assert.match(markup, /Web Call health/);
  assert.match(markup, /Recent Web Calls/);
  assert.match(markup, /Contact submitted/);
  assert.match(markup, /Had failures/);
  assert.match(markup, /Needs follow-up/);
  assert.match(markup, /Caller/);
  assert.match(markup, /Front Desk/);
  assert.match(markup, /I need a quote/);
  assert.match(markup, /Sure, I can help\./);
  assert.match(markup, /data-web-call-review-action="reviewed" data-action-key="web_call_review:call-1"/);
  assert.match(markup, /data-web-call-improve-answer/);
  assert.match(markup, /Practice this question/);
  assert.match(markup, /data-open-conversation data-message-id="message-1"/);
  assert.match(markup, /Starts/);
  assert.match(markup, />2</);
  assert.match(markup, /Avg\. duration/);
  assert.match(markup, /1m 02s/);
  assert.match(markup, /Garbled transcript/);
  assert.doesNotMatch(markup, /Legacy\/unknown/);
  assert.doesNotMatch(markup, /display_mode/);
  assert.doesNotMatch(markup, /lead@example\.com|token-123/i);
  assert.doesNotMatch(markup, /QR scans|QR code|QR scan analytics unavailable/i);
});

test("Product analytics view selection marks the active product tab", () => {
  const analytics = loadAnalyticsModule();
  const markup = analytics.renderAnalyticsPageFragment(
    {},
    {
      assistantSource: {
        widget: { key: "widget", conversationCount: 2, messageCount: 4, leadsCaptured: 1 },
        page: { key: "page", conversationCount: 3, messageCount: 6, leadsCaptured: 2 },
        web_call: { key: "web_call", conversationCount: 1, messageCount: 2 },
        totalConversations: 6,
      },
    },
    [],
    [],
    {
      ...createRenderOptions(),
      activeProduct: { key: "website_widget" },
    }
  );

  assert.match(markup, /data-product-analytics-view="website_widget"/);
  assert.match(markup, /data-product-analytics-tab="website_widget"[\s\S]{0,80}aria-current="page"/);
  assert.match(markup, /href="\/dashboard\/widget#analytics"/);
  assert.match(markup, /Agent conversations/);
  assert.match(markup, /2 conversations/);
  assert.match(markup, /Agent leads/);
  assert.match(markup, /1 lead/);
});

test("Product analytics cards render Front Desk, Website Agent, and Voice contexts from existing data", () => {
  const analytics = loadAnalyticsModule();
  const sourceRows = analytics.buildAssistantSourceRows({
    widget: { key: "widget", conversationCount: 2, messageCount: 4, leadsCaptured: 1 },
    page: { key: "page", conversationCount: 3, messageCount: 6, leadsCaptured: 2 },
    web_call: { key: "web_call", conversationCount: 4, messageCount: 8, leadsCaptured: 1 },
  });
  const ownerAnalyticsDashboard = {
    assistantSource: {
      widget: { key: "widget" },
      page: { key: "page" },
      web_call: { key: "web_call" },
    },
    webCallHealth: {
      available: true,
      starts: 5,
      averageDurationSeconds: 62,
    },
  };

  const frontDesk = analytics.renderProductAnalyticsSection(sourceRows, ownerAnalyticsDashboard, {
    ...createRenderOptions(),
    activeProduct: "front_desk",
  });
  const widget = analytics.renderProductAnalyticsSection(sourceRows, ownerAnalyticsDashboard, {
    ...createRenderOptions(),
    activeProduct: "website_widget",
  });
  const voice = analytics.renderProductAnalyticsSection(sourceRows, ownerAnalyticsDashboard, {
    ...createRenderOptions(),
    activeProduct: "voice_agent",
  });

  assert.match(frontDesk, /Front Desk conversations/);
  assert.match(frontDesk, /3 conversations/);
  assert.match(frontDesk, /Front Desk leads/);
  assert.match(frontDesk, /2 leads/);
  assert.match(frontDesk, /Front Desk visit analytics are not available/);
  assert.match(frontDesk, /#install\/full-page/);

  assert.match(widget, /Agent conversations/);
  assert.match(widget, /2 conversations/);
  assert.match(widget, /Agent open and install-event analytics are not available/);
  assert.match(widget, /#install\/embed/);

  assert.match(voice, /Web Call sessions/);
  assert.match(voice, /4 conversations/);
  assert.match(voice, /Web Call starts/);
  assert.match(voice, />5</);
  assert.match(voice, /Average call duration/);
  assert.match(voice, /1m 02s/);
  assert.match(voice, /#settings\/voice\/voice/);
  assert.doesNotMatch(voice, /phone|telephony/i);
});

test("Product analytics unavailable metrics do not render undefined values as numbers", () => {
  const analytics = loadAnalyticsModule();
  const markup = analytics.renderProductAnalyticsSection([], null, {
    ...createRenderOptions(),
    activeProduct: "voice",
  });

  assert.match(markup, /data-product-analytics-view="voice_agent"/);
  assert.match(markup, /Not available yet/);
  assert.match(markup, /data-product-analytics-state="unavailable"/);
  assert.doesNotMatch(markup, /undefined|NaN/);
  assert.doesNotMatch(markup, /product-analytics-card-value">0</);
});

test("Product analytics empty states render product-specific setup guidance", () => {
  const analytics = loadAnalyticsModule();
  const options = createRenderOptions();
  const frontDesk = analytics.renderProductAnalyticsSection([], null, {
    ...options,
    activeProduct: "front_desk",
  });
  const widget = analytics.renderProductAnalyticsSection([], null, {
    ...options,
    activeProduct: "website_widget",
  });
  const voice = analytics.renderProductAnalyticsSection([], null, {
    ...options,
    activeProduct: "voice_agent",
  });

  assert.match(frontDesk, /No Front Desk analytics yet\./);
  assert.match(frontDesk, /full-page Front Desk/);
  assert.match(frontDesk, /href="#install\/full-page"/);
  assert.match(frontDesk, /href="#settings\/front-desk\/full-page-assistant"/);

  assert.match(widget, /No Website Agent analytics yet\./);
  assert.match(widget, /Install the embed/);
  assert.match(widget, /href="#install\/embed"/);
  assert.match(widget, /href="#settings\/widget\/optional-widget"/);

  assert.match(voice, /No Voice Agent analytics yet\./);
  assert.match(voice, /browser voice and Web Call/);
  assert.match(voice, /transcripts, handoff context, and analytics/);
  assert.match(voice, /href="#settings\/voice\/voice"/);
  assert.doesNotMatch(voice, /phone|telephony/i);
  assert.doesNotMatch(`${frontDesk}${widget}${voice}`, /data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Website Agent|Buy Front Desk/);
});
