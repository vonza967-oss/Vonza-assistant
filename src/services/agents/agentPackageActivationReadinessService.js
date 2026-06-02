import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
  isKnownAgentPackageKey,
} from "../../agentPackages/index.js";
import {
  listActionRequestDefinitionsForPackage,
  validatePackageActionDeclarations,
} from "../actions/actionRequestRegistry.js";
import {
  evaluateConnectedAppReadiness,
} from "../integrations/connectedAppReadinessService.js";

const HOTEL_CONCIERGE_PACKAGE_KEY = "hotel_concierge";
const DEFAULT_ACTIVATION_TARGET = "internal";
const REPORT_ONLY_POLICY_MODE = "report-only";

const HOTEL_REQUIRED_DATA_FLAGS = Object.freeze([
  {
    key: "hotelRules",
    label: "Hotel rules",
  },
  {
    key: "breakfast",
    label: "Breakfast details",
  },
  {
    key: "amenities",
    label: "Amenities",
  },
  {
    key: "checkoutPolicy",
    label: "Checkout policy",
  },
  {
    key: "staffEscalation",
    label: "Staff escalation path",
  },
]);

const HOTEL_RECOMMENDED_DATA_FLAGS = Object.freeze([
  {
    key: "parking",
    label: "Parking details",
  },
  {
    key: "petPolicy",
    label: "Pet policy",
  },
  {
    key: "localRecommendations",
    label: "Local recommendations",
  },
  {
    key: "cancellationPolicy",
    label: "Cancellation policy",
  },
]);

function normalizeKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function packageKeyFromInput(packageOrKey) {
  if (typeof packageOrKey === "string") {
    return normalizeKey(packageOrKey);
  }

  return normalizeKey(packageOrKey?.key);
}

function resolvePackageInput(packageOrKey) {
  const packageKey = packageKeyFromInput(packageOrKey || DEFAULT_AGENT_PACKAGE_KEY);
  const registered = isKnownAgentPackageKey(packageKey);

  if (!registered) {
    return {
      packageKey,
      packageVersion: "",
      registered: false,
      agentPackage: null,
    };
  }

  const registryPackage = getAgentPackage(packageKey);
  const suppliedPackage = packageOrKey && typeof packageOrKey === "object" ? packageOrKey : null;
  const agentPackage = suppliedPackage || registryPackage;

  return {
    packageKey: registryPackage.key,
    packageVersion: agentPackage.version || registryPackage.version || "",
    registered: true,
    agentPackage,
  };
}

function requirement(key, status, label, message, severity = "required") {
  return {
    key,
    status,
    label,
    message,
    severity,
  };
}

function passed(key, label, message, severity = "required") {
  return requirement(key, "passed", label, message, severity);
}

function blocked(key, label, message, severity = "required") {
  return requirement(key, "blocked", label, message, severity);
}

function warning(key, label, message, severity = "recommended") {
  return requirement(key, "warning", label, message, severity);
}

function summarizeRequirements(requirements) {
  const summary = {
    passed: 0,
    blocked: 0,
    warning: 0,
    requiredBlocked: 0,
    recommendedWarnings: 0,
  };

  for (const item of requirements) {
    if (item.status === "passed") {
      summary.passed += 1;
    }

    if (item.status === "blocked") {
      summary.blocked += 1;
    }

    if (item.status === "warning") {
      summary.warning += 1;
    }

    if (item.status === "blocked" && item.severity === "required") {
      summary.requiredBlocked += 1;
    }

    if (item.status === "warning" && item.severity === "recommended") {
      summary.recommendedWarnings += 1;
    }
  }

  return summary;
}

function statusFromSummary(summary) {
  if (summary.requiredBlocked > 0 || summary.blocked > 0) {
    return "blocked";
  }

  if (summary.warning > 0) {
    return "warning";
  }

  return "ready";
}

function normalizeManifestConnectedAppRequirements(agentPackage) {
  const requirements = agentPackage?.connectedAppRequirements;

  if (Array.isArray(requirements)) {
    return {
      requiredCapabilities: requirements,
      optionalCapabilities: [],
    };
  }

  const plainRequirements = toPlainObject(requirements);

  return {
    requiredCapabilities: Array.isArray(plainRequirements.requiredCapabilities)
      ? plainRequirements.requiredCapabilities
      : [],
    optionalCapabilities: Array.isArray(plainRequirements.optionalCapabilities)
      ? plainRequirements.optionalCapabilities
      : [],
  };
}

function hasConnectedAppContext(context) {
  return Object.hasOwn(context, "connectedApps");
}

