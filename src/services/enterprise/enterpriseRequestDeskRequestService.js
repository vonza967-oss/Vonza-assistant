import { ENTERPRISE_REQUEST_DESK_REQUEST_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import {
  ENTERPRISE_REQUEST_DESK_LANE_KEYS,
  getEnterpriseRequestDeskLane,
} from "./enterpriseRequestDeskLaneService.js";

const AGENTS_TABLE = "agents";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const ENTERPRISE_REQUEST_DESK_REQUIRED_FIELDS = new Set([
  "service_need",
  "location_or_site",
  "urgency_or_timing",
  "contact_need",
]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const KNOWN_LANE_KEYS = new Set(ENTERPRISE_REQUEST_DESK_LANE_KEYS);
const SECRET_LIKE_PATTERN =
  /(?:SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET|STRIPE_SECRET_KEY|service[_\s-]?role|api[_\s-]?key|secret[_\s-]?key|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/i;
const UNSAFE_URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;
const UNSAFE_JSON_KEY_PATTERN =
  /(?:owner[_\s-]?user|internal|service[_\s-]?role|api[_\s-]?key|secret|password|token|prompt|developer|system|policy|package|model|agent[_\s-]?id|business[_\s-]?id)/i;

export const ENTERPRISE_REQUEST_DESK_REQUEST_STATUSES = Object.freeze([
  "request_received",
  "needs_info",
  "needs_staff_review",
  "routed",
  "declined",
  "archived",
]);

export const ENTERPRISE_REQUEST_DESK_REVIEW_STATUSES = Object.freeze([
  "needs_info",
  "needs_staff_review",
  "routed",
  "declined",
  "archived",
]);

const STATUS_SET = new Set(ENTERPRISE_REQUEST_DESK_REQUEST_STATUSES);
const REVIEW_STATUS_SET = new Set(ENTERPRISE_REQUEST_DESK_REVIEW_STATUSES);
const CREATE_STATUS_SET = new Set(["request_received", "needs_info", "needs_staff_review"]);
const ALLOWED_TRANSITIONS = Object.freeze({
  request_received: new Set(["needs_info", "needs_staff_review", "routed", "declined", "archived"]),
  needs_info: new Set(["needs_staff_review", "routed", "declined", "archived"]),
  needs_staff_review: new Set(["needs_info", "routed", "declined", "archived"]),
  routed: new Set(["needs_info", "needs_staff_review", "archived"]),
  declined: new Set(["archived"]),
  archived: new Set([]),
});

const FIELD_LIMITS = Object.freeze({
  sourceKeyHash: 96,
  lane: 80,
  laneLabel: 140,
  confidence: 16,
  requestText: 2200,
  siteOrObject: 180,
  locationText: 180,
  serviceNeed: 220,
  timingText: 160,
  urgency: 120,
  contactName: 140,
  contactEmail: 180,
  contactPhone: 80,
  statusReason: 400,
  staffNotes: 1200,
  idempotencyKey: 180,
});

const REQUEST_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "business_id",
  "source_key_hash",
  "lane",
  "lane_label",
  "confidence",
  "request_text",
  "site_or_object",
  "location_text",
  "service_need",
  "timing_text",
  "urgency",
  "contact_name",
  "contact_email",
  "contact_phone",
  "missing_fields",
  "structured_brief",
  "evidence",
  "metadata",
  "status",
  "staff_notes",
  "status_reason",
  "idempotency_key",
  "created_at",
  "updated_at",
].join(", ");

function buildRequestError(
  message,
  statusCode = 400,
  code = "enterprise_request_desk_request_invalid"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanInputText(value) {
  return cleanText(String(value ?? ""));
}

function requireCleanText(value, fieldName, statusCode = 400) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    throw buildRequestError(`${fieldName} is required`, statusCode);
  }

  return normalized;
}

function normalizeOptionalText(value, {
  fieldName = "field",
  maxLength = 400,
  allowUrl = false,
} = {}) {
  const normalized = cleanInputText(value);

  if (!normalized) {
    return null;
  }

  assertSafePublicText(normalized, fieldName, { allowUrl });
  return normalized.slice(0, maxLength);
}

function normalizeEmail(value) {
  const email = cleanInputText(value).toLowerCase();

  if (!email) {
    return null;
  }

  assertSafePublicText(email, "contact_email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw buildRequestError("contact_email must be a valid email address", 400, "enterprise_contact_email_invalid");
  }

  return email.slice(0, FIELD_LIMITS.contactEmail);
}

function normalizePhone(value) {
  const phone = cleanInputText(value);

  if (!phone) {
    return null;
  }

  assertSafePublicText(phone, "contact_phone");
  if (phone.replace(/\D/g, "").length < 7) {
    throw buildRequestError("contact_phone must include a reachable phone number", 400, "enterprise_contact_phone_invalid");
  }

  return phone.slice(0, FIELD_LIMITS.contactPhone);
}

function normalizeStatus(value, fallback = "request_received") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!STATUS_SET.has(normalized)) {
    throw buildRequestError(
      `Unsupported Enterprise Request Desk status '${cleanInputText(value)}'.`,
      400,
      "enterprise_request_status_not_allowed"
    );
  }

  return normalized;
}

