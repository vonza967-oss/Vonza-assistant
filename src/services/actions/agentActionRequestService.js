import { AGENT_ACTION_REQUEST_TABLE } from "../../config/constants.js";
import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
  isKnownAgentPackageKey,
} from "../../agentPackages/index.js";
import {
  getActionRequestDefinition,
  packageCanCreateActionRequest,
} from "./actionRequestRegistry.js";
import { cleanText } from "../../utils/text.js";

const AGENTS_TABLE = "agents";
const ACTION_REQUEST_STATUSES = new Set(["new", "accepted", "done", "dismissed"]);
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const ACTION_REQUEST_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "package_key",
  "request_type",
  "status",
  "visitor_session_key",
  "conversation_source",
  "display_mode",
  "guest_context",
  "payload",
  "source_message",
  "staff_notes",
  "created_at",
  "updated_at",
  "accepted_at",
  "done_at",
  "dismissed_at",
].join(", ");

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function buildRequestError(message, statusCode = 400, code = "agent_action_request_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
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
    throw buildRequestError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizePackageKey(options = {}) {
  if (!hasOwnOption(options, "packageKey", "package_key")) {
    return getAgentPackage(DEFAULT_AGENT_PACKAGE_KEY).key;
  }

  const normalized = cleanInputText(getOption(options, "packageKey", "package_key")).toLowerCase();

  if (!isKnownAgentPackageKey(normalized)) {
    throw buildRequestError("Unknown agent package key.", 400, "unknown_agent_package_key");
  }

  return getAgentPackage(normalized).key;
}

function normalizeRequestType(value) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildRequestError("request_type is required", 400, "request_type_required");
  }

  return normalized;
}

function resolveActionRequestDefinition(requestType) {
  const definition = getActionRequestDefinition(requestType);

  if (!definition) {
    throw buildRequestError(
      `Unknown action request type '${cleanInputText(requestType)}'.`,
      400,
      "unknown_action_request_type"
    );
  }

  return definition;
}

function assertStaffVisibleActionDefinition(definition) {
  if (
    !definition.requiresStaffAction
    || definition.requiresIntegration
    || definition.externalExecution
  ) {
    throw buildRequestError(
      `Action request type '${definition.key}' is not available for staff-visible request creation.`,
      400,
      "action_request_external_execution_not_allowed"
    );
  }
}

function resolvePackageActionDefinition(packageKey, requestType) {
  const agentPackage = getAgentPackage(packageKey);
  const definition = resolveActionRequestDefinition(requestType);

  assertStaffVisibleActionDefinition(definition);

  if (!packageCanCreateActionRequest(agentPackage, definition.key)) {
    throw buildRequestError(
      `Package '${agentPackage.key}' cannot create action request type '${definition.key}'.`,
      400,
      "package_action_not_allowed"
    );
  }

  return definition;
}

function normalizeStatus(value, fallback = "new") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!ACTION_REQUEST_STATUSES.has(normalized)) {
    throw buildRequestError(
      `Unsupported action request status '${cleanInputText(value)}'. Supported statuses: ${[...ACTION_REQUEST_STATUSES].join(", ")}.`,
      400,
      "unsupported_action_request_status"
    );
  }

  return normalized;
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
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
    packageKey: cleanInputText(row.package_key),
    requestType: cleanInputText(row.request_type),
    status: normalizeStatus(row.status),
    visitorSessionKey: cleanInputText(row.visitor_session_key),
    conversationSource: cleanInputText(row.conversation_source),
    displayMode: cleanInputText(row.display_mode),
    guestContext: normalizePlainObject(row.guest_context),
    payload: normalizePlainObject(row.payload),
    sourceMessage: cleanInputText(row.source_message),
    staffNotes: cleanInputText(row.staff_notes),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    acceptedAt: row.accepted_at || null,
    doneAt: row.done_at || null,
    dismissedAt: row.dismissed_at || null,
  };
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
    throw buildRequestError("Agent not found", 404, "agent_not_found");
  }

  return data;
}

export async function createAgentActionRequest(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const packageKey = normalizePackageKey(options);
  const requestType = normalizeRequestType(options.requestType || options.request_type);
  const actionDefinition = resolvePackageActionDefinition(packageKey, requestType);
  const status = normalizeStatus(options.status);
  const agent = await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  const now = new Date().toISOString();

  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: normalizeOptionalText(agent.business_id),
    package_key: packageKey,
    request_type: actionDefinition.key,
    status,
    visitor_session_key: normalizeOptionalText(options.visitorSessionKey || options.visitor_session_key),
    conversation_source: normalizeOptionalText(options.conversationSource || options.conversation_source),
    display_mode: normalizeOptionalText(options.displayMode || options.display_mode),
    guest_context: normalizePlainObject(options.guestContext || options.guest_context),
    payload: normalizePlainObject(options.payload),
    source_message: normalizeOptionalText(options.sourceMessage || options.source_message),
    staff_notes: normalizeOptionalText(options.staffNotes || options.staff_notes),
    updated_at: now,
  };

  if (status === "accepted") {
    payload.accepted_at = now;
  } else if (status === "done") {
    payload.done_at = now;
  } else if (status === "dismissed") {
    payload.dismissed_at = now;
  }

  const { data, error } = await supabase
    .from(AGENT_ACTION_REQUEST_TABLE)
    .insert(payload)
    .select(ACTION_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapActionRequestRow(data);
}

export async function listAgentActionRequests(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(AGENT_ACTION_REQUEST_TABLE)
    .select(ACTION_REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId);

  const agentId = cleanInputText(options.agentId || options.agent_id);
  const status = cleanInputText(options.status) ? normalizeStatus(options.status) : "";
  const rawPackageKey = hasOwnOption(options, "packageKey", "package_key")
    ? cleanInputText(getOption(options, "packageKey", "package_key"))
    : "";
  const packageKey = rawPackageKey ? normalizePackageKey({ packageKey: rawPackageKey }) : "";
  const requestType = cleanInputText(options.requestType || options.request_type);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (packageKey) {
    query = query.eq("package_key", packageKey);
  }

  if (requestType) {
    query = query.eq("request_type", requestType);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapActionRequestRow);
}

export async function updateAgentActionRequestStatus(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const requestId = requireCleanText(options.requestId || options.request_id, "request_id");
  const status = normalizeStatus(options.status);
  const hasStaffNotes = hasOwnOption(options, "staffNotes", "staff_notes");

  const { data: existing, error: selectError } = await supabase
    .from(AGENT_ACTION_REQUEST_TABLE)
    .select(ACTION_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!existing) {
    throw buildRequestError("Action request not found", 404, "action_request_not_found");
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status,
    updated_at: now,
  };

  if (hasStaffNotes) {
    updatePayload.staff_notes = normalizeOptionalText(getOption(options, "staffNotes", "staff_notes"));
  }

  if (status === "accepted" && !existing.accepted_at) {
    updatePayload.accepted_at = now;
  } else if (status === "done") {
    updatePayload.done_at = now;
  } else if (status === "dismissed") {
    updatePayload.dismissed_at = now;
  }

  const { data, error } = await supabase
    .from(AGENT_ACTION_REQUEST_TABLE)
    .update(updatePayload)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .select(ACTION_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildRequestError("Action request not found", 404, "action_request_not_found");
  }

  return mapActionRequestRow(data);
}
