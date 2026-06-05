import { createHash } from "node:crypto";
import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import { getAuthenticatedUser } from "../services/auth/authService.js";
import { requireActiveAgentAccess } from "../services/agents/agentService.js";
import {
  ENTERPRISE_REQUEST_DESK_REQUEST_STATUSES,
  ENTERPRISE_REQUEST_DESK_REVIEW_STATUSES,
  createEnterpriseRequestDeskRequest,
  listEnterpriseRequestDeskRequests,
  updateEnterpriseRequestDeskRequestStatus,
} from "../services/enterprise/enterpriseRequestDeskRequestService.js";
import {
  generateEnterpriseRequestDeskAssistantTurn,
} from "../services/enterprise/enterpriseRequestDeskAssistantService.js";
import { listEnterpriseRequestDeskLanes } from "../services/enterprise/enterpriseRequestDeskLaneService.js";
import {
  getEnterpriseRequestDeskPublicAgentForOwner,
  getEnterpriseRequestDeskSetup,
  saveEnterpriseRequestDeskSetup,
} from "../services/enterprise/enterpriseRequestDeskSetupService.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";
import { readBodyField } from "./agentRouteHelpers.js";

const AGENTS_TABLE = "agents";
const ENTERPRISE_PUBLIC_INTAKE_SOURCE_CHANNEL = "enterprise_request_desk_public_intake";
const ENTERPRISE_PUBLIC_INTAKE_PHASE = "pilot_request_loop";
const ENTERPRISE_AI_INTAKE_SOURCE_CHANNEL = "enterprise_request_desk_ai_intake";
const ENTERPRISE_AI_INTAKE_PHASE = "conversational_ai_intake";
const ENTERPRISE_DISPLAY_MODE = "enterprise_request_desk_intake";
const ENTERPRISE_PUBLIC_INTAKE_ALLOWED_FIELDS = new Set([
  "agent_key",
  "agentKey",
  "message",
  "request_text",
  "requestText",
  "site_or_object",
  "siteOrObject",
  "location_text",
  "locationText",
  "service_need",
  "serviceNeed",
  "timing_text",
  "timingText",
  "urgency",
  "contact_name",
  "contactName",
  "contact_email",
  "contactEmail",
  "email",
  "contact_phone",
  "contactPhone",
  "phone",
  "consent_acknowledged",
  "consentAcknowledged",
  "acknowledgement",
  "language",
]);
const ENTERPRISE_PUBLIC_ASSISTANT_ALLOWED_FIELDS = new Set([
  "agent_key",
  "agentKey",
  "message",
  "conversation",
  "history",
  "fields",
  "current_fields",
  "currentFields",
  "confirm_submit",
  "confirmSubmit",
  "consent_acknowledged",
  "consentAcknowledged",
  "language",
]);
const ENTERPRISE_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN =
  /(?:owner|internal|service[_\s-]?role|api[_\s-]?key|secret|password|token|metadata|evidence|policy|package|business[_\s-]?id|agent[_\s-]?id|prompt|model)/i;
const ENTERPRISE_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN =
  /(?:SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET|STRIPE_SECRET_KEY|service[_\s-]?role|api[_\s-]?key|secret[_\s-]?key|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/i;
const ENTERPRISE_PUBLIC_INTAKE_URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;
const ENTERPRISE_FIELD_LIMITS = Object.freeze({
  agentKey: 180,
  requestText: 2200,
  siteOrObject: 180,
  locationText: 180,
  serviceNeed: 220,
  timingText: 160,
  urgency: 120,
  contactName: 140,
  contactEmail: 180,
  contactPhone: 80,
});
const ENTERPRISE_SETUP_ALLOWED_FIELDS = new Set([
  "organization_name",
  "organizationName",
  "website_url",
  "websiteUrl",
  "service_area",
  "serviceArea",
  "service_lines",
  "serviceLines",
  "intake_positioning",
  "intakePositioning",
  "routing_preference",
  "routingPreference",
  "owner_contact_email",
  "ownerContactEmail",
]);
const STATUS_SET = new Set(ENTERPRISE_REQUEST_DESK_REQUEST_STATUSES);
const REVIEW_STATUS_SET = new Set(ENTERPRISE_REQUEST_DESK_REVIEW_STATUSES);
const MISSING_FIELD_LABELS_HU = Object.freeze({
  service_need: "szolgáltatási igény",
  location_or_site: "helyszín vagy objektum",
  urgency_or_timing: "időzítés vagy sürgősség",
  contact_need: "biztonságos kapcsolati adat",
});
const DEFAULT_SERVICE_TYPES = Object.freeze([
  "őrzés-védelem",
  "portaszolgálat / objektumvédelem",
  "facility management",
  "biztonságtechnika",
  "audit / compliance",
]);

function buildRouteError(message, statusCode = 400, code = "enterprise_request_desk_route_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function readAnyBodyField(body = {}, keys = []) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key];
    }
  }

  return undefined;
}

