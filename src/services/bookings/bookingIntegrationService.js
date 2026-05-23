import { randomBytes } from "node:crypto";

import { getBookingWebhookEncryptionSecret } from "../../config/env.js";
import {
  BOOKING_INTEGRATION_TABLE,
  CONVERSION_OUTCOME_TABLE,
} from "../../config/constants.js";
import { decryptSecret, encryptSecret, hashToken } from "../../utils/crypto.js";
import { cleanText } from "../../utils/text.js";
import { recordOutcomeEvent } from "../conversion/conversionOutcomeService.js";
import {
  getCalendlySignatureHeader,
  parseCalendlyWebhookEvent,
  verifyCalendlyWebhookSignature,
} from "./calendlyProvider.js";

const BOOKING_INTEGRATION_SELECT = [
  "id",
  "agent_id",
  "owner_user_id",
  "provider",
  "status",
  "booking_url",
  "webhook_endpoint_token_hash",
  "webhook_secret_encrypted",
  "provider_account_id",
  "provider_event_type_id",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.code === "42P01" ||
    message.includes(`'public.${relationName}'`) ||
    message.includes(`${relationName} was not found`) ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

function buildWebhookError(message, statusCode = 400, code = "booking_webhook_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeStatus(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return ["pending", "active", "disabled", "needs_attention"].includes(normalized)
    ? normalized
    : "pending";
}

function mapIntegrationRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agent_id),
    ownerUserId: cleanText(row.owner_user_id),
    provider: cleanText(row.provider).toLowerCase() || "calendly",
    status: normalizeStatus(row.status),
    bookingUrl: cleanText(row.booking_url),
    webhookEndpointTokenHash: cleanText(row.webhook_endpoint_token_hash),
    webhookSecretEncrypted: cleanText(row.webhook_secret_encrypted),
    providerAccountId: cleanText(row.provider_account_id),
    providerEventTypeId: cleanText(row.provider_event_type_id),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  };
}

function getWebhookSecret(integration) {
  const encryptedSecret = cleanText(integration?.webhookSecretEncrypted);
  const encryptionSecret = getBookingWebhookEncryptionSecret();

  if (!encryptedSecret) {
    throw buildWebhookError("Calendly webhook secret is not configured.", 400);
  }

  if (!cleanText(encryptionSecret)) {
    throw buildWebhookError("BOOKING_WEBHOOK_ENCRYPTION_SECRET is not configured.", 500);
  }

  return decryptSecret(encryptedSecret, encryptionSecret);
}

function buildDedupeKey({ integration, parsedEvent }) {
  return [
    "booking_webhook",
    "calendly",
    cleanText(integration.id || integration.agentId),
    cleanText(parsedEvent.eventType),
    cleanText(parsedEvent.providerEventId),
  ].join("::");
}

async function getAgentRow(supabase, integration) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, business_id, owner_user_id, access_status, is_active")
    .eq("id", integration.agentId)
    .eq("owner_user_id", integration.ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getWidgetConfigRow(supabase, agentId) {
  const { data, error } = await supabase
    .from("widget_configs")
    .select("agent_id, install_id, booking_url")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "widget_configs")) {
      return null;
    }

    throw error;
  }

  return data || null;
}

async function resolveIntegrationByEndpointToken(supabase, token) {
  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from(BOOKING_INTEGRATION_TABLE)
    .select(BOOKING_INTEGRATION_SELECT)
    .eq("provider", "calendly")
    .eq("webhook_endpoint_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, BOOKING_INTEGRATION_TABLE)) {
      throw buildWebhookError("Booking integration schema is not ready.", 503, "schema_not_ready");
    }

    throw error;
  }

  return mapIntegrationRow(data);
}

async function hasExistingOutcome(supabase, dedupeKey) {
  const { data, error } = await supabase
    .from(CONVERSION_OUTCOME_TABLE)
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, CONVERSION_OUTCOME_TABLE)) {
      return false;
    }

    throw error;
  }

  return Boolean(data?.id);
}

function shouldIgnoreCalendlyEvent(parsedEvent, integration) {
  if (parsedEvent.eventType !== "invitee.created") {
    return "unsupported_event";
  }

  if (!parsedEvent.providerEventId) {
    return "missing_provider_event_id";
  }

  if (
    integration.providerEventTypeId
    && parsedEvent.eventTypeUri
    && integration.providerEventTypeId !== parsedEvent.eventTypeUri
  ) {
    return "event_type_mismatch";
  }

  return "";
}

export function createBookingWebhookEndpointToken() {
  return randomBytes(24).toString("base64url");
}

export function encryptBookingWebhookSecret(secret) {
  const encryptionSecret = getBookingWebhookEncryptionSecret();

  if (!cleanText(encryptionSecret)) {
    throw buildWebhookError("BOOKING_WEBHOOK_ENCRYPTION_SECRET is not configured.", 500);
  }

  return encryptSecret(secret, encryptionSecret);
}

