import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { logStripeEntitlementShadow } from "../src/services/billing/stripeEntitlementShadowService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function buildEnv(overrides = {}) {
  return {
    STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_ID_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro",
    STRIPE_PRICE_ID_FRONT_DESK_MONTHLY: "price_front_desk",
    STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY: "",
    STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY: "price_voice",
    ...overrides,
  };
}

function createLogger() {
  const entries = [];

  return {
    entries,
    info: (...args) => entries.push({ level: "info", args }),
    warn: (...args) => entries.push({ level: "warn", args }),
  };
}

function createWebhookApp(deps = {}) {
  const app = express();
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(createAgentRouter(deps));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}

async function postStripeWebhook(baseUrl, event) {
  const response = await fetch(`${baseUrl}/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "test-signature",
    },
    body: JSON.stringify(event),
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

test("stripe entitlement shadow logs summary for base, product, and unknown items", async () => {
  const logger = createLogger();

  await logStripeEntitlementShadow(
    {
      eventId: "evt_123",
      eventType: "customer.subscription.updated",
      ownerUserId: "owner-123",
      subscription: {
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
              },
            },
            {
              id: "si_product",
              quantity: 1,
              price: {
                id: "price_front_desk",
              },
            },
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
    },
    {
      env: buildEnv(),
      logger,
    }
  );

  assert.equal(logger.entries.length, 1);
  assert.equal(logger.entries[0].level, "warn");
  assert.equal(logger.entries[0].args[0], "[stripe entitlement shadow]");
  assert.deepEqual(logger.entries[0].args[1], {
    event_id: "evt_123",
    event_type: "customer.subscription.updated",
    owner_user_id: "owner-123",
    subscription_id: "sub_123",
    customer_id: "cus_123",
    workspace_plan: "growth",
    product_keys: ["front_desk"],
    unknown_price_count: 1,
    missing_product_price_env_keys: ["STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY"],
  });
});

test("stripe entitlement shadow catches mapper and logging errors", async () => {
  const mapperLogger = createLogger();

  await assert.doesNotReject(() =>
    logStripeEntitlementShadow(
      {
        eventId: "evt_throws",
        eventType: "customer.subscription.updated",
        ownerUserId: "owner-123",
        subscription: {
          id: "sub_throws",
          customer: "cus_throws",
        },
      },
      {
        logger: mapperLogger,
        mapSubscriptionItems: () => {
          throw new Error("mapper failed");
        },
      }
    )
  );

  assert.equal(mapperLogger.entries.length, 1);
  assert.equal(mapperLogger.entries[0].level, "warn");
  assert.equal(mapperLogger.entries[0].args[0], "[stripe entitlement shadow] failed");
  assert.equal(mapperLogger.entries[0].args[1].event_id, "evt_throws");
  assert.equal(mapperLogger.entries[0].args[1].subscription_id, "sub_throws");

  await assert.doesNotReject(() =>
    logStripeEntitlementShadow(
      {
        eventId: "evt_logger_throws",
        eventType: "customer.subscription.deleted",
        ownerUserId: "owner-123",
        subscription: {
          id: "sub_logger_throws",
          customer: "cus_logger_throws",
          items: {
            data: [
              {
                id: "si_unknown",
                price: {
                  id: "price_other",
                },
              },
            ],
          },
        },
      },
      {
        env: buildEnv(),
        logger: {
          info: () => {
            throw new Error("info failed");
          },
          warn: () => {
            throw new Error("warn failed");
          },
        },
      }
    )
  );
});

test("stripe entitlement shadow service has no entitlement persistence calls", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/services/billing/stripeEntitlementShadowService.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /owner_product_entitlements/i);
  assert.doesNotMatch(source, /OWNER_PRODUCT_ENTITLEMENT_TABLE/);
  assert.doesNotMatch(source, /\.from\s*\(/);
  assert.doesNotMatch(source, /\.(insert|upsert|update|delete)\s*\(/);
});

test("stripe webhook succeeds when entitlement shadow logging throws", async () => {
  const originalWarn = console.warn;
  const tableCalls = [];
  const syncPayloads = [];
  const shadowInputs = [];
  const routeWarnings = [];
  const event = {
    id: "evt_webhook_123",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_webhook_123",
        customer: "cus_webhook_123",
        metadata: {
          owner_user_id: "owner-123",
          plan_key: "growth",
        },
        items: {
          data: [
            {
              id: "si_base",
              price: {
                id: "price_growth",
                product: "prod_growth",
              },
            },
          ],
        },
      },
    },
  };
  const server = await startServer(createWebhookApp({
    getSupabaseClient: () => ({
      from(tableName) {
        tableCalls.push(tableName);
        throw new Error(`Unexpected table write: ${tableName}`);
      },
    }),
    constructStripeWebhookEvent: () => event,
    buildBillingSyncPayloadFromSubscription: async () => ({
      ownerUserId: "owner-123",
      planKey: "growth",
    }),
    syncOwnerBillingState: async (_supabase, payload) => {
      syncPayloads.push(payload);
      return {
        ownerUserId: payload.ownerUserId,
        planKey: payload.planKey,
      };
    },
    logStripeEntitlementShadow: async (input) => {
      shadowInputs.push(input);
      throw new Error("shadow failed");
    },
  }));

  try {
    console.warn = (...args) => routeWarnings.push(args);
    const response = await postStripeWebhook(server.baseUrl, event);

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { received: true });
    assert.equal(syncPayloads.length, 1);
    assert.equal(shadowInputs.length, 1);
    assert.equal(shadowInputs[0].eventId, "evt_webhook_123");
    assert.equal(shadowInputs[0].eventType, "customer.subscription.updated");
    assert.equal(shadowInputs[0].subscription.id, "sub_webhook_123");
    assert.deepEqual(tableCalls, []);
    assert.equal(routeWarnings.length, 1);
    assert.equal(routeWarnings[0][0], "[stripe entitlement shadow] failed");
  } finally {
    console.warn = originalWarn;
    await server.close();
  }
});

test("checkout webhook shadow logging only runs for already-expanded subscriptions", async () => {
  const shadowInputs = [];
  const stringSubscriptionEvent = {
    id: "evt_checkout_string",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_string",
        subscription: "sub_string",
        metadata: {
          owner_user_id: "owner-123",
        },
      },
    },
  };
  const expandedSubscriptionEvent = {
    id: "evt_checkout_expanded",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_expanded",
        subscription: {
          id: "sub_expanded",
          customer: "cus_expanded",
          metadata: {
            owner_user_id: "owner-123",
          },
          items: {
            data: [],
          },
        },
        metadata: {
          owner_user_id: "owner-123",
        },
      },
    },
  };
  let nextEvent = stringSubscriptionEvent;
  const server = await startServer(createWebhookApp({
    getSupabaseClient: () => ({}),
    constructStripeWebhookEvent: () => nextEvent,
    buildBillingSyncPayloadFromCheckoutSession: async () => ({
      ownerUserId: "owner-123",
      planKey: "growth",
    }),
    syncOwnerBillingState: async (_supabase, payload) => payload,
    logStripeEntitlementShadow: async (input) => {
      shadowInputs.push(input);
    },
  }));

  try {
    const stringResponse = await postStripeWebhook(server.baseUrl, stringSubscriptionEvent);
    assert.equal(stringResponse.status, 200);
    assert.deepEqual(shadowInputs, []);

    nextEvent = expandedSubscriptionEvent;
    const expandedResponse = await postStripeWebhook(
      server.baseUrl,
      expandedSubscriptionEvent
    );
    assert.equal(expandedResponse.status, 200);
    assert.equal(shadowInputs.length, 1);
    assert.equal(shadowInputs[0].eventId, "evt_checkout_expanded");
    assert.equal(shadowInputs[0].subscription.id, "sub_expanded");
  } finally {
    await server.close();
  }
});
