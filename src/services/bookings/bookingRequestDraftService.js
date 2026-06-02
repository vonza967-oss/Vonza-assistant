import { createHash } from "node:crypto";

import {
  cleanText,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
} from "../../utils/text.js";

const REQUEST_STATUSES_BY_INTENT = Object.freeze({
  booking_request: "request_received",
  availability_question: "needs_staff_review",
  cancel_request: "cancel_requested",
  reschedule_request: "reschedule_requested",
});

function normalizeForMatching(value = "") {
  return cleanText(value).toLowerCase();
}

function hasPromptInjectionRisk(text) {
  return /\b(ignore|override|bypass|forget)\b.{0,80}\b(instructions|rules|system|developer|policy|guardrails?)\b/i.test(text)
    || /\b(system prompt|developer message|jailbreak|prompt injection|act as|do anything now)\b/i.test(text);
}

function hasEmergencyRisk(text) {
  return /\b(emergency|urgent emergency|life[-\s]?threatening|call 911|ambulance|heart attack|stroke|bleeding|fire|smoke|gas leak|break[-\s]?in|violence|danger)\b/i.test(text);
}

function hasAdviceRisk(text) {
  return /\b(diagnos(?:e|is)|symptoms?|medical advice|legal advice|financial advice|investment advice|lawsuit|sue them|tax advice|prescription|dosage)\b/i.test(text);
}

function hasUnsupportedConfirmedClaim(text) {
  return /\b(already|just|previously)\b.{0,60}\b(booked|reserved|confirmed|scheduled)\b/i.test(text)
    || /\b(my|the)\b.{0,30}\b(booking|appointment|reservation)\b.{0,40}\b(is|was)\b.{0,20}\b(confirmed|booked|reserved|scheduled)\b/i.test(text);
}

function detectBookingIntentType(message = "") {
  const text = normalizeForMatching(message);

  if (!text) {
    return "";
  }

  if (hasPromptInjectionRisk(text) || hasEmergencyRisk(text) || hasAdviceRisk(text)) {
    return "";
  }

  const hasBookingObject = /\b(appointment|booking|reservation|visit|consultation|call|demo|slot|table|room|stay|service)\b/i.test(text);
  const asksCancel = /\b(cancel|call off|drop)\b/i.test(text) && hasBookingObject;
  const asksReschedule = /\b(reschedule|re-schedule|move|change|switch|push back|bring forward)\b/i.test(text) && hasBookingObject;

  if ((asksCancel || asksReschedule) && hasPromptInjectionRisk(text)) {
    return "";
  }

  if (asksCancel) {
    return "cancel_request";
  }

  if (asksReschedule) {
    return "reschedule_request";
  }

  if (hasUnsupportedConfirmedClaim(text)) {
    return "";
  }

  if (/\b(availability|available|openings?|open slots?|any slots?|free times?|times? available)\b/i.test(text)) {
    return "availability_question";
  }

  if (/\b(book|booking|schedule|reserve|reservation|appointment|consultation|demo|slot)\b/i.test(text)) {
    return "booking_request";
  }

  if (/\b(id[oő]pont|foglal|foglal[aá]s|szabad id[oő]|van.*szabad)\b/i.test(text)) {
    return "booking_request";
  }

  return "";
}

function extractRequestedTimeText(message = "") {
  const text = cleanText(message);
  const patterns = [
    /\b(?:tomorrow|today|tonight|this evening|this morning|this afternoon)(?:\s+(?:at|around|about|after|before)\s+[0-9:apm.\s]+)?\b/i,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at|around|about|after|before)\s+[0-9:apm.\s]+)?\b/i,
    /\b(?:next|this)\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(?:at|around|about|after|before)\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?\b/i,
    /\b[0-9]{1,2}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?(?:\s+(?:at|around|about)?\s*[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return cleanText(match[0]);
    }
  }

  return "";
}

