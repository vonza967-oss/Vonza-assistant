import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
  listAgentPackages,
} from "../src/agentPackages/index.js";
import { resolveAgentPackage } from "../src/services/agents/agentPackageResolver.js";
import { compileAgentSystemPrompt } from "../src/services/chat/promptCompiler.js";
import { buildChatSystemPrompt } from "../src/services/chat/prompting.js";

test("registry lists Front Desk and Hotel Concierge packages", () => {
  assert.deepEqual(listAgentPackages().map((agentPackage) => agentPackage.key), [
    DEFAULT_AGENT_PACKAGE_KEY,
    "hotel_concierge",
  ]);
});

test("getAgentPackage returns the Hotel Concierge manifest", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.equal(hotelPackage.key, "hotel_concierge");
  assert.equal(hotelPackage.version, "0.1.0");
  assert.equal(hotelPackage.label, "Hotel Concierge");
  assert.match(hotelPackage.description, /guest and pre-arrival concierge/i);
  assert.deepEqual(hotelPackage.supportedSurfaces, ["widget", "full_page", "web_call"]);
  assert.deepEqual(hotelPackage.role, {
    defaultName: "Hotel Concierge",
    identity: "guest and pre-arrival hotel concierge",
    tone: "warm, precise, and service-oriented",
  });
  assert.deepEqual(hotelPackage.intents, [
    "availability",
    "booking",
    "check_in_checkout",
    "amenities",
    "parking",
    "pet_policy",
    "breakfast",
    "local_recommendations",
    "airport_transfer",
    "cancellation_policy",
    "human_handoff",
  ]);
  assert.deepEqual(hotelPackage.riskRules, [
    "Do not guarantee live availability without live booking evidence.",
    "Never say rooms are available or that the hotel has rooms available unless live booking evidence is present, even if you add a caveat afterward.",
    "Do not invent rates/fees/taxes/discounts.",
    "Only state policies from approved evidence.",
    "Use 'not listed or confirmed here' for missing hotel details; never turn missing evidence into a denial such as cats are not permitted.",
    "For vague room or availability questions, answer only the availability limitation and booking next step; do not summarize amenities, policies, or fees.",
    "Keep hotel qualifiers exact, including standard flexible bookings, AM/PM times, and 48 hours before arrival.",
    "Do not expose guest reservation details without verification.",
    "Route urgent safety issues to staff/emergency services.",
  ]);
});

test("resolver resolves Hotel Concierge package in memory", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.equal(resolveAgentPackage({ packageKey: "hotel_concierge" }), hotelPackage);
  assert.equal(resolveAgentPackage({}, { package_key: " HOTEL_CONCIERGE " }), hotelPackage);
});

test("Hotel Concierge prompt includes package role and risk guidance", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: {
      purpose: "lead_capture",
      vertical: "clinic",
    },
    agentPackage: getAgentPackage("hotel_concierge"),
  });

  assert.match(prompt, /represent the assistant identity as Hotel Concierge/);
  assert.match(prompt, /Package role metadata:/);
  assert.match(prompt, /identity: guest and pre-arrival hotel concierge/);
  assert.match(prompt, /Hotel concierge behavior:/);
  assert.match(prompt, /For availability or booking questions/);
  assert.match(prompt, /Package-specific risk rules:/);
  assert.match(prompt, /Do not guarantee live availability without live booking evidence/);
  assert.match(prompt, /Do not invent rates\/fees\/taxes\/discounts/);
  assert.match(prompt, /Do not expose guest reservation details without verification/);
  assert.match(prompt, /Do not invent facts, services, prices, or guarantees/);
  assert.match(prompt, /For contact questions, only answer with contact details that are explicitly configured/);
});

test("Hotel Concierge web-call prompt keeps spoken response style", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agentPackage: getAgentPackage("hotel_concierge"),
    conversationSource: "web_call",
  });

  assert.match(prompt, /Web Call spoken response style:/);
  assert.match(prompt, /write for speech/);
  assert.match(prompt, /Package-specific risk rules:/);
});

test("buildChatSystemPrompt remains backward-compatible for default Front Desk", () => {
  const prompt = buildChatSystemPrompt("English", {
    name: "Acme Front Desk",
    purpose: "make_decision",
    vertical: "home_services",
    tone: "friendly",
    systemPrompt: "Never promise same-day availability unless it is in the business context.",
  });

  assert.match(
    prompt,
    /^You are a business assistant helping a real customer get a clear, useful answer about this business\./
  );
  assert.match(prompt, /represent the assistant identity as Acme Front Desk/);
  assert.match(prompt, /widget purpose: Make a decision/);
  assert.match(prompt, /Selected business vertical: Home services/);
  assert.match(prompt, /Do not invent facts, services, prices, or guarantees/);
  assert.match(prompt, /Never promise same-day availability unless it is in the business context\./);
  assert.doesNotMatch(prompt, /Hotel concierge behavior:/);
  assert.doesNotMatch(prompt, /Package role metadata:/);
  assert.doesNotMatch(prompt, /Package-specific risk rules:/);
});

test("representative Front Desk prompt assertions still pass", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: {
      name: "Acme Front Desk",
      purpose: "make_decision",
      vertical: "home_services",
      tone: "friendly",
      systemPrompt: "Never promise same-day availability unless it is in the business context.",
    },
    agentPackage: getAgentPackage("front_desk_general"),
    conversationSource: "web_call",
  });

  assert.match(prompt, /widget purpose: Make a decision/);
  assert.match(prompt, /Help visitors compare options/);
  assert.match(prompt, /Selected business vertical: Home services/);
  assert.match(prompt, /Prioritize urgency, location, job type, and next step/);
  assert.match(prompt, /Web Call spoken response style:/);
  assert.match(prompt, /If a price, service, policy, availability, legal claim, guarantee, discount, booking time, or contact route is not in the approved answers or business context/);
  assert.match(prompt, /Never invent or output placeholder contact details/);
});

test("package objects are frozen against accidental mutation where practical", () => {
  const hotelPackage = getAgentPackage("hotel_concierge");

  assert.equal(Object.isFrozen(hotelPackage), true);
  assert.equal(Object.isFrozen(hotelPackage.supportedSurfaces), true);
  assert.equal(Object.isFrozen(hotelPackage.role), true);
  assert.equal(Object.isFrozen(hotelPackage.intents), true);
  assert.equal(Object.isFrozen(hotelPackage.riskRules), true);
  assert.equal(Object.isFrozen(hotelPackage.promptBlocks), true);

  assert.throws(() => {
    hotelPackage.key = "mutated";
  }, TypeError);
  assert.throws(() => {
    hotelPackage.supportedSurfaces.push("phone");
  }, TypeError);
  assert.throws(() => {
    hotelPackage.role.defaultName = "Mutated";
  }, TypeError);
  assert.throws(() => {
    hotelPackage.intents.push("spa");
  }, TypeError);
  assert.throws(() => {
    hotelPackage.promptBlocks.role = "";
  }, TypeError);
});
