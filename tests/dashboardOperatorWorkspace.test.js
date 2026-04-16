import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createFakeElement(id) {
  return {
    id,
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    dataset: {},
    style: {},
    className: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    focus() {},
    reset() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    matches() {
      return false;
    },
  };
}

function createDashboardHarness({ windowFlags = {}, fetchImpl } = {}) {
  const settingsShellScript = readFileSync(path.join(repoRoot, "frontend", "settings", "SettingsShell.js"), "utf8");
  const script = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8")
    .replace(/\nboot\(\)\.catch\(\(error\) => \{\n\s*handleFatalDashboardError\(error, "boot-unhandled"\);\n\}\);\s*$/, "\n")
    .replace(/\nboot\(\);\s*$/, "\n");
  const storage = new Map();
  const elements = new Map();
  const document = {
    body: createFakeElement("body"),
    documentElement: createFakeElement("documentElement"),
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createFakeElement(id));
      }
      return elements.get(id);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    ...windowFlags,
    document,
    location: {
      origin: "http://127.0.0.1:3000",
      href: "http://127.0.0.1:3000/dashboard",
      search: "",
      pathname: "/dashboard",
    },
    history: {
      replaceState() {},
      pushState() {},
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    sessionStorage: {
      getItem(key) {
        return storage.has(`session:${key}`) ? storage.get(`session:${key}`) : null;
      },
      setItem(key, value) {
        storage.set(`session:${key}`, String(value));
      },
      removeItem(key) {
        storage.delete(`session:${key}`);
      },
    },
    crypto: {
      randomUUID() {
        return "client-test-id";
      },
    },
    navigator: {
      clipboard: {
        async writeText() {},
      },
    },
    matchMedia() {
      return {
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      };
    },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  };
  const context = {
    window,
    document,
    console,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl || (async () => ({
      ok: true,
      async json() {
        return {};
      },
    })),
    globalThis: null,
  };
  context.globalThis = context;

  vm.runInNewContext(settingsShellScript, context, { filename: "frontend/settings/SettingsShell.js" });
  vm.runInNewContext(script, context, { filename: "frontend/dashboard.js" });
  return context;
}

test("dashboard flag resolver prefers the canonical browser flag and falls back safely", () => {
  const canonicalHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });
  assert.equal(canonicalHarness.isOperatorWorkspaceFlagEnabled(), true);

  const legacyHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
  });
  assert.equal(legacyHarness.isOperatorWorkspaceFlagEnabled(), true);

  const canonicalOffHarness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
  });
  assert.equal(canonicalOffHarness.isOperatorWorkspaceFlagEnabled(), false);
});

test("dashboard normalizes sparse operator payloads without forcing the legacy shell", async () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          enabled: true,
          featureEnabled: true,
          status: {
            enabled: true,
            featureEnabled: true,
            googleConnected: false,
            migrationRequired: true,
          },
          connectedAccounts: null,
          contacts: {
            health: {
              migrationRequired: true,
            },
          },
        };
      },
    }),
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");

  assert.equal(workspace.enabled, true);
  assert.deepEqual(Array.from(workspace.connectedAccounts), []);
  assert.deepEqual(Array.from(workspace.inbox.threads), []);
  assert.deepEqual(Array.from(workspace.calendar.events), []);
  assert.deepEqual(Array.from(workspace.calendar.scheduleItems), []);
  assert.deepEqual(Array.from(workspace.calendar.reviewItems), []);
  assert.deepEqual(Array.from(workspace.calendar.followUpItems), []);
  assert.deepEqual(Array.from(workspace.calendar.unlinkedItems), []);
  assert.deepEqual(Array.from(workspace.automations.tasks), []);
  assert.deepEqual(Array.from(workspace.contacts.list), []);
  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "inbox", "calendar", "automations", "install", "settings"]
  );

  assert.match(harness.buildOperatorOverviewSection({}, workspace), /Home at a glance/);
  assert.match(harness.buildOperatorOverviewSection({}, workspace), /Show supporting detail/);
  assert.match(harness.buildInboxPanel({}, workspace), /Coming soon/);
  assert.doesNotMatch(harness.buildInboxPanel({}, workspace), /Connect Gmail/);
  assert.match(harness.buildCalendarPanel({}, workspace), /Coming soon/);
  assert.doesNotMatch(harness.buildCalendarPanel({}, workspace), /Connect Google/);
  assert.match(harness.buildAutomationsPanel({}, workspace), /Coming soon/);
  assert.doesNotMatch(harness.buildAutomationsPanel({}, workspace), /Connect Google/);
});

