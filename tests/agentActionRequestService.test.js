import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  createAgentActionRequest,
  listAgentActionRequests,
  updateAgentActionRequestStatus,
} from "../src/services/actions/agentActionRequestService.js";
import { SUPABASE_MIGRATION_FILE_BY_ID } from "../src/services/schema/supabaseMigrationCatalog.js";

const ACTION_REQUEST_MIGRATION = "supabase/migrations/20260601185631_agent_action_requests.sql";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionRequestSupabase({ agents = [], requests = [] } = {}) {
  const state = {
    agents: agents.map(clone),
    agent_action_requests: requests.map(clone),
    insertCount: 0,
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "agent_action_requests") {
      return state.agent_action_requests;
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
            id: `request-${state.insertCount}`,
            created_at: now,
            accepted_at: null,
            done_at: null,
            dismissed_at: null,
            ...this.insertPayload,
          };
          state.agent_action_requests.push(row);
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

test("action request create rejects unknown packages and blank request types", async () => {
  const supabase = createActionRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createAgentActionRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      packageKey: "unknown_package",
      requestType: "booking_request",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "unknown_agent_package_key");
      return true;
    }
  );

  await assert.rejects(
    () => createAgentActionRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      packageKey: "hotel_concierge",
      requestType: "missing.action",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "unknown_action_request_type");
      return true;
    }
  );

  await assert.rejects(
    () => createAgentActionRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      requestType: "   ",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "request_type_required");
      return true;
    }
  );

  assert.equal(supabase.state.agent_action_requests.length, 0);
});

test("action request create rejects package/action mismatches before insert", async () => {
  const supabase = createActionRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createAgentActionRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      packageKey: "front_desk_general",
      requestType: "hotel.bring_water",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "package_action_not_allowed");
      return true;
    }
  );

  assert.equal(supabase.state.agent_action_requests.length, 0);
});

test("action request create verifies the owner-scoped agent before insert", async () => {
  const supabase = createActionRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-2", business_id: "business-1" }],
  });

  await assert.rejects(
    () => createAgentActionRequest(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      packageKey: "hotel_concierge",
      requestType: "hotel.staff_help",
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "agent_not_found");
      return true;
    }
  );

  assert.equal(supabase.state.agent_action_requests.length, 0);
});

test("action request create persists a hotel request with guest context and payload", async () => {
  const supabase = createActionRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createAgentActionRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    packageKey: "hotel_concierge",
    requestType: "hotel.room_service_request",
    visitorSessionKey: "visitor-session-1",
    conversationSource: "full_page_front_desk",
    displayMode: "page",
    guestContext: { roomNumber: "412", guestName: "Avery Stone" },
    payload: { items: ["sparkling water"], requestedAt: "evening" },
    sourceMessage: "Can I get sparkling water sent to room 412?",
  });

  assert.equal(request.id, "request-1");
  assert.equal(request.ownerUserId, "owner-1");
  assert.equal(request.agentId, "agent-1");
  assert.equal(request.businessId, "business-1");
  assert.equal(request.packageKey, "hotel_concierge");
  assert.equal(request.requestType, "hotel.room_service_request");
  assert.equal(request.status, "new");
  assert.deepEqual(request.guestContext, { roomNumber: "412", guestName: "Avery Stone" });
  assert.deepEqual(request.payload, { items: ["sparkling water"], requestedAt: "evening" });
});

test("action request create stores empty objects for malformed guest context and payload", async () => {
  const supabase = createActionRequestSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1", business_id: "business-1" }],
  });

  const request = await createAgentActionRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    packageKey: "hotel_concierge",
    requestType: "hotel.staff_help",
    guestContext: ["not", "plain"],
    payload: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.deepEqual(request.guestContext, {});
  assert.deepEqual(request.payload, {});
});

test("action request list is owner-scoped and supports status, package, and type filters", async () => {
  const supabase = createActionRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        package_key: "hotel_concierge",
        request_type: "hotel.room_service_request",
        status: "accepted",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "request-2",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        package_key: "front_desk_general",
        request_type: "lead_follow_up",
        status: "accepted",
        created_at: "2026-06-01T11:00:00.000Z",
      },
      {
        id: "request-3",
        owner_user_id: "owner-2",
        agent_id: "agent-2",
        package_key: "hotel_concierge",
        request_type: "hotel.room_service_request",
        status: "accepted",
        created_at: "2026-06-01T12:00:00.000Z",
      },
    ],
  });

  const requests = await listAgentActionRequests(supabase, {
    ownerUserId: "owner-1",
    status: "accepted",
    packageKey: "hotel_concierge",
    requestType: "hotel.room_service_request",
    limit: 10,
  });

  assert.deepEqual(requests.map((request) => request.id), ["request-1"]);
});

