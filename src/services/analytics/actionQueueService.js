import { ACTION_QUEUE_STATUS_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const ACTION_QUEUE_STATUSES = ["new", "reviewed", "done", "dismissed"];

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

function normalizeQuestion(message) {
  return cleanText(String(message || ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMessageTimestamp(message) {
  const value = new Date(message?.createdAt || message?.created_at || "").getTime();
  return Number.isFinite(value) ? value : 0;
}

function getChronologicalMessages(messages = []) {
  return [...messages].sort((left, right) => getMessageTimestamp(left) - getMessageTimestamp(right));
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

function extractContactInfo(text = "") {
  const normalized = String(text || "");
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = normalized.match(/(?:\+?\d[\d().\-\s]{6,}\d)/);

  return {
    email: emailMatch ? cleanText(emailMatch[0]) : "",
    phone: phoneMatch ? cleanText(phoneMatch[0]) : "",
  };
}

function mergeContactInfo(existing = {}, next = {}) {
  return {
    email: existing.email || next.email || "",
    phone: existing.phone || next.phone || "",
  };
}

function buildStatusSummary(items = []) {
  const summary = {
    total: items.length,
    new: 0,
    reviewed: 0,
    done: 0,
    dismissed: 0,
  };

  items.forEach((item) => {
    const status = normalizeStatus(item.status);
    summary[status] += 1;
  });

  return summary;
}

export function buildActionQueue(messages = [], persistedStatuses = []) {
  const statusMap = new Map(
    (persistedStatuses || []).map((item) => [
      cleanText(item.actionKey || item.action_key),
      normalizeStatus(item.status),
    ])
  );
  const grouped = {
    contact: [],
    booking: [],
    pricing: [],
    support: [],
    weak_answer: [],
  };
  const chronological = getChronologicalMessages(messages);

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

    for (let cursor = index + 1; cursor < chronological.length; cursor += 1) {
      const nextMessage = chronological[cursor];

      if (nextMessage.role === "user") {
        break;
      }

      if (nextMessage.role === "assistant") {
        reply = cleanText(nextMessage.content || "");
        break;
      }
    }

    const event = {
      question,
      reply,
      createdAt: message.createdAt || message.created_at || null,
      contactInfo: mergeContactInfo(extractContactInfo(question), extractContactInfo(reply)),
    };

    if (grouped[intent]) {
      grouped[intent].push(event);
    }

    if (hasWeakAssistantReply(reply)) {
      grouped.weak_answer.push(event);
    }
  });

  const buildItem = (key, type, events) => {
    if (!events.length) {
      return null;
    }

    const latest = [...events].sort((left, right) => getMessageTimestamp(right) - getMessageTimestamp(left))[0];
    const combinedContactInfo = events.reduce(
      (current, event) => mergeContactInfo(current, event.contactInfo),
      { email: "", phone: "" }
    );

    return {
      key,
      type,
      label: type === "weak_answer" ? "Weak answers" : getIntentLabel(type),
      status: statusMap.get(key) || "new",
      count: events.length,
      snippet: latest.question,
      whyFlagged: getFlaggedReason(type, events.length),
      suggestedAction: getSuggestedAction(type),
      lastSeenAt: latest.createdAt || null,
      contactCaptured: Boolean(combinedContactInfo.email || combinedContactInfo.phone),
      contactInfo: combinedContactInfo.email || combinedContactInfo.phone
        ? {
            email: combinedContactInfo.email || null,
            phone: combinedContactInfo.phone || null,
          }
        : null,
    };
  };

  const items = [
    buildItem("intent:contact", "contact", grouped.contact),
    buildItem("intent:booking", "booking", grouped.booking),
    buildItem("intent:pricing", "pricing", grouped.pricing),
    buildItem("intent:support", "support", grouped.support),
    buildItem("signal:weak_answer", "weak_answer", grouped.weak_answer),
  ]
    .filter(Boolean)
    .sort((left, right) => getMessageTimestamp({ createdAt: right.lastSeenAt }) - getMessageTimestamp({ createdAt: left.lastSeenAt }));

  return {
    items,
    summary: buildStatusSummary(items),
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
    .select("agent_id, owner_user_id, action_key, status, updated_at")
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId);

  if (error) {
    if (isMissingRelationError(error, ACTION_QUEUE_STATUS_TABLE)) {
      return [];
    }

    console.error(error);
    throw error;
  }

  return (data || []).map((row) => ({
    agentId: row.agent_id,
    ownerUserId: row.owner_user_id,
    actionKey: row.action_key,
    status: normalizeStatus(row.status),
    updatedAt: row.updated_at || null,
  }));
}

export async function updateActionQueueStatus(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const actionKey = cleanText(options.actionKey);
  const status = normalizeStatus(options.status);

  if (!agentId || !ownerUserId || !actionKey) {
    const error = new Error("agent_id, owner_user_id, and action_key are required");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(ACTION_QUEUE_STATUS_TABLE)
    .upsert(
      {
        agent_id: agentId,
        owner_user_id: ownerUserId,
        action_key: actionKey,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,action_key" }
    )
    .select("agent_id, owner_user_id, action_key, status, updated_at")
    .single();

  if (error) {
    if (isMissingRelationError(error, ACTION_QUEUE_STATUS_TABLE)) {
      return {
        agentId,
        ownerUserId,
        actionKey,
        status,
        updatedAt: new Date().toISOString(),
      };
    }

    console.error(error);
    throw error;
  }

  return {
    agentId: data.agent_id,
    ownerUserId: data.owner_user_id,
    actionKey: data.action_key,
    status: normalizeStatus(data.status),
    updatedAt: data.updated_at || null,
  };
}
