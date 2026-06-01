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
import {
  buildMissingListedServiceReply,
  buildNoWebsiteContentFallbackReply,
  normalizeChatRequestBody,
  validateNormalizedChatRequest,
} from "../src/services/chat/chatService.js";

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
    content: "Website design, maintenance, and support. Email: team@acmeservices.com. Phone: +1 206 867 2400.",
  }, "Webshopot szeretnék.");
  const language = selectResponseLanguage("Webshopot szeretnék.", []);
  const systemPrompt = buildChatSystemPrompt(language, { name: "Vonza" });

  assert.equal(language, "Hungarian");
  assert.match(systemPrompt, /Reply in Hungarian/);
  assert.match(systemPrompt, /same language as the customer's latest message/);
  assert.match(systemPrompt, /Do not translate business names, service names, URLs, addresses, emails, or phone numbers/);
  assert.match(businessContext, /\+1 206 867 2400/);
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

test("chat request normalization keeps public page context and visitor identity aliases", () => {
  const request = normalizeChatRequestBody({
    message: "  Can I book?  ",
    agent_key: "agent-key-1",
    businessId: "business-1",
    website_url: " https://allowed.example/front-desk ",
    visitor_session_key: " session-1 ",
    install_id: " install-1 ",
    page_url: " https://allowed.example/front-desk ",
    origin: " https://allowed.example ",
    public_page_key: " page-key ",
    display_mode: "page",
    conversation_source: "Web Call",
    web_call_id: "call-1",
    visitor_identity_mode: "identified",
    visitor_email: "Customer@RealCo.com",
    visitor_name: " Customer Name ",
    history: [
      { role: "system", content: "ignored" },
      { role: "user", content: " Earlier question " },
    ],
  });

  assert.equal(request.message, "  Can I book?  ");
  assert.equal(request.agentKey, "agent-key-1");
  assert.equal(request.businessId, "business-1");
  assert.equal(request.websiteUrl, "https://allowed.example/front-desk");
  assert.equal(request.sessionKey, "session-1");
  assert.equal(request.installId, "install-1");
  assert.equal(request.pageUrl, "https://allowed.example/front-desk");
  assert.equal(request.origin, "https://allowed.example");
  assert.equal(request.publicPageKey, "page-key");
  assert.equal(request.displayMode, "page");
  assert.equal(request.conversationSource, "web_call");
  assert.deepEqual(request.history, [{ role: "user", content: "Earlier question" }]);
  assert.equal(request.effectiveUserText, "Earlier question Can I book?");
  assert.equal(request.normalizedMessage, "Can I book?");
  assert.equal(request.language, "English");
  assert.deepEqual(request.visitorIdentity, {
    mode: "identified",
    email: "customer@realco.com",
    name: "Customer Name",
  });
  assert.equal(request.webCallId, "call-1");
  assert.doesNotThrow(() => validateNormalizedChatRequest(request));
});

test("chat request validation preserves the public chat error contract", () => {
  assert.throws(
    () => validateNormalizedChatRequest(normalizeChatRequestBody({
      message: " ",
      install_id: "install-1",
    })),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Message cannot be empty/);
      return true;
    }
  );

  assert.throws(
    () => validateNormalizedChatRequest(normalizeChatRequestBody({
      message: "Hello",
    })),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /install_id, agent_id, agent_key, website_url, or business_id is required/);
      return true;
    }
  );
});

test("Hungarian missing-website-content contact fallback stays Hungarian", () => {
  const reply = buildNoWebsiteContentFallbackReply("Hungarian");

  assert.match(reply, /Sajnálom/);
  assert.match(reply, /Kérlek, vedd fel velünk a kapcsolatot/);
  assert.match(reply, /elérhetőségeken/);
  assert.doesNotMatch(reply, /Please contact us|listed contact details/i);
});

test("missing listed service fallback avoids categorical service denial", () => {
  const reply = buildMissingListedServiceReply("English", "Do you repair electric scooters?");

  assert.match(reply, /Front Desk does not have electric scooter repair listed/i);
  assert.match(reply, /share the details/i);
  assert.doesNotMatch(reply, /does not provide|do not offer|currently do not offer/i);
});
