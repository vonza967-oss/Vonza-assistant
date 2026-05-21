(() => {
  const SCRIPT_NAME = "assistant-embed.js";
  const DEFAULT_VONZA_ORIGIN = "https://vonza-assistant.onrender.com";
  const STATE_KEY = "__VonzaAssistantEmbedState__";
  const SECTION_DEFAULT_MIN_HEIGHT = 640;
  const FULL_PAGE_DEFAULT_MIN_HEIGHT = 760;
  const PAGE_TAKEOVER_DEFAULT_MIN_HEIGHT = 0;
  const SIZE_MIN_HEIGHTS = Object.freeze({
    compact: 520,
    standard: 640,
    tall: 720,
    full: 760,
  });
  const BACKGROUND_SCOPES = Object.freeze(["section", "iframe", "viewport", "page"]);
  const PAGE_RESET_CONTAINER_SELECTORS = Object.freeze([
    ".entry-content",
    ".wp-site-blocks",
    ".wp-block-group",
    ".elementor-section",
    ".elementor-container",
    ".elementor-widget-container",
  ]);
  const PAGE_FOOTER_SELECTORS = Object.freeze(["footer", ".site-footer", "#colophon", ".footer"]);
  const PAGE_TITLE_SELECTORS = Object.freeze([".entry-title", ".page-title", "h1.wp-block-post-title"]);
  const PAGE_CHROME_SELECTORS = Object.freeze(["header", "nav", ".site-header", "#masthead"]);
  const HEIGHT_MODES = Object.freeze(["auto", "full-page"]);
  const DEFAULT_FULL_PAGE_DESIGN = Object.freeze({
    backgroundType: "color",
    backgroundColor: "#ffffff",
    backgroundGradientTo: "#eef4ff",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0,
    backgroundBlur: 0,
    backgroundFocalPoint: "center",
    disableVideoOnMobile: true,
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
    const normalized = trimText(value).toLowerCase();

    if (normalized === "page-takeover") {
      return "page-takeover";
    }

    return normalized === "full-page" ? "full-page" : "section";
  }

  function isCanvasLayout(layout) {
    return layout === "full-page" || layout === "page-takeover";
  }

  function isPageTakeover(layout) {
    return layout === "page-takeover";
  }

  function normalizeSize(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (Object.prototype.hasOwnProperty.call(SIZE_MIN_HEIGHTS, normalized)) {
      return normalized;
    }

    return isCanvasLayout(layout) ? "full" : "standard";
  }

  function normalizeSurface(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (["card", "flat", "transparent"].includes(normalized)) {
      return normalized;
    }

    return isCanvasLayout(layout) ? "flat" : "";
  }

  function normalizeBackgroundScope(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (BACKGROUND_SCOPES.includes(normalized)) {
      return normalized;
    }

    return isPageTakeover(layout) ? "viewport" : "section";
  }

  function normalizeHeightMode(value, layout) {
    const normalized = trimText(value).toLowerCase();

    if (isPageTakeover(layout)) {
      return "full-page";
    }

    return layout === "full-page" && HEIGHT_MODES.includes(normalized) ? normalized : "auto";
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
      || (isCanvasLayout(layout) ? FULL_PAGE_DEFAULT_MIN_HEIGHT : SECTION_DEFAULT_MIN_HEIGHT);
    const minHeight = normalizeOptionalNumber(element.getAttribute("data-min-height"), 280, 5000);

    if (minHeight !== null) {
      return minHeight;
    }

    return isPageTakeover(layout) ? PAGE_TAKEOVER_DEFAULT_MIN_HEIGHT : fallback;
  }

  function normalizeShowTitle(value) {
    const normalized = trimText(value).toLowerCase();
    return !["0", "false", "no", "off"].includes(normalized);
  }

  function buildAssistantUrl({ agentId, layout, size, surface, showTitle, backgroundScope }) {
    const url = new URL("/widget", vonzaOrigin);
    url.searchParams.set("agent_id", agentId);
    url.searchParams.set("mode", "page");
    url.searchParams.set("embedded", "1");
    url.searchParams.set("variant", "smart");
    url.searchParams.set("size", size);

    if (surface) {
      url.searchParams.set("surface", surface);
    }

    if (isCanvasLayout(layout)) {
      url.searchParams.set("layout", "canvas");
    }

    if (isCanvasLayout(layout) && backgroundScope) {
      url.searchParams.set("background_scope", backgroundScope);
    }

    if (showTitle === false) {
      url.searchParams.set("show_title", "0");
    }

    return url.toString();
  }

  function supportsDynamicViewportHeight() {
    return window.CSS?.supports?.("height", "100dvh") === true;
  }

  function getViewportHeightUnit() {
    return supportsDynamicViewportHeight() ? "100dvh" : "100vh";
  }

  function buildViewportMinHeight(minHeight, topOffset) {
    return `max(${minHeight}px, calc(${getViewportHeightUnit()} - ${topOffset}px))`;
  }

  function applyMountStyles(element, { layout, minHeight, headerOffset, heightMode }) {
    element.style.display = "block";
    element.style.boxSizing = "border-box";
    element.style.overflowX = "hidden";

    if (layout === "section") {
      element.style.width = "100%";
      element.style.maxWidth = "100%";
      element.style.overflow = "hidden";
      return;
    }

    if (isPageTakeover(layout)) {
      element.style.width = "100%";
      element.style.maxWidth = "100%";
      element.style.minHeight = "";
      element.style.position = "relative";
      element.style.overflow = "visible";
      return;
    }

    element.style.width = "100vw";
    element.style.maxWidth = "100vw";
    element.style.marginLeft = "calc(50% - 50vw)";
    element.style.marginRight = "calc(50% - 50vw)";
    element.style.minHeight = heightMode === "full-page" && headerOffset !== null
      ? buildViewportMinHeight(minHeight, headerOffset)
      : `${minHeight}px`;
    element.style.position = "relative";
    element.style.overflow = "hidden";
  }

  function applyTakeoverWrapperStyles(wrapper, { minHeight, topOffset }) {
    wrapper.style.display = "block";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.width = "100vw";
    wrapper.style.maxWidth = "100vw";
    wrapper.style.marginLeft = "calc(50% - 50vw)";
    wrapper.style.marginRight = "calc(50% - 50vw)";
    wrapper.style.minHeight = buildViewportMinHeight(minHeight, topOffset);
    wrapper.style.position = "relative";
    wrapper.style.overflow = "hidden";
    wrapper.style.overflowX = "hidden";
    wrapper.style.isolation = "isolate";
  }

  function applyIframeStyles(iframe, { layout, surface, minHeight, backgroundScope }) {
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.minHeight = `${minHeight}px`;
    iframe.style.border = "0";
    iframe.style.boxSizing = "border-box";
    iframe.style.overflow = "hidden";
    iframe.style.background = surface === "transparent" || ["section", "viewport", "page"].includes(backgroundScope) ? "transparent" : "#ffffff";
    iframe.style.position = "relative";

    if (layout === "section") {
      iframe.style.height = `${minHeight}px`;
      iframe.style.borderRadius = "18px";
      return;
    }

    iframe.style.display = "block";
    iframe.style.borderRadius = surface === "card" ? "18px" : "0";
    iframe.style.zIndex = "2";
  }

  function normalizeColor(value, fallbackValue) {
    const normalized = trimText(value).toLowerCase();
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallbackValue;
  }

  function normalizeDesignNumber(value, fallbackValue, minValue, maxValue, precision = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallbackValue;
    }

    const clamped = Math.max(minValue, Math.min(maxValue, number));
    const multiplier = 10 ** precision;
    return Math.round(clamped * multiplier) / multiplier;
  }

  function normalizeDesignEnum(value, allowedValues, fallbackValue) {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    return allowedValues.includes(normalized) ? normalized : fallbackValue;
  }

  function normalizeBoolean(value, fallbackValue) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = trimText(value).toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }

    return fallbackValue;
  }

  function addClass(element, className) {
    if (!element || !className) {
      return;
    }

    if (element.classList?.add) {
      element.classList.add(className);
      return;
    }

    const classes = new Set(trimText(element.className).split(/\s+/).filter(Boolean));
    classes.add(className);
    element.className = Array.from(classes).join(" ");
  }

  function matchesSelector(element, selector) {
    if (!element || !selector) {
      return false;
    }

    try {
      return element.matches?.(selector) === true;
    } catch {
      return false;
    }
  }

  function matchesAnySelector(element, selectors) {
    return selectors.some((selector) => matchesSelector(element, selector));
  }

  function getParentElement(element) {
    return element?.parentElement || element?.parentNode || null;
  }

  function getAncestorElements(element, maxDepth = 6) {
    const ancestors = [];
    let current = getParentElement(element);

    while (current && ancestors.length < maxDepth) {
      const tagName = trimText(current.tagName).toLowerCase();

      if (tagName === "body" || tagName === "html") {
        break;
      }

      ancestors.push(current);
      current = getParentElement(current);
    }

    return ancestors;
  }

  function containsElement(parent, child) {
    if (!parent || !child) {
      return false;
    }

    if (typeof parent.contains === "function") {
      return parent.contains(child);
    }

    let current = child;
    while (current) {
      if (current === parent) {
        return true;
      }
      current = getParentElement(current);
    }

    return false;
  }

  function queryAllSafe(root, selectors) {
    if (!root?.querySelectorAll) {
      return [];
    }

    try {
      return Array.from(root.querySelectorAll(selectors.join(",")));
    } catch {
      return [];
    }
  }

  function isElementAfterMount(candidate, mount) {
    if (!candidate || !mount || candidate === mount || containsElement(candidate, mount) || containsElement(mount, candidate)) {
      return false;
    }

    if (typeof mount.compareDocumentPosition === "function") {
      return (mount.compareDocumentPosition(candidate) & 4) === 4;
    }

    const mountRect = mount.getBoundingClientRect?.();
    const candidateRect = candidate.getBoundingClientRect?.();
    if (mountRect && candidateRect && Number.isFinite(candidateRect.top) && Number.isFinite(mountRect.bottom)) {
      return candidateRect.top >= mountRect.bottom;
    }

    let sibling = mount.nextElementSibling;
    while (sibling) {
      if (sibling === candidate || containsElement(sibling, candidate)) {
        return true;
      }
      sibling = sibling.nextElementSibling;
    }

    return false;
  }

  function isElementBeforeMount(candidate, mount) {
    if (!candidate || !mount || candidate === mount || containsElement(candidate, mount) || containsElement(mount, candidate)) {
      return false;
    }

    if (typeof candidate.compareDocumentPosition === "function") {
      return (candidate.compareDocumentPosition(mount) & 4) === 4;
    }

    const mountRect = mount.getBoundingClientRect?.();
    const candidateRect = candidate.getBoundingClientRect?.();
    if (mountRect && candidateRect && Number.isFinite(candidateRect.bottom) && Number.isFinite(mountRect.top)) {
      return candidateRect.bottom <= mountRect.top;
    }

    let sibling = mount.previousElementSibling;
    while (sibling) {
      if (sibling === candidate || containsElement(sibling, candidate)) {
        return true;
      }
      sibling = sibling.previousElementSibling;
    }

    return false;
  }

  function isInsidePageChrome(element) {
    let current = element;
    while (current) {
      if (matchesAnySelector(current, PAGE_CHROME_SELECTORS)) {
        return true;
      }
      current = getParentElement(current);
    }
    return false;
  }

  function resolveMediaUrl(value) {
    const normalized = trimText(value);

    if (!normalized) {
      return "";
    }

    try {
      return new URL(normalized, vonzaOrigin).href;
    } catch {
      return "";
    }
  }

  function normalizePublicDesign(input = {}) {
    const design = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const backgroundType = normalizeDesignEnum(
      design.backgroundType || design.background_type,
      ["color", "gradient", "image", "video"],
      DEFAULT_FULL_PAGE_DESIGN.backgroundType
    );

    return {
      backgroundType,
      backgroundColor: normalizeColor(
        design.backgroundColor || design.background_color,
        DEFAULT_FULL_PAGE_DESIGN.backgroundColor
      ),
      backgroundGradientTo: normalizeColor(
        design.backgroundGradientTo || design.background_gradient_to,
        DEFAULT_FULL_PAGE_DESIGN.backgroundGradientTo
      ),
      backgroundImageUrl: resolveMediaUrl(design.backgroundImageUrl || design.background_image_url),
      backgroundVideoUrl: resolveMediaUrl(design.backgroundVideoUrl || design.background_video_url),
      backgroundOverlayColor: normalizeColor(
        design.backgroundOverlayColor || design.background_overlay_color,
        DEFAULT_FULL_PAGE_DESIGN.backgroundOverlayColor
      ),
      backgroundOverlayOpacity: normalizeDesignNumber(
        design.backgroundOverlayOpacity ?? design.background_overlay_opacity,
        DEFAULT_FULL_PAGE_DESIGN.backgroundOverlayOpacity,
        0,
        0.92,
        2
      ),
      backgroundBlur: normalizeDesignNumber(
        design.backgroundBlur ?? design.background_blur,
        DEFAULT_FULL_PAGE_DESIGN.backgroundBlur,
        0,
        18
      ),
      backgroundFocalPoint: normalizeDesignEnum(
        design.backgroundFocalPoint || design.background_focal_point,
        ["center", "top", "left", "right"],
        DEFAULT_FULL_PAGE_DESIGN.backgroundFocalPoint
      ),
      disableVideoOnMobile: normalizeBoolean(
        design.disableVideoOnMobile ?? design.disable_video_on_mobile,
        DEFAULT_FULL_PAGE_DESIGN.disableVideoOnMobile
      ),
    };
  }

  function getBootstrapDesign(payload = {}) {
    const config = payload.widgetConfig || payload.widget_config || {};
    const fullPageConfig = config.fullPageConfig || config.full_page_config || {};
    return normalizePublicDesign(fullPageConfig.design || {});
  }

  function buildBootstrapUrl(agentId) {
    const url = new URL("/widget/bootstrap", vonzaOrigin);
    url.searchParams.set("agent_id", agentId);
    url.searchParams.set("display_mode", "page");
    url.searchParams.set("origin", window.location.origin || "");
    url.searchParams.set("page_url", window.location.href || "");
    return url.toString();
  }

  function applyLayerStyles(layer, zIndex) {
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = String(zIndex);
  }

  function isMobileViewport() {
    if (typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(max-width: 720px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
  }

  function ensureBackgroundOverlay(entry) {
    if (entry.overlay) {
      return entry.overlay;
    }

    entry.overlay = document.createElement("div");
    entry.overlay.setAttribute("data-vonza-assistant-background-overlay", "");
    applyLayerStyles(entry.overlay, 1);
    entry.backgroundTarget.appendChild(entry.overlay);
    return entry.overlay;
  }

  function ensureBackgroundVideo(entry) {
    if (entry.video) {
      return entry.video;
    }

    entry.video = document.createElement("video");
    entry.video.setAttribute("data-vonza-assistant-background-video", "");
    entry.video.muted = true;
    entry.video.loop = true;
    entry.video.autoplay = true;
    entry.video.playsInline = true;
    entry.video.setAttribute("aria-hidden", "true");
    applyLayerStyles(entry.video, 0);
    entry.video.style.objectFit = "cover";
    entry.backgroundTarget.appendChild(entry.video);
    return entry.video;
  }

  function resetSectionBackground(entry) {
    const target = entry.backgroundTarget;
    target.style.background = "";
    target.style.backgroundImage = "";
    target.style.backgroundSize = "";
    target.style.backgroundPosition = "";
    target.style.backgroundRepeat = "";
    target.style.backgroundColor = "";

    if (entry.overlay) {
      entry.overlay.style.background = "transparent";
      entry.overlay.style.opacity = "0";
    }

    if (entry.video) {
      entry.video.hidden = true;
      entry.video.removeAttribute("src");
    }
  }

  function applyPageBodyBackground(entry, design) {
    if (!entry.pageReset || entry.backgroundScope !== "page" || !document.body) {
      return;
    }

    const body = document.body;
    const html = document.documentElement;

    body.style.backgroundColor = design.backgroundColor;
    if (html?.style) {
      html.style.backgroundColor = design.backgroundColor;
    }

    body.style.background = "";
    body.style.backgroundImage = "";
    body.style.backgroundSize = "";
    body.style.backgroundPosition = "";
    body.style.backgroundRepeat = "";

    if (design.backgroundType === "gradient") {
      body.style.background = `linear-gradient(135deg, ${design.backgroundColor}, ${design.backgroundGradientTo})`;
    }

    if (["image", "video"].includes(design.backgroundType) && design.backgroundImageUrl) {
      body.style.backgroundImage = `url("${design.backgroundImageUrl.replace(/"/g, "%22")}")`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = design.backgroundFocalPoint;
      body.style.backgroundRepeat = "no-repeat";
    }
  }

  function applySectionBackground(entry, design) {
    if (!["section", "viewport", "page"].includes(entry.backgroundScope)) {
      return;
    }

    const target = entry.backgroundTarget;
    resetSectionBackground(entry);
    target.style.backgroundColor = design.backgroundColor;

    if (design.backgroundType === "gradient") {
      target.style.background = `linear-gradient(135deg, ${design.backgroundColor}, ${design.backgroundGradientTo})`;
    }

    if (design.backgroundType === "image" && design.backgroundImageUrl) {
      target.style.backgroundImage = `url("${design.backgroundImageUrl.replace(/"/g, "%22")}")`;
      target.style.backgroundSize = "cover";
      target.style.backgroundPosition = design.backgroundFocalPoint;
      target.style.backgroundRepeat = "no-repeat";
    }

    if (design.backgroundType === "video") {
      if (design.backgroundImageUrl) {
        target.style.backgroundImage = `url("${design.backgroundImageUrl.replace(/"/g, "%22")}")`;
        target.style.backgroundSize = "cover";
        target.style.backgroundPosition = design.backgroundFocalPoint;
        target.style.backgroundRepeat = "no-repeat";
      }

      if (design.backgroundVideoUrl && !(design.disableVideoOnMobile && isMobileViewport())) {
        const video = ensureBackgroundVideo(entry);
        video.style.objectPosition = design.backgroundFocalPoint;
        video.style.filter = `blur(${design.backgroundBlur}px) saturate(1.02)`;
        video.hidden = false;

        if (video.getAttribute("src") !== design.backgroundVideoUrl) {
          video.setAttribute("src", design.backgroundVideoUrl);
        }

        video.play?.().catch?.(() => {});
      }
    }

    if (["gradient", "image", "video"].includes(design.backgroundType)) {
      const overlay = ensureBackgroundOverlay(entry);
      overlay.style.background = design.backgroundOverlayColor;
      overlay.style.opacity = String(design.backgroundOverlayOpacity);
    }

    applyPageBodyBackground(entry, design);
  }

  function loadAndApplySectionBackground(entry) {
    if (
      !isCanvasLayout(entry.layout)
      || !["section", "viewport", "page"].includes(entry.backgroundScope)
      || typeof window.fetch !== "function"
    ) {
      return;
    }

    window.fetch(buildBootstrapUrl(entry.agentId))
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) {
          return;
        }

        applySectionBackground(entry, getBootstrapDesign(payload));
      })
      .catch(() => {});
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

  function resolveViewportHeight() {
    return window.visualViewport?.height || window.innerHeight || FULL_PAGE_DEFAULT_MIN_HEIGHT;
  }

  function calculateFullPageTopOffset(entry) {
    if (entry.pageReset) {
      return entry.headerOffset !== null ? entry.headerOffset : 0;
    }

    if (entry.headerOffset !== null) {
      return entry.headerOffset;
    }

    const rect = entry.mount.getBoundingClientRect?.()
      || entry.backgroundTarget.getBoundingClientRect?.()
      || entry.iframe.getBoundingClientRect?.()
      || { top: 0 };
    return Math.max(0, Math.floor(rect.top || 0));
  }

  function calculateFullPageHeight(entry) {
    const viewportHeight = resolveViewportHeight();

    const top = calculateFullPageTopOffset(entry);
    return Math.max(entry.minHeight, Math.floor(viewportHeight - top));
  }

  function syncFullPageWrapperMinHeight(entry) {
    if (entry.heightMode !== "full-page") {
      return;
    }

    const topOffset = calculateFullPageTopOffset(entry);
    entry.backgroundTarget.style.minHeight = buildViewportMinHeight(entry.minHeight, topOffset);
  }

  function applyFullPageHeight(entry) {
    const nextHeight = calculateFullPageHeight(entry);

    if (Math.abs(nextHeight - entry.currentHeight) < 4 && entry.iframe.style.height) {
      syncFullPageWrapperMinHeight(entry);
      return;
    }

    entry.currentHeight = nextHeight;
    entry.iframe.style.height = `${nextHeight}px`;

    if (entry.heightMode === "full-page") {
      entry.iframe.style.minHeight = `${nextHeight}px`;
      entry.backgroundTarget.style.height = "";
      syncFullPageWrapperMinHeight(entry);
      return;
    }

    entry.backgroundTarget.style.height = `${nextHeight}px`;
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
      .filter((entry) => isCanvasLayout(entry.layout))
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

  function findScopedFooterCandidates(element) {
    const candidates = new Set();
    const roots = [element, ...getAncestorElements(element, 5)];

    roots.forEach((root) => {
      let sibling = root.nextElementSibling;
      let count = 0;

      while (sibling && count < 8) {
        if (matchesAnySelector(sibling, PAGE_FOOTER_SELECTORS) || trimText(sibling.getAttribute?.("role")).toLowerCase() === "contentinfo") {
          candidates.add(sibling);
        }

        queryAllSafe(sibling, PAGE_FOOTER_SELECTORS).forEach((candidate) => candidates.add(candidate));
        sibling = sibling.nextElementSibling;
        count += 1;
      }
    });

    queryAllSafe(document, PAGE_FOOTER_SELECTORS)
      .filter((candidate) => isElementAfterMount(candidate, element))
      .forEach((candidate) => candidates.add(candidate));

    return Array.from(candidates)
      .filter((candidate) => !isInsidePageChrome(candidate) && isElementAfterMount(candidate, element));
  }

  function hideScopedPageFooters(element) {
    findScopedFooterCandidates(element).forEach((footer) => {
      footer.setAttribute("data-vonza-assistant-hidden-footer", "");
      footer.hidden = true;
      footer.style.display = "none";
    });
  }

  function findScopedTitleCandidates(element) {
    const candidates = new Set();
    const roots = [element, ...getAncestorElements(element, 5)];

    roots.forEach((root) => {
      let sibling = root.previousElementSibling;
      let count = 0;

      while (sibling && count < 6) {
        if (matchesAnySelector(sibling, PAGE_TITLE_SELECTORS)) {
          candidates.add(sibling);
        }

        queryAllSafe(sibling, PAGE_TITLE_SELECTORS).forEach((candidate) => candidates.add(candidate));
        sibling = sibling.previousElementSibling;
        count += 1;
      }
    });

    queryAllSafe(document, PAGE_TITLE_SELECTORS)
      .filter((candidate) => isElementBeforeMount(candidate, element))
      .forEach((candidate) => candidates.add(candidate));

    return Array.from(candidates)
      .filter((candidate) => !isInsidePageChrome(candidate) && isElementBeforeMount(candidate, element));
  }

  function hideScopedPageTitles(element) {
    findScopedTitleCandidates(element).forEach((title) => {
      title.setAttribute("data-vonza-assistant-hidden-title", "");
      title.hidden = true;
      title.style.display = "none";
    });
  }

  function applyDedicatedPageReset(element, wrapper) {
    const resetTargets = getAncestorElements(element, 6)
      .filter((ancestor) => matchesAnySelector(ancestor, PAGE_RESET_CONTAINER_SELECTORS))
      .slice(0, 4);

    addClass(element, "vonza-dedicated-page-active");
    addClass(wrapper, "vonza-dedicated-page-active");
    addClass(document.body, "vonza-dedicated-page-active");
    addClass(document.documentElement, "vonza-dedicated-page-active");

    if (document.body?.style) {
      document.body.style.overflowX = "hidden";
    }
    if (document.documentElement?.style) {
      document.documentElement.style.overflowX = "hidden";
    }

    element.style.width = "100vw";
    element.style.maxWidth = "100vw";
    element.style.marginLeft = "calc(50% - 50vw)";
    element.style.marginRight = "calc(50% - 50vw)";
    element.style.padding = "0";

    resetTargets.forEach((target) => {
      addClass(target, "vonza-dedicated-page-container");
      target.style.boxSizing = "border-box";
      target.style.width = "100%";
      target.style.maxWidth = "none";
      target.style.marginLeft = "0";
      target.style.marginRight = "0";
      target.style.paddingLeft = "0";
      target.style.paddingRight = "0";
      target.style.paddingTop = "0";
      target.style.paddingBottom = "0";
      target.style.overflowX = "hidden";
    });
  }

  function hideDirectPageFooter(element) {
    const footer = element.nextElementSibling;

    if (!footer) {
      return;
    }

    const tagName = trimText(footer.tagName).toLowerCase();
    const role = trimText(footer.getAttribute?.("role")).toLowerCase();

    if (!matchesAnySelector(footer, PAGE_FOOTER_SELECTORS) && tagName !== "footer" && role !== "contentinfo") {
      return;
    }

    footer.setAttribute("data-vonza-assistant-hidden-footer", "");
    footer.hidden = true;
    footer.style.display = "none";
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
    const backgroundScope = isCanvasLayout(layout)
      ? normalizeBackgroundScope(element.getAttribute("data-background-scope"), layout)
      : "iframe";
    const showTitle = normalizeShowTitle(element.getAttribute("data-show-title"));
    const minHeight = resolveMinHeight(element, layout, size);
    const headerOffset = isCanvasLayout(layout)
      ? normalizeOptionalNumber(element.getAttribute("data-header-offset"), 0, 2000)
      : null;
    const heightMode = normalizeHeightMode(element.getAttribute("data-height"), layout);
    const pageReset = isPageTakeover(layout)
      ? normalizeBoolean(element.getAttribute("data-page-reset"), false)
      : false;
    const hidePageFooter = isPageTakeover(layout)
      ? normalizeBoolean(element.getAttribute("data-hide-page-footer"), false)
      : false;
    const hidePageTitle = isPageTakeover(layout)
      ? normalizeBoolean(element.getAttribute("data-hide-page-title"), false)
      : false;
    const iframe = document.createElement("iframe");
    const takeoverWrapper = isPageTakeover(layout) ? document.createElement("div") : null;

    iframe.src = buildAssistantUrl({ agentId, layout, size, surface, showTitle, backgroundScope });
    iframe.title = trimText(element.getAttribute("data-title")) || "AI assistant";
    iframe.loading = "lazy";
    iframe.allowTransparency = surface === "transparent" || ["section", "viewport"].includes(backgroundScope);
    iframe.setAttribute("data-vonza-assistant-frame", "");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    applyIframeStyles(iframe, { layout, surface, minHeight, backgroundScope });
    applyMountStyles(element, { layout, minHeight, headerOffset, heightMode });

    if (takeoverWrapper) {
      takeoverWrapper.setAttribute("data-vonza-assistant-takeover", "");
      addClass(element, "vonza-page-takeover-active");
      addClass(takeoverWrapper, "vonza-page-takeover-active");
      applyTakeoverWrapperStyles(takeoverWrapper, {
        minHeight,
        topOffset: pageReset
          ? (headerOffset !== null ? headerOffset : 0)
          : headerOffset !== null ? headerOffset : Math.max(0, Math.floor(element.getBoundingClientRect?.().top || 0)),
      });
      if (pageReset) {
        applyDedicatedPageReset(element, takeoverWrapper);
      }
    }

    element.textContent = "";
    if (takeoverWrapper) {
      takeoverWrapper.appendChild(iframe);
      element.appendChild(takeoverWrapper);
    } else {
      element.appendChild(iframe);
    }
    element.setAttribute("data-vonza-assistant-mounted", "true");
    element.setAttribute("data-vonza-assistant-layout", layout);

    const entry = {
      iframe,
      mount: element,
      backgroundTarget: takeoverWrapper || element,
      agentId,
      layout,
      backgroundScope,
      heightMode,
      minHeight,
      headerOffset,
      pageReset,
      hidePageFooter,
      hidePageTitle,
      currentHeight: minHeight,
      heightFrame: 0,
    };
    state.frames.push(entry);

    if (hidePageFooter) {
      hideDirectPageFooter(element);
      if (pageReset) {
        hideScopedPageFooters(element);
      }
    }

    if (hidePageTitle && pageReset) {
      hideScopedPageTitles(element);
    }

    if (isCanvasLayout(layout)) {
      scheduleFullPageHeight(entry);
      loadAndApplySectionBackground(entry);
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
