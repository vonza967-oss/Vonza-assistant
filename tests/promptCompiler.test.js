import test from "node:test";
import assert from "node:assert/strict";

import { getAgentPackage } from "../src/agentPackages/index.js";
import { compileAgentSystemPrompt } from "../src/services/chat/promptCompiler.js";
import {
  buildBusinessReplyRepairPrompt,
  buildChatSystemPrompt,
  buildConversationGuidance,
  getFactualReplyGuardrailIssues,
} from "../src/services/chat/prompting.js";

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

test("owner custom instructions are included after guardrails as lower-priority behavior guidance", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: {
      name: "Acme Front Desk",
      tone: "professional",
      systemPrompt: "Ask one practical follow-up before suggesting contact.",
      customInstructions: "Keep answers under 4 sentences. Use one emoji only when confirming bookings.",
    },
  });

  assert.match(prompt, /Instruction priority:/);
  assert.match(prompt, /Owner custom instructions, when present, for style and behavior only/);
  assert.match(prompt, /Additional agent instructions:\nAsk one practical follow-up before suggesting contact\./);
  assert.match(prompt, /Owner custom instructions:\nThese instructions can guide answer length, tone, behavior, emoji usage/);
  assert.match(prompt, /Keep answers under 4 sentences\. Use one emoji only when confirming bookings\./);
  assert.ok(prompt.indexOf("Hard rules:") < prompt.indexOf("Additional agent instructions:"));
  assert.ok(prompt.indexOf("Additional agent instructions:") < prompt.indexOf("Owner custom instructions:"));
  assert.ok(prompt.indexOf("Owner custom instructions:") < prompt.indexOf("Keep answers under 4 sentences."));
});

test("empty owner custom instructions do not change compiled prompt output", () => {
  const agent = {
    name: "Acme Front Desk",
    tone: "professional",
    systemPrompt: "Ask one practical follow-up before suggesting contact.",
  };

  const withoutCustomInstructions = compileAgentSystemPrompt({
    language: "English",
    agent,
  });
  const withEmptyCustomInstructions = compileAgentSystemPrompt({
    language: "English",
    agent: {
      ...agent,
      customInstructions: "   ",
    },
  });

  assert.equal(withEmptyCustomInstructions, withoutCustomInstructions);
  assert.doesNotMatch(withEmptyCustomInstructions, /Owner custom instructions:/);
});

test("saved Website Widget AI Behavior settings appear in prompt compilation", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: {
      name: "Acme Widget",
      purpose: "make_decision",
      tone: "sales",
      systemPrompt: "Ask one practical follow-up before suggesting contact.",
    },
  });

  assert.match(prompt, /represent the assistant identity as Acme Widget/);
  assert.match(prompt, /widget purpose: Make a decision/);
  assert.match(prompt, /purpose-specific behavior: Help visitors compare options/);
  assert.match(prompt, /- preferred tone: sales/);
  assert.match(prompt, /Additional agent instructions:\nAsk one practical follow-up before suggesting contact\./);
  assert.match(prompt, /Do not invent facts, services, prices, or guarantees/);
  assert.match(prompt, /For contact questions, only answer with contact details that are explicitly configured, owner-approved, or clearly present/);
  assert.match(prompt, /If a price, service, policy, availability, legal claim, guarantee, discount, booking time, or contact route is not in the approved answers or business context/);
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

test("Hungarian system prompt uses default-Hungarian policy without English fallback examples", () => {
  const prompt = compileAgentSystemPrompt({
    language: "Hungarian",
    agent: { name: "Vonza Front Desk" },
  });

  assert.match(prompt, /Reply in Hungarian/);
  assert.match(prompt, /explicit selected\/requested language wins/);
  assert.match(prompt, /visitor language is ambiguous or missing, default to Hungarian/);
  assert.match(prompt, /formal Hungarian magázódás/);
  assert.match(prompt, /Never use informal tegeződés/);
  assert.match(prompt, /Ha szeretné, megadhatja az adatait/);
  assert.match(prompt, /Kérem, adja meg/);
  assert.match(prompt, /Ezt az adatot nem látom megerősítve/);
  assert.doesNotMatch(prompt, /Hungarian replies should be natural tegezés/i);
  assert.doesNotMatch(prompt, /I do not have a confirmed contact detail/i);
  assert.doesNotMatch(prompt, /You can leave your details/i);
  assert.doesNotMatch(prompt, /Front Desk does not have that detail/i);
  assert.doesNotMatch(prompt, /Please contact us|listed contact details/i);
});

