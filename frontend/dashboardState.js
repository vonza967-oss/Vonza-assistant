(function registerVonzaDashboardState(global) {
  const INSTALL_METHODS = Object.freeze(["full-page", "qr", "widget"]);
  const INSTALL_METHOD_PANEL_KEYS = Object.freeze({
    "full-page": "page",
    qr: "qr",
    widget: "widget",
  });
  const INSTALL_METHOD_HASH_SEGMENTS = Object.freeze({
    "full-page": "full-page",
    qr: "qr",
    widget: "widget",
  });
  const INSTALL_FULL_PAGE_OPTIONS = Object.freeze(["share", "section", "dedicated", "takeover", "iframe"]);
  const FRONT_DESK_SECTION_HASH_SEGMENTS = Object.freeze({
    practice: "practice",
    improvements: "improvements",
    knowledge: "knowledge",
    library: "answer-library",
    launch: "launch",
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
      fullpage: "full-page",
      full: "full-page",
      assistant: "full-page",
      website: "widget",
      "website-widget": "widget",
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
        updates.settingsMainTab = parts[1];
      }
      if (["front-desk", "frontdesk", "front_desk"].includes(parts[1]) && parts[2]) {
        updates.settingsFrontDeskTab = parts[2];
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
      case "settingsFrontDeskTab":
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
    normalizeFrontDeskSection,
    getFrontDeskSectionHashSegment,
    normalizeCustomerFilterKey,
    getDashboardUiStateHashUpdates,
    normalizeDashboardUiStateValue,
  });
})(window);
