import { createHash } from "node:crypto";

import {
  CONNECTED_APP_INBOUND_EVENT_TABLE,
  CONNECTED_APP_INBOUND_THREAD_TABLE,
} from "../../config/constants.js";
import {
  getConnectedAppCapability,
  hasConnectedAppCapability,
  listConnectedAppCapabilities,
} from "./connectedAppRegistry.js";
import { cleanText } from "../../utils/text.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const HASH_CONTEXT = "vonza:connected-app-inbound-thread:v1";
const NULL_UUID = "00000000-0000-0000-0000-000000000000";

export const CONNECTED_APP_INBOUND_THREAD_STATUSES = Object.freeze([
  "open",
  "reviewing",
  "resolved",
  "ignored",
  "archived",
]);

const THREAD_STATUS_SET = new Set(CONNECTED_APP_INBOUND_THREAD_STATUSES);
const UNREAD_CLEAR_STATUSES = new Set(["reviewing", "resolved", "ignored", "archived"]);

const THREAD_SELECT = [
  "id",
  "owner_user_id",
  "connection_id",
  "agent_id",
  "provider",
  "app_key",
  "capability_key",
  "external_thread_key_hash",
  "external_thread_label",
  "status",
  "last_event_id",
  "last_event_at",
  "last_event_type",
  "last_message_type",
  "unread_count",
  "assigned_owner_user_id",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const EVENT_THREAD_SELECT = [
  "id",
  "thread_id",
  "metadata",
].join(", ");

const UNSAFE_FIELD_NAMES = new Set([
  "access_token",
  "accesstoken",
  "api_key",
  "apikey",
  "app_secret",
  "appsecret",
  "authorization",
  "body",
  "client_secret",
  "clientsecret",
  "contact",
  "contact_phone",
  "contact_profile",
  "contact_profile_name",
  "contactphone",
  "contactprofile",
  "contactprofilename",
  "contacts",
  "customer_phone",
  "customerphone",
  "entry",
  "external_thread_key",
  "externalthreadkey",
  "from",
  "message_body",
  "messagebody",
  "messages",
  "payload",
  "phone",
  "profile",
  "profile_name",
  "profilename",
  "raw",
  "raw_body",
  "raw_payload",
  "rawbody",
  "rawpayload",
  "recipient_id",
  "recipientid",
  "request_body",
  "requestbody",
  "sender",
  "sender_phone",
  "senderphone",
  "secret",
  "secret_key",
  "secretkey",
  "secrets",
  "signing_secret",
  "signingsecret",
  "text",
  "token",
  "token_secret",
  "tokensecret",
  "tokens",
  "wa_id",
  "waid",
  "webhook_secret",
  "webhooksecret",
]);

const SAFE_FIELD_NAMES = new Set([
  "app_key",
  "appkey",
  "capability_key",
  "capabilitykey",
  "connection_id",
  "connectionid",
  "event_id",
  "eventid",
  "event_type",
  "eventtype",
  "inbound_review_only",
  "inboundreviewonly",
  "last_event_id",
  "last_event_type",
  "last_eventid",
  "last_eventtype",
  "last_message_type",
  "last_messagetype",
  "manual_review_only",
  "manualreviewonly",
  "message_type",
  "messagetype",
  "no_ai_handoff",
  "no_ai_replies",
  "no_outbound_messaging",
  "noaihandoff",
  "noaireplies",
  "nooutboundmessaging",
  "provider",
  "signature_status",
  "signaturestatus",
  "source",
  "status",
  "thread_id",
  "threadid",
]);

const URL_LOOKING_VALUE_PATTERN = /\bhttps?:\/\//i;
const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;
const EMAIL_LOOKING_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function buildInboundThreadError(message, statusCode = 400, code = "connected_app_inbound_thread_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function normalizeKey(value) {
  return cleanInputText(value).toLowerCase();
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeFieldName(value) {
  return cleanText(value).replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase();
}

function requireText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildInboundThreadError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
}

function capabilityAppKey(capabilityKey) {
  return normalizeKey(capabilityKey).split(".").slice(0, 2).join(".");
}

function normalizeProvider(value) {
  const provider = normalizeKey(value);

  if (!provider) {
    throw buildInboundThreadError("provider is required", 400, "provider_required");
  }

  const knownProvider = listConnectedAppCapabilities().some(
    (definition) => definition.provider === provider
  );

  if (!knownProvider) {
    throw buildInboundThreadError(
      `Unknown connected app provider '${cleanInputText(value)}'.`,
      400,
      "unknown_connected_app_provider"
    );
  }

  return provider;
}

function normalizeCapabilityKey(value, { provider, appKey } = {}) {
  const capabilityKey = normalizeKey(value);

  if (!capabilityKey) {
    throw buildInboundThreadError("capability_key is required", 400, "capability_key_required");
  }

  if (!hasConnectedAppCapability(capabilityKey)) {
    throw buildInboundThreadError(
      `Unknown connected app capability '${cleanInputText(value)}'.`,
      400,
      "unknown_connected_app_capability"
    );
  }

  const definition = getConnectedAppCapability(capabilityKey);

  if (provider && definition.provider !== provider) {
    throw buildInboundThreadError(
      `Capability '${capabilityKey}' does not belong to provider '${provider}'.`,
      400,
      "connected_app_capability_provider_mismatch"
    );
  }

  if (appKey && capabilityAppKey(capabilityKey) !== appKey) {
    throw buildInboundThreadError(
      `Capability '${capabilityKey}' does not belong to app '${appKey}'.`,
      400,
      "connected_app_capability_app_mismatch"
    );
  }

  return capabilityKey;
}

function normalizeAppKey(value, { provider, capabilityKey } = {}) {
  const appKey = normalizeKey(value);

  if (!appKey) {
    throw buildInboundThreadError("app_key is required", 400, "app_key_required");
  }

  const knownAppKeys = new Set(
    listConnectedAppCapabilities()
      .filter((definition) => definition.provider === provider)
      .map((definition) => capabilityAppKey(definition.key))
  );

  if (!knownAppKeys.has(appKey)) {
    throw buildInboundThreadError(
      `Unknown connected app key '${cleanInputText(value)}' for provider '${provider}'.`,
      400,
      "unknown_connected_app_key"
    );
  }

  if (capabilityKey && capabilityAppKey(capabilityKey) !== appKey) {
    throw buildInboundThreadError(
      `Capability '${capabilityKey}' does not belong to app '${appKey}'.`,
      400,
      "connected_app_capability_app_mismatch"
    );
  }

  return appKey;
}

function normalizeStatus(value, fallback = "open") {
  const status = normalizeKey(value || fallback);

  if (!THREAD_STATUS_SET.has(status)) {
    throw buildInboundThreadError(
      "Unsupported connected app inbound thread status.",
      400,
      "unsupported_connected_app_inbound_thread_status"
    );
  }

  return status;
}

function normalizeTimestamp(value) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    return null;
  }

  if (/^\d{1,16}$/.test(normalized)) {
    const numeric = Number(normalized);
    const millis = normalized.length >= 13 ? numeric : numeric * 1000;
    const date = new Date(millis);

    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function assertSafeValue(value, path = "metadata") {
  if (typeof value === "string") {
    if (
      URL_LOOKING_VALUE_PATTERN.test(value)
      || SECRET_LOOKING_VALUE_PATTERN.test(value)
      || JWT_LOOKING_VALUE_PATTERN.test(value)
      || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(value)
      || EMAIL_LOOKING_VALUE_PATTERN.test(value)
    ) {
      throw buildInboundThreadError(
        `Connected app inbound threads do not accept contact, secret-looking, or URL values at '${path}'.`,
        400,
        "connected_app_inbound_thread_unsafe_value_rejected"
      );
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeValue(item, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeFieldName(key);

    if (UNSAFE_FIELD_NAMES.has(normalizedKey) && !SAFE_FIELD_NAMES.has(normalizedKey)) {
      throw buildInboundThreadError(
        `Connected app inbound threads do not accept raw or contact field '${path}.${key}'.`,
        400,
        "connected_app_inbound_thread_unsafe_field_rejected"
      );
    }

    assertSafeValue(nestedValue, `${path}.${key}`);
  }
}

function safeJsonForDto(value) {
  const normalized = normalizePlainObject(value);

  try {
    assertSafeValue(normalized);
    return normalized;
  } catch {
    return {
      unsafeRedacted: true,
    };
  }
}

function looksLikePhoneLabel(value) {
  const normalized = cleanText(value);
  const digitCount = (normalized.match(/\d/g) || []).length;

  return digitCount >= 7 || /^\+[\d\s().-]+$/.test(normalized);
}

function defaultExternalThreadLabel(provider) {
  return normalizeKey(provider) === "whatsapp" ? "WhatsApp conversation" : "Connected app conversation";
}

function normalizeExternalThreadLabel(value, provider) {
  if (normalizeKey(provider) === "whatsapp") {
    return defaultExternalThreadLabel(provider);
  }

  const normalized = cleanInputText(value).slice(0, 80);

  if (
    !normalized
    || looksLikePhoneLabel(normalized)
    || EMAIL_LOOKING_VALUE_PATTERN.test(normalized)
    || URL_LOOKING_VALUE_PATTERN.test(normalized)
    || SECRET_LOOKING_VALUE_PATTERN.test(normalized)
  ) {
    return defaultExternalThreadLabel(provider);
  }

  return normalized;
}

function assertSafeRawExternalThreadKey(value) {
  const normalized = requireText(value, "external_thread_key");

  if (
    URL_LOOKING_VALUE_PATTERN.test(normalized)
    || SECRET_LOOKING_VALUE_PATTERN.test(normalized)
    || JWT_LOOKING_VALUE_PATTERN.test(normalized)
    || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(normalized)
  ) {
    throw buildInboundThreadError(
      "Connected app inbound thread keys cannot be URL or secret-looking values.",
      400,
      "connected_app_inbound_thread_unsafe_key_rejected"
    );
  }

  return normalized;
}

function hashExternalThreadKey({
  ownerUserId,
  connectionId,
  provider,
  appKey,
  capabilityKey,
  agentId,
  externalThreadKey,
}) {
  const rawThreadKey = assertSafeRawExternalThreadKey(externalThreadKey);

  return createHash("sha256")
    .update([
      HASH_CONTEXT,
      ownerUserId,
      connectionId,
      provider,
      appKey,
      capabilityKey,
      agentId || NULL_UUID,
      rawThreadKey,
    ].join(":"))
    .digest("hex");
}

function normalizeExternalThreadKeyHash(value) {
  const normalized = normalizeKey(value);

  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : "";
}

function buildThreadIdentity(input = {}) {
  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  const connectionId = requireText(input.connectionId || input.connection_id, "connection_id");
  const provider = normalizeProvider(input.provider);
  const capabilityKey = normalizeCapabilityKey(input.capabilityKey || input.capability_key, { provider });
  const appKey = normalizeAppKey(input.appKey || input.app_key, { provider, capabilityKey });
  const agentId = normalizeOptionalText(input.agentId || input.agent_id);
  const suppliedHash = normalizeExternalThreadKeyHash(
    input.externalThreadKeyHash || input.external_thread_key_hash
  );
  const externalThreadKeyHash = suppliedHash || hashExternalThreadKey({
    ownerUserId,
    connectionId,
    provider,
    appKey,
    capabilityKey,
    agentId,
    externalThreadKey: input.externalThreadKey || input.external_thread_key,
  });

  return {
    ownerUserId,
    connectionId,
    agentId,
    provider,
    appKey,
    capabilityKey,
    externalThreadKeyHash,
  };
}

function eventValue(event, camelKey, snakeKey) {
  if (Object.prototype.hasOwnProperty.call(event, camelKey)) {
    return event[camelKey];
  }

  return event[snakeKey];
}

function buildEventSummary(input = {}) {
  const event = normalizePlainObject(input.event);
  const normalized = normalizePlainObject(event.normalized);
  const providerEventType =
    normalizeOptionalText(input.providerEventType || input.provider_event_type)
    || normalizeOptionalText(eventValue(event, "providerEventType", "provider_event_type"))
    || normalizeOptionalText(normalized.eventType);
  const messageType =
    normalizeOptionalText(input.messageType || input.message_type)
    || normalizeOptionalText(normalized.messageType);
  const eventAt =
    normalizeTimestamp(input.eventAt || input.event_at)
    || normalizeTimestamp(eventValue(event, "providerTimestamp", "provider_timestamp"))
    || normalizeTimestamp(eventValue(event, "receivedAt", "received_at"))
    || normalizeTimestamp(eventValue(event, "createdAt", "created_at"))
    || new Date().toISOString();

  return {
    eventId:
      normalizeOptionalText(input.eventId || input.event_id)
      || normalizeOptionalText(event.id),
    eventAt,
    eventType: providerEventType,
    messageType,
    shouldIncrementUnread: providerEventType === "message" && input.duplicate !== true && event.duplicate !== true,
  };
}

function buildInsertPayload(input = {}) {
  const identity = buildThreadIdentity(input);
  const eventSummary = buildEventSummary(input);
  const metadata = {
    ...normalizePlainObject(input.metadata),
    inboundReviewOnly: true,
    noAutomaticWhatsAppMessages: true,
    noAiReplies: true,
    noAiHandoff: true,
  };

  if (eventSummary.eventType === "message") {
    metadata.lastInboundMessageAt = eventSummary.eventAt;
  }

  assertSafeValue(metadata, "metadata");

  return {
    owner_user_id: identity.ownerUserId,
    connection_id: identity.connectionId,
    agent_id: identity.agentId,
    provider: identity.provider,
    app_key: identity.appKey,
    capability_key: identity.capabilityKey,
    external_thread_key_hash: identity.externalThreadKeyHash,
    external_thread_label: normalizeExternalThreadLabel(input.externalThreadLabel || input.external_thread_label, identity.provider),
    status: normalizeStatus(input.status),
    last_event_id: eventSummary.eventId,
    last_event_at: eventSummary.eventAt,
    last_event_type: eventSummary.eventType,
    last_message_type: eventSummary.messageType,
    unread_count: eventSummary.shouldIncrementUnread ? 1 : 0,
    assigned_owner_user_id: normalizeOptionalText(input.assignedOwnerUserId || input.assigned_owner_user_id),
    metadata,
  };
}

export function mapConnectedAppInboundThread(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id),
    ownerUserId: normalizeOptionalText(row.owner_user_id),
    connectionId: normalizeOptionalText(row.connection_id),
    agentId: normalizeOptionalText(row.agent_id),
    provider: normalizeOptionalText(row.provider),
    appKey: normalizeOptionalText(row.app_key),
    capabilityKey: normalizeOptionalText(row.capability_key),
    externalThreadLabel: normalizeOptionalText(row.external_thread_label),
    status: normalizeOptionalText(row.status),
    lastEventId: normalizeOptionalText(row.last_event_id),
    lastEventAt: row.last_event_at || null,
    lastEventType: normalizeOptionalText(row.last_event_type),
    lastMessageType: normalizeOptionalText(row.last_message_type),
    unreadCount: Number.isFinite(Number(row.unread_count)) ? Number(row.unread_count) : 0,
    assignedOwnerUserId: normalizeOptionalText(row.assigned_owner_user_id),
    metadata: safeJsonForDto(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function addNullableAgentFilter(query, agentId) {
  if (agentId) {
    return query.eq("agent_id", agentId);
  }

  if (typeof query.is === "function") {
    return query.is("agent_id", null);
  }

  return query.eq("agent_id", null);
}

async function fetchExistingThread(supabase, payload) {
  let query = supabase
    .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
    .select(THREAD_SELECT)
    .eq("owner_user_id", payload.owner_user_id)
    .eq("connection_id", payload.connection_id)
    .eq("provider", payload.provider)
    .eq("app_key", payload.app_key)
    .eq("capability_key", payload.capability_key)
    .eq("external_thread_key_hash", payload.external_thread_key_hash);

  query = addNullableAgentFilter(query, payload.agent_id);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function attachEventToThread(supabase, { ownerUserId, eventId, threadId } = {}) {
  const normalizedEventId = cleanInputText(eventId);
  const normalizedThreadId = cleanInputText(threadId);

  if (!normalizedEventId || !normalizedThreadId) {
    return null;
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_EVENT_TABLE)
    .update({ thread_id: normalizedThreadId })
    .eq("owner_user_id", ownerUserId)
    .eq("id", normalizedEventId)
    .select(EVENT_THREAD_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function updateExistingThread(supabase, existingRow, payload) {
  const eventSummary = {
    last_event_id: payload.last_event_id,
    last_event_at: payload.last_event_at,
    last_event_type: payload.last_event_type,
    last_message_type: payload.last_message_type,
  };
  const shouldIncrementUnread = Number(payload.unread_count) > 0;
  const unreadCount = Math.max(0, Number(existingRow.unread_count) || 0) + (shouldIncrementUnread ? 1 : 0);
  const updatePayload = {
    ...eventSummary,
    unread_count: unreadCount,
    updated_at: new Date().toISOString(),
  };
  const nextMetadata = normalizePlainObject(payload.metadata);

  if (nextMetadata.lastInboundMessageAt) {
    updatePayload.metadata = {
      ...normalizePlainObject(existingRow.metadata),
      ...nextMetadata,
    };
    assertSafeValue(updatePayload.metadata, "metadata");
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
    .update(updatePayload)
    .eq("owner_user_id", payload.owner_user_id)
    .eq("id", existingRow.id)
    .select(THREAD_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildInboundThreadError(
      "Connected app inbound thread not found.",
      404,
      "connected_app_inbound_thread_not_found"
    );
  }

  return data;
}

export async function resolveConnectedAppInboundThread(supabase, input = {}) {
  const payload = buildInsertPayload(input);
  const existing = await fetchExistingThread(supabase, payload);
  let row;

  if (existing) {
    row = await updateExistingThread(supabase, existing, payload);
  } else {
    const { data, error } = await supabase
      .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
      .insert(payload)
      .select(THREAD_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        const duplicate = await fetchExistingThread(supabase, payload);

        if (duplicate) {
          row = await updateExistingThread(supabase, duplicate, payload);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    } else {
      row = data;
    }
  }

  await attachEventToThread(supabase, {
    ownerUserId: payload.owner_user_id,
    eventId: payload.last_event_id,
    threadId: row.id,
  });

  return mapConnectedAppInboundThread(row);
}

export async function listConnectedAppInboundThreads(supabase, input = {}) {
  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
    .select(THREAD_SELECT)
    .eq("owner_user_id", ownerUserId);

  const provider = cleanInputText(input.provider) ? normalizeProvider(input.provider) : "";
  const connectionId = normalizeOptionalText(input.connectionId || input.connection_id);
  const agentId = normalizeOptionalText(input.agentId || input.agent_id);
  const status = cleanInputText(input.status) ? normalizeStatus(input.status) : "";
  const threadId = normalizeOptionalText(input.threadId || input.thread_id);

  if (provider) {
    query = query.eq("provider", provider);
  }

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (threadId) {
    query = query.eq("id", threadId);
  }

  const { data, error } = await query
    .order("last_event_at", { ascending: false })
    .limit(normalizeLimit(input.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapConnectedAppInboundThread);
}

export async function updateConnectedAppInboundThreadStatus(supabase, input = {}) {
  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  const threadId = requireText(input.threadId || input.thread_id, "thread_id");
  const status = normalizeStatus(input.status);
  const updatePayload = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (UNREAD_CLEAR_STATUSES.has(status)) {
    updatePayload.unread_count = 0;
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
    .update(updatePayload)
    .eq("owner_user_id", ownerUserId)
    .eq("id", threadId)
    .select(THREAD_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildInboundThreadError(
      "Connected app inbound thread not found.",
      404,
      "connected_app_inbound_thread_not_found"
    );
  }

  return mapConnectedAppInboundThread(data);
}
