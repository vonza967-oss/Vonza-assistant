import crypto from "node:crypto";

import { DEFAULT_VOICE_CONFIG } from "../agents/agentDefaults.js";
import { normalizeVoiceConfig } from "../agents/agentService.js";
import { cleanText } from "../../utils/text.js";

const TOKEN_VERSION = 1;
const DEFAULT_TOKEN_TTL_SECONDS = 5 * 60;
const MAX_TOKEN_TTL_SECONDS = 15 * 60;
const MIN_TOKEN_TTL_SECONDS = 30;
const TOKEN_PREFIX = "vst1";

function safeText(value) {
  return cleanText(value === null || value === undefined ? "" : String(value));
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function timingSafeEqualString(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getTokenSecret(env = process.env) {
  return safeText(
    env.VOICE_SPEECH_TOKEN_SECRET
    || env.GOOGLE_TOKEN_ENCRYPTION_SECRET
    || env.BOOKING_WEBHOOK_ENCRYPTION_SECRET
    || env.SUPABASE_SERVICE_ROLE_KEY
    || env.STRIPE_WEBHOOK_SECRET
  );
}

function getTokenTtlSeconds(env = process.env) {
  const value = Number(env.VOICE_SPEECH_TOKEN_TTL_SECONDS);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }

  return Math.min(MAX_TOKEN_TTL_SECONDS, Math.max(MIN_TOKEN_TTL_SECONDS, Math.round(value)));
}

function buildSpeechTokenError(message, statusCode = 403, code = "speech_authorization_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function hashSpeechReplyText(text = "") {
  return crypto
    .createHash("sha256")
    .update(safeText(text), "utf8")
    .digest("base64url");
}

function signPayload(encodedPayload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function buildSpeechTokenPayload({
  agent,
  businessId,
  widgetConfig,
  sessionKey,
  reply,
  displayMode,
  nowMs = Date.now(),
  env = process.env,
} = {}) {
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + getTokenTtlSeconds(env);

  return {
    v: TOKEN_VERSION,
    agentId: safeText(agent?.id),
    agentKey: safeText(agent?.publicAgentKey || agent?.public_agent_key),
    businessId: safeText(businessId),
    installId: safeText(widgetConfig?.installId || widgetConfig?.install_id),
    sessionKey: safeText(sessionKey),
    displayMode: safeText(displayMode).toLowerCase() === "page" ? "page" : "widget",
    replyHash: hashSpeechReplyText(reply),
    iat: issuedAt,
    exp: expiresAt,
  };
}

export function createSpeechAuthorization({
  agent,
  businessId,
  widgetConfig,
  sessionKey,
  reply,
  displayMode = "widget",
  nowMs = Date.now(),
  env = process.env,
} = {}) {
  const voiceConfig = normalizeVoiceConfig(
    widgetConfig?.voiceConfig || widgetConfig?.voice_config,
    DEFAULT_VOICE_CONFIG
  );

  if (voiceConfig.spokenRepliesEnabled !== true || !safeText(reply)) {
    return null;
  }

  const secret = getTokenSecret(env);
  if (!secret) {
    throw buildSpeechTokenError("Speech authorization is unavailable.", 500, "speech_authorization_unavailable");
  }

  const payload = buildSpeechTokenPayload({
    agent,
    businessId,
    widgetConfig,
    sessionKey,
    reply,
    displayMode,
    nowMs,
    env,
  });
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return {
    token: `${TOKEN_PREFIX}.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

function parseSpeechToken(token = "") {
  const parts = safeText(token).split(".");

  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) {
    throw buildSpeechTokenError("Speech authorization is required.", 401, "speech_authorization_required");
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw buildSpeechTokenError("Speech authorization is invalid.", 403, "speech_authorization_invalid");
  }

  return {
    encodedPayload: parts[1],
    signature: parts[2],
    payload,
  };
}

function assertEqualClaim(left, right, code = "speech_authorization_context_mismatch") {
  if (!timingSafeEqualString(safeText(left), safeText(right))) {
    throw buildSpeechTokenError("Speech authorization is invalid.", 403, code);
  }
}

function normalizeDisplayMode(value) {
  return safeText(value).toLowerCase() === "page" ? "page" : "widget";
}

export function verifySpeechAuthorization({
  token,
  text,
  resolvedContext,
  requestContext = {},
  nowMs = Date.now(),
  env = process.env,
} = {}) {
  const secret = getTokenSecret(env);
  if (!secret) {
    throw buildSpeechTokenError("Speech authorization is unavailable.", 500, "speech_authorization_unavailable");
  }

  const parsed = parseSpeechToken(token);
  const expectedSignature = signPayload(parsed.encodedPayload, secret);

  if (!timingSafeEqualString(parsed.signature, expectedSignature)) {
    throw buildSpeechTokenError("Speech authorization is invalid.", 403, "speech_authorization_invalid");
  }

  const payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {};
  const nowSeconds = Math.floor(nowMs / 1000);

  if (Number(payload.v) !== TOKEN_VERSION || !Number.isFinite(Number(payload.exp))) {
    throw buildSpeechTokenError("Speech authorization is invalid.", 403, "speech_authorization_invalid");
  }

  if (Number(payload.exp) < nowSeconds) {
    throw buildSpeechTokenError("Speech authorization expired.", 401, "speech_authorization_expired");
  }

  const agent = resolvedContext?.agent || {};
  const widgetConfig = resolvedContext?.widgetConfig || {};
  const expectedInstallId = safeText(widgetConfig.installId || widgetConfig.install_id || requestContext.installId);
  const tokenInstallId = safeText(payload.installId);

  assertEqualClaim(payload.agentId, agent.id);
  assertEqualClaim(payload.sessionKey, requestContext.sessionKey);
  assertEqualClaim(payload.displayMode, normalizeDisplayMode(requestContext.displayMode));
  assertEqualClaim(payload.replyHash, hashSpeechReplyText(text), "speech_authorization_text_mismatch");

  if (safeText(payload.agentKey) || safeText(agent.publicAgentKey || agent.public_agent_key)) {
    assertEqualClaim(payload.agentKey, agent.publicAgentKey || agent.public_agent_key);
  }

  if (safeText(payload.businessId) || safeText(resolvedContext?.business?.id)) {
    assertEqualClaim(payload.businessId, resolvedContext?.business?.id);
  }

  if (tokenInstallId || expectedInstallId) {
    assertEqualClaim(tokenInstallId, expectedInstallId);
  }

  return {
    ok: true,
    expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
  };
}
