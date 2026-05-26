import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listActionQueueStatuses,
  updateActionQueueStatus,
} from "../src/services/analytics/actionQueueService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createMissingSchemaListSupabase() {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async eq() {
                  return {
                    data: null,
                    error: {
                      code: "42P01",
                      message: "relation public.agent_action_queue_statuses does not exist",
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createMissingSchemaUpdateSupabase() {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        async maybeSingle() {
                          return {
                            data: null,
                            error: {
                              code: "42P01",
                              message: "relation public.agent_action_queue_statuses does not exist",
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createStatusSupabase(existingRow = null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        async maybeSingle() {
                          return {
                            data: existingRow,
                            error: null,
                          };
                        },
                      };
                    },
                    async maybeSingle() {
                      return {
                        data: existingRow,
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(payload) {
          return {
            select() {
              return {
                async single() {
                  return {
                    data: payload,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("action queue migration keeps the backfill and validation steps needed for existing data", () => {
  const sql = readFileSync(path.join(repoRoot, "db", "action_queue_statuses.sql"), "utf8");

  assert.match(sql, /set owner_user_id = agents\.owner_user_id/i);
  assert.match(sql, /set status = 'new'/i);
  assert.match(sql, /agent_action_queue_statuses_status_check/i);
  assert.match(sql, /agent_action_queue_statuses_contact_status_check/i);
  assert.match(sql, /agent_action_queue_statuses_agent_owner_status_updated_idx/i);
});

test("action queue rejects invalid status values instead of silently coercing them", async () => {
  await assert.rejects(
    () => updateActionQueueStatus(createStatusSupabase(), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "conversation:1",
      status: "resolved",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /supported action queue statuses/i);
      return true;
    }
  );
});

test("action queue rejects conflicting follow-up flags", async () => {
  await assert.rejects(
    () => updateActionQueueStatus(createStatusSupabase(), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "conversation:1",
      status: "reviewed",
      followUpNeeded: true,
      followUpCompleted: true,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /both needed and completed/i);
      return true;
    }
  );
});

test("action queue persists Web Call review follow-up state with owner scope", async () => {
  let capturedPayload = null;
  const supabase = createStatusSupabase();
  const originalFrom = supabase.from;
  supabase.from = (...args) => {
    const builder = originalFrom.apply(supabase, args);
    const originalUpsert = builder.upsert;
    builder.upsert = (payload, options) => {
      capturedPayload = { payload, options };
      return originalUpsert.call(builder, payload, options);
    };
    return builder;
  };

  const result = await updateActionQueueStatus(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    actionKey: "web_call_review:call-1",
    status: "reviewed",
    note: "Owner marked this Web Call as needing follow-up from Recent Web Calls.",
    nextStep: "Follow up with this caller if contact details are available.",
    followUpNeeded: true,
    followUpCompleted: false,
  });

  assert.equal(capturedPayload.payload.agent_id, "agent-1");
  assert.equal(capturedPayload.payload.owner_user_id, "owner-1");
  assert.equal(capturedPayload.payload.action_key, "web_call_review:call-1");
  assert.equal(capturedPayload.payload.status, "reviewed");
  assert.equal(capturedPayload.payload.follow_up_needed, true);
  assert.equal(capturedPayload.payload.follow_up_completed, false);
  assert.equal(result.item.actionKey, "web_call_review:call-1");
  assert.equal(result.item.followUpNeeded, true);
});

test("action queue rejects invalid direct transitions from dismissed to done", async () => {
  await assert.rejects(
    () => updateActionQueueStatus(createStatusSupabase({
      agent_id: "agent-1",
      owner_user_id: "owner-1",
      action_key: "conversation:1",
      status: "dismissed",
    }), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "conversation:1",
      status: "done",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /cannot move an action queue item directly from dismissed to done/i);
      return true;
    }
  );
});

test("action queue load surfaces a clear persistence error when the schema is missing", async () => {
  await assert.rejects(
    () => listActionQueueStatuses(createMissingSchemaListSupabase(), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /persistence is not ready/i);
      return true;
    }
  );
});

test("action queue update surfaces a clear persistence error when the schema is missing", async () => {
  await assert.rejects(
    () => updateActionQueueStatus(createMissingSchemaUpdateSupabase(), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "conversation:1",
      status: "reviewed",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /persistence is not ready/i);
      return true;
    }
  );
});
