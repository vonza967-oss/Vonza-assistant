import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createApp } from "../src/app/createApp.js";
import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { createChatRouter } from "../src/routes/chatRoutes.js";
import { createVoiceRouter } from "../src/routes/voiceRoutes.js";
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

function getCsp(response) {
  return response.headers.get("content-security-policy") || "";
}

function assertFramePolicy(response, { frameAncestors, xFrameOptions }) {
  assert.match(getCsp(response), new RegExp(`frame-ancestors ${frameAncestors}`));
  assert.equal(response.headers.get("x-frame-options"), xFrameOptions);
}

function assertMicrophonePolicy(response, expected) {
  const policy = response.headers.get("permissions-policy") || "";
  assert.match(policy, new RegExp(`microphone=\\(${expected}\\)`));
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

function createBootstrapTestApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => ({}),
    getWidgetBootstrap: async () => ({
      ok: true,
      agent: { id: "agent-1" },
      widgetConfig: { assistantName: "Test assistant" },
    }),
    ...deps,
  }));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  return app;
}

function createVoiceTestApp(deps = {}) {
  const app = express();
  app.use(express.json({ limit: "96kb" }));
  app.use(createVoiceRouter({
    getSupabaseClient: () => ({}),
    getOpenAIClient: () => ({}),
    transcribeAssistantAudio: async () => ({
      text: "hello",
      language: "en",
      duration: 1,
      agentId: "agent-1",
      businessId: "business-1",
      installId: "install-1",
    }),
    createAssistantSpeech: async () => ({
      audioBuffer: Buffer.from("audio"),
      contentType: "audio/mpeg",
      textLength: 5,
      voice: "alloy",
      agentId: "agent-1",
      businessId: "business-1",
      installId: "install-1",
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
      assertFramePolicy(dashboard, { frameAncestors: "'none'", xFrameOptions: "DENY" });

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

      const dashboardPolicy = dashboard.headers.get("permissions-policy") || "";
      assert.match(dashboardPolicy, /microphone=\(\)/);
    });
  });
});

test("route frame policies are explicit for dashboard, embeds, Front Desk pages, and marketing routes", async () => {
  await withEnv({
    NODE_ENV: "test",
    PUBLIC_APP_URL: "http://127.0.0.1:3000",
    RATE_LIMIT_BACKEND: "memory",
  }, async () => {
    const app = createApp({ rootDir: repoRoot });

    await withServer(app, async (baseUrl) => {
      const dashboard = await fetch(`${baseUrl}/dashboard`);
      assert.equal(dashboard.status, 200);
      assertFramePolicy(dashboard, { frameAncestors: "'none'", xFrameOptions: "DENY" });
      assert.match(getCsp(dashboard), /script-src 'self' 'unsafe-inline'/);
      assert.match(getCsp(dashboard), /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);

      for (const assetPath of ["/dashboard.js", "/dashboard.css", "/settings/SettingsShell.js", "/settings/settings.css"]) {
        const response = await fetch(`${baseUrl}${assetPath}`);
        assert.equal(response.status, 200, assetPath);
        assertFramePolicy(response, { frameAncestors: "'none'", xFrameOptions: "DENY" });
        assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
      }

      for (const assetPath of ["/embed.js", "/embed-v1.js", "/embed-lite.js", "/assistant-embed.js"]) {
        const response = await fetch(`${baseUrl}${assetPath}`);
        assert.equal(response.status, 200, assetPath);
        assertFramePolicy(response, { frameAncestors: "\\*", xFrameOptions: null });
        assert.match(response.headers.get("content-type") || "", /javascript/);
        assertMicrophonePolicy(response, "");
      }

      for (const widgetPath of ["/widget?agent_id=agent-1&embedded=1", "/widget?agent_id=agent-1&mode=page&embedded=1"]) {
        const response = await fetch(`${baseUrl}${widgetPath}`);
        assert.equal(response.status, 200, widgetPath);
        assertFramePolicy(response, { frameAncestors: "\\*", xFrameOptions: null });
        assertMicrophonePolicy(response, "self");
      }

      const plainWidget = await fetch(`${baseUrl}/widget`);
      assert.equal(plainWidget.status, 200);
      assertFramePolicy(plainWidget, { frameAncestors: "'none'", xFrameOptions: "DENY" });
      assertMicrophonePolicy(plainWidget, "self");

      for (const hostedPath of ["/a/agent-key", "/assistant/agent-key"]) {
        const response = await fetch(`${baseUrl}${hostedPath}`);
        assert.equal(response.status, 200, hostedPath);
        assertFramePolicy(response, { frameAncestors: "'none'", xFrameOptions: "DENY" });
        assertMicrophonePolicy(response, "self");
      }

      for (const previewPath of ["/dashboard-v2-fixture", "/dashboard-v2-preview", "/full-page-assistant-v2-preview"]) {
        const response = await fetch(`${baseUrl}${previewPath}`);
        assert.equal(response.status, 200, previewPath);
        assertFramePolicy(response, { frameAncestors: "'none'", xFrameOptions: "DENY" });
        assertMicrophonePolicy(response, "");
      }

      const assistantEmbedMatrix = await fetch(`${baseUrl}/assistant-embed-matrix`);
      assert.equal(assistantEmbedMatrix.status, 200);
      assertFramePolicy(assistantEmbedMatrix, { frameAncestors: "'none'", xFrameOptions: "DENY" });
      assertMicrophonePolicy(assistantEmbedMatrix, "self");

      for (const publicPath of [
        "/",
        "/hu",
        "/hu/features",
        "/hu/product",
        "/hu/pricing",
        "/hu/about",
        "/features",
        "/product",
        "/pricing",
        "/about",
        "/download/mac",
        "/aszf",
        "/impresszum",
        "/adatkezelesi-tajekoztato",
        "/cookie-tajekoztato",
      ]) {
        const response = await fetch(`${baseUrl}${publicPath}`);
        assert.equal(response.status, 200, publicPath);
        assertFramePolicy(response, { frameAncestors: "'self'", xFrameOptions: "SAMEORIGIN" });
        assert.doesNotMatch(getCsp(response), /frame-ancestors \*/);
        assertMicrophonePolicy(response, "");
      }

      for (const publicRedirectPath of ["/desktop", "/how-it-works", "/contact", "/terms", "/privacy", "/cookies", "/imprint"]) {
        const response = await fetch(`${baseUrl}${publicRedirectPath}`, { redirect: "manual" });
        assert.equal(response.status, 302, publicRedirectPath);
        assertFramePolicy(response, { frameAncestors: "'self'", xFrameOptions: "SAMEORIGIN" });
        assert.doesNotMatch(getCsp(response), /frame-ancestors \*/);
        assertMicrophonePolicy(response, "");
      }
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
      assert.match(await response.text(), /Assistant unavailable/i);
    });
  });
});

