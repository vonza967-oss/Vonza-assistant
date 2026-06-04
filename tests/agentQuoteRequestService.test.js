import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createAgentQuoteRequest,
  listAgentQuoteRequests,
  updateAgentQuoteRequestStatus,
} from "../src/services/quotes/agentQuoteRequestService.js";
import { SUPABASE_MIGRATION_FILE_BY_ID } from "../src/services/schema/supabaseMigrationCatalog.js";

const QUOTE_REQUEST_MIGRATION = "supabase/migrations/20260604120000_agent_quote_requests.sql";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createQuoteRequestSupabase({ agents = [], requests = [] } = {}) {
  const state = {
    agents: agents.map(clone),
    agent_quote_requests: requests.map(clone),
    insertCount: 0,
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "agent_quote_requests") {
      return state.agent_quote_requests;
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function buildQuery(table) {
    const query = {
      filters: [],
      insertPayload: null,
      updatePayload: null,
      orderSpec: null,
      select() {
        return this;
      },
      eq(column, value) {
        this.filters.push({ column, value });
        return this;
      },
      insert(payload) {
        this.insertPayload = clone(payload);
        return this;
      },
      update(payload) {
        this.updatePayload = clone(payload);
        return this;
      },
      order(column, options = {}) {
        this.orderSpec = { column, ascending: options.ascending !== false };
        return this;
      },
      async limit(limit) {
        return {
          data: this.resolveRows().slice(0, limit),
          error: null,
        };
      },
      resolveRows() {
        let rows = rowsFor(table).filter((row) =>
          this.filters.every(({ column, value }) => row[column] === value)
        );

        if (this.orderSpec) {
          const { column, ascending } = this.orderSpec;
          rows = [...rows].sort((left, right) => {
            const result = String(left[column] || "").localeCompare(String(right[column] || ""));
            return ascending ? result : -result;
          });
        }

        return rows.map(clone);
      },
      async maybeSingle() {
        if (this.updatePayload) {
          const row = rowsFor(table).find((candidate) =>
            this.filters.every(({ column, value }) => candidate[column] === value)
          );

          if (!row) {
            return { data: null, error: null };
          }

          Object.assign(row, this.updatePayload);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
      async single() {
        if (this.insertPayload) {
          state.insertCount += 1;
          const now = new Date().toISOString();
          const row = {
            id: `quote-request-${state.insertCount}`,
            created_at: now,
            ...this.insertPayload,
          };
          state.agent_quote_requests.push(row);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
    };

    return query;
  }

  return {
    state,
    from(table) {
      return buildQuery(table);
    },
  };
}

test("quote request create persists request-only intake fields", async () => {
  const supabase = createQuoteRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createAgentQuoteRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    requestedService: "Roof repair",
    projectDetails: "Need a quote for a leaking roof.",
    locationText: "Budapest",
    urgency: "this week",
    budgetText: "not sure",
    customerName: "Anna Kovacs",
    customerEmail: "anna@customer.com",
    language: "Hungarian",
    metadata: { source: "test_quote_intake" },
  });

  assert.equal(request.id, "quote-request-1");
  assert.equal(request.ownerUserId, "owner-1");
  assert.equal(request.agentId, "agent-1");
  assert.equal(request.businessId, "business-1");
  assert.equal(request.status, "request_received");
  assert.equal(request.requestedService, "Roof repair");
  assert.equal(request.projectDetails, "Need a quote for a leaking roof.");
  assert.equal(request.locationText, "Budapest");
  assert.equal(request.language, "Hungarian");
  assert.deepEqual(request.evidence, {});
  assert.deepEqual(request.metadata, { source: "test_quote_intake" });
});

test("quote request create normalizes blanks and malformed json fields", async () => {
  const supabase = createQuoteRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: null }],
  });

  const request = await createAgentQuoteRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    requestedService: "   ",
    evidence: ["not", "plain"],
    metadata: new Date("2026-06-01T00:00:00.000Z"),
    idempotencyKey: "   ",
  });

  assert.equal(request.businessId, null);
  assert.equal(request.requestedService, null);
  assert.equal(request.idempotencyKey, null);
  assert.deepEqual(request.evidence, {});
  assert.deepEqual(request.metadata, {});
});