test("dashboard renders a simplified Today command page and read-only calendar mode", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConnected: true,
      googleConfigReady: true,
      googleCapabilities: {
        identity: true,
        calendarRead: true,
        calendarWrite: false,
        gmailRead: false,
      },
    },
    connectedAccounts: [
      {
        id: "account-1",
        status: "connected",
        accountEmail: "owner@example.com",
        capabilities: {
          identity: true,
          calendarRead: true,
          calendarWrite: false,
          gmailRead: false,
        },
      },
    ],
    calendar: {
      dailySummary: "1 upcoming event, 1 recent appointment needs follow-up, and 1 attendee still needs contact linking.",
      events: [
        {
          id: "event-1",
          title: "Morning estimate",
          startAt: "2026-04-05T09:00:00.000Z",
          endAt: "2026-04-05T09:30:00.000Z",
          status: "confirmed",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
        },
      ],
      scheduleItems: [
        {
          id: "event-1",
          title: "Morning estimate",
          startAt: "2026-04-05T09:00:00.000Z",
          endAt: "2026-04-05T09:30:00.000Z",
          status: "confirmed",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
          linkedContactId: "contact-1",
          linkedContactName: "Taylor Reed",
          actionTargetSection: "contacts",
          actionTargetId: "contact-1",
          actionLabel: "Open Contact",
        },
      ],
      followUpItems: [
        {
          id: "event-2",
          title: "Quote review",
          followUpReason: "The appointment ended recently and no follow-up, task, or non-booking outcome is visible yet.",
          actionTargetSection: "calendar",
          actionTargetId: "event-2",
          actionLabel: "Open Calendar",
        },
      ],
      unlinkedItems: [
        {
          id: "event-3",
          title: "Site visit",
          unlinkedReason: "Jordan Lane is not linked to a contact yet, so follow-up and outcome tracking can fragment.",
          actionTargetSection: "calendar",
          actionTargetId: "event-3",
          actionLabel: "Open Calendar",
        },
      ],
    },
    today: {
      upcomingBookings: 1,
      appointmentsNeedingFollowUp: 1,
      unlinkedAppointments: 1,
      openAvailabilityCount: 2,
      nextEventTitle: "Morning estimate",
    },
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "inbox", "calendar", "automations", "install", "settings"]
  );

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Home at a glance/);
  assert.match(overview, /Messages today/);
  assert.match(overview, /Approval-first proposals/);
  assert.match(overview, /Improve the business and Vonza/);
  assert.match(overview, /Show supporting detail/);

  const calendarPanel = harness.buildCalendarPanel({}, workspace);
  assert.match(calendarPanel, /Coming soon/);
  assert.doesNotMatch(calendarPanel, /Run your first calendar sync/);
  assert.doesNotMatch(calendarPanel, /Connect Google/);
  assert.doesNotMatch(calendarPanel, /Create event draft/);
});

test("today copilot stays hidden when the browser flag is off", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: false,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      headline: "Copilot would be here",
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.doesNotMatch(overview, /Today Copilot/);
});

test("today copilot renders inside Today when the flag is on", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      headline: "1 thing needs attention today.",
      summary: "Vonza is summarizing stable-core data only.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "One pricing gap needs follow-up.",
          confidence: "high",
          rationale: "Grounded in the action queue.",
        },
      ],
      answers: [
        {
          question: "What needs attention today?",
          answer: "One pricing gap needs follow-up.",
          confidence: "high",
          rationale: "Grounded in the action queue.",
        },
      ],
      recommendations: [
        {
          title: "Close the pricing-follow-up gap",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          priority: "high",
          confidence: "medium",
          rationale: "Pricing intent is high-buying-intent.",
          targetSection: "contacts",
          targetId: "contact-1",
          surfaceLabel: "Open Customers",
        },
      ],
      drafts: [
        {
          title: "Draft follow-up for Taylor Reed",
          subject: "Vonza Plumbing: following up on pricing",
          body: "Hi Taylor,\n\nFollowing up on pricing.\n\nVonza Plumbing",
          channel: "email",
          confidence: "high",
          targetSection: "automations",
          targetId: "follow-up-1",
          surfaceLabel: "Open Automations",
        },
      ],
      proposals: [
        {
          key: "follow-up-draft:contact-1",
          type: "create_follow_up_draft",
          title: "Draft follow-up for Taylor Reed",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          whatHappens: "Create or refresh a real approval-first follow-up draft using the deterministic follow-up workflow service.",
          approvalNote: "This only prepares the draft. Nothing is sent automatically.",
          applyLabel: "Create draft",
          openLabel: "Open Automations",
          dismissLabel: "Dismiss",
          target: {
            section: "automations",
            id: "follow-up-1",
            label: "Open Automations",
          },
          state: "new",
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "All core business context areas are filled for Vonza.",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "All core business context areas are filled for Vonza.",
        missingCount: 0,
      },
      prefill: {
        available: true,
        fieldCount: 6,
        sourceSummary: "Suggestions are based on imported website knowledge plus current assistant contact settings.",
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Home at a glance/);
  assert.match(overview, /Approval-first proposals/);
  assert.match(overview, /Improve the business and Vonza/);
  assert.match(overview, /Show supporting detail/);
  assert.match(overview, /Draft follow-up for Taylor Reed/);
  assert.match(overview, /Create draft/);
  const settings = harness.buildSettingsPanel(
    { name: "Vonza" },
    {
      knowledgeState: "missing",
      knowledgeDescription: "Add a real website to import knowledge.",
    },
    workspace
  );
  assert.match(settings, /Business profile/);
  assert.match(settings, /Front Desk/);
  assert.match(settings, /Connected tools/);
  assert.match(settings, /Coming soon/);
  assert.doesNotMatch(settings, /Connect Google/);
  assert.match(settings, /Workspace/);
  assert.match(settings, /Business context setup/);
  assert.match(settings, /Save business context/);
  assert.match(settings, /data-settings-nav="desktop"/);
  assert.doesNotMatch(settings, /local-section-nav/);
});

