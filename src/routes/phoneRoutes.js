import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import {
  processTwilioInboundWebhook,
  processTwilioStatusWebhook,
  verifyTwilioWebhookRequest,
} from "../services/phone/twilioWebhookService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";

function sendTwiML(res, statusCode, twiml) {
  res.status(statusCode || 200);
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.send(twiml);
}

function rejectWebhook(res, statusCode = 403) {
  res.status(statusCode).json({ error: "Invalid webhook request." });
}

export function createPhoneRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const verifyTwilioRequest = deps.verifyTwilioRequest || verifyTwilioWebhookRequest;
  const processInbound = deps.processTwilioInboundWebhook || processTwilioInboundWebhook;
  const processStatus = deps.processTwilioStatusWebhook || processTwilioStatusWebhook;
  const limitPhoneWebhook =
    deps.limitPhoneWebhook || createRateLimitMiddleware("phone_webhook");
  const parseTwilioForm = express.urlencoded({
    extended: false,
    limit: "32kb",
    type: "application/x-www-form-urlencoded",
  });

  function verifyRequest(req) {
    return verifyTwilioRequest({
      req,
      params: req.body && typeof req.body === "object" ? req.body : {},
    });
  }

  router.post("/phone/twilio/inbound", parseTwilioForm, limitPhoneWebhook, async (req, res) => {
    try {
      if (!verifyRequest(req)) {
        rejectWebhook(res);
        return;
      }

      const result = await processInbound(getSupabase(), {
        params: req.body,
        deps,
      });

      sendTwiML(res, result.statusCode, result.twiml);
    } catch (err) {
      console.warn("[phone webhook] Twilio inbound rejected", {
        code: cleanText(err?.code) || "phone_webhook_error",
        statusCode: err?.statusCode || 500,
      });
      rejectWebhook(res, err?.statusCode || 500);
    }
  });

  router.post("/phone/twilio/status", parseTwilioForm, limitPhoneWebhook, async (req, res) => {
    try {
      if (!verifyRequest(req)) {
        rejectWebhook(res);
        return;
      }

      const result = await processStatus(getSupabase(), {
        params: req.body,
        deps,
      });

      sendTwiML(res, result.statusCode, result.twiml);
    } catch (err) {
      console.warn("[phone webhook] Twilio status rejected", {
        code: cleanText(err?.code) || "phone_webhook_error",
        statusCode: err?.statusCode || 500,
      });
      rejectWebhook(res, err?.statusCode || 500);
    }
  });

  return router;
}
