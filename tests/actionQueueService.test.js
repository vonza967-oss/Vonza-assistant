import test from "node:test";
import assert from "node:assert/strict";

import {
  listActionQueueStatuses,
  updateActionQueueStatus,
} from "../src/services/analytics/actionQueueService.js";

function createQueryBuilder({ existingRow = null, selectError = null, upsertError = null } = {}) {
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
                        error: selectError,
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
    upsert(payload) {
      return {
        select() {
          return {
            async single() {
              return {
                data: payload,
                error: upsertError,
              };
            },
          };
        },
      };
    },
  };
}

function createSupabaseStub(options = {}) {
  return {
    from(tableName) {
      assert.equal(tableName, "agent_action_queue_statuses");
      return createQueryBuilder(options);
    },
  };
}

test("updateActionQueueStatus rejects unsupported explicit statuses", async () => {
  const supabase = createSupabaseStub();

  await assert.rejects(
    updateActionQueueStatus(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "operator:lead-1",
      status: "archived",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Unsupported action queue status 'archived'/);
      return true;
    }
  );
});

test("updateActionQueueStatus rejects impossible follow-up state combinations", async () => {
  const supabase = createSupabaseStub();

  await assert.rejects(
    updateActionQueueStatus(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "operator:lead-1",
      followUpNeeded: true,
      followUpCompleted: true,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Follow-up cannot be marked both needed and completed at the same time.");
      return true;
    }
  );
});

test("updateActionQueueStatus blocks direct dismissed-to-done transitions", async () => {
  const supabase = createSupabaseStub({
    existingRow: {
      agent_id: "agent-1",
      owner_user_id: "owner-1",
      action_key: "operator:lead-1",
      status: "dismissed",
    },
  });

  await assert.rejects(
    updateActionQueueStatus(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "operator:lead-1",
      status: "done",
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Vonza cannot move an action queue item directly from dismissed to done.");
      return true;
    }
  );
});

test("listActionQueueStatuses fails loudly when queue persistence is unavailable", async () => {
  const supabase = {
    from(tableName) {
      assert.equal(tableName, "agent_action_queue_statuses");
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    then(resolve) {
                      return resolve({
                        data: null,
                        error: {
                          code: "42P01",
                          message: "relation 'public.agent_action_queue_statuses' does not exist",
                        },
                      });
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

  await assert.rejects(
    listActionQueueStatuses(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "action_queue_persistence_unavailable");
      return true;
    }
  );
});

test("updateActionQueueStatus fails loudly when queue persistence is unavailable", async () => {
  const supabase = createSupabaseStub({
    selectError: {
      code: "42P01",
      message: "relation 'public.agent_action_queue_statuses' does not exist",
    },
  });

  await assert.rejects(
    updateActionQueueStatus(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      actionKey: "operator:lead-1",
      status: "reviewed",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "action_queue_persistence_unavailable");
      return true;
    }
  );
});
