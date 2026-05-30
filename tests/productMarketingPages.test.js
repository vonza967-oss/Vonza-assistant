import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "../src/app/createApp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function startServer() {
  const server = http.createServer(createApp({ rootDir: repoRoot }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function withServer(fn) {
  const server = await startServer();
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

async function getHtml(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200, pathname);
  assert.match(response.headers.get("content-type") || "", /html/);
  return response.text();
}

test("public product marketing pages render with product-specific dashboard CTAs", async () => {
  await withServer(async (baseUrl) => {
    const frontDesk = await getHtml(baseUrl, "/front-desk");
    assert.match(frontDesk, /data-marketing-page="frontDesk"/);
    assert.match(frontDesk, /Front Desk is the recommended Vonza product/);
    assert.match(frontDesk, /href="\/dashboard\/front-desk\?from=site"/);
    assert.doesNotMatch(frontDesk, /href="\/widget"/);

    const websiteWidget = await getHtml(baseUrl, "/website-widget");
    assert.match(websiteWidget, /data-marketing-page="websiteWidget"/);
    assert.match(websiteWidget, /Website Widget adds Vonza to an existing site/);
    assert.match(websiteWidget, /href="\/dashboard\/widget\?from=site"/);
    assert.match(websiteWidget, /on-site embedded assistant/i);

    const voiceAgent = await getHtml(baseUrl, "/voice-agent");
    assert.match(voiceAgent, /data-marketing-page="voiceAgent"/);
    assert.match(voiceAgent, /configured web voice conversations/i);
    assert.match(voiceAgent, /href="\/dashboard\/voice\?from=site"/);
    assert.match(voiceAgent, /not positioned as a phone-line or telephony replacement/i);
  });
});

test("homepage and product page link to separate product marketing pages", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/", "/product"]) {
      const html = await getHtml(baseUrl, pathname);
      assert.match(html, /href="\/front-desk"/, pathname);
      assert.match(html, /href="\/website-widget"/, pathname);
      assert.match(html, /href="\/voice-agent"/, pathname);
    }
  });
});

test("/widget still returns the runtime widget document", async () => {
  await withServer(async (baseUrl) => {
    const html = await getHtml(baseUrl, "/widget");
    assert.match(html, /<title id="page-title">Vonza AI<\/title>/);
    assert.match(html, /id="assistant-name"/);
    assert.doesNotMatch(html, /data-marketing-page=/);
    assert.doesNotMatch(html, /Website Widget adds Vonza to an existing site/);
  });
});

test("pricing plan checkout links stay on account-capacity plan checkout paths", async () => {
  await withServer(async (baseUrl) => {
    const html = await getHtml(baseUrl, "/pricing");

    for (const planKey of ["starter", "growth", "pro"]) {
      assert.match(html, new RegExp(`data-plan-key="${planKey}"`));
      assert.match(html, new RegExp(`href="/dashboard\\?from=site&amp;plan=${planKey}"`));
    }

    assert.doesNotMatch(html, /dashboard\/front-desk\?from=site&amp;plan=/);
    assert.doesNotMatch(html, /dashboard\/widget\?from=site&amp;plan=/);
    assert.doesNotMatch(html, /dashboard\/voice\?from=site&amp;plan=/);
  });
});
