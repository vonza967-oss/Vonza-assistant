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
    this.className = "";
    this.parentElement = null;
    this.parentNode = null;
    this.textContent = "";
    this.title = "";
    this.loading = "";
    this.hidden = false;
    this.allowTransparency = false;
    this.contentWindow = {};
    this.rectTop = 0;
    this.rectBottom = 0;
    this.previousElementSibling = null;
    this.nextElementSibling = null;
    this.classList = {
      add: (...tokens) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.filter(Boolean).forEach((token) => classes.add(token));
        this.className = Array.from(classes).join(" ");
      },
      remove: (...tokens) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.forEach((token) => classes.delete(token));
        this.className = Array.from(classes).join(" ");
      },
      contains: (token) => this.className.split(/\s+/).includes(token),
      toggle: (token, force) => {
        const shouldAdd = force === undefined ? !this.classList.contains(token) : Boolean(force);
        if (shouldAdd) {
          this.classList.add(token);
        } else {
          this.classList.remove(token);
        }
        return shouldAdd;
      },
    };

    Object.entries(attributes).forEach(([name, value]) => {
      this.setAttribute(name, value);
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") {
      this.className = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    const previous = this.children[this.children.length - 1] || null;
    if (previous) {
      previous.nextElementSibling = child;
      child.previousElementSibling = previous;
    }
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  contains(child) {
    if (child === this) {
      return true;
    }

    return this.children.some((descendant) => descendant.contains(child));
  }

  matches(selector) {
    const normalized = String(selector || "").trim();

    if (!normalized) {
      return false;
    }

    if (normalized.includes(",")) {
      return normalized.split(",").some((part) => this.matches(part));
    }

    const tagAndClass = normalized.match(/^([a-z0-9-]+)?\.([a-z0-9_-]+)$/i);
    if (tagAndClass) {
      const [, tagName, className] = tagAndClass;
      return (!tagName || this.tagName.toLowerCase() === tagName.toLowerCase()) && this.classList.contains(className);
    }

    if (normalized.startsWith(".")) {
      return this.classList.contains(normalized.slice(1));
    }

    if (normalized.startsWith("#")) {
      return this.getAttribute("id") === normalized.slice(1);
    }

    if (/^\[[^\]]+\]$/.test(normalized)) {
      return this.getAttribute(normalized.slice(1, -1)) !== null;
    }

    return this.tagName.toLowerCase() === normalized.toLowerCase();
  }

  querySelectorAll(selector) {
    return findAllDescendants(this, (child) => child.matches(selector));
  }

  getBoundingClientRect() {
    return { top: this.rectTop, bottom: this.rectBottom || this.rectTop };
  }
}

function findAllDescendants(element, predicate, results = []) {
  for (const child of element.children) {
    if (predicate(child)) {
      results.push(child);
    }
    findAllDescendants(child, predicate, results);
  }

  return results;
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
  const rootParent = options.rootParentAttributes
    ? new FakeElement(options.rootParentTag || "div", options.rootParentAttributes)
    : body;
  const beforeRootElements = options.beforeRootElements || [];
  const afterRootElements = options.afterRootElements || [];

  if (rootParent !== body) {
    body.appendChild(rootParent);
  }
  beforeRootElements.forEach((element) => rootParent.appendChild(element));
  rootParent.appendChild(root);
  afterRootElements.forEach((element) => rootParent.appendChild(element));

  const document = {
    currentScript,
    body,
    documentElement,
    readyState: "complete",
    querySelectorAll(selector) {
      if (selector === "[data-vonza-assistant]") {
        return [root];
      }
      return body.querySelectorAll(selector);
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
    rootParent,
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

test("/assistant-embed.js hydrates missing public page key from allowed widget bootstrap", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "page",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          public_page_enabled: true,
          public_page_key: "page-key-1",
          design: {
            background_type: "color",
            background_color: "#f8f4ea",
          },
        },
      },
    },
  });
  await settle();
  const url = new URL(harness.iframe.src);
  const bootstrapUrl = new URL(harness.window.lastFetchUrl);

  assert.equal(url.searchParams.get("k"), "page-key-1");
  assert.equal(bootstrapUrl.searchParams.get("display_mode"), null);
  assert.equal(bootstrapUrl.searchParams.get("origin"), "https://customer.example");
  assert.equal(bootstrapUrl.searchParams.get("page_url"), "https://customer.example/page");
});

