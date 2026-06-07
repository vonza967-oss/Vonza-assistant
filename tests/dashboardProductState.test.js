import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { listPublicBillingPlans } from "../src/config/billingPlans.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadDashboardState(pathname = "/dashboard") {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboardState.js"), "utf8");
  const document = {
    documentElement: {
      dataset: {},
    },
  };
  const context = {
    window: {
      document,
      location: {
        pathname,
      },
    },
    document,
    URLSearchParams,
    Object,
  };

  vm.runInNewContext(script, context, { filename: "frontend/dashboardState.js" });
  return {
    document,
    state: context.window.VonzaDashboardState,
  };
}

function renderAccountBillingSettings({
  agent = { accessStatus: "active" },
  operatorWorkspace = {},
} = {}) {
  const dashboardStateScript = readFileSync(path.join(repoRoot, "frontend", "dashboardState.js"), "utf8");
  const settingsShellScript = readFileSync(path.join(repoRoot, "frontend", "settings", "SettingsShell.js"), "utf8");
  const storage = new Map([["vonza_dashboard_settings_section", "account_billing"]]);
  const document = {
    documentElement: {
      dataset: {},
    },
  };
  const context = {
    window: {
      document,
      location: {
        hash: "",
        href: "http://127.0.0.1:3000/dashboard#settings/account-billing",
        pathname: "/dashboard",
      },
      localStorage: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
          storage.set(key, String(value));
        },
      },
      sessionStorage: {
        getItem() {
          return null;
        },
        setItem() {},
      },
    },
    document,
    URL,
    URLSearchParams,
    Object,
  };

  vm.runInNewContext(dashboardStateScript, context, { filename: "frontend/dashboardState.js" });
  vm.runInNewContext(settingsShellScript, context, { filename: "frontend/settings/SettingsShell.js" });

  return context.window.VonzaSettingsShell.buildSettingsPanel({
    agent,
    setup: {},
    operatorWorkspace,
    authUser: {
      email: "owner@example.com",
    },
  });
}

test("dashboard product context resolves exact dashboard entry paths", () => {
  const { state } = loadDashboardState();

  assert.equal(state.getDashboardProductContext("/dashboard").key, "front_desk");
  assert.equal(state.getDashboardProductContext("/dashboard/front-desk").key, "front_desk");
  assert.equal(state.getDashboardProductContext("/dashboard/widget").key, "website_widget");
  assert.equal(state.getDashboardProductContext("/dashboard/voice").key, "voice_agent");
  assert.equal(state.getDashboardProductContext("/website-widget/dashboard").key, "website_widget");
  assert.equal(state.getDashboardProductContext("/widget/dashboard").key, "website_widget");
  assert.equal(state.getDashboardProductContext("/website-widget/dashboard").isDedicatedProductDashboard, true);
  assert.equal(state.getDashboardProductContext("/widget/dashboard").canonicalPath, "/website-widget/dashboard");
});

test("dashboard analytics API path is not treated as a product route", () => {
  const { state } = loadDashboardState();
  const context = state.getDashboardProductContext("/dashboard/analytics");

  assert.equal(context.key, "front_desk");
  assert.equal(context.routeSegment, "analytics");
  assert.equal(context.isKnownProductPath, false);
});

test("dashboard product links resolve to exact aliases", () => {
  const { state } = loadDashboardState();

  assert.equal(state.getDashboardProductRoutePath("front_desk"), "/dashboard/front-desk");
  assert.equal(state.getDashboardProductRoutePath("widget"), "/dashboard/widget");
  assert.equal(state.getDashboardProductRoutePath("voice"), "/dashboard/voice");

  const links = state.getDashboardProductNavItems("/dashboard/widget").map((item) => item.routePath);
  assert.deepEqual(links, ["/dashboard/front-desk", "/dashboard/widget", "/dashboard/voice"]);
});

