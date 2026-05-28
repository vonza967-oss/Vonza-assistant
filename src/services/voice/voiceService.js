import { toFile } from "openai";

import { DEFAULT_VOICE_CONFIG, VOICE_TTS_VOICES } from "../agents/agentDefaults.js";
import { normalizeVoiceConfig } from "../agents/agentService.js";
import {
  buildVoiceSpeechUsageEntry,
  buildVoiceTranscriptionUsageEntry,
  getOwnerBillingSnapshot,
  recordEstimatedUsage,
} from "../billing/billingUsageService.js";
import { ensureWebCallSession } from "./webCallSessionService.js";
import { verifySpeechAuthorization } from "./voiceSpeechTokenService.js";
import { cleanText } from "../../utils/text.js";

export const VOICE_AUDIO_MIME_TYPES = Object.freeze({
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "video/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
});

const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_REALTIME_MODEL = "gpt-realtime";
const DEFAULT_REALTIME_VOICE = "marin";
const REALTIME_VOICES = Object.freeze([
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
]);
const DEFAULT_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_DURATION_SECONDS = 30;
const DEFAULT_MAX_TTS_CHARS = 1200;
const OPENAI_TTS_MAX_CHARS = 4096;

function safeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return cleanText(typeof value === "string" ? value : String(value));
}

function buildVoiceError(message, statusCode = 400, code = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function buildSafeVoiceBillingError(statusCode = 503, code = "voice_billing_unavailable") {
  return buildVoiceError(
    "Voice is temporarily unavailable. Please send your message in the chat instead.",
    statusCode,
    code
  );
}

function buildSafeVoiceProviderError(code = "voice_provider_unavailable") {
  return buildVoiceError(
    "Voice is temporarily unavailable. Please send your message in the chat instead.",
    503,
    code
  );
}

function getPositiveIntegerEnv(key, fallbackValue) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallbackValue;
}

export function getVoiceTranscribeModel() {
  return safeText(process.env.VOICE_TRANSCRIBE_MODEL) || DEFAULT_TRANSCRIBE_MODEL;
}

export function getVoiceTtsModel() {
  return safeText(process.env.VOICE_TTS_MODEL) || DEFAULT_TTS_MODEL;
}

export function getVoiceRealtimeModel() {
  return safeText(process.env.VOICE_REALTIME_MODEL) || DEFAULT_REALTIME_MODEL;
}

export function getVoiceMaxAudioBytes() {
  return getPositiveIntegerEnv("VOICE_MAX_AUDIO_BYTES", DEFAULT_MAX_AUDIO_BYTES);
}

export function getVoiceMaxAudioDurationSeconds() {
  return getPositiveIntegerEnv(
    "VOICE_MAX_AUDIO_DURATION_SECONDS",
    DEFAULT_MAX_AUDIO_DURATION_SECONDS
  );
}

export function getVoiceMaxTtsChars() {
  return Math.min(
    OPENAI_TTS_MAX_CHARS,
    getPositiveIntegerEnv("VOICE_TTS_MAX_CHARS", DEFAULT_MAX_TTS_CHARS)
  );
}

export function normalizeVoiceMimeType(value = "") {
  return safeText(value).toLowerCase().split(";")[0].trim();
}

export function getVoiceFileExtension(contentType = "") {
  return VOICE_AUDIO_MIME_TYPES[normalizeVoiceMimeType(contentType)] || "";
}

export function isAllowedVoice(value = "") {
  return VOICE_TTS_VOICES.includes(safeText(value).toLowerCase());
}

function isAllowedRealtimeVoice(value = "") {
  return REALTIME_VOICES.includes(safeText(value).toLowerCase());
}

