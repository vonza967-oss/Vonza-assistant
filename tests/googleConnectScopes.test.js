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

test("google connect start forwards read-only Gmail scopes when provided", async () => {
  let capturedScopes = null;
  const server = await startServer(createApp({
    getSupabaseClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async () => ({
      id: "agent-1",
      businessId: "business-1",
    }),
    getAgentWorkspaceSnapshot: async () => ({
      id: "agent-1",
      businessId: "business-1",
      name: "Vonza Operator",
      assistantName: "Vonza Operator",
    }),
    createGoogleConnectionStart: async (_supabase, payload) => {
      capturedScopes = payload.scopes || null;
      return {
        ok: true,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
      };
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/agents/google/connect/start", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        scopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
      }),
    });

    assert.equal(response.status, 200);
    assert.match(response.json.authUrl, /accounts\.google\.com/);
    assert.deepEqual(capturedScopes, [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]);
  } finally {
    await server.close();
  }
});
