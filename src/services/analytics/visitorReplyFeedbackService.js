import { VISITOR_REPLY_FEEDBACK_TABLE } from "../../config/constants.js";
import { resolveAllowedPublicWidgetContext } from "../agents/agentService.js";
import { cleanText } from "../../utils/text.js";

const FEEDBACK_RATINGS = new Set(["helpful", "not_helpful"]);

function normalizeRating(value) {
  const normalized = cleanText(value).toLowerCase().replaceAll("-", "_");

  if (!FEEDBACK_RATINGS.has(normalized)) {
    const error = new Error("feedback rating must be helpful or not_helpful");
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

export async function recordVisitorReplyFeedback(supabase, options = {}) {
  const rating = normalizeRating(options.rating);
  const sessionKey = cleanText(options.sessionKey || options.session_key);
  const assistantMessageKey = cleanText(options.assistantMessageKey || options.assistant_message_key);

  if (!sessionKey || !assistantMessageKey) {
    const error = new Error("session_key and assistant_message_key are required");
    error.statusCode = 400;
    throw error;
  }

  const context = await resolveAllowedPublicWidgetContext(supabase, {
    installId: options.installId || options.install_id,
    agentId: options.agentId || options.agent_id,
    agentKey: options.agentKey || options.agent_key,
    businessId: options.businessId || options.business_id,
    websiteUrl: options.websiteUrl || options.website_url,
    origin: options.origin,
    pageUrl: options.pageUrl || options.page_url,
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
