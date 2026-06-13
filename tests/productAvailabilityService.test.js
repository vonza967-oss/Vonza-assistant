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
import {
  getProductCatalogEntry,
  listProductCatalog,
} from "../src/config/productCatalog.js";
import {
  PRODUCT_ENTITLEMENT_REASON_CODES,
  listOwnerProductEntitlements,
} from "../src/services/entitlements/productEntitlementService.js";

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

function createReadOnlyEntitlementSupabase(rows = []) {
  const calls = [];
  const mutations = [];

  return {
    calls,
    mutations,
    from(tableName) {
      calls.push({ method: "from", tableName });

      return {
        select(columns) {
          calls.push({ method: "select", tableName, columns });
          return this;
        },
        eq(field, value) {
          calls.push({ method: "eq", tableName, field, value });
          return this;
        },
        insert(payload) {
          mutations.push({ method: "insert", tableName, payload });
          return this;
        },
        update(payload) {
          mutations.push({ method: "update", tableName, payload });
          return this;
        },
        delete() {
          mutations.push({ method: "delete", tableName });
          return this;
        },
        then(resolve, reject) {
          try {
            return resolve({ data: rows, error: null });
          } catch (error) {
            return reject(error);
          }
        },
      };
    },
  };
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

test("static product catalog exposes labels setup URLs and future price env names only", () => {
  const catalog = listProductCatalog();

  assert.deepEqual(
    catalog.map((product) => product.key),
    [PRODUCT_KEYS.FRONT_DESK, PRODUCT_KEYS.WEBSITE_WIDGET, PRODUCT_KEYS.VOICE_AGENT]
  );
  assert.deepEqual(
    catalog.map((product) => product.label),
    ["Front Desk", "Website Agent", "Voice Agent"]
  );
  assert.deepEqual(
    catalog.map((product) => product.setupUrl),
    ["/dashboard/front-desk", "/dashboard/widget", "/dashboard/voice"]
  );
  assert.deepEqual(
    catalog.map((product) => product.futurePriceEnvVarNames.monthly),
    [
      "STRIPE_PRICE_ID_FRONT_DESK_MONTHLY",
      "STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY",
      "STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY",
    ]
  );
  assert.doesNotMatch(JSON.stringify(catalog), /checkoutUrl|checkout_url|hostedCheckout|buyUrl/i);
});

test("product catalog entries are defensive copies", () => {
  const first = getProductCatalogEntry(PRODUCT_KEYS.FRONT_DESK);
  first.capabilities.push("mutated");
  first.futurePriceEnvVarNames.monthly = "mutated";

  const second = getProductCatalogEntry(PRODUCT_KEYS.FRONT_DESK);

  assert.equal(second.futurePriceEnvVarNames.monthly, "STRIPE_PRICE_ID_FRONT_DESK_MONTHLY");
  assert.doesNotMatch(second.capabilities.join(","), /mutated/);
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
  assert.doesNotMatch(source, /Buy Voice Agent|Buy Website Agent|Buy Front Desk|data-product-checkout/i);

  products.forEach((product) => {
    assert.equal(Object.hasOwn(product, "checkout_url"), false);
    assert.doesNotMatch(product.upgrade_url || "", /checkout|stripe|voice-agent|website-widget|front-desk/i);
  });
});

test("owner product entitlement lookup reads rows and returns all three products", async () => {
  const supabase = createReadOnlyEntitlementSupabase([
    {
      id: "entitlement-1",
      owner_user_id: "owner-1",
      product_key: PRODUCT_KEYS.FRONT_DESK,
      entitlement_status: "active",
      source: "manual_beta",
      feature_caps: { seats: 1 },
      metadata: { note: "test" },
    },
  ]);

  const products = await listOwnerProductEntitlements(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
  });

  assert.deepEqual(
    products.map((product) => product.product_key),
    [PRODUCT_KEYS.FRONT_DESK, PRODUCT_KEYS.WEBSITE_WIDGET, PRODUCT_KEYS.VOICE_AGENT]
  );
  assert.equal(supabase.calls[0].tableName, "owner_product_entitlements");
  assert.deepEqual(
    supabase.calls.find((call) => call.method === "eq"),
    {
      method: "eq",
      tableName: "owner_product_entitlements",
      field: "owner_user_id",
      value: "owner-1",
    }
  );
  assert.deepEqual(supabase.mutations, []);
  products.forEach((product) => {
    assertAvailabilityShape(product);
    assert.equal(product.is_enforced, false);
  });
});

