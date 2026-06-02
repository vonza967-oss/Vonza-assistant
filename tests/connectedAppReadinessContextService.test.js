import test from "node:test";
import assert from "node:assert/strict";

import {
  listAgentPackages,
} from "../src/agentPackages/index.js";
import {
  evaluateAgentPackageActivationReadiness,
} from "../src/services/agents/agentPackageActivationReadinessService.js";
import {
  evaluateConnectedAppReadiness,
} from "../src/services/integrations/connectedAppReadinessService.js";
import {
  buildConnectedAppReadinessContext,
} from "../src/services/integrations/connectedAppReadinessContextService.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createReadinessSupabase({ connections = [], enablements = [] } = {}) {
  const state = {
    connected_app_connections: connections.map(clone),
    agent_connected_app_enablements: enablements.map(clone),
    queriedTables: [],
    selectColumns: {},
  };

  function rowsFor(table) {
    if (table === "connected_app_connections" || table === "agent_connected_app_enablements") {
      return state[table];
    }

    throw new Error(`Unexpected table ${table}`);
  }

  function selectedColumnNames(selectClause) {
    return String(selectClause || "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
  }

  function projectRow(row, columns) {
    if (columns.length === 0) {
      return clone(row);
    }

    return Object.fromEntries(
      columns
        .filter((column) => Object.hasOwn(row, column))
        .map((column) => [column, clone(row[column])])
    );
  }

  return {
    state,
    from(table) {
      state.queriedTables.push(table);

      return {
        filters: [],
        columns: [],
        select(selectClause) {
          this.columns = selectedColumnNames(selectClause);
          state.selectColumns[table] = this.columns;
          return this;
        },
        eq(column, value) {
          this.filters.push({ column, value });
          return this;
        },
        async limit(limit) {
          const rows = rowsFor(table)
            .filter((row) => this.filters.every(({ column, value }) => row[column] === value))
            .slice(0, limit)
            .map((row) => projectRow(row, this.columns));

          return {
            data: rows,
            error: null,
          };
        },
      };
    },
  };
}

function connection(overrides = {}) {
  return {
    id: "connection-1",
    owner_user_id: "owner-1",
    provider: "google",
    capability_keys: ["google.calendar.read"],
    status: "active",
    scopes_granted: ["https://www.googleapis.com/auth/calendar.readonly"],
    webhook_status: "not_required",
    token_secret_ref: "vault/google/secret-ref",
    metadata: {
      token: "sk-proj_secretLookingValue1234567890",
      oauthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    },
    ...overrides,
  };
}

function enablement(overrides = {}) {
  return {
    id: "enablement-1",
    owner_user_id: "owner-1",
    agent_id: "agent-1",
    connection_id: "connection-1",
    capability_keys: ["google.calendar.read"],
    enabled: true,
    approval_mode: "manual_review",
    allowed_surfaces: ["operator"],
    package_key: "front_desk_general",
    metadata: {
      secret: "whsec_secretLookingValue1234567890",
    },
    ...overrides,
  };
}

async function evaluateFromRecords({ connections = [connection()], enablements = [enablement()], input = {} } = {}) {
  const supabase = createReadinessSupabase({ connections, enablements });
  const context = await buildConnectedAppReadinessContext(supabase, {
    ownerUserId: "owner-1",
    agentId: "agent-1",
    packageKey: "front_desk_general",
    requiredCapabilities: ["google.calendar.read"],
    surface: "operator",
    ...input,
  });

  return {
    supabase,
    context,
    readiness: evaluateConnectedAppReadiness({
      packageKey: "front_desk_general",
      agentId: "agent-1",
      ...context,
    }),
  };
}

function requirementByKey(result, key) {
  return result.requirements.find((requirement) => requirement.key === key);
}

test("active connection plus enabled agent capability builds ready readiness context", async () => {
  const { context, readiness } = await evaluateFromRecords();

  assert.deepEqual(context.connectedCapabilities, ["google.calendar.read"]);
  assert.deepEqual(context.scopeGrants, {
    "google.calendar.read": true,
  });
  assert.equal(context.approvalMode, "manual_review");
  assert.equal(context.surface, "operator");
  assert.equal(readiness.status, "ready");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").status, "ready");
});

test("active connection without agent enablement blocks readiness", async () => {
  const { context, readiness } = await evaluateFromRecords({
    enablements: [],
  });

  assert.deepEqual(context.connectedCapabilities, []);
  assert.equal(readiness.status, "blocked");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").status, "blocked");
});

