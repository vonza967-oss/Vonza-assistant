function trimText(value) {
  return String(value || "").trim();
}

export const BILLING_INTERVAL_MONTH = "month";
export const DEFAULT_BILLING_PLAN_KEY = "growth";
export const BILLING_USAGE_COPY = Object.freeze({
  sectionEyebrow: "Simple monthly plans",
  sectionHeadline: "Choose the monthly capacity that fits your customer traffic.",
  sectionNote:
    "All plans include the same core Vonza experience. The difference is how much monthly AI usage is included.",
  sharedFeatures: Object.freeze([
    "AI front desk on your website",
    "Customer dashboard",
    "Customer summaries",
    "Analytics",
    "Simple install",
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
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 1000,
    checkoutLabel: "Start with Starter",
    stripePriceEnvKey: "STRIPE_PRICE_ID_STARTER_MONTHLY",
    marketing: Object.freeze({
      audience: "For lighter website traffic",
      summary: "A simple way to get Vonza live on your site",
      detail: "Best for getting Vonza live on a lower-volume site",
      capacityLabel: "Lighter monthly AI capacity",
    }),
  }),
  Object.freeze({
    key: "growth",
    displayName: "Growth",
    monthlyPriceCents: 5000,
    monthlyPriceUsd: 50,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 3000,
    checkoutLabel: "Start with Growth",
    stripePriceEnvKey: "STRIPE_PRICE_ID_GROWTH_MONTHLY",
    recommended: true,
    marketing: Object.freeze({
      audience: "For regular customer questions",
      summary: "Best for most growing small businesses",
      detail: "Best for most small businesses",
      capacityLabel: "Regular monthly AI capacity",
    }),
  }),
  Object.freeze({
    key: "pro",
    displayName: "Pro",
    monthlyPriceCents: 10000,
    monthlyPriceUsd: 100,
    billingInterval: BILLING_INTERVAL_MONTH,
    includedAiBudgetCents: 8000,
    checkoutLabel: "Start with Pro",
    stripePriceEnvKey: "STRIPE_PRICE_ID_PRO_MONTHLY",
    marketing: Object.freeze({
      audience: "For busier websites",
      summary: "More room for higher monthly customer volume",
      detail: "More monthly AI capacity for higher customer volume",
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
    monthlyPriceLabel: `${formatUsdPriceFromCents(plan.monthlyPriceCents)}/month`,
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
