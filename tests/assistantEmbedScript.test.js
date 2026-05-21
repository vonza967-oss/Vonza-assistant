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
    this.hidden = false;
    this.allowTransparency = false;
    this.contentWindow = {};
    this.rectTop = 0;
    this.nextElementSibling = null;

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

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  getBoundingClientRect() {
    return { top: this.rectTop };
  }
}

function findDescendant(element, predicate) {
  if (predicate(element)) {
    return element;
  }

  for (const child of element.children) {
    const found = findDescendant(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

function createHarness(rootAttributes, options = {}) {
  const script = readFileSync(path.join(repoRoot, "assistant-embed.js"), "utf8");
  const root = new FakeElement("div", {
    "data-vonza-assistant": "",
    ...rootAttributes,
  });
  root.rectTop = options.rootTop || 0;
  const currentScript = new FakeElement("script");
  currentScript.src = options.scriptSrc || "https://vonza-assistant.onrender.com/assistant-embed.js";
  const listeners = new Map();
  let frameId = 0;
  const body = new FakeElement("body");
  const documentElement = new FakeElement("html");

  const document = {
    currentScript,
    body,
    documentElement,
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
    matchMedia: options.matchMedia || (() => ({ matches: false })),
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
  window.CSS = options.CSS || undefined;

  if (options.bootstrapPayload) {
    window.fetch = async (url) => {
      window.lastFetchUrl = url;
      return {
        ok: true,
        async json() {
          return options.bootstrapPayload;
        },
      };
    };
  }

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
    iframe: findDescendant(root, (child) => child.tagName === "IFRAME"),
    listeners,
    window,
    document,
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
  assert.equal(url.searchParams.get("background_scope"), null);
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
  assert.equal(url.searchParams.get("layout"), "canvas");
  assert.equal(url.searchParams.get("background_scope"), "section");
  assert.equal(harness.root.style.width, "100vw");
  assert.equal(harness.root.style.maxWidth, "100vw");
  assert.equal(harness.root.style.marginLeft, "calc(50% - 50vw)");
  assert.equal(harness.root.style.marginRight, "calc(50% - 50vw)");
  assert.equal(harness.root.style.position, "relative");
  assert.equal(harness.root.style.overflow, "hidden");
  assert.equal(harness.root.style.minHeight, "760px");
  assert.equal(harness.iframe.style.width, "100%");
  assert.equal(harness.iframe.style.background, "transparent");
  assert.equal(harness.iframe.style.minHeight, "760px");
  assert.equal(harness.iframe.style.height, "900px");
  assert.equal(harness.iframe.style.borderRadius, "0");
  assert.equal(harness.iframe.allowTransparency, true);
});

test("/assistant-embed.js supports page-takeover layout with viewport wrapper", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-surface": "flat",
    "data-background-scope": "viewport",
  }, {
    innerHeight: 900,
    rootTop: 96,
    CSS: {
      supports(property, value) {
        return property === "height" && value === "100dvh";
      },
    },
  });
  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);
  const url = new URL(harness.iframe.src);

  assert.ok(wrapper);
  assert.equal(url.searchParams.get("agent_id"), "agent-1");
  assert.equal(url.searchParams.get("size"), "full");
  assert.equal(url.searchParams.get("surface"), "flat");
  assert.equal(url.searchParams.get("layout"), "canvas");
  assert.equal(url.searchParams.get("background_scope"), "viewport");
  assert.equal(harness.root.style.width, "100%");
  assert.equal(harness.root.style.maxWidth, "100%");
  assert.equal(harness.root.style.overflow, "visible");
  assert.equal(wrapper.style.width, "100vw");
  assert.equal(wrapper.style.maxWidth, "100vw");
  assert.equal(wrapper.style.marginLeft, "calc(50% - 50vw)");
  assert.equal(wrapper.style.marginRight, "calc(50% - 50vw)");
  assert.equal(wrapper.style.minHeight, "max(0px, calc(100dvh - 96px))");
  assert.equal(wrapper.style.position, "relative");
  assert.equal(wrapper.style.overflow, "hidden");
  assert.equal(wrapper.style.overflowX, "hidden");
  assert.equal(harness.iframe.style.background, "transparent");
  assert.equal(harness.iframe.style.height, "804px");
  assert.equal(harness.iframe.style.minHeight, "804px");
  assert.equal(harness.iframe.style.borderRadius, "0");
  assert.equal(harness.iframe.allowTransparency, true);
});

test("/assistant-embed.js page-takeover respects header offset and min height", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-header-offset": "120",
    "data-min-height": "820",
  }, { innerHeight: 900 });
  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);

  assert.equal(wrapper.style.minHeight, "max(820px, calc(100vh - 120px))");
  assert.equal(harness.iframe.style.height, "820px");
  assert.equal(harness.iframe.style.minHeight, "820px");
});

test("/assistant-embed.js supports data-height full-page wrapper min-height", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-background-scope": "section",
    "data-height": "full-page",
  }, {
    innerHeight: 900,
    rootTop: 80,
  });

  assert.equal(harness.root.style.height || "", "");
  assert.equal(harness.root.style.minHeight, "max(760px, calc(100vh - 80px))");
  assert.equal(harness.iframe.style.height, "820px");
  assert.equal(harness.iframe.style.minHeight, "820px");
});

test("/assistant-embed.js data-height full-page respects header offset", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-background-scope": "section",
    "data-height": "full-page",
    "data-header-offset": "120",
  }, { innerHeight: 900 });

  assert.equal(harness.root.style.height || "", "");
  assert.equal(harness.root.style.minHeight, "max(760px, calc(100vh - 120px))");
  assert.equal(harness.iframe.style.height, "780px");
  assert.equal(harness.iframe.style.minHeight, "780px");
});

