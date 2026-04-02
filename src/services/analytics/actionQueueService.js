import { ACTION_QUEUE_STATUS_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const ACTION_QUEUE_STATUSES = ["new", "reviewed", "done", "dismissed"];
const CONTACT_STATUSES = ["not_contacted", "attempted", "contacted", "qualified"];
const ACTIONABLE_INTENTS = ["contact", "booking", "pricing", "support"];
const ACTION_QUEUE_ITEM_TYPES = [
  "lead_follow_up",
  "pricing_interest",
  "booking_intent",
  "unanswered_question",
  "knowledge_gap",
  "repeat_high_intent_visitor",
];
const ACTION_QUEUE_PRIORITIES = ["high", "medium", "low"];
const HIGH_INTENT_ACTION_TYPES = new Set([
  "lead_follow_up",
  "pricing_interest",
  "booking_intent",
  "repeat_high_intent_visitor",
]);
const ACTION_QUEUE_STATUS_TRANSITIONS = {
  new: new Set(["new", "reviewed", "done", "dismissed"]),
  reviewed: new Set(["new", "reviewed", "done", "dismissed"]),
  done: new Set(["new", "reviewed", "done"]),
  dismissed: new Set(["new", "reviewed", "dismissed"]),
};
const ACTION_QUEUE_PERSISTENCE_COLUMNS = [
  "note",
  "outcome",
  "next_step",
  "follow_up_needed",
  "follow_up_completed",
  "contact_status",
];

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.toLowerCase().includes(`'public.${relationName}'`) ||
    message.toLowerCase().includes(`${relationName} was not found`)
  );
}

function normalizeStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  return ACTION_QUEUE_STATUSES.includes(normalized) ? normalized : "new";
}

function normalizeActionType(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!ACTION_QUEUE_ITEM_TYPES.includes(normalized)) {
    throw buildActionQueueError(
      `Unsupported action queue item type: ${value || "unknown"}.`,
      500,
      "ACTION_QUEUE_INVALID_TYPE"
    );
  }

  return normalized;
}

function normalizeActionPriority(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!ACTION_QUEUE_PRIORITIES.includes(normalized)) {
    throw buildActionQueueError(
      `Unsupported action queue priority: ${value || "unknown"}.`,
      500,
      "ACTION_QUEUE_INVALID_PRIORITY"
    );
  }

  return normalized;
}

function getPriorityRank(value) {
  switch (normalizeActionPriority(value)) {
    case "high":
      return 0;
    case "medium":
      return 1;
    default:
      return 2;
  }
}

function buildActionQueueError(message, statusCode = 500, code = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function buildPersistenceUnavailableError() {
  return buildActionQueueError(
    "Action queue persistence is not ready on the server yet. Apply the action queue migration and try again.",
    503,
    "ACTION_QUEUE_PERSISTENCE_UNAVAILABLE"
  );
}

function isMissingPersistenceColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    ACTION_QUEUE_PERSISTENCE_COLUMNS.some((columnName) => message.includes(columnName))
  );
}

function isUnavailablePersistenceError(error) {
  return isMissingRelationError(error, ACTION_QUEUE_STATUS_TABLE) || isMissingPersistenceColumnError(error);
}

function normalizeBooleanFlag(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = cleanText(value).toLowerCase();

  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeContactStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  return CONTACT_STATUSES.includes(normalized) ? normalized : "";
}

function parseRequestedStatus(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!ACTION_QUEUE_STATUSES.includes(normalized)) {
    throw buildActionQueueError(
      "Use one of the supported action queue statuses: new, reviewed, done, or dismissed.",
      400,
      "ACTION_QUEUE_INVALID_STATUS"
    );
  }

  return normalized;
}

function parseRequestedContactStatus(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!CONTACT_STATUSES.includes(normalized)) {
    throw buildActionQueueError(
      "Use one of the supported contact states: not_contacted, attempted, contacted, or qualified.",
      400,
      "ACTION_QUEUE_INVALID_CONTACT_STATUS"
    );
  }

  return normalized;
}

function assertValidStatusTransition(previousStatus, nextStatus) {
  const current = normalizeStatus(previousStatus);
  const allowedTransitions = ACTION_QUEUE_STATUS_TRANSITIONS[current] || ACTION_QUEUE_STATUS_TRANSITIONS.new;

  if (allowedTransitions.has(nextStatus)) {
    return;
  }

  throw buildActionQueueError(
    `Cannot move an action queue item directly from ${current} to ${nextStatus}. Reopen it first if more work is needed.`,
    400,
    "ACTION_QUEUE_INVALID_TRANSITION"
  );
}

function validateStateShape({ status, followUpNeeded, followUpCompleted }) {
  if (followUpNeeded === true && followUpCompleted === true) {
    throw buildActionQueueError(
      "Follow-up cannot be both needed and completed at the same time.",
      400,
      "ACTION_QUEUE_CONFLICTING_FOLLOW_UP"
    );
  }

  if (status === "dismissed" && followUpCompleted === true) {
    throw buildActionQueueError(
      "Dismissed items cannot also be marked follow-up completed.",
      400,
      "ACTION_QUEUE_DISMISSED_CONFLICT"
    );
  }

  if (status === "done" && followUpNeeded === true) {
    throw buildActionQueueError(
      "Resolved items cannot still be marked as needing follow-up.",
      400,
      "ACTION_QUEUE_DONE_CONFLICT"
    );
  }
}

function normalizePersistedItem(item = {}) {
  return {
    agentId: cleanText(item.agentId || item.agent_id),
    ownerUserId: cleanText(item.ownerUserId || item.owner_user_id),
    actionKey: cleanText(item.actionKey || item.action_key),
    status: normalizeStatus(item.status),
    note: cleanText(item.note),
    outcome: cleanText(item.outcome),
    nextStep: cleanText(item.nextStep || item.next_step),
    followUpNeeded: normalizeBooleanFlag(item.followUpNeeded ?? item.follow_up_needed),
    followUpCompleted: normalizeBooleanFlag(item.followUpCompleted ?? item.follow_up_completed),
    contactStatus: normalizeContactStatus(item.contactStatus || item.contact_status),
    updatedAt: item.updatedAt || item.updated_at || null,
  };
}

function hasOwnerHandoffContent(item = {}) {
  return Boolean(
    cleanText(item.note)
    || cleanText(item.outcome)
    || cleanText(item.nextStep || item.next_step)
    || normalizeBooleanFlag(item.followUpNeeded ?? item.follow_up_needed) !== null
    || normalizeBooleanFlag(item.followUpCompleted ?? item.follow_up_completed) !== null
    || normalizeContactStatus(item.contactStatus || item.contact_status)
  );
}

function isFollowUpNeeded(item = {}) {
  if (item.followUpCompleted === true || normalizeStatus(item.status) === "done" || normalizeStatus(item.status) === "dismissed") {
    return false;
  }

  if (item.followUpNeeded === true || item.followUpNeeded === false) {
    return item.followUpNeeded;
  }

  return normalizeStatus(item.status) !== "dismissed";
}

function isResolved(item = {}) {
  return item.followUpCompleted === true || normalizeStatus(item.status) === "done";
}

