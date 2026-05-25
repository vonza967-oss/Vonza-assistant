import { cleanText } from "../../utils/text.js";
import { normalizeWebsiteUrl } from "../../utils/url.js";
import { ensureBusinessRecord } from "../business/businessResolution.js";
import { extractBusinessWebsiteContent } from "./websiteContentService.js";

const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const WEBSITE_IMPORT_JOBS_TABLE = "website_import_jobs";
const ACTIVE_IMPORT_STATUSES = ["queued", "running"];
const IMPORT_STALLED_AFTER_MS = 15 * 60 * 1000;
const activeImportsByBusinessId = new Map();
const activeAsyncImportsByJobId = new Map();

function safeJson(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeImportWebsiteUrl(value) {
  return normalizeWebsiteUrl(value, { requirePublicHostname: false }) || cleanText(value);
}

function isSameImportWebsiteUrl(left, right) {
  const normalizedLeft = normalizeImportWebsiteUrl(left);
  const normalizedRight = normalizeImportWebsiteUrl(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205"
    || error?.code === "PGRST204"
    || error?.code === "42P01"
    || error?.code === "42703"
    || message.includes(`'public.${relationName}'`)
    || message.includes(`${relationName} was not found`)
  );
}

async function createImportJobRecord(supabase, business, options = {}, meta = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    return null;
  }

  const payload = {
    business_id: business.id,
    agent_id: cleanText(options.agentId) || null,
    owner_user_id: cleanText(options.ownerUserId) || null,
    website_url: cleanText(business.website_url),
    status: meta.queued === true ? "queued" : "running",
    attempts: Number(meta.attempts || 1),
    started_at: meta.queued === true ? null : new Date().toISOString(),
    metadata: {
      reused: meta.reused === true,
      queued: meta.queued === true,
      async: meta.async === true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(WEBSITE_IMPORT_JOBS_TABLE)
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error, WEBSITE_IMPORT_JOBS_TABLE)) {
      return null;
    }

    throw error;
  }

  return cleanText(data?.id);
}

function sanitizeErrorCode(error, fallback = "import_failed") {
  const candidate = cleanText(error?.publicCode || error?.safeCode || error?.code || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .slice(0, 80);

  if (!candidate || /^pgrst|^[0-9a-z]{5}$/i.test(candidate)) {
    return fallback;
  }

  return candidate;
}

function sanitizeImportErrorMessage(error) {
  if (error?.statusCode === 400 && cleanText(error?.message)) {
    return cleanText(error.message).slice(0, 300);
  }

  return "Website import failed. Try again later.";
}

function sanitizeIndexingErrorMessage() {
  return "Website content was imported, but semantic indexing did not finish.";
}

function hasUsableWebsiteContent(record = {}) {
  return cleanText(record?.content).length > 0;
}

function normalizeIndexingOutcome(indexingResult = {}, {
  startedAt = null,
  completedAt = null,
  failed = false,
  unavailable = false,
  usableContent = false,
} = {}) {
  if (unavailable) {
    return {
      status: "unavailable",
      message: "Semantic indexing is not available in this environment.",
      startedAt,
      completedAt,
      chunksCreated: 0,
      chunksUpdated: 0,
      chunksSkipped: 0,
      embeddingsCreated: 0,
      errorCount: 0,
    };
  }

  const errorCount = Array.isArray(indexingResult.errors) ? indexingResult.errors.length : 0;
  const counts = {
    chunksCreated: Number(indexingResult.chunksCreated || 0),
    chunksUpdated: Number(indexingResult.chunksUpdated || 0),
    chunksSkipped: Number(indexingResult.chunksSkipped || 0),
    embeddingsCreated: Number(indexingResult.embeddingsCreated || 0),
    errorCount,
  };

  if (failed || errorCount > 0 || indexingResult.ok === false) {
    return {
      status: usableContent ? "partial" : "failed",
      message: sanitizeIndexingErrorMessage(),
      startedAt,
      completedAt,
      ...counts,
    };
  }

  return {
    status: "indexed",
    message: "Semantic indexing completed.",
    startedAt,
    completedAt,
    ...counts,
  };
}

function buildInitialIndexingOutcome() {
  return {
    status: "not_started",
    message: "Semantic indexing has not started.",
    chunksCreated: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
    embeddingsCreated: 0,
    errorCount: 0,
  };
}

function buildRunningIndexingOutcome(startedAt) {
  return {
    status: "running",
    message: "Semantic indexing is running.",
    startedAt,
    chunksCreated: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
    embeddingsCreated: 0,
    errorCount: 0,
  };
}

async function findActiveImportJobRecord(supabase, business, options = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    return null;
  }

  let query = supabase
    .from(WEBSITE_IMPORT_JOBS_TABLE)
    .select("id, business_id, agent_id, owner_user_id, website_url, status, attempts, metadata, result, started_at, completed_at, created_at, updated_at")
    .eq("owner_user_id", cleanText(options.ownerUserId))
    .eq("agent_id", cleanText(options.agentId))
    .eq("business_id", cleanText(business.id));

  if (typeof query.in === "function") {
    query = query.in("status", ACTIVE_IMPORT_STATUSES);
  } else {
    query = query.eq("status", "running");
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingRelationError(error, WEBSITE_IMPORT_JOBS_TABLE)) {
      return null;
    }
    throw error;
  }

  return (data || []).find((job) => isSameImportWebsiteUrl(job.website_url, business.website_url)) || null;
}

