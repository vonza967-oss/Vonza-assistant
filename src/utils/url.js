import { cleanText } from "./text.js";

export function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isSameDomain(url, rootUrl) {
  try {
    return new URL(url).hostname === new URL(rootUrl).hostname;
  } catch {
    return false;
  }
}

export function normalizePathname(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

export function getHostnameFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hasExplicitScheme(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function hasPublicHostname(hostname) {
  if (!hostname) {
    return false;
  }

  const normalizedHostname = hostname.toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".local") ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return false;
  }

  return normalizedHostname.includes(".");
}

export function normalizeWebsiteUrl(value, options = {}) {
  const {
    requireHttps = false,
    requirePublicHostname = false,
  } = options;
  const normalizedValue = cleanText(value);

  if (!normalizedValue) {
    return "";
  }

  const candidateUrl = hasExplicitScheme(normalizedValue)
    ? normalizedValue
    : `https://${normalizedValue}`;

  try {
    const parsed = new URL(candidateUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    if (requireHttps && parsed.protocol !== "https:") {
      return "";
    }

    if (requirePublicHostname && !hasPublicHostname(parsed.hostname)) {
      return "";
    }

    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }

    const normalizedPath = parsed.pathname.replace(/\/{2,}/g, "/");
    parsed.pathname = normalizedPath === "/" ? "" : normalizedPath.replace(/\/+$/, "");

    return parsed.toString();
  } catch {
    return "";
  }
}
