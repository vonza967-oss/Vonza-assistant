export function cleanText(value) {
  return value ? value.replace(/\s+/g, " ").trim() : "";
}

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

export function detectResponseLanguage(message) {
  const normalized = message.toLowerCase();

  if (
    /[áéíóöőúüű]/i.test(normalized) ||
    /\b(szia|helló|helo|üdv|kell|szeretnék|szeretnek|segits|segíts|weboldal|honlap|webshop|ar|ár|ajanlat|ajánlat|mennyi|mennyibe|kerul|kerül|kerulne|kerülne|reszletesebb|részletesebb|megoldas|megoldás|miben|tudsz|segiteni|segíteni|igazabol|igazából|jobban|hangzik)\b/i.test(
      normalized
    )
  ) {
    return "Hungarian";
  }

  return "English";
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
