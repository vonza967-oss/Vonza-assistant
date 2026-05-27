import test from "node:test";
import assert from "node:assert/strict";

import {
  CLEAN_DATABASE_SUPABASE_ROLES,
  buildCleanDatabaseSupabaseBootstrapSql,
} from "../scripts/lib/cleanDatabaseSupabaseBootstrap.js";

test("clean database bootstrap creates Supabase roles required by migrations", () => {
  const sql = buildCleanDatabaseSupabaseBootstrapSql();

  CLEAN_DATABASE_SUPABASE_ROLES.forEach((roleName) => {
    assert.match(sql, new RegExp(`rolname = '${roleName}'`, "i"));
    assert.match(sql, new RegExp(`create role ${roleName} nologin`, "i"));
  });

  assert.match(sql, /alter role service_role bypassrls/i);
});

test("clean database bootstrap provides validation-only auth.uid helper", () => {
  const sql = buildCleanDatabaseSupabaseBootstrapSql();

  assert.match(sql, /create schema if not exists auth/i);
  assert.match(sql, /create or replace function auth\.uid\(\)/i);
  assert.match(sql, /returns uuid/i);
  assert.match(sql, /current_setting\('request\.jwt\.claim\.sub', true\)/i);
  assert.doesNotMatch(sql, /drop schema/i);
  assert.doesNotMatch(sql, /drop database/i);
});
