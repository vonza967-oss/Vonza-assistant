import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_HELP_UNAVAILABLE_MESSAGE,
  answerVonzaProductHelp,
} from "../src/services/support/productHelpService.js";

test("product help routes arbitrary questions through the Responses API with app context", async () => {
  let capturedRequest = null;
  const openai = {
    responses: {
      create: async (request) => {
        capturedRequest = request;
        return {
          output_text: "Dynamic answer: start with install verification, then refresh website knowledge.",
        };
      },
    },
  };

  const result = await answerVonzaProductHelp({
    openai,
    question: "What should I fix first if customers are not showing up?",
    history: [
      { role: "user", content: "How do I use this area?" },
      { role: "assistant", content: "Use Home to find the next best action." },
    ],
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
        state: "verify_failed",
        host: "example.com",
      },
    },
    operatorWorkspace: {
      status: {
        googleConnected: false,
      },
      connectedAccounts: [],
      contacts: {
        summary: {
          totalContacts: 7,
          contactsNeedingAttention: 4,
          leadsWithoutNextStep: 3,
          complaintRiskContacts: 1,
        },
      },
      nextAction: {
        title: "Verify live install",
        description: "Confirm the widget is visible on the right website.",
      },
      businessProfile: {
        services: [
          { name: "Emergency plumbing" },
          { name: "Water heater install" },
        ],
        pricing: [
          { label: "Diagnostics", amount: "$149" },
        ],
        readiness: {
          missingCount: 1,
          summary: "1 business context area still needs review.",
        },
      },
    },
    currentSection: "install",
  });

  assert.equal(result.usedFallback, false);
  assert.match(result.answer, /Dynamic answer/i);
  assert.equal(capturedRequest.model, "gpt-4o-mini");
  assert.match(capturedRequest.instructions, /in-app support mode of Vonza AI/);

  const workspaceContext = capturedRequest.input.find((message) =>
    message.role === "developer" && /Current workspace reference/.test(message.content)
  );
  assert.match(workspaceContext.content, /Current page: Install/);
  assert.match(workspaceContext.content, /Website knowledge state: limited/);
  assert.match(workspaceContext.content, /Install state: verify_failed/);
  assert.match(workspaceContext.content, /Install detected: no/);
  assert.match(workspaceContext.content, /Install host: example\.com/);
  assert.match(workspaceContext.content, /Google connected: no/);
  assert.match(workspaceContext.content, /Total tracked contacts: 7/);
  assert.match(workspaceContext.content, /Customers needing attention: 4/);
  assert.match(workspaceContext.content, /Leads missing next step: 3/);
  assert.match(workspaceContext.content, /Complaint-risk customers: 1/);
  assert.match(workspaceContext.content, /Services in business profile: 2/);
  assert.match(workspaceContext.content, /Example services: Emergency plumbing, Water heater install/);
  assert.match(workspaceContext.content, /Pricing entries in business profile: 1/);

  const userMessages = capturedRequest.input.filter((message) => message.role === "user");
  assert.equal(userMessages[0].content, "How do I use this area?");
  assert.equal(userMessages.at(-1).content, "What should I fix first if customers are not showing up?");
});

test("product help does not generate canned answers when AI is unavailable", async () => {
  await assert.rejects(
    answerVonzaProductHelp({
      openai: null,
      question: "Why is my install not verified?",
      currentSection: "install",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.exposeToClient, true);
      assert.equal(error.message, PRODUCT_HELP_UNAVAILABLE_MESSAGE);
      assert.doesNotMatch(error.message, /Open Install|live snippet|knowledge import/i);
      return true;
    }
  );
});

test("product help returns a clean temporary fallback when the model fails", async () => {
  const openai = {
    responses: {
      create: async () => {
        throw new Error("upstream timeout");
      },
    },
  };

  await assert.rejects(
    answerVonzaProductHelp({
      openai,
      question: "What should I do next?",
      currentSection: "overview",
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, PRODUCT_HELP_UNAVAILABLE_MESSAGE);
      assert.equal(error.reason, "upstream timeout");
      return true;
    }
  );
});
