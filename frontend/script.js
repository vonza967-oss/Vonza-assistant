const searchParams = new URLSearchParams(window.location.search);
const ROUTE_AGENT_KEY = getRouteAgentKey();
const DISPLAY_MODE = normalizeDisplayMode(
  searchParams.get("mode") || (ROUTE_AGENT_KEY ? "page" : "widget")
);
const EMBEDDED_MODE = searchParams.get("embedded") === "1";
const EMBEDDED_SURFACE = normalizeEmbeddedSurface(searchParams.get("surface"));
const EMBEDDED_SIZE = normalizeEmbeddedSize(searchParams.get("size"));
const EMBEDDED_LAYOUT = normalizeEmbeddedLayout(searchParams.get("layout"));
const EMBEDDED_VARIANT = normalizeEmbeddedVariant(searchParams.get("variant"));
const SHOW_EMBED_TITLE = normalizeShowEmbedTitle(searchParams.get("show_title"));
const STORED_AGENT_KEY = window.localStorage.getItem("vonza_agent_key") || "";
const INSTALL_ID =
  searchParams.get("install_id") ||
  window.VonzaWidgetConfig?.installId ||
  "";
const AGENT_ID =
  searchParams.get("agent_id") ||
  window.VonzaWidgetConfig?.agentId ||
  "";
const AGENT_KEY =
  searchParams.get("agent_key") ||
  ROUTE_AGENT_KEY ||
  STORED_AGENT_KEY ||
  window.VonzaWidgetConfig?.agentKey ||
  "";
const BUSINESS_ID =
  searchParams.get("business_id") ||
  window.VonzaWidgetConfig?.businessId ||
  "";
const WEBSITE_URL =
  searchParams.get("website_url") ||
  window.VonzaWidgetConfig?.websiteUrl ||
  "";
const PAGE_ORIGIN =
  searchParams.get("origin") ||
  window.VonzaWidgetConfig?.origin ||
  "";
const PAGE_URL =
  searchParams.get("page_url") ||
  window.VonzaWidgetConfig?.pageUrl ||
  "";
const EMBED_SESSION_ID =
  searchParams.get("session_id") ||
  window.VonzaWidgetConfig?.sessionId ||
  "";
const EMBED_FINGERPRINT =
  searchParams.get("fingerprint") ||
  window.VonzaWidgetConfig?.fingerprint ||
  "";

const LEGACY_WIDGET_DEFAULTS = {
  welcomeMessage: "How may I be of your service today?",
  launcherText: "YOUR PERSONAL ASSISTANT",
  primaryColor: "#10a37f",
  secondaryColor: "#0c7f75",
};

const DEFAULT_WIDGET_CONFIG = {
  assistantName: "Vonza AI",
  welcomeMessage: "Hi! How can we help today?",
  buttonLabel: "Chat with Vonza",
  launcherText: "AI front desk for your website",
  widgetLogoUrl: "",
  primaryColor: "#5b61ff",
  secondaryColor: "#7c4dff",
  themeMode: "dark",
};
const DEFAULT_FULL_PAGE_HEADLINE = "Front Desk";
const DEFAULT_FULL_PAGE_SUBTITLE = "Ask about services, pricing, quotes, or contact details.";
const FULL_PAGE_DESIGN_PRESETS = Object.freeze([
  "clean-light",
  "dark-professional",
  "warm-minimal",
  "bold-gradient",
  "image-hero",
  "video-hero",
]);
const FULL_PAGE_BACKGROUND_TYPES = Object.freeze(["color", "gradient", "image", "video"]);
const FULL_PAGE_FOCAL_POINTS = Object.freeze(["center", "top", "left", "right"]);
const FULL_PAGE_TEXT_THEMES = Object.freeze(["dark", "light"]);
const FULL_PAGE_COMPOSER_STYLES = Object.freeze(["soft", "elevated", "minimal"]);
const FULL_PAGE_CHIP_STYLES = Object.freeze(["outline", "soft", "subtle-fill"]);
const FULL_PAGE_STATUS_STYLES = Object.freeze(["subtle", "pill", "minimal"]);
const DEFAULT_FULL_PAGE_DESIGN = Object.freeze({
  preset: "clean-light",
  backgroundType: "color",
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
  disableVideoOnMobile: true,
});

const WIDGET_PHASES = Object.freeze({
  ENTRY: "entry",
  CHAT: "chat",
});
const QUICK_REPLY_TOPICS = Object.freeze([
  "Services",
  "Pricing",
  "Request a quote",
  "Contact details",
  "Booking",
]);
const PAGE_QUICK_REPLY_TOPICS = Object.freeze([
  "I'd like to request a quote.",
  "How much does it cost?",
  "What services do you offer?",
  "How can I contact you?",
]);
const EMBEDDED_QUICK_REPLY_LABELS = Object.freeze({
  services: "Services",
  pricing: "Pricing",
  quote: "Request a quote",
  contact: "Contact details",
  booking: "Booking",
});
const EMBEDDED_DEFAULT_QUICK_REPLIES = Object.freeze([
  { label: "Services", prompt: "What services do you offer?", type: "services" },
  { label: "Pricing", prompt: "How much does it cost?", type: "pricing" },
  { label: "Request a quote", prompt: "I'd like to request a quote.", type: "quote" },
  { label: "Contact details", prompt: "How can I contact you?", type: "contact" },
]);
const PAGE_ACTION_CARDS = Object.freeze([
  {
    label: "Ask about services",
    prompt: "What services do you offer?",
    copy: "Get a quick overview of what this business can help with.",
    description: "Get a quick overview of what this business can help with.",
    type: "services",
    enabled: true,
  },
  {
    label: "Ask about pricing",
    prompt: "How much does it cost?",
    copy: "Ask what affects price, scope, and the next step.",
    description: "Ask what affects price, scope, and the next step.",
    type: "pricing",
    enabled: true,
  },
  {
    label: "Request a quote",
    prompt: "I'd like to request a quote.",
    copy: "Share what you need so the business can follow up with the right details.",
    description: "Share what you need so the business can follow up with the right details.",
    type: "quote",
    enabled: true,
  },
  {
    label: "Contact details",
    prompt: "How can I contact you?",
    copy: "Find the best way to reach the team or leave your details.",
    description: "Find the best way to reach the team or leave your details.",
    type: "contact",
    enabled: true,
  },
  {
    label: "Book a time",
    prompt: "I'd like to book a time.",
    copy: "Ask about appointments, calls, visits, or the best next step.",
    description: "Ask about appointments, calls, visits, or the best next step.",
    type: "booking",
    enabled: true,
    requiresBooking: true,
  },
]);
const PAGE_TRUST_ITEMS = Object.freeze([
  "Replies instantly",
  "AI assistant",
  "Leave your details if needed",
]);

const conversationHistory = [];
let widgetConfig = { ...DEFAULT_WIDGET_CONFIG };
let resolvedAgentId = AGENT_ID;
let resolvedAgentKey = AGENT_KEY;
let resolvedBusinessId = BUSINESS_ID;
let liveLeadCapture = null;
let liveDirectRouting = null;
let pageBusinessContext = null;
let visitorIdentity = {
  mode: "",
  email: "",
  name: "",
};
let lastLeadReferenceMessage = "";
let quickRepliesDismissed = false;
const sentTelemetryKeys = new Set();
const leadCapturePromptShownKeys = new Set();
const submittedReplyFeedbackKeys = new Set();
const OUTCOME_DETECTION_STORAGE_PREFIX = "vonza_detected_outcome_";
const VISITOR_IDENTITY_STORAGE_PREFIX = "vonza_visitor_identity_";
const VISITOR_IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let widgetPhase = WIDGET_PHASES.ENTRY;
let embeddedHeightFrame = 0;

function normalizeDisplayMode(value) {
  return trimText(value).toLowerCase() === "page" ? "page" : "widget";
}

function normalizeEmbeddedSurface(value) {
  const normalized = trimText(value).toLowerCase();
  return ["card", "flat", "transparent"].includes(normalized) ? normalized : "card";
}

function normalizeEmbeddedSize(value) {
  const normalized = trimText(value).toLowerCase();
  return ["compact", "standard", "tall", "full"].includes(normalized) ? normalized : "standard";
}

function normalizeEmbeddedLayout(value) {
  const normalized = trimText(value).toLowerCase();
  return ["canvas", "split"].includes(normalized) ? normalized : "chat";
}

function normalizeEmbeddedVariant(value) {
  return trimText(value).toLowerCase() === "smart" ? "smart" : "iframe";
}

function normalizeShowEmbedTitle(value) {
  const normalized = trimText(value).toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
}

