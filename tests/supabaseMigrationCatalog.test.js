import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

import {
  LEGACY_SOURCE_TO_SUPABASE_FILE,
  SUPABASE_MIGRATIONS,
  SUPABASE_MIGRATIONS_DIR,
} from "../src/services/schema/supabaseMigrationCatalog.js";
import {
  DEPLOY_MIGRATION_MANIFEST,
  FULL_CURRENT_MAIN_MIGRATION_IDS,
  STARTUP_SCHEMA_CHECKS,
  getManifestMigrationFiles,
} from "../src/services/schema/deployReadinessManifest.js";

function extractEnterpriseRequestTableDefinition(sql) {
  const match = sql.match(
    /create table if not exists public\.enterprise_request_desk_requests \([\s\S]*?\n\);/i
  );
  assert.ok(match?.[0], "expected Enterprise Request Desk table definition");
  return match[0];
}

test("legacy db sql files are mapped into ordered supabase migrations exactly once", () => {
  const legacyDbFiles = readdirSync("db")
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => `db/${fileName}`)
    .sort();

  const mappedLegacyFiles = Object.keys(LEGACY_SOURCE_TO_SUPABASE_FILE).sort();

  assert.deepEqual(mappedLegacyFiles, legacyDbFiles);
});

test("supabase migration catalog stays sorted and points at real files", () => {
  const versions = SUPABASE_MIGRATIONS.map((migration) => migration.version);
  const files = SUPABASE_MIGRATIONS.map((migration) => migration.file);
  const sortedFiles = [...files].sort();

  assert.deepEqual(versions, [...versions].sort());
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(files, sortedFiles);

  files.forEach((filePath) => {
    assert.ok(existsSync(filePath), `expected ${filePath} to exist`);
  });
});

test("full migration manifest order matches the supabase/migrations directory", () => {
  const catalogFiles = getManifestMigrationFiles(FULL_CURRENT_MAIN_MIGRATION_IDS);
  const directoryFiles = readdirSync(SUPABASE_MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => `${SUPABASE_MIGRATIONS_DIR}/${fileName}`);

  assert.deepEqual(catalogFiles, directoryFiles);
});

test("startup schema validators only reference declared supabase migrations", () => {
  STARTUP_SCHEMA_CHECKS.forEach((check) => {
    check.migrationIds.forEach((migrationId) => {
      assert.ok(
        DEPLOY_MIGRATION_MANIFEST[migrationId],
        `expected manifest entry for startup migration ${migrationId}`
      );
    });
  });
});

test("baseline migration only contains the foundational snapshot", () => {
  const baselineSql = readFileSync(
    "supabase/migrations/20260404000000_initial_schema_base.sql",
    "utf8"
  );

  assert.match(baselineSql, /create table if not exists public\.businesses/i);
  assert.doesNotMatch(baselineSql, /agent_contact_leads/i);
  assert.doesNotMatch(baselineSql, /operator_inbox_threads/i);
  assert.doesNotMatch(baselineSql, /owner_user_id/i);
});

test("Calendly booking integration schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260523001000_agent_booking_integrations.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_booking_integrations/i);
    assert.match(sql, /webhook_endpoint_token_hash text not null/i);
    assert.match(sql, /webhook_secret_encrypted text/i);
    assert.match(sql, /agent_booking_integrations_agent_owner_idx/i);
    assert.match(sql, /Owners can manage booking integrations/i);
  });
});

test("Phone Front Desk schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260525000000_phone_front_desk_phase_1b.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_phone_numbers/i);
    assert.match(sql, /phone_channel_enabled boolean not null default false/i);
    assert.match(sql, /create table if not exists public\.agent_phone_call_sessions/i);
    assert.match(sql, /provider_call_sid text not null/i);
    assert.match(sql, /Owners can manage phone numbers/i);
    assert.match(sql, /Owners can manage phone call sessions/i);
  });
});

test("Web Call session schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260528000000_web_call_sessions.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.web_call_sessions/i);
    assert.match(sql, /client_session_key text not null/i);
    assert.match(sql, /create table if not exists public\.web_call_turn_telemetry/i);
    assert.match(sql, /assistant_response_latency_ms integer/i);
    assert.match(sql, /web_call_session_id uuid references public\.web_call_sessions/i);
    assert.match(sql, /Owners can manage Web Call sessions/i);
    assert.match(sql, /Owners can manage Web Call turn telemetry/i);
  });
});

test("Owner product entitlement schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260530000000_owner_product_entitlements.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.owner_product_entitlements/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /product_key text not null/i);
    assert.match(sql, /entitlement_status text not null default 'inactive'/i);
    assert.match(sql, /stripe_subscription_item_id text/i);
    assert.match(sql, /feature_caps jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /unique \(owner_user_id, product_key\)/i);
    assert.match(sql, /check \(product_key in \('front_desk', 'website_widget', 'voice_agent'\)\)/i);
    assert.match(sql, /check \(entitlement_status in \('active', 'trialing', 'past_due', 'canceled', 'inactive', 'grandfathered', 'beta', 'free'\)\)/i);
    assert.match(sql, /check \(source in \('stripe_subscription_item', 'legacy_workspace_plan', 'manual_beta', 'manual_free', 'internal_trial'\)\)/i);
    assert.match(sql, /owner_product_entitlements_owner_status_idx/i);
    assert.match(sql, /owner_product_entitlements_product_status_idx/i);
    assert.match(sql, /Owners can read product entitlements/i);
  });

  assert.match(migrationSql, /subscription_status in \('active', 'trialing', 'legacy_active', 'legacy-active'\)/i);
  assert.match(migrationSql, /agents\.access_status = 'active'/i);
  assert.match(migrationSql, /'grandfathered'/i);
  assert.match(migrationSql, /on conflict \(owner_user_id, product_key\) do nothing/i);
  assert.doesNotMatch(migrationSql, /delete from public\.owner_product_entitlements|update public\.agents|update public\.owner_billing_accounts/i);
});

