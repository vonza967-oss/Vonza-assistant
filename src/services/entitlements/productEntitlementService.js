import { OWNER_PRODUCT_ENTITLEMENT_TABLE } from "../../config/constants.js";
import {
  AVAILABILITY_STATUSES,
  PRODUCT_KEY_VALUES,
  getProductAvailability,
} from "./productAvailabilityService.js";

const ENTITLEMENT_SELECT = [
  "id",
  "owner_user_id",
  "product_key",
  "entitlement_status",
  "source",
  "plan_key",
  "current_period_start",
  "current_period_end",
  "trial_start",
  "trial_end",
  "cancel_at",
  "canceled_at",
  "expires_at",
  "feature_caps",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

export const PRODUCT_ENTITLEMENT_REASON_CODES = Object.freeze({
  ACTIVE: "product_entitlement_active",
  TRIALING: "product_entitlement_trialing",
  GRANDFATHERED: "product_entitlement_grandfathered",
  BETA: "product_entitlement_beta",
  FREE: "product_entitlement_free",
  PAST_DUE: "product_entitlement_past_due",
  CANCELED: "product_entitlement_canceled",
  INACTIVE: "product_entitlement_inactive",
});

const AVAILABLE_ENTITLEMENT_STATUSES = new Set([
  "active",
  "trialing",
  "grandfathered",
  "beta",
  "free",
]);

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeEntitlementStatus(value) {
  const normalized = cleanText(value).toLowerCase();

  if (AVAILABLE_ENTITLEMENT_STATUSES.has(normalized)) {
    return normalized;
  }

  if (normalized === "past_due" || normalized === "past-due") {
    return "past_due";
  }

  if (normalized === "canceled" || normalized === "cancelled") {
    return "canceled";
  }

  return "inactive";
}

function cloneJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return structuredClone(value);
}

function normalizeEntitlementRow(row = {}) {
  const entitlementStatus = normalizeEntitlementStatus(row.entitlement_status);

  return {
    id: cleanText(row.id) || null,
    product_key: cleanText(row.product_key),
    entitlement_status: entitlementStatus,
    source: cleanText(row.source) || "unknown",
    plan_key: cleanText(row.plan_key) || null,
    current_period_start: cleanText(row.current_period_start) || null,
    current_period_end: cleanText(row.current_period_end) || null,
    trial_start: cleanText(row.trial_start) || null,
    trial_end: cleanText(row.trial_end) || null,
    cancel_at: cleanText(row.cancel_at) || null,
    canceled_at: cleanText(row.canceled_at) || null,
    expires_at: cleanText(row.expires_at) || null,
    feature_caps: cloneJsonObject(row.feature_caps),
    metadata: cloneJsonObject(row.metadata),
    created_at: cleanText(row.created_at) || null,
    updated_at: cleanText(row.updated_at) || null,
  };
}

function getEntitlementReasonCode(entitlementStatus) {
  if (entitlementStatus === "trialing") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.TRIALING;
  }

  if (entitlementStatus === "grandfathered") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.GRANDFATHERED;
  }

  if (entitlementStatus === "beta") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.BETA;
  }

  if (entitlementStatus === "free") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.FREE;
  }

  if (entitlementStatus === "past_due") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.PAST_DUE;
  }

  if (entitlementStatus === "canceled") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.CANCELED;
  }

  if (entitlementStatus === "active") {
    return PRODUCT_ENTITLEMENT_REASON_CODES.ACTIVE;
  }

  return PRODUCT_ENTITLEMENT_REASON_CODES.INACTIVE;
}

function buildFallbackAvailability(productKey, options = {}) {
  return getProductAvailability({
    ...options,
    productKey,
  });
}

function buildEntitlementAvailability(row, fallbackAvailability) {
  const entitlementStatus = row.entitlement_status;
  const isAvailable = AVAILABLE_ENTITLEMENT_STATUSES.has(entitlementStatus);

  return {
    ...fallbackAvailability,
    status: isAvailable
      ? AVAILABILITY_STATUSES.AVAILABLE
      : AVAILABILITY_STATUSES.UNAVAILABLE,
    reason_code: getEntitlementReasonCode(entitlementStatus),
    is_enforced: false,
    entitlement_status: entitlementStatus,
    entitlement_source: row.source,
    entitlement_row_exists: true,
    status_source: OWNER_PRODUCT_ENTITLEMENT_TABLE,
    entitlement: row,
  };
}

function buildMissingEntitlementAvailability(productKey, options = {}) {
  const fallbackAvailability = buildFallbackAvailability(productKey, options);

  return {
    ...fallbackAvailability,
    is_enforced: false,
    entitlement_status: "missing",
    entitlement_source: "account_access_fallback",
    entitlement_row_exists: false,
    status_source: "account_access_fallback",
    entitlement: null,
  };
}

export function buildFallbackProductEntitlements(options = {}) {
  return PRODUCT_KEY_VALUES.map((productKey) =>
    buildMissingEntitlementAvailability(productKey, options)
  );
}

export function normalizeOwnerProductEntitlements(rows = [], options = {}) {
  const rowByProductKey = new Map(
    rows
      .map((row) => normalizeEntitlementRow(row))
      .filter((row) => PRODUCT_KEY_VALUES.includes(row.product_key))
      .map((row) => [row.product_key, row])
  );

  return PRODUCT_KEY_VALUES.map((productKey) => {
    const row = rowByProductKey.get(productKey);
    const fallbackAvailability = buildFallbackAvailability(productKey, options);

    return row
      ? buildEntitlementAvailability(row, fallbackAvailability)
      : buildMissingEntitlementAvailability(productKey, options);
  });
}

export async function listOwnerProductEntitlements(supabase, options = {}) {
  const ownerUserId = cleanText(options.ownerUserId || options.owner_user_id);

  if (!ownerUserId) {
    const error = new Error("owner_user_id is required");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(OWNER_PRODUCT_ENTITLEMENT_TABLE)
    .select(ENTITLEMENT_SELECT)
    .eq("owner_user_id", ownerUserId);

  if (error) {
    throw error;
  }

  return normalizeOwnerProductEntitlements(Array.isArray(data) ? data : [], options);
}
