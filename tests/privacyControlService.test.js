import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteVisitorOrCustomerRecords,
  exportAgentPrivacyData,
} from "../src/services/privacy/privacyControlService.js";

function createPrivacySupabase(tables = {}, deleteCalls = []) {
  return {
    from(tableName) {
      const filters = [];
      const applyFilters = (rows) => rows.filter((row) =>
        filters.every(([column, value]) => String(row[column] || "") === String(value || ""))
      );

      return {
        select() {
          return {
            eq(column, value) {
              filters.push([column, value]);
              return this;
            },
            async then(resolve) {
              return resolve({
                data: applyFilters(tables[tableName] || []),
                error: null,
              });
            },
          };
        },
        delete() {
          return {
            eq(column, value) {
              filters.push([column, value]);
              return this;
            },
            async select() {
              deleteCalls.push({ tableName, filters: [...filters] });
              const data = applyFilters(tables[tableName] || []);
              return {
                data,
                error: null,
                count: data.length,
              };
            },
          };
        },
      };
    },
  };
}

test("privacy JSON export narrows rows to practical owner-scoped fields", async () => {
  const supabase = createPrivacySupabase({
    messages: [{
      id: "message-1",
      agent_id: "agent-1",
      role: "user",
      content: "What do you charge?",
      session_key: "session-1",
      visitor_email: "lead@example.com",
      visitor_name: "Lead",
      internal_column: "should not export",
    }],
    agent_contact_leads: [{
      id: "lead-1",
      agent_id: "agent-1",
      owner_user_id: "owner-1",
      contact_email: "lead@example.com",
      capture_state: "captured",
      capture_metadata: { raw: "private" },
    }],
    agent_follow_up_workflows: [],
    agent_knowledge_fix_workflows: [{
      id: "fix-1",
      agent_id: "agent-1",
      owner_user_id: "owner-1",
      evidence: {
        question: "Pricing?",
        currentResponse: "Contact us.",
        currentSystemPrompt: "secret prompt",
        websiteUrl: "https://example.com/private",
      },
      proposed_guidance: "Use the quote path.",
    }],
    agent_action_queue_statuses: [],
  });

  const result = await exportAgentPrivacyData(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });
  const body = JSON.parse(result.body);

  assert.equal(body.ownerUserId, undefined);
  assert.equal(body.messages[0].internal_column, undefined);
  assert.equal(body.leads[0].capture_metadata, undefined);
  assert.equal(body.knowledgeFixes[0].evidence.currentSystemPrompt, undefined);
  assert.equal(body.knowledgeFixes[0].evidence.websiteUrl, undefined);
  assert.equal(body.guidance, "This export is owner-scoped and excludes billing, auth, and account records.");
});

test("privacy delete scopes action-key deletions to owner and includes prepared follow-ups", async () => {
  const deleteCalls = [];
  const supabase = createPrivacySupabase({
    agent_action_queue_statuses: [{ id: "status-1", agent_id: "agent-1", owner_user_id: "owner-1", action_key: "action-1" }],
    agent_human_follow_up_statuses: [{ id: "human-1", agent_id: "agent-1", owner_user_id: "owner-1", item_key: "action-1" }],
    agent_owner_notifications: [{ id: "notice-1", agent_id: "agent-1", owner_user_id: "owner-1", related_action_key: "action-1" }],
    agent_knowledge_fix_workflows: [{ id: "fix-1", agent_id: "agent-1", owner_user_id: "owner-1", source_action_key: "action-1" }],
    agent_follow_up_workflows: [{ id: "follow-1", agent_id: "agent-1", owner_user_id: "owner-1", source_action_key: "action-1" }],
  }, deleteCalls);

  const result = await deleteVisitorOrCustomerRecords(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    actionKey: "action-1",
  });

  assert.equal(result.deleted.followUps, 1);
  const followUpDelete = deleteCalls.find((call) => call.tableName === "agent_follow_up_workflows");
  assert.deepEqual(followUpDelete.filters, [
    ["agent_id", "agent-1"],
    ["owner_user_id", "owner-1"],
    ["source_action_key", "action-1"],
  ]);
  assert.equal(deleteCalls.some((call) => /auth|billing|account/i.test(call.tableName)), false);
});
