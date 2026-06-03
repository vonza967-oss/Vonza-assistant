import { createHash, timingSafeEqual } from "node:crypto";

import { CONNECTED_APP_CONNECTION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const WHATSAPP_PROVIDER = "whatsapp";
const WHATSAPP_APP_KEY = "whatsapp.business";
const WHATSAPP_WEBHOOK_CAPABILITY = "whatsapp.business.webhook";
const WHATSAPP_WEBHOOK_OBJECT = "whatsapp_business_account";
const VERIFY_TOKEN_SECRET_REF_PREFIX = "whatsapp-webhook-verify-token-sha256:";
const VERIFY_TOKEN_HASH_CONTEXT = "vonza:whatsapp:webhook-verify-token:v1";
const MAX_EVENT_TYPES = 8;

const CONNECTION_SELECT = [
  "id",
  "owner_user_id",
  "provider",
  "app_key",
  "capability_keys",
  "status",
  "provider_account_id",
  "webhook_status",
  "token_secret_ref",
  "last_verified_at",
  "needs_attention_reason",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const SAFE_EXISTING_METADATA_KEYS = new Set([
  "whatsappBusinessAccountId",
  "phoneNumberId",
  "displayPhoneNumber",
  "businessDisplayName",
  "webhookVerifyStatus",
  "graphApiVersion",
  "webhookVerifiedAt",
  "lastWebhookReceivedAt",
  "lastWebhookObject",
  "lastWebhookEventTypes",
]);

const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;

function buildWhatsAppWebhookError(message, statusCode = 403, code = "whatsapp_webhook_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeStringList(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  const seen = new Set();

  return values.flatMap((item) => {
    const normalized = normalizeKey(item);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeSafeMetadataString(value, maxLength = 160) {
  const normalized = cleanText(value);

  if (
    !normalized
    || normalized.length > maxLength
    || SECRET_LOOKING_VALUE_PATTERN.test(normalized)
    || JWT_LOOKING_VALUE_PATTERN.test(normalized)
    || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(normalized)
  ) {
    return "";
  }

  return normalized;
}

function normalizeTimestamp(value) {
  const normalized = normalizeSafeMetadataString(value, 64);

  return /^\d{4}-\d{2}-\d{2}T/.test(normalized) ? normalized : "";
}

function normalizeWebhookObject(value) {
  const normalized = normalizeKey(value);

  return normalized === WHATSAPP_WEBHOOK_OBJECT ? normalized : "";
}

function normalizeEventType(value) {
  const normalized = normalizeKey(value).replace(/[^a-z0-9_.-]+/g, "_");

  return /^[a-z][a-z0-9_.-]{0,63}$/.test(normalized) ? normalized : "";
}

function normalizeEventTypes(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const eventType = normalizeEventType(item);

    if (!eventType || seen.has(eventType) || seen.size >= MAX_EVENT_TYPES) {
      return [];
    }

    seen.add(eventType);
    return [eventType];
  });
}

function safeExistingMetadata(metadata) {
  const plainMetadata = normalizePlainObject(metadata);
  const safeMetadata = {};

  for (const [key, value] of Object.entries(plainMetadata)) {
    if (!SAFE_EXISTING_METADATA_KEYS.has(key)) {
      continue;
    }

    if (key === "lastWebhookEventTypes") {
      const eventTypes = normalizeEventTypes(value);
      if (eventTypes.length > 0) {
        safeMetadata[key] = eventTypes;
      }
      continue;
    }

    if (key === "webhookVerifiedAt" || key === "lastWebhookReceivedAt") {
      const timestamp = normalizeTimestamp(value);
      if (timestamp) {
        safeMetadata[key] = timestamp;
      }
      continue;
    }

    if (key === "lastWebhookObject") {
      const object = normalizeWebhookObject(value);
      if (object) {
        safeMetadata[key] = object;
      }
      continue;
    }

    const stringValue = normalizeSafeMetadataString(value);
    if (stringValue) {
      safeMetadata[key] = stringValue;
    }
  }

  return safeMetadata;
}

function isoFromNow(now) {
  if (now instanceof Date && Number.isFinite(now.getTime())) {
    return now.toISOString();
  }

  const parsed = new Date(now);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(cleanText(left));
  const rightBuffer = Buffer.from(cleanText(right));

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getQueryValue(query = {}, key) {
  const value = query[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getStoredVerifyTokenHash(connection = {}) {
  const tokenSecretRef = cleanText(connection.token_secret_ref);

  if (!tokenSecretRef.startsWith(VERIFY_TOKEN_SECRET_REF_PREFIX)) {
    return "";
  }

  const hash = tokenSecretRef.slice(VERIFY_TOKEN_SECRET_REF_PREFIX.length);

  return /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : "";
}

function hasWhatsAppWebhookCapability(connection = {}) {
  const capabilityKeys = new Set(normalizeStringList(connection.capability_keys));

  return normalizeKey(connection.provider) === WHATSAPP_PROVIDER
    && normalizeKey(connection.app_key) === WHATSAPP_APP_KEY
    && capabilityKeys.has(WHATSAPP_WEBHOOK_CAPABILITY);
}

function assertUsableWhatsAppWebhookConnection(connection = {}) {
  if (!connection || !cleanText(connection.id) || !hasWhatsAppWebhookCapability(connection)) {
    throw buildWhatsAppWebhookError(
      "WhatsApp webhook connection not found.",
      404,
      "whatsapp_webhook_connection_not_found"
    );
  }

  if (normalizeKey(connection.status) !== "active") {
    throw buildWhatsAppWebhookError(
      "WhatsApp webhook connection is not active.",
      403,
      "whatsapp_webhook_connection_inactive"
    );
  }
}

async function fetchWhatsAppWebhookConnection(supabase, connectionId) {
  const normalizedConnectionId = cleanText(connectionId);

  if (!normalizedConnectionId || normalizedConnectionId.length > 96) {
    throw buildWhatsAppWebhookError(
      "WhatsApp webhook connection not found.",
      404,
      "whatsapp_webhook_connection_not_found"
    );
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select(CONNECTION_SELECT)
    .eq("id", normalizedConnectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  assertUsableWhatsAppWebhookConnection(data);
  return data;
}

async function updateWhatsAppWebhookConnection(supabase, connection, updatePayload) {
  const ownerUserId = cleanText(connection.owner_user_id);
  let query = supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .update({
      ...updatePayload,
      updated_at: updatePayload.updated_at || new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (ownerUserId) {
    query = query.eq("owner_user_id", ownerUserId);
  }

  const { data, error } = await query
    .select(CONNECTION_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildWhatsAppWebhookError(
      "WhatsApp webhook connection not found.",
      404,
      "whatsapp_webhook_connection_not_found"
    );
  }

  return data;
}

export function deriveWhatsAppVerifyTokenHash({ connectionId, verifyToken } = {}) {
  const normalizedConnectionId = cleanText(connectionId);
  const normalizedVerifyToken = cleanText(verifyToken);

  if (!normalizedConnectionId || !normalizedVerifyToken) {
    return "";
  }

  return createHash("sha256")
    .update(`${VERIFY_TOKEN_HASH_CONTEXT}:${normalizedConnectionId}:${normalizedVerifyToken}`)
    .digest("hex");
}

export function buildWhatsAppVerifyTokenSecretRef(input = {}) {
  const hash = deriveWhatsAppVerifyTokenHash(input);

  return hash ? `${VERIFY_TOKEN_SECRET_REF_PREFIX}${hash}` : "";
}

export function parseWhatsAppWebhookPayload(payload = {}) {
  const body = normalizePlainObject(payload);
  const object = normalizeWebhookObject(body.object);
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const eventTypes = [];
  const entryIds = [];

  for (const rawEntry of entries.slice(0, 20)) {
    const entry = normalizePlainObject(rawEntry);
    const entryId = normalizeSafeMetadataString(entry.id, 96);

    if (entryId) {
      entryIds.push(entryId);
    }

    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes.slice(0, 20)) {
      const change = normalizePlainObject(rawChange);
      const field = normalizeEventType(change.field);
      const value = normalizePlainObject(change.value);

      if (Array.isArray(value.messages)) {
        eventTypes.push("messages");
      }

      if (Array.isArray(value.statuses)) {
        eventTypes.push("statuses");
      }

      if (!Array.isArray(value.messages) && !Array.isArray(value.statuses) && field) {
        eventTypes.push(field);
      }
    }
  }

  return {
    object,
    entryIds: normalizeStringList(entryIds),
    eventTypes: normalizeEventTypes(eventTypes),
  };
}

export async function verifyWhatsAppWebhookChallenge(supabase, options = {}) {
  const query = normalizePlainObject(options.query);
  const connectionId = cleanText(options.connectionId || options.connection_id);
  const mode = cleanText(options.mode || getQueryValue(query, "hub.mode"));
  const verifyToken = cleanText(options.verifyToken || getQueryValue(query, "hub.verify_token"));
  const challenge = cleanText(options.challenge || getQueryValue(query, "hub.challenge"));

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    throw buildWhatsAppWebhookError(
      "Invalid WhatsApp webhook verification request.",
      403,
      "whatsapp_webhook_verification_invalid"
    );
  }

  const connection = await fetchWhatsAppWebhookConnection(supabase, connectionId);
  const storedVerifyTokenHash = getStoredVerifyTokenHash(connection);

  if (!storedVerifyTokenHash) {
    throw buildWhatsAppWebhookError(
      "WhatsApp webhook verifier is not configured.",
      403,
      "whatsapp_webhook_verifier_missing"
    );
  }

  const suppliedVerifyTokenHash = deriveWhatsAppVerifyTokenHash({
    connectionId: connection.id,
    verifyToken,
  });

  if (!timingSafeEqualText(storedVerifyTokenHash, suppliedVerifyTokenHash)) {
    throw buildWhatsAppWebhookError(
      "Invalid WhatsApp webhook verification request.",
      403,
      "whatsapp_webhook_verification_invalid"
    );
  }

  const verifiedAt = isoFromNow(options.now);
  const metadata = {
    ...safeExistingMetadata(connection.metadata),
    webhookVerifiedAt: verifiedAt,
  };

  await updateWhatsAppWebhookConnection(supabase, connection, {
    webhook_status: "active",
    last_verified_at: verifiedAt,
    needs_attention_reason: null,
    metadata,
    updated_at: verifiedAt,
  });

  return {
    ok: true,
    challenge,
    connectionId: connection.id,
    webhookStatus: "active",
  };
}

export async function recordWhatsAppWebhookReceipt(supabase, options = {}) {
  const connectionId = cleanText(options.connectionId || options.connection_id);
  const connection = await fetchWhatsAppWebhookConnection(supabase, connectionId);
  const summary = parseWhatsAppWebhookPayload(options.payload);

  if (summary.object !== WHATSAPP_WEBHOOK_OBJECT) {
    return {
      ok: true,
      received: true,
      ignored: true,
      eventTypes: [],
    };
  }

  const providerAccountId = normalizeKey(connection.provider_account_id);

  if (
    providerAccountId
    && summary.entryIds.length > 0
    && !summary.entryIds.includes(providerAccountId.toLowerCase())
  ) {
    throw buildWhatsAppWebhookError(
      "Invalid WhatsApp webhook connection scope.",
      403,
      "whatsapp_webhook_connection_scope_mismatch"
    );
  }

  const receivedAt = isoFromNow(options.now);
  const metadata = {
    ...safeExistingMetadata(connection.metadata),
    lastWebhookReceivedAt: receivedAt,
    lastWebhookObject: WHATSAPP_WEBHOOK_OBJECT,
    lastWebhookEventTypes: summary.eventTypes,
  };

  await updateWhatsAppWebhookConnection(supabase, connection, {
    metadata,
    updated_at: receivedAt,
  });

  return {
    ok: true,
    received: true,
    ignored: false,
    eventTypes: summary.eventTypes,
  };
}
