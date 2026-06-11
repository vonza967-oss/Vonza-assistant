import { randomBytes } from "node:crypto";

import {
  cleanText,
  isPlaceholderEmail,
  isPlaceholderPhone,
  slugifyLookupValue,
} from "../../utils/text.js";
import { getHostnameFromUrl, normalizeWebsiteUrl } from "../../utils/url.js";
import { ensureBusinessRecord, findBusinessByIdentifier } from "../business/businessResolution.js";
import { getAgentMessageStats } from "../chat/messageService.js";
import { listWidgetEventSummaryByAgentIds } from "../analytics/widgetTelemetryService.js";
import { listBookingIntegrationStatusesByAgentIds } from "../bookings/bookingIntegrationService.js";
import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
  isKnownAgentPackageKey,
} from "../../agentPackages/index.js";
import { normalizeOutcomeSettings, normalizeSuccessUrlMatchMode } from "../conversion/conversionOutcomeService.js";
import {
  deriveAllowedDomains,
  listInstallStatusByAgentIds,
  normalizeAllowedDomains,
  requireAllowedInstallOrigin,
  requireAllowedOriginForWidgetContext,
} from "../install/installPresenceService.js";
import {
  DEFAULT_AGENT_NAME,
  DEFAULT_FULL_PAGE_ACTION_CARDS,
  DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD,
  DEFAULT_FULL_PAGE_CONFIG,
  DEFAULT_FULL_PAGE_DESIGN,
  DEFAULT_FULL_PAGE_TRUST_ITEMS,
  DEFAULT_LANGUAGE,
  DEFAULT_PURPOSE,
  DEFAULT_TONE,
  DEFAULT_VOICE_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  FULL_PAGE_ACTION_CARD_TYPES,
  FULL_PAGE_BACKGROUND_PRESETS,
  FULL_PAGE_BACKGROUND_SCOPES,
  FULL_PAGE_BACKGROUND_SOURCES,
  FULL_PAGE_BACKGROUND_FOCAL_POINTS,
  FULL_PAGE_BACKGROUND_TYPES,
  FULL_PAGE_CHIP_STYLES,
  FULL_PAGE_COMPOSER_STYLES,
  FULL_PAGE_DESIGN_PRESETS,
  FULL_PAGE_STATUS_STYLES,
  FULL_PAGE_TEXT_THEMES,
  VOICE_TTS_VOICES,
} from "./agentDefaults.js";
import { normalizeWidgetPurpose } from "./widgetPurpose.js";
import { isTempInstantWorkspaceAccessEnabled } from "../../config/env.js";
import { normalizeBusinessVertical } from "../../templates/businessVerticals.js";

const AGENTS_TABLE = "agents";
const WIDGET_CONFIGS_TABLE = "widget_configs";
const WEBSITE_CONTENT_TABLE = "website_content";
const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const DEFAULT_ACCESS_STATUS = "pending";
const DEFAULT_AGENT_PACKAGE_VERSION = getAgentPackage(DEFAULT_AGENT_PACKAGE_KEY)?.version || "0.1.0";
const DEFAULT_PRECLAIM_TOKEN_TTL_HOURS = 24;
const CTA_MODES = ["booking", "quote", "checkout", "contact", "capture", "chat"];
const BOOKING_PROVIDERS = ["manual", "calendly"];
const WIDGET_QUICK_PROMPT_LIMIT = 5;
const WIDGET_QUICK_PROMPT_LABEL_LIMIT = 40;
const WIDGET_QUICK_PROMPT_TEXT_LIMIT = 200;
const ROUTING_WIDGET_CONFIG_COLUMNS = [
  "booking_url",
  "quote_url",
  "checkout_url",
  "booking_start_url",
  "quote_start_url",
  "booking_success_url",
  "quote_success_url",
  "checkout_success_url",
  "success_url_match_mode",
  "manual_outcome_mode",
  "contact_email",
  "contact_phone",
  "primary_cta_mode",
  "fallback_cta_mode",
  "business_hours_note",
  "widget_logo_url",
];
const FULL_PAGE_WIDGET_CONFIG_COLUMNS = [
  "full_page_config",
];
const VOICE_WIDGET_CONFIG_COLUMNS = [
  "voice_config",
];
const ROUTING_WIDGET_CONFIG_KEYS = [
  "bookingUrl",
  "quoteUrl",
  "checkoutUrl",
  "bookingStartUrl",
  "quoteStartUrl",
  "bookingSuccessUrl",
  "quoteSuccessUrl",
  "checkoutSuccessUrl",
  "successUrlMatchMode",
  "manualOutcomeMode",
  "contactEmail",
  "contactPhone",
  "primaryCtaMode",
  "fallbackCtaMode",
  "businessHoursNote",
];
const FULL_PAGE_WIDGET_CONFIG_KEYS = [
  "fullPageConfig",
];
const VOICE_WIDGET_CONFIG_KEYS = [
  "voiceConfig",
];
const AGENT_SELECT = [
  "id",
  "business_id",
  "client_id",
  "owner_user_id",
  "access_status",
  "public_agent_key",
  "package_key",
  "package_version",
  "name",
  "purpose",
  "system_prompt",
  "tone",
  "language",
  "is_active",
  "created_at",
].join(", ");
const LEGACY_WIDGET_CONFIG_SELECT = [
  "id",
  "agent_id",
  "assistant_name",
  "welcome_message",
  "button_label",
  "primary_color",
  "secondary_color",
  "launcher_text",
  "theme_mode",
  "install_id",
  "allowed_domains",
  "last_verification_status",
  "last_verified_at",
  "last_verification_origin",
  "last_verification_target_url",
  "last_verification_details",
].join(", ");
const WIDGET_CONFIG_SELECT = [
  "id",
  "agent_id",
  "assistant_name",
  "welcome_message",
  "button_label",
  "primary_color",
  "secondary_color",
  "launcher_text",
  "widget_logo_url",
  "theme_mode",
  "booking_url",
  "quote_url",
  "checkout_url",
  "booking_start_url",
  "quote_start_url",
  "booking_success_url",
  "quote_success_url",
  "checkout_success_url",
  "success_url_match_mode",
  "manual_outcome_mode",
  "contact_email",
  "contact_phone",
  "primary_cta_mode",
  "fallback_cta_mode",
  "business_hours_note",
  "install_id",
  "allowed_domains",
  "last_verification_status",
  "last_verified_at",
  "last_verification_origin",
  "last_verification_target_url",
  "last_verification_details",
  "full_page_config",
  "voice_config",
].join(", ");
const WIDGET_CONFIG_SELECT_WITHOUT_VOICE = [
  "id",
  "agent_id",
  "assistant_name",
  "welcome_message",
  "button_label",
  "primary_color",
  "secondary_color",
  "launcher_text",
  "widget_logo_url",
  "theme_mode",
  "booking_url",
  "quote_url",
  "checkout_url",
  "booking_start_url",
  "quote_start_url",
  "booking_success_url",
  "quote_success_url",
  "checkout_success_url",
  "success_url_match_mode",
  "manual_outcome_mode",
  "contact_email",
  "contact_phone",
  "primary_cta_mode",
  "fallback_cta_mode",
  "business_hours_note",
  "install_id",
  "allowed_domains",
  "last_verification_status",
  "last_verified_at",
  "last_verification_origin",
  "last_verification_target_url",
  "last_verification_details",
  "full_page_config",
].join(", ");
const WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE = [
  "id",
  "agent_id",
  "assistant_name",
  "welcome_message",
  "button_label",
  "primary_color",
  "secondary_color",
  "launcher_text",
  "widget_logo_url",
  "theme_mode",
  "booking_url",
  "quote_url",
  "checkout_url",
  "booking_start_url",
  "quote_start_url",
  "booking_success_url",
  "quote_success_url",
  "checkout_success_url",
  "success_url_match_mode",
  "manual_outcome_mode",
  "contact_email",
  "contact_phone",
  "primary_cta_mode",
  "fallback_cta_mode",
  "business_hours_note",
  "install_id",
  "allowed_domains",
  "last_verification_status",
  "last_verified_at",
  "last_verification_origin",
  "last_verification_target_url",
  "last_verification_details",
].join(", ");

function normalizeAccessStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  return ["pending", "active", "suspended"].includes(normalized)
    ? normalized
    : DEFAULT_ACCESS_STATUS;
}

function resolveEffectiveAccessStatus(accessStatus, options = {}) {
  const normalizedAccessStatus = normalizeAccessStatus(accessStatus);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const normalizedAgentOwnerUserId = cleanText(options.agentOwnerUserId);

  // Temporary testing mode: let signed-in owners enter the workspace without payment
  // while keeping the underlying Stripe plan definitions and stored billing state intact.
  if (
    isTempInstantWorkspaceAccessEnabled()
    && normalizedOwnerUserId
    && normalizedAgentOwnerUserId
    && normalizedOwnerUserId === normalizedAgentOwnerUserId
  ) {
    return "active";
  }

  return normalizedAccessStatus;
}

export function getEffectiveOwnerWorkspaceAccessStatus(accessStatus, options = {}) {
  return resolveEffectiveAccessStatus(accessStatus, options);
}

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.toLowerCase().includes(`'public.${relationName}'`) ||
    message.toLowerCase().includes(`${relationName} was not found`)
  );
}

function isInvalidUuidFilterError(error) {
  const message = cleanText(error?.message || "");
  return error?.code === "22P02" || /invalid input syntax for type uuid/i.test(message);
}

function normalizeAgentKey(value) {
  return slugifyLookupValue(value).replace(/_+/g, "");
}

function readAgentPackageKey(row) {
  return cleanText(row?.package_key) || DEFAULT_AGENT_PACKAGE_KEY;
}

function readAgentPackageVersion(row) {
  return cleanText(row?.package_version) || DEFAULT_AGENT_PACKAGE_VERSION;
}

function normalizePublicDisplayMode(value) {
  return cleanText(value).toLowerCase() === "page" ? "page" : "widget";
}

function buildInvalidWebsiteUrlError() {
  const error = new Error("Enter a valid public https URL, like https://example.com.");
  error.statusCode = 400;
  return error;
}

function buildAgentSettingsError(message, statusCode = 500, code = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function buildPublicWidgetNotFoundError(message = "Public widget install not found.") {
  return buildAgentSettingsError(message, 404, "public_widget_not_found");
}

function buildPublicFullPageUnavailableError() {
  return buildAgentSettingsError(
    "This public assistant page is not available. Please contact the business directly.",
    404,
    "public_full_page_unavailable"
  );
}

function normalizeOptionalUrl(value) {
  const providedValue = cleanText(value);

  if (!providedValue) {
    return "";
  }

  return normalizeWebsiteUrl(providedValue, {
    requireHttps: true,
    requirePublicHostname: true,
  }) || "";
}

function normalizeBookingProvider(value, fallbackValue = "manual") {
  const normalized = cleanText(value).toLowerCase().replace(/_/g, "-");
  return BOOKING_PROVIDERS.includes(normalized) ? normalized : fallbackValue;
}

function isCalendlyUrl(value) {
  const normalized = normalizeOptionalUrl(value);

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

function buildInvalidCalendlyUrlError() {
  return buildAgentSettingsError("Enter a public https Calendly URL for the booking route.", 400);
}

function buildInvalidDirectUrlError(label) {
  return buildAgentSettingsError(`Enter a valid public https URL for ${label}.`, 400);
}

function buildRoutingPersistenceUnavailableError(error) {
  return buildAgentSettingsError(
    "Front Desk routing settings could not be saved because the server schema is missing routing fields. Apply the direct conversion routing migration and try again.",
    503,
    error?.code || "front_desk_routing_persistence_unavailable"
  );
}

function normalizeOptionalEmail(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "";
  }

  return isPlaceholderEmail(normalized) ? "" : normalized;
}

function buildInvalidEmailError() {
  return buildAgentSettingsError("Enter a valid contact email address.", 400);
}

function normalizeOptionalPhone(value) {
  const normalized = cleanText(value);

  if (!normalized) {
    return "";
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7) {
    return "";
  }

  return isPlaceholderPhone(normalized) ? "" : normalized;
}

function buildInvalidPhoneError() {
  return buildAgentSettingsError("Enter a valid contact phone number.", 400);
}

function normalizeOptionalImageSource(value) {
  const normalized = cleanText(value);

  if (!normalized) {
    return "";
  }

  if (normalized.length > 90000) {
    return "";
  }

  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(normalized)) {
    return normalized;
  }

  const normalizedUrl = normalizeOptionalUrl(normalized);
  return normalizedUrl || "";
}

function normalizeOptionalDesignMediaUrl(value, allowedExtensions = []) {
  const providedValue = cleanText(value);

  if (!providedValue) {
    return "";
  }

  if (/^\/assets\/front-desk\/backgrounds\/[a-z0-9._/-]+$/i.test(providedValue)) {
    const lowerPath = providedValue.toLowerCase();
    return allowedExtensions.some((extension) => lowerPath.endsWith(`.${extension}`))
      ? providedValue
      : "";
  }

  const normalizedUrl = normalizeOptionalUrl(providedValue);

  if (!normalizedUrl) {
    return "";
  }

  if (!allowedExtensions.length) {
    return normalizedUrl;
  }

  try {
    const pathname = new URL(normalizedUrl).pathname.toLowerCase();
    return allowedExtensions.some((extension) => pathname.endsWith(`.${extension}`))
      ? normalizedUrl
      : "";
  } catch {
    return "";
  }
}

function getFullPageBackgroundPresetDefaults(presetValue) {
  const preset = normalizeFullPageDesignEnum(
    presetValue,
    Object.keys(FULL_PAGE_BACKGROUND_PRESETS),
    ""
  );

  return preset ? FULL_PAGE_BACKGROUND_PRESETS[preset] : null;
}

function normalizeLimitedText(value, maxLength) {
  return cleanText(value).slice(0, maxLength);
}

function normalizeQuickPromptText(value, maxLength) {
  return cleanText(String(value || "").replace(/<[^>]*>/g, " ")).slice(0, maxLength);
}

function normalizeWidgetQuickPrompt(item = {}) {
  const prompt = normalizeQuickPromptText(
    readConfigField(item, "prompt") ?? readConfigField(item, "text") ?? readConfigField(item, "value") ?? readConfigField(item, "label"),
    WIDGET_QUICK_PROMPT_TEXT_LIMIT
  );
  const label = normalizeQuickPromptText(
    readConfigField(item, "label") ?? prompt,
    WIDGET_QUICK_PROMPT_LABEL_LIMIT
  );

  if (!label || !prompt) {
    return null;
  }

  return { label, prompt };
}

