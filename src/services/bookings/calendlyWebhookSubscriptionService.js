import { cleanText } from "../../utils/text.js";

const DEFAULT_CALENDLY_API_BASE_URL = "https://api.calendly.com";
const DEFAULT_CALENDLY_WEBHOOK_EVENTS = Object.freeze([
  "invitee.created",
  "invitee.canceled",
]);

function buildCalendlySubscriptionError(
  message,
  statusCode = 400,
  code = "calendly_webhook_subscription_invalid"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeCalendlyScope(value, { organizationUri, userUri } = {}) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized === "organization" || normalized === "user") {
    return normalized;
  }

  return organizationUri && !userUri ? "organization" : "user";
}

function getCalendlyUriId(uri) {
  const value = cleanText(uri).replace(/\/$/, "");
  const id = value.split("/").pop() || "";

  return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function getCalendlyApiBaseUrl(env = process.env) {
  return cleanText(env.CALENDLY_API_BASE_URL) || DEFAULT_CALENDLY_API_BASE_URL;
}

export function getCalendlyWebhookSubscriptionConfig(env = process.env) {
  const accessToken = cleanText(
    env.CALENDLY_PERSONAL_ACCESS_TOKEN
    || env.CALENDLY_API_TOKEN
    || env.CALENDLY_ACCESS_TOKEN
  );
  const organizationUri = cleanText(env.CALENDLY_ORGANIZATION_URI);
  const userUri = cleanText(env.CALENDLY_USER_URI);
  const scope = normalizeCalendlyScope(env.CALENDLY_WEBHOOK_SCOPE, {
    organizationUri,
    userUri,
  });
  const missing = [];

  if (!accessToken) {
    missing.push("CALENDLY_PERSONAL_ACCESS_TOKEN");
  }

  if (scope === "organization" && !organizationUri) {
    missing.push("CALENDLY_ORGANIZATION_URI");
  }

  if (scope === "user" && !userUri) {
    missing.push("CALENDLY_USER_URI");
  }

  return {
    configured: missing.length === 0,
    missing,
    accessToken,
    organizationUri,
    userUri,
    scope,
    apiBaseUrl: getCalendlyApiBaseUrl(env),
  };
}

export function isCalendlyWebhookSubscriptionConfigured(env = process.env) {
  return getCalendlyWebhookSubscriptionConfig(env).configured;
}

function buildCalendlyWebhookSubscriptionPayload({
  webhookUrl,
  signingKey,
  config,
  events = DEFAULT_CALENDLY_WEBHOOK_EVENTS,
}) {
  const payload = {
    url: cleanText(webhookUrl),
    events: [...events],
    scope: config.scope,
    signing_key: cleanText(signingKey),
  };

  if (config.organizationUri) {
    payload.organization = config.organizationUri;
  }

  if (config.scope === "user") {
    payload.user = config.userUri;
  }

  return payload;
}

function sanitizeCalendlyWebhookSubscription(resource = {}, config = {}) {
  const events = Array.isArray(resource.events)
    ? resource.events.map((eventName) => cleanText(eventName)).filter(Boolean)
    : DEFAULT_CALENDLY_WEBHOOK_EVENTS;
  const organizationUri = cleanText(resource.organization || config.organizationUri);
  const userUri = cleanText(resource.user || config.userUri);
  const subscriptionUri = cleanText(resource.uri || resource.url);

  return {
    provider: "calendly",
    subscriptionId: getCalendlyUriId(subscriptionUri),
    organizationId: getCalendlyUriId(organizationUri),
    userId: getCalendlyUriId(userUri),
    scope: cleanText(resource.scope || config.scope),
    events,
  };
}

export async function createCalendlyWebhookSubscription(input = {}, deps = {}) {
  const env = deps.env || process.env;
  const config = getCalendlyWebhookSubscriptionConfig(env);
  const webhookUrl = cleanText(input.webhookUrl || input.webhook_url);
  const signingKey = cleanText(input.signingKey || input.signing_key);
  const fetchImpl = deps.fetch || globalThis.fetch;

  if (!config.configured) {
    throw buildCalendlySubscriptionError(
      "Calendly provider onboarding is not configured on this deployment.",
      503,
      "calendly_provider_not_configured"
    );
  }

  if (!webhookUrl) {
    throw buildCalendlySubscriptionError("Calendly webhook URL is required.");
  }

  if (!signingKey) {
    throw buildCalendlySubscriptionError("Calendly webhook signing key is required.");
  }

  if (typeof fetchImpl !== "function") {
    throw buildCalendlySubscriptionError("fetch is not available for Calendly provider setup.", 500);
  }

  const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/webhook_subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildCalendlyWebhookSubscriptionPayload({
      webhookUrl,
      signingKey,
      config,
      events: input.events,
    })),
  });
  const responseJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildCalendlySubscriptionError(
      "Calendly webhook subscription could not be created.",
      response.status || 502,
      "calendly_provider_subscription_failed"
    );
  }

  return sanitizeCalendlyWebhookSubscription(responseJson.resource || responseJson, config);
}