test("product packaging metadata exists for all commercial product keys", () => {
  const { state } = loadDashboardState();
  const products = state.listDashboardProductPackaging();

  assert.deepEqual(products.map((product) => product.key), ["front_desk", "website_widget", "voice_agent"]);
  assert.deepEqual(products.map((product) => product.name), ["Front Desk", "Website Widget", "Voice Agent"]);
  assert.deepEqual(products.map((product) => product.setupHref), ["/dashboard/front-desk#setup", "/dashboard/widget#setup", "/dashboard/voice#setup"]);
  assert.deepEqual(products.map((product) => product.setupLabel), ["Open Front Desk setup", "Open widget setup", "Open Web Call setup"]);
  assert.match(products.find((product) => product.key === "front_desk").targetUseCase, /full-page AI Front Desk/);
  assert.match(products.find((product) => product.key === "website_widget").targetUseCase, /Embedded website snippet and launcher/);
  assert.match(products.find((product) => product.key === "voice_agent").targetUseCase, /Browser voice, spoken replies, and Web Call/);
  products.forEach((product) => {
    assert.equal(product.pricingLabel, "Product pricing coming soon");
    assert.equal(product.availabilitySource, "account_access");
    assert.ok(product.targetUseCase.length > 20);
  });
});

test("product home context exists for all dashboard product keys", () => {
  const { state } = loadDashboardState();
  const contexts = ["front_desk", "website_widget", "voice_agent"].map((key) =>
    state.getDashboardProductHomeContext(key)
  );

  assert.deepEqual(contexts.map((context) => context.key), ["front_desk", "website_widget", "voice_agent"]);
  contexts.forEach((context) => {
    assert.ok(context.homeTitle.length > 8);
    assert.ok(context.homeSubtitle.length > 20);
    assert.ok(context.statusKicker.length > 8);
    assert.ok(context.sidebarNote.length > 20);
    assert.ok(context.quickActions.length >= 4);
    assert.ok(context.shortcuts.length >= 5);
    assert.ok(context.previewActionLabel.length > 4);
    assert.ok(context.analyticsLinkLabel.length > 4);
    assert.ok(context.metricLabels.empty.length > 20);
  });
});

test("product setup context exists for distinct setup experiences", () => {
  const { state } = loadDashboardState();
  const frontDesk = state.getDashboardProductSetupContext("front_desk");
  const widget = state.getDashboardProductSetupContext("website_widget");
  const voice = state.getDashboardProductSetupContext("voice_agent");
  const voiceCopy = JSON.stringify(voice);

  assert.equal(frontDesk.title, "Set up Front Desk");
  assert.equal(widget.title, "Set up Website Widget");
  assert.equal(voice.title, "Set up Voice Agent");
  assert.match(JSON.stringify(frontDesk), /Business identity|Knowledge\/training|QR\/direct link|Preview\/test assistant/);
  assert.match(JSON.stringify(widget), /Widget appearance|Allowed domains|Embed\/install snippet|Install verification|Test widget|Widget analytics\/conversations/);
  assert.match(voiceCopy, /Browser voice\/Web Call readiness|Voice\/personality settings|Spoken replies|Routing\/contact handoff|Test Web Call|Web Call analytics\/transcripts/);
  assert.doesNotMatch(voiceCopy, /telephony|phone/i);
});

