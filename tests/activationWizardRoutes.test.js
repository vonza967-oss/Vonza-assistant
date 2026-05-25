import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import cors from "cors";
import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(createAgentRouter(deps));
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

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

function buildDeps(overrides = {}) {
  return {
    getSupabaseClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1" }),
    requireActiveAgentAccess: async (_supabase, payload) => {
      assert.equal(payload.ownerUserId, "owner-1");
      assert.equal(payload.agentId, "agent-1");
      return { id: "agent-1" };
    },
    getAgentWorkspaceSnapshot: async () => ({
      id: "agent-1",
      ownerUserId: "owner-1",
      name: "Route Co",
      websiteUrl: "https://example.com",
      assistantName: "Route Assistant",
      tone: "friendly",
      purpose: "guidance",
      welcomeMessage: "Hi",
      buttonLabel: "Chat",
      knowledge: { state: "missing", pageCount: 0 },
      installStatus: { state: "not_installed" },
    }),
    listAgentMessages: async () => [],
    listActionQueueStatuses: async () => ({ records: [], persistenceAvailable: true }),
    buildActionQueue: () => ({ items: [], summary: {} }),
    getActivationWizardState: async (_supabase, payload) => {
      assert.equal(payload.ownerUserId, "owner-1");
      assert.equal(payload.agent.id, "agent-1");
      return {
        shouldShow: true,
        currentStep: "import_knowledge",
        nextAction: { action: "import_knowledge" },
      };
    },
    updateActivationWizardProgress: async (_supabase, payload) => {
      assert.equal(payload.ownerUserId, "owner-1");
      assert.equal(payload.agent.id, "agent-1");
      assert.equal(payload.step, "import_knowledge");
      assert.equal(payload.action, "skip_step");
      return {
        shouldShow: true,
        currentStep: "configure_assistant",
      };
    },
    ...overrides,
  };
}

test("activation wizard state route is owner scoped", async () => {
  const server = await startServer(createApp(buildDeps()));

  try {
    const response = await requestJson(
      server.baseUrl,
      "/agents/activation-wizard?agent_id=agent-1&client_id=client-1"
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.wizard.currentStep, "import_knowledge");
    assert.equal(response.json.wizard.nextAction.action, "import_knowledge");
  } finally {
    await server.close();
  }
});

test("activation wizard progress route persists skip and return behavior", async () => {
  const server = await startServer(createApp(buildDeps()));

  try {
    const response = await requestJson(server.baseUrl, "/agents/activation-wizard/progress", {
      method: "POST",
      body: JSON.stringify({
        client_id: "client-1",
        agent_id: "agent-1",
        step: "import_knowledge",
        action: "skip_step",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.wizard.currentStep, "configure_assistant");
  } finally {
    await server.close();
  }
});

test("knowledge import keeps synchronous default response shape", async () => {
  const server = await startServer(createApp(buildDeps({
    resolveAgentContext: async () => ({
      agent: {
        id: "agent-1",
        ownerUserId: "owner-1",
        businessId: "business-1",
      },
      business: {
        id: "business-1",
        website_url: "https://example.com/",
      },
    }),
    importBusinessWebsiteKnowledge: async (_supabase, options) => {
      assert.equal(options.async, undefined);
      return {
        ok: true,
        businessId: "business-1",
        websiteUrl: "https://example.com/",
        content: "Imported content",
        pageCount: 1,
        import: {
          status: "success",
          jobId: "sync-job",
        },
      };
    },
    reindexFrontDeskKnowledge: async (_supabase, _openai, payload) => {
      assert.equal(payload.ownerUserId, "owner-1");
      assert.equal(payload.websiteContent.import.jobId, "sync-job");
      return { ok: true };
    },
    getOpenAIClient: () => ({}),
  })));

  try {
    const response = await requestJson(server.baseUrl, "/knowledge/import", {
      method: "POST",
      body: JSON.stringify({
        business_id: "business-1",
        client_id: "client-1",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, undefined);
    assert.equal(response.json.import.status, "success");
    assert.equal(response.json.import.jobId, "sync-job");
  } finally {
    await server.close();
  }
});

test("knowledge import async mode returns accepted job status URL", async () => {
  const server = await startServer(createApp(buildDeps({
    resolveAgentContext: async () => ({
      agent: {
        id: "agent-1",
        ownerUserId: "owner-1",
        businessId: "business-1",
      },
      business: {
        id: "business-1",
        website_url: "https://example.com/",
      },
    }),
    importBusinessWebsiteKnowledge: async (_supabase, options) => {
      assert.equal(options.async, true);
      assert.equal(options.force, false);
      assert.equal(options.ownerUserId, "owner-1");
      assert.match(options.statusUrl, /__JOB_ID__/);
      return {
        ok: true,
        mode: "async",
        agentId: "agent-1",
        businessId: "business-1",
        websiteUrl: "https://example.com/",
        import: {
          jobId: "job-async-1",
          status: "queued",
          reused: false,
        },
        statusUrl: options.statusUrl,
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/knowledge/import", {
      method: "POST",
      body: JSON.stringify({
        async: true,
        business_id: "business-1",
        client_id: "client-1",
      }),
    });

    assert.equal(response.status, 202);
    assert.equal(response.json.mode, "async");
    assert.equal(response.json.import.jobId, "job-async-1");
    assert.equal(response.json.import.status, "queued");
    assert.match(response.json.statusUrl, /job_id=job-async-1/);
    assert.match(response.json.statusUrl, /client_id=client-1/);
  } finally {
    await server.close();
  }
});

test("knowledge import status route requires authentication before status lookup", async () => {
  let statusLookupCalled = false;
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  const server = await startServer(createApp(buildDeps({
    getAuthenticatedUser: async () => {
      throw authError;
    },
    getBusinessWebsiteImportStatus: async () => {
      statusLookupCalled = true;
      return {};
    },
  })));

  try {
    const response = await requestJson(
      server.baseUrl,
      "/api/agents/agent-1/knowledge/import/status?client_id=client-1"
    );

    assert.equal(response.status, 401);
    assert.equal(statusLookupCalled, false);
  } finally {
    await server.close();
  }
});

test("knowledge import status route is owner and agent scoped and allows latest lookup", async () => {
  const server = await startServer(createApp(buildDeps({
    requireActiveAgentAccess: async (_supabase, payload) => {
      assert.deepEqual(payload, {
        agentId: "agent-1",
        ownerUserId: "owner-1",
        clientId: "client-1",
      });
      return { id: "agent-1" };
    },
    getBusinessWebsiteImportStatus: async (_supabase, options) => {
      assert.equal(options.ownerUserId, "owner-1");
      assert.equal(options.agentId, "agent-1");
      assert.equal(options.jobId, undefined);
      assert.equal(options.clientId, "client-1");
      return {
        ok: true,
        agentId: "agent-1",
        businessId: "business-1",
        websiteUrl: "https://example.com/",
        job: {
          id: "latest-job",
          status: "running",
          phase: "crawling",
          attempts: 1,
          pageCount: 0,
          contentLength: 0,
          stalled: false,
          indexing: { status: "not_started" },
        },
        knowledge: null,
      };
    },
  })));

  try {
    const response = await requestJson(
      server.baseUrl,
      "/api/agents/agent-1/knowledge/import/status?client_id=client-1"
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.job.id, "latest-job");
    assert.equal(response.json.job.phase, "crawling");
  } finally {
    await server.close();
  }
});
