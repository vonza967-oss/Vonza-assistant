import test from "node:test";
import assert from "node:assert/strict";

import {
  buildContactWorkspaceFromRecords,
  getOperatorContactsWorkspace,
} from "../src/services/operator/contactWorkspaceService.js";

function createContactProbeSupabase() {
  return {
    from(tableName) {
      const builder = {
        select() {
          return builder;
        },
        limit() {
          return Promise.resolve({
            data: null,
            error: {
              code: "42P01",
              message: `relation public.${tableName} does not exist`,
            },
          });
        },
        eq() {
          return builder;
        },
        order() {
          return Promise.resolve({
            data: [],
            error: null,
          });
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: [],
            error: null,
          }).then(resolve, reject);
        },
      };

      return {
        select() {
          return builder;
        },
      };
    },
  };
}

test("repeated lead captures dedupe into a single contact", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Alex Rivera",
        contactEmail: "alex@example.com",
        captureState: "captured",
        captureReason: "Asked for a quote",
        lastSeenAt: "2026-04-02T10:00:00.000Z",
      },
      {
        id: "lead-2",
        contactName: "Alex Rivera",
        contactEmail: "alex@example.com",
        captureState: "captured",
        captureReason: "Returned to ask about pricing",
        lastSeenAt: "2026-04-03T09:00:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].counts.leads, 2);
  assert.equal(result.summary.totalContacts, 1);
});

test("inbox thread links to the existing contact when the email matches", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Taylor Reed",
        contactEmail: "taylor@example.com",
        captureState: "captured",
        captureReason: "Requested a callback",
        lastSeenAt: "2026-04-02T10:00:00.000Z",
      },
    ],
    threads: [
      {
        id: "thread-1",
        subject: "Need help with my quote",
        classification: "lead_sales",
        lastMessageAt: "2026-04-03T08:30:00.000Z",
        messages: [
          {
            direction: "inbound",
            sender: "Taylor Reed <taylor@example.com>",
            bodyPreview: "Can someone follow up on my quote?",
          },
        ],
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.ok(result.list[0].sources.includes("chat"));
  assert.ok(result.list[0].sources.includes("inbox"));
  assert.equal(result.list[0].primaryThreadId, "thread-1");
});

test("calendar event links to an existing contact when attendee data is sufficient", () => {
  const futureStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const futureEndAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();

  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Morgan Lee",
        contactEmail: "morgan@example.com",
        captureState: "captured",
        latestActionType: "booking_intent",
        lastSeenAt: "2026-04-02T09:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        title: "Estimate call",
        attendeeEmails: ["morgan@example.com"],
        startAt: futureStartAt,
        endAt: futureEndAt,
        status: "confirmed",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.ok(result.list[0].sources.includes("calendar"));
  assert.ok(result.list[0].flags.includes("booked"));
});

test("calendar event can link to a uniquely matched contact by attendee display name", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Morgan Lee",
        contactEmail: "morgan@example.com",
        captureState: "captured",
        latestActionType: "booking_intent",
        lastSeenAt: "2026-04-02T09:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        title: "Estimate call",
        attendeeNames: ["Morgan Lee"],
        startAt: "2026-04-05T10:00:00.000Z",
        endAt: "2026-04-05T10:30:00.000Z",
        status: "confirmed",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.ok(result.list[0].sources.includes("calendar"));
  assert.equal(result.list[0].email, "morgan@example.com");
});

test("calendar event can link to an existing contact by extracted attendee phone", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-1",
        displayName: "Morgan Lee",
        primaryEmail: "morgan@example.com",
        primaryPhone: "(555) 111-2222",
        primaryPhoneNormalized: "5551112222",
        lastActivityAt: "2026-04-02T09:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        title: "Estimate call",
        extractedPhones: ["555-111-2222"],
        startAt: "2026-04-05T10:00:00.000Z",
        endAt: "2026-04-05T10:30:00.000Z",
        status: "confirmed",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.ok(result.list[0].sources.includes("calendar"));
  assert.equal(result.list[0].phone, "(555) 111-2222");
});

