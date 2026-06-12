import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createEarlyAccessWaitlistApplication,
  normalizeWaitlistApplicationInput,
  normalizeWaitlistContact,
  normalizeWaitlistWebsiteUrl,
} from "../src/services/waitlist/earlyAccessWaitlistService.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWaitlistSupabase({ insertError = null } = {}) {
  const state = {
    applications: [],
  };

  return {
    state,
    from(table) {
      assert.equal(table, "widget_early_access_applications");
      return {
        insertPayload: null,
        insert(payload) {
          this.insertPayload = clone(payload);
          return this;
        },
        select() {
          return this;
        },
        async single() {
          if (insertError) {
            return {
              data: null,
              error: insertError,
            };
          }

          const now = "2026-06-12T09:00:00.000Z";
          const row = {
            id: `waitlist-${state.applications.length + 1}`,
            created_at: now,
            updated_at: now,
            ...this.insertPayload,
          };
          state.applications.push(row);
          return {
            data: clone(row),
            error: null,
          };
        },
      };
    },
  };
}

test("waitlist input normalizes Hungarian application fields", () => {
  const normalized = normalizeWaitlistApplicationInput({
    name: "  Anna Kovács ",
    company: "  Példa Kft. ",
    focusArea: " Ajánlatkérések kezelése ",
    websiteUrl: "pelda.hu/",
    contact: " ANNA@PELDA.HU ",
  }, {
    userAgent: "Test Browser",
    referrer: "https://source.example/path",
    sourceHost: "waitlist.example",
  });

  assert.equal(normalized.name, "Anna Kovács");
  assert.equal(normalized.company, "Példa Kft.");
  assert.equal(normalized.focusArea, "Ajánlatkérések kezelése");
  assert.equal(normalized.websiteUrl, "https://pelda.hu");
  assert.equal(normalized.contactEmail, "anna@pelda.hu");
  assert.equal(normalized.contactPhone, null);
  assert.equal(normalized.locale, "hu-HU");
  assert.equal(normalized.source, "widget_early_access_waitlist");
  assert.equal(normalized.sourceHost, "waitlist.example");
  assert.equal(normalized.metadata.user_agent, "Test Browser");
  assert.equal(normalized.metadata.referrer, "https://source.example/path");
  assert.match(normalized.applicationFingerprint, /^[a-f0-9]{64}$/);
});

test("waitlist validation accepts phone contact and rejects incomplete website URLs", () => {
  assert.deepEqual(normalizeWaitlistContact("+36 30 123 4567"), {
    contactRaw: "+36 30 123 4567",
    contactEmail: null,
    contactPhone: "+36 30 123 4567",
  });

  assert.throws(
    () => normalizeWaitlistWebsiteUrl("localhost"),
    /teljes weboldal/
  );
});

test("waitlist create persists service-role insert payload only", async () => {
  const supabase = createWaitlistSupabase();
  const result = await createEarlyAccessWaitlistApplication(supabase, {
    name: "Anna Kovács",
    company: "Példa Kft.",
    focusArea: "Foglalási kérdések",
    websiteUrl: "https://pelda.hu",
    contact: "+36 30 123 4567",
  });

  assert.equal(result.id, "waitlist-1");
  assert.equal(result.status, "new");
  assert.equal(result.contactPhone, "+36 30 123 4567");
  assert.equal(supabase.state.applications.length, 1);
  assert.equal(supabase.state.applications[0].source, "widget_early_access_waitlist");
  assert.equal(supabase.state.applications[0].contact_email, null);
});

test("waitlist duplicate fingerprint is treated as already received", async () => {
  const supabase = createWaitlistSupabase({
    insertError: {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    },
  });

  const result = await createEarlyAccessWaitlistApplication(supabase, {
    name: "Anna Kovács",
    company: "Példa Kft.",
    focusArea: "Ajánlatkérés",
    websiteUrl: "https://pelda.hu",
    contact: "anna@pelda.hu",
  });

  assert.equal(result.status, "already_received");
});

test("widget early access schema is present in canonical schema and migration", () => {
  const schemaSql = readFileSync("db/schema.sql", "utf8");
  const migrationSql = readFileSync(
    "supabase/migrations/20260612110000_widget_early_access_waitlist.sql",
    "utf8"
  );
  const recoverySql = readFileSync("docs/sql/prod_recovery_full_current_main.sql", "utf8");

  [schemaSql, migrationSql, recoverySql].forEach((sql) => {
    assert.match(sql, /create table if not exists public\.widget_early_access_applications/i);
    assert.match(sql, /focus_area text not null/i);
    assert.match(sql, /website_url text not null/i);
    assert.match(sql, /contact_email text/i);
    assert.match(sql, /contact_phone text/i);
    assert.match(sql, /application_fingerprint text not null/i);
    assert.match(sql, /widget_early_access_applications_fingerprint_idx/i);
    assert.match(sql, /alter table public\.widget_early_access_applications enable row level security/i);
    assert.match(sql, /Service role manages widget early access applications/i);
    assert.doesNotMatch(sql, /on public\.widget_early_access_applications[\s\S]{0,160}to authenticated/i);
    assert.doesNotMatch(sql, /on public\.widget_early_access_applications[\s\S]{0,160}to anon/i);
  });
});
