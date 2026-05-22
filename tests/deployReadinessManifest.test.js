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
import {
  evaluateDeployReadinessManifest,
  extractBundleSourceFiles,
  getDeployRateLimitReadiness,
  getMissingDeployReadinessEnvVars,
  readRepoFile,
} from "../scripts/lib/deployReadiness.js";

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
    "STRIPE_PRICE_ID_STARTER_MONTHLY",
    "STRIPE_PRICE_ID_GROWTH_MONTHLY",
    "STRIPE_PRICE_ID_PRO_MONTHLY",
  ]);
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
    STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro",
  });

  assert.equal(readiness.ok, false);
  assert.deepEqual(readiness.missing, [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
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
  });

  assert.equal(readiness.ok, true);
  assert.deepEqual(readiness.missing, []);
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
