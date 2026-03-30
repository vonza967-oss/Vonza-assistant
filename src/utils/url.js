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

export function normalizeWebsiteUrl(value) {
  return cleanText(value);
}
