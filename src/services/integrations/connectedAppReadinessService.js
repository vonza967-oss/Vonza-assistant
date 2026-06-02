import {
  getConnectedAppCapability,
} from "./connectedAppRegistry.js";

const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/;
const PUBLIC_CHAT_SURFACES = new Set([
  "chat",
  "embed",
  "full_page",
  "public",
  "public_chat",
  "web_call",
  "widget",
]);
const BAD_PROVIDER_STATUSES = new Set([
  "disabled",
  "needs_attention",
]);
const CONNECTED_STATUSES = new Set([
  "active",
  "connected",
  "enabled",
  "granted",
  "ok",
  "ready",
]);
const ACTIVE_WEBHOOK_STATUSES = new Set([
  "active",
  "connected",
  "enabled",
  "ok",
  "ready",
]);

function cloneAndFreeze(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item)));
  }

  if (value && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, cloneAndFreeze(nestedValue)])
      )
    );
  }

  return value;
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value) {
  return cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeCapabilityKey(key) {
  const normalized = cleanText(key).toLowerCase();

  return CAPABILITY_KEY_PATTERN.test(normalized) ? normalized : "";
}

function normalizePackageKey(key) {
  const normalized = cleanText(key).toLowerCase();

  return /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/.test(normalized) ? normalized : "";
}

function normalizeSafeToken(value) {
  const normalized = normalizeToken(value);

  return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : "";
}

function normalizeStatus(value) {
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }

  if (typeof value === "string") {
    const normalized = normalizeToken(value);

    return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : "unknown";
  }

  if (value && typeof value === "object") {
    return normalizeStatus(
      value.status
      || value.connectionStatus
      || value.connection_status
      || value.readinessStatus
      || value.readiness_status
    );
  }

  return "";
}

function getCapabilityValue(collection, definition) {
  const plainCollection = toPlainObject(collection);

  return plainCollection[definition.key];
}

function getProviderStatus(providerStatuses, definition) {
  if (Array.isArray(providerStatuses)) {
    const match = providerStatuses.find((item) => {
      const statusItem = toPlainObject(item);
      const itemCapability = normalizeCapabilityKey(statusItem.capabilityKey || statusItem.capability);
      const itemProvider = normalizeSafeToken(statusItem.provider);

      return itemCapability === definition.key || itemProvider === definition.provider;
    });

    return match ? normalizeStatus(match) : "";
  }

  const plainStatuses = toPlainObject(providerStatuses);
  const capabilityStatus = normalizeStatus(plainStatuses[definition.key]);

  if (capabilityStatus) {
    return capabilityStatus;
  }

  return normalizeStatus(plainStatuses[definition.provider]);
}

function arrayIncludesCapability(values, definition) {
  return values.some((value) => {
    if (typeof value === "string") {
      const normalized = normalizeCapabilityKey(value);
      const normalizedToken = normalizeSafeToken(value);
      const normalizedProviderCapability = cleanText(value).toLowerCase();

      return normalized === definition.key
        || normalizedToken === definition.capability
        || normalizedProviderCapability === definition.capability;
    }

    if (value && typeof value === "object") {
      return arrayIncludesCapability([
        value.key,
        value.capabilityKey,
        value.capability,
      ], definition);
    }

    return false;
  });
}

function capabilityStatusIsActive(value) {
  if (value === true) {
    return true;
  }

  const status = normalizeStatus(value);

  return CONNECTED_STATUSES.has(status);
}

function hasConnectedCapability(connectedCapabilities, definition) {
  if (Array.isArray(connectedCapabilities)) {
    return arrayIncludesCapability(connectedCapabilities, definition);
  }

  const directValue = getCapabilityValue(connectedCapabilities, definition);

  return capabilityStatusIsActive(directValue);
}

function hasScopeGrant(scopeGrants, definition) {
  if (Array.isArray(scopeGrants)) {
    return arrayIncludesCapability(scopeGrants, definition);
  }

  const plainGrants = toPlainObject(scopeGrants);
  const directValue = plainGrants[definition.key];

  if (directValue === true || capabilityStatusIsActive(directValue)) {
    return true;
  }

  const providerValue = plainGrants[definition.provider];

  if (Array.isArray(providerValue)) {
    return arrayIncludesCapability(providerValue, definition);
  }

  if (providerValue && typeof providerValue === "object") {
    return providerValue[definition.key] === true
      || providerValue[definition.capability] === true
      || capabilityStatusIsActive(providerValue[definition.key])
      || capabilityStatusIsActive(providerValue[definition.capability]);
  }

  return false;
}

