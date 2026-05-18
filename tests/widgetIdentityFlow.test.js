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

function createWidgetHarness({
  customFetch = null,
  widgetRuntimeConfig = {},
  initialLocalStorage = {},
  location = {},
} = {}) {
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
    "entry-state",
    "chat-state",
    "identity-choice-panel",
    "identity-email-form",
    "identity-name",
    "identity-email",
    "identity-guest-button",
    "identity-email-button",
    "identity-email-cancel",
    "intro-message",
    "lead-capture-slot",
    "direct-routing-slot",
    "welcome-panel",
    "composer-shell",
    "quick-replies",
    "input",
    "send-button",
    "composer-status",
    "page-identity-inline",
    "page-identity-note",
    "page-identity-email-button",
    "page-identity-email-form",
    "page-identity-name",
    "page-identity-email",
    "page-identity-email-cancel",
    "page-identity-powered",
    "identity-reset-button",
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
    "chat-container",
    "assistant-loading-state",
    "assistant-unavailable-state",
    "assistant-unavailable-title",
    "assistant-unavailable-copy",
    "page-assistant-hero",
    "page-business-name",
    "page-business-domain",
    "page-business-mark",
    "page-business-logo",
    "page-business-initial",
    "page-assistant-name",
    "page-assistant-subtitle",
    "page-help-title",
    "page-action-list",
    "page-trust-row",
    "page-question-examples",
    "welcome-badge",
    "welcome-title",
    "welcome-copy",
  ].forEach((id) => getElement(id));

  [
    "assistant-loading-state",
    "assistant-unavailable-state",
    "page-assistant-hero",
    "page-identity-inline",
    "page-identity-email-form",
  ].forEach((id) => {
    getElement(id).hidden = true;
  });
  getElement("page-identity-powered").textContent = "Powered by Vonza";

  const documentElement = createFakeElement("documentElement");
  const document = {
    body: createFakeElement("body"),
    documentElement: {
      ...documentElement,
      classList: {
        ...documentElement.classList,
        add(...tokens) {
          documentElement.classList.add(...tokens);
        },
        remove(...tokens) {
          documentElement.classList.remove(...tokens);
        },
        toggle(token, force) {
          return documentElement.classList.toggle(token, force);
        },
        contains(token) {
          return documentElement.classList.contains(token);
        },
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

      if (selector === ".welcome-brand-subtitle") {
        return getElement("welcome-brand-subtitle");
      }

      if (selector === ".chat-container") {
        return getElement("chat-container");
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

  const localStorage = createStorage();
  Object.entries(initialLocalStorage).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
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
        search: location.search || "",
        pathname: location.pathname || "/widget",
        href: location.href || `https://example.com${location.pathname || "/widget"}${location.search || ""}`,
        origin: location.origin || "https://example.com",
      },
      localStorage,
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
    localStorage,
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
  const introMessage = harness.elements.get("intro-message");
  const welcomePanel = harness.elements.get("welcome-panel");
  const composerShell = harness.elements.get("composer-shell");
  const entryState = harness.elements.get("entry-state");
  const chatState = harness.elements.get("chat-state");

  assert.equal(input.disabled, true);
  assert.equal(harness.hooks.getWidgetPhase(), "entry");
  assert.equal(entryState.hidden, false);
  assert.equal(chatState.hidden, true);
  assert.equal(identityPanel.hidden, false);
  assert.equal(welcomePanel.hidden, false);
  assert.equal(introMessage.hidden, true);
  assert.equal(composerShell.hidden, true);
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
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.equal(entryState.hidden, true);
  assert.equal(chatState.hidden, false);
  assert.equal(introMessage.hidden, false);
  assert.equal(composerShell.hidden, false);
  assert.equal(welcomePanel.hidden, true);
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

test("fresh widget renders only the entry phase before identity is chosen", () => {
  const harness = createWidgetHarness();

  assert.equal(harness.hooks.getWidgetPhase(), "entry");
  assert.equal(harness.hooks.getDisplayMode(), "widget");
  assert.equal(harness.elements.get("entry-state").hidden, false);
  assert.equal(harness.elements.get("chat-state").hidden, true);
  assert.equal(harness.elements.get("welcome-panel").hidden, false);
  assert.equal(harness.elements.get("identity-choice-panel").hidden, false);
});

test("explicit widget mode keeps the widget shell as the default display", () => {
  const harness = createWidgetHarness({
    location: {
      search: "?mode=widget&agent_id=agent-1",
      pathname: "/widget",
      href: "https://example.com/widget?mode=widget&agent_id=agent-1",
    },
  });

  assert.equal(harness.hooks.getDisplayMode(), "widget");
  assert.equal(harness.elements.get("page-assistant-hero").hidden, true);
  assert.equal(harness.elements.get("assistant-loading-state").hidden, true);
  assert.equal(harness.elements.get("assistant-unavailable-state").hidden, true);
  assert.equal(harness.elements.get("entry-state").hidden, false);
  assert.equal(harness.elements.get("welcome-title").textContent, "Hi! How can we help today?");
  assert.equal(harness.elements.get("launcher-text").textContent, "AI front desk for your website");
});

test("normal widget quick replies ignore full-page suggested questions", () => {
  const harness = createWidgetHarness();

  harness.hooks.applyWidgetConfig({
    assistantName: "Acme Assistant",
    fullPageConfig: {
      suggestedQuestions: [
        "Full-page only question",
        "Another hosted page prompt",
      ],
    },
  });
  harness.hooks.continueIntoChat({ mode: "guest" });

  const quickRepliesHtml = harness.elements.get("quick-replies").innerHTML;
  assert.match(quickRepliesHtml, /Services/);
  assert.match(quickRepliesHtml, /Pricing/);
  assert.doesNotMatch(quickRepliesHtml, /Full-page only question/);
  assert.doesNotMatch(quickRepliesHtml, /Another hosted page prompt/);
});

test("page mode waits for a real assistant before showing the chat shell", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        assert.match(url, /mode=page/);
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                welcomeMessage: "Ask us anything about Acme.",
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
  });

  assert.equal(harness.hooks.getDisplayMode(), "page");
  assert.equal(harness.elements.get("assistant-loading-state").hidden, false);
  assert.equal(harness.elements.get("chat-container").hidden, true);
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "guest",
    email: "",
    name: "",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.elements.get("assistant-loading-state").hidden, true);
  assert.equal(harness.elements.get("chat-container").hidden, false);
  assert.equal(harness.elements.get("assistant-unavailable-state").hidden, true);
  assert.equal(harness.elements.get("page-assistant-hero").hidden, false);
  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
  assert.equal(harness.elements.get("page-business-domain").textContent, "");
  assert.equal(harness.elements.get("page-business-domain").hidden, true);
  assert.equal(harness.elements.get("page-help-title").textContent, "How can we help?");
  assert.equal(
    harness.elements.get("page-assistant-subtitle").textContent,
    "Ask about services, pricing, quotes, or contact details."
  );
  assert.match(harness.elements.get("page-action-list").innerHTML, /Request a quote/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /Ask about pricing/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /Ask about services/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /Contact details/);
  assert.doesNotMatch(harness.elements.get("page-action-list").innerHTML, /Book a time/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /I&#39;d like to request a quote\./);
  assert.equal(harness.elements.get("assistant-name").textContent, "Acme Assistant");
  assert.equal(harness.elements.get("launcher-text").textContent, "Online now");
  assert.equal(harness.elements.get("welcome-message").textContent, "Ask us anything about Acme.");
  assert.equal(harness.elements.get("entry-state").hidden, true);
  assert.equal(harness.elements.get("chat-state").hidden, false);
  assert.equal(harness.elements.get("identity-choice-panel").hidden, true);
  assert.equal(harness.elements.get("welcome-panel").hidden, true);
  assert.equal(harness.elements.get("intro-message").hidden, false);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
  assert.equal(harness.elements.get("page-identity-inline").hidden, false);
  assert.equal(
    harness.elements.get("page-identity-note").textContent,
    "You're asking as a guest. If follow-up is needed, the assistant may ask for your contact details."
  );
  assert.equal(harness.elements.get("page-identity-email-button").textContent, "Leave contact details");
  assert.equal(harness.elements.get("quick-replies").hidden, true);
  assert.doesNotMatch(harness.elements.get("page-action-list").innerHTML, /Smith &amp; Co\.|Smith & Co\./);
});