test("stored contact fallbacks do not masquerade as a new anonymous visitor identity", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-1",
        displayName: "Stored contact",
        primaryEmail: "mail@example.com",
        primaryPhone: "+36 30 092 5097",
        primaryPhoneNormalized: "36300925097",
        activitySources: ["follow_up"],
        lastActivityAt: "2026-04-02T09:00:00.000Z",
      },
    ],
    leads: [
      {
        id: "lead-1",
        visitorSessionKey: "session-anon",
        captureState: "prompt_ready",
        captureReason: "Pricing intent",
        lastSeenAt: "2026-04-03T09:00:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Stored contact");
  assert.equal(result.list[0].email, "mail@example.com");
  const anonymousLead = result.list.find((contact) => contact.leadId === "lead-1");

  assert.equal(anonymousLead, undefined);
});

test("identified widget visitors replace placeholder contact identity", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-1",
        displayName: "Unknown contact",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:00:00.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-1",
        identityType: "session_key",
        identityValue: "session-identified",
      },
    ],
    leads: [
      {
        id: "lead-1",
        contactId: "contact-1",
        visitorSessionKey: "session-identified",
        contactName: "mate",
        contactEmail: "bobitamate@hotmail.com",
        captureState: "captured",
        captureReason: "Visitor continued with email.",
        lastSeenAt: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "mate");
  assert.equal(result.list[0].email, "bobitamate@hotmail.com");
  assert.notEqual(result.list[0].name, "Unknown contact");
});

test("identified widget visitors upgrade same-session guest contacts without a contact id", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-guest",
        displayName: "Anonymous visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:00:00.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-guest",
        identityType: "session_key",
        identityValue: "session-upgrade",
      },
    ],
    leads: [
      {
        id: "lead-upgrade",
        visitorSessionKey: "session-upgrade",
        contactName: "Avery Hart",
        contactEmail: "avery@example.com",
        captureState: "captured",
        captureReason: "Visitor continued with email.",
        lastSeenAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    messages: [
      {
        id: "message-upgrade",
        role: "user",
        content: "How much does this cost?",
        sessionKey: "session-upgrade",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Avery Hart");
  assert.equal(result.list[0].email, "avery@example.com");
  assert.equal(result.list[0].bestIdentifier, "Avery Hart");
  assert.equal(result.list[0].partialIdentity, false);
});

test("stored email identities hydrate customer primary identifiers", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-identified",
        displayName: "Unknown contact",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-identified",
        identityType: "session_key",
        identityValue: "session-email",
      },
      {
        contactId: "contact-identified",
        identityType: "email",
        identityValue: "Visitor@Example.com",
      },
    ],
    messages: [
      {
        id: "message-identified-email",
        role: "user",
        content: "Do you have weekend hours?",
        sessionKey: "session-email",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].email, "visitor@example.com");
  assert.equal(result.list[0].name, "visitor@example.com");
  assert.equal(result.list[0].bestIdentifier, "visitor@example.com");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Do you have weekend hours?");
});

test("identified widget conversations use durable message identity fields", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "What does this cost?",
        sessionKey: "session-durable",
        visitorIdentityMode: "identified",
        visitorEmail: "durable@example.com",
        visitorName: "Durable Visitor",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "Pricing depends on scope.",
        sessionKey: "session-durable",
        visitorIdentityMode: "identified",
        visitorEmail: "durable@example.com",
        visitorName: "Durable Visitor",
        createdAt: "2026-04-14T09:04:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Durable Visitor");
  assert.equal(result.list[0].email, "durable@example.com");
  assert.notEqual(result.list[0].name, "Anonymous visitor");
});