function buildOwnerWorkflow(item = {}) {
  const status = normalizeStatus(item.status);
  const followUpNeeded = isFollowUpNeeded(item);
  const resolved = isResolved(item);
  const handoffStarted = hasOwnerHandoffContent(item);

  if (status === "dismissed") {
    return {
      key: "dismissed",
      label: "Dismissed",
      copy: "This item was intentionally dismissed from the lightweight owner follow-up flow.",
      attention: false,
      resolved: false,
      rank: 5,
    };
  }

  if (resolved) {
    return {
      key: "resolved",
      label: "Resolved",
      copy: cleanText(item.outcome)
        ? "A resolution is recorded and this queue item no longer needs active follow-up."
        : "This queue item is marked complete and no longer needs active follow-up.",
      attention: false,
      resolved: true,
      rank: 4,
    };
  }

  if (followUpNeeded) {
    return {
      key: handoffStarted ? "follow_up_in_progress" : "follow_up_needed",
      label: handoffStarted ? "Follow-up in progress" : "Needs follow-up",
      copy: cleanText(item.nextStep)
        ? `Next step: ${cleanText(item.nextStep)}`
        : "The owner still needs to follow up on this conversation signal.",
      attention: true,
      resolved: false,
      rank: handoffStarted ? 1 : 0,
    };
  }

  if (status === "reviewed" || handoffStarted) {
    return {
      key: "reviewed_pending",
      label: "Reviewed",
      copy: cleanText(item.outcome)
        ? "Owner context is recorded, but the item is not marked resolved yet."
        : "The owner has started reviewing this item, but the final outcome is not recorded yet.",
      attention: true,
      resolved: false,
      rank: 2,
    };
  }

  return {
    key: "needs_review",
    label: "Needs owner review",
    copy: "This flagged conversation still needs an owner decision on what happened next.",
    attention: true,
    resolved: false,
    rank: 3,
  };
}

