import test from "node:test";
import assert from "node:assert/strict";

import {
  DEPLOY_READINESS_DOCS,
  FEATURE_GATED_MIGRATION_IDS,
  getManifestMigrationFiles,
  OPERATOR_ONLY_MIGRATION_IDS,
  STARTUP_CRITICAL_MIGRATION_IDS,
  STARTUP_SCHEMA_CHECKS,
} from "../src/services/schema/deployReadinessManifest.js";
import { listBillingPlans } from "../src/config/billingPlans.js";
import { verifyConfiguredStripePlanPrices } from "../src/services/billing/stripePriceVerificationService.js";
import {
  evaluateDeployReadinessManifest,
  extractBundleSourceFiles,
  getDeployRateLimitReadiness,
  getMissingDeployReadinessEnvVars,
  readRepoFile,
  runDeployReadinessVerification,
} from "../scripts/lib/deployReadiness.js";

function buildStripePriceEnv() {
  return Object.fromEntries(
    listBillingPlans().map((plan) => [plan.stripePriceEnvKey, `price_${plan.key}`])
  );
}

function buildDeployReadinessEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    PUBLIC_APP_URL: "https://app.example",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    BOOKING_WEBHOOK_ENCRYPTION_SECRET: "booking-secret",
    RATE_LIMIT_BACKEND: "upstash",
    UPSTASH_REDIS_REST_URL: "https://allowed-upstash-url.example",
    UPSTASH_REDIS_REST_TOKEN: "token-present",
    TRUSTED_PROXY_IPS: "127.0.0.1",
    ...buildStripePriceEnv(),
    ...overrides,
  };
}

function buildStripePrice(plan, overrides = {}) {
  return {
    id: `price_${plan.key}`,
    active: true,
    currency: "huf",
    type: "recurring",
    unit_amount: plan.monthlyPriceHuf,
    recurring: {
      interval: "month",
      interval_count: 1,
      ...(overrides.recurring || {}),
    },
    ...overrides,
  };
}

function buildFakeStripe({ overridesByPlan = {}, failuresByPlan = {} } = {}) {
  const plans = listBillingPlans();
  const pricesById = new Map(
    plans.map((plan) => [
      `price_${plan.key}`,
      buildStripePrice(plan, overridesByPlan[plan.key] || {}),
    ])
  );
  const failuresById = new Map(
    Object.entries(failuresByPlan).map(([planKey, error]) => [`price_${planKey}`, error])
  );

  return {
    prices: {
      async retrieve(priceId) {
        if (failuresById.has(priceId)) {
          throw failuresById.get(priceId);
        }
        return pricesById.get(priceId);
      },
    },
  };
}

test("startup recovery bundle order matches manifest and startup validators", () => {
  const startupBundleSources = extractBundleSourceFiles(readRepoFile(DEPLOY_READINESS_DOCS.startupBundle));
  const expectedSources = getManifestMigrationFiles(STARTUP_CRITICAL_MIGRATION_IDS);
  const validatorSources = [...new Set(STARTUP_SCHEMA_CHECKS.flatMap((check) => getManifestMigrationFiles(check.migrationIds)))];

  assert.deepEqual(startupBundleSources, expectedSources);
  assert.deepEqual(validatorSources, expectedSources);
});

test("feature-gated and operator-only migrations stay outside startup-critical rollout", () => {
  const startupSet = new Set(STARTUP_CRITICAL_MIGRATION_IDS);

  FEATURE_GATED_MIGRATION_IDS.forEach((migrationId) => {
    assert.equal(startupSet.has(migrationId), false, `${migrationId} should not be startup-critical`);
  });

  OPERATOR_ONLY_MIGRATION_IDS.forEach((migrationId) => {
    assert.equal(startupSet.has(migrationId), false, `${migrationId} should not be startup-critical`);
  });
});

test("deploy readiness manifest remains internally consistent", () => {
  assert.deepEqual(evaluateDeployReadinessManifest(), []);
});

test("deploy readiness requires Stripe plan prices for staging and production deploys", () => {
  const missingNames = getMissingDeployReadinessEnvVars({
    NODE_ENV: "production",
    PUBLIC_APP_URL: "https://app.example",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
  }).map((entry) => entry.name);

  assert.deepEqual(missingNames, [
    "BOOKING_WEBHOOK_ENCRYPTION_SECRET",
    "STRIPE_PRICE_ID_STARTER_MONTHLY",
    "STRIPE_PRICE_ID_GROWTH_MONTHLY",
    "STRIPE_PRICE_ID_PRO_MONTHLY",
  ]);
});

test("Stripe HUF monthly price verification accepts active configured plan prices", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.deepEqual(
    result.checked.map((entry) => entry.planKey),
    ["starter", "growth", "pro"]
  );
});

