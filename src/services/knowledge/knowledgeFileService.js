import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  AGENT_KNOWLEDGE_FILE_TABLE,
} from "../../config/constants.js";
import {
  deactivateKnowledgeSource,
  hashKnowledgeContent,
  normalizeKnowledgeText,
  upsertKnowledgeSourceChunks,
} from "../rag/frontDeskRagService.js";
import { cleanText } from "../../utils/text.js";

export const KNOWLEDGE_FILE_UPLOAD_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxExtractedTextChars: 200000,
});

export const SUPPORTED_KNOWLEDGE_FILE_TYPES = Object.freeze({
  txt: Object.freeze({
    mimeTypes: new Set(["text/plain", "application/octet-stream"]),
    label: "TXT",
  }),
  md: Object.freeze({
    mimeTypes: new Set(["text/markdown", "text/x-markdown", "text/plain", "application/octet-stream"]),
    label: "Markdown",
  }),
  csv: Object.freeze({
    mimeTypes: new Set(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"]),
    label: "CSV",
  }),
  json: Object.freeze({
    mimeTypes: new Set(["application/json", "text/json", "text/plain", "application/octet-stream"]),
    label: "JSON",
  }),
});

const KNOWLEDGE_FILE_SELECT = [
  "id",
  "owner_user_id",
  "agent_id",
  "original_filename",
  "stored_filename",
  "file_extension",
  "mime_type",
  "byte_size",
  "content_hash",
  "extracted_character_count",
  "chunk_count",
  "status",
  "error_message",
  "metadata",
  "archived_at",
  "last_indexed_at",
  "created_at",
  "updated_at",
].join(", ");

function safeJson(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getExtension(filename = "") {
  const match = cleanText(filename).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function sanitizeKnowledgeFileName(filename = "") {
  const normalized = cleanText(filename)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 120);

  return normalized || "knowledge-file";
}

function createHttpError(message, statusCode = 400, code = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (_error) {
    throw createHttpError("Upload a UTF-8 text, Markdown, CSV, or JSON file.", 400, "knowledge_file_invalid_encoding");
  }
}

function normalizeExtractedText(rawText = "", extension = "") {
  const withoutBom = String(rawText || "").replace(/^\uFEFF/, "");

  if (extension === "json") {
    try {
      const parsed = JSON.parse(withoutBom);
      return normalizeKnowledgeText(JSON.stringify(parsed, null, 2));
    } catch (_error) {
      throw createHttpError("Upload valid JSON or use TXT, Markdown, or CSV.", 400, "knowledge_file_invalid_json");
    }
  }

  return normalizeKnowledgeText(withoutBom);
}

export function validateKnowledgeFileUpload(file = {}, options = {}) {
  const limits = {
    ...KNOWLEDGE_FILE_UPLOAD_LIMITS,
    ...safeJson(options.limits),
  };
  const originalFilename = sanitizeKnowledgeFileName(file.filename || file.originalname || "");
  const extension = getExtension(originalFilename);
  const config = SUPPORTED_KNOWLEDGE_FILE_TYPES[extension];
  const mimeType = cleanText(file.contentType || file.mimetype).toLowerCase();
  const size = Number(file.size || file.buffer?.length || 0);

  if (!config) {
    throw createHttpError("Upload a TXT, Markdown, CSV, or JSON knowledge file.", 400, "knowledge_file_type_unsupported");
  }

  if (!mimeType || !config.mimeTypes.has(mimeType)) {
    throw createHttpError("The file type does not match the supported knowledge formats.", 400, "knowledge_file_mime_unsupported");
  }

  if (!size || size > limits.maxBytes) {
    throw createHttpError("Use a knowledge file under 1 MB.", 413, "knowledge_file_too_large");
  }

  if (!Buffer.isBuffer(file.buffer)) {
    throw createHttpError("Upload a knowledge file.", 400, "knowledge_file_missing");
  }

  const text = normalizeExtractedText(decodeUtf8(file.buffer), extension);

  if (!text) {
    throw createHttpError("The uploaded file did not contain usable text.", 400, "knowledge_file_empty");
  }

  if (text.length > limits.maxExtractedTextChars) {
    throw createHttpError("Use a shorter knowledge file under 200,000 extracted characters.", 413, "knowledge_file_text_too_large");
  }

  return {
    originalFilename,
    storedFilename: `${Date.now()}-${randomUUID()}-${originalFilename}`,
    extension,
    mimeType,
    size,
    text,
    contentHash: hashKnowledgeContent(text),
  };
}

function mapKnowledgeFileRow(row = {}) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    agentId: row.agent_id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    fileExtension: row.file_extension,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size || 0),
    contentHash: row.content_hash,
    extractedCharacterCount: Number(row.extracted_character_count || 0),
    chunkCount: Number(row.chunk_count || 0),
    status: row.status,
    errorMessage: row.error_message,
    metadata: safeJson(row.metadata),
    archivedAt: row.archived_at,
    lastIndexedAt: row.last_indexed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sourceIdForKnowledgeFile(fileId = "") {
  return `knowledge_file:${cleanText(fileId)}`;
}

async function updateKnowledgeFileRow(supabase, {
  fileId,
  agentId,
  ownerUserId,
  patch,
}) {
  const { data, error } = await supabase
    .from(AGENT_KNOWLEDGE_FILE_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleanText(fileId))
    .eq("agent_id", cleanText(agentId))
    .eq("owner_user_id", cleanText(ownerUserId))
    .select(KNOWLEDGE_FILE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError("Knowledge file not found.", 404, "knowledge_file_not_found");
  }

  return mapKnowledgeFileRow(data);
}

export async function listKnowledgeFiles(supabase, {
  agentId,
  ownerUserId,
  status = "",
  limit = 50,
} = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    throw createHttpError("agent_id and owner_user_id are required.", 400, "knowledge_file_scope_required");
  }

  let query = supabase
    .from(AGENT_KNOWLEDGE_FILE_TABLE)
    .select(KNOWLEDGE_FILE_SELECT)
    .eq("agent_id", normalizedAgentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit || 50), 100)));

  const normalizedStatus = cleanText(status).toLowerCase();
  if (normalizedStatus) {
    query = query.eq("status", normalizedStatus);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return {
    files: (data || []).map(mapKnowledgeFileRow),
  };
}

