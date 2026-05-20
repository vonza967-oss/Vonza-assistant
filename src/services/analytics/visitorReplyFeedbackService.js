import { VISITOR_REPLY_FEEDBACK_TABLE } from "../../config/constants.js";
import { resolveAllowedPublicWidgetContext } from "../agents/agentService.js";
import { cleanText } from "../../utils/text.js";

const FEEDBACK_RATINGS = new Set(["helpful", "not_helpful"]);
const FEEDBACK_REASONS = new Set(["incorrect", "missing_details", "too_vague", "did_not_answer", "other", ""]);
const FEEDBACK_STATUSES = new Set(["new", "queued", "resolved", "ignored"]);
const FEEDBACK_SOURCES = new Set(["visitor_feedback", "owner_feedback", "test"]);
const MAX_FEEDBACK_KEY_LENGTH = 160;
const MAX_FEEDBACK_PER_SESSION = 25;
const MAX_FEEDBACK_NOTE_LENGTH = 600;
const MAX_FEEDBACK_TEXT_LENGTH = 5000;

function normalizeRating(value) {
  const normalized = cleanText(value).toLowerCase().replaceAll("-", "_");

  if (!FEEDBACK_RATINGS.has(normalized)) {
    const error = new Error("feedback rating must be helpful or not_helpful");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizeReason(value) {
  const normalized = cleanText(value).toLowerCase().replaceAll("-", "_");
  return FEEDBACK_REASONS.has(normalized) ? normalized : "";
}

function normalizeFeedbackStatus(value, fallback = "new") {
  const normalized = cleanText(value).toLowerCase();
  return FEEDBACK_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeFeedbackSource(value, fallback = "visitor_feedback") {
  const normalized = cleanText(value).toLowerCase();
  return FEEDBACK_SOURCES.has(normalized) ? normalized : fallback;
}

function limitFeedbackText(value, maxLength = MAX_FEEDBACK_TEXT_LENGTH) {
  return cleanText(value).slice(0, maxLength);
}

function normalizeFeedbackKey(value, fieldName) {
  const normalized = cleanText(value);

  if (!normalized) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }

  if (normalized.length > MAX_FEEDBACK_KEY_LENGTH) {
    const error = new Error(`${fieldName} is too long`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function isMissingFeedbackSchemaError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes(VISITOR_REPLY_FEEDBACK_TABLE)
  );
}

function buildMissingFeedbackSchemaError() {
  const error = new Error(
    `Missing required visitor reply feedback schema for '${VISITOR_REPLY_FEEDBACK_TABLE}'. Apply the latest database migration before using reply feedback.`
  );
  error.statusCode = 503;
  error.code = "visitor_reply_feedback_unavailable";
  return error;
}

function mapFeedbackRow(row = {}) {
  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agent_id),
    ownerUserId: cleanText(row.owner_user_id),
    installId: cleanText(row.install_id),
    sessionKey: cleanText(row.session_key),
    assistantMessageKey: cleanText(row.assistant_message_key),
    rating: cleanText(row.rating),
    reason: cleanText(row.reason),
    note: cleanText(row.note),
    userQuestion: cleanText(row.user_question),
    assistantAnswer: cleanText(row.assistant_answer),
    displayMode: cleanText(row.display_mode),
    sourceRoute: cleanText(row.source_route),
    sourceType: cleanText(row.source_type || "visitor_feedback"),
    status: cleanText(row.status || "new"),
    trainingItemId: cleanText(row.training_item_id),
    messageContext: row.message_context && typeof row.message_context === "object" ? row.message_context : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function cleanMessageContext(input = {}) {
  const context = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    replyLength: Math.max(0, Math.min(Number(context.replyLength || context.reply_length || 0) || 0, 20000)),
    conversationIndex: Math.max(0, Math.min(Number(context.conversationIndex || context.conversation_index || 0) || 0, 1000)),
  };
}

function assertFeedbackKeyMatchesSession(sessionKey, assistantMessageKey) {
  if (!assistantMessageKey.startsWith(`${sessionKey}::`)) {
    const error = new Error("assistant_message_key does not match this conversation session");
    error.statusCode = 400;
    error.code = "feedback_session_mismatch";
    throw error;
  }
}

function getTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeMessage(message = {}) {
  return {
    id: cleanText(message.id || message.messageId || message.message_id),
    role: cleanText(message.role).toLowerCase(),
    content: cleanText(message.content),
    sessionKey: cleanText(message.sessionKey || message.session_key),
    createdAt: message.createdAt || message.created_at || null,
  };
}

function findAssistantMessageForFeedback(messages = [], feedback = {}) {
  const messageKey = cleanText(feedback.assistantMessageKey || feedback.assistant_message_key);
  const sessionKey = cleanText(feedback.sessionKey || feedback.session_key);

  if (!messageKey) {
    return null;
  }

  return messages.find((message) =>
    message.role === "assistant" &&
    message.id === messageKey &&
    (!sessionKey || message.sessionKey === sessionKey)
  ) || null;
}

function findPreviousUserMessage(messages = [], assistantMessage = {}) {
  const assistantTimestamp = getTimestamp(assistantMessage.createdAt);

  return [...messages]
    .filter((message) =>
      message.role === "user" &&
      message.sessionKey === assistantMessage.sessionKey &&
      getTimestamp(message.createdAt) <= assistantTimestamp
    )
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt))[0] || null;
}

