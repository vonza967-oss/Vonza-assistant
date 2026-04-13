const searchParams = new URLSearchParams(window.location.search);
const EMBEDDED_MODE = searchParams.get("embedded") === "1";
const STORED_AGENT_KEY = window.localStorage.getItem("vonza_agent_key") || "";
const INSTALL_ID =
  searchParams.get("install_id") ||
  window.VonzaWidgetConfig?.installId ||
  "";
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
const PAGE_ORIGIN =
  searchParams.get("origin") ||
  window.VonzaWidgetConfig?.origin ||
  "";
const PAGE_URL =
  searchParams.get("page_url") ||
  window.VonzaWidgetConfig?.pageUrl ||
  "";
const EMBED_SESSION_ID =
  searchParams.get("session_id") ||
  window.VonzaWidgetConfig?.sessionId ||
  "";
const EMBED_FINGERPRINT =
  searchParams.get("fingerprint") ||
  window.VonzaWidgetConfig?.fingerprint ||
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
let resolvedAgentId = AGENT_ID;
let resolvedAgentKey = AGENT_KEY;
let resolvedBusinessId = BUSINESS_ID;
let liveLeadCapture = null;
let liveDirectRouting = null;
let visitorIdentity = {
  mode: "",
  email: "",
  name: "",
};
let lastLeadReferenceMessage = "";
const sentTelemetryKeys = new Set();
const leadCapturePromptShownKeys = new Set();
const OUTCOME_DETECTION_STORAGE_PREFIX = "vonza_detected_outcome_";
const VISITOR_IDENTITY_STORAGE_PREFIX = "vonza_visitor_identity_";

function getWidgetStorageScope() {
  return (
    trimText(INSTALL_ID)
    || trimText(resolvedAgentId)
    || trimText(resolvedAgentKey)
    || trimText(resolvedBusinessId)
    || trimText(WEBSITE_URL)
    || "default"
  );
}

function getVisitorSessionStorageKey() {
  return `vonza_visitor_session_${getWidgetStorageScope()}`;
}

function getVisitorIdentityStorageKey() {
  return `${VISITOR_IDENTITY_STORAGE_PREFIX}${getWidgetStorageScope()}`;
}

function getVisitorSessionKey() {
  const storageKey = getVisitorSessionStorageKey();
  let sessionKey = window.localStorage.getItem(storageKey);

  if (!sessionKey) {
    sessionKey = EMBED_SESSION_ID || window.crypto?.randomUUID?.() || `visitor_${Date.now()}`;
    window.localStorage.setItem(storageKey, sessionKey);
  }

  return sessionKey;
}

function trimText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  const cleaned = trimText(value).toLowerCase();
  const match = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function normalizeVisitorIdentityMode(value) {
  const normalized = trimText(value).toLowerCase();
  return ["guest", "identified"].includes(normalized) ? normalized : "";
}

function normalizeVisitorIdentityState(input = {}) {
  const modeCandidate = normalizeVisitorIdentityMode(
    input.mode || input.visitorMode || input.visitor_mode
  );
  const email = normalizeEmail(input.email || input.visitorEmail || input.visitor_email);
  const name = trimText(input.name || input.visitorName || input.visitor_name);
  const mode = modeCandidate || (email ? "identified" : "");

  if (mode === "guest") {
    return {
      mode: "guest",
      email: "",
      name: "",
    };
  }

  if (mode === "identified" && email) {
    return {
      mode: "identified",
      email,
      name,
    };
  }

  return {
    mode: "",
    email: "",
    name: "",
  };
}

function hasChosenVisitorIdentity() {
  return Boolean(normalizeVisitorIdentityMode(visitorIdentity.mode));
}

function buildVisitorIdentityPayload(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  return {
    visitor_identity: normalized,
    visitor_identity_mode: normalized.mode || "",
    visitor_email: normalized.email || "",
    visitor_name: normalized.name || "",
  };
}

