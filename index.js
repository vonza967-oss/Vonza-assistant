import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { createApp } from "./src/app/createApp.js";
import {
  getAppVersion,
  getBuildSha,
  getPort,
  getPublicAppUrl,
  isDevFakeBillingEnabled,
  isOperatorWorkspaceV1Enabled,
  listMissingGoogleOperatorEnvVars,
} from "./src/config/env.js";
import {
  getSupabaseClient,
  logSupabaseStartupCheck,
} from "./src/clients/supabaseClient.js";
import { validateStartupSchemaReady } from "./src/services/schema/startupSchemaService.js";

dotenv.config();

function logCriticalEnvWarnings() {
  const criticalKeys = [
    "PUBLIC_APP_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = criticalKeys.filter((key) => !process.env[key]);

  if (!missing.length) {
    console.log("[startup] Critical env check: OK");
  }

  if (missing.length) {
    console.warn(`[startup] Missing env: ${missing.join(", ")}`);
    console.warn("[startup] Local Stripe webhook test: stripe listen --forward-to localhost:3000/stripe/webhook");
    console.warn("[startup] Make sure STRIPE_WEBHOOK_SECRET matches the signing secret shown by Stripe CLI.");
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";

  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);

      if (!parsed.protocol || !parsed.hostname) {
        console.warn("[startup] SUPABASE_URL looks malformed. Check protocol and hostname.");
      }
    } catch {
      console.warn("[startup] SUPABASE_URL looks malformed. Check protocol and hostname.");
    }
  }

  if (isDevFakeBillingEnabled()) {
    console.warn("[startup] DEV_FAKE_BILLING is enabled. Local billing simulation is active.");
  }

  console.log(`[startup] Build: version=${getAppVersion()} sha=${getBuildSha() || "local-dev"}`);

  if (isOperatorWorkspaceV1Enabled()) {
    const missingGoogleKeys = listMissingGoogleOperatorEnvVars();

    if (missingGoogleKeys.length) {
      console.warn(
        `[startup] Operator workspace v1 is enabled, but Google integration is unavailable. Missing env: ${missingGoogleKeys.join(", ")}`
      );
    } else {
      console.log("[startup] Operator workspace v1 Google configuration: ready");
    }
  } else {
    console.log("[startup] Operator workspace v1 feature flag: disabled");
  }
}

const port = getPort();
const publicAppUrl = getPublicAppUrl(port);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logCriticalEnvWarnings();

const app = createApp({ rootDir: __dirname });
let supabase = null;

try {
  supabase = getSupabaseClient();
  await logSupabaseStartupCheck(supabase);
  await validateStartupSchemaReady(supabase, { phase: "startup" });
} catch (error) {
  console.error(error);
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.exit(1);
  }
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on ${publicAppUrl}`);
});
