import {
  DEFAULT_BILLING_PLAN_KEY,
  formatUsdPriceFromCents,
  getBillingPlan,
  listBillingUpgradePlans,
  normalizeBillingPlanKey,
} from "../../config/billingPlans.js";
import {
  OWNER_AI_USAGE_LEDGER_TABLE,
  OWNER_BILLING_ACCOUNT_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { updateOwnedAccessStatus } from "../agents/agentService.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const SUSPENDED_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
  "past_due",
  "paused",
  "unpaid",
]);
const MODEL_USAGE_RATES_CENTS_PER_MILLION = Object.freeze({
  "gpt-4o": Object.freeze({
    input: 250,
    cachedInput: 125,
    output: 1000,
  }),
  "gpt-4o-mini": Object.freeze({
    input: 15,
    cachedInput: 7.5,
    output: 60,
  }),
});

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205"
    || error?.code === "PGRST204"
    || error?.code === "42703"
    || error?.code === "42P01"
    || message.includes(`'public.${relationName}'`)
    || message.includes(`${relationName} was not found`)
  );
}

function buildMissingBillingSchemaError(phase = "request") {
  const error = new Error(
    `[${phase}] Missing required billing schema for '${OWNER_BILLING_ACCOUNT_TABLE}' and '${OWNER_AI_USAGE_LEDGER_TABLE}'. Apply the latest database migration before running this build.`
  );
  error.statusCode = 500;
  error.code = "schema_not_ready";
  return error;
}

function normalizeSubscriptionStatus(value) {
  return cleanText(value).toLowerCase() || "pending";
}

function mapSubscriptionStatusToAccessStatus(subscriptionStatus) {
  const normalizedStatus = normalizeSubscriptionStatus(subscriptionStatus);

  if (ACTIVE_SUBSCRIPTION_STATUSES.has(normalizedStatus)) {
    return "active";
  }

  if (SUSPENDED_SUBSCRIPTION_STATUSES.has(normalizedStatus)) {
    return "suspended";
  }

  return "pending";
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function createCalendarMonthPeriod(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const start = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    1,
    0,
    0,
    0,
    0
  ));
  const end = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth() + 1,
    1,
    0,
    0,
    0,
    0
  ));

  return {
    currentPeriodStart: start.toISOString(),
    currentPeriodEnd: end.toISOString(),
  };
}