test("embedded page mode uses compact customized prompts once", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page&embedded=1",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page&embedded=1",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        assert.match(url, /mode=page/);
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                fullPageConfig: {
                  headline: "Acme support",
                  subtitle: "Ask Acme anything.",
                  suggestedQuestions: [
                    "Can I get a quote?",
                    "How do I contact Acme?",
                    "Can I get a quote?",
                    "What services do you offer?",
                    "Do you serve my area?",
                    "How quickly can you reply?",
                  ],
                },
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.hooks.getDisplayMode(), "page");
  assert.equal(harness.elements.get("page-assistant-hero").hidden, true);
  assert.equal(harness.elements.get("entry-state").hidden, true);
  assert.equal(harness.elements.get("chat-state").hidden, false);
  assert.equal(harness.elements.get("identity-choice-panel").hidden, true);
  assert.equal(harness.elements.get("welcome-panel").hidden, true);
  assert.equal(harness.elements.get("intro-message").hidden, false);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
  assert.equal(harness.elements.get("page-identity-inline").hidden, false);
  assert.equal(harness.elements.get("page-identity-note").textContent, "Asking as guest");
  assert.equal(harness.elements.get("page-identity-email-button").textContent, "Leave contact details");
  assert.equal(harness.elements.get("page-identity-powered").textContent, "Powered by Vonza");
  assert.equal(harness.elements.get("page-identity-email-form").hidden, true);
  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
  assert.equal(harness.elements.get("page-help-title").textContent, "Acme support");
  assert.equal(harness.elements.get("quick-replies").hidden, false);
  assert.match(harness.elements.get("quick-replies").innerHTML, /Can I get a quote\?/);
  assert.match(harness.elements.get("quick-replies").innerHTML, /How do I contact Acme\?/);
  assert.match(harness.elements.get("quick-replies").innerHTML, /What services do you offer\?/);
  assert.match(harness.elements.get("quick-replies").innerHTML, /Do you serve my area\?/);
  assert.doesNotMatch(harness.elements.get("quick-replies").innerHTML, /How quickly can you reply\?/);
  assert.equal((harness.elements.get("quick-replies").innerHTML.match(/quick-reply-chip/g) || []).length, 4);
});