function normalizeWidgetQuickPrompts(value = []) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string" && cleanText(value)
      ? String(value).split(/\n|,/).map((entry) => ({ label: entry, prompt: entry }))
      : [];
  const seenLabels = new Set();
  const seenPrompts = new Set();
  const results = [];

  rawItems.forEach((item) => {
    const normalized = normalizeWidgetQuickPrompt(
      item && typeof item === "object" && !Array.isArray(item)
        ? item
        : { label: item, prompt: item }
    );

    if (!normalized) {
      return;
    }

    const labelKey = normalized.label.toLowerCase();
    const promptKey = normalized.prompt.toLowerCase();

    if (seenLabels.has(labelKey) || seenPrompts.has(promptKey)) {
      return;
    }

    seenLabels.add(labelKey);
    seenPrompts.add(promptKey);
    results.push(normalized);
  });

  return results.slice(0, WIDGET_QUICK_PROMPT_LIMIT);
}

function normalizeFullPageConfigInput(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readConfigField(config, camelCaseKey, snakeCaseKey) {
  if (Object.prototype.hasOwnProperty.call(config, camelCaseKey)) {
    return config[camelCaseKey];
  }

  if (snakeCaseKey && Object.prototype.hasOwnProperty.call(config, snakeCaseKey)) {
    return config[snakeCaseKey];
  }

  return undefined;
}

function normalizeConfigBoolean(value, fallbackValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : fallbackValue;
  }

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function generatePublicPageKey() {
  return randomBytes(18).toString("base64url");
}

function normalizePublicPageKey(value) {
  return cleanText(value).replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
}

function normalizeAccentColor(value) {
  const normalized = cleanText(value).toLowerCase();
  const tokenColors = {
    blue: "#2563eb",
    green: "#16a34a",
    purple: "#7c3aed",
    slate: "#334155",
    teal: "#0f766e",
  };

  if (!normalized) {
    return null;
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  return tokenColors[normalized] || null;
}

function normalizeFullPageDesignEnum(value, allowedValues, fallbackValue) {
  const normalized = cleanText(value).toLowerCase().replace(/_/g, "-");
  return allowedValues.includes(normalized) ? normalized : fallbackValue;
}

function normalizeOverlayOpacity(value, fallbackValue) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallbackValue;
  }

  return Math.max(0, Math.min(0.92, Math.round(number * 100) / 100));
}

function normalizeBackgroundBlur(value, fallbackValue) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallbackValue;
  }

  return Math.max(0, Math.min(18, Math.round(number)));
}

export function getFullPageDesignPresetDefaults(presetValue) {
  const preset = normalizeFullPageDesignEnum(
    presetValue,
    FULL_PAGE_DESIGN_PRESETS,
    DEFAULT_FULL_PAGE_DESIGN.preset
  );
  const presets = {
    "clean-light": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundType: "color",
      backgroundColor: "#ffffff",
      backgroundGradientTo: "#eef4ff",
      backgroundOverlayColor: "#ffffff",
      backgroundOverlayOpacity: 0.72,
      textTheme: "dark",
      composerStyle: "soft",
      chipStyle: "outline",
      statusStyle: "subtle",
    },
    "dark-professional": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundType: "color",
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
      backgroundType: "color",
      backgroundColor: "#f8f3ea",
      backgroundGradientTo: "#fffaf1",
      backgroundOverlayColor: "#fff7ed",
      backgroundOverlayOpacity: 0.54,
      textTheme: "dark",
      composerStyle: "soft",
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
      backgroundBlur: 0,
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
      backgroundBlur: 0,
      textTheme: "light",
      composerStyle: "elevated",
      chipStyle: "subtle-fill",
      statusStyle: "pill",
      disableVideoOnMobile: true,
    },
  };

  return presets[preset] || presets[DEFAULT_FULL_PAGE_DESIGN.preset];
}

export function normalizeFullPageDesignConfig(input = {}) {
  const rawDesign = normalizeFullPageConfigInput(input);
  const presetDefaults = getFullPageDesignPresetDefaults(
    readConfigField(rawDesign, "preset")
  );
  const rawBackgroundPresetDefaults = getFullPageBackgroundPresetDefaults(
    readConfigField(rawDesign, "backgroundPreset", "background_preset")
  );
  const rawBackgroundSource = normalizeFullPageDesignEnum(
    readConfigField(rawDesign, "backgroundSource", "background_source"),
    FULL_PAGE_BACKGROUND_SOURCES,
    rawBackgroundPresetDefaults ? "preset" : DEFAULT_FULL_PAGE_DESIGN.backgroundSource
  );
  const backgroundPresetDefaults = rawBackgroundSource === "preset" ? rawBackgroundPresetDefaults : null;
  const backgroundType = normalizeFullPageDesignEnum(
    readConfigField(rawDesign, "backgroundType", "background_type"),
    FULL_PAGE_BACKGROUND_TYPES,
    backgroundPresetDefaults?.backgroundType || presetDefaults.backgroundType
  );
  const backgroundSource = backgroundPresetDefaults
    ? "preset"
    : rawBackgroundSource === "preset"
      ? DEFAULT_FULL_PAGE_DESIGN.backgroundSource
      : rawBackgroundSource;
  const rawBackgroundImageUrl = normalizeOptionalDesignMediaUrl(
    readConfigField(rawDesign, "backgroundImageUrl", "background_image_url"),
    ["png", "jpg", "jpeg", "webp"]
  );
  const rawBackgroundVideoUrl = normalizeOptionalDesignMediaUrl(
    readConfigField(rawDesign, "backgroundVideoUrl", "background_video_url"),
    ["mp4", "webm"]
  );
  const textTheme = normalizeFullPageDesignEnum(
    readConfigField(rawDesign, "textTheme", "text_theme"),
    FULL_PAGE_TEXT_THEMES,
    backgroundPresetDefaults?.textTheme || presetDefaults.textTheme
  );
  const isMediaBackground = ["image", "video"].includes(backgroundType);
  const designPresetOwnsMediaBackground = isMediaBackground && presetDefaults.backgroundType === backgroundType;
  const mediaOverlayColor = textTheme === "light" ? "#020617" : "#ffffff";
  const mediaOverlayOpacity = textTheme === "light" ? 0.36 : 0.2;
  const overlayColorFallback =
    backgroundPresetDefaults?.backgroundOverlayColor
    || (designPresetOwnsMediaBackground ? presetDefaults.backgroundOverlayColor : null)
    || (isMediaBackground ? mediaOverlayColor : presetDefaults.backgroundOverlayColor);
  const overlayOpacityFallback =
    backgroundPresetDefaults?.backgroundOverlayOpacity
    ?? (designPresetOwnsMediaBackground ? presetDefaults.backgroundOverlayOpacity : undefined)
    ?? (isMediaBackground ? mediaOverlayOpacity : presetDefaults.backgroundOverlayOpacity);

  return {
    preset: presetDefaults.preset,
    backgroundType,
    backgroundSource,
    backgroundPreset: backgroundPresetDefaults?.key || null,
    backgroundColor:
      normalizeAccentColor(readConfigField(rawDesign, "backgroundColor", "background_color"))
      || backgroundPresetDefaults?.backgroundColor
      || presetDefaults.backgroundColor,
    backgroundGradientTo:
      normalizeAccentColor(readConfigField(rawDesign, "backgroundGradientTo", "background_gradient_to"))
      || presetDefaults.backgroundGradientTo,
    backgroundImageUrl: backgroundPresetDefaults?.imageUrl || rawBackgroundImageUrl || null,
    backgroundVideoUrl: backgroundPresetDefaults?.videoUrl || rawBackgroundVideoUrl || null,
    backgroundOverlayColor:
      normalizeAccentColor(readConfigField(rawDesign, "backgroundOverlayColor", "background_overlay_color"))
      || overlayColorFallback,
    backgroundOverlayOpacity: normalizeOverlayOpacity(
      readConfigField(rawDesign, "backgroundOverlayOpacity", "background_overlay_opacity"),
      overlayOpacityFallback
    ),
    backgroundBlur: normalizeBackgroundBlur(
      readConfigField(rawDesign, "backgroundBlur", "background_blur"),
      presetDefaults.backgroundBlur
    ),
    backgroundFocalPoint: normalizeFullPageDesignEnum(
      readConfigField(rawDesign, "backgroundFocalPoint", "background_focal_point"),
      FULL_PAGE_BACKGROUND_FOCAL_POINTS,
      presetDefaults.backgroundFocalPoint
    ),
    textTheme,
    composerStyle: normalizeFullPageDesignEnum(
      readConfigField(rawDesign, "composerStyle", "composer_style"),
      FULL_PAGE_COMPOSER_STYLES,
      presetDefaults.composerStyle
    ),
    chipStyle: normalizeFullPageDesignEnum(
      readConfigField(rawDesign, "chipStyle", "chip_style"),
      FULL_PAGE_CHIP_STYLES,
      presetDefaults.chipStyle
    ),
    statusStyle: normalizeFullPageDesignEnum(
      readConfigField(rawDesign, "statusStyle", "status_style"),
      FULL_PAGE_STATUS_STYLES,
      presetDefaults.statusStyle
    ),
    backgroundScope: normalizeFullPageDesignEnum(
      readConfigField(rawDesign, "backgroundScope", "background_scope"),
      FULL_PAGE_BACKGROUND_SCOPES,
      DEFAULT_FULL_PAGE_DESIGN.backgroundScope
    ),
    disableVideoOnMobile: normalizeConfigBoolean(
      readConfigField(rawDesign, "disableVideoOnMobile", "disable_video_on_mobile"),
      backgroundPresetDefaults?.disableVideoOnMobile ?? presetDefaults.disableVideoOnMobile
    ),
  };
}

function hasBookingSupportInWidgetConfig(config = {}) {
  return Boolean(
    normalizeOptionalUrl(config.bookingUrl || config.booking_url)
    || normalizeOptionalUrl(config.bookingStartUrl || config.booking_start_url)
    || normalizeOptionalUrl(config.bookingSuccessUrl || config.booking_success_url)
    || cleanText(config.primaryCtaMode || config.primary_cta_mode).toLowerCase() === "booking"
    || cleanText(config.fallbackCtaMode || config.fallback_cta_mode).toLowerCase() === "booking"
  );
}

function buildDefaultFullPageActionCards({ bookingSupport = false } = {}) {
  const cards = DEFAULT_FULL_PAGE_ACTION_CARDS.map((card) => ({ ...card }));

  if (bookingSupport) {
    cards.push({ ...DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD });
  }

  return cards;
}

function normalizeFullPageActionType(value) {
  const normalized = cleanText(value).toLowerCase();
  return FULL_PAGE_ACTION_CARD_TYPES.includes(normalized) ? normalized : "custom";
}

function normalizeFullPageActionCard(card = {}, fallbackCard = {}) {
  const label = normalizeLimitedText(
    readConfigField(card, "label") ?? fallbackCard.label,
    40
  );
  const description = normalizeLimitedText(
    readConfigField(card, "description") ?? readConfigField(card, "copy") ?? fallbackCard.description,
    120
  );
  const prompt = normalizeLimitedText(
    readConfigField(card, "prompt") ?? fallbackCard.prompt,
    200
  );
  const type = normalizeFullPageActionType(
    readConfigField(card, "type") ?? fallbackCard.type
  );
  const enabled = normalizeConfigBoolean(
    readConfigField(card, "enabled"),
    fallbackCard.enabled !== false
  );

  if (!label || !prompt) {
    return null;
  }

  return {
    label,
    description,
    prompt,
    type,
    enabled,
  };
}

export function normalizeFullPageConfig(input = {}, options = {}) {
  const config = normalizeFullPageConfigInput(input);
  const bookingSupport = Boolean(options.bookingSupport);
  const defaultCards = buildDefaultFullPageActionCards({ bookingSupport });
  const rawCards =
    readConfigField(config, "actionCards", "action_cards")
    || readConfigField(config, "cards");
  const showBooking = bookingSupport && normalizeConfigBoolean(
    readConfigField(config, "showBooking", "show_booking"),
    bookingSupport
  );
  const showQuote = normalizeConfigBoolean(
    readConfigField(config, "showQuote", "show_quote"),
    DEFAULT_FULL_PAGE_CONFIG.showQuote
  );
  const showContact = normalizeConfigBoolean(
    readConfigField(config, "showContact", "show_contact"),
    DEFAULT_FULL_PAGE_CONFIG.showContact
  );
  const actionCards = (Array.isArray(rawCards) && rawCards.length ? rawCards : defaultCards)
    .slice(0, 6)
    .map((card, index) => normalizeFullPageActionCard(card, defaultCards[index] || {}))
    .filter(Boolean)
    .map((card) => ({
      ...card,
      enabled:
        (card.type === "booking" && !showBooking)
        || (card.type === "quote" && !showQuote)
        || (card.type === "contact" && !showContact)
          ? false
          : card.enabled,
    }));
  const rawSuggestedQuestions =
    readConfigField(config, "suggestedQuestions", "suggested_questions")
    || readConfigField(config, "quickReplies", "quick_replies")
    || [];
  const suggestedQuestions = (Array.isArray(rawSuggestedQuestions)
    ? rawSuggestedQuestions
    : String(rawSuggestedQuestions || "").split(/\n|,/)
  )
    .map((question) => normalizeLimitedText(question, 120))
    .filter(Boolean)
    .slice(0, 5);
  const rawTrustItems = readConfigField(config, "trustItems", "trust_items") || [];
  const trustItems = (Array.isArray(rawTrustItems) ? rawTrustItems : String(rawTrustItems || "").split(/\n|,/))
    .map((item) => normalizeLimitedText(item, 60))
    .filter(Boolean)
    .slice(0, 3);
  const quickPrompts = normalizeWidgetQuickPrompts(
    readConfigField(config, "quickPrompts", "quick_prompts") || []
  );
  const logoUrl = normalizeOptionalImageSource(
    readConfigField(config, "logoUrl", "logo_url")
  ) || null;
  const publicPageEnabled = normalizeConfigBoolean(
    readConfigField(config, "publicPageEnabled", "public_page_enabled")
      ?? readConfigField(config, "enabled"),
    false
  );
  const publicPageKey = normalizePublicPageKey(
    readConfigField(config, "publicPageKey", "public_page_key")
  );
  const design = normalizeFullPageDesignConfig(
    readConfigField(config, "design") || {}
  );
  const bookingProvider = normalizeBookingProvider(
    readConfigField(config, "bookingProvider", "booking_provider"),
    "manual"
  );

  return {
    publicPageEnabled,
    publicPageKey,
    bookingProvider,
    headline: normalizeLimitedText(readConfigField(config, "headline"), 80) || null,
    subtitle: normalizeLimitedText(readConfigField(config, "subtitle"), 180) || null,
    actionCards: actionCards.length ? actionCards : defaultCards,
    suggestedQuestions,
    quickPrompts,
    accentColor: normalizeAccentColor(readConfigField(config, "accentColor", "accent_color")),
    logoUrl,
    showBooking,
    showQuote,
    showContact,
    trustItems: trustItems.length ? trustItems : [...DEFAULT_FULL_PAGE_TRUST_ITEMS],
    design,
  };
}

