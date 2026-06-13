import test from "node:test";
import assert from "node:assert/strict";

import {
  getAgentPackage,
  listAgentPackages,
} from "../src/agentPackages/index.js";
import { frontDeskGeneralToolKeys } from "../src/agentPackages/front_desk_general/tools.js";
import { hotelConciergeToolKeys } from "../src/agentPackages/hotel_concierge/tools.js";
import {
  getToolDefinition,
  listToolDefinitions,
  listToolDefinitionsForPackage,
  packageCanUseTool,
  validatePackageToolDeclarations,
} from "../src/services/tools/toolRegistry.js";

function findCallablePaths(value, path = "$") {
  if (typeof value === "function") {
    return [path];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    findCallablePaths(nestedValue, `${path}.${key}`)
  );
}

function findExecutableFieldPaths(value, path = "$") {
  const executableFieldNames = new Set([
    "callable",
    "execute",
    "executor",
    "function",
    "functions",
    "handler",
    "handlers",
    "invoke",
    "resolver",
    "runtimeHandler",
  ]);

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const currentPath = `${path}.${key}`;
    const matches = executableFieldNames.has(key) ? [currentPath] : [];

    return [
      ...matches,
      ...findExecutableFieldPaths(nestedValue, currentPath),
    ];
  });
}

test("tool registry keys are unique", () => {
  const keys = listToolDefinitions().map((definition) => definition.key);

  assert.equal(keys.length, new Set(keys).size);
});

test("getToolDefinition safely handles unknown or malformed keys", () => {
  assert.equal(getToolDefinition("missing.tool"), null);
  assert.equal(getToolDefinition(""), null);
  assert.equal(getToolDefinition("   "), null);
  assert.equal(getToolDefinition(null), null);
  assert.equal(getToolDefinition({ key: "common.lead_capture" }), null);

  const definition = getToolDefinition(" COMMON.LEAD_CAPTURE ");
  assert.equal(definition.key, "common.lead_capture");
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.allowedPackages), true);
});

test("listToolDefinitions returns frozen and copy-safe metadata", () => {
  const definitions = listToolDefinitions();
  const nextDefinitions = listToolDefinitions();

  assert.equal(Object.isFrozen(definitions), true);
  assert.equal(Object.isFrozen(definitions[0]), true);
  assert.equal(Object.isFrozen(definitions[0].allowedPackages), true);
  assert.notEqual(definitions, nextDefinitions);
  assert.notEqual(definitions[0], nextDefinitions[0]);

  assert.throws(() => {
    definitions.push({ key: "mutated.tool" });
  }, TypeError);
  assert.throws(() => {
    definitions[0].label = "Mutated";
  }, TypeError);
  assert.throws(() => {
    definitions[0].allowedPackages.push("mutated_package");
  }, TypeError);

  const freshDefinition = getToolDefinition(definitions[0].key);
  assert.notEqual(freshDefinition.label, "Mutated");
});

test("Front Desk can use common tools and verified order support", () => {
  const frontDeskPackage = getAgentPackage("front_desk_general");

  assert.deepEqual(frontDeskPackage.tools, [
    "common.lead_capture",
    "common.contact_route",
    "common.booking_link",
    "common.human_handoff",
    "commerce.order_support",
  ]);

  for (const toolKey of frontDeskPackage.tools) {
    assert.equal(packageCanUseTool(frontDeskPackage, toolKey), true);
  }

  assert.equal(packageCanUseTool(frontDeskPackage, "hotel.booking_availability"), false);
  assert.equal(packageCanUseTool("front_desk_general", "hotel.booking_availability"), false);
  assert.equal(packageCanUseTool(frontDeskPackage, "commerce.order_support"), true);
  assert.deepEqual(
    listToolDefinitionsForPackage(frontDeskPackage).map((definition) => definition.key),
    frontDeskPackage.tools
  );

  const orderSupportDefinition = getToolDefinition("commerce.order_support");
  assert.equal(orderSupportDefinition.riskLevel, "high");
  assert.match(orderSupportDefinition.description, /verified customer order support/i);
});

test("Hotel Concierge can use its declared common and hotel tools", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.deepEqual(hotelPackage.tools, [
    "common.lead_capture",
    "common.contact_route",
    "common.booking_link",
    "common.human_handoff",
    "hotel.booking_availability",
  ]);

  for (const toolKey of hotelPackage.tools) {
    assert.equal(packageCanUseTool(hotelPackage, toolKey), true);
  }

  assert.deepEqual(
    listToolDefinitionsForPackage(hotelPackage).map((definition) => definition.key),
    hotelPackage.tools
  );

  const availabilityDefinition = getToolDefinition("hotel.booking_availability");
  assert.equal(availabilityDefinition.status, "planned");
  assert.equal(availabilityDefinition.riskLevel, "high");
  assert.match(availabilityDefinition.description, /live booking evidence/i);
});

test("package manifests declare only registered and allowed tools", () => {
  const registeredToolKeys = new Set(listToolDefinitions().map((definition) => definition.key));

  for (const agentPackage of listAgentPackages()) {
    assert.equal(Array.isArray(agentPackage.tools), true);

    for (const toolKey of agentPackage.tools) {
      assert.equal(registeredToolKeys.has(toolKey), true);
      assert.equal(packageCanUseTool(agentPackage, toolKey), true);
    }
  }
});

test("validatePackageToolDeclarations reports no errors for current packages", () => {
  for (const agentPackage of listAgentPackages()) {
    assert.deepEqual(validatePackageToolDeclarations(agentPackage), []);
  }
});

test("validatePackageToolDeclarations reports malformed package declarations", () => {
  assert.deepEqual(validatePackageToolDeclarations(null), [
    "Package is missing a valid key.",
    "Package (unknown package) must declare tools as an array.",
  ]);
  assert.deepEqual(validatePackageToolDeclarations({
    key: "front_desk_general",
    tools: [
      "common.lead_capture",
      "common.lead_capture",
      "hotel.booking_availability",
      "missing.tool",
      "",
    ],
  }), [
    "Package front_desk_general declares duplicate tool common.lead_capture.",
    "Package front_desk_general is not allowed to declare tool hotel.booking_availability.",
    "Package front_desk_general declares unregistered tool missing.tool.",
    "Package front_desk_general declares a malformed tool key.",
  ]);
});

test("registry metadata does not expose executable handlers or callables", () => {
  const definitions = listToolDefinitions();

  assert.deepEqual(findCallablePaths(definitions), []);
  assert.deepEqual(findExecutableFieldPaths(definitions), []);
});

test("package objects and tool arrays are protected from accidental mutation", () => {
  const frontDeskPackage = getAgentPackage("front_desk_general");
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.equal(Object.isFrozen(frontDeskPackage), true);
  assert.equal(Object.isFrozen(hotelPackage), true);
  assert.equal(Object.isFrozen(frontDeskPackage.tools), true);
  assert.equal(Object.isFrozen(hotelPackage.tools), true);
  assert.equal(Object.isFrozen(frontDeskGeneralToolKeys), true);
  assert.equal(Object.isFrozen(hotelConciergeToolKeys), true);

  assert.throws(() => {
    frontDeskPackage.tools = [];
  }, TypeError);
  assert.throws(() => {
    frontDeskPackage.tools.push("hotel.booking_availability");
  }, TypeError);
  assert.throws(() => {
    hotelPackage.tools.pop();
  }, TypeError);
});
