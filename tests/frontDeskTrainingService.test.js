import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApprovedAnswersPrompt,
  listFrontDeskTrainingItems,
  saveFrontDeskTrainingItem,
  selectRelevantApprovedAnswers,
  updateFrontDeskTrainingItemStatus,
} from "../src/services/training/frontDeskTrainingService.js";

function createTrainingSupabase(rows = []) {
  const state = {
    front_desk_training_items: rows.map((row) => ({ ...row })),
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.values = null;
    }

    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }
    insert(value) {
      this.operation = "insert";
      this.values = value;
      return this;
    }
    update(value) {
      this.operation = "update";
      this.values = value;
      return this;
    }
    single() {
      const result = this.#run();
      return Promise.resolve({
        data: Array.isArray(result.data) ? result.data[0] || null : result.data,
        error: result.error,
      });
    }
    then(resolve, reject) {
      return Promise.resolve(this.#run()).then(resolve, reject);
    }
    #matches(row) {
      return this.filters.every((filter) => row[filter.column] === filter.value);
    }
    #run() {
      const tableRows = state[this.table] || [];
      if (this.operation === "insert") {
        const next = {
          id: `item-${tableRows.length + 1}`,
          ...this.values,
        };
        tableRows.push(next);
        return { data: [{ ...next }], error: null };
      }
      if (this.operation === "update") {
        const matches = tableRows.filter((row) => this.#matches(row));
        matches.forEach((row) => Object.assign(row, this.values));
        return { data: matches.map((row) => ({ ...row })), error: null };
      }
      return { data: tableRows.filter((row) => this.#matches(row)).map((row) => ({ ...row })), error: null };
    }
  }

  return {
    state,
    from(table) {
      return new Query(table);
    },
  };
}

test("approved answer can be saved and listed for the owner and agent", async () => {
  const supabase = createTrainingSupabase();

  await saveFrontDeskTrainingItem(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    title: "Refund policy",
    triggerText: "refund policy",
    answerText: "Refunds are reviewed by the team within two business days.",
    tags: "refunds, policies",
  });

  const result = await listFrontDeskTrainingItems(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    type: "approved_answer",
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Refund policy");
  assert.deepEqual(result.items[0].tags, ["refunds", "policies"]);
});

test("relevant approved answers exclude draft, archived, unrelated, and cross-agent items", async () => {
  const supabase = createTrainingSupabase([
    {
      id: "active-1",
      owner_id: "owner-1",
      agent_id: "agent-1",
      type: "approved_answer",
      title: "Pricing",
      trigger_text: "pricing quote cost",
      answer_text: "Pricing depends on scope.",
      tags: ["pricing"],
      source_type: "manual",
      status: "active",
    },
    {
      id: "draft-1",
      owner_id: "owner-1",
      agent_id: "agent-1",
      type: "approved_answer",
      title: "Draft",
      trigger_text: "pricing",
      answer_text: "Draft answer.",
      tags: ["pricing"],
      source_type: "manual",
      status: "draft",
    },
    {
      id: "other-agent",
      owner_id: "owner-1",
      agent_id: "agent-2",
      type: "approved_answer",
      title: "Pricing leak",
      trigger_text: "pricing",
      answer_text: "Wrong agent.",
      tags: ["pricing"],
      source_type: "manual",
      status: "active",
    },
    {
      id: "unrelated",
      owner_id: "owner-1",
      agent_id: "agent-1",
      type: "approved_answer",
      title: "Hours",
      trigger_text: "opening hours",
      answer_text: "Open weekdays.",
      tags: ["hours"],
      source_type: "manual",
      status: "active",
    },
  ]);

  const relevant = await selectRelevantApprovedAnswers(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    queryText: "How much does a quote cost?",
  });

  assert.deepEqual(relevant.map((item) => item.id), ["active-1"]);
  assert.match(buildApprovedAnswersPrompt(relevant), /Owner-approved answers/);
  assert.doesNotMatch(buildApprovedAnswersPrompt(relevant), /Wrong agent/);
});

test("archiving an approved answer removes it from active retrieval", async () => {
  const supabase = createTrainingSupabase([
    {
      id: "active-1",
      owner_id: "owner-1",
      agent_id: "agent-1",
      type: "approved_answer",
      title: "Pricing",
      trigger_text: "pricing",
      answer_text: "Pricing depends on scope.",
      tags: ["pricing"],
      source_type: "manual",
      status: "active",
    },
  ]);

  await updateFrontDeskTrainingItemStatus(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    itemId: "active-1",
    status: "archived",
  });

  const relevant = await selectRelevantApprovedAnswers(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    queryText: "pricing",
  });

  assert.equal(relevant.length, 0);
});
