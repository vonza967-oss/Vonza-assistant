import test from "node:test";
import assert from "node:assert/strict";

import { evaluateLiveConversionRouting } from "../src/services/conversion/liveConversionRoutingService.js";

function buildRoutingOptions(overrides = {}) {
  return {
    widgetConfig: {
      bookingUrl: "https://example.com/book",
      quoteUrl: "https://example.com/quote",
      checkoutUrl: "https://example.com/checkout",
      contactEmail: "team@acme.com",
      contactPhone: "+1 206 555 0199",
      primaryCtaMode: "contact",
      fallbackCtaMode: "capture",
      businessHoursNote: "Open Mon-Fri, 9am-5pm.",
    },
    sessionKey: "session-1",
    userMessage: "",
    leadCapture: null,
    recentWidgetEvents: [],
    ...overrides,
  };
}

test("booking intent with booking URL shows a booking CTA", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can I book a consultation for tomorrow?",
  }));

  assert.equal(result.mode, "direct_cta");
  assert.equal(result.primaryCta.ctaType, "booking");
  assert.equal(result.primaryCta.label, "Book now");
});

test("pricing intent with quote URL shows a quote CTA", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can I get a quote for this project?",
  }));

  assert.equal(result.mode, "direct_cta");
  assert.equal(result.primaryCta.ctaType, "quote");
  assert.equal(result.primaryCta.href, "https://example.com/quote");
});

test("contact intent prefers call or email CTA first", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can someone call me back today?",
  }));

  assert.equal(result.mode, "direct_cta");
  assert.equal(result.primaryCta.ctaType, "contact");
  assert.equal(result.primaryCta.targetType, "phone");
  assert.equal(result.secondaryCtas.length, 1);
  assert.equal(result.secondaryCtas[0].targetType, "email");
});

test("purchase intent with checkout URL shows a checkout CTA", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "I want to order now. Where do I check out?",
  }));

  assert.equal(result.mode, "direct_cta");
  assert.equal(result.primaryCta.ctaType, "checkout");
  assert.equal(result.primaryCta.href, "https://example.com/checkout");
});

test("missing destination falls back to capture flow when capture is available", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    widgetConfig: {
      contactPhone: "",
      contactEmail: "",
      bookingUrl: "",
      quoteUrl: "",
      checkoutUrl: "",
      fallbackCtaMode: "capture",
    },
    userMessage: "Can I get a quote for this project?",
    leadCapture: {
      shouldPrompt: true,
      trigger: "pricing_interest",
    },
  }));

  assert.equal(result.mode, "capture_only");
  assert.equal(result.shouldShowCapture, true);
  assert.match(result.reason, /falls back to capture/i);
});

test("repeated CTA prompts are suppressed once the same decision was shown in-session", () => {
  const first = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can I book a consultation?",
    leadCapture: {
      shouldPrompt: true,
      trigger: "booking_intent",
    },
  }));

  const suppressed = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can I book a consultation?",
    leadCapture: {
      shouldPrompt: true,
      trigger: "booking_intent",
    },
    recentWidgetEvents: [
      {
        event_name: "cta_shown",
        session_id: "session-1",
        metadata: {
          decisionKey: first.decisionKey,
          ctaType: first.primaryCta.ctaType,
          targetType: first.primaryCta.targetType,
        },
      },
    ],
  }));

  assert.equal(suppressed.mode, "capture_only");
  assert.equal(suppressed.suppressReason, "cta_already_shown");
  assert.equal(suppressed.shouldShowCapture, true);
});

test("direct routing carries lead capture attribution when no queue context is present", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    userMessage: "Can I get a quote for this project?",
    leadCapture: {
      id: "lead-1",
      shouldPrompt: true,
      latestActionKey: "action-quote-1",
      latestMessageId: "message-1",
      personKey: "person-1",
      relatedFollowUpId: "follow-up-1",
    },
  }));

  assert.equal(result.mode, "direct_then_capture");
  assert.equal(result.relatedActionKey, "action-quote-1");
  assert.equal(result.relatedConversationId, "action-quote-1");
  assert.equal(result.relatedMessageId, "message-1");
  assert.equal(result.relatedPersonKey, "person-1");
  assert.equal(result.relatedLeadId, "lead-1");
  assert.equal(result.relatedFollowUpId, "follow-up-1");
});

test("placeholder contact config never becomes a live contact CTA", () => {
  const result = evaluateLiveConversionRouting(buildRoutingOptions({
    widgetConfig: {
      bookingUrl: "",
      quoteUrl: "",
      checkoutUrl: "",
      contactEmail: "mail@example.com",
      contactPhone: "123-456-7890",
      primaryCtaMode: "contact",
      fallbackCtaMode: "capture",
    },
    userMessage: "Can someone contact me today?",
    leadCapture: {
      shouldPrompt: true,
      trigger: "direct_follow_up",
    },
  }));

  assert.equal(result.mode, "capture_only");
  assert.ok(!result.primaryCta);
  assert.equal(result.shouldShowCapture, true);
});
