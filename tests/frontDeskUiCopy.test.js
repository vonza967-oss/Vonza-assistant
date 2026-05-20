import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardScript = readFileSync("frontend/dashboard.js", "utf8");
const settingsShellScript = readFileSync("frontend/settings/SettingsShell.js", "utf8");
const publicWidgetScript = readFileSync("frontend/script.js", "utf8");

test("Settings Front Desk stays configuration-only", () => {
  assert.match(settingsShellScript, /Identity & welcome/);
  assert.match(settingsShellScript, /Full-page assistant/);
  assert.match(settingsShellScript, /Routing/);
  assert.match(settingsShellScript, /Widget appearance/);
  assert.match(settingsShellScript, /Current live readout/);
  assert.doesNotMatch(settingsShellScript, /Training queue/);
  assert.doesNotMatch(settingsShellScript, /Approved answers/);
  assert.doesNotMatch(settingsShellScript, /Improve answer/);
  assert.doesNotMatch(settingsShellScript, /Test response/);
});

test("Dashboard Front Desk renders training workspace tabs and empty states", () => {
  ["Overview", "Knowledge", "Approved answers", "Training queue", "Test", "Launch"].forEach((label) => {
    assert.match(dashboardScript, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  assert.match(dashboardScript, /Teach Front Desk/);
  assert.match(dashboardScript, /No approved answers yet/);
  assert.match(dashboardScript, /Nothing needs training right now/);
  assert.match(dashboardScript, /Ask a test question/);
  assert.match(dashboardScript, /Test Front Desk/);
  assert.doesNotMatch(dashboardScript, /Send AI draft/);
});

test("conversation detail exposes owner-friendly training actions", () => {
  assert.match(dashboardScript, /Improve this answer/);
  assert.match(dashboardScript, /Save as approved answer/);
  assert.match(dashboardScript, /Mark not helpful/);
  assert.doesNotMatch(dashboardScript, /Send AI draft/);
});

test("public answer feedback uses owner-friendly review copy", () => {
  assert.match(publicWidgetScript, /Was this helpful\?/);
  assert.match(publicWidgetScript, /Helpful/);
  assert.match(publicWidgetScript, /Not helpful/);
  assert.match(publicWidgetScript, /The business can review this/);
  assert.doesNotMatch(publicWidgetScript, /fine-tune/i);
  assert.doesNotMatch(publicWidgetScript, /train model/i);
});