test("Stripe HUF monthly price verification skips local runs without injected Stripe client", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: {
      NODE_ENV: "development",
      STRIPE_SECRET_KEY: "sk_test_local",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.reason, /skipped outside staging\/production/i);
});

test("deploy readiness runs Stripe HUF price verification with injected Stripe client", async () => {
  const logs = [];

  await runDeployReadinessVerification({
    env: buildDeployReadinessEnv(),
    logger: { log: (message) => logs.push(message) },
    stripe: buildFakeStripe(),
    verifyLiveStartupSchemaImpl: async () => ({
      skipped: true,
      reason: "test skip",
    }),
  });

  assert.ok(logs.includes("Stripe HUF monthly prices: OK"));
});

test("Stripe HUF monthly price verification rejects USD prices", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      overridesByPlan: {
        starter: { currency: "usd" },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'starter' \(STRIPE_PRICE_ID_STARTER_MONTHLY\): currency must be huf\./.test(issue)
  ));
});

test("Stripe HUF monthly price verification rejects one-time prices", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      overridesByPlan: {
        growth: { type: "one_time", recurring: null },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'growth' \(STRIPE_PRICE_ID_GROWTH_MONTHLY\): type must be recurring\./.test(issue)
  ));
});

test("Stripe HUF monthly price verification rejects yearly prices", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      overridesByPlan: {
        pro: { recurring: { interval: "year", interval_count: 1 } },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'pro' \(STRIPE_PRICE_ID_PRO_MONTHLY\): recurring interval must be month\./.test(issue)
  ));
});

test("Stripe HUF monthly price verification rejects wrong HUF amounts", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      overridesByPlan: {
        starter: { unit_amount: 19800 },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'starter' \(STRIPE_PRICE_ID_STARTER_MONTHLY\): unit_amount must be 19900\./.test(issue)
  ));
});

test("Stripe HUF monthly price verification rejects inactive prices", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      overridesByPlan: {
        growth: { active: false },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'growth' \(STRIPE_PRICE_ID_GROWTH_MONTHLY\): price must be active\./.test(issue)
  ));
});

test("Stripe HUF monthly price verification sanitizes API failures", async () => {
  const result = await verifyConfiguredStripePlanPrices({
    env: buildDeployReadinessEnv(),
    stripe: buildFakeStripe({
      failuresByPlan: {
        pro: new Error("Stripe secret sk_test_should_not_leak for price_pro"),
      },
    }),
  });
  const serialized = JSON.stringify(result.issues);

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    /plan 'pro' \(STRIPE_PRICE_ID_PRO_MONTHLY\): Stripe API request failed\./.test(issue)
  ));
  assert.doesNotMatch(serialized, /sk_test_should_not_leak|price_pro/);
});

test("deploy readiness reports missing distributed rate limiter config in production", () => {
  const readiness = getDeployRateLimitReadiness({
    NODE_ENV: "production",
    PUBLIC_APP_URL: "https://app.example",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    BOOKING_WEBHOOK_ENCRYPTION_SECRET: "booking-secret",
    STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro",
  });

  assert.equal(readiness.ok, false);
  assert.deepEqual(readiness.missing, [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
  assert.equal(readiness.trustedProxyConfigured, false);
  assert.ok(readiness.warnings.some((warning) => /TRUSTED_PROXY_IPS is not set/i.test(warning)));
  assert.match(
    readiness.message,
    /Distributed rate limiting is required in production\. Missing: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN\./
  );
});

test("deploy readiness accepts configured distributed rate limiter aliases", () => {
  const readiness = getDeployRateLimitReadiness({
    NODE_ENV: "production",
    RATE_LIMIT_BACKEND: "redis",
    REDIS_URL: "https://allowed-upstash-url.example",
    REDIS_TOKEN: "token-present",
    TRUSTED_PROXY_IPS: "10.0.0.1",
  });

  assert.equal(readiness.ok, true);
  assert.deepEqual(readiness.missing, []);
  assert.deepEqual(readiness.warnings, []);
  assert.equal(readiness.trustedProxyConfigured, true);
});

test("Google deploy env vars are required only when operator workspace is explicitly enabled", () => {
  const baseEnv = {
    VONZA_DEPLOY_ENV: "staging",
    PUBLIC_APP_URL: "https://app.example",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    BOOKING_WEBHOOK_ENCRYPTION_SECRET: "booking-secret",
    STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro",
  };

  assert.deepEqual(getMissingDeployReadinessEnvVars(baseEnv), []);

  const missingNames = getMissingDeployReadinessEnvVars({
    ...baseEnv,
    VONZA_OPERATOR_WORKSPACE_V1: "true",
  }).map((entry) => entry.name);

  assert.deepEqual(missingNames, [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_OAUTH_REDIRECT_URI",
    "GOOGLE_TOKEN_ENCRYPTION_SECRET",
  ]);
});