test("disabled agent enablement blocks readiness", async () => {
  const { readiness } = await evaluateFromRecords({
    enablements: [
      enablement({
        enabled: false,
      }),
    ],
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(
    requirementByKey(readiness, "required.google.calendar.read").reasons.some(
      (reason) => reason.code === "capability_missing"
    ),
    true
  );
});

test("disabled or needs-attention connections block readiness", async () => {
  for (const status of ["disabled", "needs_attention"]) {
    const { readiness } = await evaluateFromRecords({
      connections: [
        connection({
          status,
        }),
      ],
    });

    assert.equal(readiness.status, "blocked");
    assert.equal(
      requirementByKey(readiness, "required.google.calendar.read").reasons.some(
        (reason) => reason.code === "provider_not_ready"
      ),
      true
    );
  }
});

test("capability on connection but not enablement blocks readiness", async () => {
  const { readiness } = await evaluateFromRecords({
    enablements: [
      enablement({
        capability_keys: ["google.calendar.write"],
      }),
    ],
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").connected, false);
});

test("capability on enablement but not connection blocks readiness", async () => {
  const { readiness } = await evaluateFromRecords({
    connections: [
      connection({
        capability_keys: ["google.calendar.write"],
      }),
    ],
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").connected, false);
});

test("missing OAuth scope blocks OAuth capabilities", async () => {
  const { context, readiness } = await evaluateFromRecords({
    connections: [
      connection({
        scopes_granted: [],
      }),
    ],
  });

  assert.deepEqual(context.scopeGrants, {});
  assert.equal(readiness.status, "blocked");
  assert.equal(
    requirementByKey(readiness, "required.google.calendar.read").reasons.some(
      (reason) => reason.code === "oauth_scope_missing"
    ),
    true
  );
});

test("Google Calendar OAuth scope URLs satisfy mirrored readiness scope grants", async () => {
  const { context, readiness } = await evaluateFromRecords({
    connections: [
      connection({
        scopes_granted: ["https://www.googleapis.com/auth/calendar.readonly"],
      }),
    ],
  });

  assert.deepEqual(context.scopeGrants, {
    "google.calendar.read": true,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").scopeGranted, true);
});

test("Google Calendar capability keys alone do not satisfy OAuth scope grants", async () => {
  const { context, readiness } = await evaluateFromRecords({
    connections: [
      connection({
        scopes_granted: ["google.calendar.read", "calendar.read"],
      }),
    ],
  });

  assert.deepEqual(context.scopeGrants, {});
  assert.equal(readiness.status, "blocked");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").scopeGranted, false);
});

test("missing active webhook blocks webhook capabilities", async () => {
  const { readiness } = await evaluateFromRecords({
    connections: [
      connection({
        provider: "calendly",
        capability_keys: ["calendly.booking.webhook"],
        webhook_status: "pending",
        scopes_granted: [],
      }),
    ],
    enablements: [
      enablement({
        capability_keys: ["calendly.booking.webhook"],
      }),
    ],
    input: {
      requiredCapabilities: ["calendly.booking.webhook"],
    },
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(
    requirementByKey(readiness, "required.calendly.booking.webhook").reasons.some(
      (reason) => reason.code === "webhook_inactive"
    ),
    true
  );
});

test("owner scoping prevents another owner's records from counting", async () => {
  const { context, readiness } = await evaluateFromRecords({
    connections: [
      connection({
        owner_user_id: "owner-2",
      }),
      connection({
        id: "connection-2",
        status: "needs_setup",
        scopes_granted: [],
      }),
    ],
    enablements: [
      enablement({
        owner_user_id: "owner-2",
      }),
      enablement({
        connection_id: "connection-2",
      }),
    ],
  });

  assert.deepEqual(context.connectedCapabilities, []);
  assert.equal(readiness.status, "blocked");
});

test("public chat execution remains blocked with derived records", async () => {
  const { readiness } = await evaluateFromRecords({
    input: {
      surface: "public_chat",
      executionRequested: true,
    },
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(requirementByKey(readiness, "required.google.calendar.read").status, "ready");
  assert.equal(requirementByKey(readiness, "execution.requested").status, "blocked");
  assert.equal(
    requirementByKey(readiness, "execution.requested").reasons.some(
      (reason) => reason.code === "public_chat_execution_blocked"
    ),
    true
  );
});

test("readiness context output excludes token refs secrets metadata secrets and OAuth URLs", async () => {
  const { context, supabase } = await evaluateFromRecords();
  const serialized = JSON.stringify(context);

  assert.doesNotMatch(serialized, /raw-secret-ref|secret-ref|token_secret_ref|metadata/i);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/);
  assert.deepEqual(supabase.state.selectColumns.connected_app_connections, [
    "id",
    "owner_user_id",
    "provider",
    "capability_keys",
    "status",
    "scopes_granted",
    "webhook_status",
  ]);
  assert.equal(
    supabase.state.selectColumns.connected_app_connections.includes("token_secret_ref"),
    false
  );
  assert.equal(
    supabase.state.selectColumns.agent_connected_app_enablements.includes("metadata"),
    false
  );
});

test("readiness context does not query provider-specific legacy tables", async () => {
  const { supabase } = await evaluateFromRecords();

  assert.deepEqual(new Set(supabase.state.queriedTables), new Set([
    "connected_app_connections",
    "agent_connected_app_enablements",
  ]));
});

test("current packages still have no connected-app activation enforcement", async () => {
  for (const agentPackage of listAgentPackages()) {
    const requirements = agentPackage.connectedAppRequirements || [];
    const baseline = evaluateAgentPackageActivationReadiness(agentPackage.key);
    const result = evaluateAgentPackageActivationReadiness(agentPackage.key, {
      connectedApps: {
        requiredCapabilities: requirements,
      },
    });

    assert.deepEqual(requirements, []);
    assert.equal(result.status, baseline.status);
    assert.equal(result.summary.blocked, baseline.summary.blocked);
    assert.equal(result.connectedApps.status, "ready");
    assert.equal(result.connectedApps.requirements.length, 0);
  }
});
