const COMMON_PACKAGE_KEYS = Object.freeze([
  "front_desk_general",
  "hotel_concierge",
]);

const TOOL_DEFINITION_INPUTS = Object.freeze([
  {
    key: "common.lead_capture",
    label: "Lead capture",
    description:
      "Metadata declaration for the existing live lead-capture surface that can prompt high-intent visitors for contact details and persist capture state.",
    allowedPackages: COMMON_PACKAGE_KEYS,
    riskLevel: "medium",
    status: "active_metadata",
    existingRuntimeSurfaces: Object.freeze([
      "live lead capture service",
      "chat response leadCapture payload",
      "follow-up workflow sync",
    ]),
    claimTypes: Object.freeze([
      "visitor_contact_collection",
      "follow_up_request",
      "booking_interest",
      "pricing_interest",
    ]),
  },
  {
    key: "common.contact_route",
    label: "Contact route",
    description:
      "Metadata declaration for existing direct routing to configured phone or email contact destinations when a visitor asks to contact the business.",
    allowedPackages: COMMON_PACKAGE_KEYS,
    riskLevel: "medium",
    status: "active_metadata",
    existingRuntimeSurfaces: Object.freeze([
      "live conversion routing contact CTA",
      "configured widget contact email",
      "configured widget contact phone",
    ]),
    claimTypes: Object.freeze([
      "contact_destination",
      "contact_preference",
      "human_contact_request",
    ]),
  },
  {
    key: "common.booking_link",
    label: "Booking link",
    description:
      "Metadata declaration for existing routing to a configured booking URL. It describes link routing only and does not prove booking availability.",
    allowedPackages: COMMON_PACKAGE_KEYS,
    riskLevel: "medium",
    status: "active_metadata",
    existingRuntimeSurfaces: Object.freeze([
      "live conversion routing booking CTA",
      "configured widget booking URL",
    ]),
    claimTypes: Object.freeze([
      "booking_destination",
      "booking_next_step",
    ]),
  },
  {
    key: "common.human_handoff",
    label: "Human handoff",
    description:
      "Metadata declaration for existing human/staff request handling through direct contact routing or capture fallback. It is not a live operator transfer.",
    allowedPackages: COMMON_PACKAGE_KEYS,
    riskLevel: "medium",
    status: "active_metadata",
    existingRuntimeSurfaces: Object.freeze([
      "live conversion routing contact intent",
      "lead capture fallback",
      "owner follow-up workflow",
    ]),
    claimTypes: Object.freeze([
      "staff_follow_up",
      "callback_request",
      "contact_route",
    ]),
  },
  {
    key: "hotel.booking_availability",
    label: "Hotel booking availability",
    description:
      "Planned metadata-only hotel capability for live booking availability. It must not be callable until availability claims can be backed by live booking evidence.",
    allowedPackages: Object.freeze([
      "hotel_concierge",
    ]),
    riskLevel: "high",
    status: "planned",
    existingRuntimeSurfaces: Object.freeze([
      "none; planned metadata only",
    ]),
    claimTypes: Object.freeze([
      "room_availability",
      "stay_dates",
      "rate_or_inventory",
      "booking_policy",
    ]),
    evidenceRequirements: Object.freeze([
      "live booking provider response",
      "timestamped availability evidence",
      "property-scoped booking source",
    ]),
  },
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

const TOOL_DEFINITIONS = Object.freeze(
  TOOL_DEFINITION_INPUTS.map((definition) => cloneAndFreeze(definition))
);

const TOOL_DEFINITION_BY_KEY = new Map(
  TOOL_DEFINITIONS.map((definition) => [definition.key, definition])
);

function normalizeToolKey(key) {
  if (typeof key !== "string") {
    return "";
  }

  return key.trim().toLowerCase();
}

function normalizePackageKey(packageOrKey) {
  if (typeof packageOrKey === "string") {
    return packageOrKey.trim().toLowerCase();
  }

  if (packageOrKey && typeof packageOrKey === "object" && typeof packageOrKey.key === "string") {
    return packageOrKey.key.trim().toLowerCase();
  }

  return "";
}

function getDeclaredToolKeySet(packageOrKey) {
  if (!packageOrKey || typeof packageOrKey !== "object" || !Array.isArray(packageOrKey.tools)) {
    return null;
  }

  return new Set(packageOrKey.tools.map((toolKey) => normalizeToolKey(toolKey)).filter(Boolean));
}

function definitionAllowsPackage(definition, packageKey) {
  return definition.allowedPackages.includes(packageKey);
}

export function getToolDefinition(key) {
  const definition = TOOL_DEFINITION_BY_KEY.get(normalizeToolKey(key));

  return definition ? cloneAndFreeze(definition) : null;
}

export function listToolDefinitions() {
  return Object.freeze(TOOL_DEFINITIONS.map((definition) => cloneAndFreeze(definition)));
}

export function listToolDefinitionsForPackage(packageOrKey) {
  const packageKey = normalizePackageKey(packageOrKey);
  const declaredToolKeys = getDeclaredToolKeySet(packageOrKey);

  if (!packageKey) {
    return Object.freeze([]);
  }

  return Object.freeze(
    TOOL_DEFINITIONS
      .filter((definition) =>
        definitionAllowsPackage(definition, packageKey) &&
        (!declaredToolKeys || declaredToolKeys.has(definition.key))
      )
      .map((definition) => cloneAndFreeze(definition))
  );
}

export function packageCanUseTool(packageOrKey, toolKey) {
  const packageKey = normalizePackageKey(packageOrKey);
  const normalizedToolKey = normalizeToolKey(toolKey);
  const definition = TOOL_DEFINITION_BY_KEY.get(normalizedToolKey);
  const declaredToolKeys = getDeclaredToolKeySet(packageOrKey);

  if (!packageKey || !definition || !definitionAllowsPackage(definition, packageKey)) {
    return false;
  }

  return !declaredToolKeys || declaredToolKeys.has(normalizedToolKey);
}

export function validatePackageToolDeclarations(agentPackage) {
  const packageKey = normalizePackageKey(agentPackage);
  const label = packageKey || "(unknown package)";
  const errors = [];

  if (!packageKey) {
    errors.push("Package is missing a valid key.");
  }

  if (!agentPackage || typeof agentPackage !== "object" || !Array.isArray(agentPackage.tools)) {
    errors.push(`Package ${label} must declare tools as an array.`);
    return Object.freeze(errors);
  }

  const seenToolKeys = new Set();

  for (const declaredToolKey of agentPackage.tools) {
    const normalizedToolKey = normalizeToolKey(declaredToolKey);

    if (!normalizedToolKey) {
      errors.push(`Package ${label} declares a malformed tool key.`);
      continue;
    }

    if (seenToolKeys.has(normalizedToolKey)) {
      errors.push(`Package ${label} declares duplicate tool ${normalizedToolKey}.`);
      continue;
    }

    seenToolKeys.add(normalizedToolKey);

    const definition = TOOL_DEFINITION_BY_KEY.get(normalizedToolKey);

    if (!definition) {
      errors.push(`Package ${label} declares unregistered tool ${normalizedToolKey}.`);
      continue;
    }

    if (!definitionAllowsPackage(definition, packageKey)) {
      errors.push(`Package ${label} is not allowed to declare tool ${normalizedToolKey}.`);
    }
  }

  return Object.freeze(errors);
}