function normalizeQuestion(message) {
  return cleanText(String(message || ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildQuestionFingerprint(question) {
  return normalizeQuestion(question)
    .split(" ")
    .filter(Boolean)
    .slice(0, 8)
    .join("-");
}

function isUnknownPersonKey(value) {
  return cleanText(value).startsWith("person:unknown:");
}

function truncateText(value, maxLength = 180) {
  const normalized = cleanText(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getMessageTimestamp(message) {
  const value = new Date(message?.createdAt || message?.created_at || "").getTime();
  return Number.isFinite(value) ? value : 0;
}

function getChronologicalMessages(messages = []) {
  return [...messages].sort((left, right) => getMessageTimestamp(left) - getMessageTimestamp(right));
}

function buildConversationActionKey(message = {}, fallbackIndex = 0) {
  const messageId = cleanText(message.id || message.messageId);

  if (messageId) {
    return `conversation:${messageId}`;
  }

  const timestamp = cleanText(message.createdAt || message.created_at).replace(/[^0-9TZ]/gi, "");
  const questionSlug = normalizeQuestion(message.content || "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);

  return `conversation:${timestamp || `index-${fallbackIndex}`}:${questionSlug || "message"}`;
}

function categorizeIntent(message) {
  const normalized = cleanText(String(message || "")).toLowerCase();

  if (!normalized) {
    return "general";
  }

  if (
    normalized.includes("book")
    || normalized.includes("booking")
    || normalized.includes("appointment")
    || normalized.includes("schedule")
    || normalized.includes("availability")
    || normalized.includes("calendar")
    || normalized.includes("reserve")
    || normalized.includes("consultation")
    || normalized.includes("consult")
    || normalized.includes("meeting")
    || normalized.includes("demo")
  ) {
    return "booking";
  }

  if (
    normalized.includes("price")
    || normalized.includes("pricing")
    || normalized.includes("cost")
    || normalized.includes("quote")
    || normalized.includes("fee")
    || normalized.includes("buy")
    || normalized.includes("purchase")
    || normalized.includes("plan")
    || normalized.includes("package")
    || normalized.includes("how much")
  ) {
    return "pricing";
  }

  if (
    normalized.includes("problem")
    || normalized.includes("issue")
    || normalized.includes("broken")
    || normalized.includes("not working")
    || normalized.includes("complaint")
    || normalized.includes("refund")
    || normalized.includes("cancel")
    || normalized.includes("unhappy")
    || normalized.includes("support")
    || normalized.includes("frustrated")
    || normalized.includes("late")
  ) {
    return "support";
  }

  if (
    normalized.includes("contact")
    || normalized.includes("reach")
    || normalized.includes("call")
    || normalized.includes("email")
    || normalized.includes("phone")
    || normalized.includes("talk to")
    || normalized.includes("speak to")
    || normalized.includes("get in touch")
    || normalized.includes("someone")
  ) {
    return "contact";
  }

  if (
    normalized.includes("service")
    || normalized.includes("offer")
    || normalized.includes("product")
    || normalized.includes("help with")
    || normalized.includes("do you do")
    || normalized.includes("what do you do")
  ) {
    return "services";
  }

  return "general";
}

function getIntentLabel(intent) {
  switch (intent) {
    case "contact":
      return "Lead / contact";
    case "booking":
      return "Booking";
    case "pricing":
      return "Pricing / purchase";
    case "support":
      return "Support / complaint";
    default:
      return "General";
  }
}

function isHighIntentIntent(intent) {
  return ["contact", "booking", "pricing"].includes(intent);
}

function hasExplicitFollowUpRequest(message) {
  const normalized = cleanText(String(message || "")).toLowerCase();

  if (!normalized) {
    return false;
  }

  return [
    "call me",
    "call back",
    "email me",
    "reach me",
    "get back to me",
    "follow up",
    "contact me",
    "text me",
    "phone me",
  ].some((snippet) => normalized.includes(snippet));
}

function replySignalsKnowledgeGap(reply) {
  const normalized = cleanText(String(reply || "")).toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    "not available on the website",
    "not mentioned on the website",
    "not provided on the website",
    "i don't know",
    "i do not know",
    "i'm not sure",
    "i am not sure",
    "i couldn't find",
    "i could not find",
    "i can't find",
    "i cannot find",
  ].some((snippet) => normalized.includes(snippet));
}

function getSuggestedAction(intent) {
  switch (intent) {
    case "contact":
      return "Review whether the site and assistant make the contact path obvious enough, then follow up manually if contact details were captured.";
    case "booking":
      return "Clarify the booking path, availability, or consultation steps so the visitor can move forward faster.";
    case "pricing":
      return "Tighten pricing, package, or quote guidance so the assistant can answer with more confidence.";
    case "support":
      return "Review the issue, improve the weak answer path, and decide whether the business process or site copy needs a fix.";
    case "weak_answer":
      return "Improve website knowledge or assistant guidance so future visitors get a stronger answer.";
    default:
      return "Review the conversation pattern and decide whether the assistant or website needs a clearer next step.";
  }
}

function getFlaggedReason(intent, count) {
  const suffix = `${count} conversation${count === 1 ? "" : "s"}`;

  switch (intent) {
    case "contact":
      return `Flagged because ${suffix} showed direct lead or contact intent.`;
    case "booking":
      return `Flagged because ${suffix} asked about booking, scheduling, or availability.`;
    case "pricing":
      return `Flagged because ${suffix} asked about pricing, packages, or purchase intent.`;
    case "support":
      return `Flagged because ${suffix} looked like support, complaint, or problem-solving requests.`;
    case "weak_answer":
      return `Flagged because ${suffix} ended in weak or uncertain assistant answers.`;
    default:
      return `Flagged because ${suffix} showed a recurring pattern worth reviewing.`;
  }
}

function getConversationFlagReason(intent, options = {}) {
  const weakAnswer = options.weakAnswer === true;
  const unresolved = options.unresolved === true;
  const reasons = [];

  switch (intent) {
    case "contact":
      reasons.push("this visitor showed direct lead or contact intent");
      break;
    case "booking":
      reasons.push("this visitor asked about booking, scheduling, or availability");
      break;
    case "pricing":
      reasons.push("this visitor asked about pricing, packages, or purchase intent");
      break;
    case "support":
      reasons.push("this visitor sounded like support, complaint, or problem-resolution work");
      break;
    default:
      break;
  }

  if (unresolved) {
    reasons.push("the conversation did not receive a clear assistant answer yet");
  } else if (weakAnswer) {
    reasons.push("the assistant answer looked weak or uncertain");
  }

  if (!reasons.length) {
    return "Flagged because this conversation needs owner review.";
  }

  if (reasons.length === 1) {
    return `Flagged because ${reasons[0]}.`;
  }

  return `Flagged because ${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}.`;
}

function hasWeakAssistantReply(reply) {
  const normalized = cleanText(String(reply || "")).toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    "i don't know",
    "i do not know",
    "i'm not sure",
    "i am not sure",
    "i don't have",
    "i do not have",
    "i couldn't find",
    "i could not find",
    "i can't find",
    "i cannot find",
    "not available on the website",
    "not mentioned on the website",
    "not provided on the website",
    "please contact the business directly",
    "please reach out directly",
    "reach out to the business directly",
  ].some((snippet) => normalized.includes(snippet));
}

function buildConversationSummary(question, reply) {
  const normalizedQuestion = cleanText(question);
  const normalizedReply = cleanText(reply);

  if (normalizedQuestion && normalizedReply) {
    return truncateText(`Visitor asked: ${normalizedQuestion} Vonza replied: ${normalizedReply}`);
  }

  if (normalizedQuestion) {
    return truncateText(`Visitor asked: ${normalizedQuestion}`);
  }

  if (normalizedReply) {
    return truncateText(`Vonza replied: ${normalizedReply}`);
  }

  return "";
}

function getConversationSuggestedAction(type, options = {}) {
  const weakAnswer = options.weakAnswer === true;
  const contactCaptured = options.contactCaptured === true;
  const unresolved = options.unresolved === true;
  const base = getSuggestedAction(type);

  if (type === "contact" && contactCaptured && (weakAnswer || unresolved)) {
    return `${base} Contact details were captured here, so decide whether the owner should respond directly now.`;
  }

  if (type !== "weak_answer" && (weakAnswer || unresolved)) {
    return `${base} The assistant also struggled in this conversation, so improve the answer path before the next similar visitor arrives.`;
  }

  return base;
}

function extractContactInfo(text = "") {
  const normalized = String(text || "");
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = normalized.match(/(?:\+?\d[\d().\-\s]{6,}\d)/);
  const namePatterns = [
    /\b(?:my name is|i am|i'm|this is)\s+([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){1,2})\b/iu,
    /\b(?:a nevem|az en nevem|nevem)\s+([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){1,2})\b/iu,
  ];
  let name = "";

  for (const pattern of namePatterns) {
    const match = normalized.match(pattern);

    if (cleanText(match?.[1])) {
      name = cleanText(match[1]);
      break;
    }
  }

  return {
    email: emailMatch ? cleanText(emailMatch[0]) : "",
    phone: phoneMatch ? cleanText(phoneMatch[0]) : "",
    name,
  };
}

function mergeContactInfo(existing = {}, next = {}) {
  return {
    email: existing.email || next.email || "",
    phone: existing.phone || next.phone || "",
    name: existing.name || next.name || "",
  };
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

function normalizePersonName(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPersonName(value) {
  const normalized = normalizePersonName(value);
  const parts = normalized.split(" ").filter(Boolean);
  const blockedParts = new Set([
    "hello",
    "support",
    "pricing",
    "team",
    "thanks",
    "thank",
    "customer",
    "visitor",
    "there",
    "someone",
  ]);

  return (
    parts.length >= 2 &&
    parts.length <= 3 &&
    parts.every((part) => part.length >= 2 && !blockedParts.has(part))
  );
}

function toTitleCase(value) {
  return cleanText(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getInteractionCreatedAt(interaction = {}) {
  return interaction.createdAt || interaction.lastSeenAt || null;
}

function buildInteractionIdentity(interaction = {}) {
  const email = normalizeEmail(interaction.contactInfo?.email);
  const phone = normalizePhone(interaction.contactInfo?.phone);
  const sessionKey = cleanText(interaction.sessionKey);
  const normalizedName = isLikelyPersonName(interaction.contactInfo?.name)
    ? normalizePersonName(interaction.contactInfo?.name)
    : "";

  return {
    email,
    phone,
    sessionKey,
    name: normalizedName,
  };
}

function createPersonRecord(interaction = {}) {
  const identity = buildInteractionIdentity(interaction);
  const personKey = identity.email
    ? `person:email:${identity.email}`
    : identity.phone
      ? `person:phone:${identity.phone}`
      : identity.sessionKey
        ? `person:session:${identity.sessionKey}`
        : identity.name
          ? `person:name:${identity.name}`
          : `person:unknown:${interaction.key}`;

  return {
    key: personKey,
    email: identity.email || "",
    phone: identity.phone || "",
    phoneRaw: cleanText(interaction.contactInfo?.phone),
    name: identity.name || "",
    nameRaw: cleanText(interaction.contactInfo?.name),
    sessionKeys: new Set(identity.sessionKey ? [identity.sessionKey] : []),
    interactions: [],
    actionKeys: new Set(),
    intentCounts: new Map(),
    firstSeenAt: getInteractionCreatedAt(interaction),
    lastSeenAt: interaction.lastSeenAt || getInteractionCreatedAt(interaction),
  };
}

function addInteractionToPerson(person, interaction = {}) {
  const identity = buildInteractionIdentity(interaction);

  if (!person.email && identity.email) {
    person.email = identity.email;
  }

  if (!person.phone && identity.phone) {
    person.phone = identity.phone;
  }

  if (!person.phoneRaw && cleanText(interaction.contactInfo?.phone)) {
    person.phoneRaw = cleanText(interaction.contactInfo.phone);
  }

  if (!person.name && identity.name) {
    person.name = identity.name;
  }

  if (!person.nameRaw && cleanText(interaction.contactInfo?.name)) {
    person.nameRaw = cleanText(interaction.contactInfo.name);
  }

  if (identity.sessionKey) {
    person.sessionKeys.add(identity.sessionKey);
  }

  person.interactions.push(interaction);

  if (interaction.actionable) {
    person.actionKeys.add(interaction.key);
  }

  person.intentCounts.set(
    interaction.intent,
    (person.intentCounts.get(interaction.intent) || 0) + 1
  );

  const createdAt = getInteractionCreatedAt(interaction);

  if (!person.firstSeenAt || getMessageTimestamp({ createdAt }) < getMessageTimestamp({ createdAt: person.firstSeenAt })) {
    person.firstSeenAt = createdAt;
  }

  if (!person.lastSeenAt || getMessageTimestamp({ createdAt }) > getMessageTimestamp({ createdAt: person.lastSeenAt })) {
    person.lastSeenAt = createdAt;
  }
}

function mergePersonRecords(primary, secondary) {
  if (!primary || !secondary || primary.key === secondary.key) {
    return primary;
  }

  if (!primary.email && secondary.email) {
    primary.email = secondary.email;
  }

  if (!primary.phone && secondary.phone) {
    primary.phone = secondary.phone;
  }

  if (!primary.phoneRaw && secondary.phoneRaw) {
    primary.phoneRaw = secondary.phoneRaw;
  }

  if (!primary.name && secondary.name) {
    primary.name = secondary.name;
  }

  if (!primary.nameRaw && secondary.nameRaw) {
    primary.nameRaw = secondary.nameRaw;
  }

  secondary.sessionKeys.forEach((sessionKey) => {
    primary.sessionKeys.add(sessionKey);
  });
  secondary.interactions.forEach((interaction) => {
    primary.interactions.push(interaction);
  });
  secondary.actionKeys.forEach((actionKey) => {
    primary.actionKeys.add(actionKey);
  });
  secondary.intentCounts.forEach((count, intent) => {
    primary.intentCounts.set(intent, (primary.intentCounts.get(intent) || 0) + count);
  });

  if (!primary.firstSeenAt || getMessageTimestamp({ createdAt: secondary.firstSeenAt }) < getMessageTimestamp({ createdAt: primary.firstSeenAt })) {
    primary.firstSeenAt = secondary.firstSeenAt;
  }

  if (!primary.lastSeenAt || getMessageTimestamp({ createdAt: secondary.lastSeenAt }) > getMessageTimestamp({ createdAt: primary.lastSeenAt })) {
    primary.lastSeenAt = secondary.lastSeenAt;
  }

  return primary;
}

function registerPersonSignals(person, signalMaps) {
  if (person.email) {
    signalMaps.email.set(person.email, person.key);
  }

  if (person.phone) {
    signalMaps.phone.set(person.phone, person.key);
  }

  person.sessionKeys.forEach((sessionKey) => {
    signalMaps.session.set(sessionKey, person.key);
  });

  if (person.name) {
    signalMaps.name.set(person.name, person.key);
  }
}

function buildConversationInteractions(messages = []) {
  const chronological = getChronologicalMessages(messages);
  const interactions = [];

  chronological.forEach((message, index) => {
    if (message.role !== "user") {
      return;
    }

    const question = cleanText(message.content || "");

    if (!question) {
      return;
    }

    const intent = categorizeIntent(question);
    let reply = "";
    let assistantMessage = null;

    for (let cursor = index + 1; cursor < chronological.length; cursor += 1) {
      const nextMessage = chronological[cursor];

      if (nextMessage.role === "user") {
        break;
      }

      if (nextMessage.role === "assistant") {
        reply = cleanText(nextMessage.content || "");
        assistantMessage = nextMessage;
        break;
      }
    }

    const actionableIntent = ACTIONABLE_INTENTS.includes(intent);
    const weakAnswer = hasWeakAssistantReply(reply);
    const unresolved = !cleanText(reply);
    const type = actionableIntent ? intent : "weak_answer";
    const contactInfo = mergeContactInfo(extractContactInfo(question), extractContactInfo(reply));
    const actionKey = buildConversationActionKey(message, index);
    const lastSeenAt = assistantMessage?.createdAt || assistantMessage?.created_at || message.createdAt || message.created_at || null;
    const sessionKey = cleanText(
      message.sessionKey
      || message.session_key
      || assistantMessage?.sessionKey
      || assistantMessage?.session_key
    );

    interactions.push({
      key: actionKey,
      type,
      label: type === "weak_answer"
        ? unresolved ? "Unresolved conversation" : "Weak answer"
        : getIntentLabel(type),
      question,
      reply,
      snippet: buildConversationSummary(question, reply),
      whyFlagged: getConversationFlagReason(intent, { weakAnswer, unresolved }),
      suggestedAction: getConversationSuggestedAction(type, {
        weakAnswer,
        unresolved,
        contactCaptured: Boolean(contactInfo.email || contactInfo.phone),
      }),
      createdAt: message.createdAt || message.created_at || null,
      lastSeenAt,
      unresolved,
      weakAnswer,
      intent,
      actionable: actionableIntent || weakAnswer,
      contactCaptured: Boolean(contactInfo.email || contactInfo.phone),
      contactInfo: contactInfo.email || contactInfo.phone || contactInfo.name
        ? {
            email: contactInfo.email || null,
            phone: contactInfo.phone || null,
            name: contactInfo.name || null,
          }
        : null,
      sessionKey: sessionKey || null,
    });
  });

  return interactions;
}

function buildQuestionRepeatCounts(interactions = []) {
  const counts = new Map();

  interactions.forEach((interaction) => {
    const fingerprint = buildQuestionFingerprint(interaction.question);

    if (!fingerprint) {
      return;
    }

    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  });

  return counts;
}

function selectInteractionActionType(interaction, context = {}) {
  const explicitFollowUp = context.explicitFollowUp === true;
  const repeatedQuestion = context.repeatedQuestion === true;
  const knowledgeGap = context.knowledgeGap === true;

  if (interaction.contactCaptured && (explicitFollowUp || interaction.intent === "contact")) {
    return "lead_follow_up";
  }

  if (interaction.intent === "pricing") {
    return "pricing_interest";
  }

  if (interaction.intent === "booking") {
    return "booking_intent";
  }

  if (interaction.unresolved || interaction.weakAnswer) {
    return knowledgeGap || repeatedQuestion ? "knowledge_gap" : "unanswered_question";
  }

  return "";
}

function getActionTypeLabel(type) {
  switch (normalizeActionType(type)) {
    case "lead_follow_up":
      return "Lead follow-up";
    case "pricing_interest":
      return "Pricing interest";
    case "booking_intent":
      return "Booking intent";
    case "unanswered_question":
      return "Unanswered question";
    case "knowledge_gap":
      return "Knowledge gap";
    case "repeat_high_intent_visitor":
      return "Repeat high-intent visitor";
    default:
      return "Operator action";
  }
}

function getActionPriority(type, options = {}) {
  const normalizedType = normalizeActionType(type);

  switch (normalizedType) {
    case "lead_follow_up":
    case "booking_intent":
    case "repeat_high_intent_visitor":
      return "high";
    case "knowledge_gap":
      return options.repeatedQuestion || options.highIntent ? "high" : "medium";
    case "pricing_interest":
      return options.contactCaptured ? "high" : "medium";
    default:
      return "medium";
  }
}

function buildActionGroupKey(type, interaction, person, options = {}) {
  const normalizedType = normalizeActionType(type);
  const personKey = cleanText(person?.key);
  const scopedPersonKey = personKey && !isUnknownPersonKey(personKey)
    ? personKey
    : cleanText(interaction.key);

  if (normalizedType === "lead_follow_up" || normalizedType === "pricing_interest" || normalizedType === "booking_intent") {
    return `operator:${normalizedType}:${scopedPersonKey}`;
  }

  if (normalizedType === "repeat_high_intent_visitor") {
    return `operator:${normalizedType}:${scopedPersonKey}`;
  }

  const issueFingerprint = cleanText(options.issueFingerprint || buildQuestionFingerprint(interaction.question) || interaction.intent || "issue");
  return `operator:${normalizedType}:${scopedPersonKey}:${issueFingerprint}`;
}

function buildActionTitle(type, options = {}) {
  const normalizedType = normalizeActionType(type);
  const personLabel = cleanText(options.personLabel);

  switch (normalizedType) {
    case "lead_follow_up":
      return personLabel ? `Follow up with ${personLabel}` : "Follow up with captured lead";
    case "pricing_interest":
      return personLabel ? `Pricing interest from ${personLabel}` : "Pricing interest detected";
    case "booking_intent":
      return personLabel ? `Booking intent from ${personLabel}` : "Booking intent detected";
    case "knowledge_gap":
      return "Important answer gap in current knowledge";
    case "repeat_high_intent_visitor":
      return personLabel ? `${personLabel} came back with high-intent questions` : "Repeat high-intent visitor";
    default:
      return "Customer question still needs an answer";
  }
}

function buildActionOperatorSummary(type, summary = {}) {
  const interactionCount = Number(summary.interactionCount || 0);
  const questionLabel = interactionCount > 1
    ? `${interactionCount} related conversations`
    : "This conversation";

  switch (normalizeActionType(type)) {
    case "lead_follow_up":
      return summary.contactInfo
        ? `${questionLabel} included a direct follow-up request and captured contact details.`
        : `${questionLabel} showed a clear request for direct owner follow-up.`;
    case "pricing_interest":
      return `${questionLabel} asked for pricing, quotes, packages, or cost clarity.`;
    case "booking_intent":
      return `${questionLabel} asked to book, schedule, or check availability.`;
    case "knowledge_gap":
      return `${questionLabel} exposed a missing answer path in the current website knowledge or assistant guidance.`;
    case "repeat_high_intent_visitor":
      return `${questionLabel} show the same visitor returning with strong buyer intent.`;
    default:
      return `${questionLabel} did not receive a confident answer from the assistant.`;
  }
}

function buildActionWhyItMatters(type, summary = {}) {
  switch (normalizeActionType(type)) {
    case "lead_follow_up":
      return "This visitor asked to be contacted, so the business has a direct chance to move the conversation forward.";
    case "pricing_interest":
      return "Pricing questions usually signal purchase intent and often need clearer guidance to convert.";
    case "booking_intent":
      return "Booking intent means the visitor is close to taking action if the next step is obvious.";
    case "knowledge_gap":
      return summary.repeatedQuestion
        ? "The same missing answer is repeating, which suggests a durable gap in the current setup."
        : "Vonza could not answer this confidently from the current business knowledge.";
    case "repeat_high_intent_visitor":
      return "A returning high-intent visitor is a strong operator signal worth prioritizing now.";
    default:
      return "Unanswered customer questions erode trust and usually point to a missing answer path.";
  }
}

function buildRecommendedAction(type, summary = {}) {
  switch (normalizeActionType(type)) {
    case "lead_follow_up":
      return summary.contactInfo
        ? "Send follow-up to the captured lead and confirm the best next step."
        : "Review the conversation and make the contact path easier to find for similar visitors.";
    case "pricing_interest":
      return summary.contactInfo
        ? "Review pricing questions, send the right follow-up, and add clearer pricing guidance."
        : "Review pricing questions and add pricing guidance to the website or assistant setup.";
    case "booking_intent":
      return "Prioritize this visitor and make the booking or contact path easier to reach.";
    case "knowledge_gap":
      return "Jump to Customize and add the missing answer to website knowledge or assistant guidance.";
    case "repeat_high_intent_visitor":
      return "Prioritize this visitor, review the full thread, and make the next step obvious.";
    default:
      return "Review the related conversation and add the missing answer to assistant guidance.";
  }
}

function buildActionEvidence(interactions = [], options = {}) {
  const questionExamples = interactions
    .map((interaction) => cleanText(interaction.question))
    .filter(Boolean)
    .slice(0, 3);
  const replyExamples = interactions
    .map((interaction) => cleanText(interaction.reply))
    .filter(Boolean)
    .slice(0, 2);
  const intents = [...new Set(interactions.map((interaction) => cleanText(interaction.intent)).filter(Boolean))];
  const contactInfo = options.contactInfo || interactions.find((interaction) => interaction.contactCaptured)?.contactInfo || null;

  return {
    interactionCount: interactions.length,
    questionExamples,
    replyExamples,
    intents,
    contactCaptured: Boolean(contactInfo?.email || contactInfo?.phone),
    contactInfo,
    weakAnswerCount: interactions.filter((interaction) => interaction.weakAnswer).length,
    unresolvedCount: interactions.filter((interaction) => interaction.unresolved).length,
    repeatedQuestion: options.repeatedQuestion === true,
    explicitFollowUp: options.explicitFollowUp === true,
    knowledgeGap: options.knowledgeGap === true,
    personKey: cleanText(options.personKey) || null,
  };
}

function buildPersonKeyIntents(intentCounts = new Map()) {
  return [...intentCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([intent, count]) => ({
      intent,
      count,
      label: getIntentLabel(intent),
    }));
}

function buildPersonFollowUp(queueItems = []) {
  if (!queueItems.length) {
    return {
      key: "no_queue_items",
      label: "No queue items yet",
      copy: "This visitor has not created a follow-up item yet.",
      attentionCount: 0,
      resolvedCount: 0,
    };
  }

  const workflows = queueItems.map((item) => item.ownerWorkflow || buildOwnerWorkflow(item));
  const attentionCount = workflows.filter((workflow) => workflow.attention).length;
  const resolvedCount = workflows.filter((workflow) => workflow.resolved).length;

  if (attentionCount > 0) {
    return {
      key: "needs_attention",
      label: attentionCount === 1 ? "1 item needs attention" : `${attentionCount} items need attention`,
      copy: attentionCount === queueItems.length
        ? "Every linked queue item still needs owner attention."
        : "Some linked queue items still need owner attention.",
      attentionCount,
      resolvedCount,
    };
  }

  if (resolvedCount === queueItems.length) {
    return {
      key: "resolved",
      label: "Resolved",
      copy: "All linked queue items are resolved.",
      attentionCount,
      resolvedCount,
    };
  }

  return {
    key: "monitored",
    label: "Monitored",
    copy: "This visitor has queue history, but nothing urgent is open right now.",
    attentionCount,
    resolvedCount,
  };
}

function buildPersonStory(person) {
  const interactionCount = Number(person.interactionCount || person.interactions?.length || 0);
  const topIntent = person.keyIntents.find((entry) => entry.intent !== "general" && entry.intent !== "services") || person.keyIntents[0];

  if (topIntent?.intent === "pricing" && topIntent.count > 1) {
    return `This same person asked about pricing ${topIntent.count} times.`;
  }

  if (topIntent?.intent === "support" && topIntent.count > 1) {
    return `This support issue appears to be evolving across ${topIntent.count} interactions.`;
  }

  if (topIntent?.intent === "contact" && interactionCount > 1) {
    return `This lead came back across ${interactionCount} interactions.`;
  }

  if (interactionCount > 1) {
    return `This same visitor returned across ${interactionCount} interactions.`;
  }

  return "Single interaction so far.";
}

function buildPersonDisplayLabel(person) {
  if (cleanText(person.nameRaw)) {
    return cleanText(person.nameRaw);
  }

  if (person.email) {
    return person.email;
  }

  if (person.phoneRaw) {
    return person.phoneRaw;
  }

  if (person.sessionKeys.size > 0) {
    return person.interactions.length > 1 ? "Returning visitor" : "Known visitor";
  }

  return "Unknown visitor";
}

function buildPeopleRecords(interactions = []) {
  const peopleByKey = new Map();
  const signalMaps = {
    email: new Map(),
    phone: new Map(),
    session: new Map(),
    name: new Map(),
  };
  const interactionToPersonKey = new Map();

  interactions.forEach((interaction) => {
    const identity = buildInteractionIdentity(interaction);
    const matchingKeys = new Set();

    if (identity.email && signalMaps.email.has(identity.email)) {
      matchingKeys.add(signalMaps.email.get(identity.email));
    }

    if (identity.phone && signalMaps.phone.has(identity.phone)) {
      matchingKeys.add(signalMaps.phone.get(identity.phone));
    }

    if (identity.sessionKey && signalMaps.session.has(identity.sessionKey)) {
      matchingKeys.add(signalMaps.session.get(identity.sessionKey));
    }

    if (
      identity.name &&
      signalMaps.name.has(identity.name) &&
      !identity.email &&
      !identity.phone &&
      !identity.sessionKey
    ) {
      matchingKeys.add(signalMaps.name.get(identity.name));
    }

    let person = null;

    if (!matchingKeys.size) {
      person = createPersonRecord(interaction);
      peopleByKey.set(person.key, person);
    } else {
      const [primaryKey, ...otherKeys] = [...matchingKeys];
      person = peopleByKey.get(primaryKey);

      otherKeys.forEach((otherKey) => {
        const otherPerson = peopleByKey.get(otherKey);

        if (!otherPerson) {
          return;
        }

        person = mergePersonRecords(person, otherPerson);
        peopleByKey.delete(otherKey);
      });
    }

    addInteractionToPerson(person, interaction);
    registerPersonSignals(person, signalMaps);
  });

  const records = [...peopleByKey.values()];

  records.forEach((person) => {
    person.interactions.forEach((interaction) => {
      interactionToPersonKey.set(interaction.key, person.key);
    });
  });

  return {
    records,
    interactionToPersonKey,
  };
}

function materializePeople(records = [], actionItems = [], interactionToPersonKey = new Map()) {
  const actionItemMap = new Map(actionItems.map((item) => [item.key, item]));
  const recordsByKey = new Map(records.map((record) => [record.key, record]));

  const people = records
    .map((person) => {
      const queueItems = actionItems
        .filter((item) => cleanText(item.relatedVisitorId) === person.key)
        .filter(Boolean)
        .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt }));
      const interactionsDesc = [...person.interactions]
        .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt || right.createdAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt || left.createdAt }));
      const normalizedPerson = {
        key: person.key,
        label: buildPersonDisplayLabel(person),
        identityType: person.email
          ? "email"
          : person.phone
            ? "phone"
            : person.sessionKeys.size > 0
              ? "session"
              : person.name
                ? "name"
                : "unknown",
        email: person.email || null,
        phone: person.phoneRaw || null,
        name: cleanText(person.nameRaw) || (person.name ? toTitleCase(person.name) : null),
        firstSeenAt: person.firstSeenAt || null,
        lastSeenAt: person.lastSeenAt || null,
        interactionCount: interactionsDesc.length,
        queueItemCount: queueItems.length,
        isReturning: interactionsDesc.length > 1,
        keyIntents: buildPersonKeyIntents(person.intentCounts),
        snippets: interactionsDesc.slice(0, 3).map((interaction) => ({
          actionKey: interaction.key,
          text: interaction.snippet || buildConversationSummary(interaction.question, interaction.reply),
          at: interaction.lastSeenAt || interaction.createdAt || null,
          intent: interaction.intent,
          actionable: interaction.actionable,
        })),
        timeline: interactionsDesc.slice(0, 5).map((interaction) => ({
          actionKey: interaction.key,
          at: interaction.lastSeenAt || interaction.createdAt || null,
          label: interaction.label,
          intent: interaction.intent,
          summary: interaction.snippet || buildConversationSummary(interaction.question, interaction.reply),
          actionable: interaction.actionable,
        })),
        queueItemKeys: queueItems.map((item) => item.key),
        queueItems: queueItems.map((item) => ({
          key: item.key,
          label: item.label,
          status: item.status,
          ownerWorkflow: item.ownerWorkflow,
          lastSeenAt: item.lastSeenAt,
        })),
      };

      normalizedPerson.followUp = buildPersonFollowUp(queueItems);
      normalizedPerson.story = buildPersonStory(normalizedPerson);

      return normalizedPerson;
    })
    .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt }));
  const peopleByActionKey = new Map();

  people.forEach((person) => {
    person.timeline.forEach((entry) => {
      peopleByActionKey.set(entry.actionKey, person.key);
    });
  });

  const peopleIndex = new Map(people.map((person) => [person.key, person]));

  return {
    people,
    items: actionItems.map((item) => {
      const personKey = cleanText(item.relatedVisitorId) || peopleByActionKey.get(item.key) || interactionToPersonKey.get(item.relatedConversationId);
      const person = peopleIndex.get(personKey);
      const rawRecord = recordsByKey.get(personKey);

      if (!person) {
        return item;
      }

      return {
        ...item,
        person: {
          key: person.key,
          label: person.label,
          identityType: person.identityType,
          relatedInteractionCount: person.interactionCount,
          relatedQueueItemCount: person.queueItemCount,
          isReturning: person.isReturning,
          story: person.story,
          followUp: person.followUp,
          timeline: rawRecord?.interactions
            ?.slice()
            .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt || right.createdAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt || left.createdAt }))
            .map((interaction) => ({
              actionKey: interaction.key,
              at: interaction.lastSeenAt || interaction.createdAt || null,
              summary: interaction.snippet || buildConversationSummary(interaction.question, interaction.reply),
            })) || [],
        },
      };
    }),
  };
}