export async function uploadKnowledgeFile(supabase, openai, {
  agent,
  ownerUserId,
  file,
} = {}) {
  const normalizedAgentId = cleanText(agent?.id || agent?.agent_id);
  const normalizedOwnerUserId = cleanText(ownerUserId || agent?.ownerUserId || agent?.owner_user_id);

  if (!normalizedAgentId || !normalizedOwnerUserId) {
    throw createHttpError("Authenticated owner and agent are required.", 401, "knowledge_file_owner_required");
  }

  const validated = validateKnowledgeFileUpload(file);
  const now = new Date().toISOString();
  const insertPayload = {
    owner_user_id: normalizedOwnerUserId,
    agent_id: normalizedAgentId,
    original_filename: validated.originalFilename,
    stored_filename: validated.storedFilename,
    file_extension: validated.extension,
    mime_type: validated.mimeType,
    byte_size: validated.size,
    content_hash: validated.contentHash,
    extracted_character_count: validated.text.length,
    chunk_count: 0,
    status: "indexing",
    error_message: null,
    metadata: {
      source: "owner_uploaded_file",
      supported_format: validated.extension,
      trusted_owner_context: true,
    },
    archived_at: null,
    last_indexed_at: null,
    created_at: now,
    updated_at: now,
  };
  const { data: createdRow, error: insertError } = await supabase
    .from(AGENT_KNOWLEDGE_FILE_TABLE)
    .insert(insertPayload)
    .select(KNOWLEDGE_FILE_SELECT)
    .single();

  if (insertError) {
    throw insertError;
  }

  const createdFile = mapKnowledgeFileRow(createdRow);
  const sourceId = sourceIdForKnowledgeFile(createdFile.id);
  const sourceTitle = validated.originalFilename;

  try {
    const indexResult = await upsertKnowledgeSourceChunks(supabase, openai, {
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      sourceType: "manual",
      sourceId,
      title: sourceTitle,
      content: validated.text,
      metadata: {
        origin: "uploaded_knowledge_file",
        knowledge_file_id: createdFile.id,
        filename: validated.originalFilename,
        file_extension: validated.extension,
        mime_type: validated.mimeType,
        byte_size: validated.size,
        content_hash: validated.contentHash,
        trusted_owner_context: true,
      },
    });
    const chunkCount = Number(indexResult.chunksCreated || 0)
      + Number(indexResult.chunksUpdated || 0)
      + Number(indexResult.chunksSkipped || 0);

    if ((indexResult.errors || []).length) {
      const failedFile = await updateKnowledgeFileRow(supabase, {
        fileId: createdFile.id,
        agentId: normalizedAgentId,
        ownerUserId: normalizedOwnerUserId,
        patch: {
          status: "failed",
          chunk_count: chunkCount,
          error_message: indexResult.errors.join("; ").slice(0, 1000),
        },
      });

      return {
        ok: false,
        file: failedFile,
        indexResult,
      };
    }

    const readyFile = await updateKnowledgeFileRow(supabase, {
      fileId: createdFile.id,
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      patch: {
        status: "ready",
        chunk_count: chunkCount,
        error_message: null,
        last_indexed_at: new Date().toISOString(),
      },
    });

    return {
      ok: true,
      file: readyFile,
      indexResult,
    };
  } catch (error) {
    const failedFile = await updateKnowledgeFileRow(supabase, {
      fileId: createdFile.id,
      agentId: normalizedAgentId,
      ownerUserId: normalizedOwnerUserId,
      patch: {
        status: "failed",
        error_message: cleanText(error?.message || "Knowledge file indexing failed.").slice(0, 1000),
      },
    });

    return {
      ok: false,
      file: failedFile,
      indexResult: {
        errors: [error?.message || "Knowledge file indexing failed."],
      },
    };
  }
}

