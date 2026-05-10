import express from "express";

import { getOpenAIClient } from "../clients/openaiClient.js";
import { getSupabaseClient } from "../clients/supabaseClient.js";
import {
  handleChatRequest,
  handleLeadCaptureRequest,
} from "../services/chat/chatService.js";
import { recordVisitorReplyFeedback } from "../services/analytics/visitorReplyFeedbackService.js";
import { enforceChatRateLimit } from "../utils/httpGuards.js";

export function createChatRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const handleChatRequestImpl = deps.handleChatRequest || handleChatRequest;
  const handleLeadCaptureRequestImpl = deps.handleLeadCaptureRequest || handleLeadCaptureRequest;
  const recordVisitorReplyFeedbackImpl =
    deps.recordVisitorReplyFeedback || recordVisitorReplyFeedback;

  router.post("/chat", enforceChatRateLimit, async (req, res) => {
    try {
      const result = await handleChatRequestImpl({
        supabase: getSupabase(),
        openai: getOpenAI,
        body: req.body,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/chat/capture", enforceChatRateLimit, async (req, res) => {
    try {
      const result = await handleLeadCaptureRequestImpl({
        supabase: getSupabase(),
        body: req.body,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/chat/feedback", enforceChatRateLimit, async (req, res) => {
    try {
      const result = await recordVisitorReplyFeedbackImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        agentId: req.body.agent_id || req.body.agentId,
        agentKey: req.body.agent_key || req.body.agentKey,
        businessId: req.body.business_id || req.body.businessId,
        websiteUrl: req.body.website_url || req.body.websiteUrl,
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        sessionKey: req.body.session_key || req.body.sessionKey,
        assistantMessageKey: req.body.assistant_message_key || req.body.assistantMessageKey,
        rating: req.body.rating,
        messageContext: req.body.message_context || req.body.messageContext,
      });

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
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  return router;
}
