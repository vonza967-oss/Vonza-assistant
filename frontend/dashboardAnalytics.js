(function registerVonzaDashboardAnalytics(global) {
  const SOURCE_LABELS = Object.freeze({
    widget: "Website widget",
    page: "Front Desk page",
    embedded: "Embedded assistant",
    unknown: "Legacy/unknown",
  });

  const SOURCE_DESCRIPTIONS = Object.freeze({
    widget: "Customer conversations started from the optional website widget.",
    page: "Customer conversations started from the full-page AI Front Desk.",
    embedded: "Customer conversations started from an embedded assistant surface.",
    unknown: "Older activity without a reliable source label.",
  });

  const TEXT_FALLBACKS = Object.freeze({
    "analytics.totalConversations": "Total conversations",
    "analytics.liveCustomerConversations": "Live customer conversations",
    "analytics.aiHandled": "AI handled",
    "analytics.handledWithoutTeamReply": "handled without team reply",
    "analytics.humanFollowUps": "Human follow-ups",
    "analytics.needsOwnerAttention": "Needs or received owner attention",
    "analytics.leadsCaptured": "Leads captured",
    "analytics.capturedFromRealCustomerSignals": "Captured from real customer signals",
    "analytics.fullPageActivity": "Front Desk page activity",
    "analytics.fullPageConversationsRecorded": "Front Desk page conversations recorded",
    "analytics.conversationsOverTime": "Conversations over time",
    "analytics.totalConversationLabel": "Total conversations",
    "analytics.liveCurrentWorkspace": "Live activity from the current workspace",
    "analytics.daily": "Daily",
    "analytics.entrySourceBreakdown": "Entry point / source breakdown",
    "analytics.total": "Total",
    "analytics.topCustomerQuestions": "Top customer questions",
    "analytics.viewAll": "View all",
    "analytics.noRepeatedQuestions": "No repeated customer questions are standing out yet.",
    "analytics.conversationsByHour": "Conversations by hour",
    "analytics.low": "Low",
    "analytics.high": "High",
    "analytics.aiVsHumanHandling": "AI vs Human handling",
    "analytics.conversionRate": "Conversion rate",
    "analytics.basedOnCapturedLeads": "Based on captured leads and assisted outcomes",
    "analytics.estimatedTimeSaved": "Estimated time saved",
    "analytics.estimatedFromAiHandled": "Estimated from AI-handled customer questions",
    "analytics.talkingTo": "Who Vonza is talking to",
    "analytics.guestUsers": "Guest users",
    "analytics.identifiedUsers": "Identified users",
    "analytics.emailUsers": "Email users",
    "analytics.performanceBySource": "Performance by source",
    "analytics.source": "Source",
    "analytics.visits": "Visits",
    "analytics.conversations": "Conversations",
    "analytics.leads": "Leads",
    "analytics.notTracked": "Not tracked",
    "analytics.instant": "Instant",
    "analytics.avgFirstResponse": "Avg. time to first response",
  });

  function trimText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeAnalyticsSource(value) {
    const normalized = trimText(value).toLowerCase().replace(/[\s-]+/g, "_");

    if (["widget", "website_widget", "widget_chat", "chat_widget"].includes(normalized)) {
      return "widget";
    }

    if (["page", "front_desk_page", "full_page", "full_page_assistant", "assistant_page", "hosted_page"].includes(normalized)) {
      return "page";
    }

    if (["embedded", "embedded_assistant", "assistant_embed", "smart_embed", "embed"].includes(normalized)) {
      return "embedded";
    }

    return "unknown";
  }

  function getAnalyticsSourceLabel(value) {
    return SOURCE_LABELS[normalizeAnalyticsSource(value)] || SOURCE_LABELS.unknown;
  }

  function getAnalyticsSourceDescription(value) {
    return SOURCE_DESCRIPTIONS[normalizeAnalyticsSource(value)] || SOURCE_DESCRIPTIONS.unknown;
  }

  function formatMetricValue(value) {
    return new Intl.NumberFormat("en-US").format(Math.round(Number(value || 0)));
  }

  function formatMetricDelta(value) {
    const numeric = Number(value || 0);

    if (!Number.isFinite(numeric) || numeric === 0) {
      return "0%";
    }

    const prefix = numeric > 0 ? "+" : "";
    return `${prefix}${numeric.toFixed(1).replace(/\.0$/, "")}%`;
  }

  function formatMetricPercent(value) {
    return `${Math.round(Number(value || 0))}%`;
  }

  function formatMetricDecimalPercent(value) {
    const numeric = Number(value || 0);

    if (!Number.isFinite(numeric)) {
      return "0%";
    }

    return `${numeric.toFixed(1).replace(/\.0$/, "")}%`;
  }

  function formatMetricHours(value) {
    const numeric = Number(value || 0);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "0";
    }

    if (numeric >= 10) {
      return String(Math.round(numeric));
    }

    return numeric.toFixed(1).replace(/\.0$/, "");
  }

  function formatConversationCount(value) {
    const count = Number(value || 0);
    return `${formatMetricValue(count)} conversation${count === 1 ? "" : "s"}`;
  }

  function formatMessageCount(value) {
    const count = Number(value || 0);
    return `${formatMetricValue(count)} message${count === 1 ? "" : "s"}`;
  }

  function formatLeadCount(value) {
    const count = Number(value || 0);
    return `${formatMetricValue(count)} lead${count === 1 ? "" : "s"}`;
  }

  function normalizeSourceBucket(bucket = {}, fallback = {}) {
    const source = bucket && typeof bucket === "object" ? bucket : {};
    const key = normalizeAnalyticsSource(source.key || fallback.key);

    return {
      ...fallback,
      ...source,
      key,
      label: getAnalyticsSourceLabel(source.key || fallback.key || source.label),
      conversationCount: Number(source.conversationCount || 0),
      messageCount: Number(source.messageCount || 0),
      visitorQuestionCount: Number(source.visitorQuestionCount || 0),
      leadsCaptured: Number(source.leadsCaptured || 0),
    };
  }

  function buildAssistantSourceRows(sourceBreakdown = {}) {
    const source = sourceBreakdown && typeof sourceBreakdown === "object" ? sourceBreakdown : {};
    const baseRows = [
      {
        ...normalizeSourceBucket(source.widget, { key: "widget" }),
        icon: "window",
        tone: "teal",
        color: "teal",
        visits: "",
      },
      {
        ...normalizeSourceBucket(source.page, { key: "page" }),
        icon: "window",
        tone: "blue",
        color: "blue",
        visits: "",
      },
    ];
    const embedded = normalizeSourceBucket(source.embedded, { key: "embedded" });
    const unknown = normalizeSourceBucket(source.unknown, { key: "unknown" });

    if (embedded.conversationCount > 0 || embedded.messageCount > 0 || embedded.leadsCaptured > 0) {
      baseRows.push({
        ...embedded,
        icon: "code",
        tone: "teal",
        color: "soft-blue",
        visits: "",
      });
    }

    if (unknown.conversationCount > 0 || unknown.messageCount > 0 || unknown.leadsCaptured > 0) {
      baseRows.push({
        ...unknown,
        icon: "link",
        tone: "blue",
        color: "gray",
        visits: "Legacy",
      });
    }

    return baseRows;
  }

  function createRenderContext(options = {}) {
    const translate = typeof options.t === "function"
      ? options.t
      : (key) => TEXT_FALLBACKS[key] || key;
    const renderIcon = typeof options.renderIcon === "function"
      ? options.renderIcon
      : () => "";
    const renderIconBadge = typeof options.renderIconBadge === "function"
      ? options.renderIconBadge
      : (_icon, tone = "blue") => `<span class="v2-icon-badge ${escapeHtml(tone)}"></span>`;
    const renderButton = typeof options.renderButton === "function"
      ? options.renderButton
      : (label) => `<button class="v2-button" type="button">${escapeHtml(label)}</button>`;

    return {
      t: translate,
      renderIcon,
      renderIconBadge,
      renderButton,
    };
  }

  function buildMetricCards(report = {}, sourceRows = [], options = {}) {
    const context = createRenderContext(options);
    const humanFollowUps = Math.max(0, Number(report.conversationCount || 0) - Number(report.autonomousHandledCount || 0));
    const fullPageRow = sourceRows.find((row) => row.key === "page") || {};

    return [
      { label: context.t("analytics.totalConversations"), value: formatMetricValue(report.conversationCount), compare: context.t("analytics.liveCustomerConversations"), icon: "chat", tone: "blue" },
      { label: context.t("analytics.aiHandled"), value: formatMetricPercent(report.autonomousHandledRate), compare: `${formatMetricValue(report.autonomousHandledCount)} ${context.t("analytics.handledWithoutTeamReply")}`, icon: "sparkle", tone: "teal" },
      { label: context.t("analytics.humanFollowUps"), value: formatMetricValue(humanFollowUps), compare: context.t("analytics.needsOwnerAttention"), icon: "user", tone: humanFollowUps > 0 ? "blue" : "green", down: humanFollowUps === 0 },
      { label: context.t("analytics.leadsCaptured"), value: formatMetricValue(report.contactsCaptured), compare: context.t("analytics.capturedFromRealCustomerSignals"), icon: "users", tone: "green" },
      { label: context.t("analytics.fullPageActivity"), value: formatMetricValue(fullPageRow.conversationCount || 0), compare: context.t("analytics.fullPageConversationsRecorded"), icon: "window", tone: "blue" },
    ];
  }

  function renderMetricCard(metric = {}, options = {}) {
    const context = createRenderContext(options);
    const trendClass = metric.down ? "v2-trend-down" : "v2-trend-up";
    const trendIcon = metric.down ? "arrowDown" : "arrowUp";

    return `
    <article class="v2-metric-card">
      <div class="v2-metric-top">
        <div class="v2-metric-label">
          ${context.renderIconBadge(metric.icon || "review", metric.tone || "blue")}
          <span>${escapeHtml(metric.label || "")}</span>
        </div>
        <span class="v2-info-dot">i</span>
      </div>
      <div class="v2-metric-value">${escapeHtml(metric.value || "0")}</div>
      <div class="v2-metric-change">
        ${metric.change ? `<span class="${trendClass}">${context.renderIcon(trendIcon)} ${escapeHtml(metric.change)}</span>` : ""}
        <span>${escapeHtml(metric.compare || "Live workspace data")}</span>
      </div>
    </article>
  `;
  }

  function renderAssistantSourceCard(sourceRows = [], totalConversations = 0, options = {}) {
    const context = createRenderContext(options);
    const total = Math.max(Number(totalConversations || 0), sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0));
    const trackedRows = sourceRows.filter((row) => !row.unavailable || Number(row.conversationCount || 0) > 0 || Number(row.messageCount || 0) > 0);

    return `
    <article class="v2-card v2-analytics-source-card">
      <div class="v2-section-header">
        <h2 class="v2-section-title">${escapeHtml(context.t("analytics.entrySourceBreakdown"))}</h2>
      </div>
      <div class="v2-donut-layout">
        <div class="v2-donut" aria-hidden="true"></div>
        <div class="v2-donut-legend">
          ${trackedRows.map((row) => {
            const percent = total > 0 ? Math.round((Number(row.conversationCount || 0) / total) * 100) : 0;
            return `
              <div class="v2-legend-row">
                <span class="v2-legend-color ${escapeHtml(row.color || "gray")}"></span>
                <span>${escapeHtml(row.label)}</span>
                <strong>${escapeHtml(`${percent}%`)}</strong>
                <span class="v2-subtext">${escapeHtml(formatMetricValue(row.conversationCount))}</span>
              </div>
            `;
          }).join("")}
          <div class="v2-legend-row v2-legend-total">
            <span></span><strong>${escapeHtml(context.t("analytics.total"))}</strong><strong></strong><strong>${escapeHtml(formatMetricValue(total))}</strong>
          </div>
        </div>
      </div>
    </article>
  `;
  }

  function buildLineChartPath(values = [], width = 680, _height = 180) {
    const paddingX = 50;
    const top = 25;
    const bottom = 154;
    const maxValue = Math.max(...values, 1);

    return values.map((value, index) => {
      const x = paddingX + ((width - paddingX - 30) * index) / Math.max(values.length - 1, 1);
      const y = bottom - ((bottom - top) * Number(value || 0)) / maxValue;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }

  function renderLineChart(series = {}, options = {}) {
    const context = createRenderContext(options);
    const values = Array.isArray(series.values) && series.values.length ? series.values : [0, 0, 0, 0, 0, 0, 0];
    const labels = Array.isArray(series.labels) && series.labels.length ? series.labels : [];
    const width = 680;
    const paddingX = 50;
    const bottom = 154;
    const maxValue = Math.max(...values, 1);
    const linePath = buildLineChartPath(values, width);
    const startX = paddingX;
    const endX = width - 30;
    const fillPath = `${linePath} L${endX} ${bottom} L${startX} ${bottom} Z`;
    const labelIndexes = [0, Math.floor(values.length * 0.25), Math.floor(values.length * 0.5), Math.floor(values.length * 0.75), values.length - 1]
      .filter((index, position, indexes) => index >= 0 && indexes.indexOf(index) === position);

    return `
    <svg class="v2-line-chart" viewBox="0 0 ${width} 180" role="img" aria-label="${escapeHtml(context.t("analytics.conversationsOverTime"))} line chart">
      <defs>
        <linearGradient id="v2LineGradientProduction" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#0ea99b" stop-opacity="0.22"></stop>
          <stop offset="1" stop-color="#0ea99b" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path class="v2-chart-gridline" d="M50 25H650M50 68H650M50 111H650M50 154H650"></path>
      <path class="v2-chart-fill" d="${escapeHtml(fillPath)}"></path>
      <path class="v2-chart-line" d="${escapeHtml(linePath)}"></path>
      <text class="v2-axis-label" x="18" y="158">0</text>
      <text class="v2-axis-label" x="14" y="115">${escapeHtml(formatMetricValue(Math.ceil(maxValue / 2)))}</text>
      <text class="v2-axis-label" x="8" y="72">${escapeHtml(formatMetricValue(maxValue))}</text>
      ${labelIndexes.map((index) => {
        const x = paddingX + ((width - paddingX - 30) * index) / Math.max(values.length - 1, 1);
        return `<text class="v2-axis-label" x="${escapeHtml(x.toFixed(0))}" y="176">${escapeHtml(labels[index] || "")}</text>`;
      }).join("")}
    </svg>
  `;
  }

  function renderTopQuestionsList(topQuestionItems = [], options = {}) {
    const context = createRenderContext(options);
    const maxCount = Math.max(...topQuestionItems.map((item) => Number(item.count || 0)), 1);

    return `
    <article class="v2-card v2-analytics-top-questions-card">
      <div class="v2-section-header">
        <h2 class="v2-section-title">${escapeHtml(context.t("analytics.topCustomerQuestions"))}</h2>
        ${context.renderButton(context.t("analytics.viewAll"), "")}
      </div>
      ${topQuestionItems.length ? `
        <div class="v2-list">
          ${topQuestionItems.map((item) => {
            const count = Number(item.count || 0);
            const width = Math.max(8, Math.round((count / maxCount) * 100));
            return `
              <div class="v2-question-row">
                <div class="v2-row-title">${escapeHtml(item.label || "Customer question")}</div>
                <div class="v2-bar-track"><span class="v2-bar-fill" style="--v2-bar:${escapeHtml(String(width))}%"></span></div>
                <div class="v2-row-meta">${escapeHtml(formatMetricValue(count))}</div>
              </div>
            `;
          }).join("")}
        </div>
      ` : renderAnalyticsEmptyState(context.t("analytics.noRepeatedQuestions"))}
    </article>
  `;
  }

  function renderRecentAnalyticsActivity(activityItems = []) {
    const items = Array.isArray(activityItems) ? activityItems : [];

    if (!items.length) {
      return renderAnalyticsEmptyState("No recent analytics activity yet.");
    }

    return `
    <div class="analytics-list">
      ${items.map((item) => `
        <div class="analytics-item">
          <p class="analytics-item-title">${escapeHtml(item.title || item.label || "Recent activity")}</p>
          <p class="analytics-item-copy">${escapeHtml(item.copy || item.summary || "")}</p>
          ${item.meta ? `<p class="analytics-subtle">${escapeHtml(item.meta)}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
  }

  function renderAnalyticsEmptyState(copy = "No analytics data yet.") {
    return `<div class="placeholder-card">${escapeHtml(copy)}</div>`;
  }

  function renderHeatmap(userMessages = [], options = {}) {
    const context = createRenderContext(options);
    const times = [
      { label: "12am", start: 0, end: 3 },
      { label: "4am", start: 4, end: 7 },
      { label: "8am", start: 8, end: 11 },
      { label: "12pm", start: 12, end: 15 },
      { label: "4pm", start: 16, end: 19 },
      { label: "8pm", start: 20, end: 23 },
    ];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const buckets = times.map(() => days.map(() => 0));

    userMessages.forEach((message) => {
      const date = new Date(message.createdAt || message.created_at || "");

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const hour = date.getHours();
      const rowIndex = times.findIndex((time) => hour >= time.start && hour <= time.end);
      const dayIndex = (date.getDay() + 6) % 7;

      if (rowIndex >= 0) {
        buckets[rowIndex][dayIndex] += 1;
      }
    });

    const max = Math.max(...buckets.flat(), 1);
    const colors = ["#e8f0ff", "#cfe0ff", "#9ec1ff", "#5d94f5", "#2563eb", "#0a3f94"];
    const cells = times.map((time, rowIndex) => {
      const rowCells = days.map((_day, dayIndex) => {
        const intensity = Math.ceil((buckets[rowIndex][dayIndex] / max) * (colors.length - 1));
        return `<span class="v2-heat-cell" style="--heat:${escapeHtml(colors[Math.max(0, intensity)])}"></span>`;
      }).join("");
      return `<span class="v2-heatmap-label">${escapeHtml(time.label)}</span>${rowCells}`;
    }).join("");

    return `
    <article class="v2-card v2-analytics-heatmap-card">
      <div class="v2-section-header">
        <h2 class="v2-section-title">${escapeHtml(context.t("analytics.conversationsByHour"))}</h2>
        <span class="v2-info-dot">i</span>
      </div>
      <div class="v2-heatmap">
        <span></span>
        ${days.map((day) => `<span class="v2-heatmap-day">${escapeHtml(day)}</span>`).join("")}
        ${cells}
      </div>
      <div class="v2-heatmap-key">
        <span>${escapeHtml(context.t("analytics.low"))}</span>
        ${colors.map((color) => `<span class="v2-heat-key-box" style="--heat:${escapeHtml(color)}"></span>`).join("")}
        <span>${escapeHtml(context.t("analytics.high"))}</span>
      </div>
    </article>
  `;
  }

  function renderHandlingCard(report = {}, options = {}) {
    const context = createRenderContext(options);
    const rate = Math.max(0, Math.min(100, Number(report.autonomousHandledRate || 0)));
    const handled = Number(report.autonomousHandledCount || 0);
    const human = Math.max(0, Number(report.conversationCount || 0) - handled);
    const dashOffset = 236 - (236 * rate) / 100;

    return `
    <article class="v2-card v2-analytics-handling-card">
      <div class="v2-section-header">
        <h2 class="v2-section-title">${escapeHtml(context.t("analytics.aiVsHumanHandling"))}</h2>
      </div>
      <div class="v2-gauge">
        <svg viewBox="0 0 220 140" aria-label="${escapeHtml(context.t("analytics.aiHandled"))} ${escapeHtml(String(rate))} percent">
          <path class="v2-gauge-base" d="M35 112A75 75 0 0 1 185 112"></path>
          <path class="v2-gauge-value" d="M35 112A75 75 0 0 1 185 112" style="stroke-dasharray:236; stroke-dashoffset:${escapeHtml(dashOffset.toFixed(2))}"></path>
          <text class="v2-gauge-text" x="110" y="103">${escapeHtml(`${rate}%`)}</text>
          <text class="v2-gauge-sub" x="110" y="124">${escapeHtml(context.t("analytics.aiHandled"))}</text>
        </svg>
      </div>
      <div class="v2-donut-legend">
        <div class="v2-legend-row"><span class="v2-legend-color teal"></span><span>${escapeHtml(context.t("analytics.aiHandled"))}</span><strong></strong><span>${escapeHtml(formatMetricValue(handled))}</span></div>
        <div class="v2-legend-row"><span class="v2-legend-color soft-blue"></span><span>${escapeHtml(context.t("analytics.humanFollowUps"))}</span><strong></strong><span>${escapeHtml(formatMetricValue(human))}</span></div>
      </div>
    </article>
  `;
  }

  function renderConversionCard(report = {}, options = {}) {
    const context = createRenderContext(options);

    return `
    <article class="v2-card v2-analytics-conversion-card">
      <div class="v2-split-stat">
        <div class="v2-split-stat-item">
          ${context.renderIconBadge("users", "teal")}
          <div>
            <div class="v2-row-title">${escapeHtml(context.t("analytics.conversionRate"))}</div>
            <div class="v2-split-stat-value">${escapeHtml(formatMetricDecimalPercent(report.conversionRate || 0))}</div>
            <div class="v2-metric-change"><span>${escapeHtml(context.t("analytics.basedOnCapturedLeads"))}</span></div>
          </div>
        </div>
        <div class="v2-split-stat-item">
          ${context.renderIconBadge("clock", "blue")}
          <div>
            <div class="v2-row-title">${escapeHtml(context.t("analytics.estimatedTimeSaved"))}</div>
            <div class="v2-split-stat-value">${escapeHtml(formatMetricHours(report.estimatedHoursSaved))}h</div>
            <div class="v2-metric-change"><span>${escapeHtml(context.t("analytics.estimatedFromAiHandled"))}</span></div>
          </div>
        </div>
      </div>
    </article>
  `;
  }

  function renderContactMixCard(report = {}, options = {}) {
    const context = createRenderContext(options);

    return `
    <section class="v2-card v2-section v2-contact-mix-card">
      <div class="v2-section-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.talkingTo"))}</h2>
          <p class="v2-section-subtitle">${escapeHtml(report.contactMixCopy || "Contact identity will become more useful as more live conversations arrive.")}</p>
        </div>
      </div>
      <div class="analytics-report-contact-grid">
        <div class="analytics-report-contact-card">
          <span>${escapeHtml(context.t("analytics.guestUsers"))}</span>
          <strong>${escapeHtml(formatMetricValue(report.guestUsers))}</strong>
        </div>
        <div class="analytics-report-contact-card">
          <span>${escapeHtml(context.t("analytics.identifiedUsers"))}</span>
          <strong>${escapeHtml(formatMetricValue(report.identifiedUsers))}</strong>
        </div>
        <div class="analytics-report-contact-card">
          <span>${escapeHtml(context.t("analytics.emailUsers"))}</span>
          <strong>${escapeHtml(formatMetricValue(report.emailUsers))}</strong>
        </div>
      </div>
    </section>
  `;
  }

  function renderPerformanceBySource(sourceRows = [], report = {}, options = {}) {
    const context = createRenderContext(options);
    const total = Math.max(Number(report.conversationCount || 0), sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0));
    const rows = sourceRows.map((row) => {
      const conversations = Number(row.conversationCount || 0);
      const percent = total > 0 ? Math.round((conversations / total) * 100) : 0;
      const aiHandled = Math.min(conversations, Math.round((conversations * Number(report.autonomousHandledRate || 0)) / 100));
      const human = Math.max(0, conversations - aiHandled);

      return `
      <tr>
        <td><span class="v2-name">${context.renderIcon(row.icon || "window", row.tone || "blue")} ${escapeHtml(row.label)}</span></td>
        <td>${escapeHtml(row.visits || context.t("analytics.notTracked"))}</td>
        <td>${escapeHtml(row.unavailable ? context.t("analytics.notTracked") : `${formatMetricValue(conversations)} (${percent}%)`)}</td>
        <td>${escapeHtml(row.unavailable ? context.t("analytics.notTracked") : formatMetricValue(row.leadsCaptured || 0))}</td>
        <td>${escapeHtml(row.unavailable || conversations <= 0 ? "-" : formatMetricDecimalPercent((Number(row.leadsCaptured || 0) / conversations) * 100))}</td>
        <td>${escapeHtml(row.unavailable ? "-" : formatMetricValue(aiHandled))}</td>
        <td>${escapeHtml(row.unavailable ? "-" : formatMetricValue(human))}</td>
        <td>${escapeHtml(context.t("analytics.instant"))}</td>
      </tr>
    `;
    }).join("");

    return `
    <section class="v2-table-card v2-section">
      <div class="v2-table-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.performanceBySource"))}</h2>
        </div>
      </div>
      <div class="v2-data-table-wrap">
        <table class="v2-data-table">
          <thead>
            <tr>
              <th>${escapeHtml(context.t("analytics.source"))}</th>
              <th>${escapeHtml(context.t("analytics.visits"))}</th>
              <th>${escapeHtml(context.t("analytics.conversations"))}</th>
              <th>${escapeHtml(context.t("analytics.leads"))}</th>
              <th>${escapeHtml(context.t("analytics.conversionRate"))}</th>
              <th>${escapeHtml(context.t("analytics.aiHandled"))}</th>
              <th>${escapeHtml(context.t("analytics.humanFollowUps"))}</th>
              <th>${escapeHtml(context.t("analytics.avgFirstResponse"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
  }

  function renderAnalyticsPageFragment(report = {}, ownerAnalyticsDashboard = null, topQuestionItems = [], userMessages = [], options = {}) {
    const context = createRenderContext(options);
    const sourceRows = buildAssistantSourceRows(ownerAnalyticsDashboard?.assistantSource);
    const sourceTotal = Math.max(
      Number(ownerAnalyticsDashboard?.assistantSource?.totalConversations || 0),
      Number(report.conversationCount || 0)
    );
    const metrics = buildMetricCards(report, sourceRows, context);

    return `
    <div class="dashboard-v2-analytics">
      <section class="v2-grid v2-grid-6">
        ${metrics.map((metric) => renderMetricCard(metric, context)).join("")}
      </section>
      <section class="v2-analytics-columns v2-section">
        <div class="v2-analytics-column v2-analytics-column-main">
          <article class="v2-card v2-chart-card v2-analytics-chart-card">
            <div class="v2-section-header">
              <div>
                <h2 class="v2-section-title">${escapeHtml(context.t("analytics.conversationsOverTime"))}</h2>
                <div class="v2-metric-value v2-chart-total">${escapeHtml(formatMetricValue(report.conversationCount))} <span class="v2-subtext">${escapeHtml(context.t("analytics.totalConversationLabel"))}</span></div>
                <div class="v2-metric-change"><span>${escapeHtml(context.t("analytics.liveCurrentWorkspace"))}</span></div>
              </div>
              <button class="v2-button" type="button">${escapeHtml(context.t("analytics.daily"))} ${context.renderIcon("chevronDown")}</button>
            </div>
            ${renderLineChart(report.conversationSeries, context)}
          </article>
          ${renderHeatmap(userMessages, context)}
        </div>
        <div class="v2-analytics-column">
          ${renderAssistantSourceCard(sourceRows, sourceTotal, context)}
          ${renderHandlingCard(report, context)}
        </div>
        <div class="v2-analytics-column">
          ${renderTopQuestionsList(topQuestionItems, context)}
          ${renderConversionCard(report, context)}
        </div>
      </section>
      ${renderPerformanceBySource(sourceRows, report, context)}
      ${renderContactMixCard(report, context)}
    </div>
  `;
  }

  global.VonzaDashboardAnalytics = Object.freeze({
    normalizeAnalyticsSource,
    getAnalyticsSourceLabel,
    getAnalyticsSourceDescription,
    formatMetricValue,
    formatMetricDelta,
    formatConversationCount,
    formatMessageCount,
    formatLeadCount,
    buildMetricCards,
    buildAssistantSourceRows,
    renderMetricCard,
    renderAssistantSourceCard,
    renderTopQuestionsList,
    renderRecentAnalyticsActivity,
    renderAnalyticsEmptyState,
    renderAnalyticsPageFragment,
  });
})(window);