export async function archiveKnowledgeFile(supabase, {
  agentId,
  ownerUserId,
  fileId,
} = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const normalizedFileId = cleanText(fileId);

  if (!normalizedAgentId || !normalizedOwnerUserId || !normalizedFileId) {
    throw createHttpError("agent_id, owner_user_id, and file_id are required.", 400, "knowledge_file_archive_scope_required");
  }

  const { data: existing, error: lookupError } = await supabase
    .from(AGENT_KNOWLEDGE_FILE_TABLE)
    .select(KNOWLEDGE_FILE_SELECT)
    .eq("id", normalizedFileId)
    .eq("agent_id", normalizedAgentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!existing) {
    throw createHttpError("Knowledge file not found.", 404, "knowledge_file_not_found");
  }

  const deactivation = await deactivateKnowledgeSource(supabase, {
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    sourceType: "manual",
    sourceId: sourceIdForKnowledgeFile(normalizedFileId),
  });
  const archivedFile = await updateKnowledgeFileRow(supabase, {
    fileId: normalizedFileId,
    agentId: normalizedAgentId,
    ownerUserId: normalizedOwnerUserId,
    patch: {
      status: "archived",
      archived_at: new Date().toISOString(),
      error_message: null,
    },
  });

  return {
    ok: true,
    file: archivedFile,
    chunksDeactivated: Number(deactivation.deactivated || 0),
  };
}

export function fingerprintKnowledgeFileBuffer(buffer) {
  return createHash("sha256")
    .update(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ""), "utf8"))
    .digest("hex");
}
