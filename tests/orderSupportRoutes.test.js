import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";

function createApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    limitWidgetBootstrap: (_req, _res, next) => next(),
    limitPublicInstallSignal: (_req, _res, next) => next(),
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

async function requestJson(baseUrl, pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.auth === false ? {} : { Authorization: "Bearer owner-token" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null,
    text,
  };
}

function buildRouteDeps(overrides = {}) {
  return {
    getSupabaseClient: () => ({ stub: "supabase" }),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async (_supabase, options) => {
      if (options.agentId === "agent-2") {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }

      return {
        id: options.agentId || "agent-1",
        ownerUserId: options.ownerUserId,
      };
    },
    ...overrides,
  };
}

test("authenticated owner can read order support settings for an active agent", async () => {
  let receivedOptions = null;
  const server = await startServer(createApp(buildRouteDeps({
    getAgentOrderSupportSettings: async (_supabase, options) => {
      receivedOptions = options;
      return {
        agentId: options.agentId,
        ownerUserId: options.ownerUserId,
        enabled: true,
        provider: "internal",
        providerStatus: "connected",
        supportedActions: ["order_lookup", "shipping_tracking"],
        approvalMode: "read_only",
        persistenceAvailable: true,
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/agent-1/order-support");

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.orderSupport.enabled, true);
    assert.equal(response.json.orderSupport.providerStatus, "connected");
    assert.deepEqual(receivedOptions, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
    });
    assert.deepEqual(response.json.options.providers, ["internal", "shopify", "woocommerce"]);
  } finally {
    await server.close();
  }
});

test("order support settings route requires active owner access", async () => {
  let serviceCalled = false;
  const server = await startServer(createApp(buildRouteDeps({
    getAgentOrderSupportSettings: async () => {
      serviceCalled = true;
      return {};
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/agent-2/order-support");

    assert.equal(response.status, 403);
    assert.equal(serviceCalled, false);
  } finally {
    await server.close();
  }
});

test("authenticated owner can save order support settings without secrets", async () => {
  let receivedOptions = null;
  const server = await startServer(createApp(buildRouteDeps({
    upsertAgentOrderSupportSettings: async (_supabase, options) => {
      receivedOptions = options;
      return {
        agentId: options.agentId,
        ownerUserId: options.ownerUserId,
        enabled: options.enabled,
        provider: options.provider,
        providerStatus: options.providerStatus,
        supportedActions: options.supportedActions,
        approvalMode: options.approvalMode,
        escalationDestination: options.escalationDestination,
        persistenceAvailable: true,
      };
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/agent-1/order-support", {
      method: "POST",
      body: JSON.stringify({
        enabled: "true",
        provider: "internal",
        provider_status: "connected",
        supported_actions: ["order_lookup", "shipping_tracking", "shipping_address"],
        approval_mode: "change_requests",
        escalation_destination: "support@business.example",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.orderSupport.enabled, true);
    assert.deepEqual(receivedOptions, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      connectionId: undefined,
      enabled: true,
      provider: "internal",
      providerStatus: "connected",
      approvalMode: "change_requests",
      supportedActions: ["order_lookup", "shipping_tracking", "shipping_address"],
      escalationDestination: "support@business.example",
      metadata: undefined,
    });
  } finally {
    await server.close();
  }
});

test("order support settings route rejects secret-like provider fields", async () => {
  let upsertCalled = false;
  const server = await startServer(createApp(buildRouteDeps({
    upsertAgentOrderSupportSettings: async () => {
      upsertCalled = true;
      return {};
    },
  })));

  try {
    const response = await requestJson(server.baseUrl, "/agents/agent-1/order-support", {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        provider: "shopify",
        api_key: "should-not-be-accepted",
      }),
    });

    assert.equal(response.status, 400);
    assert.match(response.json.error, /does not accept secret/i);
    assert.equal(upsertCalled, false);
  } finally {
    await server.close();
  }
});