function saveVisitorIdentity(identity) {
  const normalized = normalizeVisitorIdentityState(identity);

  try {
    if (!normalized.mode) {
      window.localStorage.removeItem(getVisitorIdentityStorageKey());
      return normalized;
    }

    window.localStorage.setItem(getVisitorIdentityStorageKey(), JSON.stringify(normalized));
  } catch {}

  return normalized;
}

function loadStoredVisitorIdentity() {
  try {
    const value = window.localStorage.getItem(getVisitorIdentityStorageKey());
    const parsed = value ? JSON.parse(value) : null;
    return normalizeVisitorIdentityState(parsed || {});
  } catch {
    return normalizeVisitorIdentityState();
  }
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
  return Boolean(INSTALL_ID || resolvedAgentId || resolvedAgentKey || resolvedBusinessId || WEBSITE_URL);
}

function getPageOrigin() {
  return trimText(PAGE_ORIGIN || window.location.origin);
}

function getPageUrl() {
  return trimText(PAGE_URL || window.location.href);
}

function getFingerprint() {
  return trimText(EMBED_FINGERPRINT);
}

function getIdentityChoicePanel() {
  return document.getElementById("identity-choice-panel");
}

function getIdentityEmailForm() {
  return document.getElementById("identity-email-form");
}

function getWelcomeContent() {
  return document.getElementById("welcome-content");
}

function getIntroMessage() {
  return document.getElementById("intro-message");
}

function getIdentitySummaryText(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  if (normalized.mode === "identified") {
    return normalized.name
      ? `${normalized.name} · ${normalized.email}`
      : normalized.email;
  }

  if (normalized.mode === "guest") {
    return "Continuing without email";
  }

  return "";
}

function updateComposerAvailability() {
  const input = document.getElementById("input");
  const button = document.getElementById("send-button");
  const inputArea = document.querySelector(".input-area");

  if (!input || !button || !inputArea) {
    return;
  }

  input.disabled = false;
  button.disabled = false;
  input.placeholder = "Type here";
  inputArea.classList.toggle("is-locked", false);
}

function renderVisitorIdentityGate() {
  const identityPanel = getIdentityChoicePanel();
  const welcomeContent = getWelcomeContent();
  const introMessage = getIntroMessage();
  const summary = document.getElementById("identity-summary");
  const normalized = normalizeVisitorIdentityState(visitorIdentity);
  const identityReady = Boolean(normalized.mode);

  if (identityPanel) {
    identityPanel.hidden = true;
  }

  if (welcomeContent) {
    welcomeContent.hidden = false;
  }

  if (introMessage) {
    introMessage.hidden = false;
  }

  if (summary) {
    summary.hidden = !identityReady;
    summary.innerHTML = identityReady
      ? `<strong>${escapeHtml(normalized.mode === "identified" ? "Email" : "Guest")}</strong> ${escapeHtml(getIdentitySummaryText(normalized))}`
      : "";
  }

  updateComposerAvailability();
}

function setVisitorIdentityState(identity, options = {}) {
  const normalized = normalizeVisitorIdentityState(identity);
  visitorIdentity = options.persist === false
    ? normalized
    : saveVisitorIdentity(normalized);

  renderVisitorIdentityGate();
  return visitorIdentity;
}

function continueIntoChat(identity, options = {}) {
  const normalized = setVisitorIdentityState(identity, options);

  if (!normalized.mode) {
    return normalized;
  }

  if (normalized.mode === "identified") {
    setComposerStatus(`Using ${normalized.email} so the business can follow up cleanly if needed.`);
  } else {
    setComposerStatus("Continuing as a guest. You can ask anything about the business.");
  }

  if (options.track !== false) {
    void trackWidgetEvent("identity_mode_selected", {
      mode: normalized.mode,
      hasName: Boolean(normalized.name),
    }, {
      dedupeKey: `${INSTALL_ID}::identity_mode_selected::${getVisitorSessionKey()}::${normalized.mode}`,
    });
  }

  document.getElementById("input")?.focus();
  return normalized;
}
function getDirectRoutingSlot() {
  return document.getElementById("direct-routing-slot");
}

