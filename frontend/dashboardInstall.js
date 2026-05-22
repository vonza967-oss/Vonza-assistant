(function registerVonzaDashboardInstall(global) {
  function trimText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getPublicFullPageConfig(agent = {}) {
    return agent.fullPageConfig || agent.full_page_config || {};
  }

  function getPublicPageKey(agent = {}) {
    const config = getPublicFullPageConfig(agent);
    return trimText(config.publicPageKey || config.public_page_key);
  }

  function isPublicFullPageEnabled(agent = {}) {
    const config = getPublicFullPageConfig(agent);
    return (config.publicPageEnabled === true || config.public_page_enabled === true) && Boolean(getPublicPageKey(agent));
  }

  function normalizeFullPageBackgroundScope(value) {
    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    return ["section", "iframe"].includes(normalized) ? normalized : "section";
  }

  function normalizeFullPageAssistantHeight(value) {
    return trimText(value).toLowerCase().replace(/_/g, "-") === "full-page" ? "full-page" : "auto";
  }

  function normalizeWebsiteHeaderHeight(value = 120) {
    const numericValue = Number.parseInt(value, 10);
    if (!Number.isFinite(numericValue)) {
      return 120;
    }
    return Math.min(Math.max(numericValue, 0), 400);
  }

  function buildInstallMethodCards({
    qrEndpoint = "",
    hasInstall = false,
    installDetected = false,
  } = {}) {
    return [
      {
        key: "page",
        icon: "frontdesk",
        title: "Front Desk page",
        copy: "Share the hosted AI Front Desk page or publish it as the main content of a website page.",
        status: "Recommended",
        tone: "ready",
      },
      {
        key: "qr",
        icon: "review",
        title: "QR / direct link",
        copy: "Open the same Front Desk page from signs, menus, invoices, emails, or direct links.",
        status: qrEndpoint ? "Ready" : "Enable page first",
        tone: qrEndpoint ? "neutral" : "warning",
      },
      {
        key: "widget",
        icon: "install",
        title: "Website widget bubble",
        copy: "Also add a compact chat bubble to normal website pages.",
        status: installDetected ? "Optional installed" : hasInstall ? "Optional" : "Optional",
        tone: installDetected ? "ready" : "neutral",
      },
    ];
  }

  function createInstallHelpers(dependencies = {}) {
    const getPublicAppUrl = typeof dependencies.getPublicAppUrl === "function"
      ? dependencies.getPublicAppUrl
      : () => trimText(global.VONZA_PUBLIC_APP_URL || global.location?.origin).replace(/\/$/, "");
    const getClientId = typeof dependencies.getClientId === "function"
      ? dependencies.getClientId
      : () => "";
    const formatSeenAt = typeof dependencies.formatSeenAt === "function"
      ? dependencies.formatSeenAt
      : (value) => trimText(value);
    const isInstallSeen = typeof dependencies.isInstallSeen === "function"
      ? dependencies.isInstallSeen
      : () => false;
    const sanitizeText = typeof dependencies.trimText === "function" ? dependencies.trimText : trimText;
    const sanitizeHtml = typeof dependencies.escapeHtml === "function" ? dependencies.escapeHtml : escapeHtml;

    function buildScript(agent) {
      const installId = sanitizeText(agent.installId);

      if (!installId) {
        return "";
      }

      return `<script async defer src="${getPublicAppUrl()}/embed.js" data-install-id="${installId}"></script>`;
    }

    function buildWidgetUrl(agentKey) {
      return `${getPublicAppUrl()}/widget?agent_key=${encodeURIComponent(agentKey)}`;
    }

    function buildFullPageAssistantUrl(agent = {}) {
      const agentKey = sanitizeText(agent.publicAgentKey);
      const publicPageKey = getPublicPageKey(agent);

      if (!isPublicFullPageEnabled(agent)) {
        return "";
      }

      if (agentKey) {
        const url = new URL(`/a/${encodeURIComponent(agentKey)}`, getPublicAppUrl());
        url.searchParams.set("k", publicPageKey);
        return url.toString();
      }

      const url = new URL("/widget", getPublicAppUrl());
      if (sanitizeText(agent.id)) {
        url.searchParams.set("agent_id", agent.id);
      }
      url.searchParams.set("mode", "page");
      url.searchParams.set("k", publicPageKey);
      return url.toString();
    }

    function buildWidgetFallbackUrl(agent = {}) {
      return sanitizeText(agent.publicAgentKey) ? buildWidgetUrl(agent.publicAgentKey) : "";
    }

    function buildFrontDeskPreviewUrl(agent = {}) {
      return buildFullPageAssistantUrl(agent) || buildWidgetFallbackUrl(agent);
    }

    function buildEmbeddedFullPageAssistantUrl(agent = {}, size = "standard", options = {}) {
      const normalizedSize = ["compact", "standard", "tall", "full"].includes(sanitizeText(size).toLowerCase())
        ? sanitizeText(size).toLowerCase()
        : "standard";
      const url = new URL("/widget", getPublicAppUrl());
      if (sanitizeText(agent.id)) {
        url.searchParams.set("agent_id", agent.id);
      } else if (sanitizeText(agent.publicAgentKey)) {
        url.searchParams.set("agent_key", agent.publicAgentKey);
      }
      url.searchParams.set("mode", "page");
      url.searchParams.set("embedded", "1");
      url.searchParams.set("size", normalizedSize);
      if (sanitizeText(options.surface)) {
        url.searchParams.set("surface", sanitizeText(options.surface));
      }
      if (sanitizeText(options.layout)) {
        url.searchParams.set("layout", sanitizeText(options.layout));
      }
      if (options.showTitle === false) {
        url.searchParams.set("show_title", "0");
      }
      if (getPublicPageKey(agent)) {
        url.searchParams.set("k", getPublicPageKey(agent));
      }
      return url.toString();
    }

    function buildSmartAssistantEmbed(agent = {}, layout = "section", options = {}) {
      const agentId = sanitizeText(agent.id);

      if (!agentId) {
        return "";
      }

      const requestedLayout = sanitizeText(layout).toLowerCase();
      const normalizedLayout = requestedLayout === "page-takeover"
        ? "page-takeover"
        : requestedLayout === "full-page"
          ? "full-page"
          : "section";
      const isCanvasSmartEmbed = normalizedLayout === "full-page" || normalizedLayout === "page-takeover";
      const backgroundScope = normalizedLayout === "page-takeover"
        ? (sanitizeText(options.backgroundScope).toLowerCase() === "page" ? "page" : "viewport")
        : normalizedLayout === "full-page"
          ? normalizeFullPageBackgroundScope(agent?.fullPageConfig?.design?.backgroundScope || agent?.full_page_config?.design?.background_scope)
          : "";
      const surfaceLine = isCanvasSmartEmbed
        ? '\n  data-surface="flat"'
        : "";
      const backgroundScopeLine = isCanvasSmartEmbed
        ? `\n  data-background-scope="${backgroundScope}"`
        : "";
      const publicPageKeyLine = getPublicPageKey(agent)
        ? `\n  data-public-page-key="${sanitizeHtml(getPublicPageKey(agent))}"`
        : "";
      const heightMode = normalizeFullPageAssistantHeight(options.heightMode);
      const heightLine = normalizedLayout === "full-page" && heightMode === "full-page"
        ? '\n  data-height="full-page"'
        : "";
      const showTitleLine = normalizedLayout === "full-page" && options.showTitle === false
        ? '\n  data-show-title="false"'
        : "";
      const pageResetLine = normalizedLayout === "page-takeover" && options.pageReset === true
        ? '\n  data-page-reset="true"'
        : "";
      const hidePageFooterLine = normalizedLayout === "page-takeover" && options.hidePageFooter === true
        ? '\n  data-hide-page-footer="true"'
        : "";
      const hidePageTitleLine = normalizedLayout === "page-takeover" && options.hidePageTitle === true
        ? '\n  data-hide-page-title="true"'
        : "";

      return `<div
  data-vonza-assistant
  data-agent-id="${agentId}"
  data-layout="${normalizedLayout}"${surfaceLine}${backgroundScopeLine}${heightLine}${showTitleLine}${pageResetLine}${hidePageFooterLine}${hidePageTitleLine}${publicPageKeyLine}
></div>
<script async src="${getPublicAppUrl()}/assistant-embed.js"></script>`;
    }

    function buildFullPageQrEndpoint(agent = {}) {
      const agentId = sanitizeText(agent.id);

      if (!agentId || !isPublicFullPageEnabled(agent)) {
        return "";
      }

      const url = new URL("/agents/full-page-assistant-qr.svg", global.location?.origin || getPublicAppUrl());
      url.searchParams.set("agent_id", agentId);
      url.searchParams.set("client_id", getClientId());
      return `${url.pathname}${url.search}`;
    }

    function buildSectionAssistantIframe(agent = {}) {
      return `<iframe
  src="${buildEmbeddedFullPageAssistantUrl(agent, "standard")}"
  title="AI assistant"
  allow="microphone; autoplay"
  style="width:100%;min-height:640px;border:0;border-radius:18px;overflow:hidden;"
  loading="lazy"
></iframe>`;
    }

    function buildFullPageAssistantIframe(agent = {}, headerHeight = 120, options = {}) {
      const normalizedHeaderHeight = normalizeWebsiteHeaderHeight(headerHeight);
      return `<iframe
  src="${buildEmbeddedFullPageAssistantUrl(agent, "full", { surface: "flat", layout: "canvas", showTitle: options.showTitle })}"
  title="AI assistant"
  allow="microphone; autoplay"
  style="width:100%;height:calc(100vh - ${normalizedHeaderHeight}px);min-height:760px;border:0;display:block;"
  loading="lazy"
></iframe>`;
    }

    function buildSimpleFullPageAssistantIframe(agent = {}, headerHeight = 120) {
      return buildFullPageAssistantIframe(agent, headerHeight);
    }

    function getInstallStatusCopy(installStatus = {}) {
      if (installStatus.state === "seen_recently") {
        return `Live install detected on ${installStatus.host || "your website"}${installStatus.lastSeenAt ? `, last seen ${formatSeenAt(installStatus.lastSeenAt)}` : ""}.`;
      }

      if (installStatus.state === "seen_stale") {
        return `Vonza was seen on ${installStatus.host || "your website"}${installStatus.lastSeenAt ? ` ${formatSeenAt(installStatus.lastSeenAt)}` : ""}, but no recent live ping has arrived.`;
      }

      if (installStatus.state === "installed_unseen") {
        return "The optional website bubble snippet was found on the site, but Vonza has not yet received a live visitor ping.";
      }

      if (installStatus.state === "domain_mismatch") {
        return "Vonza found embed markup, but it points at a different install or a blocked domain.";
      }

      if (installStatus.state === "verify_failed") {
        return "Verification needs attention. Vonza either could not fetch the site or could not find the expected install snippet yet.";
      }

      return "No website bubble install detected yet. The Front Desk page can still launch through the public page, WordPress, smart embed, or QR/direct link.";
    }

    function getInstallStatusTone(installStatus = {}) {
      if (isInstallSeen(installStatus)) {
        return "Ready";
      }

      if (installStatus.state === "installed_unseen") {
        return "Limited";
      }

      if (installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed") {
        return "Needs attention";
      }

      return "Pending";
    }

    function hasFullPageAssistantCustomization(agent = {}) {
      const config = agent.fullPageConfig || agent.full_page_config || {};

      if (!config || typeof config !== "object") {
        return false;
      }

      const listFields = [
        config.suggestedQuestions,
        config.suggested_questions,
      ];

      return Boolean(
        sanitizeText(config.headline)
        || sanitizeText(config.subtitle)
        || sanitizeText(config.logoUrl || config.logo_url)
        || listFields.some((items) => Array.isArray(items) && items.some((item) => sanitizeText(item)))
      );
    }

    return Object.freeze({
      buildScript,
      buildWidgetUrl,
      buildFrontDeskPreviewUrl,
      getPublicFullPageConfig,
      getPublicPageKey,
      isPublicFullPageEnabled,
      buildFullPageAssistantUrl,
      buildEmbeddedFullPageAssistantUrl,
      normalizeFullPageBackgroundScope,
      normalizeFullPageAssistantHeight,
      buildSmartAssistantEmbed,
      buildFullPageQrEndpoint,
      buildSectionAssistantIframe,
      normalizeWebsiteHeaderHeight,
      buildFullPageAssistantIframe,
      buildSimpleFullPageAssistantIframe,
      getInstallStatusCopy,
      getInstallStatusTone,
      hasFullPageAssistantCustomization,
      buildInstallMethodCards,
    });
  }

  global.VonzaDashboardInstall = Object.freeze({
    createInstallHelpers,
    getPublicFullPageConfig,
    getPublicPageKey,
    isPublicFullPageEnabled,
    normalizeFullPageBackgroundScope,
    normalizeFullPageAssistantHeight,
    normalizeWebsiteHeaderHeight,
    buildInstallMethodCards,
  });
})(window);
