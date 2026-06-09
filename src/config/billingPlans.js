function trimText(value) {
  return String(value || "").trim();
}

export const BILLING_INTERVAL_MONTH = "month";
export const DEFAULT_BILLING_PLAN_KEY = "growth";
export const BILLING_USAGE_COPY = Object.freeze({
  sectionEyebrow: "Simple HUF monthly plans",
  sectionHeadline: "Choose the monthly plan for your AI Front Desk.",
  sectionNote:
    "All plans include the full-page AI Front Desk, website import, lead capture, AI disclosure, owner dashboard, email handoff, and Website Widget as the fastest embedded channel. Growth and Pro add capacity and launch help.",
  sharedFeatures: Object.freeze([
    "Full-page AI Front Desk with Website Widget channel",
    "Website import for grounded answers",
    "Lead capture and email handoff",
    "AI disclosure copy",
    "Owner dashboard",
    "Conversations and summaries",
    "Approved answers and improvements",
    "Monthly AI usage included",
    "Upgrade anytime",
  ]),
});

const BILLING_PLAN_DEFINITIONS = Object.freeze([
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
      summary: "A simple way to launch a hosted AI Front Desk",
      detail: "Includes one Front Desk workspace, Website Widget embedded channel, website import, lead capture, AI disclosure, dashboard, and email handoff",
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
      detail: "Adds higher usage, richer analytics, team handoff, multiple Front Desk templates, and booking links",
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
      audience: "For busier Front Desk workspaces",
      summary: "More room for higher monthly customer volume",
      detail: "Adds multiple users, multi-location logic, API or webhook options, priority support, and white-glove tuning",
      capacityLabel: "Higher monthly AI capacity",
    }),
  }),
]);

export const BILLING_PLAN_KEYS = Object.freeze(
  BILLING_PLAN_DEFINITIONS.map((plan) => plan.key)
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
  const currentIndex = BILLING_PLAN_KEYS.indexOf(normalizedCurrentPlanKey);

  return BILLING_PLAN_KEYS
    .filter((planKey, index) => index > currentIndex)
    .map((planKey) => getBillingPlan(planKey));
}
