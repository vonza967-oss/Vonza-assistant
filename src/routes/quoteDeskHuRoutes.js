import { createHash } from "node:crypto";
import express from "express";

import { getOpenAIClient } from "../clients/openaiClient.js";
import { getSupabaseClient } from "../clients/supabaseClient.js";
import { getAuthenticatedUser } from "../services/auth/authService.js";
import { requireActiveAgentAccess } from "../services/agents/agentService.js";
import {
  createAgentQuoteRequest,
  listAgentQuoteRequests,
  updateAgentQuoteRequestStatus,
} from "../services/quotes/agentQuoteRequestService.js";
import {
  getQuoteDeskHuPublicAgentForOwner,
  getQuoteDeskHuSetup,
  resolveQuoteDeskHuPublicAgent,
  saveQuoteDeskHuSetup,
} from "../services/quotes/quoteDeskHuSetupService.js";
import {
  QDH_AI_INTAKE_PHASE,
  QDH_AI_INTAKE_SOURCE_CHANNEL,
  analyzeQuoteDeskHuIntakeTurn,
  generateQuoteDeskHuAssistantTurn,
  toQuoteDeskHuRequestPayloadFields,
} from "../services/quotes/quoteDeskHuIntakeAssistantService.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";
import { readBodyField } from "./agentRouteHelpers.js";

