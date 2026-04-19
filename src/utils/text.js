export function cleanText(value) {
  return value ? value.replace(/\s+/g, " ").trim() : "";
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "test.local",
  "localhost",
  "invalid",
]);
const PLACEHOLDER_PHONE_DIGITS = new Set([
  "0000000",
  "00000000",
  "0000000000",
  "0123456789",
  "1111111111",
  "1234567",
  "12345678",
  "1234567890",
  "5555555555",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(cleanText(value));
}

export function slugifyLookupValue(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function tokenizeForMatching(value) {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "your",
    "would",
    "like",
    "need",
    "want",
    "about",
    "into",
    "what",
    "when",
    "where",
    "which",
    "mert",
    "vagy",
    "hogy",
    "ezt",
    "egy",
    "van",
    "lesz",
    "most",
    "nekem",
    "neked",
    "amit",
    "akkor",
    "kell",
    "lenne",
    "szeretnék",
    "szeretnek",
    "szia",
    "hello",
  ]);

  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9áéíóöőúüű]+/i)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

export function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (entry) =>
        entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        cleanText(entry.content)
    )
    .map((entry) => ({
      role: entry.role,
      content: cleanText(entry.content),
    }))
    .slice(-6);
}

export function formatConversationHistory(history) {
  if (!history.length) {
    return "No previous conversation.";
  }

  return history
    .map((entry) => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`)
    .join("\n");
}

export function buildEffectiveUserText(message, history) {
  const recentUserMessages = history
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content)
    .slice(-3);

  return [...recentUserMessages, cleanText(message)].join(" ").trim();
}

export function detectExplicitLanguageRequest(message) {
  const normalized = cleanText(message).toLowerCase();

  if (
    /\b(?:reply|answer|respond|speak|write)\s+(?:to me\s+)?in\s+hungarian\b/i.test(normalized) ||
    /\b(?:hungarian|magyar)\s+(?:please|pls)\b/i.test(normalized) ||
    /\bmagyarul\b/i.test(normalized)
  ) {
    return "Hungarian";
  }

  if (
    /\b(?:reply|answer|respond|speak|write)\s+(?:to me\s+)?in\s+english\b/i.test(normalized) ||
    /\benglish\s+(?:please|pls)\b/i.test(normalized) ||
    /\bangolul\b/i.test(normalized)
  ) {
    return "English";
  }

  return "";
}

export function detectMessageLanguage(message) {
  const normalized = cleanText(message).toLowerCase();

  if (!normalized) {
    return {
      language: "",
      confidence: "none",
    };
  }

  if (
    /[áéíóöőúüű]/i.test(normalized) ||
    /\b(szia|helló|helo|üdv|igen|nem|kell|szeretnék|szeretnek|segits|segíts|weboldal|honlap|webshopot|ar|ár|arak|árak|ajanlat|ajánlat|mennyi|mennyibe|kerul|kerül|kerulne|kerülne|reszletesebb|részletesebb|megoldas|megoldás|miben|tudsz|segiteni|segíteni|igazabol|igazából|jobban|hangzik)\b/i.test(
      normalized
    )
  ) {
    return {
      language: "Hungarian",
      confidence: "clear",
    };
  }

  if (
    /\b(yes|yeah|yep|please|thanks|thank|hello|hi|hey|need|want|would|like|website|webshop|shop|price|pricing|cost|quote|service|services|contact|email|phone|book|booking|appointment|help)\b/i.test(
      normalized
    )
  ) {
    return {
      language: "English",
      confidence: "clear",
    };
  }

  return {
    language: "",
    confidence: "ambiguous",
  };
}

export function selectResponseLanguage(message, history = []) {
  const explicitLanguage = detectExplicitLanguageRequest(message);

  if (explicitLanguage) {
    return explicitLanguage;
  }

  const latestLanguage = detectMessageLanguage(message);

  if (latestLanguage.confidence === "clear") {
    return latestLanguage.language;
  }

  const recentCustomerMessages = (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.role === "user")
    .map((entry) => cleanText(entry.content))
    .filter(Boolean)
    .reverse();

  for (const previousMessage of recentCustomerMessages) {
    const previousLanguage = detectMessageLanguage(previousMessage);

    if (previousLanguage.confidence === "clear") {
      return previousLanguage.language;
    }
  }

  return "English";
}

export function detectResponseLanguage(message) {
  return selectResponseLanguage(message);
}

export function isGreetingMessage(message) {
  return /^(szia|hello|hi|helló|hey|yo|üdv|jó napot)\W*$/i.test(
    message.trim()
  );
}

export function detectMessageTopics(message) {
  const normalized = message.toLowerCase();
  const topics = [];

  if (/(webshop|webáruház|shop|termék)/i.test(normalized)) {
    topics.push("webshop");
  }

  if (/(weboldal|honlap|website|site|landing)/i.test(normalized)) {
    topics.push("website");
  }

  if (/(ár|árak|mennyi|költség|budget|price|cost|quote|ajánlat)/i.test(normalized)) {
    topics.push("pricing");
  }

  if (/(konzult|kapcsolat|contact|book|foglal|egyeztet)/i.test(normalized)) {
    topics.push("consultation");
  }

  if (/(seo|keresőoptimaliz)/i.test(normalized)) {
    topics.push("seo");
  }

  if (/(karbant|support|támogat|maintenance)/i.test(normalized)) {
    topics.push("maintenance");
  }

  return topics;
}

export function containsQuestion(text) {
  return text.includes("?");
}

export function appearsHungarian(text) {
  return (
    /[áéíóöőúüű]/i.test(text) ||
    /\b(és|hogy|most|neked|inkább|melyik|szeretnél|mennyi|vagy|irányba)\b/i.test(
      text
    )
  );
}

export function normalizeAssistantReply(text) {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractEmails(value = "") {
  const matches = String(value || "").match(EMAIL_PATTERN) || [];
  return [...new Set(matches.map((match) => cleanText(match).toLowerCase()).filter(Boolean))];
}

export function extractPhoneCandidates(value = "") {
  const matches = String(value || "").match(PHONE_PATTERN) || [];
  return [...new Set(matches.map((match) => cleanText(match)).filter(Boolean))];
}

export function isPlaceholderEmail(value = "") {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return false;
  }

  const [, domain = ""] = normalized.split("@");

  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

export function isPlaceholderPhone(value = "") {
  const digits = cleanText(value).replace(/\D/g, "");

  if (!digits || digits.length < 7) {
    return false;
  }

  if (PLACEHOLDER_PHONE_DIGITS.has(digits)) {
    return true;
  }

  return /^(\d)\1+$/.test(digits);
}

export function containsPlaceholderContactDetails(value = "") {
  return extractEmails(value).some((email) => isPlaceholderEmail(email))
    || extractPhoneCandidates(value).some((phone) => isPlaceholderPhone(phone));
}
