import { createHash } from "node:crypto";

import {
  FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE,
} from "../../config/constants.js";
import { getRagConfig } from "../../config/env.js";
import { getStoredWebsiteContent } from "../scraping/websiteContentService.js";
import { getOperatorBusinessProfile } from "../operator/operatorBusinessProfileService.js";
import {
  listFrontDeskTrainingItems,
} from "../training/frontDeskTrainingService.js";
import { cleanText } from "../../utils/text.js";

const MATCH_RPC = "match_front_desk_knowledge_chunks";
const SOURCE_TYPES = new Set(["website", "business_profile", "approved_answer", "manual"]);

function safeJson(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isMissingRagStorageError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01" ||
    error?.code === "42883" ||
    message.includes(FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE) ||
    message.includes(MATCH_RPC)
  );
}

export function normalizeKnowledgeText(value = "") {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashKnowledgeContent(value = "") {
  return createHash("sha256")
    .update(normalizeKnowledgeText(value), "utf8")
    .digest("hex");
}

export function chunkKnowledgeText(text = "", options = {}) {
  const config = {
    maxChunkChars: options.maxChunkChars || getRagConfig().maxChunkChars,
    chunkOverlapChars: options.chunkOverlapChars ?? getRagConfig().chunkOverlapChars,
  };
  config.chunkOverlapChars = Math.min(config.chunkOverlapChars, Math.max(0, config.maxChunkChars - 50));
  const normalized = normalizeKnowledgeText(text);

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((entry) => cleanText(entry))
    .filter(Boolean);
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    const next = normalizeKnowledgeText(current);
    if (next) {
      chunks.push(next);
    }
    current = "";
  };

  paragraphs.forEach((paragraph) => {
    if (paragraph.length > config.maxChunkChars) {
      pushCurrent();
      for (let cursor = 0; cursor < paragraph.length; cursor += config.maxChunkChars - config.chunkOverlapChars) {
        chunks.push(paragraph.slice(cursor, cursor + config.maxChunkChars).trim());
      }
      return;
    }

    const candidate = [current, paragraph].filter(Boolean).join("\n\n");
    if (candidate.length > config.maxChunkChars) {
      pushCurrent();
      current = paragraph;
      return;
    }

    current = candidate;
  });

  pushCurrent();

  if (config.chunkOverlapChars <= 0 || chunks.length <= 1) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }

    const overlap = chunks[index - 1].slice(-config.chunkOverlapChars);
    return normalizeKnowledgeText(`${overlap}\n\n${chunk}`).slice(0, config.maxChunkChars);
  });
}

export async function createEmbedding(openai, input, options = {}) {
  const config = {
    ...getRagConfig(),
    ...options,
  };

  if (!config.embeddingsEnabled) {
    return null;
  }

  if (!openai?.embeddings?.create) {
    const error = new Error("OpenAI embeddings are unavailable.");
    error.code = "openai_embeddings_unavailable";
    throw error;
  }

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: normalizeKnowledgeText(input),
  });
  const embedding = response?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== config.embeddingDimensions) {
    const error = new Error(
      `Embedding dimension mismatch for ${config.embeddingModel}; expected ${config.embeddingDimensions}.`
    );
    error.code = "embedding_dimension_mismatch";
    throw error;
  }

  return embedding;
}

function normalizeSourceType(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return SOURCE_TYPES.has(normalized) ? normalized : "manual";
}

async function listExistingSourceChunks(supabase, {
  agentId,
  ownerUserId,
  sourceType,
  sourceId,
}) {
  const { data, error } = await supabase
    .from(FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE)
    .select("id, source_type, source_id, content_hash, chunk_index, embedding, embedding_model, is_active")
    .eq("agent_id", cleanText(agentId))
    .eq("owner_user_id", cleanText(ownerUserId))
    .eq("source_type", normalizeSourceType(sourceType))
    .eq("source_id", cleanText(sourceId));

  if (error) {
    if (isMissingRagStorageError(error)) {
      return [];
    }
    throw error;
  }

  return data || [];
}