test("guest sessions upgrade to one identified customer when email is captured later", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-legacy-guest",
        displayName: "Anonymous visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:04:20.000Z",
        metadata: {
          latestMessageId: "message-legacy-assistant",
          latestCustomerMessageAt: "2026-04-14T09:03:55.000Z",
          latestCustomerMessageSummary: "Do you offer weekend appointments?",
        },
      },
    ],
    leads: [
      {
        id: "lead-upgraded",
        visitorSessionKey: "session-upgraded",
        contactName: "Avery Hart",
        contactEmail: "avery@example.com",
        captureState: "captured",
        captureReason: "Visitor continued with email.",
        latestMessageId: "message-legacy-assistant",
        lastSeenAt: "2026-04-14T09:05:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-legacy-user",
        role: "user",
        content: "Do you offer weekend appointments?",
        sessionKey: "session-upgraded",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-legacy-assistant",
        role: "assistant",
        content: "Yes, weekend appointments are available.",
        sessionKey: "session-upgraded",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].email, "avery@example.com");
  assert.equal(result.list[0].name, "Avery Hart");
  assert.equal(result.list[0].partialIdentity, false);
  assert.equal(result.list[0].latestCustomerMessageSummary, "Do you offer weekend appointments?");
});

test("separate guest sessions stay separate and keep scoped chat", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-a1",
        role: "user",
        content: "Guest A asking about webshop pricing.",
        sessionKey: "guest-session-a",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-a2",
        role: "assistant",
        content: "Pricing depends on the webshop.",
        sessionKey: "guest-session-a",
        createdAt: "2026-04-14T09:04:00.000Z",
      },
      {
        id: "message-b1",
        role: "user",
        content: "Guest B asking about booking a consultation.",
        sessionKey: "guest-session-b",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.deepEqual(
    result.list.map((contact) => contact.rowKey).sort(),
    ["session:guest-session-a", "session:guest-session-b"]
  );
  assert.deepEqual(
    result.list.find((contact) => contact.rowKey === "session:guest-session-a").chatMessages.map((message) => message.content),
    ["Guest A asking about webshop pricing.", "Pricing depends on the webshop."]
  );
  assert.deepEqual(
    result.list.find((contact) => contact.rowKey === "session:guest-session-b").chatMessages.map((message) => message.content),
    ["Guest B asking about booking a consultation."]
  );
});

test("assistant-only and metadata-only guest records do not create customer rows", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "assistant-only",
        role: "assistant",
        content: "Hello, how can I help?",
        sessionKey: "assistant-only-session",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    leads: [
      {
        id: "lead-placeholder",
        visitorSessionKey: "metadata-only-session",
        captureState: "prompt_ready",
        captureReason: "Pricing intent",
        lastSeenAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 0);
});

test("blank and placeholder emails do not collapse unrelated guest visitors", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "I need pricing.",
        sessionKey: "session-placeholder-a",
        visitorIdentityMode: "identified",
        visitorEmail: "guest@example.com",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-2",
        role: "user",
        content: "Can I book tomorrow?",
        sessionKey: "session-placeholder-b",
        visitorIdentityMode: "identified",
        visitorEmail: "guest@example.com",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.ok(result.list.every((contact) => contact.email === ""));
  assert.deepEqual(
    result.list.map((contact) => contact.rowKey).sort(),
    ["session:session-placeholder-a", "session:session-placeholder-b"]
  );
});

