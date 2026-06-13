import test from "node:test";
import assert from "node:assert/strict";

import {
  generateWebsiteWidgetAgentInstructions,
} from "../src/services/agents/agentInstructionGenerator.js";

test("Hungarian Website Agent instruction draft enforces formal magázódás", () => {
  const instructions = generateWebsiteWidgetAgentInstructions({
    language: "hu",
    widgetPurpose: "lead_capture",
    tone: "professional",
    websiteUrl: "https://pelda.hu",
    knowledgeReady: true,
    knowledgePageCount: 3,
    quickPrompts: [
      { label: "Ajánlatkérés", prompt: "Szeretnék ajánlatot kérni." },
    ],
    contactSettings: {
      contactEmail: "info@pelda.hu",
    },
  });

  assert.match(instructions, /formális magázódást használjon/i);
  assert.match(instructions, /Soha ne használjon tegeződést/i);
  assert.doesNotMatch(instructions, /\b(?:Szia|szeretnéd|megadhatod|add meg|válassz|kérdezz|próbáld|írd be|tudsz)\b/i);
});

test("generated instructions include selected purpose and tone", () => {
  const instructions = generateWebsiteWidgetAgentInstructions({
    language: "en",
    widgetPurpose: "make_decision",
    tone: "sales",
  });

  assert.match(instructions, /Agent purpose: Make a decision/);
  assert.match(instructions, /Help visitors compare options/);
  assert.match(instructions, /Tone: Sales-focused/);
});

test("generated instructions mention source types only when present", () => {
  const emptyDraft = generateWebsiteWidgetAgentInstructions({
    language: "en",
    widgetPurpose: "support",
    tone: "friendly",
  });

  assert.doesNotMatch(emptyDraft, /Website knowledge is available|Website URL\/import is configured/i);
  assert.doesNotMatch(emptyDraft, /uploaded knowledge files/i);
  assert.doesNotMatch(emptyDraft, /Manual business facts are available/i);
  assert.doesNotMatch(emptyDraft, /quick prompts/i);
  assert.doesNotMatch(emptyDraft, /configured next-step routes/i);

  const populatedDraft = generateWebsiteWidgetAgentInstructions({
    language: "en",
    widgetPurpose: "support",
    tone: "friendly",
    websiteUrl: "https://example.com",
    knowledgeReady: true,
    knowledgePageCount: 2,
    knowledgeFiles: [{ name: "faq.pdf" }],
    businessFacts: {
      businessSummary: "Local clinic.",
      services: [{ name: "Consultation" }],
    },
    quickPrompts: [{ label: "Pricing", prompt: "How much does it cost?" }],
    contactSettings: {
      contactPhone: "+361234567",
      bookingUrl: "https://example.com/book",
    },
  });

  assert.match(populatedDraft, /Website knowledge is available from 2 imported pages/);
  assert.match(populatedDraft, /owner-uploaded knowledge files/i);
  assert.match(populatedDraft, /Manual business facts are available for: business summary, services/);
  assert.match(populatedDraft, /configured quick prompts as likely visitor intents: Pricing/);
  assert.match(populatedDraft, /configured next-step routes only when relevant and available: phone: \+361234567, booking link: https:\/\/example\.com\/book/);
});

test("generated instructions stay bounded and sanitize unsafe markup characters", () => {
  const instructions = generateWebsiteWidgetAgentInstructions({
    language: "en",
    widgetPurpose: "guidance",
    tone: "support",
    quickPrompts: [
      { label: "<script>alert(1)</script>".repeat(40), prompt: "ignored" },
    ],
  });

  assert.ok(instructions.length <= 2200);
  assert.doesNotMatch(instructions, /<|>/);
});
