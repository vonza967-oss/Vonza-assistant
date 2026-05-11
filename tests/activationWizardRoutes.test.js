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
