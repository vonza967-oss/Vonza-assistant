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