export function getVoiceRequestContext(req, body = {}) {
  const source = body && typeof body === "object" && !Buffer.isBuffer(body) ? body : {};
  const query = req?.query && typeof req.query === "object" ? req.query : {};

  return {
    installId: source.install_id || source.installId || query.install_id || query.installId,
    agentId: source.agent_id || source.agentId || query.agent_id || query.agentId,
    agentKey: source.agent_key || source.agentKey || query.agent_key || query.agentKey,
    businessId: source.business_id || source.businessId || query.business_id || query.businessId,
    websiteUrl: source.website_url || source.websiteUrl || query.website_url || query.websiteUrl,
    origin: source.origin || query.origin || req?.headers?.origin,
    pageUrl: source.page_url || source.pageUrl || query.page_url || query.pageUrl,
    publicPageKey:
      source.public_page_key
      || source.publicPageKey
      || source.k
      || query.public_page_key
      || query.publicPageKey
      || query.k,
    displayMode: source.display_mode || source.displayMode || source.mode || query.display_mode || query.displayMode || query.mode,
    sessionKey:
      source.visitor_session_key
      || source.visitorSessionKey
      || source.session_key
      || source.sessionKey
      || query.visitor_session_key
      || query.visitorSessionKey
      || query.session_key
      || query.sessionKey,
    webCallId:
      source.web_call_id
      || source.webCallId
      || query.web_call_id
      || query.webCallId,
  };
}

export function validateVoiceContextIdentifiers(context = {}) {
  if (
    !safeText(context.installId)
    && !safeText(context.agentId)
    && !safeText(context.agentKey)
    && !safeText(context.businessId)
    && !safeText(context.websiteUrl)
  ) {
    throw buildVoiceError(
      "install_id, agent_id, agent_key, website_url, or business_id is required.",
      400,
      "voice_context_required"
    );
  }
}

export async function resolveVoiceContext(supabase, options = {}, deps = {}) {
  const resolveAllowedPublicWidgetContextImpl = deps.resolveAllowedPublicWidgetContext;
  if (typeof resolveAllowedPublicWidgetContextImpl !== "function") {
    throw buildVoiceError("Voice context resolver is unavailable.", 500, "voice_context_unavailable");
  }

  validateVoiceContextIdentifiers(options);
  return resolveAllowedPublicWidgetContextImpl(supabase, options);
}

function resolveOwnerAccessContext(resolvedContext = {}) {
  return {
    ownerUserId: safeText(
      resolvedContext.agent?.ownerUserId
      || resolvedContext.agent?.owner_user_id
    ),
    accessStatus: safeText(
      resolvedContext.agent?.accessStatus
      || resolvedContext.agent?.access_status
    ).toLowerCase(),
  };
}

async function getAllowedVoiceBillingSnapshot(supabase, resolvedContext = {}, deps = {}) {
  const { ownerUserId, accessStatus } = resolveOwnerAccessContext(resolvedContext);

  if (!ownerUserId || accessStatus !== "active") {
    throw buildSafeVoiceBillingError(403, "voice_access_inactive");
  }

  const getOwnerBillingSnapshotImpl = deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot;
  let billingSnapshot;

  try {
    billingSnapshot = await getOwnerBillingSnapshotImpl(supabase, {
      ownerUserId,
      accessStatus,
    });
  } catch (error) {
    const safeError = buildSafeVoiceBillingError(503, "voice_billing_unavailable");
    safeError.cause = error;
    throw safeError;
  }

  if (billingSnapshot?.usage?.isCapped) {
    throw buildVoiceError(
      "This assistant has reached this month's AI capacity. Please send your message in the chat instead.",
      402,
      "voice_ai_capacity_reached"
    );
  }

  return {
    ownerUserId,
    accessStatus,
    billingSnapshot,
  };
}

async function recordVoiceUsage(supabase, options = {}, deps = {}) {
  const recordEstimatedUsageImpl = deps.recordEstimatedUsage || recordEstimatedUsage;

  try {
    await recordEstimatedUsageImpl(supabase, options);
  } catch (error) {
    const safeError = buildSafeVoiceBillingError(503, "voice_billing_unavailable");
    safeError.cause = error;
    throw safeError;
  }
}

function assertVoiceInputEnabled(widgetConfig = {}) {
  const config = normalizeVoiceConfig(widgetConfig.voiceConfig || widgetConfig.voice_config, DEFAULT_VOICE_CONFIG);
  if (config.voiceInputEnabled === false) {
    throw buildVoiceError("Voice input is not enabled for this assistant.", 403, "voice_input_disabled");
  }

  return config;
}

function assertSpokenRepliesEnabled(widgetConfig = {}) {
  const config = normalizeVoiceConfig(widgetConfig.voiceConfig || widgetConfig.voice_config, DEFAULT_VOICE_CONFIG);
  if (config.spokenRepliesEnabled !== true) {
    throw buildVoiceError("Spoken replies are not enabled for this assistant.", 403, "spoken_replies_disabled");
  }

  return config;
}

