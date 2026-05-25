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

export function normalizePhoneNumberE164(value = "") {
  const normalized = cleanText(value).replace(/[^\d+]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return "";
  }

  return normalized;
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
