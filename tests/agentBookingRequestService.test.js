import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  createAgentBookingRequest,
  listAgentBookingRequests,
  updateAgentBookingRequestStatus,
} from "../src/services/bookings/agentBookingRequestService.js";
import { SUPABASE_MIGRATION_FILE_BY_ID } from "../src/services/schema/supabaseMigrationCatalog.js";

const BOOKING_REQUEST_MIGRATION = "supabase/migrations/20260602135522_agent_booking_requests.sql";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBookingRequestSupabase({ agents = [], requests = [] } = {}) {
  const state = {
    agents: agents.map(clone),
    agent_booking_requests: requests.map(clone),
    insertCount: 0,
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "agent_booking_requests") {
      return state.agent_booking_requests;
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
            id: `booking-request-${state.insertCount}`,
            created_at: now,
            ...this.insertPayload,
          };
          state.agent_booking_requests.push(row);
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

test("booking request create persists a default request", async () => {
  const supabase = createBookingRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createAgentBookingRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
  });

  assert.equal(request.id, "booking-request-1");
  assert.equal(request.ownerUserId, "owner-1");
  assert.equal(request.agentId, "agent-1");
  assert.equal(request.businessId, "business-1");
  assert.equal(request.status, "request_received");
  assert.deepEqual(request.evidence, {});
  assert.deepEqual(request.metadata, {});
});

test("booking request create stores requested service, time, and contact fields", async () => {
  const supabase = createBookingRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createAgentBookingRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    visitorSessionKey: "session-1",
    sourceMessageId: "00000000-0000-0000-0000-000000000001",
    sourceChannel: "full_page",
    displayMode: "page",
    requestedService: "Initial consultation",
    requestedTimeText: "tomorrow at 10",
    requestedTimeWindowStart: "2026-06-03T10:00:00.000Z",
    requestedTimeWindowEnd: "2026-06-03T10:30:00.000Z",
    timezone: "Europe/Budapest",
    customerName: "Avery Stone",
    customerEmail: "avery@example.com",
    customerPhone: "+3612345678",
    metadata: { locale: "hu" },
  });

  assert.equal(request.requestedService, "Initial consultation");
  assert.equal(request.requestedTimeText, "tomorrow at 10");
  assert.equal(request.requestedTimeWindowStart, "2026-06-03T10:00:00.000Z");
  assert.equal(request.timezone, "Europe/Budapest");
  assert.equal(request.customerName, "Avery Stone");
  assert.equal(request.customerEmail, "avery@example.com");
  assert.equal(request.customerPhone, "+3612345678");
  assert.deepEqual(request.metadata, { locale: "hu" });
});

test("booking request create allows request-only cancellation and reschedule starts", async () => {
  for (const status of ["cancel_requested", "reschedule_requested"]) {
    const supabase = createBookingRequestSupabase({
      agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
    });

    const request = await createAgentBookingRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      status,
      customerEmail: "avery@example.com",
    });

    assert.equal(request.status, status);
    assert.equal(supabase.state.agent_booking_requests.length, 1);
  }
});

test("booking request create normalizes blanks and malformed json fields", async () => {
  const supabase = createBookingRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: null }],
  });

  const request = await createAgentBookingRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    requestedService: "   ",
    customerEmail: "   ",
    evidence: ["not", "plain"],
    metadata: new Date("2026-06-01T00:00:00.000Z"),
    idempotencyKey: "   ",
  });

  assert.equal(request.businessId, null);
  assert.equal(request.requestedService, null);
  assert.equal(request.customerEmail, null);
  assert.equal(request.idempotencyKey, null);
  assert.deepEqual(request.evidence, {});
  assert.deepEqual(request.metadata, {});
});

test("booking request create dedupes by owner, agent, and idempotency key", async () => {
  const supabase = createBookingRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const first = await createAgentBookingRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    idempotencyKey: "owner-1:agent-1:session-1:message-1",
    requestedService: "Massage",
  });
  const second = await createAgentBookingRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    idempotencyKey: "owner-1:agent-1:session-1:message-1",
    requestedService: "Changed text should not insert",
  });

  assert.equal(first.id, second.id);
  assert.equal(supabase.state.agent_booking_requests.length, 1);
  assert.equal(second.requestedService, "Massage");
});

test("booking request list is owner scoped", async () => {
  const supabase = createBookingRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        status: "needs_staff_review",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "request-2",
        owner_user_id: "owner-2",
        agent_id: "agent-2",
        business_id: "business-2",
        status: "needs_staff_review",
        created_at: "2026-06-01T11:00:00.000Z",
      },
    ],
  });

  const requests = await listAgentBookingRequests(supabase, {
    ownerUserId: "owner-1",
    status: "needs_staff_review",
  });

  assert.deepEqual(requests.map((request) => request.id), ["request-1"]);
});

test("booking request status transitions allow documented cases", async () => {
  const supabase = createBookingRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "request_received",
        evidence: {},
        metadata: {},
      },
    ],
  });

  const review = await updateAgentBookingRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "needs_staff_review",
    statusReason: "Needs schedule check.",
  });
  const offered = await updateAgentBookingRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "offered",
  });
  const confirmed = await updateAgentBookingRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "confirmed_externally",
    evidence: {
      proof_source_type: "calendar_event",
      calendar_event_id: "calendar-event-1",
    },
  });

  assert.equal(review.status, "needs_staff_review");
  assert.equal(review.statusReason, "Needs schedule check.");
  assert.equal(offered.status, "offered");
  assert.equal(confirmed.status, "confirmed_externally");
  assert.deepEqual(confirmed.evidence, {
    proof_source_type: "calendar_event",
    calendar_event_id: "calendar-event-1",
  });
});

