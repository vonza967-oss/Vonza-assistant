import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  listConnectedAppInboundThreads,
  resolveConnectedAppInboundThread,
  updateConnectedAppInboundThreadStatus,
} from "../src/services/integrations/connectedAppInboundThreadService.js";

const MIGRATION_SQL = readFileSync(
  "supabase/migrations/20260603133000_connected_app_inbound_threads.sql",
  "utf8"
);
const SCHEMA_SQL = readFileSync("db/schema.sql", "utf8");
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OWNER_ID = "99999999-9999-4999-8999-999999999999";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub({ threads = [], events = [] } = {}) {
  const state = {
    connected_app_inbound_threads: threads.map(clone),
    connected_app_inbound_events: events.map(clone),
    insertCounts: {
      connected_app_inbound_threads: threads.length,
      connected_app_inbound_events: events.length,
    },
  };

  function rowsFor(table) {
    if (!Object.hasOwn(state, table)) {
      throw new Error(`Unexpected table ${table}`);
    }

    return state[table];
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.insertPayload = null;
      this.updatePayload = null;
      this.orderSpec = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value, type: "eq" });
      return this;
    }

    is(column, value) {
      this.filters.push({ column, value, type: "is" });
      return this;
    }

    insert(payload) {
      this.insertPayload = clone(payload);
      return this;
    }

    update(payload) {
      this.updatePayload = clone(payload);
      return this;
    }

    order(column, options = {}) {
      this.orderSpec = { column, ascending: options.ascending !== false };
      return this;
    }

    matches(row) {
      return this.filters.every(({ column, value, type }) => {
        if (type === "is") {
          return row[column] === value;
        }

        return row[column] === value;
      });
    }

    resolveRows() {
      let rows = rowsFor(this.table).filter((row) => this.matches(row));

      if (this.orderSpec) {
        const { column, ascending } = this.orderSpec;
        rows = [...rows].sort((left, right) => {
          const result = String(left[column] || "").localeCompare(String(right[column] || ""));
          return ascending ? result : -result;
        });
      }

      return rows.map(clone);
    }

    async maybeSingle() {
      const row = rowsFor(this.table).find((candidate) => this.matches(candidate));

      if (this.updatePayload && row) {
        Object.assign(row, this.updatePayload);
      }

      return {
        data: row ? clone(row) : null,
        error: null,
      };
    }

    async single() {
      if (!this.insertPayload) {
        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      }

      const duplicate = rowsFor(this.table).find((row) =>
        row.owner_user_id === this.insertPayload.owner_user_id
        && row.connection_id === this.insertPayload.connection_id
        && row.provider === this.insertPayload.provider
        && row.app_key === this.insertPayload.app_key
        && row.capability_key === this.insertPayload.capability_key
        && (row.agent_id || null) === (this.insertPayload.agent_id || null)
        && row.external_thread_key_hash === this.insertPayload.external_thread_key_hash
      );

      if (duplicate) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        };
      }

      state.insertCounts[this.table] += 1;
      const now = new Date().toISOString();
      const row = {
        id: `thread-${state.insertCounts[this.table]}`,
        created_at: now,
        updated_at: now,
        ...this.insertPayload,
      };

      rowsFor(this.table).push(row);
      return {
        data: clone(row),
        error: null,
      };
    }

    async limit(limit) {
      return {
        data: this.resolveRows().slice(0, limit),
        error: null,
      };
    }
  }

  return {
    state,
    from(table) {
      return new QueryBuilder(table);
    },
  };
}

function safeEvent(overrides = {}) {
  return {
    id: "event-1",
    providerEventType: "message",
    providerTimestamp: "2026-06-03T10:00:00.000Z",
    receivedAt: "2026-06-03T10:00:01.000Z",
    normalized: {
      eventType: "message",
      messageType: "text",
      metadata: {
        hasText: true,
        textLength: 41,
        contactPresent: true,
      },
    },
    duplicate: false,
    ...overrides,
  };
}

function safeThreadInput(overrides = {}) {
  return {
    ownerUserId: OWNER_ID,
    connectionId: CONNECTION_ID,
    agentId: null,
    provider: "whatsapp",
    appKey: "whatsapp.business",
    capabilityKey: "whatsapp.business.webhook",
    externalThreadKey: "whatsapp-test-sender",
    externalThreadLabel: "+15551234567",
    event: safeEvent(),
    metadata: {
      source: "test",
      inboundReviewOnly: true,
      noOutboundMessaging: true,
      noAiReplies: true,
      noAiHandoff: true,
    },
    ...overrides,
  };
}

