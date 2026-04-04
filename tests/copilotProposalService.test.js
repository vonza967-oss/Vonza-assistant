import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTodayCopilotProposal,
  dismissTodayCopilotProposal,
  hydrateTodayCopilotProposals,
} from "../src/services/operator/copilotProposalService.js";

function createProposalSupabase(initialState = {}) {
  const state = {
    agent_copilot_proposal_states: (initialState.agent_copilot_proposal_states || []).map((row) => ({ ...row })),
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.sortColumn = null;
      this.sortAscending = true;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    order(column, options = {}) {
      this.sortColumn = column;
      this.sortAscending = options.ascending !== false;
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
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
      return state[this.table];
    }

    #matches() {
      let rows = this.#rows().filter((row) => this.filters.every((filter) => filter(row)));

      if (this.sortColumn) {
        rows = rows.slice().sort((left, right) => {
          const leftValue = new Date(left[this.sortColumn] || 0).getTime();
          const rightValue = new Date(right[this.sortColumn] || 0).getTime();
          return this.sortAscending ? leftValue - rightValue : rightValue - leftValue;
        });
      }

      return rows;
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return {
        data: rows[0] ? { ...rows[0] } : null,
        error: result.error || null,
      };
    }

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#matches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "update") {
        const matches = this.#matches();
        matches.forEach((row) => Object.assign(row, this.values));
        return {
          data: matches.map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "insert") {
        const values = Array.isArray(this.values) ? this.values : [this.values];
        const rows = this.#rows();
        const data = values.map((value, index) => {
          const nextRow = {
            id: value.id || `${this.table}-${rows.length + index + 1}`,
            ...value,
            created_at: value.created_at || "2026-04-04T12:00:00.000Z",
            updated_at: value.updated_at || "2026-04-04T12:00:00.000Z",
          };
          rows.push(nextRow);
          return { ...nextRow };
        });

        return {
          data,
          error: null,
        };
      }

      throw new Error(`Unsupported operation ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

test("applyTodayCopilotProposal creates a follow-up draft through the deterministic follow-up service", async () => {
  const supabase = createProposalSupabase();
  let captured = null;

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
      assistantName: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "follow-up-draft:contact-1",
      type: "create_follow_up_draft",
      hash: "follow-up-hash",
      target: { section: "automations", id: "", label: "Open Automations" },
      applyPayload: {
        actionType: "lead_follow_up",
        contactId: "contact-1",
        contactName: "Taylor Reed",
        contactEmail: "taylor@example.com",
        topic: "Pricing follow-up",
        subject: "Vonza Plumbing: following up on pricing",
        draftContent: "Hi Taylor,\n\nFollowing up on pricing.\n\nVonza Plumbing",
      },
    },
    workspace: {
      contacts: {
        list: [
          {
            id: "contact-1",
            displayName: "Taylor Reed",
            primaryEmail: "taylor@example.com",
          },
        ],
      },
    },
    deps: {
      createManualFollowUpWorkflow: async (_supabase, options) => {
        captured = options;
        return {
          followUp: {
            id: "follow-up-1",
            status: "draft",
          },
        };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.type, "follow_up_workflow");
  assert.equal(result.result.id, "follow-up-1");
  assert.equal(captured.contactEmail, "taylor@example.com");
  assert.equal(captured.subject, "Vonza Plumbing: following up on pricing");
  assert.equal(supabase.state.agent_copilot_proposal_states[0].status, "applied");
});

test("applyTodayCopilotProposal creates an operator task through the deterministic task service", async () => {
  const supabase = createProposalSupabase();
  let captured = null;

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "task-proposal:pricing-gap",
      type: "create_operator_task",
      hash: "task-hash",
      target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
      applyPayload: {
        taskType: "copilot_owner_next_step",
        title: "Close the pricing-follow-up gap",
        description: "A visitor asked about pricing and still has no recorded outcome.",
        priority: "high",
        contactId: "contact-1",
        relatedActionKey: "action-1",
      },
    },
    deps: {
      createOperatorTask: async (_supabase, options) => {
        captured = options;
        return {
          id: "task-1",
          status: "open",
        };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.type, "operator_task");
  assert.equal(result.result.id, "task-1");
  assert.equal(captured.sourceType, "copilot_proposal");
  assert.equal(captured.taskType, "copilot_owner_next_step");
  assert.equal(captured.contactId, "contact-1");
});

test("applyTodayCopilotProposal creates an outcome-review task without marking the outcome automatically", async () => {
  const supabase = createProposalSupabase();
  let captured = null;

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "outcome-review:contact-1",
      type: "create_outcome_review",
      hash: "outcome-hash",
      target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
      applyPayload: {
        taskType: "outcome_review",
        title: "Review outcome for Taylor Reed",
        description: "Confirm whether a real outcome should be recorded.",
        contactId: "contact-1",
      },
    },
    deps: {
      createOperatorTask: async (_supabase, options) => {
        captured = options;
        return {
          id: "task-review-1",
          status: "open",
        };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.id, "task-review-1");
  assert.equal(captured.taskType, "outcome_review");
  assert.equal(captured.title, "Review outcome for Taylor Reed");
});

test("dismissing a proposal keeps it from immediately resurfacing until the context changes", async () => {
  const supabase = createProposalSupabase();

  await dismissTodayCopilotProposal(supabase, {
    agentId: "agent-1",
    businessId: "business-1",
    ownerUserId: "owner-1",
    proposal: {
      key: "business-context:foundation",
      type: "open_existing_surface",
      hash: "hash-1",
    },
  });

  const hidden = hydrateTodayCopilotProposals({
    recommendations: [
      {
        id: "business-context:foundation",
        title: "Open business context setup",
        proposal: {
          key: "business-context:foundation",
          type: "open_existing_surface",
          hash: "hash-1",
          target: { section: "customize", id: "business-context-setup", label: "Open Customize" },
        },
      },
    ],
    drafts: [],
    proposalStates: supabase.state.agent_copilot_proposal_states.map((row) => ({
      proposalKey: row.proposal_key,
      status: row.status,
      proposalHash: row.proposal_hash,
      statusReason: row.status_reason,
    })),
  });

  assert.equal(hidden.proposals.length, 0);
  assert.equal(hidden.proposalSummary.hiddenCount, 1);

  const stale = hydrateTodayCopilotProposals({
    recommendations: [
      {
        id: "business-context:foundation",
        title: "Open business context setup",
        proposal: {
          key: "business-context:foundation",
          type: "open_existing_surface",
          hash: "hash-2",
          target: { section: "customize", id: "business-context-setup", label: "Open Customize" },
        },
      },
    ],
    drafts: [],
    proposalStates: supabase.state.agent_copilot_proposal_states.map((row) => ({
      proposalKey: row.proposal_key,
      status: row.status,
      proposalHash: row.proposal_hash,
      statusReason: row.status_reason,
    })),
  });

  assert.equal(stale.proposals[0].state, "stale");
});

test("contact next-step proposals block cleanly when the contact data is too sparse", async () => {
  const supabase = createProposalSupabase();
  let writeCount = 0;

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "contact-next-step:contact-1",
      type: "create_contact_next_step",
      hash: "next-step-hash",
      blockedReason: "This contact still needs a usable email address or phone number before Copilot can prepare the next-step draft safely.",
      target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
      applyPayload: {
        executionMode: "create_follow_up_draft",
      },
    },
    deps: {
      createManualFollowUpWorkflow: async () => {
        writeCount += 1;
        return { followUp: { id: "follow-up-1" } };
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.proposal.state, "blocked");
  assert.match(result.proposal.stateReason, /usable email address or phone number/i);
  assert.equal(writeCount, 0);
});

test("open_existing_surface proposals route without triggering autonomous writes", async () => {
  const supabase = createProposalSupabase();
  let writeCount = 0;

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "open-contact:contact-1:support-risk",
      type: "open_existing_surface",
      hash: "route-hash",
      target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
    },
    deps: {
      createManualFollowUpWorkflow: async () => {
        writeCount += 1;
        return {};
      },
      createOperatorTask: async () => {
        writeCount += 1;
        return {};
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.type, "surface");
  assert.equal(result.result.section, "contacts");
  assert.equal(writeCount, 0);
});

test("a failed proposal application becomes a blocked state instead of breaking Today", async () => {
  const supabase = createProposalSupabase();

  const result = await applyTodayCopilotProposal(supabase, {
    agent: {
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Plumbing",
    },
    ownerUserId: "owner-1",
    proposal: {
      key: "task-proposal:pricing-gap",
      type: "create_operator_task",
      hash: "task-hash",
      target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
      applyPayload: {
        taskType: "copilot_owner_next_step",
        title: "Close the pricing-follow-up gap",
      },
    },
    deps: {
      createOperatorTask: async () => {
        throw new Error("The operator task service is temporarily unavailable.");
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.proposal.state, "blocked");

  const hydrated = hydrateTodayCopilotProposals({
    recommendations: [
      {
        id: "task-proposal:pricing-gap",
        title: "Close the pricing-follow-up gap",
        proposal: {
          key: "task-proposal:pricing-gap",
          type: "create_operator_task",
          hash: "task-hash",
          target: { section: "contacts", id: "contact-1", label: "Open Contacts" },
        },
      },
    ],
    drafts: [],
    proposalStates: supabase.state.agent_copilot_proposal_states.map((row) => ({
      proposalKey: row.proposal_key,
      status: row.status,
      proposalHash: row.proposal_hash,
      statusReason: row.status_reason,
    })),
  });

  assert.equal(hydrated.proposals[0].state, "blocked");
  assert.match(hydrated.proposals[0].stateReason, /temporarily unavailable/i);
});
