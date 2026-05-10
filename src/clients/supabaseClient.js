import { createClient } from "@supabase/supabase-js";

import { BUSINESSES_TABLE } from "../config/constants.js";

export function getSupabaseClient() {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    const error = new Error(
      `Missing environment variables: ${missing.join(", ")}`
    );
    error.statusCode = 500;
    throw error;
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function logSupabaseStartupCheck(supabase) {
  console.log("PUBLIC_APP_URL:", process.env.PUBLIC_APP_URL || "not set");
  console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "configured" : "missing");
  console.log(
    "SERVICE ROLE:",
    process.env.SUPABASE_SERVICE_ROLE_KEY ? "loaded" : "missing"
  );

  try {
    const { data, error } = await supabase
      .from(BUSINESSES_TABLE)
      .select("*")
      .limit(1);

    console.log("[startup] Supabase reachability:", {
      reachable: !error,
      table: BUSINESSES_TABLE,
      rowCount: Array.isArray(data) ? data.length : 0,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
    });

    if (error) {
      console.error("[startup] Supabase startup check failed:", {
        code: error.code || null,
        message: error.message || String(error),
      });
    }
  } catch (error) {
    console.error("[startup] Supabase startup check failed:", {
      code: error.code || null,
      message: error.message || String(error),
    });
  }
}
