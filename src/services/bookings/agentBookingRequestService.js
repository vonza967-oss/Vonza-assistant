import { AGENT_BOOKING_REQUEST_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const AGENTS_TABLE = "agents";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export const BOOKING_REQUEST_STATUSES = Object.freeze([
  "request_received",
  "needs_info",
  "needs_staff_review",
  "offered",
  "confirmed_externally",
  "declined",
  "cancel_requested",
  "reschedule_requested",
  "cancelled_externally",
  "expired",
]);

const BOOKING_REQUEST_STATUS_SET = new Set(BOOKING_REQUEST_STATUSES);
const CREATE_STATUSES = new Set([
  "request_received",
  "needs_info",
  "needs_staff_review",
  "cancel_requested",
  "reschedule_requested",
]);
const PROOF_REQUIRED_STATUSES = new Set([
  "confirmed_externally",
  "cancelled_externally",
]);
const TRUSTED_PROOF_SOURCE_TYPES = new Set([
  "calendar_event",
  "success_url_match",
  "manual_owner",
  "operator_task",
  "calendly_webhook",
  "provider_event",
]);
const REQUEST_ONLY_PROOF_SOURCE_TYPES = new Set([
  "agent_action_request",
  "agent_contact_lead",
  "agent_conversion_outcome",
  "booking_intent",
  "booking_request",
  "booking_started",
  "lead",
  "request_only",
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  request_received: new Set([
    "needs_info",
    "needs_staff_review",
    "offered",
    "declined",
    "cancel_requested",
    "reschedule_requested",
    "expired",
  ]),
  needs_info: new Set([
    "request_received",
    "needs_staff_review",
    "declined",
    "expired",
  ]),
  needs_staff_review: new Set([
    "needs_info",
    "offered",
    "confirmed_externally",
    "declined",
    "cancel_requested",
    "reschedule_requested",
    "expired",
  ]),
  offered: new Set([
    "needs_info",
    "needs_staff_review",
    "confirmed_externally",
    "declined",
    "cancel_requested",
    "reschedule_requested",
    "expired",
  ]),
  cancel_requested: new Set([
    "needs_info",
    "needs_staff_review",
    "cancelled_externally",
    "declined",
    "expired",
  ]),
  reschedule_requested: new Set([
    "needs_info",
    "needs_staff_review",
    "offered",
    "confirmed_externally",
    "declined",
    "expired",
  ]),
  confirmed_externally: new Set([
    "cancel_requested",
    "reschedule_requested",
    "cancelled_externally",
  ]),
  declined: new Set(["request_received"]),
  expired: new Set(["request_received"]),
  cancelled_externally: new Set(["request_received", "reschedule_requested"]),
});

const BOOKING_REQUEST_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "visitor_session_key",
  "source_message_id",
  "source_channel",
  "display_mode",
  "requested_service",
  "requested_time_text",
  "requested_time_window_start",
  "requested_time_window_end",
  "timezone",
  "customer_name",
  "customer_email",
  "customer_phone",
  "status",
  "status_reason",
  "staff_notes",
  "evidence",
  "metadata",
  "idempotency_key",
  "expires_at",
  "created_at",
  "updated_at",
].join(", ");

function buildBookingRequestError(
  message,
  statusCode = 400,
  code = "agent_booking_request_invalid"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function hasOwnOption(options, camelKey, snakeKey) {
  return Object.prototype.hasOwnProperty.call(options, camelKey)
    || Object.prototype.hasOwnProperty.call(options, snakeKey);
}

function getOption(options, camelKey, snakeKey) {
  return Object.prototype.hasOwnProperty.call(options, camelKey)
    ? options[camelKey]
    : options[snakeKey];
}

function requireCleanText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildBookingRequestError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function normalizeTimestamp(value) {
  return normalizeOptionalText(value);
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeStatus(value, fallback = "request_received") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!BOOKING_REQUEST_STATUS_SET.has(normalized)) {
    throw buildBookingRequestError(
      `Unsupported booking request status '${cleanInputText(value)}'. Supported statuses: ${BOOKING_REQUEST_STATUSES.join(", ")}.`,
      400,
      "unsupported_booking_request_status"
    );
  }

  return normalized;
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
}

function mapBookingRequestRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id),
    ownerUserId: normalizeOptionalText(row.owner_user_id),
    agentId: normalizeOptionalText(row.agent_id),
    businessId: normalizeOptionalText(row.business_id),
    visitorSessionKey: normalizeOptionalText(row.visitor_session_key),
    sourceMessageId: normalizeOptionalText(row.source_message_id),
    sourceChannel: normalizeOptionalText(row.source_channel),
    displayMode: normalizeOptionalText(row.display_mode),
    requestedService: normalizeOptionalText(row.requested_service),
    requestedTimeText: normalizeOptionalText(row.requested_time_text),
    requestedTimeWindowStart: row.requested_time_window_start || null,
    requestedTimeWindowEnd: row.requested_time_window_end || null,
    timezone: normalizeOptionalText(row.timezone),
    customerName: normalizeOptionalText(row.customer_name),
    customerEmail: normalizeOptionalText(row.customer_email),
    customerPhone: normalizeOptionalText(row.customer_phone),
    status: normalizeStatus(row.status),
    statusReason: normalizeOptionalText(row.status_reason),
    staffNotes: normalizeOptionalText(row.staff_notes),
    evidence: normalizePlainObject(row.evidence),
    metadata: normalizePlainObject(row.metadata),
    idempotencyKey: normalizeOptionalText(row.idempotency_key),
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function getProofSourceType(evidence = {}) {
  return cleanInputText(evidence.proof_source_type || evidence.proofSourceType).toLowerCase();
}

function hasTrustedProof(evidence = {}) {
  const proofSourceType = getProofSourceType(evidence);

  if (REQUEST_ONLY_PROOF_SOURCE_TYPES.has(proofSourceType)) {
    return false;
  }

  return TRUSTED_PROOF_SOURCE_TYPES.has(proofSourceType);
}

function assertTrustedProofForStatus(status, evidence) {
  if (!PROOF_REQUIRED_STATUSES.has(status)) {
    return;
  }

  if (!hasTrustedProof(evidence)) {
    throw buildBookingRequestError(
      `${status} requires trusted external/provider or verified owner/operator proof.`,
      400,
      "booking_request_proof_required"
    );
  }
}

function assertCreateStatus(status) {
  if (!CREATE_STATUSES.has(status)) {
    throw buildBookingRequestError(
      `New booking requests can only start as ${[...CREATE_STATUSES].join(", ")}.`,
      400,
      "booking_request_create_status_not_allowed"
    );
  }
}

function assertAllowedTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus)) {
    throw buildBookingRequestError(
      `Booking request status cannot transition from ${fromStatus} to ${toStatus}.`,
      400,
      "booking_request_transition_not_allowed"
    );
  }
}

function resolveBusinessId({ inputBusinessId, agentBusinessId }) {
  const normalizedInput = normalizeOptionalText(inputBusinessId);
  const normalizedAgentBusinessId = normalizeOptionalText(agentBusinessId);

  if (
    normalizedInput
    && normalizedAgentBusinessId
    && normalizedInput !== normalizedAgentBusinessId
  ) {
    throw buildBookingRequestError(
      "business_id must belong to the owner-scoped agent.",
      400,
      "agent_business_scope_mismatch"
    );
  }

  return normalizedInput || normalizedAgentBusinessId;
}

async function getOwnerScopedAgent(supabase, { agentId, ownerUserId }) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, business_id, owner_user_id")
    .eq("id", agentId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildBookingRequestError("Agent not found", 404, "agent_not_found");
  }

  return data;
}