test("grandfathered entitlement rows map to available read-only product state", async () => {
  const supabase = createReadOnlyEntitlementSupabase([
    {
      id: "entitlement-legacy",
      owner_user_id: "owner-1",
      product_key: PRODUCT_KEYS.VOICE_AGENT,
      entitlement_status: "grandfathered",
      source: "legacy_workspace_plan",
      plan_key: "starter",
      current_period_end: "2026-06-30T00:00:00.000Z",
      feature_caps: { calls: "legacy" },
      metadata: { phase: "6a_read_only_entitlement_backfill" },
    },
  ]);

  const products = await listOwnerProductEntitlements(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
  });
  const voice = products.find((product) => product.product_key === PRODUCT_KEYS.VOICE_AGENT);

  assertAvailabilityShape(voice);
  assert.equal(voice.status, AVAILABILITY_STATUSES.AVAILABLE);
  assert.equal(voice.reason_code, PRODUCT_ENTITLEMENT_REASON_CODES.GRANDFATHERED);
  assert.equal(voice.entitlement_status, "grandfathered");
  assert.equal(voice.entitlement_source, "legacy_workspace_plan");
  assert.equal(voice.entitlement_row_exists, true);
  assert.equal(voice.status_source, "owner_product_entitlements");
  assert.equal(voice.entitlement.plan_key, "starter");
  assert.equal(voice.entitlement.current_period_end, "2026-06-30T00:00:00.000Z");
  assert.equal(Object.hasOwn(voice.entitlement, "owner_user_id"), false);
});

test("missing entitlement rows keep current non-enforcing fallback availability", async () => {
  const supabase = createReadOnlyEntitlementSupabase([]);
  const products = await listOwnerProductEntitlements(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
    billingSnapshot: {
      usage: {
        isCapped: false,
      },
    },
  });

  products.forEach((product) => {
    assertAvailabilityShape(product);
    assert.equal(product.status, AVAILABILITY_STATUSES.AVAILABLE);
    assert.equal(product.reason_code, REASON_CODES.ACCOUNT_ACCESS_ACTIVE);
    assert.equal(product.entitlement_status, "missing");
    assert.equal(product.entitlement_source, "account_access_fallback");
    assert.equal(product.entitlement_row_exists, false);
    assert.equal(product.status_source, "account_access_fallback");
    assert.equal(product.entitlement, null);
    assert.equal(product.is_enforced, false);
  });
});

test("read-only entitlement rows never become enforcing access gates", async () => {
  const supabase = createReadOnlyEntitlementSupabase([
    {
      id: "entitlement-inactive",
      owner_user_id: "owner-1",
      product_key: PRODUCT_KEYS.WEBSITE_WIDGET,
      entitlement_status: "inactive",
      source: "manual_free",
    },
  ]);

  const products = await listOwnerProductEntitlements(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
  });
  const widget = products.find((product) => product.product_key === PRODUCT_KEYS.WEBSITE_WIDGET);
  const frontDesk = products.find((product) => product.product_key === PRODUCT_KEYS.FRONT_DESK);

  assert.equal(widget.status, AVAILABILITY_STATUSES.UNAVAILABLE);
  assert.equal(widget.reason_code, PRODUCT_ENTITLEMENT_REASON_CODES.INACTIVE);
  assert.equal(widget.is_enforced, false);
  assert.equal(frontDesk.status, AVAILABILITY_STATUSES.AVAILABLE);
  assert.equal(frontDesk.entitlement_row_exists, false);
  products.forEach((product) => {
    assert.equal(product.is_enforced, false);
  });
});

test("product entitlement service is read-only and has no checkout controls", () => {
  const servicePath = path.join(
    repoRoot,
    "src",
    "services",
    "entitlements",
    "productEntitlementService.js"
  );
  const source = readFileSync(servicePath, "utf8");

  assert.match(source, /OWNER_PRODUCT_ENTITLEMENT_TABLE/);
  assert.match(source, /\.select\(ENTITLEMENT_SELECT\)/);
  assert.match(source, /\.eq\("owner_user_id", ownerUserId\)/);
  assert.doesNotMatch(source, /stripe|checkoutService|webhook|createCheckout|\/billing\/checkout/i);
  assert.doesNotMatch(source, /from\s+["'].*routes|from\s+["'].*chat|from\s+["'].*voice|from\s+["'].*phone/i);
  assert.doesNotMatch(source, /insert\(|update\(|delete\(|upsert\(/i);
  assert.doesNotMatch(source, /Buy Voice Agent|Buy Website Agent|Buy Front Desk|data-product-checkout|checkout_url/i);
});
