import { HUMAN_FOLLOW_UP_STATUS_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

export const HUMAN_FOLLOW_UP_STATUSES = [
  "new",
  "reviewing",
  "replied",
  "follow_up_later",
  "dismissed",
];

const TERMINAL_STATUSES = new Set(["replied", "dismissed"]);
const HIGH_INTENT_ACTION_TYPES = new Set([
  "lead_follow_up",
  "pricing_interest",
  "booking_intent",
  "repeat_high_intent_visitor",
]);
const KNOWLEDGE_ACTION_TYPES = new Set(["knowledge_gap", "unanswered_question"]);
const HUMAN_FOLLOW_UP_SELECT =
  "id, agent_id, owner_user_id, item_key, action_key, follow_up_id, knowledge_fix_id, status, note, owner_reply, follow_up_at, created_at, updated_at";

function normalizeStatus(value, fallback = "new") {
  const normalized = cleanText(value).toLowerCase();
  return HUMAN_FOLLOW_UP_STATUSES.includes(normalized) ? normalized : fallback;
}

function assertValidStatus(value) {
  const normalized = normalizeStatus(value, "");

  if (!normalized) {
    const error = new Error(`Invalid human follow-up status '${cleanText(value)}'.`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizeRow(row = {}) {
  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agentId || row.agent_id),
    ownerUserId: cleanText(row.ownerUserId || row.owner_user_id),
    itemKey: cleanText(row.itemKey || row.item_key),
    actionKey: cleanText(row.actionKey || row.action_key),
    followUpId: cleanText(row.followUpId || row.follow_up_id),
    knowledgeFixId: cleanText(row.knowledgeFixId || row.knowledge_fix_id),
    status: normalizeStatus(row.status),
    note: cleanText(row.note),
    ownerReply: cleanText(row.ownerReply || row.owner_reply),
    followUpAt: row.followUpAt || row.follow_up_at || null,
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

function buildUnavailableError() {
  const error = new Error(
    "Human follow-up workflow persistence is not ready. Apply the customer value and trust migration and try again."
  );
  error.statusCode = 503;
  error.code = "human_follow_up_persistence_unavailable";
  return error;
}

function isPersistenceUnavailable(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes(HUMAN_FOLLOW_UP_STATUS_TABLE)
  );
}

function truncateText(value, maxLength = 220) {
  const normalized = cleanText(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function hasUnhappySignal(item = {}) {
  const text = cleanText([
    item.intent,
    item.type,
    item.label,
    item.question,
    item.snippet,
    item.whyFlagged,
    item.reply,
  ].join(" ")).toLowerCase();

  return (
    item.intent === "support" ||
    /\b(unhappy|frustrated|angry|upset|complaint|refund|broken|not working|issue|problem|late|delayed|wrong|damaged|lost)\b/i.test(text)
  );
}

function getIdentityLabel(item = {}) {
  const contact = item.contactInfo && typeof item.contactInfo === "object" ? item.contactInfo : {};
  const person = item.person && typeof item.person === "object" ? item.person : {};

  return cleanText(
    person.label ||
    contact.name ||
    contact.email ||
    contact.phone ||
    item.followUp?.contactName ||
    item.followUp?.contactEmail ||
    item.followUp?.contactPhone
  ) || (
    cleanText(item.sessionKey)
      ? `Guest session ${cleanText(item.sessionKey).slice(0, 8)}`
      : "Guest visitor"
  );
}

function getLatestQuestion(item = {}) {
  return truncateText(item.question || item.snippet || item.knowledgeFix?.evidence?.question || "");
}

function getStatusFromSources(item = {}, persisted = null) {
  if (persisted?.status) {
    return persisted.status;
  }

  const followUpStatus = cleanText(item.followUp?.status).toLowerCase();
  const knowledgeFixStatus = cleanText(item.knowledgeFix?.status).toLowerCase();
  const queueStatus = cleanText(item.status).toLowerCase();

  if (followUpStatus === "sent" || queueStatus === "done" || knowledgeFixStatus === "applied") {
    return "replied";
  }

  if (followUpStatus === "dismissed" || knowledgeFixStatus === "dismissed" || queueStatus === "dismissed") {
    return "dismissed";
  }

  if (queueStatus === "reviewed" || followUpStatus === "ready") {
    return "reviewing";
  }

  return "new";
}

function buildWhyItMatters(item = {}) {
  const actionType = cleanText(item.actionType || item.type);
  const reasons = [];
  const followUpStatus = cleanText(item.followUp?.status).toLowerCase();
  const occurrenceCount = Math.max(Number(item.knowledgeFix?.occurrenceCount || item.count || 1), 1);

  if (HIGH_INTENT_ACTION_TYPES.has(actionType)) {
    reasons.push({
      key: "high_intent",
      label: "High intent",
      copy: "This customer is close to a quote, booking, purchase, or direct contact step.",
    });
  }

  if (hasUnhappySignal(item)) {
    reasons.push({
      key: "unhappy",
      label: "Unhappy or frustrated",
      copy: "The conversation looks like a service issue that should get a human response.",
    });
  }

  if (item.weakAnswer === true || actionType === "knowledge_gap" || cleanText(item.knowledgeFix?.id)) {
    reasons.push({
      key: "not_helpful",
      label: "Not-helpful reply",
      copy: "The AI answer looked weak, uncertain, or was marked not helpful.",
    });
  }

  if (actionType === "unanswered_question" || occurrenceCount > 1) {
    reasons.push({
      key: "repeated_unanswered",
      label: occurrenceCount > 1 ? "Repeated unanswered question" : "Unanswered question",
      copy: occurrenceCount > 1
        ? "A similar question has appeared more than once without a strong answer."
        : "The customer did not get a complete answer from the AI.",
    });
  }

  if (followUpStatus === "missing_contact" || item.contactCaptured === false) {
    reasons.push({
      key: "missing_contact_details",
      label: "Missing contact details",
      copy: "Vonza has the context, but the owner may still need an email or phone number.",
    });
  }

  if (item.followUp?.id && !["sent", "dismissed"].includes(followUpStatus)) {
    reasons.push({
      key: "follow_up_due",
      label: "Follow-up due",
      copy: "A prepared follow-up exists and is still waiting for owner action.",
    });
  }

  return reasons.length
    ? reasons
    : [{
      key: "follow_up_due",
      label: "Needs human review",
      copy: "This customer signal still needs an owner decision.",
    }];
}

function getRecommendedNextAction(item = {}, reasons = []) {
  const reasonKeys = new Set(reasons.map((reason) => reason.key));

  if (reasonKeys.has("not_helpful") || reasonKeys.has("repeated_unanswered")) {
    return cleanText(item.knowledgeFix?.id)
      ? "Improve knowledge, then reply with the corrected answer if the customer can be reached."
      : "Review the weak answer and add better knowledge before similar customers ask again.";
  }

  if (reasonKeys.has("missing_contact_details")) {
    return "Review the conversation and ask for the best email or phone before outreach.";
  }

  if (reasonKeys.has("unhappy")) {
    return "Acknowledge the issue, decide the recovery step, and mark this replied after the owner responds.";
  }

  if (cleanText(item.followUp?.draftContent)) {
    return "Review the prepared draft, edit it if needed, send it outside Vonza, then mark replied.";
  }

  return cleanText(item.suggestedAction) || "Review the conversation and choose the clearest owner reply.";
}

function getPriorityScore(item = {}, reasons = [], status = "new") {
  if (TERMINAL_STATUSES.has(status)) {
    return 1000;
  }

  const reasonKeys = new Set(reasons.map((reason) => reason.key));
  let score = 50;

  if (reasonKeys.has("unhappy")) score -= 30;
  if (reasonKeys.has("high_intent")) score -= 20;
  if (reasonKeys.has("not_helpful")) score -= 12;
  if (reasonKeys.has("repeated_unanswered")) score -= 8;
  if (reasonKeys.has("follow_up_due")) score -= 6;
  if (reasonKeys.has("missing_contact_details")) score += 5;
  if (status === "follow_up_later") score += 15;
  if (status === "reviewing") score += 3;
  if (item.priority === "high") score -= 8;

  return score;
}

function shouldIncludeItem(item = {}) {
  const actionType = cleanText(item.actionType || item.type);

  return (
    HIGH_INTENT_ACTION_TYPES.has(actionType) ||
    KNOWLEDGE_ACTION_TYPES.has(actionType) ||
    item.ownerWorkflow?.attention === true ||
    Boolean(item.followUp?.id) ||
    Boolean(item.knowledgeFix?.id) ||
    hasUnhappySignal(item)
  );
}

function buildItem(item = {}, persisted = null, index = 0) {
  const itemKey = cleanText(item.key || `item-${index}`);
  const reasons = buildWhyItMatters(item);
  const status = getStatusFromSources(item, persisted);
  const priorityScore = getPriorityScore(item, reasons, status);
  const latestQuestion = getLatestQuestion(item);

  return {
    id: persisted?.id || itemKey,
    itemKey,
    actionKey: itemKey,
    followUpId: cleanText(item.followUp?.id),
    knowledgeFixId: cleanText(item.knowledgeFix?.id),
    customerLabel: getIdentityLabel(item),
    latestQuestion: latestQuestion || "No customer question text is stored for this item yet.",
    safeSummary: truncateText(item.snippet || item.whyFlagged || latestQuestion || "Customer context is sparse."),
    whyItMatters: reasons,
    suggestedReplyDraft: cleanText(persisted?.ownerReply || item.followUp?.draftContent),
    recommendedNextAction: getRecommendedNextAction(item, reasons),
    status,
    note: persisted?.note || "",
    followUpAt: persisted?.followUpAt || null,
    priorityScore,
    priority: priorityScore <= 20 ? "high" : priorityScore <= 45 ? "medium" : "low",
    related: {
      actionKey: itemKey,
      messageId: cleanText(item.messageId),
      followUpId: cleanText(item.followUp?.id),
      knowledgeFixId: cleanText(item.knowledgeFix?.id),
      contactId: cleanText(item.contactId || item.followUp?.contactId || item.knowledgeFix?.contactId),
    },
    source: {
      actionType: cleanText(item.actionType || item.type),
      label: cleanText(item.label),
      lastSeenAt: item.lastSeenAt || null,
    },
  };
}

export async function listHumanFollowUpStatusRows(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  if (!agentId || !ownerUserId) {
    return {
      records: [],
      persistenceAvailable: true,
    };
  }

  const { data, error } = await supabase
    .from(HUMAN_FOLLOW_UP_STATUS_TABLE)
    .select(HUMAN_FOLLOW_UP_SELECT)
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
    records: (data || []).map(normalizeRow),
    persistenceAvailable: true,
  };
}

export function buildHumanFollowUpWorkflow(actionQueue = {}, statusRows = [], options = {}) {
  const persistedByItemKey = new Map(
    statusRows
      .map((row) => normalizeRow(row))
      .filter((row) => row.itemKey)
      .map((row) => [row.itemKey, row])
  );
  const items = (Array.isArray(actionQueue.items) ? actionQueue.items : [])
    .filter(shouldIncludeItem)
    .map((item, index) => buildItem(item, persistedByItemKey.get(cleanText(item.key)), index))
    .filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.itemKey === item.itemKey) === index)
    .sort((left, right) => {
      if (left.priorityScore !== right.priorityScore) {
        return left.priorityScore - right.priorityScore;
      }

      return String(right.source.lastSeenAt || "").localeCompare(String(left.source.lastSeenAt || ""));
    });
  const openItems = items.filter((item) => !TERMINAL_STATUSES.has(item.status));
  const summary = HUMAN_FOLLOW_UP_STATUSES.reduce((memo, status) => ({
    ...memo,
    [status]: items.filter((item) => item.status === status).length,
  }), {});

  return {
    ok: true,
    available: options.persistenceAvailable !== false,
    migrationRequired: options.persistenceAvailable === false,
    summary: {
      total: items.length,
      open: openItems.length,
      highPriority: openItems.filter((item) => item.priority === "high").length,
      ...summary,
    },
    items,
    topItems: openItems.slice(0, 3),
    emptyState: items.length
      ? ""
      : "No customers need a human reply right now. High-intent leads, unhappy customers, not-helpful replies, repeated unanswered questions, and due follow-ups will appear here.",
  };
}

export async function updateHumanFollowUpStatus(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const itemKey = cleanText(options.itemKey || options.actionKey);
  const status = assertValidStatus(options.status);
  const now = new Date().toISOString();

  if (!agentId || !ownerUserId || !itemKey) {
    const error = new Error("agent_id, owner_user_id, and item_key are required.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    agent_id: agentId,
    owner_user_id: ownerUserId,
    item_key: itemKey,
    action_key: cleanText(options.actionKey) || itemKey,
    follow_up_id: cleanText(options.followUpId) || null,
    knowledge_fix_id: cleanText(options.knowledgeFixId) || null,
    status,
    note: cleanText(options.note) || null,
    owner_reply: cleanText(options.ownerReply) || null,
    follow_up_at: options.followUpAt || null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(HUMAN_FOLLOW_UP_STATUS_TABLE)
    .upsert(payload, { onConflict: "agent_id,owner_user_id,item_key" })
    .select(HUMAN_FOLLOW_UP_SELECT)
    .single();

  if (error) {
    if (isPersistenceUnavailable(error)) {
      throw buildUnavailableError();
    }

    throw error;
  }

  return {
    ok: true,
    item: normalizeRow(data || payload),
    persistenceAvailable: true,
  };
}
