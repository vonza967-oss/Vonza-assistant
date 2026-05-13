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
    displayMode: normalizeAssistantSource(message.displayMode || message.display_mode),
    createdAt: message.createdAt || message.created_at || null,
  };
}

function normalizeAssistantSource(value) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized === "widget" || normalized === "page") {
    return normalized;
  }

  return "unknown";
}

function createEmptyAssistantSourceBucket(key, label) {
  return {
    key,
    label,
    conversationCount: 0,
    messageCount: 0,
    visitorQuestionCount: 0,
    leadsCaptured: 0,
  };
}

function buildAssistantSourceBreakdown(messages = [], leadCaptures = {}) {
  const buckets = {
    widget: createEmptyAssistantSourceBucket("widget", "Website widget"),
    page: createEmptyAssistantSourceBucket("page", "Full-page assistant"),
    unknown: createEmptyAssistantSourceBucket("unknown", "Legacy/unknown"),
  };
  const sessionsBySource = {
    widget: new Set(),
    page: new Set(),
    unknown: new Set(),
  };
  const sourceBySession = new Map();

  messages.forEach((message) => {
    const source = normalizeAssistantSource(message.displayMode);
    const bucket = buckets[source] || buckets.unknown;
    bucket.messageCount += 1;

    if (message.role === "user") {
      bucket.visitorQuestionCount += 1;
    }

    if (message.sessionKey) {
      sessionsBySource[bucket.key].add(message.sessionKey);
      if (!sourceBySession.has(message.sessionKey) || sourceBySession.get(message.sessionKey) === "unknown") {
        sourceBySession.set(message.sessionKey, bucket.key);
      }
    }
  });

  Object.entries(sessionsBySource).forEach(([source, sessions]) => {
    buckets[source].conversationCount = sessions.size;
  });

  const records = Array.isArray(leadCaptures.records) ? leadCaptures.records : [];
  records.forEach((record) => {
    const state = cleanText(record.captureState || record.capture_state).toLowerCase();
    const email = cleanText(record.contactEmail || record.contact_email);
    const phone = cleanText(record.contactPhone || record.contact_phone);

    if (state !== "captured" && !email && !phone) {
      return;
    }

    const sessionKey = cleanText(record.visitorSessionKey || record.visitor_session_key || record.sessionKey || record.session_key);
    const source = normalizeAssistantSource(record.displayMode || record.display_mode || sourceBySession.get(sessionKey));
    const bucket = buckets[source] || buckets.unknown;
    bucket.leadsCaptured += 1;
  });

  return {
    widget: buckets.widget,
    page: buckets.page,
    unknown: buckets.unknown,
    totalConversations: buckets.widget.conversationCount + buckets.page.conversationCount + buckets.unknown.conversationCount,
    totalMessages: buckets.widget.messageCount + buckets.page.messageCount + buckets.unknown.messageCount,
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

function mapKnowledgeFixStatus(value) {
  const normalized = cleanText(value).toLowerCase();

  switch (normalized) {
    case "draft":
      return "new";
    case "ready":
    case "failed":
      return "reviewing";
    case "applied":
      return "approved_fixed";
    case "dismissed":
      return "dismissed";
    default:
      return "new";
  }
}

function buildKnowledgeImprovementItemFromQueue(item = {}) {
  const knowledgeFix = item.knowledgeFix && typeof item.knowledgeFix === "object"
    ? item.knowledgeFix
    : null;
  const evidence = knowledgeFix?.evidence && typeof knowledgeFix.evidence === "object"
    ? knowledgeFix.evidence
    : {};
  const actionType = cleanText(item.actionType || item.type).toLowerCase();

  if (!knowledgeFix && !["knowledge_gap", "unanswered_question", "weak_answer"].includes(actionType)) {
    return null;
  }

  const question = cleanText(evidence.question || item.question || item.snippet);
  const currentResponse = cleanText(evidence.currentResponse || item.reply);
  const issueSummary = cleanText(knowledgeFix?.issueSummary || item.whyFlagged);
  const proposedGuidance = cleanText(knowledgeFix?.proposedGuidance || item.suggestedAction);

  return {
    id: cleanText(knowledgeFix?.id || item.key),
    actionKey: cleanText(item.key),
    knowledgeFixId: cleanText(knowledgeFix?.id),
    source: knowledgeFix ? "knowledge_fix_workflow" : "action_queue",
    status: mapKnowledgeFixStatus(knowledgeFix?.status || item.status),
    workflowStatus: cleanText(knowledgeFix?.status || item.status),
    question: question || "A weak or unanswered customer question needs review.",
    safeSummary: question || cleanText(item.label) || "Customer question summary is not available yet.",
    reason: issueSummary || "Vonza surfaced this because the answer looked weak, repeated, or unresolved.",
    currentGap: currentResponse || cleanText(knowledgeFix?.evidence?.conversationExcerpt) || "No current answer was captured for this item.",
    suggestedFix: proposedGuidance || "Review the conversation and add grounded guidance from verified business knowledge.",
    occurrenceCount: Math.max(Number(knowledgeFix?.occurrenceCount || item.count || 1), 1),
    targetLabel: cleanText(knowledgeFix?.targetLabel) || "Advanced guidance / system prompt",
    lastSeenAt: item.lastSeenAt || evidence.lastSeenAt || null,
  };
}

function buildKnowledgeImprovementItemFromFeedback(item = {}) {
  const question = cleanText(item.question);

  return {
    id: cleanText(item.feedbackId || `${item.sessionKey}:${item.assistantMessageKey}`),
    actionKey: "",
    knowledgeFixId: "",
    source: "visitor_feedback",
    status: "new",
    workflowStatus: "feedback",
    question: question || "Visitor marked an answer not helpful.",
    safeSummary: question || "Visitor marked an answer not helpful.",
    reason: "A visitor explicitly marked this answer not helpful.",
    currentGap: cleanText(item.reply) || "The exact assistant answer was not available in stored messages.",
    suggestedFix: cleanText(item.recommendedAction) || "Review the answer and decide whether it needs a grounded knowledge fix.",
    occurrenceCount: 1,
    targetLabel: "Owner review",
    lastSeenAt: item.createdAt || null,
  };
}

function buildKnowledgeImprovementCenter({ customerSatisfaction = {}, actionQueue = null } = {}) {
  const queueItems = Array.isArray(actionQueue?.items) ? actionQueue.items : [];
  const fromQueue = queueItems
    .map((item) => buildKnowledgeImprovementItemFromQueue(item))
    .filter(Boolean);
  const seenKeys = new Set(
    fromQueue.flatMap((item) => [
      item.actionKey,
      item.question.toLowerCase(),
      item.knowledgeFixId,
    ].filter(Boolean))
  );
  const fromFeedback = (Array.isArray(customerSatisfaction.unhappyAnswers) ? customerSatisfaction.unhappyAnswers : [])
    .map((item) => buildKnowledgeImprovementItemFromFeedback(item))
    .filter((item) => {
      const questionKey = item.question.toLowerCase();
      return !seenKeys.has(questionKey);
    });
  const items = [...fromQueue, ...fromFeedback]
    .sort((left, right) => {
      const statusRank = {
        reviewing: 0,
        new: 1,
        approved_fixed: 2,
        dismissed: 3,
      };
      return (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
    })
    .slice(0, 12);

  return {
    title: "Knowledge Improvement",
    copy: items.length
      ? "Weak, repeated, and not-helpful answers are ready for owner review and grounded guidance."
      : "No weak-answer pattern is active yet. Once visitors mark answers not helpful or Vonza detects unanswered questions, the improvement queue will appear here.",
    total: items.length,
    openCount: items.filter((item) => ["new", "reviewing"].includes(item.status)).length,
    approvedFixedCount: items.filter((item) => item.status === "approved_fixed").length,
    dismissedCount: items.filter((item) => item.status === "dismissed").length,
    guardrail:
      "Approved guidance is added as scoped assistant guidance. It must not override safety rules, contact verification, or the rule to avoid inventing business facts.",
    items,
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
  const knowledgeImprovement = buildKnowledgeImprovementCenter({
    customerSatisfaction,
    actionQueue: fallbackActionQueue,
  });
  const notifications = buildOwnerNotifications(customerSatisfaction, fallbackActionQueue);
  const capturedLeads = countCapturedLeads(leadCaptures);
  const assistantSource = buildAssistantSourceBreakdown(normalizedMessages, leadCaptures);
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
    assistantSource,
    topVisitorQuestions: buildCustomerQuestionSummaries(normalizedMessages, 8),
    missedQuestions: findMissedQuestions(normalizedMessages),
    customerSatisfaction,
    knowledgeImprovement,
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
