import { CONNECTED_APP_CONNECTION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const GOOGLE_PROVIDER = "google";
const GOOGLE_CALENDAR_APP_KEY = "google.calendar";
const GOOGLE_CALENDAR_READ_CAPABILITY = "google.calendar.read";
const GOOGLE_CALENDAR_WRITE_CAPABILITY = "google.calendar.write";
const GOOGLE_CALENDAR_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

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

function buildAdapterError(message, statusCode = 400, code = "google_connected_app_adapter_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeOptionalText(value) {
  return cleanText(value) || null;
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function normalizeArray(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  const seen = new Set();

  return values.flatMap((item) => {
    const normalized = cleanText(item);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function isMissingConnectedAppSchemaError(error) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01"
    || error?.code === "PGRST205"
    || message.includes("connected_app_connections")
    || message.includes("could not find the table")
    || message.includes("schema cache")
  );
}

function hasScope(scopes, scope) {
  return normalizeArray(scopes).includes(scope);
}

function buildCalendarCapabilities(scopes = []) {
  const calendarWrite = hasScope(scopes, GOOGLE_CALENDAR_WRITE_SCOPE);
  const calendarRead = hasScope(scopes, GOOGLE_CALENDAR_READ_SCOPE) || calendarWrite;
  const capabilityKeys = [];

  if (calendarRead) {
    capabilityKeys.push(GOOGLE_CALENDAR_READ_CAPABILITY);
  }

  if (calendarWrite) {
    capabilityKeys.push(GOOGLE_CALENDAR_WRITE_CAPABILITY);
  }

  return {
    calendarRead,
    calendarWrite,
    capabilityKeys,
  };
}

function buildScopesGranted(scopes = []) {
  return normalizeArray(scopes).filter((scope) =>
    scope === GOOGLE_CALENDAR_READ_SCOPE || scope === GOOGLE_CALENDAR_WRITE_SCOPE
  );
}

function getAccountValue(account, camelKey, snakeKey) {
  if (Object.prototype.hasOwnProperty.call(account, camelKey)) {
    return account[camelKey];
  }

  return account[snakeKey];
}

function getAccountScopes(account = {}) {
  return normalizeArray(getAccountValue(account, "scopes", "scopes"));
}

function getProviderAccountId(account = {}) {
  return normalizeOptionalText(getAccountValue(account, "providerAccountId", "provider_account_id"))
    || normalizeOptionalText(getAccountValue(account, "accountEmail", "account_email"))
    || normalizeOptionalText(account.id);
}

function getProviderAccountLabel(account = {}) {
  const email = normalizeOptionalText(getAccountValue(account, "accountEmail", "account_email"));
  const displayName = normalizeOptionalText(getAccountValue(account, "displayName", "display_name"));

  if (email && displayName && displayName.toLowerCase() !== email.toLowerCase()) {
    return `${displayName} <${email}>`;
  }

  return email || displayName || getProviderAccountId(account);
}

function getNeedsAttentionReason({ status, capabilityKeys }) {
  if (capabilityKeys.length === 0) {
    return "calendar_scope_missing";
  }

  if (status === "expired" || status === "stale") {
    return "google_connection_expired";
  }

  if (status === "refresh_failed" || status === "refresh-failed") {
    return "google_token_refresh_failed";
  }

  if (status === "permission_missing" || status === "permission-missing") {
    return "google_calendar_permission_missing";
  }

  if (status === "error" || status === "failed") {
    return "google_connection_error";
  }

  if (status === "pending") {
    return "google_connection_pending";
  }

  return null;
}

function mapGoogleStatusToConnectedAppStatus(accountStatus, capabilityKeys = []) {
  const status = normalizeKey(accountStatus || "pending");

  if (status === "disabled") {
    return "disabled";
  }

  if (status === "revoked") {
    return "revoked";
  }

  if ((status === "connected" || status === "active") && capabilityKeys.length > 0) {
    return "active";
  }

  return "needs_attention";
}

function buildMetadata(account = {}, options = {}) {
  const accountMetadata = normalizePlainObject(getAccountValue(account, "metadata", "metadata"));
  const capabilities = options.capabilities || {};

  return {
    source: "existing_google_connection_flow",
    adapter: "google_calendar",
    googleConnectedAccountId: normalizeOptionalText(account.id),
    agentId: normalizeOptionalText(getAccountValue(account, "agentId", "agent_id")),
    businessId: normalizeOptionalText(getAccountValue(account, "businessId", "business_id")),
    selectedMailbox: normalizeOptionalText(getAccountValue(account, "selectedMailbox", "selected_mailbox")),
    emailVerified: accountMetadata.emailVerified === true,
    capabilitySummary: {
      calendarRead: capabilities.calendarRead === true,
      calendarWrite: capabilities.calendarWrite === true,
    },
    mirroredAt: options.mirroredAt,
  };
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
    capabilityKeys: normalizeArray(row.capability_keys).map((capabilityKey) => capabilityKey.toLowerCase()),
    status: normalizeOptionalText(row.status),
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

export function buildGoogleCalendarConnectedAppConnectionPayload(account = {}, options = {}) {
  const ownerUserId = normalizeOptionalText(getAccountValue(account, "ownerUserId", "owner_user_id"));
  const provider = normalizeKey(getAccountValue(account, "provider", "provider") || GOOGLE_PROVIDER) || GOOGLE_PROVIDER;
  const providerAccountId = getProviderAccountId(account);
  const scopes = getAccountScopes(account);
  const capabilities = buildCalendarCapabilities(scopes);
  const statusSource = normalizeKey(getAccountValue(account, "status", "status") || "pending");
  const connectedAppStatus = mapGoogleStatusToConnectedAppStatus(statusSource, capabilities.capabilityKeys);
  const now = normalizeOptionalText(options.now) || new Date().toISOString();

  if (!ownerUserId) {
    throw buildAdapterError("owner_user_id is required", 401, "owner_user_id_required");
  }

  if (provider !== GOOGLE_PROVIDER) {
    throw buildAdapterError("Google Calendar adapter only accepts google accounts", 400, "unsupported_google_provider");
  }

  if (!providerAccountId) {
    throw buildAdapterError("provider_account_id or account_email is required", 400, "provider_account_id_required");
  }

  return {
    owner_user_id: ownerUserId,
    provider: GOOGLE_PROVIDER,
    app_key: GOOGLE_CALENDAR_APP_KEY,
    capability_keys: capabilities.capabilityKeys,
    status: connectedAppStatus,
    provider_account_id: providerAccountId,
    provider_account_label: getProviderAccountLabel(account),
    scopes_granted: buildScopesGranted(scopes),
    webhook_status: "not_required",
    token_secret_ref: null,
    last_verified_at: connectedAppStatus === "active" ? now : null,
    needs_attention_reason: connectedAppStatus === "needs_attention"
      ? getNeedsAttentionReason({ status: statusSource, capabilityKeys: capabilities.capabilityKeys })
      : null,
    metadata: buildMetadata(account, {
      capabilities,
      mirroredAt: now,
    }),
    updated_at: now,
  };
}

export async function mirrorGoogleCalendarConnectedAppConnection(supabase, account = {}, options = {}) {
  const payload = buildGoogleCalendarConnectedAppConnectionPayload(account, options);
  let existing;

  try {
    const { data, error } = await supabase
      .from(CONNECTED_APP_CONNECTION_TABLE)
      .select(CONNECTION_SELECT)
      .eq("owner_user_id", payload.owner_user_id)
      .eq("provider", payload.provider)
      .eq("app_key", payload.app_key)
      .eq("provider_account_id", payload.provider_account_id)
      .maybeSingle();

    if (error) {
      if (isMissingConnectedAppSchemaError(error)) {
        return {
          ok: false,
          skipped: true,
          reason: "connected_app_schema_missing",
          connection: null,
        };
      }

      throw error;
    }

    existing = data || null;
  } catch (error) {
    if (isMissingConnectedAppSchemaError(error)) {
      return {
        ok: false,
        skipped: true,
        reason: "connected_app_schema_missing",
        connection: null,
      };
    }

    throw error;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from(CONNECTED_APP_CONNECTION_TABLE)
      .update(payload)
      .eq("id", existing.id)
      .eq("owner_user_id", payload.owner_user_id)
      .select(CONNECTION_SELECT)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      action: "updated",
      connection: mapConnectionRow(data),
    };
  }

  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .insert(payload)
    .select(CONNECTION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return {
    ok: true,
    action: "created",
    connection: mapConnectionRow(data),
  };
}