async function getImportJobRecord(supabase, {
  ownerUserId,
  agentId,
  jobId = "",
} = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    return null;
  }

  let query = supabase
    .from(WEBSITE_IMPORT_JOBS_TABLE)
    .select("id, business_id, agent_id, owner_user_id, website_url, status, attempts, page_count, content_length, error_code, error_message, metadata, result, started_at, completed_at, created_at, updated_at")
    .eq("owner_user_id", cleanText(ownerUserId))
    .eq("agent_id", cleanText(agentId));

  if (cleanText(jobId)) {
    query = query.eq("id", cleanText(jobId));
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, WEBSITE_IMPORT_JOBS_TABLE)) {
      return null;
    }
    throw error;
  }

  return data || null;
}

function buildAsyncStartResponse({
  agentId,
  businessId,
  websiteUrl,
  jobId,
  status = "queued",
  reused = false,
  statusUrl = "",
}) {
  return {
    ok: true,
    mode: "async",
    agentId,
    businessId,
    websiteUrl,
    import: {
      jobId,
      status,
      reused: reused === true,
    },
    statusUrl,
  };
}

async function updateImportJobRecord(supabase, jobId, patch = {}) {
  const normalizedJobId = cleanText(jobId);

  if (!normalizedJobId || !supabase || typeof supabase.from !== "function") {
    return { ok: false, skipped: true };
  }

  const { error } = await supabase
    .from(WEBSITE_IMPORT_JOBS_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedJobId);

  if (error) {
    if (isMissingRelationError(error, WEBSITE_IMPORT_JOBS_TABLE)) {
      return { ok: false, skipped: true };
    }

    throw error;
  }

  return { ok: true };
}

function buildKnowledgeSummary(record) {
  const content = cleanText(record?.content || "");
  const contentLength = content.length;
  const pageCount = Number(record?.pageCount || 0);
  const importedWebsiteUrl = cleanText(record?.websiteUrl || "");
  const updatedAt = record?.updatedAt || new Date().toISOString();

  if (!content) {
    return {
      state: "missing",
      label: "Not ready",
      description: "Website knowledge is not available yet. Import it again once your site is live.",
      contentLength,
      pageCount,
      importedWebsiteUrl,
      updatedAt,
    };
  }

  if (content.includes(LIMITED_CONTENT_MARKER) || contentLength < 400) {
    return {
      state: "limited",
      label: "Limited",
      description: "Some website content was imported, but the assistant still needs a better knowledge pass.",
      contentLength,
      pageCount,
      importedWebsiteUrl,
      updatedAt,
    };
  }

  return {
    state: "ready",
    label: "Ready",
    description: "Your assistant has website knowledge and is ready to answer real customer questions.",
    contentLength,
    pageCount,
    importedWebsiteUrl,
    updatedAt,
  };
}