test("/assistant-embed.js does not change global body or html backgrounds by default", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-background-scope": "section",
    "data-height": "full-page",
  });

  assert.equal(harness.document.body.style.background || "", "");
  assert.equal(harness.document.body.style.backgroundColor || "", "");
  assert.equal(harness.document.documentElement.style.background || "", "");
  assert.equal(harness.document.documentElement.style.backgroundColor || "", "");
});

test("/assistant-embed.js page-takeover does not change global body or html styles", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "viewport",
  });

  assert.equal(harness.document.body.style.background || "", "");
  assert.equal(harness.document.body.style.backgroundColor || "", "");
  assert.equal(harness.document.documentElement.style.background || "", "");
  assert.equal(harness.document.documentElement.style.backgroundColor || "", "");
});

test("/assistant-embed.js applies full-page section color background from public bootstrap", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "color",
            background_color: "#123456",
          },
        },
      },
    },
  });
  await settle();

  assert.match(harness.window.lastFetchUrl, /\/widget\/bootstrap\?/);
  assert.equal(harness.root.style.backgroundColor, "#123456");
  assert.equal(harness.root.children.some((child) => child.getAttribute("data-vonza-assistant-background-overlay") !== null), false);
});

test("/assistant-embed.js applies page-takeover viewport background to takeover wrapper", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "viewport",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "image",
            background_color: "#111827",
            background_image_url: "https://cdn.example.com/takeover.webp",
            background_overlay_color: "#020617",
            background_overlay_opacity: 0.32,
            background_focal_point: "right",
          },
        },
      },
    },
  });
  await settle();

  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);
  const overlay = wrapper.children.find((child) => child.getAttribute("data-vonza-assistant-background-overlay") !== null);

  assert.match(harness.window.lastFetchUrl, /\/widget\/bootstrap\?/);
  assert.equal(harness.root.style.backgroundImage || "", "");
  assert.match(wrapper.style.backgroundImage, /https:\/\/cdn\.example\.com\/takeover\.webp/);
  assert.equal(wrapper.style.backgroundSize, "cover");
  assert.equal(wrapper.style.backgroundPosition, "right");
  assert.equal(overlay.style.pointerEvents, "none");
  assert.equal(overlay.style.opacity, "0.32");
});

test("/assistant-embed.js applies full-page section gradient background and nonblocking overlay", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "gradient",
            background_color: "#111827",
            background_gradient_to: "#2563eb",
            background_overlay_color: "#020617",
            background_overlay_opacity: 0.4,
          },
        },
      },
    },
  });
  await settle();

  const overlay = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-background-overlay") !== null);
  assert.match(harness.root.style.background, /linear-gradient\(135deg, #111827, #2563eb\)/);
  assert.equal(overlay.style.pointerEvents, "none");
  assert.equal(overlay.style.opacity, "0.4");
  assert.equal(harness.iframe.style.zIndex, "2");
});

test("/assistant-embed.js applies full-page section image background", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        fullPageConfig: {
          design: {
            backgroundType: "image",
            backgroundColor: "#111827",
            backgroundImageUrl: "/assets/front-desk/backgrounds/abstract-dark-gold.png",
            backgroundFocalPoint: "left",
          },
        },
      },
    },
  });
  await settle();

  assert.match(harness.root.style.backgroundImage, /https:\/\/vonza-assistant\.onrender\.com\/assets\/front-desk\/backgrounds\/abstract-dark-gold\.png/);
  assert.equal(harness.root.style.backgroundSize, "cover");
  assert.equal(harness.root.style.backgroundPosition, "left");
  assert.equal(harness.root.style.backgroundRepeat, "no-repeat");
});

test("/assistant-embed.js applies full-page section video background behind iframe", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "video",
            background_color: "#111827",
            background_image_url: "https://cdn.example.com/fallback.webp",
            background_video_url: "https://cdn.example.com/hero.webm",
            background_overlay_color: "#020617",
            background_overlay_opacity: 0.5,
            background_focal_point: "top",
            disable_video_on_mobile: false,
          },
        },
      },
    },
  });
  await settle();

  const video = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-background-video") !== null);
  assert.equal(video.getAttribute("src"), "https://cdn.example.com/hero.webm");
  assert.equal(video.muted, true);
  assert.equal(video.loop, true);
  assert.equal(video.autoplay, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.style.pointerEvents, "none");
  assert.equal(video.style.objectFit, "cover");
  assert.equal(video.style.objectPosition, "top");
  assert.equal(video.style.zIndex, "0");
});

test("/assistant-embed.js keeps iframe-only background scope inside the iframe", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-background-scope": "iframe",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "image",
            background_image_url: "https://cdn.example.com/bg.webp",
          },
        },
      },
    },
  });
  await settle();
  const url = new URL(harness.iframe.src);

  assert.equal(url.searchParams.get("background_scope"), "iframe");
  assert.equal(harness.root.style.backgroundImage || "", "");
  assert.equal(harness.window.lastFetchUrl, undefined);
  assert.equal(harness.iframe.style.background, "#ffffff");
});

test("/assistant-embed.js forwards data-show-title false for full-page canvas", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "full-page",
    "data-show-title": "false",
  });
  const url = new URL(harness.iframe.src);

  assert.equal(url.searchParams.get("layout"), "canvas");
  assert.equal(url.searchParams.get("show_title"), "0");
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
