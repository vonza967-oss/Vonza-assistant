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
        href: "http://127.0.0.1:3000/legacy-dashboard-test#settings/account-billing",
        pathname: "/legacy-dashboard-test",
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

  for (const pathname of ["/dashboard/widget", "/website-widget/dashboard", "/widget/dashboard"]) {
    const context = state.getDashboardProductContext(pathname);
    assert.equal(context.key, "website_widget", pathname);
    assert.equal(context.canonicalPath, "/website-widget/dashboard", pathname);
    assert.equal(context.isKnownProductPath, true, pathname);
    assert.equal(context.isDedicatedProductDashboard, true, pathname);
  }

  assert.equal(state.getDashboardProductContext("/dashboard").isDefaultDashboardPath, true);
  assert.equal(state.getDashboardProductContext("/dashboard").isDedicatedProductDashboard, false);
  assert.equal(state.getDashboardProductContext("/dashboard/front-desk").key, "website_widget");
  assert.equal(state.getDashboardProductContext("/dashboard/front-desk").isKnownProductPath, false);
  assert.equal(state.getDashboardProductContext("/dashboard/voice").key, "website_widget");
  assert.equal(state.getDashboardProductContext("/dashboard/voice").isKnownProductPath, false);
});

test("dashboard analytics API path is not treated as a product route", () => {
  const { state } = loadDashboardState();
  const context = state.getDashboardProductContext("/dashboard/analytics");

  assert.equal(context.key, "website_widget");
  assert.equal(context.routeSegment, "analytics");
  assert.equal(context.isKnownProductPath, false);
  assert.equal(context.isDedicatedProductDashboard, false);
});

test("dashboard product links resolve to exact aliases", () => {
  const { state } = loadDashboardState();

  assert.equal(state.getDashboardProductRoutePath("front_desk"), "/website-widget/dashboard");
  assert.equal(state.getDashboardProductRoutePath("widget"), "/website-widget/dashboard");
  assert.equal(state.getDashboardProductRoutePath("voice"), "/website-widget/dashboard");
  assert.equal(state.getDashboardProductRoutePath("website_widget"), "/website-widget/dashboard");

  const links = state.getDashboardProductNavItems("/dashboard/widget").map((item) => item.routePath);
  assert.deepEqual(links, ["/website-widget/dashboard"]);
});

test("product packaging metadata exposes Website Widget only", () => {
  const { state } = loadDashboardState();
  const products = state.listDashboardProductPackaging();

  assert.deepEqual(products.map((product) => product.key), ["website_widget"]);
  assert.deepEqual(products.map((product) => product.name), ["Website Widget"]);
  assert.deepEqual(products.map((product) => product.setupHref), ["/dashboard/widget#setup"]);
  assert.deepEqual(products.map((product) => product.setupLabel), ["Open widget setup"]);
  assert.match(products.find((product) => product.key === "website_widget").targetUseCase, /Five-minute website AI agent/);
  assert.equal(state.getDashboardProductPackaging("front_desk").key, "website_widget");
  assert.equal(state.getDashboardProductPackaging("voice_agent").key, "website_widget");
  products.forEach((product) => {
    assert.equal(product.pricingLabel, "Product pricing coming soon");
    assert.equal(product.availabilitySource, "account_access");
    assert.ok(product.targetUseCase.length > 20);
  });
});