function buildImportResponse(record, importMeta = {}) {
  const knowledge = buildKnowledgeSummary(record);

  return {
    ok: true,
    businessId: record.businessId,
    websiteUrl: record.websiteUrl,
    pageTitle: record.pageTitle,
    metaDescription: record.metaDescription,
    content: record.content,
    crawledUrls: record.crawledUrls,
    pageCount: record.pageCount,
    knowledge,
    import: {
      status: knowledge.state === "ready" ? "success" : "limited",
      startedAt: importMeta.startedAt || null,
      completedAt: importMeta.completedAt || knowledge.updatedAt,
      queued: importMeta.queued === true,
      reused: importMeta.reused === true,
      businessId: record.businessId,
      websiteUrl: record.websiteUrl,
      lastImportedUrl: knowledge.importedWebsiteUrl,
      lastImportedAt: knowledge.updatedAt,
      message:
        knowledge.state === "ready"
          ? "Website knowledge import completed successfully."
          : "Website knowledge import completed with limited detail.",
      jobId: importMeta.jobId || null,
    },
  };
}

async function startImportJob(supabase, business, deps, meta = {}) {
  const extractImpl = deps.extractBusinessWebsiteContent || extractBusinessWebsiteContent;
  const reindexImpl = deps.reindexFrontDeskKnowledge;
  const getOpenAI = deps.getOpenAIClient;
  const logger = deps.logger || console;
  const startedAt = meta.startedAt || new Date().toISOString();

  logger.info?.("[knowledge/import] Starting website knowledge import.", {
    businessId: business.id,
    websiteUrl: business.website_url,
    queued: meta.queued === true,
    reused: meta.reused === true,
  });

  try {
    if (meta.jobId && meta.queued === true) {
      await updateImportJobRecord(supabase, meta.jobId, {
        status: "running",
        started_at: startedAt,
      }).catch((error) => {
        logger.warn?.("[knowledge/import] Failed to mark import job running.", {
          businessId: business.id,
          jobId: meta.jobId,
          message: error?.message || "Job update failed",
        });
      });
    }

    const record = await extractImpl(supabase, {
      businessId: business.id,
      websiteUrl: business.website_url,
    });
    const completedAt = new Date().toISOString();
    const contentLength = cleanText(record?.content).length;
    let indexing = buildInitialIndexingOutcome();

    const response = buildImportResponse(
      {
        ...record,
        updatedAt: completedAt,
      },
      {
        ...meta,
        startedAt,
        completedAt,
      }
    );

    if (meta.index === true) {
      const indexingStartedAt = new Date().toISOString();
      indexing = buildRunningIndexingOutcome(indexingStartedAt);
      await updateImportJobRecord(supabase, meta.jobId, {
        result: {
          status: response.import.status,
          pageCount: response.pageCount || 0,
          contentLength,
          websiteUrl: response.websiteUrl,
          indexing,
        },
      }).catch((error) => {
        logger.warn?.("[knowledge/import] Failed to mark import indexing running.", {
          businessId: business.id,
          jobId: meta.jobId,
          message: error?.message || "Job update failed",
        });
      });

      if (typeof reindexImpl === "function" && meta.agent && meta.ownerUserId) {
        try {
          const indexingResult = await reindexImpl(supabase, typeof getOpenAI === "function" ? getOpenAI() : null, {
            agent: meta.agent,
            ownerUserId: meta.ownerUserId,
            websiteContent: response,
          });
          indexing = normalizeIndexingOutcome(indexingResult, {
            startedAt: indexingStartedAt,
            completedAt: new Date().toISOString(),
            usableContent: hasUsableWebsiteContent(response),
          });
        } catch (error) {
          logger.warn?.("[knowledge/import] Website content indexing failed.", {
            businessId: business.id,
            jobId: meta.jobId,
            message: error?.message || "Indexing failed",
          });
          indexing = normalizeIndexingOutcome({}, {
            startedAt: indexingStartedAt,
            completedAt: new Date().toISOString(),
            failed: true,
            usableContent: hasUsableWebsiteContent(response),
          });
        }
      } else {
        indexing = normalizeIndexingOutcome({}, {
          startedAt: indexingStartedAt,
          completedAt: new Date().toISOString(),
          unavailable: true,
        });
      }
    }

    logger.info?.("[knowledge/import] Finished website knowledge import.", {
      businessId: business.id,
      websiteUrl: business.website_url,
      status: response.import.status,
      pageCount: response.pageCount,
      queued: response.import.queued,
      reused: response.import.reused,
    });

    await updateImportJobRecord(supabase, meta.jobId, {
      status: response.import.status,
      completed_at: completedAt,
      page_count: response.pageCount || 0,
      content_length: contentLength,
      result: {
        status: response.import.status,
        pageCount: response.pageCount || 0,
        contentLength,
        websiteUrl: response.websiteUrl,
        ...(meta.index === true ? { indexing } : {}),
      },
    }).catch((error) => {
      logger.warn?.("[knowledge/import] Failed to mark import job complete.", {
        businessId: business.id,
        jobId: meta.jobId,
        message: error?.message || "Job update failed",
      });
    });

    return response;
  } catch (error) {
    const completedAt = new Date().toISOString();
    logger.error?.("[knowledge/import] Website knowledge import failed.", {
      businessId: business.id,
      websiteUrl: business.website_url,
      queued: meta.queued === true,
      reused: meta.reused === true,
      statusCode: error?.statusCode || 500,
      message: error?.message || "Import failed",
    });

    error.import = {
      status: "failed",
      startedAt,
      completedAt,
      queued: meta.queued === true,
      reused: meta.reused === true,
      businessId: business.id,
      websiteUrl: business.website_url,
      message: error?.message || "Import failed",
      jobId: meta.jobId || null,
    };

    await updateImportJobRecord(supabase, meta.jobId, {
      status: "failed",
      completed_at: completedAt,
      error_code: sanitizeErrorCode(error),
      error_message: sanitizeImportErrorMessage(error),
      ...(meta.index === true
        ? {
            result: {
              status: "failed",
              websiteUrl: business.website_url,
              indexing: buildInitialIndexingOutcome(),
            },
          }
        : {}),
    }).catch((jobError) => {
      logger.warn?.("[knowledge/import] Failed to mark import job failed.", {
        businessId: business.id,
        jobId: meta.jobId,
        message: jobError?.message || "Job update failed",
      });
    });
    throw error;
  }
}

