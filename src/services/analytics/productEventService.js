import { cleanText } from "../../utils/text.js";

const PRODUCT_EVENTS_TABLE = "product_events";

export const TRACKED_PRODUCT_EVENTS = [
  "dashboard_arrived",
  "onboarding_started",
  "assistant_created",
  "knowledge_imported",
  "knowledge_limited",
  "preview_opened",
  "starter_prompt_used",
  "install_code_copied",
  "install_instructions_copied",
  "added_to_site_confirmed",
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
    error?.code === "42P01" ||
    message.includes(`'public.${relationName}'`) ||
    message.includes(`${relationName} was not found`)
  );
}

function getActorKey(row) {
  const clientId = cleanText(row?.client_id);
  const agentId = cleanText(row?.agent_id);
  const rowId = cleanText(row?.id);
  return clientId || (agentId ? `agent:${agentId}` : `event:${rowId}`);
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
    event_name: eventName,
    source: cleanText(input.source) || null,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(PRODUCT_EVENTS_TABLE).insert(payload);

  if (error) {
    if (isMissingRelationError(error, PRODUCT_EVENTS_TABLE)) {
      return { ok: false, skipped: true };
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
