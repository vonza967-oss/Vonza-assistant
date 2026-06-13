import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  lookupOrderStatus,
  submitOrderChangeRequest,
} from "../src/services/orders/orderSupportService.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createOrderSupportSupabase({
  agents = [],
  settings = [],
  orders = [],
  connections = [],
} = {}) {
  const state = {
    agents: agents.map(clone),
    agent_order_support_settings: settings.map(clone),
    commerce_order_snapshots: orders.map(clone),
    connected_app_connections: connections.map(clone),
    order_verification_sessions: [],
    order_action_requests: [],
    order_action_audit_logs: [],
    insertCounts: {
      agent_order_support_settings: 0,
      order_verification_sessions: 0,
      order_action_requests: 0,
      order_action_audit_logs: 0,
    },
  };

  function rowsFor(table) {
    if (Object.prototype.hasOwnProperty.call(state, table)) {
      return state[table];
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function buildQuery(table) {
    return {
      filters: [],
      insertPayload: null,
      upsertPayload: null,
      conflictColumns: [],
      select() {
        return this;
      },
      eq(column, value) {
        this.filters.push({ column, value });
        return this;
      },
      insert(payload) {
        this.insertPayload = clone(payload);
        return this;
      },
      upsert(payload, options = {}) {
        this.upsertPayload = clone(payload);
        this.conflictColumns = String(options.onConflict || "id")
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);
        return this;
      },
      resolveRows() {
        return rowsFor(table)
          .filter((row) => this.filters.every(({ column, value }) => row[column] === value))
          .map(clone);
      },
      async maybeSingle() {
        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
      async single() {
        if (this.upsertPayload) {
          const rows = rowsFor(table);
          const existing = rows.find((candidate) =>
            this.conflictColumns.length > 0
            && this.conflictColumns.every((column) => candidate[column] === this.upsertPayload[column])
          );

          if (existing) {
            Object.assign(existing, this.upsertPayload);
            return { data: clone(existing), error: null };
          }

          state.insertCounts[table] += 1;
          const row = {
            id: `${table}-${state.insertCounts[table]}`,
            created_at: new Date().toISOString(),
            ...this.upsertPayload,
          };
          rows.push(row);
          return { data: clone(row), error: null };
        }

        if (this.insertPayload) {
          state.insertCounts[table] += 1;
          const now = new Date().toISOString();
          const row = {
            id: `${table}-${state.insertCounts[table]}`,
            created_at: now,
            updated_at: now,
            ...this.insertPayload,
          };
          rowsFor(table).push(row);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
    };
  }

  return {
    state,
    from(table) {
      return buildQuery(table);
    },
  };
}

function createAgent(overrides = {}) {
  return {
    id: "agent-1",
    owner_user_id: "owner-1",
    business_id: "business-1",
    ...overrides,
  };
}

function createSettings(overrides = {}) {
  return {
    id: "order-settings-1",
    owner_user_id: "owner-1",
    agent_id: "agent-1",
    business_id: "business-1",
    connection_id: null,
    enabled: true,
    provider: "internal",
    provider_status: "connected",
    supported_actions: ["order_lookup", "shipping_tracking"],
    approval_mode: "read_only",
    escalation_destination: null,
    metadata: {},
    created_at: "2026-06-13T10:00:00.000Z",
    updated_at: "2026-06-13T10:00:00.000Z",
    ...overrides,
  };
}

function createOrder(overrides = {}) {
  return {
    id: "snapshot-1",
    owner_user_id: "owner-1",
    business_id: "business-1",
    provider: "internal",
    provider_account_id: null,
    external_order_id: "ord-ext-1001",
    order_number: "VZ-1001",
    customer_email: "taylor@customer.com",
    customer_phone: "+3612345678",
    financial_status: "paid",
    fulfillment_status: "processing",
    shipping_status: "label_created",
    tracking_number: "TRACK1001",
    tracking_url: "https://carrier.example/track/TRACK1001",
    carrier: "Carrier",
    order_status_url: "https://shop.example/orders/VZ-1001",
    currency: "HUF",
    total_amount_minor: 1299000,
    items_summary: [{ name: "Desk", quantity: 1 }],
    shipping_address_summary: "Budapest, Hungary",
    contact_email: "taylor@customer.com",
    contact_phone: "+3612345678",
    metadata: { internal_note: "must not leak" },
    created_at: "2026-06-13T10:00:00.000Z",
    updated_at: "2026-06-13T10:00:00.000Z",
    ...overrides,
  };
}

test("verified order lookup returns customer-safe status and tracking only", async () => {
  const supabase = createOrderSupportSupabase({
    agents: [createAgent()],
    settings: [createSettings()],
    orders: [createOrder()],
  });

  const result = await lookupOrderStatus(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    businessId: "business-1",
    orderNumber: "VZ-1001",
    emailOrPhone: "taylor@customer.com",
    visitorSessionKey: "visitor-session-1",
  });

  assert.equal(result.status, "verified");
  assert.equal(result.verified, true);
  assert.equal(result.revealOrderDetails, true);
  assert.equal(result.order.orderNumber, "VZ-1001");
  assert.equal(result.order.trackingNumber, "TRACK1001");
  assert.equal(result.order.trackingUrl, "https://carrier.example/track/TRACK1001");
  assert.equal(Object.hasOwn(result.order, "customerEmail"), false);
  assert.equal(Object.hasOwn(result.order, "customerPhone"), false);
  assert.equal(Object.hasOwn(result.order, "metadata"), false);
  assert.equal(supabase.state.order_verification_sessions[0].status, "verified");
  assert.equal(supabase.state.order_action_audit_logs[0].event_type, "order_lookup_verified");
});

test("order lookup never reveals details when verification is missing or wrong", async () => {
  const supabase = createOrderSupportSupabase({
    agents: [createAgent()],
    settings: [createSettings()],
    orders: [createOrder()],
  });

  const missing = await lookupOrderStatus(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    businessId: "business-1",
    orderNumber: "VZ-1001",
  });
  const wrong = await lookupOrderStatus(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    businessId: "business-1",
    orderNumber: "VZ-1001",
    emailOrPhone: "wrong@customer.com",
  });

  assert.equal(missing.status, "needs_verification");
  assert.equal(missing.revealOrderDetails, false);
  assert.equal(Object.hasOwn(missing, "order"), false);
  assert.equal(wrong.status, "verification_failed");
  assert.equal(wrong.revealOrderDetails, false);
  assert.equal(Object.hasOwn(wrong, "order"), false);
  assert.deepEqual(
    supabase.state.order_verification_sessions.map((row) => row.status),
    ["failed", "failed"]
  );
});

test("read-only approval mode rejects order changes without creating action requests", async () => {
  const supabase = createOrderSupportSupabase({
    agents: [createAgent()],
    settings: [createSettings({
      supported_actions: ["order_lookup", "shipping_tracking", "cancellation"],
      approval_mode: "read_only",
    })],
    orders: [createOrder()],
  });

  const result = await submitOrderChangeRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    businessId: "business-1",
    orderNumber: "VZ-1001",
    emailOrPhone: "taylor@customer.com",
    actionType: "cancellation",
    requestedChange: { actionType: "cancellation", rawRequest: "Cancel my order." },
  });

  assert.equal(result.status, "not_allowed");
  assert.equal(result.reason, "read_only_mode");
  assert.equal(result.revealOrderDetails, false);
  assert.equal(supabase.state.order_action_requests.length, 0);
  assert.equal(supabase.state.order_verification_sessions.length, 0);
  assert.equal(supabase.state.order_action_audit_logs[0].outcome, "read_only_mode");
});

