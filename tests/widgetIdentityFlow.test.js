import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createFakeElement(id = "") {
  const listeners = new Map();

  return {
    id,
    hidden: false,
    value: "",
    disabled: false,
    textContent: "",
    innerHTML: "",
    dataset: {},
    style: {
      setProperty() {},
    },
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.({
        currentTarget: this,
        preventDefault() {},
        ...event,
      });
    },
    focus() {},
    appendChild() {},
    setAttribute(name, value) {
      this[name] = value === "" ? true : value;
    },
    removeAttribute(name) {
      if (name === "hidden") {
        this.hidden = false;
      } else {
        delete this[name];
      }
    },
  };
}

function createWidgetHarness({ customFetch = null } = {}) {
  const script = readFileSync(path.join(repoRoot, "frontend", "script.js"), "utf8");
  const elements = new Map();
  const fetchCalls = [];
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, createFakeElement(id));
    }
    return elements.get(id);
  };

  const metaTitle = {
    setAttribute() {},
  };
  const inputArea = createFakeElement("input-area");

  [
    "identity-choice-panel",
    "identity-email-form",
    "identity-name",
    "identity-email",
    "identity-guest-button",
    "identity-email-button",
    "identity-email-cancel",
    "welcome-content",
    "identity-summary",
    "intro-message",
    "lead-capture-slot",
    "direct-routing-slot",
    "welcome-panel",
    "input",
    "send-button",
    "composer-status",
    "assistant-name",
    "launcher-text",
    "welcome-message",
    "intro-avatar",
    "brand-mark",
    "brand-mark-logo",
    "brand-mark-v",
    "powered-by",
    "chat",
  ].forEach((id) => getElement(id));

  const document = {
    body: createFakeElement("body"),
    documentElement: {
      classList: {
        add() {},
      },
      style: {
        setProperty() {},
      },
    },
    getElementById(id) {
      return getElement(id);
    },
    querySelector(selector) {
      if (selector === ".input-area") {
        return inputArea;
      }

      if (selector === ".brand-mark") {
        return getElement("brand-mark");
      }

      if (selector === 'meta[name="apple-mobile-web-app-title"]') {
        return metaTitle;
      }

      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return createFakeElement(tagName);
    },
  };

  const context = {
    console,
    document,
    fetch: async (input, options = {}) => {
      fetchCalls.push({ input: String(input), options });

      if (typeof customFetch === "function") {
        return customFetch(input, options);
      }

      return {
        ok: false,
        async json() {
          return { error: "not configured" };
        },
      };
    },
    navigator: {},
    URL,
    URLSearchParams,
    window: {
      location: {
        search: "",
        href: "https://example.com/widget",
        origin: "https://example.com",
      },
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      crypto: {
        randomUUID() {
          return "uuid-1";
        },
      },
      VonzaWidgetConfig: {},
      addEventListener() {},
    },
    globalThis: null,
  };

  context.window.fetch = context.fetch;
  context.globalThis = context;

  vm.runInNewContext(script, context, { filename: "frontend/script.js" });

  return {
    hooks: context.window.__VONZA_WIDGET_TEST_HOOKS__,
    elements,
    fetchCalls,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("widget can continue as guest and build a guest payload", () => {
  const harness = createWidgetHarness();
  const input = harness.elements.get("input");

  assert.equal(input.disabled, false);
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "guest",
    email: "",
    name: "",
  });

  harness.hooks.continueIntoChat({
    mode: "guest",
  });

  assert.equal(input.disabled, false);
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "guest",
    email: "",
    name: "",
  });
  assert.deepEqual(plain(harness.hooks.buildVisitorIdentityPayload(harness.hooks.getVisitorIdentity())), {
    visitor_identity: {
      mode: "guest",
      email: "",
      name: "",
    },
    visitor_identity_mode: "guest",
    visitor_email: "",
    visitor_name: "",
  });
});

test("widget can continue with email and build identified chat payloads", () => {
  const harness = createWidgetHarness();

  harness.hooks.continueIntoChat({
    mode: "identified",
    email: "Visitor@Example.com",
    name: "Avery Hart",
  });

  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "identified",
    email: "visitor@example.com",
    name: "Avery Hart",
  });
  assert.deepEqual(plain(harness.hooks.buildVisitorIdentityPayload(harness.hooks.getVisitorIdentity())), {
    visitor_identity: {
      mode: "identified",
      email: "visitor@example.com",
      name: "Avery Hart",
    },
    visitor_identity_mode: "identified",
    visitor_email: "visitor@example.com",
    visitor_name: "Avery Hart",
  });
});

test("widget persists continue-with-email identity as a captured lead", async () => {
  const harness = createWidgetHarness({
    customFetch: async (input) => ({
      ok: String(input) === "/chat/capture",
      async json() {
        return {
          leadCapture: {
            id: "lead-1",
            state: "captured",
            contact: {
              email: "visitor@example.com",
              name: "Avery Hart",
            },
          },
          visitorIdentity: {
            mode: "identified",
            email: "visitor@example.com",
            name: "Avery Hart",
          },
        };
      },
    }),
  });

  harness.hooks.continueIntoChat({
    mode: "identified",
    email: "Visitor@Example.com",
    name: "Avery Hart",
  }, { capture: true });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const captureCall = harness.fetchCalls.find((call) => call.input === "/chat/capture");
  assert.ok(captureCall);
  const payload = JSON.parse(captureCall.options.body);
  assert.equal(payload.action, "submit");
  assert.equal(payload.visitor_session_key, "uuid-1");
  assert.equal(payload.visitor_identity_mode, "identified");
  assert.equal(payload.email, "visitor@example.com");
  assert.equal(payload.preferred_channel, "email");
});

test("widget does not infer identity from an email without explicit mode", () => {
  const harness = createWidgetHarness();
  const identity = harness.hooks.normalizeVisitorIdentityState({
    email: "stale@example.com",
    name: "Stale Visitor",
  });

  assert.deepEqual(plain(identity), {
    mode: "",
    email: "",
    name: "",
  });
});

test("widget renders custom header logo and falls back safely when unset", () => {
  const harness = createWidgetHarness();
  const logo = harness.elements.get("brand-mark-logo");
  const mark = harness.elements.get("brand-mark-v");

  harness.hooks.applyWidgetConfig({
    assistantName: "Acme Desk",
    widgetLogoUrl: "data:image/png;base64,iVBORw0KGgo=",
  });

  assert.equal(logo.hidden, false);
  assert.equal(logo.src, "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(mark.textContent, "A");

  harness.hooks.applyWidgetConfig({
    assistantName: "Fallback Desk",
    widgetLogoUrl: "",
  });

  assert.equal(logo.hidden, true);
  assert.equal(logo.src, undefined);
  assert.equal(mark.textContent, "F");
});
