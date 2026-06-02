import test from "node:test";
import assert from "node:assert/strict";

import {
  listAgentPackages,
} from "../src/agentPackages/index.js";
import {
  evaluateConnectedAppReadiness,
  listConnectedAppReadinessRequirements,
} from "../src/services/integrations/connectedAppReadinessService.js";

function requirementByKey(result, key) {
  return result.requirements.find((requirement) => requirement.key === key);
}

function readyGoogleCalendarInput(overrides = {}) {
  return {
    packageKey: "front_desk_general",
    agentId: "agent_123",
    requiredCapabilities: ["google.calendar.read"],
    connectedCapabilities: ["google.calendar.read"],
    providerStatuses: {
      google: "connected",
    },
    scopeGrants: {
      google: ["calendar.read"],
    },
    surface: "operator",
    approvalMode: "manual",
    executionRequested: false,
    ...overrides,
  };
}

function readyCalendlyWebhookInput(overrides = {}) {
  return {
    packageKey: "hotel_concierge",
    requiredCapabilities: ["calendly.booking.webhook"],
    connectedCapabilities: ["calendly.booking.webhook"],
    webhookStatuses: {
      "calendly.booking.webhook": "active",
    },
    surface: "internal",
    ...overrides,
  };
}

test("no connected app requirements reports ready", () => {
  const result = evaluateConnectedAppReadiness({
    packageKey: "front_desk_general",
    agentId: "agent_123",
  });

  assert.equal(result.status, "ready");
  assert.equal(result.reportOnly, true);
  assert.deepEqual(result.requirements, []);
  assert.deepEqual(result.summary, {
    ready: 0,
    warning: 0,
    blocked: 0,
    requiredBlocked: 0,
    optionalWarnings: 0,
  });
});

test("required known connected capability reports ready", () => {
  const result = evaluateConnectedAppReadiness(readyGoogleCalendarInput());

  assert.equal(result.status, "ready");
  assert.equal(requirementByKey(result, "required.google.calendar.read").status, "ready");
  assert.equal(requirementByKey(result, "required.google.calendar.read").connected, true);
  assert.equal(requirementByKey(result, "required.google.calendar.read").scopeGranted, true);
});