function inferFeedbackIntent(question = "") {
  const normalized = cleanText(question).toLowerCase();

  if (/\b(price|pricing|cost|quote|fee|package|how much)\b/.test(normalized)) {
    return "pricing";
  }

  if (/\b(book|booking|appointment|schedule|availability|consultation)\b/.test(normalized)) {
    return "booking";
  }

  if (/\b(contact|email|phone|call|reach|talk to|speak to)\b/.test(normalized)) {
    return "contact";
  }

  if (/\b(problem|issue|support|refund|cancel|complaint|broken|unhappy)\b/.test(normalized)) {
    return "support";
  }

  return "general";
}

export function buildKnowledgeImprovementQueueItemsFromFeedback(messages = [], feedbackRecords = []) {
  const normalizedMessages = messages.map((message) => normalizeMessage(message));
  const items = [];

  (Array.isArray(feedbackRecords) ? feedbackRecords : []).forEach((feedback) => {
    if (cleanText(feedback.rating).toLowerCase() !== "not_helpful") {
      return;
    }
    if (["resolved", "ignored"].includes(cleanText(feedback.status).toLowerCase())) {
      return;
    }

    const sessionKey = cleanText(feedback.sessionKey || feedback.session_key);
    const assistantMessageKey = cleanText(feedback.assistantMessageKey || feedback.assistant_message_key);
    const assistantMessage = findAssistantMessageForFeedback(normalizedMessages, {
      ...feedback,
      sessionKey,
      assistantMessageKey,
    });
    const questionMessage = assistantMessage
      ? findPreviousUserMessage(normalizedMessages, assistantMessage)
      : null;
    const question = cleanText(feedback.userQuestion || feedback.user_question || questionMessage?.content) || "Visitor marked an answer not helpful.";
    const reply = cleanText(feedback.assistantAnswer || feedback.assistant_answer || assistantMessage?.content);
    const key = `feedback:${cleanText(feedback.id) || `${sessionKey}:${assistantMessageKey}`}`;
    const sourceType = normalizeFeedbackSource(feedback.sourceType || feedback.source_type);
    const sourceLabel = sourceType === "owner_feedback" ? "owner feedback" : sourceType === "test" ? "test" : "visitor feedback";
    const reason = normalizeReason(feedback.reason);
    const note = limitFeedbackText(feedback.note, MAX_FEEDBACK_NOTE_LENGTH);

    items.push({
      key,
      type: "knowledge_gap",
      actionType: "knowledge_gap",
      label: "Knowledge gap",
      status: "new",
      count: 1,
      snippet: reply
        ? `${sourceLabel === "visitor feedback" ? "Visitor" : sourceLabel === "owner feedback" ? "Owner" : "Test"} marked this answer not helpful: ${reply}`
        : `${sourceLabel === "visitor feedback" ? "Visitor" : sourceLabel === "owner feedback" ? "Owner" : "Test"} marked an answer not helpful.`,
      question,
      reply,
      whyFlagged: `Flagged because ${sourceLabel} marked this answer not helpful.`,
      suggestedAction: "Review the answer, then add grounded guidance from verified business knowledge so future answers improve.",
      lastSeenAt: feedback.createdAt || feedback.created_at || null,
      messageId: assistantMessageKey,
      intent: inferFeedbackIntent(question),
      sessionKey,
      weakAnswer: true,
      unresolved: false,
      feedbackId: cleanText(feedback.id),
      feedbackReason: reason,
      feedbackNote: note,
      source: sourceType,
      sourceLabel,
      displayMode: cleanText(feedback.displayMode || feedback.display_mode),
      sourceRoute: cleanText(feedback.sourceRoute || feedback.source_route),
    });
  });

  return items;
}

