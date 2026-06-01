import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
} from "../src/agentPackages/index.js";
import { resolveAgentPackage as resolveRealAgentPackage } from "../src/services/agents/agentPackageResolver.js";
import { handleChatRequest } from "../src/services/chat/chatService.js";
import {
  buildBusinessContextForChat as buildRealBusinessContextForChat,
  buildChatSystemPrompt as buildRealChatSystemPrompt,
  buildConversationGuidance as buildRealConversationGuidance,
} from "../src/services/chat/prompting.js";

function createBlockedSupabase() {
  return {
    from(table) {
      throw new Error(`Unexpected Supabase table access: ${table}`);
    },
  };
}

function assertNoPublicPackageSwitchingFields(result) {
  assert.equal(Object.hasOwn(result, "agentPackage"), false);
  assert.equal(Object.hasOwn(result, "agentPackageKey"), false);
  assert.equal(Object.hasOwn(result, "packageKey"), false);
  assert.equal(Object.hasOwn(result.widgetConfig || {}, "agentPackage"), false);
  assert.equal(Object.hasOwn(result.widgetConfig || {}, "agentPackageKey"), false);
  assert.equal(Object.hasOwn(result.widgetConfig || {}, "packageKey"), false);
}

function createChatPackageIntegrationDeps({
  agent,
  business,
  widgetConfig,
  websiteContent,
  semanticChunks = [],
  reply,
  leadCapture,
  directRouting,
} = {}) {
  const captured = {
    resolverAgent: null,
    resolvedPackage: null,
    guidancePackage: null,
    businessContextPackage: null,
    businessContext: "",
    systemPromptPackage: null,
    systemPrompt: "",
    generatedPayload: null,
    leadCapturePayload: null,
    routingPayload: null,
    storedMessages: null,
    webCallSessionPayload: null,
  };

  const leadCaptureResult = leadCapture || {
    state: "prompt_ready",
    source: "lead-capture-stub",
    prompt: {
      body: "Stub lead capture prompt.",
    },
  };
  const directRoutingResult = directRouting || {
    mode: "chat_only",
    source: "routing-stub",
  };

  return {
    captured,
    leadCaptureResult,
    directRoutingResult,
    deps: {
      resolveWidgetConversationContext: async (_supabase, options) => {
        captured.resolveContextOptions = options;
        return {
          agent,
          business,
          widgetConfig,
        };
      },
      resolveAgentPackage: (resolvedAgent) => {
        captured.resolverAgent = resolvedAgent;
        captured.resolvedPackage = resolveRealAgentPackage(resolvedAgent);
        return captured.resolvedPackage;
      },
      buildConversationGuidance: (message, history, options = {}) => {
        captured.guidancePackage = options.agentPackage;
        return buildRealConversationGuidance(message, history, options);
      },
      getStoredWebsiteContent: async () => websiteContent,
      assertMessagesSchemaReady: async () => {},
      getOwnerBillingSnapshot: async () => {
        throw new Error("Billing lookup should not run for an ownerless synthetic agent.");
      },
      selectRelevantApprovedAnswers: async () => {
        throw new Error("Approved-answer lookup should not run for an ownerless synthetic agent.");
      },
      getOperatorBusinessProfile: async () => {
        throw new Error("Business profile lookup should not run for an ownerless synthetic agent.");
      },
      buildBusinessContextForChat: (contentRecord, userMessage, options = {}) => {
        captured.businessContextPackage = options.agentPackage;
        captured.businessContext = buildRealBusinessContextForChat(
          contentRecord,
          userMessage,
          options
        );
        return captured.businessContext;
      },
      buildChatSystemPrompt: (language, resolvedAgent, options = {}) => {
        captured.systemPromptPackage = options.agentPackage;
        captured.systemPrompt = buildRealChatSystemPrompt(language, resolvedAgent, options);
        return captured.systemPrompt;
      },
      retrieveSemanticKnowledge: async () => ({
        chunks: semanticChunks,
        confidence: semanticChunks.length ? "high" : "low",
        sourceLabels: semanticChunks.map((chunk) => chunk.title).filter(Boolean),
        semanticAvailable: semanticChunks.length > 0,
      }),
      generateAssistantReply: async (payload) => {
        captured.generatedPayload = payload;
        return reply;
      },
      processLiveChatLeadCapture: async (_supabase, payload) => {
        captured.leadCapturePayload = payload;
        return leadCaptureResult;
      },
      listRecentWidgetEvents: async () => [
        {
          eventName: "assistant_opened",
        },
      ],
      evaluateLiveConversionRouting: (payload) => {
        captured.routingPayload = payload;
        assert.equal(payload.leadCapture, leadCaptureResult);
        return directRoutingResult;
      },
      storeAgentMessages: async (supabase, agentId, entries, options = {}) => {
        captured.storedMessages = {
          supabase,
          agentId,
          entries,
          options,
        };
      },
      ensureWebCallSession: async (_supabase, payload) => {
        captured.webCallSessionPayload = payload;
        return {
          id: "web-call-session-1",
        };
      },
    },
  };
}

