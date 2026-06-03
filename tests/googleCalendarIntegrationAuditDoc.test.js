import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const AUDIT_DOC_PATH = "docs/architecture/google-calendar-integration-audit.md";

function readAuditDoc() {
  return readFileSync(AUDIT_DOC_PATH, "utf8");
}

test("Google Calendar integration audit documents required production-readiness sections", () => {
  const doc = readAuditDoc();

  [
    "# Google Calendar Integration Audit",
    "## Executive summary",
    "## What works today",
    "## Current user flow",
    "## Current data model",
    "## OAuth, token, and security model",
    "## Current calendar sync and operator behavior",
    "## Connected Apps mirror behavior",
    "## Dashboard UX gaps",
    "## Safety and privacy risks",
    "## Test coverage gaps",
    "## Recommended improvement phases",
    "## Production-readiness conclusion",
  ].forEach((heading) => {
    assert.match(doc, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("Google Calendar integration audit preserves current safety boundaries", () => {
  const doc = readAuditDoc();

  [
    /No schema or migration change is required by this audit/i,
    /No new Google scopes should be added/i,
    /No public chat calendar execution exists/i,
    /No widget\/embed changes are needed/i,
    /No package activation enforcement exists/i,
    /Recommended next phase: Phase 1 status, reconnect, disconnect, and logging hardening/i,
  ].forEach((pattern) => {
    assert.match(doc, pattern);
  });

  [
    /public chat can (?:manage|create|update|cancel|book|execute)[^\n.]*Google Calendar/i,
    /Google Calendar is production-ready today/i,
    /Connected Apps readiness grants provider execution/i,
    /current packages auto-use Google Calendar/i,
    /widget\/embed calendar execution/i,
  ].forEach((pattern) => {
    assert.doesNotMatch(doc, pattern);
  });
});

test("Google Calendar integration audit names real Google scope URLs without secrets", () => {
  const doc = readAuditDoc();

  assert.match(doc, /https:\/\/www\.googleapis\.com\/auth\/calendar\.readonly/);
  assert.match(doc, /https:\/\/www\.googleapis\.com\/auth\/calendar\.events/);
  assert.match(doc, /google\.calendar\.read/);
  assert.match(doc, /google\.calendar\.write/);
  assert.doesNotMatch(doc, /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/);
  assert.doesNotMatch(doc, /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/);
  assert.doesNotMatch(doc, /GOOGLE_CLIENT_SECRET\s*=\s*["'][^"']+["']/);
  assert.doesNotMatch(doc, /GOOGLE_TOKEN_ENCRYPTION_SECRET\s*=\s*["'][^"']+["']/);
});
