import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createConnectedAppConnection,
  enableConnectedAppForAgent,
  listAgentConnectedAppEnablements,
  listConnectedAppConnections,
  updateAgentConnectedAppEnablement,
  updateConnectedAppConnectionStatus,
} from "../src/services/integrations/connectedAppConnectionService.js";
import { SUPABASE_MIGRATION_FILE_BY_ID } from "../src/services/schema/supabaseMigrationCatalog.js";

const CONNECTED_APP_MIGRATION =
  "supabase/migrations/20260602150000_connected_app_connection_foundation.sql";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createConnectedAppSupabase({ agents = [], connections = [], enablements = [] } = {}) {
  const state = {
    agents: agents.map(clone),
    connected_app_connections: connections.map(clone),
    agent_connected_app_enablements: enablements.map(clone),
    insertCounts: {
      connected_app_connections: 0,
      agent_connected_app_enablements: 0,
    },
  };

  function rowsFor(table) {
    if (table === "agents") {
      return state.agents;
    }

    if (table === "connected_app_connections") {
      return state.connected_app_connections;
    }

    if (table === "agent_connected_app_enablements") {
      return state.agent_connected_app_enablements;
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function buildQuery(table) {
    const query = {
      filters: [],
      insertPayload: null,
      updatePayload: null,
      orderSpec: null,
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
      update(payload) {
        this.updatePayload = clone(payload);
        return this;
      },
      order(column, options = {}) {
        this.orderSpec = { column, ascending: options.ascending !== false };
        return this;
      },
      async limit(limit) {
        return {
          data: this.resolveRows().slice(0, limit),
          error: null,
        };
      },
      resolveRows() {
        let rows = rowsFor(table).filter((row) =>
          this.filters.every(({ column, value }) => row[column] === value)
        );

        if (this.orderSpec) {
          const { column, ascending } = this.orderSpec;
          rows = [...rows].sort((left, right) => {
            const result = String(left[column] || "").localeCompare(String(right[column] || ""));
            return ascending ? result : -result;
          });
        }

        return rows.map(clone);
      },
      async maybeSingle() {
        if (this.updatePayload) {
          const row = rowsFor(table).find((candidate) =>
            this.filters.every(({ column, value }) => candidate[column] === value)
          );

          if (!row) {
            return { data: null, error: null };
          }

          Object.assign(row, this.updatePayload);
          return { data: clone(row), error: null };
        }

        return {
          data: this.resolveRows()[0] || null,
          error: null,
        };
      },
      async single() {
        if (this.insertPayload) {
          state.insertCounts[table] += 1;
          const prefix = table === "connected_app_connections" ? "connection" : "enablement";
          const now = new Date().toISOString();
          const row = {
            id: `${prefix}-${state.insertCounts[table]}`,
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

    return query;
  }

  return {
    state,
    from(table) {
      return buildQuery(table);
    },
  };
}

test("connected app connection create persists an owner connection with known capability", async () => {
  const supabase = createConnectedAppSupabase();

  const connection = await createConnectedAppConnection(supabase, {
    ownerUserId: "owner-1",
    provider: " GOOGLE ",
    appKey: "google.calendar",
    capabilityKeys: [" GOOGLE.CALENDAR.READ ", "google.calendar.read"],
    status: "active",
    providerAccountId: "google-account-1",
    providerAccountLabel: "owner@example.com",
    scopesGranted: ["calendar.read"],
    tokenSecretRef: "vault/google/connection-1",
    metadata: { source: "service-test" },
  });

  assert.equal(connection.id, "connection-1");
  assert.equal(connection.ownerUserId, "owner-1");
  assert.equal(connection.provider, "google");
  assert.equal(connection.appKey, "google.calendar");
  assert.deepEqual(connection.capabilityKeys, ["google.calendar.read"]);
  assert.equal(connection.status, "active");
  assert.equal(connection.hasTokenSecretRef, true);
  assert.equal(Object.hasOwn(connection, "tokenSecretRef"), false);
  assert.deepEqual(connection.metadata, { source: "service-test" });
});

test("WhatsApp manual connection stores safe non-secret metadata only", async () => {
  const supabase = createConnectedAppSupabase();

  const connection = await createConnectedAppConnection(supabase, {
    ownerUserId: "owner-1",
    provider: "whatsapp",
    appKey: "whatsapp.business",
    capabilityKeys: [
      "whatsapp.business.webhook",
      "whatsapp.business.send.template",
      "whatsapp.business.send.session.reply",
    ],
    status: "active",
    providerAccountId: "123456789012345",
    providerAccountLabel: "Acme WhatsApp Business",
    webhookStatus: "active",
    metadata: {
      whatsappBusinessAccountId: "123456789012345",
      phoneNumberId: "987654321098765",
      displayPhoneNumber: "+15551234567",
      businessDisplayName: "Acme Front Desk",
      webhookVerifyStatus: "verified",
      graphApiVersion: "v23.0",
    },
  });

  assert.equal(connection.provider, "whatsapp");
  assert.equal(connection.appKey, "whatsapp.business");
  assert.deepEqual(connection.capabilityKeys, [
    "whatsapp.business.webhook",
    "whatsapp.business.send.template",
    "whatsapp.business.send.session.reply",
  ]);
  assert.equal(connection.webhookStatus, "active");
  assert.equal(connection.hasTokenSecretRef, false);
  assert.deepEqual(connection.metadata, {
    whatsappBusinessAccountId: "123456789012345",
    phoneNumberId: "987654321098765",
    displayPhoneNumber: "+15551234567",
    businessDisplayName: "Acme Front Desk",
    webhookVerifyStatus: "verified",
    graphApiVersion: "v23.0",
  });
});

test("connected app connection create rejects unknown capabilities", async () => {
  const supabase = createConnectedAppSupabase();

  await assert.rejects(
    () => createConnectedAppConnection(supabase, {
      ownerUserId: "owner-1",
      provider: "google",
      appKey: "google.calendar",
      capabilityKeys: ["unknown.provider.capability"],
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "unknown_connected_app_capability");
      return true;
    }
  );

  assert.equal(supabase.state.connected_app_connections.length, 0);
});

test("connected app connection list is owner scoped", async () => {
  const supabase = createConnectedAppSupabase({
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read"],
        status: "active",
        scopes_granted: [],
        metadata: {},
        updated_at: "2026-06-02T10:00:00.000Z",
      },
      {
        id: "connection-2",
        owner_user_id: "owner-2",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read"],
        status: "active",
        scopes_granted: [],
        metadata: {},
        updated_at: "2026-06-02T11:00:00.000Z",
      },
    ],
  });

  const connections = await listConnectedAppConnections(supabase, {
    ownerUserId: "owner-1",
    provider: "google",
  });

  assert.deepEqual(connections.map((connection) => connection.id), ["connection-1"]);
});

test("connected app connection status update is owner scoped", async () => {
  const supabase = createConnectedAppSupabase({
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "calendly",
        app_key: "calendly.booking",
        capability_keys: ["calendly.booking.webhook"],
        status: "needs_setup",
        scopes_granted: [],
        metadata: {},
      },
    ],
  });

  const connection = await updateConnectedAppConnectionStatus(supabase, {
    ownerUserId: "owner-1",
    connectionId: "connection-1",
    status: "needs_attention",
    webhookStatus: "needs_attention",
    needsAttentionReason: "webhook_verification_failed",
  });

  assert.equal(connection.status, "needs_attention");
  assert.equal(connection.webhookStatus, "needs_attention");
  assert.equal(connection.needsAttentionReason, "webhook_verification_failed");

  await assert.rejects(
    () => updateConnectedAppConnectionStatus(supabase, {
      ownerUserId: "owner-2",
      connectionId: "connection-1",
      status: "disabled",
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "connected_app_connection_not_found");
      return true;
    }
  );

  await assert.rejects(
    () => createConnectedAppConnection(supabase, {
      ownerUserId: "owner-1",
      provider: "google",
      appKey: "google.calendar",
      capabilityKeys: ["google.calendar.read"],
      scopesGranted: ["https://www.googleapis.com/auth/calendar.readonly"],
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_secret_or_execution_field_rejected");
      return true;
    }
  );

  await assert.rejects(
    () => createConnectedAppConnection(supabase, {
      ownerUserId: "owner-1",
      provider: "google",
      appKey: "google.calendar",
      capabilityKeys: ["google.calendar.read"],
      metadata: {
        source: "sk-proj_secretLookingValue1234567890",
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_secret_or_execution_field_rejected");
      return true;
    }
  );
});

test("connected app service rejects raw secret and execution input fields", async () => {
  const supabase = createConnectedAppSupabase();
  const fakeMetaAccessToken = ["EAA", "FakeMetaAccessTokenValue1234567890"].join("");

  for (const unsafeInput of [
    { accessToken: "raw-token-value" },
    { appSecret: "raw-app-secret" },
    { verifyToken: "raw-verify-token" },
    { permanentAccessToken: "raw-permanent-token" },
    { systemUserAccessToken: "raw-system-user-token" },
    { cloudApiAccessToken: "raw-cloud-api-token" },
    { cloudApiUrl: "graph.facebook.com/v23.0/123/messages" },
    { embeddedSignupUrl: "business.facebook.com/wa/manage/signup" },
    { webhookUrl: "graph.facebook.com/webhooks" },
    { metadata: { cloud_api_url: "graph.facebook.com/v23.0/123/messages" } },
    { metadata: { endpointUrl: "graph.facebook.com/v23.0/123/messages" } },
    { metadata: { webhook_endpoint_url: "graph.facebook.com/webhooks" } },
    { whatsappAccessToken: "raw-whatsapp-token" },
    { metadata: { apiKey: "raw-api-key" } },
    { metadata: { appSecret: "raw-app-secret" } },
    { metadata: { verifyToken: "raw-verify-token" } },
    { metadata: { source: fakeMetaAccessToken } },
  ]) {
    await assert.rejects(
      () => createConnectedAppConnection(supabase, {
        ownerUserId: "owner-1",
        provider: "whatsapp",
        appKey: "whatsapp.business",
        capabilityKeys: ["whatsapp.business.send.template"],
        ...unsafeInput,
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "connected_app_secret_or_execution_field_rejected");
        return true;
      }
    );
  }

  await assert.rejects(
    () => createConnectedAppConnection(supabase, {
      ownerUserId: "owner-1",
      provider: "google",
      appKey: "google.calendar",
      capabilityKeys: ["google.calendar.read"],
      metadata: {
        providerClient: "callable",
      },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_secret_or_execution_field_rejected");
      return true;
    }
  );
});

test("connected app connection output does not return raw tokens or secret refs", async () => {
  const supabase = createConnectedAppSupabase();

  const connection = await createConnectedAppConnection(supabase, {
    ownerUserId: "owner-1",
    provider: "google",
    appKey: "google.calendar",
    capabilityKeys: ["google.calendar.read"],
    tokenSecretRef: "vault/google/raw-secret-ref",
  });
  const serialized = JSON.stringify(connection);

  assert.doesNotMatch(serialized, /raw-secret-ref|accessToken|refreshToken|"tokenSecretRef"|"token_secret_ref"/i);
  assert.equal(connection.hasTokenSecretRef, true);
});

test("connected app enablement verifies owned agent and enables known capability", async () => {
  const supabase = createConnectedAppSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read", "google.calendar.write"],
        status: "active",
        scopes_granted: [],
        metadata: {},
      },
    ],
  });

  const enablement = await enableConnectedAppForAgent(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    connectionId: "connection-1",
    capabilityKeys: ["google.calendar.read"],
    approvalMode: "manual_review",
    allowedSurfaces: ["operator", "dashboard"],
    packageKey: "front_desk_general",
  });

  assert.equal(enablement.id, "enablement-1");
  assert.equal(enablement.ownerUserId, "owner-1");
  assert.equal(enablement.agentId, "agent-1");
  assert.equal(enablement.enabled, true);
  assert.deepEqual(enablement.capabilityKeys, ["google.calendar.read"]);
  assert.deepEqual(enablement.allowedSurfaces, ["operator", "dashboard"]);
});

test("connected app enablement rejects agents outside owner scope", async () => {
  const supabase = createConnectedAppSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-2" }],
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read"],
        status: "active",
        scopes_granted: [],
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => enableConnectedAppForAgent(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      connectionId: "connection-1",
      capabilityKeys: ["google.calendar.read"],
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "agent_not_found");
      return true;
    }
  );
});

