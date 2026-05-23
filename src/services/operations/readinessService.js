import { getOpenAIClient } from "../../clients/openaiClient.js";
import { getSupabaseClient } from "../../clients/supabaseClient.js";
import { validateStartupSchemaReady } from "../schema/startupSchemaService.js";
import { getDistributedRateLimitReadiness } from "../../utils/rateLimiter.js";

async function checkSupabase(supabase) {
  const { error } = await supabase
    .from("businesses")
    .select("id")
    .limit(1);

  if (error) {
    throw error;
  }

  return { ok: true };
}

async function checkSchema(supabase, validateSchemaReady = validateStartupSchemaReady) {
  await validateSchemaReady(supabase, { phase: "readiness" });
  return { ok: true };
}

function checkOpenAI(getOpenAI = getOpenAIClient) {
  getOpenAI();
  return {
    ok: true,
    configured: true,
  };
}

function checkRateLimitBackend(env = process.env) {
  const readiness = getDistributedRateLimitReadiness(env);

  if (!readiness.ok) {
    const error = new Error(readiness.message || "Rate-limit backend is not ready.");
    error.statusCode = 503;
    error.code = "rate_limit_not_ready";
    throw error;
  }

  return {
    ok: true,
    backend: readiness.backend,
    distributedRequired: readiness.distributedRequired,
    warnings: readiness.warnings,
  };
}

async function runCheck(name, fn) {
  try {
    return [name, await fn()];
  } catch (error) {
    return [name, {
      ok: false,
      code: error?.code || "readiness_check_failed",
      message: error?.publicMessage || error?.message || "Readiness check failed.",
    }];
  }
}

export async function getReadinessStatus({
  supabase = getSupabaseClient(),
  getOpenAI = getOpenAIClient,
  validateSchemaReady = validateStartupSchemaReady,
  env = process.env,
} = {}) {
  const entries = await Promise.all([
    runCheck("supabase", () => checkSupabase(supabase)),
    runCheck("schema", () => checkSchema(supabase, validateSchemaReady)),
    runCheck("openai", () => checkOpenAI(getOpenAI)),
    runCheck("rateLimit", () => checkRateLimitBackend(env)),
  ]);
  const checks = Object.fromEntries(entries);
  const ok = Object.values(checks).every((check) => check.ok);

  return {
    ok,
    checks,
  };
}
