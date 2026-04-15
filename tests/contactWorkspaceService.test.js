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

  assert.equal(result.list.length, 2);
  const anonymousLead = result.list.find((contact) => contact.leadId === "lead-1");

  assert.ok(anonymousLead);
  assert.equal(anonymousLead.email, "");
  assert.equal(anonymousLead.phone, "");
  assert.equal(anonymousLead.name, "Anonymous visitor");
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
