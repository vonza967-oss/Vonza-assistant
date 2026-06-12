import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import cors from "cors";
import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(createAgentRouter({
    limitWidgetBootstrap: (_req, _res, next) => next(),
    limitPublicInstallSignal: (_req, _res, next) => next(),
    limitPublicInstallCta: (_req, _res, next) => next(),
    limitAuthAdjacent: (_req, _res, next) => next(),
    limitInstallVerify: (_req, _res, next) => next(),
    ...deps,
  }));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function createKnowledgeFileRouteDeps(overrides = {}) {
  const calls = {
    access: [],
    list: [],
    upload: [],
    archive: [],
  };
  const agent = {
    id: "agent-1",
    ownerUserId: "owner-1",
    accessStatus: "active",
    businessId: "business-1",
  };

  return {
    calls,
    deps: {
      getSupabaseClient: () => ({ label: "supabase" }),
      getOpenAIClient: () => ({ label: "openai" }),
      getAuthenticatedUser: async (_supabase, req) => {
        if (req.headers.authorization !== "Bearer owner-token") {
          throw createHttpError("Authentication is required.", 401);
        }
        return { id: "owner-1", email: "owner@example.com" };
      },
      requireActiveAgentAccess: async (_supabase, options) => {
        calls.access.push(options);
        if (options.ownerUserId !== "owner-1" || options.agentId !== "agent-1") {
          throw createHttpError("Forbidden", 403);
        }
        return agent;
      },
      listKnowledgeFiles: async (_supabase, options) => {
        calls.list.push(options);
        return {
          files: [
            {
              id: "file-1",
              originalFilename: "services.txt",
              byteSize: 42,
              status: "ready",
              createdAt: "2026-06-12T09:00:00.000Z",
            },
          ],
        };
      },
      uploadKnowledgeFile: async (_supabase, _openai, options) => {
        calls.upload.push(options);
        return {
          ok: true,
          file: {
            id: "file-1",
            originalFilename: options.file.filename,
            status: "ready",
            byteSize: options.file.size,
          },
          indexResult: { chunksCreated: 1, chunksUpdated: 0, errors: [] },
        };
      },
      archiveKnowledgeFile: async (_supabase, options) => {
        calls.archive.push(options);
        return {
          ok: true,
          file: { id: options.fileId, status: "archived" },
          chunksDeactivated: 2,
        };
      },
      ...overrides,
    },
  };
}

function createKnowledgeForm(filename = "services.txt", content = "Trusted service details.", type = "text/plain") {
  const form = new FormData();
  form.set("file", new Blob([content], { type }), filename);
  return form;
}

test("knowledge file upload route requires authentication before indexing", async () => {
  const { calls, deps } = createKnowledgeFileRouteDeps();
  const server = await startServer(createApp(deps));

  try {
    const response = await fetch(`${server.baseUrl}/api/agents/agent-1/knowledge-files`, {
      method: "POST",
      body: createKnowledgeForm(),
    });
    const json = await response.json();

    assert.equal(response.status, 401);
    assert.match(json.error, /Authentication is required/);
    assert.equal(calls.upload.length, 0);
  } finally {
    await server.close();
  }
});

test("knowledge file upload route rejects cross-owner access before indexing", async () => {
  const { calls, deps } = createKnowledgeFileRouteDeps({
    requireActiveAgentAccess: async (_supabase, options) => {
      calls.access.push(options);
      throw createHttpError("Forbidden", 403);
    },
  });
  const server = await startServer(createApp(deps));

  try {
    const response = await fetch(`${server.baseUrl}/api/agents/agent-1/knowledge-files`, {
      method: "POST",
      headers: { Authorization: "Bearer owner-token" },
      body: createKnowledgeForm(),
    });
    const json = await response.json();

    assert.equal(response.status, 403);
    assert.match(json.error, /Forbidden/);
    assert.equal(calls.upload.length, 0);
  } finally {
    await server.close();
  }
});

test("knowledge file upload route parses supported multipart files for owner-scoped indexing", async () => {
  const { calls, deps } = createKnowledgeFileRouteDeps();
  const server = await startServer(createApp(deps));

  try {
    const response = await fetch(`${server.baseUrl}/api/agents/agent-1/knowledge-files?client_id=client-1`, {
      method: "POST",
      headers: { Authorization: "Bearer owner-token" },
      body: createKnowledgeForm("services.txt", "Trusted hours: weekdays 9-17."),
    });
    const json = await response.json();

    assert.equal(response.status, 201);
    assert.equal(json.ok, true);
    assert.equal(json.file.originalFilename, "services.txt");
    assert.deepEqual(calls.access[0], {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      clientId: "client-1",
    });
    assert.equal(calls.upload.length, 1);
    assert.equal(calls.upload[0].ownerUserId, "owner-1");
    assert.equal(calls.upload[0].agent.id, "agent-1");
    assert.equal(calls.upload[0].file.filename, "services.txt");
    assert.equal(calls.upload[0].file.contentType, "text/plain");
    assert.match(calls.upload[0].file.buffer.toString("utf8"), /Trusted hours/);
  } finally {
    await server.close();
  }
});

test("knowledge file list and archive routes stay owner-scoped", async () => {
  const { calls, deps } = createKnowledgeFileRouteDeps();
  const server = await startServer(createApp(deps));

  try {
    const listResponse = await fetch(
      `${server.baseUrl}/api/agents/agent-1/knowledge-files?client_id=client-1&status=ready&limit=10`,
      { headers: { Authorization: "Bearer owner-token" } }
    );
    const listJson = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listJson.files[0].id, "file-1");
    assert.deepEqual(calls.list[0], {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      status: "ready",
      limit: "10",
    });

    const archiveResponse = await fetch(
      `${server.baseUrl}/api/agents/agent-1/knowledge-files/file-1?client_id=client-1`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer owner-token" },
      }
    );
    const archiveJson = await archiveResponse.json();

    assert.equal(archiveResponse.status, 200);
    assert.equal(archiveJson.file.status, "archived");
    assert.equal(archiveJson.chunksDeactivated, 2);
    assert.deepEqual(calls.archive[0], {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      fileId: "file-1",
    });
    assert.equal(calls.access.length, 2);
    assert.equal(calls.access[1].clientId, "client-1");
  } finally {
    await server.close();
  }
});