function normalizeVoiceConfigInput(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeVoiceConfig(input = {}, previousConfig = DEFAULT_VOICE_CONFIG) {
  const config = normalizeVoiceConfigInput(input);
  const previous = normalizeVoiceConfigInput(previousConfig);
  const fallback = {
    ...DEFAULT_VOICE_CONFIG,
    ...previous,
  };
  const rawVoice = cleanText(
    readConfigField(config, "voice", "voice")
    || readConfigField(config, "voiceStyle", "voice_style")
    || fallback.voice
  ).toLowerCase();
  const rawLanguageBehavior = cleanText(
    readConfigField(config, "languageBehavior", "language_behavior")
    || fallback.languageBehavior
  ).toLowerCase();

  return {
    voiceInputEnabled: normalizeConfigBoolean(
      readConfigField(config, "voiceInputEnabled", "voice_input_enabled"),
      fallback.voiceInputEnabled
    ),
    spokenRepliesEnabled: normalizeConfigBoolean(
      readConfigField(config, "spokenRepliesEnabled", "spoken_replies_enabled"),
      fallback.spokenRepliesEnabled
    ),
    webCallEnabled: normalizeConfigBoolean(
      readConfigField(config, "webCallEnabled", "web_call_enabled"),
      fallback.webCallEnabled
    ),
    autoSendTranscript: normalizeConfigBoolean(
      readConfigField(config, "autoSendTranscript", "auto_send_transcript"),
      fallback.autoSendTranscript
    ),
    autoPlaySpokenReplies: normalizeConfigBoolean(
      readConfigField(config, "autoPlaySpokenReplies", "auto_play_spoken_replies"),
      fallback.autoPlaySpokenReplies
    ),
    voice: VOICE_TTS_VOICES.includes(rawVoice) ? rawVoice : DEFAULT_VOICE_CONFIG.voice,
    languageBehavior: ["auto", "business"].includes(rawLanguageBehavior)
      ? rawLanguageBehavior
      : DEFAULT_VOICE_CONFIG.languageBehavior,
  };
}

function serializeVoiceConfig(config = {}) {
  const normalized = normalizeVoiceConfig(config, DEFAULT_VOICE_CONFIG);

  return {
    voice_input_enabled: normalized.voiceInputEnabled,
    spoken_replies_enabled: normalized.spokenRepliesEnabled,
    web_call_enabled: normalized.webCallEnabled,
    auto_send_transcript: normalized.autoSendTranscript,
    auto_play_spoken_replies: normalized.autoPlaySpokenReplies,
    voice: normalized.voice,
    language_behavior: normalized.languageBehavior,
  };
}

function serializeFullPageConfig(config = {}) {
  const normalized = normalizeFullPageConfig(config, {
    bookingSupport: config.showBooking === true,
  });

  return {
    public_page_enabled: normalized.publicPageEnabled === true,
    public_page_key: normalizePublicPageKey(normalized.publicPageKey) || null,
    booking_provider: normalizeBookingProvider(normalized.bookingProvider),
    headline: normalized.headline,
    subtitle: normalized.subtitle,
    action_cards: normalized.actionCards.map((card) => ({ ...card })),
    suggested_questions: normalized.suggestedQuestions,
    quick_prompts: normalized.quickPrompts.map((item) => ({ ...item })),
    accent_color: normalized.accentColor,
    logo_url: normalized.logoUrl,
    show_booking: normalized.showBooking,
    show_quote: normalized.showQuote,
    show_contact: normalized.showContact,
    trust_items: normalized.trustItems,
    design: {
      preset: normalized.design.preset,
      background_type: normalized.design.backgroundType,
      background_source: normalized.design.backgroundSource,
      background_preset: normalized.design.backgroundPreset,
      background_color: normalized.design.backgroundColor,
      background_gradient_to: normalized.design.backgroundGradientTo,
      background_image_url: normalized.design.backgroundImageUrl,
      background_video_url: normalized.design.backgroundVideoUrl,
      background_overlay_color: normalized.design.backgroundOverlayColor,
      background_overlay_opacity: normalized.design.backgroundOverlayOpacity,
      background_blur: normalized.design.backgroundBlur,
      background_focal_point: normalized.design.backgroundFocalPoint,
      text_theme: normalized.design.textTheme,
      composer_style: normalized.design.composerStyle,
      chip_style: normalized.design.chipStyle,
      status_style: normalized.design.statusStyle,
      background_scope: normalized.design.backgroundScope,
      disable_video_on_mobile: normalized.design.disableVideoOnMobile,
    },
  };
}

function resolveFullPageAccessConfig(config = {}, previousConfig = {}, options = {}) {
  const next = { ...config };
  const previousKey = normalizePublicPageKey(previousConfig.publicPageKey || previousConfig.public_page_key);
  const requestedKey = normalizePublicPageKey(next.publicPageKey || next.public_page_key);
  const shouldRegenerate = options.regenerate === true;
  const enabled = next.publicPageEnabled === true || next.public_page_enabled === true;

  next.publicPageKey = shouldRegenerate
    ? generatePublicPageKey()
    : requestedKey || previousKey || (enabled ? generatePublicPageKey() : "");

  return next;
}

function buildInvalidWidgetLogoError() {
  return buildAgentSettingsError("Upload a small PNG, JPG, WebP, or GIF logo image.", 400);
}

function normalizeCtaMode(value, fallbackValue) {
  const normalized = cleanText(value).toLowerCase();
  return CTA_MODES.includes(normalized) ? normalized : fallbackValue;
}

function normalizeManualOutcomeMode(value, fallbackValue = false) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function isMissingWidgetRoutingColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "42703"
    || error?.code === "PGRST204"
    || ROUTING_WIDGET_CONFIG_COLUMNS.some((columnName) => message.includes(columnName))
  );
}

function isMissingFullPageConfigColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "42703"
    || error?.code === "PGRST204"
    || FULL_PAGE_WIDGET_CONFIG_COLUMNS.some((columnName) => message.includes(columnName))
  );
}

function isMissingVoiceConfigColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "42703"
    || error?.code === "PGRST204"
    || VOICE_WIDGET_CONFIG_COLUMNS.some((columnName) => message.includes(columnName))
  );
}

function isMissingBusinessVerticalColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "42703"
    || error?.code === "PGRST204"
    || (message.includes("vertical") && message.includes("does not exist"))
  );
}

function buildWidgetConfigUpsertPayload(agentId, config, options = {}) {
  const payload = {
    agent_id: agentId,
    assistant_name: config.assistantName,
    welcome_message: config.welcomeMessage,
    button_label: config.buttonLabel,
    primary_color: config.primaryColor,
    secondary_color: config.secondaryColor,
    launcher_text: config.launcherText,
    theme_mode: config.themeMode,
    allowed_domains: config.allowedDomains || [],
    updated_at: new Date().toISOString(),
  };

  if (options.includeWidgetLogoField !== false) {
    payload.widget_logo_url = config.widgetLogoUrl || null;
  }

  if (options.includeFullPageConfigField !== false) {
    payload.full_page_config = serializeFullPageConfig(config.fullPageConfig || {});
  }

  if (options.includeVoiceConfigField !== false) {
    payload.voice_config = serializeVoiceConfig(config.voiceConfig || {});
  }

  if (options.includeRoutingFields !== false) {
    payload.booking_url = config.bookingUrl || null;
    payload.quote_url = config.quoteUrl || null;
    payload.checkout_url = config.checkoutUrl || null;
    payload.booking_start_url = config.bookingStartUrl || null;
    payload.quote_start_url = config.quoteStartUrl || null;
    payload.booking_success_url = config.bookingSuccessUrl || null;
    payload.quote_success_url = config.quoteSuccessUrl || null;
    payload.checkout_success_url = config.checkoutSuccessUrl || null;
    payload.success_url_match_mode = normalizeSuccessUrlMatchMode(
      config.successUrlMatchMode,
      DEFAULT_WIDGET_CONFIG.successUrlMatchMode
    );
    payload.manual_outcome_mode = normalizeManualOutcomeMode(config.manualOutcomeMode, DEFAULT_WIDGET_CONFIG.manualOutcomeMode);
    payload.contact_email = config.contactEmail || null;
    payload.contact_phone = config.contactPhone || null;
    payload.primary_cta_mode = config.primaryCtaMode;
    payload.fallback_cta_mode = config.fallbackCtaMode;
    payload.business_hours_note = config.businessHoursNote || null;
  }

  return payload;
}

async function findBusinessByWebsiteUrl(supabase, websiteUrl) {
  const business = await findBusinessByIdentifier(supabase, websiteUrl);
  return business?.website_url ? business : null;
}