function createActionCandidateBucket(candidate) {
  return {
    ...candidate,
    interactions: [...(candidate.interactions || [])],
  };
}

function upsertActionCandidate(bucketMap, candidate) {
  const existing = bucketMap.get(candidate.key);

  if (!existing) {
    bucketMap.set(candidate.key, createActionCandidateBucket(candidate));
    return;
  }

  existing.interactions.push(...candidate.interactions);
  existing.contactCaptured = existing.contactCaptured || candidate.contactCaptured;
  existing.contactInfo = existing.contactInfo || candidate.contactInfo || null;
  existing.lastSeenAt = getMessageTimestamp({ createdAt: candidate.lastSeenAt }) > getMessageTimestamp({ createdAt: existing.lastSeenAt })
    ? candidate.lastSeenAt
    : existing.lastSeenAt;
  existing.createdAt = getMessageTimestamp({ createdAt: candidate.createdAt }) < getMessageTimestamp({ createdAt: existing.createdAt })
    ? candidate.createdAt
    : existing.createdAt;
  existing.relatedConversationIds = [...new Set([...(existing.relatedConversationIds || []), ...(candidate.relatedConversationIds || [])])];
  existing.relatedConversationId = existing.relatedConversationIds[existing.relatedConversationIds.length - 1] || existing.relatedConversationId;
  existing.count = existing.interactions.length;
}

