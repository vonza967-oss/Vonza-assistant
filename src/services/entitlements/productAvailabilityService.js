export const PRODUCT_KEYS = Object.freeze({
  FRONT_DESK: "front_desk",
  WEBSITE_WIDGET: "website_widget",
  VOICE_AGENT: "voice_agent",
});

export const PRODUCT_KEY_VALUES = Object.freeze(Object.values(PRODUCT_KEYS));

export const AVAILABILITY_STATUSES = Object.freeze({
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  PENDING_ACCOUNT_ACCESS: "pending_account_access",
  COMING_SOON: "coming_soon",
  UNKNOWN: "unknown",
});

export const REASON_CODES = Object.freeze({
  ACCOUNT_ACCESS_ACTIVE: "account_access_active",
  ACCOUNT_ACCESS_PENDING: "account_access_pending",
  ACCOUNT_ACCESS_SUSPENDED: "account_access_suspended",
  ACCOUNT_CAPACITY_CAPPED: "account_capacity_capped",
  PRODUCT_KEY_UNKNOWN: "product_key_unknown",
  PRODUCT_CHECKOUT_NOT_CONFIGURED: "product_checkout_not_configured",
  PRODUCT_ENFORCEMENT_NOT_ENABLED: "product_enforcement_not_enabled",
  CAPABILITY_UNKNOWN: "capability_unknown",
});

const PRODUCT_ALIASES = Object.freeze({
  "ai-front-desk": PRODUCT_KEYS.FRONT_DESK,
  "ai front desk": PRODUCT_KEYS.FRONT_DESK,
  assistant: PRODUCT_KEYS.FRONT_DESK,
  frontdesk: PRODUCT_KEYS.FRONT_DESK,
  "front-desk": PRODUCT_KEYS.FRONT_DESK,
  "front desk": PRODUCT_KEYS.FRONT_DESK,
  [PRODUCT_KEYS.FRONT_DESK]: PRODUCT_KEYS.FRONT_DESK,
  fullpage: PRODUCT_KEYS.FRONT_DESK,
  "full-page": PRODUCT_KEYS.FRONT_DESK,
  "full page": PRODUCT_KEYS.FRONT_DESK,

  embed: PRODUCT_KEYS.WEBSITE_WIDGET,
  "web-widget": PRODUCT_KEYS.WEBSITE_WIDGET,
  webwidget: PRODUCT_KEYS.WEBSITE_WIDGET,
  widget: PRODUCT_KEYS.WEBSITE_WIDGET,
  "website-widget": PRODUCT_KEYS.WEBSITE_WIDGET,
  "website widget": PRODUCT_KEYS.WEBSITE_WIDGET,
  [PRODUCT_KEYS.WEBSITE_WIDGET]: PRODUCT_KEYS.WEBSITE_WIDGET,

  call: PRODUCT_KEYS.VOICE_AGENT,
  phone: PRODUCT_KEYS.VOICE_AGENT,
  voice: PRODUCT_KEYS.VOICE_AGENT,
  voiceagent: PRODUCT_KEYS.VOICE_AGENT,
  "voice-agent": PRODUCT_KEYS.VOICE_AGENT,
  "voice agent": PRODUCT_KEYS.VOICE_AGENT,
  [PRODUCT_KEYS.VOICE_AGENT]: PRODUCT_KEYS.VOICE_AGENT,
});

const PRODUCT_DEFINITIONS = Object.freeze({
  [PRODUCT_KEYS.FRONT_DESK]: Object.freeze({
    product_key: PRODUCT_KEYS.FRONT_DESK,
    label: "Front Desk",
    setup_url: "/dashboard/front-desk",
    capabilities: Object.freeze([
      "public_front_desk_page",
      "visitor_conversation",
      "knowledge_grounded_answers",
    ]),
  }),
  [PRODUCT_KEYS.WEBSITE_WIDGET]: Object.freeze({
    product_key: PRODUCT_KEYS.WEBSITE_WIDGET,
    label: "Website Widget",
    setup_url: "/dashboard/widget",
    capabilities: Object.freeze([
      "website_embed",
      "visitor_conversation",
      "install_detection",
    ]),
  }),
  [PRODUCT_KEYS.VOICE_AGENT]: Object.freeze({
    product_key: PRODUCT_KEYS.VOICE_AGENT,
    label: "Voice Agent",
    setup_url: "/dashboard/voice",
    capabilities: Object.freeze([
      "browser_voice_input",
      "spoken_replies",
      "web_call_setup",
    ]),
  }),
});