async function updateBusinessWebsiteUrl(supabase, businessId, websiteUrl) {
  const { error } = await supabase
    .from("businesses")
    .update({
      website_url: cleanText(websiteUrl) || null,
    })
    .eq("id", businessId);

  if (error) {
    console.error("[agentService] Failed to update business website URL:", {
      businessId,
      websiteUrl,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
}

async function updateBusinessVertical(supabase, businessId, vertical) {
  if (!businessId) {
    return;
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      vertical: normalizeBusinessVertical(vertical) || null,
    })
    .eq("id", businessId);

  if (error) {
    if (isMissingBusinessVerticalColumnError(error)) {
      throw buildAgentSettingsError(
        "Business vertical could not be saved because the server schema is missing the vertical field. Apply the business vertical migration and try again.",
        503,
        error?.code || "business_vertical_persistence_unavailable"
      );
    }

    console.error("[agentService] Failed to update business vertical:", {
      businessId,
      vertical,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
}

async function reassignAgentBusiness(supabase, agentId, businessId) {
  const { error } = await supabase
    .from(AGENTS_TABLE)
    .update({
      business_id: businessId,
    })
    .eq("id", agentId);

  if (error) {
    console.error("[agentService] Failed to reassign agent business:", {
      agentId,
      businessId,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
}

function buildDefaultAgentKey(business) {
  const name = cleanText(business.name);
  const hostname = getHostnameFromUrl(business.website_url || "");
  const rawValue = name || hostname || cleanText(business.id);
  return normalizeAgentKey(rawValue) || cleanText(business.id).toLowerCase();
}

function mapAgentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id || "",
    ownerUserId: row.owner_user_id || "",
    accessStatus: normalizeAccessStatus(row.access_status),
    publicAgentKey: row.public_agent_key,
    packageKey: readAgentPackageKey(row),
    packageVersion: readAgentPackageVersion(row),
    name: row.name || DEFAULT_AGENT_NAME,
    purpose: normalizeWidgetPurpose(row.purpose || DEFAULT_PURPOSE),
    systemPrompt: row.system_prompt || "",
    tone: row.tone || DEFAULT_TONE,
    language: row.language || DEFAULT_LANGUAGE,
    isActive: row.is_active !== false,
    createdAt: row.created_at || "",
  };
}

function getPreClaimTokenTtlMs() {
  const hours = Number(process.env.AGENT_PRECLAIM_TOKEN_TTL_HOURS || DEFAULT_PRECLAIM_TOKEN_TTL_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_PRECLAIM_TOKEN_TTL_HOURS;
  return safeHours * 60 * 60 * 1000;
}

function isPreClaimTokenExpired(agent) {
  const createdAt = new Date(agent?.createdAt || "").getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > getPreClaimTokenTtlMs();
}

function mapWidgetConfigRow(row) {
  const outcomeSettings = normalizeOutcomeSettings(row || {});
  const normalizedFullPageConfig = normalizeFullPageConfig(row?.full_page_config, {
    bookingSupport: hasBookingSupportInWidgetConfig(row || {}),
  });
  const widgetLogoUrl = normalizeOptionalImageSource(row?.widget_logo_url) || "";
  const fullPageConfig = {
    ...normalizedFullPageConfig,
    logoUrl: normalizedFullPageConfig.logoUrl || widgetLogoUrl || null,
  };
  const voiceConfig = normalizeVoiceConfig(row?.voice_config, DEFAULT_VOICE_CONFIG);

  return {
    ...DEFAULT_WIDGET_CONFIG,
    voiceConfig,
    voice_config: serializeVoiceConfig(voiceConfig),
    fullPageConfig,
    full_page_config: serializeFullPageConfig(fullPageConfig),
    ...(row
      ? {
          assistantName: row.assistant_name ?? DEFAULT_WIDGET_CONFIG.assistantName,
          welcomeMessage: row.welcome_message ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
          buttonLabel: row.button_label ?? DEFAULT_WIDGET_CONFIG.buttonLabel,
          primaryColor: row.primary_color ?? DEFAULT_WIDGET_CONFIG.primaryColor,
          secondaryColor: row.secondary_color ?? DEFAULT_WIDGET_CONFIG.secondaryColor,
          launcherText: row.launcher_text ?? DEFAULT_WIDGET_CONFIG.launcherText,
          widgetLogoUrl,
          themeMode: row.theme_mode ?? DEFAULT_WIDGET_CONFIG.themeMode,
          bookingUrl: normalizeOptionalUrl(row.booking_url) || "",
          bookingProvider: fullPageConfig.bookingProvider,
          quoteUrl: normalizeOptionalUrl(row.quote_url) || "",
          checkoutUrl: normalizeOptionalUrl(row.checkout_url) || "",
          bookingStartUrl: outcomeSettings.bookingStartUrl,
          quoteStartUrl: outcomeSettings.quoteStartUrl,
          bookingSuccessUrl: outcomeSettings.bookingSuccessUrl,
          quoteSuccessUrl: outcomeSettings.quoteSuccessUrl,
          checkoutSuccessUrl: outcomeSettings.checkoutSuccessUrl,
          successUrlMatchMode: normalizeSuccessUrlMatchMode(
            row.success_url_match_mode,
            DEFAULT_WIDGET_CONFIG.successUrlMatchMode
          ),
          manualOutcomeMode: normalizeManualOutcomeMode(row.manual_outcome_mode, DEFAULT_WIDGET_CONFIG.manualOutcomeMode),
          contactEmail: normalizeOptionalEmail(row.contact_email) || "",
          contactPhone: normalizeOptionalPhone(row.contact_phone) || "",
          primaryCtaMode: normalizeCtaMode(row.primary_cta_mode, DEFAULT_WIDGET_CONFIG.primaryCtaMode),
          fallbackCtaMode: normalizeCtaMode(row.fallback_cta_mode, DEFAULT_WIDGET_CONFIG.fallbackCtaMode),
          businessHoursNote: cleanText(row.business_hours_note) || "",
          installId: row.install_id || "",
          allowedDomains: deriveAllowedDomains(row.allowed_domains, ""),
          lastVerificationStatus: row.last_verification_status || null,
          lastVerifiedAt: row.last_verified_at || null,
          lastVerificationOrigin: row.last_verification_origin || null,
          lastVerificationTargetUrl: row.last_verification_target_url || null,
          lastVerificationDetails:
            row.last_verification_details && typeof row.last_verification_details === "object"
              ? row.last_verification_details
              : {},
        }
      : {}),
  };
}

function mapPersistedWidgetConfigRow(row) {
  const outcomeSettings = normalizeOutcomeSettings(row || {});
  const normalizedFullPageConfig = normalizeFullPageConfig(row?.full_page_config, {
    bookingSupport: hasBookingSupportInWidgetConfig(row || {}),
  });
  const widgetLogoUrl = normalizeOptionalImageSource(row?.widget_logo_url) || "";

  return {
    assistantName: cleanText(row?.assistant_name),
    welcomeMessage: cleanText(row?.welcome_message),
    buttonLabel: cleanText(row?.button_label),
    primaryColor: cleanText(row?.primary_color),
    secondaryColor: cleanText(row?.secondary_color),
    launcherText: cleanText(row?.launcher_text),
    widgetLogoUrl,
    themeMode: cleanText(row?.theme_mode),
    bookingUrl: normalizeOptionalUrl(row?.booking_url) || "",
    bookingProvider: normalizedFullPageConfig.bookingProvider,
    quoteUrl: normalizeOptionalUrl(row?.quote_url) || "",
    checkoutUrl: normalizeOptionalUrl(row?.checkout_url) || "",
    bookingStartUrl: outcomeSettings.bookingStartUrl,
    quoteStartUrl: outcomeSettings.quoteStartUrl,
    bookingSuccessUrl: outcomeSettings.bookingSuccessUrl,
    quoteSuccessUrl: outcomeSettings.quoteSuccessUrl,
    checkoutSuccessUrl: outcomeSettings.checkoutSuccessUrl,
    successUrlMatchMode: normalizeSuccessUrlMatchMode(
      row?.success_url_match_mode,
      DEFAULT_WIDGET_CONFIG.successUrlMatchMode
    ),
    manualOutcomeMode: normalizeManualOutcomeMode(
      row?.manual_outcome_mode,
      DEFAULT_WIDGET_CONFIG.manualOutcomeMode
    ),
    contactEmail: normalizeOptionalEmail(row?.contact_email) || "",
    contactPhone: normalizeOptionalPhone(row?.contact_phone) || "",
    primaryCtaMode: normalizeCtaMode(
      row?.primary_cta_mode,
      DEFAULT_WIDGET_CONFIG.primaryCtaMode
    ),
    fallbackCtaMode: normalizeCtaMode(
      row?.fallback_cta_mode,
      DEFAULT_WIDGET_CONFIG.fallbackCtaMode
    ),
    businessHoursNote: cleanText(row?.business_hours_note) || "",
    fullPageConfig: {
      ...normalizedFullPageConfig,
      logoUrl: normalizedFullPageConfig.logoUrl || widgetLogoUrl || null,
    },
    voiceConfig: normalizeVoiceConfig(row?.voice_config, DEFAULT_VOICE_CONFIG),
    installId: cleanText(row?.install_id),
    allowedDomainsRaw: normalizeAllowedDomains(row?.allowed_domains, {
      allowEmpty: true,
    }),
  };
}

function buildKnowledgeSummary(row) {
  const content = cleanText(row?.content || "");
  const contentLength = content.length;
  const pageCount = Number(row?.page_count || 0);
  const hasWebsiteContent = Boolean(contentLength);
  const hasLimitedMarker = content.includes(LIMITED_CONTENT_MARKER);

  let state = "missing";
  let description = "Website knowledge has not been imported yet.";

  if (hasWebsiteContent) {
    if (hasLimitedMarker || contentLength < 400) {
      state = "limited";
      description = "Website knowledge exists, but it is still limited and may need another import pass.";
    } else {
      state = "ready";
      description = "Website knowledge is imported and ready to support customer questions.";
    }
  }

  return {
    state,
    description,
    hasWebsiteContent,
    contentLength,
    pageCount,
    importedWebsiteUrl: row?.website_url || "",
    updatedAt: row?.updated_at || null,
  };
}

function buildDefaultInstallStatus(widgetConfig = null, websiteUrl = "") {
  return {
    state: "not_installed",
    label: "Not installed yet",
    host: "",
    pageUrl: null,
    lastSeenAt: null,
    lastSeenUrl: null,
    lastVerifiedAt: widgetConfig?.lastVerifiedAt || null,
    verificationStatus: widgetConfig?.lastVerificationStatus || null,
    verificationTargetUrl: widgetConfig?.lastVerificationTargetUrl || websiteUrl || null,
    verificationOrigin: widgetConfig?.lastVerificationOrigin || null,
    verificationDetails: widgetConfig?.lastVerificationDetails || {},
    installId: widgetConfig?.installId || "",
    allowedDomains: deriveAllowedDomains(widgetConfig?.allowedDomains, websiteUrl),
    expectedDomain: getHostnameFromUrl(websiteUrl || ""),
    installedAt: null,
  };
}

async function getWidgetConfigRowForAgent(supabase, agentId) {
  let { data, error } = await supabase
    .from(WIDGET_CONFIGS_TABLE)
    .select(WIDGET_CONFIG_SELECT)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error && isMissingFullPageConfigColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE)
      .eq("agent_id", agentId)
      .maybeSingle());
  }

  if (error && isMissingVoiceConfigColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT_WITHOUT_VOICE)
      .eq("agent_id", agentId)
      .maybeSingle());
  }

  if (error && isMissingWidgetRoutingColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(LEGACY_WIDGET_CONFIG_SELECT)
      .eq("agent_id", agentId)
      .maybeSingle());
  }

  if (error) {
    if (isMissingRelationError(error, WIDGET_CONFIGS_TABLE)) {
      return null;
    }
    console.error(error);
    throw error;
  }

  return data || null;
}

export async function getWidgetConfigForAgent(supabase, agentId) {
  const row = await getWidgetConfigRowForAgent(supabase, agentId);
  return mapWidgetConfigRow(row || null);
}

export async function ensureWidgetConfigForAgent(supabase, agentId) {
  const existingRow = await getWidgetConfigRowForAgent(supabase, agentId);

  if (existingRow) {
    return mapWidgetConfigRow(existingRow);
  }

  let { data, error } = await supabase
    .from(WIDGET_CONFIGS_TABLE)
    .upsert(buildWidgetConfigUpsertPayload(agentId, DEFAULT_WIDGET_CONFIG), { onConflict: "agent_id" })
    .select(WIDGET_CONFIG_SELECT)
    .single();

  if (error && isMissingFullPageConfigColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(agentId, DEFAULT_WIDGET_CONFIG, {
        includeFullPageConfigField: false,
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE)
      .single());
  }

  if (error && isMissingVoiceConfigColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(agentId, DEFAULT_WIDGET_CONFIG, {
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(WIDGET_CONFIG_SELECT_WITHOUT_VOICE)
      .single());
  }

  if (error && isMissingWidgetRoutingColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(agentId, DEFAULT_WIDGET_CONFIG, {
        includeRoutingFields: false,
        includeWidgetLogoField: false,
        includeFullPageConfigField: false,
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(LEGACY_WIDGET_CONFIG_SELECT)
      .single());
  }

  if (error) {
    if (isMissingRelationError(error, WIDGET_CONFIGS_TABLE)) {
      return mapWidgetConfigRow(null);
    }

    console.error(error);
    throw error;
  }

  return mapWidgetConfigRow(data || null);
}

async function findAgentById(supabase, agentId) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .eq("id", agentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return null;
    }
    if (isInvalidUuidFilterError(error)) {
      return null;
    }
    console.error(error);
    throw error;
  }

  return mapAgentRow(data || null);
}

async function findAgentByKey(supabase, agentKey) {
  const lookupKey = cleanText(agentKey);

  if (!lookupKey) {
    return null;
  }

  const normalizedLookup = normalizeAgentKey(lookupKey);
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .eq("is_active", true);

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return null;
    }
    console.error(error);
    throw error;
  }

  const match = (data || []).find((agent) => {
    const agentKeyValue = cleanText(agent.public_agent_key);
    return (
      agentKeyValue.toLowerCase() === lookupKey.toLowerCase() ||
      normalizeAgentKey(agentKeyValue) === normalizedLookup
    );
  });

  return mapAgentRow(match || null);
}

async function findDefaultAgentForBusiness(supabase, businessId, options = {}) {
  const clientId = cleanText(options.clientId);
  const ownerUserId = cleanText(options.ownerUserId);
  let query = supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (ownerUserId) {
    query = query.eq("owner_user_id", ownerUserId);
  } else if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return null;
    }
    console.error(error);
    throw error;
  }

  return mapAgentRow(data?.[0] || null);
}

async function listActiveAgentsForBusiness(supabase, businessId) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return [];
    }
    console.error(error);
    throw error;
  }

  return (data || []).map((row) => mapAgentRow(row));
}

async function claimAgentOwnershipById(supabase, agentId, ownerUserId) {
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!agentId || !normalizedOwnerUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .update({
      owner_user_id: normalizedOwnerUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .select(AGENT_SELECT)
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return mapAgentRow(data || null);
}

export async function ensureAgentForBusiness(supabase, business, options = {}) {
  const clientId = cleanText(options.clientId);
  const ownerUserId = cleanText(options.ownerUserId);
  const existingAgent = await findDefaultAgentForBusiness(supabase, business.id, {
    clientId,
    ownerUserId,
  });

  if (existingAgent) {
    return existingAgent;
  }

  if (ownerUserId && clientId) {
    const bridgeAgent = await findDefaultAgentForBusiness(supabase, business.id, { clientId });

    if (bridgeAgent && (!bridgeAgent.ownerUserId || bridgeAgent.ownerUserId === ownerUserId)) {
      return claimAgentOwnershipById(supabase, bridgeAgent.id, ownerUserId);
    }
  }

  const defaultKey = buildDefaultAgentKey(business);
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .insert({
      business_id: business.id,
      client_id: clientId || null,
      owner_user_id: ownerUserId || null,
      access_status: DEFAULT_ACCESS_STATUS,
      public_agent_key: defaultKey,
      name: cleanText(business.name) || DEFAULT_AGENT_NAME,
      purpose: DEFAULT_PURPOSE,
      tone: DEFAULT_TONE,
      language: DEFAULT_LANGUAGE,
      is_active: true,
    })
    .select(AGENT_SELECT)
    .single();

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return {
        id: `fallback-${business.id}`,
        businessId: business.id,
        clientId: clientId || "",
        ownerUserId: ownerUserId || "",
        accessStatus: DEFAULT_ACCESS_STATUS,
        publicAgentKey: buildDefaultAgentKey(business),
        packageKey: DEFAULT_AGENT_PACKAGE_KEY,
        packageVersion: DEFAULT_AGENT_PACKAGE_VERSION,
        name: cleanText(business.name) || DEFAULT_AGENT_NAME,
        purpose: DEFAULT_PURPOSE,
        systemPrompt: "",
        tone: DEFAULT_TONE,
        language: DEFAULT_LANGUAGE,
        isActive: true,
      };
    }
    console.error(error);
    throw error;
  }

  return mapAgentRow(data);
}

export async function resolveAgentContext(supabase, options = {}) {
  const {
    agentId,
    agentKey,
    businessId,
    websiteUrl,
    businessName,
  } = options;

  let agent = null;

  try {
    if (agentId) {
      agent = await findAgentById(supabase, agentId);
    }

    if (!agent && agentKey) {
      agent = await findAgentByKey(supabase, agentKey);
    }

    if (
      agentId &&
      !agent &&
      !agentKey &&
      !businessId &&
      !websiteUrl &&
      !businessName
    ) {
      const error = new Error("Agent not found");
      error.statusCode = 404;
      throw error;
    }

    if (agent) {
      const business =
        (await findBusinessByIdentifier(supabase, agent.businessId)) ||
        (await ensureBusinessRecord(supabase, {
          businessId: agent.businessId,
          websiteUrl,
          name: businessName,
        }));
      const widgetConfig = await getWidgetConfigForAgent(supabase, agent.id);

      return {
        agent,
        business,
        widgetConfig,
      };
    }

    const business = await ensureBusinessRecord(supabase, {
      businessId,
      websiteUrl,
      name: businessName,
    });
    const ensuredAgent = await ensureAgentForBusiness(supabase, business);
    const widgetConfig = await getWidgetConfigForAgent(supabase, ensuredAgent.id);

    return {
      agent: ensuredAgent,
      business,
      widgetConfig,
    };
  } catch (error) {
    if (
      isMissingRelationError(error, AGENTS_TABLE) ||
      isMissingRelationError(error, WIDGET_CONFIGS_TABLE)
    ) {
      const business = await ensureBusinessRecord(supabase, {
        businessId,
        websiteUrl,
        name: businessName,
      });
      const fallbackAgent = {
        id: `fallback-${business.id}`,
        businessId: business.id,
        clientId: "",
        ownerUserId: "",
        accessStatus: DEFAULT_ACCESS_STATUS,
        publicAgentKey: buildDefaultAgentKey(business),
        name: cleanText(business.name) || DEFAULT_AGENT_NAME,
        purpose: DEFAULT_PURPOSE,
        systemPrompt: "",
        tone: DEFAULT_TONE,
        language: DEFAULT_LANGUAGE,
        isActive: true,
      };

      return {
        agent: fallbackAgent,
        business,
        widgetConfig: mapWidgetConfigRow(null),
      };
    }

    throw error;
  }
}

async function resolveExistingPublicWidgetContext(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const agentKey = cleanText(options.agentKey);
  const businessId = cleanText(options.businessId);
  const websiteUrl = cleanText(options.websiteUrl);
  let agent = null;
  let business;
  let widgetConfigRow;

  if (agentId) {
    agent = await findAgentById(supabase, agentId);

    if (!agent) {
      const error = new Error("Agent not found");
      error.statusCode = 404;
      throw error;
    }
  }

  if (!agent && agentKey) {
    agent = await findAgentByKey(supabase, agentKey);

    if (!agent && !businessId && !websiteUrl) {
      throw buildPublicWidgetNotFoundError("Agent not found");
    }
  }

  if (agent) {
    business = await findBusinessByIdentifier(supabase, agent.businessId);
    widgetConfigRow = await getWidgetConfigRowForAgent(supabase, agent.id);
  } else {
    business = await findBusinessByIdentifier(supabase, businessId || websiteUrl);

    if (!business) {
      throw buildPublicWidgetNotFoundError();
    }

    const candidateAgents = await listActiveAgentsForBusiness(supabase, business.id);

    for (const candidateAgent of candidateAgents) {
      const candidateWidgetConfigRow = await getWidgetConfigRowForAgent(supabase, candidateAgent.id);

      if (!candidateWidgetConfigRow) {
        continue;
      }

      agent = candidateAgent;
      widgetConfigRow = candidateWidgetConfigRow;
      break;
    }
  }

  if (!agent || !business || !widgetConfigRow) {
    throw buildPublicWidgetNotFoundError();
  }

  return {
    agent,
    business,
    widgetConfigRow,
    widgetConfig: mapWidgetConfigRow(widgetConfigRow),
    allowedDomains: deriveAllowedDomains(widgetConfigRow.allowed_domains, business.website_url || ""),
  };
}

