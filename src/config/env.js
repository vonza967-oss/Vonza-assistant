export function getPort() {
  return Number(process.env.PORT || 3000);
}

export function getPublicAppUrl(port = getPort()) {
  return (process.env.PUBLIC_APP_URL || `http://0.0.0.0:${port}`).replace(/\/$/, "");
}

export function getSupabasePublicUrl() {
  return String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

export function getSupabaseAnonKey() {
  return String(process.env.SUPABASE_ANON_KEY || "");
}

export function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "");
}

export function getStripePriceId() {
  return String(process.env.STRIPE_PRICE_ID || "");
}

export function getStripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || "");
}

function normalizeBooleanEnv(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeIntegerEnv(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(parsed, max));
}

function normalizeNumberEnv(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseFloat(String(value || "").trim());

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(parsed, max));
}

export function getRagEmbeddingModel() {
  return String(process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small").trim();
}

export function getRagEmbeddingDimensions() {
  return normalizeIntegerEnv(process.env.RAG_EMBEDDING_DIMENSIONS, 1536, {
    min: 1,
    max: 4096,
  });
}

export function isRagEmbeddingsEnabled() {
  return normalizeBooleanEnv(process.env.RAG_EMBEDDINGS_ENABLED, true);
}

export function getRagMaxContextChunks() {
  return normalizeIntegerEnv(process.env.RAG_MAX_CONTEXT_CHUNKS, 6, {
    min: 1,
    max: 12,
  });
}

export function getRagMinSimilarity() {
  return normalizeNumberEnv(process.env.RAG_MIN_SIMILARITY, 0.25, {
    min: 0,
    max: 1,
  });
}

export function getRagMaxChunkChars() {
  return normalizeIntegerEnv(process.env.RAG_MAX_CHUNK_CHARS, 1200, {
    min: 300,
    max: 4000,
  });
}

export function getRagChunkOverlapChars() {
  return normalizeIntegerEnv(process.env.RAG_CHUNK_OVERLAP_CHARS, 150, {
    min: 0,
    max: 600,
  });
}

export function getWebsiteImportMaxPages() {
  return normalizeIntegerEnv(process.env.WEBSITE_IMPORT_MAX_PAGES, 20, {
    min: 1,
    max: 50,
  });
}

export function getWebsiteImportJsFallbackConfig() {
  return {
    enabled: normalizeBooleanEnv(process.env.WEBSITE_IMPORT_JS_FALLBACK_ENABLED, false),
    timeoutMs: normalizeIntegerEnv(process.env.WEBSITE_IMPORT_JS_FALLBACK_TIMEOUT_MS, 8000, {
      min: 1000,
      max: 15000,
    }),
    maxHtmlBytes: normalizeIntegerEnv(process.env.WEBSITE_IMPORT_JS_FALLBACK_MAX_BYTES, 1_500_000, {
      min: 100_000,
      max: 2_000_000,
    }),
  };
}

export function getRagConfig() {
  const minSimilarity = getRagMinSimilarity();

  return {
    embeddingsEnabled: isRagEmbeddingsEnabled(),
    embeddingModel: getRagEmbeddingModel(),
    embeddingDimensions: getRagEmbeddingDimensions(),
    maxContextChunks: getRagMaxContextChunks(),
    minSimilarity,
    strongSimilarity: Math.min(0.9, Math.max(0.45, minSimilarity + 0.2)),
    maxChunkChars: getRagMaxChunkChars(),
    chunkOverlapChars: getRagChunkOverlapChars(),
  };
}

export function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "");
}

export function getGoogleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || "");
}

export function getGoogleOAuthRedirectUri() {
  return String(
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${getPublicAppUrl()}/google/oauth/callback`
  ).replace(/\/$/, "");
}

export function getGoogleTokenEncryptionSecret() {
  return String(process.env.GOOGLE_TOKEN_ENCRYPTION_SECRET || "");
}

export function getBookingWebhookEncryptionSecret() {
  return String(process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET || "");
}

export function listMissingGoogleOperatorEnvVars() {
  const requiredKeys = [
    ["GOOGLE_CLIENT_ID", getGoogleClientId()],
    ["GOOGLE_CLIENT_SECRET", getGoogleClientSecret()],
    ["GOOGLE_OAUTH_REDIRECT_URI", process.env.GOOGLE_OAUTH_REDIRECT_URI],
    ["GOOGLE_TOKEN_ENCRYPTION_SECRET", getGoogleTokenEncryptionSecret()],
  ];

  return requiredKeys
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);
}

export function isOperatorWorkspaceV1Enabled() {
  return normalizeBooleanEnv(process.env.VONZA_OPERATOR_WORKSPACE_V1, false);
}

export function isTodayCopilotEnabled() {
  return normalizeBooleanEnv(process.env.VONZA_TODAY_COPILOT_V1, false);
}

export function getBuildSha() {
  return String(
    process.env.RENDER_GIT_COMMIT
    || process.env.SOURCE_VERSION
    || process.env.COMMIT_SHA
    || ""
  ).trim();
}

export function getAppVersion() {
  return String(process.env.npm_package_version || "1.0.0").trim();
}

export function isProductionRuntime(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  const deployEnv = String(env.VONZA_DEPLOY_ENV || "").trim().toLowerCase();

  return nodeEnv === "production" || deployEnv === "production";
}

export function isDevFakeBillingEnabled() {
  return String(process.env.DEV_FAKE_BILLING || "").trim().toLowerCase() === "true";
}

export function isTempInstantWorkspaceAccessEnabled() {
  return normalizeBooleanEnv(process.env.TEMP_INSTANT_WORKSPACE_ACCESS, false);
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "0.0.0.0"
    || normalized === "::1"
    || normalized.endsWith(".local");
}

function getHostnameFromUrl(value) {
  try {
    return new URL(String(value || "")).hostname;
  } catch {
    return "";
  }
}

export function isLocalDevBillingRequestAllowed(req) {
  if (!isDevFakeBillingEnabled()) {
    return false;
  }

  if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
    return false;
  }

  const configuredHost = getHostnameFromUrl(process.env.PUBLIC_APP_URL);

  if (configuredHost && isLocalHostname(configuredHost)) {
    return true;
  }

  const requestHost = req?.hostname || String(req?.headers?.host || "").split(":")[0];
  return isLocalHostname(requestHost);
}
