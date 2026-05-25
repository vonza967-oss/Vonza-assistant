import { AGENT_PHONE_CALL_SESSION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { normalizePhoneNumberE164 } from "./phoneNumberService.js";

const CALL_SESSION_SELECT = [
  "id",
  "phone_number_id",
  "agent_id",
  "business_id",
  "owner_user_id",
  "provider",
  "provider_call_sid",
  "caller_phone_e164",
  "called_phone_e164",
  "status",
  "block_reason",
  "started_at",
  "ended_at",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function mapCallSessionRow(row = {}) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    id: cleanText(row.id),
    phoneNumberId: cleanText(row.phone_number_id),
    agentId: cleanText(row.agent_id),
    businessId: cleanText(row.business_id),
    ownerUserId: cleanText(row.owner_user_id),
    provider: cleanText(row.provider).toLowerCase() || "twilio",
    providerCallSid: cleanText(row.provider_call_sid),
    callerPhoneE164: normalizePhoneNumberE164(row.caller_phone_e164),
    calledPhoneE164: normalizePhoneNumberE164(row.called_phone_e164),
    status: cleanText(row.status).toLowerCase() || "started",
    blockReason: cleanText(row.block_reason),
    startedAt: toIsoString(row.started_at),
    endedAt: toIsoString(row.ended_at),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function findCallSessionByProviderSid(supabase, options = {}) {
  const provider = cleanText(options.provider).toLowerCase() || "twilio";
  const providerCallSid = cleanText(options.providerCallSid || options.callSid);

  if (!providerCallSid) {
    return null;
  }

  let query = supabase
    .from(AGENT_PHONE_CALL_SESSION_TABLE)
    .select(CALL_SESSION_SELECT)
    .eq("provider", provider)
    .eq("provider_call_sid", providerCallSid);

  if (cleanText(options.phoneNumberId)) {
    query = query.eq("phone_number_id", cleanText(options.phoneNumberId));
  }

  if (cleanText(options.ownerUserId)) {
    query = query.eq("owner_user_id", cleanText(options.ownerUserId));
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return mapCallSessionRow(data);
}

export async function createOrUpdateCallSession(supabase, payload = {}) {
  const now = new Date().toISOString();
  const provider = cleanText(payload.provider).toLowerCase() || "twilio";
  const providerCallSid = cleanText(payload.providerCallSid || payload.provider_call_sid);
  const ownerUserId = cleanText(payload.ownerUserId || payload.owner_user_id);

  if (!providerCallSid || !ownerUserId) {
    const error = new Error("provider_call_sid and owner_user_id are required");
    error.statusCode = 400;
    error.code = "phone_session_scope_required";
    throw error;
  }

  const existing = await findCallSessionByProviderSid(supabase, {
    provider,
    providerCallSid,
  });

  if (existing && existing.ownerUserId !== ownerUserId) {
    const error = new Error("Phone call session scope mismatch.");
    error.statusCode = 403;
    error.code = "phone_session_scope_mismatch";
    throw error;
  }

  const values = {
    phone_number_id: cleanText(payload.phoneNumberId || payload.phone_number_id),
    agent_id: cleanText(payload.agentId || payload.agent_id),
    business_id: cleanText(payload.businessId || payload.business_id),
    owner_user_id: ownerUserId,
    provider,
    provider_call_sid: providerCallSid,
    caller_phone_e164: normalizePhoneNumberE164(payload.callerPhoneE164 || payload.caller_phone_e164) || null,
    called_phone_e164: normalizePhoneNumberE164(payload.calledPhoneE164 || payload.called_phone_e164) || null,
    status: cleanText(payload.status).toLowerCase() || "started",
    block_reason: cleanText(payload.blockReason || payload.block_reason) || null,
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    updated_at: now,
  };

  if (payload.endedAt || payload.ended_at) {
    values.ended_at = toIsoString(payload.endedAt || payload.ended_at);
  }

  const query = existing
    ? supabase
      .from(AGENT_PHONE_CALL_SESSION_TABLE)
      .update(values)
      .eq("id", existing.id)
      .eq("owner_user_id", ownerUserId)
    : supabase
      .from(AGENT_PHONE_CALL_SESSION_TABLE)
      .insert({
        ...values,
        started_at: toIsoString(payload.startedAt || payload.started_at) || now,
        created_at: now,
      });

  const { data, error } = await query.select(CALL_SESSION_SELECT).maybeSingle();

  if (error) {
    throw error;
  }

  return mapCallSessionRow(data);
}

export async function updateCallSessionStatusForProviderCall(supabase, options = {}) {
  const existing = await findCallSessionByProviderSid(supabase, options);

  if (!existing) {
    return null;
  }

  const nextMetadata = {
    ...existing.metadata,
    ...(options.metadata && typeof options.metadata === "object" ? options.metadata : {}),
  };

  const values = {
    status: cleanText(options.status).toLowerCase() || existing.status,
    block_reason: cleanText(options.blockReason) || existing.blockReason || null,
    ended_at: toIsoString(options.endedAt) || existing.endedAt,
    metadata: nextMetadata,
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from(AGENT_PHONE_CALL_SESSION_TABLE)
    .update(values)
    .eq("id", existing.id)
    .eq("owner_user_id", existing.ownerUserId);

  if (cleanText(options.phoneNumberId)) {
    query = query.eq("phone_number_id", cleanText(options.phoneNumberId));
  }

  const { data, error } = await query.select(CALL_SESSION_SELECT).maybeSingle();

  if (error) {
    throw error;
  }

  return mapCallSessionRow(data);
}
