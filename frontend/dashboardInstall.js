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
        copy: "Launch the hosted Front Desk page first, then use WordPress or smart embed when it should live on your site.",
        status: "Primary",
        tone: "ready",
      },
      {
        key: "qr",
        icon: "review",
        title: "QR / direct link",
        copy: "Open the same hosted Front Desk page from signs, menus, invoices, emails, or direct links.",
        status: qrEndpoint ? "Primary ready" : "Enable page first",
        tone: qrEndpoint ? "neutral" : "warning",
      },
      {
        key: "widget",
        icon: "install",
        title: "Website widget bubble",
        copy: "Add a compact chat bubble only after the full-page Front Desk launch path is clear.",
        status: installDetected ? "Secondary installed" : hasInstall ? "Secondary" : "Secondary",
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


  function createInstallPanelHelpers(dependencies = {}) {
    const sanitizeText = typeof dependencies.trimText === "function"
      ? dependencies.trimText
      : (value) => String(value || "").trim();
    const sanitizeHtml = typeof dependencies.escapeHtml === "function"
      ? dependencies.escapeHtml
      : (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const getUiIconMarkup = typeof dependencies.getUiIconMarkup === "function" ? dependencies.getUiIconMarkup : () => "";
    const getBadgeClass = typeof dependencies.getBadgeClass === "function" ? dependencies.getBadgeClass : () => "status-badge";
    const translate = typeof dependencies.t === "function" ? dependencies.t : (key) => ({ "common.notInstalled": "Not installed", "install.verifyInstallation": "Verify installation", "install.title": "Install" }[key] || key);
    const formatSeenAt = typeof dependencies.formatSeenAt === "function" ? dependencies.formatSeenAt : (value) => sanitizeText(value);
    const getDefaultInstallStatus = typeof dependencies.getDefaultInstallStatus === "function" ? dependencies.getDefaultInstallStatus : () => ({});
    const getInstallProgress = typeof dependencies.getInstallProgress === "function" ? dependencies.getInstallProgress : () => ({});
    const getInstallMethodPanelKey = typeof dependencies.getInstallMethodPanelKey === "function" ? dependencies.getInstallMethodPanelKey : (value) => sanitizeText(value) || "page";
    const getDashboardUiStateValue = typeof dependencies.getDashboardUiStateValue === "function" ? dependencies.getDashboardUiStateValue : () => "";
    const normalizeInstallFullPageOption = typeof dependencies.normalizeInstallFullPageOption === "function" ? dependencies.normalizeInstallFullPageOption : (value) => sanitizeText(value) || "share";
    const buildScript = typeof dependencies.buildScript === "function" ? dependencies.buildScript : () => "";
    const buildWidgetUrl = typeof dependencies.buildWidgetUrl === "function" ? dependencies.buildWidgetUrl : () => "#";
    const buildFrontDeskPreviewUrl = typeof dependencies.buildFrontDeskPreviewUrl === "function" ? dependencies.buildFrontDeskPreviewUrl : () => "";
    const isPublicFullPageEnabled = typeof dependencies.isPublicFullPageEnabled === "function" ? dependencies.isPublicFullPageEnabled : () => false;
    const buildFullPageAssistantUrl = typeof dependencies.buildFullPageAssistantUrl === "function" ? dependencies.buildFullPageAssistantUrl : () => "";
    const buildSmartAssistantEmbed = typeof dependencies.buildSmartAssistantEmbed === "function" ? dependencies.buildSmartAssistantEmbed : () => "";
    const buildFullPageQrEndpoint = typeof dependencies.buildFullPageQrEndpoint === "function" ? dependencies.buildFullPageQrEndpoint : () => "";
    const buildSectionAssistantIframe = typeof dependencies.buildSectionAssistantIframe === "function" ? dependencies.buildSectionAssistantIframe : () => "";
    const buildFullPageAssistantIframe = typeof dependencies.buildFullPageAssistantIframe === "function" ? dependencies.buildFullPageAssistantIframe : () => "";
    const getInstallStatusCopy = typeof dependencies.getInstallStatusCopy === "function" ? dependencies.getInstallStatusCopy : () => "";
    const getInstallStatusTone = typeof dependencies.getInstallStatusTone === "function" ? dependencies.getInstallStatusTone : () => "Pending";
    const hasFullPageAssistantCustomization = typeof dependencies.hasFullPageAssistantCustomization === "function" ? dependencies.hasFullPageAssistantCustomization : () => false;
    const buildInstallMethodCards = typeof dependencies.buildInstallMethodCards === "function" ? dependencies.buildInstallMethodCards : () => [];
    const isInstallSeen = typeof dependencies.isInstallSeen === "function" ? dependencies.isInstallSeen : () => false;
    const isInstallDetected = typeof dependencies.isInstallDetected === "function" ? dependencies.isInstallDetected : () => false;
    const escapeHtml = sanitizeHtml;
    const trimText = sanitizeText;
    const t = translate;

    function buildInstallProgressItem({ title, done, detail }) {
      return `
        <li class="install-progress-item ${done ? "done" : ""}">
          <span class="install-progress-dot" aria-hidden="true">${done ? getUiIconMarkup("check") : ""}</span>
          <span class="install-progress-copy">
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(detail)}</small>
          </span>
        </li>
      `;
    }

    function buildInstallSetupProgress(agent, setup, installStatus, progress, messages = []) {
      const hasConversation = Array.isArray(messages)
        && messages.some((message) => trimText(message?.content) && ["user", "assistant"].includes(trimText(message?.role)));
      const fullPageEnabled = isPublicFullPageEnabled(agent);
      const hasDistributionChannel = fullPageEnabled || Boolean(trimText(agent.installId)) || isInstallDetected(installStatus);
      const items = [
        {
          title: "Front Desk created",
          done: Boolean(trimText(agent.id || agent.publicAgentKey)),
          detail: trimText(agent.assistantName || agent.name) || "Front Desk workspace",
        },
        {
          title: "Public Front Desk page enabled",
          done: fullPageEnabled,
          detail: fullPageEnabled ? "Your Front Desk page is live" : "Enable public access before sharing links or QR",
        },
        {
          title: "Front Desk customized",
          done: hasFullPageAssistantCustomization(agent) || setup.isReady,
          detail: hasFullPageAssistantCustomization(agent) ? "Custom full-page settings saved" : "Review identity, welcome, and page design",
        },
        {
          title: "Training and knowledge ready",
          done: setup.knowledgeReady === true,
          detail: setup.knowledgeReady
            ? "Website knowledge is ready"
            : setup.knowledgeLimited
              ? "Website knowledge is still growing"
              : "Website knowledge is missing",
        },
        {
          title: "First test conversation",
          done: hasConversation || progress.previewOpened === true,
          detail: hasConversation
            ? "A conversation exists"
            : progress.previewOpened
              ? "Front desk preview opened"
              : "No test conversation yet",
        },
        {
          title: "Launch path selected",
          done: hasDistributionChannel,
          detail: hasDistributionChannel
            ? "Hosted page, QR/direct link, WordPress/smart embed, or optional bubble is ready"
            : "Choose a primary launch path in Install",
        },
      ];

      return `
        <section class="install-progress-card" aria-label="Setup progress" role="status" aria-live="polite">
          <div class="install-progress-card-header">
            <p class="overview-label">Setup progress</p>
            <span>${items.filter((item) => item.done).length}/${items.length}</span>
          </div>
          <ol class="install-progress-list">
            ${items.map((item) => buildInstallProgressItem(item)).join("")}
          </ol>
        </section>
      `;
    }

    function buildInstallStageProgress(installStatus, hasInstall, fullPageUrl, qrEndpoint) {
      const verifyDone = isInstallSeen(installStatus) || installStatus.state === "installed_unseen";
      const stages = [
        {
          number: "1",
          title: "Choose method",
          state: "active",
          copy: "Start with hosted page, QR/direct link, or WordPress/smart embed.",
        },
        {
          number: "2",
          title: "Configure",
          state: hasInstall || fullPageUrl || qrEndpoint ? "done" : "pending",
          copy: "Copy the link, page embed, smart snippet, or optional bubble code.",
        },
        {
          number: "3",
          title: "Verify",
          state: verifyDone ? "done" : "pending",
          copy: "Confirm website embed or bubble installs after publishing.",
        },
        {
          number: "4",
          title: "Go live",
          state: isInstallSeen(installStatus) ? "done" : "pending",
          copy: "Share the hosted page, QR, or embedded page; keep the widget secondary.",
        },
      ];

      return `
        <ol class="install-stage-flow" aria-label="Install setup stages">
          ${stages.map((stage) => `
            <li class="install-stage-item ${escapeHtml(stage.state)}">
              <span class="install-stage-number">${escapeHtml(stage.number)}</span>
              <span>
                <strong>${escapeHtml(stage.title)}</strong>
                <small>${escapeHtml(stage.copy)}</small>
              </span>
            </li>
          `).join("")}
        </ol>
      `;
    }

    function buildInstallMethodPill(label, tone = "neutral") {
      return `<span class="install-method-pill ${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
    }

    function buildInstallDomainChips(allowedDomains = []) {
      if (!allowedDomains.length) {
        return `<p class="install-help">No allowed domains are saved yet.</p>`;
      }

      return `
        <div class="install-domain-chips" aria-label="Allowed domains">
          ${allowedDomains.map((domain) => `<span>${escapeHtml(domain)}</span>`).join("")}
        </div>
      `;
    }

    function buildLaunchPathComparison(fullPageEnabled, qrEndpoint, hasInstall, installStatus) {
      const paths = [
        {
          key: "hosted",
          title: "Hosted Front Desk page",
          label: "Primary",
          copy: "Fastest launch path. Share the protected hosted page from buttons, menus, emails, and owner follow-ups.",
          state: fullPageEnabled ? "Live" : "Enable in Settings",
          tone: fullPageEnabled ? "Ready" : "Pending",
          action: "page",
        },
        {
          key: "qr",
          title: "QR / direct link",
          label: "Primary",
          copy: "Same hosted page, packaged for print, reception desks, invoices, menus, and offline traffic.",
          state: qrEndpoint ? "QR available" : "Enable page first",
          tone: qrEndpoint ? "Ready" : "Pending",
          action: "qr",
        },
        {
          key: "embed",
          title: "WordPress / smart embed",
          label: "Primary",
          copy: "Use the plugin, dedicated page embed, or smart snippet when Front Desk belongs inside the website.",
          state: fullPageEnabled ? "Code ready" : "Enable page first",
          tone: fullPageEnabled ? "Ready" : "Pending",
          action: "page",
        },
        {
          key: "widget",
          title: "Website widget bubble",
          label: "Secondary",
          copy: "Optional compact launcher for normal website pages after the full-page launch path is prepared.",
          state: isInstallDetected(installStatus) ? "Seen live" : hasInstall ? "Code ready" : "Not generated",
          tone: isInstallDetected(installStatus) ? "Ready" : hasInstall ? "Limited" : "Pending",
          action: "widget",
        },
      ];

      return `
        <section class="install-launch-paths" aria-label="Launch path comparison">
          <div class="install-launch-paths-header">
            <div>
              <p class="overview-label">Launch path hierarchy</p>
              <h3>Pick the customer entry point</h3>
            </div>
            <span>Full-page first</span>
          </div>
          <div class="install-launch-path-grid">
            ${paths.map((path) => `
              <article class="install-launch-path-card" data-launch-path="${escapeHtml(path.key)}">
                <div class="install-launch-path-card-head">
                  <span>${escapeHtml(path.label)}</span>
                  <span class="${getBadgeClass(path.tone)}">${escapeHtml(path.state)}</span>
                </div>
                <h4>${escapeHtml(path.title)}</h4>
                <p>${escapeHtml(path.copy)}</p>
                <button class="ghost-button" type="button" data-install-method-jump="${escapeHtml(path.action)}" aria-label="${escapeHtml(`View setup for ${path.title}`)}">View setup</button>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }

    function buildInstallCopyBlock({ id, label, value, rows = 5, buttonAction, buttonLabel, disabled = false, className = "" }) {
      return `
        <div class="install-copy-field ${className}">
          <div class="install-copy-heading">
            <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
            <button class="ghost-button" type="button" data-action="${escapeHtml(buttonAction)}" aria-label="${escapeHtml(buttonLabel)}" ${disabled ? "disabled" : ""}>${escapeHtml(buttonLabel)}</button>
          </div>
          <textarea id="${escapeHtml(id)}" rows="${escapeHtml(rows)}" readonly>${escapeHtml(value)}</textarea>
        </div>
      `;
    }

    function buildPlatformGuideCard({ platform, recommended, paste, useHosted, limitation, verify }) {
      return `
        <article class="install-platform-card" data-install-platform="${escapeHtml(platform.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">
          <div class="install-platform-card-header">
            <h4>${escapeHtml(platform)}</h4>
            <span>${escapeHtml(recommended)}</span>
          </div>
          <dl class="install-platform-steps">
            <div>
              <dt>Paste or link</dt>
              <dd>${escapeHtml(paste)}</dd>
            </div>
            <div>
              <dt>Hosted page vs embed</dt>
              <dd>${escapeHtml(useHosted)}</dd>
            </div>
            <div>
              <dt>Limitation</dt>
              <dd>${escapeHtml(limitation)}</dd>
            </div>
            <div>
              <dt>Verify</dt>
              <dd>${escapeHtml(verify)}</dd>
            </div>
          </dl>
        </article>
      `;
    }

    function buildPlatformGuideSection() {
      const platformGuides = [
        {
          platform: "Generic HTML / smart embed",
          recommended: "Start here",
          paste: "Paste the smart embed or dedicated page snippet into the page HTML, or add the Front Desk page link to a button or menu.",
          useHosted: "Use the hosted Front Desk page for the fastest launch. Use the smart embed when Front Desk should live inside an existing page.",
          limitation: "Use the raw iframe fallback only when the site blocks scripts.",
          verify: "Publish, open the page as a visitor, and ask one realistic customer question. If you also add the bubble snippet, run Verify installation.",
        },
        {
          platform: "WordPress / WooCommerce",
          recommended: "Recommended page",
          paste: "Add the hosted Front Desk page link to a menu or button, or use the Vonza plugin or dedicated page embed on a new WordPress page.",
          useHosted: "Use the hosted Front Desk page for checkout, order status, and account areas. Use the embed on normal content pages.",
          limitation: "WooCommerce product and order data are not connected by this install step.",
          verify: "Publish the page, open it while signed out, and ask a test question. If you add the optional bubble, run Verify installation.",
        },
        {
          platform: "Wix",
          recommended: "Link first",
          paste: "Add the hosted Front Desk page link to a site button or menu, or paste the smart embed into an Embed HTML or custom code area.",
          useHosted: "Use the hosted page when the Wix editor strips scripts. Use the embed only on pages where custom HTML is allowed.",
          limitation: "Some Wix areas can restrict custom code, so the iframe fallback may be needed.",
          verify: "Publish the site, open the public page, and complete one visitor-style test question.",
        },
        {
          platform: "Shopify",
          recommended: "Hosted page first",
          paste: "Add the Front Desk page link to navigation, a page, or a theme section. Use the smart embed only where the theme allows custom liquid or HTML.",
          useHosted: "Use the hosted Front Desk page for checkout, customer account, and policy areas where custom scripts may be restricted.",
          limitation: "Products, carts, and orders are not connected by this install step.",
          verify: "Publish the theme change, open the storefront as a visitor, and test the Front Desk link or embedded page.",
        },
        {
          platform: "Webflow",
          recommended: "Embed-ready",
          paste: "Add the Front Desk page link to a nav item or button, or paste the smart embed into a Webflow Embed element on a dedicated page.",
          useHosted: "Use the hosted page for quick launch and QR links. Use the embed when the Front Desk should appear within a Webflow page.",
          limitation: "Custom code publishing can depend on the Webflow site setup.",
          verify: "Publish to the live domain, open the page in a private window, and send one test question.",
        },
        {
          platform: "Squarespace",
          recommended: "Link first",
          paste: "Add the hosted Front Desk page link to navigation or a button, or paste the embed into a Code Block or Code Injection area.",
          useHosted: "Use the hosted page when Squarespace blocks scripts on the target page. Use the iframe fallback if scripts are not allowed.",
          limitation: "Some templates and editing areas can limit script embeds.",
          verify: "Publish, open the public page, and confirm the Front Desk loads before sharing the link.",
        },
      ];

      return `
        <section class="install-platform-guides" aria-label="Platform install guidance">
          <div class="install-platform-guides-header">
            <div>
              <p class="install-option-eyebrow">Platform quick guides</p>
              <h3 class="install-platform-guides-title">Install-only website guidance</h3>
              <p class="install-option-copy">Start with the hosted AI Front Desk page. Use embeds when you want Front Desk inside a website page, and keep the website bubble as a secondary launcher.</p>
            </div>
          </div>
          <div class="install-platform-grid">
            ${platformGuides.map((guide) => buildPlatformGuideCard(guide)).join("")}
          </div>
        </section>
      `;
    }

    function buildInstallSidePanel(agent, setup, messages = []) {
      const installStatus = getDefaultInstallStatus(agent);
      const fullPageEnabled = isPublicFullPageEnabled(agent);
      const qrEndpoint = buildFullPageQrEndpoint(agent);
      const allowedDomains = Array.isArray(installStatus.allowedDomains) ? installStatus.allowedDomains : [];
      const statusRows = [
        {
          label: "Installation status",
          value: installStatus.label || t("common.notInstalled"),
          tone: getInstallStatusTone(installStatus),
        },
        {
          label: "Domain status",
          value: allowedDomains.length ? allowedDomains.join(", ") : "No domains saved yet.",
          tone: allowedDomains.length ? "Ready" : "Pending",
        },
        {
          label: "Detected domain",
          value: installStatus.host || "No live domain detected yet.",
          tone: installStatus.host ? "Ready" : "Pending",
        },
        {
          label: "Front Desk page",
          value: fullPageEnabled ? "Your Front Desk page is live" : "Your Front Desk page is disabled.",
          tone: fullPageEnabled ? "Ready" : "Pending",
        },
        {
          label: "QR code",
          value: qrEndpoint ? "Downloadable" : "Enable the public page first.",
          tone: qrEndpoint ? "Ready" : "Pending",
        },
      ];
      if (installStatus.lastSeenAt || installStatus.lastSeenUrl) {
        const lastSeenValue = installStatus.lastSeenAt && installStatus.lastSeenUrl
          ? `${formatSeenAt(installStatus.lastSeenAt)} on ${installStatus.lastSeenUrl}`
          : installStatus.lastSeenAt
            ? formatSeenAt(installStatus.lastSeenAt)
            : installStatus.lastSeenUrl;
        statusRows.splice(3, 0, {
          label: "Last seen",
          value: lastSeenValue,
          tone: "Ready",
        });
      }

      return `
        <aside class="install-side-panel" aria-label="Install status and resources">
          <section class="install-side-card install-side-card-status" role="status" aria-live="polite" aria-label="Launch readiness status">
            <div class="install-side-card-header">
              <p class="overview-label">Launch readiness</p>
              <span class="${getBadgeClass(getInstallStatusTone(installStatus))}">${escapeHtml(isInstallSeen(installStatus) ? "Live" : installStatus.state === "installed_unseen" ? "Verified" : "Not live yet")}</span>
            </div>
            <p class="install-side-summary">${escapeHtml(getInstallStatusCopy(installStatus))}</p>
            <div class="install-status-row-list">
              ${statusRows.map((row) => `
                <div class="install-status-row">
                  <span>${escapeHtml(row.label)}</span>
                  <strong>${escapeHtml(row.value)}</strong>
                </div>
              `).join("")}
            </div>
          </section>
          ${buildInstallSetupProgress(agent, setup, installStatus, getInstallProgress(agent.id), messages)}
          <section class="install-side-card install-preview-card">
            <p class="overview-label">Preview</p>
            <div class="install-preview-mini">
              <span class="install-preview-avatar">${escapeHtml((agent.assistantName || agent.name || "V").trim().charAt(0).toUpperCase() || "V")}</span>
              <div>
                <strong>${escapeHtml(agent.assistantName || agent.name || "Your assistant")}</strong>
                <p>${escapeHtml(agent.welcomeMessage || "Preview the customer-facing Front Desk page before sharing it.")}</p>
              </div>
            </div>
            <a class="test-link ${buildFrontDeskPreviewUrl(agent) ? "" : "disabled"}" data-action="open-preview" href="${buildFrontDeskPreviewUrl(agent) ? escapeHtml(buildFrontDeskPreviewUrl(agent)) : "#"}" target="_blank" rel="noreferrer">Open Front Desk page</a>
          </section>
          <section class="install-side-card install-resource-card">
            <p class="overview-label">Launch shortcuts</p>
            <button class="ghost-button" type="button" data-install-method-jump="page">View Front Desk page setup</button>
            <button class="ghost-button" type="button" data-action="copy-full-page-url" ${fullPageEnabled ? "" : "disabled"}>Copy Front Desk page link</button>
            <button class="ghost-button" type="button" data-install-method-jump="widget">View optional website bubble</button>
            <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Customize Front Desk page</button>
          </section>
        </aside>
      `;
    }

    function buildInstallSection(agent, options = {}) {
      const {
        upcoming = false,
      } = options;
      const activeInstallMethod = getInstallMethodPanelKey(getDashboardUiStateValue("installMethod"));
      const activeFullPageInstallOption = normalizeInstallFullPageOption(getDashboardUiStateValue("installFullPageOption"));
      const hasInstall = Boolean(trimText(agent.installId));
      const script = hasInstall ? buildScript(agent) : "";
      const fullPageUrl = trimText(agent.id || agent.publicAgentKey) ? buildFullPageAssistantUrl(agent) : "";
      const fullPageEnabled = isPublicFullPageEnabled(agent);
      const publicFullPageUrl = fullPageEnabled ? fullPageUrl : "";
      const sectionSmartEmbed = fullPageEnabled && trimText(agent.id) ? buildSmartAssistantEmbed(agent, "section") : "";
      const sectionIframe = publicFullPageUrl ? buildSectionAssistantIframe(agent) : "";
      const dedicatedPageSmartEmbed = fullPageEnabled && trimText(agent.id) ? buildSmartAssistantEmbed(agent, "page-takeover") : "";
      const truePageTakeoverSmartEmbed = fullPageEnabled && trimText(agent.id)
        ? buildSmartAssistantEmbed(agent, "page-takeover", {
          backgroundScope: "page",
          pageReset: true,
          hidePageFooter: true,
        })
        : "";
      const fullPageIframe = publicFullPageUrl ? buildFullPageAssistantIframe(agent) : "";
      const installStatus = getDefaultInstallStatus(agent);
      const allowedDomains = Array.isArray(installStatus.allowedDomains) ? installStatus.allowedDomains : [];
      const verifyDetails = installStatus.verificationDetails || {};
      const statusCopy = getInstallStatusCopy(installStatus);
      const recentSeenMarkup = installStatus.lastSeenUrl
        ? `<p class="install-help">Last seen page: ${escapeHtml(installStatus.lastSeenUrl)}</p>`
        : "";
      const verificationMarkup = installStatus.lastVerifiedAt
        ? `<p class="install-help">Last verified ${escapeHtml(formatSeenAt(installStatus.lastVerifiedAt))}${installStatus.verificationTargetUrl ? ` against ${escapeHtml(installStatus.verificationTargetUrl)}` : ""}.</p>`
        : "";
      const mismatchMarkup = verifyDetails?.foundInstallIds?.length
        ? `<p class="install-help">Found install id${verifyDetails.foundInstallIds.length === 1 ? "" : "s"}: ${escapeHtml(verifyDetails.foundInstallIds.join(", "))}</p>`
        : "";
      const qrEndpoint = buildFullPageQrEndpoint(agent);
      const methodCards = buildInstallMethodCards({
        qrEndpoint,
        hasInstall,
        installDetected: isInstallDetected(installStatus),
      });
      const publicPageStatusBadge = fullPageEnabled
        ? `<span class="${getBadgeClass("Ready")}">Your Front Desk page is live</span>`
        : `<span class="${getBadgeClass("Pending")}">Your Front Desk page is disabled</span>`;
      const wordpressCallout = `
        <div class="operator-inline-alert install-wordpress-callout">
          <strong>WordPress Front Desk page</strong>
          <p>For WordPress, use the Vonza plugin to create a dedicated Front Desk page. This avoids manual snippets and theme content boxes.</p>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-full-page-option="dedicated">Use dedicated page embed</button>
          </div>
        </div>
      `;

      return `
        ${upcoming ? `<p class="install-upcoming">This becomes the final step once your front desk feels ready to go live.</p>` : ""}
        ${buildInstallStageProgress(installStatus, hasInstall, publicFullPageUrl, qrEndpoint)}
        <div class="install-method-grid" role="tablist" aria-label="Installation methods">
          ${methodCards.map((item) => {
            const isActive = activeInstallMethod === item.key;
            return `
            <button
              class="install-method-card ${isActive ? "active" : ""}"
              type="button"
              role="tab"
              aria-selected="${isActive ? "true" : "false"}"
              aria-controls="install-panel-${escapeHtml(item.key)}"
              data-install-method-tab="${escapeHtml(item.key)}"
            >
              <span class="install-method-icon" aria-hidden="true">${getUiIconMarkup(item.icon)}</span>
              <span class="install-method-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.copy)}</small>
                ${item.status ? buildInstallMethodPill(item.status, item.tone) : ""}
              </span>
            </button>
          `;
          }).join("")}
        </div>
        <div class="install-options-grid">
          <section class="install-option-card ${activeInstallMethod === "widget" ? "active" : ""}" id="install-panel-widget" role="tabpanel" data-install-method-panel="widget" ${activeInstallMethod === "widget" ? "" : "hidden"}>
            <div class="install-option-header">
              <div>
                <p class="install-option-eyebrow">Optional add-on</p>
                <h3 class="install-option-title">Website widget bubble</h3>
                <p class="install-option-copy">Paste this code into your website header only if you also want a compact chat launcher on normal website pages. Your Front Desk page stays the primary product.</p>
              </div>
              <span class="${getBadgeClass(isInstallDetected(installStatus) ? "Ready" : hasInstall ? "Limited" : "Pending")}">${escapeHtml(isInstallDetected(installStatus) ? "Optional installed" : hasInstall ? "Optional" : "Optional")}</span>
            </div>
            <div class="install-cta-row">
              <button class="primary-button" type="button" data-action="copy-install" aria-label="Copy website bubble code" ${hasInstall ? "" : "disabled"}>Copy website bubble code</button>
              <button class="ghost-button" type="button" data-action="verify-install" aria-label="${escapeHtml(t("install.verifyInstallation"))}" ${hasInstall ? "" : "disabled"}>${escapeHtml(t("install.verifyInstallation"))}</button>
              <a class="test-link ${hasInstall ? "" : "disabled"}" data-action="open-preview" href="${hasInstall ? buildWidgetUrl(agent.publicAgentKey) : "#"}" target="_blank" rel="noreferrer">Test website bubble</a>
            </div>
            ${buildInstallCopyBlock({
              id: "install-script-output",
              label: "Website widget bubble code",
              value: script,
              rows: 5,
              buttonAction: "copy-install",
              buttonLabel: "Copy bubble code",
              disabled: !hasInstall,
              className: "install-code-block",
            })}
            <p class="install-help">Paste this once into your site header only when you want the optional bubble.</p>
            <div class="install-detail-grid">
              <div class="install-detail-card" role="status" aria-live="polite" aria-label="Detected install status">
                <span>Allowed domains</span>
                ${buildInstallDomainChips(allowedDomains)}
              </div>
              <div class="install-detail-card">
                <span>Detected install status</span>
                <strong>${escapeHtml(installStatus.label || t("common.notInstalled"))}</strong>
                <p>${escapeHtml(statusCopy)}</p>
                ${recentSeenMarkup}
                ${verificationMarkup}
                ${mismatchMarkup}
              </div>
            </div>
          </section>
          <section class="install-option-card ${activeInstallMethod === "page" ? "active" : ""}" id="install-panel-page" role="tabpanel" data-install-method-panel="page" ${activeInstallMethod === "page" ? "" : "hidden"}>
            <div class="install-option-header">
              <div>
                <p class="install-option-eyebrow">Recommended method</p>
                <h3 class="install-option-title">Front Desk page</h3>
                <p class="install-option-copy">Choose how customers should open the AI Front Desk page. Vonza generates the hosted link, WordPress guidance, smart embed, or fallback iframe.</p>
              </div>
              ${publicPageStatusBadge}
            </div>
            ${wordpressCallout}
            ${!fullPageEnabled ? `
              <div class="operator-inline-alert" role="status" aria-live="polite">
                Your Front Desk page is disabled. Enable public Front Desk page access in Settings before sharing links, embeds, or QR codes.
                <div class="inline-actions">
                  <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Enable public Front Desk page</button>
                </div>
              </div>
            ` : ""}
            <div class="full-page-install-selector" role="tablist" aria-label="Front Desk page install options">
              <button class="full-page-install-choice ${activeFullPageInstallOption === "share" ? "active" : ""}" type="button" role="tab" aria-selected="${activeFullPageInstallOption === "share" ? "true" : "false"}" aria-controls="full-page-option-share" data-full-page-option="share">
                <strong>Front Desk page link</strong>
                <span>Use this for QR codes, buttons, menus, emails, and direct links.</span>
              </button>
              <button class="full-page-install-choice ${activeFullPageInstallOption === "section" ? "active" : ""}" type="button" role="tab" aria-selected="${activeFullPageInstallOption === "section" ? "true" : "false"}" aria-controls="full-page-option-section" data-full-page-option="section">
                <strong>Smart embed</strong>
                <span>Place the Front Desk inside part of an existing page.</span>
              </button>
              <button class="full-page-install-choice ${activeFullPageInstallOption === "dedicated" ? "active" : ""}" type="button" role="tab" aria-selected="${activeFullPageInstallOption === "dedicated" ? "true" : "false"}" aria-controls="full-page-option-dedicated" data-full-page-option="dedicated">
                <strong>WordPress / dedicated page</strong>
                <span>Use this when Front Desk is the main content of a website page.</span>
              </button>
              <button class="full-page-install-choice ${activeFullPageInstallOption === "takeover" ? "active" : ""}" type="button" role="tab" aria-selected="${activeFullPageInstallOption === "takeover" ? "true" : "false"}" aria-controls="full-page-option-takeover" data-full-page-option="takeover">
                <strong>True page takeover</strong>
                <span>Advanced. Use this on a blank dedicated page when you want Front Desk to own the full page area.</span>
              </button>
              <button class="full-page-install-choice ${activeFullPageInstallOption === "iframe" ? "active" : ""}" type="button" role="tab" aria-selected="${activeFullPageInstallOption === "iframe" ? "true" : "false"}" aria-controls="full-page-option-iframe" data-full-page-option="iframe">
                <strong>Raw iframe fallback</strong>
                <span>Use this for builders that block scripts.</span>
              </button>
            </div>
            <div class="full-page-install-output ${activeFullPageInstallOption === "share" ? "active" : ""}" id="full-page-option-share" role="tabpanel" data-full-page-option-panel="share" ${activeFullPageInstallOption === "share" ? "" : "hidden"}>
              <div class="install-cta-row">
                <button class="primary-button" type="button" data-action="copy-full-page-url" ${publicFullPageUrl ? "" : "disabled"}>Copy Front Desk page link</button>
                <a class="test-link ${publicFullPageUrl ? "" : "disabled"}" href="${publicFullPageUrl ? escapeHtml(publicFullPageUrl) : "#"}" target="_blank" rel="noreferrer">Open Front Desk page</a>
                <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Customize Front Desk page</button>
              </div>
              ${buildInstallCopyBlock({
                id: "full-page-assistant-url",
                label: "Front Desk page link",
                value: publicFullPageUrl,
                rows: 2,
                buttonAction: "copy-full-page-url",
                buttonLabel: "Copy Front Desk page link",
                disabled: !publicFullPageUrl,
                className: "full-page-url-output",
              })}
            </div>
            <div class="full-page-install-output ${activeFullPageInstallOption === "section" ? "active" : ""}" id="full-page-option-section" role="tabpanel" data-full-page-option-panel="section" ${activeFullPageInstallOption === "section" ? "" : "hidden"}>
              <p class="install-help">Place the Front Desk inside part of an existing page.</p>
              <p class="install-help"><strong>Smart snippet:</strong> Recommended. Automatically adjusts to most website layouts.</p>
              ${buildInstallCopyBlock({
                id: "section-assistant-smart-embed",
                label: "Recommended smart snippet",
                value: sectionSmartEmbed,
                rows: 7,
                buttonAction: "copy-section-assistant-smart-embed",
                buttonLabel: "Copy smart snippet",
                disabled: !sectionSmartEmbed,
                className: "full-page-iframe-output",
              })}
              <p class="install-help"><strong>Iframe:</strong> Advanced fallback. Use this if your website builder does not allow scripts.</p>
              ${buildInstallCopyBlock({
                id: "section-assistant-iframe",
                label: "Advanced iframe snippet",
                value: sectionIframe,
                rows: 7,
                buttonAction: "copy-section-assistant-iframe",
                buttonLabel: "Copy iframe snippet",
                disabled: !sectionIframe,
                className: "full-page-iframe-output",
              })}
            </div>
            <div class="full-page-install-output ${activeFullPageInstallOption === "dedicated" ? "active" : ""}" id="full-page-option-dedicated" role="tabpanel" data-full-page-option-panel="dedicated" ${activeFullPageInstallOption === "dedicated" ? "" : "hidden"}>
              <p class="install-help"><strong>WordPress / dedicated page embed:</strong> Use this when Front Desk is the main content of a page on your website.</p>
              <p class="install-help">For WordPress, use the Vonza plugin to create a dedicated Front Desk page. This avoids manual snippets and theme content boxes.</p>
              <p class="install-help">Dedicated page embed makes the Front Desk the page body below your site header. The selected background fills the takeover area edge-to-edge.</p>
              ${buildInstallCopyBlock({
                id: "full-page-assistant-smart-embed",
                label: "Dedicated page embed snippet",
                value: dedicatedPageSmartEmbed,
                rows: 9,
                buttonAction: "copy-full-page-assistant-smart-embed",
                buttonLabel: "Copy dedicated page embed",
                disabled: !dedicatedPageSmartEmbed,
                className: "full-page-iframe-output",
              })}
            </div>
            <div class="full-page-install-output ${activeFullPageInstallOption === "takeover" ? "active" : ""}" id="full-page-option-takeover" role="tabpanel" data-full-page-option-panel="takeover" ${activeFullPageInstallOption === "takeover" ? "" : "hidden"}>
              <p class="install-help"><strong>True page takeover:</strong> Advanced. Use this on a blank dedicated page when you want Front Desk to own the full page area.</p>
              <p class="install-help install-warning">Use this on a blank assistant page. It may hide the page footer and remove extra page spacing.</p>
              ${buildInstallCopyBlock({
                id: "full-page-assistant-true-page-takeover",
                label: "True page takeover snippet",
                value: truePageTakeoverSmartEmbed,
                rows: 11,
                buttonAction: "copy-full-page-assistant-true-page-takeover",
                buttonLabel: "Copy true page takeover",
                disabled: !truePageTakeoverSmartEmbed,
                className: "full-page-iframe-output",
              })}
            </div>
            <div class="full-page-install-output ${activeFullPageInstallOption === "iframe" ? "active" : ""}" id="full-page-option-iframe" role="tabpanel" data-full-page-option-panel="iframe" ${activeFullPageInstallOption === "iframe" ? "" : "hidden"}>
              <p class="install-help"><strong>Raw iframe:</strong> Fallback for builders that block scripts.</p>
              <p class="install-help">Raw iframe backgrounds stay inside the iframe. Use the smart dedicated page embed when you want the background to fill the page area.</p>
              ${buildInstallCopyBlock({
                id: "full-page-assistant-iframe",
                label: "Raw iframe fallback",
                value: fullPageIframe,
                rows: 9,
                buttonAction: "copy-full-page-iframe",
                buttonLabel: "Copy raw iframe",
                disabled: !fullPageIframe,
                className: "full-page-iframe-output",
              })}
            </div>
            ${buildPlatformGuideSection()}
          </section>
          <section class="install-option-card install-option-card-qr ${activeInstallMethod === "qr" ? "active" : ""}" id="install-panel-qr" role="tabpanel" data-install-method-panel="qr" ${activeInstallMethod === "qr" ? "" : "hidden"}>
            <div class="install-option-header">
              <div>
                <p class="install-option-eyebrow">Selected method</p>
                <h3 class="install-option-title">QR / direct link</h3>
                <p class="install-option-copy">Use a QR code or direct link that opens the hosted full-page Front Desk page.</p>
              </div>
              <span class="${getBadgeClass(qrEndpoint ? "Ready" : "Pending")}">${escapeHtml(qrEndpoint ? "Print/download" : "Enable page first")}</span>
            </div>
            <div class="install-qr-section">
              <div class="install-qr-preview" data-full-page-qr-preview role="status" aria-live="polite" aria-label="Front Desk page QR code">
                <p class="install-qr-status">Loading QR code...</p>
              </div>
              <div class="install-qr-copy">
                <div class="install-target-url">
                  <span>Front Desk page link</span>
                  <strong>${escapeHtml(publicFullPageUrl || "Enable the public Front Desk page before sharing.")}</strong>
                </div>
                <p class="install-help">${escapeHtml(qrEndpoint ? "Use this QR code on menus, flyers, signs, invoices, and reception desks." : "Enable the public Front Desk page before downloading or sharing a QR code.")}</p>
                <p class="install-help">The QR code opens the same customer-facing Front Desk page link.</p>
                <div class="install-cta-row">
                  <button class="ghost-button" type="button" data-action="copy-full-page-url" ${publicFullPageUrl ? "" : "disabled"}>Copy Front Desk page link</button>
                  ${!qrEndpoint ? '<button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Enable public Front Desk page</button>' : ""}
                  <button class="ghost-button" type="button" data-action="download-full-page-qr" disabled>Download QR code</button>
                </div>
              </div>
            </div>
          </section>
        </div>
        ${buildLaunchPathComparison(fullPageEnabled, qrEndpoint, hasInstall, installStatus)}
      `;
    }

    return Object.freeze({
      buildInstallProgressItem,
      buildInstallSetupProgress,
      buildInstallStageProgress,
      buildInstallMethodPill,
      buildInstallDomainChips,
      buildInstallCopyBlock,
      buildPlatformGuideCard,
      buildPlatformGuideSection,
      buildInstallSidePanel,
      buildInstallSection,
    });
  }

  global.VonzaDashboardInstall = Object.freeze({
    createInstallHelpers,
    createInstallPanelHelpers,
    getPublicFullPageConfig,
    getPublicPageKey,
    isPublicFullPageEnabled,
    normalizeFullPageBackgroundScope,
    normalizeFullPageAssistantHeight,
    normalizeWebsiteHeaderHeight,
    buildInstallMethodCards,
  });
})(window);
