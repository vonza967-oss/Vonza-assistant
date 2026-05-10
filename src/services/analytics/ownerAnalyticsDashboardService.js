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

function findPreviousUserMessage(messages = [], assistantMessage = {}) {
  const assistantTimestamp = getTimestamp(assistantMessage.createdAt);

  return [...messages]
    .filter((message) =>
      message.role === "user" &&
      message.sessionKey === assistantMessage.sessionKey &&
      getTimestamp(message.createdAt) <= assistantTimestamp
    )
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt))[0] || null;
}

function findAssistantMessageForFeedback(messages = [], feedback = {}) {
  const messageKey = cleanText(feedback.assistantMessageKey || feedback.assistant_message_key);
  const sessionKey = cleanText(feedback.sessionKey || feedback.session_key);

  if (!messageKey) {
    return null;
  }

  return messages.find((message) =>
    message.role === "assistant" &&
    cleanText(message.id || message.messageId || message.message_id) === messageKey &&
    (!sessionKey || message.sessionKey === sessionKey)
  ) || null;
}

function buildCustomerSatisfaction({
  messages = [],
  feedbackRecords = [],
  actionQueue = null,
} = {}) {
  const records = Array.isArray(feedbackRecords) ? feedbackRecords : [];
  const helpful = records.filter((record) => cleanText(record.rating).toLowerCase() === "helpful");
  const notHelpful = records.filter((record) => cleanText(record.rating).toLowerCase() === "not_helpful");
  const unhappyAnswers = notHelpful.slice(0, 8).map((record) => {
    const assistantMessage = findAssistantMessageForFeedback(messages, record);
    const questionMessage = assistantMessage
      ? findPreviousUserMessage(messages, assistantMessage)
      : null;

    return {
      feedbackId: cleanText(record.id),
      sessionKey: cleanText(record.sessionKey || record.session_key),
      assistantMessageKey: cleanText(record.assistantMessageKey || record.assistant_message_key),
      question: cleanText(questionMessage?.content) || "Visitor marked an answer not helpful.",
      reply: cleanText(assistantMessage?.content),
      createdAt: record.createdAt || record.created_at || null,
      recommendedAction: questionMessage
        ? "Fix knowledge or reply to the customer before similar questions repeat."
        : "Open recent conversations and decide whether this needs a knowledge fix or customer reply.",
    };
  });
  const weakTopics = buildCustomerQuestionSummaries(
    unhappyAnswers
      .filter((item) => item.question && item.question !== "Visitor marked an answer not helpful.")
      .map((item) => ({
        role: "user",
        content: item.question,
        sessionKey: item.sessionKey,
        createdAt: item.createdAt,
      })),
    5
  );
  const queueItems = Array.isArray(actionQueue?.items) ? actionQueue.items : [];
  const openReplyCount = queueItems.filter((item) => {
    const workflow = item.ownerWorkflow || {};
    return workflow.attention === true || item.followUpNeeded === true || item.unresolved === true;
  }).length;
  const knowledgeFixCount = queueItems.filter((item) =>
    item.knowledgeFixSupported === true || item.actionType === "knowledge_gap" || item.actionType === "unanswered_question"
  ).length;
  const recoveryActions = [];

  if (notHelpful.length) {
    recoveryActions.push({
      type: knowledgeFixCount ? "fix_knowledge" : "review_unhappy_answers",
      label: knowledgeFixCount ? "Fix knowledge" : "Review unhappy answers",
      count: notHelpful.length,
      copy: knowledgeFixCount
        ? "Negative reply feedback lines up with knowledge-fix work in the queue."
        : "Visitors marked answers not helpful; review the related questions before the pattern repeats.",
    });
  }

  if (openReplyCount) {
    recoveryActions.push({
      type: "reply_to_customer",
      label: "Reply to customer",
      count: openReplyCount,
      copy: "Open queue items still need an owner decision, reply, or dismissal.",
    });
  }

  return {
    totalFeedback: records.length,
    helpful: helpful.length,
    notHelpful: notHelpful.length,
    negativeRate: records.length
      ? Number(((notHelpful.length / records.length) * 100).toFixed(1))
      : 0,
    unhappyAnswers,
    weakTopics,
    recoveryActions: recoveryActions.slice(0, 3),
    persistenceAvailable: true,
  };
}

function buildOwnerNotifications(customerSatisfaction = {}, actionQueue = null) {
  const notifications = [];
  const queueItems = Array.isArray(actionQueue?.items) ? actionQueue.items : [];
  const highIntentLeads = queueItems.filter((item) =>
    ["lead_follow_up", "pricing_interest", "booking_intent", "repeat_high_intent_visitor"].includes(cleanText(item.actionType))
    && (item.priority === "high" || item.contactCaptured === true)
    && item.status !== "done"
    && item.status !== "dismissed"
  );
  const unansweredQuestions = queueItems.filter((item) =>
    item.actionType === "unanswered_question" && item.status !== "done" && item.status !== "dismissed"
  );

  if (customerSatisfaction.notHelpful > 0) {
    notifications.push({
      type: "unhappy_customers",
      tone: "risk",
      title: "Unhappy answer feedback",
      copy: `${customerSatisfaction.notHelpful} answer${customerSatisfaction.notHelpful === 1 ? "" : "s"} marked not helpful need review.`,
    });
  }

  if (highIntentLeads.length) {
    notifications.push({
      type: "high_intent_leads",
      tone: "opportunity",
      title: "High-intent leads",
      copy: `${highIntentLeads.length} warm lead${highIntentLeads.length === 1 ? "" : "s"} should be followed up or closed out.`,
    });
  }

  if (unansweredQuestions.length) {
    notifications.push({
      type: "unanswered_questions",
      tone: "attention",
      title: "Unanswered questions",
      copy: `${unansweredQuestions.length} unanswered question${unansweredQuestions.length === 1 ? "" : "s"} can become knowledge improvements.`,
    });
  }

  return notifications.slice(0, 5);
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
  feedback = null,
} = {}) {
  const normalizedMessages = messages.map((message) => normalizeMessage(message));
  const userMessages = normalizedMessages.filter((message) => message.role === "user");
  const sessions = listSessions(normalizedMessages);
  const fallbackActionQueue = actionQueue || buildActionQueue(normalizedMessages, []);
  const feedbackRecords = Array.isArray(feedback?.records) ? feedback.records : [];
  const customerSatisfaction = buildCustomerSatisfaction({
    messages: normalizedMessages,
    feedbackRecords,
    actionQueue: fallbackActionQueue,
  });
  customerSatisfaction.persistenceAvailable = feedback?.persistenceAvailable !== false;
  const notifications = buildOwnerNotifications(customerSatisfaction, fallbackActionQueue);
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
    customerSatisfaction,
    notifications,
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
