import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicVisitorIdentity,
  normalizeVisitorIdentity,
} from "../src/services/chat/visitorIdentityService.js";

test("normalizes guest visitor identity without contact details", () => {
  const identity = normalizeVisitorIdentity({
    mode: "guest",
    email: "ignored@example.com",
    name: "Ignored Name",
  });

  assert.deepEqual(identity, {
    mode: "guest",
    email: "",
    name: "",
  });
});

test("normalizes identified visitor identity from flat payload fields", () => {
  const identity = normalizeVisitorIdentity({
    visitor_mode: "identified",
    visitor_email: "  Casey@example.com  ",
    visitor_name: "Casey Stone",
  });

  assert.deepEqual(identity, {
    mode: "identified",
    email: "casey@example.com",
    name: "Casey Stone",
  });
  assert.deepEqual(buildPublicVisitorIdentity(identity), identity);
});

test("drops invalid identified mode without a usable email", () => {
  const identity = normalizeVisitorIdentity({
    visitor_mode: "identified",
    visitor_name: "No Email",
  });

  assert.deepEqual(identity, {
    mode: "",
    email: "",
    name: "",
  });
  assert.equal(buildPublicVisitorIdentity(identity), null);
});
