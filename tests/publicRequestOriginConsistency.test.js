import test from "node:test";
import assert from "node:assert/strict";

import {
  checkPublicRequestOriginConsistency,
} from "../src/utils/publicRequestOriginConsistency.js";

function makeReq(headers = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    headers: normalizedHeaders,
    get(name) {
      return normalizedHeaders[String(name || "").toLowerCase()];
    },
  };
}

test("public request origin consistency allows matching claimed and header origins", () => {
  const result = checkPublicRequestOriginConsistency(makeReq({
    Origin: "https://allowed.example",
    Referer: "https://allowed.example/pricing",
  }), {
    origin: "https://allowed.example",
    pageUrl: "https://allowed.example/pricing",
    publicAppOrigin: "https://app.vonza.example",
  });

  assert.equal(result.ok, true);
  assert.equal(result.claimedOrigin, "https://allowed.example");
  assert.equal(result.claimedPageOrigin, "https://allowed.example");
});

test("public request origin consistency allows missing, null, and privacy-stripped headers", () => {
  for (const headers of [
    {},
    { Origin: "null" },
    { Referer: "about:client" },
    { Origin: "not a url" },
  ]) {
    const result = checkPublicRequestOriginConsistency(makeReq(headers), {
      origin: "https://allowed.example",
      pageUrl: "https://allowed.example/page",
      publicAppOrigin: "https://app.vonza.example",
    });

    assert.equal(result.ok, true, JSON.stringify(headers));
  }
});

test("public request origin consistency allows Vonza public app origin bridge headers", () => {
  const result = checkPublicRequestOriginConsistency(makeReq({
    Origin: "https://app.vonza.example",
  }), {
    origin: "https://customer.example",
    pageUrl: "https://customer.example/services",
    publicAppOrigin: "https://app.vonza.example",
  });

  assert.equal(result.ok, true);
});

test("public request origin consistency rejects claimed origin and page URL mismatch", () => {
  const result = checkPublicRequestOriginConsistency(makeReq({}), {
    origin: "https://allowed.example",
    pageUrl: "https://other.example/pricing",
    publicAppOrigin: "https://app.vonza.example",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, "origin_claim_mismatch");
});

test("public request origin consistency rejects non-app conflicting header origin", () => {
  const result = checkPublicRequestOriginConsistency(makeReq({
    Origin: "https://evil.example",
  }), {
    origin: "https://allowed.example",
    pageUrl: "https://allowed.example/pricing",
    publicAppOrigin: "https://app.vonza.example",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, "request_origin_mismatch");
});

test("public request origin consistency handles invalid claimed inputs safely", () => {
  const result = checkPublicRequestOriginConsistency(makeReq({
    Origin: "https://customer.example",
  }), {
    origin: "::::",
    pageUrl: "not a url",
    publicAppOrigin: "https://app.vonza.example",
  });

  assert.equal(result.ok, true);
  assert.equal(result.claimedOrigin, "");
  assert.equal(result.claimedPageOrigin, "");
});
