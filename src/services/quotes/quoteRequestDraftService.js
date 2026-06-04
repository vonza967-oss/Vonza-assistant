import { createHash } from "node:crypto";

import {
  cleanText,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
  selectResponseLanguage,
} from "../../utils/text.js";

const REQUEST_STATUSES_BY_INTENT = Object.freeze({
  quote_intent: "request_received",
  pricing_question: "needs_info",
  quote_mutation_request: "cancel_requested",
});

const HU_TOKEN_BOUNDARY = "(?:^|[^a-z0-9áéíóöőúüű])";
const HU_TOKEN_END = "(?=$|[^a-z0-9áéíóöőúüű])";
const HU_QUOTE_TERM = "(?:[aá]raj[aá]nlat(?:ot|ot kérni|ot szeretnék|ra|r[oó]l)?|aj[aá]nlat(?:ot|ra|r[oó]l)?|becsl[eé]s(?:t|re)?|kalkul[aá]ci[oó]|[aá]rkalkul[aá]ci[oó])";
const HU_PRICE_TERM = "(?:mennyibe|mennyi lesz|mennyi lenne|ker[uü]l|ker[uü]lne|[aá]r(?:at|ak|a)?|k[oö]lts[eé]g|d[ií]j|pontos [aá]r(?:at)?)";
const HU_SITE_VISIT_TERM = "(?:felm[eé]rni|felm[eé]r[eé]s(?:re)?|helysz[ií]ni|kij[oö]nni|megn[eé]zni)";
const HU_QUOTE_TERM_PATTERN = new RegExp(`${HU_TOKEN_BOUNDARY}${HU_QUOTE_TERM}${HU_TOKEN_END}`, "i");
const HU_PRICE_TERM_PATTERN = new RegExp(`${HU_TOKEN_BOUNDARY}${HU_PRICE_TERM}${HU_TOKEN_END}`, "i");
const HU_SITE_VISIT_PATTERN = new RegExp(`${HU_TOKEN_BOUNDARY}${HU_SITE_VISIT_TERM}${HU_TOKEN_END}`, "i");
const HU_QUOTE_MUTATION_PATTERN = new RegExp(`${HU_QUOTE_TERM}.{0,60}(?:lemond|m[oó]dos[ií]t|elfogad)|(?:lemond|m[oó]dos[ií]t|elfogad).{0,60}${HU_QUOTE_TERM}`, "i");

function normalizeForMatching(value = "") {
  return cleanText(value).toLowerCase();
}

function hasPromptInjectionRisk(text) {
  return /\b(ignore|override|bypass|forget)\b.{0,80}\b(instructions|rules|system|developer|policy|guardrails?)\b/i.test(text)
    || /\b(system prompt|developer message|jailbreak|prompt injection|act as|do anything now)\b/i.test(text)
    || /\b(hagyd figyelmen k[ií]v[uü]l|fel[uü]l[ií]r|rendszerutas[ií]t[aá]s|kor[aá]bbi utas[ií]t[aá]s|tal[aá]lj ki|hazudj)\b/i.test(text);
}

function hasEmergencyRisk(text) {
  return /\b(emergency|life[-\s]?threatening|call 911|ambulance|heart attack|stroke|bleeding|fire|smoke|gas leak|break[-\s]?in|violence|danger)\b/i.test(text)
    || /\b(s[uü]rg[oő]s cs[oő]t[oö]r[eé]s|cs[oő]t[oö]r[eé]s|g[aá]zsziv[aá]rg[aá]s|t[uű]z|f[uü]st|[eé]letvesz[eé]ly|ment[oő]|rend[oő]rs[eé]g)\b/i.test(text);
}

function hasAdviceRisk(text) {
  return /\b(diagnos(?:e|is)|symptoms?|medical advice|legal advice|financial advice|investment advice|lawsuit|sue them|tax advice|prescription|dosage)\b/i.test(text)
    || /\b(orvosi|jogi|p[eé]nz[uü]gyi|befektet[eé]si|ad[oó]tan[aá]cs|diagn[oó]zis|gy[oó]gyszer|perel)\b/i.test(text);
}

function hasUnsupportedFinalQuoteClaim(text) {
  return /\b(already|just|previously)\b.{0,60}\b(sent|accepted|approved|confirmed)\b.{0,40}\b(quote|proposal|estimate)\b/i.test(text)
    || /\b(my|the)\b.{0,30}\b(quote|proposal|estimate)\b.{0,40}\b(is|was)\b.{0,20}\b(sent|accepted|approved|confirmed|final)\b/i.test(text)
    || /\b(elfogadtam|elfogadott|elk[uü]ld[té]k|v[eé]gleges|j[oó]v[aá]hagyott)\b.{0,50}\b([aá]raj[aá]nlat|aj[aá]nlat|[aá]r)\b/i.test(text);
}