function getDismissedRouteStorageKey() {
  return `${getVisitorSessionStorageKey()}_dismissed_routes`;
}

function getDismissedRouteKeys() {
  try {
    const value = window.localStorage.getItem(getDismissedRouteStorageKey());
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => trimText(entry)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isRouteDismissed(decisionKey) {
  return getDismissedRouteKeys().includes(trimText(decisionKey));
}

function rememberDismissedRoute(decisionKey) {
  const normalized = trimText(decisionKey);

  if (!normalized) {
    return;
  }

  const nextKeys = [...new Set([...getDismissedRouteKeys(), normalized])];
  window.localStorage.setItem(getDismissedRouteStorageKey(), JSON.stringify(nextKeys.slice(-12)));
}

function buildRoutingMetadata(routing, cta) {
  return {
    decisionKey: trimText(routing?.decisionKey || ""),
    ctaType: trimText(cta?.ctaType || ""),
    targetType: trimText(cta?.targetType || ""),
    relatedIntentType: trimText(routing?.intentType || ""),
    relatedActionKey: trimText(routing?.relatedActionKey || liveLeadCapture?.latestActionKey || ""),
    relatedConversationId: trimText(routing?.relatedConversationId || ""),
    relatedPersonKey: trimText(routing?.relatedPersonKey || liveLeadCapture?.personKey || ""),
    leadId: trimText(routing?.relatedLeadId || liveLeadCapture?.id || ""),
    followUpId: trimText(routing?.relatedFollowUpId || liveLeadCapture?.relatedFollowUpId || ""),
    routingMode: trimText(routing?.routingMode || routing?.mode || ""),
    sourceUrl: getPageUrl(),
  };
}

function buildTrackedRedirectUrl(routing, cta) {
  const metadata = buildRoutingMetadata(routing, cta);
  const url = new URL("/install/cta", window.location.origin);

  url.searchParams.set("install_id", INSTALL_ID);
  url.searchParams.set("session_id", getVisitorSessionKey());
  url.searchParams.set("visitor_id", getFingerprint() || getVisitorSessionKey());
  if (getFingerprint()) url.searchParams.set("fingerprint", getFingerprint());
  if (getPageUrl()) url.searchParams.set("page_url", getPageUrl());
  if (getPageOrigin()) url.searchParams.set("origin", getPageOrigin());
  if (trimText(cta?.ctaType)) url.searchParams.set("cta_type", trimText(cta.ctaType));
  if (trimText(cta?.targetType)) url.searchParams.set("target_type", trimText(cta.targetType));
  if (trimText(cta?.href)) url.searchParams.set("target_url", trimText(cta.href));
  if (trimText(cta?.label)) url.searchParams.set("label", trimText(cta.label));
  if (metadata.decisionKey) url.searchParams.set("decision_key", metadata.decisionKey);
  if (metadata.relatedIntentType) url.searchParams.set("related_intent_type", metadata.relatedIntentType);
  if (metadata.relatedActionKey) url.searchParams.set("action_key", metadata.relatedActionKey);
  if (metadata.relatedConversationId) url.searchParams.set("conversation_id", metadata.relatedConversationId);
  if (metadata.relatedPersonKey) url.searchParams.set("person_key", metadata.relatedPersonKey);
  if (metadata.leadId) url.searchParams.set("lead_id", metadata.leadId);
  if (metadata.followUpId) url.searchParams.set("follow_up_id", metadata.followUpId);

  return url.toString();
}

function openRoutingTarget(cta = {}, redirectUrl = "") {
  const href = trimText(redirectUrl || cta.href);

  if (!href) {
    return;
  }

  if (cta.targetType === "phone" || cta.targetType === "email") {
    window.location.href = href;
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
}

function bindDirectRoutingInteractions(slot, routing) {
  const continueButton = slot.querySelector("[data-routing-continue]");
  const ctaButtons = slot.querySelectorAll("[data-routing-cta]");

  ctaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const cta = {
        ctaType: trimText(button.dataset.ctaType),
        targetType: trimText(button.dataset.targetType),
        href: trimText(button.dataset.href),
        targetValue: trimText(button.dataset.targetValue),
      };

      rememberDismissedRoute(routing.decisionKey);
      renderDirectRouting(null);
      setComposerStatus(`Opening ${trimText(button.textContent).toLowerCase()}...`);
      const redirectUrl = buildTrackedRedirectUrl(routing, cta);
      void trackWidgetEvent("cta_clicked", buildRoutingMetadata(routing, cta), {
        dedupeKey: `${INSTALL_ID}::cta_clicked::${trimText(routing.decisionKey)}::${trimText(cta.ctaType)}::${trimText(cta.targetType)}`,
      });
      openRoutingTarget(cta, redirectUrl);
    });
  });

  if (continueButton) {
    continueButton.addEventListener("click", () => {
      rememberDismissedRoute(routing.decisionKey);
      if (trimText(routing.continueButton?.action) === "reveal_capture" && liveLeadCapture?.shouldPrompt) {
        renderLeadCapture(liveLeadCapture, { force: true });
        void trackWidgetEvent("capture_fallback_offered", {
          relatedConversationId: trimText(routing.relatedConversationId || ""),
          relatedIntentType: trimText(routing.intentType || ""),
          relatedActionKey: trimText(routing.relatedActionKey || ""),
        }, {
          dedupeKey: `${INSTALL_ID}::capture_fallback_offered::${trimText(routing.decisionKey || getVisitorSessionKey())}`,
        });
        setComposerStatus("You can share contact details in chat whenever you want.");
        return;
      }

      renderDirectRouting(null);
      setComposerStatus("No problem. We can keep going here.");
    });
  }
}