test("action request list ignores blank package filter from dashboard routes", async () => {
  const supabase = createActionRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        package_key: "hotel_concierge",
        request_type: "hotel.room_service_request",
        status: "new",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "request-2",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        package_key: "front_desk_general",
        request_type: "lead_follow_up",
        status: "new",
        created_at: "2026-06-01T11:00:00.000Z",
      },
    ],
  });

  const requests = await listAgentActionRequests(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    packageKey: undefined,
    limit: 10,
  });

  assert.deepEqual(requests.map((request) => request.id), ["request-2", "request-1"]);
});

test("action request status updates are owner-scoped and timestamp lifecycle fields", async () => {
  const supabase = createActionRequestSupabase({
    requests: [
      {
        id: "request-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        package_key: "hotel_concierge",
        request_type: "hotel.room_service_request",
        status: "new",
        accepted_at: null,
        done_at: null,
        dismissed_at: null,
      },
    ],
  });

  await assert.rejects(
    () => updateAgentActionRequestStatus(supabase, {
      ownerUserId: "owner-2",
      requestId: "request-1",
      status: "accepted",
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    }
  );

  const accepted = await updateAgentActionRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "accepted",
    staffNotes: "Night team accepted this.",
  });

  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.staffNotes, "Night team accepted this.");
  assert.match(accepted.acceptedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(accepted.doneAt, null);
  assert.equal(accepted.dismissedAt, null);

  const done = await updateAgentActionRequestStatus(supabase, {
    ownerUserId: "owner-1",
    requestId: "request-1",
    status: "done",
    staffNotes: "   ",
  });

  assert.equal(done.status, "done");
  assert.equal(done.staffNotes, "");
  assert.equal(done.acceptedAt, accepted.acceptedAt);
  assert.match(done.doneAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("action request schema, migration catalog, indexes, constraints, and RLS policy are present", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(ACTION_REQUEST_MIGRATION, "utf8");
  const recoverySql = readFileSync("docs/sql/prod_recovery_full_current_main.sql", "utf8");

  assert.equal(
    SUPABASE_MIGRATION_FILE_BY_ID.agent_action_requests,
    ACTION_REQUEST_MIGRATION
  );

  [schemaSql, migrationSql, recoverySql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.agent_action_requests/i);
    assert.match(sql, /owner_user_id uuid not null/i);
    assert.match(sql, /agent_id uuid not null references public\.agents \(id\) on delete cascade/i);
    assert.match(sql, /business_id uuid references public\.businesses \(id\) on delete set null/i);
    assert.match(sql, /guest_context jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /payload jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /agent_action_requests_status_check/i);
    assert.match(sql, /check \(status in \('new', 'accepted', 'done', 'dismissed'\)\)/i);
    assert.match(sql, /agent_action_requests_package_key_check/i);
    assert.match(sql, /check \(package_key in \('front_desk_general', 'hotel_concierge'\)\)/i);
    assert.match(sql, /agent_action_requests_request_type_nonblank_check/i);
    assert.match(sql, /check \(length\(btrim\(request_type\)\) > 0\)/i);
    assert.match(sql, /agent_action_requests_owner_created_idx/i);
    assert.match(sql, /agent_action_requests_agent_created_idx/i);
    assert.match(sql, /agent_action_requests_owner_status_created_idx/i);
    assert.match(sql, /agent_action_requests_package_type_created_idx/i);
    assert.match(sql, /alter table public\.agent_action_requests enable row level security/i);
    assert.match(sql, /Owners can read action requests/i);
    assert.match(sql, /for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) is not null and owner_user_id = \(select auth\.uid\(\)\)\)/i);
    assert.doesNotMatch(sql, /on public\.agent_action_requests\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.agent_action_requests\s+for update/i);
  });
});

test("widget, embed, and routes do not wire action request creation", () => {
  const forbiddenPaths = [
    "frontend/widget.html",
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
      /agentActionRequestService|hotelConciergeActionDraftService|actionRequestRegistry|createAgentActionRequest|listAgentActionRequests|updateAgentActionRequestStatus/,
      `${filePath} should not import or call action request internals`
    );
  });

  const routeSource = readFileSync("src/routes/agentRoutes.js", "utf8");
  assert.doesNotMatch(routeSource, /\bcreateAgentActionRequest\b/);
});
