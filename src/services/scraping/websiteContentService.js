import axios from "axios";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

import {
  BUSINESSES_TABLE,
  WEBSITE_CONTENT_PAGES_TABLE,
  WEBSITE_CONTENT_TABLE,
} from "../../config/constants.js";
import {
  getPublicAppUrl,
  getWebsiteImportJsFallbackConfig,
  getWebsiteImportMaxPages,
} from "../../config/env.js";
import { ensureBusinessRecord } from "../business/businessResolution.js";
import { cleanText, tokenizeForMatching } from "../../utils/text.js";
import {
  isSameDomain,
  normalizePathname,
  normalizeUrl,
} from "../../utils/url.js";

const MEDIA_BLOCK_START = "[[VONZA_MEDIA_ASSETS]]";
const MEDIA_BLOCK_END = "[[/VONZA_MEDIA_ASSETS]]";
const MAX_FETCH_REDIRECTS = 3;
const MAX_HTML_BYTES = 1_500_000;
const MAX_SITEMAP_BYTES = 1_000_000;
const MAX_SITEMAP_FILES = 12;
const COMMON_MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk",
  "com.au",
  "com.br",
  "com.tr",
  "co.jp",
  "co.nz",
  "com.mx",
  "com.pl",
  "com.ua",
]);
const USEFUL_LINKED_SUBDOMAIN_PATTERN = /^(book|booking|appointments?|schedule|shop|store|webshop|blog|support|help|faq|docs|kb)(?:[-.].*)?$/i;
const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
]);

function createBlockedFetchError(reason) {
  const error = new Error(`Website import blocked unsafe URL: ${reason}`);
  error.code = "unsafe_website_url";
  error.statusCode = 400;
  return error;
}

function isMissingStructuredFactsColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    ["PGRST204", "42703"].includes(error?.code) &&
    message.includes("structured_facts")
  );
}

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(`'public.${relationName}'`) ||
    message.includes(`${relationName} was not found`)
  );
}

function parseIpv4Address(address = "") {
  const parts = String(address || "").split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number.parseInt(part, 10));

  if (
    octets.some((octet, index) =>
      !Number.isInteger(octet) ||
      octet < 0 ||
      octet > 255 ||
      String(octet) !== parts[index]
    )
  ) {
    return null;
  }

  return octets;
}

function isBlockedIpv4(address = "") {
  const octets = parseIpv4Address(address);

  if (!octets) {
    return false;
  }

  const [first, second, third, fourth] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224 ||
    (first === 169 && second === 254 && third === 169 && fourth === 254)
  );
}

function ipv6ToBigInt(address = "") {
  const normalized = String(address || "").toLowerCase();
  const withoutZone = normalized.split("%")[0];
  const ipv4Match = withoutZone.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  let candidate = withoutZone;

  if (ipv4Match) {
    const ipv4 = parseIpv4Address(ipv4Match[1]);

    if (!ipv4) {
      return null;
    }

    const ipv4Groups = [
      ((ipv4[0] << 8) | ipv4[1]).toString(16),
      ((ipv4[2] << 8) | ipv4[3]).toString(16),
    ];
    candidate = withoutZone.slice(0, withoutZone.length - ipv4Match[1].length) + ipv4Groups.join(":");
  }

  const pieces = candidate.split("::");

  if (pieces.length > 2) {
    return null;
  }

  const left = pieces[0] ? pieces[0].split(":").filter(Boolean) : [];
  const right = pieces[1] ? pieces[1].split(":").filter(Boolean) : [];
  const missing = 8 - left.length - right.length;

  if (missing < 0 || (pieces.length === 1 && missing !== 0)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];

  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))
  ) {
    return null;
  }

  return groups.reduce(
    (total, group) => (total << 16n) + BigInt(Number.parseInt(group, 16)),
    0n
  );
}

function isIpv6InRange(value, prefix, bits) {
  const address = ipv6ToBigInt(value);
  const range = ipv6ToBigInt(prefix);

  if (address === null || range === null) {
    return false;
  }

  const shift = 128n - BigInt(bits);
  return (address >> shift) === (range >> shift);
}

function isBlockedIpv6(address = "") {
  const normalized = String(address || "").toLowerCase().split("%")[0];

  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    if (mappedIpv4.includes(".")) {
      return isBlockedIpv4(mappedIpv4);
    }
  }

  if (isIpv6InRange(normalized, "::ffff:0:0", 96)) {
    const address = ipv6ToBigInt(normalized);

    if (address !== null) {
      const ipv4Value = Number(address & 0xffffffffn);
      const mappedIpv4 = [
        (ipv4Value >>> 24) & 255,
        (ipv4Value >>> 16) & 255,
        (ipv4Value >>> 8) & 255,
        ipv4Value & 255,
      ].join(".");
      return isBlockedIpv4(mappedIpv4);
    }
  }

  return (
    isIpv6InRange(normalized, "::", 128) ||
    isIpv6InRange(normalized, "::1", 128) ||
    isIpv6InRange(normalized, "fc00::", 7) ||
    isIpv6InRange(normalized, "fe80::", 10) ||
    isIpv6InRange(normalized, "ff00::", 8)
  );
}

export function isBlockedIpAddress(address = "") {
  const normalized = String(address || "").trim().replace(/^\[|\]$/g, "");
  const ipVersion = net.isIP(normalized);

  if (ipVersion === 4) {
    return isBlockedIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(normalized);
  }

  return true;
}

function isBlockedHostname(hostname = "") {
  const normalized = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");

  return (
    !normalized ||
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    METADATA_HOSTNAMES.has(normalized)
  );
}

function isHtmlCompatibleContentType(contentType = "") {
  const normalized = cleanText(contentType).toLowerCase();

  return normalized.includes("text/html") || normalized.includes("application/xhtml+xml");
}

function isXmlCompatibleContentType(contentType = "") {
  const normalized = cleanText(contentType).toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("xml") ||
    normalized.includes("text/plain") ||
    normalized.includes("application/octet-stream")
  );
}

function getContentLength(headers = {}) {
  const value = Number.parseInt(headers["content-length"] || headers["Content-Length"] || "", 10);
  return Number.isFinite(value) ? value : 0;
}

function isSuccessfulFetchStatus(status) {
  return Number(status) >= 200 && Number(status) < 300;
}

