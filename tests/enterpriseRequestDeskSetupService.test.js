import test from "node:test";
import assert from "node:assert/strict";

import {
  ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE,
  saveEnterpriseRequestDeskSetup,
} from "../src/services/enterprise/enterpriseRequestDeskSetupService.js";

function createSaveSupabaseStub() {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(["from", tableName]);
      return {
        upsert(payload, options) {
          calls.push(["upsert", payload, options]);
          return {
            select(columns) {
              calls.push(["select", columns]);
              return {
                async single() {
                  calls.push(["single"]);
                  return {
                    data: {
                      ...payload,
                      created_at: "2026-06-05T10:00:00.000Z",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("Enterprise Request Desk setup service upserts normalized owner-scoped setup", async () => {
  const supabase = createSaveSupabaseStub();

  const setup = await saveEnterpriseRequestDeskSetup(supabase, {
    ownerUserId: "owner-1",
    organizationName: "ESG Holding Zrt.",
    websiteUrl: "esg.example/",
    serviceArea: "Budapest és országos telephelyek",
    serviceLines: "őrzés-védelem\nfacility management\nőrzés-védelem",
    intakePositioning: "Vállalati megkeresések előszűrése.",
    routingPreference: "email_triage",
    ownerContactEmail: "Owner@Example.Com",
  });

  assert.equal(supabase.calls[0][1], ENTERPRISE_REQUEST_DESK_OWNER_SETUPS_TABLE);
  assert.equal(supabase.calls[1][2].onConflict, "owner_user_id");
  assert.equal(supabase.calls[1][1].owner_user_id, "owner-1");
  assert.equal(supabase.calls[1][1].website_url, "https://esg.example/");
  assert.deepEqual(supabase.calls[1][1].service_lines, ["őrzés-védelem", "facility management"]);
  assert.equal(supabase.calls[1][1].owner_contact_email, "owner@example.com");
  assert.equal(supabase.calls[1][1].metadata.product, "enterprise_request_desk");
  assert.equal(setup.organizationName, "ESG Holding Zrt.");
  assert.deepEqual(setup.serviceLines, ["őrzés-védelem", "facility management"]);
  assert.equal(setup.routingPreference, "email_triage");
});

test("Enterprise Request Desk setup service rejects invalid setup inputs", async () => {
  const supabase = createSaveSupabaseStub();

  await assert.rejects(
    () => saveEnterpriseRequestDeskSetup(supabase, {
      ownerUserId: "owner-1",
      organizationName: "ESG Holding Zrt.",
      websiteUrl: "http://localhost:3000",
      serviceArea: "Budapest",
      serviceLines: ["őrzés-védelem"],
      ownerContactEmail: "owner@example.com",
    }),
    /valid public https website_url/
  );

  await assert.rejects(
    () => saveEnterpriseRequestDeskSetup(supabase, {
      ownerUserId: "owner-1",
      organizationName: "OPENAI_API_KEY=sk-supersecretvalue1234567890",
      websiteUrl: "https://esg.example",
      serviceArea: "Budapest",
      serviceLines: ["őrzés-védelem"],
      ownerContactEmail: "owner@example.com",
    }),
    /Unsafe or secret-looking setup value rejected/
  );
});
