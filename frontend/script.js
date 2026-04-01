const searchParams = new URLSearchParams(window.location.search);
const EMBEDDED_MODE = searchParams.get("embedded") === "1";
const STORED_AGENT_KEY = window.localStorage.getItem("vonza_agent_key") || "";
const AGENT_ID =
  searchParams.get("agent_id") ||
  window.VonzaWidgetConfig?.agentId ||
  "";
const AGENT_KEY =
  searchParams.get("agent_key") ||
  STORED_AGENT_KEY ||
  window.VonzaWidgetConfig?.agentKey ||
  "";
const BUSINESS_ID =
  searchParams.get("business_id") ||
  window.VonzaWidgetConfig?.businessId ||
  "";
const WEBSITE_URL =
  searchParams.get("website_url") ||
  window.VonzaWidgetConfig?.websiteUrl ||
  "";

const DEFAULT_WIDGET_CONFIG = {
  assistantName: "Vonza AI",
  welcomeMessage: "How may I be of your service today?",
  buttonLabel: "Chat with Vonza",
  launcherText: "YOUR PERSONAL ASSISTANT",
  primaryColor: "#10a37f",
  secondaryColor: "#0c7f75",
  themeMode: "dark",
};

const conversationHistory = [];
let widgetConfig = { ...DEFAULT_WIDGET_CONFIG };
let hasHiddenWelcomePanel = false;

function trimText(value) {
  return String(value || "").trim();
}

