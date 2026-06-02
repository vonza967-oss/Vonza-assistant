const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/;

const CONNECTED_APP_CAPABILITY_INPUTS = Object.freeze([
  {
    key: "google.calendar.read",
    provider: "google",
    appName: "Google Calendar",
    capability: "calendar.read",
    label: "Google Calendar read",
    description:
      "Provider-specific operator workspace capability for reading Google Calendar context after the existing Google OAuth flow grants calendar read scope.",
    status: "existing",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: true,
    oauthScopes: Object.freeze([
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ]),
    requiresWebhook: false,
    requiresSecret: true,
    externalExecution: true,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["operator", "dashboard", "internal"]),
    proofSources: Object.freeze([
      "Google OAuth state and connected account tables exist for the operator workspace.",
      "Operator workspace services map granted Google scopes into calendar capabilities.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/agentRoutes.js",
      "src/services/operator/operatorWorkspaceService.js",
      "db/connected_operator_workspace.sql",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "This is not a generic connected-app permission grant.",
      "Provider execution remains inside authenticated operator workflows, not public chat.",
      "Tokens stay encrypted server-side and must never be surfaced by this registry.",
    ]),
  },
  {
    key: "google.calendar.write",
    provider: "google",
    appName: "Google Calendar",
    capability: "calendar.write",
    label: "Google Calendar write",
    description:
      "Provider-specific operator workspace capability for approved Google Calendar create, update, and cancel operations after the existing Google OAuth flow grants calendar write scope.",
    status: "existing",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: true,
    oauthScopes: Object.freeze([
      "https://www.googleapis.com/auth/calendar.events",
    ]),
    requiresWebhook: false,
    requiresSecret: true,
    externalExecution: true,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["operator", "dashboard", "internal"]),
    proofSources: Object.freeze([
      "Calendar mutation endpoints are authenticated owner/operator routes.",
      "Operator services require connected account status and calendar write capability before mutation.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/agentRoutes.js",
      "src/services/operator/operatorWorkspaceService.js",
      "db/connected_operator_workspace.sql",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Write capability is provider-specific and approval-gated by operator workflows.",
      "Public chat is not allowed to create, update, or cancel calendar events.",
      "Package metadata must not be treated as authorization to mutate Google Calendar.",
    ]),
  },
  {
    key: "google.gmail.read",
    provider: "google",
    appName: "Gmail",
    capability: "gmail.read",
    label: "Gmail read",
    description:
      "Provider-specific operator workspace capability for syncing Gmail inbox context when optional Gmail scopes are granted through the existing Google OAuth flow.",
    status: "existing",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: true,
    requiresWebhook: false,
    requiresSecret: true,
    externalExecution: true,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["operator", "dashboard", "internal"]),
    proofSources: Object.freeze([
      "Gmail exists only inside the Google operator workspace.",
      "Optional Google Gmail scopes are mapped into operator workspace capabilities.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/agentRoutes.js",
      "src/services/operator/operatorWorkspaceService.js",
      "db/connected_operator_workspace.sql",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Gmail is not a separate generic connected app in the current runtime.",
      "Inbox reads remain provider-specific operator functionality.",
      "This declaration exposes no mailbox data, OAuth URL, token, or provider client.",
    ]),
  },
  {
    key: "calendly.booking.webhook",
    provider: "calendly",
    appName: "Calendly",
    capability: "booking.webhook",
    label: "Calendly booking webhook",
    description:
      "Provider-specific signed webhook ingestion for trusted booking-confirmation outcome evidence from Calendly.",
    status: "existing",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: false,
    requiresWebhook: true,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["webhook", "internal"]),
    proofSources: Object.freeze([
      "Calendly webhook provisioning stores a hashed endpoint token and encrypted signing secret.",
      "Webhook ingestion verifies Calendly signatures before recording trusted booking outcomes.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/bookingRoutes.js",
      "src/services/bookings/bookingIntegrationService.js",
      "src/services/bookings/calendlyProvider.js",
      "scripts/provision-calendly-webhook.js",
      "db/agent_booking_integrations.sql",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "This capability receives provider proof only; it does not let chat book or change appointments.",
      "The integration table is constrained to Calendly and is not a generic app connection table.",
      "Webhook endpoint tokens and signing secrets must remain outside registry data.",
    ]),
  },
  {
    key: "stripe.billing.webhook",
    provider: "stripe",
    appName: "Stripe",
    capability: "billing.webhook",
    label: "Stripe billing webhook",
    description:
      "Provider-specific billing webhook ingestion for Stripe checkout and subscription events tied to owner billing state.",
    status: "internal",
    ownerScoped: true,
    agentScoped: false,
    requiresOAuth: false,
    requiresWebhook: true,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["webhook", "dashboard", "internal"]),
    proofSources: Object.freeze([
      "Stripe webhooks use raw body signature verification before syncing billing state.",
      "Billing records are owner-level product/account state rather than agent connected-app grants.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/agentRoutes.js",
      "src/services/billing/checkoutService.js",
      "src/services/billing/billingUsageService.js",
      "src/services/billing/stripeEntitlementShadowService.js",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Stripe billing is not a package-activatable connected app capability.",
      "This registry does not expose Stripe keys, webhook secrets, prices, or clients.",
      "Billing webhooks do not grant public chat permission to execute provider actions.",
    ]),
  },
  {
    key: "twilio.phone.webhook",
    provider: "twilio",
    appName: "Twilio",
    capability: "phone.webhook",
    label: "Twilio phone webhook",
    description:
      "Provider-specific phone webhook ingestion for assigned Twilio phone numbers and call status callbacks.",
    status: "existing",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: false,
    requiresWebhook: true,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["webhook", "internal"]),
    proofSources: Object.freeze([
      "Twilio inbound and status routes validate Twilio signatures.",
      "Admin-assigned phone numbers bind provider calls to owner, agent, and business scope.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/routes/phoneRoutes.js",
      "src/services/phone/twilioWebhookService.js",
      "src/services/phone/phoneNumberService.js",
      "src/services/phone/phoneCallSessionService.js",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Twilio phone setup is admin/provider-specific, not a generic owner self-serve connection.",
      "Phone webhooks do not create a package permission grant.",
      "This registry does not expose Twilio auth tokens, account SIDs, or webhook URLs.",
    ]),
  },
  {
    key: "whatsapp.business.webhook",
    provider: "whatsapp",
    appName: "WhatsApp Business",
    capability: "business.webhook",
    label: "WhatsApp Business webhook readiness",
    description:
      "Manual/status-only WhatsApp Business capability for future inbound webhook verification readiness. This phase records safe setup state only and does not add a public WhatsApp webhook receiver.",
    status: "planned",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: false,
    requiresWebhook: true,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["webhook", "dashboard", "internal"]),
    proofSources: Object.freeze([
      "Future Meta webhook verification will require a verified callback endpoint and signed POST validation.",
      "Current generic records can store only redacted webhook status and safe WhatsApp account identifiers.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/services/integrations/connectedAppRegistry.js",
      "src/services/integrations/connectedAppConnectionService.js",
      "src/services/integrations/connectedAppReadinessService.js",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Manual/internal setup only.",
      "No WhatsApp messages are sent or received by this capability.",
      "No WhatsApp webhook receiver, Meta OAuth, Embedded Signup, or Cloud API client exists yet.",
      "Access tokens, app secrets, verify tokens, and webhook secrets must stay out of metadata and route responses.",
    ]),
  },
  {
    key: "whatsapp.business.send.template",
    provider: "whatsapp",
    appName: "WhatsApp Business",
    capability: "business.send.template",
    label: "WhatsApp Business template send",
    description:
      "Manual/status-only WhatsApp Business capability for future approved-template outbound messaging. It is not executable in the current runtime.",
    status: "planned",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: false,
    requiresWebhook: false,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["dashboard", "internal"]),
    proofSources: Object.freeze([
      "Future template sends must use approved WhatsApp Business templates and provider proof.",
      "Current generic records can store only redacted readiness/status metadata.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/services/integrations/connectedAppRegistry.js",
      "src/services/integrations/connectedAppConnectionService.js",
      "src/services/integrations/connectedAppReadinessService.js",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Manual/internal setup only.",
      "No WhatsApp template message sender exists yet.",
      "Future template execution must require approved templates, opt-in, owner connection, agent enablement, approved surface, provider proof, and audit logging.",
      "Access tokens and app secrets must stay out of metadata and route responses.",
    ]),
  },
  {
    key: "whatsapp.business.send.session.reply",
    provider: "whatsapp",
    appName: "WhatsApp Business",
    capability: "business.send.session.reply",
    label: "WhatsApp Business session reply",
    description:
      "Manual/status-only WhatsApp Business capability for future replies within an allowed customer-service session window. It is not executable in the current runtime.",
    status: "planned",
    ownerScoped: true,
    agentScoped: true,
    requiresOAuth: false,
    requiresWebhook: false,
    requiresSecret: true,
    externalExecution: false,
    publicChatCallable: false,
    packageActivatable: false,
    allowedSurfaces: Object.freeze(["dashboard", "internal"]),
    proofSources: Object.freeze([
      "Future session replies must prove an eligible WhatsApp customer-service window.",
      "Current generic records can store only redacted readiness/status metadata.",
    ]),
    existingCodeRefs: Object.freeze([
      "src/services/integrations/connectedAppRegistry.js",
      "src/services/integrations/connectedAppConnectionService.js",
      "src/services/integrations/connectedAppReadinessService.js",
      "db/schema.sql",
    ]),
    safetyNotes: Object.freeze([
      "Manual/internal setup only.",
      "No WhatsApp session reply sender exists yet.",
      "Future session replies must stay inside the allowed customer-service window and require owner connection, agent enablement, approved surface, provider proof, and audit logging.",
      "Access tokens and app secrets must stay out of metadata and route responses.",
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

function normalizeCapabilityKey(key) {
  if (typeof key !== "string") {
    return "";
  }

  const normalized = key.trim().toLowerCase();

  return CAPABILITY_KEY_PATTERN.test(normalized) ? normalized : "";
}

function normalizeProvider(provider) {
  return typeof provider === "string" ? provider.trim().toLowerCase() : "";
}

const CONNECTED_APP_CAPABILITIES = Object.freeze(
  CONNECTED_APP_CAPABILITY_INPUTS.map((definition) => cloneAndFreeze(definition))
);

const CONNECTED_APP_CAPABILITY_BY_KEY = new Map(
  CONNECTED_APP_CAPABILITIES.map((definition) => [definition.key, definition])
);

export function getConnectedAppCapability(key) {
  const definition = CONNECTED_APP_CAPABILITY_BY_KEY.get(normalizeCapabilityKey(key));

  return definition ? cloneAndFreeze(definition) : null;
}

export function listConnectedAppCapabilities() {
  return Object.freeze(
    CONNECTED_APP_CAPABILITIES.map((definition) => cloneAndFreeze(definition))
  );
}

export function listConnectedAppCapabilitiesForProvider(provider) {
  const normalizedProvider = normalizeProvider(provider);

  if (!normalizedProvider) {
    return Object.freeze([]);
  }

  return Object.freeze(
    CONNECTED_APP_CAPABILITIES
      .filter((definition) => definition.provider === normalizedProvider)
      .map((definition) => cloneAndFreeze(definition))
  );
}

export function hasConnectedAppCapability(key) {
  return CONNECTED_APP_CAPABILITY_BY_KEY.has(normalizeCapabilityKey(key));
}

export function validateConnectedAppCapabilityDeclarations(keys) {
  const errors = [];

  if (!Array.isArray(keys)) {
    return Object.freeze(["Connected app capability declarations must be an array."]);
  }

  const seenKeys = new Set();

  for (const declaredKey of keys) {
    const normalizedKey = normalizeCapabilityKey(declaredKey);

    if (!normalizedKey) {
      errors.push("Connected app capability declaration includes a malformed key.");
      continue;
    }

    if (seenKeys.has(normalizedKey)) {
      errors.push(`Connected app capability declaration includes duplicate key ${normalizedKey}.`);
      continue;
    }

    seenKeys.add(normalizedKey);

    if (!CONNECTED_APP_CAPABILITY_BY_KEY.has(normalizedKey)) {
      errors.push(`Connected app capability declaration includes unknown key ${normalizedKey}.`);
    }
  }

  return Object.freeze(errors);
}
