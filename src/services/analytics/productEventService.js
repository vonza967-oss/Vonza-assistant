import { cleanText } from "../../utils/text.js";

const PRODUCT_EVENTS_TABLE = "product_events";

const SAFE_METADATA_KEY_ALLOWLIST = new Set([
  "transcription_latency_ms",
]);

export const WEB_CALL_PRODUCT_EVENTS = [
  "web_call_started",
  "web_call_mic_denied",
  "web_call_transcript_ready",
  "web_call_transcript_rejected",
  "web_call_turn_sent",
  "web_call_reply_ready",
  "web_call_speech_played",
  "web_call_speech_failed",
  "web_call_contact_opened",
  "web_call_contact_submitted",
  "web_call_ended",
  "web_call_max_turns_reached",
  "web_call_failed_recovery_shown",
  "web_call_realtime_connected",
  "web_call_realtime_first_audio",
  "web_call_realtime_interrupted",
  "web_call_realtime_reconnecting",
  "web_call_realtime_fallback",
  "web_call_realtime_failed",
];

const SAFE_WEB_CALL_FAILURE_CATEGORIES = new Set([
  "ai_capacity_reached",
  "audio_too_large",
  "browser_unsupported",
  "empty_transcript",
  "garbled_transcript",
  "https_required",
  "inactive_access",
  "microphone_unavailable",
  "mic_denied",
  "no_audio",
  "rate_limited",
  "recording_failed",
  "repeat_requested",
  "request_failed",
  "speech_authorization_missing",
  "speech_failed",
  "speech_not_attempted",
  "transcript_rejected",
  "transcription_failed",
  "unknown",
  "voice_unavailable",
  "autoplay_blocked",
  "network_failed",
  "openai_realtime_unavailable",
  "realtime_connect_failed",
  "realtime_token_failed",
  "webrtc_unsupported",
]);

const WEB_CALL_FAILURE_LABELS = Object.freeze({
  ai_capacity_reached: "AI capacity reached",
  audio_too_large: "Audio too large",
  browser_unsupported: "Browser unsupported",
  empty_transcript: "Empty transcript",
  garbled_transcript: "Garbled transcript",
  https_required: "HTTPS required",
  inactive_access: "Inactive access",
  microphone_unavailable: "Microphone unavailable",
  mic_denied: "Microphone denied",
  no_audio: "No audio",
  rate_limited: "Rate limited",
  recording_failed: "Recording failed",
  repeat_requested: "Repeat requested",
  request_failed: "Request failed",
  speech_authorization_missing: "Speech authorization missing",
  speech_failed: "Speech playback failed",
  speech_not_attempted: "Speech not attempted",
  transcript_rejected: "Transcript rejected",
  transcription_failed: "Transcription failed",
  unknown: "Unknown safe category",
  voice_unavailable: "Voice unavailable",
  autoplay_blocked: "Autoplay blocked",
  network_failed: "Network failed",
  openai_realtime_unavailable: "Realtime unavailable",
  realtime_connect_failed: "Realtime connection failed",
  realtime_token_failed: "Realtime token failed",
  webrtc_unsupported: "WebRTC unsupported",
});

export const TRACKED_PRODUCT_EVENTS = [
  "dashboard_arrived",
  "onboarding_started",
  "onboarding_completed",
  "assistant_created",
  "knowledge_imported",
  "knowledge_limited",
  "preview_opened",
  "starter_prompt_used",
  "install_code_copied",
  "install_instructions_copied",
  "added_to_site_confirmed",
  "install_verification_success",
  "first_widget_chat",
  "first_lead_captured",
  "first_helpful_feedback",
  "first_not_helpful_feedback",
  "voice_transcription_completed",
  "voice_speech_generated",
  ...WEB_CALL_PRODUCT_EVENTS,
  "first_follow_up_completed",
  "first_knowledge_fix_approved",
  "notification_read",
  "notification_dismissed",
  "data_exported",
  "data_deleted",
  "privacy_retention_saved",
];

