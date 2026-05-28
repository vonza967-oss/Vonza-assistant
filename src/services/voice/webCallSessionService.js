import {
  WEB_CALL_SESSION_TABLE,
  WEB_CALL_TURN_TELEMETRY_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const WEB_CALL_EVENT_PREFIX = "web_call_";
const MAX_SAFE_TEXT_LENGTH = 160;
const SAFE_FAILURE_CATEGORY_PATTERN = /^[a-z0-9_:-]{1,80}$/;

function isMissingRelationError(error, relationName = "") {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes(`'public.${relationName}'`) ||
    message.includes(`${relationName} was not found`)
  );
}

function safeText(value, maxLength = MAX_SAFE_TEXT_LENGTH) {
  const normalized = cleanText(value);
  return normalized ? normalized.slice(0, maxLength) : "";
}

function safeInteger(value, max = 10 * 60 * 1000) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.min(max, Math.round(numeric));
}

function safeDurationSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.min(10 * 60, Math.round(numeric * 10) / 10);
}

function safeFailureCategory(value) {
  const normalized = safeText(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  return SAFE_FAILURE_CATEGORY_PATTERN.test(normalized) ? normalized : "";
}

function getAgentId(agent = {}) {
  return safeText(agent.id || agent.agent_id);
}

function getBusinessId(business = {}, fallback = "") {
  return safeText(business.id || business.business_id || fallback);
}

function getOwnerUserId(agent = {}, fallback = "") {
  return safeText(agent.ownerUserId || agent.owner_user_id || fallback);
}

function getClientSessionKey(input = {}) {
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata
    : {};
  return safeText(
    input.clientSessionKey ||
    input.webCallId ||
    input.web_call_id ||
    metadata.web_call_id ||
    metadata.webCallId
  );
}

function normalizeStatusForEvent(eventName = "", metadata = {}) {
  if (eventName === "web_call_ended") {
    return "completed";
  }

  if (
    eventName === "web_call_failed_recovery_shown" ||
    eventName === "web_call_mic_denied" ||
    eventName === "web_call_speech_failed"
  ) {
    return "failed";
  }

  if (safeFailureCategory(metadata.failure_category || metadata.failureCategory)) {
    return "active";
  }

  return eventName === "web_call_started" ? "started" : "active";
}

function buildSessionUpdate({ eventName, metadata = {}, now }) {
  const status = normalizeStatusForEvent(eventName, metadata);
  const failureCategory = safeFailureCategory(metadata.failure_category || metadata.failureCategory);
  const turnCount = safeInteger(metadata.turn_count || metadata.turnCount, 200);
  const durationSeconds = safeInteger(metadata.duration_seconds || metadata.durationSeconds, 24 * 60 * 60);
  const payload = {
    status,
    last_event_at: now,
    updated_at: now,
  };

  if (eventName === "web_call_started") {
    payload.started_at = now;
  }

  if (eventName === "web_call_ended") {
    payload.ended_at = now;
  }

  if (turnCount !== null) {
    payload.turn_count = turnCount;
  }

  if (durationSeconds !== null) {
    payload.duration_seconds = durationSeconds;
  }

  if (failureCategory) {
    payload.failure_category = failureCategory;
  }

  return payload;
}

async function maybeSingle(query) {
  if (typeof query.maybeSingle === "function") {
    return query.maybeSingle();
  }

  if (typeof query.single === "function") {
    return query.single();
  }

  const result = await query;
  return {
    data: Array.isArray(result?.data) ? result.data[0] || null : result?.data || null,
    error: result?.error || null,
  };
}

async function findSessionByClientKey(supabase, { agentId, clientSessionKey }) {
  if (!agentId || !clientSessionKey) {
    return null;
  }

  const { data, error } = await maybeSingle(
    supabase
      .from(WEB_CALL_SESSION_TABLE)
      .select("id, agent_id, business_id, owner_user_id, client_session_key, visitor_session_key, status, turn_count")
      .eq("agent_id", agentId)
      .eq("client_session_key", clientSessionKey)
      .limit(1)
  );

  if (error) {
    if (isMissingRelationError(error, WEB_CALL_SESSION_TABLE)) {
      return null;
    }

    throw error;
  }

  return data || null;
}

export async function resolveWebCallSessionId(supabase, input = {}) {
  const agentId = getAgentId(input.agent || { id: input.agentId || input.agent_id });
  const clientSessionKey = getClientSessionKey(input);
  const session = await findSessionByClientKey(supabase, { agentId, clientSessionKey });
  return safeText(session?.id);
}

export async function ensureWebCallSession(supabase, input = {}) {
  const eventName = safeText(input.eventName || input.event_name);

  if (eventName && !eventName.startsWith(WEB_CALL_EVENT_PREFIX)) {
    return null;
  }

  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata
    : {};
  const agent = input.agent || {};
  const business = input.business || {};
  const agentId = getAgentId(agent) || safeText(input.agentId || input.agent_id);
  const businessId = getBusinessId(business, input.businessId || input.business_id);
  const ownerUserId = getOwnerUserId(agent, input.ownerUserId || input.owner_user_id);
  const clientSessionKey = getClientSessionKey(input);

  if (!supabase || !agentId || !businessId || !ownerUserId || !clientSessionKey) {
    return null;
  }

  const now = new Date().toISOString();
  const visitorSessionKey = safeText(input.visitorSessionKey || input.visitor_session_key);
  const existing = await findSessionByClientKey(supabase, { agentId, clientSessionKey });
  const updatePayload = buildSessionUpdate({ eventName, metadata, now });

  if (existing?.id) {
    const { data, error } = await maybeSingle(
      supabase
        .from(WEB_CALL_SESSION_TABLE)
        .update({
          ...updatePayload,
          ...(visitorSessionKey ? { visitor_session_key: visitorSessionKey } : {}),
        })
        .eq("id", existing.id)
        .select("id, agent_id, business_id, owner_user_id, client_session_key, visitor_session_key, status, turn_count")
        .limit(1)
    );

    if (error) {
      if (isMissingRelationError(error, WEB_CALL_SESSION_TABLE)) {
        return null;
      }

      throw error;
    }

    return data || existing;
  }

  const { data, error } = await maybeSingle(
    supabase
      .from(WEB_CALL_SESSION_TABLE)
      .insert({
        agent_id: agentId,
        business_id: businessId,
        owner_user_id: ownerUserId,
        client_session_key: clientSessionKey,
        visitor_session_key: visitorSessionKey || null,
        display_mode: "page",
        status: updatePayload.status || "started",
        turn_count: updatePayload.turn_count || 0,
        duration_seconds: updatePayload.duration_seconds || null,
        failure_category: updatePayload.failure_category || null,
        started_at: updatePayload.started_at || now,
        ended_at: updatePayload.ended_at || null,
        last_event_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id, agent_id, business_id, owner_user_id, client_session_key, visitor_session_key, status, turn_count")
      .limit(1)
  );

  if (error) {
    if (isMissingRelationError(error, WEB_CALL_SESSION_TABLE)) {
      return null;
    }

    throw error;
  }

  return data || null;
}

function buildTelemetryPatch(metadata = {}, eventName = "") {
  const failureCategory = safeFailureCategory(metadata.failure_category || metadata.failureCategory);
  const patch = {};
  const fieldMap = {
    recording_duration_ms: "recording_duration_ms",
    upload_latency_ms: "upload_latency_ms",
    transcription_latency_ms: "transcription_latency_ms",
    ai_response_latency_ms: "assistant_response_latency_ms",
    tts_generation_ms: "tts_generation_latency_ms",
    playback_start_ms: "playback_start_latency_ms",
    total_turn_latency_ms: "total_turn_latency_ms",
    audio_bytes: "audio_bytes",
  };

  Object.entries(fieldMap).forEach(([sourceKey, columnName]) => {
    const value = safeInteger(metadata[sourceKey] ?? metadata[sourceKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())]);
    if (value !== null) {
      patch[columnName] = value;
    }
  });

  const audioDuration = safeDurationSeconds(metadata.audio_duration_seconds || metadata.audioDurationSeconds);
  if (audioDuration !== null) {
    patch.audio_duration_seconds = audioDuration;
  }

  if (failureCategory) {
    patch.failure_category = failureCategory;
  }

  if (
    eventName === "web_call_speech_failed" ||
    eventName === "web_call_transcript_rejected" ||
    eventName === "web_call_failed_recovery_shown"
  ) {
    patch.status = "failed";
  } else if (eventName === "web_call_speech_played") {
    patch.status = "completed";
  } else if (Object.keys(patch).length) {
    patch.status = "active";
  }

  return patch;
}

export async function recordWebCallTurnTelemetry(supabase, session, input = {}) {
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata
    : {};
  const turnIndex = safeInteger(metadata.turn_index || metadata.turnIndex || metadata.turn_count || metadata.turnCount, 200);

  if (!supabase || !session?.id || turnIndex === null || turnIndex <= 0) {
    return null;
  }

  const patch = buildTelemetryPatch(metadata, safeText(input.eventName || input.event_name));
  if (!Object.keys(patch).length) {
    return null;
  }

  const now = new Date().toISOString();
  const existing = await maybeSingle(
    supabase
      .from(WEB_CALL_TURN_TELEMETRY_TABLE)
      .select("id")
      .eq("session_id", session.id)
      .eq("turn_index", turnIndex)
      .limit(1)
  );

  if (existing.error) {
    if (isMissingRelationError(existing.error, WEB_CALL_TURN_TELEMETRY_TABLE)) {
      return null;
    }

    throw existing.error;
  }

  if (existing.data?.id) {
    const { data, error } = await maybeSingle(
      supabase
        .from(WEB_CALL_TURN_TELEMETRY_TABLE)
        .update({
          ...patch,
          updated_at: now,
        })
        .eq("id", existing.data.id)
        .select("id")
        .limit(1)
    );

    if (error) {
      if (isMissingRelationError(error, WEB_CALL_TURN_TELEMETRY_TABLE)) {
        return null;
      }

      throw error;
    }

    return data || existing.data;
  }

  const { data, error } = await maybeSingle(
    supabase
      .from(WEB_CALL_TURN_TELEMETRY_TABLE)
      .insert({
        session_id: session.id,
        agent_id: session.agent_id,
        business_id: session.business_id,
        owner_user_id: session.owner_user_id,
        turn_index: turnIndex,
        status: patch.status || "active",
        ...patch,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .limit(1)
  );

  if (error) {
    if (isMissingRelationError(error, WEB_CALL_TURN_TELEMETRY_TABLE)) {
      return null;
    }

    throw error;
  }

  return data || null;
}