test("assistant slug route defaults to page mode and missing assistant shows unavailable state", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "",
      pathname: "/a/acme-desk",
      href: "https://example.com/a/acme-desk",
    },
    customFetch: async (input) => {
      const url = String(input);
      assert.match(url, /agent_key=acme-desk/);
      assert.match(url, /mode=page/);
      return {
        ok: false,
        status: 404,
        async json() {
          return { error: "Agent not found" };
        },
      };
    },
  });

  assert.equal(harness.hooks.getDisplayMode(), "page");

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.elements.get("assistant-loading-state").hidden, true);
  assert.equal(harness.elements.get("page-assistant-hero").hidden, true);
  assert.equal(harness.elements.get("assistant-unavailable-state").hidden, false);
  assert.equal(harness.elements.get("assistant-unavailable-title").textContent, "Assistant unavailable");
  assert.equal(
    harness.elements.get("assistant-unavailable-copy").textContent,
    "This assistant is not available right now. Please contact the business directly."
  );
  assert.doesNotMatch(harness.elements.get("assistant-unavailable-copy").textContent, /agent_id|widget config|API/i);
});

test("assistant slug route renders a chat-first hosted page", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "",
      pathname: "/a/acme-desk",
      href: "https://example.com/a/acme-desk",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        assert.match(url, /agent_key=acme-desk/);
        assert.match(url, /mode=page/);
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                welcomeMessage: "Ask us anything about Acme.",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.hooks.getDisplayMode(), "page");
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
  assert.equal(harness.elements.get("identity-choice-panel").hidden, true);
  assert.equal(harness.elements.get("intro-message").hidden, false);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
  assert.equal(harness.elements.get("welcome-message").textContent, "Ask us anything about Acme.");
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "guest",
    email: "",
    name: "",
  });
});