function getRouteAgentKey() {
  const match = window.location.pathname.match(/^\/(?:a|assistant)\/([^/?#]+)/);

  if (!match?.[1]) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isPageMode() {
  return DISPLAY_MODE === "page";
}

function isFullEmbeddedPageMode() {
  return isPageMode() && EMBEDDED_MODE && EMBEDDED_SIZE === "full";
}

function isSmartEmbeddedPageMode() {
  return isPageMode() && EMBEDDED_MODE && EMBEDDED_VARIANT === "smart";
}

function isCanvasEmbeddedPageMode() {
  return isFullEmbeddedPageMode() && EMBEDDED_LAYOUT === "canvas";
}

function shouldShowPageTitle() {
  return !isCanvasEmbeddedPageMode() || SHOW_EMBED_TITLE;
}

function getWidgetStorageScope() {
  return (
    trimText(INSTALL_ID)
    || trimText(resolvedAgentId)
    || trimText(resolvedAgentKey)
    || trimText(resolvedBusinessId)
    || trimText(WEBSITE_URL)
    || "default"
  );
}

function getVisitorSessionStorageKey() {
  return `vonza_visitor_session_${getWidgetStorageScope()}`;
}

function getVisitorIdentityStorageKey() {
  return `${VISITOR_IDENTITY_STORAGE_PREFIX}${getWidgetStorageScope()}`;
}

function getVisitorSessionKey() {
  const storageKey = getVisitorSessionStorageKey();
  let sessionKey = window.localStorage.getItem(storageKey);

  if (!sessionKey) {
    sessionKey = EMBED_SESSION_ID || window.crypto?.randomUUID?.() || `visitor_${Date.now()}`;
    window.localStorage.setItem(storageKey, sessionKey);
  }

  return sessionKey;
}

function trimText(value) {
  return String(value || "").trim();
}

function normalizeHexColor(value) {
  return trimText(value).toLowerCase();
}

function normalizeEmail(value) {
  const cleaned = trimText(value).toLowerCase();
  const match = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function normalizeVisitorIdentityMode(value) {
  const normalized = trimText(value).toLowerCase();
  return ["guest", "identified"].includes(normalized) ? normalized : "";
}

function normalizeVisitorIdentityState(input = {}) {
  const modeCandidate = normalizeVisitorIdentityMode(
    input.mode || input.visitorMode || input.visitor_mode
  );
  const email = normalizeEmail(input.email || input.visitorEmail || input.visitor_email);
  const name = trimText(input.name || input.visitorName || input.visitor_name);
  const mode = modeCandidate;

  if (mode === "guest") {
    return {
      mode: "guest",
      email: "",
      name: "",
    };
  }

  if (mode === "identified" && email) {
    return {
      mode: "identified",
      email,
      name,
    };
  }

  return {
    mode: "",
    email: "",
    name: "",
  };
}

function getStoredIdentityExpiry() {
  return Date.now() + VISITOR_IDENTITY_TTL_MS;
}

function hasChosenVisitorIdentity() {
  return Boolean(normalizeVisitorIdentityMode(visitorIdentity.mode));
}

function buildVisitorIdentityPayload(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  return {
    visitor_identity: normalized,
    visitor_identity_mode: normalized.mode || "",
    visitor_email: normalized.email || "",
    visitor_name: normalized.name || "",
  };
}

function buildAssistantMessageKey(reply, index = conversationHistory.length) {
  const normalized = trimText(reply).toLowerCase();
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }

  return `${getVisitorSessionKey()}::${index}::${Math.abs(hash)}`;
}

function saveVisitorIdentity(identity) {
  const normalized = normalizeVisitorIdentityState(identity);

  try {
    if (!normalized.mode) {
      window.localStorage.removeItem(getVisitorIdentityStorageKey());
      return normalized;
    }

    window.localStorage.setItem(getVisitorIdentityStorageKey(), JSON.stringify({
      ...normalized,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(getStoredIdentityExpiry()).toISOString(),
    }));
  } catch {}

  return normalized;
}

function loadStoredVisitorIdentity() {
  try {
    const value = window.localStorage.getItem(getVisitorIdentityStorageKey());
    const parsed = value ? JSON.parse(value) : null;
    const expiresAt = parsed?.expiresAt || parsed?.expires_at;

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(getVisitorIdentityStorageKey());
      return normalizeVisitorIdentityState();
    }

    return normalizeVisitorIdentityState(parsed || {});
  } catch {
    return normalizeVisitorIdentityState();
  }
}

function clearVisitorIdentity() {
  try {
    window.localStorage.removeItem(getVisitorIdentityStorageKey());
  } catch {}

  if (isPageMode()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
    setComposerStatus("You're asking as a guest. Leave contact details only if follow-up is needed.");
    getPageIdentityEmailForm()?.setAttribute("hidden", "");
    return visitorIdentity;
  }

  visitorIdentity = normalizeVisitorIdentityState();
  syncWidgetPhaseWithIdentity(visitorIdentity);
  setComposerStatus("Choose email or guest to start a fresh visitor identity.");
  return visitorIdentity;
}

function addToHistory(role, content) {
  conversationHistory.push({ role, content });

  if (conversationHistory.length > 12) {
    conversationHistory.splice(0, conversationHistory.length - 12);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMessageParagraph(lines) {
  const content = lines
    .map((line) => escapeHtml(line))
    .join("<br>");

  return content ? `<p>${content}</p>` : "";
}

function formatAssistantMessageHtml(text) {
  const normalized = String(text || "").replace(/\r/g, "").trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      const parts = [];
      let paragraphLines = [];
      let bulletItems = [];

      const flushParagraph = () => {
        if (paragraphLines.length) {
          parts.push(formatMessageParagraph(paragraphLines));
          paragraphLines = [];
        }
      };

      const flushBullets = () => {
        if (bulletItems.length) {
          parts.push(`<ul>${bulletItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
          bulletItems = [];
        }
      };

      lines.forEach((line) => {
        const bulletMatch = line.match(/^\s*-\s+(.+)$/);

        if (bulletMatch) {
          flushParagraph();
          bulletItems.push(bulletMatch[1]);
          return;
        }

        flushBullets();
        if (trimText(line)) {
          paragraphLines.push(line);
        }
      });

      flushParagraph();
      flushBullets();
      return parts.join("");
    })
    .filter(Boolean)
    .join("");
}

function getAssistantMark(name = widgetConfig.assistantName) {
  return (name || "V").trim().charAt(0).toUpperCase() || "V";
}

function isDefaultWelcomeMessage(message) {
  const normalized = trimText(message);
  return !normalized || normalized === DEFAULT_WIDGET_CONFIG.welcomeMessage;
}

function normalizeBoolean(value, fallbackValue = false) {
  if (typeof value === "boolean") {
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

function normalizeFullPageAccentColor(value, fallbackValue = "") {
  const normalized = trimText(value).toLowerCase();

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

  return /^#[0-9a-f]{6}$/i.test(trimText(fallbackValue)) ? trimText(fallbackValue) : "";
}

function normalizeFullPageDesignEnum(value, allowedValues, fallbackValue) {
  const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
  return allowedValues.includes(normalized) ? normalized : fallbackValue;
}

function normalizeFullPageDesignNumber(value, fallbackValue, minValue, maxValue, precision = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallbackValue;
  }

  const clamped = Math.max(minValue, Math.min(maxValue, number));
  const multiplier = 10 ** precision;
  return Math.round(clamped * multiplier) / multiplier;
}

function normalizeFullPageMediaUrl(value, allowedExtensions = []) {
  const normalized = trimText(value);

  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized, window.location.origin);
    if (!["https:", "http:"].includes(url.protocol)) {
      return "";
    }

    const pathname = url.pathname.toLowerCase();
    if (allowedExtensions.length && !allowedExtensions.some((extension) => pathname.endsWith(`.${extension}`))) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function getFullPageDesignPresetDefaults(presetValue) {
  const preset = normalizeFullPageDesignEnum(presetValue, FULL_PAGE_DESIGN_PRESETS, DEFAULT_FULL_PAGE_DESIGN.preset);
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

function normalizeFullPageDesignConfig(rawDesign = {}) {
  const design = rawDesign && typeof rawDesign === "object" && !Array.isArray(rawDesign)
    ? rawDesign
    : {};
  const presetDefaults = getFullPageDesignPresetDefaults(design.preset);
  const backgroundType = normalizeFullPageDesignEnum(
    design.backgroundType || design.background_type,
    FULL_PAGE_BACKGROUND_TYPES,
    presetDefaults.backgroundType
  );

  return {
    preset: presetDefaults.preset,
    backgroundType,
    backgroundColor: normalizeFullPageAccentColor(design.backgroundColor || design.background_color, presetDefaults.backgroundColor),
    backgroundGradientTo: normalizeFullPageAccentColor(design.backgroundGradientTo || design.background_gradient_to, presetDefaults.backgroundGradientTo),
    backgroundImageUrl: normalizeFullPageMediaUrl(design.backgroundImageUrl || design.background_image_url, ["png", "jpg", "jpeg", "webp"]),
    backgroundVideoUrl: normalizeFullPageMediaUrl(design.backgroundVideoUrl || design.background_video_url, ["mp4", "webm"]),
    backgroundOverlayColor: normalizeFullPageAccentColor(design.backgroundOverlayColor || design.background_overlay_color, presetDefaults.backgroundOverlayColor),
    backgroundOverlayOpacity: normalizeFullPageDesignNumber(design.backgroundOverlayOpacity ?? design.background_overlay_opacity, presetDefaults.backgroundOverlayOpacity, 0, 0.92, 2),
    backgroundBlur: normalizeFullPageDesignNumber(design.backgroundBlur ?? design.background_blur, presetDefaults.backgroundBlur, 0, 18),
    backgroundFocalPoint: normalizeFullPageDesignEnum(design.backgroundFocalPoint || design.background_focal_point, FULL_PAGE_FOCAL_POINTS, presetDefaults.backgroundFocalPoint),
    textTheme: normalizeFullPageDesignEnum(design.textTheme || design.text_theme, FULL_PAGE_TEXT_THEMES, presetDefaults.textTheme),
    composerStyle: normalizeFullPageDesignEnum(design.composerStyle || design.composer_style, FULL_PAGE_COMPOSER_STYLES, presetDefaults.composerStyle),
    chipStyle: normalizeFullPageDesignEnum(design.chipStyle || design.chip_style, FULL_PAGE_CHIP_STYLES, presetDefaults.chipStyle),
    statusStyle: normalizeFullPageDesignEnum(design.statusStyle || design.status_style, FULL_PAGE_STATUS_STYLES, presetDefaults.statusStyle),
    disableVideoOnMobile: normalizeBoolean(design.disableVideoOnMobile ?? design.disable_video_on_mobile, presetDefaults.disableVideoOnMobile),
  };
}

function normalizeLimitedText(value, maxLength) {
  return trimText(value).slice(0, maxLength);
}

function compactEmbeddedPromptLabel(value = "", fallbackType = "") {
  const normalizedType = trimText(fallbackType).toLowerCase();
  if (EMBEDDED_QUICK_REPLY_LABELS[normalizedType]) {
    return EMBEDDED_QUICK_REPLY_LABELS[normalizedType];
  }

  const text = trimText(value);
  const lower = text.toLowerCase();

  if (/\b(service|offer|do you do|help with)\b/.test(lower)) {
    return EMBEDDED_QUICK_REPLY_LABELS.services;
  }

  if (/\b(price|pricing|cost|rate|fee|charge)\b/.test(lower)) {
    return EMBEDDED_QUICK_REPLY_LABELS.pricing;
  }

  if (/\b(quote|estimate|proposal)\b/.test(lower)) {
    return EMBEDDED_QUICK_REPLY_LABELS.quote;
  }

  if (/\b(contact|email|phone|call|reach|get in touch)\b/.test(lower)) {
    return EMBEDDED_QUICK_REPLY_LABELS.contact;
  }

  if (/\b(book|booking|appointment|schedule)\b/.test(lower)) {
    return EMBEDDED_QUICK_REPLY_LABELS.booking;
  }

  return normalizeLimitedText(text, 24);
}

function getRawFullPageConfig(config = widgetConfig) {
  const rawConfig = config.fullPageConfig || config.full_page_config || {};
  return rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) ? rawConfig : {};
}

function getDefaultPageActionCards(config = widgetConfig) {
  const bookingEnabled = hasBookingSupport(config);
  return PAGE_ACTION_CARDS.filter((card) => !card.requiresBooking || bookingEnabled)
    .map((card) => ({ ...card }));
}

function normalizePageActionCard(card = {}, fallbackCard = {}) {
  const label = normalizeLimitedText(card.label || fallbackCard.label, 40);
  const prompt = normalizeLimitedText(card.prompt || fallbackCard.prompt, 200);

  if (!label || !prompt) {
    return null;
  }

  return {
    label,
    description: normalizeLimitedText(card.description || card.copy || fallbackCard.description || fallbackCard.copy, 120),
    prompt,
    type: normalizeLimitedText(card.type || fallbackCard.type || "custom", 24).toLowerCase() || "custom",
    enabled: normalizeBoolean(card.enabled, fallbackCard.enabled !== false),
  };
}

function getFullPageConfig(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  const defaults = getDefaultPageActionCards(config);
  const rawCards = Array.isArray(rawConfig.actionCards)
    ? rawConfig.actionCards
    : Array.isArray(rawConfig.action_cards)
      ? rawConfig.action_cards
      : defaults;
  const suggestedQuestions = (Array.isArray(rawConfig.suggestedQuestions)
    ? rawConfig.suggestedQuestions
    : Array.isArray(rawConfig.suggested_questions)
      ? rawConfig.suggested_questions
      : []
  ).map((question) => normalizeLimitedText(question, 120)).filter(Boolean).slice(0, 5);
  const trustItems = (Array.isArray(rawConfig.trustItems)
    ? rawConfig.trustItems
    : Array.isArray(rawConfig.trust_items)
      ? rawConfig.trust_items
      : PAGE_TRUST_ITEMS
  ).map((item) => normalizeLimitedText(item, 60)).filter(Boolean).slice(0, 3);
  const bookingSupported = hasBookingSupport(config);

  return {
    headline: normalizeLimitedText(rawConfig.headline, 80),
    subtitle: normalizeLimitedText(rawConfig.subtitle, 180),
    actionCards: rawCards
      .slice(0, 6)
      .map((card, index) => normalizePageActionCard(card, defaults[index] || {}))
      .filter(Boolean),
    suggestedQuestions,
    accentColor: normalizeFullPageAccentColor(rawConfig.accentColor || rawConfig.accent_color, config.primaryColor),
    logoUrl: trimText(rawConfig.logoUrl || rawConfig.logo_url || config.widgetLogoUrl),
    showBooking: bookingSupported && normalizeBoolean(rawConfig.showBooking ?? rawConfig.show_booking, bookingSupported),
    showQuote: normalizeBoolean(rawConfig.showQuote ?? rawConfig.show_quote, true),
    showContact: normalizeBoolean(rawConfig.showContact ?? rawConfig.show_contact, true),
    trustItems: trustItems.length ? trustItems : [...PAGE_TRUST_ITEMS],
    design: normalizeFullPageDesignConfig(rawConfig.design),
  };
}

function hasCustomFullPageSubtitle(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  const rawSubtitle = normalizeLimitedText(rawConfig.subtitle, 180);
  return Boolean(rawSubtitle && rawSubtitle !== DEFAULT_FULL_PAGE_SUBTITLE);
}

function hasConfiguredFullPageActionCards(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  return Array.isArray(rawConfig.actionCards) || Array.isArray(rawConfig.action_cards);
}

function getConfiguredQuickReplies(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const limit = EMBEDDED_MODE ? 4 : 5;
  const candidates = [
    ...(isPageMode() ? [fullPageConfig.suggestedQuestions] : []),
    config.suggestedQuestions,
    config.suggested_questions,
    config.quickReplies,
    config.quick_replies,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const values = [...new Set(candidate.map((entry) => trimText(entry)).filter(Boolean))];
      if (values.length) {
        return values.slice(0, limit);
      }
    }

    if (typeof candidate === "string") {
      const values = [...new Set(candidate
        .split(/\n|,/)
        .map((entry) => trimText(entry))
        .filter(Boolean))];
      if (values.length) {
        return values.slice(0, limit);
      }
    }
  }

  return [];
}

function dedupeQuickReplyItems(items = [], limit = 4) {
  const seenPrompts = new Set();
  const seenLabels = new Set();
  const results = [];

  items.forEach((item) => {
    const prompt = normalizeLimitedText(item?.prompt || item?.label, 200);
    const label = normalizeLimitedText(item?.label || prompt, 40);
    const promptKey = prompt.toLowerCase();
    const labelKey = label.toLowerCase();

    if (!prompt || !label || seenPrompts.has(promptKey) || seenLabels.has(labelKey)) {
      return;
    }

    seenPrompts.add(promptKey);
    seenLabels.add(labelKey);
    results.push({
      label,
      prompt,
      type: normalizeLimitedText(item?.type || "", 24),
    });
  });

  return results.slice(0, limit);
}

function getCanvasQuickReplyLabel(card = {}, hasCustomActionCards = false) {
  const configuredLabel = normalizeLimitedText(card.label, 40);

  if (hasCustomActionCards && configuredLabel && !/^ask about\s+/i.test(configuredLabel)) {
    return configuredLabel;
  }

  return compactEmbeddedPromptLabel(card.prompt || configuredLabel, card.type);
}

function getEmbeddedQuickReplyItems(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const hasCustomActionCards = hasConfiguredFullPageActionCards(config);
  const configuredQuestions = Array.isArray(fullPageConfig.suggestedQuestions)
    ? fullPageConfig.suggestedQuestions
    : [];
  const configuredItems = configuredQuestions.map((question) => ({
    label: compactEmbeddedPromptLabel(question),
    prompt: question,
  }));
  const actionItems = getPageActionCards(config).map((card) => ({
    label: isCanvasEmbeddedPageMode()
      ? getCanvasQuickReplyLabel(card, hasCustomActionCards)
      : hasCustomActionCards
        ? normalizeLimitedText(card.label, 40)
        : compactEmbeddedPromptLabel(card.prompt || card.label, card.type),
    prompt: card.prompt,
    type: card.type,
  }));
  const fallbackItems = EMBEDDED_DEFAULT_QUICK_REPLIES.filter((item) => {
    if (item.type === "booking") {
      return hasBookingSupport(config);
    }
    return true;
  });

  return dedupeQuickReplyItems([
    ...configuredItems,
    ...actionItems,
    ...fallbackItems,
  ], 4);
}

function getQuickReplyItems(config = widgetConfig) {
  if (isPageMode() && EMBEDDED_MODE) {
    return getEmbeddedQuickReplyItems(config);
  }

  return getQuickReplyTopics(config).map((topic) => ({
    label: topic,
    prompt: topic,
  }));
}

function hasBookingSupport(config = widgetConfig) {
  return Boolean(
    trimText(config.bookingUrl || config.booking_url)
    || trimText(config.bookingStartUrl || config.booking_start_url)
    || trimText(config.bookingSuccessUrl || config.booking_success_url)
    || trimText(config.primaryCtaMode || config.primary_cta_mode).toLowerCase() === "booking"
    || trimText(config.fallbackCtaMode || config.fallback_cta_mode).toLowerCase() === "booking"
  );
}

function getPageActionCards(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const cards = fullPageConfig.actionCards.length
    ? fullPageConfig.actionCards
    : getDefaultPageActionCards(config);

  return cards.filter((card) => {
    if (card.enabled === false) {
      return false;
    }

    if (card.type === "booking") {
      return fullPageConfig.showBooking && hasBookingSupport(config);
    }

    if (card.type === "quote") {
      return fullPageConfig.showQuote;
    }

    if (card.type === "contact") {
      return fullPageConfig.showContact;
    }

    return true;
  });
}

function getQuickReplyTopics(config = widgetConfig) {
  const configured = getConfiguredQuickReplies(config);

  if (configured.length) {
    return configured;
  }

  if (isPageMode()) {
    const topics = [...new Set(getPageActionCards(config).map((card) => card.prompt).filter(Boolean))];
    const fallbackTopics = [...new Set(PAGE_QUICK_REPLY_TOPICS)];
    return (topics.length ? topics : fallbackTopics).slice(0, EMBEDDED_MODE ? 4 : PAGE_QUICK_REPLY_TOPICS.length);
  }

  return QUICK_REPLY_TOPICS;
}

function getBusinessDisplayName(business = null, config = widgetConfig) {
  const configuredBusinessName = trimText(
    business?.name
    || business?.businessName
    || config.businessName
    || config.business_name
  );
  const assistantName = trimText(config.assistantName);

  if (configuredBusinessName) {
    return configuredBusinessName;
  }

  if (assistantName && (config._hasExplicitAssistantName || !isPageMode())) {
    return assistantName;
  }

  return isPageMode() ? "Assistant" : DEFAULT_WIDGET_CONFIG.assistantName;
}

function getBusinessDomainLabel(business = null) {
  const websiteUrl = trimText(
    business?.websiteUrl
    || business?.website_url
    || WEBSITE_URL
  );

  if (!websiteUrl) {
    return "";
  }

  try {
    return new URL(websiteUrl).hostname.replace(/^www\./i, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  }
}

function getPageWelcomeMessage({ business = null, config = widgetConfig } = {}) {
  const configuredWelcome = trimText(config.welcomeMessage);

  if (!isPageMode() || !isDefaultWelcomeMessage(configuredWelcome)) {
    return configuredWelcome || DEFAULT_WIDGET_CONFIG.welcomeMessage;
  }

  const businessName = trimText(
    business?.name
    || business?.businessName
    || config.businessName
    || config.business_name
  );

  if (businessName) {
    return `Hi, I can help with ${businessName}'s services, pricing, quotes, and contact details. What would you like to know?`;
  }

  return "Hi, I can help with services, pricing, quotes, and contact details. What would you like to know?";
}

function hasAssistantConfig() {
  return Boolean(INSTALL_ID || resolvedAgentId || resolvedAgentKey || resolvedBusinessId || WEBSITE_URL);
}

function normalizeWidgetConfig(input = {}) {
  const explicitAssistantName = trimText(input.assistantName || input.assistant_name);
  const hasExplicitAssistantName = Boolean(
    explicitAssistantName
    && explicitAssistantName !== DEFAULT_WIDGET_CONFIG.assistantName
  );
  const rawInputFullPageConfig =
    input.fullPageConfig && typeof input.fullPageConfig === "object" && !Array.isArray(input.fullPageConfig)
      ? input.fullPageConfig
      : input.full_page_config && typeof input.full_page_config === "object" && !Array.isArray(input.full_page_config)
        ? input.full_page_config
        : {};
  const next = {
    ...DEFAULT_WIDGET_CONFIG,
    ...input,
    _hasExplicitAssistantName: hasExplicitAssistantName,
    _configuredFullPageAccentColor: normalizeFullPageAccentColor(
      rawInputFullPageConfig.accentColor || rawInputFullPageConfig.accent_color
    ),
  };
  next.fullPageConfig = getFullPageConfig(next);
  const primaryColor = normalizeHexColor(next.primaryColor);
  const secondaryColor = normalizeHexColor(next.secondaryColor);
  const hasLegacyColors =
    primaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.primaryColor)
    && secondaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.secondaryColor);

  if (hasLegacyColors || (!primaryColor && !secondaryColor)) {
    next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
    next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
  } else {
    if (!primaryColor) {
      next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
    }

    if (!secondaryColor) {
      next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
    }
  }

  if (!trimText(next.welcomeMessage) || trimText(next.welcomeMessage) === LEGACY_WIDGET_DEFAULTS.welcomeMessage) {
    next.welcomeMessage = DEFAULT_WIDGET_CONFIG.welcomeMessage;
  }

  if (!trimText(next.launcherText) || trimText(next.launcherText) === LEGACY_WIDGET_DEFAULTS.launcherText) {
    next.launcherText = DEFAULT_WIDGET_CONFIG.launcherText;
  }

  return next;
}

function getPageOrigin() {
  return trimText(PAGE_ORIGIN || window.location.origin);
}

function getPageUrl() {
  return trimText(PAGE_URL || window.location.href);
}

function getFingerprint() {
  return trimText(EMBED_FINGERPRINT);
}

function applyDisplayModeClasses() {
  document.documentElement.classList.toggle("vonza-mode-page", isPageMode());
  document.documentElement.classList.toggle("vonza-mode-widget", !isPageMode());
  ["card", "flat", "transparent"].forEach((surface) => {
    document.documentElement.classList.toggle(`embedded-surface-${surface}`, EMBEDDED_MODE && EMBEDDED_SURFACE === surface);
  });
  document.documentElement.classList.toggle("embedded-layout-chat", EMBEDDED_MODE && EMBEDDED_LAYOUT === "chat");
  document.documentElement.classList.toggle("embedded-layout-canvas", EMBEDDED_MODE && EMBEDDED_LAYOUT === "canvas");
  document.documentElement.classList.toggle("embedded-layout-split", EMBEDDED_MODE && EMBEDDED_LAYOUT === "split");
  document.documentElement.classList.toggle("vonza-page-layout-canvas", isCanvasEmbeddedPageMode());
  document.documentElement.classList.toggle("vonza-canvas-title-hidden", isCanvasEmbeddedPageMode() && !SHOW_EMBED_TITLE);
  document.documentElement.classList.toggle("embedded-smart", isSmartEmbeddedPageMode());
  ["compact", "standard", "tall", "full"].forEach((size) => {
    document.documentElement.classList.toggle(`embedded-size-${size}`, EMBEDDED_MODE && EMBEDDED_SIZE === size);
  });
  document.body?.classList.toggle("vonza-mode-page", isPageMode());
  document.body?.classList.toggle("vonza-mode-widget", !isPageMode());
  ["card", "flat", "transparent"].forEach((surface) => {
    document.body?.classList.toggle(`embedded-surface-${surface}`, EMBEDDED_MODE && EMBEDDED_SURFACE === surface);
  });
  document.body?.classList.toggle("embedded-layout-chat", EMBEDDED_MODE && EMBEDDED_LAYOUT === "chat");
  document.body?.classList.toggle("embedded-layout-canvas", EMBEDDED_MODE && EMBEDDED_LAYOUT === "canvas");
  document.body?.classList.toggle("embedded-layout-split", EMBEDDED_MODE && EMBEDDED_LAYOUT === "split");
  document.body?.classList.toggle("vonza-page-layout-canvas", isCanvasEmbeddedPageMode());
  document.body?.classList.toggle("vonza-canvas-title-hidden", isCanvasEmbeddedPageMode() && !SHOW_EMBED_TITLE);
  document.body?.classList.toggle("embedded-smart", isSmartEmbeddedPageMode());
  ["compact", "standard", "tall", "full"].forEach((size) => {
    document.body?.classList.toggle(`embedded-size-${size}`, EMBEDDED_MODE && EMBEDDED_SIZE === size);
  });
}

function getAssistantLoadingState() {
  return document.getElementById("assistant-loading-state");
}

function getAssistantUnavailableState() {
  return document.getElementById("assistant-unavailable-state");
}

function getPageAssistantHero() {
  return document.getElementById("page-assistant-hero");
}

function setPageShellState(state, details = {}) {
  if (!isPageMode()) {
    return;
  }

  const loadingState = getAssistantLoadingState();
  const unavailableState = getAssistantUnavailableState();
  const hero = getPageAssistantHero();
  const chatContainer = document.querySelector(".chat-container");
  const isReady = state === "ready";
  const isLoading = state === "loading";
  const isUnavailable = state === "unavailable";

  if (loadingState) {
    loadingState.hidden = !isLoading;
  }

  if (unavailableState) {
    unavailableState.hidden = !isUnavailable;
  }

  if (hero) {
    hero.hidden = !isReady || (EMBEDDED_MODE && !isFullEmbeddedPageMode());
  }

  if (chatContainer) {
    chatContainer.hidden = !isReady;
  }

  if (isUnavailable) {
    const titleEl = document.getElementById("assistant-unavailable-title");
    const copyEl = document.getElementById("assistant-unavailable-copy");
    if (titleEl) {
      titleEl.textContent = details.title || "Assistant unavailable";
    }
    if (copyEl) {
      copyEl.textContent = details.copy || "This assistant is not available right now. Please contact the business directly.";
    }
  }
}

function getFriendlyUnavailableState(error = null) {
  const statusCode = Number(error?.statusCode || 0);

  if (statusCode === 404) {
    return {
      title: "Assistant unavailable",
      copy: "This assistant is not available right now. Please contact the business directly.",
    };
  }

  if (statusCode === 403) {
    return {
      title: "Assistant unavailable",
      copy: "This assistant is not available right now. Please contact the business directly.",
    };
  }

  if (statusCode === 400) {
    return {
      title: "Assistant unavailable",
      copy: "This assistant is not available right now. Please contact the business directly.",
    };
  }

  return {
    title: "Assistant unavailable",
    copy: "This assistant is not available right now. Please contact the business directly.",
  };
}

function syncPageAssistantHeader({ business = pageBusinessContext, config = widgetConfig } = {}) {
  if (!isPageMode()) {
    return;
  }

  const displayName = getBusinessDisplayName(business, config);
  const assistantName = trimText(config.assistantName) || displayName || DEFAULT_WIDGET_CONFIG.assistantName;
  const assistantDisplayName = config._hasExplicitAssistantName ? assistantName : displayName;
  const domain = getBusinessDomainLabel(business);
  const fullPageConfig = getFullPageConfig(config);
  const customLogoUrl = trimText(fullPageConfig.logoUrl || config.widgetLogoUrl);
  const mark = getAssistantMark(displayName);
  const headline = fullPageConfig.headline || DEFAULT_FULL_PAGE_HEADLINE;
  const hasCanvasSubtitle = isCanvasEmbeddedPageMode() && hasCustomFullPageSubtitle(config);
  const subtitle = isCanvasEmbeddedPageMode()
    ? hasCanvasSubtitle
      ? fullPageConfig.subtitle
      : ""
    : fullPageConfig.subtitle || DEFAULT_FULL_PAGE_SUBTITLE;
  const showPageTitle = shouldShowPageTitle();
  const assistantNameEl = document.getElementById("page-assistant-name");
  const subtitleEl = document.getElementById("page-assistant-subtitle");
  const domainEl = document.getElementById("page-business-domain");
  const helpTitleEl = document.getElementById("page-help-title");
  const pageMark = document.getElementById("page-business-mark");
  const pageLogo = document.getElementById("page-business-logo");
  const pageInitial = document.getElementById("page-business-initial");
  const pageActionList = document.getElementById("page-action-list");
  const pageTrustRow = document.getElementById("page-trust-row");
  const chatAssistantNameEl = document.getElementById("assistant-name");
  const launcherTextEl = document.getElementById("launcher-text");
  const sendButton = document.getElementById("send-button");
  const welcomeAssistantNameEl = document.getElementById("welcome-assistant-name");
  const welcomeBrandSubtitleEl = document.querySelector(".welcome-brand-subtitle");
  const welcomeBadgeEl = document.getElementById("welcome-badge");
  const welcomeTitleEl = document.getElementById("welcome-title");
  const welcomeCopyEl = document.getElementById("welcome-copy");
  const welcomeMessageEl = document.getElementById("welcome-message");
  const brandMark = document.querySelector(".brand-mark");
  const welcomeBrandMark = document.querySelector(".welcome-brand-mark");
  const brandLogo = document.getElementById("brand-mark-logo");
  const welcomeBrandLogo = document.getElementById("welcome-brand-logo");
  const brandInitial = document.getElementById("brand-mark-v");
  const welcomeBrandInitial = document.getElementById("welcome-brand-v");
  const introAvatar = document.getElementById("intro-avatar");

  document.title = displayName;

  if (assistantNameEl) {
    assistantNameEl.textContent = displayName;
  }

  if (subtitleEl) {
    subtitleEl.textContent = subtitle;
    subtitleEl.hidden = !showPageTitle || (isCanvasEmbeddedPageMode() && !hasCanvasSubtitle);
  }

  if (domainEl) {
    domainEl.textContent = domain || "";
    domainEl.hidden = !domain;
  }

  if (helpTitleEl) {
    helpTitleEl.textContent = headline;
    helpTitleEl.hidden = !showPageTitle;
  }

  if (pageMark && pageLogo && pageInitial) {
    applyBrandMark(pageMark, pageLogo, pageInitial, customLogoUrl, mark);
  }

  applyBrandMark(brandMark, brandLogo, brandInitial, customLogoUrl, mark);
  applyBrandMark(welcomeBrandMark, welcomeBrandLogo, welcomeBrandInitial, customLogoUrl, mark);

  if (brandMark) {
    brandMark.setAttribute("aria-label", `${assistantDisplayName} logo`);
  }

  if (introAvatar) {
    introAvatar.textContent = mark;
  }

  if (pageActionList) {
    const showPageActionList = !isSmartEmbeddedPageMode() && !isCanvasEmbeddedPageMode();
    pageActionList.hidden = !showPageActionList;
    pageActionList.innerHTML = showPageActionList ? getPageActionCards(config).map((card) => `
      <button
        class="page-action-card"
        type="button"
        data-page-quick-action="${escapeHtml(card.label)}"
        data-page-starter-prompt="${escapeHtml(card.prompt)}"
      >
        <span class="page-action-label">${escapeHtml(card.label)}</span>
        <span class="page-action-copy">${escapeHtml(card.description || card.copy || "")}</span>
      </button>
    `).join("") : "";
  }

  if (pageTrustRow) {
    if (isCanvasEmbeddedPageMode()) {
      pageTrustRow.innerHTML = `
        <span class="canvas-status-pill">
          <span class="canvas-status-title">AI assistant online</span>
          <span class="canvas-status-instant"><span class="status-dot" aria-hidden="true"></span>Replies instantly</span>
        </span>
      `;
    } else {
      pageTrustRow.innerHTML = fullPageConfig.trustItems
        .slice(0, 3)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join("");
    }
  }

  if (chatAssistantNameEl) {
    chatAssistantNameEl.textContent = assistantDisplayName;
  }

  if (sendButton) {
    sendButton.setAttribute("aria-label", `Send a message to ${assistantDisplayName}`);
    sendButton.setAttribute("title", `Send a message to ${assistantDisplayName}`);
  }

  if (launcherTextEl) {
    launcherTextEl.textContent = "Online now";
  }

  if (welcomeAssistantNameEl) {
    welcomeAssistantNameEl.textContent = assistantDisplayName;
  }

  if (welcomeBrandSubtitleEl) {
    welcomeBrandSubtitleEl.textContent = "Business assistant";
  }

  if (welcomeBadgeEl) {
    welcomeBadgeEl.textContent = "Choose how to continue";
  }

  if (welcomeTitleEl) {
    welcomeTitleEl.textContent = "Start a conversation";
  }

  if (welcomeCopyEl) {
    welcomeCopyEl.textContent = "Continue with email if you may want follow-up, or ask as a guest.";
  }

  if (welcomeMessageEl) {
    welcomeMessageEl.textContent = getPageWelcomeMessage({ business, config });
  }

  const canvasIntroLine = document.getElementById("canvas-intro-line");
  if (canvasIntroLine) {
    canvasIntroLine.textContent = "";
    canvasIntroLine.hidden = true;
  }
}

function getIdentityChoicePanel() {
  return document.getElementById("identity-choice-panel");
}

function getIdentityEmailForm() {
  return document.getElementById("identity-email-form");
}

function getEntryState() {
  return document.getElementById("entry-state");
}

function getChatState() {
  return document.getElementById("chat-state");
}

function getWelcomePanel() {
  return document.getElementById("welcome-panel");
}

function getIntroMessage() {
  return document.getElementById("intro-message");
}

function getComposerShell() {
  return document.getElementById("composer-shell");
}

function getQuickReplies() {
  return document.getElementById("quick-replies");
}

function getPageIdentityInline() {
  return document.getElementById("page-identity-inline");
}

function getPageIdentityEmailForm() {
  return document.getElementById("page-identity-email-form");
}

function syncPageIdentityInline() {
  const inline = getPageIdentityInline();

  if (!inline) {
    return;
  }

  const shouldShow = isPageMode() && widgetPhase === WIDGET_PHASES.CHAT;
  inline.hidden = !shouldShow;

  if (!shouldShow) {
    return;
  }

  const note = document.getElementById("page-identity-note");
  const button = document.getElementById("page-identity-email-button");
  const resetButton = document.getElementById("identity-reset-button");
  const normalized = normalizeVisitorIdentityState(visitorIdentity);

  if (note) {
    if (normalized.mode === "identified" && normalized.email) {
      note.textContent = EMBEDDED_MODE
        ? `Using ${normalized.email}`
        : `Using ${normalized.email} for follow-up if the business needs it.`;
    } else {
      note.textContent = EMBEDDED_MODE
        ? "Asking as guest"
        : "You're asking as a guest. If follow-up is needed, the assistant may ask for your contact details.";
    }
  }

  if (button) {
    button.textContent = normalized.mode === "identified" && normalized.email
      ? "Update contact details"
      : "Leave contact details";
  }

  if (resetButton && EMBEDDED_MODE) {
    resetButton.hidden = !(normalized.mode === "identified" && normalized.email);
  }

  queueEmbeddedHeightUpdate();
}

function isMobilePagePromptMode() {
  return isPageMode()
    && !EMBEDDED_MODE
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 720px)").matches;
}

function shouldShowQuickReplies() {
  if (isPageMode() && !EMBEDDED_MODE && !isMobilePagePromptMode()) {
    return false;
  }

  return widgetPhase === WIDGET_PHASES.CHAT && !quickRepliesDismissed && conversationHistory.length < 2;
}

function renderQuickReplies() {
  const container = getQuickReplies();

  if (!container) {
    return;
  }

  const showReplies = shouldShowQuickReplies();
  container.hidden = !showReplies;

  if (!showReplies) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = getQuickReplyItems().map((item) => `
    <button
      class="quick-reply-chip"
      type="button"
      data-quick-reply="${escapeHtml(item.prompt)}"
    >${escapeHtml(item.label)}</button>
  `).join("");

  queueEmbeddedHeightUpdate();
}

function updateCanvasConversationState() {
  if (!isCanvasEmbeddedPageMode()) {
    document.documentElement.classList.remove("vonza-canvas-empty", "vonza-canvas-active");
    document.body?.classList.remove("vonza-canvas-empty", "vonza-canvas-active");
    return;
  }

  const chat = document.getElementById("chat");
  const hasVisibleThread = Array.from(chat?.children || []).some((child) => {
    const className = String(child.className || "");
    return className.includes("message") && !className.includes("intro") && child.hidden !== true;
  });
  document.documentElement.classList.toggle("vonza-canvas-empty", !hasVisibleThread);
  document.documentElement.classList.toggle("vonza-canvas-active", hasVisibleThread);
  document.body?.classList.toggle("vonza-canvas-empty", !hasVisibleThread);
  document.body?.classList.toggle("vonza-canvas-active", hasVisibleThread);
}

function updateComposerAvailability() {
  const composerShell = getComposerShell();
  const input = document.getElementById("input");
  const button = document.getElementById("send-button");
  const inputArea = document.querySelector(".input-area");
  const chatReady = widgetPhase === WIDGET_PHASES.CHAT;

  if (!composerShell || !input || !button || !inputArea) {
    return;
  }

  composerShell.hidden = !chatReady;
  input.disabled = !chatReady;
  button.disabled = !chatReady;
  input.placeholder = isCanvasEmbeddedPageMode() ? "Ask anything..." : "Type your question...";
  inputArea.classList.toggle("is-locked", !chatReady);
  renderQuickReplies();
}

function normalizeWidgetPhase(value) {
  return value === WIDGET_PHASES.CHAT ? WIDGET_PHASES.CHAT : WIDGET_PHASES.ENTRY;
}

function getWidgetPhaseForIdentity(identity = visitorIdentity) {
  return normalizeVisitorIdentityState(identity).mode
    ? WIDGET_PHASES.CHAT
    : WIDGET_PHASES.ENTRY;
}

function renderWidgetPhase() {
  widgetPhase = normalizeWidgetPhase(widgetPhase);

  const entryState = getEntryState();
  const chatState = getChatState();
  const welcomePanel = getWelcomePanel();
  const identityPanel = getIdentityChoicePanel();
  const emailForm = getIdentityEmailForm();
  const introMessage = getIntroMessage();
  const chatReady = widgetPhase === WIDGET_PHASES.CHAT;

  if (entryState) {
    entryState.hidden = chatReady;
  }

  if (chatState) {
    chatState.hidden = !chatReady;
  }

  if (welcomePanel) {
    welcomePanel.hidden = chatReady;
  }

  if (identityPanel) {
    identityPanel.hidden = chatReady;
  }

  if (introMessage) {
    introMessage.hidden = !chatReady || isCanvasEmbeddedPageMode();
  }

  if (emailForm && chatReady) {
    emailForm.setAttribute("hidden", "");
  }

  updateComposerAvailability();
  syncPageIdentityInline();
  updateCanvasConversationState();
  queueEmbeddedHeightUpdate();
}

function syncWidgetPhaseWithIdentity(identity = visitorIdentity) {
  widgetPhase = getWidgetPhaseForIdentity(identity);
  renderWidgetPhase();
  return widgetPhase;
}

function setVisitorIdentityState(identity, options = {}) {
  const normalized = normalizeVisitorIdentityState(identity);
  visitorIdentity = options.persist === false
    ? normalized
    : saveVisitorIdentity(normalized);

  syncWidgetPhaseWithIdentity(visitorIdentity);
  return visitorIdentity;
}

function continueIntoChat(identity, options = {}) {
  const normalized = setVisitorIdentityState(identity, options);

  if (!normalized.mode) {
    return normalized;
  }

  if (normalized.mode === "identified") {
    setComposerStatus(`Using ${normalized.email} so the business can follow up if needed.`);
  } else {
    setComposerStatus("You're chatting as a guest. Ask anything about the business.");
  }

  if (options.track !== false) {
    void trackWidgetEvent("identity_mode_selected", {
      mode: normalized.mode,
      hasName: Boolean(normalized.name),
    }, {
      dedupeKey: `${INSTALL_ID}::identity_mode_selected::${getVisitorSessionKey()}::${normalized.mode}`,
    });
  }

  if (options.capture !== false) {
    void persistVisitorIdentityChoice(normalized);
  }

  document.getElementById("input")?.focus();
  return normalized;
}

async function persistVisitorIdentityChoice(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  if (!normalized.mode) {
    return null;
  }

  try {
    const response = await fetch("/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: normalized.mode === "guest" ? "choose_guest" : "submit",
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        display_mode: DISPLAY_MODE,
        visitor_session_key: getVisitorSessionKey(),
        reference_message: normalized.mode === "guest"
          ? "Visitor continued as guest."
          : "Visitor continued with email.",
        name: normalized.name,
        email: normalized.email,
        preferred_channel: normalized.mode === "identified" ? "email" : "",
        ...buildVisitorIdentityPayload(normalized),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Visitor identity capture failed");
    }

    liveLeadCapture = data.leadCapture || liveLeadCapture;
    if (data.visitorIdentity) {
      visitorIdentity = normalizeVisitorIdentityState(data.visitorIdentity);
      syncWidgetPhaseWithIdentity(visitorIdentity);
    }

    return liveLeadCapture;
  } catch (error) {
    console.warn("Vonza visitor identity capture failed:", error);
    return null;
  }
}

async function persistIdentifiedVisitorChoice(identity = visitorIdentity) {
  return persistVisitorIdentityChoice(identity);
}
function getDirectRoutingSlot() {
  return document.getElementById("direct-routing-slot");
}

function getDismissedRouteStorageKey() {
  return `${getVisitorSessionStorageKey()}_dismissed_routes`;
}

function getDismissedRouteKeys() {
  try {
    const value = window.localStorage.getItem(getDismissedRouteStorageKey());
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => trimText(entry)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isRouteDismissed(decisionKey) {
  return getDismissedRouteKeys().includes(trimText(decisionKey));
}

function rememberDismissedRoute(decisionKey) {
  const normalized = trimText(decisionKey);

  if (!normalized) {
    return;
  }

  const nextKeys = [...new Set([...getDismissedRouteKeys(), normalized])];
  window.localStorage.setItem(getDismissedRouteStorageKey(), JSON.stringify(nextKeys.slice(-12)));
}

function buildRoutingMetadata(routing, cta) {
  return {
    decisionKey: trimText(routing?.decisionKey || ""),
    ctaType: trimText(cta?.ctaType || ""),
    targetType: trimText(cta?.targetType || ""),
    relatedIntentType: trimText(routing?.intentType || ""),
    relatedActionKey: trimText(routing?.relatedActionKey || liveLeadCapture?.latestActionKey || ""),
    relatedConversationId: trimText(routing?.relatedConversationId || ""),
    relatedPersonKey: trimText(routing?.relatedPersonKey || liveLeadCapture?.personKey || ""),
    leadId: trimText(routing?.relatedLeadId || liveLeadCapture?.id || ""),
    followUpId: trimText(routing?.relatedFollowUpId || liveLeadCapture?.relatedFollowUpId || ""),
    routingMode: trimText(routing?.routingMode || routing?.mode || ""),
    sourceUrl: getPageUrl(),
  };
}

function buildTrackedRedirectUrl(routing, cta) {
  const metadata = buildRoutingMetadata(routing, cta);
  const url = new URL("/install/cta", window.location.origin);

  url.searchParams.set("install_id", INSTALL_ID);
  url.searchParams.set("session_id", getVisitorSessionKey());
  url.searchParams.set("visitor_id", getFingerprint() || getVisitorSessionKey());
  if (getFingerprint()) url.searchParams.set("fingerprint", getFingerprint());
  if (getPageUrl()) url.searchParams.set("page_url", getPageUrl());
  if (getPageOrigin()) url.searchParams.set("origin", getPageOrigin());
  if (trimText(cta?.ctaType)) url.searchParams.set("cta_type", trimText(cta.ctaType));
  if (trimText(cta?.targetType)) url.searchParams.set("target_type", trimText(cta.targetType));
  if (trimText(cta?.href)) url.searchParams.set("target_url", trimText(cta.href));
  if (trimText(cta?.label)) url.searchParams.set("label", trimText(cta.label));
  if (metadata.decisionKey) url.searchParams.set("decision_key", metadata.decisionKey);
  if (metadata.relatedIntentType) url.searchParams.set("related_intent_type", metadata.relatedIntentType);
  if (metadata.relatedActionKey) url.searchParams.set("action_key", metadata.relatedActionKey);
  if (metadata.relatedConversationId) url.searchParams.set("conversation_id", metadata.relatedConversationId);
  if (metadata.relatedPersonKey) url.searchParams.set("person_key", metadata.relatedPersonKey);
  if (metadata.leadId) url.searchParams.set("lead_id", metadata.leadId);
  if (metadata.followUpId) url.searchParams.set("follow_up_id", metadata.followUpId);

  return url.toString();
}

function openRoutingTarget(cta = {}, redirectUrl = "") {
  const href = trimText(redirectUrl || cta.href);

  if (!href) {
    return;
  }

  if (cta.targetType === "phone" || cta.targetType === "email") {
    window.location.href = href;
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
}

function bindDirectRoutingInteractions(slot, routing) {
  const continueButton = slot.querySelector("[data-routing-continue]");
  const ctaButtons = slot.querySelectorAll("[data-routing-cta]");

  ctaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const cta = {
        ctaType: trimText(button.dataset.ctaType),
        targetType: trimText(button.dataset.targetType),
        href: trimText(button.dataset.href),
        targetValue: trimText(button.dataset.targetValue),
      };

      rememberDismissedRoute(routing.decisionKey);
      renderDirectRouting(null);
      setComposerStatus(`Opening ${trimText(button.textContent).toLowerCase()}...`);
      const redirectUrl = buildTrackedRedirectUrl(routing, cta);
      void trackWidgetEvent("cta_clicked", buildRoutingMetadata(routing, cta), {
        dedupeKey: `${INSTALL_ID}::cta_clicked::${trimText(routing.decisionKey)}::${trimText(cta.ctaType)}::${trimText(cta.targetType)}`,
      });
      openRoutingTarget(cta, redirectUrl);
    });
  });

  if (continueButton) {
    continueButton.addEventListener("click", () => {
      rememberDismissedRoute(routing.decisionKey);
      if (trimText(routing.continueButton?.action) === "reveal_capture" && liveLeadCapture?.shouldPrompt) {
        renderLeadCapture(liveLeadCapture, { force: true });
        void trackWidgetEvent("capture_fallback_offered", {
          relatedConversationId: trimText(routing.relatedConversationId || ""),
          relatedIntentType: trimText(routing.intentType || ""),
          relatedActionKey: trimText(routing.relatedActionKey || ""),
        }, {
          dedupeKey: `${INSTALL_ID}::capture_fallback_offered::${trimText(routing.decisionKey || getVisitorSessionKey())}`,
        });
        setComposerStatus("You can share contact details in chat whenever you want.");
        return;
      }

      renderDirectRouting(null);
      setComposerStatus("No problem. We can keep going here.");
    });
  }
}

function getRoutingSuggestionTitle(routing = {}, cta = {}) {
  const intentType = trimText(routing.intentType);
  const label = trimText(cta.label);

  if (intentType === "booking") {
    return "Ready to book?";
  }

  if (intentType === "quote") {
    return "Want to request a quote?";
  }

  if (intentType === "checkout") {
    return "Ready to continue?";
  }

  if (intentType === "contact") {
    return "Want to contact the team?";
  }

  return label ? `Want to ${label.toLowerCase()}?` : "Want the next step?";
}

function renderDirectRouting(routing) {
  const slot = getDirectRoutingSlot();

  if (!slot) {
    return;
  }

  liveDirectRouting = routing && typeof routing === "object" ? routing : null;

  const shouldShow = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (!shouldShow) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  const primaryCta = liveDirectRouting.primaryCta || {};
  const secondaryCtas = Array.isArray(liveDirectRouting.secondaryCtas)
    ? liveDirectRouting.secondaryCtas.filter((entry) => entry && trimText(entry.href))
    : [];

  slot.hidden = false;
  slot.innerHTML = `
    <article class="customer-next-step">
      <h3 class="customer-next-step-title">${escapeHtml(getRoutingSuggestionTitle(liveDirectRouting, primaryCta))}</h3>
      <p class="customer-next-step-copy">I can keep helping here, or you can use this direct option.</p>
      ${trimText(liveDirectRouting.availabilityNote) ? `<p class="customer-next-step-note">${escapeHtml(trimText(liveDirectRouting.availabilityNote))}</p>` : ""}
      <div class="routing-actions">
        <button
          type="button"
          class="routing-primary-button"
          data-routing-cta
          data-cta-type="${escapeHtml(trimText(primaryCta.ctaType))}"
          data-target-type="${escapeHtml(trimText(primaryCta.targetType))}"
          data-href="${escapeHtml(trimText(primaryCta.href))}"
          data-target-value="${escapeHtml(trimText(primaryCta.targetValue))}"
        >${escapeHtml(trimText(primaryCta.label) || "Continue")}</button>
        ${secondaryCtas.map((cta) => `
          <button
            type="button"
            class="ghost-button routing-secondary-button"
            data-routing-cta
            data-cta-type="${escapeHtml(trimText(cta.ctaType))}"
            data-target-type="${escapeHtml(trimText(cta.targetType))}"
            data-href="${escapeHtml(trimText(cta.href))}"
            data-target-value="${escapeHtml(trimText(cta.targetValue))}"
          >${escapeHtml(trimText(cta.label) || "Open")}</button>
        `).join("")}
        <button type="button" class="ghost-button routing-secondary-button" data-routing-continue>${escapeHtml(trimText(liveDirectRouting.continueButton?.label) || "Continue here")}</button>
      </div>
    </article>
  `;

  bindDirectRoutingInteractions(slot, liveDirectRouting);
  void trackWidgetEvent("cta_shown", buildRoutingMetadata(liveDirectRouting, primaryCta), {
    dedupeKey: `${INSTALL_ID}::cta_shown::${trimText(liveDirectRouting.decisionKey)}`,
  });
}

function bindLeadCaptureInteractions(slot, leadCapture) {
  const form = slot.querySelector("[data-lead-capture-form]");
  const declineButton = slot.querySelector("[data-lead-capture-decline]");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await submitLeadCaptureAction("submit", {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        preferred_channel: formData.get("preferred_channel"),
      });
    });
  }

  if (declineButton) {
    declineButton.addEventListener("click", async () => {
      await submitLeadCaptureAction("decline");
    });
  }

  const promptShownKey = trimText(leadCapture?.id) || `${getVisitorSessionKey()}::${trimText(leadCapture?.trigger)}`;
  if (leadCapture?.shouldPrompt && !leadCapturePromptShownKeys.has(promptShownKey)) {
    leadCapturePromptShownKeys.add(promptShownKey);
    void submitLeadCaptureAction("prompt_shown", {}, { silent: true });
  }
}

