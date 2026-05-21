import { FRONT_DESK_TRAINING_ITEMS_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const TRAINING_TYPES = ["approved_answer", "correction", "business_fact"];
const SOURCE_TYPES = ["manual", "conversation", "website", "test"];
const STATUSES = ["active", "draft", "archived"];

function isMissingTrainingTableError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(`'public.${FRONT_DESK_TRAINING_ITEMS_TABLE}'`) ||
    message.includes(`${FRONT_DESK_TRAINING_ITEMS_TABLE} was not found`)
  );
}

function normalizeTags(value) {
  const rawTags = Array.isArray(value)
    ? value
    : cleanText(value).split(/,|\n/);

  return [...new Set(
    rawTags
      .map((tag) => cleanText(tag).toLowerCase())
      .filter(Boolean)
      .slice(0, 12)
  )];
}

function normalizeStatus(value, fallback = "active") {
  const normalized = cleanText(value).toLowerCase();
  return STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeType(value, fallback = "approved_answer") {
  const normalized = cleanText(value).toLowerCase();
  return TRAINING_TYPES.includes(normalized) ? normalized : fallback;
}

function normalizeSourceType(value, fallback = "manual") {
  const normalized = cleanText(value).toLowerCase();
  return SOURCE_TYPES.includes(normalized) ? normalized : fallback;
}

function mapTrainingItem(row = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    agentId: row.agent_id,
    type: row.type,
    title: row.title || "",
    triggerText: row.trigger_text || "",
    answerText: row.answer_text || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    sourceType: row.source_type || "manual",
    sourceMessageId: row.source_message_id || "",
    status: row.status || "active",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function buildTrainingTableUnavailableResult() {
  return {
    items: [],
    persistenceAvailable: false,
    migrationRequired: true,
  };
}

export async function listFrontDeskTrainingItems(supabase, {
  agentId,
  ownerUserId,
  type = "",
  status = "",
} = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    return {
      items: [],
      persistenceAvailable: true,
      migrationRequired: false,
    };
  }

  let query = supabase
    .from(FRONT_DESK_TRAINING_ITEMS_TABLE)
    .select("id, owner_id, agent_id, type, title, trigger_text, answer_text, tags, source_type, source_message_id, status, created_at, updated_at")
    .eq("agent_id", normalizedAgentId)
    .eq("owner_id", normalizedOwnerUserId)
    .order("updated_at", { ascending: false });

  if (cleanText(type)) {
    query = query.eq("type", normalizeType(type));
  }

  if (cleanText(status)) {
    query = query.eq("status", normalizeStatus(status));
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTrainingTableError(error)) {
      return buildTrainingTableUnavailableResult();
    }

    throw error;
  }

  return {
    items: (data || []).map(mapTrainingItem),
    persistenceAvailable: true,
    migrationRequired: false,
  };
}

export async function saveFrontDeskTrainingItem(supabase, {
  agentId,
  ownerUserId,
  itemId = "",
  type = "approved_answer",
  title = "",
  triggerText = "",
  answerText = "",
  tags = [],
  sourceType = "manual",
  sourceMessageId = "",
  status = "active",
} = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const normalizedAnswer = cleanText(answerText);
  const normalizedTrigger = cleanText(triggerText || title);
  const normalizedTitle = cleanText(title || triggerText).slice(0, 180);

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    const error = new Error("agent_id and owner context are required.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedTrigger || !normalizedAnswer) {
    const error = new Error("Add the question or situation and the approved answer.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    owner_id: normalizedOwnerUserId,
    agent_id: normalizedAgentId,
    type: normalizeType(type),
    title: normalizedTitle || normalizedTrigger.slice(0, 180),
    trigger_text: normalizedTrigger.slice(0, 1200),
    answer_text: normalizedAnswer.slice(0, 5000),
    tags: normalizeTags(tags),
    source_type: normalizeSourceType(sourceType),
    source_message_id: cleanText(sourceMessageId) || null,
    status: normalizeStatus(status),
    updated_at: new Date().toISOString(),
  };

  let query;
  if (cleanText(itemId)) {
    query = supabase
      .from(FRONT_DESK_TRAINING_ITEMS_TABLE)
      .update(payload)
      .eq("id", cleanText(itemId))
      .eq("agent_id", normalizedAgentId)
      .eq("owner_id", normalizedOwnerUserId);
  } else {
    query = supabase
      .from(FRONT_DESK_TRAINING_ITEMS_TABLE)
      .insert({
        ...payload,
        created_at: payload.updated_at,
      });
  }

  const { data, error } = await query
    .select("id, owner_id, agent_id, type, title, trigger_text, answer_text, tags, source_type, source_message_id, status, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTrainingTableError(error)) {
      const missing = new Error("Front Desk training storage is not available until the latest migration is applied.");
      missing.statusCode = 409;
      throw missing;
    }

    throw error;
  }

  return {
    ok: true,
    item: mapTrainingItem(data),
  };
}

