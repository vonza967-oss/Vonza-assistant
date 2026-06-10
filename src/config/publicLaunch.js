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
      headline: "Five-minute Hungarian website agent/widget for SME customer questions and lead capture.",
      purchaseSummary:
        "The first public offer is the Website Widget: a Hungarian website AI agent/widget that installs on an existing site in about 5 minutes, with website import, Hungarian-first answers, lead capture, AI disclosure, email handoff, install verification, allowed domains, analytics, and the shared owner dashboard. The AI Front Desk remains the broader system behind the widget, and the full-page Front Desk is a companion/expansion channel for QR links, direct links, WordPress pages, smart embeds, and dedicated customer-facing flows. Google-connected Inbox, Calendar, Automations, WhatsApp, and Voice stay out of the launch UI until they are intentionally enabled for a private workspace.",
    },
    icp: {
      key: "service_businesses_with_inbound_leads",
      label: "Hungarian SMEs with inbound customer questions",
      shortLabel: "Hungarian SMEs",
      examples: ["home services", "clinics", "studios", "agencies", "consultants"],
      positioning:
        "Best for Hungarian SMEs that already get website visitors asking for quotes, bookings, callbacks, availability, pricing, or service details and need a fast Hungarian-first Website Widget before a bigger back-office system. Use the full-page Front Desk as a companion or expansion channel when the business needs QR links, direct links, WordPress pages, smart embeds, or dedicated customer-facing flows.",
    },
    matrix,
    ...buildStateLists(matrix),
  };
}

export { FEATURE_STATES };