test("today workspace render uses a dominant queue and support rail shell", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const operatorWorkspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    nextAction: {
      title: "Review ended appointment",
    },
    contacts: {
      list: [
        {
          id: "contact-1",
          displayName: "Taylor Reed",
          primaryEmail: "taylor@example.com",
        },
      ],
    },
    calendar: {
      reviewItems: [
        {
          id: "event-2",
          title: "Quote review",
          attendeeLabel: "Taylor Reed",
          linkedContactId: "contact-1",
          linkedContactName: "Taylor Reed",
          linkedContactEmail: "taylor@example.com",
          endAt: "2026-04-05T11:30:00.000Z",
          reviewReason: "Missing follow-up after the appointment ended.",
          reviewWhyItMatters: "Vonza wants a single explicit resolution before the appointment drops out of context.",
          appointmentReviewState: {},
        },
      ],
      scheduleItems: [
        {
          id: "event-1",
          title: "Morning estimate",
          scheduleReason: "This appointment is coming up today and is linked to Taylor Reed.",
        },
      ],
    },
    today: {
      recentSuccessfulOutcomes: [
        {
          outcomeType: "quote_requested",
          sourceLabel: "Follow-up",
          occurredAt: "2026-04-05T09:00:00.000Z",
        },
      ],
    },
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      headline: "Close the pricing follow-up gap first.",
      summary: "Vonza is summarizing stable-core data only.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "One pricing follow-up still needs owner review.",
        },
      ],
      proposals: [
        {
          key: "follow-up-draft:contact-1",
          type: "create_follow_up_draft",
          title: "Draft follow-up for Taylor Reed",
          summary: "A visitor asked about pricing and still has no recorded outcome.",
          whatHappens: "Create or refresh a real approval-first follow-up draft using the deterministic follow-up workflow service.",
          approvalNote: "This only prepares the draft. Nothing is sent automatically.",
          applyLabel: "Create draft",
          openLabel: "Open Automations",
          dismissLabel: "Dismiss",
          target: {
            section: "automations",
            id: "follow-up-1",
            label: "Open Automations",
          },
          state: "new",
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "All core business context areas are filled for Vonza.",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "All core business context areas are filled for Vonza.",
        missingCount: 0,
      },
      prefill: {
        available: true,
        fieldCount: 6,
        sourceSummary: "Suggestions are based on imported website knowledge plus current assistant contact settings.",
      },
    },
  });

  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    {
      isReady: true,
      knowledgeDescription: "Knowledge ready.",
    },
    {
      ...harness.createEmptyActionQueue(),
      items: [
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Review pricing follow-up",
          whyFlagged: "A quote request still needs owner review.",
          messageId: "message-1",
        },
      ],
      summary: {
        total: 1,
        attentionNeeded: 1,
      },
    },
    operatorWorkspace
  );

  assert.match(overviewPanel, /Home/);
  assert.match(overviewPanel, /Your AI customer service snapshot for today/);
  assert.match(overviewPanel, /Conversations today/);
  assert.match(overviewPanel, /AI priorities/);
  assert.match(overviewPanel, /Recent wins/);
  assert.match(overviewPanel, /Improve service/);
  assert.doesNotMatch(overviewPanel, /Today Copilot/);
  assert.doesNotMatch(overviewPanel, /today-side-column/);
  assert.doesNotMatch(overviewPanel, /Follow-up feed/);
  assert.doesNotMatch(overviewPanel, /Start next step/);
  assert.doesNotMatch(overviewPanel, /data-refresh-operator data-force-sync="true">Refresh/);
});

