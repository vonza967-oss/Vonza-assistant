import { cleanText, slugifyLookupValue } from "../../utils/text.js";
import { getHostnameFromUrl, normalizeWebsiteUrl } from "../../utils/url.js";
import { ensureBusinessRecord, findBusinessByIdentifier } from "../business/businessResolution.js";
import { getAgentMessageStats } from "../chat/messageService.js";
import { listWidgetEventSummaryByAgentIds } from "../analytics/widgetTelemetryService.js";
import { normalizeOutcomeSettings, normalizeSuccessUrlMatchMode } from "../conversion/conversionOutcomeService.js";
import {
  deriveAllowedDomains,
  listInstallStatusByAgentIds,
  normalizeAllowedDomains,
  requireAllowedAgentOrigin,
  requireAllowedInstallOrigin,
} from "../install/installPresenceService.js";
import {
  DEFAULT_AGENT_NAME,
  DEFAULT_LANGUAGE,
  DEFAULT_PURPOSE,
  DEFAULT_TONE,
  DEFAULT_WIDGET_CONFIG,
} from "./agentDefaults.js";
import { normalizeWidgetPurpose } from "./widgetPurpose.js";

const AGENTS_TABLE = "agents";
const WIDGET_CONFIGS_TABLE = "widget_configs";
const WEBSITE_CONTENT_TABLE = "website_content";
const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const DEFAULT_ACCESS_STATUS = "pending";
const CTA_MODES = ["booking", "quote", "checkout", "contact", "capture", "chat"];
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
].join(", ");

function normalizeAccessStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  return ["pending", "active", "suspended"].includes(normalized)
    ? normalized
    : DEFAULT_ACCESS_STATUS;
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

function normalizeAgentKey(value) {
  return slugifyLookupValue(value).replace(/_+/g, "");
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

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
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
  return digits.length >= 7 ? normalized : "";
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
    name: row.name || DEFAULT_AGENT_NAME,
    purpose: normalizeWidgetPurpose(row.purpose || DEFAULT_PURPOSE),
    systemPrompt: row.system_prompt || "",
    tone: row.tone || DEFAULT_TONE,
    language: row.language || DEFAULT_LANGUAGE,
    isActive: row.is_active !== false,
  };
}

