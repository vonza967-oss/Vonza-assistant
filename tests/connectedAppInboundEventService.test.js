import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createConnectedAppInboundEvent,
  listConnectedAppInboundEvents,
} from "../src/services/integrations/connectedAppInboundEventService.js";

const MIGRATION_SQL = readFileSync(
  "supabase/migrations/20260603105759_connected_app_inbound_events.sql",
  "utf8"
);
const SCHEMA_SQL = readFileSync("db/schema.sql", "utf8");
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub({ events = [] } = {}) {
  const state = {
    connected_app_inbound_events: events.map(clone),
    insertCount: events.length,
  };

  function rowsFor(table) {
    if (table !== "connected_app_inbound_events") {
      throw new Error(`Unexpected table ${table}`);
    }

    return state.connected_app_inbound_events;
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.insertPayload = null;
      this.orderSpec = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    insert(payload) {
      this.insertPayload = clone(payload);
      return this;
    }

    order(column, options = {}) {
      this.orderSpec = { column, ascending: options.ascending !== false };
      return this;
    }

    resolveRows() {
      let rows = rowsFor(this.table).filter((row) =>
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
    }

    async maybeSingle() {
      return {
        data: this.resolveRows()[0] || null,
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
        && row.provider === this.insertPayload.provider
        && row.dedupe_key
        && row.dedupe_key === this.insertPayload.dedupe_key
      );

      if (duplicate) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        };
      }

      state.insertCount += 1;
      const now = new Date().toISOString();
      const row = {
        id: `event-${state.insertCount}`,
        created_at: now,
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

function safeWhatsAppEvent(overrides = {}) {
  return {
    ownerUserId: OWNER_ID,
    connectionId: CONNECTION_ID,
    provider: "WHATSAPP",
    appKey: "WHATSAPP.BUSINESS",
    capabilityKey: "WHATSAPP.BUSINESS.WEBHOOK",
    providerEventType: "message",
    providerMessageId: "wamid.test",
    providerTimestamp: "1780430000",
    sourceAccountId: "123456789012345",
    sourceChannelId: "987654321098765",
    normalized: {
      object: "whatsapp_business_account",
      entryId: "123456789012345",
      phoneNumberId: "987654321098765",
      displayPhoneNumber: "+15551230000",
      eventType: "message",
      messageId: "wamid.test",
      messageType: "text",
      timestamp: "1780430000",
      status: "",
      metadata: {
        hasText: true,
        textLength: 41,
        contactPresent: true,
      },
    },
    redactionSummary: {
      source: "test",
    },
    metadata: {
      signatureStatus: "not_configured",
    },
    receivedAt: "2026-06-03T10:10:00.000Z",
    ...overrides,
  };
}

test("connected app inbound event schema and RLS are present", () => {
  assert.match(SCHEMA_SQL, /create table if not exists public\.connected_app_inbound_events/i);
  assert.match(MIGRATION_SQL, /event_direction text not null default 'inbound'/i);
  assert.match(MIGRATION_SQL, /event_status text not null default 'received'/i);
  assert.match(MIGRATION_SQL, /connected_app_inbound_events_owner_provider_dedupe_idx/i);
  assert.match(MIGRATION_SQL, /alter table public\.connected_app_inbound_events enable row level security/i);
  assert.match(MIGRATION_SQL, /for select\s+to authenticated/i);
  assert.doesNotMatch(MIGRATION_SQL, /to anon/i);
  assert.doesNotMatch(MIGRATION_SQL, /for (?:insert|update|delete|all)\s+to authenticated/i);
});

test("create connected app inbound event stores redacted normalized summary", async () => {
  const supabase = createSupabaseStub();
  const event = await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent());

  assert.equal(event.id, "event-1");
  assert.equal(event.ownerUserId, OWNER_ID);
  assert.equal(event.provider, "whatsapp");
  assert.equal(event.appKey, "whatsapp.business");
  assert.equal(event.capabilityKey, "whatsapp.business.webhook");
  assert.equal(event.providerMessageId, "wamid.test");
  assert.equal(event.providerTimestamp, "2026-06-02T19:53:20.000Z");
  assert.equal(event.dedupeKey, "whatsapp:message:wamid.test");
  assert.equal(event.duplicate, false);
  assert.equal(event.redactionSummary.messageBodyStored, false);
  assert.equal(event.redactionSummary.contactFieldsStored, false);
  assert.equal(event.redactionSummary.providerPayloadStored, false);
  assert.equal(JSON.stringify(supabase.state.connected_app_inbound_events).includes("Please book"), false);
});

test("connected app inbound event rejects raw body contact profile and secret metadata", async () => {
  const cases = [
    safeWhatsAppEvent({
      normalized: {
        ...safeWhatsAppEvent().normalized,
        text: { body: "Please book the suite." },
      },
    }),
    safeWhatsAppEvent({
      normalized: {
        ...safeWhatsAppEvent().normalized,
        contacts: [{ wa_id: "whatsapp-test-sender", profile: { name: "Test Contact" } }],
      },
    }),
    safeWhatsAppEvent({
      metadata: {
        token: "redacted-test-token",
      },
    }),
    safeWhatsAppEvent({
      metadata: {
        webhookUrl: "https://provider.example.invalid/webhook",
      },
    }),
    safeWhatsAppEvent({
      metadata: {
        providerClient: "whatsapp-cloud-client",
      },
    }),
  ];

  for (const input of cases) {
    const supabase = createSupabaseStub();
    await assert.rejects(
      () => createConnectedAppInboundEvent(supabase, input),
      /Connected app inbound events do not accept/
    );
    assert.equal(supabase.state.connected_app_inbound_events.length, 0);
  }
});

test("connected app inbound event dedupes duplicate WhatsApp message ids", async () => {
  const supabase = createSupabaseStub();
  const first = await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent());
  const second = await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent());

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.id, first.id);
  assert.equal(supabase.state.connected_app_inbound_events.length, 1);
});

