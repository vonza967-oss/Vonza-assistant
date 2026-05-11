import { OWNER_NOTIFICATION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

export const OWNER_NOTIFICATION_STATUSES = ["unread", "read", "dismissed"];

const OWNER_NOTIFICATION_SELECT =
  "id, agent_id, owner_user_id, dedupe_key, type, title, reason, related_action_key, related_follow_up_id, related_knowledge_fix_id, recommended_next_action, status, created_at, updated_at";

function normalizeStatus(value, fallback = "unread") {
  const normalized = cleanText(value).toLowerCase();
  return OWNER_NOTIFICATION_STATUSES.includes(normalized) ? normalized : fallback;
}

function assertValidStatus(value) {
  const status = normalizeStatus(value, "");

  if (!status) {
    const error = new Error(`Invalid owner notification status '${cleanText(value)}'.`);
    error.statusCode = 400;
    throw error;
  }

  return status;
}

function normalizeNotification(row = {}) {
  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agentId || row.agent_id),
    ownerUserId: cleanText(row.ownerUserId || row.owner_user_id),
    dedupeKey: cleanText(row.dedupeKey || row.dedupe_key),
    type: cleanText(row.type),
    title: cleanText(row.title),
    reason: cleanText(row.reason),
    relatedActionKey: cleanText(row.relatedActionKey || row.related_action_key),
    relatedFollowUpId: cleanText(row.relatedFollowUpId || row.related_follow_up_id),
    relatedKnowledgeFixId: cleanText(row.relatedKnowledgeFixId || row.related_knowledge_fix_id),
    recommendedNextAction: cleanText(row.recommendedNextAction || row.recommended_next_action),
    status: normalizeStatus(row.status),
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

function isPersistenceUnavailable(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes(OWNER_NOTIFICATION_TABLE)
  );
}

function getPrimaryReasonKey(item = {}) {
  const reasons = Array.isArray(item.whyItMatters) ? item.whyItMatters : [];
  const keys = new Set(reasons.map((reason) => reason.key));

  if (keys.has("unhappy")) return "unhappy_customer";
  if (keys.has("high_intent")) return "high_intent_lead";
  if (keys.has("not_helpful")) return "not_helpful_ai_reply";
  if (keys.has("repeated_unanswered")) return "repeated_unanswered_question";
  return "";
}

function titleForType(type, item = {}) {
  switch (type) {
    case "high_intent_lead":
      return `High-intent lead: ${item.customerLabel || "customer"}`;
    case "unhappy_customer":
      return `Unhappy customer: ${item.customerLabel || "customer"}`;
    case "not_helpful_ai_reply":
      return "Not-helpful AI reply needs review";
    case "repeated_unanswered_question":
      return "Repeated unanswered question";
    default:
      return "Customer moment needs attention";
  }
}

function buildCandidate(item = {}) {
  const type = getPrimaryReasonKey(item);

  if (!type || ["replied", "dismissed"].includes(item.status)) {
    return null;
  }

  const primaryReason = (Array.isArray(item.whyItMatters) ? item.whyItMatters : [])
    .find((reason) => reason.key === type.replace(/_lead$|_customer$|_ai_reply$|_question$/g, ""));

  return {
    dedupeKey: `${type}:${cleanText(item.itemKey || item.actionKey)}`,
    type,
    title: titleForType(type, item),
    reason: cleanText(primaryReason?.copy || item.safeSummary || item.latestQuestion),
    relatedActionKey: cleanText(item.related?.actionKey || item.actionKey || item.itemKey),
    relatedFollowUpId: cleanText(item.related?.followUpId || item.followUpId),
    relatedKnowledgeFixId: cleanText(item.related?.knowledgeFixId || item.knowledgeFixId),
    recommendedNextAction: cleanText(item.recommendedNextAction),
  };
}

export async function listOwnerNotifications(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  if (!agentId || !ownerUserId) {
    return {
      records: [],
      persistenceAvailable: true,
    };
  }

  const { data, error } = await supabase
    .from(OWNER_NOTIFICATION_TABLE)
    .select(OWNER_NOTIFICATION_SELECT)
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isPersistenceUnavailable(error)) {
      return {
        records: [],
        persistenceAvailable: false,
      };
    }

    throw error;
  }

  return {
    records: (data || []).map(normalizeNotification),
    persistenceAvailable: true,
  };
}

export async function syncOwnerNotifications(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const humanFollowUps = options.humanFollowUps || {};
  const existing = await listOwnerNotifications(supabase, { agentId, ownerUserId });

  if (existing.persistenceAvailable === false) {
    return {
      ...existing,
      summary: { unread: 0, read: 0, dismissed: 0, active: 0, total: 0 },
    };
  }

  const existingByDedupe = new Map(existing.records.map((record) => [record.dedupeKey, record]));
  const candidates = (Array.isArray(humanFollowUps.items) ? humanFollowUps.items : [])
    .map(buildCandidate)
    .filter(Boolean)
    .filter((candidate) => !existingByDedupe.has(candidate.dedupeKey));
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    const { error } = await supabase
      .from(OWNER_NOTIFICATION_TABLE)
      .insert({
        agent_id: agentId,
        owner_user_id: ownerUserId,
        dedupe_key: candidate.dedupeKey,
        type: candidate.type,
        title: candidate.title,
        reason: candidate.reason,
        related_action_key: candidate.relatedActionKey || null,
        related_follow_up_id: candidate.relatedFollowUpId || null,
        related_knowledge_fix_id: candidate.relatedKnowledgeFixId || null,
        recommended_next_action: candidate.recommendedNextAction || null,
        status: "unread",
        created_at: now,
        updated_at: now,
      });

    if (error) {
      if (isPersistenceUnavailable(error)) {
        return {
          records: existing.records,
          persistenceAvailable: false,
          summary: { unread: 0, read: 0, dismissed: 0, active: 0, total: existing.records.length },
        };
      }

      throw error;
    }
  }

  const refreshed = candidates.length
    ? await listOwnerNotifications(supabase, { agentId, ownerUserId })
    : existing;
  const records = refreshed.records;

  return {
    ...refreshed,
    summary: {
      unread: records.filter((record) => record.status === "unread").length,
      read: records.filter((record) => record.status === "read").length,
      dismissed: records.filter((record) => record.status === "dismissed").length,
      active: records.filter((record) => record.status !== "dismissed").length,
      total: records.length,
    },
  };
}

export async function updateOwnerNotificationStatus(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const notificationId = cleanText(options.notificationId);
  const dedupeKey = cleanText(options.dedupeKey);
  const status = assertValidStatus(options.status);

  if (!agentId || !ownerUserId || (!notificationId && !dedupeKey)) {
    const error = new Error("agent_id, owner_user_id, and notification identifier are required.");
    error.statusCode = 400;
    throw error;
  }

  let query = supabase
    .from(OWNER_NOTIFICATION_TABLE)
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId);

  query = notificationId ? query.eq("id", notificationId) : query.eq("dedupe_key", dedupeKey);

  const { data, error } = await query
    .select(OWNER_NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) {
    if (isPersistenceUnavailable(error)) {
      const unavailable = new Error("Owner notifications are not ready on this workspace yet.");
      unavailable.statusCode = 503;
      unavailable.code = "owner_notifications_unavailable";
      throw unavailable;
    }

    throw error;
  }

  if (!data) {
    const notFound = new Error("Owner notification was not found for this owner.");
    notFound.statusCode = 404;
    throw notFound;
  }

  return {
    ok: true,
    notification: normalizeNotification(data),
  };
}
