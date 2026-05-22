(function registerVonzaDashboardFrontDesk(global) {
  const FRONT_DESK_TABS = Object.freeze([
    { key: "practice", label: "Practice" },
    { key: "improvements", label: "Improvements" },
    { key: "knowledge", label: "Knowledge" },
    { key: "library", label: "Answer library" },
    { key: "launch", label: "Launch" },
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

    return {
      website: agent.websiteUrl || "No website configured",
      pagesLearned: setup.knowledgePageCount ? `${setup.knowledgePageCount} page${setup.knowledgePageCount === 1 ? "" : "s"} imported` : "No pages imported yet",
      missingSetup: missingSetupFields.length ? missingSetupFields.join(", ") : "No required setup gaps are standing out.",
      customerImpact: setup.knowledgeReady
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

  function renderFrontDeskTabNav(activeKey = "practice", dependencies = {}) {
    const buildLocalSectionNav = typeof dependencies.buildLocalSectionNav === "function"
      ? dependencies.buildLocalSectionNav
      : () => "";

    return buildLocalSectionNav(getFrontDeskTabs(), {
      attribute: "data-frontdesk-target",
      activeKey: normalizeFrontDeskTab(activeKey),
    });
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
          <h2 class="frontdesk-section-title">Practice with Front Desk</h2>
          <p class="frontdesk-section-copy">Ask a question as if you were a visitor.</p>
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
            <span class="frontdesk-practice-status">${sanitizeHtml(renderPracticeStatus(hasWebsite))}</span>
          </div>
          <div class="frontdesk-practice-thread" data-frontdesk-practice-thread>
            <article class="frontdesk-practice-message assistant">
              <span>${sanitizeHtml(assistantName)}</span>
              <p>${sanitizeHtml(welcomeMessage)}</p>
            </article>
          </div>
          <form class="frontdesk-practice-composer" data-frontdesk-practice-form>
            <input name="message" type="text" autocomplete="off" placeholder="Ask a question as if you were a visitor.">
            <button class="primary-button" type="submit">Send</button>
          </form>
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
        <div class="frontdesk-improvement-list">
          ${reviewItems.map((item) => renderTrainingQueueItem(item)).join("")}
          ${draftItems.map((item) => renderTrainingQueueItem(item, { variant: "draft" })).join("")}
          ${publishedItems.map((item) => renderTrainingQueueItem(item, { variant: "published" })).join("")}
        </div>
      ` : buildOperatorEmptyState({
        title: "Nothing needs review right now.",
        copy: "Visitor feedback, owner-marked answers, and draft improvements will appear here.",
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
        copy: "Teach Front Desk in Practice, then publish improvements when they are ready for visitors.",
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
                : `<button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Finish Front Desk setup</button>`}
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
      const liveVerificationLabel = isInstallSeen(installStatus)
        ? "Live traffic confirmed"
        : isInstallDetected(installStatus)
          ? "Installed, waiting for first live visit"
          : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
            ? "Verification needs attention"
            : "Not live yet";
      const pageHeaderActions = `
    <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Open settings</button>
  `;

      return localizeDashboardHtml(`
    <section class="workspace-page" data-shell-section="customize" hidden>
      ${buildPageHeader({
        title: "Front Desk",
        copy: "Practice, teach, and publish the answers customers see.",
        actionsMarkup: pageHeaderActions,
      })}
      ${buildPageToolbar({
        filtersMarkup: renderFrontDeskTabNav(activeFrontDeskSection, { buildLocalSectionNav }),
      })}
      <div class="workspace-page-body">
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
      </div>
    </section>
  `);
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
