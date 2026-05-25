(function registerVonzaSettingsShell(global) {
  const SETTINGS_STORAGE_KEY = "vonza_dashboard_settings_section";
  const SETTINGS_FALLBACK_UI_STATE_STORAGE_KEY = "vonza_dashboard_ui_state";
  const SETTINGS_SECTION_DETAILS = [
    {
      key: "general",
      label: "General",
      note: "Workspace status, dashboard language, and launch posture.",
    },
    {
      key: "front_desk",
      label: "Front Desk",
      note: "Identity, full-page assistant, routing, and optional widget.",
    },
    {
      key: "business_profile",
      label: "Business Profile",
      note: "Grounding facts and readiness for customer answers.",
    },
    {
      key: "account_billing",
      label: "Account & Billing",
      note: "Real account, plan, subscription, and usage status.",
    },
    {
      key: "privacy_legal",
      label: "Privacy & Legal",
      note: "Public trust, privacy, and legal pages.",
    },
  ];
  const SETTINGS_SECTIONS = Object.freeze(SETTINGS_SECTION_DETAILS.map((section) => section.key));
  const FRONT_DESK_SETTINGS_TABS = Object.freeze(["identity", "voice", "full_page", "routing", "appearance"]);
  const FRONT_DESK_SETTINGS_TAB_HASH_SEGMENTS = Object.freeze({
    identity: "identity-welcome",
    voice: "voice",
    full_page: "full-page-assistant",
    routing: "routing",
    appearance: "widget-appearance",
  });
  const FULL_PAGE_SETTINGS_TABS = Object.freeze(["content", "design", "layout"]);
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
    account: "account_billing",
    billing: "account_billing",
    plan: "account_billing",
    "account-billing": "account_billing",
    privacy: "privacy_legal",
    legal: "privacy_legal",
    privacy_controls: "privacy_legal",
    "privacy-legal": "privacy_legal",
  });
  const DEFAULT_TRANSLATIONS = Object.freeze({
    "language.settingsTitle": "Dashboard language",
    "language.settingsCopy": "Choose the language used by the logged-in dashboard.",
    "language.noChanges": "No changes yet.",
    "language.save": "Save language",
    "nav.utilities": "Utilities",
    "settings.title": "Settings",
    "settings.copy": "Manage workspace, Front Desk, business, account, and privacy settings.",
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
  const DEFAULT_FULL_PAGE_ACTION_CARDS = Object.freeze([
    Object.freeze({
      label: "Ask about services",
      description: "See what this business can help with.",
      prompt: "What services do you offer?",
      type: "services",
      enabled: true,
    }),
    Object.freeze({
      label: "Ask about pricing",
      description: "Ask what affects price, scope, and next steps.",
      prompt: "How much does it cost?",
      type: "pricing",
      enabled: true,
    }),
    Object.freeze({
      label: "Request a quote",
      description: "Share what you need so the business can follow up.",
      prompt: "I'd like to request a quote.",
      type: "quote",
      enabled: true,
    }),
    Object.freeze({
      label: "Contact details",
      description: "Find the best way to reach the team.",
      prompt: "How can I contact you?",
      type: "contact",
      enabled: true,
    }),
  ]);
  const DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD = Object.freeze({
    label: "Book a time",
    description: "Ask about appointments, calls, visits, or the next step.",
    prompt: "I'd like to book a time.",
    type: "booking",
    enabled: true,
  });
  const DEFAULT_FULL_PAGE_TRUST_ITEMS = Object.freeze([
    "Replies instantly",
    "AI assistant",
    "Leave your details if needed",
  ]);
  const FULL_PAGE_DESIGN_PRESETS = Object.freeze([
    "clean-light",
    "dark-professional",
    "warm-minimal",
    "bold-gradient",
    "image-hero",
    "video-hero",
  ]);
  const FULL_PAGE_BACKGROUND_SOURCES = Object.freeze(["preset", "upload", "url"]);
  const FULL_PAGE_BACKGROUND_PRESETS = Object.freeze({
    "clean-light-abstract": {
      key: "clean-light-abstract",
      label: "Clean Light Abstract",
      description: "Soft light background with gold linework.",
      backgroundType: "image",
      imageUrl: "/assets/front-desk/backgrounds/abstract-light-gold.png",
      videoUrl: "",
      backgroundColor: "#f8f4ea",
      backgroundOverlayColor: "#ffffff",
      backgroundOverlayOpacity: 0.18,
      textTheme: "dark",
      disableVideoOnMobile: true,
    },
    "dark-gold-abstract": {
      key: "dark-gold-abstract",
      label: "Dark Gold Abstract",
      description: "Dark background with gold linework.",
      backgroundType: "image",
      imageUrl: "/assets/front-desk/backgrounds/abstract-dark-gold.png",
      videoUrl: "",
      backgroundColor: "#09090b",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.28,
      textTheme: "light",
      disableVideoOnMobile: true,
    },
    "bright-abstract-motion": {
      key: "bright-abstract-motion",
      label: "Bright Abstract Motion",
      description: "Bright abstract motion for a clean Front Desk page.",
      backgroundType: "video",
      imageUrl: "/assets/front-desk/backgrounds/vonza_front_desk_bright_poster.png",
      videoUrl: "/assets/front-desk/backgrounds/vonza_front_desk_bright_loop.mp4",
      backgroundColor: "#f8fafc",
      backgroundOverlayColor: "#ffffff",
      backgroundOverlayOpacity: 0.1,
      textTheme: "dark",
      disableVideoOnMobile: true,
    },
    "dark-abstract-motion": {
      key: "dark-abstract-motion",
      label: "Dark Abstract Motion",
      description: "Dark abstract motion with a high-contrast Front Desk style.",
      backgroundType: "video",
      imageUrl: "/assets/front-desk/backgrounds/vonza_front_desk_dark_poster.png",
      videoUrl: "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4",
      backgroundColor: "#08111f",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.24,
      textTheme: "light",
      disableVideoOnMobile: true,
    },
  });
  const FULL_PAGE_PRESET_OPTIONS = Object.freeze([
    { value: "clean-light", label: "Clean Light" },
    { value: "dark-professional", label: "Dark Professional" },
    { value: "warm-minimal", label: "Warm Minimal" },
    { value: "bold-gradient", label: "Bold Gradient" },
    { value: "image-hero", label: "Image Hero" },
    { value: "video-hero", label: "Video Hero" },
  ]);
  const FULL_PAGE_BACKGROUND_TYPES = Object.freeze(["color", "gradient", "image", "video"]);
  const FULL_PAGE_BACKGROUND_TYPE_OPTIONS = Object.freeze([
    { value: "color", label: "Solid color" },
    { value: "gradient", label: "Gradient" },
    { value: "image", label: "Image" },
    { value: "video", label: "Video" },
  ]);
  const FULL_PAGE_FOCAL_POINT_OPTIONS = Object.freeze([
    { value: "center", label: "Center" },
    { value: "top", label: "Top" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ]);
  const FULL_PAGE_TEXT_THEME_OPTIONS = Object.freeze([
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ]);
  const FULL_PAGE_COMPOSER_STYLE_OPTIONS = Object.freeze([
    { value: "soft", label: "Soft" },
    { value: "elevated", label: "Elevated" },
    { value: "minimal", label: "Minimal" },
  ]);
  const FULL_PAGE_CHIP_STYLE_OPTIONS = Object.freeze([
    { value: "outline", label: "Outline" },
    { value: "soft", label: "Soft" },
    { value: "subtle-fill", label: "Subtle fill" },
  ]);
  const FULL_PAGE_STATUS_STYLE_OPTIONS = Object.freeze([
    { value: "subtle", label: "Subtle" },
    { value: "pill", label: "Pill" },
    { value: "minimal", label: "Minimal" },
  ]);
  const FULL_PAGE_BACKGROUND_SCOPE_OPTIONS = Object.freeze([
    { value: "section", label: "Assistant section (recommended)" },
    { value: "iframe", label: "Iframe only" },
  ]);
  const DEFAULT_FULL_PAGE_DESIGN = Object.freeze({
    preset: "clean-light",
    backgroundType: "color",
    backgroundSource: "url",
    backgroundPreset: "",
    backgroundColor: "#ffffff",
    backgroundGradientTo: "#eef4ff",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0.72,
    backgroundBlur: 0,
    backgroundFocalPoint: "center",
    textTheme: "dark",
    composerStyle: "soft",
    chipStyle: "outline",
    statusStyle: "subtle",
    backgroundScope: "section",
    disableVideoOnMobile: true,
  });
  const VOICE_STYLE_OPTIONS = Object.freeze([
    { value: "alloy", label: "Alloy" },
    { value: "ash", label: "Ash" },
    { value: "coral", label: "Coral" },
    { value: "nova", label: "Nova" },
    { value: "sage", label: "Sage" },
    { value: "shimmer", label: "Shimmer" },
  ]);
  const DEFAULT_VOICE_CONFIG = Object.freeze({
    voiceInputEnabled: false,
    spokenRepliesEnabled: false,
    autoSendTranscript: false,
    autoPlaySpokenReplies: false,
    voice: "alloy",
    languageBehavior: "auto",
  });

  function defaultTrimText(value) {
    return String(value || "").trim();
  }

  function limitText(value, maxLength) {
    return defaultTrimText(value).slice(0, maxLength);
  }

  function normalizeFullPageColor(value, fallbackValue = "#14b8a6") {
    const normalized = defaultTrimText(value).toLowerCase();

    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
      return normalized;
    }

    if (/^#[0-9a-f]{3}$/i.test(normalized)) {
      return `#${normalized
        .slice(1)
        .split("")
        .map((character) => `${character}${character}`)
        .join("")}`;
    }

    return /^#[0-9a-f]{6}$/i.test(defaultTrimText(fallbackValue)) ? defaultTrimText(fallbackValue) : "#14b8a6";
  }

  function normalizeDesignEnum(value, allowedValues, fallbackValue) {
    const normalized = defaultTrimText(value).toLowerCase().replace(/_/g, "-");
    return allowedValues.includes(normalized) ? normalized : fallbackValue;
  }

  function normalizeOverlayOpacity(value, fallbackValue) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(0.92, Math.round(number * 100) / 100))
      : fallbackValue;
  }

  function normalizeBackgroundBlur(value, fallbackValue) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(18, Math.round(number)))
      : fallbackValue;
  }

  function getFullPageDesignPresetDefaults(presetValue) {
    const preset = normalizeDesignEnum(presetValue, FULL_PAGE_DESIGN_PRESETS, DEFAULT_FULL_PAGE_DESIGN.preset);
    const presets = {
      "clean-light": { ...DEFAULT_FULL_PAGE_DESIGN, preset },
      "dark-professional": {
        ...DEFAULT_FULL_PAGE_DESIGN,
        preset,
        backgroundColor: "#111827",
        backgroundGradientTo: "#1f2937",
        backgroundOverlayColor: "#020617",
        backgroundOverlayOpacity: 0.36,
        textTheme: "light",
        composerStyle: "elevated",
        chipStyle: "subtle-fill",
        statusStyle: "pill",
      },
      "warm-minimal": {
        ...DEFAULT_FULL_PAGE_DESIGN,
        preset,
        backgroundColor: "#f8f3ea",
        backgroundGradientTo: "#fffaf1",
        backgroundOverlayColor: "#fff7ed",
        backgroundOverlayOpacity: 0.54,
        chipStyle: "soft",
        statusStyle: "minimal",
      },
      "bold-gradient": {
        ...DEFAULT_FULL_PAGE_DESIGN,
        preset,
        backgroundType: "gradient",
        backgroundColor: "#0f766e",
        backgroundGradientTo: "#2563eb",
        backgroundOverlayColor: "#020617",
        backgroundOverlayOpacity: 0.18,
        textTheme: "light",
        composerStyle: "elevated",
        chipStyle: "subtle-fill",
        statusStyle: "pill",
      },
      "image-hero": {
        ...DEFAULT_FULL_PAGE_DESIGN,
        preset,
        backgroundType: "image",
        backgroundColor: "#111827",
        backgroundGradientTo: "#1f2937",
        backgroundOverlayColor: "#020617",
        backgroundOverlayOpacity: 0.5,
        textTheme: "light",
        composerStyle: "elevated",
        chipStyle: "subtle-fill",
        statusStyle: "pill",
      },
      "video-hero": {
        ...DEFAULT_FULL_PAGE_DESIGN,
        preset,
        backgroundType: "video",
        backgroundColor: "#111827",
        backgroundGradientTo: "#1f2937",
        backgroundOverlayColor: "#020617",
        backgroundOverlayOpacity: 0.56,
        textTheme: "light",
        composerStyle: "elevated",
        chipStyle: "subtle-fill",
        statusStyle: "pill",
        disableVideoOnMobile: true,
      },
    };

    return presets[preset] || presets[DEFAULT_FULL_PAGE_DESIGN.preset];
  }

  function getFullPageBackgroundPresetDefaults(presetValue) {
    const preset = normalizeDesignEnum(presetValue, Object.keys(FULL_PAGE_BACKGROUND_PRESETS), "");
    return preset ? FULL_PAGE_BACKGROUND_PRESETS[preset] : null;
  }

  function normalizeFullPageDesign(config = {}) {
    const design = config.design && typeof config.design === "object" && !Array.isArray(config.design)
      ? config.design
      : {};
    const presetDefaults = getFullPageDesignPresetDefaults(design.preset);
    const rawBackgroundPresetDefaults = getFullPageBackgroundPresetDefaults(design.backgroundPreset || design.background_preset);
    const rawBackgroundSource = normalizeDesignEnum(
      design.backgroundSource || design.background_source,
      FULL_PAGE_BACKGROUND_SOURCES,
      rawBackgroundPresetDefaults ? "preset" : DEFAULT_FULL_PAGE_DESIGN.backgroundSource
    );
    const backgroundPresetDefaults = rawBackgroundSource === "preset" ? rawBackgroundPresetDefaults : null;
    const backgroundType = normalizeDesignEnum(design.backgroundType || design.background_type, FULL_PAGE_BACKGROUND_TYPES, backgroundPresetDefaults?.backgroundType || presetDefaults.backgroundType);
    const backgroundSource = backgroundPresetDefaults
      ? "preset"
      : rawBackgroundSource === "preset"
        ? DEFAULT_FULL_PAGE_DESIGN.backgroundSource
        : rawBackgroundSource;

    return {
      preset: presetDefaults.preset,
      backgroundType,
      backgroundSource,
      backgroundPreset: backgroundPresetDefaults?.key || "",
      backgroundColor: normalizeFullPageColor(design.backgroundColor || design.background_color, backgroundPresetDefaults?.backgroundColor || presetDefaults.backgroundColor),
      backgroundGradientTo: normalizeFullPageColor(design.backgroundGradientTo || design.background_gradient_to, presetDefaults.backgroundGradientTo),
      backgroundImageUrl: backgroundPresetDefaults?.imageUrl || defaultTrimText(design.backgroundImageUrl || design.background_image_url),
      backgroundVideoUrl: backgroundPresetDefaults?.videoUrl || defaultTrimText(design.backgroundVideoUrl || design.background_video_url),
      backgroundOverlayColor: normalizeFullPageColor(design.backgroundOverlayColor || design.background_overlay_color, backgroundPresetDefaults?.backgroundOverlayColor || presetDefaults.backgroundOverlayColor),
      backgroundOverlayOpacity: normalizeOverlayOpacity(design.backgroundOverlayOpacity ?? design.background_overlay_opacity, backgroundPresetDefaults?.backgroundOverlayOpacity ?? presetDefaults.backgroundOverlayOpacity),
      backgroundBlur: normalizeBackgroundBlur(design.backgroundBlur ?? design.background_blur, presetDefaults.backgroundBlur),
      backgroundFocalPoint: normalizeDesignEnum(design.backgroundFocalPoint || design.background_focal_point, ["center", "top", "left", "right"], presetDefaults.backgroundFocalPoint),
      textTheme: normalizeDesignEnum(design.textTheme || design.text_theme, ["dark", "light"], backgroundPresetDefaults?.textTheme || presetDefaults.textTheme),
      composerStyle: normalizeDesignEnum(design.composerStyle || design.composer_style, ["soft", "elevated", "minimal"], presetDefaults.composerStyle),
      chipStyle: normalizeDesignEnum(design.chipStyle || design.chip_style, ["outline", "soft", "subtle-fill"], presetDefaults.chipStyle),
      statusStyle: normalizeDesignEnum(design.statusStyle || design.status_style, ["subtle", "pill", "minimal"], presetDefaults.statusStyle),
      backgroundScope: normalizeDesignEnum(design.backgroundScope || design.background_scope, ["section", "iframe"], DEFAULT_FULL_PAGE_DESIGN.backgroundScope),
      disableVideoOnMobile: normalizeBoolean(design.disableVideoOnMobile ?? design.disable_video_on_mobile, backgroundPresetDefaults?.disableVideoOnMobile ?? presetDefaults.disableVideoOnMobile),
    };
  }

  function normalizeBoolean(value, fallbackValue = false) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = defaultTrimText(value).toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    return fallbackValue;
  }

  function normalizeVoiceConfig(agent = {}) {
    const config = agent.voiceConfig || agent.voice_config || {};
    const voice = defaultTrimText(config.voice || config.voice_style).toLowerCase();
    const languageBehavior = defaultTrimText(config.languageBehavior || config.language_behavior).toLowerCase();
    const allowedVoices = VOICE_STYLE_OPTIONS.map((option) => option.value);

    return {
      voiceInputEnabled: normalizeBoolean(
        config.voiceInputEnabled ?? config.voice_input_enabled,
        DEFAULT_VOICE_CONFIG.voiceInputEnabled
      ),
      spokenRepliesEnabled: normalizeBoolean(
        config.spokenRepliesEnabled ?? config.spoken_replies_enabled,
        DEFAULT_VOICE_CONFIG.spokenRepliesEnabled
      ),
      autoSendTranscript: normalizeBoolean(
        config.autoSendTranscript ?? config.auto_send_transcript,
        DEFAULT_VOICE_CONFIG.autoSendTranscript
      ),
      autoPlaySpokenReplies: normalizeBoolean(
        config.autoPlaySpokenReplies ?? config.auto_play_spoken_replies,
        DEFAULT_VOICE_CONFIG.autoPlaySpokenReplies
      ),
      voice: allowedVoices.includes(voice) ? voice : DEFAULT_VOICE_CONFIG.voice,
      languageBehavior: ["auto", "business"].includes(languageBehavior)
        ? languageBehavior
        : DEFAULT_VOICE_CONFIG.languageBehavior,
    };
  }

  function hasBookingSupport(agent = {}) {
    return Boolean(
      defaultTrimText(agent.bookingUrl || agent.booking_url)
      || defaultTrimText(agent.bookingStartUrl || agent.booking_start_url)
      || defaultTrimText(agent.bookingSuccessUrl || agent.booking_success_url)
      || defaultTrimText(agent.primaryCtaMode || agent.primary_cta_mode).toLowerCase() === "booking"
      || defaultTrimText(agent.fallbackCtaMode || agent.fallback_cta_mode).toLowerCase() === "booking"
    );
  }

  function isCalendlyBookingUrl(value = "") {
    const normalized = defaultTrimText(value);

    if (!normalized) {
      return false;
    }

    try {
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return parsed.protocol === "https:" && (hostname === "calendly.com" || hostname.endsWith(".calendly.com"));
    } catch {
      return false;
    }
  }

  function getBookingProvider(agent = {}) {
    const config = agent.fullPageConfig || agent.full_page_config || {};
    const configuredProvider = defaultTrimText(
      agent.bookingProvider
      || agent.booking_provider
      || config.bookingProvider
      || config.booking_provider
    ).toLowerCase();

    if (configuredProvider === "calendly" || configuredProvider === "manual") {
      return configuredProvider;
    }

    return isCalendlyBookingUrl(agent.bookingUrl || agent.booking_url) ? "calendly" : "manual";
  }

  function getBookingProviderStatus(agent = {}) {
    const bookingUrl = defaultTrimText(agent.bookingUrl || agent.booking_url);
    const provider = getBookingProvider(agent);

    if (!bookingUrl) {
      return {
        label: "Needs booking link",
        tone: "Pending",
        copy: "Add a booking URL before Vonza offers a booking handoff.",
      };
    }

    if (provider === "calendly" && isCalendlyBookingUrl(bookingUrl)) {
      return {
        label: "Calendly link connected",
        tone: "Ready",
        copy: "Vonza will send booking-intent visitors to this Calendly link.",
      };
    }

    return {
      label: "Manual link configured",
      tone: "Ready",
      copy: "Vonza will send booking-intent visitors to this booking link.",
    };
  }

  function getCalendlyWebhookStatus(agent = {}) {
    const provider = getBookingProvider(agent);
    const integration = agent.bookingIntegrationStatus || agent.booking_integration_status || {};

    if (provider !== "calendly") {
      return null;
    }

    if (!isCalendlyBookingUrl(agent.bookingUrl || agent.booking_url)) {
      return {
        label: "Needs attention",
        tone: "Warning",
        copy: "Calendly mode needs a public HTTPS Calendly booking link.",
      };
    }

    if (integration.state === "needs_attention" || integration.status === "needs_attention") {
      return {
        label: "Needs attention",
        tone: "Warning",
        copy: "Calendly webhook setup needs review before bookings are trusted.",
      };
    }

    if (integration.state === "connected" || integration.webhookConnected === true) {
      return {
        label: "Webhook connected",
        tone: "Ready",
        copy: "Vonza can record confirmed Calendly bookings from signed webhook events.",
      };
    }

    return {
      label: "Webhook not connected",
      tone: "Pending",
      copy: "Bookings can be started from the Calendly link, but confirmed bookings are not trusted until the webhook is connected.",
    };
  }

  function getDefaultFullPageActionCards(agent = {}) {
    const cards = DEFAULT_FULL_PAGE_ACTION_CARDS.map((card) => ({ ...card }));

    if (hasBookingSupport(agent)) {
      cards.push({ ...DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD });
    }

    return cards;
  }

  function normalizeActionCard(card = {}, fallbackCard = {}) {
    const label = limitText(card.label || fallbackCard.label, 40);
    const prompt = limitText(card.prompt || fallbackCard.prompt, 200);

    if (!label || !prompt) {
      return null;
    }

    return {
      label,
      description: limitText(card.description || card.copy || fallbackCard.description, 120),
      prompt,
      type: limitText(card.type || fallbackCard.type || "custom", 24).toLowerCase() || "custom",
      enabled: normalizeBoolean(card.enabled, fallbackCard.enabled !== false),
    };
  }

  function normalizeFullPageConfig(agent = {}) {
    const config = agent.fullPageConfig || agent.full_page_config || {};
    const defaults = getDefaultFullPageActionCards(agent);
    const rawCards = Array.isArray(config.actionCards)
      ? config.actionCards
      : Array.isArray(config.action_cards)
        ? config.action_cards
        : defaults;
    const cards = rawCards
      .slice(0, 6)
      .map((card, index) => normalizeActionCard(card, defaults[index] || {}))
      .filter(Boolean);
    const suggestedQuestions = (Array.isArray(config.suggestedQuestions)
      ? config.suggestedQuestions
      : Array.isArray(config.suggested_questions)
        ? config.suggested_questions
        : []
    ).map((question) => limitText(question, 120)).filter(Boolean).slice(0, 5);
    const trustItems = (Array.isArray(config.trustItems)
      ? config.trustItems
      : Array.isArray(config.trust_items)
        ? config.trust_items
        : DEFAULT_FULL_PAGE_TRUST_ITEMS
    ).map((item) => limitText(item, 60)).filter(Boolean).slice(0, 3);
    const bookingSupported = hasBookingSupport(agent);

    return {
      publicPageEnabled: normalizeBoolean(config.publicPageEnabled ?? config.public_page_enabled, false),
      publicPageKey: defaultTrimText(config.publicPageKey || config.public_page_key),
      headline: limitText(config.headline, 80),
      subtitle: limitText(config.subtitle, 180),
      actionCards: cards.length ? cards : defaults,
      suggestedQuestions,
      accentColor: normalizeFullPageColor(config.accentColor || config.accent_color, agent.primaryColor || "#14b8a6"),
      logoUrl: defaultTrimText(config.logoUrl || config.logo_url || agent.widgetLogoUrl),
      showBooking: bookingSupported && normalizeBoolean(config.showBooking ?? config.show_booking, bookingSupported),
      showQuote: normalizeBoolean(config.showQuote ?? config.show_quote, true),
      showContact: normalizeBoolean(config.showContact ?? config.show_contact, true),
      trustItems: trustItems.length ? trustItems : [...DEFAULT_FULL_PAGE_TRUST_ITEMS],
      design: normalizeFullPageDesign(config),
    };
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
      getDashboardUiStateValue:
        typeof options.getDashboardUiStateValue === "function"
          ? options.getDashboardUiStateValue
          : getFallbackDashboardUiStateValue,
      setDashboardUiStateValue:
        typeof options.setDashboardUiStateValue === "function"
          ? options.setDashboardUiStateValue
          : setFallbackDashboardUiStateValue,
    };
  }

  function getDashboardStateHelpers() {
    return global.VonzaDashboardState || {};
  }

  function normalizeFrontDeskSettingsTab(tabKey) {
    const dashboardState = getDashboardStateHelpers();
    if (typeof dashboardState.normalizeSettingsFrontDeskTab === "function") {
      return dashboardState.normalizeSettingsFrontDeskTab(tabKey);
    }

    const normalized = defaultTrimText(tabKey).toLowerCase().replace(/_/g, "-");
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
      "widget-appearance": "appearance",
      widget: "appearance",
    };
    const candidate = aliases[normalized] || aliases[normalized.replace(/-/g, "_")] || normalized;

    return FRONT_DESK_SETTINGS_TABS.includes(candidate) ? candidate : "identity";
  }

  function getFrontDeskSettingsTabHashSegment(tabKey) {
    const dashboardState = getDashboardStateHelpers();
    if (typeof dashboardState.getSettingsFrontDeskTabHashSegment === "function") {
      return dashboardState.getSettingsFrontDeskTabHashSegment(tabKey);
    }

    return FRONT_DESK_SETTINGS_TAB_HASH_SEGMENTS[normalizeFrontDeskSettingsTab(tabKey)] || "identity-welcome";
  }

  function normalizeFullPageSettingsTab(tabKey) {
    const normalized = defaultTrimText(tabKey).toLowerCase().replace(/_/g, "-");
    return FULL_PAGE_SETTINGS_TABS.includes(normalized) ? normalized : "content";
  }

  function getFallbackDashboardUiState() {
    try {
      const rawState = global.sessionStorage?.getItem(SETTINGS_FALLBACK_UI_STATE_STORAGE_KEY);
      return rawState ? JSON.parse(rawState) : {};
    } catch (_error) {
      return {};
    }
  }

  function setFallbackDashboardUiStateValue(key, value) {
    const nextState = {
      ...getFallbackDashboardUiState(),
      [key]: value,
    };

    try {
      global.sessionStorage?.setItem(SETTINGS_FALLBACK_UI_STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch (_error) {
      // Dashboard state persistence is best-effort.
    }

    return value;
  }

  function getFallbackDashboardUiStateValue(key) {
    return getFallbackDashboardUiState()[key] || "";
  }

  function getHashPathParts() {
    const rawHash = defaultTrimText(global.location?.hash).replace(/^#\/?/, "");
    const hashPath = rawHash.split(/[?&]/)[0];
    return hashPath
      .split("/")
      .map((part) => defaultTrimText(part).toLowerCase().replace(/_/g, "-"))
      .filter(Boolean);
  }

  function normalizeSettingsSection(sectionKey) {
    const dashboardState = getDashboardStateHelpers();
    if (typeof dashboardState.normalizeSettingsMainTab === "function") {
      return dashboardState.normalizeSettingsMainTab(sectionKey);
    }

    const normalized = defaultTrimText(sectionKey).toLowerCase();
    const normalizedAlias = normalized.replace(/-/g, "_");

    if (SETTINGS_SECTIONS.includes(normalized)) {
      return normalized;
    }

    if (SETTINGS_SECTIONS.includes(normalizedAlias)) {
      return normalizedAlias;
    }

    return SETTINGS_SECTION_ALIASES[normalized] || SETTINGS_SECTION_ALIASES[normalizedAlias] || SETTINGS_SECTIONS[0];
  }

  function getSettingsSectionFromHash() {
    const pathParts = getHashPathParts();

    if (pathParts[0] !== "settings") {
      return "";
    }

    return pathParts[1] ? normalizeSettingsSection(pathParts[1]) : "";
  }

  function getFrontDeskSettingsTabFromHash() {
    const pathParts = getHashPathParts();

    if (pathParts[0] !== "settings" || normalizeSettingsSection(pathParts[1]) !== "front_desk" || !pathParts[2]) {
      return "";
    }

    return normalizeFrontDeskSettingsTab(pathParts[2]);
  }

  function getSettingsHashSegment(sectionKey) {
    const dashboardState = getDashboardStateHelpers();
    if (typeof dashboardState.getSettingsMainTabHashSegment === "function") {
      return dashboardState.getSettingsMainTabHashSegment(sectionKey);
    }

    return normalizeSettingsSection(sectionKey).replace(/_/g, "-");
  }

  function syncSettingsSectionHash(sectionKey, options = {}) {
    if (!global.history?.replaceState || !global.location?.href) {
      return;
    }

    const normalizedSection = normalizeSettingsSection(sectionKey);
    const frontDeskTab = normalizedSection === "front_desk"
      ? normalizeFrontDeskSettingsTab(options.frontDeskTab || getActiveFrontDeskSettingsTab(options.helpers))
      : "";
    const nextHash = frontDeskTab
      ? `#settings/${getSettingsHashSegment(normalizedSection)}/${getFrontDeskSettingsTabHashSegment(frontDeskTab)}`
      : `#settings/${getSettingsHashSegment(normalizedSection)}`;
    const nextUrl = new URL(global.location.href);

    if (nextUrl.hash === nextHash) {
      return;
    }

    nextUrl.hash = nextHash;
    global.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  function getSectionByKey(sectionKey) {
    return SETTINGS_SECTION_DETAILS.find((section) => section.key === normalizeSettingsSection(sectionKey)) || SETTINGS_SECTION_DETAILS[0];
  }

  function getKnowledgeImportSettingsState(setup = {}) {
    const importStatus = setup.importStatus || null;
    const state = String(importStatus?.state || "").trim().toLowerCase();
    const active = ["queued", "running", "crawling", "indexing"].includes(state);
    const retryable = importStatus?.retryable === true || ["limited", "failed", "stalled"].includes(state);

    if (importStatus) {
      return {
        label: importStatus.label || "Website import",
        value: active ? `${importStatus.label || "Import"} now` : importStatus.label || "Website import",
        summary: importStatus.message || "Website import status will appear here.",
        retryable,
        active,
      };
    }

    return {
      label: setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Missing",
      value: setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" ? "Limited" : "Missing",
      summary: setup.knowledgeDescription || "Website knowledge status appears after import.",
      retryable: setup.knowledgeState === "limited",
      active: false,
    };
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
    return getSettingsSectionFromHash() || normalizeSettingsSection(global.localStorage?.getItem(SETTINGS_STORAGE_KEY));
  }

  function setActiveSettingsSection(section) {
    global.localStorage?.setItem(SETTINGS_STORAGE_KEY, normalizeSettingsSection(section));
  }

  function getActiveFrontDeskSettingsTab(helpers = getHelpers()) {
    return getFrontDeskSettingsTabFromHash()
      || normalizeFrontDeskSettingsTab(helpers.getDashboardUiStateValue("settingsFrontDeskTab"));
  }

  function setActiveFrontDeskSettingsTab(tabKey, helpers = getHelpers()) {
    const normalizedTab = normalizeFrontDeskSettingsTab(tabKey);
    helpers.setDashboardUiStateValue("settingsFrontDeskTab", getFrontDeskSettingsTabHashSegment(normalizedTab));
    return normalizedTab;
  }

  function getActiveFullPageSettingsTab(helpers = getHelpers()) {
    return normalizeFullPageSettingsTab(helpers.getDashboardUiStateValue("settingsFullPageTab"));
  }

  function setActiveFullPageSettingsTab(tabKey, helpers = getHelpers()) {
    const normalizedTab = normalizeFullPageSettingsTab(tabKey);
    helpers.setDashboardUiStateValue("settingsFullPageTab", normalizedTab);
    return normalizedTab;
  }

  function renderSettingsIcon(name) {
    const icons = {
      general: '<path d="M12 3v2.2M12 18.8V21M4.64 4.64l1.56 1.56M17.8 17.8l1.56 1.56M3 12h2.2M18.8 12H21M4.64 19.36l1.56-1.56M17.8 6.2l1.56-1.56"/><circle cx="12" cy="12" r="3.2"/>',
      team: '<path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4"/><circle cx="9.5" cy="7" r="4"/><path d="M22 19c0-2-1.2-3.4-3-3.8"/><path d="M16 3.4a4 4 0 0 1 0 7.2"/>',
      notifications: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
      account_billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
      privacy: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      privacy_legal: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
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
    const { escapeHtml, translateDashboardText } = helpers;

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
            >${renderSettingsIcon(section.key)}<span class="settings-shell-nav-copy"><strong>${escapeHtml(translateDashboardText(section.label))}</strong><small>${escapeHtml(translateDashboardText(section.note))}</small></span></button>
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

  function buildBusinessContextSetupPanel(agent, setup, operatorWorkspace, helpers) {
    const { escapeHtml, getBadgeClass, getBusinessProfileViewModel } = helpers;
    const profile = getBusinessProfileViewModel(operatorWorkspace);
    const knowledgeActionLabel = setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge";
    const importState = getKnowledgeImportSettingsState(setup);

    return `
      <div data-settings-section="business_profile" class="settings-shell-form settings-shell-form--system settings-business-profile-panel" id="settings-section-business_profile">
        <header class="settings-shell-page-header" id="business-context-setup">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Business profile</p>
            <h2 class="settings-shell-page-title">Business profile</h2>
            <p class="settings-shell-page-copy">Keep the business facts Vonza should trust when the hosted Front Desk page, QR links, embeds, or optional widget answer customer questions.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs details" : "Profile ready"}</span>
            <span class="${getBadgeClass(profile.prefill?.available ? "Ready" : "Limited")}">${profile.prefill?.available ? "Safe suggestions loaded" : "No prefill available"}</span>
          </div>
        </header>

        <section class="settings-operational-summary settings-operational-summary--business" aria-label="Business profile readiness summary">
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Answer grounding</span>
              <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs detail" : "Ready"}</span>
            </div>
            <p>${escapeHtml(profile.readiness?.summary || "Business profile readiness will appear here.")}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Website knowledge</span>
              <span class="${getBadgeClass(importState.active ? "Pending" : setup.knowledgeState === "ready" ? "Ready" : setup.knowledgeState === "limited" || importState.retryable ? "Limited" : "Pending")}">${escapeHtml(importState.value)}</span>
            </div>
            <p>${escapeHtml(importState.summary)}</p>
          </article>
        </section>

        <section class="settings-shell-section">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Business Profile readiness</h3>
              <p class="settings-shell-section-copy">Review what is ready and what still needs detail before this profile supports live customer questions.</p>
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

        <form data-settings-form data-form-kind="customize" class="settings-shell-section settings-business-website-form">
          <div class="settings-shell-section-header">
            <div>
              <h3 class="settings-shell-section-title">Website knowledge</h3>
              <p class="settings-shell-section-copy">Set the website Vonza should learn from, and review the current import status.</p>
            </div>
          </div>
          <div class="settings-shell-field-stack">
            <div class="field">
              <label for="business-website-url">Website URL</label>
              <input id="business-website-url" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}" placeholder="https://example.com">
              <p class="field-help">Changing this website uses the existing assistant save flow and runs website import afterward.</p>
            </div>
          </div>
          <div class="settings-shell-status-list">
            <div class="settings-shell-status-row settings-shell-status-row--actions">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Import status</p>
                <h4 class="settings-shell-status-value">${escapeHtml(importState.value)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(importState.summary)}</p>
                ${importState.retryable ? `<p class="settings-shell-status-copy">Retry starts a fresh async import for full-page Front Desk knowledge.</p>` : ""}
              </div>
              <div class="settings-shell-status-actions">
                <button class="ghost-button" type="button" data-action="import-knowledge" ${importState.retryable ? 'data-import-force="true"' : ""}>${escapeHtml(importState.retryable ? "Retry website import" : knowledgeActionLabel)}</button>
              </div>
            </div>
          </div>
          <div class="settings-shell-sticky-save">
            <span data-save-state class="save-state">No changes yet.</span>
            <button class="primary-button" type="submit">Save website</button>
          </div>
        </form>

        <form data-settings-form data-form-kind="business-context" class="settings-business-context-form">
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
      </div>
    `;
  }

  function buildFrontDeskSettingsForm(agent, _setup, helpers) {
    const {
      escapeHtml,
      trimText,
      buildBehaviorSummary,
      isCapabilityExplicitlyVisible,
      getDefaultInstallStatus,
    } = helpers;
    const behaviorSummary = buildBehaviorSummary(agent.tone, agent.systemPrompt);
    const manualOutcomeVisible = isCapabilityExplicitlyVisible("manual_outcome_marks");
    const advancedGuidanceVisible = isCapabilityExplicitlyVisible("advanced_guidance");
    const installStatus = getDefaultInstallStatus(agent);
    const selectedPurpose = normalizeWidgetPurpose(agent.purpose);
    const selectedPurposeOption = getWidgetPurposeOption(selectedPurpose);
    const primaryColor = agent.primaryColor || "#14b8a6";
    const fullPageConfig = normalizeFullPageConfig(agent);
    const voiceConfig = normalizeVoiceConfig(agent);
    const fullPageDesign = fullPageConfig.design;
    const fullPageHeadline = fullPageConfig.headline || "Front Desk";
    const fullPageSubtitle = fullPageConfig.subtitle || "Ask about services, pricing, quotes, or contact details.";
    const fullPageAccentColor = fullPageConfig.accentColor || primaryColor;
    const fullPageSuggestedQuestionsText = fullPageConfig.suggestedQuestions.join("\n");
    const fullPageTrustItemsText = fullPageConfig.trustItems.join("\n");
    const bookingSupported = hasBookingSupport(agent);
    const bookingProvider = getBookingProvider(agent);
    const bookingProviderStatus = getBookingProviderStatus(agent);
    const calendlyWebhookStatus = getCalendlyWebhookStatus(agent);
    const activeFrontDeskTab = getActiveFrontDeskSettingsTab(helpers);
    const activeFullPageTab = getActiveFullPageSettingsTab(helpers);
    const frontDeskTabClass = (tab) => normalizeFrontDeskSettingsTab(tab) === activeFrontDeskTab ? "active" : "";
    const frontDeskTabSelected = (tab) => normalizeFrontDeskSettingsTab(tab) === activeFrontDeskTab ? "true" : "false";
    const frontDeskPanelAttrs = (tab) => normalizeFrontDeskSettingsTab(tab) === activeFrontDeskTab ? "" : "hidden";
    const fullPageTabClass = (tab) => normalizeFullPageSettingsTab(tab) === activeFullPageTab ? "active" : "";
    const fullPageTabSelected = (tab) => normalizeFullPageSettingsTab(tab) === activeFullPageTab ? "true" : "false";
    const fullPagePanelAttrs = (tab) => normalizeFullPageSettingsTab(tab) === activeFullPageTab ? "" : "hidden";
    const enabledPreviewCards = fullPageConfig.actionCards
      .filter((card) => {
        if (card.type === "booking" && (!bookingSupported || !fullPageConfig.showBooking)) return false;
        if (card.type === "quote" && !fullPageConfig.showQuote) return false;
        if (card.type === "contact" && !fullPageConfig.showContact) return false;
        return card.enabled !== false;
      })
      .slice(0, 4);
    const routingDestinationCount = [
      agent.contactEmail,
      agent.contactPhone,
      agent.bookingUrl,
      agent.quoteUrl,
      agent.checkoutUrl,
    ].filter((value) => trimText(value)).length;
    const frontDeskOperationalRows = [
      {
        label: "Hosted full-page assistant",
        value: fullPageConfig.publicPageEnabled ? "Live" : "Disabled",
        tone: fullPageConfig.publicPageEnabled ? "Ready" : "Pending",
        copy: fullPageConfig.publicPageEnabled
          ? "Ready for direct links, QR codes, WordPress pages, and smart embeds."
          : "Enable public access before sharing links, QR codes, or page embeds.",
      },
      {
        label: "Launch routing",
        value: routingDestinationCount ? `${routingDestinationCount} destination${routingDestinationCount === 1 ? "" : "s"}` : "Needs routes",
        tone: routingDestinationCount ? "Ready" : "Limited",
        copy: routingDestinationCount
          ? "Contact, booking, quote, or checkout destinations are available for customer next steps."
          : "Add contact, booking, quote, or checkout destinations before relying on handoffs.",
      },
      {
        label: "Optional website bubble",
        value: installStatus.label || "Not installed yet",
        tone: installStatus.state === "seen_recently" ? "Ready" : installStatus.state === "installed_unseen" ? "Limited" : "Pending",
        copy: "Secondary launcher. The hosted Front Desk page remains the primary customer-facing surface.",
      },
    ];

    return `
      <form data-settings-form data-form-kind="customize" data-settings-section="front_desk" class="settings-shell-form settings-shell-form--system settings-frontdesk-form" id="settings-section-front_desk">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Front Desk</p>
            <h2 class="settings-shell-page-title">Front Desk</h2>
            <p class="settings-shell-page-copy">Configure the customer-facing Front Desk page first, then routing, appearance, and the optional website widget.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="badge success">${escapeHtml(selectedPurposeOption.label)}</span>
            <span class="${helpers.getBadgeClass(fullPageConfig.publicPageEnabled ? "Ready" : "Pending")}">${escapeHtml(fullPageConfig.publicPageEnabled ? "Hosted page live" : "Hosted page off")}</span>
            <span class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
          </div>
        </header>

        <section class="settings-operational-summary" aria-label="Front Desk launch settings summary">
          ${frontDeskOperationalRows.map((row) => `
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>${escapeHtml(row.label)}</span>
                <span class="${helpers.getBadgeClass(row.tone)}">${escapeHtml(row.value)}</span>
              </div>
              <p>${escapeHtml(row.copy)}</p>
            </article>
          `).join("")}
        </section>

        <div class="settings-frontdesk-subnav" role="tablist" aria-label="Front Desk configuration sections">
          <button class="settings-frontdesk-subnav-button ${frontDeskTabClass("identity")}" type="button" data-frontdesk-settings-tab="identity" aria-selected="${frontDeskTabSelected("identity")}">Identity & welcome</button>
          <button class="settings-frontdesk-subnav-button ${frontDeskTabClass("voice")}" type="button" data-frontdesk-settings-tab="voice" aria-selected="${frontDeskTabSelected("voice")}">Voice</button>
          <button class="settings-frontdesk-subnav-button ${frontDeskTabClass("full_page")}" type="button" data-frontdesk-settings-tab="full_page" aria-selected="${frontDeskTabSelected("full_page")}">Full-page assistant</button>
          <button class="settings-frontdesk-subnav-button ${frontDeskTabClass("routing")}" type="button" data-frontdesk-settings-tab="routing" aria-selected="${frontDeskTabSelected("routing")}">Routing</button>
          <button class="settings-frontdesk-subnav-button ${frontDeskTabClass("appearance")}" type="button" data-frontdesk-settings-tab="appearance" aria-selected="${frontDeskTabSelected("appearance")}">Optional widget</button>
        </div>

        <div class="settings-frontdesk-layout">
          <div class="settings-frontdesk-editor">
            <section class="settings-shell-section" data-frontdesk-settings-panel="identity" ${frontDeskPanelAttrs("identity")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Front Desk purpose</h3>
                  <p class="settings-shell-section-copy">What should your customer-facing Front Desk mainly help visitors do?</p>
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

            <section class="settings-shell-section" data-frontdesk-settings-panel="identity" ${frontDeskPanelAttrs("identity")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Identity and welcome</h3>
                  <p class="settings-shell-section-copy">Keep this customer-facing so the first interaction feels native to the business.</p>
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
                  <label for="assistant-button-label">Website bubble launcher text</label>
                  <input id="assistant-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}">
                </div>
                <div class="field">
                  <label for="settings-primary-color">Accent color</label>
                  <input id="settings-primary-color" name="primary_color" type="color" value="${escapeHtml(primaryColor)}">
                </div>
                <div class="field settings-field-wide">
                  <label for="assistant-welcome">Welcome message</label>
                  <textarea id="assistant-welcome" name="welcome_message">${escapeHtml(agent.welcomeMessage || "")}</textarea>
                </div>
              </div>
            </section>

            <section class="settings-shell-section" data-frontdesk-settings-panel="voice" ${frontDeskPanelAttrs("voice")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Voice</h3>
                  <p class="settings-shell-section-copy">Visitors can speak their question. Vonza transcribes it, answers using your existing Front Desk setup, and can optionally read the answer aloud.</p>
                </div>
              </div>
              <div class="settings-shell-choice-list">
                <label class="settings-shell-choice-row" for="voice-input-enabled">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Enable voice input</p>
                    <p class="settings-shell-key-value-copy">Show a microphone button so visitors can record a short question.</p>
                  </div>
                  <input id="voice-input-enabled" name="voice_input_enabled" type="checkbox" ${voiceConfig.voiceInputEnabled ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="spoken-replies-enabled">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Enable spoken replies</p>
                    <p class="settings-shell-key-value-copy">Allow visitors to play Vonza's text answer as AI-generated voice.</p>
                  </div>
                  <input id="spoken-replies-enabled" name="spoken_replies_enabled" type="checkbox" ${voiceConfig.spokenRepliesEnabled ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="auto-send-transcript">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Auto-send transcript after speaking</p>
                    <p class="settings-shell-key-value-copy">Send the transcript immediately after recording instead of placing it in the composer.</p>
                  </div>
                  <input id="auto-send-transcript" name="auto_send_transcript" type="checkbox" ${voiceConfig.autoSendTranscript ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="auto-play-spoken-replies">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Auto-play spoken replies</p>
                    <p class="settings-shell-key-value-copy">Start audio playback after each answer when the visitor has enabled spoken replies.</p>
                  </div>
                  <input id="auto-play-spoken-replies" name="auto_play_spoken_replies" type="checkbox" ${voiceConfig.autoPlaySpokenReplies ? "checked" : ""}>
                </label>
              </div>
              <div class="settings-field-grid settings-field-grid--two">
                <div class="field">
                  <label for="voice-style">Voice style</label>
                  <select id="voice-style" name="voice">
                    ${VOICE_STYLE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${voiceConfig.voice === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                  </select>
                  <p class="field-help">Only built-in AI voices are available. Voice cloning is not supported.</p>
                </div>
                <div class="field">
                  <label for="voice-language-behavior">Language behavior</label>
                  <select id="voice-language-behavior" name="voice_language_behavior">
                    <option value="auto" ${voiceConfig.languageBehavior === "auto" ? "selected" : ""}>Auto-detect</option>
                    <option value="business" ${voiceConfig.languageBehavior === "business" ? "selected" : ""}>Force dashboard/business language</option>
                  </select>
                  <p class="field-help">Auto-detect follows the visitor's question when possible.</p>
                </div>
              </div>
              <p class="settings-shell-section-copy">Voice is processed to transcribe the visitor's question. Voice output is AI-generated.</p>
            </section>

            <section class="settings-shell-section settings-full-page-section" id="settings-front-desk-full-page" data-frontdesk-settings-panel="full_page" ${frontDeskPanelAttrs("full_page")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Full-page assistant and hosted page</h3>
                  <p class="settings-shell-section-copy">Customize the primary Front Desk page customers open from links, WordPress pages, smart embeds, QR codes, and direct assistant pages.</p>
                </div>
              </div>
              <div class="settings-full-page-subnav" role="tablist" aria-label="Front Desk page customization sections">
                <button class="settings-full-page-subnav-button ${fullPageTabClass("content")}" type="button" data-full-page-settings-tab="content" aria-selected="${fullPageTabSelected("content")}">Content</button>
                <button class="settings-full-page-subnav-button ${fullPageTabClass("design")}" type="button" data-full-page-settings-tab="design" aria-selected="${fullPageTabSelected("design")}">Design</button>
                <button class="settings-full-page-subnav-button ${fullPageTabClass("layout")}" type="button" data-full-page-settings-tab="layout" aria-selected="${fullPageTabSelected("layout")}">Layout</button>
              </div>
              <div class="settings-full-page-grid">
                <div class="settings-shell-field-stack" data-full-page-settings-panel="content" ${fullPagePanelAttrs("content")}>
                  <div class="settings-shell-choice-row">
                    <div class="settings-shell-choice-main">
                      <p class="settings-shell-choice-title">${fullPageConfig.publicPageEnabled ? "Your Front Desk page is live" : "Your Front Desk page is disabled"}</p>
                      <p class="settings-shell-key-value-copy">${fullPageConfig.publicPageEnabled ? "Anyone with the protected public link can open this customer-facing Front Desk page." : "Enable public Front Desk page access before sharing links, embeds, or QR codes."}</p>
                    </div>
                    <input name="full_page_public_enabled" type="checkbox" ${fullPageConfig.publicPageEnabled ? "checked" : ""}>
                  </div>
                  <input type="hidden" name="full_page_public_page_key" value="${escapeHtml(fullPageConfig.publicPageKey || "")}">
                  <div class="field">
                    <label for="full-page-headline">Headline</label>
                    <input id="full-page-headline" name="full_page_headline" type="text" maxlength="80" value="${escapeHtml(fullPageConfig.headline || "")}" placeholder="Front Desk">
                    <p class="field-help">Leave blank to show the default title, Front Desk.</p>
                  </div>
                  <div class="field">
                    <label for="full-page-subtitle">Subtitle</label>
                    <textarea id="full-page-subtitle" name="full_page_subtitle" maxlength="180" placeholder="Ask about services, pricing, quotes, or contact details.">${escapeHtml(fullPageConfig.subtitle || "")}</textarea>
                  </div>
                  <div class="settings-field-grid settings-field-grid--two">
                    <div class="field">
                      <label for="full-page-accent-color">Accent color</label>
                      <input id="full-page-accent-color" name="full_page_accent_color" type="color" value="${escapeHtml(fullPageAccentColor)}">
                    </div>
                    <div class="field">
                      <label for="full-page-logo-url">Logo/avatar URL</label>
                      <input id="full-page-logo-url" name="full_page_logo_url" type="url" value="${escapeHtml(fullPageConfig.logoUrl || "")}" placeholder="https://example.com/logo.png">
                      <p class="field-help">Optional. Leave blank to use the assistant initial or optional website bubble logo.</p>
                    </div>
                  </div>
                  <div class="settings-full-page-toggle-row">
                    ${bookingSupported ? `
                      <label class="settings-toggle-pill">
                        <input name="full_page_show_booking" type="checkbox" ${fullPageConfig.showBooking ? "checked" : ""}>
                        <span>Show booking card</span>
                      </label>
                    ` : ""}
                    <label class="settings-toggle-pill">
                      <input name="full_page_show_quote" type="checkbox" ${fullPageConfig.showQuote ? "checked" : ""}>
                      <span>Show quote card</span>
                    </label>
                    <label class="settings-toggle-pill">
                      <input name="full_page_show_contact" type="checkbox" ${fullPageConfig.showContact ? "checked" : ""}>
                      <span>Show contact card</span>
                    </label>
                  </div>
                  <div class="field">
                    <label for="full-page-suggested-questions">Suggested questions</label>
                    <textarea id="full-page-suggested-questions" name="full_page_suggested_questions" maxlength="700" placeholder="One question per line">${escapeHtml(fullPageSuggestedQuestionsText)}</textarea>
                    <p class="field-help">Shown as compact chips when action cards are not taking the same space.</p>
                  </div>
                  <div class="field">
                    <label for="full-page-trust-items">Trust/status copy</label>
                    <textarea id="full-page-trust-items" name="full_page_trust_items" maxlength="220" placeholder="One short item per line">${escapeHtml(fullPageTrustItemsText)}</textarea>
                  </div>
                </div>
                <div class="settings-shell-field-stack" data-full-page-settings-panel="design" ${fullPagePanelAttrs("design")}>
                  <input type="hidden" name="full_page_background_source" value="${escapeHtml(fullPageDesign.backgroundSource)}" data-full-page-background-source>
                  <input type="hidden" name="full_page_background_preset" value="${escapeHtml(fullPageDesign.backgroundPreset || "")}" data-full-page-background-preset>
                  <div class="settings-field-grid settings-field-grid--two">
                    <div class="field">
                      <label for="full-page-design-preset">Preset</label>
                      <select id="full-page-design-preset" name="full_page_design_preset" data-full-page-design-preset>
                        ${FULL_PAGE_PRESET_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.preset === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="field">
                      <label for="full-page-background-type">Background type</label>
                      <select id="full-page-background-type" name="full_page_background_type" data-full-page-background-type>
                        ${FULL_PAGE_BACKGROUND_TYPE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.backgroundType === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="full-page-background-scope">Background coverage</label>
                    <select id="full-page-background-scope" name="full_page_background_scope">
                      ${FULL_PAGE_BACKGROUND_SCOPE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.backgroundScope === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                    </select>
                    <p class="field-help">Assistant section is recommended for the smart full-page embed. Iframe only keeps the background inside the iframe.</p>
                  </div>
                  <div class="settings-field-grid settings-field-grid--two" data-full-page-background-control="color gradient image video">
                    <div class="field">
                      <label for="full-page-background-color">Background color</label>
                      <input id="full-page-background-color" name="full_page_background_color" type="color" value="${escapeHtml(fullPageDesign.backgroundColor)}">
                    </div>
                    <div class="field" data-full-page-background-control="gradient">
                      <label for="full-page-gradient-to">Gradient color</label>
                      <input id="full-page-gradient-to" name="full_page_background_gradient_to" type="color" value="${escapeHtml(fullPageDesign.backgroundGradientTo)}">
                    </div>
                  </div>
                  <div class="settings-full-page-background-presets" data-full-page-background-control="image">
                    ${Object.values(FULL_PAGE_BACKGROUND_PRESETS).filter((preset) => preset.backgroundType === "image").map((preset) => `
                      <button class="settings-background-preset-card ${fullPageDesign.backgroundPreset === preset.key ? "selected" : ""}" type="button" data-full-page-background-preset-option="${escapeHtml(preset.key)}" aria-pressed="${fullPageDesign.backgroundPreset === preset.key ? "true" : "false"}">
                        <span class="settings-background-preset-thumb" style="background-image:url('${escapeHtml(preset.imageUrl)}')" aria-hidden="true"></span>
                        <span class="settings-background-preset-copy">
                          <strong>${escapeHtml(preset.label)}</strong>
                          <small>${escapeHtml(preset.description)}</small>
                          <span>Use background</span>
                        </span>
                      </button>
                    `).join("")}
                  </div>
                  <div class="settings-full-page-background-presets" data-full-page-background-control="video">
                    ${Object.values(FULL_PAGE_BACKGROUND_PRESETS).filter((preset) => preset.backgroundType === "video").map((preset) => `
                      <button class="settings-background-preset-card ${fullPageDesign.backgroundPreset === preset.key ? "selected" : ""}" type="button" data-full-page-background-preset-option="${escapeHtml(preset.key)}" aria-pressed="${fullPageDesign.backgroundPreset === preset.key ? "true" : "false"}">
                        <span class="settings-background-preset-thumb" style="background-image:url('${escapeHtml(preset.imageUrl)}')" aria-hidden="true"></span>
                        <span class="settings-background-preset-copy">
                          <strong>${escapeHtml(preset.label)}</strong>
                          <small>${escapeHtml(preset.description)}</small>
                          <span>Use background</span>
                        </span>
                      </button>
                    `).join("")}
                  </div>
                  <div class="field" data-full-page-background-control="image video">
                    <label for="full-page-background-image-url">Image / fallback URL</label>
                    <input id="full-page-background-image-url" name="full_page_background_image_url" type="text" value="${escapeHtml(fullPageDesign.backgroundImageUrl || "")}" placeholder="https://example.com/hero.webp">
                    <p class="field-help">PNG, JPG, JPEG, or WebP URL for image backgrounds or video fallback.</p>
                  </div>
                  <div class="settings-field-grid settings-field-grid--two" data-full-page-background-control="image video">
                    <div class="field" data-full-page-background-control="image">
                      <label for="full-page-background-image-file">Upload image background</label>
                      <input id="full-page-background-image-file" name="full_page_background_image_file" type="file" accept="image/png,image/jpeg,image/webp" data-full-page-background-upload="image">
                      <p class="field-help">PNG, JPG, JPEG, or WebP. Max 8 MB. SVG is not allowed.</p>
                    </div>
                    <div class="field" data-full-page-background-control="video">
                      <label for="full-page-background-video-file">Upload video background</label>
                      <input id="full-page-background-video-file" name="full_page_background_video_file" type="file" accept="video/mp4,video/webm" data-full-page-background-upload="video">
                      <p class="field-help">MP4 or WebM. Max 50 MB. Video renders muted, looped, and inline.</p>
                    </div>
                  </div>
                  <div class="field" data-full-page-background-control="video">
                    <label for="full-page-background-video-url">Video URL</label>
                    <input id="full-page-background-video-url" name="full_page_background_video_url" type="text" value="${escapeHtml(fullPageDesign.backgroundVideoUrl || "")}" placeholder="https://example.com/hero.webm">
                    <p class="field-help">MP4 or WebM URL. Video is muted and loops behind the canvas.</p>
                  </div>
                  <div class="settings-field-grid settings-field-grid--two" data-full-page-background-control="image video">
                    <div class="field">
                      <label for="full-page-overlay-color">Overlay color</label>
                      <input id="full-page-overlay-color" name="full_page_background_overlay_color" type="color" value="${escapeHtml(fullPageDesign.backgroundOverlayColor)}">
                    </div>
                    <div class="field">
                      <label for="full-page-overlay-opacity">Overlay opacity</label>
                      <input id="full-page-overlay-opacity" name="full_page_background_overlay_opacity" type="range" min="0" max="0.92" step="0.04" value="${escapeHtml(fullPageDesign.backgroundOverlayOpacity)}" data-full-page-range-output="full-page-overlay-opacity-value">
                      <p class="field-help"><span id="full-page-overlay-opacity-value">${escapeHtml(String(Math.round(fullPageDesign.backgroundOverlayOpacity * 100)))}%</span></p>
                    </div>
                  </div>
                  <div class="settings-field-grid settings-field-grid--two" data-full-page-background-control="image video">
                    <div class="field">
                      <label for="full-page-background-blur">Blur</label>
                      <input id="full-page-background-blur" name="full_page_background_blur" type="range" min="0" max="18" step="1" value="${escapeHtml(fullPageDesign.backgroundBlur)}" data-full-page-range-output="full-page-background-blur-value">
                      <p class="field-help"><span id="full-page-background-blur-value">${escapeHtml(String(fullPageDesign.backgroundBlur))}px</span></p>
                    </div>
                    <div class="field">
                      <label for="full-page-background-focal-point">Focal point</label>
                      <select id="full-page-background-focal-point" name="full_page_background_focal_point">
                        ${FULL_PAGE_FOCAL_POINT_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.backgroundFocalPoint === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                  </div>
                  <label class="settings-toggle-pill" data-full-page-background-control="video">
                    <input name="full_page_disable_video_on_mobile" type="checkbox" ${fullPageDesign.disableVideoOnMobile ? "checked" : ""}>
                    <span>Disable video on mobile</span>
                  </label>
                  <div class="settings-field-grid settings-field-grid--two">
                    <div class="field">
                      <label for="full-page-text-theme">Text theme</label>
                      <select id="full-page-text-theme" name="full_page_text_theme">
                        ${FULL_PAGE_TEXT_THEME_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.textTheme === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="field">
                      <label for="full-page-composer-style">Composer style</label>
                      <select id="full-page-composer-style" name="full_page_composer_style">
                        ${FULL_PAGE_COMPOSER_STYLE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.composerStyle === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="field">
                      <label for="full-page-chip-style">Chip style</label>
                      <select id="full-page-chip-style" name="full_page_chip_style">
                        ${FULL_PAGE_CHIP_STYLE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.chipStyle === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="field">
                      <label for="full-page-status-style">Status style</label>
                      <select id="full-page-status-style" name="full_page_status_style">
                        ${FULL_PAGE_STATUS_STYLE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${fullPageDesign.statusStyle === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                      </select>
                    </div>
                  </div>
                </div>
                <aside class="settings-full-page-preview-card settings-full-page-preview-card--canvas" aria-label="Front Desk page preview" data-full-page-design-preview data-background-type="${escapeHtml(fullPageDesign.backgroundType)}" data-text-theme="${escapeHtml(fullPageDesign.textTheme)}" data-chip-style="${escapeHtml(fullPageDesign.chipStyle)}" data-composer-style="${escapeHtml(fullPageDesign.composerStyle)}" data-status-style="${escapeHtml(fullPageDesign.statusStyle)}" style="--full-page-preview-accent:${escapeHtml(fullPageAccentColor)};--full-page-preview-bg:${escapeHtml(fullPageDesign.backgroundColor)};--full-page-preview-gradient:${escapeHtml(fullPageDesign.backgroundGradientTo)};--full-page-preview-overlay:${escapeHtml(fullPageDesign.backgroundOverlayColor)};--full-page-preview-overlay-opacity:${escapeHtml(String(fullPageDesign.backgroundOverlayOpacity))};--full-page-preview-image:${fullPageDesign.backgroundImageUrl ? `url('${escapeHtml(fullPageDesign.backgroundImageUrl)}')` : "none"};--full-page-preview-blur:${escapeHtml(String(fullPageDesign.backgroundBlur))}px;--full-page-preview-position:${escapeHtml(fullPageDesign.backgroundFocalPoint)}">
                  <video class="settings-full-page-preview-video" data-full-page-preview-video muted loop playsinline ${fullPageDesign.backgroundType === "video" && fullPageDesign.backgroundVideoUrl ? `src="${escapeHtml(fullPageDesign.backgroundVideoUrl)}"` : ""} ${fullPageDesign.backgroundType === "video" && fullPageDesign.backgroundImageUrl ? `poster="${escapeHtml(fullPageDesign.backgroundImageUrl)}"` : ""} ${fullPageDesign.backgroundType === "video" && fullPageDesign.backgroundVideoUrl ? "" : "hidden"}></video>
                  <div class="settings-full-page-preview-header">
                    <span class="settings-full-page-preview-logo" aria-hidden="true">
                      ${fullPageConfig.logoUrl ? `<img src="${escapeHtml(fullPageConfig.logoUrl)}" alt="">` : `<span>${escapeHtml((agent.assistantName || agent.name || "V").trim().charAt(0).toUpperCase() || "V")}</span>`}
                    </span>
                    <div>
                      <p>${escapeHtml(agent.assistantName || agent.name || "Business assistant")}</p>
                      <strong>${escapeHtml(fullPageHeadline)}</strong>
                    </div>
                  </div>
                  <p class="settings-full-page-preview-subtitle">${escapeHtml(fullPageSubtitle)}</p>
                  <div class="settings-full-page-preview-status">
                    <span class="status-dot"></span>
                    <span>AI assistant online</span>
                  </div>
                  <div class="settings-full-page-preview-actions">
                    ${(enabledPreviewCards.length ? enabledPreviewCards : fullPageConfig.actionCards.slice(0, 4)).map((card) => `
                      <span>${escapeHtml(card.label)}</span>
                    `).join("")}
                  </div>
                  <div class="settings-full-page-preview-composer">
                    <span>Type your question...</span>
                    <strong>Send</strong>
                  </div>
                  <div class="settings-full-page-preview-trust">
                    ${fullPageConfig.trustItems.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                  </div>
                </aside>
              </div>

              <div class="settings-full-page-action-editor" aria-label="Front Desk page action cards" data-full-page-settings-panel="layout" ${fullPagePanelAttrs("layout")}>
                <div class="settings-full-page-action-editor-head">
                  <h4 class="settings-shell-section-title settings-shell-section-title--compact">Action cards</h4>
                  <p class="settings-shell-section-copy">Edit the starter prompts customers can click on the hosted page.</p>
                </div>
                ${fullPageConfig.actionCards
                  .filter((card) => card.type !== "booking" || bookingSupported)
                  .map((card, index) => `
                    <div class="settings-full-page-action-card" data-full-page-action-card="${index}">
                      <input type="hidden" name="full_page_action_${index}_type" value="${escapeHtml(card.type || "custom")}">
                      <label class="settings-toggle-pill settings-full-page-action-toggle">
                        <input name="full_page_action_${index}_enabled" type="checkbox" ${card.enabled !== false ? "checked" : ""}>
                        <span>Enabled</span>
                      </label>
                      <div class="field">
                        <label for="full-page-action-${index}-label">Label</label>
                        <input id="full-page-action-${index}-label" name="full_page_action_${index}_label" type="text" maxlength="40" value="${escapeHtml(card.label)}">
                      </div>
                      <div class="field">
                        <label for="full-page-action-${index}-prompt">Prompt</label>
                        <input id="full-page-action-${index}-prompt" name="full_page_action_${index}_prompt" type="text" maxlength="200" value="${escapeHtml(card.prompt)}">
                      </div>
                      <div class="field settings-field-wide">
                        <label for="full-page-action-${index}-description">Description</label>
                        <input id="full-page-action-${index}-description" name="full_page_action_${index}_description" type="text" maxlength="120" value="${escapeHtml(card.description || "")}">
                      </div>
                    </div>
                  `).join("")}
              </div>
            </section>

            <section class="settings-shell-section" data-frontdesk-settings-panel="routing" ${frontDeskPanelAttrs("routing")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Routing defaults</h3>
                  <p class="settings-shell-section-copy">Tell Vonza where customers should go when the safest next step is to contact, book, or request a quote.</p>
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
                  <p class="field-help">This is the default route when an intent-specific destination is missing.</p>
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
                  <p class="field-help">If a direct route is missing, Vonza follows this fallback.</p>
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
                  <p class="field-help">One domain per line. Keep it limited to real widget hosts.</p>
                </div>
                <div class="field">
                  <label for="assistant-business-hours-note">Availability note</label>
                  <textarea id="assistant-business-hours-note" name="business_hours_note" placeholder="${escapeHtml(helpers.translateDashboardText("Open Mon-Fri, 9am-5pm. Same-day callbacks usually happen before 4pm."))}">${escapeHtml(agent.businessHoursNote || "")}</textarea>
                  <p class="field-help">Optional. This appears in the handoff card.</p>
                </div>
              </div>
            </section>

            <section class="settings-shell-section" data-frontdesk-settings-panel="routing" ${frontDeskPanelAttrs("routing")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Outcome routing</h3>
                  <p class="settings-shell-section-copy">Map the destinations Vonza can use for booking, quote, checkout, and success-state routing.</p>
                </div>
              </div>
              <div class="settings-shell-field-stack">
                <div class="field">
                  <label for="assistant-booking-provider">Booking provider</label>
                  <select id="assistant-booking-provider" name="booking_provider">
                    <option value="manual" ${bookingProvider === "manual" ? "selected" : ""}>Manual booking link</option>
                    <option value="calendly" ${bookingProvider === "calendly" ? "selected" : ""}>Calendly</option>
                  </select>
                  <p class="field-help">Calendly mode requires a public HTTPS calendly.com booking link.</p>
                </div>
                <div class="settings-shell-choice-row">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">${escapeHtml(bookingProviderStatus.label)}</p>
                    <p class="settings-shell-key-value-copy">${escapeHtml(bookingProviderStatus.copy)}</p>
                  </div>
                  <span class="${helpers.getBadgeClass(bookingProviderStatus.tone)}">${escapeHtml(bookingProvider === "calendly" ? "Calendly" : "Manual")}</span>
                </div>
                ${calendlyWebhookStatus ? `
                  <div class="settings-shell-choice-row">
                    <div class="settings-shell-choice-main">
                      <p class="settings-shell-choice-title">${escapeHtml(calendlyWebhookStatus.label)}</p>
                      <p class="settings-shell-key-value-copy">${escapeHtml(calendlyWebhookStatus.copy)}</p>
                    </div>
                    <span class="${helpers.getBadgeClass(calendlyWebhookStatus.tone)}">${escapeHtml(calendlyWebhookStatus.tone)}</span>
                  </div>
                ` : ""}
                <div class="field">
                  <label for="assistant-booking-url">Booking URL</label>
                  <input id="assistant-booking-url" name="booking_url" type="text" value="${escapeHtml(agent.bookingUrl || "")}" placeholder="${bookingProvider === "calendly" ? "https://calendly.com/example/consultation" : "https://example.com/book"}">
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
                    <p class="field-help">Turn this on only when the owner needs a real fallback.</p>
                  </div>
                ` : ""}
              </div>
            </section>

            <section class="settings-shell-section" data-frontdesk-settings-panel="appearance" ${frontDeskPanelAttrs("appearance")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Optional website bubble</h3>
                  <p class="settings-shell-section-copy">Configure the compact website chat bubble. This does not control the primary Front Desk page.</p>
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
                      <p class="field-help">Use a small square PNG, JPG, WebP, or GIF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            ${advancedGuidanceVisible ? `
              <section class="settings-shell-section">
                <div class="settings-shell-section-header">
                  <div>
                    <h3 class="settings-shell-section-title">Advanced guidance</h3>
                    <p class="settings-shell-section-copy">Optional guidance for emphasis, tone, and edge cases.</p>
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
          </div>

          <aside class="settings-frontdesk-preview" aria-label="Front Desk live readout" data-frontdesk-settings-preview ${["identity", "appearance"].includes(activeFrontDeskTab) ? "" : "hidden"}>
            <section class="settings-shell-section">
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Current live readout</h3>
                  <p class="settings-shell-section-copy">Review how the customer-facing assistant will appear.</p>
                </div>
              </div>
              <div class="settings-shell-live-summary">
                <h3 id="studio-summary-name" class="studio-summary-name">${escapeHtml(agent.assistantName || agent.name || "")}</h3>
                <p id="studio-summary-copy" class="studio-summary-copy">${escapeHtml(agent.welcomeMessage || "Your front desk is ready to greet visitors with a clear, helpful first message.")}</p>
                <div class="settings-shell-logo-summary">
                  <span class="settings-shell-logo-summary-label">Widget logo</span>
                  <span class="settings-shell-logo-preview settings-shell-logo-preview--small" aria-hidden="true" style="--settings-card-logo-bg:${escapeHtml(primaryColor)}">
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
                      <p class="settings-shell-key-value-label">Front Desk purpose</p>
                      <h4 class="settings-shell-key-value-title">${escapeHtml(selectedPurposeOption.label)}</h4>
                      <p class="settings-shell-key-value-copy">${escapeHtml(selectedPurposeOption.description)}</p>
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
          </aside>
        </div>

        <div class="settings-shell-sticky-save">
          <span data-save-state class="save-state">No changes yet.</span>
          <button class="primary-button" type="submit">Save Front Desk</button>
        </div>
      </form>
    `;
  }

  function _buildWorkspaceSettingsPanel(agent, setup, operatorWorkspace, helpers) {
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
                <p class="settings-shell-status-copy">Loaded from the current workspace record.</p>
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

  function _formatAiCreditAmount(cents) {
    const amount = Math.round(Number(cents || 0) / 100);
    return Number.isFinite(amount) ? amount.toLocaleString("en-US") : "0";
  }

  function _buildAssistantBrandingCard(agent, helpers) {
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

  function buildGeneralStatusCard(agent, setup, operatorWorkspace, authUser, helpers) {
    const { escapeHtml, getDefaultInstallStatus, getWorkspaceMode, normalizeAccessStatus } = helpers;
    const owner = getOwnerAccount(agent, authUser);
    const accessStatus = normalizeAccessStatus(agent.accessStatus);
    const workspaceMode = getWorkspaceMode(operatorWorkspace);
    const installStatus = getDefaultInstallStatus(agent);
    const fullPageConfig = normalizeFullPageConfig(agent);

    return `
      <article class="settings-overview-card">
        <div class="settings-card-heading settings-card-heading--split">
          <div>
            <h2 class="settings-card-title">Workspace status</h2>
            <p class="settings-card-copy">Operational readiness from the existing auth, activation, install, and Front Desk setup state.</p>
          </div>
          <span class="${accessStatus === "active" ? "badge success" : "badge pending"}">${escapeHtml(accessStatus)}</span>
        </div>
        <div class="settings-status-list">
          <div class="settings-status-row">
            <strong>Owner account</strong>
            <span>${escapeHtml(owner.email || owner.name || "Owner account unavailable")}</span>
          </div>
          <div class="settings-status-row">
            <strong>Workspace mode</strong>
            <span>${escapeHtml(workspaceMode.title)}</span>
          </div>
          <div class="settings-status-row">
            <strong>Hosted Front Desk page</strong>
            <span>${escapeHtml(fullPageConfig.publicPageEnabled ? "Live for links, QR, and embeds" : "Enable before launch")}</span>
          </div>
          <div class="settings-status-row">
            <strong>Launch readiness</strong>
            <span>${escapeHtml(setup.isReady ? "Core setup ready" : setup.knowledgeLimited ? "Knowledge limited" : "Needs setup")}</span>
          </div>
          <div class="settings-status-row">
            <strong>Optional widget</strong>
            <span>${escapeHtml(installStatus.label || "Not installed yet")}</span>
          </div>
        </div>
      </article>
    `;
  }

  function buildGeneralSettingsSection(agent, setup, operatorWorkspace, authUser, helpers) {
    return `
      <section id="settings-section-general" data-settings-section="general" class="settings-general-section">
        ${buildWorkspacePreferencesCard(helpers)}
        ${buildGeneralStatusCard(agent, setup, operatorWorkspace, authUser, helpers)}
      </section>
    `;
  }

  function _buildBusinessProfileCard(agent, operatorWorkspace, helpers) {
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

  function _buildTeamAccessCard(agent, authUser, helpers) {
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

  function _buildNotificationsCard(actionQueue, helpers) {
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

  function _buildBillingCard(operatorWorkspace, helpers) {
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
      ? `${_formatAiCreditAmount(usage.usedCents)} / ${_formatAiCreditAmount(usage.includedCents)} AI credits`
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
      <article class="settings-overview-card">
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

  function buildAccountBillingSettingsSection(agent, operatorWorkspace, authUser, helpers) {
    const { escapeHtml, getBadgeClass, normalizeAccessStatus } = helpers;
    const owner = getOwnerAccount(agent, authUser);
    const accessStatus = normalizeAccessStatus(agent.accessStatus);
    const billing = operatorWorkspace?.billing || defaultBillingSnapshot();
    const usage = billing.usage || defaultBillingSnapshot().usage;
    const hasBillingPlanData = billing.hasActiveSubscription === true
      || Boolean(defaultTrimText(billing.displayName || billing.monthlyPriceLabel || billing.planKey));
    const upgradeOptions = Array.isArray(billing.upgradeOptions) ? billing.upgradeOptions : [];
    const planLabel = hasBillingPlanData
      ? [billing.displayName, billing.monthlyPriceLabel].map(defaultTrimText).filter(Boolean).join(" · ") || "Current plan"
      : "Plan details not available yet";
    const usagePercentLabel = formatBillingPercent(usage.percentUsed);
    const billingPeriodLabel = billing.currentPeriodStart && billing.currentPeriodEnd
      ? `${formatBillingDate(billing.currentPeriodStart)} - ${formatBillingDate(billing.currentPeriodEnd)}`
      : "Billing period not available yet";
    const billingNoticeTone = defaultTrimText(usage.tone).toLowerCase() || "ok";

    return `
      <section id="settings-section-account_billing" data-settings-section="account_billing" class="settings-account-billing-section">
        <div class="settings-shell-form">
          <header class="settings-shell-page-header">
            <div class="settings-shell-page-title-group">
              <p class="studio-kicker">Account & Billing</p>
              <h2 class="settings-shell-page-title">Account & Billing</h2>
              <p class="settings-shell-page-copy">Review the owner account, access status, Stripe-backed plan state, and monthly AI capacity that affect live Front Desk operations.</p>
            </div>
          </header>

          <section class="settings-operational-summary settings-operational-summary--billing" aria-label="Account and billing summary">
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Owner access</span>
                <span class="${accessStatus === "active" ? "badge success" : "badge pending"}">${escapeHtml(accessStatus)}</span>
              </div>
              <p>${escapeHtml(owner.email || owner.name || "Owner account unavailable")}</p>
            </article>
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Subscription</span>
                <span class="${billing.hasActiveSubscription ? "badge success" : "badge pending"}">${escapeHtml(billing.subscriptionStatus || "pending")}</span>
              </div>
              <p>${escapeHtml(planLabel)}</p>
            </article>
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Monthly capacity</span>
                <span class="${getBadgeClass(defaultTrimText(usage.tone).toLowerCase() === "danger" ? "Needs attention" : defaultTrimText(usage.tone).toLowerCase() === "warning" ? "Limited" : "Ready")}">${escapeHtml(`${usagePercentLabel} used`)}</span>
              </div>
              <p>${escapeHtml(usage.statusLabel || usage.ownerMessage || "Monthly capacity status appears after billing sync.")}</p>
            </article>
          </section>

          <section class="settings-shell-section">
            <div class="settings-shell-section-header">
              <div>
                <h3 class="settings-shell-section-title">Account</h3>
                <p class="settings-shell-section-copy">Workspace identity follows the signed-in owner and activation flow.</p>
              </div>
            </div>
            <div class="settings-shell-status-list">
              <div class="settings-shell-status-row">
                <div class="settings-shell-status-main">
                  <p class="settings-shell-status-label">Owner account</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(owner.email || owner.name || "Owner account unavailable")}</h4>
                  <p class="settings-shell-status-copy">Account access is managed by the existing authentication flow.</p>
                </div>
              </div>
              <div class="settings-shell-status-row">
                <div class="settings-shell-status-main">
                  <p class="settings-shell-status-label">Access</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(accessStatus)}</h4>
                  <p class="settings-shell-status-copy">Access status is loaded from the current workspace record.</p>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-shell-section">
            <div class="settings-shell-section-header">
              <div>
                <h3 class="settings-shell-section-title">Billing and usage</h3>
                <p class="settings-shell-section-copy">Only Stripe-backed plan state and recorded monthly AI capacity are shown here.</p>
              </div>
            </div>
            <div class="settings-shell-status-list">
              <div class="settings-shell-status-row">
                <div class="settings-shell-status-main">
                  <p class="settings-shell-status-label">Current plan</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(planLabel)}</h4>
                  <p class="settings-shell-status-copy">${escapeHtml(billing.hasActiveSubscription
                    ? "Hosted monthly subscription is active for this workspace."
                    : "Plan details appear after checkout or subscription sync.")}</p>
                </div>
              </div>
              <div class="settings-shell-status-row">
                <div class="settings-shell-status-main">
                  <p class="settings-shell-status-label">Current billing period</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(billingPeriodLabel)}</h4>
                  <p class="settings-shell-status-copy">${escapeHtml(defaultTrimText(billing.subscriptionStatus)
                    ? `Subscription status: ${billing.subscriptionStatus}.`
                    : "Subscription status appears after checkout.")}</p>
                </div>
              </div>
              <div class="settings-shell-status-row">
                <div class="settings-shell-status-main">
                  <p class="settings-shell-status-label">Monthly usage progress</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(`${usagePercentLabel} used`)}</h4>
                  <p class="settings-shell-status-copy">${escapeHtml(usage.statusLabel || "Monthly capacity status appears after billing sync.")}</p>
                  <div class="settings-shell-billing-progress" aria-label="Monthly usage progress">
                    <div class="settings-shell-billing-progress-bar settings-shell-billing-progress-bar--${escapeHtml(billingNoticeTone)}">
                      <span style="width:${escapeHtml(usagePercentLabel)}"></span>
                    </div>
                    <div class="settings-shell-billing-progress-meta">
                      <span>${escapeHtml(usagePercentLabel)} of this month's included capacity</span>
                      <span>${escapeHtml(usage.isCapped ? "Visitor replies are in safe fallback mode." : "Customer-facing usage is available when capacity exists.")}</span>
                    </div>
                  </div>
                  <div class="settings-shell-billing-notice settings-shell-billing-notice--${escapeHtml(billingNoticeTone)}">
                    ${escapeHtml(usage.ownerMessage || "Monthly AI usage status will appear here.")}
                  </div>
                </div>
              </div>
            </div>
            ${upgradeOptions.length ? `
              <div class="settings-shell-billing-upgrade-stack">
                <div>
                  <h4 class="settings-shell-section-title settings-shell-section-title--compact">Plan options</h4>
                  <p class="settings-shell-section-copy">Available plan changes use the existing Stripe-backed billing flow.</p>
                </div>
                <div class="settings-shell-billing-upgrade-grid">
                  ${upgradeOptions.map((plan) => `
                    <button type="button" class="settings-shell-billing-plan-card" data-billing-plan-key="${escapeHtml(plan.planKey)}">
                      <strong>${escapeHtml(plan.displayName)}</strong>
                      <span>${escapeHtml(plan.monthlyPriceLabel || "")}</span>
                      <small>${escapeHtml(plan.checkoutLabel || `Move to ${plan.displayName}`)}</small>
                    </button>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </section>
        </div>
      </section>
    `;
  }

  function buildPrivacyLegalSettingsSection(helpers) {
    return `
      <section id="settings-section-privacy_legal" data-settings-section="privacy_legal" class="settings-privacy-legal-section">
        <div class="settings-shell-form">
          <header class="settings-shell-page-header">
            <div class="settings-shell-page-title-group">
              <p class="studio-kicker">Privacy & Legal</p>
              <h2 class="settings-shell-page-title">Privacy & Legal</h2>
              <p class="settings-shell-page-copy">Open the public legal and privacy pages used by the website, app, hosted Front Desk page, optional widget, and checkout.</p>
            </div>
          </header>
          <section class="settings-operational-summary settings-operational-summary--privacy" aria-label="Privacy and legal summary">
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Public legal pages</span>
                <span class="badge success">${LEGAL_LINKS.length} links</span>
              </div>
              <p>These links are presented as operational references for owner review and public trust checks.</p>
            </article>
          </section>
          ${buildPrivacyCard(helpers)}
        </div>
      </section>
    `;
  }

  function _buildIntegrationsCard(agent, setup, operatorWorkspace, helpers) {
    const { escapeHtml, getDefaultInstallStatus, getGoogleWorkspaceCapabilities, getWorkspaceMode } = helpers;
    const installStatus = getDefaultInstallStatus(agent);
    const google = getGoogleWorkspaceCapabilities(operatorWorkspace);
    const workspaceMode = getWorkspaceMode(operatorWorkspace);
    const importState = getKnowledgeImportSettingsState(setup);
    const knowledgeDescription = setup.knowledgeDescription || "";
    const knowledgeSummary = setup.importStatus
      ? importState.summary
      : knowledgeDescription && !(setup.knowledgeState === "ready" && /not (available|imported)|missing/i.test(knowledgeDescription))
      ? knowledgeDescription
      : setup.knowledgeState === "ready"
        ? "Website knowledge is ready for the assistant."
        : setup.knowledgeState === "limited"
          ? "Website import needs review before the assistant can rely on it fully."
          : "Website knowledge status appears after import.";
    const capabilities = [
      { label: "Workspace mode", value: workspaceMode.title },
      { label: "Website knowledge", value: importState.value },
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
          <button class="ghost-button" type="button" data-action="import-knowledge" ${importState.retryable ? 'data-import-force="true"' : ""}>${escapeHtml(importState.retryable ? "Retry website import" : setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge")}</button>
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

  function buildActiveSettingsSection(sectionKey, options, helpers) {
    const agent = options.agent || {};
    const setup = options.setup || {};
    const operatorWorkspace = options.operatorWorkspace || helpers.createEmptyOperatorWorkspace();
    const authUser = options.authUser || null;
    const activeSettingsSection = normalizeSettingsSection(sectionKey);

    switch (activeSettingsSection) {
      case "front_desk":
        return buildFrontDeskSettingsForm(agent, setup, helpers);
      case "business_profile":
        return buildBusinessContextSetupPanel(agent, setup, operatorWorkspace, helpers);
      case "account_billing":
        return buildAccountBillingSettingsSection(agent, operatorWorkspace, authUser, helpers);
      case "privacy_legal":
        return buildPrivacyLegalSettingsSection(helpers);
      case "general":
      default:
        return buildGeneralSettingsSection(agent, setup, operatorWorkspace, authUser, helpers);
    }
  }

  function buildSettingsOverviewPanel(options, helpers) {
    const activeSettingsSection = getActiveSettingsSection();

    return `
      <div class="settings-shell-overview" data-active-settings-section="${helpers.escapeHtml(activeSettingsSection)}">
        ${buildDesktopSettingsNav(activeSettingsSection, helpers)}
        ${buildMobileSettingsNav(activeSettingsSection, helpers)}
        <div class="settings-active-content" data-settings-active-content>
          ${buildActiveSettingsSection(activeSettingsSection, options, helpers)}
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
    const onRequestRerender = typeof options.onRequestRerender === "function" ? options.onRequestRerender : null;

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
    const frontDeskTabButtons = Array.from(root.querySelectorAll("[data-frontdesk-settings-tab]"));
    const frontDeskPanels = Array.from(root.querySelectorAll("[data-frontdesk-settings-panel]"));
    const frontDeskPreview = root.querySelector?.("[data-frontdesk-settings-preview]") || null;
    const fullPageTabButtons = Array.from(root.querySelectorAll("[data-full-page-settings-tab]"));
    const fullPagePanels = Array.from(root.querySelectorAll("[data-full-page-settings-panel]"));
    const fullPageBackgroundType = root.querySelector?.("[data-full-page-background-type]") || null;
    const fullPageBackgroundControls = Array.from(root.querySelectorAll("[data-full-page-background-control]"));
    const fullPagePresetSelect = root.querySelector?.("[data-full-page-design-preset]") || null;
    const fullPageBackgroundSourceInput = root.querySelector?.("[data-full-page-background-source]") || null;
    const fullPageBackgroundPresetInput = root.querySelector?.("[data-full-page-background-preset]") || null;
    const fullPageBackgroundPresetButtons = Array.from(root.querySelectorAll("[data-full-page-background-preset-option]"));
    const fullPageBackgroundUploads = Array.from(root.querySelectorAll("[data-full-page-background-upload]"));
    const fullPagePreview = root.querySelector?.("[data-full-page-design-preview]") || null;
    const settingsOverview = root.querySelector?.(".settings-shell-overview") || null;
    const mobileNote = typeof root.querySelector === "function"
      ? root.querySelector("[data-settings-mobile-note]")
      : null;

    const showSettingsSection = (targetSection = getActiveSettingsSection(), showOptions = {}) => {
      const normalizedSection = normalizeSettingsSection(targetSection);
      const renderedSection = normalizeSettingsSection(settingsOverview?.dataset?.activeSettingsSection || getActiveSettingsSection());
      const helpers = getHelpers(options);

      setActiveSettingsSection(normalizedSection);
      helpers.setDashboardUiStateValue("settingsMainTab", getSettingsHashSegment(normalizedSection));
      if (showOptions.syncHash !== false) {
        syncSettingsSectionHash(normalizedSection, {
          helpers,
          frontDeskTab: getActiveFrontDeskSettingsTab(helpers),
        });
      }

      settingsTargets.forEach((target) => {
        if (target.tagName === "SELECT") {
          target.value = normalizedSection;
          return;
        }

        const isActive = target.dataset.settingsTarget === normalizedSection;
        target.classList.toggle("active", isActive);
        target.setAttribute("aria-current", isActive ? "page" : "false");
      });

      if (renderedSection !== normalizedSection && onRequestRerender && showOptions.rerender !== false) {
        onRequestRerender();
      } else if (!settingsOverview) {
        settingsSections.forEach((section) => {
          section.hidden = normalizeSettingsSection(section.dataset.settingsSection) !== normalizedSection;
        });
      }

      if (mobileNote) {
        mobileNote.textContent = helpers.translateDashboardText(getSectionByKey(normalizedSection).note);
      }

      if (normalizedSection === "front_desk" && typeof showFrontDeskSettingsPanel === "function") {
        showFrontDeskSettingsPanel(getActiveFrontDeskSettingsTab(helpers), { syncHash: false });
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
          settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        });
        return;
      }

      target.addEventListener("click", () => {
        showSettingsSection(normalizeSettingsSection(target.dataset.settingsTarget || SETTINGS_SECTIONS[0]));
        const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
        settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    });

    const showFrontDeskSettingsPanel = (targetPanel = getActiveFrontDeskSettingsTab(getHelpers(options)), panelOptions = {}) => {
      const helpers = getHelpers(options);
      const normalizedPanel = setActiveFrontDeskSettingsTab(targetPanel, helpers);

      if (panelOptions.syncHash !== false) {
        syncSettingsSectionHash("front_desk", {
          helpers,
          frontDeskTab: normalizedPanel,
        });
      }

      frontDeskTabButtons.forEach((button) => {
        const active = button.dataset.frontdeskSettingsTab === normalizedPanel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });

      frontDeskPanels.forEach((panel) => {
        panel.hidden = panel.dataset.frontdeskSettingsPanel !== normalizedPanel;
      });

      if (frontDeskPreview) {
        frontDeskPreview.hidden = !["identity", "appearance"].includes(normalizedPanel);
      }
    };

    const showFullPageSettingsPanel = (targetPanel = getActiveFullPageSettingsTab(getHelpers(options))) => {
      const normalizedPanel = setActiveFullPageSettingsTab(targetPanel, getHelpers(options));

      fullPageTabButtons.forEach((button) => {
        const active = button.dataset.fullPageSettingsTab === normalizedPanel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });

      fullPagePanels.forEach((panel) => {
        panel.hidden = panel.dataset.fullPageSettingsPanel !== normalizedPanel;
      });
    };

    const syncFullPageBackgroundControls = () => {
      const activeType = normalizeDesignEnum(
        fullPageBackgroundType?.value,
        FULL_PAGE_BACKGROUND_TYPES,
        DEFAULT_FULL_PAGE_DESIGN.backgroundType
      );

      fullPageBackgroundControls.forEach((control) => {
        const allowedTypes = defaultTrimText(control.dataset.fullPageBackgroundControl).split(/\s+/).filter(Boolean);
        control.hidden = allowedTypes.length > 0 && !allowedTypes.includes(activeType);
      });
    };

    const setInputValue = (name, value) => {
      const input = root.querySelector?.(`[name="${name}"]`);

      if (!input) {
        return;
      }

      if (input.type === "checkbox") {
        input.checked = value === true;
        return;
      }

      input.value = String(value ?? "");
    };

    const setFullPageBackgroundPresetSelection = (presetKey = "") => {
      if (fullPageBackgroundPresetInput) {
        fullPageBackgroundPresetInput.value = presetKey;
      }

      fullPageBackgroundPresetButtons.forEach((button) => {
        const selected = button.dataset.fullPageBackgroundPresetOption === presetKey;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    };

    const applyFullPageBackgroundPreset = (presetKey) => {
      const preset = FULL_PAGE_BACKGROUND_PRESETS[presetKey];
      if (!preset) {
        return;
      }

      setInputValue("full_page_background_type", preset.backgroundType);
      setInputValue("full_page_background_color", preset.backgroundColor);
      setInputValue("full_page_background_image_url", preset.imageUrl);
      setInputValue("full_page_background_video_url", preset.videoUrl || "");
      setInputValue("full_page_background_overlay_color", preset.backgroundOverlayColor);
      setInputValue("full_page_background_overlay_opacity", preset.backgroundOverlayOpacity);
      setInputValue("full_page_text_theme", preset.textTheme);
      setInputValue("full_page_disable_video_on_mobile", preset.disableVideoOnMobile);
      if (fullPageBackgroundSourceInput) {
        fullPageBackgroundSourceInput.value = "preset";
      }
      setFullPageBackgroundPresetSelection(preset.key);
      syncFullPageBackgroundControls();
      root.querySelectorAll?.("[data-full-page-range-output]").forEach(syncRangeOutput);
      syncFullPagePreview();
    };

    const applyFullPagePreset = () => {
      if (!fullPagePresetSelect) {
        return;
      }

      const preset = getFullPageDesignPresetDefaults(fullPagePresetSelect.value);
      setInputValue("full_page_background_type", preset.backgroundType);
      setInputValue("full_page_background_color", preset.backgroundColor);
      setInputValue("full_page_background_gradient_to", preset.backgroundGradientTo);
      setInputValue("full_page_background_overlay_color", preset.backgroundOverlayColor);
      setInputValue("full_page_background_overlay_opacity", preset.backgroundOverlayOpacity);
      setInputValue("full_page_background_blur", preset.backgroundBlur);
      setInputValue("full_page_background_focal_point", preset.backgroundFocalPoint);
      setInputValue("full_page_text_theme", preset.textTheme);
      setInputValue("full_page_composer_style", preset.composerStyle);
      setInputValue("full_page_chip_style", preset.chipStyle);
      setInputValue("full_page_status_style", preset.statusStyle);
      setInputValue("full_page_disable_video_on_mobile", preset.disableVideoOnMobile);
      if (fullPageBackgroundSourceInput) {
        fullPageBackgroundSourceInput.value = "url";
      }
      setFullPageBackgroundPresetSelection("");
      syncFullPageBackgroundControls();
      root.querySelectorAll?.("[data-full-page-range-output]").forEach(syncRangeOutput);
      syncFullPagePreview();
    };

    const getInputValue = (name, fallbackValue = "") => {
      const input = root.querySelector?.(`[name="${name}"]`);
      return input ? input.value : fallbackValue;
    };

    const getInputChecked = (name, fallbackValue = false) => {
      const input = root.querySelector?.(`[name="${name}"]`);
      return input ? input.checked === true : fallbackValue;
    };

    const syncRangeOutput = (input) => {
      const targetId = input?.dataset?.fullPageRangeOutput;
      const target = targetId ? root.getElementById?.(targetId) : null;

      if (!target) {
        return;
      }

      target.textContent = targetId.includes("opacity")
        ? `${Math.round(Number(input.value || 0) * 100)}%`
        : `${Math.round(Number(input.value || 0))}px`;
    };

    function syncFullPagePreview() {
      if (!fullPagePreview) {
        return;
      }

      const headline = limitText(getInputValue("full_page_headline"), 80) || "Front Desk";
      const subtitle = limitText(getInputValue("full_page_subtitle"), 180) || "Ask about services, pricing, quotes, or contact details.";
      const backgroundType = normalizeDesignEnum(getInputValue("full_page_background_type"), FULL_PAGE_BACKGROUND_TYPES, DEFAULT_FULL_PAGE_DESIGN.backgroundType);
      const textTheme = normalizeDesignEnum(getInputValue("full_page_text_theme"), ["dark", "light"], DEFAULT_FULL_PAGE_DESIGN.textTheme);
      const chipStyle = normalizeDesignEnum(getInputValue("full_page_chip_style"), ["outline", "soft", "subtle-fill"], DEFAULT_FULL_PAGE_DESIGN.chipStyle);
      const composerStyle = normalizeDesignEnum(getInputValue("full_page_composer_style"), ["soft", "elevated", "minimal"], DEFAULT_FULL_PAGE_DESIGN.composerStyle);
      const statusStyle = normalizeDesignEnum(getInputValue("full_page_status_style"), ["subtle", "pill", "minimal"], DEFAULT_FULL_PAGE_DESIGN.statusStyle);
      const imageUrl = defaultTrimText(getInputValue("full_page_background_image_url"));
      const videoUrl = defaultTrimText(getInputValue("full_page_background_video_url"));
      const accentColor = normalizeFullPageColor(getInputValue("full_page_accent_color"), "#14b8a6");
      const title = fullPagePreview.querySelector?.(".settings-full-page-preview-header strong");
      const copy = fullPagePreview.querySelector?.(".settings-full-page-preview-subtitle");
      const actionWrap = fullPagePreview.querySelector?.(".settings-full-page-preview-actions");
      const trustWrap = fullPagePreview.querySelector?.(".settings-full-page-preview-trust");
      const video = fullPagePreview.querySelector?.("[data-full-page-preview-video]");

      fullPagePreview.dataset.backgroundType = backgroundType;
      fullPagePreview.dataset.textTheme = textTheme;
      fullPagePreview.dataset.chipStyle = chipStyle;
      fullPagePreview.dataset.composerStyle = composerStyle;
      fullPagePreview.dataset.statusStyle = statusStyle;
      fullPagePreview.style.setProperty("--full-page-preview-accent", accentColor);
      fullPagePreview.style.setProperty("--full-page-preview-bg", normalizeFullPageColor(getInputValue("full_page_background_color"), "#ffffff"));
      fullPagePreview.style.setProperty("--full-page-preview-gradient", normalizeFullPageColor(getInputValue("full_page_background_gradient_to"), "#eef4ff"));
      fullPagePreview.style.setProperty("--full-page-preview-overlay", normalizeFullPageColor(getInputValue("full_page_background_overlay_color"), "#ffffff"));
      fullPagePreview.style.setProperty("--full-page-preview-overlay-opacity", String(normalizeOverlayOpacity(getInputValue("full_page_background_overlay_opacity"), 0.72)));
      fullPagePreview.style.setProperty("--full-page-preview-image", imageUrl ? `url("${imageUrl.replace(/"/g, "%22")}")` : "none");
      fullPagePreview.style.setProperty("--full-page-preview-blur", `${normalizeBackgroundBlur(getInputValue("full_page_background_blur"), 0)}px`);
      fullPagePreview.style.setProperty("--full-page-preview-position", normalizeDesignEnum(getInputValue("full_page_background_focal_point"), ["center", "top", "left", "right"], "center"));

      if (video) {
        if (backgroundType === "video" && videoUrl) {
          if (video.getAttribute("src") !== videoUrl) {
            video.setAttribute("src", videoUrl);
          }
          if (imageUrl) {
            video.setAttribute("poster", imageUrl);
          } else {
            video.removeAttribute("poster");
          }
          video.hidden = false;
          video.play?.().catch?.(() => {});
        } else {
          video.hidden = true;
          video.removeAttribute("src");
          video.removeAttribute("poster");
        }
      }

      if (title) title.textContent = headline;
      if (copy) copy.textContent = subtitle;

      if (actionWrap) {
        const actionLabels = Array.from(root.querySelectorAll('[name^="full_page_action_"][name$="_label"]'))
          .map((input) => limitText(input.value, 40))
          .filter(Boolean)
          .slice(0, 4);
        actionWrap.innerHTML = actionLabels.map((label) => `<span>${defaultEscapeHtml(label)}</span>`).join("");
      }

      if (trustWrap) {
        const trustItems = defaultTrimText(getInputValue("full_page_trust_items"))
          .split(/\n|,/)
          .map((item) => limitText(item, 60))
          .filter(Boolean)
          .slice(0, 3);
        trustWrap.innerHTML = (trustItems.length ? trustItems : DEFAULT_FULL_PAGE_TRUST_ITEMS)
          .map((item) => `<span>${defaultEscapeHtml(item)}</span>`)
          .join("");
      }

      getInputChecked("full_page_disable_video_on_mobile");
    }

    frontDeskTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        showFrontDeskSettingsPanel(button.dataset.frontdeskSettingsTab || "identity");
      });
    });

    fullPageTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        showFullPageSettingsPanel(button.dataset.fullPageSettingsTab || "content");
      });
    });

    fullPageBackgroundType?.addEventListener("change", () => {
      const selectedPreset = FULL_PAGE_BACKGROUND_PRESETS[fullPageBackgroundPresetInput?.value || ""];
      if (!selectedPreset || selectedPreset.backgroundType !== fullPageBackgroundType.value) {
        setFullPageBackgroundPresetSelection("");
      }
      if (["color", "gradient"].includes(fullPageBackgroundType.value) && fullPageBackgroundSourceInput) {
        fullPageBackgroundSourceInput.value = "url";
      }
      syncFullPageBackgroundControls();
      syncFullPagePreview();
    });

    fullPagePresetSelect?.addEventListener("change", applyFullPagePreset);

    fullPageBackgroundPresetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyFullPageBackgroundPreset(button.dataset.fullPageBackgroundPresetOption || "");
      });
    });

    fullPageBackgroundUploads.forEach((input) => {
      input.addEventListener("change", () => {
        const kind = input.dataset.fullPageBackgroundUpload;
        const file = input.files?.[0] || null;
        if (!file || !["image", "video"].includes(kind)) {
          return;
        }

        setInputValue("full_page_background_type", kind);
        if (fullPageBackgroundSourceInput) {
          fullPageBackgroundSourceInput.value = "upload";
        }
        setFullPageBackgroundPresetSelection("");

        const objectUrl = URL.createObjectURL(file);
        if (kind === "image") {
          setInputValue("full_page_background_image_url", objectUrl);
        } else {
          setInputValue("full_page_background_video_url", objectUrl);
        }
        syncFullPageBackgroundControls();
        syncFullPagePreview();
      });
    });

    ["full_page_background_image_url", "full_page_background_video_url"].forEach((name) => {
      const input = root.querySelector?.(`[name="${name}"]`);
      input?.addEventListener("input", () => {
        if (fullPageBackgroundSourceInput) {
          fullPageBackgroundSourceInput.value = "url";
        }
        setFullPageBackgroundPresetSelection("");
      });
    });

    root.querySelectorAll?.("[data-full-page-range-output]").forEach((input) => {
      input.addEventListener("input", () => {
        syncRangeOutput(input);
        syncFullPagePreview();
      });
      syncRangeOutput(input);
    });

    root.querySelectorAll?.("[name^=\"full_page_\"]").forEach((input) => {
      if (input === fullPagePresetSelect || input === fullPageBackgroundType || input.dataset?.fullPageRangeOutput) {
        return;
      }

      input.addEventListener("input", syncFullPagePreview);
      input.addEventListener("change", syncFullPagePreview);
    });

    showSettingsSection(getActiveSettingsSection(), { rerender: false, syncHash: false });
    showFrontDeskSettingsPanel(getActiveFrontDeskSettingsTab(getHelpers(options)), { syncHash: false });
    showFullPageSettingsPanel(getActiveFullPageSettingsTab(getHelpers(options)));
    syncFullPageBackgroundControls();
    syncFullPagePreview();

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
