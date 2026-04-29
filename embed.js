(() => {
  const GLOBAL_FLAG = "__VonzaAssistantWidgetLoaded__";
  const ROOT_ID = "vonza-widget-root";
  const LOG_PREFIX = "[Vonza widget]";
  const LEGACY_WIDGET_DEFAULTS = {
    primaryColor: "#10a37f",
    secondaryColor: "#0c7f75",
  };
  const DEFAULT_WIDGET_CONFIG = {
    assistantName: "Vonza AI",
    buttonLabel: "Chat with Vonza",
    primaryColor: "#5b61ff",
    secondaryColor: "#7c4dff",
  };

  if (window[GLOBAL_FLAG] || document.getElementById(ROOT_ID)) {
    console.warn(`${LOG_PREFIX} widget already injected, skipping duplicate load.`);
    return;
  }

  function resolveCurrentScript() {
    if (document.currentScript) {
      return document.currentScript;
    }

    const scripts = Array.from(document.getElementsByTagName("script"));
    return scripts.reverse().find((script) => /\/embed\.js(?:\?|$)/.test(script.src));
  }

  function createLogger(enabled) {
    return {
      log: (...args) => {
        if (enabled) {
          console.log(LOG_PREFIX, ...args);
        }
      },
      warn: (...args) => console.warn(LOG_PREFIX, ...args),
      error: (...args) => console.error(LOG_PREFIX, ...args),
    };
  }

  function getConfig(currentScript) {
    const fallbackUrl = currentScript?.src
      ? new URL(currentScript.src, window.location.href)
      : new URL(window.location.href);
    const scriptConfig = window.VonzaWidgetConfig || {};
    const publicAppUrl = cleanBaseUrl(window.VONZA_PUBLIC_APP_URL || "");

    const baseUrl = (
      currentScript?.dataset.baseUrl ||
      scriptConfig.baseUrl ||
      publicAppUrl ||
      fallbackUrl.origin
    ).replace(/\/$/, "");

    return {
      baseUrl,
      installId:
        currentScript?.dataset.installId ||
        scriptConfig.installId ||
        "",
      agentId:
        currentScript?.dataset.agentId ||
        scriptConfig.agentId ||
        "",
      agentKey:
        currentScript?.dataset.agentKey ||
        scriptConfig.agentKey ||
        "",
      businessId:
        currentScript?.dataset.businessId ||
        scriptConfig.businessId ||
        "",
      websiteUrl:
        currentScript?.dataset.websiteUrl ||
        scriptConfig.websiteUrl ||
        (/^https?:$/.test(window.location.protocol) ? window.location.origin : ""),
      buttonLabel:
        currentScript?.dataset.buttonLabel ||
        scriptConfig.buttonLabel ||
        "Chat with Vonza",
      primaryColor:
        currentScript?.dataset.primaryColor ||
        scriptConfig.primaryColor ||
        "",
      secondaryColor:
        currentScript?.dataset.secondaryColor ||
        scriptConfig.secondaryColor ||
        "",
      debug:
        currentScript?.dataset.debug === "true" ||
        scriptConfig.debug === true,
    };
  }

  function cleanBaseUrl(value) {
    return String(value || "").replace(/\/$/, "");
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function normalizeHexColor(value) {
    return cleanText(value).toLowerCase();
  }

  function normalizeVisualConfig(input = {}) {
    const next = {
      ...DEFAULT_WIDGET_CONFIG,
      ...input,
    };
    const primaryColor = normalizeHexColor(next.primaryColor);
    const secondaryColor = normalizeHexColor(next.secondaryColor);
    const hasLegacyColors =
      primaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.primaryColor)
      && secondaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.secondaryColor);

    if (hasLegacyColors || (!primaryColor && !secondaryColor)) {
      next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
      next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
    } else {
      if (!primaryColor) {
        next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
      }

      if (!secondaryColor) {
        next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
      }
    }

    return next;
  }

  function buildWidgetUrl(baseUrl, config) {
    const url = new URL("/widget", baseUrl);
    url.searchParams.set("embedded", "1");
    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("page_url", window.location.href);

    if (config.installId) {
      url.searchParams.set("install_id", config.installId);
    }

    if (config.agentId) {
      url.searchParams.set("agent_id", config.agentId);
    }

    if (config.agentKey) {
      url.searchParams.set("agent_key", config.agentKey);
    }

    if (config.businessId) {
      url.searchParams.set("business_id", config.businessId);
    }

    if (config.websiteUrl) {
      url.searchParams.set("website_url", config.websiteUrl);
    }

    if (config.sessionId) {
      url.searchParams.set("session_id", config.sessionId);
    }

    if (config.fingerprint) {
      url.searchParams.set("fingerprint", config.fingerprint);
    }

    return url;
  }

  function buildBootstrapUrl(baseUrl, config) {
    const url = new URL("/widget/bootstrap", baseUrl);

    if (config.installId) {
      url.searchParams.set("install_id", config.installId);
    }

    if (config.agentId) {
      url.searchParams.set("agent_id", config.agentId);
    }

    if (config.agentKey) {
      url.searchParams.set("agent_key", config.agentKey);
    }

    if (config.businessId) {
      url.searchParams.set("business_id", config.businessId);
    }

    if (config.websiteUrl) {
      url.searchParams.set("website_url", config.websiteUrl);
    }

    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("page_url", window.location.href);

    return url;
  }

  function getStorageScope(config) {
    return config.installId || config.agentKey || config.agentId || config.businessId || "default";
  }

  function getPersistentFingerprint(config) {
    const key = `vonza_widget_fingerprint_${getStorageScope(config)}`;
    let value = window.localStorage.getItem(key);

    if (!value) {
      value = window.crypto?.randomUUID?.() || `fp_${Date.now()}`;
      window.localStorage.setItem(key, value);
    }

    return value;
  }

  function getSessionId(config) {
    const key = `vonza_widget_session_${getStorageScope(config)}`;
    let value = window.sessionStorage.getItem(key);

    if (!value) {
      value = window.crypto?.randomUUID?.() || `session_${Date.now()}`;
      window.sessionStorage.setItem(key, value);
    }

    return value;
  }

  async function postInstallRequest(baseUrl, pathname, payload) {
    const url = new URL(pathname, baseUrl);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify(payload),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.error || "Request failed");
      error.statusCode = response.status;
      throw error;
    }

    return data;
  }

  function createTemplate(visualConfig = DEFAULT_WIDGET_CONFIG) {
    return `
      <style>
        :host {
          all: initial;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .widget-shell {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 2147483647;
          font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .launcher {
          position: relative;
          width: 62px;
          height: 62px;
          border: none;
          border-radius: 22px;
          display: grid;
          place-items: center;
          cursor: pointer;
          overflow: visible;
          color: #4350dc;
          background:
            radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.24), transparent 32%),
            linear-gradient(135deg, var(--widget-primary, ${visualConfig.primaryColor}) 0%, var(--widget-secondary, ${visualConfig.secondaryColor}) 100%);
          box-shadow:
            0 18px 36px rgba(67, 71, 178, 0.24),
            0 10px 18px rgba(58, 69, 136, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.24);
          transition:
            transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 220ms ease;
        }

        .launcher::before {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 28px;
          background: radial-gradient(circle, color-mix(in srgb, var(--widget-primary, ${visualConfig.primaryColor}) 22%, transparent), transparent 72%);
          opacity: 0.75;
          transform: scale(0.92);
          animation: ring 2.8s infinite ease-out;
          pointer-events: none;
        }

        .launcher:hover {
          transform: translateY(-1px) scale(1.04);
          box-shadow:
            0 22px 40px rgba(67, 71, 178, 0.28),
            0 12px 24px rgba(58, 69, 136, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .launcher-badge {
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            0 8px 18px rgba(68, 80, 132, 0.14);
        }

        .launcher-face {
          position: relative;
          width: 22px;
          height: 16px;
          border-bottom: 3px solid currentColor;
          border-radius: 0 0 13px 13px;
        }

        .launcher-face::before,
        .launcher-face::after {
          content: "";
          position: absolute;
          top: 2px;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: currentColor;
        }

        .launcher-face::before {
          left: 4px;
        }

        .launcher-face::after {
          right: 4px;
        }

        .launcher-presence {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #3dbb68;
          border: 2px solid rgba(255, 255, 255, 0.96);
          box-shadow: 0 0 0 4px rgba(61, 187, 104, 0.18);
        }

        .launcher-badge.is-opening {
          animation: launcherLogoPulse 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .launcher-label {
          position: absolute;
          right: 78px;
          top: 50%;
          transform: translateY(-50%) translateX(10px);
          padding: 10px 14px;
          border-radius: 999px;
          white-space: nowrap;
          color: #1c2642;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(94, 110, 152, 0.12);
          box-shadow: 0 18px 36px rgba(80, 96, 150, 0.16);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          opacity: 0;
          pointer-events: none;
          transition:
            opacity 180ms ease,
            transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .widget-shell:hover .launcher-label {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }

        .modal {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 18px;
          background: rgba(12, 18, 40, 0.12);
          backdrop-filter: blur(8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .modal[data-open="true"] {
          opacity: 1;
          pointer-events: auto;
        }

        .panel {
          position: relative;
          width: min(408px, calc(100vw - 24px));
          height: min(724px, calc(100vh - 24px));
          border-radius: 30px;
          overflow: hidden;
          box-shadow:
            0 34px 96px rgba(43, 56, 95, 0.2),
            0 14px 28px rgba(60, 74, 128, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.78);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0)),
            #f6f8ff;
          transform: translateY(10px) scale(0.95);
          opacity: 0;
          transition:
            transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .modal[data-open="true"] .panel {
          transform: translateY(0) scale(1);
          opacity: 1;
        }

        .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), transparent 18%);
          pointer-events: none;
          z-index: 1;
        }

        .frame {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #ffffff;
        }

        .status-layer {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 28px;
          text-align: center;
          color: #1c2642;
          background:
            radial-gradient(circle at top left, rgba(124, 77, 255, 0.08), transparent 34%),
            radial-gradient(circle at top right, rgba(91, 97, 255, 0.1), transparent 30%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.96));
          z-index: 2;
          transition: opacity 180ms ease;
        }

        .status-layer[hidden] {
          opacity: 0;
          pointer-events: none;
        }

        .status-spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid rgba(91, 97, 255, 0.14);
          border-top-color: var(--widget-primary, ${visualConfig.primaryColor});
          animation: spin 850ms linear infinite;
        }

        .status-title {
          font-size: 15px;
          font-weight: 800;
          line-height: 1.4;
        }

        .status-copy {
          font-size: 13px;
          line-height: 1.5;
          color: rgba(85, 97, 127, 0.84);
        }

        .status-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .status-button {
          border: none;
          border-radius: 16px;
          padding: 10px 14px;
          background: linear-gradient(135deg, var(--widget-primary, ${visualConfig.primaryColor}), var(--widget-secondary, ${visualConfig.secondaryColor}));
          color: #ffffff;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(91, 97, 255, 0.18);
        }

        .status-button.secondary {
          background: #ffffff;
          color: #1c2642;
          border: 1px solid rgba(94, 110, 152, 0.14);
          box-shadow: none;
        }

        .close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.2);
          font: inherit;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          z-index: 3;
          transition:
            transform 180ms ease,
            background 180ms ease;
        }

        .close:hover {
          transform: scale(1.04);
          background: rgba(255, 255, 255, 0.24);
        }

        @keyframes ring {
          0% {
            opacity: 0.72;
            transform: scale(0.92);
          }
          70% {
            opacity: 0;
            transform: scale(1.18);
          }
          100% {
            opacity: 0;
            transform: scale(1.18);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes launcherLogoPulse {
          0% {
            transform: scale(0.92);
            opacity: 0;
          }
          55% {
            transform: scale(1.06);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .widget-shell {
            right: 16px;
            bottom: 16px;
          }

          .launcher {
            width: 58px;
            height: 58px;
          }

          .launcher-badge {
            width: 38px;
            height: 38px;
          }

          .launcher-label {
            display: none;
          }

          .modal {
            padding: 0;
            align-items: stretch;
            justify-content: stretch;
          }

          .panel {
            width: 100vw;
            height: 100vh;
            border-radius: 0;
            border: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .launcher,
          .launcher-label,
          .modal,
          .panel,
          .status-layer,
          .close {
            transition: none;
          }

          .launcher::before,
          .status-spinner {
            animation: none;
          }
        }
      </style>
      <div class="widget-shell">
        <button class="launcher" type="button" aria-label="${visualConfig.buttonLabel}" title="${visualConfig.buttonLabel}">
          <span class="launcher-badge">
            <span class="launcher-face"></span>
          </span>
          <span class="launcher-presence"></span>
        </button>
        <div class="launcher-label">${visualConfig.buttonLabel}</div>
        <div class="modal" data-open="false" aria-hidden="true">
          <div class="panel" role="dialog" aria-modal="true" aria-label="Vonza assistant">
            <button class="close" type="button" aria-label="Close">&times;</button>
            <div class="status-layer">
              <div class="status-spinner"></div>
              <div class="status-title">Opening chat</div>
              <div class="status-copy">This will just take a moment.</div>
              <div class="status-actions" hidden>
                <button class="status-button" type="button" data-action="retry">Retry</button>
                <button class="status-button secondary" type="button" data-action="close">Close</button>
              </div>
            </div>
            <iframe class="frame" title="${visualConfig.assistantName}" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
        </div>
      </div>
    `;
  }

  async function createWidget() {
    const currentScript = resolveCurrentScript();
    const config = getConfig(currentScript);
    const logger = createLogger(config.debug);
    const bootstrapUrl = buildBootstrapUrl(config.baseUrl, config);
    const sessionId = getSessionId(config);
    const fingerprint = getPersistentFingerprint(config);

    if (!config.installId && !config.agentId && !config.agentKey && !config.businessId && !config.websiteUrl) {
      logger.warn(
        "No install or assistant identifier was provided. Pass data-install-id, data-agent-id, data-agent-key, data-business-id, or data-website-url on the script tag."
      );
      return;
    }

    logger.log("Initializing", {
      baseUrl: config.baseUrl,
      installId: config.installId || null,
      agentId: config.agentId || null,
      agentKey: config.agentKey || null,
      businessId: config.businessId || null,
      websiteUrl: config.websiteUrl || null,
      pageUrl: window.location.href,
      origin: window.location.origin,
    });

    let bootstrapData = null;

    try {
      const response = await fetch(bootstrapUrl.toString(), {
        headers: {
          accept: "application/json",
        },
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(data?.error || "Bootstrap failed");
        error.statusCode = response.status;
        throw error;
      }

      bootstrapData = data;
    } catch (error) {
      if (config.installId) {
        logger.warn("Widget refused to initialize on this page.", error.message || error);
        return;
      }

      logger.warn("Bootstrap config unavailable, using defaults.", error);
    }

    const installId = bootstrapData?.install?.installId || config.installId || "";
    const visualConfig = normalizeVisualConfig({
      ...DEFAULT_WIDGET_CONFIG,
      ...(bootstrapData?.widgetConfig || {}),
      buttonLabel:
        config.buttonLabel ||
        bootstrapData?.widgetConfig?.buttonLabel ||
        DEFAULT_WIDGET_CONFIG.buttonLabel,
      primaryColor:
        config.primaryColor ||
        bootstrapData?.widgetConfig?.primaryColor ||
        DEFAULT_WIDGET_CONFIG.primaryColor,
      secondaryColor:
        config.secondaryColor ||
        bootstrapData?.widgetConfig?.secondaryColor ||
        DEFAULT_WIDGET_CONFIG.secondaryColor,
    });
    const runtimeConfig = {
      ...config,
      installId,
      sessionId,
      fingerprint,
    };
    const widgetUrl = buildWidgetUrl(config.baseUrl, runtimeConfig);

    const host = document.createElement("div");
    host.id = ROOT_ID;
    document.body.appendChild(host);
    window[GLOBAL_FLAG] = true;

    const shadowRoot = host.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = createTemplate(visualConfig);
    host.style.setProperty("--widget-primary", visualConfig.primaryColor);
    host.style.setProperty("--widget-secondary", visualConfig.secondaryColor);

    const launcher = shadowRoot.querySelector(".launcher");
    const launcherBadge = shadowRoot.querySelector(".launcher-badge");
    const modal = shadowRoot.querySelector(".modal");
    const panel = shadowRoot.querySelector(".panel");
    const closeButton = shadowRoot.querySelector(".close");
    const iframe = shadowRoot.querySelector(".frame");
    const statusLayer = shadowRoot.querySelector(".status-layer");
    const statusTitle = shadowRoot.querySelector(".status-title");
    const statusCopy = shadowRoot.querySelector(".status-copy");
    const statusActions = shadowRoot.querySelector(".status-actions");
    const retryButton = shadowRoot.querySelector('[data-action="retry"]');
    const fallbackCloseButton = shadowRoot.querySelector('[data-action="close"]');

    let hasLoadedFrame = false;
    let loadTimer = null;
    let previousBodyOverflow = "";
    let previousHtmlOverflow = "";
    const launcherLabel = shadowRoot.querySelector(".launcher-label");

    launcher.setAttribute("aria-label", visualConfig.buttonLabel);
    launcher.setAttribute("title", visualConfig.buttonLabel);
    launcherLabel.textContent = visualConfig.buttonLabel;
    statusCopy.textContent = `We're getting ${visualConfig.assistantName} ready.`;
    panel.setAttribute("aria-label", visualConfig.assistantName);
    iframe.setAttribute("title", visualConfig.assistantName);

    async function trackEvent(eventName, metadata = {}, options = {}) {
      if (!installId) {
        return;
      }

      try {
        await postInstallRequest(config.baseUrl, "/install/events", {
          install_id: installId,
          event_name: eventName,
          session_id: sessionId,
          fingerprint,
          origin: window.location.origin,
          page_url: window.location.href,
          dedupe_key: options.dedupeKey || "",
          metadata,
        });
      } catch (error) {
        logger.warn(`Event '${eventName}' was not recorded.`, error.message || error);
      }
    }

    async function pingInstall() {
      if (!installId) {
        return;
      }

      try {
        await postInstallRequest(config.baseUrl, "/install/ping", {
          install_id: installId,
          origin: window.location.origin,
          page_url: window.location.href,
          session_id: sessionId,
          fingerprint,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn("Install ping was not recorded.", error.message || error);
      }
    }

    void pingInstall();
    void trackEvent(
      "widget_loaded",
      {
        source: "embed_loader",
      },
      {
        dedupeKey: `${installId}::widget_loaded::${window.location.href}`,
      }
    );

    function showLoadingState() {
      statusLayer.hidden = false;
      statusActions.hidden = true;
      statusTitle.textContent = "Opening chat";
      statusCopy.textContent = "This will just take a moment.";
    }

    function showErrorState() {
      statusLayer.hidden = false;
      statusActions.hidden = false;
      statusTitle.textContent = "Chat unavailable";
      statusCopy.textContent =
        "The widget could not load right now. Please try again in a moment.";
      logger.error("Widget iframe did not finish loading in time.");
    }

    function hideStatusLayer() {
      statusLayer.hidden = true;
    }

    function clearLoadTimer() {
      if (loadTimer) {
        window.clearTimeout(loadTimer);
        loadTimer = null;
      }
    }

    function startLoadTimer() {
      clearLoadTimer();
      loadTimer = window.setTimeout(showErrorState, 12000);
    }

    function loadIframe(forceReload = false) {
      if (forceReload || !iframe.src) {
        const nextUrl = new URL(widgetUrl.toString());

        if (forceReload) {
          nextUrl.searchParams.set("_ts", String(Date.now()));
        }

        iframe.src = nextUrl.toString();
        logger.log("Loading iframe", iframe.src);
      }

      showLoadingState();
      startLoadTimer();
    }

    function pulseLauncherLogo() {
      launcherBadge.classList.remove("is-opening");
      void launcherBadge.offsetWidth;
      launcherBadge.classList.add("is-opening");
      window.setTimeout(() => launcherBadge.classList.remove("is-opening"), 320);
    }

    function openModal() {
      modal.setAttribute("data-open", "true");
      modal.setAttribute("aria-hidden", "false");
      pulseLauncherLogo();
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      if (!hasLoadedFrame) {
        loadIframe(false);
      }

      logger.log("Opened widget");
      void trackEvent("widget_opened", {
        source: "launcher",
      });
    }

    function closeModal() {
      modal.setAttribute("data-open", "false");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      clearLoadTimer();
      logger.log("Closed widget");
    }

    launcher.addEventListener("click", openModal);
    closeButton.addEventListener("click", closeModal);
    fallbackCloseButton.addEventListener("click", closeModal);
    retryButton.addEventListener("click", () => {
      logger.log("Retrying widget load");
      hasLoadedFrame = false;
      loadIframe(true);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    iframe.addEventListener("load", () => {
      clearLoadTimer();
      hasLoadedFrame = true;
      hideStatusLayer();
      logger.log("Iframe loaded successfully");
    });

    iframe.addEventListener("error", () => {
      clearLoadTimer();
      showErrorState();
      logger.error("Iframe failed to load.");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget, { once: true });
  } else {
    createWidget();
  }
})();
