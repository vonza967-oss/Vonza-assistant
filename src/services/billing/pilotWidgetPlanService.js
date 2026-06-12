import {
  PILOT_FREE_WIDGET_PLAN_KEY,
  getBillingPlan,
} from "../../config/billingPlans.js";
import { OWNER_PRODUCT_ENTITLEMENT_TABLE } from "../../config/constants.js";
import { PRODUCT_KEYS } from "../../config/productCatalog.js";
import { cleanText } from "../../utils/text.js";
import {
  getOwnerBillingRecord,
  syncOwnerBillingState,
} from "./billingUsageService.js";

const ACTIVE_STRIPE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const PILOT_WIDGET_ENTITLEMENT_SELECT = [
  "id",
  "owner_user_id",
  "product_key",
  "entitlement_status",
  "source",
  "plan_key",
  "feature_caps",
  "metadata",
  "updated_at",
].join(", ");

function buildMissingOwnerError() {
  const error = new Error("owner_user_id is required.");
  error.statusCode = 400;
  return error;
}

function buildExistingPaidPlanError() {
  const error = new Error("This owner already has an active Stripe subscription. Use the paid billing flow instead.");
  error.statusCode = 409;
  return error;
}

function normalizeJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function activatePilotWidgetPlan(supabase, options = {}) {
  const ownerUserId = cleanText(options.ownerUserId || options.owner_user_id);

  if (!ownerUserId) {
    throw buildMissingOwnerError();
  }

  const existingBilling = await getOwnerBillingRecord(supabase, {
    ownerUserId,
  });

  if (
    cleanText(existingBilling?.stripeSubscriptionId)
    && ACTIVE_STRIPE_SUBSCRIPTION_STATUSES.has(
      cleanText(existingBilling?.subscriptionStatus).toLowerCase()
    )
  ) {
    throw buildExistingPaidPlanError();
  }

  const plan = getBillingPlan(PILOT_FREE_WIDGET_PLAN_KEY);
  const billing = await syncOwnerBillingState(supabase, {
    ownerUserId,
    planKey: plan.key,
    billingInterval: plan.billingInterval,
    subscriptionStatus: "free",
    cancelAtPeriodEnd: false,
  });
  const now = new Date().toISOString();
  const payload = {
    owner_user_id: ownerUserId,
    product_key: PRODUCT_KEYS.WEBSITE_WIDGET,
    entitlement_status: "free",
    source: "manual_free",
    plan_key: plan.key,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_item_id: null,
    stripe_price_id: null,
    stripe_product_id: null,
    feature_caps: {
      ...normalizeJsonObject(options.featureCaps || options.feature_caps),
      product_scope: PRODUCT_KEYS.WEBSITE_WIDGET,
      monthly_ai_budget_cents: plan.includedAiBudgetCents,
    },
    metadata: {
      ...normalizeJsonObject(options.metadata),
      activation_reason: cleanText(options.reason) || "pilot_widget_testing",
      activated_by_user_id: cleanText(options.activatedByUserId || options.activated_by_user_id) || null,
      activated_by_email: cleanText(options.activatedByEmail || options.activated_by_email) || null,
      checkout_required: false,
      plan_key: plan.key,
    },
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(OWNER_PRODUCT_ENTITLEMENT_TABLE)
    .upsert(payload, {
      onConflict: "owner_user_id,product_key",
    })
    .select(PILOT_WIDGET_ENTITLEMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    ok: true,
    ownerUserId,
    planKey: plan.key,
    accessStatus: "active",
    billing,
    entitlement: data || {
      owner_user_id: ownerUserId,
      product_key: PRODUCT_KEYS.WEBSITE_WIDGET,
      entitlement_status: "free",
      source: "manual_free",
      plan_key: plan.key,
      feature_caps: payload.feature_caps,
      metadata: payload.metadata,
      updated_at: now,
    },
  };
}
