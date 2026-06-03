import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { CONNECTED_APP_CONNECTION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { createConnectedAppInboundEvent } from "./connectedAppInboundEventService.js";
import { resolveConnectedAppInboundThread } from "./connectedAppInboundThreadService.js";

const WHATSAPP_PROVIDER = "whatsapp";
const WHATSAPP_APP_KEY = "whatsapp.business";
const WHATSAPP_WEBHOOK_CAPABILITY = "whatsapp.business.webhook";
const WHATSAPP_WEBHOOK_OBJECT = "whatsapp_business_account";
const VERIFY_TOKEN_SECRET_REF_PREFIX = "whatsapp-webhook-verify-token-sha256:";
const VERIFY_TOKEN_HASH_CONTEXT = "vonza:whatsapp:webhook-verify-token:v1";
const MAX_EVENT_TYPES = 8;
const MAX_MESSAGE_TYPES = 8;

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
  "businessDisplayName",
  "webhookVerifyStatus",
  "graphApiVersion",
  "webhookVerifiedAt",
  "lastWebhookReceivedAt",
  "lastWebhookObject",
  "lastWebhookEventTypes",
  "lastWebhookSignatureStatus",
  "lastWebhookMessageTypes",
]);

const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;
const URL_LOOKING_VALUE_PATTERN = /\bhttps?:\/\//i;

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
    || URL_LOOKING_VALUE_PATTERN.test(normalized)
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

function normalizeMessageType(value) {
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

function normalizeMessageTypes(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const messageType = normalizeMessageType(item);

    if (!messageType || seen.has(messageType) || seen.size >= MAX_MESSAGE_TYPES) {
      return [];
    }

    seen.add(messageType);
    return [messageType];
  });
}

function normalizeProviderTimestamp(value) {
  const normalized = normalizeSafeMetadataString(value, 64);

  return /^(?:\d{1,16}|\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+)$/.test(normalized) ? normalized : "";
}

function normalizeRawBody(rawBody) {
  if (Buffer.isBuffer(rawBody)) {
    return rawBody;
  }

  if (rawBody instanceof Uint8Array) {
    return Buffer.from(rawBody);
  }

  if (typeof rawBody === "string") {
    return Buffer.from(rawBody, "utf8");
  }

  return Buffer.from("", "utf8");
}

