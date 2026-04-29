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
  const classes = new Set();

  return {
    id,
    hidden: false,
    value: "",
    disabled: false,
    textContent: "",
    innerHTML: "",
    dataset: {},
    children: [],
    style: {
      setProperty() {},
    },
    classList: {
      add(...tokens) {
        tokens.forEach((token) => classes.add(token));
      },
      remove(...tokens) {
        tokens.forEach((token) => classes.delete(token));
      },
      toggle(token, force) {
        if (force === true) {
          classes.add(token);
          return true;
        }

        if (force === false) {
          classes.delete(token);
          return false;
        }

        if (classes.has(token)) {
          classes.delete(token);
          return false;
        }

        classes.add(token);
        return true;
      },
      contains(token) {
        return classes.has(token);
      },
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
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {
      this.removed = true;
    },
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

function createWidgetHarness({ customFetch = null, widgetRuntimeConfig = {} } = {}) {
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
    "welcome-assistant-name",
    "launcher-text",
    "welcome-message",
    "intro-avatar",
    "brand-mark",
    "brand-mark-logo",
    "brand-mark-v",
    "welcome-brand-logo",
    "welcome-brand-v",
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

      if (selector === ".welcome-brand-mark") {
        return getElement("welcome-brand-mark");
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
      VonzaWidgetConfig: widgetRuntimeConfig,
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

test("widget can continue as guest and build a guest payload", async () => {
  const harness = createWidgetHarness({
    customFetch: async (input) => ({
      ok: String(input) === "/chat/capture",
      async json() {
        return {
          leadCapture: {
            id: "lead-guest",
            state: "none",
          },
          visitorIdentity: {
            mode: "guest",
            email: "",
            name: "",
          },
        };
      },
    }),
  });
  const input = harness.elements.get("input");
  const identityPanel = harness.elements.get("identity-choice-panel");
  const welcomeContent = harness.elements.get("welcome-content");

  assert.equal(input.disabled, true);
  assert.equal(identityPanel.hidden, false);
  assert.equal(welcomeContent.hidden, true);
  assert.equal(harness.hooks.hasChosenVisitorIdentity(), false);
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "",
    email: "",
    name: "",
  });
  assert.equal(harness.fetchCalls.length, 0);

  harness.hooks.continueIntoChat({
    mode: "guest",
  }, { capture: true });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(input.disabled, false);
  assert.equal(identityPanel.hidden, true);
  assert.equal(welcomeContent.hidden, false);
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

  const captureCall = harness.fetchCalls.find((call) => call.input === "/chat/capture");
  assert.ok(captureCall);
  const payload = JSON.parse(captureCall.options.body);
  assert.equal(payload.action, "choose_guest");
  assert.equal(payload.visitor_identity_mode, "guest");
  assert.equal(payload.email, "");
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
  const welcomeLogo = harness.elements.get("welcome-brand-logo");
  const mark = harness.elements.get("brand-mark-v");
  const welcomeMark = harness.elements.get("welcome-brand-v");

  harness.hooks.applyWidgetConfig({
    assistantName: "Acme Desk",
    widgetLogoUrl: "data:image/png;base64,iVBORw0KGgo=",
  });

  assert.equal(logo.hidden, false);
  assert.equal(welcomeLogo.hidden, false);
  assert.equal(logo.src, "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(welcomeLogo.src, "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(mark.textContent, "A");
  assert.equal(welcomeMark.textContent, "A");

  harness.hooks.applyWidgetConfig({
    assistantName: "Fallback Desk",
    widgetLogoUrl: "",
  });

  assert.equal(logo.hidden, true);
  assert.equal(welcomeLogo.hidden, true);
  assert.equal(logo.src, undefined);
  assert.equal(welcomeLogo.src, undefined);
  assert.equal(mark.textContent, "F");
  assert.equal(welcomeMark.textContent, "F");
});

test("widget modernizes legacy welcome defaults without auto-selecting a visitor mode", () => {
  const harness = createWidgetHarness();

  harness.hooks.applyWidgetConfig({
    assistantName: "Vonza Assistant",
    welcomeMessage: "How may I be of your service today?",
    launcherText: "YOUR PERSONAL ASSISTANT",
    primaryColor: "#10a37f",
    secondaryColor: "#0c7f75",
  });

  assert.equal(harness.elements.get("launcher-text").textContent, "AI front desk for your website");
  assert.equal(harness.elements.get("welcome-message").textContent, "Hi! How can we help today?");
  assert.equal(harness.elements.get("welcome-assistant-name").textContent, "Vonza Assistant");
  assert.equal(harness.hooks.hasChosenVisitorIdentity(), false);
});

test("widget send flow keeps identity payloads and hides the welcome panel after the first message", async () => {
  const harness = createWidgetHarness({
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              widgetConfig: {
                assistantName: "Vonza Assistant",
              },
            };
          },
        };
      }

      if (url === "/chat") {
        return {
          ok: true,
          async json() {
            return {
              reply: "We can help with that.",
              visitorIdentity: {
                mode: "guest",
                email: "",
                name: "",
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
    widgetRuntimeConfig: {
      websiteUrl: "https://example.com",
    },
  });
  const input = harness.elements.get("input");
  const welcomePanel = harness.elements.get("welcome-panel");

  harness.hooks.continueIntoChat({ mode: "guest" });
  input.value = "What services do you offer?";
  await harness.hooks.sendMessage();

  const chatCall = harness.fetchCalls.find((call) => call.input === "/chat");
  assert.ok(chatCall);
  const payload = JSON.parse(chatCall.options.body);
  assert.equal(payload.message, "What services do you offer?");
  assert.equal(payload.visitor_identity_mode, "guest");
  assert.equal(payload.visitor_email, "");
  assert.equal(harness.hooks.isWelcomePanelHidden(), true);
  assert.equal(welcomePanel.classList.contains("is-hidden"), true);
});

test("widget source keeps the welcome choices visible, omits attach and emoji controls, and preserves mobile rules", () => {
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");
  const style = readFileSync(path.join(repoRoot, "frontend", "style.css"), "utf8");
  const embed = readFileSync(path.join(repoRoot, "embed.js"), "utf8");

  assert.match(widget, /Continue with email/);
  assert.match(widget, /Continue as guest/);
  assert.match(widget, /adatkezelesi-tajekoztato/);
  assert.doesNotMatch(widget, /type="file"/);
  assert.doesNotMatch(widget, /emoji/i);
  assert.doesNotMatch(widget, /paperclip/i);
  assert.match(style, /@media \(max-width: 720px\)/);
  assert.match(style, /@media \(max-width: 420px\)/);
  assert.match(embed, /launcher-presence/);
  assert.match(embed, /launcher\.addEventListener\("click", openModal\)/);
  assert.match(embed, /closeButton\.addEventListener\("click", closeModal\)/);
  assert.match(embed, /event\.key === "Escape"/);
});