function normalizeText(value, fieldName, {
  required = false,
  maxLength = 400,
  allowUrl = false,
} = {}) {
  const normalized = cleanText(String(value ?? ""));

  if (required && !normalized) {
    throw buildRouteError(`${fieldName} is required`, 400, `enterprise_${fieldName}_required`);
  }

  if (normalized.length > maxLength) {
    throw buildRouteError(`${fieldName} is too long`, 400, `enterprise_${fieldName}_too_long`);
  }

  if (ENTERPRISE_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(normalized)) {
    throw buildRouteError(
      "Unsafe or secret-looking intake value rejected.",
      400,
      "enterprise_intake_unsafe_value_rejected"
    );
  }

  if (!allowUrl && ENTERPRISE_PUBLIC_INTAKE_URL_PATTERN.test(normalized)) {
    throw buildRouteError(
      `${fieldName} must not include URLs in this intake surface.`,
      400,
      "enterprise_intake_url_rejected"
    );
  }

  return normalized;
}

function normalizeEmail(value) {
  const email = normalizeText(value, "contact_email", {
    maxLength: ENTERPRISE_FIELD_LIMITS.contactEmail,
  }).toLowerCase();

  if (!email) {
    return "";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw buildRouteError("contact_email must be a valid email address", 400, "enterprise_contact_email_invalid");
  }

  return email;
}

function normalizePhone(value) {
  const phone = normalizeText(value, "contact_phone", {
    maxLength: ENTERPRISE_FIELD_LIMITS.contactPhone,
  });

  if (!phone) {
    return "";
  }

  if (phone.replace(/\D/g, "").length < 7) {
    throw buildRouteError("contact_phone must include a reachable phone number", 400, "enterprise_contact_phone_invalid");
  }

  return phone;
}

function normalizeBoolean(value) {
  if (value === true) {
    return true;
  }

  return ["1", "true", "yes", "igen", "acknowledged", "accepted"].includes(
    cleanText(String(value ?? "")).toLowerCase()
  );
}

function assertPlainBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw buildRouteError(
      "A valid Enterprise Request Desk intake body is required.",
      400,
      "enterprise_intake_body_required"
    );
  }
}

function collectBodyStrings(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectBodyStrings(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => [
      key,
      ...collectBodyStrings(nested, depth + 1),
    ]);
  }

  return [];
}

function assertPublicIntakeFieldSafety(body) {
  assertPlainBody(body);

  Object.keys(body).forEach((key) => {
    if (!ENTERPRISE_PUBLIC_INTAKE_ALLOWED_FIELDS.has(key)) {
      throw buildRouteError(
        ENTERPRISE_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)
          ? "Unsafe Enterprise Request Desk intake field rejected."
          : "Unsupported Enterprise Request Desk intake field.",
        400,
        "enterprise_intake_field_not_allowed"
      );
    }
  });

  const bodyText = collectBodyStrings(body).join(" ");
  if (ENTERPRISE_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(bodyText)) {
    throw buildRouteError(
      "Unsafe or secret-looking intake value rejected.",
      400,
      "enterprise_intake_unsafe_value_rejected"
    );
  }
}

function assertNoUnsafeNestedAssistantKeys(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => assertNoUnsafeNestedAssistantKeys(item, depth + 1));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, nested]) => {
    if (ENTERPRISE_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)) {
      throw buildRouteError(
        "Unsafe Enterprise Request Desk assistant field rejected.",
        400,
        "enterprise_intake_field_not_allowed"
      );
    }
    assertNoUnsafeNestedAssistantKeys(nested, depth + 1);
  });
}

function assertPublicAssistantBodySafety(body) {
  assertPlainBody(body);

  Object.keys(body).forEach((key) => {
    if (!ENTERPRISE_PUBLIC_ASSISTANT_ALLOWED_FIELDS.has(key)) {
      throw buildRouteError(
        ENTERPRISE_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)
          ? "Unsafe Enterprise Request Desk assistant field rejected."
          : "Unsupported Enterprise Request Desk assistant field.",
        400,
        "enterprise_intake_field_not_allowed"
      );
    }
  });

  assertNoUnsafeNestedAssistantKeys(body);

  const bodyText = collectBodyStrings(body).join(" ");
  if (bodyText.length > 9000) {
    throw buildRouteError(
      "Enterprise Request Desk assistant payload is too long.",
      413,
      "enterprise_intake_payload_too_large"
    );
  }

  if (ENTERPRISE_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(bodyText)) {
    throw buildRouteError(
      "Unsafe or secret-looking assistant value rejected.",
      400,
      "enterprise_intake_unsafe_value_rejected"
    );
  }

  if (ENTERPRISE_PUBLIC_INTAKE_URL_PATTERN.test(bodyText)) {
    throw buildRouteError(
      "Assistant intake payload must not include URLs in this intake surface.",
      400,
      "enterprise_intake_url_rejected"
    );
  }
}

