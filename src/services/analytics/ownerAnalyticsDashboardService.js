import { buildActionQueue } from "./actionQueueService.js";
import { buildCustomerQuestionSummaries } from "./analyticsSummaryService.js";
import { cleanText } from "../../utils/text.js";

const UNKNOWN_REPLY_PATTERNS = [
  /\bi don'?t (?:have|see|know)\b/i,
  /\bnot (?:listed|shown|available|provided|stated)\b/i,
  /\bdoes not (?:list|show|provide|state)\b/i,
  /\bcan't answer\b/i,
  /\bmissing\b/i,
  /\bnem (?:látok|találok|szerepel|tudok)\b/i,
  /\bnincs (?:feltüntetve|megadva|elérhető)\b/i,
];

function getTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeMessage(message = {}) {
  return {
    id: cleanText(message.id),
    role: cleanText(message.role).toLowerCase(),
    content: cleanText(message.content),
    sessionKey: cleanText(message.sessionKey || message.session_key),
    visitorEmail: cleanText(message.visitorEmail || message.visitor_email).toLowerCase(),
    visitorName: cleanText(message.visitorName || message.visitor_name),
    createdAt: message.createdAt || message.created_at || null,
  };
}

function listSessions(messages = []) {
  const sessionKeys = new Set();

  messages.forEach((message) => {
    if (message.sessionKey) {
      sessionKeys.add(message.sessionKey);
    }
  });

  return sessionKeys;
}

function countCapturedLeads(leadCaptures = {}) {
  const records = Array.isArray(leadCaptures.records) ? leadCaptures.records : [];
  return records.filter((record) => {
    const state = cleanText(record.captureState || record.capture_state).toLowerCase();
    const email = cleanText(record.contactEmail || record.contact_email);
    const phone = cleanText(record.contactPhone || record.contact_phone);
    return state === "captured" || Boolean(email || phone);
  }).length;
}

function findMissedQuestions(messages = [], limit = 8) {
  const ordered = [...messages].sort((left, right) => getTimestamp(left.createdAt) - getTimestamp(right.createdAt));
  const missed = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const message = ordered[index];

    if (message.role !== "assistant" || !UNKNOWN_REPLY_PATTERNS.some((pattern) => pattern.test(message.content))) {
      continue;
    }

    const previousUserMessage = [...ordered.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.role === "user" && candidate.sessionKey === message.sessionKey);

    if (!previousUserMessage?.content) {
      continue;
    }

    missed.push({
      question: previousUserMessage.content,
      reply: message.content,
      sessionKey: previousUserMessage.sessionKey,
      createdAt: message.createdAt,
    });

    if (missed.length >= limit) {
      break;
    }
  }

  return missed;
}

function buildAiUsageSnapshot(billingSnapshot = null) {
  const usage = billingSnapshot?.usage || {};
  const includedCents = Number(usage.includedCents || billingSnapshot?.includedAiBudgetCents || 0);
  const usedCents = Number(usage.usedCents || 0);

  return {
    planKey: cleanText(billingSnapshot?.planKey),
    planName: cleanText(billingSnapshot?.displayName),
    includedCents,
    usedCents,
    remainingCents: Number(usage.remainingCents || Math.max(0, includedCents - usedCents)),
    percentUsed: Number(usage.percentUsed || 0),
    warningState: cleanText(usage.warningState || "unknown"),
    statusLabel: cleanText(usage.statusLabel || "Usage unavailable"),
    isCapped: usage.isCapped === true,
    currentPeriodStart: billingSnapshot?.currentPeriodStart || null,
    currentPeriodEnd: billingSnapshot?.currentPeriodEnd || null,
  };
}

export function buildOwnerAnalyticsDashboard({
  agent = {},
  messages = [],
  leadCaptures = {},
  conversionOutcomes = {},
  widgetMetrics = {},
  billingSnapshot = null,
  actionQueue = null,
} = {}) {
  const normalizedMessages = messages.map((message) => normalizeMessage(message));
  const userMessages = normalizedMessages.filter((message) => message.role === "user");
  const sessions = listSessions(normalizedMessages);
  const fallbackActionQueue = actionQueue || buildActionQueue(normalizedMessages, []);
  const capturedLeads = countCapturedLeads(leadCaptures);
  const outcomeSummary = conversionOutcomes.summary || {};
  const assistedConversions = Number(outcomeSummary.assistedConversions || 0);
  const totalConversations = Math.max(
    sessions.size,
    Number(widgetMetrics.conversationStartedCount || 0),
    Number(widgetMetrics.conversationsSinceInstall || 0)
  );
  const leadsCaptured = Math.max(
    capturedLeads,
    Number(widgetMetrics.contactCapturedCount || 0),
    Number(fallbackActionQueue?.conversionSummary?.contactsCaptured || 0)
  );
  const conversionCount = Math.max(leadsCaptured, assistedConversions);
  const conversionRate = totalConversations > 0
    ? Number(((conversionCount / totalConversations) * 100).toFixed(1))
    : 0;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    agent: {
      id: cleanText(agent.id),
      name: cleanText(agent.name || agent.assistantName),
      businessId: cleanText(agent.businessId),
      vertical: cleanText(agent.vertical),
    },
    metrics: {
      totalConversations,
      totalMessages: normalizedMessages.length,
      visitorQuestions: userMessages.length,
      uniqueVisitors: Math.max(sessions.size, Number(widgetMetrics.uniqueSessionCount || 0)),
      leadsCaptured,
      assistedConversions,
      conversionRate,
      highIntentSignals: Number(fallbackActionQueue?.summary?.highIntent || fallbackActionQueue?.summary?.highIntentSignals || 0),
      missedQuestionCount: findMissedQuestions(normalizedMessages).length,
      ctaClicks: Number(widgetMetrics.ctaClicks || 0),
      ctaClickThroughRate: Number(widgetMetrics.ctaClickThroughRate || 0),
    },
    topVisitorQuestions: buildCustomerQuestionSummaries(normalizedMessages, 8),
    missedQuestions: findMissedQuestions(normalizedMessages),
    leadCapture: {
      records: Array.isArray(leadCaptures.records) ? leadCaptures.records : [],
      persistenceAvailable: leadCaptures.persistenceAvailable !== false,
    },
    conversions: {
      summary: outcomeSummary,
      recentOutcomes: Array.isArray(conversionOutcomes.recentOutcomes)
        ? conversionOutcomes.recentOutcomes
        : [],
      persistenceAvailable: conversionOutcomes.persistenceAvailable !== false,
    },
    aiUsage: buildAiUsageSnapshot(billingSnapshot),
  };
}
