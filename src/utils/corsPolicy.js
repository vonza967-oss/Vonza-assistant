import { getPublicAppUrl } from "../config/env.js";

const PUBLIC_CORS_PATHS = [
  /^\/chat(?:\/|$)/,
  /^\/widget\/bootstrap$/,
  /^\/install\/(?:ping|events|outcomes\/detect|outcomes\/ping)$/,
];

const PRIVATE_CORS_PATHS = [
  /^\/dashboard(?:\/|$)/,
  /^\/agents(?:\/|$)/,
  /^\/api\/agents(?:\/|$)/,
  /^\/businesses(?:\/|$)/,
  /^\/knowledge(?:\/|$)/,
  /^\/product-events$/,
  /^\/create-checkout-session$/,
  /^\/billing(?:\/|$)/,
  /^\/stripe\/webhook$/,
];

function normalizeOrigin(value = "") {
  try {
    const url = new URL(String(value || "").trim());
    return url.origin.toLowerCase();
  } catch {
    return "";
  }
}

function getRequestOrigin(req) {
  const host = String(req.headers.host || "").trim();
  if (!host) {
    return "";
  }

  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  return normalizeOrigin(`${proto}://${host}`);
}

function listTrustedAppOrigins(req) {
  const origins = new Set([
    normalizeOrigin(getPublicAppUrl()),
    getRequestOrigin(req),
  ]);

  String(process.env.APP_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean)
    .forEach((origin) => origins.add(origin));

  origins.delete("");
  return origins;
}

function matchesAny(pathname, patterns) {
  return patterns.some((pattern) => pattern.test(pathname));
}

function setCorsHeaders(res, origin, { credentials = false } = {}) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token, X-Turnstile-Token");
  res.setHeader("Access-Control-Max-Age", "600");

  if (credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

export function applyRouteCors(req, res, next) {
  const pathname = String(req.path || req.url || "").split("?")[0] || "/";
  const requestOrigin = normalizeOrigin(req.headers.origin || "");
  const isPreflight = req.method === "OPTIONS";

  if (!requestOrigin) {
    if (isPreflight) {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  if (matchesAny(pathname, PUBLIC_CORS_PATHS)) {
    setCorsHeaders(res, requestOrigin, { credentials: false });
    if (isPreflight) {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  if (matchesAny(pathname, PRIVATE_CORS_PATHS)) {
    const trustedOrigins = listTrustedAppOrigins(req);
    if (trustedOrigins.has(requestOrigin)) {
      setCorsHeaders(res, requestOrigin, { credentials: true });
      if (isPreflight) {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    if (isPreflight) {
      res.status(403).json({ error: "Origin is not allowed." });
      return;
    }
  }

  if (isPreflight) {
    res.status(204).end();
    return;
  }

  next();
}
