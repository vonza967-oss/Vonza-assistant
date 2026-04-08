import { cleanText } from "../../utils/text.js";

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value) {
  return cleanText(value);
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBareContactSignal(text = "", value = "", options = {}) {
  if (!options.allowBareContact || !value) {
    return false;
  }

  const escapedValue = escapeRegex(value);
  const barePattern = new RegExp(
    `^\\s*(?:hi|hello|hey)?[,!\\s]*(?:it'?s me[,!\\s]*)?(?:again here[,!\\s]*)?${escapedValue}(?:\\s+again here)?(?:[.!?\\s].*)?$`,
    "i"
  );

  return barePattern.test(String(text || ""));
}

function hasBusinessContactRequestSignal(text = "", type = "") {
  const normalized = cleanText(text).toLowerCase();

  if (!normalized) {
    return false;
  }

  if (type === "email") {
    return [
      /\bwhat(?:'s| is)?\s+(?:your|the)\s+e-?mail\b/i,
      /\byour\s+e-?mail\b/i,
      /\bcan i\s+e-?mail\b/i,
      /\bshould i\s+e-?mail\b/i,
      /\bis\s+(?:your|the)\s+e-?mail\b/i,
      /\bwhere\s+can\s+i\s+e-?mail\b/i,
      /\bhow\s+can\s+i\s+contact\b/i,
      /\bhow\s+can\s+i\s+reach\b/i,
    ].some((pattern) => pattern.test(normalized));
  }

  if (type === "phone") {
    return [
      /\bwhat(?:'s| is)?\s+(?:your|the)\s+(?:phone|number)\b/i,
      /\byour\s+(?:phone|number)\b/i,
      /\bcan i\s+(?:call|text|phone)\b/i,
      /\bshould i\s+(?:call|text|phone)\b/i,
      /\bis\s+(?:your|the)\s+(?:phone|number)\b/i,
      /\bwhere\s+can\s+i\s+(?:call|text)\b/i,
      /\bhow\s+can\s+i\s+contact\b/i,
      /\bhow\s+can\s+i\s+reach\b/i,
    ].some((pattern) => pattern.test(normalized));
  }

  return false;
}

function hasVisitorEmailSignal(text = "", email = "", options = {}) {
  if (!email) {
    return false;
  }

  if (hasBareContactSignal(text, email, options)) {
    return true;
  }

  const normalized = String(text || "");
  const escapedEmail = escapeRegex(email);
  const explicitPatterns = [
    new RegExp(`\\bmy\\s+e-?mail(?:\\s+address)?\\s+is\\s+${escapedEmail}\\b`, "i"),
    new RegExp(`\\b(?:email|e-?mail)\\s+me\\s+at\\s+${escapedEmail}\\b`, "i"),
    new RegExp(`\\b(?:reach|contact|write\\s+to|reply\\s+to)\\s+me\\s+at\\s+${escapedEmail}\\b`, "i"),
    new RegExp(`\\b(?:send|forward)(?:\\s+it|\\s+this|\\s+details|\\s+info|\\s+pricing|\\s+the\\s+quote|\\s+a\\s+quote)?\\s+to\\s+${escapedEmail}\\b`, "i"),
    new RegExp(`^\\s*(?:please\\s+)?(?:can\\s+you\\s+)?(?:email|e-?mail)\\s+${escapedEmail}\\b`, "i"),
    new RegExp(`^\\s*${escapedEmail}(?:\\s+again\\s+here)?\\b`, "i"),
    new RegExp(`\\b(?:az|a)\\s+e-?mail\\s+c[ií]mem\\s+${escapedEmail}\\b`, "i"),
  ];

  if (explicitPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (
    !hasBusinessContactRequestSignal(normalized, "email")
    && /\b(?:my name is|i am|i'm|this is)\b/i.test(normalized)
    && new RegExp(escapedEmail, "i").test(normalized)
  ) {
    return true;
  }

  return !hasBusinessContactRequestSignal(normalized, "email")
    && /\b(?:contact me|reach me|send me|write me|reply to me)\b/i.test(normalized)
    && new RegExp(escapedEmail, "i").test(normalized);
}

function hasVisitorPhoneSignal(text = "", phone = "", options = {}) {
  if (!phone) {
    return false;
  }

  if (hasBareContactSignal(text, phone, options)) {
    return true;
  }

  const normalized = String(text || "");
  const escapedPhone = escapeRegex(phone);
  const explicitPatterns = [
    new RegExp(`\\bmy\\s+(?:phone|number)\\s+is\\s+${escapedPhone}\\b`, "i"),
    new RegExp(`\\b(?:call|text|phone)\\s+me\\s+at\\s+${escapedPhone}\\b`, "i"),
    new RegExp(`\\b(?:reach|contact)\\s+me\\s+at\\s+${escapedPhone}\\b`, "i"),
    new RegExp(`^\\s*(?:please\\s+)?(?:can\\s+you\\s+)?(?:call|text)\\s+${escapedPhone}\\b`, "i"),
    new RegExp(`^\\s*${escapedPhone}(?:\\s+again\\s+here)?\\b`, "i"),
    new RegExp(`\\b(?:a|az)\\s+sz[aá]mom\\s+${escapedPhone}\\b`, "i"),
  ];

  if (explicitPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (
    !hasBusinessContactRequestSignal(normalized, "phone")
    && /\b(?:my name is|i am|i'm|this is)\b/i.test(normalized)
    && new RegExp(escapedPhone, "i").test(normalized)
  ) {
    return true;
  }

  return !hasBusinessContactRequestSignal(normalized, "phone")
    && /\b(?:contact me|reach me|call me|text me)\b/i.test(normalized)
    && new RegExp(escapedPhone, "i").test(normalized);
}

export function extractVisitorContactInfo(text = "", options = {}) {
  const normalized = String(text || "");
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = normalized.match(/(?:\+?\d[\d().\-\s]{6,}\d)/);
  const namePatterns = [
    /\b(?:my name is|i am|i'm|this is)\s+([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){0,2})\b/iu,
    /\b(?:a nevem|az en nevem|nevem)\s+([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){0,2})\b/iu,
  ];
  let name = "";

  for (const pattern of namePatterns) {
    const match = normalized.match(pattern);

    if (cleanText(match?.[1])) {
      name = cleanText(match[1]);
      break;
    }
  }

  const email = emailMatch ? normalizeEmail(emailMatch[0]) : "";
  const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : "";
  const phoneNormalized = phone ? normalizePhoneDigits(phone) : "";
  const emailAllowed = hasVisitorEmailSignal(normalized, email, options);
  const phoneAllowed = hasVisitorPhoneSignal(normalized, phone, options);

  return {
    name,
    email: emailAllowed ? email : "",
    phone: phoneAllowed ? phone : "",
    phoneNormalized: phoneAllowed ? phoneNormalized : "",
  };
}