function buildConnectedAppReadinessInput(resolved, context) {
  const connectedApps = toPlainObject(context.connectedApps);
  const manifestRequirements = normalizeManifestConnectedAppRequirements(resolved.agentPackage);

  return {
    packageKey: resolved.packageKey,
    agentId: connectedApps.agentId,
    requiredCapabilities: Object.hasOwn(connectedApps, "requiredCapabilities")
      ? connectedApps.requiredCapabilities
      : manifestRequirements.requiredCapabilities,
    optionalCapabilities: Object.hasOwn(connectedApps, "optionalCapabilities")
      ? connectedApps.optionalCapabilities
      : manifestRequirements.optionalCapabilities,
    connectedCapabilities: connectedApps.connectedCapabilities,
    providerStatuses: connectedApps.providerStatuses,
    scopeGrants: connectedApps.scopeGrants,
    webhookStatuses: connectedApps.webhookStatuses,
    approvalMode: connectedApps.approvalMode,
    surface: connectedApps.surface,
    executionRequested: connectedApps.executionRequested === true,
  };
}

function evaluateRegisteredPackageGate(resolved) {
  if (!resolved.registered) {
    return blocked(
      "registered_package",
      "Registered package",
      resolved.packageKey
        ? `Package '${resolved.packageKey}' is not registered.`
        : "Package key is missing or malformed."
    );
  }

  return passed(
    "registered_package",
    "Registered package",
    `Package '${resolved.packageKey}' is registered.`
  );
}

function evaluateActionDeclarationGate(resolved) {
  if (!resolved.agentPackage) {
    return blocked(
      "action_declarations_valid",
      "Action declarations",
      "Action declarations cannot be validated for an unknown package."
    );
  }

  const errors = validatePackageActionDeclarations(resolved.agentPackage);

  if (errors.length > 0) {
    return blocked(
      "action_declarations_valid",
      "Action declarations",
      `Package action declarations are invalid: ${errors.join(" ")}`
    );
  }

  return passed(
    "action_declarations_valid",
    "Action declarations",
    "Package action declarations validate against the action request registry."
  );
}

function evaluateActionRegistryGate(resolved, context) {
  if (!resolved.agentPackage) {
    return blocked(
      "action_request_registry_valid",
      "Action request registry",
      "Action request registry cannot be validated for an unknown package."
    );
  }

  const declaredDefinitions = listActionRequestDefinitionsForPackage(resolved.agentPackage);
  const declaredActionCount = Array.isArray(resolved.agentPackage.actions)
    ? resolved.agentPackage.actions.length
    : 0;

  if (declaredActionCount === 0) {
    return passed(
      "action_request_registry_valid",
      "Action request registry",
      "Package declares no package-specific action requests."
    );
  }

  if (declaredDefinitions.length !== declaredActionCount) {
    return blocked(
      "action_request_registry_valid",
      "Action request registry",
      "Not every declared package action has a matching allowed action request definition."
    );
  }

  if (toPlainObject(context.actions).registryValidated !== true) {
    return blocked(
      "action_request_registry_valid",
      "Action request registry",
      "Action request registry validation has not been confirmed for this package."
    );
  }

  return passed(
    "action_request_registry_valid",
    "Action request registry",
    "Action request registry validation is confirmed for this package."
  );
}

function evaluateHotelStaffWorkflow(context) {
  if (toPlainObject(context.staffWorkflow).actionRequestQueueEnabled === true) {
    return passed(
      "staff_action_queue_enabled",
      "Staff action queue",
      "Staff action request queue is enabled for controlled activation."
    );
  }

  return blocked(
    "staff_action_queue_enabled",
    "Staff action queue",
    "Hotel Concierge requires the staff action request queue before activation."
  );
}

function evaluateRequiredHotelData(context) {
  const requiredData = toPlainObject(context.requiredData);
  const missing = HOTEL_REQUIRED_DATA_FLAGS.filter((flag) => requiredData[flag.key] !== true);

  if (missing.length > 0) {
    return blocked(
      "required_hotel_data",
      "Required hotel data",
      `Missing required hotel data: ${missing.map((flag) => flag.label).join(", ")}.`
    );
  }

  return passed(
    "required_hotel_data",
    "Required hotel data",
    "Required hotel data flags are present."
  );
}

function evaluateRecommendedHotelData(context) {
  const requiredData = toPlainObject(context.requiredData);
  const recommendedData = {
    ...Object.fromEntries(
      HOTEL_RECOMMENDED_DATA_FLAGS
        .filter((flag) => Object.hasOwn(requiredData, flag.key))
        .map((flag) => [flag.key, requiredData[flag.key]])
    ),
    ...toPlainObject(context.recommendedData),
  };

  if (Object.keys(recommendedData).length === 0) {
    return null;
  }

  const missing = HOTEL_RECOMMENDED_DATA_FLAGS.filter((flag) => recommendedData[flag.key] === false);

  if (missing.length > 0) {
    return warning(
      "recommended_hotel_data",
      "Recommended hotel data",
      `Missing recommended hotel data: ${missing.map((flag) => flag.label).join(", ")}.`
    );
  }

  return passed(
    "recommended_hotel_data",
    "Recommended hotel data",
    "Recommended hotel data flags have no reported gaps.",
    "recommended"
  );
}

