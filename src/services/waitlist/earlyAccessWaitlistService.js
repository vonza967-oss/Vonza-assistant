import { createHash } from "node:crypto";

import { WIDGET_EARLY_ACCESS_APPLICATION_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const EARLY_ACCESS_WAITLIST_SELECT = [
  "id",
  "name",
  "company",
  "focus_area",
  "website_url",
  "contact_email",
  "contact_phone",
  "contact_raw",
  "application_fingerprint",
  "status",
  "locale",
  "source",
  "source_host",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const FIELD_LIMITS = Object.freeze({
  name: 120,
  company: 160,
  focusArea: 320,
  websiteUrl: 300,
  contact: 180,
  sourceHost: 180,
  userAgent: 240,
  referrer: 300,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_PATTERN = /\d/g;

function createPublicValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}

function limitText(value, maxLength) {
  return cleanText(String(value || "")).slice(0, maxLength);
}

function normalizeRequiredText(value, fieldName, maxLength) {
  const normalized = limitText(value, maxLength);

  if (!normalized) {
    throw createPublicValidationError(`${fieldName} megadása kötelező.`);
  }

  return normalized;
}

export function normalizeWaitlistWebsiteUrl(value) {
  const raw = normalizeRequiredText(value, "A weboldal URL", FIELD_LIMITS.websiteUrl);
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw createPublicValidationError("Adj meg egy érvényes weboldal URL-t.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createPublicValidationError("A weboldal URL csak http vagy https lehet.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.includes(".") || hostname.length < 4) {
    throw createPublicValidationError("Adj meg egy teljes weboldal címet.");
  }

  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";

  return parsed.toString().replace(/\/$/, "");
}

export function normalizeWaitlistContact(value) {
  const contactRaw = normalizeRequiredText(value, "Az email vagy telefon", FIELD_LIMITS.contact);
  const lowercase = contactRaw.toLowerCase();

  if (lowercase.includes("@")) {
    if (!EMAIL_PATTERN.test(lowercase)) {
      throw createPublicValidationError("Adj meg egy érvényes email címet vagy telefonszámot.");
    }

    return {
      contactRaw,
      contactEmail: lowercase,
      contactPhone: null,
    };
  }

  const digits = contactRaw.match(PHONE_DIGIT_PATTERN)?.join("") || "";
  if (digits.length < 7 || digits.length > 16) {
    throw createPublicValidationError("Adj meg egy érvényes email címet vagy telefonszámot.");
  }

  return {
    contactRaw,
    contactEmail: null,
    contactPhone: contactRaw,
  };
}

function buildApplicationFingerprint({ company, websiteUrl, contactEmail, contactPhone, contactRaw }) {
  return createHash("sha256")
    .update([
      company.toLowerCase(),
      websiteUrl.toLowerCase(),
      contactEmail || contactPhone || contactRaw.toLowerCase(),
    ].join("|"))
    .digest("hex");
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function normalizeWaitlistApplicationInput(input = {}, context = {}) {
  const honeypot = cleanText(input.nickname || input.companyWebsite || input.websiteExtra);

  if (honeypot) {
    return {
      botSubmission: true,
    };
  }

  const name = normalizeRequiredText(input.name, "A név", FIELD_LIMITS.name);
  const company = normalizeRequiredText(input.company, "A cég neve", FIELD_LIMITS.company);
  const focusArea = normalizeRequiredText(input.focusArea || input.focus_area, "A fókuszterület", FIELD_LIMITS.focusArea);
  const websiteUrl = normalizeWaitlistWebsiteUrl(input.websiteUrl || input.website_url);
  const { contactRaw, contactEmail, contactPhone } = normalizeWaitlistContact(
    input.contact || input.emailPhone || input.email_phone
  );
  const metadata = normalizePlainObject(input.metadata);
  const sourceHost = limitText(context.sourceHost, FIELD_LIMITS.sourceHost);

  const normalized = {
    name,
    company,
    focusArea,
    websiteUrl,
    contactRaw,
    contactEmail,
    contactPhone,
    applicationFingerprint: "",
    status: "new",
    locale: "hu-HU",
    source: "widget_early_access_waitlist",
    sourceHost: sourceHost || null,
    metadata: {
      ...metadata,
      user_agent: limitText(context.userAgent, FIELD_LIMITS.userAgent) || null,
      referrer: limitText(context.referrer, FIELD_LIMITS.referrer) || null,
    },
  };

  normalized.applicationFingerprint = buildApplicationFingerprint(normalized);
  return normalized;
}

function mapWaitlistApplication(row = {}) {
  return {
    id: cleanText(row.id),
    name: cleanText(row.name),
    company: cleanText(row.company),
    focusArea: cleanText(row.focus_area),
    websiteUrl: cleanText(row.website_url),
    contactEmail: cleanText(row.contact_email),
    contactPhone: cleanText(row.contact_phone),
    contactRaw: cleanText(row.contact_raw),
    applicationFingerprint: cleanText(row.application_fingerprint),
    status: cleanText(row.status) || "new",
    locale: cleanText(row.locale) || "hu-HU",
    source: cleanText(row.source),
    sourceHost: cleanText(row.source_host),
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function createEarlyAccessWaitlistApplication(supabase, input = {}, context = {}) {
  if (!supabase?.from) {
    const error = new Error("Supabase client is required.");
    error.statusCode = 500;
    throw error;
  }

  const normalized = normalizeWaitlistApplicationInput(input, context);

  if (normalized.botSubmission) {
    return {
      status: "received",
    };
  }

  const payload = {
    name: normalized.name,
    company: normalized.company,
    focus_area: normalized.focusArea,
    website_url: normalized.websiteUrl,
    contact_email: normalized.contactEmail,
    contact_phone: normalized.contactPhone,
    contact_raw: normalized.contactRaw,
    application_fingerprint: normalized.applicationFingerprint,
    status: normalized.status,
    locale: normalized.locale,
    source: normalized.source,
    source_host: normalized.sourceHost,
    metadata: normalized.metadata,
  };

  const { data, error } = await supabase
    .from(WIDGET_EARLY_ACCESS_APPLICATION_TABLE)
    .insert(payload)
    .select(EARLY_ACCESS_WAITLIST_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "already_received",
      };
    }

    const publicError = new Error("A jelentkezést most nem sikerült menteni. Próbáld újra pár perc múlva.");
    publicError.statusCode = 503;
    publicError.publicMessage = publicError.message;
    publicError.cause = error;
    throw publicError;
  }

  return mapWaitlistApplication(data);
}
