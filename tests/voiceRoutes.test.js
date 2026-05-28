import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import express from "express";

import { createVoiceRouter } from "../src/routes/voiceRoutes.js";
import { createSpeechAuthorization } from "../src/services/voice/voiceSpeechTokenService.js";

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
    agent: {
      id: "agent-1",
      publicAgentKey: "agent-key",
      ownerUserId: "owner-1",
      accessStatus: "active",
      ...overrides.agent,
    },
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
    getOwnerBillingSnapshot: async () => ({
      ownerUserId: "owner-1",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      usage: { isCapped: false },
    }),
    recordEstimatedUsage: async () => [],
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

function buildSpeechToken({
  text = "Here is the answer.",
  sessionKey = "voice-session",
  agent = { id: "agent-1", publicAgentKey: "agent-key" },
  businessId = "business-1",
  widgetConfig = buildResolvedContext().widgetConfig,
  displayMode = "page",
  nowMs,
} = {}) {
  return createSpeechAuthorization({
    agent,
    businessId,
    widgetConfig,
    sessionKey,
    reply: text,
    displayMode,
    nowMs,
  })?.token;
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
  let recordedUsage = null;
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
    routerDeps: {
      recordEstimatedUsage: async (_supabase, payload) => {
        recordedUsage = payload;
        return [];
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
    assert.equal(recordedUsage.ownerUserId, "owner-1");
    assert.equal(recordedUsage.entries[0].usageSource, "voice_transcription");
    assert.equal(recordedUsage.entries[0].metadata.audioBytes, 5);
  } finally {
    await server.close();
  }
});