function assertSetupBodySafety(body) {
  assertPlainBody(body);

  Object.keys(body).forEach((key) => {
    if (!ENTERPRISE_SETUP_ALLOWED_FIELDS.has(key)) {
      throw buildRouteError(
        ENTERPRISE_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)
          ? "Unsafe Enterprise Request Desk setup field rejected."
          : "Unsupported Enterprise Request Desk setup field.",
        400,
        "enterprise_request_desk_setup_field_not_allowed"
      );
    }
  });

  const bodyText = collectBodyStrings(body).join(" ");
  if (ENTERPRISE_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(bodyText)) {
    throw buildRouteError(
      "Unsafe or secret-looking setup value rejected.",
      400,
      "enterprise_request_desk_setup_unsafe_value_rejected"
    );
  }
}

function normalizeAssistantConversation(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      role: cleanText(String(entry.role ?? "")) === "assistant" ? "assistant" : "user",
      content: cleanText(String(entry.content ?? "")).slice(0, 1200),
    }))
    .filter((entry) => entry.content)
    .slice(-8);
}

function normalizePublicAssistantBody(body = {}) {
  assertPublicAssistantBodySafety(body);

  const agentKey = normalizeText(
    readAnyBodyField(body, ["agent_key", "agentKey"]),
    "agent_key",
    { maxLength: ENTERPRISE_FIELD_LIMITS.agentKey }
  );

  if (!agentKey) {
    throw buildRouteError(
      "agent_key is required for Enterprise Request Desk public intake.",
      400,
      "enterprise_intake_agent_key_required"
    );
  }

  const message = normalizeText(
    readAnyBodyField(body, ["message"]),
    "message",
    { maxLength: ENTERPRISE_FIELD_LIMITS.requestText }
  );
  const confirmSubmit = normalizeBoolean(readAnyBodyField(body, ["confirm_submit", "confirmSubmit"]));

  if (!message && !confirmSubmit) {
    throw buildRouteError(
      "message is required",
      400,
      "enterprise_intake_message_required"
    );
  }

  return {
    agentKey,
    message,
    fields: readAnyBodyField(body, ["fields", "current_fields", "currentFields"]) || {},
    conversation: normalizeAssistantConversation(readAnyBodyField(body, ["conversation", "history"])),
    confirmSubmit,
    consentAcknowledged: normalizeBoolean(readAnyBodyField(body, [
      "consent_acknowledged",
      "consentAcknowledged",
    ])),
  };
}

function normalizePublicIntakeBody(body = {}) {
  assertPublicIntakeFieldSafety(body);

  const agentKey = normalizeText(
    readAnyBodyField(body, ["agent_key", "agentKey"]),
    "agent_key",
    { required: true, maxLength: ENTERPRISE_FIELD_LIMITS.agentKey }
  );
  const requestText = normalizeText(
    readAnyBodyField(body, ["message", "request_text", "requestText"]),
    "request_text",
    { required: true, maxLength: ENTERPRISE_FIELD_LIMITS.requestText }
  );
  const siteOrObject = normalizeText(
    readAnyBodyField(body, ["site_or_object", "siteOrObject"]),
    "site_or_object",
    { maxLength: ENTERPRISE_FIELD_LIMITS.siteOrObject }
  );
  const locationText = normalizeText(
    readAnyBodyField(body, ["location_text", "locationText"]),
    "location_text",
    { maxLength: ENTERPRISE_FIELD_LIMITS.locationText }
  );
  const serviceNeed = normalizeText(
    readAnyBodyField(body, ["service_need", "serviceNeed"]),
    "service_need",
    { maxLength: ENTERPRISE_FIELD_LIMITS.serviceNeed }
  );
  const timingText = normalizeText(
    readAnyBodyField(body, ["timing_text", "timingText"]),
    "timing_text",
    { maxLength: ENTERPRISE_FIELD_LIMITS.timingText }
  );
  const urgency = normalizeText(
    readAnyBodyField(body, ["urgency"]),
    "urgency",
    { maxLength: ENTERPRISE_FIELD_LIMITS.urgency }
  );
  const contactName = normalizeText(
    readAnyBodyField(body, ["contact_name", "contactName"]),
    "contact_name",
    { maxLength: ENTERPRISE_FIELD_LIMITS.contactName }
  );
  const contactEmail = normalizeEmail(readAnyBodyField(body, ["contact_email", "contactEmail", "email"]));
  const contactPhone = normalizePhone(readAnyBodyField(body, ["contact_phone", "contactPhone", "phone"]));
  const consentAcknowledged = normalizeBoolean(readAnyBodyField(body, [
    "consent_acknowledged",
    "consentAcknowledged",
    "acknowledgement",
  ]));

  if (!consentAcknowledged) {
    throw buildRouteError(
      "Request-only acknowledgement is required.",
      400,
      "enterprise_intake_acknowledgement_required"
    );
  }

  return {
    agentKey,
    requestText,
    siteOrObject,
    locationText,
    serviceNeed,
    timingText,
    urgency,
    contactName,
    contactEmail,
    contactPhone,
    consentAcknowledged,
  };
}

function normalizeStatusFilter(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!STATUS_SET.has(normalized)) {
    throw buildRouteError(
      "Enterprise Request Desk only shows request-intake and review statuses in this phase.",
      400,
      "enterprise_request_status_not_allowed"
    );
  }

  return normalized;
}

