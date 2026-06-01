import test from "node:test";
import assert from "node:assert/strict";

import { getAgentPackage } from "../src/agentPackages/index.js";
import { compileAgentSystemPrompt } from "../src/services/chat/promptCompiler.js";
import { buildChatSystemPrompt } from "../src/services/chat/prompting.js";

test("compileAgentSystemPrompt includes the existing Front Desk role line", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: { name: "Acme Front Desk" },
  });

  assert.match(
    prompt,
    /^You are a business assistant helping a real customer get a clear, useful answer about this business\./
  );
  assert.match(prompt, /represent the assistant identity as Acme Front Desk/);
});

test("compileAgentSystemPrompt uses package purpose helpers", () => {
  const frontDeskPackage = getAgentPackage("front_desk_general");
  const helperPackage = {
    ...frontDeskPackage,
    purposes: {
      normalize: () => "package_custom",
      getLabel: (purpose) => `Package label for ${purpose}`,
      getInstruction: (purpose) => `Package instruction for ${purpose}`,
    },
  };

  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: { purpose: "lead_capture" },
    agentPackage: helperPackage,
  });

  assert.match(prompt, /widget purpose: Package label for package_custom/);
  assert.match(prompt, /purpose-specific behavior: Package instruction for package_custom/);
});

test("compileAgentSystemPrompt renders current Front Desk vertical blocks", () => {
  const expectedVerticals = [
    {
      key: "clinic",
      label: "Clinic or healthcare office",
      phrase: "Do you accept new patients?",
    },
    {
      key: "web_studio",
      label: "Web studio or agency",
      phrase: "Clarify scope before promising pricing or timelines",
    },
    {
      key: "home_services",
      label: "Home services",
      phrase: "Do you serve my area?",
    },
  ];

  for (const vertical of expectedVerticals) {
    const prompt = compileAgentSystemPrompt({
      language: "English",
      agent: { vertical: vertical.key },
    });

    assert.match(prompt, /Vertical template:/);
    assert.match(prompt, new RegExp(`Selected business vertical: ${vertical.label}`));
    assert.match(prompt, new RegExp(vertical.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("web-call conversation source includes spoken response style", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: { name: "Voice Desk" },
    conversationSource: "Web Call",
  });

  assert.match(prompt, /Web Call spoken response style:/);
  assert.match(prompt, /write for speech/);
  assert.match(prompt, /do not guess just to keep the call moving/);
});

test("non-web-call conversation source omits spoken response style", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: { name: "Text Desk" },
    conversationSource: "widget",
  });

  assert.doesNotMatch(prompt, /Web Call spoken response style:/);
});

test("custom agent instructions and tone still appear", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: {
      name: "Acme Front Desk",
      tone: "professional",
      systemPrompt: "Only mention warranties when they are documented.",
    },
  });

  assert.match(prompt, /- preferred tone: professional/);
  assert.match(prompt, /Additional agent instructions:\nOnly mention warranties when they are documented\./);
});

test("buildChatSystemPrompt remains backward-compatible for existing callers", () => {
  const prompt = buildChatSystemPrompt("Hungarian", {
    name: "Studio Desk",
    purpose: "lead_capture",
    vertical: "web_studio",
    tone: "support",
    systemPrompt: "Ask for project scope before discussing timelines.",
  }, {
    conversation_source: "web_call",
  });

  assert.match(prompt, /Reply in Hungarian/);
  assert.match(prompt, /widget purpose: Lead capture \/ contact/);
  assert.match(prompt, /purpose-specific behavior: When visitors show interest/);
  assert.match(prompt, /Selected business vertical: Web studio or agency/);
  assert.match(prompt, /Web Call spoken response style:/);
  assert.match(prompt, /- preferred tone: support/);
  assert.match(prompt, /Additional agent instructions:\nAsk for project scope before discussing timelines\./);
});

test("representative Front Desk prompt preserves expected behavior phrases after extraction", () => {
  const representativeAgent = {
    name: "Acme Front Desk",
    purpose: "make_decision",
    vertical: "home_services",
    tone: "friendly",
    systemPrompt: "Never promise same-day availability unless it is in the business context.",
  };
  const prompts = [
    compileAgentSystemPrompt({
      language: "English",
      agent: representativeAgent,
      agentPackage: getAgentPackage("front_desk_general"),
      conversationSource: "web_call",
    }),
    buildChatSystemPrompt("English", representativeAgent, {
      conversationSource: "web_call",
    }),
  ];

  for (const prompt of prompts) {
    assert.match(prompt, /widget purpose: Make a decision/);
    assert.match(prompt, /Help visitors compare options/);
    assert.match(prompt, /Selected business vertical: Home services/);
    assert.match(prompt, /Prioritize urgency, location, job type, and next step/);
    assert.match(prompt, /Web Call spoken response style:/);
    assert.match(prompt, /Do not invent facts, services, prices, or guarantees/);
    assert.match(prompt, /If a price, service, policy, availability, legal claim, guarantee, discount, booking time, or contact route is not in the approved answers or business context/);
    assert.match(prompt, /For contact questions, only answer with contact details that are explicitly configured, owner-approved, or clearly present/);
    assert.match(prompt, /Never invent or output placeholder contact details/);
    assert.match(prompt, /Never promise same-day availability unless it is in the business context\./);
  }
});
