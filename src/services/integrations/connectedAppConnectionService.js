import {
  AGENT_CONNECTED_APP_ENABLEMENT_TABLE,
  CONNECTED_APP_CONNECTION_TABLE,
} from "../../config/constants.js";
import {
  getConnectedAppCapability,
  hasConnectedAppCapability,
  listConnectedAppCapabilities,
} from "./connectedAppRegistry.js";
import { cleanText } from "../../utils/text.js";

const AGENTS_TABLE = "agents";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export const CONNECTED_APP_CONNECTION_STATUSES = Object.freeze([
  "needs_setup",
  "active",
  "disabled",
  "needs_attention",
  "revoked",
]);

export const CONNECTED_APP_APPROVAL_MODES = Object.freeze([
  "manual_review",
  "owner_approved",
  "automatic_internal",
  "disabled",
]);

const CONNECTION_STATUS_SET = new Set(CONNECTED_APP_CONNECTION_STATUSES);
const APPROVAL_MODE_SET = new Set(CONNECTED_APP_APPROVAL_MODES);
const PUBLIC_SURFACES = new Set([
  "chat",
  "embed",
  "full_page",
  "public",
  "public_chat",
  "web_call",
  "widget",
]);
const UNSAFE_INPUT_FIELD_NAMES = new Set([
  "accessToken",
  "access_token",
  "appSecret",
  "app_secret",
  "apiKey",
  "api_key",
  "authUrl",
  "auth_url",
  "authorizationCode",
  "authorization_code",
  "authorizationUrl",
  "authorization_url",
  "bearerToken",
  "bearer_token",
  "businessIntegrationSystemUserToken",
  "business_integration_system_user_token",
  "callbackUrl",
  "callback_url",
  "callable",
  "client",
  "clientSecret",
  "client_secret",
  "cloudApiAccessToken",
  "cloud_api_access_token",
  "cloudApiUrl",
  "cloud_api_url",
  "encryptedToken",
  "encrypted_token",
  "embeddedSignupUrl",
  "embedded_signup_url",
  "endpointUrl",
  "endpoint_url",
  "execute",
  "executionRequested",
  "execution_requested",
  "executor",
  "externalExecution",
  "external_execution",
  "handler",
  "handlers",
  "oauthUrl",
  "oauth_url",
  "providerClient",
  "provider_client",
  "providerUrl",
  "provider_url",
  "providers",
  "publicChatCallable",
  "public_chat_callable",
  "permanentAccessToken",
  "permanent_access_token",
  "refreshToken",
  "refresh_token",
  "runtimeHandler",
  "runtime_handler",
  "secret",
  "secrets",
  "setupUrl",
  "setup_url",
  "signingSecret",
  "signing_secret",
  "systemUserAccessToken",
  "system_user_access_token",
  "token",
  "tokenSecretRef",
  "token_secret_ref",
  "tokens",
  "verifyToken",
  "verify_token",
  "whatsappAccessToken",
  "whatsapp_access_token",
  "whatsappToken",
  "whatsapp_token",
  "webhookEndpoint",
  "webhook_endpoint",
  "webhookEndpointUrl",
  "webhook_endpoint_url",
  "webhookSecret",
  "webhook_secret",
  "webhookUrl",
  "webhook_url",
]);
const UNSAFE_INPUT_URL_PATTERN = /https?:\/\//i;
const SECRET_LOOKING_VALUE_PATTERN = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/i;
const JWT_LOOKING_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN = /\bEAA[A-Za-z0-9_-]{20,}\b/;

