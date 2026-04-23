import test from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardPreferences,
  normalizeDashboardLanguage,
  saveDashboardLanguagePreference,
} from "../src/services/dashboard/dashboardPreferenceService.js";

function createPreferenceTable({ row = null, error = null } = {}) {
  const state = {
    upsertPayload: null,
  };
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle: async () => ({ data: row, error }),
    upsert(payload) {
      state.upsertPayload = payload;
      return builder;
    },
    single: async () => ({
      data: state.upsertPayload
        ? {
          owner_user_id: state.upsertPayload.owner_user_id,
          dashboard_language: state.upsertPayload.dashboard_language,
        }
        : row,
      error,
    }),
  };

  return {
    state,
    table: builder,
  };
}

test("dashboard preferences read saved owner-level dashboard language", async () => {
  const { table } = createPreferenceTable({
    row: { owner_user_id: "owner-1", dashboard_language: "hu" },
  });
  const supabase = {
    from(tableName) {
      assert.equal(tableName, "user_dashboard_preferences");
      return table;
    },
  };

  const preferences = await getDashboardPreferences(supabase, { ownerUserId: "owner-1" });

  assert.equal(preferences.dashboardLanguage, "hu");
  assert.equal(preferences.persistenceAvailable, true);
});

test("dashboard language save validates language and does not overwrite unrelated settings", async () => {
  const { table, state } = createPreferenceTable();
  const supabase = {
    from(tableName) {
      assert.equal(tableName, "user_dashboard_preferences");
      return table;
    },
  };

  const result = await saveDashboardLanguagePreference(supabase, {
    ownerUserId: "owner-1",
    dashboardLanguage: "hu",
  });

  assert.equal(result.ok, true);
  assert.equal(result.dashboardLanguage, "hu");
  assert.equal(state.upsertPayload.owner_user_id, "owner-1");
  assert.equal(state.upsertPayload.dashboard_language, "hu");
  assert.deepEqual(
    Object.keys(state.upsertPayload).sort(),
    ["dashboard_language", "owner_user_id", "updated_at"].sort()
  );
});

test("dashboard language save failure is explicit when preference table is missing", async () => {
  const { table } = createPreferenceTable({
    error: {
      code: "42P01",
      message: "relation public.user_dashboard_preferences does not exist",
    },
  });
  const supabase = {
    from() {
      return table;
    },
  };

  const preferences = await getDashboardPreferences(supabase, { ownerUserId: "owner-1" });
  assert.equal(preferences.persistenceAvailable, false);
  assert.equal(preferences.migrationRequired, true);

  await assert.rejects(
    () => saveDashboardLanguagePreference(supabase, {
      ownerUserId: "owner-1",
      dashboardLanguage: "hu",
    }),
    /Dashboard language storage is not ready yet/
  );
});

test("dashboard language normalizer safely falls back to English", () => {
  assert.equal(normalizeDashboardLanguage("hu"), "hu");
  assert.equal(normalizeDashboardLanguage("fr"), "en");
});