export async function importBusinessWebsiteKnowledge(supabase, options = {}, deps = {}) {
  if (options.async === true) {
    return startAsyncBusinessWebsiteKnowledgeImport(supabase, options, deps);
  }

  const ensureBusiness = deps.ensureBusinessRecord || ensureBusinessRecord;
  const logger = deps.logger || console;
  const business = await ensureBusiness(supabase, options);
  const businessId = cleanText(business?.id);
  const websiteUrl = cleanText(business?.website_url);

  if (!businessId || !websiteUrl) {
    const error = new Error("A business with a website URL is required before import can run.");
    error.statusCode = 400;
    throw error;
  }

  const existingJob = activeImportsByBusinessId.get(businessId);

  if (existingJob) {
    if (existingJob.websiteUrl === websiteUrl) {
      logger.info?.("[knowledge/import] Reusing active website knowledge import.", {
        businessId,
        websiteUrl,
      });
      const response = await existingJob.promise;
      return {
        ...response,
        import: {
          ...response.import,
          reused: true,
        },
      };
    }

    logger.info?.("[knowledge/import] Queueing website knowledge import behind active job.", {
      businessId,
      activeWebsiteUrl: existingJob.websiteUrl,
      nextWebsiteUrl: websiteUrl,
    });

    const queuedJobId = supabase && typeof supabase.from === "function"
      ? await createImportJobRecord(supabase, business, options, {
        queued: true,
      }).catch((error) => {
        logger.warn?.("[knowledge/import] Failed to persist queued import job.", {
          businessId,
          websiteUrl,
          message: error?.message || "Job insert failed",
        });
        return null;
      })
      : null;

    const queuedPromise = existingJob.promise
      .catch(() => null)
      .then(() =>
        startImportJob(
          supabase,
          business,
          deps,
          {
            queued: true,
            startedAt: new Date().toISOString(),
            jobId: queuedJobId,
          }
        )
      );

    activeImportsByBusinessId.set(businessId, {
      websiteUrl,
      promise: queuedPromise,
    });

    try {
      return await queuedPromise;
    } finally {
      if (activeImportsByBusinessId.get(businessId)?.promise === queuedPromise) {
        activeImportsByBusinessId.delete(businessId);
      }
    }
  }

  const jobId = supabase && typeof supabase.from === "function"
    ? await createImportJobRecord(supabase, business, options, {
      queued: false,
      reused: false,
    }).catch((error) => {
      logger.warn?.("[knowledge/import] Failed to persist import job.", {
        businessId,
        websiteUrl,
        message: error?.message || "Job insert failed",
      });
      return null;
    })
    : null;

  const promise = startImportJob(supabase, business, deps, {
    queued: false,
    reused: false,
    startedAt: new Date().toISOString(),
    jobId,
  });

  activeImportsByBusinessId.set(businessId, {
    websiteUrl,
    promise,
  });

  try {
    return await promise;
  } finally {
    if (activeImportsByBusinessId.get(businessId)?.promise === promise) {
      activeImportsByBusinessId.delete(businessId);
    }
  }
}