const FUNNEL_STAGES = [
  { key: "dashboard_arrived", label: "Dashboard arrived", events: ["dashboard_arrived"] },
  { key: "onboarding_started", label: "Onboarding started", events: ["onboarding_started"] },
  { key: "assistant_created", label: "Assistant created", events: ["assistant_created"] },
  { key: "knowledge_captured", label: "Knowledge imported or limited", events: ["knowledge_imported", "knowledge_limited"] },
  { key: "preview_opened", label: "Preview opened", events: ["preview_opened"] },
  { key: "install_code_copied", label: "Install code copied", events: ["install_code_copied"] },
  { key: "added_to_site_confirmed", label: "Added to site confirmed", events: ["added_to_site_confirmed"] },
];

const MAX_EVENT_SOURCE_LENGTH = 80;
const MAX_DEDUPE_KEY_LENGTH = 180;

function normalizeEventSource(value) {
  const source = cleanText(value);
  return source.length > MAX_EVENT_SOURCE_LENGTH ? source.slice(0, MAX_EVENT_SOURCE_LENGTH) : source;
}

function buildDefaultDedupeKey({
  clientId,
  agentId,
  ownerUserId,
  eventName,
  source,
} = {}) {
  const actor = cleanText(ownerUserId) || cleanText(agentId) || cleanText(clientId);
  const pieces = [
    actor,
    cleanText(eventName),
    cleanText(source) || "unknown",
  ].filter(Boolean);

  return pieces.join("::").slice(0, MAX_DEDUPE_KEY_LENGTH);
}

function isMissingRelationError(error, relationName) {
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

function isMissingWebCallSessionColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("web_call_session_id")
  );
}

function getActorKey(row) {
  const clientId = cleanText(row?.client_id);
  const ownerUserId = cleanText(row?.owner_user_id);
  const agentId = cleanText(row?.agent_id);
  const rowId = cleanText(row?.id);
  return ownerUserId || clientId || (agentId ? `agent:${agentId}` : `event:${rowId}`);
}

function readSafeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function readTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function averageRounded(values = []) {
  const numbers = values
    .map((value) => readSafeNumber(value))
    .filter((value) => value !== null);

  if (!numbers.length) {
    return 0;
  }

  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return Number(average.toFixed(1));
}

function normalizeWebCallFailureCategory(value, eventName = "") {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");

  if (SAFE_WEB_CALL_FAILURE_CATEGORIES.has(normalized)) {
    return normalized;
  }

  switch (cleanText(eventName)) {
    case "web_call_mic_denied":
      return "mic_denied";
    case "web_call_transcript_rejected":
      return "transcript_rejected";
    case "web_call_speech_failed":
      return "speech_failed";
    default:
      return "unknown";
  }
}

function getWebCallId(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {};
  return cleanText(metadata.web_call_id || metadata.webCallId) || cleanText(row.id);
}

function isWebCallFailureEvent(eventName = "") {
  return [
    "web_call_mic_denied",
    "web_call_transcript_rejected",
    "web_call_speech_failed",
    "web_call_failed_recovery_shown",
    "web_call_realtime_fallback",
    "web_call_realtime_failed",
  ].includes(cleanText(eventName));
}