export async function updateFrontDeskTrainingItemStatus(supabase, {
  agentId,
  ownerUserId,
  itemId,
  status,
} = {}) {
  const normalizedStatus = normalizeStatus(status, "");
  if (!normalizedStatus) {
    const error = new Error("Enter a valid training item status.");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(FRONT_DESK_TRAINING_ITEMS_TABLE)
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleanText(itemId))
    .eq("agent_id", cleanText(agentId))
    .eq("owner_id", cleanText(ownerUserId))
    .select("id, owner_id, agent_id, type, title, trigger_text, answer_text, tags, source_type, source_message_id, status, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTrainingTableError(error)) {
      const missing = new Error("Front Desk training storage is not available until the latest migration is applied.");
      missing.statusCode = 409;
      throw missing;
    }

    throw error;
  }

  return {
    ok: true,
    item: mapTrainingItem(data),
  };
}

function tokenize(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9áéíóöőúüű]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreApprovedAnswer(item = {}, queryText = "") {
  const queryTokens = new Set(tokenize(queryText));
  if (!queryTokens.size) {
    return 0;
  }

  const trigger = cleanText(item.triggerText || item.trigger_text || item.title);
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const triggerText = `${trigger} ${tags.join(" ")}`;
  const itemTokens = new Set(tokenize(triggerText));
  let score = 0;

  queryTokens.forEach((token) => {
    if (itemTokens.has(token)) {
      score += 2;
    }
    if (trigger.toLowerCase().includes(token)) {
      score += 1;
    }
  });

  if (trigger && cleanText(queryText).toLowerCase().includes(trigger.toLowerCase())) {
    score += 5;
  }

  tags.forEach((tag) => {
    if (cleanText(queryText).toLowerCase().includes(cleanText(tag))) {
      score += 2;
    }
  });

  return score;
}

export async function selectRelevantApprovedAnswers(supabase, {
  agentId,
  ownerUserId,
  queryText,
  limit = 5,
} = {}) {
  const result = await listFrontDeskTrainingItems(supabase, {
    agentId,
    ownerUserId,
    type: "approved_answer",
    status: "active",
  });

  if (result.persistenceAvailable === false) {
    return [];
  }

  return result.items
    .map((item) => ({
      ...item,
      score: scoreApprovedAnswer(item, queryText),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 5)));
}

function normalizeTrainingIdList(value) {
  const rawIds = Array.isArray(value)
    ? value
    : cleanText(value).split(/,|\n/);

  return [...new Set(rawIds.map((id) => cleanText(id)).filter(Boolean))].slice(0, 12);
}

export async function selectRelevantPracticeAnswers(supabase, {
  agentId,
  ownerUserId,
  queryText,
  limit = 5,
  includeDraftTrainingIds = [],
} = {}) {
  const draftIds = normalizeTrainingIdList(includeDraftTrainingIds);
  const activeResult = await listFrontDeskTrainingItems(supabase, {
    agentId,
    ownerUserId,
    type: "approved_answer",
    status: "active",
  });

  if (activeResult.persistenceAvailable === false) {
    return [];
  }

  let draftItems = [];
  if (draftIds.length) {
    const draftResult = await listFrontDeskTrainingItems(supabase, {
      agentId,
      ownerUserId,
      type: "approved_answer",
      status: "draft",
    });

    if (draftResult.persistenceAvailable !== false) {
      const draftIdSet = new Set(draftIds);
      draftItems = draftResult.items.filter((item) => draftIdSet.has(cleanText(item.id)));
    }
  }

  const selectedDraftIds = new Set(draftItems.map((item) => cleanText(item.id)));
  const itemsById = new Map();
  [...activeResult.items, ...draftItems].forEach((item) => {
    const itemId = cleanText(item.id);
    if (itemId) {
      itemsById.set(itemId, item);
    }
  });

  return [...itemsById.values()]
    .map((item) => ({
      ...item,
      score: scoreApprovedAnswer(item, queryText),
      selectedDraft: selectedDraftIds.has(cleanText(item.id)),
    }))
    .filter((item) => item.selectedDraft || item.score > 0)
    .sort((left, right) => {
      if (left.selectedDraft !== right.selectedDraft) {
        return left.selectedDraft ? -1 : 1;
      }
      return right.score - left.score;
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 8)));
}

export function buildApprovedAnswersPrompt(approvedAnswers = []) {
  const items = approvedAnswers
    .map((item, index) => ({
      number: index + 1,
      trigger: cleanText(item.triggerText || item.title),
      answer: cleanText(item.answerText),
      tags: Array.isArray(item.tags) ? item.tags.map(cleanText).filter(Boolean).join(", ") : "",
    }))
    .filter((item) => item.trigger && item.answer);

  if (!items.length) {
    return "";
  }

  return [
    "Owner-approved answers:",
    "Use these only when they match the visitor's question. Treat matching approved answers as the highest-priority trusted business source and prefer them over weaker website excerpts. Answer naturally and do not mention internal labels.",
    ...items.map((item) => [
      `${item.number}. Use when: ${item.trigger}`,
      item.tags ? `Tags: ${item.tags}` : "",
      `Approved answer: ${item.answer}`,
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}
