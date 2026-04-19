(function registerVonzaSettingsShell(global) {
  const SETTINGS_STORAGE_KEY = "vonza_dashboard_settings_section";
  const SETTINGS_SECTION_DETAILS = [
    {
      key: "business",
      label: "Business profile",
      note: "Services, pricing, policies, and customer-service context.",
    },
    {
      key: "front_desk",
      label: "Front Desk",
      note: "Identity, routing, website knowledge, and launch behavior.",
    },
    {
      key: "connected_tools",
      label: "Connected tools",
      note: "Beta. Email, Calendar, and Automations are not ready yet.",
    },
    {
      key: "workspace",
      label: "Workspace",
      note: "Access, launch mode, and honest workspace-level status.",
    },
  ];
  const SETTINGS_SECTIONS = Object.freeze(SETTINGS_SECTION_DETAILS.map((section) => section.key));
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
    };
  }

  function getSectionByKey(sectionKey) {
    return SETTINGS_SECTION_DETAILS.find((section) => section.key === sectionKey) || SETTINGS_SECTION_DETAILS[0];
  }

  function getActiveSettingsSection() {
    const storedSection = defaultTrimText(global.localStorage?.getItem(SETTINGS_STORAGE_KEY)).toLowerCase();

    if (SETTINGS_SECTIONS.includes(storedSection)) {
      return storedSection;
    }

    return SETTINGS_SECTIONS[0];
  }

  function setActiveSettingsSection(section) {
    if (!SETTINGS_SECTIONS.includes(section)) {
      return;
    }

    global.localStorage?.setItem(SETTINGS_STORAGE_KEY, section);
  }

  function buildDesktopSettingsNav(activeSettingsSection, helpers) {
    const { escapeHtml } = helpers;

    return `
      <div class="settings-shell-nav-group" data-settings-nav="desktop">
        <p class="settings-shell-nav-heading">Settings</p>
        <div class="settings-shell-nav">
          ${SETTINGS_SECTION_DETAILS.map((section) => `
            <button
              class="settings-shell-nav-button ${activeSettingsSection === section.key ? "active" : ""}"
              type="button"
              data-settings-target="${escapeHtml(section.key)}"
              aria-current="${activeSettingsSection === section.key ? "page" : "false"}"
              title="${escapeHtml(section.note)}"
            >${escapeHtml(section.label)}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildMobileSettingsNav(activeSettingsSection, helpers) {
    const { escapeHtml } = helpers;
    const activeSection = getSectionByKey(activeSettingsSection);

    return `
      <div class="settings-shell-mobile-bar" data-settings-nav="mobile">
        <label class="settings-shell-mobile-label" for="settings-shell-section-select">Settings section</label>
        <select
          id="settings-shell-section-select"
          class="settings-shell-mobile-select"
          data-settings-target="select"
          aria-label="Settings section"
        >
          ${SETTINGS_SECTION_DETAILS.map((section) => `
            <option value="${escapeHtml(section.key)}" ${activeSettingsSection === section.key ? "selected" : ""}>${escapeHtml(section.label)}</option>
          `).join("")}
        </select>
        <p class="settings-shell-mobile-copy" data-settings-mobile-note>${escapeHtml(activeSection.note)}</p>
      </div>
    `;
  }

  function buildBusinessContextSetupPanel(operatorWorkspace, helpers) {
    const { escapeHtml, getBadgeClass, getBusinessProfileViewModel } = helpers;
    const profile = getBusinessProfileViewModel(operatorWorkspace);

    return `
      <form data-settings-form data-form-kind="business-context" class="settings-shell-form settings-shell-form--system">
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
      <form data-settings-form data-form-kind="customize" class="settings-shell-form settings-shell-form--system">
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
              <textarea id="assistant-business-hours-note" name="business_hours_note" placeholder="Open Mon-Fri, 9am-5pm. Same-day callbacks usually happen before 4pm.">${escapeHtml(agent.businessHoursNote || "")}</textarea>
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
              <h3 class="settings-shell-section-title">Website knowledge and brand</h3>
              <p class="settings-shell-section-copy">Keep the front desk aligned with the brand your customers already know, and rerun import when the website changes.</p>
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
            <div class="field">
              <label for="assistant-primary-color">Primary color</label>
              <input id="assistant-primary-color" name="primary_color" type="color" value="${escapeHtml(agent.primaryColor || "#14b8a6")}">
            </div>
            <div class="field">
              <label for="assistant-secondary-color">Secondary color</label>
              <input id="assistant-secondary-color" name="secondary_color" type="color" value="${escapeHtml(agent.secondaryColor || "#0f766e")}">
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
            <div class="studio-swatch-row">
              <div id="studio-swatch-primary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.primaryColor || "#14b8a6")}">Primary</div>
              <div id="studio-swatch-secondary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.secondaryColor || "#0f766e")}">Secondary</div>
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

  function buildConnectedToolsSettingsPanel(agent, operatorWorkspace, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;

    return `
      <div class="settings-shell-form">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Connected tools</p>
            <h2 class="settings-shell-page-title">Connected tools</h2>
            <p class="settings-shell-page-copy">Beta. Email, Calendar, and Automations are not self-serve yet, so this area stays informational instead of offering controls that are not ready.</p>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Google workspace connection</h3>
              <p class="settings-shell-section-copy">This connection is not available from the dashboard yet. The core workspace works without it.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Account</p>
                <h4 class="settings-shell-status-value">Beta</h4>
                <p class="settings-shell-status-copy">Google connection is not ready to use here yet.</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Calendar mode</p>
                <h4 class="settings-shell-status-value">Beta</h4>
                <p class="settings-shell-status-copy">Schedule context will stay unavailable until the connected tools release is ready.</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Connection scope</p>
                <h4 class="settings-shell-status-value">Beta</h4>
                <p class="settings-shell-status-copy">Inbox review and automation controls are not available yet.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Beta</h3>
              <p class="settings-shell-section-copy">These connected tools are planned, but they should not look usable before the product is ready.</p>
            </div>
          </div>
          <div class="settings-shell-key-value-list">
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Inbox</p>
                <h4 class="settings-shell-key-value-title">Email connection</h4>
                <p class="settings-shell-key-value-copy">Email review is not self-serve yet.</p>
              </div>
              <span class="${getBadgeClass("Pending")}">Beta</span>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Calendar</p>
                <h4 class="settings-shell-key-value-title">Schedule context</h4>
                <p class="settings-shell-key-value-copy">Calendar access is not ready yet.</p>
              </div>
              <span class="${getBadgeClass("Pending")}">Beta</span>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Automations</p>
                <h4 class="settings-shell-key-value-title">Workflow support</h4>
                <p class="settings-shell-key-value-copy">Automations are not available yet.</p>
              </div>
              <span class="${getBadgeClass("Pending")}">Beta</span>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function buildWorkspaceSettingsPanel(agent, setup, operatorWorkspace, helpers) {
    const { escapeHtml, getDefaultInstallStatus, getWorkspaceMode, normalizeAccessStatus } = helpers;
    const installStatus = getDefaultInstallStatus(agent);
    const workspaceMode = getWorkspaceMode(operatorWorkspace);
    const accessStatus = normalizeAccessStatus(agent.accessStatus);
    const dashboardTheme = defaultTrimText(global.document?.documentElement?.dataset?.dashboardTheme).toLowerCase() === "dark"
      ? "dark"
      : "light";

    return `
      <div class="settings-shell-form">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Workspace</p>
            <h2 class="settings-shell-page-title">Workspace</h2>
            <p class="settings-shell-page-copy">This area stays honest about what is configured today. Workspace-level controls that do not exist yet are shown as status, not fake settings.</p>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Current workspace status</h3>
              <p class="settings-shell-section-copy">Review the access, launch mode, and install posture that shape how this workspace behaves today.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Access</p>
                <h4 class="settings-shell-status-value">${escapeHtml(accessStatus)}</h4>
                <p class="settings-shell-status-copy">Billing and access are currently managed through secure checkout and workspace activation, not through a separate in-app billing center in this pass.</p>
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
              <h3 class="settings-shell-section-title">Theme</h3>
              <p class="settings-shell-section-copy">Choose how the dashboard looks in this browser. Light is the default.</p>
            </div>
          </div>
          <div class="settings-shell-theme-options" role="radiogroup" aria-label="Theme">
            ${[
              { value: "light", label: "Light", copy: "Default dashboard theme." },
              { value: "dark", label: "Dark", copy: "Lower-light dashboard theme for the app shell." },
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
          <p class="settings-shell-section-copy">Saved as a dashboard preference on this device.</p>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Workspace boundaries</h3>
              <p class="settings-shell-section-copy">Keep the product honest about what is and is not self-serve today.</p>
            </div>
          </div>
          <div class="settings-shell-key-value-list">
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Billing management</p>
                <p class="settings-shell-key-value-copy">Billing still lives in hosted checkout and access activation flow. There is no fake billing settings form here.</p>
              </div>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Workspace preferences</p>
                <p class="settings-shell-key-value-copy">This pass creates the shell for preferences, but avoids pretending there are extra backend preference systems when they are not implemented yet.</p>
              </div>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Access controls</p>
                <p class="settings-shell-key-value-copy">Owner access, auth, and activation remain preserved exactly as they already work in the product.</p>
              </div>
            </div>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-shell-target="install">Open install</button>
            <button class="ghost-button" type="button" data-shell-target="customize">Open Front Desk</button>
          </div>
        </section>
      </div>
    `;
  }

  function buildSettingsPanel(options = {}) {
    const helpers = getHelpers(options);
    const emptyWorkspace = helpers.createEmptyOperatorWorkspace();
    const agent = options.agent || {};
    const setup = options.setup || {};
    const operatorWorkspace = options.operatorWorkspace || emptyWorkspace;
    const activeSettingsSection = getActiveSettingsSection();

    return `
      <section class="workspace-page settings-shell-root" data-shell-section="settings" hidden>
        ${helpers.buildPageHeader({
          eyebrow: "Utilities",
          title: "Settings",
          copy: "Manage business profile, Front Desk behavior, connected tools, and workspace status in a dedicated settings system.",
        })}
        <div class="workspace-page-body settings-shell-layout">
          <aside class="settings-shell-sidebar">
            ${buildDesktopSettingsNav(activeSettingsSection, helpers)}
          </aside>
          <div class="settings-shell-main">
            ${buildMobileSettingsNav(activeSettingsSection, helpers)}
            <div class="settings-shell-main-panel">
              <section class="settings-shell-panel" data-settings-section="business" ${activeSettingsSection === "business" ? "" : "hidden"}>
                ${buildBusinessContextSetupPanel(operatorWorkspace, helpers)}
              </section>
              <section class="settings-shell-panel" data-settings-section="front_desk" ${activeSettingsSection === "front_desk" ? "" : "hidden"}>
                ${buildFrontDeskSettingsForm(agent, setup, helpers)}
              </section>
              <section class="settings-shell-panel" data-settings-section="connected_tools" ${activeSettingsSection === "connected_tools" ? "" : "hidden"}>
                ${buildConnectedToolsSettingsPanel(agent, operatorWorkspace, helpers)}
              </section>
              <section class="settings-shell-panel" data-settings-section="workspace" ${activeSettingsSection === "workspace" ? "" : "hidden"}>
                ${buildWorkspaceSettingsPanel(agent, setup, operatorWorkspace, helpers)}
              </section>
            </div>
          </div>
        </div>
      </section>
    `;
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
    const mobileNote = typeof root.querySelector === "function"
      ? root.querySelector("[data-settings-mobile-note]")
      : null;

    const showSettingsSection = (targetSection = getActiveSettingsSection()) => {
      const normalizedSection = SETTINGS_SECTIONS.includes(targetSection)
        ? targetSection
        : SETTINGS_SECTIONS[0];

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

      settingsSections.forEach((section) => {
        section.hidden = section.dataset.settingsSection !== normalizedSection;
      });

      if (mobileNote) {
        mobileNote.textContent = getSectionByKey(normalizedSection).note;
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
          showSettingsSection(target.value || SETTINGS_SECTIONS[0]);
          const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
          settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        });
        return;
      }

      target.addEventListener("click", () => {
        showSettingsSection(target.dataset.settingsTarget || SETTINGS_SECTIONS[0]);
        const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
        settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
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