function renderLeadCapture(leadCapture, options = {}) {
  const slot = getDirectRoutingSlot();
  const chat = document.getElementById("chat");
  liveLeadCapture = leadCapture && typeof leadCapture === "object" ? leadCapture : null;

  if (!slot || !liveLeadCapture) {
    return;
  }

  const state = trimText(liveLeadCapture.state).toLowerCase();
  const directRouteVisible = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (directRouteVisible && options.force !== true) {
    return;
  }

  if (state === "captured") {
    slot.hidden = true;
    slot.innerHTML = "";

    const promptShownKey = `${trimText(liveLeadCapture?.id) || getVisitorSessionKey()}::captured`;
    if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
      leadCapturePromptShownKeys.add(promptShownKey);
      appendMessage(chat, "bot", trimText(liveLeadCapture.message) || "Thanks. I saved those details so the team can follow up.");
    }
    return;
  }

  if (!liveLeadCapture.shouldPrompt) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  slot.hidden = true;
  slot.innerHTML = "";

  const promptShownKey = trimText(liveLeadCapture?.id) || `${getVisitorSessionKey()}::${trimText(liveLeadCapture?.trigger)}`;
  if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
    leadCapturePromptShownKeys.add(promptShownKey);
    appendMessage(chat, "bot", trimText(liveLeadCapture.prompt?.body) || "What is the best email or phone number to use?");
    void submitLeadCaptureAction("prompt_shown", {}, { silent: true });
  }
}

