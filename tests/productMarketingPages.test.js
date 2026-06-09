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

async function withEnv(overrides, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function getHtml(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200, pathname);
  assert.match(response.headers.get("content-type") || "", /html/);
  return response.text();
}

async function getHtmlResponse(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  assert.equal(response.status, 200, pathname);
  assert.match(response.headers.get("content-type") || "", /html/);
  return { response, text };
}

async function getManualRedirect(baseUrl, pathname) {
  return fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
}

test("non-widget product marketing pages redirect to the Website Widget page", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/front-desk", "/voice-agent", "/how-it-works"]) {
      const response = await getManualRedirect(baseUrl, pathname);
      assert.equal(response.status, 302, pathname);
      assert.equal(response.headers.get("location"), "/website-widget", pathname);
    }

    const websiteWidget = await getHtml(baseUrl, "/website-widget");
    assert.match(websiteWidget, /data-marketing-page="websiteWidget"/);
    assert.match(websiteWidget, /Website Widget for quick customer answers on your site/);
    assert.match(websiteWidget, /AI agent on your website in 5 minutes/i);
    assert.match(websiteWidget, /href="\/website-widget\/dashboard\?from=site"/);
    assert.match(websiteWidget, /Existing Website Widget runtime/i);
    assert.doesNotMatch(websiteWidget, /href="\/dashboard\/front-desk|href="\/dashboard\/voice|Voice Agent|Enterprise Request Desk|\bQDH\b|ESG|Hotel Concierge/i);
  });
});

test("website widget dashboard routes serve the private dashboard document", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/website-widget/dashboard", "/widget/dashboard"]) {
      const { response, text } = await getHtmlResponse(baseUrl, pathname);

      assert.match(response.headers.get("cache-control") || "", /no-store/, pathname);
      assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/, pathname);
      assert.equal(response.headers.get("x-frame-options"), "DENY", pathname);
      assert.match(text, /id="dashboard-root"/, pathname);
      assert.match(text, /\/dashboard\.js\?v=/, pathname);
      assert.doesNotMatch(text, /<title id="page-title">Vonza AI<\/title>/, pathname);
      assert.doesNotMatch(text, /id="assistant-name"/, pathname);
      assert.doesNotMatch(text, /src="\/embed(?:-lite)?\.js/, pathname);
    }
  });
});

test("legacy dashboard product routes redirect to the Website Widget dashboard", async () => {
  await withServer(async (baseUrl) => {
    const cases = [
      ["/dashboard", "/website-widget/dashboard"],
      ["/dashboard?from=site", "/website-widget/dashboard?from=site"],
      ["/dashboard/widget", "/website-widget/dashboard"],
      ["/dashboard/front-desk", "/website-widget/dashboard"],
      ["/dashboard/voice", "/website-widget/dashboard"],
      ["/generator", "/website-widget/dashboard"],
    ];

    for (const [pathname, location] of cases) {
      const response = await getManualRedirect(baseUrl, pathname);
      assert.equal(response.status, 302, pathname);
      assert.equal(response.headers.get("location"), location, pathname);
    }
  });
});

test("homepage and product page expose Website Widget only", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/", "/product"]) {
      const html = await getHtml(baseUrl, pathname);
      assert.match(html, /href="\/website-widget"/, pathname);
      assert.match(html, /Website Widget for quick customer answers on your site/, pathname);
      assert.match(html, /AI agent on your website in 5 minutes/i, pathname);
      assert.doesNotMatch(html, /href="\/front-desk"|href="\/voice-agent"|Vonza is one company with three products|Voice Agent|Enterprise Request Desk|\bQDH\b|ESG|Hotel Concierge/i, pathname);
    }
  });
});

test("global marketing navigation exposes Website Widget only", async () => {
  await withServer(async (baseUrl) => {
    const html = await getHtml(baseUrl, "/");

    assert.match(html, /<a href="\/website-widget" data-nav-page="websiteWidget">Website Widget<\/a>/);
    assert.match(html, /<a href="\/website-widget">Website Widget<\/a>/);
    assert.doesNotMatch(html, /<a href="\/front-desk"|<a href="\/voice-agent"|>Front Desk<\/a>|>Voice Agent<\/a>/);
  });
});