test("business contact email is not promoted to visitor identity", () => {
  const result = buildContactWorkspaceFromRecords({
    businessContactEmails: ["team@example.com"],
    messages: [
      {
        id: "message-business-email",
        role: "user",
        content: "Can I email team@example.com about pricing?",
        sessionKey: "session-business-email",
        visitorIdentityMode: "identified",
        visitorEmail: "team@example.com",
        visitorName: "Business Email Visitor",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].email, "");
  assert.equal(result.list[0].rowKey, "session:session-business-email");
});

test("identified same-session upgrade keeps guest history without pulling other sessions", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-guest",
        role: "user",
        content: "I need a price first.",
        sessionKey: "session-upgrade-scoped",
        visitorIdentityMode: "guest",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-other",
        role: "user",
        content: "Unrelated guest question.",
        sessionKey: "session-other-guest",
        visitorIdentityMode: "guest",
        createdAt: "2026-04-14T09:04:10.000Z",
      },
      {
        id: "message-identified",
        role: "user",
        content: "Continue by email.",
        sessionKey: "session-upgrade-scoped",
        visitorIdentityMode: "identified",
        visitorEmail: "scoped@example.com",
        visitorName: "Scoped Visitor",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  const identified = result.list.find((contact) => contact.email === "scoped@example.com");

  assert.equal(result.list.length, 2);
  assert.ok(identified);
  assert.ok(result.list.find((contact) => contact.rowKey === "session:session-other-guest"));
  assert.equal(identified.rowKey, "email:scoped@example.com:session:session-upgrade-scoped");
  assert.deepEqual(identified.chatMessages.map((message) => message.content), [
    "I need a price first.",
    "Continue by email.",
  ]);
});

test("identified visitors with the same email stay scoped by session", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-a",
        role: "user",
        content: "First session pricing question.",
        sessionKey: "identified-session-a",
        visitorIdentityMode: "identified",
        visitorEmail: "same@example.com",
        visitorName: "Same Visitor",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-b",
        role: "user",
        content: "Second session booking question.",
        sessionKey: "identified-session-b",
        visitorIdentityMode: "identified",
        visitorEmail: "same@example.com",
        visitorName: "Same Visitor",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.deepEqual(
    result.list.map((contact) => contact.rowKey).sort(),
    [
      "email:same@example.com:session:identified-session-a",
      "email:same@example.com:session:identified-session-b",
    ]
  );
  assert.ok(result.list.every((contact) => contact.chatMessages.length === 1));
});

test("stale broad stored contacts do not force multiple guest sessions into one row", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-broad",
        displayName: "Guest visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:00:00.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-broad",
        identityType: "session_key",
        identityValue: "stale-session-a",
      },
      {
        contactId: "contact-broad",
        identityType: "session_key",
        identityValue: "stale-session-b",
      },
    ],
    messages: [
      {
        id: "message-a",
        role: "user",
        content: "Guest A question.",
        sessionKey: "stale-session-a",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-b",
        role: "user",
        content: "Guest B question.",
        sessionKey: "stale-session-b",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.deepEqual(
    result.list.map((contact) => contact.rowKey).sort(),
    ["session:stale-session-a", "session:stale-session-b"]
  );
  assert.ok(result.list.every((contact) => contact.id !== "contact-broad"));
});

test("persisted identified chat contacts remain visible without currently loaded messages", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-stored-identified",
        displayName: "Stored Buyer",
        primaryEmail: "stored@example.com",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-stored-identified",
        identityType: "email",
        identityValue: "stored@example.com",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].id, "contact-stored-identified");
  assert.equal(result.list[0].name, "Stored Buyer");
  assert.equal(result.list[0].email, "stored@example.com");
});

test("persisted multi-session guest contact with customer snapshot remains visible when messages are outside the load window", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-broad-snapshot",
        displayName: "Guest visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:03:55.000Z",
        metadata: {
          latestCustomerMessageAt: "2026-04-14T09:03:55.000Z",
          latestCustomerMessageSummary: "Do you offer delivery?",
        },
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-broad-snapshot",
        identityType: "session_key",
        identityValue: "old-session-a",
      },
      {
        contactId: "contact-broad-snapshot",
        identityType: "session_key",
        identityValue: "old-session-b",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].id, "contact-broad-snapshot");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Do you offer delivery?");
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
});

test("persisted multi-session guest placeholders without customer evidence stay suppressed", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-broad-placeholder",
        displayName: "Guest visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-broad-placeholder",
        identityType: "session_key",
        identityValue: "placeholder-session-a",
      },
      {
        contactId: "contact-broad-placeholder",
        identityType: "session_key",
        identityValue: "placeholder-session-b",
      },
    ],
  });

  assert.equal(result.list.length, 0);
});

