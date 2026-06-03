import test from "node:test";
import assert from "node:assert/strict";

import {
  createWhatsAppAiReplyDraft,
  getWhatsAppAiReplyDraftFeatureStatus,
} from "../src/services/integrations/whatsappAiReplyDraftService.js";

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
  events = [whatsappEvent()],
  outboundMessages = [],
} = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    connected_app_inbound_threads: threads.map(clone),
    agent_connected_app_enablements: enablements.map(clone),
    connected_app_inbound_events: events.map(clone),
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
      this.orderSpec = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    order(column, options = {}) {
      this.orderSpec = { column, ascending: options.ascending !== false };
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
    ],
    status: "active",
    webhook_status: "active",
    metadata: {},
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

function whatsappEvent(overrides = {}) {
  return {
    id: "event-1",
    owner_user_id: OWNER_ID,
    connection_id: CONNECTION_ID,
    agent_id: null,
    provider: "whatsapp",
    provider_event_type: "message",
    event_direction: "inbound",
    event_status: "received",
    normalized_message_text: "Hi, do you have a room available tonight?",
    thread_id: THREAD_ID,
    created_at: NOW,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    ownerUserId: OWNER_ID,
    actorOwnerUserId: OWNER_ID,
    threadId: THREAD_ID,
    ...overrides,
  };
}

function enabledDeps(overrides = {}) {
  return {
    env: {
      WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
      WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "true",
    },
    now: NOW,
    openai: {
      responses: {
        create: async () => ({
          output_text: "Thanks for reaching out. A member of our team will check availability and reply shortly.",
        }),
      },
    },
    ...overrides,
  };
}

test("WhatsApp AI draft feature flag is off by default and strict when enabled", () => {
  assert.deepEqual(getWhatsAppAiReplyDraftFeatureStatus({}), {
    enabled: false,
    status: "disabled",
  });
  assert.equal(getWhatsAppAiReplyDraftFeatureStatus({ WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "1" }).enabled, true);
  assert.equal(getWhatsAppAiReplyDraftFeatureStatus({ WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "true" }).enabled, true);
  assert.equal(getWhatsAppAiReplyDraftFeatureStatus({ WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "enabled" }).enabled, true);
  assert.equal(getWhatsAppAiReplyDraftFeatureStatus({ WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "on" }).enabled, true);
  assert.equal(getWhatsAppAiReplyDraftFeatureStatus({ WHATSAPP_AI_REPLY_DRAFTS_ENABLED: "yes" }).enabled, false);
});

test("feature flag off blocks draft and does not call OpenAI", async () => {
  const supabase = createSupabaseStub();
  let openaiCalls = 0;

  await assert.rejects(
    () => createWhatsAppAiReplyDraft(supabase, baseInput(), {
      env: {
        WHATSAPP_MANUAL_REPLIES_ENABLED: "true",
      },
      getOpenAIClient: () => {
        openaiCalls += 1;
        return {};
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_ai_reply_drafts_disabled");
      return true;
    }
  );

  assert.equal(openaiCalls, 0);
  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});

test("owner cannot draft for another owner's WhatsApp thread", async () => {
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ owner_user_id: OTHER_OWNER_ID })],
  });

  await assert.rejects(
    () => createWhatsAppAiReplyDraft(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "connected_app_inbound_thread_not_found");
      return true;
    }
  );
});

test("inactive connection blocks WhatsApp AI draft", async () => {
  const supabase = createSupabaseStub({
    connections: [whatsappConnection({ status: "disabled" })],
  });

  await assert.rejects(
    () => createWhatsAppAiReplyDraft(supabase, baseInput(), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_ai_reply_draft_connection_inactive");
      return true;
    }
  );
});

test("missing agent enablement blocks draft when thread is agent-scoped", async () => {
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ agent_id: AGENT_ID })],
  });

  await assert.rejects(
    () => createWhatsAppAiReplyDraft(supabase, baseInput({ agentId: AGENT_ID }), enabledDeps()),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "whatsapp_ai_reply_draft_agent_enablement_missing");
      return true;
    }
  );
});