test("today overview dedupes repeated queue and review items by stable keys", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const overviewPanel = harness.buildOverviewPanel(
    { installId: "install-1", publicAgentKey: "agent-key" },
    [],
    {
      isReady: true,
      knowledgeDescription: "Knowledge ready.",
    },
    {
      ...harness.createEmptyActionQueue(),
      items: [
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Call with mail@example.com",
          whyFlagged: "A quote request still needs owner review.",
        },
        {
          key: "queue-1",
          type: "pricing",
          status: "new",
          label: "Call with mail@example.com",
          whyFlagged: "A quote request still needs owner review.",
        },
      ],
    },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      calendar: {
        reviewItems: [
          {
            id: "event-2",
            title: "Quote review",
            attendeeLabel: "Taylor Reed",
            reviewReason: "Missing follow-up after the appointment ended.",
          },
          {
            id: "event-2",
            title: "Quote review",
            attendeeLabel: "Taylor Reed",
            reviewReason: "Missing follow-up after the appointment ended.",
          },
        ],
      },
    })
  );

  assert.equal(overviewPanel.match(/1 customer conversation still needs attention/g)?.length || 0, 1);
});

test("today and contacts avoid dead automations CTAs when Google beta is hidden", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConfigReady: false,
      googleConnected: false,
    },
    contacts: {
      list: [
        {
          id: "contact-1",
          name: "Taylor Reed",
          email: "taylor@example.com",
          lifecycleState: "active_lead",
          nextAction: {
            followUpId: "follow-up-1",
          },
        },
      ],
      filters: {
        quick: [],
        sources: [],
      },
    },
  });

  const todayActions = harness.buildTodayReviewDrawerActions({
    key: "action-1",
    queueType: "action_queue",
    contactId: "contact-1",
    contactInfo: {
      name: "Taylor Reed",
      email: "taylor@example.com",
    },
    followUp: {
      id: "follow-up-1",
    },
  }, workspace);
  const contactActions = harness.buildContactQuickActions({
    id: "contact-1",
    name: "Taylor Reed",
    email: "taylor@example.com",
    lifecycleState: "active_lead",
    nextAction: {
      followUpId: "follow-up-1",
    },
  }, workspace);
  const contactsPanel = harness.buildContactsPanel({}, workspace);

  assert.doesNotMatch(todayActions, /data-open-follow-up/);
  assert.match(todayActions, /data-shell-target="analytics"/);
  assert.match(todayActions, /data-target-id="action-1"/);
  assert.doesNotMatch(contactActions, /data-open-follow-up/);
  assert.match(contactActions, /data-shell-target="contacts"/);
  assert.match(contactActions, /data-target-id="contact-1"/);
  assert.doesNotMatch(contactsPanel, />Draft follow-up</);
});

test("today contact CTAs carry the intended contact id", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      googleConfigReady: false,
      googleConnected: false,
    },
  });

  const appointmentRow = harness.buildTodayQueueRow({
    id: "event-2",
    queueType: "appointment_review",
    linkedContactId: "contact-2",
    linkedContactName: "Morgan Hale",
    attendeeLabel: "Morgan Hale",
  }, "", workspace);
  const queueActions = harness.buildTodayReviewDrawerActions({
    key: "action-2",
    queueType: "action_queue",
    contactId: "contact-9",
    contactInfo: {
      name: "Jordan Rivers",
      email: "jordan@example.com",
    },
  }, workspace);

  assert.match(appointmentRow, /Open linked contact/);
  assert.match(appointmentRow, /data-target-id="contact-2"/);
  assert.match(queueActions, /Open customer/);
  assert.match(queueActions, /data-target-id="contact-9"/);
});

test("today knowledge-fix CTAs route to the actionable analytics workflow", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
  });

  const rowMarkup = harness.buildTodayQueueRow({
    key: "action-knowledge",
    queueType: "action_queue",
    type: "weak_answer",
    label: "Weak answer needs guidance",
    contactId: "contact-3",
    contactInfo: {
      name: "Casey Quinn",
    },
    knowledgeFix: {
      id: "fix-1",
    },
  }, "", workspace);
  const drawerMarkup = harness.buildTodayReviewDrawerActions({
    key: "action-knowledge",
    queueType: "action_queue",
    type: "weak_answer",
    contactId: "contact-3",
    contactInfo: {
      name: "Casey Quinn",
    },
    knowledgeFix: {
      id: "fix-1",
    },
  }, workspace);

  assert.match(rowMarkup, /Open guidance fix/);
  assert.match(rowMarkup, /data-shell-target="analytics"/);
  assert.match(rowMarkup, /data-target-id="action-knowledge"/);
  assert.doesNotMatch(rowMarkup, /data-settings-target="front_desk"/);
  assert.match(drawerMarkup, /Review fix/);
  assert.match(drawerMarkup, /data-shell-target="analytics"/);
  assert.match(drawerMarkup, /data-target-id="action-knowledge"/);
});

