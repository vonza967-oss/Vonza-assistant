import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCalendlyWebhookUrl,
  encryptBookingWebhookSecret,
  hashBookingWebhookEndpointToken,
  provisionCalendlyBookingIntegration,
} from "../src/services/bookings/bookingIntegrationService.js";
import { decryptSecret } from "../src/utils/crypto.js";

const ENCRYPTION_SECRET = "test-booking-webhook-encryption-secret";

function createSupabaseStub() {
  const state = {
    agents: [
      {
        id: "agent-1",
        owner_user_id: "owner-1",
        access_status: "active",
        is_active: true,
      },
    ],
    agent_booking_integrations: [],
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.conflictColumns = [];
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    upsert(values, options = {}) {
      this.operation = "upsert";
      this.values = values;
      this.conflictColumns = String(options.onConflict || "id")
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.#executeSingle());
    }

    single() {
      return Promise.resolve(this.#executeSingle());
    }

    #rows() {
      return state[this.table] || [];
    }

    #matches() {
      return this.#rows().filter((row) => this.filters.every((filter) => filter(row)));
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];

      return {
        data: rows[0] ? { ...rows[0] } : null,
        error: result.error || null,
      };
    }

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#matches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "upsert") {
        const rows = this.#rows();
        const existing = rows.find((row) => (
          this.conflictColumns.length
          && this.conflictColumns.every((column) => row[column] === this.values[column])
        ));

        if (existing) {
          Object.assign(existing, this.values);
          return {
            data: [{ ...existing }],
            error: null,
          };
        }

        const inserted = {
          id: `${this.table}-${rows.length + 1}`,
          ...this.values,
        };
        rows.push(inserted);

        return {
          data: [{ ...inserted }],
          error: null,
        };
      }

      throw new Error(`Unsupported operation ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

test.beforeEach(() => {
  process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET = ENCRYPTION_SECRET;
});

test.afterEach(() => {
  delete process.env.BOOKING_WEBHOOK_ENCRYPTION_SECRET;
});

test("Calendly webhook token hashing and secret encryption avoid storing raw values", () => {
  const token = "opaque-endpoint-token";
  const signingSecret = "calendly-signing-secret";
  const tokenHash = hashBookingWebhookEndpointToken(token);
  const encryptedSecret = encryptBookingWebhookSecret(signingSecret);

  assert.equal(tokenHash, hashBookingWebhookEndpointToken(token));
  assert.notEqual(tokenHash, token);
  assert.equal(tokenHash.length, 64);
  assert.notEqual(encryptedSecret, signingSecret);
  assert.equal(encryptedSecret.includes(signingSecret), false);
  assert.equal(decryptSecret(encryptedSecret, ENCRYPTION_SECRET), signingSecret);
});

test("provisionCalendlyBookingIntegration upserts an owner-scoped Calendly integration", async () => {
  const supabase = createSupabaseStub();
  const result = await provisionCalendlyBookingIntegration(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    endpointToken: "endpoint-token-1",
    webhookSecret: "signing-secret-1",
    publicAppUrl: "https://app.example",
    bookingUrl: "https://calendly.com/acme/demo",
    providerAccountId: "calendly-user-1",
    providerEventTypeId: "https://api.calendly.com/event_types/type-1",
  });
  const row = supabase.state.agent_booking_integrations[0];

  assert.equal(result.webhookUrl, "https://app.example/bookings/webhooks/calendly/endpoint-token-1");
  assert.equal(result.integration.webhookConnected, true);
  assert.equal(result.integration.provider, "calendly");
  assert.equal(result.integration.status, "active");
  assert.equal(result.integration.webhookSecretEncrypted, undefined);
  assert.equal(supabase.state.agent_booking_integrations.length, 1);
  assert.equal(row.agent_id, "agent-1");
  assert.equal(row.owner_user_id, "owner-1");
  assert.equal(row.webhook_endpoint_token_hash, hashBookingWebhookEndpointToken("endpoint-token-1"));
  assert.equal(row.webhook_endpoint_token_hash.includes("endpoint-token-1"), false);
  assert.equal(row.webhook_secret_encrypted.includes("signing-secret-1"), false);
  assert.equal(decryptSecret(row.webhook_secret_encrypted, ENCRYPTION_SECRET), "signing-secret-1");
  assert.equal(row.provider_account_id, "calendly-user-1");
  assert.equal(row.provider_event_type_id, "https://api.calendly.com/event_types/type-1");
});

test("provisionCalendlyBookingIntegration updates the existing owner-agent provider row", async () => {
  const supabase = createSupabaseStub();

  await provisionCalendlyBookingIntegration(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    endpointToken: "endpoint-token-1",
    webhookSecret: "signing-secret-1",
    publicAppUrl: "https://app.example",
  });

  const result = await provisionCalendlyBookingIntegration(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    endpointToken: "endpoint-token-2",
    webhookSecret: "signing-secret-2",
    publicAppUrl: "https://app.example",
    status: "pending",
  });
  const row = supabase.state.agent_booking_integrations[0];

  assert.equal(supabase.state.agent_booking_integrations.length, 1);
  assert.equal(result.webhookUrl, "https://app.example/bookings/webhooks/calendly/endpoint-token-2");
  assert.equal(row.status, "pending");
  assert.equal(row.webhook_endpoint_token_hash, hashBookingWebhookEndpointToken("endpoint-token-2"));
  assert.equal(decryptSecret(row.webhook_secret_encrypted, ENCRYPTION_SECRET), "signing-secret-2");
});

test("provisionCalendlyBookingIntegration can generate the signing secret without returning it", async () => {
  const supabase = createSupabaseStub();
  const result = await provisionCalendlyBookingIntegration(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    endpointToken: "endpoint-token",
    publicAppUrl: "https://app.example",
  });
  const row = supabase.state.agent_booking_integrations[0];

  assert.equal(result.webhookSecretGenerated, true);
  assert.equal(Object.hasOwn(result, "webhookSecret"), false);
  assert.ok(row.webhook_secret_encrypted);
});

test("provisionCalendlyBookingIntegration rejects owner and agent mismatches", async () => {
  await assert.rejects(
    () => provisionCalendlyBookingIntegration(createSupabaseStub(), {
      ownerUserId: "owner-2",
      agentId: "agent-1",
      endpointToken: "endpoint-token",
      webhookSecret: "signing-secret",
      publicAppUrl: "https://app.example",
    }),
    /Agent was not found/
  );
});

test("buildCalendlyWebhookUrl normalizes trailing slashes and URL-encodes the endpoint token", () => {
  assert.equal(
    buildCalendlyWebhookUrl({
      publicAppUrl: "https://app.example/",
      endpointToken: "token/with space",
    }),
    "https://app.example/bookings/webhooks/calendly/token%2Fwith%20space"
  );
});
