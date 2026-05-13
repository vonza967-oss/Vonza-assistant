import { VISITOR_REPLY_FEEDBACK_TABLE } from "../../config/constants.js";
import { resolveAllowedPublicWidgetContext } from "../agents/agentService.js";
import { cleanText } from "../../utils/text.js";

const FEEDBACK_RATINGS = new Set(["helpful", "not_helpful"]);
const MAX_FEEDBACK_KEY_LENGTH = 160;
const MAX_FEEDBACK_PER_SESSION = 25;

function normalizeRating(value) {
  const normalized = cleanText(value).toLowerCase().replaceAll("-", "_");

  if (!FEEDBACK_RATINGS.has(normalized)) {
    const error = new Error("feedback rating must be helpful or not_helpful");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
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
    installId: cleanText(row.install_id),
    sessionKey: cleanText(row.session_key),
    assistantMessageKey: cleanText(row.assistant_message_key),
    rating: cleanText(row.rating),
    messageContext: row.message_context && typeof row.message_context === "object" ? row.message_context : {},
    createdAt: row.created_at || null,
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
    const question = cleanText(questionMessage?.content) || "Visitor marked an answer not helpful.";
    const reply = cleanText(assistantMessage?.content);
    const key = `feedback:${cleanText(feedback.id) || `${sessionKey}:${assistantMessageKey}`}`;

    items.push({
      key,
      type: "knowledge_gap",
      actionType: "knowledge_gap",
      label: "Knowledge gap",
      status: "new",
      count: 1,
      snippet: reply
        ? `Visitor marked this Vonza answer not helpful: ${reply}`
        : "Visitor marked an answer not helpful.",
      question,
      reply,
      whyFlagged: "Flagged because a visitor explicitly marked this answer not helpful.",
      suggestedAction: "Review the answer, then add grounded guidance from verified business knowledge so future answers improve.",
      lastSeenAt: feedback.createdAt || feedback.created_at || null,
      messageId: assistantMessageKey,
      intent: inferFeedbackIntent(question),
      sessionKey,
      weakAnswer: true,
      unresolved: false,
      feedbackId: cleanText(feedback.id),
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
    .select("id, agent_id, install_id, session_key, assistant_message_key, rating, message_context, created_at")
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
    install_id: installId || null,
    session_key: sessionKey,
    assistant_message_key: assistantMessageKey,
    rating,
    message_context: cleanMessageContext(options.messageContext || options.message_context),
  };
  const { data, error } = await supabase
    .from(VISITOR_REPLY_FEEDBACK_TABLE)
    .insert(payload)
    .select("id, agent_id, install_id, session_key, assistant_message_key, rating, message_context, created_at")
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
    .select("id, agent_id, install_id, session_key, assistant_message_key, rating, message_context, created_at")
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
    },
    persistenceAvailable: true,
  };
}
