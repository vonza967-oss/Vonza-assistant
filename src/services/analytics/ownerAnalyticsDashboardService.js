import { buildActionQueue } from "./actionQueueService.js";
import { buildCustomerQuestionSummaries } from "./analyticsSummaryService.js";
import { createEmptyWebCallHealthSummary } from "./productEventService.js";
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
    ownerUserId: cleanText(message.ownerUserId || message.owner_user_id),
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

  if (normalized === "widget" || normalized === "page" || normalized === "web_call") {
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
    widget: createEmptyAssistantSourceBucket("widget", "Website Agent"),
    page: createEmptyAssistantSourceBucket("page", "Front Desk page"),
    web_call: createEmptyAssistantSourceBucket("web_call", "Web Call"),
    unknown: createEmptyAssistantSourceBucket("unknown", "Legacy/unknown"),
  };
  const sessionsBySource = {
    widget: new Set(),
    page: new Set(),
    web_call: new Set(),
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
    web_call: buckets.web_call,
    unknown: buckets.unknown,
    totalConversations:
      buckets.widget.conversationCount +
      buckets.page.conversationCount +
      buckets.web_call.conversationCount +
      buckets.unknown.conversationCount,
    totalMessages:
      buckets.widget.messageCount +
      buckets.page.messageCount +
      buckets.web_call.messageCount +
      buckets.unknown.messageCount,
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

function isSafeWebCallCategory(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return Boolean(normalized) && normalized.length <= 64 && /^[a-z0-9_]+$/.test(normalized);
}

function formatWebCallCategoryLabel(category = "") {
  return cleanText(category)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeWebCallHealthSummary(webCallHealth = null) {
  const source = webCallHealth && typeof webCallHealth === "object" ? webCallHealth : {};
  const empty = createEmptyWebCallHealthSummary();
  const failureCounts = source.failureCounts && typeof source.failureCounts === "object" && !Array.isArray(source.failureCounts)
    ? Object.fromEntries(
        Object.entries(source.failureCounts)
          .map(([category, count]) => [cleanText(category).toLowerCase(), Math.max(0, Number(count || 0))])
          .filter(([category, count]) => isSafeWebCallCategory(category) && count > 0)
      )
    : {};

  return {
    ...empty,
    available: source.available !== false,
    starts: Math.max(0, Number(source.starts || 0)),
    endedCalls: Math.max(0, Number(source.endedCalls || 0)),
    averageDurationSeconds: Math.max(0, Number(source.averageDurationSeconds || 0)),
    averageTurns: Math.max(0, Number(source.averageTurns || 0)),
    contactFallbackSubmissions: Math.max(0, Number(source.contactFallbackSubmissions || 0)),
    failureCounts,
    failureCategories: Array.isArray(source.failureCategories)
      ? source.failureCategories.map((item) => ({
          category: cleanText(item.category).toLowerCase(),
          label: formatWebCallCategoryLabel(item.category),
          count: Math.max(0, Number(item.count || 0)),
        })).filter((item) => isSafeWebCallCategory(item.category) && item.count > 0)
      : [],
    failureTotal: Math.max(0, Number(source.failureTotal || Object.values(failureCounts).reduce((sum, count) => sum + Number(count || 0), 0))),
    latestActivityAt: source.latestActivityAt || null,
  };
}

function getLeadMetadata(lead = {}) {
  return lead.captureMetadata && typeof lead.captureMetadata === "object" && !Array.isArray(lead.captureMetadata)
    ? lead.captureMetadata
    : lead.capture_metadata && typeof lead.capture_metadata === "object" && !Array.isArray(lead.capture_metadata)
      ? lead.capture_metadata
      : {};
}

function leadBelongsToOwner(lead = {}, ownerUserId = "") {
  const leadOwnerUserId = cleanText(lead.ownerUserId || lead.owner_user_id);
  return !ownerUserId || !leadOwnerUserId || leadOwnerUserId === ownerUserId;
}

function rowBelongsToOwner(row = {}, ownerUserId = "") {
  const rowOwnerUserId = cleanText(row.ownerUserId || row.owner_user_id);
  return !ownerUserId || !rowOwnerUserId || rowOwnerUserId === ownerUserId;
}

function isWebCallLeadCapture(lead = {}) {
  const metadata = getLeadMetadata(lead);
  const captureSource = cleanText(lead.captureSource || lead.capture_source).toLowerCase();
  const conversationSource = cleanText(metadata.conversationSource || metadata.conversation_source).toLowerCase();
  return captureSource === "web_call" || conversationSource === "web_call";
}

function isCapturedLead(lead = {}) {
  const state = cleanText(lead.captureState || lead.capture_state).toLowerCase();
  const email = cleanText(lead.contactEmail || lead.contact_email);
  const phone = cleanText(lead.contactPhone || lead.contact_phone);
  return state === "captured" || Boolean(email || phone);
}

function readSafeTelemetryNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function getWebCallEventId(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {};
  return cleanText(metadata.web_call_id || metadata.webCallId) || cleanText(row.id);
}

function isRecentWebCallFailureEvent(eventName = "") {
  return [
    "web_call_mic_denied",
    "web_call_transcript_rejected",
    "web_call_speech_failed",
    "web_call_failed_recovery_shown",
  ].includes(cleanText(eventName));
}

function getRecentWebCallFailureCategory(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {};
  const eventName = cleanText(row.event_name || row.eventName);
  const category = cleanText(metadata.failure_category).toLowerCase().replace(/[\s-]+/g, "_");

  if (isSafeWebCallCategory(category)) {
    return category;
  }

  if (eventName === "web_call_mic_denied") {
    return "mic_denied";
  }

  if (eventName === "web_call_transcript_rejected") {
    return "transcript_rejected";
  }

  if (eventName === "web_call_speech_failed") {
    return "speech_failed";
  }

  return "unknown";
}

function createRecentWebCallFromSession(sessionKey = "") {
  return {
    id: sessionKey ? `session:${sessionKey}` : "",
    webCallId: "",
    sessionKey,
    latestMessageId: "",
    contactId: "",
    startedAt: null,
    latestActivityAt: null,
    durationSeconds: null,
    turnCount: null,
    contactFallbackOpened: false,
    contactFallbackSubmitted: false,
    hadFailures: false,
    failureCategories: [],
    messages: [],
    conversationSource: "web_call",
  };
}

function buildWebCallMessageSessions(messages = [], ownerUserId = "") {
  const sessions = new Map();

  messages
    .filter((message) => message.displayMode === "web_call" && rowBelongsToOwner(message, ownerUserId))
    .forEach((message) => {
      const sessionKey = message.sessionKey || (message.id ? `message:${message.id}` : "");

      if (!sessionKey) {
        return;
      }

      if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, createRecentWebCallFromSession(sessionKey));
      }

      const session = sessions.get(sessionKey);
      const timestamp = getTimestamp(message.createdAt);

      if (!session.startedAt || timestamp < getTimestamp(session.startedAt)) {
        session.startedAt = message.createdAt || null;
      }

      if (!session.latestActivityAt || timestamp >= getTimestamp(session.latestActivityAt)) {
        session.latestActivityAt = message.createdAt || null;
        session.latestMessageId = message.id || session.latestMessageId;
      }

      if (message.role === "user") {
        session.turnCount = Number(session.turnCount || 0) + 1;
      }

      session.messages.push({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
        createdAt: message.createdAt || null,
      });
    });

  sessions.forEach((session) => {
    session.messages = session.messages
      .filter((message) => message.content)
      .sort((left, right) => getTimestamp(left.createdAt) - getTimestamp(right.createdAt))
      .slice(-16);
  });

  return sessions;
}

