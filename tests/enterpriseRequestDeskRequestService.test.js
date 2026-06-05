import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createEnterpriseRequestDeskRequest,
  listEnterpriseRequestDeskRequests,
  updateEnterpriseRequestDeskRequestStatus,
} from "../src/services/enterprise/enterpriseRequestDeskRequestService.js";
import { SUPABASE_MIGRATION_FILE_BY_ID } from "../src/services/schema/supabaseMigrationCatalog.js";

const ENTERPRISE_REQUEST_MIGRATION =
  "supabase/migrations/20260605120000_enterprise_request_desk_requests.sql";

function extractEnterpriseRequestTableDefinition(sql) {
  const match = sql.match(
    /create table if not exists public\.enterprise_request_desk_requests \([\s\S]*?\n\);/i
  );
  assert.ok(match?.[0], "expected Enterprise Request Desk table definition");
  return match[0];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEnterpriseRequestSupabase({ agents = [], requests = [] } = {}) {
  const state = {
    agents: agents.map(clone),
    enterprise_request_desk_requests: requests.map(clone),
    insertCount: 0,
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "enterprise_request_desk_requests") {
      return state.enterprise_request_desk_requests;
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
      async limit(limit) {
        return {
          data: this.resolveRows().slice(0, limit),
          error: null,
        };
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
            id: `enterprise-request-${state.insertCount}`,
            created_at: now,
            ...this.insertPayload,
          };
          state.enterprise_request_desk_requests.push(row);
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

function createRequest(overrides = {}) {
  return {
    id: "request-1",
    owner_user_id: "owner-1",
    agent_id: "agent-1",
    business_id: "business-1",
    lane: "facility_management",
    lane_label: "Facility management",
    confidence: "medium",
    request_text: "Facility management support is needed for a Budapest site next week.",
    site_or_object: "telephely",
    location_text: "Budapest",
    service_need: "Facility management",
    timing_text: "jövő hét",
    urgency: "egyeztethető",
    contact_name: "Kovács Anna",
    contact_email: "anna@client.hu",
    contact_phone: "",
    missing_fields: [],
    structured_brief: {
      lane: "facility_management",
      laneLabelHu: "Facility management",
      serviceNeed: "Facility management",
      locationOrSite: "Budapest",
      urgencyOrTiming: "jövő hét",
      contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
      missingFields: [],
    },
    evidence: { proof_source_type: "request_only" },
    metadata: { product: "enterprise_request_desk", request_only: true },
    status: "request_received",
    status_reason: "",
    staff_notes: "",
    idempotency_key: "erd-intake:seed",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-05T09:00:00.000Z",
    ...overrides,
  };
}

test("Enterprise Request Desk create persists structured request-only fields", async () => {
  const supabase = createEnterpriseRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createEnterpriseRequestDeskRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    sourceKeyHash: "sha256:abc123",
    lane: "reception_object_protection",
    laneLabel: "Portaszolgálat / objektumvédelem",
    confidence: "high",
    requestText: "Portaszolgálat kell egy irodaházhoz Budapest XI. kerületben, jövő héten.",
    siteOrObject: "irodaház",
    locationText: "Budapest XI.",
    serviceNeed: "Portaszolgálat",
    timingText: "jövő héten",
    contactName: "Kovács Anna",
    contactEmail: "anna@client.hu",
    missingFields: [],
    structuredBrief: {
      lane: "reception_object_protection",
      laneLabelHu: "Portaszolgálat / objektumvédelem",
      confidence: "high",
      serviceNeed: "Portaszolgálat",
      locationOrSite: "Budapest XI.",
      urgencyOrTiming: "jövő héten",
      contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
      contactEmail: "anna@client.hu",
      missingFields: [],
      staffSummaryHu: "Belső brief: portaszolgálat.",
    },
    evidence: { proof_source_type: "request_only", classification_reason: "keyword_match" },
    metadata: { product: "enterprise_request_desk", request_only: true },
    idempotencyKey: "erd-intake:1",
  });

  assert.equal(request.id, "enterprise-request-1");
  assert.equal(request.ownerUserId, "owner-1");
  assert.equal(request.agentId, "agent-1");
  assert.equal(request.businessId, "business-1");
  assert.equal(request.status, "request_received");
  assert.equal(request.lane, "reception_object_protection");
  assert.equal(request.laneLabel, "Portaszolgálat / objektumvédelem");
  assert.equal(request.contactEmail, "anna@client.hu");
  assert.deepEqual(request.missingFields, []);
  assert.equal(request.structuredBrief.readyForOwnerReview, false);
  assert.equal(request.wasExisting, false);
  assert.deepEqual(request.evidence, {
    proof_source_type: "request_only",
    classification_reason: "keyword_match",
  });
});

test("Enterprise Request Desk create dedupes by owner, agent, and idempotency key", async () => {
  const supabase = createEnterpriseRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const first = await createEnterpriseRequestDeskRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    lane: "security_guarding",
    requestText: "Őrzés kell Budapesten.",
    idempotencyKey: "erd-intake:same",
  });
  const second = await createEnterpriseRequestDeskRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    lane: "facility_management",
    requestText: "Changed text should not insert.",
    idempotencyKey: "erd-intake:same",
  });

  assert.equal(first.id, second.id);
  assert.equal(second.wasExisting, true);
  assert.equal(supabase.state.enterprise_request_desk_requests.length, 1);
  assert.equal(second.lane, "security_guarding");
});