function webhookStatusIsActive(value) {
  if (value === true) {
    return true;
  }

  const status = normalizeStatus(value);

  return ACTIVE_WEBHOOK_STATUSES.has(status);
}

function hasActiveWebhook(webhookStatuses, definition) {
  if (Array.isArray(webhookStatuses)) {
    return webhookStatuses.some((item) => {
      if (typeof item === "string") {
        return normalizeCapabilityKey(item) === definition.key;
      }

      const webhookItem = toPlainObject(item);
      const itemCapability = normalizeCapabilityKey(webhookItem.capabilityKey || webhookItem.capability);

      return itemCapability === definition.key && webhookStatusIsActive(webhookItem);
    });
  }

  return webhookStatusIsActive(getCapabilityValue(webhookStatuses, definition));
}

function normalizeCapabilityList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        return item.key || item.capabilityKey || item.capability;
      }

      return "";
    });
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, enabled]) => enabled !== false && enabled !== null && enabled !== undefined)
      .map(([key]) => key);
  }

  return [];
}

function uniqueCapabilityEntries(value, requirementType) {
  const seen = new Set();

  return normalizeCapabilityList(value).flatMap((rawKey, index) => {
    const normalizedKey = normalizeCapabilityKey(rawKey);
    const safeKey = normalizedKey || `malformed_${requirementType}_${index + 1}`;

    if (seen.has(safeKey)) {
      return [];
    }

    seen.add(safeKey);

    return [{
      key: safeKey,
      normalizedKey,
      malformed: !normalizedKey,
    }];
  });
}

function reason(code, message) {
  return {
    code,
    message,
  };
}

function capabilityRequirement({
  definition,
  entry,
  requirementType,
  status,
  reasons,
  connected = false,
  providerStatus = "",
  scopeGranted = false,
  webhookActive = false,
}) {
  const capabilityKey = definition?.key || entry.key;

  return {
    key: `${requirementType}.${capabilityKey}`,
    capabilityKey,
    requirementType,
    status,
    label: definition?.label || "Unknown connected app capability",
    provider: definition?.provider || "",
    appName: definition?.appName || "",
    requiresOAuth: definition?.requiresOAuth === true,
    requiresWebhook: definition?.requiresWebhook === true,
    externalExecution: definition?.externalExecution === true,
    publicChatCallable: definition?.publicChatCallable === true,
    packageActivatable: definition?.packageActivatable === true,
    connected,
    providerStatus,
    scopeGranted,
    webhookActive,
    reasons,
  };
}

function evaluateCapabilityEntry(entry, input, requirementType) {
  const definition = entry.normalizedKey ? getConnectedAppCapability(entry.normalizedKey) : null;

  if (!definition) {
    return capabilityRequirement({
      definition,
      entry,
      requirementType,
      status: requirementType === "required" ? "blocked" : "warning",
      reasons: [
        reason(
          entry.malformed ? "malformed_capability" : "unknown_capability",
          requirementType === "required"
            ? "Required connected app capability is not known by the report-only registry."
            : "Optional connected app capability is not known by the report-only registry."
        ),
      ],
    });
  }

  const connected = hasConnectedCapability(input.connectedCapabilities, definition);
  const providerStatus = getProviderStatus(input.providerStatuses, definition);
  const scopeGranted = definition.requiresOAuth ? hasScopeGrant(input.scopeGrants, definition) : false;
  const webhookActive = definition.requiresWebhook ? hasActiveWebhook(input.webhookStatuses, definition) : false;
  const reasons = [];

  if (!connected) {
    reasons.push(reason("capability_missing", "Connected capability is not present in the supplied readiness context."));
  }

  if (BAD_PROVIDER_STATUSES.has(providerStatus)) {
    reasons.push(reason("provider_not_ready", "Provider status is not ready for this capability."));
  }

  if (definition.requiresOAuth && !scopeGranted) {
    reasons.push(reason("oauth_scope_missing", "Required OAuth capability does not have a supplied scope grant."));
  }

  if (definition.requiresWebhook && !webhookActive) {
    reasons.push(reason("webhook_inactive", "Required webhook capability does not have a supplied active webhook status."));
  }

  return capabilityRequirement({
    definition,
    entry,
    requirementType,
    status: reasons.length > 0
      ? (requirementType === "required" ? "blocked" : "warning")
      : "ready",
    reasons,
    connected,
    providerStatus,
    scopeGranted,
    webhookActive,
  });
}

