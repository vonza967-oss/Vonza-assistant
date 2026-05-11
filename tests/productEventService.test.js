import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeProductEventMetadata,
  trackProductEvent,
} from "../src/services/analytics/productEventService.js";

test("product event metadata drops likely PII and keeps coarse debug fields", () => {
  assert.deepEqual(
    sanitizeProductEventMetadata({
      status: "captured",
      count: 2,
      contactEmail: "person@example.com",
      phone: "+15555555555",
      messageContent: "raw visitor text",
      has_install_id: true,
    }),
    {
      status: "captured",
      count: 2,
      has_install_id: true,
    }
  );
});

test("product events persist owner context and dedupe keys", async () => {
  let insertedPayload = null;
  const supabase = {
    from(tableName) {
      assert.equal(tableName, "product_events");
      return {
        async insert(payload) {
          insertedPayload = payload;
          return { error: null };
        },
      };
    },
  };

  const result = await trackProductEvent(supabase, {
    clientId: "client-1",
    agentId: "agent-1",
    ownerUserId: "00000000-0000-0000-0000-000000000001",
    eventName: "first_lead_captured",
    source: "lead_capture",
    metadata: {
      status: "captured",
      visitor_email: "lead@example.com",
    },
    dedupeKey: "first_lead_captured:agent-1",
  });

  assert.equal(result.ok, true);
  assert.equal(insertedPayload.owner_user_id, "00000000-0000-0000-0000-000000000001");
  assert.equal(insertedPayload.dedupe_key, "first_lead_captured:agent-1");
  assert.deepEqual(insertedPayload.metadata, { status: "captured" });
});

test("product events treat dedupe conflicts as successful duplicates", async () => {
  const supabase = {
    from() {
      return {
        async insert() {
          return {
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        },
      };
    },
  };

  const result = await trackProductEvent(supabase, {
    clientId: "client-1",
    agentId: "agent-1",
    eventName: "first_widget_chat",
    dedupeKey: "first_widget_chat:agent-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
});
