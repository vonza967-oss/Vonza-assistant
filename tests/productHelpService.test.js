import test from "node:test";
import assert from "node:assert/strict";

import { answerVonzaProductHelp } from "../src/services/support/productHelpService.js";

test("product help fallback explains install verification and returns contextual prompts", async () => {
  const result = await answerVonzaProductHelp({
    openai: null,
    question: "Why is my install not verified?",
    agent: {
      assistantName: "Vonza",
      websiteUrl: "https://example.com",
      welcomeMessage: "Welcome to Vonza.",
      tone: "friendly",
      publicAgentKey: "public-key",
      knowledge: {
        state: "limited",
      },
      installStatus: {
        state: "installed_unseen",
      },
    },
    operatorWorkspace: {
      status: {
        googleConnected: false,
      },
      nextAction: {
        title: "Verify live install",
      },
    },
    currentSection: "install",
  });

  assert.equal(result.usedFallback, true);
  assert.match(result.answer, /verification|live snippet|install/i);
  assert.deepEqual(result.suggestedPrompts, [
    "What should I fix first?",
    "Why is my install not verified?",
    "Why is my knowledge limited?",
    "What should I do next?",
  ]);
});

test("product help fallback explains missing outcomes and returns contextual prompts", async () => {
  const result = await answerVonzaProductHelp({
    openai: null,
    question: "Why am I not seeing outcomes yet?",
    agent: {
      assistantName: "Vonza",
      websiteUrl: "https://example.com",
      welcomeMessage: "Welcome to Vonza.",
      tone: "friendly",
      publicAgentKey: "public-key",
      knowledge: {
        state: "ready",
      },
      installStatus: {
        state: "not_installed",
      },
    },
    operatorWorkspace: {
      status: {
        googleConnected: true,
      },
      summary: {
        confirmedOutcomes: 0,
      },
    },
    currentSection: "analytics",
  });

  assert.equal(result.usedFallback, true);
  assert.match(result.answer, /not seeing outcomes yet|does not have enough live usage|install is not fully verified/i);
  assert.deepEqual(result.suggestedPrompts, [
    "What should I fix first?",
    "Why am I not seeing outcomes yet?",
    "What should I do next?",
  ]);
});