export async function startAsyncBusinessWebsiteKnowledgeImport(supabase, options = {}, deps = {}) {
  const ensureBusiness = deps.ensureBusinessRecord || ensureBusinessRecord;
  const logger = deps.logger || console;
  const business = await ensureBusiness(supabase, options);
  const businessId = cleanText(business?.id);
  const websiteUrl = cleanText(business?.website_url);
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  if (!businessId || !websiteUrl || !agentId || !ownerUserId) {
    const error = new Error("A business, agent, owner, and website URL are required before async import can run.");
    error.statusCode = 400;
    throw error;
  }

  if (!supabase || typeof supabase.from !== "function") {
    const error = new Error("Website import status storage is unavailable.");
    error.statusCode = 503;
    throw error;
  }

  if (options.force !== true) {
    // This reduces duplicate queued/running jobs without a schema change; it is not a full cross-instance lock.
    const activeJob = await findActiveImportJobRecord(supabase, business, options).catch((error) => {
      logger.warn?.("[knowledge/import] Failed to look up active async import job.", {
        businessId,
        agentId,
        message: error?.message || "Job lookup failed",
      });
      const safeError = new Error("Website import status is temporarily unavailable.");
      safeError.statusCode = 503;
      throw safeError;
    });

    if (activeJob?.id) {
      return buildAsyncStartResponse({
        agentId,
        businessId,
        websiteUrl,
        jobId: cleanText(activeJob.id),
        status: cleanText(activeJob.status) || "queued",
        reused: true,
        statusUrl: options.statusUrl,
      });
    }
  }

  const jobId = await createImportJobRecord(supabase, business, options, {
    queued: true,
    reused: false,
    async: true,
  }).catch((error) => {
    logger.warn?.("[knowledge/import] Failed to persist async import job.", {
      businessId,
      agentId,
      message: error?.message || "Job insert failed",
    });
    const safeError = new Error("Website import could not be queued.");
    safeError.statusCode = 503;
    throw safeError;
  });

  if (!jobId) {
    const error = new Error("Website import status storage is unavailable.");
    error.statusCode = 503;
    throw error;
  }

  const backgroundPromise = startImportJob(supabase, business, deps, {
    queued: true,
    reused: false,
    async: true,
    index: true,
    agent: options.agent,
    ownerUserId,
    startedAt: new Date().toISOString(),
    jobId,
  }).catch((error) => {
    logger.error?.("[knowledge/import] Async website import failed.", {
      businessId,
      agentId,
      jobId,
      message: error?.message || "Import failed",
    });
    return null;
  });

  activeAsyncImportsByJobId.set(jobId, backgroundPromise);
  backgroundPromise.finally(() => {
    if (activeAsyncImportsByJobId.get(jobId) === backgroundPromise) {
      activeAsyncImportsByJobId.delete(jobId);
    }
  }).catch(() => {});

  return buildAsyncStartResponse({
    agentId,
    businessId,
    websiteUrl,
    jobId,
    status: "queued",
    reused: false,
    statusUrl: options.statusUrl,
  });
}

