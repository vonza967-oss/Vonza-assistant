import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSql = readFileSync("db/schema.sql", "utf8");
const rlsMigrationSql = readFileSync("supabase/migrations/20260510001000_rls_hardening.sql", "utf8");

function listPublicTables(sql) {
  return [...sql.matchAll(/create table(?: if not exists)? public\.(\w+)\s*\(/gi)]
    .map((match) => match[1])
    .sort();
}

function hasRlsEnabled(sql, tableName) {
  const pattern = new RegExp(
    `alter\\s+table\\s+public\\.${tableName}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
    "i"
  );
  return pattern.test(sql);
}

test("canonical schema enables RLS on every public app table", () => {
  const missing = listPublicTables(schemaSql).filter((tableName) => !hasRlsEnabled(schemaSql, tableName));

  assert.deepEqual(missing, []);
});

test("RLS hardening migration covers every public app table", () => {
  const missing = listPublicTables(schemaSql).filter((tableName) => !hasRlsEnabled(rlsMigrationSql, tableName));

  assert.deepEqual(missing, []);
});

test("direct browser preference policies are owner scoped and authenticated only", () => {
  assert.match(rlsMigrationSql, /on public\.user_dashboard_preferences\s+for select\s+to authenticated/i);
  assert.match(rlsMigrationSql, /on public\.user_dashboard_preferences\s+for insert\s+to authenticated/i);
  assert.match(rlsMigrationSql, /on public\.user_dashboard_preferences\s+for update\s+to authenticated/i);
  assert.match(rlsMigrationSql, /\(select auth\.uid\(\)\) = owner_user_id/i);
  assert.doesNotMatch(rlsMigrationSql, /to anon/i);
});

test("critical owner and customer tables have authenticated owner-scoped policies", () => {
  [
    "agents",
    "messages",
    "agent_action_queue_statuses",
    "agent_follow_up_workflows",
    "agent_contact_leads",
    "agent_knowledge_fix_workflows",
    "agent_conversion_outcomes",
    "operator_contacts",
    "operator_contact_identities",
    "operator_tasks",
    "agent_visitor_reply_feedback",
  ].forEach((tableName) => {
    assert.match(
      rlsMigrationSql,
      new RegExp(`on public\\.${tableName}[\\s\\S]+?to authenticated`, "i"),
      `${tableName} should have an authenticated owner policy`
    );
  });

  assert.match(rlsMigrationSql, /agents\.owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(rlsMigrationSql, /owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(rlsMigrationSql, /agent_visitor_reply_feedback[\s\S]+?for insert\s+to anon/i);
  assert.doesNotMatch(rlsMigrationSql, /messages[\s\S]+?for select\s+to anon/i);
});
