import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import { processCalendlyWebhook } from "../services/bookings/bookingIntegrationService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";

export function createBookingRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const processCalendlyWebhookImpl = deps.processCalendlyWebhook || processCalendlyWebhook;
  const limitBookingWebhook =
    deps.limitBookingWebhook || createRateLimitMiddleware("booking_webhook");

  router.post(
    "/bookings/webhooks/calendly/:token",
    limitBookingWebhook,
    async (req, res) => {
      try {
        const result = await processCalendlyWebhookImpl(getSupabase(), {
          endpointToken: req.params.token,
          rawBody: req.body,
          headers: req.headers,
        });

        res.json({
          received: true,
          ignored: result.ignored === true,
          duplicate: result.duplicate === true,
        });
      } catch (err) {
        console.warn("[booking webhook] Calendly webhook rejected", {
          code: cleanText(err?.code) || "booking_webhook_error",
          statusCode: err?.statusCode || 400,
        });
        res.status(err?.statusCode || 400).json({
          error: "Invalid webhook request.",
        });
      }
    }
  );

  return router;
}