test("hosted /a page applies custom full-page headline and subtitle", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "",
      pathname: "/a/acme-desk",
      href: "https://example.com/a/acme-desk",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                primaryColor: "#14b8a6",
                fullPageConfig: {
                  headline: "Get help from Acme",
                  subtitle: "Ask about repairs, pricing, quotes, or contact details.",
                  trustItems: ["Usually instant", "Acme assistant", "Contact capture available"],
                  actionCards: [
                    {
                      label: "Repairs",
                      description: "Ask about repair options.",
                      prompt: "What repairs do you offer?",
                      type: "services",
                      enabled: true,
                    },
                  ],
                },
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.elements.get("page-help-title").textContent, "Get help from Acme");
  assert.equal(
    harness.elements.get("page-assistant-subtitle").textContent,
    "Ask about repairs, pricing, quotes, or contact details."
  );
  assert.match(harness.elements.get("page-trust-row").innerHTML, /Usually instant/);
});

test("hosted /assistant page uses custom action cards and escapes saved text", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "",
      pathname: "/assistant/acme-desk",
      href: "https://example.com/assistant/acme-desk",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                full_page_config: {
                  action_cards: [
                    {
                      label: "<img src=x onerror=alert(1)>",
                      description: "Ask for a custom estimate.",
                      prompt: "I need a custom estimate.",
                      type: "quote",
                      enabled: true,
                    },
                    {
                      label: "Book a time",
                      description: "Booking should stay hidden without support.",
                      prompt: "I'd like to book a time.",
                      type: "booking",
                      enabled: true,
                    },
                    {
                      label: "Hidden card",
                      description: "Disabled",
                      prompt: "Hidden prompt",
                      type: "custom",
                      enabled: false,
                    },
                  ],
                  show_booking: true,
                  show_quote: true,
                  show_contact: true,
                },
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const actionHtml = harness.elements.get("page-action-list").innerHTML;
  assert.match(actionHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(actionHtml, /<img/i);
  assert.match(actionHtml, /I need a custom estimate\./);
  assert.doesNotMatch(actionHtml, /Book a time/);
  assert.doesNotMatch(actionHtml, /Hidden card/);
});

