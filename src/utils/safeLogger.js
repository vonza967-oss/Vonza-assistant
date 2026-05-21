const SECRET_KEY_PATTERN = /(service[_-]?role|supabase[_-]?service|openai|api[_-]?key|secret|token|authorization|password|stripe[_-]?secret|webhook[_-]?secret)/i;
const SENSITIVE_FIELD_PATTERN = /(message|answer|note|email|phone|contact|raw|body|payload|visitor|identity|authorization|token|secret|password)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const SECRET_VALUE_PATTERN = /\b(?:sk|sk-proj|pk|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

let installed = false;

function isDevelopmentLike() {
  const env = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return !env || env === "development" || env === "test";
}

export function redactString(value = "") {
  return String(value)
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SECRET_VALUE_PATTERN, "[redacted-secret]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, (match) => (match.replace(/\D/g, "").length >= 7 ? "[redacted-phone]" : match));
}

export function scrubLogValue(value, options = {}) {
  const depth = Number(options.depth || 0);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      code: value.code || undefined,
      statusCode: value.statusCode || undefined,
      stack: isDevelopmentLike() ? redactString(value.stack || "") : undefined,
    };
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (depth >= 4) {
    return "[redacted-nested]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => scrubLogValue(entry, { depth: depth + 1 }));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, "[redacted-secret]"];
      }

      if (!isDevelopmentLike() && SENSITIVE_FIELD_PATTERN.test(key)) {
        if (typeof entry === "string" || typeof entry === "number") {
          return [key, entry ? "[redacted]" : entry];
        }
      }

      return [key, scrubLogValue(entry, { depth: depth + 1 })];
    })
  );
}

export function installSafeConsole() {
  if (installed) {
    return;
  }

  installed = true;
  ["log", "info", "warn", "error"].forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args) => original(...args.map((arg) => scrubLogValue(arg)));
  });
}
