import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("quote request layer plan documents request-only Quote Desk boundary", () => {
  const plan = readFileSync("docs/architecture/quote-request-layer-plan.md", "utf8");

  [
    "quote_intent",
    "quote_request",
    "quote_sent",
    "quote_accepted",
    "pricing_question",
    "quote_mutation_request",
  ].forEach((term) => {
    assert.match(plan, new RegExp(term, "i"));
  });

  assert.match(plan, /must not invent, calculate, or guarantee prices/i);
  assert.match(plan, /must not claim that a final quote was sent or accepted unless trusted proof exists/i);
  assert.match(plan, /Hungarian wording must preserve that boundary/i);
  assert.match(plan, /QUOTE_REQUESTS_FROM_CHAT_ENABLED/i);
  assert.match(plan, /off by default/i);
  assert.match(plan, /Public response metadata is limited to/i);
  assert.match(plan, /"quoteRequest"/i);
  assert.match(plan, /20260604120000_agent_quote_requests\.sql/i);
  assert.match(plan, /PostgREST schema cache/i);
});
