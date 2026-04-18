import { cleanText } from "../../utils/text.js";

export function normalizeVisitorEmail(value) {
  const cleaned = cleanText(value).toLowerCase();
  const match = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = match ? match[0].toLowerCase() : "";

  if (!email) {
    return "";
  }

  const [localPart, domain] = email.split("@");
  const blockedLocalParts = new Set([
    "anonymous",
    "guest",
    "none",
    "no-reply",
    "noreply",
    "placeholder",
    "test",
    "unknown",
    "user",
    "you",
  ]);

  if (
    blockedLocalParts.has(localPart)
    || localPart.startsWith("your")
    || localPart.includes("placeholder")
    || localPart.includes("example")
    || domain === "example.invalid"
    || domain === "invalid.invalid"
  ) {
    return "";
  }

  return email;
}

export function normalizeVisitorIdentity(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const modeCandidate = cleanText(
    source.mode
      || source.visitorMode
      || source.visitor_mode
      || source.identityMode
      || source.identity_mode
  ).toLowerCase();
  const email = normalizeVisitorEmail(
    source.email
      || source.visitorEmail
      || source.visitor_email
  );
  const name = cleanText(
    source.name
      || source.visitorName
      || source.visitor_name
  );
  const mode = modeCandidate;

  if (mode === "guest") {
    return {
      mode: "guest",
      email: "",
      name: "",
    };
  }

  if (mode === "identified" && email) {
    return {
      mode: "identified",
      email,
      name,
    };
  }

  return {
    mode: "",
    email: "",
    name: "",
  };
}

export function buildPublicVisitorIdentity(input = {}) {
  const normalized = normalizeVisitorIdentity(input);

  if (!normalized.mode) {
    return null;
  }

  return normalized;
}