function findMatchingWebCallSession(call = {}, sessions = new Map(), usedSessions = new Set()) {
  const startedAt = getTimestamp(call.startedAt || call.latestActivityAt);
  const latestAt = getTimestamp(call.latestActivityAt || call.startedAt);
  let best = null;

  sessions.forEach((session, key) => {
    if (usedSessions.has(key)) {
      return;
    }

    const sessionStartedAt = getTimestamp(session.startedAt);
    const sessionLatestAt = getTimestamp(session.latestActivityAt);

    if (!sessionStartedAt && !sessionLatestAt) {
      return;
    }

    const overlaps = (
      startedAt &&
      sessionLatestAt >= startedAt - 2 * 60 * 1000 &&
      sessionStartedAt <= Math.max(latestAt, startedAt) + 10 * 60 * 1000
    );
    const distance = Math.min(
      Math.abs((sessionStartedAt || sessionLatestAt) - (startedAt || latestAt)),
      Math.abs((sessionLatestAt || sessionStartedAt) - (latestAt || startedAt))
    );

    if (!overlaps && distance > 10 * 60 * 1000) {
      return;
    }

    if (!best || distance < best.distance) {
      best = { key, session, distance };
    }
  });

  return best;
}

function buildWebCallReviewActionKey(call = {}) {
  const keySource = cleanText(call.webCallId || call.sessionKey || call.latestMessageId || call.contactId || call.id);
  return keySource ? `web_call_review:${keySource}` : "";
}

