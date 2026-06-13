import {
  AGENT_ORDER_SUPPORT_SETTINGS_TABLE,
  CONNECTED_APP_CONNECTION_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const AGENTS_TABLE = "agents";
const DEFAULT_SUPPORTED_ACTIONS = Object.freeze([
  "order_lookup",
  "shipping_tracking",
]);
const ORDER_SUPPORT_ACTIONS = Object.freeze([
  "order_lookup",
  "shipping_tracking",
  "shipping_address",
  "contact_info",
  "cancellation",
  "delivery_note",
  "item_change",
]);
const ORDER_SUPPORT_APPROVAL_MODES = Object.freeze([
  "read_only",
  "change_requests",
  "safe_automatic",
]);
const ORDER_SUPPORT_PROVIDERS = Object.freeze([
  "internal",
  "shopify",
  "woocommerce",
]);
const ORDER_SUPPORT_PROVIDER_STATUSES = Object.freeze([
  "not_connected",
  "connected",
  "needs_setup",
  "needs_attention",
  "disabled",
]);
const SETTINGS_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "connection_id",
  "enabled",
  "provider",
  "provider_status",
  "supported_actions",
  "approval_mode",
  "escalation_destination",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

function buildOrderSupportSettingsError(
  message,
  statusCode = 400,
  code = "order_support_settings_invalid"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isMissingOrderSupportSettingsSchemaError(error = {}) {
  const message = cleanText(error.message || "").toLowerCase();
  return (
    error.code === "PGRST205"
    || error.code === "PGRST204"
    || error.code === "42P01"
    || message.includes(AGENT_ORDER_SUPPORT_SETTINGS_TABLE)
  );
}

function cleanInputText(value) {
  return typeof value === "string" ? cleanText(value) : "";
}

function requireCleanText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildOrderSupportSettingsError(`${fieldName} is required`, statusCode);
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = cleanInputText(value).toLowerCase();

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeProvider(value, fallback = "internal") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!ORDER_SUPPORT_PROVIDERS.includes(normalized)) {
    throw buildOrderSupportSettingsError(
      `Unsupported order provider '${cleanInputText(value)}'.`,
      400,
      "unsupported_order_provider"
    );
  }

  return normalized;
}

function normalizeProviderStatus(value, fallback = "needs_setup") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!ORDER_SUPPORT_PROVIDER_STATUSES.includes(normalized)) {
    throw buildOrderSupportSettingsError(
      `Unsupported order provider status '${cleanInputText(value)}'.`,
      400,
      "unsupported_order_provider_status"
    );
  }

  return normalized;
}

function normalizeApprovalMode(value, fallback = "read_only") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!ORDER_SUPPORT_APPROVAL_MODES.includes(normalized)) {
    throw buildOrderSupportSettingsError(
      `Unsupported order approval mode '${cleanInputText(value)}'.`,
      400,
      "unsupported_order_approval_mode"
    );
  }

  return normalized;
}

function normalizeActionList(value) {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? DEFAULT_SUPPORTED_ACTIONS
      : String(value).split(/[\n,]/);
  const seen = new Set();

  return values.flatMap((item) => {
    const normalized = cleanInputText(item).toLowerCase();

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    if (!ORDER_SUPPORT_ACTIONS.includes(normalized)) {
      throw buildOrderSupportSettingsError(
        `Unsupported order support action '${cleanInputText(item)}'.`,
        400,
        "unsupported_order_support_action"
      );
    }

    seen.add(normalized);
    return [normalized];
  });
}

function defaultSettingsForAgent(agent = {}, overrides = {}) {
  return {
    id: null,
    ownerUserId: cleanInputText(agent.owner_user_id || agent.ownerUserId || overrides.ownerUserId),
    agentId: cleanInputText(agent.id || overrides.agentId),
    businessId: cleanInputText(agent.business_id || agent.businessId || overrides.businessId),
    connectionId: null,
    enabled: false,
    provider: "internal",
    providerStatus: "needs_setup",
    supportedActions: [...DEFAULT_SUPPORTED_ACTIONS],
    approvalMode: "read_only",
    escalationDestination: "",
    metadata: {},
    createdAt: null,
    updatedAt: null,
    persistenceAvailable: overrides.persistenceAvailable !== false,
  };
}

