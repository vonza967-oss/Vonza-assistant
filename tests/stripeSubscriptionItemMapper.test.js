import assert from "node:assert/strict";
import test from "node:test";

import {
  STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS,
  mapStripeSubscriptionItems,
} from "../src/services/billing/stripeSubscriptionItemMapper.js";
import { listProductStripePriceMappings } from "../src/config/productCatalog.js";

const {
  WORKSPACE_BASE_PLAN,
  PRODUCT_ENTITLEMENT,
  UNKNOWN,
} = STRIPE_SUBSCRIPTION_ITEM_CLASSIFICATIONS;

function buildEnv(overrides = {}) {
  return {
    STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro",
    STRIPE_PRICE_ID_FRONT_DESK_MONTHLY: "price_front_desk",
    STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY: "price_widget",
    STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY: "price_voice",
    ...overrides,
  };
}

test("base plan price maps to workspace_base_plan", () => {
  const result = mapStripeSubscriptionItems(
    {
      id: "sub_123",
      customer: "cus_123",
      metadata: {
        owner_user_id: "owner-123",
      },
      items: {
        data: [
          {
            id: "si_base",
            quantity: 1,
            price: {
              id: "price_growth",
              metadata: {
                product_key: "front_desk",
              },
            },
          },
        ],
      },
    },
    buildEnv()
  );

  assert.equal(result.subscriptionId, "sub_123");
  assert.equal(result.customerId, "cus_123");
  assert.equal(result.ownerUserId, "owner-123");
  assert.equal(result.classifications[0].classification, WORKSPACE_BASE_PLAN);
  assert.equal(result.classifications[0].planKey, "growth");
  assert.equal(result.classifications[0].productKey, null);
  assert.deepEqual(result.summary, {
    workspaceBasePlanCount: 1,
    productEntitlementCount: 0,
    unknownCount: 0,
    missingProductPriceEnvKeys: [],
  });
});

test("product price maps to product_entitlement by exact configured price id", () => {
  const result = mapStripeSubscriptionItems(
    {
      id: "sub_123",
      customer: "cus_123",
      metadata: {
        owner_user_id: "owner-123",
      },
      items: {
        data: [
          {
            id: "si_product",
            quantity: 1,
            price: {
              id: "price_front_desk",
            },
          },
        ],
      },
    },
    buildEnv()
  );

  assert.equal(result.classifications[0].classification, PRODUCT_ENTITLEMENT);
  assert.equal(result.classifications[0].planKey, null);
  assert.equal(result.classifications[0].productKey, "front_desk");
  assert.deepEqual(result.summary, {
    workspaceBasePlanCount: 0,
    productEntitlementCount: 1,
    unknownCount: 0,
    missingProductPriceEnvKeys: [],
  });
});

test("product classification ignores Stripe metadata", () => {
  const result = mapStripeSubscriptionItems(
    {
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          {
            id: "si_metadata_only",
            quantity: 1,
            price: {
              id: "price_not_configured",
              metadata: {
                product_key: "voice_agent",
              },
            },
          },
        ],
      },
    },
    buildEnv()
  );

  assert.equal(result.classifications[0].classification, UNKNOWN);
  assert.equal(result.classifications[0].productKey, null);
  assert.equal(result.summary.unknownCount, 1);
});

test("unknown prices are reported as unknown", () => {
  const result = mapStripeSubscriptionItems(
    {
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          {
            id: "si_unknown",
            quantity: 1,
            price: {
              id: "price_other",
            },
          },
        ],
      },
    },
    buildEnv()
  );

  assert.equal(result.classifications[0].classification, UNKNOWN);
  assert.equal(result.summary.unknownCount, 1);
});

test("missing product price env vars are non-fatal and reported", () => {
  const result = mapStripeSubscriptionItems(
    {
      id: "sub_123",
      customer: "cus_123",
      items: {
        data: [
          {
            id: "si_base",
            quantity: 1,
            price: {
              id: "price_starter",
            },
          },
        ],
      },
    },
    buildEnv({
      STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY: "",
      STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY: undefined,
    })
  );

  assert.equal(result.classifications[0].classification, WORKSPACE_BASE_PLAN);
  assert.deepEqual(result.summary.missingProductPriceEnvKeys, [
    "STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY",
    "STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY",
  ]);
});

test("mapper does not mutate the subscription input", () => {
  const subscription = {
    id: "sub_123",
    customer: "cus_123",
    metadata: {
      owner_user_id: "owner-123",
    },
    items: {
      data: [
        {
          id: "si_product",
          quantity: 1,
          price: {
            id: "price_voice",
            metadata: {
              product_key: "front_desk",
            },
          },
        },
      ],
    },
  };
  const before = structuredClone(subscription);

  mapStripeSubscriptionItems(subscription, buildEnv());

  assert.deepEqual(subscription, before);
});

test("product catalog helper lists optional product stripe price mappings", () => {
  const mappings = listProductStripePriceMappings(buildEnv({
    STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY: "",
  }));

  assert.deepEqual(
    mappings.map((mapping) => [
      mapping.productKey,
      mapping.stripePriceEnvKey,
      mapping.stripePriceId,
    ]),
    [
      ["front_desk", "STRIPE_PRICE_ID_FRONT_DESK_MONTHLY", "price_front_desk"],
      ["website_widget", "STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY", "price_widget"],
      ["voice_agent", "STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY", ""],
    ]
  );
});