export async function resolveAllowedPublicWidgetContext(supabase, options = {}) {
  const installId = cleanText(options.installId);
  const requestedOrigin = cleanText(options.origin);
  const pageUrl = cleanText(options.pageUrl);
  const displayMode = normalizePublicDisplayMode(options.displayMode || options.mode);
  const publicPageKey = normalizePublicPageKey(options.publicPageKey || options.public_page_key || options.pageKey || options.k);

  if (installId) {
    const installContext = await requireAllowedInstallOrigin(supabase, {
      installId,
      origin: requestedOrigin,
      pageUrl,
    });

    const context = {
      agent: mapAgentRow(installContext.agent),
      business: installContext.business,
      widgetConfigRow: installContext.widgetConfigRow,
      widgetConfig: mapWidgetConfigRow(installContext.widgetConfigRow),
      allowedDomains: installContext.allowedDomains,
    };

    if (displayMode === "page") {
      requirePublicFullPageAccess(context, {
        publicPageKey,
        origin: requestedOrigin,
        pageUrl,
      });
    }

    return context;
  }

  const context = await resolveExistingPublicWidgetContext(supabase, options);

  if (displayMode === "page") {
    requirePublicFullPageAccess(context, {
      publicPageKey,
      origin: requestedOrigin,
      pageUrl,
    });
    return context;
  }

  requireAllowedOriginForWidgetContext(context, {
    installId: context.widgetConfig.installId,
    origin: requestedOrigin,
    pageUrl,
    blockedMessage: "Origin is not allowed for this install.",
  });

  return context;
}

export function requirePublicFullPageAccess(context = {}, options = {}) {
  const config = context.widgetConfig?.fullPageConfig || {};
  const enabled = config.publicPageEnabled === true || config.public_page_enabled === true;
  const expectedKey = normalizePublicPageKey(config.publicPageKey || config.public_page_key);
  const providedKey = normalizePublicPageKey(options.publicPageKey || options.public_page_key || options.pageKey || options.k);
  const ownerUserId = cleanText(context.agent?.ownerUserId || context.agent?.owner_user_id);
  const accessStatus = normalizeAccessStatus(context.agent?.accessStatus || context.agent?.access_status);
  const hasValidPublicPageKey = Boolean(expectedKey && providedKey === expectedKey);
  let hasAllowedInstalledOrigin = false;

  if (!providedKey && expectedKey) {
    try {
      requireAllowedOriginForWidgetContext(context, {
        installId: context.widgetConfig?.installId || context.widgetConfigRow?.install_id,
        origin: options.origin,
        pageUrl: options.pageUrl,
      });
      hasAllowedInstalledOrigin = true;
    } catch {
      hasAllowedInstalledOrigin = false;
    }
  }

  if (!ownerUserId || accessStatus !== "active" || !enabled || !expectedKey || (!hasValidPublicPageKey && !hasAllowedInstalledOrigin)) {
    throw buildPublicFullPageUnavailableError();
  }
}

export async function getWidgetBootstrap(supabase, options = {}) {
  const installId = cleanText(options.installId);
  const context = await resolveAllowedPublicWidgetContext(supabase, options);

  return {
    agent: context.agent,
    business: {
      id: context.business.id,
      name: context.business.name,
      websiteUrl: context.business.website_url,
      vertical: normalizeBusinessVertical(context.business.vertical),
    },
    widgetConfig: {
      ...context.widgetConfig,
      assistantName: context.widgetConfig.assistantName || context.agent.name || DEFAULT_WIDGET_CONFIG.assistantName,
    },
    install: {
      installId: context.widgetConfig.installId || installId || "",
      allowedDomains: context.allowedDomains || context.widgetConfig.allowedDomains || [],
    },
  };
}

export async function createAgentForBusinessName(supabase, businessName, websiteUrl, clientId, ownerUserId) {
  const normalizedBusinessName = cleanText(businessName);
  const providedWebsiteUrl = cleanText(websiteUrl);
  const normalizedWebsiteUrl = providedWebsiteUrl
    ? normalizeWebsiteUrl(providedWebsiteUrl, {
        requireHttps: true,
        requirePublicHostname: true,
      })
    : "";
  const normalizedClientId = cleanText(clientId);
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedBusinessName) {
    const error = new Error("business_name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedClientId && !normalizedOwnerUserId) {
    const error = new Error("client_id or authenticated owner is required");
    error.statusCode = 400;
    throw error;
  }

  if (providedWebsiteUrl && !normalizedWebsiteUrl) {
    throw buildInvalidWebsiteUrlError();
  }

  let business = await findBusinessByIdentifier(supabase, normalizedBusinessName);

  if (!business) {
    const syntheticWebsiteUrl =
      normalizedWebsiteUrl || `https://${slugifyLookupValue(normalizedBusinessName) || "business"}.local`;
    business = await ensureBusinessRecord(supabase, {
      websiteUrl: syntheticWebsiteUrl,
      name: normalizedBusinessName,
    });
  } else if (normalizedWebsiteUrl && business.website_url !== normalizedWebsiteUrl) {
    const { data: updatedBusiness, error: updateBusinessError } = await supabase
      .from("businesses")
      .update({
        website_url: normalizedWebsiteUrl,
      })
      .eq("id", business.id)
      .select("id, name, website_url")
      .single();

    if (updateBusinessError) {
      console.error(updateBusinessError);
      throw updateBusinessError;
    }

    business = updatedBusiness;
  }

  const agent = await ensureAgentForBusiness(supabase, business, {
    clientId: normalizedClientId,
    ownerUserId: normalizedOwnerUserId,
  });
  const widgetConfig = await ensureWidgetConfigForAgent(supabase, agent.id);

  return {
    business,
    agent,
    widgetConfig: {
      ...widgetConfig,
      assistantName: widgetConfig.assistantName || agent.name || DEFAULT_WIDGET_CONFIG.assistantName,
    },
  };
}

export async function listAgents(supabase, options = {}) {
  const normalizedClientId = cleanText(options.clientId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const includeBridgeAgent = options.includeBridgeAgent === true;

  if (!normalizedClientId && !normalizedOwnerUserId) {
    const error = new Error("client_id or authenticated owner is required");
    error.statusCode = 400;
    throw error;
  }

  let query = supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .order("name", { ascending: true });

  if (normalizedOwnerUserId) {
    query = query.eq("owner_user_id", normalizedOwnerUserId);
  } else {
    query = query
      .eq("client_id", normalizedClientId)
      .is("owner_user_id", null);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return { agents: [], bridgeAgent: null };
    }

    console.error(error);
    throw error;
  }

  const agentRows = data || [];
  const agentIds = agentRows.map((row) => row.id);
  const businessIds = [...new Set(agentRows.map((row) => row.business_id).filter(Boolean))];
  let widgetConfigsByAgentId = new Map();
  let businessesById = new Map();
  let websiteContentByBusinessId = new Map();
  let messageStatsByAgentId = new Map();
  let installStatusByAgentId = new Map();
  let widgetMetricsByAgentId = new Map();
  let bookingIntegrationsByAgentId = new Map();

  if (agentIds.length) {
    let { data: widgetRows, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT)
      .in("agent_id", agentIds);

    if (widgetError && isMissingFullPageConfigColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE)
        .in("agent_id", agentIds));
    }

    if (widgetError && isMissingVoiceConfigColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(WIDGET_CONFIG_SELECT_WITHOUT_VOICE)
        .in("agent_id", agentIds));
    }

    if (widgetError && isMissingWidgetRoutingColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(LEGACY_WIDGET_CONFIG_SELECT)
        .in("agent_id", agentIds));
    }

    if (widgetError) {
      if (!isMissingRelationError(widgetError, WIDGET_CONFIGS_TABLE)) {
        console.error(widgetError);
        throw widgetError;
      }
    } else {
      widgetConfigsByAgentId = new Map(
        (widgetRows || []).map((row) => [
          row.agent_id,
          mapWidgetConfigRow(row),
        ])
      );
    }
  }

  if (businessIds.length) {
    let { data: businessRows, error: businessError } = await supabase
      .from("businesses")
      .select("id, website_url, vertical")
      .in("id", businessIds);

    if (businessError && isMissingBusinessVerticalColumnError(businessError)) {
      ({ data: businessRows, error: businessError } = await supabase
        .from("businesses")
        .select("id, website_url")
        .in("id", businessIds));
    }

    if (businessError) {
      console.error(businessError);
      throw businessError;
    }

    businessesById = new Map((businessRows || []).map((row) => [row.id, row]));
  }

  if (businessIds.length) {
    const { data: websiteContentRows, error: websiteContentError } = await supabase
      .from(WEBSITE_CONTENT_TABLE)
      .select("business_id, website_url, content, page_count, updated_at")
      .in("business_id", businessIds);

    if (websiteContentError) {
      if (!isMissingRelationError(websiteContentError, WEBSITE_CONTENT_TABLE)) {
        console.error(websiteContentError);
        throw websiteContentError;
      }
    } else {
      websiteContentByBusinessId = new Map(
        (websiteContentRows || []).map((row) => [row.business_id, buildKnowledgeSummary(row)])
      );
    }
  }

  if (agentIds.length) {
    messageStatsByAgentId = await getAgentMessageStats(supabase, agentIds);
    installStatusByAgentId = await listInstallStatusByAgentIds(supabase, agentIds);
    bookingIntegrationsByAgentId = await listBookingIntegrationStatusesByAgentIds(supabase, agentIds);
    widgetMetricsByAgentId = await listWidgetEventSummaryByAgentIds(supabase, agentIds, {
      sinceByAgentId: new Map(
        agentIds.map((agentId) => [agentId, installStatusByAgentId.get(agentId)?.installedAt || null])
      ),
    });
  }

  const agents = agentRows.map((row) => {
    const widgetConfig = widgetConfigsByAgentId.get(row.id);
    const knowledge = websiteContentByBusinessId.get(row.business_id) || buildKnowledgeSummary(null);
    const messageStats = messageStatsByAgentId.get(row.id) || {};
    const business = businessesById.get(row.business_id) || {};
    const websiteUrl = business.website_url || "";
    const vertical = normalizeBusinessVertical(business.vertical);

    return {
      id: row.id,
      businessId: row.business_id,
      clientId: row.client_id || "",
      ownerUserId: row.owner_user_id || "",
      accessStatus: normalizeAccessStatus(row.access_status),
      name: row.name || DEFAULT_AGENT_NAME,
      purpose: normalizeWidgetPurpose(row.purpose || DEFAULT_PURPOSE),
      assistantName:
        widgetConfig?.assistantName || row.name || DEFAULT_WIDGET_CONFIG.assistantName,
      publicAgentKey: row.public_agent_key || "",
      packageKey: readAgentPackageKey(row),
      packageVersion: readAgentPackageVersion(row),
      installId: widgetConfig?.installId || "",
      allowedDomains: deriveAllowedDomains(widgetConfig?.allowedDomains, websiteUrl),
      isActive: row.is_active !== false,
      tone: row.tone || DEFAULT_TONE,
      systemPrompt: row.system_prompt || "",
      vertical,
      websiteUrl,
      welcomeMessage:
        widgetConfig?.welcomeMessage ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
      buttonLabel:
        widgetConfig?.buttonLabel ?? DEFAULT_WIDGET_CONFIG.buttonLabel,
      widgetLogoUrl:
        widgetConfig?.widgetLogoUrl || DEFAULT_WIDGET_CONFIG.widgetLogoUrl,
      primaryColor:
        widgetConfig?.primaryColor ?? DEFAULT_WIDGET_CONFIG.primaryColor,
      secondaryColor:
        widgetConfig?.secondaryColor ?? DEFAULT_WIDGET_CONFIG.secondaryColor,
      bookingUrl:
        widgetConfig?.bookingUrl || DEFAULT_WIDGET_CONFIG.bookingUrl,
      quoteUrl:
        widgetConfig?.quoteUrl || DEFAULT_WIDGET_CONFIG.quoteUrl,
      checkoutUrl:
        widgetConfig?.checkoutUrl || DEFAULT_WIDGET_CONFIG.checkoutUrl,
      bookingStartUrl:
        widgetConfig?.bookingStartUrl || DEFAULT_WIDGET_CONFIG.bookingStartUrl,
      quoteStartUrl:
        widgetConfig?.quoteStartUrl || DEFAULT_WIDGET_CONFIG.quoteStartUrl,
      bookingSuccessUrl:
        widgetConfig?.bookingSuccessUrl || DEFAULT_WIDGET_CONFIG.bookingSuccessUrl,
      quoteSuccessUrl:
        widgetConfig?.quoteSuccessUrl || DEFAULT_WIDGET_CONFIG.quoteSuccessUrl,
      checkoutSuccessUrl:
        widgetConfig?.checkoutSuccessUrl || DEFAULT_WIDGET_CONFIG.checkoutSuccessUrl,
      successUrlMatchMode:
        widgetConfig?.successUrlMatchMode || DEFAULT_WIDGET_CONFIG.successUrlMatchMode,
      manualOutcomeMode:
        widgetConfig?.manualOutcomeMode ?? DEFAULT_WIDGET_CONFIG.manualOutcomeMode,
      contactEmail:
        widgetConfig?.contactEmail || DEFAULT_WIDGET_CONFIG.contactEmail,
      contactPhone:
        widgetConfig?.contactPhone || DEFAULT_WIDGET_CONFIG.contactPhone,
      primaryCtaMode:
        widgetConfig?.primaryCtaMode || DEFAULT_WIDGET_CONFIG.primaryCtaMode,
      fallbackCtaMode:
        widgetConfig?.fallbackCtaMode || DEFAULT_WIDGET_CONFIG.fallbackCtaMode,
      businessHoursNote:
        widgetConfig?.businessHoursNote || DEFAULT_WIDGET_CONFIG.businessHoursNote,
      fullPageConfig:
        widgetConfig?.fullPageConfig || normalizeFullPageConfig(null),
      voiceConfig:
        widgetConfig?.voiceConfig || normalizeVoiceConfig(null),
      bookingIntegrationStatus: bookingIntegrationsByAgentId.get(row.id) || null,
      hasWidgetConfig: Boolean(widgetConfig),
      knowledge,
      installStatus: installStatusByAgentId.get(row.id) || buildDefaultInstallStatus(widgetConfig, websiteUrl),
      widgetMetrics: widgetMetricsByAgentId.get(row.id) || null,
      messageCount: messageStats.messageCount || 0,
      lastMessageAt: messageStats.lastMessageAt || null,
    };
  });

  const effectiveAgents = normalizedOwnerUserId
    ? agents.map((agent) => ({
      ...agent,
      accessStatus: resolveEffectiveAccessStatus(agent.accessStatus, {
        ownerUserId: normalizedOwnerUserId,
        agentOwnerUserId: agent.ownerUserId,
      }),
    }))
    : agents;

  let bridgeAgent = null;

  if (includeBridgeAgent && normalizedOwnerUserId && normalizedClientId && !effectiveAgents.length) {
    bridgeAgent = await findClaimableAgentByClientId(supabase, {
      clientId: normalizedClientId,
      ownerUserId: normalizedOwnerUserId,
    });
  }

  return {
    agents: effectiveAgents,
    bridgeAgent,
  };
}

