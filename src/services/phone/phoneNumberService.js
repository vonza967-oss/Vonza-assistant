import { AGENT_PHONE_NUMBER_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const PHONE_NUMBER_SELECT = [
  "id",
  "agent_id",
  "business_id",
  "owner_user_id",
  "provider",
  "phone_number_e164",
  "label",
  "status",
  "phone_channel_enabled",
  "greeting_text",
  "disclosure_text",
  "fallback_mode",
  "created_at",
  "updated_at",
].join(", ");

const AGENT_SELECT = [
  "id",
  "business_id",
  "owner_user_id",
  "access_status",
  "is_active",
].join(", ");

const PHONE_NUMBER_STATUSES = new Set(["pending", "active", "disabled"]);
const PHONE_FALLBACK_MODES = new Set(["callback_only"]);
const MAX_LABEL_LENGTH = 80;
const MAX_GREETING_LENGTH = 320;
const MAX_DISCLOSURE_LENGTH = 320;

function buildPhoneNumberError(message, statusCode = 400, code = "invalid_phone_number_request") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function truncateCleanText(value, maxLength) {
  const normalized = cleanText(value);
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trim()
    : normalized;
}

export function normalizePhoneNumberE164(value = "") {
  const normalized = cleanText(value).replace(/[^\d+]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function normalizePhoneNumberStatus(value) {
  const status = cleanText(value).toLowerCase() || "pending";

  if (!PHONE_NUMBER_STATUSES.has(status)) {
    throw buildPhoneNumberError(
      "Phone number status must be pending, active, or disabled.",
      400,
      "invalid_phone_number_status"
    );
  }

  return status;
}

function normalizeFallbackMode(value) {
  const fallbackMode = cleanText(value).toLowerCase() || "callback_only";

  if (!PHONE_FALLBACK_MODES.has(fallbackMode)) {
    throw buildPhoneNumberError(
      "Phone fallback mode is not supported.",
      400,
      "invalid_phone_fallback_mode"
    );
  }

  return fallbackMode;
}

export function mapPhoneNumberRow(row = {}) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agent_id),
    businessId: cleanText(row.business_id),
    ownerUserId: cleanText(row.owner_user_id),
    provider: cleanText(row.provider).toLowerCase() || "twilio",
    phoneNumberE164: normalizePhoneNumberE164(row.phone_number_e164),
    label: cleanText(row.label),
    status: cleanText(row.status).toLowerCase() || "pending",
    phoneChannelEnabled: row.phone_channel_enabled === true,
    greetingText: cleanText(row.greeting_text),
    disclosureText: cleanText(row.disclosure_text),
    fallbackMode: cleanText(row.fallback_mode).toLowerCase() || "callback_only",
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  };
}

async function findAgentForAdminPhoneNumber(supabase, payload = {}) {
  const agentId = cleanText(payload.agentId || payload.agent_id);

  if (!agentId) {
    throw buildPhoneNumberError("agent_id is required.", 400, "agent_id_required");
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!agent) {
    throw buildPhoneNumberError("Agent was not found.", 404, "agent_not_found");
  }

  const businessId = cleanText(payload.businessId || payload.business_id);
  const ownerUserId = cleanText(payload.ownerUserId || payload.owner_user_id);

  if (businessId && cleanText(agent.business_id) !== businessId) {
    throw buildPhoneNumberError("business_id does not match the target agent.", 400, "agent_business_mismatch");
  }

  if (ownerUserId && cleanText(agent.owner_user_id) !== ownerUserId) {
    throw buildPhoneNumberError("owner_user_id does not match the target agent.", 400, "agent_owner_mismatch");
  }

  return agent;
}

function buildAdminPhoneNumberPayload(agent, payload = {}) {
  const phoneNumberE164 = normalizePhoneNumberE164(
    payload.phoneNumberE164 || payload.phone_number_e164
  );

  if (!phoneNumberE164) {
    throw buildPhoneNumberError(
      "phone_number_e164 must be a valid E.164 phone number.",
      400,
      "invalid_phone_number_e164"
    );
  }

  return {
    agent_id: cleanText(agent.id),
    business_id: cleanText(agent.business_id),
    owner_user_id: cleanText(agent.owner_user_id),
    provider: "twilio",
    phone_number_e164: phoneNumberE164,
    label: truncateCleanText(payload.label, MAX_LABEL_LENGTH) || null,
    status: normalizePhoneNumberStatus(payload.status),
    phone_channel_enabled: payload.phoneChannelEnabled !== undefined
      ? payload.phoneChannelEnabled === true
      : payload.phone_channel_enabled === true,
    greeting_text: truncateCleanText(payload.greetingText || payload.greeting_text, MAX_GREETING_LENGTH) || null,
    disclosure_text: truncateCleanText(payload.disclosureText || payload.disclosure_text, MAX_DISCLOSURE_LENGTH) || null,
    fallback_mode: normalizeFallbackMode(payload.fallbackMode || payload.fallback_mode),
    updated_at: new Date().toISOString(),
  };
}

async function findPhoneNumberByProviderNumber(supabase, phoneNumberE164) {
  const { data, error } = await supabase
    .from(AGENT_PHONE_NUMBER_TABLE)
    .select(PHONE_NUMBER_SELECT)
    .eq("provider", "twilio")
    .eq("phone_number_e164", phoneNumberE164)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapPhoneNumberRow(data);
}

