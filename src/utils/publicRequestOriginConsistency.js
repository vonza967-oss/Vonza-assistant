import { cleanText } from "./text.js";

const SAFE_ORIGIN_REJECTION_MESSAGE = "Request origin is not allowed.";
const ORIGIN_HEADER_NAMES = Object.freeze(["origin"]);
const REFERRER_HEADER_NAMES = Object.freeze(["referer", "referrer"]);
const PUBLIC_REQUEST_ORIGIN_CODES = new Set([
  "origin_claim_mismatch",
  "request_origin_mismatch",
]);

function normalizeHttpOrigin(value) {
  const rawValue = cleanText(value);

  if (!rawValue || rawValue.toLowerCase() === "null") {
    return "";
  }

  try {
    const url = new URL(rawValue);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.origin.toLowerCase();
  } catch {
    return "";
  }
}

function readHeader(req, headerName) {
  if (typeof req?.get === "function") {
    return cleanText(req.get(headerName));
  }

  const headers = req?.headers || {};
  return cleanText(headers[headerName.toLowerCase()] || headers[headerName]);
}

function readRequestHeaderOrigins(req) {
  return [
    ...ORIGIN_HEADER_NAMES.map((name) => ({
      header: name,
      origin: normalizeHttpOrigin(readHeader(req, name)),
    })),
    ...REFERRER_HEADER_NAMES.map((name) => ({
      header: name,
      origin: normalizeHttpOrigin(readHeader(req, name)),
    })),
  ].filter((entry) => entry.origin);
}

function buildRejectedResult(code, details = {}) {
  return {
    ok: false,
    status: 403,
    code,
    message: SAFE_ORIGIN_REJECTION_MESSAGE,
    ...details,
  };
}

export function checkPublicRequestOriginConsistency(req, {
  origin,
  pageUrl,
  page_url: pageUrlSnake,
  publicAppOrigin,
} = {}) {
  const claimedOrigin = normalizeHttpOrigin(origin);
  const claimedPageOrigin = normalizeHttpOrigin(pageUrl || pageUrlSnake);
  const normalizedPublicAppOrigin = normalizeHttpOrigin(publicAppOrigin);
  const requestOrigins = readRequestHeaderOrigins(req);
  const claimedOrigins = [claimedOrigin, claimedPageOrigin].filter(Boolean);

  if (
    claimedOrigin
    && claimedPageOrigin
    && claimedOrigin !== claimedPageOrigin
  ) {
    return buildRejectedResult("origin_claim_mismatch", {
      claimedOrigin,
      claimedPageOrigin,
      publicAppOrigin: normalizedPublicAppOrigin,
      requestOrigins,
    });
  }

  if (!claimedOrigins.length || !requestOrigins.length) {
    return {
      ok: true,
      claimedOrigin,
      claimedPageOrigin,
      publicAppOrigin: normalizedPublicAppOrigin,
      requestOrigins,
    };
  }

  for (const requestOrigin of requestOrigins) {
    if (
      normalizedPublicAppOrigin
      && requestOrigin.origin === normalizedPublicAppOrigin
    ) {
      continue;
    }

    if (claimedOrigins.includes(requestOrigin.origin)) {
      continue;
    }

    return buildRejectedResult("request_origin_mismatch", {
      claimedOrigin,
      claimedPageOrigin,
      publicAppOrigin: normalizedPublicAppOrigin,
      requestOrigin,
      requestOrigins,
    });
  }

  return {
    ok: true,
    claimedOrigin,
    claimedPageOrigin,
    publicAppOrigin: normalizedPublicAppOrigin,
    requestOrigins,
  };
}

export function createPublicRequestOriginConsistencyError(result = {}) {
  const error = new Error(SAFE_ORIGIN_REJECTION_MESSAGE);
  error.statusCode = Number(result.status || 403);
  error.code = PUBLIC_REQUEST_ORIGIN_CODES.has(result.code)
    ? result.code
    : "request_origin_mismatch";
  error.publicMessage = SAFE_ORIGIN_REJECTION_MESSAGE;
  return error;
}

export function assertPublicRequestOriginConsistency(req, options = {}) {
  const result = checkPublicRequestOriginConsistency(req, options);

  if (!result.ok) {
    throw createPublicRequestOriginConsistencyError(result);
  }

  return result;
}

export function isPublicRequestOriginConsistencyError(error) {
  return PUBLIC_REQUEST_ORIGIN_CODES.has(cleanText(error?.code));
}
