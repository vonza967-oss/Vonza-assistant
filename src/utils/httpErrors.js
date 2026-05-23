import { cleanText } from "./text.js";

const DEFAULT_SAFE_MESSAGE = "Something went wrong. Please try again.";
const PUBLIC_STATUS_MESSAGES = Object.freeze({
  400: "The request could not be processed.",
  401: "Authentication is required.",
  403: "You do not have access to this resource.",
  404: "The requested resource was not found.",
  409: "The request conflicts with the current state.",
  413: "The request is too large.",
  429: "Too many requests. Please try again shortly.",
  503: "This service is temporarily unavailable. Please try again shortly.",
});

export function getRequestId(req) {
  return cleanText(req?.headers?.["x-request-id"])
    || cleanText(req?.headers?.["x-correlation-id"])
    || "";
}

export function getSafeStatusCode(error) {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  return Number.isFinite(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}

export function getSafeErrorMessage(error, { publicSurface = false } = {}) {
  const statusCode = getSafeStatusCode(error);
  const publicMessage = cleanText(error?.publicMessage);

  if (publicMessage) {
    return publicMessage;
  }

  if (!publicSurface && statusCode < 500) {
    return cleanText(error?.message) || PUBLIC_STATUS_MESSAGES[statusCode] || DEFAULT_SAFE_MESSAGE;
  }

  return PUBLIC_STATUS_MESSAGES[statusCode] || DEFAULT_SAFE_MESSAGE;
}

export function logRouteError(error, req, context = {}) {
  const statusCode = getSafeStatusCode(error);
  const payload = {
    method: req?.method,
    path: req?.originalUrl || req?.url,
    statusCode,
    code: cleanText(error?.code),
    requestId: getRequestId(req) || null,
    ...context,
  };

  if (statusCode >= 500) {
    console.error("[route] request failed", payload, error);
    return;
  }

  console.warn("[route] request rejected", {
    ...payload,
    message: cleanText(error?.message),
  });
}

export function sendJsonError(res, error, options = {}) {
  const statusCode = getSafeStatusCode(error);
  const body = {
    error: getSafeErrorMessage(error, options),
  };
  const code = cleanText(error?.code);

  if (code) {
    body.code = code;
  }

  if (options.requestId) {
    body.requestId = options.requestId;
  }

  res.status(statusCode).json(body);
}