test("page action card prompt submits the configured starter prompt", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page",
    },
    customFetch: async (input, options = {}) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                fullPageConfig: {
                  actionCards: [
                    {
                      label: "Start quote",
                      description: "Quote prompt",
                      prompt: "Please start a quote for my project.",
                      type: "quote",
                      enabled: true,
                    },
                  ],
                },
              },
            };
          },
        };
      }

      if (url === "/chat") {
        const payload = JSON.parse(options.body);
        assert.equal(payload.message, "Please start a quote for my project.");
        assert.equal(payload.display_mode, "page");
        return {
          ok: true,
          async json() {
            return {
              reply: "I can help with that.",
              agentId: "agent-1",
              agentKey: "acme-desk",
              businessId: "business-1",
              visitorIdentity: {
                mode: "guest",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  harness.elements.get("page-action-list").dispatch("click", {
    target: {
      closest() {
        return {
          dataset: {
            pageStarterPrompt: "Please start a quote for my project.",
          },
        };
      },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(harness.fetchCalls.some((call) => call.input === "/chat"));
});

test("assistant alias route uses hosted page mode and personalized default greeting", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "",
      pathname: "/assistant/acme-desk",
      href: "https://example.com/assistant/acme-desk",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        assert.match(url, /agent_key=acme-desk/);
        assert.match(url, /mode=page/);
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
                publicAgentKey: "acme-desk",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
                websiteUrl: "https://www.acme.test/services",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
                welcomeMessage: "Hi! How can we help today?",
                widgetLogoUrl: "",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.hooks.getDisplayMode(), "page");
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.equal(harness.elements.get("page-assistant-hero").hidden, false);
  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
  assert.equal(harness.elements.get("assistant-name").textContent, "Acme Assistant");
  assert.equal(harness.elements.get("page-business-domain").textContent, "acme.test");
  assert.equal(
    harness.elements.get("welcome-message").textContent,
    "Hi, I can help with questions about Acme Co. What would you like to know?"
  );
  assert.equal(harness.elements.get("identity-choice-panel").hidden, true);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
  assert.notEqual(
    harness.elements.get("page-assistant-subtitle").textContent,
    harness.elements.get("welcome-message").textContent
  );
});

test("page mode falls back to Assistant when business and assistant names are missing", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
              },
              business: {
                id: "business-1",
              },
              widgetConfig: {},
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.elements.get("page-assistant-name").textContent, "Assistant");
  assert.equal(harness.elements.get("assistant-name").textContent, "Assistant");
  assert.equal(harness.elements.get("welcome-assistant-name").textContent, "Assistant");
  assert.doesNotMatch(harness.elements.get("page-assistant-name").textContent, /^Vonza/i);
});

test("page mode does not treat default Vonza assistant copy as business branding", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Vonza AI",
                welcomeMessage: "Hi! How can we help today?",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
  assert.equal(harness.elements.get("assistant-name").textContent, "Acme Co");
  assert.equal(
    harness.elements.get("welcome-message").textContent,
    "Hi, I can help with questions about Acme Co. What would you like to know?"
  );
  assert.equal(harness.elements.get("send-button")["aria-label"], "Send a message to Acme Co");
  assert.doesNotMatch(harness.elements.get("page-assistant-name").textContent, /^Vonza/i);
});

test("embedded page mode keeps page display tracking and compact production hooks", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page&embedded=1",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page&embedded=1",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        assert.match(url, /mode=page/);
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.equal(harness.elements.get("entry-state").hidden, true);
  assert.equal(harness.elements.get("chat-state").hidden, false);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
  assert.equal(harness.elements.get("identity-choice-panel").hidden, true);
  assert.equal(harness.elements.get("page-identity-inline").hidden, false);
  assert.equal(harness.elements.get("quick-replies").hidden, false);
  assert.match(harness.elements.get("quick-replies").innerHTML, /I&#39;d like to request a quote\./);
  assert.doesNotMatch(harness.elements.get("quick-replies").innerHTML, /Book a time|book a time/i);

  harness.elements.get("input").value = "Can I request a quote?";
  await harness.hooks.sendMessage();

  const chatCall = harness.fetchCalls.find((call) => call.input === "/chat");
  assert.ok(chatCall);
  assert.equal(JSON.parse(chatCall.options.body).display_mode, "page");
  assert.equal(harness.hooks.getDisplayMode(), "page");
  assert.equal(harness.elements.get("page-assistant-name").textContent, "Acme Co");
});

