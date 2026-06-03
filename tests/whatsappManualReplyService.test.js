import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sendWhatsAppManualReply,
} from "../src/services/integrations/whatsappManualReplyService.js";

const MIGRATION_SQL = readFileSync(
  "supabase/migrations/20260603133840_connected_app_outbound_messages.sql",
  "utf8"
);
const SCHEMA_SQL = readFileSync("db/schema.sql", "utf8");
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OWNER_ID = "99999999-9999-4999-8999-999999999999";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";
const AGENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-06-03T12:00:00.000Z";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub({
  connections = [whatsappConnection()],
  threads = [whatsappThread()],
  enablements = [],
  outboundMessages = [],
} = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    connected_app_inbound_threads: threads.map(clone),
    agent_connected_app_enablements: enablements.map(clone),
    connected_app_outbound_messages: outboundMessages.map(clone),
    insertCounts: {
      connected_app_outbound_messages: outboundMessages.length,
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

    matches(row) {
      return this.filters.every(({ column, value }) => row[column] === value);
    }

    resolveRows() {
      return rowsFor(this.table).filter((row) => this.matches(row)).map(clone);
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

      state.insertCounts[this.table] = (state.insertCounts[this.table] || 0) + 1;
      const row = {
        id: `outbound-${state.insertCounts[this.table]}`,
        created_at: NOW,
        updated_at: NOW,
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

function whatsappConnection(overrides = {}) {
  return {
    id: CONNECTION_ID,
    owner_user_id: OWNER_ID,
    provider: "whatsapp",
    app_key: "whatsapp.business",
    capability_keys: [
      "whatsapp.business.webhook",
      "whatsapp.business.send.session.reply",
      "whatsapp.business.send.template",
    ],
    status: "active",
    webhook_status: "active",
    token_secret_ref: "vault/whatsapp/manual-reply-token",
    metadata: {
      phoneNumberId: "987654321098765",
      graphApiVersion: "v25.0",
    },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function whatsappThread(overrides = {}) {
  return {
    id: THREAD_ID,
    owner_user_id: OWNER_ID,
    connection_id: CONNECTION_ID,
    agent_id: null,
    provider: "whatsapp",
    app_key: "whatsapp.business",
    capability_key: "whatsapp.business.webhook",
    external_thread_key_hash: "a".repeat(64),
    status: "open",
    last_event_at: NOW,
    last_event_type: "message",
    last_message_type: "text",
    metadata: {
      inboundReviewOnly: true,
      noAutomaticWhatsAppMessages: true,
      noAiReplies: true,
      noAiHandoff: true,
      lastInboundMessageAt: NOW,
    },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function whatsappEnablement(overrides = {}) {
  return {
    id: "enablement-1",
    owner_user_id: OWNER_ID,
    agent_id: AGENT_ID,
    connection_id: CONNECTION_ID,
    capability_keys: ["whatsapp.business.send.session.reply"],
    enabled: true,
    approval_mode: "manual_review",
    allowed_surfaces: ["dashboard"],
    metadata: {},
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    ownerUserId: OWNER_ID,
    actorOwnerUserId: OWNER_ID,
    threadId: THREAD_ID,
    messageText: "Thanks, we can help with that request.",
    ...overrides,
  };
}

function enabledDeps(overrides = {}) {
  return {
    env: {
      WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
    },
    now: NOW,
    getWhatsAppCloudApiCredentials: async () => ({ accessToken: "server-side-token" }),
    getWhatsAppDestinationRef: async () => ({ destinationRef: "+15551234567" }),
    whatsappProviderClient: async () => ({
      messages: [{ id: "wamid.sent", message_status: "accepted" }],
    }),
    ...overrides,
  };
}

test("connected app outbound message schema and RLS are present", () => {
  assert.match(SCHEMA_SQL, /create table if not exists public\.connected_app_outbound_messages/i);
  assert.match(MIGRATION_SQL, /destination_ref_hash text not null/i);
  assert.match(MIGRATION_SQL, /message_type text not null/i);
  assert.match(MIGRATION_SQL, /status text not null default 'blocked'/i);
  assert.match(MIGRATION_SQL, /connected_app_outbound_messages_status_check/i);
  assert.match(MIGRATION_SQL, /alter table public\.connected_app_outbound_messages enable row level security/i);
  assert.match(MIGRATION_SQL, /grant select on table public\.connected_app_outbound_messages to authenticated/i);
  assert.match(MIGRATION_SQL, /for select\s+to authenticated/i);
  assert.doesNotMatch(MIGRATION_SQL, /for (?:insert|update|delete|all)\s+to authenticated/i);
  assert.doesNotMatch(MIGRATION_SQL, /to anon/i);
});

test("feature flag off blocks manual WhatsApp send and records blocked audit", async () => {
  const supabase = createSupabaseStub();
  const providerCalls = [];

  await assert.rejects(
    () => sendWhatsAppManualReply(supabase, baseInput(), {
      env: {},
      now: NOW,
      whatsappProviderClient: async () => providerCalls.push("called"),
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_replies_disabled");
      assert.equal(error.outbound.status, "blocked");
      return true;
    }
  );

  assert.deepEqual(providerCalls, []);
  assert.equal(supabase.state.connected_app_outbound_messages.length, 1);
  assert.equal(supabase.state.connected_app_outbound_messages[0].status, "blocked");
});

test("owner cannot reply to another owner's WhatsApp thread", async () => {
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ owner_user_id: OTHER_OWNER_ID })],
  });

  await assert.rejects(
    () => sendWhatsAppManualReply(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "connected_app_inbound_thread_not_found");
      return true;
    }
  );

  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});

test("actor owner must match authenticated owner context", async () => {
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => sendWhatsAppManualReply(
      supabase,
      baseInput({ actorOwnerUserId: OTHER_OWNER_ID }),
      enabledDeps()
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_actor_owner_mismatch");
      return true;
    }
  );

  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});

test("inactive WhatsApp connection blocks manual send", async () => {
  const supabase = createSupabaseStub({
    connections: [whatsappConnection({ status: "disabled" })],
  });

  await assert.rejects(
    () => sendWhatsAppManualReply(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_connection_inactive");
      assert.equal(error.outbound.status, "blocked");
      return true;
    }
  );

  assert.equal(supabase.state.connected_app_outbound_messages[0].status, "blocked");
});

test("agent-scoped thread requires explicit enabled agent capability", async () => {
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ agent_id: AGENT_ID })],
  });

  await assert.rejects(
    () => sendWhatsAppManualReply(
      supabase,
      baseInput({ agentId: AGENT_ID }),
      enabledDeps()
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_agent_enablement_missing");
      assert.equal(error.outbound.status, "blocked");
      return true;
    }
  );

  assert.equal(supabase.state.connected_app_outbound_messages[0].status, "blocked");
});

