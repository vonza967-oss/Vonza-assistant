import { normalizeWebsiteUrl } from "../../utils/url.js";
import { cleanText } from "../../utils/text.js";

export const ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE = "enterprise_request_desk_owner_setups";

const AGENTS_TABLE = "agents";
const ENTERPRISE_PUBLIC_AGENT_SELECT = [
  "id",
  "business_id",
  "owner_user_id",
  "access_status",
  "public_agent_key",
  "is_active",
  "updated_at",
].join(", ");
const ROUTING_PREFERENCES = new Set([
  "internal_handoff",
  "email_triage",
  "phone_followup",
]);
const SETUP_SECRET_VALUE_PATTERN =
  /(?:SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET|STRIPE_SECRET_KEY|service[_\s-]?role|api[_\s-]?key|secret[_\s-]?key|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/i;

function nowIso() {
  return new Date().toISOString();
}

function isMissingRelationError(error, tableName = ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(`'public.${tableName}'`) ||
    message.includes(`${tableName} was not found`) ||
    message.includes(`relation "${tableName}" does not exist`)
  );
}

function buildSetupError(
  message,
  statusCode = 400,
  code = "enterprise_request_desk_setup_invalid"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function buildMissingSetupTableError() {
  return buildSetupError(
    "Enterprise Request Desk setup storage is not available. Apply the Enterprise setup migration before onboarding owners.",
    503,
    "enterprise_request_desk_setup_table_missing"
  );
}

function normalizeServiceLines(value) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[\n,;]/);

  return [...new Set(source.map((item) => cleanText(item)).filter(Boolean))].slice(0, 24);
}

function normalizeRoutingPreference(value) {
  const normalized = cleanText(value).toLowerCase();
  return ROUTING_PREFERENCES.has(normalized) ? normalized : "internal_handoff";
}

function normalizeAccessStatus(value) {
  return cleanText(value).toLowerCase() || "pending";
}

function normalizeEmail(value) {
  const email = cleanText(value).toLowerCase();

  if (!email) {
    return "";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw buildSetupError(
      "owner_contact_email must be a valid email address",
      400,
      "enterprise_request_desk_contact_email_invalid"
    );
  }

  return email;
}

function assertSafeSetupValue(value) {
  const values = Array.isArray(value) ? value : [value];

  values.forEach((item) => {
    if (SETUP_SECRET_VALUE_PATTERN.test(cleanText(item))) {
      throw buildSetupError(
        "Unsafe or secret-looking setup value rejected.",
        400,
        "enterprise_request_desk_setup_unsafe_value_rejected"
      );
    }
  });
}

function mapSetupRow(row) {
  if (!row) {
    return null;
  }

  return {
    ownerUserId: cleanText(row.owner_user_id),
    organizationName: cleanText(row.organization_name),
    websiteUrl: cleanText(row.website_url),
    serviceArea: cleanText(row.service_area),
    serviceLines: Array.isArray(row.service_lines)
      ? row.service_lines.map((item) => cleanText(item)).filter(Boolean)
      : [],
    intakePositioning: cleanText(row.intake_positioning),
    routingPreference: normalizeRoutingPreference(row.routing_preference),
    ownerContactEmail: cleanText(row.owner_contact_email),
    setupStatus: cleanText(row.setup_status) || "ready_for_review",
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapPublicAgentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: cleanText(row.id),
    businessId: cleanText(row.business_id),
    ownerUserId: cleanText(row.owner_user_id),
    accessStatus: normalizeAccessStatus(row.access_status),
    publicAgentKey: cleanText(row.public_agent_key),
    isActive: row.is_active !== false,
  };
}

