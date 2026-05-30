import { listBillingPlans } from "../../config/billingPlans.js";
import { listProductStripePriceMappings } from "../../config/productCatalog.js";

export const STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS = Object.freeze({
  WORKSPACE_BASE_PLAN: "workspace_base_plan",
  PRODUCT_ENTITLEMENT: "product_entitlement",
  UNKNOWN: "unknown",
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readStripePriceId(item = {}) {
  return cleanText(item?.price?.id || item?.price);
}

function listWorkspaceBasePlanPriceMappings(env = process.env) {
  return listBillingPlans().map((plan) => ({
    planKey: plan.key,
    label: plan.displayName,
    interval: plan.billingInterval,
    stripePriceEnvKey: plan.stripePriceEnvKey,
    stripePriceId: cleanText(env?.[plan.stripePriceEnvKey]),
  }));
}

function buildPriceLookup(mappings, keyName) {
  return new Map(
    mappings
      .filter((mapping) => mapping.stripePriceId)
      .map((mapping) => [mapping.stripePriceId, mapping[keyName]])
  );
}

function classifySubscriptionItem(item, lookups) {
  const priceId = readStripePriceId(item);
  const planKey = lookups.basePlanByPriceId.get(priceId) || null;

  if (planKey) {
    return {
      subscriptionItemId: cleanText(item?.id) || null,
      priceId,
      classification: STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.WORKSPACE_BASE_PLAN,
      planKey,
      productKey: null,
      quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
    };
  }

  const productKey = lookups.productByPriceId.get(priceId) || null;

  if (productKey) {
    return {
      subscriptionItemId: cleanText(item?.id) || null,
      priceId,
      classification: STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.PRODUCT_ENTITLEMENT,
      planKey: null,
      productKey,
      quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
    };
  }

  return {
    subscriptionItemId: cleanText(item?.id) || null,
    priceId,
    classification: STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.UNKNOWN,
    planKey: null,
    productKey: null,
    quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
  };
}

export function mapStripeSubscriptionItems(subscription = {}, env = process.env) {
  const items = Array.isArray(subscription?.items?.data)
    ? subscription.items.data
    : [];
  const productMappings = listProductStripePriceMappings(env);
  const lookups = {
    basePlanByPriceId: buildPriceLookup(listWorkspaceBasePlanPriceMappings(env), "planKey"),
    productByPriceId: buildPriceLookup(productMappings, "productKey"),
  };
  const classifications = items.map((item) => classifySubscriptionItem(item, lookups));

  return {
    subscriptionId: cleanText(subscription?.id) || null,
    customerId: cleanText(subscription?.customer) || null,
    ownerUserId: cleanText(
      subscription?.ownerUserId
        || subscription?.owner_user_id
        || subscription?.metadata?.owner_user_id
    ) || null,
    classifications,
    summary: {
      workspaceBasePlanCount: classifications.filter(
        (entry) =>
          entry.classification
            === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.WORKSPACE_BASE_PLAN
      ).length,
      productEntitlementCount: classifications.filter(
        (entry) =>
          entry.classification
            === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.PRODUCT_ENTITLEMENT
      ).length,
      unknownCount: classifications.filter(
        (entry) =>
          entry.classification === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.UNKNOWN
      ).length,
      missingProductPriceEnvKeys: productMappings
        .filter((mapping) => !mapping.stripePriceId)
        .map((mapping) => mapping.stripePriceEnvKey),
    },
  };
}