test("missing session-window proof blocks text session reply", async () => {
  const supabase = createSupabaseStub({
    threads: [
      whatsappThread({
        last_event_at: null,
        last_event_type: "status",
        metadata: {
          inboundReviewOnly: true,
          noAutomaticWhatsAppMessages: true,
        },
      }),
    ],
  });

  await assert.rejects(
    () => sendWhatsAppManualReply(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_session_window_missing");
      return true;
    }
  );
});

test("outside customer-service window blocks text session reply", async () => {
  const supabase = createSupabaseStub({
    threads: [
      whatsappThread({
        last_event_at: "2026-06-01T10:00:00.000Z",
        metadata: {
          lastInboundMessageAt: "2026-06-01T10:00:00.000Z",
        },
      }),
    ],
  });

  await assert.rejects(
    () => sendWhatsAppManualReply(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_session_window_missing");
      return true;
    }
  );
});

test("inside session window calls provider only when feature enabled and records redacted sent audit", async () => {
  const providerCalls = [];
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ agent_id: AGENT_ID })],
    enablements: [whatsappEnablement()],
  });
  const outbound = await sendWhatsAppManualReply(
    supabase,
    baseInput({
      agentId: AGENT_ID,
      messageText: "Manual reply that should not be stored in audit text.",
    }),
    enabledDeps({
      whatsappProviderClient: async (request) => {
        providerCalls.push(request);
        return {
          messages: [{ id: "wamid.manual.sent", message_status: "accepted" }],
        };
      },
    })
  );

  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0].payload.type, "text");
  assert.equal(providerCalls[0].payload.text.body, "Manual reply that should not be stored in audit text.");
  assert.equal(outbound.status, "sent");
  assert.equal(outbound.providerMessageId, "wamid.manual.sent");
  assert.match(outbound.bodyRedacted, /manual staff text redacted: 53 chars/);
  assert.equal(JSON.stringify(supabase.state.connected_app_outbound_messages).includes("should not be stored"), false);
});

test("missing credential lookup blocks before provider call", async () => {
  const providerCalls = [];
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => sendWhatsAppManualReply(
      supabase,
      baseInput(),
      enabledDeps({
        getWhatsAppCloudApiCredentials: undefined,
        whatsappProviderClient: async () => providerCalls.push("called"),
      })
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_credential_lookup_missing");
      assert.equal(error.outbound.status, "blocked");
      return true;
    }
  );

  assert.deepEqual(providerCalls, []);
});

test("template sends are blocked until approved-template support is implemented", async () => {
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => sendWhatsAppManualReply(
      supabase,
      baseInput({
        messageType: "template",
        messageText: "",
        templateName: "appointment_followup",
        templateLanguage: "en_US",
      }),
      enabledDeps()
    ),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_manual_reply_template_unsupported");
      assert.equal(error.outbound.status, "blocked");
      return true;
    }
  );
});

test("provider failure records failed audit row with redacted error", async () => {
  const supabase = createSupabaseStub();
  const outbound = await sendWhatsAppManualReply(
    supabase,
    baseInput(),
    enabledDeps({
      whatsappProviderClient: async () => {
        const error = new Error("raw phone +15551234567 and token EAAFakeMetaAccessTokenValue1234567890");
        error.statusCode = 429;
        error.code = "rate_limit";
        throw error;
      },
    })
  );

  assert.equal(outbound.status, "failed");
  assert.equal(outbound.errorCode, "rate_limit");
  assert.equal(outbound.errorMessageRedacted, "Provider request failed with HTTP 429 (rate_limit).");
  assert.equal(JSON.stringify(supabase.state.connected_app_outbound_messages).includes("+15551234567"), false);
  assert.equal(JSON.stringify(supabase.state.connected_app_outbound_messages).includes("EAAFake"), false);
});