function mapWidgetConfigRow(row) {
  const outcomeSettings = normalizeOutcomeSettings(row || {});

  return {
    ...DEFAULT_WIDGET_CONFIG,
    ...(row
      ? {
          assistantName: row.assistant_name ?? DEFAULT_WIDGET_CONFIG.assistantName,
          welcomeMessage: row.welcome_message ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
          buttonLabel: row.button_label ?? DEFAULT_WIDGET_CONFIG.buttonLabel,
          primaryColor: row.primary_color ?? DEFAULT_WIDGET_CONFIG.primaryColor,
          secondaryColor: row.secondary_color ?? DEFAULT_WIDGET_CONFIG.secondaryColor,
          launcherText: row.launcher_text ?? DEFAULT_WIDGET_CONFIG.launcherText,
          widgetLogoUrl: normalizeOptionalImageSource(row.widget_logo_url) || "",
          themeMode: row.theme_mode ?? DEFAULT_WIDGET_CONFIG.themeMode,
          bookingUrl: normalizeOptionalUrl(row.booking_url) || "",
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

  return {
    assistantName: cleanText(row?.assistant_name),
    welcomeMessage: cleanText(row?.welcome_message),
    buttonLabel: cleanText(row?.button_label),
    primaryColor: cleanText(row?.primary_color),
    secondaryColor: cleanText(row?.secondary_color),
    launcherText: cleanText(row?.launcher_text),
    widgetLogoUrl: normalizeOptionalImageSource(row?.widget_logo_url) || "",
    themeMode: cleanText(row?.theme_mode),
    bookingUrl: normalizeOptionalUrl(row?.booking_url) || "",
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

  if (error && isMissingWidgetRoutingColumnError(error)) {
    ({ data, error } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .upsert(buildWidgetConfigUpsertPayload(agentId, DEFAULT_WIDGET_CONFIG, {
        includeRoutingFields: false,
        includeWidgetLogoField: false,
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
    .eq("id", agentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
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

export async function getWidgetBootstrap(supabase, options = {}) {
  const installId = cleanText(options.installId);
  const requestedOrigin = cleanText(options.origin);
  const pageUrl = cleanText(options.pageUrl);
  let context = null;

  if (installId) {
    const installContext = await requireAllowedInstallOrigin(supabase, {
      installId,
      origin: requestedOrigin,
      pageUrl,
    });

    if (!installContext?.agent || !installContext.business) {
      const error = new Error("Install not found");
      error.statusCode = 404;
      throw error;
    }

    context = {
      agent: {
        id: installContext.agent.id,
        publicAgentKey: installContext.agent.public_agent_key || "",
        name: installContext.agent.name || DEFAULT_AGENT_NAME,
        purpose: normalizeWidgetPurpose(installContext.agent.purpose || DEFAULT_PURPOSE),
      },
      business: installContext.business,
      widgetConfig: mapWidgetConfigRow(installContext.widgetConfigRow),
      allowedDomains: installContext.allowedDomains,
    };
  } else {
    const resolvedContext = await resolveAgentContext(supabase, options);
    const publicOriginContext = await requireAllowedAgentOrigin(supabase, {
      agentId: resolvedContext.agent.id,
      installId: resolvedContext.widgetConfig.installId,
      origin: requestedOrigin,
      pageUrl,
    });

    context = {
      ...resolvedContext,
      allowedDomains: publicOriginContext.allowedDomains,
    };
  }

  return {
    agent: context.agent,
    business: {
      id: context.business.id,
      name: context.business.name,
      websiteUrl: context.business.website_url,
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
    .select("id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, tone, system_prompt, is_active")
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

  if (agentIds.length) {
    let { data: widgetRows, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT)
      .in("agent_id", agentIds);

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
    const { data: businessRows, error: businessError } = await supabase
      .from("businesses")
      .select("id, website_url")
      .in("id", businessIds);

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
    const websiteUrl = businessesById.get(row.business_id)?.website_url || "";

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
      installId: widgetConfig?.installId || "",
      allowedDomains: deriveAllowedDomains(widgetConfig?.allowedDomains, websiteUrl),
      isActive: row.is_active !== false,
      tone: row.tone || DEFAULT_TONE,
      systemPrompt: row.system_prompt || "",
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
      hasWidgetConfig: Boolean(widgetConfig),
      knowledge,
      installStatus: installStatusByAgentId.get(row.id) || buildDefaultInstallStatus(widgetConfig, websiteUrl),
      widgetMetrics: widgetMetricsByAgentId.get(row.id) || null,
      messageCount: messageStats.messageCount || 0,
      lastMessageAt: messageStats.lastMessageAt || null,
    };
  });

  let bridgeAgent = null;

  if (includeBridgeAgent && normalizedOwnerUserId && normalizedClientId && !agents.length) {
    bridgeAgent = await findClaimableAgentByClientId(supabase, {
      clientId: normalizedClientId,
      ownerUserId: normalizedOwnerUserId,
    });
  }

  return {
    agents,
    bridgeAgent,
  };
}

export async function listAllAgents(supabase) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, tone, system_prompt, is_active")
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

  if (agentIds.length) {
    let { data: widgetRows, error: widgetError } = await supabase
      .from(WIDGET_CONFIGS_TABLE)
      .select(WIDGET_CONFIG_SELECT)
      .in("agent_id", agentIds);

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
    const { data: businessRows, error: businessError } = await supabase
      .from("businesses")
      .select("id, website_url")
      .in("id", businessIds);

    if (businessError) {
      console.error(businessError);
      throw businessError;
    }

    businessesById = new Map((businessRows || []).map((row) => [row.id, row]));
  }

  if (agentIds.length) {
    messageStatsByAgentId = await getAgentMessageStats(supabase, agentIds);
    installStatusByAgentId = await listInstallStatusByAgentIds(supabase, agentIds);
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
    installId: widgetConfigsByAgentId.get(row.id)?.installId || "",
    allowedDomains: deriveAllowedDomains(
      widgetConfigsByAgentId.get(row.id)?.allowedDomains,
      businessesById.get(row.business_id)?.website_url || ""
    ),
    isActive: row.is_active !== false,
    tone: row.tone || DEFAULT_TONE,
    systemPrompt: row.system_prompt || "",
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
  const normalizedAgentId = cleanText(agentId);

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

  return agent;
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
  } = options;
  const hasField = (fieldName) => Object.prototype.hasOwnProperty.call(options, fieldName);
  const hasSubmittedRoutingField = ROUTING_WIDGET_CONFIG_KEYS.some((fieldName) => hasField(fieldName));
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

  const providedBookingUrl = hasField("bookingUrl") ? cleanText(bookingUrl) : "";
  const normalizedBookingUrl = normalizeOptionalUrl(providedBookingUrl);
  if (hasField("bookingUrl") && providedBookingUrl && !normalizedBookingUrl) {
    throw buildInvalidDirectUrlError("the booking route");
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

  const nextAssistantName = cleanText(assistantName) || cleanText(name) || agent.name || DEFAULT_AGENT_NAME;
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
        installId: currentWidgetConfig.installId || "",
        allowedDomainsRaw: normalizeAllowedDomains(currentWidgetConfig.allowedDomains, {
          allowEmpty: true,
        }),
      };
  const nextWelcomeMessage = hasField("welcomeMessage")
    ? cleanText(welcomeMessage)
    : persistedWidgetConfig.welcomeMessage;
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
  const currentBusiness = agent.businessId
    ? await findBusinessByIdentifier(supabase, agent.businessId)
    : null;
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
      allowedDomains: nextAllowedDomainsRaw,
    }), { onConflict: "agent_id" })
    .select(WIDGET_CONFIG_SELECT)
    .single();

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
    name: nextAssistantName,
    assistantName: nextAssistantName,
    purpose: nextPurpose,
    tone: nextTone,
    systemPrompt: nextSystemPrompt,
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
    .select("id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, tone, system_prompt, is_active")
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
    return !existingOwnerUserId || existingOwnerUserId === normalizedOwnerUserId;
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

  if (normalizeAccessStatus(agent.accessStatus) !== "active") {
    const error = new Error("Access is not active yet.");
    error.statusCode = 403;
    throw error;
  }

  return agent;
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    )
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
    .select(
      "id, business_id, client_id, owner_user_id, access_status, public_agent_key, name, purpose, system_prompt, tone, language, is_active"
    );

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((row) => mapAgentRow(row));
}

export { AGENTS_TABLE, WIDGET_CONFIGS_TABLE };