test("chat customers use persisted visitor message time for last activity", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        visitorSessionKey: "session-1",
        contactName: "Taylor Reed",
        contactEmail: "taylor@example.com",
        captureState: "captured",
        captureReason: "Asked for pricing.",
        lastSeenAt: "2026-04-14T12:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Can you send pricing?",
        sessionKey: "session-1",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "I can help with pricing.",
        sessionKey: "session-1",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
  assert.notEqual(result.list[0].mostRecentActivityAt, "2026-04-14T09:04:20.000Z");
  assert.notEqual(result.list[0].mostRecentActivityAt, "2026-04-14T12:00:00.000Z");
});

test("chat contacts keep latest conversation message time even when assistant replied last", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Can you send pricing?",
        sessionKey: "session-1",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "I can help with pricing.",
        sessionKey: "session-1",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].lastConversationMessageAt, "2026-04-14T09:04:20.000Z");
  assert.equal(result.list[0].latestConversationMessageSummary, "I can help with pricing.");
  assert.equal(result.list[0].latestConversationMessageRole, "assistant");
});

test("persisted guest contacts keep the latest customer message snapshot without loaded messages", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-guest",
        displayName: "Anonymous visitor",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:03:55.000Z",
        metadata: {
          latestCustomerMessageAt: "2026-04-14T09:03:55.000Z",
          latestCustomerMessageSummary: "Do you offer weekend appointments?",
        },
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-guest",
        identityType: "session_key",
        identityValue: "guest-session-1",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Anonymous visitor");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Do you offer weekend appointments?");
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
});

test("guest widget conversations create customer contacts from stored messages", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-guest-1",
        role: "user",
        content: "Do you offer weekend appointments?",
        sessionKey: "guest-session-1",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-guest-2",
        role: "assistant",
        content: "Yes, weekend appointments are available.",
        sessionKey: "guest-session-1",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Anonymous visitor");
  assert.equal(result.list[0].bestIdentifier, "Session continuity only");
  assert.ok(result.list[0].sources.includes("chat"));
  assert.equal(result.list[0].latestMessageId, "message-guest-2");
  assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.deepEqual(
    result.list[0].chatMessages.map((message) => message.label),
    ["Customer", "Vonza"]
  );
});

test("production-shaped user message rows without message ids still create customer contacts", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        agent_id: "agent-1",
        role: "user",
        content: "Can you send package pricing?",
        session_key: "production-session-1",
        created_at: "2026-04-14T09:03:55.000Z",
      },
      {
        agent_id: "agent-1",
        role: "assistant",
        content: "Pricing depends on the package.",
        session_key: "production-session-1",
        created_at: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].rowKey, "session:production-session-1");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Can you send package pricing?");
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.deepEqual(
    result.list[0].chatMessages.map((message) => message.content),
    ["Can you send package pricing?", "Pricing depends on the package."]
  );
});

test("production-shaped identified visitor messages use durable visitor fields without newer helper ids", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        agent_id: "agent-1",
        role: "user",
        content: "I would like to continue by email.",
        session_key: "production-identified-session",
        visitor_email: "identified@example.com",
        visitor_name: "Identified Visitor",
        created_at: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Identified Visitor");
  assert.equal(result.list[0].email, "identified@example.com");
  assert.equal(result.list[0].rowKey, "email:identified@example.com:session:production-identified-session");
  assert.equal(result.list[0].latestCustomerMessageSummary, "I would like to continue by email.");
});

