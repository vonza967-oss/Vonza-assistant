import Stripe from "stripe";

import {
  BILLING_INTERVAL_MONTH,
  listBillingPlans,
} from "../../config/billingPlans.js";
import { cleanText } from "../../utils/text.js";

const STRIPE_API_VERSION = "2026-02-25.clover";

function getExpectedPlanPriceChecks(env = process.env) {
  return listBillingPlans().map((plan) => ({
    planKey: plan.key,
    displayName: plan.displayName,
    envKey: plan.stripePriceEnvKey,
    priceId: cleanText(env[plan.stripePriceEnvKey]),
    expectedUnitAmount: Number(plan.monthlyPriceHuf || 0),
    expectedCurrency: "huf",
    expectedInterval: BILLING_INTERVAL_MONTH,
    expectedIntervalCount: 1,
  }));
}

function createStripeClient(secretKey) {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

function formatPlanIssue(check, message) {
  return `Stripe price verification failed for plan '${check.planKey}' (${check.envKey}): ${message}`;
}

function validateStripePrice(check, price) {
  const issues = [];

  if (price?.active !== true) {
    issues.push(formatPlanIssue(check, "price must be active."));
  }

  if (cleanText(price?.currency).toLowerCase() !== check.expectedCurrency) {
    issues.push(formatPlanIssue(check, "currency must be huf."));
  }

  if (cleanText(price?.type).toLowerCase() !== "recurring") {
    issues.push(formatPlanIssue(check, "type must be recurring."));
  }

  if (cleanText(price?.recurring?.interval).toLowerCase() !== check.expectedInterval) {
    issues.push(formatPlanIssue(check, "recurring interval must be month."));
  }

  if (Number(price?.recurring?.interval_count || 0) !== check.expectedIntervalCount) {
    issues.push(formatPlanIssue(check, "recurring interval_count must be 1."));
  }

  if (Number(price?.unit_amount || 0) !== check.expectedUnitAmount) {
    issues.push(formatPlanIssue(
      check,
      `unit_amount must be ${check.expectedUnitAmount}.`
    ));
  }

  return issues;
}

export async function verifyConfiguredStripePlanPrices({
  env = process.env,
  stripe,
  createClient = createStripeClient,
  required = false,
} = {}) {
  const secretKey = cleanText(env.STRIPE_SECRET_KEY);
  const injectedStripe = stripe || null;

  if (!required && !injectedStripe) {
    return {
      ok: true,
      skipped: true,
      reason: "Stripe price verification is skipped outside staging/production unless a Stripe client is injected.",
      issues: [],
      checked: [],
    };
  }

  if (!injectedStripe && !secretKey) {
    return {
      ok: true,
      skipped: true,
      reason: "STRIPE_SECRET_KEY is not configured.",
      issues: [],
      checked: [],
    };
  }

  const checks = getExpectedPlanPriceChecks(env);
  const issues = [];
  const checked = [];
  const stripeClient = injectedStripe || createClient(secretKey);

  for (const check of checks) {
    if (!check.priceId) {
      issues.push(formatPlanIssue(check, "price ID env var is not configured."));
      continue;
    }

    try {
      const price = await stripeClient.prices.retrieve(check.priceId);
      checked.push({
        planKey: check.planKey,
        envKey: check.envKey,
      });
      issues.push(...validateStripePrice(check, price));
    } catch {
      issues.push(formatPlanIssue(check, "Stripe API request failed."));
    }
  }

  return {
    ok: issues.length === 0,
    skipped: false,
    issues,
    checked,
  };
}
