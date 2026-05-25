import test from "node:test";
import assert from "node:assert/strict";

import {
  getBusinessWebsiteImportStatus,
  importBusinessWebsiteKnowledge,
} from "../src/services/scraping/websiteImportCoordinator.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createImportJobsSupabase({ jobs = [] } = {}) {
  const state = {
    website_import_jobs: jobs.map((job, index) => ({
      id: job.id || `job-${index + 1}`,
      ...job,
    })),
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.inFilters = [];
      this.operation = "select";
      this.values = null;
      this.limitCount = null;
      this.orderColumn = "";
      this.orderAscending = true;
    }

    select() { return this; }
    insert(value) {
      this.operation = "insert";
      this.values = Array.isArray(value) ? value : [value];
      return this;
    }
    update(value) {
      this.operation = "update";
      this.values = value;
      return this;
    }
    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }
    in(column, values) {
      this.inFilters.push({ column, values });
      return this;
    }
    order(column, options = {}) {
      this.orderColumn = column;
      this.orderAscending = options.ascending !== false;
      return this;
    }
    limit(count) {
      this.limitCount = count;
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
      return this.filters.every((filter) => row[filter.column] === filter.value)
        && this.inFilters.every((filter) => filter.values.includes(row[filter.column]));
    }
    #run() {
      const rows = state[this.table] || [];
      if (this.operation === "insert") {
        const inserted = this.values.map((value) => {
          const row = {
            id: value.id || `job-${rows.length + 1}`,
            ...value,
          };
          rows.push(row);
          return { ...row };
        });
        return { data: inserted, error: null };
      }
      if (this.operation === "update") {
        const matches = rows.filter((row) => this.#matches(row));
        matches.forEach((row) => Object.assign(row, this.values));
        return { data: matches.map((row) => ({ ...row })), error: null };
      }

      let selected = rows.filter((row) => this.#matches(row));
      if (this.orderColumn) {
        selected = selected.sort((left, right) => {
          const leftValue = String(left[this.orderColumn] || "");
          const rightValue = String(right[this.orderColumn] || "");
          return this.orderAscending
            ? leftValue.localeCompare(rightValue)
            : rightValue.localeCompare(leftValue);
        });
      }
      if (this.limitCount !== null) {
        selected = selected.slice(0, this.limitCount);
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

async function waitFor(predicate, { timeoutMs = 500, intervalMs = 10 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  assert.fail("Timed out waiting for condition");
}

test("website import coordinator reuses an in-progress import for the same business URL", async () => {
  const firstImport = createDeferred();
  const calls = [];

  const runImport = (options) =>
    importBusinessWebsiteKnowledge(
      { test: true },
      options,
      {
        ensureBusinessRecord: async () => ({
          id: "business-1",
          website_url: "https://example.com/",
        }),
        extractBusinessWebsiteContent: async (_supabase, request) => {
          calls.push(request.websiteUrl);
          await firstImport.promise;
          return {
            businessId: "business-1",
            websiteUrl: request.websiteUrl,
            content: "Imported content",
            pageCount: 1,
            crawledUrls: [request.websiteUrl],
          };
        },
        logger: {
          info() {},
          error() {},
        },
      }
    );

  const firstRun = runImport({ businessId: "business-1" });
  const secondRun = runImport({ businessId: "business-1" });

  firstImport.resolve();
  const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);

  assert.deepEqual(calls, ["https://example.com/"]);
  assert.equal(firstResult.import.reused, false);
  assert.equal(secondResult.import.reused, true);
});

test("website import coordinator queues a newer website URL behind the active import for the same business", async () => {
  const firstImport = createDeferred();
  const calls = [];
  let ensureCount = 0;

  const importPromise = (options) =>
    importBusinessWebsiteKnowledge(
      { test: true },
      options,
      {
        ensureBusinessRecord: async () => {
          ensureCount += 1;
          return ensureCount === 1
            ? {
                id: "business-1",
                website_url: "https://old-example.com/",
              }
            : {
                id: "business-1",
                website_url: "https://new-example.com/",
              };
        },
        extractBusinessWebsiteContent: async (_supabase, request) => {
          calls.push(request.websiteUrl);
          if (request.websiteUrl === "https://old-example.com/") {
            await firstImport.promise;
          }
          return {
            businessId: "business-1",
            websiteUrl: request.websiteUrl,
            content: request.websiteUrl.includes("new") ? "New content" : "Old content",
            pageCount: 1,
            crawledUrls: [request.websiteUrl],
          };
        },
        logger: {
          info() {},
          error() {},
        },
      }
    );

  const firstRun = importPromise({ businessId: "business-1" });
  const secondRun = importPromise({ businessId: "business-1" });

  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "https://old-example.com/");

  firstImport.resolve();
  const [, secondResult] = await Promise.all([firstRun, secondRun]);

  assert.deepEqual(calls, ["https://old-example.com/", "https://new-example.com/"]);
  assert.equal(secondResult.import.queued, true);
  assert.equal(secondResult.websiteUrl, "https://new-example.com/");
});

test("async website import reuses an active queued job for the same owner agent business and URL", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "existing-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "queued",
        attempts: 1,
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
    ],
  });
  let extractCalls = 0;

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => {
      extractCalls += 1;
      return {};
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.mode, "async");
  assert.equal(result.import.jobId, "existing-job");
  assert.equal(result.import.status, "queued");
  assert.equal(result.import.reused, true);
  assert.equal(extractCalls, 0);
  assert.equal(supabase.state.website_import_jobs.length, 1);
});

