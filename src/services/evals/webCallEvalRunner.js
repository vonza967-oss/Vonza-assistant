import { getOpenAIClient } from "../../clients/openaiClient.js";
import { handleChatRequest } from "../chat/chatService.js";
import {
  WEB_CALL_EVAL_CONVERSATION_SOURCE,
  WEB_CALL_EVAL_FIXTURE,
  WEB_CALL_EVAL_SCENARIOS,
} from "./webCallEvalScenarios.js";
import {
  buildWebCallEvalSummary,
  sanitizeWebCallEvalNote,
  scoreWebCallEvalScenario,
} from "./webCallEvalRubric.js";

const FORBIDDEN_SIDE_EFFECT_TABLES = new Set([
  "agent_contact_leads",
  "agent_booking_integrations",
  "agent_conversion_outcomes",
  "agent_follow_up_workflows",
  "agent_human_follow_up_statuses",
  "agent_owner_notifications",
  "operator_contacts",
  "operator_contact_identities",
  "operator_calendar_events",
  "operator_campaigns",
  "operator_campaign_recipients",
  "owner_ai_usage_ledger",
  "product_events",
  "web_call_sessions",
  "web_call_turn_telemetry",
]);

function normalizeMode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "live" ? "live" : "dry-run";
}

function createRunId(now = new Date()) {
  return `web-call-eval-${now.toISOString().replace(/[:.]/g, "-")}`;
}

function createSideEffectState() {
  return {
    forbiddenDbWrites: 0,
    forbiddenTables: {},
    localMessagePersistenceAttempts: 0,
    leadCaptureEvaluations: 0,
    billingEvents: 0,
    outboundMessages: 0,
    webCallSessions: 0,
    productEvents: 0,
    modelCalls: 0,
    promptSnapshots: [],
    storedMessageMetadata: [],
  };
}

