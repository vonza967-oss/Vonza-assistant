import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildHumanFollowUpWorkflow,
  listHumanFollowUpStatusRows,
  updateHumanFollowUpStatus,
} from "../src/services/followup/humanFollowUpWorkflowService.js";
import {
  syncOwnerNotifications,
  updateOwnerNotificationStatus,
} from "../src/services/notifications/ownerNotificationService.js";
import {
  deleteVisitorOrCustomerRecords,
  exportAgentPrivacyData,
} from "../src/services/privacy/privacyControlService.js";

function createSupabaseStub(initialState = {}) {
  const state = Object.fromEntries(
    Object.entries({
      agent_human_follow_up_statuses: [],
      agent_owner_notifications: [],
      agent_privacy_settings: [],
      messages: [],
      agent_contact_leads: [],
      agent_follow_up_workflows: [],
      agent_knowledge_fix_workflows: [],
      agent_action_queue_statuses: [],
      agent_visitor_reply_feedback: [],
      operator_contacts: [],
      ...initialState,
    }).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );
  const counters = new Map();

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.orderBy = null;
      this.selectUsed = false;
      this.conflictColumns = [];
    }

    select() {
      this.selectUsed = true;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    order(column, options = {}) {
      this.orderBy = { column, ascending: options.ascending !== false };
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    upsert(values, options = {}) {
      this.operation = "upsert";
      this.values = values;
      this.conflictColumns = String(options.onConflict || "id").split(",").map((value) => value.trim());
      return this;
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.#executeSingle());
    }

    single() {
      return Promise.resolve(this.#executeSingle());
    }

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #rows() {
      return state[this.table] || [];
    }

    #matches(row) {
      return this.filters.every(([column, value]) => row[column] === value);
    }

    #nextId() {
      const next = (counters.get(this.table) || this.#rows().length) + 1;
      counters.set(this.table, next);
      return `${this.table}-${next}`;
    }

    #sorted(rows) {
      if (!this.orderBy) {
        return rows;
      }

      const direction = this.orderBy.ascending ? 1 : -1;
      return [...rows].sort((left, right) => String(left[this.orderBy.column] || "").localeCompare(String(right[this.orderBy.column] || "")) * direction);
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return {
        data: rows[0] || null,
        error: result.error || null,
      };
    }

    #execute() {
      const rows = this.#rows();

      if (this.operation === "select") {
        return {
          data: this.#sorted(rows.filter((row) => this.#matches(row))).map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "insert") {
        const payloads = Array.isArray(this.values) ? this.values : [this.values];
        const inserted = payloads.map((value) => ({
          id: value.id || this.#nextId(),
          ...value,
        }));
        rows.push(...inserted);
        return {
          data: this.selectUsed ? inserted.map((row) => ({ ...row })) : null,
          error: null,
        };
      }

      if (this.operation === "upsert") {
        const payload = {
          id: this.values.id || this.#nextId(),
          ...this.values,
        };
        const match = rows.find((row) => this.conflictColumns.every((column) => row[column] === payload[column]));

        if (match) {
          Object.assign(match, payload, { id: match.id });
        } else {
          rows.push(payload);
        }

        const persisted = match || payload;
        return {
          data: this.selectUsed ? [{ ...persisted }] : null,
          error: null,
        };
      }

      if (this.operation === "update") {
        const matches = rows.filter((row) => this.#matches(row));
        matches.forEach((row) => Object.assign(row, this.values));
        return {
          data: this.selectUsed ? matches.map((row) => ({ ...row })) : null,
          error: null,
        };
      }

      if (this.operation === "delete") {
        const kept = [];
        const deleted = [];
        rows.forEach((row) => {
          if (this.#matches(row)) {
            deleted.push(row);
          } else {
            kept.push(row);
          }
        });
        state[this.table] = kept;
        return {
          data: this.selectUsed ? deleted.map((row) => ({ ...row })) : null,
          count: deleted.length,
          error: null,
        };
      }

      throw new Error(`Unsupported operation ${this.operation}`);
    }
  }

  return {
    from(table) {
      if (!state[table]) {
        state[table] = [];
      }
      return new QueryBuilder(table);
    },
    state,
  };
}

function buildHumanQueue() {
  return {
    items: [
      {
        key: "pricing-1",
        actionType: "pricing_interest",
        type: "pricing_interest",
        label: "Pricing question",
        question: "How much is the emergency package?",
        snippet: "Visitor asked about emergency pricing.",
        whyFlagged: "Flagged because this customer asked about pricing.",
        suggestedAction: "Send a quote next step.",
        priority: "high",
        contactCaptured: true,
        contactInfo: { email: "buyer@example.com", name: "Buyer One" },
        followUp: {
          id: "follow-up-1",
          status: "draft",
          draftContent: "Hi Buyer, here is the pricing next step.",
        },
        ownerWorkflow: { attention: true },
        lastSeenAt: "2026-05-11T09:00:00.000Z",
      },
      {
        key: "support-1",
        actionType: "knowledge_gap",
        type: "knowledge_gap",
        label: "Support issue",
        question: "I am frustrated that my appointment is late.",
        snippet: "Visitor sounded frustrated about a late appointment.",
        whyFlagged: "Flagged because the customer sounded frustrated.",
        weakAnswer: true,
        knowledgeFix: {
          id: "knowledge-fix-1",
          status: "draft",
          issueSummary: "Complaint recovery guidance is weak.",
          occurrenceCount: 1,
          evidence: { question: "I am frustrated that my appointment is late." },
        },
        ownerWorkflow: { attention: true },
        lastSeenAt: "2026-05-11T10:00:00.000Z",
      },
    ],
  };
}