function buildInteractionActionCandidates(interactions = [], options = {}) {
  const peopleByKey = new Map((options.peopleRecords || []).map((person) => [person.key, person]));
  const interactionToPersonKey = options.interactionToPersonKey || new Map();
  const questionRepeatCounts = buildQuestionRepeatCounts(interactions);
  const buckets = new Map();

  interactions.forEach((interaction) => {
    const personKey = interactionToPersonKey.get(interaction.key) || "";
    const person = peopleByKey.get(personKey) || null;
    const questionFingerprint = buildQuestionFingerprint(interaction.question);
    const repeatedQuestion = Boolean(questionFingerprint && (questionRepeatCounts.get(questionFingerprint) || 0) > 1);
    const explicitFollowUp = hasExplicitFollowUpRequest(interaction.question);
    const knowledgeGap = replySignalsKnowledgeGap(interaction.reply);
    const type = selectInteractionActionType(interaction, {
      explicitFollowUp,
      repeatedQuestion,
      knowledgeGap,
    });

    if (!type) {
      return;
    }

    const relatedVisitorId = cleanText(person?.key);
    const priority = getActionPriority(type, {
      repeatedQuestion,
      highIntent: isHighIntentIntent(interaction.intent),
      contactCaptured: interaction.contactCaptured,
    });
    const title = buildActionTitle(type, {
      personLabel: cleanText(person?.label || person?.nameRaw || person?.email || person?.phoneRaw),
    });
    const operatorSummary = buildActionOperatorSummary(type, {
      interactionCount: 1,
      contactInfo: interaction.contactInfo,
    });
    const whyItMatters = buildActionWhyItMatters(type, {
      repeatedQuestion,
    });
    const recommendedAction = buildRecommendedAction(type, {
      contactInfo: interaction.contactInfo,
    });
    const key = buildActionGroupKey(type, interaction, person, {
      issueFingerprint: questionFingerprint || interaction.intent || "issue",
    });

    upsertActionCandidate(buckets, {
      key,
      type,
      priority,
      label: title,
      operatorSummary,
      whyFlagged: whyItMatters,
      suggestedAction: recommendedAction,
      snippet: interaction.snippet,
      createdAt: interaction.createdAt || interaction.lastSeenAt || null,
      lastSeenAt: interaction.lastSeenAt || interaction.createdAt || null,
      contactCaptured: interaction.contactCaptured,
      contactInfo: interaction.contactInfo || null,
      relatedConversationId: interaction.key,
      relatedConversationIds: [interaction.key],
      relatedVisitorId: relatedVisitorId || null,
      relatedPageUrl: null,
      evidence: buildActionEvidence([interaction], {
        repeatedQuestion,
        explicitFollowUp,
        knowledgeGap,
        contactInfo: interaction.contactInfo,
        personKey: relatedVisitorId,
      }),
      interactions: [interaction],
      count: 1,
    });
  });

  return [...buckets.values()];
}

