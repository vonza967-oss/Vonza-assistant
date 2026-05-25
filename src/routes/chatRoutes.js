import express from "express";

import { getOpenAIClient } from "../clients/openaiClient.js";
import { getSupabaseClient } from "../clients/supabaseClient.js";
import {
  handleChatRequest,
  handleLeadCaptureRequest,
  normalizePublicConversationSource,
} from "../services/chat/chatService.js";
import { recordVisitorReplyFeedback } from "../services/analytics/visitorReplyFeedbackService.js";
import { trackProductEvent } from "../services/analytics/productEventService.js";
import {
  enforcePublicCaptureAbuseGuards,
  enforcePublicChatAbuseGuards,
  enforcePublicFeedbackAbuseGuards,
} from "../utils/httpGuards.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";
import { cleanText } from "../utils/text.js";

function normalizePublicDisplayMode(value) {
  return cleanText(value).toLowerCase() === "page" ? "page" : "widget";
}

function getPublicChatEventSource(displayMode, conversationSource) {
  if (conversationSource === "web_call") {
    return "public_web_call";
  }

  return displayMode === "page" ? "public_page" : "public_widget";
}

export function createChatRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const handleChatRequestImpl = deps.handleChatRequest || handleChatRequest;
  const handleLeadCaptureRequestImpl = deps.handleLeadCaptureRequest || handleLeadCaptureRequest;
  const recordVisitorReplyFeedbackImpl =
    deps.recordVisitorReplyFeedback || recordVisitorReplyFeedback;
  const trackProductEventImpl = deps.trackProductEvent || trackProductEvent;
  const enforcePublicChatRateLimit = deps.enforcePublicChatRateLimit || createRateLimitMiddleware("public_chat");
  const enforcePublicCaptureRateLimit =
    deps.enforcePublicCaptureRateLimit || createRateLimitMiddleware("public_chat_capture");
  const enforcePublicFeedbackRateLimit =
    deps.enforcePublicFeedbackRateLimit || createRateLimitMiddleware("public_chat_feedback");
  const trackPublicProductEvent = async ({
    agentId,
    installId = "",
    eventName,
    source,
    metadata = {},
    dedupeKey = "",
  } = {}) => {
    const resolvedAgentId = cleanText(agentId);

    if (!resolvedAgentId || !eventName) {
      return null;
    }

    return trackProductEventImpl(getSupabase(), {
      clientId: `agent:${resolvedAgentId}`,
      agentId: resolvedAgentId,
      eventName,
      source,
      metadata: {
        ...metadata,
        has_install_id: Boolean(cleanText(installId)),
      },
      dedupeKey,
    }).catch((error) => {
      console.warn("[product-event] public tracking skipped", {
        eventName,
        agentId: resolvedAgentId,
        message: error?.message || "Unknown tracking error",
      });
      return null;
    });
  };

  router.post("/chat", enforcePublicChatAbuseGuards, enforcePublicChatRateLimit, async (req, res) => {
    try {
      const displayMode = normalizePublicDisplayMode(
        req.body.display_mode || req.body.displayMode || req.body.mode
      );
      const conversationSource = normalizePublicConversationSource(
        req.body.conversation_source ||
          req.body.conversationSource ||
          req.body.source_type ||
          req.body.sourceType,
        { displayMode }
      );
      const result = await handleChatRequestImpl({
        supabase: getSupabase(),
        openai: getOpenAI,
        body: req.body,
      });
      await trackPublicProductEvent({
        agentId: result?.agentId,
        installId: req.body.install_id || req.body.installId,
        eventName: "first_widget_chat",
        source: getPublicChatEventSource(displayMode, conversationSource),
        metadata: {
          display_mode: displayMode,
          ...(conversationSource ? { conversation_source: conversationSource } : {}),
          lead_capture_state: result?.leadCapture?.state || "",
          direct_routing_mode: result?.directRouting?.mode || "",
        },
        dedupeKey: `first_widget_chat:${conversationSource || displayMode}:${result?.agentId || ""}`,
      });

      res.json(result);
    } catch (err) {
      const requestId = getRequestId(req);
      logRouteError(err, req, { route: "/chat" });
      sendJsonError(res, err, { publicSurface: true, requestId });
    }
  });

  router.post("/chat/capture", enforcePublicCaptureAbuseGuards, enforcePublicCaptureRateLimit, async (req, res) => {
    try {
      const displayMode = normalizePublicDisplayMode(
        req.body.display_mode || req.body.displayMode || req.body.mode
      );
      const conversationSource = normalizePublicConversationSource(
        req.body.conversation_source ||
          req.body.conversationSource ||
          req.body.source_type ||
          req.body.sourceType,
        { displayMode }
      );
      const result = await handleLeadCaptureRequestImpl({
        supabase: getSupabase(),
        body: req.body,
      });
      if (result?.leadCapture?.state === "captured") {
        await trackPublicProductEvent({
          agentId: result.agentId,
          installId: req.body.install_id || req.body.installId,
          eventName: "first_lead_captured",
          source: "lead_capture",
          metadata: {
            display_mode: displayMode,
            ...(conversationSource ? { conversation_source: conversationSource } : {}),
            state: result.leadCapture.state,
            preferred_channel: result.leadCapture.preferredChannel || "",
          },
          dedupeKey: `first_lead_captured:${conversationSource || displayMode}:${result.agentId}`,
        });
      }

      res.json(result);
    } catch (err) {
      const requestId = getRequestId(req);
      logRouteError(err, req, { route: "/chat/capture" });
      sendJsonError(res, err, { publicSurface: true, requestId });
    }
  });

  router.post("/chat/feedback", enforcePublicFeedbackAbuseGuards, enforcePublicFeedbackRateLimit, async (req, res) => {
    try {
      const displayMode = normalizePublicDisplayMode(
        req.body.display_mode || req.body.displayMode || req.body.mode
      );
      const result = await recordVisitorReplyFeedbackImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        agentId: req.body.agent_id || req.body.agentId,
        agentKey: req.body.agent_key || req.body.agentKey,
        businessId: req.body.business_id || req.body.businessId,
        websiteUrl: req.body.website_url || req.body.websiteUrl,
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        publicPageKey: req.body.public_page_key || req.body.publicPageKey || req.body.k,
        displayMode,
        sessionKey: req.body.session_key || req.body.sessionKey,
        assistantMessageKey: req.body.assistant_message_key || req.body.assistantMessageKey,
        rating: req.body.rating,
        reason: req.body.reason,
        note: req.body.note,
        userQuestion: req.body.user_question || req.body.userQuestion,
        assistantAnswer: req.body.assistant_answer || req.body.assistantAnswer,
        sourceRoute: req.body.source_route || req.body.sourceRoute,
        messageContext: req.body.message_context || req.body.messageContext,
      });
      if (result?.duplicate !== true) {
        await trackPublicProductEvent({
          agentId: result?.feedback?.agentId,
          installId: result?.feedback?.installId || req.body.install_id || req.body.installId,
          eventName: result?.feedback?.rating === "helpful" ? "first_helpful_feedback" : "first_not_helpful_feedback",
          source: "reply_feedback",
          metadata: {
            display_mode: displayMode,
            rating: result?.feedback?.rating || "",
          },
          dedupeKey: `first_${result?.feedback?.rating === "helpful" ? "helpful" : "not_helpful"}_feedback:${displayMode}:${result?.feedback?.agentId || ""}`,
        });
      }

      res.json(result);
    } catch (err) {
      console.warn("[chat feedback] feedback capture failed", {
        installId: req.body.install_id || req.body.installId || null,
        agentId: req.body.agent_id || req.body.agentId || null,
        sessionKeyPresent: Boolean(req.body.session_key || req.body.sessionKey),
        assistantMessageKeyPresent: Boolean(req.body.assistant_message_key || req.body.assistantMessageKey),
        statusCode: err?.statusCode || 500,
        code: err?.code || null,
        message: err?.message || "Something went wrong",
      });
      sendJsonError(res, err, {
        publicSurface: true,
        requestId: getRequestId(req),
      });
    }
  });

  return router;
}