test("quote request create dedupes by owner, agent, and idempotency key", async () => {
  const supabase = createQuoteRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const first = await createAgentQuoteRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    idempotencyKey: "owner-1:agent-1:session-1:message-1",
    requestedService: "Roof repair",
  });
  const second = await createAgentQuoteRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    idempotencyKey: "owner-1:agent-1:session-1:message-1",
    requestedService: "Changed text should not insert",
  });

  assert.equal(first.id, second.id);
  assert.equal(supabase.state.agent_quote_requests.length, 1);
  assert.equal(second.requestedService, "Roof repair");
});

test("quote request list is owner scoped and supports status filters", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "needs_staff_review",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "request-2",
        owner_user_id: "owner-2",
        agent_id: "agent-2",
        status: "needs_staff_review",
        created_at: "2026-06-01T11:00:00.000Z",
      },
    ],
  });

  const requests = await listAgentQuoteRequests(supabase, {
    ownerUserId: "owner-1",
    status: "needs_staff_review",
  });

  assert.deepEqual(requests.map((request) => request.id), ["request-1"]);
});

test("quote request final quote states require trusted proof", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "needs_staff_review",
        evidence: {},
        metadata: {},
      },
      {
        id: "request-2",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "quoted_externally",
        evidence: { proof_source_type: "staff_quote" },
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => updateAgentQuoteRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-1",
      status: "quoted_externally",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "quote_request_proof_required");
      return true;
    }
  );

  const quoted = await updateAgentQuoteRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "quoted_externally",
    evidence: {
      proof_source_type: "staff_quote",
      quote_document_id: "quote-doc-1",
    },
  });
  const accepted = await updateAgentQuoteRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-2",
    status: "accepted_externally",
    evidence: {
      proof_source_type: "customer_acceptance",
      accepted_by: "owner-recorded",
    },
  });

  assert.equal(quoted.status, "quoted_externally");
  assert.equal(accepted.status, "accepted_externally");
});

test("lead, action, and request-only proof cannot create final quote states", async () => {
  const supabase = createQuoteRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "needs_staff_review",
        evidence: {},
        metadata: {},
      },
    ],
  });

  for (const proofSourceType of ["agent_contact_lead", "agent_action_request", "quote_request"]) {
    await assert.rejects(
      () => updateAgentQuoteRequestStatus(supabase, {
        ownerUserId: "owner-1",
        requestId: "request-1",
        status: "quoted_externally",
        evidence: { proof_source_type: proofSourceType },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "quote_request_proof_required");
        return true;
      }
    );
  }
});

test("quote request service rejects final quote claims in metadata", async () => {
  const supabase = createQuoteRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createAgentQuoteRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      metadata: { publicClaim: "final quote sent for exact price" },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "quote_request_final_claim_metadata_rejected");
      return true;
    }
  );
});

test("quote request schema, migration catalog, indexes, grants, and RLS policy are present", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(QUOTE_REQUEST_MIGRATION, "utf8");
  const recoverySql = readFileSync("docs/sql/prod_recovery_full_current_main.sql", "utf8");

  assert.equal(
    SUPABASE_MIGRATION_FILE_BY_ID.agent_quote_requests,
    QUOTE_REQUEST_MIGRATION
  );

  [schemaSql, migrationSql, recoverySql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_quote_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /business_id uuid references public\.businesses \(id\) on delete set null/i);
    assert.match(sql, /requested_service text/i);
    assert.match(sql, /project_details text/i);
    assert.match(sql, /location_text text/i);
    assert.match(sql, /urgency text/i);
    assert.match(sql, /budget_text text/i);
    assert.match(sql, /language text/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /evidence jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /agent_quote_requests_status_check/i);
    assert.match(sql, /agent_quote_requests_status_nonblank_check/i);
    assert.match(sql, /agent_quote_requests_idempotency_key_nonblank_check/i);
    assert.match(sql, /agent_quote_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /agent_quote_requests_owner_created_idx/i);
    assert.match(sql, /agent_quote_requests_owner_status_created_idx/i);
    assert.match(sql, /alter table public\.agent_quote_requests enable row level security/i);
    assert.match(sql, /Owners can read quote requests/i);
    assert.match(sql, /for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) is not null and owner_user_id = \(select auth\.uid\(\)\)\)/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests\s+for update/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests\s+for delete/i);
    assert.doesNotMatch(sql, /on public\.agent_quote_requests[\s\S]+?to anon/i);
  });

  [migrationSql, recoverySql].forEach((sql) => {
    assert.match(sql, /revoke all on table public\.agent_quote_requests from anon/i);
    assert.match(sql, /grant select on table public\.agent_quote_requests to authenticated/i);
  });
});
