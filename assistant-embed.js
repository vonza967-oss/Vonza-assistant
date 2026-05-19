(() => {
  const SCRIPT_NAME = "assistant-embed.js";
  const DEFAULT_VONZA_ORIGIN = "https://vonza-assistant.onrender.com";
  const STATE_KEY = "__VonzaAssistantEmbedState__";
  const SECTION_DEFAULT_MIN_HEIGHT = 640;
  const FULL_PAGE_DEFAULT_MIN_HEIGHT = 760;
  const SIZE_MIN_HEIGHTS = Object.freeze({
    compact: 520,
    standard: 640,
    tall: 720,
    full: 760,
  });

  const state = window[STATE_KEY] || {
    frames: [],
    messageBound: false,
    resizeBound: false,
  };
  window[STATE_KEY] = state;

  function trimText(value) {
    return String(value || "").trim();
  }

  function resolveCurrentScript() {
    if (document.currentScript?.src) {
      return document.currentScript;
    }

    const scripts = Array.from(document.getElementsByTagName("script"));
    return scripts.reverse().find((script) => {
      try {
        return new URL(script.src, window.location.href).pathname.endsWith(`/${SCRIPT_NAME}`);
      } catch {
        return false;
      }
    });
  }

  function resolveVonzaOrigin() {
    const script = resolveCurrentScript();

    if (!script?.src) {
      return DEFAULT_VONZA_ORIGIN;
    }

    try {
      const scriptUrl = new URL(script.src, window.location.href);
      return scriptUrl.origin;
    } catch {
      return DEFAULT_VONZA_ORIGIN;
    }
  }

  const vonzaOrigin = resolveVonzaOrigin();

  function normalizeAgentId(value) {
    const cleaned = trimText(value);

    if (!cleaned || cleaned.length > 200) {
      return "";
    }

    return /^[A-Za-z0-9._:-]+$/.test(cleaned) ? cleaned : "";
  }

  function normalizeLayout(value) {
    return trimText(value).toLowerCase() === "full-page" ? "full-page" : "section";
  }

  function normalizeSize(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (Object.prototype.hasOwnProperty.call(SIZE_MIN_HEIGHTS, normalized)) {
      return normalized;
    }

    return layout === "full-page" ? "full" : "standard";
  }

  function normalizeSurface(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (["card", "flat", "transparent"].includes(normalized)) {
      return normalized;
    }

    return layout === "full-page" ? "flat" : "";
  }

  function normalizeOptionalNumber(value, min, max) {
    const cleaned = trimText(value);

    if (!cleaned) {
      return null;
    }

    const parsed = Number.parseInt(cleaned, 10);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Math.min(Math.max(parsed, min), max);
  }

  function resolveMinHeight(element, layout, size) {
    const fallback = SIZE_MIN_HEIGHTS[size]
      || (layout === "full-page" ? FULL_PAGE_DEFAULT_MIN_HEIGHT : SECTION_DEFAULT_MIN_HEIGHT);
    return normalizeOptionalNumber(element.getAttribute("data-min-height"), 280, 5000) || fallback;
  }

  function buildAssistantUrl({ agentId, layout, size, surface }) {
    const url = new URL("/widget", vonzaOrigin);
    url.searchParams.set("agent_id", agentId);
    url.searchParams.set("mode", "page");
    url.searchParams.set("embedded", "1");
    url.searchParams.set("variant", "smart");
    url.searchParams.set("size", size);

    if (surface) {
      url.searchParams.set("surface", surface);
    }

    if (layout === "full-page") {
      url.searchParams.set("layout", "canvas");
    }

    return url.toString();
  }

  function applyMountStyles(element, layout) {
    element.style.display = "block";
    element.style.width = "100%";
    element.style.maxWidth = "100%";
    element.style.boxSizing = "border-box";
    element.style.overflowX = "hidden";

    if (layout === "section") {
      element.style.overflow = "hidden";
    }
  }

  function applyIframeStyles(iframe, { layout, surface, minHeight }) {
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.minHeight = `${minHeight}px`;
    iframe.style.border = "0";
    iframe.style.boxSizing = "border-box";
    iframe.style.overflow = "hidden";
    iframe.style.background = surface === "transparent" ? "transparent" : "#ffffff";

    if (layout === "section") {
      iframe.style.height = `${minHeight}px`;
      iframe.style.borderRadius = "18px";
      return;
    }

    iframe.style.display = "block";
    iframe.style.borderRadius = surface === "card" ? "18px" : "0";
  }

  function requestAnimationFrameSafe(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }

    return window.setTimeout(callback, 16);
  }

  function cancelAnimationFrameSafe(handle) {
    if (!handle) {
      return;
    }

    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(handle);
      return;
    }

    window.clearTimeout(handle);
  }

  function findFrameEntry(sourceWindow) {
    return state.frames.find((entry) => entry.iframe.contentWindow === sourceWindow);
  }

  function normalizePostedHeight(value) {
    const height = Number.parseInt(value, 10);

    if (!Number.isFinite(height) || height <= 0) {
      return 0;
    }

    return Math.min(height, 5000);
  }

  function applySectionHeight(entry, postedHeight) {
    const nextHeight = Math.max(entry.minHeight, postedHeight);

    if (Math.abs(nextHeight - entry.currentHeight) < 4) {
      return;
    }

    cancelAnimationFrameSafe(entry.heightFrame);
    entry.heightFrame = requestAnimationFrameSafe(() => {
      entry.heightFrame = 0;
      entry.currentHeight = nextHeight;
      entry.iframe.style.height = `${nextHeight}px`;
    });
  }

  function handleEmbeddedHeightMessage(event) {
    if (event.origin && event.origin !== vonzaOrigin) {
      return;
    }

    const entry = findFrameEntry(event.source);

    if (!entry || entry.layout !== "section") {
      return;
    }

    const data = event.data || {};

    if (data.type !== "vonza:embedded-height") {
      return;
    }

    const postedHeight = normalizePostedHeight(data.height);

    if (!postedHeight) {
      return;
    }

    applySectionHeight(entry, postedHeight);
  }

  function calculateFullPageHeight(entry) {
    const viewportHeight = window.visualViewport?.height || window.innerHeight || FULL_PAGE_DEFAULT_MIN_HEIGHT;

    if (entry.headerOffset !== null) {
      return Math.max(entry.minHeight, Math.floor(viewportHeight - entry.headerOffset));
    }

    const rect = entry.iframe.getBoundingClientRect?.() || { top: 0 };
    const top = Math.max(0, Math.floor(rect.top || 0));
    return Math.max(entry.minHeight, Math.floor(viewportHeight - top));
  }

  function applyFullPageHeight(entry) {
    const nextHeight = calculateFullPageHeight(entry);

    if (Math.abs(nextHeight - entry.currentHeight) < 4) {
      return;
    }

    entry.currentHeight = nextHeight;
    entry.iframe.style.height = `${nextHeight}px`;
  }

  function scheduleFullPageHeight(entry) {
    cancelAnimationFrameSafe(entry.heightFrame);
    entry.heightFrame = requestAnimationFrameSafe(() => {
      entry.heightFrame = 0;
      applyFullPageHeight(entry);
    });
  }

  function scheduleAllFullPageHeights() {
    state.frames
      .filter((entry) => entry.layout === "full-page")
      .forEach(scheduleFullPageHeight);
  }

  function bindGlobalListeners() {
    if (!state.messageBound) {
      window.addEventListener("message", handleEmbeddedHeightMessage);
      state.messageBound = true;
    }

    if (!state.resizeBound) {
      window.addEventListener("resize", scheduleAllFullPageHeights);
      window.addEventListener("orientationchange", scheduleAllFullPageHeights);
      state.resizeBound = true;
    }
  }

  function mountAssistant(element) {
    if (!element || element.getAttribute("data-vonza-assistant-mounted") === "true") {
      return;
    }

    const agentId = normalizeAgentId(element.getAttribute("data-agent-id"));

    if (!agentId) {
      element.setAttribute("data-vonza-assistant-error", "missing-agent-id");
      return;
    }

    const layout = normalizeLayout(element.getAttribute("data-layout"));
    const size = normalizeSize(element.getAttribute("data-size"), layout);
    const surface = normalizeSurface(element.getAttribute("data-surface"), layout);
    const minHeight = resolveMinHeight(element, layout, size);
    const headerOffset = layout === "full-page"
      ? normalizeOptionalNumber(element.getAttribute("data-header-offset"), 0, 2000)
      : null;
    const iframe = document.createElement("iframe");

    iframe.src = buildAssistantUrl({ agentId, layout, size, surface });
    iframe.title = trimText(element.getAttribute("data-title")) || "AI assistant";
    iframe.loading = "lazy";
    iframe.allowTransparency = surface === "transparent";
    iframe.setAttribute("data-vonza-assistant-frame", "");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    applyIframeStyles(iframe, { layout, surface, minHeight });
    applyMountStyles(element, layout);

    element.textContent = "";
    element.appendChild(iframe);
    element.setAttribute("data-vonza-assistant-mounted", "true");
    element.setAttribute("data-vonza-assistant-layout", layout);

    const entry = {
      iframe,
      layout,
      minHeight,
      headerOffset,
      currentHeight: minHeight,
      heightFrame: 0,
    };
    state.frames.push(entry);

    if (layout === "full-page") {
      scheduleFullPageHeight(entry);
    }
  }

  function refresh() {
    bindGlobalListeners();
    document.querySelectorAll("[data-vonza-assistant]").forEach(mountAssistant);
  }

  window.VonzaAssistantEmbed = {
    refresh,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