function buildRepeatHighIntentVisitorCandidates(peopleRecords = []) {
  const buckets = [];

  peopleRecords.forEach((person) => {
    if (isUnknownPersonKey(person.key)) {
      return;
    }

    const highIntentInteractions = person.interactions
      .filter((interaction) => isHighIntentIntent(interaction.intent))
      .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt || right.createdAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt || left.createdAt }));

    if (highIntentInteractions.length < 2) {
      return;
    }

    const latest = highIntentInteractions[0];
    const priority = getActionPriority("repeat_high_intent_visitor");
    const title = buildActionTitle("repeat_high_intent_visitor", {
      personLabel: buildPersonDisplayLabel(person),
    });

    buckets.push({
      key: `operator:repeat_high_intent_visitor:${person.key}`,
      type: "repeat_high_intent_visitor",
      priority,
      label: title,
      operatorSummary: buildActionOperatorSummary("repeat_high_intent_visitor", {
        interactionCount: highIntentInteractions.length,
      }),
      whyFlagged: buildActionWhyItMatters("repeat_high_intent_visitor"),
      suggestedAction: buildRecommendedAction("repeat_high_intent_visitor"),
      snippet: truncateText(highIntentInteractions.map((interaction) => interaction.snippet || buildConversationSummary(interaction.question, interaction.reply)).join(" ")),
      createdAt: highIntentInteractions[highIntentInteractions.length - 1]?.createdAt || null,
      lastSeenAt: latest.lastSeenAt || latest.createdAt || null,
      contactCaptured: highIntentInteractions.some((interaction) => interaction.contactCaptured),
      contactInfo: highIntentInteractions.find((interaction) => interaction.contactCaptured)?.contactInfo || null,
      relatedConversationId: latest.key,
      relatedConversationIds: highIntentInteractions.map((interaction) => interaction.key),
      relatedVisitorId: person.key,
      relatedPageUrl: null,
      evidence: buildActionEvidence(highIntentInteractions, {
        personKey: person.key,
      }),
      interactions: highIntentInteractions,
      count: highIntentInteractions.length,
    });
  });

  return buckets;
}