test("async website import reuses active jobs across stored URL normalization differences", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "existing-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "running",
        attempts: 1,
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
    ],
  });
  let extractCalls = 0;

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com",
    }),
    extractBusinessWebsiteContent: async () => {
      extractCalls += 1;
      return {};
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.import.jobId, "existing-job");
  assert.equal(result.import.reused, true);
  assert.equal(extractCalls, 0);
  assert.equal(supabase.state.website_import_jobs.length, 1);
});

test("async website import active reuse stays within owner agent business and website boundaries", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "wrong-owner-job",
        owner_user_id: "owner-2",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "running",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
      {
        id: "wrong-agent-job",
        owner_user_id: "owner-1",
        agent_id: "agent-2",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "running",
        updated_at: "2026-05-25T10:01:00.000Z",
      },
      {
        id: "wrong-business-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-2",
        website_url: "https://example.com/",
        status: "running",
        updated_at: "2026-05-25T10:02:00.000Z",
      },
      {
        id: "wrong-website-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://other.example.com/",
        status: "running",
        updated_at: "2026-05-25T10:03:00.000Z",
      },
    ],
  });

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
    agent: { id: "agent-1", businessId: "business-1", ownerUserId: "owner-1" },
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com/",
      content: "Imported website content",
      pageCount: 1,
      crawledUrls: ["https://example.com/"],
    }),
    reindexFrontDeskKnowledge: async () => ({ ok: true }),
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.import.reused, false);
  assert.equal(result.import.status, "queued");
  assert.equal(supabase.state.website_import_jobs.length, 5);
  assert.ok(!["wrong-owner-job", "wrong-agent-job", "wrong-business-job", "wrong-website-job"].includes(result.import.jobId));
});

test("async website import force bypasses active job reuse", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "existing-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "running",
        attempts: 1,
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
    ],
  });

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    force: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
    agent: { id: "agent-1", businessId: "business-1", ownerUserId: "owner-1" },
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com/",
      content: "Imported website content",
      pageCount: 1,
      crawledUrls: ["https://example.com/"],
    }),
    reindexFrontDeskKnowledge: async () => ({ ok: true, chunksCreated: 1 }),
    getOpenAIClient: () => ({}),
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.import.reused, false);
  assert.notEqual(result.import.jobId, "existing-job");
  assert.equal(supabase.state.website_import_jobs.length, 2);
});

test("async website import stores sanitized partial indexing result when RAG indexing fails", async () => {
  const supabase = createImportJobsSupabase();

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
    agent: { id: "agent-1", businessId: "business-1", ownerUserId: "owner-1" },
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com/",
      content: "Useful website content for customers.",
      pageCount: 1,
      crawledUrls: ["https://example.com/"],
    }),
    reindexFrontDeskKnowledge: async () => {
      throw new Error("raw OpenAI sk-secret database stack trace");
    },
    getOpenAIClient: () => ({}),
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  await waitFor(() => supabase.state.website_import_jobs.find((job) => job.id === result.import.jobId)?.completed_at);
  const job = supabase.state.website_import_jobs.find((row) => row.id === result.import.jobId);

  assert.equal(job.status, "limited");
  assert.equal(job.result.indexing.status, "partial");
  assert.equal(job.result.indexing.message, "Website content was imported, but semantic indexing did not finish.");
  assert.doesNotMatch(JSON.stringify(job.result.indexing), /sk-secret|stack trace|OpenAI/);
});