function findLatestWebCallPracticePair(messages = []) {
  const ordered = (Array.isArray(messages) ? messages : [])
    .filter((message) => message.content)
    .sort((left, right) => getTimestamp(left.createdAt) - getTimestamp(right.createdAt));
  const latestAssistantIndex = [...ordered].reverse().findIndex((message) => message.role === "assistant");

  if (latestAssistantIndex >= 0) {
    const assistantIndex = ordered.length - 1 - latestAssistantIndex;
    const answer = ordered[assistantIndex];
    const question = [...ordered.slice(0, assistantIndex)]
      .reverse()
      .find((message) => message.role === "user");
    return {
      question: question?.content || "",
      answer: answer.content || "",
      messageId: answer.id || "",
      sessionKey: cleanText(callSessionKeyFromMessages(ordered)),
    };
  }

  const question = [...ordered].reverse().find((message) => message.role === "user");
  return {
    question: question?.content || "",
    answer: "",
    messageId: "",
    sessionKey: cleanText(callSessionKeyFromMessages(ordered)),
  };
}

function callSessionKeyFromMessages(messages = []) {
  return messages.find((message) => cleanText(message.sessionKey))?.sessionKey || "";
}

function normalizeRecentWebCall(call = {}, reviewStatusByActionKey = new Map()) {
  const failureCategories = Array.isArray(call.failureCategories)
    ? call.failureCategories
        .map((category) => cleanText(category).toLowerCase())
        .filter((category) => isSafeWebCallCategory(category))
    : [];
  const durationSeconds = call.durationSeconds === null || call.durationSeconds === undefined
    ? null
    : readSafeTelemetryNumber(call.durationSeconds);
  const turnCount = call.turnCount === null || call.turnCount === undefined
    ? null
    : readSafeTelemetryNumber(call.turnCount);
  const messages = Array.isArray(call.messages)
    ? call.messages
        .map((message) => ({
          id: cleanText(message.id),
          role: cleanText(message.role).toLowerCase() === "assistant" ? "assistant" : "user",
          content: cleanText(message.content),
          createdAt: message.createdAt || null,
        }))
        .filter((message) => message.content)
        .sort((left, right) => getTimestamp(left.createdAt) - getTimestamp(right.createdAt))
        .slice(-16)
    : [];
  const practicePair = findLatestWebCallPracticePair(messages);
  const actionKey = buildWebCallReviewActionKey(call);
  const reviewState = reviewStatusByActionKey.get(actionKey) || {};

  return {
    id: cleanText(call.id || call.webCallId || call.sessionKey),
    actionKey,
    webCallId: cleanText(call.webCallId),
    sessionKey: cleanText(call.sessionKey),
    latestMessageId: cleanText(call.latestMessageId),
    contactId: cleanText(call.contactId),
    startedAt: call.startedAt || null,
    latestActivityAt: call.latestActivityAt || call.startedAt || null,
    durationSeconds,
    turnCount,
    contactFallbackOpened: call.contactFallbackOpened === true,
    contactFallbackSubmitted: call.contactFallbackSubmitted === true,
    hadFailures: call.hadFailures === true || failureCategories.length > 0,
    failureCategories,
    failureCategoryLabels: failureCategories.map((category) => formatWebCallCategoryLabel(category)),
    messages,
    latestQuestion: cleanText(practicePair.question),
    latestAnswer: cleanText(practicePair.answer),
    latestAssistantMessageId: cleanText(practicePair.messageId),
    review: {
      status: cleanText(reviewState.status || "new") || "new",
      followUpNeeded: reviewState.followUpNeeded === true,
      followUpCompleted: reviewState.followUpCompleted === true,
      note: cleanText(reviewState.note),
      nextStep: cleanText(reviewState.nextStep || reviewState.next_step),
      updatedAt: reviewState.updatedAt || reviewState.updated_at || null,
    },
    conversationSource: "web_call",
    action: cleanText(call.contactId)
      ? {
          type: "customer",
          label: "Open customer",
          targetSection: "contacts",
          contactId: cleanText(call.contactId),
        }
      : cleanText(call.latestMessageId)
        ? {
            type: "conversation",
            label: "Open related conversation",
            messageId: cleanText(call.latestMessageId),
          }
        : null,
  };
}