test("verified risky order changes create staff-review requests without provider mutation", async () => {
  const supabase = createOrderSupportSupabase({
    agents: [createAgent()],
    settings: [createSettings({
      supported_actions: ["order_lookup", "shipping_tracking", "cancellation"],
      approval_mode: "change_requests",
    })],
    orders: [createOrder({ fulfillment_status: "processing", shipping_status: "pending", tracking_number: null, tracking_url: null })],
  });

  const result = await submitOrderChangeRequest(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    businessId: "business-1",
    orderNumber: "VZ-1001",
    emailOrPhone: "+36 1 234 5678",
    visitorSessionKey: "visitor-session-1",
    actionType: "cancellation",
    requestedChange: { actionType: "cancellation", rawRequest: "Cancel my order VZ-1001." },
    source: "public_chat",
  });

  assert.equal(result.status, "needs_staff_review");
  assert.equal(result.requiresStaffApproval, true);
  assert.equal(result.revealOrderDetails, false);
  assert.equal(result.actionRequest.created, true);
  assert.equal(supabase.state.order_action_requests.length, 1);
  assert.equal(supabase.state.order_action_requests[0].status, "needs_staff_review");
  assert.equal(supabase.state.order_action_requests[0].provider_result.provider_applied, false);
  assert.equal(supabase.state.order_action_requests[0].provider_result.validation_decision, "requires_staff_review");
  assert.equal(supabase.state.order_action_audit_logs.at(-1).event_type, "order_change_request_created");
});

test("order support migration declares owner-read RLS and audit tables", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260613110000_order_support.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /create table if not exists public\.agent_order_support_settings/);
  assert.match(migration, /create table if not exists public\.commerce_order_snapshots/);
  assert.match(migration, /create table if not exists public\.order_verification_sessions/);
  assert.match(migration, /create table if not exists public\.order_action_requests/);
  assert.match(migration, /create table if not exists public\.order_action_audit_logs/);
  assert.match(migration, /alter table public\.order_action_audit_logs enable row level security/);
  assert.match(migration, /Owners can read order action audit logs/);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)\s+on table public\.order_action_requests to authenticated/i);
});
