import { normalizeWebsiteUrl } from "../../utils/url.js";
import { cleanText } from "../../utils/text.js";

export const QDH_OWNER_SETUPS_TABLE = "qdh_owner_setups";

const HANDLING_PREFERENCES = new Set([
  "staff_review",
  "email_review",
  "phone_review",
]);

function nowIso() {
  return new Date().toISOString();
}

function isMissingRelationError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(`'public.${QDH_OWNER_SETUPS_TABLE}'`) ||
    message.includes(`${QDH_OWNER_SETUPS_TABLE} was not found`) ||
    message.includes(`relation "${QDH_OWNER_SETUPS_TABLE}" does not exist`)
  );
}

function buildSetupError(message, statusCode = 400, code = "qdh_setup_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function buildMissingSetupTableError() {
  return buildSetupError(
    "Quote Desk HU setup storage is not available. Apply the QDH setup migration before onboarding owners.",
    503,
    "qdh_setup_table_missing"
  );
}

function normalizeServiceList(value) {
  const source = Array.isArray(value)
    ? value
    : cleanText(value).split(/[\n,;]/);

  return [...new Set(source.map((item) => cleanText(item)).filter(Boolean))].slice(0, 24);
}

function normalizeHandlingPreference(value) {
  const normalized = cleanText(value).toLowerCase();
  return HANDLING_PREFERENCES.has(normalized) ? normalized : "staff_review";
}

function mapSetupRow(row) {
  if (!row) {
    return null;
  }

  return {
    ownerUserId: cleanText(row.owner_user_id),
    businessName: cleanText(row.business_name),
    websiteUrl: cleanText(row.website_url),
    serviceType: cleanText(row.service_type),
    serviceArea: cleanText(row.service_area),
    handlingPreference: normalizeHandlingPreference(row.handling_preference),
    ownerContactEmail: cleanText(row.owner_contact_email),
    servicesOffered: Array.isArray(row.services_offered)
      ? row.services_offered.map((item) => cleanText(item)).filter(Boolean)
      : [],
    setupStatus: cleanText(row.setup_status) || "ready_for_review",
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function buildSetupPayload(ownerUserId, input = {}) {
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const businessName = cleanText(input.businessName || input.business_name);
  const providedWebsiteUrl = cleanText(input.websiteUrl || input.website_url);
  const websiteUrl = normalizeWebsiteUrl(providedWebsiteUrl, {
    requireHttps: true,
    requirePublicHostname: true,
  });
  const serviceType = cleanText(input.serviceType || input.service_type);
  const serviceArea = cleanText(input.serviceArea || input.service_area);
  const ownerContactEmail = cleanText(input.ownerContactEmail || input.owner_contact_email);
  const servicesOffered = normalizeServiceList(input.servicesOffered || input.services_offered);

  if (!normalizedOwnerUserId) {
    throw buildSetupError("owner_user_id is required", 400, "qdh_owner_required");
  }

  if (!businessName) {
    throw buildSetupError("business_name is required", 400, "qdh_business_name_required");
  }

  if (!providedWebsiteUrl || !websiteUrl) {
    throw buildSetupError(
      "A valid public https website_url is required.",
      400,
      "qdh_website_url_required"
    );
  }

  if (!serviceType) {
    throw buildSetupError("service_type is required", 400, "qdh_service_type_required");
  }

  if (!serviceArea) {
    throw buildSetupError("service_area is required", 400, "qdh_service_area_required");
  }

  if (!ownerContactEmail) {
    throw buildSetupError("owner_contact_email is required", 400, "qdh_contact_email_required");
  }

  if (!servicesOffered.length) {
    throw buildSetupError("services_offered is required", 400, "qdh_services_required");
  }

  return {
    owner_user_id: normalizedOwnerUserId,
    business_name: businessName,
    website_url: websiteUrl,
    service_type: serviceType,
    service_area: serviceArea,
    handling_preference: normalizeHandlingPreference(input.handlingPreference || input.handling_preference),
    owner_contact_email: ownerContactEmail,
    services_offered: servicesOffered,
    setup_status: "ready_for_review",
    metadata: {
      product: "quote_desk_hu",
      phase: "self_serve_setup_readiness",
      storage: "setup_readiness_only",
    },
    updated_at: nowIso(),
  };
}

export async function getQuoteDeskHuSetup(supabase, options = {}) {
  const ownerUserId = cleanText(options.ownerUserId);

  if (!ownerUserId) {
    throw buildSetupError("owner_user_id is required", 400, "qdh_owner_required");
  }

  const { data, error } = await supabase
    .from(QDH_OWNER_SETUPS_TABLE)
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

export async function saveQuoteDeskHuSetup(supabase, options = {}) {
  const payload = buildSetupPayload(options.ownerUserId, options);

  const { data, error } = await supabase
    .from(QDH_OWNER_SETUPS_TABLE)
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
