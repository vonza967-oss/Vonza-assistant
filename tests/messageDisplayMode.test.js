import test from "node:test";
import assert from "node:assert/strict";

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

  assert.equal(supabase.state.insertAttempts.length, 2);
  assert.equal(supabase.state.insertAttempts[0][0].display_mode, "page");
  assert.equal(Object.hasOwn(supabase.state.insertAttempts[1][0], "display_mode"), false);
  assert.equal(supabase.state.messages.length, 1);
});
