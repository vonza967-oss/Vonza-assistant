import { handleChatRequest } from "../chat/chatService.js";
import { buildChatQuoteRequestDraft } from "../quotes/quoteRequestDraftService.js";
import { appearsHungarian, cleanText } from "../../utils/text.js";
import {
  QUOTE_DESK_HU_EVAL_FIXTURE,
  QUOTE_DESK_HU_EVAL_SCENARIOS,
  QUOTE_DESK_HU_EVAL_SOURCE,
} from "./quoteDeskHuEvalScenarios.js";

const PRICE_PATTERN = /(?:[$€£]\s?\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s?(?:huf|forint|ft|eur|euro|usd|dollars?)\b)/gi;
const GUARANTEED_QUOTE_PATTERN = /\b(guaranteed|final quote confirmed|quote accepted|exact price confirmed|garant[aá]lt|v[eé]gleges aj[aá]nlat elk[eé]sz[uü]lt|aj[aá]nlat elfogadva|pontos [aá]r meger[oő]s[ií]tve)\b/i;
const STAFF_REVIEW_PATTERN = /\b(staff for review|business.*confirm|request.*received|munkat[aá]rsaknak [aá]tn[eé]z[eé]sre|v[aá]llalkoz[aá]snak kell meger[oő]s[ií]tenie|aj[aá]nlatk[eé]r[eé]sedet)\b/i;
const USEFUL_DETAILS_PATTERN = /\b(contact detail|location|service|share|el[eé]rhet[oő]s[eé]g|helysz[ií]n|milyen szolg[aá]ltat[aá]s|add meg)\b/i;

function createRunId(now = new Date()) {
  return `quote-desk-hu-eval-${now.toISOString().replace(/[:.]/g, "-")}`;
}

function normalizeMode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "live" ? "live" : "dry-run";
}

function matchesPattern(pattern, value = "") {
  if (!pattern) {
    return false;
  }

  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }

  return cleanText(value).toLowerCase().includes(cleanText(pattern).toLowerCase());
}

function extractPrices(value = "") {
  return [...new Set((String(value || "").match(PRICE_PATTERN) || []).map(cleanText).filter(Boolean))];
}

function pricesAreAllowed(reply = "", scenario = {}) {
  const prices = extractPrices(reply);
  const allowed = scenario.allowedPricePatterns || [];
  const unsupported = prices.find((price) => !allowed.some((pattern) => matchesPattern(pattern, price)));

  return {
    passed: !unsupported,
    prices,
    unsupported,
  };
}

function buildCriterion(passed, note = "") {
  return {
    passed: Boolean(passed),
    score: passed ? 1 : 0,
    note: cleanText(note),
  };
}

function createSideEffects() {
  return {
    modelCalls: 0,
    quoteCreateAttempts: 0,
    storedMessageEntries: 0,
  };
}

function createEvalSupabaseGuard() {
  return {
    from(table) {
      throw new Error(`Unexpected Supabase table access during Quote Desk HU eval: ${table}`);
    },
  };
}

function buildScenarioDeps({ scenario, fixture, sideEffects }) {
  return {
    quoteRequestsFromChatEnabled: scenario.flagEnabled === true,
    resolveWidgetConversationContext: async () => ({
      agent: fixture.agent,
      business: fixture.business,
      widgetConfig: fixture.widgetConfig,
    }),
    assertMessagesSchemaReady: async () => null,
    getStoredWebsiteContent: async () => fixture.websiteContent,
    getOwnerBillingSnapshot: async () => null,
    selectRelevantApprovedAnswers: async () => [],
    getOperatorBusinessProfile: async () => null,
    retrieveSemanticKnowledge: async () => ({
      chunks: [],
      confidence: "low",
      sourceLabels: [],
      semanticAvailable: false,
    }),
    processLiveChatLeadCapture: async () => ({
      state: "not_applicable",
      shouldPrompt: false,
      message: "",
    }),
    listRecentWidgetEvents: async () => [],
    evaluateLiveConversionRouting: () => ({
      mode: "chat_only",
      source: QUOTE_DESK_HU_EVAL_SOURCE,
    }),
    buildChatQuoteRequestDraft,
    createAgentQuoteRequest: async (_supabase, payload) => {
      sideEffects.quoteCreateAttempts += 1;
      return {
        id: "redacted-eval-quote-request-id",
        status: payload.status,
      };
    },
    createAgentBookingRequest: async () => {
      throw new Error("Booking request creation should not run during Quote Desk HU eval.");
    },
    createAgentActionRequest: async () => {
      throw new Error("Action request creation should not run during Quote Desk HU eval.");
    },
    generateAssistantReply: async () => {
      sideEffects.modelCalls += 1;
      return scenario.modelReply
        || "Nem látok elég biztos információt pontos árhoz. Írd le a projektet és a vállalkozás átnézi.";
    },
    storeAgentMessages: async (_supabase, _agentId, entries = []) => {
      sideEffects.storedMessageEntries += entries.length;
      return [];
    },
    ensureWebCallSession: async () => null,
    recordEstimatedUsage: async () => null,
  };
}

