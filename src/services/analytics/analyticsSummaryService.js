import { cleanText } from "../../utils/text.js";

const HIGH_INTENT_ACTION_TYPES = new Set([
  "lead_follow_up",
  "pricing_interest",
  "booking_intent",
  "repeat_high_intent_visitor",
]);

function normalizeMessages(messages = []) {
  return Array.isArray(messages)
    ? messages.map((message) => ({
      role: cleanText(message.role).toLowerCase(),
      content: cleanText(message.content),
      createdAt: message.createdAt || message.created_at || null,
    }))
    : [];
}

function getTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function includesAny(text = "", patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function getQuestionLanguage(text = "") {
  return includesAny(text, [
    /\b(mennyibe|ara|arak|arajanlat|ára|árak|árajánlat|idopont|időpont|foglal|elerheto|elérhető|kapcsolat|telefon|hiv|hív|webaruhaz|webáruház|szallitas|szállítás|szolgaltatas|szolgáltatás|nyitva|vallal|vállal|szabad)\b/i,
    /[áéíóöőúüű]/i,
  ])
    ? "hu"
    : "en";
}

function localizeQuestionSummary(language = "en", english = "", hungarian = "") {
  return language === "hu" ? hungarian : english;
}

function normalizeDashboardSummaryLanguage(value) {
  const normalized = cleanText(value).toLowerCase();
  return ["en", "hu"].includes(normalized) ? normalized : "";
}

export function summarizeCustomerQuestionIntent(message = "", options = {}) {
  const text = cleanText(message).toLowerCase();
  const language = normalizeDashboardSummaryLanguage(options.dashboardLanguage || options.language)
    || getQuestionLanguage(text);

  if (!text) {
    return localizeQuestionSummary(
      language,
      "Trying to clarify the next customer-service step",
      "A következő ügyfélszolgálati lépést próbálja tisztázni"
    );
  }

  if (includesAny(text, [/\b(contact|reach|call|email|phone|talk to|speak to|get in touch|someone)\b/i, /\b(kapcsolat|telefon|email|e-mail|hiv|hivni|eler|elerni|beszelni)\b/i])) {
    return localizeQuestionSummary(language, "Asking how to contact the business directly", "Közvetlen kapcsolatfelvételi lehetőséget keres");
  }

  if (includesAny(text, [/\b(price|pricing|cost|quote|estimate|fee|how much|package|plan)\b/i, /\b(ar|arak|ara|arajanlat|mennyibe|koltseg|dij|csomag)\b/i])) {
    return localizeQuestionSummary(language, "Requesting pricing or quote details", "Árakat vagy árajánlat részleteit kéri");
  }

  if (includesAny(text, [/\b(book|booking|appointment|schedule|availability|reserve|consultation|available)\b/i, /\b(idopont|foglal|foglalo|bejelentkez|szabad|elerheto|konzultacio)\b/i])) {
    return localizeQuestionSummary(language, "Looking for booking or availability", "Időpontot vagy elérhetőséget keres");
  }

  if (includesAny(text, [/\b(webshop|online store|ecommerce|e-commerce|cart|checkout|order online|purchase online)\b/i, /\b(webaruhaz|webshop|online rendeles|kosar|rendeles|online vasarlas)\b/i])) {
    return localizeQuestionSummary(language, "Asking about webshop options and next steps", "Webáruház lehetőségekről és következő lépésekről érdeklődik");
  }

  if (includesAny(text, [/\b(delivery|shipping|ship|turnaround|lead time|how long|when can|arrival|deliver)\b/i, /\b(szallitas|kiszallitas|mennyi ido|mikor|hatarido|erkezik|atfutas)\b/i])) {
    return localizeQuestionSummary(language, "Looking for delivery timing or service turnaround", "Szállítási vagy teljesítési időt keres");
  }

  if (includesAny(text, [/\b(open|hours|opening|closed|holiday|weekend)\b/i, /\b(nyitva|nyitvatartas|zarva|hetvege|unnepnap)\b/i])) {
    return localizeQuestionSummary(language, "Checking opening hours or customer-service availability", "Nyitvatartást vagy ügyfélszolgálati elérhetőséget ellenőriz");
  }

  if (includesAny(text, [/\b(location|address|near|area|serve|service area|where are)\b/i, /\b(cim|helyszin|kozel|terulet|kiszall|hol|varos)\b/i])) {
    return localizeQuestionSummary(language, "Checking location or service-area coverage", "Helyszínt vagy kiszolgálási területet ellenőriz");
  }

  if (includesAny(text, [/\b(service|services|offer|provide|help with|do you do|which service|fit my needs|product)\b/i, /\b(szolgaltatas|kinal|vallal|miben tud|melyik szolgaltatas|termek)\b/i])) {
    return localizeQuestionSummary(language, "Checking whether the business offers a specific service", "Azt ellenőrzi, hogy elérhető-e egy konkrét szolgáltatás");
  }

  if (includesAny(text, [/\b(cancel|refund|warranty|guarantee|return|policy|problem|issue|support)\b/i, /\b(lemondas|visszaterites|garancia|problema|hiba|panasz|segitseg)\b/i])) {
    return localizeQuestionSummary(language, "Looking for help with a support or policy issue", "Támogatásra vagy szabályzati kérdésre keres választ");
  }

  return localizeQuestionSummary(
    language,
    "Trying to understand which service fits their needs",
    "Azt próbálja tisztázni, melyik szolgáltatás illik az igényeihez"
  );
}

export function buildCustomerQuestionSummaries(messages = [], limit = 6, options = {}) {
  const grouped = new Map();

  normalizeMessages(messages)
    .filter((message) => message.role === "user" && message.content)
    .forEach((message) => {
      const summary = summarizeCustomerQuestionIntent(message.content, options);
      const existing = grouped.get(summary) || {
        summary,
        count: 0,
        lastAskedAt: null,
      };
      existing.count += 1;
      if (!existing.lastAskedAt || getTimestamp(message.createdAt) > getTimestamp(existing.lastAskedAt)) {
        existing.lastAskedAt = message.createdAt || null;
      }
      grouped.set(summary, existing);
    });

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || getTimestamp(right.lastAskedAt) - getTimestamp(left.lastAskedAt))
    .slice(0, limit);
}

