import express from "express";

import { getOpenAIClient } from "../clients/openaiClient.js";
import { getSupabaseClient } from "../clients/supabaseClient.js";
import { resolveAllowedPublicWidgetContext } from "../services/agents/agentService.js";
import { trackProductEvent } from "../services/analytics/productEventService.js";
import {
  createAssistantSpeech,
  getVoiceMaxAudioBytes,
  getVoiceRequestContext,
  transcribeAssistantAudio,
} from "../services/voice/voiceService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";

function getDurationMs(req) {
  return (
    req.query?.duration_ms
    || req.query?.durationMs
    || req.headers["x-voice-duration-ms"]
    || req.headers["x-audio-duration-ms"]
  );
}

function createRawAudioParser() {
  const parser = express.raw({
    type: () => true,
    limit: getVoiceMaxAudioBytes(),
  });

  return function parseRawAudio(req, res, next) {
    parser(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error?.type === "entity.too.large") {
        res.status(413).json({ error: "Audio file is too large." });
        return;
      }

      next(error);
    });
  };
}

function sendRouteError(res, err) {
  const body = {
    error: err.message || "Something went wrong",
  };

  if (cleanText(err.code)) {
    body.code = cleanText(err.code);
  }

  res.status(err.statusCode || 500).json(body);
}

export function createVoiceRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const resolveAllowedPublicWidgetContextImpl =
    deps.resolveAllowedPublicWidgetContext || resolveAllowedPublicWidgetContext;
  const transcribeAssistantAudioImpl = deps.transcribeAssistantAudio || transcribeAssistantAudio;
  const createAssistantSpeechImpl = deps.createAssistantSpeech || createAssistantSpeech;
  const trackProductEventImpl = deps.trackProductEvent || trackProductEvent;
  const enforceTranscribeRateLimit =
    deps.enforceTranscribeRateLimit || createRateLimitMiddleware("public_voice_transcribe");
  const enforceSpeechRateLimit =
    deps.enforceSpeechRateLimit || createRateLimitMiddleware("public_voice_speech");

  async function trackVoiceEvent({
    eventName,
    agentId,
    businessId,
    installId,
    source,
    metadata,
  }) {
    const resolvedAgentId = cleanText(agentId);

    if (!resolvedAgentId || !eventName) {
      return;
    }

    await trackProductEventImpl(getSupabase(), {
      clientId: `agent:${resolvedAgentId}`,
      agentId: resolvedAgentId,
      businessId,
      eventName,
      source,
      metadata: {
        ...metadata,
        has_install_id: Boolean(cleanText(installId)),
      },
      dedupeKey: "",
    }).catch((error) => {
      console.warn("[voice] product event skipped", {
        eventName,
        agentId: resolvedAgentId,
        message: error?.message || "Unknown tracking error",
      });
    });
  }

  router.post(
    "/api/voice/transcribe",
    enforceTranscribeRateLimit,
    createRawAudioParser(),
    async (req, res) => {
      try {
        const context = getVoiceRequestContext(req);
        const result = await transcribeAssistantAudioImpl({
          supabase: getSupabase(),
          openai: getOpenAI,
          audioBuffer: req.body,
          contentType: req.headers["content-type"],
          durationMs: getDurationMs(req),
          context,
          deps: {
            resolveAllowedPublicWidgetContext: resolveAllowedPublicWidgetContextImpl,
            getOwnerBillingSnapshot: deps.getOwnerBillingSnapshot,
            recordEstimatedUsage: deps.recordEstimatedUsage,
          },
        });

        await trackVoiceEvent({
          eventName: "voice_transcription_completed",
          agentId: result.agentId,
          businessId: result.businessId,
          installId: result.installId,
          source: context.displayMode === "page" ? "public_page_voice" : "public_widget_voice",
          metadata: {
            display_mode: cleanText(context.displayMode) || "widget",
            voice_transcription_count: 1,
            audio_duration_seconds: result.duration || null,
            audio_bytes: Buffer.isBuffer(req.body) ? req.body.length : 0,
          },
        });

        res.json({
          text: result.text,
          language: result.language || undefined,
          duration: result.duration || undefined,
          transcriptionLatencyMs: result.transcriptionLatencyMs || undefined,
        });
      } catch (err) {
        console.warn("[voice] transcription failed", {
          statusCode: err?.statusCode || 500,
          code: err?.code || null,
          message: err?.message || "Something went wrong",
        });
        sendRouteError(res, err);
      }
    }
  );

  router.post("/api/voice/speech", enforceSpeechRateLimit, async (req, res) => {
    try {
      const result = await createAssistantSpeechImpl({
        supabase: getSupabase(),
        openai: getOpenAI(),
        body: req.body,
        deps: {
          resolveAllowedPublicWidgetContext: resolveAllowedPublicWidgetContextImpl,
          getOwnerBillingSnapshot: deps.getOwnerBillingSnapshot,
          recordEstimatedUsage: deps.recordEstimatedUsage,
        },
      });

      await trackVoiceEvent({
        eventName: "voice_speech_generated",
        agentId: result.agentId,
        businessId: result.businessId,
        installId: result.installId,
        source: cleanText(req.body?.display_mode || req.body?.displayMode) === "page"
          ? "public_page_voice"
          : "public_widget_voice",
        metadata: {
          display_mode: cleanText(req.body?.display_mode || req.body?.displayMode) || "widget",
          tts_character_count: result.textLength,
          voice: result.voice,
        },
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      res.send(result.audioBuffer);
    } catch (err) {
      console.warn("[voice] speech failed", {
        statusCode: err?.statusCode || 500,
        code: err?.code || null,
        message: err?.message || "Something went wrong",
      });
      sendRouteError(res, err);
    }
  });

  return router;
}
