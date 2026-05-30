import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSql = readFileSync("db/schema.sql", "utf8");
const rlsMigrationSql = readFileSync("supabase/migrations/20260510001000_rls_hardening.sql", "utf8");
const visitorReplyFeedbackMigrationSql = readFileSync(
  "supabase/migrations/20260510002000_visitor_reply_feedback.sql",
  "utf8"
);
const customerValueTrustMigrationSql = readFileSync(
  "supabase/migrations/20260510003000_customer_value_trust_controls.sql",
  "utf8"
);
const activationWizardMigrationSql = readFileSync(
  "supabase/migrations/20260511100000_activation_wizard_progress.sql",
  "utf8"
);
const frontDeskTrainingMigrationSql = readFileSync(
  "supabase/migrations/20260520000000_front_desk_training_items.sql",
  "utf8"
);
const frontDeskRagMigrationSql = readFileSync(
  "supabase/migrations/20260522001000_front_desk_rag_chunks.sql",
  "utf8"
);
const enterpriseReadinessMigrationSql = readFileSync(
  "supabase/migrations/20260523000000_enterprise_readiness_hardening.sql",
  "utf8"
);
const bookingIntegrationsMigrationSql = readFileSync(
  "supabase/migrations/20260523001000_agent_booking_integrations.sql",
  "utf8"
);
const phoneFrontDeskMigrationSql = readFileSync(
  "supabase/migrations/20260525000000_phone_front_desk_phase_1b.sql",
  "utf8"
);
const webCallSessionsMigrationSql = readFileSync(
  "supabase/migrations/20260528000000_web_call_sessions.sql",
  "utf8"
);
const ownerProductEntitlementsMigrationSql = readFileSync(
  "supabase/migrations/20260530000000_owner_product_entitlements.sql",
  "utf8"
);
const postRlsMigrationSql = `${rlsMigrationSql}\n${visitorReplyFeedbackMigrationSql}\n${customerValueTrustMigrationSql}\n${activationWizardMigrationSql}\n${frontDeskTrainingMigrationSql}\n${frontDeskRagMigrationSql}\n${enterpriseReadinessMigrationSql}\n${bookingIntegrationsMigrationSql}\n${phoneFrontDeskMigrationSql}\n${webCallSessionsMigrationSql}\n${ownerProductEntitlementsMigrationSql}`;

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

test("migration sequence covers every public app table with RLS", () => {
  const missing = listPublicTables(schemaSql).filter((tableName) => !hasRlsEnabled(postRlsMigrationSql, tableName));

  assert.deepEqual(missing, []);
});

test("RLS hardening migration does not reference feedback table before it exists", () => {
  assert.doesNotMatch(rlsMigrationSql, /agent_visitor_reply_feedback/i);
  assert.match(visitorReplyFeedbackMigrationSql, /create table if not exists public\.agent_visitor_reply_feedback/i);
  assert.match(visitorReplyFeedbackMigrationSql, /alter table public\.agent_visitor_reply_feedback enable row level security/i);
});

test("direct browser preference policies are owner scoped and authenticated only", () => {
  assert.match(postRlsMigrationSql, /on public\.user_dashboard_preferences\s+for select\s+to authenticated/i);
  assert.match(postRlsMigrationSql, /on public\.user_dashboard_preferences\s+for insert\s+to authenticated/i);
  assert.match(postRlsMigrationSql, /on public\.user_dashboard_preferences\s+for update\s+to authenticated/i);
  assert.match(postRlsMigrationSql, /\(select auth\.uid\(\)\) = owner_user_id/i);
  assert.doesNotMatch(postRlsMigrationSql, /to anon/i);
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
    "agent_booking_integrations",
    "operator_contacts",
    "operator_contact_identities",
    "operator_tasks",
    "agent_visitor_reply_feedback",
    "front_desk_training_items",
    "front_desk_knowledge_chunks",
    "agent_phone_numbers",
    "agent_phone_call_sessions",
    "web_call_sessions",
    "web_call_turn_telemetry",
    "owner_product_entitlements",
  ].forEach((tableName) => {
    assert.match(
      postRlsMigrationSql,
      new RegExp(`on public\\.${tableName}[\\s\\S]+?to authenticated`, "i"),
      `${tableName} should have an authenticated owner policy`
    );
  });

  assert.match(postRlsMigrationSql, /agents\.owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(postRlsMigrationSql, /owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(postRlsMigrationSql, /agent_visitor_reply_feedback[\s\S]+?for insert\s+to anon/i);
  assert.doesNotMatch(postRlsMigrationSql, /messages[\s\S]+?for select\s+to anon/i);
});