test("voice transcription provider failures return safe public errors", async () => {
  const server = await startServer(createApp({
    openai: {
      audio: {
        transcriptions: {
          create: async () => {
            throw new Error("OpenAI provider quota stack sk-test-secret");
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

    assert.equal(response.status, 503);
    assert.equal(json.code, "voice_transcription_unavailable");
    assert.match(json.error, /voice is temporarily unavailable/i);
    assert.doesNotMatch(json.error, /openai|provider|quota|stack|sk-test/i);
  } finally {
    await server.close();
  }
});

test("capped owner blocks voice transcription before OpenAI", async () => {
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
    routerDeps: {
      getOwnerBillingSnapshot: async () => ({
        usage: { isCapped: true },
      }),
      recordEstimatedUsage: async () => {
        throw new Error("usage should not be recorded when capped");
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

    assert.equal(response.status, 402);
    assert.match(json.error, /reached.*ai capacity/i);
    assert.equal(openaiCalled, false);
  } finally {
    await server.close();
  }
});

test("inactive owner access blocks voice transcription before OpenAI", async () => {
  for (const accessStatus of ["suspended", "pending"]) {
    let billingLookups = 0;
    let openaiCalled = false;
    const server = await startServer(createApp({
      contextOverrides: {
        agent: { accessStatus },
      },
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
      routerDeps: {
        getOwnerBillingSnapshot: async () => {
          billingLookups += 1;
          return { usage: { isCapped: false } };
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

      assert.equal(response.status, 403);
      assert.match(json.error, /voice is temporarily unavailable/i);
      assert.equal(billingLookups, 0);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  }
});

test("billing schema failure returns safe voice transcription error before OpenAI", async () => {
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
    routerDeps: {
      getOwnerBillingSnapshot: async () => {
        const error = new Error("column owner_ai_usage_ledger.estimated_cost_cents does not exist");
        error.code = "schema_not_ready";
        throw error;
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

    assert.equal(response.status, 503);
    assert.match(json.error, /voice is temporarily unavailable/i);
    assert.doesNotMatch(json.error, /schema|supabase|ledger|estimated_cost/i);
    assert.equal(openaiCalled, false);
  } finally {
    await server.close();
  }
});

test("transcription rate limit runs before voice service logic", async () => {
  let serviceCalled = false;
  const server = await startServer(createApp({
    routerDeps: {
      transcribeAssistantAudio: async () => {
        serviceCalled = true;
        return {
          text: "not reached",
        };
      },
      enforceTranscribeRateLimit: (_req, res) => {
        res.status(429).json({ error: "Too many requests" });
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

    assert.equal(response.status, 429);
    assert.equal(json.error, "Too many requests");
    assert.equal(serviceCalled, false);
  } finally {
    await server.close();
  }
});

test("speech endpoint rejects too-long text and invalid voices", async () => {
  await withEnv({ VOICE_TTS_MAX_CHARS: "12", VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    const tooLongText = "This text is definitely too long.";
    const invalidVoiceText = "Short text.";
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
          session_key: "voice-session",
          text: tooLongText,
          speech_token: buildSpeechToken({ text: tooLongText }),
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
          session_key: "voice-session",
          text: invalidVoiceText,
          voice: "voice_123",
          speech_token: buildSpeechToken({ text: invalidVoiceText }),
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

test("speech endpoint rejects arbitrary text without token", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    let billingLookups = 0;
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
            },
          },
        },
      },
      routerDeps: {
        getOwnerBillingSnapshot: async () => {
          billingLookups += 1;
          return { usage: { isCapped: false } };
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
          session_key: "voice-session",
          text: "Arbitrary text.",
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 401);
      assert.match(json.error, /speech authorization is required/i);
      assert.equal(billingLookups, 0);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint rejects changed text with valid token", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    let billingLookups = 0;
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
            },
          },
        },
      },
      routerDeps: {
        getOwnerBillingSnapshot: async () => {
          billingLookups += 1;
          return { usage: { isCapped: false } };
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
          session_key: "voice-session",
          text: "Changed answer.",
          speech_token: buildSpeechToken({ text: "Original answer." }),
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 403);
      assert.match(json.error, /speech authorization is invalid/i);
      assert.equal(billingLookups, 0);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint rejects changed session or agent context", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    const text = "Here is the answer.";
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
            },
          },
        },
      },
      routerDeps: {
        resolveAllowedPublicWidgetContext: async (_supabase, context) => {
          if (context.agentId === "agent-2") {
            return buildResolvedContext({
              widgetConfig: { installId: "install-2" },
            });
          }

          return buildResolvedContext();
        },
      },
    }));

    try {
      const changedSession = await fetch(`${server.baseUrl}/api/voice/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          install_id: "install-1",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/help",
          session_key: "different-session",
          text,
          speech_token: buildSpeechToken({ text, sessionKey: "voice-session" }),
        }),
      });
      const changedSessionJson = await readJson(changedSession);

      assert.equal(changedSession.status, 403);
      assert.match(changedSessionJson.error, /speech authorization is invalid/i);

      const changedAgent = await fetch(`${server.baseUrl}/api/voice/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "agent-2",
          origin: "https://allowed.example",
          page_url: "https://allowed.example/help",
          session_key: "voice-session",
          text,
          speech_token: buildSpeechToken({ text, sessionKey: "voice-session" }),
        }),
      });
      const changedAgentJson = await readJson(changedAgent);

      assert.equal(changedAgent.status, 403);
      assert.match(changedAgentJson.error, /speech authorization is invalid/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint rejects changed display mode context", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    const text = "Here is the answer.";
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
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
          display_mode: "widget",
          session_key: "voice-session",
          text,
          speech_token: buildSpeechToken({ text, displayMode: "page" }),
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 403);
      assert.match(json.error, /speech authorization is invalid/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint rejects expired token", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret", VOICE_SPEECH_TOKEN_TTL_SECONDS: "30" }, async () => {
    let openaiCalled = false;
    const text = "Here is the answer.";
    const token = buildSpeechToken({ text, nowMs: Date.now() - 120_000 });
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
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
          session_key: "voice-session",
          text,
          speech_token: token,
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 401);
      assert.match(json.error, /expired/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("speech endpoint returns mp3 audio when OpenAI succeeds", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let capturedPayload = null;
    let recordedUsage = null;
    const text = "Here is the answer.";
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
      routerDeps: {
        recordEstimatedUsage: async (_supabase, payload) => {
          recordedUsage = payload;
          return [];
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
          session_key: "voice-session",
          text,
          voice: "sage",
          speech_token: buildSpeechToken({ text }),
        }),
      });
      const bytes = new Uint8Array(await response.arrayBuffer());

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /audio\/mpeg/);
      assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
      assert.equal(capturedPayload.model, "gpt-4o-mini-tts");
      assert.equal(capturedPayload.voice, "sage");
      assert.equal(capturedPayload.response_format, "mp3");
      assert.equal(recordedUsage.ownerUserId, "owner-1");
      assert.equal(recordedUsage.entries[0].usageSource, "voice_speech");
      assert.equal(recordedUsage.entries[0].metadata.textLength, text.length);
      assert.equal(recordedUsage.entries[0].metadata.voice, "sage");
    } finally {
      await server.close();
    }
  });
});

test("speech provider failures return safe public errors", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    const text = "Here is the answer.";
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              throw new Error("OpenAI provider audio stack sk-test-secret");
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
          session_key: "voice-session",
          text,
          speech_token: buildSpeechToken({ text }),
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 503);
      assert.equal(json.code, "voice_speech_unavailable");
      assert.match(json.error, /voice is temporarily unavailable/i);
      assert.doesNotMatch(json.error, /openai|provider|audio stack|sk-test/i);
    } finally {
      await server.close();
    }
  });
});