export async function recordVisitorReplyFeedback(supabase, options = {}) {
  const rating = normalizeRating(options.rating);
  const sessionKey = normalizeFeedbackKey(options.sessionKey || options.session_key, "session_key");
  const assistantMessageKey = normalizeFeedbackKey(
    options.assistantMessageKey || options.assistant_message_key,
    "assistant_message_key"
  );
  assertFeedbackKeyMatchesSession(sessionKey, assistantMessageKey);

  const context = await resolveAllowedPublicWidgetContext(supabase, {
    installId: options.installId || options.install_id,
    agentId: options.agentId || options.agent_id,
    agentKey: options.agentKey || options.agent_key,
    businessId: options.businessId || options.business_id,
    websiteUrl: options.websiteUrl || options.website_url,
    origin: options.origin,
    pageUrl: options.pageUrl || options.page_url,
    displayMode: options.displayMode || options.display_mode,
  });

  const installId = cleanText(options.installId || options.install_id || context.widgetConfig?.installId);

  const { data: existing, error: existingError } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
    .eq("agent_id", context.agent.id)
    .eq("session_key", sessionKey)
    .eq("assistant_message_key", assistantMessageKey)
    .maybeSingle();

  if (existingError) {
    if (isMissingFeedbackSchemaError(existingError)) {
      throw buildMissingFeedbackSchemaError();
    }

    throw existingError;
  }

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      feedback: mapFeedbackRow(existing),
    };
  }

  const { data: sessionFeedbackRows, error: sessionFeedbackError } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .select("id, assistant_message_key")
    .eq("agent_id", context.agent.id)
    .eq("session_key", sessionKey)
    .limit(MAX_FEEDBACK_PER_SESSION);

  if (sessionFeedbackError) {
    if (isMissingFeedbackSchemaError(sessionFeedbackError)) {
      throw buildMissingFeedbackSchemaError();
    }

    throw sessionFeedbackError;
  }

  if ((sessionFeedbackRows || []).length >= MAX_FEEDBACK_PER_SESSION) {
    const error = new Error("Too much feedback was submitted for this conversation.");
    error.statusCode = 429;
    error.code = "feedback_session_limit";
    throw error;
  }

  const payload = {
    agent_id: context.agent.id,
    owner_user_id: context.agent.ownerUserId || context.agent.owner_user_id || null,
    install_id: installId || null,
    session_key: sessionKey,
    assistant_message_key: assistantMessageKey,
    rating,
    reason: normalizeReason(options.reason) || null,
    note: limitFeedbackText(options.note, MAX_FEEDBACK_NOTE_LENGTH) || null,
    user_question: limitFeedbackText(options.userQuestion || options.user_question || options.messageContext?.userQuestion || options.message_context?.user_question, 1200) || null,
    assistant_answer: limitFeedbackText(options.assistantAnswer || options.assistant_answer || options.messageContext?.assistantAnswer || options.message_context?.assistant_answer, 5000) || null,
    display_mode: cleanText(options.displayMode || options.display_mode) || null,
    source_route: cleanText(options.sourceRoute || options.source_route || "public_assistant").slice(0, 120) || null,
    source_type: "visitor_feedback",
    status: rating === "helpful" ? "resolved" : "new",
    updated_at: new Date().toISOString(),
    message_context: cleanMessageContext(options.messageContext || options.message_context),
  };
  const { data, error } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .insert(payload)
    .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
    .single();

  if (error) {
    if (error?.code === "23505") {
      return {
        ok: true,
        duplicate: true,
        feedback: {
          ...payload,
          agentId: payload.agent_id,
          installId: payload.install_id || "",
          sessionKey,
          assistantMessageKey,
          createdAt: null,
        },
      };
    }

    if (isMissingFeedbackSchemaError(error)) {
      throw buildMissingFeedbackSchemaError();
    }

    throw error;
  }

  return {
    ok: true,
    duplicate: false,
    feedback: mapFeedbackRow(data || {}),
  };
}

export async function listVisitorReplyFeedbackForOwner(supabase, options = {}) {
  const agentId = cleanText(options.agentId || options.agent_id);
  const ownerUserId = cleanText(options.ownerUserId || options.owner_user_id);

  if (!agentId || !ownerUserId) {
    const error = new Error("agent_id and owner_user_id are required");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingFeedbackSchemaError(error)) {
      return {
        records: [],
        summary: {
          total: 0,
          helpful: 0,
          notHelpful: 0,
          needsReview: 0,
        },
        persistenceAvailable: false,
      };
    }

    throw error;
  }

  const records = (data || []).map((row) => mapFeedbackRow(row));

  return {
    records,
    summary: {
      total: records.length,
      helpful: records.filter((record) => record.rating === "helpful").length,
      notHelpful: records.filter((record) => record.rating === "not_helpful").length,
      needsReview: records.filter((record) =>
        record.rating === "not_helpful" && !["resolved", "ignored"].includes(record.status)
      ).length,
    },
    persistenceAvailable: true,
  };
}

