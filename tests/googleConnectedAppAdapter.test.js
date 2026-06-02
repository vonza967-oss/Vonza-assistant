import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoogleCalendarConnectedAppConnectionPayload,
  mirrorGoogleCalendarConnectedAppConnection,
} from "../src/services/integrations/googleConnectedAppAdapter.js";

const GOOGLE_CALENDAR_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAdapterSupabase({ connections = [], missingSchema = false } = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    insertCount: 0,
  };

  function buildQuery(table) {
    return {
      filters: [],
      insertPayload: null,
      updatePayload: null,
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
      resolveRows() {
        return state[table].filter((row) =>
          this.filters.every(({ column, value }) => row[column] === value)
        );
      },
      async maybeSingle() {
        if (missingSchema) {
          return {
            data: null,
            error: { code: "42P01", message: "relation connected_app_connections does not exist" },
          };
        }

        if (this.updatePayload) {
          const row = this.resolveRows()[0] || null;

          if (!row) {
            return { data: null, error: null };
          }

          Object.assign(row, this.updatePayload);
          return { data: clone(row), error: null };
        }

        return {
          data: clone(this.resolveRows()[0] || null),
          error: null,
        };
      },
      async single() {
        state.insertCount += 1;
        const row = {
          id: `connection-${state.insertCount}`,
          created_at: "2026-06-02T10:00:00.000Z",
          updated_at: "2026-06-02T10:00:00.000Z",
          ...this.insertPayload,
        };

        state[table].push(row);
        return { data: clone(row), error: null };
      },
    };
  }

  return {
    state,
    from(table) {
      if (!state[table]) {
        state[table] = [];
      }

      return buildQuery(table);
    },
  };
}

function googleAccount(overrides = {}) {
  return {
    id: "google-account-row-1",
    agentId: "agent-1",
    businessId: "business-1",
    ownerUserId: "owner-1",
    provider: "google",
    providerAccountId: "google-user-1",
    accountEmail: "owner@example.com",
    displayName: "Owner Example",
    selectedMailbox: "INBOX",
    scopes: [
      "openid",
      "email",
      "profile",
      GOOGLE_CALENDAR_READ_SCOPE,
    ],
    status: "connected",
    accessTokenEncrypted: "ciphertext-a",
    refreshTokenEncrypted: "ciphertext-b",
    metadata: {
      emailVerified: true,
      privateValue: "private-sentinel",
      authorizationArtifact: "authorization-sentinel",
    },
    ...overrides,
  };
}

test("Google Calendar adapter maps read scope into a generic active connection payload", () => {
  const payload = buildGoogleCalendarConnectedAppConnectionPayload(googleAccount(), {
    now: "2026-06-02T10:00:00.000Z",
  });

  assert.equal(payload.owner_user_id, "owner-1");
  assert.equal(payload.provider, "google");
  assert.equal(payload.app_key, "google.calendar");
  assert.deepEqual(payload.capability_keys, ["google.calendar.read"]);
  assert.equal(payload.status, "active");
  assert.equal(payload.provider_account_id, "google-user-1");
  assert.equal(payload.provider_account_label, "Owner Example <owner@example.com>");
  assert.deepEqual(payload.scopes_granted, [
    GOOGLE_CALENDAR_READ_SCOPE,
  ]);
  assert.equal(payload.webhook_status, "not_required");
  assert.equal(payload.needs_attention_reason, null);
  assert.equal(payload.metadata.source, "existing_google_connection_flow");
  assert.equal(payload.metadata.capabilitySummary.calendarRead, true);
  assert.equal(payload.metadata.capabilitySummary.calendarWrite, false);
});

test("Google Calendar adapter grants write only when the write scope is present", () => {
  const writePayload = buildGoogleCalendarConnectedAppConnectionPayload(googleAccount({
    scopes: [GOOGLE_CALENDAR_WRITE_SCOPE],
  }));

  assert.deepEqual(writePayload.capability_keys, [
    "google.calendar.read",
    "google.calendar.write",
  ]);
  assert.equal(writePayload.scopes_granted.includes(GOOGLE_CALENDAR_WRITE_SCOPE), true);
  assert.equal(writePayload.scopes_granted.includes("google.calendar.write"), false);

  const readOnlyPayload = buildGoogleCalendarConnectedAppConnectionPayload(googleAccount({
    scopes: [GOOGLE_CALENDAR_READ_SCOPE],
  }));

  assert.deepEqual(readOnlyPayload.capability_keys, ["google.calendar.read"]);
  assert.equal(readOnlyPayload.scopes_granted.includes("google.calendar.write"), false);
});

test("Google Calendar adapter does not claim capabilities for missing or invalid scopes", () => {
  const payload = buildGoogleCalendarConnectedAppConnectionPayload(googleAccount({
    scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"],
  }));

  assert.deepEqual(payload.capability_keys, []);
  assert.equal(payload.status, "needs_attention");
  assert.equal(payload.needs_attention_reason, "calendar_scope_missing");
  assert.deepEqual(payload.scopes_granted, []);
});

test("Google Calendar adapter maps existing attention states without raw provider secrets", () => {
  const payload = buildGoogleCalendarConnectedAppConnectionPayload(googleAccount({
    status: "expired",
  }));
  const serialized = JSON.stringify(payload);

  assert.equal(payload.status, "needs_attention");
  assert.equal(payload.needs_attention_reason, "google_connection_expired");
  assert.doesNotMatch(serialized, /ciphertext-a|ciphertext-b|private-sentinel|authorization-sentinel/i);
  assert.doesNotMatch(serialized, /accessTokenEncrypted|refreshTokenEncrypted|oauthCode/i);
});

test("Google Calendar adapter creates and updates the generic connection row", async () => {
  const supabase = createAdapterSupabase();
  const created = await mirrorGoogleCalendarConnectedAppConnection(supabase, googleAccount(), {
    now: "2026-06-02T10:00:00.000Z",
  });

  assert.equal(created.ok, true);
  assert.equal(created.action, "created");
  assert.equal(created.connection.ownerUserId, "owner-1");
  assert.deepEqual(created.connection.capabilityKeys, ["google.calendar.read"]);
  assert.equal(created.connection.hasTokenSecretRef, false);
  assert.equal(Object.hasOwn(created.connection, "tokenSecretRef"), false);
  assert.equal(supabase.state.connected_app_connections.length, 1);

  const updated = await mirrorGoogleCalendarConnectedAppConnection(supabase, googleAccount({
    scopes: [GOOGLE_CALENDAR_WRITE_SCOPE],
  }), {
    now: "2026-06-02T11:00:00.000Z",
  });

  assert.equal(updated.action, "updated");
  assert.equal(supabase.state.connected_app_connections.length, 1);
  assert.deepEqual(updated.connection.capabilityKeys, [
    "google.calendar.read",
    "google.calendar.write",
  ]);
  assert.equal(updated.connection.lastVerifiedAt, "2026-06-02T11:00:00.000Z");
});

test("Google Calendar adapter skips missing generic schema without creating enablements", async () => {
  const supabase = createAdapterSupabase({ missingSchema: true });
  const result = await mirrorGoogleCalendarConnectedAppConnection(supabase, googleAccount());

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "connected_app_schema_missing");
  assert.equal(supabase.state.connected_app_connections.length, 0);
  assert.equal(Object.hasOwn(supabase.state, "agent_connected_app_enablements"), false);
});
