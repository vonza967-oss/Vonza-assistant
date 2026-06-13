function trimText(value) {
  return String(value || "").trim();
}

export const BILLING_INTERVAL_MONTH = "month";
export const DEFAULT_BILLING_PLAN_KEY = "growth";
export const PILOT_FREE_WIDGET_PLAN_KEY = "pilot_free_widget";
export const BILLING_USAGE_COPY = Object.freeze({
  sectionEyebrow: "Simple HUF monthly plans",
  sectionHeadline: "Choose the monthly plan for your Website Agent.",
  sectionNote:
    "All plans include the Website Agent launch path, website import, Hungarian-first answers, lead capture, AI disclosure, owner dashboard, email handoff, install verification, allowed domains, and the full-page Front Desk as a companion channel. Growth and Pro add capacity and launch help.",
  sharedFeatures: Object.freeze([
    "Website Agent for existing websites",
    "Website import for grounded Hungarian answers",
    "Lead capture and email handoff",
    "Install verification and allowed domains",
    "AI disclosure copy",
    "Owner dashboard",
    "Conversations and summaries",
    "Approved answers and improvements",
    "Companion full-page Front Desk",
    "Monthly AI usage included",
    "Upgrade anytime",
  ]),
});

const STRIPE_BILLING_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "starter",
    displayName: "Starter",
    monthlyPriceCents: 2000,
    monthlyPriceUsd: 20,
    monthlyPriceHuf: 19900,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 1000,
    checkoutLabel: "Start with Starter",
    stripePriceEnvKey: "STRIPE_PRICE_ID_STARTER_MONTHLY",
    marketing: Object.freeze({
      audience: "For one Hungarian SME",
      summary: "A simple way to launch a Hungarian Website Agent",
      detail: "Includes one Website Agent workspace, website import, Hungarian-first answers, lead capture, AI disclosure, dashboard, email handoff, and companion full-page Front Desk",
      capacityLabel: "Lighter monthly AI capacity",
    }),
  }),
  Object.freeze({
    key: "growth",
    displayName: "Growth",
    monthlyPriceCents: 5000,
    monthlyPriceUsd: 50,
    monthlyPriceHuf: 49900,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 3000,
    checkoutLabel: "Start with Growth",
    stripePriceEnvKey: "STRIPE_PRICE_ID_GROWTH_MONTHLY",
    recommended: true,
    marketing: Object.freeze({
      audience: "For regular customer questions",
      summary: "Best for most growing Hungarian SMEs",
      detail: "Adds higher agent usage, richer analytics, team handoff, companion full-page Front Desk templates, and booking links",
      capacityLabel: "Regular monthly AI capacity",
    }),
  }),
  Object.freeze({
    key: "pro",
    displayName: "Pro",
    monthlyPriceCents: 10000,
    monthlyPriceUsd: 100,
    monthlyPriceHuf: 99900,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 8000,
    checkoutLabel: "Start with Pro",
    stripePriceEnvKey: "STRIPE_PRICE_ID_PRO_MONTHLY",
    marketing: Object.freeze({
      audience: "For busier Website Agent workspaces",
      summary: "More room for higher monthly customer volume",
      detail: "Adds multiple users, multi-location logic, API or webhook options, priority support, white-glove agent tuning, and full-page expansion support",
      capacityLabel: "Higher monthly AI capacity",
    }),
  }),
]);

const INTERNAL_BILLING_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: PILOT_FREE_WIDGET_PLAN_KEY,
    displayName: "Pilot Website Agent",
    monthlyPriceCents: 0,
    monthlyPriceUsd: 0,
    monthlyPriceHuf: 0,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 500,
    checkoutLabel: "Pilot hozzaferes aktiv",
    stripePriceEnvKey: "",
    isPublic: false,
    isStripeBacked: false,
    marketing: Object.freeze({
      audience: "Pilot tesztelo KKV-k",
      summary: "Weboldali agent proba Stripe checkout nelkul",
      detail: "Belso pilot csomag Weboldali agent teszthez, weboldal importtal, magyar valaszokkal, lead capture-rel es install ellenorzessel",
      capacityLabel: "Pilot havi AI kapacitas",
    }),
  }),
]);