export function hashBookingWebhookEndpointToken(token) {
  return hashToken(token);
}

export async function processCalendlyWebhook(supabase, input = {}) {
  const endpointToken = cleanText(input.endpointToken || input.token);
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(String(input.rawBody || ""), "utf8");

  if (!endpointToken) {
    throw buildWebhookError("Missing Calendly webhook endpoint token.", 404);
  }

  const integration = await resolveIntegrationByEndpointToken(supabase, endpointToken);

  if (!integration || integration.provider !== "calendly") {
    throw buildWebhookError("Calendly webhook endpoint was not found.", 404);
  }

  if (integration.status === "disabled" || integration.status === "needs_attention") {
    throw buildWebhookError("Calendly webhook endpoint is not active.", 403);
  }

  verifyCalendlyWebhookSignature({
    rawBody,
    signatureHeader: cleanText(input.signatureHeader) || getCalendlySignatureHeader(input.headers || {}),
    webhookSecret: getWebhookSecret(integration),
    nowMs: input.nowMs,
    toleranceSeconds: input.toleranceSeconds,
  });

  const parsedEvent = parseCalendlyWebhookEvent(rawBody);
  const ignoreReason = shouldIgnoreCalendlyEvent(parsedEvent, integration);

  if (ignoreReason) {
    return {
      ok: true,
      ignored: true,
      reason: ignoreReason,
      eventType: parsedEvent.eventType || "",
    };
  }

  const agent = await getAgentRow(supabase, integration);

  if (!agent || agent.is_active === false || cleanText(agent.access_status) !== "active") {
    throw buildWebhookError("Calendly webhook endpoint is not active.", 403);
  }

  const widgetConfig = await getWidgetConfigRow(supabase, integration.agentId);
  const dedupeKey = buildDedupeKey({ integration, parsedEvent });

  if (await hasExistingOutcome(supabase, dedupeKey)) {
    return {
      ok: true,
      duplicate: true,
      dedupeKey,
    };
  }

  const outcomeResult = await recordOutcomeEvent(supabase, {
    agentId: integration.agentId,
    businessId: agent.business_id,
    ownerUserId: integration.ownerUserId,
    installId: cleanText(widgetConfig?.install_id),
    outcomeType: "booking_confirmed",
    sourceType: "calendar_event",
    confirmationLevel: "confirmed",
    dedupeKey,
    sessionId: cleanText(parsedEvent.payload?.tracking?.utm_content),
    visitorId: cleanText(parsedEvent.payload?.tracking?.utm_source),
    targetUrl: integration.bookingUrl || cleanText(widgetConfig?.booking_url),
    successUrl: integration.bookingUrl || cleanText(widgetConfig?.booking_url),
    attributionPath: "calendar_booking",
    occurredAt: parsedEvent.occurredAt,
    metadata: {
      provider: "calendly",
      providerEventType: parsedEvent.eventType,
      providerEventId: parsedEvent.providerEventId,
      inviteeUri: parsedEvent.inviteeUri,
      scheduledEventUri: parsedEvent.scheduledEventUri,
      eventTypeUri: parsedEvent.eventTypeUri,
      integrationId: integration.id,
    },
  });

  return {
    ok: true,
    duplicate: false,
    dedupeKey,
    outcome: outcomeResult.outcome || null,
  };
}

function buildPublicStatus(row) {
  const integration = mapIntegrationRow(row);

  if (!integration) {
    return null;
  }

  const webhookConnected = integration.status === "active" && Boolean(integration.webhookSecretEncrypted);
  const state = integration.status === "needs_attention"
    ? "needs_attention"
    : webhookConnected
      ? "connected"
      : "not_connected";

  return {
    provider: integration.provider,
    status: integration.status,
    state,
    bookingUrl: integration.bookingUrl,
    webhookConnected,
    providerAccountId: integration.providerAccountId || null,
    providerEventTypeId: integration.providerEventTypeId || null,
    updatedAt: integration.updatedAt,
  };
}

export async function listBookingIntegrationStatusesByAgentIds(supabase, agentIds = []) {
  const ids = [...new Set(agentIds.map((agentId) => cleanText(agentId)).filter(Boolean))];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from(BOOKING_INTEGRATION_TABLE)
    .select(BOOKING_INTEGRATION_SELECT)
    .eq("provider", "calendly")
    .in("agent_id", ids);

  if (error) {
    if (isMissingRelationError(error, BOOKING_INTEGRATION_TABLE)) {
      return new Map();
    }

    throw error;
  }

  return new Map(
    (data || [])
      .map((row) => [row.agent_id, buildPublicStatus(row)])
      .filter(([, status]) => Boolean(status))
  );
}