function addToHistory(role, content) {
  conversationHistory.push({ role, content });

  if (conversationHistory.length > 12) {
    conversationHistory.splice(0, conversationHistory.length - 12);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAssistantMark(name = widgetConfig.assistantName) {
  return (name || "V").trim().charAt(0).toUpperCase() || "V";
}

function hasAssistantConfig() {
  return Boolean(AGENT_ID || AGENT_KEY || BUSINESS_ID || WEBSITE_URL);
}

function hideWelcomePanel() {
  if (hasHiddenWelcomePanel) {
    return;
  }

  document.getElementById("welcome-panel")?.classList.add("is-hidden");
  hasHiddenWelcomePanel = true;
}

function setComposerStatus(message) {
  const statusEl = document.getElementById("composer-status");

  if (statusEl) {
    statusEl.textContent = message;
  }
}

function applyWidgetConfig(config = {}) {
  widgetConfig = {
    ...DEFAULT_WIDGET_CONFIG,
    ...config,
  };

  document.title = widgetConfig.assistantName;
  document.documentElement.style.setProperty("--brand-primary", widgetConfig.primaryColor);
  document.documentElement.style.setProperty("--brand-secondary", widgetConfig.secondaryColor);
  document.getElementById("assistant-name").textContent = widgetConfig.assistantName;
  document.getElementById("launcher-text").textContent = widgetConfig.launcherText;
  document.getElementById("welcome-message").textContent = widgetConfig.welcomeMessage;
  document.getElementById("intro-avatar").textContent = getAssistantMark();
  document.getElementById("brand-mark-v").textContent = getAssistantMark();
  document.getElementById("send-button").textContent = widgetConfig.buttonLabel;
  document.getElementById("powered-by").textContent = `Powered by ${widgetConfig.assistantName}`;
  setComposerStatus("Ask about services, pricing, contact details, or anything your visitors would want to know.");
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", widgetConfig.assistantName);
}

async function loadWidgetBootstrap() {
  if (!hasAssistantConfig()) {
    applyWidgetConfig({
      ...DEFAULT_WIDGET_CONFIG,
      welcomeMessage: "No assistant configured yet. Please create one first.",
    });
    setComposerStatus("Create an assistant first, then return here to preview the customer experience.");
    return;
  }

  const bootstrapUrl = new URL("/widget/bootstrap", window.location.origin);

  if (AGENT_ID) bootstrapUrl.searchParams.set("agent_id", AGENT_ID);
  if (AGENT_KEY) bootstrapUrl.searchParams.set("agent_key", AGENT_KEY);
  if (BUSINESS_ID) bootstrapUrl.searchParams.set("business_id", BUSINESS_ID);
  if (WEBSITE_URL) bootstrapUrl.searchParams.set("website_url", WEBSITE_URL);

  try {
    const response = await fetch(bootstrapUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load widget configuration");
    }

    applyWidgetConfig(data.widgetConfig || {});
    setComposerStatus("Your assistant is ready to answer questions using the current website knowledge.");
  } catch (error) {
    console.error("Vonza assistant bootstrap failed:", error);
    applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
    setComposerStatus("The assistant loaded with default styling. You can still test the experience.");
  }
}

function appendMessage(chat, role, text, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}${options.typing ? " typing" : ""}`;
  if (options.error) {
    wrapper.classList.add("error");
  }

  const avatar = role === "user" ? "You" : getAssistantMark();
  const label = role === "user" ? "You" : widgetConfig.assistantName;
  const body = options.typing
    ? `<div class="typing-dots"><span></span><span></span><span></span></div>`
    : `<p>${escapeHtml(text)}</p>`;

  wrapper.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble">
      <p class="message-label">${escapeHtml(label)}</p>
      ${body}
    </div>
  `;

  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
  return wrapper;
}

async function sendMessage() {
  const input = document.getElementById("input");
  const chat = document.getElementById("chat");
  const button = document.getElementById("send-button");

  const message = input.value.trim();
  const historySnapshot = conversationHistory.slice(-6);

  if (!message) return;

  hideWelcomePanel();

  if (!hasAssistantConfig()) {
    console.error(
      "Vonza assistant configuration error: missing agent_id, agent_key, business_id, and website_url"
    );
    appendMessage(
      chat,
      "bot",
      "No assistant configured yet. Please create one first.",
      { error: true }
    );
    setComposerStatus("Set up your assistant in Vonza before testing the widget here.");
    return;
  }

  appendMessage(chat, "user", message);
  input.value = "";
  button.disabled = true;
  input.disabled = true;
  setComposerStatus(`${widgetConfig.assistantName} is preparing a grounded answer...`);

  const loading = appendMessage(chat, "bot", "", { typing: true });

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        agent_id: AGENT_ID,
        agent_key: AGENT_KEY,
        business_id: BUSINESS_ID,
        website_url: WEBSITE_URL,
        history: historySnapshot,
      }),
    });

    const data = await res.json();

    loading.remove();

    if (!res.ok) {
      console.error("Vonza assistant backend error:", data.error || "Request failed");
      appendMessage(chat, "bot", data.error || "Request failed", { error: true });
      setComposerStatus("The assistant could not answer that just now. You can try again in a moment.");
      return;
    }

    if (data.widgetConfig) {
      applyWidgetConfig(data.widgetConfig);
    }

    appendMessage(chat, "bot", data.reply);
    addToHistory("user", message);
    addToHistory("assistant", data.reply);
    setComposerStatus("Ask a follow-up to keep exploring what your visitors would experience.");
  } catch (err) {
    console.error("Vonza assistant request failed:", err);
    loading.remove();
    appendMessage(chat, "bot", "Error connecting to server", { error: true });
    setComposerStatus("Connection was interrupted. Try again when the assistant is ready.");
  } finally {
    button.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

function sendStarterPrompt(prompt) {
  const input = document.getElementById("input");

  if (!input || !trimText(prompt)) {
    return;
  }

  input.value = prompt;
  sendMessage();
}

document.getElementById("input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll("[data-starter-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    sendStarterPrompt(button.dataset.starterPrompt || "");
  });
});

if (EMBEDDED_MODE) {
  document.body.classList.add("embedded");
}

applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
loadWidgetBootstrap();

if ("serviceWorker" in navigator && !EMBEDDED_MODE) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
