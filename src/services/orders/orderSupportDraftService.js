import {
  cleanText,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
} from "../../utils/text.js";

const ORDER_LOOKUP_PATTERNS = [
  /\b(where\s+is\s+my\s+order|has\s+my\s+package\s+shipped|package\s+shipped|shipping\s+status|track(?:ing)?\s+(?:my\s+)?(?:order|package)|order\s+status|rendel[eé]s(?:em)?\s+(?:hol|állapota|statusza)|csomag(?:om)?\s+(?:hol|feladva|úton|uton))/i,
  /\b(?:order|package|shipment|rendel[eé]s|csomag)\b.{0,80}\b(?:status|track|tracking|ship|shipped|delivered|where|állapot|allapot|felad|száll[ií]t|szallit|kézbes[ií]t|kezbesit)\b/i,
];
const ORDER_CHANGE_PATTERNS = [
  /\b(change|update|correct|edit|cancel|add|remove|increase|decrease)\b.{0,120}\b(order|package|shipment|shipping address|delivery address|delivery note|item|quantity)\b/i,
  /\b(order|package|shipment|shipping address|delivery address|delivery note|item|quantity)\b.{0,120}\b(change|update|correct|edit|cancel|add|remove|increase|decrease)\b/i,
  /\b(?:m[oó]dos[ií]t|friss[ií]t|jav[ií]t|lemond|t[oö]r[oö]l|hozz[aá]ad|kivesz)\b.{0,120}\b(?:rendel[eé]s|csomag|sz[aá]ll[ií]tm[aá]ny|sz[aá]ll[ií]t[aá]si c[ií]m|megjegyz[eé]s|t[eé]tel|darab)\b/i,
];
const PROMPT_INJECTION_PATTERN = /\b(ignore|override|bypass|forget)\b.{0,80}\b(instructions|rules|system|developer|policy|guardrails?)\b|\b(system prompt|developer message|jailbreak|act as|do anything now)\b/i;

function normalizeForMatching(value = "") {
  return cleanText(value).toLowerCase();
}

function firstSupportedEmail(value = "") {
  return extractEmails(value)
    .map((email) => cleanText(email).toLowerCase())
    .find((email) => email && !isPlaceholderEmail(email) && !isInternalPlatformEmail(email)) || "";
}

function firstSupportedPhone(value = "") {
  return extractPhoneCandidates(value)
    .map((phone) => cleanText(phone))
    .find((phone) => phone && !isPlaceholderPhone(phone)) || "";
}

function extractOrderNumber(message = "") {
  const text = cleanText(message);
  const patterns = [
    /\b(?:order|order\s+number|order\s+no\.?|rendel[eé]s|rendel[eé]ssz[aá]m)\s*(?:is|:|#|sz[aá]ma)?\s*#?([A-Z0-9][A-Z0-9-]{2,39})\b/i,
    /\b#([A-Z0-9][A-Z0-9-]{2,39})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanText(match?.[1] || "")
      .replace(/[.,!?;:]+$/g, "")
      .toUpperCase();

    if (candidate && !/^(ORDER|NUMBER|STATUS|PACKAGE|RENDEL|RENDELÉS)$/i.test(candidate)) {
      return candidate;
    }
  }

  return "";
}

function extractEmailOrPhone(message = "", visitorIdentity = {}) {
  const identityEmail = firstSupportedEmail(visitorIdentity.email || visitorIdentity.visitorEmail || visitorIdentity.visitor_email || "");
  const identityPhone = firstSupportedPhone(visitorIdentity.phone || visitorIdentity.visitorPhone || visitorIdentity.visitor_phone || "");

  return identityEmail || identityPhone || firstSupportedEmail(message) || firstSupportedPhone(message);
}

function detectActionType(message = "") {
  const text = normalizeForMatching(message);

  if (/\b(cancel|call off|void)\b.{0,80}\border\b|\blemond\b.{0,80}\brendel/i.test(text)) {
    return "cancellation";
  }

  if (/\b(delivery\s+note|delivery\s+instructions?|note for delivery|fut[aá]r megjegyz[eé]s|sz[aá]ll[ií]t[aá]si megjegyz[eé]s)\b/i.test(text)) {
    return "delivery_note";
  }

  if (/\b(add|remove|quantity|item|product|something to my order|take .* out)\b|\b(t[eé]tel|darab|hozz[aá]ad|kivesz|term[eé]k)\b/i.test(text)) {
    return "item_change";
  }

  if (/\b(shipping\s+address|delivery\s+address|address|ship to|c[ií]m|sz[aá]ll[ií]t[aá]si c[ií]m)\b/i.test(text)) {
    return "shipping_address";
  }

  if (/\b(phone|email|e-mail|contact info|contact information|telephone|telefonsz[aá]m|email|kapcsolati adat)\b/i.test(text)) {
    return "contact_info";
  }

  return "";
}

function isOrderChangeIntentText(text = "") {
  return ORDER_CHANGE_PATTERNS.some((pattern) => pattern.test(text));
}

function extractRequestedChange(message = "", actionType = "") {
  const text = cleanText(message);

  return {
    actionType,
    rawRequest: text.slice(0, 1000),
  };
}

export function isOrderSupportIntent(message = "", history = []) {
  const text = normalizeForMatching(
    [history.map((entry) => entry?.content).join(" "), message].filter(Boolean).join(" ")
  );

  if (!text || PROMPT_INJECTION_PATTERN.test(text)) {
    return false;
  }

  return isOrderChangeIntentText(text)
    || ORDER_LOOKUP_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildChatOrderSupportDraft({
  message,
  history = [],
  visitorIdentity = {},
} = {}) {
  const text = cleanText(message);
  const combined = [history.map((entry) => entry?.content).join(" "), text].filter(Boolean).join(" ");

  if (!isOrderSupportIntent(text, history)) {
    return {
      matched: false,
      intentType: "",
      reason: PROMPT_INJECTION_PATTERN.test(combined) ? "unsafe_prompt" : "no_order_support_intent",
    };
  }

  const actionType = isOrderChangeIntentText(normalizeForMatching(combined))
    ? detectActionType(combined)
    : "";
  const intentType = actionType ? "change_request" : "lookup";
  const orderNumber = extractOrderNumber(combined);
  const emailOrPhone = extractEmailOrPhone(combined, visitorIdentity);

  return {
    matched: true,
    intentType,
    actionType,
    orderNumber,
    emailOrPhone,
    requestedChange: actionType ? extractRequestedChange(text, actionType) : {},
    sourceMessage: text,
  };
}