function detectQuoteIntentType(message = "") {
  const text = normalizeForMatching(message);

  if (!text) {
    return "";
  }

  if (
    hasPromptInjectionRisk(text)
    || hasEmergencyRisk(text)
    || hasAdviceRisk(text)
    || hasUnsupportedFinalQuoteClaim(text)
  ) {
    return "";
  }

  if (/\b(cancel|withdraw|change|accept|approve)\b.{0,60}\b(quote|proposal|estimate)\b/i.test(text)
    || HU_QUOTE_MUTATION_PATTERN.test(text)) {
    return "quote_mutation_request";
  }

  if (/\b(quote|proposal|estimate|bid|price quote|request a quote|get a quote)\b/i.test(text)
    || HU_QUOTE_TERM_PATTERN.test(text)) {
    return "quote_intent";
  }

  if (/\b(price|pricing|cost|fee|rate|how much|what would it cost|exact price)\b/i.test(text)
    || HU_PRICE_TERM_PATTERN.test(text)) {
    return "pricing_question";
  }

  if (/\b(site visit|survey|assessment|come out|inspect)\b/i.test(text)
    || HU_SITE_VISIT_PATTERN.test(text)) {
    return "quote_intent";
  }

  return "";
}

function extractFirstMatch(message = "", patterns = []) {
  const text = cleanText(message);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanText(match?.[1] || match?.[0] || "");

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function cleanupServiceCandidate(value = "") {
  return cleanText(value)
    .replace(/\b(?:in|at|near|around|for|about|with|and|my|name|email|phone)\b.*$/i, "")
    .replace(/\b(?:budapesten|budapest|holnap|ma|s[uü]rg[oő]s|most|pontos)\b.*$/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
}

function extractRequestedService(message = "") {
  const candidate = extractFirstMatch(message, [
    /\b(?:quote|proposal|estimate|bid)\s+(?:for|about|on)\s+([^?.!,]{3,90})/i,
    /\b(?:request|get|need|want)\s+(?:a|an)?\s*(?:quote|proposal|estimate)\s+(?:for|about|on)\s+([^?.!,]{3,90})/i,
    /\b(?:how much|what would it cost|price)\s+(?:for|to|is)?\s*([^?.!,]{3,90})/i,
    /(?:^|[^a-z0-9áéíóöőúüű])(?:[aá]raj[aá]nlatot|aj[aá]nlatot|becsl[eé]st)\s+([^?.!,]{3,90})/i,
    /(?:^|[^a-z0-9áéíóöőúüű])(?:[aá]raj[aá]nlat|aj[aá]nlat)\s+(?:kell|k[eé]rek|szeretn[eé]k)?\s*([^?.!,]{3,90})/i,
    /(?:^|[^a-z0-9áéíóöőúüű])(?:mennyibe ker[uü]l|mennyi lenne|mennyi lesz)\s+(?:egy|a|az)?\s*([^?.!,]{3,90})/i,
    /(?:^|[^a-z0-9áéíóöőúüű])(?:felm[eé]rni|felm[eé]r[eé]sre|kij[oö]nni|megn[eé]zni)\s+([^?.!,]{3,90})/i,
  ]);

  return cleanupServiceCandidate(candidate);
}

function extractProjectDetails(message = "") {
  return cleanText(message).slice(0, 1000) || "";
}

function extractLocationText(message = "") {
  const text = cleanText(message);
  const candidate = extractFirstMatch(text, [
    /\b(?:in|near|around|at)\s+([A-Z][A-Za-zÀ-ž\s.-]{2,60})/i,
    /\b(?:helysz[ií]n|telep[uü]l[eé]s|v[aá]ros)\s*[:-]?\s*([^?.!,]{2,80})/i,
    /\b([A-ZÁÉÍÓÖŐÚÜŰ][A-Za-zÀ-ž.-]{2,40})(?:en|on|ban|ben)\b/,
  ]);

  return candidate.replace(/\b(?:for|about|with|and)\b.*$/i, "").trim();
}

function extractUrgency(message = "") {
  const text = cleanText(message);

  return extractFirstMatch(text, [
    /\b(today|tomorrow|tonight|this week|next week|urgent|as soon as possible|asap)\b/i,
    /\b(ma|holnap|ma este|ezen a h[eé]ten|j[oö]v[oő] h[eé]ten|s[uü]rg[oő]s|min[eé]l hamarabb)\b/i,
  ]);
}

function extractBudgetText(message = "") {
  return extractFirstMatch(message, [
    /\b(?:budget|budget is|my budget is|up to)\s*[:-]?\s*([^?.!,]{2,60})/i,
    /\b(?:keret|b[uü]dzs[eé]|maximum|max)\s*[:-]?\s*([^?.!,]{2,60})/i,
    /([$€£]\s?\d+(?:[.,]\d{2})?(?:\s?[-–]\s?[$€£]?\s?\d+(?:[.,]\d{2})?)?)/i,
    /\b(\d+(?:[.,]\d{3})*\s?(?:huf|ft|eur|euro|usd|dollars?|forint))\b/i,
  ]);
}

function extractCustomerName(message = "", visitorIdentity = {}) {
  const identityName = cleanText(visitorIdentity.name || visitorIdentity.visitorName || visitorIdentity.visitor_name);
  if (identityName) {
    return identityName;
  }

  const match = cleanText(message).match(/\b(?:my name is|i am|i'm|this is|a nevem|nevem)\s+([^.,!?]{2,80})/i);
  return cleanText(match?.[1] || "")
    .replace(/\s+\b(?:and|,)?\s*(?:my\s+)?(?:email|e-mail|phone|telephone|number|e-mail(?:em)?|telefonsz[aá]m|sz[aá]mom)\b.*$/i, "")
    .trim();
}

function extractCustomerEmail(message = "", visitorIdentity = {}) {
  const identityEmail = cleanText(visitorIdentity.email || visitorIdentity.visitorEmail || visitorIdentity.visitor_email).toLowerCase();
  const candidates = [
    identityEmail,
    ...extractEmails(message).map((email) => cleanText(email).toLowerCase()),
  ];

  return candidates.find((email) =>
    email && !isPlaceholderEmail(email) && !isInternalPlatformEmail(email)
  ) || "";
}

function extractCustomerPhone(message = "", visitorIdentity = {}) {
  const identityPhone = cleanText(visitorIdentity.phone || visitorIdentity.visitorPhone || visitorIdentity.visitor_phone);
  const candidates = [
    identityPhone,
    ...extractPhoneCandidates(message),
  ];

  return candidates.find((phone) => phone && !isPlaceholderPhone(phone)) || "";
}

function buildIdempotencyKey({
  ownerUserId,
  agentId,
  sessionKey,
  message,
  intentType,
}) {
  const basis = [
    cleanText(ownerUserId),
    cleanText(agentId),
    cleanText(sessionKey) || "no-session",
    cleanText(intentType),
    normalizeForMatching(message),
  ].join(":");
  const digest = createHash("sha256").update(basis).digest("hex").slice(0, 32);

  return `chat-quote:${digest}`;
}

function hasMinimumReviewDetails({
  intentType,
  requestedService,
  projectDetails,
  customerEmail,
  customerPhone,
}) {
  if (intentType === "quote_mutation_request") {
    return Boolean(customerEmail || customerPhone);
  }

  return Boolean((requestedService || projectDetails) && (customerEmail || customerPhone));
}

export function isQuoteRequestsFromChatEnabled(value = process.env.QUOTE_REQUESTS_FROM_CHAT_ENABLED) {
  return ["1", "true", "enabled", "on"].includes(String(value || "").trim().toLowerCase());
}

export function buildChatQuoteRequestDraft({
  message,
  visitorIdentity = {},
  ownerUserId,
  agentId,
  businessId,
  sessionKey,
  displayMode,
  conversationSource,
} = {}) {
  const intentType = detectQuoteIntentType(message);
  const language = selectResponseLanguage(message);

  if (!intentType || !cleanText(ownerUserId) || !cleanText(agentId)) {
    return {
      matched: false,
      intentType: intentType || "",
      reason: intentType ? "missing_scope" : "no_supported_quote_intent",
      language,
    };
  }

  const requestedService = extractRequestedService(message);
  const projectDetails = extractProjectDetails(message);
  const locationText = extractLocationText(message);
  const urgency = extractUrgency(message);
  const budgetText = extractBudgetText(message);
  const customerName = extractCustomerName(message, visitorIdentity);
  const customerEmail = extractCustomerEmail(message, visitorIdentity);
  const customerPhone = extractCustomerPhone(message, visitorIdentity);
  const baseStatus = REQUEST_STATUSES_BY_INTENT[intentType] || "request_received";
  const status = hasMinimumReviewDetails({
    intentType,
    requestedService,
    projectDetails,
    customerEmail,
    customerPhone,
  })
    ? baseStatus
    : "needs_info";
  const idempotencyKey = buildIdempotencyKey({
    ownerUserId,
    agentId,
    sessionKey,
    message,
    intentType,
  });

  return {
    matched: true,
    intentType,
    language,
    status,
    requestedService,
    projectDetails,
    locationText,
    urgency,
    budgetText,
    customerName,
    customerEmail,
    customerPhone,
    idempotencyKey,
    createPayload: {
      ownerUserId: cleanText(ownerUserId),
      agentId: cleanText(agentId),
      businessId: cleanText(businessId) || undefined,
      visitorSessionKey: cleanText(sessionKey),
      sourceChannel: cleanText(conversationSource) || "public_chat",
      displayMode: cleanText(displayMode) || "widget",
      requestedService,
      projectDetails,
      locationText,
      urgency,
      budgetText,
      customerName,
      customerEmail,
      customerPhone,
      language,
      status,
      statusReason: "Public chat quote request for staff review only.",
      evidence: {
        proof_source_type: "request_only",
      },
      metadata: {
        source: "public_chat",
        intent_type: intentType,
        language,
      },
      idempotencyKey,
    },
  };
}