export async function recordOwnerAnswerFeedback(supabase, options = {}) {
  const agentId = cleanText(options.agentId || options.agent_id);
  const ownerUserId = cleanText(options.ownerUserId || options.owner_user_id);
  const rating = normalizeRating(options.rating || "not_helpful");
  const sourceType = normalizeFeedbackSource(options.sourceType || options.source_type, "owner_feedback");
  const userQuestion = limitFeedbackText(options.userQuestion || options.user_question, 1200);
  const assistantAnswer = limitFeedbackText(options.assistantAnswer || options.assistant_answer, 5000);
  const assistantMessageKey = cleanText(options.assistantMessageKey || options.assistant_message_key || options.assistantMessageId || options.assistant_message_id);
  const sessionKey = cleanText(options.sessionKey || options.session_key)
    || (assistantMessageKey ? `owner-review:${assistantMessageKey}` : `owner-review:${Date.now()}`);

  if (!agentId || !ownerUserId) {
    const error = new Error("agent_id and owner context are required.");
    error.statusCode = 400;
    throw error;
  }

  if (rating === "not_helpful" && (!userQuestion || !assistantAnswer)) {
    const error = new Error("Add the customer question and answer before sending this to the Training queue.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    agent_id: agentId,
    owner_user_id: ownerUserId,
    install_id: null,
    session_key: sessionKey.slice(0, MAX_FEEDBACK_KEY_LENGTH),
    assistant_message_key: (assistantMessageKey || `${sessionKey}::owner-feedback`).slice(0, MAX_FEEDBACK_KEY_LENGTH),
    rating,
    reason: normalizeReason(options.reason) || null,
    note: limitFeedbackText(options.note, MAX_FEEDBACK_NOTE_LENGTH) || null,
    user_question: userQuestion || null,
    assistant_answer: assistantAnswer || null,
    display_mode: cleanText(options.displayMode || options.display_mode) || null,
    source_route: cleanText(options.sourceRoute || options.source_route || "dashboard").slice(0, 120) || null,
    source_type: sourceType,
    status: rating === "helpful" ? "resolved" : "queued",
    message_context: cleanMessageContext(options.messageContext || options.message_context),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .insert(payload)
    .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
    .single();

  if (error) {
    if (error?.code === "23505") {
      const { data: updated, error: updateError } = await supabase
        .from(VISITOR_REPLY_FEEDBACK_TABLE)
        .update({
          rating: payload.rating,
          reason: payload.reason,
          note: payload.note,
          user_question: payload.user_question,
          assistant_answer: payload.assistant_answer,
          source_type: payload.source_type,
          source_route: payload.source_route,
          status: payload.status,
          updated_at: payload.updated_at,
        })
        .eq("agent_id", agentId)
        .eq("session_key", payload.session_key)
        .eq("assistant_message_key", payload.assistant_message_key)
        .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      return {
        ok: true,
        feedback: mapFeedbackRow(updated || {}),
      };
    }

    if (isMissingFeedbackSchemaError(error)) {
      throw buildMissingFeedbackSchemaError();
    }

    throw error;
  }

  return {
    ok: true,
    feedback: mapFeedbackRow(data || {}),
  };
}

export async function updateVisitorReplyFeedbackStatus(supabase, options = {}) {
  const agentId = cleanText(options.agentId || options.agent_id);
  const ownerUserId = cleanText(options.ownerUserId || options.owner_user_id);
  const feedbackId = cleanText(options.feedbackId || options.feedback_id);
  const status = normalizeFeedbackStatus(options.status, "");

  if (!agentId || !ownerUserId || !feedbackId || !status) {
    const error = new Error("feedback_id, agent_id, owner context, and status are required.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    status,
    updated_at: new Date().toISOString(),
  };
  const trainingItemId = cleanText(options.trainingItemId || options.training_item_id);
  if (trainingItemId) {
    payload.training_item_id = trainingItemId;
  }

  const { data, error } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .update(payload)
    .eq("id", feedbackId)
    .eq("agent_id", agentId)
    .select("id, agent_id, owner_user_id, install_id, session_key, assistant_message_key, rating, reason, note, user_question, assistant_answer, display_mode, source_route, source_type, status, training_item_id, message_context, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingFeedbackSchemaError(error)) {
      throw buildMissingFeedbackSchemaError();
    }

    throw error;
  }

  return {
    ok: true,
    feedback: mapFeedbackRow(data || {}),
  };
}