function buildDefaultRecentActivity() {
  return {
    level: "none",
    description: "No live activity yet",
    copy: "No live conversations have been stored yet.",
    lastActivityAt: null,
  };
}

function buildDefaultOperatorSignal() {
  return {
    title: "No service signal yet",
    copy: "There is not a strong lead, booking, pricing, or support signal yet.",
    subtle: "No weak-answer signal has been detected yet.",
  };
}

export function createEmptyAnalyticsSummary() {
  return {
    ready: true,
    syncState: "ready",
    diagnosticsMessage: "",
    conversationCount: 0,
    uniqueVisitorCount: 0,
    totalMessages: 0,
    visitorQuestions: 0,
    highIntentSignals: 0,
    directCtasShown: 0,
    ctaClicks: 0,
    ctaClickThroughRate: 0,
    contactsCaptured: 0,
    assistedOutcomes: 0,
    weakAnswerCount: 0,
    attentionNeeded: 0,
    lastMessageAt: null,
    customerQuestionSummaries: [],
    recentActivity: buildDefaultRecentActivity(),
    operatorSignal: buildDefaultOperatorSignal(),
  };
}

function buildRecentActivity({
  totalMessages,
  visitorQuestions,
  lastMessageAt,
  widgetMetrics = {},
  installStatus = {},
  syncState,
}) {
  const base = buildDefaultRecentActivity();

  if (syncState === "pending") {
    return {
      ...base,
      level: "pending",
      description: "Syncing recent live activity",
      copy: "Widget activity was detected before the stored conversation read model caught up.",
      lastActivityAt: widgetMetrics.lastConversationAt || installStatus.lastSeenAt || null,
    };
  }

  if (!totalMessages && !visitorQuestions) {
    if (cleanText(installStatus.state) === "seen_recently" || cleanText(installStatus.state) === "seen_stale") {
      return {
        ...base,
        level: "waiting",
        description: "Live install detected, waiting for first stored conversation",
        copy: "Open the live site and send a real test question to confirm chat persistence and analytics end to end.",
        lastActivityAt: installStatus.lastSeenAt || null,
      };
    }

    return base;
  }

  const hoursSinceLastMessage = lastMessageAt
    ? Math.max(0, (Date.now() - getTimestamp(lastMessageAt)) / (1000 * 60 * 60))
    : null;

  if (hoursSinceLastMessage !== null && hoursSinceLastMessage <= 24 && visitorQuestions >= 3) {
    return {
      level: "active",
      description: "Active in the last day",
      copy: `${visitorQuestions} visitor question${visitorQuestions === 1 ? "" : "s"} and ${totalMessages} total stored message${totalMessages === 1 ? "" : "s"} are already in the read model.`,
      lastActivityAt: lastMessageAt,
    };
  }

  if (hoursSinceLastMessage !== null && hoursSinceLastMessage <= 72) {
    return {
      level: "recent",
      description: "Recent live usage",
      copy: `${visitorQuestions} visitor question${visitorQuestions === 1 ? "" : "s"} and ${totalMessages} total stored message${totalMessages === 1 ? "" : "s"} have been captured recently.`,
      lastActivityAt: lastMessageAt,
    };
  }

  return {
    level: "historical",
    description: "Earlier stored activity",
    copy: `${totalMessages} stored message${totalMessages === 1 ? "" : "s"} are available from earlier live usage.`,
    lastActivityAt: lastMessageAt,
  };
}

