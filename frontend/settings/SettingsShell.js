(function registerVonzaSettingsShell(global) {
  const SETTINGS_STORAGE_KEY = "vonza_dashboard_settings_section";
  const SETTINGS_SECTION_DETAILS = [
    {
      key: "business",
      label: "Business profile",
      note: "Services, pricing, policies, and approval-first context.",
    },
    {
      key: "front_desk",
      label: "Front Desk",
      note: "Identity, routing, website knowledge, and launch behavior.",
    },
    {
      key: "connected_tools",
      label: "Connected tools",
      note: "Google connection state and extension surfaces.",
    },
    {
      key: "workspace",
      label: "Workspace",
      note: "Access, launch mode, and honest workspace-level status.",
    },
  ];
  const SETTINGS_SECTIONS = Object.freeze(SETTINGS_SECTION_DETAILS.map((section) => section.key));

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
        summary: "Business context readiness will appear here.",
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
    const channelSet = new Set(profile.approvedContactChannels || []);
    const approvalOptions = [
      { value: "owner_required", label: "Owner approval required" },
      { value: "draft_only", label: "Draft only" },
      { value: "recommend_only", label: "Recommendation only" },
    ];

    return `
      <form data-settings-form data-form-kind="business-context" class="settings-shell-form settings-shell-form--system">
        <header class="settings-shell-page-header" id="business-context-setup">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Business profile</p>
            <h2 class="settings-shell-page-title">Business profile</h2>
            <p class="settings-shell-page-copy">Business context setup for Home and Vonza: define what Vonza should trust before it prepares owner-reviewed drafts, recommendations, or next steps.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs owner review" : "Context ready"}</span>
            <span class="${getBadgeClass(profile.prefill?.available ? "Ready" : "Limited")}">${profile.prefill?.available ? "Safe suggestions loaded" : "No prefill available"}</span>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Setup status</h3>
              <p class="settings-shell-section-copy">Review what is ready and what still needs owner input before this context should be treated as complete.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Readiness</p>
                <h4 class="settings-shell-status-value">${escapeHtml(`${profile.readiness?.completedSections || 0} / ${profile.readiness?.totalSections || 0} sections ready`)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(profile.readiness?.summary || "Business context readiness will appear here.")}</p>
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
              <p class="settings-shell-section-copy">Keep this concise and owner-facing. This is not website copy; it is the working context Vonza should trust when it prepares owner-reviewed proposals.</p>
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

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Approved owner paths</h3>
              <p class="settings-shell-section-copy">Vonza should stay approval-first. Use these settings to spell out which channels and proposal modes are allowed before any real deterministic workflow is used.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label>Approved contact channels</label>
              <div class="settings-shell-chip-row">
                ${[
                  { value: "website_chat", label: "Website chat" },
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone" },
                  { value: "sms", label: "SMS / text" },
                ].map((channel) => `
                  <label class="settings-shell-chip-option">
                    <input
                      type="checkbox"
                      name="approved_contact_channels"
                      value="${escapeHtml(channel.value)}"
                      ${channelSet.has(channel.value) ? "checked" : ""}
                    >
                    <span>${escapeHtml(channel.label)}</span>
                  </label>
                `).join("")}
              </div>
              <p class="field-help">These do not send anything automatically. They define which owner-approved channels Vonza may prepare drafts for.</p>
            </div>
            <div class="field">
              <label>Approval preferences</label>
              <div class="settings-shell-choice-list">
                ${[
                  { name: "approval_follow_up_drafts", label: "Follow-up drafts", value: profile.approvalPreferences.followUpDrafts },
                  { name: "approval_contact_next_steps", label: "Contact next-step recommendations", value: profile.approvalPreferences.contactNextSteps },
                  { name: "approval_task_recommendations", label: "Task recommendations", value: profile.approvalPreferences.taskRecommendations },
                  { name: "approval_outcome_recommendations", label: "Outcome review suggestions", value: profile.approvalPreferences.outcomeRecommendations },
                  { name: "approval_profile_changes", label: "Profile changes", value: profile.approvalPreferences.profileChanges },
                ].map((entry) => `
                  <div class="settings-shell-choice-row">
                    <div class="settings-shell-choice-main">
                      <p class="settings-shell-choice-title">${escapeHtml(entry.label)}</p>
                    </div>
                    <select name="${escapeHtml(entry.name)}">
                      ${approvalOptions.map((option) => `
                        <option value="${escapeHtml(option.value)}" ${entry.value === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
                      `).join("")}
                    </select>
                  </div>
                `).join("")}
              </div>
              <p class="field-help">Use explicit approval modes so Vonza stays review-first even when it has enough context to act.</p>
            </div>
          </div>
        </section>

        <div class="settings-shell-sticky-save">
          <span data-save-state class="save-state">No changes yet.</span>
          <button class="primary-button" type="submit">Save business context</button>
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

    return `
      <form data-settings-form data-form-kind="customize" class="settings-shell-form settings-shell-form--system">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Front Desk</p>
            <h2 class="settings-shell-page-title">Front Desk</h2>
            <p class="settings-shell-page-copy">Adjust how the customer-facing front desk speaks, routes, and represents the business without turning settings into a dashboard.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
            <span class="${getBadgeClass(setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Pending")}">${escapeHtml(setup.knowledgeState === "ready" ? "Knowledge ready" : setup.knowledgeState === "limited" ? "Knowledge limited" : "Knowledge missing")}</span>
          </div>
        </header>

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
    const { escapeHtml, getBadgeClass, getGoogleWorkspaceCapabilities, createEmptyOperatorWorkspace } = helpers;
    const emptyWorkspace = createEmptyOperatorWorkspace();
    const accounts = operatorWorkspace.connectedAccounts || [];
    const primaryAccount = accounts[0] || null;
    const status = operatorWorkspace.status || emptyWorkspace.status || {};
    const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);
    const canWriteCalendar = googleCapabilities.calendarWrite === true;
    const calendarMode = primaryAccount?.status === "connected"
      ? canWriteCalendar
        ? "Calendar can prepare approval-first drafts."
        : "Calendar is connected in read-only mode."
      : status.googleConfigReady
        ? "Google beta is available but not connected yet."
        : "This workspace is running without the optional Google-connected extensions.";

    return `
      <div class="settings-shell-form">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Connected tools</p>
            <h2 class="settings-shell-page-title">Connected tools</h2>
            <p class="settings-shell-page-copy">Keep optional extensions clearly separated from the stable core. If something is not connected or not self-serve yet, Vonza should say that plainly.</p>
          </div>
        </header>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Google workspace connection</h3>
              <p class="settings-shell-section-copy">Manage the real Google connection that powers Inbox, Calendar, and optional connected-tool extensions.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row settings-shell-status-row--actions">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Account</p>
                <h4 class="settings-shell-status-value">${escapeHtml(primaryAccount?.status === "connected" ? "Connected" : status.googleConfigReady ? "Available to connect" : "Unavailable on this deployment")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(primaryAccount?.accountEmail || "No Google account connected yet.")}</p>
              </div>
              <div class="settings-shell-status-actions">
                <button class="${primaryAccount?.status === "connected" ? "ghost-button" : "primary-button"}" type="button" data-google-connect ${status.googleConfigReady ? "" : "disabled"}>${primaryAccount?.status === "connected" ? "Reconnect Google" : "Connect Google"}</button>
                <button class="ghost-button" type="button" data-refresh-operator data-force-sync="true" ${primaryAccount?.status === "connected" ? "" : "disabled"}>Refresh sync</button>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Calendar mode</p>
                <h4 class="settings-shell-status-value">${escapeHtml(canWriteCalendar ? "Approval-first drafts" : primaryAccount?.status === "connected" ? "Read-only mode" : "Not connected")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(calendarMode)}</p>
              </div>
            </div>
            <div class="settings-shell-status-row">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Connection scope</p>
                <h4 class="settings-shell-status-value">${escapeHtml(googleCapabilities.gmailRead ? "Inbox and email work enabled" : "Email surfaces unavailable")}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(googleCapabilities.gmailRead
                  ? "Inbox and approval-first email work can appear in the connected workspace surfaces."
                  : "Inbox stays hidden until Gmail read access is available. Automations stay honest about the missing connection.")}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Connected surfaces</h3>
              <p class="settings-shell-section-copy">These tools extend the customer service workspace. They do not replace the stable core around Home, Customers, Front Desk, and Analytics.</p>
            </div>
          </div>
          <div class="settings-shell-key-value-list">
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Inbox</p>
                <h4 class="settings-shell-key-value-title">Approval-first replies</h4>
                <p class="settings-shell-key-value-copy">Recent Gmail threads, reply drafts, and complaint recovery work show up here only when the mailbox connection is ready.</p>
              </div>
              <span class="${getBadgeClass(googleCapabilities.gmailRead ? "Ready" : "Pending")}">${escapeHtml(googleCapabilities.gmailRead ? "Connected" : "Not connected")}</span>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Calendar</p>
                <h4 class="settings-shell-key-value-title">Schedule context</h4>
                <p class="settings-shell-key-value-copy">Vonza can surface today’s schedule, follow-up gaps, and event drafts without silently mutating the owner calendar.</p>
              </div>
              <span class="${getBadgeClass(primaryAccount?.status === "connected" ? "Ready" : "Pending")}">${escapeHtml(primaryAccount?.status === "connected" ? "Available" : "Waiting for connection")}</span>
            </div>
            <div class="settings-shell-key-value-row">
              <div class="settings-shell-key-value-main">
                <p class="settings-shell-key-value-label">Automations</p>
                <h4 class="settings-shell-key-value-title">Draft-first workflows</h4>
                <p class="settings-shell-key-value-copy">Campaigns, follow-ups, and owner tasks stay visible as tracked draft or approval objects instead of pretending to run autonomously.</p>
              </div>
              <span class="${getBadgeClass(status.googleConfigReady ? "Limited" : "Pending")}">${escapeHtml(status.googleConfigReady ? "Connection-dependent" : "Unavailable")}</span>
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