test("explicit English system prompt preserves English fallback behavior", () => {
  const prompt = compileAgentSystemPrompt({
    language: "English",
    agent: { name: "Vonza Front Desk" },
  });

  assert.match(prompt, /Reply in English/);
  assert.match(prompt, /If the visitor language is clearly English, answer in English/);
  assert.match(prompt, /I do not have a confirmed contact detail for this business here/);
  assert.match(prompt, /Front Desk does not have that detail/);
});

test("Hungarian conversation and repair guidance avoid exact English fallback phrases", () => {
  const conversationGuidance = buildConversationGuidance("Hogyan tudom felvenni a kapcsolatot?", [], {
    language: "Hungarian",
  });
  const repairPrompt = buildBusinessReplyRepairPrompt("Hungarian");

  assert.match(conversationGuidance, /Itt nincs megerősített elérhetőségem/);
  assert.match(repairPrompt, /biztonságos magyar hiányzó-információs/);
  assert.match(repairPrompt, /formális magázódást/);
  assert.match(repairPrompt, /Ha szeretné, megadhatja az adatait/);
  assert.match(repairPrompt, /Kérem, adja meg/);
  assert.doesNotMatch(conversationGuidance, /I do not have a confirmed contact detail/i);
  assert.doesNotMatch(conversationGuidance, /You can leave your details/i);
  assert.doesNotMatch(repairPrompt, /Front Desk does not have that detail/i);
  assert.doesNotMatch(repairPrompt, /maradj természetes tegezésnél/i);
});

test("Hungarian factual guardrails catch invented services, prices, hours, policies, availability, and denials", () => {
  const cases = [
    {
      userMessage: "Milyen szolgáltatásokat kínálnak?",
      businessContext: "Most relevant website excerpts:\nKapcsolatfelvétel az űrlapon keresztül.",
      reply: "Vízvezeték-szerelést és klímaszerelést vállalnak. Melyik érdekel?",
      expected: /invents a service/i,
    },
    {
      userMessage: "Mennyibe kerül a sürgősségi kiszállás?",
      businessContext: "Most relevant website excerpts:\nKérj ajánlatot az űrlapon keresztül.",
      reply: "A sürgősségi kiszállás 25000 Ft. Mikor lenne szükséged rá?",
      expected: /invents a price/i,
    },
    {
      userMessage: "Mikor vagytok nyitva?",
      businessContext: "Most relevant website excerpts:\nKérdés esetén írj üzenetet.",
      reply: "Hétfőtől péntekig 9-17 között nyitva vannak. Melyik nap lenne jó?",
      expected: /invents a policy/i,
    },
    {
      userMessage: "Mi a lemondási szabályzat?",
      businessContext: "Most relevant website excerpts:\nKérdés esetén írj üzenetet.",
      reply: "24 órán belül ingyenes a lemondás. Szeretnél időpontot módosítani?",
      expected: /invents a policy/i,
    },
    {
      userMessage: "Van szabad időpont holnap?",
      businessContext: "Most relevant website excerpts:\nIdőpontkérést az űrlapon lehet elküldeni.",
      reply: "Holnap 10-kor van szabad időpont. Megfelel?",
      expected: /invents a policy/i,
    },
    {
      userMessage: "Javítotok elektromos rollert?",
      businessContext: "Most relevant website excerpts:\nElektromos roller javítás nem szerepel. Szolgáltatások: kerékpár karbantartás.",
      reply: "Nem javítanak elektromos rollert. Kerékpár karbantartás érdekel?",
      expected: /unsupported service denial/i,
    },
  ];

  for (const entry of cases) {
    const issues = getFactualReplyGuardrailIssues(entry);
    assert.ok(
      issues.some((issue) => entry.expected.test(issue)),
      `Expected ${entry.expected} for: ${entry.userMessage}; got ${issues.join(", ")}`
    );
  }

  const safeIssues = getFactualReplyGuardrailIssues({
    userMessage: "Van szabad időpont holnap?",
    businessContext: "Most relevant website excerpts:\nIdőpontkérést az űrlapon lehet elküldeni.",
    reply: "Ezt az időpontot nem látom megerősítve a rendelkezésre álló információkban. Ha szeretné, megadhatja az adatait utánkövetéshez.",
  });
  assert.deepEqual(safeIssues, []);
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
