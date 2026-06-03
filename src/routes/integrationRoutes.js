import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import {
  recordWhatsAppWebhookReceipt,
  verifyWhatsAppWebhookChallenge,
} from "../services/integrations/whatsappWebhookService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";

function rejectWebhook(res, statusCode = 403) {
  res.status(statusCode).json({ error: "Invalid webhook request." });
}

export function createIntegrationRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const verifyWhatsAppChallenge =
    deps.verifyWhatsAppWebhookChallenge || verifyWhatsAppWebhookChallenge;
  const recordWhatsAppReceipt =
    deps.recordWhatsAppWebhookReceipt || recordWhatsAppWebhookReceipt;
  const limitWhatsAppWebhook =
    deps.limitWhatsAppWebhook || createRateLimitMiddleware("whatsapp_webhook");

  router.get(
    "/integrations/whatsapp/webhook/:connectionId",
    limitWhatsAppWebhook,
    async (req, res) => {
      try {
        const result = await verifyWhatsAppChallenge(getSupabase(), {
          connectionId: req.params.connectionId,
          query: req.query,
        });

        res.status(200);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send(result.challenge);
      } catch (err) {
        console.warn("[integration webhook] WhatsApp verification rejected", {
          code: cleanText(err?.code) || "whatsapp_webhook_error",
          statusCode: err?.statusCode || 403,
        });
        rejectWebhook(res, err?.statusCode || 403);
      }
    }
  );

  router.post(
    "/integrations/whatsapp/webhook/:connectionId",
    limitWhatsAppWebhook,
    async (req, res) => {
      try {
        await recordWhatsAppReceipt(getSupabase(), {
          connectionId: req.params.connectionId,
          payload: req.body,
        });

        res.status(200).json({ received: true });
      } catch (err) {
        console.warn("[integration webhook] WhatsApp payload rejected", {
          code: cleanText(err?.code) || "whatsapp_webhook_error",
          statusCode: err?.statusCode || 403,
        });
        rejectWebhook(res, err?.statusCode || 403);
      }
    }
  );

  return router;
}