test("capped owner blocks speech before OpenAI", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    const text = "Here is the answer.";
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
            },
          },
        },
      },
      routerDeps: {
        getOwnerBillingSnapshot: async () => ({
          usage: { isCapped: true },
        }),
        recordEstimatedUsage: async () => {
          throw new Error("usage should not be recorded when capped");
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
          session_key: "voice-session",
          text,
          speech_token: buildSpeechToken({ text }),
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 402);
      assert.match(json.error, /reached.*ai capacity/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("billing schema failure returns safe speech error before OpenAI", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    let openaiCalled = false;
    const text = "Here is the answer.";
    const server = await startServer(createApp({
      openai: {
        audio: {
          speech: {
            create: async () => {
              openaiCalled = true;
              return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
            },
          },
        },
      },
      routerDeps: {
        getOwnerBillingSnapshot: async () => {
          const error = new Error("relation owner_billing_accounts was not found");
          error.code = "schema_not_ready";
          throw error;
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
          session_key: "voice-session",
          text,
          speech_token: buildSpeechToken({ text }),
        }),
      });
      const json = await readJson(response);

      assert.equal(response.status, 503);
      assert.match(json.error, /voice is temporarily unavailable/i);
      assert.doesNotMatch(json.error, /schema|supabase|owner_billing|relation/i);
      assert.equal(openaiCalled, false);
    } finally {
      await server.close();
    }
  });
});

test("inactive owner access blocks speech before OpenAI", async () => {
  await withEnv({ VOICE_SPEECH_TOKEN_SECRET: "voice-test-secret" }, async () => {
    for (const accessStatus of ["suspended", "pending"]) {
      let billingLookups = 0;
      let openaiCalled = false;
      const text = "Here is the answer.";
      const server = await startServer(createApp({
        contextOverrides: {
          agent: { accessStatus },
        },
        openai: {
          audio: {
            speech: {
              create: async () => {
                openaiCalled = true;
                return { arrayBuffer: async () => Uint8Array.from([1]).buffer };
              },
            },
          },
        },
        routerDeps: {
          getOwnerBillingSnapshot: async () => {
            billingLookups += 1;
            return { usage: { isCapped: false } };
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
            session_key: "voice-session",
            text,
            speech_token: buildSpeechToken({ text }),
          }),
        });
        const json = await readJson(response);

        assert.equal(response.status, 403);
        assert.match(json.error, /voice is temporarily unavailable/i);
        assert.equal(billingLookups, 0);
        assert.equal(openaiCalled, false);
      } finally {
        await server.close();
      }
    }
  });
});

test("speech rate limit runs before voice service logic", async () => {
  let serviceCalled = false;
  const server = await startServer(createApp({
    routerDeps: {
      createAssistantSpeech: async () => {
        serviceCalled = true;
        return {
          audioBuffer: Buffer.from([1]),
          contentType: "audio/mpeg",
        };
      },
      enforceSpeechRateLimit: (_req, res) => {
        res.status(429).json({ error: "Too many requests" });
      },
    },
  }));

  try {
    const response = await fetch(`${server.baseUrl}/api/voice/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Here is the answer." }),
    });
    const json = await readJson(response);

    assert.equal(response.status, 429);
    assert.equal(json.error, "Too many requests");
    assert.equal(serviceCalled, false);
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
