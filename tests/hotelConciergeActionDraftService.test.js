import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { getAgentPackage } from "../src/agentPackages/index.js";
import { packageCanCreateActionRequest } from "../src/services/actions/actionRequestRegistry.js";
import { buildHotelConciergeActionDraft } from "../src/services/actions/hotelConciergeActionDraftService.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DRAFT_SERVICE_PATH = path.join(
  REPO_ROOT,
  "src/services/actions/hotelConciergeActionDraftService.js"
);

function listFilesRecursively(rootPath) {
  const entries = readdirSync(rootPath);

  return entries.flatMap((entry) => {
    const entryPath = path.join(rootPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return listFilesRecursively(entryPath);
    }

    return entryPath;
  });
}

test("Hotel Concierge draft maps water requests to staff-visible action payloads", () => {
  const draft = buildHotelConciergeActionDraft({
    message: "Please send two bottles of sparkling water to room 412 tonight.",
  });

  assert.equal(draft.matched, true);
  assert.equal(draft.actionKey, "hotel.bring_water");
  assert.equal(draft.confidence, "high");
  assert.deepEqual(draft.guestContext, { roomLabel: "412" });
  assert.equal(draft.payload.quantity, 2);
  assert.equal(draft.payload.deliveryLocation, "Room 412");
  assert.equal(draft.payload.preferredTime, "tonight");
  assert.match(draft.assistantAcknowledgement, /draft a staff request/i);
  assert.deepEqual(draft.safetyNotes, []);
});

test("Hotel Concierge draft maps towel and linen requests without creating requests", () => {
  const draft = buildHotelConciergeActionDraft({
    message: "Could we get 3 extra towels in room 208?",
    guestContext: { guestName: "Avery Stone" },
  });

  assert.equal(draft.matched, true);
  assert.equal(draft.actionKey, "hotel.extra_towels");
  assert.equal(draft.confidence, "high");
  assert.deepEqual(draft.guestContext, { roomLabel: "208", guestName: "Avery Stone" });
  assert.deepEqual(draft.payload, {
    item: "towels",
    quantity: 3,
    deliveryLocation: "Room 208",
    notes: "Could we get 3 extra towels in room 208?",
  });
});

test("Hotel Concierge draft treats water leaks as maintenance, not water delivery", () => {
  const draft = buildHotelConciergeActionDraft({
    message: "The bathroom sink in room 305 is leaking now.",
  });

  assert.equal(draft.matched, true);
  assert.equal(draft.actionKey, "hotel.maintenance_issue");
  assert.equal(draft.confidence, "high");
  assert.equal(draft.payload.issueType, "plumbing");
  assert.equal(draft.payload.location, "Room 305 bathroom");
  assert.equal(draft.payload.urgency, "urgent");
  assert.equal(draft.payload.description, "The bathroom sink in room 305 is leaking now.");
});

test("Hotel Concierge draft maps late checkout requests as review-only drafts", () => {
  const draft = buildHotelConciergeActionDraft({
    message: "Can I get late checkout until 2pm?",
    guestContext: {
      roomLabel: "701",
      guestName: "Sam Lee",
      reservationReference: "ABC123",
    },
    language: "English",
  });

  assert.equal(draft.matched, true);
  assert.equal(draft.actionKey, "hotel.late_checkout_request");
  assert.equal(draft.confidence, "high");
  assert.deepEqual(draft.guestContext, {
    roomLabel: "701",
    guestName: "Sam Lee",
    language: "English",
  });
  assert.deepEqual(draft.payload, {
    requestedCheckoutTime: "2pm",
    reservationReference: "ABC123",
    notes: "Can I get late checkout until 2pm?",
  });
  assert.match(draft.assistantAcknowledgement, /does not confirm approval/i);
  assert.deepEqual(draft.safetyNotes, [
    "Draft only; late checkout must be confirmed by hotel staff.",
  ]);
});

test("Hotel Concierge draft returns a stable non-match shape for informational messages", () => {
  const input = {
    message: "What time is breakfast?",
    history: [{ role: "user", content: "I am in room 901." }],
  };
  const draft = buildHotelConciergeActionDraft(input);
  const secondDraft = buildHotelConciergeActionDraft(input);

  assert.deepEqual(draft, secondDraft);
  assert.deepEqual(draft, {
    matched: false,
    actionKey: "",
    confidence: "none",
    guestContext: { roomLabel: "901" },
    payload: {},
    sourceMessage: "What time is breakfast?",
    assistantAcknowledgement: "",
    safetyNotes: [],
  });
});

test("Hotel Concierge draft action keys remain allowed by the package manifest", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");
  const messages = [
    "Please send water to room 100.",
    "I need extra towels.",
    "The AC is broken.",
    "Can I get late checkout?",
  ];

  for (const message of messages) {
    const draft = buildHotelConciergeActionDraft({ message });
    assert.equal(draft.matched, true);
    assert.equal(packageCanCreateActionRequest(hotelPackage, draft.actionKey), true);
  }
});

test("Hotel Concierge draft service has no provider, database, or runtime wiring", () => {
  const source = readFileSync(DRAFT_SERVICE_PATH, "utf8");

  assert.doesNotMatch(source, /\bopenai\b/i);
  assert.doesNotMatch(source, /\bsupabase\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/i);
  assert.doesNotMatch(source, /\bcreateAgentActionRequest\b/);
});

test("dashboard, widget, embed, and routes do not import Hotel Concierge action runtime services", () => {
  const scannedPaths = [
    path.join(REPO_ROOT, "src/routes"),
    path.join(REPO_ROOT, "frontend"),
    path.join(REPO_ROOT, "assistant-embed.js"),
    path.join(REPO_ROOT, "embed.js"),
    path.join(REPO_ROOT, "embed-lite.js"),
  ];
  const files = scannedPaths.filter((scannedPath) => existsSync(scannedPath)).flatMap((scannedPath) => {
    const stats = statSync(scannedPath);
    return stats.isDirectory() ? listFilesRecursively(scannedPath) : [scannedPath];
  });
  const offenders = files
    .filter((filePath) => /\.(js|html)$/.test(filePath))
    .filter((filePath) =>
      /hotelConciergeActionDraftService|createAgentActionRequest/.test(readFileSync(filePath, "utf8"))
    );

  assert.deepEqual(offenders, []);
});
