import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
} from "../src/agentPackages/index.js";
import { resolveAgentPackage } from "../src/services/agents/agentPackageResolver.js";
import { requireAgentAccess } from "../src/services/agents/agentService.js";
import { handleChatRequest } from "../src/services/chat/chatService.js";

const defaultPackage = getAgentPackage(DEFAULT_AGENT_PACKAGE_KEY);

function createAgentAccessSupabaseStub(agentRow) {
  return {
    from(table) {
      assert.equal(table, "agents");
      const filters = [];

      return {
        select(columns) {
          assert.match(columns, /\bpackage_key\b/);
          assert.match(columns, /\bpackage_version\b/);
          return this;
        },
        eq(column, value) {
          filters.push({ column, value });
          return this;
        },
        maybeSingle() {
          const matches = filters.every(({ column, value }) => agentRow[column] === value);
          return Promise.resolve({
            data: matches ? { ...agentRow } : null,
            error: null,
          });
        },
      };
    },
  };
}

test("resolver defaults to front_desk_general", () => {
  assert.equal(resolveAgentPackage(), defaultPackage);
  assert.equal(resolveAgentPackage(null, null), defaultPackage);
  assert.equal(resolveAgentPackage({}, {}), defaultPackage);
});

test("resolver accepts agent.packageKey", () => {
  const agentPackage = resolveAgentPackage({
    packageKey: " FRONT_DESK_GENERAL ",
  });

  assert.equal(agentPackage, defaultPackage);
  assert.equal(agentPackage.key, DEFAULT_AGENT_PACKAGE_KEY);
});

test("resolver accepts agent.package_key", () => {
  const agentPackage = resolveAgentPackage({
    package_key: "front_desk_general",
  });

  assert.equal(agentPackage, defaultPackage);
});

test("resolver uses packageKey from mapped agent service rows", async () => {
  const agent = await requireAgentAccess(
    createAgentAccessSupabaseStub({
      id: "agent-1",
      business_id: "business-1",
      client_id: "client-1",
      owner_user_id: "owner-1",
      access_status: "active",
      public_agent_key: "agent-key",
      package_key: "front_desk_general",
      package_version: "0.1.0",
      name: "Front Desk",
      purpose: "support",
      system_prompt: "",
      tone: "friendly",
      language: "English",
      is_active: true,
    }),
    {
      agentId: "agent-1",
      ownerUserId: "owner-1",
    }
  );

  assert.equal(agent.packageKey, DEFAULT_AGENT_PACKAGE_KEY);
  assert.equal(agent.packageVersion, "0.1.0");
  assert.equal(resolveAgentPackage(agent), defaultPackage);
});

test("resolver uses persisted hotel_concierge package fields from mapped agent rows", async () => {
  const hotelPackage = getAgentPackage("hotel_concierge");
  const agent = await requireAgentAccess(
    createAgentAccessSupabaseStub({
      id: "agent-1",
      business_id: "business-1",
      client_id: "client-1",
      owner_user_id: "owner-1",
      access_status: "active",
      public_agent_key: "agent-key",
      package_key: "hotel_concierge",
      package_version: "0.1.0",
      name: "Hotel Concierge",
      purpose: "support",
      system_prompt: "",
      tone: "friendly",
      language: "English",
      is_active: true,
    }),
    {
      agentId: "agent-1",
      ownerUserId: "owner-1",
    }
  );

  assert.equal(agent.packageKey, "hotel_concierge");
  assert.equal(agent.packageVersion, "0.1.0");
  assert.equal(resolveAgentPackage(agent), hotelPackage);
});

test("resolver accepts options override before agent fields", () => {
  const agent = {};
  Object.defineProperty(agent, "packageKey", {
    get() {
      throw new Error("agent package key should not be read when options override exists");
    },
  });

  assert.equal(resolveAgentPackage(agent, {
    packageKey: "front_desk_general",
  }), defaultPackage);
  assert.equal(resolveAgentPackage({
    packageKey: "unknown_package",
  }, {
    agentPackageKey: "front_desk_general",
  }), defaultPackage);
});

