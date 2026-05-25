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
  const SETTINGS_MAIN_TABS = Object.freeze(["general", "front_desk", "business_profile", "account_billing", "privacy_legal"]);
  const SETTINGS_MAIN_TAB_HASH_SEGMENTS = Object.freeze({
    general: "general",
    front_desk: "front-desk",
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
    widget: "front_desk",
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

  function trimText(value) {
    return String(value || "").trim();
  }

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

    return Object.hasOwn(FRONT_DESK_SECTION_HASH_SEGMENTS, candidate) ? candidate : "practice";
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

  function getDashboardUiStateHashUpdates(hash = "") {
    const parts = getDashboardHashPathParts(hash);
    const root = parts[0] || "";
    const updates = {};

    if (root === "settings") {
      if (parts[1]) {
        updates.settingsMainTab = getSettingsMainTabHashSegment(parts[1]);
      }
      if (normalizeSettingsMainTab(parts[1]) === "front_desk" && parts[2]) {
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
    DASHBOARD_UI_STATE_DEFAULTS,
    DASHBOARD_UI_STATE_PERSISTED_KEYS,
    DASHBOARD_SECTION_HASHES,
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
    getDashboardUiStateHashUpdates,
    normalizeDashboardUiStateValue,
  });
})(window);