async function submitLeadCaptureAction(action, fields = {}, options = {}) {
  if (!liveLeadCapture || !trimText(action)) {
    return null;
  }

  try {
    const response = await fetch("/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        display_mode: DISPLAY_MODE,
        visitor_session_key: getVisitorSessionKey(),
        reference_message: lastLeadReferenceMessage,
        ...buildVisitorIdentityPayload(),
        ...fields,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Capture request failed");
    }

    if (options.silent === true) {
      return data.leadCapture || null;
    }

    renderLeadCapture(data.leadCapture || null, { force: true });
    if (trimText(data.leadCapture?.message) && trimText(data.leadCapture?.state).toLowerCase() !== "captured") {
      appendMessage(document.getElementById("chat"), "bot", data.leadCapture.message);
    }
    setComposerStatus(
      trimText(data.leadCapture?.state).toLowerCase() === "captured"
        ? "Contact details saved."
        : "No problem. We can keep chatting here."
    );
    return data.leadCapture || null;
  } catch (error) {
    if (options.silent !== true) {
      setComposerStatus("Those contact details could not be saved just now. Try again in a moment.");
    }
    console.warn("Vonza lead capture failed:", error);
    return null;
  }
}

async function trackWidgetEvent(eventName, metadata = {}, options = {}) {
  if (!INSTALL_ID) {
    return;
  }

  const dedupeKey = trimText(options.dedupeKey)
    || `${INSTALL_ID}::${eventName}::${options.scope || getVisitorSessionKey()}`;

  if (sentTelemetryKeys.has(dedupeKey)) {
    return;
  }

  sentTelemetryKeys.add(dedupeKey);

  try {
    await fetch("/install/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        event_name: eventName,
        session_id: getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        origin: getPageOrigin(),
        page_url: getPageUrl(),
        dedupe_key: dedupeKey,
        metadata: {
          ...metadata,
          displayMode: DISPLAY_MODE,
        },
      }),
    });
  } catch (error) {
    console.warn("Vonza widget telemetry failed:", error);
  }
}

