(function registerVonzaDashboardToday(global) {
  function fallbackTrimText(value) {
    return String(value || "").trim();
  }

  function fallbackEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createTodayHelpers(dependencies = {}) {
    const trimText = typeof dependencies.trimText === "function" ? dependencies.trimText : fallbackTrimText;
    const escapeHtml = typeof dependencies.escapeHtml === "function" ? dependencies.escapeHtml : fallbackEscapeHtml;
    const translateDashboardText = typeof dependencies.translateDashboardText === "function" ? dependencies.translateDashboardText : (value) => trimText(value);
    const localizeDashboardCopy = typeof dependencies.localizeDashboardCopy === "function" ? dependencies.localizeDashboardCopy : (english) => trimText(english);
    const localizeDashboardHtml = typeof dependencies.localizeDashboardHtml === "function" ? dependencies.localizeDashboardHtml : (html) => html;
    const createEmptyOperatorWorkspace = typeof dependencies.createEmptyOperatorWorkspace === "function" ? dependencies.createEmptyOperatorWorkspace : () => ({
      summary: {},
      today: { lifecycleCounts: {} },
      status: {},
      calendar: { scheduleItems: [], followUpItems: [], unlinkedItems: [], reviewItems: [] },
      copilot: { context: { businessProfile: { readiness: {} }, warnings: [] }, fallback: {}, proposalSummary: {}, proposals: [], recommendations: [] },
      businessProfile: { readiness: {}, prefill: {} },
    });
    const createEmptyBusinessProfileState = typeof dependencies.createEmptyBusinessProfileState === "function" ? dependencies.createEmptyBusinessProfileState : () => ({ prefill: {} });
    const createEmptyActionQueue = typeof dependencies.createEmptyActionQueue === "function" ? dependencies.createEmptyActionQueue : () => ({ items: [], summary: {} });
    const isTodayCopilotFlagEnabled = typeof dependencies.isTodayCopilotFlagEnabled === "function" ? dependencies.isTodayCopilotFlagEnabled : () => false;
    const getBadgeClass = typeof dependencies.getBadgeClass === "function" ? dependencies.getBadgeClass : () => "status-badge";
    const buildCopilotSummaryCards = typeof dependencies.buildCopilotSummaryCards === "function" ? dependencies.buildCopilotSummaryCards : () => "";
    const buildCopilotProposalList = typeof dependencies.buildCopilotProposalList === "function" ? dependencies.buildCopilotProposalList : () => "";
    const resolveVisibleShellTarget = typeof dependencies.resolveVisibleShellTarget === "function" ? dependencies.resolveVisibleShellTarget : () => null;
    const normalizeShellCopy = typeof dependencies.normalizeShellCopy === "function" ? dependencies.normalizeShellCopy : (value) => trimText(value);
    const buildDisclosureBlock = typeof dependencies.buildDisclosureBlock === "function" ? dependencies.buildDisclosureBlock : ({ contentMarkup = "" } = {}) => contentMarkup;
    const buildDisclosureDetailRows = typeof dependencies.buildDisclosureDetailRows === "function" ? dependencies.buildDisclosureDetailRows : () => "";
    const formatOperatorCount = typeof dependencies.formatOperatorCount === "function" ? dependencies.formatOperatorCount : (value, singular, plural = `${singular}s`) => `${value} ${Number(value) === 1 ? singular : plural}`;
    const formatSeenAt = typeof dependencies.formatSeenAt === "function" ? dependencies.formatSeenAt : (value) => trimText(value);
    const getOutcomeTypeLabel = typeof dependencies.getOutcomeTypeLabel === "function" ? dependencies.getOutcomeTypeLabel : (value) => trimText(value).replaceAll("_", " ");
    const buildContactsAttentionStrip = typeof dependencies.buildContactsAttentionStrip === "function" ? dependencies.buildContactsAttentionStrip : () => "";
    const buildOperatorEmptyState = typeof dependencies.buildOperatorEmptyState === "function" ? dependencies.buildOperatorEmptyState : ({ title = "", copy = "" } = {}) => `<div class="placeholder-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div>`;
    const getUiIconMarkup = typeof dependencies.getUiIconMarkup === "function" ? dependencies.getUiIconMarkup : () => "";
    const getActionQueueStatusLabel = typeof dependencies.getActionQueueStatusLabel === "function" ? dependencies.getActionQueueStatusLabel : (value) => trimText(value).replaceAll("_", " ");
    const getActionQueueStatusBadgeClass = typeof dependencies.getActionQueueStatusBadgeClass === "function" ? dependencies.getActionQueueStatusBadgeClass : () => "status-badge";
    const normalizeActionQueueStatus = typeof dependencies.normalizeActionQueueStatus === "function" ? dependencies.normalizeActionQueueStatus : (value) => trimText(value).toLowerCase().replaceAll("-", "_") || "new";
    const getActionQueueOwnerWorkflow = typeof dependencies.getActionQueueOwnerWorkflow === "function" ? dependencies.getActionQueueOwnerWorkflow : () => ({ label: "Owner review", copy: "Review this item.", attention: true });
    const getActionQueueOwnerWorkflowBadgeClass = typeof dependencies.getActionQueueOwnerWorkflowBadgeClass === "function" ? dependencies.getActionQueueOwnerWorkflowBadgeClass : () => "status-badge";
    const getFollowUpStatusLabel = typeof dependencies.getFollowUpStatusLabel === "function" ? dependencies.getFollowUpStatusLabel : (value) => trimText(value).replaceAll("_", " ");
    const getOperatorActionTypeLabel = typeof dependencies.getOperatorActionTypeLabel === "function" ? dependencies.getOperatorActionTypeLabel : (item = {}) => trimText(item.type).replaceAll("_", " ");
    const getActionQueueTypeLabel = typeof dependencies.getActionQueueTypeLabel === "function" ? dependencies.getActionQueueTypeLabel : (value) => trimText(value).replaceAll("_", " ");
    const formatActionQueueContact = typeof dependencies.formatActionQueueContact === "function" ? dependencies.formatActionQueueContact : (item = {}) => trimText(item.contactInfo?.label || item.person?.label || item.customerLabel || "");
    const buildRowActionMenu = typeof dependencies.buildRowActionMenu === "function" ? dependencies.buildRowActionMenu : (_label, contentMarkup = "") => contentMarkup;
    const buildActionQueueSummaryPills = typeof dependencies.buildActionQueueSummaryPills === "function" ? dependencies.buildActionQueueSummaryPills : () => [];
    function getTodayQueueItemKey(item = {}) {
      const queueType = trimText(item.queueType) || (isAppointmentReviewQueueItem(item) ? "appointment_review" : "action_queue");
      const queueId = trimText(item.queueId || item.id || item.key);

      return queueType && queueId ? `${queueType}:${queueId}` : "";
    }

    function buildTodayCopilotSection(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const copilot = operatorWorkspace.copilot || createEmptyOperatorWorkspace().copilot;
      const businessProfile = operatorWorkspace.businessProfile || createEmptyOperatorWorkspace().businessProfile;

      if (!isTodayCopilotFlagEnabled() || copilot.featureEnabled !== true || copilot.enabled === false) {
        return "";
      }

      const readiness = businessProfile.readiness || copilot.context?.businessProfile?.readiness || createEmptyOperatorWorkspace().copilot.context.businessProfile.readiness;
      const warnings = Array.isArray(copilot.context?.warnings) ? copilot.context.warnings : [];
      const guidance = Array.isArray(copilot.fallback?.guidance) ? copilot.fallback.guidance : [];
      const prefill = businessProfile.prefill || createEmptyBusinessProfileState().prefill;

      return `
        <section class="workspace-card-soft" style="margin-top:20px;">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Suggestions</p>
              <h3 class="workspace-panel-title">Home suggestions</h3>
              <p class="workspace-panel-copy">View-only summaries and draft suggestions built from your live workspace. Vonza does not silently act on your behalf.</p>
            </div>
            <div class="workspace-badge-row">
              <span class="${getBadgeClass(copilot.readOnly ? "Ready" : "Limited")}">${copilot.readOnly ? "View only" : "Limited"}</span>
              <span class="${getBadgeClass(copilot.draftOnly ? "Ready" : "Limited")}">${copilot.draftOnly ? "Review first" : "Mixed mode"}</span>
            </div>
          </div>
          <div class="operator-home-grid">
            <section class="operator-focus-card">
              <p class="overview-label">Home headline</p>
              <h3 class="operator-focus-title">${escapeHtml(copilot.headline || "Vonza is ready.")}</h3>
              <p class="operator-focus-copy">${escapeHtml(copilot.summary || "Vonza is summarizing your current workspace only.")}</p>
            </section>
            <section class="operator-focus-card operator-briefing-card">
              <p class="overview-label">Business context</p>
              <p class="workspace-panel-copy">${escapeHtml(readiness.summary || "Business context progress will appear here.")}</p>
              ${readiness.missingCount ? `<p class="analytics-subtle">${escapeHtml(`${readiness.missingCount} area${readiness.missingCount === 1 ? "" : "s"} could use more business detail.`)}</p>` : `<p class="analytics-subtle">Core business context is ready for suggestions.</p>`}
              <div class="inline-actions" style="margin-top:12px;">
                <button class="ghost-button" type="button" data-copilot-open-target data-shell-target="settings" data-target-id="business-context-setup">Open business context</button>
              </div>
              ${prefill.available ? `<p class="analytics-subtle" style="margin-top:8px;">${escapeHtml(prefill.sourceSummary || `${prefill.fieldCount || 0} fields have safe suggestions ready for review.`)}</p>` : ""}
            </section>
          </div>
          ${warnings.length ? `
            <div class="operator-inline-alert" style="margin-top:16px;">
              ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
            </div>
          ` : ""}
          ${copilot.sparseData ? `
            <div class="placeholder-card" style="margin-top:16px;">
              <strong>${escapeHtml(copilot.fallback?.title || "Vonza needs a little more context")}</strong>
              <p style="margin-top:8px;">${escapeHtml(copilot.fallback?.description || "There is not enough live workspace data yet for strong recommendations.")}</p>
              ${guidance.length ? `<p class="analytics-subtle" style="margin-top:8px;">${escapeHtml(guidance.join(" "))}</p>` : ""}
            </div>
          ` : ""}
          ${buildCopilotSummaryCards(copilot)}
          ${buildCopilotProposalList(copilot, operatorWorkspace)}
        </section>
      `;
    }

    function getTodayRecommendationCategory(recommendation = {}) {
      const type = trimText(recommendation.type).toLowerCase();

      if (["business_context", "unlinked_appointment"].includes(type)) {
        return "Setup";
      }

      if (type === "knowledge_fix") {
        return "Assistant";
      }

      if (["pricing_gap", "contact_next_step", "appointment_follow_up", "outcome_review"].includes(type)) {
        return "Conversion";
      }

      return "Business";
    }

    function getRecommendationSignalText(recommendation = {}) {
      return [
        recommendation.type,
        recommendation.actionType,
        recommendation.title,
        recommendation.summary,
        recommendation.rationale,
        recommendation.surfaceLabel,
        recommendation.source?.actionKey,
        recommendation.source?.knowledgeFixId,
        recommendation.proposal?.summary,
        recommendation.proposal?.rationale,
      ].map((value) => trimText(value).toLowerCase()).filter(Boolean).join(" ");
    }

    function hasRecommendationSignal(signalText = "", patterns = []) {
      return patterns.some((pattern) => pattern.test(signalText));
    }

    function getBusinessPriorityCopy(recommendation = {}) {
      const signalText = getRecommendationSignalText(recommendation);
      const hasSignal = (patterns) => hasRecommendationSignal(signalText, patterns);

      if (hasSignal([/complaint/, /frustrat/, /support/, /risk/])) {
        return {
          title: "Improve complaint handling",
          why: "Frustrated customers need a fast, clear recovery path to protect trust.",
          change: "Review the complaint, confirm the owner follow-up, and add guidance for similar cases.",
          cta: "Review complaint handling",
          tone: "risk",
        };
      }

      if (hasSignal([/unanswered/, /open customer question/, /open conversation/, /response backlog/, /attention_item/])) {
        return {
          title: "Give open customer questions a clear next step",
          why: "Unanswered needs create friction when the customer is ready for an answer, booking, contact, or decision.",
          change: "Review the open conversations and confirm the answer, owner follow-up, or next-step path each customer needs.",
          cta: "Review open needs",
          tone: "watch",
        };
      }

      if (hasSignal([/pricing/, /price/, /cost/, /package/, /purchase/])) {
        return {
          title: "Clarify pricing guidance",
          why: "Pricing questions usually come from visitors who are close to deciding.",
          change: "Add clearer pricing ranges, quote guidance, or what details are needed for an estimate.",
          cta: "Clarify pricing",
          tone: "watch",
        };
      }

      if (hasSignal([/booking/, /appointment/, /schedule/, /availability/, /calendar/, /reserve/, /quote/])) {
        return {
          title: "Strengthen quote or booking guidance",
          why: "Booking or quote intent should move quickly to a clear next step.",
          change: "Make the booking, callback, or quote request path obvious and easy to complete.",
          cta: "Improve booking path",
          tone: "watch",
        };
      }

      if (hasSignal([/contact/, /lead/, /follow[-\s]?up/, /callback/, /phone/, /email/, /reach/])) {
        return {
          title: "Make contacting you easier",
          why: "Interested visitors can drop off if the best way to reach you is unclear.",
          change: "Show the best contact route and ask for the details your team needs to follow up.",
          cta: "Improve contact path",
          tone: "watch",
        };
      }

      if (hasSignal([/weak/, /knowledge/, /answer/, /service/, /offer/, /business_context/, /policy/, /faq/])) {
        return {
          title: "Make service answers clearer",
          why: "Customers need to understand what you offer before they can choose the right service.",
          change: "Add clearer service descriptions, examples, or FAQ answers where the front desk was unsure.",
          cta: "Improve service answers",
          tone: "watch",
        };
      }

      return null;
    }

    function buildTodaySummaryStats(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const today = operatorWorkspace.today || createEmptyOperatorWorkspace().today;
      const stats = [
        {
          label: "Messages today",
          value: String(today.messagesToday || 0),
          copy: "Current-day front desk volume only.",
        },
        {
          label: "Guided customers",
          value: String(today.contactsDealtToday || 0),
          copy: localizeDashboardCopy(
            "Unique customers tied to a booking, follow-up, or recorded outcome today.",
            "Ma foglaláshoz, utánkövetéshez vagy rögzített eredményhez kapcsolt egyedi ügyfelek."
          ),
        },
        {
          label: "Results today",
          value: String(today.outcomesToday || 0),
          copy: "Recorded results from today only.",
        },
        {
          label: "Needs attention",
          value: String(today.needsAttentionCount || 0),
          copy: "Items that still need a decision or review.",
        },
      ];

      return `
        <section class="today-command-section">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Current day</p>
              <h3 class="workspace-panel-title">Home at a glance</h3>
              <p class="workspace-panel-copy">Only live current-day signals stay visible here.</p>
            </div>
          </div>
          <div class="today-command-stat-grid">
            ${stats.map((stat) => `
              <article class="today-command-stat">
                <p class="overview-label">${escapeHtml(stat.label)}</p>
                <p class="today-command-stat-value">${escapeHtml(stat.value)}</p>
                <p class="today-command-stat-copy">${escapeHtml(stat.copy)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }

    function buildTodayProposalSection(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const copilot = operatorWorkspace.copilot || createEmptyOperatorWorkspace().copilot;
      const proposals = Array.isArray(copilot.proposals) ? copilot.proposals : [];
      const summary = copilot.proposalSummary || createEmptyOperatorWorkspace().copilot.proposalSummary;

      if (!proposals.length) {
        return `
          <section class="today-command-section">
            <div class="workspace-panel-header">
              <div>
                <p class="studio-kicker">Proposals</p>
                <h3 class="workspace-panel-title">Approval-first proposals</h3>
                <p class="workspace-panel-copy">Compact owner-ready proposals stay front and center here.</p>
              </div>
            </div>
            <div class="today-command-empty">
              <p>No active proposals are waiting right now.</p>
              ${(summary.hiddenCount || 0) > 0 ? `<p class="analytics-subtle">${escapeHtml(`${summary.hiddenCount} handled proposal${summary.hiddenCount === 1 ? "" : "s"} are hidden from the default view.`)}</p>` : ""}
            </div>
          </section>
        `;
      }

      return `
        <section class="today-command-section">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Proposals</p>
              <h3 class="workspace-panel-title">Approval-first proposals</h3>
              <p class="workspace-panel-copy">Short summaries first. Extra detail only if you open it.</p>
            </div>
            <div class="workspace-badge-row">
              <span class="${getBadgeClass(summary.blockedCount ? "Needs attention" : "Ready")}">${escapeHtml(`${summary.activeCount || proposals.length} active`)}</span>
              ${summary.blockedCount ? `<span class="${getBadgeClass("Needs attention")}">${escapeHtml(`${summary.blockedCount} blocked`)}</span>` : ""}
            </div>
          </div>
          <div class="today-command-card-list">
            ${proposals.map((proposal) => {
              const resolvedTarget = resolveVisibleShellTarget(
                proposal.target?.section || "overview",
                proposal.target?.id || "",
                operatorWorkspace,
                {
                  label: proposal.openLabel || proposal.target?.label || "Open",
                  actionKey: proposal.applyPayload?.sourceActionKey || proposal.applyPayload?.actionKey,
                  contactId: proposal.applyPayload?.contactId,
                  analyticsFallbackLabel: "Open Analytics",
                  contactFallbackLabel: "Open customer",
                }
              );

              return `
                <article class="today-command-card today-command-card-proposal">
                  <div class="today-command-card-head">
                    <div>
                      <h4 class="today-command-card-title">${escapeHtml(normalizeShellCopy(proposal.title || "Suggestion"))}</h4>
                      <p class="today-command-card-copy">${escapeHtml(normalizeShellCopy(proposal.summary || "Vonza prepared an approval-first proposal from live workspace data."))}</p>
                    </div>
                    <span class="${getBadgeClass(
                      proposal.state === "blocked"
                        ? "Needs attention"
                        : proposal.state === "stale"
                          ? "Limited"
                          : "Ready"
                    )}">${escapeHtml((proposal.state || "new").replaceAll("_", " "))}</span>
                  </div>
                  <div class="today-command-actions">
                    <button
                      class="primary-button"
                      type="button"
                      data-copilot-apply-proposal
                      data-proposal-key="${escapeHtml(proposal.key || "")}"
                      data-fallback-target-section="${escapeHtml(resolvedTarget?.section || "")}"
                      data-fallback-target-id="${escapeHtml(resolvedTarget?.id || "")}"
                    >
                      ${escapeHtml(proposal.applyLabel || "Apply")}
                    </button>
                    ${resolvedTarget ? `
                      <button
                        class="ghost-button"
                        type="button"
                        data-copilot-open-target
                        data-shell-target="${escapeHtml(resolvedTarget.section || "overview")}"
                        data-target-id="${escapeHtml(resolvedTarget.id || "")}"
                      >
                        ${escapeHtml(resolvedTarget.label || "Open")}
                      </button>
                    ` : ""}
                    <button
                      class="ghost-button"
                      type="button"
                      data-copilot-dismiss-proposal
                      data-proposal-key="${escapeHtml(proposal.key || "")}"
                    >
                      ${escapeHtml(proposal.dismissLabel || "Dismiss")}
                    </button>
                  </div>
                  ${buildDisclosureBlock({
                    label: "View details",
                    summary: [
                      proposal.priority ? `Priority ${proposal.priority}` : "",
                      proposal.confidence ? `Confidence ${proposal.confidence}` : "",
                    ].filter(Boolean).join(" · "),
                    className: "disclosure-block-inline",
                    contentMarkup: `
                      ${buildDisclosureDetailRows([
                        { label: "Why it matters", value: proposal.why ? normalizeShellCopy(proposal.why) : "No extra rationale stored." },
                        { label: "If applied", value: proposal.whatHappens ? normalizeShellCopy(proposal.whatHappens) : "This will route into the live workflow object after review." },
                        { label: "Target", value: resolvedTarget?.label || resolvedTarget?.section || "Existing workflow" },
                        { label: "Approval note", value: proposal.approvalNote ? normalizeShellCopy(proposal.approvalNote) : "The owner still reviews this before anything changes." },
                      ])}
                      ${proposal.stateReason ? `
                        <div class="${proposal.state === "blocked" ? "operator-inline-alert" : "placeholder-card"}" style="margin-top:12px;">
                          <p>${escapeHtml(normalizeShellCopy(proposal.stateReason))}</p>
                        </div>
                      ` : ""}
                    `,
                  })}
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }

    function buildTodayRecommendationsSection(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const copilot = operatorWorkspace.copilot || createEmptyOperatorWorkspace().copilot;
      const recommendations = Array.isArray(copilot.recommendations)
        ? copilot.recommendations
          .map((recommendation) => ({
            recommendation,
            priorityCopy: getBusinessPriorityCopy(recommendation),
          }))
          .filter((item) => item.priorityCopy)
          .slice(0, 3)
        : [];

      return `
        <section class="today-command-section">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">AI priorities</p>
              <h3 class="workspace-panel-title">What to improve next</h3>
              <p class="workspace-panel-copy">These are the changes most likely to improve customer satisfaction and save time.</p>
            </div>
          </div>
          ${recommendations.length ? `
            <div class="today-command-card-list">
              ${recommendations.map(({ recommendation, priorityCopy }) => {
                const resolvedTarget = resolveVisibleShellTarget(
                  recommendation.targetSection || recommendation.proposal?.target?.section || "overview",
                  recommendation.targetId || recommendation.proposal?.target?.id || "",
                  operatorWorkspace,
                  {
                    label: recommendation.surfaceLabel || recommendation.proposal?.openLabel || "Open",
                    actionKey: recommendation.source?.actionKey,
                    contactId: recommendation.source?.contactId,
                    analyticsFallbackLabel: "Open Analytics",
                    contactFallbackLabel: "Open customer",
                  }
                );

                return `
                  <article class="today-command-card">
                    <div class="today-command-card-head">
                      <div>
                        <div class="today-command-pill-row">
                          ${recommendation.priority ? `<span class="${getBadgeClass(recommendation.priority === "high" ? "Needs attention" : "Ready")}">${escapeHtml(recommendation.priority)}</span>` : ""}
                        </div>
                        <h4 class="today-command-card-title">${escapeHtml(priorityCopy.title)}</h4>
                        <p class="today-command-card-copy">${escapeHtml(priorityCopy.why)}</p>
                        <p class="today-command-card-copy">${escapeHtml(priorityCopy.change)}</p>
                      </div>
                    </div>
                    <div class="today-command-actions">
                      ${resolvedTarget ? `
                        <button
                          class="ghost-button"
                          type="button"
                          data-copilot-open-target
                          data-shell-target="${escapeHtml(resolvedTarget.section || "overview")}"
                          data-target-id="${escapeHtml(resolvedTarget.id || "")}"
                        >
                          ${escapeHtml(priorityCopy.cta)}
                        </button>
                      ` : ""}
                    </div>
                    ${buildDisclosureBlock({
                      label: "Why this recommendation",
                      summary: recommendation.confidence ? `Confidence ${recommendation.confidence}` : "",
                      className: "disclosure-block-inline",
                      contentMarkup: buildDisclosureDetailRows([
                        { label: "Why it matters", value: priorityCopy.why },
                        { label: "What to change", value: priorityCopy.change },
                        { label: "Where to act", value: resolvedTarget?.label || resolvedTarget?.section || recommendation.surfaceLabel || "Current workspace" },
                      ]),
                    })}
                  </article>
                `;
              }).join("")}
            </div>
          ` : `
            <div class="today-command-empty">
              <p>${escapeHtml(localizeDashboardCopy(
                "No urgent improvements right now. Keep watching new questions and update weak answers as they appear.",
                "Most nincs sürgős javítanivaló. Továbbra is figyeld az új kérdéseket, és frissítsd a gyenge válaszokat, amikor megjelennek."
              ))}</p>
            </div>
          `}
        </section>
      `;
    }

    function formatCalendarInsightContext(item = {}) {
      const attendeeLabel = trimText(
        item.linkedContactName
        || (Array.isArray(item.attendeeNames) ? item.attendeeNames[0] : "")
        || (Array.isArray(item.attendeeEmails) ? item.attendeeEmails[0] : "")
      );
      const timeLabel = item.startAt
        ? [
          formatSeenAt(item.startAt),
          item.endAt ? localizeDashboardCopy(`to ${formatSeenAt(item.endAt)}`, `- ${formatSeenAt(item.endAt)}`) : "",
        ].filter(Boolean).join(" ")
        : "";

      return [
        timeLabel,
        attendeeLabel ? `${translateDashboardText("Context")}: ${attendeeLabel}` : "",
        translateDashboardText(trimText(item.status).replaceAll("_", " ")),
      ].filter(Boolean).join(" · ");
    }

    function buildTodayInsightActionButton(
      item = {},
      fallbackLabel = "Review context",
      operatorWorkspace = createEmptyOperatorWorkspace(),
    ) {
      const resolvedTarget = resolveVisibleShellTarget(
        item.actionTargetSection || item.targetSection,
        item.actionTargetId || item.targetId,
        operatorWorkspace,
        {
          label: item.actionLabel || item.surfaceLabel || fallbackLabel,
          actionKey: item.sourceActionKey || item.actionKey || item.source?.actionKey,
          contactId: item.contactId || item.linkedContactId || item.source?.contactId,
          analyticsFallbackLabel: fallbackLabel,
          contactFallbackLabel: "Open customer",
          defaultLabel: fallbackLabel,
        }
      );

      if (!resolvedTarget) {
        return "";
      }

      return `
        <button
          class="ghost-button"
          type="button"
          data-copilot-open-target
          data-shell-target="${escapeHtml(resolvedTarget.section)}"
          data-target-id="${escapeHtml(resolvedTarget.id || "")}"
        >
          ${escapeHtml(resolvedTarget.label || fallbackLabel)}
        </button>
      `;
    }

    function buildTodayInsightCard({
      kicker = "",
      title = "",
      description = "",
      items = [],
      emptyTitle = "",
      emptyCopy = "",
      reasonKey = "",
      defaultActionLabel = "Review context",
      operatorWorkspace = createEmptyOperatorWorkspace(),
    } = {}) {
      return `
        <section class="workspace-card-soft">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">${escapeHtml(kicker || "Home")}</p>
              <h3 class="studio-group-title">${escapeHtml(title || "Home card")}</h3>
              <p class="workspace-panel-copy">${escapeHtml(description || "Vonza will show the next useful context here.")}</p>
            </div>
          </div>
              ${items.length ? `
            <div class="analytics-list">
              ${items.map((item) => `
                <div class="analytics-item">
                  <div class="operator-thread-head">
                    <div>
                      <p class="analytics-item-title">${escapeHtml(normalizeShellCopy(item.title || item.linkedContactName || "Calendar appointment"))}</p>
                      <p class="analytics-subtle">${escapeHtml(formatCalendarInsightContext(item))}</p>
                    </div>
                    <span class="${getBadgeClass(item.linkedContactId ? "Ready" : "Limited")}">${escapeHtml(item.linkedContactId ? "Linked" : "Needs a look")}</span>
                  </div>
                  <p class="analytics-item-copy">${escapeHtml(normalizeShellCopy(trimText(item[reasonKey]) || "Vonza highlighted this calendar item for review."))}</p>
                  <div class="inline-actions" style="margin-top:12px;">
                    ${buildTodayInsightActionButton(item, defaultActionLabel, operatorWorkspace)}
                  </div>
                  ${buildDisclosureBlock({
                    label: "View details",
                    summary: item.startAt ? formatSeenAt(item.startAt) : "",
                    className: "disclosure-block-inline",
                    contentMarkup: buildDisclosureDetailRows([
                      { label: "Timing and context", value: formatCalendarInsightContext(item) || "Context is still loading." },
                      { label: "Why it matters", value: normalizeShellCopy(trimText(item[reasonKey]) || "Vonza highlighted this calendar item for review.") },
                      { label: "Workflow status", value: item.linkedContactId ? "Linked to a contact" : "Still needs linking or review" },
                    ]),
                  })}
                </div>
              `).join("")}
            </div>
          ` : buildOperatorEmptyState({
            title: emptyTitle,
            copy: emptyCopy,
          })}
        </section>
      `;
    }

    function buildTodaySupportingDetailSection(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const summary = operatorWorkspace.summary || createEmptyOperatorWorkspace().summary;
      const today = operatorWorkspace.today || createEmptyOperatorWorkspace().today;
      const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
      const calendar = operatorWorkspace.calendar || createEmptyOperatorWorkspace().calendar;
      const scheduleItems = Array.isArray(calendar.scheduleItems) ? calendar.scheduleItems.slice(0, 4) : [];
      const followUpItems = Array.isArray(calendar.followUpItems) ? calendar.followUpItems.slice(0, 4) : [];
      const unlinkedItems = Array.isArray(calendar.unlinkedItems) ? calendar.unlinkedItems.slice(0, 4) : [];

      const contentMarkup = `
        ${buildTodayCopilotSection(operatorWorkspace)}
        ${!status.googleConnected ? `
          <section class="workspace-card-soft today-support-card">
            <div class="workspace-panel-header">
              <div>
                <p class="studio-kicker">Connected tools</p>
                <h3 class="workspace-panel-title">Calendar is beta</h3>
                <p class="workspace-panel-copy">Calendar-heavy detail is not ready yet, so Home keeps this area informational for now.</p>
              </div>
            </div>
          </section>
        ` : ""}
        <div class="overview-grid operator-metric-grid">
          ${buildTodayInsightCard({
            kicker: "Home",
            title: "Daily Schedule",
            description: "Remaining schedule context and appointment detail.",
            items: scheduleItems,
            emptyTitle: status.googleConnected
              ? "No more appointments are on today’s schedule"
              : "Calendar beta",
            emptyCopy: status.googleConnected
              ? "Vonza will keep today’s remaining schedule here."
              : "Schedule context is not ready to use from the dashboard yet.",
            reasonKey: "scheduleReason",
            defaultActionLabel: "Open context",
            operatorWorkspace,
          })}
          ${buildTodayInsightCard({
            kicker: "Follow-up",
            title: "Appointments Needing Follow-up",
            description: "Recent appointments that still need a clear next step.",
            items: followUpItems,
            emptyTitle: "No recent appointment follow-up is standing out",
            emptyCopy: "When an appointment ends without a clear next step, Vonza will surface it here.",
            reasonKey: "followUpReason",
            defaultActionLabel: "Review follow-up",
            operatorWorkspace,
          })}
          ${buildTodayInsightCard({
            kicker: "Linking",
            title: "Appointments Not Linked to a Contact",
            description: "Calendar linking detail moved out of the default Home view.",
            items: unlinkedItems,
            emptyTitle: "No appointment currently needs attendee linking",
            emptyCopy: "Vonza will show unlinked attendees here when that context matters.",
            reasonKey: "unlinkedReason",
            defaultActionLabel: "Review attendee",
            operatorWorkspace,
          })}
        </div>
        ${buildCopilotSummaryCards(operatorWorkspace.copilot || createEmptyOperatorWorkspace().copilot)}
        <div class="overview-grid operator-metric-grid">
          <div class="overview-card">
            <p class="overview-label">Approval-first work</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.followUpsNeedingApproval + today.campaignsAwaitingApproval, "item"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy(
              `${formatOperatorCount(summary.followUpsNeedingApproval, "follow-up")} and ${formatOperatorCount(today.campaignsAwaitingApproval, "campaign approval", "campaign approvals")} are waiting for review.`,
              `${formatOperatorCount(summary.followUpsNeedingApproval, "follow-up")} és ${formatOperatorCount(today.campaignsAwaitingApproval, "campaign approval", "campaign approvals")} áttekintésre vár.`
            ))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">Outcome gaps</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(today.highValueWithoutOutcome, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy(
              `${formatOperatorCount(today.overdueHighValueContacts, "high-value contact")} still need a real result and ${formatOperatorCount(today.complaintRiskContacts, "complaint-risk contact")} remain in play.`,
              `${formatOperatorCount(today.overdueHighValueContacts, "high-value contact")} még valódi eredményt igényel, és ${formatOperatorCount(today.complaintRiskContacts, "complaint-risk contact")} továbbra is aktív.`
            ))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">Campaign replies</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(today.campaignReplies, "reply"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy(
              `${formatOperatorCount(today.campaignConversions, "conversion")} have been tied back to campaign work so far.`,
              `${formatOperatorCount(today.campaignConversions, "conversion")} kapcsolódott eddig kampánymunkához.`
            ))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">Lifecycle progression</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(today.contactsWithProgression, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy(
              `${today.lifecycleCounts.customer || 0} customers · ${today.lifecycleCounts.qualified || 0} qualified · ${today.lifecycleCounts.activeLead || 0} active leads`,
              `${today.lifecycleCounts.customer || 0} ügyfél · ${today.lifecycleCounts.qualified || 0} minősített · ${today.lifecycleCounts.activeLead || 0} aktív érdeklődő`
            ))}</p>
          </div>
        </div>
        <section class="workspace-card-soft today-support-card">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Proof</p>
              <h3 class="workspace-panel-title">Recent successful outcomes</h3>
              <p class="workspace-panel-copy">Outcome history stays available here without dominating Home.</p>
            </div>
          </div>
          ${Array.isArray(today.recentSuccessfulOutcomes) && today.recentSuccessfulOutcomes.length ? `
            <div class="analytics-list">
              ${today.recentSuccessfulOutcomes.map((outcome) => `
                <div class="analytics-item">
                  <p class="analytics-item-title">${escapeHtml(getOutcomeTypeLabel(outcome.outcomeType))}</p>
                  <p class="analytics-item-copy">${escapeHtml(trimText(outcome.pageUrl || outcome.successUrl || outcome.sourceLabel || "Cross-channel result"))}</p>
                  <p class="analytics-subtle">${escapeHtml([
                    trimText(outcome.sourceLabel),
                    trimText(outcome.relatedIntentType),
                    outcome.occurredAt ? formatSeenAt(outcome.occurredAt) : "",
                  ].filter(Boolean).join(" · "))}</p>
                </div>
              `).join("")}
            </div>
          ` : `<div class="placeholder-card">As soon as Vonza can prove bookings, quote requests, complaint resolutions, campaign replies, or follow-up results, they will appear here with source context.</div>`}
        </section>
        ${buildContactsAttentionStrip(operatorWorkspace)}
      `;

      return `
        <section class="today-command-section">
          ${buildDisclosureBlock({
            label: "Show supporting detail",
            summary: "Calendar, contacts, proof, and operational context",
            className: "today-support-disclosure",
            contentMarkup,
          })}
        </section>
      `;
    }

    function buildOperatorOverviewSection(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
      if (operatorWorkspace.enabled === false) {
        return "";
      }

      const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
      return localizeDashboardHtml(`
        <section class="workspace-card-soft operator-home-card">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Home</p>
              <h2 class="workspace-panel-title">Home</h2>
              <p class="workspace-panel-copy">Home is the daily command page: current-day signals, compact proposals, and the clearest recommendations only.</p>
            </div>
            <div class="workspace-badge-row">
              <span class="${getBadgeClass("Limited")}">Connected tools beta</span>
              <span class="${getBadgeClass(status.migrationRequired ? "Limited" : "Ready")}">${status.migrationRequired ? "Workspace still syncing" : "Workspace ready"}</span>
            </div>
          </div>
          ${buildTodaySummaryStats(operatorWorkspace)}
          ${buildTodayProposalSection(operatorWorkspace)}
          ${buildTodayRecommendationsSection(operatorWorkspace)}
          ${buildTodaySupportingDetailSection(operatorWorkspace)}
        </section>
      `);
    }

    function isAppointmentReviewQueueItem(item = {}) {
      return trimText(item.queueType) === "appointment_review";
    }

    function getOperatorContactDisplayLabel(contact = {}) {
      return trimText(
        contact.displayName
        || contact.name
        || contact.primaryEmail
        || contact.email
        || contact.primaryPhone
        || contact.phone
      );
    }

    function listAppointmentReviewContacts(reviewItem = {}, contacts = []) {
      const currentContactId = trimText(reviewItem.linkedContactId);
      const currentContactLabel = trimText(reviewItem.linkedContactName);
      const options = [];
      const seen = new Set();

      if (currentContactId) {
        options.push({
          id: currentContactId,
          label: currentContactLabel || "Linked contact",
        });
        seen.add(currentContactId);
      }

      (contacts || []).forEach((contact) => {
        const contactId = trimText(contact.id);
        const label = getOperatorContactDisplayLabel(contact);

        if (!contactId || !label || seen.has(contactId)) {
          return;
        }

        options.push({
          id: contactId,
          label,
        });
        seen.add(contactId);
      });

      return options.sort((left, right) => left.label.localeCompare(right.label));
    }

    function buildAppointmentReviewOutcomeOptions(selectedOutcome = "quote_requested") {
      const options = [
        { value: "quote_requested", label: "Quote requested" },
        { value: "follow_up_replied", label: "Follow-up replied" },
        { value: "booking_started", label: "Booking started" },
        { value: "booking_confirmed", label: "Booking confirmed" },
        { value: "complaint_resolved", label: "Complaint resolved" },
      ];

      return options.map((option) => `
        <option value="${escapeHtml(option.value)}" ${option.value === selectedOutcome ? "selected" : ""}>${escapeHtml(option.label)}</option>
      `).join("");
    }

    function buildTodayAppointmentQueueItem(reviewItem = {}) {
      return {
        ...reviewItem,
        queueType: "appointment_review",
        queueId: trimText(reviewItem.id),
      };
    }

    function buildTodayQueueItems(actionQueue = createEmptyActionQueue(), operatorWorkspace = createEmptyOperatorWorkspace()) {
      const reviewItems = Array.isArray(operatorWorkspace.calendar?.reviewItems)
        ? operatorWorkspace.calendar.reviewItems.map((item) => buildTodayAppointmentQueueItem(item))
        : [];
      const actionItems = Array.isArray(actionQueue.items)
        ? actionQueue.items.map((item) => ({
          ...item,
          queueType: "action_queue",
          queueId: trimText(item.key),
        }))
        : [];
      const seen = new Set();

      return reviewItems.concat(actionItems).filter((item) => {
        const queueKey = getTodayQueueItemKey(item);

        if (!queueKey || seen.has(queueKey)) {
          return false;
        }

        seen.add(queueKey);
        return true;
      });
    }

    function getTodayQueueFilterKeys(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        const keys = ["all", "needs_review"];
        if (!trimText(item.linkedContactId)) {
          keys.push("follow_up");
        } else {
          keys.push("follow_up");
        }
        return keys;
      }

      const keys = ["all"];
      const normalizedType = trimText(item.type).toLowerCase();
      const workflow = getActionQueueOwnerWorkflow(item);
      const status = normalizeActionQueueStatus(item.status);

      if (workflow.attention || status === "new") {
        keys.push("needs_review");
      }

      if (item.followUp || ["contact", "booking", "pricing", "repeat_high_intent"].includes(normalizedType)) {
        keys.push("follow_up");
      }

      if (item.knowledgeFix || normalizedType === "weak_answer") {
        keys.push("knowledge");
      }

      if (normalizedType === "support") {
        keys.push("complaints");
      }

      return keys;
    }

    function getTodayQueueRowPresentation(item = {}) {
      const title = isAppointmentReviewQueueItem(item)
        ? item.title || "Ended appointment"
        : item.label || getActionQueueTypeLabel(item.type);
      const normalizedType = trimText(item.type).toLowerCase();
      const normalizedContent = `${title} ${getTodayQueueItemWhyLabel(item)}`.toLowerCase();

      if (isAppointmentReviewQueueItem(item)) {
        return {
          tone: "slate",
          icon: "users",
          primaryLabel: "Confirm",
          secondaryLabel: "",
        };
      }

      if (normalizedContent.includes("proposal") || normalizedContent.includes("approval")) {
        return {
          tone: "warning",
          icon: "review",
          primaryLabel: "Approve",
          secondaryLabel: "Review",
        };
      }

      if (normalizedType === "support") {
        return {
          tone: "danger",
          icon: "ticket",
          primaryLabel: "View Ticket",
          secondaryLabel: "",
        };
      }

      if (normalizedType === "booking" || normalizedContent.includes("call") || normalizedContent.includes("no response")) {
        return {
          tone: "info",
          icon: "phone",
          primaryLabel: "Call Now",
          secondaryLabel: "",
        };
      }

      if (item.followUp || ["contact", "pricing", "repeat_high_intent"].includes(normalizedType) || normalizedContent.includes("follow up")) {
        return {
          tone: "brand",
          icon: "mail",
          primaryLabel: "Send Email",
          secondaryLabel: "",
        };
      }

      return {
        tone: "slate",
        icon: "review",
        primaryLabel: "Review",
        secondaryLabel: "",
      };
    }

    function buildTodayQueuePrimaryAction(item = {}) {
      const queueKey = getTodayQueueItemKey(item);
      const presentation = getTodayQueueRowPresentation(item);

      return `
        ${presentation.secondaryLabel ? `
          <button class="ghost-button today-row-secondary-action" type="button" data-today-open-review data-today-queue-key="${escapeHtml(queueKey)}">
            ${escapeHtml(presentation.secondaryLabel)}
          </button>
        ` : ""}
        <button class="primary-button today-row-primary-action" type="button" data-today-open-review data-today-queue-key="${escapeHtml(queueKey)}">
          ${escapeHtml(presentation.primaryLabel)}
        </button>
      `;
    }

    function getTodayQueueItemContactLabel(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return trimText(item.linkedContactName || item.attendeeLabel || "Unknown attendee");
      }

      return formatActionQueueContact(item);
    }

    function getTodayQueueItemContactId(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return trimText(item.appointmentReviewState?.contactId || item.linkedContactId);
      }

      return trimText(item.contactId || item.followUp?.contactId || item.knowledgeFix?.contactId);
    }

    function getTodayQueueItemLinkState(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return trimText(item.linkedContactId) ? "Linked" : "Unlinked";
      }

      return getTodayQueueItemContactLabel(item) === "Contact not captured yet" ? "Unlinked" : "Linked";
    }

    function getTodayQueueItemContextLabel(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return item.endAt ? `Ended ${formatSeenAt(item.endAt)}` : "Ended recently";
      }

      return item.lastSeenAt ? `Flagged ${formatSeenAt(item.lastSeenAt)}` : "Recent signal";
    }

    function getTodayQueueItemWhyLabel(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return normalizeShellCopy(trimText(item.reviewReason || item.followUpReason || item.unlinkedReason))
          || "This appointment ended recently and still needs a clear next step.";
      }

      return normalizeShellCopy(trimText(item.whyFlagged || item.snippet)) || "This stood out in recent customer activity.";
    }

    function getTodayQueueItemCopilotSummary(item = {}) {
      if (isAppointmentReviewQueueItem(item)) {
        return normalizeShellCopy(trimText(item.reviewWhyItMatters))
          || "This is worth reviewing so follow-up and results stay tied to the right person and conversation.";
      }

      const workflow = getActionQueueOwnerWorkflow(item);
      return normalizeShellCopy(trimText(item.suggestedAction || item.followUp?.whyPrepared || item.knowledgeFix?.whyPrepared || workflow.copy))
        || "Review the item and choose the most useful next step.";
    }

    function buildTodayQueueRow(
      item = {},
      activeQueueKey = "",
      operatorWorkspace = createEmptyOperatorWorkspace(),
    ) {
      const queueKey = getTodayQueueItemKey(item);
      const workflow = getActionQueueOwnerWorkflow(item);
      const filterKeys = getTodayQueueFilterKeys(item);
      const contactLabel = getTodayQueueItemContactLabel(item);
      const contactId = getTodayQueueItemContactId(item);
      const linkState = getTodayQueueItemLinkState(item);
      const reason = getTodayQueueItemWhyLabel(item);
      const presentation = getTodayQueueRowPresentation(item);
      const followUpTarget = !isAppointmentReviewQueueItem(item) && item.followUp?.id
        ? resolveVisibleShellTarget("automations", item.followUp.id, operatorWorkspace, {
          actionKey: item.key,
          contactId,
          analyticsFallbackLabel: "Review draft",
          contactFallbackLabel: "Open customer",
        })
        : null;
      const knowledgeFixTarget = !isAppointmentReviewQueueItem(item) && item.knowledgeFix?.id
        ? resolveVisibleShellTarget("analytics", item.key, operatorWorkspace, {
          label: "Open guidance fix",
          actionKey: item.key,
          contactId,
          analyticsFallbackLabel: "Open guidance fix",
          contactFallbackLabel: "Open customer",
        })
        : null;
      const linkedContactTarget = isAppointmentReviewQueueItem(item) && contactId
        ? resolveVisibleShellTarget("contacts", contactId, operatorWorkspace, {
          label: "Open linked contact",
          contactId,
          contactFallbackLabel: "Open linked contact",
        })
        : null;
      const metaLine = [
        getTodayQueueItemContextLabel(item),
        contactLabel,
        !isAppointmentReviewQueueItem(item) && trimText(item.followUp?.status)
          ? `Follow-up ${getFollowUpStatusLabel(item.followUp.status).toLowerCase()}`
          : "",
      ].filter(Boolean).join(" · ");
      const actionMenuMarkup = buildRowActionMenu(
        "More",
        [
          `<button class="ghost-button" type="button" data-today-open-review data-today-queue-key="${escapeHtml(queueKey)}">Open review drawer</button>`,
          !isAppointmentReviewQueueItem(item) && item.messageId
            ? `<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(item.messageId)}">Open conversation</button>`
            : "",
          followUpTarget
            ? followUpTarget.section === "automations"
              ? `<button class="ghost-button" type="button" data-open-follow-up data-follow-up-id="${escapeHtml(item.followUp.id)}">Open follow-up</button>`
              : `<button class="ghost-button" type="button" data-shell-target="${escapeHtml(followUpTarget.section)}" data-target-id="${escapeHtml(followUpTarget.id || "")}">${escapeHtml(followUpTarget.label || "Review draft")}</button>`
            : "",
          knowledgeFixTarget
            ? `<button class="ghost-button" type="button" data-shell-target="${escapeHtml(knowledgeFixTarget.section)}" data-target-id="${escapeHtml(knowledgeFixTarget.id || "")}">${escapeHtml(knowledgeFixTarget.label || "Open guidance fix")}</button>`
            : "",
          isAppointmentReviewQueueItem(item)
            ? linkedContactTarget
              ? `<button class="ghost-button" type="button" data-shell-target="${escapeHtml(linkedContactTarget.section)}" data-target-id="${escapeHtml(linkedContactTarget.id || "")}">${escapeHtml(linkedContactTarget.label || "Open linked contact")}</button>`
              : `<button class="ghost-button" type="button" data-shell-target="calendar">Open calendar</button>`
            : `<button class="ghost-button" type="button" data-shell-target="analytics">Open analytics</button>`,
        ].filter(Boolean).join("")
      );
      const title = isAppointmentReviewQueueItem(item)
        ? item.title || "Ended appointment"
        : item.label || getActionQueueTypeLabel(item.type);

      return `
        <article
          class="today-queue-row today-queue-row-tone-${escapeHtml(presentation.tone)} ${isAppointmentReviewQueueItem(item) ? "today-queue-row-appointment" : ""} ${queueKey === activeQueueKey ? "active" : ""}"
          data-today-queue-row
          data-today-queue-key="${escapeHtml(queueKey)}"
          data-today-queue-type="${escapeHtml(item.queueType || "")}"
          ${isAppointmentReviewQueueItem(item) ? `data-appointment-review-id="${escapeHtml(item.id || "")}"` : `data-action-key="${escapeHtml(item.key || "")}"`}
          data-today-filter-keys="${escapeHtml(filterKeys.join("|"))}"
          data-today-search-text="${escapeHtml([title, contactLabel, reason, linkState].filter(Boolean).join(" ").toLowerCase())}"
        >
          <div class="today-queue-row-indicator" aria-hidden="true">
            ${getUiIconMarkup(presentation.icon)}
          </div>
          <div class="today-queue-row-main">
            <div class="action-queue-badges">
              ${isAppointmentReviewQueueItem(item)
                ? `
                  <span class="pill">Ended appointment</span>
                  <span class="${getBadgeClass("Needs attention")}">Needs a look</span>
                  <span class="${getBadgeClass(linkState === "Linked" ? "Ready" : "Limited")}">${escapeHtml(linkState)}</span>
                `
                : `
                  <span class="pill">${escapeHtml(getOperatorActionTypeLabel(item))}</span>
                  <span class="${getActionQueueStatusBadgeClass(item.status)}">${escapeHtml(getActionQueueStatusLabel(item.status))}</span>
                  <span class="${getActionQueueOwnerWorkflowBadgeClass(item)}">${escapeHtml(workflow.label)}</span>
                `}
            </div>
            <h3 class="today-queue-row-title">${escapeHtml(title)}</h3>
            <p class="today-queue-row-copy">${escapeHtml(reason)}</p>
            <p class="today-queue-row-meta">${escapeHtml(metaLine)}</p>
          </div>
          <div class="today-queue-row-actions">
            ${buildTodayQueuePrimaryAction(item)}
            ${actionMenuMarkup}
          </div>
        </article>
      `;
    }

    function buildTodayReviewDrawerActions(item = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
      if (isAppointmentReviewQueueItem(item)) {
        const selectedContactId = trimText(item.appointmentReviewState?.contactId || item.linkedContactId);
        const contactOptions = listAppointmentReviewContacts(item, Array.isArray(item.contacts) ? item.contacts : []);
        const hasFollowUpTarget = Boolean(
          trimText(item.linkedContactEmail)
          || trimText(item.linkedContactPhone)
          || trimText((Array.isArray(item.attendeeEmails) ? item.attendeeEmails[0] : ""))
          || selectedContactId
        );

        return `
          <div class="today-review-drawer-divider"></div>
          <div class="appointment-review-field-grid">
            <div class="field">
              <label>Link contact</label>
              <select name="contact_id" data-appointment-review-contact>
                <option value="">${escapeHtml(contactOptions.length ? "Choose a contact" : "No contact available yet")}</option>
                ${contactOptions.map((option) => `
                  <option value="${escapeHtml(option.id)}" ${option.id === selectedContactId ? "selected" : ""}>${escapeHtml(option.label)}</option>
                `).join("")}
              </select>
            </div>
            <div class="field">
              <label>Record outcome</label>
              <select name="outcome_type" data-appointment-review-outcome>
                ${buildAppointmentReviewOutcomeOptions(trimText(item.appointmentReviewState?.outcomeType) || "quote_requested")}
              </select>
            </div>
          </div>
          <div class="field">
            <label>Owner note</label>
            <textarea rows="3" data-appointment-review-note placeholder="Add a short note if future review context will matter.">${escapeHtml(item.appointmentReviewState?.note || "")}</textarea>
          </div>
          <div class="today-review-drawer-actions">
            <button class="primary-button" type="button" data-appointment-review-action="prepare_follow_up" data-event-id="${escapeHtml(item.id || "")}" ${hasFollowUpTarget ? "" : "disabled"}>Prepare follow-up</button>
            <button class="ghost-button" type="button" data-appointment-review-action="link_contact" data-event-id="${escapeHtml(item.id || "")}" ${contactOptions.length ? "" : "disabled"}>Link contact</button>
            <button class="ghost-button" type="button" data-appointment-review-action="record_outcome" data-event-id="${escapeHtml(item.id || "")}">Record outcome</button>
            <button class="ghost-button" type="button" data-appointment-review-action="no_action_needed" data-event-id="${escapeHtml(item.id || "")}">No action needed</button>
          </div>
        `;
      }

      const contactId = getTodayQueueItemContactId(item);
      const followUpTarget = item.followUp?.id
        ? resolveVisibleShellTarget("automations", item.followUp.id, operatorWorkspace, {
          actionKey: item.key,
          contactId,
          analyticsFallbackLabel: "Review draft",
          contactFallbackLabel: "Open customer",
        })
        : null;
      const knowledgeFixTarget = item.knowledgeFix?.id
        ? resolveVisibleShellTarget("analytics", item.key, operatorWorkspace, {
          label: "Review fix",
          actionKey: item.key,
          contactId,
          analyticsFallbackLabel: "Review fix",
          contactFallbackLabel: "Open customer",
        })
        : null;
      const contactTarget = getTodayQueueItemLinkState(item) === "Linked"
        ? resolveVisibleShellTarget("contacts", contactId, operatorWorkspace, {
          label: "Open customer",
          contactId,
          contactFallbackLabel: "Open customer",
        })
        : null;
      const actionButtons = [
        followUpTarget
          ? followUpTarget.section === "automations"
            ? `<button class="primary-button" type="button" data-open-follow-up data-follow-up-id="${escapeHtml(item.followUp.id)}">Review draft</button>`
            : `<button class="primary-button" type="button" data-shell-target="${escapeHtml(followUpTarget.section)}" data-target-id="${escapeHtml(followUpTarget.id || "")}">${escapeHtml(followUpTarget.label || "Review draft")}</button>`
          : "",
        knowledgeFixTarget
          ? `<button class="ghost-button" type="button" data-shell-target="${escapeHtml(knowledgeFixTarget.section)}" data-target-id="${escapeHtml(knowledgeFixTarget.id || "")}">${escapeHtml(knowledgeFixTarget.label || "Review fix")}</button>`
          : "",
        item.messageId
          ? `<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(item.messageId)}">Review thread</button>`
          : "",
        contactTarget
          ? `<button class="ghost-button" type="button" data-shell-target="${escapeHtml(contactTarget.section)}" data-target-id="${escapeHtml(contactTarget.id || "")}">${escapeHtml(contactTarget.label || "Open customer")}</button>`
          : "",
      ].filter(Boolean).join("");

      return `
        <div class="today-review-drawer-divider"></div>
        ${actionButtons ? `<div class="today-review-drawer-actions">${actionButtons}</div>` : ""}
        <div class="today-review-status-actions">
          <button class="ghost-button" type="button" data-today-queue-status-action data-next-status="reviewed" data-action-key="${escapeHtml(item.key || "")}">Mark reviewed</button>
          <button class="primary-button" type="button" data-today-queue-status-action data-next-status="done" data-action-key="${escapeHtml(item.key || "")}">Mark done</button>
          <button class="ghost-button" type="button" data-today-queue-status-action data-next-status="dismissed" data-action-key="${escapeHtml(item.key || "")}">Dismiss</button>
        </div>
      `;
    }

    function buildTodayReviewPanel(
      item = {},
      activeQueueKey = "",
      contacts = [],
      operatorWorkspace = createEmptyOperatorWorkspace(),
      options = {},
    ) {
      const inline = options.inline === true;
      const queueKey = getTodayQueueItemKey(item);
      const contactLabel = getTodayQueueItemContactLabel(item);
      const linkState = getTodayQueueItemLinkState(item);
      const workflow = getActionQueueOwnerWorkflow(item);
      const title = isAppointmentReviewQueueItem(item)
        ? item.title || "Ended appointment"
        : item.label || getActionQueueTypeLabel(item.type);
      const contextTitle = isAppointmentReviewQueueItem(item) ? "Appointment follow-up" : "Home item";
      const statusBadges = isAppointmentReviewQueueItem(item)
        ? `
          <span class="pill">Ended appointment</span>
          <span class="${getBadgeClass("Needs attention")}">Needs a look</span>
          <span class="${getBadgeClass(linkState === "Linked" ? "Ready" : "Limited")}">${escapeHtml(linkState)}</span>
        `
        : `
          <span class="pill">${escapeHtml(getOperatorActionTypeLabel(item))}</span>
          <span class="${getActionQueueStatusBadgeClass(item.status)}">${escapeHtml(getActionQueueStatusLabel(item.status))}</span>
          <span class="${getActionQueueOwnerWorkflowBadgeClass(item)}">${escapeHtml(workflow.label)}</span>
        `;
      const eventContext = isAppointmentReviewQueueItem(item)
        ? [
          getTodayQueueItemContextLabel(item),
          trimText(item.attendeeLabel),
          trimText(item.reviewType || ""),
        ].filter(Boolean).join(" · ")
        : [
          getTodayQueueItemContextLabel(item),
          trimText(item.person?.label),
          trimText(item.followUp?.status) ? `Follow-up ${getFollowUpStatusLabel(item.followUp.status).toLowerCase()}` : "",
        ].filter(Boolean).join(" · ");
      const linkStateCopy = isAppointmentReviewQueueItem(item)
        ? (linkState === "Linked" ? "This appointment is already connected to the right contact." : "This appointment still needs to be matched to the right contact.")
        : (linkState === "Linked" ? "There is enough contact detail here to keep the next step grounded." : "This item would be easier to act on with stronger contact detail.");

      return `
        <article class="today-review-panel ${inline || queueKey === activeQueueKey ? "active" : ""}" data-today-review-panel-item data-today-inline-card="${inline ? "true" : "false"}" data-today-queue-key="${escapeHtml(queueKey)}" ${inline || queueKey === activeQueueKey ? "" : "hidden"}>
          <div class="today-review-panel-top">
            <div>
              <p class="support-panel-kicker">${escapeHtml(contextTitle)}</p>
              <h3 class="today-review-panel-title">${escapeHtml(title)}</h3>
            </div>
            ${inline ? "" : `<button class="ghost-button today-review-close" type="button" data-today-review-close>Close</button>`}
          </div>
          <div class="action-queue-badges">
            ${statusBadges}
          </div>
          <div class="today-review-detail-list">
            <div class="today-review-detail-row">
              <span class="today-review-detail-label">Attendee / contact</span>
              <strong class="today-review-detail-value">${escapeHtml(contactLabel)}</strong>
            </div>
            <div class="today-review-detail-row">
              <span class="today-review-detail-label">Event timing or context</span>
              <strong class="today-review-detail-value">${escapeHtml(eventContext || "Context is still loading.")}</strong>
            </div>
            <div class="today-review-detail-row">
              <span class="today-review-detail-label">Suggested next move</span>
              <strong class="today-review-detail-value">${escapeHtml(getTodayQueueItemCopilotSummary(item))}</strong>
            </div>
          </div>
          ${buildDisclosureBlock({
            label: "View details",
            summary: linkState,
            className: "disclosure-block-inline",
            contentMarkup: buildDisclosureDetailRows([
              { label: "Contact match", value: linkState, copy: linkStateCopy },
              { label: "Why it matters", value: getTodayQueueItemWhyLabel(item) },
              { label: "Workflow status", value: isAppointmentReviewQueueItem(item) ? "Appointment review" : workflow.label, copy: isAppointmentReviewQueueItem(item) ? "Keep follow-up and outcomes tied to the right person." : workflow.copy },
            ], { className: "today-review-detail-list disclosure-detail-list" }),
          })}
          ${isAppointmentReviewQueueItem(item)
            ? buildTodayReviewDrawerActions({
              ...item,
              contacts,
            }, operatorWorkspace)
            : buildTodayReviewDrawerActions(item, operatorWorkspace)}
        </article>
      `;
    }

    function buildTodayAttentionList(
      items = [],
      contacts = [],
      operatorWorkspace = createEmptyOperatorWorkspace(),
    ) {
      if (!items.length) {
        return buildOperatorEmptyState({
          title: "You’re caught up for now",
          copy: "Nothing urgent is waiting right now. New follow-ups, missed opportunities, and review items will show up here when they matter.",
        });
      }

      return `
        <section class="today-command-section">
          <div class="workspace-panel-header">
            <div>
              <p class="studio-kicker">Attention now</p>
              <h3 class="workspace-panel-title">Clear next steps, without the old queue drawer</h3>
              <p class="workspace-panel-copy">Each item stays grounded in the real source record and only appears once.</p>
            </div>
          </div>
          <div class="today-review-panel-stack">
            ${items.map((item) => buildTodayReviewPanel(
              item,
              getTodayQueueItemKey(item),
              contacts,
              operatorWorkspace,
              { inline: true }
            )).join("")}
          </div>
        </section>
      `;
    }

    function buildTodayReviewDrawer(
      items = [],
      activeQueueKey = "",
      contacts = [],
      briefing = {},
      operatorWorkspace = createEmptyOperatorWorkspace(),
    ) {
      if (!items.length) {
        return `
          <section class="today-review-drawer-shell">
            <div class="today-review-drawer-frame">
              <div class="today-review-empty">
                <p class="support-panel-kicker">Review drawer</p>
                <h3 class="today-review-panel-title">You’re all caught up</h3>
                <p class="support-panel-copy">${escapeHtml(briefing.text || "Select a Home item and its context, notes, and next step will stay here while you work.")}</p>
              </div>
            </div>
          </section>
        `;
      }

      return `
        <div class="today-review-drawer-backdrop" data-today-review-backdrop></div>
        <section class="today-review-drawer-shell" data-today-review-drawer>
          <div class="today-review-drawer-frame">
            <div class="today-review-drawer-header">
              <div>
                <p class="support-panel-kicker">Review drawer</p>
                <h3 class="today-review-panel-title">Stay in Home while you work through what matters.</h3>
                <p class="support-panel-copy">Select any item to review the next move. Extra reasoning and workflow context stay tucked behind details.</p>
              </div>
            </div>
            <div class="today-review-panel-stack">
              ${items.map((item) => buildTodayReviewPanel(item, activeQueueKey, contacts, operatorWorkspace)).join("")}
            </div>
          </div>
        </section>
      `;
    }

    function buildTodayQueueList(items = [], actionQueue = createEmptyActionQueue(), operatorWorkspace = createEmptyOperatorWorkspace(), activeQueueKey = "") {
      const summary = {
        ...createEmptyActionQueue().summary,
        ...(actionQueue.summary || {}),
      };

      if (!items.length) {
        return buildOperatorEmptyState({
          title: "You’re caught up for now",
          copy: "Nothing urgent is waiting right now. New follow-ups, missed opportunities, and review items will show up here when they matter.",
        });
      }

      return `
        <section class="today-queue-shell">
          <div class="today-queue-summary">
            ${buildActionQueueSummaryPills(summary).map((label) => `
              <span class="pill">${escapeHtml(label)}</span>
            `).join("")}
            ${Array.isArray(operatorWorkspace.calendar?.reviewItems) && operatorWorkspace.calendar.reviewItems.length
              ? `<span class="pill">${escapeHtml(`${operatorWorkspace.calendar.reviewItems.length} ended appointment${operatorWorkspace.calendar.reviewItems.length === 1 ? "" : "s"} to review`)}</span>`
              : ""}
          </div>
          <div class="today-queue-list">
            ${items.map((item) => buildTodayQueueRow(item, activeQueueKey, operatorWorkspace)).join("")}
          </div>
        </section>
      `;
    }

    return Object.freeze({
      getTodayQueueItemKey,
      buildTodayCopilotSection,
      getTodayRecommendationCategory,
      getRecommendationSignalText,
      hasRecommendationSignal,
      getBusinessPriorityCopy,
      buildTodaySummaryStats,
      buildTodayProposalSection,
      buildTodayRecommendationsSection,
      formatCalendarInsightContext,
      buildTodayInsightActionButton,
      buildTodayInsightCard,
      buildTodaySupportingDetailSection,
      buildOperatorOverviewSection,
      isAppointmentReviewQueueItem,
      getOperatorContactDisplayLabel,
      listAppointmentReviewContacts,
      buildAppointmentReviewOutcomeOptions,
      buildTodayAppointmentQueueItem,
      buildTodayQueueItems,
      getTodayQueueFilterKeys,
      getTodayQueueRowPresentation,
      buildTodayQueuePrimaryAction,
      getTodayQueueItemContactLabel,
      getTodayQueueItemContactId,
      getTodayQueueItemLinkState,
      getTodayQueueItemContextLabel,
      getTodayQueueItemWhyLabel,
      getTodayQueueItemCopilotSummary,
      buildTodayQueueRow,
      buildTodayReviewDrawerActions,
      buildTodayReviewPanel,
      buildTodayAttentionList,
      buildTodayReviewDrawer,
      buildTodayQueueList,
    });
  }

  global.VonzaDashboardToday = Object.freeze({
    createTodayHelpers,
  });
})(window);