test("required missing capability blocks", () => {
  const result = evaluateConnectedAppReadiness({
    requiredCapabilities: ["google.calendar.read"],
    scopeGrants: {
      "google.calendar.read": true,
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required.google.calendar.read").status, "blocked");
  assert.deepEqual(
    requirementByKey(result, "required.google.calendar.read").reasons.map((item) => item.code),
    ["capability_missing"]
  );
});

test("optional missing capability warns without blocking", () => {
  const result = evaluateConnectedAppReadiness({
    optionalCapabilities: ["google.gmail.read"],
  });

  assert.equal(result.status, "warning");
  assert.equal(requirementByKey(result, "optional.google.gmail.read").status, "warning");
  assert.equal(result.summary.optionalWarnings, 1);
});

test("unknown required capability blocks", () => {
  const result = evaluateConnectedAppReadiness({
    requiredCapabilities: ["unknown.provider.capability"],
  });

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required.unknown.provider.capability").status, "blocked");
  assert.deepEqual(
    requirementByKey(result, "required.unknown.provider.capability").reasons.map((item) => item.code),
    ["unknown_capability"]
  );
});

test("disabled and needs_attention provider statuses block required capabilities", () => {
  for (const providerStatus of ["disabled", "needs_attention"]) {
    const result = evaluateConnectedAppReadiness(
      readyGoogleCalendarInput({
        providerStatuses: {
          google: providerStatus,
        },
      })
    );

    assert.equal(result.status, "blocked");
    assert.equal(requirementByKey(result, "required.google.calendar.read").status, "blocked");
    assert.equal(
      requirementByKey(result, "required.google.calendar.read").reasons.some((item) => item.code === "provider_not_ready"),
      true
    );
  }
});

test("required OAuth capability without scope grant blocks", () => {
  const result = evaluateConnectedAppReadiness(
    readyGoogleCalendarInput({
      scopeGrants: {},
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required.google.calendar.read").scopeGranted, false);
  assert.equal(
    requirementByKey(result, "required.google.calendar.read").reasons.some((item) => item.code === "oauth_scope_missing"),
    true
  );
});

test("required webhook capability without active webhook blocks", () => {
  const result = evaluateConnectedAppReadiness(
    readyCalendlyWebhookInput({
      webhookStatuses: {},
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required.calendly.booking.webhook").webhookActive, false);
  assert.equal(
    requirementByKey(result, "required.calendly.booking.webhook").reasons.some((item) => item.code === "webhook_inactive"),
    true
  );
});

test("required webhook capability reports ready with active webhook", () => {
  const result = evaluateConnectedAppReadiness(readyCalendlyWebhookInput());

  assert.equal(result.status, "ready");
  assert.equal(requirementByKey(result, "required.calendly.booking.webhook").status, "ready");
  assert.equal(requirementByKey(result, "required.calendly.booking.webhook").webhookActive, true);
});

test("public chat execution is blocked for current capabilities", () => {
  const result = evaluateConnectedAppReadiness(
    readyGoogleCalendarInput({
      surface: "public_chat",
      executionRequested: true,
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required.google.calendar.read").status, "ready");
  assert.equal(requirementByKey(result, "execution.requested").status, "blocked");
  assert.equal(
    requirementByKey(result, "execution.requested").reasons.some((item) => item.code === "public_chat_execution_blocked"),
    true
  );
});

test("execution request is report-only and does not call providers", () => {
  let providerCalled = false;
  const result = evaluateConnectedAppReadiness(
    readyGoogleCalendarInput({
      executionRequested: true,
      surface: "operator",
      providers: {
        google: () => {
          providerCalled = true;
        },
      },
      providerClient: () => {
        providerCalled = true;
      },
    })
  );

  assert.equal(result.status, "ready");
  assert.equal(requirementByKey(result, "execution.requested").status, "ready");
  assert.equal(providerCalled, false);
});

test("output does not include secrets, tokens, provider clients, or OAuth URLs", () => {
  const result = evaluateConnectedAppReadiness({
    packageKey: "https://accounts.google.com/o/oauth2/v2/auth",
    agentId: "sk-proj_secretLookingValue1234567890",
    requiredCapabilities: [
      "https://accounts.google.com/o/oauth2/v2/auth?token=abc",
      "google.calendar.read",
    ],
    connectedCapabilities: ["google.calendar.read"],
    providerStatuses: {
      google: "https://accounts.google.com/o/oauth2/v2/auth",
    },
    scopeGrants: {
      "google.calendar.read": true,
    },
    oauthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "sk-proj_secretLookingValue1234567890",
    secret: "whsec_secretLookingValue1234567890",
    providerClient: () => {},
  });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/);
  assert.doesNotMatch(serialized, /providerClient|oauthUrl|token|secret/);
});

test("readiness output is frozen and input mutation does not affect returned results", () => {
  const input = readyGoogleCalendarInput();
  const result = evaluateConnectedAppReadiness(input);

  input.connectedCapabilities = [];

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.requirements), true);
  assert.equal(Object.isFrozen(result.requirements[0]), true);
  assert.equal(result.status, "ready");
  assert.equal(requirementByKey(result, "required.google.calendar.read").connected, true);
  assert.throws(() => {
    result.requirements.push({ key: "mutated" });
  }, TypeError);
});

test("listConnectedAppReadinessRequirements returns report-only requirement details", () => {
  const requirements = listConnectedAppReadinessRequirements(readyGoogleCalendarInput());

  assert.equal(Array.isArray(requirements), true);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].key, "required.google.calendar.read");
  assert.equal(requirements[0].packageActivatable, false);
});

test("current packages do not become connected-app enforced", () => {
  for (const agentPackage of listAgentPackages()) {
    const requirements = agentPackage.connectedAppRequirements || [];
    const result = evaluateConnectedAppReadiness({
      packageKey: agentPackage.key,
      requiredCapabilities: requirements,
    });

    assert.deepEqual(requirements, []);
    assert.equal(result.status, "ready");
    assert.equal(result.requirements.length, 0);
  }
});
