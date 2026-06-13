import { createHash } from "node:crypto";

import {
  ORDER_ACTION_AUDIT_LOG_TABLE,
  ORDER_ACTION_REQUEST_TABLE,
  ORDER_VERIFICATION_SESSION_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { getCommerceProviderAdapter } from "./commerceProviderRegistry.js";
import {
  getAgentOrderSupportSettings,
  isOrderSupportProviderReady,
} from "./orderSupportSettingsService.js";

const ORDER_CHANGE_ACTION_TYPES = Object.freeze([
  "shipping_address",
  "contact_info",
  "cancellation",
  "delivery_note",
  "item_change",
]);
const ORDER_ACTION_REQUEST_STATUSES = Object.freeze([
  "pending",
  "needs_staff_review",
  "applied",
  "rejected",
  "cancelled",
  "failed",
]);
const ORDER_VERIFICATION_STATUSES = Object.freeze([
  "verified",
  "failed",
  "expired",
]);
const AUDIT_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "verification_session_id",
  "order_action_request_id",
  "provider",
  "external_order_id",
  "order_number_hash",
  "event_type",
  "actor_type",
  "outcome",
  "metadata",
  "created_at",
].join(", ");
const VERIFICATION_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "provider",
  "external_order_id",
  "order_number_hash",
  "verification_identifier_hash",
  "visitor_session_key",
  "status",
  "expires_at",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");
const ACTION_REQUEST_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "verification_session_id",
  "provider",
  "external_order_id",
  "order_number_hash",
  "action_type",
  "status",
  "requested_change",
  "customer_context",
  "provider_result",
  "staff_notes",
  "status_reason",
  "evidence",
  "metadata",
  "idempotency_key",
  "created_at",
  "updated_at",
].join(", ");

function buildOrderSupportError(message, statusCode = 400, code = "order_support_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isMissingOrderSupportRuntimeSchemaError(error = {}) {
  const message = cleanText(error.message || "").toLowerCase();
  return (
    error.code === "PGRST205"
    || error.code === "PGRST204"
    || error.code === "42P01"
    || message.includes(ORDER_VERIFICATION_SESSION_TABLE)
    || message.includes(ORDER_ACTION_REQUEST_TABLE)
    || message.includes(ORDER_ACTION_AUDIT_LOG_TABLE)
  );
}

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function requireCleanText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildOrderSupportError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeActionType(value = "") {
  const normalized = cleanInputText(value).toLowerCase();

  if (!ORDER_CHANGE_ACTION_TYPES.includes(normalized)) {
    throw buildOrderSupportError(
      `Unsupported order change action '${cleanInputText(value)}'.`,
      400,
      "unsupported_order_change_action"
    );
  }

  return normalized;
}

