import { cleanText } from "../../utils/text.js";

const NUMBER_WORDS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
});

const TIME_PATTERNS = Object.freeze([
  { pattern: /\basap\b|\bas soon as possible\b|\bright away\b|\bnow\b/i, value: "as soon as possible" },
  { pattern: /\btonight\b/i, value: "tonight" },
  { pattern: /\bthis morning\b|\bmorning\b/i, value: "morning" },
  { pattern: /\bthis afternoon\b|\bafternoon\b/i, value: "afternoon" },
  { pattern: /\bthis evening\b|\bevening\b/i, value: "evening" },
  { pattern: /\bnoon\b/i, value: "noon" },
]);

function cleanDraftText(value) {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function normalizeLower(value) {
  return cleanDraftText(value).toLowerCase();
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry) => entry && typeof entry.content === "string")
    .map((entry) => cleanDraftText(entry.content))
    .filter(Boolean)
    .slice(-4);
}

function firstCleanObjectValue(source, keys) {
  if (!isPlainObject(source)) {
    return "";
  }

  for (const key of keys) {
    const value = cleanDraftText(source[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function extractRoomLabel(text) {
  const match = cleanDraftText(text).match(/\b(?:room|suite)\s*([a-z0-9-]{1,12})\b/i);
  return match ? match[1].toUpperCase() : "";
}

function buildGuestContext({ guestContext, language, message, history }) {
  const historyText = normalizeHistory(history).join(" ");
  const roomLabel =
    firstCleanObjectValue(guestContext, ["roomLabel", "roomNumber", "room", "suite"])
    || extractRoomLabel(message)
    || extractRoomLabel(historyText);
  const guestName = firstCleanObjectValue(guestContext, ["guestName", "name"]);
  const resolvedLanguage =
    cleanDraftText(language)
    || firstCleanObjectValue(guestContext, ["language", "locale"]);
  const output = {};

  if (roomLabel) {
    output.roomLabel = roomLabel;
  }

  if (guestName) {
    output.guestName = guestName;
  }

  if (resolvedLanguage) {
    output.language = resolvedLanguage;
  }

  return output;
}

function deliveryLocationFromContext(guestContext) {
  if (!guestContext.roomLabel) {
    return "";
  }

  return /^room\b/i.test(guestContext.roomLabel)
    ? guestContext.roomLabel
    : `Room ${guestContext.roomLabel}`;
}

function parseQuantity(message) {
  const normalized = normalizeLower(message);

  for (const match of normalized.matchAll(/\b(\d{1,2})\b/g)) {
    const prefix = normalized.slice(Math.max(0, match.index - 12), match.index);

    if (!/\b(room|suite)\s*$/i.test(prefix)) {
      return Number(match[1]);
    }
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(normalized)) {
      return value;
    }
  }

  return null;
}

function parsePreferredTime(message) {
  const source = cleanDraftText(message);
  const clockMatch = source.match(/\b(?:at|around|by|before|after)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);

  if (clockMatch) {
    return cleanDraftText(clockMatch[0]);
  }

  for (const { pattern, value } of TIME_PATTERNS) {
    if (pattern.test(source)) {
      return value;
    }
  }

  return "";
}

function parseCheckoutTime(message) {
  const source = cleanDraftText(message);
  const checkoutMatch = source.match(/\b(?:until|to|at|by|around)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);

  if (checkoutMatch) {
    return cleanDraftText(checkoutMatch[1]);
  }

  if (/\bnoon\b/i.test(source)) {
    return "noon";
  }

  return parsePreferredTime(source);
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => {
      if (nestedValue === null || nestedValue === undefined) {
        return false;
      }

      if (typeof nestedValue === "string") {
        return Boolean(cleanDraftText(nestedValue));
      }

      if (Array.isArray(nestedValue)) {
        return nestedValue.length > 0;
      }

      return true;
    })
  );
}

function issueTypeForMessage(message) {
  const normalized = normalizeLower(message);

  if (/\b(leak|drip|sink|toilet|shower|drain|plumbing|water pressure)\b/i.test(normalized)) {
    return "plumbing";
  }

  if (/\b(ac|a\/c|air conditioner|air conditioning|heat|heater|thermostat|too hot|too cold)\b/i.test(normalized)) {
    return "temperature control";
  }

  if (/\b(light|lamp|outlet|power|electric|electrical|tv|television|wifi|wi-fi)\b/i.test(normalized)) {
    return "electrical or equipment";
  }

  if (/\b(door|lock|key|safe|window)\b/i.test(normalized)) {
    return "door or lock";
  }

  return "maintenance";
}

function locationForMessage(message, guestContext) {
  const normalized = normalizeLower(message);
  const roomLocation = deliveryLocationFromContext(guestContext);

  if (/\bbathroom\b/i.test(normalized)) {
    return roomLocation ? `${roomLocation} bathroom` : "bathroom";
  }

  if (/\bshower\b/i.test(normalized)) {
    return roomLocation ? `${roomLocation} shower` : "shower";
  }

  if (/\bsink\b/i.test(normalized)) {
    return roomLocation ? `${roomLocation} sink` : "sink";
  }

  if (/\btoilet\b/i.test(normalized)) {
    return roomLocation ? `${roomLocation} toilet` : "toilet";
  }

  return roomLocation;
}

function containsAny(message, patterns) {
  return patterns.some((pattern) => pattern.test(message));
}

function matchAction(message) {
  const normalized = normalizeLower(message);

  if (!normalized) {
    return { matched: false, actionKey: "", confidence: "none" };
  }

  if (
    containsAny(normalized, [
      /\blate\s+check[- ]?out\b/i,
      /\bextend(?:ed)?\s+(?:my\s+)?check[- ]?out\b/i,
      /\bcheck\s*out\s+late\b/i,
      /\bcheckout\s+extension\b/i,
    ])
  ) {
    return { matched: true, actionKey: "hotel.late_checkout_request", confidence: "high" };
  }

  if (
    containsAny(normalized, [
      /\b(leak|drip|broken|not working|doesn'?t work|fix|repair|maintenance)\b/i,
      /\b(ac|a\/c|air conditioner|air conditioning|heater|thermostat|toilet|sink|shower|lock|safe)\b/i,
    ])
  ) {
    return { matched: true, actionKey: "hotel.maintenance_issue", confidence: "high" };
  }

  if (containsAny(normalized, [/\btowels?\b/i, /\blinens?\b/i, /\bsheets?\b/i, /\bblankets?\b/i])) {
    return { matched: true, actionKey: "hotel.extra_towels", confidence: "high" };
  }

  if (containsAny(normalized, [/\bhousekeeping\b/i, /\bclean(?:ing)?\b/i, /\bmake up (?:my|the) room\b/i])) {
    return { matched: true, actionKey: "hotel.housekeeping_request", confidence: "high" };
  }

  if (containsAny(normalized, [/\broom service\b/i, /\bfood\b/i, /\bdinner\b/i, /\blunch\b/i])) {
    return { matched: true, actionKey: "hotel.room_service_request", confidence: "medium" };
  }

  if (
    containsAny(normalized, [
      /\bbottled\s+water\b/i,
      /\bsparkling\s+water\b/i,
      /\bstill\s+water\b/i,
      /\bdrinking\s+water\b/i,
      /\b(?:bring|send|get|need|want|like)\b.*\bwater\b/i,
      /\bwater\b.*\b(?:room|please)\b/i,
    ])
  ) {
    return { matched: true, actionKey: "hotel.bring_water", confidence: "high" };
  }

  if (containsAny(normalized, [/\bstaff\b/i, /\bconcierge\b/i, /\bfront desk\b/i, /\bhelp\b/i])) {
    return { matched: true, actionKey: "hotel.staff_help", confidence: "low" };
  }

  return { matched: false, actionKey: "", confidence: "none" };
}

function buildPayload(actionKey, message, guestContext, rawGuestContext) {
  const quantity = parseQuantity(message);
  const preferredTime = parsePreferredTime(message);
  const deliveryLocation = deliveryLocationFromContext(guestContext);

  if (actionKey === "hotel.bring_water") {
    return compactObject({
      quantity,
      deliveryLocation,
      preferredTime,
      notes: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.extra_towels") {
    return compactObject({
      item: /\b(blanket|blankets)\b/i.test(message) ? "blankets" : "towels",
      quantity,
      deliveryLocation,
      notes: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.maintenance_issue") {
    return compactObject({
      issueType: issueTypeForMessage(message),
      location: locationForMessage(message, guestContext),
      urgency: /\b(urgent|asap|now|flood|no power|locked out)\b/i.test(message) ? "urgent" : "normal",
      description: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.late_checkout_request") {
    return compactObject({
      requestedCheckoutTime: parseCheckoutTime(message),
      reservationReference: firstCleanObjectValue(rawGuestContext, ["reservationReference", "bookingReference"]),
      notes: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.housekeeping_request") {
    return compactObject({
      serviceType: /\b(clean|cleaning|make up)\b/i.test(message) ? "room cleaning" : "housekeeping",
      preferredTime,
      doNotDisturb: /\bdo not disturb\b|\bdnd\b/i.test(message),
      notes: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.room_service_request") {
    return compactObject({
      items: [cleanDraftText(message)],
      quantity,
      preferredTime,
      notes: cleanDraftText(message),
    });
  }

  if (actionKey === "hotel.staff_help") {
    return compactObject({
      topic: "guest assistance",
      urgency: /\b(urgent|asap|now|emergency)\b/i.test(message) ? "urgent" : "normal",
      notes: cleanDraftText(message),
    });
  }

  return {};
}

function acknowledgementForAction(actionKey) {
  if (actionKey === "hotel.bring_water") {
    return "I can draft a staff request to bring water to your room.";
  }

  if (actionKey === "hotel.extra_towels") {
    return "I can draft a staff request for extra towels or linens.";
  }

  if (actionKey === "hotel.maintenance_issue") {
    return "I can draft a maintenance request for hotel staff to review.";
  }

  if (actionKey === "hotel.late_checkout_request") {
    return "I can draft a late checkout request for staff review; this does not confirm approval.";
  }

  if (actionKey === "hotel.housekeeping_request") {
    return "I can draft a housekeeping request for hotel staff.";
  }

  if (actionKey === "hotel.room_service_request") {
    return "I can draft a room service request for hotel staff to review.";
  }

  if (actionKey === "hotel.staff_help") {
    return "I can draft a general staff assistance request.";
  }

  return "";
}

function safetyNotesForMessage(message, actionKey) {
  const notes = [];

  if (/\b(fire|smoke|medical|ambulance|police|gas leak|gas smell|injured|unconscious|chest pain|bleeding)\b/i.test(message)) {
    notes.push("Emergency or urgent safety language detected; do not create a normal staff request.");
  }

  if (
    /\b(cancel|change|modify|move|extend|shorten)\b.*\b(booking|reservation|stay|guest record|guest profile)\b/i.test(message)
    || /\b(booking|reservation|guest record|guest profile)\b.*\b(cancel|change|modify|move|extend|shorten)\b/i.test(message)
  ) {
    notes.push("Booking, reservation, or guest-record mutation requires staff-only/PMS handling.");
  }

  if (/\b(payment|pay|paid|refund|charge|card|credit card|rate|price|discount|invoice|receipt)\b/i.test(message)) {
    notes.push("Payment, rate, or billing changes require staff-only handling.");
  }

  if (actionKey === "hotel.late_checkout_request") {
    notes.push("Draft only; late checkout must be confirmed by hotel staff.");
  }

  return notes;
}

export function buildHotelConciergeActionDraft(input = {}) {
  const message = cleanDraftText(input.message);
  const guestContext = buildGuestContext({
    guestContext: input.guestContext,
    language: input.language,
    message,
    history: input.history,
  });
  const match = matchAction(message);
  const payload = match.matched
    ? buildPayload(match.actionKey, message, guestContext, input.guestContext)
    : {};

  return {
    matched: match.matched,
    actionKey: match.actionKey,
    confidence: match.confidence,
    guestContext,
    payload,
    sourceMessage: message,
    assistantAcknowledgement: match.matched ? acknowledgementForAction(match.actionKey) : "",
    safetyNotes: match.matched ? safetyNotesForMessage(message, match.actionKey) : [],
  };
}
