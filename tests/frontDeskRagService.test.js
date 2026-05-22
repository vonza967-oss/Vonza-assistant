import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessProfileKnowledgeText,
  chunkKnowledgeText,
  getRetrievalConfidence,
  hashKnowledgeContent,
  reindexFrontDeskKnowledge,
  retrieveSemanticKnowledge,
  syncApprovedAnswerKnowledgeChunk,
} from "../src/services/rag/frontDeskRagService.js";
import { buildRetrievedBusinessContextForChat } from "../src/services/chat/prompting.js";

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

function createEmbeddingClient() {
  const calls = [];
  return {
    calls,
    embeddings: {
      create: async ({ input }) => {
        calls.push(input);
        return {
          data: [
            {
              embedding: Array.from({ length: 1536 }, (_, index) =>
                index === 0 ? Math.min(String(input).length / 1000, 1) : 0
              ),
            },
          ],
        };
      },
    },
  };
}

function createRagSupabase({
  chunks = [],
  trainingItems = [],
  websiteContent = null,
  businessProfile = null,
  rpcRows = [],
  rpcError = null,
} = {}) {
  const state = {
    front_desk_knowledge_chunks: chunks.map((row) => ({ ...row })),
    front_desk_training_items: trainingItems.map((row) => ({ ...row })),
    website_content: websiteContent ? [{ ...websiteContent }] : [],
    operator_business_profiles: businessProfile ? [{ ...businessProfile }] : [],
    rpcCalls: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.values = null;
      this.countMode = null;
    }

    select(_columns, options = {}) {
      this.countMode = options.count || null;
      return this;
    }
    order() { return this; }
    limit() { return this; }
    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }
    upsert(values) {
      this.operation = "upsert";
      this.values = Array.isArray(values) ? values : [values];
      return this;
    }
    update(value) {
      this.operation = "update";
      this.values = value;
      return this;
    }
    maybeSingle() {
      const result = this.#run();
      return Promise.resolve({
        data: result.data[0] || null,
        error: result.error,
      });
    }
    single() {
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
        return { data: affected.map((row) => ({ ...row })), error: null };
      }
      const selected = rows.filter((row) => this.#matches(row));
      if (this.countMode === "exact") {
        return { data: [], count: selected.length, error: null };
      }
      return { data: selected.map((row) => ({ ...row })), error: null };
    }
  }

  return {
    state,
    from(table) {
      return new Query(table);
    },
    rpc(name, params) {
      state.rpcCalls.push({ name, params });
      if (rpcError) {
        return Promise.resolve({ data: null, error: rpcError });
      }
      return Promise.resolve({ data: rpcRows, error: null });
    },
  };
}

test("chunking normalizes text, limits chunk size, and hashes stable content", () => {
  const chunks = chunkKnowledgeText([
    "Pricing",
    "",
    "Website projects start with a quote after discovery.",
    "",
    "Contact",
    "",
    "Email hello@example.test for a consultation.",
  ].join("\n"), {
    maxChunkChars: 80,
    chunkOverlapChars: 10,
  });

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 80));
  assert.equal(hashKnowledgeContent("Price   Quote"), hashKnowledgeContent(" Price  Quote "));
});

test("business profile facts serialize only configured fields", () => {
  const text = buildBusinessProfileKnowledgeText({
    businessSummary: "Acme builds websites for local service businesses.",
    services: [{ name: "Website design", note: "Company sites and landing pages" }],
    pricing: [{ label: "Quotes", details: "Pricing depends on scope" }],
    policies: [],
    serviceAreas: [{ name: "Budapest" }],
    operatingHours: [{ label: "Weekdays", hours: "9:00-17:00" }],
    approvedContactChannels: ["website_chat", "email"],
  });

  assert.match(text, /Business summary/);
  assert.match(text, /Website design - Company sites/);
  assert.match(text, /Pricing depends on scope/);
  assert.doesNotMatch(text, /refund/i);
});

test("reindex embeds website, business profile, and only active same-agent approved answers", async () => {
  await withEnv({ RAG_EMBEDDINGS_ENABLED: "true" }, async () => {
    const openai = createEmbeddingClient();
    const supabase = createRagSupabase({
      websiteContent: {
        business_id: "business-1",
        website_url: "https://acme.test",
        page_title: "Acme",
        meta_description: "",
        content: "Title: Services\nContent:\nWe build websites and SEO landing pages.",
        crawled_urls: ["https://acme.test"],
        page_count: 1,
      },
      businessProfile: {
        id: "profile-1",
        agent_id: "agent-1",
        business_id: "business-1",
        owner_user_id: "owner-1",
        business_summary: "Acme helps small businesses get quote-ready websites.",
        services: [{ name: "SEO", note: "Search-ready pages" }],
        pricing: [],
        policies: [],
        service_areas: [],
        operating_hours: [],
        approved_contact_channels: ["website_chat"],
        approval_preferences: {},
        metadata: {},
      },
      trainingItems: [
        {
          id: "approved-1",
          owner_id: "owner-1",
          agent_id: "agent-1",
          type: "approved_answer",
          title: "Pricing",
          trigger_text: "cost quote pricing",
          answer_text: "Quotes are prepared after a short scope review.",
          tags: ["pricing"],
          source_type: "manual",
          status: "active",
        },
        {
          id: "draft-1",
          owner_id: "owner-1",
          agent_id: "agent-1",
          type: "approved_answer",
          title: "Draft",
          trigger_text: "pricing",
          answer_text: "Draft answer.",
          tags: ["pricing"],
          source_type: "manual",
          status: "draft",
        },
        {
          id: "other-agent",
          owner_id: "owner-1",
          agent_id: "agent-2",
          type: "approved_answer",
          title: "Other",
          trigger_text: "pricing",
          answer_text: "Wrong agent answer.",
          tags: ["pricing"],
          source_type: "manual",
          status: "active",
        },
      ],
    });

    const result = await reindexFrontDeskKnowledge(supabase, openai, {
      agent: { id: "agent-1", businessId: "business-1", ownerUserId: "owner-1" },
      ownerUserId: "owner-1",
    });

    assert.equal(result.ok, true);
    assert.ok(result.embeddingsCreated >= 3);
    assert.deepEqual(
      supabase.state.front_desk_knowledge_chunks.map((chunk) => chunk.source_type).sort(),
      ["approved_answer", "business_profile", "website"]
    );
    assert.doesNotMatch(
      supabase.state.front_desk_knowledge_chunks.map((chunk) => chunk.content).join("\n"),
      /Draft answer|Wrong agent/
    );
  });
});

