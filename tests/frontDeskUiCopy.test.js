import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardScript = readFileSync("frontend/dashboard.js", "utf8");
const settingsShellScript = readFileSync("frontend/settings/SettingsShell.js", "utf8");
const publicWidgetScript = readFileSync("frontend/script.js", "utf8");

test("Settings Front Desk stays configuration-only", () => {
  assert.match(settingsShellScript, /Identity & welcome/);
  assert.match(settingsShellScript, /Front Desk page/);
  assert.match(settingsShellScript, /Routing/);
  assert.match(settingsShellScript, /Voice/);
  assert.match(settingsShellScript, /Widget appearance/);
  assert.match(settingsShellScript, /Voice output is AI-generated/);
  assert.match(settingsShellScript, /Current live readout/);
  assert.doesNotMatch(settingsShellScript, /Training queue/);
  assert.doesNotMatch(settingsShellScript, /Approved answers/);
  assert.doesNotMatch(settingsShellScript, /Improve answer/);
  assert.doesNotMatch(settingsShellScript, /Test response/);
  assert.match(dashboardScript, /function parseVoiceConfigPayload/);
  assert.match(dashboardScript, /voice_config/);
  assert.match(dashboardScript, /auto_play_spoken_replies/);
});

test("Dashboard Front Desk renders training workspace tabs and empty states", () => {
  ["Practice", "Improvements", "Knowledge", "Answer library", "Launch"].forEach((label) => {
    assert.match(dashboardScript, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  assert.match(dashboardScript, /Practice with Front Desk/);
  assert.match(dashboardScript, /Practice mode — visitors will not see this conversation/);
  assert.match(dashboardScript, /Teach this answer/);
  assert.match(dashboardScript, /What should Front Desk say instead/);
  assert.match(dashboardScript, /Save draft/);
  assert.match(dashboardScript, /Publish improvement/);
  assert.match(dashboardScript, /Nothing needs review right now/);
  assert.match(dashboardScript, /No published answers yet/);
  assert.match(dashboardScript, /Published answers Front Desk can use when visitors ask similar questions/);
  assert.doesNotMatch(dashboardScript, /Approved answers/);
  assert.doesNotMatch(dashboardScript, /Training queue/);
  assert.doesNotMatch(dashboardScript, /Test Front Desk/);
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
