import test from "node:test";
import assert from "node:assert/strict";

import { getReadinessStatus } from "../src/services/operations/readinessService.js";

function createReadySupabase() {
  return {
    from(tableName) {
      assert.equal(tableName, "businesses");
      return {
        select() {
          return this;
        },
        async limit() {
          return { data: [], error: null };
        },
      };
    },
  };
}

test("readiness status reports all dependency checks when healthy", async () => {
  const result = await getReadinessStatus({
    supabase: createReadySupabase(),
    getOpenAI: () => ({}),
    validateSchemaReady: async () => {},
    env: {
      RATE_LIMIT_BACKEND: "memory",
      NODE_ENV: "test",
      VONZA_DEPLOY_ENV: "test",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.supabase.ok, true);
  assert.equal(result.checks.schema.ok, true);
  assert.equal(result.checks.openai.ok, true);
  assert.equal(result.checks.rateLimit.ok, true);
});

test("readiness status fails closed when OpenAI or schema checks fail", async () => {
  const result = await getReadinessStatus({
    supabase: createReadySupabase(),
    getOpenAI: () => {
      const error = new Error("Missing environment variables: OPENAI_API_KEY");
      error.code = "openai_not_configured";
      throw error;
    },
    validateSchemaReady: async () => {
      const error = new Error("schema missing");
      error.code = "schema_not_ready";
      throw error;
    },
    env: {
      RATE_LIMIT_BACKEND: "memory",
      NODE_ENV: "test",
      VONZA_DEPLOY_ENV: "test",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.openai.ok, false);
  assert.equal(result.checks.openai.code, "openai_not_configured");
  assert.equal(result.checks.schema.ok, false);
  assert.equal(result.checks.schema.code, "schema_not_ready");
});
