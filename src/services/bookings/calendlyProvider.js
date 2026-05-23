import { createHmac, timingSafeEqual } from "node:crypto";

import { cleanText } from "../../utils/text.js";

const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function getHeaderValue(headers = {}, name = "") {
  const normalizedName = cleanText(name).toLowerCase();
  const direct = headers[name] || headers[normalizedName];

  if (Array.isArray(direct)) {
    return cleanText(direct[0]);
  }

  if (direct) {
    return cleanText(direct);
  }

  const match = Object.entries(headers || {}).find(
    ([key]) => cleanText(key).toLowerCase() === normalizedName
  );
  const value = match?.[1];

  return Array.isArray(value) ? cleanText(value[0]) : cleanText(value);
}

function parseSignatureHeader(value = "") {
  const normalized = cleanText(value);

  if (!normalized) {
    return {
      timestamp: "",
      signatures: [],
    };
  }

  if (!normalized.includes("=")) {
    return {
      timestamp: "",
      signatures: [normalized],
    };
  }

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  const signatures = [];
  let timestamp = "";

  parts.forEach((part) => {
    const [key, ...rest] = part.split("=");
    const normalizedKey = cleanText(key).toLowerCase();
    const valuePart = cleanText(rest.join("="));

    if (normalizedKey === "t") {
      timestamp = valuePart;
    } else if (normalizedKey === "v1" || normalizedKey === "signature") {
      signatures.push(valuePart);
    }
  });

  return {
    timestamp,
    signatures,
  };
}

function timestampToMs(value = "") {
  const numeric = Number(cleanText(value));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return NaN;
  }

  return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
}

function assertFreshTimestamp(timestamp, options = {}) {
  if (!timestamp) {
    return;
  }

  const timestampMs = timestampToMs(timestamp);
  const toleranceSeconds = Number(
    options.toleranceSeconds || DEFAULT_SIGNATURE_TOLERANCE_SECONDS
  );
  const nowMs = Number(options.nowMs || Date.now());

  if (!Number.isFinite(timestampMs)) {
    const error = new Error("Invalid Calendly webhook timestamp.");
    error.statusCode = 400;
    error.code = "calendly_webhook_stale";
    throw error;
  }

  if (Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) {
    const error = new Error("Calendly webhook timestamp is stale.");
    error.statusCode = 400;
    error.code = "calendly_webhook_stale";
    throw error;
  }
}

function safeCompareHex(left = "", right = "") {
  const normalizedLeft = cleanText(left).toLowerCase();
  const normalizedRight = cleanText(right).toLowerCase();

  if (!/^[a-f0-9]+$/i.test(normalizedLeft) || !/^[a-f0-9]+$/i.test(normalizedRight)) {
    return false;
  }

  const leftBuffer = Buffer.from(normalizedLeft, "hex");
  const rightBuffer = Buffer.from(normalizedRight, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSignedPayload(rawBody, timestamp = "") {
  return timestamp ? Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    rawBody,
  ]) : rawBody;
}

export function getCalendlySignatureHeader(headers = {}) {
  return getHeaderValue(headers, "calendly-webhook-signature")
    || getHeaderValue(headers, "x-calendly-webhook-signature");
}

export function verifyCalendlyWebhookSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
  nowMs,
  toleranceSeconds,
} = {}) {
  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ""), "utf8");
  const secret = cleanText(webhookSecret);
  const parsed = parseSignatureHeader(signatureHeader);

  if (!bodyBuffer.length || !secret || !parsed.signatures.length) {
    const error = new Error("Missing Calendly webhook signature.");
    error.statusCode = 400;
    error.code = "calendly_webhook_signature_missing";
    throw error;
  }

  assertFreshTimestamp(parsed.timestamp, { nowMs, toleranceSeconds });

  const expected = createHmac("sha256", secret)
    .update(buildSignedPayload(bodyBuffer, parsed.timestamp))
    .digest("hex");
  const valid = parsed.signatures.some((candidate) => safeCompareHex(candidate, expected));

  if (!valid) {
    const error = new Error("Invalid Calendly webhook signature.");
    error.statusCode = 400;
    error.code = "calendly_webhook_signature_invalid";
    throw error;
  }

  return {
    ok: true,
    timestamp: parsed.timestamp,
  };
}

function readPayloadContainer(event = {}) {
  return event && typeof event === "object" && event.payload && typeof event.payload === "object"
    ? event.payload
    : {};
}

export function parseCalendlyWebhookEvent(rawBody) {
  const bodyText = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody || "");

  try {
    const event = JSON.parse(bodyText);
    const payload = readPayloadContainer(event);
    const eventType = cleanText(event.event || event.type || payload.event_type || payload.event);
    const inviteeUri = cleanText(payload.uri || payload.invitee?.uri || event.uri);
    const scheduledEventUri = cleanText(
      payload.scheduled_event?.uri
      || payload.event?.uri
      || payload.event_uri
      || payload.scheduled_event_uri
    );
    const eventTypeUri = cleanText(
      payload.event_type?.uri
      || payload.scheduled_event?.event_type
      || payload.event_type
    );

    return {
      event,
      payload,
      eventType,
      inviteeUri,
      scheduledEventUri,
      eventTypeUri,
      providerEventId: inviteeUri || cleanText(event.uuid || event.id),
      occurredAt: cleanText(event.created_at || payload.created_at || payload.created_at_utc),
    };
  } catch {
    const error = new Error("Calendly webhook payload is invalid.");
    error.statusCode = 400;
    error.code = "calendly_webhook_payload_invalid";
    throw error;
  }
}