function buildOperatorSignal({
  highIntentSignals,
  weakAnswerCount,
  widgetMetrics = {},
  installStatus = {},
}) {
  const base = buildDefaultOperatorSignal();

  if (highIntentSignals > 0) {
    return {
      title: "High-intent service signal",
      copy: `${highIntentSignals} high-intent customer signal${highIntentSignals === 1 ? "" : "s"} have already appeared.`,
      subtle: weakAnswerCount > 0
        ? `${weakAnswerCount} conversation${weakAnswerCount === 1 ? "" : "s"} still need a stronger answer path.`
        : `${Number(widgetMetrics.conversationsSinceInstall || 0)} conversation${Number(widgetMetrics.conversationsSinceInstall || 0) === 1 ? "" : "s"} started since install.`,
    };
  }

  if (Number(widgetMetrics.conversationsSinceInstall || 0) === 0 && ["seen_recently", "seen_stale", "installed_unseen"].includes(cleanText(installStatus.state))) {
    return {
      title: "No conversation signal yet",
      copy: "0 conversations since install. Run a live test flow to confirm visitors can reach the assistant.",
      subtle: weakAnswerCount > 0
        ? `${weakAnswerCount} conversation${weakAnswerCount === 1 ? "" : "s"} already showed a weak-answer signal.`
        : "Once real conversations arrive, Vonza will surface customer-service signals here.",
    };
  }

  if (weakAnswerCount > 0) {
    return {
      title: "Answer quality signal",
      copy: `${weakAnswerCount} conversation${weakAnswerCount === 1 ? "" : "s"} may need a stronger answer path.`,
      subtle: "Review the weak-answer conversations before similar visitors hit the same gap again.",
    };
  }

  return base;
}

export function buildAnalyticsSummary({
  messages = [],
  actionQueue = {},
  widgetMetrics = {},
  installStatus = {},
  diagnosticsMessage = "",
  dashboardLanguage = "",
} = {}) {
  const summary = createEmptyAnalyticsSummary();
  const normalizedMessages = normalizeMessages(messages);
  const queueItems = Array.isArray(actionQueue.items) ? actionQueue.items : [];
  const conversionSummary = {
    ...actionQueue.conversionSummary,
  };
  const outcomeSummary = {
    ...actionQueue.outcomeSummary,
  };
  const orderedMessages = normalizedMessages
    .slice()
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));
  const lastMessageAt = orderedMessages[0]?.createdAt || null;
  const totalMessages = normalizedMessages.length;
  const visitorQuestions = normalizedMessages.filter((message) => message.role === "user").length;
  const highIntentSignals = Number(conversionSummary.highIntentConversations || 0)
    || queueItems.filter((item) => HIGH_INTENT_ACTION_TYPES.has(cleanText(item.actionType))).length;
  const weakAnswerCount = queueItems.filter((item) => item.weakAnswer === true || item.unresolved === true).length;
  const syncState =
    totalMessages === 0
    && visitorQuestions === 0
    && Number(widgetMetrics.conversationsSinceInstall || 0) > 0
      ? "pending"
      : "ready";

  return {
    ...summary,
    ready: !diagnosticsMessage,
    syncState,
    diagnosticsMessage: cleanText(diagnosticsMessage),
    conversationCount: Number(widgetMetrics.conversationsSinceInstall || widgetMetrics.conversationStartedCount || 0),
    uniqueVisitorCount: Number(widgetMetrics.uniqueSessionCount || 0),
    totalMessages,
    visitorQuestions,
    highIntentSignals,
    directCtasShown: Number(conversionSummary.directCtasShown || 0),
    ctaClicks: Number(conversionSummary.ctaClicks || 0),
    ctaClickThroughRate: Number(conversionSummary.ctaClickThroughRate || 0),
    contactsCaptured: Number(conversionSummary.contactsCaptured || 0),
    assistedOutcomes: Number(outcomeSummary.assistedConversions || 0),
    weakAnswerCount,
    attentionNeeded: Number(actionQueue.summary?.attentionNeeded || 0),
    lastMessageAt,
    customerQuestionSummaries: buildCustomerQuestionSummaries(normalizedMessages, 6, {
      dashboardLanguage,
    }),
    recentActivity: buildRecentActivity({
      totalMessages,
      visitorQuestions,
      lastMessageAt,
      widgetMetrics,
      installStatus,
      syncState,
    }),
    operatorSignal: buildOperatorSignal({
      highIntentSignals,
      weakAnswerCount,
      widgetMetrics,
      installStatus,
    }),
  };
}
