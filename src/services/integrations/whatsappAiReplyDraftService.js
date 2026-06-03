import {
  AGENT_CONNECTED_APP_ENABLEMENT_TABLE,
  CONNECTED_APP_CONNECTION_TABLE,
  CONNECTED_APP_INBOUND_EVENT_TABLE,
  CONNECTED_APP_INBOUND_THREAD_TABLE,
  CONNECTED_APP_OUTBOUND_MESSAGE_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { isWhatsAppManualRepliesEnabled } from "./whatsappManualReplyService.js";

export const WHATSAPP_AI_REPLY_DRAFTS_FEATURE_FLAG = "WHATSAPP_AI_REPLY_DRAFTS_ENABLED";

const WHATSAPP_PROVIDER = "whatsapp";
const WHATSAPP_APP_KEY = "whatsapp.business";
const WHATSAPP_SESSION_REPLY_CAPABILITY = "whatsapp.business.send.session.reply";
const DEFAULT_SESSION_WINDOW_HOURS = 24;
const MAX_STAFF_INSTRUCTIONS_LENGTH = 500;
const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_TEXT_LENGTH = 1500;
const MAX_DRAFT_TEXT_LENGTH = 1200;
const DEFAULT_MODEL = "gpt-4o-mini";

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

const CONTEXT_EVENT_SELECT = [
  "id",
  "owner_user_id",
  "connection_id",
  "agent_id",
  "provider",
  "provider_event_type",
  "event_direction",
  "event_status",
  "normalized_message_text",
  "thread_id",
  "created_at",
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

const UNSAFE_INPUT_FIELD_NAMES = new Set([
  "access_token",
  "accesstoken",
  "api_key",
  "apikey",
  "app_secret",
  "appsecret",
  "autosend",
  "auto_send",
  "authorization",
  "body",
  "cloud_api_access_token",
  "cloudapiaccesstoken",
  "connection_id",
  "connectionid",
  "contact",
  "contacts",
  "destination",
  "destination_phone",
  "destination_ref",
  "destinationphone",
  "destinationref",
  "from",
  "message_body",
  "message_text",
  "messagebody",
  "messagetext",
  "payload",
  "phone",
  "phone_number",
  "phone_number_id",
  "phonenumber",
  "phonenumberid",
  "provider",
  "provider_payload",
  "providerpayload",
  "raw",
  "raw_body",
  "raw_payload",
  "rawbody",
  "rawpayload",
  "recipient",
  "recipient_id",
  "recipient_phone",
  "recipientid",
  "recipientphone",
  "reply",
  "send",
  "send_message",
  "sendmessage",
  "sender",
  "sender_phone",
  "senderphone",
  "secret",
  "secret_key",
  "secretkey",
  "secrets",
  "signing_secret",
  "signingsecret",
  "to",
  "token",
  "token_secret_ref",
  "tokensecretref",
  "tokens",
  "wa_id",
  "waid",
  "whatsapp_access_token",
  "whatsapp_token",
  "whatsappaccesstoken",
  "whatsapptoken",
]);

const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;
const URL_LOOKING_VALUE_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL_LOOKING_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_LOOKING_VALUE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/;
const UUID_LOOKING_VALUE_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const HASH_LOOKING_VALUE_PATTERN = /\b[a-f0-9]{32,}\b/i;
const PROVIDER_METADATA_PATTERN = /\b(?:wamid|provider|payload|metadata|connection id|thread id|package key|policy metadata|token secret)\b/i;
const EXTERNAL_ACTION_CLAIM_PATTERN = /\b(?:i|we|it|this)\s+(?:have|has|already|just\s+)?(?:sent|booked|confirmed|scheduled|charged|processed|refunded|reserved)\b/i;
const BOOKING_PAYMENT_CLAIM_PATTERN = /\b(?:booking|payment|reservation|appointment)\s+(?:is|has been)\s+(?:confirmed|scheduled|processed|paid|reserved)\b/i;
const LEGAL_MEDICAL_ADVICE_PATTERN = /\b(?:legal advice|medical advice|diagnosis|treatment plan)\b/i;

function buildDraftError(message, statusCode = 400, code = "whatsapp_ai_reply_draft_invalid") {
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

function requireText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildDraftError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function assertNoUnsafeInput(value, path = "input") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeFieldName(key);

    if (UNSAFE_INPUT_FIELD_NAMES.has(normalizedKey)) {
      throw buildDraftError(
        `WhatsApp AI reply draft does not accept secret, provider payload, destination, message body, or send field '${path}.${key}'.`,
        400,
        "whatsapp_ai_reply_draft_unsafe_field_rejected"
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
      throw buildDraftError(
        `WhatsApp AI reply draft does not accept secret-looking value '${path}.${key}'.`,
        400,
        "whatsapp_ai_reply_draft_unsafe_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      assertNoUnsafeInput(nestedValue, `${path}.${key}`);
    }
  }
}

export function isWhatsAppAiReplyDraftsEnabled(env = process.env) {
  const value = cleanInputText(env?.[WHATSAPP_AI_REPLY_DRAFTS_FEATURE_FLAG]).toLowerCase();
  return ["1", "true", "enabled", "on"].includes(value);
}

export function getWhatsAppAiReplyDraftFeatureStatus(env = process.env) {
  const enabled = isWhatsAppAiReplyDraftsEnabled(env);

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

function normalizeStaffInstructions(input = {}) {
  const instructions = cleanInputText(
    readInputField(input, "staffInstructions", "staff_instructions")
      || readInputField(input, "instructions", "instructions")
  );

  return instructions.slice(0, MAX_STAFF_INSTRUCTIONS_LENGTH);
}

function normalizeTone(input = {}) {
  const tone = normalizeKey(readInputField(input, "tone", "tone"));
  return ["warm", "neutral", "concise", "professional"].includes(tone) ? tone : "";
}

function normalizeLocale(input = {}) {
  const locale = cleanInputText(readInputField(input, "locale", "locale"));
  return /^[a-z]{2}(?:[-_][A-Z]{2})?$/i.test(locale) ? locale.slice(0, 12) : "";
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
    throw buildDraftError(
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
    throw buildDraftError(
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

function assertUsableWhatsAppThread(thread = {}) {
  if (
    normalizeKey(thread.provider) !== WHATSAPP_PROVIDER
    || normalizeKey(thread.app_key) !== WHATSAPP_APP_KEY
  ) {
    throw buildDraftError(
      "Connected app inbound thread is not a WhatsApp Business thread.",
      400,
      "whatsapp_ai_reply_draft_thread_not_whatsapp"
    );
  }
}

function assertUsableWhatsAppConnection(connection = {}) {
  if (
    normalizeKey(connection.provider) !== WHATSAPP_PROVIDER
    || normalizeKey(connection.app_key) !== WHATSAPP_APP_KEY
  ) {
    throw buildDraftError(
      "Connected app connection is not a WhatsApp Business connection.",
      400,
      "whatsapp_ai_reply_draft_connection_not_whatsapp"
    );
  }

  if (normalizeKey(connection.status) !== "active") {
    throw buildDraftError(
      "WhatsApp Business connection is not active.",
      403,
      "whatsapp_ai_reply_draft_connection_inactive"
    );
  }

  const capabilityKeys = normalizeArray(connection.capability_keys).map((key) => normalizeKey(key));

  if (!capabilityKeys.includes(WHATSAPP_SESSION_REPLY_CAPABILITY)) {
    throw buildDraftError(
      "WhatsApp Business connection does not include the manual session reply capability.",
      403,
      "whatsapp_ai_reply_draft_capability_not_on_connection"
    );
  }
}

function findUsableEnablement(enablements = []) {
  return enablements.find((enablement) => {
    const capabilityKeys = normalizeArray(enablement.capability_keys).map((key) => normalizeKey(key));
    const allowedSurfaces = normalizeArray(enablement.allowed_surfaces).map((surface) => normalizeKey(surface));
    const approvalMode = normalizeKey(enablement.approval_mode || "manual_review");

    return enablement.enabled === true
      && capabilityKeys.includes(WHATSAPP_SESSION_REPLY_CAPABILITY)
      && approvalMode !== "disabled"
      && (allowedSurfaces.includes("dashboard") || allowedSurfaces.includes("internal"));
  }) || null;
}

async function assertAgentEnablementAllowsDraft(supabase, context) {
  if (!context.agentId) {
    return null;
  }

  const enablements = await fetchAgentEnablements(supabase, {
    ownerUserId: context.ownerUserId,
    connectionId: context.connection.id,
    agentId: context.agentId,
  });
  const enablement = findUsableEnablement(enablements);

  if (!enablement) {
    throw buildDraftError(
      "WhatsApp AI reply drafts are not enabled for this agent and capability.",
      403,
      "whatsapp_ai_reply_draft_agent_enablement_missing"
    );
  }

  return enablement;
}

function normalizeStoredContextText(value) {
  const text = cleanInputText(value);

  if (!text || text.length > MAX_CONTEXT_TEXT_LENGTH) {
    return "";
  }

  if (
    URL_LOOKING_VALUE_PATTERN.test(text)
    || SECRET_LOOKING_VALUE_PATTERN.test(text)
    || JWT_LOOKING_VALUE_PATTERN.test(text)
    || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(text)
    || EMAIL_LOOKING_VALUE_PATTERN.test(text)
    || PHONE_LOOKING_VALUE_PATTERN.test(text)
  ) {
    return "";
  }

  return text;
}

async function fetchRecentInboundMessageContext(supabase, context) {
  const { data, error } = await supabase
    .from(CONNECTED_APP_INBOUND_EVENT_TABLE)
    .select(CONTEXT_EVENT_SELECT)
    .eq("owner_user_id", context.ownerUserId)
    .eq("thread_id", context.thread.id)
    .eq("provider", WHATSAPP_PROVIDER)
    .eq("event_direction", "inbound")
    .eq("event_status", "received")
    .eq("provider_event_type", "message")
    .order("created_at", { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES);

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      id: normalizeOptionalText(row.id),
      createdAt: row.created_at || null,
      text: normalizeStoredContextText(row.normalized_message_text),
    }))
    .filter((row) => row.text)
    .reverse();
}

function buildNoDraftResult(status, reasonCode, message) {
  return {
    status,
    reasonCode,
    draftText: "",
    draft: "",
    aiDraftOnly: true,
    requiresStaffApproval: true,
    noAutomaticWhatsAppReplies: true,
    noProviderSend: true,
    message,
  };
}

function buildDraftSystemPrompt({ locale, tone } = {}) {
  const localeLine = locale ? `Use locale ${locale} if it is clearly compatible with the customer messages.` : "Use the same language as the recent customer messages when clear.";
  const toneLine = tone ? `Preferred tone: ${tone}.` : "Use a concise, professional WhatsApp tone.";

  return `You draft WhatsApp replies for staff review only.
${localeLine}
${toneLine}

Rules:
- Return only the draft text, or exactly INSUFFICIENT_CONTEXT.
- Staff must review and manually send; never imply the message was sent automatically.
- Do not claim bookings, reservations, appointments, payments, refunds, legal advice, medical advice, or external actions are confirmed or completed.
- Do not include phone numbers, email addresses, URLs, unsupported contact details, internal IDs, package keys, policy metadata, provider metadata, or provider payload details.
- If the customer context is too thin, ambiguous, or asks for an external action, say staff should review or ask one short clarifying question.
- Keep the draft short and appropriate for WhatsApp.`;
}

function buildDraftUserPrompt({ messages, staffInstructions }) {
  const contextBlock = messages
    .map((message, index) => `Customer message ${index + 1}: ${message.text}`)
    .join("\n");
  const instructionBlock = staffInstructions
    ? `\nStaff instructions for tone/content only:\n${staffInstructions}\n`
    : "";

  return `Recent owner-scoped WhatsApp customer context:\n${contextBlock}${instructionBlock}\nDraft one staff-reviewed reply.`;
}

function extractResponseOutputText(response = {}) {
  const directText = cleanText(response.output_text || "");

  if (directText) {
    return directText;
  }

  if (Array.isArray(response.output)) {
    const outputText = response.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((content) => cleanText(content?.text || ""))
      .filter(Boolean)
      .join("\n");

    if (outputText) {
      return cleanText(outputText);
    }
  }

  if (Array.isArray(response.choices)) {
    return cleanText(response.choices[0]?.message?.content || response.choices[0]?.text || "");
  }

  return "";
}

async function callDraftModel(openai, request) {
  if (openai?.responses?.create) {
    const response = await openai.responses.create({
      model: request.model,
      temperature: 0.35,
      max_output_tokens: 350,
      instructions: buildDraftSystemPrompt(request),
      input: [
        {
          role: "user",
          content: buildDraftUserPrompt(request),
        },
      ],
    });

    return extractResponseOutputText(response);
  }

  if (openai?.chat?.completions?.create) {
    const response = await openai.chat.completions.create({
      model: request.model,
      temperature: 0.35,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content: buildDraftSystemPrompt(request),
        },
        {
          role: "user",
          content: buildDraftUserPrompt(request),
        },
      ],
    });

    return extractResponseOutputText(response);
  }

  throw buildDraftError(
    "WhatsApp AI reply drafting is temporarily unavailable.",
    503,
    "whatsapp_ai_reply_model_unavailable"
  );
}

function normalizeGeneratedDraftText(value) {
  const text = cleanInputText(value)
    .replace(/^["']+|["']+$/g, "")
    .slice(0, MAX_DRAFT_TEXT_LENGTH);

  if (!text || /^INSUFFICIENT_CONTEXT$/i.test(text)) {
    return {
      status: "insufficient_context",
      draftText: "",
      reasonCode: "whatsapp_ai_reply_draft_context_insufficient",
      message: "Recent WhatsApp context is insufficient for a safe AI draft.",
    };
  }

  if (
    URL_LOOKING_VALUE_PATTERN.test(text)
    || EMAIL_LOOKING_VALUE_PATTERN.test(text)
    || PHONE_LOOKING_VALUE_PATTERN.test(text)
    || UUID_LOOKING_VALUE_PATTERN.test(text)
    || HASH_LOOKING_VALUE_PATTERN.test(text)
    || PROVIDER_METADATA_PATTERN.test(text)
    || EXTERNAL_ACTION_CLAIM_PATTERN.test(text)
    || BOOKING_PAYMENT_CLAIM_PATTERN.test(text)
    || LEGAL_MEDICAL_ADVICE_PATTERN.test(text)
  ) {
    return {
      status: "blocked",
      draftText: "",
      reasonCode: "whatsapp_ai_reply_draft_safety_blocked",
      message: "AI draft was blocked because it included unsupported contact, provider, or action-confirmation content.",
    };
  }

  return {
    status: "draft",
    draftText: text,
    reasonCode: "whatsapp_ai_reply_draft_created",
    message: "AI draft created for staff review only.",
  };
}

function resolveOpenAIClient(deps = {}) {
  if (deps.openai) {
    return deps.openai;
  }

  if (typeof deps.getOpenAIClient === "function") {
    return deps.getOpenAIClient();
  }

  throw buildDraftError(
    "WhatsApp AI reply drafting is temporarily unavailable.",
    503,
    "whatsapp_ai_reply_model_unavailable"
  );
}

async function insertDraftAudit(supabase, context, draftText, metadata = {}) {
  const now = getNowIso(context.deps);
  const payload = {
    owner_user_id: context.ownerUserId,
    connection_id: context.connection.id,
    agent_id: context.agentId || null,
    thread_id: context.thread.id,
    provider: WHATSAPP_PROVIDER,
    app_key: WHATSAPP_APP_KEY,
    capability_key: WHATSAPP_SESSION_REPLY_CAPABILITY,
    destination_ref_hash: context.thread.external_thread_key_hash,
    message_type: "text",
    body_redacted: `[AI draft text redacted: ${draftText.length} chars]`,
    template_name: null,
    template_language: null,
    status: "draft",
    approval_mode: "manual_staff",
    provider_message_id: null,
    provider_status: null,
    error_code: null,
    error_message_redacted: null,
    metadata: {
      aiDraftOnly: true,
      staffApprovalRequired: true,
      noAutomaticWhatsAppReplies: true,
      noProviderSend: true,
      noTwilio: true,
      noPublicChatMessage: true,
      draftTextStored: false,
      providerPayloadStored: false,
      messageTextStoredInOutboundAudit: false,
      reasonCode: "whatsapp_ai_reply_draft_created",
      ...metadata,
    },
    created_by_owner_user_id: context.actorOwnerUserId,
    sent_at: null,
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

export async function createWhatsAppAiReplyDraft(supabase, input = {}, deps = {}) {
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
    throw buildDraftError(
      "WhatsApp AI reply draft actor must match the authenticated owner.",
      403,
      "whatsapp_ai_reply_draft_actor_owner_mismatch"
    );
  }

  if (!isWhatsAppAiReplyDraftsEnabled(deps.env || process.env)) {
    throw buildDraftError(
      "WhatsApp AI reply drafts are not enabled.",
      403,
      "whatsapp_ai_reply_drafts_disabled"
    );
  }

  if (!isWhatsAppManualRepliesEnabled(deps.env || process.env)) {
    throw buildDraftError(
      "WhatsApp manual staff replies must be enabled before AI drafts can be prepared.",
      403,
      "whatsapp_ai_reply_manual_replies_disabled"
    );
  }

  const threadId = requireText(input.threadId || input.thread_id, "thread_id");
  const thread = await fetchOwnerScopedThread(supabase, { ownerUserId, threadId });
  const connection = await fetchOwnerScopedConnection(supabase, {
    ownerUserId,
    connectionId: thread.connection_id,
  });
  const inputAgentId = normalizeOptionalText(input.agentId || input.agent_id);
  const threadAgentId = normalizeOptionalText(thread.agent_id);
  const agentId = inputAgentId || threadAgentId;
  const context = {
    ownerUserId,
    actorOwnerUserId,
    thread,
    connection,
    agentId,
    deps,
  };

  if (inputAgentId && threadAgentId && inputAgentId !== threadAgentId) {
    throw buildDraftError(
      "WhatsApp AI reply draft agent scope does not match the inbound thread.",
      403,
      "whatsapp_ai_reply_draft_agent_scope_mismatch"
    );
  }

  assertUsableWhatsAppThread(thread);
  assertUsableWhatsAppConnection(connection);
  await assertAgentEnablementAllowsDraft(supabase, context);

  if (!isWithinSessionWindow(thread, deps)) {
    throw buildDraftError(
      "WhatsApp AI reply drafts require an inbound message inside the configured customer-service window.",
      403,
      "whatsapp_ai_reply_draft_session_window_missing"
    );
  }

  const messages = await fetchRecentInboundMessageContext(supabase, context);

  if (!messages.length) {
    return buildNoDraftResult(
      "insufficient_context",
      "whatsapp_ai_reply_draft_context_missing",
      "AI draft only: recent owner-scoped WhatsApp message text is unavailable. Staff must review and send manually."
    );
  }

  const model = cleanInputText(deps.model || deps.env?.WHATSAPP_AI_REPLY_DRAFT_MODEL) || DEFAULT_MODEL;
  const request = {
    model,
    messages,
    staffInstructions: normalizeStaffInstructions(input),
    locale: normalizeLocale(input),
    tone: normalizeTone(input),
  };
  let rawDraft;

  try {
    rawDraft = await callDraftModel(resolveOpenAIClient(deps), request);
  } catch (error) {
    if (error?.code === "whatsapp_ai_reply_model_unavailable") {
      throw error;
    }

    throw buildDraftError(
      "WhatsApp AI reply drafting is temporarily unavailable.",
      503,
      "whatsapp_ai_reply_model_unavailable"
    );
  }

  const normalizedDraft = normalizeGeneratedDraftText(rawDraft);

  if (normalizedDraft.status !== "draft") {
    return buildNoDraftResult(
      normalizedDraft.status,
      normalizedDraft.reasonCode,
      normalizedDraft.message
    );
  }

  await insertDraftAudit(supabase, context, normalizedDraft.draftText, {
    model,
    contextMessageCount: messages.length,
    staffInstructionsProvided: Boolean(request.staffInstructions),
    locale: request.locale || null,
    tone: request.tone || null,
  });

  return {
    ok: true,
    status: "draft",
    reasonCode: normalizedDraft.reasonCode,
    draftText: normalizedDraft.draftText,
    draft: normalizedDraft.draftText,
    aiDraftOnly: true,
    requiresStaffApproval: true,
    noAutomaticWhatsAppReplies: true,
    noProviderSend: true,
    message: normalizedDraft.message,
  };
}