export async function listAllAgents(supabase) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .order("name", { ascending: true });

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return [];
    }

    console.error(error);
    throw error;
  }

  const agentRows = data || [];
  const agentIds = agentRows.map((row) => row.id);
  const businessIds = [...new Set(agentRows.map((row) => row.business_id).filter(Boolean))];
  let widgetConfigsByAgentId = new Map();
  let businessesById = new Map();
  let messageStatsByAgentId = new Map();
  let installStatusByAgentId = new Map();
  let widgetMetricsByAgentId = new Map();
  let bookingIntegrationsByAgentId = new Map();

  if (agentIds.length) {
    let { data: widgetRows, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT)
      .in("agent_id", agentIds);

    if (widgetError && isMissingFullPageConfigColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE)
        .in("agent_id", agentIds));
    }

    if (widgetError && isMissingVoiceConfigColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(WIDGET_CONFIG_SELECT_WITHOUT_VOICE)
        .in("agent_id", agentIds));
    }

    if (widgetError && isMissingWidgetRoutingColumnError(widgetError)) {
      ({ data: widgetRows, error: widgetError } = await supabase
        .from(WIDGET_CONFIGS_TABLE)
        .select(LEGACY_WIDGET_CONFIG_SELECT)
        .in("agent_id", agentIds));
    }

    if (widgetError) {
      if (!isMissingRelationError(widgetError, WIDGET_CONFIGS_TABLE)) {
        console.error(widgetError);
        throw widgetError;
      }
    } else {
      widgetConfigsByAgentId = new Map(
        (widgetRows || []).map((row) => [row.agent_id, mapWidgetConfigRow(row)])
      );
    }
  }

  if (businessIds.length) {
    let { data: businessRows, error: businessError } = await supabase
      .from("businesses")
      .select("id, website_url, vertical")
      .in("id", businessIds);

    if (businessError && isMissingBusinessVerticalColumnError(businessError)) {
      ({ data: businessRows, error: businessError } = await supabase
        .from("businesses")
        .select("id, website_url")
        .in("id", businessIds));
    }

    if (businessError) {
      console.error(businessError);
      throw businessError;
    }

    businessesById = new Map((businessRows || []).map((row) => [row.id, row]));
  }

  if (agentIds.length) {
    messageStatsByAgentId = await getAgentMessageStats(supabase, agentIds);
    installStatusByAgentId = await listInstallStatusByAgentIds(supabase, agentIds);
    bookingIntegrationsByAgentId = await listBookingIntegrationStatusesByAgentIds(supabase, agentIds);
    widgetMetricsByAgentId = await listWidgetEventSummaryByAgentIds(supabase, agentIds, {
      sinceByAgentId: new Map(
        agentIds.map((agentId) => [agentId, installStatusByAgentId.get(agentId)?.installedAt || null])
      ),
    });
  }

  return agentRows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id || "",
    ownerUserId: row.owner_user_id || "",
    accessStatus: normalizeAccessStatus(row.access_status),
    name: row.name || DEFAULT_AGENT_NAME,
    purpose: normalizeWidgetPurpose(row.purpose || DEFAULT_PURPOSE),
    assistantName:
      widgetConfigsByAgentId.get(row.id)?.assistantName || row.name || DEFAULT_WIDGET_CONFIG.assistantName,
    publicAgentKey: row.public_agent_key || "",
    packageKey: readAgentPackageKey(row),
    packageVersion: readAgentPackageVersion(row),
    installId: widgetConfigsByAgentId.get(row.id)?.installId || "",
    allowedDomains: deriveAllowedDomains(
      widgetConfigsByAgentId.get(row.id)?.allowedDomains,
      businessesById.get(row.business_id)?.website_url || ""
    ),
    isActive: row.is_active !== false,
    tone: row.tone || DEFAULT_TONE,
    systemPrompt: row.system_prompt || "",
    vertical: normalizeBusinessVertical(businessesById.get(row.business_id)?.vertical),
    websiteUrl: businessesById.get(row.business_id)?.website_url || "",
    welcomeMessage:
      widgetConfigsByAgentId.get(row.id)?.welcomeMessage ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
    buttonLabel:
      widgetConfigsByAgentId.get(row.id)?.buttonLabel ?? DEFAULT_WIDGET_CONFIG.buttonLabel,
    widgetLogoUrl:
      widgetConfigsByAgentId.get(row.id)?.widgetLogoUrl || DEFAULT_WIDGET_CONFIG.widgetLogoUrl,
    primaryColor:
      widgetConfigsByAgentId.get(row.id)?.primaryColor ?? DEFAULT_WIDGET_CONFIG.primaryColor,
    secondaryColor:
      widgetConfigsByAgentId.get(row.id)?.secondaryColor ?? DEFAULT_WIDGET_CONFIG.secondaryColor,
    bookingUrl:
      widgetConfigsByAgentId.get(row.id)?.bookingUrl || DEFAULT_WIDGET_CONFIG.bookingUrl,
    quoteUrl:
      widgetConfigsByAgentId.get(row.id)?.quoteUrl || DEFAULT_WIDGET_CONFIG.quoteUrl,
    checkoutUrl:
      widgetConfigsByAgentId.get(row.id)?.checkoutUrl || DEFAULT_WIDGET_CONFIG.checkoutUrl,
    bookingStartUrl:
      widgetConfigsByAgentId.get(row.id)?.bookingStartUrl || DEFAULT_WIDGET_CONFIG.bookingStartUrl,
    quoteStartUrl:
      widgetConfigsByAgentId.get(row.id)?.quoteStartUrl || DEFAULT_WIDGET_CONFIG.quoteStartUrl,
    bookingSuccessUrl:
      widgetConfigsByAgentId.get(row.id)?.bookingSuccessUrl || DEFAULT_WIDGET_CONFIG.bookingSuccessUrl,
    quoteSuccessUrl:
      widgetConfigsByAgentId.get(row.id)?.quoteSuccessUrl || DEFAULT_WIDGET_CONFIG.quoteSuccessUrl,
    checkoutSuccessUrl:
      widgetConfigsByAgentId.get(row.id)?.checkoutSuccessUrl || DEFAULT_WIDGET_CONFIG.checkoutSuccessUrl,
    successUrlMatchMode:
      widgetConfigsByAgentId.get(row.id)?.successUrlMatchMode || DEFAULT_WIDGET_CONFIG.successUrlMatchMode,
    manualOutcomeMode:
      widgetConfigsByAgentId.get(row.id)?.manualOutcomeMode ?? DEFAULT_WIDGET_CONFIG.manualOutcomeMode,
    contactEmail:
      widgetConfigsByAgentId.get(row.id)?.contactEmail || DEFAULT_WIDGET_CONFIG.contactEmail,
    contactPhone:
      widgetConfigsByAgentId.get(row.id)?.contactPhone || DEFAULT_WIDGET_CONFIG.contactPhone,
    primaryCtaMode:
      widgetConfigsByAgentId.get(row.id)?.primaryCtaMode || DEFAULT_WIDGET_CONFIG.primaryCtaMode,
    fallbackCtaMode:
      widgetConfigsByAgentId.get(row.id)?.fallbackCtaMode || DEFAULT_WIDGET_CONFIG.fallbackCtaMode,
    businessHoursNote:
      widgetConfigsByAgentId.get(row.id)?.businessHoursNote || DEFAULT_WIDGET_CONFIG.businessHoursNote,
    fullPageConfig:
      widgetConfigsByAgentId.get(row.id)?.fullPageConfig || normalizeFullPageConfig(null),
    voiceConfig:
      widgetConfigsByAgentId.get(row.id)?.voiceConfig || normalizeVoiceConfig(null),
    bookingIntegrationStatus: bookingIntegrationsByAgentId.get(row.id) || null,
    installStatus: installStatusByAgentId.get(row.id) || buildDefaultInstallStatus(
      widgetConfigsByAgentId.get(row.id),
      businessesById.get(row.business_id)?.website_url || ""
    ),
    widgetMetrics: widgetMetricsByAgentId.get(row.id) || null,
    messageCount: messageStatsByAgentId.get(row.id)?.messageCount || 0,
    lastMessageAt: messageStatsByAgentId.get(row.id)?.lastMessageAt || null,
  }));
}

