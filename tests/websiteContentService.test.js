import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlainWebsiteContent,
  buildRelevantContextBlock,
  extractStructuredMediaAssets,
  hasVisualIntent,
  selectRelevantImageUrls,
} from "../src/services/scraping/websiteContentService.js";
import {
  buildBusinessContextForChat,
  buildChatSystemPrompt,
  buildConversationGuidance,
} from "../src/services/chat/prompting.js";
import { generateAssistantReply } from "../src/services/chat/assistantReplyService.js";

const MEDIA_BLOCK = `[[VONZA_MEDIA_ASSETS]]
[{"url":"https://example.com/images/hero.jpg","pageUrl":"https://example.com/gallery","alt":"Kitchen remodel hero"},{"url":"https://example.com/images/logo.png","pageUrl":"https://example.com","alt":"Company logo"}]
[[/VONZA_MEDIA_ASSETS]]`;

test("plain website content strips raw image sections and structured media blocks", () => {
  const rawContent = [
    "URL: https://example.com",
    "Title: Acme Services",
    "Images:",
    "https://example.com/uploads/hero.jpg",
    "https://example.com/uploads/gallery.webp",
    "Content:",
    "We remodel kitchens and bathrooms.",
    MEDIA_BLOCK,
  ].join("\n");

  const cleaned = buildPlainWebsiteContent(rawContent);

  assert.doesNotMatch(cleaned, /hero\.jpg/i);
  assert.doesNotMatch(cleaned, /gallery\.webp/i);
  assert.match(cleaned, /We remodel kitchens and bathrooms\./);
});

test("business context stays grounded in text and keeps media URLs out of prompt context", () => {
  const record = {
    content: [
      "Title: Acme Services",
      "Headings:",
      "Kitchen Remodeling",
      "Body:",
      "We design and build custom kitchens.",
      MEDIA_BLOCK,
    ].join("\n"),
  };

  const context = buildBusinessContextForChat(record, "Do you offer kitchen remodeling?");

  assert.match(context, /Kitchen Remodeling/);
  assert.doesNotMatch(context, /https:\/\/example\.com\/images\//i);
  assert.doesNotMatch(buildRelevantContextBlock(record, "show me your kitchen work"), /hero\.jpg/i);
});

test("business context ignores placeholder site contacts and keeps verified configured contacts", () => {
  const record = {
    content: [
      "Title: Acme Services",
      "Body:",
      "Email us at mail@example.com.",
      "Call 123-456-7890 for help.",
    ].join("\n"),
  };

  const context = buildBusinessContextForChat(record, "How can I contact you?", {
    widgetConfig: {
      contactEmail: "team@acmeservices.com",
      contactPhone: "+1 206 555 0199",
    },
  });

  assert.doesNotMatch(context, /mail@example\.com/i);
  assert.doesNotMatch(context, /123-456-7890/);
  assert.match(context, /Configured live contact details: Email: team@acmeservices\.com \| Phone: \+1 206 555 0199\./);
});

test("chat system prompt changes behavior for the selected widget purpose", () => {
  const decisionPrompt = buildChatSystemPrompt("English", {
    name: "Acme Front Desk",
    purpose: "make_decision",
  });

  assert.match(decisionPrompt, /widget purpose: Make a decision/);
  assert.match(decisionPrompt, /compare options/i);
  assert.match(decisionPrompt, /choose the right service, product, or next step/i);

  const defaultPrompt = buildChatSystemPrompt("English", {
    name: "Acme Front Desk",
    purpose: "",
  });

  assert.match(defaultPrompt, /widget purpose: Support/);
  assert.match(defaultPrompt, /resolving common confusion/i);
});

test("chat system prompt includes strict front-desk formatting rules", () => {
  const prompt = buildChatSystemPrompt("English", {
    name: "Acme Front Desk",
    purpose: "lead_sales",
  });

  assert.match(prompt, /Use short, readable answers/i);
  assert.match(prompt, /1-2 sentence paragraphs/i);
  assert.match(prompt, /blank line between paragraphs/i);
  assert.match(prompt, /Do not return dense blocks/i);
  assert.match(prompt, /under 120 words/i);
  assert.match(prompt, /Use bullets for contact details, prices, steps/i);
  assert.match(prompt, /Direct answer\./);
  assert.match(prompt, /Useful detail 1/);
  assert.match(prompt, /one helpful next step or question/i);
  assert.match(prompt, /leave their name, email, and a short project description/i);
});

test("pricing and contact guidance encourages structured business-specific answers", () => {
  const pricingGuidance = buildConversationGuidance("Can I get a quote for this project?", []);

  assert.match(pricingGuidance, /Use a structured answer/i);
  assert.match(pricingGuidance, /fixed pricing is not listed publicly/i);
  assert.match(pricingGuidance, /email or phone details in bullets/i);
  assert.match(pricingGuidance, /leave contact details|short quote request/i);

  const contactGuidance = buildConversationGuidance("How can I contact you?", []);

  assert.match(contactGuidance, /concrete contact details in bullets/i);
  assert.match(contactGuidance, /most practical next action/i);
});

test("assistant reply generation preserves paragraph spacing through post-processing", async () => {
  const reply = await generateAssistantReply({
    openai: {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: "Direct answer.\n\n- Detail one\n- Detail two\n\nWould you like help with the next step?",
                },
              },
            ],
          }),
        },
      },
    },
    userMessage: "Can I get a quote?",
    systemPrompt: "Answer clearly.",
    postProcess: (value) => value,
    repair: {
      getIssues: () => [],
    },
  });

  assert.match(reply, /Direct answer\.\n\n- Detail one\n- Detail two\n\nWould you like help/);
});

test("explicit visual requests can still retrieve structured media assets", () => {
  const record = {
    content: [
      "Title: Acme Services",
      "Body:",
      "We design and build custom kitchens.",
      MEDIA_BLOCK,
    ].join("\n"),
  };

  const assets = extractStructuredMediaAssets(record.content);
  const selected = selectRelevantImageUrls(record, "Can you show me kitchen photos?");

  assert.equal(assets.length, 2);
  assert.deepEqual(selected, ["https://example.com/images/hero.jpg"]);
  assert.equal(hasVisualIntent("What services do you offer?"), false);
  assert.equal(hasVisualIntent("Can you show me photos?"), true);
});