function normalizeReviewStatus(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    throw buildRouteError("status is required", 400, "enterprise_request_status_required");
  }

  if (!REVIEW_STATUS_SET.has(normalized)) {
    throw buildRouteError(
      "Enterprise Request Desk only supports request-review status updates in this phase.",
      400,
      "enterprise_request_status_not_allowed"
    );
  }

  return normalized;
}

function mapPublicAgent(row) {
  if (!row) {
    return null;
  }

  return {
    id: cleanText(row.id),
    businessId: cleanText(row.business_id),
    ownerUserId: cleanText(row.owner_user_id),
    accessStatus: cleanText(row.access_status).toLowerCase() || "pending",
    publicAgentKey: cleanText(row.public_agent_key),
    isActive: row.is_active !== false,
    name: cleanText(row.name),
    purpose: cleanText(row.purpose),
  };
}

function assertPublicAgentCanReceiveEnterpriseIntake(agent) {
  if (
    !agent?.id
    || !agent.ownerUserId
    || !agent.publicAgentKey
    || agent.isActive !== true
    || agent.accessStatus !== "active"
  ) {
    throw buildRouteError(
      "Enterprise Request Desk public intake link is not available.",
      404,
      "enterprise_intake_link_unavailable"
    );
  }
}

async function resolveEnterpriseRequestDeskPublicAgent(supabase, options = {}) {
  const agentKey = cleanText(options.agentKey || options.agent_key);

  if (!agentKey) {
    throw buildRouteError(
      "agent_key is required for Enterprise Request Desk public intake.",
      400,
      "enterprise_intake_agent_key_required"
    );
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, business_id, owner_user_id, access_status, public_agent_key, is_active, name, purpose")
    .eq("public_agent_key", agentKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const agent = mapPublicAgent(data);
  assertPublicAgentCanReceiveEnterpriseIntake(agent);
  return agent;
}

function buildBusinessContext(agent = {}) {
  return {
    businessName: agent.name || "Enterprise Request Desk",
    serviceArea: "országos vagy egyeztetett vállalati helyszínek",
    serviceTypes: DEFAULT_SERVICE_TYPES,
  };
}

function buildEnterpriseCustomerIntakeInfo(_req, publicAgent = null) {
  const agentKey = cleanText(publicAgent?.publicAgentKey || publicAgent?.public_agent_key);
  const query = agentKey ? `?agent_key=${encodeURIComponent(agentKey)}` : "";

  return {
    available: Boolean(agentKey),
    path: `/enterprise-request-desk/intake${query}`,
    aliasPath: `/esg-request-desk/intake${query}`,
    guidanceHu: agentKey
      ? "Ezt a linket tedd a vállalati megkeresési, security vagy FM intake belépési pont mögé. A link nyilvános agent kulcsot használ, nem tulajdonosi azonosítót."
      : "Customer intake linkhez aktív, nyilvános agent kulccsal rendelkező Enterprise Request Desk agent szükséges.",
  };
}

function buildSafeSetupDto(setup) {
  if (!setup) {
    return null;
  }

  return {
    organizationName: cleanText(setup.organizationName),
    websiteUrl: cleanText(setup.websiteUrl),
    serviceArea: cleanText(setup.serviceArea),
    serviceLines: Array.isArray(setup.serviceLines)
      ? setup.serviceLines.map((item) => cleanText(item)).filter(Boolean)
      : [],
    intakePositioning: cleanText(setup.intakePositioning),
    routingPreference: cleanText(setup.routingPreference),
    ownerContactEmail: cleanText(setup.ownerContactEmail),
    setupStatus: cleanText(setup.setupStatus),
    createdAt: setup.createdAt || null,
    updatedAt: setup.updatedAt || null,
  };
}

function sourceKeyHash(agentKey = "") {
  const digest = createHash("sha256")
    .update(cleanText(agentKey))
    .digest("hex");

  return `sha256:${digest.slice(0, 48)}`;
}

function buildIdempotencyKey(agent, intake, lane = "") {
  const digest = createHash("sha256")
    .update([
      cleanText(agent.id),
      cleanText(intake.contactEmail || intake.contactPhone).toLowerCase(),
      cleanText(intake.requestText).toLowerCase(),
      cleanText(intake.serviceNeed).toLowerCase(),
      cleanText(intake.locationText || intake.siteOrObject).toLowerCase(),
      cleanText(lane).toLowerCase(),
    ].join(":"))
    .digest("hex")
    .slice(0, 32);

  return `erd-intake:${digest}`;
}

function labelMissingFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => MISSING_FIELD_LABELS_HU[field] || "")
    .filter(Boolean);
}

function buildSafePublicResponse(request = {}) {
  const missingFields = Array.isArray(request.missingFields) ? request.missingFields : [];

  return {
    ok: true,
    created: request.wasExisting !== true,
    laneLabel: cleanText(request.laneLabel) || "Általános érdeklődés",
    missingFields,
    missingFieldLabels: labelMissingFields(missingFields),
    message: missingFields.length
      ? "A megkeresést rögzítettük előzetes áttekintésre. A csapat visszakérdezhet a hiányzó adatokra és ellenőrzi a következő lépést."
      : "A megkeresést rögzítettük belső feldolgozáshoz. A csapat ellenőrzi a vállalhatóságot és a következő lépést.",
  };
}