function normalizeReviewStatus(value) {
  const status = normalizeStatus(value);

  if (!REVIEW_STATUS_SET.has(status)) {
    throw buildRequestError(
      "Enterprise Request Desk only supports request-review status updates in this phase.",
      400,
      "enterprise_request_status_not_allowed"
    );
  }

  return status;
}

function assertCreateStatus(status) {
  if (!CREATE_STATUS_SET.has(status)) {
    throw buildRequestError(
      "New Enterprise Request Desk requests can only start as request_received, needs_info, or needs_staff_review.",
      400,
      "enterprise_request_create_status_not_allowed"
    );
  }
}

function assertAllowedTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus)) {
    throw buildRequestError(
      `Enterprise Request Desk status cannot transition from ${fromStatus} to ${toStatus}.`,
      400,
      "enterprise_request_transition_not_allowed"
    );
  }
}

function assertSafePublicText(value, fieldName, { allowUrl = false } = {}) {
  const text = cleanInputText(value);

  if (!text) {
    return;
  }

  if (SECRET_LIKE_PATTERN.test(text)) {
    throw buildRequestError(
      `${fieldName} contains unsafe or secret-looking content.`,
      400,
      "enterprise_request_secret_rejected"
    );
  }

  if (!allowUrl && UNSAFE_URL_PATTERN.test(text)) {
    throw buildRequestError(
      `${fieldName} must not include URLs in this intake surface.`,
      400,
      "enterprise_request_url_rejected"
    );
  }
}

function normalizeLaneKey(value, fallback = "general_enquiry") {
  const normalized = cleanInputText(value || fallback).toLowerCase();

  if (!KNOWN_LANE_KEYS.has(normalized)) {
    throw buildRequestError(
      `Unsupported Enterprise Request Desk lane '${cleanInputText(value)}'.`,
      400,
      "enterprise_request_lane_not_allowed"
    );
  }

  return normalized;
}

function normalizeConfidence(value) {
  const normalized = cleanInputText(value).toLowerCase();
  return CONFIDENCE_VALUES.has(normalized) ? normalized : "low";
}

function normalizeMissingFields(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => cleanInputText(item)).filter((item) =>
    ENTERPRISE_REQUEST_DESK_REQUIRED_FIELDS.has(item)
  ))];
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function sanitizeJsonValue(value, {
  fieldName = "json",
  depth = 0,
  maxStringLength = 700,
} = {}) {
  if (depth > 5 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = typeof value === "string" ? cleanInputText(value) : value;
    if (typeof text === "string") {
      if (!text) {
        return "";
      }
      assertSafePublicText(text, fieldName);
      return text.slice(0, maxStringLength);
    }
    return text;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((entry) => sanitizeJsonValue(entry, {
        fieldName,
        depth: depth + 1,
        maxStringLength,
      }))
      .filter((entry) => entry !== null && entry !== "");
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => {
          const normalizedKey = cleanInputText(key);
          return normalizedKey && !UNSAFE_JSON_KEY_PATTERN.test(normalizedKey);
        })
        .map(([key, nestedValue]) => [
          cleanInputText(key).slice(0, 80),
          sanitizeJsonValue(nestedValue, {
            fieldName: `${fieldName}.${key}`,
            depth: depth + 1,
            maxStringLength,
          }),
        ])
        .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== "")
    );
  }

  return null;
}

