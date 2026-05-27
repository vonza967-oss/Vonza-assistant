(function registerVonzaDashboardFrontDesk(global) {
  const FRONT_DESK_TABS = Object.freeze([
    { key: "practice", label: "Practice" },
    { key: "improvements", label: "Improvements" },
    { key: "knowledge", label: "Knowledge" },
    { key: "library", label: "Answer library" },
    { key: "launch", label: "Launch" },
    { key: "customization", label: "Customization" },
  ]);
  const FRONT_DESK_TAB_KEYS = Object.freeze(FRONT_DESK_TABS.map((tab) => tab.key));
  const FRONT_DESK_TAB_LABELS = Object.freeze(
    FRONT_DESK_TABS.reduce((labels, tab) => {
      labels[tab.key] = tab.label;
      return labels;
    }, {})
  );

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

  function normalizeFrontDeskTab(value = "") {
    const dashboardState = global.VonzaDashboardState || {};
    if (typeof dashboardState.normalizeFrontDeskSection === "function") {
      return dashboardState.normalizeFrontDeskSection(value);
    }

    const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
    const aliases = {
      context: "knowledge",
      overview: "practice",
      preview: "practice",
      test: "practice",
      approved: "library",
      answers: "library",
      "answer-library": "library",
      library: "library",
      queue: "improvements",
      training: "improvements",
      "training-queue": "improvements",
      customize: "customization",
      settings: "customization",
    };
    const candidate = aliases[normalized] || normalized;

    return FRONT_DESK_TAB_KEYS.includes(candidate) ? candidate : "practice";
  }

  function getFrontDeskTabLabel(tab = "") {
    return FRONT_DESK_TAB_LABELS[normalizeFrontDeskTab(tab)] || "Practice";
  }

  function getFrontDeskTabs() {
    return FRONT_DESK_TABS.map((tab) => ({ ...tab }));
  }

  function formatTrainingItemReason(value = "") {
    const normalized = trimText(value).toLowerCase().replaceAll("-", "_");
    const labels = {
      incorrect: "Incorrect",
      missing_details: "Missing details",
      too_vague: "Too vague",
      did_not_answer: "Did not answer",
      other: "Other",
    };

    return labels[normalized] || "";
  }

  function formatTrainingItemSource(item = {}) {
    const source = trimText(item.sourceType || item.source_type).toLowerCase();
    if (source === "test") return "Practice";
    if (source === "conversation") return "Conversation";
    if (source === "website") return "Website";
    if (source === "manual") return "Owner";
    return "Owner";
  }

  function formatImprovementSource(item = {}) {
    const source = trimText(item.source || item.sourceType || item.sourceLabel).toLowerCase();
    if (source === "visitor_feedback") return "visitor feedback";
    if (source === "owner_feedback") return "owner feedback";
    if (source === "test") return "practice";
    return trimText(item.sourceLabel) || "customer conversation";
  }

  function formatAssistantSource(item = {}) {
    const mode = trimText(item.displayMode).toLowerCase();
    const route = trimText(item.sourceRoute).toLowerCase();
    const routeParams = route.includes("?") ? new URLSearchParams(route.split("?").slice(1).join("?")) : null;
    const isEmbedded = route.includes("embedded")
      || route.includes("embed")
      || route.includes("iframe")
      || routeParams?.get("embedded") === "1";
    const isWidget = route.includes("public_widget") || route.includes("website_widget");
    const isFullPage = route.includes("public_page_assistant")
      || route.includes("full_page")
      || route.includes("/a/")
      || route.includes("/assistant/");

    if (isEmbedded) return "Embedded assistant";
    if (mode === "widget" || isWidget) return "Website widget";
    if ((mode === "page" && isFullPage) || isFullPage) return "Front Desk page";
    if (mode === "page") return "Front Desk page";
    if (route.includes("hosted")) return "Front Desk page";
    return "Unknown source";
  }

  function buildFrontDeskStatusSummary({
    setup = {},
    installStatus = {},
    publicFrontDeskLive = false,
  } = {}) {
    const installState = trimText(installStatus.state);
    const liveVerificationLabel = installStatus.seen
      ? "Live traffic confirmed"
      : installStatus.detected
        ? "Installed, waiting for first live visit"
        : installState === "domain_mismatch" || installState === "verify_failed"
          ? "Verification needs attention"
          : "Not live yet";

    return {
      launchHeadline: setup.isReady ? "Your Front Desk page is close to launch." : "A few essentials still need attention before you publish.",
      launchCopy: setup.isReady
        ? "Confirm the experience, enable the public Front Desk page, then choose WordPress, smart embed, QR/direct link, or the optional website bubble."
        : "This space keeps the launch path clear by showing what still needs attention before Install and distribution.",
      publicPageLabel: publicFrontDeskLive ? "Your Front Desk page is live" : "Your Front Desk page is disabled",
      liveVerificationLabel,
    };
  }

  function buildKnowledgeStatusSummary({
    agent = {},
    setup = {},
    businessReadiness = {},
    missingSetupFields = [],
    profileContentSummary = "",
  } = {}) {
    const businessContextStatus = Number(businessReadiness.missingCount || 0) > 0
      ? `${businessReadiness.missingCount} area${businessReadiness.missingCount === 1 ? "" : "s"} could use a quick review before the Front Desk feels fully grounded.`
      : "Business context is in a strong place for customer-facing conversations.";
    const importStatus = setup.importStatus || null;
    const importActive = ["queued", "running", "crawling", "indexing"].includes(trimText(importStatus?.state).toLowerCase());
    const importLimited = trimText(importStatus?.state).toLowerCase() === "limited";
    const importFailed = ["failed", "stalled"].includes(trimText(importStatus?.state).toLowerCase());

    return {
      website: agent.websiteUrl || "No website configured",
      pagesLearned: setup.knowledgePageCount ? `${setup.knowledgePageCount} page${setup.knowledgePageCount === 1 ? "" : "s"} imported` : "No pages imported yet",
      missingSetup: missingSetupFields.length ? missingSetupFields.join(", ") : "No required setup gaps are standing out.",
      customerImpact: importActive
        ? importStatus.message || "Website import is running for Front Desk knowledge."
        : importLimited
          ? "Website content is available, but semantic indexing needs a retry before answers are fully optimized."
          : importFailed
            ? importStatus.message || "Website import needs a retry before Front Desk knowledge is current."
            : setup.knowledgeReady
              ? "The Front Desk is ready to answer with solid business context."
              : setup.knowledgeLimited
                ? "The Front Desk can already help, and another import should make answers stronger."
                : "Import your site to give the Front Desk more specific business detail.",
      businessContextStatus,
      businessContextSummary: businessReadiness.summary || "Business context readiness will appear here once the owner starts reviewing the profile.",
      profileContentSummary,
    };
  }

  function renderPracticeStatus(hasWebsite = false) {
    return hasWebsite ? "Website knowledge connected" : "Website knowledge needs review";
  }

  function renderFrontDeskEmptyState({ title = "", copy = "" } = {}, dependencies = {}) {
    const buildOperatorEmptyState = typeof dependencies.buildOperatorEmptyState === "function"
      ? dependencies.buildOperatorEmptyState
      : ({ title: emptyTitle, copy: emptyCopy } = {}) => `<div class="placeholder-card"><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyCopy)}</p></div>`;

    return buildOperatorEmptyState({ title, copy });
  }

  function renderFrontDeskTabNav(activeKey = "practice", _dependencies = {}, tabSummaries = {}) {
    const activeTab = normalizeFrontDeskTab(activeKey);
    const tabMeta = {
      practice: "Test replies",
      improvements: `${Number(tabSummaries.reviewCount || 0)} to review`,
      knowledge: tabSummaries.knowledgeReady ? "Grounded" : "Needs review",
      library: `${Number(tabSummaries.publishedCount || 0)} published`,
      launch: tabSummaries.publicFrontDeskLive ? "Live page" : "Prepare launch",
      customization: "Configure",
    };

    return `
      <div class="local-section-nav frontdesk-tab-nav" aria-label="${escapeHtml("Front Desk sections")}">
        ${getFrontDeskTabs().map((tab) => `
          <button
            class="local-section-button frontdesk-tab-button ${tab.key === activeTab ? "active" : ""}"
            type="button"
            data-frontdesk-target="${escapeHtml(tab.key)}"
            aria-pressed="${tab.key === activeTab ? "true" : "false"}"
          >
            <span>${escapeHtml(tab.label)}</span>
            <small>${escapeHtml(tabMeta[tab.key] || "")}</small>
          </button>
        `).join("")}
      </div>
    `;
  }

  function createFrontDeskHelpers(dependencies = {}) {
    const sanitizeText = typeof dependencies.trimText === "function" ? dependencies.trimText : trimText;
    const sanitizeHtml = typeof dependencies.escapeHtml === "function" ? dependencies.escapeHtml : escapeHtml;
    const createEmptyFrontDeskTraining = typeof dependencies.createEmptyFrontDeskTraining === "function"
      ? dependencies.createEmptyFrontDeskTraining
      : () => ({ items: [] });
    const createEmptyActionQueue = typeof dependencies.createEmptyActionQueue === "function"
      ? dependencies.createEmptyActionQueue
      : () => ({ items: [] });
    const formatSeenAt = typeof dependencies.formatSeenAt === "function"
      ? dependencies.formatSeenAt
      : (value) => sanitizeText(value);
    const getBadgeClass = typeof dependencies.getBadgeClass === "function"
      ? dependencies.getBadgeClass
      : () => "status-badge";
    const buildOperatorEmptyState = typeof dependencies.buildOperatorEmptyState === "function"
      ? dependencies.buildOperatorEmptyState
      : (state) => renderFrontDeskEmptyState(state);
    const isMeaningfulWebsite = typeof dependencies.isMeaningfulWebsite === "function"
      ? dependencies.isMeaningfulWebsite
      : (value) => Boolean(sanitizeText(value));
    const getDefaultInstallStatus = typeof dependencies.getDefaultInstallStatus === "function"
      ? dependencies.getDefaultInstallStatus
      : () => ({});
    const getActiveFrontDeskSection = typeof dependencies.getActiveFrontDeskSection === "function"
      ? dependencies.getActiveFrontDeskSection
      : () => "practice";
    const buildFullPageAssistantUrl = typeof dependencies.buildFullPageAssistantUrl === "function"
      ? dependencies.buildFullPageAssistantUrl
      : () => "";
    const buildFullPageQrEndpoint = typeof dependencies.buildFullPageQrEndpoint === "function"
      ? dependencies.buildFullPageQrEndpoint
      : () => "";
    const isPublicFullPageEnabled = typeof dependencies.isPublicFullPageEnabled === "function"
      ? dependencies.isPublicFullPageEnabled
      : () => false;
    const isInstallSeen = typeof dependencies.isInstallSeen === "function"
      ? dependencies.isInstallSeen
      : () => false;
    const isInstallDetected = typeof dependencies.isInstallDetected === "function"
      ? dependencies.isInstallDetected
      : () => false;
    const getFrontDeskMissingSetupFields = typeof dependencies.getFrontDeskMissingSetupFields === "function"
      ? dependencies.getFrontDeskMissingSetupFields
      : () => [];
    const getBusinessProfileContentSummary = typeof dependencies.getBusinessProfileContentSummary === "function"
      ? dependencies.getBusinessProfileContentSummary
      : () => "";
    const buildFrontDeskCustomizationPanel = typeof dependencies.buildFrontDeskCustomizationPanel === "function"
      ? dependencies.buildFrontDeskCustomizationPanel
      : () => renderFrontDeskEmptyState({
        title: "Customization unavailable",
        copy: "The Front Desk customization panel could not be loaded right now.",
      });
    const getEmptyOperatorWorkspace = typeof dependencies.createEmptyOperatorWorkspace === "function"
      ? dependencies.createEmptyOperatorWorkspace
      : () => ({ businessProfile: { readiness: {} } });
    const formatKnowledgeState = typeof dependencies.formatKnowledgeState === "function"
      ? dependencies.formatKnowledgeState
      : (value) => sanitizeText(value);
    const buildPageHeader = typeof dependencies.buildPageHeader === "function"
      ? dependencies.buildPageHeader
      : () => "";
    const buildPageToolbar = typeof dependencies.buildPageToolbar === "function"
      ? dependencies.buildPageToolbar
      : ({ filtersMarkup = "" } = {}) => filtersMarkup;
    const buildLocalSectionNav = typeof dependencies.buildLocalSectionNav === "function"
      ? dependencies.buildLocalSectionNav
      : () => "";
    const localizeDashboardHtml = typeof dependencies.localizeDashboardHtml === "function"
      ? dependencies.localizeDashboardHtml
      : (html) => html;

    function getApprovedAnswerItems(frontDeskTraining = createEmptyFrontDeskTraining()) {
      return (frontDeskTraining.items || [])
        .filter((item) => sanitizeText(item.type) === "approved_answer" && sanitizeText(item.status) !== "archived");
    }

    function getPublishedAnswerItems(frontDeskTraining = createEmptyFrontDeskTraining()) {
      return getApprovedAnswerItems(frontDeskTraining)
        .filter((item) => sanitizeText(item.status) === "active");
    }

    function getDraftImprovementItems(frontDeskTraining = createEmptyFrontDeskTraining()) {
      return getApprovedAnswerItems(frontDeskTraining)
        .filter((item) => sanitizeText(item.status) === "draft");
    }

    function getRecentlyPublishedImprovementItems(frontDeskTraining = createEmptyFrontDeskTraining()) {
      return getPublishedAnswerItems(frontDeskTraining)
        .filter((item) => ["test", "conversation"].includes(sanitizeText(item.sourceType).toLowerCase()))
        .slice(0, 6);
    }

    function getFeedbackReasonLabel(value = "") {
      return formatTrainingItemReason(value);
    }

    function getImprovementSourceLabel(item = {}) {
      return formatImprovementSource(item);
    }

    function getTrainingSourceLabel(item = {}) {
      return formatTrainingItemSource(item);
    }

    function getAssistantSourceLabel(item = {}) {
      return formatAssistantSource(item);
    }

    function getFrontDeskReviewItems(actionQueue = createEmptyActionQueue()) {
      return (actionQueue.items || [])
        .filter((item) => item.knowledgeFix || sanitizeText(item.type) === "weak_answer" || /not helpful|weak|unanswered|review/i.test([item.whyFlagged, item.snippet, item.label].filter(Boolean).join(" ")))
        .filter((item) => !["resolved", "ignored"].includes(sanitizeText(item.status).toLowerCase()));
    }

    function buildCompactImprovementRows(items = [], emptyCopy = "") {
      if (!items.length) {
        return `<p class="frontdesk-compact-empty">${sanitizeHtml(emptyCopy)}</p>`;
      }

      return items.map((item) => `
    <button class="frontdesk-compact-row" type="button" data-frontdesk-open-improvement data-question="${sanitizeHtml(item.question || item.triggerText || item.title || "")}" data-answer="${sanitizeHtml(item.reply || item.answerText || "")}" data-feedback-id="${sanitizeHtml(item.feedbackId || "")}" data-item-id="${sanitizeHtml(item.id || "")}">
      <span>${sanitizeHtml(item.question || item.triggerText || item.title || "Question needs review")}</span>
      <small>${sanitizeHtml(sanitizeText(item.reply || item.answerText || item.snippet || item.whyFlagged).slice(0, 96) || "Open in Practice")}</small>
    </button>
  `).join("");
    }

    function buildPracticeImprovementsPanel(frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue()) {
      const draftItems = getDraftImprovementItems(frontDeskTraining).slice(0, 4);
      const feedbackItems = getFrontDeskReviewItems(actionQueue)
        .filter((item) => sanitizeText(item.feedbackId))
        .slice(0, 4);
      const publishedItems = getRecentlyPublishedImprovementItems(frontDeskTraining).slice(0, 3);

      return `
    <aside class="frontdesk-practice-side-panel">
      <section class="frontdesk-compact-section">
        <div class="frontdesk-compact-heading">
          <span>Draft improvements</span>
          <strong>${sanitizeHtml(String(draftItems.length))}</strong>
        </div>
        ${buildCompactImprovementRows(draftItems, "Drafts you save in Practice will appear here.")}
      </section>
      <section class="frontdesk-compact-section">
        <div class="frontdesk-compact-heading">
          <span>Feedback needing review</span>
          <strong>${sanitizeHtml(String(feedbackItems.length))}</strong>
        </div>
        ${buildCompactImprovementRows(feedbackItems, "Not-helpful visitor feedback will appear here.")}
      </section>
      <section class="frontdesk-compact-section">
        <div class="frontdesk-compact-heading">
          <span>Recently published improvements</span>
          <strong>${sanitizeHtml(String(publishedItems.length))}</strong>
        </div>
        ${buildCompactImprovementRows(publishedItems, "Published improvements will appear here.")}
      </section>
    </aside>
  `;
    }

    function getFrontDeskNextAction({
      reviewCount = 0,
      draftCount = 0,
      knowledgeReady = false,
      knowledgeLimited = false,
      hasPreview = false,
      publicFrontDeskLive = false,
    } = {}) {
      if (reviewCount > 0) {
        return {
          label: "Next action",
          title: "Fix weak answers first",
          copy: `${reviewCount} answer${reviewCount === 1 ? "" : "s"} need owner review before similar customers see the same gap.`,
          button: "Open improvements",
          frontDeskTarget: "improvements",
          tone: "attention",
        };
      }

      if (draftCount > 0) {
        return {
          label: "Next action",
          title: "Publish reviewed guidance",
          copy: `${draftCount} drafted improvement${draftCount === 1 ? "" : "s"} can be tested in Practice and published into the answer library.`,
          button: "Review drafts",
          frontDeskTarget: "improvements",
          tone: "work",
        };
      }

      if (!knowledgeReady && !knowledgeLimited) {
        return {
          label: "Next action",
          title: "Ground Front Desk in real business facts",
          copy: "Import website detail and review the business profile before relying on customer-facing answers.",
          button: "Open knowledge",
          frontDeskTarget: "knowledge",
          tone: "work",
        };
      }

      if (!hasPreview) {
        return {
          label: "Next action",
          title: "Finish the Front Desk setup",
          copy: "Create the public assistant identity so Practice and Launch can use the same customer-facing experience.",
          button: "Open settings",
          frontDeskTarget: "customization",
          tone: "work",
        };
      }

      if (!publicFrontDeskLive) {
        return {
          label: "Next action",
          title: "Prepare the hosted Front Desk page",
          copy: "Practice once, enable the public page, then share the direct link or QR before treating the optional widget as secondary.",
          button: "Open launch",
          frontDeskTarget: "launch",
          tone: "ready",
        };
      }

      return {
        label: "Next action",
        title: "Keep testing the live Front Desk",
        copy: "Use Practice after new customer questions, then publish only the guidance that should apply to future visitors.",
        button: "Practice a reply",
        frontDeskTarget: "practice",
        tone: "ready",
      };
    }

    function buildFrontDeskCommandCenter({
      setup = {},
      activeFrontDeskSection = "practice",
      reviewCount = 0,
      draftCount = 0,
      publishedCount = 0,
      hasPreview = false,
      publicFrontDeskLive = false,
      installStatus = {},
    } = {}) {
      const nextAction = getFrontDeskNextAction({
        reviewCount,
        draftCount,
        knowledgeReady: Boolean(setup.knowledgeReady),
        knowledgeLimited: Boolean(setup.knowledgeLimited),
        hasPreview,
        publicFrontDeskLive,
      });
      const actionAttrs = nextAction.frontDeskTarget
        ? `data-frontdesk-open="${sanitizeHtml(nextAction.frontDeskTarget)}"`
        : `data-shell-target="${sanitizeHtml(nextAction.shellTarget || "settings")}"${nextAction.settingsTarget ? ` data-settings-target="${sanitizeHtml(nextAction.settingsTarget)}"` : ""}`;
      const tiles = [
        {
          key: "active-section",
          label: "Active section",
          value: getFrontDeskTabLabel(activeFrontDeskSection),
          copy: "Focused operator view",
        },
        {
          label: "Answer quality",
          value: reviewCount ? `${reviewCount} review` : draftCount ? `${draftCount} draft` : "Clear",
          copy: reviewCount ? "Weak answers queued" : draftCount ? "Drafts waiting" : "No queued fixes",
        },
        {
          label: "Knowledge",
          value: setup.knowledgeReady ? "Ready" : setup.knowledgeLimited ? "Limited" : "Needs import",
          copy: setup.knowledgePageCount ? `${setup.knowledgePageCount} page${setup.knowledgePageCount === 1 ? "" : "s"} learned` : "No learned pages yet",
        },
        {
          label: "Launch",
          value: publicFrontDeskLive ? "Page live" : hasPreview ? "Page prepared" : "Setup needed",
          copy: installStatus.label || "Hosted page first, widget optional",
        },
      ];

      return `
        <section class="frontdesk-command-center frontdesk-command-center-${sanitizeHtml(nextAction.tone)}">
          <div class="frontdesk-command-copy">
            <p class="frontdesk-detail-kicker">${sanitizeHtml(nextAction.label)}</p>
            <h2>${sanitizeHtml(nextAction.title)}</h2>
            <p>${sanitizeHtml(nextAction.copy)}</p>
          </div>
          <div class="frontdesk-command-actions">
            <button class="primary-button" type="button" ${actionAttrs}>${sanitizeHtml(nextAction.button)}</button>
            <span>${sanitizeHtml(`${publishedCount} published answer${publishedCount === 1 ? "" : "s"}`)}</span>
          </div>
          <div class="frontdesk-command-grid">
            ${tiles.map((tile) => `
              <article class="frontdesk-command-tile"${tile.key ? ` data-frontdesk-command-tile="${sanitizeHtml(tile.key)}"` : ""}>
                <span>${sanitizeHtml(tile.label)}</span>
                <strong${tile.key === "active-section" ? " data-frontdesk-active-section-value" : ""}>${sanitizeHtml(tile.value)}</strong>
                <p>${sanitizeHtml(tile.copy)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }

    function buildFrontDeskPracticeSection(agent, setup, frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue(), activeFrontDeskSection = "practice") {
      const assistantName = sanitizeText(agent.assistantName || agent.name) || "Front Desk";
      const welcomeMessage = sanitizeText(agent.welcomeMessage) || "Hi, I can help answer questions and point you to the right next step.";
      const primaryColor = sanitizeText(agent.primaryColor) || "#14b8a6";
      const secondaryColor = sanitizeText(agent.secondaryColor) || "#0f766e";
      const hasWebsite = setup.hasWebsite || isMeaningfulWebsite(agent.websiteUrl);

      return `
    <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel frontdesk-practice-panel" data-frontdesk-section="practice" ${activeFrontDeskSection === "practice" ? "" : "hidden"}>
      <div class="frontdesk-section-intro">
        <div>
          <p class="studio-kicker">Practice</p>
          <h2 class="frontdesk-section-title">Practice the answer customers will see.</h2>
          <p class="frontdesk-section-copy">Run a visitor-style question, mark the answer good, or teach the exact guidance Front Desk should use next time.</p>
        </div>
        <div class="frontdesk-section-actions">
          <button class="ghost-button" type="button" data-frontdesk-practice-reset>Reset conversation</button>
        </div>
      </div>
      <div class="frontdesk-practice-layout">
        <div class="frontdesk-practice-canvas" style="--frontdesk-practice-primary:${sanitizeHtml(primaryColor)}; --frontdesk-practice-secondary:${sanitizeHtml(secondaryColor)};">
          <div class="frontdesk-practice-topbar">
            <div>
              <span class="frontdesk-practice-label">Practice mode — visitors will not see this conversation.</span>
              <h3>${sanitizeHtml(assistantName)}</h3>
            </div>
            <span class="frontdesk-practice-status" role="status" aria-live="polite">${sanitizeHtml(renderPracticeStatus(hasWebsite))}</span>
          </div>
          <div class="frontdesk-practice-thread" data-frontdesk-practice-thread aria-live="polite" aria-label="Front Desk practice conversation">
            <article class="frontdesk-practice-message assistant">
              <span>${sanitizeHtml(assistantName)}</span>
              <p>${sanitizeHtml(welcomeMessage)}</p>
            </article>
          </div>
          <form class="frontdesk-practice-composer" data-frontdesk-practice-form>
            <label class="sr-only" for="frontdesk-practice-message">Practice question</label>
            <input id="frontdesk-practice-message" name="message" type="text" autocomplete="off" placeholder="Ask a question as if you were a visitor.">
            <button class="primary-button" type="submit">Send</button>
          </form>
          <div class="frontdesk-practice-next">
            <strong>Owner review path</strong>
            <span>Looks good keeps the answer as-is. Teach this answer opens the improvement form. Save as improvement creates guidance you can publish.</span>
          </div>
          <div class="frontdesk-teaching-shell" data-frontdesk-teaching-form-shell hidden>
            <form class="frontdesk-teaching-form" data-frontdesk-teaching-form>
              <input name="item_id" type="hidden">
              <input name="feedback_id" type="hidden">
              <input name="source_type" type="hidden" value="test">
              <div class="frontdesk-teaching-head">
                <div>
                  <p class="studio-kicker">Teach this answer</p>
                  <h3 class="studio-group-title">What should Front Desk say instead?</h3>
                </div>
                <button class="ghost-button" type="button" data-frontdesk-teaching-close>Close</button>
              </div>
              <div class="form-grid two-col">
                <div class="field">
                  <label>Question</label>
                  <input name="trigger_text" type="text" placeholder="What did the visitor ask?">
                </div>
                <div class="field">
                  <label>Use when visitors ask about...</label>
                  <input name="tags" type="text" placeholder="pricing, booking, refunds">
                </div>
              </div>
              <div class="field">
                <label>Current answer</label>
                <textarea name="current_answer" readonly></textarea>
              </div>
              <div class="field">
                <label>Better answer / guidance</label>
                <textarea name="answer_text" placeholder="Write the answer or guidance Front Desk should use."></textarea>
              </div>
              <div class="inline-actions">
                <button class="ghost-button" type="submit" data-frontdesk-save-draft>Save draft</button>
                <button class="primary-button" type="submit" data-frontdesk-publish-improvement>Publish improvement</button>
                <button class="ghost-button" type="button" data-frontdesk-try-again hidden>Try again</button>
              </div>
            </form>
          </div>
        </div>
        ${buildPracticeImprovementsPanel(frontDeskTraining, actionQueue)}
      </div>
    </section>
  `;
    }

    function renderTrainingQueueItem(item = {}, options = {}) {
      const variant = options.variant || "review";

      if (variant === "draft") {
        return `
            <article class="frontdesk-improvement-card" data-frontdesk-training-item="${sanitizeHtml(item.id || "")}">
              <div class="workspace-record-detail-header">
                <div>
                  <span class="${getBadgeClass("Limited")}">Draft improvement</span>
                  <h3 class="analytics-item-title">${sanitizeHtml(item.title || item.triggerText || "Draft improvement")}</h3>
                  <p class="analytics-item-copy">${sanitizeHtml(sanitizeText(item.answerText).slice(0, 220))}</p>
                  <p class="analytics-subtle">${sanitizeHtml([
                    item.triggerText ? `Use when visitors ask about ${item.triggerText}` : "",
                    Array.isArray(item.tags) && item.tags.length ? `Tags: ${item.tags.join(", ")}` : "",
                    item.updatedAt ? `Updated ${formatSeenAt(item.updatedAt)}` : "",
                  ].filter(Boolean).join(" · "))}</p>
                </div>
              </div>
              <div class="inline-actions">
                <button class="ghost-button" type="button" data-frontdesk-open-draft data-item-id="${sanitizeHtml(item.id || "")}" data-question="${sanitizeHtml(item.triggerText || item.title || "")}" data-answer="${sanitizeHtml(item.answerText || "")}" data-tags="${sanitizeHtml(Array.isArray(item.tags) ? item.tags.join(", ") : "")}">Open in practice</button>
                <button class="ghost-button" type="button" data-frontdesk-edit-draft data-item-id="${sanitizeHtml(item.id || "")}" data-question="${sanitizeHtml(item.triggerText || item.title || "")}" data-answer="${sanitizeHtml(item.answerText || "")}" data-tags="${sanitizeHtml(Array.isArray(item.tags) ? item.tags.join(", ") : "")}">Improve answer</button>
                <button class="primary-button" type="button" data-frontdesk-publish-item data-item-id="${sanitizeHtml(item.id || "")}">Publish</button>
                <button class="ghost-button" type="button" data-frontdesk-archive-approved-answer data-item-id="${sanitizeHtml(item.id || "")}">Archive</button>
              </div>
            </article>
          `;
      }

      if (variant === "published") {
        return `
            <article class="frontdesk-improvement-card" data-frontdesk-training-item="${sanitizeHtml(item.id || "")}">
              <div>
                <span class="${getBadgeClass("Ready")}">Published</span>
                <h3 class="analytics-item-title">${sanitizeHtml(item.title || item.triggerText || "Published improvement")}</h3>
                <p class="analytics-item-copy">${sanitizeHtml(sanitizeText(item.answerText).slice(0, 180))}</p>
              </div>
              <div class="inline-actions">
                <button class="ghost-button" type="button" data-frontdesk-test-answer="${sanitizeHtml(item.triggerText || item.title || "")}">Open in practice</button>
              </div>
            </article>
          `;
      }

      const reasonLabel = getFeedbackReasonLabel(item.feedbackReason);
      const note = sanitizeText(item.feedbackNote);

      return `
              <article class="frontdesk-improvement-card">
                <div class="workspace-record-detail-header">
                  <div>
                    <span class="${getBadgeClass("Needs attention")}">Needs review</span>
                    <h3 class="analytics-item-title">${sanitizeHtml(item.question || item.label || "Question needs review")}</h3>
                    <p class="analytics-item-copy">${sanitizeHtml(item.reply || item.snippet || item.whyFlagged || "Review the conversation and improve the answer.")}</p>
                    <p class="analytics-subtle">${sanitizeHtml([
                      `Source: ${getImprovementSourceLabel(item)}`,
                      reasonLabel ? `Reason: ${reasonLabel}` : "",
                      `Assistant source: ${getAssistantSourceLabel(item)}`,
                      item.lastSeenAt ? `Created ${formatSeenAt(item.lastSeenAt)}` : "",
                    ].filter(Boolean).join(" · "))}</p>
                    ${note ? `<p class="analytics-subtle">${sanitizeHtml(`Note: ${note}`)}</p>` : ""}
                  </div>
                </div>
                <div class="inline-actions">
                  <button class="ghost-button" type="button" data-frontdesk-open-improvement data-question="${sanitizeHtml(item.question || item.label || "")}" data-answer="${sanitizeHtml(item.reply || "")}" data-feedback-id="${sanitizeHtml(item.feedbackId || "")}">Open in practice</button>
                  <button class="ghost-button" type="button" data-frontdesk-improve-feedback data-question="${sanitizeHtml(item.question || item.label || "")}" data-answer="${sanitizeHtml(item.reply || "")}" data-feedback-id="${sanitizeHtml(item.feedbackId || "")}">Improve answer</button>
                  ${item.feedbackId ? `<button class="ghost-button" type="button" data-frontdesk-feedback-status="ignored" data-feedback-id="${sanitizeHtml(item.feedbackId)}">Ignore</button>` : item.key ? `<button class="ghost-button" type="button" data-today-queue-status-action data-next-status="dismissed" data-action-key="${sanitizeHtml(item.key)}">Ignore</button>` : ""}
                </div>
              </article>
            `;
    }

    function buildImprovementsSection(frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue(), activeFrontDeskSection = "practice") {
      const reviewItems = getFrontDeskReviewItems(actionQueue).slice(0, 12);
      const draftItems = getDraftImprovementItems(frontDeskTraining).slice(0, 12);
      const publishedItems = getRecentlyPublishedImprovementItems(frontDeskTraining).slice(0, 8);
      const hasItems = reviewItems.length || draftItems.length || publishedItems.length;
      const queueGroups = [
        {
          label: "Fix weak answers",
          count: reviewItems.length,
          copy: "Start here when visitors mark an answer not helpful or a conversation exposes missing detail.",
          markup: reviewItems.map((item) => renderTrainingQueueItem(item)).join(""),
          empty: "No weak answers are waiting for owner review.",
        },
        {
          label: "Draft improvements",
          count: draftItems.length,
          copy: "Drafts are not customer-facing until they are tested and published.",
          markup: draftItems.map((item) => renderTrainingQueueItem(item, { variant: "draft" })).join(""),
          empty: "No draft answer guidance is waiting.",
        },
        {
          label: "Recently published",
          count: publishedItems.length,
          copy: "Recently approved guidance that can be re-tested in Practice.",
          markup: publishedItems.map((item) => renderTrainingQueueItem(item, { variant: "published" })).join(""),
          empty: "Published improvements will appear here after review.",
        },
      ];

      return `
    <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel frontdesk-improvements-panel" data-frontdesk-section="improvements" ${activeFrontDeskSection === "improvements" ? "" : "hidden"}>
      <div class="frontdesk-section-intro">
        <div>
          <p class="studio-kicker">Improvements</p>
          <h2 class="frontdesk-section-title">Review answers that need owner attention.</h2>
          <p class="frontdesk-section-copy">Feedback and drafts stay here until an owner improves, publishes, ignores, or archives them.</p>
        </div>
      </div>
      ${hasItems ? `
        <div class="frontdesk-improvement-board">
          ${queueGroups.map((group) => `
            <section class="frontdesk-improvement-lane">
              <div class="frontdesk-lane-heading">
                <div>
                  <p>${sanitizeHtml(group.label)}</p>
                  <span>${sanitizeHtml(group.copy)}</span>
                </div>
                <strong>${sanitizeHtml(String(group.count))}</strong>
              </div>
              <div class="frontdesk-improvement-list">
                ${group.markup || `<p class="frontdesk-compact-empty">${sanitizeHtml(group.empty)}</p>`}
              </div>
            </section>
          `).join("")}
        </div>
      ` : buildOperatorEmptyState({
        title: "No answer fixes are waiting.",
        copy: "When a visitor marks an answer not helpful or Practice exposes a weak reply, the next owner action will appear here with the question, source, and review path.",
      })}
    </section>
  `;
    }

    function renderApprovedAnswerCard(item = {}) {
      return `
            <article class="frontdesk-library-card" data-frontdesk-training-item="${sanitizeHtml(item.id || "")}">
              <div class="workspace-record-detail-header">
                <div>
                  <p class="analytics-item-title">${sanitizeHtml(item.title || item.triggerText || "Published answer")}</p>
                  <p class="analytics-item-copy">${sanitizeHtml(sanitizeText(item.answerText).slice(0, 200))}</p>
                  <p class="analytics-subtle">${sanitizeHtml([
                    item.triggerText ? `Use when visitors ask about ${item.triggerText}` : "",
                    Array.isArray(item.tags) && item.tags.length ? `Tags: ${item.tags.join(", ")}` : "",
                    `Source: ${getTrainingSourceLabel(item)}`,
                    item.updatedAt ? `Updated ${formatSeenAt(item.updatedAt)}` : "",
                  ].filter(Boolean).join(" · "))}</p>
                </div>
                <span class="${getBadgeClass("Ready")}">Published</span>
              </div>
              <div class="inline-actions">
                <button class="ghost-button" type="button" data-frontdesk-edit-library-answer data-item-id="${sanitizeHtml(item.id || "")}" data-question="${sanitizeHtml(item.triggerText || item.title || "")}" data-answer="${sanitizeHtml(item.answerText || "")}" data-tags="${sanitizeHtml(Array.isArray(item.tags) ? item.tags.join(", ") : "")}">Edit</button>
                <button class="ghost-button" type="button" data-frontdesk-archive-approved-answer data-item-id="${sanitizeHtml(item.id || "")}">Archive</button>
                <button class="ghost-button" type="button" data-frontdesk-test-answer="${sanitizeHtml(item.triggerText || item.title || "")}">Test in Practice</button>
              </div>
            </article>
          `;
    }

    function buildAnswerLibrarySection(frontDeskTraining = createEmptyFrontDeskTraining(), activeFrontDeskSection = "practice") {
      const publishedAnswers = getPublishedAnswerItems(frontDeskTraining);

      return `
    <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel frontdesk-library-panel" data-frontdesk-section="library" ${activeFrontDeskSection === "library" ? "" : "hidden"}>
      <div class="frontdesk-section-intro">
        <div>
          <p class="studio-kicker">Answer library</p>
          <h2 class="frontdesk-section-title">Published answers Front Desk can use when visitors ask similar questions.</h2>
          <p class="frontdesk-section-copy">This is the advanced area for active guidance. Practice is still the fastest place to teach new answers.</p>
        </div>
      </div>
      ${publishedAnswers.length ? `
        <div class="frontdesk-library-grid">
          ${publishedAnswers.map((item) => renderApprovedAnswerCard(item)).join("")}
        </div>
      ` : buildOperatorEmptyState({
        title: "No published answers yet.",
        copy: "Use Practice to create guidance from a real question, then publish only answers that should apply to future visitors.",
      })}
      <form class="workspace-card-soft frontdesk-approved-answer-form" data-frontdesk-approved-answer-form>
        <h3 class="studio-group-title">Add or edit a published answer</h3>
        <input name="item_id" type="hidden">
        <div class="form-grid">
          <div class="field">
            <label>Question or situation</label>
            <input name="trigger_text" type="text" placeholder="What do visitors ask?">
          </div>
          <div class="field">
            <label>Published answer</label>
            <textarea name="answer_text" placeholder="Write the answer Front Desk should use."></textarea>
          </div>
          <div class="field">
            <label>Use when visitors ask about...</label>
            <input name="tags" type="text" placeholder="pricing, refunds, booking">
          </div>
        </div>
        <input name="feedback_id" type="hidden">
        <div class="inline-actions">
          <button class="primary-button" type="submit">Save published answer</button>
        </div>
      </form>
    </section>
  `;
    }

    function buildKnowledgeSection({
      agent,
      setup,
      activeFrontDeskSection,
      missingSetupFields,
      businessReadiness,
      profileContentSummary,
    } = {}) {
      const summary = buildKnowledgeStatusSummary({
        agent,
        setup,
        businessReadiness,
        missingSetupFields,
        profileContentSummary,
      });
      const importStatus = setup.importStatus || null;
      const importState = trimText(importStatus?.state).toLowerCase();
      const importActive = ["queued", "running", "crawling", "indexing"].includes(importState);
      const importRetryable = importStatus?.retryable === true || ["limited", "failed", "stalled"].includes(importState);
      const readinessTitle = importStatus
        ? importStatus.label || "Website import"
        : setup.knowledgeReady
          ? "Ready for customer questions"
          : setup.knowledgeLimited
            ? "Usable, but needs another pass"
            : "Import and review needed";

      return `
        <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel frontdesk-context-panel" data-frontdesk-section="knowledge" ${activeFrontDeskSection === "knowledge" ? "" : "hidden"}>
          <div class="frontdesk-section-intro">
            <div>
              <p class="studio-kicker">Knowledge</p>
              <h2 class="frontdesk-section-title">Ground answers in the real website and business profile.</h2>
              <p class="frontdesk-section-copy">Only saved website knowledge, setup status, and reviewed business context appear here.</p>
            </div>
            <div class="frontdesk-section-actions">
              <button class="primary-button" type="button" data-shell-target="settings" data-settings-target="business">Review business context</button>
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-knowledge-readiness">
            <article>
              <span>Readiness</span>
              <strong>${sanitizeHtml(readinessTitle)}</strong>
              <p>${sanitizeHtml(summary.customerImpact)}</p>
            </article>
            ${importStatus ? `
              <article class="frontdesk-import-status frontdesk-import-status-${sanitizeHtml(importState || "unknown")}" role="status" aria-live="polite" aria-label="Website import status">
                <span>Import status</span>
                <strong>${sanitizeHtml(importActive ? `${importStatus.label || "Running"} now` : importStatus.label || "Website import")}</strong>
                <p>${sanitizeHtml(importStatus.message || "Website import status will appear here.")}</p>
                ${importRetryable ? `<button class="ghost-button" type="button" data-action="import-knowledge" data-import-force="true" aria-label="Retry website knowledge import">Retry website import</button>` : ""}
              </article>
            ` : ""}
            <article>
              <span>Owner action</span>
              <strong>${sanitizeHtml(importRetryable ? "Retry import" : missingSetupFields.length ? "Fill setup gaps" : "Review business profile")}</strong>
              <p>${sanitizeHtml(importRetryable ? "Retry starts a fresh async import for the full-page Front Desk knowledge base." : missingSetupFields.length ? summary.missingSetup : "Keep services, pricing, hours, location, and policies current.")}</p>
            </article>
          </div>
          <div class="frontdesk-detail-stack">
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Website detail</p>
              <h3 class="frontdesk-detail-title">${sanitizeHtml(formatKnowledgeState(setup.knowledgeState))}</h3>
              <p class="frontdesk-detail-copy">${sanitizeHtml(setup.knowledgeDescription)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Website</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.website)}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Pages learned</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.pagesLearned)}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Missing setup</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.missingSetup)}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Customer impact</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.customerImpact)}</strong>
                </div>
              </div>
            </section>
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Business knowledge</p>
              <h3 class="frontdesk-detail-title">Services, pricing, policies, hours, and location</h3>
              <p class="frontdesk-detail-copy">${sanitizeHtml(summary.profileContentSummary)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Business profile</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.businessContextStatus)}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Edit deeper facts</span>
                  <strong class="frontdesk-detail-row-value">Open Settings → Business Profile</strong>
                </div>
              </div>
            </section>
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Business context</p>
              <h3 class="frontdesk-detail-title">Business grounding</h3>
              <p class="frontdesk-detail-copy">${sanitizeHtml(summary.businessContextSummary)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Review progress</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.businessContextStatus)}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Known content</span>
                  <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.profileContentSummary)}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>
      `;
    }

    function buildLaunchSection({
      agent: _agent,
      setup,
      activeFrontDeskSection,
      installStatus,
      hasPreview,
      fullPageUrl,
      qrEndpoint,
      publicFrontDeskLive,
      liveVerificationLabel,
    } = {}) {
      const summary = buildFrontDeskStatusSummary({
        setup,
        installStatus: {
          ...installStatus,
          seen: isInstallSeen(installStatus),
          detected: isInstallDetected(installStatus),
        },
        publicFrontDeskLive,
      });

      return `
        <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-polished-panel" data-frontdesk-section="launch" ${activeFrontDeskSection === "launch" ? "" : "hidden"}>
          <div class="frontdesk-section-intro">
            <div>
              <p class="studio-kicker">Launch</p>
              <h2 class="frontdesk-section-title">${sanitizeHtml(summary.launchHeadline)}</h2>
              <p class="frontdesk-section-copy">${sanitizeHtml(summary.launchCopy)}</p>
            </div>
            <div class="frontdesk-section-actions">
              <button class="primary-button" type="button" data-shell-target="install">Open install</button>
              ${hasPreview
                ? `<button class="ghost-button" type="button" data-frontdesk-open="practice">Practice first</button>`
                : `<button class="ghost-button" type="button" data-frontdesk-open="customization">Finish Front Desk setup</button>`}
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-detail-list frontdesk-launch-status-list">
            <div class="frontdesk-detail-row">
              <span class="frontdesk-detail-row-label">Public Front Desk page</span>
              <strong class="frontdesk-detail-row-value">${sanitizeHtml(summary.publicPageLabel)}</strong>
            </div>
            <div class="frontdesk-detail-row">
              <span class="frontdesk-detail-row-label">Front Desk page link</span>
              <strong class="frontdesk-detail-row-value">${sanitizeHtml(fullPageUrl || "Enable the public Front Desk page to generate a shareable link.")}</strong>
            </div>
            <div class="frontdesk-detail-row">
              <span class="frontdesk-detail-row-label">QR code</span>
              <strong class="frontdesk-detail-row-value">${sanitizeHtml(qrEndpoint ? "Available in Install" : "Available after the public Front Desk page is enabled.")}</strong>
            </div>
            <div class="frontdesk-detail-row">
              <span class="frontdesk-detail-row-label">Optional website bubble</span>
              <strong class="frontdesk-detail-row-value">${sanitizeHtml(installStatus.label || liveVerificationLabel)}</strong>
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-launch-channel-grid">
            <article>
              <span>Primary</span>
              <strong>Hosted Front Desk page</strong>
              <p>${sanitizeHtml(fullPageUrl || "Enable the public Front Desk page to create the customer-facing link.")}</p>
            </article>
            <article>
              <span>Direct handoff</span>
              <strong>QR / direct link</strong>
              <p>${sanitizeHtml(qrEndpoint ? "Use Install to share the QR code anywhere customers already are." : "QR is available after the public page is enabled.")}</p>
            </article>
            <article>
              <span>Website install</span>
              <strong>WordPress / smart embed</strong>
              <p>Use Install for page takeover, smart embed, and live-domain verification.</p>
            </article>
            <article>
              <span>Secondary</span>
              <strong>Optional website widget</strong>
              <p>${sanitizeHtml(installStatus.label || liveVerificationLabel)}</p>
            </article>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-step-list">
            <article class="frontdesk-step">
              <div class="frontdesk-step-number">1</div>
              <div class="frontdesk-step-body">
                <div class="frontdesk-step-head">
                  <div>
                    <p class="frontdesk-step-label">Step 1</p>
                    <h3 class="frontdesk-step-title">Run a real practice conversation</h3>
                  </div>
                  <span class="${getBadgeClass(hasPreview ? "Ready" : "Limited")}">${sanitizeHtml(hasPreview ? "Ready" : "Needs setup")}</span>
                </div>
                <p class="frontdesk-step-copy">${sanitizeHtml(hasPreview ? "Use Practice to confirm how the Front Desk answers, guides the next step, and captures lead intent before you publish it." : "Finish the Front Desk setup first so Vonza can generate a live assistant page for practice.")}</p>
              </div>
            </article>
            <article class="frontdesk-step">
              <div class="frontdesk-step-number">2</div>
              <div class="frontdesk-step-body">
                <div class="frontdesk-step-head">
                  <div>
                    <p class="frontdesk-step-label">Step 2</p>
                    <h3 class="frontdesk-step-title">Move into the install flow</h3>
                  </div>
                  <span class="${getBadgeClass(setup.isReady ? "Ready" : "Limited")}">${sanitizeHtml(setup.isReady ? "Ready" : "Worth a quick pass")}</span>
                </div>
                <p class="frontdesk-step-copy">${sanitizeHtml(setup.isReady ? "The core setup is strong enough to hand off into Install, where the snippet, verification, and live-domain details already belong." : "Tighten the front-desk behavior and grounding first, then use Install for the final publishing path.")}</p>
              </div>
            </article>
            <article class="frontdesk-step">
              <div class="frontdesk-step-number">3</div>
              <div class="frontdesk-step-body">
                <div class="frontdesk-step-head">
                  <div>
                    <p class="frontdesk-step-label">Step 3</p>
                    <h3 class="frontdesk-step-title">${sanitizeHtml(installStatus.label || "Confirm the live site")}</h3>
                  </div>
                  <span class="${getBadgeClass(isInstallSeen(installStatus) ? "Ready" : isInstallDetected(installStatus) ? "Limited" : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed" ? "Needs attention" : "Pending")}">${sanitizeHtml(liveVerificationLabel)}</span>
                </div>
                <p class="frontdesk-step-copy">${sanitizeHtml(isInstallSeen(installStatus)
                  ? "Vonza is already seeing live traffic from the site. Keep Install handy for quick verification checks."
                  : isInstallDetected(installStatus)
                    ? "The optional website bubble snippet is in place, and the next step is simply confirming the first live visit."
                    : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
                      ? "Verification needs attention before the launch can be treated as confidently live."
                      : "Use Install to choose WordPress, smart embed, QR/direct link, or the optional website bubble before launch is complete.")}</p>
              </div>
            </article>
          </div>
          <div class="frontdesk-support-note">
            <p class="frontdesk-support-title">Why Install still lives separately</p>
            <p class="frontdesk-support-copy">Front Desk owns practice, training, answer quality, and launch readiness. Install only manages distribution channels and verification.</p>
          </div>
        </section>
      `;
    }

    function buildFrontDeskInspectorPanel({
      activeFrontDeskSection = "practice",
      installStatus = {},
      missingSetupFields = [],
      businessReadiness = {},
      reviewCount = 0,
      draftCount = 0,
      publishedCount = 0,
      publicFrontDeskLive = false,
      liveVerificationLabel = "",
    } = {}) {
      const activeLabel = getFrontDeskTabLabel(activeFrontDeskSection);
      const missingCount = missingSetupFields.length;
      const readinessCopy = missingCount
        ? `${missingCount} setup area${missingCount === 1 ? "" : "s"} still need review.`
        : "Core Front Desk setup looks ready for customer-facing work.";
      const businessContextCopy = Number(businessReadiness.missingCount || 0) > 0
        ? `${businessReadiness.missingCount} business context area${businessReadiness.missingCount === 1 ? "" : "s"} could be stronger.`
        : "Business context is in a strong place.";

      return `
        <aside class="glass-inspector-panel frontdesk-inspector-panel" aria-label="${sanitizeHtml("Front Desk inspector")}">
          <div class="glass-inspector-head">
            <p class="overview-label">${sanitizeHtml("Inspector")}</p>
            <h2>${sanitizeHtml(activeLabel)}</h2>
            <p>${sanitizeHtml(readinessCopy)}</p>
          </div>
          <div class="glass-inspector-status-grid">
            <article class="glass-inspector-stat">
              <span>${sanitizeHtml("Live page")}</span>
              <strong>${sanitizeHtml(publicFrontDeskLive ? "Enabled" : "Disabled")}</strong>
            </article>
            <article class="glass-inspector-stat">
              <span>${sanitizeHtml("Verification")}</span>
              <strong>${sanitizeHtml(liveVerificationLabel || installStatus.label || "Not live yet")}</strong>
            </article>
            <article class="glass-inspector-stat">
              <span>${sanitizeHtml("Reviews")}</span>
              <strong>${sanitizeHtml(String(reviewCount))}</strong>
            </article>
            <article class="glass-inspector-stat">
              <span>${sanitizeHtml("Library")}</span>
              <strong>${sanitizeHtml(`${publishedCount} published`)}</strong>
            </article>
          </div>
          <div class="glass-inspector-section">
            <div>
              <p class="overview-label">${sanitizeHtml("Focus")}</p>
              <p>${sanitizeHtml(activeFrontDeskSection === "customization"
                ? "Tune the customer-facing identity, greeting, questions, and launch behavior without exposing every control at once."
                : "Use the current tab for focused work. Secondary setup context stays here instead of crowding the main canvas.")}</p>
            </div>
            <div class="glass-inspector-mini-list">
              <span>${sanitizeHtml(businessContextCopy)}</span>
              <span>${sanitizeHtml(draftCount ? `${draftCount} draft improvement${draftCount === 1 ? "" : "s"} available.` : "No draft improvements waiting.")}</span>
              <span>${sanitizeHtml(missingSetupFields.length ? `Review: ${missingSetupFields.slice(0, 3).join(", ")}` : "No major required setup gaps are standing out.")}</span>
            </div>
          </div>
          <div class="glass-inspector-actions">
            <button class="ghost-button" type="button" data-frontdesk-open="knowledge">${sanitizeHtml("Review knowledge")}</button>
            <button class="ghost-button" type="button" data-frontdesk-open="launch">${sanitizeHtml("Launch status")}</button>
          </div>
        </aside>
      `;
    }

    function buildFrontDeskPanel(agent, setup, operatorWorkspace = getEmptyOperatorWorkspace(), frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue()) {
      const installStatus = getDefaultInstallStatus(agent);
      const activeFrontDeskSection = getActiveFrontDeskSection();
      const hasPreview = Boolean(sanitizeText(agent.publicAgentKey));
      const fullPageUrl = sanitizeText(agent.id || agent.publicAgentKey) ? buildFullPageAssistantUrl(agent) : "";
      const qrEndpoint = buildFullPageQrEndpoint(agent);
      const businessReadiness = operatorWorkspace.businessProfile?.readiness || getEmptyOperatorWorkspace().businessProfile.readiness;
      const missingSetupFields = getFrontDeskMissingSetupFields(agent, setup, operatorWorkspace);
      const profileContentSummary = getBusinessProfileContentSummary(operatorWorkspace);
      const publicFrontDeskLive = isPublicFullPageEnabled(agent);
      const reviewCount = getFrontDeskReviewItems(actionQueue).length;
      const draftCount = getDraftImprovementItems(frontDeskTraining).length;
      const publishedCount = getPublishedAnswerItems(frontDeskTraining).length;
      const liveVerificationLabel = isInstallSeen(installStatus)
        ? "Live traffic confirmed"
        : isInstallDetected(installStatus)
          ? "Installed, waiting for first live visit"
          : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
            ? "Verification needs attention"
            : "Not live yet";
      const pageHeaderActions = `
    <button class="ghost-button" type="button" data-frontdesk-open="customization">Open customization</button>
  `;

      return localizeDashboardHtml(`
    <section class="workspace-page" data-shell-section="customize" hidden>
      ${buildPageHeader({
        title: "Front Desk",
        copy: "Practice, teach, and publish the answers customers see.",
        actionsMarkup: pageHeaderActions,
      })}
      ${buildPageToolbar({
        filtersMarkup: renderFrontDeskTabNav(activeFrontDeskSection, { buildLocalSectionNav }, {
          reviewCount,
          publishedCount,
          knowledgeReady: Boolean(setup.knowledgeReady),
          publicFrontDeskLive,
        }),
      })}
      <div class="workspace-page-body frontdesk-operator-body">
        ${buildFrontDeskCommandCenter({
          setup,
          activeFrontDeskSection,
          reviewCount,
          draftCount,
          publishedCount,
          hasPreview,
          publicFrontDeskLive,
          installStatus,
        })}
        <div class="glass-operating-split frontdesk-operating-split">
          <main class="glass-operating-main frontdesk-operating-main">
            ${buildFrontDeskPracticeSection(agent, setup, frontDeskTraining, actionQueue, activeFrontDeskSection)}
            ${buildImprovementsSection(frontDeskTraining, actionQueue, activeFrontDeskSection)}
            ${buildKnowledgeSection({
              agent,
              setup,
              activeFrontDeskSection,
              missingSetupFields,
              businessReadiness,
              profileContentSummary,
            })}
            ${buildAnswerLibrarySection(frontDeskTraining, activeFrontDeskSection)}
            ${buildLaunchSection({
              agent,
              setup,
              activeFrontDeskSection,
              installStatus,
              hasPreview,
              fullPageUrl,
              qrEndpoint,
              publicFrontDeskLive,
              liveVerificationLabel,
            })}
            ${buildFrontDeskCustomizationPanel(agent, setup, operatorWorkspace, actionQueue, activeFrontDeskSection)}
          </main>
          ${buildFrontDeskInspectorPanel({
            activeFrontDeskSection,
            installStatus,
            missingSetupFields,
            businessReadiness,
            reviewCount,
            draftCount,
            publishedCount,
            publicFrontDeskLive,
            liveVerificationLabel,
          })}
        </div>
      </div>
    </section>
  `);
    }

    function bindFrontDeskEvents(options = {}) {
      const agent = options.agent || {};
      const fetchJson = typeof options.fetchJson === "function"
        ? options.fetchJson
        : () => Promise.reject(new Error("Front Desk request helper is unavailable."));
      const getClientId = typeof options.getClientId === "function"
        ? options.getClientId
        : () => "";
      const setStatus = typeof options.setStatus === "function" ? options.setStatus : () => {};
      const boot = typeof options.boot === "function" ? options.boot : async () => {};
      const refreshDashboard = typeof options.refreshDashboard === "function"
        ? options.refreshDashboard
        : async () => boot();
      const setActiveFrontDeskSection = typeof options.setActiveFrontDeskSection === "function"
        ? options.setActiveFrontDeskSection
        : () => {};
      const normalizeSection = typeof options.normalizeFrontDeskSection === "function"
        ? options.normalizeFrontDeskSection
        : normalizeFrontDeskTab;
      const syncDashboardHelpUi = typeof options.syncDashboardHelpUi === "function"
        ? options.syncDashboardHelpUi
        : () => {};
      const frontDeskSectionButtons = document.querySelectorAll("[data-frontdesk-target]");
      const frontDeskOpenButtons = document.querySelectorAll("[data-frontdesk-open]");
      const frontDeskSections = document.querySelectorAll("[data-frontdesk-section]");
      const frontDeskApprovedAnswerForms = document.querySelectorAll("[data-frontdesk-approved-answer-form]");
      const frontDeskArchiveApprovedAnswerButtons = document.querySelectorAll("[data-frontdesk-archive-approved-answer]");
      const frontDeskTestAnswerButtons = document.querySelectorAll("[data-frontdesk-test-answer]");
      const frontDeskSaveQueueApprovedButtons = document.querySelectorAll("[data-frontdesk-save-queue-approved]");
      const frontDeskImproveQueueItemButtons = document.querySelectorAll("[data-frontdesk-improve-queue-item]");
      const frontDeskPracticeForms = document.querySelectorAll("[data-frontdesk-practice-form]");
      const frontDeskPracticeResetButtons = document.querySelectorAll("[data-frontdesk-practice-reset]");
      const frontDeskTeachingForms = document.querySelectorAll("[data-frontdesk-teaching-form]");
      const frontDeskTeachingCloseButtons = document.querySelectorAll("[data-frontdesk-teaching-close]");
      const frontDeskTryAgainButtons = document.querySelectorAll("[data-frontdesk-try-again]");
      const frontDeskOpenImprovementButtons = document.querySelectorAll("[data-frontdesk-open-improvement]");
      const frontDeskImproveFeedbackButtons = document.querySelectorAll("[data-frontdesk-improve-feedback]");
      const frontDeskOpenDraftButtons = document.querySelectorAll("[data-frontdesk-open-draft]");
      const frontDeskEditDraftButtons = document.querySelectorAll("[data-frontdesk-edit-draft]");
      const frontDeskPublishItemButtons = document.querySelectorAll("[data-frontdesk-publish-item]");
      const frontDeskEditLibraryAnswerButtons = document.querySelectorAll("[data-frontdesk-edit-library-answer]");
      const frontDeskFeedbackStatusButtons = document.querySelectorAll("[data-frontdesk-feedback-status]");
      const conversationSaveApprovedButtons = document.querySelectorAll("[data-conversation-save-approved-answer]");
      const conversationImproveAnswerButtons = document.querySelectorAll("[data-conversation-improve-answer]");
      const conversationNotHelpfulButtons = document.querySelectorAll("[data-conversation-not-helpful]");

      const showFrontDeskSection = (target = "practice", eventOptions = {}) => {
        const normalizedTarget = normalizeSection(target);
        setActiveFrontDeskSection(normalizedTarget, {
          syncHash: eventOptions.syncHash === true,
        });

        frontDeskSectionButtons.forEach((button) => {
          const isActive = button.dataset.frontdeskTarget === normalizedTarget;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        frontDeskSections.forEach((section) => {
          section.hidden = section.dataset.frontdeskSection !== normalizedTarget;
        });

        const activeSectionValue = document.querySelector("[data-frontdesk-active-section-value]");
        if (activeSectionValue) {
          activeSectionValue.textContent = getFrontDeskTabLabel(normalizedTarget);
        }

        syncDashboardHelpUi();
        return normalizedTarget;
      };

      const updateFrontDeskFeedbackStatus = async ({ feedbackId, status, trainingItemId = "" } = {}) => {
        const normalizedFeedbackId = sanitizeText(feedbackId);
        if (!normalizedFeedbackId || !sanitizeText(status)) {
          return null;
        }

        return fetchJson("/agents/front-desk/feedback/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            feedback_id: normalizedFeedbackId,
            status,
            training_item_id: trainingItemId || undefined,
          }),
        });
      };

      const recordOwnerFrontDeskFeedback = async ({
        question = "",
        answer = "",
        messageId = "",
        sessionKey = "",
        sourceType = "owner_feedback",
        reason = "other",
        note = "",
      } = {}) => fetchJson("/agents/front-desk/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          rating: "not_helpful",
          reason,
          note,
          user_question: question,
          assistant_answer: answer,
          assistant_message_key: messageId,
          session_key: sessionKey,
          source_type: sourceType,
          source_route: "dashboard",
        }),
      });

      const getPracticeThread = () => document.querySelector("[data-frontdesk-practice-thread]");
      const getPracticeTeachingShell = () => document.querySelector("[data-frontdesk-teaching-form-shell]");
      const getPracticeTeachingForm = () => document.querySelector("[data-frontdesk-teaching-form]");
      const getSelectedDraftTrainingIds = () => {
        const shell = getPracticeTeachingShell();
        const selected = sanitizeText(shell?.dataset.includeDraftTrainingIds || "");
        return selected ? selected.split(",").map((id) => sanitizeText(id)).filter(Boolean) : [];
      };

      const setSelectedDraftTrainingId = (itemId = "") => {
        const shell = getPracticeTeachingShell();
        const normalizedItemId = sanitizeText(itemId);
        if (!shell || !normalizedItemId) {
          return;
        }
        shell.dataset.includeDraftTrainingIds = normalizedItemId;
        shell.querySelector("[data-frontdesk-try-again]")?.removeAttribute("hidden");
      };

      const appendPracticeMessage = ({ role = "assistant", content = "", question = "", answer = "", draftIds = [] } = {}) => {
        const thread = getPracticeThread();
        if (!thread || !sanitizeText(content)) {
          return null;
        }

        const messageEl = document.createElement("article");
        messageEl.className = `frontdesk-practice-message ${role === "user" ? "user" : "assistant"}`;
        messageEl.innerHTML = `
      <span>${sanitizeHtml(role === "user" ? "You" : (agent.assistantName || agent.name || "Front Desk"))}</span>
      <p>${sanitizeHtml(content)}</p>
      ${role === "assistant" ? `
        <div class="frontdesk-practice-actions">
          <button class="ghost-button" type="button" data-frontdesk-response-good>Looks good</button>
          <button class="ghost-button" type="button" data-frontdesk-response-teach data-question="${sanitizeHtml(question)}" data-answer="${sanitizeHtml(answer || content)}">Teach this answer</button>
          <button class="ghost-button" type="button" data-frontdesk-response-try-again data-question="${sanitizeHtml(question)}" data-draft-ids="${sanitizeHtml(draftIds.join(","))}">Try again</button>
          <button class="ghost-button" type="button" data-frontdesk-response-teach data-question="${sanitizeHtml(question)}" data-answer="${sanitizeHtml(answer || content)}">Save as improvement</button>
        </div>
      ` : ""}
    `;
        thread.appendChild(messageEl);
        thread.scrollTop = thread.scrollHeight;

        messageEl.querySelector("[data-frontdesk-response-good]")?.addEventListener("click", () => {
          setStatus("Practice answer marked helpful.");
        });
        messageEl.querySelectorAll("[data-frontdesk-response-teach]").forEach((button) => {
          button.addEventListener("click", () => {
            openPracticeTeachingForm({
              question: button.dataset.question || "",
              currentAnswer: button.dataset.answer || "",
              answer: "",
              sourceType: "test",
            });
          });
        });
        messageEl.querySelector("[data-frontdesk-response-try-again]")?.addEventListener("click", async (buttonEvent) => {
          const button = buttonEvent.currentTarget;
          const selectedDraftIds = sanitizeText(button.dataset.draftIds)
            ? button.dataset.draftIds.split(",").map((id) => sanitizeText(id)).filter(Boolean)
            : getSelectedDraftTrainingIds();
          await sendPracticeMessage(button.dataset.question || question, { includeDraftTrainingIds: selectedDraftIds, skipUserEcho: true });
        });

        return messageEl;
      };

      const openPracticeTeachingForm = ({
        question = "",
        currentAnswer = "",
        answer = "",
        tags = "",
        feedbackId = "",
        itemId = "",
        sourceType = "test",
      } = {}) => {
        showFrontDeskSection("practice", { syncHash: true });
        const shell = getPracticeTeachingShell();
        const form = getPracticeTeachingForm();
        if (!shell || !form) {
          return;
        }

        shell.hidden = false;
        form.querySelector('[name="item_id"]').value = sanitizeText(itemId);
        form.querySelector('[name="feedback_id"]').value = sanitizeText(feedbackId);
        form.querySelector('[name="source_type"]').value = sanitizeText(sourceType) || "test";
        form.querySelector('[name="trigger_text"]').value = sanitizeText(question);
        form.querySelector('[name="current_answer"]').value = sanitizeText(currentAnswer || answer);
        form.querySelector('[name="answer_text"]').value = sanitizeText(answer);
        form.querySelector('[name="tags"]').value = sanitizeText(tags);
        shell.scrollIntoView({ behavior: "smooth", block: "center" });
        form.querySelector('[name="answer_text"]')?.focus();
      };

      const sendPracticeMessage = async (message, { includeDraftTrainingIds = [], skipUserEcho = false } = {}) => {
        const normalizedMessage = sanitizeText(message);
        if (!normalizedMessage) {
          setStatus("Ask a question as if you were a visitor.");
          return null;
        }

        const draftIds = includeDraftTrainingIds.length ? includeDraftTrainingIds : getSelectedDraftTrainingIds();
        if (!skipUserEcho) {
          appendPracticeMessage({ role: "user", content: normalizedMessage });
        }
        setStatus(draftIds.length ? "Trying again with the draft improvement..." : "Practicing with Front Desk...");

        const result = await fetchJson(`/api/agents/${encodeURIComponent(agent.id)}/front-desk/practice-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            message: normalizedMessage,
            includeDraftTrainingIds: draftIds,
          }),
        });
        const reply = sanitizeText(result.reply) || "No practice response returned.";
        appendPracticeMessage({
          role: "assistant",
          content: reply,
          question: normalizedMessage,
          answer: reply,
          draftIds,
        });
        setStatus("Practice response ready.");
        return result;
      };

      const saveApprovedAnswer = async ({
        itemId = "",
        triggerText,
        answerText,
        tags,
        sourceType = "manual",
        sourceMessageId = "",
        feedbackId = "",
        status = "active",
        refresh = true,
      } = {}) => {
        const normalizedTrigger = sanitizeText(triggerText);
        const normalizedAnswer = sanitizeText(answerText);
        const normalizedStatus = sanitizeText(status) === "draft" ? "draft" : "active";

        if (!normalizedTrigger || !normalizedAnswer) {
          setStatus("Add the question or situation and the better answer.");
          return null;
        }

        setStatus(normalizedStatus === "draft" ? "Saving draft..." : "Publishing improvement...");
        const result = await fetchJson("/agents/front-desk/training-items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            type: "approved_answer",
            title: normalizedTrigger,
            item_id: sanitizeText(itemId) || undefined,
            trigger_text: normalizedTrigger,
            answer_text: normalizedAnswer,
            tags,
            source_type: sourceType,
            source_message_id: sourceMessageId || undefined,
            status: normalizedStatus,
          }),
        });
        if (feedbackId && result?.item?.id) {
          await updateFrontDeskFeedbackStatus({
            feedbackId,
            status: "resolved",
            trainingItemId: result.item.id,
          });
        }
        setStatus(normalizedStatus === "draft" ? "Draft improvement saved." : "Improvement published.");
        if (refresh) {
          await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-approved-answer-save" });
          showFrontDeskSection(normalizedStatus === "draft" ? "improvements" : "library", { syncHash: true });
        }
        return result;
      };

      const fillApprovedAnswerForm = ({ question = "", answer = "", tags = "", feedbackId = "", itemId = "" } = {}) => {
        showFrontDeskSection("library", { syncHash: true });
        const form = document.querySelector("[data-frontdesk-approved-answer-form]");
        if (!form) {
          return;
        }

        const itemInput = form.querySelector('[name="item_id"]');
        const questionInput = form.querySelector('[name="trigger_text"]');
        const answerInput = form.querySelector('[name="answer_text"]');
        const tagsInput = form.querySelector('[name="tags"]');
        const feedbackInput = form.querySelector('[name="feedback_id"]');
        if (itemInput) itemInput.value = sanitizeText(itemId);
        if (questionInput) questionInput.value = sanitizeText(question);
        if (answerInput) answerInput.value = sanitizeText(answer);
        if (tagsInput) tagsInput.value = sanitizeText(tags);
        if (feedbackInput) feedbackInput.value = sanitizeText(feedbackId);
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        questionInput?.focus();
      };

      frontDeskSectionButtons.forEach((button) => {
        button.addEventListener("click", () => {
          showFrontDeskSection(button.dataset.frontdeskTarget || "practice", { syncHash: true });
        });
      });

      frontDeskOpenButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const target = showFrontDeskSection(button.dataset.frontdeskOpen || "practice", { syncHash: true });
          document.querySelector(`[data-frontdesk-section="${target}"]`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      });

      frontDeskApprovedAnswerForms.forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(form);

          try {
            await saveApprovedAnswer({
              itemId: formData.get("item_id"),
              triggerText: formData.get("trigger_text"),
              answerText: formData.get("answer_text"),
              tags: formData.get("tags"),
              feedbackId: formData.get("feedback_id"),
              status: "active",
            });
          } catch (error) {
            setStatus(error.message || "We couldn't save that published answer.");
          }
        });
      });

      frontDeskArchiveApprovedAnswerButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const itemId = sanitizeText(button.dataset.itemId);
          if (!itemId) return;

          setStatus("Archiving answer...");
          try {
            await fetchJson("/agents/front-desk/training-items/status", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: getClientId(),
                agent_id: agent.id,
                item_id: itemId,
                status: "archived",
              }),
            });
            setStatus("Answer archived.");
            await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-approved-answer-archive" });
            showFrontDeskSection("library", { syncHash: true });
          } catch (error) {
            setStatus(error.message || "We couldn't archive that answer.");
          }
        });
      });

      frontDeskTestAnswerButtons.forEach((button) => {
        button.addEventListener("click", () => {
          showFrontDeskSection("practice", { syncHash: true });
          const input = document.querySelector('[data-frontdesk-practice-form] [name="message"]');
          if (input) {
            input.value = button.dataset.frontdeskTestAnswer || "";
            input.focus();
          }
        });
      });

      frontDeskSaveQueueApprovedButtons.forEach((button) => {
        button.addEventListener("click", () => {
          fillApprovedAnswerForm({
            question: button.dataset.question || "",
            answer: button.dataset.answer || "",
            feedbackId: button.dataset.feedbackId || "",
          });
        });
      });

      frontDeskImproveQueueItemButtons.forEach((button) => {
        button.addEventListener("click", () => {
          openPracticeTeachingForm({
            question: button.dataset.question || "",
            currentAnswer: button.dataset.answer || "",
            answer: "",
            feedbackId: button.dataset.feedbackId || "",
            sourceType: "conversation",
          });
          setStatus("Teach this answer in Practice.");
        });
      });

      frontDeskFeedbackStatusButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const feedbackId = sanitizeText(button.dataset.feedbackId);
          const status = sanitizeText(button.dataset.frontdeskFeedbackStatus);
          if (!feedbackId || !status) return;

          button.disabled = true;
          setStatus(status === "ignored" ? "Ignoring feedback..." : "Marking feedback resolved...");
          try {
            await updateFrontDeskFeedbackStatus({ feedbackId, status });
            setStatus(status === "ignored" ? "Feedback ignored." : "Feedback resolved.");
            await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-feedback-status" });
            showFrontDeskSection("improvements", { syncHash: true });
          } catch (error) {
            button.disabled = false;
            setStatus(error.message || "We couldn't update that feedback.");
          }
        });
      });

      frontDeskPracticeResetButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const thread = getPracticeThread();
          if (thread) {
            thread.innerHTML = `
          <article class="frontdesk-practice-message assistant">
            <span>${sanitizeHtml(agent.assistantName || agent.name || "Front Desk")}</span>
            <p>${sanitizeHtml(agent.welcomeMessage || "Hi, I can help answer questions and point you to the right next step.")}</p>
          </article>
        `;
          }
          const shell = getPracticeTeachingShell();
          if (shell) {
            shell.hidden = true;
            shell.dataset.includeDraftTrainingIds = "";
          }
          setStatus("Practice conversation reset.");
        });
      });

      frontDeskPracticeForms.forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(form);
          const message = sanitizeText(formData.get("message"));

          if (!message) {
            setStatus("Ask a question as if you were a visitor.");
            return;
          }

          try {
            await sendPracticeMessage(message);
            form.reset();
          } catch (error) {
            appendPracticeMessage({
              role: "assistant",
              content: error.message || "We couldn't practice with Front Desk right now.",
              question: message,
            });
            setStatus(error.message || "We couldn't practice with Front Desk right now.");
          }
        });
      });

      frontDeskTeachingCloseButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const shell = getPracticeTeachingShell();
          if (shell) {
            shell.hidden = true;
          }
        });
      });

      frontDeskTeachingForms.forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submitter = event.submitter;
          const formData = new FormData(form);
          const publish = submitter?.hasAttribute("data-frontdesk-publish-improvement");
          const feedbackId = sanitizeText(formData.get("feedback_id"));

          try {
            const result = await saveApprovedAnswer({
              itemId: formData.get("item_id"),
              triggerText: formData.get("trigger_text"),
              answerText: formData.get("answer_text"),
              tags: formData.get("tags"),
              sourceType: formData.get("source_type") || "test",
              feedbackId,
              status: publish ? "active" : "draft",
              refresh: false,
            });
            if (result?.item?.status === "draft") {
              setSelectedDraftTrainingId(result.item.id);
              form.querySelector('[name="item_id"]').value = result.item.id || "";
              setStatus("Draft improvement saved. Try again when you are ready.");
            } else if (result?.item?.status === "active") {
              setStatus("Improvement published.");
              await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-improvement-save" });
              showFrontDeskSection("library", { syncHash: true });
            }
          } catch (error) {
            setStatus(error.message || "We couldn't save that improvement.");
          }
        });
      });

      frontDeskTryAgainButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const form = getPracticeTeachingForm();
          const question = sanitizeText(form?.querySelector('[name="trigger_text"]')?.value || "");
          try {
            await sendPracticeMessage(question, {
              includeDraftTrainingIds: getSelectedDraftTrainingIds(),
              skipUserEcho: false,
            });
          } catch (error) {
            setStatus(error.message || "We couldn't try that improvement.");
          }
        });
      });

      frontDeskOpenImprovementButtons.forEach((button) => {
        button.addEventListener("click", () => {
          showFrontDeskSection("practice", { syncHash: true });
          const input = document.querySelector('[data-frontdesk-practice-form] [name="message"]');
          if (input) {
            input.value = button.dataset.question || "";
            input.focus();
          }
          if (button.dataset.answer || button.dataset.feedbackId) {
            openPracticeTeachingForm({
              question: button.dataset.question || "",
              currentAnswer: button.dataset.answer || "",
              answer: button.dataset.itemId && !button.dataset.feedbackId ? button.dataset.answer || "" : "",
              feedbackId: button.dataset.feedbackId || "",
              itemId: button.dataset.itemId || "",
              sourceType: button.dataset.feedbackId ? "conversation" : "test",
            });
          }
        });
      });

      frontDeskImproveFeedbackButtons.forEach((button) => {
        button.addEventListener("click", () => {
          openPracticeTeachingForm({
            question: button.dataset.question || "",
            currentAnswer: button.dataset.answer || "",
            feedbackId: button.dataset.feedbackId || "",
            sourceType: "conversation",
          });
          setStatus("Teach this answer in Practice.");
        });
      });

      [...frontDeskOpenDraftButtons, ...frontDeskEditDraftButtons, ...frontDeskEditLibraryAnswerButtons].forEach((button) => {
        button.addEventListener("click", () => {
          openPracticeTeachingForm({
            question: button.dataset.question || "",
            currentAnswer: button.dataset.answer || "",
            answer: button.dataset.answer || "",
            tags: button.dataset.tags || "",
            itemId: button.dataset.itemId || "",
            sourceType: "test",
          });
          if (button.matches("[data-frontdesk-open-draft]")) {
            setSelectedDraftTrainingId(button.dataset.itemId || "");
          }
        });
      });

      frontDeskPublishItemButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const itemId = sanitizeText(button.dataset.itemId);
          if (!itemId) return;

          button.disabled = true;
          setStatus("Publishing improvement...");
          try {
            await fetchJson("/agents/front-desk/training-items/status", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: getClientId(),
                agent_id: agent.id,
                item_id: itemId,
                status: "active",
              }),
            });
            setStatus("Improvement published.");
            await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-improvement-publish" });
            showFrontDeskSection("library", { syncHash: true });
          } catch (error) {
            button.disabled = false;
            setStatus(error.message || "We couldn't publish that improvement.");
          }
        });
      });

      conversationSaveApprovedButtons.forEach((button) => {
        button.addEventListener("click", () => {
          fillApprovedAnswerForm({
            question: button.dataset.question || "",
            answer: button.dataset.answer || "",
          });
        });
      });

      conversationImproveAnswerButtons.forEach((button) => {
        button.addEventListener("click", () => {
          openPracticeTeachingForm({
            question: button.dataset.question || "",
            currentAnswer: button.dataset.answer || "",
            sourceType: "conversation",
          });
          setStatus("Teach this answer in Practice.");
        });
      });

      conversationNotHelpfulButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const question = sanitizeText(button.dataset.question);
          const answer = sanitizeText(button.dataset.answer);
          if (!question || !answer) {
            setStatus("This message needs a customer question and answer before it can be reviewed.");
            return;
          }

          setStatus("Sending this answer to Improvements...");
          button.disabled = true;
          try {
            await recordOwnerFrontDeskFeedback({
              question,
              answer,
              messageId: button.dataset.messageId || "",
              sessionKey: button.dataset.sessionKey || "",
              sourceType: "owner_feedback",
              reason: "other",
            });
            setStatus("Marked not helpful and sent to Improvements.");
            await refreshDashboard({ agentId: agent.id, activeAction: "front-desk-feedback-create" });
            showFrontDeskSection("improvements", { syncHash: true });
          } catch (error) {
            button.disabled = false;
            setStatus(error.message || "We couldn't mark that answer not helpful.");
          }
        });
      });

      return {
        appendPracticeMessage,
        fillApprovedAnswerForm,
        openPracticeTeachingForm,
        saveApprovedAnswer,
        sendPracticeMessage,
        showSection: showFrontDeskSection,
        updateFrontDeskFeedbackStatus,
      };
    }

    return {
      getApprovedAnswerItems,
      getPublishedAnswerItems,
      getDraftImprovementItems,
      getRecentlyPublishedImprovementItems,
      getFeedbackReasonLabel,
      getImprovementSourceLabel,
      getTrainingSourceLabel,
      getAssistantSourceLabel,
      getFrontDeskReviewItems,
      buildCompactImprovementRows,
      buildPracticeImprovementsPanel,
      buildFrontDeskPracticeSection,
      buildImprovementsSection,
      buildAnswerLibrarySection,
      buildKnowledgeSection,
      buildLaunchSection,
      buildFrontDeskPanel,
      bindFrontDeskEvents,
      renderTrainingQueueItem,
      renderApprovedAnswerCard,
    };
  }

  global.VonzaDashboardFrontDesk = Object.freeze({
    FRONT_DESK_TAB_KEYS,
    normalizeFrontDeskTab,
    normalizeFrontDeskSection: normalizeFrontDeskTab,
    getFrontDeskTabLabel,
    getFrontDeskTabs,
    buildFrontDeskStatusSummary,
    buildKnowledgeStatusSummary,
    formatTrainingItemSource,
    formatTrainingItemReason,
    formatImprovementSource,
    formatAssistantSource,
    renderPracticeStatus,
    renderFrontDeskEmptyState,
    renderFrontDeskTabNav,
    createFrontDeskHelpers,
  });
})(window);
