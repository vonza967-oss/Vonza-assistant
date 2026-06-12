import test from "node:test";
import assert from "node:assert/strict";

import {
  KNOWLEDGE_FILE_UPLOAD_LIMITS,
  archiveKnowledgeFile,
  listKnowledgeFiles,
  uploadKnowledgeFile,
  validateKnowledgeFileUpload,
} from "../src/services/knowledge/knowledgeFileService.js";

function withEnv(overrides, fn) {
  const previous = new Map();

  Object.entries(overrides).forEach(([key, value]) => {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      previous.forEach((value, key) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    });
}

function createKnowledgeFileSupabase(initialState = {}) {
  const state = {
    agent_knowledge_files: (initialState.agent_knowledge_files || []).map((row) => ({ ...row })),
    front_desk_knowledge_chunks: (initialState.front_desk_knowledge_chunks || []).map((row) => ({ ...row })),
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.values = null;
      this.orderBy = null;
      this.limitValue = null;
    }

    select() {
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = Array.isArray(values) ? values : [values];
      return this;
    }

    upsert(values) {
      this.operation = "upsert";
      this.values = Array.isArray(values) ? values : [values];
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    order(column, options = {}) {
      this.orderBy = { column, ascending: options.ascending !== false };
      return this;
    }

    limit(value) {
      this.limitValue = Number(value);
      return this;
    }

    single() {
      const result = this.#run();
      return Promise.resolve({
        data: result.data[0] || null,
        error: result.error,
      });
    }

    maybeSingle() {
      const result = this.#run();
      return Promise.resolve({
        data: result.data[0] || null,
        error: result.error,
      });
    }

    then(resolve, reject) {
      return Promise.resolve(this.#run()).then(resolve, reject);
    }

    #matches(row) {
      return this.filters.every((filter) => row[filter.column] === filter.value);
    }

    #run() {
      const rows = state[this.table] || [];

      if (this.operation === "insert") {
        const inserted = this.values.map((value) => {
          const next = {
            id: value.id || `file-${rows.length + 1}`,
            ...value,
          };
          rows.push(next);
          return { ...next };
        });
        return { data: inserted, error: null };
      }

      if (this.operation === "update") {
        const matches = rows.filter((row) => this.#matches(row));
        matches.forEach((row) => Object.assign(row, this.values));
        return { data: matches.map((row) => ({ ...row })), error: null };
      }

      if (this.operation === "upsert") {
        const affected = [];
        this.values.forEach((value) => {
          const existing = rows.find((row) =>
            row.agent_id === value.agent_id &&
            row.owner_user_id === value.owner_user_id &&
            row.source_type === value.source_type &&
            row.source_id === value.source_id &&
            row.content_hash === value.content_hash &&
            row.chunk_index === value.chunk_index
          );
          if (existing) {
            Object.assign(existing, value);
            affected.push(existing);
            return;
          }
          const next = {
            id: `chunk-${rows.length + 1}`,
            ...value,
          };
          rows.push(next);
          affected.push(next);
        });
        return { data: affected.map((row) => ({ id: row.id })), error: null };
      }

      let selected = rows.filter((row) => this.#matches(row));
      if (this.orderBy) {
        const direction = this.orderBy.ascending ? 1 : -1;
        selected = selected.slice().sort((left, right) =>
          String(left[this.orderBy.column] || "").localeCompare(String(right[this.orderBy.column] || "")) * direction
        );
      }
      if (Number.isFinite(this.limitValue)) {
        selected = selected.slice(0, this.limitValue);
      }
      return { data: selected.map((row) => ({ ...row })), error: null };
    }
  }

  return {
    state,
    from(table) {
      if (!state[table]) {
        state[table] = [];
      }
      return new Query(table);
    },
  };
}

function captureThrown(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail("Expected function to throw");
}

test("knowledge file validation rejects unsupported type, MIME mismatch, and oversize uploads", () => {
  assert.throws(
    () => validateKnowledgeFileUpload({
      filename: "pricing.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("pricing"),
    }),
    /TXT, Markdown, CSV, or JSON/
  );

  const mismatch = captureThrown(
    () => validateKnowledgeFileUpload({
      filename: "pricing.txt",
      contentType: "application/pdf",
      buffer: Buffer.from("pricing"),
    })
  );
  assert.match(mismatch.message, /file type does not match/i);
  assert.equal(mismatch.statusCode, 400);

  const tooLarge = captureThrown(
    () => validateKnowledgeFileUpload({
      filename: "pricing.txt",
      contentType: "text/plain",
      buffer: Buffer.alloc(KNOWLEDGE_FILE_UPLOAD_LIMITS.maxBytes + 1, "a"),
    })
  );
  assert.match(tooLarge.message, /under 1 MB/);
  assert.equal(tooLarge.statusCode, 413);
});

test("knowledge file upload persists metadata and creates owner-scoped manual RAG chunks", async () => {
  await withEnv({ RAG_EMBEDDINGS_ENABLED: "false", RAG_MAX_CHUNK_CHARS: "300", RAG_CHUNK_OVERLAP_CHARS: "0" }, async () => {
    const supabase = createKnowledgeFileSupabase();
    const result = await uploadKnowledgeFile(supabase, {}, {
      agent: { id: "agent-1", ownerUserId: "owner-1" },
      ownerUserId: "owner-1",
      file: {
        filename: "services.md",
        contentType: "text/markdown",
        buffer: Buffer.from("# Services\n\nEmergency bookings are available after triage.", "utf8"),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.originalFilename, "services.md");
    assert.equal(result.file.status, "ready");
    assert.equal(result.file.ownerUserId, "owner-1");
    assert.equal(result.file.agentId, "agent-1");
    assert.equal(result.indexResult.chunksCreated, 1);

    const [fileRow] = supabase.state.agent_knowledge_files;
    assert.equal(fileRow.status, "ready");
    assert.equal(fileRow.metadata.trusted_owner_context, true);
    assert.equal(fileRow.file_extension, "md");
    assert.ok(fileRow.extracted_character_count > 0);

    const [chunk] = supabase.state.front_desk_knowledge_chunks;
    assert.equal(chunk.agent_id, "agent-1");
    assert.equal(chunk.owner_user_id, "owner-1");
    assert.equal(chunk.source_type, "manual");
    assert.equal(chunk.source_id, `knowledge_file:${result.file.id}`);
    assert.equal(chunk.is_active, true);
    assert.equal(chunk.metadata.origin, "uploaded_knowledge_file");
    assert.equal(chunk.metadata.knowledge_file_id, result.file.id);
    assert.equal(chunk.metadata.trusted_owner_context, true);
    assert.match(chunk.content, /Emergency bookings/);
  });
});

test("knowledge files list by owner scope and archive deactivates corresponding chunks", async () => {
  await withEnv({ RAG_EMBEDDINGS_ENABLED: "false", RAG_MAX_CHUNK_CHARS: "300", RAG_CHUNK_OVERLAP_CHARS: "0" }, async () => {
    const supabase = createKnowledgeFileSupabase({
      agent_knowledge_files: [
        {
          id: "other-file",
          owner_user_id: "owner-2",
          agent_id: "agent-2",
          original_filename: "other.txt",
          stored_filename: "other.txt",
          file_extension: "txt",
          mime_type: "text/plain",
          byte_size: 5,
          content_hash: "other",
          extracted_character_count: 5,
          chunk_count: 0,
          status: "ready",
          metadata: {},
          created_at: "2026-06-10T00:00:00.000Z",
          updated_at: "2026-06-10T00:00:00.000Z",
        },
      ],
    });
    const upload = await uploadKnowledgeFile(supabase, {}, {
      agent: { id: "agent-1", ownerUserId: "owner-1" },
      ownerUserId: "owner-1",
      file: {
        filename: "profile.txt",
        contentType: "text/plain",
        buffer: Buffer.from("Owner-only delivery policy: invoices are sent after approval.", "utf8"),
      },
    });

    const listed = await listKnowledgeFiles(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      status: "ready",
    });
    assert.deepEqual(listed.files.map((file) => file.id), [upload.file.id]);

    const archive = await archiveKnowledgeFile(supabase, {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      fileId: upload.file.id,
    });

    assert.equal(archive.ok, true);
    assert.equal(archive.file.status, "archived");
    assert.equal(archive.chunksDeactivated, 1);
    assert.equal(
      supabase.state.front_desk_knowledge_chunks.find((chunk) => chunk.source_id === `knowledge_file:${upload.file.id}`).is_active,
      false
    );

    await assert.rejects(
      () => archiveKnowledgeFile(supabase, {
        agentId: "agent-1",
        ownerUserId: "owner-2",
        fileId: upload.file.id,
      }),
      /Knowledge file not found/
    );
  });
});