const BILLING_PLAN_DEFINITIONS = Object.freeze([
  ...STRIPE_BILLING_PLAN_DEFINITIONS,
  ...INTERNAL_BILLING_PLAN_DEFINITIONS,
]);

export const BILLING_PLAN_KEYS = Object.freeze(
  BILLING_PLAN_DEFINITIONS.map((plan) => plan.key)
);
export const STRIPE_BILLING_PLAN_KEYS = Object.freeze(
  STRIPE_BILLING_PLAN_DEFINITIONS.map((plan) => plan.key)
);

function clonePlan(plan) {
  return {
    ...plan,
    marketing: {
      ...(plan.marketing || {}),
    },
  };
}

export function formatUsdPriceFromCents(cents) {
  const dollars = Number(cents || 0) / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function formatHufPrice(value) {
  const amount = Number(value || 0);
  return `${Number.isFinite(amount) ? amount.toLocaleString("en-US") : "0"} HUF`;
}

export function normalizeBillingPlanKey(value, fallback = DEFAULT_BILLING_PLAN_KEY) {
  const normalized = trimText(value).toLowerCase();
  return BILLING_PLAN_KEYS.includes(normalized) ? normalized : fallback;
}

export function getBillingPlan(planKey = DEFAULT_BILLING_PLAN_KEY) {
  const normalizedPlanKey = normalizeBillingPlanKey(planKey);
  const plan = BILLING_PLAN_DEFINITIONS.find((entry) => entry.key === normalizedPlanKey)
    || BILLING_PLAN_DEFINITIONS.find((entry) => entry.key === DEFAULT_BILLING_PLAN_KEY)
    || BILLING_PLAN_DEFINITIONS[0];
  return clonePlan(plan);
}

export function listBillingPlans() {
  return STRIPE_BILLING_PLAN_KEYS.map((planKey) => getBillingPlan(planKey));
}

export function listAllBillingPlans() {
  return BILLING_PLAN_KEYS.map((planKey) => getBillingPlan(planKey));
}

export function listPublicBillingPlans() {
  return listBillingPlans().map((plan) => ({
    key: plan.key,
    displayName: plan.displayName,
    monthlyPriceCents: plan.monthlyPriceCents,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    monthlyPriceHuf: plan.monthlyPriceHuf,
    monthlyPriceLabel: `${formatHufPrice(plan.monthlyPriceHuf)}/month`,
    billingCurrency: "HUF",
    billingInterval: plan.billingInterval,
    checkoutLabel: plan.checkoutLabel,
    recommended: plan.recommended === true,
    marketing: {
      ...plan.marketing,
    },
    sharedFeatures: [...BILLING_USAGE_COPY.sharedFeatures],
  }));
}

export function getStripePriceEnvKeyForPlan(planKey) {
  return getBillingPlan(planKey).stripePriceEnvKey;
}

export function isStripeBackedBillingPlan(planKey) {
  return getBillingPlan(planKey).isStripeBacked !== false;
}

export function getStripePriceIdForPlan(planKey) {
  const envKey = getStripePriceEnvKeyForPlan(planKey);
  return trimText(process.env[envKey] || "");
}

export function findBillingPlanByPriceId(priceId) {
  const normalizedPriceId = trimText(priceId);

  if (!normalizedPriceId) {
    return null;
  }

  return listBillingPlans().find((plan) => getStripePriceIdForPlan(plan.key) === normalizedPriceId)
    || null;
}

export function listBillingUpgradePlans(currentPlanKey) {
  const normalizedCurrentPlanKey = normalizeBillingPlanKey(currentPlanKey);
  const currentIndex = STRIPE_BILLING_PLAN_KEYS.indexOf(normalizedCurrentPlanKey);

  return STRIPE_BILLING_PLAN_KEYS
    .filter((planKey, index) => index > currentIndex)
    .map((planKey) => getBillingPlan(planKey));
}