function parseWebhookBody(payload) {
  if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
    try {
      return normalizePlainObject(JSON.parse(Buffer.from(payload).toString("utf8")));
    } catch {
      return {};
    }
  }

  if (typeof payload === "string") {
    try {
      return normalizePlainObject(JSON.parse(payload));
    } catch {
      return {};
    }
  }

  return normalizePlainObject(payload);
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

    if (key === "lastWebhookMessageTypes") {
      const messageTypes = normalizeMessageTypes(value);
      if (messageTypes.length > 0) {
        safeMetadata[key] = messageTypes;
      }
      continue;
    }

    if (key === "lastWebhookSignatureStatus") {
      const signatureStatus = normalizeEventType(value);
      if (["verified", "not_configured", "missing", "malformed", "invalid"].includes(signatureStatus)) {
        safeMetadata[key] = signatureStatus;
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

function parseMetaWebhookSignatureHex(signatureHeader) {
  const normalized = cleanText(signatureHeader);
  const match = normalized.match(/^sha256=([a-f0-9]{64})$/i);

  return match ? match[1].toLowerCase() : "";
}

function timingSafeEqualHex(leftHex, rightHex) {
  if (!/^[a-f0-9]{64}$/i.test(leftHex) || !/^[a-f0-9]{64}$/i.test(rightHex)) {
    return false;
  }

  const leftBuffer = Buffer.from(leftHex, "hex");
  const rightBuffer = Buffer.from(rightHex, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function getMetaWebhookSignatureHeader(headers = {}) {
  if (headers && typeof headers.get === "function") {
    return cleanText(headers.get("x-hub-signature-256"));
  }

  const plainHeaders = normalizePlainObject(headers);

  for (const [key, value] of Object.entries(plainHeaders)) {
    if (normalizeKey(key) !== "x-hub-signature-256") {
      continue;
    }

    return cleanText(Array.isArray(value) ? value[0] : value);
  }

  return "";
}

export function buildMetaWebhookSignature(rawBody, appSecret) {
  const secret = cleanText(appSecret);

  if (!secret) {
    return "";
  }

  const digest = createHmac("sha256", secret)
    .update(normalizeRawBody(rawBody))
    .digest("hex");

  return `sha256=${digest}`;
}

export function verifyMetaWebhookSignature({
  rawBody,
  signatureHeader,
  appSecret,
} = {}) {
  const secret = cleanText(appSecret);

  if (!secret) {
    return {
      ok: false,
      verified: false,
      status: "not_configured",
    };
  }

  const suppliedSignatureHex = parseMetaWebhookSignatureHex(signatureHeader);

  if (!cleanText(signatureHeader)) {
    return {
      ok: false,
      verified: false,
      status: "missing",
    };
  }

  if (!suppliedSignatureHex) {
    return {
      ok: false,
      verified: false,
      status: "malformed",
    };
  }

  const expectedSignatureHex = parseMetaWebhookSignatureHex(
    buildMetaWebhookSignature(rawBody, secret)
  );
  const verified = timingSafeEqualHex(expectedSignatureHex, suppliedSignatureHex);

  return {
    ok: verified,
    verified,
    status: verified ? "verified" : "invalid",
  };
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

function buildBaseWebhookEvent({ object, entry, value }) {
  const metadata = normalizePlainObject(value.metadata);

  return {
    object,
    entryId: normalizeSafeMetadataString(entry.id, 96),
    phoneNumberId: normalizeSafeMetadataString(metadata.phone_number_id, 96),
  };
}

function normalizeMessageEvent({ object, entry, value, message }) {
  const text = normalizePlainObject(message.text);
  const textBody = cleanText(text.body);
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const messageType = normalizeMessageType(message.type) || "unknown";
  const event = {
    ...buildBaseWebhookEvent({ object, entry, value }),
    eventType: "message",
    messageId: normalizeSafeMetadataString(message.id, 160),
    messageType,
    timestamp: normalizeProviderTimestamp(message.timestamp),
    status: "",
    metadata: {},
  };

  if (textBody) {
    event.metadata.hasText = true;
    event.metadata.textLength = textBody.length;
  }

  if (contacts.length > 0) {
    event.metadata.contactPresent = true;
  }

  return event;
}

function normalizeStatusEvent({ object, entry, value, status }) {
  return {
    ...buildBaseWebhookEvent({ object, entry, value }),
    eventType: "status",
    messageId: normalizeSafeMetadataString(status.id, 160),
    messageType: "",
    timestamp: normalizeProviderTimestamp(status.timestamp),
    status: normalizeEventType(status.status),
    metadata: {},
  };
}

function normalizeUnknownEvent({ object, entry, value, field }) {
  return {
    ...buildBaseWebhookEvent({ object, entry, value }),
    eventType: "unknown",
    messageId: "",
    messageType: "",
    timestamp: "",
    status: "",
    metadata: field ? { field } : {},
  };
}

export function extractWhatsAppWebhookEvents(payload = {}) {
  const body = parseWebhookBody(payload);
  const object = normalizeWebhookObject(body.object);
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const events = [];

  for (const rawEntry of entries.slice(0, 20)) {
    const entry = normalizePlainObject(rawEntry);
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes.slice(0, 20)) {
      const change = normalizePlainObject(rawChange);
      const field = normalizeEventType(change.field);
      const value = normalizePlainObject(change.value);
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const rawMessage of messages.slice(0, 20)) {
        const message = normalizePlainObject(rawMessage);
        events.push(normalizeMessageEvent({
          object,
          entry,
          value,
          message,
        }));
      }

      for (const rawStatus of statuses.slice(0, 20)) {
        const status = normalizePlainObject(rawStatus);
        events.push(normalizeStatusEvent({
          object,
          entry,
          value,
          status,
        }));
      }

      if (messages.length === 0 && statuses.length === 0 && field) {
        events.push(normalizeUnknownEvent({
          object,
          entry,
          value,
          field,
        }));
      }
    }
  }

  return events;
}

function extractWhatsAppWebhookThreadKeys(payload = {}) {
  const body = parseWebhookBody(payload);
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const threadKeys = [];

  for (const rawEntry of entries.slice(0, 20)) {
    const entry = normalizePlainObject(rawEntry);
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes.slice(0, 20)) {
      const change = normalizePlainObject(rawChange);
      const field = normalizeEventType(change.field);
      const value = normalizePlainObject(change.value);
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const rawMessage of messages.slice(0, 20)) {
        const message = normalizePlainObject(rawMessage);
        threadKeys.push(normalizeSafeMetadataString(message.from, 160));
      }

      for (const rawStatus of statuses.slice(0, 20)) {
        const status = normalizePlainObject(rawStatus);
        threadKeys.push(normalizeSafeMetadataString(status.recipient_id, 160));
      }

      if (messages.length === 0 && statuses.length === 0 && field) {
        threadKeys.push("");
      }
    }
  }

  return threadKeys;
}

export function normalizeWhatsAppWebhookPayload(payload = {}) {
  const body = parseWebhookBody(payload);
  const object = normalizeWebhookObject(body.object);
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const entryIds = entries.flatMap((rawEntry) => {
    const entryId = normalizeSafeMetadataString(normalizePlainObject(rawEntry).id, 96);

    return entryId ? [entryId] : [];
  });
  const events = extractWhatsAppWebhookEvents(body);

  return {
    object,
    entryIds: normalizeStringList(entryIds),
    eventTypes: normalizeEventTypes(events.map((event) => event.eventType)),
    messageTypes: normalizeMessageTypes(events.map((event) => event.messageType)),
    events,
  };
}

export function parseWhatsAppWebhookPayload(payload = {}) {
  const summary = normalizeWhatsAppWebhookPayload(payload);

  return {
    object: summary.object,
    entryIds: summary.entryIds,
    eventTypes: summary.eventTypes,
    messageTypes: summary.messageTypes,
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
  const rawBody = options.rawBody === undefined ? options.payload : options.rawBody;
  const signatureStatus = verifyMetaWebhookSignature({
    rawBody,
    signatureHeader: getMetaWebhookSignatureHeader(options.headers),
    appSecret: options.appSecret || options.app_secret,
  }).status;

  if (!["verified", "not_configured"].includes(signatureStatus)) {
    throw buildWhatsAppWebhookError(
      "Invalid WhatsApp webhook signature.",
      403,
      "whatsapp_webhook_signature_invalid"
    );
  }

  const summary = normalizeWhatsAppWebhookPayload(options.payload);
  const threadKeys = extractWhatsAppWebhookThreadKeys(options.payload);

  if (summary.object !== WHATSAPP_WEBHOOK_OBJECT) {
    return {
      ok: true,
      received: true,
      ignored: true,
      eventTypes: [],
      messageTypes: [],
      signatureStatus,
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
    lastWebhookSignatureStatus: signatureStatus,
  };

  if (summary.messageTypes.length > 0) {
    metadata.lastWebhookMessageTypes = summary.messageTypes;
  }

  await updateWhatsAppWebhookConnection(supabase, connection, {
    metadata,
    updated_at: receivedAt,
  });

  for (const [index, event] of summary.events.entries()) {
    const inboundEvent = await createConnectedAppInboundEvent(supabase, {
      ownerUserId: connection.owner_user_id,
      connectionId: connection.id,
      agentId: null,
      provider: WHATSAPP_PROVIDER,
      appKey: WHATSAPP_APP_KEY,
      capabilityKey: WHATSAPP_WEBHOOK_CAPABILITY,
      providerEventType: event.eventType,
      providerMessageId: event.messageId,
      providerTimestamp: event.timestamp,
      sourceAccountId: event.entryId,
      sourceChannelId: event.phoneNumberId,
      normalized: event,
      redactionSummary: {
        source: "whatsapp_webhook_normalizer",
      },
      metadata: {
        signatureStatus,
      },
      receivedAt,
    });

    const externalThreadKey = threadKeys[index];

    if (externalThreadKey) {
      await resolveConnectedAppInboundThread(supabase, {
        ownerUserId: connection.owner_user_id,
        connectionId: connection.id,
        agentId: null,
        provider: WHATSAPP_PROVIDER,
        appKey: WHATSAPP_APP_KEY,
        capabilityKey: WHATSAPP_WEBHOOK_CAPABILITY,
        externalThreadKey,
        externalThreadLabel: "WhatsApp conversation",
        event: inboundEvent,
        duplicate: inboundEvent.duplicate === true,
        metadata: {
          source: "whatsapp_webhook_thread_resolver",
          signatureStatus,
          inboundReviewOnly: true,
          noAutomaticWhatsAppMessages: true,
          noAiReplies: true,
          noAiHandoff: true,
        },
      });
    }
  }

  return {
    ok: true,
    received: true,
    ignored: false,
    eventTypes: summary.eventTypes,
    messageTypes: summary.messageTypes,
    signatureStatus,
  };
}