test("connected app enablement rejects capability not present on connection", async () => {
  const supabase = createConnectedAppSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read"],
        status: "active",
        scopes_granted: [],
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => enableConnectedAppForAgent(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      connectionId: "connection-1",
      capabilityKeys: ["google.calendar.write"],
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_capability_not_on_connection");
      return true;
    }
  );
});

test("connected app enablement list is owner scoped", async () => {
  const supabase = createConnectedAppSupabase({
    enablements: [
      {
        id: "enablement-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
        enabled: true,
        approval_mode: "manual_review",
        allowed_surfaces: ["operator"],
        metadata: {},
        updated_at: "2026-06-02T10:00:00.000Z",
      },
      {
        id: "enablement-2",
        owner_user_id: "owner-2",
        agent_id: "agent-2",
        connection_id: "connection-2",
        capability_keys: ["google.calendar.read"],
        enabled: true,
        approval_mode: "manual_review",
        allowed_surfaces: ["operator"],
        metadata: {},
        updated_at: "2026-06-02T11:00:00.000Z",
      },
    ],
  });

  const enablements = await listAgentConnectedAppEnablements(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
  });

  assert.deepEqual(enablements.map((enablement) => enablement.id), ["enablement-1"]);
});

test("connected app enablement update changes approval mode and allowed surfaces", async () => {
  const supabase = createConnectedAppSupabase({
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read", "google.calendar.write"],
        status: "active",
        scopes_granted: [],
        metadata: {},
      },
    ],
    enablements: [
      {
        id: "enablement-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
        enabled: true,
        approval_mode: "manual_review",
        allowed_surfaces: ["operator"],
        metadata: {},
      },
    ],
  });

  const enablement = await updateAgentConnectedAppEnablement(supabase, {
    ownerUserId: "owner-1",
    enablementId: "enablement-1",
    capabilityKeys: ["google.calendar.write"],
    approvalMode: "owner_approved",
    allowedSurfaces: ["dashboard"],
    enabled: false,
    metadata: { reviewedBy: "owner" },
  });

  assert.deepEqual(enablement.capabilityKeys, ["google.calendar.write"]);
  assert.equal(enablement.approvalMode, "owner_approved");
  assert.deepEqual(enablement.allowedSurfaces, ["dashboard"]);
  assert.equal(enablement.enabled, false);
  assert.deepEqual(enablement.metadata, { reviewedBy: "owner" });
});