test("/widget and embed runtimes are still served", async () => {
  await withServer(async (baseUrl) => {
    const html = await getHtml(baseUrl, "/widget");
    assert.match(html, /<title id="page-title">Vonza AI<\/title>/);
    assert.match(html, /id="assistant-name"/);
    assert.doesNotMatch(html, /data-marketing-page=/);
    assert.doesNotMatch(html, /Website Widget for quick customer answers on your site/);

    for (const pathname of ["/embed.js", "/embed-lite.js", "/assistant-embed.js"]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      const text = await response.text();
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get("content-type") || "", /javascript|application\/octet-stream|text\/plain/i, pathname);
      assert.match(text, /Vonza|assistant|widget/i, pathname);
    }
  });
});

test("production widget pilot disables non-widget product routes while keeping widget routes active", { concurrency: false }, async () => {
  await withEnv({
    NODE_ENV: "production",
    VONZA_DEPLOY_ENV: "production",
  }, async () => {
    await withServer(async (baseUrl) => {
      for (const pathname of ["/website-widget", "/website-widget/dashboard", "/widget/dashboard", "/widget"]) {
        const response = await fetch(`${baseUrl}${pathname}`);
        assert.equal(response.status, 200, pathname);
      }

      for (const pathname of ["/embed.js", "/embed-lite.js", "/assistant-embed.js"]) {
        const response = await fetch(`${baseUrl}${pathname}`);
        assert.equal(response.status, 200, pathname);
      }

      for (const [pathname, location] of [
        ["/dashboard", "/website-widget/dashboard"],
        ["/dashboard/widget", "/website-widget/dashboard"],
        ["/dashboard/front-desk", "/website-widget/dashboard"],
        ["/dashboard/voice", "/website-widget/dashboard"],
      ]) {
        const response = await getManualRedirect(baseUrl, pathname);
        assert.equal(response.status, 302, pathname);
        assert.equal(response.headers.get("location"), location, pathname);
      }

      const disabledPages = [
        "/qdh",
        "/quote-desk-hu",
        "/qdh/setup",
        "/quote-desk-hu/setup",
        "/qdh/intake",
        "/quote-desk-hu/intake",
        "/qdh/dashboard",
        "/quote-desk-hu/dashboard",
        "/enterprise-request-desk",
        "/esg-request-desk",
        "/enterprise-request-desk/setup",
        "/esg-request-desk/setup",
        "/enterprise-request-desk/intake",
        "/esg-request-desk/intake",
        "/enterprise-request-desk/demo",
        "/esg-request-desk/demo",
        "/enterprise-request-desk/dashboard",
        "/esg-request-desk/dashboard",
        "/front-desk",
        "/voice-agent",
        "/how-it-works",
      ];

      for (const pathname of disabledPages) {
        const response = await getManualRedirect(baseUrl, pathname);
        assert.equal(response.status, 302, pathname);
        assert.equal(response.headers.get("location"), "/website-widget", pathname);
      }

      for (const pathname of [
        "/qdh/intake-fixture",
        "/quote-desk-hu/dashboard-fixture",
        "/enterprise-request-desk/intake-fixture",
        "/esg-request-desk/dashboard-fixture",
        "/qdh-dashboard.html",
        "/qdh-dashboard.js",
        "/enterprise-request-desk-dashboard.html",
        "/enterprise-request-desk-demo.js",
        "/full-page-assistant-v2-preview.html",
      ]) {
        const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
        assert.equal(response.status, 404, pathname);
      }

      for (const pathname of [
        "/quote-desk-hu/setup",
        "/quote-desk-hu/intake-requests",
        "/enterprise-request-desk/setup",
        "/enterprise-request-desk/demo/analyze",
      ]) {
        const response = await fetch(`${baseUrl}${pathname}`, {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        assert.equal(response.status, 404, pathname);
      }
    });
  });
});

test("pricing page remains widget-focused and does not expose product checkout links", async () => {
  await withServer(async (baseUrl) => {
    const html = await getHtml(baseUrl, "/pricing");

    assert.match(html, /Website Widget for quick customer answers on your site/);
    assert.match(html, /href="\/website-widget\/dashboard\?from=site"/);
    assert.match(html, /19,900 HUF\/month/);
    assert.match(html, /49,900 HUF\/month/);
    assert.match(html, /99,900 HUF\/month/);
    assert.doesNotMatch(html, /dashboard\/front-desk|dashboard\/widget|dashboard\/voice|data-product-checkout|data-product-plan-key|Buy Voice Agent|Buy Front Desk/i);
  });
});