function extractRequestedServiceText(message = "") {
  const text = cleanText(message);
  const patterns = [
    /\b(?:for|about)\s+([^?.!,]{3,80})/i,
    /\b(?:book|schedule|reserve)\s+(?:a|an|the)?\s*([^?.!,]{3,80})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanText(match?.[1] || "")
      .replace(/\b(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i, "")
      .replace(/\b(?:at|around|about|after|before)\s+[0-9].*$/i, "")
      .replace(/\bfor\s*$/i, "")
      .trim();

    if (candidate && !/^(appointment|booking|reservation|slot|time)$/i.test(candidate)) {
      return candidate;
    }
  }

  return "";
}

function extractCustomerName(message = "", visitorIdentity = {}) {
  const identityName = cleanText(visitorIdentity.name || visitorIdentity.visitorName || visitorIdentity.visitor_name);
  if (identityName) {
    return identityName;
  }

  const match = cleanText(message).match(/\b(?:my name is|i am|i'm|this is)\s+([^.,!?]{2,80})/i);
  return cleanText(match?.[1] || "")
    .replace(/\s+\b(?:and|,)?\s*(?:my\s+)?(?:email|e-mail|phone|telephone|number)\b.*$/i, "")
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

  return `chat-booking:${digest}`;
}

function hasMinimumReviewDetails({ intentType, requestedTimeText, requestedService, customerEmail, customerPhone }) {
  if (intentType === "cancel_request" || intentType === "reschedule_request") {
    return Boolean(customerEmail || customerPhone);
  }

  return Boolean(requestedTimeText && requestedService && (customerEmail || customerPhone));
}

export function isBookingRequestsFromChatEnabled(value = process.env.BOOKING_REQUESTS_FROM_CHAT_ENABLED) {
  return ["1", "true", "enabled", "on"].includes(String(value || "").trim().toLowerCase());
}

export function buildChatBookingRequestDraft({
  message,
  visitorIdentity = {},
  ownerUserId,
  agentId,
  businessId,
  sessionKey,
  displayMode,
  conversationSource,
  timezone = "",
} = {}) {
  const intentType = detectBookingIntentType(message);

  if (!intentType || !cleanText(ownerUserId) || !cleanText(agentId)) {
    return {
      matched: false,
      intentType: intentType || "",
      reason: intentType ? "missing_scope" : "no_supported_booking_intent",
    };
  }

  const requestedTimeText = extractRequestedTimeText(message);
  const requestedService = extractRequestedServiceText(message);
  const customerName = extractCustomerName(message, visitorIdentity);
  const customerEmail = extractCustomerEmail(message, visitorIdentity);
  const customerPhone = extractCustomerPhone(message, visitorIdentity);
  const baseStatus = REQUEST_STATUSES_BY_INTENT[intentType] || "request_received";
  const status = hasMinimumReviewDetails({
    intentType,
    requestedTimeText,
    requestedService,
    customerEmail,
    customerPhone,
  })
    ? baseStatus
    : intentType === "cancel_request" || intentType === "reschedule_request"
      ? baseStatus
      : "needs_info";

  return {
    matched: true,
    intentType,
    status,
    requestedService,
    requestedTimeText,
    customerName,
    customerEmail,
    customerPhone,
    idempotencyKey: buildIdempotencyKey({
      ownerUserId,
      agentId,
      sessionKey,
      message,
      intentType,
    }),
    createPayload: {
      ownerUserId: cleanText(ownerUserId),
      agentId: cleanText(agentId),
      businessId: cleanText(businessId) || undefined,
      visitorSessionKey: cleanText(sessionKey),
      sourceChannel: cleanText(conversationSource) || "public_chat",
      displayMode: cleanText(displayMode) || "widget",
      requestedService,
      requestedTimeText,
      timezone: cleanText(timezone),
      customerName,
      customerEmail,
      customerPhone,
      status,
      statusReason: "Public chat request for staff review only.",
      evidence: {
        proof_source_type: "request_only",
      },
      metadata: {
        source: "public_chat",
        intent_type: intentType,
      },
      idempotencyKey: buildIdempotencyKey({
        ownerUserId,
        agentId,
        sessionKey,
        message,
        intentType,
      }),
    },
  };
}