test("connected app enablement rejects public surfaces and unsafe automatic modes", async () => {
  const supabase = createConnectedAppSupabase({
    agents: [{ id: "agent-1", owner_user_id: "owner-1" }],
    connections: [
      {
        id: "connection-1",
        owner_user_id: "owner-1",
        provider: "google",
        app_key: "google.calendar",
        capability_keys: ["google.calendar.read"],
        status: "active",
        scopes_granted: [],
        metadata: {},
      },
    ],
    enablements: [
      {
        id: "enablement-1",
        owner_user_id: "owner-1",
        agent_id: "agent-1",
        connection_id: "connection-1",
        capability_keys: ["google.calendar.read"],
        enabled: true,
        approval_mode: "manual_review",
        allowed_surfaces: ["internal"],
        metadata: {},
      },
    ],
  });

  await assert.rejects(
    () => enableConnectedAppForAgent(supabase, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      connectionId: "connection-1",
      capabilityKeys: ["google.calendar.read"],
      allowedSurfaces: ["public_chat"],
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_public_surface_not_allowed");
      return true;
    }
  );

  await assert.rejects(
    () => updateAgentConnectedAppEnablement(supabase, {
      ownerUserId: "owner-1",
      enablementId: "enablement-1",
      approvalMode: "automatic_internal",
      allowedSurfaces: ["dashboard"],
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "connected_app_automatic_mode_surface_not_allowed");
      return true;
    }
  );
});