function getFailureCategoryRows(failureCounts = {}) {
  return Object.entries(failureCounts)
    .map(([category, count]) => ({
      category,
      label: WEB_CALL_FAILURE_LABELS[category] || WEB_CALL_FAILURE_LABELS.unknown,
      count,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function createEmptyWebCallHealthSummary() {
  return {
    available: true,
    starts: 0,
    endedCalls: 0,
    averageDurationSeconds: 0,
    averageTurns: 0,
    contactFallbackSubmissions: 0,
    failureCounts: {},
    failureCategories: [],
    failureTotal: 0,
    latestActivityAt: null,
  };
}

export function buildWebCallHealthSummary(rows = []) {
  const summary = createEmptyWebCallHealthSummary();
  const calls = new Map();
  const endedDurations = [];
  const endedTurns = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const eventName = cleanText(row?.event_name);
    const metadata = row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
    const createdAt = row?.created_at || row?.createdAt || null;
    const callId = getWebCallId(row);

    if (!WEB_CALL_PRODUCT_EVENTS.includes(eventName)) {
      return;
    }

    if (readTimestamp(createdAt) > readTimestamp(summary.latestActivityAt)) {
      summary.latestActivityAt = createdAt;
    }

    if (!calls.has(callId)) {
      calls.set(callId, {
        started: false,
        ended: false,
        contactSubmitted: false,
      });
    }

    const call = calls.get(callId);

    if (eventName === "web_call_started") {
      summary.starts += 1;
      call.started = true;
    }

    if (eventName === "web_call_ended") {
      summary.endedCalls += 1;
      call.ended = true;
      endedDurations.push(metadata.duration_seconds);
      endedTurns.push(metadata.turn_count);
    }

    if (eventName === "web_call_contact_submitted") {
      summary.contactFallbackSubmissions += 1;
      call.contactSubmitted = true;
    }

    if (isWebCallFailureEvent(eventName)) {
      const category = normalizeWebCallFailureCategory(metadata.failure_category, eventName);
      summary.failureCounts[category] = Number(summary.failureCounts[category] || 0) + 1;
      summary.failureTotal += 1;
    }
  });

  summary.averageDurationSeconds = averageRounded(endedDurations);
  summary.averageTurns = averageRounded(endedTurns);
  summary.failureCategories = getFailureCategoryRows(summary.failureCounts);

  return summary;
}

function shouldDropMetadataKey(key = "") {
  const normalized = cleanText(key).toLowerCase();
  if (SAFE_METADATA_KEY_ALLOWLIST.has(normalized)) {
    return false;
  }

  return [
    "email",
    "phone",
    "name",
    "contact",
    "transcript",
    "reply",
    "answer",
    "assistant",
    "message",
    "content",
    "secret",
    "token",
    "api_key",
    "password",
    "authorization",
    "cookie",
    "session_key",
    "visitor_email",
    "visitor_name",
  ].some((term) => normalized.includes(term));
}

function isSafeMetadataKey(key = "") {
  const normalized = cleanText(key);
  return Boolean(normalized)
    && normalized.length <= 64
    && /^[a-zA-Z0-9_.-]+$/.test(normalized)
    && !shouldDropMetadataKey(normalized);
}

function normalizeMetadataValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > 160) {
    return `${normalized.slice(0, 157).trimEnd()}...`;
  }

  return normalized;
}

export function sanitizeProductEventMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const entries = Object.entries(metadata)
    .filter(([key]) => isSafeMetadataKey(key))
    .slice(0, 30)
    .map(([key, value]) => [key, normalizeMetadataValue(value)])
    .filter(([, value]) => value !== null);

  return entries.length ? Object.fromEntries(entries) : null;
}

export async function trackProductEvent(supabase, input = {}) {
  const clientId = cleanText(input.clientId);
  const eventName = cleanText(input.eventName);
  const agentId = cleanText(input.agentId);
  const ownerUserId = cleanText(input.ownerUserId);
  const source = normalizeEventSource(input.source);
  const webCallSessionId = cleanText(input.webCallSessionId || input.web_call_session_id);

  if (!clientId) {
    const error = new Error("client_id is required");
    error.statusCode = 400;
    throw error;
  }

  if (!TRACKED_PRODUCT_EVENTS.includes(eventName)) {
    const error = new Error("Unsupported event_name");
    error.statusCode = 400;
    throw error;
  }

  const dedupeKey = cleanText(input.dedupeKey) || buildDefaultDedupeKey({
    clientId,
    agentId,
    ownerUserId,
    eventName,
    source,
  });

  const payload = {
    client_id: clientId,
    agent_id: agentId || null,
    owner_user_id: ownerUserId || null,
    web_call_session_id: webCallSessionId || null,
    event_name: eventName,
    source: source || null,
    metadata: sanitizeProductEventMetadata(input.metadata),
    dedupe_key: dedupeKey ? dedupeKey.slice(0, MAX_DEDUPE_KEY_LENGTH) : null,
    created_at: new Date().toISOString(),
  };

  let { error } = await supabase.from(PRODUCT_EVENTS_TABLE).insert(payload);

  if (error && isMissingWebCallSessionColumnError(error)) {
    const { web_call_session_id: _webCallSessionId, ...fallbackPayload } = payload;
    ({ error } = await supabase.from(PRODUCT_EVENTS_TABLE).insert(fallbackPayload));
  }

  if (error) {
    if (isMissingRelationError(error, PRODUCT_EVENTS_TABLE)) {
      return { ok: false, skipped: true };
    }

    if (error?.code === "23505") {
      return { ok: true, duplicate: true };
    }

    console.error(error);
    throw error;
  }

  return { ok: true };
}