function getOutcomeDetectionStorageKey() {
  const pageUrl = getPageUrl();

  if (!pageUrl || !INSTALL_ID) {
    return "";
  }

  try {
    const parsed = new URL(pageUrl);
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${parsed.pathname}::${parsed.search}`;
  } catch {
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${pageUrl}`;
  }
}

async function detectConversionOutcomesOnLoad() {
  const pageUrl = getPageUrl();
  const storageKey = getOutcomeDetectionStorageKey();

  if (!INSTALL_ID || !pageUrl || !storageKey) {
    return;
  }

  if (window.sessionStorage.getItem(storageKey) === "1") {
    return;
  }

  try {
    const parsedPageUrl = new URL(pageUrl);
    const ctaEventId = trimText(parsedPageUrl.searchParams.get("vz_cta_event_id"));
    const response = await fetch("/install/outcomes/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        session_id: getVisitorSessionKey(),
        visitor_id: getFingerprint() || getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        page_url: pageUrl,
        origin: getPageOrigin(),
        cta_event_id: ctaEventId || null,
      }),
    });

    if (response.ok) {
      window.sessionStorage.setItem(storageKey, "1");
    }
  } catch (error) {
    console.warn("Vonza outcome detection failed:", error);
  }
}

function setComposerStatus(message) {
  const statusEl = document.getElementById("composer-status");

  if (statusEl) {
    statusEl.textContent = message;
  }
}

