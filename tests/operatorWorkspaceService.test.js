import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppointmentReviewActionKey,
  buildCalendarInsights,
  buildCalendarDailySummary,
  buildCampaignSequence,
  buildReplyDraft,
  classifyInboxThread,
  suggestCalendarSlots,
} from "../src/services/operator/operatorWorkspaceService.js";

test("inbox classifier identifies complaint and billing threads", () => {
  assert.equal(classifyInboxThread({
    subject: "Refund request",
    snippet: "I am very frustrated and need this fixed.",
    messages: [],
  }), "complaint");

  assert.equal(classifyInboxThread({
    subject: "Invoice question",
    snippet: "Can you check the charge on my card?",
    messages: [],
  }), "billing");
});

test("reply draft generation stays approval-first and complaint aware", () => {
  const draft = buildReplyDraft({
    classification: "complaint",
    subject: "Bad experience",
    participants: ["customer@example.com"],
    messages: [
      {
        direction: "inbound",
        sender: "Customer <customer@example.com>",
        senderEmail: "customer@example.com",
        bodyText: "I am unhappy with the service.",
      },
    ],
  }, {
    businessName: "Vonza Plumbing",
    senderName: "Vonza Plumbing",
  });

  assert.equal(draft.to, "customer@example.com");
  assert.match(draft.subject, /sorry/i);
  assert.match(draft.body, /make this right/i);
});

test("slot suggestion avoids busy events and finds business-hour availability", () => {
  const slots = suggestCalendarSlots([
    {
      startAt: "2026-04-06T09:00:00.000Z",
      endAt: "2026-04-06T10:00:00.000Z",
      status: "confirmed",
    },
    {
      startAt: "2026-04-06T13:00:00.000Z",
      endAt: "2026-04-06T14:00:00.000Z",
      status: "confirmed",
    },
  ], {
    now: "2026-04-06T08:00:00.000Z",
  });

  assert.ok(slots.length > 0);
  assert.equal(slots[0].startAt, "2026-04-06T10:00:00.000Z");
  assert.equal(slots[0].endAt, "2026-04-06T11:00:00.000Z");
});

test("calendar summary includes conflicts, complaints, and best next slot", () => {
  const summary = buildCalendarDailySummary({
    events: [
      {
        title: "Morning booking",
        startAt: "2026-04-06T09:00:00.000Z",
        endAt: "2026-04-06T10:00:00.000Z",
      },
    ],
    tasks: [
      { taskType: "calendar_conflict", status: "open" },
      { taskType: "complaint_queue", status: "open" },
    ],
    slots: [
      { label: "Mon, Apr 6, 11:00 AM" },
    ],
    followUpItems: [
      { id: "event-1" },
    ],
    reviewItems: [
      { id: "event-3" },
    ],
    unlinkedItems: [
      { id: "event-2" },
    ],
  });

  assert.match(summary, /upcoming event/i);
  assert.match(summary, /conflict/i);
  assert.match(summary, /complaint/i);
  assert.match(summary, /recent appointment/i);
  assert.match(summary, /explicit review resolution/i);
  assert.match(summary, /not linked to a contact/i);
  assert.match(summary, /11:00 AM/);
});

test("calendar insights keep ended appointment review items deterministic until resolved", () => {
  const now = "2026-04-06T18:00:00.000Z";
  const event = {
    id: "event-1",
    title: "Quote review",
    startAt: "2026-04-06T09:00:00.000Z",
    endAt: "2026-04-06T09:30:00.000Z",
    status: "confirmed",
    attendees: [
      {
        displayName: "Taylor Reed",
        email: "taylor@example.com",
      },
    ],
    attendeeEmails: ["taylor@example.com"],
    attendeeNames: ["Taylor Reed"],
  };

  const reviewKey = buildAppointmentReviewActionKey(event.id);
  const unresolved = buildCalendarInsights({
    events: [event],
    contacts: [
      {
        id: "contact-1",
        name: "Taylor Reed",
        email: "taylor@example.com",
      },
    ],
    followUps: [],
    recentOutcomes: [],
    tasks: [],
    reviewStatuses: [],
    businessName: "Vonza Plumbing",
    assistantName: "Vonza Plumbing",
    now,
  });

  assert.equal(unresolved.reviewItems.length, 1);
  assert.equal(unresolved.reviewItems[0].reviewActionKey, reviewKey);
  assert.equal(unresolved.reviewItems[0].needsEndedAppointmentReview, true);
  assert.match(unresolved.reviewItems[0].reviewReason, /no recorded outcome/i);
  assert.match(unresolved.reviewItems[0].copilot.summary, /Taylor Reed/i);
  assert.equal(unresolved.reviewItems[0].copilot.followUpDraftAvailable, true);

  const resolved = buildCalendarInsights({
    events: [event],
    contacts: [
      {
        id: "contact-1",
        name: "Taylor Reed",
        email: "taylor@example.com",
      },
    ],
    followUps: [],
    recentOutcomes: [],
    tasks: [],
    reviewStatuses: [
      {
        actionKey: reviewKey,
        status: "dismissed",
        outcome: "no_action_needed",
      },
    ],
    businessName: "Vonza Plumbing",
    assistantName: "Vonza Plumbing",
    now,
  });

  assert.equal(resolved.reviewItems.length, 0);
});

test("campaign sequence stays deterministic for quote follow-up", () => {
  const sequence = buildCampaignSequence("quote_follow_up", "Vonza Painting");

  assert.equal(sequence.length, 2);
  assert.equal(sequence[0].stepOrder, 0);
  assert.equal(sequence[1].timingOffsetHours, 72);
  assert.match(sequence[0].subject, /quote request/i);
});
