import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVAILABILITY_STATUSES,
  PRODUCT_KEYS,
  REASON_CODES,
  getProductAvailability,
  listProductAvailability,
  normalizeProductKey,
} from "../src/services/entitlements/productAvailabilityService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function assertAvailabilityShape(result) {
  assert.equal(typeof result.product_key, "string");
  assert.equal(typeof result.status, "string");
  assert.equal(typeof result.label, "string");
  assert.equal(typeof result.reason_code, "string");
  assert.equal(result.is_enforced, false);
  assert.equal(Object.hasOwn(result, "setup_url"), true);
  assert.equal(Object.hasOwn(result, "upgrade_url"), true);
  assert.equal(Array.isArray(result.capabilities), true);
  assert.equal(Object.hasOwn(result, "checkout_url"), false);
}

test("normalizeProductKey handles canonical keys and reasonable aliases", () => {
  assert.equal(normalizeProductKey("front_desk"), PRODUCT_KEYS.FRONT_DESK);
  assert.equal(normalizeProductKey("front-desk"), PRODUCT_KEYS.FRONT_DESK);
  assert.equal(normalizeProductKey("Front Desk"), PRODUCT_KEYS.FRONT_DESK);
  assert.equal(normalizeProductKey("full page"), PRODUCT_KEYS.FRONT_DESK);

  assert.equal(normalizeProductKey("website_widget"), PRODUCT_KEYS.WEBSITE_WIDGET);
  assert.equal(normalizeProductKey("website-widget"), PRODUCT_KEYS.WEBSITE_WIDGET);
  assert.equal(normalizeProductKey("widget"), PRODUCT_KEYS.WEBSITE_WIDGET);
  assert.equal(normalizeProductKey("embed"), PRODUCT_KEYS.WEBSITE_WIDGET);

  assert.equal(normalizeProductKey("voice_agent"), PRODUCT_KEYS.VOICE_AGENT);
  assert.equal(normalizeProductKey("voice-agent"), PRODUCT_KEYS.VOICE_AGENT);
  assert.equal(normalizeProductKey("voice"), PRODUCT_KEYS.VOICE_AGENT);
  assert.equal(normalizeProductKey("phone"), PRODUCT_KEYS.VOICE_AGENT);

  assert.equal(normalizeProductKey("unknown-product"), "");
});

test("getProductAvailability returns available for active accounts that are not capped", () => {
  const result = getProductAvailability({
    productKey: "front_desk",
    accessStatus: "active",
    usage: {
      isCapped: false,
    },
  });

  assertAvailabilityShape(result);
  assert.equal(result.product_key, PRODUCT_KEYS.FRONT_DESK);
  assert.equal(result.status, AVAILABILITY_STATUSES.AVAILABLE);
  assert.equal(result.label, "Front Desk");
  assert.equal(result.reason_code, REASON_CODES.ACCOUNT_ACCESS_ACTIVE);
  assert.equal(result.setup_url, "/dashboard/front-desk");
  assert.equal(result.upgrade_url, "/dashboard#settings/account-billing");
  assert.ok(result.capabilities.includes("public_front_desk_page"));
});

test("pending account access maps to pending_account_access", () => {
  const result = getProductAvailability({
    productKey: "website_widget",
    account: {
      access_status: "pending",
    },
  });

  assertAvailabilityShape(result);
  assert.equal(result.product_key, PRODUCT_KEYS.WEBSITE_WIDGET);
  assert.equal(result.status, AVAILABILITY_STATUSES.PENDING_ACCOUNT_ACCESS);
  assert.equal(result.reason_code, REASON_CODES.ACCOUNT_ACCESS_PENDING);
  assert.equal(result.setup_url, "/dashboard/widget");
  assert.equal(result.is_enforced, false);
});

test("suspended account access maps to unavailable", () => {
  const result = getProductAvailability({
    productKey: "voice_agent",
    agent: {
      accessStatus: "suspended",
    },
  });

  assertAvailabilityShape(result);
  assert.equal(result.product_key, PRODUCT_KEYS.VOICE_AGENT);
  assert.equal(result.status, AVAILABILITY_STATUSES.UNAVAILABLE);
  assert.equal(result.reason_code, REASON_CODES.ACCOUNT_ACCESS_SUSPENDED);
  assert.equal(result.setup_url, "/dashboard/voice");
  assert.equal(result.is_enforced, false);
});