test("customers render as a single-column workspace without inactive controls", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const contactsPanel = harness.buildContactsPanel(
    { manualOutcomeMode: false },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        list: [
          {
            id: "contact-1",
            name: "Taylor Reed",
            email: "taylor@example.com",
            lifecycleState: "active_lead",
            mostRecentActivityAt: "2026-04-05T09:00:00.000Z",
            nextAction: {
              title: "Draft follow-up",
              description: "Pricing question still needs a response.",
            },
            counts: {
              leads: 1,
              outcomes: 0,
            },
            timeline: [
              {
                at: "2026-04-05T09:00:00.000Z",
                label: "Lead captured",
                summary: "Visitor asked for pricing.",
              },
            ],
          },
        ],
      },
    })
  );

  assert.match(contactsPanel, /contacts-workspace/);
  assert.match(contactsPanel, />Customers</);
  assert.match(contactsPanel, /Who contacted you, who needs a reply, and what to do next/);
  assert.match(contactsPanel, /Show customers needing help/);
  assert.doesNotMatch(contactsPanel, /Show filters/);
  assert.doesNotMatch(contactsPanel, /Export customers/);
  assert.match(contactsPanel, /data-contact-row/);
  assert.doesNotMatch(contactsPanel, /data-contact-detail/);
  assert.doesNotMatch(contactsPanel, /contacts-detail-shell/);
  assert.match(contactsPanel, /customer-status-chip/);
  assert.match(contactsPanel, /Email user ·/);
  assert.doesNotMatch(contactsPanel, />Draft follow-up<\/button>\s*<details class="row-action-menu"/);
});

test("sidebar uses Customers as the replacement label for the contacts workspace", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const sidebar = harness.buildSidebarShell(
    {},
    { isReady: true, knowledgeReady: true, knowledgeLimited: false },
    { summary: { attentionNeeded: 0 } },
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      contacts: {
        summary: {
          contactsNeedingAttention: 2,
        },
      },
    }),
    "contacts"
  );

  assert.match(sidebar, /Customers/);
  assert.doesNotMatch(sidebar, />Contacts</);
});

test("shell copy normalizes outdated Outcomes labels to Analytics", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    nextAction: {
      title: "Open Outcomes",
      description: "Today, Customize, and Outcomes stay available while the website front desk continues to work.",
      targetSection: "analytics",
      targetId: "action-1",
    },
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: false,
      summaryCards: [],
      proposals: [
        {
          key: "analytics-proposal",
          title: "Review the queue",
          summary: "A queue item still needs attention.",
          openLabel: "Open Outcomes",
          applyLabel: "Apply",
          dismissLabel: "Dismiss",
          target: {
            section: "analytics",
            id: "action-1",
            label: "Open Outcomes",
          },
        },
      ],
      proposalSummary: {
        activeCount: 1,
        blockedCount: 0,
        hiddenCount: 0,
      },
      context: {
        businessProfile: {
          readiness: {
            summary: "Ready",
            missingCount: 0,
          },
        },
        warnings: [],
      },
      fallback: {
        guidance: [],
      },
    },
    businessProfile: {
      readiness: {
        summary: "Ready",
        missingCount: 0,
      },
      prefill: {
        available: false,
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  const proposals = harness.buildCopilotProposalList(workspace.copilot, workspace);

  assert.equal(harness.normalizeShellCopy("Open Outcomes"), "Open Analytics");
  assert.match(overview, /Open Analytics/);
  assert.match(overview, /Improve the business and Vonza/);
  assert.doesNotMatch(overview, /Open Outcomes/);
  assert.match(proposals, /Open Analytics/);
  assert.doesNotMatch(proposals, /Open Outcomes/);
});
test("front desk workspace uses focused sub-navigation and one dominant panel", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  harness.setActiveFrontDeskSection("launch");

  const workspace = harness.normalizeOperatorWorkspace({
    businessProfile: {
      readiness: {
        summary: "Service areas and approvals are filled in, but pricing still needs owner review.",
        missingCount: 1,
      },
    },
  });

  const panel = harness.buildFrontDeskPanel(
    {
      publicAgentKey: "agent-key",
      buttonLabel: "Ask us",
      primaryCtaMode: "booking",
      websiteUrl: "https://acme.example",
      tone: "professional",
      systemPrompt: "Keep replies concise and route bookings quickly.",
      installId: "install-123",
    },
    {
      personalityReady: true,
      knowledgeReady: false,
      knowledgeLimited: true,
      knowledgeState: "limited",
      knowledgeDescription: "Website knowledge is usable, but still needs another review pass before launch.",
      knowledgePageCount: 5,
      isReady: false,
    },
    workspace
  );

  assert.match(panel, /Website \/ Context/);
  assert.match(panel, /Install \/ Launch/);
  assert.match(panel, /Open settings/);
  assert.match(panel, /Try front desk/);
  assert.match(panel, /Review business context/);
  assert.match(panel, /Open install/);
  assert.match(panel, /What stays out of the way/);
  assert.match(panel, /Deeper configuration lives in Settings/);
  assert.match(panel, /data-frontdesk-section="launch"/);
  assert.match(panel, /frontdesk-main-panel/);
  assert.doesNotMatch(panel, /settings-summary-grid/);
  assert.doesNotMatch(panel, /frontdesk-context-grid/);
});

