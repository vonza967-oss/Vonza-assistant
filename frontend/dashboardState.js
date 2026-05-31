(function registerVonzaDashboardState(global) {
  /**
   * @typedef {Object} DashboardUiState
   * @property {string} settingsMainTab
   * @property {string} settingsFrontDeskTab
   * @property {string} settingsFullPageTab
   * @property {string} installMethod
   * @property {string} installFullPageOption
   * @property {string} frontDeskTab
   * @property {string} customersFilter
   * @property {string} selectedCustomerKey
   * @property {string} selectedConversationKey
   * @property {string} todayFilter
   */
  const INSTALL_METHODS = Object.freeze(["full-page", "qr", "widget"]);
  const INSTALL_METHOD_PANEL_KEYS = Object.freeze({
    "full-page": "page",
    qr: "qr",
    widget: "widget",
  });
  const INSTALL_METHOD_HASH_SEGMENTS = Object.freeze({
    "full-page": "full-page",
    qr: "qr",
    widget: "embed",
  });
  const INSTALL_FULL_PAGE_OPTIONS = Object.freeze(["share", "section", "dedicated", "takeover", "iframe"]);
  const FRONT_DESK_SECTION_HASH_SEGMENTS = Object.freeze({
    practice: "practice",
    improvements: "improvements",
    knowledge: "knowledge",
    library: "answer-library",
    launch: "launch",
    customization: "customization",
  });
  const SETTINGS_MAIN_TABS = Object.freeze(["general", "front_desk", "website_widget", "voice_agent", "business_profile", "account_billing", "privacy_legal"]);
  const SETTINGS_MAIN_TAB_HASH_SEGMENTS = Object.freeze({
    general: "general",
    front_desk: "front-desk",
    website_widget: "widget",
    voice_agent: "voice",
    business_profile: "business-profile",
    account_billing: "account-billing",
    privacy_legal: "privacy-legal",
  });
  const SETTINGS_MAIN_TAB_ALIASES = Object.freeze({
    assistant: "general",
    branding: "general",
    workspace_preferences: "general",
    "workspace-preferences": "general",
    customize: "front_desk",
    "front-desk": "front_desk",
    frontdesk: "front_desk",
    widget: "website_widget",
    website: "website_widget",
    website_widget: "website_widget",
    "website-widget": "website_widget",
    voice: "voice_agent",
    voice_agent: "voice_agent",
    "voice-agent": "voice_agent",
    business: "business_profile",
    business_context: "business_profile",
    "business-context": "business_profile",
    business_profile: "business_profile",
    "business-profile": "business_profile",
    profile: "business_profile",
    workspace: "business_profile",
    account: "account_billing",
    billing: "account_billing",
    plan: "account_billing",
    account_billing: "account_billing",
    "account-billing": "account_billing",
    privacy: "privacy_legal",
    legal: "privacy_legal",
    privacy_controls: "privacy_legal",
    "privacy-controls": "privacy_legal",
    privacy_legal: "privacy_legal",
    "privacy-legal": "privacy_legal",
  });
  const SETTINGS_FRONT_DESK_TABS = Object.freeze(["identity", "voice", "full_page", "routing", "appearance"]);
  const SETTINGS_FRONT_DESK_TAB_HASH_SEGMENTS = Object.freeze({
    identity: "identity-welcome",
    voice: "voice",
    full_page: "full-page-assistant",
    routing: "routing",
    appearance: "optional-widget",
  });
  const SETTINGS_FRONT_DESK_TAB_LABELS = Object.freeze({
    identity: "Identity & welcome",
    voice: "Voice",
    full_page: "Front Desk page",
    routing: "Routing",
    appearance: "Optional widget",
  });
  const DASHBOARD_UI_STATE_DEFAULTS = Object.freeze({
    settingsMainTab: "general",
    settingsFrontDeskTab: "identity-welcome",
    settingsFullPageTab: "content",
    installMethod: "full-page",
    installFullPageOption: "share",
    frontDeskTab: "practice",
    customersFilter: "all",
    selectedCustomerKey: "",
    selectedConversationKey: "",
    todayFilter: "all",
  });
  const DASHBOARD_UI_STATE_PERSISTED_KEYS = Object.freeze([
    "settingsMainTab",
    "settingsFrontDeskTab",
    "settingsFullPageTab",
    "installMethod",
    "installFullPageOption",
    "frontDeskTab",
    "todayFilter",
  ]);
  const DASHBOARD_SECTION_HASH_ALIASES = Object.freeze({
    home: "overview",
    overview: "overview",
    today: "overview",
    customers: "contacts",
    customer: "contacts",
    contacts: "contacts",
    "follow-ups": "contacts",
    followups: "contacts",
    "front-desk": "customize",
    frontdesk: "customize",
    conversations: "customize",
    customize: "customize",
    analytics: "analytics",
    install: "install",
    settings: "settings",
    privacy: "settings",
  });
  const DASHBOARD_SECTION_HASHES = Object.freeze({
    overview: "",
    contacts: "customers",
    customize: "front-desk",
    analytics: "analytics",
    install: "install",
    settings: "settings",
  });
  const DASHBOARD_PRODUCT_REGISTRY = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      routeSegment: "front-desk",
      routePath: "/dashboard/front-desk",
      label: "Front Desk",
      dashboardLabel: "AI Front Desk workspace",
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      routeSegment: "widget",
      routePath: "/dashboard/widget",
      label: "Website widget",
      dashboardLabel: "Website widget workspace",
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      routeSegment: "voice",
      routePath: "/dashboard/voice",
      label: "Voice agent",
      dashboardLabel: "Voice agent workspace",
    }),
  });
  const DASHBOARD_PRODUCT_ROUTE_SEGMENTS = Object.freeze({
    "front-desk": "front_desk",
    widget: "website_widget",
    voice: "voice_agent",
  });
  const DASHBOARD_PRODUCT_PACKAGING = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      name: "Front Desk",
      targetUseCase: "Hosted AI front desk page for customers who need answers, routing, and follow-up capture.",
      setupLabel: "Configure Front Desk",
      setupHref: "/dashboard/front-desk",
      settingsHref: "#settings/front-desk/full-page-assistant",
      pricingLabel: "Product pricing coming soon",
      availabilitySource: "account_access",
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      name: "Website Widget",
      targetUseCase: "Optional embedded website launcher for visitors who need quick answers without leaving a page.",
      setupLabel: "View widget setup",
      setupHref: "/dashboard/widget",
      settingsHref: "#settings/widget/optional-widget",
      pricingLabel: "Product pricing coming soon",
      availabilitySource: "account_access",
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      name: "Voice Agent",
      targetUseCase: "Browser voice and spoken replies for hands-free customer conversations where configured.",
      setupLabel: "View voice setup",
      setupHref: "/dashboard/voice",
      settingsHref: "#settings/voice/voice",
      pricingLabel: "Product pricing coming soon",
      availabilitySource: "account_access",
    }),
  });
  const DASHBOARD_PRODUCT_HOME_CONTEXT = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      homeTitle: "Front Desk home",
      homeSubtitle: "Operate the full-page AI Front Desk customers can open directly.",
      sidebarNote: "Front Desk is the primary full-page customer surface.",
      statusKicker: "Front Desk status",
      statusLiveTitle: "Your Front Desk is",
      statusReadyTitle: "Your Front Desk is ready to test",
      statusSetupTitle: "Your Front Desk needs setup",
      statusLiveCopy: "The full-page customer surface is ready for direct links, QR, or embeds.",
      statusReadyCopy: "Test the full-page assistant, then publish the dedicated page through Install.",
      statusSetupCopy: "Finish business identity, knowledge, and routing before sharing the Front Desk.",
      contextTitle: "Launch the full-page AI Front Desk",
      contextCopy: "Front Desk is the primary customer-facing product. Set up the full-page experience, business identity, knowledge, and routing before publishing.",
      metricLabels: Object.freeze({
        conversations: "Front Desk conversations",
        leads: "Front Desk leads",
        handled: "AI handled",
        empty: "Front Desk analytics will appear after customer conversations are recorded.",
      }),
      previewActionLabel: "Preview/test assistant",
      analyticsLinkLabel: "Front Desk analytics",
      quickActions: Object.freeze([
        Object.freeze({ label: "Full-page setup", icon: "frontdesk", shellTarget: "settings", settingsTarget: "front_desk" }),
        Object.freeze({ label: "Business identity", icon: "settings", shellTarget: "settings", settingsTarget: "front_desk" }),
        Object.freeze({ label: "Preview/test assistant", icon: "sparkle", action: "preview" }),
        Object.freeze({ label: "Front Desk analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Publish/open full-page", note: "Open the existing full-page publish and share options", href: "#install/full-page", shellTarget: "install", installMethod: "full-page", icon: "install", primary: true }),
        Object.freeze({ label: "Full-page setup", note: "Open existing Front Desk page settings", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk", icon: "frontdesk" }),
        Object.freeze({ label: "Business identity", note: "Review identity and welcome copy", href: "#settings/front-desk/identity-welcome", shellTarget: "settings", settingsTarget: "front_desk", icon: "settings" }),
        Object.freeze({ label: "Knowledge/training", note: "Open business knowledge settings", href: "#settings/business-profile", shellTarget: "settings", settingsTarget: "business_profile", icon: "sparkle" }),
        Object.freeze({ label: "Routing/contact capture", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Front Desk analytics", note: "Review customer signals", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      homeTitle: "Website Widget home",
      homeSubtitle: "Operate the embedded on-site assistant without changing the shared workspace.",
      sidebarNote: "Website Widget is the embedded on-site assistant.",
      statusKicker: "Widget status",
      statusLiveTitle: "Your Website Widget is installed",
      statusReadyTitle: "Your Website Widget is ready to test",
      statusSetupTitle: "Your Website Widget needs setup",
      statusLiveCopy: "Install verification has detected the embedded widget on a site.",
      statusReadyCopy: "Review embed setup and appearance, then test the widget on the install surface.",
      statusSetupCopy: "Finish install/embed setup, allowed domains, and widget appearance before relying on site traffic.",
      contextTitle: "Install and tune the Website Widget",
      contextCopy: "Use the existing install/embed and Website Widget settings areas. Contacts, conversations, analytics, and billing stay shared.",
      metricLabels: Object.freeze({
        conversations: "Widget conversations",
        leads: "Widget leads",
        handled: "AI handled",
        empty: "Widget conversations, leads, and analytics will appear after site visitors use the embed.",
      }),
      previewActionLabel: "Test widget",
      analyticsLinkLabel: "Widget analytics",
      quickActions: Object.freeze([
        Object.freeze({ label: "Install/embed setup", icon: "install", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ label: "Widget appearance", icon: "settings", shellTarget: "settings", settingsTarget: "website_widget" }),
        Object.freeze({ label: "Test widget", icon: "sparkle", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ label: "Widget analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Embed install", note: "Open the existing Website Widget embed panel", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "install", primary: true }),
        Object.freeze({ label: "Allowed domains/status", note: "Review domain guidance and install verification", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "review" }),
        Object.freeze({ label: "Widget appearance", note: "Open Website Widget settings", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget", icon: "settings" }),
        Object.freeze({ label: "Widget conversations/leads", note: "Review shared customer records", href: "#customers", shellTarget: "contacts", icon: "users" }),
        Object.freeze({ label: "Widget analytics", note: "Review shared traffic and outcomes", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      homeTitle: "Voice Agent home",
      homeSubtitle: "Operate the browser/Web Call voice assistant from the shared dashboard.",
      sidebarNote: "Voice Agent is the browser/Web Call voice assistant.",
      statusKicker: "Browser/Web Call status",
      statusLiveTitle: "Your Voice Agent is ready for browser/Web Call",
      statusReadyTitle: "Your Voice Agent is ready to test",
      statusSetupTitle: "Your Voice Agent needs setup",
      statusLiveCopy: "Browser voice input, spoken replies, and Web Call settings are ready in this workspace.",
      statusReadyCopy: "Test the voice agent and review voice/personality settings before sharing the experience.",
      statusSetupCopy: "Review voice/personality settings and shared routing/contact handoff before relying on Web Call.",
      contextTitle: "Configure browser/Web Call voice",
      contextCopy: "Voice Agent uses the existing browser voice and Web Call surfaces. Shared contacts, conversations, analytics, and account settings remain available.",
      metricLabels: Object.freeze({
        conversations: "Web Call conversations",
        leads: "Voice handoffs",
        handled: "AI handled",
        empty: "Web Call transcripts and analytics will appear when browser voice conversations are recorded.",
      }),
      previewActionLabel: "Test voice agent",
      analyticsLinkLabel: "Web Call analytics",
      quickActions: Object.freeze([
        Object.freeze({ label: "Voice settings", icon: "chat", shellTarget: "settings", settingsTarget: "voice_agent" }),
        Object.freeze({ label: "Routing/contact handoff", icon: "users", shellTarget: "settings", settingsTarget: "front_desk" }),
        Object.freeze({ label: "Test voice agent", icon: "sparkle", shellTarget: "customize" }),
        Object.freeze({ label: "Web Call analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Voice settings", note: "Open Voice Agent settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "chat", primary: true }),
        Object.freeze({ label: "Web Call test", note: "Use the existing voice QA tools in settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "sparkle" }),
        Object.freeze({ label: "Voice style", note: "Review voice input and spoken reply settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "settings" }),
        Object.freeze({ label: "Routing/contact handoff", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Web Call transcripts/analytics", note: "Review available analytics signals", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
    }),
  });

  function trimText(value) {
    return String(value || "").trim();
  }

  function hasOwnEntry(collection, key) {
    return Object.prototype.hasOwnProperty.call(collection, key);
  }

  function normalizeDashboardProductKey(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/-/g, "_");
    const aliases = {
      frontdesk: "front_desk",
      front_desk: "front_desk",
      website: "website_widget",
      website_widget: "website_widget",
      widget: "website_widget",
      voice: "voice_agent",
      voice_agent: "voice_agent",
    };
    const candidate = aliases[normalized] || normalized;

    return hasOwnEntry(DASHBOARD_PRODUCT_REGISTRY, candidate) ? candidate : "front_desk";
  }

  function getDashboardProduct(key = "front_desk") {
    return DASHBOARD_PRODUCT_REGISTRY[normalizeDashboardProductKey(key)] || DASHBOARD_PRODUCT_REGISTRY.front_desk;
  }

  function getDashboardProductContext(pathname = global.location?.pathname || "/dashboard") {
    const normalizedPath = `/${trimText(pathname).split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")}`;
    const parts = normalizedPath.split("/").filter(Boolean);
    const routeSegment = parts[0] === "dashboard" ? parts[1] || "" : "";
    const routeProductKey = DASHBOARD_PRODUCT_ROUTE_SEGMENTS[routeSegment] || "front_desk";
    const product = getDashboardProduct(routeProductKey);

    return Object.freeze({
      ...product,
      routeSegment,
      currentPath: normalizedPath === "/" ? "/dashboard" : normalizedPath,
      canonicalPath: product.routePath,
      isDefaultDashboardPath: normalizedPath === "/dashboard",
      isKnownProductPath: normalizedPath === "/dashboard" || DASHBOARD_PRODUCT_ROUTE_SEGMENTS[routeSegment] === product.key,
    });
  }

  function getDashboardProductRoutePath(key = "front_desk") {
    return getDashboardProduct(key).routePath;
  }

  function getDashboardProductPackaging(key = "front_desk") {
    const product = getDashboardProduct(normalizeDashboardProductKey(key));
    const packaging = DASHBOARD_PRODUCT_PACKAGING[product.key] || DASHBOARD_PRODUCT_PACKAGING.front_desk;

    return Object.freeze({
      ...packaging,
      label: product.label,
      dashboardLabel: product.dashboardLabel,
      routePath: product.routePath,
      routeSegment: product.routeSegment,
    });
  }

  function listDashboardProductPackaging() {
    return Object.freeze(Object.keys(DASHBOARD_PRODUCT_PACKAGING).map((key) => getDashboardProductPackaging(key)));
  }

  function getDashboardProductHomeContext(key = "front_desk") {
    const product = getDashboardProduct(normalizeDashboardProductKey(key));
    return DASHBOARD_PRODUCT_HOME_CONTEXT[product.key] || DASHBOARD_PRODUCT_HOME_CONTEXT.front_desk;
  }

  function getDashboardProductNavItems(activeProduct = global.location?.pathname || "/dashboard") {
    const activeContext = trimText(activeProduct).startsWith("/")
      ? getDashboardProductContext(activeProduct)
      : getDashboardProduct(normalizeDashboardProductKey(activeProduct));

    return Object.freeze(Object.values(DASHBOARD_PRODUCT_REGISTRY).map((product) => Object.freeze({
      key: product.key,
      label: product.label,
      dashboardLabel: product.dashboardLabel,
      routePath: product.routePath,
      routeSegment: product.routeSegment,
      active: product.key === activeContext.key,
    })));
  }

  const ACTIVE_DASHBOARD_PRODUCT_CONTEXT = getDashboardProductContext();

  function exposeDashboardProductContext(context = ACTIVE_DASHBOARD_PRODUCT_CONTEXT) {
    const root = global.document?.documentElement;
    if (!root?.dataset) {
      return;
    }

    root.dataset.dashboardProductContext = context.key;
    root.dataset.dashboardProductPath = context.currentPath;
  }

  exposeDashboardProductContext();

  function getDashboardHashPathParts(hash = "") {
    const rawHash = trimText(hash).replace(/^#\/?/, "");

    if (!rawHash) {
      return [];
    }

    const hashPath = rawHash.split(/[?&]/)[0];
    return hashPath
      .split("/")
      .map((part) => trimText(part).toLowerCase().replace(/_/g, "-"))
      .filter(Boolean);
  }

  function getDashboardHashSearchParams(hash = "") {
    const rawHash = trimText(hash).replace(/^#\/?/, "");
    const queryIndex = rawHash.indexOf("?");

    if (queryIndex === -1) {
      return new URLSearchParams();
    }

    return new URLSearchParams(rawHash.slice(queryIndex + 1));
  }

  function getDashboardHashRoot(hash = "") {
    return getDashboardHashPathParts(hash)[0] || "";
  }

  function getShellSectionFromHash(hash = "", availableSections = []) {
    const rawHash = trimText(hash).replace(/^#\/?/, "");

    if (!rawHash) {
      return "";
    }

    const hashParams = rawHash.includes("=") ? new URLSearchParams(rawHash) : null;
    const pathRoot = getDashboardHashRoot(hash);
    const hashKey = trimText(hashParams?.get("section") || hashParams?.get("tab") || hashParams?.get("page") || pathRoot);
    const normalizedHash = hashKey
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    const section = DASHBOARD_SECTION_HASH_ALIASES[normalizedHash] || "";

    return availableSections.includes(section) ? section : "";
  }

  function normalizeInstallMethod(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    const aliases = {
      page: "full-page",
      "full-page-assistant": "full-page",
      "front-desk-page": "full-page",
      fullpage: "full-page",
      full: "full-page",
      assistant: "full-page",
      website: "widget",
      "website-widget": "widget",
      embed: "widget",
      embedded: "widget",
      "website-embed": "widget",
      qr: "qr",
      "qr-code": "qr",
    };
    const candidate = aliases[normalized] || normalized;

    return INSTALL_METHODS.includes(candidate) ? candidate : "full-page";
  }

  function getInstallMethodPanelKey(method = "") {
    return INSTALL_METHOD_PANEL_KEYS[normalizeInstallMethod(method)] || "page";
  }

  function getInstallMethodHashSegment(method = "") {
    return INSTALL_METHOD_HASH_SEGMENTS[normalizeInstallMethod(method)] || "full-page";
  }

  function normalizeInstallFullPageOption(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    return INSTALL_FULL_PAGE_OPTIONS.includes(normalized) ? normalized : "share";
  }

  function normalizeSettingsMainTab(value = "") {
    const normalized = trimText(value).toLowerCase();
    const normalizedAlias = normalized.replace(/-/g, "_");

    if (SETTINGS_MAIN_TABS.includes(normalized)) {
      return normalized;
    }

    if (SETTINGS_MAIN_TABS.includes(normalizedAlias)) {
      return normalizedAlias;
    }

    return SETTINGS_MAIN_TAB_ALIASES[normalized] || SETTINGS_MAIN_TAB_ALIASES[normalizedAlias] || "general";
  }

  function getSettingsMainTabHashSegment(value = "") {
    return SETTINGS_MAIN_TAB_HASH_SEGMENTS[normalizeSettingsMainTab(value)] || "general";
  }

  function normalizeSettingsFrontDeskTab(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    const aliases = {
      identity: "identity",
      "identity-welcome": "identity",
      welcome: "identity",
      voice: "voice",
      full_page: "full_page",
      "full-page": "full_page",
      "full-page-assistant": "full_page",
      page: "full_page",
      routing: "routing",
      route: "routing",
      appearance: "appearance",
      "optional-widget": "appearance",
      "widget-appearance": "appearance",
      widget: "appearance",
    };
    const candidate = aliases[normalized] || aliases[normalized.replace(/-/g, "_")] || normalized;

    return SETTINGS_FRONT_DESK_TABS.includes(candidate) ? candidate : "identity";
  }

  function getSettingsFrontDeskTabHashSegment(value = "") {
    return SETTINGS_FRONT_DESK_TAB_HASH_SEGMENTS[normalizeSettingsFrontDeskTab(value)] || "identity-welcome";
  }

  function getSettingsFrontDeskDefaultSubtab() {
    return "identity";
  }

  function normalizeFrontDeskSection(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    const aliases = {
      context: "knowledge",
      overview: "practice",
      preview: "practice",
      test: "practice",
      approved: "library",
      answers: "library",
      "answer-library": "library",
      library: "library",
      queue: "improvements",
      training: "improvements",
      "training-queue": "improvements",
      customize: "customization",
      customization: "customization",
      settings: "customization",
    };
    const candidate = aliases[normalized] || normalized;

    return hasOwnEntry(FRONT_DESK_SECTION_HASH_SEGMENTS, candidate) ? candidate : "practice";
  }

  function getFrontDeskSectionHashSegment(section = "") {
    return FRONT_DESK_SECTION_HASH_SEGMENTS[normalizeFrontDeskSection(section)] || "practice";
  }

  function normalizeCustomerFilterKey(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/-/g, "_");
    const aliases = {
      needs_review: "needs_review",
      needs_reply: "needs_review",
      needs_follow_up: "needs_follow_up",
      follow_up_possible: "needs_follow_up",
    };

    return aliases[normalized] || normalized;
  }

  function normalizeReadinessBoolean(value, fallbackValue = false) {
    if (value === true || value === false) {
      return value;
    }

    const normalized = trimText(value).toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    return fallbackValue;
  }

  function getReadinessFullPageConfig(agent = {}) {
    return agent.fullPageConfig || agent.full_page_config || {};
  }

  function getReadinessVoiceConfig(agent = {}) {
    return agent.voiceConfig || agent.voice_config || {};
  }

  function isReadinessPublicFullPageEnabled(agent = {}) {
    const config = getReadinessFullPageConfig(agent);
    return normalizeReadinessBoolean(config.publicPageEnabled ?? config.public_page_enabled)
      && Boolean(trimText(config.publicPageKey || config.public_page_key));
  }

  function hasReadinessFullPageCustomization(agent = {}) {
    const config = getReadinessFullPageConfig(agent);
    const suggestedQuestions = Array.isArray(config.suggestedQuestions)
      ? config.suggestedQuestions
      : Array.isArray(config.suggested_questions)
        ? config.suggested_questions
        : [];

    return Boolean(
      trimText(config.headline)
      || trimText(config.subtitle)
      || trimText(config.logoUrl || config.logo_url)
      || suggestedQuestions.some((item) => trimText(item))
    );
  }

  function hasReadinessWidgetAppearance(agent = {}) {
    return Boolean(
      trimText(agent.buttonLabel || agent.button_label)
      || trimText(agent.primaryColor || agent.primary_color)
      || trimText(agent.secondaryColor || agent.secondary_color)
      || trimText(agent.widgetLogoUrl || agent.widget_logo_url)
      || trimText(agent.welcomeMessage || agent.welcome_message)
    );
  }

  function getReadinessRoutingDestinationCount(agent = {}) {
    return [
      agent.contactEmail || agent.contact_email,
      agent.contactPhone || agent.contact_phone,
      agent.bookingUrl || agent.booking_url,
      agent.quoteUrl || agent.quote_url,
      agent.checkoutUrl || agent.checkout_url,
    ].filter((value) => trimText(value)).length;
  }

  function isReadinessInstallDetected(status = {}) {
    return ["installed_unseen", "seen_recently", "seen_stale"].includes(trimText(status.state));
  }

  function getReadinessWebCallState(agent = {}) {
    const voiceConfig = getReadinessVoiceConfig(agent);
    const voiceInputEnabled = normalizeReadinessBoolean(voiceConfig.voiceInputEnabled ?? voiceConfig.voice_input_enabled);
    const spokenRepliesEnabled = normalizeReadinessBoolean(voiceConfig.spokenRepliesEnabled ?? voiceConfig.spoken_replies_enabled);
    const webCallEnabled = normalizeReadinessBoolean(voiceConfig.webCallEnabled ?? voiceConfig.web_call_enabled);

    return {
      voiceInputEnabled,
      spokenRepliesEnabled,
      webCallEnabled,
      webCallReady: voiceInputEnabled && spokenRepliesEnabled && webCallEnabled,
    };
  }

  function createReadinessItem({
    key = "",
    label = "",
    copy = "",
    complete = null,
    kind = "action",
    href = "#",
    shellTarget = "",
    settingsTarget = "",
    installMethod = "",
    frontDeskOpen = "",
    icon = "review",
  } = {}) {
    return Object.freeze({
      key,
      label,
      copy,
      complete,
      kind,
      href,
      shellTarget,
      settingsTarget,
      installMethod,
      frontDeskOpen,
      icon,
    });
  }

  function getProductReadinessChecklist(productKey = "front_desk", snapshot = {}) {
    const normalizedProductKey = normalizeDashboardProductKey(productKey);
    const agent = snapshot.agent || {};
    const setup = snapshot.setup || {};
    const installStatus = snapshot.installStatus || agent.installStatus || {};
    const routingDestinationCount = getReadinessRoutingDestinationCount(agent);
    const hasRouting = routingDestinationCount > 0;
    const hasIdentity = Boolean(
      trimText(agent.businessName || agent.business_name || agent.name || agent.assistantName || agent.assistant_name)
      && trimText(agent.welcomeMessage || agent.welcome_message || agent.websiteUrl || agent.website_url)
    );
    const knowledgeReady = setup.knowledgeReady === true;
    const knowledgeLimited = setup.knowledgeLimited === true;
    const fullPageEnabled = isReadinessPublicFullPageEnabled(agent);
    const fullPageCustomized = hasReadinessFullPageCustomization(agent);
    const installDetected = isReadinessInstallDetected(installStatus);
    const webCallState = getReadinessWebCallState(agent);

    if (normalizedProductKey === "website_widget") {
      return Object.freeze([
        createReadinessItem({
          key: "widget_appearance",
          label: "Widget appearance configured",
          copy: hasReadinessWidgetAppearance(agent)
            ? "Launcher copy, color, logo, or welcome text exists in the current widget state."
            : "Open Website Widget settings to review launcher appearance.",
          complete: hasReadinessWidgetAppearance(agent),
          kind: "derived",
          href: "#settings/widget/optional-widget",
          shellTarget: "settings",
          settingsTarget: "website_widget",
          icon: "settings",
        }),
        createReadinessItem({
          key: "widget_embed_method",
          label: "Install/embed method selected",
          copy: "Choose or review the existing embed method from the Install page.",
          complete: null,
          kind: "action",
          href: "#install/embed",
          shellTarget: "install",
          installMethod: "widget",
          icon: "install",
        }),
        createReadinessItem({
          key: "widget_domain_status",
          label: "Domain/install status",
          copy: installDetected
            ? (installStatus.label || "The existing install tracker has detected widget markup.")
            : (installStatus.label || "Install verification has not detected widget traffic yet."),
          complete: installDetected,
          kind: "derived",
          href: "#install/embed",
          shellTarget: "install",
          installMethod: "widget",
          icon: "review",
        }),
        createReadinessItem({
          key: "widget_routing",
          label: "Routing/contact behavior configured",
          copy: hasRouting
            ? `${routingDestinationCount} routing destination${routingDestinationCount === 1 ? "" : "s"} available.`
            : "Add contact, booking, quote, or checkout destinations for widget handoffs.",
          complete: hasRouting,
          kind: "derived",
          href: "#settings/widget/routing",
          shellTarget: "settings",
          settingsTarget: "website_widget",
          icon: "users",
        }),
        createReadinessItem({
          key: "widget_test",
          label: "Test widget action",
          copy: "Use the existing install panel to copy or test the secondary website widget.",
          complete: null,
          kind: "action",
          href: "#install/embed",
          shellTarget: "install",
          installMethod: "widget",
          icon: "sparkle",
        }),
      ]);
    }

    if (normalizedProductKey === "voice_agent") {
      return Object.freeze([
        createReadinessItem({
          key: "voice_settings",
          label: "Voice/web-call settings configured",
          copy: webCallState.webCallReady
            ? "Voice input, spoken replies, and Web Call are enabled in the current settings."
            : "Enable voice input, spoken replies, and Web Call before relying on browser voice.",
          complete: webCallState.webCallReady,
          kind: "derived",
          href: "#settings/voice/voice",
          shellTarget: "settings",
          settingsTarget: "voice_agent",
          icon: "chat",
        }),
        createReadinessItem({
          key: "voice_routing",
          label: "Routing/contact handoff configured",
          copy: hasRouting
            ? `${routingDestinationCount} shared routing destination${routingDestinationCount === 1 ? "" : "s"} available.`
            : "Voice uses the shared Front Desk routing destinations for handoffs.",
          complete: hasRouting,
          kind: "derived",
          href: "#settings/front-desk/routing",
          shellTarget: "settings",
          settingsTarget: "front_desk",
          icon: "users",
        }),
        createReadinessItem({
          key: "voice_availability",
          label: "Browser/Web Call readiness",
          copy: webCallState.webCallReady
            ? "Browser voice input, spoken replies, and Web Call are enabled."
            : webCallState.webCallEnabled
              ? "Web Call is enabled; review voice input and spoken replies before testing."
              : "Web Call is not enabled yet.",
          complete: webCallState.webCallReady ? true : (webCallState.webCallEnabled ? null : false),
          kind: webCallState.webCallReady ? "derived" : "info",
          href: "#settings/voice/voice",
          shellTarget: "settings",
          settingsTarget: "voice_agent",
          icon: "chat",
        }),
        createReadinessItem({
          key: "voice_test",
          label: "Test voice agent action",
          copy: "Use the existing Front Desk practice and voice settings surfaces to run a voice test.",
          complete: null,
          kind: "action",
          href: "#front-desk/practice",
          shellTarget: "customize",
          icon: "sparkle",
        }),
        createReadinessItem({
          key: "voice_analytics",
          label: "Review transcripts/analytics",
          copy: "Open the shared Analytics surface for Web Call health and conversation signals.",
          complete: null,
          kind: "action",
          href: "#analytics",
          shellTarget: "analytics",
          icon: "outcomes",
        }),
      ]);
    }

    return Object.freeze([
      createReadinessItem({
        key: "front_desk_identity",
        label: "Business identity configured",
        copy: hasIdentity
          ? "Business identity, assistant name, welcome, or website context is available."
          : "Add the business identity and welcome details customers should see first.",
        complete: hasIdentity,
        kind: "derived",
        href: "#settings/front-desk/identity-welcome",
        shellTarget: "settings",
        settingsTarget: "front_desk",
        icon: "settings",
      }),
      createReadinessItem({
        key: "front_desk_full_page",
        label: "Full-page assistant configured",
        copy: fullPageEnabled
          ? "The hosted Front Desk page is enabled."
          : fullPageCustomized
            ? "Full-page content has been customized; public access still needs review."
            : "Review the hosted Front Desk page headline, prompts, trust copy, and public access.",
        complete: fullPageEnabled || fullPageCustomized,
        kind: "derived",
        href: "#settings/front-desk/full-page-assistant",
        shellTarget: "settings",
        settingsTarget: "front_desk",
        icon: "frontdesk",
      }),
      createReadinessItem({
        key: "front_desk_knowledge",
        label: "Training/knowledge added",
        copy: knowledgeReady
          ? "Website knowledge is ready for customer answers."
          : knowledgeLimited
            ? "Website knowledge exists, but another pass would improve answers."
            : "Import or add business knowledge before launch.",
        complete: knowledgeReady,
        kind: "derived",
        href: "#settings/business-profile",
        shellTarget: "settings",
        settingsTarget: "business_profile",
        icon: "sparkle",
      }),
      createReadinessItem({
        key: "front_desk_routing",
        label: "Routing/contact behavior configured",
        copy: hasRouting
          ? `${routingDestinationCount} routing destination${routingDestinationCount === 1 ? "" : "s"} available.`
          : "Add contact, booking, quote, or checkout destinations for live handoffs.",
        complete: hasRouting,
        kind: "derived",
        href: "#settings/front-desk/routing",
        shellTarget: "settings",
        settingsTarget: "front_desk",
        icon: "users",
      }),
      createReadinessItem({
        key: "front_desk_publish",
        label: "Publish/open full-page assistant link",
        copy: fullPageEnabled
          ? "Open the live Front Desk page from the existing publish flow."
          : "Enable the public page before sharing direct links, QR codes, or embeds.",
        complete: fullPageEnabled,
        kind: "derived",
        href: "#install/full-page",
        shellTarget: "install",
        installMethod: "full-page",
        icon: "install",
      }),
    ]);
  }

  function getDashboardUiStateHashUpdates(hash = "") {
    const parts = getDashboardHashPathParts(hash);
    const root = parts[0] || "";
    const updates = {};

    if (root === "settings") {
      if (parts[1]) {
        updates.settingsMainTab = getSettingsMainTabHashSegment(parts[1]);
      }
      if (["front_desk", "website_widget", "voice_agent"].includes(normalizeSettingsMainTab(parts[1])) && parts[2]) {
        updates.settingsFrontDeskTab = getSettingsFrontDeskTabHashSegment(parts[2]);
      }
      return updates;
    }

    if (root === "install") {
      if (parts[1]) {
        updates.installMethod = normalizeInstallMethod(parts[1]);
      }
      return updates;
    }

    if (["front-desk", "frontdesk", "customize"].includes(root)) {
      if (parts[1]) {
        updates.frontDeskTab = getFrontDeskSectionHashSegment(parts[1]);
      }
      if (normalizeFrontDeskSection(parts[1]) === "customization" && parts[2]) {
        updates.settingsFrontDeskTab = getSettingsFrontDeskTabHashSegment(parts[2]);
      }
      return updates;
    }

    if (["customers", "customer", "contacts"].includes(root)) {
      const params = getDashboardHashSearchParams(hash);
      const filter = normalizeCustomerFilterKey(params.get("filter") || "");
      const customer = trimText(params.get("customer") || params.get("contact"));
      if (filter) {
        updates.customersFilter = filter;
      }
      if (customer) {
        updates.selectedCustomerKey = customer;
      }
    }

    return updates;
  }

  function normalizeDashboardUiStateValue(key, value) {
    switch (key) {
      case "installMethod":
        return normalizeInstallMethod(value);
      case "installFullPageOption":
        return normalizeInstallFullPageOption(value);
      case "frontDeskTab":
        return getFrontDeskSectionHashSegment(value);
      case "customersFilter":
        return normalizeCustomerFilterKey(value) || "all";
      case "selectedCustomerKey":
      case "selectedConversationKey":
        return trimText(value);
      case "settingsMainTab":
        return getSettingsMainTabHashSegment(value);
      case "settingsFrontDeskTab":
        return getSettingsFrontDeskTabHashSegment(value);
      case "settingsFullPageTab":
      case "todayFilter":
        return trimText(value) || DASHBOARD_UI_STATE_DEFAULTS[key];
      default:
        return value ?? DASHBOARD_UI_STATE_DEFAULTS[key];
    }
  }

  global.VonzaDashboardState = Object.freeze({
    ACTIVE_DASHBOARD_PRODUCT_CONTEXT,
    DASHBOARD_PRODUCT_REGISTRY,
    DASHBOARD_PRODUCT_PACKAGING,
    DASHBOARD_PRODUCT_HOME_CONTEXT,
    DASHBOARD_UI_STATE_DEFAULTS,
    DASHBOARD_UI_STATE_PERSISTED_KEYS,
    DASHBOARD_SECTION_HASHES,
    normalizeDashboardProductKey,
    getDashboardProduct,
    getDashboardProductContext,
    getDashboardProductRoutePath,
    getDashboardProductPackaging,
    listDashboardProductPackaging,
    getDashboardProductHomeContext,
    getDashboardProductNavItems,
    exposeDashboardProductContext,
    getDashboardHashPathParts,
    getDashboardHashSearchParams,
    getDashboardHashRoot,
    getShellSectionFromHash,
    normalizeInstallMethod,
    getInstallMethodPanelKey,
    getInstallMethodHashSegment,
    normalizeInstallFullPageOption,
    SETTINGS_MAIN_TABS,
    SETTINGS_FRONT_DESK_TABS,
    SETTINGS_FRONT_DESK_TAB_LABELS,
    normalizeSettingsMainTab,
    getSettingsMainTabHashSegment,
    normalizeSettingsFrontDeskTab,
    getSettingsFrontDeskTabHashSegment,
    getSettingsFrontDeskDefaultSubtab,
    normalizeFrontDeskSection,
    getFrontDeskSectionHashSegment,
    normalizeCustomerFilterKey,
    getProductReadinessChecklist,
    getDashboardUiStateHashUpdates,
    normalizeDashboardUiStateValue,
  });
})(window);