test("product home context points widget and voice at safe existing surfaces", () => {
  const { state } = loadDashboardState();
  const frontDesk = state.getDashboardProductHomeContext("front_desk");
  const widget = state.getDashboardProductHomeContext("widget");
  const voice = state.getDashboardProductHomeContext("voice");
  const frontDeskLinks = JSON.stringify(frontDesk);
  const widgetLinks = JSON.stringify(widget);
  const voiceCopy = JSON.stringify(voice);

  assert.match(frontDeskLinks, /Publish\/open full-page/);
  assert.match(frontDeskLinks, /QR\/direct link/);
  assert.match(frontDeskLinks, /#install\/full-page/);
  assert.match(frontDeskLinks, /#settings\/front-desk\/full-page-assistant/);
  assert.match(frontDeskLinks, /Business identity/);
  assert.match(frontDeskLinks, /Knowledge\/training/);
  assert.match(frontDeskLinks, /Routing\/contact capture/);
  assert.match(frontDeskLinks, /Preview\/test assistant/);
  assert.match(widgetLinks, /#install\/embed/);
  assert.match(widgetLinks, /#settings\/widget\/optional-widget/);
  assert.match(widgetLinks, /Embed\/install snippet/);
  assert.match(widgetLinks, /Allowed domains\/status/);
  assert.match(widgetLinks, /Launcher behavior/);
  assert.match(widgetLinks, /Test widget/);
  assert.match(widgetLinks, /Widget analytics/);
  assert.match(voiceCopy, /browser\/Web Call|Web Call|browser voice/);
  assert.match(voiceCopy, /Voice\/personality settings/);
  assert.match(voiceCopy, /Spoken replies readiness/);
  assert.match(voiceCopy, /Test voice agent/);
  assert.match(voiceCopy, /#settings\/voice\/voice/);
  assert.doesNotMatch(voiceCopy, /telephony|phone/i);
});

test("existing billing plan keys remain account capacity plans", () => {
  const plans = listPublicBillingPlans();

  assert.deepEqual(plans.map((plan) => plan.key), ["starter", "growth", "pro"]);
  assert.deepEqual(plans.map((plan) => plan.checkoutLabel), ["Start with Starter", "Start with Growth", "Start with Pro"]);
  assert.deepEqual(plans.map((plan) => plan.displayName), ["Starter", "Growth", "Pro"]);
  plans.forEach((plan) => {
    assert.match(plan.marketing.capacityLabel, /monthly AI capacity/i);
    assert.ok(plan.sharedFeatures.includes("Monthly AI usage included"));
  });
});

test("billing product packaging cards render without product checkout controls", () => {
  const shellScript = readFileSync(path.join(repoRoot, "frontend", "settings", "SettingsShell.js"), "utf8");

  assert.match(shellScript, /data-product-packaging-section/);
  assert.match(shellScript, /data-product-packaging-card="\$\{escapeHtml\(product\.key\)\}"/);
  assert.match(shellScript, /data-product-packaging-link="\$\{escapeHtml\(product\.key\)\}"/);
  assert.match(shellScript, /Product pricing is being separated\. Current billing remains account-level plan capacity\./);
  assert.match(shellScript, /data-billing-plan-key="\$\{escapeHtml\(plan\.planKey\)\}"/);
  assert.doesNotMatch(shellScript, /Buy Voice Agent|Buy Website Widget|Buy Front Desk|data-product-checkout|data-product-plan-key/);
});

test("frontend product cards tolerate missing availability data", () => {
  const html = renderAccountBillingSettings({
    agent: {
      accessStatus: "active",
    },
    operatorWorkspace: {
      billing: {
        planKey: "starter",
        displayName: "Starter",
        monthlyPriceLabel: "$20/month",
        subscriptionStatus: "active",
        hasActiveSubscription: true,
        usage: {
          percentUsed: 10,
          tone: "ok",
          statusLabel: "Within the included monthly capacity",
          isCapped: false,
        },
        upgradeOptions: [],
      },
    },
  });

  assert.match(html, /data-product-packaging-card="front_desk"/);
  assert.match(html, /data-product-packaging-card="website_widget"/);
  assert.match(html, /data-product-packaging-card="voice_agent"/);
  assert.match(html, /Included in current workspace/);
  assert.doesNotMatch(html, /data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Website Widget|Buy Front Desk/);
});

test("frontend product cards read canonical product availability when present", () => {
  const html = renderAccountBillingSettings({
    agent: {
      accessStatus: "active",
    },
    operatorWorkspace: {
      product_availability: [
        {
          product_key: "front_desk",
          status: "available",
          reason_code: "account_access_active",
          is_enforced: false,
        },
        {
          product_key: "website_widget",
          status: "pending_account_access",
          reason_code: "account_access_pending",
          is_enforced: false,
        },
        {
          product_key: "voice_agent",
          status: "unavailable",
          reason_code: "account_capacity_capped",
          is_enforced: false,
        },
      ],
    },
  });

  assert.match(html, /data-product-availability-status="available"/);
  assert.match(html, /data-product-availability-status="pending_account_access"/);
  assert.match(html, /data-product-availability-status="unavailable"/);
  assert.match(html, /Included in current workspace/);
  assert.match(html, /Account access pending/);
  assert.match(html, /Product availability: Account Access Active/);
  assert.match(html, /Product availability: Account Capacity Capped/);
  assert.match(html, /data-product-availability-enforced="false"/);
  assert.doesNotMatch(html, /data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Website Widget|Buy Front Desk/);
});

test("frontend product cards prefer product entitlement labels when present", () => {
  const html = renderAccountBillingSettings({
    agent: {
      accessStatus: "active",
    },
    operatorWorkspace: {
      product_availability: [
        {
          product_key: "front_desk",
          status: "unavailable",
          reason_code: "account_capacity_capped",
          is_enforced: false,
        },
      ],
      product_entitlements: [
        {
          product_key: "front_desk",
          status: "available",
          entitlement_status: "active",
          entitlement_source: "workspace_plan",
          entitlement_row_exists: true,
          is_enforced: false,
        },
        {
          product_key: "website_widget",
          status: "available",
          entitlement_status: "grandfathered",
          entitlement_source: "legacy_workspace_plan",
          entitlement_row_exists: true,
          is_enforced: false,
        },
        {
          product_key: "voice_agent",
          status: "available",
          entitlement_status: "beta",
          entitlement_source: "manual_beta",
          entitlement_row_exists: true,
          is_enforced: false,
        },
      ],
    },
  });

  assert.match(html, /Included with current workspace/);
  assert.match(html, /Grandfathered/);
  assert.match(html, /Beta/);
  assert.match(html, /Product entitlement: Workspace Plan/);
  assert.match(html, /data-product-entitlement-status="active"/);
  assert.match(html, /data-product-entitlement-status="grandfathered"/);
  assert.match(html, /data-product-entitlement-status="beta"/);
  assert.match(html, /data-product-entitlement-row-exists="true"/);
  assert.match(html, /data-product-availability-enforced="false"/);
  assert.doesNotMatch(html, /data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Website Widget|Buy Front Desk/);
});

test("missing entitlement rows stay read-only and do not block product setup links", () => {
  const html = renderAccountBillingSettings({
    agent: {
      accessStatus: "active",
    },
    operatorWorkspace: {
      product_entitlements: [
        {
          product_key: "front_desk",
          status: "available",
          entitlement_status: "free",
          entitlement_source: "manual_free",
          entitlement_row_exists: true,
          is_enforced: false,
        },
      ],
    },
  });

  assert.match(html, /Free/);
  assert.match(html, /Missing entitlement record/);
  assert.match(html, /data-product-entitlement-status="free"/);
  assert.match(html, /data-product-entitlement-status="missing"/);
  assert.match(html, /data-product-entitlement-row-exists="false"/);
  assert.match(html, /href="\/dashboard\/front-desk#setup" data-product-packaging-link="front_desk"/);
  assert.match(html, /href="\/dashboard\/widget#setup" data-product-packaging-link="website_widget"/);
  assert.match(html, /href="\/dashboard\/voice#setup" data-product-packaging-link="voice_agent"/);
  assert.match(html, /Product pricing coming soon/);
  assert.doesNotMatch(html, /data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Website Widget|Buy Front Desk|checkout_url/);
});

test("operator workspace account response exposes additive product availability and entitlements", () => {
  const source = readFileSync(path.join(repoRoot, "src", "services", "operator", "operatorWorkspaceService.js"), "utf8");

  assert.match(source, /import \{ listProductAvailability \} from "\.\.\/entitlements\/productAvailabilityService\.js";/);
  assert.match(source, /listOwnerProductEntitlements/);
  assert.match(source, /buildFallbackProductEntitlements/);
  assert.match(source, /product_availability:\s*buildWorkspaceProductAvailability\(agent,\s*billing\)/);
  assert.match(source, /product_entitlements:\s*productEntitlements/);
  assert.match(source, /billing,\s*\n\s*product_availability:[\s\S]*product_entitlements:/);
  assert.doesNotMatch(source, /createHostedCheckoutSession|constructStripeWebhookEvent|changeStripeSubscriptionPlan/);
});

test("active product context drives product nav state", () => {
  const { state } = loadDashboardState("/dashboard/voice");
  const items = state.getDashboardProductNavItems("/dashboard/voice");

  assert.deepEqual(
    items.map((item) => [item.key, item.active]),
    [
      ["front_desk", false],
      ["website_widget", false],
      ["voice_agent", true],
    ]
  );
  assert.equal(state.ACTIVE_DASHBOARD_PRODUCT_CONTEXT.key, "voice_agent");
});

test("dashboard product context preserves hash routing as separate state", () => {
  const { document, state } = loadDashboardState("/dashboard/widget");
  const context = state.ACTIVE_DASHBOARD_PRODUCT_CONTEXT;
  const parts = (hash) => Array.from(state.getDashboardHashPathParts(hash));

  assert.equal(context.key, "website_widget");
  assert.equal(document.documentElement.dataset.dashboardProductContext, "website_widget");
  assert.deepEqual(parts("#front-desk/practice"), ["front-desk", "practice"]);
  assert.deepEqual(parts("#install/full-page"), ["install", "full-page"]);
  assert.deepEqual(parts("#install/embed"), ["install", "embed"]);
  assert.deepEqual(parts("#settings/front-desk/voice"), ["settings", "front-desk", "voice"]);
  assert.deepEqual(parts("#setup"), ["setup"]);
  assert.equal(state.getShellSectionFromHash("#setup", ["overview", "setup", "settings"]), "setup");
});

test("product-scoped settings hashes normalize to the right settings context", () => {
  const { state } = loadDashboardState();

  assert.equal(state.normalizeSettingsMainTab("front-desk"), "front_desk");
  assert.equal(state.normalizeSettingsMainTab("widget"), "website_widget");
  assert.equal(state.normalizeSettingsMainTab("website-widget"), "website_widget");
  assert.equal(state.normalizeSettingsMainTab("voice"), "voice_agent");
  assert.equal(state.getSettingsMainTabHashSegment("website_widget"), "widget");
  assert.equal(state.getSettingsMainTabHashSegment("voice_agent"), "voice");

  const frontDeskUpdates = state.getDashboardUiStateHashUpdates("#settings/front-desk/full-page-assistant");
  const widgetUpdates = state.getDashboardUiStateHashUpdates("#settings/widget/optional-widget");
  const voiceUpdates = state.getDashboardUiStateHashUpdates("#settings/voice/voice");

  assert.equal(frontDeskUpdates.settingsMainTab, "front-desk");
  assert.equal(frontDeskUpdates.settingsFrontDeskTab, "full-page-assistant");
  assert.equal(widgetUpdates.settingsMainTab, "widget");
  assert.equal(widgetUpdates.settingsFrontDeskTab, "optional-widget");
  assert.equal(voiceUpdates.settingsMainTab, "voice");
  assert.equal(voiceUpdates.settingsFrontDeskTab, "voice");
});

test("dashboard product landing links point at product-scoped settings hashes", () => {
  const { state } = loadDashboardState();
  const links = [
    ...state.getDashboardProductHomeContext("front_desk").shortcuts,
    ...state.getDashboardProductHomeContext("website_widget").shortcuts,
    ...state.getDashboardProductHomeContext("voice_agent").shortcuts,
  ];

  assert.ok(links.some((link) => link.href === "#settings/front-desk/full-page-assistant" && link.settingsTarget === "front_desk"));
  assert.ok(links.some((link) => link.href === "#settings/widget/optional-widget" && link.settingsTarget === "website_widget"));
  assert.ok(links.some((link) => link.href === "#settings/voice/voice" && link.settingsTarget === "voice_agent"));
  assert.equal(links.some((link) => link.href === "#settings/front-desk/optional-widget"), false);
});

test("product readiness helper returns product-specific checklist items", () => {
  const { state } = loadDashboardState();
  const snapshot = {
    agent: {
      id: "agent-1",
      name: "Acme Services",
      assistantName: "Acme Front Desk",
      welcomeMessage: "How can we help?",
      websiteUrl: "https://example.com",
      contactEmail: "team@example.com",
      buttonLabel: "Ask Acme",
      primaryColor: "#0f766e",
      contactPhone: "+15555555555",
      fullPageConfig: {
        publicPageEnabled: true,
        publicPageKey: "page-key",
        headline: "Acme Front Desk",
      },
      voiceConfig: {
        voiceInputEnabled: true,
        spokenRepliesEnabled: true,
        webCallEnabled: true,
      },
      installStatus: {
        state: "seen_recently",
        label: "Seen recently",
      },
    },
    setup: {
      knowledgeReady: true,
      knowledgeLimited: false,
    },
  };
  const keys = (items) => Array.from(items, (item) => item.key);

  assert.deepEqual(
    keys(state.getProductReadinessChecklist("front_desk", snapshot)),
    [
      "front_desk_identity",
      "front_desk_full_page",
      "front_desk_knowledge",
      "front_desk_qr_direct_link",
      "front_desk_routing",
      "front_desk_test",
      "front_desk_publish",
    ]
  );
  assert.deepEqual(
    keys(state.getProductReadinessChecklist("widget", snapshot)),
    [
      "widget_appearance",
      "widget_embed_method",
      "widget_domain_status",
      "widget_routing",
      "widget_test",
      "widget_analytics",
    ]
  );
  assert.deepEqual(
    keys(state.getProductReadinessChecklist("voice", snapshot)),
    [
      "voice_settings",
      "voice_personality",
      "voice_spoken_replies",
      "voice_routing",
      "voice_availability",
      "voice_test",
      "voice_analytics",
    ]
  );
});

test("product readiness helper derives only existing saved state and leaves setup-only actions neutral", () => {
  const { state } = loadDashboardState();
  const checklist = state.getProductReadinessChecklist("website_widget", {
    agent: {
      installStatus: { state: "not_installed", label: "Not installed yet" },
    },
    setup: {
      knowledgeReady: false,
    },
  });

  const appearance = checklist.find((item) => item.key === "widget_appearance");
  const installMethod = checklist.find((item) => item.key === "widget_embed_method");
  const domainStatus = checklist.find((item) => item.key === "widget_domain_status");

  assert.equal(appearance.kind, "derived");
  assert.equal(appearance.complete, false);
  assert.equal(installMethod.kind, "action");
  assert.equal(installMethod.complete, null);
  assert.equal(domainStatus.kind, "derived");
  assert.equal(domainStatus.complete, false);
});

test("product readiness keeps default widget appearance and disabled public page from completing setup", () => {
  const { state } = loadDashboardState();
  const widgetChecklist = state.getProductReadinessChecklist("website_widget", {
    agent: {
      buttonLabel: "Open Front Desk",
      welcomeMessage: "Hi! How can we help today?",
      primaryColor: "#5b61ff",
      secondaryColor: "#7c4dff",
    },
  });
  const frontDeskChecklist = state.getProductReadinessChecklist("front_desk", {
    agent: {
      fullPageConfig: {
        publicPageEnabled: false,
        publicPageKey: "page-key",
        headline: "Custom headline",
        subtitle: "Custom subtitle",
      },
    },
  });

  assert.equal(widgetChecklist.find((item) => item.key === "widget_appearance").complete, false);
  assert.equal(frontDeskChecklist.find((item) => item.key === "front_desk_full_page").complete, false);
  assert.equal(frontDeskChecklist.find((item) => item.key === "front_desk_publish").complete, false);
});

test("product readiness counts only explicit routing destinations", () => {
  const { state } = loadDashboardState();
  const defaultCtaChecklist = state.getProductReadinessChecklist("front_desk", {
    agent: {
      ctaMode: "contact",
      directCtaMode: "booking",
      leadCaptureMode: "quote",
    },
  });
  const routedChecklist = state.getProductReadinessChecklist("front_desk", {
    agent: {
      bookingUrl: "https://example.com/book",
    },
  });

  assert.equal(defaultCtaChecklist.find((item) => item.key === "front_desk_routing").complete, false);
  assert.equal(routedChecklist.find((item) => item.key === "front_desk_routing").complete, true);
});

test("product readiness uses product-scoped activity for page, widget, and Web Call tests", () => {
  const { state } = loadDashboardState();
  const frontDeskChecklist = state.getProductReadinessChecklist("front_desk", {
    messages: [
      { id: "msg-page-1", displayMode: "page", role: "user", sessionKey: "page-session" },
    ],
  });
  const widgetChecklist = state.getProductReadinessChecklist("website_widget", {
    ownerAnalyticsDashboard: {
      assistantSource: {
        widget: { conversationCount: 1 },
      },
    },
  });
  const voiceChecklist = state.getProductReadinessChecklist("voice_agent", {
    messages: [
      { id: "msg-web-call-1", conversationSource: "web_call", role: "user", sessionKey: "voice-session" },
    ],
  });
  const voiceHealthChecklist = state.getProductReadinessChecklist("voice_agent", {
    ownerAnalyticsDashboard: {
      webCallHealth: { starts: 1 },
      webCallRecentCalls: { total: 1, calls: [{ id: "call-1", latestActivityAt: "2026-05-31T10:00:00.000Z" }] },
    },
  });

  assert.deepEqual(
    [
      frontDeskChecklist.find((item) => item.key === "front_desk_test"),
      widgetChecklist.find((item) => item.key === "widget_test"),
      voiceChecklist.find((item) => item.key === "voice_test"),
      voiceHealthChecklist.find((item) => item.key === "voice_test"),
    ].map((item) => [item.kind, item.complete]),
    [
      ["derived", true],
      ["derived", true],
      ["derived", true],
      ["derived", true],
    ]
  );
});

test("product readiness action-only items stay neutral and voice copy avoids phone claims", () => {
  const { state } = loadDashboardState();
  const widgetChecklist = state.getProductReadinessChecklist("website_widget");
  const voiceChecklist = state.getProductReadinessChecklist("voice_agent");
  const actionItems = [...widgetChecklist, ...voiceChecklist].filter((item) => item.kind === "action");
  const voiceCopy = JSON.stringify(voiceChecklist);

  assert.ok(actionItems.length > 0);
  actionItems.forEach((item) => {
    assert.equal(item.complete, null);
  });
  assert.match(voiceCopy, /Web Call|browser voice/);
  assert.doesNotMatch(voiceCopy, /telephony|phone/i);
});

test("product readiness checklist links point to existing safe dashboard hashes", () => {
  const { state } = loadDashboardState();
  const allLinks = [
    ...state.getProductReadinessChecklist("front_desk"),
    ...state.getProductReadinessChecklist("website_widget"),
    ...state.getProductReadinessChecklist("voice_agent"),
  ].map((item) => item.href);

  assert.ok(allLinks.includes("#settings/front-desk/identity-welcome"));
  assert.ok(allLinks.includes("#settings/front-desk/full-page-assistant"));
  assert.ok(allLinks.includes("#settings/business-profile"));
  assert.ok(allLinks.includes("#settings/widget/optional-widget"));
  assert.ok(allLinks.includes("#settings/widget/routing"));
  assert.ok(allLinks.includes("#settings/voice/voice"));
  assert.ok(allLinks.includes("#install/full-page"));
  assert.ok(allLinks.includes("#install/embed"));
  assert.ok(allLinks.includes("#analytics"));
  assert.equal(allLinks.some((href) => /^\/dashboard\/[^#]/.test(href)), false);
});

test("product landing renders readiness card from the active product context", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(script, /data-product-readiness-card/);
  assert.match(script, /data-product-readiness-item/);
  assert.match(script, /data-shell-section="setup"/);
  assert.match(script, /data-product-setup-view/);
  assert.match(script, /buildProductSetupPanel\(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining\)/);
  assert.match(script, /buildProductLandingContext\(activeDashboardProduct,\s*\{/);
  assert.match(script, /saved-state checks ready/);
  assert.match(script, /Action-only rows are neutral setup links/);
  assert.doesNotMatch(script, /\$\{readyCount\} of \$\{checklist\.length\} items ready/);
});

test("analytics rendering receives the active dashboard product context", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(script, /renderAnalyticsPageFragment\(report,[\s\S]*activeProduct: activeDashboardProduct/);
});