test("sidebar rail stays grouped into primary, connected tools, and utilities", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const sidebar = harness.buildSidebarShell(
    { assistantName: "Vonza", websiteUrl: "https://example.com" },
    {
      isReady: true,
      knowledgeReady: true,
      knowledgeLimited: false,
    },
    harness.createEmptyActionQueue(),
    harness.normalizeOperatorWorkspace({
      enabled: true,
      featureEnabled: true,
      status: {
        googleConnected: true,
        googleConfigReady: true,
      },
      connectedAccounts: [
        {
          id: "account-1",
          status: "connected",
          accountEmail: "owner@example.com",
          capabilities: {
            identity: true,
            gmailRead: true,
            calendarRead: true,
          },
        },
      ],
    }),
    "overview"
  );

  assert.match(sidebar, /Primary/);
  assert.match(sidebar, /Connected tools/);
  assert.match(sidebar, /Coming soon/);
  assert.doesNotMatch(sidebar, /Optional/);
  assert.match(sidebar, /Utilities/);
  assert.match(sidebar, /Workspace/);
  assert.match(sidebar, /Knowledge/);
  assert.match(sidebar, /Install/);
});

test("analytics page now renders as a service report instead of stacked equal-weight cards", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const analyticsPanel = harness.buildAnalyticsPanel(
    { installStatus: { label: "Seen recently", state: "seen_recently" } },
    [
      { id: "m1", role: "user", content: "Can I book an appointment?" },
      { id: "m2", role: "assistant", content: "Yes, I can help with that." },
      { id: "m3", role: "user", content: "Yeah I'd like to contact the boss" },
      { id: "m4", role: "assistant", content: "Here is the best contact path." },
    ],
    {
      knowledgeDescription: "Knowledge ready.",
      knowledgeReady: true,
      knowledgeLimited: false,
      knowledgePageCount: 4,
    },
    {
      ...harness.createEmptyActionQueue(),
      recentOutcomes: [
        {
          outcomeType: "booking_confirmed",
          sourceLabel: "Booking CTA",
          occurredAt: "2026-04-05T09:00:00.000Z",
        },
      ],
    }
  );

  assert.match(analyticsPanel, /A simple customer-service performance report for your business/);
  assert.match(analyticsPanel, /Is Vonza helping customer service\?/);
  assert.match(analyticsPanel, /Customer conversations and successful actions/);
  assert.match(analyticsPanel, /What stands out right now/);
  assert.match(analyticsPanel, /Recommended service improvements/);
  assert.match(analyticsPanel, /Top questions and weak answers/);
  assert.match(analyticsPanel, /Estimated customer satisfaction/);
  assert.match(analyticsPanel, /Booking or availability/);
  assert.match(analyticsPanel, /Asking for contact info/);
  assert.doesNotMatch(analyticsPanel, /Yeah I'd like to contact the boss/);
  assert.doesNotMatch(analyticsPanel, /data-refresh-operator data-force-sync="true">Refresh/);
});
test("sparse-data copilot rendering stays honest and points back to business context setup", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_TODAY_COPILOT_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    copilot: {
      enabled: true,
      featureEnabled: true,
      readOnly: true,
      draftOnly: true,
      sparseData: true,
      headline: "Vonza sees the foundation, but not enough live operating data yet.",
      summary: "Vonza is intentionally read-first and draft-first.",
      summaryCards: [
        {
          id: "what_matters",
          label: "What matters today",
          text: "Stable-core activity is still sparse.",
        },
      ],
      context: {
        businessProfile: {
          readiness: {
            summary: "2 of 8 business context areas are filled. Missing: Pricing, Policies.",
            missingCount: 2,
          },
        },
      },
      fallback: {
        title: "Vonza needs a little more real operating context",
        description: "There is not enough stable-core activity yet for strong recommendations.",
        guidance: ["Fill the business context foundation next: Pricing, Policies."],
      },
    },
    businessProfile: {
      readiness: {
        summary: "2 of 8 business context areas are filled. Missing: Pricing, Policies.",
        missingCount: 2,
      },
      prefill: {
        available: false,
      },
    },
  });

  const overview = harness.buildOperatorOverviewSection({}, workspace);
  assert.match(overview, /Vonza needs a little more real operating context/);
  assert.match(overview, /Open business context/);
});

