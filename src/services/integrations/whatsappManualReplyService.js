import { createHash } from "node:crypto";

import {
  AGENT_CONNECTED_APP_ENABLEMENT_TABLE,
  CONNECTED_APP_CONNECTION_TABLE,
  CONNECTED_APP_INBOUND_THREAD_TABLE,
  CONNECTED_APP_OUTBOUND_MESSAGE_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

export const WHATSAPP_MANUAL_REPLIES_FEATURE_FLAG = "WHATSAPP_MANUAL_REPLIES_ENABLED";

const WHATSAPP_PROVIDER = "whatsapp";
const WHATSAPP_APP_KEY = "whatsapp.business";
const WHATSAPP_SESSION_REPLY_CAPABILITY = "whatsapp.business.send.session.reply";
const WHATSAPP_TEMPLATE_SEND_CAPABILITY = "whatsapp.business.send.template";
const DEFAULT_SESSION_WINDOW_HOURS = 24;
const DEFAULT_GRAPH_API_VERSION = "v25.0";
const MAX_TEXT_MESSAGE_LENGTH = 4096;
const BLOCKED_STATUS = "blocked";
const SENT_STATUS = "sent";
const FAILED_STATUS = "failed";

const THREAD_SELECT = [
  "id",
  "owner_user_id",
  "connection_id",
  "agent_id",
  "provider",
  "app_key",
  "capability_key",
  "external_thread_key_hash",
  "status",
  "last_event_at",
  "last_event_type",
  "last_message_type",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const CONNECTION_SELECT = [
  "id",
  "owner_user_id",
  "provider",
  "app_key",
  "capability_keys",
  "status",
  "webhook_status",
  "token_secret_ref",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const ENABLEMENT_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "connection_id",
  "capability_keys",
  "enabled",
  "approval_mode",
  "allowed_surfaces",
  "metadata",
].join(", ");

const OUTBOUND_SELECT = [
  "id",
  "owner_user_id",
  "connection_id",
  "agent_id",
  "thread_id",
  "provider",
  "app_key",
  "capability_key",
  "destination_ref_hash",
  "message_type",
  "body_redacted",
  "template_name",
  "template_language",
  "status",
  "approval_mode",
  "provider_message_id",
  "provider_status",
  "error_code",
  "error_message_redacted",
  "metadata",
  "created_by_owner_user_id",
  "sent_at",
  "created_at",
  "updated_at",
].join(", ");

const UNSAFE_ROUTE_FIELD_NAMES = new Set([
  "access_token",
  "accesstoken",
  "api_key",
  "apikey",
  "app_secret",
  "appsecret",
  "auth_url",
  "authurl",
  "authorization",
  "authorization_code",
  "authorizationcode",
  "authorization_url",
  "authorizationurl",
  "bearer_token",
  "bearertoken",
  "business_integration_system_user_token",
  "businessintegrationsystemusertoken",
  "callback_url",
  "callbackurl",
  "client_secret",
  "clientsecret",
  "cloud_api_access_token",
  "cloud_api_url",
  "cloudapiaccesstoken",
  "cloudapiurl",
  "connection_id",
  "connectionid",
  "destination",
  "destination_phone",
  "destination_ref",
  "destinationphone",
  "destinationref",
  "display_phone_number",
  "displayphonenumber",
  "embedded_signup_url",
  "embeddedsignupurl",
  "endpoint_url",
  "endpointurl",
  "from",
  "payload",
  "permanent_access_token",
  "permanentaccesstoken",
  "phone",
  "phone_number",
  "phone_number_id",
  "phonenumber",
  "phonenumberid",
  "provider",
  "provider_client",
  "provider_payload",
  "providerclient",
  "providerpayload",
  "raw",
  "raw_payload",
  "rawpayload",
  "recipient",
  "recipient_id",
  "recipient_phone",
  "recipientid",
  "recipientphone",
  "sender",
  "sender_phone",
  "senderphone",
  "secret",
  "secret_key",
  "secretkey",
  "secrets",
  "signing_secret",
  "signingsecret",
  "system_user_access_token",
  "systemuseraccesstoken",
  "to",
  "token",
  "token_secret_ref",
  "tokensecretref",
  "tokens",
  "verify_token",
  "verifytoken",
  "wa_id",
  "waid",
  "webhook_secret",
  "webhook_url",
  "webhooksecret",
  "webhookurl",
  "whatsapp_access_token",
  "whatsapp_token",
  "whatsappaccesstoken",
  "whatsapptoken",
]);

const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;

function buildManualReplyError(message, statusCode = 400, code = "whatsapp_manual_reply_invalid", outbound = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (outbound) {
    error.outbound = outbound;
  }
  return error;
}

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function requireText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildManualReplyError(`${fieldName} is required`, statusCode);
  }

  return normalized;
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

function normalizeArray(value) {
  const rawItems = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  const seen = new Set();

  return rawItems.flatMap((item) => {
    const normalized = normalizeOptionalText(item);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeFieldName(value) {
  return cleanText(value).replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase();
}

function assertNoUnsafeInput(value, path = "input") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeFieldName(key);

    if (UNSAFE_ROUTE_FIELD_NAMES.has(normalizedKey)) {
      throw buildManualReplyError(
        `WhatsApp manual reply does not accept secret, provider payload, or phone field '${path}.${key}'.`,
        400,
        "whatsapp_manual_reply_unsafe_field_rejected"
      );
    }

    if (
      typeof nestedValue === "string"
      && (
        SECRET_LOOKING_VALUE_PATTERN.test(nestedValue)
        || JWT_LOOKING_VALUE_PATTERN.test(nestedValue)
        || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(nestedValue)
      )
    ) {
      throw buildManualReplyError(
        `WhatsApp manual reply does not accept secret-looking value '${path}.${key}'.`,
        400,
        "whatsapp_manual_reply_unsafe_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      assertNoUnsafeInput(nestedValue, `${path}.${key}`);
    }
  }
}

export function isWhatsAppManualRepliesEnabled(env = process.env) {
  const value = cleanInputText(env?.[WHATSAPP_MANUAL_REPLIES_FEATURE_FLAG]).toLowerCase();
  return ["1", "true", "enabled", "on"].includes(value);
}

export function getWhatsAppManualReplyFeatureStatus(env = process.env) {
  const enabled = isWhatsAppManualRepliesEnabled(env);

  return {
    enabled,
    status: enabled ? "enabled" : "disabled",
  };
}

function readInputField(input, camelKey, snakeKey) {
  if (Object.prototype.hasOwnProperty.call(input, camelKey)) {
    return input[camelKey];
  }

  return input[snakeKey];
}

function normalizeMessageType(input = {}) {
  const supplied = normalizeKey(readInputField(input, "messageType", "message_type"));

  if (supplied) {
    if (supplied !== "text" && supplied !== "template") {
      throw buildManualReplyError(
        "Unsupported WhatsApp manual reply message type.",
        400,
        "whatsapp_manual_reply_message_type_unsupported"
      );
    }

    return supplied;
  }

  if (
    cleanInputText(readInputField(input, "templateName", "template_name"))
    || cleanInputText(readInputField(input, "templateLanguage", "template_language"))
  ) {
    return "template";
  }

  return "text";
}

function normalizeRequestedMessage(input = {}) {
  const messageType = normalizeMessageType(input);
  const messageText = cleanInputText(readInputField(input, "messageText", "message_text"));
  const templateName = normalizeOptionalText(readInputField(input, "templateName", "template_name"));
  const templateLanguage = normalizeOptionalText(readInputField(input, "templateLanguage", "template_language"));
  const expectedCapabilityKey = messageType === "template"
    ? WHATSAPP_TEMPLATE_SEND_CAPABILITY
    : WHATSAPP_SESSION_REPLY_CAPABILITY;
  const requestedCapabilityKey =
    normalizeKey(readInputField(input, "capabilityKey", "capability_key")) || expectedCapabilityKey;

  if (requestedCapabilityKey !== expectedCapabilityKey) {
    throw buildManualReplyError(
      "WhatsApp manual reply capability does not match the requested message type.",
      400,
      "whatsapp_manual_reply_capability_mismatch"
    );
  }

  if (messageType === "text") {
    if (!messageText) {
      throw buildManualReplyError(
        "messageText is required for a manual WhatsApp session reply.",
        400,
        "whatsapp_manual_reply_text_required"
      );
    }

    if (messageText.length > MAX_TEXT_MESSAGE_LENGTH) {
      throw buildManualReplyError(
        "WhatsApp manual reply text is too long.",
        400,
        "whatsapp_manual_reply_text_too_long"
      );
    }
  }

  return {
    messageType,
    messageText,
    templateName,
    templateLanguage,
    capabilityKey: expectedCapabilityKey,
  };
}

function mapOutboundRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id),
    ownerUserId: normalizeOptionalText(row.owner_user_id),
    connectionId: normalizeOptionalText(row.connection_id),
    agentId: normalizeOptionalText(row.agent_id),
    threadId: normalizeOptionalText(row.thread_id),
    provider: normalizeOptionalText(row.provider),
    appKey: normalizeOptionalText(row.app_key),
    capabilityKey: normalizeOptionalText(row.capability_key),
    messageType: normalizeOptionalText(row.message_type),
    bodyRedacted: normalizeOptionalText(row.body_redacted),
    templateName: normalizeOptionalText(row.template_name),
    templateLanguage: normalizeOptionalText(row.template_language),
    status: normalizeOptionalText(row.status),
    approvalMode: normalizeOptionalText(row.approval_mode),
    providerMessageId: normalizeOptionalText(row.provider_message_id),
    providerStatus: normalizeOptionalText(row.provider_status),
    errorCode: normalizeOptionalText(row.error_code),
    errorMessageRedacted: normalizeOptionalText(row.error_message_redacted),
    metadata: normalizePlainObject(row.metadata),
    createdByOwnerUserId: normalizeOptionalText(row.created_by_owner_user_id),
    sentAt: row.sent_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function buildBodyRedactionSummary(messageType, messageText) {
  if (messageType !== "text") {
    return null;
  }

  return `[manual staff text redacted: ${messageText.length} chars]`;
}

function redactProviderErrorMessage(error) {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  const code = normalizeOptionalText(error?.code || error?.errorCode);

  if (statusCode) {
    return `Provider request failed with HTTP ${statusCode}${code ? ` (${code})` : ""}.`;
  }

  return "Provider request failed.";
}

function normalizeProviderMessageId(response = {}) {
  const messages = Array.isArray(response.messages) ? response.messages : [];
  return normalizeOptionalText(messages[0]?.id || response.message_id || response.messageId);
}

function normalizeProviderStatus(response = {}) {
  const messages = Array.isArray(response.messages) ? response.messages : [];
  return normalizeOptionalText(messages[0]?.message_status || response.status) || "accepted";
}

function getNowIso(deps = {}) {
  const nowValue = typeof deps.now === "function" ? deps.now() : deps.now;
  const nowDate = nowValue ? new Date(nowValue) : new Date();

  return Number.isFinite(nowDate.getTime()) ? nowDate.toISOString() : new Date().toISOString();
}

function getNowMillis(deps = {}) {
  const nowValue = typeof deps.now === "function" ? deps.now() : deps.now;
  const nowDate = nowValue ? new Date(nowValue) : new Date();

  return Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
}

function normalizeTimestamp(value) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function resolveSessionProofTimestamp(thread = {}) {
  const metadata = normalizePlainObject(thread.metadata);
  const sessionWindow = normalizePlainObject(metadata.sessionWindow);

  return normalizeTimestamp(metadata.lastInboundMessageAt)
    || normalizeTimestamp(sessionWindow.lastInboundMessageAt)
    || (normalizeKey(thread.last_event_type) === "message" ? normalizeTimestamp(thread.last_event_at) : null);
}

function isWithinSessionWindow(thread, deps = {}) {
  const proofDate = resolveSessionProofTimestamp(thread);

  if (!proofDate) {
    return false;
  }

  const rawWindowHours = Number(deps.sessionWindowHours || deps.whatsappSessionWindowHours);
  const windowHours = Number.isFinite(rawWindowHours) && rawWindowHours > 0
    ? rawWindowHours
    : DEFAULT_SESSION_WINDOW_HOURS;
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  const ageMs = getNowMillis(deps) - proofDate.getTime();

  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function getConnectionMetadataValue(connection = {}, key) {
  const metadata = normalizePlainObject(connection.metadata);
  return normalizeOptionalText(metadata[key]);
}

async function fetchOwnerScopedThread(supabase, { ownerUserId, threadId }) {
  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_THREAD_TABLE)
    .select(THREAD_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildManualReplyError(
      "Connected app inbound thread not found.",
      404,
      "connected_app_inbound_thread_not_found"
    );
  }

  return data;
}

async function fetchOwnerScopedConnection(supabase, { ownerUserId, connectionId }) {
  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select(CONNECTION_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildManualReplyError(
      "Connected app connection not found.",
      404,
      "connected_app_connection_not_found"
    );
  }

  return data;
}

async function fetchAgentEnablements(supabase, { ownerUserId, connectionId, agentId }) {
  const { data, error } = await supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .select(ENABLEMENT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("connection_id", connectionId)
    .eq("agent_id", agentId)
    .eq("enabled", true)
    .limit(20);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function assertUsableWhatsAppConnection(connection = {}, capabilityKey) {
  if (
    normalizeKey(connection.provider) !== WHATSAPP_PROVIDER
    || normalizeKey(connection.app_key) !== WHATSAPP_APP_KEY
  ) {
    throw buildManualReplyError(
      "Connected app connection is not a WhatsApp Business connection.",
      400,
      "whatsapp_manual_reply_connection_not_whatsapp"
    );
  }

  if (normalizeKey(connection.status) !== "active") {
    throw buildManualReplyError(
      "WhatsApp Business connection is not active.",
      403,
      "whatsapp_manual_reply_connection_inactive"
    );
  }

  const capabilityKeys = normalizeArray(connection.capability_keys).map((key) => normalizeKey(key));

  if (!capabilityKeys.includes(capabilityKey)) {
    throw buildManualReplyError(
      "WhatsApp Business connection does not include the required send capability.",
      403,
      "whatsapp_manual_reply_capability_not_on_connection"
    );
  }
}

function findUsableEnablement(enablements = [], capabilityKey) {
  return enablements.find((enablement) => {
    const capabilityKeys = normalizeArray(enablement.capability_keys).map((key) => normalizeKey(key));
    const allowedSurfaces = normalizeArray(enablement.allowed_surfaces).map((surface) => normalizeKey(surface));
    const approvalMode = normalizeKey(enablement.approval_mode || "manual_review");

    return enablement.enabled === true
      && capabilityKeys.includes(capabilityKey)
      && approvalMode !== "disabled"
      && (allowedSurfaces.includes("dashboard") || allowedSurfaces.includes("internal"));
  }) || null;
}

function buildTemplateUnsupportedError() {
  return buildManualReplyError(
    "WhatsApp template sends are blocked until approved-template support is explicitly implemented.",
    403,
    "whatsapp_manual_reply_template_unsupported"
  );
}

async function resolveDestinationRef(context, deps = {}) {
  const resolver = deps.resolveWhatsAppDestinationRef || deps.getWhatsAppDestinationRef;

  if (typeof resolver !== "function") {
    throw buildManualReplyError(
      "WhatsApp destination lookup is not configured for manual replies.",
      403,
      "whatsapp_manual_reply_destination_lookup_missing"
    );
  }

  const result = await resolver({
    ownerUserId: context.ownerUserId,
    connectionId: context.connection.id,
    threadId: context.thread.id,
    destinationRefHash: context.thread.external_thread_key_hash,
  });
  const destinationRef = normalizeOptionalText(result?.destinationRef || result?.to || result);

  if (!destinationRef) {
    throw buildManualReplyError(
      "WhatsApp destination lookup did not return a sendable destination.",
      403,
      "whatsapp_manual_reply_destination_missing"
    );
  }

  return destinationRef;
}

async function resolveCloudApiCredentials(context, deps = {}) {
  const env = deps.env || process.env;
  const resolver = deps.getWhatsAppCloudApiCredentials || deps.getWhatsAppManualReplyCredentials;
  if (typeof resolver !== "function") {
    throw buildManualReplyError(
      "WhatsApp Cloud API credential lookup is not configured for manual replies.",
      403,
      "whatsapp_manual_reply_credential_lookup_missing"
    );
  }

  const resolved = typeof resolver === "function"
    ? await resolver({
      ownerUserId: context.ownerUserId,
      connectionId: context.connection.id,
      tokenSecretRef: context.connection.token_secret_ref || null,
      connection: context.connection,
    })
    : {};
  const credentials = normalizePlainObject(resolved);
  const accessToken = normalizeOptionalText(credentials.accessToken);
  const phoneNumberId =
    normalizeOptionalText(credentials.phoneNumberId)
    || getConnectionMetadataValue(context.connection, "phoneNumberId")
    || normalizeOptionalText(env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID);
  const graphApiVersion =
    normalizeOptionalText(credentials.graphApiVersion)
    || getConnectionMetadataValue(context.connection, "graphApiVersion")
    || normalizeOptionalText(env.WHATSAPP_CLOUD_API_VERSION)
    || DEFAULT_GRAPH_API_VERSION;

  if (!accessToken || !phoneNumberId) {
    throw buildManualReplyError(
      "WhatsApp Cloud API credentials are not configured for manual replies.",
      403,
      "whatsapp_manual_reply_credentials_missing"
    );
  }

  return {
    accessToken,
    phoneNumberId,
    graphApiVersion,
  };
}

export function buildWhatsAppCloudApiTextRequest({ credentials, destinationRef, messageText } = {}) {
  return {
    graphApiVersion: requireText(credentials?.graphApiVersion, "graph_api_version"),
    phoneNumberId: requireText(credentials?.phoneNumberId, "phone_number_id"),
    accessToken: requireText(credentials?.accessToken, "access_token"),
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: requireText(destinationRef, "destination_ref"),
      type: "text",
      text: {
        preview_url: false,
        body: requireText(messageText, "message_text"),
      },
    },
  };
}

export async function sendWhatsAppCloudApiMessage(request = {}, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw buildManualReplyError(
      "WhatsApp Cloud API client is not available.",
      503,
      "whatsapp_manual_reply_provider_client_missing"
    );
  }

  const graphApiVersion = requireText(request.graphApiVersion, "graph_api_version");
  const phoneNumberId = requireText(request.phoneNumberId, "phone_number_id");
  const accessToken = requireText(request.accessToken, "access_token");
  const payload = normalizePlainObject(request.payload);
  const response = await fetchImpl(
    `https://graph.facebook.com/${encodeURIComponent(graphApiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = buildManualReplyError(
      "WhatsApp Cloud API request failed.",
      response.status || 502,
      normalizeOptionalText(body?.error?.code) || "whatsapp_manual_reply_provider_error"
    );
    error.providerStatus = normalizeOptionalText(body?.error?.type);
    throw error;
  }

  return body;
}

async function callProviderClient(request, deps = {}) {
  const client = deps.whatsappProviderClient || deps.providerClient;

  if (typeof client === "function") {
    return client(request);
  }

  if (client && typeof client.sendMessage === "function") {
    return client.sendMessage(request);
  }

  return sendWhatsAppCloudApiMessage(request, deps);
}

function buildAuditMetadata({ request, code, extra = {} }) {
  return {
    manualStaffReply: true,
    noAiReply: true,
    noAutomaticWhatsAppMessages: true,
    messageTextStored: false,
    messageTextLength: request.messageText.length,
    templateSupportImplemented: false,
    ...extra,
    reasonCode: code,
  };
}

async function insertOutboundAudit(supabase, context, outcome = {}) {
  const now = getNowIso(context.deps);
  const request = context.request;
  const payload = {
    owner_user_id: context.ownerUserId,
    connection_id: context.connection.id,
    agent_id: context.agentId || null,
    thread_id: context.thread.id,
    provider: WHATSAPP_PROVIDER,
    app_key: WHATSAPP_APP_KEY,
    capability_key: request.capabilityKey,
    destination_ref_hash: context.thread.external_thread_key_hash,
    message_type: request.messageType,
    body_redacted: buildBodyRedactionSummary(request.messageType, request.messageText),
    template_name: request.templateName,
    template_language: request.templateLanguage,
    status: outcome.status || BLOCKED_STATUS,
    approval_mode: "manual_staff",
    provider_message_id: normalizeOptionalText(outcome.providerMessageId),
    provider_status: normalizeOptionalText(outcome.providerStatus),
    error_code: normalizeOptionalText(outcome.errorCode),
    error_message_redacted: normalizeOptionalText(outcome.errorMessageRedacted),
    metadata: buildAuditMetadata({
      request,
      code: outcome.errorCode || outcome.providerStatus || outcome.status || BLOCKED_STATUS,
      extra: normalizePlainObject(outcome.metadata),
    }),
    created_by_owner_user_id: context.actorOwnerUserId,
    sent_at: outcome.status === SENT_STATUS ? now : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(CONNECTED_APP_OUTBOUND_MESSAGE_TABLE)
    .insert(payload)
    .select(OUTBOUND_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapOutboundRow(data);
}

async function recordBlockedAndThrow(supabase, context, error) {
  const outbound = await insertOutboundAudit(supabase, context, {
    status: BLOCKED_STATUS,
    errorCode: error.code,
    errorMessageRedacted: error.message,
  });

  throw buildManualReplyError(error.message, error.statusCode || 403, error.code, outbound);
}

async function assertAgentEnablementAllowsSend(supabase, context) {
  if (!context.agentId) {
    return null;
  }

  const enablements = await fetchAgentEnablements(supabase, {
    ownerUserId: context.ownerUserId,
    connectionId: context.connection.id,
    agentId: context.agentId,
  });
  const enablement = findUsableEnablement(enablements, context.request.capabilityKey);

  if (!enablement) {
    throw buildManualReplyError(
      "WhatsApp manual reply is not enabled for this agent and capability.",
      403,
      "whatsapp_manual_reply_agent_enablement_missing"
    );
  }

  return enablement;
}

export async function sendWhatsAppManualReply(supabase, input = {}, deps = {}) {
  assertNoUnsafeInput(input);

  const ownerUserId = requireText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  const actorOwnerUserId = requireText(
    input.actorOwnerUserId
      || input.actor_owner_user_id
      || input.createdByOwnerUserId
      || input.created_by_owner_user_id,
    "actor_owner_user_id",
    401
  );

  if (actorOwnerUserId !== ownerUserId) {
    throw buildManualReplyError(
      "WhatsApp manual reply actor must match the authenticated owner.",
      403,
      "whatsapp_manual_reply_actor_owner_mismatch"
    );
  }

  const threadId = requireText(input.threadId || input.thread_id, "thread_id");
  const request = normalizeRequestedMessage(input);
  const thread = await fetchOwnerScopedThread(supabase, { ownerUserId, threadId });
  const context = {
    ownerUserId,
    actorOwnerUserId,
    thread,
    connection: null,
    agentId: null,
    request,
    deps,
  };
  const connection = await fetchOwnerScopedConnection(supabase, {
    ownerUserId,
    connectionId: thread.connection_id,
  });
  const inputAgentId = normalizeOptionalText(input.agentId || input.agent_id);
  const threadAgentId = normalizeOptionalText(thread.agent_id);
  const agentId = inputAgentId || threadAgentId;

  context.connection = connection;
  context.agentId = agentId;

  if (inputAgentId && threadAgentId && inputAgentId !== threadAgentId) {
    await recordBlockedAndThrow(
      supabase,
      context,
      buildManualReplyError(
        "WhatsApp manual reply agent scope does not match the inbound thread.",
        403,
        "whatsapp_manual_reply_agent_scope_mismatch"
      )
    );
  }

  if (!isWhatsAppManualRepliesEnabled(deps.env || process.env)) {
    await recordBlockedAndThrow(
      supabase,
      context,
      buildManualReplyError(
        "WhatsApp manual staff replies are not enabled.",
        403,
        "whatsapp_manual_replies_disabled"
      )
    );
  }

  try {
    assertUsableWhatsAppConnection(connection, request.capabilityKey);
  } catch (error) {
    await recordBlockedAndThrow(supabase, context, error);
  }

  try {
    await assertAgentEnablementAllowsSend(supabase, context);
  } catch (error) {
    await recordBlockedAndThrow(supabase, context, error);
  }

  if (request.messageType === "template") {
    await recordBlockedAndThrow(supabase, context, buildTemplateUnsupportedError());
  }

  if (!isWithinSessionWindow(thread, deps)) {
    await recordBlockedAndThrow(
      supabase,
      context,
      buildManualReplyError(
        "WhatsApp manual session replies require an inbound message inside the configured customer-service window.",
        403,
        "whatsapp_manual_reply_session_window_missing"
      )
    );
  }

  let destinationRef;
  let credentials;

  try {
    destinationRef = await resolveDestinationRef(context, deps);
    credentials = await resolveCloudApiCredentials(context, deps);
  } catch (error) {
    await recordBlockedAndThrow(supabase, context, error);
  }

  const providerRequest = buildWhatsAppCloudApiTextRequest({
    credentials,
    destinationRef,
    messageText: request.messageText,
  });

  try {
    const providerResponse = await callProviderClient(providerRequest, deps);

    return insertOutboundAudit(supabase, context, {
      status: SENT_STATUS,
      providerMessageId: normalizeProviderMessageId(providerResponse),
      providerStatus: normalizeProviderStatus(providerResponse),
      metadata: {
        cloudApiEndpoint: "messages",
        providerPayloadStored: false,
      },
    });
  } catch (error) {
    return insertOutboundAudit(supabase, context, {
      status: FAILED_STATUS,
      errorCode: normalizeOptionalText(error?.code) || "whatsapp_manual_reply_provider_error",
      errorMessageRedacted: redactProviderErrorMessage(error),
      providerStatus: normalizeOptionalText(error?.providerStatus),
      metadata: {
        cloudApiEndpoint: "messages",
        providerPayloadStored: false,
      },
    });
  }
}

export function hashWhatsAppManualReplyDestinationRef({
  ownerUserId,
  connectionId,
  threadId,
  destinationRef,
} = {}) {
  return createHash("sha256")
    .update([
      "vonza:whatsapp-manual-reply-destination:v1",
      requireText(ownerUserId, "owner_user_id"),
      requireText(connectionId, "connection_id"),
      requireText(threadId, "thread_id"),
      requireText(destinationRef, "destination_ref"),
    ].join(":"))
    .digest("hex");
}