const CONNECTION_SELECT = [
  "id",
  "owner_user_id",
  "provider",
  "app_key",
  "capability_keys",
  "status",
  "provider_account_id",
  "provider_account_label",
  "scopes_granted",
  "webhook_status",
  "token_secret_ref",
  "last_verified_at",
  "needs_attention_reason",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const ENABLEMENT_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "connection_id",
  "capability_keys",
  "enabled",
  "approval_mode",
  "allowed_surfaces",
  "package_key",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

function buildConnectedAppError(message, statusCode = 400, code = "connected_app_invalid") {
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
    throw buildConnectedAppError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizeOptionalText(value) {
  return cleanInputText(value) || null;
}

function normalizeKey(value) {
  return cleanInputText(value).toLowerCase();
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeArray(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  const seen = new Set();

  return values.flatMap((item) => {
    const normalized = normalizeOptionalText(item);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeCapabilityKeys(value) {
  return normalizeArray(value).map((capabilityKey) => capabilityKey.toLowerCase());
}

function deriveAppKeyFromCapabilityKey(capabilityKey) {
  return normalizeKey(capabilityKey).split(".").slice(0, 2).join(".");
}

function capabilityAppKey(definition) {
  return deriveAppKeyFromCapabilityKey(definition?.key || "");
}

function normalizeStatus(value, fallback = "needs_setup") {
  const normalized = normalizeKey(value || fallback);

  if (!CONNECTION_STATUS_SET.has(normalized)) {
    throw buildConnectedAppError(
      `Unsupported connected app connection status '${cleanInputText(value)}'. Supported statuses: ${CONNECTED_APP_CONNECTION_STATUSES.join(", ")}.`,
      400,
      "unsupported_connected_app_status"
    );
  }

  return normalized;
}

function normalizeApprovalMode(value, fallback = "manual_review") {
  const normalized = normalizeKey(value || fallback);

  if (!APPROVAL_MODE_SET.has(normalized)) {
    throw buildConnectedAppError(
      `Unsupported connected app approval mode '${cleanInputText(value)}'. Supported modes: ${CONNECTED_APP_APPROVAL_MODES.join(", ")}.`,
      400,
      "unsupported_connected_app_approval_mode"
    );
  }

  return normalized;
}

function normalizeProvider(value) {
  const provider = normalizeKey(value);

  if (!provider) {
    throw buildConnectedAppError("provider is required", 400, "provider_required");
  }

  const knownProvider = listConnectedAppCapabilities().some(
    (definition) => definition.provider === provider
  );

  if (!knownProvider) {
    throw buildConnectedAppError(
      `Unknown connected app provider '${cleanInputText(value)}'.`,
      400,
      "unknown_connected_app_provider"
    );
  }

  return provider;
}

function validateConnectionAppKey({ appKey, provider, capabilityKeys }) {
  const normalizedAppKey = normalizeKey(appKey);

  if (!normalizedAppKey) {
    throw buildConnectedAppError("app_key is required", 400, "app_key_required");
  }

  const knownAppKeys = new Set(
    listConnectedAppCapabilities()
      .filter((definition) => definition.provider === provider)
      .map((definition) => capabilityAppKey(definition))
  );

  if (!knownAppKeys.has(normalizedAppKey)) {
    throw buildConnectedAppError(
      `Unknown connected app key '${cleanInputText(appKey)}' for provider '${provider}'.`,
      400,
      "unknown_connected_app_key"
    );
  }

  for (const capabilityKey of capabilityKeys) {
    if (deriveAppKeyFromCapabilityKey(capabilityKey) !== normalizedAppKey) {
      throw buildConnectedAppError(
        `Capability '${capabilityKey}' does not belong to app '${normalizedAppKey}'.`,
        400,
        "connected_app_capability_app_mismatch"
      );
    }
  }

  return normalizedAppKey;
}

function validateCapabilityKeys(capabilityKeys, { provider, appKey, requireNonEmpty = false } = {}) {
  const normalizedCapabilityKeys = normalizeCapabilityKeys(capabilityKeys);

  if (requireNonEmpty && normalizedCapabilityKeys.length === 0) {
    throw buildConnectedAppError(
      "At least one connected app capability key is required.",
      400,
      "connected_app_capability_required"
    );
  }

  for (const capabilityKey of normalizedCapabilityKeys) {
    if (!hasConnectedAppCapability(capabilityKey)) {
      throw buildConnectedAppError(
        `Unknown connected app capability '${capabilityKey}'.`,
        400,
        "unknown_connected_app_capability"
      );
    }

    const definition = getConnectedAppCapability(capabilityKey);

    if (provider && definition.provider !== provider) {
      throw buildConnectedAppError(
        `Capability '${capabilityKey}' does not belong to provider '${provider}'.`,
        400,
        "connected_app_capability_provider_mismatch"
      );
    }

    if (appKey && capabilityAppKey(definition) !== appKey) {
      throw buildConnectedAppError(
        `Capability '${capabilityKey}' does not belong to app '${appKey}'.`,
        400,
        "connected_app_capability_app_mismatch"
      );
    }
  }

  return normalizedCapabilityKeys;
}

function assertNoUnsafeInput(value, path = "input") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (UNSAFE_INPUT_FIELD_NAMES.has(key)) {
      throw buildConnectedAppError(
        `Connected app service does not accept secret or execution field '${path}.${key}'.`,
        400,
        "connected_app_secret_or_execution_field_rejected"
      );
    }

    if (
      typeof nestedValue === "string"
      && (
        UNSAFE_INPUT_URL_PATTERN.test(nestedValue)
        || SECRET_LOOKING_VALUE_PATTERN.test(nestedValue)
        || JWT_LOOKING_VALUE_PATTERN.test(nestedValue)
        || META_ACCESS_TOKEN_LOOKING_VALUE_PATTERN.test(nestedValue)
      )
    ) {
      throw buildConnectedAppError(
        `Connected app service does not accept secret-looking or URL value '${path}.${key}'.`,
        400,
        "connected_app_secret_or_execution_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      assertNoUnsafeInput(nestedValue, `${path}.${key}`);
    }
  }
}

function assertAllowedSurfaces(surfaces, approvalMode = "manual_review") {
  for (const surface of surfaces) {
    if (PUBLIC_SURFACES.has(surface)) {
      throw buildConnectedAppError(
        `Public surface '${surface}' is not allowed for connected app enablements in this phase.`,
        400,
        "connected_app_public_surface_not_allowed"
      );
    }
  }

  if (approvalMode === "automatic_internal" && surfaces.some((surface) => surface !== "internal")) {
    throw buildConnectedAppError(
      "automatic_internal approval mode can only be used with the internal surface.",
      400,
      "connected_app_automatic_mode_surface_not_allowed"
    );
  }
}

function mapConnectionRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id),
    ownerUserId: normalizeOptionalText(row.owner_user_id),
    provider: normalizeOptionalText(row.provider),
    appKey: normalizeOptionalText(row.app_key),
    capabilityKeys: normalizeCapabilityKeys(row.capability_keys),
    status: normalizeStatus(row.status),
    providerAccountId: normalizeOptionalText(row.provider_account_id),
    providerAccountLabel: normalizeOptionalText(row.provider_account_label),
    scopesGranted: normalizeArray(row.scopes_granted),
    webhookStatus: normalizeOptionalText(row.webhook_status),
    hasTokenSecretRef: Boolean(normalizeOptionalText(row.token_secret_ref)),
    lastVerifiedAt: row.last_verified_at || null,
    needsAttentionReason: normalizeOptionalText(row.needs_attention_reason),
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapEnablementRow(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id),
    ownerUserId: normalizeOptionalText(row.owner_user_id),
    agentId: normalizeOptionalText(row.agent_id),
    connectionId: normalizeOptionalText(row.connection_id),
    capabilityKeys: normalizeCapabilityKeys(row.capability_keys),
    enabled: row.enabled === true,
    approvalMode: normalizeApprovalMode(row.approval_mode),
    allowedSurfaces: normalizeArray(row.allowed_surfaces).map((surface) => normalizeKey(surface)),
    packageKey: normalizeOptionalText(row.package_key),
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function getOwnerScopedAgent(supabase, { ownerUserId, agentId }) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, owner_user_id")
    .eq("id", agentId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildConnectedAppError("Agent not found", 404, "agent_not_found");
  }

  return data;
}

async function getOwnerScopedConnection(supabase, { ownerUserId, connectionId }) {
  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select(CONNECTION_SELECT)
    .eq("id", connectionId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildConnectedAppError(
      "Connected app connection not found",
      404,
      "connected_app_connection_not_found"
    );
  }

  return data;
}

function assertCapabilitiesOnConnection(capabilityKeys, connection) {
  const connectionCapabilities = new Set(normalizeCapabilityKeys(connection.capability_keys));

  for (const capabilityKey of capabilityKeys) {
    if (!connectionCapabilities.has(capabilityKey)) {
      throw buildConnectedAppError(
        `Capability '${capabilityKey}' is not present on the selected connected app connection.`,
        400,
        "connected_app_capability_not_on_connection"
      );
    }
  }
}

export async function createConnectedAppConnection(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const provider = normalizeProvider(options.provider);
  const capabilityKeys = validateCapabilityKeys(
    options.capabilityKeys || options.capability_keys,
    { provider }
  );
  const appKey = validateConnectionAppKey({
    appKey: options.appKey || options.app_key,
    provider,
    capabilityKeys,
  });
  const now = new Date().toISOString();
  const payload = {
    owner_user_id: ownerUserId,
    provider,
    app_key: appKey,
    capability_keys: capabilityKeys,
    status: normalizeStatus(options.status),
    provider_account_id: normalizeOptionalText(options.providerAccountId || options.provider_account_id),
    provider_account_label: normalizeOptionalText(options.providerAccountLabel || options.provider_account_label),
    scopes_granted: normalizeArray(options.scopesGranted || options.scopes_granted),
    webhook_status: normalizeOptionalText(options.webhookStatus || options.webhook_status),
    token_secret_ref: normalizeOptionalText(options.tokenSecretRef || options.token_secret_ref),
    last_verified_at: normalizeOptionalText(options.lastVerifiedAt || options.last_verified_at),
    needs_attention_reason: normalizeOptionalText(options.needsAttentionReason || options.needs_attention_reason),
    metadata: normalizePlainObject(options.metadata),
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .insert(payload)
    .select(CONNECTION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapConnectionRow(data);
}

export async function listConnectedAppConnections(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select(CONNECTION_SELECT)
    .eq("owner_user_id", ownerUserId);

  const provider = cleanInputText(options.provider) ? normalizeProvider(options.provider) : "";
  const appKey = normalizeKey(options.appKey || options.app_key);
  const status = cleanInputText(options.status) ? normalizeStatus(options.status) : "";

  if (provider) {
    query = query.eq("provider", provider);
  }

  if (appKey) {
    query = query.eq("app_key", appKey);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapConnectionRow);
}

export async function updateConnectedAppConnectionStatus(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const connectionId = requireCleanText(options.connectionId || options.connection_id, "connection_id");
  const updatePayload = {
    status: normalizeStatus(options.status),
    updated_at: new Date().toISOString(),
  };

  if (hasOwnOption(options, "webhookStatus", "webhook_status")) {
    updatePayload.webhook_status = normalizeOptionalText(getOption(options, "webhookStatus", "webhook_status"));
  }

  if (hasOwnOption(options, "lastVerifiedAt", "last_verified_at")) {
    updatePayload.last_verified_at = normalizeOptionalText(getOption(options, "lastVerifiedAt", "last_verified_at"));
  }

  if (hasOwnOption(options, "needsAttentionReason", "needs_attention_reason")) {
    updatePayload.needs_attention_reason = normalizeOptionalText(getOption(options, "needsAttentionReason", "needs_attention_reason"));
  }

  if (hasOwnOption(options, "metadata", "metadata")) {
    updatePayload.metadata = normalizePlainObject(options.metadata);
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .update(updatePayload)
    .eq("id", connectionId)
    .eq("owner_user_id", ownerUserId)
    .select(CONNECTION_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildConnectedAppError(
      "Connected app connection not found",
      404,
      "connected_app_connection_not_found"
    );
  }

  return mapConnectionRow(data);
}

export async function enableConnectedAppForAgent(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const connectionId = requireCleanText(options.connectionId || options.connection_id, "connection_id");

  await getOwnerScopedAgent(supabase, { ownerUserId, agentId });
  const connection = await getOwnerScopedConnection(supabase, { ownerUserId, connectionId });
  const capabilityKeys = validateCapabilityKeys(
    options.capabilityKeys || options.capability_keys,
    {
      provider: connection.provider,
      appKey: connection.app_key,
      requireNonEmpty: true,
    }
  );
  const approvalMode = normalizeApprovalMode(options.approvalMode || options.approval_mode);
  const allowedSurfaces = normalizeArray(options.allowedSurfaces || options.allowed_surfaces)
    .map((surface) => normalizeKey(surface));

  assertCapabilitiesOnConnection(capabilityKeys, connection);
  assertAllowedSurfaces(allowedSurfaces, approvalMode);

  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    connection_id: connectionId,
    capability_keys: capabilityKeys,
    enabled: hasOwnOption(options, "enabled", "enabled") ? options.enabled === true : true,
    approval_mode: approvalMode,
    allowed_surfaces: allowedSurfaces,
    package_key: normalizeOptionalText(options.packageKey || options.package_key),
    metadata: normalizePlainObject(options.metadata),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .insert(payload)
    .select(ENABLEMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapEnablementRow(data);
}

export async function listAgentConnectedAppEnablements(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  let query = supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .select(ENABLEMENT_SELECT)
    .eq("owner_user_id", ownerUserId);

  const agentId = normalizeOptionalText(options.agentId || options.agent_id);
  const connectionId = normalizeOptionalText(options.connectionId || options.connection_id);
  const packageKey = normalizeOptionalText(options.packageKey || options.package_key);
  const approvalMode = cleanInputText(options.approvalMode || options.approval_mode)
    ? normalizeApprovalMode(options.approvalMode || options.approval_mode)
    : "";

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  if (packageKey) {
    query = query.eq("package_key", packageKey);
  }

  if (approvalMode) {
    query = query.eq("approval_mode", approvalMode);
  }

  if (typeof options.enabled === "boolean") {
    query = query.eq("enabled", options.enabled);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapEnablementRow);
}

export async function updateAgentConnectedAppEnablement(supabase, options = {}) {
  assertNoUnsafeInput(options);

  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const enablementId = requireCleanText(options.enablementId || options.enablement_id, "enablement_id");
  const agentId = normalizeOptionalText(options.agentId || options.agent_id);
  let existingQuery = supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .select(ENABLEMENT_SELECT)
    .eq("id", enablementId)
    .eq("owner_user_id", ownerUserId);

  if (agentId) {
    existingQuery = existingQuery.eq("agent_id", agentId);
  }

  const { data: existing, error: existingError } = await existingQuery
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw buildConnectedAppError(
      "Connected app enablement not found",
      404,
      "connected_app_enablement_not_found"
    );
  }

  const connection = await getOwnerScopedConnection(supabase, {
    ownerUserId,
    connectionId: existing.connection_id,
  });
  const updatePayload = {
    updated_at: new Date().toISOString(),
  };
  const nextApprovalMode = hasOwnOption(options, "approvalMode", "approval_mode")
    ? normalizeApprovalMode(getOption(options, "approvalMode", "approval_mode"))
    : normalizeApprovalMode(existing.approval_mode);
  const nextSurfaces = hasOwnOption(options, "allowedSurfaces", "allowed_surfaces")
    ? normalizeArray(getOption(options, "allowedSurfaces", "allowed_surfaces")).map((surface) => normalizeKey(surface))
    : normalizeArray(existing.allowed_surfaces).map((surface) => normalizeKey(surface));

  if (hasOwnOption(options, "capabilityKeys", "capability_keys")) {
    const capabilityKeys = validateCapabilityKeys(
      getOption(options, "capabilityKeys", "capability_keys"),
      {
        provider: connection.provider,
        appKey: connection.app_key,
        requireNonEmpty: true,
      }
    );

    assertCapabilitiesOnConnection(capabilityKeys, connection);
    updatePayload.capability_keys = capabilityKeys;
  }

  assertAllowedSurfaces(nextSurfaces, nextApprovalMode);

  if (hasOwnOption(options, "enabled", "enabled")) {
    updatePayload.enabled = options.enabled === true;
  }

  if (hasOwnOption(options, "approvalMode", "approval_mode")) {
    updatePayload.approval_mode = nextApprovalMode;
  }

  if (hasOwnOption(options, "allowedSurfaces", "allowed_surfaces")) {
    updatePayload.allowed_surfaces = nextSurfaces;
  }

  if (hasOwnOption(options, "packageKey", "package_key")) {
    updatePayload.package_key = normalizeOptionalText(getOption(options, "packageKey", "package_key"));
  }

  if (hasOwnOption(options, "metadata", "metadata")) {
    updatePayload.metadata = normalizePlainObject(options.metadata);
  }

  let updateQuery = supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .update(updatePayload)
    .eq("id", enablementId)
    .eq("owner_user_id", ownerUserId);

  if (agentId) {
    updateQuery = updateQuery.eq("agent_id", agentId);
  }

  const { data, error } = await updateQuery
    .select(ENABLEMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildConnectedAppError(
      "Connected app enablement not found",
      404,
      "connected_app_enablement_not_found"
    );
  }

  return mapEnablementRow(data);
}