test("launch profile keeps the stable core visible and labels Google workspace surfaces as beta", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
      VONZA_LAUNCH_PROFILE: {
        mode: "public_cohort_v1",
        matrix: {
          today: { state: "stable" },
          contacts: { state: "stable" },
          inbox: { state: "beta" },
          calendar: { state: "beta" },
          automations: { state: "beta" },
          customize: { state: "stable" },
          outcomes: { state: "stable" },
          advanced_guidance: { state: "hidden" },
          manual_outcome_marks: { state: "hidden" },
          knowledge_fix_workflows: { state: "hidden" },
        },
      },
    },
  });

  assert.equal(harness.getCapabilityState("today"), "stable");
  assert.equal(harness.getCapabilityState("inbox"), "beta");
  assert.equal(harness.getCapabilityState("manual_outcome_marks"), "hidden");
  assert.equal(harness.isCapabilityStable("contacts"), true);
  assert.equal(harness.isCapabilityBeta("calendar"), true);
});

test("launch mode hides Google beta tabs when Google config is unavailable", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: true,
    featureEnabled: true,
    status: {
      enabled: true,
      featureEnabled: true,
      googleConfigReady: false,
      googleConnected: false,
    },
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "contacts", "customize", "analytics", "inbox", "install", "settings"]
  );
  assert.equal(harness.getWorkspaceMode(workspace).key, "operator_without_google_beta");
});

test("front-desk-only mode keeps the stable non-operator shell available", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
    },
  });

  const workspace = harness.normalizeOperatorWorkspace({
    enabled: false,
    featureEnabled: false,
  });

  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "customize", "analytics", "install", "settings"]
  );
  assert.equal(harness.getWorkspaceMode(workspace).key, "front_desk_only");
});

test("dashboard renders inbox threads safely when thread messages are missing", async () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          enabled: true,
          featureEnabled: true,
          status: {
            enabled: true,
            featureEnabled: true,
            googleConnected: true,
          },
          activation: {
            inboxSynced: true,
          },
          connectedAccounts: [
            {
              status: "connected",
              accountEmail: "owner@example.com",
            },
          ],
          inbox: {
            threads: [
              {
                id: "thread-1",
                subject: "Need help",
              },
            ],
          },
        };
      },
    }),
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");
  const markup = harness.buildInboxPanel({}, workspace);

  assert.equal(Array.isArray(workspace.inbox.threads[0].messages), true);
  assert.match(markup, /Coming soon/);
  assert.doesNotMatch(markup, /Need help/);
  assert.doesNotMatch(markup, /Read-only/i);
  assert.doesNotMatch(markup, /Approve and send/i);
});

test("dashboard keeps the legacy shell only when the operator flag is off", async () => {
  let fetchCalls = 0;
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: false,
      VONZA_OPERATOR_WORKSPACE_V1: true,
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
  });

  const workspace = await harness.loadOperatorWorkspace("agent-1");

  assert.equal(fetchCalls, 0);
  assert.equal(workspace.enabled, false);
  assert.deepEqual(
    Array.from(harness.getAvailableShellSections(workspace)),
    ["overview", "customize", "analytics", "install", "settings"]
  );
});

