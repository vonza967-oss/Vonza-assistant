import test from "node:test";
import assert from "node:assert/strict";

import { importBusinessWebsiteKnowledge } from "../src/services/scraping/websiteImportCoordinator.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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