function queueEmbeddedHeightUpdate() {
  if (!EMBEDDED_MODE || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  if (embeddedHeightFrame) {
    window.cancelAnimationFrame?.(embeddedHeightFrame);
  }

  embeddedHeightFrame = window.requestAnimationFrame(() => {
    embeddedHeightFrame = 0;
    postEmbeddedHeightUpdate();
  });
}

function postEmbeddedHeightUpdate() {
  if (!EMBEDDED_MODE || !window.parent || window.parent === window) {
    return;
  }

  const height = Math.ceil(Math.max(
    document.documentElement?.scrollHeight || 0,
    document.body?.scrollHeight || 0,
    document.querySelector(".chat-container")?.scrollHeight || 0
  ));

  if (!height) {
    return;
  }

  window.parent.postMessage({
    type: "vonza:embedded-height",
    source: "vonza-assistant",
    height,
  }, "*");
}

function applyBrandMark(markElement, logoElement, textElement, customLogoUrl, fallbackCharacter) {
  if (!markElement || !logoElement || !textElement) {
    return;
  }

  textElement.textContent = fallbackCharacter;

  if (customLogoUrl) {
    logoElement.src = customLogoUrl;
    logoElement.hidden = false;
    markElement.classList.add("has-custom-logo");
    return;
  }

  logoElement.removeAttribute("src");
  logoElement.hidden = true;
  markElement.classList.remove("has-custom-logo");
}

function setFullPageDesignClass(prefix, value, allowedValues) {
  allowedValues.forEach((token) => {
    document.documentElement.classList.remove(`${prefix}-${token}`);
  });
  document.documentElement.classList.add(`${prefix}-${value}`);
}

function syncFullPageDesignVideo(design) {
  let video = document.getElementById("full-page-design-video-bg");
  const shouldShowVideo =
    isCanvasEmbeddedPageMode()
    && design.backgroundType === "video"
    && design.backgroundVideoUrl;

  if (!shouldShowVideo) {
    video?.remove?.();
    return;
  }

  if (!video) {
    video = document.createElement("video");
    video.id = "full-page-design-video-bg";
    video.className = "full-page-design-video-bg";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    document.body.appendChild(video);
  }

  if (video.src !== design.backgroundVideoUrl) {
    video.src = design.backgroundVideoUrl;
  }

  video.hidden = false;
}

function applyFullPageDesign(config = widgetConfig) {
  const design = getFullPageConfig(config).design;
  const root = document.documentElement;

  if (!isCanvasEmbeddedPageMode()) {
    syncFullPageDesignVideo({ ...DEFAULT_FULL_PAGE_DESIGN, backgroundType: "color" });
    return;
  }

  setFullPageDesignClass("full-page-design-preset", design.preset, FULL_PAGE_DESIGN_PRESETS);
  setFullPageDesignClass("full-page-design-bg", design.backgroundType, FULL_PAGE_BACKGROUND_TYPES);
  setFullPageDesignClass("full-page-design-text", design.textTheme, FULL_PAGE_TEXT_THEMES);
  setFullPageDesignClass("full-page-design-composer", design.composerStyle, FULL_PAGE_COMPOSER_STYLES);
  setFullPageDesignClass("full-page-design-chip", design.chipStyle, FULL_PAGE_CHIP_STYLES);
  setFullPageDesignClass("full-page-design-status", design.statusStyle, FULL_PAGE_STATUS_STYLES);
  root.classList.toggle("full-page-design-disable-mobile-video", design.disableVideoOnMobile);
  root.style.setProperty("--canvas-design-bg", design.backgroundColor);
  root.style.setProperty("--canvas-design-gradient-to", design.backgroundGradientTo);
  root.style.setProperty("--canvas-design-overlay", design.backgroundOverlayColor);
  root.style.setProperty("--canvas-design-overlay-opacity", String(design.backgroundOverlayOpacity));
  root.style.setProperty("--canvas-design-blur", `${design.backgroundBlur}px`);
  root.style.setProperty("--canvas-design-position", design.backgroundFocalPoint);
  root.style.setProperty(
    "--canvas-design-image",
    design.backgroundImageUrl ? `url("${design.backgroundImageUrl.replace(/"/g, "%22")}")` : "none"
  );

  syncFullPageDesignVideo(design);
}

function applyWidgetConfig(config = {}) {
  widgetConfig = normalizeWidgetConfig(config);

  const brandMark = document.querySelector(".brand-mark");
  const welcomeBrandMark = document.querySelector(".welcome-brand-mark");
  const brandLogo = document.getElementById("brand-mark-logo");
  const welcomeBrandLogo = document.getElementById("welcome-brand-logo");
  const fullPageConfig = getFullPageConfig(widgetConfig);
  const configuredPageAccentColor = normalizeFullPageAccentColor(widgetConfig._configuredFullPageAccentColor);
  const customLogoUrl = trimText(isPageMode() ? fullPageConfig.logoUrl || widgetConfig.widgetLogoUrl : widgetConfig.widgetLogoUrl);
  const assistantMark = getAssistantMark(widgetConfig.assistantName);
  const pageAccentColor = isPageMode() ? configuredPageAccentColor || fullPageConfig.accentColor : "";
  const brandPrimary = normalizeFullPageAccentColor(
    pageAccentColor || widgetConfig.primaryColor,
    DEFAULT_WIDGET_CONFIG.primaryColor
  ) || DEFAULT_WIDGET_CONFIG.primaryColor;
  const brandSecondary = isPageMode() && EMBEDDED_MODE && configuredPageAccentColor
    ? brandPrimary
    : normalizeFullPageAccentColor(widgetConfig.secondaryColor, DEFAULT_WIDGET_CONFIG.secondaryColor) || DEFAULT_WIDGET_CONFIG.secondaryColor;
  const sendButton = document.getElementById("send-button");
  const poweredBy = document.getElementById("powered-by");
  const welcomeBadge = document.getElementById("welcome-badge");
  const welcomeTitle = document.getElementById("welcome-title");
  const welcomeCopy = document.getElementById("welcome-copy");

  document.title = widgetConfig.assistantName;
  document.documentElement.style.setProperty("--brand-primary", brandPrimary);
  document.documentElement.style.setProperty("--brand-secondary", brandSecondary);
  document.documentElement.style.setProperty("--canvas-send-color", isCanvasEmbeddedPageMode()
    ? configuredPageAccentColor || "#111827"
    : brandPrimary);
  document.documentElement.style.setProperty("--canvas-accent-color", configuredPageAccentColor || brandPrimary);
  applyFullPageDesign(widgetConfig);
  if (isPageMode()) {
    document.documentElement.style.setProperty("--brand-ink", `color-mix(in srgb, ${brandPrimary} 72%, #14201f 28%)`);
    document.documentElement.style.setProperty("--brand-surface", `color-mix(in srgb, ${brandPrimary} 9%, #ffffff 91%)`);
    document.documentElement.style.setProperty("--brand-surface-strong", `color-mix(in srgb, ${brandPrimary} 16%, #ffffff 84%)`);
  }
  document.getElementById("assistant-name").textContent = widgetConfig.assistantName;
  document.getElementById("welcome-assistant-name").textContent = widgetConfig.assistantName;
  document.getElementById("launcher-text").textContent = widgetConfig.launcherText;
  document.getElementById("welcome-message").textContent = widgetConfig.welcomeMessage;
  document.getElementById("intro-avatar").textContent = assistantMark;
  applyBrandMark(
    brandMark,
    brandLogo,
    document.getElementById("brand-mark-v"),
    customLogoUrl,
    assistantMark
  );
  applyBrandMark(
    welcomeBrandMark,
    welcomeBrandLogo,
    document.getElementById("welcome-brand-v"),
    customLogoUrl,
    assistantMark
  );
  if (sendButton) {
    sendButton.setAttribute("aria-label", `Send a message to ${widgetConfig.assistantName}`);
    sendButton.setAttribute("title", `Send a message to ${widgetConfig.assistantName}`);
  }
  if (poweredBy) {
    poweredBy.textContent = "We're here to help | Powered by Vonza";
  }
  if (!isPageMode()) {
    if (welcomeBadge) {
      welcomeBadge.textContent = "Quick answers";
    }
    if (welcomeTitle) {
      welcomeTitle.textContent = "Hi! How can we help today?";
    }
    if (welcomeCopy) {
      welcomeCopy.textContent = "Ask a question and get a clear answer. Choose how you'd like to continue.";
    }
  }
  syncPageAssistantHeader({ config: widgetConfig });

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
  }

  if (hasChosenVisitorIdentity()) {
    continueIntoChat(visitorIdentity, {
      persist: false,
      track: false,
      capture: false,
    });
  } else {
    setComposerStatus("Choose how to continue, then ask about services, pricing, contact details, or the next step.");
  }
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", widgetConfig.assistantName);
  syncWidgetPhaseWithIdentity(visitorIdentity);
  syncPageIdentityInline();
}