function isPublicChatSurface(surface) {
  return PUBLIC_CHAT_SURFACES.has(surface);
}

function executionRequirement(input, requiredRequirements) {
  const requested = input.executionRequested === true;
  const surface = normalizeSafeToken(input.surface);

  if (!requested) {
    return null;
  }

  const knownRequiredRequirements = requiredRequirements.filter((requirement) => requirement.provider);
  const blockedRequiredRequirements = requiredRequirements.filter((requirement) => requirement.status === "blocked");
  const reasons = [];

  if (knownRequiredRequirements.length === 0) {
    reasons.push(reason("execution_capability_missing", "Execution was requested without a known required capability."));
  }

  if (blockedRequiredRequirements.length > 0) {
    reasons.push(reason("required_capability_not_ready", "Execution requires every required capability to be connected and ready."));
  }

  if (isPublicChatSurface(surface)) {
    reasons.push(reason("public_chat_execution_blocked", "Public chat execution is blocked for all current connected app capabilities."));
  }

  for (const requirement of knownRequiredRequirements) {
    const definition = getConnectedAppCapability(requirement.capabilityKey);

    if (!definition?.externalExecution) {
      reasons.push(reason("external_execution_not_allowed", "Capability definition does not allow external execution."));
      continue;
    }

    if (!definition.allowedSurfaces.includes(surface)) {
      reasons.push(reason("surface_not_allowed", "Capability definition does not allow external execution for the requested surface."));
    }
  }

  return {
    key: "execution.requested",
    requirementType: "execution",
    status: reasons.length > 0 ? "blocked" : "ready",
    label: "External execution request",
    surface,
    executionRequested: true,
    reportOnly: true,
    reasons,
  };
}

function summarizeRequirements(requirements) {
  const summary = {
    ready: 0,
    warning: 0,
    blocked: 0,
    requiredBlocked: 0,
    optionalWarnings: 0,
  };

  for (const requirement of requirements) {
    if (requirement.status === "ready") {
      summary.ready += 1;
    }

    if (requirement.status === "warning") {
      summary.warning += 1;
    }

    if (requirement.status === "blocked") {
      summary.blocked += 1;
    }

    if (requirement.requirementType === "required" && requirement.status === "blocked") {
      summary.requiredBlocked += 1;
    }

    if (requirement.requirementType === "optional" && requirement.status === "warning") {
      summary.optionalWarnings += 1;
    }
  }

  return summary;
}

function statusFromSummary(summary) {
  if (summary.blocked > 0) {
    return "blocked";
  }

  if (summary.warning > 0) {
    return "warning";
  }

  return "ready";
}

function buildRequirements(input) {
  const requiredRequirements = uniqueCapabilityEntries(input.requiredCapabilities, "required")
    .map((entry) => evaluateCapabilityEntry(entry, input, "required"));
  const optionalRequirements = uniqueCapabilityEntries(input.optionalCapabilities, "optional")
    .map((entry) => evaluateCapabilityEntry(entry, input, "optional"));
  const execution = executionRequirement(input, requiredRequirements);

  return execution
    ? [...requiredRequirements, ...optionalRequirements, execution]
    : [...requiredRequirements, ...optionalRequirements];
}

export function evaluateConnectedAppReadiness(input = {}) {
  const safeInput = toPlainObject(input);
  const requirements = buildRequirements(safeInput);
  const summary = summarizeRequirements(requirements);

  return cloneAndFreeze({
    packageKey: normalizePackageKey(safeInput.packageKey),
    agentScoped: Boolean(cleanText(safeInput.agentId)),
    approvalMode: normalizeSafeToken(safeInput.approvalMode),
    surface: normalizeSafeToken(safeInput.surface),
    executionRequested: safeInput.executionRequested === true,
    reportOnly: true,
    status: statusFromSummary(summary),
    requirements,
    summary,
  });
}

export function listConnectedAppReadinessRequirements(input = {}) {
  return evaluateConnectedAppReadiness(input).requirements;
}
