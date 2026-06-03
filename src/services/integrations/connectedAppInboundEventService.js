import { createHash } from "node:crypto";

import { CONNECTED_APP_INBOUND_EVENT_TABLE } from "../../config/constants.js";
import {
  getConnectedAppCapability,
  hasConnectedAppCapability,
  listConnectedAppCapabilities,
} from "./connectedAppRegistry.js";
import { cleanText } from "../../utils/text.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const INBOUND_EVENT_DIRECTION = "inbound";
const EVENT_STATUSES = new Set(["received", "ignored", "duplicate", "invalid"]);

const EVENT_SELECT = [
  "id",
  "owner_user_id",
  "connection_id",
  "agent_id",
  "provider",
  "app_key",
  "capability_key",
  "provider_event_id",
  "provider_event_type",
  "provider_message_id",
  "provider_timestamp",
  "source_account_id",
  "source_channel_id",
  "event_direction",
  "event_status",
  "normalized",
  "redaction_summary",
  "dedupe_key",
  "metadata",
  "received_at",
  "created_at",
].join(", ");

const UNSAFE_FIELD_NAMES = new Set([
  "access_token",
  "accesstoken",
  "api_key",
  "apikey",
  "app_secret",
  "appsecret",
  "auth_url",
  "authurl",
  "authorization",
  "body",
  "callback_url",
  "callbackurl",
  "client",
  "client_instance",
  "client_secret",
  "clientinstance",
  "clientsecret",
  "cloud_api_url",
  "cloudapiurl",
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
  "endpoint_url",
  "endpointurl",
  "entry",
  "from",
  "message_body",
  "messagebody",
  "messages",
  "oauth_url",
  "oauthurl",
  "payload",
  "phone",
  "profile",
  "profile_name",
  "profilename",
  "provider_client",
  "provider_clients",
  "providerclient",
  "providerclients",
  "raw",
  "raw_body",
  "rawbody",
  "raw_payload",
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
  "statuses",
  "text",
  "token",
  "token_secret",
  "tokensecret",
  "tokens",
  "url",
  "wa_id",
  "waid",
  "webhook_url",
  "webhook_secret",
  "webhooksecret",
  "webhookurl",
]);

const SAFE_FIELD_NAMES = new Set([
  "agent_id",
  "agentid",
  "app_key",
  "appkey",
  "capability_key",
  "capabilitykey",
  "connection_id",
  "connectionid",
  "contact_fields_redacted",
  "contact_fields_stored",
  "contactfieldsredacted",
  "contactfieldsstored",
  "contact_present",
  "contactpresent",
  "created_at",
  "createdat",
  "dedupe_key",
  "dedupekey",
  "display_phone_number",
  "displayphonenumber",
  "entry_id",
  "entryid",
  "event_direction",
  "eventdirection",
  "event_status",
  "eventstatus",
  "event_type",
  "eventtype",
  "field",
  "has_text",
  "hastext",
  "id",
  "message_body_redacted",
  "message_body_stored",
  "messagebodyredacted",
  "messagebodystored",
  "message_id",
  "message_type",
  "messageid",
  "messagetype",
  "metadata",
  "normalized",
  "object",
  "owner_user_id",
  "owneruserid",
  "phone_number_id",
  "phonenumberid",
  "provider",
  "provider_event_id",
  "provider_event_type",
  "provider_message_id",
  "provider_timestamp",
  "providereventid",
  "providereventtype",
  "providermessageid",
  "providertimestamp",
  "provider_payload_stored",
  "providerpayloadstored",
  "received_at",
  "receivedat",
  "redaction_summary",
  "redactionsummary",
  "source_account_id",
  "source_channel_id",
  "sourceaccountid",
  "sourcechannelid",
  "signature_status",
  "signaturestatus",
  "source",
  "status",
  "text_length",
  "textlength",
  "timestamp",
]);

const URL_LOOKING_VALUE_PATTERN = /\bhttps?:\/\//i;
const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;