test("production-shaped guest sessions without message ids stay separate and scoped", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        agent_id: "agent-1",
        role: "user",
        content: "Guest A wants pricing.",
        session_key: "production-guest-a",
        created_at: "2026-04-14T09:03:55.000Z",
      },
      {
        agent_id: "agent-1",
        role: "assistant",
        content: "Pricing reply for guest A.",
        session_key: "production-guest-a",
        created_at: "2026-04-14T09:04:20.000Z",
      },
      {
        agent_id: "agent-1",
        role: "user",
        content: "Guest B wants booking.",
        session_key: "production-guest-b",
        created_at: "2026-04-14T09:05:00.000Z",
      },
      {
        agent_id: "agent-1",
        role: "assistant",
        content: "Booking reply for guest B.",
        session_key: "production-guest-b",
        created_at: "2026-04-14T09:06:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.deepEqual(
    result.list.map((contact) => contact.rowKey).sort(),
    ["session:production-guest-a", "session:production-guest-b"]
  );
  assert.deepEqual(
    result.list.find((contact) => contact.rowKey === "session:production-guest-a").chatMessages.map((message) => message.content),
    ["Guest A wants pricing.", "Pricing reply for guest A."]
  );
  assert.deepEqual(
    result.list.find((contact) => contact.rowKey === "session:production-guest-b").chatMessages.map((message) => message.content),
    ["Guest B wants booking.", "Booking reply for guest B."]
  );
});

test("production-shaped guest-to-identified same-session upgrade keeps one identified row", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        agent_id: "agent-1",
        role: "user",
        content: "I need a quote first.",
        session_key: "production-upgrade-session",
        created_at: "2026-04-14T09:03:55.000Z",
      },
      {
        agent_id: "agent-1",
        role: "user",
        content: "Use my email for the quote.",
        session_key: "production-upgrade-session",
        visitor_email: "upgrade@example.com",
        visitor_name: "Upgrade Visitor",
        created_at: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Upgrade Visitor");
  assert.equal(result.list[0].email, "upgrade@example.com");
  assert.equal(result.list[0].rowKey, "email:upgrade@example.com:session:production-upgrade-session");
  assert.deepEqual(result.list[0].chatMessages.map((message) => message.content), [
    "I need a quote first.",
    "Use my email for the quote.",
  ]);
});

test("production-shaped assistant-only messages without ids stay suppressed", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        agent_id: "agent-1",
        role: "assistant",
        content: "Hello, how can I help?",
        session_key: "production-assistant-only",
        created_at: "2026-04-14T09:03:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 0);
});

test("visitor and customer roles count as customer messages for Last message", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-visitor",
        role: "visitor",
        content: "I need pricing.",
        sessionKey: "session-role",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-assistant",
        role: "assistant",
        content: "Pricing depends on the project.",
        sessionKey: "session-role",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
      {
        id: "message-customer",
        role: "customer",
        content: "Can you send details?",
        sessionKey: "session-role",
        createdAt: "2026-04-14T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:05:00.000Z");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Can you send details?");
  assert.deepEqual(
    result.list[0].chatMessages.map((message) => message.label),
    ["Customer", "Vonza", "Customer"]
  );
});

test("assistant replies do not move the customer Last message timestamp", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-user",
        role: "user",
        content: "Can I book a call?",
        sessionKey: "session-assistant-later",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-assistant",
        role: "assistant",
        content: "Yes, what time works?",
        sessionKey: "session-assistant-later",
        createdAt: "2026-04-14T09:08:55.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Can I book a call?");
});

test("guest widget question text is not promoted into the contact identity", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-1",
        displayName: "hey, what services do you offer",
        activitySources: ["chat"],
        lastActivityAt: "2026-04-14T09:04:20.000Z",
      },
    ],
    storedIdentities: [
      {
        contactId: "contact-1",
        identityType: "session_key",
        identityValue: "session-question",
      },
    ],
    messages: [
      {
        id: "message-question-1",
        role: "user",
        content: "hey, what services do you offer",
        sessionKey: "session-question",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
    ],
    leads: [
      {
        id: "lead-1",
        contactId: "contact-1",
        contactName: "hey, what services do you offer",
        visitorSessionKey: "session-question",
        captureState: "prompt_ready",
        captureReason: "This contact does not have a higher-priority owner next step right now.",
        latestMessageId: "message-question-1",
        lastSeenAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "Anonymous visitor");
  assert.equal(result.list[0].bestIdentifier, "Session continuity only");
  assert.equal(result.list[0].latestCustomerMessageSummary, "hey, what services do you offer");
});