function evaluateHotelEval(context) {
  const hotelEval = toPlainObject(toPlainObject(context.evals).hotelConcierge);

  if (hotelEval.passed === true && Number(hotelEval.failed || 0) === 0) {
    return passed(
      "hotel_concierge_eval_passed",
      "Hotel Concierge eval",
      `Hotel Concierge eval passed${Number.isFinite(hotelEval.total) ? ` ${hotelEval.total} scenarios` : ""}.`
    );
  }

  return blocked(
    "hotel_concierge_eval_passed",
    "Hotel Concierge eval",
    "Hotel Concierge eval result is missing, failed, or has failures."
  );
}

function evaluateExposure(context) {
  const exposure = toPlainObject(context.exposure);
  const enabledFlags = [
    ["dashboardSelectorEnabled", "dashboard package selector"],
    ["publicPackageSwitchingEnabled", "public package switching"],
    ["widgetPackageParamEnabled", "widget package parameter"],
  ].filter(([flagKey]) => exposure[flagKey] === true);

  if (enabledFlags.length > 0) {
    return blocked(
      "package_exposure_disabled",
      "Package exposure disabled",
      `Activation requires exposure flags off; enabled: ${enabledFlags.map(([, label]) => label).join(", ")}.`
    );
  }

  return passed(
    "package_exposure_disabled",
    "Package exposure disabled",
    "Dashboard selectors, public package switching, and widget package parameters are disabled."
  );
}

function evaluateActivationTarget(resolved, context) {
  const activationTarget = normalizeKey(context.activationTarget) || DEFAULT_ACTIVATION_TARGET;

  if (
    resolved.packageKey === HOTEL_CONCIERGE_PACKAGE_KEY
    && ["public", "dashboard"].includes(activationTarget)
    && toPlainObject(context.exposure).hotelConciergePublicActivationSafe !== true
  ) {
    return blocked(
      "activation_target_allowed",
      "Activation target",
      "Hotel Concierge public/dashboard activation requires an explicit future safety marker."
    );
  }

  return passed(
    "activation_target_allowed",
    "Activation target",
    `Activation target '${activationTarget}' is allowed for report-only readiness evaluation.`
  );
}

function evaluateIntegrationReadiness(context) {
  const integrations = toPlainObject(context.integrations);

  if (
    integrations.externalExecutionEnabled === true
    && integrations.externalExecutionReady !== true
    && integrations.integrationReadinessConfirmed !== true
  ) {
    return blocked(
      "external_execution_disabled_or_ready",
      "External execution",
      "External execution is enabled without explicit integration readiness."
    );
  }

  if (integrations.externalExecutionEnabled === true) {
    return passed(
      "external_execution_disabled_or_ready",
      "External execution",
      "External execution readiness was explicitly confirmed."
    );
  }

  return passed(
    "external_execution_disabled_or_ready",
    "External execution",
    "External execution is disabled; live booking and PMS integrations are not required for MVP."
  );
}

function evaluatePolicyMode(context) {
  const policy = toPlainObject(context.policy);
  const mode = policy.mode || REPORT_ONLY_POLICY_MODE;

  if (mode !== REPORT_ONLY_POLICY_MODE || policy.enforcementEnabled === true) {
    return blocked(
      "policy_report_only",
      "Report-only policy",
      "Activation readiness only supports report-only policy mode in this phase."
    );
  }

  return passed(
    "policy_report_only",
    "Report-only policy",
    "Policy mode is report-only; no enforcement is activated."
  );
}

function buildRequirements(resolved, context) {
  const requirements = [
    evaluateRegisteredPackageGate(resolved),
    evaluateActionDeclarationGate(resolved),
    evaluateActionRegistryGate(resolved, context),
    evaluateActivationTarget(resolved, context),
    evaluateExposure(context),
    evaluateIntegrationReadiness(context),
    evaluatePolicyMode(context),
  ];

  if (resolved.packageKey === HOTEL_CONCIERGE_PACKAGE_KEY) {
    requirements.push(
      evaluateHotelStaffWorkflow(context),
      evaluateRequiredHotelData(context),
      evaluateHotelEval(context)
    );

    const recommendedHotelData = evaluateRecommendedHotelData(context);

    if (recommendedHotelData) {
      requirements.push(recommendedHotelData);
    }
  }

  return requirements;
}

export function evaluateAgentPackageActivationReadiness(packageOrKey, context = {}) {
  const safeContext = toPlainObject(context);
  const resolved = resolvePackageInput(packageOrKey);
  const requirements = buildRequirements(resolved, safeContext);
  const summary = summarizeRequirements(requirements);
  const result = {
    packageKey: resolved.packageKey,
    packageVersion: resolved.packageVersion,
    status: statusFromSummary(summary),
    requirements,
    summary,
  };

  if (hasConnectedAppContext(safeContext)) {
    result.connectedApps = evaluateConnectedAppReadiness(
      buildConnectedAppReadinessInput(resolved, safeContext)
    );
  }

  return result;
}

export function listAgentPackageActivationRequirements(packageOrKey) {
  return evaluateAgentPackageActivationReadiness(packageOrKey).requirements;
}