function hashPrivateLookupValue(value = "") {
  const normalized = cleanInputText(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  return createHash("sha256").update(normalized).digest("hex");
}

function buildIdempotencyKey({
  ownerUserId,
  agentId,
  visitorSessionKey,
  externalOrderId,
  actionType,
  requestedChange,
}) {
  const basis = [
    cleanInputText(ownerUserId),
    cleanInputText(agentId),
    cleanInputText(visitorSessionKey) || "no-session",
    cleanInputText(externalOrderId),
    cleanInputText(actionType),
    JSON.stringify(normalizePlainObject(requestedChange)),
  ].join(":");
  const digest = createHash("sha256").update(basis).digest("hex").slice(0, 32);

  return `order-action:${digest}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function mapVerificationRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: cleanInputText(row.id),
    ownerUserId: cleanInputText(row.owner_user_id),
    agentId: cleanInputText(row.agent_id),
    businessId: cleanInputText(row.business_id),
    provider: cleanInputText(row.provider),
    externalOrderId: cleanInputText(row.external_order_id),
    orderNumberHash: cleanInputText(row.order_number_hash),
    verificationIdentifierHash: cleanInputText(row.verification_identifier_hash),
    visitorSessionKey: cleanInputText(row.visitor_session_key),
    status: cleanInputText(row.status),
    expiresAt: row.expires_at || null,
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapActionRequestRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: cleanInputText(row.id),
    ownerUserId: cleanInputText(row.owner_user_id),
    agentId: cleanInputText(row.agent_id),
    businessId: cleanInputText(row.business_id),
    verificationSessionId: cleanInputText(row.verification_session_id),
    provider: cleanInputText(row.provider),
    externalOrderId: cleanInputText(row.external_order_id),
    orderNumberHash: cleanInputText(row.order_number_hash),
    actionType: cleanInputText(row.action_type),
    status: cleanInputText(row.status),
    requestedChange: normalizePlainObject(row.requested_change),
    customerContext: normalizePlainObject(row.customer_context),
    providerResult: normalizePlainObject(row.provider_result),
    staffNotes: cleanInputText(row.staff_notes),
    statusReason: cleanInputText(row.status_reason),
    evidence: normalizePlainObject(row.evidence),
    metadata: normalizePlainObject(row.metadata),
    idempotencyKey: cleanInputText(row.idempotency_key),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function sanitizeOrderForCustomer(order = {}) {
  return {
    orderNumber: cleanInputText(order.orderNumber),
    externalOrderId: cleanInputText(order.externalOrderId),
    status: cleanInputText(order.fulfillmentStatus || order.shippingStatus || "received"),
    financialStatus: cleanInputText(order.financialStatus),
    fulfillmentStatus: cleanInputText(order.fulfillmentStatus),
    shippingStatus: cleanInputText(order.shippingStatus),
    trackingNumber: cleanInputText(order.trackingNumber),
    trackingUrl: cleanInputText(order.trackingUrl),
    carrier: cleanInputText(order.carrier),
    orderStatusUrl: cleanInputText(order.orderStatusUrl),
    itemsSummary: Array.isArray(order.itemsSummary) ? order.itemsSummary : [],
    shippingAddressSummary: cleanInputText(order.shippingAddressSummary),
  };
}

function resolveBusinessId(settings = {}, options = {}) {
  return cleanInputText(options.businessId || options.business_id || settings.businessId);
}

async function createVerificationSession(supabase, {
  ownerUserId,
  agentId,
  businessId,
  provider,
  orderNumber,
  emailOrPhone,
  visitorSessionKey,
  externalOrderId = "",
  status,
  metadata = {},
  now = new Date(),
}) {
  const normalizedStatus = cleanInputText(status).toLowerCase();

  if (!ORDER_VERIFICATION_STATUSES.includes(normalizedStatus)) {
    throw buildOrderSupportError("Unsupported verification status.", 400, "unsupported_order_verification_status");
  }

  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: businessId || null,
    provider,
    external_order_id: normalizeOptionalText(externalOrderId),
    order_number_hash: hashPrivateLookupValue(orderNumber) || null,
    verification_identifier_hash: hashPrivateLookupValue(emailOrPhone) || null,
    visitor_session_key: normalizeOptionalText(visitorSessionKey),
    status: normalizedStatus,
    expires_at: addMinutes(now, 30).toISOString(),
    metadata: normalizePlainObject(metadata),
    updated_at: now.toISOString(),
  };
  const { data, error } = await supabase
    .from(ORDER_VERIFICATION_SESSION_TABLE)
    .insert(payload)
    .select(VERIFICATION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapVerificationRow(data);
}

async function createAuditLog(supabase, {
  ownerUserId,
  agentId,
  businessId,
  verificationSessionId = "",
  orderActionRequestId = "",
  provider,
  externalOrderId = "",
  orderNumber = "",
  eventType,
  actorType = "assistant",
  outcome,
  metadata = {},
}) {
  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: businessId || null,
    verification_session_id: normalizeOptionalText(verificationSessionId),
    order_action_request_id: normalizeOptionalText(orderActionRequestId),
    provider,
    external_order_id: normalizeOptionalText(externalOrderId),
    order_number_hash: hashPrivateLookupValue(orderNumber) || null,
    event_type: requireCleanText(eventType, "event_type"),
    actor_type: cleanInputText(actorType) || "assistant",
    outcome: cleanInputText(outcome) || "recorded",
    metadata: normalizePlainObject(metadata),
  };
  const { data, error } = await supabase
    .from(ORDER_ACTION_AUDIT_LOG_TABLE)
    .insert(payload)
    .select(AUDIT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function buildUnavailableResult(reason, settings = {}) {
  return {
    handled: true,
    status: reason,
    provider: cleanInputText(settings.provider || "internal"),
    providerStatus: cleanInputText(settings.providerStatus || "needs_setup"),
    verified: false,
    revealOrderDetails: false,
  };
}

async function resolveOrderSupportRuntime(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const settings = await getAgentOrderSupportSettings(supabase, {
    ownerUserId,
    agentId,
  });
  const businessId = resolveBusinessId(settings, options);

  if (!settings.persistenceAvailable) {
    return {
      ownerUserId,
      agentId,
      settings,
      businessId,
      adapter: null,
      unavailable: "schema_unavailable",
    };
  }

  if (settings.enabled !== true) {
    return {
      ownerUserId,
      agentId,
      settings,
      businessId,
      adapter: null,
      unavailable: "not_enabled",
    };
  }

  if (!isOrderSupportProviderReady(settings)) {
    return {
      ownerUserId,
      agentId,
      settings,
      businessId,
      adapter: null,
      unavailable: "provider_unavailable",
    };
  }

  const adapter = getCommerceProviderAdapter(settings.provider);

  if (!adapter) {
    return {
      ownerUserId,
      agentId,
      settings,
      businessId,
      adapter: null,
      unavailable: "provider_unavailable",
    };
  }

  return {
    ownerUserId,
    agentId,
    settings,
    businessId,
    adapter,
    unavailable: "",
  };
}

async function verifyOrderForRequest(supabase, runtime, options = {}) {
  const orderNumber = cleanInputText(options.orderNumber || options.order_number);
  const emailOrPhone = cleanInputText(options.emailOrPhone || options.email_or_phone);
  const visitorSessionKey = cleanInputText(options.visitorSessionKey || options.visitor_session_key);
  const { ownerUserId, agentId, businessId, settings, adapter } = runtime;

  if (!orderNumber || !emailOrPhone) {
    const verificationSession = await createVerificationSession(supabase, {
      ownerUserId,
      agentId,
      businessId,
      provider: settings.provider,
      orderNumber,
      emailOrPhone,
      visitorSessionKey,
      status: "failed",
      metadata: {
        reason: "missing_order_number_or_identifier",
      },
    });

    await createAuditLog(supabase, {
      ownerUserId,
      agentId,
      businessId,
      verificationSessionId: verificationSession.id,
      provider: settings.provider,
      orderNumber,
      eventType: "order_lookup_verification_failed",
      actorType: "customer",
      outcome: "missing_verification",
    });

    return {
      verified: false,
      status: "needs_verification",
      verificationSession,
    };
  }

  const providerResult = await adapter.findOrder({
    supabase,
    ownerUserId,
    businessId,
    provider: settings.provider,
    orderNumber,
    emailOrPhone,
  });
  const verificationStatus = providerResult?.verificationPassed ? "verified" : "failed";
  const verificationSession = await createVerificationSession(supabase, {
    ownerUserId,
    agentId,
    businessId,
    provider: settings.provider,
    orderNumber,
    emailOrPhone,
    visitorSessionKey,
    externalOrderId: providerResult?.order?.externalOrderId,
    status: verificationStatus,
    metadata: {
      reason: cleanInputText(providerResult?.reason),
      provider_found_order: providerResult?.found === true,
    },
  });

  await createAuditLog(supabase, {
    ownerUserId,
    agentId,
    businessId,
    verificationSessionId: verificationSession.id,
    provider: settings.provider,
    externalOrderId: providerResult?.order?.externalOrderId,
    orderNumber,
    eventType: providerResult?.verificationPassed
      ? "order_lookup_verified"
      : "order_lookup_verification_failed",
    actorType: "customer",
    outcome: providerResult?.verificationPassed ? "verified" : "failed",
    metadata: {
      reason: cleanInputText(providerResult?.reason),
      provider_found_order: providerResult?.found === true,
    },
  });

  if (!providerResult?.verificationPassed || !providerResult?.order) {
    return {
      verified: false,
      status: providerResult?.found ? "verification_failed" : "order_not_found",
      verificationSession,
    };
  }

  return {
    verified: true,
    status: "verified",
    verificationSession,
    order: providerResult.order,
  };
}

export async function lookupOrderStatus(supabase, options = {}) {
  const runtime = await resolveOrderSupportRuntime(supabase, options);
  const { settings, ownerUserId, agentId, businessId } = runtime;

  if (runtime.unavailable) {
    if (runtime.unavailable !== "schema_unavailable") {
      try {
        await createAuditLog(supabase, {
          ownerUserId,
          agentId,
          businessId,
          provider: settings.provider,
          orderNumber: options.orderNumber || options.order_number,
          eventType: "order_lookup_provider_unavailable",
          actorType: "customer",
          outcome: runtime.unavailable,
          metadata: {
            provider_status: settings.providerStatus,
          },
        });
      } catch (error) {
        if (!isMissingOrderSupportRuntimeSchemaError(error)) {
          throw error;
        }
      }
    }

    return buildUnavailableResult(runtime.unavailable, settings);
  }

  const verified = await verifyOrderForRequest(supabase, runtime, options);

  if (!verified.verified) {
    return {
      handled: true,
      status: verified.status,
      provider: settings.provider,
      verified: false,
      revealOrderDetails: false,
    };
  }

  const fulfillment = typeof runtime.adapter.getFulfillmentStatus === "function"
    ? await runtime.adapter.getFulfillmentStatus({
        supabase,
        ownerUserId,
        businessId,
        externalOrderId: verified.order.externalOrderId,
      })
    : null;

  return {
    handled: true,
    status: "verified",
    provider: settings.provider,
    verified: true,
    revealOrderDetails: true,
    order: sanitizeOrderForCustomer({
      ...verified.order,
      ...(fulfillment || {}),
    }),
    verificationSession: {
      id: verified.verificationSession.id,
      expiresAt: verified.verificationSession.expiresAt,
    },
  };
}

async function findExistingActionRequest(supabase, { ownerUserId, agentId, idempotencyKey }) {
  if (!cleanInputText(idempotencyKey)) {
    return null;
  }

  const { data, error } = await supabase
    .from(ORDER_ACTION_REQUEST_TABLE)
    .select(ACTION_REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("agent_id", agentId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapActionRequestRow(data);
}

async function createOrderActionRequest(supabase, {
  ownerUserId,
  agentId,
  businessId,
  verificationSessionId,
  provider,
  externalOrderId,
  orderNumber,
  actionType,
  status,
  requestedChange,
  customerContext,
  providerResult,
  statusReason,
  evidence,
  metadata,
  idempotencyKey,
}) {
  const normalizedStatus = cleanInputText(status).toLowerCase() || "pending";

  if (!ORDER_ACTION_REQUEST_STATUSES.includes(normalizedStatus)) {
    throw buildOrderSupportError("Unsupported order action request status.", 400, "unsupported_order_action_status");
  }

  const existing = await findExistingActionRequest(supabase, {
    ownerUserId,
    agentId,
    idempotencyKey,
  });

  if (existing) {
    return existing;
  }

  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: businessId || null,
    verification_session_id: normalizeOptionalText(verificationSessionId),
    provider,
    external_order_id: normalizeOptionalText(externalOrderId),
    order_number_hash: hashPrivateLookupValue(orderNumber) || null,
    action_type: normalizeActionType(actionType),
    status: normalizedStatus,
    requested_change: normalizePlainObject(requestedChange),
    customer_context: normalizePlainObject(customerContext),
    provider_result: normalizePlainObject(providerResult),
    status_reason: normalizeOptionalText(statusReason),
    evidence: normalizePlainObject(evidence),
    metadata: normalizePlainObject(metadata),
    idempotency_key: normalizeOptionalText(idempotencyKey),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(ORDER_ACTION_REQUEST_TABLE)
    .insert(payload)
    .select(ACTION_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapActionRequestRow(data);
}

function settingSupportsAction(settings = {}, actionType = "") {
  const supportedActions = Array.isArray(settings.supportedActions) ? settings.supportedActions : [];

  return supportedActions.includes(actionType);
}

export async function submitOrderChangeRequest(supabase, options = {}) {
  const runtime = await resolveOrderSupportRuntime(supabase, options);
  const { settings, ownerUserId, agentId, businessId } = runtime;
  const actionType = normalizeActionType(options.actionType || options.action_type);

  if (runtime.unavailable) {
    return buildUnavailableResult(runtime.unavailable, settings);
  }

  if (settings.approvalMode === "read_only") {
    await createAuditLog(supabase, {
      ownerUserId,
      agentId,
      businessId,
      provider: settings.provider,
      orderNumber: options.orderNumber || options.order_number,
      eventType: "order_change_rejected",
      actorType: "customer",
      outcome: "read_only_mode",
      metadata: { action_type: actionType },
    });

    return {
      handled: true,
      status: "not_allowed",
      provider: settings.provider,
      verified: false,
      revealOrderDetails: false,
      reason: "read_only_mode",
    };
  }

  if (!settingSupportsAction(settings, actionType)) {
    await createAuditLog(supabase, {
      ownerUserId,
      agentId,
      businessId,
      provider: settings.provider,
      orderNumber: options.orderNumber || options.order_number,
      eventType: "order_change_rejected",
      actorType: "customer",
      outcome: "unsupported_action",
      metadata: { action_type: actionType },
    });

    return {
      handled: true,
      status: "not_allowed",
      provider: settings.provider,
      verified: false,
      revealOrderDetails: false,
      reason: "unsupported_action",
    };
  }

  const verified = await verifyOrderForRequest(supabase, runtime, options);

  if (!verified.verified) {
    return {
      handled: true,
      status: verified.status,
      provider: settings.provider,
      verified: false,
      revealOrderDetails: false,
    };
  }

  const requestedChange = normalizePlainObject(options.requestedChange || options.requested_change);
  const customerContext = normalizePlainObject(options.customer || options.customerContext || options.customer_context);
  const validation = typeof runtime.adapter.validateRequestedChange === "function"
    ? runtime.adapter.validateRequestedChange({
        order: verified.order,
        change: {
          actionType,
          requestedChange,
        },
        settings,
      })
    : { decision: "requires_staff_review", reason: "provider_validation_unavailable" };
  const requiresStaffApproval = validation.decision !== "pending_request";
  const requestStatus = requiresStaffApproval ? "needs_staff_review" : "pending";
  const idempotencyKey = cleanInputText(options.idempotencyKey || options.idempotency_key)
    || buildIdempotencyKey({
      ownerUserId,
      agentId,
      visitorSessionKey: options.visitorSessionKey || options.visitor_session_key,
      externalOrderId: verified.order.externalOrderId,
      actionType,
      requestedChange,
    });
  const actionRequest = await createOrderActionRequest(supabase, {
    ownerUserId,
    agentId,
    businessId,
    verificationSessionId: verified.verificationSession.id,
    provider: settings.provider,
    externalOrderId: verified.order.externalOrderId,
    orderNumber: options.orderNumber || options.order_number,
    actionType,
    status: requestStatus,
    requestedChange,
    customerContext,
    providerResult: {
      provider_applied: false,
      validation_decision: validation.decision,
      validation_reason: validation.reason,
    },
    statusReason: validation.reason,
    evidence: {
      proof_source_type: "verified_customer_request",
      verification_session_id: verified.verificationSession.id,
    },
    metadata: {
      source: cleanInputText(options.source) || "public_chat",
      approval_mode: settings.approvalMode,
    },
    idempotencyKey,
  });

  await createAuditLog(supabase, {
    ownerUserId,
    agentId,
    businessId,
    verificationSessionId: verified.verificationSession.id,
    orderActionRequestId: actionRequest.id,
    provider: settings.provider,
    externalOrderId: verified.order.externalOrderId,
    orderNumber: options.orderNumber || options.order_number,
    eventType: "order_change_request_created",
    actorType: "customer",
    outcome: requestStatus,
    metadata: {
      action_type: actionType,
      validation_decision: validation.decision,
      validation_reason: validation.reason,
    },
  });

  return {
    handled: true,
    status: requestStatus,
    provider: settings.provider,
    verified: true,
    revealOrderDetails: false,
    requiresStaffApproval,
    actionRequest: {
      created: true,
      status: actionRequest.status,
      actionType,
    },
    order: {
      orderNumber: cleanInputText(verified.order.orderNumber),
      fulfillmentStatus: cleanInputText(verified.order.fulfillmentStatus),
      shippingStatus: cleanInputText(verified.order.shippingStatus),
    },
    reason: validation.reason,
  };
}

export const ORDER_SUPPORT_RUNTIME_OPTIONS = Object.freeze({
  actionTypes: ORDER_CHANGE_ACTION_TYPES,
  requestStatuses: ORDER_ACTION_REQUEST_STATUSES,
  verificationStatuses: ORDER_VERIFICATION_STATUSES,
});
