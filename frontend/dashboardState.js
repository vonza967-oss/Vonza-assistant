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
  const SETTINGS_MAIN_TABS = Object.freeze(["general", "front_desk", "website_widget", "voice_agent", "business_profile", "connected_apps", "account_billing", "privacy_legal"]);
  const SETTINGS_MAIN_TAB_HASH_SEGMENTS = Object.freeze({
    general: "general",
    front_desk: "front-desk",
    website_widget: "widget",
    voice_agent: "voice",
    business_profile: "business-profile",
    connected_apps: "connected-apps",
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
    apps: "connected_apps",
    connected: "connected_apps",
    connected_apps: "connected_apps",
    "connected-apps": "connected_apps",
    integrations: "connected_apps",
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
    setup: "setup",
    analytics: "analytics",
    install: "install",
    settings: "settings",
    privacy: "settings",
  });
  const DASHBOARD_SECTION_HASHES = Object.freeze({
    overview: "",
    contacts: "customers",
    customize: "front-desk",
    setup: "setup",
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
  const WEBSITE_WIDGET_DEDICATED_DASHBOARD_PATHS = Object.freeze([
    "/website-widget/dashboard",
    "/widget/dashboard",
  ]);
  const DASHBOARD_PRODUCT_PACKAGING = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      name: "Front Desk",
      targetUseCase: "Dedicated full-page AI Front Desk for customers who need answers, routing, and follow-up capture.",
      setupLabel: "Open Front Desk setup",
      setupHref: "/dashboard/front-desk#setup",
      settingsHref: "#settings/front-desk/full-page-assistant",
      pricingLabel: "Product pricing coming soon",
      availabilitySource: "account_access",
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      name: "Website Widget",
      targetUseCase: "Embedded website snippet and launcher for visitors who need quick answers without leaving a page.",
      setupLabel: "Open widget setup",
      setupHref: "/dashboard/widget#setup",
      settingsHref: "#settings/widget/optional-widget",
      pricingLabel: "Product pricing coming soon",
      availabilitySource: "account_access",
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      name: "Voice Agent",
      targetUseCase: "Browser voice, spoken replies, and Web Call setup for hands-free customer conversations where configured.",
      setupLabel: "Open Web Call setup",
      setupHref: "/dashboard/voice#setup",
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
        Object.freeze({ label: "Publish/open full-page", icon: "install", shellTarget: "install", installMethod: "full-page" }),
        Object.freeze({ label: "Business identity", icon: "settings", shellTarget: "settings", settingsTarget: "front_desk" }),
        Object.freeze({ label: "Preview/test assistant", icon: "sparkle", action: "preview" }),
        Object.freeze({ label: "Front Desk analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Publish/open full-page", note: "Open the existing full-page publish and share options", href: "#install/full-page", shellTarget: "install", installMethod: "full-page", icon: "install", primary: true }),
        Object.freeze({ label: "Full-page setup", note: "Open existing Front Desk page settings", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk", icon: "frontdesk" }),
        Object.freeze({ label: "QR/direct link", note: "Open the existing QR and direct-link publish path", href: "#install/full-page", shellTarget: "install", installMethod: "qr", icon: "review" }),
        Object.freeze({ label: "Business identity", note: "Review identity and welcome copy", href: "#settings/front-desk/identity-welcome", shellTarget: "settings", settingsTarget: "front_desk", icon: "settings" }),
        Object.freeze({ label: "Knowledge/training", note: "Open business knowledge settings", href: "#settings/business-profile", shellTarget: "settings", settingsTarget: "business_profile", icon: "sparkle" }),
        Object.freeze({ label: "Routing/contact capture", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Preview/test assistant", note: "Practice a realistic customer question", href: "#front-desk/practice", shellTarget: "customize", icon: "sparkle" }),
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
        Object.freeze({ label: "Embed/install snippet", icon: "install", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ label: "Widget appearance", icon: "settings", shellTarget: "settings", settingsTarget: "website_widget" }),
        Object.freeze({ label: "Test widget", icon: "sparkle", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ label: "Widget analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Embed/install snippet", note: "Open the existing Website Widget embed panel", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "install", primary: true }),
        Object.freeze({ label: "Allowed domains/status", note: "Review domain guidance and install verification", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "review" }),
        Object.freeze({ label: "Widget appearance", note: "Open Website Widget settings", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget", icon: "settings" }),
        Object.freeze({ label: "Launcher behavior", note: "Review the existing optional widget launcher settings", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget", icon: "frontdesk" }),
        Object.freeze({ label: "Test widget", note: "Use the existing embed test and verification surface", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "sparkle" }),
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
        Object.freeze({ label: "Browser voice/Web Call setup", icon: "chat", shellTarget: "settings", settingsTarget: "voice_agent" }),
        Object.freeze({ label: "Routing/contact handoff", icon: "users", shellTarget: "settings", settingsTarget: "front_desk" }),
        Object.freeze({ label: "Test voice agent", icon: "sparkle", shellTarget: "settings", settingsTarget: "voice_agent" }),
        Object.freeze({ label: "Web Call analytics", icon: "outcomes", target: "analytics" }),
      ]),
      shortcuts: Object.freeze([
        Object.freeze({ label: "Browser voice/Web Call setup", note: "Open Voice Agent settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "chat", primary: true }),
        Object.freeze({ label: "Voice/personality settings", note: "Review voice style, language behavior, and spoken replies", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "settings" }),
        Object.freeze({ label: "Spoken replies readiness", note: "Check voice input, spoken replies, and Web Call together", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "review" }),
        Object.freeze({ label: "Test voice agent", note: "Use the existing owner voice QA simulator", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "sparkle" }),
        Object.freeze({ label: "Routing/contact handoff", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Web Call transcripts/analytics", note: "Review available analytics signals", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
    }),
  });
  const DASHBOARD_PRODUCT_SETUP_CONTEXT = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      title: "Set up Front Desk",
      eyebrow: "Front Desk setup",
      copy: "Configure the full-page customer surface, then publish and test the hosted Front Desk page.",
      primaryAction: Object.freeze({ label: "Publish/open Front Desk page", href: "#install/full-page", shellTarget: "install", installMethod: "full-page", icon: "install" }),
      secondaryActions: Object.freeze([
        Object.freeze({ label: "Business identity", note: "Review customer-facing identity and welcome copy", href: "#settings/front-desk/identity-welcome", shellTarget: "settings", settingsTarget: "front_desk", icon: "settings" }),
        Object.freeze({ label: "Knowledge/training", note: "Open business profile and knowledge setup", href: "#settings/business-profile", shellTarget: "settings", settingsTarget: "business_profile", icon: "sparkle" }),
        Object.freeze({ label: "Full-page assistant configuration", note: "Tune headline, prompts, trust copy, and public access", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk", icon: "frontdesk" }),
        Object.freeze({ label: "QR/direct link", note: "Open the existing QR and direct-link publish path", href: "#install/full-page", shellTarget: "install", installMethod: "qr", icon: "review" }),
        Object.freeze({ label: "Routing/contact capture", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Preview/test assistant", note: "Practice a realistic customer question", href: "#front-desk/practice", shellTarget: "customize", icon: "sparkle" }),
      ]),
      launchPath: Object.freeze([
        Object.freeze({ label: "Configure", note: "Finish business identity, knowledge, page settings, and routing.", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk", icon: "settings" }),
        Object.freeze({ label: "Test", note: "Use Practice to check the assistant with a real customer question.", href: "#front-desk/practice", shellTarget: "customize", icon: "sparkle" }),
        Object.freeze({ label: "Launch", note: "Publish or open the full-page Front Desk, then share QR/direct links.", href: "#install/full-page", shellTarget: "install", installMethod: "full-page", icon: "install" }),
      ]),
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      title: "Set up Website Widget",
      eyebrow: "Website Widget setup",
      copy: "Configure the secondary embedded launcher using the existing widget settings, install, verification, and analytics surfaces.",
      primaryAction: Object.freeze({ label: "Open embed/install snippet", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "install" }),
      secondaryActions: Object.freeze([
        Object.freeze({ label: "Widget appearance", note: "Review launcher copy, colors, and welcome text", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget", icon: "settings" }),
        Object.freeze({ label: "Allowed domains", note: "Use the existing install surface for domain guidance and status", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "review" }),
        Object.freeze({ label: "Embed/install snippet", note: "Open the current Website Widget snippet", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "install" }),
        Object.freeze({ label: "Install verification", note: "Check whether widget markup has been detected", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "review" }),
        Object.freeze({ label: "Test widget", note: "Use the existing widget install/test surface", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "sparkle" }),
        Object.freeze({ label: "Widget analytics/conversations", note: "Review shared analytics and customer records", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
      launchPath: Object.freeze([
        Object.freeze({ label: "Style", note: "Confirm widget appearance and launcher behavior.", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget", icon: "settings" }),
        Object.freeze({ label: "Install", note: "Copy the embed snippet and verify it on an allowed domain.", href: "#install/embed", shellTarget: "install", installMethod: "widget", icon: "install" }),
        Object.freeze({ label: "Measure", note: "Review widget conversations and analytics after traffic arrives.", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      title: "Set up Voice Agent",
      eyebrow: "Voice Agent setup",
      copy: "Configure browser voice, spoken replies, Web Call readiness, handoff behavior, tests, and transcripts from existing dashboard surfaces.",
      primaryAction: Object.freeze({ label: "Open Web Call settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "chat" }),
      secondaryActions: Object.freeze([
        Object.freeze({ label: "Browser voice/Web Call readiness", note: "Review voice input, spoken replies, and Web Call together", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "chat" }),
        Object.freeze({ label: "Voice/personality settings", note: "Review voice style and language behavior", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "settings" }),
        Object.freeze({ label: "Spoken replies", note: "Confirm spoken reply behavior before testing", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "review" }),
        Object.freeze({ label: "Routing/contact handoff", note: "Review shared handoff destinations", href: "#settings/front-desk/routing", shellTarget: "settings", settingsTarget: "front_desk", icon: "users" }),
        Object.freeze({ label: "Test Web Call", note: "Use the existing owner voice QA simulator", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "sparkle" }),
        Object.freeze({ label: "Web Call analytics/transcripts", note: "Review available Web Call analytics signals", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
      ]),
      launchPath: Object.freeze([
        Object.freeze({ label: "Prepare", note: "Enable browser voice, spoken replies, and Web Call readiness.", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "chat" }),
        Object.freeze({ label: "Test", note: "Run a Web Call test from the existing voice settings surface.", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent", icon: "sparkle" }),
        Object.freeze({ label: "Review", note: "Use analytics for Web Call transcripts and conversation signals.", href: "#analytics", shellTarget: "analytics", icon: "outcomes" }),
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
    const isDedicatedWebsiteWidgetDashboard = WEBSITE_WIDGET_DEDICATED_DASHBOARD_PATHS.includes(normalizedPath);
    if (isDedicatedWebsiteWidgetDashboard) {
      const product = getDashboardProduct("website_widget");

      return Object.freeze({
        ...product,
        routeSegment: "website-widget",
        currentPath: normalizedPath,
        canonicalPath: "/website-widget/dashboard",
        isDefaultDashboardPath: false,
        isKnownProductPath: true,
        isDedicatedProductDashboard: true,
      });
    }

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
      isDedicatedProductDashboard: false,
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

  function getDashboardProductSetupContext(key = "front_desk") {
    const product = getDashboardProduct(normalizeDashboardProductKey(key));
    return DASHBOARD_PRODUCT_SETUP_CONTEXT[product.key] || DASHBOARD_PRODUCT_SETUP_CONTEXT.front_desk;
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

  const READINESS_DEFAULT_WIDGET_VALUES = Object.freeze({
    buttonLabels: Object.freeze(["chat with vonza", "open front desk", "chat"]),
    welcomeMessages: Object.freeze([
      "how may i be of your service today?",
      "hi! how can we help today?",
    ]),
    colors: Object.freeze(["#10a37f", "#0c7f75", "#5b61ff", "#7c4dff", "#14b8a6", "#0f766e"]),
  });

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
    const buttonLabel = trimText(agent.buttonLabel || agent.button_label).toLowerCase();
    const welcomeMessage = trimText(agent.welcomeMessage || agent.welcome_message).toLowerCase();
    const primaryColor = trimText(agent.primaryColor || agent.primary_color).toLowerCase();
    const secondaryColor = trimText(agent.secondaryColor || agent.secondary_color).toLowerCase();

    return Boolean(
      trimText(agent.widgetLogoUrl || agent.widget_logo_url)
      || (buttonLabel && !READINESS_DEFAULT_WIDGET_VALUES.buttonLabels.includes(buttonLabel))
      || (welcomeMessage && !READINESS_DEFAULT_WIDGET_VALUES.welcomeMessages.includes(welcomeMessage))
      || (primaryColor && !READINESS_DEFAULT_WIDGET_VALUES.colors.includes(primaryColor))
      || (secondaryColor && !READINESS_DEFAULT_WIDGET_VALUES.colors.includes(secondaryColor))
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

  function getReadinessArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getReadinessNumber(value) {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  function getReadinessMessageSourceText(message = {}) {
    return [
      message.displayMode,
      message.display_mode,
      message.conversationSource,
      message.conversation_source,
      message.source,
      message.sourceType,
      message.source_type,
      message.captureSource,
      message.capture_source,
      message.sourceRoute,
      message.source_route,
      message.webCallId,
      message.web_call_id,
      message.webCallSessionId,
      message.web_call_session_id,
    ].map((value) => trimText(value).toLowerCase()).filter(Boolean).join(" ");
  }

  function hasReadinessSourceBucketActivity(bucket = {}) {
    return getReadinessNumber(bucket.conversationCount || bucket.conversation_count) > 0
      || getReadinessNumber(bucket.messageCount || bucket.message_count) > 0
      || getReadinessNumber(bucket.visitorQuestionCount || bucket.visitor_question_count) > 0
      || getReadinessNumber(bucket.leadsCaptured || bucket.leads_captured) > 0;
  }

  function getReadinessOwnerAnalyticsDashboard(snapshot = {}) {
    return snapshot.ownerAnalyticsDashboard || snapshot.actionQueue?.ownerAnalyticsDashboard || {};
  }

  function hasReadinessFrontDeskActivity(snapshot = {}) {
    const messages = getReadinessArray(snapshot.messages);
    const dashboard = getReadinessOwnerAnalyticsDashboard(snapshot);
    const pageBucket = dashboard.assistantSource?.page || dashboard.assistant_source?.page || {};

    return messages.some((message) => {
      const sourceText = getReadinessMessageSourceText(message);
      return /\bpage\b/.test(sourceText) || sourceText.includes("full_page") || sourceText.includes("public_page");
    }) || hasReadinessSourceBucketActivity(pageBucket);
  }

  function hasReadinessWidgetActivity(snapshot = {}, agent = {}) {
    const messages = getReadinessArray(snapshot.messages);
    const dashboard = getReadinessOwnerAnalyticsDashboard(snapshot);
    const widgetBucket = dashboard.assistantSource?.widget || dashboard.assistant_source?.widget || {};
    const widgetMetrics = snapshot.widgetMetrics || agent.widgetMetrics || agent.widget_metrics || {};

    return messages.some((message) => getReadinessMessageSourceText(message).includes("widget"))
      || hasReadinessSourceBucketActivity(widgetBucket)
      || getReadinessNumber(widgetMetrics.conversationStartedCount || widgetMetrics.conversation_started_count) > 0
      || getReadinessNumber(widgetMetrics.conversationsSinceInstall || widgetMetrics.conversations_since_install) > 0
      || getReadinessNumber(widgetMetrics.uniqueSessionCount || widgetMetrics.unique_session_count) > 0
      || getReadinessNumber(widgetMetrics.contactCapturedCount || widgetMetrics.contact_captured_count) > 0
      || getReadinessNumber(widgetMetrics.ctaClicks || widgetMetrics.cta_clicks) > 0;
  }

  function hasReadinessWebCallActivity(snapshot = {}) {
    const messages = getReadinessArray(snapshot.messages);
    const dashboard = getReadinessOwnerAnalyticsDashboard(snapshot);
    const webCallBucket = dashboard.assistantSource?.web_call
      || dashboard.assistantSource?.webCall
      || dashboard.assistant_source?.web_call
      || dashboard.assistant_source?.webCall
      || {};
    const webCallHealth = snapshot.webCallHealth || dashboard.webCallHealth || dashboard.web_call_health || {};
    const recentCalls = snapshot.recentWebCalls || dashboard.webCallRecentCalls || dashboard.web_call_recent_calls || {};
    const recentCallItems = getReadinessArray(recentCalls.calls || recentCalls.items);

    return messages.some((message) => getReadinessMessageSourceText(message).includes("web_call"))
      || hasReadinessSourceBucketActivity(webCallBucket)
      || getReadinessNumber(webCallHealth.starts) > 0
      || getReadinessNumber(recentCalls.total) > 0
      || recentCallItems.length > 0;
  }

  function hasReadinessTrainingKnowledge(frontDeskTraining = {}) {
    return getReadinessArray(frontDeskTraining.items).some((item) => {
      const status = trimText(item.status).toLowerCase();
      const type = trimText(item.type).toLowerCase();
      return status === "active" && ["approved_answer", "business_fact", "correction"].includes(type);
    });
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
    const frontDeskActivity = hasReadinessFrontDeskActivity(snapshot);
    const widgetActivity = hasReadinessWidgetActivity(snapshot, agent);
    const webCallActivity = hasReadinessWebCallActivity(snapshot);
    const trainingKnowledgeReady = hasReadinessTrainingKnowledge(snapshot.frontDeskTraining);

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
          copy: widgetActivity
            ? "Widget-sourced conversation or telemetry activity exists in the current snapshot."
            : "Use the existing install panel to copy or test the secondary website widget.",
          complete: widgetActivity ? true : null,
          kind: widgetActivity ? "derived" : "action",
          href: "#install/embed",
          shellTarget: "install",
          installMethod: "widget",
          icon: "sparkle",
        }),
        createReadinessItem({
          key: "widget_analytics",
          label: "Widget analytics/conversations",
          copy: "Open shared Analytics and Customers to review widget conversations, leads, and outcomes.",
          complete: null,
          kind: "action",
          href: "#analytics",
          shellTarget: "analytics",
          icon: "outcomes",
        }),
      ]);
    }

    if (normalizedProductKey === "voice_agent") {
      const spokenRepliesReady = webCallState.spokenRepliesEnabled === true;
      return Object.freeze([
        createReadinessItem({
          key: "voice_settings",
          label: "Browser voice/Web Call readiness",
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
          key: "voice_personality",
          label: "Voice/personality settings",
          copy: "Open existing Voice Agent settings to review voice style and language behavior.",
          complete: null,
          kind: "action",
          href: "#settings/voice/voice",
          shellTarget: "settings",
          settingsTarget: "voice_agent",
          icon: "settings",
        }),
        createReadinessItem({
          key: "voice_spoken_replies",
          label: "Spoken replies configured",
          copy: spokenRepliesReady
            ? "Spoken replies are enabled in the current voice settings."
            : "Review spoken replies before relying on Web Call tests.",
          complete: spokenRepliesReady,
          kind: "derived",
          href: "#settings/voice/voice",
          shellTarget: "settings",
          settingsTarget: "voice_agent",
          icon: "review",
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
          label: "Test Web Call action",
          copy: webCallActivity
            ? "Web Call message, health, or recent call activity exists in the current snapshot."
            : "Use the existing Voice Agent settings and owner QA simulator to run a Web Call test.",
          complete: webCallActivity ? true : null,
          kind: webCallActivity ? "derived" : "action",
          href: "#settings/voice/voice",
          shellTarget: "settings",
          settingsTarget: "voice_agent",
          icon: "sparkle",
        }),
        createReadinessItem({
          key: "voice_analytics",
          label: "Web Call analytics/transcripts",
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
        copy: fullPageEnabled && fullPageCustomized
          ? "The hosted Front Desk page is enabled and customized."
          : fullPageEnabled
            ? "The hosted Front Desk page is enabled; review the customer-facing content before launch."
          : fullPageCustomized
            ? "Full-page content has been customized; public access still needs review."
            : "Review the hosted Front Desk page headline, prompts, trust copy, and public access.",
        complete: fullPageEnabled && fullPageCustomized,
        kind: "derived",
        href: "#settings/front-desk/full-page-assistant",
        shellTarget: "settings",
        settingsTarget: "front_desk",
        icon: "frontdesk",
      }),
      createReadinessItem({
        key: "front_desk_knowledge",
        label: "Training/knowledge added",
        copy: knowledgeReady || trainingKnowledgeReady
          ? "Website knowledge is ready for customer answers."
          : knowledgeLimited
            ? "Website knowledge exists, but another pass would improve answers."
            : "Import or add business knowledge before launch.",
        complete: knowledgeReady || trainingKnowledgeReady,
        kind: "derived",
        href: "#settings/business-profile",
        shellTarget: "settings",
        settingsTarget: "business_profile",
        icon: "sparkle",
      }),
      createReadinessItem({
        key: "front_desk_qr_direct_link",
        label: "QR/direct link path reviewed",
        copy: "Open the existing QR and direct-link publish path for the hosted Front Desk page.",
        complete: null,
        kind: "action",
        href: "#install/full-page",
        shellTarget: "install",
        installMethod: "qr",
        icon: "review",
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
        key: "front_desk_test",
        label: "Front Desk page tested",
        copy: frontDeskActivity
          ? "Page-mode conversation or analytics activity exists in the current snapshot."
          : "Preview the hosted Front Desk page and send a realistic customer question.",
        complete: frontDeskActivity ? true : null,
        kind: frontDeskActivity ? "derived" : "action",
        href: "#front-desk/practice",
        shellTarget: "customize",
        icon: "sparkle",
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
    DASHBOARD_PRODUCT_SETUP_CONTEXT,
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
    getDashboardProductSetupContext,
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