function buildInboundEventError(message, statusCode = 400, code = "connected_app_inbound_event_invalid") {
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
    throw buildInboundEventError(`${fieldName} is required`, statusCode);
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
    throw buildInboundEventError("provider is required", 400, "provider_required");
  }

  const knownProvider = listConnectedAppCapabilities().some(
    (definition) => definition.provider === provider
  );

  if (!knownProvider) {
    throw buildInboundEventError(
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
    return null;
  }

  if (!hasConnectedAppCapability(capabilityKey)) {
    throw buildInboundEventError(
      `Unknown connected app capability '${cleanInputText(value)}'.`,
      400,
      "unknown_connected_app_capability"
    );
  }

  const definition = getConnectedAppCapability(capabilityKey);

  if (provider && definition.provider !== provider) {
    throw buildInboundEventError(
      `Capability '${capabilityKey}' does not belong to provider '${provider}'.`,
      400,
      "connected_app_capability_provider_mismatch"
    );
  }

  if (appKey && capabilityAppKey(capabilityKey) !== appKey) {
    throw buildInboundEventError(
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
    throw buildInboundEventError("app_key is required", 400, "app_key_required");
  }

  const knownAppKeys = new Set(
    listConnectedAppCapabilities()
      .filter((definition) => definition.provider === provider)
      .map((definition) => capabilityAppKey(definition.key))
  );

  if (!knownAppKeys.has(appKey)) {
    throw buildInboundEventError(
      `Unknown connected app key '${cleanInputText(value)}' for provider '${provider}'.`,
      400,
      "unknown_connected_app_key"
    );
  }

  if (capabilityKey && capabilityAppKey(capabilityKey) !== appKey) {
    throw buildInboundEventError(
      `Capability '${capabilityKey}' does not belong to app '${appKey}'.`,
      400,
      "connected_app_capability_app_mismatch"
    );
  }

  return appKey;
}

function assertSafeValue(value, path = "input") {
  if (typeof value === "string") {
    if (
      URL_LOOKING_VALUE_PATTERN.test(value)
      || SECRET_LOOKING_VALUE_PATTERN.test(value)
      || JWT_LOOKING_VALUE_PATTERN.test(value)
      || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(value)
    ) {
      throw buildInboundEventError(
        `Connected app inbound events do not accept secret-looking or URL values at '${path}'.`,
        400,
        "connected_app_inbound_event_unsafe_value_rejected"
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
      throw buildInboundEventError(
        `Connected app inbound events do not accept raw or contact field '${path}.${key}'.`,
        400,
        "connected_app_inbound_event_unsafe_field_rejected"
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

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`
  ).join(",")}}`;
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

function normalizeEventStatus(value) {
  const eventStatus = normalizeKey(value || "received");

  if (!EVENT_STATUSES.has(eventStatus)) {
    throw buildInboundEventError(
      "Unsupported connected app inbound event status.",
      400,
      "unsupported_connected_app_inbound_event_status"
    );
  }

  return eventStatus;
}

function normalizeEventDirection(value) {
  const eventDirection = normalizeKey(value || INBOUND_EVENT_DIRECTION);

  if (eventDirection !== INBOUND_EVENT_DIRECTION) {
    throw buildInboundEventError(
      "Connected app inbound events only accept inbound direction.",
      400,
      "unsupported_connected_app_inbound_event_direction"
    );
  }

  return eventDirection;
}

function normalizeEventPayload(value) {
  const normalized = normalizePlainObject(value);
  assertSafeValue(normalized, "normalized");
  return normalized;
}

function normalizeRedactionSummary(value, normalized = {}) {
  const redactionSummary = normalizePlainObject(value);
  const derived = {
    messageBodyStored: false,
    contactFieldsStored: false,
    providerPayloadStored: false,
  };
  const metadata = normalizePlainObject(normalized.metadata);

  if (metadata.hasText === true) {
    derived.messageBodyRedacted = true;
  }

  if (Number.isFinite(Number(metadata.textLength))) {
    derived.textLength = Number(metadata.textLength);
  }

  if (metadata.contactPresent === true) {
    derived.contactFieldsRedacted = true;
  }

  const summary = {
    ...redactionSummary,
    ...derived,
  };

  assertSafeValue(summary, "redactionSummary");
  return summary;
}

function deriveDedupeKey({ provider, providerMessageId, providerEventId, dedupeKey }) {
  const suppliedDedupeKey = cleanInputText(dedupeKey);

  if (suppliedDedupeKey) {
    return suppliedDedupeKey;
  }

  if (providerMessageId) {
    return `${provider}:message:${providerMessageId}`;
  }

  if (providerEventId) {
    return `${provider}:event:${providerEventId}`;
  }

  return null;
}

function deriveFallbackDedupeKey({ provider, normalized }) {
  const summaryHash = createHash("sha256")
    .update(stableJson(normalized))
    .digest("hex")
    .slice(0, 32);

  return `${provider}:summary:${summaryHash}`;
}

function buildInsertPayload(input = {}) {
  assertSafeValue(input, "input");

  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  const connectionId = requireText(input.connectionId || input.connection_id, "connection_id");
  const provider = normalizeProvider(input.provider);
  const capabilityKey = normalizeCapabilityKey(input.capabilityKey || input.capability_key, { provider });
  const appKey = normalizeAppKey(input.appKey || input.app_key, { provider, capabilityKey });
  const normalized = normalizeEventPayload(input.normalized);
  const providerMessageId =
    normalizeOptionalText(input.providerMessageId || input.provider_message_id)
    || normalizeOptionalText(normalized.messageId);
  const providerEventType =
    normalizeOptionalText(input.providerEventType || input.provider_event_type)
    || normalizeOptionalText(normalized.eventType);
  const providerEventId =
    normalizeOptionalText(input.providerEventId || input.provider_event_id)
    || normalizeOptionalText(normalized.eventId);
  const providerTimestamp =
    normalizeTimestamp(input.providerTimestamp || input.provider_timestamp || normalized.timestamp);
  const sourceAccountId =
    normalizeOptionalText(input.sourceAccountId || input.source_account_id)
    || normalizeOptionalText(normalized.entryId);
  const sourceChannelId =
    normalizeOptionalText(input.sourceChannelId || input.source_channel_id)
    || normalizeOptionalText(normalized.phoneNumberId);
  const dedupeKey = deriveDedupeKey({
    provider,
    providerMessageId,
    providerEventId,
    dedupeKey: input.dedupeKey || input.dedupe_key,
  }) || deriveFallbackDedupeKey({ provider, normalized });
  const metadata = normalizePlainObject(input.metadata);

  assertSafeValue(metadata, "metadata");

  return {
    owner_user_id: ownerUserId,
    connection_id: connectionId,
    agent_id: normalizeOptionalText(input.agentId || input.agent_id),
    provider,
    app_key: appKey,
    capability_key: capabilityKey,
    provider_event_id: providerEventId,
    provider_event_type: providerEventType,
    provider_message_id: providerMessageId,
    provider_timestamp: providerTimestamp,
    source_account_id: sourceAccountId,
    source_channel_id: sourceChannelId,
    event_direction: normalizeEventDirection(input.eventDirection || input.event_direction),
    event_status: normalizeEventStatus(input.eventStatus || input.event_status),
    normalized,
    redaction_summary: normalizeRedactionSummary(input.redactionSummary || input.redaction_summary, normalized),
    dedupe_key: dedupeKey,
    metadata,
    received_at: normalizeTimestamp(input.receivedAt || input.received_at) || new Date().toISOString(),
  };
}

export function mapConnectedAppInboundEvent(row = {}) {
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
    providerEventId: normalizeOptionalText(row.provider_event_id),
    providerEventType: normalizeOptionalText(row.provider_event_type),
    providerMessageId: normalizeOptionalText(row.provider_message_id),
    providerTimestamp: row.provider_timestamp || null,
    sourceAccountId: normalizeOptionalText(row.source_account_id),
    sourceChannelId: normalizeOptionalText(row.source_channel_id),
    eventDirection: normalizeOptionalText(row.event_direction),
    eventStatus: normalizeOptionalText(row.event_status),
    normalized: safeJsonForDto(row.normalized),
    redactionSummary: safeJsonForDto(row.redaction_summary),
    dedupeKey: normalizeOptionalText(row.dedupe_key),
    metadata: safeJsonForDto(row.metadata),
    receivedAt: row.received_at || null,
    createdAt: row.created_at || null,
  };
}

async function fetchExistingDedupeEvent(supabase, payload) {
  if (!payload.dedupe_key) {
    return null;
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_EVENT_TABLE)
    .select(EVENT_SELECT)
    .eq("owner_user_id", payload.owner_user_id)
    .eq("provider", payload.provider)
    .eq("dedupe_key", payload.dedupe_key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapConnectedAppInboundEvent(data) : null;
}

export async function createConnectedAppInboundEvent(supabase, input = {}) {
  const payload = buildInsertPayload(input);
  const existing = await fetchExistingDedupeEvent(supabase, payload);

  if (existing) {
    return {
      ...existing,
      duplicate: true,
    };
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_EVENT_TABLE)
    .insert(payload)
    .select(EVENT_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await fetchExistingDedupeEvent(supabase, payload);

      if (duplicate) {
        return {
          ...duplicate,
          duplicate: true,
        };
      }
    }

    throw error;
  }

  return {
    ...mapConnectedAppInboundEvent(data),
    duplicate: false,
  };
}

export async function listConnectedAppInboundEvents(supabase, input = {}) {
  assertSafeValue(input, "input");

  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(CONNECTED_APP_INBOUND_EVENT_TABLE)
    .select(EVENT_SELECT)
    .eq("owner_user_id", ownerUserId);

  const provider = cleanInputText(input.provider) ? normalizeProvider(input.provider) : "";
  const connectionId = normalizeOptionalText(input.connectionId || input.connection_id);

  if (provider) {
    query = query.eq("provider", provider);
  }

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(input.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapConnectedAppInboundEvent);
}