test("Enterprise Request Desk service rejects invalid lanes, secrets, and unexpected URLs", async () => {
  const supabase = createEnterpriseRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createEnterpriseRequestDeskRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      lane: "qdh_quote",
      requestText: "Őrzés kell.",
    }),
    (error) => {
      assert.equal(error.code, "enterprise_request_lane_not_allowed");
      return true;
    }
  );

  await assert.rejects(
    () => createEnterpriseRequestDeskRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      lane: "security_guarding",
      requestText: "Use OPENAI_API_KEY=sk-supersecretvalue1234567890 for this request.",
    }),
    (error) => {
      assert.equal(error.code, "enterprise_request_secret_rejected");
      return true;
    }
  );

  await assert.rejects(
    () => createEnterpriseRequestDeskRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      lane: "security_guarding",
      requestText: "Őrzés kell.",
      siteOrObject: "https://unexpected.example/site",
    }),
    (error) => {
      assert.equal(error.code, "enterprise_request_url_rejected");
      return true;
    }
  );
});

test("Enterprise Request Desk list is owner scoped and verifies agent filter scope", async () => {
  const supabase = createEnterpriseRequestSupabase({
    agents: [
      { id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" },
      { id: "agent-2", owner_user_id: "owner-2", business_id: "business-2" },
    ],
    requests: [
      createRequest({ id: "request-1", owner_user_id: "owner-1", agent_id: "agent-1", status: "needs_info" }),
      createRequest({ id: "request-2", owner_user_id: "owner-2", agent_id: "agent-2", status: "needs_info" }),
    ],
  });

  const requests = await listEnterpriseRequestDeskRequests(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    status: "needs_info",
  });

  assert.deepEqual(requests.map((request) => request.id), ["request-1"]);

  await assert.rejects(
    () => listEnterpriseRequestDeskRequests(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-2",
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "enterprise_request_agent_not_found");
      return true;
    }
  );
});

test("Enterprise Request Desk status updates allow review states only", async () => {
  const supabase = createEnterpriseRequestSupabase({
    requests: [
      createRequest({ id: "request-1", status: "request_received" }),
      createRequest({ id: "request-2", status: "routed" }),
    ],
  });

  const updated = await updateEnterpriseRequestDeskRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "needs_staff_review",
    staffNotes: "Átnézve.",
  });

  assert.equal(updated.status, "needs_staff_review");
  assert.equal(updated.staffNotes, "Átnézve.");

  await assert.rejects(
    () => updateEnterpriseRequestDeskRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-1",
      status: "quoted_externally",
    }),
    (error) => {
      assert.equal(error.code, "enterprise_request_status_not_allowed");
      return true;
    }
  );

  await assert.rejects(
    () => updateEnterpriseRequestDeskRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-2",
      status: "declined",
    }),
    (error) => {
      assert.equal(error.code, "enterprise_request_transition_not_allowed");
      return true;
    }
  );
});

test("Enterprise Request Desk request schema, catalog, and RLS policy are present", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(ENTERPRISE_REQUEST_MIGRATION, "utf8");

  assert.equal(
    SUPABASE_MIGRATION_FILE_BY_ID.enterprise_request_desk_requests,
    ENTERPRISE_REQUEST_MIGRATION
  );

  [schemaSql, migrationSql].forEach((sql) => {
    const tableSql = extractEnterpriseRequestTableDefinition(sql);

    assert.match(sql, /create table if not exists public\.enterprise_request_desk_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /business_id uuid references public\.businesses \(id\) on delete set null/i);
    assert.match(sql, /source_key_hash text/i);
    assert.match(sql, /lane text not null default 'general_enquiry'/i);
    assert.match(sql, /lane_label text not null/i);
    assert.match(sql, /confidence text not null default 'low'/i);
    assert.match(sql, /request_text text/i);
    assert.match(sql, /site_or_object text/i);
    assert.match(sql, /location_text text/i);
    assert.match(sql, /service_need text/i);
    assert.match(sql, /timing_text text/i);
    assert.match(sql, /missing_fields text\[\] not null default '\{\}'::text\[\]/i);
    assert.match(sql, /structured_brief jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /routed/i);
    assert.doesNotMatch(tableSql, /quoted_externally|accepted_externally|cancel_requested|expired/i);
    assert.match(sql, /enterprise_request_desk_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /enterprise_request_desk_requests_owner_status_created_idx/i);
    assert.match(sql, /alter table public\.enterprise_request_desk_requests enable row level security/i);
    assert.match(sql, /Owners can read Enterprise Request Desk requests/i);
    assert.match(sql, /for select\s+to authenticated/i);
    assert.doesNotMatch(sql, /on public\.enterprise_request_desk_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.enterprise_request_desk_requests\s+for update/i);
    assert.doesNotMatch(sql, /on public\.enterprise_request_desk_requests[\s\S]+?to anon/i);
  });

  assert.match(migrationSql, /revoke all on table public\.enterprise_request_desk_requests from anon/i);
  assert.match(migrationSql, /grant select on table public\.enterprise_request_desk_requests to authenticated/i);
});
