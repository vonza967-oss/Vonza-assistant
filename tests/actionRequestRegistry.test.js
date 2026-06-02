import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  getAgentPackage,
  listAgentPackages,
} from "../src/agentPackages/index.js";
import {
  getActionRequestDefinition,
  listActionRequestDefinitions,
  listActionRequestDefinitionsForPackage,
  packageCanCreateActionRequest,
  validatePackageActionDeclarations,
} from "../src/services/actions/actionRequestRegistry.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function findCallablePaths(value, currentPath = "$") {
  if (typeof value === "function") {
    return [currentPath];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    findCallablePaths(nestedValue, `${currentPath}.${key}`)
  );
}

function findExecutableFieldPaths(value, currentPath = "$") {
  const executableFieldNames = new Set([
    "callable",
    "client",
    "clients",
    "execute",
    "executor",
    "function",
    "functions",
    "handler",
    "handlers",
    "integrationClient",
    "invoke",
    "provider",
    "providerClient",
    "providers",
    "resolver",
    "runtimeHandler",
  ]);

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = `${currentPath}.${key}`;
    const matches = executableFieldNames.has(key) ? [nextPath] : [];

    return [
      ...matches,
      ...findExecutableFieldPaths(nestedValue, nextPath),
    ];
  });
}

function listFilesRecursively(rootPath) {
  const entries = readdirSync(rootPath);

  return entries.flatMap((entry) => {
    const entryPath = path.join(rootPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return listFilesRecursively(entryPath);
    }

    return entryPath;
  });
}

test("action request registry keys are unique", () => {
  const keys = listActionRequestDefinitions().map((definition) => definition.key);

  assert.equal(keys.length, new Set(keys).size);
});

test("getActionRequestDefinition safely handles unknown or malformed keys", () => {
  assert.equal(getActionRequestDefinition("missing.action"), null);
  assert.equal(getActionRequestDefinition(""), null);
  assert.equal(getActionRequestDefinition("   "), null);
  assert.equal(getActionRequestDefinition(null), null);
  assert.equal(getActionRequestDefinition({ key: "hotel.bring_water" }), null);

  const definition = getActionRequestDefinition(" HOTEL.BRING_WATER ");
  assert.equal(definition.key, "hotel.bring_water");
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.packageKeys), true);
  assert.equal(Object.isFrozen(definition.guestContextFields), true);
  assert.equal(Object.isFrozen(definition.payloadFields), true);
});

test("action request definitions are immutable and copy-safe", () => {
  const definitions = listActionRequestDefinitions();
  const nextDefinitions = listActionRequestDefinitions();

  assert.equal(Object.isFrozen(definitions), true);
  assert.equal(Object.isFrozen(definitions[0]), true);
  assert.equal(Object.isFrozen(definitions[0].packageKeys), true);
  assert.equal(Object.isFrozen(definitions[0].guestContextFields), true);
  assert.equal(Object.isFrozen(definitions[0].payloadFields), true);
  assert.notEqual(definitions, nextDefinitions);
  assert.notEqual(definitions[0], nextDefinitions[0]);

  assert.throws(() => {
    definitions.push({ key: "mutated.action" });
  }, TypeError);
  assert.throws(() => {
    definitions[0].label = "Mutated";
  }, TypeError);
  assert.throws(() => {
    definitions[0].payloadFields.push("mutatedField");
  }, TypeError);

  const freshDefinition = getActionRequestDefinition(definitions[0].key);
  assert.notEqual(freshDefinition.label, "Mutated");
});

test("action request definitions expose MVP staff-only metadata", () => {
  for (const definition of listActionRequestDefinitions()) {
    assert.equal(definition.requiresStaffAction, true);
    assert.equal(definition.requiresIntegration, false);
    assert.equal(definition.externalExecution, false);
    assert.equal(definition.payloadSchemaVersion, 1);
    assert.equal(definition.guestContextFields.includes("roomLabel"), true);
    assert.equal(definition.guestContextFields.includes("guestName"), true);
    assert.equal(definition.guestContextFields.includes("language"), true);
    assert.equal(definition.payloadFields.length > 0, true);
  }
});