test("connected app inbound event dedupes redacted summaries without message ids", async () => {
  const supabase = createSupabaseStub();
  const unknownSummary = {
    object: "whatsapp_business_account",
    entryId: "123456789012345",
    phoneNumberId: "987654321098765",
    displayPhoneNumber: "+15551230000",
    eventType: "unknown",
    messageId: "",
    messageType: "",
    timestamp: "",
    status: "",
    metadata: {
      field: "messages",
    },
  };
  const first = await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent({
    providerEventType: "unknown",
    providerMessageId: "",
    providerTimestamp: "",
    normalized: unknownSummary,
  }));
  const second = await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent({
    providerEventType: "unknown",
    providerMessageId: "",
    providerTimestamp: "",
    normalized: {
      metadata: {
        field: "messages",
      },
      status: "",
      timestamp: "",
      messageType: "",
      messageId: "",
      eventType: "unknown",
      displayPhoneNumber: "+15551230000",
      phoneNumberId: "987654321098765",
      entryId: "123456789012345",
      object: "whatsapp_business_account",
    },
  }));

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.dedupeKey.startsWith("whatsapp:summary:"), true);
  assert.equal(second.dedupeKey, first.dedupeKey);
  assert.equal(supabase.state.connected_app_inbound_events.length, 1);
});

test("connected app inbound event list is owner scoped", async () => {
  const supabase = createSupabaseStub();
  await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent({
    providerMessageId: "wamid.owner",
    normalized: {
      ...safeWhatsAppEvent().normalized,
      messageId: "wamid.owner",
    },
  }));
  await createConnectedAppInboundEvent(supabase, safeWhatsAppEvent({
    ownerUserId: "99999999-9999-4999-8999-999999999999",
    providerMessageId: "wamid.other",
    normalized: {
      ...safeWhatsAppEvent().normalized,
      messageId: "wamid.other",
    },
  }));

  const events = await listConnectedAppInboundEvents(supabase, {
    ownerUserId: OWNER_ID,
    provider: "whatsapp",
  });

  assert.deepEqual(events.map((event) => event.providerMessageId), ["wamid.owner"]);
});

test("connected app inbound event DTOs redact unsafe stored JSON fields", async () => {
  const supabase = createSupabaseStub({
    events: [
      {
        id: "event-unsafe",
        owner_user_id: OWNER_ID,
        connection_id: CONNECTION_ID,
        agent_id: null,
        provider: "whatsapp",
        app_key: "whatsapp.business",
        capability_key: "whatsapp.business.webhook",
        provider_event_id: null,
        provider_event_type: "message",
        provider_message_id: "wamid.unsafe",
        provider_timestamp: null,
        source_account_id: "123456789012345",
        source_channel_id: "987654321098765",
        event_direction: "inbound",
        event_status: "received",
        normalized: {
          payload: {
            text: {
              body: "Please book the suite.",
            },
          },
        },
        redaction_summary: {
          source: "test",
        },
        dedupe_key: "whatsapp:message:wamid.unsafe",
        metadata: {
          endpointUrl: "https://provider.example.invalid/webhook",
        },
        received_at: "2026-06-03T10:10:00.000Z",
        created_at: "2026-06-03T10:10:00.000Z",
      },
    ],
  });

  const events = await listConnectedAppInboundEvents(supabase, {
    ownerUserId: OWNER_ID,
  });

  assert.deepEqual(events[0].normalized, { unsafeRedacted: true });
  assert.deepEqual(events[0].metadata, { unsafeRedacted: true });
  assert.equal(JSON.stringify(events).includes("Please book"), false);
  assert.equal(JSON.stringify(events).includes("provider.example.invalid"), false);
});
