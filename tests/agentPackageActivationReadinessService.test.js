import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getAgentPackage } from "../src/agentPackages/index.js";
import {
  evaluateAgentPackageActivationReadiness,
  listAgentPackageActivationRequirements,
} from "../src/services/agents/agentPackageActivationReadinessService.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SERVICE_PATH = path.join(
  REPO_ROOT,
  "src/services/agents/agentPackageActivationReadinessService.js"
);

function hotelReadyContext(overrides = {}) {
  return {
    activationTarget: overrides.activationTarget || "internal",
    requiredData: {
      hotelRules: true,
      breakfast: true,
      amenities: true,
      checkoutPolicy: true,
      staffEscalation: true,
      ...overrides.requiredData,
    },
    evals: {
      hotelConcierge: {
        passed: true,
        total: 12,
        failed: 0,
        ...overrides.evals?.hotelConcierge,
      },
      frontDesk: {
        passed: true,
        total: 12,
        failed: 0,
        ...overrides.evals?.frontDesk,
      },
      ...Object.fromEntries(
        Object.entries(overrides.evals || {}).filter(([key]) => !["hotelConcierge", "frontDesk"].includes(key))
      ),
    },
    staffWorkflow: {
      actionRequestQueueEnabled: true,
      ...overrides.staffWorkflow,
    },
    actions: {
      registryValidated: true,
      ...overrides.actions,
    },
    integrations: {
      liveBooking: false,
      pms: false,
      externalExecutionEnabled: false,
      ...overrides.integrations,
    },
    exposure: {
      dashboardSelectorEnabled: false,
      publicPackageSwitchingEnabled: false,
      widgetPackageParamEnabled: false,
      ...overrides.exposure,
    },
    policy: {
      mode: "report-only",
      reportOnlyReviewed: false,
      ...overrides.policy,
    },
    ...(overrides.recommendedData ? { recommendedData: overrides.recommendedData } : {}),
  };
}

function requirementByKey(result, key) {
  return result.requirements.find((requirement) => requirement.key === key);
}

function importSpecifiersForService() {
  const source = readFileSync(SERVICE_PATH, "utf8");
  return [...source.matchAll(/^\s*import\s+[\s\S]*?\s+from\s+["']([^"']+)["'];/gm)]
    .map((match) => match[1]);
}

test("unknown package blocks safely", () => {
  const result = evaluateAgentPackageActivationReadiness("missing_package");

  assert.equal(result.packageKey, "missing_package");
  assert.equal(result.packageVersion, "");
  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "registered_package").status, "blocked");
  assert.equal(result.summary.requiredBlocked > 0, true);
});

test("front_desk_general default readiness passes without hotel-specific requirements", () => {
  const result = evaluateAgentPackageActivationReadiness("front_desk_general");

  assert.equal(result.packageKey, "front_desk_general");
  assert.equal(result.packageVersion, "0.1.0");
  assert.equal(result.status, "ready");
  assert.equal(requirementByKey(result, "registered_package").status, "passed");
  assert.equal(requirementByKey(result, "action_request_registry_valid").status, "passed");
  assert.equal(requirementByKey(result, "required_hotel_data"), undefined);
  assert.equal(requirementByKey(result, "hotel_concierge_eval_passed"), undefined);
});

test("Hotel Concierge internal readiness passes with required context", () => {
  const result = evaluateAgentPackageActivationReadiness("hotel_concierge", hotelReadyContext());

  assert.equal(result.packageKey, "hotel_concierge");
  assert.equal(result.packageVersion, "0.1.0");
  assert.equal(result.status, "ready");
  assert.equal(result.summary.blocked, 0);
  assert.equal(requirementByKey(result, "staff_action_queue_enabled").status, "passed");
  assert.equal(requirementByKey(result, "required_hotel_data").status, "passed");
  assert.equal(requirementByKey(result, "hotel_concierge_eval_passed").status, "passed");
});