function mapSettingsRow(row = {}, agent = {}, overrides = {}) {
  if (!row) {
    return defaultSettingsForAgent(agent, overrides);
  }

  return {
    id: cleanInputText(row.id),
    ownerUserId: cleanInputText(row.owner_user_id),
    agentId: cleanInputText(row.agent_id),
    businessId: cleanInputText(row.business_id),
    connectionId: cleanInputText(row.connection_id),
    enabled: row.enabled === true,
    provider: normalizeProvider(row.provider),
    providerStatus: normalizeProviderStatus(row.provider_status),
    supportedActions: normalizeActionList(row.supported_actions),
    approvalMode: normalizeApprovalMode(row.approval_mode),
    escalationDestination: cleanInputText(row.escalation_destination),
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    persistenceAvailable: overrides.persistenceAvailable !== false,
  };
}

async function getOwnerScopedAgent(supabase, { agentId, ownerUserId }) {
  const normalizedAgentId = requireCleanText(agentId, "agent_id");
  const normalizedOwnerUserId = requireCleanText(ownerUserId, "owner_user_id", 401);
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, business_id, owner_user_id")
    .eq("id", normalizedAgentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildOrderSupportSettingsError("Agent not found", 404, "agent_not_found");
  }

  return data;
}

async function assertConnectionIsOwnerScoped(supabase, { ownerUserId, connectionId }) {
  const normalizedConnectionId = cleanInputText(connectionId);

  if (!normalizedConnectionId) {
    return null;
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select("id, owner_user_id, provider, app_key, status")
    .eq("id", normalizedConnectionId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildOrderSupportSettingsError(
      "Connected commerce provider record not found",
      404,
      "connected_provider_not_found"
    );
  }

  return data;
}

export function isOrderSupportProviderReady(settings = {}) {
  return settings.enabled === true && cleanInputText(settings.providerStatus) === "connected";
}

export async function getAgentOrderSupportSettings(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const agent = await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  const defaultSettings = defaultSettingsForAgent(agent);
  const { data, error } = await supabase
    .from(AGENT_ORDER_SUPPORT_SETTINGS_TABLE)
    .select(SETTINGS_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    if (isMissingOrderSupportSettingsSchemaError(error)) {
      return {
        ...defaultSettings,
        persistenceAvailable: false,
        providerStatus: "needs_setup",
      };
    }

    throw error;
  }

  return mapSettingsRow(data, agent);
}

export async function upsertAgentOrderSupportSettings(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const agent = await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  const connectionId = normalizeOptionalText(options.connectionId || options.connection_id);

  await assertConnectionIsOwnerScoped(supabase, { ownerUserId, connectionId });

  const enabled = normalizeBoolean(options.enabled, false);
  const provider = normalizeProvider(options.provider, "internal");
  const providerStatus = normalizeProviderStatus(
    options.providerStatus || options.provider_status,
    enabled && provider === "internal" ? "connected" : "needs_setup"
  );
  const approvalMode = normalizeApprovalMode(options.approvalMode || options.approval_mode, "read_only");
  const supportedActions = normalizeActionList(options.supportedActions || options.supported_actions);
  const now = new Date().toISOString();
  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: normalizeOptionalText(agent.business_id),
    connection_id: connectionId,
    enabled,
    provider,
    provider_status: enabled ? providerStatus : "disabled",
    supported_actions: supportedActions,
    approval_mode: enabled ? approvalMode : "read_only",
    escalation_destination: normalizeOptionalText(options.escalationDestination || options.escalation_destination),
    metadata: normalizePlainObject(options.metadata),
    updated_at: now,
  };
  const { data, error } = await supabase
    .from(AGENT_ORDER_SUPPORT_SETTINGS_TABLE)
    .upsert(payload, { onConflict: "owner_user_id,agent_id" })
    .select(SETTINGS_SELECT)
    .single();

  if (error) {
    if (isMissingOrderSupportSettingsSchemaError(error)) {
      throw buildOrderSupportSettingsError(
        "Order support settings schema is not ready. Apply the latest migration.",
        500,
        "order_support_schema_not_ready"
      );
    }

    throw error;
  }

  return mapSettingsRow(data, agent);
}

export const ORDER_SUPPORT_SETTINGS_OPTIONS = Object.freeze({
  providers: ORDER_SUPPORT_PROVIDERS,
  providerStatuses: ORDER_SUPPORT_PROVIDER_STATUSES,
  approvalModes: ORDER_SUPPORT_APPROVAL_MODES,
  supportedActions: ORDER_SUPPORT_ACTIONS,
});