function buildRecentWebCalls({
  messages = [],
  leadCaptures = {},
  webCallEvents = [],
  actionStatuses = [],
  ownerUserId = "",
  limit = 8,
} = {}) {
  const ownerScopedEvents = (Array.isArray(webCallEvents) ? webCallEvents : [])
    .filter((row) => rowBelongsToOwner(row, ownerUserId));
  const ownerScopedLeads = (Array.isArray(leadCaptures.records) ? leadCaptures.records : [])
    .filter((lead) => leadBelongsToOwner(lead, ownerUserId) && isWebCallLeadCapture(lead));
  const reviewStatusByActionKey = new Map();
  const statusRecords = Array.isArray(actionStatuses)
    ? actionStatuses
    : Array.isArray(actionStatuses?.records)
      ? actionStatuses.records
      : [];
  statusRecords.forEach((status) => {
    const actionKey = cleanText(status.actionKey || status.action_key);
    if (actionKey.startsWith("web_call_review:") && rowBelongsToOwner(status, ownerUserId)) {
      reviewStatusByActionKey.set(actionKey, status);
    }
  });
  const messageSessions = buildWebCallMessageSessions(messages, ownerUserId);
  const usedSessions = new Set();
  const callsById = new Map();

  ownerScopedEvents.forEach((row) => {
    const eventName = cleanText(row.event_name || row.eventName);
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
    const webCallId = getWebCallEventId(row);

    if (!webCallId || !eventName.startsWith("web_call_")) {
      return;
    }

    if (!callsById.has(webCallId)) {
      callsById.set(webCallId, {
        ...createRecentWebCallFromSession(""),
        id: webCallId,
        webCallId,
      });
    }

    const call = callsById.get(webCallId);
    const createdAt = row.created_at || row.createdAt || null;

    if (eventName === "web_call_started" && (!call.startedAt || getTimestamp(createdAt) < getTimestamp(call.startedAt))) {
      call.startedAt = createdAt;
    }

    if (!call.latestActivityAt || getTimestamp(createdAt) > getTimestamp(call.latestActivityAt)) {
      call.latestActivityAt = createdAt;
    }

    if (eventName === "web_call_ended" && metadata.duration_seconds !== undefined) {
      call.durationSeconds = readSafeTelemetryNumber(metadata.duration_seconds);
    }

    if (eventName === "web_call_ended" && metadata.turn_count !== undefined) {
      call.turnCount = readSafeTelemetryNumber(metadata.turn_count);
    } else if (metadata.turn_count !== undefined) {
      call.turnCount = Math.max(readSafeTelemetryNumber(metadata.turn_count), readSafeTelemetryNumber(call.turnCount));
    }

    if (metadata.duration_seconds !== undefined) {
      call.durationSeconds = Math.max(readSafeTelemetryNumber(metadata.duration_seconds), readSafeTelemetryNumber(call.durationSeconds));
    }

    if (eventName === "web_call_contact_opened") {
      call.contactFallbackOpened = true;
    }

    if (eventName === "web_call_contact_submitted") {
      call.contactFallbackOpened = true;
      call.contactFallbackSubmitted = true;
    }

    if (isRecentWebCallFailureEvent(eventName)) {
      call.hadFailures = true;
      call.failureCategories = Array.from(new Set([
        ...(call.failureCategories || []),
        getRecentWebCallFailureCategory(row),
      ]));
    }
  });

  callsById.forEach((call) => {
    const match = findMatchingWebCallSession(call, messageSessions, usedSessions);

    if (!match) {
      return;
    }

    usedSessions.add(match.key);
    call.sessionKey = match.session.sessionKey;
    call.latestMessageId = match.session.latestMessageId;
    call.messages = match.session.messages;
    call.startedAt = call.startedAt || match.session.startedAt;
    call.latestActivityAt = getTimestamp(match.session.latestActivityAt) > getTimestamp(call.latestActivityAt)
      ? match.session.latestActivityAt
      : call.latestActivityAt;
    call.turnCount = call.turnCount === null || call.turnCount === undefined || Number(call.turnCount) === 0
      ? match.session.turnCount
      : call.turnCount;
  });

  messageSessions.forEach((session, key) => {
    if (!usedSessions.has(key)) {
      callsById.set(session.id || key, session);
    }
  });

  ownerScopedLeads.forEach((lead) => {
    const sessionKey = cleanText(lead.visitorSessionKey || lead.visitor_session_key);
    const contactId = cleanText(lead.contactId || lead.contact_id);
    const matchingCall = [...callsById.values()].find((call) => sessionKey && call.sessionKey === sessionKey);

    if (matchingCall) {
      matchingCall.contactFallbackOpened = true;
      matchingCall.contactFallbackSubmitted = matchingCall.contactFallbackSubmitted || isCapturedLead(lead);
      matchingCall.contactId = matchingCall.contactId || contactId;
      return;
    }

    if (!sessionKey) {
      return;
    }

    callsById.set(`lead:${sessionKey}`, {
      ...createRecentWebCallFromSession(sessionKey),
      id: `lead:${sessionKey}`,
      contactId,
      latestActivityAt: lead.lastSeenAt || lead.last_seen_at || lead.capturedAt || lead.captured_at || lead.createdAt || lead.created_at || null,
      contactFallbackOpened: true,
      contactFallbackSubmitted: isCapturedLead(lead),
    });
  });

  const calls = [...callsById.values()]
    .map((call) => normalizeRecentWebCall(call, reviewStatusByActionKey))
    .filter((call) => call.latestActivityAt || call.startedAt)
    .sort((left, right) => getTimestamp(right.latestActivityAt || right.startedAt) - getTimestamp(left.latestActivityAt || left.startedAt))
    .slice(0, Math.min(Math.max(Number(limit || 8), 1), 20));

  return {
    available: true,
    total: calls.length,
    calls,
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
  actionStatuses = [],
  feedback = null,
  webCallHealth = null,
  webCallEvents = [],
  ownerUserId: explicitOwnerUserId = "",
} = {}) {
  const normalizedMessages = messages.map((message) => normalizeMessage(message));
  const ownerUserId = cleanText(explicitOwnerUserId || agent.ownerUserId || agent.owner_user_id);
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
    webCallHealth: normalizeWebCallHealthSummary(webCallHealth),
    webCallRecentCalls: buildRecentWebCalls({
      messages: normalizedMessages,
      leadCaptures,
      webCallEvents,
      actionStatuses,
      ownerUserId,
    }),
  };
}