function buildSetupPayload(ownerUserId, input = {}) {
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const organizationName = cleanText(input.organizationName || input.organization_name);
  const providedWebsiteUrl = cleanText(input.websiteUrl || input.website_url);
  const websiteUrl = normalizeWebsiteUrl(providedWebsiteUrl, {
    requireHttps: true,
    requirePublicHostname: true,
  });
  const serviceArea = cleanText(input.serviceArea || input.service_area);
  const serviceLines = normalizeServiceLines(input.serviceLines || input.service_lines);
  const intakePositioning =
    cleanText(input.intakePositioning || input.intake_positioning)
    || "qualified_enterprise_intake";
  const routingPreference = normalizeRoutingPreference(
    input.routingPreference || input.routing_preference
  );
  const ownerContactEmail = normalizeEmail(input.ownerContactEmail || input.owner_contact_email);

  [
    organizationName,
    websiteUrl,
    serviceArea,
    intakePositioning,
    routingPreference,
    ownerContactEmail,
    ...serviceLines,
  ].forEach(assertSafeSetupValue);

  if (!normalizedOwnerUserId) {
    throw buildSetupError(
      "owner_user_id is required",
      400,
      "enterprise_request_desk_owner_required"
    );
  }

  if (!organizationName) {
    throw buildSetupError(
      "organization_name is required",
      400,
      "enterprise_request_desk_organization_name_required"
    );
  }

  if (!providedWebsiteUrl || !websiteUrl) {
    throw buildSetupError(
      "A valid public https website_url is required.",
      400,
      "enterprise_request_desk_website_url_required"
    );
  }

  if (!serviceArea) {
    throw buildSetupError(
      "service_area is required",
      400,
      "enterprise_request_desk_service_area_required"
    );
  }

  if (!serviceLines.length) {
    throw buildSetupError(
      "service_lines is required",
      400,
      "enterprise_request_desk_service_lines_required"
    );
  }

  if (!ownerContactEmail) {
    throw buildSetupError(
      "owner_contact_email is required",
      400,
      "enterprise_request_desk_contact_email_required"
    );
  }

  return {
    owner_user_id: normalizedOwnerUserId,
    organization_name: organizationName,
    website_url: websiteUrl,
    service_area: serviceArea,
    service_lines: serviceLines,
    intake_positioning: intakePositioning,
    routing_preference: routingPreference,
    owner_contact_email: ownerContactEmail,
    setup_status: "ready_for_review",
    metadata: {
      product: "enterprise_request_desk",
      phase: "self_serve_setup_readiness",
      storage: "setup_readiness_only",
    },
    updated_at: nowIso(),
  };
}

export async function getEnterpriseRequestDeskSetup(supabase, options = {}) {
  const ownerUserId = cleanText(options.ownerUserId);

  if (!ownerUserId) {
    throw buildSetupError(
      "owner_user_id is required",
      400,
      "enterprise_request_desk_owner_required"
    );
  }

  const { data, error } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      throw buildMissingSetupTableError();
    }
    throw error;
  }

  return mapSetupRow(data);
}

export async function getEnterpriseRequestDeskPublicAgentForOwner(supabase, options = {}) {
  const ownerUserId = cleanText(options.ownerUserId);

  if (!ownerUserId) {
    throw buildSetupError(
      "owner_user_id is required",
      400,
      "enterprise_request_desk_owner_required"
    );
  }

  const { data, error } = await supabase
    .from(AGENTS_TABLE)
    .select(ENTERPRISE_PUBLIC_AGENT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("is_active", true)
    .eq("access_status", "active")
    .not("public_agent_key", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingRelationError(error, AGENTS_TABLE)) {
      return null;
    }
    throw error;
  }

  const agent = mapPublicAgentRow(data?.[0] || null);
  if (!agent?.publicAgentKey) {
    return null;
  }

  return agent;
}

export async function saveEnterpriseRequestDeskSetup(supabase, options = {}) {
  const payload = buildSetupPayload(options.ownerUserId, options);

  const { data, error } = await supabase
    .from(ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE)
    .upsert(payload, { onConflict: "owner_user_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      throw buildMissingSetupTableError();
    }
    throw error;
  }

  return mapSetupRow(data);
}
