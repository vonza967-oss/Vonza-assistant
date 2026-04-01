import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tableName = "businesses";

function fail(message, error) {
  console.error(`Supabase test failed: ${message}`);

  if (error) {
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log(`Testing Supabase read/write using table: ${tableName}`);

  const { data: selectData, error: selectError } = await supabase
    .from(tableName)
    .select("id, name, website_url, created_at")
    .limit(1);

  if (selectError) {
    fail("SELECT query failed.", selectError);
  }

  console.log("SELECT succeeded.", {
    rowCount: Array.isArray(selectData) ? selectData.length : 0,
    sampleRow: selectData?.[0] || null,
  });

  const insertPayload = {
    name: `Supabase Test ${new Date().toISOString()}`,
    website_url: `https://supabase-test-${Date.now()}.local`,
  };

  const { data: insertData, error: insertError } = await supabase
    .from(tableName)
    .insert(insertPayload)
    .select("id, name, website_url, created_at")
    .single();

  if (insertError) {
    fail("INSERT query failed.", insertError);
  }

  console.log("INSERT succeeded.", insertData);
  console.log("Supabase test passed: both SELECT and INSERT worked.");
}

run().catch((error) => {
  fail("Unexpected runtime error.", error);
});
