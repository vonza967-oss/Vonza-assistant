import {
  clearRateLimitForTests as clearRateLimitBucketsForTests,
  createRateLimitMiddleware,
  getClientIp,
} from "./rateLimiter.js";
import { cleanText } from "./text.js";

const repeatedPayloads = new Map();
const MAX_PUBLIC_CHAT_MESSAGE_LENGTH = 2000;
const MAX_PUBLIC_CHAT_HISTORY_ITEMS = 20;
const MAX_PUBLIC_FEEDBACK_TEXT_LENGTH = 6000;
const BOT_USER_AGENT_PATTERN = /\b(?:bot|crawler|spider|scraper|headless|curl|wget|python-requests|httpclient|libwww|phantomjs)\b/i;

export const enforceChatRateLimit = createRateLimitMiddleware("public_chat");

export function clearChatRateLimitForTests() {
  clearRateLimitBucketsForTests();
  repeatedPayloads.clear();
}

function getBodyText(body, keys = []) {
  return keys.map((key) => cleanText(body?.[key])).find(Boolean) || "";
}

function buildPayloadRepeatKey(req, text) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const identity = [
    body.install_id || body.installId,
    body.agent_id || body.agentId,
    body.agent_key || body.agentKey,
    body.visitor_session_key || body.visitorSessionKey || body.session_key || body.sessionKey,
  ].map((value) => cleanText(value)).filter(Boolean).join(":");

  return `${getClientIp(req)}:${identity || "anonymous"}:${text.toLowerCase()}`;
}

function reject(res, statusCode, message) {
  res.status(statusCode).json({ error: message });
}

function isTurnstileRequired() {
  return cleanText(process.env.REQUIRE_PUBLIC_CHAT_TURNSTILE).toLowerCase() === "true"
    && cleanText(process.env.TURNSTILE_SECRET_KEY);
}

async function verifyTurnstile(req) {
  if (!isTurnstileRequired()) {
    return true;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const token = cleanText(
    req.headers["x-turnstile-token"]
    || body.turnstile_token
    || body.turnstileToken
    || body.cf_turnstile_response
  );

  if (!token) {
    return false;
  }

  const params = new URLSearchParams();
  params.set("secret", cleanText(process.env.TURNSTILE_SECRET_KEY));
  params.set("response", token);
  params.set("remoteip", getClientIp(req));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const result = await response.json().catch(() => ({}));
  return response.ok && result.success === true;
}

export function enforcePublicChatAbuseGuards(req, res, next) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const message = getBodyText(body, ["message"]);
  const userAgent = cleanText(req.headers["user-agent"]);
  const history = Array.isArray(body.history) ? body.history : [];

  if (BOT_USER_AGENT_PATTERN.test(userAgent) && !cleanText(body.install_id || body.installId || body.agent_key || body.agentKey)) {
    reject(res, 403, "Public chat is not available for automated clients.");
    return;
  }

  if (!message) {
    reject(res, 400, "Message cannot be empty.");
    return;
  }

  if (message.length > MAX_PUBLIC_CHAT_MESSAGE_LENGTH) {
    reject(res, 413, "Message is too long. Please send a shorter question.");
    return;
  }

  if (history.length > MAX_PUBLIC_CHAT_HISTORY_ITEMS) {
    reject(res, 413, "Conversation history is too long. Please start a new message.");
    return;
  }

  const compactMessage = message.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(.)\1{24,}$/.test(compactMessage.replace(/\s/g, ""))) {
    reject(res, 400, "Message looks like repeated spam.");
    return;
  }

  const repeatKey = buildPayloadRepeatKey(req, compactMessage);
  const now = Date.now();
  const recent = (repeatedPayloads.get(repeatKey) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 2) {
    reject(res, 429, "Too many chat requests. Repeated messages are temporarily limited.");
    return;
  }

  recent.push(now);
  repeatedPayloads.set(repeatKey, recent);
  verifyTurnstile(req)
    .then((allowed) => {
      if (!allowed) {
        reject(res, 403, "Complete the verification challenge before chatting.");
        return;
      }
      next();
    })
    .catch((error) => {
      console.warn("[abuse] Turnstile verification failed:", error?.message || error);
      reject(res, 503, "Chat verification is temporarily unavailable.");
    });
}

export function enforcePublicFeedbackAbuseGuards(req, res, next) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const combinedText = [
    body.note,
    body.reason,
    body.user_question || body.userQuestion,
    body.assistant_answer || body.assistantAnswer,
  ].map((value) => cleanText(value)).join("\n");

  if (combinedText.length > MAX_PUBLIC_FEEDBACK_TEXT_LENGTH) {
    reject(res, 413, "Feedback payload is too long.");
    return;
  }

  next();
}

export function enforcePublicCaptureAbuseGuards(req, res, next) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const combinedText = [
    body.name,
    body.email,
    body.phone,
    body.reference_message || body.referenceMessage,
  ].map((value) => cleanText(value)).join("\n");

  if (combinedText.length > 3000) {
    reject(res, 413, "Contact payload is too long.");
    return;
  }

  next();
}

export function requireAdminToken(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return res.status(503).json({
      error: "ADMIN_TOKEN is not configured on the server.",
    });
  }

  const requestToken =
    req.headers["x-admin-token"] ||
    (typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : "");

  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({
      error: "Invalid or missing admin token.",
    });
  }

  next();
}