test("human follow-up workflow prioritizes unhappy customers and explains next actions", () => {
  const workflow = buildHumanFollowUpWorkflow(buildHumanQueue(), []);

  assert.equal(workflow.summary.total, 2);
  assert.equal(workflow.summary.open, 2);
  assert.equal(workflow.items[0].itemKey, "support-1");
  assert.equal(workflow.items[0].whyItMatters.some((reason) => reason.key === "unhappy"), true);
  assert.equal(workflow.items[0].whyItMatters.some((reason) => reason.key === "not_helpful"), true);
  assert.match(workflow.items[0].recommendedNextAction, /Improve knowledge/i);
  assert.equal(workflow.items[1].customerLabel, "Buyer One");
  assert.match(workflow.items[1].suggestedReplyDraft, /pricing next step/i);
});

test("human follow-up status updates are owner scoped", async () => {
  const supabase = createSupabaseStub({
    agent_human_follow_up_statuses: [
      {
        id: "other-owner-row",
        agent_id: "agent-1",
        owner_user_id: "owner-2",
        item_key: "pricing-1",
        action_key: "pricing-1",
        status: "new",
      },
    ],
  });

  const updated = await updateHumanFollowUpStatus(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    itemKey: "pricing-1",
    actionKey: "pricing-1",
    status: "replied",
    ownerReply: "Sent manually.",
  });
  const ownerRows = await listHumanFollowUpStatusRows(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });

  assert.equal(updated.item.status, "replied");
  assert.equal(ownerRows.records.length, 1);
  assert.equal(ownerRows.records[0].ownerUserId, "owner-1");
  assert.equal(supabase.state.agent_human_follow_up_statuses.find((row) => row.owner_user_id === "owner-2").status, "new");
});

test("owner notifications are created once per underlying customer issue and can be scoped-updated", async () => {
  const supabase = createSupabaseStub();
  const humanFollowUps = buildHumanFollowUpWorkflow(buildHumanQueue(), []);

  const first = await syncOwnerNotifications(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    humanFollowUps,
  });
  const second = await syncOwnerNotifications(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    humanFollowUps,
  });
  const notification = second.records.find((record) => record.type === "unhappy_customer");
  const updated = await updateOwnerNotificationStatus(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    notificationId: notification.id,
    status: "read",
  });

  assert.equal(first.records.length, 2);
  assert.equal(second.records.length, 2);
  assert.equal(updated.notification.status, "read");
  assert.equal(supabase.state.agent_owner_notifications.filter((row) => row.dedupe_key.includes("support-1")).length, 1);
});

test("privacy exports and deletes are owner scoped and keep empty states safe", async () => {
  const supabase = createSupabaseStub({
    messages: [
      { id: "message-1", agent_id: "agent-1", role: "user", content: "Hello", session_key: "session-1", visitor_email: "a@example.com" },
      { id: "message-2", agent_id: "agent-2", role: "user", content: "Other agent", session_key: "session-1", visitor_email: "other@example.com" },
    ],
    agent_contact_leads: [
      { id: "lead-1", agent_id: "agent-1", owner_user_id: "owner-1", contact_email: "a@example.com", visitor_session_key: "session-1" },
      { id: "lead-2", agent_id: "agent-1", owner_user_id: "owner-2", contact_email: "b@example.com", visitor_session_key: "session-1" },
    ],
    agent_action_queue_statuses: [
      { id: "status-1", agent_id: "agent-1", owner_user_id: "owner-1", action_key: "pricing-1", status: "new" },
      { id: "status-2", agent_id: "agent-1", owner_user_id: "owner-2", action_key: "pricing-1", status: "new" },
    ],
    agent_owner_notifications: [
      { id: "notice-1", agent_id: "agent-1", owner_user_id: "owner-1", related_action_key: "pricing-1", dedupe_key: "high_intent_lead:pricing-1", status: "unread" },
      { id: "notice-2", agent_id: "agent-1", owner_user_id: "owner-2", related_action_key: "pricing-1", dedupe_key: "high_intent_lead:pricing-1", status: "unread" },
    ],
  });

  const exported = await exportAgentPrivacyData(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    format: "json",
  });
  const body = JSON.parse(exported.body);

  assert.equal(body.leads.length, 1);
  assert.equal(body.leads[0].owner_user_id, undefined);
  assert.equal(body.leads[0].contactEmail, "a@example.com");
  assert.equal(body.messages.length, 1);
  assert.equal(body.guidance.includes("excludes billing"), true);

  const deleted = await deleteVisitorOrCustomerRecords(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    actionKey: "pricing-1",
  });

  assert.equal(deleted.deleted.actionStatuses, 1);
  assert.equal(deleted.deleted.notifications, 1);
  assert.equal(supabase.state.agent_action_queue_statuses.some((row) => row.owner_user_id === "owner-2"), true);
  assert.equal(supabase.state.agent_owner_notifications.some((row) => row.owner_user_id === "owner-2"), true);
});

test("dashboard exposes human follow-up, notification, and privacy controls", () => {
  const dashboard = readFileSync(new URL("../frontend/dashboard.js", import.meta.url), "utf8");

  assert.match(dashboard, /Human Follow-Up Workflow/);
  assert.match(dashboard, /data-human-follow-up-status-action/);
  assert.match(dashboard, /Data Privacy Controls/);
  assert.match(dashboard, /data-privacy-export/);
  assert.match(dashboard, /Owner notification/);
});