async function loadWidgetBootstrap() {
  if (!hasAssistantConfig()) {
    if (isPageMode()) {
      setPageShellState("unavailable", {
        title: "Assistant unavailable",
        copy: "This assistant is not available right now. Please contact the business directly.",
      });
      return;
    }
    applyWidgetConfig({
      ...DEFAULT_WIDGET_CONFIG,
      welcomeMessage: "No assistant configured yet. Please create one first.",
    });
    setComposerStatus("Create an assistant first, then return here to preview the customer experience.");
    return;
  }

  const bootstrapUrl = new URL("/widget/bootstrap", window.location.origin);

  if (INSTALL_ID) bootstrapUrl.searchParams.set("install_id", INSTALL_ID);
  if (AGENT_ID) bootstrapUrl.searchParams.set("agent_id", AGENT_ID);
  if (AGENT_KEY) bootstrapUrl.searchParams.set("agent_key", AGENT_KEY);
  if (BUSINESS_ID) bootstrapUrl.searchParams.set("business_id", BUSINESS_ID);
  if (WEBSITE_URL) bootstrapUrl.searchParams.set("website_url", WEBSITE_URL);
  if (getPageOrigin()) bootstrapUrl.searchParams.set("origin", getPageOrigin());
  if (getPageUrl()) bootstrapUrl.searchParams.set("page_url", getPageUrl());
  bootstrapUrl.searchParams.set("mode", DISPLAY_MODE);

  try {
    const response = await fetch(bootstrapUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || "Failed to load assistant configuration");
      error.statusCode = response.status;
      throw error;
    }

    if (isPageMode() && (!data.agent?.id || !data.widgetConfig)) {
      const error = new Error("Assistant is not available");
      error.statusCode = 404;
      throw error;
    }

    pageBusinessContext = data.business || null;
    applyWidgetConfig(data.widgetConfig || {});
    syncPageAssistantHeader({
      business: pageBusinessContext,
      config: widgetConfig,
    });
    resolvedAgentId = trimText(data.agent?.id || resolvedAgentId);
    resolvedAgentKey = trimText(data.agent?.publicAgentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.business?.id || resolvedBusinessId);
    if (isPageMode() && !hasChosenVisitorIdentity()) {
      visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    }
    if (hasChosenVisitorIdentity()) {
      continueIntoChat(visitorIdentity, {
        persist: false,
        track: false,
        capture: false,
      });
    } else {
      setComposerStatus("Choose how to continue, then start chatting.");
    }
    setPageShellState("ready");
    await detectConversionOutcomesOnLoad();
  } catch (error) {
    console.error("Vonza assistant bootstrap failed:", error);
    if (isPageMode()) {
      setPageShellState("unavailable", getFriendlyUnavailableState(error));
      return;
    }
    applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
    setComposerStatus("The assistant loaded with default styling. You can still test the experience.");
  }
}

function buildReplyFeedbackMarkup(messageKey, options = {}) {
  if (!trimText(messageKey)) {
    return "";
  }

  return `
    <div class="reply-feedback" data-reply-feedback="${escapeHtml(messageKey)}" data-reply-question="${escapeHtml(options.question || "")}" data-reply-answer="${escapeHtml(options.answer || "")}">
      <span data-reply-feedback-label>Was this helpful?</span>
      <button type="button" data-reply-feedback-rating="helpful" aria-label="Mark this reply helpful">Helpful</button>
      <button type="button" data-reply-feedback-open-reasons aria-label="Mark this reply not helpful">Not helpful</button>
      <form class="reply-feedback-reasons" data-reply-feedback-reasons hidden>
        <label>
          <span>What should be better?</span>
          <select name="reason">
            <option value="incorrect">Incorrect</option>
            <option value="missing_details">Missing details</option>
            <option value="too_vague">Too vague</option>
            <option value="did_not_answer">Did not answer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Optional note</span>
          <input name="note" type="text" maxlength="600" autocomplete="off">
        </label>
        <button type="button" data-reply-feedback-rating="not_helpful">Submit</button>
      </form>
    </div>
  `;
}

function appendMessage(chat, role, text, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}${options.typing ? " typing" : ""}`;
  if (options.error) {
    wrapper.classList.add("error");
  }

  const avatar = role === "user" ? "You" : getAssistantMark();
  const label = role === "user" ? "You" : widgetConfig.assistantName;
  const body = options.typing
    ? `<div class="typing-dots"><span></span><span></span><span></span></div>`
    : `<div class="vonza-message-body">${
        role === "bot"
          ? formatAssistantMessageHtml(text)
          : formatMessageParagraph(String(text || "").replace(/\r/g, "").split("\n"))
      }</div>`;

  wrapper.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble">
      <p class="message-label">${escapeHtml(label)}</p>
      ${body}
      ${role === "bot" && options.feedbackKey ? buildReplyFeedbackMarkup(options.feedbackKey, {
        question: options.feedbackQuestion || "",
        answer: text || "",
      }) : ""}
    </div>
  `;

  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
  updateCanvasConversationState();
  queueEmbeddedHeightUpdate();
  return wrapper;
}