test("insufficient stored context returns safe no-draft response without OpenAI", async () => {
  const supabase = createSupabaseStub({
    events: [whatsappEvent({ normalized_message_text: null })],
  });
  let openaiCalls = 0;
  const result = await createWhatsAppAiReplyDraft(
    supabase,
    baseInput(),
    enabledDeps({
      getOpenAIClient: () => {
        openaiCalls += 1;
        return {};
      },
      openai: null,
    })
  );

  assert.equal(result.status, "insufficient_context");
  assert.equal(result.draftText, "");
  assert.equal(result.noProviderSend, true);
  assert.equal(openaiCalls, 0);
  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});

test("OpenAI failure returns a safe unavailable error", async () => {
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => createWhatsAppAiReplyDraft(
      supabase,
      baseInput(),
      enabledDeps({
        openai: {
          responses: {
            create: async () => {
              throw new Error("raw OpenAI sk-secret provider stack");
            },
          },
        },
      })
    ),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "whatsapp_ai_reply_model_unavailable");
      assert.doesNotMatch(error.message, /sk-secret|provider stack|OpenAI/);
      return true;
    }
  );
});

test("generated draft is stored only as draft audit and never sent", async () => {
  const modelCalls = [];
  const providerCalls = [];
  const supabase = createSupabaseStub({
    threads: [whatsappThread({ agent_id: AGENT_ID })],
    enablements: [whatsappEnablement()],
  });
  const result = await createWhatsAppAiReplyDraft(
    supabase,
    baseInput({ agentId: AGENT_ID, staffInstructions: "Keep it concise." }),
    enabledDeps({
      openai: {
        responses: {
          create: async (payload) => {
            modelCalls.push(payload);
            return {
              output_text: "Thanks for reaching out. Our team will check availability and reply here shortly.",
            };
          },
        },
      },
      whatsappProviderClient: async () => providerCalls.push("called"),
    })
  );

  assert.equal(result.status, "draft");
  assert.match(result.draftText, /Our team will check availability/);
  assert.equal(modelCalls.length, 1);
  assert.equal(modelCalls[0].input[0].content.includes("room available tonight"), true);
  assert.deepEqual(providerCalls, []);
  assert.equal(supabase.state.connected_app_outbound_messages.length, 1);

  const audit = supabase.state.connected_app_outbound_messages[0];
  assert.equal(audit.status, "draft");
  assert.equal(audit.sent_at, null);
  assert.equal(audit.provider_message_id, null);
  assert.equal(audit.provider_status, null);
  assert.equal(audit.metadata.aiDraftOnly, true);
  assert.equal(audit.metadata.staffApprovalRequired, true);
  assert.equal(audit.metadata.noProviderSend, true);
  assert.equal(JSON.stringify(audit).includes("Our team will check availability"), false);
});

test("unsafe generated draft is blocked without exposing phone numbers or metadata", async () => {
  const supabase = createSupabaseStub();
  const result = await createWhatsAppAiReplyDraft(
    supabase,
    baseInput(),
    enabledDeps({
      openai: {
        responses: {
          create: async () => ({
            output_text: "Your booking is confirmed. Call +15551234567 with thread id 33333333-3333-4333-8333-333333333333.",
          }),
        },
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.draftText, "");
  assert.doesNotMatch(JSON.stringify(result), /\+15551234567|33333333-3333-4333-8333-333333333333/);
  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});

test("route-shaped unsafe fields are rejected before draft work", async () => {
  const supabase = createSupabaseStub();

  for (const input of [
    { phone: "+15551234567" },
    { provider_payload: { raw: true } },
    { autoSend: true },
    { message_text: "Please use this customer text" },
    { token: "sk-proj-secretsecretsecret" },
  ]) {
    await assert.rejects(
      () => createWhatsAppAiReplyDraft(supabase, baseInput(input), enabledDeps()),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "whatsapp_ai_reply_draft_unsafe_field_rejected");
        return true;
      }
    );
  }

  assert.equal(supabase.state.connected_app_outbound_messages.length, 0);
});
