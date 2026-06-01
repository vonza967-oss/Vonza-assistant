import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
  isKnownAgentPackageKey,
  listAgentPackages,
} from "../src/agentPackages/index.js";
import {
  DEFAULT_WIDGET_PURPOSE,
  WIDGET_PURPOSE_OPTIONS,
  getWidgetPurposeInstruction,
  getWidgetPurposeLabel,
} from "../src/services/agents/widgetPurpose.js";

test("agent package registry resolves the default Front Desk package", () => {
  const agentPackage = getAgentPackage();
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.equal(DEFAULT_AGENT_PACKAGE_KEY, "front_desk_general");
  assert.equal(agentPackage.key, DEFAULT_AGENT_PACKAGE_KEY);
  assert.equal(agentPackage.version, "0.1.0");
  assert.equal(agentPackage.label, "AI Front Desk");
  assert.deepEqual(agentPackage.supportedSurfaces, ["widget", "full_page", "web_call"]);
  assert.equal(hotelPackage.key, "hotel_concierge");
  assert.equal(isKnownAgentPackageKey("front_desk_general"), true);
  assert.equal(isKnownAgentPackageKey(" FRONT_DESK_GENERAL "), true);
  assert.equal(isKnownAgentPackageKey(" HOTEL_CONCIERGE "), true);
});

test("unknown or malformed package keys fall back to the default package", () => {
  const defaultPackage = getAgentPackage(DEFAULT_AGENT_PACKAGE_KEY);

  assert.equal(getAgentPackage("unknown_package"), defaultPackage);
  assert.equal(getAgentPackage(""), defaultPackage);
  assert.equal(getAgentPackage("   "), defaultPackage);
  assert.equal(getAgentPackage(null), defaultPackage);
  assert.equal(getAgentPackage({ key: DEFAULT_AGENT_PACKAGE_KEY }), defaultPackage);
  assert.equal(isKnownAgentPackageKey("unknown_package"), false);
  assert.equal(isKnownAgentPackageKey(null), false);
});

test("package list includes the registered internal packages", () => {
  const packages = listAgentPackages();

  assert.equal(Object.isFrozen(packages), true);
  assert.deepEqual(packages.map((agentPackage) => agentPackage.key), [
    DEFAULT_AGENT_PACKAGE_KEY,
    "hotel_concierge",
  ]);
});

test("Front Desk package exposes current business verticals", () => {
  const agentPackage = getAgentPackage();
  const packageVerticals = agentPackage.verticals.listVerticals();

  assert.deepEqual(packageVerticals.map((vertical) => vertical.key), [
    "clinic",
    "web_studio",
    "home_services",
  ]);
  assert.equal(agentPackage.verticals.normalizeVertical("Web Agency"), "web_studio");
});

test("Front Desk package renders current vertical prompt blocks", () => {
  const agentPackage = getAgentPackage();

  for (const verticalKey of ["clinic", "web_studio", "home_services"]) {
    assert.match(
      agentPackage.verticals.formatVerticalPromptBlock(verticalKey),
      /Common visitor questions and suggested answer direction/
    );
  }
});

test("Front Desk package renders current widget purpose copy", () => {
  const agentPackage = getAgentPackage();
  const packageOptions = agentPackage.purposes.options();

  assert.equal(agentPackage.purposes.defaultPurpose, DEFAULT_WIDGET_PURPOSE);
  assert.deepEqual(
    packageOptions.map((option) => option.value),
    WIDGET_PURPOSE_OPTIONS.map((option) => option.value)
  );
  assert.equal(agentPackage.purposes.normalize("help customers decide"), "make_decision");
  assert.equal(agentPackage.purposes.getLabel("booking"), getWidgetPurposeLabel("booking"));
  assert.equal(
    agentPackage.purposes.getInstruction("lead_capture"),
    getWidgetPurposeInstruction("lead_capture")
  );
  assert.equal(agentPackage.purposes.getLabel("booking").length > 0, true);
  assert.equal(agentPackage.purposes.getInstruction("lead_capture").length > 0, true);
});

test("returned package objects are frozen against accidental mutation", () => {
  const agentPackage = getAgentPackage();

  assert.equal(Object.isFrozen(agentPackage), true);
  assert.equal(Object.isFrozen(agentPackage.supportedSurfaces), true);
  assert.equal(Object.isFrozen(agentPackage.verticals), true);
  assert.equal(Object.isFrozen(agentPackage.purposes), true);

  assert.throws(() => {
    agentPackage.key = "mutated";
  }, TypeError);
  assert.throws(() => {
    agentPackage.supportedSurfaces.push("phone");
  }, TypeError);
  assert.throws(() => {
    agentPackage.verticals.normalizeVertical = () => "";
  }, TypeError);
});