const QDH_SAFE_REVIEW_STATUSES = Object.freeze([
  "needs_info",
  "needs_staff_review",
  "declined",
  "archived",
]);
const QDH_VISIBLE_REQUEST_STATUSES = Object.freeze([
  "request_received",
  ...QDH_SAFE_REVIEW_STATUSES,
]);
const QDH_PUBLIC_INTAKE_SOURCE_CHANNEL = "qdh_public_intake";
const QDH_PUBLIC_INTAKE_PHASE = "customer_intake_request_only";
const QDH_AI_INTAKE_DISPLAY_MODE = "qdh_ai_intake";
const QDH_PUBLIC_INTAKE_ALLOWED_FIELDS = new Set([
  "agent_key",
  "agentKey",
  "requested_service",
  "requestedService",
  "project_details",
  "projectDetails",
  "location_text",
  "locationText",
  "city",
  "location",
  "urgency",
  "budget_text",
  "budgetText",
  "customer_name",
  "customerName",
  "customer_email",
  "customerEmail",
  "email",
  "customer_phone",
  "customerPhone",
  "phone",
  "consent_acknowledged",
  "consentAcknowledged",
  "acknowledgement",
  "language",
]);
const QDH_PUBLIC_ASSISTANT_ALLOWED_FIELDS = new Set([
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
const QDH_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN =
  /(?:owner|internal|service[_\s-]?role|api[_\s-]?key|secret|password|token|metadata|evidence|policy|package|business[_\s-]?id|agent[_\s-]?id)/i;
const QDH_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN =
  /(?:SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET|STRIPE_SECRET_KEY|service[_\s-]?role|api[_\s-]?key|secret[_\s-]?key|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/i;
const QDH_PUBLIC_INTAKE_FIELD_LIMITS = Object.freeze({
  requestedService: 140,
  projectDetails: 1800,
  locationText: 160,
  urgency: 80,
  budgetText: 120,
  customerName: 120,
  customerEmail: 180,
  customerPhone: 80,
});

const QDH_SAFE_REVIEW_STATUS_SET = new Set(QDH_SAFE_REVIEW_STATUSES);
const QDH_VISIBLE_REQUEST_STATUS_SET = new Set(QDH_VISIBLE_REQUEST_STATUSES);

function buildQuoteDeskHuRouteError(message, statusCode = 400, code = "qdh_route_invalid") {
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

function normalizeQdhStatus(value) {
  return cleanText(value).toLowerCase();
}

function assertQdhReviewStatus(status) {
  const normalized = normalizeQdhStatus(status);

  if (!normalized) {
    throw buildQuoteDeskHuRouteError("status is required", 400, "qdh_status_required");
  }

  if (!QDH_SAFE_REVIEW_STATUS_SET.has(normalized)) {
    throw buildQuoteDeskHuRouteError(
      "Quote Desk HU only supports request-review statuses in this phase.",
      400,
      "qdh_status_not_allowed"
    );
  }

  return normalized;
}

function assertQdhVisibleRequestStatus(status) {
  const normalized = normalizeQdhStatus(status);

  if (!normalized) {
    return "";
  }

  if (!QDH_VISIBLE_REQUEST_STATUS_SET.has(normalized)) {
    throw buildQuoteDeskHuRouteError(
      "Quote Desk HU only shows request-intake and review statuses in this phase.",
      400,
      "qdh_status_not_allowed"
    );
  }

  return normalized;
}

function filterQdhVisibleRequests(records = []) {
  return records.filter((record) =>
    QDH_VISIBLE_REQUEST_STATUS_SET.has(normalizeQdhStatus(record?.status))
  );
}

function buildQuoteDeskHuSummary(records = []) {
  const countByStatus = (statuses) => records.filter((record) =>
    statuses.includes(normalizeQdhStatus(record?.status))
  ).length;

  return {
    total: records.length,
    requestReceived: countByStatus(["request_received"]),
    needsInfo: countByStatus(["needs_info"]),
    needsStaffReview: countByStatus(["needs_staff_review"]),
    declined: countByStatus(["declined"]),
    archived: countByStatus(["archived"]),
    closed: countByStatus(["declined", "archived"]),
    responseTime: {
      available: false,
      label: "Nincs adat",
    },
  };
}

function buildQdhCustomerIntakeInfo(_req, publicAgent = null) {
  const agentKey = cleanText(publicAgent?.publicAgentKey || publicAgent?.public_agent_key);
  const query = agentKey ? `?agent_key=${encodeURIComponent(agentKey)}` : "";

  return {
    available: Boolean(agentKey),
    path: `/qdh/intake${query}`,
    aliasPath: `/quote-desk-hu/intake${query}`,
    sourceChannel: QDH_PUBLIC_INTAKE_SOURCE_CHANNEL,
    guidanceHu: agentKey
      ? "Ezt a linket tedd a weboldal 'Kérjen ajánlatot' gombja mögé. A link nyilvános agent kulcsot használ, nem tulajdonosi azonosítót."
      : "Customer intake linkhez aktív, nyilvános agent kulccsal rendelkező QDH/Front Desk agent szükséges.",
  };
}

function assertQdhSetupAvailableForPublicIntake(setup) {
  if (!setup) {
    throw buildQuoteDeskHuRouteError(
      "Quote Desk HU setup is required before public intake can receive requests.",
      404,
      "qdh_intake_setup_required"
    );
  }
}

function buildPublicQdhSetupContext(setup) {
  assertQdhSetupAvailableForPublicIntake(setup);

  return {
    businessName: cleanText(setup.businessName),
    serviceType: cleanText(setup.serviceType),
    serviceArea: cleanText(setup.serviceArea),
    servicesOffered: Array.isArray(setup.servicesOffered)
      ? setup.servicesOffered.map((item) => cleanText(item)).filter(Boolean).slice(0, 12)
      : [],
  };
}

function assertPlainIntakeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw buildQuoteDeskHuRouteError(
      "A valid intake request body is required.",
      400,
      "qdh_intake_body_required"
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
  assertPlainIntakeBody(body);

  Object.keys(body).forEach((key) => {
    if (!QDH_PUBLIC_INTAKE_ALLOWED_FIELDS.has(key)) {
      throw buildQuoteDeskHuRouteError(
        QDH_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)
          ? "Unsafe intake field rejected."
          : "Unsupported intake field.",
        400,
        "qdh_intake_field_not_allowed"
      );
    }
  });

  const bodyText = collectBodyStrings(body).join(" ");
  if (QDH_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(bodyText)) {
    throw buildQuoteDeskHuRouteError(
      "Unsafe or secret-looking intake value rejected.",
      400,
      "qdh_intake_unsafe_value_rejected"
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
    if (QDH_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)) {
      throw buildQuoteDeskHuRouteError(
        "Unsafe assistant field rejected.",
        400,
        "qdh_intake_field_not_allowed"
      );
    }
    assertNoUnsafeNestedAssistantKeys(nested, depth + 1);
  });
}

function assertPublicAssistantBodySafety(body) {
  assertPlainIntakeBody(body);

  Object.keys(body).forEach((key) => {
    if (!QDH_PUBLIC_ASSISTANT_ALLOWED_FIELDS.has(key)) {
      throw buildQuoteDeskHuRouteError(
        QDH_PUBLIC_INTAKE_UNSAFE_FIELD_PATTERN.test(key)
          ? "Unsafe assistant field rejected."
          : "Unsupported assistant field.",
        400,
        "qdh_intake_field_not_allowed"
      );
    }
  });

  assertNoUnsafeNestedAssistantKeys(body);

  const bodyText = collectBodyStrings(body).join(" ");
  if (bodyText.length > 9000) {
    throw buildQuoteDeskHuRouteError(
      "Assistant intake payload is too long.",
      413,
      "qdh_intake_payload_too_large"
    );
  }

  if (QDH_PUBLIC_INTAKE_UNSAFE_VALUE_PATTERN.test(bodyText)) {
    throw buildQuoteDeskHuRouteError(
      "Unsafe or secret-looking assistant value rejected.",
      400,
      "qdh_intake_unsafe_value_rejected"
    );
  }
}

function normalizePublicIntakeText(value, fieldName, {
  required = false,
  maxLength = 400,
} = {}) {
  const normalized = cleanText(String(value ?? ""));

  if (required && !normalized) {
    throw buildQuoteDeskHuRouteError(
      `${fieldName} is required`,
      400,
      `qdh_${fieldName}_required`
    );
  }

  if (normalized.length > maxLength) {
    throw buildQuoteDeskHuRouteError(
      `${fieldName} is too long`,
      400,
      `qdh_${fieldName}_too_long`
    );
  }

  return normalized;
}

function normalizePublicIntakeConsent(value) {
  if (value === true) {
    return true;
  }

  const normalized = cleanText(value).toLowerCase();
  return ["1", "true", "yes", "igen", "acknowledged", "accepted"].includes(normalized);
}

function assertSafePublicIntakeContact({ customerEmail, customerPhone }) {
  if (!customerEmail && !customerPhone) {
    throw buildQuoteDeskHuRouteError(
      "customer_email or customer_phone is required",
      400,
      "qdh_customer_contact_required"
    );
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw buildQuoteDeskHuRouteError(
      "customer_email must be a valid email address",
      400,
      "qdh_customer_email_invalid"
    );
  }

  if (customerPhone && customerPhone.replace(/\D/g, "").length < 7) {
    throw buildQuoteDeskHuRouteError(
      "customer_phone must include a reachable phone number",
      400,
      "qdh_customer_phone_invalid"
    );
  }
}

function normalizeQdhPublicIntakeBody(body = {}) {
  assertPublicIntakeFieldSafety(body);

  const requestedService = normalizePublicIntakeText(
    readAnyBodyField(body, ["requested_service", "requestedService"]),
    "requested_service",
    { required: true, maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.requestedService }
  );
  const projectDetails = normalizePublicIntakeText(
    readAnyBodyField(body, ["project_details", "projectDetails"]),
    "project_details",
    { required: true, maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.projectDetails }
  );
  const locationText = normalizePublicIntakeText(
    readAnyBodyField(body, ["location_text", "locationText", "city", "location"]),
    "location_text",
    { required: true, maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.locationText }
  );
  const urgency = normalizePublicIntakeText(
    readAnyBodyField(body, ["urgency"]),
    "urgency",
    { required: true, maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.urgency }
  );
  const budgetText = normalizePublicIntakeText(
    readAnyBodyField(body, ["budget_text", "budgetText"]),
    "budget_text",
    { maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.budgetText }
  );
  const customerName = normalizePublicIntakeText(
    readAnyBodyField(body, ["customer_name", "customerName"]),
    "customer_name",
    { required: true, maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.customerName }
  );
  const customerEmail = normalizePublicIntakeText(
    readAnyBodyField(body, ["customer_email", "customerEmail", "email"]),
    "customer_email",
    { maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.customerEmail }
  ).toLowerCase();
  const customerPhone = normalizePublicIntakeText(
    readAnyBodyField(body, ["customer_phone", "customerPhone", "phone"]),
    "customer_phone",
    { maxLength: QDH_PUBLIC_INTAKE_FIELD_LIMITS.customerPhone }
  );
  const consentAcknowledged = normalizePublicIntakeConsent(readAnyBodyField(body, [
    "consent_acknowledged",
    "consentAcknowledged",
    "acknowledgement",
  ]));

  assertSafePublicIntakeContact({ customerEmail, customerPhone });

  if (!consentAcknowledged) {
    throw buildQuoteDeskHuRouteError(
      "Request-only acknowledgement is required",
      400,
      "qdh_intake_acknowledgement_required"
    );
  }

  return {
    agentKey: normalizePublicIntakeText(
      readAnyBodyField(body, ["agent_key", "agentKey"]),
      "agent_key",
      { required: true, maxLength: 180 }
    ),
    requestedService,
    projectDetails,
    locationText,
    urgency,
    budgetText,
    customerName,
    customerEmail,
    customerPhone,
    language: "hu",
    consentAcknowledged,
  };
}

function normalizeBoolean(value) {
  if (value === true) {
    return true;
  }

  return ["1", "true", "yes", "igen", "acknowledged", "accepted"].includes(
    cleanText(String(value ?? "")).toLowerCase()
  );
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

function normalizeQdhAssistantBody(body = {}) {
  assertPublicAssistantBodySafety(body);

  const agentKey = normalizePublicIntakeText(
    readAnyBodyField(body, ["agent_key", "agentKey"]),
    "agent_key",
    { maxLength: 180 }
  );

  if (!agentKey) {
    throw buildQuoteDeskHuRouteError(
      "agent_key is required for Quote Desk HU public intake.",
      400,
      "qdh_intake_agent_key_required"
    );
  }
  const message = normalizePublicIntakeText(
    readAnyBodyField(body, ["message"]),
    "message",
    { maxLength: 2000 }
  );
  const confirmSubmit = normalizeBoolean(readAnyBodyField(body, ["confirm_submit", "confirmSubmit"]));

  if (!message && !confirmSubmit) {
    throw buildQuoteDeskHuRouteError(
      "message is required",
      400,
      "qdh_intake_message_required"
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

function buildQdhPublicIntakeIdempotencyKey(agent, intake) {
  const digest = createHash("sha256")
    .update([
      cleanText(agent.id),
      cleanText(intake.customerEmail || intake.customerPhone).toLowerCase(),
      cleanText(intake.requestedService).toLowerCase(),
      cleanText(intake.projectDetails).toLowerCase(),
      cleanText(intake.locationText).toLowerCase(),
    ].join(":"))
    .digest("hex")
    .slice(0, 32);

  return `qdh-intake:${digest}`;
}

function buildQdhAiIntakeIdempotencyKey(agent, intake) {
  const digest = createHash("sha256")
    .update([
      cleanText(agent.id),
      cleanText(intake.customerEmail || intake.customerPhone).toLowerCase(),
      cleanText(intake.requestedService).toLowerCase(),
      cleanText(intake.projectDetails).toLowerCase(),
      cleanText(intake.locationText).toLowerCase(),
      QDH_AI_INTAKE_SOURCE_CHANNEL,
    ].join(":"))
    .digest("hex")
    .slice(0, 32);

  return `qdh-ai-intake:${digest}`;
}

function buildSafePublicIntakeResponse(request = {}) {
  return {
    ok: true,
    product: "quote_desk_hu",
    phase: QDH_PUBLIC_INTAKE_PHASE,
    request: {
      status: normalizeQdhStatus(request.status) || "request_received",
      sourceChannel: cleanText(request.sourceChannel) || QDH_PUBLIC_INTAKE_SOURCE_CHANNEL,
      receivedForStaffReview: true,
    },
    message: "Az ajánlatkérést rögzítettük. A vállalkozás munkatársai átnézik; ez nem végleges vagy garantált árajánlat.",
  };
}

function buildSafeAssistantResponse(analysis = {}, request = null) {
  return {
    ok: true,
    product: "quote_desk_hu",
    phase: QDH_AI_INTAKE_PHASE,
    assistant: {
      reply: cleanText(analysis.assistantReply),
    },
    extractedFields: {
      requestedService: cleanText(analysis.fields?.requestedService),
      projectDetails: cleanText(analysis.fields?.projectDetails),
      locationText: cleanText(analysis.fields?.locationText),
      urgency: cleanText(analysis.fields?.urgency),
      budgetText: cleanText(analysis.fields?.budgetText),
      customerName: cleanText(analysis.fields?.customerName),
      customerEmail: cleanText(analysis.fields?.customerEmail),
      customerPhone: cleanText(analysis.fields?.customerPhone),
    },
    missingFields: Array.isArray(analysis.missingFields)
      ? analysis.missingFields.map(cleanText).filter(Boolean)
      : [],
    readyToSubmit: analysis.readyToSubmit === true,
    safetyFlags: {
      promptInjection: analysis.safetyFlags?.promptInjection === true,
      emergency: analysis.safetyFlags?.emergency === true,
      pricingGuaranteeRequested: analysis.safetyFlags?.pricingGuaranteeRequested === true,
      outOfScope: analysis.safetyFlags?.outOfScope === true,
    },
    request: request
      ? {
          status: normalizeQdhStatus(request.status) || "request_received",
          sourceChannel: cleanText(request.sourceChannel) || QDH_AI_INTAKE_SOURCE_CHANNEL,
          receivedForStaffReview: true,
        }
      : null,
    message: request
      ? "Az ajánlatkérést rögzítettük. Ez nem végleges vagy garantált árajánlat."
      : "",
  };
}

export function createQuoteDeskHuRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const requireActiveAgentAccessImpl =
    deps.requireActiveAgentAccess || requireActiveAgentAccess;
  const createAgentQuoteRequestImpl =
    deps.createAgentQuoteRequest || createAgentQuoteRequest;
  const listAgentQuoteRequestsImpl =
    deps.listAgentQuoteRequests || listAgentQuoteRequests;
  const updateAgentQuoteRequestStatusImpl =
    deps.updateAgentQuoteRequestStatus || updateAgentQuoteRequestStatus;
  const getQuoteDeskHuSetupImpl =
    deps.getQuoteDeskHuSetup || getQuoteDeskHuSetup;
  const getQuoteDeskHuPublicAgentForOwnerImpl =
    deps.getQuoteDeskHuPublicAgentForOwner || getQuoteDeskHuPublicAgentForOwner;
  const resolveQuoteDeskHuPublicAgentImpl =
    deps.resolveQuoteDeskHuPublicAgent || resolveQuoteDeskHuPublicAgent;
  const saveQuoteDeskHuSetupImpl =
    deps.saveQuoteDeskHuSetup || saveQuoteDeskHuSetup;
  const analyzeQuoteDeskHuIntakeTurnImpl =
    deps.analyzeQuoteDeskHuIntakeTurn || analyzeQuoteDeskHuIntakeTurn;
  const generateQuoteDeskHuAssistantTurnImpl =
    deps.generateQuoteDeskHuAssistantTurn || generateQuoteDeskHuAssistantTurn;
  const limitQdhIntakeAssistant =
    deps.limitQdhIntakeAssistant || createRateLimitMiddleware("public_qdh_intake_assistant", {
      windowMs: 60_000,
      max: 8,
    });

  const sendRouteError = (req, res, err, context = {}) => {
    const requestId = getRequestId(req);
    logRouteError(err, req, context);
    sendJsonError(res, err, { requestId });
  };

  router.get("/quote-desk-hu/intake-context", async (req, res) => {
    try {
      const supabase = getSupabase();
      const agent = await resolveQuoteDeskHuPublicAgentImpl(supabase, {
        agentKey: req.query.agent_key || req.query.agentKey,
      });
      const setup = await getQuoteDeskHuSetupImpl(supabase, {
        ownerUserId: agent.ownerUserId,
      });

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: QDH_PUBLIC_INTAKE_PHASE,
        business: buildPublicQdhSetupContext(setup),
        intake: {
          sourceChannel: QDH_PUBLIC_INTAKE_SOURCE_CHANNEL,
          requestOnly: true,
          staffReviewOnly: true,
        },
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/intake-context" });
    }
  });

  router.post("/quote-desk-hu/intake-requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const intake = normalizeQdhPublicIntakeBody(req.body);
      const agent = await resolveQuoteDeskHuPublicAgentImpl(supabase, {
        agentKey: intake.agentKey,
      });
      const setup = await getQuoteDeskHuSetupImpl(supabase, {
        ownerUserId: agent.ownerUserId,
      });

      assertQdhSetupAvailableForPublicIntake(setup);

      const request = await createAgentQuoteRequestImpl(supabase, {
        ownerUserId: agent.ownerUserId,
        agentId: agent.id,
        businessId: agent.businessId,
        sourceChannel: QDH_PUBLIC_INTAKE_SOURCE_CHANNEL,
        displayMode: "qdh_public_intake",
        requestedService: intake.requestedService,
        projectDetails: intake.projectDetails,
        locationText: intake.locationText,
        urgency: intake.urgency,
        budgetText: intake.budgetText,
        customerName: intake.customerName,
        customerEmail: intake.customerEmail,
        customerPhone: intake.customerPhone,
        language: intake.language,
        status: "request_received",
        statusReason: "QDH public intake request received for staff review only.",
        evidence: {
          proof_source_type: "request_only",
        },
        metadata: {
          product: "quote_desk_hu",
          phase: QDH_PUBLIC_INTAKE_PHASE,
          source: QDH_PUBLIC_INTAKE_SOURCE_CHANNEL,
          request_only: true,
          consent_acknowledged: true,
        },
        idempotencyKey: buildQdhPublicIntakeIdempotencyKey(agent, intake),
      });

      res.status(201).json(buildSafePublicIntakeResponse(request));
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/intake-requests" });
    }
  });

  router.post("/quote-desk-hu/intake-assistant", limitQdhIntakeAssistant, async (req, res) => {
    try {
      const supabase = getSupabase();
      const intakeTurn = normalizeQdhAssistantBody(req.body);
      const agent = await resolveQuoteDeskHuPublicAgentImpl(supabase, {
        agentKey: intakeTurn.agentKey,
      });
      const setup = await getQuoteDeskHuSetupImpl(supabase, {
        ownerUserId: agent.ownerUserId,
      });

      assertQdhSetupAvailableForPublicIntake(setup);

      let openai = null;
      try {
        openai = getOpenAI();
      } catch {
        openai = null;
      }

      const analysis = await generateQuoteDeskHuAssistantTurnImpl({
        supabase,
        openai,
        agent,
        message: intakeTurn.message,
        conversation: intakeTurn.conversation,
        fields: intakeTurn.fields,
        businessContext: buildPublicQdhSetupContext(setup),
        confirmSubmit: intakeTurn.confirmSubmit,
      }, {
        analyzeQuoteDeskHuIntakeTurn: analyzeQuoteDeskHuIntakeTurnImpl,
      });

      if (!intakeTurn.confirmSubmit || analysis.readyToSubmit !== true) {
        res.json(buildSafeAssistantResponse(analysis));
        return;
      }

      if (!intakeTurn.consentAcknowledged) {
        throw buildQuoteDeskHuRouteError(
          "Request-only acknowledgement is required",
          400,
          "qdh_intake_acknowledgement_required"
        );
      }

      const requestFields = toQuoteDeskHuRequestPayloadFields(analysis.fields);
      assertSafePublicIntakeContact({
        customerEmail: requestFields.customerEmail,
        customerPhone: requestFields.customerPhone,
      });

      const request = await createAgentQuoteRequestImpl(supabase, {
        ownerUserId: agent.ownerUserId,
        agentId: agent.id,
        businessId: agent.businessId,
        sourceChannel: QDH_AI_INTAKE_SOURCE_CHANNEL,
        displayMode: QDH_AI_INTAKE_DISPLAY_MODE,
        requestedService: requestFields.requestedService,
        projectDetails: requestFields.projectDetails,
        locationText: requestFields.locationText,
        urgency: requestFields.urgency,
        budgetText: requestFields.budgetText,
        customerName: requestFields.customerName,
        customerEmail: requestFields.customerEmail,
        customerPhone: requestFields.customerPhone,
        language: "hu",
        status: "request_received",
        statusReason: "QDH AI-assisted intake request received for staff review only.",
        evidence: {
          proof_source_type: "request_only",
          qdh_ai_intake: {
            staff_summary_hu: cleanText(analysis.staffSummary),
            safety_flags: {
              prompt_injection: analysis.safetyFlags?.promptInjection === true,
              emergency: analysis.safetyFlags?.emergency === true,
              pricing_boundary_requested: analysis.safetyFlags?.pricingGuaranteeRequested === true,
              out_of_scope: analysis.safetyFlags?.outOfScope === true,
            },
            missing_fields_at_submit: analysis.missingFields,
          },
        },
        metadata: {
          product: "quote_desk_hu",
          phase: QDH_AI_INTAKE_PHASE,
          source: QDH_AI_INTAKE_SOURCE_CHANNEL,
          request_only: true,
          consent_acknowledged: true,
          assistant_version: "qdh_ai_intake_v1",
        },
        idempotencyKey: buildQdhAiIntakeIdempotencyKey(agent, requestFields),
      });

      res.status(201).json(buildSafeAssistantResponse(analysis, request));
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/intake-assistant" });
    }
  });

  router.get("/quote-desk-hu/requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);
      const status = assertQdhVisibleRequestStatus(req.query.status);

      if (agentId) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      const records = filterQdhVisibleRequests(await listAgentQuoteRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status,
        limit: req.query.limit || 100,
      }));

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "request_intake_review",
        safeStatuses: QDH_SAFE_REVIEW_STATUSES,
        visibleStatuses: QDH_VISIBLE_REQUEST_STATUSES,
        summary: buildQuoteDeskHuSummary(records),
        records,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/requests" });
    }
  });

  router.get("/quote-desk-hu/setup-state", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const setup = await getQuoteDeskHuSetupImpl(supabase, {
        ownerUserId: user.id,
      });
      const publicAgent = setup
        ? await getQuoteDeskHuPublicAgentForOwnerImpl(supabase, { ownerUserId: user.id })
        : null;

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "self_serve_setup_readiness",
        setupComplete: Boolean(setup),
        setup,
        customerIntake: buildQdhCustomerIntakeInfo(req, publicAgent),
        nextUrl: setup ? "/qdh/dashboard" : "/qdh/setup",
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/setup-state" });
    }
  });

  router.post("/quote-desk-hu/setup", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const setup = await saveQuoteDeskHuSetupImpl(supabase, {
        ownerUserId: user.id,
        businessName: readBodyField(req.body, "business_name", "businessName"),
        websiteUrl: readBodyField(req.body, "website_url", "websiteUrl"),
        serviceType: readBodyField(req.body, "service_type", "serviceType"),
        serviceArea: readBodyField(req.body, "service_area", "serviceArea"),
        handlingPreference: readBodyField(req.body, "handling_preference", "handlingPreference"),
        ownerContactEmail: readBodyField(req.body, "owner_contact_email", "ownerContactEmail"),
        servicesOffered: req.body?.services_offered || req.body?.servicesOffered,
      });

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "self_serve_setup_readiness",
        setupComplete: true,
        setup,
        customerIntake: buildQdhCustomerIntakeInfo(req, await getQuoteDeskHuPublicAgentForOwnerImpl(supabase, {
          ownerUserId: user.id,
        })),
        nextUrl: "/qdh/dashboard",
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/setup" });
    }
  });

  router.post("/quote-desk-hu/requests/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");

      if (!cleanText(requestId)) {
        throw buildQuoteDeskHuRouteError("request_id is required", 400, "qdh_request_id_required");
      }

      const status = assertQdhReviewStatus(readBodyField(req.body, "status"));
      const statusReason = readBodyField(req.body, "status_reason", "statusReason");
      const staffNotes = readBodyField(req.body, "staff_notes", "staffNotes");

      const updateOptions = {
        ownerUserId: user.id,
        requestId,
        status,
      };

      if (statusReason !== undefined) {
        updateOptions.statusReason = statusReason;
      }

      if (staffNotes !== undefined) {
        updateOptions.staffNotes = staffNotes;
      }

      const request = await updateAgentQuoteRequestStatusImpl(supabase, updateOptions);

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "request_intake_review",
        request,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/requests/status" });
    }
  });

  return router;
}