const ACCOUNT_BILLING_UPGRADE_URL = "/dashboard#settings/account-billing";

function cleanValue(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeLookupValue(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function normalizeAccessStatus(value) {
  const normalized = cleanValue(value).toLowerCase();

  if (normalized === "active") {
    return "active";
  }

  if (normalized === "suspended") {
    return "suspended";
  }

  return "pending";
}

function resolveAccessStatus(input = {}) {
  return normalizeAccessStatus(
    input.accessStatus
      || input.access_status
      || input.accountAccessStatus
      || input.account_access_status
      || input.agent?.accessStatus
      || input.agent?.access_status
      || input.account?.accessStatus
      || input.account?.access_status
  );
}

function resolveIsCapped(input = {}) {
  return Boolean(
    input.isCapped
      || input.is_capped
      || input.accountCapacityCapped
      || input.account_capacity_capped
      || input.usage?.isCapped
      || input.usage?.is_capped
      || input.billingSnapshot?.usage?.isCapped
      || input.billingSnapshot?.usage?.is_capped
      || input.billing?.usage?.isCapped
      || input.billing?.usage?.is_capped
  );
}

function buildAvailabilityPayload(productKey, status, reasonCode, options = {}) {
  const definition = PRODUCT_DEFINITIONS[productKey];
  const fallbackLabel = cleanValue(options.label) || "Unknown product";

  return {
    product_key: productKey,
    status,
    label: definition?.label || fallbackLabel,
    reason_code: reasonCode,
    is_enforced: false,
    setup_url: definition?.setup_url || null,
    upgrade_url: options.upgradeUrl === undefined ? null : options.upgradeUrl,
    capabilities: definition ? Array.from(definition.capabilities) : [],
  };
}

export function normalizeProductKey(value) {
  const lookupValue = normalizeLookupValue(value);

  if (!lookupValue) {
    return "";
  }

  return PRODUCT_ALIASES[lookupValue] || "";
}

export function getProductAvailability(input = {}) {
  const requestedProductKey = input.productKey || input.product_key || input.key;
  const productKey = normalizeProductKey(requestedProductKey);

  if (!productKey) {
    return buildAvailabilityPayload(
      cleanValue(requestedProductKey) || "unknown",
      AVAILABILITY_STATUSES.UNKNOWN,
      REASON_CODES.PRODUCT_KEY_UNKNOWN
    );
  }

  const accessStatus = resolveAccessStatus(input);

  if (accessStatus === "suspended") {
    return buildAvailabilityPayload(
      productKey,
      AVAILABILITY_STATUSES.UNAVAILABLE,
      REASON_CODES.ACCOUNT_ACCESS_SUSPENDED,
      { upgradeUrl: ACCOUNT_BILLING_UPGRADE_URL }
    );
  }

  if (accessStatus !== "active") {
    return buildAvailabilityPayload(
      productKey,
      AVAILABILITY_STATUSES.PENDING_ACCOUNT_ACCESS,
      REASON_CODES.ACCOUNT_ACCESS_PENDING,
      { upgradeUrl: ACCOUNT_BILLING_UPGRADE_URL }
    );
  }

  if (resolveIsCapped(input)) {
    return buildAvailabilityPayload(
      productKey,
      AVAILABILITY_STATUSES.UNAVAILABLE,
      REASON_CODES.ACCOUNT_CAPACITY_CAPPED,
      { upgradeUrl: ACCOUNT_BILLING_UPGRADE_URL }
    );
  }

  return buildAvailabilityPayload(
    productKey,
    AVAILABILITY_STATUSES.AVAILABLE,
    REASON_CODES.ACCOUNT_ACCESS_ACTIVE,
    { upgradeUrl: ACCOUNT_BILLING_UPGRADE_URL }
  );
}

export function listProductAvailability(input = {}) {
  return PRODUCT_KEY_VALUES.map((productKey) =>
    getProductAvailability({
      ...input,
      productKey,
    })
  );
}