test("page action cards use safe prompts and only show booking when configured", async () => {
  const harness = createWidgetHarness({
    location: {
      search: "?agent_id=agent-1&mode=page",
      pathname: "/widget",
      href: "https://example.com/widget?agent_id=agent-1&mode=page",
    },
    customFetch: async (input) => {
      const url = String(input);

      if (url.includes("/widget/bootstrap")) {
        return {
          ok: true,
          async json() {
            return {
              agent: {
                id: "agent-1",
              },
              business: {
                id: "business-1",
                name: "Acme Co",
              },
              widgetConfig: {
                assistantName: "Acme Assistant",
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
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  let labels = plain(harness.hooks.getPageActionCards().map((card) => card.label));
  assert.deepEqual(labels, [
    "Ask about services",
    "Ask about pricing",
    "Request a quote",
    "Contact details",
  ]);
  assert.doesNotMatch(harness.elements.get("page-action-list").innerHTML, /Book a time/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /data-page-starter-prompt="How much does it cost\?"/);

  harness.hooks.applyWidgetConfig({
    assistantName: "Acme Assistant",
    businessName: "Acme Co",
    bookingUrl: "https://example.com/book",
  });

  labels = plain(harness.hooks.getPageActionCards().map((card) => card.label));
  assert.ok(labels.includes("Book a time"));
  assert.match(harness.elements.get("page-action-list").innerHTML, /Book a time/);
  assert.match(harness.elements.get("page-action-list").innerHTML, /I&#39;d like to book a time\./);

  harness.elements.get("page-action-list").dispatch("click", {
    target: {
      closest(selector) {
        assert.equal(selector, "[data-page-quick-action]");
        return {
          dataset: {
            pageStarterPrompt: "How much does it cost?",
          },
          textContent: "Ask about pricing",
        };
      },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const chatCall = harness.fetchCalls.find((call) => call.input === "/chat");
  assert.ok(chatCall);
  const payload = JSON.parse(chatCall.options.body);
  assert.equal(payload.message, "How much does it cost?");
  assert.equal(payload.display_mode, "page");
  assert.equal(payload.visitor_identity_mode, "guest");
});

test("fresh widget does not render the chat intro or composer before identity is chosen", () => {
  const harness = createWidgetHarness();

  assert.equal(harness.elements.get("intro-message").hidden, true);
  assert.equal(harness.elements.get("composer-shell").hidden, true);
  assert.equal(harness.elements.get("input").disabled, true);
  assert.equal(harness.elements.get("send-button").disabled, true);
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
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  assert.equal(harness.elements.get("entry-state").hidden, true);
  assert.equal(harness.elements.get("chat-state").hidden, false);
  assert.equal(harness.elements.get("welcome-panel").hidden, true);
  assert.equal(harness.elements.get("intro-message").hidden, false);
  assert.equal(harness.elements.get("composer-shell").hidden, false);
  assert.equal(harness.elements.get("input").disabled, false);
});

test("widget stores visitor identity with expiry metadata and can clear it", () => {
  const harness = createWidgetHarness();

  harness.hooks.continueIntoChat({
    mode: "identified",
    email: "Visitor@Example.com",
    name: "Avery Hart",
  });

  const stored = JSON.parse(harness.localStorage.getItem("vonza_visitor_identity_default"));
  assert.equal(stored.mode, "identified");
  assert.equal(stored.email, "visitor@example.com");
  assert.ok(Date.parse(stored.savedAt));
  assert.ok(Date.parse(stored.expiresAt) > Date.now());

  harness.hooks.clearVisitorIdentity();

  assert.equal(harness.localStorage.getItem("vonza_visitor_identity_default"), null);
  assert.equal(harness.hooks.getWidgetPhase(), "entry");
  assert.deepEqual(plain(harness.hooks.getVisitorIdentity()), {
    mode: "",
    email: "",
    name: "",
  });
});

test("widget accepts old identity records but expires records with TTL metadata", () => {
  const oldRecordHarness = createWidgetHarness({
    initialLocalStorage: {
      vonza_visitor_identity_default: JSON.stringify({
        mode: "guest",
      }),
    },
  });

  assert.equal(oldRecordHarness.hooks.getWidgetPhase(), "chat");
  assert.deepEqual(plain(oldRecordHarness.hooks.getVisitorIdentity()), {
    mode: "guest",
    email: "",
    name: "",
  });

  const expiredHarness = createWidgetHarness({
    initialLocalStorage: {
      vonza_visitor_identity_default: JSON.stringify({
        mode: "identified",
        email: "expired@example.com",
        name: "Expired",
        expiresAt: "2026-01-01T00:00:00.000Z",
      }),
    },
  });

  assert.equal(expiredHarness.hooks.getWidgetPhase(), "entry");
  assert.equal(expiredHarness.localStorage.getItem("vonza_visitor_identity_default"), null);
  assert.deepEqual(plain(expiredHarness.hooks.getVisitorIdentity()), {
    mode: "",
    email: "",
    name: "",
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

test("widget send flow keeps identity payloads and stays in the chat state after identity choice", async () => {
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
  assert.equal(harness.hooks.isWelcomePanelHidden(), true);
  assert.equal(harness.hooks.getWidgetPhase(), "chat");
  input.value = "What services do you offer?";
  await harness.hooks.sendMessage();

  const chatCall = harness.fetchCalls.find((call) => call.input === "/chat");
  assert.ok(chatCall);
  const payload = JSON.parse(chatCall.options.body);
  assert.equal(payload.message, "What services do you offer?");
  assert.equal(payload.display_mode, "widget");
  assert.equal(payload.visitor_identity_mode, "guest");
  assert.equal(payload.visitor_email, "");
  assert.equal(harness.hooks.isWelcomePanelHidden(), true);
  assert.equal(welcomePanel.hidden, true);
});

test("assistant output formatter preserves paragraph spacing", () => {
  const harness = createWidgetHarness();
  const html = harness.hooks.formatAssistantMessageHtml(
    "Direct answer.\n\nShort explanation, if needed.\n\nOne clear next step?"
  );

  assert.match(html, /<p>Direct answer\.<\/p><p>Short explanation, if needed\.<\/p><p>One clear next step\?<\/p>/);
});

test("assistant output formatter renders bullet responses as readable lists", () => {
  const harness = createWidgetHarness();
  const html = harness.hooks.formatAssistantMessageHtml(
    "For an accurate quote, include:\n\n- Service type\n- Timeline\n- Must-have features"
  );

  assert.match(html, /<p>For an accurate quote, include:<\/p>/);
  assert.match(html, /<ul><li>Service type<\/li><li>Timeline<\/li><li>Must-have features<\/li><\/ul>/);
});

test("assistant output formatter escapes script and HTML content", () => {
  const harness = createWidgetHarness();
  const html = harness.hooks.formatAssistantMessageHtml(
    "Safe answer <script>alert('x')</script>\n\n- <img src=x onerror=alert(1)>"
  );

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("widget source separates entry and chat phases, hides the composer before identity, omits attach and emoji controls, and preserves mobile rules", () => {
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");
  const style = readFileSync(path.join(repoRoot, "frontend", "style.css"), "utf8");
  const script = readFileSync(path.join(repoRoot, "frontend", "script.js"), "utf8");
  const embed = readFileSync(path.join(repoRoot, "embed.js"), "utf8");

  assert.match(widget, /Continue with email/);
  assert.match(widget, /Continue as guest/);
  assert.match(widget, /Reset visitor identity/);
  assert.match(widget, /adatkezelesi-tajekoztato/);
  assert.match(widget, /id="entry-state"/);
  assert.match(widget, /id="chat-state" class="widget-phase widget-phase-chat" hidden/);
  assert.match(widget, /<div class="composer-shell" id="composer-shell" hidden>/);
  assert.doesNotMatch(widget, /type="file"/);
  assert.doesNotMatch(widget, /emoji/i);
  assert.doesNotMatch(widget, /paperclip/i);
  assert.match(style, /\[hidden\]\s*\{\s*display:\s*none !important;/);
  assert.match(style, /\.widget-phase-chat/);
  assert.match(style, /\.vonza-message-body/);
  assert.match(style, /overflow-wrap:\s*break-word/);
  assert.match(widget, /id="quick-replies"/);
  assert.match(widget, /id="assistant-loading-state"/);
  assert.match(widget, /id="assistant-unavailable-state"/);
  assert.match(widget, /id="page-assistant-hero"/);
  assert.match(widget, /id="page-powered-by"/);
  assert.match(widget, /id="page-action-list"/);
  assert.match(widget, /href="\/style\.css"/);
  assert.match(widget, /src="\/script\.js"/);
  assert.doesNotMatch(widget, /class="launcher"/);
  assert.doesNotMatch(widget, /minimize/i);
  assert.doesNotMatch(widget, /close-modal/i);
  assert.match(script, /QUICK_REPLY_TOPICS/);
  assert.match(script, /PAGE_QUICK_REPLY_TOPICS/);
  assert.match(script, /data-page-quick-action/);
  assert.match(script, /DISPLAY_MODE/);
  assert.match(script, /display_mode: DISPLAY_MODE/);
  assert.match(style, /\.quick-reply-chip/);
  assert.match(style, /\.page-action-card/);
  assert.match(style, /\.reply-feedback/);
  assert.match(style, /\.vonza-mode-widget/);
  assert.match(style, /\.vonza-mode-page/);
  assert.match(script, /chat\/feedback/);
  assert.match(style, /@media \(max-width: 720px\)/);
  assert.match(style, /@media \(max-width: 420px\)/);
  assert.match(embed, /launcher-presence/);
  assert.match(embed, /launcher\.addEventListener\("click", openModal\)/);
  assert.match(embed, /closeButton\.addEventListener\("click", closeModal\)/);
  assert.match(embed, /event\.key === "Escape"/);
});

test("production page mode keeps preview mock data isolated", () => {
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");
  const script = readFileSync(path.join(repoRoot, "frontend", "script.js"), "utf8");
  const preview = readFileSync(path.join(repoRoot, "frontend", "full-page-assistant-v2-preview.js"), "utf8");

  assert.match(preview, /Smith & Co\./);
  assert.doesNotMatch(widget, /Smith & Co\.|smithco\.com/);
  assert.doesNotMatch(script, /Smith & Co\.|smithco\.com/);
});

test("production page mode has one quick action row and no launcher controls", () => {
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");

  assert.equal((widget.match(/id="quick-replies"/g) || []).length, 1);
  assert.doesNotMatch(widget, /launcher-button|widget-launcher/i);
  assert.doesNotMatch(widget, /close-modal|minimize/i);
});

test("dashboard install iframe uses compact embedded page mode while QR stays hosted", () => {
  const dashboard = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");
  const widget = readFileSync(path.join(repoRoot, "frontend", "widget.html"), "utf8");
  const styles = readFileSync(path.join(repoRoot, "frontend", "style.css"), "utf8");

  assert.match(dashboard, /function buildFullPageAssistantUrl/);
  assert.match(dashboard, /return `\$\{getPublicAppUrl\(\)\}\/a\/\$\{encodeURIComponent\(agentKey\)\}`/);
  assert.match(dashboard, /function buildEmbeddedFullPageAssistantUrl/);
  assert.match(dashboard, /url\.searchParams\.set\("embedded", "1"\)/);
  assert.match(dashboard, /inside a website section like Support, Contact, or Request a quote/);
  assert.match(dashboard, /min-height:620px;border:0;border-radius:18px;overflow:hidden/);
  assert.doesNotMatch(dashboard, /min-height:760px|100vh;border:0/);
  assert.match(widget, /page-identity-powered/);
  assert.match(styles, /embedded-mode \.page-assistant-hero:not\(\[hidden\]\)[\s\S]*display: none/);
  assert.match(styles, /embedded-mode \.page-identity-inline[\s\S]*border: 0/);
  assert.match(styles, /embedded-mode \.assistant-state[\s\S]*min-height: 220px/);
  assert.match(dashboard, /Customize full-page assistant/);
  assert.match(dashboard, /data-settings-target="front_desk"/);
});