test("persisted Hotel Concierge package flows through chat prompt assembly", async () => {
  const hotelPackage = getAgentPackage("hotel_concierge");
  const supabase = createBlockedSupabase();
  const leadCapture = {
    state: "prompt_ready",
    source: "lead-capture-stub",
    prompt: {
      body: "May I get your name and email for staff follow-up?",
    },
  };
  const directRouting = {
    mode: "direct",
    source: "routing-stub",
    primaryCta: {
      ctaType: "booking",
      label: "Request dates",
      href: "https://seaside.example/book",
    },
  };
  const { deps, captured } = createChatPackageIntegrationDeps({
    agent: {
      id: "agent-hotel-1",
      name: "Seaside Concierge",
      publicAgentKey: "hotel-agent-key",
      accessStatus: "active",
      packageKey: "hotel_concierge",
      packageVersion: "0.1.0",
      purpose: "support",
      tone: "professional",
    },
    business: {
      id: "business-hotel-1",
      name: "Seaside Grand Hotel",
      vertical: "hotel",
    },
    widgetConfig: {
      assistantName: "Seaside Concierge",
      installId: "install-hotel-1",
      bookingUrl: "https://seaside.example/book",
      contactEmail: "reservations@seaside.example",
    },
    websiteContent: {
      businessId: "business-hotel-1",
      websiteUrl: "https://seaside.example",
      pageTitle: "Seaside Grand Hotel",
      content: [
        "Title: Seaside Grand Hotel rooms",
        "Headings: Rooms and booking",
        "Highlights: Guests can send an online booking request for stay dates.",
        "Description: Check-in is listed as 3:00 PM and check-out is listed as 11:00 AM.",
        "",
        "---",
        "",
        "Title: Seaside Grand Hotel policies",
        "Headings: Breakfast, parking, and cancellation",
        "Highlights: Standard flexible bookings can be cancelled up to 48 hours before arrival.",
      ].join("\n"),
    },
    semanticChunks: [
      {
        id: "hotel-booking",
        sourceType: "website",
        title: "Hotel booking details",
        sourceUrl: "https://seaside.example/rooms",
        content:
          "Seaside Grand Hotel guests can send an online booking request for stay dates. Check-in is 3:00 PM and check-out is 11:00 AM.",
        similarity: 0.91,
      },
    ],
    reply:
      "I cannot confirm live room availability here. Share your dates and I can point you to the hotel booking next step.",
    leadCapture,
    directRouting,
  });

  const result = await handleChatRequest(
    {
      supabase,
      openai: () => ({
        stub: "openai-client",
      }),
      body: {
        message: "Do you have rooms for Friday?",
        install_id: "install-hotel-1",
        visitor_session_key: "session-hotel-1",
        display_mode: "page",
        conversation_source: "web_call",
        visitor_identity_mode: "identified",
        visitor_email: "visitor@seaside.test",
      },
    },
    deps
  );

  assert.equal(captured.resolverAgent.packageKey, "hotel_concierge");
  assert.equal(captured.resolverAgent.packageVersion, "0.1.0");
  assert.equal(captured.resolverAgent.vertical, "hotel");
  assert.equal(captured.resolvedPackage, hotelPackage);
  assert.equal(captured.resolvedPackage.key, "hotel_concierge");
  assert.equal(captured.resolvedPackage.version, "0.1.0");
  assert.equal(captured.guidancePackage, hotelPackage);
  assert.equal(captured.businessContextPackage, hotelPackage);
  assert.equal(captured.systemPromptPackage, hotelPackage);

  assert.match(captured.systemPrompt, /Hotel concierge behavior:/);
  assert.match(captured.systemPrompt, /For availability or booking questions/);
  assert.match(captured.systemPrompt, /Package-specific risk rules:/);
  assert.match(captured.systemPrompt, /Do not guarantee live availability without live booking evidence/);
  assert.match(captured.systemPrompt, /Do not invent rates\/fees\/taxes\/discounts/);
  assert.match(captured.systemPrompt, /Web Call spoken response style:/);
  assert.match(captured.systemPrompt, /write for speech/);
  assert.equal(captured.generatedPayload.systemPrompt, captured.systemPrompt);
  assert.equal(captured.generatedPayload.referenceBlocks.length, 1);
  assert.equal(captured.generatedPayload.referenceBlocks[0].label, "Front Desk retrieved business context");
  assert.match(captured.generatedPayload.referenceBlocks[0].content, /WEBSITE CONTEXT:/);
  assert.match(captured.generatedPayload.referenceBlocks[0].content, /Seaside Grand Hotel/);
  assert.equal(Object.hasOwn(captured.generatedPayload, "tools"), false);
  assert.equal(Object.hasOwn(captured.generatedPayload, "toolRegistry"), false);

  assert.equal(captured.webCallSessionPayload.eventName, "web_call_turn_sent");
  assert.equal(captured.leadCapturePayload.conversationSource, "web_call");
  assert.equal(captured.routingPayload.leadCapture, leadCapture);
  assert.equal(result.leadCapture, leadCapture);
  assert.equal(result.directRouting, directRouting);
  assert.equal(result.reply, "I cannot confirm live room availability here. Share your dates and I can point you to the hotel booking next step.");
  assert.equal(result.agentId, "agent-hotel-1");
  assert.equal(result.agentKey, "hotel-agent-key");
  assert.equal(result.businessId, "business-hotel-1");
  assert.equal(result.widgetConfig.assistantName, "Seaside Concierge");
  assert.equal(result.visitorIdentity.email, "visitor@seaside.test");
  assertNoPublicPackageSwitchingFields(result);

  assert.equal(captured.storedMessages.supabase, supabase);
  assert.equal(captured.storedMessages.agentId, "agent-hotel-1");
  assert.deepEqual(captured.storedMessages.entries.map((entry) => entry.role), ["user", "assistant"]);
  assert.equal(captured.storedMessages.options.conversationSource, "web_call");
  assert.equal(captured.storedMessages.options.webCallSessionId, "web-call-session-1");
});