test("agent package persistence keeps Front Desk default and allows only registered activatable keys", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const fieldMigrationSql = readFileSync(
    "supabase/migrations/20260601145748_agent_package_fields.sql",
    "utf8"
  );
  const activationMigrationSql = readFileSync(
    "supabase/migrations/20260601162000_agent_package_hotel_concierge_constraint.sql",
    "utf8"
  );

  assert.match(schemaSql, /package_key text not null default 'front_desk_general'/i);
  assert.match(schemaSql, /package_version text not null default '0\.1\.0'/i);
  assert.match(fieldMigrationSql, /package_key text not null default 'front_desk_general'/i);
  assert.match(fieldMigrationSql, /package_version text not null default '0\.1\.0'/i);
  assert.match(
    schemaSql,
    /check \(package_key in \('front_desk_general', 'hotel_concierge'\)\)/i
  );
  assert.match(
    activationMigrationSql,
    /check \(package_key in \('front_desk_general', 'hotel_concierge'\)\)/i
  );
  assert.doesNotMatch(activationMigrationSql, /package_key text not null default|package_version text not null default/i);
  assert.doesNotMatch(activationMigrationSql, /create table|add column|drop column|alter column/i);
});

test("agent custom instructions schema is present with bounded length and owner policy coverage", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260612183000_agent_custom_instructions.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /custom_instructions text/i);
    assert.match(sql, /agents_custom_instructions_length_check/i);
    assert.match(sql, /char_length\(custom_instructions\) <= 10000/i);
  });
  assert.match(schemaSql, /create policy "Owners can manage their agents\."/i);
  assert.match(schemaSql, /owner_user_id = \(select auth\.uid\(\)\)/i);
});

test("generic booking request schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260602135522_agent_booking_requests.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_booking_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /requested_service text/i);
    assert.match(sql, /requested_time_text text/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /evidence jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /agent_booking_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /Owners can read booking requests/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests\s+for update/i);
  });
});

test("generic quote request schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260604120000_agent_quote_requests.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_quote_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /requested_service text/i);
    assert.match(sql, /project_details text/i);
    assert.match(sql, /location_text text/i);
    assert.match(sql, /budget_text text/i);
    assert.match(sql, /language text/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /quoted_externally/i);
    assert.match(sql, /accepted_externally/i);
    assert.match(sql, /evidence jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /agent_quote_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /Owners can read quote requests/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests\s+for update/i);
  });
});

test("Enterprise Request Desk request schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260605120000_enterprise_request_desk_requests.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    const tableSql = extractEnterpriseRequestTableDefinition(sql);

    assert.match(sql, /create table if not exists public\.enterprise_request_desk_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /business_id uuid references public\.businesses \(id\) on delete set null/i);
    assert.match(sql, /source_key_hash text/i);
    assert.match(sql, /lane text not null default 'general_enquiry'/i);
    assert.match(sql, /lane_label text not null/i);
    assert.match(sql, /confidence text not null default 'low'/i);
    assert.match(sql, /request_text text/i);
    assert.match(sql, /site_or_object text/i);
    assert.match(sql, /location_text text/i);
    assert.match(sql, /service_need text/i);
    assert.match(sql, /timing_text text/i);
    assert.match(sql, /urgency text/i);
    assert.match(sql, /missing_fields text\[\] not null default '\{\}'::text\[\]/i);
    assert.match(sql, /structured_brief jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /routed/i);
    assert.doesNotMatch(tableSql, /quoted_externally|accepted_externally|cancel_requested|expired/i);
    assert.match(sql, /enterprise_request_desk_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /enterprise_request_desk_requests_owner_status_created_idx/i);
    assert.match(sql, /Owners can read Enterprise Request Desk requests/i);
    assert.doesNotMatch(sql, /on public\.enterprise_request_desk_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.enterprise_request_desk_requests\s+for update/i);
  });

  assert.doesNotMatch(migrationSql, /to anon/i);
});

test("QDH setup readiness schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260604143000_qdh_owner_setups.sql",
    "utf8"
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.qdh_owner_setups/i);
    assert.match(sql, /owner_user_id uuid primary key/i);
    assert.match(sql, /business_name text not null/i);
    assert.match(sql, /website_url text not null/i);
    assert.match(sql, /service_type text not null/i);
    assert.match(sql, /service_area text not null/i);
    assert.match(sql, /handling_preference text not null default 'staff_review'/i);
    assert.match(sql, /owner_contact_email text not null/i);
    assert.match(sql, /services_offered text\[\] not null default '\{\}'::text\[\]/i);
    assert.match(sql, /qdh_owner_setups_updated_at_idx/i);
    assert.match(sql, /Owners can manage QDH setup/i);
  });

  assert.doesNotMatch(migrationSql, /to anon/i);
});