test("product home context exposes Website Widget only", () => {
  const { state } = loadDashboardState();
  const contexts = ["front_desk", "website_widget", "voice_agent"].map((key) =>
    state.getDashboardProductHomeContext(key)
  );

  assert.deepEqual(contexts.map((context) => context.key), ["website_widget", "website_widget", "website_widget"]);
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

test("product setup context exposes Website Widget for every product alias", () => {
  const { state } = loadDashboardState();
  const frontDesk = state.getDashboardProductSetupContext("front_desk");
  const widget = state.getDashboardProductSetupContext("website_widget");
  const voice = state.getDashboardProductSetupContext("voice_agent");
  const voiceCopy = JSON.stringify(voice);

  assert.equal(frontDesk.title, "Set up Website Widget");
  assert.equal(widget.title, "Set up Website Widget");
  assert.equal(voice.title, "Set up Website Widget");
  assert.match(JSON.stringify(frontDesk), /Template and tone|Allowed domains|WordPress or embed snippet|Install verification|Test widget|Widget analytics\/conversations/);
  assert.match(JSON.stringify(widget), /Template and tone|Allowed domains|WordPress or embed snippet|Install verification|Test widget|Widget analytics\/conversations/);
  assert.match(voiceCopy, /Template and tone|Allowed domains|WordPress or embed snippet|Install verification|Test widget|Widget analytics\/conversations/);
  assert.doesNotMatch(voiceCopy, /telephony|phone|Web Call|Voice Agent/i);
});

test("product home context points every product alias at safe widget surfaces", () => {
  const { state } = loadDashboardState();
  const frontDesk = state.getDashboardProductHomeContext("front_desk");
  const widget = state.getDashboardProductHomeContext("widget");
  const voice = state.getDashboardProductHomeContext("voice");
  const frontDeskLinks = JSON.stringify(frontDesk);
  const widgetLinks = JSON.stringify(widget);
  const voiceCopy = JSON.stringify(voice);

  assert.match(frontDeskLinks, /#install\/embed/);
  assert.match(frontDeskLinks, /#settings\/widget\/optional-widget/);
  assert.match(widgetLinks, /#install\/embed/);
  assert.match(widgetLinks, /#settings\/widget\/optional-widget/);
  assert.match(widgetLinks, /Embed\/install snippet/);
  assert.match(widgetLinks, /Allowed domains\/status/);
  assert.match(widgetLinks, /Launcher behavior/);
  assert.match(widgetLinks, /Test widget/);
  assert.match(widgetLinks, /Widget analytics/);
  assert.match(voiceCopy, /#install\/embed/);
  assert.match(voiceCopy, /#settings\/widget\/optional-widget/);
  assert.doesNotMatch(voiceCopy, /Voice Agent|Web Call|telephony|phone/i);
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

  assert.match(html, /data-product-packaging-card="website_widget"/);
  assert.doesNotMatch(html, /data-product-packaging-card="front_desk"/);
  assert.doesNotMatch(html, /data-product-packaging-card="voice_agent"/);
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
          product_key: "website_widget",
          status: "pending_account_access",
          reason_code: "account_access_pending",
          is_enforced: false,
        },
      ],
    },
  });

  assert.match(html, /data-product-availability-status="pending_account_access"/);
  assert.match(html, /Account access pending/);
  assert.match(html, /Product availability: Account Access Pending/);
  assert.match(html, /data-product-availability-enforced="false"/);
  assert.doesNotMatch(html, /data-product-packaging-card="front_desk"|data-product-packaging-card="voice_agent"/);
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
          product_key: "website_widget",
          status: "unavailable",
          reason_code: "account_capacity_capped",
          is_enforced: false,
        },
      ],
      product_entitlements: [
        {
          product_key: "website_widget",
          status: "available",
          entitlement_status: "active",
          entitlement_source: "workspace_plan",
          entitlement_row_exists: true,
          is_enforced: false,
        },
      ],
    },
  });

  assert.match(html, /Included with current workspace/);
  assert.match(html, /Product entitlement: Workspace Plan/);
  assert.match(html, /data-product-entitlement-status="active"/);
  assert.match(html, /data-product-entitlement-row-exists="true"/);
  assert.match(html, /data-product-availability-enforced="false"/);
  assert.doesNotMatch(html, /data-product-packaging-card="front_desk"|data-product-packaging-card="voice_agent"/);
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
          product_key: "website_widget",
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
  assert.doesNotMatch(html, /Missing entitlement record/);
  assert.match(html, /data-product-entitlement-status="free"/);
  assert.match(html, /href="\/dashboard\/widget#setup" data-product-packaging-link="website_widget"/);
  assert.doesNotMatch(html, /data-product-packaging-link="front_desk"|data-product-packaging-link="voice_agent"/);
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
      ["website_widget", true],
    ]
  );
  assert.equal(state.ACTIVE_DASHBOARD_PRODUCT_CONTEXT.key, "website_widget");
  assert.equal(state.ACTIVE_DASHBOARD_PRODUCT_CONTEXT.isKnownProductPath, false);
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
  const links = state.getDashboardProductHomeContext("website_widget").shortcuts;

  assert.ok(links.some((link) => link.href === "#settings/widget/optional-widget" && link.settingsTarget === "website_widget"));
  assert.ok(links.some((link) => link.href === "#install/embed" && link.installMethod === "widget"));
  assert.equal(links.some((link) => link.href === "#settings/front-desk/full-page-assistant"), false);
  assert.equal(links.some((link) => link.href === "#settings/voice/voice"), false);
  assert.equal(links.some((link) => link.href === "#settings/front-desk/optional-widget"), false);
});

