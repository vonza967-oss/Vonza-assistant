import { cleanText } from "../../utils/text.js";
import { ensureBusinessRecord } from "../business/businessResolution.js";
import { extractBusinessWebsiteContent } from "./websiteContentService.js";

const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const activeImportsByBusinessId = new Map();

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
    };
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

  const promise = startImportJob(supabase, business, deps, {
    queued: false,
    reused: false,
    startedAt: new Date().toISOString(),
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