async function withEvalConsole(options = {}, fn) {
  if (options.verbose === true) {
    return fn();
  }

  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (first, ...rest) => {
    const label = String(first || "");
    if (label.startsWith("[chat]") || label.startsWith("[live routing]")) {
      return;
    }
    originalInfo(first, ...rest);
  };
  console.warn = (first, ...rest) => {
    const label = String(first || "");
    if (label.startsWith("[front-desk rag]") || label.startsWith("[front-desk training]")) {
      return;
    }
    originalWarn(first, ...rest);
  };

  try {
    return await fn();
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}

function noteForbiddenWrite(state, table) {
  if (!FORBIDDEN_SIDE_EFFECT_TABLES.has(table)) {
    return;
  }

  state.forbiddenDbWrites += 1;
  state.forbiddenTables[table] = Number(state.forbiddenTables[table] || 0) + 1;
}

function createEvalSupabaseGuard(state) {
  class QueryBuilder {
    constructor(table) {
      this.table = table;
    }

    select() {
      return this;
    }

    insert() {
      noteForbiddenWrite(state, this.table);
      return Promise.resolve({ data: [], error: null });
    }

    update() {
      noteForbiddenWrite(state, this.table);
      return this;
    }

    upsert() {
      noteForbiddenWrite(state, this.table);
      return this;
    }

    delete() {
      noteForbiddenWrite(state, this.table);
      return this;
    }

    eq() {
      return this;
    }

    in() {
      return this;
    }

    gte() {
      return this;
    }

    lte() {
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    single() {
      return Promise.resolve({ data: null, error: null });
    }

    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    }

    then(resolve, reject) {
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
  };
}

function buildSemanticChunks(fixture = WEB_CALL_EVAL_FIXTURE) {
  return [
    {
      id: "eval-business-profile",
      sourceType: "business_profile",
      title: "BrightSide business profile",
      content: [
        `Approved services: ${fixture.businessProfile.approvedServices.join(", ")}.`,
        `Approved contact channels: ${fixture.businessProfile.approvedContactChannels.join(", ")}.`,
        fixture.businessProfile.pricingNotes,
        fixture.businessProfile.escalationNotes,
      ].join("\n"),
      similarity: 0.91,
    },
    {
      id: "eval-website-content",
      sourceType: "manual",
      title: fixture.websiteContent.pageTitle,
      sourceUrl: fixture.websiteContent.websiteUrl,
      content: fixture.websiteContent.content,
      similarity: 0.86,
    },
  ];
}

function buildEvalLeadCapture(state, scenario) {
  state.leadCaptureEvaluations += 1;

  if (!scenario.expectations?.leadCaptureExpected) {
    return {
      state: "not_applicable",
      shouldPrompt: false,
      message: "",
    };
  }

  return {
    state: "prompt_ready",
    shouldPrompt: true,
    trigger: "web_call_eval",
    reason: "scenario_expected_contact_capture",
    prompt: {
      body: "Share a safe contact channel so the business can follow up.",
    },
    message: "",
  };
}

function createDryRunReplyGenerator(state) {
  return async function generateDryRunReply() {
    state.modelCalls += 1;
    const scenario = state.currentScenario;
    const turnIndex = state.currentTurnIndex || 0;
    const reply = scenario?.idealReplies?.[turnIndex]
      || scenario?.idealReplies?.[scenario.idealReplies.length - 1]
      || "I can help, but I need one more detail to answer from the business information. What are you trying to do?";

    return reply;
  };
}

function buildEvalDeps({ state, mode, fixture }) {
  const deps = {
    resolveWidgetConversationContext: async () => ({
      agent: fixture.agent,
      business: fixture.business,
      widgetConfig: fixture.widgetConfig,
    }),
    getStoredWebsiteContent: async () => fixture.websiteContent,
    assertMessagesSchemaReady: async () => null,
    getOwnerBillingSnapshot: async () => null,
    processLiveChatLeadCapture: async () => buildEvalLeadCapture(state, state.currentScenario),
    buildChatResponse: async ({
      supabase,
      agent,
      businessId,
      widgetConfig,
      userMessage,
      reply,
      sessionKey,
      leadCapture = null,
      directRouting = null,
      visitorIdentity = null,
      displayMode = "page",
      conversationSource = WEB_CALL_EVAL_CONVERSATION_SOURCE,
      storeUserMessage = true,
      storeMessages,
    }) => {
      if (typeof storeMessages === "function") {
        await storeMessages(supabase, agent.id, [
          storeUserMessage ? { role: "user", content: userMessage } : null,
          { role: "assistant", content: reply },
        ].filter(Boolean), {
          sessionKey,
          visitorIdentity,
          displayMode,
          conversationSource,
        });
      }

      return {
        reply,
        agentId: agent.id,
        agentKey: agent.publicAgentKey,
        businessId,
        widgetConfig: {
          ...widgetConfig,
          assistantName: agent.name || widgetConfig.assistantName,
        },
        leadCapture,
        directRouting,
        visitorIdentity: {},
      };
    },
    storeAgentMessages: async (_supabase, _agentId, entries = [], options = {}) => {
      state.localMessagePersistenceAttempts += entries.length;
      state.storedMessageMetadata.push(...entries.map((entry) => ({
        role: entry.role,
        displayMode: options.displayMode || options.display_mode || "",
        conversationSource: options.conversationSource || options.conversation_source || "",
        webCallSessionIdPresent: Boolean(options.webCallSessionId || options.web_call_session_id),
      })));
      return [];
    },
    ensureWebCallSession: async () => {
      state.webCallSessions += 1;
      return null;
    },
    recordEstimatedUsage: async () => {
      state.billingEvents += 1;
      return [];
    },
    listRecentWidgetEvents: async () => [],
    evaluateLiveConversionRouting: () => ({ mode: "chat_only", intentType: "", primaryCta: null }),
    selectRelevantApprovedAnswers: async () => fixture.approvedAnswers,
    retrieveSemanticKnowledge: async () => ({
      chunks: buildSemanticChunks(fixture),
      confidence: "high",
      sourceLabels: ["business_profile", "manual"],
      semanticAvailable: false,
      error: "",
    }),
    getOperatorBusinessProfile: async () => fixture.businessProfile,
  };

  if (mode === "dry-run") {
    deps.generateAssistantReply = async (input) => {
      state.promptSnapshots.push({
        scenarioId: state.currentScenario?.id || "",
        turnIndex: state.currentTurnIndex || 0,
        hasWebCallStyle: /Web Call spoken response style/i.test(input.systemPrompt || ""),
      });
      return createDryRunReplyGenerator(state)(input);
    };
  }

  return deps;
}

function selectScenarios({ scenarios, scenarioIds = [], limit = 0 } = {}) {
  const idSet = new Set((scenarioIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  let selected = Array.isArray(scenarios) ? scenarios : WEB_CALL_EVAL_SCENARIOS;

  if (idSet.size) {
    selected = selected.filter((scenario) => idSet.has(scenario.id));
  }

  if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
    selected = selected.slice(0, Number(limit));
  }

  return selected;
}

function buildRequestBody({ fixture, scenario, turn, history, runId }) {
  return {
    message: turn,
    history,
    install_id: fixture.widgetConfig.installId,
    agent_id: fixture.agent.id,
    agent_key: fixture.agent.publicAgentKey,
    business_id: fixture.business.id,
    origin: "https://web-call-eval.vonza.local",
    page_url: `https://web-call-eval.vonza.local/scenarios/${scenario.id}`,
    display_mode: "page",
    conversation_source: WEB_CALL_EVAL_CONVERSATION_SOURCE,
    visitor_session_key: `${runId}:${scenario.id}`,
    web_call_id: `${runId}:${scenario.id}`,
  };
}

async function runScenario({ scenario, fixture, mode, openai, state, runId, includeReplies }) {
  const replies = [];
  const leadCaptures = [];
  let history = [];
  const deps = buildEvalDeps({ state, mode, fixture });
  const supabase = createEvalSupabaseGuard(state);

  for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
    const turn = scenario.turns[turnIndex];
    state.currentScenario = scenario;
    state.currentTurnIndex = turnIndex;

    const response = await handleChatRequest({
      supabase,
      openai,
      body: buildRequestBody({ fixture, scenario, turn, history, runId }),
    }, deps);
    const reply = response.reply || "";

    replies.push(reply);
    leadCaptures.push(response.leadCapture || null);
    history = [
      ...history,
      { role: "user", content: turn },
      { role: "assistant", content: reply },
    ].slice(-6);
  }

  const score = scoreWebCallEvalScenario(scenario, {
    replies,
    leadCapture: leadCaptures,
  });

  return {
    ...score,
    title: scenario.title,
    source: WEB_CALL_EVAL_CONVERSATION_SOURCE,
    mode,
    promptStyleApplied: state.promptSnapshots
      .filter((snapshot) => snapshot.scenarioId === scenario.id)
      .every((snapshot) => snapshot.hasWebCallStyle),
    ...(includeReplies
      ? { sanitizedReplies: replies.map((reply) => sanitizeWebCallEvalNote(reply)) }
      : {}),
  };
}

export async function runWebCallEvaluation(options = {}) {
  const mode = normalizeMode(options.mode || process.env.WEB_CALL_EVAL_MODE);
  const fixture = options.fixture || WEB_CALL_EVAL_FIXTURE;
  const scenarios = selectScenarios({
    scenarios: options.scenarios,
    scenarioIds: options.scenarioIds,
    limit: options.limit,
  });
  const state = createSideEffectState();
  const runId = options.runId || createRunId(options.now || new Date());
  const openai = mode === "live"
    ? options.openai || getOpenAIClient()
    : options.openai || {};
  const results = [];

  await withEvalConsole(options, async () => {
    for (const scenario of scenarios) {
      results.push(await runScenario({
        scenario,
        fixture,
        mode,
        openai,
        state,
        runId,
        includeReplies: options.includeReplies === true,
      }));
    }
  });

  const summary = buildWebCallEvalSummary(results);

  return {
    runId,
    mode,
    source: WEB_CALL_EVAL_CONVERSATION_SOURCE,
    scenarioCount: scenarios.length,
    summary,
    results,
    sideEffects: {
      forbiddenDbWrites: state.forbiddenDbWrites,
      forbiddenTables: state.forbiddenTables,
      localMessagePersistenceAttempts: state.localMessagePersistenceAttempts,
      leadCaptureEvaluations: state.leadCaptureEvaluations,
      billingEvents: state.billingEvents,
      outboundMessages: state.outboundMessages,
      webCallSessions: state.webCallSessions,
      productEvents: state.productEvents,
      modelCalls: state.modelCalls,
      storedMessageMetadata: state.storedMessageMetadata,
    },
  };
}

export function formatWebCallEvalReport(report = {}) {
  const summary = report.summary || {};
  const failedScenarios = summary.failedScenarios || [];
  const lines = [
    "Web Call eval summary",
    `Mode: ${report.mode || "dry-run"}`,
    `Source: ${report.source || WEB_CALL_EVAL_CONVERSATION_SOURCE}`,
    `Scenarios: ${summary.total || 0}`,
    `Passed: ${summary.passed || 0}`,
    `Failed: ${summary.failed || 0}`,
    `Pass rate: ${Number(summary.passRate || 0).toFixed(1)}%`,
  ];

  if (failedScenarios.length) {
    lines.push("", "Failed scenarios:");
    failedScenarios.slice(0, 20).forEach((failure) => {
      lines.push(`- ${failure.scenarioId} (${failure.score}/${failure.maxScore}): ${failure.failedCriteria.join(", ")}`);
    });
  }

  lines.push("", "Improvement notes:");
  (summary.improvementNotes || []).forEach((note) => {
    lines.push(`- ${sanitizeWebCallEvalNote(note)}`);
  });

  lines.push(
    "",
    `Side-effect guard: forbidden_db_writes=${report.sideEffects?.forbiddenDbWrites || 0}, billing_events=${report.sideEffects?.billingEvents || 0}, web_call_sessions=${report.sideEffects?.webCallSessions || 0}, outbound_messages=${report.sideEffects?.outboundMessages || 0}`
  );

  return lines.join("\n");
}

export function listWebCallEvalScenarios() {
  return WEB_CALL_EVAL_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    categories: scenario.categories,
    turnCount: scenario.turns.length,
  }));
}
