import Stripe from "stripe";

import {
  getBillingPlan,
  getStripePriceIdForPlan,
  normalizeBillingPlanKey,
  findBillingPlanByPriceId,
} from "../../config/billingPlans.js";
import {
  getPublicAppUrl,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "../../config/env.js";
import { cleanText } from "../../utils/text.js";
import { buildBillingSyncPayload } from "./billingUsageService.js";

const STRIPE_API_VERSION = "2026-02-25.clover";

let stripeClient = null;

function buildMissingStripePriceError(planKey) {
  const plan = getBillingPlan(planKey);
  const error = new Error(`${plan.stripePriceEnvKey} is not configured.`);
  error.statusCode = 500;
  return error;
}

function getConfiguredPlanPrice(planKey) {
  const plan = getBillingPlan(planKey);
  const priceId = getStripePriceIdForPlan(plan.key);

  if (!priceId) {
    throw buildMissingStripePriceError(plan.key);
  }

  return {
    plan,
    priceId,
  };
}

function toIsoStringFromUnixSeconds(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    const error = new Error("STRIPE_SECRET_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
  return stripeClient;
}

async function resolvePurchasedPlan(session, options = {}) {
  const normalizedSessionId = cleanText(session?.id);
  const stripe = options.stripe || getStripeClient();

  if (!normalizedSessionId) {
    return null;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(normalizedSessionId, {
    limit: 20,
  });
  const matchingItem = (lineItems?.data || []).find((item) => {
    const priceId = cleanText(item?.price?.id || item?.price);
    return Boolean(findBillingPlanByPriceId(priceId));
  });

  if (!matchingItem) {
    return null;
  }

  const priceId = cleanText(matchingItem?.price?.id || matchingItem?.price);
  const plan = findBillingPlanByPriceId(priceId);

  if (!plan) {
    return null;
  }

  return {
    plan,
    priceId,
  };
}

async function retrieveStripeSubscription(subscriptionId, stripe = getStripeClient()) {
  const normalizedSubscriptionId = cleanText(subscriptionId);
  return normalizedSubscriptionId
    ? stripe.subscriptions.retrieve(normalizedSubscriptionId)
    : null;
}

export async function createHostedCheckoutSession({ user, email, planKey }, options = {}) {
  const normalizedPlanKey = normalizeBillingPlanKey(planKey);
  const { plan, priceId } = getConfiguredPlanPrice(normalizedPlanKey);
  const appUrl = getPublicAppUrl();
  const stripe = options.stripe || getStripeClient();
  const ownerUserId = cleanText(user?.id);
  const customerEmail = cleanText(email || user?.email);

  if (!ownerUserId) {
    const error = new Error("Authenticated user is required.");
    error.statusCode = 401;
    throw error;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url:
      `${appUrl}/dashboard?payment=success&plan=${encodeURIComponent(plan.key)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      `${appUrl}/dashboard?payment=cancel&plan=${encodeURIComponent(plan.key)}`,
    customer_email: customerEmail || undefined,
    metadata: {
      owner_user_id: ownerUserId,
      plan_key: plan.key,
    },
    subscription_data: {
      metadata: {
        owner_user_id: ownerUserId,
        plan_key: plan.key,
      },
    },
  });

  return session;
}

export async function verifySuccessfulCheckout({ sessionId, ownerUserId, planKey }, options = {}) {
  const normalizedSessionId = cleanText(sessionId);
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedSessionId) {
    const error = new Error("session_id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedOwnerUserId) {
    const error = new Error("Authenticated user is required.");
    error.statusCode = 401;
    throw error;
  }

  const stripe = options.stripe || getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(normalizedSessionId);

  if (!session) {
    const error = new Error("Checkout session not found.");
    error.statusCode = 404;
    throw error;
  }

  if (cleanText(session.metadata?.owner_user_id) !== normalizedOwnerUserId) {
    const error = new Error("This checkout session does not belong to the signed-in user.");
    error.statusCode = 403;
    throw error;
  }

  if (session.payment_status !== "paid") {
    const error = new Error("Payment is not completed yet.");
    error.statusCode = 400;
    throw error;
  }

  const purchasedPlan = await resolvePurchasedPlan(session, { stripe });

  if (!purchasedPlan) {
    const error = new Error("This checkout session does not match a configured Vonza monthly plan.");
    error.statusCode = 403;
    throw error;
  }

  if (
    planKey
    && normalizeBillingPlanKey(planKey) !== normalizeBillingPlanKey(purchasedPlan.plan.key)
  ) {
    const error = new Error("This checkout session does not match the selected Vonza plan.");
    error.statusCode = 403;
    throw error;
  }

  return {
    ...session,
    vonzaPlanKey: purchasedPlan.plan.key,
    vonzaPriceId: purchasedPlan.priceId,
  };
}

export function constructStripeWebhookEvent({ payload, signature }) {
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret) {
    const error = new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    error.statusCode = 500;
    throw error;
  }

  if (!signature) {
    const error = new Error("Missing Stripe signature.");
    error.statusCode = 400;
    throw error;
  }

  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function getPaidCheckoutDetailsFromSession(session, options = {}) {
  if (!session || session.payment_status !== "paid") {
    return null;
  }

  const ownerUserId = cleanText(session.metadata?.owner_user_id);

  if (!ownerUserId) {
    return null;
  }

  const purchasedPlan = await resolvePurchasedPlan(session, {
    stripe: options.stripe,
  });

  if (!purchasedPlan) {
    return null;
  }

  return {
    ownerUserId,
    planKey: purchasedPlan.plan.key,
    priceId: purchasedPlan.priceId,
    checkoutSessionId: cleanText(session.id),
    stripeCustomerId: cleanText(session.customer),
    stripeSubscriptionId: cleanText(session.subscription),
  };
}

export async function buildBillingSyncPayloadFromCheckoutSession(session, options = {}) {
  const stripe = options.stripe || getStripeClient();
  const paidDetails = await getPaidCheckoutDetailsFromSession(session, { stripe });

  if (!paidDetails) {
    return null;
  }

  const subscription = await retrieveStripeSubscription(
    paidDetails.stripeSubscriptionId,
    stripe
  );
  const primaryItem = subscription?.items?.data?.[0] || null;
  const priceId = cleanText(primaryItem?.price?.id || paidDetails.priceId);
  const productId = cleanText(primaryItem?.price?.product);
  const resolvedPlan = findBillingPlanByPriceId(priceId) || getBillingPlan(paidDetails.planKey);

  return buildBillingSyncPayload({
    ownerUserId: paidDetails.ownerUserId,
    planKey: resolvedPlan.key,
    billingInterval: resolvedPlan.billingInterval,
    stripeCustomerId: cleanText(subscription?.customer || paidDetails.stripeCustomerId),
    stripeSubscriptionId: cleanText(subscription?.id || paidDetails.stripeSubscriptionId),
    stripePriceId: priceId,
    stripeProductId: productId,
    lastCheckoutSessionId: paidDetails.checkoutSessionId,
    subscriptionStatus: cleanText(subscription?.status || "active"),
    currentPeriodStart: toIsoStringFromUnixSeconds(subscription?.current_period_start),
    currentPeriodEnd: toIsoStringFromUnixSeconds(subscription?.current_period_end),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
    canceledAt: toIsoStringFromUnixSeconds(subscription?.canceled_at),
  });
}

export async function buildBillingSyncPayloadFromSubscription(subscription, options = {}) {
  const normalizedSubscriptionId = cleanText(subscription?.id);

  if (!normalizedSubscriptionId) {
    return null;
  }

  const primaryItem = subscription?.items?.data?.[0] || null;
  const priceId = cleanText(primaryItem?.price?.id);
  const resolvedPlan = findBillingPlanByPriceId(priceId)
    || getBillingPlan(subscription?.metadata?.plan_key);
  const ownerUserId = cleanText(
    options.ownerUserId
    || subscription?.metadata?.owner_user_id
  );

  if (!ownerUserId) {
    return null;
  }

  return buildBillingSyncPayload({
    ownerUserId,
    planKey: resolvedPlan.key,
    billingInterval: resolvedPlan.billingInterval,
    stripeCustomerId: cleanText(subscription?.customer),
    stripeSubscriptionId: normalizedSubscriptionId,
    stripePriceId: priceId,
    stripeProductId: cleanText(primaryItem?.price?.product),
    lastCheckoutSessionId: cleanText(options.lastCheckoutSessionId),
    subscriptionStatus: cleanText(subscription?.status || "pending"),
    currentPeriodStart: toIsoStringFromUnixSeconds(subscription?.current_period_start),
    currentPeriodEnd: toIsoStringFromUnixSeconds(subscription?.current_period_end),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
    canceledAt: toIsoStringFromUnixSeconds(subscription?.canceled_at),
  });
}

export async function changeStripeSubscriptionPlan(options = {}) {
  const normalizedSubscriptionId = cleanText(options.subscriptionId);
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const normalizedPlanKey = normalizeBillingPlanKey(options.planKey);

  if (!normalizedSubscriptionId) {
    const error = new Error("An active Stripe subscription is required before changing plans.");
    error.statusCode = 409;
    throw error;
  }

  const { plan, priceId } = getConfiguredPlanPrice(normalizedPlanKey);
  const stripe = options.stripe || getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(normalizedSubscriptionId);
  const subscriptionItem = subscription?.items?.data?.[0] || null;

  if (!subscriptionItem?.id) {
    const error = new Error("Stripe could not find the subscription item for this workspace.");
    error.statusCode = 409;
    throw error;
  }

  if (cleanText(subscriptionItem.price?.id) === priceId) {
    return {
      changed: false,
      planKey: plan.key,
      subscription,
    };
  }

  const updatedSubscription = await stripe.subscriptions.update(normalizedSubscriptionId, {
    items: [
      {
        id: subscriptionItem.id,
        price: priceId,
      },
    ],
    proration_behavior: "create_prorations",
    metadata: {
      ...(subscription?.metadata || {}),
      owner_user_id: normalizedOwnerUserId,
      plan_key: plan.key,
    },
  });

  return {
    changed: true,
    planKey: plan.key,
    subscription: updatedSubscription,
  };
}

export async function getPaidOwnerIdFromCheckoutSession(session, options = {}) {
  const details = await getPaidCheckoutDetailsFromSession(session, options);
  return details?.ownerUserId || null;
}

export function isStripeConfigError(error) {
  return /STRIPE_(SECRET_KEY|PRICE_ID(?:_[A-Z_]+)?|WEBHOOK_SECRET) is not configured/i.test(
    cleanText(error?.message)
  );
}

export function isStripeCheckoutMinimumAmountError(error) {
  const message = cleanText(error?.message);

  return /checkout session'?s total amount due must add up to at least/i.test(message)
    || /amount must convert to at least/i.test(message);
}

export function getStripeCheckoutConfigurationErrorMessage(error) {
  if (!isStripeCheckoutMinimumAmountError(error)) {
    return "";
  }

  return "Stripe checkout is using a price that is below Stripe's minimum allowed amount for the configured currency. Update STRIPE_PRICE_ID_STARTER_MONTHLY, STRIPE_PRICE_ID_GROWTH_MONTHLY, or STRIPE_PRICE_ID_PRO_MONTHLY to valid Stripe prices in the same account and mode, then retry checkout.";
}