function normalizeHostname(hostname = "") {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

function getUrlHostname(value = "") {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function normalizeHostAlias(value = "") {
  return normalizeHostname(getUrlHostname(value) || value);
}

function getRegistrableDomain(hostname = "") {
  const normalized = normalizeHostname(hostname);
  const labels = normalized.split(".").filter(Boolean);

  if (labels.length <= 2) {
    return normalized;
  }

  const twoPartSuffix = labels.slice(-2).join(".");
  if (COMMON_MULTI_PART_PUBLIC_SUFFIXES.has(twoPartSuffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

function getSubdomainPrefix(hostname = "", registrableDomain = "") {
  const normalized = normalizeHostname(hostname);

  if (!normalized || !registrableDomain || normalized === registrableDomain) {
    return "";
  }

  return normalized.endsWith(`.${registrableDomain}`)
    ? normalized.slice(0, -registrableDomain.length - 1)
    : "";
}

function isApexOrWwwEquivalent(url, rootUrl) {
  return normalizeHostname(getUrlHostname(url)) === normalizeHostname(getUrlHostname(rootUrl));
}

function isUsefulLinkedSubdomain(url, rootUrl) {
  const hostname = normalizeHostname(getUrlHostname(url));
  const rootHostname = normalizeHostname(getUrlHostname(rootUrl));
  const registrableDomain = getRegistrableDomain(rootHostname);

  if (!hostname || !rootHostname || !registrableDomain || getRegistrableDomain(hostname) !== registrableDomain) {
    return false;
  }

  const subdomainPrefix = getSubdomainPrefix(hostname, registrableDomain);
  return Boolean(subdomainPrefix && USEFUL_LINKED_SUBDOMAIN_PATTERN.test(subdomainPrefix));
}

function isAllowedCrawlUrl(url, rootUrl, options = {}) {
  if (!rootUrl) {
    return true;
  }

  if (isApexOrWwwEquivalent(url, rootUrl) || isSameDomain(url, rootUrl)) {
    return true;
  }

  return options.allowLinkedSubdomain === true && isUsefulLinkedSubdomain(url, rootUrl);
}

function getCrawlUrlKey(url = "") {
  try {
    const parsed = new URL(url);
    parsed.hostname = normalizeHostname(parsed.hostname);
    parsed.hash = "";
    parsed.search = "";

    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }

    return parsed.toString();
  } catch {
    return cleanText(url);
  }
}

function buildAllowedFetchHosts(rootUrl, extraHosts = []) {
  return [
    normalizeHostname(getUrlHostname(rootUrl)),
    ...extraHosts.map(normalizeHostAlias),
  ].filter(Boolean);
}

function assertSameSiteUrl(url, rootUrl, options = {}) {
  const normalizedHost = normalizeHostname(getUrlHostname(url));
  const allowedHosts = Array.isArray(options.allowedHosts)
    ? options.allowedHosts.map(normalizeHostAlias).filter(Boolean)
    : [];

  if (rootUrl && !isAllowedCrawlUrl(url, rootUrl) && !allowedHosts.includes(normalizedHost)) {
    throw createBlockedFetchError("redirect target is outside the website host");
  }
}

export async function validateWebsiteFetchUrl(url, options = {}) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw createBlockedFetchError("invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createBlockedFetchError("only HTTP and HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (isBlockedHostname(hostname)) {
    throw createBlockedFetchError("local or metadata hostnames are not allowed");
  }

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw createBlockedFetchError("local, private, metadata, multicast, or unspecified IPs are not allowed");
    }

    return parsed.toString();
  }

  const lookup = options.lookup || dns.lookup;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  const resolvedAddresses = Array.isArray(addresses) ? addresses : [addresses];

  if (!resolvedAddresses.length) {
    throw createBlockedFetchError("hostname did not resolve");
  }

  for (const entry of resolvedAddresses) {
    const address = typeof entry === "string" ? entry : entry?.address;

    if (!address || isBlockedIpAddress(address)) {
      throw createBlockedFetchError("hostname resolves to a blocked IP range");
    }
  }

  return parsed.toString();
}

function createSafeLookup(lookup = dns.lookup) {
  return async (hostname, options, callback) => {
    const done = typeof callback === "function" ? callback : options;
    const lookupOptions = typeof callback === "function" ? options : {};

    try {
      if (isBlockedHostname(hostname)) {
        throw createBlockedFetchError("local or metadata hostnames are not allowed");
      }

      const result = await lookup(hostname, lookupOptions);
      const entries = Array.isArray(result) ? result : [result];

      for (const entry of entries) {
        const address = typeof entry === "string" ? entry : entry?.address;

        if (!address || isBlockedIpAddress(address)) {
          throw createBlockedFetchError("hostname resolves to a blocked IP range");
        }
      }

      if (Array.isArray(result)) {
        done(null, result);
        return;
      }

      if (typeof result === "string") {
        done(null, result);
        return;
      }

      done(null, result.address, result.family);
    } catch (error) {
      done(error);
    }
  };
}

function buildSafeFetchAgents(options = {}) {
  if (options.httpAgent || options.httpsAgent) {
    return {
      httpAgent: options.httpAgent,
      httpsAgent: options.httpsAgent,
    };
  }

  const lookup = createSafeLookup(options.lookup || dns.lookup);

  return {
    httpAgent: new http.Agent({ lookup }),
    httpsAgent: new https.Agent({ lookup }),
  };
}

function escapeRegex(value = "") {
  return String(value).replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

const MEDIA_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(MEDIA_BLOCK_START)}\\n?([\\s\\S]*?)\\n?${escapeRegex(MEDIA_BLOCK_END)}`,
  "i"
);

function logScrapeMetadata(eventName, metadata = {}) {
  console.info(`[scrape] ${eventName}`, {
    pageUrlPresent: Boolean(cleanText(metadata.pageUrl)),
    businessId: cleanText(metadata.businessId) || null,
    contentLength: Number(metadata.contentLength || 0),
    discoveredImageCount: Number(metadata.discoveredImageCount || 0),
    keptImageCount: Number(metadata.keptImageCount || 0),
    pageCount: Number(metadata.pageCount || 0),
  });
}

function normalizeMediaAsset(asset = {}, fallbackPageUrl = "") {
  const rawUrl = cleanText(asset.url);
  const url = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : normalizeUrl(rawUrl, fallbackPageUrl);

  if (!url || !isUsefulImageUrl(url)) {
    return null;
  }

  return {
    url,
    pageUrl: cleanText(asset.pageUrl || fallbackPageUrl),
    alt: cleanText(asset.alt),
  };
}

function serializeMediaAssets(assets = []) {
  const normalizedAssets = assets
    .map((asset) => normalizeMediaAsset(asset))
    .filter(Boolean)
    .slice(0, 48);

  if (!normalizedAssets.length) {
    return "";
  }

  return `${MEDIA_BLOCK_START}\n${JSON.stringify(normalizedAssets)}\n${MEDIA_BLOCK_END}`;
}

export function extractStructuredMediaAssets(content = "") {
  const normalizedContent = String(content || "");
  const seen = new Set();
  const structuredAssets = [];

  const startIndex = normalizedContent.indexOf(MEDIA_BLOCK_START);
  const endIndex = normalizedContent.indexOf(MEDIA_BLOCK_END);

  if (startIndex >= 0 && endIndex > startIndex) {
    try {
      const rawBlock = normalizedContent
        .slice(startIndex + MEDIA_BLOCK_START.length, endIndex)
        .trim();
      const parsed = JSON.parse(rawBlock);

      if (Array.isArray(parsed)) {
        parsed.forEach((asset) => {
          const normalized = normalizeMediaAsset(asset);

          if (!normalized || seen.has(normalized.url)) {
            return;
          }

          seen.add(normalized.url);
          structuredAssets.push(normalized);
        });
      }
    } catch {
      // Ignore malformed media blocks and fall back to legacy parsing below.
    }
  }

  const lines = normalizedContent.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    if (cleanText(lines[index]).toLowerCase() !== "images:") {
      continue;
    }

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = cleanText(lines[cursor]);

      if (!line) {
        continue;
      }

      if (!/^https?:\/\//i.test(line)) {
        break;
      }

      if (!/\.(avif|gif|jpe?g|png|webp)(\?|#|$)/i.test(line)) {
        continue;
      }

      const normalized = normalizeMediaAsset({ url: line });

      if (!normalized || seen.has(normalized.url)) {
        continue;
      }

      seen.add(normalized.url);
      structuredAssets.push(normalized);
    }
  }

  return structuredAssets;
}

export function stripStructuredMediaContent(content = "") {
  return String(content || "").replace(MEDIA_BLOCK_PATTERN, "").trim();
}

export function stripLegacyImageSections(content = "") {
  const lines = String(content || "").split("\n");
  const cleanedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = cleanText(line).toLowerCase();

    if (normalized !== "images:") {
      cleanedLines.push(line);
      continue;
    }

    index += 1;

    while (index < lines.length) {
      const candidate = cleanText(lines[index]);

      if (!candidate) {
        index += 1;
        continue;
      }

      if (/^https?:\/\//i.test(candidate)) {
        index += 1;
        continue;
      }

      index -= 1;
      break;
    }
  }

  return cleanedLines.join("\n");
}

export function buildPlainWebsiteContent(content = "") {
  const withoutStructuredMedia = stripStructuredMediaContent(content);
  const withoutLegacyImageSections = stripLegacyImageSections(withoutStructuredMedia);

  return cleanExtractedContent(withoutLegacyImageSections);
}

function normalizeMatchText(value = "") {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCH_SYNONYM_GROUPS = Object.freeze([
  Object.freeze(["price", "prices", "pricing", "cost", "costs", "quote", "estimate", "fee", "fees", "budget", "ar", "arak", "ajanlat", "koltseg"]),
  Object.freeze(["service", "services", "offer", "offers", "offering", "help", "szolgaltatas", "szolgaltatasok", "kinal"]),
  Object.freeze(["contact", "email", "phone", "call", "reach", "address", "kapcsolat", "elerhetoseg", "telefon"]),
  Object.freeze(["book", "booking", "appointment", "schedule", "availability", "available", "time", "times", "foglalas", "idopont", "elerheto"]),
  Object.freeze(["policy", "policies", "refund", "return", "cancellation", "cancel", "warranty", "guarantee", "privacy", "szabalyzat", "visszaterites", "lemondas", "garancia"]),
]);

function buildExpandedKeywords(userMessage = "") {
  const normalizedMessage = normalizeMatchText(userMessage);
  const tokens = tokenizeForMatching(userMessage).map(normalizeMatchText).filter(Boolean);
  const keywords = new Set(tokens);

  MATCH_SYNONYM_GROUPS.forEach((group) => {
    if (group.some((term) => keywords.has(term) || normalizedMessage.includes(term))) {
      group.forEach((term) => keywords.add(term));
    }
  });

  return [...keywords].filter((keyword) => keyword.length > 2);
}

function isBroadBusinessContextRequest(userMessage = "", keywords = []) {
  const normalizedMessage = normalizeMatchText(userMessage);

  if (!keywords.length) {
    return true;
  }

  return /\b(what do you do|what does this business do|about|overview|business|company|help with|mivel foglalkoz|mit csinal|mit csinaltok)\b/i.test(
    normalizedMessage
  );
}

function scoreSectionForKeywords(section = "", keywords = []) {
  if (!keywords.length) {
    return 1;
  }

  const normalizedSection = normalizeMatchText(section);
  const titleText = normalizeMatchText((section.match(/^Title:\s*(.+)$/im) || [])[1] || "");
  const headingText = normalizeMatchText((section.match(/Headings:\s*([\s\S]*?)(?:\n\n|$)/i) || [])[1] || "");
  const highlightsText = normalizeMatchText((section.match(/Highlights:\s*([\s\S]*?)(?:\n\n|$)/i) || [])[1] || "");

  let keywordScore = 0;

  keywords.forEach((keyword) => {
    if (!keyword || !normalizedSection.includes(keyword)) {
      return;
    }

    keywordScore += 2;

    if (titleText.includes(keyword)) {
      keywordScore += 5;
    }

    if (headingText.includes(keyword)) {
      keywordScore += 4;
    }

    if (highlightsText.includes(keyword)) {
      keywordScore += 3;
    }
  });

  if (!keywordScore) {
    return 0;
  }

  const structureScore =
    (headingText ? 2 : 0) +
    (highlightsText ? 2 : 0) +
    (/description:/i.test(section) ? 1 : 0);

  return keywordScore + structureScore;
}

export function buildRelevantContextBlock(contentRecord, userMessage) {
  const sections = buildPlainWebsiteContent(contentRecord.content)
    .split(/\n\n---\n\n/)
    .map((section) => section.trim())
    .filter(Boolean);
  const keywords = buildExpandedKeywords(userMessage);

  if (sections.length === 0) {
    return "";
  }

  const rankedSections = sections
    .map((section) => {
      return { section, score: scoreSectionForKeywords(section, keywords) };
    })
    .sort((left, right) => right.score - left.score);

  const topSections = rankedSections
    .filter((entry) => entry.score > 0)
    .slice(0, 5)
    .map((entry) => entry.section.slice(0, 2200));

  if (!topSections.length && !isBroadBusinessContextRequest(userMessage, keywords)) {
    return "";
  }

  const fallbackSections = sections
    .slice(0, 2)
    .map((section) => section.slice(0, 2200));
  const selectedSections = topSections.length > 0 ? topSections : fallbackSections;

  return selectedSections.join("\n\n---\n\n").slice(0, 9000);
}

export function cleanExtractedContent(rawText) {
  const shortLineSeen = new Set();
  const lines = rawText
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const cleanedLines = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    const wordCount = normalized.split(/\s+/).length;
    const isLikelyNavigationLine = wordCount <= 8;

    if (isLikelyNavigationLine) {
      if (shortLineSeen.has(normalized)) {
        continue;
      }

      shortLineSeen.add(normalized);
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n\n").slice(0, 15000).trim();
}

function getWebsiteHomeUrl(rootUrl) {
  try {
    const parsed = new URL(rootUrl);
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return rootUrl;
  }
}

function hasDeprioritizedQuery(search = "") {
  return /[?&](s|search|q|query|page|paged|p)=/i.test(search);
}

function isLikelyAssetPath(pathname = "") {
  return /\.(avif|css|csv|docx?|eot|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|pptx?|rss|svg|ttf|txt|webm|webp|woff2?|xlsx?|xml|zip)$/i.test(
    pathname
  );
}

function normalizeCrawlCandidateUrl(rawUrl, baseUrl, rootUrl, options = {}) {
  const normalized = normalizeUrl(rawUrl, baseUrl || rootUrl);

  if (!normalized || !isAllowedCrawlUrl(normalized, rootUrl, options)) {
    return "";
  }

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    if (hasDeprioritizedQuery(parsed.search) || (options.allowAsset !== true && isLikelyAssetPath(parsed.pathname))) {
      return "";
    }

    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function getCrawlUrlRank(url, rootUrl) {
  let pathname = "/";

  try {
    pathname = normalizePathname(url).toLowerCase();
  } catch {
    return -1000;
  }

  const homeUrl = getWebsiteHomeUrl(rootUrl);
  let score = url === homeUrl || pathname === "/" ? 1000 : 500;
  const priorityPatterns = [
    { pattern: /(^|\/)(services?|szolgaltatas(?:ok)?)(\/|$)/i, score: 260 },
    { pattern: /(^|\/)(pricing|prices|plans|arak|dijak)(\/|$)/i, score: 240 },
    { pattern: /(^|\/)(faq|gyik|help|support)(\/|$)/i, score: 220 },
    { pattern: /(^|\/)(about|about-us|rolunk)(\/|$)/i, score: 200 },
    { pattern: /(^|\/)(contact|kapcsolat)(\/|$)/i, score: 190 },
    { pattern: /(^|\/)(booking|book|appointments?|foglalas|idopont)(\/|$)/i, score: 180 },
    { pattern: /(^|\/)(locations?|service-areas?|helyszin(?:ek)?|uzletek)(\/|$)/i, score: 170 },
  ];
  const deprioritizedPatterns = [
    /(^|\/)(tag|tags|category|categories|feed|feeds|rss|author|search)(\/|$)/i,
    /(^|\/)(page|oldal)\/\d+(\/|$)/i,
    /\/\d{4}\/\d{1,2}(\/|$)/i,
  ];

  for (const entry of priorityPatterns) {
    if (entry.pattern.test(pathname)) {
      score += entry.score;
      break;
    }
  }

  if (deprioritizedPatterns.some((pattern) => pattern.test(pathname))) {
    score -= 450;
  }

  const depth = pathname === "/" ? 0 : pathname.split("/").filter(Boolean).length;
  score -= Math.min(depth, 8) * 20;
  score -= Math.min(pathname.length, 200) / 20;

  return score;
}

export function rankCrawlUrls(urls = [], rootUrl, options = {}) {
  const seen = new Set();
  const ranked = [];
  const homeUrl = getWebsiteHomeUrl(rootUrl);
  const candidates = options.includeHome === false ? urls : [homeUrl, ...urls];

  for (const rawUrl of candidates) {
    const cleanUrl = normalizeCrawlCandidateUrl(rawUrl, rootUrl, rootUrl, options);
    const crawlKey = getCrawlUrlKey(cleanUrl);
    if (!cleanUrl || seen.has(crawlKey)) {
      continue;
    }

    seen.add(crawlKey);
    ranked.push({
      url: cleanUrl,
      score: getCrawlUrlRank(cleanUrl, rootUrl),
      index: ranked.length,
    });
  }

  return ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.url);
}

export function extractInternalLinks(html, pageUrl, rootUrl) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const normalized = normalizeCrawlCandidateUrl(href, pageUrl, rootUrl, {
      allowLinkedSubdomain: true,
    });

    if (normalized) {
      links.push(normalized);
    }
  });

  return rankCrawlUrls(links, rootUrl, {
    includeHome: false,
    allowLinkedSubdomain: true,
  });
}

function getXmlLocalName(element) {
  return String(element?.tagName || element?.name || "")
    .split(":")
    .pop()
    .toLowerCase();
}

function collectSitemapLocValues($, parentName) {
  const values = [];

  $("*").each((_, element) => {
    if (getXmlLocalName(element) !== parentName) {
      return;
    }

    $(element).children().each((__, child) => {
      if (getXmlLocalName(child) === "loc") {
        const value = cleanText($(child).text());
        if (value) {
          values.push(value);
        }
      }
    });
  });

  return values;
}

export function parseSitemapXml(xml = "") {
  const $ = cheerio.load(String(xml || ""), { xmlMode: true });

  return {
    sitemapUrls: collectSitemapLocValues($, "sitemap"),
    pageUrls: collectSitemapLocValues($, "url"),
  };
}

function buildSitemapUrl(rootUrl) {
  try {
    return new URL("/sitemap.xml", rootUrl).toString();
  } catch {
    return "";
  }
}

export async function discoverSitemapCrawlUrls(rootUrl, options = {}) {
  const rootSitemapUrl = buildSitemapUrl(rootUrl);

  if (!rootSitemapUrl) {
    return {
      used: false,
      urls: [],
      rankedUrls: [],
      skippedUrls: [],
      discoveredUrlCount: 0,
      sitemapUrl: "",
      sitemapFileCount: 0,
    };
  }

  const pageLimit = Number.isFinite(options.maxPages)
    ? Math.max(1, Math.min(Math.trunc(options.maxPages), 50))
    : getWebsiteImportMaxPages();
  const sitemapQueue = [rootSitemapUrl];
  const visitedSitemaps = new Set();
  const discoveredPageUrls = [];

  while (sitemapQueue.length > 0 && visitedSitemaps.size < MAX_SITEMAP_FILES) {
    const sitemapUrl = sitemapQueue.shift();
    const normalizedSitemapUrl = normalizeCrawlCandidateUrl(sitemapUrl, rootUrl, rootUrl, { allowAsset: true });

    if (!normalizedSitemapUrl || visitedSitemaps.has(normalizedSitemapUrl)) {
      continue;
    }

    visitedSitemaps.add(normalizedSitemapUrl);

    let response;
    try {
      response = await fetchSitemapXml(normalizedSitemapUrl, {
        ...options,
        rootUrl,
      });
    } catch (error) {
      if (normalizedSitemapUrl === rootSitemapUrl) {
        throw error;
      }
      continue;
    }
    const parsed = parseSitemapXml(response.xml);

    for (const sitemapChildUrl of parsed.sitemapUrls) {
      const normalizedChildUrl = normalizeCrawlCandidateUrl(sitemapChildUrl, normalizedSitemapUrl, rootUrl, { allowAsset: true });
      if (
        normalizedChildUrl &&
        !visitedSitemaps.has(normalizedChildUrl) &&
        sitemapQueue.length + visitedSitemaps.size < MAX_SITEMAP_FILES
      ) {
        sitemapQueue.push(normalizedChildUrl);
      }
    }

    for (const pageUrl of parsed.pageUrls) {
      const normalizedPageUrl = normalizeCrawlCandidateUrl(pageUrl, normalizedSitemapUrl, rootUrl);
      if (normalizedPageUrl) {
        discoveredPageUrls.push(normalizedPageUrl);
      }
    }
  }

  const sitemapPageUrls = rankCrawlUrls(discoveredPageUrls, rootUrl, { includeHome: false });

  if (!sitemapPageUrls.length) {
    return {
      used: false,
      urls: [],
      rankedUrls: [],
      skippedUrls: [],
      discoveredUrlCount: 0,
      sitemapUrl: rootSitemapUrl,
      sitemapFileCount: visitedSitemaps.size,
    };
  }

  const rankedUrls = rankCrawlUrls(sitemapPageUrls, rootUrl);

  return {
    used: rankedUrls.length > 0,
    urls: rankedUrls.slice(0, pageLimit),
    rankedUrls: rankedUrls.slice(0, Math.max(pageLimit, 100)),
    skippedUrls: rankedUrls.slice(pageLimit, pageLimit + 50),
    discoveredUrlCount: rankedUrls.length,
    sitemapUrl: rootSitemapUrl,
    sitemapFileCount: visitedSitemaps.size,
  };
}

function isUsefulImageUrl(url) {
  const normalized = cleanText(url).toLowerCase();

  if (!normalized || normalized.startsWith("data:")) {
    return false;
  }

  if (/\.(svg|ico)(\?|$)/i.test(normalized)) {
    return false;
  }

  if (/(favicon|sprite|badge)/i.test(normalized)) {
    return false;
  }

  return true;
}

export function extractUsefulImageUrls(html, pageUrl) {
  return extractUsefulImageAssets(html, pageUrl).map((asset) => asset.url);
}

export function extractUsefulImageAssets(html, pageUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const imageAssets = [];
  let discoveredCount = 0;

  $("img").each((_, element) => {
    discoveredCount += 1;
    const src =
      $(element).attr("src") ||
      $(element).attr("data-src") ||
      $(element).attr("data-lazy-src") ||
      $(element).attr("srcset")?.split(",")[0]?.trim()?.split(/\s+/)[0];
    const normalizedUrl = normalizeUrl(src, pageUrl);
    const width = Number.parseInt($(element).attr("width") || "", 10);
    const height = Number.parseInt($(element).attr("height") || "", 10);
    const alt = cleanText($(element).attr("alt") || "");
    const className = cleanText($(element).attr("class") || "");

    if (!normalizedUrl || seen.has(normalizedUrl) || !isUsefulImageUrl(normalizedUrl)) {
      return;
    }

    if ((Number.isFinite(width) && width > 0 && width < 48) || (Number.isFinite(height) && height > 0 && height < 48)) {
      return;
    }

    if (/(favicon|icon)/i.test(`${alt} ${className}`)) {
      return;
    }

    seen.add(normalizedUrl);
    imageAssets.push({
      url: normalizedUrl,
      pageUrl,
      alt,
    });
  });

  const keptImages = imageAssets.slice(0, 12);
  logScrapeMetadata("images_extracted", {
    pageUrl,
    discoveredImageCount: discoveredCount,
    keptImageCount: keptImages.length,
  });

  return keptImages;
}

export function extractImageUrlsFromContent(content = "") {
  return extractStructuredMediaAssets(content).map((asset) => asset.url);
}

function getContentMediaAssets(contentRecord = {}) {
  if (Array.isArray(contentRecord.mediaAssets) && contentRecord.mediaAssets.length > 0) {
    return contentRecord.mediaAssets
      .map((asset) => normalizeMediaAsset(asset))
      .filter(Boolean);
  }

  return extractStructuredMediaAssets(contentRecord.rawContent || contentRecord.content);
}

export function hasVisualIntent(message = "") {
  return /(show me|send me|share|image|images|photo|photos|picture|pictures|gallery|logo|logos|visual|visuals|screenshot|screenshots|asset|assets|source image|source images|kép|képek|mutasd|mutass|fotó|fotók|vizuális|galéria|logo)/i.test(
    message
  );
}

export function selectRelevantImageUrls(contentRecord, userMessage) {
  if (!hasVisualIntent(userMessage)) {
    return [];
  }

  const assets = getContentMediaAssets(contentRecord);
  const keywords = tokenizeForMatching(userMessage);
  const rankedAssets = assets
    .map((asset) => {
      const altText = cleanText(asset.alt).toLowerCase();
      const pageText = cleanText(asset.pageUrl).toLowerCase();
      const score = keywords.reduce((total, keyword) => {
        if (!keyword) {
          return total;
        }

        let nextScore = total;

        if (altText.includes(keyword)) {
          nextScore += 4;
        }

        if (pageText.includes(keyword)) {
          nextScore += 2;
        }

        return nextScore;
      }, 0);

      return {
        asset,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);

  const relevantImages = rankedAssets
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.asset.url);

  if (relevantImages.length > 0) {
    return relevantImages.slice(0, 2);
  }

  return assets.map((asset) => asset.url).slice(0, 2);
}

function createEmptyStructuredFacts() {
  return {
    businessNames: [],
    descriptions: [],
    addresses: [],
    phones: [],
    emails: [],
    openingHours: [],
    services: [],
    offers: [],
    priceHints: [],
    faqs: [],
    urls: {
      booking: [],
      contact: [],
      social: [],
    },
    openGraph: {
      titles: [],
      descriptions: [],
    },
    sourceUrls: [],
  };
}

function appendUnique(list, value, limit = 16) {
  if (Array.isArray(value)) {
    value.forEach((entry) => appendUnique(list, entry, limit));
    return;
  }

  const normalized = cleanText(String(value || "")).replace(/^mailto:/i, "").replace(/^tel:/i, "");

  if (!normalized || list.includes(normalized) || list.length >= limit) {
    return;
  }

  list.push(normalized);
}

function appendFaq(list, question, answer, limit = 12) {
  const normalizedQuestion = cleanText(question);
  const normalizedAnswer = cleanText(answer);

  if (
    !normalizedQuestion ||
    !normalizedAnswer ||
    list.length >= limit ||
    list.some((entry) => entry.question === normalizedQuestion)
  ) {
    return;
  }

  list.push({
    question: normalizedQuestion,
    answer: normalizedAnswer,
  });
}

function stripHtmlText(value = "") {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "));
}

function normalizeSchemaTypes(value) {
  const rawTypes = Array.isArray(value) ? value : [value];
  return rawTypes
    .map((type) => cleanText(String(type || "")).toLowerCase())
    .filter(Boolean);
}

function readSchemaText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return stripHtmlText(value);
  }

  if (Array.isArray(value)) {
    return value.map(readSchemaText).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return readSchemaText(value.name || value.text || value.description || value.url || value.urlTemplate || value["@id"]);
  }

  return "";
}

function normalizeUrlList(value, pageUrl) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => readSchemaText(entry))
    .map((entry) => normalizeUrl(entry, pageUrl))
    .filter(Boolean);
}

function formatAddress(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatAddress).filter(Boolean).join("; ");
  }

  if (typeof value === "object") {
    return [
      value.streetAddress,
      value.addressLocality,
      value.addressRegion,
      value.postalCode,
      value.addressCountry,
    ].map(readSchemaText).filter(Boolean).join(", ");
  }

  return "";
}

function formatOpeningHours(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatOpeningHours).filter(Boolean).join("; ");
  }

  if (typeof value === "object") {
    const days = readSchemaText(value.dayOfWeek);
    const opens = readSchemaText(value.opens);
    const closes = readSchemaText(value.closes);
    const validFrom = readSchemaText(value.validFrom);
    const validThrough = readSchemaText(value.validThrough);
    const hours = [opens, closes].filter(Boolean).join("-");
    const validity = [validFrom, validThrough].filter(Boolean).join(" to ");

    return [days, hours, validity].filter(Boolean).join(" ");
  }

  return "";
}

function formatServiceOrOffer(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return readSchemaText(value);
  }

  const name = readSchemaText(value.name || value.serviceType || value.itemOffered);
  const description = readSchemaText(value.description);
  return [name, description].filter(Boolean).join(" - ");
}

function formatPriceHint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const currency = readSchemaText(value.priceCurrency);
  const directPrice = readSchemaText(value.price || value.priceRange);
  const lowPrice = readSchemaText(value.lowPrice);
  const highPrice = readSchemaText(value.highPrice);
  const range = lowPrice || highPrice
    ? [lowPrice, highPrice].filter(Boolean).join("-")
    : "";
  const price = directPrice || range;

  if (!price) {
    return "";
  }

  return [
    readSchemaText(value.name || value.itemOffered),
    [price, currency].filter(Boolean).join(" "),
  ].filter(Boolean).join(" - ");
}

function collectSchemaNodes(value, nodes = []) {
  if (!value || typeof value !== "object") {
    return nodes;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectSchemaNodes(entry, nodes));
    return nodes;
  }

  nodes.push(value);
  collectSchemaNodes(value["@graph"], nodes);
  collectSchemaNodes(value.mainEntity, nodes);
  collectSchemaNodes(value.acceptedAnswer, nodes);
  collectSchemaNodes(value.address, nodes);
  collectSchemaNodes(value.contactPoint, nodes);
  collectSchemaNodes(value.openingHoursSpecification, nodes);
  collectSchemaNodes(value.makesOffer, nodes);
  collectSchemaNodes(value.offers, nodes);
  collectSchemaNodes(value.hasOfferCatalog, nodes);
  collectSchemaNodes(value.itemListElement, nodes);
  collectSchemaNodes(value.itemOffered, nodes);
  collectSchemaNodes(value.potentialAction, nodes);
  collectSchemaNodes(value.target, nodes);

  return nodes;
}

function parseJsonLdScripts($) {
  const nodes = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const rawJson = $(element).contents().text();

    if (!cleanText(rawJson)) {
      return;
    }

    try {
      collectSchemaNodes(JSON.parse(rawJson), nodes);
    } catch {
      // Ignore malformed JSON-LD and rely on HTML fallback signals.
    }
  });

  return nodes;
}

function classifyBusinessUrl(url = "") {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathText = `${parsed.pathname} ${parsed.search}`.toLowerCase();

  if (/(calendly|acuityscheduling|setmore|simplybook|booksy|reservio|reservation)/i.test(hostname)) {
    return "booking";
  }

  if (/(facebook|instagram|linkedin|tiktok|twitter|x\.com|youtube|pinterest)/i.test(hostname)) {
    return "social";
  }

  if (/(book|booking|appointment|schedule|reserve|foglal|idopont|időpont)/i.test(pathText)) {
    return "booking";
  }

  if (/(contact|kapcsolat|support|help|quote|ajanlat|ajánlat)/i.test(pathText)) {
    return "contact";
  }

  return "";
}

function appendClassifiedUrl(facts, rawUrl, pageUrl) {
  const normalizedUrl = normalizeUrl(rawUrl, pageUrl);
  const bucket = classifyBusinessUrl(normalizedUrl);

  if (bucket && facts.urls[bucket]) {
    appendUnique(facts.urls[bucket], normalizedUrl, 16);
  }
}

function extractSchemaFacts($, pageUrl) {
  const facts = createEmptyStructuredFacts();
  const schemaNodes = parseJsonLdScripts($);

  schemaNodes.forEach((node) => {
    const types = normalizeSchemaTypes(node["@type"]);
    const isBusiness =
      types.some((type) => /(localbusiness|organization|corporation|store|restaurant|medicalbusiness|professionalservice|homeandconstructionbusiness|lodgingbusiness)/i.test(type));
    const isService = types.includes("service");
    const isOffer = types.includes("offer");
    const isQuestion = types.includes("question");
    const isAddress = types.includes("postaladdress");
    const isOpeningHours = types.includes("openinghoursspecification");

    if (isBusiness) {
      appendUnique(facts.businessNames, readSchemaText(node.name), 6);
      appendUnique(facts.descriptions, readSchemaText(node.description), 8);
      appendUnique(facts.priceHints, readSchemaText(node.priceRange), 8);
    }

    if (isService) {
      appendUnique(facts.services, formatServiceOrOffer(node), 24);
    }

    if (isOffer) {
      appendUnique(facts.offers, formatServiceOrOffer(node), 24);
      appendUnique(facts.priceHints, formatPriceHint(node), 16);
    }

    appendUnique(facts.priceHints, formatPriceHint(node), 16);

    if (isQuestion) {
      appendFaq(facts.faqs, readSchemaText(node.name || node.text), readSchemaText(node.acceptedAnswer));
    }

    if (isAddress || node.address) {
      appendUnique(facts.addresses, formatAddress(isAddress ? node : node.address), 8);
    }

    if (isOpeningHours || node.openingHours || node.openingHoursSpecification) {
      appendUnique(
        facts.openingHours,
        formatOpeningHours(isOpeningHours ? node : node.openingHours || node.openingHoursSpecification),
        16
      );
    }

    appendUnique(facts.phones, readSchemaText(node.telephone || node.phone), 8);
    appendUnique(facts.emails, readSchemaText(node.email), 8);

    normalizeUrlList(node.url, pageUrl).forEach((url) => appendClassifiedUrl(facts, url, pageUrl));
    normalizeUrlList(node.target || node.urlTemplate, pageUrl).forEach((url) => appendClassifiedUrl(facts, url, pageUrl));
    normalizeUrlList(node.sameAs, pageUrl).forEach((url) => appendClassifiedUrl(facts, url, pageUrl));
    normalizeUrlList(node.reservationUrl || node.bookingUrl, pageUrl).forEach((url) => {
      appendUnique(facts.urls.booking, url, 16);
    });
    normalizeUrlList(node.contactUrl, pageUrl).forEach((url) => {
      appendUnique(facts.urls.contact, url, 16);
    });
  });

  return facts;
}

function extractHtmlFallbackFacts($, pageUrl) {
  const facts = createEmptyStructuredFacts();
  const ogTitle = cleanText($('meta[property="og:title"], meta[name="twitter:title"]').first().attr("content"));
  const ogDescription = cleanText(
    $('meta[property="og:description"], meta[name="twitter:description"]').first().attr("content")
  );

  appendUnique(facts.openGraph.titles, ogTitle, 4);
  appendUnique(facts.openGraph.descriptions, ogDescription, 4);

  $("a[href]").each((_, element) => {
    const href = cleanText($(element).attr("href"));
    const lowerHref = href.toLowerCase();

    if (lowerHref.startsWith("mailto:")) {
      appendUnique(facts.emails, href.replace(/^mailto:/i, "").split("?")[0], 8);
      return;
    }

    if (lowerHref.startsWith("tel:")) {
      appendUnique(facts.phones, href.replace(/^tel:/i, "").split("?")[0], 8);
      return;
    }

    appendClassifiedUrl(facts, href, pageUrl);
  });

  $("details").each((_, element) => {
    const question = cleanText($(element).find("summary").first().text());
    const answer = cleanText($(element).clone().find("summary").remove().end().text());
    appendFaq(facts.faqs, question, answer);
  });

  $('[class*="faq" i], [id*="faq" i], [class*="accordion" i], [id*="accordion" i]').each((_, element) => {
    const container = $(element);
    const question = cleanText(
      container.find("summary, button, h2, h3, h4, [class*='question' i]").first().text()
    );
    const answer = cleanText(
      container.find("[class*='answer' i], [class*='content' i], p").first().text()
    );
    appendFaq(facts.faqs, question, answer);
  });

  return facts;
}

function mergeFactInto(target, source) {
  appendUnique(target.businessNames, source.businessNames, 6);
  appendUnique(target.descriptions, source.descriptions, 8);
  appendUnique(target.addresses, source.addresses, 8);
  appendUnique(target.phones, source.phones, 8);
  appendUnique(target.emails, source.emails, 8);
  appendUnique(target.openingHours, source.openingHours, 16);
  appendUnique(target.services, source.services, 24);
  appendUnique(target.offers, source.offers, 24);
  appendUnique(target.priceHints, source.priceHints, 16);
  appendUnique(target.urls.booking, source.urls?.booking, 16);
  appendUnique(target.urls.contact, source.urls?.contact, 16);
  appendUnique(target.urls.social, source.urls?.social, 16);
  appendUnique(target.openGraph.titles, source.openGraph?.titles, 4);
  appendUnique(target.openGraph.descriptions, source.openGraph?.descriptions, 4);
  appendUnique(target.sourceUrls, source.sourceUrls, 24);
  (source.faqs || []).forEach((entry) => appendFaq(target.faqs, entry.question, entry.answer));
}

export function normalizeStructuredBusinessFacts(value = {}) {
  const normalized = createEmptyStructuredFacts();
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  mergeFactInto(normalized, input);
  return normalized;
}

export function mergeStructuredBusinessFacts(factsList = []) {
  const merged = createEmptyStructuredFacts();

  factsList.forEach((facts) => mergeFactInto(merged, normalizeStructuredBusinessFacts(facts)));
  return merged;
}

export function getStructuredBusinessFactCount(facts = {}) {
  const normalized = normalizeStructuredBusinessFacts(facts);
  return [
    normalized.businessNames,
    normalized.descriptions,
    normalized.addresses,
    normalized.phones,
    normalized.emails,
    normalized.openingHours,
    normalized.services,
    normalized.offers,
    normalized.priceHints,
    normalized.faqs,
    normalized.urls.booking,
    normalized.urls.contact,
    normalized.urls.social,
    normalized.openGraph.titles,
    normalized.openGraph.descriptions,
  ].reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);
}

function formatStructuredList(label, values = []) {
  const lines = values.map(cleanText).filter(Boolean);
  return lines.length ? `${label}:\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
}

export function buildStructuredBusinessFactsKnowledgeText(facts = {}) {
  const normalized = normalizeStructuredBusinessFacts(facts);

  if (getStructuredBusinessFactCount(normalized) <= 0) {
    return "";
  }

  const faqText = normalized.faqs.length
    ? `FAQ:\n${normalized.faqs.map((entry) => `- Q: ${cleanText(entry.question)}\n  A: ${cleanText(entry.answer)}`).join("\n")}`
    : "";

  return [
    "Structured website facts:",
    "These facts were extracted from schema.org/JSON-LD, explicit contact links, booking/contact links, OpenGraph metadata, and FAQ markup. Use only the facts listed here; do not infer missing prices, services, opening hours, booking availability, or policies.",
    formatStructuredList("Business names", normalized.businessNames),
    formatStructuredList("Descriptions", normalized.descriptions),
    formatStructuredList("Addresses", normalized.addresses),
    formatStructuredList("Phones", normalized.phones),
    formatStructuredList("Emails", normalized.emails),
    formatStructuredList("Opening hours", normalized.openingHours),
    formatStructuredList("Services", normalized.services),
    formatStructuredList("Offers", normalized.offers),
    formatStructuredList("Price hints", normalized.priceHints),
    faqText,
    formatStructuredList("Booking URLs", normalized.urls.booking),
    formatStructuredList("Contact URLs", normalized.urls.contact),
    formatStructuredList("Social URLs", normalized.urls.social),
    formatStructuredList("OpenGraph titles", normalized.openGraph.titles),
    formatStructuredList("OpenGraph descriptions", normalized.openGraph.descriptions),
    formatStructuredList("Source pages", normalized.sourceUrls),
  ].filter(Boolean).join("\n\n");
}

export function extractStructuredBusinessFactsFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const facts = createEmptyStructuredFacts();

  appendUnique(facts.sourceUrls, pageUrl, 24);
  mergeFactInto(facts, extractSchemaFacts($, pageUrl));
  mergeFactInto(facts, extractHtmlFallbackFacts($, pageUrl));

  return normalizeStructuredBusinessFacts(facts);
}