function finalizeActionItems(candidates = [], persistedStatuses = [], options = {}) {
  const persistedMap = new Map(
    (persistedStatuses || []).map((item) => {
      const normalized = normalizePersistedItem(item);
      return [normalized.actionKey, normalized];
    })
  );
  const grouped = new Map();

  candidates.forEach((candidate) => {
    upsertActionCandidate(grouped, candidate);
  });

  const items = [...grouped.values()].map((candidate) => {
    const type = normalizeActionType(candidate.type);
    const priority = normalizeActionPriority(candidate.priority);
    const persistedItem = persistedMap.get(candidate.key) || {};
    const ownerWorkflow = buildOwnerWorkflow(persistedItem);
    const personLabel = cleanText(candidate.contactInfo?.name) || "";
    const questionExamples = candidate.interactions.map((interaction) => buildQuestionFingerprint(interaction.question)).filter(Boolean);
    const repeatedQuestion = new Set(questionExamples).size < questionExamples.length;
    const evidence = buildActionEvidence(candidate.interactions, {
      repeatedQuestion,
      explicitFollowUp: candidate.interactions.some((interaction) => hasExplicitFollowUpRequest(interaction.question)),
      knowledgeGap: candidate.interactions.some((interaction) => replySignalsKnowledgeGap(interaction.reply)),
      contactInfo: candidate.contactInfo,
      personKey: candidate.relatedVisitorId,
    });
    const count = Number(candidate.interactions.length || candidate.count || 1);
    const title = buildActionTitle(type, { personLabel });
    const operatorSummary = buildActionOperatorSummary(type, {
      interactionCount: count,
      contactInfo: candidate.contactInfo,
    });
    const whyItMatters = buildActionWhyItMatters(type, {
      repeatedQuestion,
    });
    const recommendedAction = buildRecommendedAction(type, {
      contactInfo: candidate.contactInfo,
    });

    return {
      key: candidate.key,
      type,
      priority,
      priorityRank: getPriorityRank(priority),
      priorityLabel: `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`,
      label: candidate.label || title,
      title: candidate.label || title,
      operatorSummary,
      status: persistedItem.status || "new",
      count,
      snippet: candidate.snippet || truncateText(candidate.interactions.map((interaction) => interaction.snippet).filter(Boolean).join(" ")),
      whyFlagged: whyItMatters,
      suggestedAction: recommendedAction,
      recommendedAction,
      lastSeenAt: candidate.lastSeenAt,
      createdAt: candidate.createdAt,
      note: persistedItem.note || "",
      outcome: persistedItem.outcome || "",
      nextStep: persistedItem.nextStep || "",
      followUpNeeded: persistedItem.followUpNeeded,
      followUpCompleted: persistedItem.followUpCompleted,
      contactStatus: persistedItem.contactStatus || "",
      updatedAt: persistedItem.updatedAt || null,
      ownerWorkflow,
      contactCaptured: candidate.contactCaptured,
      contactInfo: candidate.contactInfo,
      unresolved: candidate.interactions.some((interaction) => interaction.unresolved),
      weakAnswer: candidate.interactions.some((interaction) => interaction.weakAnswer),
      intent: candidate.interactions[0]?.intent || "",
      intents: [...new Set(candidate.interactions.map((interaction) => interaction.intent).filter(Boolean))],
      sessionKey: candidate.interactions.find((interaction) => interaction.sessionKey)?.sessionKey || null,
      evidence,
      relatedConversationId: candidate.relatedConversationId || null,
      relatedConversationIds: candidate.relatedConversationIds || [],
      relatedVisitorId: candidate.relatedVisitorId || null,
      relatedPageUrl: candidate.relatedPageUrl || null,
      interactions: candidate.interactions.map((interaction) => ({
        key: interaction.key,
        question: interaction.question,
        reply: interaction.reply,
        snippet: interaction.snippet,
        createdAt: interaction.createdAt,
        lastSeenAt: interaction.lastSeenAt,
      })),
    };
  });

  if (options.logDecisions) {
    const typeCounts = items.reduce((counts, item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
      return counts;
    }, {});

    console.log("[action queue] Generated operator actions:", {
      total: items.length,
      byType: typeCounts,
    });
  }

  return items;
}

function buildPeopleSummary(people = []) {
  return {
    total: people.length,
    returning: people.filter((person) => person.isReturning).length,
    linkedQueueItems: people.filter((person) => person.queueItemCount > 0).length,
  };
}

function buildStatusSummary(items = []) {
  const summary = {
    total: items.length,
    open: 0,
    new: 0,
    reviewed: 0,
    done: 0,
    dismissed: 0,
    followUpNeeded: 0,
    followUpCompleted: 0,
    resolved: 0,
    attentionNeeded: 0,
    highPriority: 0,
    leadFollowUp: 0,
    pricingInterest: 0,
    bookingIntent: 0,
    unansweredQuestion: 0,
    knowledgeGap: 0,
    repeatHighIntentVisitor: 0,
  };

  items.forEach((item) => {
    const status = normalizeStatus(item.status);
    const workflow = item.ownerWorkflow || buildOwnerWorkflow(item);
    summary[status] += 1;

    if (isFollowUpNeeded(item)) {
      summary.followUpNeeded += 1;
    }

    if (item.followUpCompleted === true) {
      summary.followUpCompleted += 1;
    }

    if (isResolved(item)) {
      summary.resolved += 1;
    }

    if (workflow.attention) {
      summary.attentionNeeded += 1;
    }

    if (status !== "done" && status !== "dismissed") {
      summary.open += 1;
    }

    if (item.priority === "high") {
      summary.highPriority += 1;
    }

    switch (item.type) {
      case "lead_follow_up":
        summary.leadFollowUp += 1;
        break;
      case "pricing_interest":
        summary.pricingInterest += 1;
        break;
      case "booking_intent":
        summary.bookingIntent += 1;
        break;
      case "unanswered_question":
        summary.unansweredQuestion += 1;
        break;
      case "knowledge_gap":
        summary.knowledgeGap += 1;
        break;
      case "repeat_high_intent_visitor":
        summary.repeatHighIntentVisitor += 1;
        break;
      default:
        break;
    }
  });

  return summary;
}