test("Hotel Concierge can declare and create hotel action requests", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.deepEqual(hotelPackage.actions, [
    "common.human_handoff",
    "hotel.bring_water",
    "hotel.extra_towels",
    "hotel.room_service_request",
    "hotel.housekeeping_request",
    "hotel.maintenance_issue",
    "hotel.late_checkout_request",
    "hotel.staff_help",
  ]);

  for (const actionKey of hotelPackage.actions) {
    assert.equal(packageCanCreateActionRequest(hotelPackage, actionKey), true);
  }

  assert.deepEqual(
    listActionRequestDefinitionsForPackage(hotelPackage).map((definition) => definition.key),
    hotelPackage.actions
  );
});

test("Front Desk declares no action requests and cannot create hotel action requests", () => {
  const frontDeskPackage = getAgentPackage("front_desk_general");

  assert.deepEqual(frontDeskPackage.actions, []);
  assert.equal(
    packageCanCreateActionRequest(frontDeskPackage, "hotel.bring_water"),
    false,
    "Front Desk keeps action declarations empty in Phase 2 PR C to avoid implying new runtime behavior."
  );
  assert.equal(packageCanCreateActionRequest(frontDeskPackage, "common.human_handoff"), false);
  assert.deepEqual(listActionRequestDefinitionsForPackage(frontDeskPackage), []);
});

test("action package scoping works for known package keys and malformed input", () => {
  assert.deepEqual(
    listActionRequestDefinitionsForPackage("hotel_concierge").map((definition) => definition.key),
    [
      "common.human_handoff",
      "hotel.bring_water",
      "hotel.extra_towels",
      "hotel.room_service_request",
      "hotel.housekeeping_request",
      "hotel.maintenance_issue",
      "hotel.late_checkout_request",
      "hotel.staff_help",
    ]
  );
  assert.deepEqual(listActionRequestDefinitionsForPackage("front_desk_general"), []);
  assert.deepEqual(listActionRequestDefinitionsForPackage("unknown_package"), []);
  assert.deepEqual(listActionRequestDefinitionsForPackage(null), []);
  assert.equal(packageCanCreateActionRequest(null, "hotel.bring_water"), false);
  assert.equal(packageCanCreateActionRequest("hotel_concierge", null), false);
});

test("current package action declarations validate", () => {
  for (const agentPackage of listAgentPackages()) {
    assert.deepEqual(validatePackageActionDeclarations(agentPackage), []);
  }
});

test("validatePackageActionDeclarations reports malformed package declarations", () => {
  assert.deepEqual(validatePackageActionDeclarations(null), [
    "Package is missing a valid key.",
    "Package (unknown package) must declare actions as an array.",
  ]);
  assert.deepEqual(validatePackageActionDeclarations({
    key: "front_desk_general",
    actions: [
      "hotel.bring_water",
      "hotel.bring_water",
      "missing.action",
      "",
    ],
  }), [
    "Package front_desk_general is not allowed to declare action hotel.bring_water.",
    "Package front_desk_general declares duplicate action hotel.bring_water.",
    "Package front_desk_general declares unregistered action missing.action.",
    "Package front_desk_general declares a malformed action key.",
  ]);
});

test("action registry metadata does not expose executable handlers, callables, or provider clients", () => {
  const definitions = listActionRequestDefinitions();

  assert.deepEqual(findCallablePaths(definitions), []);
  assert.deepEqual(findExecutableFieldPaths(definitions), []);
});

test("public chat, widget, and embed surfaces do not import the action registry", () => {
  const scannedPaths = [
    path.join(REPO_ROOT, "src/services/chat"),
    path.join(REPO_ROOT, "frontend/widget.html"),
    path.join(REPO_ROOT, "assistant-embed.js"),
    path.join(REPO_ROOT, "embed.js"),
    path.join(REPO_ROOT, "embed-lite.js"),
  ];
  const files = scannedPaths.filter((scannedPath) => existsSync(scannedPath)).flatMap((scannedPath) => {
    const stats = statSync(scannedPath);
    return stats.isDirectory() ? listFilesRecursively(scannedPath) : [scannedPath];
  });
  const offenders = files
    .filter((filePath) => /\.(js|html)$/.test(filePath))
    .filter((filePath) => readFileSync(filePath, "utf8").includes("actionRequestRegistry"));

  assert.deepEqual(offenders, []);
});