function sanitizeJsonObject(value, fieldName) {
  const sanitized = sanitizeJsonValue(normalizePlainObject(value), { fieldName });
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized : {};
}

function normalizeStructuredBrief(value = {}, fallback = {}) {
  const source = normalizePlainObject(value);
  const lane = normalizeLaneKey(source.lane || fallback.lane);
  const laneDefinition = getEnterpriseRequestDeskLane(lane);
  const missingFields = normalizeMissingFields(source.missingFields || source.missing_fields || fallback.missingFields);
  const safetyFlags = normalizePlainObject(source.safetyFlags || source.safety_flags);

  return {
    lane,
    laneLabelHu: normalizeOptionalText(
      source.laneLabelHu || source.lane_label_hu || source.laneLabel || fallback.laneLabel,
      { fieldName: "structured_brief.laneLabelHu", maxLength: FIELD_LIMITS.laneLabel }
    ) || laneDefinition?.labelHu || "Általános érdeklődés",
    confidence: normalizeConfidence(source.confidence || fallback.confidence),
    serviceNeed: normalizeOptionalText(source.serviceNeed || source.service_need || fallback.serviceNeed, {
      fieldName: "structured_brief.serviceNeed",
      maxLength: FIELD_LIMITS.serviceNeed,
    }) || "",
    locationOrSite: normalizeOptionalText(source.locationOrSite || source.location_or_site || fallback.locationOrSite, {
      fieldName: "structured_brief.locationOrSite",
      maxLength: FIELD_LIMITS.locationText,
    }) || "",
    urgencyOrTiming: normalizeOptionalText(source.urgencyOrTiming || source.urgency_or_timing || fallback.urgencyOrTiming, {
      fieldName: "structured_brief.urgencyOrTiming",
      maxLength: FIELD_LIMITS.timingText,
    }) || "",
    contactNeed: normalizeOptionalText(source.contactNeed || source.contact_need || fallback.contactNeed, {
      fieldName: "structured_brief.contactNeed",
      maxLength: 180,
    }) || "",
    contactName: normalizeOptionalText(source.contactName || source.contact_name || fallback.contactName, {
      fieldName: "structured_brief.contactName",
      maxLength: FIELD_LIMITS.contactName,
    }) || "",
    contactEmail: normalizeEmail(source.contactEmail || source.contact_email || fallback.contactEmail) || "",
    contactPhone: normalizePhone(source.contactPhone || source.contact_phone || fallback.contactPhone) || "",
    organizationName: normalizeOptionalText(source.organizationName || source.organization_name, {
      fieldName: "structured_brief.organizationName",
      maxLength: 140,
    }) || "",
    siteType: normalizeOptionalText(source.siteType || source.site_type || fallback.siteType, {
      fieldName: "structured_brief.siteType",
      maxLength: FIELD_LIMITS.siteOrObject,
    }) || "",
    notes: normalizeOptionalText(source.notes, {
      fieldName: "structured_brief.notes",
      maxLength: 1000,
    }) || "",
    missingFields,
    readyForOwnerReview: source.readyForOwnerReview === true || source.ready_for_owner_review === true,
    safetyFlags: {
      promptInjection: safetyFlags.promptInjection === true || safetyFlags.prompt_injection === true,
      secretLikeInput: safetyFlags.secretLikeInput === true || safetyFlags.secret_like_input === true,
      pricingGuaranteeRequested:
        safetyFlags.pricingGuaranteeRequested === true || safetyFlags.pricing_guarantee_requested === true,
      deferredOperationsRequested:
        safetyFlags.deferredOperationsRequested === true || safetyFlags.deferred_operations_requested === true,
    },
    staffSummaryHu: normalizeOptionalText(source.staffSummaryHu || source.staff_summary_hu, {
      fieldName: "structured_brief.staffSummaryHu",
      maxLength: 1000,
    }) || "",
  };
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
}

