(function registerVonzaSettingsShell(global) {
  const SETTINGS_STORAGE_KEY = "vonza_dashboard_settings_section";
  const SETTINGS_SECTION_DETAILS = [
    {
      key: "general",
      label: "General",
      note: "Assistant name, tone, launcher text, and basic branding.",
    },
    {
      key: "front_desk",
      label: "Front Desk",
      note: "Customer-facing behavior, welcome, routing, and launch readiness.",
    },
    {
      key: "business_profile",
      label: "Business Profile",
      note: "Business facts Vonza uses to answer customer questions.",
    },
  ];
  const SETTINGS_SECTIONS = Object.freeze(SETTINGS_SECTION_DETAILS.map((section) => section.key));
  const SETTINGS_SECTION_ALIASES = Object.freeze({
    assistant: "general",
    branding: "general",
    workspace_preferences: "general",
    customize: "front_desk",
    widget: "front_desk",
    business: "business_profile",
    business_context: "business_profile",
    profile: "business_profile",
    workspace: "business_profile",
    account: "business_profile",
    account_billing: "business_profile",
    privacy: "business_profile",
    privacy_controls: "business_profile",
    connected_tools: "front_desk",
    integrations: "front_desk",
  });
  const DEFAULT_TRANSLATIONS = Object.freeze({
    "language.settingsTitle": "Dashboard language",
    "language.settingsCopy": "Choose the language used by the logged-in dashboard.",
    "language.noChanges": "No changes yet.",
    "language.save": "Save language",
    "nav.utilities": "Utilities",
    "settings.title": "Settings",
    "settings.copy": "Control assistant branding, business context, billing, privacy, and workspace access.",
    "settings.theme": "Theme",
    "settings.themeCopy": "Choose how the dashboard looks in this browser. Light is the default.",
    "settings.light": "Light",
    "settings.dark": "Dark",
  });
  const LEGAL_LINKS = Object.freeze([
    { href: "/aszf", label: "ÁSZF" },
    { href: "/impresszum", label: "Impresszum" },
    { href: "/adatkezelesi-tajekoztato", label: "Adatkezelési tájékoztató" },
    { href: "/cookie-tajekoztato", label: "Cookie tájékoztató" },
  ]);
  const WIDGET_PURPOSE_OPTIONS = Object.freeze([
    {
      value: "guidance",
      label: "Guidance",
      description: "Help visitors find what they need quickly.",
    },
    {
      value: "support",
      label: "Support",
      description: "Answer customer questions and solve common issues.",
    },
    {
      value: "make_decision",
      label: "Make a decision",
      description: "Help visitors choose the right service, product, or next step.",
    },
    {
      value: "lead_capture",
      label: "Lead capture / contact",
      description: "Guide warm visitors toward contact details or follow-up.",
    },
    {
      value: "booking_next_step",
      label: "Booking / next step guidance",
      description: "Help visitors book, request a quote, or move forward.",
    },
  ]);

  function defaultTrimText(value) {
    return String(value || "").trim();
  }

  function defaultEscapeHtml(value) {
    return String(value ?? "");
  }

  function defaultGetBadgeClass() {
    return "pill";
  }

  function defaultTranslate(key) {
    return DEFAULT_TRANSLATIONS[key] || key;
  }

  function defaultBuildPageHeader({ eyebrow = "", title = "", copy = "" } = {}) {
    return `
      <header class="page-header">
        <div class="page-header-copy">
          ${eyebrow ? `<p class="page-eyebrow">${defaultEscapeHtml(eyebrow)}</p>` : ""}
          ${title ? `<h1 class="page-title">${defaultEscapeHtml(title)}</h1>` : ""}
          ${copy ? `<p class="page-copy">${defaultEscapeHtml(copy)}</p>` : ""}
        </div>
      </header>
    `;
  }

  function defaultCreateEmptyOperatorWorkspace() {
    return {
      status: {},
      connectedAccounts: [],
      billing: defaultBillingSnapshot(),
      businessProfile: {
        readiness: {},
        prefill: {},
      },
    };
  }

  function defaultBusinessProfileViewModel() {
    return {
      readiness: {
        completedSections: 0,
        totalSections: 0,
        missingCount: 0,
        summary: "Business profile readiness will appear here.",
      },
      prefill: {
        available: false,
        fieldCount: 0,
        sourceSummary: "",
      },
      fields: {
        businessSummary: "",
        services: "",
        pricing: "",
        policies: "",
        serviceAreas: "",
        operatingHours: "",
      },
      approvedContactChannels: [],
      approvalPreferences: {
        followUpDrafts: "owner_required",
        contactNextSteps: "owner_required",
        taskRecommendations: "owner_required",
        outcomeRecommendations: "owner_required",
        profileChanges: "owner_required",
      },
    };
  }

  function defaultBehaviorSummary() {
    return {
      title: "Warm and welcoming",
      copy: "Vonza will sound approachable and reassuring while still staying useful and clear.",
    };
  }

  function defaultGoogleWorkspaceCapabilities() {
    return {
      calendarWrite: false,
      gmailRead: false,
    };
  }

  function defaultWorkspaceMode() {
    return {
      title: "Workspace mode unavailable",
      copy: "Workspace mode will appear here when customer service workspace data is available.",
    };
  }

  function defaultInstallStatus() {
    return {
      label: "Not installed yet",
    };
  }

  function defaultBillingSnapshot() {
    return {
      planKey: "",
      displayName: "",
      monthlyPriceCents: 0,
      monthlyPriceUsd: 0,
      monthlyPriceLabel: "",
      billingInterval: "",
      includedAiBudgetCents: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      subscriptionStatus: "pending",
      hasActiveSubscription: false,
      usage: {
        usedCents: 0,
        includedCents: 0,
        remainingCents: 0,
        percentUsed: 0,
        warningState: "normal",
        warningThreshold: 0,
        tone: "ok",
        statusLabel: "",
        ownerMessage: "",
        isCapped: false,
      },
      upgradeOptions: [],
    };
  }

  function formatBillingPercent(value) {
    const percent = Math.max(0, Math.min(100, Number(value || 0) || 0));
    return `${Math.round(percent)}%`;
  }

  function formatBillingDate(value) {
    const timestamp = new Date(value || "").getTime();

    if (!Number.isFinite(timestamp)) {
      return "Not available yet";
    }

    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function normalizeWidgetPurpose(value) {
    const normalized = defaultTrimText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (WIDGET_PURPOSE_OPTIONS.some((option) => option.value === normalized)) {
      return normalized;
    }

    if (/decision|decide|choose|compare/.test(normalized)) {
      return "make_decision";
    }
    if (/lead|capture|contact|follow_up|quote/.test(normalized)) {
      return "lead_capture";
    }
    if (/book|booking|next_step/.test(normalized)) {
      return "booking_next_step";
    }
    if (/guid|find|navigate/.test(normalized)) {
      return "guidance";
    }

    return "support";
  }

  function getWidgetPurposeOption(value) {
    const normalizedPurpose = normalizeWidgetPurpose(value);
    return WIDGET_PURPOSE_OPTIONS.find((option) => option.value === normalizedPurpose) || WIDGET_PURPOSE_OPTIONS[1];
  }

  function getHelpers(options = {}) {
    return {
      escapeHtml: typeof options.escapeHtml === "function" ? options.escapeHtml : defaultEscapeHtml,
      trimText: typeof options.trimText === "function" ? options.trimText : defaultTrimText,
      getBadgeClass: typeof options.getBadgeClass === "function" ? options.getBadgeClass : defaultGetBadgeClass,
      buildPageHeader: typeof options.buildPageHeader === "function" ? options.buildPageHeader : defaultBuildPageHeader,
      createEmptyOperatorWorkspace:
        typeof options.createEmptyOperatorWorkspace === "function"
          ? options.createEmptyOperatorWorkspace
          : defaultCreateEmptyOperatorWorkspace,
      getBusinessProfileViewModel:
        typeof options.getBusinessProfileViewModel === "function"
          ? options.getBusinessProfileViewModel
          : defaultBusinessProfileViewModel,
      buildBehaviorSummary:
        typeof options.buildBehaviorSummary === "function"
          ? options.buildBehaviorSummary
          : defaultBehaviorSummary,
      isCapabilityExplicitlyVisible:
        typeof options.isCapabilityExplicitlyVisible === "function"
          ? options.isCapabilityExplicitlyVisible
          : () => false,
      getPublicAppUrl: typeof options.getPublicAppUrl === "function" ? options.getPublicAppUrl : () => "",
      getGoogleWorkspaceCapabilities:
        typeof options.getGoogleWorkspaceCapabilities === "function"
          ? options.getGoogleWorkspaceCapabilities
          : defaultGoogleWorkspaceCapabilities,
      getWorkspaceMode:
        typeof options.getWorkspaceMode === "function"
          ? options.getWorkspaceMode
          : defaultWorkspaceMode,
      normalizeAccessStatus:
        typeof options.normalizeAccessStatus === "function"
          ? options.normalizeAccessStatus
          : (value) => defaultTrimText(value) || "Unknown",
      getDefaultInstallStatus:
        typeof options.getDefaultInstallStatus === "function"
          ? options.getDefaultInstallStatus
          : defaultInstallStatus,
      t: typeof options.t === "function" ? options.t : defaultTranslate,
      translateDashboardText:
        typeof options.translateDashboardText === "function"
          ? options.translateDashboardText
          : (value) => String(value ?? ""),
      localizeDashboardHtml:
        typeof options.localizeDashboardHtml === "function"
          ? options.localizeDashboardHtml
          : (html) => String(html ?? ""),
      getDashboardLanguage:
        typeof options.getDashboardLanguage === "function"
          ? options.getDashboardLanguage
          : () => "en",
      getSupportedDashboardLanguages:
        typeof options.getSupportedDashboardLanguages === "function"
          ? options.getSupportedDashboardLanguages
          : () => [
            { code: "en", nativeLabel: "English" },
            { code: "hu", nativeLabel: "Magyar" },
          ],
    };
  }

  function normalizeSettingsSection(sectionKey) {
    const normalized = defaultTrimText(sectionKey).toLowerCase();

    if (SETTINGS_SECTIONS.includes(normalized)) {
      return normalized;
    }

    return SETTINGS_SECTION_ALIASES[normalized] || SETTINGS_SECTIONS[0];
  }

  function getSectionByKey(sectionKey) {
    return SETTINGS_SECTION_DETAILS.find((section) => section.key === normalizeSettingsSection(sectionKey)) || SETTINGS_SECTION_DETAILS[0];
  }

  function buildLegalLinksMarkup() {
    return `
      <div class="app-legal-links">
        ${LEGAL_LINKS.map((link) => `
          <a href="${defaultEscapeHtml(link.href)}" target="_blank" rel="noreferrer">${defaultEscapeHtml(link.label)}</a>
        `).join("")}
      </div>
    `;
  }

  function getActiveSettingsSection() {
    return normalizeSettingsSection(global.localStorage?.getItem(SETTINGS_STORAGE_KEY));
  }

  function setActiveSettingsSection(section) {
    global.localStorage?.setItem(SETTINGS_STORAGE_KEY, normalizeSettingsSection(section));
  }

  function renderSettingsIcon(name) {
    const icons = {
      general: '<path d="M12 3v2.2M12 18.8V21M4.64 4.64l1.56 1.56M17.8 17.8l1.56 1.56M3 12h2.2M18.8 12H21M4.64 19.36l1.56-1.56M17.8 6.2l1.56-1.56"/><circle cx="12" cy="12" r="3.2"/>',
      team: '<path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4"/><circle cx="9.5" cy="7" r="4"/><path d="M22 19c0-2-1.2-3.4-3-3.8"/><path d="M16 3.4a4 4 0 0 1 0 7.2"/>',
      notifications: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
      privacy: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      integrations: '<path d="M12 2v5M12 17v5M4.93 4.93l3.54 3.54M15.54 15.54l3.53 3.53M2 12h5M17 12h5M4.93 19.07l3.54-3.53M15.54 8.46l3.53-3.53"/>',
      front_desk: '<path d="M4 6h16v10H7l-3 3V6Z"/><path d="M8 10h8M8 13h5"/>',
      business_profile: '<path d="M4 21V5a2 2 0 0 1 2-2h9l5 5v13"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h8"/>',
      external: '<path d="M14 3h7v7"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      check: '<path d="m20 6-11 11-5-5"/>',
      alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    };

    return `<svg class="settings-shell-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.general}</svg>`;
  }

  function buildDesktopSettingsNav(activeSettingsSection, helpers) {
    const { escapeHtml, t, translateDashboardText } = helpers;

    return `
      <div class="settings-shell-nav-group settings-shell-top-nav-group" data-settings-nav="desktop">
        <div class="settings-shell-nav">
          ${SETTINGS_SECTION_DETAILS.map((section) => `
            <button
              class="settings-shell-nav-button ${activeSettingsSection === section.key ? "active" : ""}"
              type="button"
              data-settings-target="${escapeHtml(section.key)}"
              data-settings-scroll-target="settings-section-${escapeHtml(section.key)}"
              aria-current="${activeSettingsSection === section.key ? "page" : "false"}"
              title="${escapeHtml(translateDashboardText(section.note))}"
            >${renderSettingsIcon(section.key)}<span>${escapeHtml(translateDashboardText(section.label))}</span></button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildMobileSettingsNav(activeSettingsSection, helpers) {
    const { escapeHtml, t, translateDashboardText } = helpers;
    const activeSection = getSectionByKey(activeSettingsSection);

    return `
      <div class="settings-shell-mobile-bar" data-settings-nav="mobile">
        <label class="settings-shell-mobile-label" for="settings-shell-section-select">${escapeHtml(t("settings.title"))}</label>
        <select
          id="settings-shell-section-select"
          class="settings-shell-mobile-select"
          data-settings-target="select"
          aria-label="Settings section"
        >
          ${SETTINGS_SECTION_DETAILS.map((section) => `
            <option value="${escapeHtml(section.key)}" ${activeSettingsSection === section.key ? "selected" : ""}>${escapeHtml(translateDashboardText(section.label))}</option>
          `).join("")}
        </select>
        <p class="settings-shell-mobile-copy" data-settings-mobile-note>${escapeHtml(translateDashboardText(activeSection.note))}</p>
      </div>
    `;
  }

  function buildBusinessContextSetupPanel(operatorWorkspace, helpers) {
    const { escapeHtml, getBadgeClass, getBusinessProfileViewModel } = helpers;
    const profile = getBusinessProfileViewModel(operatorWorkspace);

    return `
      <form data-settings-form data-form-kind="business-context" data-settings-section="business_profile" class="settings-shell-form settings-shell-form--system" id="settings-section-business_profile">
        <header class="settings-shell-page-header" id="business-context-setup">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Business profile</p>
            <h2 class="settings-shell-page-title">Business profile</h2>
            <p class="settings-shell-page-copy">Keep the core business details Vonza uses to answer customer questions, explain services, and guide visitors toward the right next step.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs details" : "Profile ready"}</span>
            <span class="${getBadgeClass(profile.prefill?.available ? "Ready" : "Limited")}">${profile.prefill?.available ? "Safe suggestions loaded" : "No prefill available"}</span>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Setup status</h3>
              <p class="settings-shell-section-copy">Review what is ready and what still needs detail before this profile can support customer questions well.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Readiness</p>
                <h4 class="settings-shell-status-value">${escapeHtml(`${profile.readiness?.completedSections || 0} / ${profile.readiness?.totalSections || 0} sections ready`)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(profile.readiness?.summary || "Business profile readiness will appear here.")}</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Prefill review</p>
                <h4 class="settings-shell-status-value">${escapeHtml(profile.prefill?.available ? `${profile.prefill?.fieldCount || 0} suggested fields loaded` : "No prefill available")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(profile.prefill?.available
                  ? `${profile.prefill?.sourceSummary || "Suggestions are ready for review before saving."}`.trim()
                  : profile.prefill?.sourceSummary || "Website import suggestions are not available yet. Run website import to unlock more grounded suggestions.")}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Core business facts</h3>
              <p class="settings-shell-section-copy">Keep this concise and customer-service focused. This is the working context Vonza should trust when customers ask for help.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="business-summary">Business summary</label>
              <textarea id="business-summary" name="business_summary">${escapeHtml(profile.fields.businessSummary || "")}</textarea>
              <p class="field-help">One short paragraph. Explain what the business does, who it serves, and what matters operationally.</p>
            </div>
            <div class="field">
              <label for="business-services">Services</label>
              <textarea id="business-services" name="services">${escapeHtml(profile.fields.services || "")}</textarea>
              <p class="field-help">One service per line. Format: &#96;Service name | optional note&#96;.</p>
            </div>
            <div class="field">
              <label for="business-pricing">Pricing</label>
              <textarea id="business-pricing" name="pricing">${escapeHtml(profile.fields.pricing || "")}</textarea>
              <p class="field-help">One pricing rule per line. Format: &#96;Label | amount or range | optional detail&#96;.</p>
            </div>
            <div class="field">
              <label for="business-policies">Policies</label>
              <textarea id="business-policies" name="policies">${escapeHtml(profile.fields.policies || "")}</textarea>
              <p class="field-help">One policy per line. Format: &#96;Policy label | detail&#96;.</p>
            </div>
            <div class="field">
              <label for="business-service-areas">Service areas / locations</label>
              <textarea id="business-service-areas" name="service_areas">${escapeHtml(profile.fields.serviceAreas || "")}</textarea>
              <p class="field-help">One area per line. Format: &#96;Area | optional note&#96;.</p>
            </div>
            <div class="field">
              <label for="business-operating-hours">Operating hours</label>
              <textarea id="business-operating-hours" name="operating_hours">${escapeHtml(profile.fields.operatingHours || "")}</textarea>
              <p class="field-help">One schedule line at a time. Format: &#96;Day or range | hours&#96;.</p>
            </div>
          </div>
        </section>

        <div class="settings-shell-sticky-save">
          <span data-save-state class="save-state">No changes yet.</span>
          <button class="primary-button" type="submit">Save Business Profile</button>
        </div>
      </form>
    `;
  }

  function buildFrontDeskSettingsForm(agent, setup, helpers) {
    const {
      escapeHtml,
      trimText,
      getBadgeClass,
      buildBehaviorSummary,
      isCapabilityExplicitlyVisible,
      getPublicAppUrl,
      getDefaultInstallStatus,
    } = helpers;
    const knowledgeActionLabel = setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge";
    const behaviorSummary = buildBehaviorSummary(agent.tone, agent.systemPrompt);
    const manualOutcomeVisible = isCapabilityExplicitlyVisible("manual_outcome_marks");
    const advancedGuidanceVisible = isCapabilityExplicitlyVisible("advanced_guidance");
    const installStatus = getDefaultInstallStatus(agent);
    const selectedPurpose = normalizeWidgetPurpose(agent.purpose);
    const selectedPurposeOption = getWidgetPurposeOption(selectedPurpose);

    return `
      <form data-settings-form data-form-kind="customize" data-settings-section="front_desk" class="settings-shell-form settings-shell-form--system" id="settings-section-front_desk">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Front Desk</p>
            <h2 class="settings-shell-page-title">Front Desk</h2>
            <p class="settings-shell-page-copy">Adjust how the customer-facing front desk speaks, routes, and represents the business without turning settings into a dashboard.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="badge success">${escapeHtml(selectedPurposeOption.label)}</span>
            <span class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
            <span class="${getBadgeClass(setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Pending")}">${escapeHtml(setup.knowledgeState === "ready" ? "Knowledge ready" : setup.knowledgeState === "limited" ? "Knowledge limited" : "Knowledge missing")}</span>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Widget purpose</h3>
              <p class="settings-shell-section-copy">What should your widget mainly help visitors do?</p>
            </div>
          </div>
          <div class="settings-shell-choice-list">
            ${WIDGET_PURPOSE_OPTIONS.map((option) => `
              <label class="settings-shell-choice-row" for="widget-purpose-${escapeHtml(option.value)}">
                <div class="settings-shell-choice-main">
                  <p class="settings-shell-choice-title">${escapeHtml(option.label)}</p>
                  <p class="settings-shell-key-value-copy">${escapeHtml(option.description)}</p>
                </div>
                <input id="widget-purpose-${escapeHtml(option.value)}" name="widget_purpose" type="radio" value="${escapeHtml(option.value)}" ${selectedPurpose === option.value ? "checked" : ""}>
              </label>
            `).join("")}
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Identity and welcome</h3>
              <p class="settings-shell-section-copy">Keep this customer-facing. The goal is a front desk that feels native to the business from the first interaction.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="assistant-name">Assistant name</label>
              <input id="assistant-name" name="assistant_name" type="text" value="${escapeHtml(agent.assistantName || agent.name || "")}">
            </div>
            <div class="field">
              <label for="assistant-tone">Conversation tone</label>
              <select id="assistant-tone" name="tone">
                <option value="friendly" ${agent.tone === "friendly" ? "selected" : ""}>friendly</option>
                <option value="professional" ${agent.tone === "professional" ? "selected" : ""}>professional</option>
                <option value="sales" ${agent.tone === "sales" ? "selected" : ""}>sales</option>
                <option value="support" ${agent.tone === "support" ? "selected" : ""}>support</option>
              </select>
            </div>
            <div class="field">
              <label for="assistant-button-label">Launcher text</label>
              <input id="assistant-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}">
            </div>
            <div class="field">
              <label for="assistant-website">Website URL</label>
              <input id="assistant-website" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}">
              <p class="field-help">This should be the main website Vonza learns from and represents.</p>
            </div>
            <div class="field">
              <label for="assistant-welcome">Welcome message</label>
              <textarea id="assistant-welcome" name="welcome_message">${escapeHtml(agent.welcomeMessage || "")}</textarea>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Routing defaults</h3>
              <p class="settings-shell-section-copy">Tell Vonza where customers should go when the safest next step is to contact, book, request a quote, or continue to checkout.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="assistant-primary-cta-mode">Primary CTA mode</label>
              <select id="assistant-primary-cta-mode" name="primary_cta_mode">
                <option value="contact" ${trimText(agent.primaryCtaMode || "contact") === "contact" ? "selected" : ""}>contact</option>
                <option value="booking" ${trimText(agent.primaryCtaMode) === "booking" ? "selected" : ""}>booking</option>
                <option value="quote" ${trimText(agent.primaryCtaMode) === "quote" ? "selected" : ""}>quote</option>
                <option value="checkout" ${trimText(agent.primaryCtaMode) === "checkout" ? "selected" : ""}>checkout</option>
                <option value="capture" ${trimText(agent.primaryCtaMode) === "capture" ? "selected" : ""}>capture</option>
                <option value="chat" ${trimText(agent.primaryCtaMode) === "chat" ? "selected" : ""}>chat</option>
              </select>
              <p class="field-help">This is the default route Vonza uses when an intent-specific destination is missing.</p>
            </div>
            <div class="field">
              <label for="assistant-fallback-cta-mode">Fallback CTA mode</label>
              <select id="assistant-fallback-cta-mode" name="fallback_cta_mode">
                <option value="capture" ${trimText(agent.fallbackCtaMode || "capture") === "capture" ? "selected" : ""}>capture</option>
                <option value="contact" ${trimText(agent.fallbackCtaMode) === "contact" ? "selected" : ""}>contact</option>
                <option value="booking" ${trimText(agent.fallbackCtaMode) === "booking" ? "selected" : ""}>booking</option>
                <option value="quote" ${trimText(agent.fallbackCtaMode) === "quote" ? "selected" : ""}>quote</option>
                <option value="checkout" ${trimText(agent.fallbackCtaMode) === "checkout" ? "selected" : ""}>checkout</option>
                <option value="chat" ${trimText(agent.fallbackCtaMode) === "chat" ? "selected" : ""}>chat</option>
              </select>
              <p class="field-help">If a direct route is missing, Vonza follows this fallback instead of guessing.</p>
            </div>
            <div class="field">
              <label for="assistant-contact-email">Contact email</label>
              <input id="assistant-contact-email" name="contact_email" type="email" value="${escapeHtml(agent.contactEmail || "")}" placeholder="team@example.com">
            </div>
            <div class="field">
              <label for="assistant-contact-phone">Contact phone</label>
              <input id="assistant-contact-phone" name="contact_phone" type="tel" value="${escapeHtml(agent.contactPhone || "")}" placeholder="+1 555 555 5555">
            </div>
            <div class="field">
              <label for="assistant-allowed-domains">Allowed domains</label>
              <textarea id="assistant-allowed-domains" name="allowed_domains" placeholder="example.com&#10;www.example.com">${escapeHtml((agent.allowedDomains || []).join("\n"))}</textarea>
              <p class="field-help">One domain per line. Keep it limited to the real sites where the widget should run.</p>
            </div>
            <div class="field">
              <label for="assistant-business-hours-note">Availability note</label>
              <textarea id="assistant-business-hours-note" name="business_hours_note" placeholder="${escapeHtml(helpers.translateDashboardText("Open Mon-Fri, 9am-5pm. Same-day callbacks usually happen before 4pm."))}">${escapeHtml(agent.businessHoursNote || "")}</textarea>
              <p class="field-help">Optional. This appears in the handoff card so the next step feels concrete and trustworthy.</p>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Outcome routing and tracking</h3>
              <p class="settings-shell-section-copy">Map the URLs that matter so Vonza can guide visitors cleanly and attribute what happened after they leave chat.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="assistant-booking-url">Booking URL</label>
              <input id="assistant-booking-url" name="booking_url" type="text" value="${escapeHtml(agent.bookingUrl || "")}" placeholder="https://example.com/book">
            </div>
            <div class="field">
              <label for="assistant-quote-url">Quote URL</label>
              <input id="assistant-quote-url" name="quote_url" type="text" value="${escapeHtml(agent.quoteUrl || "")}" placeholder="https://example.com/quote">
            </div>
            <div class="field">
              <label for="assistant-checkout-url">Checkout URL</label>
              <input id="assistant-checkout-url" name="checkout_url" type="text" value="${escapeHtml(agent.checkoutUrl || "")}" placeholder="https://example.com/checkout">
            </div>
            <div class="field">
              <label for="assistant-booking-start-url">Booking start URL</label>
              <input id="assistant-booking-start-url" name="booking_start_url" type="text" value="${escapeHtml(agent.bookingStartUrl || "")}" placeholder="https://example.com/book/start">
            </div>
            <div class="field">
              <label for="assistant-quote-start-url">Quote start URL</label>
              <input id="assistant-quote-start-url" name="quote_start_url" type="text" value="${escapeHtml(agent.quoteStartUrl || "")}" placeholder="https://example.com/quote/start">
            </div>
            <div class="field">
              <label for="assistant-booking-success-url">Booking success URL</label>
              <input id="assistant-booking-success-url" name="booking_success_url" type="text" value="${escapeHtml(agent.bookingSuccessUrl || "")}" placeholder="https://example.com/book/confirmed">
            </div>
            <div class="field">
              <label for="assistant-quote-success-url">Quote success URL</label>
              <input id="assistant-quote-success-url" name="quote_success_url" type="text" value="${escapeHtml(agent.quoteSuccessUrl || "")}" placeholder="https://example.com/quote/thanks">
            </div>
            <div class="field">
              <label for="assistant-checkout-success-url">Checkout success URL</label>
              <input id="assistant-checkout-success-url" name="checkout_success_url" type="text" value="${escapeHtml(agent.checkoutSuccessUrl || "")}" placeholder="https://example.com/order/complete">
            </div>
            <div class="field">
              <label for="assistant-success-url-match-mode">Success URL match mode</label>
              <select id="assistant-success-url-match-mode" name="success_url_match_mode">
                <option value="path_prefix" ${trimText(agent.successUrlMatchMode || "path_prefix") === "path_prefix" ? "selected" : ""}>path prefix</option>
                <option value="exact" ${trimText(agent.successUrlMatchMode) === "exact" ? "selected" : ""}>exact</option>
              </select>
            </div>
            ${manualOutcomeVisible ? `
              <div class="field">
                <label for="assistant-manual-outcome-mode">Fallback outcome mode</label>
                <select id="assistant-manual-outcome-mode" name="manual_outcome_mode">
                  <option value="false" ${agent.manualOutcomeMode === true ? "" : "selected"}>automatic only</option>
                  <option value="true" ${agent.manualOutcomeMode === true ? "selected" : ""}>allow owner mark fallback</option>
                </select>
                <p class="field-help">Turn this on only when the real success page cannot be instrumented and the owner needs a fallback.</p>
              </div>
            ` : ""}
            <div class="field">
              <label for="assistant-success-snippet">Optional success ping snippet</label>
              <textarea id="assistant-success-snippet" readonly>fetch("${getPublicAppUrl()}/install/outcomes/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ install_id: "${escapeHtml(agent.installId || "")}", cta_event_id: new URLSearchParams(window.location.search).get("vz_cta_event_id"), page_url: window.location.href }) });</textarea>
              <p class="field-help">Use this on a thank-you page only if Vonza cannot load there. The tracked redirect adds &#96;vz_cta_event_id&#96; automatically.</p>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Website knowledge and widget logo</h3>
              <p class="settings-shell-section-copy">Keep the front desk aligned with the website your customers already know, and upload the logo that should appear in the widget header.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="assistant-widget-logo">Widget logo</label>
              <div class="settings-shell-logo-upload">
                <div class="settings-shell-logo-preview" aria-hidden="true">
                  ${agent.widgetLogoUrl ? `<img src="${escapeHtml(agent.widgetLogoUrl)}" alt="">` : `<span>${escapeHtml((agent.assistantName || agent.name || "V").trim().charAt(0).toUpperCase() || "V")}</span>`}
                </div>
                <div>
                  <input id="assistant-widget-logo" name="widget_logo_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                  <p class="field-help">Upload the icon/logo shown at the top of your widget. Use a small square PNG, JPG, WebP, or GIF.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row settings-shell-status-row--actions">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Website knowledge</p>
                <h4 class="settings-shell-status-value">${escapeHtml(setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Missing")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(setup.knowledgeDescription)}</p>
              </div>
              <div class="settings-shell-status-actions">
                <button class="ghost-button" type="button" data-action="import-knowledge">${knowledgeActionLabel}</button>
              </div>
            </div>
          </div>
        </section>

        ${advancedGuidanceVisible ? `
          <section class="settings-shell-section">
            <div class="settings-shell-section-header">
              <div>
                <h3 class="settings-shell-section-title">Advanced guidance</h3>
                <p class="settings-shell-section-copy">Optional guidance for emphasis, tone, and edge cases. Keep it focused on how the front desk should represent the business.</p>
              </div>
            </div>
            <div class="settings-shell-field-stack">
              <div class="field">
                <label for="assistant-instructions">Advanced guidance</label>
                <textarea id="assistant-instructions" name="system_prompt">${escapeHtml(agent.systemPrompt || "")}</textarea>
              </div>
            </div>
          </section>
        ` : ""}

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Current live readout</h3>
              <p class="settings-shell-section-copy">Review the customer-facing summary in the same flat settings flow before you save.</p>
            </div>
          </div>
          <div class="settings-shell-live-summary">
            <h3 id="studio-summary-name" class="studio-summary-name">${escapeHtml(agent.assistantName || agent.name || "")}</h3>
            <p id="studio-summary-copy" class="studio-summary-copy">${escapeHtml(agent.welcomeMessage || "Your front desk is ready to greet visitors with a clear, helpful first message.")}</p>
            <div class="settings-shell-logo-summary">
              <span class="settings-shell-logo-summary-label">Widget logo</span>
              <span class="settings-shell-logo-preview settings-shell-logo-preview--small" aria-hidden="true">
                ${agent.widgetLogoUrl ? `<img src="${escapeHtml(agent.widgetLogoUrl)}" alt="">` : `<span>${escapeHtml((agent.assistantName || agent.name || "V").trim().charAt(0).toUpperCase() || "V")}</span>`}
              </span>
            </div>
            <div class="studio-summary-badge-row">
              <span id="studio-summary-tone" class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
              <span id="studio-summary-button" class="pill">${escapeHtml(agent.buttonLabel || "Chat")}</span>
            </div>
            <div class="settings-shell-key-value-list">
              <div class="settings-shell-key-value-row">
                <div class="settings-shell-key-value-main">
                  <p class="settings-shell-key-value-label">Current website</p>
                  <h4 class="settings-shell-key-value-title">${escapeHtml(agent.websiteUrl || "Add your website to import real business knowledge.")}</h4>
                </div>
              </div>
              <div class="settings-shell-key-value-row">
                <div class="settings-shell-key-value-main">
                  <p class="settings-shell-key-value-label">Install status</p>
                  <h4 class="settings-shell-key-value-title">${escapeHtml(installStatus.label || "Not installed yet")}</h4>
                </div>
              </div>
              <div class="settings-shell-key-value-row">
                <div class="settings-shell-key-value-main">
                  <p class="settings-shell-key-value-label">Behavior summary</p>
                  <h4 id="behavior-summary-title" class="settings-shell-key-value-title">${escapeHtml(behaviorSummary.title)}</h4>
                  <p id="behavior-summary-copy" class="settings-shell-key-value-copy">${escapeHtml(behaviorSummary.copy)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="settings-shell-sticky-save">
          <span data-save-state class="save-state">No changes yet.</span>
          <button class="primary-button" type="submit">Save Front Desk</button>
        </div>
      </form>
    `;
  }

  function buildWorkspaceSettingsPanel(agent, setup, operatorWorkspace, helpers) {
    const {
      escapeHtml,
      getDashboardLanguage,
      getDefaultInstallStatus,
      getSupportedDashboardLanguages,
      getWorkspaceMode,
      normalizeAccessStatus,
      t,
    } = helpers;
    const installStatus = getDefaultInstallStatus(agent);
    const workspaceMode = getWorkspaceMode(operatorWorkspace);
    const accessStatus = normalizeAccessStatus(agent.accessStatus);
    const billing = operatorWorkspace?.billing || defaultBillingSnapshot();
    const billingUsage = billing.usage || defaultBillingSnapshot().usage;
    const hasBillingPlanData = billing.hasActiveSubscription === true
      || Boolean(defaultTrimText(billing.displayName || billing.monthlyPriceLabel || billing.planKey));
    const currentPlanLabel = hasBillingPlanData
      ? [billing.displayName, billing.monthlyPriceLabel].map(defaultTrimText).filter(Boolean).join(" · ") || "Current plan"
      : "No active billing plan data";
    const usagePercentLabel = formatBillingPercent(billingUsage.percentUsed);
    const billingPeriodLabel = billing.currentPeriodStart && billing.currentPeriodEnd
      ? `${formatBillingDate(billing.currentPeriodStart)} - ${formatBillingDate(billing.currentPeriodEnd)}`
      : "Current monthly period begins after activation.";
    const billingNoticeTone = defaultTrimText(billingUsage.tone).toLowerCase() || "ok";
    const upgradeOptions = Array.isArray(billing.upgradeOptions) ? billing.upgradeOptions : [];
    const dashboardTheme = defaultTrimText(global.document?.documentElement?.dataset?.dashboardTheme).toLowerCase() === "dark"
      ? "dark"
      : "light";
    const dashboardLanguage = getDashboardLanguage();
    const supportedDashboardLanguages = getSupportedDashboardLanguages();
    const isHungarian = dashboardLanguage === "hu";

    return `
      <div class="settings-shell-form">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Account</p>
            <h2 class="settings-shell-page-title">Account and billing</h2>
            <p class="settings-shell-page-copy">Review the real access, billing, language, theme, and legal surfaces available for this workspace.</p>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Current account status</h3>
              <p class="settings-shell-section-copy">Review the access, launch mode, and install posture that shape how this workspace behaves today.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Access</p>
                <h4 class="settings-shell-status-value">${escapeHtml(accessStatus)}</h4>
                <p class="settings-shell-status-copy">Access follows the existing checkout and activation flow for this workspace.</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Workspace mode</p>
                <h4 class="settings-shell-status-value">${escapeHtml(workspaceMode.title)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(workspaceMode.copy)}</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Install visibility</p>
                <h4 class="settings-shell-status-value">${escapeHtml(installStatus.label || "Not installed yet")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(setup.isReady
                  ? "The front desk is configured well enough to move into live install and verification."
                  : "Finish the front-desk basics before treating install as complete.")}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Billing and monthly usage</h3>
              <p class="settings-shell-section-copy">All plans include the same Vonza experience. The plan difference is the monthly AI capacity included with the workspace.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Current plan</p>
                <h4 class="settings-shell-status-value">${escapeHtml(currentPlanLabel)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(billing.hasActiveSubscription
                  ? "Hosted monthly subscription with upgrade-anytime capacity."
                  : "Billing plan details will appear here after checkout or subscription sync.")}</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Current billing period</p>
                <h4 class="settings-shell-status-value">${escapeHtml(billingPeriodLabel)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(defaultTrimText(billing.subscriptionStatus)
                  ? `Subscription status: ${billing.subscriptionStatus}.`
                  : "Subscription status will appear here after checkout.")}</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Monthly usage progress</p>
                <h4 class="settings-shell-status-value">${escapeHtml(`${usagePercentLabel} used`)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(billingUsage.statusLabel || "Monthly capacity status will appear here.")}</p>
                <div class="settings-shell-billing-progress" aria-label="Monthly usage progress">
                  <div class="settings-shell-billing-progress-bar settings-shell-billing-progress-bar--${escapeHtml(billingNoticeTone)}">
                    <span style="width:${escapeHtml(usagePercentLabel)}"></span>
                  </div>
                  <div class="settings-shell-billing-progress-meta">
                    <span>${escapeHtml(usagePercentLabel)} of this month's included capacity</span>
                    <span>${escapeHtml(billingUsage.isCapped ? "Visitor replies are now in safe fallback mode." : "Customer-facing usage is still available.")}</span>
                  </div>
                </div>
                <div class="settings-shell-billing-notice settings-shell-billing-notice--${escapeHtml(billingNoticeTone)}">
                  ${escapeHtml(billingUsage.ownerMessage || "Monthly AI usage status will appear here.")}
                </div>
              </div>
            </div>
          </div>
          <div class="settings-shell-billing-upgrade-stack">
            <div>
              <h4 class="settings-shell-section-title settings-shell-section-title--compact">Plan options</h4>
              <p class="settings-shell-section-copy">Available plan changes use the existing Stripe-backed billing flow.</p>
            </div>
            ${upgradeOptions.length
              ? `
                <div class="settings-shell-billing-upgrade-grid">
                  ${upgradeOptions.map((plan) => `
                    <button
                      type="button"
                      class="settings-shell-billing-plan-card"
                      data-billing-plan-key="${escapeHtml(plan.planKey)}"
                    >
                      <strong>${escapeHtml(plan.displayName)}</strong>
                      <span>${escapeHtml(plan.monthlyPriceLabel || `${plan.monthlyPriceUsd}/month`)}</span>
                      <small>${escapeHtml(plan.checkoutLabel || `Move to ${plan.displayName}`)}</small>
                    </button>
                  `).join("")}
                </div>
              `
              : `
                <div class="settings-shell-billing-notice settings-shell-billing-notice--ok">
                  Plan change options are not available for this workspace yet.
                </div>
              `}
          </div>
        </section>

        <form class="settings-shell-section" data-dashboard-language-form>
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">${escapeHtml(t("language.settingsTitle"))}</h3>
              <p class="settings-shell-section-copy">${escapeHtml(t("language.settingsCopy"))}</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="dashboard-language-select">${escapeHtml(t("language.settingsTitle"))}</label>
              <select id="dashboard-language-select" name="dashboard_language">
                ${supportedDashboardLanguages.map((language) => `
                  <option value="${escapeHtml(language.code)}" ${dashboardLanguage === language.code ? "selected" : ""}>${escapeHtml(language.nativeLabel || language.label)}</option>
                `).join("")}
              </select>
            </div>
          </div>
          <div class="settings-shell-sticky-save">
            <span data-save-state class="save-state">${escapeHtml(t("language.noChanges"))}</span>
            <button class="primary-button" type="submit">${escapeHtml(t("language.save"))}</button>
          </div>
        </form>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">${escapeHtml(t("settings.theme"))}</h3>
              <p class="settings-shell-section-copy">${escapeHtml(t("settings.themeCopy"))}</p>
            </div>
          </div>
          <div class="settings-shell-theme-options" role="radiogroup" aria-label="Theme">
            ${[
              { value: "light", label: t("settings.light"), copy: helpers.translateDashboardText("Default dashboard theme.") },
              { value: "dark", label: t("settings.dark"), copy: helpers.translateDashboardText("Lower-light dashboard theme for the app shell.") },
            ].map((theme) => `
              <label class="settings-shell-theme-option ${dashboardTheme === theme.value ? "active" : ""}">
                <input
                  type="radio"
                  name="dashboard_theme"
                  value="${escapeHtml(theme.value)}"
                  data-dashboard-theme-choice
                  ${dashboardTheme === theme.value ? "checked" : ""}
                >
                <span>
                  <strong>${escapeHtml(theme.label)}</strong>
                  <small>${escapeHtml(theme.copy)}</small>
                </span>
              </label>
            `).join("")}
          </div>
          <p class="settings-shell-section-copy">${escapeHtml(helpers.translateDashboardText("Saved as a dashboard preference on this device."))}</p>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">${escapeHtml(isHungarian ? "Jogi és bizalmi felület" : "Legal and trust")}</h3>
              <p class="settings-shell-section-copy">${escapeHtml(isHungarian
                ? "Ezek a nyilvános oldalak a website, az app, a widget és a hosted checkout jogi felületét fedik le."
                : "These public pages cover the website, app, widget, and hosted checkout legal surface.")}</p>
            </div>
          </div>
          <div class="app-legal-card">
            <p class="app-legal-copy">${escapeHtml(isHungarian
              ? "A repositoryben biztosan igazolható működési tények és a még hiányzó kötelező cégadatok is ezeken az oldalakon vannak egyben jelezve."
              : "These pages keep repo-confirmed facts and any still-missing required company details visible in one place.")}</p>
            ${buildLegalLinksMarkup()}
          </div>
        </section>
      </div>
    `;
  }

  function getOwnerAccount(agent = {}, authUser = null) {
    const email = defaultTrimText(authUser?.email || agent.ownerEmail || agent.email || agent.contactEmail);
    const name = defaultTrimText(agent.ownerName || agent.businessName || agent.name || "Workspace owner");
    const initials = name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "VO";

    return {
      email,
      initials,
      name,
    };
  }

  function formatAiCreditAmount(cents) {
    const amount = Math.round(Number(cents || 0) / 100);
    return Number.isFinite(amount) ? amount.toLocaleString("en-US") : "0";
  }

  function buildAssistantBrandingCard(agent, helpers) {
    const { escapeHtml } = helpers;
    const assistantName = agent.assistantName || agent.name || "Vonza Assistant";
    const primaryColor = agent.primaryColor || "#14b8a6";
    const welcomeMessage = agent.welcomeMessage || `Hi! I'm ${assistantName}. How can I help you today?`;

    return `
      <form data-settings-form data-form-kind="customize" class="settings-overview-card settings-overview-card--brand">
        <div class="settings-card-heading">
          <div class="settings-card-logo" style="--settings-card-logo-bg:${escapeHtml(primaryColor)}">${escapeHtml(defaultTrimText(assistantName).charAt(0).toUpperCase() || "V")}</div>
          <div>
            <h2 class="settings-card-title">Assistant branding</h2>
            <p class="settings-card-copy">Assistant behavior and branding for how your AI Front Desk shows up to customers.</p>
          </div>
        </div>
        <div class="settings-field-grid settings-field-grid--two">
          <div class="field">
            <label for="settings-assistant-name">Assistant name</label>
            <input id="settings-assistant-name" name="assistant_name" type="text" value="${escapeHtml(assistantName)}">
          </div>
          <div class="field">
            <label for="settings-assistant-tone">Tone of voice</label>
            <select id="settings-assistant-tone" name="tone">
              ${["friendly", "professional", "sales", "support"].map((tone) => `
                <option value="${escapeHtml(tone)}" ${defaultTrimText(agent.tone || "friendly") === tone ? "selected" : ""}>${escapeHtml(tone)}</option>
              `).join("")}
            </select>
          </div>
          <div class="field">
            <label for="settings-primary-color">Accent color</label>
            <input id="settings-primary-color" name="primary_color" type="color" value="${escapeHtml(primaryColor)}">
          </div>
          <div class="field">
            <label for="settings-button-label">Launcher text</label>
            <input id="settings-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}" placeholder="Chat">
          </div>
        </div>
        <div class="settings-brand-preview">
          <span class="settings-card-logo settings-card-logo--small" style="--settings-card-logo-bg:${escapeHtml(primaryColor)}">${escapeHtml(defaultTrimText(assistantName).charAt(0).toUpperCase() || "V")}</span>
          <strong>${escapeHtml(welcomeMessage)}</strong>
        </div>
        <div class="settings-card-actions">
          <span data-save-state class="save-state">No changes yet.</span>
          <button class="primary-button" type="submit">Save branding</button>
        </div>
      </form>
    `;
  }

  function buildGeneralSettingsSection(agent, operatorWorkspace, helpers) {
    return `
      <section id="settings-section-general" data-settings-section="general" class="settings-general-section">
        ${buildAssistantBrandingCard(agent, helpers)}
        ${buildWorkspacePreferencesCard(helpers)}
        ${buildBillingCard(operatorWorkspace, helpers)}
        ${buildPrivacyCard(helpers)}
      </section>
    `;
  }

  function buildBusinessProfileCard(agent, operatorWorkspace, helpers) {
    const { escapeHtml, getBadgeClass, getBusinessProfileViewModel } = helpers;
    const profile = getBusinessProfileViewModel(operatorWorkspace);
    const missingCount = Number(profile.readiness?.missingCount || 0);

    return `
      <form data-settings-form data-form-kind="customize" class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Business profile</h2>
            <p class="settings-card-copy">Update business information used in conversations.</p>
          </div>
          <span class="${getBadgeClass(missingCount ? "Limited" : "Ready")}">${missingCount ? "Needs details" : "Profile looks good"}</span>
        </div>
        <div class="settings-field-stack">
          <div class="field">
            <label for="settings-website-url">Website URL</label>
            <input id="settings-website-url" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}" placeholder="https://example.com">
          </div>
          <div class="field">
            <label for="settings-contact-email">Support email</label>
            <input id="settings-contact-email" name="contact_email" type="email" value="${escapeHtml(agent.contactEmail || "")}" placeholder="team@example.com">
          </div>
          <div class="field">
            <label for="settings-contact-phone">Phone number</label>
            <input id="settings-contact-phone" name="contact_phone" type="tel" value="${escapeHtml(agent.contactPhone || "")}" placeholder="+1 555 555 5555">
          </div>
        </div>
        <div class="settings-card-footer">
          <span>${renderSettingsIcon(missingCount ? "alert" : "check")} ${escapeHtml(profile.readiness?.summary || (missingCount ? "Business profile needs more detail." : "Profile looks good."))}</span>
          <button class="ghost-button" type="submit">Save changes</button>
        </div>
      </form>
    `;
  }

  function buildTeamAccessCard(agent, authUser, helpers) {
    const { escapeHtml, normalizeAccessStatus } = helpers;
    const owner = getOwnerAccount(agent, authUser);
    const accessStatus = normalizeAccessStatus(agent.accessStatus);

    return `
      <article id="settings-section-team" data-settings-section="team" class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Team access</h2>
            <p class="settings-card-copy">Workspace access currently follows the signed-in owner account.</p>
          </div>
          <button class="ghost-button" type="button" disabled title="Team invitations are not a self-serve workflow yet.">Invite member</button>
        </div>
        <div class="settings-member-list">
          <div class="settings-member-row">
            <span class="settings-member-avatar">${escapeHtml(owner.initials)}</span>
            <span>
              <strong>${escapeHtml(owner.name)}</strong>
              <small>${escapeHtml(owner.email || "Owner email unavailable")}</small>
            </span>
            <span class="settings-role-pill">Owner</span>
            <span class="${accessStatus === "active" ? "badge success" : "badge pending"}">${escapeHtml(accessStatus)}</span>
          </div>
        </div>
        <p class="settings-card-note">Additional team-role management is not rendered here until a real invite/member workflow exists.</p>
      </article>
    `;
  }

  function buildNotificationsCard(actionQueue, helpers) {
    const { escapeHtml } = helpers;
    const notificationState = actionQueue?.ownerNotifications || {};
    const records = Array.isArray(notificationState.records) ? notificationState.records : [];
    const visibleRecords = records.filter((item) => item.status !== "dismissed").slice(0, 3);
    const unreadCount = Number(notificationState.summary?.unread || visibleRecords.filter((item) => item.status === "unread").length || 0);

    return `
      <article id="settings-section-notifications" data-settings-section="notifications" class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Notifications</h2>
            <p class="settings-card-copy">Owner notices created from real customer signals.</p>
          </div>
          <span class="${unreadCount ? "badge warning" : "badge success"}">${escapeHtml(unreadCount ? `${unreadCount} unread` : "No unread notices")}</span>
        </div>
        <div class="settings-status-list">
          ${visibleRecords.length ? visibleRecords.map((item) => `
            <div class="settings-status-row">
              <strong>${escapeHtml(item.title || "Owner notification")}</strong>
              <span>${escapeHtml(item.reason || item.recommendedNextAction || "Review this customer moment.")}</span>
            </div>
          `).join("") : `
            <div class="settings-status-row">
              <strong>No owner notifications yet</strong>
              <span>Notifications appear after high-intent, unhappy, not-helpful, or repeated unanswered customer moments exist.</span>
            </div>
          `}
        </div>
        <div class="settings-card-footer">
          <span>Notification read/dismiss actions stay in the Analytics workflow.</span>
          <button class="ghost-button" type="button" data-shell-target="analytics">View notifications</button>
        </div>
      </article>
    `;
  }

  function buildBillingCard(operatorWorkspace, helpers) {
    const { escapeHtml } = helpers;
    const billing = operatorWorkspace?.billing || defaultBillingSnapshot();
    const usage = billing.usage || defaultBillingSnapshot().usage;
    const hasPlan = billing.hasActiveSubscription === true
      || Boolean(defaultTrimText(billing.displayName || billing.monthlyPriceLabel || billing.planKey));
    const upgradeOptions = Array.isArray(billing.upgradeOptions) ? billing.upgradeOptions : [];

    if (!hasPlan && !upgradeOptions.length) {
      return "";
    }

    const planLabel = hasPlan
      ? [billing.displayName, billing.monthlyPriceLabel].map(defaultTrimText).filter(Boolean).join(" · ") || "Current plan"
      : "No active billing plan data";
    const usagePercent = formatBillingPercent(usage.percentUsed);
    const usageLabel = Number(usage.includedCents || 0) > 0
      ? `${formatAiCreditAmount(usage.usedCents)} / ${formatAiCreditAmount(usage.includedCents)} AI credits`
      : (usage.statusLabel || "Monthly usage appears after billing sync.");

    return `
      <article id="settings-section-billing" data-settings-section="billing" class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Billing & plan</h2>
            <p class="settings-card-copy">Billing and monthly usage for the current workspace plan.</p>
            <p class="settings-card-note">Account and billing status follows the existing checkout and activation flow.</p>
          </div>
          <span class="${billing.hasActiveSubscription ? "badge success" : "badge pending"}">${escapeHtml(billing.subscriptionStatus || "pending")}</span>
        </div>
        <div class="settings-billing-panel">
          <div class="settings-billing-head">
            <strong>${renderSettingsIcon("billing")}${escapeHtml(planLabel)}</strong>
            ${upgradeOptions.length === 1 ? `<button class="ghost-button" type="button" data-billing-plan-key="${escapeHtml(upgradeOptions[0].planKey)}">${escapeHtml(upgradeOptions[0].checkoutLabel || `Move to ${upgradeOptions[0].displayName}`)}</button>` : ""}
          </div>
          <div class="settings-billing-meta"><span>Usage this month</span><span>${escapeHtml(`${usagePercent} used`)}</span></div>
          <div class="settings-billing-meta"><span>Capacity readout</span><span>${escapeHtml(usageLabel)}</span></div>
          <div class="settings-shell-billing-progress" aria-label="Monthly usage progress">
            <div class="settings-shell-billing-progress-bar settings-shell-billing-progress-bar--${escapeHtml(defaultTrimText(usage.tone).toLowerCase() || "ok")}">
              <span style="width:${escapeHtml(usagePercent)}"></span>
            </div>
          </div>
          <div class="settings-billing-meta settings-billing-meta--border">
            <span>Current billing period</span>
            <span>${escapeHtml(billing.currentPeriodStart && billing.currentPeriodEnd ? `${formatBillingDate(billing.currentPeriodStart)} - ${formatBillingDate(billing.currentPeriodEnd)}` : "Current monthly period begins after activation.")}</span>
          </div>
          <div class="settings-billing-meta"><span>Subscription</span><span>${escapeHtml(defaultTrimText(billing.subscriptionStatus) ? `Subscription status: ${billing.subscriptionStatus}.` : "Subscription status will appear here after checkout.")}</span></div>
        </div>
        ${upgradeOptions.length > 1 ? `
          <div class="settings-shell-billing-upgrade-grid">
            ${upgradeOptions.map((plan) => `
              <button type="button" class="settings-shell-billing-plan-card" data-billing-plan-key="${escapeHtml(plan.planKey)}">
                <strong>${escapeHtml(plan.displayName)}</strong>
                <span>${escapeHtml(plan.monthlyPriceLabel || "")}</span>
                <small>${escapeHtml(plan.checkoutLabel || `Move to ${plan.displayName}`)}</small>
              </button>
            `).join("")}
          </div>
        ` : ""}
        <p class="settings-card-note">${escapeHtml(usage.ownerMessage || (billing.hasActiveSubscription ? "Customer-facing usage is still available." : "Billing details will appear after checkout or subscription sync."))}</p>
      </article>
    `;
  }

  function buildPrivacyCard(helpers) {
    const { escapeHtml } = helpers;

    return `
      <article id="settings-section-privacy" data-settings-section="privacy" class="settings-overview-card">
        <div class="settings-card-heading">
          <div>
            <h2 class="settings-card-title">Privacy & compliance</h2>
            <p class="settings-card-copy">Legal and trust. These public pages cover the website, app, widget, and hosted checkout legal surface.</p>
          </div>
        </div>
        <div class="settings-card-actions settings-card-actions--wrap">
          ${LEGAL_LINKS.map((link) => `
            <a class="settings-link-button" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}${renderSettingsIcon("external")}</a>
          `).join("")}
        </div>
      </article>
    `;
  }

  function buildIntegrationsCard(agent, setup, operatorWorkspace, helpers) {
    const { escapeHtml, getDefaultInstallStatus, getGoogleWorkspaceCapabilities, getWorkspaceMode } = helpers;
    const installStatus = getDefaultInstallStatus(agent);
    const google = getGoogleWorkspaceCapabilities(operatorWorkspace);
    const workspaceMode = getWorkspaceMode(operatorWorkspace);
    const knowledgeDescription = setup.knowledgeDescription || "";
    const knowledgeSummary = knowledgeDescription && !(setup.knowledgeState === "ready" && /not (available|imported)|missing/i.test(knowledgeDescription))
      ? knowledgeDescription
      : setup.knowledgeState === "ready"
        ? "Website knowledge is ready for the assistant."
        : setup.knowledgeState === "limited"
          ? "Website import needs review before the assistant can rely on it fully."
          : "Website knowledge status appears after import.";
    const capabilities = [
      { label: "Workspace mode", value: `${workspaceMode.title} ${workspaceMode.copy}`.trim() },
      { label: "Website knowledge", value: setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Missing" },
      { label: "Widget install", value: installStatus.label || "Not installed yet" },
      { label: "Gmail read", value: google.gmailRead ? "Connected" : "Not connected" },
      { label: "Calendar write", value: google.calendarWrite ? "Connected" : "Not connected" },
    ];

    return `
      <article id="settings-section-integrations" data-settings-section="integrations" class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Integrations</h2>
            <p class="settings-card-copy">Real install, website knowledge, and connected workspace status.</p>
          </div>
          <button class="ghost-button" type="button" data-action="import-knowledge">${escapeHtml(setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge")}</button>
        </div>
        <div class="settings-status-list">
          ${capabilities.map((item) => `
            <div class="settings-status-row">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </div>
          `).join("")}
        </div>
        <div class="settings-card-footer">
          <span>${escapeHtml(knowledgeSummary)}</span>
          <button class="ghost-button" type="button" data-shell-target="install">Open install</button>
        </div>
      </article>
    `;
  }

  function buildWorkspacePreferencesCard(helpers) {
    const {
      escapeHtml,
      getDashboardLanguage,
      getSupportedDashboardLanguages,
      t,
    } = helpers;
    const dashboardTheme = defaultTrimText(global.document?.documentElement?.dataset?.dashboardTheme).toLowerCase() === "dark"
      ? "dark"
      : "light";
    const dashboardLanguage = getDashboardLanguage();
    const supportedDashboardLanguages = getSupportedDashboardLanguages();

    return `
      <article class="settings-overview-card settings-overview-card--wide">
        <div class="settings-card-heading">
          <div>
            <h2 class="settings-card-title">Workspace preferences</h2>
            <p class="settings-card-copy">Dashboard language and theme are real workspace preferences for this browser/session.</p>
          </div>
        </div>
        <div class="settings-preferences-grid">
          <form data-dashboard-language-form>
            <div class="field">
              <label for="dashboard-language-select">${escapeHtml(t("language.settingsTitle"))}</label>
              <select id="dashboard-language-select" name="dashboard_language">
                ${supportedDashboardLanguages.map((language) => `
                  <option value="${escapeHtml(language.code)}" ${dashboardLanguage === language.code ? "selected" : ""}>${escapeHtml(language.nativeLabel || language.label)}</option>
                `).join("")}
              </select>
            </div>
            <div class="settings-card-actions">
              <span data-save-state class="save-state">${escapeHtml(t("language.noChanges"))}</span>
              <button class="ghost-button" type="submit">${escapeHtml(t("language.save"))}</button>
            </div>
          </form>
          <div class="settings-shell-theme-options" role="radiogroup" aria-label="Theme">
            ${[
              { value: "light", label: t("settings.light"), copy: helpers.translateDashboardText("Default dashboard theme.") },
              { value: "dark", label: t("settings.dark"), copy: helpers.translateDashboardText("Lower-light dashboard theme for the app shell.") },
            ].map((theme) => `
              <label class="settings-shell-theme-option ${dashboardTheme === theme.value ? "active" : ""}">
                <input
                  type="radio"
                  name="dashboard_theme"
                  value="${escapeHtml(theme.value)}"
                  data-dashboard-theme-choice
                  ${dashboardTheme === theme.value ? "checked" : ""}
                >
                <span>
                  <strong>${escapeHtml(theme.label)}</strong>
                  <small>${escapeHtml(theme.copy)}</small>
                </span>
              </label>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function buildSettingsOverviewPanel(options, helpers) {
    const agent = options.agent || {};
    const setup = options.setup || {};
    const operatorWorkspace = options.operatorWorkspace || helpers.createEmptyOperatorWorkspace();
    const actionQueue = options.actionQueue || {};
    const activeSettingsSection = getActiveSettingsSection();

    return `
      <div class="settings-shell-overview">
        ${buildDesktopSettingsNav(activeSettingsSection, helpers)}
        ${buildMobileSettingsNav(activeSettingsSection, helpers)}
        <div class="settings-details-stack">
          ${buildGeneralSettingsSection(agent, operatorWorkspace, helpers)}
          ${buildFrontDeskSettingsForm(agent, setup, helpers)}
          ${buildBusinessContextSetupPanel(operatorWorkspace, helpers)}
        </div>
      </div>
    `;
  }

  function buildSettingsPanel(options = {}) {
    const helpers = getHelpers(options);

    const html = `
      <section class="workspace-page settings-shell-root" data-shell-section="settings" hidden>
        ${helpers.buildPageHeader({
          title: helpers.t("settings.title"),
          copy: helpers.t("settings.copy"),
        })}
        <div class="workspace-page-body settings-shell-layout">
          ${buildSettingsOverviewPanel(options, helpers)}
        </div>
      </section>
    `;
    return helpers.localizeDashboardHtml(html);
  }

  function bindSettingsShellEvents(options = {}) {
    const root = options.root || global.document;
    const onSubmitForm = typeof options.onSubmitForm === "function" ? options.onSubmitForm : null;
    const bindStudioState = typeof options.bindStudioState === "function" ? options.bindStudioState : null;
    const bindSimpleDirtyState = typeof options.bindSimpleDirtyState === "function" ? options.bindSimpleDirtyState : null;

    if (!root || typeof root.querySelectorAll !== "function") {
      return {
        getActiveSettingsSection,
        showSettingsSection() {
          return getActiveSettingsSection();
        },
      };
    }

    const settingsForms = Array.from(root.querySelectorAll("form[data-settings-form]"));
    const settingsTargets = Array.from(root.querySelectorAll("[data-settings-target]"));
    const settingsSections = Array.from(root.querySelectorAll("[data-settings-section]"));
    const overviewMode = Boolean(root.querySelector(".settings-shell-overview"));
    const mobileNote = typeof root.querySelector === "function"
      ? root.querySelector("[data-settings-mobile-note]")
      : null;

    const showSettingsSection = (targetSection = getActiveSettingsSection()) => {
      const normalizedSection = normalizeSettingsSection(targetSection);

      setActiveSettingsSection(normalizedSection);

      settingsTargets.forEach((target) => {
        if (target.tagName === "SELECT") {
          target.value = normalizedSection;
          return;
        }

        const isActive = target.dataset.settingsTarget === normalizedSection;
        target.classList.toggle("active", isActive);
        target.setAttribute("aria-current", isActive ? "page" : "false");
      });

      if (overviewMode) {
        const target = root.querySelector?.(`#settings-section-${normalizedSection}`);
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } else {
        settingsSections.forEach((section) => {
          section.hidden = normalizeSettingsSection(section.dataset.settingsSection) !== normalizedSection;
        });
      }

      if (mobileNote) {
        const helpers = getHelpers(options);
        mobileNote.textContent = helpers.translateDashboardText(getSectionByKey(normalizedSection).note);
      }

      return normalizedSection;
    };

    settingsForms.forEach((form) => {
      if (onSubmitForm) {
        form.addEventListener("submit", onSubmitForm);
      }

      if (form.dataset.formKind === "business-context") {
        bindSimpleDirtyState?.(form);
        return;
      }

      bindStudioState?.(form);
    });

    settingsTargets.forEach((target) => {
      if (target.tagName === "SELECT") {
        target.addEventListener("change", () => {
          showSettingsSection(normalizeSettingsSection(target.value || SETTINGS_SECTIONS[0]));
          const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
          if (!overviewMode) {
            settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          }
        });
        return;
      }

      target.addEventListener("click", () => {
        showSettingsSection(normalizeSettingsSection(target.dataset.settingsTarget || SETTINGS_SECTIONS[0]));
        const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
        if (!overviewMode) {
          settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }
      });
    });

    showSettingsSection();

    return {
      getActiveSettingsSection,
      showSettingsSection,
    };
  }

  global.VonzaSettingsShell = {
    buildSettingsPanel,
    bindSettingsShellEvents,
    SETTINGS_SECTIONS: SETTINGS_SECTIONS.slice(),
  };
})(window);
