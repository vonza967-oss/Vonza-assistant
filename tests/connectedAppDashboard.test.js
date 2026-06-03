import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(filePath) {
  return readFileSync(filePath, "utf8");
}

test("dashboard source includes connected apps management surface", () => {
  const dashboard = readSource("frontend/dashboard.js");
  const settingsShell = readSource("frontend/settings/SettingsShell.js");
  const combined = `${dashboard}\n${settingsShell}`;

  assert.match(combined, /Connected apps/i);
  assert.match(combined, /Google Calendar adapter/);
  assert.match(combined, /Uses existing Google connection flow/);
  assert.match(combined, /No chat execution/);
  assert.match(combined, /No provider action without approval/);
  assert.match(combined, /Report-only readiness/);
  assert.match(combined, /WhatsApp Business foundation/);
  assert.match(combined, /Manual\/internal setup/);
  assert.match(combined, /Connected app inbox/);
  assert.match(combined, /Inbound review only/);
  assert.match(combined, /No WhatsApp replies sent/);
  assert.match(combined, /No AI handoff/);
  assert.match(combined, /No outbound messaging/);
  assert.match(combined, /No Meta OAuth\/Embedded Signup yet/);
});

test("dashboard fetches connected app capability connection enablement and readiness endpoints", () => {
  const dashboard = readSource("frontend/dashboard.js");

  assert.match(dashboard, /fetchJson\("\/agents\/connected-app-capabilities"\)/);
  assert.match(dashboard, /fetchJson\("\/agents\/connected-apps"\)/);
  assert.match(dashboard, /fetchJson\(`\/agents\/\$\{encodedAgentId\}\/connected-apps`\)/);
  assert.match(dashboard, /fetchJson\("\/agents\/connected-app-inbound-threads\?provider=whatsapp&limit=25"\)/);
  assert.match(dashboard, /fetchJson\("\/agents\/connected-app-inbound-events\?provider=whatsapp&limit=50"\)/);
  assert.match(dashboard, /connected-app-readiness/);
});

test("dashboard posts status-only connected app and agent enablement endpoints", () => {
  const dashboard = readSource("frontend/dashboard.js");

  assert.match(dashboard, /fetchJson\("\/agents\/connected-apps",\s*\{[^}]*method:\s*"POST"/s);
  assert.match(dashboard, /fetchJson\("\/agents\/connected-apps\/status",\s*\{[^}]*method:\s*"POST"/s);
  assert.match(dashboard, /fetchJson\(`\/agents\/\$\{encodeURIComponent\(agent\.id\)\}\/connected-apps`,\s*\{[^}]*method:\s*"POST"/s);
  assert.match(dashboard, /fetchJson\("\/agents\/connected-app-inbound-threads\/status",\s*\{[^}]*method:\s*"POST"/s);
  assert.match(dashboard, /setupMode:\s*"manual_internal"/);
});

test("dashboard connected apps surface reuses existing Google connect flow", () => {
  const dashboard = readSource("frontend/dashboard.js");
  const settingsShell = readSource("frontend/settings/SettingsShell.js");

  assert.match(settingsShell, /data-google-connect/);
  assert.match(settingsShell, /Connect Google Calendar|Reconnect Google Calendar/);
  assert.match(settingsShell, /Uses existing Google connection flow/);
  assert.match(dashboard, /fetchJson\("\/agents\/google\/connect\/start"/);
});

test("dashboard settings state routes connected apps hashes to the settings section", () => {
  const dashboardState = readSource("frontend/dashboardState.js");

  assert.match(dashboardState, /"connected_apps"/);
  assert.match(dashboardState, /connected_apps:\s*"connected-apps"/);
  assert.match(dashboardState, /"connected-apps":\s*"connected_apps"/);
});

test("dashboard connected apps controls avoid credential oauth and provider execution input names", () => {
  const settingsShell = readSource("frontend/settings/SettingsShell.js");
  const forbiddenNames = [
    "access_token",
    "accessToken",
    "app_secret",
    "appSecret",
    "api_key",
    "apiKey",
    "auth_url",
    "authUrl",
    "authorization_url",
    "authorizationUrl",
    "callback_url",
    "callbackUrl",
    "client_secret",
    "clientSecret",
    "cloud_api_url",
    "cloudApiUrl",
    "embedded_signup_url",
    "embeddedSignupUrl",
    "endpoint_url",
    "endpointUrl",
    "oauth_url",
    "oauthUrl",
    "permanent_access_token",
    "permanentAccessToken",
    "provider_client",
    "providerClient",
    "refresh_token",
    "refreshToken",
    "secret",
    "token",
    "token_secret_ref",
    "tokenSecretRef",
    "verify_token",
    "verifyToken",
    "whatsapp_access_token",
    "whatsappAccessToken",
    "whatsapp_token",
    "whatsappToken",
    "webhook_endpoint_url",
    "webhookEndpointUrl",
    "webhook_url",
    "webhookUrl",
  ];

  for (const fieldName of forbiddenNames) {
    const inputNamePattern = new RegExp(`name=["']${fieldName}["']`, "i");
    assert.doesNotMatch(settingsShell, inputNamePattern);
  }
});

test("dashboard connected apps surface does not expose public chat execution controls or claim provider setup exists", () => {
  const dashboard = readSource("frontend/dashboard.js");
  const settingsShell = readSource("frontend/settings/SettingsShell.js");
  const combined = `${dashboard}\n${settingsShell}`;

  assert.doesNotMatch(combined, /data-connected-app-(?:execute|public-chat|oauth|provider-client)/i);
  assert.doesNotMatch(combined, />\s*(?:Connect with OAuth|Run provider action|Execute provider|Call from public chat|Send message|Send WhatsApp|Draft with AI)\s*</i);
  assert.doesNotMatch(combined, /OAuth setup (?:is ready|enabled|available)/i);
  assert.doesNotMatch(combined, /Embedded Signup (?:is ready|enabled|available)/i);
  assert.doesNotMatch(combined, /provider execution (?:is ready|enabled|available)/i);
});

test("dashboard connected app inbox has no reply send or AI controls", () => {
  const settingsShell = readSource("frontend/settings/SettingsShell.js");

  assert.match(settingsShell, /data-connected-app-inbox-refresh/);
  assert.match(settingsShell, /data-connected-app-inbox-status-form/);
  assert.doesNotMatch(settingsShell, /data-connected-app-inbox-(?:reply|send|ai|handoff)/i);
  assert.doesNotMatch(settingsShell, /<(?:input|textarea)[^>]+name=["'](?:reply|reply_text|message|message_body|phone|profile|ai_draft)["']/i);
  assert.doesNotMatch(settingsShell, /<button[^>]*>\s*(?:Reply|Send|AI draft|Draft reply)\s*<\/button>/i);
});

test("widget embed and chat bundles do not include connected app dashboard endpoints", () => {
  for (const filePath of [
    "assistant-embed.js",
    "embed.js",
    "embed-lite.js",
    "src/routes/chatRoutes.js",
    "src/services/chat/chatService.js",
  ]) {
    const source = readSource(filePath);

    assert.doesNotMatch(source, /connected-app-capabilities|connected-apps|connected-app-readiness/i);
  }
});