function assertWebCallEnabled(widgetConfig = {}) {
  const config = assertSpokenRepliesEnabled(widgetConfig);
  if (config.voiceInputEnabled === false) {
    throw buildVoiceError("Voice input is not enabled for this assistant.", 403, "voice_input_disabled");
  }

  if (config.webCallEnabled !== true) {
    throw buildVoiceError("Web Call is not enabled for this assistant.", 403, "web_call_disabled");
  }

  return config;
}

function getOpenAIApiKey() {
  const apiKey = safeText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw buildSafeVoiceProviderError("openai_realtime_unavailable");
  }

  return apiKey;
}

function extractRealtimeClientSecret(data = {}) {
  return safeText(
    data.value
    || data.client_secret?.value
    || data.clientSecret?.value
    || data.secret?.value
  );
}

function extractRealtimeExpiresAt(data = {}) {
  return data.expires_at
    || data.expiresAt
    || data.client_secret?.expires_at
    || data.clientSecret?.expiresAt
    || null;
}

function buildRealtimeInstructions(resolvedContext = {}) {
  const businessName = safeText(
    resolvedContext.business?.name
    || resolvedContext.business?.business_name
    || resolvedContext.widgetConfig?.assistantName
    || resolvedContext.widgetConfig?.assistant_name
    || "this business"
  );
  const assistantName = safeText(
    resolvedContext.widgetConfig?.assistantName
    || resolvedContext.widgetConfig?.assistant_name
    || resolvedContext.agent?.name
  );
  const tone = safeText(resolvedContext.agent?.tone);
  const businessNotes = safeText(resolvedContext.agent?.systemPrompt || resolvedContext.agent?.system_prompt).slice(0, 1200);

  const instructions = [
    `You are the browser voice Front Desk for ${businessName}.`,
    assistantName ? `Your display name is ${assistantName}.` : "",
    tone ? `Use this brand tone: ${tone}.` : "",
    businessNotes ? `Front Desk behavior notes: ${businessNotes}` : "",
    "Default to one or two short spoken sentences. Give longer detail only when the visitor asks for it.",
    "Sound conversational and front-desk appropriate: warm, direct, and useful.",
    "Ask at most one focused follow-up question when needed.",
    "Do not claim this is a phone line, SMS call, or Twilio call. This is browser voice on the Front Desk page.",
    "Do not collect sensitive personal data. If follow-up is needed, ask the visitor to use the on-page contact form.",
    "Only answer business-specific questions when the answer is supported by the Front Desk context. If you are not certain, say so briefly and suggest typing the question or leaving contact details for follow-up.",
  ].filter(Boolean);

  return instructions.join(" ");
}