export async function getAgentWorkspaceSnapshot(supabase, agentId) {
  const normalizedAgentId = cleanText(
    typeof agentId === "object" && agentId !== null ? agentId.agentId : agentId
  );
  const normalizedOwnerUserId = cleanText(
    typeof agentId === "object" && agentId !== null ? agentId.ownerUserId : ""
  );

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  const agents = await listAllAgents(supabase);
  const agent = agents.find((candidate) => candidate.id === normalizedAgentId) || null;

  if (!agent) {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  if (!normalizedOwnerUserId) {
    return agent;
  }

  return {
    ...agent,
    accessStatus: resolveEffectiveAccessStatus(agent.accessStatus, {
      ownerUserId: normalizedOwnerUserId,
      agentOwnerUserId: agent.ownerUserId,
    }),
  };
}

export async function updateAgentSettings(
  supabase,
  options = {}
) {
  const {
    agentId,
    name,
    assistantName,
    purpose,
    widgetPurpose,
    tone,
    systemPrompt,
    welcomeMessage,
    buttonLabel,
    widgetLogoUrl,
    websiteUrl,
    primaryColor,
    secondaryColor,
    allowedDomains,
    bookingUrl,
    quoteUrl,
    checkoutUrl,
    bookingProvider,
    bookingStartUrl,
    quoteStartUrl,
    bookingSuccessUrl,
    quoteSuccessUrl,
    checkoutSuccessUrl,
    successUrlMatchMode,
    manualOutcomeMode,
    contactEmail,
    contactPhone,
    primaryCtaMode,
    fallbackCtaMode,
    businessHoursNote,
    fullPageConfig,
    voiceConfig,
    regeneratePublicPageKey,
    vertical,
  } = options;
  const hasField = (fieldName) => Object.prototype.hasOwnProperty.call(options, fieldName);
  const hasSubmittedBookingProvider = hasField("bookingProvider");
  const hasSubmittedRoutingField = ROUTING_WIDGET_CONFIG_KEYS.some((fieldName) => hasField(fieldName));
  const hasSubmittedFullPageConfig =
    FULL_PAGE_WIDGET_CONFIG_KEYS.some((fieldName) => hasField(fieldName)) || hasSubmittedBookingProvider;
  const hasSubmittedVoiceConfig = VOICE_WIDGET_CONFIG_KEYS.some((fieldName) => hasField(fieldName));
  const normalizedAgentId = cleanText(agentId);
  const providedWebsiteUrl = hasField("websiteUrl") ? cleanText(websiteUrl) : "";
  const normalizedWebsiteUrl = providedWebsiteUrl
    ? normalizeWebsiteUrl(providedWebsiteUrl, {
        requireHttps: true,
        requirePublicHostname: true,
      })
    : "";

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  if (hasField("websiteUrl") && providedWebsiteUrl && !normalizedWebsiteUrl) {
    throw buildInvalidWebsiteUrlError();
  }

  const requestedFullPageConfig = normalizeFullPageConfigInput(fullPageConfig);
  const requestedBookingProvider = hasSubmittedBookingProvider
    ? bookingProvider
    : readConfigField(requestedFullPageConfig, "bookingProvider", "booking_provider");
  const normalizedSubmittedBookingProvider = normalizeBookingProvider(requestedBookingProvider, "");
  if (requestedBookingProvider !== undefined && !normalizedSubmittedBookingProvider) {
    throw buildAgentSettingsError("Choose a valid booking provider.", 400);
  }

  const providedBookingUrl = hasField("bookingUrl") ? cleanText(bookingUrl) : "";
  const normalizedBookingUrl = normalizeOptionalUrl(providedBookingUrl);
  if (hasField("bookingUrl") && providedBookingUrl && !normalizedBookingUrl) {
    throw normalizedSubmittedBookingProvider === "calendly"
      ? buildInvalidCalendlyUrlError()
      : buildInvalidDirectUrlError("the booking route");
  }

  const providedQuoteUrl = hasField("quoteUrl") ? cleanText(quoteUrl) : "";
  const normalizedQuoteUrl = normalizeOptionalUrl(providedQuoteUrl);
  if (hasField("quoteUrl") && providedQuoteUrl && !normalizedQuoteUrl) {
    throw buildInvalidDirectUrlError("the quote route");
  }

  const providedCheckoutUrl = hasField("checkoutUrl") ? cleanText(checkoutUrl) : "";
  const normalizedCheckoutUrl = normalizeOptionalUrl(providedCheckoutUrl);
  if (hasField("checkoutUrl") && providedCheckoutUrl && !normalizedCheckoutUrl) {
    throw buildInvalidDirectUrlError("the checkout route");
  }

  const providedBookingStartUrl = hasField("bookingStartUrl")
    ? cleanText(bookingStartUrl)
    : "";
  const normalizedBookingStartUrl = normalizeOptionalUrl(providedBookingStartUrl);
  if (hasField("bookingStartUrl") && providedBookingStartUrl && !normalizedBookingStartUrl) {
    throw buildInvalidDirectUrlError("the booking start URL");
  }

  const providedQuoteStartUrl = hasField("quoteStartUrl") ? cleanText(quoteStartUrl) : "";
  const normalizedQuoteStartUrl = normalizeOptionalUrl(providedQuoteStartUrl);
  if (hasField("quoteStartUrl") && providedQuoteStartUrl && !normalizedQuoteStartUrl) {
    throw buildInvalidDirectUrlError("the quote start URL");
  }

  const providedBookingSuccessUrl = hasField("bookingSuccessUrl")
    ? cleanText(bookingSuccessUrl)
    : "";
  const normalizedBookingSuccessUrl = normalizeOptionalUrl(providedBookingSuccessUrl);
  if (hasField("bookingSuccessUrl") && providedBookingSuccessUrl && !normalizedBookingSuccessUrl) {
    throw buildInvalidDirectUrlError("the booking success URL");
  }

  const providedQuoteSuccessUrl = hasField("quoteSuccessUrl")
    ? cleanText(quoteSuccessUrl)
    : "";
  const normalizedQuoteSuccessUrl = normalizeOptionalUrl(providedQuoteSuccessUrl);
  if (hasField("quoteSuccessUrl") && providedQuoteSuccessUrl && !normalizedQuoteSuccessUrl) {
    throw buildInvalidDirectUrlError("the quote success URL");
  }

  const providedCheckoutSuccessUrl = hasField("checkoutSuccessUrl")
    ? cleanText(checkoutSuccessUrl)
    : "";
  const normalizedCheckoutSuccessUrl = normalizeOptionalUrl(providedCheckoutSuccessUrl);
  if (hasField("checkoutSuccessUrl") && providedCheckoutSuccessUrl && !normalizedCheckoutSuccessUrl) {
    throw buildInvalidDirectUrlError("the checkout success URL");
  }

  const providedContactEmail = hasField("contactEmail") ? cleanText(contactEmail) : "";
  const normalizedContactEmail = normalizeOptionalEmail(providedContactEmail);
  if (hasField("contactEmail") && providedContactEmail && !normalizedContactEmail) {
    throw buildInvalidEmailError();
  }

  const providedContactPhone = hasField("contactPhone") ? cleanText(contactPhone) : "";
  const normalizedContactPhone = normalizeOptionalPhone(providedContactPhone);
  if (hasField("contactPhone") && providedContactPhone && !normalizedContactPhone) {
    throw buildInvalidPhoneError();
  }

  const providedWidgetLogoUrl = hasField("widgetLogoUrl") ? cleanText(widgetLogoUrl) : "";
  const normalizedWidgetLogoUrl = normalizeOptionalImageSource(providedWidgetLogoUrl);
  if (hasField("widgetLogoUrl") && providedWidgetLogoUrl && !normalizedWidgetLogoUrl) {
    throw buildInvalidWidgetLogoError();
  }

  const agent = await findAgentById(supabase, normalizedAgentId);

  if (!agent) {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  const providedAssistantName = cleanText(assistantName) || cleanText(name);
  const hasPurposeUpdate =
    (hasField("purpose") && purpose !== undefined)
    || (hasField("widgetPurpose") && widgetPurpose !== undefined);
  const nextPurpose = hasPurposeUpdate
    ? normalizeWidgetPurpose(purpose ?? widgetPurpose)
    : normalizeWidgetPurpose(agent.purpose || DEFAULT_PURPOSE);
  const nextTone = hasField("tone")
    ? cleanText(tone) || agent.tone || DEFAULT_TONE
    : agent.tone || DEFAULT_TONE;
  const nextSystemPrompt = hasField("systemPrompt")
    ? cleanText(systemPrompt)
    : agent.systemPrompt || "";
  const currentWidgetConfig = await ensureWidgetConfigForAgent(supabase, normalizedAgentId);
  const currentWidgetConfigRow = await getWidgetConfigRowForAgent(supabase, normalizedAgentId);
  const persistedWidgetConfig = currentWidgetConfigRow
    ? mapPersistedWidgetConfigRow(currentWidgetConfigRow)
    : {
        assistantName: cleanText(currentWidgetConfig.assistantName),
        welcomeMessage: cleanText(currentWidgetConfig.welcomeMessage),
        buttonLabel: cleanText(currentWidgetConfig.buttonLabel),
        primaryColor: cleanText(currentWidgetConfig.primaryColor),
        secondaryColor: cleanText(currentWidgetConfig.secondaryColor),
        launcherText: cleanText(currentWidgetConfig.launcherText),
        widgetLogoUrl: currentWidgetConfig.widgetLogoUrl || "",
        themeMode: cleanText(currentWidgetConfig.themeMode),
        bookingUrl: currentWidgetConfig.bookingUrl || "",
        bookingProvider: currentWidgetConfig.bookingProvider || "manual",
        quoteUrl: currentWidgetConfig.quoteUrl || "",
        checkoutUrl: currentWidgetConfig.checkoutUrl || "",
        bookingStartUrl: currentWidgetConfig.bookingStartUrl || "",
        quoteStartUrl: currentWidgetConfig.quoteStartUrl || "",
        bookingSuccessUrl: currentWidgetConfig.bookingSuccessUrl || "",
        quoteSuccessUrl: currentWidgetConfig.quoteSuccessUrl || "",
        checkoutSuccessUrl: currentWidgetConfig.checkoutSuccessUrl || "",
        successUrlMatchMode: currentWidgetConfig.successUrlMatchMode,
        manualOutcomeMode: currentWidgetConfig.manualOutcomeMode,
        contactEmail: currentWidgetConfig.contactEmail || "",
        contactPhone: currentWidgetConfig.contactPhone || "",
        primaryCtaMode: currentWidgetConfig.primaryCtaMode,
        fallbackCtaMode: currentWidgetConfig.fallbackCtaMode,
        businessHoursNote: currentWidgetConfig.businessHoursNote || "",
        fullPageConfig: currentWidgetConfig.fullPageConfig || normalizeFullPageConfig(null),
        voiceConfig: currentWidgetConfig.voiceConfig || normalizeVoiceConfig(null),
        installId: currentWidgetConfig.installId || "",
        allowedDomainsRaw: normalizeAllowedDomains(currentWidgetConfig.allowedDomains, {
          allowEmpty: true,
        }),
      };
  const nextWelcomeMessage = hasField("welcomeMessage")
    ? cleanText(welcomeMessage)
    : persistedWidgetConfig.welcomeMessage;
  const nextAssistantName = providedAssistantName || persistedWidgetConfig.assistantName || agent.name || DEFAULT_AGENT_NAME;
  const nextButtonLabel = hasField("buttonLabel")
    ? cleanText(buttonLabel)
    : persistedWidgetConfig.buttonLabel;
  const nextPrimaryColor = hasField("primaryColor")
    ? cleanText(primaryColor)
    : persistedWidgetConfig.primaryColor;
  const nextSecondaryColor = hasField("secondaryColor")
    ? cleanText(secondaryColor)
    : persistedWidgetConfig.secondaryColor;
  const nextWidgetLogoUrl = hasField("widgetLogoUrl")
    ? normalizedWidgetLogoUrl || ""
    : persistedWidgetConfig.widgetLogoUrl;
  const nextBookingUrl = hasField("bookingUrl")
    ? normalizedBookingUrl || ""
    : persistedWidgetConfig.bookingUrl;
  const nextBookingProvider = normalizedSubmittedBookingProvider || persistedWidgetConfig.bookingProvider || "manual";
  if (nextBookingProvider === "calendly" && nextBookingUrl && !isCalendlyUrl(nextBookingUrl)) {
    throw buildInvalidCalendlyUrlError();
  }
  const nextQuoteUrl = hasField("quoteUrl")
    ? normalizedQuoteUrl || ""
    : persistedWidgetConfig.quoteUrl;
  const nextCheckoutUrl = hasField("checkoutUrl")
    ? normalizedCheckoutUrl || ""
    : persistedWidgetConfig.checkoutUrl;
  const nextBookingStartUrl = hasField("bookingStartUrl")
    ? normalizedBookingStartUrl || ""
    : persistedWidgetConfig.bookingStartUrl;
  const nextQuoteStartUrl = hasField("quoteStartUrl")
    ? normalizedQuoteStartUrl || ""
    : persistedWidgetConfig.quoteStartUrl;
  const nextBookingSuccessUrl = hasField("bookingSuccessUrl")
    ? normalizedBookingSuccessUrl || ""
    : persistedWidgetConfig.bookingSuccessUrl;
  const nextQuoteSuccessUrl = hasField("quoteSuccessUrl")
    ? normalizedQuoteSuccessUrl || ""
    : persistedWidgetConfig.quoteSuccessUrl;
  const nextCheckoutSuccessUrl = hasField("checkoutSuccessUrl")
    ? normalizedCheckoutSuccessUrl || ""
    : persistedWidgetConfig.checkoutSuccessUrl;
  const nextSuccessUrlMatchMode = hasField("successUrlMatchMode")
    ? normalizeSuccessUrlMatchMode(
        successUrlMatchMode,
        persistedWidgetConfig.successUrlMatchMode
      )
    : persistedWidgetConfig.successUrlMatchMode;
  const nextManualOutcomeMode = hasField("manualOutcomeMode")
    ? normalizeManualOutcomeMode(
        manualOutcomeMode,
        persistedWidgetConfig.manualOutcomeMode
      )
    : persistedWidgetConfig.manualOutcomeMode;
  const nextContactEmail = hasField("contactEmail")
    ? normalizedContactEmail || ""
    : persistedWidgetConfig.contactEmail;
  const nextContactPhone = hasField("contactPhone")
    ? normalizedContactPhone || ""
    : persistedWidgetConfig.contactPhone;
  const nextPrimaryCtaMode = hasField("primaryCtaMode")
    ? normalizeCtaMode(primaryCtaMode, persistedWidgetConfig.primaryCtaMode)
    : persistedWidgetConfig.primaryCtaMode;
  const nextFallbackCtaMode = hasField("fallbackCtaMode")
    ? normalizeCtaMode(fallbackCtaMode, persistedWidgetConfig.fallbackCtaMode)
    : persistedWidgetConfig.fallbackCtaMode;
  const nextBusinessHoursNote = hasField("businessHoursNote")
    ? cleanText(businessHoursNote)
    : persistedWidgetConfig.businessHoursNote;
  const nextFullPageConfig = (hasField("fullPageConfig") || hasSubmittedBookingProvider)
    ? resolveFullPageAccessConfig(
        normalizeFullPageConfig(hasField("fullPageConfig")
          ? {
              ...requestedFullPageConfig,
              bookingProvider: nextBookingProvider,
            }
          : {
              ...persistedWidgetConfig.fullPageConfig,
              bookingProvider: nextBookingProvider,
            }, {
          bookingSupport: hasBookingSupportInWidgetConfig({
            ...persistedWidgetConfig,
            bookingUrl: nextBookingUrl,
            booking_url: nextBookingUrl,
            bookingStartUrl: nextBookingStartUrl,
            booking_start_url: nextBookingStartUrl,
            bookingSuccessUrl: nextBookingSuccessUrl,
            booking_success_url: nextBookingSuccessUrl,
            primaryCtaMode: nextPrimaryCtaMode,
            primary_cta_mode: nextPrimaryCtaMode,
            fallbackCtaMode: nextFallbackCtaMode,
            fallback_cta_mode: nextFallbackCtaMode,
          }),
        }),
        persistedWidgetConfig.fullPageConfig,
        { regenerate: regeneratePublicPageKey === true || cleanText(regeneratePublicPageKey).toLowerCase() === "true" }
      )
    : persistedWidgetConfig.fullPageConfig;
  const nextVoiceConfig = hasField("voiceConfig")
    ? normalizeVoiceConfig(voiceConfig, persistedWidgetConfig.voiceConfig)
    : persistedWidgetConfig.voiceConfig;
  const currentBusiness = agent.businessId
    ? await findBusinessByIdentifier(supabase, agent.businessId)
    : null;
  const hasVerticalUpdate = hasField("vertical");
  const nextVertical = hasVerticalUpdate
    ? normalizeBusinessVertical(vertical)
    : normalizeBusinessVertical(currentBusiness?.vertical);
  const currentWebsiteUrl =
    normalizeWebsiteUrl(currentBusiness?.website_url || "", {
      requirePublicHostname: false,
    }) || cleanText(currentBusiness?.website_url || "");

  const { error: agentError } = await supabase
    .from(AGENTS_TABLE)
    .update({
      name: nextAssistantName,
      purpose: nextPurpose,
      tone: nextTone,
      system_prompt: nextSystemPrompt,
    })
    .eq("id", normalizedAgentId);

  if (agentError) {
    console.error("[agentService] Failed to update agent core settings:", {
      agentId: normalizedAgentId,
      code: agentError.code,
      message: agentError.message,
    });
    throw agentError;
  }

  let resolvedWebsiteUrl = currentWebsiteUrl;
  let resolvedBusinessId = agent.businessId;

  if (hasField("websiteUrl")) {
    if (normalizedWebsiteUrl) {
      try {
        if (normalizedWebsiteUrl !== currentWebsiteUrl) {
          const existingBusiness = await findBusinessByWebsiteUrl(supabase, normalizedWebsiteUrl);

          if (existingBusiness && existingBusiness.id !== agent.businessId) {
            if (existingBusiness.website_url !== normalizedWebsiteUrl) {
              await updateBusinessWebsiteUrl(supabase, existingBusiness.id, normalizedWebsiteUrl);
            }
            await reassignAgentBusiness(supabase, normalizedAgentId, existingBusiness.id);
            resolvedBusinessId = existingBusiness.id;
          } else {
            await updateBusinessWebsiteUrl(supabase, agent.businessId, normalizedWebsiteUrl);
          }
        } else if (currentBusiness?.website_url !== normalizedWebsiteUrl) {
          await updateBusinessWebsiteUrl(supabase, agent.businessId, normalizedWebsiteUrl);
        }
      } catch (businessError) {
        if (businessError?.code === "23505") {
          const existingBusiness = await findBusinessByWebsiteUrl(supabase, normalizedWebsiteUrl);

          if (existingBusiness?.id) {
            if (existingBusiness.website_url !== normalizedWebsiteUrl) {
              await updateBusinessWebsiteUrl(supabase, existingBusiness.id, normalizedWebsiteUrl);
            }
            await reassignAgentBusiness(supabase, normalizedAgentId, existingBusiness.id);
            resolvedBusinessId = existingBusiness.id;
          } else {
            throw buildAgentSettingsError(
              "That website is already connected elsewhere in Vonza. Try again in a moment.",
              409,
              businessError.code
            );
          }
        } else {
          throw businessError;
        }
      }

      resolvedWebsiteUrl = normalizedWebsiteUrl;
    } else {
      if (currentBusiness?.website_url) {
        await updateBusinessWebsiteUrl(supabase, agent.businessId, "");
      }
      resolvedWebsiteUrl = "";
    }
  }

  if (hasVerticalUpdate) {
    await updateBusinessVertical(supabase, resolvedBusinessId, nextVertical);
  }

  const nextAllowedDomainsRaw = hasField("allowedDomains")
    ? normalizeAllowedDomains(allowedDomains, { allowEmpty: true })
    : persistedWidgetConfig.allowedDomainsRaw;
  const resolvedAllowedDomains = deriveAllowedDomains(
    nextAllowedDomainsRaw,
    resolvedWebsiteUrl
  );

  let { data: persistedWidgetRow, error: widgetError } = await supabase
    .from(WIDGET_CONFIGS_TABLE)
    .upsert(buildWidgetConfigUpsertPayload(normalizedAgentId, {
      assistantName: nextAssistantName,
      welcomeMessage: nextWelcomeMessage,
      buttonLabel: nextButtonLabel,
      primaryColor: nextPrimaryColor,
      secondaryColor: nextSecondaryColor,
      launcherText: currentWidgetConfig.launcherText,
      widgetLogoUrl: nextWidgetLogoUrl,
      themeMode: currentWidgetConfig.themeMode,
      bookingUrl: nextBookingUrl,
      quoteUrl: nextQuoteUrl,
      checkoutUrl: nextCheckoutUrl,
      bookingStartUrl: nextBookingStartUrl,
      quoteStartUrl: nextQuoteStartUrl,
      bookingSuccessUrl: nextBookingSuccessUrl,
      quoteSuccessUrl: nextQuoteSuccessUrl,
      checkoutSuccessUrl: nextCheckoutSuccessUrl,
      successUrlMatchMode: nextSuccessUrlMatchMode,
      manualOutcomeMode: nextManualOutcomeMode,
      contactEmail: nextContactEmail,
      contactPhone: nextContactPhone,
      primaryCtaMode: nextPrimaryCtaMode,
      fallbackCtaMode: nextFallbackCtaMode,
      businessHoursNote: nextBusinessHoursNote,
      fullPageConfig: nextFullPageConfig,
      voiceConfig: nextVoiceConfig,
      allowedDomains: nextAllowedDomainsRaw,
    }), { onConflict: "agent_id" })
    .select(WIDGET_CONFIG_SELECT)
    .single();

  if (widgetError && isMissingFullPageConfigColumnError(widgetError)) {
    if (hasSubmittedFullPageConfig) {
      throw buildAgentSettingsError(
        "Front Desk page customization could not be saved because the server schema is missing the full_page_config field. Apply the full-page assistant config migration and try again.",
        503,
        widgetError?.code || "full_page_config_persistence_unavailable"
      );
    }

    ({ data: persistedWidgetRow, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(normalizedAgentId, {
        assistantName: nextAssistantName,
        welcomeMessage: nextWelcomeMessage,
        buttonLabel: nextButtonLabel,
        primaryColor: nextPrimaryColor,
        secondaryColor: nextSecondaryColor,
        launcherText: currentWidgetConfig.launcherText,
        widgetLogoUrl: nextWidgetLogoUrl,
        themeMode: currentWidgetConfig.themeMode,
        bookingUrl: nextBookingUrl,
        quoteUrl: nextQuoteUrl,
        checkoutUrl: nextCheckoutUrl,
        bookingStartUrl: nextBookingStartUrl,
        quoteStartUrl: nextQuoteStartUrl,
        bookingSuccessUrl: nextBookingSuccessUrl,
        quoteSuccessUrl: nextQuoteSuccessUrl,
        checkoutSuccessUrl: nextCheckoutSuccessUrl,
        successUrlMatchMode: nextSuccessUrlMatchMode,
        manualOutcomeMode: nextManualOutcomeMode,
        contactEmail: nextContactEmail,
        contactPhone: nextContactPhone,
        primaryCtaMode: nextPrimaryCtaMode,
        fallbackCtaMode: nextFallbackCtaMode,
        businessHoursNote: nextBusinessHoursNote,
        allowedDomains: nextAllowedDomainsRaw,
      }, {
        includeFullPageConfigField: false,
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(WIDGET_CONFIG_SELECT_WITHOUT_FULL_PAGE)
      .single());
  }

  if (widgetError && isMissingVoiceConfigColumnError(widgetError)) {
    if (hasSubmittedVoiceConfig) {
      throw buildAgentSettingsError(
        "Voice settings could not be saved because the server schema is missing the voice_config field. Apply the voice config migration and try again.",
        503,
        widgetError?.code || "voice_config_persistence_unavailable"
      );
    }

    ({ data: persistedWidgetRow, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(normalizedAgentId, {
        assistantName: nextAssistantName,
        welcomeMessage: nextWelcomeMessage,
        buttonLabel: nextButtonLabel,
        primaryColor: nextPrimaryColor,
        secondaryColor: nextSecondaryColor,
        launcherText: currentWidgetConfig.launcherText,
        widgetLogoUrl: nextWidgetLogoUrl,
        themeMode: currentWidgetConfig.themeMode,
        bookingUrl: nextBookingUrl,
        quoteUrl: nextQuoteUrl,
        checkoutUrl: nextCheckoutUrl,
        bookingStartUrl: nextBookingStartUrl,
        quoteStartUrl: nextQuoteStartUrl,
        bookingSuccessUrl: nextBookingSuccessUrl,
        quoteSuccessUrl: nextQuoteSuccessUrl,
        checkoutSuccessUrl: nextCheckoutSuccessUrl,
        successUrlMatchMode: nextSuccessUrlMatchMode,
        manualOutcomeMode: nextManualOutcomeMode,
        contactEmail: nextContactEmail,
        contactPhone: nextContactPhone,
        primaryCtaMode: nextPrimaryCtaMode,
        fallbackCtaMode: nextFallbackCtaMode,
        businessHoursNote: nextBusinessHoursNote,
        fullPageConfig: nextFullPageConfig,
        allowedDomains: nextAllowedDomainsRaw,
      }, {
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(WIDGET_CONFIG_SELECT_WITHOUT_VOICE)
      .single());
  }

  if (widgetError && isMissingWidgetRoutingColumnError(widgetError)) {
    if (hasSubmittedRoutingField) {
      throw buildRoutingPersistenceUnavailableError(widgetError);
    }

    ({ data: persistedWidgetRow, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(normalizedAgentId, {
        assistantName: nextAssistantName,
        welcomeMessage: nextWelcomeMessage,
        buttonLabel: nextButtonLabel,
        primaryColor: nextPrimaryColor,
        secondaryColor: nextSecondaryColor,
        launcherText: currentWidgetConfig.launcherText,
        widgetLogoUrl: nextWidgetLogoUrl,
        themeMode: currentWidgetConfig.themeMode,
        allowedDomains: nextAllowedDomainsRaw,
      }, {
        includeRoutingFields: false,
        includeWidgetLogoField: false,
        includeFullPageConfigField: false,
        includeVoiceConfigField: false,
      }), { onConflict: "agent_id" })
      .select(LEGACY_WIDGET_CONFIG_SELECT)
      .single());
  }

  if (widgetError) {
    if (!isMissingRelationError(widgetError, WIDGET_CONFIGS_TABLE)) {
      console.error("[agentService] Failed to update widget config:", {
        agentId: normalizedAgentId,
        code: widgetError.code,
        message: widgetError.message,
      });
      throw widgetError;
    }
  }

  const savedWidgetConfig = mapWidgetConfigRow(persistedWidgetRow || null);
  const savedAllowedDomainsRaw = normalizeAllowedDomains(persistedWidgetRow?.allowed_domains, {
    allowEmpty: true,
  });

  return {
    id: normalizedAgentId,
    businessId: resolvedBusinessId,
    publicAgentKey: agent.publicAgentKey,
    packageKey: agent.packageKey,
    packageVersion: agent.packageVersion,
    name: nextAssistantName,
    assistantName: nextAssistantName,
    purpose: nextPurpose,
    tone: nextTone,
    systemPrompt: nextSystemPrompt,
    vertical: nextVertical,
    websiteUrl: resolvedWebsiteUrl,
    websiteSync: {
      previousUrl: currentWebsiteUrl,
      currentUrl: resolvedWebsiteUrl,
      changed: hasField("websiteUrl") && resolvedWebsiteUrl !== currentWebsiteUrl,
    },
    welcomeMessage: savedWidgetConfig.welcomeMessage,
    buttonLabel: savedWidgetConfig.buttonLabel,
    widgetLogoUrl: savedWidgetConfig.widgetLogoUrl,
    primaryColor: savedWidgetConfig.primaryColor,
    secondaryColor: savedWidgetConfig.secondaryColor,
    bookingUrl: savedWidgetConfig.bookingUrl,
    bookingProvider: savedWidgetConfig.bookingProvider || savedWidgetConfig.fullPageConfig?.bookingProvider || nextBookingProvider,
    quoteUrl: savedWidgetConfig.quoteUrl,
    checkoutUrl: savedWidgetConfig.checkoutUrl,
    bookingStartUrl: savedWidgetConfig.bookingStartUrl,
    quoteStartUrl: savedWidgetConfig.quoteStartUrl,
    bookingSuccessUrl: savedWidgetConfig.bookingSuccessUrl,
    quoteSuccessUrl: savedWidgetConfig.quoteSuccessUrl,
    checkoutSuccessUrl: savedWidgetConfig.checkoutSuccessUrl,
    successUrlMatchMode: savedWidgetConfig.successUrlMatchMode,
    manualOutcomeMode: savedWidgetConfig.manualOutcomeMode,
    contactEmail: savedWidgetConfig.contactEmail,
    contactPhone: savedWidgetConfig.contactPhone,
    primaryCtaMode: savedWidgetConfig.primaryCtaMode,
    fallbackCtaMode: savedWidgetConfig.fallbackCtaMode,
    businessHoursNote: savedWidgetConfig.businessHoursNote,
    fullPageConfig: savedWidgetConfig.fullPageConfig,
    voiceConfig: savedWidgetConfig.voiceConfig || nextVoiceConfig,
    installId: savedWidgetConfig.installId || persistedWidgetConfig.installId || currentWidgetConfig.installId,
    allowedDomains: deriveAllowedDomains(savedAllowedDomainsRaw, resolvedWebsiteUrl) || resolvedAllowedDomains,
  };
}

export async function deleteAgent(supabase, agentId) {
  const normalizedAgentId = cleanText(agentId);

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  const { error: widgetConfigError } = await supabase
    .from(WIDGET_CONFIGS_TABLE)
    .delete()
    .eq("agent_id", normalizedAgentId);

  if (widgetConfigError && !isMissingRelationError(widgetConfigError, WIDGET_CONFIGS_TABLE)) {
    console.error(widgetConfigError);
    throw widgetConfigError;
  }

  const { error: agentError } = await supabase
    .from(AGENTS_TABLE)
    .delete()
    .eq("id", normalizedAgentId);

  if (agentError) {
    console.error(agentError);
    throw agentError;
  }

  return { ok: true };
}

export async function findClaimableAgentByClientId(supabase, options = {}) {
  const normalizedClientId = cleanText(options.clientId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);

  if (!normalizedClientId) {
    return null;
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(AGENT_SELECT)
    .eq("client_id", normalizedClientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return null;
    }

    console.error(error);
    throw error;
  }

  const match = (data || []).find((row) => {
    const existingOwnerUserId = cleanText(row.owner_user_id);
    return (!existingOwnerUserId || existingOwnerUserId === normalizedOwnerUserId)
      && !isPreClaimTokenExpired(mapAgentRow(row));
  });

  if (!match) {
    return null;
  }

  const mappedAgent = mapAgentRow(match);
  const widgetConfig = await getWidgetConfigForAgent(supabase, mappedAgent.id);

  return {
    ...mappedAgent,
    assistantName: widgetConfig.assistantName || mappedAgent.name || DEFAULT_WIDGET_CONFIG.assistantName,
    welcomeMessage: widgetConfig.welcomeMessage ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
    buttonLabel: widgetConfig.buttonLabel ?? DEFAULT_WIDGET_CONFIG.buttonLabel,
    primaryColor: widgetConfig.primaryColor ?? DEFAULT_WIDGET_CONFIG.primaryColor,
    secondaryColor: widgetConfig.secondaryColor ?? DEFAULT_WIDGET_CONFIG.secondaryColor,
    fullPageConfig: widgetConfig.fullPageConfig || normalizeFullPageConfig(null),
  };
}

export async function claimAgentForOwner(supabase, options = {}) {
  const normalizedAgentId = cleanText(options.agentId);
  const normalizedClientId = cleanText(options.clientId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);

  if (!normalizedOwnerUserId) {
    const error = new Error("Authenticated owner is required");
    error.statusCode = 401;
    throw error;
  }

  let candidate = null;

  if (normalizedAgentId) {
    candidate = await findAgentById(supabase, normalizedAgentId);

    if (candidate && normalizedClientId && candidate.clientId && candidate.clientId !== normalizedClientId) {
      candidate = null;
    }
  }

  if (!candidate) {
    candidate = await findClaimableAgentByClientId(supabase, {
      clientId: normalizedClientId,
      ownerUserId: normalizedOwnerUserId,
    });
  }

  if (!candidate) {
    const error = new Error("No claimable assistant found in this browser.");
    error.statusCode = 404;
    throw error;
  }

  if (candidate.ownerUserId && candidate.ownerUserId !== normalizedOwnerUserId) {
    const error = new Error("This assistant is already claimed by another account.");
    error.statusCode = 403;
    throw error;
  }

  return claimAgentOwnershipById(supabase, candidate.id, normalizedOwnerUserId);
}

export async function requireAgentAccess(supabase, options = {}) {
  const normalizedAgentId = cleanText(options.agentId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const normalizedClientId = cleanText(options.clientId);

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  const agent = await findAgentById(supabase, normalizedAgentId);

  if (!agent) {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  if (normalizedOwnerUserId) {
    if (cleanText(agent.ownerUserId) !== normalizedOwnerUserId) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    }

    return agent;
  }

  if (cleanText(agent.ownerUserId)) {
    const error = new Error("Authenticated owner is required");
    error.statusCode = 401;
    throw error;
  }

  if (normalizedClientId && cleanText(agent.clientId) === normalizedClientId) {
    if (isPreClaimTokenExpired(agent)) {
      const error = new Error("This setup link has expired. Sign in to continue.");
      error.statusCode = 401;
      error.code = "preclaim_token_expired";
      throw error;
    }

    return agent;
  }

  const error = new Error("Forbidden");
  error.statusCode = 403;
  throw error;
}

export async function requirePreClaimAgentAccess(supabase, options = {}) {
  const agent = await requireAgentAccess(supabase, {
    agentId: options.agentId,
    clientId: options.clientId,
  });

  if (cleanText(agent.ownerUserId)) {
    const error = new Error("Authenticated owner is required");
    error.statusCode = 401;
    throw error;
  }

  return agent;
}

export async function requireActiveAgentAccess(supabase, options = {}) {
  const agent = await requireAgentAccess(supabase, options);
  const effectiveAccessStatus = resolveEffectiveAccessStatus(agent.accessStatus, {
    ownerUserId: options.ownerUserId,
    agentOwnerUserId: agent.ownerUserId,
  });

  if (effectiveAccessStatus !== "active") {
    const error = new Error("Access is not active yet.");
    error.statusCode = 403;
    throw error;
  }

  return {
    ...agent,
    accessStatus: effectiveAccessStatus,
  };
}

export async function updateAgentPackageAssignment(supabase, options = {}) {
  const normalizedAgentId = cleanText(options.agentId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const normalizedPackageKey = cleanText(options.packageKey).toLowerCase();

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedOwnerUserId) {
    const error = new Error("Authenticated owner is required");
    error.statusCode = 401;
    throw error;
  }

  if (!isKnownAgentPackageKey(normalizedPackageKey)) {
    const error = new Error("Unknown agent package key.");
    error.statusCode = 400;
    error.code = "unknown_agent_package_key";
    throw error;
  }

  const agentPackage = getAgentPackage(normalizedPackageKey);
  const nextPackageVersion = cleanText(options.packageVersion) || agentPackage.version || DEFAULT_AGENT_PACKAGE_VERSION;

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .update({
      package_key: agentPackage.key,
      package_version: nextPackageVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedAgentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .select(AGENT_SELECT)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  if (!data) {
    const notFoundError = new Error("Agent not found");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return mapAgentRow(data);
}

export async function updateAgentAccessStatus(supabase, options = {}) {
  const normalizedAgentId = cleanText(options.agentId);

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  const nextAccessStatus = normalizeAccessStatus(options.accessStatus);
  const agent = await findAgentById(supabase, normalizedAgentId);

  if (!agent) {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .update({
      access_status: nextAccessStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedAgentId)
    .select(AGENT_SELECT)
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return mapAgentRow(data || null);
}

export async function updateOwnedAccessStatus(supabase, options = {}) {
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const nextAccessStatus = normalizeAccessStatus(options.accessStatus);

  if (!normalizedOwnerUserId) {
    const error = new Error("Authenticated owner is required");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .update({
      access_status: nextAccessStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", normalizedOwnerUserId)
    .select(AGENT_SELECT);

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((row) => mapAgentRow(row));
}

export { AGENTS_TABLE, WIDGET_CONFIGS_TABLE };
