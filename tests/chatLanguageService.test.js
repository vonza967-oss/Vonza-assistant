import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessContextForChat,
  buildChatSystemPrompt,
} from "../src/services/chat/prompting.js";
import {
  detectExplicitLanguageRequest,
  selectResponseLanguage,
} from "../src/utils/text.js";

test("English latest customer message keeps English despite Hungarian business context", () => {
  const businessContext = buildBusinessContextForChat({
    content: "Webshop készítés, keresőoptimalizálás és karbantartás. Email: hello@pelda.hu. Telefon: +36 30 123 4567.",
  }, "Yes please, I want a webshop.");
  const language = selectResponseLanguage("Yes please, I want a webshop.", []);
  const systemPrompt = buildChatSystemPrompt(language, { name: "Vonza" });

  assert.equal(language, "English");
  assert.match(systemPrompt, /Reply in English/);
  assert.match(systemPrompt, /Do not choose the response language from the business website language/);
  assert.match(systemPrompt, /Do not translate business names, service names, URLs, addresses, emails, or phone numbers/);
  assert.match(businessContext, /hello@pelda\.hu/);
});

test("Hungarian latest customer message keeps Hungarian despite English business context", () => {
  const businessContext = buildBusinessContextForChat({
    content: "Website design, maintenance, and support. Email: team@example.com. Phone: +1 555 0100.",
  }, "Webshopot szeretnék.");
  const language = selectResponseLanguage("Webshopot szeretnék.", []);
  const systemPrompt = buildChatSystemPrompt(language, { name: "Vonza" });

  assert.equal(language, "Hungarian");
  assert.match(systemPrompt, /Reply in Hungarian/);
  assert.match(systemPrompt, /same language as the customer's latest message/);
  assert.match(systemPrompt, /Do not translate business names, service names, URLs, addresses, emails, or phone numbers/);
  assert.match(businessContext, /\+1 555 0100/);
});

test("ambiguous short message uses the most recent clear customer language", () => {
  assert.equal(
    selectResponseLanguage("ok", [
      { role: "assistant", content: "Sure, which service do you need?" },
      { role: "user", content: "Webshopot szeretnék." },
    ]),
    "Hungarian"
  );

  assert.equal(
    selectResponseLanguage("ok", [
      { role: "assistant", content: "Miben segíthetek?" },
      { role: "user", content: "I want a website quote." },
    ]),
    "English"
  );
});

test("explicit language requests override the latest customer language", () => {
  assert.equal(detectExplicitLanguageRequest("Válaszolj angolul, kérlek."), "English");
  assert.equal(selectResponseLanguage("Please reply in Hungarian.", []), "Hungarian");
});