function buildRealtimeSessionConfig({ resolvedContext, voiceConfig }) {
  const requestedVoice = safeText(voiceConfig.voice).toLowerCase();
  const voice = isAllowedRealtimeVoice(requestedVoice) ? requestedVoice : DEFAULT_REALTIME_VOICE;

  return {
    session: {
      type: "realtime",
      model: getVoiceRealtimeModel(),
      instructions: buildRealtimeInstructions(resolvedContext),
      max_output_tokens: 180,
      audio: {
        input: {
          noise_reduction: {
            type: "near_field",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.45,
            prefix_padding_ms: 300,
            silence_duration_ms: 450,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice,
          speed: 1.03,
        },
      },
    },
  };
}

export async function createRealtimeWebCallClientSecret({
  supabase,
  body,
  deps = {},
}) {
  const context = getVoiceRequestContext({ query: {}, headers: {} }, body);
  const resolvedContext = await resolveVoiceContext(supabase, context, deps);
  const voiceConfig = assertWebCallEnabled(resolvedContext.widgetConfig);
  const voiceBilling = await getAllowedVoiceBillingSnapshot(supabase, resolvedContext, deps);
  const clientSessionKey = safeText(context.webCallId);

  if (!clientSessionKey) {
    throw buildVoiceError("web_call_id is required.", 400, "web_call_id_required");
  }

  const ensureWebCallSessionImpl = deps.ensureWebCallSession || ensureWebCallSession;
  let webCallSession = null;

  try {
    webCallSession = await ensureWebCallSessionImpl(supabase, {
      agent: resolvedContext.agent,
      business: resolvedContext.business,
      ownerUserId: voiceBilling.ownerUserId,
      clientSessionKey,
      visitorSessionKey: context.sessionKey,
      eventName: "web_call_started",
      metadata: {
        conversation_source: "web_call",
        web_call_id: clientSessionKey,
        realtime_mode: "realtime",
      },
    });
  } catch (error) {
    console.warn("[voice] realtime session persistence skipped", {
      agentId: safeText(resolvedContext.agent?.id),
      message: error?.message || "Unknown Web Call session error",
    });
  }

  const fetchImpl = deps.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw buildSafeVoiceProviderError("openai_realtime_unavailable");
  }

  const startedAt = Date.now();
  let response;
  let data;

  try {
    response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAIApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRealtimeSessionConfig({ resolvedContext, voiceConfig })),
    });
    data = await response.json().catch(() => ({}));
  } catch (error) {
    const safeError = buildSafeVoiceProviderError("openai_realtime_unavailable");
    safeError.cause = error;
    throw safeError;
  }

  if (!response?.ok) {
    throw buildSafeVoiceProviderError("openai_realtime_unavailable");
  }

  const clientSecret = extractRealtimeClientSecret(data);
  if (!clientSecret) {
    throw buildSafeVoiceProviderError("openai_realtime_unavailable");
  }

  return {
    clientSecret,
    expiresAt: extractRealtimeExpiresAt(data),
    model: getVoiceRealtimeModel(),
    webCallSessionId: safeText(webCallSession?.id),
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    installId: resolvedContext.widgetConfig?.installId || safeText(context.installId),
    connectionTokenLatencyMs: Math.max(0, Date.now() - startedAt),
  };
}

export function validateAudioUpload({ audioBuffer, contentType, durationMs }) {
  const audio = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.alloc(0);
  const normalizedContentType = normalizeVoiceMimeType(contentType);
  const extension = getVoiceFileExtension(normalizedContentType);
  const duration = Number(durationMs);
  const maxBytes = getVoiceMaxAudioBytes();
  const maxDurationSeconds = getVoiceMaxAudioDurationSeconds();

  if (!extension) {
    throw buildVoiceError("Unsupported audio type. Use WebM, MP3, MP4, M4A, or WAV.", 415, "unsupported_audio_type");
  }

  if (!audio.length) {
    throw buildVoiceError("Audio payload is required.", 400, "audio_required");
  }

  if (audio.length > maxBytes) {
    throw buildVoiceError("Audio file is too large.", 413, "audio_too_large");
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    throw buildVoiceError("Audio duration is required.", 400, "audio_duration_required");
  }

  if (duration > maxDurationSeconds * 1000) {
    throw buildVoiceError("Audio recording is too long.", 413, "audio_too_long");
  }

  return {
    audio,
    normalizedContentType,
    extension,
    durationSeconds: Math.round(duration / 100) / 10,
  };
}

