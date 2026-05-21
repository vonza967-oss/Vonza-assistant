import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createApp } from "../src/app/createApp.js";
import { createChatRouter } from "../src/routes/chatRoutes.js";
import { clearChatRateLimitForTests } from "../src/utils/httpGuards.js";
import { scrubLogValue } from "../src/utils/safeLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function withEnv(overrides, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function withServer(app, fn) {
  const server = await startServer(app);
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

function createChatTestApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createChatRouter({
    getSupabaseClient: () => ({}),
    getOpenAIClient: () => ({}),
    handleChatRequest: async ({ body }) => ({
      reply: `ok ${body.message}`,
      agentId: "agent-1",
      agentKey: "agent-key",
      businessId: "business-1",
      widgetConfig: { assistantName: "Test assistant" },
    }),
    handleLeadCaptureRequest: async () => ({
      ok: true,
      agentId: "agent-1",
      businessId: "business-1",
      leadCapture: { state: "captured" },
    }),
    recordVisitorReplyFeedback: async () => ({
      ok: true,
      feedback: { agentId: "agent-1", rating: "helpful" },
    }),
    trackProductEvent: async () => null,
    ...deps,
  }));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  return app;
}

test("route-specific CORS keeps private routes non-wildcard while public widget routes remain usable", async () => {
  await withEnv({
    NODE_ENV: "test",
    PUBLIC_APP_URL: "http://127.0.0.1:3000",
    RATE_LIMIT_BACKEND: "memory",
  }, async () => {
    const app = createApp({ rootDir: repoRoot });

    await withServer(app, async (baseUrl) => {
      const dashboard = await fetch(`${baseUrl}/dashboard`, {
        headers: { Origin: "https://evil.example" },
      });
      assert.equal(dashboard.status, 200);
      assert.equal(dashboard.headers.get("access-control-allow-origin"), null);
      assert.match(dashboard.headers.get("content-security-policy") || "", /frame-ancestors 'self'/);
      assert.equal(dashboard.headers.get("x-frame-options"), "DENY");

      const privatePreflight = await fetch(`${baseUrl}/agents/messages`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "GET",
        },
      });
      assert.equal(privatePreflight.status, 403);
      assert.notEqual(privatePreflight.headers.get("access-control-allow-origin"), "*");

      const publicPreflight = await fetch(`${baseUrl}/chat`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://customer.example",
          "Access-Control-Request-Method": "POST",
        },
      });
      assert.equal(publicPreflight.status, 204);
      assert.equal(publicPreflight.headers.get("access-control-allow-origin"), "https://customer.example");
      assert.equal(publicPreflight.headers.get("access-control-allow-credentials"), null);

      const widget = await fetch(`${baseUrl}/widget`);
      assert.equal(widget.status, 200);
      assert.match(widget.headers.get("content-security-policy") || "", /frame-ancestors \*/);
      assert.equal(widget.headers.get("x-frame-options"), null);
    });
  });
});

test("public chat rate limits, route-specific limits, and abuse guards block unsafe traffic", async () => {
  await withEnv({ NODE_ENV: "test", RATE_LIMIT_BACKEND: "memory" }, async () => {
    clearChatRateLimitForTests();

    await withServer(createChatTestApp(), async (baseUrl) => {
      const normal = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What services do you offer?", agent_key: "agent-key" }),
      });
      assert.equal(normal.status, 200);

      const oversized = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "x".repeat(2001), agent_key: "agent-key" }),
      });
      assert.equal(oversized.status, 413);

      for (let index = 0; index < 9; index += 1) {
        const response = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Question ${index}`, agent_key: "agent-key", visitor_session_key: "rate-session" }),
        });
        assert.equal(response.status, index < 8 ? 200 : 429);
      }
    });

    clearChatRateLimitForTests();
    await withServer(createChatTestApp(), async (baseUrl) => {
      for (let index = 0; index < 7; index += 1) {
        const response = await fetch(`${baseUrl}/chat/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", agent_key: "agent-key", visitor_session_key: "capture-session", email: `person${index}@example.com` }),
        });
        assert.equal(response.status, index < 6 ? 200 : 429);
      }
    });

    clearChatRateLimitForTests();
    await withServer(createChatTestApp(), async (baseUrl) => {
      for (let index = 0; index < 3; index += 1) {
        const response = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "same spam payload", agent_key: "agent-key", visitor_session_key: "spam-session" }),
        });
        assert.equal(response.status, index < 2 ? 200 : 429);
      }
    });
  });
});

test("memory rate limiting fails closed outside local development", async () => {
  await withEnv({ NODE_ENV: "production", RATE_LIMIT_BACKEND: "memory" }, async () => {
    clearChatRateLimitForTests();
    await withServer(createChatTestApp(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello", agent_key: "agent-key" }),
      });

      assert.equal(response.status, 503);
      assert.match(await response.text(), /Memory rate limiting is disabled/i);
    });
  });
});

test("safe logger redacts secrets and production sensitive payloads", async () => {
  await withEnv({ NODE_ENV: "production" }, () => {
    const scrubbed = scrubLogValue({
      authorization: "Bearer eyJaaaaaaaaaaaa.bbbbbbbbbbbbb.cccccccccccc",
      openaiApiKey: "sk-proj_abcdefghijklmnopqrstuvwxyz",
      email: "customer@example.com",
      phone: "+1 555 222 3333",
      message: "I need help with a private order.",
      nested: {
        assistantAnswer: "Full visitor answer",
      },
    });

    assert.equal(scrubbed.authorization, "[redacted-secret]");
    assert.equal(scrubbed.openaiApiKey, "[redacted-secret]");
    assert.equal(scrubbed.email, "[redacted]");
    assert.equal(scrubbed.phone, "[redacted]");
    assert.equal(scrubbed.message, "[redacted]");
    assert.equal(scrubbed.nested.assistantAnswer, "[redacted]");
  });
});