test("/assistant-embed.js data-page-reset true adds dedicated page classes and resets nearest page-builder wrapper", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "page",
    "data-page-reset": "true",
  }, {
    rootParentAttributes: {
      class: "entry-content",
    },
  });
  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);
  const url = new URL(harness.iframe.src);

  assert.equal(url.searchParams.get("background_scope"), "page");
  assert.equal(harness.root.classList.contains("vonza-page-takeover-active"), true);
  assert.equal(harness.root.classList.contains("vonza-dedicated-page-active"), true);
  assert.equal(wrapper.classList.contains("vonza-dedicated-page-active"), true);
  assert.equal(harness.document.body.classList.contains("vonza-dedicated-page-active"), true);
  assert.equal(harness.document.documentElement.classList.contains("vonza-dedicated-page-active"), true);
  assert.equal(harness.rootParent.classList.contains("vonza-dedicated-page-container"), true);
  assert.equal(harness.rootParent.style.maxWidth, "none");
  assert.equal(harness.rootParent.style.paddingLeft, "0");
  assert.equal(harness.root.style.width, "100vw");
  assert.equal(wrapper.style.minHeight, "max(0px, calc(100vh - 0px))");
  assert.equal(harness.iframe.style.height, "900px");
  assert.equal(harness.iframe.style.minHeight, "900px");
  assert.equal(harness.iframe.style.background, "transparent");
});

test("/assistant-embed.js page background scope applies takeover and safe body background with page reset", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "page",
    "data-page-reset": "true",
  }, {
    bootstrapPayload: {
      widgetConfig: {
        full_page_config: {
          design: {
            background_type: "gradient",
            background_color: "#111827",
            background_gradient_to: "#2563eb",
          },
        },
      },
    },
  });
  await settle();

  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);
  assert.match(wrapper.style.background, /linear-gradient\(135deg, #111827, #2563eb\)/);
  assert.match(harness.document.body.style.background, /linear-gradient\(135deg, #111827, #2563eb\)/);
  assert.equal(harness.document.documentElement.style.backgroundColor, "#111827");
});

test("/assistant-embed.js page background scope does not change body without page reset", async () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-background-scope": "page",
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

  const wrapper = harness.root.children.find((child) => child.getAttribute("data-vonza-assistant-takeover") !== null);
  assert.equal(wrapper.style.backgroundColor, "#123456");
  assert.equal(harness.document.body.style.backgroundColor || "", "");
  assert.equal(harness.document.body.classList.contains("vonza-dedicated-page-active"), false);
});

test("/assistant-embed.js hides scoped footer selectors only when requested", () => {
  const footer = new FakeElement("div", { class: "site-footer" });
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-page-reset": "true",
    "data-hide-page-footer": "true",
  }, {
    afterRootElements: [footer],
  });

  assert.equal(footer.hidden, true);
  assert.equal(footer.style.display, "none");
  assert.equal(footer.getAttribute("data-vonza-assistant-hidden-footer"), "");
  assert.equal(harness.root.classList.contains("vonza-dedicated-page-active"), true);
});

test("/assistant-embed.js hides scoped WordPress title selectors only when requested", () => {
  const title = new FakeElement("h1", { class: "wp-block-post-title" });
  createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
    "data-page-reset": "true",
    "data-hide-page-title": "true",
  }, {
    beforeRootElements: [title],
  });

  assert.equal(title.hidden, true);
  assert.equal(title.style.display, "none");
  assert.equal(title.getAttribute("data-vonza-assistant-hidden-title"), "");
});

test("/assistant-embed.js page reset does not run without explicit attribute", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "page-takeover",
  }, {
    rootParentAttributes: {
      class: "entry-content",
    },
  });

  assert.equal(harness.root.classList.contains("vonza-page-takeover-active"), true);
  assert.equal(harness.root.classList.contains("vonza-dedicated-page-active"), false);
  assert.equal(harness.document.body.classList.contains("vonza-dedicated-page-active"), false);
  assert.equal(harness.rootParent.classList.contains("vonza-dedicated-page-container"), false);
  assert.equal(harness.root.style.width, "100%");
});

test("/assistant-embed.js section embed does not receive takeover reset behavior", () => {
  const harness = createHarness({
    "data-agent-id": "agent-1",
    "data-layout": "section",
    "data-page-reset": "true",
    "data-hide-page-footer": "true",
  });

  assert.equal(harness.root.classList.contains("vonza-page-takeover-active"), false);
  assert.equal(harness.root.classList.contains("vonza-dedicated-page-active"), false);
  assert.equal(harness.root.children.some((child) => child.getAttribute("data-vonza-assistant-takeover") !== null), false);
  assert.equal(harness.iframe.style.borderRadius, "18px");
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
