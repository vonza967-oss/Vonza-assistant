import { cleanText } from "../../utils/text.js";
import { ensureBusinessRecord } from "../business/businessResolution.js";
import { extractBusinessWebsiteContent } from "./websiteContentService.js";

const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const WEBSITE_IMPORT_JOBS_TABLE = "website_import_jobs";
const activeImportsByBusinessId = new Map();

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
      content_length: cleanText(response.content).length,
      result: {
        status: response.import.status,
        pageCount: response.pageCount || 0,
        contentLength: cleanText(response.content).length,
        websiteUrl: response.websiteUrl,
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
      error_code: cleanText(error?.code) || null,
      error_message: cleanText(error?.message || "Import failed").slice(0, 500),
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