async function submitReplyFeedback(messageKey, rating, options = {}) {
  const normalizedMessageKey = trimText(messageKey);
  const normalizedRating = trimText(rating).toLowerCase();
  const dedupeKey = `${getVisitorSessionKey()}::${normalizedMessageKey}`;

  if (!normalizedMessageKey || submittedReplyFeedbackKeys.has(dedupeKey)) {
    return null;
  }

  submittedReplyFeedbackKeys.add(dedupeKey);

  try {
    const response = await fetch("/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        display_mode: DISPLAY_MODE,
        session_key: getVisitorSessionKey(),
        assistant_message_key: normalizedMessageKey,
        rating: normalizedRating,
        reason: options.reason || "",
        note: options.note || "",
        user_question: options.userQuestion || "",
        assistant_answer: options.assistantAnswer || "",
        source_route: document.body?.classList?.contains("embedded") ? "embedded_assistant" : isPageMode() ? "public_page_assistant" : "public_widget",
        message_context: {
          conversation_index: conversationHistory.length,
          user_question: options.userQuestion || "",
          assistant_answer: options.assistantAnswer || "",
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Feedback request failed");
    }

    setComposerStatus(normalizedRating === "helpful" ? "Thanks for the feedback." : "Thanks. The business can review this.");
    return data;
  } catch (error) {
    submittedReplyFeedbackKeys.delete(dedupeKey);
    console.warn("Vonza reply feedback failed:", error);
    setComposerStatus("Feedback could not be saved just now.");
    return null;
  }
}

async function sendMessage(messageOverride = "") {
  const input = document.getElementById("input");
  const chat = document.getElementById("chat");
  const button = document.getElementById("send-button");

  const message = trimText(messageOverride || input.value);
  const historySnapshot = conversationHistory.slice(-6);

  if (!message) return;

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
  }

  if (!hasChosenVisitorIdentity()) {
    renderWidgetPhase();
    setComposerStatus("Choose guest or email before sending your first message.");
    return;
  }

  if (!hasAssistantConfig()) {
    console.error(
      "Vonza assistant configuration error: missing install_id, agent_id, agent_key, business_id, and website_url"
    );
    appendMessage(
      chat,
      "bot",
      "No assistant configured yet. Please create one first.",
      { error: true }
    );
    setComposerStatus("Set up your assistant in Vonza before testing the widget here.");
    return;
  }

  appendMessage(chat, "user", message);
  lastLeadReferenceMessage = message;
  quickRepliesDismissed = true;
  input.value = "";
  renderQuickReplies();
  button.disabled = true;
  input.disabled = true;
  setComposerStatus(`${widgetConfig.assistantName} is preparing a reply...`);

  const loading = appendMessage(chat, "bot", "", { typing: true });

  try {
    const sessionKey = getVisitorSessionKey();
    void trackWidgetEvent("first_message_sent", { messageLength: message.length }, {
      scope: sessionKey,
    });
    void trackWidgetEvent("conversation_started", { messageLength: message.length }, {
      dedupeKey: `${INSTALL_ID}::conversation_started::${sessionKey}`,
    });

    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        display_mode: DISPLAY_MODE,
        visitor_session_key: sessionKey,
        history: historySnapshot,
        ...buildVisitorIdentityPayload(),
      }),
    });

    const data = await res.json();

    loading.remove();

    if (!res.ok) {
      console.error("Vonza assistant backend error:", data.error || "Request failed");
      appendMessage(chat, "bot", data.error || "Request failed", { error: true });
      setComposerStatus("The assistant could not answer that just now. You can try again in a moment.");
      return;
    }

    if (data.widgetConfig) {
      applyWidgetConfig(data.widgetConfig);
    }

    const feedbackKey = buildAssistantMessageKey(data.reply);
    appendMessage(chat, "bot", data.reply, {
      feedbackKey,
      feedbackQuestion: message,
    });
    resolvedAgentId = trimText(data.agentId || resolvedAgentId);
    resolvedAgentKey = trimText(data.agentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.businessId || resolvedBusinessId);
    visitorIdentity = normalizeVisitorIdentityState(data.visitorIdentity || visitorIdentity);
    syncWidgetPhaseWithIdentity(visitorIdentity);
    addToHistory("user", message);
    addToHistory("assistant", data.reply);
    renderQuickReplies();
    liveLeadCapture = data.leadCapture || null;
    renderDirectRouting(data.directRouting || null);
    renderLeadCapture(liveLeadCapture, {
      force: trimText(data.directRouting?.mode) === "capture_only",
    });
    if (trimText(data.leadCapture?.state).toLowerCase() === "captured") {
      void trackWidgetEvent("contact_captured", {
        preferredChannel: trimText(data.leadCapture?.preferredChannel || ""),
        contactPresent: Boolean(trimText(data.leadCapture?.contact?.email || data.leadCapture?.contact?.phone)),
      }, {
        dedupeKey: `${INSTALL_ID}::contact_captured::${sessionKey}::${trimText(data.leadCapture?.id || "")}`,
      });
    }
    void trackWidgetEvent(
      "message_replied",
      {
        replyLength: trimText(data.reply).length,
      },
      {
        dedupeKey: `${INSTALL_ID}::message_replied::${sessionKey}::${conversationHistory.length}`,
      }
    );
    setComposerStatus(
      trimText(data.directRouting?.primaryCta?.label)
        ? "That option is ready if you want the fastest next step."
      : "Ask anything else about services, pricing, booking, or contact details."
    );
  } catch (err) {
    console.error("Vonza assistant request failed:", err);
    loading.remove();
    appendMessage(chat, "bot", "Error connecting to server", { error: true });
    setComposerStatus("Connection was interrupted. Try again when the assistant is ready.");
  } finally {
    button.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

document.getElementById("identity-guest-button")?.addEventListener("click", () => {
  continueIntoChat({
    mode: "guest",
  });
});

document.getElementById("identity-email-button")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.removeAttribute("hidden");
  document.getElementById("identity-name")?.focus();
  setComposerStatus("Add your email to keep this conversation connected.");
});

document.getElementById("identity-email-cancel")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.setAttribute("hidden", "");
  setComposerStatus("Choose email or guest, then start chatting.");
});

document.getElementById("identity-email-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const identity = normalizeVisitorIdentityState({
    mode: "identified",
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!identity.email) {
    setComposerStatus("Enter a valid email address to continue with email.");
    document.getElementById("identity-email")?.focus();
    return;
  }

  continueIntoChat(identity);
  form.setAttribute("hidden", "");
});

document.getElementById("page-identity-email-button")?.addEventListener("click", () => {
  const form = getPageIdentityEmailForm();

  if (!form) {
    return;
  }

  form.hidden = false;
  document.getElementById("page-identity-name")?.focus();
  setComposerStatus("Add your email if you want the business to follow up.");
});

document.getElementById("page-identity-email-cancel")?.addEventListener("click", () => {
  getPageIdentityEmailForm()?.setAttribute("hidden", "");
  setComposerStatus("No problem. You can keep asking as a guest.");
});

document.getElementById("page-identity-email-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const identity = normalizeVisitorIdentityState({
    mode: "identified",
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!identity.email) {
    setComposerStatus("Enter a valid email address to continue with email.");
    document.getElementById("page-identity-email")?.focus();
    return;
  }

  continueIntoChat(identity);
  form.setAttribute("hidden", "");
});

document.getElementById("identity-reset-button")?.addEventListener("click", () => {
  clearVisitorIdentity();
});

document.getElementById("chat")?.addEventListener("click", (event) => {
  const openReasonsButton = event.target?.closest?.("[data-reply-feedback-open-reasons]");

  if (openReasonsButton) {
    const container = openReasonsButton.closest("[data-reply-feedback]");
    const form = container?.querySelector("[data-reply-feedback-reasons]");
    if (form) {
      form.hidden = false;
      openReasonsButton.disabled = true;
      form.querySelector("select")?.focus();
      queueEmbeddedHeightUpdate();
    }
    return;
  }

  const button = event.target?.closest?.("[data-reply-feedback-rating]");

  if (!button) {
    return;
  }

  const container = button.closest("[data-reply-feedback]");
  const messageKey = container?.dataset?.replyFeedback || "";
  const rating = button.dataset.replyFeedbackRating || "";
  const form = button.closest("[data-reply-feedback-reasons]");
  const formData = form ? new FormData(form) : null;
  container?.querySelectorAll?.("button").forEach((feedbackButton) => {
    feedbackButton.disabled = true;
  });
  void submitReplyFeedback(messageKey, rating, {
    reason: formData?.get("reason") || "",
    note: formData?.get("note") || "",
    userQuestion: container?.dataset?.replyQuestion || "",
    assistantAnswer: container?.dataset?.replyAnswer || "",
  }).then((result) => {
    if (!result) {
      container?.querySelectorAll?.("button").forEach((feedbackButton) => {
        feedbackButton.disabled = false;
      });
      return;
    }

    container?.classList.add("submitted");
    const label = container?.querySelector("span");
    if (label) {
      label.textContent = rating === "helpful" ? "Thanks for the feedback." : "Thanks. The business can review this.";
    }
  });
});

document.getElementById("chat")?.addEventListener("submit", (event) => {
  const form = event.target?.closest?.("[data-reply-feedback-reasons]");
  if (!form) {
    return;
  }

  event.preventDefault();
  form.querySelector('[data-reply-feedback-rating="not_helpful"]')?.click();
});

document.getElementById("input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

getQuickReplies()?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-quick-reply]");

  if (!button) {
    return;
  }

  const topic = trimText(button.dataset.quickReply || button.textContent);

  if (topic) {
    sendMessage(topic);
  }
});

document.getElementById("page-action-list")?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-page-quick-action]");

  if (!button) {
    return;
  }

  const topic = trimText(button.dataset.pageStarterPrompt || button.dataset.pageQuickAction || button.textContent);

  if (!topic) {
    return;
  }

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
  }

  if (hasChosenVisitorIdentity()) {
    sendMessage(topic);
    return;
  }

  const input = document.getElementById("input");
  if (input) {
    input.value = topic;
  }
  setComposerStatus("Choose email or guest, then send that question.");
  document.getElementById("identity-guest-button")?.focus();
});

if (EMBEDDED_MODE) {
  document.body.classList.add("embedded");
  document.body.classList.add(`embedded-surface-${EMBEDDED_SURFACE}`);
  document.body.classList.add(`embedded-size-${EMBEDDED_SIZE}`);
  document.body.classList.add(`embedded-layout-${EMBEDDED_LAYOUT}`);
  if (isCanvasEmbeddedPageMode()) {
    document.body.classList.add("vonza-page-layout-canvas");
    document.body.classList.add("vonza-canvas-empty");
  }
  if (EMBEDDED_VARIANT === "smart") {
    document.body.classList.add("embedded-smart");
  }
  window.addEventListener("load", queueEmbeddedHeightUpdate);
  window.addEventListener("resize", queueEmbeddedHeightUpdate);
}

applyDisplayModeClasses();
visitorIdentity = loadStoredVisitorIdentity();
if (isPageMode() && !hasChosenVisitorIdentity()) {
  visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
}
syncWidgetPhaseWithIdentity(visitorIdentity);
applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
if (isPageMode()) {
  setPageShellState(hasAssistantConfig() ? "loading" : "unavailable", {
    title: "Assistant unavailable",
    copy: "This assistant is not available right now. Please contact the business directly.",
  });
}
loadWidgetBootstrap();

window.__VONZA_WIDGET_TEST_HOOKS__ = {
  applyWidgetConfig,
  getDisplayMode: () => DISPLAY_MODE,
  setPageShellState,
  buildVisitorIdentityPayload,
  buildAssistantMessageKey,
  clearVisitorIdentity,
  continueIntoChat: (identity, options = {}) => continueIntoChat(identity, {
    track: false,
    capture: options.capture === true,
  }),
  getVisitorIdentity: () => ({ ...visitorIdentity }),
  getWidgetPhase: () => widgetPhase,
  hasChosenVisitorIdentity: () => hasChosenVisitorIdentity(),
  formatAssistantMessageHtml,
  renderQuickReplies,
  getQuickReplyItems: () => getQuickReplyItems(),
  getPageActionCards: () => getPageActionCards(),
  getEmbeddedSurface: () => EMBEDDED_SURFACE,
  getEmbeddedSize: () => EMBEDDED_SIZE,
  getEmbeddedLayout: () => EMBEDDED_LAYOUT,
  shouldShowPageTitle,
  isFullEmbeddedPageMode,
  isCanvasEmbeddedPageMode,
  hasBookingSupport: () => hasBookingSupport(),
  isWelcomePanelHidden: () => getWelcomePanel()?.hidden === true || getEntryState()?.hidden === true,
  normalizeVisitorIdentityState,
  saveVisitorIdentity,
  sendMessage: () => sendMessage(),
  submitReplyFeedback,
};

if ("serviceWorker" in navigator && !EMBEDDED_MODE) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