test("unchanged source chunks reuse existing embeddings instead of embedding again", async () => {
  await withEnv({ RAG_EMBEDDINGS_ENABLED: "true" }, async () => {
    const content = "Use when: pricing Approved answer: Quotes depend on scope.";
    const existingEmbedding = Array.from({ length: 1536 }, () => 0.1);
    const supabase = createRagSupabase({
      chunks: [
        {
          id: "chunk-1",
          owner_user_id: "owner-1",
          agent_id: "agent-1",
          source_type: "approved_answer",
          source_id: "approved-1",
          content_hash: hashKnowledgeContent(content),
          chunk_index: 0,
          embedding: existingEmbedding,
          embedding_model: "text-embedding-3-small",
          is_active: true,
        },
      ],
    });
    const openai = createEmbeddingClient();

    const result = await syncApprovedAnswerKnowledgeChunk(supabase, openai, {
      item: {
        id: "approved-1",
        ownerId: "owner-1",
        agentId: "agent-1",
        type: "approved_answer",
        status: "active",
        triggerText: "pricing",
        answerText: "Quotes depend on scope.",
      },
    });

    assert.equal(result.chunksSkipped, 1);
    assert.equal(result.embeddingsCreated, 0);
    assert.equal(openai.calls.length, 0);
    assert.equal(supabase.state.front_desk_knowledge_chunks[0].is_active, true);
  });
});

test("archived approved answer deactivates its semantic chunk", async () => {
  const supabase = createRagSupabase({
    chunks: [
      {
        id: "chunk-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        source_type: "approved_answer",
        source_id: "approved-1",
        content_hash: "hash",
        chunk_index: 0,
        is_active: true,
      },
    ],
  });

  await syncApprovedAnswerKnowledgeChunk(supabase, createEmbeddingClient(), {
    item: {
      id: "approved-1",
      ownerId: "owner-1",
      agentId: "agent-1",
      type: "approved_answer",
      status: "archived",
    },
  });

  assert.equal(supabase.state.front_desk_knowledge_chunks[0].is_active, false);
});

test("semantic retrieval sends owner and agent scope to RPC and labels confidence", async () => {
  await withEnv({ RAG_EMBEDDINGS_ENABLED: "true", RAG_MIN_SIMILARITY: "0.25" }, async () => {
    const supabase = createRagSupabase({
      rpcRows: [
        {
          id: "chunk-1",
          owner_user_id: "owner-1",
          agent_id: "agent-1",
          source_type: "website",
          source_id: "business-1",
          title: "Pricing",
          content: "Project costs are scoped after discovery.",
          content_hash: "hash",
          chunk_index: 0,
          metadata: {},
          embedding_model: "text-embedding-3-small",
          similarity: 0.62,
        },
      ],
    });

    const result = await retrieveSemanticKnowledge(supabase, createEmbeddingClient(), {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      queryText: "How much does it cost?",
    });

    assert.equal(result.confidence, "high");
    assert.equal(result.chunks[0].content, "Project costs are scoped after discovery.");
    assert.equal(supabase.state.rpcCalls[0].params.match_agent_id, "agent-1");
    assert.equal(supabase.state.rpcCalls[0].params.match_owner_user_id, "owner-1");
  });
});

test("retrieval confidence handles approved, medium, low fallback, and none", () => {
  assert.equal(getRetrievalConfidence({ approvedAnswerCount: 1 }), "high");
  assert.equal(getRetrievalConfidence({ semanticChunks: [{ similarity: 0.32 }] }), "medium");
  assert.equal(getRetrievalConfidence({ usedKeywordFallback: true }), "low");
  assert.equal(getRetrievalConfidence({}), "none");
});

test("retrieved context marks source priority, confidence, and safe fallback rules", () => {
  const context = buildRetrievedBusinessContextForChat({
    approvedAnswers: [
      {
        triggerText: "refund policy",
        answerText: "Refund requests are reviewed within two business days.",
      },
    ],
    businessProfileFacts: "Services:\n- Website design",
    semanticChunks: [
      {
        sourceType: "website",
        title: "Pricing",
        sourceUrl: "https://acme.test/pricing",
        content: "Pricing is quote-based.",
        similarity: 0.44,
      },
    ],
    retrievalConfidence: "medium",
  });

  assert.match(context, /OWNER-APPROVED ANSWERS:/);
  assert.match(context, /BUSINESS PROFILE FACTS:/);
  assert.match(context, /WEBSITE CONTEXT:/);
  assert.match(context, /RETRIEVAL CONFIDENCE:\nmedium/);
  assert.match(context, /Front Desk does not have that detail/);
  assert.doesNotMatch(context, /chunk-1/);
});
