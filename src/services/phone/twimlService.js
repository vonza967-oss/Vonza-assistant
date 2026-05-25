import { cleanText } from "../../utils/text.js";

const DEFAULT_DISCLOSURE =
  "This call may be recorded or logged so the business can follow up on your request.";
const DEFAULT_GREETING = "Thanks for calling.";
const PHONE_NOT_LIVE_MESSAGE =
  "The phone front desk is not fully live yet. Please call back later or use the website to leave your contact details.";
const UNAVAILABLE_MESSAGE =
  "This phone front desk is not available right now. Please try again later.";

function escapeXml(value = "") {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSay(text) {
  const safeText = escapeXml(text);
  return safeText ? `<Say>${safeText}</Say>` : "";
}

export function buildPhoneGreetingTwiML(options = {}) {
  const disclosure = cleanText(options.disclosureText) || DEFAULT_DISCLOSURE;
  const greeting = cleanText(options.greetingText) || DEFAULT_GREETING;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    buildSay(disclosure),
    buildSay(greeting),
    '<Pause length="1"/>',
    buildSay(PHONE_NOT_LIVE_MESSAGE),
    "<Hangup/>",
    "</Response>",
  ].filter(Boolean).join("");
}

export function buildPhoneBlockedTwiML(message = UNAVAILABLE_MESSAGE) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    buildSay(message || UNAVAILABLE_MESSAGE),
    "<Hangup/>",
    "</Response>",
  ].join("");
}

export function buildEmptyTwiML() {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

export const PHONE_TWIML_MESSAGES = Object.freeze({
  defaultDisclosure: DEFAULT_DISCLOSURE,
  defaultGreeting: DEFAULT_GREETING,
  notLive: PHONE_NOT_LIVE_MESSAGE,
  unavailable: UNAVAILABLE_MESSAGE,
});
