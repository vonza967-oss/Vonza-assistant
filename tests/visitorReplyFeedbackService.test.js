import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKnowledgeImprovementQueueItemsFromFeedback,
  recordOwnerAnswerFeedback,
  updateVisitorReplyFeedbackStatus,
} from "../src/services/analytics/visitorReplyFeedbackService.js";

function createFeedbackSupabase(rows = []) {
  const state = {
    agent_visitor_reply_feedback: rows.map((row) => ({ ...row })),
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.values = null;
    }
    select() { return this; }
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
    #matches(row) {
      return this.filters.every((filter) => row[filter.column] === filter.value);
    }
    #run() {
      const tableRows = state[this.table] || [];
      if (this.operation === "insert") {
        const duplicate = tableRows.find((row) =>
          row.agent_id === this.values.agent_id
          && row.session_key === this.values.session_key
          && row.assistant_message_key === this.values.assistant_message_key
        );
        if (duplicate) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const next = {
          id: `feedback-${tableRows.length + 1}`,
          created_at: "2026-05-20T10:00:00.000Z",
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

test("owner not-helpful feedback creates a reviewable training queue item", async () => {
  const supabase = createFeedbackSupabase();

  const recorded = await recordOwnerAnswerFeedback(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    userQuestion: "Do you offer Saturday appointments?",
    assistantAnswer: "Please contact the business.",
    assistantMessageKey: "message-2",
    sessionKey: "session-1",
    reason: "missing_details",
    sourceType: "owner_feedback",
  });

  assert.equal(recorded.feedback.status, "queued");
  assert.equal(recorded.feedback.reason, "missing_details");

  const queueItems = buildKnowledgeImprovementQueueItemsFromFeedback([], [recorded.feedback]);
  assert.equal(queueItems.length, 1);
  assert.equal(queueItems[0].source, "owner_feedback");
  assert.equal(queueItems[0].feedbackReason, "missing_details");
  assert.match(queueItems[0].question, /Saturday appointments/i);
  assert.match(queueItems[0].reply, /Please contact/i);
});

test("resolved or ignored feedback is not added to the training queue", () => {
  const queueItems = buildKnowledgeImprovementQueueItemsFromFeedback([], [
    {
      id: "feedback-1",
      rating: "not_helpful",
      status: "ignored",
      userQuestion: "What is the price?",
      assistantAnswer: "I do not know.",
    },
    {
      id: "feedback-2",
      rating: "not_helpful",
      status: "resolved",
      userQuestion: "What is the price?",
      assistantAnswer: "I do not know.",
    },
  ]);

  assert.equal(queueItems.length, 0);
});

test("feedback status updates can link the approved answer that resolved it", async () => {
  const supabase = createFeedbackSupabase([
    {
      id: "feedback-1",
      agent_id: "agent-1",
      owner_user_id: "owner-1",
      session_key: "session-1",
      assistant_message_key: "message-2",
      rating: "not_helpful",
      status: "queued",
      user_question: "What is the price?",
      assistant_answer: "I do not know.",
    },
  ]);

  const result = await updateVisitorReplyFeedbackStatus(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    feedbackId: "feedback-1",
    status: "resolved",
    trainingItemId: "approved-1",
  });

  assert.equal(result.feedback.status, "resolved");
  assert.equal(result.feedback.trainingItemId, "approved-1");
});