test("connected app foundation schema and migration are present without raw token columns", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(CONNECTED_APP_MIGRATION, "utf8");

  assert.equal(
    SUPABASE_MIGRATION_FILE_BY_ID.connected_app_connection_foundation,
    CONNECTED_APP_MIGRATION
  );

  [schemaSql, migrationSql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.connected_app_connections/i);
    assert.match(sql, /create table if not exists public\.agent_connected_app_enablements/i);
    assert.match(sql, /token_secret_ref text/i);
    assert.match(sql, /connected_app_connections_owner_provider_app_account_idx/i);
    assert.match(sql, /connected_app_connections_owner_status_idx/i);
    assert.match(sql, /agent_connected_app_enablements_owner_agent_idx/i);
    assert.match(sql, /agent_connected_app_enablements_agent_connection_idx/i);
    assert.match(sql, /Owners can read connected app connections/i);
    assert.match(sql, /Owners can read connected app enablements/i);
    assert.doesNotMatch(sql, /on public\.connected_app_connections\s+for (?:insert|update|delete|all)/i);
    assert.doesNotMatch(sql, /on public\.agent_connected_app_enablements\s+for (?:insert|update|delete|all)/i);
  });

  assert.doesNotMatch(migrationSql, /encrypted_token|access_token|refresh_token|client_secret/i);
});
