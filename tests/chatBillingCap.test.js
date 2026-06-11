import test from "node:test";
import assert from "node:assert/strict";

import { handleChatRequest } from "../src/services/chat/chatService.js";

function createCappedChatDeps(overrides = {}) {
  return {
    resolveWidgetConversationContext: async () => ({
      agent: {
        id: "agent-1",
        name: "Vonza Assistant",
        publicAgentKey: "agent-key",
        ownerUserId: "owner-1",
        accessStatus: "active",
      },
      business: {
        id: "business-1",
        name: "Example Business",
      },
      widgetConfig: {
        assistantName: "Vonza Assistant",
        installId: "install-1",
      },
    }),
    getStoredWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com",
      content: "Example website content",
    }),
    assertMessagesSchemaReady: async () => {},
    getOwnerBillingSnapshot: async () => ({
      usage: {
        isCapped: true,
      },
    }),
    processLiveChatLeadCapture: async () => ({
      state: "prompt_ready",
    }),
    generateAssistantReply: async () => {
      throw new Error("generateAssistantReply should not run for capped workspaces");
    },
    recordEstimatedUsage: async () => {
      throw new Error("recordEstimatedUsage should not run for capped workspaces");
    },
    buildChatResponse: async (payload) => payload,
    ...overrides,
  };
}

test("capped workspaces switch chat into the safe monthly-capacity fallback", async () => {
  let generatedReplies = 0;
  let recordedUsage = 0;

  const result = await handleChatRequest(
    {
      supabase: {},
      openai: () => ({}),
      body: {
        message: "Can you help me choose the right service?",
        install_id: "install-1",
        visitor_session_key: "session-1",
      },
    },
    createCappedChatDeps({
      generateAssistantReply: async () => {
        generatedReplies += 1;
        return "This should never be returned.";
      },
      recordEstimatedUsage: async () => {
        recordedUsage += 1;
      },
    })
  );

  assert.equal(generatedReplies, 0);
  assert.equal(recordedUsage, 0);
  assert.match(result.reply, /reached this month's AI capacity/i);
  assert.equal(result.leadCapture.shouldPrompt, true);
  assert.equal(result.leadCapture.reason, "ai_capacity_reached");
  assert.match(result.leadCapture.prompt.body, /email address|phone number/i);
  assert.doesNotMatch(result.reply, /token|api/i);
});

test("Hungarian capped workspace fallback uses formal contact capture copy", async () => {
  const result = await handleChatRequest(
    {
      supabase: {},
      openai: () => ({}),
      body: {
        message: "Mennyibe kerül a szolgáltatás?",
        install_id: "install-1",
        visitor_session_key: "session-hu-capacity",
      },
    },
    createCappedChatDeps()
  );

  assert.match(result.reply, /Ebben a hónapban elértük az AI kapacitást/i);
  assert.match(result.reply, /Ha szeretné, megadhatja az elérhetőségeit/i);
  assert.match(result.leadCapture.prompt.body, /Kérem, adja meg a legjobb email címét vagy telefonszámát/i);
  assert.doesNotMatch(
    `${result.reply} ${result.leadCapture.prompt.body}`,
    /\b(?:szeretnéd|megadhatod|add meg|próbáld|írd be|tudsz|elérhetőségedet|címedet|telefonszámodat)\b/i
  );
});

test("capped workspaces keep an already-captured visitor from being prompted again", async () => {
  const result = await handleChatRequest(
    {
      supabase: {},
      openai: () => ({}),
      body: {
        message: "Please follow up with me.",
        install_id: "install-1",
        visitor_session_key: "session-2",
      },
    },
    createCappedChatDeps({
      processLiveChatLeadCapture: async () => ({
        state: "captured",
        email: "hello@example.com",
      }),
    })
  );

  assert.equal(result.leadCapture.shouldPrompt, false);
  assert.equal(result.leadCapture.message, "");
  assert.match(result.reply, /reached this month's AI capacity/i);
});