export async function getProductFunnelSummary(supabase, options = {}) {
  const days = Number(options.days || 7);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(PRODUCT_EVENTS_TABLE)
    .select("id, client_id, agent_id, event_name, created_at")
    .gte("created_at", since)
    .in(
      "event_name",
      FUNNEL_STAGES.flatMap((stage) => stage.events)
    );

  if (error) {
    if (isMissingRelationError(error, PRODUCT_EVENTS_TABLE)) {
      return {
        windowDays: days,
        stages: FUNNEL_STAGES.map((stage, index) => ({
          key: stage.key,
          label: stage.label,
          count: 0,
          percentFromPrevious: index === 0 ? 100 : 0,
        })),
        breakdown: {
          knowledge_imported: 0,
          knowledge_limited: 0,
        },
      };
    }

    console.error(error);
    throw error;
  }

  const rows = data || [];
  const breakdown = {
    knowledge_imported: new Set(),
    knowledge_limited: new Set(),
  };

  rows.forEach((row) => {
    if (row.event_name === "knowledge_imported") {
      breakdown.knowledge_imported.add(getActorKey(row));
    }
    if (row.event_name === "knowledge_limited") {
      breakdown.knowledge_limited.add(getActorKey(row));
    }
  });

  let previousCount = 0;
  const stages = FUNNEL_STAGES.map((stage, index) => {
    const actors = new Set();

    rows.forEach((row) => {
      if (stage.events.includes(row.event_name)) {
        actors.add(getActorKey(row));
      }
    });

    const count = actors.size;
    const percentFromPrevious =
      index === 0 ? 100 : previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;

    previousCount = count;

    return {
      key: stage.key,
      label: stage.label,
      count,
      percentFromPrevious,
    };
  });

  return {
    windowDays: days,
    stages,
    breakdown: {
      knowledge_imported: breakdown.knowledge_imported.size,
      knowledge_limited: breakdown.knowledge_limited.size,
    },
  };
}

export async function listWebCallHealthEvents(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const limit = Math.min(Math.max(Number(options.limit || 1000), 1), 5000);

  if (!agentId || !ownerUserId) {
    return {
      records: [],
      summary: {
        ...createEmptyWebCallHealthSummary(),
        available: false,
      },
      persistenceAvailable: false,
    };
  }

  const { data, error } = await supabase
    .from(PRODUCT_EVENTS_TABLE)
    .select("id, agent_id, owner_user_id, event_name, metadata, created_at")
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .in("event_name", WEB_CALL_PRODUCT_EVENTS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error, PRODUCT_EVENTS_TABLE)) {
      return {
        records: [],
        summary: {
          ...createEmptyWebCallHealthSummary(),
          available: false,
        },
        persistenceAvailable: false,
      };
    }

    console.error(error);
    throw error;
  }

  const records = Array.isArray(data) ? data : [];

  return {
    records,
    summary: buildWebCallHealthSummary(records),
    persistenceAvailable: true,
  };
}