test("booking request status transitions reject forbidden cases", async () => {
  const supabase = createBookingRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "request_received",
        evidence: {},
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => updateAgentBookingRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-1",
      status: "cancelled_externally",
      evidence: { proof_source_type: "calendar_event" },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "booking_request_transition_not_allowed");
      return true;
    }
  );
});

test("booking request confirmed and cancelled statuses require trusted proof", async () => {
  const supabase = createBookingRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "offered",
        evidence: {},
        metadata: {},
      },
      {
        id: "request-2",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "cancel_requested",
        evidence: {},
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => updateAgentBookingRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-1",
      status: "confirmed_externally",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "booking_request_proof_required");
      return true;
    }
  );

  await assert.rejects(
    () => updateAgentBookingRequestStatus(supabase, {
      ownerUserId: "owner-1",
      requestId: "request-2",
      status: "cancelled_externally",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "booking_request_proof_required");
      return true;
    }
  );
});

test("lead, action, and request-only proof cannot create confirmed status", async () => {
  const supabase = createBookingRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        status: "offered",
        evidence: {},
        metadata: {},
      },
    ],
  });

  for (const proofSourceType of ["agent_contact_lead", "agent_action_request", "booking_request"]) {
    await assert.rejects(
      () => updateAgentBookingRequestStatus(supabase, {
        ownerUserId: "owner-1",
        requestId: "request-1",
        status: "confirmed_externally",
        evidence: { proof_source_type: proofSourceType },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "booking_request_proof_required");
        return true;
      }
    );
  }
});

test("booking request malformed status is rejected", async () => {
  const supabase = createBookingRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createAgentBookingRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      status: "booked",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "unsupported_booking_request_status");
      return true;
    }
  );
});

test("booking request schema, migration catalog, indexes, constraints, and RLS policy are present", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(BOOKING_REQUEST_MIGRATION, "utf8");
  const recoverySql = readFileSync("docs/sql/prod_recovery_full_current_main.sql", "utf8");

  assert.equal(
    SUPABASE_MIGRATION_FILE_BY_ID.agent_booking_requests,
    BOOKING_REQUEST_MIGRATION
  );

  [schemaSql, migrationSql, recoverySql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_booking_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /business_id uuid references public\.businesses \(id\) on delete set null/i);
    assert.match(sql, /source_message_id uuid/i);
    assert.match(sql, /requested_time_window_start timestamptz/i);
    assert.match(sql, /evidence jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /status text not null default 'request_received'/i);
    assert.match(sql, /agent_booking_requests_status_check/i);
    assert.match(sql, /agent_booking_requests_status_nonblank_check/i);
    assert.match(sql, /agent_booking_requests_idempotency_key_nonblank_check/i);
    assert.match(sql, /agent_booking_requests_owner_agent_idempotency_idx/i);
    assert.match(sql, /agent_booking_requests_owner_created_idx/i);
    assert.match(sql, /agent_booking_requests_owner_status_created_idx/i);
    assert.match(sql, /alter table public\.agent_booking_requests enable row level security/i);
    assert.match(sql, /Owners can read booking requests/i);
    assert.match(sql, /for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) is not null and owner_user_id = \(select auth\.uid\(\)\)\)/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests\s+for update/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests\s+for delete/i);
    assert.doesNotMatch(sql, /on public\.agent_booking_requests[\s\S]+?to anon/i);
  });
});

test("widget, embed, dashboard, and public routes do not expose booking request runtime creation", () => {
  const forbiddenPaths = [
    "src/routes/chatRoutes.js",
    "src/routes/publicRoutes.js",
    "src/routes/bookingRoutes.js",
    "frontend",
    "assistant-embed.js",
    "embed.js",
    "embed-lite.js",
  ];
  const files = [];

  function collect(targetPath) {
    const stats = statSync(targetPath);

    if (stats.isDirectory()) {
      readdirSync(targetPath).forEach((entry) => collect(path.join(targetPath, entry)));
      return;
    }

    if (/\.(js|html)$/.test(targetPath)) {
      files.push(targetPath);
    }
  }

  forbiddenPaths.forEach(collect);

  files.forEach((filePath) => {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /agentBookingRequestService|createAgentBookingRequest|updateAgentBookingRequestStatus|listAgentBookingRequests/,
      `${filePath} should not import or call booking request internals`
    );
  });

  const chatServiceSource = readFileSync("src/services/chat/chatService.js", "utf8");
  assert.match(chatServiceSource, /BOOKING_REQUESTS_FROM_CHAT_ENABLED|bookingRequestsFromChatEnabled/);
  assert.match(chatServiceSource, /createAgentBookingRequest/);
  assert.doesNotMatch(chatServiceSource, /updateAgentBookingRequestStatus|listAgentBookingRequests|\/agents\/booking-requests|agent_booking_requests/);
});