export async function transcribeAssistantAudio({
  supabase,
  openai,
  audioBuffer,
  contentType,
  durationMs,
  context,
  deps = {},
}) {
  const resolvedContext = await resolveVoiceContext(supabase, context, deps);
  const voiceConfig = assertVoiceInputEnabled(resolvedContext.widgetConfig);
  const { audio, normalizedContentType, extension, durationSeconds } = validateAudioUpload({
    audioBuffer,
    contentType,
    durationMs,
  });
  const voiceBilling = await getAllowedVoiceBillingSnapshot(supabase, resolvedContext, deps);
  const openaiClient = typeof openai === "function" ? openai() : openai;
  const model = getVoiceTranscribeModel();

  if (!openaiClient?.audio?.transcriptions?.create) {
    throw buildVoiceError("OpenAI transcription is unavailable.", 503, "openai_transcription_unavailable");
  }

  let transcription;
  const transcriptionStartedAt = Date.now();

  try {
    transcription = await openaiClient.audio.transcriptions.create({
      file: await toFile(audio, `voice-input.${extension}`, { type: normalizedContentType }),
      model,
    });
  } catch (error) {
    const safeError = buildSafeVoiceProviderError("voice_transcription_unavailable");
    safeError.cause = error;
    throw safeError;
  }
  const transcriptionLatencyMs = Math.max(0, Date.now() - transcriptionStartedAt);
  const text = safeText(transcription?.text || "");
  const resolvedDurationSeconds =
    Number(transcription?.duration || transcription?.usage?.seconds || durationSeconds)
    || durationSeconds;

  if (!text) {
    throw buildVoiceError("No speech was detected in that recording.", 422, "empty_transcript");
  }

  await recordVoiceUsage(supabase, {
    ownerUserId: voiceBilling.ownerUserId,
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    billingSnapshot: voiceBilling.billingSnapshot,
    entries: [
      buildVoiceTranscriptionUsageEntry({
        model,
        usage: transcription?.usage,
        durationSeconds: resolvedDurationSeconds,
        audioBytes: audio.length,
      }),
    ],
  }, deps);

  return {
    text,
    language: safeText(transcription?.language || ""),
    duration: resolvedDurationSeconds,
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    installId: resolvedContext.widgetConfig?.installId || safeText(context.installId),
    voiceConfig,
    transcriptionLatencyMs,
  };
}

export function validateSpeechRequest({ text, voice, fallbackVoice }) {
  const normalizedText = safeText(text);
  const maxChars = getVoiceMaxTtsChars();
  const requestedVoice = safeText(voice).toLowerCase();
  const resolvedVoice = requestedVoice || safeText(fallbackVoice).toLowerCase() || DEFAULT_VOICE_CONFIG.voice;

  if (!normalizedText) {
    throw buildVoiceError("Text is required.", 400, "tts_text_required");
  }

  if (normalizedText.length > maxChars) {
    throw buildVoiceError("Text is too long for speech playback.", 413, "tts_text_too_long");
  }

  if (!isAllowedVoice(resolvedVoice)) {
    throw buildVoiceError("Voice is not available.", 400, "invalid_voice");
  }

  return {
    text: normalizedText,
    voice: resolvedVoice,
  };
}

export async function createAssistantSpeech({
  supabase,
  openai,
  body,
  deps = {},
}) {
  const context = getVoiceRequestContext({ query: {}, headers: {} }, body);
  const resolvedContext = await resolveVoiceContext(supabase, context, deps);
  const voiceConfig = assertSpokenRepliesEnabled(resolvedContext.widgetConfig);
  const { text, voice } = validateSpeechRequest({
    text: body?.text,
    voice: body?.voice,
    fallbackVoice: voiceConfig.voice,
  });
  verifySpeechAuthorization({
    token: body?.speech_token || body?.speechToken || body?.speech?.token,
    text,
    resolvedContext,
    requestContext: context,
  });
  const voiceBilling = await getAllowedVoiceBillingSnapshot(supabase, resolvedContext, deps);
  const openaiClient = typeof openai === "function" ? openai() : openai;
  const model = getVoiceTtsModel();

  if (!openaiClient?.audio?.speech?.create) {
    throw buildVoiceError("OpenAI text-to-speech is unavailable.", 503, "openai_tts_unavailable");
  }

  let speech;
  let audioBuffer;

  try {
    speech = await openaiClient.audio.speech.create({
      model,
      voice,
      input: text,
      response_format: "mp3",
    });
    audioBuffer = Buffer.from(await speech.arrayBuffer());
  } catch (error) {
    const safeError = buildSafeVoiceProviderError("voice_speech_unavailable");
    safeError.cause = error;
    throw safeError;
  }

  if (!audioBuffer.length) {
    throw buildVoiceError("Speech audio could not be generated.", 502, "tts_empty_audio");
  }

  await recordVoiceUsage(supabase, {
    ownerUserId: voiceBilling.ownerUserId,
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    billingSnapshot: voiceBilling.billingSnapshot,
    entries: [
      buildVoiceSpeechUsageEntry({
        model,
        usage: speech?.usage,
        textLength: text.length,
        voice,
      }),
    ],
  }, deps);

  return {
    audioBuffer,
    contentType: "audio/mpeg",
    textLength: text.length,
    voice,
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    installId: resolvedContext.widgetConfig?.installId || safeText(context.installId),
  };
}