test("product readiness helper returns the widget checklist for every product alias", () => {
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
  const expectedWidgetKeys = [
    "widget_appearance",
    "widget_embed_method",
    "widget_domain_status",
    "widget_routing",
    "widget_test",
    "widget_analytics",
  ];

  assert.deepEqual(keys(state.getProductReadinessChecklist("front_desk", snapshot)), expectedWidgetKeys);
  assert.deepEqual(keys(state.getProductReadinessChecklist("widget", snapshot)), expectedWidgetKeys);
  assert.deepEqual(keys(state.getProductReadinessChecklist("voice", snapshot)), expectedWidgetKeys);
  assert.deepEqual(keys(state.getProductReadinessChecklist(undefined, snapshot)), expectedWidgetKeys);
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

test("product readiness keeps default widget appearance from completing setup", () => {
  const { state } = loadDashboardState();
  const widgetChecklist = state.getProductReadinessChecklist("website_widget", {
    agent: {
      buttonLabel: "Open widget",
      welcomeMessage: "Hi! How can we help today?",
      primaryColor: "#5b61ff",
      secondaryColor: "#7c4dff",
    },
  });
  const frontDeskAliasChecklist = state.getProductReadinessChecklist("front_desk");

  assert.equal(widgetChecklist.find((item) => item.key === "widget_appearance").complete, false);
  assert.ok(frontDeskAliasChecklist.some((item) => item.key === "widget_appearance"));
  assert.equal(frontDeskAliasChecklist.some((item) => item.key === "front_desk_full_page"), false);
  assert.equal(frontDeskAliasChecklist.some((item) => item.key === "front_desk_publish"), false);
});

test("product readiness counts only explicit routing destinations", () => {
  const { state } = loadDashboardState();
  const defaultCtaChecklist = state.getProductReadinessChecklist("website_widget", {
    agent: {
      ctaMode: "contact",
      directCtaMode: "booking",
      leadCaptureMode: "quote",
    },
  });
  const routedChecklist = state.getProductReadinessChecklist("website_widget", {
    agent: {
      bookingUrl: "https://example.com/book",
    },
  });

  assert.equal(defaultCtaChecklist.find((item) => item.key === "widget_routing").complete, false);
  assert.equal(routedChecklist.find((item) => item.key === "widget_routing").complete, true);
});

test("product readiness uses widget-scoped activity for widget tests", () => {
  const { state } = loadDashboardState();
  const widgetChecklist = state.getProductReadinessChecklist("website_widget", {
    ownerAnalyticsDashboard: {
      assistantSource: {
        widget: { conversationCount: 1 },
      },
    },
  });
  const voiceAliasChecklist = state.getProductReadinessChecklist("voice_agent", {
    ownerAnalyticsDashboard: {
      assistantSource: {
        widget: { conversationCount: 1 },
      },
    },
  });

  assert.deepEqual(
    [
      widgetChecklist.find((item) => item.key === "widget_test"),
      voiceAliasChecklist.find((item) => item.key === "widget_test"),
    ].map((item) => [item.kind, item.complete]),
    [
      ["derived", true],
      ["derived", true],
    ]
  );
});

test("product readiness action-only items stay neutral and old product copy stays hidden", () => {
  const { state } = loadDashboardState();
  const widgetChecklist = state.getProductReadinessChecklist("website_widget");
  const voiceChecklist = state.getProductReadinessChecklist("voice_agent");
  const actionItems = [...widgetChecklist, ...voiceChecklist].filter((item) => item.kind === "action");
  const voiceCopy = JSON.stringify(voiceChecklist);

  assert.ok(actionItems.length > 0);
  actionItems.forEach((item) => {
    assert.equal(item.complete, null);
  });
  assert.match(voiceCopy, /Website Widget|widget/i);
  assert.doesNotMatch(voiceCopy, /Voice Agent|Web Call|browser voice|telephony|phone/i);
});

test("product readiness checklist links point to existing safe dashboard hashes", () => {
  const { state } = loadDashboardState();
  const allLinks = [
    ...state.getProductReadinessChecklist("front_desk"),
    ...state.getProductReadinessChecklist("website_widget"),
    ...state.getProductReadinessChecklist("voice_agent"),
  ].map((item) => item.href);

  assert.ok(allLinks.includes("#settings/widget/optional-widget"));
  assert.ok(allLinks.includes("#settings/widget/routing"));
  assert.ok(allLinks.includes("#install/embed"));
  assert.ok(allLinks.includes("#analytics"));
  assert.equal(allLinks.some((href) => /front-desk|voice|full-page|business-profile/.test(href)), false);
  assert.equal(allLinks.some((href) => /^\/dashboard\/[^#]/.test(href)), false);
});

test("product landing renders readiness card from the active product context", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(script, /data-product-readiness-card/);
  assert.match(script, /data-product-readiness-item/);
  assert.match(script, /data-shell-section="setup"/);
  assert.match(script, /data-product-setup-view/);
  assert.match(script, /buildProductSetupPanel\(agent, shellMessages, setup, actionQueue, operatorWorkspace, frontDeskTraining\)/);
  assert.match(script, /buildProductLandingContext\(activeDashboardProduct,\s*\{/);
  assert.match(script, /saved-state checks ready/);
  assert.match(script, /Action-only rows are neutral setup links/);
  assert.doesNotMatch(script, /\$\{readyCount\} of \$\{checklist\.length\} items ready/);
});

test("analytics rendering receives the active dashboard product context", () => {
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(script, /renderAnalyticsPageFragment\(report,[\s\S]*activeProduct: activeDashboardProduct/);
});