export function buildActionQueue(messages = [], persistedStatuses = [], options = {}) {
  const interactions = buildConversationInteractions(messages);
  const { records: peopleRecords, interactionToPersonKey } = buildPeopleRecords(interactions);
  const candidates = [
    ...buildInteractionActionCandidates(interactions, {
      peopleRecords,
      interactionToPersonKey,
    }),
    ...buildRepeatHighIntentVisitorCandidates(peopleRecords),
  ];
  const items = finalizeActionItems(candidates, persistedStatuses, {
    logDecisions: options.logDecisions,
  });
  const sortedItems = items
    .sort((left, right) => {
      const priorityDelta = (left.priorityRank ?? 99) - (right.priorityRank ?? 99);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const rankDelta = (left.ownerWorkflow?.rank ?? 99) - (right.ownerWorkflow?.rank ?? 99);

      if (rankDelta !== 0) {
        return rankDelta;
      }

      return getMessageTimestamp({ createdAt: right.lastSeenAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt });
    });
  const stitched = materializePeople(peopleRecords, sortedItems, interactionToPersonKey);

  return {
    items: stitched.items,
    people: stitched.people,
    peopleSummary: buildPeopleSummary(stitched.people),
    summary: buildStatusSummary(stitched.items),
    persistenceAvailable: options.persistenceAvailable !== false,
    migrationRequired: options.persistenceAvailable === false,
  };
}

export async function listActionQueueStatuses(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  if (!agentId || !ownerUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from(ACTION_QUEUE_STATUS_TABLE)
    .select("agent_id, owner_user_id, action_key, status, note, outcome, next_step, follow_up_needed, follow_up_completed, contact_status, updated_at")
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId);

  if (error) {
    if (isUnavailablePersistenceError(error)) {
      console.error("[action queue] Persistence schema unavailable while loading queue:", {
        agentId,
        ownerUserId,
        code: error.code || null,
        message: error.message || "Unknown error",
      });
      throw buildPersistenceUnavailableError();
    }

    console.error(error);
    throw error;
  }

  return {
    records: (data || []).map((row) => normalizePersistedItem(row)),
    persistenceAvailable: true,
  };
}

export async function updateActionQueueStatus(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const actionKey = cleanText(options.actionKey);
  const note = options.note === undefined ? undefined : cleanText(options.note);
  const outcome = options.outcome === undefined ? undefined : cleanText(options.outcome);
  const nextStep = options.nextStep === undefined ? undefined : cleanText(options.nextStep);
  const followUpNeeded = options.followUpNeeded === undefined ? undefined : normalizeBooleanFlag(options.followUpNeeded);
  const followUpCompleted = options.followUpCompleted === undefined ? undefined : normalizeBooleanFlag(options.followUpCompleted);
  const contactStatus = parseRequestedContactStatus(options.contactStatus);
  const explicitStatus = parseRequestedStatus(options.status);

  if (!agentId || !ownerUserId || !actionKey) {
    throw buildActionQueueError(
      "agent_id, owner_user_id, and action_key are required",
      400,
      "ACTION_QUEUE_INVALID_REQUEST"
    );
  }

  const { data: existingRow, error: existingError } = await supabase
    .from(ACTION_QUEUE_STATUS_TABLE)
    .select("agent_id, owner_user_id, action_key, status, note, outcome, next_step, follow_up_needed, follow_up_completed, contact_status, updated_at")
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .eq("action_key", actionKey)
    .maybeSingle();

  if (existingError) {
    if (isUnavailablePersistenceError(existingError)) {
      console.error("[action queue] Persistence schema unavailable while loading existing status:", {
        agentId,
        ownerUserId,
        actionKey,
        code: existingError.code || null,
        message: existingError.message || "Unknown error",
      });
      throw buildPersistenceUnavailableError();
    }

    console.error(existingError);
    throw existingError;
  }

  const previousItem = normalizePersistedItem(existingRow || {});
  const previousStatus = previousItem.actionKey ? previousItem.status : "new";
  const mergedItem = {
    ...previousItem,
    status: explicitStatus || previousStatus,
    note: note === undefined ? previousItem.note : note,
    outcome: outcome === undefined ? previousItem.outcome : outcome,
    nextStep: nextStep === undefined ? previousItem.nextStep : nextStep,
    followUpNeeded: followUpNeeded === undefined ? previousItem.followUpNeeded : followUpNeeded,
    followUpCompleted: followUpCompleted === undefined ? previousItem.followUpCompleted : followUpCompleted,
    contactStatus: contactStatus === undefined ? previousItem.contactStatus : contactStatus,
  };
  const hasHandoffUpdate = [
    note,
    outcome,
    nextStep,
    contactStatus,
  ].some((value) => value !== undefined && value !== "") || followUpNeeded !== undefined || followUpCompleted !== undefined;
  let status = mergedItem.status || "new";

  if (status !== "dismissed") {
    if (
      mergedItem.followUpCompleted === true
      || (mergedItem.followUpNeeded === false && cleanText(mergedItem.outcome))
    ) {
      status = "done";
    } else if ((hasHandoffUpdate || hasOwnerHandoffContent(mergedItem)) && status === "new") {
      status = "reviewed";
    }
  }

  validateStateShape({
    status,
    followUpNeeded: mergedItem.followUpNeeded,
    followUpCompleted: mergedItem.followUpCompleted,
  });
  assertValidStatusTransition(previousStatus, status);

  const payload = {
    agent_id: agentId,
    owner_user_id: ownerUserId,
    action_key: actionKey,
    updated_at: new Date().toISOString(),
  };

  payload.status = status;

  if (note !== undefined) {
    payload.note = note;
  }

  if (outcome !== undefined) {
    payload.outcome = outcome;
  }

  if (nextStep !== undefined) {
    payload.next_step = nextStep;
  }

  if (followUpNeeded !== undefined) {
    payload.follow_up_needed = followUpNeeded;
  }

  if (followUpCompleted !== undefined) {
    payload.follow_up_completed = followUpCompleted;
  }

  if (contactStatus !== undefined) {
    payload.contact_status = contactStatus || null;
  }

  const { data, error } = await supabase
    .from(ACTION_QUEUE_STATUS_TABLE)
    .upsert(payload, { onConflict: "agent_id,action_key" })
    .select("agent_id, owner_user_id, action_key, status, note, outcome, next_step, follow_up_needed, follow_up_completed, contact_status, updated_at")
    .single();

  if (error) {
    if (isUnavailablePersistenceError(error)) {
      console.error("[action queue] Persistence schema unavailable while saving status:", {
        agentId,
        ownerUserId,
        actionKey,
        code: error.code || null,
        message: error.message || "Unknown error",
      });
      throw buildPersistenceUnavailableError();
    }

    console.error(error);
    throw error;
  }

  console.log("[action queue] Persisted status update:", {
    agentId,
    ownerUserId,
    actionKey,
    previousStatus,
    nextStatus: status,
    followUpNeeded: payload.follow_up_needed ?? null,
    followUpCompleted: payload.follow_up_completed ?? null,
    contactStatus: payload.contact_status ?? null,
  });

  return {
    item: normalizePersistedItem(data),
    persistenceAvailable: true,
  };
}
