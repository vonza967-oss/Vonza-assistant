import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BILLING_PLAN_KEY,
} from "../src/config/billingPlans.js";
import { createHostedCheckoutSession } from "../src/services/billing/checkoutService.js";
import { listPublicBillingPlans } from "../src/config/billingPlans.js";
import {
  OWNER_AI_USAGE_LEDGER_TABLE,
  OWNER_BILLING_ACCOUNT_TABLE,
} from "../src/config/constants.js";
import { getOwnerBillingSnapshot as getBillingSnapshot } from "../src/services/billing/billingUsageService.js";

function withEnv(overrides, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  return Promise.resolve()
    .then(fn)
    .finally(restore);
}

function matchesFilters(record, filters = []) {
  return filters.every(([column, value]) => record?.[column] === value);
}

function createBillingSupabaseStub({ billingRecord = null, usageRows = [] } = {}) {
  return {
    from(table) {
      const filters = [];

      const execute = () => {
        if (table === OWNER_AI_USAGE_LEDGER_TABLE) {
          return {
            data: usageRows.filter((record) => matchesFilters(record, filters)),
            error: null,
          };
        }

        if (table === OWNER_BILLING_ACCOUNT_TABLE) {
          const rows = billingRecord && matchesFilters(billingRecord, filters)
            ? [billingRecord]
            : [];
          return {
            data: rows,
            error: null,
          };
        }

        return {
          data: [],
          error: null,
        };
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters.push([column, value]);
          return builder;
        },
        limit() {
          return builder;
        },
        async maybeSingle() {
          const result = execute();
          return {
            data: result.data[0] || null,
            error: result.error,
          };
        },
        then(resolve, reject) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

async function getSnapshotForUsage({ planKey = "starter", usageRows = [] } = {}) {
  const currentPeriodStart = "2026-04-01T00:00:00.000Z";
  const currentPeriodEnd = "2026-05-01T00:00:00.000Z";
  const supabase = createBillingSupabaseStub({
    billingRecord: {
      owner_user_id: "owner-1",
      plan_key: planKey,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      subscription_status: "active",
    },
    usageRows,
  });

  return getBillingSnapshot(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
  });
}

test("billing plan config exposes starter, growth, and pro with public-friendly copy", () => {
  const plans = listPublicBillingPlans();

  assert.deepEqual(plans.map((plan) => plan.key), ["starter", "growth", "pro"]);
  assert.equal(DEFAULT_BILLING_PLAN_KEY, "growth");
  assert.equal(plans[0].monthlyPriceLabel, "$20/month");
  assert.equal(plans[1].monthlyPriceLabel, "$50/month");
  assert.equal(plans[2].monthlyPriceLabel, "$100/month");
  assert.doesNotMatch(JSON.stringify(plans), /token|api[- ]?cost|api[- ]?spend|model cost/i);
});

test("hosted checkout maps each plan to its configured Stripe monthly price", async () => {
  const capturedPayloads = [];
  const fakeStripe = {
    checkout: {
      sessions: {
        async create(payload) {
          capturedPayloads.push(payload);
          return {
            id: `cs_test_${capturedPayloads.length}`,
            url: "https://checkout.stripe.test/session",
          };
        },
      },
    },
  };

  await withEnv(
    {
      PUBLIC_APP_URL: "https://app.example.com",
      STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter_123",
      STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth_123",
      STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_123",
    },
    async () => {
      for (const [planKey, expectedPriceId] of [
        ["starter", "price_starter_123"],
        ["growth", "price_growth_123"],
        ["pro", "price_pro_123"],
      ]) {
        await createHostedCheckoutSession(
          {
            user: {
              id: "owner-1",
              email: "owner@example.com",
            },
            email: "owner@example.com",
            planKey,
          },
          {
            stripe: fakeStripe,
          }
        );

        const payload = capturedPayloads.at(-1);
        assert.equal(payload.mode, "subscription");
        assert.equal(payload.line_items[0].price, expectedPriceId);
        assert.equal(payload.metadata.plan_key, planKey);
        assert.equal(payload.subscription_data.metadata.plan_key, planKey);
        assert.match(payload.success_url, new RegExp(`plan=${planKey}`));
        assert.match(payload.cancel_url, new RegExp(`plan=${planKey}`));
      }
    }
  );
});

test("billing usage aggregation stays scoped to the active billing period", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        estimated_cost_cents: 400,
      },
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-03-01T00:00:00.000Z",
        billing_period_end: "2026-04-01T00:00:00.000Z",
        estimated_cost_cents: 900,
      },
    ],
  });

  assert.equal(snapshot.planKey, "starter");
  assert.equal(snapshot.usage.usedCents, 400);
  assert.equal(snapshot.usage.warningState, "normal");
  assert.equal(snapshot.usage.isCapped, false);
});

test("billing usage shows the 80% warning state", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        estimated_cost_cents: 800,
      },
    ],
  });

  assert.equal(snapshot.usage.warningState, "warning_80");
  assert.equal(snapshot.usage.warningThreshold, 80);
  assert.equal(snapshot.usage.isCapped, false);
});

test("billing usage shows the 95% warning state", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        estimated_cost_cents: 950,
      },
    ],
  });

  assert.equal(snapshot.usage.warningState, "warning_95");
  assert.equal(snapshot.usage.warningThreshold, 95);
  assert.equal(snapshot.usage.isCapped, false);
});

test("billing usage caps the workspace at 100% capacity", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        estimated_cost_cents: 1000,
      },
    ],
  });

  assert.equal(snapshot.usage.warningState, "capped");
  assert.equal(snapshot.usage.warningThreshold, 100);
  assert.equal(snapshot.usage.isCapped, true);
  assert.match(snapshot.usage.ownerMessage, /fall back to contact capture/i);
});