function extractQuestionFromReply(reply = "") {
  const normalized = cleanText(reply);
  const match = normalized.match(/(?:^|[.!?\n]\s*)([^.!?\n][^?\n]{8,220}\?)/u);

  return cleanText(match?.[1] || "");
}

function buildAssistantNextQuestion(analysis = {}) {
  const parsedQuestion = extractQuestionFromReply(analysis.assistantReply);

  if (parsedQuestion) {
    return parsedQuestion;
  }

  const firstMissing = Array.isArray(analysis.missingFields) ? analysis.missingFields[0] : "";

  if (firstMissing === "service_need") {
    return "Melyik szolgáltatási területhez kapcsolódik az igény?";
  }

  if (firstMissing === "location_or_site") {
    return "Melyik településen vagy helyszínen lenne a feladat, és milyen típusú objektumról van szó?";
  }

  if (firstMissing === "urgency_or_timing") {
    return "Mikor indulna a feladat, vagy meddig kell visszajelzést kapniuk?";
  }

  if (firstMissing === "contact_need") {
    return "Milyen biztonságos elérhetőségen kérhetnek visszajelzést?";
  }

  return analysis.readyForOwnerReview === true
    ? "Rögzíthető a megkeresés belső feldolgozásra?"
    : "";
}

function buildStructuredBriefPreview(brief = {}) {
  return {
    laneLabel: cleanText(brief.laneLabelHu) || "Általános érdeklődés",
    serviceNeed: cleanText(brief.serviceNeed),
    locationOrSite: cleanText(brief.locationOrSite),
    urgencyOrTiming: cleanText(brief.urgencyOrTiming),
    contactNeed: cleanText(brief.contactNeed),
    contactName: cleanText(brief.contactName),
    organizationName: cleanText(brief.organizationName),
    siteType: cleanText(brief.siteType),
    notes: cleanText(brief.notes).slice(0, 700),
  };
}

function buildSafeAssistantResponse(analysis = {}, request = null) {
  const brief = analysis.structuredBrief || {};
  const missingFields = Array.isArray(analysis.missingFields)
    ? analysis.missingFields.map(cleanText).filter(Boolean)
    : [];
  const readyToCreate = analysis.readyForOwnerReview === true && missingFields.length === 0;
  const requestMessage = request
    ? "A megkeresést rögzítettük belső feldolgozásra. A csapat a megadott adatok alapján tud visszajelezni a következő lépésről."
    : "";

  return {
    ok: true,
    assistant: {
      reply: requestMessage || cleanText(analysis.assistantReply),
    },
    lane: {
      key: cleanText(brief.lane),
      label: cleanText(brief.laneLabelHu) || "Általános érdeklődés",
    },
    extractedFields: {
      organizationName: cleanText(analysis.fields?.organizationName),
      serviceNeed: cleanText(analysis.fields?.serviceNeed),
      locationOrSite: cleanText(analysis.fields?.locationOrSite),
      urgencyOrTiming: cleanText(analysis.fields?.urgencyOrTiming),
      contactName: cleanText(analysis.fields?.contactName),
      contactEmail: cleanText(analysis.fields?.contactEmail),
      contactPhone: cleanText(analysis.fields?.contactPhone),
      contactPreference: cleanText(analysis.fields?.contactPreference),
      siteType: cleanText(analysis.fields?.siteType),
      notes: cleanText(analysis.fields?.notes).slice(0, 700),
    },
    missingFields,
    missingFieldLabels: labelMissingFields(missingFields),
    structuredBriefPreview: buildStructuredBriefPreview(brief),
    nextQuestion: buildAssistantNextQuestion(analysis),
    readyToCreate,
    needsConfirmation: readyToCreate && !request,
    request: request
      ? {
          created: request.wasExisting !== true,
          laneLabel: cleanText(request.laneLabel) || cleanText(brief.laneLabelHu) || "Általános érdeklődés",
          message: requestMessage,
        }
      : null,
  };
}

function buildAssistantRequestText(intakeTurn = {}, analysis = {}) {
  const userMessages = [
    ...normalizeAssistantConversation(intakeTurn.conversation).filter((entry) => entry.role === "user").map((entry) => entry.content),
    intakeTurn.message,
  ].map(cleanText).filter(Boolean);
  const fields = analysis.fields || {};
  const brief = analysis.structuredBrief || {};

  return cleanText(
    userMessages.join("\n")
    || fields.notes
    || brief.notes
    || fields.serviceNeed
    || brief.serviceNeed
    || "Enterprise Request Desk megkeresés"
  ).slice(0, ENTERPRISE_FIELD_LIMITS.requestText);
}

