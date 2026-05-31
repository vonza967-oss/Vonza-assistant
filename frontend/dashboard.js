// Root DOM references and persisted dashboard state
const rootEl = document.getElementById("dashboard-root");
const statusBanner = document.getElementById("status-banner");
const topbarMeta = document.getElementById("topbar-meta");
const dashboardHelpers = window.VonzaDashboardHelpers || {};
const dashboardState = window.VonzaDashboardState || {};
const dashboardLabels = window.VonzaDashboardLabels || {};
const dashboardInstall = window.VonzaDashboardInstall || {};
const dashboardFrontDesk = window.VonzaDashboardFrontDesk || {};
const dashboardCustomers = window.VonzaDashboardCustomers || {};
const dashboardAnalytics = window.VonzaDashboardAnalytics || {};
const dashboardToday = window.VonzaDashboardToday || {};
const activeDashboardProduct = dashboardState.ACTIVE_DASHBOARD_PRODUCT_CONTEXT || dashboardState.getDashboardProductContext?.(window.location.pathname) || {
  key: "front_desk",
  label: "Front Desk",
};
const dashboardProductNavItems = typeof dashboardState.getDashboardProductNavItems === "function"
  ? dashboardState.getDashboardProductNavItems(activeDashboardProduct.key)
  : [
    { key: "front_desk", label: "Front Desk", dashboardLabel: "AI Front Desk workspace", routePath: "/dashboard/front-desk", active: activeDashboardProduct.key === "front_desk" },
    { key: "website_widget", label: "Website Widget", dashboardLabel: "Website Widget workspace", routePath: "/dashboard/widget", active: activeDashboardProduct.key === "website_widget" },
    { key: "voice_agent", label: "Voice Agent", dashboardLabel: "Voice Agent workspace", routePath: "/dashboard/voice", active: activeDashboardProduct.key === "voice_agent" },
  ];
const DASHBOARD_V2_ENABLED = window.VONZA_DASHBOARD_V2_ENABLED !== false;
const DASHBOARD_LOCAL_FIXTURE_ENABLED = window.VONZA_LOCAL_DASHBOARD_FIXTURE === true;

const CLIENT_ID_STORAGE_KEY = "vonza_client_id";
const INSTALL_STORAGE_PREFIX = "vonza_install_progress_";
const LAUNCH_STORAGE_KEY = "vonza_launch_state";
const DASHBOARD_FOCUS_KEY = "vonza_dashboard_focus";
const HANDOFF_STORAGE_KEY = "vonza_dashboard_handoff_seen";
const DASHBOARD_SOURCE_KEY = "vonza_dashboard_source";
const DASHBOARD_SECTION_KEY = "vonza_dashboard_section";
const DASHBOARD_FRONTDESK_SECTION_KEY = "vonza_dashboard_frontdesk_section";
const DASHBOARD_UI_STATE_STORAGE_KEY = "vonza_dashboard_ui_state";
const DASHBOARD_TODAY_QUEUE_SELECTION_KEY = "vonza_dashboard_today_queue_selection";
const DASHBOARD_THEME_STORAGE_KEY = "vonza_dashboard_theme";
const DASHBOARD_BACKGROUND_STORAGE_KEY = "vonza_dashboard_background";
const DASHBOARD_BACKGROUND_BLUR_STORAGE_KEY = "vonza_dashboard_background_blur";
const DASHBOARD_CUSTOM_BACKGROUND_STORAGE_KEY = "vonza:custom-dashboard-background";
const DASHBOARD_GLASS_TRANSPARENCY_STORAGE_KEY = "vonza:glass-transparency";
const DASHBOARD_BACKGROUND_DIM_STORAGE_KEY = "vonza_dashboard_background_dim";
const DASHBOARD_ACCENT_GLOW_STORAGE_KEY = "vonza_dashboard_accent_glow";
const DASHBOARD_DENSITY_STORAGE_KEY = "vonza_dashboard_density";
const DASHBOARD_LANGUAGE_STORAGE_KEY = "vonza_dashboard_language";
const CLAIM_DISMISS_PREFIX = "vonza_claim_dismissed_";
const LEGAL_DOC_PATHS = Object.freeze({
  terms: "/aszf",
  imprint: "/impresszum",
  privacy: "/adatkezelesi-tajekoztato",
  cookies: "/cookie-tajekoztato",
});
const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
const DASHBOARD_HELP_UNAVAILABLE_MESSAGE = "I couldn't load Vonza help right now. Please try again.";
const CONNECTED_TOOLS_SELF_SERVE_ENABLED = false;
const KNOWLEDGE_IMPORT_TERMINAL_STATES = new Set(["success", "limited", "failed", "stalled"]);
const KNOWLEDGE_IMPORT_ACTIVE_STATES = new Set(["queued", "running", "crawling", "indexing"]);
const KNOWLEDGE_IMPORT_MAX_POLLS = 60;
const DASHBOARD_CUSTOM_BACKGROUND_ID = "custom-upload";
const DASHBOARD_CUSTOM_BACKGROUND_ALLOWED_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
const DASHBOARD_CUSTOM_BACKGROUND_MAX_BYTES = 5 * 1024 * 1024;
const DASHBOARD_CUSTOM_BACKGROUND_MAX_WIDTH = 2400;
const DASHBOARD_CUSTOM_BACKGROUND_QUALITY = 0.85;
const DASHBOARD_BACKGROUND_OPTIONS = Object.freeze(
  Array.isArray(window.VONZA_DASHBOARD_BACKGROUND_OPTIONS) && window.VONZA_DASHBOARD_BACKGROUND_OPTIONS.length
    ? window.VONZA_DASHBOARD_BACKGROUND_OPTIONS
    : [
      {
        value: "skyline-atrium",
        label: "Skyline Atrium",
        type: "image",
        theme: "bright",
        url: "/assets/dashboard/backgrounds/skyline-atrium.png",
      },
      {
        value: "harbor-lounge",
        label: "Harbor Lounge",
        type: "image",
        theme: "bright",
        url: "/assets/dashboard/backgrounds/harbor-lounge.png",
      },
      {
        value: "coastal-gallery",
        label: "Coastal Gallery",
        type: "image",
        theme: "bright",
        url: "/assets/dashboard/backgrounds/coastal-gallery.png",
      },
      {
        value: "midnight-lobby",
        label: "Midnight Lobby",
        type: "image",
        theme: "dark",
        url: "/assets/dashboard/backgrounds/midnight-lobby.png",
      },
      {
        value: "midnight-suite",
        label: "Midnight Suite",
        type: "image",
        theme: "dark",
        url: "/assets/dashboard/backgrounds/midnight-suite.png",
      },
      {
        value: "white-marble",
        label: "White Marble",
        type: "image",
        theme: "bright",
        url: "/assets/dashboard/backgrounds/white-marble.png",
      },
      {
        value: "black-marble",
        label: "Black Marble",
        type: "image",
        theme: "dark",
        url: "/assets/dashboard/backgrounds/black-marble.png",
      },
      {
        value: "simple-white",
        label: "Simple White",
        type: "css",
        theme: "bright",
        cssBackground: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 52%, #ffffff 100%)",
      },
      {
        value: "simple-dark",
        label: "Simple Dark",
        type: "css",
        theme: "dark",
        cssBackground: "radial-gradient(circle at 20% 10%, rgba(124, 60, 255, 0.16), transparent 34%), linear-gradient(135deg, #090b12 0%, #111827 52%, #020617 100%)",
      },
      {
        value: DASHBOARD_CUSTOM_BACKGROUND_ID,
        label: "Custom image",
        type: "custom",
        theme: "custom",
      },
    ]
);
const DEFAULT_DASHBOARD_BACKGROUND = DASHBOARD_BACKGROUND_OPTIONS[0]?.value || "skyline-atrium";
const DASHBOARD_BACKGROUND_BLUR_MIN = 0;
const DASHBOARD_BACKGROUND_BLUR_MAX = 24;
const DEFAULT_DASHBOARD_BACKGROUND_BLUR = 10;
const DASHBOARD_GLASS_TRANSPARENCY_MIN = 0;
const DASHBOARD_GLASS_TRANSPARENCY_MAX = 100;
const DEFAULT_DASHBOARD_GLASS_TRANSPARENCY = 70;
const DASHBOARD_BACKGROUND_DIM_OPTIONS = Object.freeze(["bright", "balanced", "dim"]);
const DASHBOARD_ACCENT_GLOW_OPTIONS = Object.freeze(["off", "soft", "vivid"]);
const DASHBOARD_DENSITY_OPTIONS = Object.freeze(["comfortable", "compact"]);
const DEFAULT_DASHBOARD_BACKGROUND_DIM = "balanced";
const DEFAULT_DASHBOARD_ACCENT_GLOW = "soft";
const DEFAULT_DASHBOARD_DENSITY = "comfortable";
const DASHBOARD_APPEARANCE_CHOICE_LABELS = Object.freeze({
  subtle: "Subtle",
  balanced: "Balanced",
  clear: "Clear",
  bright: "Bright",
  dim: "Dim",
  off: "Off",
  soft: "Soft",
  vivid: "Vivid",
  comfortable: "Comfortable",
  compact: "Compact",
});
const LAUNCH_STEPS = [
  {
    title: "Creating your front desk",
    copy: "Setting up the core identity of your website front desk."
  },
  {
    title: "Connecting your website",
    copy: "Saving the website and brand details your front desk should represent."
  },
  {
    title: "Importing website knowledge",
    copy: "Reading the most useful parts of your website. This can take a moment."
  },
  {
    title: "Preparing your preview",
    copy: "Getting the live experience ready so you can try it right away."
  },
  {
    title: "Finalizing setup",
    copy: "Putting the finishing touches in place before we bring you into the studio."
  }
];
const trackedEventKeys = new Set();
let activationWizardState = null;
let knowledgeImportPollState = null;
let knowledgeImportStartRequestId = 0;
let dashboardSystemThemeListenerBound = false;
const FULL_SHELL_SECTIONS = ["overview", "contacts", "customize", "analytics", "inbox", "calendar", "automations", "install", "settings"];
const LEGACY_SHELL_SECTIONS = ["overview", "contacts", "customize", "analytics", "install", "settings"];
const FRONT_DESK_SECTIONS = ["practice", "improvements", "knowledge", "library", "launch", "customization"];
const DASHBOARD_UI_STATE_DEFAULTS = dashboardState.DASHBOARD_UI_STATE_DEFAULTS;
const DASHBOARD_UI_STATE_PERSISTED_KEYS = dashboardState.DASHBOARD_UI_STATE_PERSISTED_KEYS;
const DASHBOARD_SECTION_HASHES = dashboardState.DASHBOARD_SECTION_HASHES;
const DASHBOARD_HELP_SECTION_LABELS = {
  overview: "Home",
  contacts: "Customers",
  customize: "Front Desk",
  analytics: "Analytics",
  install: "Install",
  settings: "Settings",
  inbox: "Email",
  calendar: "Calendar",
  automations: "Automations",
};
const DASHBOARD_HELP_SUBSECTION_LABELS = {
  customize: {
    practice: "Practice",
    improvements: "Improvements",
    knowledge: "Knowledge",
    library: "Answer library",
    launch: "Launch",
    customization: "Customization",
  },
};
const dashboardUiState = loadDashboardUiState();
const OPERATOR_WORKSPACE_BROWSER_FLAG = "VONZA_OPERATOR_WORKSPACE_V1_ENABLED";
const LEGACY_OPERATOR_WORKSPACE_BROWSER_FLAG = "VONZA_OPERATOR_WORKSPACE_V1";
const TODAY_COPILOT_BROWSER_FLAG = "VONZA_TODAY_COPILOT_V1_ENABLED";
const ACTION_QUEUE_STATUSES = ["new", "reviewed", "done", "dismissed"];
const WIDGET_PURPOSE_OPTIONS = [
  {
    value: "guidance",
    label: "Guidance",
    description: "Help visitors find what they need quickly.",
  },
  {
    value: "support",
    label: "Support",
    description: "Answer customer questions and solve common issues.",
  },
  {
    value: "make_decision",
    label: "Make a decision",
    description: "Help visitors choose the right service, product, or next step.",
  },
  {
    value: "lead_capture",
    label: "Lead capture / contact",
    description: "Guide warm visitors toward contact details or follow-up.",
  },
  {
    value: "booking_next_step",
    label: "Booking / next step guidance",
    description: "Help visitors book, request a quote, or move forward.",
  },
];
const BUSINESS_VERTICAL_OPTIONS = [
  {
    value: "",
    label: "General service business",
    description: "Use broad front-desk guidance without industry-specific defaults.",
  },
  {
    value: "clinic",
    label: "Clinic or healthcare office",
    description: "Careful appointment, preparation, and privacy-aware guidance.",
  },
  {
    value: "web_studio",
    label: "Web studio or agency",
    description: "Project, quote, ecommerce, timeline, and scope guidance.",
  },
  {
    value: "home_services",
    label: "Home services",
    description: "Quote, urgency, service-area, and job-detail guidance.",
  },
];
const FEATURE_STATE_STABLE = "stable";
const FEATURE_STATE_BETA = "beta";
const FEATURE_STATE_HIDDEN = "hidden";
const EMAIL_READ_ONLY_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];
const DASHBOARD_CAPABILITY_MAP = {
  overview: "today",
  contacts: "contacts",
  inbox: "inbox",
  calendar: "calendar",
  automations: "automations",
  customize: "customize",
  analytics: "outcomes",
  install: "widget_install",
};
const DASHBOARD_ENGLISH_FALLBACKS = {
  "app.loading.title": "Preparing your workspace",
  "app.loading.copy": "Connecting your assistant, loading your business data, and getting your front desk ready.",
  "app.loading.footer": "This usually takes a few seconds",
  "app.loading.stepProfile": "Loading business profile",
  "app.loading.stepCompleted": "Completed",
  "app.loading.stepConversations": "Syncing customer conversations",
  "app.loading.stepInProgress": "In progress",
  "app.loading.stepDashboard": "Preparing dashboard",
  "app.loading.stepUpNext": "Up next",
  "language.title": "Choose your dashboard language",
  "language.subtitle": "You can change this later in Settings.",
  "language.continue": "Continue",
  "language.saving": "Saving language...",
  "language.error": "Could not save your dashboard language. Please try again.",
  "language.settingsTitle": "Dashboard language",
  "language.settingsCopy": "Choose the language used by the logged-in dashboard.",
  "language.settingsSaved": "Dashboard language saved.",
  "language.settingsError": "Could not save dashboard language.",
  "language.noChanges": "No changes yet.",
  "language.unsaved": "Unsaved changes",
  "language.save": "Save language",
  "nav.home": "Home",
  "nav.homeToday": "Home / Today",
  "nav.customers": "Customers",
  "nav.customersFollowUps": "Customers / Follow-Ups",
  "nav.knowledgeImprovement": "Knowledge Improvement",
  "nav.frontDesk": "Front Desk",
  "nav.analytics": "Analytics",
  "nav.install": "Install",
  "nav.settings": "Settings",
  "nav.settingsPrivacy": "Settings / Privacy",
  "nav.connectedTools": "Connected Tools",
  "nav.comingSoon": "coming soon",
  "nav.email": "Email",
  "nav.automations": "Automations",
  "nav.calendar": "Calendar",
  "nav.primary": "Primary",
  "nav.utilities": "Utilities",
  "common.lastMessage": "Last message",
  "common.viewChat": "View chat",
  "common.hideChat": "Hide chat",
  "common.noChatYet": "Chat unavailable",
  "common.chatUnavailable": "Chat unavailable",
  "common.guestVisitor": "Guest visitor",
  "common.customer": "Customer",
  "common.vonza": "Vonza",
  "common.save": "Save",
  "common.noCustomerMessage": "No customer message yet",
  "common.noSavedChat": "No saved chat messages yet.",
  "common.noMessageText": "No message text saved.",
  "common.notInstalled": "Not installed yet",
  "home.title": "Home",
  "home.copy": "Your AI customer service snapshot for today",
  "home.dailySnapshot": "Daily snapshot",
  "home.ready": "Home is ready. As soon as customers start using Vonza today, this page will highlight what matters first.",
  "home.summary": "So far today, Vonza handled {conversations}, guided {customers} to a next step or recorded outcome, and flagged {issues} that still need attention.",
  "home.conversationsToday": "Conversations today",
  "home.guidedNextStep": "Guided to next step",
  "home.openIssues": "Open issues",
  "home.customerSatisfaction": "Customer satisfaction",
  "home.aiPriorities": "AI priorities",
  "home.improveNext": "What to improve next",
  "home.improveCopy": "These are the changes most likely to improve customer satisfaction and save time.",
  "home.recentWins": "Recent wins",
  "home.savedCustomers": "Saved customers and good moments",
  "home.serviceQuality": "Service quality",
  "home.improveService": "Improve service",
  "customers.title": "Customers",
  "customers.subtitle": "Track leads, guests, follow-ups, and recent conversations.",
  "customers.focus": "Focus first on unhappy customers, unanswered questions, and warm leads.",
  "customers.showNeedsHelp": "Show customers needing help",
  "customers.listCopy": "The people who need a reply, decision, or follow-up.",
  "customers.emptyTitle": "Your customers will show up here",
  "customers.emptyCopy": "Chat and lead capture records will appear here as customers.",
  "customers.emptyCopyConnected": "Leads, bookings, inbox threads, and follow-ups will appear here as customer records.",
  "customers.all": "All customers",
  "customers.needsReply": "Needs reply",
  "customers.unhappy": "Unhappy",
  "customers.leads": "Leads",
  "customers.returning": "Returning",
  "analytics.title": "Analytics",
  "analytics.copy": "Performance insights for your AI front desk.",
  "analytics.serviceReport": "Performance report",
  "analytics.helping": "AI front desk performance",
  "analytics.totalConversations": "Total conversations",
  "analytics.leadsCaptured": "Leads captured",
  "analytics.conversionRate": "Conversion rate",
  "analytics.conversionRateNote": "Lead or assisted conversion share of total conversations",
  "analytics.waitingForConversations": "Waiting for live conversations",
  "analytics.complaintsHandled": "Complaints handled",
  "analytics.estimatedSatisfaction": "Service quality estimate",
  "analytics.estimatedHoursSaved": "Time saved estimate",
  "analytics.aiUsage": "AI usage",
  "analytics.planCapacity": "Plan capacity",
  "analytics.trends": "Trends",
  "analytics.trendsTitle": "Customer conversations and successful actions",
  "analytics.topInsights": "Top insights",
  "analytics.standsOut": "What stands out right now",
  "analytics.mostAsked": "Most asked question",
  "analytics.peakHours": "Peak hours",
  "analytics.doesBestAt": "Vonza does best at",
  "analytics.needsImprovement": "Needs improvement",
  "analytics.contactSummary": "Contact summary",
  "analytics.talkingTo": "Who Vonza is talking to",
  "analytics.guestUsers": "Guest users",
  "analytics.identifiedUsers": "Identified users",
  "analytics.emailUsers": "Email users",
  "analytics.customerQuestions": "Customer questions",
  "analytics.questionsAndWeakAnswers": "Top questions and weak answers",
  "analytics.topQuestions": "Top questions",
  "analytics.weakAreas": "Weak-answer areas",
  "analytics.dateRangeLast30": "Last 30 days",
  "analytics.sourceAll": "Source: All",
  "analytics.export": "Export",
  "analytics.aiHandled": "AI handled",
  "analytics.humanFollowUps": "Human follow-ups",
  "analytics.fullPageActivity": "Front Desk page activity",
  "analytics.frontDeskPageConversations": "Hosted Front Desk conversations",
  "analytics.frontDeskPrimarySurface": "Primary customer-facing surface",
  "analytics.qrScans": "QR scans",
  "analytics.notTracked": "Not tracked",
  "analytics.qrScanAnalyticsUnavailable": "QR scan analytics unavailable",
  "analytics.liveCustomerConversations": "Live customer conversations",
  "analytics.handledWithoutTeamReply": "handled without team reply",
  "analytics.needsOwnerAttention": "Needs or received owner attention",
  "analytics.capturedFromRealCustomerSignals": "Captured from real customer signals",
  "analytics.fullPageConversationsRecorded": "Front Desk page conversations recorded",
  "analytics.conversationsOverTime": "Conversations over time",
  "analytics.liveCurrentWorkspace": "Live activity from the current workspace",
  "analytics.daily": "Daily",
  "analytics.total": "Total",
  "analytics.totalConversationLabel": "Total conversations",
  "analytics.entrySourceBreakdown": "Entry point / source breakdown",
  "analytics.qrCode": "QR code",
  "analytics.topCustomerQuestions": "Top customer questions",
  "analytics.viewAll": "View all",
  "analytics.noRepeatedQuestions": "No repeated customer questions are standing out yet.",
  "analytics.conversationsByHour": "Conversations by hour",
  "analytics.low": "Low",
  "analytics.high": "High",
  "analytics.aiVsHumanHandling": "AI vs Human handling",
  "analytics.basedOnCapturedLeads": "Based on captured leads and assisted outcomes",
  "analytics.estimatedTimeSaved": "Estimated time saved",
  "analytics.estimatedFromAiHandled": "Estimated from AI-handled customer questions",
  "analytics.performanceBySource": "Performance by source",
  "analytics.source": "Source",
  "analytics.visits": "Visits",
  "analytics.conversations": "Conversations",
  "analytics.leads": "Leads",
  "analytics.avgFirstResponse": "Avg. time to first response",
  "analytics.instant": "Instant",
  "analytics.satisfactionSignal": "Satisfaction signal",
  "analytics.basedOnAnswerQuality": "Estimated from weak answers and owner attention",
  "analytics.operatorBrief": "Operator brief",
  "analytics.waitingForTraffic": "Waiting for live Front Desk traffic",
  "analytics.waitingForTrafficCopy": "After customers use the hosted Front Desk page, QR/direct link, embed, or optional widget, performance signals will appear here.",
  "analytics.operatorBriefCopy": "Customer-service performance from Front Desk conversations, owner follow-ups, leads, answer quality, and improvement signals.",
  "analytics.whatToWatch": "What to watch",
  "analytics.webCallHealth": "Web Call health",
  "analytics.recentWebCalls": "Recent Web Calls",
  "analytics.productScope": "Product analytics",
  "analytics.productScopeCopy": "Product-specific view using the existing shared analytics data.",
  "analytics.frontDeskAnalytics": "Front Desk analytics",
  "analytics.frontDeskAnalyticsCopy": "Full-page and hosted Front Desk outcomes from existing conversation source data.",
  "analytics.widgetAnalytics": "Website Widget analytics",
  "analytics.widgetAnalyticsCopy": "Optional widget outcomes from existing conversation source data.",
  "analytics.voiceAnalytics": "Voice Agent analytics",
  "analytics.voiceAnalyticsCopy": "Browser Web Call outcomes from existing conversation and safe call-health data.",
  "analytics.frontDeskConversations": "Front Desk conversations",
  "analytics.frontDeskLeads": "Front Desk leads",
  "analytics.frontDeskVisitsUnavailable": "Front Desk visit analytics are not available in the current dashboard analytics response.",
  "analytics.widgetConversations": "Widget conversations",
  "analytics.widgetLeads": "Widget leads",
  "analytics.widgetOpensUnavailable": "Widget open and install-event analytics are not available in the current dashboard analytics response.",
  "analytics.webCallSessions": "Web Call sessions",
  "analytics.webCallStarts": "Web Call starts",
  "analytics.averageCallDuration": "Average call duration",
  "analytics.phoneCallSessions": "Phone call sessions",
  "analytics.phoneCallsUnavailable": "Phone call session analytics are not available in the current dashboard analytics response.",
  "analytics.notAvailableYet": "Not available yet",
  "analytics.derivedFromConversationSource": "Derived from existing conversation source data",
  "analytics.derivedFromSafeWebCallTelemetry": "Derived from safe Web Call telemetry",
  "analytics.setupFrontDesk": "Open Front Desk setup",
  "analytics.setupWidget": "Open widget setup",
  "analytics.setupVoice": "Open voice setup",
  "install.title": "Install",
  "install.copyCode": "Copy code",
  "install.publish": "Publish it",
  "install.verify": "Verify and watch for live traffic",
  "install.copyInstallCode": "Copy install code",
  "install.copyInstructions": "Copy instructions",
  "install.verifyInstallation": "Verify installation",
  "install.testFrontDesk": "Test front desk",
  "settings.title": "Settings",
  "settings.copy": "Control assistant branding, business context, billing, privacy, and workspace access.",
  "settings.theme": "Theme",
  "settings.themeCopy": "Choose how the dashboard looks in this browser. Bright Glass is the default.",
  "settings.brightGlass": "Bright Glass",
  "settings.darkGlass": "Dark Glass",
  "settings.system": "System",
  "settings.light": "Bright Glass",
  "settings.dark": "Dark Glass",
};
const DEFAULT_LAUNCH_PROFILE = {
  mode: "public_cohort_v1",
  product: {
    name: "Vonza Front Desk",
    purchaseSummary:
      "The first public offer is the AI front desk plus Home, Customers, Front Desk, Analytics, website import, and install. Connected tools stay out of the launch UI until they are intentionally enabled for a private workspace.",
  },
  icp: {
    key: "service_businesses_with_inbound_leads",
    label: "Service businesses with inbound leads",
    shortLabel: "Service businesses",
  },
  matrix: {
    marketing_site: { state: FEATURE_STATE_STABLE, label: "Marketing site" },
    signup_auth: { state: FEATURE_STATE_STABLE, label: "Signup and auth" },
    checkout: { state: FEATURE_STATE_STABLE, label: "Checkout" },
    front_desk: { state: FEATURE_STATE_STABLE, label: "AI front desk" },
    website_import: { state: FEATURE_STATE_STABLE, label: "Website import" },
    widget_install: { state: FEATURE_STATE_STABLE, label: "Widget install" },
    today: { state: FEATURE_STATE_STABLE, label: "Home" },
    contacts: { state: FEATURE_STATE_STABLE, label: "Customers" },
    outcomes: { state: FEATURE_STATE_STABLE, label: "Analytics" },
    customize: { state: FEATURE_STATE_STABLE, label: "Front Desk" },
    lead_capture: { state: FEATURE_STATE_STABLE, label: "Lead capture" },
    google_connect: { state: FEATURE_STATE_HIDDEN, label: "Google connect" },
    inbox: { state: FEATURE_STATE_HIDDEN, label: "Email" },
    calendar: { state: FEATURE_STATE_HIDDEN, label: "Calendar" },
    automations: { state: FEATURE_STATE_HIDDEN, label: "Automations" },
    advanced_guidance: { state: FEATURE_STATE_HIDDEN, label: "Advanced guidance" },
    manual_outcome_marks: { state: FEATURE_STATE_HIDDEN, label: "Fallback outcome marks" },
    knowledge_fix_workflows: { state: FEATURE_STATE_HIDDEN, label: "Knowledge Improvement" },
  },
};
const AUTH_VIEW_MODES = {
  SIGN_IN: "sign-in",
  SIGN_UP: "sign-up",
  RESET: "reset",
  MAGIC: "magic",
  UPDATE_PASSWORD: "update-password",
};
let authClient = null;
let authSession = null;
let authUser = null;
let authViewMode = AUTH_VIEW_MODES.SIGN_UP;
let authFeedback = null;
let authCallbackIssue = null;
let authStateListenerBound = false;
let shellHashNavigationHandler = null;
let workspaceState = null;
const dashboardRuntimeState = {
  hasBooted: false,
  isBootLoading: false,
  isBackgroundRefreshing: false,
  activeAction: null,
};
let dashboardHelpState = null;
let workspaceRefreshBound = false;
let workspaceRefreshAgentId = "";
let workspaceRefreshTimeout = null;
let dashboardLanguage = window.VonzaDashboardI18n?.getCachedLanguage?.() || "en";

function isDevFakeBillingEnabled() {
  return Boolean(window.VONZA_DEV_FAKE_BILLING);
}

function getPublicAppUrl() {
  return (window.VONZA_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
}

function getDefaultInstallStatus(agent = {}) {
  return agent.installStatus || {
    state: "not_installed",
    label: "Not installed yet",
    host: "",
    pageUrl: null,
    lastSeenAt: null,
    lastSeenUrl: null,
    lastVerifiedAt: null,
    verificationStatus: null,
    verificationTargetUrl: agent.websiteUrl || null,
    verificationOrigin: null,
    verificationDetails: {},
    allowedDomains: Array.isArray(agent.allowedDomains) ? agent.allowedDomains : [],
    installId: agent.installId || "",
    installedAt: null,
  };
}

function isInstallSeen(status) {
  return ["seen_recently", "seen_stale"].includes(status?.state);
}

function isInstallDetected(status) {
  return ["installed_unseen", "seen_recently", "seen_stale"].includes(status?.state);
}

function hasAuthConfig() {
  return Boolean(window.VONZA_SUPABASE_URL && window.VONZA_SUPABASE_ANON_KEY && window.supabase?.createClient);
}

function readWindowBooleanFlag(...keys) {
  for (const key of keys) {
    const value = window[key];

    if (value === true || value === false) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }
  }

  return false;
}

function isOperatorWorkspaceFlagEnabled() {
  return readWindowBooleanFlag(
    OPERATOR_WORKSPACE_BROWSER_FLAG,
    LEGACY_OPERATOR_WORKSPACE_BROWSER_FLAG
  );
}

function isTodayCopilotFlagEnabled() {
  return readWindowBooleanFlag(TODAY_COPILOT_BROWSER_FLAG);
}

function getLaunchProfile() {
  const source = window.VONZA_LAUNCH_PROFILE;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return DEFAULT_LAUNCH_PROFILE;
  }

  return {
    ...DEFAULT_LAUNCH_PROFILE,
    ...source,
    product: {
      ...DEFAULT_LAUNCH_PROFILE.product,
      ...(source.product || {}),
    },
    icp: {
      ...DEFAULT_LAUNCH_PROFILE.icp,
      ...(source.icp || {}),
    },
    matrix: {
      ...DEFAULT_LAUNCH_PROFILE.matrix,
      ...(source.matrix || {}),
    },
  };
}

function getBillingPlans() {
  const source = Array.isArray(window.VONZA_BILLING_PLANS) ? window.VONZA_BILLING_PLANS : [];

  if (source.length) {
    return source;
  }

  return [
    {
      key: "starter",
      displayName: "Starter",
      monthlyPriceCents: 2000,
      monthlyPriceUsd: 20,
      monthlyPriceLabel: "$20/month",
      checkoutLabel: "Start with Starter",
      marketing: {
        audience: "For lighter website traffic",
        summary: "A simple way to get Vonza live on your site",
      },
    },
    {
      key: "growth",
      displayName: "Growth",
      monthlyPriceCents: 5000,
      monthlyPriceUsd: 50,
      monthlyPriceLabel: "$50/month",
      checkoutLabel: "Start with Growth",
      recommended: true,
      marketing: {
        audience: "For regular customer questions",
        summary: "Best for most small businesses",
      },
    },
    {
      key: "pro",
      displayName: "Pro",
      monthlyPriceCents: 10000,
      monthlyPriceUsd: 100,
      monthlyPriceLabel: "$100/month",
      checkoutLabel: "Start with Pro",
      marketing: {
        audience: "For busier websites",
        summary: "More room for higher monthly customer volume",
      },
    },
  ];
}

function normalizeBillingPlanKey(value, fallback = "growth") {
  const plans = getBillingPlans();
  if (typeof dashboardHelpers.normalizeBillingPlanKey === "function") {
    return dashboardHelpers.normalizeBillingPlanKey(value, plans, fallback);
  }

  const normalized = trimText(value).toLowerCase();
  return plans.some((plan) => plan.key === normalized) ? normalized : fallback;
}

function getBillingPlan(planKey) {
  const normalizedPlanKey = normalizeBillingPlanKey(planKey);
  return getBillingPlans().find((plan) => plan.key === normalizedPlanKey) || getBillingPlans()[0];
}

function getSelectedBillingPlanKey() {
  const params = new URLSearchParams(window.location.search);
  return normalizeBillingPlanKey(params.get("plan"));
}

function replaceBillingPlanInUrl(planKey) {
  const normalizedPlanKey = normalizeBillingPlanKey(planKey);
  const url = new URL(window.location.href);
  url.searchParams.set("plan", normalizedPlanKey);
  window.history.replaceState({}, "", url.toString());
}

function getCapabilityState(capabilityKey) {
  const matrix = getLaunchProfile().matrix || {};
  const capability = matrix[capabilityKey];

  if (!capability || typeof capability !== "object") {
    return FEATURE_STATE_HIDDEN;
  }

  return capability.state || FEATURE_STATE_HIDDEN;
}

function isCapabilityExplicitlyVisible(capabilityKey) {
  return getCapabilityState(capabilityKey) !== FEATURE_STATE_HIDDEN;
}

// eslint-disable-next-line no-unused-vars
function isCapabilityBeta(capabilityKey) {
  return getCapabilityState(capabilityKey) === FEATURE_STATE_BETA;
}

// eslint-disable-next-line no-unused-vars
function isCapabilityStable(capabilityKey) {
  return getCapabilityState(capabilityKey) === FEATURE_STATE_STABLE;
}

function isGoogleWorkspaceConfigured(operatorWorkspace = createEmptyOperatorWorkspace()) {
  return operatorWorkspace?.status?.googleConfigReady !== false;
}

function normalizeGoogleCapabilities(value = {}) {
  const source = normalizeOperatorRecord(value);
  return {
    identity: source.identity === true,
    calendarRead: source.calendarRead === true,
    calendarWrite: source.calendarWrite === true,
    gmailRead: source.gmailRead === true,
    gmailCompose: source.gmailCompose === true,
    gmailSend: source.gmailSend === true,
  };
}

function getGoogleWorkspaceCapabilities(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const statusCapabilities = normalizeGoogleCapabilities(operatorWorkspace?.status?.googleCapabilities);
  const accounts = Array.isArray(operatorWorkspace?.connectedAccounts)
    ? operatorWorkspace.connectedAccounts
    : [];

  if (Object.values(statusCapabilities).some(Boolean)) {
    return statusCapabilities;
  }

  return accounts.reduce((summary, account) => {
    const capabilities = normalizeGoogleCapabilities(account?.capabilities);
    return {
      identity: summary.identity || capabilities.identity,
      calendarRead: summary.calendarRead || capabilities.calendarRead,
      calendarWrite: summary.calendarWrite || capabilities.calendarWrite,
      gmailRead: summary.gmailRead || capabilities.gmailRead,
      gmailCompose: summary.gmailCompose || capabilities.gmailCompose,
      gmailSend: summary.gmailSend || capabilities.gmailSend,
    };
  }, normalizeGoogleCapabilities());
}

function isCapabilityVisibleForWorkspace(capabilityKey, operatorWorkspace = createEmptyOperatorWorkspace()) {
  if (!isCapabilityExplicitlyVisible(capabilityKey)) {
    return false;
  }

  if (["inbox", "calendar", "automations", "google_connect"].includes(capabilityKey)) {
    if (operatorWorkspace?.enabled === false) {
      return false;
    }

    if (["calendar", "automations", "google_connect"].includes(capabilityKey) && !isGoogleWorkspaceConfigured(operatorWorkspace)) {
      return false;
    }
  }

  if (capabilityKey === "inbox") {
    return true;
  }

  return true;
}

function normalizeShellCopy(value = "") {
  const text = trimText(value);

  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/\bOpen Outcomes\b/g, "Open Analytics")
    .replace(/\bToday, Contacts, and Outcomes\b/g, "Home, Customers, and Analytics")
    .replace(/\bToday, Customize, and Outcomes\b/g, "Home, Front Desk, and Analytics")
    .replace(/\bContacts and Outcomes\b/g, "Customers and Analytics")
    .replace(/\bToday\b/g, "Home")
    .replace(/\bContacts\b/g, "Customers")
    .replace(/\bOutcomes\b/g, "Analytics")
    .replace(/\bCopilot\b/g, "Vonza")
    .replace(/\bapproval-first\b/gi, "review-before-send")
    .replace(/\bread-only\b/gi, "view-only");

  return translateDashboardText(normalized);
}

function resolveVisibleShellTarget(
  targetSection = "",
  targetId = "",
  operatorWorkspace = createEmptyOperatorWorkspace(),
  options = {},
) {
  const normalizedSection = trimText(targetSection).toLowerCase();
  const normalizedId = trimText(targetId);
  const actionKey = trimText(options.actionKey);
  const contactId = trimText(options.contactId);
  const preferredLabel = normalizeShellCopy(options.label);
  const availableSections = getShellSectionsForWorkspace(operatorWorkspace);

  if (!normalizedSection) {
    return null;
  }

  if (normalizedSection === "automations" && !availableSections.includes("automations")) {
    if (actionKey && availableSections.includes("analytics")) {
      return {
        section: "analytics",
        id: actionKey,
        label: normalizeShellCopy(options.analyticsFallbackLabel || "Open Analytics"),
      };
    }

    if (contactId && availableSections.includes("contacts")) {
      return {
        section: "contacts",
        id: contactId,
        label: normalizeShellCopy(options.contactFallbackLabel || "Open customer"),
      };
    }

    return null;
  }

  if (!["settings", "customize"].includes(normalizedSection) && !availableSections.includes(normalizedSection)) {
    if (contactId && availableSections.includes("contacts")) {
      return {
        section: "contacts",
        id: contactId,
        label: normalizeShellCopy(options.contactFallbackLabel || "Open customer"),
      };
    }

    return null;
  }

  if (normalizedSection === "analytics") {
    return {
      section: "analytics",
      id: normalizedId || actionKey,
      label: preferredLabel || "Open Analytics",
    };
  }

  if (normalizedSection === "contacts") {
    return {
      section: "contacts",
      id: normalizedId || contactId,
      label: preferredLabel || (normalizedId || contactId ? "Open customer" : "Open Customers"),
    };
  }

  return {
    section: normalizedSection,
    id: normalizedId,
    label: preferredLabel || normalizeShellCopy(options.defaultLabel || "Open"),
  };
}

function getShellSectionsForWorkspace(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const candidateSections = operatorWorkspace?.enabled === false
    ? LEGACY_SHELL_SECTIONS
    : FULL_SHELL_SECTIONS;

  return candidateSections.filter((section) => {
    const capabilityKey = DASHBOARD_CAPABILITY_MAP[section];

    if (!capabilityKey) {
      return section === "settings";
    }

    return isCapabilityVisibleForWorkspace(capabilityKey, operatorWorkspace);
  });
}

function getWorkspaceMode(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);

  if (operatorWorkspace?.enabled === false) {
      return {
        key: "front_desk_only",
        eyebrow: "Workspace",
        title: "Your core workspace is ready.",
        copy: "Home, Customers, Front Desk, Analytics, and Install are available here. Connected tools stay out of the launch workspace for now.",
      };
  }

  if (!isGoogleWorkspaceConfigured(operatorWorkspace)) {
    return {
      key: "operator_without_google_beta",
      eyebrow: "Workspace",
      title: "Your main workspace is live.",
      copy: "Home, Customers, Front Desk, and Analytics are ready to use. Email, Calendar, and Automations stay out of the launch workspace for now.",
    };
  }

  if (operatorWorkspace?.status?.googleConnected === true) {
    if (googleCapabilities.calendarRead && !googleCapabilities.gmailRead && !googleCapabilities.calendarWrite) {
      return {
        key: "operator_calendar_connected",
        eyebrow: "Workspace",
        title: "Your core workspace is ready.",
        copy: "Home, Customers, Front Desk, and Analytics stay at the center. Connected tools are hidden from the launch navigation.",
      };
    }

    return {
      key: "operator_google_connected",
      eyebrow: "Workspace",
      title: "Your core workspace is ready.",
      copy: "Home, Customers, Front Desk, and Analytics stay at the center. Connected tools are hidden from the launch navigation.",
    };
  }

  return {
    key: "operator_beta_available",
    eyebrow: "Workspace",
    title: "Your main workspace is ready.",
    copy: "Home, Customers, Front Desk, and Analytics are ready now. Connected tools stay out of the launch navigation until they are intentionally enabled.",
  };
}

function normalizeOperatorRecord(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...value,
  };
}

function normalizeOperatorArray(value, normalizeItem = null) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => (typeof normalizeItem === "function" ? normalizeItem(item) : item));
}

function normalizeOperatorWorkspaceThreadMessage(message = {}) {
  return normalizeOperatorRecord(message);
}

function normalizeOperatorWorkspaceThread(thread = {}) {
  const source = normalizeOperatorRecord(thread);
  return {
    ...source,
    messages: normalizeOperatorArray(source.messages, normalizeOperatorWorkspaceThreadMessage),
  };
}

function normalizeOperatorWorkspaceAccount(account = {}) {
  const source = normalizeOperatorRecord(account);
  return {
    ...source,
    scopes: Array.isArray(source.scopes) ? source.scopes.filter(Boolean) : [],
    scopeAudit: normalizeOperatorRecord(source.scopeAudit),
    capabilities: normalizeGoogleCapabilities(source.capabilities),
  };
}

function normalizeOperatorWorkspaceContact(contact = {}) {
  const source = normalizeOperatorRecord(contact);
  return {
    ...source,
    flags: Array.isArray(source.flags) ? source.flags.filter(Boolean) : [],
    sources: Array.isArray(source.sources) ? source.sources.filter(Boolean) : [],
    timeline: normalizeOperatorArray(source.timeline, normalizeOperatorRecord),
    chatMessages: normalizeOperatorArray(source.chatMessages, normalizeOperatorRecord),
    counts: normalizeOperatorRecord(source.counts),
    nextAction: normalizeOperatorRecord(source.nextAction),
    latestOutcome: normalizeOperatorRecord(source.latestOutcome),
  };
}

function getAuthHeaders(additionalHeaders = {}) {
  const headers = { ...additionalHeaders };

  if (authSession?.access_token) {
    headers.Authorization = `Bearer ${authSession.access_token}`;
  }

  return headers;
}

function renderTopbarMeta() {
  if (!topbarMeta) {
    return;
  }

  if (authUser?.email) {
    topbarMeta.innerHTML = `
      <span class="topbar-email">${escapeHtml(authUser.email)}</span>
      <button class="topbar-button" type="button" id="sign-out-button">Sign out</button>
    `;
    document.getElementById("sign-out-button")?.addEventListener("click", async () => {
      if (!authClient) {
        return;
      }

      await authClient.auth.signOut();
      authSession = null;
      authUser = null;
      clearAuthFlowStateFromUrl();
      setAuthFeedback(null, "");
      setStatus("Signed out.");
      await boot();
    });
    return;
  }

  topbarMeta.innerHTML = "";
}

function createAuthClientIfNeeded() {
  if (authClient || !hasAuthConfig()) {
    return authClient;
  }

  authClient = window.supabase.createClient(
    window.VONZA_SUPABASE_URL,
    window.VONZA_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  if (!authStateListenerBound && typeof authClient.auth?.onAuthStateChange === "function") {
    authClient.auth.onAuthStateChange((event, session) => {
      authSession = session || null;
      authUser = authSession?.user || null;
      renderTopbarMeta();

      if (event === "PASSWORD_RECOVERY") {
        authViewMode = AUTH_VIEW_MODES.UPDATE_PASSWORD;
        setAuthFeedback("info", "Choose a new password for your Vonza account.");
        renderAuthEntry();
      }
    });
    authStateListenerBound = true;
  }

  return authClient;
}

async function ensureAuthClient() {
  const client = createAuthClientIfNeeded();

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  const nextSession = data?.session && typeof data.session === "object"
    ? data.session
    : null;
  authSession = nextSession?.access_token ? nextSession : null;
  authUser = authSession?.user || null;
  renderTopbarMeta();

  return client;
}

function getArrivalContext() {
  const params = new URLSearchParams(window.location.search);
  const from = trimText(params.get("from")).toLowerCase();
  const firstArrival = !window.localStorage.getItem(HANDOFF_STORAGE_KEY);
  const arrivedFromSite = from === "site";

  if (from) {
    window.sessionStorage.setItem(DASHBOARD_SOURCE_KEY, from);
  }

  return {
    from,
    firstArrival,
    arrivedFromSite,
    showHandoff: arrivedFromSite || firstArrival,
  };
}

function getPaymentState() {
  const params = new URLSearchParams(window.location.search);
  return {
    payment: trimText(params.get("payment")).toLowerCase(),
    sessionId: trimText(params.get("session_id") || params.get("sessionId")),
  };
}

function getGoogleConnectionState() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: trimText(params.get("google")).toLowerCase(),
    reason: trimText(params.get("reason")),
  };
}

function clearGoogleConnectionStateFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;

  ["google", "reason"].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

function clearPaymentStateFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;

  ["payment", "session_id", "sessionId"].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

function getAuthFlowType() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashValue = typeof window.location.hash === "string" ? window.location.hash : "";
  const hashParams = new URLSearchParams(hashValue.replace(/^#/, ""));
  return trimText(searchParams.get("type") || hashParams.get("type")).toLowerCase();
}

function getAuthUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const hashValue = typeof window.location.hash === "string" ? window.location.hash : "";
  const hashParams = new URLSearchParams(hashValue.replace(/^#/, ""));

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

function getAuthCallbackIssue() {
  const params = getAuthUrlParams();
  const error = trimText(params.get("error"));
  const errorCode = trimText(params.get("error_code"));
  const description = trimText(params.get("error_description"));

  if (!error && !errorCode && !description) {
    return null;
  }

  const normalized = `${error} ${errorCode} ${description}`.toLowerCase();
  const expired = normalized.includes("otp_expired")
    || normalized.includes("expired");

  return {
    kind: expired ? "expired_link" : "invalid_link",
    headline: expired
      ? authCopy("That email link has expired.", "Az emailes linked lejárt.")
      : authCopy("That email link could not be used.", "Ezt az emailes linket nem lehetett használni."),
    status: expired
      ? authCopy(
        "That email link expired. Send a new magic link or sign in another way.",
        "Az emailes linked lejárt. Kérj új magic linket, vagy jelentkezz be más módon."
      )
      : authCopy(
        "That email link could not be used. Send a new magic link or sign in another way.",
        "Ezt az emailes linket nem lehetett használni. Kérj új magic linket, vagy jelentkezz be más módon."
      ),
    feedback: expired
      ? authCopy(
        "Email links only work for a short time and can be used once. Enter your email to send a fresh magic link, sign in with your password, or reset your password.",
        "Az emailes linkek csak rövid ideig érvényesek, és egyszer használhatók. Add meg az email címedet új magic link küldéséhez, jelentkezz be a jelszavaddal, vagy állítsd vissza a jelszavad."
      )
      : authCopy(
        "This email link is no longer valid. Enter your email to send a fresh magic link, sign in with your password, or reset your password.",
        "Ez az emailes link már nem érvényes. Add meg az email címedet új magic link küldéséhez, jelentkezz be a jelszavaddal, vagy állítsd vissza a jelszavad."
      ),
  };
}

function clearAuthFlowStateFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;

  ["type", "error", "error_code", "error_description"].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (url.hash) {
    const hashParams = new URLSearchParams(String(url.hash || "").replace(/^#/, ""));

    ["type", "access_token", "refresh_token", "error", "error_code", "error_description"].forEach((key) => {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        changed = true;
      }
    });

    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";
  }

  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

function setAuthFeedback(type, message) {
  authFeedback = message
    ? {
      type,
      message,
    }
    : null;
}

function getAuthFeedbackMarkup() {
  if (!authFeedback?.message) {
    return "";
  }

  return `
    <div class="auth-feedback ${escapeHtml(authFeedback.type || "info")}">
      ${escapeHtml(authFeedback.message)}
    </div>
  `;
}

function getAuthRedirectUrl() {
  const redirectUrl = new URL("/dashboard", window.location.origin);
  const arrival = getArrivalContext();
  const selectedPlanKey = getSelectedBillingPlanKey();

  if (arrival.from) {
    redirectUrl.searchParams.set("from", arrival.from);
  }

  if (selectedPlanKey) {
    redirectUrl.searchParams.set("plan", selectedPlanKey);
  }

  return redirectUrl.toString();
}

function authCopy(english = "", hungarian = "") {
  return localizeDashboardCopy(english, hungarian);
}

function getAuthModeConfig(mode, arrival) {
  if (mode === AUTH_VIEW_MODES.MAGIC && authCallbackIssue) {
    return {
      eyebrow: authCallbackIssue.kind === "expired_link"
        ? authCopy("Email link expired", "Az emailes linked lejárt")
        : authCopy("Email link issue", "Probléma van az emailes linkkel"),
      headline: authCallbackIssue.headline,
      copy: authCopy(
        "No worries. Vonza can send a fresh email link, or you can use password sign-in instead.",
        "Semmi gond. A Vonza tud új emailes linket küldeni, vagy beléphetsz jelszóval is."
      ),
      submitLabel: authCopy("Send new magic link", "Új magic link küldése"),
      note: authCopy(
        "Use the newest email from Vonza. Older links may stop working after a newer one is sent.",
        "Mindig a legfrissebb Vonza emailt használd. A korábbi linkek leállhatnak, ha újabbat kérsz."
      ),
    };
  }

  const configs = {
    [AUTH_VIEW_MODES.SIGN_UP]: {
      eyebrow: arrival.arrivedFromSite
        ? authCopy("Step 1 of 3", "1 / 3. lépés")
        : authCopy("Create your Vonza account", "Hozd létre a Vonza fiókodat"),
      headline: authCopy("Create your Vonza account", "Hozd létre a Vonza fiókodat"),
      copy: authCopy(
        "Use email and password to open your Vonza account, then continue straight into the app flow where checkout and workspace setup already live.",
        "Emaillel és jelszóval nyisd meg a Vonza fiókodat, majd menj tovább közvetlenül az appba, ahol a checkout és a munkaterület beállítása már egy helyen vár."
      ),
      submitLabel: authCopy("Create account", "Fiók létrehozása"),
      note: authCopy(
        "You can sign back in with the same email and password whenever you return.",
        "Később ugyanazzal az email címmel és jelszóval tudsz visszajelentkezni."
      ),
    },
    [AUTH_VIEW_MODES.SIGN_IN]: {
      eyebrow: arrival.arrivedFromSite
        ? authCopy("Step 1 of 3", "1 / 3. lépés")
        : authCopy("Sign in to Vonza", "Jelentkezz be a Vonzába"),
      headline: authCopy("Sign in to continue into Vonza", "Jelentkezz be a Vonzába"),
      copy: authCopy(
        "Use your email and password to return to Vonza. After sign-in, unpaid accounts go to checkout and paid accounts go straight into the workspace.",
        "Az email címeddel és jelszavaddal térj vissza a Vonzába. Bejelentkezés után a még nem fizetett fiókok a checkoutba mennek, az aktívak pedig egyből a munkaterületre."
      ),
      submitLabel: authCopy("Sign in", "Bejelentkezés"),
      note: authCopy(
        "Use the same email and password you created for this workspace.",
        "Ugyanazt az email címet és jelszót használd, amivel ezt a munkaterületet létrehoztad."
      ),
    },
    [AUTH_VIEW_MODES.RESET]: {
      eyebrow: authCopy("Reset your password", "Jelszó visszaállítása"),
      headline: authCopy("Send a password reset email", "Jelszó-visszaállító email küldése"),
      copy: authCopy(
        "Enter your account email and we’ll send a reset link that brings you back into Vonza so you can choose a new password cleanly.",
        "Add meg a fiókod email címét, és küldünk egy visszaállító linket, ami visszahoz a Vonzába, hogy biztonságosan új jelszót választhass."
      ),
      submitLabel: authCopy("Send reset link", "Visszaállító link küldése"),
      note: authCopy(
        "The reset link opens a secure password update flow inside Vonza.",
        "A visszaállító link a Vonza biztonságos jelszófrissítő folyamatát nyitja meg."
      ),
    },
    [AUTH_VIEW_MODES.MAGIC]: {
      eyebrow: authCopy("Email link fallback", "Emailes link tartalék belépéshez"),
      headline: authCopy("Use a magic link instead", "Használj inkább magic linket"),
      copy: authCopy(
        "If you do not want to use your password right now, Vonza can still send a one-time email link as a secondary sign-in option.",
        "Ha most nem szeretnél jelszót használni, a Vonza tud egyszer használatos emailes linket is küldeni másodlagos belépési lehetőségként."
      ),
      submitLabel: authCopy("Send magic link", "Magic link küldése"),
      note: authCopy(
        "This keeps the old auth path available without making it the main flow.",
        "Így a korábbi belépési útvonal elérhető marad anélkül, hogy ez lenne az alapértelmezett."
      ),
    },
    [AUTH_VIEW_MODES.UPDATE_PASSWORD]: {
      eyebrow: authCopy("Secure password update", "Biztonságos jelszófrissítés"),
      headline: authCopy("Choose your new password", "Válassz új jelszót"),
      copy: authCopy(
        "Set a new password for your Vonza account, then we’ll bring you back into the app immediately.",
        "Adj meg új jelszót a Vonza fiókodhoz, és azonnal visszaviszünk az appba."
      ),
      submitLabel: authCopy("Update password", "Jelszó frissítése"),
      note: authCopy(
        "Use a strong password you can return with later.",
        "Adj meg erős jelszót, amivel később is biztonságosan vissza tudsz térni."
      ),
    },
  };

  return configs[mode] || configs[AUTH_VIEW_MODES.SIGN_IN];
}

function renderAuthFields(mode) {
  if (mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) {
    return `
      <div class="field">
        <label for="auth-password">${escapeHtml(authCopy("New password", "Új jelszó"))}</label>
        <input id="auth-password" name="password" type="password" placeholder="${escapeHtml(authCopy("Create a strong password", "Adj meg erős jelszót"))}" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="auth-password-confirm">${escapeHtml(authCopy("Confirm new password", "Új jelszó megerősítése"))}</label>
        <input id="auth-password-confirm" name="confirm_password" type="password" placeholder="${escapeHtml(authCopy("Repeat your new password", "Ismételd meg az új jelszavad"))}" autocomplete="new-password">
      </div>
    `;
  }

  const needsPassword = mode === AUTH_VIEW_MODES.SIGN_IN || mode === AUTH_VIEW_MODES.SIGN_UP;
  const needsConfirmation = mode === AUTH_VIEW_MODES.SIGN_UP;

  return `
    <div class="field">
      <label for="auth-email">${escapeHtml(authCopy("Email address", "Email cím"))}</label>
      <input id="auth-email" name="email" type="email" placeholder="you@yourbusiness.com" autocomplete="email">
    </div>
    ${needsPassword ? `
      <div class="field">
        <label for="auth-password">${escapeHtml(authCopy("Password", "Jelszó"))}</label>
        <input id="auth-password" name="password" type="password" placeholder="${escapeHtml(mode === AUTH_VIEW_MODES.SIGN_UP ? authCopy("Create a password", "Adj meg egy jelszót") : authCopy("Enter your password", "Add meg a jelszavad"))}" autocomplete="${mode === AUTH_VIEW_MODES.SIGN_UP ? "new-password" : "current-password"}">
      </div>
    ` : ""}
    ${needsConfirmation ? `
      <div class="field">
        <label for="auth-password-confirm">${escapeHtml(authCopy("Confirm password", "Jelszó megerősítése"))}</label>
        <input id="auth-password-confirm" name="confirm_password" type="password" placeholder="${escapeHtml(authCopy("Repeat your password", "Ismételd meg a jelszavad"))}" autocomplete="new-password">
      </div>
    ` : ""}
  `;
}

function renderAuthSecondaryLinks(mode) {
  if (mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) {
    return "";
  }

  if (mode === AUTH_VIEW_MODES.SIGN_UP) {
    return `
      <div class="auth-links-row">
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">${escapeHtml(authCopy("Already have an account? Sign in", "Már van fiókod? Jelentkezz be"))}</button>
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.MAGIC}">${escapeHtml(authCopy("Use email link instead", "Használj inkább emailes linket"))}</button>
      </div>
    `;
  }

  if (mode === AUTH_VIEW_MODES.SIGN_IN) {
    return `
      <div class="auth-links-row">
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.RESET}">${escapeHtml(authCopy("Forgot password?", "Elfelejtetted a jelszavad?"))}</button>
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.MAGIC}">${escapeHtml(authCopy("Use email link instead", "Használj inkább emailes linket"))}</button>
      </div>
    `;
  }

  if (mode === AUTH_VIEW_MODES.MAGIC) {
    return `
      <div class="auth-links-row">
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">${escapeHtml(authCopy("Sign in with password", "Bejelentkezés jelszóval"))}</button>
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.RESET}">${escapeHtml(authCopy("Reset password instead", "Jelszó visszaállítása"))}</button>
      </div>
    `;
  }

  return `
    <div class="auth-links-row">
      <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">${escapeHtml(authCopy("Back to password sign in", "Vissza a jelszavas bejelentkezéshez"))}</button>
      <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.MAGIC}">${escapeHtml(authCopy("Use email link instead", "Használj inkább emailes linket"))}</button>
    </div>
  `;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function markHandoffSeen() {
  window.localStorage.setItem(HANDOFF_STORAGE_KEY, "1");

  const url = new URL(window.location.href);
  if (url.searchParams.has("from")) {
    url.searchParams.delete("from");
    window.history.replaceState({}, "", url.toString());
  }
}

function getEventSource() {
  const params = new URLSearchParams(window.location.search);
  const from = trimText(params.get("from")).toLowerCase();

  if (from) {
    window.sessionStorage.setItem(DASHBOARD_SOURCE_KEY, from);
    return from;
  }

  return trimText(window.sessionStorage.getItem(DASHBOARD_SOURCE_KEY));
}

function trackProductEvent(eventName, options = {}) {
  const clientId = getClientId();
  const source = options.source ?? (getEventSource() || null);
  const onceKey = options.onceKey || null;

  if (!clientId || !eventName || !authSession?.access_token) {
    return;
  }

  if (onceKey && trackedEventKeys.has(onceKey)) {
    return;
  }

  if (onceKey) {
    trackedEventKeys.add(onceKey);
  }

  fetch("/product-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authSession.access_token}`,
    },
    keepalive: true,
    body: JSON.stringify({
      client_id: clientId,
      agent_id: options.agentId || null,
      event_name: eventName,
      source,
      metadata: options.metadata || null,
    }),
  }).catch(() => {
    // Keep the product experience smooth even if analytics logging fails.
  });
}

function getClientId() {
  let clientId = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);

  if (!clientId) {
    clientId = window.crypto?.randomUUID?.() || `client_${Date.now()}`;
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }

  return clientId;
}

function normalizeDashboardTheme(value = "") {
  const normalized = trimText(value).toLowerCase().replace(/[_\s]+/g, "-");

  if (normalized === "dark" || normalized === "dark-glass") {
    return "dark";
  }

  if (normalized === "system" || normalized === "auto") {
    return "system";
  }

  return "bright";
}

function resolveDashboardTheme(value = "") {
  const normalizedTheme = normalizeDashboardTheme(value);

  if (normalizedTheme !== "system") {
    return normalizedTheme;
  }

  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "bright";
  } catch {
    return "bright";
  }
}

function isSafeDashboardCustomBackgroundDataUrl(value = "") {
  const dataUrl = trimText(value);
  return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl);
}

function getSavedDashboardCustomBackground() {
  try {
    const savedDataUrl = window.localStorage.getItem(DASHBOARD_CUSTOM_BACKGROUND_STORAGE_KEY) || "";
    return isSafeDashboardCustomBackgroundDataUrl(savedDataUrl) ? savedDataUrl : "";
  } catch {
    return "";
  }
}

function hasDashboardCustomBackground() {
  return Boolean(getSavedDashboardCustomBackground());
}

function normalizeDashboardBackground(value = "") {
  const normalized = trimText(value).toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized === DASHBOARD_CUSTOM_BACKGROUND_ID && !hasDashboardCustomBackground()) {
    return DEFAULT_DASHBOARD_BACKGROUND;
  }

  return DASHBOARD_BACKGROUND_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : DEFAULT_DASHBOARD_BACKGROUND;
}

function normalizeDashboardBackgroundBlur(value = DEFAULT_DASHBOARD_BACKGROUND_BLUR) {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_DASHBOARD_BACKGROUND_BLUR;
  }

  return Math.min(
    DASHBOARD_BACKGROUND_BLUR_MAX,
    Math.max(DASHBOARD_BACKGROUND_BLUR_MIN, Math.round(parsedValue))
  );
}

function normalizeDashboardAppearanceChoice(value, allowedValues, defaultValue) {
  const normalized = trimText(value).toLowerCase().replace(/[_\s]+/g, "-");
  return allowedValues.includes(normalized) ? normalized : defaultValue;
}

function normalizeDashboardGlassTransparency(value = DEFAULT_DASHBOARD_GLASS_TRANSPARENCY) {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_DASHBOARD_GLASS_TRANSPARENCY;
  }

  return Math.min(
    DASHBOARD_GLASS_TRANSPARENCY_MAX,
    Math.max(DASHBOARD_GLASS_TRANSPARENCY_MIN, Math.round(parsedValue))
  );
}

function normalizeDashboardBackgroundDim(value = DEFAULT_DASHBOARD_BACKGROUND_DIM) {
  return normalizeDashboardAppearanceChoice(
    value,
    DASHBOARD_BACKGROUND_DIM_OPTIONS,
    DEFAULT_DASHBOARD_BACKGROUND_DIM
  );
}

function normalizeDashboardAccentGlow(value = DEFAULT_DASHBOARD_ACCENT_GLOW) {
  return normalizeDashboardAppearanceChoice(
    value,
    DASHBOARD_ACCENT_GLOW_OPTIONS,
    DEFAULT_DASHBOARD_ACCENT_GLOW
  );
}

function normalizeDashboardDensity(value = DEFAULT_DASHBOARD_DENSITY) {
  return normalizeDashboardAppearanceChoice(
    value,
    DASHBOARD_DENSITY_OPTIONS,
    DEFAULT_DASHBOARD_DENSITY
  );
}

function getDashboardAppearanceChoiceLabel(value = "") {
  return DASHBOARD_APPEARANCE_CHOICE_LABELS[trimText(value).toLowerCase()] || "Balanced";
}

function getDashboardBackgroundOption(value = "") {
  const normalizedBackground = normalizeDashboardBackground(value);
  const option = DASHBOARD_BACKGROUND_OPTIONS.find((item) => item.value === normalizedBackground)
    || DASHBOARD_BACKGROUND_OPTIONS[0];

  if (option?.type === "custom") {
    return {
      ...option,
      imageUrl: getSavedDashboardCustomBackground(),
    };
  }

  return option;
}

function normalizeDashboardLanguage(value = "") {
  return window.VonzaDashboardI18n?.normalizeLanguage?.(value) || "en";
}

function getDashboardLanguage() {
  return normalizeDashboardLanguage(dashboardLanguage);
}

function isHungarianDashboard() {
  return getDashboardLanguage() === "hu";
}

function localizeDashboardCopy(english = "", hungarian = "") {
  return isHungarianDashboard() ? hungarian : english;
}

function buildLegalLinksMarkup({ includeImprint = true, openInNewTab = false, className = "app-legal-links" } = {}) {
  const links = [
    { href: LEGAL_DOC_PATHS.terms, label: "ÁSZF" },
    { href: LEGAL_DOC_PATHS.privacy, label: "Adatkezelési tájékoztató" },
    { href: LEGAL_DOC_PATHS.cookies, label: "Cookie tájékoztató" },
  ];

  if (includeImprint) {
    links.push({ href: LEGAL_DOC_PATHS.imprint, label: "Impresszum" });
  }

  const targetAttrs = openInNewTab ? ' target="_blank" rel="noreferrer"' : "";

  return `
    <div class="${escapeHtml(className)}">
      ${links.map((link) => `<a href="${escapeHtml(link.href)}"${targetAttrs}>${escapeHtml(link.label)}</a>`).join("")}
    </div>
  `;
}

function buildAuthLegalBlock(mode) {
  const acknowledgement = mode === AUTH_VIEW_MODES.SIGN_UP
    ? localizeDashboardCopy(
      "Creating an account means you acknowledge the ÁSZF and the Adatkezelési tájékoztató.",
      "A fiók létrehozásával kijelented, hogy megismerted az ÁSZF-et és az Adatkezelési tájékoztatót."
    )
    : "";
  const intro = localizeDashboardCopy(
    "Legal and company information for the website, app, widget, and hosted checkout:",
    "A website, az app, a widget és a hosted checkout jogi és cégadatai:"
  );

  return `
    <div class="auth-legal app-legal-card">
      ${acknowledgement ? `<p class="auth-acknowledgement">${escapeHtml(acknowledgement)}</p>` : ""}
      <p class="app-legal-copy">${escapeHtml(intro)}</p>
      ${buildLegalLinksMarkup({ includeImprint: true, openInNewTab: true })}
    </div>
  `;
}

function buildAppLegalSurfaceMarkup(context = "workspace") {
  const copy = context === "billing"
    ? localizeDashboardCopy(
      "Hosted checkout, account access, the public website, and the widget are covered by these public legal pages.",
      "A hosted checkoutot, az account-hozzáférést, a publikus oldalt és a widgetet ezek a nyilvános jogi oldalak fedik le."
    )
    : localizeDashboardCopy(
      "These public pages keep the website, app, widget, and hosted checkout legal surface reachable from inside the workspace.",
      "Ezek a nyilvános oldalak a workspace-ből is elérhetővé teszik a website, az app, a widget és a hosted checkout jogi felületét."
    );

  return `
    <div class="app-legal-card">
      <p class="app-legal-copy">${escapeHtml(copy)}</p>
      ${buildLegalLinksMarkup({ includeImprint: true, openInNewTab: true })}
    </div>
  `;
}

const DASHBOARD_HU_COUNT_UNITS = Object.freeze({
  answer: "válasz",
  contact: "ügyfél",
  conversation: "beszélgetés",
  conversion: "konverzió",
  customer: "ügyfél",
  "customer issue": "ügyfélügy",
  "campaign approval": "kampányjóváhagyás",
  "campaign reply": "kampányválasz",
  "complaint-risk contact": "panaszkockázatos kapcsolat",
  "high-value contact": "magas értékű kapcsolat",
  issue: "ügy",
  item: "tétel",
  lead: "érdeklődő",
  "open issue": "nyitott ügy",
  reply: "válasz",
  "follow-up": "utánkövetés",
});

function getDashboardHungarianCountUnit(label = "") {
  const normalized = trimText(label).toLowerCase();
  return DASHBOARD_HU_COUNT_UNITS[normalized] || trimText(label);
}

function formatDashboardCountLabel(count, singular, plural = `${singular}s`, hungarian = singular) {
  return isHungarianDashboard()
    ? `${count} ${trimText(hungarian) === trimText(singular) ? getDashboardHungarianCountUnit(singular) : hungarian}`
    : `${count} ${count === 1 ? singular : plural}`;
}

function hasCachedDashboardLanguage() {
  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_LANGUAGE_STORAGE_KEY);
    return ["en", "hu"].includes(trimText(rawValue).toLowerCase());
  } catch {
    return false;
  }
}

function t(key, params = {}) {
  if (window.VonzaDashboardI18n?.t) {
    return window.VonzaDashboardI18n.t(key, params, getDashboardLanguage());
  }

  const template = DASHBOARD_ENGLISH_FALLBACKS[key] || key;
  return String(template).replace(/\{(\w+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  ));
}

const DASHBOARD_HU_PHRASES = Object.freeze({
  "Business profile, front desk, connected tools, and workspace.": "Vállalkozási profil, Front Desk, kapcsolt eszközök és munkaterület.",
  "Your clearest next steps, recent wins, and what needs attention.": "A legfontosabb következő lépések, friss sikerek és figyelmet igénylő ügyek.",
  "People, follow-ups, and the latest customer progress.": "Ügyfelek, utánkövetések és legfrissebb ügyfélfolyamatok.",
  "Preview the customer experience and launch readiness.": "Ügyfélélmény előnézete és indulási készenlét.",
  "Signals, proof, weak spots, and business results.": "Jelzések, bizonyítékok, gyenge pontok és üzleti eredmények.",
  "Go live on the website and verify the embed.": "Élesítés a weboldalon és a beágyazás ellenőrzése.",
  "Ready to use": "Használatra kész",
  "Getting started": "Kezdés alatt",
  "Website learned": "Weboldal betanítva",
  "Website learning": "Weboldal betanítása folyamatban",
  "Add website details": "Weboldaladatok hozzáadása",
  "Workspace": "Munkaterület",
  "Home": "Kezdőlap",
  "Knowledge": "Tudásanyag",
  "Install": "Telepítés",
  "Go live": "Élesítés",
  "Needs attention": "Figyelmet igényel",
  "Pending": "Függőben",
  "Limited": "Korlátozott",
  "Ready": "Kész",
  "Mixed": "Vegyes",
  "Mostly healthy": "Többnyire rendben",
  "Healthy": "Rendben",
  "No signal yet": "Még nincs jelzés",
  "Early": "Korai",
  "Complaint": "Panasz",
  "Lead": "Érdeklődő",
  "Needs reply": "Válaszra vár",
  "Resolved": "Megoldva",
  "Returning": "Visszatérő",
  "People waiting on an answer, follow-up, or decision.": "Válaszra, utánkövetésre vagy döntésre váró emberek.",
  "Unhappy or complaint-risk conversations.": "Elégedetlen vagy panasz-kockázatú beszélgetések.",
  "Warm contacts without a clear next step.": "Meleg érdeklődők egyértelmű következő lépés nélkül.",
  "Returning customers with recent activity.": "Visszatérő ügyfelek friss aktivitással.",
  "Open Home": "Kezdőlap megnyitása",
  "Open Customers": "Ügyfelek megnyitása",
  "Open customer": "Ügyfél megnyitása",
  "Open Analytics": "Elemzések megnyitása",
  "Open install": "Telepítés megnyitása",
  "Open settings": "Beállítások megnyitása",
  "Test preview first": "Előbb teszteld az előnézetet",
  "Review open needs": "Nyitott igények áttekintése",
  "Improve service answers": "Szolgáltatásválaszok javítása",
  "Copy install code": "Telepítőkód másolása",
  "Check install": "Telepítés ellenőrzése",
  "Business profile": "Vállalkozási profil",
  "Setup status": "Beállítás állapota",
  "Core business facts": "Alapvető vállalkozási adatok",
  "Before you go live": "Élesítés előtt",
  "Front desk ready for launch": "A Front Desk készen áll az élesítésre",
  "Front desk still needs setup": "A Front Desk még beállítást igényel",
  "Preview confidence": "Előnézeti biztonság",
  "Website knowledge": "Weboldali tudás",
  "Allowed domains": "Engedélyezett domainek",
  "After install is detected": "A telepítés észlelése után",
  "Home and Analytics become more trustworthy once live page loads, customer questions, and real conversion paths start flowing through the same shell.": "A Kezdőlap és az Elemzések megbízhatóbbá válnak, amint az éles oldalbetöltések, ügyfélkérdések és valódi konverziós utak ugyanabba a rendszerbe érkeznek.",
  "Open conversations still need a customer reply.": "A nyitott beszélgetésekhez még ügyfélválasz kell.",
  "Conversion rate": "Konverziós arány",
  "Lead or assisted conversion share of total conversations": "A leadek vagy támogatott konverziók aránya az összes beszélgetéshez képest",
  "Waiting for live conversations": "Élő beszélgetésekre vár",
  "AI usage": "AI-használat",
  "Plan capacity": "Csomagkapacitás",
  "Customers reached an unclear service answer.": "Az ügyfelek nem elég egyértelmű szolgáltatásválaszt kaptak.",
  "Complaint or support recovery still needs a clear owner path.": "A panasz- vagy támogatási helyreállításhoz még egyértelmű tulajdonosi út kell.",
  "Visitors asked about price, cost, or packages without a clear pricing next step.": "A látogatók árakról, költségekről vagy csomagokról kérdeztek egyértelmű árazási következő lépés nélkül.",
  "Warm visitors did not all become identified contacts.": "Nem minden érdeklődő látogatóból lett azonosított kapcsolat.",
  "Visitors asked about booking or availability without a clear booking path.": "A látogatók foglalásról vagy elérhetőségről kérdeztek egyértelmű foglalási út nélkül.",
  "Improve complaint handling": "Panaszkezelés javítása",
  "Frustrated customers need a fast, clear recovery path to protect trust.": "A frusztrált ügyfeleknek gyors, világos helyreállítási út kell a bizalom megőrzéséhez.",
  "Review the complaint, confirm the owner follow-up, and add guidance for similar cases.": "Nézd át a panaszt, erősítsd meg a tulajdonosi utánkövetést, és adj iránymutatást hasonló esetekre.",
  "Review complaint handling": "Panaszkezelés áttekintése",
  "Give open customer questions a clear next step": "Adj egyértelmű következő lépést a nyitott ügyfélkérdéseknek",
  "Unanswered needs create friction when the customer is ready for an answer, booking, contact, or decision.": "A megválaszolatlan igények súrlódást okoznak, amikor az ügyfél válaszra, foglalásra, kapcsolatfelvételre vagy döntésre kész.",
  "Review the open conversations and confirm the answer, owner follow-up, or next-step path each customer needs.": "Nézd át a nyitott beszélgetéseket, és erősítsd meg az ügyfeleknek szükséges választ, tulajdonosi utánkövetést vagy következő lépést.",
  "Clarify pricing guidance": "Árazási útmutatás pontosítása",
  "Pricing questions usually come from visitors who are close to deciding.": "Az árazási kérdések általában döntéshez közeli látogatóktól érkeznek.",
  "Add clearer pricing ranges, quote guidance, or what details are needed for an estimate.": "Adj világosabb ársávokat, ajánlatkérési útmutatást vagy becsléshez szükséges részleteket.",
  "Clarify pricing": "Árazás pontosítása",
  "Strengthen quote or booking guidance": "Ajánlatkérési vagy foglalási út javítása",
  "Booking or quote intent should move quickly to a clear next step.": "A foglalási vagy ajánlatkérési szándéknak gyorsan egyértelmű következő lépéshez kell jutnia.",
  "Make the booking, callback, or quote request path obvious and easy to complete.": "Tedd egyértelművé és könnyen elvégezhetővé a foglalási, visszahívási vagy ajánlatkérési utat.",
  "Improve booking path": "Foglalási út javítása",
  "Make contacting you easier": "Tedd könnyebbé a kapcsolatfelvételt",
  "Interested visitors can drop off if the best way to reach you is unclear.": "Az érdeklődő látogatók lemorzsolódhatnak, ha nem világos, hogyan érhetnek el.",
  "Show the best contact route and ask for the details your team needs to follow up.": "Mutasd meg a legjobb kapcsolatfelvételi utat, és kérd be az utánkövetéshez szükséges adatokat.",
  "Improve contact path": "Kapcsolatfelvételi út javítása",
  "Make service answers clearer": "Tedd világosabbá a szolgáltatásválaszokat",
  "Customers need to understand what you offer before they can choose the right service.": "Az ügyfeleknek érteniük kell, mit kínálsz, mielőtt a megfelelő szolgáltatást választják.",
  "Add clearer service descriptions, examples, or FAQ answers where the front desk was unsure.": "Adj világosabb szolgáltatásleírásokat, példákat vagy GYIK-válaszokat ott, ahol a Front Desk bizonytalan volt.",
  "No urgent improvements right now": "Most nincs sürgős javítanivaló",
  "AI priorities": "AI prioritások",
  "What to improve next": "Mit érdemes javítani",
  "These are the changes most likely to improve customer satisfaction and save time.": "Ezek a módosítások javíthatják leginkább az ügyfélélményt és időt takaríthatnak meg.",
  "Suggestions": "Javaslatok",
  "Home suggestions": "Kezdőlap javaslatai",
  "View-only summaries and draft suggestions built from your live workspace. Vonza does not silently act on your behalf.": "Csak megtekinthető összefoglalók és piszkozat-javaslatok az élő munkaterületedből. A Vonza nem cselekszik a háttérben a jóváhagyásod nélkül.",
  "View only": "Csak megtekintés",
  "Review first": "Előbb nézd át",
  "Mixed mode": "Vegyes mód",
  "Home headline": "Kezdőlapi fő üzenet",
  "Vonza is ready.": "A Vonza készen áll.",
  "Vonza is summarizing your current workspace only.": "A Vonza most csak az aktuális munkaterületedet foglalja össze.",
  "Business context progress will appear here.": "Itt jelenik meg az üzleti kontextus előrehaladása.",
  "Core business context is ready for suggestions.": "Az alap üzleti kontextus készen áll a javaslatokhoz.",
  "Open business context": "Üzleti kontextus megnyitása",
  "Vonza needs a little more context": "A Vonzának még egy kis kontextusra van szüksége",
  "There is not enough live workspace data yet for strong recommendations.": "Még nincs elég élő munkaterületi adat az erős javaslatokhoz.",
  "Current day": "Mai nap",
  "Home at a glance": "Kezdőlap röviden",
  "Only live current-day signals stay visible here.": "Itt csak a mai élő jelzések maradnak szem előtt.",
  "Messages today": "Mai üzenetek",
  "Current-day front desk volume only.": "Csak a mai Front Desk forgalom.",
  "Guided customers": "Továbbvezetett ügyfelek",
  "Results today": "Mai eredmények",
  "Recorded results from today only.": "Csak a ma rögzített eredmények.",
  "Items that still need a decision or review.": "Tételek, amelyek még döntést vagy áttekintést igényelnek.",
  "Proposals": "Javaslatok",
  "Approval-first proposals": "Jóváhagyás előtti javaslatok",
  "Compact owner-ready proposals stay front and center here.": "A rövid, tulajdonosnak szóló javaslatok itt maradnak elöl.",
  "Short summaries first. Extra detail only if you open it.": "Először a rövid összefoglalók jelennek meg. A részletek csak megnyitás után látszanak.",
  "No active proposals are waiting right now.": "Jelenleg nincs függő aktív javaslat.",
  "Review context": "Kontextus áttekintése",
  "Why this recommendation": "Miért ez a javaslat",
  "Home is the daily command page: current-day signals, compact proposals, and the clearest recommendations only.": "A Kezdőlap a napi irányító oldal: csak a mai jelzéseket, a rövid javaslatokat és a legfontosabb ajánlásokat mutatja.",
  "Connected tools beta": "Kapcsolt eszközök béta",
  "Workspace still syncing": "A munkaterület még szinkronizál",
  "Workspace ready": "A munkaterület készen áll",
  "Calendar is beta": "A naptár béta",
  "Calendar-heavy detail is not ready yet, so Home keeps this area informational for now.": "A naptárhoz kötődő részletes nézet még nincs kész, ezért a Kezdőlap ezt most csak tájékoztató jelleggel mutatja.",
  "Daily Schedule": "Mai időbeosztás",
  "Remaining schedule context and appointment detail.": "A hátralévő időbeosztás és időpont-részletek.",
  "No more appointments are on today’s schedule": "Mára nincs több időpont a naptárban",
  "Calendar beta": "Naptár béta",
  "Vonza will keep today’s remaining schedule here.": "A Vonza itt tartja szem előtt a mai hátralévő időbeosztást.",
  "Schedule context is not ready to use from the dashboard yet.": "Az időbeosztás kontextusa még nem használható az irányítópultból.",
  "Open context": "Kontextus megnyitása",
  "Follow-up": "Utánkövetés",
  "Appointments Needing Follow-up": "Utánkövetést igénylő időpontok",
  "Recent appointments that still need a clear next step.": "Friss időpontok, amelyekhez még egyértelmű következő lépés kell.",
  "No recent appointment follow-up is standing out": "Nem látszik friss kiemelt időpont-utánkövetés",
  "When an appointment ends without a clear next step, Vonza will surface it here.": "Ha egy időpont világos következő lépés nélkül zárul, a Vonza itt emeli ki.",
  "Review follow-up": "Utánkövetés áttekintése",
  "Linking": "Kapcsolás",
  "Appointments Not Linked to a Contact": "Kapcsolathoz nem kötött időpontok",
  "Calendar linking detail moved out of the default Home view.": "A naptárkapcsolási részletek kikerültek az alapértelmezett Kezdőlap nézetből.",
  "No appointment currently needs attendee linking": "Jelenleg nincs olyan időpont, amely résztvevő-kapcsolást igényelne",
  "Vonza will show unlinked attendees here when that context matters.": "A Vonza itt mutatja a nem kapcsolt résztvevőket, amikor ennek jelentősége van.",
  "Review attendee": "Résztvevő áttekintése",
  "Approval-first work": "Jóváhagyás előtti munka",
  "Outcome gaps": "Eredményhiányok",
  "Campaign replies": "Kampányválaszok",
  "Lifecycle progression": "Életciklus előrehaladás",
  "Proof": "Bizonyíték",
  "Recent successful outcomes": "Legutóbbi sikeres eredmények",
  "Outcome history stays available here without dominating Home.": "Az eredménytörténet itt elérhető marad anélkül, hogy eluralná a Kezdőlapot.",
  "Cross-channel result": "Csatornákon átívelő eredmény",
  "As soon as Vonza can prove bookings, quote requests, complaint resolutions, campaign replies, or follow-up results, they will appear here with source context.": "Amint a Vonza bizonyítani tud foglalásokat, ajánlatkéréseket, panaszmegoldásokat, kampányválaszokat vagy utánkövetési eredményeket, azok itt jelennek meg forráskontextussal.",
  "Show supporting detail": "Kiegészítő részletek megjelenítése",
  "Calendar, contacts, proof, and operational context": "Naptár, ügyfelek, bizonyítékok és működési kontextus",
  "Home card": "Kezdőlapi kártya",
  "Vonza will show the next useful context here.": "A Vonza itt mutatja a következő hasznos kontextust.",
  "Calendar appointment": "Naptárbejegyzés",
  "Linked": "Kapcsolva",
  "Needs a look": "Átnézést igényel",
  "Vonza highlighted this calendar item for review.": "A Vonza áttekintésre emelte ki ezt a naptárbejegyzést.",
  "Timing and context": "Időzítés és kontextus",
  "Context": "Kontextus",
  "Context is still loading.": "A kontextus még töltődik.",
  "Workflow status": "Folyamat állapota",
  "Linked to a contact": "Kapcsolathoz kötve",
  "Still needs linking or review": "Még kapcsolást vagy áttekintést igényel",
  "Suggestions are based on imported website knowledge plus current assistant contact settings. Nothing is saved until the owner reviews and submits.": "A javaslatok az importált weboldaltudásra és a jelenlegi asszisztens-kapcsolati beállításokra épülnek. Semmi sem kerül mentésre, amíg a tulajdonos át nem nézi és el nem küldi.",
  "The rest of the dashboard is still usable.": "Az irányítópult többi része továbbra is használható.",
  "messages": "üzenetek",
  "Service quality": "Szolgáltatás minősége",
  "Improve service": "Szolgáltatás javítása",
  "Dashboard language": "Irányítópult nyelve",
  "Theme": "Téma",
  "Default dashboard theme.": "Alapértelmezett irányítópult téma.",
  "Lower-light dashboard theme for the app shell.": "Sötétebb irányítópult téma az alkalmazás felületéhez.",
  "Saved as a dashboard preference on this device.": "Irányítópult-beállításként mentve ezen az eszközön.",
  "Open Mon-Fri, 9am-5pm. Same-day callbacks usually happen before 4pm.": "Nyitva H-P, 9:00-17:00. Az aznapi visszahívások általában 16:00 előtt történnek.",
  "Connected tools": "Kapcsolt eszközök",
  "Current workspace status": "Munkaterület aktuális állapota",
  "Workspace boundaries": "Munkaterület határai",
  "Save Business Profile": "Vállalkozási profil mentése",
  "Save Front Desk": "Front Desk mentése",
  "No changes yet.": "Nincs módosítás.",
  "No prefill available": "Nincs előtöltés",
  "Profile ready": "Profil kész",
  "Needs details": "Részletek szükségesek",
  "Safe suggestions loaded": "Biztonságos javaslatok betöltve",
  "Readiness": "Készenlét",
  "Prefill review": "Előtöltés áttekintése",
  "Business summary": "Vállalkozási összefoglaló",
  "Services": "Szolgáltatások",
  "Pricing": "Árazás",
  "Policies": "Szabályzatok",
  "Service areas / locations": "Kiszolgálási területek / helyszínek",
  "Operating hours": "Nyitvatartás",
  "Front Desk purpose": "Front Desk célja",
  "Identity and welcome": "Identitás és üdvözlés",
  "Routing defaults": "Alapértelmezett útvonalak",
  "Outcome routing and tracking": "Eredményútvonalak és mérés",
  "Website knowledge and brand": "Weboldali tudás és márka",
  "Current live readout": "Aktuális élő összefoglaló",
  "Assistant name": "Asszisztens neve",
  "Conversation tone": "Beszélgetési hangnem",
  "Launcher text": "Indítógomb szövege",
  "Website URL": "Weboldal URL",
  "Welcome message": "Üdvözlő üzenet",
  "Contact email": "Kapcsolati email",
  "Contact phone": "Kapcsolati telefon",
  "Availability note": "Elérhetőségi megjegyzés",
  "Booking URL": "Foglalási URL",
  "Quote URL": "Ajánlatkérési URL",
  "Checkout URL": "Fizetési URL",
  "Widget logo": "Widget logó",
  "Primary color": "Elsődleges szín",
  "Secondary color": "Másodlagos szín",
  "Website detail": "Weboldali részletek",
  "Front Desk behavior": "Front Desk működés",
  "Business context": "Vállalkozási kontextus",
  "Review progress": "Áttekintési állapot",
  "Live customer messages handled today.": "Ma kezelt élő ügyfélüzenetek.",
  "No conversations recorded yet today.": "Ma még nincs rögzített beszélgetés.",
  "Unique customers with a booking, follow-up, or recorded outcome today.": "Mai egyedi ügyfelek foglalással, utánkövetéssel vagy rögzített eredménnyel.",
  "No customer has a booking, follow-up, or recorded outcome yet today.": "Ma még nincs ügyfélhez kötött foglalás, utánkövetés vagy rögzített eredmény.",
  "Complaints or service issues still needing attention.": "Figyelmet igénylő panaszok vagy szolgáltatási ügyek.",
  "No active service issue signal is standing out.": "Nem látszik aktív szolgáltatási problémajelzés.",
  "Small proof that Vonza is helping today without making you dig through analytics.": "Rövid bizonyíték arra, hogy a Vonza ma is segít, elemzések böngészése nélkül.",
  "A booking, follow-up, or recorded outcome was tied to a customer today.": "Ma foglalás, utánkövetés vagy rögzített eredmény kapcsolódott ügyfélhez.",
  "Daily": "Napi",
  "Give open customer needs a clear next step": "Adj egyértelmű következő lépést a nyitott ügyféligényeknek",
  "Open needs create friction when a customer is waiting on an answer, booking path, contact route, or owner decision.": "A nyitott igények súrlódást okoznak, amikor az ügyfél válaszra, foglalási útra, kapcsolatfelvételre vagy tulajdonosi döntésre vár.",
  "Review the affected customers and confirm the useful answer, handoff, or next-step guidance each one still needs.": "Nézd át az érintett ügyfeleket, és erősítsd meg a szükséges választ, átadást vagy következő lépést.",
  "Review pricing questions": "Árazási kérdések áttekintése",
  "Clarify pricing answers and the quote next step": "Pontosítsd az árazási válaszokat és az ajánlatkérési következő lépést",
  "Customers asking about pricing need a more useful answer: what affects cost, what range to expect, or what to do next for a quote.": "Az árazásról kérdező ügyfelek hasznosabb választ igényelnek: mi befolyásolja a költséget, milyen ársáv várható, vagy mi a következő lépés ajánlatkéréshez.",
  "Pricing questions need clearer answers": "Az árazási kérdésekhez világosabb válaszok kellenek",
  "Hours and availability need clearer answers": "A nyitvatartási és elérhetőségi válaszok legyenek világosabbak",
  "Location or service-area answers need improvement": "A helyszín- vagy kiszolgálási terület-válaszok javítást igényelnek",
  "Support concerns need stronger guidance": "A támogatási ügyekhez erősebb útmutatás kell",
  "Service explanations are too vague": "A szolgáltatásmagyarázatok túl általánosak",
  "Weak-answer theme needs review": "A gyenge válasz témája áttekintést igényel",
  "closing complaint and support conversations faster": "panasz- és támogatási beszélgetések gyorsabb lezárása",
  "capturing more contact details from warm visitors": "több kapcsolatadat rögzítése meleg látogatóktól",
  "building more live conversation volume": "több élő beszélgetési adat gyűjtése",
  "turning warm conversations into leads": "meleg beszélgetések érdeklődőkké alakítása",
  "There is some conversation history, but not enough recent live usage to show a stronger trend yet.": "Van beszélgetési előzmény, de még nincs elég friss élő használat erősebb trendhez.",
  "Live customer traffic will appear here.": "Itt jelenik meg az élő ügyfélforgalom.",
  "Lead capture is keeping pace with demand": "Az érdeklődőrögzítés lépést tart az igénnyel",
  "Estimated from strong service-quality signals": "Erős szolgáltatásminőségi jelzések alapján becsülve",
  "Estimated as good, with room to tighten answers": "Jónak becsülve, némi válaszpontosítási lehetőséggel",
  "Estimated friction risk from current service signals": "Súrlódási kockázat a jelenlegi szolgáltatási jelzések alapján",
  "Waiting for enough live service signal to estimate": "Becsléshez elegendő élő szolgáltatási jelzésre vár",
  "Estimated from customer questions Vonza handled itself": "A Vonza által önállóan kezelt ügyfélkérdések alapján becsülve",
  "See whether support demand and completed next steps are moving in the right direction.": "Nézd meg, jó irányba halad-e a támogatási igény és a lezárt következő lépések száma.",
  "Conversations": "Beszélgetések",
  "Successful actions": "Sikeres műveletek",
  "Most customer conversations are still anonymous, which means lead capture is the clearest growth lever.": "A legtöbb ügyfélbeszélgetés még anonim, ezért az érdeklődőrögzítés a legegyértelműbb növekedési kar.",
  "Vonza is turning a healthy share of conversations into known customer records.": "A Vonza a beszélgetések egészséges arányát ismert ügyfélrekorddá alakítja.",
  "Contact identity will become more useful as more live conversations arrive.": "Az ügyfélazonosság egyre hasznosabb lesz, ahogy több élő beszélgetés érkezik.",
  "Use this to improve the answers customers see most often.": "Ezzel javíthatod az ügyfelek által leggyakrabban látott válaszokat.",
  "Customer question theme": "Ügyfélkérdés-téma",
  "No repeated customer question is standing out yet.": "Még nem emelkedik ki ismétlődő ügyfélkérdés.",
  "No weak-answer pattern is standing out in the current sample.": "A jelenlegi mintában nem látszik gyenge válaszminta.",
  "View details": "Részletek megnyitása",
  "Nothing here yet": "Itt még nincs tartalom",
  "Vonza will fill this area as soon as there is something useful to show.": "A Vonza feltölti ezt a részt, amint hasznos tartalom érkezik ide.",
  "Actions": "Műveletek",
  "Preview": "Előnézet",
  "Website / Context": "Weboldal / Kontextus",
  "Install / Launch": "Telepítés / Élesítés",
  "Add your website to personalize the Front Desk": "Add meg a weboldaladat, hogy személyre szabhasd a Front Desket",
  "No recent conversation summary yet.": "Még nincs összefoglaló a legutóbbi beszélgetésről.",
  "Needed help with a support issue": "Támogatási ügyben kért segítséget",
  "Asked about pricing and next steps": "Árazásról és következő lépésekről kérdezett",
  "Asked about pricing or quote details": "Árazásról vagy ajánlatkérés részleteiről kérdezett",
  "Needed help with booking or availability": "Foglalással vagy elérhetőséggel kapcsolatban kért segítséget",
  "Asked which service fits their needs": "Azt kérdezte, melyik szolgáltatás illik az igényeihez",
  "Wanted to contact the business": "Kapcsolatba akart lépni a vállalkozással",
  "Asked about hours or service area": "Nyitvatartásról vagy kiszolgálási területről kérdezett",
  "Started a new chat with the business": "Új beszélgetést indított a vállalkozással",
  "Asked for help choosing a next step": "Segítséget kért a következő lépés kiválasztásához",
  "Email user": "Emailes felhasználó",
  "Phone user": "Telefonos felhasználó",
  "Named visitor": "Azonosított látogató",
  "No current situation has been captured yet.": "Még nincs rögzítve aktuális helyzet.",
  "Risk is elevated. This customer may lose trust if the issue stays unanswered.": "Emelkedett a kockázat. Ez az ügyfél elveszítheti a bizalmát, ha az ügy megválaszolatlan marad.",
  "Lead intent is present, but momentum could fade if nobody replies soon.": "Az érdeklődési szándék látszik, de a lendület gyorsan elfogyhat, ha senki nem válaszol hamar.",
  "The conversation is still open and likely needs a team reply or follow-up.": "A beszélgetés még nyitott, és valószínűleg csapatválaszra vagy utánkövetésre van szükség.",
  "The latest interaction looks settled right now with no urgent action standing out.": "A legutóbbi interakció most rendezettnek tűnik, és nem látszik sürgős teendő.",
  "This looks like a returning relationship, so continuity matters more than a generic reply.": "Ez visszatérő kapcsolatnak látszik, ezért a folytonosság fontosabb, mint egy általános válasz.",
  "No strong risk signal is standing out yet.": "Még nem látszik erős kockázati jelzés.",
  "Send a calm reply, confirm the issue, and give one clear next step.": "Küldj nyugodt választ, erősítsd meg a problémát, és adj egy világos következő lépést.",
  "Answer the open question and guide this person toward a quote, booking, or decision.": "Válaszold meg a nyitott kérdést, és vezesd ezt az ügyfelet ajánlatkérés, foglalás vagy döntés felé.",
  "Reconnect with context from the last interaction and confirm the next step.": "Kapcsolódj vissza az előző interakció kontextusával, és erősítsd meg a következő lépést.",
  "Review the latest interaction and decide whether a follow-up is still needed.": "Nézd át a legutóbbi interakciót, és döntsd el, kell-e még utánkövetés.",
  "Apologize clearly, confirm the issue, and offer one specific next step with timing.": "Kérj világosan bocsánatot, erősítsd meg a problémát, és adj egy konkrét következő lépést időzítéssel.",
  "Thank them for reaching out, answer the open question, and suggest the clearest next step.": "Köszönd meg a megkeresést, válaszold meg a nyitott kérdést, és javasold a legvilágosabb következő lépést.",
  "Acknowledge the latest message, answer the main question, and confirm what happens next.": "Ismerd el a legutóbbi üzenetet, válaszold meg a fő kérdést, és erősítsd meg, mi történik ezután.",
  "Reference the previous interaction, check whether they still need help, and keep the reply warm and brief.": "Hivatkozz az előző interakcióra, ellenőrizd, hogy még szükségük van-e segítségre, és tartsd a választ meleg hangvételűnek és rövidnek.",
  "Unhappy or at-risk conversations that should not sit idle.": "Elégedetlen vagy kockázatos beszélgetések, amelyeket nem szabad magukra hagyni.",
  "People showing buying intent or asking for next-step details.": "Vásárlási szándékot mutató emberek vagy akik a következő lépés részleteire kérdeznek rá.",
  "Existing relationships where prior context should shape the next reply.": "Meglévő kapcsolatok, ahol az előző kontextusnak kell meghatároznia a következő választ.",
  "Open related conversation": "Kapcsolódó beszélgetés megnyitása",
  "Open inbox thread": "Email-szál megnyitása",
  "Open follow-up draft": "Utánkövetési piszkozat megnyitása",
  "Draft follow-up": "Utánkövetés piszkozat",
  "Review calendar action": "Naptárművelet áttekintése",
  "Schedule call": "Hívás ütemezése",
  "Open calendar": "Naptár megnyitása",
  "Draft campaign": "Kampánypiszkozat készítése",
  "Mark complaint resolved": "Panasz megoldottnak jelölése",
  "Escalate": "Eszkalálás",
  "Reply idea": "Válaszötlet",
  "Identifier": "Azonosító",
  "Previous interactions": "Korábbi interakciók",
  "Latest outcome": "Legutóbbi eredmény",
  "No recorded result yet": "Még nincs rögzített eredmény",
  "No recent outcome has been recorded.": "Nem lett rögzítve friss eredmény.",
  "Customer type": "Ügyféltípus",
  "Outcome mark": "Eredményjelölés",
  "Note": "Megjegyzés",
  "booked": "lefoglalva",
  "quote requested": "ajánlatkérés érkezett",
  "quote accepted": "ajánlat elfogadva",
  "follow-up successful": "utánkövetés sikeres",
  "complaint resolved": "panasz megoldva",
  "no outcome / manual note": "nincs eredmény / kézi megjegyzés",
  "Record outcome": "Eredmény rögzítése",
  "Current situation": "Jelenlegi helyzet",
  "Next best step": "Legjobb következő lépés",
  "Needs a follow-up": "Utánkövetést igényel",
  "At-risk relationships": "Kockázatos kapcsolatok",
  "No clear next step": "Nincs világos következő lépés",
  "Customers to check in with": "Ügyfelek, akikkel érdemes egyeztetni",
  "People who would benefit from a reply, a follow-up, or a next step.": "Olyan emberek, akiknek hasznos lenne egy válasz, utánkövetés vagy következő lépés.",
  "Customers or leads where support context should stay front and center.": "Ügyfelek vagy érdeklődők, akiknél a támogatási kontextusnak kell fókuszban maradnia.",
  "Interested people who still need a follow-up, booking, or quote path.": "Érdeklődők, akiknek még utánkövetésre, foglalási vagy ajánlatkérési útra van szükségük.",
  "Customers who could benefit from another touchpoint before momentum fades.": "Ügyfelek, akiknek hasznos lehet még egy érintkezési pont, mielőtt elillan a lendület.",
  "People records where Vonza can already point to a real result.": "Olyan ügyfélrekordok, ahol a Vonza már valódi eredményt tud felmutatni.",
  "Qualified or active leads that still need a real outcome, not just activity.": "Minősített vagy aktív érdeklődők, akiknek még valódi eredményre van szükségük, nem csak aktivitásra.",
  "Sparse record": "Hiányos rekord",
  "Overview": "Áttekintés",
  "What stays out of the way": "Mi marad háttérben",
  "Deeper configuration lives in Settings. Front Desk stays focused on readiness, preview, website grounding, and the path to launch.": "A részletesebb beállítások a Beállításokban vannak. A Front Desk az előkészítésre, az előnézetre, a weboldali megalapozásra és az élesítés útjára koncentrál.",
  "Try front desk": "Front Desk kipróbálása",
  "Open Front Desk settings": "Front Desk beállítások megnyitása",
  "Practice with Front Desk": "Gyakorlás a Front Deskkel",
  "Practice the answer customers will see.": "Gyakorold azt a választ, amit az ügyfelek látni fognak.",
  "Run a visitor-style question, mark the answer good, or teach the exact guidance Front Desk should use next time.": "Futtass látogatói stílusú kérdést, jelöld jónak a választ, vagy tanítsd meg a pontos útmutatást, amelyet a Front Desk legközelebb használjon.",
  "Ask a question as if you were a visitor.": "Tegyél fel kérdést úgy, mintha látogató lennél.",
  "Ask realistic questions, check the next step, and make sure the next step feels helpful and on-brand.": "Tegyél fel valósághű kérdéseket, ellenőrizd a következő lépést, és győződj meg róla, hogy hasznosnak és márkához illőnek hat.",
  "Open full-page assistant": "Teljes oldalas asszisztens megnyitása",
  "Reset conversation": "Beszélgetés visszaállítása",
  "Refresh website details": "Weboldal részleteinek frissítése",
  "Website connected": "Weboldal kapcsolódva",
  "Website detail loaded": "Weboldal részletei betöltve",
  "More website detail would help": "Több weboldalrészlet segítene",
  "Website detail not loaded yet": "A weboldal részletei még nincsenek betöltve",
  "Practice mode — visitors will not see this conversation.": "Gyakorló mód — a látogatók nem látják ezt a beszélgetést.",
  "Owner review path": "Tulajdonosi áttekintési út",
  "Looks good keeps the answer as-is. Teach this answer opens the improvement form. Save as improvement creates guidance you can publish.": "A Jól néz ki változatlanul hagyja a választ. A Tanítsd ezt a választ megnyitja a javító űrlapot. A Mentés javításként közzétehető útmutatást hoz létre.",
  "Next action": "Következő lépés",
  "Fix weak answers first": "Először javítsd a gyenge válaszokat",
  "Publish reviewed guidance": "Tedd közzé az átnézett útmutatást",
  "Ground Front Desk in real business facts": "Alapozd a Front Desket valós üzleti tényekre",
  "Finish the Front Desk setup": "Fejezd be a Front Desk beállítását",
  "Prepare the hosted Front Desk page": "Készítsd elő a hosztolt Front Desk oldalt",
  "Keep testing the live Front Desk": "Teszteld tovább az élő Front Desket",
  "Practice once, enable the public page, then share the direct link or QR before treating the optional widget as secondary.": "Gyakorolj egyszer, engedélyezd a nyilvános oldalt, majd oszd meg a közvetlen linket vagy QR-t, mielőtt az opcionális widgetet másodlagosként kezelnéd.",
  "Open improvements": "Javítások megnyitása",
  "Review drafts": "Piszkozatok áttekintése",
  "Open knowledge": "Tudás megnyitása",
  "Open launch": "Élesítés megnyitása",
  "Practice a reply": "Válasz gyakorlása",
  "Active section": "Aktív szakasz",
  "Focused operator view": "Fókuszált operátori nézet",
  "Answer quality": "Válaszminőség",
  "No queued fixes": "Nincs sorban álló javítás",
  "Setup needed": "Beállítás szükséges",
  "Hosted page first, widget optional": "Először hosztolt oldal, a widget opcionális",
  "AI Front Desk workspace": "AI Front Desk munkaterület",
  "Operator command center": "Operátori vezérlőközpont",
  "Front Desk is the primary customer surface.": "A Front Desk az elsődleges ügyféloldali felület.",
  "No website URL": "Nincs megadott weboldal URL",
  "Prompt starters": "Indító kérdések",
  "Use a few realistic customer questions to see whether the Front Desk sounds grounded and offers the right next step.": "Használj néhány valósághű ügyfélkérdést, hogy lásd, mennyire megalapozott a Front Desk, és a megfelelő következő lépést ajánlja-e.",
  "What services do you offer?": "Milyen szolgáltatásokat kínáltok?",
  "Can I book with you?": "Tudok nálatok foglalni?",
  "Can I get a quote?": "Kérhetek ajánlatot?",
  "How can I contact you?": "Hogyan tudlak elérni benneteket?",
  "Embedded preview": "Beágyazott előnézet",
  "What should Front Desk say instead?": "Mit mondjon helyette a Front Desk?",
  "Move Vonza from preview into the live website with a clear install path, verification, and honest status reporting.": "Vidd át a Vonzát az előnézetből az éles weboldalra világos telepítési úttal, ellenőrzéssel és őszinte állapotjelzéssel.",
  "Preview is available, so you can test the customer-facing flow before launch.": "Az előnézet elérhető, így az ügyféloldali folyamatot élesítés előtt tesztelheted.",
  "Preview will appear as soon as the front desk has a public key.": "Az előnézet megjelenik, amint a Front Desk kap egy nyilvános kulcsot.",
  "No domains saved yet.": "Még nincs mentett domain.",
  "Refreshing from live usage": "Frissítés élő használatból",
  "warm chats still anonymous": "meleg chat még anonim",
  "No complaint risk recorded yet": "Még nincs rögzített panasz-kockázat",
  "Top customer question themes": "Leggyakoribb ügyfélkérdés-témák",
  "These are the strongest recurring questions or themes showing up in real visitor usage.": "Ezek a legerősebb visszatérő kérdések vagy témák, amelyek valódi látogatói használatban jelennek meg.",
  "Vonza will show grouped customer question themes here as soon as real usage comes in.": "A Vonza itt csoportosítva mutatja az ügyfélkérdés-témákat, amint megérkezik a valódi használat.",
  "Owner attention now": "Tulajdonosi figyelmet igényel",
  "These are the flagged conversations that still need an owner decision, follow-up, or final resolution.": "Ezek azok a jelölt beszélgetések, amelyek még tulajdonosi döntést, utánkövetést vagy végső lezárást igényelnek.",
  "Intent signals": "Szándékjelzések",
  "A fast read on the kinds of conversations visitors are trying to have with the business.": "Gyors áttekintés arról, milyen beszélgetéseket próbálnak kezdeményezni a látogatók a vállalkozással.",
  "Outcome proof": "Eredménybizonyíték",
  "This is where Vonza stops looking like activity tracking and starts proving business impact.": "Itt válik a Vonza egyszerű aktivitáskövetésből valódi üzleti hatás bizonyítékává.",
  "What to do next": "Mi legyen a következő lépés",
  "No weak-answer signal yet. Once customers ask questions that Vonza struggles to answer, they will show up here instead of being hidden behind a fake success state.": "Még nincs gyenge válaszjelzés. Amint az ügyfelek olyan kérdéseket tesznek fel, amelyekre a Vonza nehezen válaszol, itt jelennek meg a mesterséges sikerállapot helyett.",
  "No queue items need owner attention right now. Resolved items and dismissed items stay out of the way here.": "Jelenleg nincs olyan tétel a sorban, amely tulajdonosi figyelmet igényelne. A lezárt és elvetett tételek itt nem zavarják a munkát.",
  "No real customer question themes yet. Once the assistant is live and visitors start using it, Vonza will group the strongest recurring questions here.": "Még nincs valódi ügyfélkérdés-téma. Amint az asszisztens élesben működik és a látogatók használni kezdik, a Vonza itt csoportosítja a legerősebb visszatérő kérdéseket.",
  "This question ended in a weak or uncertain answer and is a good candidate for improvement.": "Ez a kérdés gyenge vagy bizonytalan válasszal zárult, ezért jó jelölt a javításra.",
  "This is the current high-intent to route to click to outcome chain.": "Ez a jelenlegi magas szándék -> útvonal -> kattintás -> eredmény lánc.",
  "No outcome-linked pages yet. As soon as Vonza confirms real business results, the strongest pages will show here.": "Még nincs eredményhez kötött oldal. Amint a Vonza valódi üzleti eredményeket erősít meg, itt jelennek meg a legerősebb oldalak.",
  "Keep the Front Desk focused on value, clarity, and launch readiness.": "Tartsd a Front Desket az értékre, az egyértelműségre és az élesítési készenlétre fókuszálva.",
  "This overview keeps the essentials in view: what already looks strong, what is worth improving, and where to go next.": "Ez az áttekintés szem előtt tartja a lényeget: mi működik már jól, min érdemes javítani, és merre tovább.",
  "Looking good": "Jól áll",
  "Ground the Front Desk in what your business actually does.": "Alapozd a Front Desket arra, amit a vállalkozásod valóban csinál.",
  "Keep website detail, business context, and behavior summary together so the Front Desk sounds trustworthy before it goes live.": "Tartsd együtt a weboldal részleteit, az üzleti kontextust és a működési összefoglalót, hogy a Front Desk megbízhatónak hasson az élesítés előtt.",
  "Review business context": "Üzleti kontextus áttekintése",
  "Edit Front Desk behavior": "Front Desk működés szerkesztése",
  "Website": "Weboldal",
  "No website configured": "Nincs megadott weboldal",
  "Pages learned": "Betanított oldalak",
  "No pages imported yet": "Még nincs importált oldal",
  "Import status": "Importálás állapota",
  "Website import": "Weboldal importálása",
  "Running": "Fut",
  "Website import status will appear here.": "A weboldal importálási állapota itt jelenik meg.",
  "Website import is running for Front Desk knowledge.": "A weboldal importálása fut a Front Desk tudásanyagához.",
  "Website content is available, but semantic indexing needs a retry before answers are fully optimized.": "A weboldali tartalom elérhető, de a szemantikus indexeléshez újrapróbálás kell, mielőtt a válaszok teljesen optimalizáltak lennének.",
  "Website import needs a retry before Front Desk knowledge is current.": "A weboldal importálását újra kell próbálni, hogy a Front Desk tudása naprakész legyen.",
  "Retry website import": "Weboldal importálásának újrapróbálása",
  "Retry website knowledge import": "Weboldali tudás importálásának újrapróbálása",
  "Retry starts a fresh async import for the full-page Front Desk knowledge base.": "Az újrapróbálás új aszinkron importot indít a teljes oldalas Front Desk tudásbázisához.",
  "Retry import": "Import újrapróbálása",
  "Fill setup gaps": "Beállítási hiányok kitöltése",
  "Review business profile": "Üzleti profil áttekintése",
  "Keep services, pricing, hours, location, and policies current.": "Tartsd naprakészen a szolgáltatásokat, árakat, nyitvatartást, helyszínt és szabályzatokat.",
  "Ground answers in the real website and business profile.": "Alapozd a válaszokat a valódi weboldalra és üzleti profilra.",
  "Only saved website knowledge, setup status, and reviewed business context appear here.": "Itt csak a mentett weboldali tudás, beállítási állapot és átnézett üzleti kontextus jelenik meg.",
  "Usable, but needs another pass": "Használható, de kell még egy kör",
  "Owner action": "Tulajdonosi teendő",
  "No required setup gaps are standing out.": "Nem látszik kötelező beállítási hiány.",
  "Business knowledge": "Üzleti tudás",
  "Services, pricing, policies, hours, and location": "Szolgáltatások, árak, szabályzatok, nyitvatartás és helyszín",
  "No approved business profile summary is saved yet.": "Még nincs mentett, jóváhagyott üzleti profil összefoglaló.",
  "Business context is in a strong place for customer-facing conversations.": "Az üzleti kontextus jó állapotban van az ügyféloldali beszélgetésekhez.",
  "Edit deeper facts": "Részletesebb tények szerkesztése",
  "Open Settings → Business Profile": "Beállítások → Üzleti profil megnyitása",
  "Business context readiness will appear here once the owner starts reviewing the profile.": "Az üzleti kontextus készenléte akkor jelenik meg itt, amikor a tulajdonos elkezdi áttekinteni a profilt.",
  "Known content": "Ismert tartalom",
  "Missing setup": "Hiányzó beállítás",
  "Customer impact": "Ügyfélhatás",
  "The Front Desk is ready to answer with solid business context.": "A Front Desk készen áll, hogy stabil üzleti kontextussal válaszoljon.",
  "The Front Desk can already help, and another import should make answers stronger.": "A Front Desk már most is tud segíteni, és egy újabb import tovább erősítheti a válaszokat.",
  "Import your site to give the Front Desk more specific business detail.": "Importáld az oldaladat, hogy a Front Desk pontosabb üzleti részleteket kapjon.",
  "Launcher": "Indítógomb",
  "Purpose": "Cél",
  "Primary route": "Elsődleges útvonal",
  "Advanced guidance": "Speciális útmutatás",
  "Added": "Hozzáadva",
  "Not added yet": "Még nincs hozzáadva",
  "Business grounding": "Üzleti megalapozás",
  "Today": "Ma",
  "Follow-ups": "Utánkövetések",
  "Performance": "Teljesítmény",
  "Front Desk page, QR, and optional bubble": "Front Desk oldal, QR és opcionális buborék",
  "Privacy and workspace": "Adatvédelem és munkaterület",
  "Not detected on a live site yet": "Még nincs észlelve élő oldalon",
  "Review replies": "Válaszok áttekintése",
  "View analytics": "Elemzések megtekintése",
  "not available yet": "még nem elérhető",
  "Leads captured": "Rögzített érdeklődők",
  "All customers": "Minden ügyfél",
  "Show customers needing help": "Segítséget igénylő ügyfelek",
  "General": "Általános",
  "Business Profile": "Üzleti profil",
  "Account & Billing": "Fiók és számlázás",
  "Privacy & Legal": "Adatvédelem és jogi információk",
  "Workspace status, dashboard language, and launch posture.": "Munkaterület állapota, irányítópult nyelve és élesítési állapot.",
  "Identity, full-page assistant, routing, and optional widget.": "Identitás, teljes oldalas asszisztens, útvonalak és opcionális widget.",
  "Grounding facts and readiness for customer answers.": "Megalapozó tények és készenlét az ügyfélválaszokhoz.",
  "Public trust, privacy, and legal pages.": "Publikus bizalmi, adatvédelmi és jogi oldalak.",
  "Business profile readiness summary": "Üzleti profil készenléti összefoglaló",
  "Answer grounding": "Válaszok megalapozása",
  "Business profile readiness will appear here.": "Az üzleti profil készenléte itt jelenik meg.",
  "Website knowledge status appears after import.": "A weboldali tudás állapota importálás után jelenik meg.",
  "Website import suggestions are not available yet. Run website import to unlock more grounded suggestions.": "A weboldal-import javaslatai még nem érhetők el. Futtasd a weboldal importálását a megalapozottabb javaslatokhoz.",
  "Set the website Vonza should learn from, and review the current import status.": "Add meg, melyik weboldalból tanuljon a Vonza, és nézd át az aktuális importálási állapotot.",
  "Changing this website uses the existing assistant save flow and runs website import afterward.": "A weboldal módosítása a meglévő asszisztensmentési folyamatot használja, majd weboldal-importot futtat.",
  "Import website knowledge": "Weboldali tudás importálása",
  "Save website": "Weboldal mentése",
  "Business Profile readiness": "Üzleti profil készenléte",
  "Review what is ready and what still needs detail before this profile supports live customer questions.": "Nézd át, mi áll készen és mi igényel még részleteket, mielőtt ez a profil élő ügyfélkérdéseket támogat.",
  "Front Desk launch settings summary": "Front Desk élesítési beállítások összefoglalója",
  "Hosted full-page assistant": "Hosztolt teljes oldalas asszisztens",
  "Ready for direct links, QR codes, WordPress pages, and smart embeds.": "Kész közvetlen linkekhez, QR-kódokhoz, WordPress oldalakhoz és okos beágyazásokhoz.",
  "Enable public access before sharing links, QR codes, or page embeds.": "Engedélyezd a publikus hozzáférést linkek, QR-kódok vagy oldalbeágyazások megosztása előtt.",
  "Launch routing": "Élesítési útvonalak",
  "Needs routes": "Útvonalak szükségesek",
  "Contact, booking, quote, or checkout destinations are available for customer next steps.": "Kapcsolatfelvételi, foglalási, ajánlatkérési vagy fizetési célok elérhetők az ügyfél következő lépéseihez.",
  "Add contact, booking, quote, or checkout destinations before relying on handoffs.": "Adj meg kapcsolatfelvételi, foglalási, ajánlatkérési vagy fizetési célokat, mielőtt az átadásokra támaszkodsz.",
  "Secondary launcher. The hosted Front Desk page remains the primary customer-facing surface.": "Másodlagos indító. A hosztolt Front Desk oldal marad az elsődleges ügyféloldali felület.",
  "Hosted page live": "Hosztolt oldal él",
  "Hosted page off": "Hosztolt oldal kikapcsolva",
  "Configure the customer-facing Front Desk page first, then routing, appearance, and the optional website widget.": "Először az ügyféloldali Front Desk oldalt állítsd be, utána az útvonalakat, a megjelenést és az opcionális weboldali widgetet.",
  "Full-page assistant and hosted page": "Teljes oldalas asszisztens és hosztolt oldal",
  "Account and billing summary": "Fiók- és számlázási összefoglaló",
  "Owner access": "Tulajdonosi hozzáférés",
  "Subscription": "Előfizetés",
  "Monthly capacity": "Havi kapacitás",
  "Owner account unavailable": "A tulajdonosi fiók nem érhető el",
  "Monthly capacity status appears after billing sync.": "A havi kapacitás állapota számlázási szinkron után jelenik meg.",
  "Public legal pages": "Publikus jogi oldalak",
  "These links are presented as operational references for owner review and public trust checks.": "Ezek a linkek működési hivatkozásként szolgálnak tulajdonosi áttekintéshez és publikus bizalmi ellenőrzésekhez.",
  "Dashboard language, appearance, and workspace status.": "Irányítópult nyelve, megjelenés és munkaterület-állapot.",
  "Customer-facing behavior, welcome, routing, and launch readiness.": "Ügyféloldali működés, üdvözlés, útvonalak és élesítési készenlét.",
  "Business facts Vonza uses to answer customer questions.": "Üzleti tények, amelyekből a Vonza ügyfélkérdésekre válaszol.",
  "Real account, plan, subscription, and usage status.": "Valós fiók-, csomag-, előfizetés- és használati állapot.",
  "Public legal pages and privacy links.": "Publikus jogi oldalak és adatvédelmi linkek.",
  "Settings section": "Beállítási szakasz",
  "Workspace preferences": "Munkaterület beállításai",
  "Dashboard language and theme are real workspace preferences for this browser/session.": "Az irányítópult nyelve és témája valós munkaterület-beállítás ebben a böngészőben/munkamenetben.",
  "Workspace status": "Munkaterület állapota",
  "Operational readiness from the existing auth, activation, install, and Front Desk setup state.": "Működési készenlét a meglévő belépési, aktiválási, telepítési és Front Desk beállítási állapotból.",
  "Lightweight account and workspace state from the existing auth and activation flow.": "Egyszerű fiók- és munkaterület-állapot a meglévő belépési és aktiválási folyamatból.",
  "Owner account": "Tulajdonosi fiók",
  "Workspace mode": "Munkaterület mód",
  "Hosted Front Desk page": "Hosztolt Front Desk oldal",
  "Front Desk page": "Front Desk oldal",
  "QR / direct link": "QR / direkt link",
  "WordPress / smart embed": "WordPress / okos beágyazás",
  "Primary": "Elsődleges",
  "Live for links, QR, and embeds": "Élő linkekhez, QR-hez és beágyazásokhoz",
  "Enable before launch": "Élesítés előtt engedélyezd",
  "Launch readiness": "Élesítési készenlét",
  "Core setup ready": "Az alapbeállítás kész",
  "Knowledge limited": "A tudás korlátozott",
  "Optional widget": "Opcionális widget",
  "Optional website widget": "Opcionális weboldali widget",
  "Your main workspace is ready.": "A fő munkaterületed készen áll.",
  "Run a real practice conversation": "Futtass egy valódi gyakorló beszélgetést",
  "Practice first": "Gyakorolj először",
  "Step 1": "1. lépés",
  "Step 2": "2. lépés",
  "Step 3": "3. lépés",
  "Worth a quick pass": "Gyors áttekintést érdemel",
  "Needs setup": "Beállítás szükséges",
  "Practice question": "Gyakorló kérdés",
  "Send practice question": "Gyakorló kérdés küldése",
  "Use Practice to confirm how the Front Desk answers, guides the next step, and captures lead intent before you publish it.": "Használd a Gyakorlást annak ellenőrzésére, hogyan válaszol a Front Desk, hogyan vezeti a következő lépést, és hogyan rögzíti az érdeklődői szándékot az élesítés előtt.",
  "Finish the Front Desk setup first so Vonza can generate a live assistant page for practice.": "Előbb fejezd be a Front Desk beállítását, hogy a Vonza élő asszisztensoldalt tudjon készíteni a gyakorláshoz.",
  "Move into the install flow": "Lépj tovább a telepítési folyamatba",
  "The core setup is strong enough to hand off into Install, where the snippet, verification, and live-domain details already belong.": "Az alapbeállítás már elég erős ahhoz, hogy átadd a Telepítésnek, ahol a kódrészlet, az ellenőrzés és az élő domain részletei vannak a helyükön.",
  "Tighten the front-desk behavior and grounding first, then use Install for the final publishing path.": "Előbb pontosítsd a Front Desk működését és megalapozását, majd használd a Telepítést a végső közzétételi úthoz.",
  "Why Install still lives separately": "Miért marad külön a Telepítés",
  "Front Desk owns the launch handoff, while the snippet, verification, and domain checks stay in the Install view where they are easier to manage.": "A Front Desk kezeli az élesítés átadását, míg a kódrészlet, az ellenőrzés és a domainellenőrzések a Telepítés nézetben maradnak, ahol könnyebb őket kezelni.",
  "Use the stable head snippet with your install id so Vonza can verify the right site.": "Használd a stabil head-kódrészletet a telepítési azonosítóddal, hogy a Vonza a megfelelő oldalt tudja ellenőrizni.",
  "Paste it into the live site head, theme layout, or global custom code area.": "Illeszd be az éles oldal head részébe, a sablon elrendezésébe vagy a globális egyéni kód területre.",
  "Run the server check, then wait for the widget to ping back from a real page load.": "Futtasd a szerverellenőrzést, majd várd meg, hogy a widget visszajelezzen egy valódi oldalbetöltésből.",
  "You are live.": "Élesben vagy.",
  "Snippet verified.": "Kódrészlet ellenőrizve.",
  "Setup path: copy the code, publish it in the live site head, run verification, then test the front desk as a customer.": "Beállítási út: másold ki a kódot, tedd közzé az éles oldal head részében, futtasd az ellenőrzést, majd teszteld a Front Desket ügyfélként.",
  "Done": "Kész",
  "Detected": "Észlelve",
  "View code": "Kód megtekintése",
  "Keep it simple: place the script in the live site head. Vonza will verify the snippet server-side and mark the install live once a real page load pings back.": "Tartsd egyszerűen: helyezd a szkriptet az éles oldal head részébe. A Vonza szerveroldalon ellenőrzi a kódrészletet, és élőnek jelöli a telepítést, amint egy valódi oldalbetöltés visszajelez.",
  "Install will be available as soon as your front desk has a live install id.": "A Telepítés elérhetővé válik, amint a Front Desk élő telepítési azonosítót kap.",
  "This becomes the final step once your front desk feels ready to go live.": "Ez lesz az utolsó lépés, amikor a Front Desk készen áll az élesítésre.",
  "Questions and weak answers": "Kérdések és gyenge válaszok",
  "Customer satisfaction": "Ügyfél-elégedettség",
  "Feedback recovery loop": "Visszajelzés-helyreállítási kör",
  "Helpful and not-helpful reply feedback is mapped into answer fixes, customer replies, and owner-visible notices.": "A hasznos és nem hasznos válaszvisszajelzések válaszjavításokká, ügyfélválaszokká és tulajdonosnak látható jelzésekké alakulnak.",
  "Owner notifications": "Tulajdonosi értesítések",
  "Unhappy answers": "Elégedetlen válaszok",
  "Next recovery actions": "Következő helyreállítási lépések",
  "No unhappy customers, high-intent leads, or unanswered-question notices are active right now.": "Jelenleg nincs aktív elégedetlen ügyfél, erős érdeklődő vagy megválaszolatlan kérdés jelzés.",
  "No not-helpful reply feedback has been recorded yet.": "Még nincs rögzített nem hasznos válaszvisszajelzés.",
  "Once visitors rate answers, Vonza will point owners toward fix-knowledge or reply-to-customer work.": "Amint a látogatók értékelik a válaszokat, a Vonza tudásjavításra vagy ügyfélválaszra irányítja a tulajdonost.",
  "Reply feedback analytics are waiting for the feedback migration on this workspace.": "A válaszvisszajelzés-elemzés a visszajelzési migrációra vár ebben a munkaterületben.",
  "What stands out right now": "Mi emelkedik ki most",
  "turning pricing questions into confident next steps": "az árazási kérdések magabiztos következő lépésekké alakítása",
  "answering first questions without extra owner effort": "az első kérdések megválaszolása extra tulajdonosi munka nélkül",
  "handling service questions calmly": "a szolgáltatási kérdések nyugodt kezelése",
  "Strength": "Erősség",
  "Weakness": "Gyengeség",
  "Opportunity": "Lehetőség",
  "Threat": "Kockázat",
  "Dashboard sidebar": "Irányítópult oldalsáv",
  "Open navigation": "Navigáció megnyitása",
  "Menu": "Menü",
  "View timeline": "Idővonal megnyitása",
  "Recent": "Nemrég",
  "Activity": "Aktivitás",
  "No additional note stored for this interaction.": "Ehhez az interakcióhoz nincs további tárolt megjegyzés.",
  "Prepare reply": "Válasz előkészítése",
  "Review suggested reply": "Javasolt válasz áttekintése",
  "Open conversation": "Beszélgetés megnyitása",
  "Review customer": "Ügyfél áttekintése",
  "Mark resolved": "Megoldottnak jelölés",
  "friendly": "barátságos",
  "professional": "professzionális",
  "sales": "értékesítési",
  "support": "támogatási",
  "contact": "kapcsolatfelvétel",
  "booking": "foglalás",
  "quote": "ajánlatkérés",
  "checkout": "fizetés",
  "capture": "adatbekérés",
  "chat": "chat",
  "path prefix": "útvonal előtag",
  "exact": "pontos egyezés",
  "automatic only": "csak automatikus",
  "allow owner mark fallback": "tulajdonosi jelölési tartalék engedélyezése",
  "New": "Új",
  "Active Lead": "Aktív érdeklődő",
  "Qualified": "Minősített",
  "Support Issue": "Támogatási ügy",
  "Complaint Risk": "Panaszkockázat",
  "Dormant": "Inaktív",
  "Source": "Forrás",
  "Intent": "Szándék",
  "Status": "Állapot",
  "All": "Összes",
  "Identified": "Azonosított",
  "Guests": "Vendégek",
  "Needs review": "Áttekintést igényel",
  "Follow-up possible": "Utánkövetés lehetséges",
  "New leads": "Új érdeklődők",
  "Warm leads": "Meleg érdeklődők",
  "Missing contact details": "Hiányzó kapcsolatadatok",
  "Search customers": "Ügyfelek keresése",
  "Search by name, email, phone, or conversation": "Keresés név, email, telefon vagy beszélgetés alapján",
  "Last seen": "Utoljára észlelve",
  "Customer": "Ügyfél",
  "Website widget": "Weboldali widget",
  "Full-page assistant": "Teljes oldalas asszisztens",
  "QR touchpoint": "QR érintkezési pont",
  "Chat unavailable on guest visitor rows until identity is captured.": "A chat vendég látogatóknál addig nem elérhető, amíg nincs rögzített azonosító.",
  "Trend unavailable: daily lead comparison is not in this workflow yet.": "A trend nem elérhető: a napi érdeklődő-összehasonlítás még nem része ennek a folyamatnak.",
  "Live count from saved customer records.": "Élő szám a mentett ügyfélrekordokból.",
  "Customers or guests waiting on a reply, decision, or review.": "Válaszra, döntésre vagy áttekintésre váró ügyfelek vagy vendégek.",
  "Front Desk readiness": "Front Desk készenlét",
  "Focused work that needs owner attention.": "Tulajdonosi figyelmet igénylő fókuszált munka.",
  "Source activity": "Forrásaktivitás",
  "Where conversations started today.": "Hol indultak ma a beszélgetések.",
  "Latest events across entry points.": "Legutóbbi események belépési pontonként.",
  "Review": "Áttekintés",
  "AI handled": "AI kezelte",
  "A test or customer conversation exists.": "Van teszt- vagy ügyfélbeszélgetés.",
  "The AI Front Desk workspace exists.": "Az AI Front Desk munkaterület létrejött.",
  "The front desk has the core details it needs.": "A Front Desk rendelkezik a szükséges alapadatokkal.",
  "Public Front Desk page": "Publikus Front Desk oldal",
  "At least one Front Desk distribution path is available.": "Legalább egy Front Desk terjesztési út elérhető.",
  "Launch health for the customer-facing Front Desk page.": "Az ügyféloldali Front Desk oldal élesítési állapota.",
  "Training ready": "Tanítás kész",
  "Vonza has usable business knowledge for customer answers.": "A Vonza használható üzleti tudással rendelkezik az ügyfélválaszokhoz.",
  "Website knowledge and grounding are ready for practice.": "A weboldali tudás és megalapozás készen áll a gyakorlásra.",
  "Enable the public assistant page before sharing QR codes or links.": "Engedélyezd a publikus asszisztensoldalt QR-kódok vagy linkek megosztása előtt.",
  "First test conversation": "Első tesztbeszélgetés",
  "Distribution channel selected": "Terjesztési csatorna kiválasztva",
  "Front Desk created": "Front Desk létrehozva",
  "Front Desk customized": "Front Desk testreszabva",
  "Public Front Desk page enabled": "Publikus Front Desk oldal engedélyezve",
  "Training and knowledge ready": "Tanítás és tudásanyag kész",
  "Front Desk workspace": "Front Desk munkaterület",
  "Your Front Desk page is live": "A Front Desk oldalad él",
  "Your Front Desk page is disabled": "A Front Desk oldalad le van tiltva",
  "Your Front Desk page is disabled.": "A Front Desk oldalad le van tiltva.",
  "Your Front Desk page is close to launch.": "A Front Desk oldalad közel áll az élesítéshez.",
  "A few essentials still need attention before you publish.": "Néhány alapvető elem még figyelmet igényel közzététel előtt.",
  "Confirm the experience, enable the public Front Desk page, then choose WordPress, smart embed, QR/direct link, or the optional website bubble.": "Ellenőrizd az élményt, engedélyezd a publikus Front Desk oldalt, majd válassz WordPresst, okos beágyazást, QR/direkt linket vagy opcionális weboldali buborékot.",
  "This space keeps the launch path clear by showing what still needs attention before Install and distribution.": "Ez a rész tisztán tartja az élesítési utat azzal, hogy megmutatja, mi igényel még figyelmet a Telepítés és a terjesztés előtt.",
  "Live traffic confirmed": "Élő forgalom megerősítve",
  "Installed, waiting for first live visit": "Telepítve, az első élő látogatásra vár",
  "Verification needs attention": "Az ellenőrzés figyelmet igényel",
  "Not live yet": "Még nem élő",
  "Enable the public Front Desk page to generate a shareable link.": "Engedélyezd a publikus Front Desk oldalt a megosztható link létrehozásához.",
  "Available in Install": "Elérhető a Telepítésben",
  "Available after the public Front Desk page is enabled.": "A publikus Front Desk oldal engedélyezése után elérhető.",
  "Direct handoff": "Közvetlen átadás",
  "Website install": "Weboldali telepítés",
  "Enable the public Front Desk page to create the customer-facing link.": "Engedélyezd a publikus Front Desk oldalt az ügyféloldali link létrehozásához.",
  "Use Install to share the QR code anywhere customers already are.": "Használd a Telepítést, hogy a QR-kódot ott oszd meg, ahol az ügyfelek már jelen vannak.",
  "QR is available after the public page is enabled.": "A QR a publikus oldal engedélyezése után érhető el.",
  "Use Install for page takeover, smart embed, and live-domain verification.": "Használd a Telepítést oldalátvételhez, okos beágyazáshoz és élő domain ellenőrzéshez.",
  "Use Install to choose WordPress, smart embed, QR/direct link, or the optional website bubble before launch is complete.": "Az élesítés lezárása előtt a Telepítésben válassz WordPresst, okos beágyazást, QR/direkt linket vagy opcionális weboldali buborékot.",
  "Front Desk owns practice, training, answer quality, and launch readiness. Install only manages distribution channels and verification.": "A Front Desk kezeli a gyakorlást, tanítást, válaszminőséget és élesítési készenlétet. A Telepítés csak a terjesztési csatornákat és az ellenőrzést kezeli.",
  "Enable public access before sharing links or QR": "Engedélyezd a publikus hozzáférést linkek vagy QR megosztása előtt",
  "Custom full-page settings saved": "Az egyedi teljes oldalas beállítások mentve",
  "Review identity, welcome, and page design": "Nézd át az identitást, az üdvözlést és az oldaldizájnt",
  "Website knowledge is ready": "A weboldali tudás kész",
  "Website knowledge is still growing": "A weboldali tudás még bővül",
  "Website knowledge is missing": "Hiányzik a weboldali tudás",
  "A conversation exists": "Van beszélgetés",
  "Front desk preview opened": "Front Desk előnézet megnyitva",
  "No test conversation yet": "Még nincs tesztbeszélgetés",
  "Hosted page, QR/direct link, WordPress/smart embed, or optional bubble is ready": "Hosztolt oldal, QR/direkt link, WordPress/okos beágyazás vagy opcionális buborék készen áll",
  "Choose a primary launch path in Install": "Válassz elsődleges élesítési utat a Telepítésben",
  "Setup progress": "Beállítási állapot",
  "Choose method": "Módszer kiválasztása",
  "Start with hosted page, QR/direct link, or WordPress/smart embed.": "Kezdd hosztolt oldallal, QR/direkt linkkel vagy WordPress/okos beágyazással.",
  "Configure": "Beállítás",
  "Copy the link, page embed, smart snippet, or optional bubble code.": "Másold a linket, oldalbeágyazást, okos kódrészletet vagy opcionális buborékkódot.",
  "Verify": "Ellenőrzés",
  "Confirm website embed or bubble installs after publishing.": "Közzététel után ellenőrizd a weboldali beágyazásokat vagy buboréktelepítéseket.",
  "Share the hosted page, QR, or embedded page; keep the widget secondary.": "Oszd meg a hosztolt oldalt, QR-t vagy beágyazott oldalt; a widget maradjon másodlagos.",
  "Launch path hierarchy": "Élesítési útvonalak sorrendje",
  "Pick the customer entry point": "Válaszd ki az ügyfél belépési pontját",
  "Full-page first": "Először a teljes oldalas felület",
  "QR available": "QR elérhető",
  "Code ready": "Kód kész",
  "Not generated": "Nincs létrehozva",
  "View setup": "Beállítás megnyitása",
  "Fastest launch path. Share the protected hosted page from buttons, menus, emails, and owner follow-ups.": "A leggyorsabb élesítési út. Oszd meg a védett hosztolt oldalt gombokból, menükből, emailekből és tulajdonosi utánkövetésekből.",
  "Same hosted page, packaged for print, reception desks, invoices, menus, and offline traffic.": "Ugyanaz a hosztolt oldal nyomtatványokhoz, recepciókhoz, számlákhoz, menükhöz és offline forgalomhoz csomagolva.",
  "Use the plugin, dedicated page embed, or smart snippet when Front Desk belongs inside the website.": "Használd a plugint, dedikált oldalbeágyazást vagy okos kódrészletet, ha a Front Desknek a weboldalon belül kell megjelennie.",
  "Optional compact launcher for normal website pages after the full-page launch path is prepared.": "Opcionális kompakt indító normál weboldalakhoz, miután a teljes oldalas élesítési út elkészült.",
  "Installation methods": "Telepítési módszerek",
  "Optional add-on": "Opcionális kiegészítő",
  "Website widget bubble": "Weboldali widget buborék",
  "Launch the hosted Front Desk page first, then use WordPress or smart embed when it should live on your site.": "Először a hosztolt Front Desk oldalt élesítsd, majd használj WordPresst vagy okos beágyazást, ha a saját weboldaladon kell megjelennie.",
  "Open the same hosted Front Desk page from signs, menus, invoices, emails, or direct links.": "Nyisd meg ugyanazt a hosztolt Front Desk oldalt táblákról, menükből, számlákról, emailekből vagy direkt linkekből.",
  "Add a compact chat bubble only after the full-page Front Desk launch path is clear.": "Csak akkor adj hozzá kompakt chatbuborékot, ha a teljes oldalas Front Desk élesítési út már tiszta.",
  "Paste this code into your website header only if you also want a compact chat launcher on normal website pages. Your Front Desk page stays the primary product.": "Csak akkor illeszd ezt a kódot a weboldal fejlécébe, ha a normál weboldalakon is szeretnél kompakt chatindítót. A Front Desk oldal marad az elsődleges termék.",
  "Optional installed": "Opcionális telepítve",
  "Secondary installed": "Másodlagos telepítve",
  "Secondary": "Másodlagos",
  "Primary ready": "Elsődleges kész",
  "Optional": "Opcionális",
  "Copy website bubble code": "Weboldali buborék kódjának másolása",
  "Test website bubble": "Weboldali buborék tesztelése",
  "Website widget bubble code": "Weboldali widget buborék kódja",
  "Copy bubble code": "Buborék kódjának másolása",
  "Paste this once into your site header only when you want the optional bubble.": "Ezt egyszer illeszd be az oldal fejlécébe, csak ha kéred az opcionális buborékot.",
  "Detected install status": "Észlelt telepítési állapot",
  "Recommended method": "Ajánlott módszer",
  "Choose how customers should open the AI Front Desk page. Vonza generates the hosted link, WordPress guidance, smart embed, or fallback iframe.": "Válaszd ki, hogyan nyissák meg az ügyfelek az AI Front Desk oldalt. A Vonza elkészíti a hosztolt linket, WordPress útmutatót, okos beágyazást vagy tartalék iframe-et.",
  "WordPress Front Desk page": "WordPress Front Desk oldal",
  "For WordPress, use the Vonza plugin to create a dedicated Front Desk page. This avoids manual snippets and theme content boxes.": "WordPresshez használd a Vonza plugint dedikált Front Desk oldal létrehozásához. Így elkerülhetők a kézi kódrészletek és a sablon tartalomdobozai.",
  "Use dedicated page embed": "Dedikált oldalbeágyazás használata",
  "Your Front Desk page is disabled. Enable public Front Desk page access in Settings before sharing links, embeds, or QR codes.": "A Front Desk oldalad le van tiltva. Linkek, beágyazások vagy QR-kódok megosztása előtt engedélyezd a publikus Front Desk hozzáférést a Beállításokban.",
  "Enable public Front Desk page": "Publikus Front Desk oldal engedélyezése",
  "Front Desk page install options": "Front Desk oldal telepítési opciói",
  "Front Desk page link": "Front Desk oldal linkje",
  "Use this for QR codes, buttons, menus, emails, and direct links.": "Ezt használd QR-kódokhoz, gombokhoz, menükhöz, emailekhez és direkt linkekhez.",
  "Platform install guidance": "Platform telepítési útmutató",
  "Platform quick guides": "Platform gyors útmutatók",
  "Install-only website guidance": "Csak telepítési weboldal útmutató",
  "Start with the hosted AI Front Desk page. Use embeds when you want Front Desk inside a website page, and keep the website bubble as a secondary launcher.": "Kezdd a hosztolt AI Front Desk oldallal. Beágyazást akkor használj, ha a Front Desket egy weboldalon belül szeretnéd megjeleníteni, a weboldali buborék pedig maradjon másodlagos indító.",
  "Generic HTML / smart embed": "Általános HTML / okos beágyazás",
  "Start here": "Itt kezdd",
  "Recommended page": "Ajánlott oldal",
  "Link first": "Először link",
  "Hosted page first": "Először hosztolt oldal",
  "Embed-ready": "Beágyazásra kész",
  "Paste or link": "Beillesztés vagy link",
  "Hosted page vs embed": "Hosztolt oldal vagy beágyazás",
  "Limitation": "Korlát",
  "Paste the smart embed or dedicated page snippet into the page HTML, or add the Front Desk page link to a button or menu.": "Illeszd be az okos beágyazást vagy a dedikált oldal kódrészletét az oldal HTML-jébe, vagy add a Front Desk oldal linkjét egy gombhoz vagy menühöz.",
  "Use the hosted Front Desk page for the fastest launch. Use the smart embed when Front Desk should live inside an existing page.": "A leggyorsabb élesítéshez használd a hosztolt Front Desk oldalt. Az okos beágyazást akkor használd, ha a Front Desknek egy meglévő oldalon belül kell megjelennie.",
  "Use the raw iframe fallback only when the site blocks scripts.": "A nyers iframe tartalékot csak akkor használd, ha az oldal blokkolja a szkripteket.",
  "Publish, open the page as a visitor, and ask one realistic customer question. If you also add the bubble snippet, run Verify installation.": "Tedd közzé, nyisd meg az oldalt látogatóként, és tegyél fel egy valósághű ügyfélkérdést. Ha a buborék kódrészletét is hozzáadod, futtasd a Telepítés ellenőrzését.",
  "Add the hosted Front Desk page link to a menu or button, or use the Vonza plugin or dedicated page embed on a new WordPress page.": "Add a hosztolt Front Desk oldal linkjét egy menühöz vagy gombhoz, vagy használd a Vonza plugint vagy a dedikált oldalbeágyazást egy új WordPress oldalon.",
  "Use the hosted Front Desk page for checkout, order status, and account areas. Use the embed on normal content pages.": "Pénztárhoz, rendelési állapothoz és fiókoldalakhoz használd a hosztolt Front Desk oldalt. Normál tartalmi oldalakon használd a beágyazást.",
  "WooCommerce product and order data are not connected by this install step.": "Ez a telepítési lépés nem kapcsol WooCommerce termék- vagy rendelési adatokat.",
  "Publish the page, open it while signed out, and ask a test question. If you add the optional bubble, run Verify installation.": "Tedd közzé az oldalt, nyisd meg kijelentkezve, és tegyél fel egy tesztkérdést. Ha hozzáadod az opcionális buborékot, futtasd a Telepítés ellenőrzését.",
  "Add the hosted Front Desk page link to a site button or menu, or paste the smart embed into an Embed HTML or custom code area.": "Add a hosztolt Front Desk oldal linkjét egy weboldali gombhoz vagy menühöz, vagy illeszd be az okos beágyazást egy Embed HTML vagy egyéni kód területre.",
  "Use the hosted page when the Wix editor strips scripts. Use the embed only on pages where custom HTML is allowed.": "Használd a hosztolt oldalt, ha a Wix szerkesztő eltávolítja a szkripteket. Beágyazást csak olyan oldalon használj, ahol engedélyezett az egyéni HTML.",
  "Some Wix areas can restrict custom code, so the iframe fallback may be needed.": "Egyes Wix területek korlátozhatják az egyéni kódot, ezért szükség lehet az iframe tartalékra.",
  "Publish the site, open the public page, and complete one visitor-style test question.": "Tedd közzé az oldalt, nyisd meg a publikus oldalt, és futtass végig egy látogatói tesztkérdést.",
  "Add the Front Desk page link to navigation, a page, or a theme section. Use the smart embed only where the theme allows custom liquid or HTML.": "Add a Front Desk oldal linkjét a navigációhoz, egy oldalhoz vagy egy sablonszakaszhoz. Az okos beágyazást csak ott használd, ahol a sablon enged egyéni liquidet vagy HTML-t.",
  "Use the hosted Front Desk page for checkout, customer account, and policy areas where custom scripts may be restricted.": "A pénztárhoz, ügyfélfiókhoz és szabályzati területekhez használd a hosztolt Front Desk oldalt, ahol az egyéni szkriptek korlátozva lehetnek.",
  "Products, carts, and orders are not connected by this install step.": "Ez a telepítési lépés nem kapcsol termékeket, kosarakat vagy rendeléseket.",
  "Publish the theme change, open the storefront as a visitor, and test the Front Desk link or embedded page.": "Tedd közzé a sablonmódosítást, nyisd meg a boltot látogatóként, és teszteld a Front Desk linket vagy a beágyazott oldalt.",
  "Add the Front Desk page link to a nav item or button, or paste the smart embed into a Webflow Embed element on a dedicated page.": "Add a Front Desk oldal linkjét egy navigációs elemhez vagy gombhoz, vagy illeszd be az okos beágyazást egy Webflow Embed elembe egy dedikált oldalon.",
  "Use the hosted page for quick launch and QR links. Use the embed when the Front Desk should appear within a Webflow page.": "Gyors élesítéshez és QR-linkekhez használd a hosztolt oldalt. Beágyazást akkor használj, ha a Front Desknek egy Webflow oldalon belül kell megjelennie.",
  "Custom code publishing can depend on the Webflow site setup.": "Az egyéni kód közzététele a Webflow oldal beállításaitól függhet.",
  "Publish to the live domain, open the page in a private window, and send one test question.": "Tedd közzé az élő domainen, nyisd meg az oldalt privát ablakban, és küldj egy tesztkérdést.",
  "Add the hosted Front Desk page link to navigation or a button, or paste the embed into a Code Block or Code Injection area.": "Add a hosztolt Front Desk oldal linkjét a navigációhoz vagy egy gombhoz, vagy illeszd be a beágyazást egy Code Block vagy Code Injection területre.",
  "Use the hosted page when Squarespace blocks scripts on the target page. Use the iframe fallback if scripts are not allowed.": "Használd a hosztolt oldalt, ha a Squarespace blokkolja a szkripteket a céloldalon. Ha a szkriptek nem engedélyezettek, használd az iframe tartalékot.",
  "Some templates and editing areas can limit script embeds.": "Egyes sablonok és szerkesztési területek korlátozhatják a szkriptbeágyazásokat.",
  "Publish, open the public page, and confirm the Front Desk loads before sharing the link.": "Tedd közzé, nyisd meg a publikus oldalt, és ellenőrizd, hogy a Front Desk betölt, mielőtt megosztod a linket.",
  "Smart embed": "Okos beágyazás",
  "Place the Front Desk inside part of an existing page.": "Helyezd el a Front Desket egy meglévő oldal egy részében.",
  "WordPress / dedicated page": "WordPress / dedikált oldal",
  "Use this when Front Desk is the main content of a website page.": "Ezt használd, ha a Front Desk a weboldal egyik oldalának fő tartalma.",
  "True page takeover": "Teljes oldal átvétele",
  "Advanced. Use this on a blank dedicated page when you want Front Desk to own the full page area.": "Haladó. Üres dedikált oldalon használd, ha azt szeretnéd, hogy a Front Desk töltse ki a teljes oldalterületet.",
  "Raw iframe fallback": "Nyers iframe tartalék",
  "Use this for builders that block scripts.": "Ezt használd olyan oldalépítőknél, amelyek blokkolják a scripteket.",
  "Copy Front Desk page link": "Front Desk oldal linkjének másolása",
  "Open Front Desk page": "Front Desk oldal megnyitása",
  "Customize Front Desk page": "Front Desk oldal testreszabása",
  "Recommended smart snippet": "Ajánlott okos kódrészlet",
  "Copy smart snippet": "Okos kódrészlet másolása",
  "Smart snippet:": "Okos kódrészlet:",
  "Recommended. Automatically adjusts to most website layouts.": "Ajánlott. Automatikusan igazodik a legtöbb weboldal-elrendezéshez.",
  "Iframe:": "Iframe:",
  "Advanced fallback. Use this if your website builder does not allow scripts.": "Haladó tartalék. Akkor használd, ha a weboldalépítőd nem enged scripteket.",
  "Advanced iframe snippet": "Haladó iframe kódrészlet",
  "Copy iframe snippet": "Iframe kódrészlet másolása",
  "WordPress / dedicated page embed:": "WordPress / dedikált oldalbeágyazás:",
  "Dedicated page embed makes the Front Desk the page body below your site header. The selected background fills the takeover area edge-to-edge.": "A dedikált oldalbeágyazás a Front Desket teszi az oldal törzsévé a weboldal fejléce alatt. A kiválasztott háttér faltól falig kitölti az átvett területet.",
  "Dedicated page embed snippet": "Dedikált oldalbeágyazási kódrészlet",
  "Copy dedicated page embed": "Dedikált oldalbeágyazás másolása",
  "True page takeover:": "Teljes oldal átvétele:",
  "Use this on a blank assistant page. It may hide the page footer and remove extra page spacing.": "Üres asszisztensoldalon használd. Elrejtheti az oldal láblécét és eltávolíthatja az extra oldaltávolságokat.",
  "True page takeover snippet": "Teljes oldal átvételi kódrészlet",
  "Copy true page takeover": "Teljes oldal átvételének másolása",
  "Raw iframe:": "Nyers iframe:",
  "Fallback for builders that block scripts.": "Tartalék olyan oldalépítőkhöz, amelyek blokkolják a scripteket.",
  "Raw iframe backgrounds stay inside the iframe. Use the smart dedicated page embed when you want the background to fill the page area.": "A nyers iframe hátterek az iframe-en belül maradnak. Használd az okos dedikált oldalbeágyazást, ha azt szeretnéd, hogy a háttér kitöltse az oldalterületet.",
  "Copy raw iframe": "Nyers iframe másolása",
  "Selected method": "Kiválasztott módszer",
  "Use a QR code or direct link that opens the hosted full-page Front Desk page.": "Használj QR-kódot vagy direkt linket, amely megnyitja a hosztolt teljes oldalas Front Desk oldalt.",
  "Print/download": "Nyomtatás/letöltés",
  "Enable page first": "Előbb engedélyezd az oldalt",
  "Front Desk page QR code": "Front Desk oldal QR-kódja",
  "Loading QR code...": "QR-kód betöltése...",
  "Enable the public Front Desk page before sharing.": "Megosztás előtt engedélyezd a publikus Front Desk oldalt.",
  "Use this QR code on menus, flyers, signs, invoices, and reception desks.": "Ezt a QR-kódot használd menükön, szórólapokon, táblákon, számlákon és recepción.",
  "Enable the public Front Desk page before downloading or sharing a QR code.": "QR-kód letöltése vagy megosztása előtt engedélyezd a publikus Front Desk oldalt.",
  "The QR code opens the same customer-facing Front Desk page link.": "A QR-kód ugyanazt az ügyféloldali Front Desk linket nyitja meg.",
  "Download QR code": "QR-kód letöltése",
  "Installation status": "Telepítési állapot",
  "Domain status": "Domain állapota",
  "Detected domain": "Észlelt domain",
  "QR code": "QR-kód",
  "Downloadable": "Letölthető",
  "Enable the public page first.": "Előbb engedélyezd a publikus oldalt.",
  "No live domain detected yet.": "Még nincs észlelt élő domain.",
  "Live": "Élő",
  "Verified": "Ellenőrizve",
  "Resources": "Erőforrások",
  "View Front Desk page setup": "Front Desk oldal beállításainak megnyitása",
  "View optional website bubble": "Opcionális weboldali buborék megnyitása",
  "Last seen page:": "Utoljára látott oldal:",
  "Last verified": "Utoljára ellenőrizve",
  "against": "ezzel:",
  "Found install id": "Talált telepítési azonosító",
  "Found install ids": "Talált telepítési azonosítók",
  "Live install detected": "Élő telepítés észlelve",
  "Live install detected on": "Élő telepítés észlelve ezen:",
  "last seen": "utoljára észlelve",
  "your website": "a weboldaladon",
  "The optional website bubble snippet was found on the site, but Vonza has not yet received a live visitor ping.": "Az opcionális weboldali buborék kódrészlete megtalálható az oldalon, de a Vonza még nem kapott élő látogatói jelzést.",
  "Vonza found embed markup, but it points at a different install or a blocked domain.": "A Vonza talált beágyazási jelölést, de az másik telepítésre vagy blokkolt domainre mutat.",
  "Verification needs attention. Vonza either could not fetch the site or could not find the expected install snippet yet.": "Az ellenőrzés figyelmet igényel. A Vonza vagy nem tudta lekérni az oldalt, vagy még nem találta a várt telepítési kódrészletet.",
  "No website bubble install detected yet. The Front Desk page can still launch through the public page, WordPress, smart embed, or QR/direct link.": "Még nincs észlelt weboldali buboréktelepítés. A Front Desk oldal ettől még indítható publikus oldalon, WordPressen, okos beágyazással vagy QR/direkt linken keresztül.",
  "Publish your AI Front Desk page through WordPress, smart embed, QR/direct link, or the optional website widget bubble.": "Tedd közzé az AI Front Desk oldalt WordPressen, okos beágyazással, QR/direkt linken vagy opcionális weboldali widget buborékkal.",
  "Front Desk configuration sections": "Front Desk beállítási szakaszok",
  "Adjust how the customer-facing Front Desk speaks, routes, and appears to visitors.": "Állítsd be, hogyan beszéljen, merre vezessen és hogyan jelenjen meg az ügyféloldali Front Desk.",
  "Identity & welcome": "Identitás és üdvözlés",
  "Voice": "Hang",
  "Routing": "Útvonalak",
  "Widget appearance": "Widget megjelenése",
  "What should your customer-facing Front Desk mainly help visitors do?": "Miben segítsen elsősorban az ügyféloldali Front Desk a látogatóknak?",
  "Guidance": "Útmutatás",
  "Help visitors find what they need quickly.": "Segíts a látogatóknak gyorsan megtalálni, amire szükségük van.",
  "Support": "Támogatás",
  "Answer customer questions and solve common issues.": "Válaszolj ügyfélkérdésekre és oldd meg a gyakori problémákat.",
  "Make a decision": "Döntéstámogatás",
  "Help visitors choose the right service, product, or next step.": "Segíts a látogatóknak kiválasztani a megfelelő szolgáltatást, terméket vagy következő lépést.",
  "Lead capture / contact": "Érdeklődőrögzítés / kapcsolatfelvétel",
  "Guide warm visitors toward contact details or follow-up.": "Tereld a meleg érdeklődőket kapcsolatadatok vagy utánkövetés felé.",
  "Booking / next step guidance": "Foglalási / következő lépés útmutatás",
  "Help visitors book, request a quote, or move forward.": "Segíts a látogatóknak foglalni, ajánlatot kérni vagy továbblépni.",
  "Keep this customer-facing so the first interaction feels native to the business.": "Tartsd ügyféloldali szemléletben, hogy az első interakció természetesnek hasson a vállalkozásnál.",
  "Website bubble launcher text": "Weboldali buborék indítószövege",
  "Accent color": "Kiemelő szín",
  "Visitors can speak their question. Vonza transcribes it, answers using your existing Front Desk setup, and can optionally read the answer aloud.": "A látogatók szóban is feltehetik a kérdésüket. A Vonza leírja, a meglévő Front Desk beállítások alapján válaszol, és opcionálisan fel is olvassa a választ.",
  "Visitors can speak their question. Voice uses AI capacity and may stop when access, monthly capacity, or rate limits are reached.": "A látogatók szóban is feltehetik a kérdésüket. A hang AI-kapacitást használ, és leállhat, ha a hozzáférés, havi kapacitás vagy sebességkorlát eléri a határt.",
  "Enable voice input": "Hangbevitel engedélyezése",
  "Show a microphone button so visitors can record a short question.": "Mutass mikrofon gombot, hogy a látogatók rövid kérdést rögzíthessenek.",
  "Show a microphone button so visitors can record a short question for transcription.": "Mutass mikrofon gombot, hogy a látogatók rövid kérdést rögzíthessenek átíráshoz.",
  "Enable spoken replies": "Felolvasott válaszok engedélyezése",
  "Allow visitors to play Vonza's text answer as AI-generated voice.": "Engedd, hogy a látogatók AI-generált hangként lejátszhassák a Vonza szöveges válaszát.",
  "Allow visitors to generate and play spoken replies on demand from Vonza's text answer.": "Engedd, hogy a látogatók igény szerint felolvasott választ generáljanak és játsszanak le a Vonza szöveges válaszából.",
  "Enable browser voice for Front Desk": "Böngészős hang engedélyezése a Front Deskhez",
  "Show the hosted full-page browser voice panel when voice input and spoken replies are also enabled.": "Mutasd a hosztolt teljes oldalas böngészős hangpanelt, ha a hangbevitel és a felolvasott válaszok is engedélyezve vannak.",
  "Browser voice readiness checklist": "Böngészős hang készenléti ellenőrzőlista",
  "Browser voice setup": "Böngészős hang beállítása",
  "Turn-based voice in the visitor's browser for the hosted Front Desk page. It is not a phone number or live full-duplex call. It requires voice input and spoken replies, and uses AI capacity and rate limits.": "Fordulóalapú hang a látogató böngészőjében a hosztolt Front Desk oldalhoz. Nem telefonszám és nem élő kétirányú hívás. Hangbevitel és felolvasott válaszok szükségesek hozzá, AI-kapacitást és sebességkorlátokat használ.",
  "Incomplete": "Hiányos",
  "Voice input": "Hangbevitel",
  "Ready for microphone recording.": "Mikrofonos rögzítésre kész.",
  "Enable voice input first.": "Először engedélyezd a hangbevitelt.",
  "Spoken replies": "Felolvasott válaszok",
  "Ready to generate browser audio.": "Böngészős hang generálására kész.",
  "Enable spoken replies next.": "Ezután engedélyezd a felolvasott válaszokat.",
  "Front Desk browser voice": "Front Desk böngészős hang",
  "Ready on the hosted Front Desk page.": "Kész a hosztolt Front Desk oldalon.",
  "Enable browser voice last.": "Végül engedélyezd a böngészős hangot.",
  "Test the browser voice path before sharing it publicly.": "Teszteld a böngészős hangútvonalat, mielőtt nyilvánosan megosztod.",
  "Open owner voice QA simulator": "Tulajdonosi hang QA szimulátor megnyitása",
  "Auto-send transcript after speaking": "Átirat automatikus küldése beszéd után",
  "Send the transcript immediately after recording instead of placing it in the composer.": "A rögzítés után azonnal küldje el az átiratot ahelyett, hogy a szövegmezőbe tenné.",
  "Send the transcribed text immediately after recording instead of placing it in the composer.": "A rögzítés után azonnal küldje el az átírt szöveget ahelyett, hogy a szövegmezőbe tenné.",
  "Auto-play spoken replies": "Felolvasott válaszok automatikus lejátszása",
  "Start audio playback after each answer when the visitor has enabled spoken replies.": "Minden válasz után indítsa el a hangot, ha a látogató engedélyezte a felolvasást.",
  "Try to play each generated spoken reply after the visitor has enabled spoken replies.": "Próbálja lejátszani minden generált felolvasott választ, miután a látogató engedélyezte a felolvasást.",
  "Voice style": "Hangstílus",
  "Only built-in AI voices are available. Voice cloning is not supported.": "Csak beépített AI hangok érhetők el. Hangklónozás nem támogatott.",
  "Language behavior": "Nyelvkezelés",
  "Auto-detect": "Automatikus felismerés",
  "Auto-detect voice language": "Hang nyelvének automatikus felismerése",
  "Force dashboard/business language": "Irányítópult/vállalkozási nyelv kényszerítése",
  "Prefer dashboard/business language": "Irányítópult/vállalkozási nyelv előnyben részesítése",
  "Auto-detect follows the visitor's question when possible.": "Az automatikus felismerés lehetőség szerint a látogató kérdését követi.",
  "This guides voice and transcription behavior; it does not force the chat answer language yet.": "Ez a hang és az átírás működését irányítja; a chatválasz nyelvét még nem kényszeríti.",
  "Voice is processed to transcribe the visitor's question. Voice output is AI-generated.": "A hang feldolgozása a látogató kérdésének leírásához történik. A hangkimenet AI-generált.",
  "Voice is processed to transcribe the visitor's question. Spoken replies are AI-generated on demand and count toward the workspace's AI capacity.": "A hang feldolgozása a látogató kérdésének átírásához történik. A felolvasott válaszok igény szerint AI-generáltak, és beleszámítanak a munkaterület AI-kapacitásába.",
  "Owner voice QA simulator": "Tulajdonosi hang QA szimulátor",
  "Record a short sample before enabling voice publicly. Voice tests use AI capacity and follow the same access, capacity, and rate-limit checks as public voice input.": "Rögzíts egy rövid mintát, mielőtt nyilvánosan engedélyezed a hangot. A hangtesztek AI-kapacitást használnak, és ugyanazokat a hozzáférési, kapacitási és sebességkorlát-ellenőrzéseket követik, mint a publikus hangbevitel.",
  "Voice input off": "Hangbevitel kikapcsolva",
  "Current voice settings": "Aktuális hangbeállítások",
  "Input": "Bevitel",
  "Replies": "Válaszok",
  "Web Call": "Webes hívás",
  "Language": "Nyelv",
  "Voice input enabled": "Hangbevitel engedélyezve",
  "Spoken replies enabled": "Felolvasott válaszok engedélyezve",
  "Text replies only": "Csak szöveges válaszok",
  "Web Call enabled": "Webes hívás engedélyezve",
  "Web Call off": "Webes hívás kikapcsolva",
  "Voice QA steps": "Hang QA lépések",
  "Record a short owner voice sample.": "Rögzíts egy rövid tulajdonosi hangmintát.",
  "Vonza transcribes it with the existing voice route.": "A Vonza a meglévő hangútvonalon írja át.",
  "Review the transcript, then copy it or use it in Practice.": "Nézd át az átiratot, majd másold ki vagy használd a Gyakorlásban.",
  "Record sample": "Minta rögzítése",
  "Stop recording": "Rögzítés leállítása",
  "Clear transcript": "Átirat törlése",
  "Ready to record.": "Rögzítésre kész.",
  "Recording...": "Rögzítés...",
  "Transcribing...": "Átírás...",
  "Transcript ready.": "Az átirat kész.",
  "Voice input is off. Enable and save voice input before recording.": "A hangbevitel ki van kapcsolva. Rögzítés előtt engedélyezd és mentsd a hangbevitelt.",
  "Voice test unavailable. Open the dashboard over HTTPS to use the microphone.": "A hangteszt nem érhető el. A mikrofon használatához HTTPS-en nyisd meg az irányítópultot.",
  "Voice test unavailable in this browser.": "A hangteszt ebben a böngészőben nem érhető el.",
  "Voice test unavailable. Allow microphone access and try again.": "A hangteszt nem érhető el. Engedélyezd a mikrofonhozzáférést, és próbáld újra.",
  "Voice test capped: this workspace has reached monthly AI capacity.": "A hangteszt kapacitáskorlátba ütközött: ez a munkaterület elérte a havi AI-kapacitást.",
  "Voice test is rate-limited. Try again in a moment.": "A hangteszt sebességkorlát alatt van. Próbáld újra egy pillanat múlva.",
  "Voice test unavailable. Check voice input and workspace access.": "A hangteszt nem érhető el. Ellenőrizd a hangbevitelt és a munkaterület-hozzáférést.",
  "Voice sample is too long or too large. Record a shorter sample.": "A hangminta túl hosszú vagy túl nagy. Rögzíts rövidebb mintát.",
  "Voice test unavailable right now. Try again later.": "A hangteszt most nem érhető el. Próbáld újra később.",
  "Could not transcribe that recording. Please try again.": "Nem sikerült átírni a felvételt. Próbáld újra.",
  "No voice sample was recorded. Try again.": "Nem készült hangminta. Próbáld újra.",
  "No speech was detected in that recording.": "Nem észlelhető beszéd a felvételben.",
  "Transcript preview": "Átirat előnézete",
  "Your transcription preview will appear here.": "Itt jelenik meg az átírás előnézete.",
  "Use this transcript as a realistic customer-style practice prompt before publishing voice.": "Használd ezt az átiratot valósághű ügyfélstílusú gyakorló promptként, mielőtt közzéteszed a hangot.",
  "Copy transcript": "Átirat másolása",
  "Use in Practice": "Használat Gyakorlásban",
  "Record a voice sample before copying a transcript.": "Átirat másolása előtt rögzíts hangmintát.",
  "Transcript copied.": "Átirat másolva.",
  "Could not copy the transcript.": "Nem sikerült másolni az átiratot.",
  "Record a voice sample before using it in Practice.": "A Gyakorlásban használat előtt rögzíts hangmintát.",
  "Opening Practice with this transcript...": "Gyakorlás megnyitása ezzel az átirattal...",
  "Transcript sent to Practice.": "Az átirat elküldve a Gyakorlásba.",
  "Could not open Practice with this transcript.": "Nem sikerült megnyitni a Gyakorlást ezzel az átirattal.",
  "Practice is not available right now.": "A Gyakorlás most nem érhető el.",
  "Customize the primary Front Desk page customers open from links, WordPress pages, smart embeds, QR codes, and direct assistant pages.": "Testreszabhatod az elsődleges Front Desk oldalt, amelyet az ügyfelek linkekből, WordPress oldalakról, okos beágyazásokból, QR-kódokból és direkt asszisztensoldalakról nyitnak meg.",
  "Front Desk page customization sections": "Front Desk oldal testreszabási szakaszai",
  "Content": "Tartalom",
  "Design": "Dizájn",
  "Layout": "Elrendezés",
  "Anyone with the protected public link can open this customer-facing Front Desk page.": "A védett publikus link birtokában bárki megnyithatja ezt az ügyféloldali Front Desk oldalt.",
  "Enable public Front Desk page access before sharing links, embeds, or QR codes.": "Linkek, beágyazások vagy QR-kódok megosztása előtt engedélyezd a publikus Front Desk oldal hozzáférését.",
  "Headline": "Címsor",
  "Leave blank to show the default title, Front Desk.": "Hagyd üresen az alapértelmezett Front Desk cím megjelenítéséhez.",
  "Subtitle": "Alcím",
  "Logo/avatar URL": "Logó/avatar URL",
  "Optional. Leave blank to use the assistant initial or optional website bubble logo.": "Opcionális. Hagyd üresen az asszisztens kezdőbetűjének vagy az opcionális weboldali buborék logójának használatához.",
  "Show booking card": "Foglalási kártya megjelenítése",
  "Show quote card": "Ajánlatkérési kártya megjelenítése",
  "Show contact card": "Kapcsolati kártya megjelenítése",
  "Suggested questions": "Javasolt kérdések",
  "One question per line": "Soronként egy kérdés",
  "Shown as compact chips when action cards are not taking the same space.": "Kompakt chipként jelenik meg, amikor az akciókártyák nem foglalják el ugyanazt a helyet.",
  "Trust/status copy": "Bizalmi/állapot szöveg",
  "One short item per line": "Soronként egy rövid elem",
  "Preset": "Előbeállítás",
  "Background type": "Háttér típusa",
  "Background coverage": "Háttér lefedése",
  "Assistant section is recommended for the smart full-page embed. Iframe only keeps the background inside the iframe.": "Az okos teljes oldalas beágyazáshoz az asszisztens szakasz ajánlott. Az iframe csak az iframe-en belül tartja a hátteret.",
  "Background color": "Háttérszín",
  "Gradient color": "Gradiens színe",
  "Use background": "Háttér használata",
  "Image / fallback URL": "Kép / tartalék URL",
  "PNG, JPG, JPEG, or WebP URL for image backgrounds or video fallback.": "PNG, JPG, JPEG vagy WebP URL képhátterekhez vagy videós tartalékhoz.",
  "Upload image background": "Képháttér feltöltése",
  "PNG, JPG, JPEG, or WebP. Max 8 MB. SVG is not allowed.": "PNG, JPG, JPEG vagy WebP. Legfeljebb 8 MB. SVG nem engedélyezett.",
  "Upload video background": "Videóháttér feltöltése",
  "MP4 or WebM. Max 50 MB. Video renders muted, looped, and inline.": "MP4 vagy WebM. Legfeljebb 50 MB. A videó némítva, ismételve és beágyazva jelenik meg.",
  "Video URL": "Videó URL",
  "MP4 or WebM URL. Video is muted and loops behind the canvas.": "MP4 vagy WebM URL. A videó némítva ismétlődik a vászon mögött.",
  "Overlay color": "Fedőréteg színe",
  "Overlay opacity": "Fedőréteg átlátszósága",
  "Blur": "Elmosás",
  "Focal point": "Fókuszpont",
  "Disable video on mobile": "Videó letiltása mobilon",
  "Text theme": "Szövegtéma",
  "Composer style": "Szövegmező stílusa",
  "Chip style": "Chip stílus",
  "Status style": "Állapot stílusa",
  "Front Desk page preview": "Front Desk oldal előnézete",
  "Business assistant": "Üzleti asszisztens",
  "AI assistant online": "AI asszisztens online",
  "Type your question...": "Írd be a kérdésed...",
  "Send": "Küldés",
  "Action cards": "Akciókártyák",
  "Edit the starter prompts customers can click on the hosted page.": "Szerkeszd azokat az indító kérdéseket, amelyekre az ügyfelek kattinthatnak a hosztolt oldalon.",
  "Enabled": "Engedélyezve",
  "Label": "Címke",
  "Prompt": "Prompt",
  "Description": "Leírás",
  "Tell Vonza where customers should go when the safest next step is to contact, book, or request a quote.": "Mondd meg a Vonzának, hová menjenek az ügyfelek, amikor a legbiztonságosabb következő lépés kapcsolatfelvétel, foglalás vagy ajánlatkérés.",
  "Primary CTA mode": "Elsődleges CTA mód",
  "This is the default route when an intent-specific destination is missing.": "Ez az alapértelmezett útvonal, ha hiányzik a szándékhoz kötött cél.",
  "Fallback CTA mode": "Tartalék CTA mód",
  "If a direct route is missing, Vonza follows this fallback.": "Ha hiányzik a közvetlen útvonal, a Vonza ezt a tartalékot követi.",
  "One domain per line. Keep it limited to real widget hosts.": "Soronként egy domain. Csak valódi widget hosztokra korlátozd.",
  "Optional. This appears in the handoff card.": "Opcionális. Ez jelenik meg az átadási kártyán.",
  "Outcome routing": "Eredményútvonalak",
  "Map the destinations Vonza can use for booking, quote, checkout, and success-state routing.": "Állítsd be azokat a célokat, amelyeket a Vonza foglaláshoz, ajánlatkéréshez, fizetéshez és sikerállapot-útvonalakhoz használhat.",
  "Booking provider": "Foglalási szolgáltató",
  "Manual booking link": "Manuális foglalási link",
  "Calendly mode requires a public HTTPS calendly.com booking link.": "A Calendly módhoz nyilvános HTTPS calendly.com foglalási link szükséges.",
  "Manual link configured": "Manuális link beállítva",
  "Calendly link connected": "Calendly link csatlakoztatva",
  "Needs booking link": "Foglalási link szükséges",
  "Add a booking URL before Vonza offers a booking handoff.": "Adj meg foglalási URL-t, mielőtt a Vonza foglalási átadást kínál.",
  "Vonza will send booking-intent visitors to this Calendly link.": "A Vonza erre a Calendly linkre küldi a foglalási szándékú látogatókat.",
  "Vonza will send booking-intent visitors to this booking link.": "A Vonza erre a foglalási linkre küldi a foglalási szándékú látogatókat.",
  "Manual": "Manuális",
  "Booking start URL": "Foglalás kezdő URL",
  "Quote start URL": "Ajánlatkérés kezdő URL",
  "Booking success URL": "Foglalás siker URL",
  "Quote success URL": "Ajánlatkérés siker URL",
  "Checkout success URL": "Fizetés siker URL",
  "Success URL match mode": "Siker URL egyezési mód",
  "Fallback outcome mode": "Tartalék eredménymód",
  "Turn this on only when the owner needs a real fallback.": "Csak akkor kapcsold be, ha a tulajdonosnak valódi tartalékra van szüksége.",
  "Optional website bubble": "Opcionális weboldali buborék",
  "Configure the compact website chat bubble. This does not control the primary Front Desk page.": "Állítsd be a kompakt weboldali chatbuborékot. Ez nem vezérli az elsődleges Front Desk oldalt.",
  "Use a small square PNG, JPG, WebP, or GIF.": "Használj kis négyzetes PNG, JPG, WebP vagy GIF képet.",
  "Optional guidance for emphasis, tone, and edge cases.": "Opcionális útmutatás hangsúlyhoz, hangnemhez és kivételes esetekhez.",
  "Front Desk live readout": "Front Desk élő összefoglaló",
  "Review how the customer-facing assistant will appear.": "Nézd át, hogyan jelenik meg az ügyféloldali asszisztens.",
  "Your front desk is ready to greet visitors with a clear, helpful first message.": "A Front Desk készen áll, hogy világos, hasznos első üzenettel fogadja a látogatókat.",
  "Install status": "Telepítési állapot",
  "Behavior summary": "Működési összefoglaló",
  "Account": "Fiók",
  "Account and billing": "Fiók és számlázás",
  "Review the real access, billing, language, theme, and legal surfaces available for this workspace.": "Nézd át a munkaterület valós hozzáférési, számlázási, nyelvi, téma- és jogi felületeit.",
  "Current account status": "Aktuális fiókállapot",
  "Review the access, launch mode, and install posture that shape how this workspace behaves today.": "Nézd át a hozzáférést, indítási módot és telepítési állapotot, amelyek ma meghatározzák a munkaterület működését.",
  "Access": "Hozzáférés",
  "Access follows the existing checkout and activation flow for this workspace.": "A hozzáférés a munkaterület meglévő fizetési és aktiválási folyamatát követi.",
  "Loaded from the current workspace record.": "Az aktuális munkaterület rekordjából betöltve.",
  "Install visibility": "Telepítési láthatóság",
  "The front desk is configured well enough to move into live install and verification.": "A Front Desk elég jól be van állítva az élő telepítéshez és ellenőrzéshez.",
  "Finish the front-desk basics before treating install as complete.": "Fejezd be a Front Desk alapbeállításait, mielőtt a telepítést késznek tekinted.",
  "Billing and monthly usage": "Számlázás és havi használat",
  "All plans include the same Vonza experience. The plan difference is the monthly AI capacity included with the workspace.": "Minden csomag ugyanazt a Vonza élményt tartalmazza. A különbség a munkaterülethez járó havi AI-kapacitás.",
  "Current plan": "Aktuális csomag",
  "No active billing plan data": "Nincs aktív számlázási csomagadat",
  "Hosted monthly subscription with upgrade-anytime capacity.": "Hosztolt havi előfizetés bármikor bővíthető kapacitással.",
  "Billing plan details will appear here after checkout or subscription sync.": "A számlázási csomag részletei fizetés vagy előfizetés-szinkron után jelennek meg itt.",
  "Current billing period": "Aktuális számlázási időszak",
  "Current monthly period begins after activation.": "Az aktuális havi időszak aktiválás után indul.",
  "Subscription status will appear here after checkout.": "Az előfizetési állapot fizetés után jelenik meg itt.",
  "Monthly usage progress": "Havi használati állapot",
  "used": "felhasználva",
  "Monthly capacity status will appear here.": "A havi kapacitás állapota itt jelenik meg.",
  "of this month's included capacity": "az e havi benne foglalt kapacitásból",
  "Visitor replies are now in safe fallback mode.": "A látogatói válaszok most biztonságos tartalék módban vannak.",
  "Customer-facing usage is still available.": "Az ügyféloldali használat még elérhető.",
  "Monthly AI usage status will appear here.": "A havi AI-használat állapota itt jelenik meg.",
  "Plan options": "Csomagopciók",
  "Available plan changes use the existing Stripe-backed billing flow.": "Az elérhető csomagváltások a meglévő Stripe-alapú számlázási folyamatot használják.",
  "Plan change options are not available for this workspace yet.": "Ehhez a munkaterülethez még nem érhetők el csomagváltási opciók.",
  "Also add a compact chat bubble to normal website pages.": "Adj hozzá kompakt chatbuborékot a normál weboldalakhoz is.",
  "Practice": "Gyakorlás",
  "Improvements": "Javítások",
  "Answer library": "Válaszkönyvtár",
  "Launch": "Élesítés",
  "Practice, teach, and publish the answers customers see.": "Gyakorold, tanítsd és tedd közzé az ügyfelek által látott válaszokat.",
  "Draft improvements": "Javítási piszkozatok",
  "Drafts you save in Practice will appear here.": "A Gyakorlásban mentett piszkozatok itt jelennek meg.",
  "Feedback needing review": "Áttekintést igénylő visszajelzés",
  "Not-helpful visitor feedback will appear here.": "A nem hasznosnak jelölt látogatói visszajelzések itt jelennek meg.",
  "Published improvements will appear here.": "A közzétett javítások itt jelennek meg.",
  "Recently published improvements": "Legutóbb közzétett javítások",
  "Ask a question": "Kérdés feltevése",
  "View all": "Összes megtekintése",
  "Visitor question": "Látogatói kérdés",
  "Assistant reply": "Asszisztensi válasz",
  "Recent activity": "Legutóbbi aktivitás",
  "Today's priority": "Mai prioritás",
  "This stood out in recent customer activity. This conversation still needs a clear next step.": "Ez emelkedett ki a friss ügyfélaktivitásból. A beszélgetéshez még világos következő lépés kell.",
  "Warm lead / booking intent": "Meleg érdeklődő / foglalási szándék",
  "Pricing / purchase": "Árazás / vásárlás",
  "Pricing questions usually come from customers who are close to deciding, and unclear answers make the next step feel risky. Add clearer pricing ranges, quote guidance, or the exact details customers should share to get an estimate.": "Az árazási kérdések általában döntéshez közeli ügyfelektől érkeznek, és a bizonytalan válaszok kockázatosnak éreztetik a következő lépést. Adj világosabb ársávokat, ajánlatkérési útmutatót vagy pontos részleteket arról, mit osszanak meg becsléshez.",
  "Needs follow-up": "Utánkövetést igényel",
  "Confirm booking path": "Foglalási út megerősítése",
  "Review open question": "Nyitott kérdés áttekintése",
  "Reply to pricing question": "Válasz az árazási kérdésre",
  "Quote Request": "Ajánlatkérés",
  "Booking availability": "Foglalási elérhetőség",
  "Quote details": "Ajánlatkérési részletek",
  "Quote guidance needs clearer inputs and timing.": "Az ajánlatkérési útmutatáshoz világosabb bemenetek és időzítés kell.",
  "Website knowledge connected": "Weboldali tudás kapcsolódva",
  "Can I book a consultation this week?": "Tudok konzultációt foglalni erre a hétre?",
  "What affects the quote?": "Mi befolyásolja az ajánlatot?",
  "Yes. Share your preferred day and contact details, and the team can confirm the next step.": "Igen. Add meg a preferált napot és az elérhetőségeidet, és a csapat megerősíti a következő lépést.",
});

const DASHBOARD_HU_REGEX_PHRASES = Object.freeze([
  [/\b(\d+) open conversations?\b/g, "$1 nyitott beszélgetés"],
  [/\b(\d+) answers? to improve\b/g, "$1 javítandó válasz"],
  [/\b(\d+) messages?\b/g, "$1 üzenet"],
  [/\b(\d+) open\b/g, "$1 nyitott"],
  [/\b(\d+) of (\d+) ready\b/g, "$1 / $2 kész"],
  [/\b(\d+) helpful\b/g, "$1 hasznos"],
  [/\b(\d+) not helpful\b/g, "$1 nem hasznos"],
  [/\b(\d+)% negative\b/g, "$1% negatív"],
  [/\b(\d+) unresolved complaints?\b/g, "$1 megoldatlan panasz"],
  [/\b(\d+) pricing questions?\b/g, "$1 árazási kérdés"],
  [/\b(\d+) warm conversations? without contact details\b/g, "$1 meleg beszélgetés kapcsolatadat nélkül"],
  [/\b(\d+) warm chats still anonymous\b/g, "$1 meleg chat még anonim"],
  [/\b(\d+) booking questions?\b/g, "$1 foglalási kérdés"],
  [/\b(\d+) lost-customer risk\b/g, "$1 elvesző ügyfél kockázata"],
  [/\bHigh lost-customer risk\b/g, "Magas elvesző-ügyfél kockázat"],
  [/\bMedium lost-customer risk\b/g, "Közepes elvesző-ügyfél kockázat"],
  [/\bLow lost-customer risk\b/g, "Alacsony elvesző-ügyfél kockázat"],
  [/\b(\d+) warm conversations\b/g, "$1 meleg beszélgetés"],
  [/\b(\d+) needing review\b/g, "$1 áttekintést igényel"],
  [/\b(\d+) answer still need work\b/g, "$1 válasz még javítást igényel"],
  [/\b(\d+) customers reached a next step\b/g, "$1 ügyfél jutott következő lépéshez"],
  [/\b(\d+) conversations\b/g, "$1 beszélgetés"],
  [/\b(\d+) successful actions\b/g, "$1 sikeres művelet"],
  [/\b(.+?) need clearer answers\b/g, "$1 témához világosabb válaszok kellenek"],
  [/\b(\d+) \/ (\d+) sections ready\b/g, "$1 / $2 szakasz kész"],
  [/\b(\d+) suggested fields loaded\b/g, "$1 javasolt mező betöltve"],
  [/\b(\d+) fields were safely prefilled for review before save\./g, "$1 mező biztonságosan előtöltve mentés előtti áttekintésre."],
  [/\b(\d+) of (\d+) business profile areas are filled\. Missing: ([^.]+)\./g, (_match, completed, total, missingSections) => `${completed} / ${total} vállalkozási profil terület kitöltve. Hiányzik: ${translateBusinessProfileSectionList(missingSections)}.`],
  [/\bAll core business profile areas are filled\./g, "Az összes alapvető vállalkozási profil terület ki van töltve."],
  [/\b(\d+) areas? could use more business detail\./g, "$1 területhez több üzleti részlet kell."],
  [/\b([^.<]+?) is temporarily unavailable\. The rest of the dashboard is still usable\./g, (_match, label) => `${translateDashboardText(label)} átmenetileg nem érhető el. Az irányítópult többi része továbbra is használható.`],
  [/\b(\d+) fields have safe suggestions ready for review\./g, "$1 mezőhöz biztonságos javaslat áll készen áttekintésre."],
  [/\b(\d+) pages? imported\b/g, "$1 oldal importálva"],
  [/\b(\d+) areas? could use a quick review before the Front Desk feels fully grounded\./g, "$1 terület gyors áttekintést igényel, hogy a Front Desk teljesen megalapozott legyen."],
  [/\b(\d+) leads\b/g, "$1 érdeklődő"],
  [/\b(\d+) inbox\b/g, "$1 email-szál"],
  [/\b(\d+) calendar\b/g, "$1 naptárbejegyzés"],
  [/\b(\d+) follow-ups\b/g, "$1 utánkövetés"],
  [/\b(\d+) outcomes\b/g, "$1 eredmény"],
  [/\b(\d+) interactions?\b/g, "$1 interakció"],
  [/\b(\d+) open conversation(?:s)?\b/g, "$1 nyitott beszélgetés"],
  [/\b(\d+) confirmed business outcomes?\b/g, "$1 megerősített üzleti eredmény"],
  [/\b(\d+) attributed outcomes?\b/g, "$1 hozzárendelt eredmény"],
  [/\b(\d+) pricing conversations?\b/g, "$1 árazási beszélgetés"],
  [/\b(\d+) mentions?\b/g, "$1 említés"],
  [/\b(\d+) active\b/g, "$1 aktív"],
  [/\b(\d+) customers?\b/g, "$1 ügyfél"],
  [/\b(\d+) destinations?\b/g, "$1 cél"],
  [/\b(\d+) links\b/g, "$1 link"],
  [/\b(\d+)% used\b/g, "$1% felhasználva"],
  [/\b(\d+) campaign approvals?\b/g, "$1 kampányjóváhagyás"],
  [/\b(\d+) follow-ups?\b/g, "$1 utánkövetés"],
  [/\b(\d+) follow-ups? and (\d+) campaign approvals? are waiting for review\./g, "$1 utánkövetés és $2 kampányjóváhagyás áttekintésre vár."],
  [/\b(\d+) high-value contacts? still need a real result and (\d+) complaint-risk contacts? remain in play\./g, "$1 magas értékű kapcsolatnak még valódi eredményre van szüksége, és $2 panaszkockázatos kapcsolat továbbra is aktív."],
  [/\b(\d+) conversions? have been tied back to campaign work so far\./g, "$1 konverzió kapcsolódott eddig kampánymunkához."],
  [/\b(\d+) customers · (\d+) qualified · (\d+) active leads\b/g, "$1 ügyfél · $2 minősített · $3 aktív érdeklődő"],
]);

function translateBusinessProfileSectionList(value = "") {
  return String(value || "")
    .split(/\s*,\s*/)
    .map((section) => {
      const normalized = trimText(section);
      return DASHBOARD_HU_PHRASES[normalized] || normalized;
    })
    .filter(Boolean)
    .join(", ");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function translateDashboardText(value = "") {
  let text = String(value ?? "");

  if (getDashboardLanguage() !== "hu" || !text) {
    return text;
  }

  text = DASHBOARD_HU_PHRASES[text] || text;
  DASHBOARD_HU_REGEX_PHRASES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text;
}

function localizeDashboardHtml(html = "") {
  if (getDashboardLanguage() !== "hu" || !html) {
    return html;
  }

  const protectedValues = [];
  const protect = (match) => {
    const token = `__VONZA_I18N_PROTECTED_${protectedValues.length}__`;
    protectedValues.push(match);
    return token;
  };

  let output = String(html)
    .replace(/<textarea\b[\s\S]*?<\/textarea>/gi, protect)
    .replace(/\b[\w:-]+="[^"]*"/gi, protect);

  Object.entries(DASHBOARD_HU_PHRASES)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([english, hungarian]) => {
      const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(english)})(?=$|[^A-Za-z])`, "g");
      output = output.replace(pattern, (_match, prefix) => `${prefix}${hungarian}`);
    });
  DASHBOARD_HU_REGEX_PHRASES.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });

  protectedValues.forEach((value, index) => {
    output = output.replace(`__VONZA_I18N_PROTECTED_${index}__`, value);
  });

  return output;
}

function applyDashboardLanguage(language = getDashboardLanguage()) {
  dashboardLanguage = normalizeDashboardLanguage(language);

  if (document.documentElement) {
    document.documentElement.lang = dashboardLanguage === "hu" ? "hu" : "en";
  }

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardLanguage = dashboardLanguage;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardLanguage = dashboardLanguage;
  }

  return dashboardLanguage;
}

function cacheDashboardLanguage(language) {
  const normalizedLanguage = applyDashboardLanguage(language);

  try {
    window.localStorage.setItem(DASHBOARD_LANGUAGE_STORAGE_KEY, normalizedLanguage);
  } catch {
    // Language preference caching is optional when storage is blocked.
  }

  return normalizedLanguage;
}

function getDashboardTheme() {
  try {
    return normalizeDashboardTheme(window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY));
  } catch {
    return "bright";
  }
}

function getDashboardBackground() {
  try {
    return normalizeDashboardBackground(window.localStorage.getItem(DASHBOARD_BACKGROUND_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_BACKGROUND;
  }
}

function getDashboardBackgroundBlur() {
  try {
    return normalizeDashboardBackgroundBlur(window.localStorage.getItem(DASHBOARD_BACKGROUND_BLUR_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_BACKGROUND_BLUR;
  }
}

function getDashboardGlassTransparency() {
  try {
    return normalizeDashboardGlassTransparency(window.localStorage.getItem(DASHBOARD_GLASS_TRANSPARENCY_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_GLASS_TRANSPARENCY;
  }
}

function getDashboardBackgroundDim() {
  try {
    return normalizeDashboardBackgroundDim(window.localStorage.getItem(DASHBOARD_BACKGROUND_DIM_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_BACKGROUND_DIM;
  }
}

function getDashboardAccentGlow() {
  try {
    return normalizeDashboardAccentGlow(window.localStorage.getItem(DASHBOARD_ACCENT_GLOW_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_ACCENT_GLOW;
  }
}

function getDashboardDensity() {
  try {
    return normalizeDashboardDensity(window.localStorage.getItem(DASHBOARD_DENSITY_STORAGE_KEY));
  } catch {
    return DEFAULT_DASHBOARD_DENSITY;
  }
}

function syncDashboardThemeControls(root = document) {
  const theme = normalizeDashboardTheme(document.documentElement?.dataset.dashboardAppearance || getDashboardTheme());
  root.querySelectorAll?.("[data-dashboard-theme-choice]")?.forEach((input) => {
    const selected = normalizeDashboardTheme(input.value) === theme;
    input.checked = selected;
    input.closest?.(".settings-shell-theme-option")?.classList.toggle("active", selected);
  });
}

function syncDashboardBackgroundControls(root = document) {
  const background = normalizeDashboardBackground(document.documentElement?.dataset.dashboardBackground || getDashboardBackground());
  const customDataUrl = getSavedDashboardCustomBackground();

  root.querySelectorAll?.("[data-dashboard-background-choice]")?.forEach((input) => {
    const inputBackground = input.value === DASHBOARD_CUSTOM_BACKGROUND_ID && !customDataUrl
      ? ""
      : normalizeDashboardBackground(input.value);
    const selected = inputBackground === background;
    if (input.value === DASHBOARD_CUSTOM_BACKGROUND_ID) {
      input.disabled = !customDataUrl;
    }
    input.checked = selected;
    input.closest?.(".settings-shell-background-option")?.classList.toggle("active", selected);
  });

  root.querySelectorAll?.(".settings-shell-background-thumb--custom")?.forEach((thumb) => {
    if (customDataUrl) {
      thumb.style.backgroundImage = `url("${customDataUrl.replace(/"/g, "%22")}")`;
      thumb.textContent = "";
      return;
    }

    thumb.style.backgroundImage = "";
    thumb.textContent = "Upload";
  });

  root.querySelectorAll?.("[data-dashboard-custom-background-upload-trigger]")?.forEach((trigger) => {
    trigger.textContent = customDataUrl ? "Replace" : "Upload background";
  });

  root.querySelectorAll?.("[data-dashboard-custom-background-remove]")?.forEach((button) => {
    button.hidden = !customDataUrl;
  });
}

function syncDashboardBackgroundBlurControls(root = document) {
  const blur = normalizeDashboardBackgroundBlur(document.documentElement?.dataset.dashboardBackgroundBlur || getDashboardBackgroundBlur());
  root.querySelectorAll?.("[data-dashboard-background-blur-control]")?.forEach((input) => {
    input.value = String(blur);
    const output = input.closest?.(".settings-background-blur-control")?.querySelector?.("[data-dashboard-background-blur-value]")
      || root.getElementById?.(input.getAttribute?.("aria-describedby") || "");

    if (output) {
      output.textContent = `${blur}px`;
    }
  });
}

function syncDashboardAppearanceSegmentedControls(root, selector, normalizer, currentValue) {
  root.querySelectorAll?.(selector)?.forEach((input) => {
    const selected = normalizer(input.value) === currentValue;
    input.checked = selected;
    input.closest?.(".settings-dashboard-appearance-option")?.classList.toggle("active", selected);
  });
}

function syncDashboardGlassTransparencyControls(root = document) {
  const transparency = normalizeDashboardGlassTransparency(
    document.documentElement?.dataset.dashboardGlassTransparency || getDashboardGlassTransparency()
  );

  root.querySelectorAll?.("[data-dashboard-glass-transparency-control]")?.forEach((input) => {
    input.value = String(transparency);
    const output = input
      .closest?.(".settings-glass-transparency-control")
      ?.querySelector?.("[data-dashboard-glass-transparency-value]");

    if (output) {
      output.textContent = `${transparency}%`;
    }
  });
}

function syncDashboardBackgroundDimControls(root = document) {
  const dim = normalizeDashboardBackgroundDim(
    document.documentElement?.dataset.dashboardBackgroundDim || getDashboardBackgroundDim()
  );
  syncDashboardAppearanceSegmentedControls(
    root,
    "[data-dashboard-background-dim-choice]",
    normalizeDashboardBackgroundDim,
    dim
  );
}

function syncDashboardAccentGlowControls(root = document) {
  const glow = normalizeDashboardAccentGlow(
    document.documentElement?.dataset.dashboardAccentGlow || getDashboardAccentGlow()
  );
  syncDashboardAppearanceSegmentedControls(
    root,
    "[data-dashboard-accent-glow-choice]",
    normalizeDashboardAccentGlow,
    glow
  );
}

function syncDashboardDensityControls(root = document) {
  const density = normalizeDashboardDensity(
    document.documentElement?.dataset.dashboardDensity || getDashboardDensity()
  );
  syncDashboardAppearanceSegmentedControls(
    root,
    "[data-dashboard-density-choice]",
    normalizeDashboardDensity,
    density
  );
}

function bindDashboardSystemThemeListener() {
  if (dashboardSystemThemeListenerBound) {
    return;
  }

  try {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    if (!mediaQuery) {
      return;
    }

    const handleSystemThemeChange = () => {
      if (normalizeDashboardTheme(document.documentElement?.dataset.dashboardAppearance) === "system") {
        applyDashboardTheme("system");
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    dashboardSystemThemeListenerBound = true;
  } catch {
    // System appearance is optional when matchMedia is unavailable.
  }
}

function applyDashboardTheme(theme = getDashboardTheme()) {
  const normalizedTheme = normalizeDashboardTheme(theme);
  const resolvedTheme = resolveDashboardTheme(normalizedTheme);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardAppearance = normalizedTheme;
    document.documentElement.dataset.dashboardTheme = resolvedTheme;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardAppearance = normalizedTheme;
    document.body.dataset.dashboardTheme = resolvedTheme;
  }

  syncDashboardThemeControls();
  bindDashboardSystemThemeListener();
  return normalizedTheme;
}

function getDashboardBackgroundCssValue(option = {}) {
  if (option.type === "css") {
    return trimText(option.cssBackground);
  }

  if (option.type === "custom") {
    const customImageUrl = trimText(option.imageUrl);
    return isSafeDashboardCustomBackgroundDataUrl(customImageUrl)
      ? `url("${customImageUrl.replace(/"/g, "%22")}")`
      : "";
  }

  const imageUrl = trimText(option.url);
  return imageUrl ? `url("${imageUrl.replace(/"/g, "%22")}")` : "";
}

function applyDashboardBackground(background = getDashboardBackground()) {
  const normalizedBackground = normalizeDashboardBackground(background);
  const option = getDashboardBackgroundOption(normalizedBackground);
  const cssImageValue = getDashboardBackgroundCssValue(option);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardBackground = normalizedBackground;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardBackground = normalizedBackground;
  }

  if (cssImageValue) {
    document.documentElement?.style?.setProperty?.("--dashboard-background-image", cssImageValue);
  }

  syncDashboardBackgroundControls();
  return normalizedBackground;
}

function applyDashboardBackgroundBlur(blur = getDashboardBackgroundBlur()) {
  const normalizedBlur = normalizeDashboardBackgroundBlur(blur);
  const cssBlurValue = `${normalizedBlur}px`;

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardBackgroundBlur = String(normalizedBlur);
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardBackgroundBlur = String(normalizedBlur);
  }

  document.documentElement?.style?.setProperty?.("--dashboard-background-blur", cssBlurValue);
  document.body?.style?.setProperty?.("--dashboard-background-blur", cssBlurValue);

  syncDashboardBackgroundBlurControls();
  return normalizedBlur;
}

function getGlassVars(transparency) {
  const t = normalizeDashboardGlassTransparency(transparency) / 100;

  return {
    topAlpha: 0.52 - t * 0.46,
    bottomAlpha: 0.36 - t * 0.33,
    radialAlpha: 0.18 - t * 0.15,
    sheenAlpha: 0.16 - t * 0.12,
    reflectionOpacity: 0.42 - t * 0.34,
    blur: 36 - t * 24,
    borderAlpha: 0.48 + t * 0.24,
    highlightAlpha: 0.72 + t * 0.2,
    innerShadowAlpha: 0.12 - t * 0.07,
  };
}

function applyDashboardGlassTransparency(transparency = getDashboardGlassTransparency()) {
  const normalizedTransparency = normalizeDashboardGlassTransparency(transparency);
  const glassVars = getGlassVars(normalizedTransparency);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardGlassTransparency = String(normalizedTransparency);
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardGlassTransparency = String(normalizedTransparency);
  }

  const applyGlassVars = (target) => {
    target?.style?.setProperty?.("--vz-liquid-top-alpha", glassVars.topAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-bottom-alpha", glassVars.bottomAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-blur", `${Math.round(glassVars.blur)}px`);
    target?.style?.setProperty?.("--vz-liquid-border-alpha", glassVars.borderAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-highlight-alpha", glassVars.highlightAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-inner-shadow", glassVars.innerShadowAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-radial-alpha", glassVars.radialAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-sheen-alpha", glassVars.sheenAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-liquid-reflection-opacity", glassVars.reflectionOpacity.toFixed(2));
    target?.style?.setProperty?.("--vz-glass-top-alpha", glassVars.topAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-glass-bottom-alpha", glassVars.bottomAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-glass-radial-alpha", glassVars.radialAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-glass-blur", `${Math.round(glassVars.blur)}px`);
    target?.style?.setProperty?.("--vz-glass-border-alpha", glassVars.borderAlpha.toFixed(2));
    target?.style?.setProperty?.("--vz-glass-highlight-alpha", glassVars.highlightAlpha.toFixed(2));
  };

  applyGlassVars(document.documentElement);
  applyGlassVars(document.body);
  syncDashboardGlassTransparencyControls();
  return normalizedTransparency;
}

function applyDashboardBackgroundDim(dim = getDashboardBackgroundDim()) {
  const normalizedDim = normalizeDashboardBackgroundDim(dim);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardBackgroundDim = normalizedDim;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardBackgroundDim = normalizedDim;
  }

  document.documentElement?.style?.setProperty?.("--dashboard-background-dim", normalizedDim);
  document.body?.style?.setProperty?.("--dashboard-background-dim", normalizedDim);

  syncDashboardBackgroundDimControls();
  return normalizedDim;
}

function applyDashboardAccentGlow(glow = getDashboardAccentGlow()) {
  const normalizedGlow = normalizeDashboardAccentGlow(glow);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardAccentGlow = normalizedGlow;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardAccentGlow = normalizedGlow;
  }

  document.documentElement?.style?.setProperty?.("--dashboard-accent-glow-setting", normalizedGlow);
  document.body?.style?.setProperty?.("--dashboard-accent-glow-setting", normalizedGlow);

  syncDashboardAccentGlowControls();
  return normalizedGlow;
}

function applyDashboardDensity(density = getDashboardDensity()) {
  const normalizedDensity = normalizeDashboardDensity(density);

  if (document.documentElement?.dataset) {
    document.documentElement.dataset.dashboardDensity = normalizedDensity;
  }

  if (document.body?.dataset) {
    document.body.dataset.dashboardDensity = normalizedDensity;
  }

  document.documentElement?.style?.setProperty?.("--dashboard-density", normalizedDensity);
  document.body?.style?.setProperty?.("--dashboard-density", normalizedDensity);

  syncDashboardDensityControls();
  return normalizedDensity;
}

function saveDashboardTheme(theme) {
  const normalizedTheme = normalizeDashboardTheme(theme);

  try {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, normalizedTheme);
  } catch {
    // Theme persistence is optional when storage is blocked.
  }

  applyDashboardTheme(normalizedTheme);
  return normalizedTheme;
}

function saveDashboardBackground(background) {
  const normalizedBackground = normalizeDashboardBackground(background);

  try {
    window.localStorage.setItem(DASHBOARD_BACKGROUND_STORAGE_KEY, normalizedBackground);
  } catch {
    // Background persistence is optional when storage is blocked.
  }

  applyDashboardBackground(normalizedBackground);
  return normalizedBackground;
}

function validateDashboardCustomBackgroundFile(file) {
  if (!file) {
    throw new Error("Choose a background image first.");
  }

  if (!DASHBOARD_CUSTOM_BACKGROUND_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Upload a PNG, JPG, JPEG, or WebP background image. SVG and other file types are not supported.");
  }

  if (file.size > DASHBOARD_CUSTOM_BACKGROUND_MAX_BYTES) {
    throw new Error("Use a dashboard background image under 5 MB.");
  }
}

function readDashboardCustomBackgroundFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = trimText(reader.result || "");
      if (!isSafeDashboardCustomBackgroundDataUrl(dataUrl)) {
        reject(new Error("Upload a PNG, JPG, JPEG, or WebP background image."));
        return;
      }
      resolve(dataUrl);
    });
    reader.addEventListener("error", () => reject(new Error("We couldn't read that background image.")));
    reader.readAsDataURL(file);
  });
}

function loadDashboardCustomBackgroundImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("We couldn't preview that background image.")));
    image.src = dataUrl;
  });
}

async function prepareDashboardCustomBackgroundDataUrl(file) {
  validateDashboardCustomBackgroundFile(file);

  const originalDataUrl = await readDashboardCustomBackgroundFile(file);

  try {
    const image = await loadDashboardCustomBackgroundImage(originalDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight || !document.createElement) {
      return originalDataUrl;
    }

    const scale = Math.min(1, DASHBOARD_CUSTOM_BACKGROUND_MAX_WIDTH / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return originalDataUrl;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", DASHBOARD_CUSTOM_BACKGROUND_QUALITY);
  } catch {
    return originalDataUrl;
  }
}

function saveDashboardCustomBackgroundDataUrl(dataUrl) {
  if (!isSafeDashboardCustomBackgroundDataUrl(dataUrl)) {
    throw new Error("Upload a PNG, JPG, JPEG, or WebP background image.");
  }

  try {
    window.localStorage.setItem(DASHBOARD_CUSTOM_BACKGROUND_STORAGE_KEY, dataUrl);
  } catch {
    throw new Error("We couldn't save that image in this browser. Try a smaller background image.");
  }
}

function removeDashboardCustomBackgroundDataUrl() {
  try {
    window.localStorage.removeItem(DASHBOARD_CUSTOM_BACKGROUND_STORAGE_KEY);
  } catch {
    // Custom background persistence is optional when storage is blocked.
  }
}

function saveDashboardBackgroundBlur(blur) {
  const normalizedBlur = normalizeDashboardBackgroundBlur(blur);

  try {
    window.localStorage.setItem(DASHBOARD_BACKGROUND_BLUR_STORAGE_KEY, String(normalizedBlur));
  } catch {
    // Background blur persistence is optional when storage is blocked.
  }

  applyDashboardBackgroundBlur(normalizedBlur);
  return normalizedBlur;
}

function saveDashboardGlassTransparency(transparency) {
  const normalizedTransparency = normalizeDashboardGlassTransparency(transparency);

  try {
    window.localStorage.setItem(DASHBOARD_GLASS_TRANSPARENCY_STORAGE_KEY, String(normalizedTransparency));
  } catch {
    // Glass transparency persistence is optional when storage is blocked.
  }

  applyDashboardGlassTransparency(normalizedTransparency);
  return normalizedTransparency;
}

function saveDashboardBackgroundDim(dim) {
  const normalizedDim = normalizeDashboardBackgroundDim(dim);

  try {
    window.localStorage.setItem(DASHBOARD_BACKGROUND_DIM_STORAGE_KEY, normalizedDim);
  } catch {
    // Background dim persistence is optional when storage is blocked.
  }

  applyDashboardBackgroundDim(normalizedDim);
  return normalizedDim;
}

function saveDashboardAccentGlow(glow) {
  const normalizedGlow = normalizeDashboardAccentGlow(glow);

  try {
    window.localStorage.setItem(DASHBOARD_ACCENT_GLOW_STORAGE_KEY, normalizedGlow);
  } catch {
    // Accent glow persistence is optional when storage is blocked.
  }

  applyDashboardAccentGlow(normalizedGlow);
  return normalizedGlow;
}

function saveDashboardDensity(density) {
  const normalizedDensity = normalizeDashboardDensity(density);

  try {
    window.localStorage.setItem(DASHBOARD_DENSITY_STORAGE_KEY, normalizedDensity);
  } catch {
    // Density persistence is optional when storage is blocked.
  }

  applyDashboardDensity(normalizedDensity);
  return normalizedDensity;
}

function getInstallStorageKey(agentId) {
  return `${INSTALL_STORAGE_PREFIX}${agentId}`;
}

function getInstallProgress(agentId) {
  try {
    const rawValue = window.localStorage.getItem(getInstallStorageKey(agentId));
    return rawValue
      ? JSON.parse(rawValue)
      : { codeCopied: false, previewOpened: false, installed: false };
  } catch {
    return { codeCopied: false, previewOpened: false, installed: false };
  }
}

function saveInstallProgress(agentId, nextValue) {
  const mergedValue = {
    ...getInstallProgress(agentId),
    ...nextValue,
  };
  window.localStorage.setItem(getInstallStorageKey(agentId), JSON.stringify(mergedValue));
  return mergedValue;
}

function getLaunchState() {
  try {
    const rawValue = window.localStorage.getItem(LAUNCH_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function saveLaunchState(nextValue) {
  window.localStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify({
    ...nextValue,
    updatedAt: new Date().toISOString(),
  }));
}

function clearLaunchState() {
  window.localStorage.removeItem(LAUNCH_STORAGE_KEY);
}

function setDashboardFocus(target) {
  if (!target) {
    window.localStorage.removeItem(DASHBOARD_FOCUS_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_FOCUS_KEY, target);
}

function getDashboardFocus() {
  return window.localStorage.getItem(DASHBOARD_FOCUS_KEY);
}

function clearDashboardFocus() {
  window.localStorage.removeItem(DASHBOARD_FOCUS_KEY);
}

function getClaimDismissKey() {
  return `${CLAIM_DISMISS_PREFIX}${authUser?.id || "anonymous"}`;
}

function isClaimDismissed() {
  return window.localStorage.getItem(getClaimDismissKey()) === "1";
}

function dismissClaimBridge() {
  window.localStorage.setItem(getClaimDismissKey(), "1");
}

function clearClaimBridgeDismissal() {
  window.localStorage.removeItem(getClaimDismissKey());
}

function getAvailableShellSections(operatorWorkspace = createEmptyOperatorWorkspace()) {
  return getShellSectionsForWorkspace(operatorWorkspace);
}

function getLegacyFrontDeskSettingsRedirectHash(hash = window.location.hash) {
  const parts = dashboardState.getDashboardHashPathParts(hash);

  if (parts[0] !== "settings" || parts[1] !== "front-desk") {
    return "";
  }

  const tabSegment = dashboardState.getSettingsFrontDeskTabHashSegment(parts[2] || "identity-welcome");
  return `#front-desk/customization/${tabSegment}`;
}

function redirectLegacyFrontDeskSettingsHash() {
  const redirectHash = getLegacyFrontDeskSettingsRedirectHash();

  if (!redirectHash || !window.history?.replaceState) {
    return false;
  }

  const nextUrl = new URL(window.location.href);
  if (nextUrl.hash === redirectHash) {
    return false;
  }

  nextUrl.hash = redirectHash;
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  return true;
}

function getShellSectionFromHash(availableSections = FULL_SHELL_SECTIONS) {
  redirectLegacyFrontDeskSettingsHash();
  return dashboardState.getShellSectionFromHash(window.location.hash, availableSections);
}

function getDashboardHashSearchParams() {
  return dashboardState.getDashboardHashSearchParams(window.location.hash);
}

function getDashboardHashPathParts() {
  return dashboardState.getDashboardHashPathParts(window.location.hash);
}

function getDashboardHashRoot() {
  return dashboardState.getDashboardHashRoot(window.location.hash);
}

function normalizeInstallMethod(value = "") {
  return dashboardState.normalizeInstallMethod(value);
}

function getInstallMethodPanelKey(method = "") {
  return dashboardState.getInstallMethodPanelKey(method);
}

function getInstallMethodHashSegment(method = "") {
  return dashboardState.getInstallMethodHashSegment(method);
}

function normalizeInstallFullPageOption(value = "") {
  return dashboardState.normalizeInstallFullPageOption(value);
}

function normalizeFrontDeskSection(value = "") {
  if (typeof dashboardFrontDesk.normalizeFrontDeskSection === "function") {
    return dashboardFrontDesk.normalizeFrontDeskSection(value);
  }

  return dashboardState.normalizeFrontDeskSection(value);
}

function getFrontDeskSectionHashSegment(section = "") {
  return dashboardState.getFrontDeskSectionHashSegment(section);
}

function getDashboardUiStateHashUpdates() {
  return dashboardState.getDashboardUiStateHashUpdates(window.location.hash);
}

function loadDashboardUiState() {
  try {
    const rawState = window.sessionStorage?.getItem(DASHBOARD_UI_STATE_STORAGE_KEY);
    const storedState = rawState ? JSON.parse(rawState) : {};
    return {
      ...DASHBOARD_UI_STATE_DEFAULTS,
      ...storedState,
    };
  } catch (_error) {
    return {
      ...DASHBOARD_UI_STATE_DEFAULTS,
    };
  }
}

function persistDashboardUiState() {
  if (!window.sessionStorage?.setItem) {
    return;
  }

  const persistedState = {};
  DASHBOARD_UI_STATE_PERSISTED_KEYS.forEach((key) => {
    persistedState[key] = dashboardUiState[key] ?? DASHBOARD_UI_STATE_DEFAULTS[key];
  });

  try {
    window.sessionStorage.setItem(DASHBOARD_UI_STATE_STORAGE_KEY, JSON.stringify(persistedState));
  } catch (_error) {
    // UI state persistence is opportunistic; rendering should continue if storage is blocked.
  }
}

function setDashboardUiStateValue(key, value, options = {}) {
  if (!Object.hasOwn(DASHBOARD_UI_STATE_DEFAULTS, key)) {
    return dashboardUiState[key];
  }

  const normalizedValue = normalizeDashboardUiStateValue(key, value);
  dashboardUiState[key] = normalizedValue;

  if (options.persist !== false && DASHBOARD_UI_STATE_PERSISTED_KEYS.includes(key)) {
    persistDashboardUiState();
  }

  return normalizedValue;
}

function getDashboardUiStateValue(key) {
  const hashUpdates = getDashboardUiStateHashUpdates();

  if (Object.hasOwn(hashUpdates, key)) {
    return normalizeDashboardUiStateValue(key, hashUpdates[key]);
  }

  return normalizeDashboardUiStateValue(key, dashboardUiState[key]);
}

function normalizeDashboardUiStateValue(key, value) {
  return dashboardState.normalizeDashboardUiStateValue(key, value);
}

function normalizeCustomerFilterKey(value = "") {
  return dashboardState.normalizeCustomerFilterKey(value);
}

function getContactFilterFromHash() {
  return normalizeCustomerFilterKey(getDashboardHashSearchParams().get("filter") || "");
}

function getContactIdFromHash() {
  return trimText(getDashboardHashSearchParams().get("customer") || getDashboardHashSearchParams().get("contact"));
}

function syncCustomerHash(filterKey = "", contactId = "") {
  if (!window.history?.replaceState) {
    return;
  }

  const nextUrl = new URL(window.location.href);
  const params = new URLSearchParams();
  const normalizedFilter = normalizeCustomerFilterKey(filterKey);

  if (normalizedFilter && normalizedFilter !== "all") {
    params.set("filter", normalizedFilter.replace(/_/g, "-"));
  }

  if (trimText(contactId)) {
    params.set("customer", trimText(contactId));
  }

  nextUrl.hash = `customers${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function syncShellSectionHash(section, options = {}) {
  let hash = DASHBOARD_SECTION_HASHES[section] || "";

  if (section === "settings") {
    return;
  }

  if (section === "contacts" && ["customers", "customer", "contacts"].includes(getDashboardHashRoot())) {
    return;
  }

  if (section === "customize" && !options.frontDeskSection && ["front-desk", "frontdesk", "customize"].includes(getDashboardHashRoot()) && getDashboardHashPathParts()[1]) {
    return;
  }

  if (section === "customize") {
    hash = `front-desk/${getFrontDeskSectionHashSegment(options.frontDeskSection || getDashboardUiStateValue("frontDeskTab"))}`;
  } else if (section === "install") {
    hash = `install/${getInstallMethodHashSegment(options.installMethod || getDashboardUiStateValue("installMethod"))}`;
  }

  if (!window.history?.replaceState) {
    return;
  }

  const nextUrl = new URL(window.location.href);
  const nextHash = hash ? `#${hash}` : "";

  if (nextUrl.hash === nextHash) {
    return;
  }

  nextUrl.hash = hash;
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function getActiveShellSection(setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const storedSection = trimText(window.localStorage.getItem(DASHBOARD_SECTION_KEY)).toLowerCase();
  const availableSections = getAvailableShellSections(operatorWorkspace);
  const hashSection = getShellSectionFromHash(availableSections);

  if (hashSection) {
    window.localStorage.setItem(DASHBOARD_SECTION_KEY, hashSection);
    return hashSection;
  }

  if (activeDashboardProduct.currentPath && activeDashboardProduct.currentPath === activeDashboardProduct.canonicalPath) {
    window.localStorage.setItem(DASHBOARD_SECTION_KEY, "overview");
    return "overview";
  }

  if (availableSections.includes(storedSection)) {
    return storedSection;
  }

  return "overview";
}

function setActiveShellSection(section, operatorWorkspace = workspaceState?.operatorWorkspace || createEmptyOperatorWorkspace()) {
  if (!getAvailableShellSections(operatorWorkspace).includes(section)) {
    return;
  }

  window.localStorage.setItem(DASHBOARD_SECTION_KEY, section);
  syncShellSectionHash(section);
}

function getActiveFrontDeskSection() {
  const hashRoot = getDashboardHashRoot();
  const hashParts = getDashboardHashPathParts();
  const hashSection = ["front-desk", "frontdesk", "customize"].includes(hashRoot)
    ? normalizeFrontDeskSection(hashParts[1] || "")
    : "";

  if (hashRoot && ["front-desk", "frontdesk", "customize"].includes(hashRoot) && !hashParts[1]) {
    window.localStorage.setItem(DASHBOARD_FRONTDESK_SECTION_KEY, "practice");
    setDashboardUiStateValue("frontDeskTab", getFrontDeskSectionHashSegment("practice"));
    return "practice";
  }

  if (hashSection && hashParts[1]) {
    window.localStorage.setItem(DASHBOARD_FRONTDESK_SECTION_KEY, hashSection);
    setDashboardUiStateValue("frontDeskTab", getFrontDeskSectionHashSegment(hashSection));
    return hashSection;
  }

  const stateSection = normalizeFrontDeskSection(getDashboardUiStateValue("frontDeskTab"));
  if (FRONT_DESK_SECTIONS.includes(stateSection)) {
    return stateSection;
  }

  const storedSection = trimText(window.localStorage.getItem(DASHBOARD_FRONTDESK_SECTION_KEY)).toLowerCase();
  const normalizedStoredSection = normalizeFrontDeskSection(storedSection);

  if (FRONT_DESK_SECTIONS.includes(normalizedStoredSection)) {
    return normalizedStoredSection;
  }

  return "practice";
}

function setActiveFrontDeskSection(section, options = {}) {
  const normalizedSection = normalizeFrontDeskSection(section);
  if (!FRONT_DESK_SECTIONS.includes(normalizedSection)) {
    return;
  }

  window.localStorage.setItem(DASHBOARD_FRONTDESK_SECTION_KEY, normalizedSection);
  setDashboardUiStateValue("frontDeskTab", getFrontDeskSectionHashSegment(normalizedSection));

  if (options.syncHash === true) {
    syncShellSectionHash("customize", { frontDeskSection: normalizedSection });
  }
}

function createDashboardHelpState() {
  return {
    open: false,
    loading: false,
    draft: "",
    messages: [],
    suggestedPrompts: [],
    seededContextKey: "",
  };
}

function getDashboardHelpSectionLabel(section = "") {
  return DASHBOARD_HELP_SECTION_LABELS[trimText(section).toLowerCase()] || "Home";
}

function getDashboardHelpSubsectionLabel(section = "", subsection = "") {
  const sectionLabels = DASHBOARD_HELP_SUBSECTION_LABELS[trimText(section).toLowerCase()] || {};
  return sectionLabels[trimText(subsection).toLowerCase()] || "";
}

function getDashboardHelpContext(state = workspaceState) {
  const setup = state?.setup || inferSetup(state?.agent || {});
  const operatorWorkspace = state?.operatorWorkspace || createEmptyOperatorWorkspace();
  const currentSection = getActiveShellSection(setup, operatorWorkspace);
  const currentSubsection = currentSection === "customize" ? getActiveFrontDeskSection() : "";

  return {
    currentSection,
    currentSectionLabel: getDashboardHelpSectionLabel(currentSection),
    currentSubsection,
    currentSubsectionLabel: getDashboardHelpSubsectionLabel(currentSection, currentSubsection),
  };
}

function getDashboardHelpContextKey(context = getDashboardHelpContext()) {
  return [context.currentSection, context.currentSubsection].filter(Boolean).join(":") || "overview";
}

function buildDashboardHelpWelcomeMessage(
  context = getDashboardHelpContext(),
  state = workspaceState,
) {
  const setup = state?.setup || inferSetup(state?.agent || {});
  const operatorWorkspace = state?.operatorWorkspace || createEmptyOperatorWorkspace();
  const nextActionTitle = trimText(operatorWorkspace?.nextAction?.title);
  const needsAttentionCount = Number(operatorWorkspace?.today?.needsAttentionCount || 0);
  const installDetected = isInstallDetected(state?.agent?.installStatus);
  const location = context.currentSubsectionLabel
    ? `${context.currentSectionLabel} / ${context.currentSubsectionLabel}`
    : context.currentSectionLabel;
  const guidance = [];

  guidance.push(`I’m your in-app Vonza AI guide. I can explain ${location}, help you understand what is missing, and show you the best next move.`);

  if (!setup.hasWebsite) {
    guidance.push("Your workspace still needs a website connection before Vonza can be fully grounded.");
  } else if (setup.knowledgeLimited) {
    guidance.push("Right now the website knowledge is only partial, so improving grounding is one of the highest-leverage fixes.");
  } else if (!installDetected) {
    guidance.push("The front desk is not fully verified on a live site yet, so install is still part of the path to stronger results.");
  } else if (needsAttentionCount > 0) {
    guidance.push(`${needsAttentionCount} needs-attention item${needsAttentionCount === 1 ? "" : "s"} are visible in Home, so I can help you decide what to tackle first.`);
  }

  if (nextActionTitle) {
    guidance.push(`The current workspace next action is ${nextActionTitle}.`);
  }

  return guidance.join(" ");
}

function ensureDashboardHelpState(context = getDashboardHelpContext()) {
  if (!dashboardHelpState) {
    dashboardHelpState = createDashboardHelpState();
  }

  if (!Array.isArray(dashboardHelpState.messages)) {
    dashboardHelpState.messages = [];
  }

  if (!Array.isArray(dashboardHelpState.suggestedPrompts)) {
    dashboardHelpState.suggestedPrompts = [];
  }

  const contextKey = getDashboardHelpContextKey(context);
  const hasUserMessages = dashboardHelpState.messages.some((message) => message.role === "user");

  if (!dashboardHelpState.messages.length) {
    dashboardHelpState.messages.push({
      role: "assistant",
      content: buildDashboardHelpWelcomeMessage(context),
    });
    dashboardHelpState.seededContextKey = contextKey;
  } else if (!hasUserMessages && dashboardHelpState.seededContextKey !== contextKey) {
    dashboardHelpState.messages = [
      {
        role: "assistant",
        content: buildDashboardHelpWelcomeMessage(context),
      },
    ];
    dashboardHelpState.seededContextKey = contextKey;
  }

  return dashboardHelpState;
}

function buildDashboardHelpStarterPrompts(
  context = getDashboardHelpContext(),
  state = workspaceState,
) {
  const setup = state?.setup || inferSetup(state?.agent || {});
  const operatorWorkspace = state?.operatorWorkspace || createEmptyOperatorWorkspace();
  const helpState = ensureDashboardHelpState(context);
  const prompts = Array.isArray(helpState.suggestedPrompts) && helpState.suggestedPrompts.length
    ? [...helpState.suggestedPrompts]
    : [
      "What does this page do?",
      "What should I do next?",
    ];

  if (prompts.length >= 4) {
    return prompts.slice(0, 4);
  }

  if (context.currentSection === "install" || !setup.installReady || !isInstallDetected(state?.agent?.installStatus)) {
    prompts.push("How do I install Vonza?");
  } else if (operatorWorkspace?.status?.googleConnected !== true) {
    prompts.push("How do I connect email?");
  } else {
    prompts.push("How do I improve setup?");
  }

  if (setup.knowledgeLimited) {
    prompts.push("Why is my knowledge limited?");
  } else {
    prompts.push("How do I improve results?");
  }

  return prompts.slice(0, 4);
}

function buildDashboardHelpSnapshot(
  context = getDashboardHelpContext(),
  state = workspaceState,
) {
  const setup = state?.setup || inferSetup(state?.agent || {});
  const operatorWorkspace = state?.operatorWorkspace || createEmptyOperatorWorkspace();
  const today = operatorWorkspace?.today || {};
  const nextActionTitle = trimText(operatorWorkspace?.nextAction?.title);
  const cards = [
    {
      label: "Page",
      value: context.currentSubsectionLabel
        ? `${context.currentSectionLabel} / ${context.currentSubsectionLabel}`
        : context.currentSectionLabel,
      tone: "neutral",
    },
    {
      label: "Knowledge",
      value: setup.knowledgeReady ? "Ready" : setup.knowledgeLimited ? "Limited" : "Missing",
      tone: setup.knowledgeReady ? "ready" : setup.knowledgeLimited ? "limited" : "attention",
    },
    {
      label: "Install",
      value: isInstallDetected(state?.agent?.installStatus) ? "Detected" : "Needs setup",
      tone: isInstallDetected(state?.agent?.installStatus) ? "ready" : "attention",
    },
    {
      label: "Connected tools",
      value: operatorWorkspace?.status?.googleConnected ? "Google connected" : "Core only",
      tone: operatorWorkspace?.status?.googleConnected ? "ready" : "neutral",
    },
  ];

  const detail = nextActionTitle
    ? `Next: ${nextActionTitle}`
    : Number(today.needsAttentionCount || 0) > 0
      ? `${today.needsAttentionCount} needs-attention item${Number(today.needsAttentionCount || 0) === 1 ? "" : "s"}`
      : "Ready to answer product questions";

  return {
    title: "Context-aware support",
    copy: "Ask Vonza about the page you are on, why something is missing, how setup affects results, or what to do next.",
    detail,
    cards,
  };
}

function getTodayQueueItemKey(...args) {
  return callTodayHelper("getTodayQueueItemKey", args);
}

function getActiveTodayQueueSelection(items = []) {
  const storedKey = trimText(window.localStorage.getItem(DASHBOARD_TODAY_QUEUE_SELECTION_KEY));

  if (storedKey && items.some((item) => getTodayQueueItemKey(item) === storedKey)) {
    return storedKey;
  }

  return items.length ? getTodayQueueItemKey(items[0]) : "";
}

function setActiveTodayQueueSelection(queueKey = "") {
  if (!trimText(queueKey)) {
    window.localStorage.removeItem(DASHBOARD_TODAY_QUEUE_SELECTION_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_TODAY_QUEUE_SELECTION_KEY, queueKey);
}
function setStatus(message) {
  const nextMessage = translateDashboardText(message || "");
  if (statusBanner.textContent === nextMessage) {
    return;
  }
  statusBanner.textContent = nextMessage;
}

const dashboardInstallHelpers = dashboardInstall.createInstallHelpers({
  getPublicAppUrl,
  getClientId,
  escapeHtml,
  trimText,
  formatSeenAt,
  isInstallSeen,
});
const {
  buildScript,
  buildWidgetUrl,
  buildFrontDeskPreviewUrl,
  isPublicFullPageEnabled,
  buildFullPageAssistantUrl,
  buildSmartAssistantEmbed,
  buildFullPageQrEndpoint,
  buildSectionAssistantIframe,
  buildFullPageAssistantIframe,
  buildSimpleFullPageAssistantIframe,
  getInstallStatusCopy,
  getInstallStatusTone,
  hasFullPageAssistantCustomization,
  buildInstallMethodCards,
} = dashboardInstallHelpers;
const dashboardInstallPanelHelpers = dashboardInstall.createInstallPanelHelpers({
  buildFrontDeskPreviewUrl,
  buildFullPageAssistantIframe,
  buildFullPageAssistantUrl,
  buildFullPageQrEndpoint,
  buildInstallMethodCards,
  buildScript,
  buildSectionAssistantIframe,
  buildSmartAssistantEmbed,
  buildWidgetUrl,
  escapeHtml,
  formatSeenAt,
  getBadgeClass,
  getDashboardUiStateValue,
  getDefaultInstallStatus,
  getInstallMethodPanelKey,
  getInstallProgress,
  getInstallStatusCopy,
  getInstallStatusTone,
  getUiIconMarkup,
  hasFullPageAssistantCustomization,
  isInstallDetected,
  isInstallSeen,
  isPublicFullPageEnabled,
  normalizeInstallFullPageOption,
  t,
  trimText,
});
function buildInstallSection(agent, options = {}) {
  return dashboardInstallPanelHelpers.buildInstallSection(agent, options);
}

function buildInstallSidePanel(agent, setup, messages = []) {
  return dashboardInstallPanelHelpers.buildInstallSidePanel(agent, setup, messages);
}
const dashboardFrontDeskHelpers = dashboardFrontDesk.createFrontDeskHelpers({
  buildFullPageAssistantUrl,
  buildFrontDeskCustomizationPanel,
  buildFullPageQrEndpoint,
  buildLocalSectionNav,
  buildOperatorEmptyState,
  buildPageHeader,
  buildPageToolbar,
  createEmptyActionQueue,
  createEmptyFrontDeskTraining,
  createEmptyOperatorWorkspace,
  escapeHtml,
  formatKnowledgeState,
  formatSeenAt,
  getActiveFrontDeskSection,
  getBadgeClass,
  getBusinessProfileContentSummary,
  getDefaultInstallStatus,
  getFrontDeskMissingSetupFields,
  isInstallDetected,
  isInstallSeen,
  isMeaningfulWebsite,
  isPublicFullPageEnabled,
  localizeDashboardHtml,
  trimText,
});

function escapeHtml(value) {
  if (typeof dashboardHelpers.escapeHtml === "function") {
    return dashboardHelpers.escapeHtml(value);
  }

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimText(value) {
  if (typeof dashboardHelpers.trimText === "function") {
    return dashboardHelpers.trimText(value);
  }

  return String(value || "").trim();
}

function normalizeWidgetPurpose(value) {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (WIDGET_PURPOSE_OPTIONS.some((option) => option.value === normalized)) {
    return normalized;
  }

  if (/decision|decide|choose|compare/.test(normalized)) {
    return "make_decision";
  }
  if (/lead|capture|contact|follow_up|quote/.test(normalized)) {
    return "lead_capture";
  }
  if (/book|booking|next_step/.test(normalized)) {
    return "booking_next_step";
  }
  if (/guid|find|navigate/.test(normalized)) {
    return "guidance";
  }

  return "support";
}

function getWidgetPurposeOption(value) {
  const normalizedPurpose = normalizeWidgetPurpose(value);
  return WIDGET_PURPOSE_OPTIONS.find((option) => option.value === normalizedPurpose) || WIDGET_PURPOSE_OPTIONS[1];
}

function normalizeBusinessVertical(value) {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["clinic", "clinics", "healthcare", "medical", "dental", "wellness"].includes(normalized)) {
    return "clinic";
  }

  if (["web_studio", "web_studios", "web_agency", "agency", "digital_agency", "studio"].includes(normalized)) {
    return "web_studio";
  }

  if (["home_services", "home_service", "trades", "contractor", "repair", "field_service"].includes(normalized)) {
    return "home_services";
  }

  return BUSINESS_VERTICAL_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "";
}

function getBusinessVerticalOption(value) {
  const normalized = normalizeBusinessVertical(value);
  return BUSINESS_VERTICAL_OPTIONS.find((option) => option.value === normalized) || BUSINESS_VERTICAL_OPTIONS[0];
}

function formatRichTextHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function createEmptyBusinessProfileState() {
  return {
    id: "",
    agentId: "",
    businessId: "",
    ownerUserId: "",
    businessSummary: "",
    services: [],
    pricing: [],
    policies: [],
    serviceAreas: [],
    operatingHours: [],
    approvedContactChannels: ["website_chat"],
    approvalPreferences: {
      followUpDrafts: "owner_required",
      contactNextSteps: "owner_required",
      taskRecommendations: "owner_required",
      outcomeRecommendations: "owner_required",
      profileChanges: "owner_required",
    },
    readiness: {
      totalSections: 0,
      completedSections: 0,
      missingCount: 0,
      missingSections: [],
      summary: "",
    },
    prefill: {
      available: false,
      fieldCount: 0,
      sourceSummary: "",
      reviewRequired: true,
      suggestions: {
        businessSummary: {
          value: "",
          source: "",
        },
        services: [],
        pricing: [],
        policies: [],
        serviceAreas: [],
        operatingHours: [],
        approvedContactChannels: ["website_chat"],
        approvalPreferences: {
          followUpDrafts: "owner_required",
          contactNextSteps: "owner_required",
          taskRecommendations: "owner_required",
          outcomeRecommendations: "owner_required",
          profileChanges: "owner_required",
        },
      },
    },
    persistenceAvailable: true,
    migrationRequired: false,
  };
}

function normalizeBusinessProfileItems(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function formatStructuredBusinessProfileLines(items = [], keys = []) {
  return normalizeBusinessProfileItems(items)
    .map((item) => keys.map((key) => trimText(item[key])).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

function parseStructuredBusinessProfileLines(value, keys = []) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => trimText(line))
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => trimText(part));
      return Object.fromEntries(
        keys
          .map((key, index) => [key, parts[index] || ""])
          .filter(([, entry]) => entry)
      );
    })
    .filter((entry) => Object.keys(entry).length > 0);
}

function getBusinessProfileViewModel(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const empty = createEmptyBusinessProfileState();
  const profile = operatorWorkspace.businessProfile || empty;
  const prefill = profile.prefill || empty.prefill;
  const suggestions = prefill.suggestions || empty.prefill.suggestions;
  const approvalPreferences = {
    ...empty.approvalPreferences,
    ...(suggestions.approvalPreferences || {}),
    ...(profile.approvalPreferences || {}),
  };
  const approvedContactChannels = (profile.approvedContactChannels || []).length
    ? profile.approvedContactChannels
    : (suggestions.approvedContactChannels || empty.approvedContactChannels);

  return {
    ...empty,
    ...profile,
    approvalPreferences,
    approvedContactChannels,
    prefill,
    fields: {
      businessSummary: trimText(profile.businessSummary) || trimText(suggestions.businessSummary?.value),
      services: formatStructuredBusinessProfileLines(
        (profile.services || []).length ? profile.services : suggestions.services,
        ["name", "note"]
      ),
      pricing: formatStructuredBusinessProfileLines(
        (profile.pricing || []).length ? profile.pricing : suggestions.pricing,
        ["label", "amount", "details"]
      ),
      policies: formatStructuredBusinessProfileLines(
        (profile.policies || []).length ? profile.policies : suggestions.policies,
        ["label", "details"]
      ),
      serviceAreas: formatStructuredBusinessProfileLines(
        (profile.serviceAreas || []).length ? profile.serviceAreas : suggestions.serviceAreas,
        ["name", "note"]
      ),
      operatingHours: formatStructuredBusinessProfileLines(
        (profile.operatingHours || []).length ? profile.operatingHours : suggestions.operatingHours,
        ["label", "hours"]
      ),
    },
  };
}

function parseBusinessProfilePayload(form) {
  const formData = new FormData(form);

  return {
    businessSummary: trimText(formData.get("business_summary")),
    services: parseStructuredBusinessProfileLines(formData.get("services"), ["name", "note"]),
    pricing: parseStructuredBusinessProfileLines(formData.get("pricing"), ["label", "amount", "details"]),
    policies: parseStructuredBusinessProfileLines(formData.get("policies"), ["label", "details"]),
    serviceAreas: parseStructuredBusinessProfileLines(formData.get("service_areas"), ["name", "note"]),
    operatingHours: parseStructuredBusinessProfileLines(formData.get("operating_hours"), ["label", "hours"]),
  };
}

function formatSeenAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function isMeaningfulWebsite(value) {
  const normalized = trimText(value);
  return normalized && !normalized.endsWith(".local");
}

function classifyImportResult(result) {
  const content = trimText(result?.content || "");

  if (!content) {
    return {
      knowledgeState: "missing",
      label: "Getting started",
      description: "Website details have not been pulled in yet. Import your site when you want stronger, more tailored answers.",
    };
  }

  if (content.includes(LIMITED_CONTENT_MARKER)) {
    return {
      knowledgeState: "limited",
      label: "Growing",
      description: "Vonza has some website detail already, and another import should make answers sharper and more complete.",
    };
  }

  return {
    knowledgeState: "ready",
    label: "Ready",
    description: "Your website content is in place, so the Front Desk can answer real customer questions with solid context.",
  };
}

function getKnowledgeImportPollIntervalMs(attempt = 0) {
  const configured = Number(window.VONZA_IMPORT_POLL_INTERVAL_MS);
  const baseInterval = Number.isFinite(configured) && configured >= 0 ? configured : 2000;
  if (baseInterval === 0) {
    return 0;
  }
  const steppedInterval = baseInterval + Math.min(Math.max(attempt, 0), 4) * 500;

  return Math.min(Math.max(steppedInterval, 0), 6000);
}

function getOwnerSafeImportErrorMessage() {
  return "Website import could not finish. Check that the site is reachable, then retry.";
}

function getKnowledgeImportStatusUrl(agentId, jobId, clientId, statusUrl = "") {
  const provided = trimText(statusUrl);

  if (provided) {
    return provided;
  }

  const url = new URL(`/api/agents/${encodeURIComponent(agentId)}/knowledge/import/status`, window.location.origin);
  if (jobId) {
    url.searchParams.set("job_id", jobId);
  }
  if (clientId) {
    url.searchParams.set("client_id", clientId);
  }

  return `${url.pathname}${url.search}`;
}

function buildKnowledgeImportMessage(state, status = {}) {
  const pageCount = Number(status.pageCount || status.knowledge?.pageCount || 0);

  if (state === "queued") {
    return "Website import is queued. You can keep working while Vonza prepares Front Desk knowledge.";
  }
  if (state === "indexing") {
    return "Website content was imported. Vonza is preparing semantic search for more precise Front Desk answers.";
  }
  if (state === "running" || state === "crawling") {
    return "Vonza is reading the website for Front Desk answers. This can take a few minutes on larger sites.";
  }
  if (state === "success") {
    return pageCount
      ? `${pageCount} page${pageCount === 1 ? "" : "s"} imported. Website knowledge is ready for Front Desk answers.`
      : "Website knowledge is ready for Front Desk answers.";
  }
  if (state === "limited") {
    return "Website content is available for the Front Desk, but semantic indexing did not fully finish. Retry import to refresh indexing.";
  }
  if (state === "stalled") {
    return "Website import is taking longer than expected. Retry import if this status does not move soon.";
  }
  if (state === "failed") {
    return getOwnerSafeImportErrorMessage();
  }

  return "Website import status will appear here.";
}

function normalizeKnowledgeImportState(value = "") {
  const normalized = trimText(value).toLowerCase();
  if (normalized === "queued") return "queued";
  if (normalized === "indexing") return "indexing";
  if (normalized === "running" || normalized === "crawling") return normalized;
  if (normalized === "success" || normalized === "ready" || normalized === "completed") return "success";
  if (normalized === "limited" || normalized === "partial") return "limited";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "stalled") return "stalled";
  return "";
}

function buildKnowledgeImportDisplayState(input = {}) {
  const job = input.job || {};
  const indexing = job.indexing || input.indexing || {};
  const rawState = normalizeKnowledgeImportState(input.state || job.status || input.status);
  const rawPhase = normalizeKnowledgeImportState(input.phase || job.phase);
  let state = rawState || rawPhase || "queued";

  if (job.stalled === true && KNOWLEDGE_IMPORT_ACTIVE_STATES.has(state)) {
    state = "stalled";
  } else if ((state === "running" || state === "crawling") && rawPhase === "indexing") {
    state = "indexing";
  } else if (state === "success") {
    const indexingStatus = normalizeKnowledgeImportState(indexing.status);
    if (indexingStatus === "limited" || indexingStatus === "failed" || trimText(indexing.status).toLowerCase() === "unavailable" || Number(indexing.errorCount || 0) > 0) {
      state = "limited";
    }
  }

  const pageCount = Number(job.pageCount || input.pageCount || input.knowledge?.pageCount || 0);
  const contentLength = Number(job.contentLength || input.contentLength || input.knowledge?.contentLength || 0);
  const display = {
    jobId: trimText(input.jobId || job.id),
    statusUrl: trimText(input.statusUrl),
    agentId: trimText(input.agentId),
    websiteUrl: trimText(input.websiteUrl),
    state,
    phase: rawPhase || state,
    label: state === "success"
      ? "Ready"
      : state === "limited"
        ? "Partial indexing"
        : state === "failed"
          ? "Failed"
          : state === "stalled"
            ? "Stalled"
            : state === "indexing"
              ? "Indexing"
              : state === "running" || state === "crawling"
                ? "Crawling"
                : "Queued",
    message: buildKnowledgeImportMessage(state, {
      pageCount,
      knowledge: input.knowledge,
    }),
    pageCount,
    contentLength,
    indexingStatus: trimText(indexing.status || ""),
    indexingMessage: state === "limited"
      ? "Website content may be ready now. Semantic search needs a retry before answers are fully optimized."
      : "",
    terminal: KNOWLEDGE_IMPORT_TERMINAL_STATES.has(state),
    retryable: state === "limited" || state === "failed" || state === "stalled",
    updatedAt: trimText(job.updatedAt || input.updatedAt || ""),
  };

  return display;
}

function mergeKnowledgeImportIntoSetup(setup = {}, agent = {}) {
  if (!knowledgeImportPollState || trimText(knowledgeImportPollState.agentId) !== trimText(agent?.id)) {
    return setup;
  }

  return {
    ...setup,
    importStatus: { ...knowledgeImportPollState.display },
  };
}

function getKnowledgeImportDisplayState(agentId = "") {
  if (!knowledgeImportPollState) {
    return null;
  }
  if (agentId && trimText(knowledgeImportPollState.agentId) !== trimText(agentId)) {
    return null;
  }
  return { ...knowledgeImportPollState.display };
}

window.VonzaDashboardImportStatus = {
  getDisplayState: getKnowledgeImportDisplayState,
};

function stopKnowledgeImportPolling() {
  if (knowledgeImportPollState?.timerId) {
    window.clearTimeout(knowledgeImportPollState.timerId);
  }
  knowledgeImportPollState = null;
}

function renderKnowledgeImportProgress() {
  if (!workspaceState?.agent || !knowledgeImportPollState) {
    return;
  }
  if (trimText(workspaceState.agent.id) !== trimText(knowledgeImportPollState.agentId)) {
    return;
  }
  renderWorkspaceFromState();
}

async function pollKnowledgeImportStatus() {
  const state = knowledgeImportPollState;
  if (!state || state.stopped || state.display?.terminal) {
    return;
  }

  if (state.pollCount >= KNOWLEDGE_IMPORT_MAX_POLLS) {
    state.display = buildKnowledgeImportDisplayState({
      ...state.display,
      state: "stalled",
      jobId: state.jobId,
      agentId: state.agentId,
      websiteUrl: state.websiteUrl,
    });
    renderKnowledgeImportProgress();
    return;
  }

  state.pollCount += 1;

  try {
    const statusData = await fetchJson(state.statusUrl);
    if (knowledgeImportPollState !== state || state.stopped) {
      return;
    }

    state.display = buildKnowledgeImportDisplayState({
      ...statusData,
      jobId: statusData?.job?.id || state.jobId,
      statusUrl: state.statusUrl,
      agentId: statusData?.agentId || state.agentId,
      websiteUrl: statusData?.websiteUrl || state.websiteUrl,
    });
    renderKnowledgeImportProgress();

    if (state.display.terminal) {
      if (state.display.state === "success") {
        trackProductEvent("knowledge_imported", {
          agentId: state.agentId,
          metadata: {
            mode: "async",
            pageCount: state.display.pageCount,
            contentLength: state.display.contentLength,
          },
        });
      } else if (state.display.state === "limited") {
        trackProductEvent("knowledge_limited", {
          agentId: state.agentId,
          metadata: {
            mode: "async",
            pageCount: state.display.pageCount,
            indexingStatus: state.display.indexingStatus,
          },
        });
      }
      setStatus(state.display.message);
      await refreshDashboardInBackground({ agentId: state.agentId, activeAction: "knowledge-import" });
      return;
    }
  } catch (error) {
    if (knowledgeImportPollState !== state || state.stopped) {
      return;
    }

    state.lastError = error;
    if (state.pollCount >= 3) {
      state.display = buildKnowledgeImportDisplayState({
        ...state.display,
        state: "stalled",
        jobId: state.jobId,
        agentId: state.agentId,
        websiteUrl: state.websiteUrl,
      });
      setStatus(state.display.message);
      renderKnowledgeImportProgress();
      return;
    }
  }

  if (knowledgeImportPollState === state && !state.display?.terminal) {
    state.timerId = window.setTimeout(pollKnowledgeImportStatus, getKnowledgeImportPollIntervalMs(state.pollCount));
  }
}

function startKnowledgeImportPolling(agent, importData, options = {}) {
  const jobId = trimText(importData?.import?.jobId);
  const agentId = trimText(importData?.agentId || agent?.id);
  const clientId = trimText(options.clientId || getClientId());
  const statusUrl = getKnowledgeImportStatusUrl(agentId, jobId, clientId, importData?.statusUrl);

  if (!jobId || !agentId || !statusUrl) {
    return null;
  }

  stopKnowledgeImportPolling();
  const display = buildKnowledgeImportDisplayState({
    state: importData?.import?.status || "queued",
    jobId,
    statusUrl,
    agentId,
    websiteUrl: importData?.websiteUrl || agent?.websiteUrl,
  });
  knowledgeImportPollState = {
    agentId,
    jobId,
    statusUrl,
    websiteUrl: display.websiteUrl,
    pollCount: 0,
    timerId: null,
    stopped: false,
    display,
  };
  renderKnowledgeImportProgress();
  knowledgeImportPollState.timerId = window.setTimeout(pollKnowledgeImportStatus, getKnowledgeImportPollIntervalMs(0));

  return display;
}

function inferSetup(agent) {
  const knowledge = agent.knowledge || {
    state: "missing",
    description: "Website details have not been imported yet.",
    contentLength: 0,
    pageCount: 0,
  };
  const personalityReady = Boolean(trimText(agent.assistantName) && trimText(agent.welcomeMessage) && trimText(agent.tone));
  const hasWebsite = isMeaningfulWebsite(agent.websiteUrl);
  const knowledgeState = hasWebsite ? (knowledge.state || "missing") : "missing";
  const previewReady = Boolean(trimText(agent.publicAgentKey));
  const installReady = previewReady;

  return {
    personalityReady,
    hasWebsite,
    websiteConnected: hasWebsite,
    knowledgeState,
    knowledgeReady: knowledgeState === "ready",
    knowledgeLimited: knowledgeState === "limited",
    knowledgeMissing: knowledgeState === "missing",
    knowledgeDescription: hasWebsite
      ? (knowledge.description || "Website details have not been imported yet.")
      : "Add your website so Vonza can learn the details customers ask about.",
    knowledgePageCount: Number(knowledge.pageCount || 0),
    knowledgeContentLength: Number(knowledge.contentLength || 0),
    previewReady,
    installReady,
    isReady: personalityReady && hasWebsite && knowledgeState === "ready" && previewReady && installReady,
  };
}

function getBadgeClass(type) {
  if (type === "Ready") {
    return "badge success";
  }
  if (type === "Limited" || type === "Needs attention") {
    return "badge warning";
  }
  return "badge pending";
}

function normalizeAccessStatus(value) {
  const normalized = trimText(value).toLowerCase();
  return ["pending", "active", "suspended"].includes(normalized) ? normalized : "pending";
}

function getAccessCopy(agent) {
  const launchProfile = getLaunchProfile();

  if (!agent?.id) {
    return {
      eyebrow: "Purchase step",
      headline: "Unlock Vonza to open your AI front desk workspace.",
      copy: `Start with secure checkout. Right after payment, Vonza opens the stable launch core: your AI front desk, Home, Customers, Analytics, website import, and install. ${launchProfile.product.purchaseSummary}`,
    };
  }

  const accessStatus = normalizeAccessStatus(agent?.accessStatus);

  if (accessStatus === "active") {
    return {
      eyebrow: "Workspace active",
      headline: "Your Vonza workspace is open.",
      copy: "Your public launch workspace is active. The stable core is the AI front desk, Home, Customers, Front Desk, and Analytics. Google-connected Email, Calendar, and Automations stay out of the launch UI.",
    };
  }

  if (accessStatus === "suspended") {
    return {
      eyebrow: "Access paused",
      headline: "Your Vonza workspace is currently paused.",
      copy: "Your front-desk setup is still here, but workspace access is not active right now. Once access is restored, you will land straight back in Vonza.",
    };
  }

  return {
    eyebrow: "Access pending",
    headline: "Your front desk setup is saved, and workspace access is not active yet.",
    copy: "Your setup is tied to your account, but workspace access still needs to be activated before you can use the stable launch core in Home, Customers, Front Desk, and Analytics.",
  };
}

function renderAccessLocked(agent) {
  renderTopbarMeta();
  const access = getAccessCopy(agent);
  const accessStatus = normalizeAccessStatus(agent?.accessStatus);
  const selectedPlan = getBillingPlan(getSelectedBillingPlanKey());
  const unlockLabel = accessStatus === "suspended"
    ? `Restore access with ${selectedPlan.displayName}`
    : `Continue with ${selectedPlan.displayName}`;
  const showDevTools = isDevFakeBillingEnabled();
  const hasAssistant = Boolean(agent?.id);
  const arrival = getArrivalContext();
  const pricingCardsMarkup = getBillingPlans()
    .map((plan) => `
      <button
        type="button"
        class="plan-option-card ${plan.key === selectedPlan.key ? "active" : ""}"
        data-plan-select="${escapeHtml(plan.key)}"
        aria-pressed="${plan.key === selectedPlan.key ? "true" : "false"}"
      >
        <span class="plan-option-name-row">
          <strong>${escapeHtml(plan.displayName)}</strong>
          ${plan.recommended ? '<span class="plan-option-badge">Most popular</span>' : ""}
        </span>
        <span class="plan-option-price">${escapeHtml(plan.monthlyPriceLabel)}</span>
        <span class="plan-option-audience">${escapeHtml(trimText(plan.marketing?.audience) || "Monthly plan")}</span>
        <span class="plan-option-copy">${escapeHtml(trimText(plan.marketing?.summary) || "Simple monthly capacity.")}</span>
      </button>
    `)
    .join("");
  const handoffMarkup = !hasAssistant && arrival.showHandoff
    ? `
      <section class="handoff-card">
        <span class="handoff-step">${arrival.arrivedFromSite ? "Step 2 of 3" : "Welcome to your workspace"}</span>
        <h2 class="handoff-title">Unlock Vonza, then finish the front desk setup in one place.</h2>
        <p class="handoff-copy">You do not need to finish everything before payment. Once checkout is complete, you land in the stable launch workspace with Home, Front Desk, Customers, and Analytics guiding the next step.</p>
      </section>
    `
    : "";
  const detailsMarkup = hasAssistant
    ? `
      <div class="overview-grid" style="margin-top:24px;">
        <div class="overview-card">
          <p class="overview-label">Assistant</p>
          <p class="overview-value">${escapeHtml(agent.assistantName || agent.name || "Your assistant")}</p>
        </div>
        <div class="overview-card">
          <p class="overview-label">Website</p>
          <p class="overview-value">${escapeHtml(agent.websiteUrl || "No website connected yet")}</p>
        </div>
        <div class="overview-card">
          <p class="overview-label">Access status</p>
          <p class="overview-value">${escapeHtml(accessStatus)}</p>
        </div>
      </div>
    `
    : `
      <div class="overview-grid" style="margin-top:24px;">
        <div class="overview-card">
          <p class="overview-label">1. Purchase</p>
          <p class="overview-card-copy">Use hosted Stripe Checkout to unlock Vonza securely.</p>
        </div>
        <div class="overview-card">
          <p class="overview-label">2. Setup workspace</p>
          <p class="overview-card-copy">Tune the front desk, review Home, Customers, and Analytics, and keep connected tools for a later private workspace.</p>
        </div>
        <div class="overview-card">
          <p class="overview-label">3. Add to website</p>
          <p class="overview-card-copy">Copy the install code and place Vonza on the live site when you are ready to answer and route real visitors.</p>
        </div>
      </div>
    `;

  rootEl.innerHTML = `
    ${handoffMarkup}
    <section class="access-card">
      <span class="eyebrow">${escapeHtml(access.eyebrow)}</span>
      <h1 class="headline">${escapeHtml(access.headline)}</h1>
      <p class="auth-copy">${escapeHtml(access.copy)}</p>

      <div class="pricing-card">
        <div>
          <p class="overview-label">Simple monthly plans</p>
          <h2 class="pricing-title">${escapeHtml(selectedPlan.displayName)} · ${escapeHtml(selectedPlan.monthlyPriceLabel)}</h2>
          <p class="pricing-copy">All plans include the same Vonza experience. The difference is how much monthly AI usage is included.</p>
          <div class="plan-options-grid">
            ${pricingCardsMarkup}
          </div>
          <div class="pricing-bullets">
            <div class="pill">AI front desk and routing</div>
            <div class="pill">Home, Customers, and Analytics</div>
            <div class="pill">Website import and install</div>
            <div class="pill">${escapeHtml(trimText(selectedPlan.marketing?.audience) || "Monthly AI usage included")}</div>
          </div>
        </div>
        <div class="pricing-actions">
          <button id="unlock-vonza-button" class="primary-button" type="button" data-selected-plan="${escapeHtml(selectedPlan.key)}">${escapeHtml(unlockLabel)}</button>
          ${showDevTools ? '<button id="simulate-unlock-button" class="ghost-button" type="button">Simulate unlock (dev only)</button>' : ""}
          ${showDevTools ? '<button id="setup-doctor-button" class="ghost-button" type="button">Check local setup</button>' : ""}
          <button id="locked-signout-button" class="ghost-button" type="button">Sign out</button>
        </div>
      </div>
      ${detailsMarkup}
      <p class="auth-note">Once payment completes successfully, Vonza unlocks your account and brings you straight into the public launch workspace.</p>
      ${buildAppLegalSurfaceMarkup("billing")}
      ${showDevTools ? '<div id="setup-doctor-results" class="auth-note" style="margin-top:16px;"></div>' : ""}
    </section>
  `;

  if (!hasAssistant && arrival.showHandoff) {
    markHandoffSeen();
  }

  document.getElementById("unlock-vonza-button")?.addEventListener("click", async () => {
    try {
      setStatus("Opening secure checkout...");
      const checkoutPlanKey = normalizeBillingPlanKey(
        document.getElementById("unlock-vonza-button")?.dataset?.selectedPlan
      );
      const result = await fetchJson("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authUser?.email || null,
          plan_key: checkoutPlanKey,
        }),
      });

      if (!result?.url) {
        throw new Error("Checkout is not available right now.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setStatus(error.message || "We could not open checkout right now.");
    }
  });

  document.getElementById("simulate-unlock-button")?.addEventListener("click", async () => {
    try {
      setStatus("Dev billing simulation is activating access...");
      const checkoutPlanKey = normalizeBillingPlanKey(
        document.getElementById("unlock-vonza-button")?.dataset?.selectedPlan
      );
      await fetchJson("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "simulate",
          plan_key: checkoutPlanKey,
        }),
      });
      setStatus("Dev simulation complete. Opening your workspace...");
      await boot();
    } catch (error) {
      setStatus(error.message || "We could not simulate access right now.");
    }
  });

  document.getElementById("setup-doctor-button")?.addEventListener("click", async () => {
    const resultsEl = document.getElementById("setup-doctor-results");

    try {
      if (resultsEl) {
        resultsEl.textContent = "Checking your local setup...";
      }

      const result = await fetchJson("/setup-doctor");
      const checks = Array.isArray(result?.checks) ? result.checks : [];
      const missing = checks.filter((check) => !check.present).map((check) => check.key);
      const productionRateLimitMessage = trimText(result?.production?.rate_limit?.message);

      if (!resultsEl) {
        return;
      }

      if (!missing.length) {
        resultsEl.textContent = productionRateLimitMessage
          ? `Local setup looks ready. ${productionRateLimitMessage}`
          : "Local setup looks ready. All required env values are present.";
        return;
      }

      resultsEl.textContent = productionRateLimitMessage
        ? `Missing locally: ${missing.join(", ")}. ${productionRateLimitMessage}`
        : `Missing locally: ${missing.join(", ")}`;
    } catch (error) {
      if (resultsEl) {
        resultsEl.textContent = error.message || "We could not run the local setup check.";
      }
    }
  });

  document.getElementById("locked-signout-button")?.addEventListener("click", async () => {
    if (!authClient) {
      return;
    }

    await authClient.auth.signOut();
    authSession = null;
    authUser = null;
    clearAuthFlowStateFromUrl();
    setAuthFeedback(null, "");
    setStatus("Signed out.");
    await boot();
  });

  document.querySelectorAll("[data-plan-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPlanKey = normalizeBillingPlanKey(button.dataset.planSelect);
      const nextPlan = getBillingPlan(nextPlanKey);
      replaceBillingPlanInUrl(nextPlanKey);

      document.querySelectorAll("[data-plan-select]").forEach((candidate) => {
        const isActive = normalizeBillingPlanKey(candidate.dataset.planSelect) === nextPlanKey;
        candidate.classList.toggle("active", isActive);
        candidate.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      const unlockButton = document.getElementById("unlock-vonza-button");
      const titleEl = document.querySelector(".pricing-title");
      const lastPill = document.querySelector(".pricing-bullets .pill:last-child");

      if (unlockButton) {
        unlockButton.dataset.selectedPlan = nextPlanKey;
        unlockButton.textContent = accessStatus === "suspended"
          ? `Restore access with ${nextPlan.displayName}`
          : `Continue with ${nextPlan.displayName}`;
      }

      if (titleEl) {
        titleEl.textContent = `${nextPlan.displayName} · ${nextPlan.monthlyPriceLabel}`;
      }

      if (lastPill) {
        lastPill.textContent = trimText(nextPlan.marketing?.audience) || "Monthly AI usage included";
      }
    });
  });
}

function renderErrorState(title, copy) {
  renderTopbarMeta();
  rootEl.innerHTML = `
    <section class="auth-card">
      <span class="eyebrow">Workspace issue</span>
      <h1 class="headline">${escapeHtml(title || "We couldn't open your workspace.")}</h1>
      <p class="auth-copy">${escapeHtml(copy || "Please refresh and try again. If the issue continues, your existing setup and payment state are still safe.")}</p>
      <div class="auth-actions">
        <button id="workspace-retry-button" class="primary-button" type="button">Try again</button>
      </div>
    </section>
  `;

  document.getElementById("workspace-retry-button")?.addEventListener("click", () => {
    window.location.reload();
  });
}

function renderLoadingState() {
  renderTopbarMeta();
  applyDashboardLanguage();
  rootEl.innerHTML = `
    <section class="dashboard-loading-screen" role="status" aria-live="polite" aria-busy="true" aria-label="${escapeHtml(t("app.loading.title"))}">
      <div class="dashboard-loading-orb dashboard-loading-orb-one" aria-hidden="true"></div>
      <div class="dashboard-loading-orb dashboard-loading-orb-two" aria-hidden="true"></div>
      <div class="dashboard-loading-shell">
        <div class="dashboard-loading-header">
          <div class="dashboard-loading-mark" aria-hidden="true">V</div>
          <h1 data-loading-title>${escapeHtml(t("app.loading.title"))}</h1>
          <p data-loading-copy>${escapeHtml(t("app.loading.copy"))}</p>
        </div>

        <div class="dashboard-loading-progress" role="progressbar" aria-label="${escapeHtml(t("app.loading.title"))}" aria-valuetext="Loading">
          <span></span>
        </div>

        <ol class="dashboard-loading-steps" aria-label="Workspace preparation progress">
          <li class="dashboard-loading-step is-complete">
            <span class="dashboard-loading-step-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path d="M7.8 13.6 4.5 10.3l1.4-1.4 1.9 1.9 6.3-6.2 1.4 1.4-7.7 7.6Z"></path>
              </svg>
            </span>
            <span>
              <strong>${escapeHtml(t("app.loading.stepProfile"))}</strong>
              <em>${escapeHtml(t("app.loading.stepCompleted"))}</em>
            </span>
          </li>
          <li class="dashboard-loading-step is-active">
            <span class="dashboard-loading-step-icon" aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(t("app.loading.stepConversations"))}</strong>
              <em>${escapeHtml(t("app.loading.stepInProgress"))}</em>
            </span>
          </li>
          <li class="dashboard-loading-step is-next">
            <span class="dashboard-loading-step-icon" aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(t("app.loading.stepDashboard"))}</strong>
              <em>${escapeHtml(t("app.loading.stepUpNext"))}</em>
            </span>
          </li>
        </ol>

        <div class="dashboard-skeleton-preview" aria-hidden="true">
          <div class="dashboard-skeleton-sidebar">
            <span class="dashboard-skeleton-mini-mark"></span>
            <span class="dashboard-skeleton-line short"></span>
            <span class="dashboard-skeleton-line"></span>
            <span class="dashboard-skeleton-line active"></span>
            <span class="dashboard-skeleton-line"></span>
            <span class="dashboard-skeleton-line"></span>
            <span class="dashboard-skeleton-line"></span>
          </div>
          <div class="dashboard-skeleton-grid">
            <div class="dashboard-skeleton-card dashboard-skeleton-chart">
              <span class="dashboard-skeleton-line short"></span>
              <svg viewBox="0 0 260 120" focusable="false">
                <path class="dashboard-skeleton-gridline" d="M18 92H242M18 60H242M18 28H242"></path>
                <path class="dashboard-skeleton-chartline" d="M18 96c18-20 28-14 44-33 20-23 38-4 58-14 24-12 34 2 58-10 26-13 34-35 64-47"></path>
              </svg>
            </div>
            <div class="dashboard-skeleton-card dashboard-skeleton-list">
              <span class="dashboard-skeleton-line short"></span>
              <span></span><span></span><span></span>
            </div>
            <div class="dashboard-skeleton-card dashboard-skeleton-donut">
              <span class="dashboard-skeleton-line short"></span>
              <div class="dashboard-skeleton-donut-ring"></div>
              <div class="dashboard-skeleton-donut-lines">
                <span></span><span></span><span></span>
              </div>
            </div>
            <div class="dashboard-skeleton-card dashboard-skeleton-table">
              <span class="dashboard-skeleton-line short"></span>
              <span></span><span></span><span></span>
            </div>
            <div class="dashboard-skeleton-card dashboard-skeleton-table">
              <span class="dashboard-skeleton-line short"></span>
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <p class="dashboard-loading-reassurance">
          <span aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="M10 2.2 16.4 5v4.7c0 3.8-2.6 6.8-6.4 8.1-3.8-1.3-6.4-4.3-6.4-8.1V5L10 2.2Zm0 2.1L5.5 6.2v3.5c0 2.7 1.7 4.9 4.5 6 2.8-1.1 4.5-3.3 4.5-6V6.2L10 4.3Zm3.2 4.4-4 4-2.1-2.1 1.2-1.2.9.9L12 7.5l1.2 1.2Z"></path>
            </svg>
          </span>
          ${escapeHtml(t("app.loading.footer"))}
        </p>
      </div>
    </section>
  `;
}

function _getDashboardRuntimeState() {
  return {
    ...dashboardRuntimeState,
  };
}

function markDashboardBooted() {
  dashboardRuntimeState.hasBooted = true;
  dashboardRuntimeState.isBootLoading = false;
}

function setDashboardBackgroundRefreshing(isRefreshing, activeAction = null) {
  dashboardRuntimeState.isBackgroundRefreshing = Boolean(isRefreshing);
  dashboardRuntimeState.activeAction = isRefreshing ? activeAction : null;
}

function shouldRenderBootLoading(options = {}) {
  return options.forceBootLoading === true || dashboardRuntimeState.hasBooted !== true;
}

function renderDashboardLanguageChooser(errorMessage = "") {
  renderTopbarMeta();
  const currentLanguage = getDashboardLanguage();
  const languages = window.VonzaDashboardI18n?.SUPPORTED_LANGUAGES || [
    { code: "en", nativeLabel: "English" },
    { code: "hu", nativeLabel: "Magyar" },
  ];

  rootEl.innerHTML = `
    <section class="dashboard-language-screen">
      <form class="dashboard-language-card" data-dashboard-language-first-run>
        <div>
          <p class="studio-kicker">Vonza</p>
          <h1>${escapeHtml(t("language.title"))}</h1>
          <p>${escapeHtml(t("language.subtitle"))}</p>
        </div>
        <div class="dashboard-language-options" role="radiogroup" aria-label="${escapeHtml(t("language.title"))}">
          ${languages.map((language) => `
            <label class="dashboard-language-option ${currentLanguage === language.code ? "active" : ""}">
              <input
                type="radio"
                name="dashboard_language"
                value="${escapeHtml(language.code)}"
                ${currentLanguage === language.code ? "checked" : ""}
              >
              <span>${escapeHtml(language.nativeLabel || language.label)}</span>
            </label>
          `).join("")}
        </div>
        ${errorMessage ? `<p class="dashboard-language-error">${escapeHtml(errorMessage)}</p>` : ""}
        <button class="primary-button" type="submit">${escapeHtml(t("language.continue"))}</button>
      </form>
    </section>
  `;

  const form = rootEl.querySelector("[data-dashboard-language-first-run]");
  const submitButton = form?.querySelector('button[type="submit"]');

  rootEl.querySelectorAll('input[name="dashboard_language"]').forEach((input) => {
    input.addEventListener("change", () => {
      applyDashboardLanguage(input.value);
      renderDashboardLanguageChooser();
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const selectedLanguage = normalizeDashboardLanguage(formData.get("dashboard_language"));

    submitButton.disabled = true;
    submitButton.textContent = t("language.saving");
    setStatus(t("language.saving"));

    try {
      await saveDashboardLanguage(selectedLanguage);
      setStatus(t("language.settingsSaved"));
      await boot();
    } catch (error) {
      setStatus(error.message || t("language.error"));
      renderDashboardLanguageChooser(error.message || t("language.error"));
    }
  });
}

async function confirmPaymentReturn() {
  const paymentState = getPaymentState();

  if (paymentState.payment !== "success" || !paymentState.sessionId) {
    return false;
  }

  setStatus("Confirming your payment...");

  await fetchJson("/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "confirm",
      session_id: paymentState.sessionId,
    }),
  });

  return true;
}

async function waitForActiveAccessAfterPayment() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { agents, bridgeAgent } = await loadAgents();
    const agent = agents[0] || null;

    if (agent && normalizeAccessStatus(agent.accessStatus) === "active") {
      clearPaymentStateFromUrl();
      setStatus("Payment received. Your Vonza workspace is now unlocked.");
      return { agents, bridgeAgent, activated: true };
    }

    if (attempt < 5) {
      setStatus("Payment confirmed. We’re finishing access activation...");
      await wait(1500);
    }
  }

  return { activated: false, timedOut: true };
}

// Entry states and shell rendering
function renderAuthEntry() {
  renderTopbarMeta();
  const arrival = getArrivalContext();
  const mode = getAuthFlowType() === "recovery"
    ? AUTH_VIEW_MODES.UPDATE_PASSWORD
    : authViewMode;
  const config = getAuthModeConfig(mode, arrival);
  const showModeTabs = mode !== AUTH_VIEW_MODES.UPDATE_PASSWORD;

  rootEl.innerHTML = `
    <section class="auth-card">
      <span class="eyebrow">${escapeHtml(config.eyebrow)}</span>
      <h1 class="headline">${escapeHtml(config.headline)}</h1>
      <p class="auth-copy">${escapeHtml(config.copy)}</p>
      ${showModeTabs ? `
        <div class="auth-mode-tabs" role="tablist" aria-label="${escapeHtml(authCopy("Account access modes", "Fiók-hozzáférési módok"))}">
          <button class="auth-mode-tab ${mode === AUTH_VIEW_MODES.SIGN_UP ? "active" : ""}" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_UP}">${escapeHtml(authCopy("Create account", "Fiók létrehozása"))}</button>
          <button class="auth-mode-tab ${mode === AUTH_VIEW_MODES.SIGN_IN ? "active" : ""}" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">${escapeHtml(authCopy("Sign in", "Bejelentkezés"))}</button>
        </div>
      ` : ""}
      ${getAuthFeedbackMarkup()}
      <form id="auth-form" class="auth-form">
        ${renderAuthFields(mode)}
        <div class="auth-actions">
          <button id="auth-submit" class="primary-button" type="submit">${escapeHtml(config.submitLabel)}</button>
          <span class="auth-note">${escapeHtml(config.note)}</span>
        </div>
        ${renderAuthSecondaryLinks(mode)}
      </form>
      ${buildAuthLegalBlock(mode)}
    </section>
  `;

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      authViewMode = button.dataset.authMode || AUTH_VIEW_MODES.SIGN_IN;
      if (authViewMode !== AUTH_VIEW_MODES.UPDATE_PASSWORD) {
        clearAuthFlowStateFromUrl();
      }
      authCallbackIssue = null;
      setAuthFeedback(null, "");
      renderAuthEntry();
    });
  });

  document.getElementById("auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authClient) {
      setStatus(authCopy("Supabase Auth is not configured yet.", "A Supabase Auth még nincs beállítva."));
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = trimText(formData.get("email"));
    const password = trimText(formData.get("password"));
    const confirmPassword = trimText(formData.get("confirm_password"));
    const submitButton = document.getElementById("auth-submit");

    if (mode !== AUTH_VIEW_MODES.UPDATE_PASSWORD && !email) {
      setStatus(authCopy("Enter your email first.", "Először add meg az email címedet."));
      return;
    }

    if ((mode === AUTH_VIEW_MODES.SIGN_IN || mode === AUTH_VIEW_MODES.SIGN_UP || mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) && password.length < 8) {
      const message = authCopy(
        "Use a password with at least 8 characters.",
        "Használj legalább 8 karakteres jelszót."
      );
      setAuthFeedback("error", message);
      renderAuthEntry();
      setStatus(message);
      return;
    }

    if ((mode === AUTH_VIEW_MODES.SIGN_UP || mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) && password !== confirmPassword) {
      const message = authCopy(
        "Your password confirmation does not match.",
        "A két jelszó nem egyezik."
      );
      setAuthFeedback("error", message);
      renderAuthEntry();
      setStatus(message);
      return;
    }

    submitButton.disabled = true;
    setAuthFeedback(null, "");

    try {
      if (mode === AUTH_VIEW_MODES.SIGN_UP) {
        setStatus(authCopy("Creating your account...", "Fiók létrehozása..."));
        const { data, error } = await authClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });

        if (error) {
          throw error;
        }

        if (data?.session?.user) {
          authSession = data.session;
          authUser = data.session.user;
          setStatus(authCopy(
            "Account created. Opening your Vonza app...",
            "A fiók elkészült. Megnyitjuk a Vonza appot..."
          ));
          await boot();
          return;
        }

        authViewMode = AUTH_VIEW_MODES.SIGN_IN;
        setAuthFeedback("success", authCopy(
          "Account created. Check your email to confirm your address, then sign in with your password.",
          "A fiók elkészült. Ellenőrizd az emailedet a címed megerősítéséhez, majd jelentkezz be a jelszavaddal."
        ));
        renderAuthEntry();
        setStatus(authCopy(
          "Check your email to confirm your account.",
          "Nézd meg az emailedet a fiókod megerősítéséhez."
        ));
        return;
      }

      if (mode === AUTH_VIEW_MODES.SIGN_IN) {
        setStatus(authCopy("Signing you in...", "Bejelentkeztetünk..."));
        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        authSession = data.session || null;
        authUser = data.user || data.session?.user || null;
        setStatus(authCopy(
          "Signed in. Opening your Vonza app...",
          "Sikeres bejelentkezés. Megnyitjuk a Vonza appot..."
        ));
        await boot();
        return;
      }

      if (mode === AUTH_VIEW_MODES.RESET) {
        setStatus(authCopy("Sending your reset link...", "Küldjük a visszaállító linket..."));
        const { error } = await authClient.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
        });

        if (error) {
          throw error;
        }

        setAuthFeedback("success", authCopy(
          "Password reset email sent. Use the link in your inbox to choose a new password.",
          "Elküldtük a jelszó-visszaállító emailt. Az emailedben lévő linkkel választhatsz új jelszót."
        ));
        renderAuthEntry();
        setStatus(authCopy(
          "Password reset email sent.",
          "A jelszó-visszaállító email elküldve."
        ));
        return;
      }

      if (mode === AUTH_VIEW_MODES.MAGIC) {
        setStatus(authCopy("Sending your magic link...", "Küldjük a magic linket..."));
        const { error } = await authClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });

        if (error) {
          throw error;
        }

        setAuthFeedback("success", authCopy(
          "Magic link sent. Open the email from this device to continue into Vonza.",
          "A magic linket elküldtük. Nyisd meg erről az eszközről az emailt, és lépj tovább a Vonzába."
        ));
        authCallbackIssue = null;
        renderAuthEntry();
        setStatus(authCopy("Magic link sent.", "A magic link elküldve."));
        return;
      }

      if (mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) {
        setStatus(authCopy("Updating your password...", "Frissítjük a jelszavadat..."));
        const { error } = await authClient.auth.updateUser({
          password,
        });

        if (error) {
          throw error;
        }

        clearAuthFlowStateFromUrl();
        setAuthFeedback(null, "");
        setStatus(authCopy(
          "Password updated. Opening your Vonza app...",
          "A jelszó frissült. Megnyitjuk a Vonza appot..."
        ));
        await boot();
      }
    } catch (error) {
      const fallbackMessage = authCopy(
        "We could not complete authentication just yet.",
        "Az azonosítást most nem tudtuk befejezni."
      );
      setAuthFeedback("error", error.message || fallbackMessage);
      renderAuthEntry();
      setStatus(error.message || fallbackMessage);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function renderClaimAssistant(bridgeAgent) {
  renderTopbarMeta();
  rootEl.innerHTML = `
    <section class="claim-card">
      <span class="eyebrow">Claim your assistant</span>
      <h1 class="headline">We found an assistant created in this browser.</h1>
      <p class="auth-copy">Claim it to your signed-in Vonza account so you can access the same workspace from any browser or device.</p>
      <div class="overview-list">
        <div class="overview-list-item">
          <p class="overview-list-title">${escapeHtml(bridgeAgent.assistantName || bridgeAgent.name || "Your assistant")}</p>
          <p class="overview-list-copy">${escapeHtml(bridgeAgent.websiteUrl || "No website connected yet")}</p>
        </div>
      </div>
      <div class="auth-actions" style="margin-top:24px;">
        <button id="claim-assistant-button" class="primary-button" type="button">Claim this assistant</button>
        <button id="start-fresh-button" class="ghost-button" type="button">Start with a new assistant</button>
      </div>
    </section>
  `;

  document.getElementById("claim-assistant-button")?.addEventListener("click", async () => {
    try {
      setStatus("Claiming your assistant...");
      await fetchJson("/agents/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: bridgeAgent.id,
          client_id: getClientId(),
        }),
      });
      clearClaimBridgeDismissal();
      setStatus("Assistant claimed successfully.");
      await boot();
    } catch (error) {
      setStatus(error.message || "We could not claim that assistant just yet.");
    }
  });

  document.getElementById("start-fresh-button")?.addEventListener("click", () => {
    dismissClaimBridge();
    setStatus("You can create a fresh assistant in this workspace.");
    renderOnboarding();
  });
}

function renderOnboarding() {
  renderTopbarMeta();
  const arrival = getArrivalContext();
  const handoffMarkup = arrival.showHandoff
    ? `
      <section class="handoff-card">
        <span class="handoff-step">${arrival.arrivedFromSite ? "Step 1 of 4" : "Welcome to Vonza"}</span>
        <h2 class="handoff-title">${arrival.arrivedFromSite ? "You’re now in the workspace where the front desk becomes a real paid product." : "This is where you create the website front desk that powers the public launch core."}</h2>
        <p class="handoff-copy">${arrival.arrivedFromSite ? "You’ve moved from the Vonza site into the app. Next you’ll connect your website, shape routing and voice, try the live front desk, install it, and confirm the first lead path in Home, Customers, and Analytics." : "Connect your website, shape the front desk around your brand, and make the preview strong before you install it and start working from Home."}</p>
        <div class="handoff-actions">
          <button id="handoff-start-button" class="primary-button" type="button">Start creating</button>
          <span class="handoff-note">A few focused details are enough to get the front desk ready to try.</span>
        </div>
      </section>
    `
    : "";

  rootEl.innerHTML = `
    ${handoffMarkup}
    <section class="hero-card">
      <span class="eyebrow">Create your website front desk</span>
      <h1 class="headline">Turn your website into an AI front desk for your business.</h1>
      <p class="subtext">Vonza learns from your website, answers customer questions, routes high-intent visitors toward the right next step, and feeds the stable public launch core around Home, Customers, and Analytics.</p>
    </section>

    <div class="state-grid">
      <section id="onboarding-create" class="section-card">
        <h2 class="section-heading">Create your front desk</h2>
        <p class="section-copy">Start with the essentials. We’ll turn your website into a customer-facing front desk you can shape, preview, install, and then confirm inside Home, Customers, and Analytics. Connected workflow tools can come later.</p>
        <form id="create-assistant-form" class="form-grid spacer">
          <div class="field">
            <label for="create-website-url">Website URL</label>
            <input id="create-website-url" name="website_url" type="text" placeholder="https://yourwebsite.com">
          </div>
          <div class="field">
            <label for="create-assistant-name">Assistant name</label>
            <input id="create-assistant-name" name="assistant_name" type="text" placeholder="Your brand assistant">
          </div>
          <div class="field">
            <label for="create-tone">Tone</label>
            <select id="create-tone" name="tone">
              <option value="friendly">friendly</option>
              <option value="professional">professional</option>
              <option value="sales">sales</option>
              <option value="support">support</option>
            </select>
          </div>
          <div class="field">
            <label for="create-welcome-message">Welcome message</label>
            <textarea id="create-welcome-message" name="welcome_message" placeholder="Welcome your visitors in a warm, helpful way."></textarea>
          </div>
          <div class="field">
            <label for="create-primary-color">Primary color</label>
            <input id="create-primary-color" name="primary_color" type="color" value="#14b8a6">
          </div>
          <div class="inline-actions">
            <button id="create-assistant-button" class="primary-button" type="submit">Create your assistant</button>
          </div>
        </form>
      </section>

      <section class="section-card">
        <h2 class="section-heading">What you get</h2>
        <p class="section-copy">Your front desk becomes a polished front door for your business and the anchor for the stable public launch core.</p>
        <div class="pill-row">
          <div class="pill">Answers real customer questions</div>
          <div class="pill">Routes quotes, bookings, and callbacks</div>
          <div class="pill">Installs with one embed code</div>
          <div class="pill">Shows proof in Home, Customers, Analytics</div>
        </div>
      </section>
    </div>
  `;

  document.getElementById("create-assistant-form").addEventListener("submit", createAssistant);
  document.getElementById("create-assistant-form").addEventListener("focusin", () => {
    trackProductEvent("onboarding_started", {
      onceKey: "onboarding_started",
      metadata: { entry: "form_focus" },
    });
  }, { once: true });
  document.getElementById("handoff-start-button")?.addEventListener("click", () => {
    document.getElementById("onboarding-create")?.scrollIntoView({ behavior: "smooth", block: "start" });
    trackProductEvent("onboarding_started", {
      onceKey: "onboarding_started",
      metadata: { entry: "handoff_cta" },
    });
    markHandoffSeen();
  });

  if (arrival.showHandoff) {
    markHandoffSeen();
  }
}

function renderLaunchSequence(launchState = {}) {
  renderTopbarMeta();
  const currentStepIndex = Number.isFinite(launchState.stepIndex) ? launchState.stepIndex : 0;
  const detail = launchState.detail || "This can take a moment if your website is larger or slower to load.";
  const note = launchState.note || "Stay on this page while we prepare everything. If you refresh, we will reconnect you to the right place.";

  rootEl.innerHTML = `
    <section class="launch-card">
      <div class="launch-layout">
        <div class="launch-copy">
          <span class="eyebrow">${launchState.recovering ? "Picking up where you left off" : "Preparing your assistant"}</span>
          <h1 class="headline">${escapeHtml(launchState.headline || "Your assistant is taking shape.")}</h1>
          <p class="launch-meta">${escapeHtml(detail)}</p>
          <p class="launch-note">${escapeHtml(note)}</p>
        </div>

        <div class="launch-steps">
          ${LAUNCH_STEPS.map((step, index) => {
            const state = index < currentStepIndex ? "done" : index === currentStepIndex ? "active" : "pending";
            const label = state === "done" ? "Done" : state === "active" ? "In progress" : "Pending";

            return `
              <div class="launch-step ${state}">
                <div class="launch-step-index">${index + 1}</div>
                <div>
                  <p class="launch-step-title">${escapeHtml(step.title)}</p>
                  <p class="launch-step-copy">${escapeHtml(step.copy)}</p>
                </div>
                <div class="launch-step-state">${label}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderLaunchSuccess(agent, options = {}) {
  renderTopbarMeta();
  const accessStatus = normalizeAccessStatus(options.accessStatus);
  const ready = options.nextState === "ready";
  const isLocked = accessStatus !== "active";
  const actionLabel = isLocked
    ? "Continue"
    : ready
      ? "Try your front desk"
      : "Finish setup";
  const copy = isLocked
    ? "Your front desk has been created successfully. The next screen will show your workspace access and what to do next."
    : ready
      ? "Your front desk is ready to answer customer questions and show what your business offers."
      : "Your front desk is created and close to ready. One more website knowledge pass can make the experience even stronger.";

  rootEl.innerHTML = `
    <section class="launch-card">
      <div class="launch-success">
        <span class="eyebrow">${ready ? "Ready to try" : "Ready for final setup"}</span>
        <h1 class="headline">${ready ? "Your front desk is ready." : "Your front desk is created."}</h1>
        <p class="launch-success-copy">${escapeHtml(copy)}</p>
        <h2 class="assistant-name">${escapeHtml(agent.assistantName || agent.name || "Your assistant")}</h2>
        <div class="launch-action-row">
          <button id="launch-success-button" class="primary-button" type="button">${actionLabel}</button>
          <span class="save-state">Taking you there now...</span>
        </div>
      </div>
    </section>
  `;

  const focusTarget = ready ? "preview" : "setup";
  let hasContinued = false;
  const goNext = async () => {
    if (hasContinued) {
      return;
    }

    hasContinued = true;
    clearLaunchState();
    setDashboardFocus(focusTarget);
    await boot();
  };

  document.getElementById("launch-success-button")?.addEventListener("click", goNext);
  if (!isLocked) {
    window.setTimeout(goNext, 1300);
  }
}

function buildPageHeader({
  eyebrow = "",
  title = "",
  copy = "",
  badges = [],
  actionsMarkup = "",
} = {}) {
  return `
    <header class="page-header">
      <div class="page-header-copy">
        ${eyebrow ? `<p class="page-eyebrow">${escapeHtml(translateDashboardText(eyebrow))}</p>` : ""}
        <h1 class="page-title">${escapeHtml(translateDashboardText(title))}</h1>
        ${copy ? `<p class="page-copy">${escapeHtml(translateDashboardText(copy))}</p>` : ""}
        ${badges.length ? `
          <div class="page-badge-row">
            ${badges.map((badge) => `
              <span class="${getBadgeClass(badge.tone || "Pending")}">${escapeHtml(translateDashboardText(badge.label || ""))}</span>
            `).join("")}
          </div>
        ` : ""}
      </div>
      ${actionsMarkup ? `<div class="page-header-actions">${actionsMarkup}</div>` : ""}
    </header>
  `;
}

function buildPageToolbar({
  searchMarkup = "",
  filtersMarkup = "",
  actionsMarkup = "",
} = {}) {
  if (!searchMarkup && !filtersMarkup && !actionsMarkup) {
    return "";
  }

  return `
    <div class="page-toolbar">
      <div class="page-toolbar-primary">
        ${searchMarkup}
        ${filtersMarkup}
      </div>
      ${actionsMarkup ? `<div class="page-toolbar-actions">${actionsMarkup}</div>` : ""}
    </div>
  `;
}

function _buildSummaryStrip(items = []) {
  const visibleItems = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!visibleItems.length) {
    return "";
  }

  return `
    <div class="summary-strip">
      ${visibleItems.map((item) => `
        <article class="summary-strip-item">
          <p class="summary-strip-label">${escapeHtml(translateDashboardText(item.label))}</p>
          <p class="summary-strip-value">${escapeHtml(String(item.value))}</p>
          ${item.copy ? `<p class="summary-strip-copy">${escapeHtml(translateDashboardText(item.copy))}</p>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function buildDisclosureDetailRows(rows = [], { className = "disclosure-detail-list" } = {}) {
  const visibleRows = rows.filter((row) => row && (row.label || row.value || row.copy));

  if (!visibleRows.length) {
    return "";
  }

  return `
    <div class="${className}">
      ${visibleRows.map((row) => `
        <div class="disclosure-detail-row">
          ${row.label ? `<span class="disclosure-detail-label">${escapeHtml(translateDashboardText(row.label))}</span>` : ""}
          ${row.value !== undefined && row.value !== null && row.value !== "" ? `<strong class="disclosure-detail-value">${escapeHtml(row.value)}</strong>` : ""}
          ${row.copy ? `<p class="disclosure-detail-copy">${escapeHtml(translateDashboardText(row.copy))}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function buildDisclosureBlock({
  label = "View details",
  summary = "",
  contentMarkup = "",
  className = "",
  open = false,
} = {}) {
  if (!trimText(contentMarkup)) {
    return "";
  }

  const disclosureClassName = ["disclosure-block", className].filter(Boolean).join(" ");

  return `
    <details class="${disclosureClassName}" ${open ? "open" : ""}>
      <summary class="disclosure-toggle">
        <span class="disclosure-toggle-label">${escapeHtml(translateDashboardText(label))}</span>
        ${summary ? `<span class="disclosure-toggle-summary">${escapeHtml(translateDashboardText(summary))}</span>` : ""}
      </summary>
      <div class="disclosure-panel">
        ${contentMarkup}
      </div>
    </details>
  `;
}

function buildLocalSectionNav(items = [], { attribute = "data-local-target", activeKey = "" } = {}) {
  const visibleItems = items.filter((item) => item && item.key && item.label);

  if (!visibleItems.length) {
    return "";
  }

  return `
    <div class="local-section-nav">
      ${visibleItems.map((item) => `
        <button
          class="local-section-button ${item.key === activeKey ? "active" : ""}"
          type="button"
          ${attribute}="${escapeHtml(item.key)}"
        >${escapeHtml(translateDashboardText(item.label))}</button>
      `).join("")}
    </div>
  `;
}

function getUiIconMarkup(icon = "") {
  const icons = {
    home: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M3.5 8.6 10 3.7l6.5 4.9v7.1a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3Z" fill="currentColor" opacity=".18"></path>
        <path d="M6.2 10.1h2.3v4.2H6.2Zm5.3 0h2.3v4.2h-2.3ZM3.5 8.5 10 3.7l6.5 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    users: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="6.2" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M5 15.1c.8-2.4 2.5-3.7 5-3.7s4.2 1.3 5 3.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    chat: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M4.3 5.4a3 3 0 0 1 3-3h5.4a3 3 0 0 1 3 3v4.7a3 3 0 0 1-3 3H8.2l-3.9 3.1V5.4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
      </svg>
    `,
    sparkle: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 3.2v3.2m0 7.2v3.2M3.2 10h3.2m7.2 0h3.2M5.2 5.2l2.2 2.2m5.2 5.2 2.2 2.2m0-9.6-2.2 2.2m-5.2 5.2-2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    window: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="3.5" y="4.3" width="13" height="11.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
        <path d="M3.5 8h13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    qr: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="3.4" y="3.4" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
        <rect x="12.1" y="3.4" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
        <rect x="3.4" y="12.1" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
        <path d="M12.2 12.2h1.8v1.8h-1.8Zm3.2 0h1.2v4.4h-4.4v-1.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
      </svg>
    `,
    link: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M8.7 11.3a3.4 3.4 0 0 0 4.8 0l1.9-1.9a3.4 3.4 0 0 0-4.8-4.8l-1.1 1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
        <path d="M11.3 8.7a3.4 3.4 0 0 0-4.8 0l-1.9 1.9a3.4 3.4 0 0 0 4.8 4.8l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    clock: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="6.7" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M10 6.4v4l2.6 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    download: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 3.2v8.5m0 0 3-3m-3 3-3-3M4.4 15.9h11.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    arrowUp: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 16V4m0 0 4 4m-4-4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    arrowDown: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 4v12m0 0 4-4m-4 4-4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    chevronDown: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    frontdesk: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="4.2" y="4.5" width="11.6" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
        <path d="M7.2 8.2h5.6M7.2 11.1h5.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    outcomes: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M4.5 14.8V9.4m5 5.4V5.8m5 9V7.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
        <path d="m3.8 15.1 3.7-3.7 2.5 1.8 4.3-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    inbox: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M4.1 5.5h11.8a1.1 1.1 0 0 1 1.1 1.1v6.8a1.1 1.1 0 0 1-1.1 1.1H4.1A1.1 1.1 0 0 1 3 13.4V6.6a1.1 1.1 0 0 1 1.1-1.1Z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
        <path d="m4.2 7 5.1 4 1.4.1 5.1-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    calendar: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="3.5" y="4.4" width="13" height="12.1" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
        <path d="M6.4 3.4v2.2m7.2-2.2v2.2M3.5 8.2h13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    automations: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M10 3.2v2.1m0 9.4v2.1M3.2 10h2.1m9.4 0h2.1M5.2 5.2l1.5 1.5m6.6 6.6 1.5 1.5m0-9.6-1.5 1.5m-6.6 6.6-1.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    install: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 3.8v7.1m0 0 2.5-2.5M10 10.9 7.5 8.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M4.4 13.1v1.6a1.9 1.9 0 0 0 1.9 1.9h7.4a1.9 1.9 0 0 0 1.9-1.9v-1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    settings: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M10 3.5v1.8m0 9.4v1.8M3.5 10h1.8m9.4 0h1.8M5.5 5.5l1.3 1.3m6.4 6.4 1.3 1.3m0-9-1.3 1.3m-6.4 6.4-1.3 1.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    bell: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M6.1 8.2a3.9 3.9 0 1 1 7.8 0v2.1c0 .9.3 1.7.9 2.3l.4.4H4.8l.4-.4c.6-.6.9-1.4.9-2.3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
        <path d="M8.4 14.1a1.8 1.8 0 0 0 3.2 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    user: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M4.8 15.6c.9-2.7 2.7-4.1 5.2-4.1s4.3 1.4 5.2 4.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    search: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="8.7" cy="8.7" r="4.7" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="m12.2 12.2 3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    sync: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M4.7 8.1A5.8 5.8 0 0 1 14 5.2M15.3 11.9A5.8 5.8 0 0 1 6 14.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
        <path d="m13.6 3.9.7 1.9 1.8-.7M6.4 16.1l-.7-1.9-1.8.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    plus: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
      </svg>
    `,
    mail: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="4" y="5.2" width="12" height="9.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
        <path d="m4.4 6 5.2 4 1 .1 5-4.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    check: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="m5.5 10.2 2.7 2.7 6.3-6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    review: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="4.2" y="4.2" width="11.6" height="11.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
        <path d="M7.2 8h5.6M7.2 10.3h5.6M7.2 12.6h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `,
    phone: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M6.2 4.4c.4-.4.9-.4 1.3 0l1.2 1.2c.4.4.4.9.1 1.3l-.9 1.1c1 1.8 2.4 3.2 4.2 4.2l1.1-.9c.4-.3 1-.3 1.3.1l1.2 1.2c.4.4.4 1 0 1.3l-1 1c-.7.7-1.7 1-2.7.7C7.8 15.5 4.5 12.2 3.5 8.1c-.2-1 .1-2 .7-2.7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
      </svg>
    `,
    ticket: `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M5 6.2h10a1 1 0 0 1 1 1v1.3a1.8 1.8 0 0 0 0 3V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1.2a1.8 1.8 0 0 0 0-3V7.2a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
        <path d="M10 6.4v7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.6 1.6" stroke-linecap="round"></path>
      </svg>
    `,
  };

  return icons[icon] || icons.review;
}

function getShellNavIconMarkup(sectionKey = "") {
  const iconMap = {
    overview: "home",
    contacts: "users",
    knowledge_improvement: "review",
    customize: "frontdesk",
    analytics: "outcomes",
    inbox: "inbox",
    calendar: "calendar",
    automations: "automations",
    install: "install",
    settings: "settings",
  };

  return getUiIconMarkup(iconMap[sectionKey] || "review");
}

function buildShellNavButton(item, activeSection) {
  const targetSection = item.target || item.key;
  const isActive = activeSection === (item.activeKey || item.key);

  return `
    <button
      class="shell-nav-button ${isActive ? "active" : ""}"
      type="button"
      data-shell-target="${escapeHtml(targetSection)}"
      ${item.targetId ? `data-target-id="${escapeHtml(item.targetId)}"` : ""}
      ${item.settingsTarget ? `data-settings-target="${escapeHtml(item.settingsTarget)}"` : ""}
      aria-current="${isActive ? "page" : "false"}"
    >
      <span class="shell-nav-icon" aria-hidden="true">${getShellNavIconMarkup(item.key)}</span>
      <span class="shell-nav-label-row">
        <span class="shell-nav-label">${escapeHtml(translateDashboardText(item.label))}</span>
        ${item.tag ? `<span class="pill shell-nav-tag">${escapeHtml(translateDashboardText(item.tag))}</span>` : ""}
        ${item.badge ? `<span class="${getBadgeClass(item.badgeTone || "Pending")}">${escapeHtml(translateDashboardText(item.badge))}</span>` : ""}
      </span>
      ${item.note ? `<span class="shell-nav-note">${escapeHtml(translateDashboardText(item.note))}</span>` : ""}
    </button>
  `;
}

function buildSidebarGroup(title, items, activeSection, options = {}) {
  if (!items.length && !options.note) {
    return "";
  }

  return `
    <section class="shell-sidebar-group">
      <p class="shell-sidebar-label">${escapeHtml(translateDashboardText(title))}</p>
      ${options.note ? `<p class="shell-sidebar-note">${escapeHtml(translateDashboardText(options.note))}</p>` : ""}
      <div class="shell-sidebar-list">
        ${items.map((item) => buildShellNavButton(item, activeSection)).join("")}
      </div>
    </section>
  `;
}

function buildDashboardProductSwitcher(activeProduct = activeDashboardProduct) {
  const activeKey = activeProduct?.key || "front_desk";

  return `
    <nav class="dashboard-product-switcher" aria-label="Dashboard products" data-dashboard-product-nav>
      ${dashboardProductNavItems.map((item) => {
        const isActive = item.active || item.key === activeKey;
        return `
          <a
            class="dashboard-product-link ${isActive ? "active" : ""}"
            href="${escapeHtml(item.routePath)}"
            data-dashboard-product-link
            data-dashboard-product-key="${escapeHtml(item.key)}"
            data-dashboard-product-active="${isActive ? "true" : "false"}"
            aria-current="${isActive ? "page" : "false"}"
          >
            <span>${escapeHtml(translateDashboardText(item.label))}</span>
          </a>
        `;
      }).join("")}
    </nav>
  `;
}

function buildSidebarShell(
  agent,
  setup,
  actionQueue = createEmptyActionQueue(),
  operatorWorkspace = createEmptyOperatorWorkspace(),
  activeSection = "overview"
) {
  const availableSections = getAvailableShellSections(operatorWorkspace);
  const installStatus = getDefaultInstallStatus(agent);
  const accountLabel = authUser?.email || agent.ownerEmail || agent.contactEmail || agent.email || "";
  const accountInitials = trimText(accountLabel)
    ? trimText(accountLabel).slice(0, 2).toUpperCase()
    : "V";
  const todayAttention = Number(actionQueue.summary?.attentionNeeded || 0);
  const contactsAttention = Number(operatorWorkspace.contacts?.summary?.contactsNeedingAttention || 0);
  const humanFollowUpOpen = Number(actionQueue.humanFollowUps?.summary?.open || 0);
  const notificationUnread = Number(actionQueue.ownerNotifications?.summary?.unread || 0);
  const workspaceStatus = setup.isReady ? "Ready to use" : "Getting started";
  const knowledgeStatus = setup.knowledgeReady
    ? "Website learned"
    : setup.knowledgeLimited
      ? "Website learning"
      : "Add website details";
  const productHomeContext = typeof dashboardState.getDashboardProductHomeContext === "function"
    ? dashboardState.getDashboardProductHomeContext(activeDashboardProduct.key)
    : null;
  const coreItems = [
    {
      key: "overview",
      label: t("nav.home"),
      note: "Operator command center",
      badge: todayAttention > 0 ? String(todayAttention) : "",
      badgeTone: todayAttention > 0 ? "Needs attention" : "Pending",
    },
    {
      key: "customize",
      label: t("nav.frontDesk"),
      note: "Primary customer page",
    },
    {
      key: "contacts",
      label: t("nav.customers"),
      note: "People and follow-ups",
      badge: Math.max(contactsAttention, humanFollowUpOpen) > 0 ? String(Math.max(contactsAttention, humanFollowUpOpen)) : "",
      badgeTone: Math.max(contactsAttention, humanFollowUpOpen) > 0 ? "Needs attention" : "Pending",
    },
    {
      key: "analytics",
      label: t("nav.analytics"),
      note: "Signals and outcomes",
      badge: notificationUnread > 0 ? String(notificationUnread) : "",
      badgeTone: notificationUnread > 0 ? "Needs attention" : "Pending",
    },
  ].filter((item) => availableSections.includes(item.target || item.key));

  const utilityItems = [
    {
      key: "install",
      label: t("nav.install"),
      note: "Page links, QR, optional widget",
    },
    {
      key: "settings",
      label: t("nav.settings"),
      note: "Workspace, privacy, billing",
    },
  ].filter((item) => availableSections.includes(item.key));

  return `
    <aside class="sidebar-shell" aria-label="${escapeHtml(translateDashboardText("Dashboard sidebar"))}">
      <div class="sidebar-identity">
        <div class="sidebar-identity-mark">V</div>
        <div class="sidebar-identity-copy">
          <p class="sidebar-eyebrow">${escapeHtml(translateDashboardText(activeDashboardProduct.dashboardLabel || "AI Front Desk workspace"))}</p>
          <h2 class="sidebar-title">Vonza</h2>
          <p class="sidebar-copy">${escapeHtml(agent.assistantName || agent.name || agent.websiteUrl || translateDashboardText("Add your website to personalize the Front Desk"))}</p>
        </div>
      </div>
      ${buildDashboardProductSwitcher(activeDashboardProduct)}
      ${buildSidebarGroup(translateDashboardText("Operate"), coreItems, activeSection, {
        note: productHomeContext?.sidebarNote || "Front Desk is the primary full-page customer surface.",
      })}
      <div class="sidebar-footer">
        <div class="sidebar-status-dock">
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">${escapeHtml(translateDashboardText("Workspace"))}</span>
            <strong>${escapeHtml(translateDashboardText(workspaceStatus))}</strong>
          </div>
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">${escapeHtml(translateDashboardText("Knowledge"))}</span>
            <strong>${escapeHtml(translateDashboardText(knowledgeStatus))}</strong>
          </div>
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">${escapeHtml(translateDashboardText("Install"))}</span>
            <strong>${escapeHtml(translateDashboardText(installStatus.label || t("common.notInstalled")))}</strong>
          </div>
        </div>
        ${buildSidebarGroup(translateDashboardText("Setup"), utilityItems, activeSection)}
        <div class="sidebar-user-card">
          <span class="sidebar-user-avatar" aria-hidden="true">${escapeHtml(accountInitials)}</span>
          <span class="sidebar-user-copy">
            <strong>${escapeHtml(agent.ownerName || agent.businessName || agent.name || "Vonza workspace")}</strong>
            <small>${escapeHtml(accountLabel || agent.websiteUrl || "Workspace owner")}</small>
          </span>
          <span class="sidebar-user-chevron" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
        </div>
      </div>
    </aside>
  `;
}

function formatDateTimeLocalValue(value) {
  return dashboardLabels.formatDateTimeLocalValue(value);
}

function formatOperatorCount(value, singular, plural = `${singular}s`) {
  const count = Number(value || 0);
  return formatDashboardCountLabel(count, singular, plural, getDashboardHungarianCountUnit(singular));
}

function buildStatusPill({
  label = "",
  tone = "neutral",
  icon = "",
} = {}) {
  return `
    <span class="status-pill status-pill--${escapeHtml(tone)}">
      ${icon ? `<span class="status-pill-icon" aria-hidden="true">${buildV2Icon(icon)}</span>` : `<span class="status-pill-dot" aria-hidden="true"></span>`}
      <span>${escapeHtml(translateDashboardText(label))}</span>
    </span>
  `;
}

function buildMetricTile({
  label = "",
  value = "",
  note = "",
  icon = "review",
  tone = "violet",
} = {}) {
  return `
    <article class="metric-tile metric-tile--${escapeHtml(tone)}">
      <span class="metric-tile-icon" aria-hidden="true">${buildV2Icon(icon)}</span>
      <span class="metric-tile-copy">
        <span>${escapeHtml(translateDashboardText(label))}</span>
        <strong>${escapeHtml(String(value || "0"))}</strong>
        ${note ? `<small>${escapeHtml(translateDashboardText(note))}</small>` : ""}
      </span>
    </article>
  `;
}

function buildProgressRing({
  percent = 0,
  label = "",
} = {}) {
  const normalizedPercent = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));

  return `
    <div class="progress-ring" style="--progress:${normalizedPercent}" role="img" aria-label="${escapeHtml(label || `${normalizedPercent}% complete`)}">
      <span>${escapeHtml(`${normalizedPercent}%`)}</span>
    </div>
  `;
}

function buildQuickActionTile({
  label = "",
  icon = "review",
  target = "",
  filter = "",
  targetId = "",
  href = "",
  disabled = false,
  shellTarget = "",
  settingsTarget = "",
  installMethod = "",
} = {}) {
  const iconMarkup = `<span class="quick-action-tile-icon" aria-hidden="true">${buildV2Icon(icon)}</span>`;
  const labelMarkup = `<span>${escapeHtml(translateDashboardText(label))}</span>`;

  if (href) {
    return `
      <a class="quick-action-tile ${disabled ? "disabled" : ""}" data-action="open-preview" href="${disabled ? "#" : escapeHtml(href)}" target="_blank" rel="noreferrer" ${disabled ? 'aria-disabled="true"' : ""}>
        ${iconMarkup}
        ${labelMarkup}
      </a>
    `;
  }

  if (shellTarget) {
    return `
      <button
        class="quick-action-tile"
        type="button"
        data-shell-target="${escapeHtml(shellTarget)}"
        ${settingsTarget ? `data-settings-target="${escapeHtml(settingsTarget)}"` : ""}
        ${installMethod ? `data-install-method-jump="${escapeHtml(installMethod)}"` : ""}
        ${disabled ? "disabled" : ""}
      >
        ${iconMarkup}
        ${labelMarkup}
      </button>
    `;
  }

  return `
    <button
      class="quick-action-tile"
      type="button"
      ${target ? `data-overview-target="${escapeHtml(target)}"` : ""}
      ${filter ? `data-contact-filter="${escapeHtml(filter)}"` : ""}
      ${targetId ? `data-target-id="${escapeHtml(targetId)}"` : ""}
      ${disabled ? "disabled" : ""}
    >
      ${iconMarkup}
      ${labelMarkup}
    </button>
  `;
}

function buildActivityItem({
  title = "",
  copy = "",
  meta = "",
  icon = "chat",
  tone = "blue",
} = {}) {
  return `
    <article class="activity-item">
      <span class="activity-item-icon activity-item-icon--${escapeHtml(tone)}" aria-hidden="true">${buildV2Icon(icon)}</span>
      <span class="activity-item-copy">
        <strong>${escapeHtml(translateDashboardText(title))}</strong>
        ${copy ? `<small>${escapeHtml(copy)}</small>` : ""}
      </span>
      ${meta ? `<span class="activity-item-meta">${escapeHtml(translateDashboardText(meta))}</span>` : ""}
    </article>
  `;
}

function buildAssistantPreviewCard({
  assistantName = "",
  greeting = "",
  prompts = [],
  statusLabel = "",
  live = false,
} = {}) {
  const visiblePrompts = prompts.map((prompt) => trimText(prompt)).filter(Boolean).slice(0, 3);

  return `
    <article class="glass-card assistant-preview-card">
      <div class="glass-card-header">
        <div>
          <h2 class="glass-card-title">Assistant preview</h2>
          <p class="glass-card-copy">Current Front Desk greeting and starter prompts.</p>
        </div>
        ${buildStatusPill({ label: statusLabel || (live ? "Live" : "Ready to test"), tone: live ? "online" : "neutral" })}
      </div>
      <div class="assistant-preview-surface">
        <div class="assistant-preview-message">
          <span class="assistant-preview-avatar" aria-hidden="true">${escapeHtml((assistantName || "V").slice(0, 1).toUpperCase())}</span>
          <div>
            <strong>${escapeHtml(assistantName || "Vonza Front Desk")}</strong>
            <p>${escapeHtml(greeting || "Your front desk is ready to greet visitors with a clear, helpful first message.")}</p>
          </div>
        </div>
        ${visiblePrompts.length ? `
          <div class="assistant-preview-prompts" aria-label="${escapeHtml(translateDashboardText("Suggested questions"))}">
            ${visiblePrompts.map((prompt) => `<span>${escapeHtml(prompt)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      <div class="assistant-preview-listening" aria-hidden="true">
        <span>${buildV2Icon("sparkle")}</span>
        <strong>Listening...</strong>
        <i></i><i></i><i></i>
      </div>
    </article>
  `;
}

function _buildOperatorNextActionButton(nextAction = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const actionType = trimText(nextAction.actionType || "stay_put");
  const label = normalizeShellCopy(nextAction.buttonLabel || nextAction.title || "Open Home");
  const disabled = nextAction.disabled === true;

  if (actionType === "connect_google") {
    return `<button class="ghost-button" type="button" disabled>${escapeHtml(label || "Beta")}</button>`;
  }

  if (actionType === "run_first_sync") {
    return `<button class="primary-button" type="button" data-refresh-operator data-force-sync="true" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
  }

  if (actionType === "review_context") {
    return `<button class="primary-button" type="button" data-shell-target="overview">${escapeHtml(label)}</button>`;
  }

  const resolvedTarget = resolveVisibleShellTarget(
    nextAction.targetSection || "overview",
    nextAction.targetId || "",
    operatorWorkspace,
    {
      label,
      actionKey: nextAction.actionKey,
      contactId: nextAction.contactId || nextAction.relatedContactId,
      analyticsFallbackLabel: "Open Analytics",
      contactFallbackLabel: "Open customer",
      defaultLabel: label,
    }
  );

  if (!resolvedTarget) {
    return "";
  }

  return `
    <button
      class="ghost-button"
      type="button"
      data-shell-target="${escapeHtml(resolvedTarget.section)}"
      data-target-id="${escapeHtml(resolvedTarget.id || "")}"
    >${escapeHtml(resolvedTarget.label || label)}</button>
  `;
}

function _buildOperatorChecklistMarkup(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const activation = operatorWorkspace.activation || createEmptyOperatorWorkspace().activation;
  const checklist = activation.checklist || [];
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);
  const selectedMailbox = trimText(
    operatorWorkspace.connectedAccounts?.[0]?.selectedMailbox
    || activation.metadata?.selectedMailbox
    || "INBOX"
  );

  if (!checklist.length) {
    return "";
  }

  return `
    <section class="workspace-card-soft operator-checklist-card">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Getting started</p>
          <h3 class="studio-group-title">A quick checklist to make Home more useful.</h3>
          <p class="workspace-panel-copy">${escapeHtml(`${activation.completedCount || 0} of ${activation.totalCount || checklist.length} steps completed. Your progress is saved here.`)}</p>
        </div>
        <span class="${getBadgeClass(activation.isComplete ? "Ready" : "Limited")}">${activation.isComplete ? "All set" : "In progress"}</span>
      </div>
      <div class="operator-checklist-list">
        ${checklist.map((step) => `
          <article class="operator-checklist-item ${step.complete ? "complete" : ""}">
            <div class="operator-checklist-copy">
              <p class="operator-checklist-title">${escapeHtml(step.title)}</p>
              <p class="operator-checklist-note">${escapeHtml(step.description)}</p>
            </div>
            <span class="${getBadgeClass(step.complete ? "Ready" : "Limited")}">${step.complete ? "Done" : "Next"}</span>
          </article>
        `).join("")}
      </div>
      ${operatorWorkspace.status?.googleConnected ? `
        <form class="operator-context-form" data-operator-context-form>
          <input type="hidden" name="selected_mailbox" value="${escapeHtml(selectedMailbox)}">
          <div class="form-grid">
            <div class="field">
              <label for="operator-calendar-context">Calendar context</label>
              <input id="operator-calendar-context" type="text" value="Primary calendar" disabled>
              <p class="field-help">${escapeHtml(googleCapabilities.calendarRead
                ? "Vonza uses your primary Google Calendar to bring schedule context, recent appointments, and follow-up suggestions into Home."
                : "Calendar context is beta and is not ready to use from the dashboard yet.")}</p>
            </div>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="submit">Save calendar context</button>
            <button class="ghost-button" type="button" data-complete-operator-step="calendar_review">Mark calendar checked</button>
          </div>
        </form>
      ` : ""}
    </section>
  `;
}

function buildOperatorEmptyState({ title, copy, actionMarkup = "" } = {}) {
  return `
    <div class="operator-empty-state">
      <p class="operator-empty-title">${escapeHtml(translateDashboardText(title || "Nothing here yet"))}</p>
      <p class="operator-empty-copy">${escapeHtml(translateDashboardText(copy || "Vonza will fill this area as soon as there is something useful to show."))}</p>
      ${actionMarkup ? `<div class="inline-actions">${actionMarkup}</div>` : ""}
    </div>
  `;
}

function buildRowActionMenu(label = "Actions", contentMarkup = "") {
  if (!trimText(contentMarkup)) {
    return "";
  }

  return `
    <details class="row-action-menu">
      <summary class="row-action-menu-trigger">${escapeHtml(translateDashboardText(label))}</summary>
      <div class="row-action-menu-panel">
        ${contentMarkup}
      </div>
    </details>
  `;
}

function formatContactLifecycleLabel(value = "") {
  return translateDashboardText(dashboardLabels.formatContactLifecycleLabel(value));
}

function buildContactSources(contact = {}) {
  if (Array.isArray(contact.sources) && contact.sources.length) {
    return contact.sources;
  }

  return [
    trimText(contact.source),
    trimText(contact.captureSource || contact.capture_source),
    trimText(contact.sourceType || contact.source_type),
  ].filter(Boolean);
}

function getCustomerSourceLabel(source = "") {
  return dashboardLabels.getCustomerSourceLabel(source);
}

function getCustomerSourceLabels(contact = {}) {
  return [
    ...new Set(
      buildContactSources(contact)
        .map(getCustomerSourceLabel)
        .filter(Boolean)
    ),
  ];
}

// eslint-disable-next-line no-unused-vars
function buildCustomerSourceBadgeMarkup(contact = {}, limit = 2) {
  const labels = getCustomerSourceLabels(contact);
  const visibleLabels = labels.length ? labels.slice(0, limit) : ["Legacy/unknown"];

  return visibleLabels.map((label) => `
    <span class="customer-source-chip">${escapeHtml(translateDashboardText(label))}</span>
  `).join("");
}

function buildContactFlags(contact = {}) {
  return Array.isArray(contact.flags) ? contact.flags : [];
}

function getRecommendedCampaignGoal(contact = {}) {
  if (trimText(contact.lifecycleState) === "customer") {
    return "review_request";
  }

  if (buildContactFlags(contact).includes("complaint")) {
    return "complaint_recovery";
  }

  return "quote_follow_up";
}

function buildContactIdentifierParts(contact = {}) {
  return [
    trimText(contact.bestIdentifier),
    trimText(contact.email),
    trimText(contact.phone),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
}

function _buildContactPrimaryIdentifier(contact = {}) {
  return buildContactIdentifierParts(contact)[0] || "No direct identifier yet";
}

function _buildContactIdentitySummary(contact = {}) {
  const identifiers = buildContactIdentifierParts(contact);
  return identifiers.join(" · ") || "No direct identifier yet";
}

function buildContactLatestActivitySummary(contact = {}) {
  if (contact.mostRecentActivityAt) {
    return `Latest activity ${formatSeenAt(contact.mostRecentActivityAt)}`;
  }

  if (contact.latestOutcome?.occurredAt) {
    return `Latest result ${formatSeenAt(contact.latestOutcome.occurredAt)}`;
  }

  return "";
}

function _buildContactCurrentStateTitle(contact = {}) {
  if (buildContactFlags(contact).includes("complaint")) {
    return "Needs careful follow-up";
  }

  if (contact.partialIdentity) {
    return "Still matching this person";
  }

  if (contact.nextAction?.title) {
    return "Waiting on the next step";
  }

  if (contact.latestOutcome?.label) {
    return contact.latestOutcome.label;
  }

  if (contact.mostRecentActivityAt) {
    return `Active ${formatSeenAt(contact.mostRecentActivityAt)}`;
  }

  return "No urgent work right now";
}

function _buildContactCurrentStateCopy(contact = {}) {
  if (buildContactFlags(contact).includes("complaint")) {
    return "A support issue or complaint is still part of this relationship, so the next reply should stay measured and clear.";
  }

  if (contact.partialIdentity) {
    return "Vonza is still stitching together activity from partial contact details, so deeper history may keep filling in.";
  }

  if (contact.latestOutcome?.label) {
    return buildContactLatestResultCopy(contact);
  }

  if (contact.mostRecentActivityAt) {
    return `${buildContactLatestActivitySummary(contact)}. This person still needs a clear next step.`;
  }

  if (contact.nextAction?.description) {
    return contact.nextAction.description;
  }

  return "Nothing urgent is standing out yet, but the full record is still here when you need it.";
}

function buildContactLatestResultCopy(contact = {}) {
  return [
    trimText(contact.latestOutcome?.sourceLabel),
    trimText(contact.latestOutcome?.contextLabel),
    contact.latestOutcome?.occurredAt ? formatSeenAt(contact.latestOutcome.occurredAt) : "",
  ].filter(Boolean).join(" · ") || "No recorded result yet.";
}

function _buildContactActionMarkup(label = "", attributes = {}, className = "ghost-button") {
  const attributeMarkup = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== "")
    .map(([key, value]) => value === true ? key : `${key}="${escapeHtml(String(value))}"`)
    .join(" ");

  return `
    <button class="${escapeHtml(className)}" type="button"${attributeMarkup ? ` ${attributeMarkup}` : ""}>
      ${escapeHtml(label)}
    </button>
  `;
}

const dashboardCustomerHelpers = typeof dashboardCustomers.createCustomerHelpers === "function"
  ? dashboardCustomers.createCustomerHelpers({
    trimText,
    escapeHtml,
    t,
    translateDashboardText,
    localizeDashboardCopy,
    formatSeenAt,
    formatAnalyticsReportNumber,
    formatDashboardCountLabel,
    formatOperatorCount,
    getUiIconMarkup,
    createEmptyOperatorWorkspace,
    isCapabilityVisibleForWorkspace,
    isCapabilityExplicitlyVisible,
    buildDisclosureBlock,
    buildDisclosureDetailRows,
    buildOperatorEmptyState,
    buildPageHeader,
    buildPageToolbar,
    formatContactLifecycleLabel,
    buildContactFlags,
    buildContactSources,
    getCustomerSourceLabel,
    getRecommendedCampaignGoal,
  })
  : {};

function callCustomerHelper(name, args) {
  const helper = dashboardCustomerHelpers[name];
  if (typeof helper !== "function") {
    throw new Error(`Dashboard Customers helper missing: ${name}`);
  }
  return helper(...args);
}

/* eslint-disable no-unused-vars -- Customers helpers stay exposed for dashboard VM tests and legacy call sites. */
function contactNeedsReply(...args) {
  return callCustomerHelper("contactNeedsReply", args);
}

function customerHasContactDetails(...args) {
  return callCustomerHelper("customerHasContactDetails", args);
}

function customerHasActiveReplyableChat(...args) {
  return callCustomerHelper("customerHasActiveReplyableChat", args);
}

function customerHasReplyableChannel(...args) {
  return callCustomerHelper("customerHasReplyableChannel", args);
}

function customerNeedsOwnerReviewRaw(...args) {
  return callCustomerHelper("customerNeedsOwnerReviewRaw", args);
}

function getCustomerActionState(...args) {
  return callCustomerHelper("getCustomerActionState", args);
}

function customerMissingContactDetails(...args) {
  return callCustomerHelper("customerMissingContactDetails", args);
}

function customerNeedsOwnerReview(...args) {
  return callCustomerHelper("customerNeedsOwnerReview", args);
}

function customerNeedsFollowUp(...args) {
  return callCustomerHelper("customerNeedsFollowUp", args);
}

function isComplaintContact(...args) {
  return callCustomerHelper("isComplaintContact", args);
}

function isLeadContact(...args) {
  return callCustomerHelper("isLeadContact", args);
}

function isResolvedContact(...args) {
  return callCustomerHelper("isResolvedContact", args);
}

function isReturningContact(...args) {
  return callCustomerHelper("isReturningContact", args);
}

function normalizeCustomerLabelForCompare(...args) {
  return callCustomerHelper("normalizeCustomerLabelForCompare", args);
}

function isPlaceholderCustomerLabel(...args) {
  return callCustomerHelper("isPlaceholderCustomerLabel", args);
}

function isLikelyCustomerMessageLabel(...args) {
  return callCustomerHelper("isLikelyCustomerMessageLabel", args);
}

function getValidCustomerLabel(...args) {
  return callCustomerHelper("getValidCustomerLabel", args);
}

function getCustomerEmailLabel(...args) {
  return callCustomerHelper("getCustomerEmailLabel", args);
}

function getNamedCustomerIdentity(...args) {
  return callCustomerHelper("getNamedCustomerIdentity", args);
}

function getCustomerName(...args) {
  return callCustomerHelper("getCustomerName", args);
}

function getCustomerRowIdentifier(...args) {
  return callCustomerHelper("getCustomerRowIdentifier", args);
}

function getCustomerIdentityLabel(...args) {
  return callCustomerHelper("getCustomerIdentityLabel", args);
}

function getCustomerIdentifier(...args) {
  return callCustomerHelper("getCustomerIdentifier", args);
}

function getCustomerLastMessageAt(...args) {
  return callCustomerHelper("getCustomerLastMessageAt", args);
}

function hasGuestCustomerActivity(...args) {
  return callCustomerHelper("hasGuestCustomerActivity", args);
}

function getCustomerLastActivityLabel(...args) {
  return callCustomerHelper("getCustomerLastActivityLabel", args);
}

function isGuestCustomerRow(...args) {
  return callCustomerHelper("isGuestCustomerRow", args);
}

function getCustomerConversationSourceText(...args) {
  return callCustomerHelper("getCustomerConversationSourceText", args);
}

function getGuestConversationRowSummary(...args) {
  return callCustomerHelper("getGuestConversationRowSummary", args);
}

function getCustomerLatestSummary(...args) {
  return callCustomerHelper("getCustomerLatestSummary", args);
}

function getCustomerSecondaryIdentityLine(...args) {
  return callCustomerHelper("getCustomerSecondaryIdentityLine", args);
}

function getCustomerSituationSummary(...args) {
  return callCustomerHelper("getCustomerSituationSummary", args);
}

function getCustomerRiskSummary(...args) {
  return callCustomerHelper("getCustomerRiskSummary", args);
}

function getCustomerSuggestedAction(...args) {
  return callCustomerHelper("getCustomerSuggestedAction", args);
}

function isGenericCustomerNoActionCopy(...args) {
  return callCustomerHelper("isGenericCustomerNoActionCopy", args);
}

function isGenericCustomerNoActionTitle(...args) {
  return callCustomerHelper("isGenericCustomerNoActionTitle", args);
}

function getCustomerDraftPreview(...args) {
  return callCustomerHelper("getCustomerDraftPreview", args);
}

function getCustomerStatusList(...args) {
  return callCustomerHelper("getCustomerStatusList", args);
}

function getPrimaryCustomerStatus(...args) {
  return callCustomerHelper("getPrimaryCustomerStatus", args);
}

function buildCustomerFilterDefinitions(...args) {
  return callCustomerHelper("buildCustomerFilterDefinitions", args);
}

function buildCustomerSummaryItems(...args) {
  return callCustomerHelper("buildCustomerSummaryItems", args);
}

function getCustomerMetricIcon(...args) {
  return callCustomerHelper("getCustomerMetricIcon", args);
}

function buildCustomerMetricCards(...args) {
  return callCustomerHelper("buildCustomerMetricCards", args);
}

function getContactFirstSeenAt(...args) {
  return callCustomerHelper("getContactFirstSeenAt", args);
}

function getCustomerIntentLabel(...args) {
  return callCustomerHelper("getCustomerIntentLabel", args);
}

function getCustomerDetailMetaRows(...args) {
  return callCustomerHelper("getCustomerDetailMetaRows", args);
}

function buildCustomerInitials(...args) {
  return callCustomerHelper("buildCustomerInitials", args);
}

function buildContactQuickActions(...args) {
  return callCustomerHelper("buildContactQuickActions", args);
}

function buildContactsAttentionStrip(...args) {
  return callCustomerHelper("buildContactsAttentionStrip", args);
}

function buildContactSourceSummary(...args) {
  return callCustomerHelper("buildContactSourceSummary", args);
}

function buildContactCountsSummary(...args) {
  return callCustomerHelper("buildContactCountsSummary", args);
}

function getCustomerChatUnavailableReason(...args) {
  return callCustomerHelper("getCustomerChatUnavailableReason", args);
}

function buildCustomerChatPanel(...args) {
  return callCustomerHelper("buildCustomerChatPanel", args);
}

function buildContactRow(...args) {
  return callCustomerHelper("buildContactRow", args);
}

function buildContactDetailPanel(...args) {
  return callCustomerHelper("buildContactDetailPanel", args);
}

function _buildCustomerStatusMarkup(...args) {
  return callCustomerHelper("buildCustomerStatusMarkup", args);
}
/* eslint-enable no-unused-vars */

// eslint-disable-next-line no-unused-vars
function buildWorkspaceRecordRow({
  kind = "",
  id = "",
  title = "",
  meta = "",
  copy = "",
  badge = "",
  badgeTone = "Pending",
  icon = "review",
  selected = false,
} = {}) {
  return `
    <button
      class="workspace-record-row ${selected ? "active" : ""}"
      type="button"
      data-record-row
      data-record-kind="${escapeHtml(kind)}"
      data-record-id="${escapeHtml(id)}"
    >
      <span class="workspace-record-row-icon" aria-hidden="true">${getUiIconMarkup(icon)}</span>
      <span class="workspace-record-row-main">
        <span class="workspace-record-row-top">
          <strong class="workspace-record-row-title">${escapeHtml(title || "Record")}</strong>
          ${badge ? `<span class="${getBadgeClass(badgeTone)}">${escapeHtml(badge)}</span>` : ""}
        </span>
        ${meta ? `<span class="workspace-record-row-meta">${escapeHtml(meta)}</span>` : ""}
        ${copy ? `<span class="workspace-record-row-copy">${escapeHtml(copy)}</span>` : ""}
      </span>
    </button>
  `;
}

function buildContactsPanel(...args) {
  return callCustomerHelper("buildContactsPanel", args);
}

function buildCopilotSummaryCards(copilot = createEmptyOperatorWorkspace().copilot) {
  const summaryCards = Array.isArray(copilot.summaryCards) ? copilot.summaryCards : [];

  if (!summaryCards.length) {
    return "";
  }

  return `
    <section class="workspace-card-soft" style="margin-top:16px;">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Summary</p>
          <h3 class="workspace-panel-title">Operational summary</h3>
          <p class="workspace-panel-copy">This is the stable-core readout for today: what matters, which leads need attention, and whether complaints, pricing gaps, or outcomes need review.</p>
        </div>
      </div>
      <div class="overview-grid operator-metric-grid">
      ${summaryCards.map((card) => `
        <div class="overview-card">
          <p class="overview-label">${escapeHtml(card.label || "Summary")}</p>
          <p class="overview-card-copy">${escapeHtml(card.text || "Vonza is waiting for more stable-core context.")}</p>
          ${buildDisclosureBlock({
            label: "View details",
            summary: card.confidence ? `Confidence ${card.confidence}` : "",
            className: "disclosure-block-inline",
            contentMarkup: buildDisclosureDetailRows([
              { label: "Confidence", value: card.confidence || "Not scored" },
              { label: "Reasoning", value: card.rationale || "Vonza is waiting for more stable-core context." },
            ]),
          })}
        </div>
      `).join("")}
      </div>
    </section>
  `;
}

function buildCopilotProposalList(
  copilot = createEmptyOperatorWorkspace().copilot,
  operatorWorkspace = createEmptyOperatorWorkspace(),
) {
  const proposals = Array.isArray(copilot.proposals) ? copilot.proposals : [];
  const summary = copilot.proposalSummary || createEmptyOperatorWorkspace().copilot.proposalSummary;

  if (!proposals.length) {
    if ((summary.hiddenCount || 0) === 0) {
      return "";
    }

    return `
      <section class="workspace-card-soft" style="margin-top:16px;">
        <div class="workspace-panel-header">
          <div>
            <p class="studio-kicker">Proposals</p>
            <h3 class="workspace-panel-title">Approval-first proposals</h3>
            <p class="workspace-panel-copy">There are no active suggestions right now because the current ones were already handled or dismissed.</p>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="workspace-card-soft" style="margin-top:16px;">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Proposals</p>
          <h3 class="workspace-panel-title">Approval-first proposals</h3>
          <p class="workspace-panel-copy">Each proposal explains what Vonza recommends, why it matters, what will happen if you apply it, and where the real workflow object will land.</p>
        </div>
        <div class="workspace-badge-row">
          <span class="${getBadgeClass(summary.blockedCount ? "Needs attention" : "Ready")}">${escapeHtml(`${summary.activeCount || proposals.length} active`)}</span>
          ${summary.blockedCount ? `<span class="${getBadgeClass("Needs attention")}">${escapeHtml(`${summary.blockedCount} blocked`)}</span>` : ""}
        </div>
      </div>
      <div class="analytics-list">
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
          const proposalDetailMarkup = [
            proposal.type ? `Type: ${proposal.type.replaceAll("_", " ")}` : "",
            proposal.priority ? `Priority: ${proposal.priority}` : "",
            proposal.confidence ? `Confidence: ${proposal.confidence}` : "",
          ].filter(Boolean).join(" · ");

          return `
          <div class="analytics-item">
            <div class="workspace-panel-header" style="gap:12px; align-items:flex-start;">
              <div>
                <p class="analytics-item-title">${escapeHtml(normalizeShellCopy(proposal.title || "Suggestion"))}</p>
                <p class="analytics-item-copy">${escapeHtml(normalizeShellCopy(proposal.summary || "Vonza prepared an approval-first proposal from stable-core data."))}</p>
              </div>
              <span class="${getBadgeClass(
                proposal.state === "blocked"
                  ? "Needs attention"
                  : proposal.state === "stale"
                    ? "Limited"
                  : "Ready"
              )}">${escapeHtml((proposal.state || "new").replaceAll("_", " "))}</span>
            </div>
            <div class="inline-actions" style="margin-top:12px;">
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
              summary: proposalDetailMarkup,
              className: "disclosure-block-inline",
              contentMarkup: `
                ${buildDisclosureDetailRows([
                  { label: "Why it matters", value: proposal.why ? normalizeShellCopy(proposal.why) : "No extra rationale stored." },
                  { label: "If applied", value: proposal.whatHappens ? normalizeShellCopy(proposal.whatHappens) : "This proposal will route into the live workflow object after review." },
                  { label: "Target", value: resolvedTarget?.label || resolvedTarget?.section || "Existing workflow" },
                  { label: "Approval-first note", value: proposal.approvalNote ? normalizeShellCopy(proposal.approvalNote) : "The owner still reviews this before anything changes." },
                ])}
                ${proposal.stateReason ? `
                  <div class="${proposal.state === "blocked" ? "operator-inline-alert" : "placeholder-card"}" style="margin-top:12px;">
                    <p>${escapeHtml(normalizeShellCopy(proposal.stateReason))}</p>
                  </div>
                ` : ""}
              `,
            })}
          </div>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

const dashboardTodayHelpers = typeof dashboardToday.createTodayHelpers === "function"
  ? dashboardToday.createTodayHelpers({
    trimText,
    escapeHtml,
    translateDashboardText,
    localizeDashboardCopy,
    localizeDashboardHtml,
    createEmptyOperatorWorkspace,
    createEmptyBusinessProfileState,
    createEmptyActionQueue,
    isTodayCopilotFlagEnabled,
    getBadgeClass,
    buildCopilotSummaryCards,
    buildCopilotProposalList,
    resolveVisibleShellTarget,
    normalizeShellCopy,
    buildDisclosureBlock,
    buildDisclosureDetailRows,
    formatOperatorCount,
    formatSeenAt,
    getOutcomeTypeLabel,
    buildContactsAttentionStrip,
    buildOperatorEmptyState,
    getUiIconMarkup,
    getActionQueueStatusLabel,
    getActionQueueStatusBadgeClass,
    normalizeActionQueueStatus,
    getActionQueueOwnerWorkflow,
    getActionQueueOwnerWorkflowBadgeClass,
    getFollowUpStatusLabel,
    getOperatorActionTypeLabel,
    getActionQueueTypeLabel,
    formatActionQueueContact,
    buildRowActionMenu,
    buildActionQueueSummaryPills,
  })
  : {};

function callTodayHelper(name, args) {
  const helper = dashboardTodayHelpers[name];
  if (typeof helper !== "function") {
    throw new Error(`Dashboard Today helper missing: ${name}`);
  }
  return helper(...args);
}

/* eslint-disable no-unused-vars */
function buildTodayCopilotSection(...args) {
  return callTodayHelper("buildTodayCopilotSection", args);
}

function getTodayRecommendationCategory(...args) {
  return callTodayHelper("getTodayRecommendationCategory", args);
}

function getRecommendationSignalText(...args) {
  return callTodayHelper("getRecommendationSignalText", args);
}

function hasRecommendationSignal(...args) {
  return callTodayHelper("hasRecommendationSignal", args);
}

function getBusinessPriorityCopy(...args) {
  return callTodayHelper("getBusinessPriorityCopy", args);
}

function buildTodaySummaryStats(...args) {
  return callTodayHelper("buildTodaySummaryStats", args);
}

function buildTodayProposalSection(...args) {
  return callTodayHelper("buildTodayProposalSection", args);
}

function buildTodayRecommendationsSection(...args) {
  return callTodayHelper("buildTodayRecommendationsSection", args);
}

function formatCalendarInsightContext(...args) {
  return callTodayHelper("formatCalendarInsightContext", args);
}

function buildTodayInsightActionButton(...args) {
  return callTodayHelper("buildTodayInsightActionButton", args);
}

function buildTodayInsightCard(...args) {
  return callTodayHelper("buildTodayInsightCard", args);
}

function buildTodaySupportingDetailSection(...args) {
  return callTodayHelper("buildTodaySupportingDetailSection", args);
}

function buildOperatorOverviewSection(...args) {
  return callTodayHelper("buildOperatorOverviewSection", args);
}

function isAppointmentReviewQueueItem(...args) {
  return callTodayHelper("isAppointmentReviewQueueItem", args);
}

function getOperatorContactDisplayLabel(...args) {
  return callTodayHelper("getOperatorContactDisplayLabel", args);
}

function listAppointmentReviewContacts(...args) {
  return callTodayHelper("listAppointmentReviewContacts", args);
}

function buildAppointmentReviewOutcomeOptions(...args) {
  return callTodayHelper("buildAppointmentReviewOutcomeOptions", args);
}

function buildTodayAppointmentQueueItem(...args) {
  return callTodayHelper("buildTodayAppointmentQueueItem", args);
}

function buildTodayQueueItems(...args) {
  return callTodayHelper("buildTodayQueueItems", args);
}

function getTodayQueueFilterKeys(...args) {
  return callTodayHelper("getTodayQueueFilterKeys", args);
}

function getTodayQueueRowPresentation(...args) {
  return callTodayHelper("getTodayQueueRowPresentation", args);
}

function buildTodayQueuePrimaryAction(...args) {
  return callTodayHelper("buildTodayQueuePrimaryAction", args);
}

function getTodayQueueItemContactLabel(...args) {
  return callTodayHelper("getTodayQueueItemContactLabel", args);
}

function getTodayQueueItemContactId(...args) {
  return callTodayHelper("getTodayQueueItemContactId", args);
}

function getTodayQueueItemLinkState(...args) {
  return callTodayHelper("getTodayQueueItemLinkState", args);
}

function getTodayQueueItemContextLabel(...args) {
  return callTodayHelper("getTodayQueueItemContextLabel", args);
}

function getTodayQueueItemWhyLabel(...args) {
  return callTodayHelper("getTodayQueueItemWhyLabel", args);
}

function getTodayQueueItemCopilotSummary(...args) {
  return callTodayHelper("getTodayQueueItemCopilotSummary", args);
}

function buildTodayQueueRow(...args) {
  return callTodayHelper("buildTodayQueueRow", args);
}

function buildTodayReviewDrawerActions(...args) {
  return callTodayHelper("buildTodayReviewDrawerActions", args);
}

function buildTodayReviewPanel(...args) {
  return callTodayHelper("buildTodayReviewPanel", args);
}

function buildTodayAttentionList(...args) {
  return callTodayHelper("buildTodayAttentionList", args);
}

function buildTodayReviewDrawer(...args) {
  return callTodayHelper("buildTodayReviewDrawer", args);
}

function buildTodayQueueList(...args) {
  return callTodayHelper("buildTodayQueueList", args);
}
/* eslint-enable no-unused-vars */
function buildProductLandingLink(link = {}) {
  const attributes = [
    `class="product-context-link ${link.primary ? "primary" : ""}"`,
    `href="${escapeHtml(link.href || "#")}"`,
  ];

  if (link.shellTarget) {
    attributes.push(`data-shell-target="${escapeHtml(link.shellTarget)}"`);
  }
  if (link.settingsTarget) {
    attributes.push(`data-settings-target="${escapeHtml(link.settingsTarget)}"`);
  }
  if (link.installMethod) {
    attributes.push(`data-install-method-jump="${escapeHtml(link.installMethod)}"`);
  }
  if (link.frontDeskOpen) {
    attributes.push(`data-frontdesk-open="${escapeHtml(link.frontDeskOpen)}"`);
  }

  return `
    <a ${attributes.join(" ")}>
      <span class="product-context-link-icon" aria-hidden="true">${buildV2Icon(link.icon || "review")}</span>
      <span>
        <strong>${escapeHtml(link.label || "Open")}</strong>
        ${link.note ? `<small>${escapeHtml(link.note)}</small>` : ""}
      </span>
    </a>
  `;
}

function getProductReadinessStateLabel(item = {}) {
  if (item.complete === true) {
    return "Ready";
  }
  if (item.complete === false) {
    return "Setup";
  }
  if (item.kind === "info") {
    return "Info";
  }
  return "Action";
}

function buildProductReadinessAction(item = {}) {
  if (!item.href || item.complete === true) {
    return "";
  }

  const attributes = [
    `class="product-readiness-action"`,
    `href="${escapeHtml(item.href || "#")}"`,
  ];

  if (item.shellTarget) {
    attributes.push(`data-shell-target="${escapeHtml(item.shellTarget)}"`);
  }
  if (item.settingsTarget) {
    attributes.push(`data-settings-target="${escapeHtml(item.settingsTarget)}"`);
  }
  if (item.installMethod) {
    attributes.push(`data-install-method-jump="${escapeHtml(item.installMethod)}"`);
  }
  if (item.frontDeskOpen) {
    attributes.push(`data-frontdesk-open="${escapeHtml(item.frontDeskOpen)}"`);
  }

  return `<a ${attributes.join(" ")}>${escapeHtml(item.complete === false ? "Set up" : "Open")}</a>`;
}

function buildProductReadinessCard(product = activeDashboardProduct, snapshot = {}) {
  const getChecklist = dashboardState.getProductReadinessChecklist;
  const checklist = typeof getChecklist === "function"
    ? getChecklist(product?.key || "front_desk", snapshot)
    : [];

  if (!checklist.length) {
    return "";
  }

  const readyCount = checklist.filter((item) => item.complete === true).length;
  const derivedCount = checklist.filter((item) => item.kind === "derived").length;
  const productLabel = product?.label || "Front Desk";

  return `
    <section class="product-readiness-card" data-product-readiness-card="${escapeHtml(product?.key || "front_desk")}">
      <div class="product-readiness-header">
        <div>
          <p class="product-context-eyebrow">${escapeHtml(productLabel)} readiness</p>
          <h3>${escapeHtml(`${readyCount} of ${checklist.length} items ready`)}</h3>
          <p>${escapeHtml(`${derivedCount} items use existing saved workspace state; action items are setup links only.`)}</p>
        </div>
      </div>
      <div class="product-readiness-list">
        ${checklist.map((item) => {
          const stateLabel = getProductReadinessStateLabel(item);
          const stateClass = item.complete === true
            ? "is-ready"
            : item.complete === false
              ? "needs-setup"
              : "is-action";

          return `
            <article
              class="product-readiness-item ${stateClass}"
              data-product-readiness-item
              data-readiness-key="${escapeHtml(item.key)}"
              data-readiness-kind="${escapeHtml(item.kind)}"
              data-readiness-state="${escapeHtml(item.complete === true ? "ready" : item.complete === false ? "setup" : "action")}"
            >
              <span class="product-readiness-icon" aria-hidden="true">${buildV2Icon(item.complete === true ? "check" : item.icon || "review")}</span>
              <span class="product-readiness-copy">
                <strong>${escapeHtml(item.label)}</strong>
                <small>${escapeHtml(item.copy)}</small>
              </span>
              <span class="product-readiness-meta">
                <span class="${getBadgeClass(item.complete === true ? "Ready" : item.complete === false ? "Limited" : "Pending")}">${escapeHtml(stateLabel)}</span>
                ${buildProductReadinessAction(item)}
              </span>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function getProductLandingContext(product = activeDashboardProduct) {
  const homeContext = typeof dashboardState.getDashboardProductHomeContext === "function"
    ? dashboardState.getDashboardProductHomeContext(product?.key || "front_desk")
    : null;
  const label = product?.label || homeContext?.homeTitle || "Front Desk";

  return {
    eyebrow: label,
    title: homeContext?.contextTitle || "Launch the full-page AI Front Desk",
    copy: homeContext?.contextCopy || "Front Desk is the primary customer-facing product. Start in practice, tune the full-page setup, then publish through the existing install flow.",
    links: Array.isArray(homeContext?.shortcuts) ? homeContext.shortcuts : [
      { label: "Practice", note: "Test the current customer experience", href: "#front-desk/practice", shellTarget: "customize", icon: "frontdesk", primary: true },
      { label: "Full-page setup", note: "Open existing Front Desk page settings", href: "#settings/front-desk/full-page-assistant", shellTarget: "settings", settingsTarget: "front_desk", icon: "settings" },
      { label: "Publish page", note: "Share, embed, or QR the hosted page", href: "#install/full-page", shellTarget: "install", installMethod: "full-page", icon: "install" },
    ],
  };
}

function buildProductLandingContext(product = activeDashboardProduct, snapshot = {}) {
  const context = getProductLandingContext(product);
  const sharedLinks = [
    { label: "Contacts and leads", href: "#customers", shellTarget: "contacts", icon: "users" },
    { label: "Conversations", href: "#front-desk/practice", shellTarget: "customize", icon: "chat" },
    { label: "Analytics", href: "#analytics", shellTarget: "analytics", icon: "outcomes" },
    { label: "Business profile", href: "#settings/business-profile", shellTarget: "settings", settingsTarget: "business_profile", icon: "settings" },
    { label: "Knowledge/training", href: "#settings/business-profile", shellTarget: "settings", settingsTarget: "business_profile", icon: "sparkle" },
    { label: "Account/billing", href: "#settings/account-billing", shellTarget: "settings", settingsTarget: "account_billing", icon: "ticket" },
  ];

  return localizeDashboardHtml(`
    <section class="product-context-panel" data-product-context-panel="${escapeHtml(product?.key || "front_desk")}">
      <div class="product-context-copy">
        <p class="product-context-eyebrow">${escapeHtml(context.eyebrow)}</p>
        <h2>${escapeHtml(context.title)}</h2>
        <p>${escapeHtml(context.copy)}</p>
      </div>
      <div class="product-context-link-grid">
        ${context.links.map((link) => buildProductLandingLink(link)).join("")}
      </div>
      ${buildProductReadinessCard(product, snapshot)}
      <div class="product-context-shared">
        <span>Shared workspace</span>
        <div>
          ${sharedLinks.map((link) => buildProductLandingLink(link)).join("")}
        </div>
      </div>
    </section>
  `);
}

function buildOverviewPanel(agent, messages, setup, actionQueue, operatorWorkspace) {
  const overview = buildOverviewState(agent, messages, setup, actionQueue);
  const productHomeContext = typeof dashboardState.getDashboardProductHomeContext === "function"
    ? dashboardState.getDashboardProductHomeContext(activeDashboardProduct.key)
    : {};
  const today = operatorWorkspace.today || createEmptyOperatorWorkspace().today;
  const contactSummary = operatorWorkspace.contacts?.summary || createEmptyOperatorWorkspace().contacts.summary;
  const dedupedQueueItems = (Array.isArray(actionQueue.items) ? actionQueue.items : []).filter((item, index, items) => {
    const key = trimText(item?.key || item?.id || `${item?.type || "item"}-${index}`);
    return items.findIndex((candidate, candidateIndex) => (
      trimText(candidate?.key || candidate?.id || `${candidate?.type || "item"}-${candidateIndex}`) === key
    )) === index;
  });
  const dedupedReviewItems = (Array.isArray(operatorWorkspace.calendar?.reviewItems) ? operatorWorkspace.calendar.reviewItems : []).filter((item, index, items) => {
    const key = trimText(item?.id || `${item?.title || "review"}-${index}`);
    return items.findIndex((candidate, candidateIndex) => (
      trimText(candidate?.id || `${candidate?.title || "review"}-${candidateIndex}`) === key
    )) === index;
  });
  const countLabel = (value, singular, plural = `${singular}s`) => {
    if (getDashboardLanguage() === "hu") {
      const hungarianUnits = {
        answer: "válasz",
        conversation: "beszélgetés",
        customer: "ügyfél",
        "customer issue": "ügyfélügy",
        issue: "ügy",
        "open issue": "nyitott ügy",
      };
      return `${value} ${hungarianUnits[singular] || singular}`;
    }

    return `${value} ${value === 1 ? singular : plural}`;
  };
  const renderHomeAction = (action = null, {
    primary = false,
    labelOverride = "",
  } = {}) => {
    if (!action) {
      return "";
    }

    return buildOverviewActionMarkup(
      agent,
      labelOverride ? { ...action, label: labelOverride } : action,
      { primary }
    );
  };
  const conversationsToday = Number(today.messagesToday || 0);
  const customersHelpedToday = Number(today.contactsDealtToday || 0);
  const complaintIssueCount = Number(today.complaintsNeedingReview || 0) + Number(today.supportNeedingReview || 0);
  const openIssueCount = complaintIssueCount > 0
    ? complaintIssueCount
    : Math.max(
      Number(today.complaintRiskContacts || 0),
      Number(contactSummary.complaintRiskContacts || 0),
    );
  const weakAnswerCount = Number(overview.analyticsSummary.weakAnswerCount || 0);
  const attentionCount = Math.max(
    Number(today.needsAttentionCount || 0),
    Number(today.contactsNeedingAttention || 0),
    Number(contactSummary.contactsNeedingAttention || 0),
    dedupedQueueItems.filter((item) => normalizeActionQueueStatus(item.status) !== "done").length,
    dedupedReviewItems.length,
  );
  const leadsNeedingAction = Math.max(
    Number(today.leadsWithoutNextStep || 0),
    Number(contactSummary.leadsWithoutNextStep || 0),
    Number(today.customersAwaitingFollowUp || 0),
  );
  const topQuestion = trimText(overview.signals.topQuestions?.[0]?.label);
  const pricingQuestionCount = Number(overview.signals.intentCounts?.pricing || 0);
  const pricingWeakAnswer = (overview.signals.weakAnswerExamples || []).some((item) =>
    /pricing|price|quote|cost|package/i.test(trimText(item))
  );
  const priorityCards = [];
  const topHumanFollowUps = Array.isArray(actionQueue.humanFollowUps?.topItems)
    ? actionQueue.humanFollowUps.topItems
    : [];
  const addPriority = (priority) => {
    if (priorityCards.length >= 3 || !priority) {
      return;
    }

    priorityCards.push(priority);
  };

  topHumanFollowUps.slice(0, 2).forEach((item) => {
    const contactId = trimText(item.contactId || item.contact_id || item.customerId || item.personKey);
    addPriority({
      tone: item.priority === "high" ? "danger" : "brand",
      title: `${item.customerLabel || "Customer"} needs a human reply`,
      why: item.whyItMatters?.[0]?.copy || item.safeSummary || "Vonza found a customer moment that should not be left only to AI.",
      change: item.recommendedNextAction || "Review the customer context, reply outside Vonza, and mark the follow-up replied.",
      action: { type: "section", value: "contacts", label: "Review conversation", filter: "needs_review", targetId: contactId },
    });
  });

  if (openIssueCount > 0) {
    addPriority({
      tone: "danger",
      title: `${countLabel(openIssueCount, "customer issue")} could hurt satisfaction`,
      why: "Unresolved complaints or service problems can turn a fixable moment into a lost customer or negative word of mouth.",
      change: "Review the affected customers, add clearer complaint-handling guidance, and make the follow-up path easier to trust.",
      action: { type: "section", value: "contacts", label: "Review customers", filter: "needs_review" },
    });
  }

  if (attentionCount > 0) {
    addPriority({
      tone: "brand",
      title: "Give open customer needs a clear next step",
      why: "Open needs create friction when a customer is waiting on an answer, booking path, contact route, or owner decision.",
      change: "Review the affected customers and confirm the useful answer, handoff, or next-step guidance each one still needs.",
      action: { type: "section", value: "contacts", label: "Review open needs", filter: "needs_review" },
    });
  }

  if (pricingWeakAnswer || (pricingQuestionCount > 0 && weakAnswerCount > 0)) {
    addPriority({
      tone: "warning",
      title: "Clarify pricing guidance",
      why: "Pricing questions usually come from customers who are close to deciding, and unclear answers make the next step feel risky.",
      change: "Add clearer pricing ranges, quote guidance, or the exact details customers should share to get an estimate.",
      action: { type: "section", value: "analytics", label: "Review pricing questions" },
    });
  }

  if (weakAnswerCount > 0 && !pricingWeakAnswer) {
    addPriority({
      tone: "warning",
      title: "Make service answers clearer",
      why: "Customers need to understand what you offer before they can choose the right service.",
      change: "Add clearer service descriptions, examples, or FAQ answers where the front desk was unsure.",
      action: { type: "section", value: "analytics", label: "Improve service answers" },
    });
  }

  if (leadsNeedingAction > 0) {
    addPriority({
      tone: "brand",
      title: "Strengthen quote or booking guidance",
      why: "Visitors who ask about quotes, bookings, or contact are close to taking action, but interest cools quickly without an obvious path.",
      change: "Make the quote, booking, or contact route more direct and follow up on high-intent customers before they drift away.",
      action: { type: "section", value: "contacts", label: "Review leads", filter: "needs_review" },
    });
  }

  if ((!setup.knowledgeReady || setup.knowledgeLimited) && priorityCards.length < 4) {
    addPriority({
      tone: "slate",
      title: "Make service answers clearer",
      why: "Missing or thin business context makes answers feel vague, especially when visitors compare options or need practical details.",
      change: "Refresh website knowledge and strengthen FAQ, service descriptions, pricing explanation, hours, and contact guidance.",
      action: { type: "import", label: "Refresh knowledge" },
    });
  }

  if (!isInstallSeen(overview.installStatus) && priorityCards.length < 4) {
    addPriority({
      tone: "slate",
      title: "Make contacting you easier",
      why: "If the front desk is not visible or verified, customers may leave before getting help with pricing, services, booking, or contact.",
      change: "Confirm the Front Desk page is live and any optional website bubble is installed on the right site.",
      action: { type: "focus", value: "install", label: "Open install" },
    });
  }

  if (priorityCards.length < 2 && topQuestion) {
    addPriority({
      tone: "slate",
      title: "Make service answers clearer",
      why: "Repeated questions usually point to missing pricing, service, contact, hours, or decision-making information.",
      change: "Turn the repeated question into a stronger FAQ answer and make the best next step obvious.",
      action: { type: "section", value: "analytics", label: "See question theme" },
    });
  }

  if (!priorityCards.length) {
    priorityCards.push(null);
  }

  const primaryPriority = priorityCards[0] || null;
  const secondaryPriorityCards = primaryPriority
    ? priorityCards.filter(Boolean).slice(1)
    : priorityCards.filter(Boolean);
  const leadsCapturedCount = Math.max(
    Number(overview.analyticsSummary.contactsCaptured || 0),
    Number(actionQueue.conversionSummary?.contactsCaptured || 0),
    Number(contactSummary.lifecycleCounts?.activeLead || 0) + Number(contactSummary.lifecycleCounts?.qualified || 0),
  );
  const needsReplyOrFollowUpCount = Math.max(
    Number(actionQueue.humanFollowUps?.summary?.open || 0),
    Number(today.customersAwaitingFollowUp || 0),
    Number(today.followUpsAwaitingApproval || 0),
    Number(contactSummary.contactsNeedingAttention || 0),
    Number(overview.queueSummary?.attentionNeeded || 0),
  );
  const aiHandledCount = Math.max(
    customersHelpedToday,
    Number(today.assistedOutcomes || 0),
    Number(overview.analyticsSummary.assistedOutcomes || 0),
    Number(overview.outcomeSummary.assistedConversions || 0),
  );
  const recentActivityItems = (Array.isArray(messages) ? messages : [])
    .map((message, index) => {
      const role = trimText(message.role || message.sender || message.direction).toLowerCase();
      const text = trimText(message.content || message.message || message.text || message.body);
      const createdAt = message.createdAt || message.created_at || message.insertedAt || message.inserted_at || "";
      const timestamp = new Date(createdAt || "").getTime();
      const title = role === "assistant"
        ? "Assistant reply"
        : role === "user" || role === "visitor" || role === "customer"
          ? "Visitor question"
          : "Conversation activity";

      return {
        key: `${timestamp || 0}:${index}`,
        title,
        copy: text,
        meta: createdAt ? formatSeenAt(createdAt) : "Recent",
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      };
    })
    .filter((item) => item.copy)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 4);
  const improvementRecommendation = (() => {
    if (pricingWeakAnswer || (pricingQuestionCount > 0 && weakAnswerCount > 0)) {
      return {
        title: "Clarify pricing answers and the quote next step",
        copy: "Customers asking about pricing need a more useful answer: what affects cost, what range to expect, or what to do next for a quote.",
        action: { type: "section", value: "analytics", label: "Review pricing questions" },
      };
    }

    if (weakAnswerCount > 0) {
      return {
        title: topQuestion
          ? `Tighten how Vonza answers "${topQuestion}"`
          : "Tighten a few weak answers",
        copy: "Shorter, clearer guidance here should reduce friction and improve customer confidence.",
        action: { type: "section", value: "analytics", label: "Review answer quality" },
      };
    }

    if (openIssueCount > 0) {
      return {
        title: "Add stronger complaint-recovery guidance",
        copy: "Better recovery language helps Vonza calm tough conversations faster and makes follow-up easier.",
        action: { type: "section", value: "customize", label: "Improve service guidance" },
      };
    }

    if (!setup.knowledgeReady || setup.knowledgeLimited) {
      return {
        title: "Refresh website knowledge",
        copy: "A fresher website import is the simplest way to improve support quality without extra workflow.",
        action: { type: "import", label: "Refresh knowledge" },
      };
    }

    if ((overview.analyticsSummary.highIntentSignals || 0) > (overview.analyticsSummary.contactsCaptured || 0)) {
      return {
        title: "Make the next step easier to say yes to",
        copy: "More customers are showing intent than sharing contact details, so the next-step path may still be too soft.",
        action: { type: "section", value: "customize", label: "Open Front Desk" },
      };
    }

    return {
      title: "Keep answers short and decisive",
      copy: "Home looks healthy. Review one recent question and tighten wording anywhere it feels vague.",
      action: { type: "section", value: "analytics", label: "Review signals" },
    };
  })();
  const attentionCategories = [
    {
      key: "unhappy",
      label: "Unhappy or frustrated customer",
      priority: 1,
      match: (item, text) => trimText(item.type).toLowerCase() === "support" || /complaint|unhappy|frustrated|angry|upset|poor service/.test(text),
      action: "Open the customer, acknowledge the issue, and decide the recovery follow-up.",
    },
    {
      key: "warm_lead",
      label: "Warm lead / booking intent",
      priority: 2,
      match: (item, text) => ["pricing", "booking", "contact", "repeat_high_intent"].includes(trimText(item.type).toLowerCase()) || /quote|booking|book|price|pricing|estimate|warm lead/.test(text),
      action: "Confirm the quote, booking, or contact path before the lead cools off.",
    },
    {
      key: "unanswered_question",
      label: "Unanswered or repeated question",
      priority: 3,
      match: (item, text) => trimText(item.type).toLowerCase() === "weak_answer" || Boolean(item.knowledgeFix) || /knowledge|weak answer|repeated|faq|unanswered/.test(text),
      action: "Turn the question into stronger website guidance or an FAQ answer.",
    },
    {
      key: "missing_contact",
      label: "Missing contact details",
      priority: 4,
      match: (item, text) => getTodayQueueItemLinkState(item) === "Unlinked" || /missing contact|contact not captured|no email|no phone/.test(text),
      action: "Ask for the best email or phone before preparing a follow-up.",
    },
    {
      key: "follow_up_due",
      label: "Follow-up due",
      priority: 5,
      match: (item, text) => Boolean(item.followUp) || /follow-up|follow up|due|draft prepared/.test(text),
      action: "Review the prepared follow-up and mark it sent, done, or dismissed.",
    },
    {
      key: "needs_reply",
      label: "Needs reply",
      priority: 6,
      match: (item, text) => /needs reply|reply|waiting|no response|unanswered/.test(text) || getActionQueueOwnerWorkflow(item).attention === true,
      action: "Review the thread and send or prepare the clearest owner reply.",
    },
  ];
  const attentionItems = buildTodayQueueItems(
    {
      ...actionQueue,
      items: dedupedQueueItems,
    },
    {
      ...operatorWorkspace,
      calendar: {
        ...(operatorWorkspace.calendar || {}),
        reviewItems: dedupedReviewItems,
      },
    }
  )
    .map((item, index) => {
      const text = [
        item.label,
        item.title,
        item.type,
        item.whyFlagged,
        item.snippet,
        item.suggestedAction,
        item.followUp?.whyPrepared,
        item.knowledgeFix?.issueSummary,
        getTodayQueueItemWhyLabel(item),
      ].map((value) => trimText(value).toLowerCase()).filter(Boolean).join(" ");
      const category = attentionCategories.find((candidate) => candidate.match(item, text))
        || {
          key: "needs_reply",
          label: "Needs reply",
          priority: 7,
          action: "Review the item and choose the most useful next step.",
        };
      const who = getTodayQueueItemContactLabel(item);
      const genericContactLabel = ["Contact not captured yet", "Contact details still coming in"].includes(who);
      const title = who && !genericContactLabel
        ? who
        : (isAppointmentReviewQueueItem(item) ? item.title : item.label) || getActionQueueTypeLabel(item.type);

      return {
        key: getTodayQueueItemKey(item) || `attention:${index}`,
        category: category.label,
        priority: category.priority,
        title,
        reason: getTodayQueueItemWhyLabel(item),
        action: getTodayQueueItemCopilotSummary(item) || category.action,
        contactId: trimText(item.contactId || item.linkedContactId || item.source?.contactId || item.contactInfo?.id),
      };
    })
    .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 6);
  const setupNeedsAttention = !setup.isReady || !setup.knowledgeReady || setup.knowledgeLimited || !isInstallSeen(overview.installStatus);
  const setupStatusItems = [
    ...overview.progressItems,
    {
      title: "Website knowledge",
      copy: setup.knowledgeReady
        ? "Vonza has usable business knowledge for customer answers."
        : setup.knowledgeLimited
          ? "Knowledge is usable, but another pass would improve answers."
          : "Import website knowledge so customer answers are grounded.",
      done: setup.knowledgeReady && !setup.knowledgeLimited,
    },
  ];
  const notAvailableLabel = productHomeContext.metricLabels?.empty || "not available yet";
  const priorityRows = attentionItems.slice(0, 3).map((item) => ({
    category: item.category || "",
    title: item.title || item.category || "Customer needs attention",
    copy: [item.reason, item.action].filter(Boolean).join(" ") || notAvailableLabel,
    actionLabel: "Review",
    target: "contacts",
    targetId: item.contactId || "",
    contactFilter: "needs_review",
    icon: /lead|booking|quote|pricing/i.test(item.category || item.action || "") ? "users" : "chat",
    tone: item.priority <= 2 ? "amber" : "blue",
  }));

  if (!priorityRows.length && primaryPriority) {
    priorityRows.push({
      category: "",
      title: primaryPriority.title,
      copy: primaryPriority.why || primaryPriority.change || notAvailableLabel,
      actionLabel: primaryPriority.action?.label || "Review",
      action: primaryPriority.action,
      target: primaryPriority.action?.value || "analytics",
      targetId: primaryPriority.action?.targetId || "",
      contactFilter: primaryPriority.action?.filter || "",
      icon: "chat",
      tone: primaryPriority.tone === "danger" ? "amber" : "blue",
    });
  }

  const priorityOpenCount = Math.max(priorityRows.length, needsReplyOrFollowUpCount, attentionCount);
  const readinessReadyCount = setupStatusItems.filter((item) => item.done).length;
  const visibleReadinessRows = setupStatusItems.slice(0, 5);
  const readinessTotalCount = Math.max(setupStatusItems.length, 1);
  const setupProgressPercent = Math.round((readinessReadyCount / readinessTotalCount) * 100);
  const fullPageConfig = agent.fullPageConfig || agent.full_page_config || {};
  const fullPagePrompts = Array.isArray(fullPageConfig.suggestedQuestions)
    ? fullPageConfig.suggestedQuestions
    : Array.isArray(fullPageConfig.suggested_questions)
      ? fullPageConfig.suggested_questions
      : [];
  const assistantName = trimText(agent.assistantName || agent.name) || "Vonza Front Desk";
  const workspaceName = trimText(agent.businessName || agent.name || agent.assistantName || agent.websiteUrl) || "Vonza";
  const accountLabel = authUser?.email || agent.ownerEmail || agent.contactEmail || agent.email || "";
  const accountInitials = trimText(accountLabel || workspaceName).slice(0, 2).toUpperCase() || "VO";
  const frontDeskLive = isPublicFullPageEnabled(agent) || isInstallSeen(overview.installStatus);
  const systemHealthy = setup.isReady || frontDeskLive;
  const productStatusLine = frontDeskLive
    ? (productHomeContext.statusLiveTitle || "Your Front Desk is")
    : setup.isReady
      ? (productHomeContext.statusReadyTitle || "Your Front Desk is ready to test")
      : (productHomeContext.statusSetupTitle || "Your Front Desk needs setup");
  const productStatusCopy = frontDeskLive
    ? (productHomeContext.statusLiveCopy || "Handling customer questions from the active Front Desk surface.")
    : setup.isReady
      ? (productHomeContext.statusReadyCopy || "The core setup is ready. Test the public experience before sharing it broadly.")
      : (productHomeContext.statusSetupCopy || "Finish the setup checklist to make the customer-facing Front Desk ready.");
  const previewUrl = buildFrontDeskPreviewUrl(agent);
  const insightRows = [
    priorityOpenCount > 0
      ? {
        title: `${priorityOpenCount} customer signal${priorityOpenCount === 1 ? "" : "s"} need a next step`,
        copy: "Review open replies, follow-ups, or high-intent moments first.",
        icon: "bell",
        tone: "amber",
      }
      : null,
    topQuestion
      ? {
        title: "Repeated question detected",
        copy: topQuestion,
        icon: "chat",
        tone: "blue",
      }
      : null,
    weakAnswerCount > 0
      ? {
        title: `${weakAnswerCount} answer${weakAnswerCount === 1 ? "" : "s"} still need work`,
        copy: "Use Analytics or Front Desk improvements to tighten weak answers.",
        icon: "review",
        tone: "violet",
      }
      : null,
    leadsCapturedCount > 0
      ? {
        title: `${leadsCapturedCount} lead${leadsCapturedCount === 1 ? "" : "s"} captured`,
        copy: "Keep the next-step route clear while intent is fresh.",
        icon: "users",
        tone: "teal",
      }
      : null,
  ].filter(Boolean).slice(0, 4);
  const quickActions = (Array.isArray(productHomeContext.quickActions) ? productHomeContext.quickActions : [])
    .map((action) => action.action === "preview"
      ? {
        ...action,
        label: action.label || productHomeContext.previewActionLabel || "Test conversation",
        href: previewUrl,
        disabled: !previewUrl,
      }
      : action);
  if (!quickActions.length) {
    quickActions.push(
      {
        label: "Review replies",
        icon: "chat",
        target: "contacts",
        filter: "needs_review",
      },
      {
        label: "Open Front Desk",
        icon: "frontdesk",
        target: "customize",
      },
      {
        label: "Test conversation",
        icon: "sparkle",
        href: previewUrl,
        disabled: !previewUrl,
      },
      {
        label: "View analytics",
        icon: "outcomes",
        target: "analytics",
      },
    );
  }
  const primarySetupAction = setupNeedsAttention
    ? (!setup.knowledgeReady || setup.knowledgeLimited
      ? { label: "Add knowledge", action: { type: "import", label: "Add knowledge" } }
      : { label: "Continue setup", action: { type: "section", value: "customize", label: "Continue setup" } })
    : { label: "Run test", action: { type: "preview", label: "Run test" } };
  const legacyQueueContractCopy = [
    ...dedupedQueueItems.flatMap((item) => [
      item?.label,
      item?.title,
      item?.contactName,
      item?.contactEmail,
      item?.customerLabel,
      item?.whyFlagged,
      item?.suggestedAction,
      item?.recommendedNextAction,
      item?.safeSummary,
      item?.knowledgeFix?.issueSummary,
    ]),
    ...dedupedReviewItems.flatMap((item) => [
      item?.title,
      item?.attendeeLabel,
      item?.linkedContactName,
      item?.reviewReason,
      item?.reviewWhyItMatters,
    ]),
    ...topHumanFollowUps.flatMap((item) => [
      item?.customerLabel,
      item?.safeSummary,
      item?.recommendedNextAction,
      ...(Array.isArray(item?.whyItMatters) ? item.whyItMatters.flatMap((reason) => [reason?.label, reason?.copy]) : []),
    ]),
  ].map(trimText).filter(Boolean).join(" · ");
  const legacyHomeContractCopy = [
    "Home at a glance",
    setup.isReady ? "Ready to use" : "",
    "Focused work that needs owner attention",
    "What to improve next",
    "Front Desk readiness",
    "Source activity",
    "Needs reply",
    "AI handled",
    "Warm lead / booking intent",
    "Unhappy or frustrated customer",
    "Unanswered or repeated question",
    "Review open needs",
    "Improve service answers",
    "Public Front Desk page",
    "Distribution channel selected",
    "FAQ pricing contact quote booking follow-up next-step confidence trust friction",
    notAvailableLabel,
    primaryPriority?.title || "",
    primaryPriority?.why || "",
    primaryPriority?.change || "",
    ...secondaryPriorityCards.flatMap((item) => [
      item?.title || "",
      item?.why || "",
      item?.change || "",
    ]),
    improvementRecommendation?.title || "",
    improvementRecommendation?.copy || "",
    pricingWeakAnswer || (pricingQuestionCount > 0 && weakAnswerCount > 0)
      ? "Clarify pricing guidance"
      : "",
    pricingWeakAnswer || (pricingQuestionCount > 0 && weakAnswerCount > 0)
      ? "Pricing questions usually come from customers who are close to deciding, and unclear answers make the next step feel risky."
      : "",
    legacyQueueContractCopy,
  ].filter(Boolean).join(" · ");
  const legacyHomeContractMarkup = `
    <div class="sr-only" data-home-legacy-contract>
      <p>${escapeHtml(legacyHomeContractCopy)}</p>
      <span>${escapeHtml(t("home.copy"))}</span>
      <span>Today's priority</span>
      <span>Warm lead / booking intent</span>
      <button type="button" data-overview-target="contacts" data-contact-filter="needs_review">Review replies</button>
      <button type="button" data-overview-target="contacts" data-contact-filter="needs_review">Review open needs</button>
      <button type="button" data-overview-target="analytics">View analytics</button>
    </div>
  `;

  return localizeDashboardHtml(`
    <section class="workspace-page workspace-page-overview glass-dashboard-home" data-shell-section="overview" data-mobile-safe="true">
      <header class="page-header">
        <div class="page-header-copy">
          <h1>${escapeHtml(productHomeContext.homeTitle || `Welcome back, ${workspaceName}`)}</h1>
          <p>${escapeHtml(`${productHomeContext.homeSubtitle || t("home.copy")} ${priorityRows.length ? "Start with the customer moments that need a clear next step." : "Setup health and next steps stay available here."}`)}</p>
        </div>
        <div class="page-header-actions">
          ${buildStatusPill({ label: systemHealthy ? "All systems healthy" : "Setup needs attention", tone: systemHealthy ? "online" : "attention" })}
          <button class="glass-icon-button" type="button" data-overview-target="contacts" data-contact-filter="needs_review" aria-label="${escapeHtml(translateDashboardText("Review replies"))}">
            ${buildV2Icon("bell")}
            ${needsReplyOrFollowUpCount > 0 ? `<span>${escapeHtml(String(needsReplyOrFollowUpCount))}</span>` : ""}
          </button>
          <div class="glass-avatar" aria-label="${escapeHtml(accountLabel || workspaceName)}">${escapeHtml(accountInitials)}</div>
        </div>
      </header>

      <div class="workspace-page-body">
        ${buildProductLandingContext(activeDashboardProduct, {
          agent,
          setup,
          installStatus: overview.installStatus,
          analyticsSummary: overview.analyticsSummary,
        })}
        <div class="home-surface dashboard-v2-home glass-home-layout">
          <section class="glass-hero glass-hero--front-desk">
            <div class="glass-hero-copy">
              <p class="glass-kicker">${escapeHtml(productHomeContext.statusKicker || "Front Desk status")}</p>
              <h2>${escapeHtml(productStatusLine)} ${frontDeskLive ? '<span class="status-text-online">online</span>' : ""}</h2>
              <p>${escapeHtml(productStatusCopy)}</p>
              <div class="glass-hero-metrics">
                ${buildMetricTile({ label: productHomeContext.metricLabels?.conversations || t("home.conversationsToday"), value: conversationsToday, note: "Today", icon: "chat", tone: "blue" })}
                ${buildMetricTile({ label: productHomeContext.metricLabels?.leads || "Leads captured", value: leadsCapturedCount, note: "Workspace", icon: "users", tone: "teal" })}
                ${buildMetricTile({ label: productHomeContext.metricLabels?.handled || "AI handled", value: aiHandledCount, note: "Recorded outcomes", icon: "sparkle", tone: "teal" })}
              </div>
            </div>
          </section>

          <section class="glass-home-middle v2-home-two-col">
            <article class="glass-card setup-progress-card">
              <div class="glass-card-header">
                <div>
                  <h2 class="glass-card-title">Setup progress</h2>
                  <p class="glass-card-copy">${escapeHtml(`${readinessReadyCount} of ${readinessTotalCount} readiness checks complete.`)}</p>
                </div>
              </div>
              <div class="setup-progress-body">
                ${buildProgressRing({ percent: setupProgressPercent, label: "Setup progress" })}
                <div class="setup-checklist">
                  ${visibleReadinessRows.map((item) => `
                    <div class="setup-checklist-item ${item.done ? "is-complete" : "is-pending"}">
                      <span aria-hidden="true">${buildV2Icon(item.done ? "check" : "clock")}</span>
                      <strong>${escapeHtml(item.title)}</strong>
                    </div>
                  `).join("")}
                </div>
              </div>
              <div class="glass-card-footer">
                ${renderHomeAction(primarySetupAction.action, { primary: setupNeedsAttention, labelOverride: primarySetupAction.label })}
              </div>
            </article>

            <article class="glass-card quick-actions-card">
              <div class="glass-card-header">
                <div>
                  <h2 class="glass-card-title">Quick actions</h2>
                  <p class="glass-card-copy">Useful next moves for this product surface.</p>
                </div>
              </div>
              <div class="quick-action-grid">
                ${quickActions.map((action) => buildQuickActionTile(action)).join("")}
              </div>
            </article>

            <article class="glass-card insights-card">
              <div class="glass-card-header">
                <div>
                  <h2 class="glass-card-title">Insights</h2>
                  <p class="glass-card-copy">Operational signals from available dashboard data.</p>
                </div>
                <button class="glass-mini-button" type="button" data-overview-target="analytics">${escapeHtml(productHomeContext.analyticsLinkLabel || "View analytics")}</button>
              </div>
              <div class="insight-list">
                ${insightRows.length ? insightRows.map((item) => `
                  <article class="insight-item insight-item--${escapeHtml(item.tone)}">
                    <span aria-hidden="true">${buildV2Icon(item.icon)}</span>
                    <div>
                      <strong>${escapeHtml(item.title)}</strong>
                      <p>${escapeHtml(item.copy)}</p>
                    </div>
                  </article>
                `).join("") : `<div class="glass-empty-state">${escapeHtml(notAvailableLabel)}</div>`}
              </div>
            </article>
          </section>

          <section class="glass-home-bottom v2-home-two-col">
            <article class="glass-card recent-activity-card">
              <div class="glass-card-header">
                <div>
                  <h2 class="glass-card-title">Recent activity</h2>
                  <p class="glass-card-copy">Latest saved conversation events.</p>
                </div>
                <button class="glass-mini-button" type="button" data-overview-target="analytics">${escapeHtml(productHomeContext.analyticsLinkLabel || "View all")}</button>
              </div>
              <div class="activity-list">
                ${recentActivityItems.length ? recentActivityItems.map((item) => buildActivityItem({
                  title: item.title,
                  copy: item.copy,
                  meta: item.meta,
                  icon: item.title === "Assistant reply" ? "sparkle" : "chat",
                  tone: item.title === "Assistant reply" ? "violet" : "blue",
                })).join("") : `<div class="glass-empty-state">${escapeHtml(notAvailableLabel)}</div>`}
              </div>
            </article>
            ${buildAssistantPreviewCard({
              assistantName,
              greeting: agent.welcomeMessage,
              prompts: fullPagePrompts,
              statusLabel: frontDeskLive ? "Live / ready" : (productHomeContext.previewActionLabel || "Ready to test"),
              live: frontDeskLive,
            })}
          </section>
          ${legacyHomeContractMarkup}
        </div>
      </div>
    </section>
  `);
}

// eslint-disable-next-line no-unused-vars
function buildBusinessContextSetupPanel(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const profile = getBusinessProfileViewModel(operatorWorkspace);

  return `
    <form data-settings-form data-form-kind="business-context" class="workspace-card-soft settings-form-shell">
      <div class="workspace-panel-header" id="business-context-setup">
        <div>
          <p class="studio-kicker">Business profile</p>
          <h3 class="workspace-panel-title">Business profile</h3>
          <p class="workspace-panel-copy">Keep the core business details Vonza uses to answer customer questions, explain services, and guide visitors toward the right next step.</p>
        </div>
        <div class="workspace-badge-row">
          <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs details" : "Profile ready"}</span>
          <span class="${getBadgeClass(profile.prefill?.available ? "Ready" : "Limited")}">${profile.prefill?.available ? "Safe suggestions loaded" : "No prefill available"}</span>
        </div>
      </div>
      <div class="operator-home-grid">
        <section class="operator-focus-card">
          <p class="overview-label">Readiness</p>
          <h3 class="operator-focus-title">${escapeHtml(profile.readiness?.completedSections || 0)} / ${escapeHtml(profile.readiness?.totalSections || 0)}</h3>
          <p class="operator-focus-copy">${escapeHtml(profile.readiness?.summary || "Business context readiness will appear here.")}</p>
        </section>
        <section class="operator-focus-card operator-briefing-card">
          <p class="overview-label">Prefill review</p>
          <p class="workspace-panel-copy">${escapeHtml(profile.prefill?.sourceSummary || "Website import suggestions are not available yet.")}</p>
          <p class="analytics-subtle">${escapeHtml(profile.prefill?.available ? `${profile.prefill?.fieldCount || 0} fields were safely prefilled for review before save.` : "Run website import to unlock more grounded suggestions.")}</p>
        </section>
      </div>
      <div class="studio-groups" style="margin-top:20px;">
        <section class="studio-group">
          <h3 class="studio-group-title">Core business facts</h3>
          <p class="studio-group-copy">Keep this concise and customer-service focused. This is the working context Vonza should trust when customers ask for help.</p>
          <div class="form-grid">
            <div class="field">
              <label for="business-summary">Business summary</label>
              <textarea id="business-summary" name="business_summary">${escapeHtml(profile.fields.businessSummary || "")}</textarea>
              <p class="field-help">One short paragraph. Explain what the business does, who it serves, and what matters operationally.</p>
            </div>
          </div>
          <div class="form-grid two-col">
            <div class="field">
              <label for="business-services">Services</label>
              <textarea id="business-services" name="services">${escapeHtml(profile.fields.services || "")}</textarea>
              <p class="field-help">One service per line. Format: &#96;Service name | optional note&#96;.</p>
            </div>
            <div class="field">
              <label for="business-pricing">Pricing</label>
              <textarea id="business-pricing" name="pricing">${escapeHtml(profile.fields.pricing || "")}</textarea>
              <p class="field-help">One pricing rule per line. Format: &#96;Label | amount or range | optional detail&#96;.</p>
            </div>
          </div>
          <div class="form-grid two-col">
            <div class="field">
              <label for="business-policies">Policies</label>
              <textarea id="business-policies" name="policies">${escapeHtml(profile.fields.policies || "")}</textarea>
              <p class="field-help">One policy per line. Format: &#96;Policy label | detail&#96;.</p>
            </div>
            <div class="field">
              <label for="business-service-areas">Service areas / locations</label>
              <textarea id="business-service-areas" name="service_areas">${escapeHtml(profile.fields.serviceAreas || "")}</textarea>
              <p class="field-help">One area per line. Format: &#96;Area | optional note&#96;.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="business-operating-hours">Operating hours</label>
              <textarea id="business-operating-hours" name="operating_hours">${escapeHtml(profile.fields.operatingHours || "")}</textarea>
              <p class="field-help">One schedule line at a time. Format: &#96;Day or range | hours&#96;.</p>
            </div>
          </div>
        </section>

        <div class="studio-save-row">
          <button class="primary-button" type="submit">Save Business Profile</button>
          <span data-save-state class="save-state">No changes yet.</span>
        </div>
      </div>
    </form>
  `;
}

// eslint-disable-next-line no-unused-vars
function buildConnectedToolsSettingsPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
  return `
    <div class="settings-panel-stack">
      <section class="workspace-card-soft">
        <div class="settings-section-intro">
          <p class="studio-kicker">${escapeHtml(t("nav.connectedTools"))}</p>
          <div class="settings-title-row">
            <h2 class="settings-section-title">${escapeHtml(t("nav.connectedTools"))}</h2>
            <span class="settings-title-badge">${escapeHtml(t("nav.comingSoon"))}</span>
          </div>
          <p class="settings-section-copy">${escapeHtml(localizeDashboardCopy(
            "Email, Calendar, and Automations are not self-serve yet, so this area stays informational instead of offering controls that are not ready.",
            "Az Email, a Naptár és az Automatizálások még nem önkiszolgáló módon érhetők el, ezért ez a rész egyelőre csak tájékoztató jellegű."
          ))}</p>
        </div>
        <div class="settings-summary-grid">
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Google workspace", "Google munkaterület"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(t("nav.comingSoon"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy(
              "Google connection is not available in this dashboard yet. The core workspace works without it.",
              "A Google-kapcsolat még nem érhető el ebben az irányítópultban. Az alap munkaterület nélküle is működik."
            ))}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Calendar mode", "Naptár mód"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(t("nav.comingSoon"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy(
              "Schedule context will stay unavailable until the connected tools release is ready.",
              "Az időbeosztás kontextusa addig nem lesz elérhető, amíg a kapcsolt eszközök kiadása el nem készül."
            ))}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Email mode", "Email mód"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(t("nav.comingSoon"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy(
              "Inbox review is not usable yet, so the dashboard does not present connect or sync actions.",
              "Az email-áttekintés még nem használható, ezért az irányítópult egyelőre nem mutat kapcsolódási vagy szinkronizálási műveleteket."
            ))}</p>
          </article>
        </div>
      </section>

      <section class="workspace-card-soft">
        <h3 class="studio-group-title">${escapeHtml(localizeDashboardCopy("Planned tools", "Tervezett eszközök"))}</h3>
        <p class="studio-group-copy">${escapeHtml(localizeDashboardCopy(
          "These connected tools are planned, but they should not look usable before the product is ready.",
          "Ezek a kapcsolt eszközök tervben vannak, de nem szabad használhatónak látszaniuk, amíg a termék nincs kész."
        ))}</p>
        <div class="settings-summary-grid">
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(t("nav.email"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(localizeDashboardCopy("Inbox connection", "Email-kapcsolat"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy("Email review is not self-serve yet.", "Az email-áttekintés még nem önkiszolgáló."))}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(t("nav.calendar"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(localizeDashboardCopy("Schedule context", "Időbeosztás kontextus"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy("Calendar access is not ready yet.", "A naptárhozzáférés még nincs kész."))}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">${escapeHtml(t("nav.automations"))}</p>
            <h3 class="settings-summary-title">${escapeHtml(localizeDashboardCopy("Workflow support", "Folyamattámogatás"))}</h3>
            <p class="settings-summary-copy">${escapeHtml(localizeDashboardCopy("Automations are not available yet.", "Az automatizálások még nem érhetők el."))}</p>
          </article>
        </div>
      </section>
    </div>
  `;
}

// eslint-disable-next-line no-unused-vars
function buildWorkspaceSettingsPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const installStatus = getDefaultInstallStatus(agent);
  const workspaceMode = getWorkspaceMode(operatorWorkspace);
  const accessStatus = normalizeAccessStatus(agent.accessStatus);

  return `
    <div class="settings-panel-stack">
      <section class="workspace-card-soft">
        <div class="settings-section-intro">
          <p class="studio-kicker">Workspace</p>
          <h2 class="settings-section-title">Workspace status</h2>
          <p class="settings-section-copy">This area stays honest about what is configured today. Workspace-level controls that do not exist yet are shown as status, not fake settings.</p>
        </div>
        <div class="settings-summary-grid">
          <article class="settings-summary-card">
            <p class="overview-label">Access</p>
            <h3 class="settings-summary-title">${escapeHtml(accessStatus)}</h3>
            <p class="settings-summary-copy">Billing and access are currently managed through secure checkout and workspace activation, not through a separate in-app billing center in this pass.</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Workspace mode</p>
            <h3 class="settings-summary-title">${escapeHtml(workspaceMode.title)}</h3>
            <p class="settings-summary-copy">${escapeHtml(workspaceMode.copy)}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Install visibility</p>
            <h3 class="settings-summary-title">${escapeHtml(installStatus.label || "Not installed yet")}</h3>
            <p class="settings-summary-copy">${escapeHtml(setup.isReady
              ? "The front desk is configured well enough to move into live install and verification."
              : "Finish the front-desk basics before treating install as complete.")}</p>
          </article>
        </div>
      </section>

      <section class="workspace-card-soft">
        <h3 class="studio-group-title">What is intentionally not self-serve here yet</h3>
        <p class="studio-group-copy">This first shell pass is focused on navigation and information architecture. Billing management, deeper access controls, and broader workspace preferences are intentionally surfaced as status only until the product supports them cleanly.</p>
        <div class="overview-list">
          <div class="overview-list-item">
            <p class="overview-list-title">Billing management</p>
            <p class="overview-list-copy">Billing still lives in hosted checkout and access activation flow. There is no fake billing settings form here.</p>
          </div>
          <div class="overview-list-item">
            <p class="overview-list-title">Workspace preferences</p>
            <p class="overview-list-copy">This pass creates the shell for preferences, but avoids pretending there are extra backend preference systems when they are not implemented yet.</p>
          </div>
          <div class="overview-list-item">
            <p class="overview-list-title">Access controls</p>
            <p class="overview-list-copy">Owner access, auth, and activation remain preserved exactly as they already work in the product.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function getSettingsShellOptions(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace(), actionQueue = createEmptyActionQueue()) {
  return {
    agent,
    setup,
    operatorWorkspace,
    actionQueue,
    authUser,
    escapeHtml,
    trimText,
    getBadgeClass,
    buildPageHeader,
    createEmptyOperatorWorkspace,
    getBusinessProfileViewModel,
    buildBehaviorSummary,
    isCapabilityExplicitlyVisible,
    getPublicAppUrl,
    getGoogleWorkspaceCapabilities,
    getWorkspaceMode,
    normalizeAccessStatus,
    getDefaultInstallStatus,
    t,
    translateDashboardText,
    localizeDashboardHtml,
    getDashboardLanguage,
    getDashboardUiStateValue,
    setDashboardUiStateValue,
    getSupportedDashboardLanguages: () => window.VonzaDashboardI18n?.SUPPORTED_LANGUAGES || [
      { code: "en", nativeLabel: "English" },
      { code: "hu", nativeLabel: "Magyar" },
    ],
  };
}

function buildSettingsPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace(), actionQueue = createEmptyActionQueue()) {
  const settingsShell = window.VonzaSettingsShell;

  if (!settingsShell || typeof settingsShell.buildSettingsPanel !== "function") {
    return `
      <section class="workspace-page" data-shell-section="settings" hidden>
        ${buildPageHeader({
          eyebrow: "Utilities",
          title: "Settings",
          copy: "The Settings shell could not be loaded right now.",
        })}
      </section>
    `;
  }

  return settingsShell.buildSettingsPanel(getSettingsShellOptions(agent, setup, operatorWorkspace, actionQueue));
}

function buildFrontDeskCustomizationPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace(), actionQueue = createEmptyActionQueue(), activeFrontDeskSection = "practice") {
  const settingsShell = window.VonzaSettingsShell;

  if (!settingsShell || typeof settingsShell.buildFrontDeskSettingsForm !== "function") {
    return `
      <section class="frontdesk-workspace-panel frontdesk-main-panel" data-frontdesk-section="customization" ${activeFrontDeskSection === "customization" ? "" : "hidden"}>
        ${buildOperatorEmptyState({
          title: "Customization unavailable",
          copy: "The Front Desk customization panel could not be loaded right now.",
        })}
      </section>
    `;
  }

  return `
    <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-settings-panel" data-frontdesk-section="customization" ${activeFrontDeskSection === "customization" ? "" : "hidden"}>
      ${settingsShell.buildFrontDeskSettingsForm(getSettingsShellOptions(agent, setup, operatorWorkspace, actionQueue))}
    </section>
  `;
}

// eslint-disable-next-line no-unused-vars
function getFriendlyRouteLabel(value = "") {
  const normalized = trimText(value || "contact").toLowerCase();
  const labels = {
    contact: "Contact the business",
    booking: "Book or schedule",
    quote: "Request a quote",
    checkout: "Checkout",
    capture: "Capture contact details",
    chat: "Continue the chat",
  };

  return labels[normalized] || normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function getFrontDeskMissingSetupFields(agent = {}, setup = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const missing = [];
  const businessReadiness = operatorWorkspace.businessProfile?.readiness || {};
  const hasWebsite = setup.hasWebsite || isMeaningfulWebsite(agent.websiteUrl);

  if (!trimText(agent.assistantName || agent.name)) {
    missing.push("assistant name");
  }
  if (!trimText(agent.welcomeMessage)) {
    missing.push("welcome message");
  }
  if (!trimText(agent.tone)) {
    missing.push("tone");
  }
  if (!hasWebsite) {
    missing.push("website");
  }
  if (setup.knowledgeMissing) {
    missing.push("website knowledge");
  }

  normalizeOperatorArray(businessReadiness.missingSections, (value) => trimText(value))
    .filter(Boolean)
    .forEach((section) => missing.push(section.replace(/[_-]+/g, " ")));

  return [...new Set(missing)].slice(0, 6);
}

function getBusinessProfileContentSummary(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const profile = getBusinessProfileViewModel(operatorWorkspace);
  const filled = [
    ["business summary", profile.fields?.businessSummary],
    ["services", profile.fields?.services],
    ["pricing", profile.fields?.pricing],
    ["policies", profile.fields?.policies],
    ["service areas", profile.fields?.serviceAreas],
    ["hours", profile.fields?.operatingHours],
  ].filter(([, value]) => trimText(value));

  if (filled.length) {
    return `${filled.length} business profile area${filled.length === 1 ? "" : "s"} filled: ${filled.map(([label]) => label).join(", ")}.`;
  }

  if (profile.prefill?.available) {
    return profile.prefill.sourceSummary || `${profile.prefill.fieldCount || 0} safe suggestion${profile.prefill.fieldCount === 1 ? "" : "s"} ready for review.`;
  }

  return "No approved business profile summary is saved yet.";
}

// eslint-disable-next-line no-unused-vars
function buildImprovementsSection(frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue(), activeFrontDeskSection = "practice") {
  return dashboardFrontDeskHelpers.buildImprovementsSection(frontDeskTraining, actionQueue, activeFrontDeskSection);
}

function buildFrontDeskPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace(), frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue()) {
  return dashboardFrontDeskHelpers.buildFrontDeskPanel(agent, setup, operatorWorkspace, frontDeskTraining, actionQueue);
}

function buildInstallPanel(agent, setup, _operatorWorkspace = createEmptyOperatorWorkspace(), messages = [], actionQueue = createEmptyActionQueue()) {
  const actionsMarkup = [
    `<button class="ghost-button" type="button" data-action="verify-install" ${trimText(agent.installId) ? "" : "disabled"}>${escapeHtml(t("install.verifyInstallation"))}</button>`,
    `<button class="ghost-button" type="button" data-install-method-jump="page">${escapeHtml(t("install.viewFrontDeskPageSetup"))}</button>`,
  ].join("");

  return localizeDashboardHtml(`
    <section class="workspace-page" data-shell-section="install" hidden>
      ${buildPageHeader({
        title: t("install.title"),
        copy: t("install.publishFrontDeskPage"),
        actionsMarkup,
      })}
      <div class="workspace-page-body install-page-layout">
        <section class="workspace-card-soft install-page-main">
          ${buildInstallSection(agent, {
            upcoming: !setup.isReady,
            messages,
            actionQueue,
            setup,
          })}
        </section>
        ${buildInstallSidePanel(agent, setup, messages)}
      </div>
    </section>
  `);
}

function buildCustomizePanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace(), frontDeskTraining = createEmptyFrontDeskTraining(), actionQueue = createEmptyActionQueue()) {
  return buildFrontDeskPanel(agent, setup, operatorWorkspace, frontDeskTraining, actionQueue);
}

// Workspace sections
// eslint-disable-next-line no-unused-vars
function buildAppearanceStudio(agent) {
  return `
    <section class="workspace-panel" data-shell-section="appearance">
      <div class="workspace-panel-header">
        <h2 class="workspace-panel-title">Brand studio</h2>
        <p class="workspace-panel-copy">Shape how Vonza appears to your visitors so the experience feels polished, branded, and ready to represent your business.</p>
      </div>
      <form data-settings-form data-form-kind="appearance">
        <input name="system_prompt" type="hidden" value="${escapeHtml(agent.systemPrompt || "")}">
        <div class="studio-layout">
          <div class="studio-groups">
            <section class="studio-group">
              <p class="studio-kicker">Brand direction</p>
              <h3 class="studio-group-title">Choose the first impression your visitors feel.</h3>
              <p class="studio-group-copy">These quick starting points only adjust real current appearance settings like wording and colors. You can adjust every detail below.</p>
              <div class="preset-row">
                <button class="preset-chip" type="button" data-appearance-preset="clean">Clean</button>
                <button class="preset-chip" type="button" data-appearance-preset="bold">Bold</button>
                <button class="preset-chip" type="button" data-appearance-preset="minimal">Minimal</button>
              </div>
            </section>

            <section class="studio-group">
              <h3 class="studio-group-title">Assistant identity</h3>
              <p class="studio-group-copy">Set the name customers will associate with your business when the front desk appears on your site.</p>
              <div class="form-grid">
                <div class="field">
                  <label for="assistant-name">Assistant name</label>
                  <input id="assistant-name" name="assistant_name" type="text" value="${escapeHtml(agent.assistantName || agent.name)}">
                  <p class="field-help">Use the name you want customers to see on the Front Desk page and first interaction.</p>
                </div>
              </div>
            </section>

            <section class="studio-group">
              <h3 class="studio-group-title">Opening moment</h3>
              <p class="studio-group-copy">Refine the text that frames the first customer interaction and makes the front desk feel welcoming.</p>
              <div class="form-grid two-col">
                <div class="field">
                  <label for="assistant-button-label">Launcher text</label>
                  <input id="assistant-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}">
                  <p class="field-help">Keep this short, clear, and inviting.</p>
                </div>
                <div class="field">
                  <label for="assistant-welcome">Welcome message</label>
                  <textarea id="assistant-welcome" name="welcome_message">${escapeHtml(agent.welcomeMessage || "")}</textarea>
                  <p class="field-help">This becomes the first message visitors see when they open the front desk.</p>
                </div>
              </div>
            </section>

            <section class="studio-group">
              <h3 class="studio-group-title">Brand color system</h3>
              <p class="studio-group-copy">Use your primary and secondary colors so the front desk feels like a natural extension of your website.</p>
              <div class="form-grid two-col">
                <div class="field">
                  <label for="assistant-primary-color">Primary color</label>
                  <input id="assistant-primary-color" name="primary_color" type="color" value="${escapeHtml(agent.primaryColor || "#14b8a6")}">
                  <p class="field-help">Used for the strongest accents and primary brand moments.</p>
                </div>
                <div class="field">
                  <label for="assistant-secondary-color">Secondary color</label>
                  <input id="assistant-secondary-color" name="secondary_color" type="color" value="${escapeHtml(agent.secondaryColor || "#0f766e")}">
                  <p class="field-help">Used to support the main color and add depth to the widget feel.</p>
                </div>
              </div>
              <p class="section-note">More appearance controls like logo upload and richer Front Desk variants can come later. For now, Vonza uses your real live text and colors only.</p>
            </section>

            <div class="studio-save-row">
              <button class="primary-button" type="submit">Save appearance</button>
              <span data-save-state class="save-state">No changes yet.</span>
            </div>
          </div>

          <aside class="studio-summary">
            <p class="studio-summary-label">Live appearance preview</p>
            <h3 id="studio-summary-name" class="studio-summary-name">${escapeHtml(agent.assistantName || agent.name)}</h3>
            <p id="studio-summary-copy" class="studio-summary-copy">${escapeHtml(agent.welcomeMessage || "Your front desk is ready to greet visitors with a clear, helpful first message.")}</p>
            <div class="studio-summary-badge-row">
              <span id="studio-summary-tone" class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
              <span id="studio-summary-button" class="pill">${escapeHtml(agent.buttonLabel || "Chat")}</span>
            </div>
            <div class="studio-swatch-row">
              <div id="studio-swatch-primary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.primaryColor || "#14b8a6")}">Primary</div>
              <div id="studio-swatch-secondary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.secondaryColor || "#0f766e")}">Secondary</div>
            </div>
            <div class="brand-preview-shell">
              <div class="brand-preview-stage">
                <div class="brand-widget" id="brand-widget-preview">
                  <div class="brand-widget-header">
                    <div id="brand-widget-avatar" class="brand-widget-avatar" style="--brand-primary:${escapeHtml(agent.primaryColor || "#14b8a6")};--brand-secondary:${escapeHtml(agent.secondaryColor || "#0f766e")}">V</div>
                    <div>
                      <p id="brand-widget-title" class="brand-widget-title">${escapeHtml(agent.assistantName || agent.name)}</p>
                      <p class="brand-widget-subtitle">Your AI Front Desk</p>
                    </div>
                  </div>
                  <div id="brand-widget-message" class="brand-message">${escapeHtml(agent.welcomeMessage || "Welcome. I’m here to answer questions, route ready visitors to the right next step, and capture follow-up when needed.")}</div>
                  <div class="brand-cta-row">
                    <span class="brand-cta-note">This preview reflects the real name, opening message, launcher text, and brand colors you support today.</span>
                    <div id="brand-launcher" class="brand-launcher" style="--brand-primary:${escapeHtml(agent.primaryColor || "#14b8a6")};--brand-secondary:${escapeHtml(agent.secondaryColor || "#0f766e")}">
                      <span class="brand-launcher-dot"></span>
                      <span id="brand-launcher-label">${escapeHtml(agent.buttonLabel || "Chat")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </section>
  `;
}

function _buildConfigurationStudio(agent, setup) {
  const knowledgeActionLabel = setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge";

  return `
    <section class="workspace-panel" data-shell-section="configuration" hidden>
      <div class="workspace-panel-header">
        <h2 class="workspace-panel-title">Business behavior</h2>
        <p class="workspace-panel-copy">Shape how Vonza handles front-desk conversations, what it should emphasize, and which website knowledge and routing setup it should rely on.</p>
      </div>
      <form data-settings-form data-form-kind="configuration">
        <div class="workspace-section-stack">
          <section class="workspace-card-soft">
            <p class="studio-kicker">Behavior preset</p>
            <h3 class="studio-group-title">Choose the kind of customer conversation you want Vonza to lead.</h3>
            <p class="studio-group-copy">These quick starting points only shape real existing controls like tone and advanced guidance. You can still edit them manually right after.</p>
            <div class="preset-row">
              <button class="preset-chip" type="button" data-configuration-preset="general">General business assistant</button>
              <button class="preset-chip" type="button" data-configuration-preset="sales">Sales assistant</button>
              <button class="preset-chip" type="button" data-configuration-preset="support">Customer support</button>
            </div>
          </section>

          <section class="workspace-card-soft">
            <h3 class="studio-group-title">How Vonza sounds</h3>
            <p class="studio-group-copy">Choose the style customers should feel in the first few messages and throughout the conversation.</p>
            <div class="behavior-mode-grid">
              <label class="behavior-mode-card ${agent.tone === "friendly" ? "active" : ""}" data-tone-card="friendly">
                <input type="radio" name="tone" value="friendly" ${agent.tone === "friendly" ? "checked" : ""}>
                <p class="behavior-mode-title">Friendly</p>
                <p class="behavior-mode-copy">Warm, welcoming, and approachable without sounding casual or unstructured.</p>
              </label>
              <label class="behavior-mode-card ${agent.tone === "professional" ? "active" : ""}" data-tone-card="professional">
                <input type="radio" name="tone" value="professional" ${agent.tone === "professional" ? "checked" : ""}>
                <p class="behavior-mode-title">Professional</p>
                <p class="behavior-mode-copy">Clear, calm, and polished for businesses that want a more formal brand voice.</p>
              </label>
              <label class="behavior-mode-card ${agent.tone === "sales" ? "active" : ""}" data-tone-card="sales">
                <input type="radio" name="tone" value="sales" ${agent.tone === "sales" ? "checked" : ""}>
                <p class="behavior-mode-title">Sales-focused</p>
                <p class="behavior-mode-copy">Helpful and persuasive, with more emphasis on services, value, and moving visitors forward.</p>
              </label>
              <label class="behavior-mode-card ${agent.tone === "support" ? "active" : ""}" data-tone-card="support">
                <input type="radio" name="tone" value="support" ${agent.tone === "support" ? "checked" : ""}>
                <p class="behavior-mode-title">Support-focused</p>
                <p class="behavior-mode-copy">Reassuring and solution-oriented, designed to reduce friction and answer practical questions clearly.</p>
              </label>
            </div>
          </section>

          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Website knowledge</h3>
            <p class="studio-group-copy">This is the website Vonza should represent and learn from when answering customer questions.</p>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-website">Website URL</label>
                <input id="assistant-website" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}">
                <p class="field-help">Use the main public website your customers actually visit.</p>
              </div>
            </div>
            <div class="inline-actions">
              <button class="ghost-button" type="button" data-action="import-knowledge" ${setup.knowledgeState === "limited" ? 'data-import-force="true"' : ""}>${knowledgeActionLabel}</button>
            </div>
            <p class="section-note">${escapeHtml(setup.knowledgeDescription)}</p>
          </section>

          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Advanced guidance</h3>
            <p class="studio-group-copy">Use this to tell Vonza what to emphasize, how direct it should be, or what it should avoid. Keep it focused and business-facing.</p>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-instructions">Advanced guidance</label>
                <textarea id="assistant-instructions" name="system_prompt">${escapeHtml(agent.systemPrompt || "")}</textarea>
                <p class="field-help">For example: highlight premium service, stay concise, avoid sounding pushy, or guide pricing questions toward a quote.</p>
              </div>
            </div>
          </section>

          <section class="workspace-card-soft">
            <div class="behavior-summary">
              <p class="behavior-summary-label">How Vonza will respond</p>
              <h3 id="behavior-summary-title" class="behavior-summary-title">A calm, helpful business assistant.</h3>
              <p id="behavior-summary-copy" class="behavior-summary-copy">Right now, Vonza is set up to answer customer questions in a clear way using your website as the source of truth.</p>
            </div>
          </section>

          <section class="workspace-card-soft">
            <div class="guidance-card">
              <h3 class="studio-group-title">What this setup is designed for</h3>
              <p class="studio-group-copy">Vonza works best when your website clearly explains your business, services, and next steps.</p>
              <div class="guidance-list">
                <div class="guidance-item">Grounded in your website, not in a separate knowledge system.</div>
                <div class="guidance-item">Answers best when website knowledge is strong and up to date.</div>
                <div class="guidance-item">Approval-first automations draft work for review instead of silently sending on their own.</div>
              </div>
            </div>
          </section>

          <div class="studio-save-row">
            <button class="primary-button" type="submit">Save behavior</button>
            <span data-save-state class="save-state">No changes yet.</span>
          </div>
        </div>
      </form>
    </section>
  `;
}

function _getActivityLevel(messageCount, lastMessageAt) {
  if (!messageCount) {
    return {
      label: "Just getting started",
      description: "There is not enough conversation activity yet to show a clear pattern.",
    };
  }

  if (lastMessageAt) {
    const lastMessageDate = new Date(lastMessageAt);
    const hoursSinceLastMessage = Number.isFinite(lastMessageDate.getTime())
      ? (Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60)
      : null;

    if (hoursSinceLastMessage !== null && hoursSinceLastMessage <= 24 && messageCount >= 6) {
      return {
        label: "Active recently",
        description: "Customers have been using the assistant recently, which is a good sign that it is visible and useful.",
      };
    }

    if (hoursSinceLastMessage !== null && hoursSinceLastMessage <= 72 && messageCount >= 3) {
      return {
        label: "Steady early activity",
        description: "You are seeing real usage, with fresh conversations in the last few days.",
      };
    }
  }

  return {
    label: "Light activity",
    description: "The assistant has some conversation history, but there is still room to build usage and repeat visits.",
  };
}

function categorizeIntent(message) {
  const normalized = trimText(String(message || "")).toLowerCase();

  if (!normalized) {
    return "general";
  }

  if (
    normalized.includes("book")
    || normalized.includes("booking")
    || normalized.includes("appointment")
    || normalized.includes("schedule")
    || normalized.includes("availability")
    || normalized.includes("calendar")
    || normalized.includes("reserve")
    || normalized.includes("consultation")
    || normalized.includes("consult")
    || normalized.includes("meeting")
    || normalized.includes("demo")
  ) {
    return "booking";
  }

  if (
    normalized.includes("price")
    || normalized.includes("pricing")
    || normalized.includes("cost")
    || normalized.includes("quote")
    || normalized.includes("fee")
    || normalized.includes("buy")
    || normalized.includes("purchase")
    || normalized.includes("plan")
    || normalized.includes("package")
    || normalized.includes("how much")
  ) {
    return "pricing";
  }

  if (
    normalized.includes("problem")
    || normalized.includes("issue")
    || normalized.includes("broken")
    || normalized.includes("not working")
    || normalized.includes("complaint")
    || normalized.includes("refund")
    || normalized.includes("cancel")
    || normalized.includes("unhappy")
    || normalized.includes("support")
    || normalized.includes("frustrated")
    || normalized.includes("late")
  ) {
    return "support";
  }

  if (
    normalized.includes("contact")
    || normalized.includes("reach")
    || normalized.includes("call")
    || normalized.includes("email")
    || normalized.includes("phone")
    || normalized.includes("talk to")
    || normalized.includes("speak to")
    || normalized.includes("get in touch")
    || normalized.includes("someone")
  ) {
    return "contact";
  }

  if (
    normalized.includes("service")
    || normalized.includes("offer")
    || normalized.includes("product")
    || normalized.includes("help with")
    || normalized.includes("do you do")
    || normalized.includes("what do you do")
  ) {
    return "services";
  }

  return "general";
}

function normalizeQuestion(message) {
  return trimText(String(message || ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyPattern(text = "", patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function getQuestionSummaryLanguage(text = "") {
  return includesAnyPattern(text, [
    /\b(mennyibe|ara|arak|arajanlat|ára|árak|árajánlat|idopont|időpont|foglal|elerheto|elérhető|kapcsolat|telefon|hiv|hív|webaruhaz|webáruház|szallitas|szállítás|szolgaltatas|szolgáltatás|nyitva|vallal|vállal|szabad)\b/i,
    /[áéíóöőúüű]/i,
  ])
    ? "hu"
    : "en";
}

function localizeQuestionSummary(language = "en", english = "", hungarian = "") {
  return language === "hu" ? hungarian : english;
}

function summarizeCustomerQuestionIntent(message = "") {
  const text = trimText(String(message || "")).toLowerCase();
  const language = getDashboardLanguage() || getQuestionSummaryLanguage(text);

  if (!text) {
    return localizeQuestionSummary(language, "Trying to clarify the next customer-service step", "A következő ügyfélszolgálati lépést próbálja tisztázni");
  }

  if (includesAnyPattern(text, [/\b(contact|reach|call|email|phone|talk to|speak to|get in touch|someone)\b/i, /\b(kapcsolat|telefon|email|e-mail|hiv|hivni|eler|elerni|beszelni)\b/i])) {
    return localizeQuestionSummary(language, "Asking how to contact the business directly", "Közvetlen kapcsolatfelvételi lehetőséget keres");
  }

  if (includesAnyPattern(text, [/\b(price|pricing|cost|quote|estimate|fee|how much|package|plan)\b/i, /\b(ar|arak|ara|arajanlat|mennyibe|koltseg|dij|csomag)\b/i])) {
    return localizeQuestionSummary(language, "Requesting pricing or quote details", "Árakat vagy árajánlat részleteit kéri");
  }

  if (includesAnyPattern(text, [/\b(book|booking|appointment|schedule|availability|reserve|consultation|available)\b/i, /\b(idopont|foglal|foglalo|bejelentkez|szabad|elerheto|konzultacio)\b/i])) {
    return localizeQuestionSummary(language, "Looking for booking or availability", "Időpontot vagy elérhetőséget keres");
  }

  if (includesAnyPattern(text, [/\b(webshop|online store|ecommerce|e-commerce|cart|checkout|order online|purchase online)\b/i, /\b(webaruhaz|webshop|online rendeles|kosar|rendeles|online vasarlas)\b/i])) {
    return localizeQuestionSummary(language, "Asking about webshop options and next steps", "Webáruház lehetőségekről és következő lépésekről érdeklődik");
  }

  if (includesAnyPattern(text, [/\b(delivery|shipping|ship|turnaround|lead time|how long|when can|arrival|deliver)\b/i, /\b(szallitas|kiszallitas|mennyi ido|mikor|hatarido|erkezik|atfutas)\b/i])) {
    return localizeQuestionSummary(language, "Looking for delivery timing or service turnaround", "Szállítási vagy teljesítési időt keres");
  }

  if (includesAnyPattern(text, [/\b(open|hours|opening|closed|holiday|weekend)\b/i, /\b(nyitva|nyitvatartas|zarva|hetvege|unnepnap)\b/i])) {
    return localizeQuestionSummary(language, "Checking opening hours or customer-service availability", "Nyitvatartást vagy ügyfélszolgálati elérhetőséget ellenőriz");
  }

  if (includesAnyPattern(text, [/\b(location|address|near|area|serve|service area|where are)\b/i, /\b(cim|helyszin|kozel|terulet|kiszall|hol|varos)\b/i])) {
    return localizeQuestionSummary(language, "Checking location or service-area coverage", "Helyszínt vagy kiszolgálási területet ellenőriz");
  }

  if (includesAnyPattern(text, [/\b(service|services|offer|provide|help with|do you do|which service|fit my needs|product)\b/i, /\b(szolgaltatas|kinal|vallal|miben tud|melyik szolgaltatas|termek)\b/i])) {
    return localizeQuestionSummary(language, "Checking whether the business offers a specific service", "Azt ellenőrzi, hogy elérhető-e egy konkrét szolgáltatás");
  }

  if (includesAnyPattern(text, [/\b(cancel|refund|warranty|guarantee|return|policy|problem|issue|support)\b/i, /\b(lemondas|visszaterites|garancia|problema|hiba|panasz|segitseg)\b/i])) {
    return localizeQuestionSummary(language, "Looking for help with a support or policy issue", "Támogatásra vagy szabályzati kérdésre keres választ");
  }

  return localizeQuestionSummary(language, "Trying to understand which service fits their needs", "Azt próbálja tisztázni, melyik szolgáltatás illik az igényeihez");
}

function getQuestionThemeLabel(question, intent = "general") {
  return summarizeCustomerQuestionIntent(question || intent);
}

function getWeakAnswerThemeLabel(question, intent = "general") {
  const theme = getQuestionThemeLabel(question, intent);

  switch (theme) {
    case "Asking how to contact the business directly":
      return "Customers need a clearer contact path";
    case "Looking for booking or availability":
      return "Booking guidance needs a stronger next step";
    case "Requesting pricing or quote details":
      return "Pricing questions need clearer answers";
    case "Checking opening hours or customer-service availability":
      return "Hours and availability need clearer answers";
    case "Checking location or service-area coverage":
      return "Location or service-area answers need improvement";
    case "Looking for help with a support or policy issue":
      return "Support concerns need stronger guidance";
    case "Checking whether the business offers a specific service":
    case "Trying to understand which service fits their needs":
      return "Service explanations are too vague";
    default:
      return theme ? `${theme} need clearer answers` : "Weak-answer theme needs review";
  }
}

function getIntentLabel(intent) {
  switch (intent) {
    case "contact":
      return "Lead / contact";
    case "booking":
      return "Booking";
    case "pricing":
      return "Pricing / purchase";
    case "support":
      return "Support / complaint";
    case "services":
      return "Services";
    default:
      return "Customer-service context";
  }
}

function getMessageTimestamp(message) {
  const value = new Date(message?.createdAt || "").getTime();
  return Number.isFinite(value) ? value : 0;
}

function getMessagesChronologically(messages) {
  return [...messages].sort((left, right) => getMessageTimestamp(left) - getMessageTimestamp(right));
}

function hasWeakAssistantReply(reply) {
  const normalized = trimText(String(reply || "")).toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    "i don't know",
    "i do not know",
    "i'm not sure",
    "i am not sure",
    "i don't have",
    "i do not have",
    "i couldn't find",
    "i could not find",
    "i can't find",
    "i cannot find",
    "not available on the website",
    "not mentioned on the website",
    "not provided on the website",
    "please contact the business directly",
    "please reach out directly",
    "reach out to the business directly",
  ].some((snippet) => normalized.includes(snippet));
}

function createEmptyIntentCounts() {
  return {
    general: 0,
    services: 0,
    pricing: 0,
    contact: 0,
    booking: 0,
    support: 0,
  };
}

function getUsageTrend(userMessages) {
  if (!userMessages.length) {
    return {
      label: "No real customer usage yet",
      copy: "Once visitors start using the front desk on a live site, Vonza will show what they ask about and which conversations need help.",
      recentCount: 0,
      previousCount: 0,
    };
  }

  const now = Date.now();
  const recentWindowStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWindowStart = now - 14 * 24 * 60 * 60 * 1000;
  let recentCount = 0;
  let previousCount = 0;
  let timestampedCount = 0;

  userMessages.forEach((message) => {
    const timestamp = getMessageTimestamp(message);

    if (!timestamp) {
      return;
    }

    timestampedCount += 1;

    if (timestamp >= recentWindowStart) {
      recentCount += 1;
      return;
    }

    if (timestamp >= previousWindowStart) {
      previousCount += 1;
    }
  });

  if (recentCount > 0 && previousCount === 0) {
    return {
      label: "First real usage is coming in",
      copy: `${recentCount} visitor question${recentCount === 1 ? "" : "s"} came in during the last 7 days.`,
      recentCount,
      previousCount,
    };
  }

  if (recentCount > previousCount) {
    return {
      label: "Usage is increasing",
      copy: `${recentCount} recent visitor question${recentCount === 1 ? "" : "s"} versus ${previousCount} in the previous 7-day window.`,
      recentCount,
      previousCount,
    };
  }

  if (recentCount > 0 && recentCount === previousCount) {
    return {
      label: "Usage is steady",
      copy: `${recentCount} visitor question${recentCount === 1 ? "" : "s"} came in during both recent 7-day windows.`,
      recentCount,
      previousCount,
    };
  }

  if (previousCount > recentCount) {
    return {
      label: "Usage slowed recently",
      copy: `${recentCount} visitor question${recentCount === 1 ? "" : "s"} arrived in the last 7 days versus ${previousCount} in the previous window.`,
      recentCount,
      previousCount,
    };
  }

  if (timestampedCount === 0) {
    return {
      label: "Early signal only",
      copy: `${userMessages.length} visitor question${userMessages.length === 1 ? "" : "s"} have been captured, but there is not enough dated history yet to show a time trend.`,
      recentCount: userMessages.length,
      previousCount: 0,
    };
  }

  return {
    label: "Early signal only",
    copy: "There is some conversation history, but not enough recent live usage to show a stronger trend yet.",
    recentCount,
    previousCount,
  };
}

function analyzeConversationSignals(messages) {
  const chronologicalMessages = getMessagesChronologically(messages);
  const userMessages = chronologicalMessages.filter((message) => message.role === "user" && trimText(message.content || ""));
  const intentCounts = createEmptyIntentCounts();
  const questionThemes = new Map();
  const weakAnswerExamples = [];
  let weakAnswerCount = 0;

  userMessages.forEach((message) => {
    const content = trimText(message.content || "");
    const intent = categorizeIntent(content);
    const normalizedQuestion = normalizeQuestion(content);
    const questionThemeLabel = getQuestionThemeLabel(content, intent);
    intentCounts[intent] += 1;

    if (!normalizedQuestion || !questionThemeLabel) {
      return;
    }

    const themeKey = normalizeQuestion(questionThemeLabel);
    const existing = questionThemes.get(themeKey) || {
      label: questionThemeLabel,
      count: 0,
      intent,
    };

    existing.count += 1;
    questionThemes.set(themeKey, existing);
  });

  chronologicalMessages.forEach((message, index) => {
    if (message.role !== "user") {
      return;
    }

    const question = trimText(message.content || "");
    if (!question) {
      return;
    }

    let reply = "";

    for (let cursor = index + 1; cursor < chronologicalMessages.length; cursor += 1) {
      const nextMessage = chronologicalMessages[cursor];

      if (nextMessage.role === "user") {
        break;
      }

      if (nextMessage.role === "assistant") {
        reply = trimText(nextMessage.content || "");
        break;
      }
    }

    if (!hasWeakAssistantReply(reply)) {
      return;
    }

    weakAnswerCount += 1;
    if (weakAnswerExamples.length < 4) {
      const weakAnswerTheme = getWeakAnswerThemeLabel(question, categorizeIntent(question));
      if (weakAnswerTheme && !weakAnswerExamples.includes(weakAnswerTheme)) {
        weakAnswerExamples.push(weakAnswerTheme);
      }
    }
  });

  const topQuestions = [...questionThemes.values()]
    .sort((left, right) => right.count - left.count || left.label.length - right.label.length)
    .slice(0, 4);
  const topIntentEntries = Object.entries(intentCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const recentQuestions = [...userMessages]
    .slice(-3)
    .reverse()
    .map((message) => summarizeCustomerQuestionIntent(message.content || ""))
    .filter(Boolean);
  const highValueIntentCount =
    intentCounts.contact + intentCounts.booking + intentCounts.pricing + intentCounts.support;
  const usageTrend = getUsageTrend(userMessages);

  return {
    userMessages,
    userMessageCount: userMessages.length,
    recentQuestions,
    topQuestions,
    intentCounts,
    topIntentEntries,
    highValueIntentCount,
    weakAnswerCount,
    weakAnswerExamples,
    usageTrend,
  };
}

function createEmptyActionQueue() {
  return {
    items: [],
    people: [],
    peopleSummary: {
      total: 0,
      returning: 0,
      linkedQueueItems: 0,
    },
    summary: {
      total: 0,
      new: 0,
      reviewed: 0,
      done: 0,
      dismissed: 0,
      followUpNeeded: 0,
      followUpCompleted: 0,
      resolved: 0,
      attentionNeeded: 0,
    },
    conversionSummary: {
      highIntentConversations: 0,
      capturePromptsShown: 0,
      contactsCaptured: 0,
      captureRate: 0,
      followUpsPrepared: 0,
      followUpsSent: 0,
      pricingCaptures: 0,
      bookingCaptures: 0,
      directCtasShown: 0,
      ctaClicks: 0,
      ctaClickThroughRate: 0,
      bookingDirectHandoffs: 0,
      quoteDirectHandoffs: 0,
      contactDirectHandoffs: 0,
      checkoutDirectHandoffs: 0,
      followUpFallbackCount: 0,
      directRouteCount: 0,
      captureFallbackCount: 0,
      assistedConversions: 0,
      confirmedBusinessOutcomes: 0,
      directOutcomeCount: 0,
      followUpAssistedOutcomeCount: 0,
    },
    outcomeSummary: {
      total: 0,
      assistedConversions: 0,
      confirmedBusinessOutcomes: 0,
      directOutcomeCount: 0,
      followUpAssistedOutcomeCount: 0,
      bookingStarted: 0,
      bookingConfirmed: 0,
      bookingCompleted: 0,
      quoteRequested: 0,
      quoteSent: 0,
      quoteAccepted: 0,
      checkoutStarted: 0,
      checkoutCompleted: 0,
      contactClicked: 0,
      emailClicked: 0,
      phoneClicked: 0,
      followUpSent: 0,
      followUpReplied: 0,
      complaintOpened: 0,
      complaintResolved: 0,
      campaignSent: 0,
      campaignReplied: 0,
      campaignConverted: 0,
      manualMarked: 0,
      directVsFollowUpSplit: {
        direct: 0,
        followUp: 0,
        operator: 0,
        manual: 0,
      },
      pathCounts: {
        directRoute: 0,
        followUpAssisted: 0,
        inboxThread: 0,
        calendarBooking: 0,
        campaign: 0,
        manualOwner: 0,
      },
      topPages: [],
      topIntents: [],
    },
    recentOutcomes: [],
    recentLeadCaptures: [],
    humanFollowUps: {
      available: true,
      migrationRequired: false,
      summary: {
        total: 0,
        open: 0,
        highPriority: 0,
        new: 0,
        reviewing: 0,
        replied: 0,
        follow_up_later: 0,
        dismissed: 0,
      },
      items: [],
      topItems: [],
      emptyState: "No customers need a human reply right now.",
    },
    ownerNotifications: {
      records: [],
      summary: {
        unread: 0,
        read: 0,
        dismissed: 0,
        active: 0,
        total: 0,
      },
      persistenceAvailable: true,
    },
    persistenceAvailable: true,
    migrationRequired: false,
    followUpWorkflowAvailable: true,
    followUpWorkflowMigrationRequired: false,
    knowledgeFixWorkflowAvailable: true,
    knowledgeFixWorkflowMigrationRequired: false,
    liveConversionAvailable: true,
    liveConversionMigrationRequired: false,
    analyticsSummary: createEmptyAnalyticsSummary(),
    ownerAnalyticsDashboard: null,
  };
}

function createEmptyOperatorWorkspace() {
  return {
    enabled: isOperatorWorkspaceFlagEnabled(),
    featureEnabled: isOperatorWorkspaceFlagEnabled(),
    status: {
      enabled: isOperatorWorkspaceFlagEnabled(),
      featureEnabled: isOperatorWorkspaceFlagEnabled(),
      googleConfigReady: true,
      googleConnectReady: true,
      googleConnected: false,
      googleCapabilities: normalizeGoogleCapabilities(),
      persistenceAvailable: true,
      migrationRequired: false,
      syncRequested: false,
    },
    activation: {
      operatorWorkspaceEnabled: isOperatorWorkspaceFlagEnabled(),
      googleConnected: false,
      inboxContextSelected: false,
      calendarContextSelected: false,
      inboxSynced: false,
      calendarSynced: false,
      firstInboxReviewCompleted: false,
      firstReplyDraftCreated: false,
      firstCampaignDraftCreated: false,
      firstCalendarActionReviewed: false,
      activationCompletedAt: null,
      checklist: [],
      completedCount: 0,
      totalCount: 0,
      isComplete: false,
      metadata: {},
    },
    briefing: {
      title: "Home briefing",
      text: "Calendar context is beta. Home, Customers, Front Desk, and Analytics are ready without it.",
    },
    nextAction: {
      key: "connect_google",
      title: "Connected tools beta",
      description: "Email, Calendar, and Automations are not ready to use from the dashboard yet.",
      buttonLabel: "Beta",
      actionType: "connect_google",
      targetSection: "overview",
      disabled: true,
    },
    today: {
      messagesToday: 0,
      contactsDealtToday: 0,
      outcomesToday: 0,
      needsAttentionCount: 0,
      inboxNeedingAttention: 0,
      complaintsNeedingReview: 0,
      supportNeedingReview: 0,
      leadsNeedingAction: 0,
      campaignsAwaitingApproval: 0,
      followUpsAwaitingApproval: 0,
      activeCampaigns: 0,
      upcomingBookings: 0,
      appointmentsNeedingReview: 0,
      appointmentsNeedingFollowUp: 0,
      unlinkedAppointments: 0,
      nextEventTitle: "",
      nextEventAt: null,
      openAvailabilityCount: 0,
      campaignCount: 0,
      followUpCount: 0,
      assistedOutcomes: 0,
      bookingsStarted: 0,
      bookingsConfirmed: 0,
      quoteRequests: 0,
      followUpReplies: 0,
      complaintResolutions: 0,
      campaignReplies: 0,
      campaignConversions: 0,
      directVsFollowUpSplit: {
        direct: 0,
        followUp: 0,
        operator: 0,
        manual: 0,
      },
      recentSuccessfulOutcomes: [],
      contactsWithProgression: 0,
      highValueWithoutOutcome: 0,
      contactsNeedingAttention: 0,
      complaintRiskContacts: 0,
      leadsWithoutNextStep: 0,
      customersAwaitingFollowUp: 0,
      lifecycleCounts: {
        new: 0,
        activeLead: 0,
        qualified: 0,
        customer: 0,
        supportIssue: 0,
        complaintRisk: 0,
        dormant: 0,
      },
      overdueHighValueContacts: 0,
      topTask: "",
    },
    copilot: {
      enabled: false,
      featureEnabled: false,
      readOnly: true,
      draftOnly: true,
      autonomousActionsEnabled: false,
      sparseData: true,
      headline: "",
      summary: "",
      questions: [],
      summaryCards: [],
      recommendedNextActionId: "",
      answers: [],
      recommendations: [],
      drafts: [],
      proposals: [],
      proposalSummary: {
        activeCount: 0,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        sourceCounts: {
          messages: 0,
          actionQueueItems: 0,
          contacts: 0,
          followUps: 0,
          knowledgeFixes: 0,
          recentOutcomes: 0,
          widgetEvents: 0,
          calendarEvents: 0,
        },
        businessProfile: {
          readiness: {
            totalSections: 0,
            completedSections: 0,
            missingCount: 0,
            missingSections: [],
            summary: "",
          },
        },
        warnings: [],
      },
      fallback: {
        title: "",
        description: "",
        guidance: [],
      },
    },
    businessProfile: createEmptyBusinessProfileState(),
    contextOptions: {
      mailboxes: [
        {
          value: "INBOX",
          label: "Primary inbox",
          description: "Sync the main inbox first.",
        },
      ],
      calendars: [
        {
          value: "primary",
          label: "Primary calendar",
          description: "Use the main Google calendar.",
        },
      ],
    },
    health: {
      inboxSyncError: "",
      calendarSyncError: "",
      contactsError: "",
      globalError: "",
    },
    connectedAccounts: [],
    inbox: {
      threads: [],
      attentionCount: 0,
    },
    calendar: {
      events: [],
      suggestedSlots: [],
      dailySummary: "Calendar context is beta. Home works without it for now.",
      missedBookingOpportunities: [],
      scheduleItems: [],
      reviewItems: [],
      followUpItems: [],
      unlinkedItems: [],
      syncMode: "disconnected",
    },
    automations: {
      tasks: [],
      campaigns: [],
      followUps: [],
    },
    billing: {
      planKey: "",
      displayName: "",
      monthlyPriceCents: 0,
      monthlyPriceUsd: 0,
      monthlyPriceLabel: "",
      billingInterval: "",
      includedAiBudgetCents: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      subscriptionStatus: "pending",
      hasActiveSubscription: false,
      usage: {
        usedCents: 0,
        includedCents: 0,
        remainingCents: 0,
        percentUsed: 0,
        warningState: "normal",
        warningThreshold: 0,
        tone: "ok",
        statusLabel: "",
        ownerMessage: "",
        isCapped: false,
      },
      upgradeOptions: [],
    },
    outcomes: {
      summary: null,
      recentOutcomes: [],
      persistenceAvailable: true,
    },
    contacts: {
      list: [],
      filters: {
        quick: [],
        sources: [],
      },
      summary: {
        totalContacts: 0,
        contactsNeedingAttention: 0,
        complaintRiskContacts: 0,
        leadsWithoutNextStep: 0,
        customersAwaitingFollowUp: 0,
        contactsWithOutcomes: 0,
        highValueWithoutOutcome: 0,
        lifecycleCounts: {
          new: 0,
          activeLead: 0,
          qualified: 0,
          customer: 0,
          supportIssue: 0,
          complaintRisk: 0,
          dormant: 0,
        },
      },
      health: {
        persistenceAvailable: true,
        migrationRequired: false,
        loadError: "",
        partialData: false,
      },
    },
    summary: {
      inboxNeedingAttention: 0,
      complaintQueue: 0,
      activeCampaigns: 0,
      followUpsNeedingApproval: 0,
      pendingCalendarApprovals: 0,
      overdueThreads: 0,
      upcomingBookings: 0,
      openAvailabilityCount: 0,
      operatorLoad: 0,
    },
  };
}

function createEmptyAnalyticsSummary() {
  return {
    ready: true,
    syncState: "ready",
    diagnosticsMessage: "",
    conversationCount: 0,
    uniqueVisitorCount: 0,
    totalMessages: 0,
    visitorQuestions: 0,
    highIntentSignals: 0,
    directCtasShown: 0,
    ctaClicks: 0,
    ctaClickThroughRate: 0,
    contactsCaptured: 0,
    assistedOutcomes: 0,
    weakAnswerCount: 0,
    attentionNeeded: 0,
    lastMessageAt: null,
    customerQuestionSummaries: [],
    recentActivity: {
      level: "none",
      description: "No live activity yet",
      copy: "No live conversations have been stored yet.",
      lastActivityAt: null,
    },
    operatorSignal: {
      title: "No service signal yet",
      copy: "There is not a strong lead, booking, pricing, or support signal yet.",
      subtle: "No weak-answer signal has been detected yet.",
    },
  };
}

function createEmptyOwnerAnalyticsDashboard() {
  const emptyAssistantSource = {
    widget: {
      key: "widget",
      label: "Website widget",
      conversationCount: 0,
      messageCount: 0,
      visitorQuestionCount: 0,
      leadsCaptured: 0,
    },
    page: {
      key: "page",
      label: "Front Desk page",
      conversationCount: 0,
      messageCount: 0,
      visitorQuestionCount: 0,
      leadsCaptured: 0,
    },
    embedded: {
      key: "embedded",
      label: "Embedded assistant",
      conversationCount: 0,
      messageCount: 0,
      visitorQuestionCount: 0,
      leadsCaptured: 0,
    },
    web_call: {
      key: "web_call",
      label: "Web Call",
      conversationCount: 0,
      messageCount: 0,
      visitorQuestionCount: 0,
      leadsCaptured: 0,
    },
    unknown: {
      key: "unknown",
      label: "Legacy/unknown",
      conversationCount: 0,
      messageCount: 0,
      visitorQuestionCount: 0,
      leadsCaptured: 0,
    },
    totalConversations: 0,
    totalMessages: 0,
  };

  return {
    ok: false,
    metrics: {
      totalConversations: 0,
      leadsCaptured: 0,
      conversionRate: 0,
    },
    assistantSource: emptyAssistantSource,
    topVisitorQuestions: [],
    missedQuestions: [],
    customerSatisfaction: {
      totalFeedback: 0,
      helpful: 0,
      notHelpful: 0,
      negativeRate: 0,
      unhappyAnswers: [],
      weakTopics: [],
      recoveryActions: [],
      persistenceAvailable: true,
    },
    knowledgeImprovement: {
      title: "Knowledge Improvement",
      copy: "No weak-answer pattern is active yet.",
      total: 0,
      openCount: 0,
      approvedFixedCount: 0,
      dismissedCount: 0,
      guardrail: "Approved guidance must stay grounded in verified business facts.",
      items: [],
    },
    notifications: [],
    aiUsage: null,
    webCallHealth: {
      available: true,
      starts: 0,
      endedCalls: 0,
      averageDurationSeconds: 0,
      averageTurns: 0,
      contactFallbackSubmissions: 0,
      failureCounts: {},
      failureCategories: [],
      failureTotal: 0,
      latestActivityAt: null,
    },
    webCallRecentCalls: {
      available: true,
      total: 0,
      calls: [],
    },
  };
}

function normalizeAssistantSourceBucket(bucket = {}, fallback = {}) {
  const source = bucket && typeof bucket === "object" ? bucket : {};

  return {
    ...fallback,
    ...source,
    key: trimText(source.key || fallback.key),
    label: trimText(source.label || fallback.label),
    conversationCount: Number(source.conversationCount || 0),
    messageCount: Number(source.messageCount || 0),
    visitorQuestionCount: Number(source.visitorQuestionCount || 0),
    leadsCaptured: Number(source.leadsCaptured || 0),
  };
}

function isSafeWebCallFailureCategory(value = "") {
  const normalized = trimText(value).toLowerCase();
  return Boolean(normalized) && normalized.length <= 64 && /^[a-z0-9_]+$/.test(normalized);
}

function formatWebCallFailureCategoryLabel(category = "") {
  return trimText(category)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeRecentWebCallRecord(call = {}) {
  const source = call && typeof call === "object" ? call : {};
  const action = source.action && typeof source.action === "object" ? source.action : null;
  const review = source.review && typeof source.review === "object" ? source.review : {};

  return {
    id: trimText(source.id),
    actionKey: trimText(source.actionKey || source.action_key),
    webCallId: trimText(source.webCallId || source.web_call_id),
    sessionKey: trimText(source.sessionKey || source.session_key),
    latestMessageId: trimText(source.latestMessageId || source.latest_message_id),
    latestAssistantMessageId: trimText(source.latestAssistantMessageId || source.latest_assistant_message_id),
    latestQuestion: trimText(source.latestQuestion || source.latest_question),
    latestAnswer: trimText(source.latestAnswer || source.latest_answer),
    contactId: trimText(source.contactId || source.contact_id),
    startedAt: source.startedAt || source.started_at || null,
    latestActivityAt: source.latestActivityAt || source.latest_activity_at || null,
    durationSeconds: source.durationSeconds === null || source.durationSeconds === undefined
      ? null
      : Math.max(0, Number(source.durationSeconds || source.duration_seconds || 0)),
    turnCount: source.turnCount === null || source.turnCount === undefined
      ? null
      : Math.max(0, Number(source.turnCount || source.turn_count || 0)),
    contactFallbackOpened: source.contactFallbackOpened === true || source.contact_fallback_opened === true,
    contactFallbackSubmitted: source.contactFallbackSubmitted === true || source.contact_fallback_submitted === true,
    hadFailures: source.hadFailures === true || source.had_failures === true,
    failureCategories: Array.isArray(source.failureCategories || source.failure_categories)
      ? (source.failureCategories || source.failure_categories)
          .map((category) => trimText(category).toLowerCase())
          .filter((category) => isSafeWebCallFailureCategory(category))
      : [],
    failureCategoryLabels: Array.isArray(source.failureCategoryLabels || source.failure_category_labels)
      ? (source.failureCategoryLabels || source.failure_category_labels).map((label) => trimText(label)).filter(Boolean).slice(0, 8)
      : [],
    messages: Array.isArray(source.messages)
      ? source.messages.map((message) => ({
          id: trimText(message.id),
          role: trimText(message.role).toLowerCase() === "assistant" ? "assistant" : "user",
          content: trimText(message.content),
          createdAt: message.createdAt || message.created_at || null,
        })).filter((message) => message.content).slice(-16)
      : [],
    review: {
      status: trimText(review.status || "new") || "new",
      followUpNeeded: review.followUpNeeded === true || review.follow_up_needed === true,
      followUpCompleted: review.followUpCompleted === true || review.follow_up_completed === true,
      note: trimText(review.note),
      nextStep: trimText(review.nextStep || review.next_step),
      updatedAt: review.updatedAt || review.updated_at || null,
    },
    conversationSource: "web_call",
    action: action
      ? {
          type: trimText(action.type),
          label: trimText(action.label),
          targetSection: trimText(action.targetSection || action.target_section),
          contactId: trimText(action.contactId || action.contact_id),
          messageId: trimText(action.messageId || action.message_id),
        }
      : null,
  };
}

function normalizeOwnerAnalyticsDashboard(data = null) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const emptyDashboard = createEmptyOwnerAnalyticsDashboard();
  const metrics = data.metrics && typeof data.metrics === "object" ? data.metrics : {};
  const assistantSource = data.assistantSource && typeof data.assistantSource === "object"
    ? data.assistantSource
    : {};
  const aiUsage = data.aiUsage && typeof data.aiUsage === "object" ? data.aiUsage : null;
  const customerSatisfaction = data.customerSatisfaction && typeof data.customerSatisfaction === "object"
    ? data.customerSatisfaction
    : {};
  const knowledgeImprovement = data.knowledgeImprovement && typeof data.knowledgeImprovement === "object"
    ? data.knowledgeImprovement
    : {};
  const webCallHealth = data.webCallHealth && typeof data.webCallHealth === "object"
    ? data.webCallHealth
    : {};
  const webCallRecentCalls = data.webCallRecentCalls && typeof data.webCallRecentCalls === "object"
    ? data.webCallRecentCalls
    : {};

  return {
    ...emptyDashboard,
    ...data,
    ok: data.ok === true,
    metrics: {
      ...emptyDashboard.metrics,
      ...metrics,
      totalConversations: Number(metrics.totalConversations || 0),
      leadsCaptured: Number(metrics.leadsCaptured || 0),
      conversionRate: Number(metrics.conversionRate || 0),
    },
    assistantSource: {
      ...emptyDashboard.assistantSource,
      ...assistantSource,
      widget: normalizeAssistantSourceBucket(assistantSource.widget, emptyDashboard.assistantSource.widget),
      page: normalizeAssistantSourceBucket(assistantSource.page, emptyDashboard.assistantSource.page),
      embedded: normalizeAssistantSourceBucket(assistantSource.embedded, emptyDashboard.assistantSource.embedded),
      web_call: normalizeAssistantSourceBucket(assistantSource.web_call || assistantSource.webCall, emptyDashboard.assistantSource.web_call),
      unknown: normalizeAssistantSourceBucket(assistantSource.unknown, emptyDashboard.assistantSource.unknown),
      totalConversations: Number(assistantSource.totalConversations || 0)
        || Number(assistantSource.widget?.conversationCount || 0)
        + Number(assistantSource.page?.conversationCount || 0)
        + Number(assistantSource.embedded?.conversationCount || 0)
        + Number((assistantSource.web_call || assistantSource.webCall)?.conversationCount || 0)
        + Number(assistantSource.unknown?.conversationCount || 0),
      totalMessages: Number(assistantSource.totalMessages || 0)
        || Number(assistantSource.widget?.messageCount || 0)
        + Number(assistantSource.page?.messageCount || 0)
        + Number(assistantSource.embedded?.messageCount || 0)
        + Number((assistantSource.web_call || assistantSource.webCall)?.messageCount || 0)
        + Number(assistantSource.unknown?.messageCount || 0),
    },
    topVisitorQuestions: Array.isArray(data.topVisitorQuestions)
      ? data.topVisitorQuestions.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.summary || item.question))
      : [],
    missedQuestions: Array.isArray(data.missedQuestions)
      ? data.missedQuestions.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.question || item.summary))
      : [],
    customerSatisfaction: {
      ...emptyDashboard.customerSatisfaction,
      ...customerSatisfaction,
      totalFeedback: Number(customerSatisfaction.totalFeedback || 0),
      helpful: Number(customerSatisfaction.helpful || 0),
      notHelpful: Number(customerSatisfaction.notHelpful || 0),
      negativeRate: Number(customerSatisfaction.negativeRate || 0),
      unhappyAnswers: Array.isArray(customerSatisfaction.unhappyAnswers)
        ? customerSatisfaction.unhappyAnswers.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.question || item.reply))
        : [],
      weakTopics: Array.isArray(customerSatisfaction.weakTopics)
        ? customerSatisfaction.weakTopics.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.summary || item.question))
        : [],
      recoveryActions: Array.isArray(customerSatisfaction.recoveryActions)
        ? customerSatisfaction.recoveryActions.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.label || item.type))
        : [],
      persistenceAvailable: customerSatisfaction.persistenceAvailable !== false,
    },
    knowledgeImprovement: {
      ...emptyDashboard.knowledgeImprovement,
      ...knowledgeImprovement,
      total: Number(knowledgeImprovement.total || 0),
      openCount: Number(knowledgeImprovement.openCount || 0),
      approvedFixedCount: Number(knowledgeImprovement.approvedFixedCount || 0),
      dismissedCount: Number(knowledgeImprovement.dismissedCount || 0),
      items: Array.isArray(knowledgeImprovement.items)
        ? knowledgeImprovement.items.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.question || item.safeSummary || item.reason))
        : [],
    },
    notifications: Array.isArray(data.notifications)
      ? data.notifications.map((item) => normalizeOperatorRecord(item)).filter((item) => trimText(item.title || item.copy))
      : [],
    aiUsage: aiUsage
      ? {
        ...aiUsage,
        planKey: trimText(aiUsage.planKey),
        planName: trimText(aiUsage.planName),
        statusLabel: trimText(aiUsage.statusLabel),
        includedCents: Number(aiUsage.includedCents || 0),
        usedCents: Number(aiUsage.usedCents || 0),
        remainingCents: Number(aiUsage.remainingCents || 0),
        percentUsed: Number(aiUsage.percentUsed || 0),
      }
      : null,
    webCallHealth: {
      ...emptyDashboard.webCallHealth,
      available: webCallHealth.available !== false,
      starts: Number(webCallHealth.starts || 0),
      endedCalls: Number(webCallHealth.endedCalls || 0),
      averageDurationSeconds: Number(webCallHealth.averageDurationSeconds || 0),
      averageTurns: Number(webCallHealth.averageTurns || 0),
      contactFallbackSubmissions: Number(webCallHealth.contactFallbackSubmissions || 0),
      failureTotal: Number(webCallHealth.failureTotal || 0),
      failureCounts: webCallHealth.failureCounts && typeof webCallHealth.failureCounts === "object" && !Array.isArray(webCallHealth.failureCounts)
        ? Object.fromEntries(
            Object.entries(webCallHealth.failureCounts)
              .map(([category, count]) => [trimText(category).toLowerCase(), Number(count || 0)])
              .filter(([category, count]) => isSafeWebCallFailureCategory(category) && count > 0)
          )
        : {},
      failureCategories: Array.isArray(webCallHealth.failureCategories)
        ? webCallHealth.failureCategories.map((item) => ({
            category: trimText(item.category).toLowerCase(),
            label: formatWebCallFailureCategoryLabel(item.category),
            count: Number(item.count || 0),
          })).filter((item) => isSafeWebCallFailureCategory(item.category) && item.count > 0)
        : [],
      latestActivityAt: webCallHealth.latestActivityAt || null,
    },
    webCallRecentCalls: {
      ...emptyDashboard.webCallRecentCalls,
      available: webCallRecentCalls.available !== false,
      total: Number(webCallRecentCalls.total || 0),
      calls: Array.isArray(webCallRecentCalls.calls)
        ? webCallRecentCalls.calls.map((call) => normalizeRecentWebCallRecord(call)).filter((call) => trimText(call.id) && trimText(call.latestActivityAt || call.startedAt))
        : [],
    },
  };
}

function getOwnerAnalyticsDashboard(actionQueue = createEmptyActionQueue()) {
  const dashboard = normalizeOwnerAnalyticsDashboard(actionQueue.ownerAnalyticsDashboard);

  if (!dashboard) {
    return null;
  }

  const hasMetricData = Object.values(dashboard.metrics || {}).some((value) => Number(value || 0) > 0);
  const hasQuestionData = dashboard.topVisitorQuestions.length > 0 || dashboard.missedQuestions.length > 0;
  const hasSatisfactionData = Number(dashboard.customerSatisfaction?.totalFeedback || 0) > 0 || dashboard.notifications.length > 0;
  const hasKnowledgeImprovementData = Number(dashboard.knowledgeImprovement?.total || 0) > 0;
  const hasAiUsage = dashboard.aiUsage && trimText(dashboard.aiUsage.statusLabel || dashboard.aiUsage.planName || dashboard.aiUsage.planKey);
  const hasAssistantSourceData = Number(dashboard.assistantSource?.totalMessages || 0) > 0
    || Number(dashboard.assistantSource?.totalConversations || 0) > 0
    || Number(dashboard.assistantSource?.embedded?.messageCount || 0) > 0
    || Number(dashboard.assistantSource?.embedded?.conversationCount || 0) > 0
    || Number(dashboard.assistantSource?.web_call?.messageCount || 0) > 0
    || Number(dashboard.assistantSource?.web_call?.conversationCount || 0) > 0;
  const hasWebCallHealthData = Number(dashboard.webCallHealth?.starts || 0) > 0
    || Number(dashboard.webCallHealth?.endedCalls || 0) > 0
    || Number(dashboard.webCallHealth?.contactFallbackSubmissions || 0) > 0
    || Number(dashboard.webCallHealth?.failureTotal || 0) > 0
    || Boolean(trimText(dashboard.webCallHealth?.latestActivityAt));

  return dashboard.ok || hasMetricData || hasQuestionData || hasSatisfactionData || hasKnowledgeImprovementData || hasAiUsage || hasAssistantSourceData || hasWebCallHealthData ? dashboard : null;
}

function getAnalyticsSummary(actionQueue = createEmptyActionQueue(), agent = {}, messages = []) {
  const fallbackSignals = analyzeConversationSignals(messages);
  const fallbackSummary = createEmptyAnalyticsSummary();
  fallbackSummary.totalMessages = Number(agent.messageCount || messages.length || 0);
  fallbackSummary.visitorQuestions = fallbackSignals.userMessageCount || 0;
  fallbackSummary.highIntentSignals = fallbackSignals.highValueIntentCount || 0;
  fallbackSummary.lastMessageAt = agent.lastMessageAt || messages[0]?.createdAt || messages[0]?.created_at || null;

  const providedSummary = actionQueue?.analyticsSummary && typeof actionQueue.analyticsSummary === "object"
    ? actionQueue.analyticsSummary
    : {};

  return {
    ...fallbackSummary,
    ...providedSummary,
    visitorQuestions: Math.max(
      Number(fallbackSummary.visitorQuestions || 0),
      Number(providedSummary.visitorQuestions || 0)
    ),
    highIntentSignals: Math.max(
      Number(fallbackSummary.highIntentSignals || 0),
      Number(providedSummary.highIntentSignals || 0)
    ),
    weakAnswerCount: Math.max(
      Number(fallbackSummary.weakAnswerCount || 0),
      Number(providedSummary.weakAnswerCount || 0)
    ),
    customerQuestionSummaries: Array.isArray(providedSummary.customerQuestionSummaries)
      ? providedSummary.customerQuestionSummaries
      : fallbackSignals.topQuestions.map((item) => ({
        summary: item.label,
        count: item.count,
      })),
    recentActivity: {
      ...fallbackSummary.recentActivity,
      ...(providedSummary.recentActivity || {}),
    },
    operatorSignal: {
      ...fallbackSummary.operatorSignal,
      ...(providedSummary.operatorSignal || {}),
    },
  };
}

function _formatAnalyticsRate(value, analyticsSummary = createEmptyAnalyticsSummary()) {
  if (analyticsSummary.syncState === "pending" && Number(value || 0) === 0) {
    return "Syncing";
  }

  return formatCaptureRate(value);
}

function clampNumber(value, min, max) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(max, Math.max(min, numeric));
}

function formatAnalyticsReportNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value || 0)));
}

function formatAnalyticsReportDecimalPercent(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) {
    return "0%";
  }

  return `${numeric.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatAnalyticsHourLabel(hour) {
  const normalized = ((Number(hour) % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const hourValue = normalized % 12 || 12;
  return `${hourValue} ${suffix}`;
}

function formatAnalyticsShortDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildAnalyticsTimeSeries(entries = [], getDateValue, days = 30) {
  const bucketCount = Math.max(7, Number(days || 30));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (bucketCount - 1));
  const dayMs = 24 * 60 * 60 * 1000;
  const values = Array.from({ length: bucketCount }, () => 0);
  const labels = values.map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatAnalyticsShortDate(date);
  });

  entries.forEach((entry) => {
    const rawValue = typeof getDateValue === "function" ? getDateValue(entry) : null;
    const date = new Date(rawValue || "");

    if (Number.isNaN(date.getTime())) {
      return;
    }

    date.setHours(0, 0, 0, 0);
    const index = Math.floor((date.getTime() - start.getTime()) / dayMs);

    if (index >= 0 && index < values.length) {
      values[index] += 1;
    }
  });

  return {
    values,
    labels,
    total: values.reduce((sum, value) => sum + value, 0),
    max: Math.max(...values, 0),
  };
}

function buildAnalyticsPeakHours(userMessages = []) {
  const buckets = Array.from({ length: 24 }, () => 0);

  userMessages.forEach((message) => {
    const date = new Date(message.createdAt || message.created_at || "");

    if (Number.isNaN(date.getTime())) {
      return;
    }

    buckets[date.getHours()] += 1;
  });

  const bestHour = buckets.reduce((winner, count, index) => (count > winner.count
    ? { hour: index, count }
    : winner), { hour: -1, count: 0 });

  if (bestHour.count === 0) {
    return "Not enough timed usage yet";
  }

  const startHour = Math.floor(bestHour.hour / 2) * 2;
  return `${formatAnalyticsHourLabel(startHour)}-${formatAnalyticsHourLabel(startHour + 2)}`;
}

function getAnalyticsBestArea(signals = {}, conversionSummary = {}, outcomeSummary = {}, contactsCaptured = 0) {
  const scorecards = [
    {
      label: "moving visitors toward booking and the next step",
      score: Number(outcomeSummary.bookingConfirmed || 0) * 4
        + Number(outcomeSummary.bookingStarted || 0) * 2
        + Number(conversionSummary.bookingDirectHandoffs || 0) * 2
        + Number(signals.intentCounts?.booking || 0),
    },
    {
      label: "capturing quote and pricing interest",
      score: Number(outcomeSummary.quoteRequested || 0) * 3
        + Number(outcomeSummary.quoteAccepted || 0) * 4
        + Number(conversionSummary.pricingCaptures || 0) * 2
        + Number(signals.intentCounts?.pricing || 0),
    },
    {
      label: "turning warm conversations into leads",
      score: Number(contactsCaptured || 0) * 3
        + Number(conversionSummary.contactDirectHandoffs || 0) * 2
        + Number(signals.intentCounts?.contact || 0),
    },
    {
      label: "handling service questions calmly",
      score: Number(outcomeSummary.complaintResolved || 0) * 4
        + Number(signals.intentCounts?.support || 0),
    },
  ].sort((left, right) => right.score - left.score);

  if (!scorecards[0] || scorecards[0].score <= 0) {
    return "answering first questions without extra owner effort";
  }

  return scorecards[0].label;
}

function getAnalyticsImprovementArea(signals = {}, weakAnswerExamples = [], conversionSummary = {}, outcomeSummary = {}, report = {}) {
  const unresolvedComplaints = Math.max(0, Number(outcomeSummary.complaintOpened || 0) - Number(outcomeSummary.complaintResolved || 0));

  if (weakAnswerExamples.length) {
    if (getDashboardLanguage() === "hu") {
      return translateDashboardText(trimText(weakAnswerExamples[0]).replace(/\.$/, ""));
    }

    return trimText(weakAnswerExamples[0]).replace(/\.$/, "").toLowerCase();
  }

  if (unresolvedComplaints > 0) {
    return "closing complaint and support conversations faster";
  }

  if (Number(signals.intentCounts?.pricing || 0) > 0 && Number(conversionSummary.pricingCaptures || 0) === 0) {
    return "turning pricing questions into confident next steps";
  }

  if (Number(report.highIntentSignals || 0) > Number(report.contactsCaptured || 0)) {
    return "capturing more contact details from warm visitors";
  }

  return "building more live conversation volume";
}

function buildAnalyticsSummarySentence(report = {}) {
  if (getDashboardLanguage() === "hu") {
    if (report.conversationCount <= 0) {
      return "A Vonza készen áll, de még nincs elég élő forgalom az ügyfélszolgálati teljesítmény megítéléséhez.";
    }

    const satisfactionReadout = report.satisfactionScore >= 4.3
      ? "az ügyfél-elégedettség erősnek látszik"
      : report.satisfactionScore >= 3.7
        ? "az ügyfél-elégedettség stabil, néhány javítandó résszel"
        : "az ügyfél-elégedettség figyelmet igényel";

    return `A Vonza ${formatAnalyticsReportNumber(report.autonomousHandledCount)} / ${formatAnalyticsReportNumber(report.conversationCount)} beszélgetést kezelt csapatválasz nélkül, ${satisfactionReadout}, és a legnagyobb lemorzsolódási kockázat: ${translateDashboardText(report.improvementArea)}.`;
  }

  if (report.conversationCount <= 0) {
    return "Vonza is ready, but there is not enough live traffic yet to judge customer service performance.";
  }

  const satisfactionReadout = report.satisfactionScore >= 4.3
    ? "customer satisfaction looks strong"
    : report.satisfactionScore >= 3.7
      ? "customer satisfaction looks solid with a few gaps"
      : "customer satisfaction needs attention";

  return `Vonza handled ${formatAnalyticsReportNumber(report.autonomousHandledCount)} of ${formatAnalyticsReportNumber(report.conversationCount)} conversations without needing a team reply, ${satisfactionReadout}, and the biggest drop-off risk is ${report.improvementArea}.`;
}

function buildAnalyticsRecommendations(report = {}) {
  const captureGap = Math.max(0, Number(report.highIntentSignals || 0) - Number(report.contactsCaptured || 0));
  const candidates = [];

  if (Number(report.attentionNeeded || 0) > 0) {
    candidates.push({
      recommendation: {
        type: "unanswered_question",
        title: "open customer questions",
        summary: "Open conversations still need a customer reply.",
      },
      metric: `${formatAnalyticsReportNumber(report.attentionNeeded)} open conversation${Number(report.attentionNeeded) === 1 ? "" : "s"}`,
    });
  }

  if (Number(report.weakAnswerCount || 0) > 0) {
    candidates.push({
      recommendation: {
        type: "knowledge_fix",
        title: "weak service answer",
        summary: report.weakAnswerExample || "Customers reached an unclear service answer.",
      },
      metric: `${formatAnalyticsReportNumber(report.weakAnswerCount)} answer${Number(report.weakAnswerCount) === 1 ? "" : "s"} to improve`,
    });
  }

  if (Number(report.unresolvedComplaints || 0) > 0) {
    candidates.push({
      recommendation: {
        type: "support_risk_review",
        title: "complaint handling",
        summary: "Complaint or support recovery still needs a clear owner path.",
      },
      metric: `${formatAnalyticsReportNumber(report.unresolvedComplaints)} unresolved complaint${Number(report.unresolvedComplaints) === 1 ? "" : "s"}`,
    });
  }

  if (Number(report.pricingQuestions || 0) > 0 && Number(report.pricingCaptures || 0) === 0) {
    candidates.push({
      recommendation: {
        type: "pricing_gap",
        title: "pricing guidance",
        summary: "Visitors asked about price, cost, or packages without a clear pricing next step.",
      },
      metric: `${formatAnalyticsReportNumber(report.pricingQuestions)} pricing question${Number(report.pricingQuestions) === 1 ? "" : "s"}`,
    });
  }

  if (captureGap > 0) {
    candidates.push({
      recommendation: {
        type: "contact_next_step",
        title: "contact path",
        summary: "Warm visitors did not all become identified contacts.",
      },
      metric: `${formatAnalyticsReportNumber(captureGap)} warm conversation${captureGap === 1 ? "" : "s"} without contact details`,
    });
  }

  if (Number(report.bookingQuestions || 0) > 0 && Number(report.bookingDirectHandoffs || 0) === 0) {
    candidates.push({
      recommendation: {
        type: "booking_intent",
        title: "booking guidance",
        summary: "Visitors asked about booking or availability without a clear booking path.",
      },
      metric: `${formatAnalyticsReportNumber(report.bookingQuestions)} booking question${Number(report.bookingQuestions) === 1 ? "" : "s"}`,
    });
  }

  return candidates.slice(0, 3).map((candidate) => {
    const priorityCopy = getBusinessPriorityCopy(candidate.recommendation);

    return {
      title: translateDashboardText(priorityCopy.title),
      tone: priorityCopy.tone,
      metric: translateDashboardText(candidate.metric),
      copy: translateDashboardText(`${priorityCopy.why} ${priorityCopy.change}`),
    };
  });
}

function buildAnalyticsSwot(report = {}) {
  return [
    {
      label: "Strength",
      tone: "positive",
      copy: report.autonomousHandledRate >= 75
        ? "Vonza is handling most customer conversations without needing the owner to step in."
        : "Vonza is already reducing some front-desk load and building a clearer service picture.",
    },
    {
      label: "Weakness",
      tone: report.weakAnswerCount > 0 || report.unresolvedComplaints > 0 ? "risk" : "neutral",
      copy: report.weakAnswerCount > 0
        ? `${formatAnalyticsReportNumber(report.weakAnswerCount)} conversations still sound uncertain or incomplete.`
        : report.unresolvedComplaints > 0
          ? `${formatAnalyticsReportNumber(report.unresolvedComplaints)} complaint-style conversations still feel unresolved.`
          : "The current sample does not show one major service weakness yet.",
    },
    {
      label: "Opportunity",
      tone: "watch",
      copy: report.guestUsers > report.identifiedUsers
        ? "More anonymous visitors could become leads if contact capture appears earlier in warm conversations."
        : report.highIntentSignals > report.contactsCaptured
          ? "Warm intent is there. Tightening the next-step path could turn more demand into identified customers."
          : "Booking and pricing demand can likely convert further with clearer next-step prompts.",
    },
    {
      label: "Threat",
      tone: report.unresolvedComplaints > 0 || report.lostCustomerRisk === "High" ? "risk" : "neutral",
      copy: report.unresolvedComplaints > 0
        ? "Open complaint recovery work is the biggest trust risk right now."
        : report.lostCustomerRisk === "High"
          ? "Warm visitors may drop if pricing, booking, or support questions still need a team reply."
          : "No major churn threat stands out yet beyond the normal need for more live data.",
    },
  ];
}

function buildAnalyticsContactMix(actionQueue = createEmptyActionQueue(), contacts = []) {
  const contactList = Array.isArray(contacts) ? contacts : [];

  if (contactList.length) {
    return contactList.reduce((summary, contact) => {
      const hasEmail = Boolean(getCustomerEmailLabel(contact.email));
      const hasPhone = Boolean(trimText(contact.phone));
      const hasName = Boolean(getNamedCustomerIdentity(contact));
      const identified = hasEmail || hasPhone || hasName;

      summary.total += 1;
      summary.emailUsers += hasEmail ? 1 : 0;
      summary.phoneUsers += hasPhone ? 1 : 0;
      summary.namedUsers += hasName ? 1 : 0;
      summary.identifiedUsers += identified ? 1 : 0;
      summary.guestUsers += identified ? 0 : 1;
      return summary;
    }, {
      total: 0,
      guestUsers: 0,
      emailUsers: 0,
      phoneUsers: 0,
      namedUsers: 0,
      identifiedUsers: 0,
    });
  }

  const people = Array.isArray(actionQueue.people) ? actionQueue.people : [];
  const emailUsers = people.filter((person) => trimText(person.identityType) === "email").length;
  const phoneUsers = people.filter((person) => trimText(person.identityType) === "phone").length;
  const namedUsers = people.filter((person) => trimText(person.identityType) === "name").length;
  const guestUsers = people.filter((person) => ["session", "unknown"].includes(trimText(person.identityType))).length;

  return {
    total: people.length,
    guestUsers,
    emailUsers,
    phoneUsers,
    namedUsers,
    identifiedUsers: emailUsers + phoneUsers + namedUsers,
  };
}

function buildAnalyticsReport(signals = {}, analyticsSummary = createEmptyAnalyticsSummary(), actionQueue = createEmptyActionQueue(), conversionSummary = {}, outcomeSummary = {}, options = {}) {
  const conversationCount = Math.max(
    Number(analyticsSummary.conversationCount || 0),
    Number(analyticsSummary.uniqueVisitorCount || 0),
    Number(signals.userMessageCount || 0)
  );
  const complaintsHandled = Number(outcomeSummary.complaintResolved || 0);
  const complaintOpened = Number(outcomeSummary.complaintOpened || 0);
  const unresolvedComplaints = Math.max(0, complaintOpened - complaintsHandled);
  const weakAnswerCount = Math.max(Number(analyticsSummary.weakAnswerCount || 0), Number(signals.weakAnswerCount || 0));
  const attentionNeeded = Number(actionQueue.summary?.attentionNeeded || analyticsSummary.attentionNeeded || 0);
  const autonomousHandledCount = Math.max(0, conversationCount - Math.max(attentionNeeded, weakAnswerCount));
  const autonomousHandledRate = conversationCount > 0
    ? Math.round((autonomousHandledCount / conversationCount) * 100)
    : 0;
  const contactsCaptured = Number(analyticsSummary.contactsCaptured || conversionSummary.contactsCaptured || 0);
  const assistedOutcomes = Number(analyticsSummary.assistedOutcomes || outcomeSummary.assistedConversions || 0);
  const conversionRate = conversationCount > 0
    ? Number(((Math.max(contactsCaptured, assistedOutcomes) / conversationCount) * 100).toFixed(1))
    : 0;
  const highIntentSignals = Number(analyticsSummary.highIntentSignals || 0);
  const pricingQuestions = Number(signals.intentCounts?.pricing || 0);
  const bookingQuestions = Number(signals.intentCounts?.booking || 0);
  const contactQuestions = Number(signals.intentCounts?.contact || 0);
  const serviceQuestions = Number(signals.intentCounts?.services || 0);
  const pricingCaptures = Number(conversionSummary.pricingCaptures || 0);
  const bookingDirectHandoffs = Number(conversionSummary.bookingDirectHandoffs || 0);
  const estimatedHoursSaved = (autonomousHandledCount * 6) / 60;
  const contactMix = buildAnalyticsContactMix(actionQueue, options.contacts);
  const guestUsers = contactMix.guestUsers;
  const emailUsers = contactMix.emailUsers;
  const phoneUsers = contactMix.phoneUsers;
  const namedUsers = contactMix.namedUsers;
  const identifiedUsers = contactMix.identifiedUsers;
  const weakPenalty = conversationCount > 0 ? (weakAnswerCount / conversationCount) * 2.1 : 0;
  const attentionPenalty = conversationCount > 0 ? (attentionNeeded / conversationCount) * 1.2 : 0;
  const unresolvedPenalty = complaintOpened > 0 ? (unresolvedComplaints / complaintOpened) * 1.1 : 0;
  const outcomeBonus = conversationCount > 0 ? Math.min(0.45, (assistedOutcomes / conversationCount) * 1.4) : 0;
  const leadBonus = conversationCount > 0 ? Math.min(0.2, (contactsCaptured / conversationCount) * 0.9) : 0;
  const satisfactionScore = conversationCount > 0
    ? clampNumber(4.45 - weakPenalty - attentionPenalty - unresolvedPenalty + outcomeBonus + leadBonus, 1, 5)
    : 0;
  const summarizedQuestion = Array.isArray(analyticsSummary.customerQuestionSummaries)
    ? trimText(analyticsSummary.customerQuestionSummaries[0]?.summary)
    : "";
  const mostAskedQuestion = summarizedQuestion || signals.topQuestions?.[0]?.label || "No repeated question yet";
  const bestArea = getAnalyticsBestArea(signals, conversionSummary, outcomeSummary, contactsCaptured);
  const weakAnswerExample = signals.weakAnswerExamples?.[0] || "";
  const improvementArea = getAnalyticsImprovementArea(signals, signals.weakAnswerExamples || [], conversionSummary, outcomeSummary, {
    highIntentSignals,
    contactsCaptured,
  });
  const contactMixCopy = contactMix.total
    ? guestUsers > identifiedUsers
      ? "Most customer conversations are still anonymous, which means lead capture is the clearest growth lever."
      : "Vonza is turning a healthy share of conversations into known customer records."
    : "Contact identity will become more useful as more live conversations arrive.";
  const lostCustomerRisk = unresolvedComplaints > 0 || weakAnswerCount >= 3
    ? "High"
    : highIntentSignals > contactsCaptured || attentionNeeded > 0
      ? "Medium"
      : "Low";

  return {
    conversationCount,
    autonomousHandledCount,
    autonomousHandledRate,
    contactsCaptured,
    conversionRate,
    complaintsHandled,
    complaintOpened,
    unresolvedComplaints,
    satisfactionScore,
    estimatedHoursSaved,
    highIntentSignals,
    assistedOutcomes,
    pricingQuestions,
    bookingQuestions,
    contactQuestions,
    serviceQuestions,
    pricingCaptures,
    bookingDirectHandoffs,
    weakAnswerCount,
    weakAnswerExample,
    attentionNeeded,
    guestUsers,
    emailUsers,
    phoneUsers,
    namedUsers,
    identifiedUsers,
    mostAskedQuestion,
    peakHours: buildAnalyticsPeakHours(signals.userMessages || []),
    bestArea,
    improvementArea,
    contactMixCopy,
    lostCustomerRisk,
    recommendations: [],
    swot: [],
  };
}

function buildV2Icon(name = "", className = "") {
  const classes = ["v2-icon", className].filter(Boolean).join(" ");
  return getUiIconMarkup(name).replace("<svg ", `<svg class="${escapeHtml(classes)}" `);
}

function buildV2IconBadge(name = "", tone = "blue") {
  return `<span class="v2-icon-badge ${escapeHtml(tone)}">${buildV2Icon(name)}</span>`;
}

function buildV2Button(label, iconName = "", variant = "") {
  const variantClass = variant ? ` ${escapeHtml(variant)}` : "";
  return `<button class="v2-button${variantClass}" type="button">${iconName ? buildV2Icon(iconName) : ""}${escapeHtml(label)}</button>`;
}

function _buildV2MetricCard(metric = {}) {
  const trendClass = metric.down ? "v2-trend-down" : "v2-trend-up";
  const trendIcon = metric.down ? "arrowDown" : "arrowUp";

  return `
    <article class="v2-metric-card">
      <div class="v2-metric-top">
        <div class="v2-metric-label">
          ${buildV2IconBadge(metric.icon || "review", metric.tone || "blue")}
          <span>${escapeHtml(metric.label || "")}</span>
        </div>
        <span class="v2-info-dot">i</span>
      </div>
      <div class="v2-metric-value">${escapeHtml(metric.value || "0")}</div>
      <div class="v2-metric-change">
        ${metric.change ? `<span class="${trendClass}">${buildV2Icon(trendIcon)} ${escapeHtml(metric.change)}</span>` : ""}
        <span>${escapeHtml(metric.compare || "Live workspace data")}</span>
      </div>
    </article>
  `;
}

function _getAnalyticsSourceRows(sourceBreakdown = {}) {
  if (typeof dashboardAnalytics.buildAssistantSourceRows === "function") {
    return dashboardAnalytics.buildAssistantSourceRows(sourceBreakdown);
  }

  const emptySource = createEmptyOwnerAnalyticsDashboard().assistantSource;
  const source = sourceBreakdown && typeof sourceBreakdown === "object" ? sourceBreakdown : {};
  const rows = [
    {
      ...normalizeAssistantSourceBucket(source.widget, emptySource.widget),
      icon: "window",
      tone: "teal",
      color: "teal",
      visits: "",
    },
    {
      ...normalizeAssistantSourceBucket(source.page, emptySource.page),
      icon: "window",
      tone: "blue",
      color: "blue",
      visits: "",
    },
  ];
  const webCall = normalizeAssistantSourceBucket(source.web_call || source.webCall, emptySource.web_call);
  const unknown = normalizeAssistantSourceBucket(source.unknown, emptySource.unknown);

  if (webCall.conversationCount > 0 || webCall.messageCount > 0 || webCall.leadsCaptured > 0) {
    rows.push({
      ...webCall,
      icon: "phone",
      tone: "blue",
      color: "soft-blue",
      visits: "",
    });
  }

  if (unknown.conversationCount > 0 || unknown.messageCount > 0 || unknown.leadsCaptured > 0) {
    rows.push({
      ...unknown,
      icon: "link",
      tone: "blue",
      color: "gray",
      visits: "Legacy",
    });
  }

  return rows;
}

function buildDashboardV2AnalyticsMarkup(report = {}, ownerAnalyticsDashboard = null, topQuestionItems = [], userMessages = []) {
  if (typeof dashboardAnalytics.renderAnalyticsPageFragment === "function") {
    return dashboardAnalytics.renderAnalyticsPageFragment(report, ownerAnalyticsDashboard, topQuestionItems, userMessages, {
      t,
      renderIcon: buildV2Icon,
      renderIconBadge: buildV2IconBadge,
      renderButton: buildV2Button,
      activeProduct: activeDashboardProduct,
    });
  }

  return `<div class="placeholder-card">Analytics are unavailable until the dashboard analytics module loads.</div>`;
}

function normalizeActionQueueStatus(value) {
  return dashboardLabels.normalizeActionQueueStatus(value, ACTION_QUEUE_STATUSES);
}

function getActionQueueStatusLabel(status) {
  return dashboardLabels.getActionQueueStatusLabel(status, ACTION_QUEUE_STATUSES);
}

function getActionQueueStatusBadgeClass(status) {
  switch (normalizeActionQueueStatus(status)) {
    case "done":
      return "badge success";
    case "reviewed":
      return "badge warning";
    default:
      return "badge pending";
  }
}

function normalizeActionQueueBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = trimText(value).toLowerCase();

  if (["yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function getFollowUpBooleanLabel(value) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "Not set";
}

function getContactStatusLabel(value) {
  const normalized = trimText(value).toLowerCase();

  switch (normalized) {
    case "attempted":
      return "Attempted";
    case "contacted":
      return "Contacted";
    case "qualified":
      return "Qualified";
    case "not_contacted":
      return "Not contacted";
    default:
      return "Not set";
  }
}

function hasActionQueueOwnerHandoff(item = {}) {
  return Boolean(
    trimText(item.note)
    || trimText(item.outcome)
    || trimText(item.nextStep)
    || normalizeActionQueueBoolean(item.followUpNeeded) !== null
    || normalizeActionQueueBoolean(item.followUpCompleted) !== null
    || trimText(item.contactStatus)
  );
}

function getActionQueueOwnerWorkflow(item = {}) {
  if (item.ownerWorkflow && typeof item.ownerWorkflow === "object") {
    return {
      key: trimText(item.ownerWorkflow.key) || "needs_review",
      label: trimText(item.ownerWorkflow.label) || "Needs a look",
      copy: trimText(item.ownerWorkflow.copy) || "This conversation still needs a clear next step.",
      attention: item.ownerWorkflow.attention !== false,
      resolved: item.ownerWorkflow.resolved === true,
      rank: Number.isFinite(Number(item.ownerWorkflow.rank)) ? Number(item.ownerWorkflow.rank) : 99,
    };
  }

  const status = normalizeActionQueueStatus(item.status);
  const followUpCompleted = normalizeActionQueueBoolean(item.followUpCompleted);
  const followUpNeeded = normalizeActionQueueBoolean(item.followUpNeeded);
  const handoffStarted = hasActionQueueOwnerHandoff(item);
  const resolved = followUpCompleted === true || status === "done";

  if (status === "dismissed") {
    return {
      key: "dismissed",
      label: "Dismissed",
      copy: "This item was intentionally cleared from the queue.",
      attention: false,
      resolved: false,
      rank: 5,
    };
  }

  if (resolved) {
    return {
      key: "resolved",
      label: "Handled",
      copy: trimText(item.outcome)
        ? "A result is already recorded, so this item no longer needs active follow-up."
        : "This item is marked complete and no longer needs active follow-up.",
      attention: false,
      resolved: true,
      rank: 4,
    };
  }

  if (followUpNeeded === true) {
    return {
      key: handoffStarted ? "follow_up_in_progress" : "follow_up_needed",
      label: handoffStarted ? "Follow-up in progress" : "Needs follow-up",
      copy: trimText(item.nextStep)
        ? `Next step: ${trimText(item.nextStep)}`
        : "Someone still needs to follow up on this conversation.",
      attention: true,
      resolved: false,
      rank: handoffStarted ? 1 : 0,
    };
  }

  if (status === "reviewed" || handoffStarted) {
    return {
      key: "reviewed_pending",
      label: "In progress",
      copy: trimText(item.outcome)
        ? "Context is recorded, but the final result is not marked yet."
        : "This item has been reviewed, but the final result is still open.",
      attention: true,
      resolved: false,
      rank: 2,
    };
  }

  return {
    key: "needs_review",
    label: "Needs a look",
    copy: "This conversation still needs a clear next step.",
    attention: true,
    resolved: false,
    rank: 3,
  };
}

function getActionQueueOwnerWorkflowBadgeClass(item = {}) {
  const workflow = getActionQueueOwnerWorkflow(item);

  if (workflow.key === "resolved") {
    return "badge success";
  }

  if (workflow.key === "follow_up_in_progress" || workflow.key === "reviewed_pending") {
    return "badge warning";
  }

  if (workflow.key === "dismissed") {
    return "pill";
  }

  return "badge pending";
}

function formatActionQueueContact(item) {
  const name = trimText(item?.contactInfo?.name);
  const email = trimText(item?.contactInfo?.email);
  const phone = trimText(item?.contactInfo?.phone);

  if (name && email && phone) {
    return `${name} · ${email} · ${phone}`;
  }

  if (name && email) {
    return `${name} · ${email}`;
  }

  if (name && phone) {
    return `${name} · ${phone}`;
  }

  if (name) {
    return name;
  }

  if (email && phone) {
    return `${email} · ${phone}`;
  }

  if (email) {
    return email;
  }

  if (phone) {
    return phone;
  }

  return "Contact details still coming in";
}

function getActionQueueTypeLabel(type) {
  if (type === "weak_answer") {
    return "Answers to improve";
  }

  if (type === "repeat_high_intent") {
    return "Repeat visitor";
  }

  return getIntentLabel(type);
}

function getOperatorActionTypeLabel(item = {}) {
  switch (trimText(item.actionType).toLowerCase()) {
    case "lead_follow_up":
      return "Lead follow-up";
    case "pricing_interest":
      return "Pricing interest";
    case "booking_intent":
      return "Booking intent";
    case "repeat_high_intent_visitor":
      return "Repeat high-intent visitor";
    case "knowledge_gap":
      return "Knowledge gap";
    case "unanswered_question":
      return "Unanswered question";
    default:
      return getActionQueueTypeLabel(item.type);
  }
}

function getFollowUpStatusLabel(value) {
  return dashboardLabels.getFollowUpStatusLabel(value);
}

function getFollowUpStatusBadgeClass(value) {
  const normalized = trimText(value).toLowerCase();

  if (normalized === "sent") {
    return "badge success";
  }

  if (normalized === "dismissed") {
    return "pill";
  }

  if (normalized === "failed" || normalized === "missing_contact") {
    return "badge pending";
  }

  if (normalized === "ready") {
    return "badge warning";
  }

  return "badge pending";
}

function getKnowledgeFixStatusLabel(value) {
  return dashboardLabels.getKnowledgeFixStatusLabel(value);
}

function getKnowledgeFixStatusBadgeClass(value) {
  const normalized = trimText(value).toLowerCase();

  if (normalized === "applied" || normalized === "approved_fixed") {
    return "badge success";
  }

  if (normalized === "dismissed") {
    return "pill";
  }

  if (normalized === "ready" || normalized === "reviewing") {
    return "badge warning";
  }

  return "badge pending";
}

function formatKnowledgeState(value) {
  const normalized = trimText(value).toLowerCase();

  if (normalized === "ready") {
    return "Ready";
  }

  if (normalized === "limited") {
    return "Growing";
  }

  if (normalized === "missing") {
    return "Getting started";
  }

  return "Unknown";
}

function formatFollowUpChannel(value) {
  const normalized = trimText(value).toLowerCase();

  switch (normalized) {
    case "email":
      return "Email";
    case "phone":
      return "Phone / text";
    case "manual":
      return "Manual";
    default:
      return "Not set";
  }
}

function buildActionQueueSummaryPills(summary = {}) {
  const counts = {
    ...createEmptyActionQueue().summary,
    ...summary,
  };

  return [
    `${counts.total} total`,
    `${counts.attentionNeeded} need a look`,
    `${counts.followUpNeeded} follow-up`,
    `${counts.resolved} handled`,
  ];
}

function buildPeopleSummaryPills(summary = {}) {
  const counts = {
    ...createEmptyActionQueue().peopleSummary,
    ...summary,
  };

  return [
    `${counts.total} people`,
    `${counts.returning} returning`,
    `${counts.linkedQueueItems} with queue items`,
  ];
}

function formatCaptureRate(value) {
  return dashboardLabels.formatCaptureRate(value);
}

function _buildConversionSummaryPills(summary = {}) {
  const counts = {
    ...createEmptyActionQueue().conversionSummary,
    ...(summary || {}),
  };

  return [
    `${counts.highIntentConversations} high-intent chats`,
    `${counts.directCtasShown} direct CTAs shown`,
    `${formatCaptureRate(counts.ctaClickThroughRate)} CTA CTR`,
    `${counts.assistedConversions || 0} assisted outcomes`,
    `${counts.followUpAssistedOutcomeCount || 0} follow-up-assisted`,
  ];
}

function getOutcomeTypeLabel(value) {
  return dashboardLabels.getOutcomeTypeLabel(value);
}

function formatPersonIdentity(person = {}) {
  const name = trimText(person.name);
  const email = trimText(person.email);
  const phone = trimText(person.phone);

  if (name && email && phone) {
    return `${name} · ${email} · ${phone}`;
  }

  if (name && email) {
    return `${name} · ${email}`;
  }

  if (name && phone) {
    return `${name} · ${phone}`;
  }

  if (name || email || phone) {
    return name || email || phone;
  }

  if (trimText(person.identityType) === "session") {
    return "Session continuity only";
  }

  return "Identity unknown";
}

function formatPersonIntents(person = {}) {
  if (!Array.isArray(person.keyIntents) || !person.keyIntents.length) {
    return "No clear intent pattern yet";
  }

  return person.keyIntents
    .map((entry) => `${trimText(entry.label) || getIntentLabel(entry.intent)}${Number(entry.count) > 1 ? ` (${entry.count})` : ""}`)
    .join(" · ");
}

function _buildPeopleMarkup(actionQueue = createEmptyActionQueue()) {
  const people = Array.isArray(actionQueue.people) ? actionQueue.people : [];
  const peopleSummary = {
    ...createEmptyActionQueue().peopleSummary,
    ...(actionQueue.peopleSummary || {}),
  };

  if (!people.length) {
    return `
      <section class="workspace-card-soft people-shell">
        <div class="people-header">
          <div>
            <h3 class="studio-group-title">People view</h3>
            <p class="studio-group-copy">When Vonza sees strong enough repeat-visitor signals, it stitches them into a lightweight person thread here.</p>
          </div>
        </div>
        <div class="placeholder-card">No repeat-visitor stitching yet. As soon as Vonza can confidently connect multiple interactions to the same person, this view will show their snippets, intents, timeline, and follow-up state.</div>
      </section>
    `;
  }

  return `
    <section class="workspace-card-soft people-shell">
      <div class="people-header">
        <div>
          <h3 class="studio-group-title">People view</h3>
          <p class="studio-group-copy">This is the lightweight person layer behind the queue. Returning people still surface here so the owner can see when the same lead comes back or the same issue keeps evolving.</p>
        </div>
        <div class="action-queue-summary">
          ${buildPeopleSummaryPills(peopleSummary).map((label) => `
            <span class="pill">${escapeHtml(label)}</span>
          `).join("")}
        </div>
      </div>
      <div class="people-list">
        ${people.slice(0, 6).map((person) => `
          <article class="person-card">
            <div class="person-card-top">
              <div class="action-queue-headline">
                <div class="action-queue-badges">
                  <span class="pill">${escapeHtml(person.label || "Unknown visitor")}</span>
                  <span class="pill">${escapeHtml(`${person.interactionCount || 0} interaction${person.interactionCount === 1 ? "" : "s"}`)}</span>
                  <span class="pill">${escapeHtml(`${person.queueItemCount || 0} queue item${person.queueItemCount === 1 ? "" : "s"}`)}</span>
                  <span class="${person.followUp?.attentionCount > 0 ? "badge pending" : person.followUp?.key === "resolved" ? "badge success" : "pill"}">${escapeHtml(person.followUp?.label || "No queue items yet")}</span>
                </div>
                <h4 class="action-queue-title">${escapeHtml(person.story || "Person-level thread")}</h4>
                <p class="action-queue-copy">${escapeHtml(person.isReturning ? "Vonza detected repeat visitor signals across these interactions." : "Vonza has one stitched interaction for this visitor so far.")}</p>
              </div>
              <div class="action-queue-meta-inline">${escapeHtml(person.lastSeenAt ? `Last seen ${formatSeenAt(person.lastSeenAt)}` : "Recent signal")}</div>
            </div>
            <div class="action-queue-details">
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Identity signal</span>
                <strong class="action-queue-detail-value">${escapeHtml(formatPersonIdentity(person))}</strong>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Key intents</span>
                <strong class="action-queue-detail-value">${escapeHtml(formatPersonIntents(person))}</strong>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Follow-up status</span>
                <strong class="action-queue-detail-value">${escapeHtml(person.followUp?.label || "No queue items yet")}</strong>
                <p class="action-queue-copy">${escapeHtml(person.followUp?.copy || "This visitor has no queue-linked follow-up yet.")}</p>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Timeline</span>
                <strong class="action-queue-detail-value">${escapeHtml(person.firstSeenAt && person.lastSeenAt && person.firstSeenAt !== person.lastSeenAt ? `${formatSeenAt(person.firstSeenAt)} to ${formatSeenAt(person.lastSeenAt)}` : person.lastSeenAt ? formatSeenAt(person.lastSeenAt) : "Recent signal")}</strong>
              </div>
            </div>
            <div class="person-snippets">
              <div class="person-subsection">
                <span class="action-queue-detail-label">Combined conversation snippets</span>
                <div class="question-list">
                  ${Array.isArray(person.snippets) && person.snippets.length ? person.snippets.map((snippet) => `
                    <div class="question-row">${escapeHtml(snippet.text || "No snippet stored yet.")}</div>
                  `).join("") : `<div class="placeholder-card">No stored snippets yet.</div>`}
                </div>
              </div>
              <div class="person-subsection">
                <span class="action-queue-detail-label">Basic timeline</span>
                <div class="timeline-list">
                  ${Array.isArray(person.timeline) && person.timeline.length ? person.timeline.map((entry) => `
                    <div class="timeline-row">
                      <strong>${escapeHtml(entry.at ? formatSeenAt(entry.at) : "Recent")}</strong>
                      <span>${escapeHtml(entry.summary || entry.label || "Conversation signal")}</span>
                    </div>
                  `).join("") : `<div class="placeholder-card">No timeline yet.</div>`}
                </div>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function _buildActionQueueMarkup(agent, actionQueue = createEmptyActionQueue(), options = {}) {
  const items = Array.isArray(actionQueue.items) ? actionQueue.items : [];
  const summary = {
    ...createEmptyActionQueue().summary,
    ...(actionQueue.summary || {}),
  };
  const persistenceAvailable = actionQueue.persistenceAvailable !== false;
  const migrationRequired = actionQueue.migrationRequired === true;
  const followUpWorkflowAvailable = actionQueue.followUpWorkflowAvailable !== false;
  const followUpWorkflowMigrationRequired = actionQueue.followUpWorkflowMigrationRequired === true;
  const knowledgeFixWorkflowAvailable = actionQueue.knowledgeFixWorkflowAvailable !== false;
  const knowledgeFixWorkflowMigrationRequired = actionQueue.knowledgeFixWorkflowMigrationRequired === true;
  const manualOutcomeVisible = isCapabilityExplicitlyVisible("manual_outcome_marks");
  const knowledgeFixVisible = isCapabilityExplicitlyVisible("knowledge_fix_workflows");
  const compact = Boolean(options.compact);
  const allowStatusUpdates = options.allowStatusUpdates !== false && persistenceAvailable;
  const visibleItems = compact ? items.slice(0, 3) : items;
  const sectionTitle = compact ? "Follow-up feed" : "Follow-up queue";
  const sectionCopy = compact
    ? "Analytics turns into action here. These are the individual conversations that deserve owner follow-up or a better answer path."
    : "These items are surfaced from real visitor conversations so the owner can work specific follow-up moments instead of broad signal buckets.";
  const emptyCopy = compact
    ? "No conversation-derived actions yet. As soon as visitors show stronger commercial intent or Vonza gives a weak answer, the next owner actions will appear here."
    : "No actionable items yet. Once Vonza sees high-intent conversations or weak answers, the next owner actions will appear here instead of a fake busy state.";

  const buildStatusOptions = (currentStatus) =>
    ACTION_QUEUE_STATUSES.map((status) => `
      <option value="${status}" ${normalizeActionQueueStatus(currentStatus) === status ? "selected" : ""}>${getActionQueueStatusLabel(status)}</option>
    `).join("");

  const buildContactStatusOptions = (currentValue) => {
    const normalized = trimText(currentValue).toLowerCase();

    return [
      { value: "", label: "Not set" },
      { value: "not_contacted", label: "Not contacted" },
      { value: "attempted", label: "Attempted" },
      { value: "contacted", label: "Contacted" },
      { value: "qualified", label: "Qualified" },
    ].map((option) => `
      <option value="${option.value}" ${normalized === option.value ? "selected" : ""}>${option.label}</option>
    `).join("");
  };

  const itemsMarkup = visibleItems.map((item, index) => {
    const workflow = getActionQueueOwnerWorkflow(item);
    const handoffOpenByDefault = !compact && workflow.attention && index === 0;
    const recencyLabel = item.lastSeenAt ? formatSeenAt(item.lastSeenAt) : "Recent signal";
    const metaLine = item.updatedAt
      ? `Flagged ${recencyLabel} · Updated ${formatSeenAt(item.updatedAt)}`
      : `Flagged ${recencyLabel}`;
    const personThreadLabel = item.person?.relatedInteractionCount > 1
      ? `${item.person.label || "Returning visitor"} · ${item.person.relatedInteractionCount} interactions`
      : "";
    const leadCapture = item.leadCapture && typeof item.leadCapture === "object" ? item.leadCapture : null;
    const routing = item.routing && typeof item.routing === "object" ? item.routing : null;
    const outcomeState = item.outcomes && typeof item.outcomes === "object" ? item.outcomes : null;
    const followUp = item.followUp && typeof item.followUp === "object" ? item.followUp : null;
    const followUpStatus = trimText(followUp?.status).toLowerCase();
    const followUpSupported = item.followUpSupported === true;
    const followUpActionsDisabled = !allowStatusUpdates || !followUpWorkflowAvailable || !followUp?.id;
    const followUpNeedsContact = followUpStatus === "missing_contact";
    const followUpReadOnly = followUpStatus === "sent" || followUpStatus === "dismissed";
    const toggleOpenLabel = item.note || item.outcome || item.nextStep || item.contactStatus
      ? "Edit follow-up note"
      : "Open follow-up note";
    const leadCaptureSummary = leadCapture
      ? `
        <div class="action-queue-handoff-summary">
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Capture state</span>
            <strong class="action-queue-detail-value">${escapeHtml(trimText(leadCapture.state).replaceAll("_", " ") || "Not started")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Captured contact</span>
            <strong class="action-queue-detail-value">${escapeHtml(formatActionQueueContact({ contactInfo: leadCapture.contact || {} }))}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Why capture happened</span>
            <strong class="action-queue-detail-value">${escapeHtml(trimText(leadCapture.reason) || item.whyFlagged || "No capture reason stored yet.")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Visitor type</span>
            <strong class="action-queue-detail-value">${escapeHtml(leadCapture.isReturningVisitor ? "Returning visitor" : "New visitor")}</strong>
          </div>
        </div>
        <div class="action-queue-secondary-action">
          ${item.messageId ? `<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(item.messageId)}">Open related conversation</button>` : ""}
        </div>
      `
      : "";
    const routingSummary = routing
      ? `
        <div class="action-queue-handoff-summary">
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Direct path offered</span>
            <strong class="action-queue-detail-value">${escapeHtml(routing.ctaType ? `${routing.ctaType} via ${routing.targetType || "route"}` : "No direct path offered")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">CTA clicked</span>
            <strong class="action-queue-detail-value">${escapeHtml(routing.clicked ? `Yes${routing.lastClickedAt ? ` · ${formatSeenAt(routing.lastClickedAt)}` : ""}` : "No click yet")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Intent behind route</span>
            <strong class="action-queue-detail-value">${escapeHtml(trimText(routing.relatedIntentType) || "Not stored")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">What happened next</span>
            <strong class="action-queue-detail-value">${escapeHtml(routing.clicked && leadCapture?.state === "captured" ? "CTA clicked and contact captured" : routing.clicked ? "CTA clicked" : leadCapture?.state === "captured" ? "Contact captured without CTA click" : "Still in chat")}</strong>
          </div>
        </div>
      `
      : "";
    const outcomeSummary = outcomeState
      ? `
        <div class="action-queue-handoff-summary">
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Attributed outcomes</span>
            <strong class="action-queue-detail-value">${escapeHtml(String(outcomeState.count || 0))}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Latest outcome</span>
            <strong class="action-queue-detail-value">${escapeHtml(outcomeState.latest ? getOutcomeTypeLabel(outcomeState.latest.outcomeType) : "No attributed outcome yet")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Outcome path</span>
            <strong class="action-queue-detail-value">${escapeHtml(trimText(outcomeState.latest?.attributionPath).replaceAll("_", " ") || "Not attributed yet")}</strong>
          </div>
          <div class="action-queue-handoff-item">
            <span class="action-queue-detail-label">Latest page</span>
            <strong class="action-queue-detail-value">${escapeHtml(trimText(outcomeState.latest?.pageUrl || outcomeState.latest?.successUrl) || "No page captured")}</strong>
          </div>
        </div>
      `
      : "";
    const manualOutcomeSummary = allowStatusUpdates && manualOutcomeVisible
      ? `
        <form class="action-queue-follow-up-form" data-manual-outcome-form data-action-key="${escapeHtml(item.key || "")}" data-lead-id="${escapeHtml(leadCapture?.id || "")}" data-follow-up-id="${escapeHtml(followUp?.id || leadCapture?.relatedFollowUpId || "")}" data-session-id="${escapeHtml(item.sessionKey || "")}" data-person-key="${escapeHtml(item.person?.key || item.personKey || "")}" data-intent-type="${escapeHtml(item.intent || "")}" data-action-type="${escapeHtml(item.actionType || "")}">
          <div class="form-grid two-col">
            <div class="field">
              <label for="manual-outcome-type-${escapeHtml(item.key || "")}">Fallback outcome mark</label>
              <select id="manual-outcome-type-${escapeHtml(item.key || "")}" name="outcome_type" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
                <option value="booking_confirmed">booking confirmed</option>
                <option value="quote_requested">quote requested</option>
                <option value="quote_accepted">quote accepted</option>
                <option value="checkout_completed">checkout completed</option>
                <option value="follow_up_replied">follow-up replied</option>
                <option value="complaint_resolved">complaint resolved</option>
                <option value="manual_outcome_marked">fallback catch-all / no outcome</option>
              </select>
              <p class="field-help">${escapeHtml(agent.manualOutcomeMode === true ? "Use this only when automatic confirmation is unavailable." : "Enable fallback outcome mode in Settings before using this fallback.")}</p>
            </div>
            <div class="field">
              <label for="manual-outcome-note-${escapeHtml(item.key || "")}">Context note</label>
              <input id="manual-outcome-note-${escapeHtml(item.key || "")}" name="note" type="text" placeholder="Owner confirmed this outside the thank-you page." ${agent.manualOutcomeMode === true ? "" : "disabled"}>
            </div>
          </div>
          <div class="action-queue-form-actions">
            <button class="ghost-button" type="submit" ${agent.manualOutcomeMode === true ? "" : "disabled"}>Record fallback outcome</button>
            <span class="action-queue-meta-inline">Manual marks still attach to the same queue item, lead, and follow-up context when available.</span>
          </div>
        </form>
      `
      : "";
    const followUpSummary = followUpSupported
      ? `
        ${followUpWorkflowMigrationRequired ? `<div class="placeholder-card">Prepared follow-up is visible, but still read-only while this workspace finishes setup.</div>` : ""}
        ${followUp ? `
          <form class="action-queue-follow-up-form" data-follow-up-form data-follow-up-id="${escapeHtml(followUp.id || "")}" data-action-key="${escapeHtml(item.key || "")}">
            <div class="action-queue-handoff-summary">
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Service action</span>
                <strong class="action-queue-detail-value">${escapeHtml(getOperatorActionTypeLabel(item))}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Follow-up status</span>
                <strong class="action-queue-detail-value">${escapeHtml(getFollowUpStatusLabel(followUp.status))}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Channel</span>
                <strong class="action-queue-detail-value">${escapeHtml(formatFollowUpChannel(followUp.channel))}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Why this was prepared</span>
                <strong class="action-queue-detail-value">${escapeHtml(followUp.whyPrepared || item.whyFlagged || "Prepared from this queue item.")}</strong>
              </div>
            </div>
            <div class="action-queue-secondary-action">
              ${item.messageId ? `<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(item.messageId)}">Open related conversation</button>` : ""}
              <button class="ghost-button" type="button" data-copy-follow-up ${trimText(followUp.draftContent) ? "" : "disabled"}>Copy draft</button>
            </div>
            <div class="form-grid two-col">
              <div class="field">
                <label for="follow-up-subject-${escapeHtml(item.key || "")}">Subject</label>
                <input id="follow-up-subject-${escapeHtml(item.key || "")}" name="subject" type="text" value="${escapeHtml(followUp.subject || "")}" ${followUpActionsDisabled || followUpReadOnly ? "disabled" : ""}>
              </div>
              <div class="field">
                <label for="follow-up-status-${escapeHtml(item.key || "")}">Current status</label>
                <input id="follow-up-status-${escapeHtml(item.key || "")}" type="text" value="${escapeHtml(getFollowUpStatusLabel(followUp.status))}" disabled>
                <p class="field-help">${escapeHtml(followUpNeedsContact ? "No sendable contact is stored yet. Keep the draft context, review the conversation, and wait for contact capture." : followUpStatus === "sent" ? "This follow-up is resolved unless you deliberately reopen it." : "Mark sent after you send this outreach outside Vonza." )}</p>
              </div>
            </div>
            <div class="field">
              <label for="follow-up-draft-${escapeHtml(item.key || "")}">Draft</label>
              <textarea id="follow-up-draft-${escapeHtml(item.key || "")}" name="draft_content" ${followUpActionsDisabled || followUpReadOnly ? "disabled" : ""}>${escapeHtml(followUp.draftContent || "")}</textarea>
            </div>
            ${followUp.lastError ? `<p class="action-queue-copy">${escapeHtml(`Last failure: ${followUp.lastError}`)}</p>` : ""}
            <div class="action-queue-form-actions">
              <button class="primary-button" type="submit" ${followUpActionsDisabled || followUpReadOnly ? "disabled" : ""}>Save draft</button>
              <button class="ghost-button" type="button" data-follow-up-status-action data-next-status="ready" ${followUpActionsDisabled || followUpNeedsContact || followUpReadOnly ? "disabled" : ""}>Mark ready</button>
              <button class="ghost-button" type="button" data-follow-up-status-action data-next-status="sent" ${followUpActionsDisabled || followUpNeedsContact || followUpReadOnly ? "disabled" : ""}>Mark sent</button>
              <button class="ghost-button" type="button" data-follow-up-status-action data-next-status="dismissed" ${followUpActionsDisabled || followUpStatus === "sent" ? "disabled" : ""}>Dismiss</button>
              <span class="action-queue-meta-inline">${escapeHtml(followUpNeedsContact ? "Vonza kept the draft context but blocked sending until contact capture exists." : "This draft stays deterministic and grounded in the captured conversation context.")}</span>
            </div>
          </form>
        ` : `<div class="placeholder-card">Vonza will prepare a follow-up workflow for this queue item as soon as the server bridge syncs it.</div>`}
      `
      : "";
    const knowledgeFix = item.knowledgeFix && typeof item.knowledgeFix === "object" ? item.knowledgeFix : null;
    const knowledgeFixStatus = trimText(knowledgeFix?.status).toLowerCase();
    const knowledgeFixSupported = item.knowledgeFixSupported === true;
    const knowledgeFixActionsDisabled = !allowStatusUpdates || !knowledgeFixWorkflowAvailable || !knowledgeFix?.id;
    const knowledgeFixReadOnly = knowledgeFixStatus === "applied" || knowledgeFixStatus === "dismissed";
    const knowledgeFixSummary = knowledgeFixVisible && knowledgeFixSupported
      ? `
        ${knowledgeFixWorkflowMigrationRequired ? `<div class="placeholder-card">Prepared knowledge improvements are visible, but still read-only while this workspace finishes setup.</div>` : ""}
        ${knowledgeFix ? `
          <form class="action-queue-knowledge-fix-form" data-knowledge-fix-form data-knowledge-fix-id="${escapeHtml(knowledgeFix.id || "")}" data-action-key="${escapeHtml(item.key || "")}">
            <div class="action-queue-handoff-summary">
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Service action</span>
                <strong class="action-queue-detail-value">${escapeHtml(getOperatorActionTypeLabel(item))}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Fix status</span>
                <strong class="action-queue-detail-value">${escapeHtml(getKnowledgeFixStatusLabel(knowledgeFix.status))}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Fix target</span>
                <strong class="action-queue-detail-value">${escapeHtml(knowledgeFix.targetLabel || "Advanced guidance / system prompt")}</strong>
              </div>
              <div class="action-queue-handoff-item">
                <span class="action-queue-detail-label">Occurrences</span>
                <strong class="action-queue-detail-value">${escapeHtml(String(knowledgeFix.occurrenceCount || 1))}</strong>
              </div>
            </div>
            <div class="action-queue-secondary-action">
              ${item.messageId ? `<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(item.messageId)}">Open related conversation</button>` : ""}
              <button class="ghost-button" type="button" data-shell-target="customize" data-frontdesk-open="customization">Open customization</button>
            </div>
            <div class="action-queue-details">
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">What the visitor asked</span>
                <strong class="action-queue-detail-value">${escapeHtml(knowledgeFix.evidence?.question || item.question || "No visitor question stored yet.")}</strong>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">What was missing or weak</span>
                <strong class="action-queue-detail-value">${escapeHtml(knowledgeFix.issueSummary || "No issue summary yet.")}</strong>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Why it matters</span>
                <strong class="action-queue-detail-value">${escapeHtml(knowledgeFix.mattersSummary || "No impact summary yet.")}</strong>
              </div>
              <div class="action-queue-detail">
                <span class="action-queue-detail-label">Imported knowledge state</span>
                <strong class="action-queue-detail-value">${escapeHtml(formatKnowledgeState(knowledgeFix.evidence?.knowledgeState))}</strong>
                <p class="action-queue-copy">${escapeHtml(knowledgeFix.evidence?.websiteUrl || "No website URL stored.")}</p>
              </div>
            </div>
            <div class="form-grid two-col">
              <div class="field">
                <label for="knowledge-fix-response-${escapeHtml(item.key || "")}">Current assistant response</label>
                <textarea id="knowledge-fix-response-${escapeHtml(item.key || "")}" disabled>${escapeHtml(knowledgeFix.evidence?.currentResponse || "No usable assistant response was captured.")}</textarea>
              </div>
              <div class="field">
                <label for="knowledge-fix-system-prompt-${escapeHtml(item.key || "")}">Current advanced guidance</label>
                <textarea id="knowledge-fix-system-prompt-${escapeHtml(item.key || "")}" disabled>${escapeHtml(knowledgeFix.evidence?.currentSystemPrompt || "No advanced guidance is set yet.")}</textarea>
              </div>
            </div>
            <div class="field">
              <label for="knowledge-fix-evidence-${escapeHtml(item.key || "")}">Conversation evidence</label>
              <textarea id="knowledge-fix-evidence-${escapeHtml(item.key || "")}" disabled>${escapeHtml(knowledgeFix.evidence?.conversationExcerpt || item.snippet || "")}</textarea>
            </div>
            <div class="field">
              <label for="knowledge-fix-content-${escapeHtml(item.key || "")}">Relevant imported website content</label>
              <textarea id="knowledge-fix-content-${escapeHtml(item.key || "")}" disabled>${escapeHtml(knowledgeFix.evidence?.relevantContent || "No relevant imported website content was available for this question.")}</textarea>
            </div>
            <div class="field">
              <label for="knowledge-fix-guidance-${escapeHtml(item.key || "")}">Drafted guidance to add</label>
              <textarea id="knowledge-fix-guidance-${escapeHtml(item.key || "")}" name="proposed_guidance" ${knowledgeFixActionsDisabled || knowledgeFixReadOnly ? "disabled" : ""}>${escapeHtml(knowledgeFix.proposedGuidance || "")}</textarea>
              <p class="field-help">${escapeHtml(knowledgeFixStatus === "applied" ? "This fix is already in the assistant guidance. Reopen only by drafting a new fix if the issue comes back." : "Keep the first version tight and deterministic. The safest direct apply target is advanced guidance.")}</p>
            </div>
            ${knowledgeFix.lastError ? `<p class="action-queue-copy">${escapeHtml(`Last failure: ${knowledgeFix.lastError}`)}</p>` : ""}
            <div class="action-queue-form-actions">
              <button class="primary-button" type="submit" ${knowledgeFixActionsDisabled || knowledgeFixReadOnly ? "disabled" : ""}>Save draft</button>
              <button class="ghost-button" type="button" data-knowledge-fix-status-action data-next-status="ready" ${knowledgeFixActionsDisabled || knowledgeFixReadOnly ? "disabled" : ""}>Mark ready</button>
              <button class="ghost-button" type="button" data-knowledge-fix-status-action data-next-status="applied" ${knowledgeFixActionsDisabled || !trimText(knowledgeFix.proposedGuidance) || knowledgeFixReadOnly ? "disabled" : ""}>Apply fix</button>
              <button class="ghost-button" type="button" data-knowledge-fix-status-action data-next-status="dismissed" ${knowledgeFixActionsDisabled || knowledgeFixStatus === "applied" ? "disabled" : ""}>Dismiss</button>
              <span class="action-queue-meta-inline">${escapeHtml(knowledgeFix.targetLabel || "Applies to advanced guidance / system prompt.")}</span>
            </div>
          </form>
        ` : `<div class="placeholder-card">Vonza will prepare a knowledge-fix workflow for this queue item as soon as the server bridge syncs it.</div>`}
      `
      : "";
    const queueDetailDisclosure = buildDisclosureBlock({
      label: "View details",
      summary: [formatActionQueueContact(item), recencyLabel].filter(Boolean).join(" · "),
      className: "disclosure-block-inline action-queue-disclosure",
      contentMarkup: `
        <div class="action-queue-details">
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Conversation summary</span>
            <strong class="action-queue-detail-value">${escapeHtml(item.snippet || "No customer question stored yet.")}</strong>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Why it was flagged</span>
            <strong class="action-queue-detail-value">${escapeHtml(item.whyFlagged || "Flagged from recent conversation activity.")}</strong>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Service action</span>
            <strong class="action-queue-detail-value">${escapeHtml(getOperatorActionTypeLabel(item))}</strong>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Contact</span>
            <strong class="action-queue-detail-value">${escapeHtml(formatActionQueueContact(item))}</strong>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Visitor thread</span>
            <strong class="action-queue-detail-value">${escapeHtml(item.person?.label || "Unknown visitor")}</strong>
            <p class="action-queue-copy">${escapeHtml(item.person?.story || "Vonza could not confidently stitch this item to another visitor interaction yet.")}</p>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Owner follow-up state</span>
            <strong class="action-queue-detail-value">${escapeHtml(workflow.label)}</strong>
            <p class="action-queue-copy">${escapeHtml(workflow.copy)}</p>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Suggested next action</span>
            <strong class="action-queue-detail-value">${escapeHtml(item.suggestedAction || "Review the conversation pattern and improve the assistant or website flow.")}</strong>
          </div>
          <div class="action-queue-detail">
            <span class="action-queue-detail-label">Recency</span>
            <strong class="action-queue-detail-value">${escapeHtml(metaLine)}</strong>
          </div>
        </div>
      `,
    });

    return `
    <article
      class="action-queue-item"
      data-action-queue-item
      data-action-key="${escapeHtml(item.key || "")}"
      data-action-queue-type="${escapeHtml(item.type || "")}"
      data-action-queue-status="${escapeHtml(normalizeActionQueueStatus(item.status))}"
    >
      <div class="action-queue-item-top">
        <div class="action-queue-headline">
          <div class="action-queue-badges">
            <span class="pill">${escapeHtml(getOperatorActionTypeLabel(item))}</span>
            <span class="${getActionQueueStatusBadgeClass(item.status)}">${escapeHtml(getActionQueueStatusLabel(item.status))}</span>
            <span class="${getActionQueueOwnerWorkflowBadgeClass(item)}">${escapeHtml(workflow.label)}</span>
            ${followUp ? `<span class="${getFollowUpStatusBadgeClass(followUp.status)}">${escapeHtml(getFollowUpStatusLabel(followUp.status))}</span>` : ""}
            ${knowledgeFixVisible && knowledgeFix ? `<span class="${getKnowledgeFixStatusBadgeClass(knowledgeFix.status)}">${escapeHtml(getKnowledgeFixStatusLabel(knowledgeFix.status))}</span>` : ""}
            <span class="pill">${escapeHtml(`${item.count || 0} conversation${item.count === 1 ? "" : "s"}`)}</span>
            ${personThreadLabel ? `<span class="pill">${escapeHtml(personThreadLabel)}</span>` : ""}
          </div>
          <h4 class="action-queue-title">${escapeHtml(item.label || getActionQueueTypeLabel(item.type))}</h4>
          <p class="action-queue-copy">${escapeHtml(item.whyFlagged || "Flagged from recent conversation activity.")}</p>
        </div>
        ${allowStatusUpdates ? `
          <label class="action-queue-control">
            <span class="action-queue-control-label">Status</span>
            <select
              data-action-queue-status
              data-action-key="${escapeHtml(item.key || "")}"
              ${allowStatusUpdates ? "" : "disabled"}
            >
              ${buildStatusOptions(item.status)}
            </select>
          </label>
        ` : `
          <div class="action-queue-meta-inline">${escapeHtml(metaLine)}</div>
        `}
      </div>
      ${allowStatusUpdates ? `<p class="action-queue-meta-inline">${escapeHtml([formatActionQueueContact(item), workflow.label, recencyLabel].filter(Boolean).join(" · "))}</p>` : ""}
      ${queueDetailDisclosure}
      ${compact ? "" : `
        <div class="action-queue-handoff">
          ${followUpSummary}
          ${knowledgeFixSummary}
          ${routingSummary}
          ${outcomeSummary}
          ${leadCaptureSummary}
          ${manualOutcomeSummary}
          <div class="action-queue-handoff-summary">
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Owner note</span>
              <strong class="action-queue-detail-value">${escapeHtml(item.note || "No owner note yet.")}</strong>
            </div>
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Outcome</span>
              <strong class="action-queue-detail-value">${escapeHtml(item.outcome || "No outcome recorded yet.")}</strong>
            </div>
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Next step</span>
              <strong class="action-queue-detail-value">${escapeHtml(item.nextStep || "No next step recorded yet.")}</strong>
            </div>
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Follow-up needed</span>
              <strong class="action-queue-detail-value">${escapeHtml(getFollowUpBooleanLabel(item.followUpNeeded))}</strong>
            </div>
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Follow-up completed</span>
              <strong class="action-queue-detail-value">${escapeHtml(getFollowUpBooleanLabel(item.followUpCompleted))}</strong>
            </div>
            <div class="action-queue-handoff-item">
              <span class="action-queue-detail-label">Contact status</span>
              <strong class="action-queue-detail-value">${escapeHtml(item.contactCaptured ? getContactStatusLabel(item.contactStatus) : "Contact not captured")}</strong>
            </div>
          </div>
          <div class="action-queue-secondary-action">
            <button
              class="ghost-button"
              type="button"
              data-action-queue-toggle
              data-action-key="${escapeHtml(item.key || "")}"
              data-open-label="${escapeHtml(toggleOpenLabel)}"
              data-close-label="Hide follow-up note"
            >
              ${handoffOpenByDefault ? "Hide follow-up note" : escapeHtml(toggleOpenLabel)}
            </button>
          </div>
          <form class="action-queue-form" data-action-queue-form data-action-key="${escapeHtml(item.key || "")}" ${handoffOpenByDefault ? "" : "hidden"}>
            <div class="form-grid two-col">
              <div class="field">
                <label for="queue-note-${escapeHtml(item.key || "")}">Owner note</label>
                <textarea id="queue-note-${escapeHtml(item.key || "")}" name="note" ${allowStatusUpdates ? "" : "disabled"}>${escapeHtml(item.note || "")}</textarea>
              </div>
              <div class="field">
                <label for="queue-outcome-${escapeHtml(item.key || "")}">Outcome / resolution</label>
                <textarea id="queue-outcome-${escapeHtml(item.key || "")}" name="outcome" ${allowStatusUpdates ? "" : "disabled"}>${escapeHtml(item.outcome || "")}</textarea>
              </div>
            </div>
            <div class="form-grid two-col">
              <div class="field">
                <label for="queue-next-step-${escapeHtml(item.key || "")}">Next step</label>
                <input id="queue-next-step-${escapeHtml(item.key || "")}" name="next_step" type="text" value="${escapeHtml(item.nextStep || "")}" ${allowStatusUpdates ? "" : "disabled"}>
              </div>
              <div class="field">
                <label for="queue-contact-status-${escapeHtml(item.key || "")}">Contact status</label>
                <select id="queue-contact-status-${escapeHtml(item.key || "")}" name="contact_status" ${allowStatusUpdates && item.contactCaptured ? "" : "disabled"}>
                  ${buildContactStatusOptions(item.contactStatus)}
                </select>
                <p class="field-help">${escapeHtml(item.contactCaptured ? "Use this if the conversation captured contact details." : "Contact status becomes relevant once contact information is captured.")}</p>
              </div>
            </div>
            <div class="form-grid two-col">
              <div class="field">
                <label for="queue-follow-up-needed-${escapeHtml(item.key || "")}">Follow-up needed</label>
                <select id="queue-follow-up-needed-${escapeHtml(item.key || "")}" name="follow_up_needed" ${allowStatusUpdates ? "" : "disabled"}>
                  <option value="" ${item.followUpNeeded === null || item.followUpNeeded === undefined ? "selected" : ""}>Not set</option>
                  <option value="true" ${item.followUpNeeded === true ? "selected" : ""}>Yes</option>
                  <option value="false" ${item.followUpNeeded === false ? "selected" : ""}>No</option>
                </select>
              </div>
              <div class="field">
                <label for="queue-follow-up-completed-${escapeHtml(item.key || "")}">Follow-up completed</label>
                <select id="queue-follow-up-completed-${escapeHtml(item.key || "")}" name="follow_up_completed" ${allowStatusUpdates ? "" : "disabled"}>
                  <option value="" ${item.followUpCompleted === null || item.followUpCompleted === undefined ? "selected" : ""}>Not set</option>
                  <option value="true" ${item.followUpCompleted === true ? "selected" : ""}>Yes</option>
                  <option value="false" ${item.followUpCompleted === false ? "selected" : ""}>No</option>
                </select>
              </div>
            </div>
            <div class="action-queue-form-actions">
              <button class="primary-button" type="submit" ${allowStatusUpdates ? "" : "disabled"}>Save follow-up note</button>
              <span class="action-queue-meta-inline">${escapeHtml(migrationRequired ? "This queue is still finishing setup, so changes are temporarily read-only." : "Keep this lightweight: note what happened, record the outcome, and decide whether follow-up is still needed.")}</span>
            </div>
          </form>
        </div>
      `}
    </article>
  `;
  }).join("");

  // Open operator actions
  return `
    <section class="${compact ? "workspace-card-soft action-queue-shell compact" : "overview-card overview-card-queue action-queue-shell"}" ${compact ? "" : 'data-action-queue-section'}>
      <div class="action-queue-header">
        <div>
          <h3 class="${compact ? "studio-group-title" : "overview-card-title"}">${sectionTitle}</h3>
          <p class="${compact ? "studio-group-copy" : "overview-card-copy"}">${escapeHtml(sectionCopy)}</p>
        </div>
        <div class="action-queue-summary">
          ${buildActionQueueSummaryPills(summary).map((label) => `
            <span class="pill">${escapeHtml(label)}</span>
          `).join("")}
        </div>
      </div>
      ${migrationRequired ? `<div class="placeholder-card">The follow-up queue is still finishing setup on this workspace, so updates are temporarily read-only.</div>` : ""}
      ${!migrationRequired && followUpWorkflowMigrationRequired ? `<div class="placeholder-card">Prepared follow-up drafts are visible, but editing is temporarily read-only while this workspace finishes setup.</div>` : ""}
      ${knowledgeFixVisible && !migrationRequired && knowledgeFixWorkflowMigrationRequired ? `<div class="placeholder-card">Prepared knowledge improvements are visible, but editing is temporarily read-only while this workspace finishes setup.</div>` : ""}
      ${visibleItems.length ? `
        ${compact ? `
          <div class="action-queue-secondary-action">
            <button class="ghost-button" type="button" data-overview-target="overview">Review in Home</button>
          </div>
        ` : `
          <div class="action-queue-filter-row">
            <label class="action-queue-filter">
              <span class="action-queue-filter-label">Filter by type</span>
              <select data-action-queue-filter-type>
                <option value="all">All types</option>
                <option value="contact">Lead / contact</option>
                <option value="booking">Booking</option>
                <option value="pricing">Pricing / purchase</option>
                <option value="repeat_high_intent">Repeat high intent</option>
                <option value="support">Support / complaint</option>
                <option value="weak_answer">Weak answers</option>
              </select>
            </label>
            <label class="action-queue-filter">
              <span class="action-queue-filter-label">Filter by status</span>
              <select data-action-queue-filter-status>
                <option value="all">All statuses</option>
                ${ACTION_QUEUE_STATUSES.map((status) => `
                  <option value="${status}">${getActionQueueStatusLabel(status)}</option>
                `).join("")}
              </select>
            </label>
          </div>
        `}
        <div class="action-queue-list">
          ${itemsMarkup}
        </div>
        ${compact ? "" : `<div class="placeholder-card action-queue-filter-empty" hidden>No action items match the current filters. Adjust the filters to see the queue again.</div>`}
      ` : `<div class="placeholder-card">${escapeHtml(emptyCopy)}</div>`}
    </section>
  `;
}

function buildOverviewState(agent, messages, setup, actionQueue = createEmptyActionQueue()) {
  const installStatus = getDefaultInstallStatus(agent);
  const fullPageEnabled = isPublicFullPageEnabled(agent);
  const hasFrontDeskPage = Boolean(trimText(agent.id || agent.publicAgentKey));
  const hasConversation = messages.some((message) => trimText(message?.role).toLowerCase() === "user");
  const hasDistributionChannel = fullPageEnabled || Boolean(trimText(agent.installId)) || isInstallDetected(installStatus);
  const signals = analyzeConversationSignals(messages);
  const analyticsSummary = getAnalyticsSummary(actionQueue, agent, messages);
  const messageCount = Number(analyticsSummary.totalMessages || 0);
  const highIntentSignals = Number(analyticsSummary.highIntentSignals || 0);
  const lastActivity = analyticsSummary.recentActivity.lastActivityAt || installStatus.lastSeenAt || null;
  const activity = analyticsSummary.recentActivity;
  const topIntent = signals.topIntentEntries[0];
  const recentQuestions = signals.recentQuestions || [];
  const queueSummary = {
    ...createEmptyActionQueue().summary,
    ...(actionQueue.summary || {}),
  };
  const peopleSummary = {
    ...createEmptyActionQueue().peopleSummary,
    ...(actionQueue.peopleSummary || {}),
  };
  const conversionSummary = {
    ...createEmptyActionQueue().conversionSummary,
    ...(actionQueue.conversionSummary || {}),
  };
  const outcomeSummary = {
    ...createEmptyActionQueue().outcomeSummary,
    ...(actionQueue.outcomeSummary || {}),
  };

  const nextActions = [];
  let primaryAction;
  let title;
  let copy;

  if (!setup.isReady) {
    title = "Home is open. The next step is finishing the Front Desk page.";
    copy = "Use Front Desk and Settings to shape the experience, confirm routing and website knowledge, and make sure the customer-facing page feels ready before you share it.";
    primaryAction = {
      label: "Continue setup",
      type: "section",
      value: "customize",
    };
    if (trimText(agent.publicAgentKey)) {
      nextActions.push({
        label: "Try your front desk",
        type: "preview",
      });
    }
  } else if (isInstallSeen(installStatus)) {
    if (queueSummary.attentionNeeded > 0) {
      title = `Your front desk is live and ${queueSummary.attentionNeeded} action item${queueSummary.attentionNeeded === 1 ? "" : "s"} need attention`;
      copy = `Vonza is live on ${installStatus.host || "your site"} and is surfacing visitor conversations, follow-up work, and owner tasks that deserve attention.`;
      primaryAction = {
        label: "Review follow-up queue",
        type: "focus",
        value: "action-queue",
      };
      nextActions.push({
        label: "Review analytics",
        type: "section",
        value: "analytics",
      });
    } else if (analyticsSummary.weakAnswerCount > 0) {
      title = "Your front desk is live, and a few answers need strengthening";
      copy = `Vonza is active on ${installStatus.host || "your site"}, and some real customer questions are showing where the front desk still needs help.`;
      primaryAction = {
        label: "Review weak answers",
        type: "section",
        value: "analytics",
      };
      nextActions.push({
        label: "Open Front Desk",
        type: "section",
        value: "customize",
      });
    } else if (highIntentSignals > 0) {
      title = "Your front desk is live and showing real buyer intent";
      copy = `Vonza is live on ${installStatus.host || "your site"} and is already capturing high-value visitor intent you can act on.`;
      primaryAction = {
        label: "Review analytics",
        type: "section",
        value: "analytics",
      };
      nextActions.push({
        label: "Open Front Desk",
        type: "section",
        value: "customize",
      });
    } else if (messageCount > 0) {
      title = "Your front desk is live and already working";
      copy = `Vonza is live on ${installStatus.host || "your site"} and has already started handling real customer questions and next-step routing.`;
      primaryAction = {
        label: "Review analytics",
        type: "section",
        value: "analytics",
      };
      nextActions.push({
        label: "Open Front Desk",
        type: "section",
        value: "customize",
      });
    } else {
      title = "Your front desk is live";
      copy = `Vonza has been detected on ${installStatus.host || "your site"} and is ready for customer questions, even if activity is still early.`;
      primaryAction = {
        label: "Try your front desk",
        type: "preview",
      };
      nextActions.push({
        label: "Open Front Desk",
        type: "section",
        value: "customize",
      });
      nextActions.push({
        label: "Try your front desk",
        type: "preview",
      });
    }
  } else if (fullPageEnabled) {
    title = "Your Front Desk page is live";
    copy = "The public assistant page is enabled. Test the Front Desk, keep improving answer quality, and choose the distribution channels that fit the business.";
    primaryAction = {
      label: "Open Front Desk page",
      type: "preview",
    };
    nextActions.push({
      label: "Open Front Desk",
      type: "section",
      value: "customize",
    });
  } else if (installStatus.state === "installed_unseen") {
    title = "Your website bubble is published and waiting for first live traffic";
    copy = "Vonza found the optional website widget snippet. The primary launch step is still enabling and testing the public Front Desk page.";
    primaryAction = {
      label: "Enable Front Desk page",
      type: "section",
      value: "settings",
    };
    nextActions.push({
      label: "Review install",
      type: "focus",
      value: "install",
    });
  } else if (installStatus.state === "domain_mismatch") {
    title = "Your install needs a quick fix";
    copy = "Vonza found embed markup, but it does not match the current install. Replace older snippets before launch.";
    primaryAction = {
      label: "Review install",
      type: "focus",
      value: "install",
    };
    nextActions.push({
      label: "Copy install code",
      type: "install",
    });
  } else if (installStatus.state === "verify_failed") {
    title = "Your front desk is ready for verification";
    copy = "The setup is in place, but the live install has not verified yet. Publish the snippet, then run the check again.";
    primaryAction = {
      label: "Add to website",
      type: "focus",
      value: "install",
    };
    nextActions.push({
      label: "Copy install code",
      type: "install",
    });
  } else {
    title = "Your Front Desk page is almost ready to go live";
    copy = "The setup is in place. Enable the public Front Desk page, test a real customer question, then choose a distribution channel such as WordPress, smart embed, QR/direct link, or the optional website bubble.";
    primaryAction = {
      label: "Open install",
      type: "focus",
      value: "install",
    };
    nextActions.push({
      label: "Open Front Desk",
      type: "section",
      value: "customize",
    });
  }

  if (!setup.knowledgeReady) {
    if (primaryAction) {
      nextActions.unshift(primaryAction);
    }
    primaryAction = {
      label: "Strengthen website knowledge",
      type: "import",
    };
  }

  const progressItems = [
    {
      title: "Front Desk created",
      copy: hasFrontDeskPage
        ? "The AI Front Desk workspace exists."
        : "Create the Front Desk workspace first.",
      done: hasFrontDeskPage,
    },
    {
      title: "Public Front Desk page",
      copy: fullPageEnabled
        ? "Your Front Desk page is live."
        : "Enable the public assistant page before sharing QR codes or links.",
      done: fullPageEnabled,
    },
    {
      title: "Front Desk customized",
      copy: setup.isReady
        ? "The front desk has the core details it needs."
        : "The front desk still needs a few setup details before launch.",
      done: setup.isReady,
    },
    {
      title: "Training ready",
      copy: setup.knowledgeReady
        ? "Website knowledge and grounding are ready for practice."
        : "Strengthen website knowledge and improvements before launch.",
      done: setup.knowledgeReady,
    },
    {
      title: "First test conversation",
      copy: hasConversation
        ? "A test or customer conversation exists."
        : "Run one realistic Front Desk conversation.",
      done: hasConversation,
    },
    {
      title: "Distribution channel selected",
      copy: hasDistributionChannel
        ? "At least one Front Desk distribution path is available."
        : "Choose WordPress, smart embed, QR/direct link, or the optional website bubble.",
      done: hasDistributionChannel,
    },
  ];

  const cards = [];

  if (isInstallSeen(installStatus) && messageCount === 0) {
    cards.push({
      title: "Now help visitors notice it",
      copy: "Make the launcher text and welcome message stronger, then test a few common customer questions so the first interaction feels clear and helpful.",
    });
  }

  if (isInstallSeen(installStatus) && messageCount > 0) {
    const topIntentLabelMap = {
      general: "early customer-service questions that need clearer context",
      services: "services and what the business offers",
      pricing: "pricing and purchase intent",
      contact: "direct contact or lead intent",
      booking: "booking and availability",
      support: "support or complaint-style requests",
    };

    cards.push({
      title: "Customers are already using it",
      copy: topIntent?.[1]
        ? `Recent activity suggests customers are asking most often about ${topIntentLabelMap[topIntent[0]]}.`
        : "Recent activity shows customers are starting to use the front desk on your site.",
    });

    if (recentQuestions.length) {
      cards.push({
        title: "Recent questions",
        copy: recentQuestions.join(" • "),
      });
    }
  }

  if (!cards.length) {
    cards.push({
      title: "Next best move",
      copy: isInstallSeen(installStatus)
        ? "Keep testing the front desk on your site and review the wording, welcome message, routing, and response style until it feels like a natural part of the business."
        : "Once the front desk is installed on a live site, Vonza will start showing real usage and recent customer questions here.",
    });
  }

  return {
    installStatus,
    analyticsSummary,
    messageCount,
    lastActivity,
    activity,
    signals,
    queueSummary,
    peopleSummary,
    conversionSummary,
    outcomeSummary,
    cards,
    primaryAction,
    nextActions: nextActions.slice(0, 2),
    progressItems,
    title,
    copy,
  };
}

function buildOverviewActionMarkup(agent, action = null, { primary = false } = {}) {
  if (!action) {
    return "";
  }

  const buttonClass = primary ? "primary-button" : "ghost-button";
  const actionLabel = action.type === "section"
    && trimText(action.value) === "analytics"
    && /^review\b/i.test(trimText(action.label))
      ? localizeDashboardCopy("View analytics", "Elemzések megtekintése")
      : trimText(action.label);

  if (action.type === "section") {
    return `<button class="${buttonClass}" type="button" data-overview-target="${escapeHtml(action.value)}" ${action.filter ? `data-contact-filter="${escapeHtml(action.filter)}"` : ""} ${action.targetId ? `data-target-id="${escapeHtml(action.targetId)}"` : ""}>${escapeHtml(actionLabel)}</button>`;
  }

  if (action.type === "focus") {
    return `<button class="${buttonClass}" type="button" data-overview-focus="${escapeHtml(action.value)}">${escapeHtml(actionLabel)}</button>`;
  }

  if (action.type === "import") {
    const isRetry = /retry|refresh/i.test(actionLabel);
    return `<button class="${buttonClass}" type="button" data-action="import-knowledge" ${isRetry ? 'data-import-force="true"' : ""}>${escapeHtml(actionLabel)}</button>`;
  }

  if (action.type === "install") {
    return `<button class="${buttonClass}" type="button" data-action="copy-install" ${trimText(agent.installId) ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>`;
  }

  if (action.type === "preview") {
    const previewUrl = buildFrontDeskPreviewUrl(agent);
    return `<a class="${primary ? "primary-button" : "test-link"} ${previewUrl ? "" : "disabled"}" data-action="open-preview" href="${previewUrl ? escapeHtml(previewUrl) : "#"}" target="_blank" rel="noreferrer">${escapeHtml(actionLabel)}</a>`;
  }

  return "";
}

function getActivationWizardActiveStep(wizard = activationWizardState) {
  const steps = Array.isArray(wizard?.steps) ? wizard.steps : [];
  return steps.find((step) => step.active) || steps.find((step) => step.key === wizard?.currentStep) || steps[0] || null;
}

function buildActivationWizardProgressMarkup(wizard) {
  const steps = Array.isArray(wizard?.steps) ? wizard.steps : [];
  const completedCount = steps.filter((step) => step.complete).length;

  return `
    <div class="activation-progress" aria-label="Activation progress">
      <div class="activation-progress-head">
        <strong>${completedCount} / ${steps.length}</strong>
        <span>${escapeHtml(wizard?.isComplete ? "Complete" : "Activation")}</span>
      </div>
      <div class="activation-step-dots">
        ${steps.map((step) => `
          <span
            class="activation-step-dot ${step.complete ? "done" : ""} ${step.active ? "active" : ""} ${step.skipped ? "skipped" : ""}"
            title="${escapeHtml(step.label)}"
          ></span>
        `).join("")}
      </div>
    </div>
  `;
}

function buildActivationWizardActionMarkup(agent, wizard, activeStep) {
  const stepKey = activeStep?.key || wizard?.currentStep || "";
  const action = activeStep?.nextAction || wizard?.nextAction || {};

  if (stepKey === "business_basics") {
    const selectedVertical = normalizeBusinessVertical(agent.vertical);
    return `
      <form class="activation-form" data-activation-form="business_basics">
        <div class="activation-form-grid">
          <label>
            <span>Business name</span>
            <input name="name" type="text" value="${escapeHtml(agent.name || agent.assistantName || "")}" placeholder="Your business">
          </label>
          <label>
            <span>Website URL</span>
            <input name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}" placeholder="https://example.com">
          </label>
          <label>
            <span>Business type</span>
            <select name="vertical">
              ${BUSINESS_VERTICAL_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}" ${selectedVertical === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </label>
        </div>
        <div class="activation-actions">
          <button class="primary-button" type="submit">${escapeHtml(action.label || "Save basics")}</button>
          <button class="ghost-button" type="button" data-activation-skip="${escapeHtml(stepKey)}">Skip</button>
        </div>
      </form>
    `;
  }

  if (stepKey === "configure_assistant") {
    const selectedPurpose = normalizeWidgetPurpose(agent.purpose);
    return `
      <form class="activation-form" data-activation-form="configure_assistant">
        <div class="activation-form-grid">
          <label>
            <span>Assistant name</span>
            <input name="assistant_name" type="text" value="${escapeHtml(agent.assistantName || agent.name || "")}" placeholder="Website assistant">
          </label>
          <label>
            <span>Tone</span>
            <select name="tone">
              ${["friendly", "professional", "sales", "support"].map((tone) => `
                <option value="${escapeHtml(tone)}" ${trimText(agent.tone || "friendly") === tone ? "selected" : ""}>${escapeHtml(tone)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Purpose</span>
            <select name="widget_purpose">
              ${WIDGET_PURPOSE_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}" ${selectedPurpose === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Contact email</span>
            <input name="contact_email" type="email" value="${escapeHtml(agent.contactEmail || "")}" placeholder="team@example.com">
          </label>
        </div>
        <div class="activation-actions">
          <button class="primary-button" type="submit">${escapeHtml(action.label || "Save configuration")}</button>
          <button class="ghost-button" type="button" data-activation-skip="${escapeHtml(stepKey)}">Skip</button>
        </div>
      </form>
    `;
  }

  if (stepKey === "import_knowledge") {
    const importedPages = Number(agent.knowledge?.pageCount || 0);
    const importStatus = trimText(wizard?.importStatus || "");
    return `
      <div class="activation-import-summary">
        <div class="activation-detail-row">
          <span>Website</span>
          <strong>${escapeHtml(agent.websiteUrl || "No website saved yet")}</strong>
        </div>
        <div class="activation-detail-row">
          <span>Imported detail</span>
          <strong>${escapeHtml(importedPages ? `${importedPages} page${importedPages === 1 ? "" : "s"}` : formatKnowledgeState(agent.knowledge?.state || "missing"))}</strong>
        </div>
        ${importStatus === "failed" ? `<p class="activation-error">${escapeHtml(wizard?.importError || "Import failed. Retry when the site is reachable.")}</p>` : ""}
      </div>
      <div class="activation-actions">
        <button class="primary-button" type="button" data-activation-import ${agent.knowledge?.state === "missing" ? "" : 'data-import-force="true"'}>${escapeHtml(agent.knowledge?.state === "missing" ? action.label || "Import website knowledge" : "Retry website import")}</button>
        <button class="ghost-button" type="button" data-activation-skip="${escapeHtml(stepKey)}">Skip</button>
      </div>
    `;
  }

  if (stepKey === "install_widget") {
    const installStatus = getDefaultInstallStatus(agent);
    const live = isInstallSeen(installStatus);
    const frontDeskPageLive = isPublicFullPageEnabled(agent);
    return `
      <div class="activation-install-summary">
        <div class="activation-detail-row">
          <span>Status</span>
          <strong>${escapeHtml(frontDeskPageLive ? "Front Desk page live" : live ? "Optional website bubble live" : installStatus.label || "Front Desk page not enabled yet")}</strong>
        </div>
        <div class="activation-detail-row">
          <span>Front Desk page</span>
          <strong>${escapeHtml(frontDeskPageLive ? "Enabled" : "Disabled")}</strong>
        </div>
        <p>${escapeHtml(frontDeskPageLive ? "Your public Front Desk page is ready to share. Test one customer question next." : live ? "Vonza has detected the optional website bubble on the live site. Enable and test the Front Desk page next." : "Enable the Front Desk page first, then use the optional website bubble snippet only if you want a compact launcher on the live site.")}</p>
      </div>
      <div class="activation-actions">
        ${frontDeskPageLive || live
          ? `<button class="primary-button" type="button" data-activation-complete="${escapeHtml(stepKey)}">Continue to test</button>`
          : `<button class="primary-button" type="button" data-shell-target="install">${escapeHtml(action.label || "Open install")}</button>
             <button class="ghost-button" type="button" data-shell-target="customize" data-frontdesk-open="customization">Enable Front Desk page</button>`}
        <button class="ghost-button" type="button" data-activation-skip="${escapeHtml(stepKey)}">Skip</button>
      </div>
    `;
  }

  const needsImprovement = wizard?.signals?.needsImprovement === true || wizard?.testQuality === "needs_improvement";
  return `
    <form class="activation-form" data-activation-form="test_improve">
      <label>
        <span>Sample customer question</span>
        <textarea name="test_question" placeholder="What services do you offer, and how can I book?">${escapeHtml(wizard?.testQuestion || "")}</textarea>
      </label>
      <div class="activation-test-state ${needsImprovement ? "needs-improvement" : ""}">
        ${escapeHtml(needsImprovement
          ? "Needs improvement: review this in Analytics."
          : wizard?.signals?.hasPreviewTest ? "Test conversation detected." : "Use preview to ask one realistic customer question.")}
      </div>
      <div class="activation-actions">
        ${needsImprovement
          ? `<button class="primary-button" type="button" data-activation-open-improvement>Open Analytics</button>`
          : `<button class="primary-button" type="submit">${escapeHtml(action.label || "Ask a sample question")}</button>`}
        <button class="ghost-button" type="button" data-activation-complete="test_improve">Finish wizard</button>
      </div>
    </form>
  `;
}

function _buildActivationWizardMarkup(agent, wizard = activationWizardState) {
  if (!wizard || wizard.isComplete) {
    return "";
  }

  const activeStep = getActivationWizardActiveStep(wizard);

  if (!activeStep && !wizard.canReturn) {
    return "";
  }

  if (wizard.canReturn && !wizard.shouldShow) {
    return `
      <section class="activation-wizard-card activation-wizard-card-compact" data-activation-wizard>
        <div>
          <p class="activation-kicker">Activation wizard</p>
          <h3>Return to setup when you are ready</h3>
          <p>Dashboard stays usable. The wizard will pick up from ${escapeHtml(activeStep?.label || "the next unfinished step")}.</p>
        </div>
        <button class="primary-button" type="button" data-activation-return>Return to wizard</button>
      </section>
    `;
  }

  return `
    <section class="activation-wizard-card" data-activation-wizard>
      <div class="activation-header">
        <div>
          <p class="activation-kicker">Activation wizard</p>
          <h3>${escapeHtml(activeStep?.label || "Activation")}</h3>
          <p>${escapeHtml(activeStep?.copy || "Follow the next setup action to get Vonza live.")}</p>
        </div>
        ${buildActivationWizardProgressMarkup(wizard)}
      </div>
      ${wizard.migrationRequired ? `<div class="activation-warning">Progress is shown from current setup state, but durable wizard progress needs the activation wizard migration.</div>` : ""}
      ${buildActivationWizardActionMarkup(agent, wizard, activeStep)}
      <div class="activation-footer">
        <button class="text-button" type="button" data-activation-exit>Exit wizard</button>
        <span>One primary action at a time. You can skip and return later.</span>
      </div>
    </section>
  `;
}

function buildAnalyticsPanel(agent, messages, setup, actionQueue = createEmptyActionQueue(), operatorWorkspace = createEmptyOperatorWorkspace()) {
  const signals = analyzeConversationSignals(messages);
  const analyticsSummary = getAnalyticsSummary(actionQueue, agent, messages);
  const ownerAnalyticsDashboard = getOwnerAnalyticsDashboard(actionQueue);
  const ownerMetrics = ownerAnalyticsDashboard?.metrics || {};
  const conversionSummary = {
    ...createEmptyActionQueue().conversionSummary,
    ...(actionQueue.conversionSummary || {}),
  };
  const outcomeSummary = {
    ...createEmptyActionQueue().outcomeSummary,
    ...(actionQueue.outcomeSummary || {}),
  };
  const recentOutcomes = Array.isArray(actionQueue.recentOutcomes) ? actionQueue.recentOutcomes.slice(0, 6) : [];
  const report = buildAnalyticsReport(signals, analyticsSummary, actionQueue, conversionSummary, outcomeSummary, {
    contacts: operatorWorkspace.contacts?.list || [],
  });
  if (ownerAnalyticsDashboard) {
    report.conversationCount = Math.max(report.conversationCount, Number(ownerMetrics.totalConversations || 0));
    report.contactsCaptured = Math.max(report.contactsCaptured, Number(ownerMetrics.leadsCaptured || 0));
    report.conversionRate = Number(ownerMetrics.conversionRate || report.conversionRate || 0);
  }
  report.recommendations = buildAnalyticsRecommendations(report);
  report.swot = buildAnalyticsSwot(report);
  report.summarySentence = buildAnalyticsSummarySentence(report);
  report.conversationSeries = buildAnalyticsTimeSeries(signals.userMessages || [], (message) => message.createdAt || message.created_at, 30);
  report.outcomeSeries = buildAnalyticsTimeSeries(recentOutcomes, (outcome) => outcome.occurredAt || outcome.createdAt || outcome.created_at, 30);
  const ownerTopQuestionItems = Array.isArray(ownerAnalyticsDashboard?.topVisitorQuestions)
    ? ownerAnalyticsDashboard.topVisitorQuestions.map((item) => ({
      label: trimText(item.summary || item.question),
      count: Number(item.count || 0),
    })).filter((item) => item.label)
    : [];
  const topQuestionItems = ownerTopQuestionItems.length
    ? ownerTopQuestionItems.slice(0, 5)
    : Array.isArray(signals.topQuestions) && signals.topQuestions.length
    ? signals.topQuestions.slice(0, 5)
    : [];
  const ownerWeakQuestionItems = Array.isArray(ownerAnalyticsDashboard?.missedQuestions)
    ? ownerAnalyticsDashboard.missedQuestions.map((item) => trimText(item.question || item.summary)).filter(Boolean)
    : [];
  const weakAnswerItems = ownerWeakQuestionItems.length
    ? ownerWeakQuestionItems.slice(0, 4)
    : Array.isArray(signals.weakAnswerExamples) && signals.weakAnswerExamples.length
    ? signals.weakAnswerExamples.slice(0, 4)
    : [];
  const customerSatisfaction = ownerAnalyticsDashboard?.customerSatisfaction || createEmptyOwnerAnalyticsDashboard().customerSatisfaction;
  const satisfactionNotifications = Array.isArray(ownerAnalyticsDashboard?.notifications)
    ? ownerAnalyticsDashboard.notifications.slice(0, 4)
    : [];
  const unhappyAnswers = Array.isArray(customerSatisfaction.unhappyAnswers)
    ? customerSatisfaction.unhappyAnswers.slice(0, 4)
    : [];
  const recoveryActions = Array.isArray(customerSatisfaction.recoveryActions)
    ? customerSatisfaction.recoveryActions.slice(0, 3)
    : [];
  const aiUsage = ownerAnalyticsDashboard?.aiUsage || null;
  const hasAiUsage = aiUsage && (
    Number(aiUsage.includedCents || 0) > 0
    || Number(aiUsage.usedCents || 0) > 0
    || trimText(aiUsage.statusLabel || aiUsage.planName || aiUsage.planKey)
  );
  const aiUsageMarkup = hasAiUsage
    ? `<section class="workspace-card-soft analytics-usage-card">
        <div class="flat-section-header">
          <div>
            <p class="overview-label">${escapeHtml(t("analytics.aiUsage"))}</p>
            <h3 class="flat-section-title">${escapeHtml(t("analytics.planCapacity"))}</h3>
          </div>
        </div>
        <div class="analytics-report-capacity">
          <div class="analytics-report-capacity-bar" aria-label="AI usage vs plan capacity">
            <span style="width:${escapeHtml(String(Math.min(100, Math.max(0, Number(aiUsage.percentUsed || 0)))))}%"></span>
          </div>
          <p>${escapeHtml(formatAnalyticsReportDecimalPercent(aiUsage.percentUsed))} used on ${escapeHtml(aiUsage.planName || aiUsage.planKey || "current plan")}</p>
          <p class="analytics-report-section-copy">${escapeHtml(aiUsage.statusLabel || "Usage data is available for this billing period.")}</p>
        </div>
      </section>`
    : "";
  const syncPendingMarkup = analyticsSummary.syncState === "pending"
    ? `<div class="placeholder-card">Live activity was just detected, and Vonza is refreshing the conversation summary now.</div>`
    : "";
  const customerSatisfactionMarkup = `
    <section class="workspace-card-soft analytics-report-section analytics-satisfaction-card">
      <div class="flat-section-header">
        <div>
          <p class="overview-label">Customer satisfaction</p>
          <h3 class="flat-section-title">Feedback recovery loop</h3>
          <p class="analytics-report-section-copy">Helpful and not-helpful reply feedback is mapped into answer fixes, customer replies, and owner-visible notices.</p>
        </div>
        <div class="analytics-report-overview-pills">
          <span class="pill">${escapeHtml(`${customerSatisfaction.helpful || 0} helpful`)}</span>
          <span class="pill">${escapeHtml(`${customerSatisfaction.notHelpful || 0} not helpful`)}</span>
          <span class="pill">${escapeHtml(`${formatAnalyticsReportDecimalPercent(customerSatisfaction.negativeRate || 0)} negative`)}</span>
        </div>
      </div>
      ${customerSatisfaction.persistenceAvailable === false ? `<div class="placeholder-card">Reply feedback analytics are waiting for the feedback migration on this workspace.</div>` : ""}
      <div class="analytics-report-grid">
        <article id="notifications" class="analytics-report-card">
          <span>Owner notifications</span>
          ${satisfactionNotifications.length ? satisfactionNotifications.map((item) => `
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(item.title || "Workspace notice")}</p>
              <p class="overview-list-copy">${escapeHtml(item.copy || "")}</p>
            </div>
          `).join("") : `<div class="placeholder-card">No unhappy customers, high-intent leads, or unanswered-question notices are active right now.</div>`}
        </article>
        <article class="analytics-report-card">
          <span>Unhappy answers</span>
          ${unhappyAnswers.length ? unhappyAnswers.map((item) => `
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(item.question || "Visitor marked an answer not helpful.")}</p>
              <p class="overview-list-copy">${escapeHtml(item.recommendedAction || "Review the answer and decide whether this needs a knowledge fix or customer reply.")}</p>
            </div>
          `).join("") : `<div class="placeholder-card">No not-helpful reply feedback has been recorded yet.</div>`}
        </article>
        <article class="analytics-report-card">
          <span>Next recovery actions</span>
          ${recoveryActions.length ? recoveryActions.map((item) => `
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(item.label || "Review feedback")}${Number(item.count || 0) ? ` · ${escapeHtml(String(item.count))}` : ""}</p>
              <p class="overview-list-copy">${escapeHtml(item.copy || "")}</p>
            </div>
          `).join("") : `<div class="placeholder-card">Once visitors rate answers, Vonza will point owners toward fix-knowledge or reply-to-customer work.</div>`}
        </article>
      </div>
    </section>
  `;

	  return localizeDashboardHtml(`
	    <section class="workspace-page" data-shell-section="analytics" hidden>
	      ${buildPageHeader({
	        title: t("analytics.title"),
	        copy: t("analytics.copy"),
	        actionsMarkup: `
	          <span class="v2-select">${escapeHtml(t("analytics.dateRangeLast30"))}</span>
	          <span class="v2-select">${escapeHtml(t("analytics.sourceAll"))}</span>
	          ${buildV2Button(t("analytics.export"), "download")}
	        `,
	      })}
      <div class="workspace-page-body">
	        <div class="workspace-section-stack analytics-route-stack">
	          ${syncPendingMarkup}
	          ${buildDashboardV2AnalyticsMarkup(report, ownerAnalyticsDashboard, topQuestionItems, signals.userMessages || [])}
	          ${aiUsageMarkup}
	          <section class="workspace-card-soft analytics-improvement-card">
            <div class="flat-section-header">
              <div>
                <p class="overview-label">${escapeHtml(t("home.improveNext"))}</p>
                <h3 class="flat-section-title">${escapeHtml(t("home.improveNext"))}</h3>
                <p class="analytics-report-section-copy">${escapeHtml(t("home.improveCopy"))}</p>
              </div>
            </div>
            <div class="analytics-report-recommendations">
              ${report.recommendations.length ? report.recommendations.map((item) => `
                <article class="analytics-report-recommendation tone-${item.tone}">
                  <div class="analytics-report-recommendation-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.metric)}</span>
                  </div>
                  <p>${escapeHtml(item.copy)}</p>
                </article>
              `).join("") : `<div class="placeholder-card">No urgent improvements right now. Keep watching new questions and update weak answers as they appear.</div>`}
            </div>
          </section>
          <section class="workspace-card-soft analytics-questions-card">
            <div class="flat-section-header">
              <div>
                <p class="overview-label">${escapeHtml(t("analytics.customerQuestions"))}</p>
                <h3 class="flat-section-title">${escapeHtml(t("analytics.questionsAndWeakAnswers"))}</h3>
                <p class="analytics-report-section-copy">Use this to improve the answers customers see most often.</p>
              </div>
            </div>
            <div class="analytics-report-swot-grid">
              <article class="analytics-report-swot-item tone-neutral">
                <span>${escapeHtml(t("analytics.topQuestions"))}</span>
                ${topQuestionItems.length ? `
                  <div class="analytics-question-list">
                    ${topQuestionItems.map((item) => `
                      <p><strong>${escapeHtml(item.label || "Customer question theme")}</strong> ${escapeHtml(formatAnalyticsReportNumber(item.count || 0))} mention${Number(item.count || 0) === 1 ? "" : "s"}</p>
                    `).join("")}
                  </div>
                ` : `<p>No repeated customer question is standing out yet.</p>`}
              </article>
              <article class="analytics-report-swot-item tone-${weakAnswerItems.length ? "risk" : "positive"}">
                <span>${escapeHtml(t("analytics.weakAreas"))}</span>
                ${weakAnswerItems.length ? `
                  <div class="analytics-question-list">
                    ${weakAnswerItems.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                  </div>
                ` : `<p>No weak-answer pattern is standing out in the current sample.</p>`}
              </article>
            </div>
          </section>
          ${customerSatisfactionMarkup}
        </div>
      </div>
    </section>
  `);
}

function buildConnectedToolComingSoonPanel(sectionKey, title, copy) {
  return localizeDashboardHtml(`
    <section class="workspace-page" data-shell-section="${escapeHtml(sectionKey)}" hidden>
      ${buildPageHeader({
        eyebrow: "Connected tools",
        title,
        copy: "Beta. This connected tool is not self-serve from the dashboard yet.",
        actionsMarkup: `<span class="badge pending">Beta</span>`,
      })}
      <div class="workspace-page-body">
        <section class="workspace-card-soft">
          <p class="overview-label">Status</p>
          <h3 class="studio-group-title">Beta</h3>
          <p class="workspace-panel-copy">${escapeHtml(copy)}</p>
        </section>
      </div>
    </section>
  `);
}

function buildInboxPanel() {
  // Keep connected tools informational until self-serve access is ready.
  return buildConnectedToolComingSoonPanel(
    "inbox",
    "Email",
    "Email connection is planned, but it is not self-serve yet. Vonza will not ask you to connect Gmail until the feature is ready."
  );
}

function buildCalendarPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
  // Keep connected tools informational until self-serve access is ready.
  if (!CONNECTED_TOOLS_SELF_SERVE_ENABLED) {
    return buildConnectedToolComingSoonPanel(
      "calendar",
      "Calendar",
      "Calendar context is planned, but it is not ready yet. Home and Customers still work without Google Calendar."
    );
  }

  const accounts = operatorWorkspace.connectedAccounts || [];
  const primaryAccount = accounts[0] || null;
  const calendar = operatorWorkspace.calendar || createEmptyOperatorWorkspace().calendar;
  const events = (calendar.events || []).slice(0, 8);
  const pendingApprovals = events.filter((event) => event.approvalStatus === "pending_owner");
  const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
  const activation = operatorWorkspace.activation || createEmptyOperatorWorkspace().activation;
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);
  const canWrite = googleCapabilities.calendarWrite === true;
  const followUpItems = Array.isArray(calendar.followUpItems) ? calendar.followUpItems : [];
  const unlinkedItems = Array.isArray(calendar.unlinkedItems) ? calendar.unlinkedItems : [];
  const selectedEvent = events[0] || null;

  return `
    <section class="workspace-page" data-shell-section="calendar" hidden>
      ${buildPageHeader({
        title: "Calendar",
        actionsMarkup: primaryAccount?.status === "connected"
          ? `<button class="primary-button" type="button" data-refresh-operator data-force-sync="true">Run calendar sync</button>`
          : `<button class="primary-button" type="button" data-google-connect ${status.googleConfigReady ? "" : "disabled"}>Connect Google</button>`,
      })}
      <div class="workspace-page-body">
        <section class="workspace-card-soft">
          <h3 class="studio-group-title">Daily summary</h3>
          <p class="workspace-panel-copy">${escapeHtml(calendar.dailySummary || "Connect Google Calendar to see today’s schedule.")}</p>
          ${primaryAccount?.status === "connected"
            ? `<div class="inline-actions"><button class="ghost-button" type="button" data-refresh-operator data-force-sync="true">Run calendar sync</button><button class="ghost-button" type="button" data-complete-operator-step="calendar_review">Mark reviewed</button></div>`
            : `<div class="inline-actions"><button class="primary-button" type="button" data-google-connect ${status.googleConfigReady ? "" : "disabled"}>Connect Google</button></div>`}
        </section>
        ${primaryAccount?.status !== "connected" ? buildOperatorEmptyState({
          title: "Connect Google",
          copy: status.googleConfigReady
            ? "Calendar events and slots will appear here after connection."
            : "Calendar is not available on this workspace yet.",
        }) : !activation.calendarSynced ? buildOperatorEmptyState({
          title: "Run your first calendar sync",
          copy: "The Google account is connected, but the calendar has not synced yet.",
          actionMarkup: `<button class="primary-button" type="button" data-refresh-operator data-force-sync="true">Run first sync</button>`,
        }) : `
          <div class="workspace-section-stack">
            <section class="workspace-card-soft">
              <h3 class="studio-group-title">Open slots</h3>
              ${(calendar.suggestedSlots || []).length ? `
                <div class="analytics-list">
                  ${(calendar.suggestedSlots || []).map((slot) => `
                    <div class="analytics-item">
                      <p class="analytics-item-title">${escapeHtml(slot.label || "Open slot")}</p>
                      <p class="analytics-item-copy">${escapeHtml(`${formatSeenAt(slot.startAt)} to ${formatSeenAt(slot.endAt)}`)}</p>
                    </div>
                  `).join("")}
                </div>
              ` : buildOperatorEmptyState({
                title: "No open slots standing out",
                copy: "Suggested slots will appear here when they are available.",
              })}
            </section>
            <section class="workspace-records-detail-shell">
              ${canWrite ? `
                <section class="workspace-card-soft workspace-inline-panel">
                  <h3 class="studio-group-title">Create event draft</h3>
                  <form class="workspace-section-stack" data-calendar-draft-form>
                    <input type="hidden" name="action_type" value="create">
                    <div class="form-grid two-col">
                      <div class="field">
                        <label>Title</label>
                        <input name="title" type="text" placeholder="Quote review with lead">
                      </div>
                      <div class="field">
                        <label>Attendee email</label>
                        <input name="attendee_email" type="email" placeholder="lead@example.com">
                      </div>
                      <div class="field">
                        <label>Start</label>
                        <input name="start_at" type="datetime-local">
                      </div>
                      <div class="field">
                        <label>End</label>
                        <input name="end_at" type="datetime-local">
                      </div>
                    </div>
                    <div class="field">
                      <label>Description</label>
                      <textarea name="description" placeholder="Prepared from booking intent, quote follow-up, or owner scheduling request."></textarea>
                    </div>
                    <div class="inline-actions">
                      <button class="primary-button" type="submit">Create approval draft</button>
                    </div>
                  </form>
                </section>
              ` : ``}
              ${pendingApprovals.length ? `
                <section class="workspace-card-soft workspace-inline-panel">
                  <h3 class="studio-group-title">Pending approvals</h3>
                  <div class="support-list">
                    ${pendingApprovals.map((event) => `
                      <div class="support-list-item">
                        <strong>${escapeHtml(event.title || "Pending calendar draft")}</strong>
                        <p>${escapeHtml([
                          event.actionType,
                          event.startAt ? formatSeenAt(event.startAt) : "",
                          event.endAt ? formatSeenAt(event.endAt) : "",
                        ].filter(Boolean).join(" · "))}</p>
                      </div>
                    `).join("")}
                  </div>
                </section>
              ` : ""}
              ${events.map((event, index) => `
                <article
                  class="workspace-record-detail-panel ${index === 0 ? "active" : ""}"
                  data-record-detail
                  data-record-kind="calendar"
                  data-record-id="${escapeHtml(event.id || "")}"
                  data-calendar-event-card
                  data-event-id="${escapeHtml(event.id || "")}"
                  ${index === 0 ? "" : "hidden"}
                >
                  <div class="workspace-record-detail-header">
                    <div>
                      <p class="support-panel-kicker">Calendar event</p>
                      <h3 class="workspace-record-detail-title">${escapeHtml(event.title || "Upcoming event")}</h3>
                      <p class="workspace-record-detail-copy">${escapeHtml(event.followUpReason || event.unlinkedReason || event.scheduleReason || "Calendar context is available for review.")}</p>
                    </div>
                    <span class="${getBadgeClass(event.approvalStatus === "pending_owner" ? "Needs attention" : event.linkedContactId ? "Ready" : "Limited")}">${escapeHtml(event.approvalStatus === "pending_owner" ? "approval pending" : event.linkedContactId ? "linked" : "needs review")}</span>
                  </div>
                  <div class="detail-kv-list">
                    <div class="detail-kv-item">
                      <span class="detail-kv-label">Schedule</span>
                      <strong>${escapeHtml([
                        event.startAt ? formatSeenAt(event.startAt) : "",
                        event.endAt ? `to ${formatSeenAt(event.endAt)}` : "",
                        event.status || "scheduled",
                      ].filter(Boolean).join(" "))}</strong>
                    </div>
                    <div class="detail-kv-item">
                      <span class="detail-kv-label">Linked contact</span>
                      <strong>${escapeHtml(event.linkedContactName || event.attendeeLabel || "No linked contact yet")}</strong>
                    </div>
                  </div>
                  ${canWrite ? `
                    <form class="workspace-section-stack" data-calendar-mutation-form data-event-id="${escapeHtml(event.id)}">
                      <input type="hidden" name="action_type" value="update">
                      <div class="form-grid two-col">
                        <div class="field">
                          <label>Reschedule start</label>
                          <input name="start_at" type="datetime-local" value="${escapeHtml(formatDateTimeLocalValue(event.startAt))}">
                        </div>
                        <div class="field">
                          <label>Reschedule end</label>
                          <input name="end_at" type="datetime-local" value="${escapeHtml(formatDateTimeLocalValue(event.endAt))}">
                        </div>
                      </div>
                      <div class="inline-actions">
                        <button class="ghost-button" type="submit">Draft update</button>
                        <button class="ghost-button" type="button" data-cancel-calendar-event data-event-id="${escapeHtml(event.id)}">Draft cancel</button>
                        ${event.approvalStatus === "pending_owner" ? `<button class="primary-button" type="button" data-approve-calendar-event data-event-id="${escapeHtml(event.id)}">Approve calendar change</button>` : ""}
                      </div>
                    </form>
                  ` : `
                    <p class="analytics-item-copy">${escapeHtml(event.followUpReason || event.unlinkedReason || event.scheduleReason || "Synced event.")}</p>
                    <div class="inline-actions">
                      <button class="ghost-button" type="button" data-open-calendar-event data-event-id="${escapeHtml(event.id)}">Open event</button>
                    </div>
                  `}
                </article>
              `).join("")}
              ${selectedEvent ? "" : `<div class="placeholder-card">Select an event to review calendar detail.</div>`}
              ${(calendar.missedBookingOpportunities || []).length || followUpItems.length || unlinkedItems.length ? `
                <section class="workspace-card-soft workspace-inline-panel">
                  <h3 class="studio-group-title">Events</h3>
                  <div class="analytics-list">
                    ${followUpItems.slice(0, 4).map((item) => `
                      <div class="analytics-item">
                        <p class="analytics-item-title">${escapeHtml(item.label || item.title || "Needs follow-up")}</p>
                        <p class="analytics-item-copy">${escapeHtml(item.followUpReason || "Appointment follow-up is still open.")}</p>
                      </div>
                    `).join("")}
                    ${unlinkedItems.slice(0, 4).map((item) => `
                      <div class="analytics-item">
                        <p class="analytics-item-title">${escapeHtml(item.label || item.title || "Unlinked attendee")}</p>
                        <p class="analytics-item-copy">${escapeHtml(item.unlinkedReason || "This attendee still needs contact linking.")}</p>
                      </div>
                    `).join("")}
                    ${(calendar.missedBookingOpportunities || []).map((opportunity) => `
                      <div class="analytics-item">
                        <p class="analytics-item-title">${escapeHtml(opportunity.contactName || opportunity.contactEmail || "Booking opportunity")}</p>
                        <p class="analytics-item-copy">${escapeHtml(opportunity.reason || "Booking signal captured without a scheduled event yet.")}</p>
                      </div>
                    `).join("")}
                  </div>
                </section>
              ` : ""}
            </section>
          </div>
        `}
      </div>
    </section>
  `;
}

function buildAutomationsPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
  // Keep connected tools informational until self-serve access is ready.
  if (!CONNECTED_TOOLS_SELF_SERVE_ENABLED) {
    return buildConnectedToolComingSoonPanel(
      "automations",
      "Automations",
      "Automations are planned, but they are not available yet. The dashboard will keep this area clearly marked until workflows are ready."
    );
  }

  const automations = operatorWorkspace.automations || createEmptyOperatorWorkspace().automations;
  const allTasks = automations.tasks || [];
  const campaigns = automations.campaigns || [];
  const followUps = automations.followUps || [];
  const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
  const googleConnected = status.googleConnected === true;

  return `
    <section class="workspace-page" data-shell-section="automations" hidden>
      ${buildPageHeader({
        title: "Automations",
        actionsMarkup: googleConnected
          ? `<button class="primary-button" type="button" data-automation-focus="campaign-draft">Generate campaign draft</button>`
          : `<button class="primary-button" type="button" data-google-connect ${status.googleConfigReady ? "" : "disabled"}>Connect Google</button>`,
      })}
      ${buildPageToolbar({
        filtersMarkup: `
          <div class="toolbar-filter-group">
            <button class="toolbar-chip" type="button" data-shell-target="contacts">Customers</button>
            <button class="toolbar-chip" type="button" data-shell-target="inbox">Email</button>
          </div>
        `,
      })}
      <div class="workspace-page-body">
        <div class="workspace-section-stack">
          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Owner task queue</h3>
            ${allTasks.length ? `
              <div class="analytics-list">
                ${allTasks.map((task) => `
                  <div class="analytics-item" data-operator-task-card data-task-id="${escapeHtml(task.id || "")}">
                    <div class="workspace-record-detail-header">
                      <div>
                        <p class="analytics-item-title">${escapeHtml(task.title || "Owner task")}</p>
                        <p class="analytics-item-copy">${escapeHtml(task.description || "Needs owner review.")}</p>
                      </div>
                      <span class="${getBadgeClass(task.status === "resolved" ? "Ready" : "Needs attention")}">${escapeHtml(task.status || "open")}</span>
                    </div>
                    <div class="inline-actions">
                      <button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(task.id)}" data-task-status="resolved">Mark resolved</button>
                      <button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(task.id)}" data-task-status="escalated">Escalate</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : buildOperatorEmptyState({
              title: "No owner tasks are open",
              copy: "Tasks will appear here when they need review.",
            })}
          </section>

          <section class="workspace-card-soft" data-automation-panel="campaign-draft">
              <h3 class="studio-group-title">Campaign draft</h3>
              <form class="workspace-section-stack" data-campaign-draft-form>
                <div class="form-grid two-col">
                  <div class="field">
                    <label>Goal</label>
                    <select name="goal">
                      <option value="welcome">welcome</option>
                      <option value="quote_follow_up">quote follow-up</option>
                      <option value="abandoned_lead_reengagement">abandoned lead re-engagement</option>
                      <option value="review_request">review request</option>
                      <option value="complaint_recovery">complaint recovery</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Send window hour</label>
                    <input name="send_window_hour" type="number" min="0" max="23" value="10">
                  </div>
                </div>
                <div class="inline-actions">
                  <button class="primary-button" type="submit" ${googleConnected ? "" : "disabled"}>Generate campaign draft</button>
                </div>
              </form>
          </section>

          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Campaigns</h3>
            ${googleConnected && campaigns.length ? `
              <div class="operator-thread-grid">
                ${campaigns.map((campaign) => `
                  <article class="operator-thread-card" data-campaign-card data-campaign-id="${escapeHtml(campaign.id || "")}">
                    <div class="workspace-record-detail-header">
                      <div>
                        <h3 class="workspace-record-detail-title">${escapeHtml(campaign.title || "Campaign")}</h3>
                        <p class="workspace-record-detail-copy">${escapeHtml([
                          campaign.goal?.replaceAll("_", " "),
                          campaign.approvalStatus,
                          `${(campaign.recipients || []).length} recipients`,
                        ].filter(Boolean).join(" · "))}</p>
                      </div>
                      <span class="${getBadgeClass(campaign.status === "active" ? "Ready" : campaign.approvalStatus === "approved" ? "Limited" : "Needs attention")}">${escapeHtml(campaign.status || "draft")}</span>
                    </div>
                    <div class="inline-actions">
                      ${campaign.approvalStatus !== "approved"
                        ? `<button class="primary-button" type="button" data-approve-campaign data-campaign-id="${escapeHtml(campaign.id)}">Approve activation</button>`
                        : ""}
                      ${campaign.status === "active"
                        ? `<button class="ghost-button" type="button" data-send-campaign-steps data-campaign-id="${escapeHtml(campaign.id)}">Send due steps now</button>`
                        : ""}
                    </div>
                  </article>
                `).join("")}
              </div>
            ` : buildOperatorEmptyState({
              title: "No campaigns drafted yet",
              copy: googleConnected ? "Create a draft to start." : "Connect Google to create campaigns.",
            })}
          </section>

          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Follow-ups</h3>
            ${followUps.length ? `
              <div class="operator-thread-grid">
                ${followUps.slice(0, 8).map((followUp) => `
                  <article class="operator-thread-card" data-follow-up-card data-follow-up-id="${escapeHtml(followUp.id || "")}">
                    <div class="workspace-record-detail-header">
                      <div>
                        <h3 class="workspace-record-detail-title">${escapeHtml(followUp.subject || followUp.topic || "Prepared follow-up")}</h3>
                        <p class="workspace-record-detail-copy">${escapeHtml(followUp.contactEmail || followUp.contactPhone || "Missing contact")}</p>
                      </div>
                      <span class="${getBadgeClass(followUp.status === "sent" ? "Ready" : followUp.status === "dismissed" ? "Limited" : "Needs attention")}">${escapeHtml(followUp.status || "draft")}</span>
                    </div>
                    <form class="workspace-section-stack" data-follow-up-form data-follow-up-id="${escapeHtml(followUp.id)}" data-lead-id="${escapeHtml(followUp.leadId || "")}">
                      <div class="field">
                        <label>Subject</label>
                        <input name="subject" type="text" value="${escapeHtml(followUp.subject || "")}">
                      </div>
                      <div class="field">
                        <label>Draft</label>
                        <textarea name="draft_content">${escapeHtml(followUp.draftContent || "")}</textarea>
                      </div>
                      <div class="inline-actions">
                        <button class="ghost-button" type="submit">Save draft</button>
                        <button class="ghost-button" type="button" data-follow-up-status-action data-next-status="ready">Mark ready</button>
                        <button class="primary-button" type="button" data-follow-up-status-action data-next-status="sent">Mark sent</button>
                        <button class="ghost-button" type="button" data-follow-up-status-action data-next-status="dismissed">Dismiss</button>
                      </div>
                    </form>
                  </article>
                `).join("")}
              </div>
            ` : `<div class="placeholder-card">${escapeHtml(googleConnected ? "Prepared follow-ups will show up here." : "Connect Google to load follow-ups.")}</div>`}
          </section>
        </div>
      </div>
    </section>
  `;
}

function buildWorkspaceContextBar(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const workspaceMode = getWorkspaceMode(operatorWorkspace);
  const previewUrl = buildFrontDeskPreviewUrl(agent);
  const secondaryActions = [
    previewUrl
      ? `<a class="test-link" data-action="open-preview" href="${escapeHtml(previewUrl)}" target="_blank" rel="noreferrer">Open Front Desk page</a>`
      : "",
    setup.isReady
      ? `<button class="ghost-button" type="button" data-shell-target="install">Open install</button>`
      : `<button class="ghost-button" type="button" data-shell-target="customize" data-frontdesk-open="customization">Finish setup</button>`,
  ].filter(Boolean).join("");

  return localizeDashboardHtml(`
    <div class="workspace-context-bar">
      <button class="shell-menu-button" type="button" data-shell-menu-toggle aria-label="${escapeHtml(translateDashboardText("Open navigation"))}">${escapeHtml(translateDashboardText("Menu"))}</button>
      <div class="workspace-context-copy">
        <p class="workspace-context-eyebrow">${escapeHtml(workspaceMode.eyebrow)}</p>
        <p class="workspace-context-title">${escapeHtml(workspaceMode.title)}</p>
        <p class="workspace-context-note">${escapeHtml(workspaceMode.copy)}</p>
      </div>
      <div class="workspace-context-actions">
        <div class="workspace-context-status">
          <span class="${getBadgeClass(setup.isReady ? "Ready" : "Limited")}">${escapeHtml(setup.isReady ? "Ready to use" : "Getting started")}</span>
          <span class="${getBadgeClass(setup.knowledgeReady ? "Ready" : setup.knowledgeLimited ? "Limited" : "Pending")}">${escapeHtml(setup.knowledgeReady ? "Website learned" : setup.knowledgeLimited ? "Website learning" : "Website details needed")}</span>
        </div>
        ${secondaryActions}
      </div>
    </div>
  `);
}

function buildDashboardHelpMessageMarkup(message = {}) {
  return `
    <article class="dashboard-help-message ${message.role === "user" ? "user" : "assistant"}">
      <span class="dashboard-help-message-role">${escapeHtml(message.role === "user" ? "You" : "Ask Vonza")}</span>
      <p class="dashboard-help-message-copy">${formatRichTextHtml(message.content || "")}</p>
    </article>
  `;
}

// eslint-disable-next-line no-unused-vars
function buildDashboardHelpAssistantMarkup() {
  const context = getDashboardHelpContext();
  const helpState = ensureDashboardHelpState(context);
  const prompts = buildDashboardHelpStarterPrompts(context);
  const snapshot = buildDashboardHelpSnapshot(context);
  const locationLabel = context.currentSubsectionLabel
    ? `${context.currentSectionLabel} / ${context.currentSubsectionLabel}`
    : context.currentSectionLabel;

  return `
    <div class="dashboard-help ${helpState.open ? "is-open" : ""}" data-dashboard-help>
      <button class="dashboard-help-backdrop" type="button" data-help-close aria-label="Close Ask Vonza"></button>
      <aside class="dashboard-help-drawer" aria-label="Ask Vonza product help">
        <div class="dashboard-help-header">
          <div class="dashboard-help-header-copy">
            <p class="support-panel-kicker">Ask Vonza</p>
            <h2 class="dashboard-help-title">AI guide and support inside the app</h2>
            <p class="dashboard-help-subtitle" data-help-location>Currently on ${escapeHtml(locationLabel)}</p>
          </div>
          <button class="ghost-button dashboard-help-close" type="button" data-help-close>Close</button>
        </div>
        <div class="support-panel dashboard-help-context">
          <p class="support-panel-kicker">${escapeHtml(snapshot.title)}</p>
          <h3 class="support-panel-title">Focused on how to use Vonza right now</h3>
          <p class="support-panel-copy">${escapeHtml(snapshot.copy)}</p>
          <div class="dashboard-help-status-grid">
            ${snapshot.cards.map((card) => `
              <article class="dashboard-help-status-card">
                <span class="dashboard-help-status-label">${escapeHtml(card.label)}</span>
                <strong class="dashboard-help-status-value">${escapeHtml(card.value)}</strong>
                <span class="dashboard-help-status-tone ${escapeHtml(card.tone)}"></span>
              </article>
            `).join("")}
          </div>
          <p class="dashboard-help-context-note">${escapeHtml(snapshot.detail)}</p>
        </div>
        <div class="dashboard-help-prompts" data-help-prompts>
          ${prompts.map((prompt) => `<button class="dashboard-help-prompt" type="button" data-help-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("")}
        </div>
        <div class="dashboard-help-thread" data-help-thread>
          ${helpState.messages.map((message) => buildDashboardHelpMessageMarkup(message)).join("")}
          ${helpState.loading ? `<div class="dashboard-help-loading">Ask Vonza is drafting guidance for this workspace...</div>` : ""}
        </div>
        <form class="dashboard-help-form" data-help-form>
          <label class="sr-only" for="dashboard-help-question">Ask about using Vonza</label>
          <textarea id="dashboard-help-question" name="question" placeholder="Ask what this page means, what to fix first, why something is missing, or what to do next.">${escapeHtml(helpState.draft || "")}</textarea>
          <div class="dashboard-help-actions">
            <p class="dashboard-help-hint">Ask Vonza uses your current page and workspace state so the guidance feels like part of the product, not a generic bot.</p>
            <button class="primary-button" type="submit" ${helpState.loading ? "disabled" : ""}>Send</button>
          </div>
        </form>
      </aside>
      <button class="dashboard-help-fab" type="button" data-help-toggle>
        <span class="dashboard-help-fab-eyebrow">Help</span>
        <strong>Ask Vonza</strong>
      </button>
    </div>
  `;
}

function renderAssistantShell(
  agent,
  messages,
  setup,
  actionQueue = createEmptyActionQueue(),
  operatorWorkspace = createEmptyOperatorWorkspace(),
  frontDeskTraining = createEmptyFrontDeskTraining()
) {
  setup = mergeKnowledgeImportIntoSetup(setup, agent);

  if (DASHBOARD_V2_ENABLED) {
    renderDashboardV2Shell(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining);
    return;
  }

  renderTopbarMeta();
  const activeSection = getActiveShellSection(setup, operatorWorkspace);
  const setupHintMarkup = !setup.isReady
    ? `
      <div class="shell-inline-note">
        Finish the Front Desk basics in Settings, test the live experience in Front Desk, and then move into Install when you are ready to publish.
      </div>
    `
    : "";
  const shellClassName = DASHBOARD_V2_ENABLED ? "app-shell dashboard-v2-shell" : "app-shell";

  rootEl.innerHTML = `
    <div class="${shellClassName}" data-app-shell data-dashboard-v2="${DASHBOARD_V2_ENABLED ? "enabled" : "disabled"}" data-dashboard-product="${escapeHtml(activeDashboardProduct.key)}">
      <button class="shell-backdrop" type="button" data-shell-backdrop aria-label="Close navigation"></button>
      ${buildSidebarShell(agent, setup, actionQueue, operatorWorkspace, activeSection)}
      <div class="workspace-shell">
        ${buildWorkspaceContextBar(agent, setup, operatorWorkspace)}
        ${setupHintMarkup}
        <div class="workspace-pages">
          ${buildOverviewPanel(agent, messages, setup, actionQueue, operatorWorkspace)}
          ${isCapabilityVisibleForWorkspace("contacts", operatorWorkspace) ? buildContactsPanel(agent, operatorWorkspace) : ""}
          ${buildCustomizePanel(agent, setup, operatorWorkspace, frontDeskTraining, actionQueue)}
          ${buildAnalyticsPanel(agent, messages, setup, actionQueue, operatorWorkspace)}
          ${isCapabilityVisibleForWorkspace("inbox", operatorWorkspace) ? buildInboxPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("calendar", operatorWorkspace) ? buildCalendarPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("automations", operatorWorkspace) ? buildAutomationsPanel(agent, operatorWorkspace) : ""}
          ${buildInstallPanel(agent, setup, operatorWorkspace, messages, actionQueue)}
          ${buildSettingsPanel(agent, setup, operatorWorkspace, actionQueue)}
        </div>
      </div>
    </div>
  `;

  bindSharedDashboardEvents(agent, messages, setup, actionQueue, operatorWorkspace);
}

function renderDashboardV2Shell(
  agent,
  messages,
  setup,
  actionQueue = createEmptyActionQueue(),
  operatorWorkspace = createEmptyOperatorWorkspace(),
  frontDeskTraining = createEmptyFrontDeskTraining()
) {
  renderTopbarMeta();
  const activeSection = getActiveShellSection(setup, operatorWorkspace);
  const setupHintMarkup = !setup.isReady
    ? `
      <div class="shell-inline-note dashboard-v2-inline-note">
        Finish the Front Desk basics, test the live experience, and move into Install when you are ready to publish.
      </div>
    `
    : "";

  rootEl.innerHTML = `
    <div class="app-shell dashboard-v2-shell dashboard-v2-production-shell" data-app-shell data-dashboard-v2="enabled" data-dashboard-product="${escapeHtml(activeDashboardProduct.key)}">
      <button class="shell-backdrop" type="button" data-shell-backdrop aria-label="Close navigation"></button>
      ${buildSidebarShell(agent, setup, actionQueue, operatorWorkspace, activeSection)}
      <div class="workspace-shell">
        ${setupHintMarkup}
        <div class="workspace-pages">
          ${buildOverviewPanel(agent, messages, setup, actionQueue, operatorWorkspace)}
          ${isCapabilityVisibleForWorkspace("contacts", operatorWorkspace) ? buildContactsPanel(agent, operatorWorkspace) : ""}
          ${buildCustomizePanel(agent, setup, operatorWorkspace, frontDeskTraining, actionQueue)}
          ${buildAnalyticsPanel(agent, messages, setup, actionQueue, operatorWorkspace)}
          ${isCapabilityVisibleForWorkspace("inbox", operatorWorkspace) ? buildInboxPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("calendar", operatorWorkspace) ? buildCalendarPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("automations", operatorWorkspace) ? buildAutomationsPanel(agent, operatorWorkspace) : ""}
          ${buildInstallPanel(agent, setup, operatorWorkspace, messages, actionQueue)}
          ${buildSettingsPanel(agent, setup, operatorWorkspace, actionQueue)}
        </div>
      </div>
    </div>
  `;

  bindSharedDashboardEvents(agent, messages, setup, actionQueue, operatorWorkspace);
}

function renderSetupState(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining = createEmptyFrontDeskTraining()) {
  markDashboardBooted();
  workspaceState = {
    agent,
    messages,
    setup,
    actionQueue,
    operatorWorkspace,
    frontDeskTraining,
  };
  bindWorkspaceAutoRefresh(agent.id);
  renderAssistantShell(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining);
}

function renderReadyState(agent, messages, actionQueue, operatorWorkspace, frontDeskTraining = createEmptyFrontDeskTraining()) {
  const setup = inferSetup(agent);
  markDashboardBooted();
  workspaceState = {
    agent,
    messages,
    setup,
    actionQueue,
    operatorWorkspace,
    frontDeskTraining,
  };
  bindWorkspaceAutoRefresh(agent.id);
  renderAssistantShell(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining);
}

// Data loading and persistence helpers
async function fetchJson(url, options) {
  const nextOptions = { ...(options || {}) };
  nextOptions.headers = options?.auth === false
    ? { ...(options?.headers || {}) }
    : getAuthHeaders(options?.headers || {});

  const response = await fetch(url, nextOptions);
  let data = null;

  if (typeof response?.json === "function") {
    data = await response.json();
  } else if (response && typeof response.json === "object") {
    data = response.json;
  } else if (typeof response?.text === "function") {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } else if (response && typeof response === "object" && "ok" in response) {
    data = response.body || null;
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

async function fetchText(url, options) {
  const nextOptions = { ...(options || {}) };
  nextOptions.headers = options?.auth === false
    ? { ...(options?.headers || {}) }
    : getAuthHeaders(options?.headers || {});

  const response = await fetch(url, nextOptions);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Something went wrong.");
  }

  return text;
}

async function loadAgents() {
  const url = new URL("/agents/list", window.location.origin);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return {
    agents: data.agents || [],
    bridgeAgent: data.bridgeAgent || null,
  };
}

async function loadDashboardPreferences() {
  return fetchJson("/dashboard/preferences");
}

async function saveDashboardLanguage(language) {
  const normalizedLanguage = normalizeDashboardLanguage(language);
  const data = await fetchJson("/dashboard/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dashboard_language: normalizedLanguage,
    }),
  });

  if (data?.ok !== true || normalizeDashboardLanguage(data.dashboardLanguage) !== normalizedLanguage) {
    throw new Error(t("language.error"));
  }

  cacheDashboardLanguage(normalizedLanguage);
  return normalizedLanguage;
}

async function loadAgentMessages(agentId) {
  const url = new URL("/agents/messages", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return data.messages || [];
}

function createEmptyFrontDeskTraining() {
  return {
    items: [],
    persistenceAvailable: true,
    migrationRequired: false,
    lastTest: null,
  };
}

async function loadFrontDeskTraining(agentId) {
  const url = new URL("/agents/front-desk/training-items", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return {
    ...createEmptyFrontDeskTraining(),
    ...data,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

async function loadAgentInstallSnapshot(agentId) {
  const url = new URL("/agents/install-status", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return data.agent || null;
}

async function loadActivationWizard(agentId) {
  const url = new URL("/agents/activation-wizard", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return data.wizard || null;
}

async function saveActivationWizardProgress(payload = {}) {
  const data = await fetchJson("/agents/activation-wizard/progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: getClientId(),
      ...payload,
    }),
  });

  activationWizardState = data.wizard || activationWizardState;
  return activationWizardState;
}

async function loadActionQueue(agentId) {
  const url = new URL("/agents/action-queue", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("dashboard_language", getDashboardLanguage());
  const data = await fetchJson(url.toString());
  return {
    items: Array.isArray(data.items) ? data.items : [],
    people: Array.isArray(data.people) ? data.people : [],
    peopleSummary: {
      ...createEmptyActionQueue().peopleSummary,
      ...(data.peopleSummary || {}),
    },
    summary: {
      ...createEmptyActionQueue().summary,
      ...(data.summary || {}),
    },
    conversionSummary: {
      ...createEmptyActionQueue().conversionSummary,
      ...(data.conversionSummary || {}),
    },
    outcomeSummary: {
      ...createEmptyActionQueue().outcomeSummary,
      ...(data.outcomeSummary || {}),
    },
    recentOutcomes: Array.isArray(data.recentOutcomes) ? data.recentOutcomes : [],
    recentLeadCaptures: Array.isArray(data.recentLeadCaptures) ? data.recentLeadCaptures : [],
    humanFollowUps: {
      ...createEmptyActionQueue().humanFollowUps,
      ...(data.humanFollowUps || {}),
      summary: {
        ...createEmptyActionQueue().humanFollowUps.summary,
        ...(data.humanFollowUps?.summary || {}),
      },
      items: Array.isArray(data.humanFollowUps?.items) ? data.humanFollowUps.items : [],
      topItems: Array.isArray(data.humanFollowUps?.topItems) ? data.humanFollowUps.topItems : [],
    },
    ownerNotifications: {
      ...createEmptyActionQueue().ownerNotifications,
      ...(data.ownerNotifications || {}),
      records: Array.isArray(data.ownerNotifications?.records) ? data.ownerNotifications.records : [],
      summary: {
        ...createEmptyActionQueue().ownerNotifications.summary,
        ...(data.ownerNotifications?.summary || {}),
      },
    },
    persistenceAvailable: data.persistenceAvailable !== false,
    migrationRequired: data.migrationRequired === true,
    followUpWorkflowAvailable: data.followUpWorkflowAvailable !== false,
    followUpWorkflowMigrationRequired: data.followUpWorkflowMigrationRequired === true,
    knowledgeFixWorkflowAvailable: data.knowledgeFixWorkflowAvailable !== false,
    knowledgeFixWorkflowMigrationRequired: data.knowledgeFixWorkflowMigrationRequired === true,
    liveConversionAvailable: data.liveConversionAvailable !== false,
    liveConversionMigrationRequired: data.liveConversionMigrationRequired === true,
    analyticsSummary: {
      ...createEmptyAnalyticsSummary(),
      ...(data.analyticsSummary || {}),
      recentActivity: {
        ...createEmptyAnalyticsSummary().recentActivity,
        ...(data.analyticsSummary?.recentActivity || {}),
      },
      operatorSignal: {
        ...createEmptyAnalyticsSummary().operatorSignal,
        ...(data.analyticsSummary?.operatorSignal || {}),
      },
    },
  };
}

async function loadOwnerAnalyticsDashboard(agentId) {
  const url = new URL("/dashboard/analytics/summary", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  return normalizeOwnerAnalyticsDashboard(await fetchJson(url.toString()));
}

function normalizeOperatorWorkspace(data = null) {
  const emptyWorkspace = createEmptyOperatorWorkspace();
  const source = normalizeOperatorRecord(data);
  const status = normalizeOperatorRecord(source.status, emptyWorkspace.status);
  const capabilities = normalizeOperatorRecord(source.capabilities);
  const activation = normalizeOperatorRecord(source.activation, emptyWorkspace.activation);
  const briefing = normalizeOperatorRecord(source.briefing, emptyWorkspace.briefing);
  const nextAction = normalizeOperatorRecord(source.nextAction, emptyWorkspace.nextAction);
  const today = normalizeOperatorRecord(source.today, emptyWorkspace.today);
  const contextOptions = normalizeOperatorRecord(source.contextOptions, emptyWorkspace.contextOptions);
  const health = normalizeOperatorRecord(source.health, emptyWorkspace.health);
  const alerts = normalizeOperatorArray(source.alerts, (value) => trimText(value)).filter(Boolean);
  const inbox = normalizeOperatorRecord(source.inbox, emptyWorkspace.inbox);
  const calendar = normalizeOperatorRecord(source.calendar, emptyWorkspace.calendar);
  const automations = normalizeOperatorRecord(source.automations, emptyWorkspace.automations);
  const billing = normalizeOperatorRecord(source.billing, emptyWorkspace.billing);
  const outcomes = normalizeOperatorRecord(source.outcomes, emptyWorkspace.outcomes);
  const contacts = normalizeOperatorRecord(source.contacts, emptyWorkspace.contacts);
  const copilot = normalizeOperatorRecord(source.copilot, emptyWorkspace.copilot);
  const businessProfile = normalizeOperatorRecord(source.businessProfile, emptyWorkspace.businessProfile);
  const contactsFilters = normalizeOperatorRecord(contacts.filters, emptyWorkspace.contacts.filters);
  const contactsSummary = normalizeOperatorRecord(contacts.summary, emptyWorkspace.contacts.summary);
  const contactsHealth = normalizeOperatorRecord(contacts.health, emptyWorkspace.contacts.health);
  const copilotContext = normalizeOperatorRecord(copilot.context, emptyWorkspace.copilot.context);
  const copilotFallback = normalizeOperatorRecord(copilot.fallback, emptyWorkspace.copilot.fallback);
  const copilotBusinessProfile = normalizeOperatorRecord(
    copilotContext.businessProfile,
    emptyWorkspace.copilot.context.businessProfile
  );
  const copilotReadiness = normalizeOperatorRecord(
    copilotBusinessProfile.readiness,
    emptyWorkspace.copilot.context.businessProfile.readiness
  );
  const businessProfileReadiness = normalizeOperatorRecord(
    businessProfile.readiness,
    emptyWorkspace.businessProfile.readiness
  );
  const businessProfilePrefill = normalizeOperatorRecord(
    businessProfile.prefill,
    emptyWorkspace.businessProfile.prefill
  );
  const businessProfileSuggestions = normalizeOperatorRecord(
    businessProfilePrefill.suggestions,
    emptyWorkspace.businessProfile.prefill.suggestions
  );

  return {
    ...emptyWorkspace,
    ...source,
    enabled: source.enabled === false ? false : emptyWorkspace.enabled,
    featureEnabled: source.featureEnabled === false ? false : emptyWorkspace.featureEnabled,
    status: {
      ...emptyWorkspace.status,
      ...status,
      googleCapabilities: normalizeGoogleCapabilities(status.googleCapabilities),
      enabled: status.enabled === false || source.enabled === false ? false : emptyWorkspace.status.enabled,
      featureEnabled:
        status.featureEnabled === false || source.featureEnabled === false || capabilities.featureEnabled === false
          ? false
          : emptyWorkspace.status.featureEnabled,
      googleConfigReady: capabilities.googleAvailable === false ? false : (status.googleConfigReady ?? emptyWorkspace.status.googleConfigReady),
      googleConnectReady: capabilities.googleAvailable === false ? false : (status.googleConnectReady ?? emptyWorkspace.status.googleConnectReady),
      persistenceAvailable:
        capabilities.persistenceAvailable === false ? false : (status.persistenceAvailable ?? emptyWorkspace.status.persistenceAvailable),
      migrationRequired:
        capabilities.migrationRequired === true ? true : (status.migrationRequired ?? emptyWorkspace.status.migrationRequired),
    },
    activation: {
      ...emptyWorkspace.activation,
      ...activation,
      checklist: normalizeOperatorArray(activation.checklist, normalizeOperatorRecord),
      metadata: normalizeOperatorRecord(activation.metadata, emptyWorkspace.activation.metadata),
    },
    briefing,
    nextAction,
    today,
    contextOptions: {
      ...emptyWorkspace.contextOptions,
      ...contextOptions,
      mailboxes: normalizeOperatorArray(contextOptions.mailboxes, normalizeOperatorRecord),
      calendars: normalizeOperatorArray(contextOptions.calendars, normalizeOperatorRecord),
    },
    health: {
      ...emptyWorkspace.health,
      ...health,
      globalError: trimText(
        health.globalError
        || alerts[0]
        || (capabilities.migrationRequired === true
          ? "Customer service workspace tables are missing on this deployment."
          : "")
        || (capabilities.googleAvailable === false
          ? "Google integration is not configured on this deployment yet."
          : "")
      ),
    },
    connectedAccounts: normalizeOperatorArray(source.connectedAccounts, normalizeOperatorWorkspaceAccount),
    inbox: {
      ...emptyWorkspace.inbox,
      ...inbox,
      threads: normalizeOperatorArray(inbox.threads, normalizeOperatorWorkspaceThread),
    },
    calendar: {
      ...emptyWorkspace.calendar,
      ...calendar,
      events: normalizeOperatorArray(calendar.events, normalizeOperatorRecord),
      suggestedSlots: normalizeOperatorArray(calendar.suggestedSlots, normalizeOperatorRecord),
      scheduleItems: normalizeOperatorArray(calendar.scheduleItems, normalizeOperatorRecord),
      reviewItems: normalizeOperatorArray(calendar.reviewItems, normalizeOperatorRecord),
      followUpItems: normalizeOperatorArray(calendar.followUpItems, normalizeOperatorRecord),
      unlinkedItems: normalizeOperatorArray(calendar.unlinkedItems, normalizeOperatorRecord),
      missedBookingOpportunities: normalizeOperatorArray(
        calendar.missedBookingOpportunities,
        normalizeOperatorRecord
      ),
    },
    automations: {
      ...emptyWorkspace.automations,
      ...automations,
      tasks: normalizeOperatorArray(automations.tasks, normalizeOperatorRecord),
      campaigns: normalizeOperatorArray(automations.campaigns, normalizeOperatorRecord),
      followUps: normalizeOperatorArray(automations.followUps, normalizeOperatorRecord),
    },
    billing: {
      ...emptyWorkspace.billing,
      ...billing,
      usage: {
        ...emptyWorkspace.billing.usage,
        ...normalizeOperatorRecord(billing.usage, emptyWorkspace.billing.usage),
      },
      upgradeOptions: normalizeOperatorArray(billing.upgradeOptions, normalizeOperatorRecord),
    },
    outcomes: {
      ...emptyWorkspace.outcomes,
      ...outcomes,
      recentOutcomes: normalizeOperatorArray(outcomes.recentOutcomes, normalizeOperatorRecord),
    },
    copilot: {
      ...emptyWorkspace.copilot,
      ...copilot,
      questions: normalizeOperatorArray(copilot.questions, (value) => trimText(value)),
      summaryCards: normalizeOperatorArray(copilot.summaryCards, normalizeOperatorRecord),
      answers: normalizeOperatorArray(copilot.answers, normalizeOperatorRecord),
      recommendations: normalizeOperatorArray(copilot.recommendations, normalizeOperatorRecord),
      drafts: normalizeOperatorArray(copilot.drafts, normalizeOperatorRecord),
      proposals: normalizeOperatorArray(copilot.proposals, normalizeOperatorRecord),
      proposalSummary: normalizeOperatorRecord(copilot.proposalSummary, emptyWorkspace.copilot.proposalSummary),
      context: {
        ...emptyWorkspace.copilot.context,
        ...copilotContext,
        sourceCounts: {
          ...emptyWorkspace.copilot.context.sourceCounts,
          ...normalizeOperatorRecord(copilotContext.sourceCounts, emptyWorkspace.copilot.context.sourceCounts),
        },
        businessProfile: {
          ...emptyWorkspace.copilot.context.businessProfile,
          ...copilotBusinessProfile,
          readiness: {
            ...emptyWorkspace.copilot.context.businessProfile.readiness,
            ...copilotReadiness,
            missingSections: normalizeOperatorArray(copilotReadiness.missingSections, (value) => trimText(value)),
          },
        },
        warnings: normalizeOperatorArray(copilotContext.warnings, (value) => trimText(value)),
      },
      fallback: {
        ...emptyWorkspace.copilot.fallback,
        ...copilotFallback,
        guidance: normalizeOperatorArray(copilotFallback.guidance, (value) => trimText(value)),
      },
    },
    businessProfile: {
      ...emptyWorkspace.businessProfile,
      ...businessProfile,
      services: normalizeOperatorArray(businessProfile.services, normalizeOperatorRecord),
      pricing: normalizeOperatorArray(businessProfile.pricing, normalizeOperatorRecord),
      policies: normalizeOperatorArray(businessProfile.policies, normalizeOperatorRecord),
      serviceAreas: normalizeOperatorArray(businessProfile.serviceAreas, normalizeOperatorRecord),
      operatingHours: normalizeOperatorArray(businessProfile.operatingHours, normalizeOperatorRecord),
      approvedContactChannels: normalizeOperatorArray(
        businessProfile.approvedContactChannels,
        (value) => trimText(value)
      ),
      approvalPreferences: normalizeOperatorRecord(
        businessProfile.approvalPreferences,
        emptyWorkspace.businessProfile.approvalPreferences
      ),
      readiness: {
        ...emptyWorkspace.businessProfile.readiness,
        ...businessProfileReadiness,
        missingSections: normalizeOperatorArray(businessProfileReadiness.missingSections, (value) => trimText(value)),
      },
      prefill: {
        ...emptyWorkspace.businessProfile.prefill,
        ...businessProfilePrefill,
        suggestions: {
          ...emptyWorkspace.businessProfile.prefill.suggestions,
          ...businessProfileSuggestions,
          services: normalizeOperatorArray(businessProfileSuggestions.services, normalizeOperatorRecord),
          pricing: normalizeOperatorArray(businessProfileSuggestions.pricing, normalizeOperatorRecord),
          policies: normalizeOperatorArray(businessProfileSuggestions.policies, normalizeOperatorRecord),
          serviceAreas: normalizeOperatorArray(businessProfileSuggestions.serviceAreas, normalizeOperatorRecord),
          operatingHours: normalizeOperatorArray(businessProfileSuggestions.operatingHours, normalizeOperatorRecord),
          approvedContactChannels: normalizeOperatorArray(
            businessProfileSuggestions.approvedContactChannels,
            (value) => trimText(value)
          ),
          approvalPreferences: normalizeOperatorRecord(
            businessProfileSuggestions.approvalPreferences,
            emptyWorkspace.businessProfile.prefill.suggestions.approvalPreferences
          ),
          businessSummary: {
            ...emptyWorkspace.businessProfile.prefill.suggestions.businessSummary,
            ...normalizeOperatorRecord(
              businessProfileSuggestions.businessSummary,
              emptyWorkspace.businessProfile.prefill.suggestions.businessSummary
            ),
          },
        },
      },
    },
    contacts: {
      ...emptyWorkspace.contacts,
      ...contacts,
      list: normalizeOperatorArray(contacts.list, normalizeOperatorWorkspaceContact),
      filters: {
        ...emptyWorkspace.contacts.filters,
        ...contactsFilters,
        quick: normalizeOperatorArray(contactsFilters.quick, normalizeOperatorRecord),
        sources: normalizeOperatorArray(contactsFilters.sources, normalizeOperatorRecord),
      },
      summary: {
        ...emptyWorkspace.contacts.summary,
        ...contactsSummary,
      },
      health: {
        ...emptyWorkspace.contacts.health,
        ...contactsHealth,
      },
    },
    summary: {
      ...emptyWorkspace.summary,
      ...normalizeOperatorRecord(source.summary, emptyWorkspace.summary),
    },
  };
}

async function loadOperatorWorkspace(agentId, options = {}) {
  const url = new URL("/agents/operator-workspace", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("force_sync", options.forceSync === true ? "true" : "false");
  url.searchParams.set("dashboard_language", getDashboardLanguage());
  const data = await fetchJson(url.toString());
  const workspace = normalizeOperatorWorkspace(data);

  if (!isOperatorWorkspaceFlagEnabled()) {
    return normalizeOperatorWorkspace({
      ...workspace,
      enabled: false,
      featureEnabled: false,
      status: {
        ...workspace.status,
        enabled: false,
        featureEnabled: false,
        googleConnectReady: false,
      },
      activation: {
        ...workspace.activation,
        operatorWorkspaceEnabled: false,
      },
      briefing: {
        ...workspace.briefing,
        title: workspace.briefing?.title || "Front-desk launch core",
        text: workspace.briefing?.text || "Home, Customers, Front Desk, Analytics, Install, and Settings stay available.",
      },
    });
  }

  return workspace;
}

async function loadOperatorWorkspaceSafe(agentId, options = {}) {
  try {
    return await loadOperatorWorkspace(agentId, options);
  } catch {
    return normalizeOperatorWorkspace({
      ...createEmptyOperatorWorkspace(),
      health: {
        ...createEmptyOperatorWorkspace().health,
        globalError:
          "Email, Calendar, and Automations are temporarily unavailable. Home, Customers, Front Desk, and Analytics are still available.",
      },
    });
  }
}

function coalesceWorkspaceLoadState({
  messagesResult,
  trainingResult,
  actionQueueResult,
  ownerAnalyticsResult,
  operatorResult,
} = {}) {
  const partialErrors = [messagesResult, trainingResult, actionQueueResult, ownerAnalyticsResult, operatorResult]
    .filter((result) => result?.status === "rejected")
    .map((result) => trimText(result.reason?.message || result.reason))
    .filter(Boolean);
  const actionQueue = actionQueueResult?.status === "fulfilled"
    ? actionQueueResult.value
    : createEmptyActionQueue();

  return {
    messages: messagesResult?.status === "fulfilled" ? messagesResult.value : [],
    frontDeskTraining: trainingResult?.status === "fulfilled" ? trainingResult.value : createEmptyFrontDeskTraining(),
    actionQueue: {
      ...actionQueue,
      ownerAnalyticsDashboard: ownerAnalyticsResult?.status === "fulfilled"
        ? ownerAnalyticsResult.value
        : actionQueue.ownerAnalyticsDashboard || null,
    },
    operatorWorkspace: operatorResult?.status === "fulfilled"
      ? operatorResult.value
      : {
        ...createEmptyOperatorWorkspace(),
        health: {
          ...createEmptyOperatorWorkspace().health,
          globalError: "We couldn't load the customer service workspace.",
        },
      },
    hasPartialFailure: [messagesResult, trainingResult, actionQueueResult, ownerAnalyticsResult, operatorResult].some((result) => result?.status === "rejected"),
    partialErrors,
  };
}

function renderWorkspaceFromState() {
  if (!workspaceState?.agent) {
    return;
  }

  const setup = workspaceState.setup || inferSetup(workspaceState.agent);
  if (setup.isReady) {
    renderReadyState(
      workspaceState.agent,
      workspaceState.messages || [],
      workspaceState.actionQueue || createEmptyActionQueue(),
      workspaceState.operatorWorkspace || createEmptyOperatorWorkspace(),
      workspaceState.frontDeskTraining || createEmptyFrontDeskTraining()
    );
    return;
  }

  renderSetupState(
    workspaceState.agent,
    workspaceState.messages || [],
    setup,
    workspaceState.actionQueue || createEmptyActionQueue(),
    workspaceState.operatorWorkspace || createEmptyOperatorWorkspace(),
    workspaceState.frontDeskTraining || createEmptyFrontDeskTraining()
  );
}

async function refreshAgentInstallState(agentId, options = {}) {
  if (!workspaceState?.agent || workspaceState.agent.id !== agentId) {
    await boot({ forceBootLoading: dashboardRuntimeState.hasBooted !== true });
    return;
  }

  setDashboardBackgroundRefreshing(true, options.activeAction || "workspace-refresh");
  try {
    const [agentResult, messagesResult, trainingResult, actionQueueResult, ownerAnalyticsResult, operatorResult] = await Promise.allSettled([
      loadAgentInstallSnapshot(agentId),
      loadAgentMessages(agentId),
      loadFrontDeskTraining(agentId),
      loadActionQueue(agentId),
      loadOwnerAnalyticsDashboard(agentId),
      loadOperatorWorkspaceSafe(agentId, {
        forceSync: options.forceSync === true,
      }),
    ]);
    const nextAgent = agentResult.status === "fulfilled" ? agentResult.value : null;
    const messages = messagesResult.status === "fulfilled" ? messagesResult.value : [];
    const frontDeskTraining = trainingResult.status === "fulfilled" ? trainingResult.value : createEmptyFrontDeskTraining();
    const actionQueue = actionQueueResult.status === "fulfilled"
      ? {
        ...actionQueueResult.value,
        ownerAnalyticsDashboard: ownerAnalyticsResult.status === "fulfilled"
          ? ownerAnalyticsResult.value
          : actionQueueResult.value?.ownerAnalyticsDashboard || null,
      }
      : {
        ...createEmptyActionQueue(),
        ownerAnalyticsDashboard: ownerAnalyticsResult.status === "fulfilled" ? ownerAnalyticsResult.value : null,
      };
    const operatorWorkspace = operatorResult.status === "fulfilled"
      ? operatorResult.value
      : {
        ...createEmptyOperatorWorkspace(),
        health: {
          ...createEmptyOperatorWorkspace().health,
          globalError: "We couldn't refresh the customer service workspace.",
        },
      };

    if (!nextAgent) {
      await boot({ forceBootLoading: dashboardRuntimeState.hasBooted !== true });
      return;
    }

    try {
      activationWizardState = await loadActivationWizard(agentId);
    } catch (error) {
      console.warn("[activation wizard] Could not refresh wizard state:", error.message);
    }

    workspaceState = {
      ...workspaceState,
      agent: nextAgent,
      messages,
      frontDeskTraining,
      actionQueue,
      operatorWorkspace,
      setup: inferSetup(nextAgent),
    };
    renderWorkspaceFromState();

    if (messagesResult.status === "rejected" || trainingResult.status === "rejected" || actionQueueResult.status === "rejected" || ownerAnalyticsResult.status === "rejected" || operatorResult.status === "rejected") {
      setStatus("Some workspace panels could not refresh, but the dashboard stayed open.");
    }
  } finally {
    setDashboardBackgroundRefreshing(false);
  }
}

async function refreshDashboardInBackground(options = {}) {
  const agentId = trimText(options.agentId || workspaceState?.agent?.id);

  if (!agentId) {
    await boot({ forceBootLoading: dashboardRuntimeState.hasBooted !== true });
    return;
  }

  try {
    await refreshAgentInstallState(agentId, {
      forceSync: options.forceSync === true,
      activeAction: options.activeAction || "dashboard-action",
    });
  } catch (error) {
    setDashboardBackgroundRefreshing(false);
    setStatus(error.message || "We couldn't refresh the dashboard data.");
    if (dashboardRuntimeState.hasBooted !== true || !workspaceState?.agent) {
      await boot({ forceBootLoading: true });
    }
  }
}

function scheduleWorkspaceRefresh() {
  if (!workspaceRefreshAgentId) {
    return;
  }

  if (workspaceRefreshTimeout) {
    window.clearTimeout(workspaceRefreshTimeout);
  }

  workspaceRefreshTimeout = window.setTimeout(() => {
    refreshAgentInstallState(workspaceRefreshAgentId).catch((error) => {
      console.warn("[dashboard refresh] Could not refresh workspace state:", error.message);
    });
  }, 250);
}

function bindWorkspaceAutoRefresh(agentId) {
  workspaceRefreshAgentId = trimText(agentId);

  if (workspaceRefreshBound || !workspaceRefreshAgentId) {
    return;
  }

  window.addEventListener("focus", () => {
    scheduleWorkspaceRefresh();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleWorkspaceRefresh();
    }
  });

  workspaceRefreshBound = true;
}

window.addEventListener?.("pagehide", () => {
  stopKnowledgeImportPolling();
});

async function importKnowledgeSync(agent, options = {}) {
  try {
    const importData = await fetchJson("/knowledge/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      auth: options.auth,
      body: JSON.stringify({
        agent_key: agent.publicAgentKey,
        client_id: options.clientId || getClientId(),
        ...(options.force === true ? { force: true } : {}),
      })
    });

    const nextSetup = classifyImportResult(importData);
    trackProductEvent(
      nextSetup.knowledgeState === "ready" ? "knowledge_imported" : "knowledge_limited",
      {
        agentId: agent.id,
        metadata: {
          pageCount: Number(importData?.pageCount || 0),
          contentLength: trimText(importData?.content || "").length,
        },
      }
    );
    return {
      ...nextSetup,
      hadError: false,
    };
  } catch (error) {
    const fallbackSetup = {
      knowledgeState: "limited",
      label: "Limited",
      description: "Your assistant was created, but the website knowledge needs another pass before it feels fully grounded.",
    };

    trackProductEvent("knowledge_limited", {
      agentId: agent.id,
      metadata: {
        importError: error.message || "Import failed",
      },
    });

    return {
      ...fallbackSetup,
      hadError: true,
      errorMessage: getOwnerSafeImportErrorMessage(),
    };
  }
}

function isAsyncKnowledgeImportStart(importData) {
  return importData?.ok === true
    && trimText(importData.mode) === "async"
    && trimText(importData?.import?.jobId)
    && trimText(importData?.agentId);
}

function buildSupersededKnowledgeImportResult(agent) {
  const display = getKnowledgeImportDisplayState(agent?.id);

  if (display) {
    return {
      knowledgeState: "limited",
      label: display.label,
      description: display.message,
      importStatus: display,
      pending: true,
      hadError: false,
    };
  }

  return {
    knowledgeState: "limited",
    label: "Import running",
    description: "A newer website import request is already running.",
    pending: true,
    hadError: false,
  };
}

async function importKnowledge(agent, options = {}) {
  if (options.auth === false) {
    return importKnowledgeSync(agent, options);
  }

  const requestId = knowledgeImportStartRequestId + 1;
  knowledgeImportStartRequestId = requestId;
  stopKnowledgeImportPolling();

  try {
    const importData = await fetchJson("/knowledge/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      auth: options.auth,
      body: JSON.stringify({
        agent_key: agent.publicAgentKey,
        client_id: options.clientId || getClientId(),
        async: true,
        ...(options.force === true ? { force: true } : {}),
      })
    });

    if (requestId !== knowledgeImportStartRequestId) {
      return buildSupersededKnowledgeImportResult(agent);
    }

    if (!isAsyncKnowledgeImportStart(importData)) {
      return importKnowledgeSync(agent, options);
    }

    const display = startKnowledgeImportPolling(agent, importData, options);
    if (!display) {
      return importKnowledgeSync(agent, options);
    }

    trackProductEvent("knowledge_import_started", {
      agentId: agent.id,
      metadata: {
        mode: "async",
        reused: importData?.import?.reused === true,
      },
    });

    return {
      knowledgeState: "limited",
      label: display.label,
      description: display.message,
      importStatus: display,
      pending: true,
      hadError: false,
    };
  } catch (error) {
    if (requestId !== knowledgeImportStartRequestId) {
      return buildSupersededKnowledgeImportResult(agent);
    }

    trackProductEvent("knowledge_import_async_start_failed", {
      agentId: agent.id,
      metadata: {
        importError: error.message || "Import failed",
      },
    });
    return importKnowledgeSync(agent, options);
  }
}

async function runKnowledgeImport(agent, options = {}) {
  setStatus(options.force === true ? "Retrying website import..." : "Starting website import...");
  const nextSetup = await importKnowledge(agent, options);

  try {
    setStatus(nextSetup.importStatus
      ? nextSetup.importStatus.message
      : nextSetup.knowledgeState === "ready"
      ? "Website knowledge is ready."
      : "Website knowledge was imported with limited detail."
    );
    if (!nextSetup.pending) {
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "knowledge-import" });
    }
  } catch (error) {
    setStatus(nextSetup.errorMessage || error.message || "Import failed. The assistant may have limited knowledge.");
    await refreshDashboardInBackground({ agentId: agent.id, activeAction: "knowledge-import" });
  }
}

async function createAssistant(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);

  const websiteUrl = trimText(formData.get("website_url"));
  const assistantName = trimText(formData.get("assistant_name"));
  const tone = trimText(formData.get("tone"));
  const welcomeMessage = trimText(formData.get("welcome_message"));
  const primaryColor = trimText(formData.get("primary_color"));

  if (!websiteUrl) {
    setStatus("Add your website first.");
    return;
  }

  trackProductEvent("onboarding_started", {
    onceKey: "onboarding_started",
    metadata: { entry: "form_submit" },
  });

  submitButton.disabled = true;
  const launchState = {
    status: "running",
    stepIndex: 0,
    headline: "We’re preparing your front desk.",
    detail: "We’re setting up your front desk, connecting your website, and getting a preview ready for you.",
    note: "Website import can take a little longer if your site is larger or slower to respond.",
    websiteUrl,
  };

  saveLaunchState(launchState);
  renderLaunchSequence(launchState);
  setStatus("Creating your front desk...");

  try {
    const createData = await fetchJson("/agents/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: getClientId(),
        business_name: assistantName || websiteUrl,
        website_url: websiteUrl,
        assistant_name: assistantName || websiteUrl,
        tone,
        welcome_message: welcomeMessage,
        primary_color: primaryColor,
      })
    });

    saveLaunchState({
      ...getLaunchState(),
      stepIndex: 1,
      agentId: createData.agent_id,
      agentKey: createData.agent_key,
      detail: "Your front desk is created. Now we’re saving the website and brand details it should represent.",
    });
    trackProductEvent("assistant_created", {
      agentId: createData.agent_id,
      metadata: {
        websiteUrl,
      },
    });
    renderLaunchSequence(getLaunchState());

    window.localStorage.setItem("vonza_agent_key", createData.agent_key);

    saveLaunchState({
      ...getLaunchState(),
      stepIndex: 2,
      detail: "We’re now reading the most useful parts of your website so the front desk can answer with confidence.",
    });
    renderLaunchSequence(getLaunchState());

    const nextSetup = await importKnowledge({
      id: createData.agent_id,
      publicAgentKey: createData.agent_key,
    }, {
      auth: false,
      clientId: getClientId(),
    });

    saveLaunchState({
      ...getLaunchState(),
      stepIndex: 3,
      detail: nextSetup.knowledgeState === "ready"
        ? "Your website knowledge is in place. We’re preparing your preview now."
        : "Your front desk is created. The website knowledge needs another pass, and we’re preparing the next best setup view for you.",
      knowledgeState: nextSetup.knowledgeState,
    });
    renderLaunchSequence(getLaunchState());

    saveLaunchState({
      ...getLaunchState(),
      stepIndex: 4,
      detail: nextSetup.knowledgeState === "ready"
        ? "Everything is coming together. We’re opening the best next view for you now."
        : "Your front desk is ready for final setup. You’ll be able to retry website import from the next screen.",
      nextState: nextSetup.knowledgeState === "ready" ? "ready" : "setup",
    });
    renderLaunchSequence(getLaunchState());

    saveLaunchState({
      ...getLaunchState(),
      status: "success",
    });

    setStatus(nextSetup.knowledgeState === "ready"
      ? "Your front desk is ready to try."
      : nextSetup.errorMessage || "Your front desk is created. Website knowledge needs another pass."
    );

    const successAgent = {
      id: createData.agent_id,
      name: assistantName || websiteUrl,
      assistantName: assistantName || websiteUrl,
      publicAgentKey: createData.agent_key,
    };

    renderLaunchSuccess(successAgent, {
      accessStatus: createData.access_status,
      nextState: nextSetup.knowledgeState === "ready" ? "ready" : "setup",
    });
  } catch (error) {
    clearLaunchState();
    setStatus(error.message || "Failed to create your assistant.");
    renderOnboarding();
  } finally {
    submitButton.disabled = false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("That logo could not be read. Try a smaller image.")));
    reader.readAsDataURL(file);
  });
}

async function readWidgetLogoUpload(form) {
  const input = form?.querySelector('input[name="widget_logo_file"]');
  const file = input?.files?.[0] || null;

  if (!file) {
    return "";
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

  if (!allowedTypes.has(file.type)) {
    throw new Error("Upload a PNG, JPG, WebP, or GIF logo image.");
  }

  if (file.size > 65000) {
    throw new Error("Use a smaller widget logo image under 65 KB.");
  }

  return readFileAsDataUrl(file);
}

function normalizeFullPageFormText(value, maxLength) {
  return trimText(value).slice(0, maxLength);
}

function parseFullPageListField(value, maxItems, maxLength) {
  return String(value || "")
    .split(/\n|,/)
    .map((entry) => normalizeFullPageFormText(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeFullPageAccentColor(value) {
  const normalized = trimText(value).toLowerCase();

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  return "";
}

function normalizeFullPageDesignChoice(value, allowedValues, fallbackValue) {
  const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
  return allowedValues.includes(normalized) ? normalized : fallbackValue;
}

function normalizeFullPageDesignNumber(value, fallbackValue, minValue, maxValue, precision = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallbackValue;
  }

  const clamped = Math.max(minValue, Math.min(maxValue, number));
  const multiplier = 10 ** precision;
  return Math.round(clamped * multiplier) / multiplier;
}

function normalizeFullPageMediaUrl(value, allowedExtensions = []) {
  const normalized = trimText(value);

  if (!normalized) {
    return null;
  }

  if (/^\/assets\/front-desk\/backgrounds\/[a-z0-9._/-]+$/i.test(normalized)) {
    const lowerPath = normalized.toLowerCase();
    return allowedExtensions.some((extension) => lowerPath.endsWith(`.${extension}`))
      ? normalized
      : null;
  }

  try {
    const url = new URL(normalized);
    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    const pathname = url.pathname.toLowerCase();
    if (allowedExtensions.length && !allowedExtensions.some((extension) => pathname.endsWith(`.${extension}`))) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function parseFullPageDesignPayload(formData) {
  const preset = normalizeFullPageDesignChoice(
    formData.get("full_page_design_preset"),
    ["clean-light", "dark-professional", "warm-minimal", "bold-gradient", "image-hero", "video-hero"],
    "clean-light"
  );
  const backgroundPreset = normalizeFullPageDesignChoice(
    formData.get("full_page_background_preset"),
    ["clean-light-abstract", "dark-gold-abstract", "bright-abstract-motion", "dark-abstract-motion"],
    ""
  );
  const backgroundSource = normalizeFullPageDesignChoice(
    formData.get("full_page_background_source"),
    ["preset", "upload", "url"],
    backgroundPreset ? "preset" : "url"
  );

  return {
    preset,
    background_source: backgroundSource,
    background_preset: backgroundPreset || null,
    background_type: normalizeFullPageDesignChoice(
      formData.get("full_page_background_type"),
      ["color", "gradient", "image", "video"],
      "color"
    ),
    background_color: normalizeFullPageAccentColor(formData.get("full_page_background_color")) || "#ffffff",
    background_gradient_to: normalizeFullPageAccentColor(formData.get("full_page_background_gradient_to")) || "#eef4ff",
    background_image_url: normalizeFullPageMediaUrl(formData.get("full_page_background_image_url"), ["png", "jpg", "jpeg", "webp"]),
    background_video_url: normalizeFullPageMediaUrl(formData.get("full_page_background_video_url"), ["mp4", "webm"]),
    background_overlay_color: normalizeFullPageAccentColor(formData.get("full_page_background_overlay_color")) || "#ffffff",
    background_overlay_opacity: normalizeFullPageDesignNumber(formData.get("full_page_background_overlay_opacity"), 0.72, 0, 0.92, 2),
    background_blur: normalizeFullPageDesignNumber(formData.get("full_page_background_blur"), 0, 0, 18),
    background_focal_point: normalizeFullPageDesignChoice(
      formData.get("full_page_background_focal_point"),
      ["center", "top", "left", "right"],
      "center"
    ),
    text_theme: normalizeFullPageDesignChoice(formData.get("full_page_text_theme"), ["dark", "light"], "dark"),
    composer_style: normalizeFullPageDesignChoice(formData.get("full_page_composer_style"), ["soft", "elevated", "minimal"], "soft"),
    chip_style: normalizeFullPageDesignChoice(formData.get("full_page_chip_style"), ["outline", "soft", "subtle-fill"], "outline"),
    status_style: normalizeFullPageDesignChoice(formData.get("full_page_status_style"), ["subtle", "pill", "minimal"], "subtle"),
    background_scope: normalizeFullPageDesignChoice(formData.get("full_page_background_scope"), ["section", "iframe"], "section"),
    disable_video_on_mobile: formData.has("full_page_disable_video_on_mobile"),
  };
}

const FULL_PAGE_BACKGROUND_UPLOAD_LIMITS = Object.freeze({
  image: 8 * 1024 * 1024,
  video: 50 * 1024 * 1024,
});
const FULL_PAGE_BACKGROUND_UPLOAD_TYPES = Object.freeze({
  image: new Set(["image/png", "image/jpeg", "image/webp"]),
  video: new Set(["video/mp4", "video/webm"]),
});

async function uploadFullPageBackgroundFile(form, agent, kind) {
  const input = form?.querySelector(`[data-full-page-background-upload="${kind}"]`);
  const file = input?.files?.[0] || null;

  if (!file) {
    return null;
  }

  if (!FULL_PAGE_BACKGROUND_UPLOAD_TYPES[kind]?.has(file.type)) {
    throw new Error(kind === "image"
      ? "Upload a PNG, JPG, JPEG, or WebP background image."
      : "Upload an MP4 or WebM background video.");
  }

  if (file.size > FULL_PAGE_BACKGROUND_UPLOAD_LIMITS[kind]) {
    throw new Error(kind === "image"
      ? "Use a background image under 8 MB."
      : "Use a background video under 50 MB.");
  }

  const body = new FormData();
  body.set("background", file);

  const result = await fetchJson(`/agents/${encodeURIComponent(agent.id)}/front-desk-background/${kind}`, {
    method: "POST",
    body,
  });

  if (result?.ok !== true || !result.url) {
    throw new Error("The background upload was not confirmed by the server.");
  }

  return result.url;
}

function parseFullPageConfigPayload(formData) {
  const actionCards = [];
  const bookingProvider = trimText(formData.get("booking_provider")).toLowerCase();

  for (let index = 0; index < 6; index += 1) {
    const labelKey = `full_page_action_${index}_label`;
    const promptKey = `full_page_action_${index}_prompt`;

    if (!formData.has(labelKey) && !formData.has(promptKey)) {
      continue;
    }

    const label = normalizeFullPageFormText(formData.get(labelKey), 40);
    const prompt = normalizeFullPageFormText(formData.get(promptKey), 200);

    if (!label || !prompt) {
      continue;
    }

    actionCards.push({
      label,
      description: normalizeFullPageFormText(formData.get(`full_page_action_${index}_description`), 120),
      prompt,
      type: normalizeFullPageFormText(formData.get(`full_page_action_${index}_type`), 24) || "custom",
      enabled: formData.has(`full_page_action_${index}_enabled`),
    });
  }

  return {
    public_page_enabled: formData.has("full_page_public_enabled"),
    public_page_key: normalizeFullPageFormText(formData.get("full_page_public_page_key"), 80) || null,
    booking_provider: bookingProvider === "calendly" ? "calendly" : "manual",
    headline: normalizeFullPageFormText(formData.get("full_page_headline"), 80) || null,
    subtitle: normalizeFullPageFormText(formData.get("full_page_subtitle"), 180) || null,
    action_cards: actionCards,
    suggested_questions: parseFullPageListField(formData.get("full_page_suggested_questions"), 5, 120),
    accent_color: normalizeFullPageAccentColor(formData.get("full_page_accent_color")) || null,
    logo_url: normalizeFullPageFormText(formData.get("full_page_logo_url"), 90000) || null,
    show_booking: formData.has("full_page_show_booking"),
    show_quote: formData.has("full_page_show_quote"),
    show_contact: formData.has("full_page_show_contact"),
    trust_items: parseFullPageListField(formData.get("full_page_trust_items"), 3, 60),
    design: parseFullPageDesignPayload(formData),
  };
}

function parseVoiceConfigPayload(formData) {
  const voice = trimText(formData.get("voice")).toLowerCase();
  const languageBehavior = trimText(formData.get("voice_language_behavior")).toLowerCase();
  const allowedVoices = ["alloy", "ash", "coral", "nova", "sage", "shimmer"];

  return {
    voice_input_enabled: formData.has("voice_input_enabled"),
    spoken_replies_enabled: formData.has("spoken_replies_enabled"),
    web_call_enabled: formData.has("web_call_enabled"),
    auto_send_transcript: formData.has("auto_send_transcript"),
    auto_play_spoken_replies: formData.has("auto_play_spoken_replies"),
    voice: allowedVoices.includes(voice) ? voice : "alloy",
    language_behavior: languageBehavior === "business" ? "business" : "auto",
  };
}

async function saveAssistant(event, agent) {
  event.preventDefault();
  const form = event.currentTarget;
  const formKind = form.dataset.formKind || "customize";
  const submitButton = form.querySelector('button[type="submit"]');
  const saveState = form.querySelector("[data-save-state]");
  const formData = new FormData(form);

  if (formKind === "business-context") {
    const payload = parseBusinessProfilePayload(form);

    submitButton.disabled = true;
    if (saveState) {
      saveState.textContent = "Saving Business Profile...";
      saveState.className = "save-state saving";
      saveState.removeAttribute("title");
    }
    setStatus("Saving Business Profile...");

    try {
      const saveData = await fetchJson("/agents/operator/business-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          profile: payload,
        }),
      });

      if (saveData?.ok !== true || !saveData.profile) {
        throw new Error("Business Profile was not confirmed by the server.");
      }

      setStatus("Business Profile saved.");
      if (saveState) {
        saveState.textContent = "Business Profile saved.";
        saveState.className = "save-state saved";
        saveState.removeAttribute("title");
      }
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "business-profile-save" });
    } catch (error) {
      const message = error.message || "We couldn't save that Business Profile just yet.";
      setStatus(message);
      if (saveState) {
        saveState.textContent = "Could not save Business Profile.";
        saveState.className = "save-state unsaved";
        saveState.title = message;
      }
    } finally {
      submitButton.disabled = false;
    }

    return;
  }

  const nextWebsiteUrl = trimText(formData.get("website_url"));
  const websiteChanged = Boolean(nextWebsiteUrl && nextWebsiteUrl !== trimText(agent.websiteUrl));
  const payload = {
    client_id: getClientId(),
    agent_id: agent.id,
  };
  const updateFieldNames = [
    "assistant_name",
    "widget_purpose",
    "vertical",
    "tone",
    "system_prompt",
    "welcome_message",
    "button_label",
    "website_url",
    "primary_color",
    "secondary_color",
    "allowed_domains",
    "booking_provider",
    "booking_url",
    "quote_url",
    "checkout_url",
    "booking_start_url",
    "quote_start_url",
    "booking_success_url",
    "quote_success_url",
    "checkout_success_url",
    "success_url_match_mode",
    "manual_outcome_mode",
    "contact_email",
    "contact_phone",
    "primary_cta_mode",
    "fallback_cta_mode",
    "business_hours_note",
  ];

  updateFieldNames.forEach((fieldName) => {
    if (formData.has(fieldName)) {
      payload[fieldName] = formData.get(fieldName);
    }
  });

  try {
    const uploadedImageUrl = await uploadFullPageBackgroundFile(form, agent, "image");
    if (uploadedImageUrl) {
      formData.set("full_page_background_type", "image");
      formData.set("full_page_background_source", "upload");
      formData.set("full_page_background_preset", "");
      formData.set("full_page_background_image_url", uploadedImageUrl);
    }

    const uploadedVideoUrl = await uploadFullPageBackgroundFile(form, agent, "video");
    if (uploadedVideoUrl) {
      formData.set("full_page_background_type", "video");
      formData.set("full_page_background_source", "upload");
      formData.set("full_page_background_preset", "");
      formData.set("full_page_background_video_url", uploadedVideoUrl);
    }

    const widgetLogoUrl = await readWidgetLogoUpload(form);
    if (widgetLogoUrl) {
      payload.widget_logo_url = widgetLogoUrl;
    }
  } catch (error) {
    const message = error.message || "That media file could not be uploaded.";
    setStatus(message);
    if (saveState) {
      saveState.textContent = "Could not save media.";
      saveState.className = "save-state unsaved";
      saveState.title = message;
    }
    return;
  }

  if (formData.has("full_page_headline")) {
    payload.full_page_config = parseFullPageConfigPayload(formData);
  }

  if (formData.has("voice_input_enabled") || formData.has("spoken_replies_enabled") || formData.has("web_call_enabled") || formData.has("voice")) {
    payload.voice_config = parseVoiceConfigPayload(formData);
  }

  submitButton.disabled = true;
  if (saveState) {
    saveState.textContent = "Saving changes...";
    saveState.className = "save-state saving";
    saveState.removeAttribute("title");
  }
  setStatus("Saving your assistant...");

  try {
    const updateData = await fetchJson("/agents/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (updateData?.ok !== true || !updateData.agent) {
      throw new Error("Front Desk changes were not confirmed by the server.");
    }

    if (websiteChanged) {
      await runKnowledgeImport({
        id: agent.id,
        publicAgentKey: updateData.agent?.publicAgentKey || agent.publicAgentKey,
      });
      return;
    }

    setStatus("Your assistant has been updated.");
    if (saveState) {
      saveState.textContent = "Changes saved.";
      saveState.className = "save-state saved";
      saveState.removeAttribute("title");
    }
    await refreshDashboardInBackground({ agentId: agent.id, activeAction: "assistant-save" });
    setStatus("Your assistant has been updated.");
  } catch (error) {
    const message = error.message || "We couldn't save those changes just yet.";
    console.error("[dashboard customize] Failed to save assistant settings:", {
      agentId: agent.id,
      payload,
      message,
    });
    setStatus(message);
    if (saveState) {
      saveState.textContent = "Could not save changes.";
      saveState.className = "save-state unsaved";
      saveState.title = message;
    }
  } finally {
    submitButton.disabled = false;
  }
}

async function copyInstallCode(agent) {
  const script = buildScript(agent);

  try {
    await navigator.clipboard.writeText(script);
    saveInstallProgress(agent.id, { codeCopied: true });
    trackProductEvent("install_code_copied", { agentId: agent.id });
    setStatus("Install code copied. You can paste it into your website when you are ready.");
  } catch (_error) {
    const textarea = document.getElementById("install-script-output");
    if (textarea) {
      textarea.select();
      document.execCommand("copy");
    }
    saveInstallProgress(agent.id, { codeCopied: true });
    trackProductEvent("install_code_copied", { agentId: agent.id });
    setStatus("Install code copied. You can paste it into your website when you are ready.");
  }

  await refreshAgentInstallState(agent.id);
}

async function copyInstallInstructions(agent) {
  const installBlock = [
    "Paste this into your website head or global custom code area.",
    "If your CMS uses themes or layouts, place it in the live published theme header.",
    "",
    buildScript(agent),
  ].join("\n");

  try {
    await navigator.clipboard.writeText(installBlock);
    saveInstallProgress(agent.id, { codeCopied: true });
    trackProductEvent("install_instructions_copied", { agentId: agent.id });
    setStatus("Instructions copied with the install code.");
  } catch (_error) {
    const textarea = document.getElementById("install-script-output");
    if (textarea) {
      textarea.value = installBlock;
      textarea.select();
      document.execCommand("copy");
      textarea.value = buildScript(agent);
    }
    saveInstallProgress(agent.id, { codeCopied: true });
    trackProductEvent("install_instructions_copied", { agentId: agent.id });
    setStatus("Instructions copied with the install code.");
  }

  await refreshAgentInstallState(agent.id);
}

async function copyDashboardText(value, successMessage, fallbackElementId = "") {
  const text = trimText(value);

  if (!text) {
    setStatus("There is nothing to copy yet.");
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
    return true;
  } catch (_error) {
    const textarea = fallbackElementId ? document.getElementById(fallbackElementId) : null;
    if (textarea) {
      textarea.select();
      document.execCommand("copy");
      setStatus(successMessage);
      return true;
    }

    setStatus("We couldn't copy that text.");
    return false;
  }
}

async function copyFullPageAssistantUrl(agent) {
  await copyDashboardText(
    buildFullPageAssistantUrl(agent),
    "Front Desk page link copied.",
    "full-page-assistant-url"
  );
}

async function copySectionAssistantSmartEmbed(agent) {
  const textarea = document.getElementById("section-assistant-smart-embed");
  await copyDashboardText(
    textarea?.value || buildSmartAssistantEmbed(agent, "section"),
    "Section smart snippet copied.",
    "section-assistant-smart-embed"
  );
}

async function copySectionAssistantIframe(agent) {
  const textarea = document.getElementById("section-assistant-iframe");
  await copyDashboardText(
    textarea?.value || buildSectionAssistantIframe(agent),
    "Section iframe snippet copied.",
    "section-assistant-iframe"
  );
}

async function copyFullPageAssistantSmartEmbed(agent) {
  const textarea = document.getElementById("full-page-assistant-smart-embed");
  await copyDashboardText(
    textarea?.value || buildSmartAssistantEmbed(agent, "page-takeover"),
    "Dedicated page embed snippet copied.",
    "full-page-assistant-smart-embed"
  );
}

async function copyFullPageAssistantTruePageTakeover(agent) {
  const textarea = document.getElementById("full-page-assistant-true-page-takeover");
  await copyDashboardText(
    textarea?.value || buildSmartAssistantEmbed(agent, "page-takeover", {
      backgroundScope: "page",
      pageReset: true,
      hidePageFooter: true,
    }),
    "True page takeover snippet copied.",
    "full-page-assistant-true-page-takeover"
  );
}

async function copyFullPageAssistantIframe(agent) {
  const textarea = document.getElementById("full-page-assistant-iframe");
  await copyDashboardText(
    textarea?.value || buildFullPageAssistantIframe(agent),
    "Full-page iframe snippet copied.",
    "full-page-assistant-iframe"
  );
}

async function copySimpleFullPageAssistantIframe(agent) {
  const textarea = document.getElementById("full-page-assistant-simple-iframe");
  await copyDashboardText(
    textarea?.value || buildSimpleFullPageAssistantIframe(agent),
    "Simple iframe copied.",
    "full-page-assistant-simple-iframe"
  );
}

async function loadFullPageAssistantQr(agent) {
  const preview = document.querySelector("[data-full-page-qr-preview]");
  const downloadButton = document.querySelector('[data-action="download-full-page-qr"]');
  const endpoint = buildFullPageQrEndpoint(agent);

  if (!preview || !downloadButton) {
    return;
  }

  if (!endpoint) {
    preview.innerHTML = '<p class="install-qr-status">QR code will be available after the Front Desk page is enabled.</p>';
    downloadButton.disabled = true;
    return;
  }

  if (DASHBOARD_LOCAL_FIXTURE_ENABLED) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Local fixture QR preview">
        <rect width="160" height="160" rx="16" fill="#fff"/>
        <path fill="#0f172a" d="M20 20h38v38H20V20Zm10 10v18h18V30H30Zm72-10h38v38h-38V20Zm10 10v18h18V30h-18ZM20 102h38v38H20v-38Zm10 10v18h18v-18H30Zm58-48h12v12H88V64Zm20 0h12v12h-12V64Zm-40 20h12v12H68V84Zm20 0h32v12H88V84Zm42 0h10v12h-10V84ZM68 106h12v34H68v-34Zm20 0h12v12H88v-12Zm22 0h30v12h-30v-12Zm-22 22h32v12H88v-12Zm42 0h10v12h-10v-12Z"/>
      </svg>
    `;
    preview.innerHTML = svg;
    downloadButton.disabled = false;
    downloadButton.dataset.objectUrl = "";
    return;
  }

  try {
    const svg = await fetchText(endpoint, {
      headers: {
        Accept: "image/svg+xml",
      },
    });
    preview.innerHTML = svg;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const objectUrl = URL.createObjectURL(blob);
    const previousUrl = downloadButton.dataset.objectUrl || "";
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }
    downloadButton.dataset.objectUrl = objectUrl;
    downloadButton.disabled = false;
  } catch (error) {
    console.error("[dashboard install] Failed to load full-page assistant QR:", {
      agentId: agent.id,
      message: error?.message || "Unknown QR error",
    });
    preview.innerHTML = '<p class="install-qr-status">QR code could not load. Refresh the dashboard and try again.</p>';
    downloadButton.disabled = true;
  }
}

function downloadFullPageAssistantQr(button) {
  const objectUrl = button?.dataset?.objectUrl || "";

  if (!objectUrl) {
    setStatus("QR code is still loading.");
    return;
  }

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "vonza-full-page-assistant-qr.svg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus("QR code download started.");
}

function bindInstallMethodTabs() {
  const tabs = document.querySelectorAll("[data-install-method-tab]");
  const panels = document.querySelectorAll("[data-install-method-panel]");
  const jumps = document.querySelectorAll("[data-install-method-jump]");

  if (!tabs.length || !panels.length) {
    return;
  }

  const activateMethod = (method, options = {}) => {
    const normalizedMethod = normalizeInstallMethod(method);
    const panelKey = getInstallMethodPanelKey(normalizedMethod);
    setDashboardUiStateValue("installMethod", normalizedMethod);
    if (options.syncHash !== false) {
      syncShellSectionHash("install", { installMethod: normalizedMethod });
    }

    tabs.forEach((tab) => {
      const isActive = tab.dataset.installMethodTab === panelKey;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.installMethodPanel === panelKey;
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
    });

    if (options.scroll === true) {
      document.querySelector(`[data-install-method-panel="${panelKey}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateMethod(tab.dataset.installMethodTab || "page");
    });
  });

  jumps.forEach((jump) => {
    jump.addEventListener("click", () => {
      activateMethod(jump.dataset.installMethodJump || "page", { scroll: true });
    });
  });

  activateMethod(getDashboardUiStateValue("installMethod"), { syncHash: false });
}

function bindFullPageAssistantInstallOptions(agent = {}) {
  const optionButtons = document.querySelectorAll("[data-full-page-option]");
  const optionPanels = document.querySelectorAll("[data-full-page-option-panel]");
  const sectionSmartEmbedOutput = document.getElementById("section-assistant-smart-embed");
  const fullPageIframeOutput = document.getElementById("full-page-assistant-iframe");
  const fullPageSmartEmbedOutput = document.getElementById("full-page-assistant-smart-embed");
  const truePageTakeoverOutput = document.getElementById("full-page-assistant-true-page-takeover");
  const hasFullPageTarget = Boolean(trimText(agent.id || agent.publicAgentKey));

  const activateOption = (option) => {
    const normalizedOption = normalizeInstallFullPageOption(option);
    setDashboardUiStateValue("installFullPageOption", normalizedOption);

    optionButtons.forEach((button) => {
      const isActive = button.dataset.fullPageOption === normalizedOption;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    optionPanels.forEach((panel) => {
      const isActive = panel.dataset.fullPageOptionPanel === normalizedOption;
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
    });
  };

  const syncFullPageIframe = () => {
    if (!sectionSmartEmbedOutput && !fullPageIframeOutput && !fullPageSmartEmbedOutput && !truePageTakeoverOutput) {
      return;
    }

    if (sectionSmartEmbedOutput) {
      sectionSmartEmbedOutput.value = trimText(agent.id)
        ? buildSmartAssistantEmbed(agent, "section")
        : "";
    }

    if (fullPageSmartEmbedOutput) {
      fullPageSmartEmbedOutput.value = trimText(agent.id)
        ? buildSmartAssistantEmbed(agent, "page-takeover")
        : "";
    }

    if (truePageTakeoverOutput) {
      truePageTakeoverOutput.value = trimText(agent.id)
        ? buildSmartAssistantEmbed(agent, "page-takeover", {
          backgroundScope: "page",
          pageReset: true,
          hidePageFooter: true,
        })
        : "";
    }

    if (fullPageIframeOutput) {
      fullPageIframeOutput.value = hasFullPageTarget
        ? buildFullPageAssistantIframe(agent, 120)
        : "";
    }
  };

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateOption(button.dataset.fullPageOption || "share");
    });
  });

  activateOption(getDashboardUiStateValue("installFullPageOption"));
  syncFullPageIframe();
}

function updateStudioSummary(
  form = document.querySelector('form[data-form-kind="customize"]'),
  fallbackAgent = {}
) {
  const nameEl = document.getElementById("studio-summary-name");
  const copyEl = document.getElementById("studio-summary-copy");
  const toneEl = document.getElementById("studio-summary-tone");
  const buttonEl = document.getElementById("studio-summary-button");
  const purposeEl = document.getElementById("studio-summary-purpose");
  const verticalEl = document.getElementById("studio-summary-vertical");
  const primarySwatch = document.getElementById("studio-swatch-primary");
  const secondarySwatch = document.getElementById("studio-swatch-secondary");
  const brandWidgetTitle = document.getElementById("brand-widget-title");
  const brandWidgetMessage = document.getElementById("brand-widget-message");
  const brandLauncherLabel = document.getElementById("brand-launcher-label");
  const brandWidgetAvatar = document.getElementById("brand-widget-avatar");
  const brandLauncher = document.getElementById("brand-launcher");

  if (!form || !nameEl || !copyEl || !toneEl || !buttonEl) {
    return;
  }

  const formData = new FormData(form);
  const getSummaryValue = (fieldName, fallbackValue = "") => {
    if (formData.has(fieldName)) {
      return trimText(formData.get(fieldName));
    }

    return trimText(fallbackValue);
  };
  const assistantName = getSummaryValue("assistant_name", fallbackAgent.assistantName || fallbackAgent.name) || "Your assistant";
  const welcomeMessage = getSummaryValue("welcome_message", fallbackAgent.welcomeMessage)
    || "Your assistant is ready to greet visitors with a clear, helpful first message.";
  const tone = getSummaryValue("tone", fallbackAgent.tone) || "friendly";
  const buttonLabel = getSummaryValue("button_label", fallbackAgent.buttonLabel) || "Chat";
  const purpose = getWidgetPurposeOption(getSummaryValue("widget_purpose", fallbackAgent.purpose));
  const vertical = getBusinessVerticalOption(getSummaryValue("vertical", fallbackAgent.vertical));
  const primaryColor = getSummaryValue("primary_color", fallbackAgent.primaryColor) || "#14b8a6";
  const secondaryColor = getSummaryValue("secondary_color", fallbackAgent.secondaryColor) || "#0f766e";

  nameEl.textContent = assistantName;
  copyEl.textContent = welcomeMessage;
  toneEl.textContent = tone;
  buttonEl.textContent = buttonLabel;
  if (purposeEl) {
    purposeEl.textContent = purpose.label;
  }
  if (verticalEl) {
    verticalEl.textContent = vertical.label;
  }
  if (primarySwatch) {
    primarySwatch.style.setProperty("--swatch-color", primaryColor);
  }

  if (secondarySwatch) {
    secondarySwatch.style.setProperty("--swatch-color", secondaryColor);
  }

  if (brandWidgetTitle) {
    brandWidgetTitle.textContent = assistantName;
  }

  if (brandWidgetMessage) {
    brandWidgetMessage.textContent = welcomeMessage;
  }

  if (brandLauncherLabel) {
    brandLauncherLabel.textContent = buttonLabel;
  }

  if (brandWidgetAvatar) {
    brandWidgetAvatar.style.setProperty("--brand-primary", primaryColor);
    brandWidgetAvatar.style.setProperty("--brand-secondary", secondaryColor);
  }

  if (brandLauncher) {
    brandLauncher.style.setProperty("--brand-primary", primaryColor);
    brandLauncher.style.setProperty("--brand-secondary", secondaryColor);
  }
}

function applyAppearancePreset(form, presetName) {
  if (!form) {
    return;
  }

  const assistantNameInput = form.querySelector('[name="assistant_name"]');
  const welcomeMessageInput = form.querySelector('[name="welcome_message"]');
  const buttonLabelInput = form.querySelector('[name="button_label"]');
  const primaryColorInput = form.querySelector('[name="primary_color"]');
  const secondaryColorInput = form.querySelector('[name="secondary_color"]');

  const presets = {
    clean: {
      buttonLabel: "Ask us",
      welcomeMessage: "Welcome. I’m here to answer questions clearly and help visitors find the right next step.",
      primaryColor: "#14b8a6",
      secondaryColor: "#0f766e",
    },
    bold: {
      buttonLabel: "Start here",
      welcomeMessage: "Welcome. Ask anything about our business and I’ll guide you quickly to the right service or next step.",
      primaryColor: "#0f766e",
      secondaryColor: "#164e63",
    },
    minimal: {
      buttonLabel: "Chat",
      welcomeMessage: "Hi, I’m here to answer questions about our business and point you in the right direction.",
      primaryColor: "#334155",
      secondaryColor: "#0f172a",
    },
  };

  const preset = presets[presetName];

  if (!preset) {
    return;
  }

  if (assistantNameInput && !trimText(assistantNameInput.value)) {
    assistantNameInput.value = "Your assistant";
  }

  if (welcomeMessageInput) {
    welcomeMessageInput.value = preset.welcomeMessage;
  }

  if (buttonLabelInput) {
    buttonLabelInput.value = preset.buttonLabel;
  }

  if (primaryColorInput) {
    primaryColorInput.value = preset.primaryColor;
  }

  if (secondaryColorInput) {
    secondaryColorInput.value = preset.secondaryColor;
  }

  form.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("change", { bubbles: true }));
}

function buildBehaviorSummary(tone, systemPrompt) {
  const normalizedTone = trimText(tone) || "friendly";
  const guidance = trimText(systemPrompt);

  const toneMap = {
    friendly: {
      title: "Warm and welcoming",
      copy: "Vonza will sound approachable and reassuring while still staying useful and clear.",
    },
    professional: {
      title: "Concise and professional",
      copy: "Vonza will speak in a polished, steady way that feels credible and business-ready.",
    },
    sales: {
      title: "Focused on moving visitors forward",
      copy: "Vonza will put more emphasis on services, value, and helping customers take the next step.",
    },
    support: {
      title: "Helpful and support-oriented",
      copy: "Vonza will prioritize clarity, reassurance, and practical answers to customer questions.",
    },
  };

  const base = toneMap[normalizedTone] || toneMap.friendly;

  if (!guidance) {
    return base;
  }

  return {
    title: base.title,
    copy: `${base.copy} Your advanced guidance will further shape what Vonza emphasizes and how direct it feels.`,
  };
}

function updateBehaviorSummary(form, fallbackAgent = {}) {
  const summaryTitle = document.getElementById("behavior-summary-title");
  const summaryCopy = document.getElementById("behavior-summary-copy");

  if (!form || !summaryTitle || !summaryCopy) {
    return;
  }

  const formData = new FormData(form);
  const tone = formData.has("tone") ? trimText(formData.get("tone")) : trimText(fallbackAgent.tone);
  const systemPrompt = formData.has("system_prompt")
    ? trimText(formData.get("system_prompt"))
    : trimText(fallbackAgent.systemPrompt);
  const summary = buildBehaviorSummary(tone, systemPrompt);

  summaryTitle.textContent = summary.title;
  summaryCopy.textContent = summary.copy;
}

function applyConfigurationPreset(form, presetName) {
  if (!form) {
    return;
  }

  const toneInputs = form.querySelectorAll('input[name="tone"]');
  const guidanceInput = form.querySelector('[name="system_prompt"]');

  const presets = {
    general: {
      tone: "professional",
      guidance: "Focus on explaining what the business does clearly, answer service questions directly, and guide visitors toward the best next step without sounding pushy.",
    },
    sales: {
      tone: "sales",
      guidance: "Emphasize value, key services, and reasons to choose this business. Be confident, direct, and helpful when moving visitors toward contact or a quote.",
    },
    support: {
      tone: "support",
      guidance: "Prioritize clarity, reassurance, and practical next steps. Reduce friction, answer common concerns directly, and keep the tone calm.",
    },
  };

  const preset = presets[presetName];

  if (!preset) {
    return;
  }

  toneInputs.forEach((input) => {
    input.checked = input.value === preset.tone;
  });

  if (guidanceInput) {
    guidanceInput.value = preset.guidance;
  }

  form.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("change", { bubbles: true }));
}

function bindStudioState(form, agent) {
  const saveState = form?.querySelector("[data-save-state]");

  if (!form || !saveState) {
    return;
  }

  const initialSnapshot = JSON.stringify(Object.fromEntries(new FormData(form).entries()));

  const syncState = () => {
    updateStudioSummary(form, agent);
    updateBehaviorSummary(form, agent);
    document.querySelectorAll("[data-tone-card]").forEach((toneCard) => {
      const input = toneCard.querySelector('input[name="tone"]');
      toneCard.classList.toggle("active", Boolean(input?.checked));
    });
    const currentSnapshot = JSON.stringify(Object.fromEntries(new FormData(form).entries()));

    if (currentSnapshot === initialSnapshot) {
      saveState.textContent = "No changes yet.";
      saveState.className = "save-state";
      return;
    }

    saveState.textContent = "Unsaved changes";
    saveState.className = "save-state unsaved";
  };

  form.addEventListener("input", syncState);
  form.addEventListener("change", syncState);
  updateStudioSummary(form, agent);
  updateBehaviorSummary(form, agent);
}

function bindSimpleDirtyState(form) {
  const saveState = form?.querySelector("[data-save-state]");

  if (!form || !saveState) {
    return;
  }

  const initialSnapshot = JSON.stringify(Array.from(new FormData(form).entries()));
  const syncState = () => {
    const currentSnapshot = JSON.stringify(Array.from(new FormData(form).entries()));

    if (currentSnapshot === initialSnapshot) {
      saveState.textContent = "No changes yet.";
      saveState.className = "save-state";
      return;
    }

    saveState.textContent = "Unsaved changes";
    saveState.className = "save-state unsaved";
  };

  form.addEventListener("input", syncState);
  form.addEventListener("change", syncState);
}

// Event wiring for the rendered shell
function bindSharedDashboardEvents(agent, messages, setup, actionQueue, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const appShell = document.querySelector("[data-app-shell]");
  const overviewSection = document.querySelector('[data-shell-section="overview"]');
  const appearancePresetButtons = document.querySelectorAll("[data-appearance-preset]");
  const configurationPresetButtons = document.querySelectorAll("[data-configuration-preset]");
  const toneCards = document.querySelectorAll("[data-tone-card]");
  const overviewSectionButtons = document.querySelectorAll("[data-overview-target]");
  const overviewFocusButtons = document.querySelectorAll("[data-overview-focus]");
  const todayFilterButtons = document.querySelectorAll("[data-today-filter]");
  const todaySearchInput = document.querySelector("[data-today-search]");
  const todayQueueRows = document.querySelectorAll("[data-today-queue-row]");
  const todayReviewOpenButtons = document.querySelectorAll("[data-today-open-review]");
  const todayReviewPanels = [...document.querySelectorAll("[data-today-review-panel-item]")]
    .filter((panel) => panel.dataset.todayInlineCard !== "true");
  const todayReviewDrawer = document.querySelector("[data-today-review-drawer]");
  const todayReviewBackdrop = document.querySelector("[data-today-review-backdrop]");
  const todayReviewCloseButtons = document.querySelectorAll("[data-today-review-close]");
  const appointmentReviewActionButtons = document.querySelectorAll("[data-appointment-review-action]");
  const todayQueueStatusActionButtons = document.querySelectorAll("[data-today-queue-status-action]");
  const importButtons = document.querySelectorAll('[data-action="import-knowledge"]');
  const copyButtons = document.querySelectorAll('[data-action="copy-install"]');
  const copyInstructionsButtons = document.querySelectorAll('[data-action="copy-install-instructions"]');
  const copyFullPageUrlButtons = document.querySelectorAll('[data-action="copy-full-page-url"]');
  const copySectionSmartEmbedButtons = document.querySelectorAll('[data-action="copy-section-assistant-smart-embed"]');
  const copySectionIframeButtons = document.querySelectorAll('[data-action="copy-section-assistant-iframe"]');
  const copyFullPageSmartEmbedButtons = document.querySelectorAll('[data-action="copy-full-page-assistant-smart-embed"]');
  const copyTruePageTakeoverButtons = document.querySelectorAll('[data-action="copy-full-page-assistant-true-page-takeover"]');
  const copyFullPageIframeButtons = document.querySelectorAll('[data-action="copy-full-page-iframe"]');
  const copySimpleFullPageIframeButtons = document.querySelectorAll('[data-action="copy-simple-full-page-iframe"]');
  const downloadFullPageQrButtons = document.querySelectorAll('[data-action="download-full-page-qr"]');
  const verifyInstallButtons = document.querySelectorAll('[data-action="verify-install"]');
  const previewLinks = document.querySelectorAll('[data-action="open-preview"]');
  const sectionButtons = document.querySelectorAll("[data-shell-target]");
  const actionQueueSections = document.querySelectorAll("[data-action-queue-section]");
  const actionQueueStatusInputs = document.querySelectorAll("[data-action-queue-status]");
  const actionQueueForms = document.querySelectorAll("[data-action-queue-form]");
  const actionQueueToggleButtons = document.querySelectorAll("[data-action-queue-toggle]");
  const followUpForms = document.querySelectorAll("[data-follow-up-form]");
  const followUpStatusButtons = document.querySelectorAll("[data-follow-up-status-action]");
  const knowledgeFixForms = document.querySelectorAll("[data-knowledge-fix-form]");
  const knowledgeFixStatusButtons = document.querySelectorAll("[data-knowledge-fix-status-action]");
  const manualOutcomeForms = document.querySelectorAll("[data-manual-outcome-form]");
  const openConversationButtons = document.querySelectorAll("[data-open-conversation]");
  const webCallReviewActionButtons = document.querySelectorAll("[data-web-call-review-action]");
  const webCallPracticeQuestionButtons = document.querySelectorAll("[data-web-call-practice-question]");
  const webCallImproveAnswerButtons = document.querySelectorAll("[data-web-call-improve-answer]");
  const openInboxThreadButtons = document.querySelectorAll("[data-open-inbox-thread]");
  const openFollowUpButtons = document.querySelectorAll("[data-open-follow-up]");
  const openCalendarEventButtons = document.querySelectorAll("[data-open-calendar-event]");
  const copyFollowUpButtons = document.querySelectorAll("[data-copy-follow-up]");
  const contactFilterButtons = document.querySelectorAll("[data-contact-filter]");
  const contactSearchInput = document.querySelector("[data-contact-search]");
  const focusCustomerFilterButtons = document.querySelectorAll("[data-focus-customer-filters]");
  const exportCustomerButtons = document.querySelectorAll("[data-export-customers]");
  const contactRows = document.querySelectorAll("[data-contact-row]");
  const contactDetails = document.querySelectorAll("[data-contact-detail]");
  const customerChatToggleButtons = document.querySelectorAll("[data-toggle-customer-chat]");
  const workspaceRecordRows = document.querySelectorAll("[data-record-row]");
  const workspaceRecordDetails = document.querySelectorAll("[data-record-detail]");
  const contactLifecycleForms = document.querySelectorAll("[data-contact-lifecycle-form]");
  const quickContactStatusButtons = document.querySelectorAll("[data-contact-quick-status]");
  const draftContactFollowUpButtons = document.querySelectorAll("[data-draft-contact-followup]");
  const draftContactCampaignButtons = document.querySelectorAll("[data-draft-contact-campaign]");
  const draftContactCalendarButtons = document.querySelectorAll("[data-draft-contact-calendar]");
  const googleConnectButtons = document.querySelectorAll("[data-google-connect]");
  const refreshOperatorButtons = document.querySelectorAll("[data-refresh-operator]");
  const inboxThreadForms = document.querySelectorAll("[data-inbox-thread-form]");
  const draftInboxReplyButtons = document.querySelectorAll("[data-draft-inbox-reply]");
  const calendarDraftForms = document.querySelectorAll("[data-calendar-draft-form]");
  const calendarMutationForms = document.querySelectorAll("[data-calendar-mutation-form]");
  const approveCalendarButtons = document.querySelectorAll("[data-approve-calendar-event]");
  const cancelCalendarButtons = document.querySelectorAll("[data-cancel-calendar-event]");
  const campaignDraftForms = document.querySelectorAll("[data-campaign-draft-form]");
  const approveCampaignButtons = document.querySelectorAll("[data-approve-campaign]");
  const sendCampaignButtons = document.querySelectorAll("[data-send-campaign-steps]");
  const operatorTaskButtons = document.querySelectorAll("[data-update-operator-task]");
  const operatorContextForms = document.querySelectorAll("[data-operator-context-form]");
  const operatorChecklistButtons = document.querySelectorAll("[data-complete-operator-step]");
  const copilotTargetButtons = document.querySelectorAll("[data-copilot-open-target]");
  const copilotApplyButtons = document.querySelectorAll("[data-copilot-apply-proposal]");
  const copilotDismissButtons = document.querySelectorAll("[data-copilot-dismiss-proposal]");
  const shellMenuButtons = document.querySelectorAll("[data-shell-menu-toggle]");
  const shellBackdrop = document.querySelector("[data-shell-backdrop]");
  const automationFocusButtons = document.querySelectorAll("[data-automation-focus]");
  const themeChoiceInputs = document.querySelectorAll("[data-dashboard-theme-choice]");
  const backgroundChoiceInputs = document.querySelectorAll("[data-dashboard-background-choice]");
  const customBackgroundUploads = document.querySelectorAll("[data-dashboard-custom-background-upload]");
  const customBackgroundRemoveButtons = document.querySelectorAll("[data-dashboard-custom-background-remove]");
  const backgroundBlurInputs = document.querySelectorAll("[data-dashboard-background-blur-control]");
  const glassTransparencyInputs = document.querySelectorAll("[data-dashboard-glass-transparency-control]");
  const backgroundDimInputs = document.querySelectorAll("[data-dashboard-background-dim-choice]");
  const accentGlowInputs = document.querySelectorAll("[data-dashboard-accent-glow-choice]");
  const dashboardDensityInputs = document.querySelectorAll("[data-dashboard-density-choice]");
  const dashboardLanguageForms = document.querySelectorAll("[data-dashboard-language-form]");
  const billingChangeButtons = document.querySelectorAll("[data-billing-plan-key]");
  const dashboardHelp = document.querySelector("[data-dashboard-help]");
  const helpToggleButton = document.querySelector("[data-help-toggle]");
  const helpCloseButtons = document.querySelectorAll("[data-help-close]");
  const helpThread = document.querySelector("[data-help-thread]");
  const helpPrompts = document.querySelector("[data-help-prompts]");
  const helpLocation = document.querySelector("[data-help-location]");
  const helpForm = document.querySelector("[data-help-form]");
  const helpInput = helpForm?.querySelector('[name="question"]') || null;
  const activationForms = document.querySelectorAll("[data-activation-form]");
  const activationImportButtons = document.querySelectorAll("[data-activation-import]");
  const activationSkipButtons = document.querySelectorAll("[data-activation-skip]");
  const activationExitButtons = document.querySelectorAll("[data-activation-exit]");
  const activationReturnButtons = document.querySelectorAll("[data-activation-return]");
  const activationCompleteButtons = document.querySelectorAll("[data-activation-complete]");
  const activationImproveButtons = document.querySelectorAll("[data-activation-open-improvement]");
  const availableSections = getAvailableShellSections(operatorWorkspace);
  let activeContactFilter = getContactFilterFromHash() || getDashboardUiStateValue("customersFilter") || "all";
  let activeTodayFilter = getDashboardUiStateValue("todayFilter") || "all";
  let activeTodayQueueKey = getActiveTodayQueueSelection(buildTodayQueueItems(actionQueue, operatorWorkspace));
  let frontDeskController = null;
  let settingsShellController = null;

  const closeShellNavigation = () => {
    appShell?.classList.remove("nav-open");
  };

  const openShellNavigation = () => {
    appShell?.classList.add("nav-open");
  };

  const getHelpState = () => ensureDashboardHelpState(getDashboardHelpContext({
    agent,
    messages,
    setup,
    actionQueue,
    operatorWorkspace,
  }));

  const syncDashboardHelpUi = () => {
    if (!dashboardHelp) {
      return;
    }

    const context = getDashboardHelpContext({
      agent,
      messages,
      setup,
      actionQueue,
      operatorWorkspace,
    });
    const helpState = ensureDashboardHelpState(context);
    const snapshot = buildDashboardHelpSnapshot(context, {
      agent,
      messages,
      setup,
      actionQueue,
      operatorWorkspace,
    });
    const locationLabel = context.currentSubsectionLabel
      ? `${context.currentSectionLabel} / ${context.currentSubsectionLabel}`
      : context.currentSectionLabel;

    dashboardHelp.classList.toggle("is-open", helpState.open);

    if (helpLocation) {
      helpLocation.textContent = `Currently on ${locationLabel}`;
    }

    if (helpPrompts) {
      helpPrompts.innerHTML = buildDashboardHelpStarterPrompts(context, {
        agent,
        messages,
        setup,
        actionQueue,
        operatorWorkspace,
      }).map((prompt) => (
        `<button class="dashboard-help-prompt" type="button" data-help-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`
      )).join("");
    }

    const contextPanel = dashboardHelp.querySelector(".dashboard-help-context");
    if (contextPanel) {
      contextPanel.innerHTML = `
        <p class="support-panel-kicker">${escapeHtml(snapshot.title)}</p>
        <h3 class="support-panel-title">Focused on how to use Vonza right now</h3>
        <p class="support-panel-copy">${escapeHtml(snapshot.copy)}</p>
        <div class="dashboard-help-status-grid">
          ${snapshot.cards.map((card) => `
            <article class="dashboard-help-status-card">
              <span class="dashboard-help-status-label">${escapeHtml(card.label)}</span>
              <strong class="dashboard-help-status-value">${escapeHtml(card.value)}</strong>
              <span class="dashboard-help-status-tone ${escapeHtml(card.tone)}"></span>
            </article>
          `).join("")}
        </div>
        <p class="dashboard-help-context-note">${escapeHtml(snapshot.detail)}</p>
      `;
    }

    if (helpThread) {
      helpThread.innerHTML = `
        ${helpState.messages.map((message) => buildDashboardHelpMessageMarkup(message)).join("")}
        ${helpState.loading ? `<div class="dashboard-help-loading">Ask Vonza is drafting guidance for this workspace...</div>` : ""}
      `;
      helpThread.scrollTop = helpThread.scrollHeight;
    }

    if (helpInput) {
      helpInput.value = helpState.draft || "";
      helpInput.disabled = helpState.loading;
    }

    const submitButton = helpForm?.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = helpState.loading;
    }
  };

  const openDashboardHelp = () => {
    const helpState = getHelpState();
    helpState.open = true;
    syncDashboardHelpUi();
    helpInput?.focus();
  };

  const closeDashboardHelp = () => {
    const helpState = getHelpState();
    helpState.open = false;
    syncDashboardHelpUi();
  };

  const submitDashboardHelpQuestion = async (question) => {
    const normalizedQuestion = trimText(question);

    if (!normalizedQuestion) {
      setStatus("Ask Vonza a question about using the app.");
      return;
    }

    const context = getDashboardHelpContext({
      agent,
      messages,
      setup,
      actionQueue,
      operatorWorkspace,
    });
    const helpState = getHelpState();
    const history = helpState.messages.slice(-6).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    helpState.open = true;
    helpState.loading = true;
    helpState.draft = "";
    helpState.messages.push({
      role: "user",
      content: normalizedQuestion,
    });
    syncDashboardHelpUi();
    setStatus("Ask Vonza is preparing help...");

    try {
      const result = await fetchJson("/agents/product-help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          question: normalizedQuestion,
          history,
          current_section: context.currentSection,
          current_subsection: context.currentSubsection,
        }),
      });

      helpState.messages.push({
        role: "assistant",
        content: trimText(result.answer) || "I couldn't answer that clearly just yet.",
      });
      helpState.suggestedPrompts = Array.isArray(result.suggestedPrompts)
        ? result.suggestedPrompts.map((prompt) => trimText(prompt)).filter(Boolean).slice(0, 4)
        : [];
      setStatus("Ask Vonza is ready.");
    } catch {
      helpState.messages.push({
        role: "assistant",
        content: DASHBOARD_HELP_UNAVAILABLE_MESSAGE,
      });
      setStatus(DASHBOARD_HELP_UNAVAILABLE_MESSAGE);
    } finally {
      helpState.loading = false;
      syncDashboardHelpUi();
      helpInput?.focus();
    }
  };

  const showShellSection = (targetSection, options = {}) => {
    if (!availableSections.includes(targetSection)) {
      return;
    }

    if (targetSection !== "overview") {
      closeTodayReviewDrawer();
    }

    setActiveShellSection(targetSection, operatorWorkspace);

    document.querySelectorAll("[data-shell-target]").forEach((navButton) => {
      navButton.classList.toggle("active", navButton.dataset.shellTarget === targetSection);
    });

    document.querySelectorAll("[data-shell-section]").forEach((section) => {
      section.hidden = section.dataset.shellSection !== targetSection;
    });

    if (targetSection === "settings") {
      settingsShellController?.showSettingsSection(options.settingsSection);
    }

    closeShellNavigation();
    syncDashboardHelpUi();

    if (options.preserveScroll !== true && typeof window.scrollTo === "function") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
  };

  const resolveShellTarget = (targetSection, targetId = "") => {
    if ((targetSection === "customize" || targetSection === "settings") && targetId === "business-context-setup") {
      return {
        targetSection: "settings",
        settingsSection: "business",
      };
    }

    return {
      targetSection,
      settingsSection: "",
    };
  };

  const getCopilotTargetSelector = (section, targetId) => {
    if (!targetId) {
      return "";
    }

    switch (section) {
      case "customize":
        return `#${targetId}`;
      case "settings":
        return `#${targetId}`;
      case "contacts":
        return `[data-contact-card][data-contact-id="${targetId}"]`;
      case "inbox":
        return `[data-thread-card][data-thread-id="${targetId}"]`;
      case "calendar":
        return `[data-calendar-event-card][data-event-id="${targetId}"]`;
      case "automations":
        return `[data-follow-up-card][data-follow-up-id="${targetId}"], [data-operator-task-card][data-task-id="${targetId}"], [data-campaign-card][data-campaign-id="${targetId}"]`;
      case "analytics":
        if (targetId === "notifications") {
          return `#${targetId}`;
        }
        return `[data-action-queue-item][data-action-key="${targetId}"]`;
      default:
        return "";
    }
  };

  const showSectionAndHighlight = (targetSection, selector, options = {}) => {
    showShellSection(targetSection, options);

    if (targetSection === "contacts" && trimText(options.targetId)) {
      selectContact(options.targetId);
    }

    if (!selector) {
      return;
    }

    window.setTimeout(() => {
      const target = document.querySelector(selector);
      if (!target) {
        return;
      }

      if (target.matches("[data-record-row]")) {
        selectWorkspaceRecord(target.dataset.recordKind || "", target.dataset.recordId || "");
      } else if (target.matches("[data-record-detail]")) {
        selectWorkspaceRecord(target.dataset.recordKind || "", target.dataset.recordId || "");
      }

      if (targetSection === "contacts" && target.dataset.contactId) {
        selectContact(target.dataset.contactId);
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("active");
      window.setTimeout(() => target.classList.remove("active"), 1600);
    }, 120);
  };

  const saveFollowUp = async (form, nextStatus = "") => {
    const formData = new FormData(form);
    const followUpId = form.dataset.followUpId;
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus(nextStatus
      ? `Updating follow-up to ${getFollowUpStatusLabel(nextStatus).toLowerCase()}...`
      : "Saving prepared follow-up...");

    try {
      const result = await fetchJson("/agents/follow-ups/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          follow_up_id: followUpId,
          status: nextStatus || undefined,
          subject: trimText(formData.get("subject")),
          draft_content: trimText(formData.get("draft_content")),
        }),
      });

      const inlineAutomationsFollowUp = Boolean(form.closest('[data-shell-section="automations"]'));
      if (!inlineAutomationsFollowUp) {
        setDashboardFocus("action-queue");
      }

      setStatus(result.message || "Follow-up updated.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "follow-up-save" });
      if (inlineAutomationsFollowUp) {
        showSectionAndHighlight("automations", `[data-follow-up-card][data-follow-up-id="${followUpId}"]`);
      }
    } catch (error) {
      setStatus(error.message || "We couldn't update that follow-up.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  };

  const applyCopilotProposal = async (button) => {
    const proposalKey = trimText(button.dataset.proposalKey);

    if (!proposalKey) {
      return;
    }

    button.disabled = true;
    setStatus("Applying Suggestion...");

    try {
      const result = await fetchJson("/agents/operator/copilot/proposals/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          proposal_key: proposalKey,
        }),
      });

      setStatus(result.message || "Suggestion applied.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "copilot-apply" });

      if (result.result?.section) {
        const resolvedTarget = resolveShellTarget(result.result.section, result.result.id || "");
        const fallbackTargetSection = trimText(button.dataset.fallbackTargetSection);
        const fallbackTargetId = trimText(button.dataset.fallbackTargetId);
        const visibleSection = getAvailableShellSections(operatorWorkspace).includes(resolvedTarget.targetSection)
          ? resolvedTarget.targetSection
          : fallbackTargetSection;
        const visibleTargetId = visibleSection === resolvedTarget.targetSection
          ? (result.result.id || "")
          : fallbackTargetId;
        showSectionAndHighlight(
          visibleSection || resolvedTarget.targetSection,
          getCopilotTargetSelector(visibleSection || resolvedTarget.targetSection, visibleTargetId),
          {
            settingsSection: resolvedTarget.settingsSection,
            targetId: visibleTargetId,
          }
        );
      }
    } catch (error) {
      setStatus(error.message || "We couldn't apply that Suggestion.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "copilot-apply" });
    } finally {
      button.disabled = false;
    }
  };

  const dismissCopilotProposal = async (button) => {
    const proposalKey = trimText(button.dataset.proposalKey);

    if (!proposalKey) {
      return;
    }

    button.disabled = true;
    setStatus("Dismissing Suggestion...");

    try {
      const result = await fetchJson("/agents/operator/copilot/proposals/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          proposal_key: proposalKey,
        }),
      });

      setStatus(result.message || "Suggestion dismissed.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "copilot-dismiss" });
    } catch (error) {
      setStatus(error.message || "We couldn't dismiss that Suggestion.");
    } finally {
      button.disabled = false;
    }
  };

  const applyContactFilter = (filterKey = "all") => {
    activeContactFilter = normalizeCustomerFilterKey(filterKey) || "all";
    setDashboardUiStateValue("customersFilter", activeContactFilter);
    let visibleCount = 0;
    const searchTerm = trimText(contactSearchInput?.value || "").toLowerCase();

    contactFilterButtons.forEach((button) => {
      const isActive = button.dataset.contactFilter === activeContactFilter;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    contactRows.forEach((row) => {
      const lifecycle = trimText(row.dataset.contactLifecycle);
      const statuses = trimText(row.dataset.contactStatuses).split("|").filter(Boolean);
      const identity = trimText(row.dataset.contactIdentity);
      const sourceLabels = trimText(row.dataset.contactSourceLabels).split("|").filter(Boolean);
      const searchText = trimText(row.textContent || "").toLowerCase();
      const needsOwnerReview = row.dataset.contactNeedsOwnerReview === "true";
      const followUpPossible = row.dataset.contactFollowUpPossible === "true";
      let visible;

      switch (activeContactFilter) {
        case "unresolved":
        case "needs_review":
          visible = needsOwnerReview || statuses.some((status) => ["needs_reply", "needs_review", "complaint", "follow_up"].includes(status));
          break;
        case "needs_follow_up":
          visible = followUpPossible;
          break;
        case "needs_reply":
          visible = statuses.includes("needs_reply");
          break;
        case "identified":
          visible = identity === "identified";
          break;
        case "guests":
          visible = identity === "guest";
          break;
        case "website_widget":
          visible = sourceLabels.includes("Website widget");
          break;
        case "full_page_assistant":
          visible = sourceLabels.some((label) => ["Front Desk page", "Full-page assistant", "QR / direct link", "QR touchpoint"].includes(label));
          break;
        case "leads":
          visible = statuses.includes("lead") || ["active_lead", "qualified", "new"].includes(lifecycle);
          break;
        case "complaints":
          visible = statuses.includes("complaint");
          break;
        case "resolved":
          visible = statuses.includes("resolved");
          break;
        default:
          visible = true;
      }

      if (visible && searchTerm) {
        visible = searchText.includes(searchTerm);
      }

      row.hidden = !visible;
      const detail = document.querySelector(`[data-contact-detail][data-contact-id="${row.dataset.contactId || ""}"]`);
      if (detail) {
        detail.hidden = !visible && detail.classList.contains("active");
      }
      if (visible) {
        visibleCount += 1;
      }
    });

    const activeVisibleRow = [...contactRows].find((row) => !row.hidden && row.classList.contains("active"));
    const nextVisibleRow = activeVisibleRow || [...contactRows].find((row) => !row.hidden);

    if (nextVisibleRow) {
      selectContact(nextVisibleRow.dataset.contactId || "", { remember: false });
    }

    const resultsShell = document.querySelector("[data-contact-filter-results]");
    const existingEmpty = document.querySelector(".contact-filter-empty");

    if (existingEmpty) {
      existingEmpty.remove();
    }

    if (resultsShell && visibleCount === 0) {
      const empty = document.createElement("div");
      empty.className = "placeholder-card contact-filter-empty";
      empty.textContent = localizeDashboardCopy(
        "No customers match this filter yet.",
        "Még nincs olyan ügyfél, aki megfelel ennek a szűrőnek."
      );
      resultsShell.parentElement?.appendChild(empty);
    }
  };

  const selectContact = (contactId = "", options = {}) => {
    const normalizedContactId = trimText(contactId);
    if (options.remember !== false) {
      setDashboardUiStateValue("selectedCustomerKey", normalizedContactId, { persist: false });
    }

    contactRows.forEach((row) => {
      const isActive = row.dataset.contactId === normalizedContactId;
      row.classList.toggle("active", isActive);
      row.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    contactDetails.forEach((detail) => {
      const isActive = detail.dataset.contactId === normalizedContactId;
      detail.hidden = !isActive;
      detail.classList.toggle("active", isActive);
    });
  };

  const toggleCustomerChat = (button) => {
    const contactId = trimText(button.dataset.contactId);
    const panel = document.querySelector(`[data-customer-chat-panel][data-contact-id="${contactId}"]`);
    const willOpen = panel?.hidden !== false;

    document.querySelectorAll("[data-customer-chat-panel]").forEach((chatPanel) => {
      chatPanel.hidden = true;
    });
    customerChatToggleButtons.forEach((toggleButton) => {
      toggleButton.setAttribute("aria-expanded", "false");
      if (!toggleButton.disabled) {
        toggleButton.textContent = t("common.viewChat");
      }
    });

    if (!panel || !willOpen) {
      return;
    }

    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.textContent = t("common.hideChat");
    setDashboardUiStateValue("selectedConversationKey", contactId, { persist: false });
    selectContact(contactId);
  };

  const selectWorkspaceRecord = (kind = "", recordId = "") => {
    if (!kind || !recordId) {
      return;
    }

    let nextRecordId = recordId;
    const relatedRows = [...workspaceRecordRows].filter((row) => row.dataset.recordKind === kind);
    const relatedDetails = [...workspaceRecordDetails].filter((detail) => detail.dataset.recordKind === kind);
    const requestedRow = relatedRows.find((row) => row.dataset.recordId === recordId && !row.hidden);

    if (!requestedRow) {
      nextRecordId = relatedRows.find((row) => !row.hidden)?.dataset.recordId || "";
    }

    relatedRows.forEach((row) => {
      row.classList.toggle("active", row.dataset.recordId === nextRecordId);
    });

    relatedDetails.forEach((detail) => {
      const isActive = detail.dataset.recordId === nextRecordId;
      detail.hidden = !isActive;
      detail.classList.toggle("active", isActive);
    });
  };

  const getVisibleTodayQueueRows = () => [...todayQueueRows].filter((row) => !row.hidden);

  const getNextVisibleTodayQueueKey = (currentKey = "") => {
    const visibleRows = getVisibleTodayQueueRows();

    if (!visibleRows.length) {
      return "";
    }

    const currentIndex = visibleRows.findIndex((row) => row.dataset.todayQueueKey === currentKey);

    if (currentIndex === -1) {
      return visibleRows[0]?.dataset.todayQueueKey || "";
    }

    return visibleRows[currentIndex + 1]?.dataset.todayQueueKey
      || visibleRows[currentIndex - 1]?.dataset.todayQueueKey
      || visibleRows[0]?.dataset.todayQueueKey
      || "";
  };

  const setTodayReviewDrawerOpen = (open) => {
    overviewSection?.classList.toggle("today-review-open", open);
  };

  const closeTodayReviewDrawer = () => {
    setTodayReviewDrawerOpen(false);
  };

  const selectTodayQueueItem = (queueKey = "", { openDrawer = true } = {}) => {
    const nextQueueKey = trimText(queueKey) || activeTodayQueueKey || todayQueueRows[0]?.dataset.todayQueueKey || "";
    activeTodayQueueKey = nextQueueKey;
    setActiveTodayQueueSelection(nextQueueKey);

    todayQueueRows.forEach((row) => {
      row.classList.toggle("active", row.dataset.todayQueueKey === nextQueueKey);
    });

    todayReviewPanels.forEach((panel) => {
      const isActive = panel.dataset.todayQueueKey === nextQueueKey;
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
    });

    if (todayReviewDrawer && nextQueueKey && openDrawer) {
      setTodayReviewDrawerOpen(true);
    }
  };

  const resolveAppointmentReview = async (button) => {
    const panel = button.closest("[data-today-review-panel-item]");

    if (!panel) {
      return;
    }

    const resolution = trimText(button.dataset.appointmentReviewAction);
    const eventId = trimText(button.dataset.eventId);
    const contactId = trimText(panel.querySelector("[data-appointment-review-contact]")?.value || "");
    const outcomeType = trimText(panel.querySelector("[data-appointment-review-outcome]")?.value || "");
    const note = trimText(panel.querySelector("[data-appointment-review-note]")?.value || "");
    const statusCopy = {
      prepare_follow_up: "Preparing follow-up from the appointment review...",
      link_contact: "Linking appointment to contact...",
      record_outcome: "Recording appointment outcome...",
      no_action_needed: "Clearing appointment review...",
    };
    const queueKey = trimText(panel.dataset.todayQueueKey);
    const nextQueueKey = resolution === "link_contact"
      ? queueKey
      : getNextVisibleTodayQueueKey(queueKey);

    button.disabled = true;
    setStatus(statusCopy[resolution] || "Updating appointment review...");

    try {
      const result = await fetchJson("/agents/operator/calendar/reviews/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          event_id: eventId,
          resolution,
          contact_id: contactId || undefined,
          outcome_type: outcomeType || undefined,
          note,
        }),
      });

      if (result.followUp?.id) {
        setDashboardFocus("automations");
        setStatus("Follow-up draft prepared from the ended appointment review.");
      } else if (result.outcome?.id) {
        setDashboardFocus("action-queue");
        setStatus("Appointment outcome recorded.");
      } else if (resolution === "link_contact") {
        setStatus("Appointment linked to the selected contact.");
      } else {
        setStatus("Appointment review updated.");
      }

      setActiveTodayQueueSelection(nextQueueKey);
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "appointment-review" });
    } catch (error) {
      setStatus(error.message || "We couldn't update that appointment review.");
      button.disabled = false;
    }
  };

  const updateTodayQueueItemStatus = async (button) => {
    const actionKey = trimText(button.dataset.actionKey);
    const nextStatus = trimText(button.dataset.nextStatus);
    const panel = button.closest("[data-today-review-panel-item]");
    const queueKey = trimText(panel?.dataset.todayQueueKey);
    const nextQueueKey = ["done", "dismissed"].includes(nextStatus)
      ? getNextVisibleTodayQueueKey(queueKey)
      : queueKey;

    if (!actionKey || !nextStatus) {
      return;
    }

    button.disabled = true;
    setStatus(`Marking queue item ${getActionQueueStatusLabel(nextStatus).toLowerCase()}...`);

    try {
      await fetchJson("/agents/action-queue/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          action_key: actionKey,
          status: nextStatus,
        }),
      });

      setDashboardFocus("action-queue");
      setStatus(`Action item marked ${getActionQueueStatusLabel(nextStatus).toLowerCase()}.`);
      setActiveTodayQueueSelection(nextQueueKey);
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "today-queue-status" });
    } catch (error) {
      setStatus(error.message || "We couldn't update that queue item.");
      button.disabled = false;
    }
  };

  const applyTodayFilter = (filterKey = "all") => {
    activeTodayFilter = trimText(filterKey) || "all";
    setDashboardUiStateValue("todayFilter", activeTodayFilter);
    const queueList = document.querySelector(".today-queue-list");
    const existingEmpty = document.querySelector(".today-queue-empty");
    const searchTerm = trimText(todaySearchInput?.value || "").toLowerCase();
    let visibleCount = 0;

    todayFilterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.todayFilter === activeTodayFilter);
    });

    todayQueueRows.forEach((row) => {
      const keys = trimText(row.dataset.todayFilterKeys).split("|").filter(Boolean);
      const matchesFilter = activeTodayFilter === "all" || keys.includes(activeTodayFilter);
      const searchText = trimText(row.dataset.todaySearchText).toLowerCase();
      const visible = matchesFilter && (!searchTerm || searchText.includes(searchTerm));
      row.hidden = !visible;

      if (visible) {
        visibleCount += 1;
      }
    });

    existingEmpty?.remove();

    if (queueList && visibleCount === 0) {
      const empty = document.createElement("div");
      empty.className = "placeholder-card today-queue-empty";
      empty.textContent = "No queue items match this filter yet.";
      queueList.parentElement?.appendChild(empty);
    }

    if (todayQueueRows.length) {
      const activeVisibleRow = [...todayQueueRows].find((row) => !row.hidden && row.classList.contains("active"));
      const nextVisibleRow = activeVisibleRow || [...todayQueueRows].find((row) => !row.hidden);

      if (nextVisibleRow) {
        selectTodayQueueItem(nextVisibleRow.dataset.todayQueueKey || "", { openDrawer: false });
      } else {
        setActiveTodayQueueSelection("");
        closeTodayReviewDrawer();
      }
    }
  };
  const saveContactLifecycle = async (form) => {
    const formData = new FormData(form);

    setStatus("Saving customer status...");

    try {
      await fetchJson("/agents/operator/contacts/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          contact_id: form.dataset.contactId,
          lifecycle_state: trimText(formData.get("lifecycle_state")),
        }),
      });

      setActiveShellSection("contacts");
      setStatus("Customer status updated.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "customer-status" });
    } catch (error) {
      setStatus(error.message || "We couldn't update that customer.");
    }
  };

  const saveQuickContactStatus = async (button) => {
    const contactId = trimText(button.dataset.contactId);
    const lifecycleState = trimText(button.dataset.contactQuickStatus);

    if (!contactId || !lifecycleState) {
      return;
    }

    button.disabled = true;
    setStatus(lifecycleState === "customer" ? "Marking customer resolved..." : "Updating customer status...");

    try {
      await fetchJson("/agents/operator/contacts/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          contact_id: contactId,
          lifecycle_state: lifecycleState,
        }),
      });

      setActiveShellSection("contacts");
      setStatus(lifecycleState === "customer" ? "Customer marked resolved." : "Customer status updated.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "customer-status" });
    } catch (error) {
      setStatus(error.message || "We couldn't update that customer.");
      button.disabled = false;
    }
  };

  const exportCustomers = () => {
    const contacts = workspaceState?.operatorWorkspace?.contacts?.list || [];

    if (!contacts.length) {
      setStatus("No customers are available to export yet.");
      return;
    }

    const escapeCsvValue = (value = "") => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
    };

    const rows = [
      ["name", "identity", "identifier", "status", "latest_summary", "last_activity"],
      ...contacts.map((contact) => [
        getCustomerName(contact),
        getCustomerIdentityLabel(contact),
        getCustomerIdentifier(contact),
        getCustomerStatusList(contact).map((status) => status.label).join(" / "),
        getCustomerLatestSummary(contact),
        getCustomerLastActivityLabel(contact),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = window.URL?.createObjectURL?.(blob);

    if (!objectUrl) {
      setStatus("Customer export is not available in this browser.");
      return;
    }

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "vonza-customers.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    setStatus("Customer export downloaded.");
  };

  const draftContactFollowUp = async (button) => {
    setStatus("Preparing suggested reply...");

    try {
      const result = await fetchJson("/agents/operator/contacts/follow-up/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          action_type: trimText(button.dataset.lifecycleState) === "customer" ? "lead_follow_up" : "lead_follow_up",
          contact_id: button.dataset.contactId,
          contact_name: button.dataset.contactName,
          contact_email: button.dataset.contactEmail,
          contact_phone: button.dataset.contactPhone,
          person_key: button.dataset.personKey,
          topic: trimText(button.dataset.lifecycleState) === "customer" ? "Customer follow-up" : "Lead follow-up",
          why_prepared: "Prepared from the Customers workspace.",
        }),
      });

      setStatus("Suggested reply prepared for review.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "customer-follow-up-draft" });
      showSectionAndHighlight("automations", `[data-follow-up-card][data-follow-up-id="${result.followUp?.id || ""}"]`);
    } catch (error) {
      setStatus(error.message || "We couldn't prepare that customer follow-up.");
    }
  };

  const draftContactCampaign = async (button) => {
    setStatus("Generating customer campaign draft...");

    try {
      const result = await fetchJson("/agents/operator/campaigns/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          goal: trimText(button.dataset.goal) || "quote_follow_up",
          contact_id: button.dataset.contactId,
          contact_name: button.dataset.contactName,
          contact_email: button.dataset.contactEmail,
          person_key: button.dataset.personKey,
          lead_id: button.dataset.leadId,
        }),
      });

      setStatus("Campaign draft created for this customer.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "customer-campaign-draft" });
      showSectionAndHighlight("automations", `[data-campaign-card][data-campaign-id="${result.campaign?.id || ""}"]`);
    } catch (error) {
      setStatus(error.message || "We couldn't create that customer campaign.");
    }
  };

  const draftContactCalendarAction = async (button) => {
    const contactName = trimText(button.dataset.contactName || button.dataset.contactEmail || "Customer");

    setStatus("Drafting calendar action for this customer...");

    try {
      await fetchJson("/agents/operator/calendar/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          action_type: "create",
          title: `Call with ${contactName}`,
          description: `Prepared from the Customers workspace for ${contactName}.`,
          start_at: button.dataset.slotStart,
          end_at: button.dataset.slotEnd,
          attendee_emails: trimText(button.dataset.contactEmail) ? [button.dataset.contactEmail] : [],
          contact_id: button.dataset.contactId || undefined,
          lead_id: button.dataset.leadId || undefined,
        }),
      });

      setStatus("Calendar action draft prepared.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "customer-calendar-draft" });
      showSectionAndHighlight("calendar");
    } catch (error) {
      setStatus(error.message || "We couldn't prepare that customer calendar action.");
    }
  };

  const saveKnowledgeFix = async (form, nextStatus = "") => {
    const formData = new FormData(form);
    const knowledgeFixId = form.dataset.knowledgeFixId;
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus(nextStatus
      ? `Updating knowledge fix to ${getKnowledgeFixStatusLabel(nextStatus).toLowerCase()}...`
      : "Saving knowledge fix draft...");

    try {
      const result = await fetchJson("/agents/knowledge-fixes/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          knowledge_fix_id: knowledgeFixId,
          status: nextStatus || undefined,
          proposed_guidance: trimText(formData.get("proposed_guidance")),
        }),
      });

      setDashboardFocus("action-queue");
      setStatus(result.message || "Knowledge fix updated.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "knowledge-fix-save" });
    } catch (error) {
      setStatus(error.message || "We couldn't update that knowledge fix.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  };

  const saveManualOutcome = async (form) => {
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus("Recording fallback outcome...");

    try {
      const result = await fetchJson("/agents/conversion-outcomes/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          outcome_type: trimText(formData.get("outcome_type")),
          note: trimText(formData.get("note")),
          contact_id: form.dataset.contactId,
          action_key: form.dataset.actionKey,
          lead_id: form.dataset.leadId,
          follow_up_id: form.dataset.followUpId,
          inbox_thread_id: form.dataset.inboxThreadId,
          calendar_event_id: form.dataset.calendarEventId,
          campaign_id: form.dataset.campaignId,
          campaign_recipient_id: form.dataset.campaignRecipientId,
          operator_task_id: form.dataset.operatorTaskId,
          session_id: form.dataset.sessionId,
          person_key: form.dataset.personKey,
          related_intent_type: form.dataset.intentType,
          related_action_type: form.dataset.actionType,
        }),
      });

      setDashboardFocus(form.dataset.contactId ? "contacts" : "action-queue");
      setStatus(result.outcome?.label ? `${result.outcome.label} recorded.` : "Fallback outcome recorded.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "manual-outcome-save" });
    } catch (error) {
      setStatus(error.message || "We couldn't record that outcome.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  };

  const updateWebCallReviewAction = async (button) => {
    const actionKey = trimText(button.dataset.actionKey);
    const action = trimText(button.dataset.webCallReviewAction);

    if (!actionKey || !action) {
      return;
    }

    button.disabled = true;
    setStatus(action === "follow_up" ? "Marking Web Call for follow-up..." : "Marking Web Call reviewed...");

    try {
      await fetchJson("/agents/action-queue/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          action_key: actionKey,
          status: "reviewed",
          note: action === "follow_up"
            ? "Owner marked this Web Call as needing follow-up from Recent Web Calls."
            : "Owner reviewed this Web Call from Recent Web Calls.",
          next_step: action === "follow_up" ? "Follow up with this caller if contact details are available." : "",
          follow_up_needed: action === "follow_up",
          follow_up_completed: false,
        }),
      });

      setDashboardFocus("analytics");
      setStatus(action === "follow_up" ? "Web Call marked as needing follow-up." : "Web Call marked reviewed.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "web-call-review" });
    } catch (error) {
      button.disabled = false;
      setStatus(error.message || "We couldn't update that Web Call review.");
    }
  };

  const practiceWebCallQuestion = async (button) => {
    const question = trimText(button.dataset.question);

    if (!question) {
      setStatus("This Web Call does not have a practice question yet.");
      return;
    }

    if (!frontDeskController?.showSection || !frontDeskController?.sendPracticeMessage) {
      setStatus("Practice is not available right now.");
      return;
    }

    button.disabled = true;
    setActiveShellSection("customize", operatorWorkspace);
    showShellSection("customize");
    frontDeskController.showSection("practice", { syncHash: true });

    try {
      await frontDeskController.sendPracticeMessage(question);
      setStatus("Web Call question opened in Practice.");
    } catch (error) {
      setStatus(error.message || "We couldn't practice that Web Call question.");
      button.disabled = false;
    }
  };

  const improveWebCallAnswer = async (button) => {
    const question = trimText(button.dataset.question);

    if (!question) {
      setStatus("This Web Call needs a caller question before it can be improved.");
      return;
    }

    if (!frontDeskController?.openPracticeTeachingForm) {
      await practiceWebCallQuestion(button);
      return;
    }

    setActiveShellSection("customize", operatorWorkspace);
    showShellSection("customize");
    frontDeskController.showSection?.("practice", { syncHash: true });
    frontDeskController.openPracticeTeachingForm({
      question,
      currentAnswer: trimText(button.dataset.answer),
      answer: "",
      sourceType: "conversation",
    });
    setStatus("Web Call answer opened in Practice improvements.");
  };

  const connectGoogleWorkspace = async (event) => {
    const button = event?.currentTarget || event?.target || null;
    const connectMode = trimText(button?.dataset.googleConnectMode);
    const statusMessage = trimText(button?.dataset.googleConnectStatus) || "Preparing inbox connection...";
    const errorMessage = trimText(button?.dataset.googleConnectError) || "We couldn't start the inbox connection.";
    const payload = {
      client_id: getClientId(),
      agent_id: agent.id,
      redirect_path: "/dashboard",
    };

    if (connectMode === "email_read_only") {
      payload.scopes = EMAIL_READ_ONLY_GOOGLE_SCOPES.slice();
    }

    setStatus(statusMessage);

    try {
      const result = await fetchJson("/agents/google/connect/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      window.location.href = result.authUrl;
    } catch (error) {
      setStatus(error.message || errorMessage);
    }
  };

  const saveOperatorActivationState = async (payload = {}, options = {}) => {
    const nextStatusMessage = options.statusMessage || "Saving workspace progress...";
    setStatus(nextStatusMessage);

    try {
      await fetchJson("/agents/operator/activation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getClientId(),
          agent_id: agent.id,
          ...payload,
        }),
      });

      const operatorSnapshot = await loadOperatorWorkspaceSafe(agent.id, {
        forceSync: options.forceSync === true,
      });
      workspaceState = {
        ...(workspaceState || {}),
        agent,
        messages,
        actionQueue,
        operatorWorkspace: operatorSnapshot,
        setup,
      };
      renderWorkspaceFromState();
      setStatus(options.successMessage || "Workspace progress saved.");
    } catch (error) {
      setStatus(error.message || "We couldn't update that onboarding step.");
    }
  };

  const applyActionQueueFilters = (section) => {
    const typeFilter = section.querySelector("[data-action-queue-filter-type]")?.value || "all";
    const statusFilter = section.querySelector("[data-action-queue-filter-status]")?.value || "all";
    const items = section.querySelectorAll("[data-action-queue-item]");
    let visibleCount = 0;

    items.forEach((item) => {
      const matchesType = typeFilter === "all" || item.dataset.actionQueueType === typeFilter;
      const matchesStatus = statusFilter === "all" || item.dataset.actionQueueStatus === statusFilter;
      const visible = matchesType && matchesStatus;
      item.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    const filteredEmptyState = section.querySelector(".action-queue-filter-empty");
    if (filteredEmptyState) {
      filteredEmptyState.hidden = visibleCount > 0;
    }
  };

  settingsShellController = window.VonzaSettingsShell?.bindSettingsShellEvents({
    root: document,
    onSubmitForm: (event) => saveAssistant(event, agent),
    bindStudioState: (form) => bindStudioState(form, agent),
    bindSimpleDirtyState,
    onRequestRerender: renderWorkspaceFromState,
    onUseVoicePracticePrompt: async (transcript) => {
      const prompt = trimText(transcript);
      if (!prompt) {
        throw new Error("Record a voice sample before using it in Practice.");
      }
      if (!frontDeskController?.showSection || !frontDeskController?.sendPracticeMessage) {
        throw new Error("Practice is not available right now.");
      }

      setActiveShellSection("customize", operatorWorkspace);
      showShellSection("customize");
      frontDeskController.showSection("practice", { syncHash: true });
      await frontDeskController.sendPracticeMessage(prompt);
    },
  }) || null;
  frontDeskController = typeof dashboardFrontDeskHelpers.bindFrontDeskEvents === "function"
    ? dashboardFrontDeskHelpers.bindFrontDeskEvents({
      agent,
      boot,
      refreshDashboard: refreshDashboardInBackground,
      fetchJson,
      getClientId,
      normalizeFrontDeskSection,
      setActiveFrontDeskSection,
      setStatus,
      syncDashboardHelpUi,
    })
    : null;
  applyDashboardTheme(getDashboardTheme());
  applyDashboardBackground(getDashboardBackground());
  applyDashboardBackgroundBlur(getDashboardBackgroundBlur());
  applyDashboardGlassTransparency(getDashboardGlassTransparency());
  applyDashboardBackgroundDim(getDashboardBackgroundDim());
  applyDashboardAccentGlow(getDashboardAccentGlow());
  applyDashboardDensity(getDashboardDensity());

  themeChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const savedTheme = saveDashboardTheme(input.value);
      const themeLabel = savedTheme === "system" ? "system" : savedTheme === "dark" ? "Dark Glass" : "Bright Glass";
      setStatus(`Dashboard theme set to ${themeLabel}.`);
    });
  });

  backgroundChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const savedBackground = saveDashboardBackground(input.value);
      const backgroundLabel = getDashboardBackgroundOption(savedBackground)?.label || "dashboard background";
      setStatus(`Dashboard background set to ${backgroundLabel}.`);
    });
  });

  customBackgroundUploads.forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0] || null;
      const message = input
        .closest?.("[data-dashboard-custom-background-control]")
        ?.querySelector?.("[data-dashboard-custom-background-message]");

      if (!file) {
        return;
      }

      input.disabled = true;
      if (message) {
        message.textContent = "Preparing custom dashboard background...";
      }
      setStatus("Preparing custom dashboard background...");

      try {
        const dataUrl = await prepareDashboardCustomBackgroundDataUrl(file);
        saveDashboardCustomBackgroundDataUrl(dataUrl);
        const savedBackground = saveDashboardBackground(DASHBOARD_CUSTOM_BACKGROUND_ID);
        syncDashboardBackgroundControls();
        const backgroundLabel = getDashboardBackgroundOption(savedBackground)?.label || "Custom image";
        if (message) {
          message.textContent = "Custom background saved in this browser.";
        }
        setStatus(`Dashboard background set to ${backgroundLabel}.`);
      } catch (error) {
        const errorMessage = error.message || "We couldn't use that background image.";
        if (message) {
          message.textContent = errorMessage;
        }
        setStatus(errorMessage);
      } finally {
        input.value = "";
        input.disabled = false;
      }
    });
  });

  customBackgroundRemoveButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedBackground = normalizeDashboardBackground(
        document.documentElement?.dataset.dashboardBackground || getDashboardBackground()
      );
      const message = button
        .closest?.("[data-dashboard-custom-background-control]")
        ?.querySelector?.("[data-dashboard-custom-background-message]");

      removeDashboardCustomBackgroundDataUrl();
      if (selectedBackground === DASHBOARD_CUSTOM_BACKGROUND_ID) {
        saveDashboardBackground(DEFAULT_DASHBOARD_BACKGROUND);
      } else {
        syncDashboardBackgroundControls();
      }

      if (message) {
        message.textContent = "Custom background removed from this browser.";
      }
      setStatus("Custom dashboard background removed.");
    });
  });

  backgroundBlurInputs.forEach((input) => {
    const persistBlur = () => {
      const savedBlur = saveDashboardBackgroundBlur(input.value);
      setStatus(`Dashboard background blur set to ${savedBlur}px.`);
    };

    input.addEventListener("input", () => {
      applyDashboardBackgroundBlur(input.value);
    });
    input.addEventListener("change", persistBlur);
  });

  glassTransparencyInputs.forEach((input) => {
    input.addEventListener("input", () => {
      saveDashboardGlassTransparency(input.value);
    });
    input.addEventListener("change", () => {
      const savedTransparency = saveDashboardGlassTransparency(input.value);
      setStatus(`Dashboard glass transparency set to ${savedTransparency}%.`);
    });
  });

  backgroundDimInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const savedDim = saveDashboardBackgroundDim(input.value);
      setStatus(`Dashboard background dim set to ${getDashboardAppearanceChoiceLabel(savedDim)}.`);
    });
  });

  accentGlowInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const savedGlow = saveDashboardAccentGlow(input.value);
      setStatus(`Dashboard accent glow set to ${getDashboardAppearanceChoiceLabel(savedGlow)}.`);
    });
  });

  dashboardDensityInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const savedDensity = saveDashboardDensity(input.value);
      setStatus(`Dashboard density set to ${getDashboardAppearanceChoiceLabel(savedDensity)}.`);
    });
  });

  dashboardLanguageForms.forEach((form) => {
    const saveState = form.querySelector("[data-save-state]");
    const select = form.querySelector('select[name="dashboard_language"]');
    const submitButton = form.querySelector('button[type="submit"]');
    const initialLanguage = normalizeDashboardLanguage(select?.value);

    form.addEventListener("change", () => {
      if (!saveState || !select) {
        return;
      }

      const hasChanged = normalizeDashboardLanguage(select.value) !== initialLanguage;
      saveState.textContent = hasChanged ? t("language.unsaved") : t("language.noChanges");
      saveState.className = hasChanged ? "save-state unsaved" : "save-state";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nextLanguage = normalizeDashboardLanguage(select?.value);

      submitButton.disabled = true;
      if (saveState) {
        saveState.textContent = t("language.saving");
        saveState.className = "save-state saving";
        saveState.removeAttribute("title");
      }
      setStatus(t("language.saving"));

      try {
        await saveDashboardLanguage(nextLanguage);
        setStatus(t("language.settingsSaved"));
        if (saveState) {
          saveState.textContent = t("language.settingsSaved");
          saveState.className = "save-state saved";
          saveState.removeAttribute("title");
        }
        renderWorkspaceFromState();
      } catch (error) {
        const message = error.message || t("language.settingsError");
        setStatus(message);
        if (saveState) {
          saveState.textContent = t("language.settingsError");
          saveState.className = "save-state unsaved";
          saveState.title = message;
        }
      } finally {
        submitButton.disabled = false;
      }
    });
  });

  const setBillingPlanButtonsDisabled = (disabled) => {
    billingChangeButtons.forEach((button) => {
      button.disabled = disabled;
    });
  };

  billingChangeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!agent?.id) {
        setStatus("This workspace needs a saved assistant before changing plans.");
        return;
      }

      const nextPlanKey = normalizeBillingPlanKey(button.dataset.billingPlanKey);
      const nextPlan = getBillingPlan(nextPlanKey);
      setBillingPlanButtonsDisabled(true);
      setStatus(`Opening the ${nextPlan.displayName} plan update...`);

      try {
        const result = await fetchJson("/billing/change-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agent.id,
            plan_key: nextPlanKey,
          }),
        });

        if (result?.redirect_url) {
          window.location.assign(result.redirect_url);
          return;
        }

        if (result?.billing) {
          workspaceState.operatorWorkspace = normalizeOperatorWorkspace({
            ...(workspaceState.operatorWorkspace || createEmptyOperatorWorkspace()),
            billing: result.billing,
          });
        }

        setStatus(
          result?.changed === false
            ? `${nextPlan.displayName} is already the current plan.`
            : `Workspace plan updated to ${nextPlan.displayName}.`
        );
        renderWorkspaceFromState();
      } catch (error) {
        setStatus(error.message || "We couldn't update the workspace plan right now.");
      } finally {
        setBillingPlanButtonsDisabled(false);
      }
    });
  });

  shellMenuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (appShell?.classList.contains("nav-open")) {
        closeShellNavigation();
        return;
      }

      openShellNavigation();
    });
  });

  shellBackdrop?.addEventListener("click", closeShellNavigation);

  helpToggleButton?.addEventListener("click", () => {
    const helpState = getHelpState();

    if (helpState.open) {
      closeDashboardHelp();
      return;
    }

    openDashboardHelp();
  });

  helpCloseButtons.forEach((button) => {
    button.addEventListener("click", closeDashboardHelp);
  });

  helpPrompts?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-help-prompt]");

    if (!button) {
      return;
    }

    await submitDashboardHelpQuestion(button.dataset.helpPrompt || "");
  });

  helpInput?.addEventListener("input", () => {
    const helpState = getHelpState();
    helpState.draft = helpInput.value || "";
  });

  helpForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitDashboardHelpQuestion(helpInput?.value || "");
  });

  dashboardHelp?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && getHelpState().open) {
      closeDashboardHelp();
    }
  });

  copilotTargetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const resolvedTarget = resolveShellTarget(
        button.dataset.shellTarget || "overview",
        button.dataset.targetId || ""
      );

      showSectionAndHighlight(
        resolvedTarget.targetSection,
        getCopilotTargetSelector(resolvedTarget.targetSection, button.dataset.targetId || ""),
        {
          settingsSection: resolvedTarget.settingsSection,
          targetId: button.dataset.targetId || "",
        }
      );
    });
  });

  copilotApplyButtons.forEach((button) => {
    button.addEventListener("click", () => applyCopilotProposal(button));
  });

  copilotDismissButtons.forEach((button) => {
    button.addEventListener("click", () => dismissCopilotProposal(button));
  });

  appearancePresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const appearanceForm = document.querySelector('form[data-form-kind="appearance"]');
      applyAppearancePreset(appearanceForm, button.dataset.appearancePreset || "");
      setStatus("Appearance direction updated. Review the preview and save when it feels right.");
    });
  });

  configurationPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const configurationForm = document.querySelector('form[data-form-kind="configuration"]');
      applyConfigurationPreset(configurationForm, button.dataset.configurationPreset || "");
      setStatus("Behavior direction updated. Review the summary and save when it feels right.");
    });
  });

  toneCards.forEach((card) => {
    card.addEventListener("click", () => {
      const targetTone = card.dataset.toneCard;
      const targetInput = card.querySelector(`input[value="${targetTone}"]`);

      if (targetInput) {
        targetInput.checked = true;
        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      document.querySelectorAll("[data-tone-card]").forEach((toneCard) => {
        toneCard.classList.toggle("active", toneCard.dataset.toneCard === targetTone);
      });
    });
  });

  overviewSectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetSection = button.dataset.overviewTarget;
      const targetId = button.dataset.targetId || "";
      const contactFilter = normalizeCustomerFilterKey(button.dataset.contactFilter || "");

      if (targetSection === "contacts" && contactFilter) {
        activeContactFilter = contactFilter;
      }

      showSectionAndHighlight(
        targetSection,
        getCopilotTargetSelector(targetSection, targetId),
        {
          targetId,
        }
      );

      if (targetSection === "contacts" && (contactFilter || targetId)) {
        if (contactFilter) {
          applyContactFilter(contactFilter);
        }
        syncCustomerHash(contactFilter || activeContactFilter, targetId);
        return;
      }

      const sectionEl = targetId
        ? document.getElementById(targetId)
        : document.querySelector(`[data-shell-section="${targetSection}"]`);
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  overviewFocusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.overviewFocus;

      if (!target) {
        return;
      }

      setDashboardFocus(target);
      refreshDashboardInBackground({ agentId: agent.id, activeAction: "overview-focus" });
    });
  });

  todayFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeTodayFilter = button.dataset.todayFilter || "all";
      applyTodayFilter(activeTodayFilter);
    });
  });

  todaySearchInput?.addEventListener("input", () => {
    applyTodayFilter(activeTodayFilter);
  });

  todayReviewOpenButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const queueKey = button.dataset.todayQueueKey || "";
      selectTodayQueueItem(queueKey);
    });
  });

  todayQueueRows.forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, details, summary")) {
        return;
      }

      selectTodayQueueItem(row.dataset.todayQueueKey || "");
    });
  });

  todayReviewCloseButtons.forEach((button) => {
    button.addEventListener("click", closeTodayReviewDrawer);
  });

  todayReviewBackdrop?.addEventListener("click", closeTodayReviewDrawer);

  appointmentReviewActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await resolveAppointmentReview(button);
    });
  });

  todayQueueStatusActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await updateTodayQueueItemStatus(button);
    });
  });
  actionQueueSections.forEach((section) => {
    section.querySelector("[data-action-queue-filter-type]")?.addEventListener("change", () => {
      applyActionQueueFilters(section);
    });
    section.querySelector("[data-action-queue-filter-status]")?.addEventListener("change", () => {
      applyActionQueueFilters(section);
    });
    applyActionQueueFilters(section);
  });

  actionQueueStatusInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      const previousStatus = input.dataset.previousStatus || "new";
      const nextStatus = input.value;
      input.disabled = true;
      setStatus("Updating action queue item...");

      try {
        await fetchJson("/agents/action-queue/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            action_key: input.dataset.actionKey,
            status: nextStatus,
          }),
        });
        input.dataset.previousStatus = nextStatus;
        setDashboardFocus("action-queue");
        setStatus(`Action item marked ${getActionQueueStatusLabel(nextStatus).toLowerCase()}.`);
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "action-queue-status" });
      } catch (error) {
        input.value = previousStatus;
        setStatus(error.message || "We couldn't update that action item.");
      } finally {
        input.disabled = false;
      }
    });
    input.dataset.previousStatus = input.value;
  });

  actionQueueToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const actionKey = button.dataset.actionKey;
      const form = document.querySelector(`[data-action-queue-form][data-action-key="${actionKey}"]`);

      if (!form) {
        return;
      }

      const opening = form.hidden;
      form.hidden = !form.hidden;
      button.textContent = opening
        ? (button.dataset.closeLabel || "Hide follow-up note")
        : (button.dataset.openLabel || "Open follow-up note");
    });
  });

  actionQueueForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const actionKey = form.dataset.actionKey;
      const submitButton = form.querySelector('button[type="submit"]');
      const itemEl = form.closest("[data-action-queue-item]");
      const statusInput = itemEl?.querySelector('[data-action-queue-status]');

      submitButton.disabled = true;
      setStatus("Saving follow-up note...");

      try {
        const result = await fetchJson("/agents/action-queue/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            action_key: actionKey,
            status: statusInput?.value || "new",
            note: trimText(formData.get("note")),
            outcome: trimText(formData.get("outcome")),
            next_step: trimText(formData.get("next_step")),
            follow_up_needed: formData.get("follow_up_needed"),
            follow_up_completed: formData.get("follow_up_completed"),
            contact_status: trimText(formData.get("contact_status")),
          }),
        });

        setDashboardFocus("action-queue");
        if (result.migrationRequired) {
          setStatus("Follow-up could not be saved yet because this workspace is still finishing setup.");
        } else {
          setStatus("Follow-up note saved.");
        }
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "action-queue-follow-up" });
      } catch (error) {
        setStatus(error.message || "We couldn't save that follow-up yet.");
      } finally {
        submitButton.disabled = false;
      }
    });
  });

  followUpForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveFollowUp(form);
    });
  });

  followUpStatusButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const form = button.closest("[data-follow-up-form]");

      if (!form) {
        return;
      }

      await saveFollowUp(form, button.dataset.nextStatus || "");
    });
  });

  knowledgeFixForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveKnowledgeFix(form);
    });
  });

  knowledgeFixStatusButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const form = button.closest("[data-knowledge-fix-form]");

      if (!form) {
        return;
      }

      await saveKnowledgeFix(form, button.dataset.nextStatus || "");
    });
  });

  manualOutcomeForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveManualOutcome(form);
    });
  });

  webCallReviewActionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await updateWebCallReviewAction(button);
    });
  });

  webCallPracticeQuestionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await practiceWebCallQuestion(button);
    });
  });

  webCallImproveAnswerButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await improveWebCallAnswer(button);
    });
  });

  openConversationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const messageId = button.dataset.messageId;
      const contactId = trimText(button.dataset.contactId);

      if (contactId) {
        showSectionAndHighlight("contacts", `[data-contact-card][data-contact-id="${contactId}"]`, {
          targetId: contactId,
        });
        syncCustomerHash(activeContactFilter, contactId);
        return;
      }

      showSectionAndHighlight("analytics", `[data-conversation-message="${messageId}"]`);
    });
  });

  openInboxThreadButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showSectionAndHighlight("inbox", `[data-thread-card][data-thread-id="${button.dataset.threadId}"]`);
    });
  });

  openFollowUpButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showSectionAndHighlight("automations", `[data-follow-up-card][data-follow-up-id="${button.dataset.followUpId}"]`);
    });
  });

  openCalendarEventButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showSectionAndHighlight("calendar", `[data-calendar-event-card][data-event-id="${button.dataset.eventId}"]`);
    });
  });

  contactFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeContactFilter = button.dataset.contactFilter || "all";
      applyContactFilter(button.dataset.contactFilter || "all");
      syncCustomerHash(activeContactFilter);
    });
  });

  focusCustomerFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-customer-filter-strip]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      contactFilterButtons[0]?.focus?.();
      setStatus("Customer filters are ready.");
    });
  });

  exportCustomerButtons.forEach((button) => {
    button.addEventListener("click", exportCustomers);
  });

  contactSearchInput?.addEventListener("input", () => {
    applyContactFilter(activeContactFilter);
  });

  quickContactStatusButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await saveQuickContactStatus(button);
    });
  });

  contactRows.forEach((row) => {
    const openContactRow = () => {
      const contactId = row.dataset.contactId || "";
      selectContact(contactId);
      syncCustomerHash(activeContactFilter, contactId);
    };

    row.addEventListener("click", openContactRow);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openContactRow();
    });
  });

  customerChatToggleButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCustomerChat(button);
    });
  });

  workspaceRecordRows.forEach((row) => {
    row.addEventListener("click", () => {
      selectWorkspaceRecord(row.dataset.recordKind || "", row.dataset.recordId || "");
    });
  });

  contactLifecycleForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveContactLifecycle(form);
    });
  });

  draftContactFollowUpButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await draftContactFollowUp(button);
    });
  });

  draftContactCampaignButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await draftContactCampaign(button);
    });
  });

  draftContactCalendarButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await draftContactCalendarAction(button);
    });
  });

  copyFollowUpButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const form = button.closest("[data-follow-up-form]");
      const draftValue = trimText(form?.querySelector('textarea[name="draft_content"]')?.value || "");

      if (!draftValue) {
        setStatus("There is no draft content to copy yet.");
        return;
      }

      try {
        await navigator.clipboard.writeText(draftValue);
        setStatus("Follow-up draft copied.");
      } catch {
        setStatus("We couldn't copy that draft.");
      }
    });
  });

  const refreshActivationWizard = async () => {
    try {
      activationWizardState = await loadActivationWizard(agent.id);
    } catch (error) {
      console.warn("[activation wizard] Could not refresh wizard state:", error.message);
    }
  };

  const completeActivationStep = async (stepKey, extraPayload = {}) => {
    await saveActivationWizardProgress({
      agent_id: agent.id,
      step: stepKey,
      action: "complete_step",
      ...extraPayload,
    });
  };

  const saveActivationForm = async (form) => {
    const stepKey = trimText(form.dataset.activationForm);
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const payload = {
      client_id: getClientId(),
      agent_id: agent.id,
    };

    if (stepKey === "business_basics") {
      payload.name = trimText(formData.get("name"));
      payload.website_url = trimText(formData.get("website_url"));
      payload.vertical = trimText(formData.get("vertical"));

      if (!payload.name || !payload.website_url) {
        setStatus("Add the business name and website URL before continuing.");
        return;
      }
    } else if (stepKey === "configure_assistant") {
      payload.assistant_name = trimText(formData.get("assistant_name"));
      payload.tone = trimText(formData.get("tone"));
      payload.widget_purpose = trimText(formData.get("widget_purpose"));
      payload.contact_email = trimText(formData.get("contact_email"));

      if (!payload.assistant_name || !payload.tone || !payload.widget_purpose) {
        setStatus("Add the assistant name, tone, and purpose before continuing.");
        return;
      }
    } else if (stepKey === "test_improve") {
      const question = trimText(formData.get("test_question"));

      if (!question) {
        setStatus("Add one sample customer question first.");
        return;
      }

      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: "test_improve",
        action: "return",
        test_question: question,
        test_quality: "unknown",
      });
      setActiveShellSection("customize", operatorWorkspace);
      showShellSection("customize");
      frontDeskController?.showSection?.("practice", { syncHash: true });
      await frontDeskController?.sendPracticeMessage?.(question);
      await completeActivationStep("test_improve", {
        test_question: question,
        test_quality: activationWizardState?.signals?.needsImprovement ? "needs_improvement" : "strong",
      });
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }
    setStatus(stepKey === "business_basics" ? "Saving business basics..." : "Saving assistant configuration...");

    try {
      const updateData = await fetchJson("/agents/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (updateData?.ok !== true) {
        throw new Error("Activation changes were not confirmed.");
      }

      await completeActivationStep(stepKey);
      setStatus(stepKey === "business_basics" ? "Business basics saved." : "Assistant configuration saved.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-step-save" });
    } catch (error) {
      setStatus(error.message || "We couldn't save that activation step.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  };

  activationForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveActivationForm(form);
    });
  });

  activationImportButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const force = button.dataset.importForce === "true";
      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: "import_knowledge",
        action: "return",
        import_status: "running",
      });
      setStatus("Importing website knowledge...");

      try {
        const nextSetup = await importKnowledge(agent, { force });
        if (nextSetup.pending) {
          setStatus(nextSetup.importStatus?.message || "Website import is running.");
          return;
        }

        await completeActivationStep("import_knowledge", {
          import_status: nextSetup.hadError ? "failed" : nextSetup.knowledgeState === "ready" ? "success" : "limited",
          import_error: nextSetup.errorMessage || "",
        });
        setStatus(nextSetup.importStatus
          ? nextSetup.importStatus.message
          : nextSetup.knowledgeState === "ready"
          ? "Website knowledge imported."
          : nextSetup.errorMessage || "Website knowledge imported with limited detail.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-import" });
      } catch (error) {
        await saveActivationWizardProgress({
          agent_id: agent.id,
          step: "import_knowledge",
          action: "return",
          import_status: "failed",
          import_error: error.message || "Import failed.",
        });
        setStatus(error.message || "Import failed.");
      } finally {
        button.disabled = false;
      }
    });
  });

  activationSkipButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: button.dataset.activationSkip,
        action: "skip_step",
      });
      setStatus("Activation step skipped. You can return later.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-skip" });
    });
  });

  activationExitButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: activationWizardState?.currentStep || "",
        action: "exit",
      });
      setStatus("Wizard closed. Dashboard remains usable.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-exit" });
    });
  });

  activationReturnButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: activationWizardState?.currentStep || "",
        action: "return",
      });
      setStatus("Activation wizard reopened.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-return" });
    });
  });

  activationCompleteButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const stepKey = button.dataset.activationComplete;
      await completeActivationStep(stepKey);
      if (stepKey === "test_improve") {
        await saveActivationWizardProgress({
          agent_id: agent.id,
          step: stepKey,
          action: "complete_wizard",
        });
      }
      setStatus(stepKey === "test_improve" ? "Activation wizard completed." : "Activation step completed.");
      await refreshDashboardInBackground({ agentId: agent.id, activeAction: "activation-complete" });
    });
  });

  activationImproveButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await saveActivationWizardProgress({
        agent_id: agent.id,
        step: "test_improve",
        action: "return",
        test_quality: "needs_improvement",
        route_target: "analytics",
      });
      showSectionAndHighlight("analytics", "[data-action-queue-section]");
      setStatus("Opened Analytics for the weak answer.");
      button.disabled = false;
    });
  });

  importButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const force = button.dataset.importForce === "true" || /retry|refresh/i.test(trimText(button.textContent));
      await runKnowledgeImport(agent, { force });
      await refreshActivationWizard();
    });
  });

  googleConnectButtons.forEach((button) => {
    button.addEventListener("click", connectGoogleWorkspace);
  });

  refreshOperatorButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const forceSync = button.dataset.forceSync === "true";

      setStatus(forceSync ? "Refreshing live dashboard data..." : "Refreshing dashboard data...");

      try {
        await refreshAgentInstallState(agent.id, { forceSync });
        setStatus(forceSync ? "Live dashboard data refreshed." : "Dashboard data refreshed.");
      } catch (error) {
        setStatus(error.message || "We couldn't refresh the dashboard data.");
      }
    });
  });

  operatorContextForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      await saveOperatorActivationState({
        selected_mailbox: trimText(formData.get("selected_mailbox")),
        calendar_context: "primary",
      }, {
        statusMessage: "Saving business context...",
        successMessage: "Business context saved.",
      });
    });
  });

  operatorChecklistButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const step = trimText(button.dataset.completeOperatorStep);

      if (step === "inbox_review") {
        await saveOperatorActivationState({
          mark_inbox_reviewed: true,
        }, {
          statusMessage: "Saving inbox review progress...",
          successMessage: "Email review marked complete.",
        });
        return;
      }

      if (step === "calendar_review") {
        await saveOperatorActivationState({
          mark_calendar_reviewed: true,
        }, {
          statusMessage: "Saving calendar review progress...",
          successMessage: "Calendar review marked complete.",
        });
      }
    });
  });

  draftInboxReplyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const threadId = button.dataset.threadId;

      setStatus("Drafting inbox reply...");

      try {
        await fetchJson("/agents/operator/inbox/draft-reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            thread_id: threadId,
          }),
        });

        setActiveShellSection("inbox");
        setStatus("Reply draft prepared.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "inbox-reply-draft" });
      } catch (error) {
        setStatus(error.message || "We couldn't prepare that reply.");
      }
    });
  });

  inboxThreadForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      setStatus("Sending owner-approved inbox reply...");

      try {
        await fetchJson("/agents/operator/inbox/send-reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            thread_id: form.dataset.threadId,
            subject: trimText(formData.get("subject")),
            body: trimText(formData.get("body")),
          }),
        });

        setActiveShellSection("inbox");
        setStatus("Reply sent from the connected inbox.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "inbox-reply-send" });
      } catch (error) {
        setStatus(error.message || "We couldn't send that inbox reply.");
      }
    });
  });

  calendarDraftForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const attendeeEmail = trimText(formData.get("attendee_email"));
      const attendeeEmails = attendeeEmail ? [attendeeEmail] : [];

      setStatus("Creating calendar approval draft...");

      try {
        await fetchJson("/agents/operator/calendar/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            action_type: trimText(formData.get("action_type")),
            title: trimText(formData.get("title")),
            description: trimText(formData.get("description")),
            start_at: trimText(formData.get("start_at")),
            end_at: trimText(formData.get("end_at")),
            attendee_emails: attendeeEmails,
          }),
        });

        setActiveShellSection("calendar");
        setStatus("Calendar draft prepared for owner approval.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "calendar-draft" });
      } catch (error) {
        setStatus(error.message || "We couldn't draft that calendar change.");
      }
    });
  });

  calendarMutationForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      setStatus("Drafting calendar update...");

      try {
        await fetchJson("/agents/operator/calendar/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            event_id: form.dataset.eventId,
            action_type: trimText(formData.get("action_type")) || "update",
            start_at: trimText(formData.get("start_at")),
            end_at: trimText(formData.get("end_at")),
          }),
        });

        setActiveShellSection("calendar");
        setStatus("Calendar update draft prepared.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "calendar-draft" });
      } catch (error) {
        setStatus(error.message || "We couldn't draft that update.");
      }
    });
  });

  cancelCalendarButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Drafting calendar cancellation...");

      try {
        await fetchJson("/agents/operator/calendar/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            event_id: button.dataset.eventId,
            action_type: "cancel",
          }),
        });

        setActiveShellSection("calendar");
        setStatus("Cancellation draft prepared.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "calendar-cancel" });
      } catch (error) {
        setStatus(error.message || "We couldn't draft that cancellation.");
      }
    });
  });

  approveCalendarButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Approving calendar change...");

      try {
        await fetchJson("/agents/operator/calendar/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            event_id: button.dataset.eventId,
          }),
        });

        setActiveShellSection("calendar");
        setStatus("Calendar change approved.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "calendar-approve" });
      } catch (error) {
        setStatus(error.message || "We couldn't approve that calendar change.");
      }
    });
  });

  campaignDraftForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      setStatus("Generating campaign draft...");

      try {
        await fetchJson("/agents/operator/campaigns/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            goal: trimText(formData.get("goal")),
            send_window_hour: trimText(formData.get("send_window_hour")),
          }),
        });

        setActiveShellSection("automations");
        setStatus("Campaign draft created.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "campaign-draft" });
      } catch (error) {
        setStatus(error.message || "We couldn't create that campaign draft.");
      }
    });
  });

  approveCampaignButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Approving campaign...");

      try {
        await fetchJson("/agents/operator/campaigns/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            campaign_id: button.dataset.campaignId,
          }),
        });

        setActiveShellSection("automations");
        setStatus("Campaign approved and queued.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "campaign-approve" });
      } catch (error) {
        setStatus(error.message || "We couldn't approve that campaign.");
      }
    });
  });

  sendCampaignButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Sending due campaign steps...");

      try {
        await fetchJson("/agents/operator/campaigns/send-due", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            campaign_id: button.dataset.campaignId,
          }),
        });

        setActiveShellSection("automations");
        setStatus("Due campaign steps sent.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "campaign-send" });
      } catch (error) {
        setStatus(error.message || "We couldn't send those campaign steps.");
      }
    });
  });

  operatorTaskButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Updating owner task...");

      try {
        await fetchJson("/agents/operator/tasks/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
            task_id: button.dataset.taskId,
            status: button.dataset.taskStatus,
          }),
        });

        setActiveShellSection("automations");
        setStatus("Owner task updated.");
        await refreshDashboardInBackground({ agentId: agent.id, activeAction: "operator-task-update" });
      } catch (error) {
        setStatus(error.message || "We couldn't update that task.");
      }
    });
  });

  copyButtons.forEach((button) => {
    button.addEventListener("click", () => copyInstallCode(agent));
  });

  copyInstructionsButtons.forEach((button) => {
    button.addEventListener("click", () => copyInstallInstructions(agent));
  });

  copyFullPageUrlButtons.forEach((button) => {
    button.addEventListener("click", () => copyFullPageAssistantUrl(agent));
  });

  copySectionSmartEmbedButtons.forEach((button) => {
    button.addEventListener("click", () => copySectionAssistantSmartEmbed(agent));
  });

  copySectionIframeButtons.forEach((button) => {
    button.addEventListener("click", () => copySectionAssistantIframe(agent));
  });

  copyFullPageSmartEmbedButtons.forEach((button) => {
    button.addEventListener("click", () => copyFullPageAssistantSmartEmbed(agent));
  });

  copyTruePageTakeoverButtons.forEach((button) => {
    button.addEventListener("click", () => copyFullPageAssistantTruePageTakeover(agent));
  });

  copyFullPageIframeButtons.forEach((button) => {
    button.addEventListener("click", () => copyFullPageAssistantIframe(agent));
  });

  copySimpleFullPageIframeButtons.forEach((button) => {
    button.addEventListener("click", () => copySimpleFullPageAssistantIframe(agent));
  });

  downloadFullPageQrButtons.forEach((button) => {
    button.addEventListener("click", () => downloadFullPageAssistantQr(button));
  });

  bindInstallMethodTabs();
  bindFullPageAssistantInstallOptions(agent);
  loadFullPageAssistantQr(agent);

  verifyInstallButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      setStatus("Verifying installation...");

      try {
        const result = await fetchJson("/agents/install/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: getClientId(),
            agent_id: agent.id,
          }),
        });

        workspaceState = {
          ...(workspaceState || {}),
          agent: result.agent || agent,
          messages,
          actionQueue,
          operatorWorkspace,
          setup: inferSetup(result.agent || agent),
        };
        renderWorkspaceFromState();
        if (isInstallSeen(getDefaultInstallStatus(result.agent || agent))) {
          await completeActivationStep("install_widget");
        }
        setStatus(
          result.verification?.status === "found"
            ? "Install snippet verified."
            : result.verification?.status === "mismatch"
              ? "A different Vonza install was detected on the website."
              : result.verification?.status === "not_found"
                ? "Snippet not found on the website yet."
                : "Verification completed."
        );
      } catch (error) {
        setStatus(error.message || "We couldn't verify the installation.");
      } finally {
        button.disabled = false;
      }
    });
  });

  previewLinks.forEach((link) => {
    link.addEventListener("click", () => {
      saveInstallProgress(agent.id, { previewOpened: true });
      trackProductEvent("preview_opened", {
        agentId: agent.id,
        onceKey: `preview_opened:${agent.id}`,
      });
    });
  });

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const resolvedTarget = resolveShellTarget(
        button.dataset.shellTarget,
        button.dataset.targetId || "",
      );
      const targetSection = resolvedTarget.targetSection;

      if (!availableSections.includes(targetSection)) {
        return;
      }

      showSectionAndHighlight(
        targetSection,
        getCopilotTargetSelector(targetSection, button.dataset.targetId || ""),
        {
          settingsSection: button.dataset.settingsTarget || resolvedTarget.settingsSection || "",
          targetId: button.dataset.targetId || "",
        }
      );
    });
  });

  automationFocusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.automationFocus || "";
      const panel = document.querySelector(`[data-automation-panel="${target}"]`);

      if (!panel) {
        return;
      }

      showShellSection("automations");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.classList.add("active");
      window.setTimeout(() => panel.classList.remove("active"), 1600);
    });
  });

  if (shellHashNavigationHandler && typeof window.removeEventListener === "function") {
    window.removeEventListener("hashchange", shellHashNavigationHandler);
  }

  shellHashNavigationHandler = () => {
    const hashSection = getShellSectionFromHash(availableSections);

    if (!hashSection) {
      return;
    }

    const hashFrontDeskSection = hashSection === "customize" ? getActiveFrontDeskSection() : "";
    const hashContactFilter = hashSection === "contacts" ? getContactFilterFromHash() : "";
    const hashContactId = hashSection === "contacts" ? getContactIdFromHash() : "";

    showShellSection(hashSection, {
      settingsSection: settingsShellController?.getActiveSettingsSection?.(),
    });

    if (hashFrontDeskSection) {
      frontDeskController?.showSection?.(hashFrontDeskSection);
    }

    if (hashSection === "contacts") {
      activeContactFilter = hashContactFilter || activeContactFilter || "all";
      applyContactFilter(activeContactFilter);

      if (hashContactId) {
        selectContact(hashContactId);
      }
    }
  };
  if (typeof window.addEventListener === "function") {
    window.addEventListener("hashchange", shellHashNavigationHandler);
  }

  const initialSection = getActiveShellSection(setup, operatorWorkspace);
  showShellSection(initialSection, {
    settingsSection: settingsShellController?.getActiveSettingsSection?.(),
  });
  frontDeskController?.showSection?.(getActiveFrontDeskSection());

  if (contactFilterButtons.length || contactSearchInput) {
    applyContactFilter(activeContactFilter);
  }

  if (contactRows.length) {
    const hashContactId = getContactIdFromHash();
    const rememberedContactId = getDashboardUiStateValue("selectedCustomerKey");
    const hashContactRow = hashContactId
      ? [...contactRows].find((row) => row.dataset.contactId === hashContactId && !row.hidden)
      : null;
    const rememberedContactRow = rememberedContactId
      ? [...contactRows].find((row) => row.dataset.contactId === rememberedContactId && !row.hidden)
      : null;
    selectContact(hashContactRow?.dataset.contactId || rememberedContactRow?.dataset.contactId || [...contactRows].find((row) => !row.hidden)?.dataset.contactId || contactRows[0].dataset.contactId || "");
  }

  if (todayFilterButtons.length) {
    applyTodayFilter(activeTodayFilter);
  }

  if (activeTodayQueueKey) {
    selectTodayQueueItem(activeTodayQueueKey, { openDrawer: false });
  }

  ["inbox", "calendar", "automation"].forEach((kind) => {
    const firstVisibleRow = [...workspaceRecordRows].find((row) => row.dataset.recordKind === kind && !row.hidden);
    if (firstVisibleRow) {
      selectWorkspaceRecord(kind, firstVisibleRow.dataset.recordId || "");
    }
  });

  syncDashboardHelpUi();

  const focusTarget = getDashboardFocus();

  if (focusTarget) {
    const focusMap = {
      preview: ".frontdesk-preview-shell",
      install: '[data-shell-section="install"]',
      setup: '[data-shell-section="settings"]',
      "action-queue": "[data-action-queue-section]",
      contacts: '[data-shell-section="contacts"]',
      inbox: '[data-shell-section="inbox"]',
      calendar: '[data-shell-section="calendar"]',
      automations: '[data-shell-section="automations"]',
    };
    const selector = focusMap[focusTarget];
    const target = selector ? document.querySelector(selector) : null;

    if (target) {
      if (focusTarget === "setup") {
        showShellSection("settings", { settingsSection: "front_desk" });
      } else if (focusTarget === "preview") {
        showShellSection("customize");
      } else if (focusTarget === "install") {
        showShellSection("install");
      }

      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    clearDashboardFocus();
  }
}

// Dashboard bootstrapping
function renderLocalDashboardV2Fixture() {
  authSession = { access_token: "local-dashboard-v2-fixture" };
  authUser = { id: "local-v2-owner", email: "local.owner@example.test" };
  applyDashboardLanguage(getDashboardLanguage());

  const now = new Date().toISOString();
  const agent = {
    id: "local-agent-1",
    name: "Local fixture workspace",
    assistantName: "Local front desk",
    ownerName: "Local Owner",
    ownerEmail: "local.owner@example.test",
    businessName: "Local Services",
    websiteUrl: "https://local.example.test",
    publicAgentKey: "local-public-agent",
    installId: "local-install-1",
    welcomeMessage: "Hi, I can help with services, booking, quotes, and support.",
    buttonLabel: "Ask a question",
    tone: "professional",
    accessStatus: "active",
    knowledge: {
      state: "ready",
      pageCount: 7,
    },
    allowedDomains: ["local.example.test"],
    installStatus: {
      state: "seen_recently",
      label: "Live install detected",
      host: "local.example.test",
      pageUrl: "https://local.example.test/",
      lastSeenAt: now,
      lastSeenUrl: "https://local.example.test/",
      lastVerifiedAt: now,
      verificationStatus: "ok",
      verificationTargetUrl: "https://local.example.test/",
      verificationOrigin: "server",
      verificationDetails: {},
      allowedDomains: ["local.example.test"],
      installId: "local-install-1",
      installedAt: now,
    },
  };
  const messages = [
    {
      id: "fixture-message-1",
      role: "user",
      content: "Can I book a consultation this week?",
      createdAt: now,
      source: "widget",
    },
    {
      id: "fixture-message-2",
      role: "assistant",
      content: "Yes. Share your preferred day and contact details, and the team can confirm the next step.",
      createdAt: now,
      source: "widget",
    },
    {
      id: "fixture-message-3",
      role: "user",
      content: "What affects the quote?",
      createdAt: now,
      source: "page",
    },
  ];
  const actionQueue = {
    ...createEmptyActionQueue(),
    items: [
      {
        id: "fixture-action-1",
        key: "fixture-action-1",
        type: "pricing",
        status: "new",
        safeSummary: "Customer asked what affects quote timing and price.",
        recommendedNextAction: "Review pricing guidance and confirm the follow-up path.",
      },
    ],
    summary: {
      ...createEmptyActionQueue().summary,
      total: 1,
      new: 1,
      attentionNeeded: 1,
    },
    conversionSummary: {
      ...createEmptyActionQueue().conversionSummary,
      highIntentConversations: 2,
      contactsCaptured: 1,
      captureRate: 50,
      assistedConversions: 1,
      bookingDirectHandoffs: 1,
    },
    outcomeSummary: {
      ...createEmptyActionQueue().outcomeSummary,
      total: 1,
      assistedConversions: 1,
      bookingStarted: 1,
    },
    analyticsSummary: {
      ...createEmptyAnalyticsSummary(),
      conversationCount: 2,
      uniqueVisitorCount: 2,
      totalMessages: 3,
      visitorQuestions: 2,
      highIntentSignals: 2,
      contactsCaptured: 1,
      assistedOutcomes: 1,
      weakAnswerCount: 1,
      attentionNeeded: 1,
      customerQuestionSummaries: [
        { summary: "Booking availability", count: 1 },
        { summary: "Quote details", count: 1 },
      ],
      weakAnswerExamples: ["Quote guidance needs clearer inputs and timing."],
      usageTrend: {
        copy: "Fixture activity uses the same shape as live dashboard data.",
      },
      recentActivity: {
        lastActivityAt: now,
      },
    },
    ownerAnalyticsDashboard: {
      ok: true,
      metrics: {
        totalConversations: 2,
        leadsCaptured: 1,
        conversionRate: 50,
      },
      assistantSource: {
        widget: {
          key: "widget",
          label: "Website widget",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 1,
        },
        page: {
          key: "page",
          label: "Front Desk page",
          conversationCount: 1,
          messageCount: 1,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        web_call: {
          key: "web_call",
          label: "Web Call",
          conversationCount: 1,
          messageCount: 2,
          visitorQuestionCount: 1,
          leadsCaptured: 0,
        },
        unknown: {
          key: "unknown",
          label: "Legacy/unknown",
          conversationCount: 0,
          messageCount: 0,
          visitorQuestionCount: 0,
          leadsCaptured: 0,
        },
        totalConversations: 2,
        totalMessages: 3,
      },
      topVisitorQuestions: [
        { summary: "Booking availability", count: 1 },
        { summary: "Quote details", count: 1 },
      ],
      missedQuestions: [
        { question: "Quote guidance needs clearer inputs and timing." },
      ],
      customerSatisfaction: {
        totalFeedback: 1,
        helpful: 1,
        notHelpful: 0,
        negativeRate: 0,
        unhappyAnswers: [],
        weakTopics: [],
        recoveryActions: [],
        persistenceAvailable: true,
      },
      knowledgeImprovement: {
        title: "Knowledge Improvement",
        copy: "One pricing answer could use stronger guidance.",
        total: 1,
        openCount: 1,
        approvedFixedCount: 0,
        dismissedCount: 0,
        guardrail: "Approved guidance must stay grounded in verified business facts.",
        items: [
          {
            question: "What affects the quote?",
            safeSummary: "Customer asked about quote factors.",
            reason: "Pricing detail was thin.",
            status: "new",
          },
        ],
      },
      notifications: [],
      aiUsage: null,
      webCallHealth: {
        available: true,
        starts: 1,
        endedCalls: 1,
        averageDurationSeconds: 74,
        averageTurns: 2,
        contactFallbackSubmissions: 0,
        failureCategories: [
          { category: "speech_failed", label: "Speech failed", count: 1 },
        ],
        latestActivityAt: now,
      },
      webCallRecentCalls: {
        available: true,
        total: 1,
        calls: [
          {
            id: "fixture-web-call-1",
            actionKey: "web_call_review:fixture-web-call-1",
            webCallId: "fixture-web-call-1",
            sessionKey: "fixture-web-call-session",
            latestMessageId: "fixture-web-call-message-2",
            latestAssistantMessageId: "fixture-web-call-message-2",
            startedAt: now,
            latestActivityAt: now,
            durationSeconds: 74,
            turnCount: 2,
            contactFallbackOpened: true,
            contactFallbackSubmitted: false,
            hadFailures: true,
            failureCategories: ["speech_failed"],
            failureCategoryLabels: ["Speech failed"],
            messages: [
              { id: "fixture-web-call-message-1", role: "user", content: "Can you walk me through quote timing?", createdAt: now },
              { id: "fixture-web-call-message-2", role: "assistant", content: "I can explain the usual inputs and collect details for the team.", createdAt: now },
            ],
            latestQuestion: "Can you walk me through quote timing?",
            latestAnswer: "I can explain the usual inputs and collect details for the team.",
            review: {
              status: "new",
              followUpNeeded: false,
              followUpCompleted: false,
            },
            conversationSource: "web_call",
            action: {
              type: "conversation",
              label: "Open related conversation",
              messageId: "fixture-web-call-message-2",
            },
          },
        ],
      },
    },
  };
  const operatorWorkspace = {
    ...createEmptyOperatorWorkspace(),
    enabled: true,
    featureEnabled: true,
    today: {
      ...createEmptyOperatorWorkspace().today,
      messagesToday: 3,
      contactsDealtToday: 1,
      needsAttentionCount: 1,
      assistedOutcomes: 1,
      leadsWithoutNextStep: 1,
    },
    contacts: {
      ...createEmptyOperatorWorkspace().contacts,
      list: [
        {
          id: "fixture-contact-1",
          customerRowKey: "fixture-contact-1",
          name: "Local Customer",
          email: "customer@example.test",
          phone: "+1 555 0100",
          lifecycleState: "needs_review",
          source: "widget",
          latestMessageId: "fixture-message-1",
          latestSummary: "Asked to book a consultation this week.",
          lastMessageAt: now,
          nextAction: {
            label: "Confirm booking path",
          },
          counts: {
            leads: 1,
            inboxThreads: 0,
            calendarEvents: 0,
            followUps: 1,
            outcomes: 1,
          },
          chatMessages: [
            { role: "customer", label: "Customer", content: "Can I book a consultation this week?", createdAt: now },
            { role: "vonza", label: "Vonza", content: "Yes. Share your preferred day and contact details.", createdAt: now },
          ],
          timeline: [
            { at: now, label: "Website widget", summary: "Booking question captured by the front desk." },
          ],
        },
        {
          id: "fixture-contact-2",
          customerRowKey: "fixture-contact-2",
          name: "Quote Request",
          email: "quote@example.test",
          lifecycleState: "needs_reply",
          source: "page",
          latestMessageId: "fixture-message-3",
          latestSummary: "Asked what affects the quote.",
          lastMessageAt: now,
          nextAction: {
            title: "Reply to pricing question",
            description: "Answer the quote question and confirm the best next step.",
          },
          chatMessages: [
            { role: "customer", label: "Customer", content: "What affects the quote?", createdAt: now },
          ],
          timeline: [
            { at: now, label: "Front Desk page", summary: "Pricing question needs a clearer follow-up path." },
          ],
        },
        {
          id: "fixture-contact-3",
          customerRowKey: "fixture-contact-3",
          name: "Anonymous visitor",
          partialIdentity: true,
          lifecycleState: "needs_review",
          sources: ["chat"],
          flags: ["follow up due"],
          latestMessageId: "fixture-message-3",
          latestSummary: "Asked for quote details but did not leave contact details.",
          lastMessageAt: now,
          nextAction: {
            title: "Review open question",
            description: "Review the conversation before deciding whether more contact details are needed.",
          },
          counts: {
            leads: 0,
            inboxThreads: 0,
            calendarEvents: 0,
            followUps: 0,
            outcomes: 0,
          },
          chatMessages: [
            { role: "customer", label: "Customer", content: "Can you send a quote?", createdAt: now },
          ],
          timeline: [
            { at: now, label: "Visitor message", source: "chat", summary: "Asked for quote details without leaving email or phone." },
          ],
        },
      ],
      summary: {
        ...createEmptyOperatorWorkspace().contacts.summary,
        totalContacts: 3,
        contactsNeedingAttention: 2,
        leadsWithoutNextStep: 1,
        contactsWithOutcomes: 1,
        lifecycleCounts: {
          ...createEmptyOperatorWorkspace().contacts.summary.lifecycleCounts,
          activeLead: 1,
          customer: 1,
        },
      },
    },
    businessProfile: {
      ...createEmptyOperatorWorkspace().businessProfile,
      readiness: {
        totalSections: 4,
        completedSections: 4,
        missingCount: 0,
        missingSections: [],
        summary: "Core local fixture business context is complete.",
      },
    },
  };

  setStatus("Local-only dashboard V2 fixture. Production auth and access gates are not bypassed.");
  renderReadyState(agent, messages, actionQueue, operatorWorkspace);
}

async function boot(options = {}) {
  applyDashboardLanguage();
  trackProductEvent("dashboard_arrived", {
    onceKey: "dashboard_arrived",
    metadata: {
      path: window.location.pathname,
    },
  });

  if (DASHBOARD_LOCAL_FIXTURE_ENABLED) {
    renderLocalDashboardV2Fixture();
    return;
  }

  if (!hasAuthConfig()) {
    setStatus(authCopy("Supabase Auth is not configured yet.", "A Supabase Auth még nincs beállítva."));
    renderAuthEntry();
    return;
  }

  const callbackIssue = getAuthCallbackIssue();
  if (callbackIssue) {
    authCallbackIssue = callbackIssue;
    authViewMode = AUTH_VIEW_MODES.MAGIC;
    authSession = null;
    authUser = null;
    clearAuthFlowStateFromUrl();
    createAuthClientIfNeeded();
    setAuthFeedback("error", callbackIssue.feedback);
    renderAuthEntry();
    setStatus(callbackIssue.status);
    return;
  }

  const launchState = getLaunchState();
  if (launchState?.status === "running") {
    renderLaunchSequence({
      ...launchState,
      recovering: true,
      headline: "We’re checking your assistant setup.",
      detail: "If your website import was still in progress, we’ll reconnect you to the right next step.",
      note: "You do not need to start over unless the assistant was never created.",
    });
  }

  const showBootLoading = shouldRenderBootLoading(options);

  try {
    dashboardRuntimeState.isBootLoading = showBootLoading;
    if (showBootLoading) {
      renderLoadingState();
      setStatus(authCopy("Preparing your workspace...", "Előkészítjük a munkaterületedet..."));
    } else {
      setDashboardBackgroundRefreshing(true, options.activeAction || "workspace-refresh");
    }
    await ensureAuthClient();
    renderTopbarMeta();

    if (!authSession || !authUser) {
      clearLaunchState();
      renderAuthEntry();
      return;
    }

    if (getAuthFlowType() === "recovery") {
      authViewMode = AUTH_VIEW_MODES.UPDATE_PASSWORD;
      renderAuthEntry();
      return;
    }

    setAuthFeedback(null, "");

    const paymentState = getPaymentState();
    const googleConnectionState = getGoogleConnectionState();

    if (paymentState.payment === "cancel") {
      setStatus("Checkout was canceled. You can unlock Vonza whenever you're ready.");
      clearPaymentStateFromUrl();
    } else if (paymentState.payment === "success") {
      try {
        await confirmPaymentReturn();
      } catch (error) {
        clearPaymentStateFromUrl();
        setStatus(error.message || "Payment completed, but we could not activate access yet.");
      }
    }

    if (googleConnectionState.status === "connected") {
      setStatus("Google inbox connected successfully in read-only mode.");
      clearGoogleConnectionStateFromUrl();
    } else if (googleConnectionState.status === "error") {
      setStatus(googleConnectionState.reason || "Email connection did not complete.");
      clearGoogleConnectionStateFromUrl();
    }

    let data = null;

    if (paymentState.payment === "success" && paymentState.sessionId) {
      data = await waitForActiveAccessAfterPayment();

      if (data?.timedOut) {
        setStatus("Payment confirmed. Access is still being activated. Please refresh in a moment if the workspace does not open yet.");
        data = null;
      }
    }

    const { agents, bridgeAgent } = data || await loadAgents();

    if (!agents.length) {
      if (bridgeAgent && !isClaimDismissed()) {
        clearLaunchState();
        renderClaimAssistant(bridgeAgent);
        return;
      }

      if (launchState?.status === "running") {
        clearLaunchState();
        setStatus("Setup was interrupted before your assistant was created. You can start again whenever you're ready.");
      }
      setStatus("Sign in complete. Unlock Vonza to open your public launch workspace.");
      renderAccessLocked(null);
      return;
    }

    const agent = agents[0];
    const accessStatus = normalizeAccessStatus(agent.accessStatus);

    if (accessStatus !== "active") {
      clearLaunchState();
      setStatus(accessStatus === "suspended"
        ? "Workspace access is currently paused."
        : "Finish payment to open your Vonza public launch workspace."
      );
      renderAccessLocked(agent);
      return;
    }

    try {
      const preferences = await loadDashboardPreferences();

      if (preferences.persistenceAvailable === false) {
        if (!hasCachedDashboardLanguage()) {
          applyDashboardLanguage("en");
        }
        setStatus(t("language.settingsError"));
      } else if (preferences.dashboardLanguage) {
        cacheDashboardLanguage(preferences.dashboardLanguage);
      } else if (preferences.persistenceAvailable === true && !hasCachedDashboardLanguage()) {
        renderDashboardLanguageChooser();
        return;
      } else {
        applyDashboardLanguage(getDashboardLanguage());
      }
    } catch {
      if (!hasCachedDashboardLanguage()) {
        applyDashboardLanguage("en");
      }
      setStatus(t("language.settingsError"));
    }

    const [messagesResult, trainingResult, actionQueueResult, ownerAnalyticsResult, operatorResult, activationWizardResult] = await Promise.allSettled([
      loadAgentMessages(agent.id),
      loadFrontDeskTraining(agent.id),
      loadActionQueue(agent.id),
      loadOwnerAnalyticsDashboard(agent.id),
      loadOperatorWorkspaceSafe(agent.id),
      loadActivationWizard(agent.id),
    ]);
    const {
      messages,
      frontDeskTraining,
      actionQueue,
      operatorWorkspace,
      hasPartialFailure,
      partialErrors,
    } = coalesceWorkspaceLoadState({
      messagesResult,
      trainingResult,
      actionQueueResult,
      ownerAnalyticsResult,
      operatorResult,
    });
    const setup = inferSetup(agent);
    activationWizardState = activationWizardResult.status === "fulfilled" ? activationWizardResult.value : null;

    clearLaunchState();

    if (hasPartialFailure || activationWizardResult.status === "rejected") {
      const partialWarning = partialErrors[0];
      setStatus(partialWarning
        ? `Vonza loaded with partial data. ${partialWarning}`
        : "Vonza loaded with partial data. One workspace request failed, but the dashboard stayed available.");
    }

    if (setup.isReady) {
      renderReadyState(agent, messages, actionQueue, operatorWorkspace, frontDeskTraining);
      return;
    }

    renderSetupState(agent, messages, setup, actionQueue, operatorWorkspace, frontDeskTraining);
  } catch (error) {
    clearLaunchState();
    setStatus(error.message || "We couldn't load your Vonza workspace right now.");
    if (!showBootLoading && dashboardRuntimeState.hasBooted === true && workspaceState?.agent) {
      return;
    }
    renderErrorState(
      "We couldn't load your Vonza workspace.",
      error.message || "Please refresh and try again. If the issue continues, your account and payment state are still safe."
    );
  } finally {
    dashboardRuntimeState.isBootLoading = false;
    if (!showBootLoading) {
      setDashboardBackgroundRefreshing(false);
    }
  }
}

boot();