function normalizeCurrentPeriod(record = {}) {
  const currentPeriodStart = toIsoString(record.currentPeriodStart || record.current_period_start);
  const currentPeriodEnd = toIsoString(record.currentPeriodEnd || record.current_period_end);

  if (currentPeriodStart && currentPeriodEnd) {
    return {
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  return createCalendarMonthPeriod();
}

function mapUpgradeOption(plan) {
  return {
    planKey: plan.key,
    displayName: plan.displayName,
    monthlyPriceCents: plan.monthlyPriceCents,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    monthlyPriceLabel: `${formatUsdPriceFromCents(plan.monthlyPriceCents)}/month`,
    checkoutLabel: plan.checkoutLabel,
  };
}

function buildUsageSummary(usedCents, includedCents) {
  const normalizedIncluded = Math.max(0, Number(includedCents || 0));
  const normalizedUsed = Math.max(0, Number(usedCents || 0));
  const percentUsed = normalizedIncluded > 0
    ? Math.min(100, (normalizedUsed / normalizedIncluded) * 100)
    : 100;
  const remainingCents = Math.max(0, normalizedIncluded - normalizedUsed);

  if (normalizedIncluded <= 0 || normalizedUsed >= normalizedIncluded || percentUsed >= 100) {
    return {
      usedCents: normalizedUsed,
      includedCents: normalizedIncluded,
      remainingCents,
      percentUsed: 100,
      warningState: "capped",
      warningThreshold: 100,
      tone: "danger",
      statusLabel: "Monthly capacity reached",
      ownerMessage:
        "This workspace has reached its included monthly AI capacity. New visitor replies now fall back to contact capture until the next billing period or a plan upgrade.",
      isCapped: true,
    };
  }

  if (percentUsed >= 95) {
    return {
      usedCents: normalizedUsed,
      includedCents: normalizedIncluded,
      remainingCents,
      percentUsed,
      warningState: "warning_95",
      warningThreshold: 95,
      tone: "danger",
      statusLabel: "Very close to the monthly capacity",
      ownerMessage:
        "This workspace is very close to this month's AI capacity. Upgrade now if you expect more customer traffic.",
      isCapped: false,
    };
  }

  if (percentUsed >= 80) {
    return {
      usedCents: normalizedUsed,
      includedCents: normalizedIncluded,
      remainingCents,
      percentUsed,
      warningState: "warning_80",
      warningThreshold: 80,
      tone: "warning",
      statusLabel: "Approaching the monthly capacity",
      ownerMessage:
        "This workspace has used about 80% of its included monthly AI capacity. It is a good time to plan an upgrade if traffic is rising.",
      isCapped: false,
    };
  }

  return {
    usedCents: normalizedUsed,
    includedCents: normalizedIncluded,
    remainingCents,
    percentUsed,
    warningState: "normal",
    warningThreshold: 0,
    tone: "ok",
    statusLabel: "Within the included monthly capacity",
    ownerMessage: "Monthly AI usage is comfortably within the included capacity.",
    isCapped: false,
  };
}

function mapOwnerBillingRecord(record = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const planKey = normalizeBillingPlanKey(
    record.planKey || record.plan_key,
    DEFAULT_BILLING_PLAN_KEY
  );
  const normalizedPeriod = normalizeCurrentPeriod(record);

  return {
    ownerUserId: cleanText(record.ownerUserId || record.owner_user_id),
    planKey,
    billingInterval: cleanText(record.billingInterval || record.billing_interval) || "month",
    stripeCustomerId: cleanText(record.stripeCustomerId || record.stripe_customer_id),
    stripeSubscriptionId: cleanText(record.stripeSubscriptionId || record.stripe_subscription_id),
    stripePriceId: cleanText(record.stripePriceId || record.stripe_price_id),
    stripeProductId: cleanText(record.stripeProductId || record.stripe_product_id),
    lastCheckoutSessionId: cleanText(record.lastCheckoutSessionId || record.last_checkout_session_id),
    subscriptionStatus: normalizeSubscriptionStatus(
      record.subscriptionStatus || record.subscription_status
    ),
    cancelAtPeriodEnd: record.cancelAtPeriodEnd === true || record.cancel_at_period_end === true,
    canceledAt: toIsoString(record.canceledAt || record.canceled_at),
    currentPeriodStart: normalizedPeriod.currentPeriodStart,
    currentPeriodEnd: normalizedPeriod.currentPeriodEnd,
    createdAt: toIsoString(record.createdAt || record.created_at),
    updatedAt: toIsoString(record.updatedAt || record.updated_at),
  };
}

function mapUsageLedgerRecord(record = {}) {
  return {
    ownerUserId: cleanText(record.ownerUserId || record.owner_user_id),
    billingPeriodStart: toIsoString(record.billingPeriodStart || record.billing_period_start),
    billingPeriodEnd: toIsoString(record.billingPeriodEnd || record.billing_period_end),
    estimatedCostCents: Number(record.estimatedCostCents || record.estimated_cost_cents || 0) || 0,
  };
}

function getModelUsageRates(modelName = "") {
  const normalizedModelName = cleanText(modelName).toLowerCase();
  const exactMatch = MODEL_USAGE_RATES_CENTS_PER_MILLION[normalizedModelName];

  if (exactMatch) {
    return exactMatch;
  }

  const familyKey = Object.keys(MODEL_USAGE_RATES_CENTS_PER_MILLION).find((candidate) =>
    normalizedModelName.startsWith(candidate)
  );

  return familyKey
    ? MODEL_USAGE_RATES_CENTS_PER_MILLION[familyKey]
    : MODEL_USAGE_RATES_CENTS_PER_MILLION["gpt-4o-mini"];
}

function sumUsageForPeriod(records = [], currentPeriodStart, currentPeriodEnd) {
  return records
    .map((record) => mapUsageLedgerRecord(record))
    .filter((record) =>
      record.billingPeriodStart === currentPeriodStart
      && record.billingPeriodEnd === currentPeriodEnd
    )
    .reduce((sum, record) => sum + record.estimatedCostCents, 0);
}

async function listOwnerUsageLedgerRows(supabase, ownerUserId) {
  const normalizedOwnerUserId = cleanText(ownerUserId);

  if (!normalizedOwnerUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from(OWNER_AI_USAGE_LEDGER_TABLE)
    .select("owner_user_id, billing_period_start, billing_period_end, estimated_cost_cents")
    .eq("owner_user_id", normalizedOwnerUserId);

  if (error) {
    if (isMissingRelationError(error, OWNER_AI_USAGE_LEDGER_TABLE)) {
      throw buildMissingBillingSchemaError("request");
    }

    throw error;
  }

  return data || [];
}

async function saveOwnerBillingRecord(supabase, payload = {}) {
  const normalizedOwnerUserId = cleanText(payload.ownerUserId || payload.owner_user_id);

  if (!normalizedOwnerUserId) {
    const error = new Error("owner_user_id is required");
    error.statusCode = 400;
    throw error;
  }

  const existingRecord = await getOwnerBillingRecord(supabase, {
    ownerUserId: normalizedOwnerUserId,
  });
  const persistedPayload = {
    owner_user_id: normalizedOwnerUserId,
    plan_key: normalizeBillingPlanKey(payload.planKey || payload.plan_key),
    billing_interval: cleanText(payload.billingInterval || payload.billing_interval) || "month",
    stripe_customer_id: cleanText(payload.stripeCustomerId || payload.stripe_customer_id) || null,
    stripe_subscription_id: cleanText(payload.stripeSubscriptionId || payload.stripe_subscription_id) || null,
    stripe_price_id: cleanText(payload.stripePriceId || payload.stripe_price_id) || null,
    stripe_product_id: cleanText(payload.stripeProductId || payload.stripe_product_id) || null,
    last_checkout_session_id: cleanText(
      payload.lastCheckoutSessionId || payload.last_checkout_session_id
    ) || null,
    subscription_status: normalizeSubscriptionStatus(
      payload.subscriptionStatus || payload.subscription_status
    ),
    current_period_start: toIsoString(payload.currentPeriodStart || payload.current_period_start),
    current_period_end: toIsoString(payload.currentPeriodEnd || payload.current_period_end),
    cancel_at_period_end:
      payload.cancelAtPeriodEnd === true || payload.cancel_at_period_end === true,
    canceled_at: toIsoString(payload.canceledAt || payload.canceled_at),
    updated_at: new Date().toISOString(),
  };

  const query = existingRecord
    ? supabase.from(OWNER_BILLING_ACCOUNT_TABLE).update(persistedPayload).eq(
      "owner_user_id",
      normalizedOwnerUserId
    )
    : supabase.from(OWNER_BILLING_ACCOUNT_TABLE).insert({
      ...persistedPayload,
      created_at: new Date().toISOString(),
    });
  const { error } = await query;

  if (error) {
    if (isMissingRelationError(error, OWNER_BILLING_ACCOUNT_TABLE)) {
      throw buildMissingBillingSchemaError("request");
    }

    throw error;
  }
}

export async function assertBillingSchemaReady(supabase, options = {}) {
  const { error: billingError } = await supabase
    .from(OWNER_BILLING_ACCOUNT_TABLE)
    .select(
      "owner_user_id, plan_key, current_period_start, current_period_end, subscription_status"
    )
    .limit(1);

  if (billingError) {
    if (isMissingRelationError(billingError, OWNER_BILLING_ACCOUNT_TABLE)) {
      throw buildMissingBillingSchemaError(options.phase || "startup");
    }

    throw billingError;
  }

  const { error: usageError } = await supabase
    .from(OWNER_AI_USAGE_LEDGER_TABLE)
    .select(
      "id, owner_user_id, billing_period_start, billing_period_end, estimated_cost_cents"
    )
    .limit(1);

  if (usageError) {
    if (isMissingRelationError(usageError, OWNER_AI_USAGE_LEDGER_TABLE)) {
      throw buildMissingBillingSchemaError(options.phase || "startup");
    }

    throw usageError;
  }
}

export async function getOwnerBillingRecord(supabase, options = {}) {
  const normalizedOwnerUserId = cleanText(options.ownerUserId);

  if (!normalizedOwnerUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from(OWNER_BILLING_ACCOUNT_TABLE)
    .select("*")
    .eq("owner_user_id", normalizedOwnerUserId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, OWNER_BILLING_ACCOUNT_TABLE)) {
      throw buildMissingBillingSchemaError("request");
    }

    throw error;
  }

  return data ? mapOwnerBillingRecord(data) : null;
}

export async function getOwnerBillingSnapshot(supabase, options = {}) {
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const normalizedAccessStatus = cleanText(options.accessStatus).toLowerCase();
  const record = normalizedOwnerUserId
    ? await getOwnerBillingRecord(supabase, { ownerUserId: normalizedOwnerUserId })
    : null;
  const resolvedPlan = getBillingPlan(
    record?.planKey || normalizeBillingPlanKey(options.planKey, DEFAULT_BILLING_PLAN_KEY)
  );
  const currentPeriod = normalizeCurrentPeriod(record || {});
  const usageRows = normalizedOwnerUserId
    ? await listOwnerUsageLedgerRows(supabase, normalizedOwnerUserId)
    : [];
  const usage = buildUsageSummary(
    sumUsageForPeriod(
      usageRows,
      currentPeriod.currentPeriodStart,
      currentPeriod.currentPeriodEnd
    ),
    resolvedPlan.includedAiBudgetCents
  );
  const subscriptionStatus = record?.subscriptionStatus
    || (normalizedAccessStatus === "active" ? "legacy_active" : "pending");

  return {
    ownerUserId: normalizedOwnerUserId,
    planKey: resolvedPlan.key,
    displayName: resolvedPlan.displayName,
    monthlyPriceCents: resolvedPlan.monthlyPriceCents,
    monthlyPriceUsd: resolvedPlan.monthlyPriceUsd,
    monthlyPriceLabel: `${formatUsdPriceFromCents(resolvedPlan.monthlyPriceCents)}/month`,
    billingInterval: resolvedPlan.billingInterval,
    includedAiBudgetCents: resolvedPlan.includedAiBudgetCents,
    checkoutLabel: resolvedPlan.checkoutLabel,
    subscriptionStatus,
    currentPeriodStart: currentPeriod.currentPeriodStart,
    currentPeriodEnd: currentPeriod.currentPeriodEnd,
    hasActiveSubscription: ACTIVE_SUBSCRIPTION_STATUSES.has(
      normalizeSubscriptionStatus(subscriptionStatus)
    ),
    usage,
    upgradeOptions: listBillingUpgradePlans(resolvedPlan.key).map((plan) => mapUpgradeOption(plan)),
  };
}

export function buildBillingSyncPayload(options = {}) {
  const period = normalizeCurrentPeriod(options);

  return {
    ownerUserId: cleanText(options.ownerUserId),
    planKey: normalizeBillingPlanKey(options.planKey),
    billingInterval: cleanText(options.billingInterval) || "month",
    stripeCustomerId: cleanText(options.stripeCustomerId),
    stripeSubscriptionId: cleanText(options.stripeSubscriptionId),
    stripePriceId: cleanText(options.stripePriceId),
    stripeProductId: cleanText(options.stripeProductId),
    lastCheckoutSessionId: cleanText(options.lastCheckoutSessionId),
    subscriptionStatus: normalizeSubscriptionStatus(options.subscriptionStatus),
    currentPeriodStart: period.currentPeriodStart,
    currentPeriodEnd: period.currentPeriodEnd,
    cancelAtPeriodEnd: options.cancelAtPeriodEnd === true,
    canceledAt: toIsoString(options.canceledAt),
  };
}

export async function syncOwnerBillingState(supabase, payload = {}) {
  const normalizedPayload = buildBillingSyncPayload(payload);
  await saveOwnerBillingRecord(supabase, normalizedPayload);

  if (normalizedPayload.ownerUserId) {
    await updateOwnedAccessStatus(supabase, {
      ownerUserId: normalizedPayload.ownerUserId,
      accessStatus: mapSubscriptionStatusToAccessStatus(normalizedPayload.subscriptionStatus),
    });
  }

  return getOwnerBillingSnapshot(supabase, {
    ownerUserId: normalizedPayload.ownerUserId,
    accessStatus: mapSubscriptionStatusToAccessStatus(normalizedPayload.subscriptionStatus),
    planKey: normalizedPayload.planKey,
  });
}

export async function simulateOwnerBillingActivation(supabase, options = {}) {
  const plan = getBillingPlan(options.planKey || DEFAULT_BILLING_PLAN_KEY);
  const currentPeriod = createCalendarMonthPeriod();

  return syncOwnerBillingState(supabase, {
    ownerUserId: options.ownerUserId,
    planKey: plan.key,
    billingInterval: plan.billingInterval,
    stripeCustomerId: "dev_fake_customer",
    stripeSubscriptionId: "dev_fake_subscription",
    stripePriceId: `dev_${plan.key}`,
    stripeProductId: `dev_${plan.key}`,
    lastCheckoutSessionId: "dev_fake_checkout_session",
    subscriptionStatus: "active",
    currentPeriodStart: currentPeriod.currentPeriodStart,
    currentPeriodEnd: currentPeriod.currentPeriodEnd,
    cancelAtPeriodEnd: false,
  });
}

export function estimateUsageCostCents(options = {}) {
  const promptTokens = Math.max(0, Number(options.promptTokens || options.inputTokens || 0) || 0);
  const cachedPromptTokens = Math.max(
    0,
    Number(options.cachedPromptTokens || options.cachedInputTokens || 0) || 0
  );
  const outputTokens = Math.max(0, Number(options.completionTokens || options.outputTokens || 0) || 0);
  const billablePromptTokens = Math.max(0, promptTokens - cachedPromptTokens);
  const rates = getModelUsageRates(options.model);

  return (
    ((billablePromptTokens * rates.input) / 1_000_000)
    + ((cachedPromptTokens * rates.cachedInput) / 1_000_000)
    + ((outputTokens * rates.output) / 1_000_000)
  );
}

export async function recordEstimatedUsage(supabase, options = {}) {
  const normalizedOwnerUserId = cleanText(options.ownerUserId);
  const usageEntries = Array.isArray(options.entries) ? options.entries : [];
  const billingSnapshot = options.billingSnapshot || null;

  if (!normalizedOwnerUserId || !usageEntries.length || !billingSnapshot) {
    return [];
  }

  const payload = usageEntries.map((entry) => ({
    owner_user_id: normalizedOwnerUserId,
    agent_id: cleanText(options.agentId) || null,
    business_id: cleanText(options.businessId) || null,
    billing_period_start: billingSnapshot.currentPeriodStart,
    billing_period_end: billingSnapshot.currentPeriodEnd,
    usage_source: cleanText(entry.usageSource || "chat_reply"),
    model: cleanText(entry.model || "gpt-4o-mini") || "gpt-4o-mini",
    input_tokens: Math.max(0, Number(entry.promptTokens || entry.inputTokens || 0) || 0),
    cached_input_tokens: Math.max(
      0,
      Number(entry.cachedPromptTokens || entry.cachedInputTokens || 0) || 0
    ),
    output_tokens: Math.max(0, Number(entry.completionTokens || entry.outputTokens || 0) || 0),
    estimated_cost_cents: estimateUsageCostCents(entry),
    metadata: {
      phase: cleanText(entry.phase),
      modelFamily: cleanText(entry.modelFamily),
    },
    occurred_at: toIsoString(entry.occurredAt) || new Date().toISOString(),
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from(OWNER_AI_USAGE_LEDGER_TABLE)
    .insert(payload);

  if (error) {
    if (isMissingRelationError(error, OWNER_AI_USAGE_LEDGER_TABLE)) {
      throw buildMissingBillingSchemaError("request");
    }

    throw error;
  }

  return data || [];
}
