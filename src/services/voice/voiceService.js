import { toFile } from "openai";

import { DEFAULT_VOICE_CONFIG, VOICE_TTS_VOICES } from "../agents/agentDefaults.js";
import { normalizeVoiceConfig } from "../agents/agentService.js";
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
  const openaiClient = typeof openai === "function" ? openai() : openai;

  if (!openaiClient?.audio?.transcriptions?.create) {
    throw buildVoiceError("OpenAI transcription is unavailable.", 503, "openai_transcription_unavailable");
  }

  const transcription = await openaiClient.audio.transcriptions.create({
    file: await toFile(audio, `voice-input.${extension}`, { type: normalizedContentType }),
    model: getVoiceTranscribeModel(),
  });
  const text = safeText(transcription?.text || "");

  if (!text) {
    throw buildVoiceError("No speech was detected in that recording.", 422, "empty_transcript");
  }

  return {
    text,
    language: safeText(transcription?.language || ""),
    duration: Number(transcription?.duration || transcription?.usage?.seconds || durationSeconds) || durationSeconds,
    agentId: resolvedContext.agent?.id || "",
    businessId: resolvedContext.business?.id || "",
    installId: resolvedContext.widgetConfig?.installId || safeText(context.installId),
    voiceConfig,
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
  const openaiClient = typeof openai === "function" ? openai() : openai;

  if (!openaiClient?.audio?.speech?.create) {
    throw buildVoiceError("OpenAI text-to-speech is unavailable.", 503, "openai_tts_unavailable");
  }

  const speech = await openaiClient.audio.speech.create({
    model: getVoiceTtsModel(),
    voice,
    input: text,
    response_format: "mp3",
  });
  const audioBuffer = Buffer.from(await speech.arrayBuffer());

  if (!audioBuffer.length) {
    throw buildVoiceError("Speech audio could not be generated.", 502, "tts_empty_audio");
  }

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