test("Hotel Concierge blocks when staff queue is disabled", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      staffWorkflow: {
        actionRequestQueueEnabled: false,
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "staff_action_queue_enabled").status, "blocked");
});

test("Hotel Concierge blocks when action declarations are invalid", () => {
  const invalidPackage = {
    ...getAgentPackage("hotel_concierge"),
    actions: [
      "missing.action",
    ],
  };
  const result = evaluateAgentPackageActivationReadiness(invalidPackage, hotelReadyContext());

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "action_declarations_valid").status, "blocked");
});

test("Hotel Concierge blocks when action request registry validation fails", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      actions: {
        registryValidated: false,
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "action_request_registry_valid").status, "blocked");
});

test("Hotel Concierge blocks when hotel eval did not pass", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      evals: {
        hotelConcierge: {
          passed: false,
          total: 12,
          failed: 1,
        },
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "hotel_concierge_eval_passed").status, "blocked");
});

test("Hotel Concierge blocks when required hotel data is missing", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      requiredData: {
        amenities: false,
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "required_hotel_data").status, "blocked");
  assert.match(requirementByKey(result, "required_hotel_data").message, /Amenities/);
});

test("Hotel Concierge warns for missing recommended data", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      recommendedData: {
        parking: false,
        petPolicy: true,
        localRecommendations: false,
        cancellationPolicy: true,
      },
    })
  );

  assert.equal(result.status, "warning");
  assert.equal(requirementByKey(result, "recommended_hotel_data").status, "warning");
  assert.equal(result.summary.recommendedWarnings, 1);
});

test("public and dashboard activation block by default for Hotel Concierge", () => {
  for (const activationTarget of ["public", "dashboard"]) {
    const result = evaluateAgentPackageActivationReadiness(
      "hotel_concierge",
      hotelReadyContext({
        activationTarget,
      })
    );

    assert.equal(result.status, "blocked");
    assert.equal(requirementByKey(result, "activation_target_allowed").status, "blocked");
  }
});

test("public package switching and widget package param flags block", () => {
  for (const exposure of [
    {
      publicPackageSwitchingEnabled: true,
    },
    {
      widgetPackageParamEnabled: true,
    },
    {
      dashboardSelectorEnabled: true,
    },
  ]) {
    const result = evaluateAgentPackageActivationReadiness(
      "hotel_concierge",
      hotelReadyContext({
        exposure,
      })
    );

    assert.equal(result.status, "blocked");
    assert.equal(requirementByKey(result, "package_exposure_disabled").status, "blocked");
  }
});

test("external execution without integration readiness blocks", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      integrations: {
        externalExecutionEnabled: true,
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "external_execution_disabled_or_ready").status, "blocked");
});

test("policy mode other than report-only blocks", () => {
  const result = evaluateAgentPackageActivationReadiness(
    "hotel_concierge",
    hotelReadyContext({
      policy: {
        mode: "enforced",
      },
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(requirementByKey(result, "policy_report_only").status, "blocked");
});

test("listAgentPackageActivationRequirements returns requirement objects", () => {
  const requirements = listAgentPackageActivationRequirements("front_desk_general");

  assert.equal(Array.isArray(requirements), true);
  assert.equal(requirements.length > 0, true);
  assert.equal(requirements.every((item) => item.key && item.status && item.label), true);
});

test("service has no imports from runtime, provider, UI, route, or embed files", () => {
  const importSpecifiers = importSpecifiersForService();

  assert.deepEqual(importSpecifiers, [
    "../../agentPackages/index.js",
    "../actions/actionRequestRegistry.js",
  ]);

  for (const forbiddenPattern of [
    /supabase/i,
    /openai/i,
    /chat/i,
    /routes?/i,
    /dashboard/i,
    /widget/i,
    /embed/i,
  ]) {
    assert.equal(
      importSpecifiers.some((specifier) => forbiddenPattern.test(specifier)),
      false,
      `Service must not import ${forbiddenPattern}.`
    );
  }
});
