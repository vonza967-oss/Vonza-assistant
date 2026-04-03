import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { logSupabaseStartupCheck } from "../src/clients/supabaseClient.js";
import { validateStartupSchemaReady } from "../src/services/schema/startupSchemaService.js";

dotenv.config();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  return value;
}

async function main() {
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  await logSupabaseStartupCheck(supabase);
  await validateStartupSchemaReady(supabase, { phase: "prod-verify" });
  console.log("Production schema verification passed.");
}

main().catch((error) => {
  console.error("Production schema verification failed.");
  console.error(error.message || error);
  process.exit(1);
});