function getRoutingSuggestionTitle(routing = {}, cta = {}) {
  const intentType = trimText(routing.intentType);
  const label = trimText(cta.label);

  if (intentType === "booking") {
    return "Ready to book?";
  }

  if (intentType === "quote") {
    return "Want to request a quote?";
  }

  if (intentType === "checkout") {
    return "Ready to continue?";
  }

  if (intentType === "contact") {
    return "Want to contact the team?";
  }

  return label ? `Want to ${label.toLowerCase()}?` : "Want the next step?";
}

function renderDirectRouting(routing) {
  const slot = getDirectRoutingSlot();

  if (!slot) {
    return;
  }

  liveDirectRouting = routing && typeof routing === "object" ? routing : null;

  const shouldShow = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (!shouldShow) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  const primaryCta = liveDirectRouting.primaryCta || {};
  const secondaryCtas = Array.isArray(liveDirectRouting.secondaryCtas)
    ? liveDirectRouting.secondaryCtas.filter((entry) => entry && trimText(entry.href))
    : [];

  slot.hidden = false;
  slot.innerHTML = `
    <article class="customer-next-step">
      <h3 class="customer-next-step-title">${escapeHtml(getRoutingSuggestionTitle(liveDirectRouting, primaryCta))}</h3>
      <p class="customer-next-step-copy">I can keep helping here, or you can use this direct option.</p>
      ${trimText(liveDirectRouting.availabilityNote) ? `<p class="customer-next-step-note">${escapeHtml(trimText(liveDirectRouting.availabilityNote))}</p>` : ""}
      <div class="routing-actions">
        <button
          type="button"
          class="routing-primary-button"
          data-routing-cta
          data-cta-type="${escapeHtml(trimText(primaryCta.ctaType))}"
          data-target-type="${escapeHtml(trimText(primaryCta.targetType))}"
          data-href="${escapeHtml(trimText(primaryCta.href))}"
          data-target-value="${escapeHtml(trimText(primaryCta.targetValue))}"
        >${escapeHtml(trimText(primaryCta.label) || "Continue")}</button>
        ${secondaryCtas.map((cta) => `
          <button
            type="button"
            class="ghost-button routing-secondary-button"
            data-routing-cta
            data-cta-type="${escapeHtml(trimText(cta.ctaType))}"
            data-target-type="${escapeHtml(trimText(cta.targetType))}"
            data-href="${escapeHtml(trimText(cta.href))}"
            data-target-value="${escapeHtml(trimText(cta.targetValue))}"
          >${escapeHtml(trimText(cta.label) || "Open")}</button>
        `).join("")}
        <button type="button" class="ghost-button routing-secondary-button" data-routing-continue>${escapeHtml(trimText(liveDirectRouting.continueButton?.label) || "Continue here")}</button>
      </div>
    </article>
  `;

  bindDirectRoutingInteractions(slot, liveDirectRouting);
  void trackWidgetEvent("cta_shown", buildRoutingMetadata(liveDirectRouting, primaryCta), {
    dedupeKey: `${INSTALL_ID}::cta_shown::${trimText(liveDirectRouting.decisionKey)}`,
  });
}