test("resolver falls back safely for unknown, blank, null, malformed, or non-string keys", () => {
  const cases = [
    { packageKey: "" },
    { packageKey: "   " },
    { packageKey: null },
    { packageKey: 42 },
    { packageKey: { key: "front_desk_general" } },
    { package_key: ["front_desk_general"] },
  ];

  for (const agent of cases) {
    assert.equal(resolveAgentPackage(agent), defaultPackage);
  }

  assert.equal(resolveAgentPackage({}, { packageKey: "unknown_package" }), defaultPackage);
  assert.equal(resolveAgentPackage({}, { package_key: "" }), defaultPackage);
  assert.equal(resolveAgentPackage({}, { agentPackageKey: null }), defaultPackage);
  assert.equal(resolveAgentPackage({}, { agent_package_key: 123 }), defaultPackage);
});

test("resolver tolerates package version fields without using them for lookup", () => {
  assert.equal(resolveAgentPackage({
    packageKey: "front_desk_general",
    packageVersion: "999.0.0",
    package_version: { unexpected: true },
  }), defaultPackage);
  assert.equal(resolveAgentPackage({}, {
    packageKey: "front_desk_general",
    packageVersion: "next",
    package_version: null,
  }), defaultPackage);
});

test("chat service passes the resolved package through prompt context builders", async () => {
  const captured = {
    resolverAgent: null,
    guidancePackage: null,
    businessContextPackage: null,
    systemPromptPackage: null,
  };
  const resolvedPackage = {
    ...defaultPackage,
    version: "test-resolved",
  };

  const result = await handleChatRequest(
    {
      supabase: {},
      openai: () => ({}),
      body: {
        message: "What can you help with?",
        install_id: "install-1",
        visitor_session_key: "session-1",
      },
    },
    {
      resolveWidgetConversationContext: async () => ({
        agent: {
          id: "agent-1",
          name: "Acme Front Desk",
          publicAgentKey: "agent-key",
          accessStatus: "active",
        },
        business: {
          id: "business-1",
          name: "Acme Services",
          vertical: "clinic",
        },
        widgetConfig: {
          assistantName: "Acme Front Desk",
          installId: "install-1",
        },
      }),
      resolveAgentPackage: (agent) => {
        captured.resolverAgent = agent;
        return resolvedPackage;
      },
      buildConversationGuidance: (_message, _history, options = {}) => {
        captured.guidancePackage = options.agentPackage;
        return "Captured conversation guidance.";
      },
      getStoredWebsiteContent: async () => ({
        businessId: "business-1",
        websiteUrl: "https://example.com",
        content: "Acme Services helps customers understand practical next steps.",
      }),
      assertMessagesSchemaReady: async () => {},
      buildBusinessContextForChat: (_contentRecord, _userMessage, options = {}) => {
        captured.businessContextPackage = options.agentPackage;
        return "Business facts: Acme Services helps customers understand practical next steps.";
      },
      buildChatSystemPrompt: (_language, _agent, options = {}) => {
        captured.systemPromptPackage = options.agentPackage;
        return "System prompt.";
      },
      retrieveSemanticKnowledge: async () => ({
        chunks: [],
        confidence: "low",
        sourceLabels: [],
        semanticAvailable: false,
      }),
      generateAssistantReply: async (payload) => {
        assert.equal(payload.conversationGuidance, "Captured conversation guidance.");
        return "I can help with the available details. What would you like to know next?";
      },
      processLiveChatLeadCapture: async () => ({
        state: "none",
      }),
      listRecentWidgetEvents: async () => [],
      evaluateLiveConversionRouting: () => ({
        mode: "chat_only",
      }),
      buildChatResponse: async (payload) => payload,
    }
  );

  assert.equal(captured.resolverAgent.vertical, "clinic");
  assert.equal(captured.guidancePackage, resolvedPackage);
  assert.equal(captured.businessContextPackage, resolvedPackage);
  assert.equal(captured.systemPromptPackage, resolvedPackage);
  assert.equal(result.reply, "I can help with the available details. What would you like to know next?");
});
