import { createHash } from "node:crypto";

import { cleanText } from "./text.js";

const DEFAULT_LIMITS = Object.freeze({
  public_chat: { windowMs: 60_000, max: 8 },
  public_chat_capture: { windowMs: 60_000, max: 6 },
  public_chat_feedback: { windowMs: 60_000, max: 10 },
  public_voice_transcribe: { windowMs: 60_000, max: 5 },
  public_voice_speech: { windowMs: 60_000, max: 10 },
  widget_bootstrap: { windowMs: 60_000, max: 60 },
  public_install_signal: { windowMs: 60_000, max: 30 },
  auth_adjacent: { windowMs: 60_000, max: 12 },
  install_verify: { windowMs: 60_000, max: 5 },
});

const memoryBuckets = new Map();

function isLocalDevRuntime() {
  const env = cleanText(process.env.NODE_ENV).toLowerCase();
  return !env || env === "development" || env === "test";
}

function isNodeTestRuntime() {
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

function normalizeIpAddress(value = "") {
  return cleanText(value).replace(/^::ffff:/i, "");
}

function listTrustedProxyIps() {
  return String(process.env.TRUSTED_PROXY_IPS || "")
    .split(",")
    .map((value) => normalizeIpAddress(value))
    .filter(Boolean);
}

function isTrustedProxyRequest(req) {
  const remoteAddress = normalizeIpAddress(req.socket?.remoteAddress || req.connection?.remoteAddress || "");
  return Boolean(remoteAddress && listTrustedProxyIps().includes(remoteAddress));
}

export function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (isTrustedProxyRequest(req) && typeof forwardedFor === "string" && forwardedFor.trim()) {
    return normalizeIpAddress(forwardedFor.split(",")[0]);
  }

  return normalizeIpAddress(req.ip || req.socket?.remoteAddress || "unknown") || "unknown";
}

function getRequestIdentityPart(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query && typeof req.query === "object" ? req.query : {};
  const identityParts = [
    body.install_id || body.installId || query.install_id || query.installId,
    body.session_id || body.sessionId || body.session_key || body.sessionKey || body.visitor_session_key || body.visitorSessionKey,
    body.agent_id || body.agentId || query.agent_id || query.agentId,
    body.agent_key || body.agentKey || query.agent_key || query.agentKey,
    body.website_url || body.websiteUrl || query.website_url || query.websiteUrl,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .slice(0, 5);

  return identityParts.length ? identityParts.join("|") : "anonymous";
}

function getLimitConfig(name, overrides = {}) {
  const base = DEFAULT_LIMITS[name] || DEFAULT_LIMITS.public_chat;
  return {
    windowMs: Number(overrides.windowMs || base.windowMs),
    max: Number(overrides.max || base.max),
  };
}

function hashKey(value = "") {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 40);
}

function getClientKey(req, name) {
  return `rl:${name}:${hashKey(`${getClientIp(req)}:${getRequestIdentityPart(req)}`)}`;
}

function getRateLimitBackendConfig() {
  const explicitBackend = cleanText(process.env.RATE_LIMIT_BACKEND).toLowerCase();
  if (explicitBackend) {
    return { backend: explicitBackend, explicit: true };
  }

  return {
    backend: isLocalDevRuntime() || isNodeTestRuntime() ? "memory" : "redis",
    explicit: false,
  };
}

async function checkMemoryLimit(key, { windowMs, max }) {
  const now = Date.now();
  const recentRequests = (memoryBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

  if (recentRequests.length >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - recentRequests[0])) / 1000)),
    };
  }

  recentRequests.push(now);
  memoryBuckets.set(key, recentRequests);
  return {
    allowed: true,
    remaining: Math.max(0, max - recentRequests.length),
    retryAfterSeconds: 0,
  };
}

function getUpstashConfig() {
  const url = cleanText(process.env.UPSTASH_REDIS_REST_URL || (/^https?:\/\//i.test(cleanText(process.env.REDIS_URL)) ? process.env.REDIS_URL : ""));
  const token = cleanText(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || "");
  return { url: url.replace(/\/$/, ""), token };
}

async function runUpstashCommand(command) {
  const { url, token } = getUpstashConfig();

  if (!url || !token) {
    const error = new Error("Distributed rate limit backend is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const error = new Error("Distributed rate limit backend is unavailable.");
    error.statusCode = 503;
    throw error;
  }

  return response.json();
}

async function checkRedisLimit(key, { windowMs, max }) {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const result = await runUpstashCommand([
    ["INCR", key],
    ["EXPIRE", key, ttlSeconds, "NX"],
    ["TTL", key],
  ]);
  const count = Number(result?.[0]?.result || 0);
  const ttl = Number(result?.[2]?.result || ttlSeconds);

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds: Math.max(1, ttl > 0 ? ttl : ttlSeconds),
  };
}

async function checkLimit(key, config) {
  const { backend, explicit } = getRateLimitBackendConfig();

  if (backend === "memory") {
    if (!isLocalDevRuntime() && !(isNodeTestRuntime() && !explicit)) {
      const error = new Error("Memory rate limiting is disabled outside local development.");
      error.statusCode = 503;
      throw error;
    }
    return checkMemoryLimit(key, config);
  }

  if (backend === "redis" || backend === "upstash") {
    return checkRedisLimit(key, config);
  }

  const error = new Error("Invalid RATE_LIMIT_BACKEND configuration.");
  error.statusCode = 503;
  throw error;
}

export function createRateLimitMiddleware(name, overrides = {}) {
  return async function enforceRateLimit(req, res, next) {
    const config = getLimitConfig(name, overrides);
    const key = getClientKey(req, name);

    try {
      const result = await checkLimit(key, config);
      res.setHeader("RateLimit-Limit", String(config.max));
      res.setHeader("RateLimit-Remaining", String(result.remaining));

      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function clearRateLimitForTests() {
  memoryBuckets.clear();
}