function buildAssistantIdempotencyKey(agent, analysis = {}) {
  const fields = analysis.fields || {};
  const brief = analysis.structuredBrief || {};
  const digest = createHash("sha256")
    .update([
      cleanText(agent.id),
      cleanText(fields.contactEmail || fields.contactPhone || fields.contactPreference).toLowerCase(),
      cleanText(fields.serviceNeed || brief.serviceNeed).toLowerCase(),
      cleanText(fields.locationOrSite || brief.locationOrSite).toLowerCase(),
      cleanText(fields.urgencyOrTiming || brief.urgencyOrTiming).toLowerCase(),
      cleanText(brief.lane).toLowerCase(),
      ENTERPRISE_AI_INTAKE_SOURCE_CHANNEL,
    ].join(":"))
    .digest("hex")
    .slice(0, 32);

  return `erd-ai-intake:${digest}`;
}

function buildAssistantRequestOptions({
  agent,
  intakeTurn,
  analysis,
} = {}) {
  const fields = analysis.fields || {};
  const brief = analysis.structuredBrief || {};

  return {
    ownerUserId: agent.ownerUserId,
    agentId: agent.id,
    businessId: agent.businessId,
    sourceKeyHash: sourceKeyHash(intakeTurn.agentKey),
    lane: brief.lane || "general_enquiry",
    laneLabel: brief.laneLabelHu,
    confidence: brief.confidence,
    requestText: buildAssistantRequestText(intakeTurn, analysis),
    siteOrObject: fields.siteType || brief.siteType,
    locationText: fields.locationOrSite || brief.locationOrSite,
    serviceNeed: fields.serviceNeed || brief.serviceNeed,
    timingText: fields.urgencyOrTiming || brief.urgencyOrTiming,
    urgency: fields.urgencyOrTiming || brief.urgencyOrTiming,
    contactName: fields.contactName || brief.contactName,
    contactEmail: fields.contactEmail || brief.contactEmail,
    contactPhone: fields.contactPhone || brief.contactPhone,
    missingFields: analysis.missingFields || [],
    structuredBrief: brief,
    status: "request_received",
    statusReason: "Enterprise Request Desk conversational intake received for internal processing.",
    evidence: {
      proof_source_type: "request_only",
      classification_reason: cleanText(analysis.laneClassification?.reason),
      conversational_intake: {
        safety_flags: {
          prompt_injection: analysis.safetyFlags?.promptInjection === true,
          secret_like_input: analysis.safetyFlags?.secretLikeInput === true,
          pricing_boundary_requested: analysis.safetyFlags?.pricingGuaranteeRequested === true,
          deferred_operations_requested: analysis.safetyFlags?.deferredOperationsRequested === true,
        },
        missing_fields_at_submit: analysis.missingFields || [],
      },
    },
    metadata: {
      product: "enterprise_request_desk",
      phase: ENTERPRISE_AI_INTAKE_PHASE,
      source: ENTERPRISE_AI_INTAKE_SOURCE_CHANNEL,
      display_mode: ENTERPRISE_DISPLAY_MODE,
      request_only: true,
      consent_acknowledged: true,
      assistant_version: "enterprise_conversational_intake_v1",
    },
    idempotencyKey: buildAssistantIdempotencyKey(agent, analysis),
  };
}

function buildSummary(records = []) {
  const countByStatus = (statuses) => records.filter((record) =>
    statuses.includes(cleanText(record?.status).toLowerCase())
  ).length;

  return {
    total: records.length,
    requestReceived: countByStatus(["request_received"]),
    needsInfo: countByStatus(["needs_info"]),
    needsStaffReview: countByStatus(["needs_staff_review"]),
    routed: countByStatus(["routed"]),
    declined: countByStatus(["declined"]),
    archived: countByStatus(["archived"]),
    closed: countByStatus(["declined", "archived"]),
  };
}

export function createEnterpriseRequestDeskRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const requireActiveAgentAccessImpl =
    deps.requireActiveAgentAccess || requireActiveAgentAccess;
  const resolvePublicAgentImpl =
    deps.resolveEnterpriseRequestDeskPublicAgent || resolveEnterpriseRequestDeskPublicAgent;
  const generateAssistantTurnImpl =
    deps.generateEnterpriseRequestDeskAssistantTurn || generateEnterpriseRequestDeskAssistantTurn;
  const createRequestImpl =
    deps.createEnterpriseRequestDeskRequest || createEnterpriseRequestDeskRequest;
  const listRequestsImpl =
    deps.listEnterpriseRequestDeskRequests || listEnterpriseRequestDeskRequests;
  const updateRequestStatusImpl =
    deps.updateEnterpriseRequestDeskRequestStatus || updateEnterpriseRequestDeskRequestStatus;
  const getEnterpriseRequestDeskSetupImpl =
    deps.getEnterpriseRequestDeskSetup || getEnterpriseRequestDeskSetup;
  const getEnterpriseRequestDeskPublicAgentForOwnerImpl =
    deps.getEnterpriseRequestDeskPublicAgentForOwner || getEnterpriseRequestDeskPublicAgentForOwner;
  const saveEnterpriseRequestDeskSetupImpl =
    deps.saveEnterpriseRequestDeskSetup || saveEnterpriseRequestDeskSetup;
  const limitPublicIntake =
    deps.limitEnterpriseRequestDeskIntake || createRateLimitMiddleware("public_enterprise_request_desk_intake", {
      windowMs: 60_000,
      max: 8,
    });
  const limitIntakeAssistant =
    deps.limitEnterpriseRequestDeskIntakeAssistant
    || deps.limitEnterpriseRequestDeskIntake
    || createRateLimitMiddleware("public_enterprise_request_desk_intake_assistant", {
      windowMs: 60_000,
      max: 8,
    });

  const sendRouteError = (req, res, err, context = {}) => {
    const requestId = getRequestId(req);
    logRouteError(err, req, context);
    sendJsonError(res, err, { requestId });
  };

  router.get(
    ["/enterprise-request-desk/intake-context", "/esg-request-desk/intake-context"],
    async (req, res) => {
      try {
        const supabase = getSupabase();
        const agent = await resolvePublicAgentImpl(supabase, {
          agentKey: req.query.agent_key || req.query.agentKey,
        });
        const business = buildBusinessContext(agent);

        res.json({
          ok: true,
          surface: "ESG Request Desk",
          business,
          lanes: listEnterpriseRequestDeskLanes().map((lane) => ({
            key: lane.key,
            labelHu: lane.labelHu,
          })),
          intake: {
            requestOnly: true,
            staffReviewOnly: true,
          },
        });
      } catch (err) {
        sendRouteError(req, res, err, { route: "/enterprise-request-desk/intake-context" });
      }
    }
  );

  router.post(
    ["/enterprise-request-desk/intake-requests", "/esg-request-desk/intake-requests"],
    limitPublicIntake,
    async (req, res) => {
      try {
        const supabase = getSupabase();
        const intake = normalizePublicIntakeBody(req.body);
        const agent = await resolvePublicAgentImpl(supabase, {
          agentKey: intake.agentKey,
        });
        const analysis = await generateAssistantTurnImpl({
          message: intake.requestText,
          fields: {
            serviceNeed: intake.serviceNeed,
            locationOrSite: intake.locationText || intake.siteOrObject,
            urgencyOrTiming: intake.timingText || intake.urgency,
            contactName: intake.contactName,
            contactEmail: intake.contactEmail,
            contactPhone: intake.contactPhone,
            siteType: intake.siteOrObject,
          },
          businessContext: buildBusinessContext(agent),
        });
        const brief = analysis.structuredBrief || {};
        const status = analysis.missingFields?.length ? "needs_info" : "request_received";
        const request = await createRequestImpl(supabase, {
          ownerUserId: agent.ownerUserId,
          agentId: agent.id,
          businessId: agent.businessId,
          sourceKeyHash: sourceKeyHash(intake.agentKey),
          lane: brief.lane || "general_enquiry",
          laneLabel: brief.laneLabelHu,
          confidence: brief.confidence,
          requestText: intake.requestText,
          siteOrObject: intake.siteOrObject || brief.siteType,
          locationText: intake.locationText || brief.locationOrSite,
          serviceNeed: intake.serviceNeed || brief.serviceNeed,
          timingText: intake.timingText || brief.urgencyOrTiming,
          urgency: intake.urgency,
          contactName: intake.contactName || brief.contactName,
          contactEmail: intake.contactEmail || brief.contactEmail,
          contactPhone: intake.contactPhone || brief.contactPhone,
          missingFields: analysis.missingFields || [],
          structuredBrief: brief,
          status,
          statusReason: "Enterprise Request Desk public intake received for internal processing.",
          evidence: {
            proof_source_type: "request_only",
            classification_reason: cleanText(analysis.laneClassification?.reason),
            safety_flags: {
              prompt_injection: analysis.safetyFlags?.promptInjection === true,
              secret_like_input: analysis.safetyFlags?.secretLikeInput === true,
              pricing_boundary_requested: analysis.safetyFlags?.pricingGuaranteeRequested === true,
              deferred_operations_requested: analysis.safetyFlags?.deferredOperationsRequested === true,
            },
            missing_fields_at_submit: analysis.missingFields || [],
          },
          metadata: {
            product: "enterprise_request_desk",
            phase: ENTERPRISE_PUBLIC_INTAKE_PHASE,
            source: ENTERPRISE_PUBLIC_INTAKE_SOURCE_CHANNEL,
            display_mode: ENTERPRISE_DISPLAY_MODE,
            request_only: true,
            consent_acknowledged: true,
          },
          idempotencyKey: buildIdempotencyKey(agent, intake, brief.lane),
        });

        res.status(request.wasExisting ? 200 : 201).json(buildSafePublicResponse(request));
      } catch (err) {
        sendRouteError(req, res, err, { route: "/enterprise-request-desk/intake-requests" });
      }
    }
  );

  router.post(
    ["/enterprise-request-desk/intake-assistant", "/esg-request-desk/intake-assistant"],
    limitIntakeAssistant,
    async (req, res) => {
      try {
        const supabase = getSupabase();
        const intakeTurn = normalizePublicAssistantBody(req.body);
        const agent = await resolvePublicAgentImpl(supabase, {
          agentKey: intakeTurn.agentKey,
        });
        const analysis = await generateAssistantTurnImpl({
          supabase,
          agent,
          message: intakeTurn.message,
          conversation: intakeTurn.conversation,
          fields: intakeTurn.fields,
          businessContext: buildBusinessContext(agent),
          confirmSubmit: intakeTurn.confirmSubmit,
        });
        const readyToCreate =
          intakeTurn.confirmSubmit === true
          && analysis.readyForOwnerReview === true
          && Array.isArray(analysis.missingFields)
          && analysis.missingFields.length === 0;

        if (!readyToCreate) {
          res.json(buildSafeAssistantResponse(analysis));
          return;
        }

        if (!intakeTurn.consentAcknowledged) {
          throw buildRouteError(
            "Request acknowledgement is required.",
            400,
            "enterprise_intake_acknowledgement_required"
          );
        }

        const request = await createRequestImpl(supabase, buildAssistantRequestOptions({
          agent,
          intakeTurn,
          analysis,
        }));

        res.status(request.wasExisting ? 200 : 201).json(buildSafeAssistantResponse(analysis, request));
      } catch (err) {
        sendRouteError(req, res, err, { route: "/enterprise-request-desk/intake-assistant" });
      }
    }
  );

  router.get(["/enterprise-request-desk/setup-state", "/esg-request-desk/setup-state"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const setup = await getEnterpriseRequestDeskSetupImpl(supabase, {
        ownerUserId: user.id,
      });
      const publicAgent = setup
        ? await getEnterpriseRequestDeskPublicAgentForOwnerImpl(supabase, { ownerUserId: user.id })
        : null;

      res.json({
        ok: true,
        product: "enterprise_request_desk",
        phase: "self_serve_setup_readiness",
        account: {
          email: cleanText(user.email),
        },
        setupComplete: Boolean(setup),
        setup: buildSafeSetupDto(setup),
        customerIntake: buildEnterpriseCustomerIntakeInfo(req, publicAgent),
        nextUrl: setup ? "/enterprise-request-desk/dashboard" : "/enterprise-request-desk/setup",
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/enterprise-request-desk/setup-state" });
    }
  });

  router.post(["/enterprise-request-desk/setup", "/esg-request-desk/setup"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      assertSetupBodySafety(req.body);
      const setup = await saveEnterpriseRequestDeskSetupImpl(supabase, {
        ownerUserId: user.id,
        organizationName: readBodyField(req.body, "organization_name", "organizationName"),
        websiteUrl: readBodyField(req.body, "website_url", "websiteUrl"),
        serviceArea: readBodyField(req.body, "service_area", "serviceArea"),
        serviceLines: req.body?.service_lines || req.body?.serviceLines,
        intakePositioning: readBodyField(req.body, "intake_positioning", "intakePositioning"),
        routingPreference: readBodyField(req.body, "routing_preference", "routingPreference"),
        ownerContactEmail: readBodyField(req.body, "owner_contact_email", "ownerContactEmail"),
      });

      res.json({
        ok: true,
        product: "enterprise_request_desk",
        phase: "self_serve_setup_readiness",
        account: {
          email: cleanText(user.email),
        },
        setupComplete: true,
        setup: buildSafeSetupDto(setup),
        customerIntake: buildEnterpriseCustomerIntakeInfo(
          req,
          await getEnterpriseRequestDeskPublicAgentForOwnerImpl(supabase, {
            ownerUserId: user.id,
          })
        ),
        nextUrl: "/enterprise-request-desk/dashboard",
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/enterprise-request-desk/setup" });
    }
  });

  router.get(["/enterprise-request-desk/requests", "/esg-request-desk/requests"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);
      const status = normalizeStatusFilter(req.query.status);

      if (agentId) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      const records = await listRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status,
        limit: req.query.limit || 100,
      });

      res.json({
        ok: true,
        product: "enterprise_request_desk",
        phase: "pilot_request_review",
        reviewStatuses: ENTERPRISE_REQUEST_DESK_REVIEW_STATUSES,
        visibleStatuses: ENTERPRISE_REQUEST_DESK_REQUEST_STATUSES,
        summary: buildSummary(records),
        records,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/enterprise-request-desk/requests" });
    }
  });

  router.post(["/enterprise-request-desk/requests/status", "/esg-request-desk/requests/status"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");

      if (!cleanText(requestId)) {
        throw buildRouteError("request_id is required", 400, "enterprise_request_id_required");
      }

      const request = await updateRequestStatusImpl(supabase, {
        ownerUserId: user.id,
        requestId,
        status: normalizeReviewStatus(readBodyField(req.body, "status")),
        statusReason: readBodyField(req.body, "status_reason", "statusReason"),
        staffNotes: readBodyField(req.body, "staff_notes", "staffNotes"),
      });

      res.json({
        ok: true,
        product: "enterprise_request_desk",
        phase: "pilot_request_review",
        request,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/enterprise-request-desk/requests/status" });
    }
  });

  return router;
}
