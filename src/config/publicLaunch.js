const FEATURE_STATES = Object.freeze({
  STABLE: "stable",
  BETA: "beta",
  HIDDEN: "hidden",
});

const PUBLIC_COHORT_V1_MATRIX = Object.freeze({
  marketing_site: {
    state: FEATURE_STATES.STABLE,
    label: "Marketing site",
  },
  signup_auth: {
    state: FEATURE_STATES.STABLE,
    label: "Signup and auth",
  },
  checkout: {
    state: FEATURE_STATES.STABLE,
    label: "Checkout",
  },
  front_desk: {
    state: FEATURE_STATES.STABLE,
    label: "AI Front Desk control center",
  },
  website_import: {
    state: FEATURE_STATES.STABLE,
    label: "Website import",
  },
  widget_install: {
    state: FEATURE_STATES.STABLE,
    label: "Widget install",
  },
  today: {
    state: FEATURE_STATES.STABLE,
    label: "Home",
  },
  contacts: {
    state: FEATURE_STATES.STABLE,
    label: "Customers",
  },
  outcomes: {
    state: FEATURE_STATES.STABLE,
    label: "Analytics",
  },
  customize: {
    state: FEATURE_STATES.STABLE,
    label: "Widget configuration",
  },
  lead_capture: {
    state: FEATURE_STATES.STABLE,
    label: "Lead capture",
  },
  google_connect: {
    state: FEATURE_STATES.HIDDEN,
    label: "Google connect",
  },
  inbox: {
    state: FEATURE_STATES.HIDDEN,
    label: "Inbox",
  },
  calendar: {
    state: FEATURE_STATES.HIDDEN,
    label: "Calendar",
  },
  automations: {
    state: FEATURE_STATES.HIDDEN,
    label: "Automations",
  },
  advanced_guidance: {
    state: FEATURE_STATES.HIDDEN,
    label: "Advanced guidance",
  },
  manual_outcome_marks: {
    state: FEATURE_STATES.HIDDEN,
    label: "Manual outcome marks",
  },
  knowledge_fix_workflows: {
    state: FEATURE_STATES.HIDDEN,
    label: "Knowledge-fix workflows",
  },
});

function cloneMatrix(matrix) {
  return Object.fromEntries(
    Object.entries(matrix).map(([key, value]) => [key, { ...value }])
  );
}

function buildStateLists(matrix) {
  const entries = Object.entries(matrix);

  return {
    stable: entries.filter(([, value]) => value.state === FEATURE_STATES.STABLE).map(([key]) => key),
    beta: entries.filter(([, value]) => value.state === FEATURE_STATES.BETA).map(([key]) => key),
    hidden: entries.filter(([, value]) => value.state === FEATURE_STATES.HIDDEN).map(([key]) => key),
  };
}

export function getPublicLaunchProfile({ operatorWorkspaceEnabled = false } = {}) {
  const matrix = cloneMatrix(PUBLIC_COHORT_V1_MATRIX);

  if (!operatorWorkspaceEnabled) {
    matrix.google_connect.state = FEATURE_STATES.HIDDEN;
    matrix.inbox.state = FEATURE_STATES.HIDDEN;
    matrix.calendar.state = FEATURE_STATES.HIDDEN;
    matrix.automations.state = FEATURE_STATES.HIDDEN;
  }

  return {
    mode: "public_cohort_v1",
    product: {
      name: "Vonza Website Widget",
      headline: "AI agent on your website in 5 minutes, with no technical skill required.",
      purchaseSummary:
        "The first public offer is the Website Widget plus website import, lead capture, AI disclosure, email handoff, install verification, analytics, and the shared AI Front Desk dashboard. Google-connected Inbox, Calendar, Automations, WhatsApp, and Voice stay out of the launch UI until they are intentionally enabled for a private workspace.",
    },
    icp: {
      key: "service_businesses_with_inbound_leads",
      label: "Service businesses with inbound leads",
      shortLabel: "Service businesses",
      examples: ["home services", "clinics", "studios", "agencies", "consultants"],
      positioning:
        "Best for SMBs that already get website visitors asking for quotes, bookings, callbacks, or availability and need a reliable website agent before a bigger back-office system.",
    },
    matrix,
    ...buildStateLists(matrix),
  };
}

export { FEATURE_STATES };