function bindLeadCaptureInteractions(slot, leadCapture) {
  const form = slot.querySelector("[data-lead-capture-form]");
  const declineButton = slot.querySelector("[data-lead-capture-decline]");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await submitLeadCaptureAction("submit", {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        preferred_channel: formData.get("preferred_channel"),
      });
    });
  }

  if (declineButton) {
    declineButton.addEventListener("click", async () => {
      await submitLeadCaptureAction("decline");
    });
  }

  const promptShownKey = trimText(leadCapture?.id) || `${getVisitorSessionKey()}::${trimText(leadCapture?.trigger)}`;
  if (leadCapture?.shouldPrompt && !leadCapturePromptShownKeys.has(promptShownKey)) {
    leadCapturePromptShownKeys.add(promptShownKey);
    void submitLeadCaptureAction("prompt_shown", {}, { silent: true });
  }
}

function renderLeadCapture(leadCapture, options = {}) {
  const slot = getDirectRoutingSlot();
  const chat = document.getElementById("chat");
  liveLeadCapture = leadCapture && typeof leadCapture === "object" ? leadCapture : null;

  if (!slot || !liveLeadCapture) {
    return;
  }

  const state = trimText(liveLeadCapture.state).toLowerCase();
  const directRouteVisible = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (directRouteVisible && options.force !== true) {
    return;
  }

  if (state === "captured") {
    slot.hidden = true;
    slot.innerHTML = "";

    const promptShownKey = `${trimText(liveLeadCapture?.id) || getVisitorSessionKey()}::captured`;
    if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
      leadCapturePromptShownKeys.add(promptShownKey);
      appendMessage(chat, "bot", trimText(liveLeadCapture.message) || "Thanks. I saved those details so the team can follow up.");
    }
    return;
  }

  if (!liveLeadCapture.shouldPrompt) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  slot.hidden = true;
  slot.innerHTML = "";

  const promptShownKey = trimText(liveLeadCapture?.id) || `${getVisitorSessionKey()}::${trimText(liveLeadCapture?.trigger)}`;
  if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
    leadCapturePromptShownKeys.add(promptShownKey);
    appendMessage(chat, "bot", trimText(liveLeadCapture.prompt?.body) || "What is the best email or phone number to use?");
    void submitLeadCaptureAction("prompt_shown", {}, { silent: true });
  }
}

async function submitLeadCaptureAction(action, fields = {}, options = {}) {
  if (!liveLeadCapture || !trimText(action)) {
    return null;
  }

  try {
    const response = await fetch("/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        visitor_session_key: getVisitorSessionKey(),
        reference_message: lastLeadReferenceMessage,
        ...buildVisitorIdentityPayload(),
        ...fields,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Capture request failed");
    }

    if (options.silent === true) {
      return data.leadCapture || null;
    }

    renderLeadCapture(data.leadCapture || null, { force: true });
    if (trimText(data.leadCapture?.message) && trimText(data.leadCapture?.state).toLowerCase() !== "captured") {
      appendMessage(document.getElementById("chat"), "bot", data.leadCapture.message);
    }
    setComposerStatus(
      trimText(data.leadCapture?.state).toLowerCase() === "captured"
        ? "Contact details saved."
        : "No problem. We can keep chatting here."
    );
    return data.leadCapture || null;
  } catch (error) {
    if (options.silent !== true) {
      setComposerStatus("Those contact details could not be saved just now. Try again in a moment.");
    }
    console.warn("Vonza lead capture failed:", error);
    return null;
  }
}