test("async website import catches background crawl errors and marks the job failed", async () => {
  const supabase = createImportJobsSupabase();

  const result = await importBusinessWebsiteKnowledge(supabase, {
    async: true,
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
    agent: { id: "agent-1", businessId: "business-1", ownerUserId: "owner-1" },
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => {
      throw Object.assign(new Error("raw database provider failure"), {
        code: "PGRST999",
      });
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  await waitFor(() => supabase.state.website_import_jobs.find((job) => job.id === result.import.jobId)?.status === "failed");
  const job = supabase.state.website_import_jobs.find((row) => row.id === result.import.jobId);

  assert.equal(job.error_code, "import_failed");
  assert.equal(job.error_message, "Website import failed. Try again later.");
  assert.doesNotMatch(job.error_message, /database provider/);
});

test("synchronous website import still works when import job storage is missing", async () => {
  const supabase = {
    from(table) {
      assert.equal(table, "website_import_jobs");
      return {
        insert() {
          return {
            select() {
              return {
                single: async () => ({
                  data: null,
                  error: {
                    code: "PGRST205",
                    message: "'public.website_import_jobs' was not found in the schema cache",
                  },
                }),
              };
            },
          };
        },
      };
    },
  };

  const result = await importBusinessWebsiteKnowledge(supabase, {
    businessId: "business-1",
    agentId: "agent-1",
    ownerUserId: "owner-1",
  }, {
    ensureBusinessRecord: async () => ({
      id: "business-1",
      website_url: "https://example.com/",
    }),
    extractBusinessWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com/",
      content: "Imported website content",
      pageCount: 1,
      crawledUrls: ["https://example.com/"],
    }),
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.import.status, "limited");
  assert.equal(result.import.jobId, null);
});

test("import status returns the latest owner scoped agent job when job id is omitted", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "older-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://old.example.com/",
        status: "success",
        attempts: 1,
        page_count: 2,
        content_length: 900,
        result: { indexing: { status: "indexed", chunksCreated: 2 } },
        created_at: "2026-05-25T09:00:00.000Z",
        updated_at: "2026-05-25T09:00:00.000Z",
      },
      {
        id: "latest-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "running",
        attempts: 1,
        page_count: 0,
        content_length: 0,
        result: { indexing: { status: "not_started" } },
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
      {
        id: "wrong-owner-job",
        owner_user_id: "owner-2",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://wrong.example.com/",
        status: "success",
        created_at: "2026-05-25T11:00:00.000Z",
        updated_at: "2026-05-25T11:00:00.000Z",
      },
    ],
  });

  const result = await getBusinessWebsiteImportStatus(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
  }, {
    getStoredWebsiteContent: async () => ({
      businessId: "business-1",
      websiteUrl: "https://example.com/",
      content: "Current stored website content with enough useful detail for the summary.",
      pageCount: 3,
    }),
  });

  assert.equal(result.job.id, "latest-job");
  assert.equal(result.websiteUrl, "https://example.com/");
  assert.equal(result.knowledge.pageCount, 3);
});

test("import status does not expose another owner's job by id", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "other-owner-job",
        owner_user_id: "owner-2",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "success",
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
    ],
  });

  await assert.rejects(
    () => getBusinessWebsiteImportStatus(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      jobId: "other-owner-job",
    }),
    {
      statusCode: 404,
      message: "Website import job was not found.",
    }
  );
});

test("import status returns a clear not-found response when no job exists", async () => {
  const supabase = createImportJobsSupabase();

  await assert.rejects(
    () => getBusinessWebsiteImportStatus(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      jobId: "missing-job",
    }),
    {
      statusCode: 404,
      message: "Website import job was not found.",
    }
  );
});

test("import status sanitizes persisted job and indexing errors", async () => {
  const supabase = createImportJobsSupabase({
    jobs: [
      {
        id: "failed-job",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        business_id: "business-1",
        website_url: "https://example.com/",
        status: "failed",
        attempts: 1,
        error_code: "PGRST999",
        error_message: "raw database sk-secret failure",
        result: {
          indexing: {
            status: "failed",
            message: "raw OpenAI sk-secret failure",
          },
        },
        created_at: "2026-05-25T10:00:00.000Z",
        updated_at: "2026-05-25T10:00:00.000Z",
      },
    ],
  });

  const result = await getBusinessWebsiteImportStatus(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    jobId: "failed-job",
  });

  assert.equal(result.job.error.code, "import_failed");
  assert.equal(result.job.error.message, "Website import failed. Try again later.");
  assert.equal(result.job.indexing.message, "Website content was imported, but semantic indexing did not finish.");
  assert.doesNotMatch(JSON.stringify(result), /sk-secret|database/);
});
