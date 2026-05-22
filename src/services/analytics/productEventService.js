import { cleanText } from "../../utils/text.js";

const PRODUCT_EVENTS_TABLE = "product_events";

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

function getActorKey(row) {
  const clientId = cleanText(row?.client_id);
  const ownerUserId = cleanText(row?.owner_user_id);
  const agentId = cleanText(row?.agent_id);
  const rowId = cleanText(row?.id);
  return ownerUserId || clientId || (agentId ? `agent:${agentId}` : `event:${rowId}`);
}

function shouldDropMetadataKey(key = "") {
  const normalized = cleanText(key).toLowerCase();
  return [
    "email",
    "phone",
    "name",
    "contact",
    "message",
    "content",
    "secret",
    "token",
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
    .slice(0, 20)
    .map(([key, value]) => [key, normalizeMetadataValue(value)])
    .filter(([, value]) => value !== null);

  return entries.length ? Object.fromEntries(entries) : null;
}

export async function trackProductEvent(supabase, input = {}) {
  const clientId = cleanText(input.clientId);
  const eventName = cleanText(input.eventName);

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

  const payload = {
    client_id: clientId,
    agent_id: cleanText(input.agentId) || null,
    owner_user_id: cleanText(input.ownerUserId) || null,
    event_name: eventName,
    source: cleanText(input.source) || null,
    metadata: sanitizeProductEventMetadata(input.metadata),
    dedupe_key: cleanText(input.dedupeKey) || null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(PRODUCT_EVENTS_TABLE).insert(payload);

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