function assertNoActiveDuplicate(existingPhoneNumber, payload) {
  if (!existingPhoneNumber?.id) {
    return;
  }

  const sameAgent = existingPhoneNumber.agentId === payload.agent_id;
  const existingIsActive = existingPhoneNumber.status === "active";
  const nextIsActive = payload.status === "active";

  if (!sameAgent && (existingIsActive || nextIsActive)) {
    throw buildPhoneNumberError(
      "Phone number is already assigned to another active agent.",
      409,
      "duplicate_active_phone_number"
    );
  }
}

function hasDefinedValue(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined;
}

function applyExistingPhoneNumberDefaults(rowPayload, payload, existingPhoneNumber) {
  if (!existingPhoneNumber?.id) {
    return rowPayload;
  }

  if (!hasDefinedValue(payload, "label")) {
    rowPayload.label = existingPhoneNumber.label || null;
  }

  if (!hasDefinedValue(payload, "status")) {
    rowPayload.status = existingPhoneNumber.status || "pending";
  }

  if (!hasDefinedValue(payload, "phoneChannelEnabled") && !hasDefinedValue(payload, "phone_channel_enabled")) {
    rowPayload.phone_channel_enabled = existingPhoneNumber.phoneChannelEnabled === true;
  }

  if (!hasDefinedValue(payload, "greetingText") && !hasDefinedValue(payload, "greeting_text")) {
    rowPayload.greeting_text = existingPhoneNumber.greetingText || null;
  }

  if (!hasDefinedValue(payload, "disclosureText") && !hasDefinedValue(payload, "disclosure_text")) {
    rowPayload.disclosure_text = existingPhoneNumber.disclosureText || null;
  }

  if (!hasDefinedValue(payload, "fallbackMode") && !hasDefinedValue(payload, "fallback_mode")) {
    rowPayload.fallback_mode = existingPhoneNumber.fallbackMode || "callback_only";
  }

  return rowPayload;
}

export async function upsertAdminPhoneNumberAssignment(supabase, payload = {}) {
  const agent = await findAgentForAdminPhoneNumber(supabase, payload);
  const rowPayload = buildAdminPhoneNumberPayload(agent, payload);
  const existingPhoneNumber = await findPhoneNumberByProviderNumber(
    supabase,
    rowPayload.phone_number_e164
  );
  applyExistingPhoneNumberDefaults(rowPayload, payload, existingPhoneNumber);

  assertNoActiveDuplicate(existingPhoneNumber, rowPayload);

  if (existingPhoneNumber?.id) {
    const { data, error } = await supabase
      .from(AGENT_PHONE_NUMBER_TABLE)
      .update(rowPayload)
      .eq("id", existingPhoneNumber.id)
      .select(PHONE_NUMBER_SELECT)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return mapPhoneNumberRow(data);
  }

  const { data, error } = await supabase
    .from(AGENT_PHONE_NUMBER_TABLE)
    .insert({
      ...rowPayload,
      created_at: new Date().toISOString(),
    })
    .select(PHONE_NUMBER_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapPhoneNumberRow(data);
}

export async function listAdminPhoneNumbersForAgent(supabase, options = {}) {
  const agent = await findAgentForAdminPhoneNumber(supabase, options);
  const { data, error } = await supabase
    .from(AGENT_PHONE_NUMBER_TABLE)
    .select(PHONE_NUMBER_SELECT)
    .eq("agent_id", cleanText(agent.id))
    .eq("owner_user_id", cleanText(agent.owner_user_id));

  if (error) {
    throw error;
  }

  return (data || []).map(mapPhoneNumberRow).filter(Boolean);
}

export async function findPhoneNumberContextByTo(supabase, options = {}) {
  const provider = cleanText(options.provider).toLowerCase() || "twilio";
  const phoneNumberE164 = normalizePhoneNumberE164(options.to || options.phoneNumberE164);

  if (!phoneNumberE164) {
    return {
      phoneNumber: null,
      agent: null,
      normalizedTo: "",
    };
  }

  const { data: phoneRow, error: phoneError } = await supabase
    .from(AGENT_PHONE_NUMBER_TABLE)
    .select(PHONE_NUMBER_SELECT)
    .eq("provider", provider)
    .eq("phone_number_e164", phoneNumberE164)
    .maybeSingle();

  if (phoneError) {
    throw phoneError;
  }

  const phoneNumber = mapPhoneNumberRow(phoneRow);

  if (!phoneNumber?.agentId || !phoneNumber.ownerUserId) {
    return {
      phoneNumber,
      agent: null,
      normalizedTo: phoneNumberE164,
    };
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("id", phoneNumber.agentId)
    .eq("owner_user_id", phoneNumber.ownerUserId)
    .maybeSingle();

  if (agentError) {
    throw agentError;
  }

  const agentMatchesPhone =
    agent
    && cleanText(agent.business_id) === phoneNumber.businessId
    && cleanText(agent.owner_user_id) === phoneNumber.ownerUserId;

  return {
    phoneNumber,
    agent: agentMatchesPhone ? agent : null,
    normalizedTo: phoneNumberE164,
  };
}