test("agent without package fields keeps default Front Desk prompt behavior", async () => {
  const defaultPackage = getAgentPackage(DEFAULT_AGENT_PACKAGE_KEY);
  const { deps, captured } = createChatPackageIntegrationDeps({
    agent: {
      id: "agent-default-1",
      name: "Acme Front Desk",
      publicAgentKey: "default-agent-key",
      accessStatus: "active",
      purpose: "support",
      tone: "friendly",
    },
    business: {
      id: "business-default-1",
      name: "Acme Home Services",
      vertical: "home_services",
    },
    widgetConfig: {
      assistantName: "Acme Front Desk",
      installId: "install-default-1",
      contactEmail: "hello@acme-home.example",
    },
    websiteContent: {
      businessId: "business-default-1",
      websiteUrl: "https://acme-home.example",
      pageTitle: "Acme Home Services",
      content: [
        "Title: Acme Home Services",
        "Headings: Maintenance and inspections",
        "Highlights: Acme Home Services offers maintenance inspections and repair planning.",
      ].join("\n"),
    },
    semanticChunks: [
      {
        id: "default-services",
        sourceType: "website",
        title: "Home service details",
        sourceUrl: "https://acme-home.example/services",
        content: "Acme Home Services offers maintenance inspections and repair planning.",
        similarity: 0.88,
      },
    ],
    reply:
      "Acme Home Services can help with maintenance inspections and repair planning. Which service do you want help with first?",
  });

  const result = await handleChatRequest(
    {
      supabase: createBlockedSupabase(),
      openai: () => ({
        stub: "openai-client",
      }),
      body: {
        message: "What maintenance services do you offer?",
        install_id: "install-default-1",
        visitor_session_key: "session-default-1",
      },
    },
    deps
  );

  assert.equal(captured.resolverAgent.packageKey, undefined);
  assert.equal(captured.resolvedPackage, defaultPackage);
  assert.equal(captured.resolvedPackage.key, DEFAULT_AGENT_PACKAGE_KEY);
  assert.equal(captured.businessContextPackage, defaultPackage);
  assert.equal(captured.systemPromptPackage, defaultPackage);
  assert.match(captured.systemPrompt, /represent the assistant identity as Acme Front Desk/);
  assert.match(captured.systemPrompt, /Selected business vertical: Home services/);
  assert.doesNotMatch(captured.systemPrompt, /Hotel concierge behavior:/);
  assert.doesNotMatch(captured.systemPrompt, /Package-specific risk rules:/);
  assert.doesNotMatch(captured.systemPrompt, /Do not guarantee live availability without live booking evidence/);
  assert.equal(result.reply, "Acme Home Services can help with maintenance inspections and repair planning. Which service do you want help with first?");
  assert.equal(result.agentId, "agent-default-1");
  assert.equal(result.agentKey, "default-agent-key");
  assert.equal(result.businessId, "business-default-1");
  assert.equal(result.leadCapture.source, "lead-capture-stub");
  assert.equal(result.directRouting.source, "routing-stub");
  assertNoPublicPackageSwitchingFields(result);
});