test("connected app inbound thread schema and RLS are present", () => {
  assert.match(SCHEMA_SQL, /create table if not exists public\.connected_app_inbound_threads/i);
  assert.match(MIGRATION_SQL, /status text not null default 'open'/i);
  assert.match(MIGRATION_SQL, /unread_count integer not null default 0/i);
  assert.match(MIGRATION_SQL, /connected_app_inbound_threads_owner_external_idx/i);
  assert.match(MIGRATION_SQL, /alter table public\.connected_app_inbound_threads enable row level security/i);
  assert.match(MIGRATION_SQL, /for select\s+to authenticated/i);
  assert.doesNotMatch(MIGRATION_SQL, /to anon/i);
  assert.doesNotMatch(MIGRATION_SQL, /for (?:insert|update|delete|all)\s+to authenticated/i);
});

test("resolve connected app inbound thread creates redacted WhatsApp thread and attaches event", async () => {
  const supabase = createSupabaseStub({
    events: [
      {
        id: "event-1",
        owner_user_id: OWNER_ID,
        thread_id: null,
        metadata: {},
      },
    ],
  });
  const thread = await resolveConnectedAppInboundThread(supabase, safeThreadInput());
  const serialized = JSON.stringify(supabase.state);

  assert.equal(thread.id, "thread-1");
  assert.equal(thread.externalThreadLabel, "WhatsApp conversation");
  assert.equal(thread.status, "open");
  assert.equal(thread.lastEventId, "event-1");
  assert.equal(thread.lastEventType, "message");
  assert.equal(thread.lastMessageType, "text");
  assert.equal(thread.unreadCount, 1);
  assert.equal(supabase.state.connected_app_inbound_events[0].thread_id, "thread-1");
  assert.equal(serialized.includes("whatsapp-test-sender"), false);
  assert.equal(serialized.includes("+15551234567"), false);
  assert.equal(serialized.includes("Please book"), false);
});

test("resolve connected app inbound thread reuses thread and duplicate messages do not increment unread", async () => {
  const supabase = createSupabaseStub();
  const first = await resolveConnectedAppInboundThread(supabase, safeThreadInput());
  const second = await resolveConnectedAppInboundThread(supabase, safeThreadInput({
    event: safeEvent({
      id: "event-1",
      duplicate: true,
    }),
    duplicate: true,
  }));

  assert.equal(first.id, second.id);
  assert.equal(supabase.state.connected_app_inbound_threads.length, 1);
  assert.equal(second.unreadCount, 1);
});

test("status events update last event but do not increment unread count", async () => {
  const supabase = createSupabaseStub();
  await resolveConnectedAppInboundThread(supabase, safeThreadInput());
  const statusThread = await resolveConnectedAppInboundThread(supabase, safeThreadInput({
    event: safeEvent({
      id: "event-status",
      providerEventType: "status",
      providerTimestamp: "2026-06-03T10:05:00.000Z",
      normalized: {
        eventType: "status",
        messageType: "",
        status: "delivered",
        metadata: {},
      },
    }),
  }));

  assert.equal(statusThread.lastEventId, "event-status");
  assert.equal(statusThread.lastEventType, "status");
  assert.equal(statusThread.lastMessageType, null);
  assert.equal(statusThread.unreadCount, 1);
  assert.equal(supabase.state.connected_app_inbound_threads.length, 1);
});

test("connected app inbound thread list and status updates are owner scoped", async () => {
  const supabase = createSupabaseStub();
  const ownerThread = await resolveConnectedAppInboundThread(supabase, safeThreadInput());
  await resolveConnectedAppInboundThread(supabase, safeThreadInput({
    ownerUserId: OTHER_OWNER_ID,
    externalThreadKey: "other-whatsapp-test-sender",
    event: safeEvent({
      id: "event-other",
    }),
  }));

  const ownerThreads = await listConnectedAppInboundThreads(supabase, {
    ownerUserId: OWNER_ID,
    provider: "whatsapp",
  });
  const updated = await updateConnectedAppInboundThreadStatus(supabase, {
    ownerUserId: OWNER_ID,
    threadId: ownerThread.id,
    status: "reviewing",
  });

  assert.deepEqual(ownerThreads.map((thread) => thread.id), [ownerThread.id]);
  assert.equal(updated.status, "reviewing");
  assert.equal(updated.unreadCount, 0);

  await assert.rejects(
    () => updateConnectedAppInboundThreadStatus(supabase, {
      ownerUserId: OWNER_ID,
      threadId: "thread-2",
      status: "resolved",
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

test("connected app inbound thread rejects unsafe metadata", async () => {
  const cases = [
    safeThreadInput({
      metadata: {
        contactPhone: "+15551234567",
      },
    }),
    safeThreadInput({
      metadata: {
        messageBody: "Please book the suite.",
      },
    }),
    safeThreadInput({
      metadata: {
        endpointUrl: "https://provider.example.invalid/webhook",
      },
    }),
    safeThreadInput({
      metadata: {
        token: "redacted-test-token",
      },
    }),
  ];

  for (const input of cases) {
    const supabase = createSupabaseStub();
    await assert.rejects(
      () => resolveConnectedAppInboundThread(supabase, input),
      /Connected app inbound threads do not accept/
    );
    assert.equal(supabase.state.connected_app_inbound_threads.length, 0);
  }
});