test("dashboard refresh reloads live agent messages, summaries, and workspace data", async () => {
  const calls = [];
  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    publicAgentKey: "public-key",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "ready",
      description: "Knowledge ready.",
    },
    installStatus: {
      state: "seen_recently",
      label: "Live",
      host: "example.com",
    },
    accessStatus: "active",
  };
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      calls.push(`${parsed.pathname}${parsed.search}`);

      if (parsed.pathname === "/agents/install-status") {
        return {
          ok: true,
          async json() {
            return { agent };
          },
        };
      }

      if (parsed.pathname === "/agents/messages") {
        return {
          ok: true,
          async json() {
            return {
              messages: [
                {
                  id: "message-1",
                  role: "user",
                  content: "Fresh live question",
                  sessionKey: "session-1",
                  createdAt: "2026-04-14T09:03:55.000Z",
                },
              ],
            };
          },
        };
      }

      if (parsed.pathname === "/agents/action-queue") {
        return {
          ok: true,
          async json() {
            return {
              items: [],
              summary: { total: 0, attentionNeeded: 0 },
              analyticsSummary: {
                totalMessages: 1,
                visitorQuestions: 1,
                syncState: "ready",
                recentActivity: {
                  lastActivityAt: "2026-04-14T09:03:55.000Z",
                },
              },
            };
          },
        };
      }

      if (parsed.pathname === "/agents/operator-workspace") {
        return {
          ok: true,
          async json() {
            return {
              enabled: true,
              featureEnabled: true,
              contacts: {
                list: [
                  {
                    id: "contact-1",
                    name: "Anonymous visitor",
                    bestIdentifier: "Session continuity only",
                    mostRecentActivityAt: "2026-04-14T09:03:55.000Z",
                    sources: ["chat"],
                    counts: { messages: 1 },
                    timeline: [
                      {
                        at: "2026-04-14T09:03:55.000Z",
                        label: "Visitor message",
                        summary: "Fresh live question",
                      },
                    ],
                  },
                ],
                summary: {
                  totalContacts: 1,
                },
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
  });

  harness.renderReadyState(
    agent,
    [],
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  await harness.refreshAgentInstallState("agent-1", { forceSync: true });

  assert.ok(calls.some((call) => call.startsWith("/agents/install-status?")));
  assert.ok(calls.some((call) => call.startsWith("/agents/messages?")));
  assert.ok(calls.some((call) => call.startsWith("/agents/action-queue?")));
  assert.ok(calls.some((call) => call.includes("/agents/operator-workspace?") && call.includes("force_sync=true")));
  assert.match(harness.document.getElementById("dashboard-root").innerHTML, /Fresh live question/);
  assert.match(harness.document.getElementById("dashboard-root").innerHTML, /Anonymous visitor/);
});

test("dashboard refresh buttons use the full live reload path", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /refreshAgentInstallState\(agent\.id,\s*\{\s*forceSync\s*\}\)/);
});

test("dashboard coalesces partial workspace failures without blanking the shell", () => {
  const harness = createDashboardHarness();

  const state = harness.coalesceWorkspaceLoadState({
    messagesResult: {
      status: "fulfilled",
      value: [{ id: "message-1", content: "Hello" }],
    },
    actionQueueResult: {
      status: "rejected",
      reason: new Error("queue failed"),
    },
    operatorResult: {
      status: "fulfilled",
      value: harness.createEmptyOperatorWorkspace(),
    },
  });

  assert.equal(state.messages.length, 1);
  assert.equal(Array.isArray(state.actionQueue.items), true);
  assert.equal(state.operatorWorkspace.health.globalError, "");
  assert.equal(state.hasPartialFailure, true);
});

test("dashboard help assistant stays out of the dashboard shell for now", () => {
  const harness = createDashboardHarness({
    windowFlags: {
      VONZA_OPERATOR_WORKSPACE_V1_ENABLED: true,
    },
  });

  const agent = {
    id: "agent-1",
    name: "Vonza",
    assistantName: "Vonza",
    welcomeMessage: "Welcome to Vonza.",
    tone: "friendly",
    publicAgentKey: "public-key",
    websiteUrl: "https://example.com",
    knowledge: {
      state: "limited",
    },
    installStatus: {
      state: "not_installed",
    },
  };

  harness.renderSetupState(
    agent,
    [],
    harness.inferSetup(agent),
    harness.createEmptyActionQueue(),
    harness.createEmptyOperatorWorkspace()
  );

  const rootMarkup = harness.document.getElementById("dashboard-root").innerHTML;

  assert.doesNotMatch(rootMarkup, /Ask Vonza/);
  assert.doesNotMatch(rootMarkup, /AI guide and support inside the app/);
  assert.doesNotMatch(rootMarkup, /data-dashboard-help/);
  assert.doesNotMatch(rootMarkup, /data-help-toggle/);
  assert.doesNotMatch(rootMarkup, /dashboard-help-drawer/);
});

test("dashboard help prompt chips submit real AI questions instead of canned answers", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /await submitDashboardHelpQuestion\(button\.dataset\.helpPrompt \|\| ""\);/);
  assert.match(dashboardScript, /fetchJson\("\/agents\/product-help"/);
  assert.doesNotMatch(dashboardScript, /data-help-answer/);
  assert.doesNotMatch(dashboardScript, /buildDashboardHelpFallbackAnswer/);
});

test("dashboard help shows a clean explicit fallback when AI support fails", () => {
  const dashboardScript = readFileSync(path.join(repoRoot, "frontend", "dashboard.js"), "utf8");

  assert.match(dashboardScript, /DASHBOARD_HELP_UNAVAILABLE_MESSAGE = "I couldn't load Vonza help right now\. Please try again\."/);
  assert.match(dashboardScript, /content: DASHBOARD_HELP_UNAVAILABLE_MESSAGE/);
  assert.doesNotMatch(dashboardScript, /I couldn't load a Vonza help answer just yet/);
});