export async function deactivateKnowledgeSource(supabase, {
  agentId,
  ownerUserId,
  sourceType,
  sourceId,
}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    return { deactivated: 0 };
  }

  const { data, error } = await supabase
    .from(FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", normalizedAgentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .eq("source_type", normalizeSourceType(sourceType))
    .eq("source_id", cleanText(sourceId))
    .select("id");

  if (error) {
    if (isMissingRagStorageError(error)) {
      return { deactivated: 0, storageUnavailable: true };
    }
    throw error;
  }

  return { deactivated: (data || []).length };
}

export async function upsertKnowledgeSourceChunks(supabase, openai, {
  agentId,
  ownerUserId,
  sourceType,
  sourceId,
  sourceUrl = "",
  title = "",
  content = "",
  metadata = {},
} = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedSourceId = cleanText(sourceId);
  const config = getRagConfig();
  const chunks = chunkKnowledgeText(content, config);
  const result = {
    chunksCreated: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
    embeddingsCreated: 0,
    errors: [],
  };

  if (!normalizedAgentId || !normalizedOwnerUserId || !normalizedSourceId) {
    result.errors.push("agent_id, owner_user_id, and source_id are required for RAG indexing.");
    return result;
  }

  await deactivateKnowledgeSource(supabase, {
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
  });

  if (!chunks.length) {
    return result;
  }

  const existing = await listExistingSourceChunks(supabase, {
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.content_hash}:${row.chunk_index}`, row])
  );
  const now = new Date().toISOString();
  const rows = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const contentHash = hashKnowledgeContent(chunk);
    const existingRow = existingByKey.get(`${contentHash}:${index}`);
    let embedding = existingRow?.embedding || null;
    let embeddingModel = existingRow?.embedding_model || null;

    if (embedding && embeddingModel === config.embeddingModel) {
      result.chunksSkipped += 1;
    } else if (config.embeddingsEnabled) {
      try {
        embedding = await createEmbedding(openai, chunk, config);
        embeddingModel = config.embeddingModel;
        result.embeddingsCreated += 1;
      } catch (error) {
        result.errors.push(error?.message || "Embedding failed.");
        embedding = existingRow?.embedding || null;
        embeddingModel = existingRow?.embedding_model || null;
      }
    }

    rows.push({
      owner_user_id: normalizedOwnerUserId,
      agent_id: normalizedAgentId,
      source_type: normalizedSourceType,
      source_id: normalizedSourceId,
      source_url: cleanText(sourceUrl) || null,
      title: cleanText(title).slice(0, 300) || null,
      content: chunk,
      content_hash: contentHash,
      chunk_index: index,
      metadata: {
        ...safeJson(metadata),
        character_count: chunk.length,
      },
      embedding: embedding || null,
      embedding_model: embeddingModel || null,
      is_active: true,
      updated_at: now,
      created_at: now,
    });
  }

  const { data, error } = await supabase
    .from(FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE)
    .upsert(rows, {
      onConflict: "agent_id,source_type,source_id,content_hash,chunk_index",
    })
    .select("id");

  if (error) {
    if (isMissingRagStorageError(error)) {
      result.errors.push("Front Desk RAG storage is not available. Apply the RAG migration.");
      return result;
    }
    throw error;
  }

  const affected = (data || []).length || rows.length;
  result.chunksUpdated = Math.min(result.chunksSkipped, affected);
  result.chunksCreated = Math.max(0, affected - result.chunksUpdated);
  return result;
}

function formatObjectList(label, entries = [], fields = []) {
  const lines = entries
    .map((entry) => fields
      .map((field) => cleanText(entry?.[field]))
      .filter(Boolean)
      .join(" - "))
    .filter(Boolean);

  return lines.length ? `${label}:\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
}

export function buildBusinessProfileKnowledgeText(profile = {}) {
  const sections = [
    cleanText(profile.businessSummary) ? `Business summary:\n${cleanText(profile.businessSummary)}` : "",
    formatObjectList("Services", profile.services, ["name", "note"]),
    formatObjectList("Pricing", profile.pricing, ["label", "amount", "details"]),
    formatObjectList("Policies", profile.policies, ["label", "details"]),
    formatObjectList("Service areas", profile.serviceAreas, ["name", "note"]),
    formatObjectList("Operating hours", profile.operatingHours, ["label", "hours"]),
    Array.isArray(profile.approvedContactChannels) && profile.approvedContactChannels.length
      ? `Approved contact channels:\n${profile.approvedContactChannels.map((channel) => `- ${cleanText(channel)}`).join("\n")}`
      : "",
  ].filter(Boolean);

  return sections.join("\n\n");
}

export async function syncApprovedAnswerKnowledgeChunk(supabase, openai, {
  item,
  agentId,
  ownerUserId,
} = {}) {
  const normalizedAgentId = cleanText(agentId || item?.agentId || item?.agent_id);
  const normalizedOwnerUserId = cleanText(ownerUserId || item?.ownerId || item?.owner_id);
  const sourceId = cleanText(item?.id);
  const status = cleanText(item?.status).toLowerCase();
  const type = cleanText(item?.type).toLowerCase();

  if (!sourceId || status !== "active" || type !== "approved_answer") {
    return deactivateKnowledgeSource(supabase, {
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      sourceType: "approved_answer",
      sourceId,
    });
  }

  const content = [
    `Use when: ${cleanText(item.triggerText || item.trigger_text || item.title)}`,
    `Approved answer: ${cleanText(item.answerText || item.answer_text)}`,
    Array.isArray(item.tags) && item.tags.length ? `Tags: ${item.tags.map(cleanText).filter(Boolean).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return upsertKnowledgeSourceChunks(supabase, openai, {
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    sourceType: "approved_answer",
    sourceId,
    title: item.title || item.triggerText || item.trigger_text,
    content,
    metadata: {
      training_item_id: sourceId,
      status,
    },
  });
}

export async function reindexFrontDeskKnowledge(supabase, openai, {
  agent,
  ownerUserId,
  websiteContent = null,
  businessProfile = null,
} = {}) {
  const normalizedOwnerUserId = cleanText(ownerUserId || agent?.ownerUserId || agent?.owner_user_id);
  const normalizedAgentId = cleanText(agent?.id);
  const result = {
    chunksCreated: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
    embeddingsCreated: 0,
    errors: [],
    sources: {},
  };

  const merge = (source, sourceResult = {}) => {
    result.sources[source] = sourceResult;
    result.chunksCreated += Number(sourceResult.chunksCreated || 0);
    result.chunksUpdated += Number(sourceResult.chunksUpdated || 0);
    result.chunksSkipped += Number(sourceResult.chunksSkipped || 0);
    result.embeddingsCreated += Number(sourceResult.embeddingsCreated || 0);
    result.errors.push(...(sourceResult.errors || []));
  };

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    result.errors.push("agent and owner context are required for RAG reindex.");
    return result;
  }

  const resolvedWebsiteContent = websiteContent || (
    cleanText(agent?.businessId || agent?.business_id)
      ? await getStoredWebsiteContent(supabase, agent.businessId || agent.business_id)
      : null
  );

  if (resolvedWebsiteContent?.content) {
    merge("website", await upsertKnowledgeSourceChunks(supabase, openai, {
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      sourceType: "website",
      sourceId: cleanText(resolvedWebsiteContent.businessId || agent.businessId || agent.business_id),
      sourceUrl: resolvedWebsiteContent.websiteUrl,
      title: resolvedWebsiteContent.pageTitle,
      content: resolvedWebsiteContent.content,
      metadata: {
        page_count: resolvedWebsiteContent.pageCount || 0,
        crawled_urls: resolvedWebsiteContent.crawledUrls || [],
      },
    }));
  }

  const resolvedProfile = businessProfile || await getOperatorBusinessProfile(supabase, {
    agent,
    ownerUserId: normalizedOwnerUserId,
  }).catch(() => null);
  const businessProfileText = buildBusinessProfileKnowledgeText(resolvedProfile || {});

  if (businessProfileText) {
    merge("business_profile", await upsertKnowledgeSourceChunks(supabase, openai, {
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      sourceType: "business_profile",
      sourceId: cleanText(resolvedProfile?.id) || normalizedAgentId,
      title: "Business profile facts",
      content: businessProfileText,
      metadata: {
        profile_id: cleanText(resolvedProfile?.id),
      },
    }));
  }

  const trainingResult = await listFrontDeskTrainingItems(supabase, {
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    type: "approved_answer",
    status: "active",
  }).catch((error) => {
    result.errors.push(error?.message || "Could not load approved answers.");
    return { items: [] };
  });

  for (const item of trainingResult.items || []) {
    merge(`approved_answer:${item.id}`, await syncApprovedAnswerKnowledgeChunk(supabase, openai, {
      item,
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
    }));
  }

  return {
    ok: result.errors.length === 0,
    ...result,
  };
}

function mapKnowledgeChunk(row = {}) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    agentId: row.agent_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    title: row.title,
    content: row.content,
    contentHash: row.content_hash,
    chunkIndex: row.chunk_index,
    metadata: safeJson(row.metadata),
    embeddingModel: row.embedding_model,
    similarity: Number(row.similarity || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRetrievalConfidence({
  approvedAnswerCount = 0,
  semanticChunks = [],
  usedKeywordFallback = false,
  businessProfileFacts = "",
} = {}) {
  const config = getRagConfig();

  if (approvedAnswerCount > 0) {
    return "high";
  }

  const bestSimilarity = Math.max(0, ...semanticChunks.map((chunk) => Number(chunk.similarity || 0)));

  if (bestSimilarity >= config.strongSimilarity) {
    return "high";
  }

  if (bestSimilarity >= config.minSimilarity || cleanText(businessProfileFacts)) {
    return "medium";
  }

  if (usedKeywordFallback) {
    return "low";
  }

  return "none";
}

export async function retrieveSemanticKnowledge(supabase, openai, {
  agentId,
  ownerUserId,
  queryText,
  approvedAnswerCount = 0,
  businessProfileFacts = "",
} = {}) {
  const config = getRagConfig();
  const emptyResult = {
    chunks: [],
    confidence: getRetrievalConfidence({ approvedAnswerCount, businessProfileFacts }),
    sourceLabels: [],
    semanticAvailable: false,
    error: "",
  };

  if (!config.embeddingsEnabled || !cleanText(queryText) || !cleanText(agentId) || !cleanText(ownerUserId)) {
    return emptyResult;
  }

  let queryEmbedding;
  try {
    queryEmbedding = await createEmbedding(openai, queryText, config);
  } catch (error) {
    return {
      ...emptyResult,
      error: error?.message || "Query embedding failed.",
    };
  }

  if (!supabase?.rpc) {
    return {
      ...emptyResult,
      error: "Supabase RPC is unavailable.",
    };
  }

  const { data, error } = await supabase.rpc(MATCH_RPC, {
    query_embedding: queryEmbedding,
    match_owner_user_id: cleanText(ownerUserId),
    match_agent_id: cleanText(agentId),
    match_count: config.maxContextChunks,
    min_similarity: config.minSimilarity,
  });

  if (error) {
    if (isMissingRagStorageError(error)) {
      return {
        ...emptyResult,
        error: "Front Desk semantic storage is not available.",
      };
    }
    throw error;
  }

  const chunks = (data || []).map(mapKnowledgeChunk);
  const sourceLabels = [...new Set(chunks.map((chunk) => chunk.sourceType).filter(Boolean))];

  return {
    chunks,
    confidence: getRetrievalConfidence({
      approvedAnswerCount,
      semanticChunks: chunks,
      businessProfileFacts,
    }),
    sourceLabels,
    semanticAvailable: true,
    error: "",
  };
}

export async function countActiveKnowledgeChunks(supabase, {
  agentId,
  ownerUserId,
} = {}) {
  const { count, error } = await supabase
    .from(FRONT_DESK_KNOWLEDGE_CHUNKS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("agent_id", cleanText(agentId))
    .eq("owner_user_id", cleanText(ownerUserId))
    .eq("is_active", true);

  if (error) {
    if (isMissingRagStorageError(error)) {
      return {
        count: 0,
        storageUnavailable: true,
      };
    }
    throw error;
  }

  return {
    count: Number(count || 0),
    storageUnavailable: false,
  };
}