test("identified widget conversations create customer contacts from stored messages", () => {
  const result = buildContactWorkspaceFromRecords({
    messages: [
      {
        id: "message-identified-1",
        role: "user",
        content: "My name is mate. My email is bobitamate@hotmail.com.",
        sessionKey: "identified-session-1",
        createdAt: "2026-04-14T09:03:55.000Z",
      },
      {
        id: "message-identified-2",
        role: "assistant",
        content: "Thanks mate, I have your email.",
        sessionKey: "identified-session-1",
        createdAt: "2026-04-14T09:04:20.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, "mate");
  assert.equal(result.list[0].email, "bobitamate@hotmail.com");
  assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
  assert.notEqual(result.list[0].mostRecentActivityAt, "2026-04-14T09:04:20.000Z");
});

test("chat customer timestamps do not drift to render time", () => {
  const realDateNow = Date.now;
  Date.now = () => new Date("2026-04-20T18:30:00.000Z").getTime();

  try {
    const result = buildContactWorkspaceFromRecords({
      messages: [
        {
          id: "message-stable-1",
          role: "user",
          content: "Can you send availability?",
          sessionKey: "stable-session-1",
          createdAt: "2026-04-14T09:03:55.000Z",
        },
        {
          id: "message-stable-2",
          role: "assistant",
          content: "I can help with that.",
          sessionKey: "stable-session-1",
          createdAt: "2026-04-14T09:04:20.000Z",
        },
      ],
    });

    assert.equal(result.list.length, 1);
    assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
    assert.notEqual(result.list[0].mostRecentActivityAt, "2026-04-14T09:04:20.000Z");
    assert.notEqual(result.list[0].mostRecentActivityAt, "2026-04-20T18:30:00.000Z");
  } finally {
    Date.now = realDateNow;
  }
});

test("inbox customer activity uses latest inbound customer message instead of outbound reply", () => {
  const result = buildContactWorkspaceFromRecords({
    threads: [
      {
        id: "thread-1",
        subject: "Pricing help",
        classification: "lead_sales",
        lastMessageAt: "2026-04-14T09:08:20.000Z",
        messages: [
          {
            id: "inbound-1",
            direction: "inbound",
            sender: "Alex Buyer <alex@example.com>",
            bodyPreview: "Can you send pricing?",
            sentAt: "2026-04-14T09:03:55.000Z",
          },
          {
            id: "outbound-1",
            direction: "outbound",
            sender: "Vonza <hello@example.com>",
            recipients: ["alex@example.com"],
            bodyPreview: "Here is a pricing reply.",
            sentAt: "2026-04-14T09:08:20.000Z",
          },
        ],
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].email, "alex@example.com");
  assert.equal(result.list[0].mostRecentActivityAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].lastCustomerMessageAt, "2026-04-14T09:03:55.000Z");
  assert.equal(result.list[0].latestCustomerMessageSummary, "Can you send pricing?");
  assert.equal(result.list[0].timeline[0].at, "2026-04-14T09:03:55.000Z");
  assert.notEqual(result.list[0].timeline[0].at, "2026-04-14T09:08:20.000Z");
});

test("unresolved partial identities stay separate instead of merging on name alone", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Chris Jordan",
        visitorSessionKey: "session-1",
        captureState: "partial_contact",
        lastSeenAt: "2026-04-02T09:00:00.000Z",
      },
      {
        id: "lead-2",
        contactName: "Chris Jordan",
        visitorSessionKey: "session-2",
        captureState: "partial_contact",
        lastSeenAt: "2026-04-03T09:00:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 2);
  assert.ok(result.list.every((contact) => contact.partialIdentity));
});

test("per-contact timeline is chronological across chat, inbox, and outcomes", () => {
  const result = buildContactWorkspaceFromRecords({
    leads: [
      {
        id: "lead-1",
        contactName: "Jamie Ortiz",
        contactEmail: "jamie@example.com",
        captureState: "captured",
        captureReason: "Asked for pricing",
        lastSeenAt: "2026-04-01T09:00:00.000Z",
      },
    ],
    threads: [
      {
        id: "thread-1",
        subject: "Quote follow-up",
        classification: "follow_up_needed",
        lastMessageAt: "2026-04-02T10:00:00.000Z",
        messages: [
          {
            direction: "inbound",
            sender: "Jamie Ortiz <jamie@example.com>",
            bodyPreview: "Following up on the quote",
          },
        ],
      },
    ],
    outcomes: [
      {
        id: "outcome-1",
        contactId: "contact-1",
        personKey: "",
        leadId: "lead-1",
        outcomeType: "quote_requested",
        label: "Quote requested",
        sourceLabel: "Direct route",
        occurredAt: "2026-04-03T12:00:00.000Z",
      },
    ],
  });

  assert.equal(result.list[0].timeline[0].source, "conversion");
  assert.equal(result.list[0].timeline[1].source, "inbox");
  assert.equal(result.list[0].timeline[2].source, "chat");
  assert.equal(result.list[0].latestOutcome?.label, "Quote requested");
  assert.equal(result.summary.contactsWithOutcomes, 1);
});

test("contact-linked outcomes stitch by contact_id even without email or lead identity", () => {
  const result = buildContactWorkspaceFromRecords({
    storedContacts: [
      {
        id: "contact-1",
        displayName: "Casey North",
        primaryEmail: "casey@example.com",
        lifecycleState: "active_lead",
      },
    ],
    outcomes: [
      {
        id: "outcome-1",
        contactId: "contact-1",
        outcomeType: "campaign_replied",
        label: "Campaign replied",
        sourceLabel: "Campaign",
        occurredAt: "2026-04-03T12:00:00.000Z",
      },
    ],
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].latestOutcome?.label, "Campaign replied");
  assert.equal(result.list[0].counts.outcomes, 1);
});

test("lifecycle and next-action logic stays deterministic for complaint-risk contacts", () => {
  const result = buildContactWorkspaceFromRecords({
    threads: [
      {
        id: "thread-1",
        subject: "Refund request",
        classification: "complaint",
        riskLevel: "high",
        lastMessageAt: "2026-04-03T09:00:00.000Z",
        messages: [
          {
            direction: "inbound",
            sender: "Casey <casey@example.com>",
            bodyPreview: "I want a refund.",
          },
        ],
      },
    ],
    tasks: [
      {
        id: "task-1",
        taskType: "complaint_queue",
        title: "Complaint needs review",
        description: "Customer is waiting for a reply.",
        status: "open",
        relatedThreadId: "thread-1",
        updatedAt: "2026-04-03T09:05:00.000Z",
      },
    ],
  });

  assert.equal(result.list[0].lifecycleState, "complaint_risk");
  assert.equal(result.list[0].nextAction.key, "reply_to_complaint");
});

test("contacts workspace still renders useful partial records when persistence is unavailable", async () => {
  const result = await getOperatorContactsWorkspace(createContactProbeSupabase(), {
    agent: {
      id: "agent-1",
      businessId: "business-1",
    },
    ownerUserId: "owner-1",
    leads: [
      {
        id: "lead-1",
        contactEmail: "owner@example.com",
        captureState: "captured",
        captureReason: "Asked about services",
        lastSeenAt: "2026-04-03T09:00:00.000Z",
      },
    ],
    loadError: "Calendar fetch failed.",
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.health.migrationRequired, true);
  assert.equal(result.health.persistenceAvailable, false);
});
