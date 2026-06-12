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
      note: "Full-page Front Desk identity, page setup, and routing.",
    },
    {
      key: "website_widget",
      label: "Website Widget",
      note: "Website Widget launcher, appearance, install, and domains.",
    },
    {
      key: "voice_agent",
      label: "Voice Agent",
      note: "Browser voice, spoken replies, and Web Call readiness.",
    },
    {
      key: "business_profile",
      label: "Business Profile",
      note: "Grounding facts and readiness for customer answers.",
    },
    {
      key: "connected_apps",
      label: "Connected Apps",
      note: "Manual/internal connected app status and report-only readiness.",
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
  const WIDGET_ONLY_SETTINGS_SECTION_DETAILS = Object.freeze(SETTINGS_SECTION_DETAILS.filter((section) => section.key === "website_widget"));
  const WIDGET_ONLY_SETTINGS_SECTIONS = Object.freeze(WIDGET_ONLY_SETTINGS_SECTION_DETAILS.map((section) => section.key));
  const FRONT_DESK_SETTINGS_TABS = Object.freeze(["identity", "voice", "full_page", "routing", "appearance"]);
  const FRONT_DESK_SETTINGS_TAB_HASH_SEGMENTS = Object.freeze({
    identity: "identity-welcome",
    voice: "voice",
    full_page: "full-page-assistant",
    routing: "routing",
    appearance: "optional-widget",
  });
  const FULL_PAGE_SETTINGS_TABS = Object.freeze(["content", "design", "layout"]);
  const SETTINGS_SECTION_ALIASES = Object.freeze({
    assistant: "general",
    branding: "general",
    workspace_preferences: "general",
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
    "account-billing": "account_billing",
    privacy: "privacy_legal",
    legal: "privacy_legal",
    privacy_controls: "privacy_legal",
    "privacy-legal": "privacy_legal",
  });

  function isWidgetOnlySettingsMode() {
    return global.VONZA_WIDGET_ONLY_DASHBOARD === true
      || global.document?.documentElement?.dataset?.dashboardWidgetOnly === "true";
  }

  function getVisibleSettingsSectionDetails() {
    return isWidgetOnlySettingsMode() ? WIDGET_ONLY_SETTINGS_SECTION_DETAILS : SETTINGS_SECTION_DETAILS;
  }

  function getVisibleSettingsSections() {
    return isWidgetOnlySettingsMode() ? WIDGET_ONLY_SETTINGS_SECTIONS : SETTINGS_SECTIONS;
  }
  const DEFAULT_TRANSLATIONS = Object.freeze({
    "language.settingsTitle": "Dashboard language",
    "language.settingsCopy": "Choose the language used by the logged-in dashboard.",
    "language.noChanges": "No changes yet.",
    "language.save": "Save language",
    "nav.utilities": "Utilities",
    "settings.title": "Settings",
    "settings.copy": "Manage product settings plus shared business, account, and privacy settings.",
    "settings.preferencesCopy": "Choose the language used by the dashboard.",
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
    webCallEnabled: false,
    autoSendTranscript: false,
    autoPlaySpokenReplies: false,
    voice: "alloy",
    languageBehavior: "auto",
  });
  const VOICE_QA_RECORDING_MIME_TYPES = Object.freeze([
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ]);
  const VOICE_QA_RECORDING_MAX_MS = 30000;

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
      webCallEnabled: normalizeBoolean(
        config.webCallEnabled ?? config.web_call_enabled,
        DEFAULT_VOICE_CONFIG.webCallEnabled
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
      monthlyPriceHuf: 0,
      monthlyPriceLabel: "",
      billingCurrency: "",
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

  function formatConnectedAppTimestamp(value) {
    const timestamp = new Date(value || "").getTime();

    if (!Number.isFinite(timestamp)) {
      return "Not available yet";
    }

    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getDashboardProductPackagingItems() {
    if (typeof global.VonzaDashboardState?.listDashboardProductPackaging === "function") {
      return global.VonzaDashboardState.listDashboardProductPackaging();
    }

    return [
      {
        key: "front_desk",
        name: "Front Desk",
        targetUseCase: "Dedicated full-page AI Front Desk for customers who need answers, routing, and follow-up capture.",
        setupLabel: "Open Front Desk setup",
        setupHref: "/dashboard/front-desk",
        pricingLabel: "Product pricing coming soon",
      },
      {
        key: "website_widget",
        name: "Website Widget",
        targetUseCase: "Five-minute website AI agent for visitors who need quick answers without leaving a page.",
        setupLabel: "Open widget setup",
        setupHref: "/dashboard/widget",
        pricingLabel: "Product pricing coming soon",
      },
      {
        key: "voice_agent",
        name: "Voice Agent",
        targetUseCase: "Browser voice, spoken replies, and Web Call setup for hands-free customer conversations where configured.",
        setupLabel: "Open Web Call setup",
        setupHref: "/dashboard/voice",
        pricingLabel: "Product pricing coming soon",
      },
    ];
  }

  function formatProductAvailabilityStatus(value = "") {
    return defaultTrimText(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getProductAvailabilityByKey(operatorWorkspace = {}) {
    const availabilityItems = Array.isArray(operatorWorkspace.product_availability)
      ? operatorWorkspace.product_availability
      : Array.isArray(operatorWorkspace.productAvailability)
        ? operatorWorkspace.productAvailability
        : [];

    return new Map(availabilityItems
      .filter((item) => defaultTrimText(item?.product_key || item?.productKey))
      .map((item) => [defaultTrimText(item.product_key || item.productKey), item]));
  }

  function getProductEntitlementItems(operatorWorkspace = {}) {
    if (Array.isArray(operatorWorkspace.product_entitlements)) {
      return operatorWorkspace.product_entitlements;
    }

    if (Array.isArray(operatorWorkspace.productEntitlements)) {
      return operatorWorkspace.productEntitlements;
    }

    return null;
  }

  function getProductEntitlementsByKey(operatorWorkspace = {}) {
    const entitlementItems = getProductEntitlementItems(operatorWorkspace) || [];

    return new Map(entitlementItems
      .filter((item) => defaultTrimText(item?.product_key || item?.productKey))
      .map((item) => [defaultTrimText(item.product_key || item.productKey), item]));
  }

  function formatProductAccessFallbackLabel(accessStatus) {
    if (accessStatus === "active") {
      return "Included in current workspace";
    }

    if (accessStatus === "suspended") {
      return "Suspended";
    }

    return "Account access pending";
  }

  function formatProductAvailabilityLabel(availability, accessStatus) {
    if (!availability) {
      return formatProductAccessFallbackLabel(accessStatus);
    }

    const status = defaultTrimText(availability.status).toLowerCase();
    const reasonCode = defaultTrimText(availability.reason_code || availability.reasonCode).toLowerCase();

    if (reasonCode === "account_access_active" || status === "available") {
      return "Included in current workspace";
    }

    if (reasonCode === "account_access_suspended" || accessStatus === "suspended") {
      return "Suspended";
    }

    if (reasonCode === "account_access_pending" || status === "pending_account_access") {
      return "Account access pending";
    }

    return formatProductAvailabilityStatus(availability.status || availability.reason_code || availability.reasonCode);
  }

  const PRODUCT_ENTITLEMENT_LABELS = Object.freeze({
    active: "Included with current workspace",
    trialing: "Included with current workspace",
    grandfathered: "Grandfathered",
    beta: "Beta",
    free: "Free",
  });

  function getProductEntitlementDisplayState(entitlement, productKey, accessStatus) {
    const buildState = ({
      label,
      tone = "pending",
      status = "",
      sourceKey = "missing",
      rowExists = false,
    }) => ({
      label,
      source: rowExists
        ? `Product entitlement: ${formatProductAvailabilityStatus(sourceKey)}`
        : "Product entitlement: Missing entitlement record",
      tone,
      status,
      sourceKey,
      rowExists,
    });

    if (!entitlement) {
      return buildState({
        label: "Missing entitlement record",
        status: "missing",
      });
    }

    const entitlementStatus = defaultTrimText(
      entitlement.entitlement_status || entitlement.entitlementStatus || entitlement.status
    ).toLowerCase();
    const status = defaultTrimText(entitlement.status).toLowerCase();
    const reasonCode = defaultTrimText(entitlement.reason_code || entitlement.reasonCode).toLowerCase();
    const sourceKey = defaultTrimText(
      entitlement.entitlement_source || entitlement.entitlementSource || entitlement.status_source || entitlement.statusSource || "product_entitlements"
    );
    const rowExists = entitlement.entitlement_row_exists !== false && entitlementStatus !== "missing";

    if (!rowExists) {
      return buildState({
        label: "Missing entitlement record",
        tone: "pending",
        status: entitlementStatus || "missing",
        sourceKey,
        rowExists: false,
      });
    }

    if (reasonCode === "account_access_suspended" || accessStatus === "suspended") {
      return buildState({
        label: "Suspended",
        status: entitlementStatus || status || "suspended",
        sourceKey,
        rowExists: true,
      });
    }

    if (reasonCode === "account_access_pending" || status === "pending_account_access") {
      return buildState({
        label: "Account access pending",
        status: entitlementStatus || status || "pending",
        sourceKey,
        rowExists: true,
      });
    }

    const knownLabel = PRODUCT_ENTITLEMENT_LABELS[entitlementStatus];
    const label = knownLabel
      || (status === "available" ? PRODUCT_ENTITLEMENT_LABELS.active : formatProductAvailabilityStatus(entitlementStatus || status || productKey));
    const tone = (knownLabel || status === "available") ? "success" : "pending";

    return buildState({
      label,
      tone,
      status: entitlementStatus || status || "",
      sourceKey,
      rowExists: true,
    });
  }

  function getProductAvailabilityTone(availability, hasWorkspaceAccess) {
    if (!availability) {
      return hasWorkspaceAccess ? "success" : "pending";
    }

    return defaultTrimText(availability.status).toLowerCase() === "available" ? "success" : "pending";
  }

  function buildProductPackagingCards(agent, helpers, operatorWorkspace = {}) {
    const { escapeHtml, normalizeAccessStatus } = helpers;
    const productItems = getDashboardProductPackagingItems();
    const entitlementItems = getProductEntitlementItems(operatorWorkspace);
    const hasEntitlementState = Array.isArray(entitlementItems);
    const entitlementByKey = getProductEntitlementsByKey(operatorWorkspace);
    const availabilityByKey = getProductAvailabilityByKey(operatorWorkspace);
    const accessStatus = typeof normalizeAccessStatus === "function"
      ? normalizeAccessStatus(agent?.accessStatus)
      : defaultTrimText(agent?.accessStatus || "pending");
    const hasWorkspaceAccess = accessStatus === "active";

    return `
      <section class="settings-shell-section settings-product-packaging-section" data-product-packaging-section>
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">Products</h3>
            <p class="settings-shell-section-copy">Product pricing is being separated. Current billing remains account-level plan capacity.</p>
          </div>
        </div>
        <div class="settings-product-packaging-grid">
          ${productItems.map((product) => {
            const availability = availabilityByKey.get(product.key);
            const entitlement = hasEntitlementState ? entitlementByKey.get(product.key) : null;
            const entitlementDisplay = hasEntitlementState
              ? getProductEntitlementDisplayState(entitlement, product.key, accessStatus)
              : null;
            const availabilityLabel = entitlementDisplay
              ? entitlementDisplay.label
              : formatProductAvailabilityLabel(availability, accessStatus);
            const availabilitySource = entitlementDisplay
              ? entitlementDisplay.source
              : availability
                ? `Product availability: ${formatProductAvailabilityStatus(availability.reason_code || availability.reasonCode || availability.status)}`
                : `Account access: ${accessStatus || "pending"}`;
            const availabilityTone = entitlementDisplay
              ? entitlementDisplay.tone
              : getProductAvailabilityTone(availability, hasWorkspaceAccess);

            return `
            <article
              class="settings-product-packaging-card"
              data-product-packaging-card="${escapeHtml(product.key)}"
              data-product-availability-status="${escapeHtml(availability?.status || "")}"
              data-product-availability-enforced="false"
              data-product-entitlement-status="${escapeHtml(entitlementDisplay?.status || "")}"
              data-product-entitlement-source="${escapeHtml(entitlementDisplay?.sourceKey || "")}"
              data-product-entitlement-row-exists="${entitlementDisplay ? String(entitlementDisplay.rowExists) : ""}"
            >
              <div class="settings-product-packaging-head">
                <div>
                  <p class="settings-shell-status-label">Product</p>
                  <h4 class="settings-product-packaging-title">${escapeHtml(product.name || product.label || "Vonza product")}</h4>
                </div>
                <span class="badge ${availabilityTone}" data-product-packaging-status="${escapeHtml(product.key)}">${escapeHtml(availabilityLabel)}</span>
              </div>
              <p class="settings-product-packaging-copy">${escapeHtml(product.targetUseCase || "")}</p>
              <div class="settings-product-packaging-meta">
                <span>Status source</span>
                <strong>${escapeHtml(availabilitySource)}</strong>
              </div>
              <div class="settings-product-packaging-actions">
                <a class="settings-product-packaging-link" href="${escapeHtml(product.setupHref || product.routePath || "/dashboard")}" data-product-packaging-link="${escapeHtml(product.key)}">${escapeHtml(product.setupLabel || "View setup")}</a>
                <span>${escapeHtml(product.pricingLabel || "Product pricing coming soon")}</span>
              </div>
            </article>
          `;
          }).join("")}
        </div>
      </section>
    `;
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
      "optional-widget": "appearance",
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
      const normalizedFromDashboard = dashboardState.normalizeSettingsMainTab(sectionKey);
      return isWidgetOnlySettingsMode() && normalizedFromDashboard !== "website_widget"
        ? "website_widget"
        : normalizedFromDashboard;
    }

    const normalized = defaultTrimText(sectionKey).toLowerCase();
    const normalizedAlias = normalized.replace(/-/g, "_");
    const visibleSections = getVisibleSettingsSections();

    if (visibleSections.includes(normalized)) {
      return normalized;
    }

    if (visibleSections.includes(normalizedAlias)) {
      return normalizedAlias;
    }

    const alias = SETTINGS_SECTION_ALIASES[normalized] || SETTINGS_SECTION_ALIASES[normalizedAlias];
    return visibleSections.includes(alias) ? alias : visibleSections[0];
  }

  function getSettingsSectionFromHash() {
    const pathParts = getHashPathParts();

    if (pathParts[0] !== "settings") {
      return "";
    }

    return pathParts[1] ? normalizeSettingsSection(pathParts[1]) : "";
  }

  function isProductSettingsSection(sectionKey) {
    return ["front_desk", "website_widget", "voice_agent"].includes(normalizeSettingsSection(sectionKey));
  }

  function getDefaultProductSettingsTab(sectionKey) {
    const normalizedSection = normalizeSettingsSection(sectionKey);
    if (normalizedSection === "website_widget") {
      return "appearance";
    }
    if (normalizedSection === "voice_agent") {
      return "voice";
    }
    return "identity";
  }

  function getProductSettingsTabs(sectionKey, activeTab = "") {
    const normalizedSection = normalizeSettingsSection(sectionKey);
    const normalizedActiveTab = normalizeFrontDeskSettingsTab(activeTab);
    const tabMap = {
      front_desk: ["identity", "full_page", "routing"],
      website_widget: ["appearance", "routing", "identity"],
      voice_agent: ["voice"],
    };
    const tabs = (tabMap[normalizedSection] || tabMap.front_desk).slice();

    if (normalizedSection === "front_desk" && activeTab && !tabs.includes(normalizedActiveTab)) {
      tabs.push(normalizedActiveTab);
    }

    return tabs;
  }

  function getProductSettingsCopy(sectionKey, details = {}) {
    const normalizedSection = normalizeSettingsSection(sectionKey);
    const installStatus = details.installStatus || {};
    const fullPageConfig = details.fullPageConfig || {};
    const selectedPurposeOption = details.selectedPurposeOption || {};
    const routingDestinationCount = Number(details.routingDestinationCount || 0);
    const voiceConfig = details.voiceConfig || {};
    const webCallReady = details.webCallReady === true;
    const allowedDomainCount = Array.isArray(details.allowedDomains) ? details.allowedDomains.length : 0;
    const primaryColor = details.primaryColor || "#14b8a6";

    if (normalizedSection === "website_widget") {
      return {
        kicker: "Website Widget",
        title: "Website Widget",
        copy: "Tune the recommended Website Widget launch surface using the existing snippet, launcher, install-status, and allowed-domain settings.",
        ariaLabel: "Website Widget settings summary",
        saveLabel: "Save Website Widget",
        tabs: getProductSettingsTabs(normalizedSection, details.activeTab),
        rows: [
          {
            label: "Embed/install status",
            value: installStatus.label || "Not installed yet",
            tone: installStatus.state === "seen_recently" ? "Ready" : installStatus.state === "installed_unseen" ? "Limited" : "Pending",
            copy: "Uses the existing Website Widget snippet and install verification flow.",
          },
          {
            label: "Allowed domains",
            value: allowedDomainCount ? `${allowedDomainCount} domain${allowedDomainCount === 1 ? "" : "s"}` : "Not limited",
            tone: allowedDomainCount ? "Ready" : "Limited",
            copy: "The current allowed-domains field controls where the Website Widget should run.",
          },
          {
            label: "Launcher behavior",
            value: selectedPurposeOption.label || "Guidance",
            tone: "Ready",
            copy: `Uses the current assistant identity, button text, logo, and accent color ${primaryColor}.`,
          },
        ],
      };
    }

    if (normalizedSection === "voice_agent") {
      return {
        kicker: "Voice Agent",
        title: "Voice Agent",
        copy: "Configure browser voice, spoken replies, and Web Call readiness from the existing Voice Agent settings.",
        ariaLabel: "Voice Agent settings summary",
        saveLabel: "Save Voice Agent",
        tabs: getProductSettingsTabs(normalizedSection, details.activeTab),
        rows: [
          {
            label: "Browser voice/Web Call",
            value: webCallReady ? "Ready" : "Incomplete",
            tone: webCallReady ? "Ready" : "Pending",
            copy: "Web Call readiness still follows the existing access, AI capacity, and rate-limit checks.",
          },
          {
            label: "Voice input",
            value: voiceConfig.voiceInputEnabled ? "Enabled" : "Off",
            tone: voiceConfig.voiceInputEnabled ? "Ready" : "Pending",
            copy: "Controls whether visitors can record a spoken question for transcription.",
          },
          {
            label: "Spoken replies",
            value: voiceConfig.spokenRepliesEnabled ? "Enabled" : "Off",
            tone: voiceConfig.spokenRepliesEnabled ? "Ready" : "Pending",
            copy: "Controls whether visitors can generate and play spoken audio replies.",
          },
        ],
      };
    }

    return {
      kicker: "Front Desk",
      title: "Front Desk",
      copy: "Configure the companion full-page Front Desk experience for QR, direct links, dedicated assistant pages, and embedded expansion.",
      ariaLabel: "Front Desk launch settings summary",
      saveLabel: "Save Front Desk",
      tabs: getProductSettingsTabs(normalizedSection, details.activeTab),
      rows: [
        {
          label: "Hosted Front Desk page",
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
          label: "Front Desk purpose",
          value: selectedPurposeOption.label || "Guidance",
          tone: "Ready",
          copy: selectedPurposeOption.description || "Defines how the companion full-page assistant frames its help.",
        },
      ],
    };
  }

  function getFrontDeskSettingsTabFromHash() {
    const pathParts = getHashPathParts();

    if (
      ["front-desk", "frontdesk", "customize"].includes(pathParts[0])
      && ["customization", "settings", "customize"].includes(pathParts[1])
      && pathParts[2]
    ) {
      return normalizeFrontDeskSettingsTab(pathParts[2]);
    }

    if (pathParts[0] !== "settings" || !isProductSettingsSection(pathParts[1]) || !pathParts[2]) {
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
    const frontDeskTab = isProductSettingsSection(normalizedSection)
      ? normalizeFrontDeskSettingsTab(options.frontDeskTab || getActiveFrontDeskSettingsTab(options.helpers, normalizedSection))
      : "";
    const pathParts = getHashPathParts();
    const useFrontDeskRoute = frontDeskTab && (
      options.frontDeskRoute === true
      || (
        ["front-desk", "frontdesk", "customize"].includes(pathParts[0])
        && ["customization", "settings", "customize"].includes(pathParts[1])
      )
    );
    const nextHash = frontDeskTab
      ? useFrontDeskRoute
        ? `#front-desk/customization/${getFrontDeskSettingsTabHashSegment(frontDeskTab)}`
        : `#settings/${getSettingsHashSegment(normalizedSection)}/${getFrontDeskSettingsTabHashSegment(frontDeskTab)}`
      : `#settings/${getSettingsHashSegment(normalizedSection)}`;
    const nextUrl = new URL(global.location.href);

    if (nextUrl.hash === nextHash) {
      return;
    }

    nextUrl.hash = nextHash;
    global.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  function getSectionByKey(sectionKey) {
    const visibleDetails = getVisibleSettingsSectionDetails();
    return visibleDetails.find((section) => section.key === normalizeSettingsSection(sectionKey)) || visibleDetails[0];
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
    const hashSection = getSettingsSectionFromHash();
    const storedSection = normalizeSettingsSection(global.localStorage?.getItem(SETTINGS_STORAGE_KEY));
    const section = hashSection || storedSection;
    const visibleSections = getVisibleSettingsSections();

    return visibleSections.includes(section) ? section : visibleSections[0];
  }

  function setActiveSettingsSection(section) {
    global.localStorage?.setItem(SETTINGS_STORAGE_KEY, normalizeSettingsSection(section));
  }

  function getActiveFrontDeskSettingsTab(helpers = getHelpers(), sectionKey = getActiveSettingsSection()) {
    const hashTab = getFrontDeskSettingsTabFromHash();
    const storedTab = normalizeFrontDeskSettingsTab(helpers.getDashboardUiStateValue("settingsFrontDeskTab"));
    const defaultTab = getDefaultProductSettingsTab(sectionKey);
    const candidate = hashTab || storedTab || defaultTab;
    const visibleTabs = getProductSettingsTabs(sectionKey, hashTab);

    return visibleTabs.includes(candidate) ? candidate : defaultTab;
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
      website_widget: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M15 10h1.5a1.5 1.5 0 0 1 0 3H15z"/>',
      voice_agent: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/>',
      business_profile: '<path d="M4 21V5a2 2 0 0 1 2-2h9l5 5v13"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h8"/>',
      connected_apps: '<path d="M9 7H7a4 4 0 0 0 0 8h2"/><path d="M15 7h2a4 4 0 0 1 0 8h-2"/><path d="M8 12h8"/><path d="M12 4v3M12 17v3"/>',
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
          ${getVisibleSettingsSectionDetails().map((section) => `
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
          ${getVisibleSettingsSectionDetails().map((section) => `
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
            <p class="settings-shell-page-copy">Keep the business facts Vonza should trust when the Website Widget, hosted Front Desk page, QR links, or embeds answer customer questions.</p>
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

        <section class="settings-shell-section settings-business-readiness-section">
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
            <div class="settings-shell-status-row settings-shell-status-row--actions" role="status" aria-live="polite" aria-label="Website import status">
              <div class="settings-shell-status-main">
                <p class="settings-shell-status-label">Import status</p>
                <h4 class="settings-shell-status-value">${escapeHtml(importState.value)}</h4>
                <p class="settings-shell-status-copy">${escapeHtml(importState.summary)}</p>
                ${importState.retryable ? `<p class="settings-shell-status-copy">Retry starts a fresh async import for full-page Front Desk knowledge.</p>` : ""}
              </div>
              <div class="settings-shell-status-actions">
                <button class="ghost-button" type="button" data-action="import-knowledge" aria-label="${escapeHtml(importState.retryable ? "Retry website knowledge import" : "Import website knowledge")}" ${importState.retryable ? 'data-import-force="true"' : ""}>${escapeHtml(importState.retryable ? "Retry website import" : knowledgeActionLabel)}</button>
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

  function buildFrontDeskSettingsForm(agent, _setup, helpers, productSettings = {}) {
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
    const productSettingsSection = isProductSettingsSection(productSettings.sectionKey)
      ? normalizeSettingsSection(productSettings.sectionKey)
      : "front_desk";
    const useLegacyFrontDeskTabs = !productSettings.sectionKey && !productSettings.settingsSection;
    const hashFrontDeskTab = getFrontDeskSettingsTabFromHash();
    const activeFrontDeskTab = getActiveFrontDeskSettingsTab(helpers, productSettingsSection);
    const activeFullPageTab = getActiveFullPageSettingsTab(helpers);
    const productSettingsCopy = getProductSettingsCopy(productSettingsSection, {
      activeTab: hashFrontDeskTab || activeFrontDeskTab,
      allowedDomains: agent.allowedDomains || [],
      fullPageConfig,
      installStatus,
      primaryColor,
      routingDestinationCount: [
        agent.contactEmail,
        agent.contactPhone,
        agent.bookingUrl,
        agent.quoteUrl,
        agent.checkoutUrl,
      ].filter((value) => trimText(value)).length,
      selectedPurposeOption,
      voiceConfig,
      webCallReady: [
        voiceConfig.voiceInputEnabled === true,
        voiceConfig.spokenRepliesEnabled === true,
        voiceConfig.webCallEnabled === true,
      ].every(Boolean),
    });
    const visibleFrontDeskTabs = useLegacyFrontDeskTabs ? FRONT_DESK_SETTINGS_TABS.slice() : productSettingsCopy.tabs;
    const frontDeskTabClass = (tab) => normalizeFrontDeskSettingsTab(tab) === activeFrontDeskTab ? "active" : "";
    const frontDeskTabSelected = (tab) => normalizeFrontDeskSettingsTab(tab) === activeFrontDeskTab ? "true" : "false";
    const frontDeskTabButton = (tab, label) => visibleFrontDeskTabs.includes(normalizeFrontDeskSettingsTab(tab))
      ? `<button class="settings-frontdesk-subnav-button ${frontDeskTabClass(tab)}" type="button" data-frontdesk-settings-tab="${escapeHtml(normalizeFrontDeskSettingsTab(tab))}" aria-selected="${frontDeskTabSelected(tab)}">${escapeHtml(helpers.translateDashboardText(label))}</button>`
      : "";
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
    const voiceQaDisabled = voiceConfig.voiceInputEnabled !== true;
    const voiceQaInitialStatus = voiceQaDisabled
      ? "Voice input is off. Enable and save voice input before recording."
      : "Ready to record.";
    const voiceQaLanguageLabel = voiceConfig.languageBehavior === "business"
      ? "Prefer dashboard/business language"
      : "Auto-detect voice language";
    const webCallReadinessItems = [
      {
        label: "Voice input",
        copy: voiceConfig.voiceInputEnabled ? "Ready for microphone recording." : "Enable voice input first.",
        ready: voiceConfig.voiceInputEnabled === true,
      },
      {
        label: "Spoken replies",
        copy: voiceConfig.spokenRepliesEnabled ? "Ready to generate browser audio." : "Enable spoken replies next.",
        ready: voiceConfig.spokenRepliesEnabled === true,
      },
      {
        label: "Web Call",
        copy: voiceConfig.webCallEnabled ? "Ready on the hosted Front Desk page." : "Enable Web Call last.",
        ready: voiceConfig.webCallEnabled === true,
      },
    ];
    const webCallReady = webCallReadinessItems.every((item) => item.ready);

    return `
      <form data-settings-form data-form-kind="customize" data-settings-section="${escapeHtml(productSettingsSection)}" class="settings-shell-form settings-shell-form--system settings-frontdesk-form settings-frontdesk-form--${escapeHtml(productSettingsSection)}" id="settings-section-${escapeHtml(productSettingsSection)}">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">${escapeHtml(productSettingsCopy.kicker)}</p>
            <h2 class="settings-shell-page-title">${escapeHtml(productSettingsCopy.title)}</h2>
            <p class="settings-shell-page-copy">${escapeHtml(productSettingsCopy.copy)}</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="badge success">${escapeHtml(selectedPurposeOption.label)}</span>
            <span class="${helpers.getBadgeClass(fullPageConfig.publicPageEnabled ? "Ready" : "Pending")}">${escapeHtml(fullPageConfig.publicPageEnabled ? "Hosted page live" : "Hosted page off")}</span>
            <span class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
          </div>
        </header>

        <section class="settings-operational-summary" aria-label="${escapeHtml(productSettingsCopy.ariaLabel)}">
          ${productSettingsCopy.rows.map((row) => `
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
          ${frontDeskTabButton("identity", "Identity & welcome")}
          ${frontDeskTabButton("full_page", "Full-page assistant")}
          ${frontDeskTabButton("routing", "Routing")}
          ${frontDeskTabButton("appearance", "Website Widget")}
          ${frontDeskTabButton("voice", "Voice")}
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
                  <p class="settings-shell-section-copy">Visitors can speak their question. Voice uses AI capacity and may stop when access, monthly capacity, or rate limits are reached.</p>
                </div>
              </div>
              <div class="settings-shell-choice-list">
                <label class="settings-shell-choice-row" for="voice-input-enabled">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Enable voice input</p>
                    <p class="settings-shell-key-value-copy">Show a microphone button so visitors can record a short question for transcription.</p>
                  </div>
                  <input id="voice-input-enabled" name="voice_input_enabled" type="checkbox" ${voiceConfig.voiceInputEnabled ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="spoken-replies-enabled">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Enable spoken replies</p>
                    <p class="settings-shell-key-value-copy">Allow visitors to generate and play spoken replies on demand from Vonza's text answer.</p>
                  </div>
                  <input id="spoken-replies-enabled" name="spoken_replies_enabled" type="checkbox" ${voiceConfig.spokenRepliesEnabled ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="web-call-enabled">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Enable browser voice for Front Desk</p>
                    <p class="settings-shell-key-value-copy">Show the hosted full-page browser voice panel when voice input and spoken replies are also enabled.</p>
                  </div>
                  <input id="web-call-enabled" name="web_call_enabled" type="checkbox" ${voiceConfig.webCallEnabled ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="auto-send-transcript">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Auto-send transcript after speaking</p>
                    <p class="settings-shell-key-value-copy">Send the transcribed text immediately after recording instead of placing it in the composer.</p>
                  </div>
                  <input id="auto-send-transcript" name="auto_send_transcript" type="checkbox" ${voiceConfig.autoSendTranscript ? "checked" : ""}>
                </label>
                <label class="settings-shell-choice-row" for="auto-play-spoken-replies">
                  <div class="settings-shell-choice-main">
                    <p class="settings-shell-choice-title">Auto-play spoken replies</p>
                    <p class="settings-shell-key-value-copy">Try to play each generated spoken reply after the visitor has enabled spoken replies.</p>
                  </div>
                  <input id="auto-play-spoken-replies" name="auto_play_spoken_replies" type="checkbox" ${voiceConfig.autoPlaySpokenReplies ? "checked" : ""}>
                </label>
              </div>
              <div class="settings-web-call-readiness" aria-label="${escapeHtml(helpers.translateDashboardText("Browser voice readiness checklist"))}">
                <div class="settings-web-call-readiness-header">
                  <div>
                    <h4 class="settings-web-call-readiness-title">Browser voice/Web Call setup</h4>
                    <p class="settings-web-call-readiness-copy">Turn-based browser voice for the hosted Front Desk page. It requires voice input and spoken replies, and uses AI capacity and rate limits.</p>
                  </div>
                  <span class="${helpers.getBadgeClass(webCallReady ? "Ready" : "Pending")}" data-web-call-readiness-badge>${webCallReady ? "Ready" : "Incomplete"}</span>
                </div>
                <ul class="settings-web-call-checklist">
                  ${webCallReadinessItems.map((item) => `
                    <li class="${item.ready ? "is-complete" : "is-incomplete"}">
                      <span class="settings-web-call-checkmark" aria-hidden="true">${item.ready ? "OK" : "!"}</span>
                      <span>
                        <strong>${escapeHtml(item.label)}</strong>
                        <small>${escapeHtml(item.copy)}</small>
                      </span>
                    </li>
                  `).join("")}
                </ul>
                <div class="settings-web-call-readiness-footer">
                  <p>Test the browser voice path before sharing it publicly.</p>
                  <button class="ghost-button" type="button" data-voice-qa-jump>Open owner voice QA simulator</button>
                </div>
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
                    <option value="auto" ${voiceConfig.languageBehavior === "auto" ? "selected" : ""}>Auto-detect voice language</option>
                    <option value="business" ${voiceConfig.languageBehavior === "business" ? "selected" : ""}>Prefer dashboard/business language</option>
                  </select>
                  <p class="field-help">This guides voice and transcription behavior; it does not force the chat answer language yet.</p>
                </div>
              </div>
              <div
                id="settings-voice-qa-simulator"
                class="settings-voice-qa-simulator ${voiceQaDisabled ? "is-disabled" : ""}"
                data-voice-qa-panel
                data-agent-id="${escapeHtml(agent.id || "")}"
                data-agent-key="${escapeHtml(agent.publicAgentKey || agent.agentKey || agent.public_agent_key || "")}"
                data-business-id="${escapeHtml(agent.businessId || agent.business_id || "")}"
                data-website-url="${escapeHtml(agent.websiteUrl || agent.website_url || "")}"
                data-public-page-key="${escapeHtml(fullPageConfig.publicPageKey || "")}"
                aria-disabled="${voiceQaDisabled ? "true" : "false"}"
              >
                <div class="settings-voice-qa-header">
                  <div>
                    <h4 class="settings-voice-qa-title">Owner voice QA simulator</h4>
                    <p class="settings-voice-qa-copy">Record a short sample before enabling voice publicly. Voice tests use AI capacity and follow the same access, capacity, and rate-limit checks as public voice input.</p>
                  </div>
                  <span class="${helpers.getBadgeClass(voiceQaDisabled ? "Pending" : "Ready")}" data-voice-qa-enabled-badge>${voiceQaDisabled ? "Voice input off" : "Ready"}</span>
                </div>
                <dl class="settings-voice-qa-current" aria-label="${escapeHtml(helpers.translateDashboardText("Current voice settings"))}">
                  <div>
                    <dt>Input</dt>
                    <dd>${voiceConfig.voiceInputEnabled ? "Voice input enabled" : "Voice input off"}</dd>
                  </div>
                  <div>
                    <dt>Replies</dt>
                    <dd>${voiceConfig.spokenRepliesEnabled ? "Spoken replies enabled" : "Text replies only"}</dd>
                  </div>
                  <div>
                    <dt>Web Call</dt>
                    <dd>${voiceConfig.webCallEnabled ? "Web Call enabled" : "Web Call off"}</dd>
                  </div>
                  <div>
                    <dt>Voice style</dt>
                    <dd>${escapeHtml(VOICE_STYLE_OPTIONS.find((option) => option.value === voiceConfig.voice)?.label || "Alloy")}</dd>
                  </div>
                  <div>
                    <dt>Language</dt>
                    <dd>${escapeHtml(voiceQaLanguageLabel)}</dd>
                  </div>
                </dl>
                <ol class="settings-voice-qa-steps" aria-label="${escapeHtml(helpers.translateDashboardText("Voice QA steps"))}">
                  <li>Record a short owner voice sample.</li>
                  <li>Vonza transcribes it with the existing voice route.</li>
                  <li>Review the transcript, then copy it or use it in Practice.</li>
                </ol>
                <div class="settings-voice-qa-actions">
                  <button class="primary-button" type="button" data-voice-qa-record ${voiceQaDisabled ? "disabled" : ""}>Record sample</button>
                  <button class="ghost-button" type="button" data-voice-qa-clear disabled>Clear transcript</button>
                </div>
                <p class="settings-voice-qa-status" data-voice-qa-status role="status" aria-live="polite">${escapeHtml(voiceQaInitialStatus)}</p>
                <div class="field settings-field-wide">
                  <label for="voice-qa-transcript">Transcript preview</label>
                  <textarea id="voice-qa-transcript" data-voice-qa-transcript readonly placeholder="${escapeHtml(helpers.translateDashboardText("Your transcription preview will appear here."))}"></textarea>
                  <p class="field-help">Use this transcript as a realistic customer-style practice prompt before publishing voice.</p>
                </div>
                <div class="settings-voice-qa-actions">
                  <button class="ghost-button" type="button" data-voice-qa-copy disabled>Copy transcript</button>
                  <button class="ghost-button" type="button" data-voice-qa-practice disabled>Use in Practice</button>
                </div>
              </div>
              <p class="settings-shell-section-copy">Voice is processed to transcribe the visitor's question. Spoken replies are AI-generated on demand and count toward the workspace's AI capacity.</p>
            </section>

            <section class="settings-shell-section settings-full-page-section" id="settings-front-desk-full-page" data-frontdesk-settings-panel="full_page" ${frontDeskPanelAttrs("full_page")}>
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Full-page companion and hosted page</h3>
                  <p class="settings-shell-section-copy">Customize the companion Front Desk page customers open from QR codes, direct links, WordPress pages, smart embeds, and dedicated assistant pages.</p>
                </div>
              </div>
              <div class="settings-full-page-subnav" role="tablist" aria-label="Front Desk page customization sections">
                <button class="settings-full-page-subnav-button ${fullPageTabClass("content")}" type="button" data-full-page-settings-tab="content" aria-selected="${fullPageTabSelected("content")}">Content</button>
                <button class="settings-full-page-subnav-button ${fullPageTabClass("design")}" type="button" data-full-page-settings-tab="design" aria-selected="${fullPageTabSelected("design")}">Design</button>
                <button class="settings-full-page-subnav-button ${fullPageTabClass("layout")}" type="button" data-full-page-settings-tab="layout" aria-selected="${fullPageTabSelected("layout")}">Layout</button>
              </div>
              <div class="settings-full-page-grid">
                <div class="settings-shell-field-stack" data-full-page-settings-panel="content" ${fullPagePanelAttrs("content")}>
                  <label class="settings-shell-choice-row" for="full-page-public-enabled">
                    <div class="settings-shell-choice-main">
                      <p class="settings-shell-choice-title">${fullPageConfig.publicPageEnabled ? "Your Front Desk page is live" : "Your Front Desk page is disabled"}</p>
                      <p class="settings-shell-key-value-copy">${fullPageConfig.publicPageEnabled ? "Anyone with the protected public link can open this customer-facing Front Desk page." : "Enable public Front Desk page access before sharing links, embeds, or QR codes."}</p>
                    </div>
                    <input id="full-page-public-enabled" name="full_page_public_enabled" type="checkbox" ${fullPageConfig.publicPageEnabled ? "checked" : ""}>
                  </label>
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
                      <p class="field-help">Optional. Leave blank to use the assistant initial or Website Widget logo.</p>
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
                  <h3 class="settings-shell-section-title">Website Widget launcher</h3>
                  <p class="settings-shell-section-copy">Configure the Website Widget launcher for the recommended website launch path. Full-page Front Desk settings stay in the companion page section.</p>
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
          <button class="primary-button" type="submit">${escapeHtml(productSettingsCopy.saveLabel)}</button>
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
    const dashboardLanguage = getDashboardLanguage();
    const supportedDashboardLanguages = getSupportedDashboardLanguages();
    const isHungarian = dashboardLanguage === "hu";

    return `
      <div class="settings-shell-form">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Account</p>
            <h2 class="settings-shell-page-title">Account and billing</h2>
            <p class="settings-shell-page-copy">Review the real access, billing, language, and legal surfaces available for this workspace.</p>
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

        ${buildProductPackagingCards(agent, helpers, operatorWorkspace)}

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
                      <span>${escapeHtml(plan.monthlyPriceLabel || "")}</span>
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
            <strong>Website Widget</strong>
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

          ${buildProductPackagingCards(agent, helpers, operatorWorkspace)}

          <section class="settings-shell-section settings-account-status-section">
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

          <section class="settings-shell-section settings-billing-usage-section">
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
              <p class="settings-shell-page-copy">Open the public legal and privacy pages used by the website, app, hosted Front Desk page, Website Widget, and checkout.</p>
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

  function normalizeConnectedAppsState(state = {}) {
    const manualReplies = state.manualReplies && typeof state.manualReplies === "object"
      ? state.manualReplies
      : {};
    const aiDrafts = state.aiDrafts && typeof state.aiDrafts === "object"
      ? state.aiDrafts
      : {};

    return {
      capabilities: Array.isArray(state.capabilities) ? state.capabilities : [],
      connections: Array.isArray(state.connections) ? state.connections : [],
      enablements: Array.isArray(state.enablements) ? state.enablements : [],
      inboundThreads: Array.isArray(state.inboundThreads || state.threads) ? (state.inboundThreads || state.threads) : [],
      inboundEvents: Array.isArray(state.inboundEvents || state.events) ? (state.inboundEvents || state.events) : [],
      manualReplies: {
        enabled: manualReplies.enabled === true,
        status: defaultTrimText(manualReplies.status) || (manualReplies.enabled === true ? "enabled" : "disabled"),
        lastOutbound: manualReplies.lastOutbound || null,
      },
      aiDrafts: {
        enabled: aiDrafts.enabled === true,
        status: defaultTrimText(aiDrafts.status) || (aiDrafts.enabled === true ? "enabled" : "disabled"),
        lastDraft: aiDrafts.lastDraft || null,
      },
      readiness: state.readiness || null,
      readinessContext: state.readinessContext || null,
      loading: state.loading === true,
      error: defaultTrimText(state.error),
      lastLoadedAt: state.lastLoadedAt || null,
    };
  }

  function humanizeConnectedAppValue(value = "") {
    const normalized = defaultTrimText(value);
    return normalized
      ? normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase())
      : "Not set";
  }

  function summarizeConnectedAppList(values = [], fallback = "None") {
    const list = Array.isArray(values)
      ? values.map((item) => defaultTrimText(item)).filter(Boolean)
      : [];
    return list.length ? list.join(", ") : fallback;
  }

  function connectedAppStatusTone(status = "") {
    const normalized = defaultTrimText(status).toLowerCase();
    if (["active", "ready", "connected", "enabled", "ok"].includes(normalized)) return "Ready";
    if (["needs_attention", "warning", "blocked", "revoked"].includes(normalized)) return "Limited";
    if (["disabled", "needs_setup", "pending"].includes(normalized)) return "Pending";
    return normalized ? "Limited" : "Pending";
  }

  function getGoogleCalendarDisplayStatus(connection = null) {
    const status = defaultTrimText(connection?.status || "needs_setup").toLowerCase();

    if (status === "active") {
      return {
        status,
        label: "connected",
        copy: "Google Calendar is connected. Reconnect Google Calendar if access changes, or disconnect Google Calendar from this workspace.",
        buttonLabel: "Reconnect Google Calendar",
        showDisconnect: true,
      };
    }

    if (status === "needs_attention") {
      return {
        status,
        label: "needs reconnect",
        copy: "Google Calendar needs reconnect before Calendar sync can run again.",
        buttonLabel: "Reconnect Google Calendar",
        showDisconnect: true,
      };
    }

    return {
      status,
      label: "disconnected",
      copy: "Google Calendar is disconnected.",
      buttonLabel: connection ? "Reconnect Google Calendar" : "Connect Google Calendar",
      showDisconnect: Boolean(connection && status !== "revoked"),
    };
  }

  function getConnectedAppCapabilityMap(capabilities = []) {
    return new Map(
      capabilities
        .filter((capability) => defaultTrimText(capability?.key))
        .map((capability) => [defaultTrimText(capability.key), capability])
    );
  }

  function getConnectedAppCapabilityOptions(capabilities = []) {
    return capabilities
      .filter((capability) => defaultTrimText(capability?.key))
      .map((capability) => {
        const appKey = defaultTrimText(capability.key).split(".").slice(0, 2).join(".");
        return {
          key: defaultTrimText(capability.key),
          label: defaultTrimText(capability.label) || defaultTrimText(capability.key),
          appKey,
          provider: defaultTrimText(capability.provider),
        };
      });
  }

  function getConnectedAppEnablementForConnection(enablements = [], connectionId = "") {
    const normalizedConnectionId = defaultTrimText(connectionId);
    return enablements.find((enablement) => defaultTrimText(enablement?.connectionId) === normalizedConnectionId) || null;
  }

  function isGoogleCalendarCapability(capability = {}) {
    return defaultTrimText(capability?.key).startsWith("google.calendar.");
  }

  function isGoogleCalendarConnection(connection = {}) {
    return defaultTrimText(connection?.provider).toLowerCase() === "google"
      && defaultTrimText(connection?.appKey).toLowerCase() === "google.calendar";
  }

  function isWhatsAppBusinessCapability(capability = {}) {
    return defaultTrimText(capability?.key).startsWith("whatsapp.business.");
  }

  function isWhatsAppBusinessConnection(connection = {}) {
    return defaultTrimText(connection?.provider).toLowerCase() === "whatsapp"
      && defaultTrimText(connection?.appKey).toLowerCase() === "whatsapp.business";
  }

  function getConnectedAppSetupStatus(capability = {}) {
    if (isGoogleCalendarCapability(capability)) {
      return "Uses existing Google connection flow";
    }

    if (isWhatsAppBusinessCapability(capability)) {
      return "Manual/internal setup";
    }

    if (capability.requiresOAuth) {
      return "Manual status only";
    }

    if (capability.requiresWebhook) {
      return "Manual webhook status only";
    }

    return "Manual/internal setup";
  }

  function buildConnectedAppSafetyStrip(helpers) {
    const { escapeHtml } = helpers;
    const labels = [
      "Uses existing Google connection flow",
      "No chat execution",
      "No provider action without approval",
      "Report-only readiness",
      "Inbound review only",
      "Manual staff replies only",
      "AI draft only",
      "Staff must review before sending",
      "No automatic WhatsApp replies",
      "No Meta OAuth/Embedded Signup yet",
    ];

    return `
      <div class="settings-connected-app-safety-strip" aria-label="Connected apps safety limits">
        ${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
    `;
  }

  function buildConnectedAppCapabilityList(capabilities, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;

    if (!capabilities.length) {
      return `
        <div class="settings-connected-app-empty">
          <strong>No capabilities returned yet</strong>
          <p>Capability metadata appears here after the authenticated registry endpoint loads.</p>
        </div>
      `;
    }

    return `
      <div class="settings-connected-app-capability-grid">
        ${capabilities.map((capability) => `
          <article class="settings-connected-app-card">
            <div class="settings-connected-app-card-head">
              <div>
                <p class="settings-shell-status-label">${escapeHtml(humanizeConnectedAppValue(capability.provider))}</p>
                <h4 class="settings-shell-status-value">${escapeHtml(capability.label || capability.key || "Connected app capability")}</h4>
              </div>
              <span class="${getBadgeClass(capability.publicChatCallable ? "Limited" : "Ready")}">${escapeHtml(capability.publicChatCallable ? "Public callable" : "Not public callable")}</span>
            </div>
            <p class="settings-shell-status-copy">${escapeHtml(capability.description || "Generic connected app capability metadata.")}</p>
            <dl class="settings-connected-app-meta">
              <div><dt>Provider app</dt><dd>${escapeHtml(capability.appName || "Generic app")}</dd></div>
              <div><dt>Capability</dt><dd>${escapeHtml(capability.capability || capability.key || "Not set")}</dd></div>
              <div><dt>Allowed surfaces</dt><dd>${escapeHtml(summarizeConnectedAppList(capability.allowedSurfaces))}</dd></div>
              <div><dt>Setup status</dt><dd>${escapeHtml(getConnectedAppSetupStatus(capability))}</dd></div>
            </dl>
          </article>
        `).join("")}
      </div>
    `;
  }

  function buildGoogleCalendarAdapterPanel(connectedApps, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;
    const googleCalendarCapabilities = connectedApps.capabilities.filter(isGoogleCalendarCapability);
    const googleCalendarConnections = connectedApps.connections.filter(isGoogleCalendarConnection);
    const activeConnection = googleCalendarConnections.find((connection) => defaultTrimText(connection.status) === "active") || googleCalendarConnections[0] || null;
    const displayStatus = getGoogleCalendarDisplayStatus(activeConnection);
    const googleConnectedAccountId = defaultTrimText(activeConnection?.metadata?.googleConnectedAccountId);
    const enabledConnectionIds = new Set(
      connectedApps.enablements
        .filter((enablement) => enablement?.enabled === true)
        .map((enablement) => defaultTrimText(enablement.connectionId))
        .filter(Boolean)
    );
    const enabledForAgent = activeConnection ? enabledConnectionIds.has(defaultTrimText(activeConnection.id)) : false;
    const capabilityLabels = googleCalendarCapabilities.length
      ? googleCalendarCapabilities.map((capability) => capability.label || capability.key)
      : ["Google Calendar read", "Google Calendar write"];

    return `
      <section class="settings-shell-section settings-connected-app-adapter-panel">
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">Google Calendar adapter</h3>
            <p class="settings-shell-section-copy">Google Calendar is mirrored from the existing Google operator connection into generic Connected Apps records. Uses existing Google connection flow. No chat execution. No provider action without approval.</p>
          </div>
          <span class="${getBadgeClass(connectedAppStatusTone(displayStatus.status))}">${escapeHtml(displayStatus.label)}</span>
        </div>
        <div class="settings-operational-summary settings-connected-app-summary" aria-label="Google Calendar connected app adapter">
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Provider capability</span>
              <span class="${getBadgeClass(googleCalendarCapabilities.length ? "Ready" : "Pending")}">${escapeHtml(String(googleCalendarCapabilities.length))}</span>
            </div>
            <p>${escapeHtml(summarizeConnectedAppList(capabilityLabels))}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Google connection</span>
              <span class="${getBadgeClass(connectedAppStatusTone(displayStatus.status))}">${escapeHtml(displayStatus.label)}</span>
            </div>
            <p>${escapeHtml(activeConnection?.providerAccountLabel || displayStatus.copy)}</p>
            <p>${escapeHtml(displayStatus.copy)}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Agent enablement</span>
              <span class="${getBadgeClass(enabledForAgent ? "Ready" : "Pending")}">${escapeHtml(enabledForAgent ? "Enabled" : "Not enabled")}</span>
            </div>
            <p>Use the connection record below to explicitly enable selected Google Calendar capability for this agent. Manual review is the default approval mode.</p>
          </article>
        </div>
        <div class="settings-shell-sticky-save">
          <span class="save-state">Uses existing Google connection flow. No chat execution.</span>
          <button
            class="ghost-button"
            type="button"
            data-google-connect
            data-google-connect-status="Preparing Google Calendar connection..."
            data-google-connect-error="We couldn't start the Google Calendar connection."
          >${escapeHtml(displayStatus.buttonLabel)}</button>
          ${displayStatus.showDisconnect ? `
            <button
              class="ghost-button"
              type="button"
              data-google-disconnect
              ${googleConnectedAccountId ? `data-google-connected-account-id="${escapeHtml(googleConnectedAccountId)}"` : ""}
            >Disconnect Google Calendar</button>
          ` : ""}
        </div>
      </section>
    `;
  }

  function buildWhatsAppBusinessFoundationPanel(connectedApps, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;
    const whatsappCapabilities = connectedApps.capabilities.filter(isWhatsAppBusinessCapability);
    const whatsappConnections = connectedApps.connections.filter(isWhatsAppBusinessConnection);
    const activeConnection = whatsappConnections.find((connection) => defaultTrimText(connection.status) === "active") || whatsappConnections[0] || null;
    const manualRepliesEnabled = connectedApps.manualReplies?.enabled === true;
    const enabledConnectionIds = new Set(
      connectedApps.enablements
        .filter((enablement) => enablement?.enabled === true)
        .map((enablement) => defaultTrimText(enablement.connectionId))
        .filter(Boolean)
    );
    const enabledConnections = whatsappConnections.filter((connection) =>
      enabledConnectionIds.has(defaultTrimText(connection.id))
    ).length;
    const capabilityLabels = whatsappCapabilities.length
      ? whatsappCapabilities.map((capability) => capability.label || capability.key)
      : [
        "WhatsApp Business webhook readiness",
        "WhatsApp Business template send",
        "WhatsApp Business session reply",
      ];

    if (!whatsappCapabilities.length) {
      return "";
    }

    return `
      <section class="settings-shell-section settings-connected-app-adapter-panel">
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">WhatsApp Business foundation</h3>
            <p class="settings-shell-section-copy">Manual staff replies and AI drafts are feature-flagged. AI draft only. Staff must review before sending. No automatic WhatsApp replies. No Meta OAuth/Embedded Signup yet.</p>
          </div>
          <span class="${getBadgeClass(connectedAppStatusTone(activeConnection?.status || "needs_setup"))}">${escapeHtml(humanizeConnectedAppValue(activeConnection?.status || "needs_setup"))}</span>
        </div>
        <div class="settings-operational-summary settings-connected-app-summary" aria-label="WhatsApp Business connected app foundation">
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Future capabilities</span>
              <span class="${getBadgeClass(whatsappCapabilities.length ? "Ready" : "Pending")}">${escapeHtml(String(whatsappCapabilities.length))}</span>
            </div>
            <p>${escapeHtml(summarizeConnectedAppList(capabilityLabels))}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Setup mode</span>
              <span class="${getBadgeClass("Pending")}">Manual/internal setup</span>
            </div>
            <p>Safe identifiers can be represented through manual records; credentials do not belong in dashboard fields.</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Messaging</span>
              <span class="${getBadgeClass(manualRepliesEnabled ? "Ready" : "Pending")}">${escapeHtml(manualRepliesEnabled ? "Manual replies enabled" : "Manual replies disabled")}</span>
            </div>
            <p>Staff can send only manual session replies when the server flag, active owner connection, agent enablement, and session window all allow it. AI drafts never send automatically.</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Inbox mode</span>
              <span class="${getBadgeClass("Limited")}">Inbound review only</span>
            </div>
            <p>Redacted inbound events can be reviewed manually. AI draft only. Enabled records for this agent: ${escapeHtml(String(enabledConnections))}.</p>
          </article>
        </div>
      </section>
    `;
  }

  function buildConnectedAppInboxPanel(connectedApps, helpers, agent = {}) {
    const { escapeHtml, getBadgeClass } = helpers;
    const threads = Array.isArray(connectedApps.inboundThreads) ? connectedApps.inboundThreads : [];
    const events = Array.isArray(connectedApps.inboundEvents) ? connectedApps.inboundEvents : [];
    const manualReplies = connectedApps.manualReplies || {};
    const aiDrafts = connectedApps.aiDrafts || {};
    const manualRepliesEnabled = manualReplies.enabled === true;
    const aiDraftsEnabled = aiDrafts.enabled === true;
    const aiDraftsAvailable = aiDraftsEnabled && manualRepliesEnabled;
    const lastOutbound = manualReplies.lastOutbound || null;
    const selectedThreadId = defaultTrimText(threads[0]?.id);
    const recentEvents = selectedThreadId
      ? events.filter((event) => defaultTrimText(event.threadId) === selectedThreadId).slice(0, 8)
      : events.slice(0, 8);
    const statusOptions = ["reviewing", "resolved", "ignored", "archived"];

    return `
      <section class="settings-shell-section settings-connected-app-inbox" aria-label="Connected app inbox">
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">Connected app inbox</h3>
            <p class="settings-shell-section-copy">AI draft only. Staff must review before sending. No automatic WhatsApp replies.</p>
          </div>
          <button class="ghost-button" type="button" data-connected-app-inbox-refresh>Refresh</button>
        </div>
        <div class="settings-connected-app-empty">
          <strong>${escapeHtml(manualRepliesEnabled ? "Manual WhatsApp replies enabled" : "Manual WhatsApp replies disabled")}</strong>
          <p>${escapeHtml(manualRepliesEnabled ? "Text replies still require an active owner connection, explicit agent enablement, server-side credentials, and a current customer-service window." : "Replies are off until WHATSAPP_MANUAL_REPLIES_ENABLED is enabled on the server. Staff can keep reviewing inbound threads without sending messages.")}</p>
          <p>${escapeHtml(aiDraftsAvailable ? "AI draft only is enabled for staff review. Drafts populate the manual composer and never send automatically." : "AI draft only is disabled until WHATSAPP_AI_REPLY_DRAFTS_ENABLED and the manual reply path are both enabled.")}</p>
          ${lastOutbound?.status ? `
            <span class="${getBadgeClass(connectedAppStatusTone(lastOutbound.status))}">Last manual reply: ${escapeHtml(humanizeConnectedAppValue(lastOutbound.status))}</span>
          ` : ""}
        </div>

        <div class="settings-connected-app-inbox-grid">
          <div class="settings-connected-app-thread-list" aria-label="Connected app inbound threads">
            ${threads.length ? threads.map((thread) => `
              <article class="settings-connected-app-thread-row">
                <div class="settings-connected-app-thread-main">
                  <div>
                    <p class="settings-shell-status-label">${escapeHtml(`${humanizeConnectedAppValue(thread.provider)} / ${thread.appKey || "app"}`)}</p>
                    <h4 class="settings-shell-status-value">${escapeHtml(thread.externalThreadLabel || "Connected app conversation")}</h4>
                    <p class="settings-shell-status-copy">Last event: ${escapeHtml(formatConnectedAppTimestamp(thread.lastEventAt))}. Type: ${escapeHtml(humanizeConnectedAppValue(thread.lastEventType || "unknown"))}${thread.lastMessageType ? ` / ${escapeHtml(humanizeConnectedAppValue(thread.lastMessageType))}` : ""}.</p>
                  </div>
                  <div class="settings-connected-app-badges">
                    <span class="${getBadgeClass(connectedAppStatusTone(thread.status))}">${escapeHtml(humanizeConnectedAppValue(thread.status || "open"))}</span>
                    <span class="${getBadgeClass(Number(thread.unreadCount || 0) > 0 ? "Limited" : "Ready")}">${escapeHtml(`${Number(thread.unreadCount || 0)} unread`)}</span>
                  </div>
                </div>
                <form data-connected-app-inbox-status-form class="settings-connected-app-inbox-status-form">
                  <input type="hidden" name="thread_id" value="${escapeHtml(thread.id || "")}">
                  <label>
                    <span>Review status</span>
                    <select name="status">
                      ${statusOptions.map((status) => `
                        <option value="${escapeHtml(status)}" ${thread.status === status ? "selected" : ""}>${escapeHtml(humanizeConnectedAppValue(status))}</option>
                      `).join("")}
                    </select>
                  </label>
                  <button class="ghost-button" type="submit">Mark status</button>
                </form>
                ${aiDraftsAvailable ? `
                  <form data-connected-app-ai-draft-form class="settings-connected-app-inbox-status-form">
                    <input type="hidden" name="thread_id" value="${escapeHtml(thread.id || "")}">
                    <input type="hidden" name="agent_id" value="${escapeHtml(agent?.id || "")}">
                    <label>
                      <span>AI draft only</span>
                      <textarea name="staff_instructions" maxlength="500" placeholder="Optional staff guidance for tone or focus"></textarea>
                    </label>
                    <p class="settings-shell-status-copy">Staff must review before sending. No automatic WhatsApp replies.</p>
                    <button class="ghost-button" type="submit">Generate AI draft</button>
                  </form>
                ` : `
                  <div class="settings-connected-app-empty">
                    <strong>AI draft only</strong>
                    <p>Staff must review before sending. No automatic WhatsApp replies. Drafting is disabled by server feature flag or manual reply readiness.</p>
                  </div>
                `}
                ${manualRepliesEnabled ? `
                  <form data-connected-app-manual-reply-form class="settings-connected-app-inbox-status-form">
                    <input type="hidden" name="thread_id" value="${escapeHtml(thread.id || "")}">
                    <input type="hidden" name="agent_id" value="${escapeHtml(agent?.id || "")}">
                    <input type="hidden" name="capability_key" value="whatsapp.business.send.session.reply">
                    <label>
                      <span>Manual staff reply</span>
                      <textarea name="message_text" maxlength="4096" placeholder="Write or review the staff-authored WhatsApp reply" data-connected-app-manual-reply-text></textarea>
                    </label>
                    <p class="settings-shell-status-copy">Existing manual send path only. Staff must review before sending. No automatic WhatsApp replies.</p>
                    <button class="primary-button" type="submit">Send manual reply</button>
                  </form>
                ` : `
                  <div class="settings-connected-app-empty">
                    <strong>Manual staff reply</strong>
                    <p>Staff must review before sending. No automatic WhatsApp replies. Sending is disabled by server feature flag.</p>
                  </div>
                `}
              </article>
            `).join("") : `
              <div class="settings-connected-app-empty">
                <strong>No inbound threads yet</strong>
                <p>Redacted WhatsApp webhook events will appear here for manual staff review after delivery.</p>
              </div>
            `}
          </div>

          <div class="settings-connected-app-event-list" aria-label="Recent redacted inbound events">
            <div class="settings-connected-app-event-list-head">
              <strong>Recent redacted events</strong>
              <span>${escapeHtml(recentEvents.length ? `${recentEvents.length} shown` : "None yet")}</span>
            </div>
            ${recentEvents.length ? recentEvents.map((event) => `
              <article class="settings-connected-app-event-row">
                <div>
                  <p class="settings-shell-status-label">${escapeHtml(formatConnectedAppTimestamp(event.receivedAt || event.createdAt))}</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(humanizeConnectedAppValue(event.providerEventType || "event"))}${event.normalized?.messageType ? ` / ${escapeHtml(humanizeConnectedAppValue(event.normalized.messageType))}` : ""}</h4>
                  <p class="settings-shell-status-copy">Provider payload and contact fields redacted. Safe normalized text is not displayed in this event list.</p>
                </div>
                <span class="${getBadgeClass(connectedAppStatusTone(event.eventStatus || "received"))}">${escapeHtml(humanizeConnectedAppValue(event.eventStatus || "received"))}</span>
              </article>
            `).join("") : `
              <div class="settings-connected-app-empty">
                <strong>No recent redacted events</strong>
                <p>Inbound event summaries are stored without customer phone numbers, profile names, or full provider payloads. Safe normalized text may be retained owner-scoped for draft context only.</p>
              </div>
            `}
          </div>
        </div>
      </section>
    `;
  }

  function buildConnectedAppConnectionForms(connections, capabilities, enablements, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;
    const capabilityMap = getConnectedAppCapabilityMap(capabilities);
    const surfaceOptions = [
      { value: "operator", label: "Operator" },
      { value: "dashboard", label: "Dashboard" },
      { value: "internal", label: "Internal" },
      { value: "webhook", label: "Webhook" },
    ];

    if (!connections.length) {
      return `
        <div class="settings-connected-app-empty">
          <strong>No manual connection records yet</strong>
          <p>Create a status-only record below. It does not start OAuth, store credentials, or execute providers.</p>
        </div>
      `;
    }

    return `
      <div class="settings-connected-app-connection-list">
        ${connections.map((connection) => {
          const connectionCapabilities = Array.isArray(connection.capabilityKeys) ? connection.capabilityKeys : [];
          const enablement = getConnectedAppEnablementForConnection(enablements, connection.id);
          const selectedCapabilities = new Set(Array.isArray(enablement?.capabilityKeys) ? enablement.capabilityKeys : connectionCapabilities.slice(0, 1));
          const allowedSurfaces = new Set(Array.isArray(enablement?.allowedSurfaces) ? enablement.allowedSurfaces : ["operator"]);
          return `
            <article class="settings-connected-app-connection-row">
              <div class="settings-connected-app-connection-main">
                <div>
                  <p class="settings-shell-status-label">${escapeHtml(`${humanizeConnectedAppValue(connection.provider)} / ${connection.appKey || "app"}`)}</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(connection.providerAccountLabel || connection.providerAccountId || "Provider account label not set")}</h4>
                  <p class="settings-shell-status-copy">Capabilities: ${escapeHtml(summarizeConnectedAppList(connectionCapabilities))}</p>
                  <p class="settings-shell-status-copy">Scopes: ${escapeHtml(summarizeConnectedAppList(connection.scopesGranted))}</p>
                  <p class="settings-shell-status-copy">Webhook status: ${escapeHtml(humanizeConnectedAppValue(connection.webhookStatus || "not_required"))}</p>
                </div>
                <div class="settings-connected-app-badges">
                  <span class="${getBadgeClass(connectedAppStatusTone(connection.status))}">${escapeHtml(humanizeConnectedAppValue(connection.status))}</span>
                  <span class="${getBadgeClass(enablement?.enabled ? "Ready" : "Pending")}">${escapeHtml(enablement?.enabled ? "Enabled for agent" : "Not enabled for agent")}</span>
                </div>
              </div>

              <div class="settings-connected-app-control-grid">
                <form data-connected-app-status-form class="settings-connected-app-mini-form">
                  <input type="hidden" name="connection_id" value="${escapeHtml(connection.id || "")}">
                  <div class="field">
                    <label for="connected-app-status-${escapeHtml(connection.id || "")}">Connection status</label>
                    <select id="connected-app-status-${escapeHtml(connection.id || "")}" name="status">
                      ${["needs_setup", "active", "disabled", "needs_attention", "revoked"].map((status) => `
                        <option value="${escapeHtml(status)}" ${connection.status === status ? "selected" : ""}>${escapeHtml(humanizeConnectedAppValue(status))}</option>
                      `).join("")}
                    </select>
                  </div>
                  <div class="field">
                    <label for="connected-app-webhook-${escapeHtml(connection.id || "")}">Webhook status</label>
                    <select id="connected-app-webhook-${escapeHtml(connection.id || "")}" name="webhook_status">
                      ${["not_required", "needs_setup", "active", "disabled", "needs_attention"].map((status) => `
                        <option value="${escapeHtml(status)}" ${defaultTrimText(connection.webhookStatus || "not_required") === status ? "selected" : ""}>${escapeHtml(humanizeConnectedAppValue(status))}</option>
                      `).join("")}
                    </select>
                  </div>
                  <div class="field settings-field-wide">
                    <label for="connected-app-reason-${escapeHtml(connection.id || "")}">Needs-attention reason</label>
                    <input id="connected-app-reason-${escapeHtml(connection.id || "")}" name="needs_attention_reason" type="text" value="${escapeHtml(connection.needsAttentionReason || "")}" placeholder="manual review note">
                  </div>
                  <button class="ghost-button" type="submit">Update status</button>
                </form>

                <form data-connected-app-enable-form class="settings-connected-app-mini-form">
                  <input type="hidden" name="connection_id" value="${escapeHtml(connection.id || "")}">
                  ${enablement?.id ? `<input type="hidden" name="enablement_id" value="${escapeHtml(enablement.id)}">` : ""}
                  <div class="field">
                    <label for="connected-app-enabled-${escapeHtml(connection.id || "")}">Agent enablement</label>
                    <select id="connected-app-enabled-${escapeHtml(connection.id || "")}" name="enabled">
                      <option value="true" ${enablement?.enabled === false ? "" : "selected"}>Enabled</option>
                      <option value="false" ${enablement?.enabled === false ? "selected" : ""}>Disabled</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="connected-app-approval-${escapeHtml(connection.id || "")}">Approval mode</label>
                    <select id="connected-app-approval-${escapeHtml(connection.id || "")}" name="approval_mode">
                      ${["manual_review", "owner_approved", "automatic_internal", "disabled"].map((mode) => `
                        <option value="${escapeHtml(mode)}" ${defaultTrimText(enablement?.approvalMode || "manual_review") === mode ? "selected" : ""}>${escapeHtml(humanizeConnectedAppValue(mode))}</option>
                      `).join("")}
                    </select>
                  </div>
                  <div class="settings-connected-app-checkbox-group" aria-label="Enable capabilities for this agent">
                    ${connectionCapabilities.map((capabilityKey) => {
                      const definition = capabilityMap.get(capabilityKey);
                      return `
                        <label>
                          <input name="capability_keys" type="checkbox" value="${escapeHtml(capabilityKey)}" ${selectedCapabilities.has(capabilityKey) ? "checked" : ""}>
                          <span>${escapeHtml(definition?.label || capabilityKey)}</span>
                        </label>
                      `;
                    }).join("")}
                  </div>
                  <div class="settings-connected-app-checkbox-group" aria-label="Allowed non-public surfaces">
                    ${surfaceOptions.map((surface) => `
                      <label>
                        <input name="allowed_surfaces" type="checkbox" value="${escapeHtml(surface.value)}" ${allowedSurfaces.has(surface.value) ? "checked" : ""}>
                        <span>${escapeHtml(surface.label)}</span>
                      </label>
                    `).join("")}
                  </div>
                  <button class="ghost-button" type="submit">Save agent enablement</button>
                </form>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function buildConnectedAppCreateForm(capabilities, helpers) {
    const { escapeHtml } = helpers;
    const capabilityOptions = getConnectedAppCapabilityOptions(capabilities);
    const providerOptions = [...new Set(capabilityOptions.map((option) => option.provider).filter(Boolean))];
    const appOptions = [...new Set(capabilityOptions.map((option) => option.appKey).filter(Boolean))];

    return `
      <form data-connected-app-connection-form class="settings-shell-section settings-connected-app-create-form">
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">Create manual connection record</h3>
            <p class="settings-shell-section-copy">Manual/internal status records stay available for non-adapter review. Google Calendar uses the existing Google connection flow instead of credential or OAuth URL inputs.</p>
          </div>
        </div>
        <div class="settings-field-grid settings-field-grid--two">
          <div class="field">
            <label for="connected-app-provider">Provider</label>
            <select id="connected-app-provider" name="provider">
              ${providerOptions.length ? providerOptions.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(humanizeConnectedAppValue(provider))}</option>`).join("") : '<option value="">No providers loaded</option>'}
            </select>
          </div>
          <div class="field">
            <label for="connected-app-key">App key</label>
            <input id="connected-app-key" name="app_key" type="text" list="connected-app-key-options" value="${escapeHtml(appOptions[0] || "")}" placeholder="google.calendar">
            <datalist id="connected-app-key-options">
              ${appOptions.map((appKey) => `<option value="${escapeHtml(appKey)}"></option>`).join("")}
            </datalist>
          </div>
          <div class="field">
            <label for="connected-app-capability">Capability</label>
            <select id="connected-app-capability" name="capabilities">
              ${capabilityOptions.length ? capabilityOptions.map((option) => `
                <option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>
              `).join("") : '<option value="">No capabilities loaded</option>'}
            </select>
          </div>
          <div class="field">
            <label for="connected-app-status">Status</label>
            <select id="connected-app-status" name="status">
              ${["needs_setup", "active", "disabled", "needs_attention", "revoked"].map((status) => `
                <option value="${escapeHtml(status)}">${escapeHtml(humanizeConnectedAppValue(status))}</option>
              `).join("")}
            </select>
          </div>
          <div class="field">
            <label for="connected-app-account-label">Provider account label</label>
            <input id="connected-app-account-label" name="provider_account_label" type="text" placeholder="owner@example.com">
          </div>
          <div class="field">
            <label for="connected-app-webhook-status">Webhook status</label>
            <select id="connected-app-webhook-status" name="webhook_status">
              ${["not_required", "needs_setup", "active", "disabled", "needs_attention"].map((status) => `
                <option value="${escapeHtml(status)}">${escapeHtml(humanizeConnectedAppValue(status))}</option>
              `).join("")}
            </select>
          </div>
          <div class="field settings-field-wide">
            <label for="connected-app-scopes">Scopes/capabilities summary</label>
            <textarea id="connected-app-scopes" name="scopes" placeholder="calendar.read"></textarea>
            <p class="field-help">Status-only labels for internal readiness review. Do not enter credentials.</p>
          </div>
        </div>
        <div class="settings-shell-sticky-save">
          <span class="save-state">Manual status only. No provider execution.</span>
          <button class="primary-button" type="submit">Create manual record</button>
        </div>
      </form>
    `;
  }

  function buildConnectedAppReadinessPanel(readiness, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;
    const requirements = Array.isArray(readiness?.requirements) ? readiness.requirements : [];
    const summary = readiness?.summary || {};

    return `
      <section class="settings-shell-section settings-connected-app-readiness-panel">
        <div class="settings-shell-section-header">
          <div>
            <h3 class="settings-shell-section-title">Report-only readiness</h3>
            <p class="settings-shell-section-copy">Readiness is an owner dashboard report only. It does not activate packages, execute providers, or expose public chat tools.</p>
          </div>
          <span class="${getBadgeClass(connectedAppStatusTone(readiness?.status || "ready"))}">${escapeHtml(humanizeConnectedAppValue(readiness?.status || "ready"))}</span>
        </div>
        <div class="settings-connected-app-summary-row">
          <span>Ready: ${escapeHtml(String(summary.ready || 0))}</span>
          <span>Warnings: ${escapeHtml(String(summary.warning || 0))}</span>
          <span>Blocked: ${escapeHtml(String(summary.blocked || 0))}</span>
          <span>Optional warnings: ${escapeHtml(String(summary.optionalWarnings || 0))}</span>
        </div>
        ${requirements.length ? `
          <div class="settings-connected-app-readiness-list">
            ${requirements.map((requirement) => `
              <article class="settings-connected-app-readiness-item">
                <div>
                  <p class="settings-shell-status-label">${escapeHtml(humanizeConnectedAppValue(requirement.requirementType || "requirement"))}</p>
                  <h4 class="settings-shell-status-value">${escapeHtml(requirement.label || requirement.key || "Connected app readiness")}</h4>
                  <p class="settings-shell-status-copy">${escapeHtml(requirement.reasons?.length
                    ? requirement.reasons.map((reason) => reason.message || reason.code).join(" ")
                    : "Ready in this report-only context.")}</p>
                </div>
                <span class="${getBadgeClass(connectedAppStatusTone(requirement.status))}">${escapeHtml(humanizeConnectedAppValue(requirement.status))}</span>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="settings-connected-app-empty">
            <strong>No readiness warnings returned</strong>
            <p>The report-only evaluator did not return required or optional warnings for this agent yet.</p>
          </div>
        `}
      </section>
    `;
  }

  function buildConnectedAppsSettingsSection(agent, connectedAppsState, helpers) {
    const { escapeHtml, getBadgeClass } = helpers;
    const connectedApps = normalizeConnectedAppsState(connectedAppsState);
    const activeConnections = connectedApps.connections.filter((connection) => defaultTrimText(connection.status) === "active").length;
    const enabledCount = connectedApps.enablements.filter((enablement) => enablement.enabled === true).length;
    const readinessStatus = connectedApps.readiness?.status || "ready";

    return `
      <section id="settings-section-connected_apps" data-settings-section="connected_apps" class="settings-connected-apps-section">
        <div class="settings-shell-form">
          <header class="settings-shell-page-header">
            <div class="settings-shell-page-title-group">
              <p class="studio-kicker">Connected apps</p>
              <h2 class="settings-shell-page-title">Connected apps</h2>
              <p class="settings-shell-page-copy">View generic connected app capabilities, manage manual status-only records, and review report-only readiness for ${escapeHtml(agent?.assistantName || agent?.name || "the selected agent")}.</p>
            </div>
            <div class="settings-shell-page-meta">
              <span class="${getBadgeClass("Ready")}">Uses existing Google connection flow</span>
              <span class="${getBadgeClass("Limited")}">No chat execution</span>
              <span class="${getBadgeClass("Limited")}">No provider action without approval</span>
            </div>
          </header>

          ${buildConnectedAppSafetyStrip(helpers)}

          ${connectedApps.loading ? `
            <div class="settings-connected-app-empty">
              <strong>Loading connected apps</strong>
              <p>Fetching authenticated owner connection status and report-only readiness.</p>
            </div>
          ` : ""}

          ${connectedApps.error ? `
            <div class="settings-shell-billing-notice settings-shell-billing-notice--warning">
              ${escapeHtml(connectedApps.error)}
            </div>
          ` : ""}

          <section class="settings-operational-summary settings-connected-app-summary" aria-label="Connected apps summary">
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Capabilities</span>
                <span class="${getBadgeClass(connectedApps.capabilities.length ? "Ready" : "Pending")}">${escapeHtml(String(connectedApps.capabilities.length))}</span>
              </div>
              <p>Safe registry metadata only. Google Calendar uses the existing Google flow; other records remain manual/status-only.</p>
            </article>
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Connection status records</span>
                <span class="${getBadgeClass(activeConnections ? "Ready" : "Pending")}">${escapeHtml(`${activeConnections} active`)}</span>
              </div>
              <p>${escapeHtml(connectedApps.connections.length ? `${connectedApps.connections.length} manual/internal record${connectedApps.connections.length === 1 ? "" : "s"} loaded.` : "No manual connection records yet.")}</p>
            </article>
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Agent enablements</span>
                <span class="${getBadgeClass(enabledCount ? "Ready" : "Pending")}">${escapeHtml(`${enabledCount} enabled`)}</span>
              </div>
              <p>Agent enablement controls are dashboard-only and not public chat callable.</p>
            </article>
            <article class="settings-operational-card">
              <div class="settings-operational-card-head">
                <span>Readiness</span>
                <span class="${getBadgeClass(connectedAppStatusTone(readinessStatus))}">${escapeHtml(humanizeConnectedAppValue(readinessStatus))}</span>
              </div>
              <p>Report-only readiness. No package activation enforcement.</p>
            </article>
          </section>

          <section class="settings-shell-section">
            <div class="settings-shell-section-header">
              <div>
                <h3 class="settings-shell-section-title">Capability registry</h3>
                <p class="settings-shell-section-copy">Provider and capability labels are read-only metadata. Public chat callable controls are not exposed.</p>
              </div>
            </div>
            ${buildConnectedAppCapabilityList(connectedApps.capabilities, helpers)}
          </section>

          ${buildGoogleCalendarAdapterPanel(connectedApps, helpers)}
          ${buildWhatsAppBusinessFoundationPanel(connectedApps, helpers)}
          ${buildConnectedAppInboxPanel(connectedApps, helpers, agent)}

          <section class="settings-shell-section">
            <div class="settings-shell-section-header">
              <div>
                <h3 class="settings-shell-section-title">Connection records and agent enablement</h3>
                <p class="settings-shell-section-copy">List and update status-only connection records, then enable or disable selected capabilities for this agent with approval mode and allowed non-public surfaces.</p>
              </div>
            </div>
            ${buildConnectedAppConnectionForms(connectedApps.connections, connectedApps.capabilities, connectedApps.enablements, helpers)}
          </section>

          ${buildConnectedAppCreateForm(connectedApps.capabilities, helpers)}
          ${buildConnectedAppReadinessPanel(connectedApps.readiness, helpers)}
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
      { label: "Website Widget install", value: installStatus.label || "Not installed yet" },
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
    const dashboardLanguage = getDashboardLanguage();
    const supportedDashboardLanguages = getSupportedDashboardLanguages();

    return `
      <article class="settings-overview-card settings-overview-card--wide">
        <div class="settings-card-heading">
          <div>
            <h2 class="settings-card-title">Workspace preferences</h2>
            <p class="settings-card-copy">Dashboard language is a real workspace preference for this browser/session.</p>
          </div>
        </div>
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
      </article>
    `;
  }

  function buildWidgetOnlySettingsForm(agent, helpers) {
    const selectedPurpose = defaultTrimText(agent.widgetPurpose || agent.widget_purpose || "support") || "support";
    const selectedPurposeOption = WIDGET_PURPOSE_OPTIONS.find((option) => option.value === selectedPurpose) || WIDGET_PURPOSE_OPTIONS[1] || WIDGET_PURPOSE_OPTIONS[0];
    const primaryColor = normalizeFullPageColor(agent.primaryColor || agent.primary_color || "#14b8a6", "#14b8a6");
    const allowedDomains = Array.isArray(agent.allowedDomains) ? agent.allowedDomains : [];
    const installStatus = agent.installStatus || {};
    const installDetected = ["installed_unseen", "seen_recently", "seen_stale"].includes(defaultTrimText(installStatus.state));
    const routingDestinationCount = [
      agent.contactEmail,
      agent.contactPhone,
      agent.bookingUrl,
      agent.quoteUrl,
      agent.checkoutUrl,
    ].filter((value) => defaultTrimText(value)).length;

    return `
      <form data-settings-form data-form-kind="customize" data-settings-section="website_widget" class="settings-shell-form settings-shell-form--system settings-frontdesk-form settings-frontdesk-form--website_widget" id="settings-section-website_widget">
        <header class="settings-shell-page-header">
          <div class="settings-shell-page-title-group">
            <p class="studio-kicker">Website Widget</p>
            <h2 class="settings-shell-page-title">Website Widget</h2>
            <p class="settings-shell-page-copy">Configure the existing embedded widget launcher, answer posture, routing destinations, and allowed domains.</p>
          </div>
          <div class="settings-shell-page-meta">
            <span class="badge success">${defaultEscapeHtml(selectedPurposeOption.label)}</span>
            <span class="${helpers.getBadgeClass(installDetected ? "Ready" : "Pending")}">${defaultEscapeHtml(installDetected ? "Install detected" : "Install not detected")}</span>
            <span class="badge success">${defaultEscapeHtml(agent.tone || "friendly")}</span>
          </div>
        </header>

        <section class="settings-operational-summary" aria-label="Website Widget settings summary">
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Launcher</span>
              <span class="${helpers.getBadgeClass(defaultTrimText(agent.buttonLabel || agent.welcomeMessage) ? "Ready" : "Pending")}">${defaultEscapeHtml(defaultTrimText(agent.buttonLabel || agent.welcomeMessage) ? "Configured" : "Review")}</span>
            </div>
            <p>${defaultEscapeHtml(defaultTrimText(agent.buttonLabel || agent.welcomeMessage) ? "Launcher copy or welcome text is saved." : "Review the launcher text and welcome message before installing.")}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Allowed domains</span>
              <span class="${helpers.getBadgeClass(allowedDomains.length ? "Ready" : "Pending")}">${defaultEscapeHtml(allowedDomains.length ? `${allowedDomains.length} saved` : "None saved")}</span>
            </div>
            <p>${defaultEscapeHtml(allowedDomains.length ? "The widget is scoped to saved domains." : "Add the real website domains that should load the widget.")}</p>
          </article>
          <article class="settings-operational-card">
            <div class="settings-operational-card-head">
              <span>Routing</span>
              <span class="${helpers.getBadgeClass(routingDestinationCount ? "Ready" : "Pending")}">${defaultEscapeHtml(routingDestinationCount ? `${routingDestinationCount} destination${routingDestinationCount === 1 ? "" : "s"}` : "No destinations")}</span>
            </div>
            <p>${defaultEscapeHtml(routingDestinationCount ? "Widget handoff destinations are available." : "Add at least one contact or next-step destination.")}</p>
          </article>
        </section>

        <div class="settings-frontdesk-layout">
          <div class="settings-frontdesk-editor">
            <section class="settings-shell-section">
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Widget purpose</h3>
                  <p class="settings-shell-section-copy">Set the main job for the embedded assistant on normal website pages.</p>
                </div>
              </div>
              <div class="settings-shell-choice-list">
                ${WIDGET_PURPOSE_OPTIONS.map((option) => `
                  <label class="settings-shell-choice-row" for="widget-purpose-${defaultEscapeHtml(option.value)}">
                    <div class="settings-shell-choice-main">
                      <p class="settings-shell-choice-title">${defaultEscapeHtml(option.label)}</p>
                      <p class="settings-shell-key-value-copy">${defaultEscapeHtml(option.description)}</p>
                    </div>
                    <input id="widget-purpose-${defaultEscapeHtml(option.value)}" name="widget_purpose" type="radio" value="${defaultEscapeHtml(option.value)}" ${selectedPurpose === option.value ? "checked" : ""}>
                  </label>
                `).join("")}
              </div>
            </section>

            <section class="settings-shell-section">
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Launcher and welcome</h3>
                  <p class="settings-shell-section-copy">Keep the launcher compact and recognizable on the customer website.</p>
                </div>
              </div>
              <div class="settings-shell-field-stack">
                <div class="field">
                  <label for="assistant-name">Assistant name</label>
                  <input id="assistant-name" name="assistant_name" type="text" value="${defaultEscapeHtml(agent.assistantName || agent.name || "")}">
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
                  <input id="assistant-button-label" name="button_label" type="text" value="${defaultEscapeHtml(agent.buttonLabel || "")}">
                </div>
                <div class="field">
                  <label for="settings-primary-color">Accent color</label>
                  <input id="settings-primary-color" name="primary_color" type="color" value="${defaultEscapeHtml(primaryColor)}">
                </div>
                <div class="field settings-field-wide">
                  <label for="assistant-welcome">Welcome message</label>
                  <textarea id="assistant-welcome" name="welcome_message">${defaultEscapeHtml(agent.welcomeMessage || "")}</textarea>
                </div>
                <div class="field settings-field-wide">
                  <label for="assistant-widget-logo">Widget logo</label>
                  <div class="settings-shell-logo-upload">
                    <div class="settings-shell-logo-preview" aria-hidden="true">
                      ${agent.widgetLogoUrl ? `<img src="${defaultEscapeHtml(agent.widgetLogoUrl)}" alt="">` : `<span>${defaultEscapeHtml((agent.assistantName || agent.name || "V").trim().charAt(0).toUpperCase() || "V")}</span>`}
                    </div>
                    <div>
                      <input id="assistant-widget-logo" name="widget_logo_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                      <p class="field-help">Use a small square PNG, JPG, WebP, or GIF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="settings-shell-section">
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Routing and domains</h3>
                  <p class="settings-shell-section-copy">Set safe handoff destinations and the domains allowed to host the widget.</p>
                </div>
              </div>
              <div class="settings-shell-field-stack">
                <div class="field">
                  <label for="assistant-primary-cta-mode">Primary CTA mode</label>
                  <select id="assistant-primary-cta-mode" name="primary_cta_mode">
                    <option value="contact" ${defaultTrimText(agent.primaryCtaMode || "contact") === "contact" ? "selected" : ""}>contact</option>
                    <option value="booking" ${defaultTrimText(agent.primaryCtaMode) === "booking" ? "selected" : ""}>booking</option>
                    <option value="quote" ${defaultTrimText(agent.primaryCtaMode) === "quote" ? "selected" : ""}>quote</option>
                    <option value="checkout" ${defaultTrimText(agent.primaryCtaMode) === "checkout" ? "selected" : ""}>checkout</option>
                    <option value="capture" ${defaultTrimText(agent.primaryCtaMode) === "capture" ? "selected" : ""}>capture</option>
                    <option value="chat" ${defaultTrimText(agent.primaryCtaMode) === "chat" ? "selected" : ""}>chat</option>
                  </select>
                </div>
                <div class="field">
                  <label for="assistant-contact-email">Contact email</label>
                  <input id="assistant-contact-email" name="contact_email" type="email" value="${defaultEscapeHtml(agent.contactEmail || "")}" placeholder="team@example.com">
                </div>
                <div class="field">
                  <label for="assistant-contact-phone">Contact phone</label>
                  <input id="assistant-contact-phone" name="contact_phone" type="tel" value="${defaultEscapeHtml(agent.contactPhone || "")}" placeholder="+1 555 555 5555">
                </div>
                <div class="field">
                  <label for="assistant-allowed-domains">Allowed domains</label>
                  <textarea id="assistant-allowed-domains" name="allowed_domains" placeholder="example.com&#10;www.example.com">${defaultEscapeHtml(allowedDomains.join("\n"))}</textarea>
                  <p class="field-help">One domain per line. Keep this limited to real widget hosts.</p>
                </div>
                <div class="field">
                  <label for="assistant-booking-url">Booking URL</label>
                  <input id="assistant-booking-url" name="booking_url" type="text" value="${defaultEscapeHtml(agent.bookingUrl || "")}" placeholder="https://example.com/book">
                </div>
                <div class="field">
                  <label for="assistant-quote-url">Quote URL</label>
                  <input id="assistant-quote-url" name="quote_url" type="text" value="${defaultEscapeHtml(agent.quoteUrl || "")}" placeholder="https://example.com/quote">
                </div>
                <div class="field">
                  <label for="assistant-checkout-url">Checkout URL</label>
                  <input id="assistant-checkout-url" name="checkout_url" type="text" value="${defaultEscapeHtml(agent.checkoutUrl || "")}" placeholder="https://example.com/checkout">
                </div>
              </div>
            </section>

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
                  <textarea id="assistant-instructions" name="system_prompt">${defaultEscapeHtml(agent.systemPrompt || "")}</textarea>
                </div>
              </div>
            </section>
          </div>

          <aside class="settings-frontdesk-preview" aria-label="Website Widget live readout" data-frontdesk-settings-preview>
            <section class="settings-shell-section">
              <div class="settings-shell-section-header">
                <div>
                  <h3 class="settings-shell-section-title">Current live readout</h3>
                  <p class="settings-shell-section-copy">Review how the embedded assistant will appear.</p>
                </div>
              </div>
              <div class="settings-shell-live-summary">
                <h3 id="studio-summary-name" class="studio-summary-name">${defaultEscapeHtml(agent.assistantName || agent.name || "")}</h3>
                <p id="studio-summary-copy" class="studio-summary-copy">${defaultEscapeHtml(agent.welcomeMessage || "The widget is ready to greet visitors with a clear, helpful first message.")}</p>
              </div>
            </section>
          </aside>
        </div>

        <div class="settings-shell-form-actions">
          <button class="primary-button" type="submit">Save Website Widget</button>
          <span class="settings-shell-save-state" data-settings-save-state>No changes yet.</span>
        </div>
      </form>
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
      case "website_widget":
      case "voice_agent":
        if (isWidgetOnlySettingsMode()) {
          return buildWidgetOnlySettingsForm(agent, helpers);
        }
        return buildFrontDeskSettingsForm(agent, setup, helpers, { sectionKey: activeSettingsSection });
      case "business_profile":
        return buildBusinessContextSetupPanel(agent, setup, operatorWorkspace, helpers);
      case "connected_apps":
        return buildConnectedAppsSettingsSection(agent, options.connectedApps, helpers);
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
    const widgetOnly = isWidgetOnlySettingsMode();

    const html = `
      <section class="workspace-page settings-shell-root" data-shell-section="settings" hidden>
        ${helpers.buildPageHeader({
          title: widgetOnly ? "Configuration" : helpers.t("settings.title"),
          copy: widgetOnly
            ? "Manage the Website Widget launcher, routing destinations, allowed domains, and answer posture."
            : helpers.t("settings.copy"),
        })}
        <div class="workspace-page-body settings-shell-layout">
          ${buildSettingsOverviewPanel(options, helpers)}
        </div>
      </section>
    `;
    return helpers.localizeDashboardHtml(html);
  }

  function buildWorkspacePreferencesPanel(options = {}) {
    const helpers = getHelpers(options);
    const shellSectionKey = defaultTrimText(options.shellSectionKey || "preferences").replace(/[^a-z0-9_-]/gi, "") || "preferences";
    const html = `
      <section class="workspace-page settings-shell-root settings-shell-root--preferences" data-shell-section="${helpers.escapeHtml(shellSectionKey)}" hidden>
        ${helpers.buildPageHeader({
          eyebrow: helpers.t("nav.utilities"),
          title: helpers.t("settings.title"),
          copy: helpers.t("settings.preferencesCopy"),
        })}
        <div class="workspace-page-body settings-shell-layout">
          ${buildWorkspacePreferencesCard(helpers)}
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
    const onUseVoicePracticePrompt = typeof options.onUseVoicePracticePrompt === "function"
      ? options.onUseVoicePracticePrompt
      : null;

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
          frontDeskTab: getActiveFrontDeskSettingsTab(helpers, normalizedSection),
        });
      }
      if (settingsOverview?.dataset) {
        settingsOverview.dataset.activeSettingsSection = normalizedSection;
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

      if (isProductSettingsSection(normalizedSection) && typeof showFrontDeskSettingsPanel === "function") {
        showFrontDeskSettingsPanel(getActiveFrontDeskSettingsTab(helpers, normalizedSection), { syncHash: false });
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
          showSettingsSection(normalizeSettingsSection(target.value || getVisibleSettingsSections()[0]));
          const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
          settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        });
        return;
      }

      target.addEventListener("click", () => {
        showSettingsSection(normalizeSettingsSection(target.dataset.settingsTarget || getVisibleSettingsSections()[0]));
        const settingsPanel = root.querySelector?.('[data-shell-section="settings"]');
        settingsPanel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    });

    const showFrontDeskSettingsPanel = (targetPanel = getActiveFrontDeskSettingsTab(getHelpers(options)), panelOptions = {}) => {
      const helpers = getHelpers(options);
      const activeSettingsSection = getActiveSettingsSection();
      const normalizedPanel = setActiveFrontDeskSettingsTab(targetPanel, helpers);

      if (panelOptions.syncHash !== false) {
        syncSettingsSectionHash(activeSettingsSection, {
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

    function bindVoiceQaSimulator() {
      const panel = root.querySelector?.("[data-voice-qa-panel]");
      if (!panel || panel.dataset.voiceQaBound === "true") {
        return;
      }

      panel.dataset.voiceQaBound = "true";
      const helpers = getHelpers(options);
      const translate = (message) => helpers.translateDashboardText(message);
      const recordButton = panel.querySelector?.("[data-voice-qa-record]");
      const clearButton = panel.querySelector?.("[data-voice-qa-clear]");
      const copyButton = panel.querySelector?.("[data-voice-qa-copy]");
      const practiceButton = panel.querySelector?.("[data-voice-qa-practice]");
      const jumpButton = root.querySelector?.("[data-voice-qa-jump]");
      const status = panel.querySelector?.("[data-voice-qa-status]");
      const transcriptPreview = panel.querySelector?.("[data-voice-qa-transcript]");
      const persistedVoiceEnabled = panel.getAttribute("aria-disabled") !== "true";
      let recorder = null;
      let recordingChunks = [];
      let recordingStartedAt = 0;
      let stopTimer = 0;

      const setStatusText = (message) => {
        if (status) {
          status.textContent = translate(message);
        }
      };

      const setTranscript = (value) => {
        const transcript = helpers.trimText(value);
        if (transcriptPreview) {
          transcriptPreview.value = transcript;
        }
        if (copyButton) {
          copyButton.disabled = !transcript;
        }
        if (practiceButton) {
          practiceButton.disabled = !transcript || !onUseVoicePracticePrompt;
          practiceButton.hidden = !onUseVoicePracticePrompt;
        }
        if (clearButton) {
          clearButton.disabled = !transcript;
        }
      };

      jumpButton?.addEventListener?.("click", () => {
        panel.scrollIntoView?.({ behavior: "smooth", block: "start" });
        recordButton?.focus?.({ preventScroll: true });
      });

      const browserSupportsVoiceQa = () => Boolean(
        global.navigator?.mediaDevices?.getUserMedia
        && typeof global.MediaRecorder === "function"
      );

      const isLocalSecureHost = () => {
        const hostname = helpers.trimText(global.location?.hostname).toLowerCase();
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
      };

      const getUnavailableMessage = () => {
        if (!persistedVoiceEnabled) {
          return "Voice input is off. Enable and save voice input before recording.";
        }

        if (global.isSecureContext === false && !isLocalSecureHost()) {
          return "Voice test unavailable. Open the dashboard over HTTPS to use the microphone.";
        }

        if (!browserSupportsVoiceQa()) {
          return "Voice test unavailable in this browser.";
        }

        return "";
      };

      const syncAvailability = () => {
        const unavailableMessage = getUnavailableMessage();
        panel.classList.toggle("is-disabled", Boolean(unavailableMessage));
        panel.setAttribute("aria-disabled", unavailableMessage ? "true" : "false");
        if (recordButton && !recorder) {
          recordButton.disabled = Boolean(unavailableMessage);
        }
        if (unavailableMessage) {
          setStatusText(unavailableMessage);
        }
      };

      const getPreferredMimeType = () => {
        const MediaRecorderCtor = global.MediaRecorder;
        if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== "function") {
          return "";
        }

        return VOICE_QA_RECORDING_MIME_TYPES.find((type) => MediaRecorderCtor.isTypeSupported(type)) || "";
      };

      const buildVoiceQaParams = (durationMs) => {
        const params = new URLSearchParams();
        if (panel.dataset.agentId) params.set("agent_id", panel.dataset.agentId);
        if (panel.dataset.agentKey) params.set("agent_key", panel.dataset.agentKey);
        if (panel.dataset.businessId) params.set("business_id", panel.dataset.businessId);
        if (panel.dataset.websiteUrl) params.set("website_url", panel.dataset.websiteUrl);
        if (panel.dataset.publicPageKey) params.set("public_page_key", panel.dataset.publicPageKey);
        if (global.location?.origin) params.set("origin", global.location.origin);
        if (global.location?.href) params.set("page_url", global.location.href);
        params.set("display_mode", "page");
        params.set("visitor_session_key", `owner-voice-qa:${panel.dataset.agentId || "workspace"}`);
        params.set("duration_ms", String(Math.max(1, Math.round(durationMs))));
        return params;
      };

      const getTranscriptionFailureMessage = (statusCode) => {
        const statusCodeNumber = Number(statusCode || 0);
        if (statusCodeNumber === 402) {
          return "Voice test capped: this workspace has reached monthly AI capacity.";
        }
        if (statusCodeNumber === 429) {
          return "Voice test is rate-limited. Try again in a moment.";
        }
        if (statusCodeNumber === 403) {
          return "Voice test unavailable. Check voice input and workspace access.";
        }
        if (statusCodeNumber === 413) {
          return "Voice sample is too long or too large. Record a shorter sample.";
        }
        if (statusCodeNumber === 503) {
          return "Voice test unavailable right now. Try again later.";
        }
        return "Could not transcribe that recording. Please try again.";
      };

      const transcribeVoiceQaBlob = async (blob, durationMs) => {
        const durationHeader = String(Math.max(1, Math.round(durationMs)));
        const response = await global.fetch(`/api/voice/transcribe?${buildVoiceQaParams(durationMs).toString()}`, {
          method: "POST",
          headers: {
            "Content-Type": blob.type || "audio/webm",
            "X-Voice-Duration-Ms": durationHeader,
          },
          body: blob,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(getTranscriptionFailureMessage(response.status));
        }

        return data;
      };

      const stopRecording = () => {
        if (!recorder) {
          return;
        }

        if (stopTimer) {
          global.clearTimeout?.(stopTimer);
          stopTimer = 0;
        }

        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      const handleRecordingComplete = async (durationMs, fallbackMimeType) => {
        const chunks = recordingChunks.slice();
        recordingChunks = [];
        if (!chunks.length) {
          setStatusText("No voice sample was recorded. Try again.");
          syncAvailability();
          return;
        }

        if (recordButton) {
          recordButton.disabled = true;
          recordButton.textContent = translate("Transcribing...");
        }
        setStatusText("Transcribing...");

        try {
          const blobType = chunks.find((chunk) => helpers.trimText(chunk.type))?.type || fallbackMimeType || "audio/webm";
          const blob = new Blob(chunks, { type: blobType });
          if (!blob.size) {
            throw new Error("No voice sample was recorded. Try again.");
          }
          const result = await transcribeVoiceQaBlob(blob, durationMs);
          const transcript = helpers.trimText(result.text);
          if (!transcript) {
            throw new Error("No speech was detected in that recording.");
          }
          setTranscript(transcript);
          setStatusText("Transcript ready.");
        } catch (error) {
          setStatusText(error.message || "Could not transcribe that recording. Please try again.");
        } finally {
          if (recordButton) {
            recordButton.textContent = translate("Record sample");
          }
          syncAvailability();
        }
      };

      const startRecording = async () => {
        const unavailableMessage = getUnavailableMessage();
        if (unavailableMessage) {
          setStatusText(unavailableMessage);
          syncAvailability();
          return;
        }

        try {
          const stream = await global.navigator.mediaDevices.getUserMedia({ audio: true });
          const mimeType = getPreferredMimeType();
          const MediaRecorderCtor = global.MediaRecorder;
          recordingChunks = [];
          recordingStartedAt = Date.now();

          try {
            recorder = mimeType
              ? new MediaRecorderCtor(stream, { mimeType })
              : new MediaRecorderCtor(stream);
          } catch (error) {
            stream.getTracks?.().forEach((track) => track.stop?.());
            throw error;
          }

          recorder.addEventListener("dataavailable", (event) => {
            if (event.data?.size) {
              recordingChunks.push(event.data);
            }
          });
          recorder.addEventListener("stop", async () => {
            const stoppedRecorder = recorder;
            const durationMs = Math.max(1, Date.now() - recordingStartedAt);
            const tracks = stoppedRecorder?.stream?.getTracks?.() || stream.getTracks?.() || [];
            tracks.forEach((track) => track.stop?.());
            recorder = null;
            if (stopTimer) {
              global.clearTimeout?.(stopTimer);
              stopTimer = 0;
            }
            await handleRecordingComplete(durationMs, mimeType || stoppedRecorder?.mimeType || "audio/webm");
          });

          recorder.start();
          if (recordButton) {
            recordButton.textContent = translate("Stop recording");
          }
          setStatusText("Recording...");
          stopTimer = global.setTimeout?.(stopRecording, VOICE_QA_RECORDING_MAX_MS) || 0;
        } catch (_error) {
          recorder = null;
          setStatusText("Voice test unavailable. Allow microphone access and try again.");
          syncAvailability();
        }
      };

      recordButton?.addEventListener("click", () => {
        if (recorder) {
          stopRecording();
          return;
        }

        void startRecording();
      });

      clearButton?.addEventListener("click", () => {
        setTranscript("");
        setStatusText(persistedVoiceEnabled ? "Ready to record." : "Voice input is off. Enable and save voice input before recording.");
      });

      copyButton?.addEventListener("click", async () => {
        const transcript = helpers.trimText(transcriptPreview?.value || "");
        if (!transcript) {
          setStatusText("Record a voice sample before copying a transcript.");
          return;
        }

        try {
          if (global.navigator?.clipboard?.writeText) {
            await global.navigator.clipboard.writeText(transcript);
          } else {
            transcriptPreview?.focus?.();
            transcriptPreview?.select?.();
            global.document?.execCommand?.("copy");
          }
          setStatusText("Transcript copied.");
        } catch (_error) {
          setStatusText("Could not copy the transcript.");
        }
      });

      practiceButton?.addEventListener("click", async () => {
        const transcript = helpers.trimText(transcriptPreview?.value || "");
        if (!transcript || !onUseVoicePracticePrompt) {
          setStatusText("Record a voice sample before using it in Practice.");
          return;
        }

        practiceButton.disabled = true;
        setStatusText("Opening Practice with this transcript...");
        try {
          await onUseVoicePracticePrompt(transcript);
          setStatusText("Transcript sent to Practice.");
        } catch (error) {
          setStatusText(error.message || "Could not open Practice with this transcript.");
          practiceButton.disabled = false;
        }
      });

      setTranscript(transcriptPreview?.value || "");
      syncAvailability();
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
    showFrontDeskSettingsPanel(getActiveFrontDeskSettingsTab(getHelpers(options), getActiveSettingsSection()), { syncHash: false });
    showFullPageSettingsPanel(getActiveFullPageSettingsTab(getHelpers(options)));
    syncFullPageBackgroundControls();
    syncFullPagePreview();
    bindVoiceQaSimulator();

    return {
      getActiveSettingsSection,
      showSettingsSection,
    };
  }

  global.VonzaSettingsShell = {
    buildSettingsPanel,
    buildWorkspacePreferencesPanel,
    buildFrontDeskSettingsForm: function buildFrontDeskSettingsFormForDashboard(options = {}) {
      const helpers = getHelpers(options);
      const productSettings = options.sectionKey || options.settingsSection
        ? { sectionKey: options.sectionKey || options.settingsSection }
        : {};
      return buildFrontDeskSettingsForm(options.agent || {}, options.setup || {}, helpers, productSettings);
    },
    bindSettingsShellEvents,
    SETTINGS_SECTIONS: SETTINGS_SECTIONS.slice(),
  };
})(window);
