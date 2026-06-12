import { cleanText } from "../utils/text.js";

export function expandGroupedFollowUpItems(queue = {}) {
  const items = Array.isArray(queue.items) ? queue.items : [];
  const expandedItems = [];

  items.forEach((item) => {
    expandedItems.push(item);

    const groupedCount = Number(item.count || 0);
    const actionType = String(item.actionType || "").trim().toLowerCase();

    if (
      groupedCount < 2
      || !item.followUp?.id
      || !["lead_follow_up", "pricing_interest", "booking_intent"].includes(actionType)
    ) {
      return;
    }

    const evidence = item.evidence && typeof item.evidence === "object" ? item.evidence : {};
    const questions = Array.isArray(evidence.questions) ? evidence.questions : [];
    const replies = Array.isArray(evidence.replies) ? evidence.replies : [];
    const snippets = Array.isArray(evidence.snippets) ? evidence.snippets : [];

    for (let index = 1; index < groupedCount; index += 1) {
      expandedItems.push({
        ...item,
        key: `${item.key}:linked-${index}`,
        count: 1,
        question: questions[index] || item.question,
        reply: replies[index] || item.reply,
        snippet: snippets[index] || item.snippet,
        evidence: {
          ...evidence,
          interactionCount: 1,
          question: questions[index] || item.question,
          reply: replies[index] || item.reply,
          questions: questions[index] ? [questions[index]] : [],
          replies: replies[index] ? [replies[index]] : [],
          snippets: snippets[index] ? [snippets[index]] : [],
        },
      });
    }
  });

  if (expandedItems.length === items.length) {
    return queue;
  }

  return {
    ...queue,
    items: expandedItems,
  };
}

export function createTrackOwnerProductEvent(trackProductEventImpl) {
  return async function trackOwnerProductEvent(supabase, {
    agentId,
    ownerUserId = "",
    clientId = "",
    eventName,
    source,
    metadata = {},
    dedupeKey = "",
  } = {}) {
    const resolvedAgentId = cleanText(agentId);
    const resolvedOwnerUserId = cleanText(ownerUserId);
    const resolvedClientId = cleanText(clientId) || (resolvedOwnerUserId ? `owner:${resolvedOwnerUserId}` : `agent:${resolvedAgentId}`);

    if (!resolvedClientId || !eventName) {
      return null;
    }

    return trackProductEventImpl(supabase, {
      clientId: resolvedClientId,
      agentId: resolvedAgentId,
      ownerUserId: resolvedOwnerUserId,
      eventName,
      source,
      metadata,
      dedupeKey,
    }).catch((error) => {
      console.warn("[product-event] tracking skipped", {
        eventName,
        agentId: resolvedAgentId || null,
        ownerUserId: resolvedOwnerUserId || null,
        message: error?.message || "Unknown tracking error",
      });
      return null;
    });
  };
}

export function readBodyField(body, snakeCaseKey, camelCaseKey) {
  if (Object.prototype.hasOwnProperty.call(body, snakeCaseKey)) {
    return body[snakeCaseKey];
  }

  if (camelCaseKey && Object.prototype.hasOwnProperty.call(body, camelCaseKey)) {
    return body[camelCaseKey];
  }

  return undefined;
}

function getMultipartBoundary(req) {
  const contentType = cleanText(req.headers["content-type"] || req.headers["Content-Type"]);
  const match = contentType.match(/multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  return cleanText(match?.[1] || match?.[2]);
}

function parseContentDisposition(value = "") {
  const result = {};
  String(value || "").split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    const key = cleanText(rawKey).toLowerCase();
    if (!key || !rawValue.length) {
      return;
    }
    result[key] = rawValue.join("=").trim().replace(/^"|"$/g, "");
  });
  return result;
}

function findMultipartFile(buffer, boundary, acceptedNames = ["background", "file"]) {
  const toBuffer = Buffer["from"];
  const boundaryBuffer = toBuffer(`--${boundary}`);
  const headerSeparator = toBuffer("\r\n\r\n");
  let cursor = buffer.indexOf(boundaryBuffer);

  while (cursor >= 0) {
    const next = buffer.indexOf(boundaryBuffer, cursor + boundaryBuffer.length);
    if (next < 0) {
      break;
    }

    let part = buffer.subarray(cursor + boundaryBuffer.length, next);
    if (part[0] === 45 && part[1] === 45) {
      break;
    }
    if (part[0] === 13 && part[1] === 10) {
      part = part.subarray(2);
    }
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(headerSeparator);
    if (headerEnd >= 0) {
      const headerText = part.subarray(0, headerEnd).toString("latin1");
      const body = part.subarray(headerEnd + headerSeparator.length);
      const headers = Object.fromEntries(headerText.split("\r\n").map((line) => {
        const separator = line.indexOf(":");
        return separator >= 0
          ? [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]
          : ["", ""];
      }).filter(([key]) => key));
      const disposition = parseContentDisposition(headers["content-disposition"]);

      if (acceptedNames.includes(disposition.name) && disposition.filename) {
        return {
          fieldName: disposition.name,
          filename: disposition.filename,
          contentType: cleanText(headers["content-type"]).toLowerCase(),
          buffer: body,
          size: body.length,
        };
      }
    }

    cursor = next;
  }

  return null;
}

export async function readMultipartFile(req, {
  maxBytes,
  fieldNames = ["file"],
  missingMessage = "Upload a file.",
  tooLargeMessage = "Uploaded file is too large.",
} = {}) {
  const boundary = getMultipartBoundary(req);
  if (!boundary) {
    const error = new Error("Use multipart/form-data with a file.");
    error.statusCode = 400;
    throw error;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes + 16384) {
    const error = new Error(tooLargeMessage);
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes + 16384) {
      const error = new Error(tooLargeMessage);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const file = findMultipartFile(Buffer.concat(chunks), boundary, fieldNames);
  if (!file) {
    const error = new Error(missingMessage);
    error.statusCode = 400;
    throw error;
  }

  return file;
}

export async function readMultipartBackgroundFile(req, { maxBytes }) {
  return readMultipartFile(req, {
    maxBytes,
    fieldNames: ["background", "file"],
    missingMessage: "Upload a background file.",
    tooLargeMessage: "Uploaded background file is too large.",
  });
}

export async function readMultipartKnowledgeFile(req, { maxBytes }) {
  return readMultipartFile(req, {
    maxBytes,
    fieldNames: ["knowledge_file", "file"],
    missingMessage: "Upload a knowledge file.",
    tooLargeMessage: "Uploaded knowledge file is too large.",
  });
}

export function getCheckoutDraftBusinessName(user) {
  const ownerUserId = String(user?.id || "").trim();
  const suffix = ownerUserId ? ownerUserId.slice(0, 8) : "owner";
  return `Vonza setup ${suffix}`;
}
