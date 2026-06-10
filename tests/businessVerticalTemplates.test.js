import test from "node:test";
import assert from "node:assert/strict";

import {
  formatBusinessVerticalPromptBlock,
  getBusinessVerticalTemplate,
  listBusinessVerticalTemplates,
  normalizeBusinessVertical,
} from "../src/templates/businessVerticals.js";
import {
  buildBusinessContextForChat,
  buildChatSystemPrompt,
  buildConversationGuidance,
} from "../src/services/chat/prompting.js";

test("business vertical templates expose required sectors and prompt guidance", () => {
  const templates = listBusinessVerticalTemplates();
  const keys = templates.map((template) => template.key);

  assert.deepEqual(keys, ["clinic", "web_studio", "home_services"]);
  assert.equal(normalizeBusinessVertical("Web Agency"), "web_studio");
  assert.equal(getBusinessVerticalTemplate("clinic").commonQuestions.length >= 3, true);

  const promptBlock = formatBusinessVerticalPromptBlock("home_services");
  assert.match(promptBlock, /Home services/i);
  assert.match(promptBlock, /Do you serve my area/i);
  assert.match(promptBlock, /Internal-use only/i);
  assert.match(promptBlock, /do not quote them verbatim/i);
});

test("chat prompting incorporates selected business vertical", () => {
  const systemPrompt = buildChatSystemPrompt("English", {
    name: "Studio Desk",
    purpose: "lead_capture",
    vertical: "web_studio",
  });

  assert.match(systemPrompt, /Selected business vertical: Web studio or agency/);
  assert.match(systemPrompt, /Clarify scope before promising pricing or timelines/);

  const context = buildBusinessContextForChat({
    content: "Website design and ecommerce development. Contact hello@example.com.",
  }, "Can you build a webshop?", {
    vertical: "web_studio",
  });

  assert.match(context, /Common visitor questions and suggested answer direction/);
  assert.match(context, /How much does a website cost/);

  const guidance = buildConversationGuidance("Can I get a quote?", [], {
    vertical: "web_studio",
  });

  assert.match(guidance, /selected business vertical is Web studio or agency/i);
});
