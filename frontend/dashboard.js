// Root DOM references and persisted dashboard state
const rootEl = document.getElementById("dashboard-root");
const statusBanner = document.getElementById("status-banner");
const topbarMeta = document.getElementById("topbar-meta");

const CLIENT_ID_STORAGE_KEY = "vonza_client_id";
const INSTALL_STORAGE_PREFIX = "vonza_install_progress_";
const LAUNCH_STORAGE_KEY = "vonza_launch_state";
const DASHBOARD_FOCUS_KEY = "vonza_dashboard_focus";
const HANDOFF_STORAGE_KEY = "vonza_dashboard_handoff_seen";
const DASHBOARD_SOURCE_KEY = "vonza_dashboard_source";
const DASHBOARD_SECTION_KEY = "vonza_dashboard_section";
const DASHBOARD_FRONTDESK_SECTION_KEY = "vonza_dashboard_frontdesk_section";
const DASHBOARD_TODAY_QUEUE_SELECTION_KEY = "vonza_dashboard_today_queue_selection";
const CLAIM_DISMISS_PREFIX = "vonza_claim_dismissed_";
const LIMITED_CONTENT_MARKER = "Limited content available. This assistant may give general answers.";
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
const FULL_SHELL_SECTIONS = ["overview", "contacts", "customize", "analytics", "inbox", "calendar", "automations", "install", "settings"];
const LEGACY_SHELL_SECTIONS = ["overview", "customize", "analytics", "install", "settings"];
const FRONT_DESK_SECTIONS = ["overview", "preview", "context", "launch"];
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
    overview: "Overview",
    preview: "Preview",
    context: "Knowledge",
    launch: "Launch",
  },
};
const OPERATOR_WORKSPACE_BROWSER_FLAG = "VONZA_OPERATOR_WORKSPACE_V1_ENABLED";
const LEGACY_OPERATOR_WORKSPACE_BROWSER_FLAG = "VONZA_OPERATOR_WORKSPACE_V1";
const TODAY_COPILOT_BROWSER_FLAG = "VONZA_TODAY_COPILOT_V1_ENABLED";
const ACTION_QUEUE_STATUSES = ["new", "reviewed", "done", "dismissed"];
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
const DEFAULT_LAUNCH_PROFILE = {
  mode: "public_cohort_v1",
  product: {
    name: "Vonza Front Desk",
    purchaseSummary:
      "The first public offer is the AI front desk plus Home, Customers, Analytics, website import, and install. Google-connected Email, Calendar, and Automations stay optional beta surfaces when enabled.",
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
    google_connect: { state: FEATURE_STATE_BETA, label: "Google connect" },
    inbox: { state: FEATURE_STATE_BETA, label: "Email" },
    calendar: { state: FEATURE_STATE_BETA, label: "Calendar" },
    automations: { state: FEATURE_STATE_BETA, label: "Automations" },
    advanced_guidance: { state: FEATURE_STATE_HIDDEN, label: "Advanced guidance" },
    manual_outcome_marks: { state: FEATURE_STATE_HIDDEN, label: "Manual outcome marks" },
    knowledge_fix_workflows: { state: FEATURE_STATE_HIDDEN, label: "Knowledge-fix workflows" },
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
let authStateListenerBound = false;
let workspaceState = null;
let dashboardHelpState = null;
let workspaceRefreshBound = false;
let workspaceRefreshAgentId = "";
let workspaceRefreshTimeout = null;

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

function isInstallRecent(status) {
  return status?.state === "seen_recently";
}

function isInstallDetected(status) {
  return ["installed_unseen", "seen_recently", "seen_stale"].includes(status?.state);
}

function getInstallSummaryLabel(status) {
  if (!status) {
    return "Not live";
  }

  if (status.state === "seen_recently") {
    return status.host || "Seen recently";
  }

  if (status.state === "seen_stale") {
    return status.host ? `${status.host} (stale)` : "Seen stale";
  }

  if (status.state === "installed_unseen") {
    return "Installed, awaiting ping";
  }

  if (status.state === "domain_mismatch") {
    return "Mismatch";
  }

  if (status.state === "verify_failed") {
    return "Verify failed";
  }

  return "Not live";
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

function isCapabilityBeta(capabilityKey) {
  return getCapabilityState(capabilityKey) === FEATURE_STATE_BETA;
}

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

  if (["contacts", "inbox", "calendar", "automations", "google_connect"].includes(capabilityKey)) {
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

  return text
    .replace(/\bOpen Outcomes\b/g, "Open Analytics")
    .replace(/\bToday, Contacts, and Outcomes\b/g, "Today, Contacts, and Analytics")
    .replace(/\bToday, Customize, and Outcomes\b/g, "Today, Customize, and Analytics")
    .replace(/\bContacts and Outcomes\b/g, "Contacts and Analytics")
    .replace(/\bapproval-first\b/gi, "review-before-send")
    .replace(/\bread-only\b/gi, "view-only");
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
        copy: "Home, Customers, Front Desk, Analytics, and Install are available here. Optional Google tools are simply out of the way on this deployment.",
      };
  }

  if (!isGoogleWorkspaceConfigured(operatorWorkspace)) {
    return {
      key: "operator_without_google_beta",
      eyebrow: "Workspace",
      title: "Your main workspace is live.",
      copy: "Home, Customers, Front Desk, and Analytics are ready to use. Email, Calendar, and Automations appear when optional Google tools are available.",
    };
  }

  if (operatorWorkspace?.status?.googleConnected === true) {
    if (googleCapabilities.calendarRead && !googleCapabilities.gmailRead && !googleCapabilities.calendarWrite) {
      return {
        key: "operator_calendar_connected",
        eyebrow: "Workspace",
        title: "Your workspace now includes calendar visibility.",
        copy: "Home can see your Google Calendar and bring schedule context into the workspace. Email tools and calendar changes stay off for now.",
      };
    }

    return {
      key: "operator_google_connected",
      eyebrow: "Workspace",
      title: "Your workspace is fully connected.",
      copy: "Home, Customers, Front Desk, and Analytics stay at the center, with Email, Calendar, and Automations available alongside them.",
    };
  }

  return {
    key: "operator_beta_available",
    eyebrow: "Workspace",
    title: "Your main workspace is ready, with optional Google tools available.",
    copy: "Home, Customers, Front Desk, and Analytics are ready now. Connect Google when you want Email, Calendar, and Automations in the same workspace.",
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

async function ensureAuthClient() {
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

  const { data } = await authClient.auth.getSession();
  authSession = data.session || null;
  authUser = authSession?.user || null;
  renderTopbarMeta();

  return authClient;
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

function clearAuthFlowStateFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;

  if (url.searchParams.has("type")) {
    url.searchParams.delete("type");
    changed = true;
  }

  if (url.hash) {
    const hashParams = new URLSearchParams(String(url.hash || "").replace(/^#/, ""));

    if (hashParams.has("type") || hashParams.has("access_token") || hashParams.has("refresh_token")) {
      url.hash = "";
      changed = true;
    }
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

  if (arrival.from) {
    redirectUrl.searchParams.set("from", arrival.from);
  }

  return redirectUrl.toString();
}

function getAuthModeConfig(mode, arrival) {
  const configs = {
    [AUTH_VIEW_MODES.SIGN_UP]: {
      eyebrow: arrival.arrivedFromSite ? "Step 1 of 3" : "Create your Vonza account",
      headline: "Create your Vonza account",
      copy: "Use email and password to open your Vonza account, then continue straight into the app flow where checkout and workspace setup already live.",
      submitLabel: "Create account",
      note: "You can sign back in with the same email and password whenever you return.",
    },
    [AUTH_VIEW_MODES.SIGN_IN]: {
      eyebrow: arrival.arrivedFromSite ? "Step 1 of 3" : "Sign in to Vonza",
      headline: "Sign in to continue into Vonza",
      copy: "Use your email and password to return to Vonza. After sign-in, unpaid accounts go to checkout and paid accounts go straight into the workspace.",
      submitLabel: "Sign in",
      note: "Use the same email and password you created for this workspace.",
    },
    [AUTH_VIEW_MODES.RESET]: {
      eyebrow: "Reset your password",
      headline: "Send a password reset email",
      copy: "Enter your account email and we’ll send a reset link that brings you back into Vonza so you can choose a new password cleanly.",
      submitLabel: "Send reset link",
      note: "The reset link opens a secure password update flow inside Vonza.",
    },
    [AUTH_VIEW_MODES.MAGIC]: {
      eyebrow: "Email link fallback",
      headline: "Use a magic link instead",
      copy: "If you do not want to use your password right now, Vonza can still send a one-time email link as a secondary sign-in option.",
      submitLabel: "Send magic link",
      note: "This keeps the old auth path available without making it the main flow.",
    },
    [AUTH_VIEW_MODES.UPDATE_PASSWORD]: {
      eyebrow: "Secure password update",
      headline: "Choose your new password",
      copy: "Set a new password for your Vonza account, then we’ll bring you back into the app immediately.",
      submitLabel: "Update password",
      note: "Use a strong password you can return with later.",
    },
  };

  return configs[mode] || configs[AUTH_VIEW_MODES.SIGN_IN];
}

function renderAuthFields(mode) {
  if (mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) {
    return `
      <div class="field">
        <label for="auth-password">New password</label>
        <input id="auth-password" name="password" type="password" placeholder="Create a strong password" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="auth-password-confirm">Confirm new password</label>
        <input id="auth-password-confirm" name="confirm_password" type="password" placeholder="Repeat your new password" autocomplete="new-password">
      </div>
    `;
  }

  const needsPassword = mode === AUTH_VIEW_MODES.SIGN_IN || mode === AUTH_VIEW_MODES.SIGN_UP;
  const needsConfirmation = mode === AUTH_VIEW_MODES.SIGN_UP;

  return `
    <div class="field">
      <label for="auth-email">Email address</label>
      <input id="auth-email" name="email" type="email" placeholder="you@yourbusiness.com" autocomplete="email">
    </div>
    ${needsPassword ? `
      <div class="field">
        <label for="auth-password">Password</label>
        <input id="auth-password" name="password" type="password" placeholder="${mode === AUTH_VIEW_MODES.SIGN_UP ? "Create a password" : "Enter your password"}" autocomplete="${mode === AUTH_VIEW_MODES.SIGN_UP ? "new-password" : "current-password"}">
      </div>
    ` : ""}
    ${needsConfirmation ? `
      <div class="field">
        <label for="auth-password-confirm">Confirm password</label>
        <input id="auth-password-confirm" name="confirm_password" type="password" placeholder="Repeat your password" autocomplete="new-password">
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
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">Already have an account? Sign in</button>
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.MAGIC}">Use email link instead</button>
      </div>
    `;
  }

  if (mode === AUTH_VIEW_MODES.SIGN_IN) {
    return `
      <div class="auth-links-row">
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.RESET}">Forgot password?</button>
        <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.MAGIC}">Use email link instead</button>
      </div>
    `;
  }

  return `
    <div class="auth-links-row">
      <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">Back to password sign in</button>
      <button class="auth-text-button" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_UP}">Create account instead</button>
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

  if (!clientId || !eventName) {
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

function getActiveShellSection(setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const storedSection = trimText(window.localStorage.getItem(DASHBOARD_SECTION_KEY)).toLowerCase();
  const availableSections = getAvailableShellSections(operatorWorkspace);

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
}

function getActiveFrontDeskSection() {
  const storedSection = trimText(window.localStorage.getItem(DASHBOARD_FRONTDESK_SECTION_KEY)).toLowerCase();

  if (FRONT_DESK_SECTIONS.includes(storedSection)) {
    return storedSection;
  }

  return "overview";
}

function setActiveFrontDeskSection(section) {
  if (!FRONT_DESK_SECTIONS.includes(section)) {
    return;
  }

  window.localStorage.setItem(DASHBOARD_FRONTDESK_SECTION_KEY, section);
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
  return DASHBOARD_HELP_SECTION_LABELS[trimText(section).toLowerCase()] || "Today";
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
    guidance.push(`${needsAttentionCount} needs-attention item${needsAttentionCount === 1 ? "" : "s"} are visible in Today, so I can help you decide what to tackle first.`);
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

function getTodayQueueItemKey(item = {}) {
  const queueType = trimText(item.queueType) || (isAppointmentReviewQueueItem(item) ? "appointment_review" : "action_queue");
  const queueId = trimText(item.queueId || item.id || item.key);

  return queueType && queueId ? `${queueType}:${queueId}` : "";
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
  statusBanner.textContent = message || "";
}

function buildScript(agent) {
  const installId = trimText(agent.installId);

  if (!installId) {
    return "";
  }

  return `<script async defer src="${getPublicAppUrl()}/embed.js" data-install-id="${installId}"><\/script>`;
}

function buildWidgetUrl(agentKey) {
  return `${getPublicAppUrl()}/widget?agent_key=${encodeURIComponent(agentKey)}`;
}

function buildPreviewMarkup(installId) {
  const publicAppUrl = getPublicAppUrl();
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,sans-serif;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#0f172a;">
<main style="padding:32px;">
  <h2 style="margin:0 0 8px;">Preview site</h2>
  <p style="margin:0;max-width:520px;color:#475569;line-height:1.6;">This simulates how your website front desk will answer, route, and capture visitor intent when it is installed on a real website.</p>
</main>
<script async defer src="${publicAppUrl}/embed.js" data-install-id="${escapeHtml(installId)}"><\/script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimText(value) {
  return String(value || "").trim();
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
  const approvedContactChannels = ["website_chat", "email", "phone", "sms"]
    .filter((channel) => formData.getAll("approved_contact_channels").includes(channel));

  return {
    businessSummary: trimText(formData.get("business_summary")),
    services: parseStructuredBusinessProfileLines(formData.get("services"), ["name", "note"]),
    pricing: parseStructuredBusinessProfileLines(formData.get("pricing"), ["label", "amount", "details"]),
    policies: parseStructuredBusinessProfileLines(formData.get("policies"), ["label", "details"]),
    serviceAreas: parseStructuredBusinessProfileLines(formData.get("service_areas"), ["name", "note"]),
    operatingHours: parseStructuredBusinessProfileLines(formData.get("operating_hours"), ["label", "hours"]),
    approvedContactChannels,
    approvalPreferences: {
      followUpDrafts: trimText(formData.get("approval_follow_up_drafts")) || "owner_required",
      contactNextSteps: trimText(formData.get("approval_contact_next_steps")) || "owner_required",
      taskRecommendations: trimText(formData.get("approval_task_recommendations")) || "owner_required",
      outcomeRecommendations: trimText(formData.get("approval_outcome_recommendations")) || "owner_required",
      profileChanges: trimText(formData.get("approval_profile_changes")) || "owner_required",
    },
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
      copy: `Start with secure checkout. Right after payment, Vonza opens the stable launch core: your AI front desk, Today, Contacts, Analytics, website import, and install. ${launchProfile.product.purchaseSummary}`,
    };
  }

  const accessStatus = normalizeAccessStatus(agent?.accessStatus);

  if (accessStatus === "active") {
    return {
      eyebrow: "Workspace active",
      headline: "Your Vonza workspace is open.",
      copy: "Your public launch workspace is active. The stable core is the AI front desk, Today, Contacts, Front Desk, and Analytics. Google-connected Email, Calendar, and Automations stay optional beta surfaces.",
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
    copy: "Your setup is tied to your account, but workspace access still needs to be activated before you can use the stable launch core in Today, Contacts, Front Desk, and Analytics.",
  };
}

function renderAccessLocked(agent) {
  renderTopbarMeta();
  const access = getAccessCopy(agent);
  const accessStatus = normalizeAccessStatus(agent?.accessStatus);
  const unlockLabel = accessStatus === "suspended" ? "Restore access" : "Unlock Vonza";
  const showDevTools = isDevFakeBillingEnabled();
  const hasAssistant = Boolean(agent?.id);
  const arrival = getArrivalContext();
  const handoffMarkup = !hasAssistant && arrival.showHandoff
    ? `
      <section class="handoff-card">
        <span class="handoff-step">${arrival.arrivedFromSite ? "Step 2 of 3" : "Welcome to your workspace"}</span>
        <h2 class="handoff-title">Unlock Vonza, then finish the front desk setup in one place.</h2>
        <p class="handoff-copy">You do not need to finish everything before payment. Once checkout is complete, you land in the stable launch workspace with Today, Front Desk, Contacts, and Outcomes guiding the next step.</p>
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
          <p class="overview-card-copy">Tune the front desk, review Today, Contacts, and Outcomes, and connect Google later if you want the optional beta.</p>
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
          <p class="overview-label">Vonza access</p>
          <h2 class="pricing-title">One front-desk workspace</h2>
          <p class="pricing-copy">Unlock the stable launch core in one place: AI front desk, Today, Contacts, Front Desk, outcomes, website import, and install.</p>
          <div class="pricing-bullets">
            <div class="pill">AI front desk and routing</div>
            <div class="pill">Today, Contacts, and Outcomes</div>
            <div class="pill">Website import and install</div>
            <div class="pill">Optional Google beta</div>
          </div>
        </div>
        <div class="pricing-actions">
          <button id="unlock-vonza-button" class="primary-button" type="button">${unlockLabel}</button>
          ${showDevTools ? '<button id="simulate-unlock-button" class="ghost-button" type="button">Simulate unlock (dev only)</button>' : ""}
          ${showDevTools ? '<button id="setup-doctor-button" class="ghost-button" type="button">Check local setup</button>' : ""}
          <button id="locked-signout-button" class="ghost-button" type="button">Sign out</button>
        </div>
      </div>
      ${detailsMarkup}
      <p class="auth-note">Once payment completes successfully, Vonza unlocks your account and brings you straight into the public launch workspace.</p>
      ${showDevTools ? '<div id="setup-doctor-results" class="auth-note" style="margin-top:16px;"></div>' : ""}
    </section>
  `;

  if (!hasAssistant && arrival.showHandoff) {
    markHandoffSeen();
  }

  document.getElementById("unlock-vonza-button")?.addEventListener("click", async () => {
    try {
      setStatus("Opening secure checkout...");
      const result = await fetchJson("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authUser?.email || null,
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
      await fetchJson("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "simulate",
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

      if (!resultsEl) {
        return;
      }

      if (!missing.length) {
        resultsEl.textContent = "Local setup looks ready. All required env values are present.";
        return;
      }

      resultsEl.textContent = `Missing locally: ${missing.join(", ")}`;
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
  rootEl.innerHTML = `
    <section class="auth-card">
      <span class="eyebrow">Loading workspace</span>
      <h1 class="headline">Loading your Vonza workspace</h1>
      <p class="auth-copy">We’re restoring your operator shell, approvals, and setup context.</p>
    </section>
  `;
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
        <div class="auth-mode-tabs" role="tablist" aria-label="Account access modes">
          <button class="auth-mode-tab ${mode === AUTH_VIEW_MODES.SIGN_UP ? "active" : ""}" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_UP}">Create account</button>
          <button class="auth-mode-tab ${mode === AUTH_VIEW_MODES.SIGN_IN ? "active" : ""}" type="button" data-auth-mode="${AUTH_VIEW_MODES.SIGN_IN}">Sign in</button>
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
    </section>
  `;

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      authViewMode = button.dataset.authMode || AUTH_VIEW_MODES.SIGN_IN;
      if (authViewMode !== AUTH_VIEW_MODES.UPDATE_PASSWORD) {
        clearAuthFlowStateFromUrl();
      }
      setAuthFeedback(null, "");
      renderAuthEntry();
    });
  });

  document.getElementById("auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authClient) {
      setStatus("Supabase Auth is not configured yet.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = trimText(formData.get("email"));
    const password = trimText(formData.get("password"));
    const confirmPassword = trimText(formData.get("confirm_password"));
    const submitButton = document.getElementById("auth-submit");

    if (mode !== AUTH_VIEW_MODES.UPDATE_PASSWORD && !email) {
      setStatus("Enter your email first.");
      return;
    }

    if ((mode === AUTH_VIEW_MODES.SIGN_IN || mode === AUTH_VIEW_MODES.SIGN_UP || mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) && password.length < 8) {
      setAuthFeedback("error", "Use a password with at least 8 characters.");
      renderAuthEntry();
      setStatus("Use a password with at least 8 characters.");
      return;
    }

    if ((mode === AUTH_VIEW_MODES.SIGN_UP || mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) && password !== confirmPassword) {
      setAuthFeedback("error", "Your password confirmation does not match.");
      renderAuthEntry();
      setStatus("Your password confirmation does not match.");
      return;
    }

    submitButton.disabled = true;
    setAuthFeedback(null, "");

    try {
      if (mode === AUTH_VIEW_MODES.SIGN_UP) {
        setStatus("Creating your account...");
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
          setStatus("Account created. Opening your Vonza app...");
          await boot();
          return;
        }

        authViewMode = AUTH_VIEW_MODES.SIGN_IN;
        setAuthFeedback("success", "Account created. Check your email to confirm your address, then sign in with your password.");
        renderAuthEntry();
        setStatus("Check your email to confirm your account.");
        return;
      }

      if (mode === AUTH_VIEW_MODES.SIGN_IN) {
        setStatus("Signing you in...");
        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        authSession = data.session || null;
        authUser = data.user || data.session?.user || null;
        setStatus("Signed in. Opening your Vonza app...");
        await boot();
        return;
      }

      if (mode === AUTH_VIEW_MODES.RESET) {
        setStatus("Sending your reset link...");
        const { error } = await authClient.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
        });

        if (error) {
          throw error;
        }

        setAuthFeedback("success", "Password reset email sent. Use the link in your inbox to choose a new password.");
        renderAuthEntry();
        setStatus("Password reset email sent.");
        return;
      }

      if (mode === AUTH_VIEW_MODES.MAGIC) {
        setStatus("Sending your magic link...");
        const { error } = await authClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });

        if (error) {
          throw error;
        }

        setAuthFeedback("success", "Magic link sent. Open the email from this device to continue into Vonza.");
        renderAuthEntry();
        setStatus("Magic link sent.");
        return;
      }

      if (mode === AUTH_VIEW_MODES.UPDATE_PASSWORD) {
        setStatus("Updating your password...");
        const { error } = await authClient.auth.updateUser({
          password,
        });

        if (error) {
          throw error;
        }

        clearAuthFlowStateFromUrl();
        setAuthFeedback(null, "");
        setStatus("Password updated. Opening your Vonza app...");
        await boot();
      }
    } catch (error) {
      setAuthFeedback("error", error.message || "We could not complete authentication just yet.");
      renderAuthEntry();
      setStatus(error.message || "We could not complete authentication just yet.");
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
        <p class="handoff-copy">${arrival.arrivedFromSite ? "You’ve moved from the Vonza site into the app. Next you’ll connect your website, shape routing and voice, try the live front desk, install it, and confirm the first lead path in Today, Contacts, and Outcomes." : "Connect your website, shape the front desk around your brand, and make the preview strong before you install it and start working from Today."}</p>
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
      <p class="subtext">Vonza learns from your website, answers customer questions, routes high-intent visitors toward the right next step, and feeds the stable public launch core around Today, Contacts, and Outcomes.</p>
    </section>

    <div class="state-grid">
      <section id="onboarding-create" class="section-card">
        <h2 class="section-heading">Create your front desk</h2>
        <p class="section-copy">Start with the essentials. We’ll turn your website into a customer-facing front desk you can shape, preview, install, and then confirm inside Today, Contacts, and Outcomes. Google-connected workflow beta can come later.</p>
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
          <div class="pill">Shows proof in Today, Contacts, Analytics</div>
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
        ${eyebrow ? `<p class="page-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${copy ? `<p class="page-copy">${escapeHtml(copy)}</p>` : ""}
        ${badges.length ? `
          <div class="page-badge-row">
            ${badges.map((badge) => `
              <span class="${getBadgeClass(badge.tone || "Pending")}">${escapeHtml(badge.label || "")}</span>
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

function buildSummaryStrip(items = []) {
  const visibleItems = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);

  if (!visibleItems.length) {
    return "";
  }

  return `
    <div class="summary-strip">
      ${visibleItems.map((item) => `
        <article class="summary-strip-item">
          <p class="summary-strip-label">${escapeHtml(item.label)}</p>
          <p class="summary-strip-value">${escapeHtml(String(item.value))}</p>
          ${item.copy ? `<p class="summary-strip-copy">${escapeHtml(item.copy)}</p>` : ""}
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
          ${row.label ? `<span class="disclosure-detail-label">${escapeHtml(row.label)}</span>` : ""}
          ${row.value !== undefined && row.value !== null && row.value !== "" ? `<strong class="disclosure-detail-value">${escapeHtml(row.value)}</strong>` : ""}
          ${row.copy ? `<p class="disclosure-detail-copy">${escapeHtml(row.copy)}</p>` : ""}
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
        <span class="disclosure-toggle-label">${escapeHtml(label)}</span>
        ${summary ? `<span class="disclosure-toggle-summary">${escapeHtml(summary)}</span>` : ""}
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
        >${escapeHtml(item.label)}</button>
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
  const isActive = activeSection === item.key;

  return `
    <button
      class="shell-nav-button ${isActive ? "active" : ""}"
      type="button"
      data-shell-target="${escapeHtml(item.key)}"
      aria-current="${isActive ? "page" : "false"}"
    >
      <span class="shell-nav-icon" aria-hidden="true">${getShellNavIconMarkup(item.key)}</span>
      <span class="shell-nav-label-row">
        <span class="shell-nav-label">${escapeHtml(item.label)}</span>
        ${item.tag ? `<span class="pill shell-nav-tag">${escapeHtml(item.tag)}</span>` : ""}
        ${item.badge ? `<span class="${getBadgeClass(item.badgeTone || "Pending")}">${escapeHtml(item.badge)}</span>` : ""}
      </span>
      ${item.note ? `<span class="shell-nav-note">${escapeHtml(item.note)}</span>` : ""}
    </button>
  `;
}

function buildSidebarGroup(title, items, activeSection) {
  if (!items.length) {
    return "";
  }

  return `
    <section class="shell-sidebar-group">
      <p class="shell-sidebar-label">${escapeHtml(title)}</p>
      <div class="shell-sidebar-list">
        ${items.map((item) => buildShellNavButton(item, activeSection)).join("")}
      </div>
    </section>
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
  const connectedSections = availableSections.filter((section) =>
    ["inbox", "calendar", "automations"].includes(section)
  );
  const todayAttention = Number(actionQueue.summary?.attentionNeeded || 0);
  const contactsAttention = Number(operatorWorkspace.contacts?.summary?.contactsNeedingAttention || 0);
  const workspaceStatus = setup.isReady ? "Ready to use" : "Getting started";
  const knowledgeStatus = setup.knowledgeReady
    ? "Website learned"
    : setup.knowledgeLimited
      ? "Website learning"
      : "Add website details";
  const installTone = isInstallSeen(installStatus)
    ? "Ready"
    : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
      ? "Needs attention"
      : installStatus.state === "installed_unseen"
        ? "Limited"
        : "Pending";

  const coreItems = [
    {
      key: "overview",
      label: "Home",
      note: "Your clearest next steps, recent wins, and what needs attention.",
      badge: todayAttention > 0 ? String(todayAttention) : "",
      badgeTone: todayAttention > 0 ? "Needs attention" : "Pending",
    },
    {
      key: "contacts",
      label: "Customers",
      note: "People, follow-ups, and the latest customer progress.",
      badge: contactsAttention > 0 ? String(contactsAttention) : "",
      badgeTone: contactsAttention > 0 ? "Needs attention" : "Pending",
    },
    {
      key: "customize",
      label: "Front Desk",
      note: "Preview the customer experience and launch readiness.",
    },
    {
      key: "analytics",
      label: "Analytics",
      note: "Signals, proof, weak spots, and business results.",
    },
  ].filter((item) => availableSections.includes(item.key));

  const connectedItems = [
    {
      key: "inbox",
      label: "Email",
      note: "Read-only Gmail support inbox with safe customer categorization.",
      tag: "Optional",
    },
    {
      key: "calendar",
      label: "Calendar",
      note: "Schedule visibility, follow-up gaps, and event review.",
      tag: "Optional",
    },
    {
      key: "automations",
      label: "Automations",
      note: "Saved tasks, campaign drafts, and follow-ups.",
      tag: "Optional",
    },
  ].filter((item) => availableSections.includes(item.key));

  const utilityItems = [
    {
      key: "install",
      label: "Install",
      note: "Go live on the website and verify the embed.",
      badge: isInstallSeen(installStatus) ? "" : "Go live",
      badgeTone: installTone,
    },
    {
      key: "settings",
      label: "Settings",
      note: "Business profile, front desk, connected tools, and workspace.",
    },
  ].filter((item) => availableSections.includes(item.key));

  return `
    <aside class="sidebar-shell" aria-label="Dashboard sidebar">
      <div class="sidebar-identity">
        <div class="sidebar-identity-mark">V</div>
        <div class="sidebar-identity-copy">
          <p class="sidebar-eyebrow">Vonza</p>
          <h2 class="sidebar-title">${escapeHtml(agent.assistantName || agent.name || "Workspace")}</h2>
          <p class="sidebar-copy">${escapeHtml(agent.websiteUrl || "Add your website to personalize the Front Desk")}</p>
        </div>
      </div>
      ${buildSidebarGroup("Primary", coreItems, activeSection)}
      ${connectedSections.length ? buildSidebarGroup("Connected tools", connectedItems, activeSection) : ""}
      <div class="sidebar-footer">
        <div class="sidebar-status-dock">
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">Workspace</span>
            <strong>${escapeHtml(workspaceStatus)}</strong>
          </div>
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">Knowledge</span>
            <strong>${escapeHtml(knowledgeStatus)}</strong>
          </div>
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">Install</span>
            <strong>${escapeHtml(installStatus.label || "Not installed yet")}</strong>
          </div>
        </div>
        ${buildSidebarGroup("Utilities", utilityItems, activeSection)}
      </div>
    </aside>
  `;
}

function formatDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatOperatorCount(value, singular, plural = `${singular}s`) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildOperatorNextActionButton(nextAction = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const actionType = trimText(nextAction.actionType || "stay_put");
  const label = normalizeShellCopy(nextAction.buttonLabel || nextAction.title || "Open Home");
  const disabled = nextAction.disabled === true;

  if (actionType === "connect_google") {
    return `<button class="primary-button" type="button" data-google-connect ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
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

function buildOperatorChecklistMarkup(operatorWorkspace = createEmptyOperatorWorkspace()) {
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
          <h3 class="studio-group-title">A quick checklist to make Today more useful.</h3>
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
                ? "Vonza uses your primary Google Calendar to bring schedule context, recent appointments, and follow-up suggestions into Today."
                : "Connect Google Calendar and Vonza will use your primary calendar to power Today.")}</p>
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
      <p class="operator-empty-title">${escapeHtml(title || "Nothing here yet")}</p>
      <p class="operator-empty-copy">${escapeHtml(copy || "Vonza will fill this area as soon as there is something useful to show.")}</p>
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
      <summary class="row-action-menu-trigger">${escapeHtml(label)}</summary>
      <div class="row-action-menu-panel">
        ${contentMarkup}
      </div>
    </details>
  `;
}

function formatContactLifecycleLabel(value = "") {
  const normalized = trimText(value).replaceAll("_", " ");
  return normalized ? normalized.replace(/\b\w/g, (match) => match.toUpperCase()) : "New";
}

function buildContactSources(contact = {}) {
  return Array.isArray(contact.sources) ? contact.sources : [];
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

function buildContactPrimaryIdentifier(contact = {}) {
  return buildContactIdentifierParts(contact)[0] || "No direct identifier yet";
}

function buildContactIdentitySummary(contact = {}) {
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

function buildContactCurrentStateTitle(contact = {}) {
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

function buildContactCurrentStateCopy(contact = {}) {
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

function buildContactActionMarkup(label = "", attributes = {}, className = "ghost-button") {
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

function contactNeedsReply(contact = {}) {
  const nextActionKey = trimText(contact.nextAction?.key);

  if (nextActionKey && nextActionKey !== "no_action_needed") {
    return true;
  }

  return Boolean(trimText(contact.nextAction?.title) || trimText(contact.nextAction?.description));
}

function isComplaintContact(contact = {}) {
  const lifecycleState = trimText(contact.lifecycleState);
  const flags = buildContactFlags(contact);

  return ["complaint_risk", "support_issue"].includes(lifecycleState) || flags.includes("complaint");
}

function isLeadContact(contact = {}) {
  return ["new", "active_lead", "qualified"].includes(trimText(contact.lifecycleState));
}

function isResolvedContact(contact = {}) {
  if (contactNeedsReply(contact)) {
    return false;
  }

  return contact.hasMeaningfulOutcome === true || Boolean(trimText(contact.latestOutcome?.label));
}

function isReturningContact(contact = {}) {
  return trimText(contact.lifecycleState) === "customer"
    || Number(contact.counts?.outcomes || 0) > 0
    || Number(contact.counts?.inboxThreads || 0) > 1
    || (contact.timeline || []).length > 1;
}

function getCustomerName(contact = {}) {
  return trimText(contact.name)
    || trimText(contact.bestIdentifier)
    || trimText(contact.email)
    || trimText(contact.phone)
    || "Guest visitor";
}

function getCustomerIdentityLabel(contact = {}) {
  if (trimText(contact.email)) {
    return "Email user";
  }

  if (trimText(contact.phone)) {
    return "Phone user";
  }

  return "Guest visitor";
}

function getCustomerIdentifier(contact = {}) {
  return trimText(contact.bestIdentifier)
    || trimText(contact.email)
    || trimText(contact.phone)
    || "No direct identifier yet";
}

function getCustomerLastActivityLabel(contact = {}) {
  if (contact.mostRecentActivityAt) {
    return formatSeenAt(contact.mostRecentActivityAt);
  }

  if (contact.latestOutcome?.occurredAt) {
    return formatSeenAt(contact.latestOutcome.occurredAt);
  }

  return "No recent activity";
}

function getCustomerLatestSummary(contact = {}) {
  const recentTimelineEntry = (contact.timeline || [])[0] || {};

  return trimText(recentTimelineEntry.summary)
    || trimText(recentTimelineEntry.label)
    || trimText(contact.nextAction?.description)
    || trimText(contact.latestOutcome?.label)
    || "No recent message summary yet.";
}

function getCustomerSituationSummary(contact = {}) {
  const recentTimelineEntry = (contact.timeline || [])[0] || {};

  return trimText(contact.nextAction?.description)
    || trimText(recentTimelineEntry.summary)
    || trimText(contact.latestOutcome?.label)
    || "No current situation has been captured yet.";
}

function getCustomerRiskSummary(contact = {}) {
  if (isComplaintContact(contact)) {
    return "Risk is elevated. This customer may lose trust if the issue stays unanswered.";
  }

  if (isLeadContact(contact) && contactNeedsReply(contact)) {
    return "Lead intent is present, but momentum could fade if nobody replies soon.";
  }

  if (contactNeedsReply(contact)) {
    return "The conversation is still open and likely needs a human reply or follow-up.";
  }

  if (isResolvedContact(contact)) {
    return "The latest interaction looks settled right now with no urgent action standing out.";
  }

  if (isReturningContact(contact)) {
    return "This looks like a returning relationship, so continuity matters more than a generic reply.";
  }

  return "No strong risk signal is standing out yet.";
}

function getCustomerSuggestedAction(contact = {}) {
  return trimText(contact.nextAction?.description)
    || trimText(contact.nextAction?.title)
    || (isComplaintContact(contact)
      ? "Send a calm reply, confirm the issue, and give one clear next step."
      : isLeadContact(contact)
        ? "Answer the open question and guide this person toward a quote, booking, or decision."
        : isReturningContact(contact)
          ? "Reconnect with context from the last interaction and confirm the next step."
          : "Review the latest interaction and decide whether a follow-up is still needed.");
}

function getCustomerDraftPreview(contact = {}) {
  if (isComplaintContact(contact)) {
    return "Apologize clearly, confirm the issue, and offer one specific next step with timing.";
  }

  if (isLeadContact(contact)) {
    return "Thank them for reaching out, answer the open question, and suggest the clearest next step.";
  }

  if (contactNeedsReply(contact)) {
    return "Acknowledge the latest message, answer the main question, and confirm what happens next.";
  }

  if (isReturningContact(contact)) {
    return "Reference the previous interaction, check whether they still need help, and keep the reply warm and brief.";
  }

  return "";
}

function getCustomerStatusList(contact = {}) {
  const statuses = [];
  const pushStatus = (key, label) => {
    if (!statuses.some((status) => status.key === key)) {
      statuses.push({ key, label });
    }
  };

  if (isComplaintContact(contact)) {
    pushStatus("complaint", "Complaint");
  }

  if (isLeadContact(contact)) {
    pushStatus("lead", "Lead");
  }

  if (contactNeedsReply(contact)) {
    pushStatus("needs_reply", "Needs reply");
  }

  if (isResolvedContact(contact)) {
    pushStatus("resolved", "Resolved");
  }

  if (isReturningContact(contact)) {
    pushStatus("returning", "Returning");
  }

  if (!statuses.length) {
    pushStatus("resolved", "Resolved");
  }

  return statuses;
}

function buildCustomerStatusMarkup(contact = {}, limit = 2) {
  return getCustomerStatusList(contact)
    .slice(0, limit)
    .map((status) => `
      <span class="customer-status-chip customer-status-chip--${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>
    `)
    .join("");
}

function getPrimaryCustomerStatus(contact = {}) {
  return getCustomerStatusList(contact)[0] || { key: "resolved", label: "Resolved" };
}

function buildCustomerFilterDefinitions(contacts = []) {
  const countMatching = (predicate) => contacts.filter(predicate).length;

  return [
    { key: "all", label: "All", count: contacts.length },
    { key: "needs_reply", label: "Needs reply", count: countMatching((contact) => contactNeedsReply(contact)) },
    { key: "complaints", label: "Complaints", count: countMatching((contact) => isComplaintContact(contact)) },
    { key: "leads", label: "Leads", count: countMatching((contact) => isLeadContact(contact)) },
    { key: "resolved", label: "Resolved", count: countMatching((contact) => isResolvedContact(contact)) },
  ];
}

function buildCustomerSummaryItems(contacts = []) {
  const countMatching = (predicate) => contacts.filter(predicate).length;

  return [
    {
      label: "Needs reply",
      value: countMatching((contact) => contactNeedsReply(contact)),
      copy: "People waiting on an answer, follow-up, or decision.",
    },
    {
      label: "Complaints",
      value: countMatching((contact) => isComplaintContact(contact)),
      copy: "Unhappy or at-risk conversations that should not sit idle.",
    },
    {
      label: "Leads",
      value: countMatching((contact) => isLeadContact(contact)),
      copy: "People showing buying intent or asking for next-step details.",
    },
    {
      label: "Resolved",
      value: countMatching((contact) => isResolvedContact(contact)),
      copy: "Threads that currently look closed without urgent follow-up.",
    },
    {
      label: "Returning",
      value: countMatching((contact) => isReturningContact(contact)),
      copy: "Existing relationships where prior context should shape the next reply.",
    },
  ];
}

function buildContactQuickActions(
  contact = {},
  operatorWorkspace = createEmptyOperatorWorkspace(),
  { includeDraftFollowUp = true } = {}
) {
  const actions = [];
  const nextAction = contact.nextAction || {};
  const suggestedSlot = (operatorWorkspace.calendar?.suggestedSlots || [])[0] || null;
  const automationsVisible = isCapabilityVisibleForWorkspace("automations", operatorWorkspace);

  if (contact.latestMessageId) {
    actions.push(`<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(contact.latestMessageId)}">Open related conversation</button>`);
  }

  if (contact.primaryThreadId) {
    actions.push(`<button class="ghost-button" type="button" data-open-inbox-thread data-thread-id="${escapeHtml(contact.primaryThreadId)}">Open inbox thread</button>`);
  }

  if (nextAction.followUpId) {
    if (automationsVisible) {
      actions.push(`<button class="ghost-button" type="button" data-open-follow-up data-follow-up-id="${escapeHtml(nextAction.followUpId)}">Open follow-up draft</button>`);
    } else if (contact.id) {
      actions.push(`<button class="ghost-button" type="button" data-shell-target="contacts" data-target-id="${escapeHtml(contact.id)}">Open customer</button>`);
    }
  } else if ((contact.email || contact.phone) && automationsVisible && includeDraftFollowUp) {
    actions.push(`
      <button
        class="ghost-button"
        type="button"
        data-draft-contact-followup
        data-contact-name="${escapeHtml(contact.name || "")}"
        data-contact-email="${escapeHtml(contact.email || "")}"
        data-contact-phone="${escapeHtml(contact.phone || "")}"
        data-contact-id="${escapeHtml(contact.id || "")}"
        data-person-key="${escapeHtml(contact.personKey || "")}"
        data-lead-id="${escapeHtml(contact.leadId || "")}"
        data-lifecycle-state="${escapeHtml(contact.lifecycleState || "")}"
      >Draft follow-up</button>
    `);
  }

  if (nextAction.eventId || contact.primaryEventId) {
    actions.push(`<button class="ghost-button" type="button" data-open-calendar-event data-event-id="${escapeHtml(nextAction.eventId || contact.primaryEventId)}">Review calendar action</button>`);
  } else if ((contact.email || contact.phone) && suggestedSlot?.startAt && suggestedSlot?.endAt) {
    actions.push(`
      <button
        class="ghost-button"
        type="button"
        data-draft-contact-calendar
        data-contact-name="${escapeHtml(contact.name || "")}"
        data-contact-email="${escapeHtml(contact.email || "")}"
        data-contact-phone="${escapeHtml(contact.phone || "")}"
        data-contact-id="${escapeHtml(contact.id || "")}"
        data-lead-id="${escapeHtml(contact.leadId || "")}"
        data-slot-start="${escapeHtml(suggestedSlot.startAt || "")}"
        data-slot-end="${escapeHtml(suggestedSlot.endAt || "")}"
      >Schedule call</button>
    `);
  } else {
    actions.push(`<button class="ghost-button" type="button" data-shell-target="calendar">Open calendar</button>`);
  }

  if (contact.email && automationsVisible) {
    actions.push(`
      <button
        class="ghost-button"
        type="button"
        data-draft-contact-campaign
        data-contact-name="${escapeHtml(contact.name || "")}"
        data-contact-email="${escapeHtml(contact.email || "")}"
        data-contact-id="${escapeHtml(contact.id || "")}"
        data-person-key="${escapeHtml(contact.personKey || "")}"
        data-lead-id="${escapeHtml(contact.leadId || "")}"
        data-goal="${escapeHtml(nextAction.recommendedGoal || getRecommendedCampaignGoal(contact))}"
      >Draft campaign</button>
    `);
  }

  if (Array.isArray(contact.complaintTaskIds) && contact.complaintTaskIds.length) {
    actions.push(`<button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(contact.complaintTaskIds[0])}" data-task-status="resolved">Mark complaint resolved</button>`);
    actions.push(`<button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(contact.complaintTaskIds[0])}" data-task-status="escalated">Escalate</button>`);
  }

  return actions.join("");
}

function buildContactsAttentionStrip(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const summary = operatorWorkspace.contacts?.summary || createEmptyOperatorWorkspace().contacts.summary;

  return `
    <div class="overview-grid operator-metric-grid operator-people-grid">
      <div class="overview-card">
        <p class="overview-label">Needs a follow-up</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.contactsNeedingAttention, "contact"))}</p>
        <p class="overview-card-copy">People who would benefit from a reply, a handoff, or a next step.</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">At-risk relationships</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.complaintRiskContacts, "contact"))}</p>
        <p class="overview-card-copy">Customers or leads where support context should stay front and center.</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">No clear next step</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.leadsWithoutNextStep, "lead"))}</p>
        <p class="overview-card-copy">Interested people who still need a follow-up, booking, or quote path.</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">Customers to check in with</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.customersAwaitingFollowUp, "customer"))}</p>
        <p class="overview-card-copy">Customers who could benefit from another touchpoint before momentum fades.</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">Contacts with wins</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.contactsWithOutcomes, "contact"))}</p>
        <p class="overview-card-copy">People records where Vonza can already point to a real result.</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">High-value still open</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(summary.highValueWithoutOutcome, "contact"))}</p>
        <p class="overview-card-copy">Qualified or active leads that still need a real outcome, not just activity.</p>
      </div>
    </div>
  `;
}

function buildContactSourceSummary(contact = {}) {
  const sources = buildContactSources(contact);
  return sources.length ? sources.join(" · ") : "Sparse record";
}

function buildContactCountsSummary(contact = {}) {
  return [
    `${contact.counts?.leads || 0} leads`,
    `${contact.counts?.inboxThreads || 0} inbox`,
    `${contact.counts?.calendarEvents || 0} calendar`,
    `${contact.counts?.followUps || 0} follow-ups`,
    `${contact.counts?.outcomes || 0} outcomes`,
  ].join(" · ");
}

function buildContactRow(contact = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const primaryStatus = getPrimaryCustomerStatus(contact);
  const statusKeys = getCustomerStatusList(contact).map((status) => status.key).join("|");
  const identityMeta = [getCustomerIdentityLabel(contact), getCustomerLastActivityLabel(contact)]
    .filter(Boolean)
    .join(" · ");

  return `
    <article
      class="contact-row customer-row"
      data-contact-row
      data-contact-card
      data-contact-id="${escapeHtml(contact.id || "")}"
      data-contact-lifecycle="${escapeHtml(contact.lifecycleState || "")}"
      data-contact-flags="${escapeHtml(buildContactFlags(contact).join("|"))}"
      data-contact-sources="${escapeHtml(buildContactSources(contact).join("|"))}"
      data-contact-statuses="${escapeHtml(statusKeys)}"
      data-contact-last-activity="${escapeHtml(contact.mostRecentActivityAt || "")}"
    >
      <div class="contact-row-main">
        <div class="customer-row-top">
          <div class="customer-row-title-group">
            <span class="customer-row-dot customer-row-dot--${escapeHtml(primaryStatus.key)}" aria-hidden="true"></span>
            <div>
              <strong class="contact-row-name">${escapeHtml(getCustomerName(contact))}</strong>
              <p class="customer-row-summary">${escapeHtml(getCustomerLatestSummary(contact))}</p>
            </div>
          </div>
          <div class="customer-row-statuses">
            <span class="customer-status-chip customer-status-chip--${escapeHtml(primaryStatus.key)}">${escapeHtml(primaryStatus.label)}</span>
          </div>
        </div>
        <div class="customer-row-meta">
          <span class="customer-row-meta-value">${escapeHtml(identityMeta)}</span>
        </div>
      </div>
    </article>
  `;
}

function buildContactDetailPanel(
  agent = {},
  contact = {},
  operatorWorkspace = createEmptyOperatorWorkspace(),
  selected = false
) {
  const automationsVisible = isCapabilityVisibleForWorkspace("automations", operatorWorkspace);
  const canDraftReply = automationsVisible && Boolean(contact.email || contact.phone);
  const primaryActionMarkup = canDraftReply ? `
    <button
      class="primary-button"
      data-customer-primary-action
      type="button"
      data-draft-contact-followup
      data-contact-name="${escapeHtml(contact.name || "")}"
      data-contact-email="${escapeHtml(contact.email || "")}"
      data-contact-phone="${escapeHtml(contact.phone || "")}"
      data-contact-id="${escapeHtml(contact.id || "")}"
      data-person-key="${escapeHtml(contact.personKey || "")}"
      data-lead-id="${escapeHtml(contact.leadId || "")}"
      data-lifecycle-state="${escapeHtml(contact.lifecycleState || "")}"
      ${contact.email || contact.phone ? "" : "disabled"}
    >Send AI draft</button>
  ` : contact.latestMessageId ? `
    <button class="primary-button" data-customer-primary-action type="button" data-open-conversation data-message-id="${escapeHtml(contact.latestMessageId)}">Open conversation</button>
  ` : contact.primaryThreadId ? `
    <button class="primary-button" data-customer-primary-action type="button" data-open-inbox-thread data-thread-id="${escapeHtml(contact.primaryThreadId)}">Open inbox thread</button>
  ` : contact.primaryEventId ? `
    <button class="primary-button" data-customer-primary-action type="button" data-open-calendar-event data-event-id="${escapeHtml(contact.primaryEventId)}">Review calendar action</button>
  ` : `
    <button class="primary-button" data-customer-primary-action type="button" data-shell-target="contacts" data-target-id="${escapeHtml(contact.id || "")}" ${contact.id ? "" : "disabled"}>Review customer</button>
  `;
  const timelineMarkup = Array.isArray(contact.timeline) && contact.timeline.length ? `
    <div class="timeline-list customer-timeline-list">
      ${contact.timeline.slice(0, 5).map((entry) => `
        <div class="timeline-row">
          <div>
            <strong>${escapeHtml(entry.at ? formatSeenAt(entry.at) : entry.label || "Recent")}</strong>
            <span>${escapeHtml(trimText(entry.label || entry.source || "Activity"))}</span>
          </div>
          <p class="customer-timeline-copy">${escapeHtml(trimText(entry.summary) || "No additional note stored for this interaction.")}</p>
        </div>
      `).join("")}
    </div>
  ` : `<div class="placeholder-card">No timeline details are stored yet.</div>`;
  const detailDisclosureMarkup = buildDisclosureBlock({
    label: "View timeline",
    summary: `${contact.timeline?.length || 0} interaction${contact.timeline?.length === 1 ? "" : "s"}`,
    className: "customer-detail-disclosure",
    contentMarkup: `
      <div class="customer-detail-disclosure-section">
        ${canDraftReply ? `
          <div class="customer-draft-card">
            <span class="detail-kv-label">Optional AI draft</span>
            <strong>${escapeHtml(getCustomerDraftPreview(contact))}</strong>
          </div>
        ` : ""}
      </div>
      ${buildDisclosureDetailRows([
        { label: "Customer", value: getCustomerName(contact), copy: getCustomerIdentityLabel(contact) },
        { label: "Identifier", value: getCustomerIdentifier(contact), copy: buildContactSourceSummary(contact) },
        { label: "Previous interactions", value: buildContactCountsSummary(contact) },
        {
          label: "Latest outcome",
          value: trimText(contact.latestOutcome?.label) || "No recorded result yet",
          copy: contact.latestOutcome?.occurredAt ? `Updated ${formatSeenAt(contact.latestOutcome.occurredAt)}` : "No recent outcome has been recorded.",
        },
      ])}
      ${timelineMarkup}
      <form class="detail-inline-form" data-contact-lifecycle-form data-contact-id="${escapeHtml(contact.id || "")}">
        <label for="contact-detail-lifecycle-${escapeHtml(contact.id || contact.name || "contact")}">Customer status</label>
        <div class="detail-inline-form-row">
          <select id="contact-detail-lifecycle-${escapeHtml(contact.id || contact.name || "contact")}" name="lifecycle_state">
            ${["new", "active_lead", "qualified", "customer", "support_issue", "complaint_risk", "dormant"].map((state) => `
              <option value="${escapeHtml(state)}" ${state === contact.lifecycleState ? "selected" : ""}>${escapeHtml(formatContactLifecycleLabel(state))}</option>
            `).join("")}
          </select>
          <button class="ghost-button" type="submit" ${contact.id ? "" : "disabled"}>Save status</button>
        </div>
      </form>
      ${isCapabilityExplicitlyVisible("manual_outcome_marks") ? `
        <form class="action-queue-follow-up-form" data-manual-outcome-form data-contact-id="${escapeHtml(contact.id || "")}" data-lead-id="${escapeHtml(contact.leadId || "")}" data-follow-up-id="${escapeHtml(contact.primaryFollowUpId || "")}" data-inbox-thread-id="${escapeHtml(contact.primaryThreadId || "")}" data-calendar-event-id="${escapeHtml(contact.primaryEventId || "")}" data-person-key="${escapeHtml(contact.personKey || "")}">
          <div class="form-grid two-col">
            <div class="field">
              <label for="contact-outcome-${escapeHtml(contact.id || contact.name || "contact")}">Outcome mark</label>
              <select id="contact-outcome-${escapeHtml(contact.id || contact.name || "contact")}" name="outcome_type" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
                <option value="booking_confirmed">booked</option>
                <option value="quote_requested">quote requested</option>
                <option value="quote_accepted">quote accepted</option>
                <option value="follow_up_replied">follow-up successful</option>
                <option value="complaint_resolved">complaint resolved</option>
                <option value="manual_outcome_marked">no outcome / manual note</option>
              </select>
            </div>
            <div class="field">
              <label for="contact-outcome-note-${escapeHtml(contact.id || contact.name || "contact")}">Note</label>
              <input id="contact-outcome-note-${escapeHtml(contact.id || contact.name || "contact")}" name="note" type="text" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
            </div>
          </div>
          <div class="action-queue-form-actions">
            <button class="ghost-button" type="submit" ${agent.manualOutcomeMode === true ? "" : "disabled"}>Record outcome</button>
          </div>
        </form>
      ` : ""}
    `,
  });

  return `
    <article
      class="contact-detail-panel customer-detail-panel ${selected ? "active" : ""}"
      data-contact-detail
      data-contact-card
      data-contact-id="${escapeHtml(contact.id || "")}"
      ${selected ? "" : "hidden"}
    >
      <div class="contact-detail-header customer-detail-header">
        <div class="customer-detail-intro">
          <h2 class="contact-detail-title">${escapeHtml(getCustomerName(contact))}</h2>
          <p class="contact-detail-copy">${escapeHtml([
            getCustomerIdentityLabel(contact),
            getPrimaryCustomerStatus(contact).label,
            `Last active ${getCustomerLastActivityLabel(contact)}`,
          ].join(" · "))}</p>
          <div class="action-queue-badges customer-status-row">
            ${buildCustomerStatusMarkup(contact, 2)}
          </div>
        </div>
      </div>
      <div class="contact-detail-summary-grid customer-detail-summary-grid">
        <div class="detail-kv-item customer-detail-card">
          <span class="detail-kv-label">Current situation</span>
          <strong>${escapeHtml(getCustomerSituationSummary(contact))}</strong>
        </div>
        <div class="detail-kv-item customer-detail-card">
          <span class="detail-kv-label">Vonza suggests</span>
          <strong>${escapeHtml(getCustomerSuggestedAction(contact))}</strong>
        </div>
      </div>
      <div class="inline-actions customer-primary-actions">
        ${primaryActionMarkup}
        <button
          class="ghost-button customer-secondary-button"
          type="button"
          data-contact-quick-status="customer"
          data-contact-id="${escapeHtml(contact.id || "")}"
          ${contact.id ? "" : "disabled"}
        >Mark resolved</button>
      </div>
      <div class="customer-risk-note">${escapeHtml(getCustomerRiskSummary(contact))}</div>
      ${detailDisclosureMarkup}
    </article>
  `;
}

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

function buildContactsPanel(agent = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const contacts = operatorWorkspace.contacts?.list || [];
  const contactsHealth = operatorWorkspace.contacts?.health || createEmptyOperatorWorkspace().contacts.health;
  const customerFilters = buildCustomerFilterDefinitions(contacts);
  const selectedContact = contacts[0] || null;
  const peopleWorkspaceMarkup = `
    <div class="customers-page-topbar">
      <div class="customers-page-copy">
        <h2 class="customers-page-title">Customers</h2>
        <p class="customers-page-subtitle">Keep support organized without turning Vonza into a CRM</p>
      </div>
      <div class="customers-page-actions">
        <button class="ghost-button customer-utility-button" type="button" data-focus-customer-filters>Filter</button>
        <button class="ghost-button customer-utility-button customer-utility-button-primary" type="button" data-export-customers>Export customers</button>
      </div>
    </div>
    <section class="customer-focus-banner">
      <p class="workspace-panel-title">See who needs help, who might be lost, and who is becoming a lead, all in one simple workspace.</p>
      <button class="ghost-button customer-banner-button" type="button" data-contact-filter="unresolved">Open unresolved only</button>
    </section>
    <div class="customer-filter-strip" data-customer-filter-strip>
      ${customerFilters.map((filter, index) => `
        <button class="contact-filter-button customer-filter-pill ${index === 0 ? "active" : ""}" type="button" data-contact-filter="${escapeHtml(filter.key)}">
          ${escapeHtml(filter.label)}
        </button>
      `).join("")}
    </div>
    <div class="contacts-workspace" data-contacts-workspace>
      <section class="contacts-list-shell">
        <div class="contacts-list-header">
          <div>
            <h3 class="flat-section-title">Customers</h3>
            <p class="workspace-panel-copy">The people who need a reply, decision, or follow-up.</p>
          </div>
        </div>
        <div class="contacts-list" data-contact-filter-results>
          ${contacts.map((contact) => buildContactRow(contact, operatorWorkspace)).join("")}
        </div>
      </section>
      <section class="contacts-detail-shell">
        ${contacts.map((contact, index) => buildContactDetailPanel(agent, contact, operatorWorkspace, index === 0)).join("")}
        ${selectedContact ? "" : `<div class="placeholder-card">Choose a customer to review the situation, next action, and recent history.</div>`}
      </section>
    </div>
  `;

  return `
    <section class="workspace-page" data-shell-section="contacts" hidden>
      <div class="workspace-page-body">
        <div class="workspace-section-stack">
          ${contactsHealth.loadError ? `<div class="operator-inline-alert"><p>${escapeHtml(`Some contact history is still loading: ${contactsHealth.loadError}`)}</p></div>` : ""}
          ${!contacts.length ? buildOperatorEmptyState({
            title: "Your customers will show up here",
            copy: operatorWorkspace.status?.googleConnected
              ? "Leads, bookings, inbox threads, and follow-ups will appear here as customer records."
              : "Chat and lead capture records will appear here as customers.",
          }) : peopleWorkspaceMarkup}
        </div>
      </div>
    </section>
  `;
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
          <p class="overview-label">${escapeHtml(card.label || "Copilot summary")}</p>
          <p class="overview-card-copy">${escapeHtml(card.text || "Copilot is waiting for more stable-core context.")}</p>
          ${buildDisclosureBlock({
            label: "View details",
            summary: card.confidence ? `Confidence ${card.confidence}` : "",
            className: "disclosure-block-inline",
            contentMarkup: buildDisclosureDetailRows([
              { label: "Confidence", value: card.confidence || "Not scored" },
              { label: "Reasoning", value: card.rationale || "Copilot is waiting for more stable-core context." },
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
            <p class="workspace-panel-copy">There are no active Copilot proposals right now because the current ones were already handled or dismissed.</p>
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
          <p class="workspace-panel-copy">Each proposal explains what Copilot recommends, why it matters, what will happen if you apply it, and where the real workflow object will land.</p>
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
                <p class="analytics-item-title">${escapeHtml(normalizeShellCopy(proposal.title || "Copilot proposal"))}</p>
                <p class="analytics-item-copy">${escapeHtml(normalizeShellCopy(proposal.summary || "Copilot prepared an approval-first proposal from stable-core data."))}</p>
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
          <p class="studio-kicker">Copilot</p>
          <h3 class="workspace-panel-title">Today Copilot</h3>
          <p class="workspace-panel-copy">View-only summaries and draft suggestions built from your live workspace. Copilot does not silently act on your behalf.</p>
        </div>
        <div class="workspace-badge-row">
          <span class="${getBadgeClass(copilot.readOnly ? "Ready" : "Limited")}">${copilot.readOnly ? "View only" : "Limited"}</span>
          <span class="${getBadgeClass(copilot.draftOnly ? "Ready" : "Limited")}">${copilot.draftOnly ? "Review first" : "Mixed mode"}</span>
        </div>
      </div>
      <div class="operator-home-grid">
        <section class="operator-focus-card">
          <p class="overview-label">Today headline</p>
          <h3 class="operator-focus-title">${escapeHtml(copilot.headline || "Copilot is ready.")}</h3>
          <p class="operator-focus-copy">${escapeHtml(copilot.summary || "Copilot is summarizing your current workspace only.")}</p>
        </section>
        <section class="operator-focus-card operator-briefing-card">
          <p class="overview-label">Business context</p>
          <p class="workspace-panel-copy">${escapeHtml(readiness.summary || "Business context progress will appear here.")}</p>
          ${readiness.missingCount ? `<p class="analytics-subtle">${escapeHtml(`${readiness.missingCount} area${readiness.missingCount === 1 ? "" : "s"} could use more business detail.`)}</p>` : `<p class="analytics-subtle">Core business context is ready for Copilot.</p>`}
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
          <strong>${escapeHtml(copilot.fallback?.title || "Copilot needs a little more context")}</strong>
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

function buildTodaySummaryStats(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const today = operatorWorkspace.today || createEmptyOperatorWorkspace().today;
  const stats = [
    {
      label: "Messages today",
      value: String(today.messagesToday || 0),
      copy: "Current-day front desk volume only.",
    },
    {
      label: "Customers handled",
      value: String(today.contactsDealtToday || 0),
      copy: "People Vonza touched today across live work.",
    },
    {
      label: "Outcomes today",
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
          <h3 class="workspace-panel-title">Today at a glance</h3>
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
              analyticsFallbackLabel: "Open Outcomes",
              contactFallbackLabel: "Open customer",
            }
          );

          return `
            <article class="today-command-card today-command-card-proposal">
              <div class="today-command-card-head">
                <div>
                  <h4 class="today-command-card-title">${escapeHtml(normalizeShellCopy(proposal.title || "Copilot proposal"))}</h4>
                  <p class="today-command-card-copy">${escapeHtml(normalizeShellCopy(proposal.summary || "Copilot prepared an approval-first proposal from live workspace data."))}</p>
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
  const recommendations = Array.isArray(copilot.recommendations) ? copilot.recommendations.slice(0, 6) : [];

  return `
    <section class="today-command-section">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Recommendations</p>
          <h3 class="workspace-panel-title">Improve the business and Vonza</h3>
          <p class="workspace-panel-copy">Business performance, assistant quality, setup, and conversion follow-up suggestions live here.</p>
        </div>
      </div>
      ${recommendations.length ? `
        <div class="today-command-card-list">
          ${recommendations.map((recommendation) => {
            const resolvedTarget = resolveVisibleShellTarget(
              recommendation.targetSection || recommendation.proposal?.target?.section || "overview",
              recommendation.targetId || recommendation.proposal?.target?.id || "",
              operatorWorkspace,
              {
                label: recommendation.surfaceLabel || recommendation.proposal?.openLabel || "Open",
                actionKey: recommendation.source?.actionKey,
                contactId: recommendation.source?.contactId,
                analyticsFallbackLabel: "Open Outcomes",
                contactFallbackLabel: "Open customer",
              }
            );

            return `
              <article class="today-command-card">
                <div class="today-command-card-head">
                  <div>
                    <div class="today-command-pill-row">
                      <span class="pill">${escapeHtml(getTodayRecommendationCategory(recommendation))}</span>
                      ${recommendation.priority ? `<span class="${getBadgeClass(recommendation.priority === "high" ? "Needs attention" : "Ready")}">${escapeHtml(recommendation.priority)}</span>` : ""}
                    </div>
                    <h4 class="today-command-card-title">${escapeHtml(normalizeShellCopy(recommendation.title || "Recommendation"))}</h4>
                    <p class="today-command-card-copy">${escapeHtml(normalizeShellCopy(recommendation.summary || "Vonza surfaced a recommendation from current workspace signals."))}</p>
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
                      ${escapeHtml(resolvedTarget.label || "Open")}
                    </button>
                  ` : ""}
                </div>
                ${buildDisclosureBlock({
                  label: "Why this recommendation",
                  summary: recommendation.confidence ? `Confidence ${recommendation.confidence}` : "",
                  className: "disclosure-block-inline",
                  contentMarkup: buildDisclosureDetailRows([
                    { label: "Category", value: getTodayRecommendationCategory(recommendation) },
                    { label: "Why it matters", value: recommendation.rationale || "This recommendation came from current-day and live-workspace context." },
                    { label: "Best place to act", value: resolvedTarget?.label || resolvedTarget?.section || recommendation.surfaceLabel || "Current workspace" },
                  ]),
                })}
              </article>
            `;
          }).join("")}
        </div>
      ` : `
        <div class="today-command-empty">
          <p>No recommendations are standing out right now.</p>
          <p class="analytics-subtle">When Vonza sees a clear business, setup, assistant-quality, or follow-up opportunity, it will appear here.</p>
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
      item.endAt ? `to ${formatSeenAt(item.endAt)}` : "",
    ].filter(Boolean).join(" ")
    : "";

  return [
    timeLabel,
    attendeeLabel ? `Context: ${attendeeLabel}` : "",
    trimText(item.status).replaceAll("_", " "),
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
          <p class="studio-kicker">${escapeHtml(kicker || "Today")}</p>
          <h3 class="studio-group-title">${escapeHtml(title || "Today card")}</h3>
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
            <p class="studio-kicker">Google Calendar</p>
            <h3 class="workspace-panel-title">Connect Google to unlock schedule context</h3>
            <p class="workspace-panel-copy">Calendar-heavy detail now lives behind supporting detail so Today stays clean by default.</p>
          </div>
        </div>
        <div class="inline-actions">
          <button class="primary-button" type="button" data-google-connect ${status.googleConfigReady ? "" : "disabled"}>Connect Google</button>
        </div>
      </section>
    ` : ""}
    <div class="overview-grid operator-metric-grid">
      ${buildTodayInsightCard({
        kicker: "Today",
        title: "Today's Schedule",
        description: "Remaining schedule context and appointment detail.",
        items: scheduleItems,
        emptyTitle: status.googleConnected
          ? "No more appointments are on today’s schedule"
          : "Connect Google to see today’s schedule",
        emptyCopy: status.googleConnected
          ? "Vonza will keep today’s remaining schedule here."
          : "Connect Google Calendar to bring today’s appointments into Today.",
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
        description: "Calendar linking detail moved out of the default Today view.",
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
        <p class="overview-card-copy">${escapeHtml(`${formatOperatorCount(summary.followUpsNeedingApproval, "follow-up")} and ${formatOperatorCount(today.campaignsAwaitingApproval, "campaign approval", "campaign approvals")} are waiting for review.`)}</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">Outcome gaps</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(today.highValueWithoutOutcome, "contact"))}</p>
        <p class="overview-card-copy">${escapeHtml(`${formatOperatorCount(today.overdueHighValueContacts, "high-value contact")} still need a real result and ${formatOperatorCount(today.complaintRiskContacts, "complaint-risk contact")} remain in play.`)}</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">Campaign replies</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(today.campaignReplies, "reply"))}</p>
        <p class="overview-card-copy">${escapeHtml(`${formatOperatorCount(today.campaignConversions, "conversion")} have been tied back to campaign work so far.`)}</p>
      </div>
      <div class="overview-card">
        <p class="overview-label">Lifecycle progression</p>
        <p class="overview-value">${escapeHtml(formatOperatorCount(today.contactsWithProgression, "contact"))}</p>
        <p class="overview-card-copy">${escapeHtml(`${today.lifecycleCounts.customer || 0} customers · ${today.lifecycleCounts.qualified || 0} qualified · ${today.lifecycleCounts.activeLead || 0} active leads`)}</p>
      </div>
    </div>
    <section class="workspace-card-soft today-support-card">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Proof</p>
          <h3 class="workspace-panel-title">Recent successful outcomes</h3>
          <p class="workspace-panel-copy">Outcome history stays available here without dominating Today.</p>
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
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);

  return `
    <section class="workspace-card-soft operator-home-card">
      <div class="workspace-panel-header">
        <div>
          <p class="studio-kicker">Operator home</p>
          <h2 class="workspace-panel-title">Today</h2>
          <p class="workspace-panel-copy">Today is now the fast command page: current-day signals, compact proposals, and the clearest recommendations only.</p>
        </div>
        <div class="workspace-badge-row">
          <span class="${getBadgeClass(status.googleConnected ? "Ready" : "Limited")}">${status.googleConnected
            ? (googleCapabilities.calendarRead && !googleCapabilities.gmailRead ? "Google Calendar connected" : "Google connected")
            : "Google Calendar optional"}</span>
          <span class="${getBadgeClass(status.migrationRequired ? "Limited" : "Ready")}">${status.migrationRequired ? "Workspace still syncing" : "Workspace ready"}</span>
        </div>
      </div>
      ${buildTodaySummaryStats(operatorWorkspace)}
      ${buildTodayProposalSection(operatorWorkspace)}
      ${buildTodayRecommendationsSection(operatorWorkspace)}
      ${buildTodaySupportingDetailSection(operatorWorkspace)}
    </section>
  `;
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
  const contextLabel = isAppointmentReviewQueueItem(item) ? "Attendee / contact" : "Contact";

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
        <label>Operator note</label>
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
  const contextTitle = isAppointmentReviewQueueItem(item) ? "Appointment follow-up" : "Today item";
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
            <p class="support-panel-copy">${escapeHtml(briefing.text || "Select a Today item and its context, notes, and next step will stay here while you work.")}</p>
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
            <h3 class="today-review-panel-title">Stay in Today while you work through what matters.</h3>
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
function buildOverviewPanel(agent, messages, setup, actionQueue, operatorWorkspace) {
  const overview = buildOverviewState(agent, messages, setup, actionQueue);
  const today = operatorWorkspace.today || createEmptyOperatorWorkspace().today;
  const contactsList = Array.isArray(operatorWorkspace.contacts?.list) ? operatorWorkspace.contacts.list : [];
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
  const countLabel = (value, singular, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;
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
  const recentWins = contactsList
    .filter((contact) => trimText(contact.latestOutcome?.label))
    .slice()
    .sort((left, right) => (
      getDashboardComparableTime(right.latestOutcome?.occurredAt, right.mostRecentActivityAt)
      - getDashboardComparableTime(left.latestOutcome?.occurredAt, left.mostRecentActivityAt)
    ));
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
  const serviceHealth = (() => {
    if (openIssueCount > 0) {
      return {
        label: openIssueCount > 2 ? "Needs attention" : "Watch closely",
        copy: `${countLabel(openIssueCount, "open issue")} could affect satisfaction.`,
        tone: "attention",
      };
    }

    if (weakAnswerCount > 0) {
      return {
        label: weakAnswerCount > 2 ? "Mixed" : "Mostly healthy",
        copy: `${countLabel(weakAnswerCount, "answer")} still need work.`,
        tone: weakAnswerCount > 2 ? "attention" : "caution",
      };
    }

    if (conversationsToday > 0 || customersHelpedToday > 0) {
      return {
        label: "Healthy",
        copy: "No active complaint or service-quality warning is standing out.",
        tone: "healthy",
      };
    }

    return {
      label: "No signal yet",
      copy: "This becomes more useful once live conversations start today.",
      tone: "muted",
    };
  })();
  const priorityCards = [];
  const addPriority = (priority) => {
    if (priorityCards.length >= 4 || !priority) {
      return;
    }

    priorityCards.push(priority);
  };

  if (openIssueCount > 0) {
    addPriority({
      tone: "danger",
      title: `${countLabel(openIssueCount, "open issue")} ${openIssueCount === 1 ? "needs" : "need"} attention`,
      why: "Fast follow-up helps protect customer satisfaction and keep one bad experience from becoming a lost customer.",
      action: { type: "section", value: "contacts", label: "Review customers" },
    });
  }

  if (attentionCount > 0) {
    addPriority({
      tone: "brand",
      title: `${countLabel(attentionCount, "customer conversation")} still ${attentionCount === 1 ? "needs" : "need"} attention`,
      why: "This is the clearest place to save time today: answer what matters, then move on.",
      action: { type: "section", value: "contacts", label: "Open customers" },
    });
  }

  if (weakAnswerCount > 0) {
    addPriority({
      tone: "warning",
      title: topQuestion
        ? `Answers around "${topQuestion}" need work`
        : `${countLabel(weakAnswerCount, "answer")} may be causing friction`,
      why: "Clearer answers reduce repeat questions, speed up support, and make Vonza feel more trustworthy.",
      action: { type: "section", value: "analytics", label: "Improve answers" },
    });
  }

  if (leadsNeedingAction > 0) {
    addPriority({
      tone: "brand",
      title: `${countLabel(leadsNeedingAction, "likely customer")} still ${leadsNeedingAction === 1 ? "needs" : "need"} a next step`,
      why: "These customers already showed intent. A faster follow-up can stop warm demand from cooling off.",
      action: { type: "section", value: "contacts", label: "Follow up" },
    });
  }

  if ((!setup.knowledgeReady || setup.knowledgeLimited) && priorityCards.length < 4) {
    addPriority({
      tone: "slate",
      title: "Vonza needs stronger support context",
      why: "Better website knowledge improves answer quality without adding complexity for the owner.",
      action: { type: "import", label: "Refresh knowledge" },
    });
  }

  if (!isInstallSeen(overview.installStatus) && priorityCards.length < 4) {
    addPriority({
      tone: "slate",
      title: "Finish the live launch",
      why: "Home becomes much more useful once Vonza sees real customer conversations from the live site.",
      action: { type: "focus", value: "install", label: "Open install" },
    });
  }

  if (priorityCards.length < 2 && topQuestion) {
    addPriority({
      tone: "slate",
      title: `Customers keep asking about "${topQuestion}"`,
      why: "A stronger answer here can improve support speed and reduce repeat clarification questions.",
      action: { type: "section", value: "analytics", label: "See question theme" },
    });
  }

  if (priorityCards.length < 2) {
    addPriority({
      tone: "slate",
      title: !setup.knowledgeReady || setup.knowledgeLimited
        ? "One more pass will make answers stronger"
        : "Keep Home calm by tightening one service detail",
      why: !setup.knowledgeReady || setup.knowledgeLimited
        ? "A fresher knowledge import is still one of the simplest ways to improve customer answers."
        : "A small review now can prevent avoidable support friction later in the day.",
      action: overview.primaryAction || { type: "section", value: "analytics", label: "Review signals" },
    });
  }

  if (!priorityCards.length) {
    addPriority({
      tone: "healthy",
      title: "No urgent customer-service issue is standing out",
      why: "Home looks calm right now, so the best next move is keeping answer quality high while live usage grows.",
      action: overview.primaryAction || { type: "section", value: "analytics", label: "Review signals" },
    });
  }

  const primaryHomeAction = priorityCards[0]?.action || overview.primaryAction || { type: "section", value: "contacts", label: "Open customers" };
  const summarySentence = conversationsToday || customersHelpedToday || openIssueCount
    ? `Today Vonza handled ${countLabel(conversationsToday, "conversation")}, helped ${countLabel(customersHelpedToday, "customer")}, and flagged ${countLabel(openIssueCount, "issue")} that still need attention.`
    : "Home is ready. As soon as customers start using Vonza today, this page will highlight what matters first.";
  const dailyStats = [
    {
      label: "Conversations today",
      value: String(conversationsToday),
      copy: conversationsToday > 0 ? "Live customer messages handled today." : "No conversations recorded yet today.",
      tone: "neutral",
    },
    {
      label: "Customers helped today",
      value: String(customersHelpedToday),
      copy: customersHelpedToday > 0 ? "Customers Vonza actively helped today." : "No helped-customer signal yet today.",
      tone: "positive",
    },
    {
      label: "Open issues",
      value: String(openIssueCount),
      copy: openIssueCount > 0 ? "Complaints or service issues still needing attention." : "No active service issue signal is standing out.",
      tone: openIssueCount > 0 ? "attention" : "positive",
    },
    {
      label: "Customer satisfaction",
      value: serviceHealth.label,
      copy: serviceHealth.copy,
      tone: serviceHealth.tone,
    },
  ];
  const recentWinItems = (() => {
    const items = [];

    if (Number(today.complaintResolutions || 0) > 0) {
      items.push({
        title: `${countLabel(Number(today.complaintResolutions || 0), "complaint")} resolved`,
        copy: "A customer issue was closed instead of lingering.",
        meta: "Today",
      });
    }

    if (Number(today.followUpReplies || 0) > 0) {
      items.push({
        title: `${countLabel(Number(today.followUpReplies || 0), "customer")} replied after follow-up`,
        copy: "Vonza kept the conversation moving after the first contact.",
        meta: "Today",
      });
    }

    if (customersHelpedToday > 0) {
      items.push({
        title: `${countLabel(customersHelpedToday, "customer")} got help today`,
        copy: "Real customer questions were handled without needing a deep dashboard review.",
        meta: "Today",
      });
    }

    if (Number(today.bookingsConfirmed || 0) > 0) {
      items.push({
        title: `${countLabel(Number(today.bookingsConfirmed || 0), "booking")} confirmed`,
        copy: "A customer reached a clear next step today.",
        meta: "Today",
      });
    }

    if (Number(today.quoteRequests || 0) > 0) {
      items.push({
        title: `${countLabel(Number(today.quoteRequests || 0), "quote request")} captured`,
        copy: "A high-intent customer moved forward instead of dropping off.",
        meta: "Today",
      });
    }

    if (items.length) {
      return items.slice(0, 4);
    }

    if (Array.isArray(today.recentSuccessfulOutcomes) && today.recentSuccessfulOutcomes.length) {
      return today.recentSuccessfulOutcomes.slice(0, 4).map((outcome) => ({
        title: getOutcomeTypeLabel(outcome.outcomeType),
        copy: trimText(outcome.sourceLabel || outcome.relatedIntentType || outcome.pageUrl || "Recent customer outcome"),
        meta: outcome.occurredAt ? formatSeenAt(outcome.occurredAt) : "Recent",
      }));
    }

    return recentWins.slice(0, 4).map((contact) => ({
      title: trimText(contact.latestOutcome?.label) || "Customer helped",
      copy: trimText(contact.name || contact.bestIdentifier || "Recent customer"),
      meta: contact.latestOutcome?.occurredAt ? formatSeenAt(contact.latestOutcome.occurredAt) : "Recent",
    }));
  })();
  const improvementRecommendation = (() => {
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
        copy: "More customers are showing intent than sharing contact details, so the handoff path may still be too soft.",
        action: { type: "section", value: "customize", label: "Open Front Desk" },
      };
    }

    return {
      title: "Keep answers short and decisive",
      copy: "Home looks healthy. Review one recent question and tighten wording anywhere it feels vague.",
      action: { type: "section", value: "analytics", label: "Review signals" },
    };
  })();

  return `
    <section class="workspace-page workspace-page-overview" data-shell-section="overview">
      ${buildPageHeader({
        title: "Home",
        copy: "Your AI customer service snapshot for today",
        actionsMarkup: `
          <button class="ghost-button" type="button" data-refresh-operator data-force-sync="true">Refresh</button>
          ${renderHomeAction(primaryHomeAction, { primary: true, labelOverride: "Start next step" })}
        `,
      })}
      <div class="workspace-page-body">
        <div class="workspace-section-stack home-surface">
          <section class="home-daily-banner">
            <div class="home-daily-banner-copy">
              <p class="home-daily-banner-kicker">Today</p>
              <h2 class="home-daily-banner-title">${escapeHtml(summarySentence)}</h2>
            </div>
            <div class="home-daily-banner-actions">
              ${renderHomeAction(primaryHomeAction, { labelOverride: primaryHomeAction.label || "See next step" })}
            </div>
          </section>

          <div class="home-daily-strip">
            ${dailyStats.map((stat) => `
              <article class="home-daily-card home-daily-card-${escapeHtml(stat.tone)}">
                <p class="home-daily-card-label">${escapeHtml(stat.label)}</p>
                <strong class="home-daily-card-value">${escapeHtml(stat.value)}</strong>
                <p class="home-daily-card-copy">${escapeHtml(stat.copy)}</p>
              </article>
            `).join("")}
          </div>

          <div class="home-command-grid">
            <section class="workspace-card-soft home-priority-panel">
              <div class="workspace-panel-header">
                <div>
                  <p class="studio-kicker">AI priorities</p>
                  <h3 class="workspace-panel-title">What matters most right now</h3>
                  <p class="workspace-panel-copy">The shortest path to protecting customer satisfaction, saving time, and keeping warm demand from slipping away.</p>
                </div>
              </div>
              <div class="home-priority-list">
                ${priorityCards.map((priority) => `
                  <article class="home-priority-card home-priority-card-${escapeHtml(priority.tone || "slate")}">
                    <div class="home-priority-copy">
                      <h4 class="home-priority-title">${escapeHtml(priority.title)}</h4>
                      <p class="home-priority-why">${escapeHtml(priority.why)}</p>
                    </div>
                    <div class="home-priority-action">
                      ${renderHomeAction(priority.action, { primary: true })}
                    </div>
                  </article>
                `).join("")}
              </div>
            </section>

            <div class="home-side-stack">
              <section class="workspace-card-soft home-mini-panel">
                <div class="workspace-panel-header">
                  <div>
                    <p class="studio-kicker">Recent wins</p>
                    <h3 class="workspace-panel-title">Saved customers and good moments</h3>
                    <p class="workspace-panel-copy">Small proof that Vonza is helping today without making you dig through analytics.</p>
                  </div>
                </div>
                ${recentWinItems.length ? `
                  <div class="home-win-list">
                    ${recentWinItems.map((item) => `
                      <div class="home-win-row">
                        <span class="home-win-dot" aria-hidden="true"></span>
                        <div>
                          <strong>${escapeHtml(item.title)}</strong>
                          <p>${escapeHtml(item.copy)}</p>
                          <span>${escapeHtml(item.meta)}</span>
                        </div>
                      </div>
                    `).join("")}
                  </div>
                ` : `<div class="placeholder-card">Recent customer wins will show up here as soon as Vonza can point to a real helped moment or resolved issue.</div>`}
              </section>

              <section class="workspace-card-soft home-improve-panel">
                <div class="workspace-panel-header">
                  <div>
                    <p class="studio-kicker">Improve Vonza</p>
                    <h3 class="workspace-panel-title">Improve service</h3>
                    <p class="workspace-panel-copy">${escapeHtml(improvementRecommendation.title)}</p>
                  </div>
                </div>
                <p class="home-improve-copy">${escapeHtml(improvementRecommendation.copy)}</p>
                <div class="home-improve-actions">
                  ${renderHomeAction(improvementRecommendation.action, { primary: true })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildBusinessContextSetupPanel(operatorWorkspace = createEmptyOperatorWorkspace()) {
  const profile = getBusinessProfileViewModel(operatorWorkspace);
  const channelSet = new Set(profile.approvedContactChannels || []);
  const approvalOptions = [
    { value: "owner_required", label: "Owner approval required" },
    { value: "draft_only", label: "Draft only" },
    { value: "recommend_only", label: "Recommendation only" },
  ];

  return `
    <form data-settings-form data-form-kind="business-context" class="workspace-card-soft settings-form-shell">
      <div class="workspace-panel-header" id="business-context-setup">
        <div>
          <p class="studio-kicker">Business context</p>
          <h3 class="workspace-panel-title">Business context setup</h3>
          <p class="workspace-panel-copy">Give Today and Copilot the real operator context they need: what you sell, how pricing works, what policies matter, where you serve, when you operate, and which approval-first paths are allowed.</p>
        </div>
        <div class="workspace-badge-row">
          <span class="${getBadgeClass(profile.readiness?.missingCount ? "Limited" : "Ready")}">${profile.readiness?.missingCount ? "Needs owner review" : "Context ready"}</span>
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
          <p class="studio-group-copy">Keep this concise and operator-facing. This is not website copy; it is the working context Copilot should trust when it prepares approval-first proposals.</p>
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

        <section class="studio-group">
          <h3 class="studio-group-title">Approved owner paths</h3>
          <p class="studio-group-copy">Copilot should stay approval-first. Use these settings to spell out which channels and proposal modes are allowed before any real deterministic workflow is used.</p>
          <div class="form-grid two-col">
            <div class="field">
              <label>Approved contact channels</label>
              <div class="contact-filter-group" style="margin-top:8px;">
                ${[
                  { value: "website_chat", label: "Website chat" },
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone" },
                  { value: "sms", label: "SMS / text" },
                ].map((channel) => `
                  <label class="pill" style="display:inline-flex;gap:8px;align-items:center;">
                    <input
                      type="checkbox"
                      name="approved_contact_channels"
                      value="${escapeHtml(channel.value)}"
                      ${channelSet.has(channel.value) ? "checked" : ""}
                    >
                    <span>${escapeHtml(channel.label)}</span>
                  </label>
                `).join("")}
              </div>
              <p class="field-help">These do not send anything automatically. They define which owner-approved channels Copilot may prepare drafts for.</p>
            </div>
            <div class="field">
              <label>Approval preferences</label>
              <div class="overview-list">
                ${[
                  { name: "approval_follow_up_drafts", label: "Follow-up drafts", value: profile.approvalPreferences.followUpDrafts },
                  { name: "approval_contact_next_steps", label: "Contact next-step recommendations", value: profile.approvalPreferences.contactNextSteps },
                  { name: "approval_task_recommendations", label: "Task recommendations", value: profile.approvalPreferences.taskRecommendations },
                  { name: "approval_outcome_recommendations", label: "Outcome review suggestions", value: profile.approvalPreferences.outcomeRecommendations },
                  { name: "approval_profile_changes", label: "Profile changes", value: profile.approvalPreferences.profileChanges },
                ].map((entry) => `
                  <div class="overview-list-item">
                    <p class="overview-list-title">${escapeHtml(entry.label)}</p>
                    <select name="${escapeHtml(entry.name)}">
                      ${approvalOptions.map((option) => `
                        <option value="${escapeHtml(option.value)}" ${entry.value === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
                      `).join("")}
                    </select>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </section>

        <div class="studio-save-row">
          <button class="primary-button" type="submit">Save business context</button>
          <span data-save-state class="save-state">No changes yet.</span>
        </div>
      </div>
    </form>
  `;
}

function buildFrontDeskSettingsForm(agent, setup) {
  const knowledgeActionLabel = setup.knowledgeState === "limited" ? "Retry website import" : "Import website knowledge";
  const behaviorSummary = buildBehaviorSummary(agent.tone, agent.systemPrompt);
  const manualOutcomeVisible = isCapabilityExplicitlyVisible("manual_outcome_marks");
  const advancedGuidanceVisible = isCapabilityExplicitlyVisible("advanced_guidance");

  return `
    <form data-settings-form data-form-kind="customize" class="settings-form-shell">
      <div class="settings-section-intro">
        <p class="studio-kicker">Front Desk</p>
        <h2 class="settings-section-title">Front desk behavior</h2>
        <p class="settings-section-copy">Adjust how the customer-facing front desk sounds, routes, and learns from the website. This page keeps live behavior settings grouped together instead of burying them inside the workflow shell.</p>
      </div>
      <div class="studio-layout">
        <div class="studio-groups">
          <section class="studio-group">
            <p class="studio-kicker">Identity and welcome</p>
            <h3 class="studio-group-title">Set the first impression customers meet.</h3>
            <p class="studio-group-copy">Keep this customer-facing. The goal is a front desk that feels native to the business from the first interaction.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-name">Assistant name</label>
                <input id="assistant-name" name="assistant_name" type="text" value="${escapeHtml(agent.assistantName || agent.name)}">
              </div>
              <div class="field">
                <label for="assistant-tone">Conversation tone</label>
                <select id="assistant-tone" name="tone">
                  <option value="friendly" ${agent.tone === "friendly" ? "selected" : ""}>friendly</option>
                  <option value="professional" ${agent.tone === "professional" ? "selected" : ""}>professional</option>
                  <option value="sales" ${agent.tone === "sales" ? "selected" : ""}>sales</option>
                  <option value="support" ${agent.tone === "support" ? "selected" : ""}>support</option>
                </select>
              </div>
              <div class="field">
                <label for="assistant-button-label">Launcher text</label>
                <input id="assistant-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}">
              </div>
              <div class="field">
                <label for="assistant-website">Website URL</label>
                <input id="assistant-website" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}">
                <p class="field-help">This should be the main website Vonza learns from and represents.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-welcome">Welcome message</label>
                <textarea id="assistant-welcome" name="welcome_message">${escapeHtml(agent.welcomeMessage || "")}</textarea>
              </div>
            </div>
          </section>

          <section class="studio-group">
            <h3 class="studio-group-title">Routing and handoff</h3>
            <p class="studio-group-copy">Tell Vonza where high-intent visitors should go when the right next step is to book, request a quote, contact the business, or buy now.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-primary-cta-mode">Primary CTA mode</label>
                <select id="assistant-primary-cta-mode" name="primary_cta_mode">
                  <option value="contact" ${trimText(agent.primaryCtaMode || "contact") === "contact" ? "selected" : ""}>contact</option>
                  <option value="booking" ${trimText(agent.primaryCtaMode) === "booking" ? "selected" : ""}>booking</option>
                  <option value="quote" ${trimText(agent.primaryCtaMode) === "quote" ? "selected" : ""}>quote</option>
                  <option value="checkout" ${trimText(agent.primaryCtaMode) === "checkout" ? "selected" : ""}>checkout</option>
                  <option value="capture" ${trimText(agent.primaryCtaMode) === "capture" ? "selected" : ""}>capture</option>
                  <option value="chat" ${trimText(agent.primaryCtaMode) === "chat" ? "selected" : ""}>chat</option>
                </select>
                <p class="field-help">This is the default route Vonza uses when an intent-specific destination is missing.</p>
              </div>
              <div class="field">
                <label for="assistant-fallback-cta-mode">Fallback CTA mode</label>
                <select id="assistant-fallback-cta-mode" name="fallback_cta_mode">
                  <option value="capture" ${trimText(agent.fallbackCtaMode || "capture") === "capture" ? "selected" : ""}>capture</option>
                  <option value="contact" ${trimText(agent.fallbackCtaMode) === "contact" ? "selected" : ""}>contact</option>
                  <option value="booking" ${trimText(agent.fallbackCtaMode) === "booking" ? "selected" : ""}>booking</option>
                  <option value="quote" ${trimText(agent.fallbackCtaMode) === "quote" ? "selected" : ""}>quote</option>
                  <option value="checkout" ${trimText(agent.fallbackCtaMode) === "checkout" ? "selected" : ""}>checkout</option>
                  <option value="chat" ${trimText(agent.fallbackCtaMode) === "chat" ? "selected" : ""}>chat</option>
                </select>
                <p class="field-help">If a direct route is missing, Vonza follows this fallback instead of guessing.</p>
              </div>
              <div class="field">
                <label for="assistant-booking-url">Booking URL</label>
                <input id="assistant-booking-url" name="booking_url" type="text" value="${escapeHtml(agent.bookingUrl || "")}" placeholder="https://example.com/book">
              </div>
              <div class="field">
                <label for="assistant-quote-url">Quote URL</label>
                <input id="assistant-quote-url" name="quote_url" type="text" value="${escapeHtml(agent.quoteUrl || "")}" placeholder="https://example.com/quote">
              </div>
              <div class="field">
                <label for="assistant-checkout-url">Checkout URL</label>
                <input id="assistant-checkout-url" name="checkout_url" type="text" value="${escapeHtml(agent.checkoutUrl || "")}" placeholder="https://example.com/checkout">
              </div>
              <div class="field">
                <label for="assistant-contact-email">Contact email</label>
                <input id="assistant-contact-email" name="contact_email" type="email" value="${escapeHtml(agent.contactEmail || "")}" placeholder="team@example.com">
              </div>
              <div class="field">
                <label for="assistant-contact-phone">Contact phone</label>
                <input id="assistant-contact-phone" name="contact_phone" type="tel" value="${escapeHtml(agent.contactPhone || "")}" placeholder="+1 555 555 5555">
              </div>
              <div class="field">
                <label for="assistant-allowed-domains">Allowed domains</label>
                <textarea id="assistant-allowed-domains" name="allowed_domains" placeholder="example.com&#10;www.example.com">${escapeHtml((agent.allowedDomains || []).join("\n"))}</textarea>
                <p class="field-help">One domain per line. Keep it limited to the real sites where the widget should run.</p>
              </div>
              <div class="field">
                <label for="assistant-booking-start-url">Booking start URL</label>
                <input id="assistant-booking-start-url" name="booking_start_url" type="text" value="${escapeHtml(agent.bookingStartUrl || "")}" placeholder="https://example.com/book/start">
              </div>
              <div class="field">
                <label for="assistant-quote-start-url">Quote start URL</label>
                <input id="assistant-quote-start-url" name="quote_start_url" type="text" value="${escapeHtml(agent.quoteStartUrl || "")}" placeholder="https://example.com/quote/start">
              </div>
              <div class="field">
                <label for="assistant-booking-success-url">Booking success URL</label>
                <input id="assistant-booking-success-url" name="booking_success_url" type="text" value="${escapeHtml(agent.bookingSuccessUrl || "")}" placeholder="https://example.com/book/confirmed">
              </div>
              <div class="field">
                <label for="assistant-quote-success-url">Quote success URL</label>
                <input id="assistant-quote-success-url" name="quote_success_url" type="text" value="${escapeHtml(agent.quoteSuccessUrl || "")}" placeholder="https://example.com/quote/thanks">
              </div>
              <div class="field">
                <label for="assistant-checkout-success-url">Checkout success URL</label>
                <input id="assistant-checkout-success-url" name="checkout_success_url" type="text" value="${escapeHtml(agent.checkoutSuccessUrl || "")}" placeholder="https://example.com/order/complete">
              </div>
              <div class="field">
                <label for="assistant-success-url-match-mode">Success URL match mode</label>
                <select id="assistant-success-url-match-mode" name="success_url_match_mode">
                  <option value="path_prefix" ${trimText(agent.successUrlMatchMode || "path_prefix") === "path_prefix" ? "selected" : ""}>path prefix</option>
                  <option value="exact" ${trimText(agent.successUrlMatchMode) === "exact" ? "selected" : ""}>exact</option>
                </select>
              </div>
              ${manualOutcomeVisible ? `
                <div class="field">
                  <label for="assistant-manual-outcome-mode">Manual outcome mode</label>
                  <select id="assistant-manual-outcome-mode" name="manual_outcome_mode">
                    <option value="false" ${agent.manualOutcomeMode === true ? "" : "selected"}>automatic only</option>
                    <option value="true" ${agent.manualOutcomeMode === true ? "selected" : ""}>allow manual mark fallback</option>
                  </select>
                  <p class="field-help">Turn this on only when the real success page cannot be instrumented and the owner needs a manual fallback.</p>
                </div>
              ` : ""}
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-business-hours-note">Availability note</label>
                <textarea id="assistant-business-hours-note" name="business_hours_note" placeholder="Open Mon-Fri, 9am-5pm. Same-day callbacks usually happen before 4pm.">${escapeHtml(agent.businessHoursNote || "")}</textarea>
                <p class="field-help">Optional. This appears in the handoff card so the next step feels concrete and trustworthy.</p>
              </div>
              <div class="field">
                <label for="assistant-success-snippet">Optional success ping snippet</label>
                <textarea id="assistant-success-snippet" readonly>fetch("${getPublicAppUrl()}/install/outcomes/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ install_id: "${escapeHtml(agent.installId || "")}", cta_event_id: new URLSearchParams(window.location.search).get("vz_cta_event_id"), page_url: window.location.href }) });</textarea>
                <p class="field-help">Use this on a thank-you page only if Vonza cannot load there. The tracked redirect adds &#96;vz_cta_event_id&#96; automatically.</p>
              </div>
            </div>
          </section>

          <section class="studio-group">
            <h3 class="studio-group-title">Website knowledge and brand</h3>
            <p class="studio-group-copy">Keep the front desk aligned with the brand your customers already know, and rerun import when the website changes.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-primary-color">Primary color</label>
                <input id="assistant-primary-color" name="primary_color" type="color" value="${escapeHtml(agent.primaryColor || "#14b8a6")}">
              </div>
              <div class="field">
                <label for="assistant-secondary-color">Secondary color</label>
                <input id="assistant-secondary-color" name="secondary_color" type="color" value="${escapeHtml(agent.secondaryColor || "#0f766e")}">
              </div>
            </div>
            <div class="inline-actions">
              <button class="ghost-button" type="button" data-action="import-knowledge">${knowledgeActionLabel}</button>
            </div>
            <p class="section-note">${escapeHtml(setup.knowledgeDescription)}</p>
          </section>

          ${advancedGuidanceVisible ? `
            <section class="studio-group secondary">
              <h3 class="studio-group-title">Advanced guidance</h3>
              <p class="studio-group-copy">Optional guidance for emphasis, tone, and edge cases. Keep it focused on how the front desk should represent the business.</p>
              <div class="form-grid">
                <div class="field">
                  <label for="assistant-instructions">Advanced guidance</label>
                  <textarea id="assistant-instructions" name="system_prompt">${escapeHtml(agent.systemPrompt || "")}</textarea>
                </div>
              </div>
            </section>
          ` : ""}

          <div class="studio-save-row">
            <button class="primary-button" type="submit">Save front desk settings</button>
            <span data-save-state class="save-state">No changes yet.</span>
          </div>
        </div>

        <aside class="studio-summary">
          <p class="studio-summary-label">Live summary</p>
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
          <div class="overview-list">
            <div class="overview-list-item">
              <p class="overview-list-title">Current website</p>
              <p class="overview-list-copy">${escapeHtml(agent.websiteUrl || "Add your website to import real business knowledge.")}</p>
            </div>
            <div class="overview-list-item">
              <p class="overview-list-title">Install status</p>
              <p class="overview-list-copy">${escapeHtml(agent.installStatus?.label || "Not installed yet")}</p>
            </div>
            <div class="overview-list-item">
              <p id="behavior-summary-title" class="overview-list-title">${escapeHtml(behaviorSummary.title)}</p>
              <p id="behavior-summary-copy" class="overview-list-copy">${escapeHtml(behaviorSummary.copy)}</p>
            </div>
          </div>
        </aside>
      </div>
    </form>
  `;
}

function buildConnectedToolsSettingsPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const accounts = operatorWorkspace.connectedAccounts || [];
  const primaryAccount = accounts[0] || null;
  const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);
  const canWriteCalendar = googleCapabilities.calendarWrite === true;
  const calendarMode = primaryAccount?.status === "connected"
    ? canWriteCalendar
      ? "Calendar can prepare approval-first drafts."
      : "Calendar is connected in read-only mode."
    : status.googleConfigReady
      ? "Google beta is available but not connected yet."
      : "This workspace is running without the optional Google-connected extensions.";

  return `
    <div class="settings-panel-stack">
      <section class="workspace-card-soft">
        <div class="settings-section-intro">
          <p class="studio-kicker">Connected tools</p>
          <h2 class="settings-section-title">Connected tools</h2>
          <p class="settings-section-copy">Keep optional extensions clearly separated from the stable core. If something is not connected or not self-serve yet, Vonza should say that plainly.</p>
        </div>
        <div class="settings-summary-grid">
          <article class="settings-summary-card">
            <p class="overview-label">Google workspace</p>
            <h3 class="settings-summary-title">${escapeHtml(primaryAccount?.status === "connected" ? "Connected" : status.googleConfigReady ? "Available" : "Unavailable")}</h3>
            <p class="settings-summary-copy">${escapeHtml(primaryAccount?.accountEmail || "No Google account connected yet.")}</p>
            <div class="inline-actions">
              <button class="${primaryAccount?.status === "connected" ? "ghost-button" : "primary-button"}" type="button" data-google-connect data-google-connect-mode="email_read_only" data-google-connect-status="Preparing Gmail read-only connection..." data-google-connect-error="We couldn't start the Gmail inbox connection." ${status.googleConfigReady ? "" : "disabled"}>${primaryAccount?.status === "connected" ? "Reconnect Gmail" : "Connect Gmail"}</button>
              <button class="ghost-button" type="button" data-refresh-operator data-force-sync="true" ${primaryAccount?.status === "connected" ? "" : "disabled"}>Refresh sync</button>
            </div>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Calendar mode</p>
            <h3 class="settings-summary-title">${escapeHtml(canWriteCalendar ? "Approval-first drafts" : primaryAccount?.status === "connected" ? "Read-only mode" : "Not connected")}</h3>
            <p class="settings-summary-copy">${escapeHtml(calendarMode)}</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Email mode</p>
            <h3 class="settings-summary-title">${escapeHtml(googleCapabilities.gmailRead ? "Email connected" : "Email not connected")}</h3>
            <p class="settings-summary-copy">${escapeHtml(googleCapabilities.gmailRead
              ? "Vonza can read, classify, and connect support email to customers when it can. It does not send, archive, or silently change the mailbox."
              : "Email stays in read-only setup mode until Gmail access is connected. Automations stay honest about the missing connection.")}</p>
          </article>
        </div>
      </section>

      <section class="workspace-card-soft">
        <h3 class="studio-group-title">What each extension adds</h3>
        <p class="studio-group-copy">Connected tools extend the operator workspace. They do not replace the stable core around Today, Contacts, Front Desk, and Analytics.</p>
        <div class="settings-summary-grid">
          <article class="settings-summary-card">
            <p class="overview-label">Email</p>
            <h3 class="settings-summary-title">Read-only customer inbox</h3>
            <p class="settings-summary-copy">Recent Gmail threads, complaint signals, sales intent, billing questions, and low-priority conversations show up here once the inbox connection is ready.</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Calendar</p>
            <h3 class="settings-summary-title">Schedule context</h3>
            <p class="settings-summary-copy">Vonza can surface today’s schedule, follow-up gaps, and event drafts without silently mutating the owner calendar.</p>
          </article>
          <article class="settings-summary-card">
            <p class="overview-label">Automations</p>
            <h3 class="settings-summary-title">Draft-first workflows</h3>
            <p class="settings-summary-copy">Campaigns, follow-ups, and operator tasks stay visible as tracked draft or approval objects instead of pretending to run autonomously.</p>
          </article>
        </div>
      </section>
    </div>
  `;
}

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

function buildSettingsPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
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

  return settingsShell.buildSettingsPanel({
    agent,
    setup,
    operatorWorkspace,
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
  });
}

function buildFrontDeskPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const installStatus = getDefaultInstallStatus(agent);
  const behaviorSummary = buildBehaviorSummary(agent.tone, agent.systemPrompt);
  const activeFrontDeskSection = getActiveFrontDeskSection();
  const hasPreview = Boolean(trimText(agent.publicAgentKey));
  const frontDeskSections = [
    { key: "overview", label: "Overview" },
    { key: "preview", label: "Preview" },
    { key: "context", label: "Website / Context" },
    { key: "launch", label: "Install / Launch" },
  ];
  const readinessItems = [
    {
      title: "Front-desk basics",
      copy: setup.personalityReady
        ? "Name, welcome message, and tone are in place."
        : "Add the business name, welcome message, or tone so the Front Desk feels polished from the first hello.",
      tone: setup.personalityReady ? "Ready" : "Limited",
      actionMarkup: `<button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Edit setup</button>`,
    },
    {
      title: "Website knowledge",
      copy: setup.knowledgeDescription,
      tone: setup.knowledgeReady ? "Ready" : setup.knowledgeLimited ? "Limited" : "Pending",
      actionMarkup: `<button class="ghost-button" type="button" data-frontdesk-open="context">Review knowledge</button>`,
    },
    {
      title: "Live install",
      copy: installStatus.label || "Not installed yet",
      tone: isInstallSeen(installStatus)
        ? "Ready"
        : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
          ? "Needs attention"
        : installStatus.state === "installed_unseen"
            ? "Limited"
            : "Pending",
      actionMarkup: `<button class="ghost-button" type="button" data-frontdesk-open="launch">Review launch</button>`,
    },
  ];
  const businessReadiness = operatorWorkspace.businessProfile?.readiness || createEmptyOperatorWorkspace().businessProfile.readiness;
  const overviewPrimaryAction = hasPreview
    ? `<a class="primary-button" data-action="open-preview" href="${buildWidgetUrl(agent.publicAgentKey)}" target="_blank" rel="noreferrer">Try front desk</a>`
    : `<button class="primary-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Open Front Desk settings</button>`;
  const businessContextSummary = businessReadiness.summary || "Business context readiness will appear here once the owner starts reviewing the profile.";
  const businessContextStatus = Number(businessReadiness.missingCount || 0) > 0
    ? `${businessReadiness.missingCount} area${businessReadiness.missingCount === 1 ? "" : "s"} could use a quick review before the Front Desk feels fully grounded.`
    : "Business context is in a strong place for customer-facing conversations.";
  const launchHeadline = setup.isReady ? "You’re close to going live." : "A few essentials still need attention before you publish.";
  const launchCopy = setup.isReady
    ? "Confirm the experience, move into Install, and make sure the live site is sending real traffic back into Vonza."
    : "This space keeps the launch path clear by showing what still needs attention before Install and verification.";
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

  return `
    <section class="workspace-page" data-shell-section="customize" hidden>
      ${buildPageHeader({
        eyebrow: "Core workflow",
        title: "Front Desk",
        copy: "Shape the customer-facing experience in one place: review readiness, test the conversation, improve website grounding, and move confidently toward launch.",
        actionsMarkup: pageHeaderActions,
      })}
      ${buildPageToolbar({
        filtersMarkup: buildLocalSectionNav(frontDeskSections, { attribute: "data-frontdesk-target", activeKey: activeFrontDeskSection }),
      })}
      <div class="workspace-page-body">
        <section class="frontdesk-workspace-panel frontdesk-main-panel" data-frontdesk-section="overview" ${activeFrontDeskSection === "overview" ? "" : "hidden"}>
          <div class="frontdesk-section-intro">
            <div>
              <p class="studio-kicker">Overview</p>
              <h2 class="frontdesk-section-title">Keep the Front Desk focused on value, clarity, and launch readiness.</h2>
              <p class="frontdesk-section-copy">This overview keeps the essentials in view: what already looks strong, what is worth improving, and where to go next.</p>
            </div>
            <div class="frontdesk-section-actions">
              ${overviewPrimaryAction}
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-readiness-list">
            ${readinessItems.map((item) => `
              <article class="frontdesk-readiness-item">
                <div class="frontdesk-readiness-head">
                  <div>
                    <p class="frontdesk-detail-kicker">${escapeHtml(item.title)}</p>
                    <h3 class="frontdesk-detail-title">${escapeHtml(item.tone === "Ready" ? "Looking good" : item.tone === "Limited" ? "Worth a quick pass" : item.tone === "Needs attention" ? "Needs attention" : "Getting started")}</h3>
                  </div>
                  <span class="${getBadgeClass(item.tone)}">${escapeHtml(item.tone)}</span>
                </div>
                <p class="frontdesk-readiness-copy">${escapeHtml(item.copy)}</p>
                <div class="frontdesk-readiness-actions">
                  ${item.actionMarkup}
                </div>
              </article>
            `).join("")}
          </div>
          <div class="frontdesk-support-note">
            <p class="frontdesk-support-title">What stays out of the way</p>
            <p class="frontdesk-support-copy">Deeper configuration lives in Settings. Front Desk stays focused on readiness, preview, website grounding, and the path to launch.</p>
          </div>
        </section>

        <section class="frontdesk-workspace-panel frontdesk-main-panel frontdesk-preview-shell" data-frontdesk-section="preview" ${activeFrontDeskSection === "preview" ? "" : "hidden"}>
          ${buildPreviewSection(agent, setup)}
        </section>
        <section class="frontdesk-workspace-panel frontdesk-main-panel" data-frontdesk-section="context" ${activeFrontDeskSection === "context" ? "" : "hidden"}>
          <div class="frontdesk-section-intro">
            <div>
              <p class="studio-kicker">Website / Context</p>
              <h2 class="frontdesk-section-title">Ground the Front Desk in what your business actually does.</h2>
              <p class="frontdesk-section-copy">Keep website detail, business context, and behavior summary together so the Front Desk sounds trustworthy before it goes live.</p>
            </div>
            <div class="frontdesk-section-actions">
              <button class="primary-button" type="button" data-shell-target="settings" data-settings-target="business">Review business context</button>
              <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Edit Front Desk behavior</button>
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-detail-stack">
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Website detail</p>
              <h3 class="frontdesk-detail-title">${escapeHtml(formatKnowledgeState(setup.knowledgeState))}</h3>
              <p class="frontdesk-detail-copy">${escapeHtml(setup.knowledgeDescription)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Website</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(agent.websiteUrl || "No website configured")}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Pages learned</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(setup.knowledgePageCount ? `${setup.knowledgePageCount} page${setup.knowledgePageCount === 1 ? "" : "s"} imported` : "No pages imported yet")}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Customer impact</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(setup.knowledgeReady ? "The Front Desk is ready to answer with solid business context." : setup.knowledgeLimited ? "The Front Desk can already help, and another import should make answers stronger." : "Import your site to give the Front Desk more specific business detail.")}</strong>
                </div>
              </div>
            </section>
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Front Desk behavior</p>
              <h3 class="frontdesk-detail-title">${escapeHtml(behaviorSummary.title)}</h3>
              <p class="frontdesk-detail-copy">${escapeHtml(behaviorSummary.copy)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Launcher</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(agent.buttonLabel || "Chat")}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Primary route</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(trimText(agent.primaryCtaMode || "contact"))}</strong>
                </div>
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Advanced guidance</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(trimText(agent.systemPrompt) ? "Added" : "Not added yet")}</strong>
                </div>
              </div>
            </section>
            <section class="frontdesk-detail-block">
              <p class="frontdesk-detail-kicker">Business context</p>
              <h3 class="frontdesk-detail-title">Business grounding</h3>
              <p class="frontdesk-detail-copy">${escapeHtml(businessContextSummary)}</p>
              <div class="frontdesk-detail-list">
                <div class="frontdesk-detail-row">
                  <span class="frontdesk-detail-row-label">Review progress</span>
                  <strong class="frontdesk-detail-row-value">${escapeHtml(businessContextStatus)}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>
        <section class="frontdesk-workspace-panel frontdesk-main-panel" data-frontdesk-section="launch" ${activeFrontDeskSection === "launch" ? "" : "hidden"}>
          <div class="frontdesk-section-intro">
            <div>
              <p class="studio-kicker">Install / Launch</p>
              <h2 class="frontdesk-section-title">${escapeHtml(launchHeadline)}</h2>
              <p class="frontdesk-section-copy">${escapeHtml(launchCopy)}</p>
            </div>
            <div class="frontdesk-section-actions">
              <button class="primary-button" type="button" data-shell-target="install">Open install</button>
              ${hasPreview
                ? `<button class="ghost-button" type="button" data-frontdesk-open="preview">Test preview first</button>`
                : `<button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Finish Front Desk setup</button>`}
            </div>
          </div>
          <div class="frontdesk-section-divider"></div>
          <div class="frontdesk-step-list">
            <article class="frontdesk-step">
              <div class="frontdesk-step-head">
                <span class="frontdesk-step-label">Step 1</span>
                <span class="${getBadgeClass(hasPreview ? "Ready" : "Limited")}">${escapeHtml(hasPreview ? "Ready" : "Needs setup")}</span>
              </div>
              <h3 class="frontdesk-step-title">Run a real preview conversation</h3>
              <p class="frontdesk-step-copy">${escapeHtml(hasPreview ? "Use Preview to confirm how the Front Desk answers, guides the next step, and captures lead intent before you publish it." : "Finish the Front Desk setup first so Vonza can generate a live preview for testing.")}</p>
            </article>
            <article class="frontdesk-step">
              <div class="frontdesk-step-head">
                <span class="frontdesk-step-label">Step 2</span>
                <span class="${getBadgeClass(setup.isReady ? "Ready" : "Limited")}">${escapeHtml(setup.isReady ? "Ready" : "Worth a quick pass")}</span>
              </div>
              <h3 class="frontdesk-step-title">Move into the install flow</h3>
              <p class="frontdesk-step-copy">${escapeHtml(setup.isReady ? "The core setup is strong enough to hand off into Install, where the snippet, verification, and live-domain details already belong." : "Tighten the front-desk behavior and grounding first, then use Install for the final publishing path.")}</p>
            </article>
            <article class="frontdesk-step">
              <div class="frontdesk-step-head">
                <span class="frontdesk-step-label">Step 3</span>
                <span class="${getBadgeClass(isInstallSeen(installStatus) ? "Ready" : isInstallDetected(installStatus) ? "Limited" : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed" ? "Needs attention" : "Pending")}">${escapeHtml(liveVerificationLabel)}</span>
              </div>
              <h3 class="frontdesk-step-title">${escapeHtml(installStatus.label || "Confirm the live site")}</h3>
              <p class="frontdesk-step-copy">${escapeHtml(isInstallSeen(installStatus)
                ? "Vonza is already seeing live traffic from the site. Keep Install handy for quick verification checks."
                : isInstallDetected(installStatus)
                  ? "The snippet is in place, and the next step is simply confirming the first live visit."
                  : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
                    ? "Verification needs attention before the launch can be treated as confidently live."
                    : "The site still needs the snippet and first verification pass before launch is complete.")}</p>
            </article>
          </div>
          <div class="frontdesk-support-note">
            <p class="frontdesk-support-title">Why Install still lives separately</p>
            <p class="frontdesk-support-copy">Front Desk owns the launch handoff, while the snippet, verification, and domain checks stay in the Install view where they are easier to manage.</p>
          </div>
        </section>
      </div>
    </section>
  `;
}

function buildInstallPanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const installStatus = getDefaultInstallStatus(agent);
  const actionsMarkup = [
    `<button class="primary-button" type="button" data-action="copy-install" ${trimText(agent.installId) ? "" : "disabled"}>Copy install code</button>`,
    `<button class="ghost-button" type="button" data-action="verify-install" ${trimText(agent.installId) ? "" : "disabled"}>Verify installation</button>`,
  ].join("");

  return `
    <section class="workspace-page" data-shell-section="install" hidden>
      ${buildPageHeader({
        eyebrow: "Utilities",
        title: "Install",
        copy: "Move Vonza from preview into the live website with a clear install path, verification, and honest status reporting.",
        badges: [
          { label: setup.isReady ? "Front desk ready for launch" : "Front desk still needs setup", tone: setup.isReady ? "Ready" : "Limited" },
          {
            label: installStatus.label || "Not installed yet",
            tone: isInstallSeen(installStatus)
              ? "Ready"
              : installStatus.state === "domain_mismatch" || installStatus.state === "verify_failed"
                ? "Needs attention"
                : installStatus.state === "installed_unseen"
                  ? "Limited"
                  : "Pending",
          },
        ],
        actionsMarkup,
      })}
      <div class="workspace-page-body install-page-layout">
        <section class="workspace-card-soft install-page-main">
          ${buildInstallSection(agent, { upcoming: !setup.isReady })}
        </section>
        <div class="frontdesk-side-stack">
          <section class="workspace-card-soft">
            <h3 class="studio-group-title">Before you go live</h3>
            <div class="overview-list">
              <div class="overview-list-item">
                <p class="overview-list-title">Preview confidence</p>
                <p class="overview-list-copy">${escapeHtml(trimText(agent.publicAgentKey) ? "Preview is available, so you can test the customer-facing flow before launch." : "Preview will appear as soon as the front desk has a public key.")}</p>
              </div>
              <div class="overview-list-item">
                <p class="overview-list-title">Website knowledge</p>
                <p class="overview-list-copy">${escapeHtml(setup.knowledgeDescription)}</p>
              </div>
              <div class="overview-list-item">
                <p class="overview-list-title">Allowed domains</p>
                <p class="overview-list-copy">${escapeHtml((installStatus.allowedDomains || []).length ? installStatus.allowedDomains.join(", ") : "No domains saved yet.")}</p>
              </div>
            </div>
          </section>
          <section class="workspace-card-soft">
            <h3 class="studio-group-title">After install is detected</h3>
            <p class="studio-group-copy">Today and Outcomes become more trustworthy once live page loads, customer questions, and real conversion paths start flowing through the same shell.</p>
            <div class="inline-actions">
              <button class="ghost-button" type="button" data-shell-target="overview">Open Today</button>
              <button class="ghost-button" type="button" data-shell-target="analytics">Open Analytics</button>
            </div>
          </section>
        </div>
      </div>
    </section>
  `;
}

function buildCustomizePanel(agent, setup, operatorWorkspace = createEmptyOperatorWorkspace()) {
  return buildFrontDeskPanel(agent, setup, operatorWorkspace);
}

// Workspace sections
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
              <p class="studio-group-copy">These quick starting points only adjust real current appearance settings like wording and colors. You can fine-tune everything below.</p>
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
                  <p class="field-help">Use the name you want customers to see in the widget header and first interaction.</p>
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
              <p class="section-note">More appearance controls like logo upload and richer widget variants can come later. For now, Vonza uses your real live text and colors only.</p>
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
                      <p class="brand-widget-subtitle">Your website front desk</p>
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

function buildConfigurationStudio(agent, setup) {
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
              <button class="ghost-button" type="button" data-action="import-knowledge">${knowledgeActionLabel}</button>
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

function getActivityLevel(messageCount, lastMessageAt) {
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
      return "General";
  }
}

function getIntentDescription(intent) {
  switch (intent) {
    case "contact":
      return "Visitors are trying to speak to someone, call, email, or take a direct lead step.";
    case "booking":
      return "Visitors are asking to book, schedule, reserve, or check availability.";
    case "pricing":
      return "Visitors want pricing, quote, package, or purchase clarity.";
    case "support":
      return "Visitors may have a problem, concern, or support-style need.";
    case "services":
      return "Visitors are still learning what the business offers.";
    default:
      return "Questions are broad and exploratory rather than clearly commercial yet.";
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
    intentCounts[intent] += 1;

    if (!normalizedQuestion) {
      return;
    }

    const existing = questionThemes.get(normalizedQuestion) || {
      label: content,
      count: 0,
      intent,
    };

    existing.count += 1;
    if (content.length < existing.label.length) {
      existing.label = content;
    }
    questionThemes.set(normalizedQuestion, existing);
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
      weakAnswerExamples.push(question);
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
    .map((message) => trimText(message.content || ""))
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
    persistenceAvailable: true,
    migrationRequired: false,
    followUpWorkflowAvailable: true,
    followUpWorkflowMigrationRequired: false,
    knowledgeFixWorkflowAvailable: true,
    knowledgeFixWorkflowMigrationRequired: false,
    liveConversionAvailable: true,
    liveConversionMigrationRequired: false,
    analyticsSummary: createEmptyAnalyticsSummary(),
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
      title: "Operator briefing",
      text: "Connect Google Calendar and run the first sync to turn Today into your operator command center.",
    },
    nextAction: {
      key: "connect_google",
      title: "Connect Google",
      description: "Connect Google Calendar so Today can show your schedule, recent appointments, and approval-first follow-up suggestions.",
      buttonLabel: "Connect Google",
      actionType: "connect_google",
      targetSection: "overview",
      disabled: false,
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
      dailySummary: "Connect Google Calendar to see your day, open slots, and booking opportunities here.",
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
    recentActivity: {
      level: "none",
      description: "No live activity yet",
      copy: "No live conversations have been stored yet.",
      lastActivityAt: null,
    },
    operatorSignal: {
      title: "No operator signal yet",
      copy: "There is not a strong lead, booking, pricing, or support signal yet.",
      subtle: "No weak-answer signal has been detected yet.",
    },
  };
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

function formatAnalyticsMetric(value, analyticsSummary = createEmptyAnalyticsSummary()) {
  if (analyticsSummary.syncState === "pending" && Number(value || 0) === 0) {
    return "Syncing";
  }

  return String(Number(value || 0));
}

function formatAnalyticsRate(value, analyticsSummary = createEmptyAnalyticsSummary()) {
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

function formatAnalyticsReportPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatAnalyticsReportHours(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0";
  }

  if (numeric >= 10) {
    return String(Math.round(numeric));
  }

  return numeric.toFixed(1).replace(/\.0$/, "");
}

function formatAnalyticsReportScore(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0.0";
  }

  return numeric.toFixed(1);
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

function buildAnalyticsChartPath(values = [], width = 640, height = 220, padding = 22) {
  if (!values.length) {
    return "";
  }

  const maxValue = Math.max(...values, 1);
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  return values.map((value, index) => {
    const x = padding + (drawableWidth * index) / Math.max(values.length - 1, 1);
    const y = height - padding - (drawableHeight * value) / maxValue;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
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
    return `sharpening answers like "${trimText(weakAnswerExamples[0])}"`;
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
  if (report.conversationCount <= 0) {
    return "Vonza is ready, but there is not enough live traffic yet to judge customer service performance.";
  }

  const satisfactionReadout = report.satisfactionScore >= 4.3
    ? "customer satisfaction looks strong"
    : report.satisfactionScore >= 3.7
      ? "customer satisfaction looks solid with a few gaps"
      : "customer satisfaction needs attention";

  return `Vonza handled ${formatAnalyticsReportNumber(report.autonomousHandledCount)} of ${formatAnalyticsReportNumber(report.conversationCount)} conversations without owner rescue, ${satisfactionReadout}, and the biggest drop-off risk is ${report.improvementArea}.`;
}

function buildAnalyticsRecommendations(report = {}) {
  const captureGap = Math.max(0, Number(report.highIntentSignals || 0) - Number(report.contactsCaptured || 0));

  return [
    {
      title: "Support quality",
      tone: report.satisfactionScore >= 4.3 ? "positive" : "watch",
      metric: `${formatAnalyticsReportScore(report.satisfactionScore)} / 5 satisfaction`,
      copy: report.satisfactionScore >= 4.3
        ? "Service quality looks steady in the current sample. Keep the strongest answers easy to repeat."
        : "A few conversations are creating friction. Tighten the answer paths customers reach most often.",
    },
    {
      title: "Response speed",
      tone: report.attentionNeeded > 0 ? "watch" : "positive",
      metric: report.attentionNeeded > 0
        ? `${formatAnalyticsReportNumber(report.attentionNeeded)} conversations still need attention`
        : "No open response backlog is standing out",
      copy: report.attentionNeeded > 0
        ? "Review the open conversations quickly so warm visitors and support issues do not cool off."
        : "Owner follow-up pressure looks controlled right now.",
    },
    {
      title: "Weak answers",
      tone: report.weakAnswerCount > 0 ? "risk" : "positive",
      metric: report.weakAnswerCount > 0
        ? `${formatAnalyticsReportNumber(report.weakAnswerCount)} weak-answer signals`
        : "No weak-answer pattern is standing out",
      copy: report.weakAnswerCount > 0
        ? `Improve the wording and knowledge behind ${report.weakAnswerExample || "the weakest customer question"} so similar visitors do not stall.`
        : "Answer coverage looks stable in the current conversation sample.",
    },
    {
      title: "Complaint handling",
      tone: report.unresolvedComplaints > 0 ? "risk" : report.complaintsHandled > 0 ? "positive" : "neutral",
      metric: report.complaintsHandled > 0 || report.complaintOpened > 0
        ? `${formatAnalyticsReportNumber(report.complaintsHandled)} resolved of ${formatAnalyticsReportNumber(report.complaintOpened)} recorded`
        : "No complaint-resolution signal yet",
      copy: report.unresolvedComplaints > 0
        ? "Service recovery is the clearest trust risk right now. Close open complaint threads first."
        : report.complaintsHandled > 0
          ? "Complaint handling is landing well in the current sample."
          : "Vonza has not recorded enough complaint handling yet to judge this area.",
    },
    {
      title: "Lead capture",
      tone: captureGap > 0 ? "watch" : report.contactsCaptured > 0 ? "positive" : "neutral",
      metric: `${formatAnalyticsReportNumber(report.contactsCaptured)} leads captured`,
      copy: captureGap > 0
        ? `There are ${formatAnalyticsReportNumber(captureGap)} warm conversations that did not turn into identified contacts yet.`
        : report.contactsCaptured > 0
          ? "Lead capture is keeping pace with the strongest customer intent."
          : "Add clearer contact prompts where pricing or booking intent appears.",
    },
  ];
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
          ? "Warm intent is there. Tightening the handoff could turn more demand into identified customers."
          : "Booking and pricing demand can likely convert further with clearer next-step prompts.",
    },
    {
      label: "Threat",
      tone: report.unresolvedComplaints > 0 || report.lostCustomerRisk === "High" ? "risk" : "neutral",
      copy: report.unresolvedComplaints > 0
        ? "Open complaint recovery work is the biggest trust risk right now."
        : report.lostCustomerRisk === "High"
          ? "Warm visitors may drop if pricing, booking, or support questions still need owner rescue."
          : "No major churn threat stands out yet beyond the normal need for more live data.",
    },
  ];
}

function buildAnalyticsReport(signals = {}, analyticsSummary = createEmptyAnalyticsSummary(), actionQueue = createEmptyActionQueue(), conversionSummary = {}, outcomeSummary = {}) {
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
  const highIntentSignals = Number(analyticsSummary.highIntentSignals || 0);
  const assistedOutcomes = Number(analyticsSummary.assistedOutcomes || outcomeSummary.assistedConversions || 0);
  const estimatedHoursSaved = (autonomousHandledCount * 6) / 60;
  const people = Array.isArray(actionQueue.people) ? actionQueue.people : [];
  const guestUsers = people.filter((person) => ["session", "unknown", "name"].includes(trimText(person.identityType))).length;
  const emailUsers = people.filter((person) => trimText(person.identityType) === "email").length;
  const phoneUsers = people.filter((person) => trimText(person.identityType) === "phone").length;
  const identifiedUsers = emailUsers + phoneUsers;
  const weakPenalty = conversationCount > 0 ? (weakAnswerCount / conversationCount) * 2.1 : 0;
  const attentionPenalty = conversationCount > 0 ? (attentionNeeded / conversationCount) * 1.2 : 0;
  const unresolvedPenalty = complaintOpened > 0 ? (unresolvedComplaints / complaintOpened) * 1.1 : 0;
  const outcomeBonus = conversationCount > 0 ? Math.min(0.45, (assistedOutcomes / conversationCount) * 1.4) : 0;
  const leadBonus = conversationCount > 0 ? Math.min(0.2, (contactsCaptured / conversationCount) * 0.9) : 0;
  const satisfactionScore = conversationCount > 0
    ? clampNumber(4.45 - weakPenalty - attentionPenalty - unresolvedPenalty + outcomeBonus + leadBonus, 1, 5)
    : 0;
  const mostAskedQuestion = signals.topQuestions?.[0]?.label || "No repeated question yet";
  const bestArea = getAnalyticsBestArea(signals, conversionSummary, outcomeSummary, contactsCaptured);
  const weakAnswerExample = signals.weakAnswerExamples?.[0] || "";
  const improvementArea = getAnalyticsImprovementArea(signals, signals.weakAnswerExamples || [], conversionSummary, outcomeSummary, {
    highIntentSignals,
    contactsCaptured,
  });
  const contactMixCopy = actionQueue.peopleSummary?.total
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
    complaintsHandled,
    complaintOpened,
    unresolvedComplaints,
    satisfactionScore,
    estimatedHoursSaved,
    highIntentSignals,
    assistedOutcomes,
    weakAnswerCount,
    weakAnswerExample,
    attentionNeeded,
    guestUsers,
    emailUsers,
    phoneUsers,
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

function buildAnalyticsTrendMarkup(report = {}) {
  const conversations = report.conversationSeries || { values: [], labels: [], total: 0, max: 0 };
  const outcomes = report.outcomeSeries || { values: [], labels: [], total: 0, max: 0 };
  const hasConversationData = conversations.total > 0;
  const hasOutcomeData = outcomes.total > 0;

  if (!hasConversationData && !hasOutcomeData) {
    return `<div class="placeholder-card">Live conversation and customer-action trends will appear here as soon as dated usage starts flowing in.</div>`;
  }

  const width = 640;
  const height = 220;
  const conversationsPath = buildAnalyticsChartPath(conversations.values, width, height);
  const outcomesPath = buildAnalyticsChartPath(outcomes.values, width, height);
  const guideLines = [25, 50, 75].map((position) => {
    const y = height - ((height - 44) * position) / 100 - 22;
    return `<line x1="22" y1="${y.toFixed(2)}" x2="${width - 22}" y2="${y.toFixed(2)}"></line>`;
  }).join("");
  const axisLabels = [
    conversations.labels[0],
    conversations.labels[Math.floor(conversations.labels.length / 2)] || "",
    conversations.labels[conversations.labels.length - 1] || "",
  ].filter(Boolean);

  return `
    <div class="analytics-report-chart-shell">
      <div class="analytics-report-chart-header">
        <div class="analytics-report-legend">
          <span><i class="tone-conversations"></i>Conversations</span>
          <span><i class="tone-actions"></i>Successful actions</span>
        </div>
        <div class="analytics-report-chart-totals">
          <span>${formatAnalyticsReportNumber(conversations.total)} conversations</span>
          <span>${formatAnalyticsReportNumber(outcomes.total)} successful actions</span>
        </div>
      </div>
      <svg class="analytics-report-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Conversations and successful customer actions over time">
        <g class="analytics-report-chart-guides">${guideLines}</g>
        ${hasConversationData ? `<path class="analytics-report-chart-line analytics-report-chart-line-conversations" d="${conversationsPath}"></path>` : ""}
        ${hasOutcomeData ? `<path class="analytics-report-chart-line analytics-report-chart-line-actions" d="${outcomesPath}"></path>` : ""}
      </svg>
      <div class="analytics-report-chart-axis">
        ${axisLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function normalizeActionQueueStatus(value) {
  const normalized = trimText(value).toLowerCase();
  return ACTION_QUEUE_STATUSES.includes(normalized) ? normalized : "new";
}

function getActionQueueStatusLabel(status) {
  switch (normalizeActionQueueStatus(status)) {
    case "reviewed":
      return "Reviewed";
    case "done":
      return "Done";
    case "dismissed":
      return "Dismissed";
    default:
      return "New";
  }
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
  const normalized = trimText(value).toLowerCase();

  switch (normalized) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "dismissed":
      return "Dismissed";
    case "missing_contact":
      return "Missing contact";
    default:
      return "Not prepared";
  }
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
  const normalized = trimText(value).toLowerCase();

  switch (normalized) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "applied":
      return "Applied";
    case "dismissed":
      return "Dismissed";
    case "failed":
      return "Failed";
    default:
      return "Not prepared";
  }
}

function getKnowledgeFixStatusBadgeClass(value) {
  const normalized = trimText(value).toLowerCase();

  if (normalized === "applied") {
    return "badge success";
  }

  if (normalized === "dismissed") {
    return "pill";
  }

  if (normalized === "ready") {
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
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0%";
  }

  return `${Math.round(numeric * 100)}%`;
}

function buildConversionSummaryPills(summary = {}) {
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
  switch (trimText(value).toLowerCase()) {
    case "booking_started":
      return "Booking started";
    case "booking_confirmed":
      return "Booking confirmed";
    case "quote_requested":
      return "Quote requested";
    case "quote_sent":
      return "Quote sent";
    case "quote_accepted":
      return "Quote accepted";
    case "checkout_started":
      return "Checkout started";
    case "checkout_completed":
      return "Checkout completed";
    case "contact_clicked":
      return "Contact clicked";
    case "email_clicked":
      return "Email clicked";
    case "phone_clicked":
      return "Phone clicked";
    case "follow_up_sent":
      return "Follow-up sent";
    case "follow_up_replied":
      return "Follow-up replied";
    case "complaint_opened":
      return "Complaint opened";
    case "complaint_resolved":
      return "Complaint resolved";
    case "campaign_sent":
      return "Campaign sent";
    case "campaign_replied":
      return "Campaign replied";
    case "campaign_converted":
      return "Campaign converted";
    case "manual_outcome_marked":
      return "Manual outcome";
    default:
      return "Outcome";
  }
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

function buildPeopleMarkup(actionQueue = createEmptyActionQueue()) {
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

function buildActionQueueMarkup(agent, actionQueue = createEmptyActionQueue(), options = {}) {
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
    ? "Outcomes turns into action here. These are the individual conversations that deserve owner follow-up or a better answer path."
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
      ? "Edit owner handoff"
      : "Open owner handoff";
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
              <label for="manual-outcome-type-${escapeHtml(item.key || "")}">Manual outcome mark</label>
              <select id="manual-outcome-type-${escapeHtml(item.key || "")}" name="outcome_type" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
                <option value="booking_confirmed">booking confirmed</option>
                <option value="quote_requested">quote requested</option>
                <option value="quote_accepted">quote accepted</option>
                <option value="checkout_completed">checkout completed</option>
                <option value="follow_up_replied">follow-up replied</option>
                <option value="complaint_resolved">complaint resolved</option>
                <option value="manual_outcome_marked">manual catch-all / no outcome</option>
              </select>
              <p class="field-help">${escapeHtml(agent.manualOutcomeMode === true ? "Use this only when automatic confirmation is unavailable." : "Enable manual outcome mode in Settings before using this fallback.")}</p>
            </div>
            <div class="field">
              <label for="manual-outcome-note-${escapeHtml(item.key || "")}">Context note</label>
              <input id="manual-outcome-note-${escapeHtml(item.key || "")}" name="note" type="text" placeholder="Owner confirmed this outside the thank-you page." ${agent.manualOutcomeMode === true ? "" : "disabled"}>
            </div>
          </div>
          <div class="action-queue-form-actions">
            <button class="ghost-button" type="submit" ${agent.manualOutcomeMode === true ? "" : "disabled"}>Record manual outcome</button>
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
                <span class="action-queue-detail-label">Operator action</span>
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
                <span class="action-queue-detail-label">Operator action</span>
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
              <button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Open settings</button>
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
            <span class="action-queue-detail-label">Operator action</span>
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
              data-close-label="Hide owner handoff"
            >
              ${handoffOpenByDefault ? "Hide owner handoff" : escapeHtml(toggleOpenLabel)}
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
              <button class="primary-button" type="submit" ${allowStatusUpdates ? "" : "disabled"}>Save owner handoff</button>
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
  let primaryAction = null;
  let title = "Your front desk and workspace";
  let copy = "Your front desk is set up in Vonza and ready for the next step.";

  if (!setup.isReady) {
    title = "Today is open. The next step is finishing the front desk setup.";
    copy = "Use Front Desk and Settings to shape the experience, confirm routing and website knowledge, and make sure the customer-facing flow feels ready before you install it.";
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
      copy = `Vonza is live on ${installStatus.host || "your site"} and is surfacing visitor conversations, follow-up work, and operator tasks that deserve attention.`;
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
  } else if (installStatus.state === "installed_unseen") {
    title = "Your front desk is published and waiting for first live traffic";
    copy = "Vonza found the install snippet on the website. The next step is letting a real page load trigger the first live ping.";
    primaryAction = {
      label: "Verify installation",
      type: "focus",
      value: "install",
    };
    nextActions.push({
      label: "Copy install code",
      type: "install",
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
    title = "Your front desk is almost ready to go live";
    copy = "The setup is in place, and the next step is getting the widget onto your live site so Vonza can start answering, routing, and capturing real visitor intent.";
    primaryAction = {
      label: "Add to website",
      type: "focus",
      value: "install",
    };
    nextActions.push({
      label: "Copy install code",
      type: "install",
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
      title: "Workspace unlocked",
      copy: "You are inside the paid Vonza workspace.",
      done: true,
    },
    {
      title: "Front-desk setup",
      copy: setup.isReady
        ? "The front desk has the core details it needs."
        : "The front desk still needs a few setup details before launch.",
      done: setup.isReady,
    },
    {
      title: "Website install",
      copy: isInstallSeen(installStatus)
        ? "Vonza has already been detected on the live site."
        : "The next milestone is getting Vonza onto the live website.",
      done: isInstallSeen(installStatus),
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
      general: "general business questions",
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

  if (action.type === "section") {
    return `<button class="${buttonClass}" type="button" data-overview-target="${action.value}">${action.label}</button>`;
  }

  if (action.type === "focus") {
    return `<button class="${buttonClass}" type="button" data-overview-focus="${action.value}">${action.label}</button>`;
  }

  if (action.type === "import") {
    return `<button class="${buttonClass}" type="button" data-action="import-knowledge">${action.label}</button>`;
  }

  if (action.type === "install") {
    return `<button class="${buttonClass}" type="button" data-action="copy-install" ${trimText(agent.installId) ? "" : "disabled"}>${action.label}</button>`;
  }

  if (action.type === "preview") {
    return `<a class="${primary ? "primary-button" : "test-link"}" data-action="open-preview" href="${buildWidgetUrl(agent.publicAgentKey)}" target="_blank" rel="noreferrer">${action.label}</a>`;
  }

  return "";
}

function buildOverviewSection(agent, messages, setup, actionQueue = createEmptyActionQueue()) {
  const overview = buildOverviewState(agent, messages, setup, actionQueue);
  const attentionItems = (actionQueue.items || [])
    .filter((item) => getActionQueueOwnerWorkflow(item).attention)
    .slice(0, 3);
  const topQuestionMarkup = overview.signals.topQuestions.length
    ? overview.signals.topQuestions.map((item) => `
      <div class="overview-list-item">
        <p class="overview-list-title">${escapeHtml(item.label)}${item.count > 1 ? ` (${item.count})` : ""}</p>
        <p class="overview-list-copy">${escapeHtml(`${getIntentLabel(item.intent)} signal from real visitor questions.`)}</p>
      </div>
    `).join("")
    : `<div class="placeholder-card">No real customer question themes yet. Once the assistant is live and visitors start using it, Vonza will group the strongest recurring questions here.</div>`;
  const highIntentSignals = overview.analyticsSummary.highIntentSignals || 0;
  const recentUsageValue = overview.analyticsSummary.syncState === "pending"
    ? "Syncing"
    : overview.analyticsSummary.visitorQuestions > 0
      ? `${overview.analyticsSummary.visitorQuestions} captured`
      : "No usage yet";
  const recommendationTitle = !setup.knowledgeReady
    ? "Strengthen website knowledge"
    : !isInstallSeen(overview.installStatus)
      ? "Finish live install"
      : overview.queueSummary.attentionNeeded > 0
        ? "Review follow-up queue"
      : overview.queueSummary.total > 0
          ? "Close the loop on follow-up"
      : overview.analyticsSummary.weakAnswerCount > 0
        ? "Review weak answers"
        : highIntentSignals > 0
          ? "Review buyer intent"
          : "Keep learning from live usage";
  const recommendationCopy = !setup.knowledgeReady
    ? "Run another website import so the front desk can answer with stronger business context."
    : !isInstallSeen(overview.installStatus)
      ? "Place Vonza on the live site so it can start detecting real visitor behavior and customer intent."
      : overview.queueSummary.attentionNeeded > 0
        ? "Important high-intent or weak-answer items are in the follow-up queue. Review them first so the owner knows which visitors or answer paths still need attention."
        : overview.queueSummary.total > 0
          ? "The follow-up queue already holds important conversation follow-up. Keep moving items through review so the front desk becomes more operational, not just informative."
      : overview.analyticsSummary.weakAnswerCount > 0
        ? "Several live questions ended in weak or uncertain answers. Use Outcomes to review those conversations, then refine website knowledge or front-desk setup."
        : highIntentSignals > 0
          ? "High-intent questions are already coming in. Review Outcomes to see whether visitors want pricing, booking, contact, or support help most."
          : "Keep an eye on the first real visitor questions so you can tighten the welcome, website copy, or install placement if needed.";
  const weakAnswerMarkup = overview.signals.weakAnswerExamples.length
    ? overview.signals.weakAnswerExamples.map((question) => `
      <div class="overview-list-item">
        <p class="overview-list-title">${escapeHtml(question)}</p>
        <p class="overview-list-copy">This question ended in a weak or uncertain answer and is a good candidate for improvement.</p>
      </div>
    `).join("")
    : `<div class="placeholder-card">No weak-answer signal yet. Once customers ask questions that Vonza struggles to answer, they will show up here instead of being hidden behind a fake success state.</div>`;
  const attentionMarkup = attentionItems.length
    ? attentionItems.map((item) => {
      const workflow = getActionQueueOwnerWorkflow(item);
      const nextLine = trimText(item.nextStep)
        ? `Next step: ${trimText(item.nextStep)}`
        : workflow.copy;
      const recencyLine = item.lastSeenAt ? `Flagged ${formatSeenAt(item.lastSeenAt)}` : "Recent signal";

      return `
        <div class="overview-list-item">
          <p class="overview-list-title">${escapeHtml(item.label || getActionQueueTypeLabel(item.type))} · ${escapeHtml(workflow.label)}</p>
          <p class="overview-list-copy">${escapeHtml(item.snippet || item.whyFlagged || "Flagged from recent conversation activity.")}</p>
          <p class="overview-list-copy">${escapeHtml(recencyLine)}</p>
          <p class="overview-list-copy">${escapeHtml(nextLine)}</p>
        </div>
      `;
    }).join("")
    : `<div class="placeholder-card">No queue items need owner attention right now. Resolved items and dismissed items stay out of the way here.</div>`;

  const renderAction = (action, options = {}) => {
    const buttonClass = options.primary ? "primary-button" : "ghost-button";

    if (action.type === "section") {
      return `<button class="${buttonClass}" type="button" data-overview-target="${action.value}">${action.label}</button>`;
    }

    if (action.type === "focus") {
      return `<button class="${buttonClass}" type="button" data-overview-focus="${action.value}">${action.label}</button>`;
    }

    if (action.type === "import") {
      return `<button class="${buttonClass}" type="button" data-action="import-knowledge">${action.label}</button>`;
    }

    if (action.type === "install") {
      return `<button class="${options.primary ? "primary-button" : "ghost-button"}" type="button" data-action="copy-install" ${trimText(agent.installId) ? "" : "disabled"}>${action.label}</button>`;
    }

    if (action.type === "preview") {
      return `<a class="${options.primary ? "primary-button" : "test-link"}" data-action="open-preview" href="${buildWidgetUrl(agent.publicAgentKey)}" target="_blank" rel="noreferrer">${action.label}</a>`;
    }

    return "";
  };

  return `
    <section class="overview-shell">
      <section class="overview-hero">
        <span class="eyebrow">${isInstallSeen(overview.installStatus) ? "Live front desk" : "Today"}</span>
        <h2 class="overview-title">${escapeHtml(overview.title)}</h2>
        <p class="overview-copy">${escapeHtml(overview.copy)}</p>
        <div class="overview-metric-grid">
          <div class="overview-metric">
            <div class="overview-metric-label">Install status</div>
            <div class="overview-metric-value">${escapeHtml(getInstallSummaryLabel(overview.installStatus))}</div>
          </div>
          <div class="overview-metric">
            <div class="overview-metric-label">Visitor questions</div>
            <div class="overview-metric-value">${escapeHtml(recentUsageValue)}</div>
          </div>
          <div class="overview-metric">
            <div class="overview-metric-label">High-intent chats</div>
            <div class="overview-metric-value">${escapeHtml(formatAnalyticsMetric(overview.analyticsSummary.highIntentSignals, overview.analyticsSummary))}</div>
          </div>
          <div class="overview-metric">
            <div class="overview-metric-label">Attention now</div>
            <div class="overview-metric-value">${overview.queueSummary.attentionNeeded || 0}</div>
          </div>
          <div class="overview-metric">
            <div class="overview-metric-label">Customers captured</div>
            <div class="overview-metric-value">${escapeHtml(formatAnalyticsMetric(overview.analyticsSummary.contactsCaptured, overview.analyticsSummary))}</div>
          </div>
          <div class="overview-metric">
            <div class="overview-metric-label">Assisted outcomes</div>
            <div class="overview-metric-value">${overview.outcomeSummary.assistedConversions || 0}</div>
          </div>
        </div>
        <div class="overview-action-row">
          ${overview.primaryAction ? renderAction(overview.primaryAction, { primary: true }) : ""}
          ${overview.nextActions.map((action) => renderAction(action)).join("")}
        </div>
        <div class="overview-progress-row">
          ${overview.progressItems.map((item) => `
            <div class="progress-card ${item.done ? "done" : ""}">
              <p class="progress-label">${escapeHtml(item.title)}</p>
              <p class="progress-copy">${escapeHtml(item.copy)}</p>
            </div>
          `).join("")}
        </div>
      </section>

      <div class="overview-grid">
        ${buildActionQueueMarkup(agent, actionQueue)}

        <section class="overview-card">
          <h3 class="overview-card-title">Top customer question themes</h3>
          <p class="overview-card-copy">${escapeHtml(
            overview.signals.topQuestions.length
              ? "These are the strongest recurring questions or themes showing up in real visitor usage."
              : "Vonza will show grouped customer question themes here as soon as real usage comes in."
          )}</p>
          <div class="overview-list">
            ${topQuestionMarkup}
          </div>
        </section>

        <section class="overview-card">
          <h3 class="overview-card-title">Owner attention now</h3>
          <p class="overview-card-copy">These are the flagged conversations that still need an owner decision, follow-up, or final resolution.</p>
          <div class="overview-list">
            ${attentionMarkup}
          </div>
        </section>

        <section class="overview-card">
          <h3 class="overview-card-title">Intent signals</h3>
          <p class="overview-card-copy">A fast read on the kinds of conversations visitors are trying to have with the business.</p>
          <div class="overview-list">
            ${["contact", "booking", "pricing", "support"].map((intent) => `
              <div class="overview-list-item">
                <p class="overview-list-title">${escapeHtml(`${getIntentLabel(intent)}: ${overview.signals.intentCounts[intent] || 0}`)}</p>
                <p class="overview-list-copy">${escapeHtml(getIntentDescription(intent))}</p>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="overview-card">
          <h3 class="overview-card-title">Outcome proof</h3>
          <p class="overview-card-copy">This is where Vonza stops looking like activity tracking and starts proving business impact.</p>
          <div class="overview-list">
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(`${overview.outcomeSummary.confirmedBusinessOutcomes || 0} confirmed business outcomes`)}</p>
              <p class="overview-list-copy">${escapeHtml(`${overview.outcomeSummary.directOutcomeCount || 0} direct-route and ${overview.outcomeSummary.followUpAssistedOutcomeCount || 0} follow-up-assisted outcomes are currently attributed.`)}</p>
            </div>
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(`${overview.conversionSummary.directCtasShown || 0} shown → ${overview.conversionSummary.ctaClicks || 0} clicked → ${overview.outcomeSummary.assistedConversions || 0} outcomes`)}</p>
              <p class="overview-list-copy">This is the current high-intent to route to click to outcome chain.</p>
            </div>
            ${overview.outcomeSummary.topPages.map((entry) => `
              <div class="overview-list-item">
                <p class="overview-list-title">${escapeHtml(entry.label)}</p>
                <p class="overview-list-copy">${escapeHtml(`${entry.count} attributed outcome${entry.count === 1 ? "" : "s"} from this page.`)}</p>
              </div>
            `).join("") || `<div class="placeholder-card">No outcome-linked pages yet. As soon as Vonza confirms real business results, the strongest pages will show here.</div>`}
          </div>
        </section>

        <section class="overview-card">
          <h3 class="overview-card-title">What to do next</h3>
          <p class="overview-card-copy">${escapeHtml(recommendationCopy)}</p>
          <div class="overview-list">
            <div class="overview-list-item">
              <p class="overview-list-title">${escapeHtml(recommendationTitle)}</p>
              <p class="overview-list-copy">${escapeHtml(recommendationCopy)}</p>
            </div>
            ${weakAnswerMarkup}
          </div>
        </section>
      </div>
    </section>
  `;
}

function buildAnalyticsPanel(agent, messages, setup, actionQueue = createEmptyActionQueue()) {
  const signals = analyzeConversationSignals(messages);
  const analyticsSummary = getAnalyticsSummary(actionQueue, agent, messages);
  const conversionSummary = {
    ...createEmptyActionQueue().conversionSummary,
    ...(actionQueue.conversionSummary || {}),
  };
  const outcomeSummary = {
    ...createEmptyActionQueue().outcomeSummary,
    ...(actionQueue.outcomeSummary || {}),
  };
  const recentOutcomes = Array.isArray(actionQueue.recentOutcomes) ? actionQueue.recentOutcomes.slice(0, 6) : [];
  const report = buildAnalyticsReport(signals, analyticsSummary, actionQueue, conversionSummary, outcomeSummary);
  report.recommendations = buildAnalyticsRecommendations(report);
  report.swot = buildAnalyticsSwot(report);
  report.summarySentence = buildAnalyticsSummarySentence(report);
  report.conversationSeries = buildAnalyticsTimeSeries(signals.userMessages || [], (message) => message.createdAt || message.created_at, 30);
  report.outcomeSeries = buildAnalyticsTimeSeries(recentOutcomes, (outcome) => outcome.occurredAt || outcome.createdAt || outcome.created_at, 30);
  const syncPendingMarkup = analyticsSummary.syncState === "pending"
    ? `<div class="placeholder-card">Live activity was just detected, and Vonza is refreshing the conversation summary now.</div>`
    : "";

  return `
    <section class="workspace-page" data-shell-section="analytics" hidden>
      ${buildPageHeader({
        title: "Analytics",
        copy: "A simple customer-service performance report for your business.",
        actionsMarkup: `<button class="primary-button" type="button" data-refresh-operator data-force-sync="true">Refresh</button>`,
      })}
      <div class="workspace-page-body">
        <div class="workspace-section-stack">
          ${syncPendingMarkup}
          <section class="workspace-card-soft analytics-report-overview">
            <div>
              <p class="analytics-report-kicker">Service report</p>
              <h2 class="analytics-report-title">Is Vonza helping customer service?</h2>
              <p class="analytics-report-copy">${escapeHtml(report.summarySentence)}</p>
            </div>
            <div class="analytics-report-overview-pills">
              <span class="pill">${escapeHtml(`${report.lostCustomerRisk} lost-customer risk`)}</span>
              <span class="pill">${escapeHtml(`${formatAnalyticsReportNumber(report.highIntentSignals)} warm conversations`)}</span>
              <span class="pill">${escapeHtml(`${formatAnalyticsReportNumber(report.attentionNeeded)} needing review`)}</span>
            </div>
          </section>
          <section class="analytics-report-metric-grid">
            ${[
              {
                label: "Total conversations",
                value: formatAnalyticsReportNumber(report.conversationCount),
                note: analyticsSummary.syncState === "pending"
                  ? "Refreshing from live usage"
                  : signals.usageTrend?.copy || "Live customer traffic will appear here.",
                tone: report.conversationCount > 0 ? "positive" : "neutral",
              },
              {
                label: "Autonomous handled",
                value: formatAnalyticsReportPercent(report.autonomousHandledRate),
                note: `${formatAnalyticsReportNumber(report.autonomousHandledCount)} handled without owner follow-up`,
                tone: report.autonomousHandledRate >= 75 ? "positive" : report.autonomousHandledRate >= 50 ? "watch" : "risk",
              },
              {
                label: "Leads captured",
                value: formatAnalyticsReportNumber(report.contactsCaptured),
                note: report.highIntentSignals > report.contactsCaptured
                  ? `${formatAnalyticsReportNumber(report.highIntentSignals - report.contactsCaptured)} warm chats still anonymous`
                  : "Lead capture is keeping pace with demand",
                tone: report.contactsCaptured > 0 ? "positive" : "neutral",
              },
              {
                label: "Complaints handled",
                value: formatAnalyticsReportNumber(report.complaintsHandled),
                note: report.complaintOpened > 0
                  ? `${formatAnalyticsReportNumber(report.unresolvedComplaints)} unresolved of ${formatAnalyticsReportNumber(report.complaintOpened)} recorded`
                  : "No complaint risk recorded yet",
                tone: report.unresolvedComplaints > 0 ? "risk" : report.complaintsHandled > 0 ? "positive" : "neutral",
              },
              {
                label: "Avg customer satisfaction",
                value: report.conversationCount > 0 ? formatAnalyticsReportScore(report.satisfactionScore) : "Early",
                note: report.conversationCount > 0
                  ? report.satisfactionScore >= 4.3
                    ? "Strong service-quality signal"
                    : report.satisfactionScore >= 3.7
                      ? "Good, with room to tighten answers"
                      : "Customers may be feeling friction"
                  : "Waiting for enough live service signal",
                tone: report.satisfactionScore >= 4.3 ? "positive" : report.satisfactionScore >= 3.7 ? "watch" : "risk",
              },
              {
                label: "Estimated hours saved",
                value: formatAnalyticsReportHours(report.estimatedHoursSaved),
                note: "Estimated from conversations handled without owner rescue",
                tone: report.estimatedHoursSaved > 0 ? "positive" : "neutral",
              },
            ].map((metric) => `
              <article class="analytics-report-metric-card">
                <p class="analytics-report-metric-label">${escapeHtml(metric.label)}</p>
                <strong class="analytics-report-metric-value">${escapeHtml(metric.value)}</strong>
                <p class="analytics-report-metric-note tone-${metric.tone}">${escapeHtml(metric.note)}</p>
              </article>
            `).join("")}
          </section>
          <div class="analytics-report-grid">
            <section class="workspace-card-soft analytics-report-primary">
              <div class="flat-section-header">
                <div>
                  <p class="overview-label">Trends</p>
                  <h3 class="flat-section-title">Customer conversations and successful actions</h3>
                  <p class="analytics-report-section-copy">See whether support demand and completed next steps are moving in the right direction.</p>
                </div>
              </div>
              ${buildAnalyticsTrendMarkup(report)}
            </section>
            <div class="analytics-report-sidebar">
              <section class="workspace-card-soft">
                <div class="flat-section-header">
                  <div>
                    <p class="overview-label">Top insights</p>
                    <h3 class="flat-section-title">What stands out right now</h3>
                  </div>
                </div>
                <div class="analytics-report-insights">
                  ${[
                    { label: "Most asked question", value: report.mostAskedQuestion, tone: "conversations" },
                    { label: "Peak hours", value: report.peakHours, tone: "actions" },
                    { label: "Vonza does best at", value: report.bestArea, tone: "positive" },
                    { label: "Needs improvement", value: report.improvementArea, tone: "risk" },
                  ].map((item) => `
                    <div class="analytics-report-insight">
                      <span class="analytics-report-insight-dot tone-${item.tone}"></span>
                      <div>
                        <strong>${escapeHtml(item.label)}</strong>
                        <p>${escapeHtml(item.value)}</p>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </section>
              <section class="workspace-card-soft">
                <div class="flat-section-header">
                  <div>
                    <p class="overview-label">Contact summary</p>
                    <h3 class="flat-section-title">Who Vonza is talking to</h3>
                  </div>
                </div>
                <div class="analytics-report-contact-grid">
                  <div class="analytics-report-contact-card">
                    <span>Guest users</span>
                    <strong>${escapeHtml(formatAnalyticsReportNumber(report.guestUsers))}</strong>
                  </div>
                  <div class="analytics-report-contact-card">
                    <span>Identified users</span>
                    <strong>${escapeHtml(formatAnalyticsReportNumber(report.identifiedUsers))}</strong>
                  </div>
                  <div class="analytics-report-contact-card">
                    <span>Email users</span>
                    <strong>${escapeHtml(formatAnalyticsReportNumber(report.emailUsers))}</strong>
                  </div>
                </div>
                <p class="analytics-report-section-copy">${escapeHtml(report.contactMixCopy)}</p>
              </section>
            </div>
          </div>
          <section class="workspace-card-soft">
            <div class="flat-section-header">
              <div>
                <p class="overview-label">Improve next</p>
                <h3 class="flat-section-title">Recommended service improvements</h3>
                <p class="analytics-report-section-copy">Keep the next moves simple and tied to customer experience, not internal tooling.</p>
              </div>
            </div>
            <div class="analytics-report-recommendations">
              ${report.recommendations.map((item) => `
                <article class="analytics-report-recommendation tone-${item.tone}">
                  <div class="analytics-report-recommendation-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.metric)}</span>
                  </div>
                  <p>${escapeHtml(item.copy)}</p>
                </article>
              `).join("")}
            </div>
          </section>
          <section class="workspace-card-soft">
            <div class="flat-section-header">
              <div>
                <p class="overview-label">SWOT</p>
                <h3 class="flat-section-title">Opportunity snapshot</h3>
              </div>
            </div>
            <div class="analytics-report-swot-grid">
              ${report.swot.map((item) => `
                <article class="analytics-report-swot-item tone-${item.tone}">
                  <span>${escapeHtml(item.label)}</span>
                  <p>${escapeHtml(item.copy)}</p>
                </article>
              `).join("")}
            </div>
          </section>
          <section class="settings-page" data-analytics-section="overview"></section>
          <section class="settings-page" data-analytics-section="questions" hidden></section>
          <section class="settings-page" data-analytics-section="outcomes" hidden></section>
          <section class="settings-page" data-analytics-section="improvements" hidden></section>
        </div>
      </div>
    </section>
  `;
}

function getThreadDraft(thread = {}) {
  return (thread.messages || []).find((message) => message.direction === "draft") || null;
}

function formatInboxClassificationLabel(value = "") {
  switch (trimText(value)) {
    case "lead_sales":
      return "lead";
    case "follow_up_needed":
    case "general":
      return "general";
    default:
      return trimText(value).replaceAll("_", " ") || "thread";
  }
}

function getEmailPreviewCategoryKey(thread = {}) {
  const classification = trimText(thread.classification);

  if (classification === "complaint") {
    return "complaint";
  }

  if (["lead_sales", "booking"].includes(classification)) {
    return "lead";
  }

  if (classification === "billing") {
    return "billing_questions";
  }

  if (!thread.needsReply || trimText(thread.status) === "waiting" || trimText(thread.riskLevel) === "low") {
    return "resolved";
  }

  return "billing_questions";
}

function getEmailPreviewCategoryMeta(categoryKey = "") {
  switch (trimText(categoryKey)) {
    case "complaint":
      return {
        key: "complaint",
        label: "Complaint",
        description: "Unhappy customer who likely needs calm human review.",
        priority: "High",
      };
    case "lead":
      return {
        key: "lead",
        label: "Lead",
        description: "Commercial intent, quote request, or buying signal.",
        priority: "High",
      };
    case "resolved":
      return {
        key: "resolved",
        label: "Resolved",
        description: "Handled or low-priority thread that can stay quiet for now.",
        priority: "Low",
      };
    case "billing_questions":
    default:
      return {
        key: "billing_questions",
        label: "Billing / question",
        description: "Routine support, invoice help, and general customer questions.",
        priority: "Medium",
      };
  }
}

function getEmailPreviewFallbackItems() {
  return [
    {
      subject: "Complaint - delayed delivery",
      snippet: "Customer says they are unhappy and want help urgently.",
      categoryKey: "complaint",
      priority: "High",
      statusNote: "Customer match if possible",
    },
    {
      subject: "Where is my invoice?",
      snippet: "Routine support request that likely needs a quick answer.",
      categoryKey: "billing_questions",
      priority: "Medium",
      statusNote: "Customer match if possible",
    },
    {
      subject: "Can I get a quote this week?",
      snippet: "Commercial intent from a customer asking about next steps.",
      categoryKey: "lead",
      priority: "High",
      statusNote: "Customer match if possible",
    },
    {
      subject: "Thanks, issue solved",
      snippet: "Resolved thread that can safely stay in a low-priority group.",
      categoryKey: "resolved",
      priority: "Low",
      statusNote: "Quiet for now",
    },
  ];
}

function buildEmailPreviewItems(threads = []) {
  if (!threads.length) {
    return getEmailPreviewFallbackItems();
  }

  return threads.slice(0, 4).map((thread) => {
    const categoryKey = getEmailPreviewCategoryKey(thread);
    const categoryMeta = getEmailPreviewCategoryMeta(categoryKey);
    const latestInbound = (thread.messages || [])
      .slice()
      .reverse()
      .find((message) => message.direction === "inbound") || null;
    const linkedContactId = trimText(thread.contactId || thread.contact_id || thread.linkedContactId);

    return {
      subject: trimText(thread.subject) || "Support thread",
      snippet:
        trimText(latestInbound?.bodyPreview)
        || trimText(latestInbound?.bodyText)
        || trimText(thread.snippet)
        || categoryMeta.description,
      categoryKey,
      priority: trimText(thread.riskLevel)
        ? trimText(thread.riskLevel).replace(/^\w/, (character) => character.toUpperCase())
        : categoryMeta.priority,
      statusNote: linkedContactId ? "Customer matched" : "Customer match if possible",
    };
  });
}

function buildEmailPreviewCategorySummary(items = []) {
  const counts = {
    complaint: 0,
    lead: 0,
    billing_questions: 0,
    resolved: 0,
  };

  items.forEach((item) => {
    const key = getEmailPreviewCategoryMeta(item.categoryKey).key;
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

function buildInboxPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
  const accounts = operatorWorkspace.connectedAccounts || [];
  const primaryAccount = accounts[0] || null;
  const googleCapabilities = getGoogleWorkspaceCapabilities(operatorWorkspace);
  const threads = operatorWorkspace.inbox?.threads || [];
  const status = operatorWorkspace.status || createEmptyOperatorWorkspace().status;
  const activation = operatorWorkspace.activation || createEmptyOperatorWorkspace().activation;
  const connected = primaryAccount?.status === "connected" && googleCapabilities.gmailRead === true;
  const previewItems = buildEmailPreviewItems(threads);
  const summary = buildEmailPreviewCategorySummary(previewItems);
  const liveThreadCount = threads.length;
  const nextStepLabel = !status.googleConfigReady
    ? "Email unavailable"
    : connected
      ? activation.inboxSynced
        ? "Review categories"
        : "Run first sync"
      : primaryAccount?.status === "connected"
        ? "Reconnect Gmail"
        : "Connect Gmail";
  const nextStepCopy = !status.googleConfigReady
    ? "Google inbox connection is not configured on this deployment."
    : connected
      ? activation.inboxSynced
        ? "preview is ready"
        : "pull first threads"
      : primaryAccount?.status === "connected"
        ? "finish read-only access"
        : "review categories";
  const accountStatusValue = connected
    ? "Connected"
    : primaryAccount?.status === "connected"
      ? "Needs Gmail access"
      : "Not connected";
  const accountStatusCopy = connected
    ? primaryAccount.accountEmail || "Gmail connected in read-only mode"
    : status.googleConfigReady
      ? "safe to start"
      : "not available here";
  const heroCopy = !status.googleConfigReady
    ? "Google inbox connection is not configured on this deployment yet, so Email stays visible but unavailable for now."
    : connected
      ? `Vonza is connected to ${primaryAccount.accountEmail || "your Gmail inbox"} in read-only mode. It can read, organize, and classify support email without sending or changing anything.`
      : primaryAccount?.status === "connected"
        ? "Google is connected, but Gmail read-only access is not active yet. Reconnect Gmail so Vonza can safely review support email."
        : "Start by connecting the inbox your team uses for complaints or customer support. Vonza will read, organize, and classify, but not send or change anything.";
  const heroActions = connected
    ? `
      <button class="primary-button" type="button" data-refresh-operator data-force-sync="true">Refresh inbox preview</button>
      <button class="ghost-button" type="button" data-google-connect data-google-connect-mode="email_read_only" data-google-connect-status="Preparing Gmail read-only connection..." data-google-connect-error="We couldn't start the Gmail inbox connection.">Reconnect Gmail</button>
    `
    : `
      <button class="primary-button" type="button" data-google-connect data-google-connect-mode="email_read_only" data-google-connect-status="Preparing Gmail read-only connection..." data-google-connect-error="We couldn't start the Gmail inbox connection." ${status.googleConfigReady ? "" : "disabled"}>${primaryAccount?.status === "connected" ? "Reconnect Gmail" : "Connect Gmail"}</button>
    `;
  const syncNote = connected
    ? `Mailbox ${primaryAccount.selectedMailbox || "INBOX"}${primaryAccount.lastSyncAt ? `, last synced ${formatSeenAt(primaryAccount.lastSyncAt)}` : ", first sync still pending"}`
    : "No auto-replies, no auto-archive, and no silent mailbox changes.";
  const supportedCounts = [
    { label: "Complaints", value: summary.complaint || 0 },
    { label: "Leads", value: summary.lead || 0 },
    { label: "Billing / questions", value: summary.billing_questions || 0 },
    { label: "Resolved / low priority", value: summary.resolved || 0 },
  ];

  return `
    <section class="workspace-page workspace-page-email" data-shell-section="inbox" hidden>
      ${buildPageHeader({
        eyebrow: "Connected tools",
        title: "Email",
        copy: "Connect your support inbox so Vonza can organize customer email without changing anything yet.",
        actionsMarkup: `
          <div class="email-page-header-pills">
            <span class="email-page-pill">Customers</span>
            <span class="email-page-pill email-page-pill--safe">Read-only</span>
          </div>
        `,
      })}
      <div class="workspace-page-body">
        <section class="email-hero-card">
          <div class="email-hero-copy">
            <p class="email-hero-text">${escapeHtml(heroCopy)}</p>
            <div class="email-guardrail-row">
              <span class="email-guardrail-chip">Read-only first</span>
              <span class="email-guardrail-chip">No sending</span>
              <span class="email-guardrail-chip">No mailbox changes</span>
            </div>
            <p class="email-hero-note">${escapeHtml(syncNote)}</p>
          </div>
          <div class="email-hero-actions">
            ${heroActions}
          </div>
        </section>

        <div class="email-status-grid">
          <article class="email-status-card">
            <p class="email-status-label">Connection status</p>
            <strong class="email-status-value">${escapeHtml(accountStatusValue)}</strong>
            <p class="email-status-copy">${escapeHtml(accountStatusCopy)}</p>
          </article>
          <article class="email-status-card">
            <p class="email-status-label">Mode</p>
            <strong class="email-status-value">Read-only</strong>
            <p class="email-status-copy">no email sending</p>
          </article>
          <article class="email-status-card">
            <p class="email-status-label">What Vonza sees</p>
            <strong class="email-status-value">${escapeHtml(connected && liveThreadCount ? `${liveThreadCount} live thread${liveThreadCount === 1 ? "" : "s"}` : "Support threads")}</strong>
            <p class="email-status-copy">complaints and requests</p>
          </article>
          <article class="email-status-card">
            <p class="email-status-label">Next step</p>
            <strong class="email-status-value">${escapeHtml(nextStepLabel)}</strong>
            <p class="email-status-copy">${escapeHtml(nextStepCopy)}</p>
          </article>
        </div>

        <div class="email-main-grid">
          <section class="email-preview-card">
            <div class="email-section-header">
              <div>
                <h3 class="email-section-title">Support inbox preview</h3>
                <p class="email-section-copy">${escapeHtml(connected && activation.inboxSynced
                  ? "Vonza is showing a live read-only preview of how your support inbox is grouped right now."
                  : "Once connected, Vonza will quietly sort customer email into clear groups your team can understand at a glance.")}</p>
              </div>
              <div class="email-preview-counts">
                ${supportedCounts.map((item) => `
                  <div class="email-preview-count">
                    <strong>${escapeHtml(String(item.value))}</strong>
                    <span>${escapeHtml(item.label)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="email-preview-list">
              ${previewItems.map((item) => {
                const category = getEmailPreviewCategoryMeta(item.categoryKey);
                return `
                  <article class="email-preview-row email-preview-row--${escapeHtml(category.key)}">
                    <div class="email-preview-dot" aria-hidden="true"></div>
                    <div class="email-preview-main">
                      <p class="email-preview-subject">${escapeHtml(item.subject)}</p>
                      <p class="email-preview-snippet">${escapeHtml(item.snippet)}</p>
                    </div>
                    <div class="email-preview-tags">
                      <span class="email-preview-tag email-preview-tag--${escapeHtml(category.key)}">${escapeHtml(category.label)}</span>
                      <span class="email-preview-tag email-preview-tag--priority">${escapeHtml(item.priority)}</span>
                      <span class="email-preview-tag email-preview-tag--neutral">${escapeHtml(item.statusNote)}</span>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </section>

          <div class="email-side-stack">
            <section class="email-side-card">
              <h3 class="email-section-title">What Vonza will do</h3>
              <ul class="email-bullet-list">
                <li>Identify complaint emails that need careful follow-up.</li>
                <li>Identify lead and sales-intent messages that should not sit idle.</li>
                <li>Identify routine support and billing questions.</li>
                <li>Identify resolved or low-priority threads that can stay quiet.</li>
                <li>Connect email activity to the right customer when Vonza can match it safely.</li>
              </ul>
            </section>

            <section class="email-side-card email-side-card--dark">
              <h3 class="email-section-title">Coming next</h3>
              <p class="email-section-copy email-section-copy--inverse">After read-only works well, Vonza can add draft replies, stronger complaint handling, and better customer matching. This first version only connects, reads, and organizes.</p>
            </section>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildCalendarPanel(agent, operatorWorkspace = createEmptyOperatorWorkspace()) {
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
                        <p class="analytics-item-title">${escapeHtml(task.title || "Operator task")}</p>
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
  const secondaryActions = [
    trimText(agent.publicAgentKey)
      ? `<a class="test-link" data-action="open-preview" href="${buildWidgetUrl(agent.publicAgentKey)}" target="_blank" rel="noreferrer">Try front desk</a>`
      : "",
    setup.isReady
      ? `<button class="ghost-button" type="button" data-shell-target="install">Open install</button>`
      : `<button class="ghost-button" type="button" data-shell-target="settings" data-settings-target="front_desk">Finish setup</button>`,
  ].filter(Boolean).join("");

  return `
    <div class="workspace-context-bar">
      <button class="shell-menu-button" type="button" data-shell-menu-toggle aria-label="Open navigation">Menu</button>
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
  `;
}

function buildDashboardHelpMessageMarkup(message = {}) {
  return `
    <article class="dashboard-help-message ${message.role === "user" ? "user" : "assistant"}">
      <span class="dashboard-help-message-role">${escapeHtml(message.role === "user" ? "You" : "Ask Vonza")}</span>
      <p class="dashboard-help-message-copy">${formatRichTextHtml(message.content || "")}</p>
    </article>
  `;
}

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
  operatorWorkspace = createEmptyOperatorWorkspace()
) {
  renderTopbarMeta();
  const activeSection = getActiveShellSection(setup, operatorWorkspace);
  const setupHintMarkup = !setup.isReady
    ? `
      <div class="shell-inline-note">
        Finish the Front Desk basics in Settings, test the live experience in Front Desk, and then move into Install when you are ready to publish.
      </div>
    `
    : "";

  rootEl.innerHTML = `
    <div class="app-shell" data-app-shell>
      <button class="shell-backdrop" type="button" data-shell-backdrop aria-label="Close navigation"></button>
      ${buildSidebarShell(agent, setup, actionQueue, operatorWorkspace, activeSection)}
      <div class="workspace-shell">
        ${buildWorkspaceContextBar(agent, setup, operatorWorkspace)}
        ${setupHintMarkup}
        <div class="workspace-pages">
          ${buildOverviewPanel(agent, messages, setup, actionQueue, operatorWorkspace)}
          ${isCapabilityVisibleForWorkspace("contacts", operatorWorkspace) ? buildContactsPanel(agent, operatorWorkspace) : ""}
          ${buildCustomizePanel(agent, setup, operatorWorkspace)}
          ${buildAnalyticsPanel(agent, messages, setup, actionQueue)}
          ${isCapabilityVisibleForWorkspace("inbox", operatorWorkspace) ? buildInboxPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("calendar", operatorWorkspace) ? buildCalendarPanel(agent, operatorWorkspace) : ""}
          ${isCapabilityVisibleForWorkspace("automations", operatorWorkspace) ? buildAutomationsPanel(agent, operatorWorkspace) : ""}
          ${buildInstallPanel(agent, setup, operatorWorkspace)}
          ${buildSettingsPanel(agent, setup, operatorWorkspace)}
        </div>
      </div>
      ${buildDashboardHelpAssistantMarkup()}
    </div>
  `;

  bindSharedDashboardEvents(agent, messages, setup, actionQueue, operatorWorkspace);
}

function renderSetupState(agent, messages, setup, actionQueue, operatorWorkspace) {
  workspaceState = {
    agent,
    messages,
    setup,
    actionQueue,
    operatorWorkspace,
  };
  bindWorkspaceAutoRefresh(agent.id);
  renderAssistantShell(agent, messages, setup, actionQueue, operatorWorkspace);
}

function renderReadyState(agent, messages, actionQueue, operatorWorkspace) {
  const setup = inferSetup(agent);
  workspaceState = {
    agent,
    messages,
    setup,
    actionQueue,
    operatorWorkspace,
  };
  bindWorkspaceAutoRefresh(agent.id);
  renderAssistantShell(agent, messages, setup, actionQueue, operatorWorkspace);
}

function buildPreviewSection(agent, setup) {
  const statusPills = [
    `<span class="preview-status-pill">Website connected</span>`,
    setup.knowledgeState === "ready"
      ? `<span class="preview-status-pill">Website detail loaded</span>`
      : setup.knowledgeState === "limited"
        ? `<span class="preview-status-pill">More website detail would help</span>`
        : `<span class="preview-status-pill">Website detail not loaded yet</span>`,
    setup.knowledgePageCount
      ? `<span class="preview-status-pill">${escapeHtml(`${setup.knowledgePageCount} page${setup.knowledgePageCount === 1 ? "" : "s"} imported`)}</span>`
      : "",
  ].join("");

  const warning = setup.knowledgeState !== "ready"
    ? `<p class="preview-warning">You can already test the Front Desk here. A fresh website import should make answers feel more complete before you go live.</p>`
    : "";

  return `
    <div class="frontdesk-section-intro">
      <div>
        <p class="studio-kicker">Preview</p>
        <h2 class="frontdesk-section-title">Test the customer experience before you launch it.</h2>
        <p class="frontdesk-section-copy">Ask realistic questions, check the next step, and make sure the handoff feels helpful and on-brand.</p>
      </div>
      <div class="frontdesk-section-actions">
        <a class="primary-button" data-action="open-preview" href="${buildWidgetUrl(agent.publicAgentKey)}" target="_blank" rel="noreferrer">Open full preview</a>
        <button class="ghost-button" type="button" data-action="reset-preview">Reset conversation</button>
        ${setup.knowledgeState !== "ready" ? `<button class="ghost-button" type="button" data-action="import-knowledge">Refresh website details</button>` : ""}
      </div>
    </div>
    <div class="frontdesk-section-divider"></div>
    <div class="preview-header">
      <div class="preview-status-row">
        ${statusPills}
        <span class="preview-status-pill">${escapeHtml(agent.websiteUrl || "No website URL")}</span>
      </div>
      ${warning}
    </div>
    <div class="frontdesk-preview-guide">
      <p class="frontdesk-support-title">Prompt starters</p>
      <p class="frontdesk-support-copy">Use a few realistic customer questions to see whether the Front Desk sounds grounded and offers the right next step.</p>
      <div class="prompt-chip-row">
        <button class="prompt-chip" type="button" data-preview-prompt="What services do you offer?">What services do you offer?</button>
        <button class="prompt-chip" type="button" data-preview-prompt="Can I book with you?">Can I book with you?</button>
        <button class="prompt-chip" type="button" data-preview-prompt="Can I get a quote?">Can I get a quote?</button>
        <button class="prompt-chip" type="button" data-preview-prompt="How can I contact you?">How can I contact you?</button>
      </div>
    </div>
    <div class="frontdesk-section-divider"></div>
    <div class="frontdesk-preview-frame-shell">
      <p class="frontdesk-preview-frame-title">Embedded preview</p>
      <p class="frontdesk-support-copy">This is the in-workspace version of the Front Desk, so you can test it without leaving the page.</p>
    </div>
    <iframe
      id="preview-frame"
      class="preview-frame"
      title="Widget preview"
      src="${buildWidgetUrl(agent.publicAgentKey)}"
    ></iframe>
  `;
}

function buildInstallSection(agent, options = {}) {
  const { upcoming = false } = options;
  const hasInstall = Boolean(trimText(agent.installId));
  const progress = getInstallProgress(agent.id);
  const script = hasInstall ? buildScript(agent) : "";
  const installStatus = getDefaultInstallStatus(agent);
  const allowedDomains = Array.isArray(installStatus.allowedDomains) ? installStatus.allowedDomains : [];
  const verifyDetails = installStatus.verificationDetails || {};
  const statusCopy = installStatus.state === "seen_recently"
    ? `Live install detected on ${installStatus.host || "your website"}${installStatus.lastSeenAt ? `, last seen ${formatSeenAt(installStatus.lastSeenAt)}` : ""}.`
    : installStatus.state === "seen_stale"
      ? `Vonza was seen on ${installStatus.host || "your website"}${installStatus.lastSeenAt ? ` ${formatSeenAt(installStatus.lastSeenAt)}` : ""}, but no recent live ping has arrived.`
      : installStatus.state === "installed_unseen"
        ? "The snippet was found on the site, but Vonza has not yet received a live widget ping from a visitor page."
        : installStatus.state === "domain_mismatch"
          ? "Vonza found embed markup, but it points at a different install or a blocked domain."
          : installStatus.state === "verify_failed"
            ? "Verification needs attention. Vonza either could not fetch the site or could not find the expected install snippet yet."
            : "Not installed yet. Paste the head snippet onto the live site, then run verification.";
  const publishDone = isInstallDetected(installStatus) || progress.installed;
  const verifyDone = isInstallSeen(installStatus) || installStatus.state === "installed_unseen";
  const recentSeenMarkup = installStatus.lastSeenUrl
    ? `<p class="install-help">Last seen page: ${escapeHtml(installStatus.lastSeenUrl)}</p>`
    : "";
  const verificationMarkup = installStatus.lastVerifiedAt
    ? `<p class="install-help">Last verified ${escapeHtml(formatSeenAt(installStatus.lastVerifiedAt))}${installStatus.verificationTargetUrl ? ` against ${escapeHtml(installStatus.verificationTargetUrl)}` : ""}.</p>`
    : "";
  const mismatchMarkup = verifyDetails?.foundInstallIds?.length
    ? `<p class="install-help">Found install id${verifyDetails.foundInstallIds.length === 1 ? "" : "s"}: ${escapeHtml(verifyDetails.foundInstallIds.join(", "))}</p>`
    : "";

  return `
    ${upcoming ? `<p class="install-upcoming">This becomes the final step once your front desk feels ready to go live.</p>` : ""}
    <p class="section-copy">${escapeHtml(installStatus.label)}</p>
    <p class="install-help">${escapeHtml(statusCopy)}</p>
    ${allowedDomains.length ? `<p class="install-help">Allowed domains: ${escapeHtml(allowedDomains.join(", "))}</p>` : ""}
    ${recentSeenMarkup}
    ${verificationMarkup}
    ${mismatchMarkup}
    <div class="install-steps">
      <div class="install-step">
        <div class="install-step-number">1</div>
        <div>
          <p class="install-step-title">Copy code</p>
          <p class="install-step-copy">Use the stable head snippet with your install id so Vonza can verify the right site.</p>
        </div>
        <div class="step-check ${progress.codeCopied ? "done" : ""}">${progress.codeCopied ? "Done" : "Pending"}</div>
      </div>
      <div class="install-step">
        <div class="install-step-number">2</div>
        <div>
          <p class="install-step-title">Publish it</p>
          <p class="install-step-copy">Paste it into the live site head, theme layout, or global custom code area.</p>
        </div>
        <div class="step-check ${publishDone ? "done" : ""}">${publishDone ? "Detected" : "Pending"}</div>
      </div>
      <div class="install-step">
        <div class="install-step-number">3</div>
        <div>
          <p class="install-step-title">Verify and watch for live traffic</p>
          <p class="install-step-copy">Run the server check, then wait for the widget to ping back from a real page load.</p>
        </div>
        <div class="step-check ${verifyDone ? "done" : ""}">${verifyDone ? "Ready" : "Pending"}</div>
      </div>
    </div>
    <div class="install-cta-row">
      <button class="primary-button" data-action="copy-install" ${hasInstall ? "" : "disabled"}>Copy install code</button>
      <button class="ghost-button" data-action="copy-install-instructions" ${hasInstall ? "" : "disabled"}>Copy instructions</button>
      <button class="ghost-button" data-action="verify-install" ${hasInstall ? "" : "disabled"}>Verify installation</button>
      <a class="test-link ${hasInstall ? "" : "disabled"}" data-action="open-preview" href="${hasInstall ? buildWidgetUrl(agent.publicAgentKey) : "#"}" target="_blank" rel="noreferrer">Test front desk</a>
    </div>
    <p class="install-help">${hasInstall ? "Keep it simple: place the script in the live site head. Vonza will verify the snippet server-side and mark the install live once a real page load pings back." : "Install will be available as soon as your front desk has a live install id."}</p>
    <details class="code-toggle">
      <summary>View code</summary>
      <textarea id="install-script-output" readonly>${script}</textarea>
    </details>
  `;
}

function buildCustomizationForm(agent, compact) {
  return `
    <form id="assistant-settings-form" class="spacer">
      <div class="studio-layout">
        <div class="studio-groups">
          <section class="studio-group">
            <h3 class="studio-group-title">Identity</h3>
            <p class="studio-group-copy">Shape the name and voice your customers will recognize.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-name">Assistant name</label>
                <input id="assistant-name" name="assistant_name" type="text" value="${escapeHtml(agent.assistantName || agent.name)}">
                <p class="field-help">This is the name customers will see in the assistant.</p>
              </div>
              <div class="field">
                <label for="assistant-tone">Brand voice</label>
                <select id="assistant-tone" name="tone">
                  <option value="friendly" ${agent.tone === "friendly" ? "selected" : ""}>friendly</option>
                  <option value="professional" ${agent.tone === "professional" ? "selected" : ""}>professional</option>
                  <option value="sales" ${agent.tone === "sales" ? "selected" : ""}>sales</option>
                  <option value="support" ${agent.tone === "support" ? "selected" : ""}>support</option>
                </select>
                <p class="field-help">Choose the tone that feels most natural for your business.</p>
              </div>
            </div>
          </section>

          <section class="studio-group">
            <h3 class="studio-group-title">First impression</h3>
            <p class="studio-group-copy">Define the first thing people read and the action they take.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-button-label">Button text</label>
                <input id="assistant-button-label" name="button_label" type="text" value="${escapeHtml(agent.buttonLabel || "")}">
                <p class="field-help">Keep this short, clear, and welcoming.</p>
              </div>
              <div class="field">
                <label for="assistant-website">Website</label>
                <input id="assistant-website" name="website_url" type="text" value="${escapeHtml(agent.websiteUrl || "")}">
                <p class="field-help">This is the website your assistant should represent.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-welcome">Welcome message</label>
                <textarea id="assistant-welcome" name="welcome_message">${escapeHtml(agent.welcomeMessage || "")}</textarea>
                <p class="field-help">Set the tone of the first customer interaction.</p>
              </div>
            </div>
          </section>

          <section class="studio-group">
            <h3 class="studio-group-title">Brand look</h3>
            <p class="studio-group-copy">Use your colors so the assistant feels like part of your brand.</p>
            <div class="form-grid two-col">
              <div class="field">
                <label for="assistant-primary-color">Primary color</label>
                <input id="assistant-primary-color" name="primary_color" type="color" value="${escapeHtml(agent.primaryColor || "#14b8a6")}">
              </div>
              <div class="field">
                <label for="assistant-secondary-color">Secondary color</label>
                <input id="assistant-secondary-color" name="secondary_color" type="color" value="${escapeHtml(agent.secondaryColor || "#0f766e")}">
              </div>
            </div>
          </section>

          <section class="studio-group secondary">
            <h3 class="studio-group-title">Advanced guidance</h3>
            <p class="studio-group-copy">Optional guidance for how the assistant should think and respond in edge cases.</p>
            <div class="form-grid">
              <div class="field">
                <label for="assistant-instructions">Advanced guidance</label>
                <textarea id="assistant-instructions" name="system_prompt">${escapeHtml(agent.systemPrompt || "")}</textarea>
                <p class="field-help">Use this only if you want to fine-tune behavior beyond the core brand settings.</p>
              </div>
            </div>
          </section>

          <div class="studio-save-row">
            <button class="primary-button" type="submit">Save changes</button>
            <span id="studio-save-state" class="save-state">No changes yet.</span>
          </div>
        </div>

        <aside class="studio-summary">
          <p class="studio-summary-label">Live summary</p>
          <h3 id="studio-summary-name" class="studio-summary-name">${escapeHtml(agent.assistantName || agent.name)}</h3>
          <p id="studio-summary-copy" class="studio-summary-copy">${escapeHtml(agent.welcomeMessage || "Your assistant is ready to greet visitors with a clear, helpful first message.")}</p>
          <div class="studio-summary-badge-row">
            <span id="studio-summary-tone" class="badge success">${escapeHtml(agent.tone || "friendly")}</span>
            <span id="studio-summary-button" class="pill">${escapeHtml(agent.buttonLabel || "Chat")}</span>
          </div>
          <div class="studio-swatch-row">
            <div id="studio-swatch-primary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.primaryColor || "#14b8a6")}">Primary</div>
            <div id="studio-swatch-secondary" class="studio-swatch" style="--swatch-color:${escapeHtml(agent.secondaryColor || "#0f766e")}">Secondary</div>
          </div>
        </aside>
      </div>
    </form>
  `;
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

async function loadAgents() {
  const url = new URL("/agents/list", window.location.origin);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return {
    agents: data.agents || [],
    bridgeAgent: data.bridgeAgent || null,
  };
}

async function loadAgentMessages(agentId) {
  const url = new URL("/agents/messages", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return data.messages || [];
}

async function loadAgentInstallSnapshot(agentId) {
  const url = new URL("/agents/install-status", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  const data = await fetchJson(url.toString());
  return data.agent || null;
}

async function loadActionQueue(agentId) {
  const url = new URL("/agents/action-queue", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
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
          ? "Operator workspace tables are missing on this deployment."
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
  if (!isOperatorWorkspaceFlagEnabled()) {
    return normalizeOperatorWorkspace({
      ...createEmptyOperatorWorkspace(),
      enabled: false,
      featureEnabled: false,
      briefing: {
        title: "Operator workspace is off",
        text: "This deployment is running the front-desk launch core, so Vonza is keeping the lighter front-desk workspace active.",
      },
      status: {
        ...createEmptyOperatorWorkspace().status,
        enabled: false,
        featureEnabled: false,
        googleConnectReady: false,
      },
    });
  }

  const url = new URL("/agents/operator-workspace", window.location.origin);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("force_sync", options.forceSync === true ? "true" : "false");
  const data = await fetchJson(url.toString());
  return normalizeOperatorWorkspace(data);
}

async function loadOperatorWorkspaceSafe(agentId, options = {}) {
  try {
    return await loadOperatorWorkspace(agentId, options);
  } catch (error) {
    return normalizeOperatorWorkspace({
      ...createEmptyOperatorWorkspace(),
      health: {
        ...createEmptyOperatorWorkspace().health,
        globalError:
          "Email, Calendar, and Automations are temporarily unavailable. Today, Contacts, Front Desk, and Analytics are still available.",
      },
    });
  }
}

function coalesceWorkspaceLoadState({
  messagesResult,
  actionQueueResult,
  operatorResult,
} = {}) {
  const partialErrors = [messagesResult, actionQueueResult, operatorResult]
    .filter((result) => result?.status === "rejected")
    .map((result) => trimText(result.reason?.message || result.reason))
    .filter(Boolean);

  return {
    messages: messagesResult?.status === "fulfilled" ? messagesResult.value : [],
    actionQueue: actionQueueResult?.status === "fulfilled"
      ? actionQueueResult.value
      : createEmptyActionQueue(),
    operatorWorkspace: operatorResult?.status === "fulfilled"
      ? operatorResult.value
      : {
        ...createEmptyOperatorWorkspace(),
        health: {
          ...createEmptyOperatorWorkspace().health,
          globalError: "We couldn't load the operator workspace.",
        },
      },
    hasPartialFailure: [messagesResult, actionQueueResult, operatorResult].some((result) => result?.status === "rejected"),
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
      workspaceState.operatorWorkspace || createEmptyOperatorWorkspace()
    );
    return;
  }

  renderSetupState(
    workspaceState.agent,
    workspaceState.messages || [],
    setup,
    workspaceState.actionQueue || createEmptyActionQueue(),
    workspaceState.operatorWorkspace || createEmptyOperatorWorkspace()
  );
}

async function refreshAgentInstallState(agentId) {
  if (!workspaceState?.agent || workspaceState.agent.id !== agentId) {
    await boot();
    return;
  }

  const [agentResult, messagesResult, actionQueueResult, operatorResult] = await Promise.allSettled([
    loadAgentInstallSnapshot(agentId),
    loadAgentMessages(agentId),
    loadActionQueue(agentId),
    loadOperatorWorkspaceSafe(agentId),
  ]);
  const nextAgent = agentResult.status === "fulfilled" ? agentResult.value : null;
  const messages = messagesResult.status === "fulfilled" ? messagesResult.value : [];
  const actionQueue = actionQueueResult.status === "fulfilled"
    ? actionQueueResult.value
    : createEmptyActionQueue();
  const operatorWorkspace = operatorResult.status === "fulfilled"
    ? operatorResult.value
    : {
      ...createEmptyOperatorWorkspace(),
      health: {
        ...createEmptyOperatorWorkspace().health,
        globalError: "We couldn't refresh the operator workspace.",
      },
    };

  if (!nextAgent) {
    await boot();
    return;
  }

  workspaceState = {
    ...workspaceState,
    agent: nextAgent,
    messages,
    actionQueue,
    operatorWorkspace,
    setup: inferSetup(nextAgent),
  };
  renderWorkspaceFromState();

  if (messagesResult.status === "rejected" || actionQueueResult.status === "rejected" || operatorResult.status === "rejected") {
    setStatus("Some workspace panels could not refresh, but the dashboard stayed open.");
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

async function importKnowledge(agent, options = {}) {
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
      errorMessage: error.message || "Import failed. The assistant may have limited knowledge.",
    };
  }
}

async function runKnowledgeImport(agent) {
  setStatus("Importing website knowledge...");
  const nextSetup = await importKnowledge(agent);

  try {
    setStatus(nextSetup.knowledgeState === "ready"
      ? "Website knowledge is ready."
      : "Website knowledge was imported with limited detail."
    );
    await boot();
  } catch (error) {
    setStatus(nextSetup.errorMessage || error.message || "Import failed. The assistant may have limited knowledge.");
    await boot();
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
      saveState.textContent = "Saving business context...";
      saveState.className = "save-state saving";
      saveState.removeAttribute("title");
    }
    setStatus("Saving business context...");

    try {
      await fetchJson("/agents/operator/business-profile", {
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

      setStatus("Business context saved.");
      if (saveState) {
        saveState.textContent = "Business context saved.";
        saveState.className = "save-state saved";
        saveState.removeAttribute("title");
      }
      await boot();
    } catch (error) {
      const message = error.message || "We couldn't save that business context just yet.";
      setStatus(message);
      if (saveState) {
        saveState.textContent = "Could not save business context.";
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
    "tone",
    "system_prompt",
    "welcome_message",
    "button_label",
    "website_url",
    "primary_color",
    "secondary_color",
    "allowed_domains",
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
    await boot();
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

function getPreviewFrame() {
  return document.getElementById("preview-frame");
}

function resetPreview(agent) {
  const previewFrame = getPreviewFrame();

  if (!previewFrame) {
    return;
  }

  previewFrame.src = buildWidgetUrl(agent.publicAgentKey);
  setStatus("Preview reset.");
}

async function sendPromptToPreview(agent, prompt) {
  if (!trimText(prompt)) {
    return;
  }

  const previewFrame = getPreviewFrame();

  if (!previewFrame) {
    setStatus("Preview is not available yet.");
    return;
  }

  const trySend = () => {
    try {
      const frameWindow = previewFrame.contentWindow;
      const frameDocument = previewFrame.contentDocument || frameWindow?.document;
      const input = frameDocument?.getElementById("input");

      if (!input || typeof frameWindow?.sendMessage !== "function") {
        return false;
      }

      input.value = prompt;
      frameWindow.sendMessage();
      setStatus(`Testing: ${prompt}`);
      saveInstallProgress(agent.id, { previewOpened: true });
      trackProductEvent("starter_prompt_used", {
        agentId: agent.id,
        metadata: { prompt },
      });
      trackProductEvent("preview_opened", {
        agentId: agent.id,
        onceKey: `preview_opened:${agent.id}`,
      });
      return true;
    } catch {
      return false;
    }
  };

  if (trySend()) {
    await boot();
    return;
  }

  const onLoad = async () => {
    previewFrame.removeEventListener("load", onLoad);
    trySend();
    await boot();
  };

  previewFrame.addEventListener("load", onLoad, { once: true });
  previewFrame.src = buildWidgetUrl(agent.publicAgentKey);
}

function updateStudioSummary(
  form = document.querySelector('form[data-form-kind="customize"]'),
  fallbackAgent = {}
) {
  const nameEl = document.getElementById("studio-summary-name");
  const copyEl = document.getElementById("studio-summary-copy");
  const toneEl = document.getElementById("studio-summary-tone");
  const buttonEl = document.getElementById("studio-summary-button");
  const primarySwatch = document.getElementById("studio-swatch-primary");
  const secondarySwatch = document.getElementById("studio-swatch-secondary");
  const brandWidgetTitle = document.getElementById("brand-widget-title");
  const brandWidgetMessage = document.getElementById("brand-widget-message");
  const brandLauncherLabel = document.getElementById("brand-launcher-label");
  const brandWidgetAvatar = document.getElementById("brand-widget-avatar");
  const brandLauncher = document.getElementById("brand-launcher");

  if (!form || !nameEl || !copyEl || !toneEl || !buttonEl || !primarySwatch || !secondarySwatch) {
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
  const primaryColor = getSummaryValue("primary_color", fallbackAgent.primaryColor) || "#14b8a6";
  const secondaryColor = getSummaryValue("secondary_color", fallbackAgent.secondaryColor) || "#0f766e";

  nameEl.textContent = assistantName;
  copyEl.textContent = welcomeMessage;
  toneEl.textContent = tone;
  buttonEl.textContent = buttonLabel;
  primarySwatch.style.setProperty("--swatch-color", primaryColor);
  secondarySwatch.style.setProperty("--swatch-color", secondaryColor);

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
  const verifyInstallButtons = document.querySelectorAll('[data-action="verify-install"]');
  const previewLinks = document.querySelectorAll('[data-action="open-preview"]');
  const resetPreviewButton = document.querySelector('[data-action="reset-preview"]');
  const promptButtons = document.querySelectorAll('[data-preview-prompt]');
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
  const openInboxThreadButtons = document.querySelectorAll("[data-open-inbox-thread]");
  const openFollowUpButtons = document.querySelectorAll("[data-open-follow-up]");
  const openCalendarEventButtons = document.querySelectorAll("[data-open-calendar-event]");
  const copyFollowUpButtons = document.querySelectorAll("[data-copy-follow-up]");
  const contactFilterButtons = document.querySelectorAll("[data-contact-filter]");
  const contactSearchInput = document.querySelector("[data-contact-search]");
  const focusCustomerFilterButtons = document.querySelectorAll("[data-focus-customer-filters]");
  const exportCustomerButtons = document.querySelectorAll("[data-export-customers]");
  const contactCards = document.querySelectorAll("[data-contact-card]");
  const contactRows = document.querySelectorAll("[data-contact-row]");
  const contactDetails = document.querySelectorAll("[data-contact-detail]");
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
  const frontDeskSectionButtons = document.querySelectorAll("[data-frontdesk-target]");
  const frontDeskSections = document.querySelectorAll("[data-frontdesk-section]");
  const automationFocusButtons = document.querySelectorAll("[data-automation-focus]");
  const dashboardHelp = document.querySelector("[data-dashboard-help]");
  const helpToggleButton = document.querySelector("[data-help-toggle]");
  const helpCloseButtons = document.querySelectorAll("[data-help-close]");
  const helpThread = document.querySelector("[data-help-thread]");
  const helpPrompts = document.querySelector("[data-help-prompts]");
  const helpLocation = document.querySelector("[data-help-location]");
  const helpForm = document.querySelector("[data-help-form]");
  const helpInput = helpForm?.querySelector('[name="question"]') || null;
  const availableSections = getAvailableShellSections(operatorWorkspace);
  let activeContactFilter = "all";
  let activeTodayFilter = "all";
  let activeTodayQueueKey = getActiveTodayQueueSelection(buildTodayQueueItems(actionQueue, operatorWorkspace));
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
    } catch (error) {
      helpState.messages.push({
        role: "assistant",
        content: error.message || "I couldn't load a Vonza help answer just yet. Please try again in a moment.",
      });
      setStatus(error.message || "Ask Vonza could not answer right now.");
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
        return `[data-action-queue-item][data-action-key="${targetId}"]`;
      default:
        return "";
    }
  };

  const showSectionAndHighlight = (targetSection, selector, options = {}) => {
    showShellSection(targetSection, options);
    const sectionEl = document.querySelector(`[data-shell-section="${targetSection}"]`);
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });

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
      await boot();
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
    setStatus("Applying Copilot proposal...");

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

      setStatus(result.message || "Copilot proposal applied.");
      await boot();

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
      setStatus(error.message || "We couldn't apply that Copilot proposal.");
      await boot();
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
    setStatus("Dismissing Copilot proposal...");

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

      setStatus(result.message || "Copilot proposal dismissed.");
      await boot();
    } catch (error) {
      setStatus(error.message || "We couldn't dismiss that Copilot proposal.");
    } finally {
      button.disabled = false;
    }
  };

  const applyContactFilter = (filterKey = "all") => {
    let visibleCount = 0;
    const searchTerm = trimText(contactSearchInput?.value || "").toLowerCase();

    contactFilterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.contactFilter === filterKey);
    });

    contactRows.forEach((row) => {
      const lifecycle = trimText(row.dataset.contactLifecycle);
      const statuses = trimText(row.dataset.contactStatuses).split("|").filter(Boolean);
      const searchText = trimText(row.textContent || "").toLowerCase();
      let visible = true;

      switch (filterKey) {
        case "unresolved":
          visible = statuses.some((status) => ["needs_reply", "complaint", "lead"].includes(status));
          break;
        case "needs_reply":
          visible = statuses.includes("needs_reply");
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
      selectContact(nextVisibleRow.dataset.contactId || "");
    }

    const resultsShell = document.querySelector("[data-contact-filter-results]");
    const existingEmpty = document.querySelector(".contact-filter-empty");

    if (existingEmpty) {
      existingEmpty.remove();
    }

    if (resultsShell && visibleCount === 0) {
      const empty = document.createElement("div");
      empty.className = "placeholder-card contact-filter-empty";
      empty.textContent = "No customers match this filter yet.";
      resultsShell.parentElement?.appendChild(empty);
    }
  };

  const selectContact = (contactId = "") => {
    contactRows.forEach((row) => {
      row.classList.toggle("active", row.dataset.contactId === contactId);
    });

    contactDetails.forEach((detail) => {
      const isActive = detail.dataset.contactId === contactId;
      detail.hidden = !isActive;
      detail.classList.toggle("active", isActive);
    });
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
      await boot();
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
      await boot();
    } catch (error) {
      setStatus(error.message || "We couldn't update that queue item.");
      button.disabled = false;
    }
  };

  const applyTodayFilter = (filterKey = "all") => {
    const queueList = document.querySelector(".today-queue-list");
    const existingEmpty = document.querySelector(".today-queue-empty");
    const searchTerm = trimText(todaySearchInput?.value || "").toLowerCase();
    let visibleCount = 0;

    todayFilterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.todayFilter === filterKey);
    });

    todayQueueRows.forEach((row) => {
      const keys = trimText(row.dataset.todayFilterKeys).split("|").filter(Boolean);
      const matchesFilter = filterKey === "all" || keys.includes(filterKey);
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
  const showFrontDeskSection = (target = "overview") => {
    frontDeskSectionButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.frontdeskTarget === target);
    });

    frontDeskSections.forEach((section) => {
      section.hidden = section.dataset.frontdeskSection !== target;
    });

    syncDashboardHelpUi();
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
      await boot();
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
      await boot();
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
    setStatus("Preparing customer follow-up draft...");

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

      setStatus("Customer follow-up draft prepared.");
      await boot();
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
      await boot();
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
      await boot();
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
      await boot();
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

    setStatus("Recording manual outcome...");

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
      setStatus(result.outcome?.label ? `${result.outcome.label} recorded.` : "Manual outcome recorded.");
      await boot();
    } catch (error) {
      setStatus(error.message || "We couldn't record that outcome.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
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

  const refreshOperatorWorkspace = async () => {
    setStatus("Refreshing connected workspace...");

    try {
      const operatorSnapshot = await loadOperatorWorkspaceSafe(agent.id, {
        forceSync: false,
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
      setStatus("Connected workspace refreshed.");
    } catch (error) {
      setStatus(error.message || "We couldn't refresh the connected workspace.");
    }
  };

  const saveOperatorActivationState = async (payload = {}, options = {}) => {
    const nextStatusMessage = options.statusMessage || "Saving operator onboarding progress...";
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
      setStatus(options.successMessage || "Operator onboarding progress saved.");
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
  }) || null;

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

      showShellSection(targetSection);

      const sectionEl = document.querySelector(`[data-shell-section="${targetSection}"]`);
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
      boot();
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
        await boot();
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
        ? (button.dataset.closeLabel || "Hide owner handoff")
        : (button.dataset.openLabel || "Open owner handoff");
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
      setStatus("Saving owner handoff...");

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
          setStatus("Owner handoff saved.");
        }
        await boot();
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

  openConversationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const messageId = button.dataset.messageId;
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
    row.addEventListener("click", () => {
      selectContact(row.dataset.contactId || "");
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
      } catch (error) {
        setStatus("We couldn't copy that draft.");
      }
    });
  });

  importButtons.forEach((button) => {
    button.addEventListener("click", () => runKnowledgeImport(agent));
  });

  googleConnectButtons.forEach((button) => {
    button.addEventListener("click", connectGoogleWorkspace);
  });

  refreshOperatorButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const forceSync = button.dataset.forceSync === "true";

      setStatus(forceSync ? "Running first sync..." : "Refreshing connected workspace...");

      try {
        const operatorSnapshot = await loadOperatorWorkspaceSafe(agent.id, { forceSync });
        workspaceState = {
          ...(workspaceState || {}),
          agent,
          messages,
          actionQueue,
          operatorWorkspace: operatorSnapshot,
          setup,
        };
        renderWorkspaceFromState();
        setStatus(forceSync ? "Connected workspace synced." : "Connected workspace refreshed.");
      } catch (error) {
        setStatus(error.message || "We couldn't refresh the connected workspace.");
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
        statusMessage: "Saving operator context...",
        successMessage: "Operator context saved.",
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
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
        await boot();
      } catch (error) {
        setStatus(error.message || "We couldn't send those campaign steps.");
      }
    });
  });

  operatorTaskButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus("Updating operator task...");

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
        setStatus("Operator task updated.");
        await boot();
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

  if (resetPreviewButton) {
    resetPreviewButton.addEventListener("click", () => {
      resetPreview(agent);
    });
  }

  promptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sendPromptToPreview(agent, button.dataset.previewPrompt || "");
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

  frontDeskSectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showFrontDeskSection(button.dataset.frontdeskTarget || "overview");
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

  const initialSection = getActiveShellSection(setup, operatorWorkspace);
  showShellSection(initialSection, {
    settingsSection: settingsShellController?.getActiveSettingsSection?.(),
  });
  showFrontDeskSection(getActiveFrontDeskSection());

  if (contactRows.length) {
    selectContact(contactRows[0].dataset.contactId || "");
  }

  if (contactFilterButtons.length || contactSearchInput) {
    applyContactFilter(activeContactFilter);
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
async function boot() {
  trackProductEvent("dashboard_arrived", {
    onceKey: "dashboard_arrived",
    metadata: {
      path: window.location.pathname,
    },
  });

  if (!hasAuthConfig()) {
    setStatus("Supabase Auth is not configured yet.");
    renderAuthEntry();
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

  try {
    renderLoadingState();
    setStatus("Loading your Vonza workspace...");
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

    const [messagesResult, actionQueueResult, operatorResult] = await Promise.allSettled([
      loadAgentMessages(agent.id),
      loadActionQueue(agent.id),
      loadOperatorWorkspaceSafe(agent.id),
    ]);
    const {
      messages,
      actionQueue,
      operatorWorkspace,
      hasPartialFailure,
      partialErrors,
    } = coalesceWorkspaceLoadState({
      messagesResult,
      actionQueueResult,
      operatorResult,
    });
    const setup = inferSetup(agent);

    clearLaunchState();

    if (hasPartialFailure) {
      const partialWarning = partialErrors[0];
      setStatus(partialWarning
        ? `Vonza loaded with partial data. ${partialWarning}`
        : "Vonza loaded with partial data. One workspace request failed, but the dashboard stayed available.");
    }

    if (setup.isReady) {
      renderReadyState(agent, messages, actionQueue, operatorWorkspace);
      return;
    }

    renderSetupState(agent, messages, setup, actionQueue, operatorWorkspace);
  } catch (error) {
    clearLaunchState();
    setStatus(error.message || "We couldn't load your Vonza workspace right now.");
    renderErrorState(
      "We couldn't load your Vonza workspace.",
      error.message || "Please refresh and try again. If the issue continues, your account and payment state are still safe."
    );
  }
}

boot();