function deriveImportPhase(job = {}, indexing = {}) {
  const status = cleanText(job.status);
  const indexingStatus = cleanText(indexing.status);

  if (status === "queued") {
    return "queued";
  }
  if (status === "running" && indexingStatus === "running") {
    return "indexing";
  }
  if (status === "running") {
    return "crawling";
  }
  return status || "unknown";
}

function isStalledImportJob(job = {}, now = Date.now()) {
  const status = cleanText(job.status);
  if (!ACTIVE_IMPORT_STATUSES.includes(status)) {
    return false;
  }

  const timestamp = Date.parse(job.updated_at || job.started_at || job.created_at || "");
  return Number.isFinite(timestamp) && now - timestamp > IMPORT_STALLED_AFTER_MS;
}

function sanitizeJobError(job = {}) {
  const code = sanitizeErrorCode({ code: job.error_code }, "import_failed");
  const message = cleanText(job.error_message);

  if (!message && !cleanText(job.error_code)) {
    return null;
  }

  return {
    code,
    message:
      code === "unsafe_website_url"
        ? "Website import could not crawl that URL."
        : "Website import failed. Try again later.",
  };
}

function sanitizeIndexingStatusMessage(indexing = {}) {
  const status = cleanText(indexing.status);

  if (status === "indexed") {
    return "Semantic indexing completed.";
  }
  if (status === "running") {
    return "Semantic indexing is running.";
  }
  if (status === "unavailable") {
    return "Semantic indexing is not available in this environment.";
  }
  if (status === "not_started") {
    return "Semantic indexing has not started.";
  }
  if (status === "partial" || status === "failed") {
    return sanitizeIndexingErrorMessage();
  }

  return "";
}

function mapImportJobStatus(job = {}) {
  const result = safeJson(job.result);
  const indexing = {
    ...buildInitialIndexingOutcome(),
    ...safeJson(result.indexing),
  };

  return {
    id: cleanText(job.id),
    status: cleanText(job.status) || "unknown",
    phase: deriveImportPhase(job, indexing),
    attempts: Number(job.attempts || 0),
    pageCount: Number(job.page_count ?? result.pageCount ?? 0),
    contentLength: Number(job.content_length ?? result.contentLength ?? 0),
    startedAt: job.started_at || null,
    completedAt: job.completed_at || null,
    createdAt: job.created_at || null,
    updatedAt: job.updated_at || null,
    stalled: isStalledImportJob(job),
    error: sanitizeJobError(job),
    indexing: {
      status: cleanText(indexing.status) || "not_started",
      message: sanitizeIndexingStatusMessage(indexing),
      chunksCreated: Number(indexing.chunksCreated || 0),
      chunksUpdated: Number(indexing.chunksUpdated || 0),
      chunksSkipped: Number(indexing.chunksSkipped || 0),
      embeddingsCreated: Number(indexing.embeddingsCreated || 0),
      errorCount: Number(indexing.errorCount || 0),
      startedAt: indexing.startedAt || null,
      completedAt: indexing.completedAt || null,
    },
  };
}

export async function getBusinessWebsiteImportStatus(supabase, options = {}, deps = {}) {
  const ownerUserId = cleanText(options.ownerUserId);
  const agentId = cleanText(options.agentId);

  if (!ownerUserId || !agentId) {
    const error = new Error("Owner and agent are required to read import status.");
    error.statusCode = 400;
    throw error;
  }

  const job = await getImportJobRecord(supabase, options).catch(() => {
    const safeError = new Error("Website import status is temporarily unavailable.");
    safeError.statusCode = 503;
    throw safeError;
  });

  if (!job) {
    const error = new Error("Website import job was not found.");
    error.statusCode = 404;
    throw error;
  }

  let knowledge = null;
  const getStoredWebsiteContentImpl = deps.getStoredWebsiteContent || null;
  if (typeof getStoredWebsiteContentImpl === "function" && cleanText(job.business_id)) {
    knowledge = await getStoredWebsiteContentImpl(supabase, cleanText(job.business_id))
      .then((record) => (record ? buildKnowledgeSummary(record) : null))
      .catch(() => null);
  }

  return {
    ok: true,
    agentId,
    businessId: cleanText(job.business_id),
    websiteUrl: cleanText(job.website_url),
    job: mapImportJobStatus(job),
    knowledge,
  };
}
