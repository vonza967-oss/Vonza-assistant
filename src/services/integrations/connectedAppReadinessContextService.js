import {
  AGENT_CONNECTED_APP_ENABLEMENT_TABLE,
  CONNECTED_APP_CONNECTION_TABLE,
} from "../../config/constants.js";
import {
  getConnectedAppCapability,
} from "./connectedAppRegistry.js";

const CONNECTION_SELECT = [
  "id",
  "owner_user_id",
  "provider",
  "capability_keys",
  "status",
  "scopes_granted",
  "webhook_status",
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
].join(", ");

const MAX_READINESS_RECORDS = 500;
const ACTIVE_CONNECTION_STATUS = "active";
const APPROVAL_MODE_PRIORITY = Object.freeze([
  "disabled",
  "manual_review",
  "owner_approved",
  "automatic_internal",
]);
const PROVIDER_STATUS_PRIORITY = Object.freeze([
  "needs_attention",
  "disabled",
  "revoked",
  "needs_setup",
  "active",
]);
const WEBHOOK_STATUS_PRIORITY = Object.freeze([
  "active",
  "needs_attention",
  "disabled",
  "revoked",
  "error",
  "pending",
  "not_required",
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function normalizeCapabilityKey(value) {
  const normalized = normalizeKey(value);

  return /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(normalized) ? normalized : "";
}

function normalizeSafeToken(value) {
  const normalized = normalizeKey(value).replace(/[\s-]+/g, "_");

  return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : "";
}

function normalizePackageKey(value) {
  const normalized = normalizeKey(value);

  return /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/.test(normalized) ? normalized : "";
}

function normalizeArray(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value];
  const seen = new Set();

  return values.flatMap((item) => {
    const normalized = normalizeKey(item);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeCapabilityKeys(value) {
  return normalizeArray(value).flatMap((item) => {
    const capabilityKey = normalizeCapabilityKey(item);

    return capabilityKey ? [capabilityKey] : [];
  });
}

function buildReadinessContextError(message, statusCode = 400, code = "connected_app_readiness_context_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireCleanText(value, fieldName, statusCode = 400) {
  const normalized = cleanText(value);

  if (!normalized) {
    throw buildReadinessContextError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function packageMatches(enablementPackageKey, packageKey) {
  const normalizedEnablementPackageKey = normalizePackageKey(enablementPackageKey);

  return !packageKey || !normalizedEnablementPackageKey || normalizedEnablementPackageKey === packageKey;
}

function hasCapabilityScope(scopes, definition) {
  const scopeSet = new Set(normalizeArray(scopes));

  return scopeSet.has(definition.key) || scopeSet.has(definition.capability);
}

function pickHighestPriority(currentValue, nextValue, priorityList) {
  const normalizedCurrent = normalizeSafeToken(currentValue);
  const normalizedNext = normalizeSafeToken(nextValue);

  if (!normalizedNext) {
    return normalizedCurrent;
  }

  if (!normalizedCurrent) {
    return normalizedNext;
  }

  const currentIndex = priorityList.indexOf(normalizedCurrent);
  const nextIndex = priorityList.indexOf(normalizedNext);

  if (currentIndex === -1 && nextIndex === -1) {
    return normalizedCurrent;
  }

  if (currentIndex === -1) {
    return normalizedNext;
  }

  if (nextIndex === -1) {
    return normalizedCurrent;
  }

  return nextIndex < currentIndex ? normalizedNext : normalizedCurrent;
}

function mapConnection(row = {}) {
  return {
    id: cleanText(row.id),
    ownerUserId: cleanText(row.owner_user_id),
    provider: normalizeSafeToken(row.provider),
    capabilityKeys: normalizeCapabilityKeys(row.capability_keys),
    status: normalizeSafeToken(row.status),
    scopesGranted: normalizeArray(row.scopes_granted),
    webhookStatus: normalizeSafeToken(row.webhook_status),
  };
}

function mapEnablement(row = {}) {
  return {
    id: cleanText(row.id),
    ownerUserId: cleanText(row.owner_user_id),
    agentId: cleanText(row.agent_id),
    connectionId: cleanText(row.connection_id),
    capabilityKeys: normalizeCapabilityKeys(row.capability_keys),
    enabled: row.enabled === true,
    approvalMode: normalizeSafeToken(row.approval_mode),
    allowedSurfaces: normalizeArray(row.allowed_surfaces).flatMap((surface) => {
      const normalized = normalizeSafeToken(surface);

      return normalized ? [normalized] : [];
    }),
    packageKey: normalizePackageKey(row.package_key),
  };
}

async function fetchOwnerConnections(supabase, ownerUserId) {
  const { data, error } = await supabase
    .from(CONNECTED_APP_CONNECTION_TABLE)
    .select(CONNECTION_SELECT)
    .eq("owner_user_id", ownerUserId)
    .limit(MAX_READINESS_RECORDS);

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapConnection);
}

async function fetchAgentEnablements(supabase, { ownerUserId, agentId }) {
  const { data, error } = await supabase
    .from(AGENT_CONNECTED_APP_ENABLEMENT_TABLE)
    .select(ENABLEMENT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("agent_id", agentId)
    .limit(MAX_READINESS_RECORDS);

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapEnablement);
}

function buildCapabilityStates({ connections, enablements, packageKey }) {
  const connectionsById = new Map(connections.map((connection) => [connection.id, connection]));
  const states = new Map();
  let approvalMode = "";
  let derivedSurface = "";

  for (const enablement of enablements) {
    if (!packageMatches(enablement.packageKey, packageKey)) {
      continue;
    }

    const connection = connectionsById.get(enablement.connectionId);

    if (!connection || connection.ownerUserId !== enablement.ownerUserId) {
      continue;
    }

    const connectionCapabilities = new Set(connection.capabilityKeys);
    const commonCapabilities = enablement.capabilityKeys.filter((capabilityKey) =>
      connectionCapabilities.has(capabilityKey)
    );

    if (commonCapabilities.length === 0) {
      continue;
    }

    approvalMode = pickHighestPriority(
      approvalMode,
      enablement.enabled ? enablement.approvalMode : "disabled",
      APPROVAL_MODE_PRIORITY
    );

    if (!derivedSurface && enablement.allowedSurfaces.length > 0) {
      [derivedSurface] = enablement.allowedSurfaces;
    }

    for (const capabilityKey of commonCapabilities) {
      const definition = getConnectedAppCapability(capabilityKey);

      if (!definition) {
        continue;
      }

      const existingState = states.get(capabilityKey) || {
        capabilityKey,
        connected: false,
        providerStatus: "",
        scopeGranted: false,
        webhookStatus: "",
      };
      const connected = connection.status === ACTIVE_CONNECTION_STATUS && enablement.enabled;

      existingState.connected = existingState.connected || connected;
      existingState.providerStatus = connected
        ? ACTIVE_CONNECTION_STATUS
        : pickHighestPriority(existingState.providerStatus, connection.status, PROVIDER_STATUS_PRIORITY);
      existingState.scopeGranted = existingState.scopeGranted || hasCapabilityScope(connection.scopesGranted, definition);
      existingState.webhookStatus = pickHighestPriority(
        existingState.webhookStatus,
        connection.webhookStatus,
        WEBHOOK_STATUS_PRIORITY
      );
      states.set(capabilityKey, existingState);
    }
  }

  return {
    states: [...states.values()],
    approvalMode,
    derivedSurface,
  };
}

export async function buildConnectedAppReadinessContext(supabase, input = {}) {
  const ownerUserId = requireCleanText(input.ownerUserId || input.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(input.agentId || input.agent_id, "agent_id");
  const packageKey = normalizePackageKey(input.packageKey || input.package_key);
  const requiredCapabilities = normalizeCapabilityKeys(input.requiredCapabilities || input.required_capabilities);
  const optionalCapabilities = normalizeCapabilityKeys(input.optionalCapabilities || input.optional_capabilities);
  const requestedSurface = normalizeSafeToken(input.surface);
  const [connections, enablements] = await Promise.all([
    fetchOwnerConnections(supabase, ownerUserId),
    fetchAgentEnablements(supabase, { ownerUserId, agentId }),
  ]);
  const {
    states,
    approvalMode,
    derivedSurface,
  } = buildCapabilityStates({ connections, enablements, packageKey });
  const connectedCapabilities = [];
  const providerStatuses = {};
  const scopeGrants = {};
  const webhookStatuses = {};

  for (const state of states) {
    const definition = getConnectedAppCapability(state.capabilityKey);

    if (!definition) {
      continue;
    }

    if (state.connected) {
      connectedCapabilities.push(state.capabilityKey);
    }

    if (state.providerStatus) {
      providerStatuses[state.capabilityKey] = state.providerStatus;
    }

    if (definition.requiresOAuth && state.scopeGranted) {
      scopeGrants[state.capabilityKey] = true;
    }

    if (definition.requiresWebhook && state.webhookStatus) {
      webhookStatuses[state.capabilityKey] = state.webhookStatus;
    }
  }

  return {
    requiredCapabilities,
    optionalCapabilities,
    connectedCapabilities,
    providerStatuses,
    scopeGrants,
    webhookStatuses,
    approvalMode,
    surface: requestedSurface || derivedSurface,
    executionRequested: input.executionRequested === true || input.execution_requested === true,
  };
}