test("capped account usage maps to non-enforcing unavailable availability", () => {
  const input = {
    productKey: "widget",
    accessStatus: "active",
    billingSnapshot: {
      usage: {
        isCapped: true,
      },
    },
  };
  const originalInput = structuredClone(input);
  const result = getProductAvailability(input);

  assertAvailabilityShape(result);
  assert.deepEqual(input, originalInput);
  assert.equal(result.product_key, PRODUCT_KEYS.WEBSITE_WIDGET);
  assert.equal(result.status, AVAILABILITY_STATUSES.UNAVAILABLE);
  assert.equal(result.reason_code, REASON_CODES.ACCOUNT_CAPACITY_CAPPED);
  assert.equal(result.is_enforced, false);
});

test("unknown product maps to unknown without setup or checkout controls", () => {
  const result = getProductAvailability({
    productKey: "fax-machine",
    accessStatus: "active",
  });

  assertAvailabilityShape(result);
  assert.equal(result.product_key, "fax-machine");
  assert.equal(result.status, AVAILABILITY_STATUSES.UNKNOWN);
  assert.equal(result.label, "Unknown product");
  assert.equal(result.reason_code, REASON_CODES.PRODUCT_KEY_UNKNOWN);
  assert.equal(result.setup_url, null);
  assert.equal(result.upgrade_url, null);
  assert.deepEqual(result.capabilities, []);
});

test("listProductAvailability returns all three products", () => {
  const products = listProductAvailability({
    access_status: "active",
    usage: {
      is_capped: false,
    },
  });

  assert.deepEqual(
    products.map((product) => product.product_key),
    [PRODUCT_KEYS.FRONT_DESK, PRODUCT_KEYS.WEBSITE_WIDGET, PRODUCT_KEYS.VOICE_AGENT]
  );
  assert.deepEqual(
    products.map((product) => product.setup_url),
    ["/dashboard/front-desk", "/dashboard/widget", "/dashboard/voice"]
  );
  products.forEach((product) => {
    assertAvailabilityShape(product);
    assert.equal(product.status, AVAILABILITY_STATUSES.AVAILABLE);
    assert.equal(product.is_enforced, false);
  });
});

test("dashboard account availability contract uses existing access and billing snapshot inputs", () => {
  const products = listProductAvailability({
    agent: {
      accessStatus: "active",
    },
    billingSnapshot: {
      planKey: "starter",
      usage: {
        isCapped: false,
      },
    },
  });

  assert.deepEqual(
    products.map((product) => product.product_key),
    [PRODUCT_KEYS.FRONT_DESK, PRODUCT_KEYS.WEBSITE_WIDGET, PRODUCT_KEYS.VOICE_AGENT]
  );
  products.forEach((product) => {
    assertAvailabilityShape(product);
    assert.equal(product.status, AVAILABILITY_STATUSES.AVAILABLE);
    assert.equal(product.reason_code, REASON_CODES.ACCOUNT_ACCESS_ACTIVE);
    assert.equal(product.is_enforced, false);
    assert.equal(Object.hasOwn(product, "checkout_url"), false);
  });
});

test("every status path remains non-enforcing", () => {
  const products = [
    getProductAvailability({ productKey: "front_desk", accessStatus: "active" }),
    getProductAvailability({ productKey: "website_widget", accessStatus: "pending" }),
    getProductAvailability({ productKey: "voice_agent", accessStatus: "suspended" }),
    getProductAvailability({ productKey: "voice_agent", accessStatus: "active", isCapped: true }),
    getProductAvailability({ productKey: "other", accessStatus: "active" }),
  ];

  products.forEach((product) => {
    assert.equal(product.is_enforced, false);
  });
});

test("service does not introduce product-specific checkout or enforcement wiring", () => {
  const servicePath = path.join(
    repoRoot,
    "src",
    "services",
    "entitlements",
    "productAvailabilityService.js"
  );
  const source = readFileSync(servicePath, "utf8");
  const products = listProductAvailability({ accessStatus: "active" });

  assert.doesNotMatch(source, /stripe|checkoutService|webhook|createCheckout|\/billing\/checkout/i);
  assert.doesNotMatch(source, /from\s+["'].*routes|from\s+["'].*chat|from\s+["'].*voice|from\s+["'].*phone/i);
  assert.doesNotMatch(source, /supabase|\.from\(["'`]|insert\(|update\(|delete\(/i);
  assert.doesNotMatch(source, /Buy Voice Agent|Buy Website Widget|Buy Front Desk|data-product-checkout/i);

  products.forEach((product) => {
    assert.equal(Object.hasOwn(product, "checkout_url"), false);
    assert.doesNotMatch(product.upgrade_url || "", /checkout|stripe|voice-agent|website-widget|front-desk/i);
  });
});
