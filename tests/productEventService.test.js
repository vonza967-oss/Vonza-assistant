import test from "node:test";
import assert from "node:assert/strict";

import {
  TRACKED_PRODUCT_EVENTS,
  buildWebCallHealthSummary,
  listWebCallHealthEvents,
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

test("product event allowlist accepts Web Call telemetry names", async () => {
  const webCallEvents = [
    "web_call_started",
    "web_call_mic_denied",
    "web_call_transcript_ready",
    "web_call_transcript_rejected",
    "web_call_turn_sent",
    "web_call_reply_ready",
    "web_call_speech_played",
    "web_call_speech_failed",
    "web_call_contact_opened",
    "web_call_contact_submitted",
    "web_call_ended",
    "web_call_max_turns_reached",
    "web_call_failed_recovery_shown",
  ];

  for (const eventName of webCallEvents) {
    assert.ok(TRACKED_PRODUCT_EVENTS.includes(eventName), `${eventName} should be supported`);
  }
});

test("Web Call product metadata keeps safe fields and drops transcript reply and contact PII", () => {
  assert.deepEqual(
    sanitizeProductEventMetadata({
      display_mode: "page",
      conversation_source: "web_call",
      web_call_id: "call-1",
      turn_count: 2,
      duration_seconds: 31,
      failure_category: "speech_failed",
      transcript_text: "I need a quote for my kitchen",
      assistant_reply_text: "Sure, I can help.",
      contact_name: "Visitor Name",
      contact_email: "visitor@example.com",
      phone: "+15555555555",
    }),
    {
      display_mode: "page",
      conversation_source: "web_call",
      web_call_id: "call-1",
      turn_count: 2,
      duration_seconds: 31,
      failure_category: "speech_failed",
    }
  );
});

test("Web Call health aggregation uses safe counts and does not leak metadata PII", () => {
  const summary = buildWebCallHealthSummary([
    {
      id: "event-1",
      event_name: "web_call_started",
      created_at: "2026-05-20T10:00:00.000Z",
      metadata: {
        web_call_id: "call-1",
        transcript_text: "I need a quote",
        contact_email: "lead@example.com",
      },
    },
    {
      id: "event-2",
      event_name: "web_call_transcript_rejected",
      created_at: "2026-05-20T10:00:10.000Z",
      metadata: {
        web_call_id: "call-1",
        failure_category: "garbled_transcript",
        raw_provider_error: "provider timeout for lead@example.com",
      },
    },
    {
      id: "event-3",
      event_name: "web_call_speech_failed",
      created_at: "2026-05-20T10:00:20.000Z",
      metadata: {
        web_call_id: "call-1",
        failure_category: "provider said visitor@example.com failed",
      },
    },
    {
      id: "event-4",
      event_name: "web_call_contact_submitted",
      created_at: "2026-05-20T10:00:30.000Z",
      metadata: {
        web_call_id: "call-1",
        contact_name: "Visitor Name",
        contact_phone: "+15555555555",
      },
    },
    {
      id: "event-5",
      event_name: "web_call_ended",
      created_at: "2026-05-20T10:01:02.000Z",
      metadata: {
        web_call_id: "call-1",
        duration_seconds: 62,
        turn_count: 2,
        assistant_reply_text: "Sure, I can help.",
      },
    },
    {
      id: "event-6",
      event_name: "web_call_started",
      created_at: "2026-05-20T11:00:00.000Z",
      metadata: {
        web_call_id: "call-2",
      },
    },
    {
      id: "event-7",
      event_name: "web_call_mic_denied",
      created_at: "2026-05-20T11:00:05.000Z",
      metadata: {
        web_call_id: "call-2",
      },
    },
    {
      id: "event-8",
      event_name: "web_call_failed_recovery_shown",
      created_at: "2026-05-20T11:00:10.000Z",
      metadata: {
        web_call_id: "call-2",
        failure_category: "ai_capacity_reached",
      },
    },
  ]);

  assert.equal(summary.starts, 2);
  assert.equal(summary.endedCalls, 1);
  assert.equal(summary.averageDurationSeconds, 62);
  assert.equal(summary.averageTurns, 2);
  assert.equal(summary.contactFallbackSubmissions, 1);
  assert.equal(summary.failureCounts.garbled_transcript, 1);
  assert.equal(summary.failureCounts.speech_failed, 1);
  assert.equal(summary.failureCounts.mic_denied, 1);
  assert.equal(summary.failureCounts.ai_capacity_reached, 1);
  assert.equal(summary.failureTotal, 4);
  assert.equal(summary.latestActivityAt, "2026-05-20T11:00:10.000Z");

  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /quote|lead@example\.com|visitor@example\.com|Visitor Name|\+15555555555|provider timeout|Sure, I can help/i);
});

test("Web Call health product event query is scoped to owner and agent", async () => {
  const calls = [];
  const supabase = {
    from(tableName) {
      calls.push(["from", tableName]);
      const builder = {
        select(columns) {
          calls.push(["select", columns]);
          return builder;
        },
        eq(field, value) {
          calls.push(["eq", field, value]);
          return builder;
        },
        in(field, values) {
          calls.push(["in", field, values]);
          return builder;
        },
        order(field, options) {
          calls.push(["order", field, options]);
          return builder;
        },
        async limit(value) {
          calls.push(["limit", value]);
          return {
            data: [
              {
                id: "event-1",
                event_name: "web_call_started",
                created_at: "2026-05-20T10:00:00.000Z",
                metadata: { web_call_id: "call-1" },
              },
            ],
            error: null,
          };
        },
      };
      return builder;
    },
  };

  const result = await listWebCallHealthEvents(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });

  assert.equal(result.persistenceAvailable, true);
  assert.equal(result.summary.starts, 1);
  assert.deepEqual(calls.filter((call) => call[0] === "eq"), [
    ["eq", "agent_id", "agent-1"],
    ["eq", "owner_user_id", "owner-1"],
  ]);
  assert.equal(calls.some((call) => call[0] === "in" && call[1] === "event_name" && call[2].includes("web_call_started")), true);
});