async function findExistingByIdempotencyKey(supabase, { ownerUserId, agentId, idempotencyKey }) {
  if (!idempotencyKey) {
    return null;
  }

  const { data, error } = await supabase
    .from(AGENT_BOOKING_REQUEST_TABLE)
    .select(BOOKING_REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("agent_id", agentId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapBookingRequestRow(data);
}

export async function createAgentBookingRequest(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const status = normalizeStatus(options.status);

  assertCreateStatus(status);

  const idempotencyKey = normalizeOptionalText(options.idempotencyKey || options.idempotency_key);
  const existing = await findExistingByIdempotencyKey(supabase, {
    ownerUserId,
    agentId,
    idempotencyKey,
  });

  if (existing) {
    return existing;
  }

  const agent = await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  const now = new Date().toISOString();
  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: resolveBusinessId({
      inputBusinessId: options.businessId || options.business_id,
      agentBusinessId: agent.business_id,
    }),
    visitor_session_key: normalizeOptionalText(options.visitorSessionKey || options.visitor_session_key),
    source_message_id: normalizeOptionalText(options.sourceMessageId || options.source_message_id),
    source_channel: normalizeOptionalText(options.sourceChannel || options.source_channel),
    display_mode: normalizeOptionalText(options.displayMode || options.display_mode),
    requested_service: normalizeOptionalText(options.requestedService || options.requested_service),
    requested_time_text: normalizeOptionalText(options.requestedTimeText || options.requested_time_text),
    requested_time_window_start: normalizeTimestamp(options.requestedTimeWindowStart || options.requested_time_window_start),
    requested_time_window_end: normalizeTimestamp(options.requestedTimeWindowEnd || options.requested_time_window_end),
    timezone: normalizeOptionalText(options.timezone),
    customer_name: normalizeOptionalText(options.customerName || options.customer_name),
    customer_email: normalizeOptionalText(options.customerEmail || options.customer_email),
    customer_phone: normalizeOptionalText(options.customerPhone || options.customer_phone),
    status,
    status_reason: normalizeOptionalText(options.statusReason || options.status_reason),
    staff_notes: normalizeOptionalText(options.staffNotes || options.staff_notes),
    evidence: normalizePlainObject(options.evidence),
    metadata: normalizePlainObject(options.metadata),
    idempotency_key: idempotencyKey,
    expires_at: normalizeTimestamp(options.expiresAt || options.expires_at),
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(AGENT_BOOKING_REQUEST_TABLE)
    .insert(payload)
    .select(BOOKING_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapBookingRequestRow(data);
}

export async function listAgentBookingRequests(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(AGENT_BOOKING_REQUEST_TABLE)
    .select(BOOKING_REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId);

  const agentId = cleanInputText(options.agentId || options.agent_id);
  const businessId = cleanInputText(options.businessId || options.business_id);
  const status = cleanInputText(options.status) ? normalizeStatus(options.status) : "";

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapBookingRequestRow);
}

export async function updateAgentBookingRequestStatus(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const requestId = requireCleanText(options.requestId || options.request_id, "request_id");
  const status = normalizeStatus(options.status);

  const { data: existing, error: selectError } = await supabase
    .from(AGENT_BOOKING_REQUEST_TABLE)
    .select(BOOKING_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!existing) {
    throw buildBookingRequestError("Booking request not found", 404, "booking_request_not_found");
  }

  const existingStatus = normalizeStatus(existing.status);
  const evidence = hasOwnOption(options, "evidence", "evidence")
    ? normalizePlainObject(options.evidence)
    : normalizePlainObject(existing.evidence);
  const metadata = hasOwnOption(options, "metadata", "metadata")
    ? normalizePlainObject(options.metadata)
    : normalizePlainObject(existing.metadata);

  assertAllowedTransition(existingStatus, status);
  assertTrustedProofForStatus(status, evidence);

  const updatePayload = {
    status,
    evidence,
    metadata,
    updated_at: new Date().toISOString(),
  };

  if (hasOwnOption(options, "statusReason", "status_reason")) {
    updatePayload.status_reason = normalizeOptionalText(getOption(options, "statusReason", "status_reason"));
  }

  if (hasOwnOption(options, "staffNotes", "staff_notes")) {
    updatePayload.staff_notes = normalizeOptionalText(getOption(options, "staffNotes", "staff_notes"));
  }

  const { data, error } = await supabase
    .from(AGENT_BOOKING_REQUEST_TABLE)
    .update(updatePayload)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .select(BOOKING_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildBookingRequestError("Booking request not found", 404, "booking_request_not_found");
  }

  return mapBookingRequestRow(data);
}