function resolveBusinessId({ inputBusinessId, agentBusinessId }) {
  const normalizedInput = normalizeOptionalText(inputBusinessId, {
    fieldName: "business_id",
    maxLength: 80,
  });
  const normalizedAgentBusinessId = normalizeOptionalText(agentBusinessId, {
    fieldName: "agent_business_id",
    maxLength: 80,
  });

  if (normalizedInput && normalizedAgentBusinessId && normalizedInput !== normalizedAgentBusinessId) {
    throw buildRequestError(
      "business_id must belong to the owner-scoped agent.",
      400,
      "enterprise_request_agent_business_scope_mismatch"
    );
  }

  return normalizedInput || normalizedAgentBusinessId;
}

export function mapEnterpriseRequestDeskRequest(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: normalizeOptionalText(row.id, { fieldName: "id", maxLength: 80 }),
    ownerUserId: normalizeOptionalText(row.owner_user_id, { fieldName: "owner_user_id", maxLength: 80 }),
    agentId: normalizeOptionalText(row.agent_id, { fieldName: "agent_id", maxLength: 80 }),
    businessId: normalizeOptionalText(row.business_id, { fieldName: "business_id", maxLength: 80 }),
    sourceKeyHash: normalizeOptionalText(row.source_key_hash, {
      fieldName: "source_key_hash",
      maxLength: FIELD_LIMITS.sourceKeyHash,
    }),
    lane: normalizeLaneKey(row.lane),
    laneLabel: normalizeOptionalText(row.lane_label, {
      fieldName: "lane_label",
      maxLength: FIELD_LIMITS.laneLabel,
    }),
    confidence: normalizeConfidence(row.confidence),
    requestText: normalizeOptionalText(row.request_text, {
      fieldName: "request_text",
      maxLength: FIELD_LIMITS.requestText,
    }),
    siteOrObject: normalizeOptionalText(row.site_or_object, {
      fieldName: "site_or_object",
      maxLength: FIELD_LIMITS.siteOrObject,
    }),
    locationText: normalizeOptionalText(row.location_text, {
      fieldName: "location_text",
      maxLength: FIELD_LIMITS.locationText,
    }),
    serviceNeed: normalizeOptionalText(row.service_need, {
      fieldName: "service_need",
      maxLength: FIELD_LIMITS.serviceNeed,
    }),
    timingText: normalizeOptionalText(row.timing_text, {
      fieldName: "timing_text",
      maxLength: FIELD_LIMITS.timingText,
    }),
    urgency: normalizeOptionalText(row.urgency, {
      fieldName: "urgency",
      maxLength: FIELD_LIMITS.urgency,
    }),
    contactName: normalizeOptionalText(row.contact_name, {
      fieldName: "contact_name",
      maxLength: FIELD_LIMITS.contactName,
    }),
    contactEmail: normalizeEmail(row.contact_email),
    contactPhone: normalizePhone(row.contact_phone),
    missingFields: normalizeMissingFields(row.missing_fields),
    structuredBrief: normalizeStructuredBrief(row.structured_brief, {
      lane: row.lane,
      laneLabel: row.lane_label,
      confidence: row.confidence,
      serviceNeed: row.service_need,
      locationOrSite: row.location_text || row.site_or_object,
      urgencyOrTiming: row.timing_text || row.urgency,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      missingFields: row.missing_fields,
    }),
    evidence: sanitizeJsonObject(row.evidence, "evidence"),
    metadata: sanitizeJsonObject(row.metadata, "metadata"),
    status: normalizeStatus(row.status),
    staffNotes: normalizeOptionalText(row.staff_notes, {
      fieldName: "staff_notes",
      maxLength: FIELD_LIMITS.staffNotes,
    }),
    statusReason: normalizeOptionalText(row.status_reason, {
      fieldName: "status_reason",
      maxLength: FIELD_LIMITS.statusReason,
    }),
    idempotencyKey: normalizeOptionalText(row.idempotency_key, {
      fieldName: "idempotency_key",
      maxLength: FIELD_LIMITS.idempotencyKey,
    }),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function getOwnerScopedAgent(supabase, { agentId, ownerUserId }) {
  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select("id, business_id, owner_user_id")
    .eq("id", agentId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildRequestError("Agent not found", 404, "enterprise_request_agent_not_found");
  }

  return data;
}

async function findExistingByIdempotencyKey(supabase, { ownerUserId, agentId, idempotencyKey }) {
  if (!idempotencyKey) {
    return null;
  }

  const { data, error } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_REQUEST_TABLE)
    .select(REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("agent_id", agentId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapEnterpriseRequestDeskRequest(data);
}

export async function createEnterpriseRequestDeskRequest(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = requireCleanText(options.agentId || options.agent_id, "agent_id");
  const status = normalizeStatus(options.status);
  const lane = normalizeLaneKey(options.lane);
  const laneDefinition = getEnterpriseRequestDeskLane(lane);
  const missingFields = normalizeMissingFields(options.missingFields || options.missing_fields);
  const structuredBrief = normalizeStructuredBrief(options.structuredBrief || options.structured_brief, {
    lane,
    laneLabel: options.laneLabel || options.lane_label || laneDefinition?.labelHu,
    confidence: options.confidence,
    serviceNeed: options.serviceNeed || options.service_need,
    locationOrSite: options.locationText || options.location_text || options.siteOrObject || options.site_or_object,
    urgencyOrTiming: options.timingText || options.timing_text || options.urgency,
    contactNeed: options.contactNeed || options.contact_need,
    contactName: options.contactName || options.contact_name,
    contactEmail: options.contactEmail || options.contact_email,
    contactPhone: options.contactPhone || options.contact_phone,
    missingFields,
  });
  const metadata = sanitizeJsonObject(options.metadata, "metadata");
  const evidence = sanitizeJsonObject(options.evidence, "evidence");
  const idempotencyKey = normalizeOptionalText(options.idempotencyKey || options.idempotency_key, {
    fieldName: "idempotency_key",
    maxLength: FIELD_LIMITS.idempotencyKey,
  });

  assertCreateStatus(status);

  const existing = await findExistingByIdempotencyKey(supabase, {
    ownerUserId,
    agentId,
    idempotencyKey,
  });

  if (existing) {
    return {
      ...existing,
      wasExisting: true,
    };
  }

  const agent = await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  const now = new Date().toISOString();
  const payload = {
    owner_user_id: ownerUserId,
    agent_id: agentId,
    business_id: resolveBusinessId({
      inputBusinessId: options.businessId || options.business_id,
      agentBusinessId: agent.business_id,
    }),
    source_key_hash: normalizeOptionalText(options.sourceKeyHash || options.source_key_hash, {
      fieldName: "source_key_hash",
      maxLength: FIELD_LIMITS.sourceKeyHash,
    }),
    lane,
    lane_label: normalizeOptionalText(options.laneLabel || options.lane_label, {
      fieldName: "lane_label",
      maxLength: FIELD_LIMITS.laneLabel,
    }) || laneDefinition?.labelHu || structuredBrief.laneLabelHu,
    confidence: normalizeConfidence(options.confidence || structuredBrief.confidence),
    request_text: normalizeOptionalText(options.requestText || options.request_text, {
      fieldName: "request_text",
      maxLength: FIELD_LIMITS.requestText,
    }),
    site_or_object: normalizeOptionalText(options.siteOrObject || options.site_or_object, {
      fieldName: "site_or_object",
      maxLength: FIELD_LIMITS.siteOrObject,
    }),
    location_text: normalizeOptionalText(options.locationText || options.location_text, {
      fieldName: "location_text",
      maxLength: FIELD_LIMITS.locationText,
    }),
    service_need: normalizeOptionalText(options.serviceNeed || options.service_need, {
      fieldName: "service_need",
      maxLength: FIELD_LIMITS.serviceNeed,
    }),
    timing_text: normalizeOptionalText(options.timingText || options.timing_text, {
      fieldName: "timing_text",
      maxLength: FIELD_LIMITS.timingText,
    }),
    urgency: normalizeOptionalText(options.urgency, {
      fieldName: "urgency",
      maxLength: FIELD_LIMITS.urgency,
    }),
    contact_name: normalizeOptionalText(options.contactName || options.contact_name, {
      fieldName: "contact_name",
      maxLength: FIELD_LIMITS.contactName,
    }),
    contact_email: normalizeEmail(options.contactEmail || options.contact_email),
    contact_phone: normalizePhone(options.contactPhone || options.contact_phone),
    missing_fields: missingFields,
    structured_brief: structuredBrief,
    evidence,
    metadata,
    status,
    status_reason: normalizeOptionalText(options.statusReason || options.status_reason, {
      fieldName: "status_reason",
      maxLength: FIELD_LIMITS.statusReason,
    }),
    staff_notes: normalizeOptionalText(options.staffNotes || options.staff_notes, {
      fieldName: "staff_notes",
      maxLength: FIELD_LIMITS.staffNotes,
    }),
    idempotency_key: idempotencyKey,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_REQUEST_TABLE)
    .insert(payload)
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return {
    ...mapEnterpriseRequestDeskRequest(data),
    wasExisting: false,
  };
}

export async function listEnterpriseRequestDeskRequests(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const agentId = cleanInputText(options.agentId || options.agent_id);
  const businessId = cleanInputText(options.businessId || options.business_id);
  const status = cleanInputText(options.status) ? normalizeStatus(options.status) : "";

  if (agentId) {
    await getOwnerScopedAgent(supabase, { agentId, ownerUserId });
  }

  let query = supabase
    .from(ENTERPRISE_REQUEST_DESK_REQUEST_TABLE)
    .select(REQUEST_SELECT)
    .eq("owner_user_id", ownerUserId);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(mapEnterpriseRequestDeskRequest);
}

export async function updateEnterpriseRequestDeskRequestStatus(supabase, options = {}) {
  const ownerUserId = requireCleanText(options.ownerUserId || options.owner_user_id, "owner_user_id", 401);
  const requestId = requireCleanText(options.requestId || options.request_id, "request_id");
  const status = normalizeReviewStatus(options.status);

  const { data: existing, error: selectError } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_REQUEST_TABLE)
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!existing) {
    throw buildRequestError("Enterprise Request Desk request not found", 404, "enterprise_request_not_found");
  }

  const existingStatus = normalizeStatus(existing.status);
  assertAllowedTransition(existingStatus, status);

  const updatePayload = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(options, "statusReason")
    || Object.prototype.hasOwnProperty.call(options, "status_reason")) {
    updatePayload.status_reason = normalizeOptionalText(options.statusReason || options.status_reason, {
      fieldName: "status_reason",
      maxLength: FIELD_LIMITS.statusReason,
    });
  }

  if (Object.prototype.hasOwnProperty.call(options, "staffNotes")
    || Object.prototype.hasOwnProperty.call(options, "staff_notes")) {
    updatePayload.staff_notes = normalizeOptionalText(options.staffNotes || options.staff_notes, {
      fieldName: "staff_notes",
      maxLength: FIELD_LIMITS.staffNotes,
    });
  }

  const { data, error } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_REQUEST_TABLE)
    .update(updatePayload)
    .eq("id", requestId)
    .eq("owner_user_id", ownerUserId)
    .select(REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw buildRequestError("Enterprise Request Desk request not found", 404, "enterprise_request_not_found");
  }

  return mapEnterpriseRequestDeskRequest(data);
}
