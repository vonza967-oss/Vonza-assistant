(function registerVonzaDashboardAnalytics(global) {
  const SOURCE_LABELS = Object.freeze({
    widget: "Website widget",
    page: "Front Desk page",
    web_call: "Web Call",
    embedded: "Embedded assistant",
    unknown: "Legacy/unknown",
  });

  const SOURCE_LABELS_HU = Object.freeze({
    widget: "Website Widget",
    page: "Front Desk oldal",
    web_call: "Web Call",
    embedded: "Beágyazott asszisztens",
    unknown: "Korábbi/ismeretlen",
  });

  const ANALYTICS_SNIPPETS_HU = Object.freeze({
    "building more live conversation volume": "több élő beszélgetés gyűjtése",
    "capturing more contact details from warm visitors": "több kapcsolatadat rögzítése meleg érdeklődőktől",
    "turning pricing questions into confident next steps": "az árazási kérdések magabiztos következő lépéssé alakítása",
    "closing complaint and support conversations faster": "panasz- és támogatási beszélgetések gyorsabb lezárása",
  });

  const SOURCE_DESCRIPTIONS = Object.freeze({
    widget: "Customer conversations started from the optional website widget.",
    page: "Customer conversations started from the full-page AI Front Desk.",
    web_call: "Browser-based Web Call conversations from the hosted Front Desk page.",
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
    "analytics.frontDeskPageConversations": "Hosted Front Desk conversations",
    "analytics.frontDeskPrimarySurface": "Primary customer-facing surface",
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
    "analytics.satisfactionSignal": "Satisfaction signal",
    "analytics.basedOnAnswerQuality": "Estimated from weak answers and owner attention",
    "analytics.operatorBrief": "Operator brief",
    "analytics.waitingForTraffic": "Waiting for live Front Desk traffic",
    "analytics.waitingForTrafficCopy": "After customers use the hosted Front Desk page, QR/direct link, embed, or optional widget, performance signals will appear here.",
    "analytics.operatorBriefCopy": "Customer-service performance from Front Desk conversations, owner follow-ups, leads, answer quality, and improvement signals.",
    "analytics.whatToWatch": "What to watch",
    "analytics.webCallHealth": "Web Call health",
    "analytics.recentWebCalls": "Recent Web Calls",
    "analytics.aiHandledBriefTitle": "{handled} of {total} conversations handled by AI",
    "analytics.widgetWaitingForTrafficCopy": "After customers use the Website Widget, conversations and captured leads will appear here.",
    "analytics.ownerFollowUp": "owner follow-up",
    "analytics.improvementFocus": "improvement focus",
    "analytics.repeatedQuestion": "repeated question: {question}",
    "analytics.sourceBreakdownWidgetCopy": "Website Widget conversations and leads from the existing embedded widget records.",
    "analytics.sourceBreakdownDefaultCopy": "Hosted Front Desk page remains the primary surface; widget and embeds are secondary distribution.",
    "analytics.handlingCopy": "Shows work handled by Front Desk versus conversations still needing a person.",
    "analytics.topQuestionsCopy": "Use repeated questions to decide which answer guidance to improve next.",
    "analytics.customerQuestionFallback": "Customer question",
    "analytics.topQuestionsEmpty": "No repeated customer questions yet. As Front Desk handles more live questions, recurring themes will appear here.",
    "analytics.chartEmpty": "Live conversations will draw this trend after customers start using Front Desk.",
    "analytics.performanceBySourceWidgetCopy": "Review Website Widget conversations and leads using existing widget source data.",
    "analytics.performanceBySourceDefaultCopy": "Compare Front Desk page, embed, and optional widget outcomes using real conversation data.",
    "analytics.metricCompareWidgetSurface": "Embedded widget surface",
    "analytics.metricCompareVoiceSurface": "Browser voice surface",
    "analytics.liveWorkspaceData": "Live workspace data",
    "analytics.newSignal": "New",
    "analytics.productScope": "Product analytics",
    "analytics.productScopeCopy": "Product-specific view using the existing shared analytics data.",
    "analytics.frontDeskAnalytics": "Front Desk analytics",
    "analytics.frontDeskAnalyticsCopy": "Full-page and hosted Front Desk outcomes from existing conversation source data.",
    "analytics.widgetAnalytics": "Website Widget analytics",
    "analytics.widgetAnalyticsCopy": "Optional widget outcomes from existing conversation source data.",
    "analytics.voiceAnalytics": "Voice Agent analytics",
    "analytics.voiceAnalyticsCopy": "Browser Web Call outcomes from existing conversation and safe call-health data.",
    "analytics.frontDeskEmptyTitle": "No Front Desk analytics yet.",
    "analytics.frontDeskEmptyCopy": "Publish or open the full-page Front Desk, then ask one realistic test question. Page visitors, leads, and repeated questions will appear here after conversations are recorded.",
    "analytics.widgetEmptyTitle": "No Website Widget analytics yet.",
    "analytics.widgetEmptyCopy": "Install the embed, confirm allowed domains, then test the widget on a site page. Website visitor conversations and embedded assistant leads will appear here after use.",
    "analytics.voiceEmptyTitle": "No Voice Agent analytics yet.",
    "analytics.voiceEmptyCopy": "Set up browser voice and Web Call, run a Web Call test, then review transcripts, handoff context, and analytics after conversations are recorded.",
    "analytics.frontDeskConversations": "Front Desk conversations",
    "analytics.frontDeskLeads": "Front Desk leads",
    "analytics.frontDeskVisitsUnavailable": "Front Desk visit analytics are not available in the current dashboard analytics response.",
    "analytics.widgetConversations": "Widget conversations",
    "analytics.widgetLeads": "Widget leads",
    "analytics.widgetOpensUnavailable": "Widget open and install-event analytics are not available in the current dashboard analytics response.",
    "analytics.webCallSessions": "Web Call sessions",
    "analytics.webCallStarts": "Web Call starts",
    "analytics.averageCallDuration": "Average call duration",
    "analytics.notAvailableYet": "Not available yet",
    "analytics.derivedFromConversationSource": "Derived from existing conversation source data",
    "analytics.derivedFromSafeWebCallTelemetry": "Derived from safe Web Call telemetry",
    "analytics.setupFrontDesk": "Open full-page publish",
    "analytics.setupWidget": "Open embed install",
    "analytics.setupVoice": "Open voice setup",
    "analytics.frontDeskSettings": "Full-page setup",
    "analytics.widgetSettings": "Widget settings",
    "analytics.voiceTest": "Open Web Call test",
  });

  const PRODUCT_ANALYTICS_CONFIG = Object.freeze({
    front_desk: Object.freeze({
      key: "front_desk",
      label: "Front Desk",
      routePath: "/dashboard/front-desk",
      titleKey: "analytics.frontDeskAnalytics",
      copyKey: "analytics.frontDeskAnalyticsCopy",
      setupLabelKey: "analytics.setupFrontDesk",
      setupHref: "#install/full-page",
      shellTarget: "install",
      installMethod: "full-page",
      emptyTitleKey: "analytics.frontDeskEmptyTitle",
      emptyCopyKey: "analytics.frontDeskEmptyCopy",
      emptyActions: Object.freeze([
        Object.freeze({ labelKey: "analytics.setupFrontDesk", href: "#install/full-page", shellTarget: "install", installMethod: "full-page" }),
        Object.freeze({ labelKey: "analytics.frontDeskSettings", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk" }),
      ]),
    }),
    website_widget: Object.freeze({
      key: "website_widget",
      label: "Website Widget",
      routePath: "/dashboard/widget",
      titleKey: "analytics.widgetAnalytics",
      copyKey: "analytics.widgetAnalyticsCopy",
      setupLabelKey: "analytics.setupWidget",
      setupHref: "#install/embed",
      shellTarget: "install",
      installMethod: "widget",
      emptyTitleKey: "analytics.widgetEmptyTitle",
      emptyCopyKey: "analytics.widgetEmptyCopy",
      emptyActions: Object.freeze([
        Object.freeze({ labelKey: "analytics.setupWidget", href: "#install/embed", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ labelKey: "analytics.widgetSettings", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget" }),
      ]),
    }),
    voice_agent: Object.freeze({
      key: "voice_agent",
      label: "Voice Agent",
      routePath: "/dashboard/voice",
      titleKey: "analytics.voiceAnalytics",
      copyKey: "analytics.voiceAnalyticsCopy",
      setupLabelKey: "analytics.setupVoice",
      setupHref: "#settings/voice/voice",
      shellTarget: "settings",
      settingsTarget: "voice_agent",
      emptyTitleKey: "analytics.voiceEmptyTitle",
      emptyCopyKey: "analytics.voiceEmptyCopy",
      emptyActions: Object.freeze([
        Object.freeze({ labelKey: "analytics.setupVoice", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent" }),
        Object.freeze({ labelKey: "analytics.voiceTest", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent" }),
      ]),
    }),
  });

  const DEDICATED_WEBSITE_WIDGET_DASHBOARD_PATHS = Object.freeze([
    "/dashboard/widget",
    "/website-widget/dashboard",
    "/widget/dashboard",
  ]);

  function isDedicatedWebsiteWidgetDashboardPath() {
    const pathname = trimText(global.location?.pathname).split(/[?#]/)[0];
    const normalizedPath = `/${pathname.replace(/^\/+|\/+$/g, "")}`;
    return DEDICATED_WEBSITE_WIDGET_DASHBOARD_PATHS.includes(normalizedPath);
  }

  function getDefaultProductAnalyticsKey() {
    return isDedicatedWebsiteWidgetDashboardPath() ? "website_widget" : "front_desk";
  }

  function trimText(value) {
    return String(value || "").trim();
  }

  function normalizeRenderLanguage(value = "") {
    return trimText(value).toLowerCase() === "hu" ? "hu" : "en";
  }

  function resolveRenderLocale(language = "en", locale = "") {
    const normalizedLocale = trimText(locale);

    if (normalizedLocale) {
      return normalizedLocale;
    }

    return normalizeRenderLanguage(language) === "hu" ? "hu-HU" : "en-US";
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

    if (["web_call", "front_desk_web_call", "hosted_web_call"].includes(normalized)) {
      return "web_call";
    }

    if (["embedded", "embedded_assistant", "assistant_embed", "smart_embed", "embed"].includes(normalized)) {
      return "embedded";
    }

    return "unknown";
  }

  function normalizeProductAnalyticsKey(value = "") {
    const normalized = trimText(value).toLowerCase().replace(/-/g, "_");
    const aliases = {
      frontdesk: "front_desk",
      front_desk: "front_desk",
      widget: "website_widget",
      website: "website_widget",
      website_widget: "website_widget",
      voice: "voice_agent",
      voice_agent: "voice_agent",
    };
    const candidate = aliases[normalized] || normalized;

    return PRODUCT_ANALYTICS_CONFIG[candidate] ? candidate : getDefaultProductAnalyticsKey();
  }

  function getProductPrimarySourceKey(productKey = "") {
    const key = normalizeProductAnalyticsKey(productKey);

    if (key === "website_widget") {
      return "widget";
    }

    if (key === "voice_agent") {
      return "web_call";
    }

    return "page";
  }

  function getProductSourceLabel(productKey = "") {
    const sourceKey = getProductPrimarySourceKey(productKey);

    if (sourceKey === "widget") {
      return "Website Widget";
    }

    if (sourceKey === "web_call") {
      return "Web Call";
    }

    return "Front Desk page";
  }

  function scopeAssistantSourceRowsForProduct(sourceRows = [], productKey = "") {
    const sourceKey = getProductPrimarySourceKey(productKey);
    return (Array.isArray(sourceRows) ? sourceRows : []).filter((row) => row.key === sourceKey);
  }

  function getAnalyticsSourceLabel(value, language = "en") {
    const labels = normalizeRenderLanguage(language) === "hu" ? SOURCE_LABELS_HU : SOURCE_LABELS;
    return labels[normalizeAnalyticsSource(value)] || labels.unknown;
  }

  function getAnalyticsSourceDescription(value) {
    return SOURCE_DESCRIPTIONS[normalizeAnalyticsSource(value)] || SOURCE_DESCRIPTIONS.unknown;
  }

  function formatMetricValue(value, locale = "en-US") {
    return new Intl.NumberFormat(resolveRenderLocale("", locale)).format(Math.round(Number(value || 0)));
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

  function formatMetricDuration(seconds) {
    const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = totalSeconds % 60;

    if (minutes <= 0) {
      return `${remainder}s`;
    }

    return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  }

  function formatMetricDecimal(value) {
    const numeric = Number(value || 0);

    if (!Number.isFinite(numeric)) {
      return "0";
    }

    return numeric.toFixed(1).replace(/\.0$/, "");
  }

  function formatActivityTime(value, locale = "en-US") {
    const date = new Date(value || "");

    if (Number.isNaN(date.getTime())) {
      return "No activity yet";
    }

    return date.toLocaleString(locale || "en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatConversationCount(value, locale = "en-US", language = "en") {
    const count = Number(value || 0);
    const formatted = formatMetricValue(count, locale);

    if (normalizeRenderLanguage(language) === "hu") {
      return `${formatted} beszélgetés`;
    }

    return `${formatted} conversation${count === 1 ? "" : "s"}`;
  }

  function formatMessageCount(value, locale = "en-US", language = "en") {
    const count = Number(value || 0);
    const formatted = formatMetricValue(count, locale);

    if (normalizeRenderLanguage(language) === "hu") {
      return `${formatted} üzenet`;
    }

    return `${formatted} message${count === 1 ? "" : "s"}`;
  }

  function formatLeadCount(value, locale = "en-US", language = "en") {
    const count = Number(value || 0);
    const formatted = formatMetricValue(count, locale);

    if (normalizeRenderLanguage(language) === "hu") {
      return `${formatted} érdeklődő`;
    }

    return `${formatted} lead${count === 1 ? "" : "s"}`;
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
    const webCall = normalizeSourceBucket(source.web_call || source.webCall, { key: "web_call" });
    const unknown = normalizeSourceBucket(source.unknown, { key: "unknown" });

    if (webCall.conversationCount > 0 || webCall.messageCount > 0 || webCall.leadsCaptured > 0) {
      baseRows.push({
        ...webCall,
        icon: "phone",
        tone: "blue",
        color: "soft-blue",
        visits: "",
      });
    }

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

  function findSourceRow(sourceRows = [], key = "") {
    const normalized = normalizeAnalyticsSource(key);
    return (Array.isArray(sourceRows) ? sourceRows : []).find((row) => row.key === normalized) || {};
  }

  function localizeAssistantSourceRows(sourceRows = [], context = createRenderContext()) {
    return (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({
      ...row,
      label: getAnalyticsSourceLabel(row.key || row.label, context.language),
    }));
  }

  function localizeAnalyticsSnippet(value = "", context = createRenderContext()) {
    const text = trimText(value);

    if (context.language !== "hu" || !text) {
      return text;
    }

    return ANALYTICS_SNIPPETS_HU[text.toLowerCase()] || text;
  }

  function hasAssistantSourceBreakdown(ownerAnalyticsDashboard = null) {
    const source = ownerAnalyticsDashboard?.assistantSource;
    return Boolean(source && typeof source === "object");
  }

  function hasSafeWebCallTelemetry(ownerAnalyticsDashboard = null) {
    const health = ownerAnalyticsDashboard?.webCallHealth;
    return Boolean(health && typeof health === "object" && health.available !== false);
  }

  function buildAvailableProductMetric({ key, label, value, note, icon = "review", tone = "blue" } = {}) {
    return {
      key,
      label,
      value,
      note,
      icon,
      tone,
      state: "available",
    };
  }

  function buildUnavailableProductMetric({ key, label, note, icon = "review" } = {}) {
    return {
      key,
      label,
      value: "",
      note,
      icon,
      tone: "gray",
      state: "unavailable",
    };
  }

  function buildProductSetupAction(config = {}, context = createRenderContext()) {
    return {
      key: `${config.key || "product"}_setup`,
      label: context.t(config.setupLabelKey || "analytics.productScope"),
      value: "",
      note: config.copyKey ? context.t(config.copyKey) : context.t("analytics.productScopeCopy"),
      icon: "settings",
      tone: "teal",
      state: "action",
      href: config.setupHref,
      shellTarget: config.shellTarget,
      settingsTarget: config.settingsTarget,
      installMethod: config.installMethod,
    };
  }

  function buildProductAnalyticsCards(productKey = "", sourceRows = [], ownerAnalyticsDashboard = null, options = {}) {
    const context = createRenderContext(options);
    const key = normalizeProductAnalyticsKey(productKey);
    const config = PRODUCT_ANALYTICS_CONFIG[key];
    const sourceAvailable = hasAssistantSourceBreakdown(ownerAnalyticsDashboard);
    const webCallTelemetryAvailable = hasSafeWebCallTelemetry(ownerAnalyticsDashboard);
    const pageRow = findSourceRow(sourceRows, "page");
    const widgetRow = findSourceRow(sourceRows, "widget");
    const webCallRow = findSourceRow(sourceRows, "web_call");
    const webCallHealth = ownerAnalyticsDashboard?.webCallHealth || {};
    const sourceNote = context.t("analytics.derivedFromConversationSource");
    const cards = [];

    if (key === "website_widget") {
      cards.push(sourceAvailable
        ? buildAvailableProductMetric({ key: "widget_conversations", label: context.t("analytics.widgetConversations"), value: context.formatConversationCount(widgetRow.conversationCount || 0), note: sourceNote, icon: "window", tone: "teal" })
        : buildUnavailableProductMetric({ key: "widget_conversations", label: context.t("analytics.widgetConversations"), note: context.t("analytics.notAvailableYet"), icon: "window" }));
      cards.push(sourceAvailable
        ? buildAvailableProductMetric({ key: "widget_leads", label: context.t("analytics.widgetLeads"), value: context.formatLeadCount(widgetRow.leadsCaptured || 0), note: sourceNote, icon: "users", tone: "green" })
        : buildUnavailableProductMetric({ key: "widget_leads", label: context.t("analytics.widgetLeads"), note: context.t("analytics.notAvailableYet"), icon: "users" }));
      cards.push(buildUnavailableProductMetric({ key: "widget_opens", label: context.t("analytics.visits"), note: context.t("analytics.widgetOpensUnavailable"), icon: "install" }));
      cards.push(buildProductSetupAction(config, context));
      return cards;
    }

    if (key === "voice_agent") {
      cards.push(sourceAvailable
        ? buildAvailableProductMetric({ key: "web_call_sessions", label: context.t("analytics.webCallSessions"), value: context.formatConversationCount(webCallRow.conversationCount || 0), note: sourceNote, icon: "chat", tone: "blue" })
        : buildUnavailableProductMetric({ key: "web_call_sessions", label: context.t("analytics.webCallSessions"), note: context.t("analytics.notAvailableYet"), icon: "chat" }));
      cards.push(webCallTelemetryAvailable
        ? buildAvailableProductMetric({ key: "web_call_starts", label: context.t("analytics.webCallStarts"), value: context.formatMetricValue(webCallHealth.starts || 0), note: context.t("analytics.derivedFromSafeWebCallTelemetry"), icon: "chat", tone: "teal" })
        : buildUnavailableProductMetric({ key: "web_call_starts", label: context.t("analytics.webCallStarts"), note: context.t("analytics.notAvailableYet"), icon: "chat" }));
      cards.push(webCallTelemetryAvailable
        ? buildAvailableProductMetric({ key: "web_call_average_duration", label: context.t("analytics.averageCallDuration"), value: formatMetricDuration(webCallHealth.averageDurationSeconds || 0), note: context.t("analytics.derivedFromSafeWebCallTelemetry"), icon: "clock", tone: "blue" })
        : buildUnavailableProductMetric({ key: "web_call_average_duration", label: context.t("analytics.averageCallDuration"), note: context.t("analytics.notAvailableYet"), icon: "clock" }));
      cards.push(buildProductSetupAction(config, context));
      return cards;
    }

    cards.push(sourceAvailable
      ? buildAvailableProductMetric({ key: "front_desk_conversations", label: context.t("analytics.frontDeskConversations"), value: context.formatConversationCount(pageRow.conversationCount || 0), note: sourceNote, icon: "window", tone: "blue" })
      : buildUnavailableProductMetric({ key: "front_desk_conversations", label: context.t("analytics.frontDeskConversations"), note: context.t("analytics.notAvailableYet"), icon: "window" }));
    cards.push(sourceAvailable
      ? buildAvailableProductMetric({ key: "front_desk_leads", label: context.t("analytics.frontDeskLeads"), value: context.formatLeadCount(pageRow.leadsCaptured || 0), note: sourceNote, icon: "users", tone: "green" })
      : buildUnavailableProductMetric({ key: "front_desk_leads", label: context.t("analytics.frontDeskLeads"), note: context.t("analytics.notAvailableYet"), icon: "users" }));
    cards.push(buildUnavailableProductMetric({ key: "front_desk_visits", label: context.t("analytics.visits"), note: context.t("analytics.frontDeskVisitsUnavailable"), icon: "review" }));
    cards.push(buildProductSetupAction(config, context));

    return cards;
  }

  function hasProductAnalyticsActivity(productKey = "", sourceRows = [], ownerAnalyticsDashboard = null) {
    const key = normalizeProductAnalyticsKey(productKey);
    const pageRow = findSourceRow(sourceRows, "page");
    const widgetRow = findSourceRow(sourceRows, "widget");
    const webCallRow = findSourceRow(sourceRows, "web_call");
    const webCallHealth = ownerAnalyticsDashboard?.webCallHealth || {};

    if (key === "website_widget") {
      return Number(widgetRow.conversationCount || 0) > 0 || Number(widgetRow.leadsCaptured || 0) > 0;
    }

    if (key === "voice_agent") {
      return Number(webCallRow.conversationCount || 0) > 0
        || Number(webCallRow.leadsCaptured || 0) > 0
        || Number(webCallHealth.starts || 0) > 0
        || Number(webCallHealth.averageDurationSeconds || 0) > 0;
    }

    return Number(pageRow.conversationCount || 0) > 0 || Number(pageRow.leadsCaptured || 0) > 0;
  }

  function renderProductAnalyticsEmptyAction(action = {}, context = createRenderContext()) {
    const attributes = [
      `class="${action.primary === false ? "ghost-button" : "product-analytics-action"}"`,
      `href="${escapeHtml(action.href || "#analytics")}"`,
      action.shellTarget ? `data-shell-target="${escapeHtml(action.shellTarget)}"` : "",
      action.settingsTarget ? `data-settings-target="${escapeHtml(action.settingsTarget)}"` : "",
      action.installMethod ? `data-install-method-jump="${escapeHtml(action.installMethod)}"` : "",
    ].filter(Boolean);

    return `<a ${attributes.join(" ")}>${escapeHtml(context.t(action.labelKey || "analytics.productScope"))}</a>`;
  }

  function renderProductAnalyticsEmptyState(config = {}, context = createRenderContext()) {
    const actions = Array.isArray(config.emptyActions) ? config.emptyActions : [];

    return `
      <div class="operator-empty-state product-analytics-empty-state" data-product-analytics-empty-state="${escapeHtml(config.key || "")}">
        <p class="operator-empty-title">${escapeHtml(context.t(config.emptyTitleKey || "analytics.productScope"))}</p>
        <p class="operator-empty-copy">${escapeHtml(context.t(config.emptyCopyKey || "analytics.productScopeCopy"))}</p>
        ${actions.length ? `<div class="inline-actions">${actions.map((action, index) => renderProductAnalyticsEmptyAction({ ...action, primary: index === 0 }, context)).join("")}</div>` : ""}
      </div>
    `;
  }

  function renderProductAnalyticsTab(config = {}, activeKey = "front_desk") {
    const isActive = config.key === activeKey;

    return `
      <a
        class="product-analytics-tab ${isActive ? "active" : ""}"
        href="${escapeHtml(config.routePath || "/dashboard/front-desk")}#analytics"
        data-product-analytics-tab="${escapeHtml(config.key)}"
        ${isActive ? 'aria-current="page"' : ""}
      >${escapeHtml(config.label)}</a>
    `;
  }

  function renderProductAnalyticsCard(card = {}, options = {}) {
    const context = createRenderContext(options);
    const attributes = [
      `class="product-analytics-card ${card.state === "available" ? "has-metric" : card.state === "action" ? "is-action" : "is-unavailable"}"`,
      `data-product-analytics-card="${escapeHtml(card.key || "")}"`,
      `data-product-analytics-state="${escapeHtml(card.state || "unavailable")}"`,
    ];
    const actionAttributes = card.state === "action" && card.href
      ? [
        `class="product-analytics-action"`,
        `href="${escapeHtml(card.href)}"`,
        card.shellTarget ? `data-shell-target="${escapeHtml(card.shellTarget)}"` : "",
        card.settingsTarget ? `data-settings-target="${escapeHtml(card.settingsTarget)}"` : "",
        card.installMethod ? `data-install-method-jump="${escapeHtml(card.installMethod)}"` : "",
      ].filter(Boolean)
      : [];

    return `
      <article ${attributes.join(" ")}>
        <div class="product-analytics-card-top">
          ${context.renderIconBadge(card.icon || "review", card.tone || "blue")}
          <span>${escapeHtml(card.label || "")}</span>
        </div>
        ${card.state === "available"
          ? `<strong class="product-analytics-card-value">${escapeHtml(card.value)}</strong>`
          : card.state === "action"
            ? `<a ${actionAttributes.join(" ")}>${escapeHtml(card.label || context.t("analytics.productScope"))}</a>`
            : `<strong class="product-analytics-card-status">${escapeHtml(context.t("analytics.notAvailableYet"))}</strong>`}
        <p>${escapeHtml(card.note || "")}</p>
      </article>
    `;
  }

  function renderProductAnalyticsSection(sourceRows = [], ownerAnalyticsDashboard = null, options = {}) {
    const context = createRenderContext(options);
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const config = PRODUCT_ANALYTICS_CONFIG[activeKey];
    const hideProductTabs = options.hideProductTabs === true;
    const cards = buildProductAnalyticsCards(activeKey, sourceRows, ownerAnalyticsDashboard, context);
    const emptyStateMarkup = hasProductAnalyticsActivity(activeKey, sourceRows, ownerAnalyticsDashboard)
      ? ""
      : renderProductAnalyticsEmptyState(config, context);

    return `
      <section class="v2-card product-analytics-section" data-product-analytics-view="${escapeHtml(activeKey)}" aria-label="${escapeHtml(context.t("analytics.productScope"))}">
        <div class="product-analytics-header">
          <div>
            <p class="v2-row-meta">${escapeHtml(context.t("analytics.productScope"))}</p>
            <h2 class="v2-section-title">${escapeHtml(context.t(config.titleKey))}</h2>
            <p class="v2-section-subtitle">${escapeHtml(context.t(config.copyKey))}</p>
          </div>
          ${hideProductTabs ? "" : `<nav class="product-analytics-tabs" aria-label="${escapeHtml(context.t("analytics.productScope"))}">
            ${Object.values(PRODUCT_ANALYTICS_CONFIG).map((item) => renderProductAnalyticsTab(item, activeKey)).join("")}
          </nav>`}
        </div>
        <div class="product-analytics-grid">
          ${cards.map((card) => renderProductAnalyticsCard(card, context)).join("")}
        </div>
        ${emptyStateMarkup}
      </section>
    `;
  }

  function createRenderContext(options = {}) {
    const language = normalizeRenderLanguage(options.language || options.dashboardLanguage);
    const locale = resolveRenderLocale(language, options.locale);
    const translateBase = typeof options.t === "function"
      ? options.t
      : (key) => TEXT_FALLBACKS[key] || key;
    const translate = (key, params = {}) => String(translateBase(key, params)).replace(/\{(\w+)\}/g, (_match, name) => (
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
    ));
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
      language,
      locale,
      t: translate,
      renderIcon,
      renderIconBadge,
      renderButton,
      formatMetricValue: (value) => formatMetricValue(value, locale),
      formatConversationCount: (value) => formatConversationCount(value, locale, language),
      formatMessageCount: (value) => formatMessageCount(value, locale, language),
      formatLeadCount: (value) => formatLeadCount(value, locale, language),
    };
  }

  function buildMetricCards(report = {}, sourceRows = [], options = {}) {
    const context = createRenderContext(options);
    const humanFollowUps = Math.max(0, Number(report.conversationCount || 0) - Number(report.autonomousHandledCount || 0));
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const primarySourceKey = getProductPrimarySourceKey(activeKey);
    const primarySourceRow = sourceRows.find((row) => row.key === primarySourceKey) || {};
    const primaryMetricLabel = activeKey === "website_widget"
      ? context.t("analytics.widgetConversations")
      : activeKey === "voice_agent"
        ? context.t("analytics.webCallSessions")
        : context.t("analytics.frontDeskPageConversations");
    const primaryMetricCompare = activeKey === "website_widget"
      ? context.t("analytics.metricCompareWidgetSurface")
      : activeKey === "voice_agent"
        ? context.t("analytics.metricCompareVoiceSurface")
        : context.t("analytics.frontDeskPrimarySurface");
    const satisfactionScore = Number(report.satisfactionScore || 0);

    return [
      { label: primaryMetricLabel, value: context.formatMetricValue(primarySourceRow.conversationCount || 0), compare: primaryMetricCompare, icon: activeKey === "voice_agent" ? "phone" : "window", tone: activeKey === "front_desk" ? "blue" : "teal", priority: true },
      { label: context.t("analytics.totalConversations"), value: context.formatMetricValue(report.conversationCount), compare: context.t("analytics.liveCustomerConversations"), icon: "chat", tone: "blue" },
      { label: context.t("analytics.aiHandled"), value: formatMetricPercent(report.autonomousHandledRate), compare: `${context.formatMetricValue(report.autonomousHandledCount)} ${context.t("analytics.handledWithoutTeamReply")}`, icon: "sparkle", tone: "teal" },
      { label: context.t("analytics.humanFollowUps"), value: context.formatMetricValue(humanFollowUps), compare: context.t("analytics.needsOwnerAttention"), icon: "user", tone: humanFollowUps > 0 ? "blue" : "green", down: humanFollowUps === 0 },
      { label: context.t("analytics.leadsCaptured"), value: context.formatMetricValue(report.contactsCaptured), compare: context.t("analytics.capturedFromRealCustomerSignals"), icon: "users", tone: "green" },
      { label: context.t("analytics.satisfactionSignal"), value: satisfactionScore > 0 ? `${satisfactionScore.toFixed(1).replace(/\.0$/, "")}/5` : context.t("analytics.newSignal"), compare: context.t("analytics.basedOnAnswerQuality"), icon: "review", tone: satisfactionScore >= 4 ? "green" : "blue" },
    ];
  }

  function renderMetricCard(metric = {}, options = {}) {
    const context = createRenderContext(options);
    const trendClass = metric.down ? "v2-trend-down" : "v2-trend-up";
    const trendIcon = metric.down ? "arrowDown" : "arrowUp";

    return `
    <article class="v2-metric-card ${metric.priority ? "v2-metric-card-priority" : ""}">
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
        <span>${escapeHtml(metric.compare || context.t("analytics.liveWorkspaceData"))}</span>
      </div>
    </article>
  `;
  }

  function buildSourceDonutStyle(sourceRows = [], totalConversations = 0) {
    const total = Math.max(Number(totalConversations || 0), sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0));
    const colorMap = {
      teal: "#0ea99b",
      blue: "#4f8df7",
      "soft-blue": "#8fb7ff",
      gray: "#d8e1ec",
    };

    if (total <= 0) {
      return "background:conic-gradient(#e2e8f0 0 100%);";
    }

    let cursor = 0;
    const segments = sourceRows
      .filter((row) => Number(row.conversationCount || 0) > 0)
      .map((row) => {
        const start = cursor;
        const width = (Number(row.conversationCount || 0) / total) * 100;
        cursor += width;
        return `${colorMap[row.color] || colorMap.gray} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
      });

    if (cursor < 100) {
      segments.push(`#e2e8f0 ${cursor.toFixed(2)}% 100%`);
    }

    return `background:conic-gradient(${segments.join(",")});`;
  }

  function renderAnalyticsCommandBrief(report = {}, sourceRows = [], topQuestionItems = [], options = {}) {
    const context = createRenderContext(options);
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const totalConversations = Number(report.conversationCount || 0);
    const primarySourceKey = getProductPrimarySourceKey(activeKey);
    const primarySourceRow = sourceRows.find((row) => row.key === primarySourceKey) || {};
    const primarySourceLabel = getAnalyticsSourceLabel(primarySourceKey, context.language) || getProductSourceLabel(activeKey);
    const watchItem = trimText(report.improvementArea)
      ? localizeAnalyticsSnippet(report.improvementArea, context)
      : (topQuestionItems[0]?.label ? context.t("analytics.repeatedQuestion", { question: topQuestionItems[0].label }) : context.t("analytics.whatToWatch"));
    const title = totalConversations > 0
      ? context.t("analytics.aiHandledBriefTitle", {
        handled: context.formatMetricValue(report.autonomousHandledCount),
        total: context.formatMetricValue(totalConversations),
      })
      : context.t("analytics.waitingForTraffic");
    const copy = totalConversations > 0
      ? (report.summarySentence || context.t("analytics.operatorBriefCopy"))
      : activeKey === "website_widget"
        ? context.t("analytics.widgetWaitingForTrafficCopy")
        : context.t("analytics.waitingForTrafficCopy");

    return `
      <section class="v2-card v2-analytics-brief">
        <div class="v2-analytics-brief-copy">
          <p class="v2-row-meta">${escapeHtml(context.t("analytics.operatorBrief"))}</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(copy)}</p>
        </div>
        <div class="v2-analytics-brief-status" aria-label="${escapeHtml(context.t("analytics.whatToWatch"))}">
          <span><strong>${escapeHtml(context.formatMetricValue(primarySourceRow.conversationCount || 0))}</strong> ${escapeHtml(primarySourceLabel)}</span>
          <span><strong>${escapeHtml(context.formatMetricValue(report.attentionNeeded || 0))}</strong> ${escapeHtml(context.t("analytics.ownerFollowUp"))}</span>
          <span><strong>${escapeHtml(watchItem)}</strong> ${escapeHtml(context.t("analytics.improvementFocus"))}</span>
        </div>
      </section>
    `;
  }

  function renderAssistantSourceCard(sourceRows = [], totalConversations = 0, options = {}) {
    const context = createRenderContext(options);
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const total = Math.max(Number(totalConversations || 0), sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0));
    const trackedRows = sourceRows.filter((row) => !row.unavailable || Number(row.conversationCount || 0) > 0 || Number(row.messageCount || 0) > 0);
    const subtitle = activeKey === "website_widget"
      ? context.t("analytics.sourceBreakdownWidgetCopy")
      : context.t("analytics.sourceBreakdownDefaultCopy");

    return `
    <article class="v2-card v2-analytics-source-card">
      <div class="v2-section-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.entrySourceBreakdown"))}</h2>
          <p class="v2-section-subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <div class="v2-donut-layout">
        <div class="v2-donut" style="${escapeHtml(buildSourceDonutStyle(trackedRows, total))}" aria-hidden="true"></div>
        <div class="v2-donut-legend">
          ${trackedRows.map((row) => {
            const percent = total > 0 ? Math.round((Number(row.conversationCount || 0) / total) * 100) : 0;
            return `
              <div class="v2-legend-row ${row.key === "page" ? "v2-legend-row-primary" : ""}">
                <span class="v2-legend-color ${escapeHtml(row.color || "gray")}"></span>
                <span>${escapeHtml(row.label)}</span>
                <strong>${escapeHtml(`${percent}%`)}</strong>
                <span class="v2-subtext">${escapeHtml(context.formatMetricValue(row.conversationCount))}</span>
              </div>
            `;
          }).join("")}
          <div class="v2-legend-row v2-legend-total">
            <span></span><strong>${escapeHtml(context.t("analytics.total"))}</strong><strong></strong><strong>${escapeHtml(context.formatMetricValue(total))}</strong>
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
    const hasData = values.some((value) => Number(value || 0) > 0);

    return `
    <div class="v2-line-chart-shell">
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
      <text class="v2-axis-label" x="14" y="115">${escapeHtml(context.formatMetricValue(Math.ceil(maxValue / 2)))}</text>
      <text class="v2-axis-label" x="8" y="72">${escapeHtml(context.formatMetricValue(maxValue))}</text>
      ${labelIndexes.map((index) => {
        const x = paddingX + ((width - paddingX - 30) * index) / Math.max(values.length - 1, 1);
        return `<text class="v2-axis-label" x="${escapeHtml(x.toFixed(0))}" y="176">${escapeHtml(labels[index] || "")}</text>`;
      }).join("")}
    </svg>
    ${hasData ? "" : `<div class="v2-chart-empty">${escapeHtml(context.t("analytics.chartEmpty"))}</div>`}
    </div>
  `;
  }

  function renderTopQuestionsList(topQuestionItems = [], options = {}) {
    const context = createRenderContext(options);
    const maxCount = Math.max(...topQuestionItems.map((item) => Number(item.count || 0)), 1);

    return `
    <article class="v2-card v2-analytics-top-questions-card">
      <div class="v2-section-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.topCustomerQuestions"))}</h2>
          <p class="v2-section-subtitle">${escapeHtml(context.t("analytics.topQuestionsCopy"))}</p>
        </div>
        ${context.renderButton(context.t("analytics.viewAll"), "")}
      </div>
      ${topQuestionItems.length ? `
        <div class="v2-list">
          ${topQuestionItems.map((item) => {
            const count = Number(item.count || 0);
            const width = Math.max(8, Math.round((count / maxCount) * 100));
            return `
              <div class="v2-question-row">
                <div class="v2-row-title">${escapeHtml(item.label || context.t("analytics.customerQuestionFallback"))}</div>
                <div class="v2-bar-track"><span class="v2-bar-fill" style="--v2-bar:${escapeHtml(String(width))}%"></span></div>
                <div class="v2-row-meta">${escapeHtml(context.formatMetricValue(count))}</div>
              </div>
            `;
          }).join("")}
        </div>
      ` : renderAnalyticsEmptyState(context.t("analytics.topQuestionsEmpty"))}
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
    return `<div class="placeholder-card analytics-empty-state">${escapeHtml(copy)}</div>`;
  }

  function hasValidActivityTime(value) {
    const date = new Date(value || "");
    return !Number.isNaN(date.getTime());
  }

  function hasWebCallHealthActivity(webCallHealth = {}) {
    const health = webCallHealth && typeof webCallHealth === "object" ? webCallHealth : {};
    const failureCategories = Array.isArray(health.failureCategories) ? health.failureCategories : [];

    return Boolean(
      Number(health.starts || 0) > 0
      || Number(health.endedCalls || 0) > 0
      || Number(health.averageDurationSeconds || 0) > 0
      || Number(health.averageTurns || 0) > 0
      || Number(health.contactFallbackSubmissions || 0) > 0
      || failureCategories.length
      || hasValidActivityTime(health.latestActivityAt)
    );
  }

  function hasRecentWebCallActivity(webCallRecentCalls = {}) {
    const source = webCallRecentCalls && typeof webCallRecentCalls === "object" ? webCallRecentCalls : {};
    return source.available !== false && Array.isArray(source.calls) && source.calls.length > 0;
  }

  function getWebCallReviewLabel(review = {}) {
    const status = trimText(review.status).toLowerCase();

    if (review.followUpCompleted === true) {
      return "Follow-up complete";
    }

    if (review.followUpNeeded === true) {
      return "Needs follow-up";
    }

    if (status === "reviewed") {
      return "Reviewed";
    }

    if (status === "done") {
      return "Done";
    }

    if (status === "dismissed") {
      return "Dismissed";
    }

    return "Needs review";
  }

  function renderWebCallTranscript(messages = [], options = {}) {
    const context = createRenderContext(options);
    const safeMessages = (Array.isArray(messages) ? messages : [])
      .filter((message) => trimText(message.content))
      .slice(-8);

    if (!safeMessages.length) {
      return renderAnalyticsEmptyState("No related conversation transcript is available for this Web Call yet.");
    }

    return `
      <div class="v2-web-call-transcript" aria-label="Related Web Call conversation">
        ${safeMessages.map((message) => `
          <article class="v2-web-call-message ${message.role === "assistant" ? "assistant" : "user"}" data-conversation-message="${escapeHtml(message.id || "")}">
            <div class="v2-web-call-message-meta">
              <strong>${escapeHtml(message.role === "assistant" ? "Front Desk" : "Caller")}</strong>
              <span>${escapeHtml(formatActivityTime(message.createdAt, context.locale))}</span>
            </div>
            <p>${escapeHtml(message.content)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderWebCallHealthCard(webCallHealth = {}, options = {}) {
    const context = createRenderContext(options);
    const health = webCallHealth && typeof webCallHealth === "object" ? webCallHealth : {};
    const available = health.available !== false;
    const failureCategories = Array.isArray(health.failureCategories) ? health.failureCategories : [];
    const hasActivity = available && hasWebCallHealthActivity(health);
    const stats = [
      { label: "Starts", value: formatMetricValue(health.starts || 0) },
      { label: "Ended calls", value: formatMetricValue(health.endedCalls || 0) },
      { label: "Avg. duration", value: formatMetricDuration(health.averageDurationSeconds || 0) },
      { label: "Avg. turns", value: formatMetricDecimal(health.averageTurns || 0) },
      { label: "Contact fallbacks", value: formatMetricValue(health.contactFallbackSubmissions || 0) },
      { label: "Latest activity", value: formatActivityTime(health.latestActivityAt, context.locale) },
    ];

    return `
    <section class="v2-card v2-section v2-web-call-health-card ${hasActivity ? "" : "v2-web-call-card-compact"}">
      <div class="v2-section-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.webCallHealth"))}</h2>
          <p class="v2-section-subtitle">Safe product telemetry for browser-based calls. No transcripts, replies, contact details, speech tokens, or provider errors are shown.</p>
        </div>
        ${context.renderIconBadge("phone", available ? "blue" : "gray")}
      </div>
      ${available && hasActivity ? `
        <div class="analytics-report-contact-grid">
          ${stats.map((item) => `
            <div class="analytics-report-contact-card">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="v2-web-call-failures">
          <p class="v2-row-title">Failed speech, transcription, and playback</p>
          ${failureCategories.length ? `
            <div class="v2-donut-legend">
              ${failureCategories.map((item) => `
                <div class="v2-legend-row">
                  <span class="v2-legend-color soft-blue"></span>
                  <span>${escapeHtml(item.label || item.category || "Safe failure category")}</span>
                  <strong></strong>
                  <span>${escapeHtml(formatMetricValue(item.count || 0))}</span>
                </div>
              `).join("")}
            </div>
          ` : renderAnalyticsEmptyState("No failed speech, transcription, or playback events have been recorded.")}
        </div>
      ` : renderAnalyticsEmptyState(available ? "No Web Call activity has been recorded yet." : "Web Call product telemetry is not available yet.")}
    </section>
  `;
  }

  function renderRecentWebCallsCard(webCallRecentCalls = {}, options = {}) {
    const context = createRenderContext(options);
    const source = webCallRecentCalls && typeof webCallRecentCalls === "object" ? webCallRecentCalls : {};
    const available = source.available !== false;
    const calls = Array.isArray(source.calls) ? source.calls : [];
    const hasCalls = available && calls.length > 0;

    return `
    <section class="v2-card v2-section v2-recent-web-calls-card ${hasCalls ? "" : "v2-web-call-card-compact"}">
      <div class="v2-section-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.recentWebCalls"))}</h2>
          <p class="v2-section-subtitle">Latest owner-scoped browser calls with safe outcomes only.</p>
        </div>
        ${context.renderIconBadge("phone", hasCalls ? "blue" : "gray")}
      </div>
      ${hasCalls ? `
        <div class="v2-recent-web-call-list">
          ${calls.map((call) => {
            const action = call.action && typeof call.action === "object" ? call.action : null;
            const failureCount = Array.isArray(call.failureCategories) ? call.failureCategories.length : 0;
            const failureLabels = Array.isArray(call.failureCategoryLabels) ? call.failureCategoryLabels : [];
            const review = call.review && typeof call.review === "object" ? call.review : {};
            const actionKey = trimText(call.actionKey);
            const latestQuestion = trimText(call.latestQuestion);
            const latestAnswer = trimText(call.latestAnswer);
            const outcomeChips = [
              call.contactFallbackSubmitted ? "Contact submitted" : call.contactFallbackOpened ? "Contact opened" : "No contact fallback",
              call.hadFailures ? "Had failures" : "No failures",
              getWebCallReviewLabel(review),
            ];

            return `
              <article class="v2-recent-web-call-row" data-web-call-recent-row data-web-call-action-key="${escapeHtml(actionKey)}" data-conversation-source="web_call">
                <div class="v2-recent-web-call-main">
                  <div>
                    <p class="v2-row-title">Web Call conversation</p>
                    <p class="analytics-subtle">${escapeHtml(formatActivityTime(call.latestActivityAt || call.startedAt, context.locale))}</p>
                  </div>
                  <div class="v2-recent-web-call-metrics">
                    <span><strong>${escapeHtml(call.turnCount === null || call.turnCount === undefined ? "n/a" : formatMetricDecimal(call.turnCount))}</strong> turns</span>
                    <span><strong>${escapeHtml(call.durationSeconds === null || call.durationSeconds === undefined ? "n/a" : formatMetricDuration(call.durationSeconds))}</strong> duration</span>
                  </div>
                </div>
                <div class="v2-recent-web-call-footer">
                  <div class="v2-recent-web-call-outcomes">
                    ${outcomeChips.map((label) => `<span class="v2-status-pill">${escapeHtml(label)}</span>`).join("")}
                    ${failureCount ? `<span class="v2-status-pill">${escapeHtml(`${failureCount} safe failure ${failureCount === 1 ? "type" : "types"}`)}</span>` : ""}
                  </div>
                  ${failureLabels.length ? `<p class="analytics-subtle">${escapeHtml(`Failure categories: ${failureLabels.join(", ")}`)}</p>` : ""}
                  ${action?.contactId ? `
                    <button class="ghost-button" type="button" data-shell-target="contacts" data-target-id="${escapeHtml(action.contactId)}">${escapeHtml(action.label || "Open customer")}</button>
                  ` : action?.messageId ? `
                    <button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(action.messageId)}">${escapeHtml(action.label || "Open related conversation")}</button>
                  ` : ""}
                </div>
                ${renderWebCallTranscript(call.messages, options)}
                <div class="v2-recent-web-call-actions">
                  <button class="ghost-button" type="button" data-web-call-review-action="reviewed" data-action-key="${escapeHtml(actionKey)}" ${actionKey ? "" : "disabled"}>Mark reviewed</button>
                  <button class="ghost-button" type="button" data-web-call-review-action="follow_up" data-action-key="${escapeHtml(actionKey)}" ${actionKey ? "" : "disabled"}>Needs follow-up</button>
                  <button class="ghost-button" type="button" data-web-call-improve-answer data-question="${escapeHtml(latestQuestion)}" data-answer="${escapeHtml(latestAnswer)}" data-message-id="${escapeHtml(call.latestAssistantMessageId || call.latestMessageId || "")}" data-session-key="${escapeHtml(call.sessionKey || "")}" ${latestQuestion ? "" : "disabled"}>Improve answer</button>
                  <button class="ghost-button" type="button" data-web-call-practice-question data-question="${escapeHtml(latestQuestion)}" ${latestQuestion ? "" : "disabled"}>Practice this question</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : renderAnalyticsEmptyState(available ? "No Web Call conversations have been recorded yet." : "Recent Web Call conversations are not available yet.")}
    </section>
  `;
  }

  function renderHeatmap(userMessages = [], options = {}) {
    const context = createRenderContext(options);
    const hourFormatter = new Intl.DateTimeFormat(context.locale, {
      hour: "numeric",
    });
    const weekdayFormatter = new Intl.DateTimeFormat(context.locale, {
      weekday: "short",
    });
    const times = [
      { label: hourFormatter.format(new Date(2026, 0, 5, 0)), start: 0, end: 3 },
      { label: hourFormatter.format(new Date(2026, 0, 5, 4)), start: 4, end: 7 },
      { label: hourFormatter.format(new Date(2026, 0, 5, 8)), start: 8, end: 11 },
      { label: hourFormatter.format(new Date(2026, 0, 5, 12)), start: 12, end: 15 },
      { label: hourFormatter.format(new Date(2026, 0, 5, 16)), start: 16, end: 19 },
      { label: hourFormatter.format(new Date(2026, 0, 5, 20)), start: 20, end: 23 },
    ];
    const days = Array.from({ length: 7 }, (_item, index) => weekdayFormatter.format(new Date(2026, 0, 5 + index)));
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
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.aiVsHumanHandling"))}</h2>
          <p class="v2-section-subtitle">${escapeHtml(context.t("analytics.handlingCopy"))}</p>
        </div>
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
        <div class="v2-legend-row"><span class="v2-legend-color teal"></span><span>${escapeHtml(context.t("analytics.aiHandled"))}</span><strong></strong><span>${escapeHtml(context.formatMetricValue(handled))}</span></div>
        <div class="v2-legend-row"><span class="v2-legend-color soft-blue"></span><span>${escapeHtml(context.t("analytics.humanFollowUps"))}</span><strong></strong><span>${escapeHtml(context.formatMetricValue(human))}</span></div>
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
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const total = Math.max(Number(report.conversationCount || 0), sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0));
    const subtitle = activeKey === "website_widget"
      ? context.t("analytics.performanceBySourceWidgetCopy")
      : context.t("analytics.performanceBySourceDefaultCopy");
    const rows = sourceRows.map((row) => {
      const conversations = Number(row.conversationCount || 0);
      const percent = total > 0 ? Math.round((conversations / total) * 100) : 0;
      const aiHandled = Math.min(conversations, Math.round((conversations * Number(report.autonomousHandledRate || 0)) / 100));
      const human = Math.max(0, conversations - aiHandled);

      return `
      <tr>
        <td><span class="v2-name">${context.renderIcon(row.icon || "window", row.tone || "blue")} ${escapeHtml(row.label)}</span></td>
        <td>${escapeHtml(row.visits || context.t("analytics.notTracked"))}</td>
        <td>${escapeHtml(row.unavailable ? context.t("analytics.notTracked") : `${context.formatMetricValue(conversations)} (${percent}%)`)}</td>
        <td>${escapeHtml(row.unavailable ? context.t("analytics.notTracked") : context.formatMetricValue(row.leadsCaptured || 0))}</td>
        <td>${escapeHtml(row.unavailable || conversations <= 0 ? "-" : formatMetricDecimalPercent((Number(row.leadsCaptured || 0) / conversations) * 100))}</td>
        <td>${escapeHtml(row.unavailable ? "-" : context.formatMetricValue(aiHandled))}</td>
        <td>${escapeHtml(row.unavailable ? "-" : context.formatMetricValue(human))}</td>
        <td>${escapeHtml(context.t("analytics.instant"))}</td>
      </tr>
    `;
    }).join("");

    return `
    <section class="v2-table-card v2-section">
      <div class="v2-table-header">
        <div>
          <h2 class="v2-section-title">${escapeHtml(context.t("analytics.performanceBySource"))}</h2>
          <p class="v2-section-subtitle">${escapeHtml(subtitle)}</p>
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
    const renderOptions = { ...options, ...context };
    const activeKey = normalizeProductAnalyticsKey(options.activeProduct?.key || options.activeProduct || "");
    const activeProductScope = options.sourceScope === "active_product" || options.hideProductTabs === true;
    const allSourceRows = buildAssistantSourceRows(ownerAnalyticsDashboard?.assistantSource);
    const sourceRows = localizeAssistantSourceRows(
      activeProductScope ? scopeAssistantSourceRowsForProduct(allSourceRows, activeKey) : allSourceRows,
      context
    );
    const sourceRowTotal = sourceRows.reduce((sum, row) => sum + Number(row.conversationCount || 0), 0);
    const sourceTotal = Math.max(
      activeProductScope ? sourceRowTotal : Number(ownerAnalyticsDashboard?.assistantSource?.totalConversations || 0),
      Number(report.conversationCount || 0)
    );
    const metrics = buildMetricCards(report, sourceRows, renderOptions);
    const webCallHealth = ownerAnalyticsDashboard?.webCallHealth;
    const webCallRecentCalls = ownerAnalyticsDashboard?.webCallRecentCalls;
    const hasWebCallActivity = !activeProductScope && (hasWebCallHealthActivity(webCallHealth) || hasRecentWebCallActivity(webCallRecentCalls));

    return `
    <div class="dashboard-v2-analytics">
      ${renderAnalyticsCommandBrief(report, sourceRows, topQuestionItems, renderOptions)}
      ${renderProductAnalyticsSection(sourceRows, ownerAnalyticsDashboard, options)}
      <section class="v2-grid v2-grid-6">
        ${metrics.map((metric) => renderMetricCard(metric, renderOptions)).join("")}
      </section>
      <section class="v2-analytics-columns v2-section">
        <div class="v2-analytics-column v2-analytics-column-main">
          <article class="v2-card v2-chart-card v2-analytics-chart-card">
            <div class="v2-section-header">
              <div>
                <h2 class="v2-section-title">${escapeHtml(context.t("analytics.conversationsOverTime"))}</h2>
                <div class="v2-metric-value v2-chart-total">${escapeHtml(context.formatMetricValue(report.conversationCount))} <span class="v2-subtext">${escapeHtml(context.t("analytics.totalConversationLabel"))}</span></div>
                <div class="v2-metric-change"><span>${escapeHtml(context.t("analytics.liveCurrentWorkspace"))}</span></div>
              </div>
              <button class="v2-button" type="button">${escapeHtml(context.t("analytics.daily"))} ${context.renderIcon("chevronDown")}</button>
            </div>
            ${renderLineChart(report.conversationSeries, renderOptions)}
          </article>
          ${renderHeatmap(userMessages, renderOptions)}
        </div>
        <div class="v2-analytics-column">
          ${renderAssistantSourceCard(sourceRows, sourceTotal, renderOptions)}
          ${renderHandlingCard(report, renderOptions)}
        </div>
        <div class="v2-analytics-column">
          ${renderTopQuestionsList(topQuestionItems, renderOptions)}
          ${renderConversionCard(report, renderOptions)}
        </div>
      </section>
      ${renderPerformanceBySource(sourceRows, report, renderOptions)}
      ${renderContactMixCard(report, renderOptions)}
      ${activeProductScope ? "" : `
        <section class="v2-web-call-grid ${hasWebCallActivity ? "has-web-call-activity" : "is-web-call-empty"}" aria-label="Web Call analytics">
          ${renderWebCallHealthCard(webCallHealth, renderOptions)}
          ${renderRecentWebCallsCard(webCallRecentCalls, renderOptions)}
        </section>
      `}
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
    renderWebCallHealthCard,
    renderRecentWebCallsCard,
    normalizeProductAnalyticsKey,
    buildProductAnalyticsCards,
    hasProductAnalyticsActivity,
    renderProductAnalyticsEmptyState,
    renderProductAnalyticsSection,
    renderAnalyticsPageFragment,
  });
})(window);