export function extractWebsiteContentFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const structuredFacts = extractStructuredBusinessFactsFromHtml(html, pageUrl);
  $("script, style, noscript, svg, iframe").remove();

  const pageTitle = cleanText($("title").first().text());
  const metaDescription = cleanText(
    $('meta[name="description"]').attr("content") || ""
  );
  const headings = $("h1, h2, h3")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 24);
  const highlights = $("li, strong, b")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 40);
  const mediaAssets = extractUsefulImageAssets(html, pageUrl);
  const imageUrls = mediaAssets.map((asset) => asset.url);
  const bodyContent = cleanExtractedContent($("body").text());
  const structuredContent = [
    headings.length ? `Headings:\n${headings.join("\n")}` : "",
    highlights.length ? `Highlights:\n${highlights.join("\n")}` : "",
    bodyContent ? `Body:\n${bodyContent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const content = cleanExtractedContent(structuredContent);

  logScrapeMetadata("page_extracted", {
    pageUrl,
    contentLength: content.length,
    keptImageCount: imageUrls.length,
  });

  return {
    pageTitle,
    metaDescription,
    content,
    imageUrls,
    mediaAssets,
    structuredFacts,
  };
}

function buildWebsitePageContentBlock(page = {}) {
  const content = buildPlainWebsiteContent(page.content);

  return [
    `URL: ${cleanText(page.url) || "Unknown"}`,
    `Title: ${cleanText(page.pageTitle) || "None"}`,
    `Description: ${cleanText(page.metaDescription) || "None"}`,
    "Content:",
    content,
  ].filter(Boolean).join("\n");
}

function normalizeWebsiteContentPage(page = {}, index = 0) {
  return {
    url: cleanText(page.url),
    pageTitle: cleanText(page.pageTitle),
    metaDescription: cleanText(page.metaDescription),
    content: buildPlainWebsiteContent(page.content),
    structuredFacts: normalizeStructuredBusinessFacts(page.structuredFacts),
    status: cleanText(page.status || "imported"),
    errorCode: cleanText(page.errorCode || page.error_code),
    jsFallbackUsed: page.jsFallbackUsed === true || page.js_fallback_used === true,
    contentHash: cleanText(page.contentHash || page.content_hash),
    importedAt: page.importedAt || page.imported_at || null,
    index,
  };
}

function hashWebsiteContentPage(page = {}) {
  return createHash("sha256")
    .update([
      cleanText(page.url),
      buildPlainWebsiteContent(page.content),
      JSON.stringify(normalizeStructuredBusinessFacts(page.structuredFacts)),
    ].join("\n"), "utf8")
    .digest("hex");
}

export function parseWebsiteContentPages(content = "") {
  return buildPlainWebsiteContent(content)
    .split(/\n\n---\n\n/)
    .map((section, index) => {
      const url = cleanText((section.match(/^URL:\s*(.+)$/im) || [])[1] || "");
      const pageTitle = cleanText((section.match(/^Title:\s*(.+)$/im) || [])[1] || "");
      const metaDescription = cleanText((section.match(/^Description:\s*(.+)$/im) || [])[1] || "");
      const contentMatch = section.match(/^Content:\s*([\s\S]*)$/im);
      const pageContent = cleanExtractedContent(contentMatch?.[1] || section);

      if (!url && !pageContent) {
        return null;
      }

      return {
        url,
        pageTitle: pageTitle === "None" ? "" : pageTitle,
        metaDescription: metaDescription === "None" ? "" : metaDescription,
        content: pageContent,
        index,
      };
    })
    .filter(Boolean);
}

function buildFallbackContentRecord(business, pageResults) {
  const primaryPage = pageResults[0] || {};
  const fallbackTitle = primaryPage.pageTitle || business.name || business.website_url;
  const fallbackDescription =
    primaryPage.metaDescription ||
    "Limited content available. This assistant may give general answers.";
  const fallbackContent = [
    `URL: ${business.website_url}`,
    `Title: ${fallbackTitle || "None"}`,
    `Description: ${fallbackDescription || "None"}`,
    primaryPage.mediaAssets?.length ? `Media assets available on request: ${primaryPage.mediaAssets.length}` : "",
    "Content:",
    "Limited content available. This assistant may give general answers.",
    serializeMediaAssets(primaryPage.mediaAssets || []),
  ].filter(Boolean).join("\n");

  return {
    businessId: business.id,
    websiteUrl: business.website_url,
    pageTitle: fallbackTitle || null,
    metaDescription: fallbackDescription || null,
    content: fallbackContent,
    mediaAssets: primaryPage.mediaAssets || [],
    structuredFacts: mergeStructuredBusinessFacts(pageResults.map((page) => page.structuredFacts)),
    crawledUrls: pageResults.map((page) => page.url),
    pageCount: pageResults.length,
    pages: pageResults.map(normalizeWebsiteContentPage),
  };
}

export async function fetchWebsiteHtmlResponse(url, options = {}) {
  let currentUrl = await validateWebsiteFetchUrl(url, options);
  const allowedHosts = buildAllowedFetchHosts(
    options.rootUrl,
    Array.isArray(options.allowedHosts) ? options.allowedHosts : []
  );
  assertSameSiteUrl(currentUrl, options.rootUrl, { allowedHosts });
  const httpClient = options.httpClient || axios;
  const safeFetchAgents = buildSafeFetchAgents(options);
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : MAX_FETCH_REDIRECTS;
  const maxHtmlBytes = Number.isFinite(options.maxHtmlBytes) ? options.maxHtmlBytes : MAX_HTML_BYTES;
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 15000;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await httpClient.get(currentUrl, {
      timeout,
      maxRedirects: 0,
      maxContentLength: maxHtmlBytes,
      responseType: "text",
      ...safeFetchAgents,
      validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
      headers: {
        "User-Agent":
          `Mozilla/5.0 (compatible; AIShopAssistant/1.0; +${getPublicAppUrl()})`,
        Accept: "text/html,application/xhtml+xml",
        ...(options.headers || {}),
      },
    });
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || currentUrl;
    await validateWebsiteFetchUrl(finalUrl, options);
    assertSameSiteUrl(finalUrl, options.rootUrl, { allowedHosts });

    if (response.status >= 300 && response.status < 400) {
      const location = cleanText(response.headers?.location);

      if (!location) {
        throw createBlockedFetchError("redirect response did not include a location");
      }

      if (redirectCount >= maxRedirects) {
        throw createBlockedFetchError("too many redirects");
      }

      currentUrl = await validateWebsiteFetchUrl(new URL(location, currentUrl).toString(), options);
      assertSameSiteUrl(currentUrl, options.rootUrl, { allowedHosts });
      continue;
    }

    if (!isSuccessfulFetchStatus(response.status)) {
      throw createBlockedFetchError("response status is not successful");
    }

    if (!isHtmlCompatibleContentType(response.headers?.["content-type"])) {
      throw createBlockedFetchError("response content type is not HTML");
    }

    if (getContentLength(response.headers) > maxHtmlBytes) {
      throw createBlockedFetchError("response is too large");
    }

    const html = String(response.data || "");

    if (Buffer.byteLength(html, "utf8") > maxHtmlBytes) {
      throw createBlockedFetchError("response body is too large");
    }

    return {
      html,
      status: response.status,
      url: finalUrl,
      headers: response.headers || {},
    };
  }

  throw createBlockedFetchError("too many redirects");
}

export async function fetchHtml(url, options = {}) {
  const response = await fetchWebsiteHtmlResponse(url, options);
  return response.html;
}

async function fetchSitemapXml(url, options = {}) {
  let currentUrl = await validateWebsiteFetchUrl(url, options);
  const allowedHosts = buildAllowedFetchHosts(
    options.rootUrl,
    Array.isArray(options.allowedHosts) ? options.allowedHosts : []
  );
  assertSameSiteUrl(currentUrl, options.rootUrl, { allowedHosts });
  const httpClient = options.httpClient || axios;
  const safeFetchAgents = buildSafeFetchAgents(options);
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : MAX_FETCH_REDIRECTS;
  const maxSitemapBytes = Number.isFinite(options.maxSitemapBytes) ? options.maxSitemapBytes : MAX_SITEMAP_BYTES;
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 15000;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await httpClient.get(currentUrl, {
      timeout,
      maxRedirects: 0,
      maxContentLength: maxSitemapBytes,
      responseType: "text",
      ...safeFetchAgents,
      validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
      headers: {
        "User-Agent":
          `Mozilla/5.0 (compatible; AIShopAssistant/1.0; +${getPublicAppUrl()})`,
        Accept: "application/xml,text/xml,text/plain,*/*",
        ...(options.headers || {}),
      },
    });
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || currentUrl;
    await validateWebsiteFetchUrl(finalUrl, options);
    assertSameSiteUrl(finalUrl, options.rootUrl, { allowedHosts });

    if (response.status >= 300 && response.status < 400) {
      const location = cleanText(response.headers?.location);

      if (!location) {
        throw createBlockedFetchError("redirect response did not include a location");
      }

      if (redirectCount >= maxRedirects) {
        throw createBlockedFetchError("too many redirects");
      }

      currentUrl = await validateWebsiteFetchUrl(new URL(location, currentUrl).toString(), options);
      assertSameSiteUrl(currentUrl, options.rootUrl, { allowedHosts });
      continue;
    }

    if (!isSuccessfulFetchStatus(response.status)) {
      throw createBlockedFetchError("response status is not successful");
    }

    if (!isXmlCompatibleContentType(response.headers?.["content-type"])) {
      throw createBlockedFetchError("response content type is not XML");
    }

    if (getContentLength(response.headers) > maxSitemapBytes) {
      throw createBlockedFetchError("response is too large");
    }

    const xml = String(response.data || "");

    if (Buffer.byteLength(xml, "utf8") > maxSitemapBytes) {
      throw createBlockedFetchError("response body is too large");
    }

    return {
      xml,
      status: response.status,
      url: finalUrl,
      headers: response.headers || {},
    };
  }

  throw createBlockedFetchError("too many redirects");
}

function resolveJsFallbackConfig(options = {}) {
  const envConfig = getWebsiteImportJsFallbackConfig();

  return {
    enabled: typeof options.jsFallbackEnabled === "boolean"
      ? options.jsFallbackEnabled
      : envConfig.enabled,
    timeoutMs: Number.isFinite(options.jsFallbackTimeoutMs)
      ? Math.max(1000, Math.min(Math.trunc(options.jsFallbackTimeoutMs), 15000))
      : envConfig.timeoutMs,
    maxHtmlBytes: Number.isFinite(options.jsFallbackMaxHtmlBytes)
      ? Math.max(100_000, Math.min(Math.trunc(options.jsFallbackMaxHtmlBytes), 2_000_000))
      : envConfig.maxHtmlBytes,
  };
}

function getExtractedContentStrength(pageContent = {}) {
  return cleanText(pageContent.content).length;
}

export function isWeakExtractedWebsiteContent(pageContent = {}) {
  return getExtractedContentStrength(pageContent) < 300;
}

async function defaultJsFallbackRenderer(url, options = {}) {
  const config = resolveJsFallbackConfig(options);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      javaScriptEnabled: true,
      userAgent: `Mozilla/5.0 (compatible; AIShopAssistant/1.0; +${getPublicAppUrl()})`,
    });
    const allowedHosts = buildAllowedFetchHosts(
      options.rootUrl,
      Array.isArray(options.allowedHosts) ? options.allowedHosts : []
    );
    const page = await context.newPage();

    await page.route("**/*", async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();

      if (["image", "media", "font"].includes(resourceType)) {
        await route.abort().catch(() => {});
        return;
      }

      try {
        const requestUrl = request.url();
        await validateWebsiteFetchUrl(requestUrl, options);
        assertSameSiteUrl(requestUrl, options.rootUrl, { allowedHosts });
        await route.continue();
      } catch {
        await route.abort().catch(() => {});
      }
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(2500, config.timeoutMs),
    }).catch(() => {});

    const html = await page.content();
    if (Buffer.byteLength(html, "utf8") > config.maxHtmlBytes) {
      throw createBlockedFetchError("rendered response body is too large");
    }

    await context.close().catch(() => {});
    return html;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function extractWebsitePageWithOptionalJsFallback(url, html, options = {}) {
  const pageContent = extractWebsiteContentFromHtml(html, url);
  const config = resolveJsFallbackConfig(options);

  if (!config.enabled || !isWeakExtractedWebsiteContent(pageContent)) {
    return {
      html,
      pageContent,
      jsFallbackUsed: false,
    };
  }

  const renderer = typeof options.jsFallbackRenderer === "function"
    ? options.jsFallbackRenderer
    : defaultJsFallbackRenderer;

  try {
    const renderedHtml = await renderer(url, {
      ...options,
      jsFallbackTimeoutMs: config.timeoutMs,
      jsFallbackMaxHtmlBytes: config.maxHtmlBytes,
    });
    const renderedContent = extractWebsiteContentFromHtml(renderedHtml, url);

    if (getExtractedContentStrength(renderedContent) > getExtractedContentStrength(pageContent)) {
      return {
        html: renderedHtml,
        pageContent: renderedContent,
        jsFallbackUsed: true,
      };
    }
  } catch (error) {
    console.warn("[scrape] JS-rendered fallback skipped.", {
      url,
      message: error?.message || "Unknown render failure",
    });
  }

  return {
    html,
    pageContent,
    jsFallbackUsed: false,
  };
}

function buildWebsiteContentPageRows(contentRecord = {}) {
  const businessId = cleanText(contentRecord.businessId);
  const websiteUrl = cleanText(contentRecord.websiteUrl);
  const importJobId = cleanText(contentRecord.importJobId);
  const importedAt = contentRecord.importedAt || new Date().toISOString();
  const importedPages = (Array.isArray(contentRecord.pages) ? contentRecord.pages : [])
    .map((page, index) => {
      const normalized = normalizeWebsiteContentPage({
        ...page,
        status: "imported",
      }, index);

      if (!businessId || !normalized.url) {
        return null;
      }

      return {
        business_id: businessId,
        import_job_id: importJobId || null,
        website_url: websiteUrl,
        page_url: normalized.url,
        page_title: normalized.pageTitle || null,
        meta_description: normalized.metaDescription || null,
        content: normalized.content,
        structured_facts: normalized.structuredFacts,
        content_hash: normalized.contentHash || hashWebsiteContentPage(normalized),
        status: "imported",
        error_code: null,
        js_fallback_used: normalized.jsFallbackUsed === true,
        page_index: index,
        content_length: normalized.content.length,
        imported_at: importedAt,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const importedUrlKeys = new Set(importedPages.map((page) => getCrawlUrlKey(page.page_url)));
  const failedRows = (Array.isArray(contentRecord.failedPages) ? contentRecord.failedPages : [])
    .map((page, index) => {
      const pageUrl = cleanText(page.url);

      if (!businessId || !pageUrl || importedUrlKeys.has(getCrawlUrlKey(pageUrl))) {
        return null;
      }

      return {
        business_id: businessId,
        import_job_id: importJobId || null,
        website_url: websiteUrl,
        page_url: pageUrl,
        page_title: null,
        meta_description: null,
        content: "",
        structured_facts: createEmptyStructuredFacts(),
        content_hash: hashWebsiteContentPage({ url: pageUrl, content: cleanText(page.code || page.errorCode) }),
        status: "failed",
        error_code: cleanText(page.code || page.errorCode || "crawl_failed").slice(0, 80),
        js_fallback_used: false,
        page_index: importedPages.length + index,
        content_length: 0,
        imported_at: importedAt,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const persistedUrlKeys = new Set([...importedUrlKeys, ...failedRows.map((page) => getCrawlUrlKey(page.page_url))]);
  const skippedRows = (Array.isArray(contentRecord.skippedPages) ? contentRecord.skippedPages : [])
    .map((page, index) => {
      const pageUrl = cleanText(page.url);

      if (!businessId || !pageUrl || persistedUrlKeys.has(getCrawlUrlKey(pageUrl))) {
        return null;
      }

      return {
        business_id: businessId,
        import_job_id: importJobId || null,
        website_url: websiteUrl,
        page_url: pageUrl,
        page_title: null,
        meta_description: null,
        content: "",
        structured_facts: createEmptyStructuredFacts(),
        content_hash: hashWebsiteContentPage({ url: pageUrl, content: cleanText(page.reason || "crawl_limit") }),
        status: "skipped",
        error_code: cleanText(page.reason || "crawl_limit").slice(0, 80),
        js_fallback_used: false,
        page_index: importedPages.length + failedRows.length + index,
        content_length: 0,
        imported_at: importedAt,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  return [...importedPages, ...failedRows, ...skippedRows];
}

function mapStoredWebsiteContentPage(row = {}, index = 0) {
  return normalizeWebsiteContentPage({
    url: row.page_url,
    pageTitle: row.page_title,
    metaDescription: row.meta_description,
    content: row.content,
    structuredFacts: row.structured_facts,
    status: row.status,
    errorCode: row.error_code,
    jsFallbackUsed: row.js_fallback_used,
    contentHash: row.content_hash,
    importedAt: row.imported_at,
  }, Number.isFinite(row.page_index) ? Number(row.page_index) : index);
}

async function replaceStoredWebsiteContentPages(supabase, contentRecord = {}) {
  const businessId = cleanText(contentRecord.businessId);
  const rows = buildWebsiteContentPageRows(contentRecord);

  if (!businessId || !supabase || typeof supabase.from !== "function") {
    return { ok: false, skipped: true, pageRows: 0 };
  }

  const baseDeleteQuery = supabase.from(WEBSITE_CONTENT_PAGES_TABLE);

  if (typeof baseDeleteQuery.delete !== "function") {
    return { ok: false, skipped: true, pageRows: 0 };
  }

  const deleteQuery = baseDeleteQuery
    .delete()
    .eq("business_id", businessId);
  const deleteResult = await deleteQuery;

  if (deleteResult.error) {
    if (isMissingRelationError(deleteResult.error, WEBSITE_CONTENT_PAGES_TABLE)) {
      return { ok: false, skipped: true, pageRows: 0 };
    }
    throw deleteResult.error;
  }

  if (!rows.length) {
    return { ok: true, pageRows: 0 };
  }

  const { error } = await supabase
    .from(WEBSITE_CONTENT_PAGES_TABLE)
    .upsert(rows, { onConflict: "business_id,page_url" });

  if (error) {
    if (isMissingRelationError(error, WEBSITE_CONTENT_PAGES_TABLE)) {
      return { ok: false, skipped: true, pageRows: 0 };
    }
    throw error;
  }

  return { ok: true, pageRows: rows.length };
}

export async function listStoredWebsiteContentPages(supabase, businessId) {
  const normalizedBusinessId = cleanText(businessId);

  if (!normalizedBusinessId || !supabase || typeof supabase.from !== "function") {
    return [];
  }

  let query = supabase
    .from(WEBSITE_CONTENT_PAGES_TABLE)
    .select(
      "business_id, import_job_id, website_url, page_url, page_title, meta_description, content, structured_facts, content_hash, status, error_code, js_fallback_used, page_index, content_length, imported_at, updated_at"
    )
    .eq("business_id", normalizedBusinessId);

  if (typeof query.order === "function") {
    query = query.order("page_index", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error, WEBSITE_CONTENT_PAGES_TABLE)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapStoredWebsiteContentPage);
}

function buildImportReportPageSamples({
  importedPages = [],
  failedPages = [],
  skippedPages = [],
} = {}) {
  return [
    ...importedPages.map((page) => ({
      url: cleanText(page.url),
      title: cleanText(page.pageTitle),
      status: "imported",
      contentLength: cleanText(page.content).length,
      structuredFactCount: getStructuredBusinessFactCount(page.structuredFacts),
      jsFallbackUsed: page.jsFallbackUsed === true,
    })),
    ...failedPages.map((page) => ({
      url: cleanText(page.url),
      title: "",
      status: "failed",
      errorCode: cleanText(page.code || page.errorCode || "crawl_failed"),
      contentLength: 0,
      structuredFactCount: 0,
      jsFallbackUsed: false,
    })),
    ...skippedPages.map((page) => ({
      url: cleanText(page.url),
      title: "",
      status: "skipped",
      errorCode: cleanText(page.reason || "crawl_limit"),
      contentLength: 0,
      structuredFactCount: 0,
      jsFallbackUsed: false,
    })),
  ].filter((page) => page.url).slice(0, 20);
}

export async function storeWebsiteContent(supabase, contentRecord) {
  const payload = {
    business_id: contentRecord.businessId,
    website_url: contentRecord.websiteUrl,
    page_title: contentRecord.pageTitle,
    meta_description: contentRecord.metaDescription,
    content: contentRecord.content,
    structured_facts: normalizeStructuredBusinessFacts(contentRecord.structuredFacts),
    crawled_urls: contentRecord.crawledUrls,
    page_count: contentRecord.pageCount,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(WEBSITE_CONTENT_TABLE)
    .upsert(payload, { onConflict: "business_id" });

  let finalError = error;

  if (isMissingStructuredFactsColumnError(finalError)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.structured_facts;
    const retry = await supabase
      .from(WEBSITE_CONTENT_TABLE)
      .upsert(legacyPayload, { onConflict: "business_id" });
    finalError = retry.error;
  }

  if (finalError) {
    console.error(finalError);

    if (finalError.code === "PGRST205") {
      const tableError = new Error(
        `Supabase table '${WEBSITE_CONTENT_TABLE}' was not found. Create it before storing crawled website content.`
      );
      tableError.statusCode = 500;
      throw tableError;
    }

    throw finalError;
  }

  await replaceStoredWebsiteContentPages(supabase, contentRecord);
}

export async function getStoredWebsiteContent(supabase, businessId) {
  let { data: content, error } = await supabase
    .from(WEBSITE_CONTENT_TABLE)
    .select(
      "business_id, website_url, page_title, meta_description, content, structured_facts, crawled_urls, page_count, updated_at"
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (isMissingStructuredFactsColumnError(error)) {
    const retry = await supabase
      .from(WEBSITE_CONTENT_TABLE)
      .select(
        "business_id, website_url, page_title, meta_description, content, crawled_urls, page_count, updated_at"
      )
      .eq("business_id", businessId)
      .maybeSingle();
    content = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error(error);
    throw error;
  }

  if (!content) {
    return null;
  }

  const storedPages = await listStoredWebsiteContentPages(supabase, businessId).catch(() => []);
  const parsedPages = parseWebsiteContentPages(content.content);
  const pages = storedPages.length ? storedPages : parsedPages;
  const importedPages = pages.filter((page) => cleanText(page.status || "imported") === "imported");
  const mediaAssets = extractStructuredMediaAssets(content.content);

  return {
    businessId: content.business_id,
    websiteUrl: content.website_url,
    pageTitle: content.page_title,
    metaDescription: content.meta_description,
    content: buildPlainWebsiteContent(content.content),
    rawContent: content.content,
    structuredFacts: normalizeStructuredBusinessFacts(content.structured_facts),
    mediaAssets,
    crawledUrls: content.crawled_urls || [],
    pageCount: content.page_count || importedPages.length || 0,
    pages,
    updatedAt: content.updated_at || null,
  };
}

export async function extractBusinessWebsiteContent(supabase, options = {}) {
  const business = await ensureBusinessRecord(supabase, options);
  const pageLimit = Number.isFinite(options.maxPages)
    ? Math.max(1, Math.min(Math.trunc(options.maxPages), 50))
    : getWebsiteImportMaxPages();
  let sitemapDiscovery;

  try {
    sitemapDiscovery = await discoverSitemapCrawlUrls(business.website_url, {
      ...options,
      maxPages: pageLimit,
      rootUrl: business.website_url,
    });
  } catch {
    sitemapDiscovery = {
      used: false,
      urls: [],
      rankedUrls: [],
      skippedUrls: [],
      discoveredUrlCount: 0,
      sitemapUrl: buildSitemapUrl(business.website_url),
      sitemapFileCount: 0,
    };
  }

  const sitemapUsed = sitemapDiscovery?.used === true && Array.isArray(sitemapDiscovery.urls) && sitemapDiscovery.urls.length > 0;
  const queue = sitemapUsed
    ? [...sitemapDiscovery.urls]
    : rankCrawlUrls([business.website_url], business.website_url);
  const visited = new Set();
  const discoveredUrls = new Set(queue);
  const pageResults = [];
  const failedPageResults = [];

  while (queue.length > 0 && pageResults.length < pageLimit) {
    const currentUrl = queue.shift();

    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const allowedHosts = [getUrlHostname(currentUrl)].filter(Boolean);
      const html = await fetchHtml(currentUrl, {
        ...options,
        rootUrl: business.website_url,
        allowedHosts,
      });
      const {
        html: extractedHtml,
        pageContent,
        jsFallbackUsed,
      } = await extractWebsitePageWithOptionalJsFallback(currentUrl, html, {
        ...options,
        rootUrl: business.website_url,
        allowedHosts,
      });

      pageResults.push({
        url: currentUrl,
        ...pageContent,
        jsFallbackUsed,
      });

      const links = sitemapUsed ? [] : extractInternalLinks(extractedHtml, currentUrl, business.website_url);
      for (const link of links) {
        discoveredUrls.add(link);
        if (!visited.has(link) && queue.length + pageResults.length < pageLimit * 3) {
          queue.push(link);
        }
      }
    } catch (error) {
      failedPageResults.push({
        url: currentUrl,
        code: error?.code || "crawl_failed",
      });
      console.error(`Failed to crawl ${currentUrl}:`, error.message);
    }
  }

  const combinedContent = pageResults
    .map((page) => ({
      ...page,
      content: buildPlainWebsiteContent(page.content),
    }))
    .map(buildWebsitePageContentBlock)
    .join("\n\n---\n\n")
    .slice(0, 20000)
    .trim();
  const combinedMediaAssets = pageResults.flatMap((page) => page.mediaAssets || []);
  const structuredFacts = mergeStructuredBusinessFacts(pageResults.map((page) => page.structuredFacts));
  const serializedMediaAssets = serializeMediaAssets(combinedMediaAssets);
  const persistedContent = [combinedContent, serializedMediaAssets].filter(Boolean).join("\n\n");
  const discoveredUrlList = sitemapUsed
    ? (Array.isArray(sitemapDiscovery.rankedUrls) && sitemapDiscovery.rankedUrls.length
      ? sitemapDiscovery.rankedUrls
      : sitemapDiscovery.urls || [])
    : [...discoveredUrls];
  const visitedKeys = new Set([...visited].map(getCrawlUrlKey));
  const skippedPageResults = discoveredUrlList
    .filter((url) => cleanText(url) && !visitedKeys.has(getCrawlUrlKey(url)))
    .slice(0, 50)
    .map((url) => ({
      url,
      reason: "crawl_limit",
    }));

  const combinedRecord =
    combinedContent && combinedContent.length >= 500
      ? {
          businessId: business.id,
          websiteUrl: business.website_url,
          pageTitle: pageResults[0]?.pageTitle || null,
          metaDescription: pageResults[0]?.metaDescription || null,
          content: persistedContent,
          mediaAssets: combinedMediaAssets,
          structuredFacts,
          crawledUrls: pageResults.map((page) => page.url),
          pageCount: pageResults.length,
          pages: pageResults.map(normalizeWebsiteContentPage),
          failedPages: failedPageResults,
          skippedPages: skippedPageResults,
          importJobId: cleanText(options.importJobId),
        }
      : buildFallbackContentRecord(business, pageResults);
  combinedRecord.failedPages = Array.isArray(combinedRecord.failedPages)
    ? combinedRecord.failedPages
    : failedPageResults;
  combinedRecord.skippedPages = Array.isArray(combinedRecord.skippedPages)
    ? combinedRecord.skippedPages
    : skippedPageResults;
  combinedRecord.importJobId = cleanText(combinedRecord.importJobId || options.importJobId);
  combinedRecord.importedAt = new Date().toISOString();
  const importedPages = pageResults.length;
  const attemptedPages = visited.size;
  const discoveredUrlCount = sitemapUsed
    ? Number(sitemapDiscovery.discoveredUrlCount || discoveredUrls.size)
    : discoveredUrls.size;
  const importReport = {
    discoveredUrlCount,
    attemptedPages,
    importedPages,
    failedPages: failedPageResults.length,
    skippedPages: Math.max(0, discoveredUrlCount - attemptedPages),
    contentLength: cleanText(combinedRecord.content).length,
    pageCount: importedPages,
    structuredFactCount: getStructuredBusinessFactCount(combinedRecord.structuredFacts),
    jsFallbackPages: pageResults.filter((page) => page.jsFallbackUsed).length,
    sitemapUsed,
    sitemapUrl: sitemapUsed ? sitemapDiscovery.sitemapUrl : "",
    sitemapFileCount: sitemapUsed ? Number(sitemapDiscovery.sitemapFileCount || 0) : 0,
    crawlLimit: pageLimit,
    discoveryMethod: sitemapUsed ? "sitemap" : "links",
    pageSamples: buildImportReportPageSamples({
      importedPages: pageResults,
      failedPages: failedPageResults,
      skippedPages: skippedPageResults,
    }),
  };
  combinedRecord.importReport = importReport;
  combinedRecord.pages = Array.isArray(combinedRecord.pages)
    ? combinedRecord.pages
    : parseWebsiteContentPages(combinedRecord.content);

  logScrapeMetadata("content_ready", {
    businessId: business.id,
    contentLength: combinedRecord.content.length,
    keptImageCount: extractImageUrlsFromContent(combinedRecord.content).length,
    pageCount: combinedRecord.pageCount,
    discoveredUrlCount,
  });

  await storeWebsiteContent(supabase, combinedRecord);

  return combinedRecord;
}

export async function scrapeAllBusinesses(supabase) {
  const { data: businesses, error } = await supabase
    .from(BUSINESSES_TABLE)
    .select("id, website_url")
    .not("website_url", "is", null);

  if (error) {
    console.error(error);
    throw error;
  }

  const results = [];

  for (const business of businesses || []) {
    if (!business.website_url) continue;

    try {
      const result = await extractBusinessWebsiteContent(supabase, {
        businessId: business.id,
      });
      results.push({
        businessId: result.businessId,
        websiteUrl: result.websiteUrl,
        pageTitle: result.pageTitle,
        pageCount: result.pageCount,
        crawledUrls: result.crawledUrls,
        contentLength: result.content.length,
      });
    } catch (err) {
      results.push({
        businessId: business.id,
        websiteUrl: business.website_url,
        error: err.message || "Something went wrong",
      });
    }
  }

  return {
    totalBusinesses: results.length,
    results,
  };
}
