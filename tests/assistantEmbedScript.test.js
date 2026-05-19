import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

class FakeElement {
  constructor(tagName, attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.style = {};
    this.textContent = "";
    this.title = "";
    this.loading = "";
    this.allowTransparency = false;
    this.contentWindow = {};
    this.rectTop = 0;

    Object.entries(attributes).forEach(([name, value]) => {
      this.setAttribute(name, value);
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  getBoundingClientRect() {
    return { top: this.rectTop };
  }
}

function createHarness(rootAttributes, options = {}) {
  const script = readFileSync(path.join(repoRoot, "assistant-embed.js"), "utf8");
  const root = new FakeElement("div", {
    "data-vonza-assistant": "",
    ...rootAttributes,
  });
  const currentScript = new FakeElement("script");
  currentScript.src = options.scriptSrc || "https://vonza-assistant.onrender.com/assistant-embed.js";
  const listeners = new Map();
  let frameId = 0;

  const document = {
    currentScript,
    readyState: "complete",
    querySelectorAll(selector) {
      return selector === "[data-vonza-assistant]" ? [root] : [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementsByTagName(tagName) {
      return tagName === "script" ? [currentScript] : [];
    },
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
  };
  const window = {
    document,
    location: {
      href: "https://customer.example/page",
      origin: "https://customer.example",
    },
    innerHeight: options.innerHeight || 900,
    visualViewport: options.visualViewport || null,
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    requestAnimationFrame(callback) {
      frameId += 1;
      callback();
      return frameId;
    },
    cancelAnimationFrame() {},
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
  };
  const context = {
    window,
    document,
    URL,
    console,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  };

  vm.runInNewContext(script, context, { filename: "assistant-embed.js" });

  return {
    root,
    iframe: root.children[0],
    listeners,
    window,
  };
}

test("/assistant-embed.js smart script creates section iframe URL with standard size", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "section",
  });
  const url = new URL(harness.iframe.src);

  assert.equal(url.origin, "https://vonza-assistant.onrender.com");
  assert.equal(url.pathname, "/widget");
  assert.equal(url.searchParams.get("agent_id"), "agent-1");
  assert.equal(url.searchParams.get("mode"), "page");
  assert.equal(url.searchParams.get("embedded"), "1");
  assert.equal(url.searchParams.get("variant"), "smart");
  assert.equal(url.searchParams.get("size"), "standard");
  assert.equal(url.searchParams.get("surface"), null);
  assert.equal(harness.iframe.style.width, "100%");
  assert.equal(harness.iframe.style.minHeight, "640px");
  assert.equal(harness.iframe.style.height, "640px");
  assert.equal(harness.iframe.style.borderRadius, "18px");
});

test("/assistant-embed.js smart script creates full-page iframe URL with full size and flat surface", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
  });
  const url = new URL(harness.iframe.src);

  assert.equal(url.searchParams.get("agent_id"), "agent-1");
  assert.equal(url.searchParams.get("mode"), "page");
  assert.equal(url.searchParams.get("embedded"), "1");
  assert.equal(url.searchParams.get("variant"), "smart");
  assert.equal(url.searchParams.get("size"), "full");
  assert.equal(url.searchParams.get("surface"), "flat");
  assert.equal(harness.iframe.style.width, "100%");
  assert.equal(harness.iframe.style.minHeight, "760px");
  assert.equal(harness.iframe.style.height, "900px");
  assert.equal(harness.iframe.style.borderRadius, "0");
});

test("/assistant-embed.js supports explicit data-surface", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "section",
    "data-surface": "transparent",
  });
  const url = new URL(harness.iframe.src);

  assert.equal(url.searchParams.get("surface"), "transparent");
  assert.equal(harness.iframe.style.background, "transparent");
  assert.equal(harness.iframe.allowTransparency, true);
});

test("/assistant-embed.js supports data-header-offset for full-page height", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-header-offset": "120",
  }, { innerHeight: 900 });

  harness.iframe.rectTop = 400;
  harness.listeners.get("resize")();

  assert.equal(harness.iframe.style.height, "780px");
});

test("/assistant-embed.js listens for valid embedded-height messages", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "section",
  });
  const messageHandler = harness.listeners.get("message");

  messageHandler({
    origin: "https://malicious.example",
    source: harness.iframe.contentWindow,
    data: {
      type: "vonza:embedded-height",
      height: 920,
    },
  });
  assert.equal(harness.iframe.style.height, "640px");

  messageHandler({
    origin: "https://vonza-assistant.onrender.com",
    source: harness.iframe.contentWindow,
    data: {
      type: "vonza:embedded-height",
      height: 920,
    },
  });
  assert.equal(harness.iframe.style.height, "920px");

  messageHandler({
    origin: "https://vonza-assistant.onrender.com",
    source: harness.iframe.contentWindow,
    data: {
      type: "vonza:embedded-height",
      height: 200,
    },
  });
  assert.equal(harness.iframe.style.height, "640px");
});
