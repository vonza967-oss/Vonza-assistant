import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BILLING_PLAN_KEY,
  PILOT_FREE_WIDGET_PLAN_KEY,
  getBillingPlan,
  isStripeBackedBillingPlan,
  listPublicBillingPlans,
} from "../src/config/billingPlans.js";
import { createHostedCheckoutSession } from "../src/services/billing/checkoutService.js";
import {
  OWNER_AI_USAGE_LEDGER_TABLE,
  OWNER_BILLING_ACCOUNT_TABLE,
  OWNER_PRODUCT_ENTITLEMENT_TABLE,
} from "../src/config/constants.js";
import {
  buildVoiceSpeechUsageEntry,
  buildVoiceTranscriptionUsageEntry,
  getOwnerBillingSnapshot as getBillingSnapshot,
} from "../src/services/billing/billingUsageService.js";
import { activatePilotWidgetPlan } from "../src/services/billing/pilotWidgetPlanService.js";

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

function createPilotActivationSupabase({ billingRows = [] } = {}) {
  const state = {
    [OWNER_BILLING_ACCOUNT_TABLE]: billingRows.map((row) => ({ ...row })),
    [OWNER_AI_USAGE_LEDGER_TABLE]: [],
    [OWNER_PRODUCT_ENTITLEMENT_TABLE]: [],
    agents: [
      { id: "agent-1", owner_user_id: "owner-1", access_status: "pending" },
      { id: "agent-2", owner_user_id: "owner-2", access_status: "active" },
    ],
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.values = null;
      this.selected = false;
    }

    select() {
      this.selected = true;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    limit() {
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    upsert(values) {
      this.operation = "upsert";
      this.values = values;
      return this;
    }

    maybeSingle() {
      const result = this.#execute();
      return Promise.resolve({
        data: result.data?.[0] || null,
        error: result.error || null,
      });
    }

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #rows() {
      return state[this.table] || [];
    }

    #matches() {
      return this.#rows().filter((row) => matchesFilters(row, this.filters));
    }

    #execute() {
      if (this.operation === "select") {
        return { data: this.#matches().map((row) => ({ ...row })), error: null };
      }

      if (this.operation === "insert") {
        const rows = Array.isArray(this.values) ? this.values : [this.values];
        this.#rows().push(...rows.map((row) => ({ ...row })));
        return { data: this.selected ? rows.map((row) => ({ ...row })) : null, error: null };
      }

      if (this.operation === "update") {
        const matches = this.#matches();
        matches.forEach((row) => Object.assign(row, this.values));
        return { data: this.selected ? matches.map((row) => ({ ...row })) : null, error: null };
      }

      if (this.operation === "upsert") {
        const rows = Array.isArray(this.values) ? this.values : [this.values];
        const savedRows = rows.map((row) => {
          const existing = this.#rows().find((candidate) =>
            candidate.owner_user_id === row.owner_user_id
            && candidate.product_key === row.product_key
          );

          if (existing) {
            Object.assign(existing, row);
            return existing;
          }

          const inserted = { ...row, id: `entitlement-${this.#rows().length + 1}` };
          this.#rows().push(inserted);
          return inserted;
        });

        return { data: this.selected ? savedRows.map((row) => ({ ...row })) : null, error: null };
      }

      throw new Error(`Unsupported operation: ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
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
  assert.doesNotMatch(JSON.stringify(plans), /pilot_free_widget|Pilot Website Agent/i);
  assert.equal(DEFAULT_BILLING_PLAN_KEY, "growth");
  assert.equal(plans[0].monthlyPriceLabel, "19,900 HUF/month");
  assert.equal(plans[1].monthlyPriceLabel, "49,900 HUF/month");
  assert.equal(plans[2].monthlyPriceLabel, "99,900 HUF/month");
  assert.equal(plans[0].billingCurrency, "HUF");
  assert.match(plans[0].marketing.detail, /AI agent|website import|lead capture|email handoff/i);
  assert.doesNotMatch(JSON.stringify(plans), /token|api[- ]?cost|api[- ]?spend|model cost/i);
});

test("pilot free widget plan stays internal and HUF-aware", () => {
  const plan = getBillingPlan(PILOT_FREE_WIDGET_PLAN_KEY);

  assert.equal(plan.key, PILOT_FREE_WIDGET_PLAN_KEY);
  assert.equal(plan.monthlyPriceHuf, 0);
  assert.equal(plan.includedAiBudgetCents, 500);
  assert.equal(plan.isStripeBacked, false);
  assert.equal(isStripeBackedBillingPlan(PILOT_FREE_WIDGET_PLAN_KEY), false);
  assert.match(plan.marketing.summary, /Weboldali agent proba Stripe checkout nelkul/);
});

test("owner billing snapshots and upgrade options expose HUF labels", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.monthlyPriceLabel, "19,900 HUF/month");
  assert.equal(snapshot.monthlyPriceHuf, 19900);
  assert.equal(snapshot.billingCurrency, "HUF");
  assert.deepEqual(
    snapshot.upgradeOptions.map((plan) => plan.monthlyPriceLabel),
    ["49,900 HUF/month", "99,900 HUF/month"]
  );
  assert.deepEqual(
    snapshot.upgradeOptions.map((plan) => plan.billingCurrency),
    ["HUF", "HUF"]
  );
  assert.doesNotMatch(serialized, /\$(?:20|50|100)\/month|\b(?:20|50|100)\/month/);
});

test("pilot free widget billing snapshot does not pretend to have a Stripe subscription", async () => {
  const supabase = createBillingSupabaseStub({
    billingRecord: {
      owner_user_id: "owner-1",
      plan_key: PILOT_FREE_WIDGET_PLAN_KEY,
      current_period_start: "2026-04-01T00:00:00.000Z",
      current_period_end: "2026-05-01T00:00:00.000Z",
      subscription_status: "free",
    },
    usageRows: [],
  });
  const snapshot = await getBillingSnapshot(supabase, {
    ownerUserId: "owner-1",
    accessStatus: "active",
  });

  assert.equal(snapshot.planKey, PILOT_FREE_WIDGET_PLAN_KEY);
  assert.equal(snapshot.displayName, "Pilot Website Agent");
  assert.equal(snapshot.monthlyPriceLabel, "0 HUF/month");
  assert.equal(snapshot.billingCurrency, "HUF");
  assert.equal(snapshot.hasActiveSubscription, false);
  assert.equal(snapshot.hasPlanAccess, true);
  assert.equal(snapshot.isPilotFreePlan, true);
  assert.equal(snapshot.isStripeBacked, false);
  assert.equal(snapshot.usage.includedCents, 500);
  assert.deepEqual(
    snapshot.upgradeOptions.map((plan) => plan.planKey),
    ["starter", "growth", "pro"]
  );
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
        assert.equal(payload.line_items.length, 1);
        assert.equal(payload.line_items[0].price, expectedPriceId);
        assert.equal(payload.line_items[0].quantity, 1);
        assert.equal(payload.metadata.plan_key, planKey);
        assert.equal(payload.subscription_data.metadata.plan_key, planKey);
        assert.match(payload.success_url, new RegExp(`plan=${planKey}`));
        assert.match(payload.cancel_url, new RegExp(`plan=${planKey}`));
      }
    }
  );
});

test("pilot free widget plan cannot start hosted Stripe checkout", async () => {
  const fakeStripe = {
    checkout: {
      sessions: {
        async create() {
          throw new Error("Stripe checkout should not be called for the pilot plan");
        },
      },
    },
  };

  await assert.rejects(
    () => createHostedCheckoutSession(
      {
        user: {
          id: "owner-1",
          email: "owner@example.com",
        },
        email: "owner@example.com",
        planKey: PILOT_FREE_WIDGET_PLAN_KEY,
      },
      {
        stripe: fakeStripe,
      }
    ),
    /internal plan and cannot start Stripe checkout/
  );
});

test("pilot widget activation writes only the Website Agent free entitlement", async () => {
  const supabase = createPilotActivationSupabase();
  const result = await activatePilotWidgetPlan(supabase, {
    ownerUserId: "owner-1",
    activatedByUserId: "admin-1",
    activatedByEmail: "admin@example.com",
    reason: "staging pilot",
  });

  assert.equal(result.ok, true);
  assert.equal(result.planKey, PILOT_FREE_WIDGET_PLAN_KEY);
  assert.equal(result.accessStatus, "active");
  assert.equal(result.billing.planKey, PILOT_FREE_WIDGET_PLAN_KEY);
  assert.equal(result.billing.hasPlanAccess, true);
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-1").access_status, "active");
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-2").access_status, "active");

  assert.deepEqual(
    supabase.state[OWNER_PRODUCT_ENTITLEMENT_TABLE].map((row) => row.product_key),
    ["website_widget"]
  );
  const entitlement = supabase.state[OWNER_PRODUCT_ENTITLEMENT_TABLE][0];
  assert.equal(entitlement.owner_user_id, "owner-1");
  assert.equal(entitlement.entitlement_status, "free");
  assert.equal(entitlement.source, "manual_free");
  assert.equal(entitlement.plan_key, PILOT_FREE_WIDGET_PLAN_KEY);
  assert.equal(entitlement.metadata.checkout_required, false);
  assert.equal(entitlement.metadata.activated_by_user_id, "admin-1");
  assert.equal(entitlement.feature_caps.product_scope, "website_widget");
});

test("pilot widget activation refuses to overwrite active Stripe subscriptions", async () => {
  const supabase = createPilotActivationSupabase({
    billingRows: [
      {
        owner_user_id: "owner-1",
        plan_key: "growth",
        stripe_subscription_id: "sub_paid_123",
        subscription_status: "active",
      },
    ],
  });

  await assert.rejects(
    () => activatePilotWidgetPlan(supabase, {
      ownerUserId: "owner-1",
    }),
    /already has an active Stripe subscription/
  );
  assert.equal(supabase.state[OWNER_PRODUCT_ENTITLEMENT_TABLE].length, 0);
  assert.equal(supabase.state.agents.find((row) => row.id === "agent-1").access_status, "pending");
});

test("billing usage aggregation stays scoped to the active billing period", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        usage_source: "voice_transcription",
        estimated_cost_cents: 400,
      },
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-03-01T00:00:00.000Z",
        billing_period_end: "2026-04-01T00:00:00.000Z",
        usage_source: "voice_speech",
        estimated_cost_cents: 900,
      },
    ],
  });

  assert.equal(snapshot.planKey, "starter");
  assert.equal(snapshot.usage.usedCents, 400);
  assert.equal(snapshot.usage.warningState, "normal");
  assert.equal(snapshot.usage.isCapped, false);
});

test("voice usage rows aggregate into the existing monthly AI cap", async () => {
  const snapshot = await getSnapshotForUsage({
    planKey: "starter",
    usageRows: [
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        usage_source: "chat_reply",
        estimated_cost_cents: 300,
      },
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        usage_source: "voice_transcription",
        estimated_cost_cents: 250,
      },
      {
        owner_user_id: "owner-1",
        billing_period_start: "2026-04-01T00:00:00.000Z",
        billing_period_end: "2026-05-01T00:00:00.000Z",
        usage_source: "voice_speech",
        estimated_cost_cents: 450,
      },
    ],
  });

  assert.equal(snapshot.usage.usedCents, 1000);
  assert.equal(snapshot.usage.warningState, "capped");
  assert.equal(snapshot.usage.isCapped, true);
});

test("voice usage helper entries use voice sources and conservative fallbacks", () => {
  const transcriptionEntry = buildVoiceTranscriptionUsageEntry({
    model: "gpt-4o-mini-transcribe",
    durationSeconds: 30,
    audioBytes: 32 * 1024,
  });
  const speechEntry = buildVoiceSpeechUsageEntry({
    model: "gpt-4o-mini-tts",
    textLength: 1200,
    voice: "alloy",
  });

  assert.equal(transcriptionEntry.usageSource, "voice_transcription");
  assert.equal(speechEntry.usageSource, "voice_speech");
  assert.equal(transcriptionEntry.estimatedCostCents, 0.5);
  assert.equal(speechEntry.estimatedCostCents, 1.2);
  assert.equal(speechEntry.metadata.voice, "alloy");
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