async function trackWidgetEvent(eventName, metadata = {}, options = {}) {
  if (!INSTALL_ID) {
    return;
  }

  const dedupeKey = trimText(options.dedupeKey)
    || `${INSTALL_ID}::${eventName}::${options.scope || getVisitorSessionKey()}`;

  if (sentTelemetryKeys.has(dedupeKey)) {
    return;
  }

  sentTelemetryKeys.add(dedupeKey);

  try {
    await fetch("/install/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        event_name: eventName,
        session_id: getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        origin: getPageOrigin(),
        page_url: getPageUrl(),
        dedupe_key: dedupeKey,
        metadata,
      }),
    });
  } catch (error) {
    console.warn("Vonza widget telemetry failed:", error);
  }
}

function getOutcomeDetectionStorageKey() {
  const pageUrl = getPageUrl();

  if (!pageUrl || !INSTALL_ID) {
    return "";
  }

  try {
    const parsed = new URL(pageUrl);
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${parsed.pathname}::${parsed.search}`;
  } catch {
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${pageUrl}`;
  }
}

async function detectConversionOutcomesOnLoad() {
  const pageUrl = getPageUrl();
  const storageKey = getOutcomeDetectionStorageKey();

  if (!INSTALL_ID || !pageUrl || !storageKey) {
    return;
  }

  if (window.sessionStorage.getItem(storageKey) === "1") {
    return;
  }

  try {
    const parsedPageUrl = new URL(pageUrl);
    const ctaEventId = trimText(parsedPageUrl.searchParams.get("vz_cta_event_id"));
    const response = await fetch("/install/outcomes/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        session_id: getVisitorSessionKey(),
        visitor_id: getFingerprint() || getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        page_url: pageUrl,
        origin: getPageOrigin(),
        cta_event_id: ctaEventId || null,
      }),
    });

    if (response.ok) {
      window.sessionStorage.setItem(storageKey, "1");
    }
  } catch (error) {
    console.warn("Vonza outcome detection failed:", error);
  }
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
  if (hasChosenVisitorIdentity()) {
    continueIntoChat(visitorIdentity, {
      persist: false,
      track: false,
    });
  } else {
    setComposerStatus("Choose how to continue, then ask about services, pricing, contact details, or the next step.");
  }
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", widgetConfig.assistantName);
  renderVisitorIdentityGate();
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

  if (INSTALL_ID) bootstrapUrl.searchParams.set("install_id", INSTALL_ID);
  if (AGENT_ID) bootstrapUrl.searchParams.set("agent_id", AGENT_ID);
  if (AGENT_KEY) bootstrapUrl.searchParams.set("agent_key", AGENT_KEY);
  if (BUSINESS_ID) bootstrapUrl.searchParams.set("business_id", BUSINESS_ID);
  if (WEBSITE_URL) bootstrapUrl.searchParams.set("website_url", WEBSITE_URL);
  if (getPageOrigin()) bootstrapUrl.searchParams.set("origin", getPageOrigin());
  if (getPageUrl()) bootstrapUrl.searchParams.set("page_url", getPageUrl());

  try {
    const response = await fetch(bootstrapUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load widget configuration");
    }

    applyWidgetConfig(data.widgetConfig || {});
    resolvedAgentId = trimText(data.agent?.id || resolvedAgentId);
    resolvedAgentKey = trimText(data.agent?.publicAgentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.business?.id || resolvedBusinessId);
    if (hasChosenVisitorIdentity()) {
      continueIntoChat(visitorIdentity, {
        persist: false,
        track: false,
      });
    } else {
      setComposerStatus("Choose how to continue, then start chatting with the current website knowledge.");
    }
    await detectConversionOutcomesOnLoad();
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

  if (!hasChosenVisitorIdentity()) {
    setVisitorIdentityState({ mode: "guest" });
  }

  if (!message) return;

  hideWelcomePanel();

  if (!hasAssistantConfig()) {
    console.error(
      "Vonza assistant configuration error: missing install_id, agent_id, agent_key, business_id, and website_url"
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
  lastLeadReferenceMessage = message;
  input.value = "";
  button.disabled = true;
  input.disabled = true;
  setComposerStatus(`${widgetConfig.assistantName} is preparing a grounded answer...`);

  const loading = appendMessage(chat, "bot", "", { typing: true });

  try {
    const sessionKey = getVisitorSessionKey();
    void trackWidgetEvent("first_message_sent", { messageLength: message.length }, {
      scope: sessionKey,
    });
    void trackWidgetEvent("conversation_started", { messageLength: message.length }, {
      dedupeKey: `${INSTALL_ID}::conversation_started::${sessionKey}`,
    });

    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        visitor_session_key: sessionKey,
        history: historySnapshot,
        ...buildVisitorIdentityPayload(),
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
    resolvedAgentId = trimText(data.agentId || resolvedAgentId);
    resolvedAgentKey = trimText(data.agentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.businessId || resolvedBusinessId);
    visitorIdentity = normalizeVisitorIdentityState(data.visitorIdentity || visitorIdentity);
    renderVisitorIdentityGate();
    addToHistory("user", message);
    addToHistory("assistant", data.reply);
    liveLeadCapture = data.leadCapture || null;
    renderDirectRouting(data.directRouting || null);
    renderLeadCapture(liveLeadCapture, {
      force: trimText(data.directRouting?.mode) === "capture_only",
    });
    if (trimText(data.leadCapture?.state).toLowerCase() === "captured") {
      void trackWidgetEvent("contact_captured", {
        preferredChannel: trimText(data.leadCapture?.preferredChannel || ""),
        contactPresent: Boolean(trimText(data.leadCapture?.contact?.email || data.leadCapture?.contact?.phone)),
      }, {
        dedupeKey: `${INSTALL_ID}::contact_captured::${sessionKey}::${trimText(data.leadCapture?.id || "")}`,
      });
    }
    void trackWidgetEvent(
      "message_replied",
      {
        replyLength: trimText(data.reply).length,
      },
      {
        dedupeKey: `${INSTALL_ID}::message_replied::${sessionKey}::${conversationHistory.length}`,
      }
    );
    setComposerStatus(
      trimText(data.directRouting?.primaryCta?.label)
        ? "That option is ready if you want the fastest next step."
      : "Ask anything else about services, pricing, booking, or contact details."
    );
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

document.getElementById("identity-guest-button")?.addEventListener("click", () => {
  continueIntoChat({
    mode: "guest",
  });
});

document.getElementById("identity-email-button")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.removeAttribute("hidden");
  document.getElementById("identity-name")?.focus();
  setComposerStatus("Add an email so the business can keep this conversation connected.");
});

document.getElementById("identity-email-cancel")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.setAttribute("hidden", "");
  setComposerStatus("Choose how to continue, then start chatting.");
});

document.getElementById("identity-email-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const identity = normalizeVisitorIdentityState({
    mode: "identified",
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!identity.email) {
    setComposerStatus("Enter a valid email address to continue with email.");
    document.getElementById("identity-email")?.focus();
    return;
  }

  continueIntoChat(identity);
  form.setAttribute("hidden", "");
});

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

visitorIdentity = loadStoredVisitorIdentity();
if (!hasChosenVisitorIdentity()) {
  visitorIdentity = saveVisitorIdentity({ mode: "guest", email: "", name: "" });
}
renderVisitorIdentityGate();
applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
loadWidgetBootstrap();

window.__VONZA_WIDGET_TEST_HOOKS__ = {
  buildVisitorIdentityPayload,
  continueIntoChat: (identity) => continueIntoChat(identity, {
    track: false,
  }),
  getVisitorIdentity: () => ({ ...visitorIdentity }),
  normalizeVisitorIdentityState,
};

if ("serviceWorker" in navigator && !EMBEDDED_MODE) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
