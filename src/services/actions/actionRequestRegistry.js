const HOTEL_CONCIERGE_PACKAGE_KEYS = Object.freeze([
  "hotel_concierge",
]);

const SHARED_GUEST_CONTEXT_FIELDS = Object.freeze([
  "roomLabel",
  "guestName",
  "language",
]);

const ACTION_REQUEST_DEFINITION_INPUTS = Object.freeze([
  {
    key: "common.human_handoff",
    label: "Human handoff",
    description:
      "Request staff follow-up when the assistant cannot safely resolve the guest request in chat.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "reason",
      "preferredContact",
      "urgency",
      "notes",
    ]),
  },
  {
    key: "hotel.bring_water",
    label: "Bring water",
    description:
      "Request bottled water or drinking water delivery to a guest room.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "quantity",
      "deliveryLocation",
      "preferredTime",
      "notes",
    ]),
  },
  {
    key: "hotel.extra_towels",
    label: "Extra towels",
    description:
      "Request extra towels or linens for a guest room.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "item",
      "quantity",
      "deliveryLocation",
      "notes",
    ]),
  },
  {
    key: "hotel.room_service_request",
    label: "Room service request",
    description:
      "Request staff review for food, beverage, or room-service help.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "items",
      "quantity",
      "dietaryNotes",
      "preferredTime",
      "notes",
    ]),
  },
  {
    key: "hotel.housekeeping_request",
    label: "Housekeeping request",
    description:
      "Request room cleaning, refresh, or housekeeping follow-up.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "serviceType",
      "preferredTime",
      "doNotDisturb",
      "notes",
    ]),
  },
  {
    key: "hotel.maintenance_issue",
    label: "Maintenance issue",
    description:
      "Request staff follow-up for a room or property maintenance problem.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "issueType",
      "location",
      "urgency",
      "description",
      "notes",
    ]),
  },
  {
    key: "hotel.late_checkout_request",
    label: "Late checkout request",
    description:
      "Request staff review for a late checkout; this does not approve or change a booking.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "requestedCheckoutTime",
      "reservationReference",
      "notes",
    ]),
  },
  {
    key: "hotel.staff_help",
    label: "Staff help",
    description:
      "Request general staff assistance for a guest need that does not fit a more specific action type.",
    packageKeys: HOTEL_CONCIERGE_PACKAGE_KEYS,
    requiresStaffAction: true,
    requiresIntegration: false,
    externalExecution: false,
    payloadSchemaVersion: 1,
    guestContextFields: SHARED_GUEST_CONTEXT_FIELDS,
    payloadFields: Object.freeze([
      "topic",
      "urgency",
      "preferredContact",
      "notes",
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

const ACTION_REQUEST_DEFINITIONS = Object.freeze(
  ACTION_REQUEST_DEFINITION_INPUTS.map((definition) => cloneAndFreeze(definition))
);

const ACTION_REQUEST_DEFINITION_BY_KEY = new Map(
  ACTION_REQUEST_DEFINITIONS.map((definition) => [definition.key, definition])
);

function normalizeActionKey(actionKey) {
  if (typeof actionKey !== "string") {
    return "";
  }

  return actionKey.trim().toLowerCase();
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

function getDeclaredActionKeySet(packageOrKey) {
  if (!packageOrKey || typeof packageOrKey !== "object" || !Array.isArray(packageOrKey.actions)) {
    return null;
  }

  return new Set(packageOrKey.actions.map((actionKey) => normalizeActionKey(actionKey)).filter(Boolean));
}

function definitionAllowsPackage(definition, packageKey) {
  return definition.packageKeys.includes(packageKey);
}

export function getActionRequestDefinition(actionKey) {
  const definition = ACTION_REQUEST_DEFINITION_BY_KEY.get(normalizeActionKey(actionKey));

  return definition ? cloneAndFreeze(definition) : null;
}

export function listActionRequestDefinitions() {
  return Object.freeze(ACTION_REQUEST_DEFINITIONS.map((definition) => cloneAndFreeze(definition)));
}

export function listActionRequestDefinitionsForPackage(packageOrKey) {
  const packageKey = normalizePackageKey(packageOrKey);
  const declaredActionKeys = getDeclaredActionKeySet(packageOrKey);

  if (!packageKey) {
    return Object.freeze([]);
  }

  return Object.freeze(
    ACTION_REQUEST_DEFINITIONS
      .filter((definition) =>
        definitionAllowsPackage(definition, packageKey)
        && (!declaredActionKeys || declaredActionKeys.has(definition.key))
      )
      .map((definition) => cloneAndFreeze(definition))
  );
}

export function packageCanCreateActionRequest(packageOrKey, actionKey) {
  const packageKey = normalizePackageKey(packageOrKey);
  const normalizedActionKey = normalizeActionKey(actionKey);
  const definition = ACTION_REQUEST_DEFINITION_BY_KEY.get(normalizedActionKey);
  const declaredActionKeys = getDeclaredActionKeySet(packageOrKey);

  if (!packageKey || !definition || !definitionAllowsPackage(definition, packageKey)) {
    return false;
  }

  return !declaredActionKeys || declaredActionKeys.has(normalizedActionKey);
}

export function validatePackageActionDeclarations(agentPackage) {
  const packageKey = normalizePackageKey(agentPackage);
  const label = packageKey || "(unknown package)";
  const errors = [];

  if (!packageKey) {
    errors.push("Package is missing a valid key.");
  }

  if (!agentPackage || typeof agentPackage !== "object" || !Array.isArray(agentPackage.actions)) {
    errors.push(`Package ${label} must declare actions as an array.`);
    return Object.freeze(errors);
  }

  const seenActionKeys = new Set();

  for (const declaredActionKey of agentPackage.actions) {
    const normalizedActionKey = normalizeActionKey(declaredActionKey);

    if (!normalizedActionKey) {
      errors.push(`Package ${label} declares a malformed action key.`);
      continue;
    }

    if (seenActionKeys.has(normalizedActionKey)) {
      errors.push(`Package ${label} declares duplicate action ${normalizedActionKey}.`);
      continue;
    }

    seenActionKeys.add(normalizedActionKey);

    const definition = ACTION_REQUEST_DEFINITION_BY_KEY.get(normalizedActionKey);

    if (!definition) {
      errors.push(`Package ${label} declares unregistered action ${normalizedActionKey}.`);
      continue;
    }

    if (!definitionAllowsPackage(definition, packageKey)) {
      errors.push(`Package ${label} is not allowed to declare action ${normalizedActionKey}.`);
    }
  }

  return Object.freeze(errors);
}
