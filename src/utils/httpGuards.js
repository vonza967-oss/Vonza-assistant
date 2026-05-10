const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const chatRequestLog = new Map();

function normalizeIpAddress(value = "") {
  return String(value || "").trim().replace(/^::ffff:/i, "");
}

function listTrustedProxyIps() {
  return String(process.env.TRUSTED_PROXY_IPS || "")
    .split(",")
    .map((value) => normalizeIpAddress(value))
    .filter(Boolean);
}

function isTrustedProxyRequest(req) {
  const remoteAddress = normalizeIpAddress(req.socket?.remoteAddress || req.connection?.remoteAddress || "");

  if (!remoteAddress) {
    return false;
  }

  return listTrustedProxyIps().includes(remoteAddress);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (isTrustedProxyRequest(req) && typeof forwardedFor === "string" && forwardedFor.trim()) {
    return normalizeIpAddress(forwardedFor.split(",")[0]);
  }

  return normalizeIpAddress(req.ip || req.socket?.remoteAddress || "unknown") || "unknown";
}

function getRequestIdentityPart(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const identityParts = [
    body.install_id || body.installId,
    body.session_id || body.sessionId || body.session_key || body.sessionKey,
    body.agent_id || body.agentId,
    body.agent_key || body.agentKey,
    body.website_url || body.websiteUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return identityParts.length ? identityParts.join("|") : "anonymous";
}

function getClientKey(req) {
  return `${getClientIp(req)}:${getRequestIdentityPart(req)}`;
}

export function enforceChatRateLimit(req, res, next) {
  const clientKey = getClientKey(req);
  const now = Date.now();
  const recentRequests = (chatRequestLog.get(clientKey) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many chat requests. Please wait a moment and try again.",
    });
  }

  recentRequests.push(now);
  chatRequestLog.set(clientKey, recentRequests);
  next();
}

export function clearChatRateLimitForTests() {
  chatRequestLog.clear();
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
