import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createWaitlistApp } from "../src/app/createWaitlistApp.js";

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
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null,
    text,
  };
}

test("waitlist app serves the standalone page with restrictive framing headers", async () => {
  const server = await startServer(createWaitlistApp({
    rootDir: process.cwd(),
    limitWaitlistApplications: (_req, _res, next) => next(),
  }));

  try {
    const response = await requestJson(server.baseUrl, "/", {
      headers: {
        Accept: "text/html",
      },
    });

    assert.equal(response.status, 200);
    assert.match(response.text, /Korai hozzáférés a magyar weboldali AI widgethez/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  } finally {
    await server.close();
  }
});

test("waitlist POST validates and returns public success response", async () => {
  let capturedPayload = null;
  const server = await startServer(createWaitlistApp({
    rootDir: process.cwd(),
    getSupabaseClient: () => ({ from: () => ({}) }),
    limitWaitlistApplications: (_req, _res, next) => next(),
    createApplication: async (_supabase, payload, context) => {
      capturedPayload = { payload, context };
      return {
        status: "new",
      };
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/api/waitlist/applications", {
      method: "POST",
      body: JSON.stringify({
        name: "Anna Kovács",
        company: "Példa Kft.",
        focusArea: "Ajánlatkérés",
        websiteUrl: "https://pelda.hu",
        contact: "anna@pelda.hu",
      }),
      headers: {
        "User-Agent": "Route Test",
      },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.json, {
      received: true,
      status: "new",
    });
    assert.equal(capturedPayload.payload.company, "Példa Kft.");
    assert.equal(capturedPayload.context.userAgent, "Route Test");
  } finally {
    await server.close();
  }
});

test("waitlist POST maps public validation failures without leaking internals", async () => {
  const server = await startServer(createWaitlistApp({
    rootDir: process.cwd(),
    getSupabaseClient: () => ({ from: () => ({}) }),
    limitWaitlistApplications: (_req, _res, next) => next(),
    createApplication: async () => {
      const error = new Error("database details");
      error.statusCode = 503;
      throw error;
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/api/waitlist/applications", {
      method: "POST",
      body: JSON.stringify({
        name: "Anna Kovács",
        company: "Példa Kft.",
        focusArea: "Ajánlatkérés",
        websiteUrl: "https://pelda.hu",
        contact: "anna@pelda.hu",
      }),
    });

    assert.equal(response.status, 503);
    assert.equal(response.json.error, "This service is temporarily unavailable. Please try again shortly.");
    assert.doesNotMatch(JSON.stringify(response.json), /database details/i);
  } finally {
    await server.close();
  }
});
