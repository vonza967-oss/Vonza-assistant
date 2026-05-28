import test from "node:test";
import assert from "node:assert/strict";

import { normalizePublicConversationSource } from "../src/services/chat/chatService.js";
import { storeAgentMessages } from "../src/services/chat/messageService.js";

function createMessageSupabaseStub({ rejectDisplayMode = false } = {}) {
  const state = {
    messages: [],
    insertAttempts: [],
  };

  return {
    state,
    from(table) {
      assert.equal(table, "messages");
      return {
        insert(values) {
          const rows = Array.isArray(values) ? values : [values];
          state.insertAttempts.push(rows.map((row) => ({ ...row })));
          return {
            select() {
              if (rejectDisplayMode && rows.some((row) => Object.hasOwn(row, "display_mode"))) {
                return Promise.resolve({
                  data: null,
                  error: {
                    code: "42703",
                    message: "column messages.display_mode does not exist",
                  },
                });
              }

              const saved = rows.map((row, index) => ({
                id: `message-${state.messages.length + index + 1}`,
                ...row,
              }));
              state.messages.push(...saved);
              return Promise.resolve({
                data: saved,
                error: null,
              });
            },
          };
        },
      };
    },
  };
}

test("message persistence records public assistant display mode", async () => {
  const supabase = createMessageSupabaseStub();

  const rows = await storeAgentMessages(
    supabase,
    "agent-1",
    [
      { role: "user", content: "Can I book?" },
      { role: "assistant", content: "Yes, here is the next step." },
    ],
    {
      sessionKey: "session-1",
      displayMode: "page",
      visitorIdentity: { mode: "guest" },
    }
  );

  assert.equal(supabase.state.messages.length, 2);
  assert.equal(supabase.state.messages[0].display_mode, "page");
  assert.equal(supabase.state.messages[1].display_mode, "page");
  assert.equal(rows[0].displayMode, "page");
});

test("message persistence records sanitized Web Call source without changing request display mode", async () => {
  const supabase = createMessageSupabaseStub();

  const rows = await storeAgentMessages(
    supabase,
    "agent-1",
    [
      { role: "user", content: "Can I talk to the front desk?" },
      { role: "assistant", content: "Yes, I can help by voice." },
    ],
    {
      sessionKey: "session-web-call",
      displayMode: "page",
      conversationSource: "web_call",
      webCallSessionId: "web-call-session-1",
    }
  );

  assert.equal(supabase.state.messages.length, 2);
  assert.equal(supabase.state.messages[0].display_mode, "web_call");
  assert.equal(supabase.state.messages[1].display_mode, "web_call");
  assert.equal(supabase.state.messages[0].web_call_session_id, "web-call-session-1");
  assert.equal(rows[0].displayMode, "web_call");
  assert.equal(rows[0].webCallSessionId, "web-call-session-1");
});

test("message persistence ignores unsupported public source values", async () => {
  const supabase = createMessageSupabaseStub();

  await storeAgentMessages(
    supabase,
    "agent-1",
    [{ role: "user", content: "Hello" }],
    {
      sessionKey: "session-page",
      displayMode: "page",
      conversationSource: "owner_user_id",
    }
  );

  assert.equal(supabase.state.messages[0].display_mode, "page");
});

test("public conversation source accepts only hosted page Web Call", () => {
  assert.equal(normalizePublicConversationSource("web_call", { displayMode: "page" }), "web_call");
  assert.equal(normalizePublicConversationSource("Web Call", { displayMode: "page" }), "web_call");
  assert.equal(normalizePublicConversationSource("web_call", { displayMode: "widget" }), "");
  assert.equal(normalizePublicConversationSource("owner_user_id", { displayMode: "page" }), "");
});

test("message persistence falls back safely before display mode migration is applied", async () => {
  const supabase = createMessageSupabaseStub({ rejectDisplayMode: true });

  await storeAgentMessages(
    supabase,
    "agent-1",
    [{ role: "user", content: "Hello" }],
    {
      sessionKey: "session-1",
      displayMode: "page",
    }
  );

  assert.equal(supabase.state.insertAttempts.length, 3);
  assert.equal(supabase.state.insertAttempts[0][0].display_mode, "page");
  assert.equal(Object.hasOwn(supabase.state.insertAttempts[1][0], "web_call_session_id"), false);
  assert.equal(supabase.state.insertAttempts[1][0].display_mode, "page");
  assert.equal(Object.hasOwn(supabase.state.insertAttempts[2][0], "display_mode"), false);
  assert.equal(Object.hasOwn(supabase.state.insertAttempts[2][0], "web_call_session_id"), false);
  assert.equal(supabase.state.messages.length, 1);
});