test("public bootstrap hides missing distributed rate limit backend details", async () => {
  await withEnv({
    NODE_ENV: "production",
    RATE_LIMIT_BACKEND: "upstash",
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
    REDIS_URL: undefined,
    REDIS_TOKEN: undefined,
  }, async () => {
    clearChatRateLimitForTests();
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => {
      warnings.push(args);
    };

    try {
      await withServer(createBootstrapTestApp(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/widget/bootstrap?agent_key=agent-key`);
        const json = await response.json();

        assert.equal(response.status, 503);
        assert.deepEqual(json, { error: "Assistant unavailable" });
        assert.doesNotMatch(JSON.stringify(json), /Distributed rate limit backend/i);
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.match(JSON.stringify(warnings), /rate_limit_backend_not_configured/);
  });
});

test("configured distributed rate limit backend allows public bootstrap", async () => {
  await withEnv({
    NODE_ENV: "production",
    RATE_LIMIT_BACKEND: "upstash",
    UPSTASH_REDIS_REST_URL: "https://upstash.example",
    UPSTASH_REDIS_REST_TOKEN: "token-present",
  }, async () => {
    clearChatRateLimitForTests();
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith("https://upstash.example")) {
        return originalFetch(url, options);
      }
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify([
        { result: 1 },
        { result: "OK" },
        { result: 60 },
      ]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      await withServer(createBootstrapTestApp(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/widget/bootstrap?agent_key=agent-key`);
        const json = await response.json();

        assert.equal(response.status, 200);
        assert.equal(json.ok, true);
        assert.equal(response.headers.get("ratelimit-limit"), "60");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://upstash.example/pipeline");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token-present");
  });
});

test("local development memory fallback allows public bootstrap", async () => {
  await withEnv({
    NODE_ENV: "development",
    RATE_LIMIT_BACKEND: undefined,
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
    REDIS_URL: undefined,
    REDIS_TOKEN: undefined,
  }, async () => {
    clearChatRateLimitForTests();

    await withServer(createBootstrapTestApp(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/widget/bootstrap?agent_key=agent-key`);
      const json = await response.json();

      assert.equal(response.status, 200);
      assert.equal(json.ok, true);
      assert.equal(response.headers.get("ratelimit-limit"), "60");
    });
  });
});

test("public feedback and voice routes remain rate-limited", async () => {
  await withEnv({ NODE_ENV: "test", RATE_LIMIT_BACKEND: "memory" }, async () => {
    clearChatRateLimitForTests();
    await withServer(createChatTestApp(), async (baseUrl) => {
      for (let index = 0; index < 11; index += 1) {
        const response = await fetch(`${baseUrl}/chat/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_key: "agent-key",
            session_key: "feedback-session",
            assistant_message_key: `message-${index}`,
            rating: "helpful",
          }),
        });
        assert.equal(response.status, index < 10 ? 200 : 429);
      }
    });

    clearChatRateLimitForTests();
    await withServer(createVoiceTestApp(), async (baseUrl) => {
      for (let index = 0; index < 11; index += 1) {
        const response = await fetch(`${baseUrl}/api/voice/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_key: "agent-key",
            session_key: "voice-session",
            text: `Hello ${index}`,
          }),
        });
        assert.equal(response.status, index < 10 ? 200 : 429);
      }
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
