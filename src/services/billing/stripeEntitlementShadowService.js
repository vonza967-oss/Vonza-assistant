import {
  STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS,
  mapStripeSubscriptionItems,
} from "./stripeSubscriptionItemMapper.js";
import { cleanText } from "../../utils/text.js";

const LOG_PREFIX = "[stripe entitlement shadow]";

function buildShadowSummary({ eventId, eventType, ownerUserId }, mapped) {
  const classifications = Array.isArray(mapped?.classifications)
    ? mapped.classifications
    : [];
  const workspacePlan = classifications.find(
    (entry) =>
      entry.classification
        === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.WORKSPACE_BASE_PLAN
  )?.planKey || null;
  const productKeys = classifications
    .filter(
      (entry) =>
        entry.classification
          === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.PRODUCT_ENTITLEMENT
    )
    .map((entry) => cleanText(entry.productKey))
    .filter(Boolean);
  const unknownPriceCount = mapped?.summary?.unknownCount
    ?? classifications.filter(
      (entry) =>
        entry.classification === STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS.UNKNOWN
    ).length;

  return {
    event_id: cleanText(eventId) || null,
    event_type: cleanText(eventType) || null,
    owner_user_id: cleanText(ownerUserId || mapped?.ownerUserId) || null,
    subscription_id: cleanText(mapped?.subscriptionId) || null,
    customer_id: cleanText(mapped?.customerId) || null,
    workspace_plan: cleanText(workspacePlan) || null,
    product_keys: [...new Set(productKeys)],
    unknown_price_count: unknownPriceCount,
    missing_product_price_env_keys:
      Array.isArray(mapped?.summary?.missingProductPriceEnvKeys)
        ? mapped.summary.missingProductPriceEnvKeys.map(cleanText).filter(Boolean)
        : [],
  };
}

function safeWarn(logger, message, details) {
  try {
    logger.warn(message, details);
  } catch {
    // Shadow logging must never affect webhook processing.
  }
}

export async function logStripeEntitlementShadow(input = {}, options = {}) {
  const logger = options.logger || console;

  try {
    const mapped = (options.mapSubscriptionItems || mapStripeSubscriptionItems)(
      input.subscription,
      options.env || process.env
    );
    const summary = buildShadowSummary(input, mapped);
    const hasKnownOwner = Boolean(summary.owner_user_id);

    if (hasKnownOwner && summary.unknown_price_count > 0) {
      logger.warn(LOG_PREFIX, summary);
    } else {
      logger.info(LOG_PREFIX, summary);
    }
  } catch (error) {
    safeWarn(logger, `${LOG_PREFIX} failed`, {
      event_id: cleanText(input.eventId) || null,
      event_type: cleanText(input.eventType) || null,
      owner_user_id: cleanText(input.ownerUserId) || null,
      subscription_id: cleanText(input.subscription?.id) || null,
      customer_id: cleanText(input.subscription?.customer) || null,
      message: cleanText(error?.message || "Shadow logging failed."),
    });
  }
}
