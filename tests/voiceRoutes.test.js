import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import express from "express";

import { createVoiceRouter } from "../src/routes/voiceRoutes.js";

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

function buildResolvedContext(overrides = {}) {
  return {
    agent: { id: "agent-1", publicAgentKey: "agent-key" },
    business: { id: "business-1", website_url: "https://allowed.example" },
    widgetConfig: {
      installId: "install-1",
      voiceConfig: {
        voiceInputEnabled: true,
        spokenRepliesEnabled: true,
        autoSendTranscript: false,
        autoPlaySpokenReplies: false,
        voice: "alloy",
        languageBehavior: "auto",
      },
      ...overrides.widgetConfig,
    },
  };
}

function createApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createVoiceRouter({
    getSupabaseClient: () => ({}),
    resolveAllowedPublicWidgetContext: async (_supabase, context) => {
      if (context.origin === "https://evil.example") {
        const error = new Error("Origin is not allowed for this install.");
        error.statusCode = 403;
        throw error;
      }

      return buildResolvedContext(deps.contextOverrides || {});
    },
    getOpenAIClient: () => deps.openai,
    trackProductEvent: async () => ({ ok: true }),
    enforceTranscribeRateLimit: (_req, _res, next) => next(),
    enforceSpeechRateLimit: (_req, _res, next) => next(),
    ...deps.routerDeps,
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

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function voiceQuery(extra = {}) {
  const params = new URLSearchParams({
    install_id: "install-1",
    origin: "https://allowed.example",
    page_url: "https://allowed.example/help",
    display_mode: "widget",
    duration_ms: "1200",
    ...extra,
  });
  return params.toString();
}

test("voice transcription rejects unsupported file types", async () => {
  let openaiCalled = false;
  const server = await startServer(createApp({
    openai: {
      audio: {
        transcriptions: {
          create: async () => {
            openaiCalled = true;
            return { text: "not reached" };
          },
        },
      },
    },
  }));

  try {
    const response = await fetch(`${server.baseUrl}/api/voice/transcribe?${voiceQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    const json = await readJson(response);

    assert.equal(response.status, 415);
    assert.match(json.error, /unsupported audio type/i);
    assert.equal(openaiCalled, false);
  } finally {
    await server.close();
  }
});

test("voice transcription rejects oversized audio before OpenAI", async () => {
  await withEnv({ VOICE_MAX_AUDIO_BYTES: "4" }, async () => {
    let openaiCalled = false;
    const server = await startServer(createApp({
      openai: {
        audio: {
          transcriptions: {
            create: async () => {
              openaiCalled = true;
              return { text: "not reached" };
            },
          },
        },
      },
    }));

    try {
      const response = await fetch(`${server.baseUrl}/api/voice/transcribe?${voiceQuery()}`, {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: Buffer.from("too-large"),
      });
      const json = await readJson(response);

      assert.equal(response.status, 413);
      assert.match(json.error, /too large/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("voice transcription requires a valid public assistant context", async () => {
  const server = await startServer(createApp({
    openai: {
      audio: {
        transcriptions: {
          create: async () => ({ text: "not reached" }),
        },
      },
    },
  }));

  try {
    const missingContext = await fetch(`${server.baseUrl}/api/voice/transcribe?duration_ms=1200`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: Buffer.from("audio"),
    });
    const missingJson = await readJson(missingContext);

    assert.equal(missingContext.status, 400);
    assert.match(missingJson.error, /install_id, agent_id, agent_key/i);

    const blockedOrigin = await fetch(`${server.baseUrl}/api/voice/transcribe?${voiceQuery({ origin: "https://evil.example" })}`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: Buffer.from("audio"),
    });
    const blockedJson = await readJson(blockedOrigin);

    assert.equal(blockedOrigin.status, 403);
    assert.match(blockedJson.error, /origin is not allowed/i);
  } finally {
    await server.close();
  }
});

test("voice transcription returns transcript when OpenAI succeeds", async () => {
  let capturedModel = "";
  const server = await startServer(createApp({
    openai: {
      audio: {
        transcriptions: {
          create: async (payload) => {
            capturedModel = payload.model;
            return {
              text: " What services do you offer? ",
              usage: { seconds: 1.2 },
            };
          },
        },
      },
    },
  }));

  try {
    const response = await fetch(`${server.baseUrl}/api/voice/transcribe?${voiceQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: Buffer.from("audio"),
    });
    const json = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(json.text, "What services do you offer?");
    assert.equal(json.duration, 1.2);
    assert.equal(capturedModel, "gpt-4o-mini-transcribe");
  } finally {
    await server.close();
  }
});

test("speech endpoint rejects too-long text and invalid voices", async () => {
  await withEnv({ VOICE_TTS_MAX_CHARS: "12" }, async () => {
    let openaiCalled = false;
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => new ArrayBuffer(0) };
            },
          },
        },
      },
    }));

    try {
      const tooLong = await fetch(`${server.baseUrl}/api/voice/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          install_id: "install-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/help",
          text: "This text is definitely too long.",
        }),
      });
      const tooLongJson = await readJson(tooLong);

      assert.equal(tooLong.status, 413);
      assert.match(tooLongJson.error, /too long/i);

      const invalidVoice = await fetch(`${server.baseUrl}/api/voice/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          install_id: "install-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/help",
          text: "Short text.",
          voice: "voice_123",
        }),
      });
      const invalidJson = await readJson(invalidVoice);

      assert.equal(invalidVoice.status, 400);
      assert.match(invalidJson.error, /voice is not available/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint returns mp3 audio when OpenAI succeeds", async () => {
  let capturedPayload = null;
  const server = await startServer(createApp({
    openai: {
      audio: {
        speech: {
          create: async (payload) => {
            capturedPayload = payload;
            return {
              arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
            };
          },
        },
      },
    },
  }));

  try {
    const response = await fetch(`${server.baseUrl}/api/voice/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        install_id: "install-1",
        origin: "https://allowed.example",
        page_url: "https://allowed.example/help",
        display_mode: "page",
        text: "Here is the answer.",
        voice: "sage",
      }),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /audio\/mpeg/);
    assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
    assert.equal(capturedPayload.model, "gpt-4o-mini-tts");
    assert.equal(capturedPayload.voice, "sage");
    assert.equal(capturedPayload.response_format, "mp3");
  } finally {
    await server.close();
  }
});

test("public frontend config does not expose OpenAI API keys", () => {
  const publicWidget = readFileSync("frontend/script.js", "utf8");
  const settingsShell = readFileSync("frontend/settings/SettingsShell.js", "utf8");

  assert.doesNotMatch(publicWidget, /OPENAI_API_KEY|sk-proj_/);
  assert.doesNotMatch(settingsShell, /OPENAI_API_KEY|sk-proj_/);
});