function scoreQuoteDeskHuScenario(scenario, result, sideEffects) {
  const reply = result?.reply || "";
  const quoteRequest = result?.quoteRequest || null;
  const prices = pricesAreAllowed(reply, scenario);
  const captureOk = scenario.expectCapture === true
    ? quoteRequest?.created === true && quoteRequest.status === scenario.expectedStatus
    : !quoteRequest;
  const languageOk = scenario.expectHungarian === true ? appearsHungarian(reply) : true;
  const noGuarantee = !matchesPattern(GUARANTEED_QUOTE_PATTERN, reply);
  const reviewWordingOk = scenario.expectCapture === true
    ? matchesPattern(STAFF_REVIEW_PATTERN, reply)
    : true;
  const usefulDetailsOk = scenario.expectedMissingDetails === true
    ? matchesPattern(USEFUL_DETAILS_PATTERN, reply)
    : true;
  const flagBehaviorOk = scenario.flagEnabled === true || !quoteRequest;
  const modelCallOk = scenario.expectNoModelCall === true
    ? sideEffects.modelCalls === 0
    : true;

  const criteria = {
    language: buildCriterion(languageOk, languageOk ? "" : "Expected Hungarian reply."),
    noInventedPrice: buildCriterion(prices.passed, prices.unsupported ? `Unsupported price: ${prices.unsupported}` : ""),
    noGuaranteedQuote: buildCriterion(noGuarantee, noGuarantee ? "" : "Reply implies a guaranteed/final quote."),
    staffReviewWording: buildCriterion(reviewWordingOk, reviewWordingOk ? "" : "Expected request/staff-review wording."),
    usefulIntakeDetails: buildCriterion(usefulDetailsOk, usefulDetailsOk ? "" : "Expected useful missing intake details."),
    captureFlagBehavior: buildCriterion(captureOk && flagBehaviorOk, "Quote request capture did not match flag/scenario expectation."),
    deterministicAcknowledgement: buildCriterion(modelCallOk, "Expected no model call for deterministic acknowledgement."),
  };
  const failedCriteria = Object.entries(criteria)
    .filter(([, criterion]) => !criterion.passed)
    .map(([key]) => key);
  const score = Object.values(criteria).reduce((sum, criterion) => sum + criterion.score, 0);

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    passed: failedCriteria.length === 0,
    score,
    maxScore: Object.keys(criteria).length,
    failedCriteria,
    criteria,
    quoteRequest: quoteRequest ? { ...quoteRequest } : null,
    sideEffects: { ...sideEffects },
  };
}

export async function runQuoteDeskHuEvaluation(options = {}) {
  const mode = normalizeMode(options.mode);
  const runId = cleanText(options.runId) || createRunId();
  const requestedIds = new Set((options.scenarioIds || []).map(cleanText).filter(Boolean));
  const limit = Number(options.limit || 0);
  let scenarios = requestedIds.size
    ? QUOTE_DESK_HU_EVAL_SCENARIOS.filter((scenario) => requestedIds.has(scenario.id))
    : [...QUOTE_DESK_HU_EVAL_SCENARIOS];

  if (Number.isFinite(limit) && limit > 0) {
    scenarios = scenarios.slice(0, limit);
  }

  const results = [];
  const aggregateSideEffects = createSideEffects();

  for (const scenario of scenarios) {
    const sideEffects = createSideEffects();
    const fixture = {
      ...QUOTE_DESK_HU_EVAL_FIXTURE,
      agent: { ...QUOTE_DESK_HU_EVAL_FIXTURE.agent },
      business: { ...QUOTE_DESK_HU_EVAL_FIXTURE.business },
      widgetConfig: { ...QUOTE_DESK_HU_EVAL_FIXTURE.widgetConfig },
      websiteContent: { ...QUOTE_DESK_HU_EVAL_FIXTURE.websiteContent },
    };
    const result = await handleChatRequest(
      {
        supabase: createEvalSupabaseGuard(),
        openai: () => ({ stub: "quote-desk-hu-eval-openai" }),
        body: {
          message: scenario.message,
          install_id: fixture.widgetConfig.installId,
          visitor_session_key: `quote-desk-hu-${scenario.id}`,
          display_mode: "page",
          conversation_source: QUOTE_DESK_HU_EVAL_SOURCE,
        },
      },
      buildScenarioDeps({ scenario, fixture, sideEffects })
    );

    Object.keys(aggregateSideEffects).forEach((key) => {
      aggregateSideEffects[key] += Number(sideEffects[key] || 0);
    });
    results.push(scoreQuoteDeskHuScenario(scenario, result, sideEffects));
  }

  const failed = results.filter((result) => !result.passed);

  return {
    source: QUOTE_DESK_HU_EVAL_SOURCE,
    mode,
    runId,
    scenarioCount: results.length,
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      passRate: results.length ? Number((((results.length - failed.length) / results.length) * 100).toFixed(1)) : 0,
      failedScenarioIds: failed.map((result) => result.scenarioId),
      failureReasons: failed.flatMap((result) =>
        result.failedCriteria.map((criterion) => ({
          scenarioId: result.scenarioId,
          criterion,
          note: result.criteria[criterion]?.note || "",
        }))
      ),
    },
    sideEffects: aggregateSideEffects,
    results,
  };
}

export function formatQuoteDeskHuEvalReport(report = {}) {
  const lines = [
    "Quote Desk HU eval summary",
    `Run: ${report.runId || ""}`,
    `Mode: ${report.mode || "dry-run"}`,
    `Scenarios: ${report.scenarioCount || 0}`,
    `Passed: ${report.summary?.passed || 0}`,
    `Failed: ${report.summary?.failed || 0}`,
    `Pass rate: ${Number(report.summary?.passRate || 0).toFixed(1)}%`,
    `Model calls: ${report.sideEffects?.modelCalls || 0}`,
    `Quote create attempts: ${report.sideEffects?.quoteCreateAttempts || 0}`,
  ];

  if (report.summary?.failedScenarioIds?.length) {
    lines.push(`Failed scenarios: ${report.summary.failedScenarioIds.join(", ")}`);
  }

  return lines.join("\n");
}
