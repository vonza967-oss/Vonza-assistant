import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardScript = readFileSync("frontend/dashboard.js", "utf8");
const dashboardFrontDeskScript = readFileSync("frontend/dashboardFrontDesk.js", "utf8");
const dashboardCustomersScript = readFileSync("frontend/dashboardCustomers.js", "utf8");
const settingsShellScript = readFileSync("frontend/settings/SettingsShell.js", "utf8");
const publicWidgetScript = readFileSync("frontend/script.js", "utf8");

test("Settings Front Desk stays configuration-only", () => {
  assert.match(settingsShellScript, /Identity & welcome/);
  assert.match(settingsShellScript, /Front Desk page/);
  assert.match(settingsShellScript, /Routing/);
  assert.match(settingsShellScript, /Voice/);
  assert.match(settingsShellScript, /Optional widget/);
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
  const frontDeskDashboardSurface = `${dashboardScript}\n${dashboardFrontDeskScript}`;

  ["Practice", "Improvements", "Knowledge", "Answer library", "Launch"].forEach((label) => {
    assert.match(frontDeskDashboardSurface, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  assert.match(frontDeskDashboardSurface, /Practice the answer customers will see/);
  assert.match(frontDeskDashboardSurface, /Practice mode — visitors will not see this conversation/);
  assert.match(frontDeskDashboardSurface, /Teach this answer/);
  assert.match(frontDeskDashboardSurface, /What should Front Desk say instead/);
  assert.match(frontDeskDashboardSurface, /Save draft/);
  assert.match(frontDeskDashboardSurface, /Publish improvement/);
  assert.match(frontDeskDashboardSurface, /No answer fixes are waiting/);
  assert.match(frontDeskDashboardSurface, /No published answers yet/);
  assert.match(frontDeskDashboardSurface, /Published answers Front Desk can use when visitors ask similar questions/);
  assert.doesNotMatch(frontDeskDashboardSurface, /Approved answers/);
  assert.doesNotMatch(frontDeskDashboardSurface, /Training queue/);
  assert.doesNotMatch(frontDeskDashboardSurface, /Test Front Desk/);
  assert.doesNotMatch(frontDeskDashboardSurface, /Send AI draft/);
});

test("conversation detail exposes owner-friendly training actions", () => {
  const customerDashboardSurface = `${dashboardScript}\n${dashboardCustomersScript}`;

  assert.match(customerDashboardSurface, /Improve this answer/);
  assert.match(customerDashboardSurface, /Save as approved answer/);
  assert.match(customerDashboardSurface, /Mark not helpful/);
  assert.doesNotMatch(customerDashboardSurface, /Send AI draft/);
});

test("public answer feedback uses owner-friendly review copy", () => {
  assert.match(publicWidgetScript, /Was this helpful\?/);
  assert.match(publicWidgetScript, /Helpful/);
  assert.match(publicWidgetScript, /Not helpful/);
  assert.match(publicWidgetScript, /The business can review this/);
  assert.doesNotMatch(publicWidgetScript, /fine-tune/i);
  assert.doesNotMatch(publicWidgetScript, /train model/i);
});
