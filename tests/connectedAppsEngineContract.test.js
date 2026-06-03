import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  listToolDefinitions,
} from "../src/services/tools/toolRegistry.js";
import {
  listActionRequestDefinitions,
} from "../src/services/actions/actionRequestRegistry.js";
import {
  listAgentPackages,
} from "../src/agentPackages/index.js";
import {
  examplePackageManifest,
} from "../src/agentPackages/_template/manifest.example.js";
import {
  getConnectedAppCapability,
  hasConnectedAppCapability,
  listConnectedAppCapabilities,
  listConnectedAppCapabilitiesForProvider,
  validateConnectedAppCapabilityDeclarations,
} from "../src/services/integrations/connectedAppRegistry.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DOC_PATH = path.join(REPO_ROOT, "docs/architecture/connected-apps-engine-inspection.md");
const REGISTRY_DOC_PATH = path.join(REPO_ROOT, "docs/architecture/connected-app-capability-registry.md");
const DATA_MODEL_PLAN_DOC_PATH = path.join(REPO_ROOT, "docs/architecture/connected-apps-data-model-plan.md");
const CHAT_ROUTE_PATH = path.join(REPO_ROOT, "src/routes/chatRoutes.js");
const CHAT_SERVICE_PATH = path.join(REPO_ROOT, "src/services/chat/chatService.js");
const SCHEMA_PATH = path.join(REPO_ROOT, "db/schema.sql");

function readRepoFile(relativeOrAbsolutePath) {
  return readFileSync(
    path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.join(REPO_ROOT, relativeOrAbsolutePath),
    "utf8"
  );
}

function listFilesRecursively(rootPath, predicate = () => true) {
  if (!existsSync(rootPath)) {
    return [];
  }

  return readdirSync(rootPath).flatMap((entry) => {
    const entryPath = path.join(rootPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return listFilesRecursively(entryPath, predicate);
    }

    return predicate(entryPath) ? [entryPath] : [];
  });
}

function assertContainsAll(source, patterns) {
  for (const pattern of patterns) {
    assert.match(source, pattern);
  }
}

function findExecutableFieldPaths(value, currentPath = "$") {
  const executableFieldNames = new Set([
    "callable",
    "client",
    "clients",
    "execute",
    "executor",
    "function",
    "functions",
    "handler",
    "handlers",
    "integrationClient",
    "invoke",
    "providerClient",
    "providers",
    "resolver",
    "runtimeHandler",
  ]);

  if (typeof value === "function") {
    return [currentPath];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = `${currentPath}.${key}`;
    const matches = executableFieldNames.has(key) ? [nextPath] : [];

    return [
      ...matches,
      ...findExecutableFieldPaths(nestedValue, nextPath),
    ];
  });
}

test("connected apps inspection documents that only the generic persistence foundation exists", () => {
  const doc = readRepoFile(DOC_PATH);

  assert.match(doc, /minimal generic Connected Apps persistence\/service foundation/i);
  assert.match(doc, /not have a generic OAuth\/provider setup or execution engine/i);
  assert.match(doc, /Google, Calendly, Stripe, Twilio, and WhatsApp/);
  assert.match(doc, /report-only Connected Apps readiness/i);
  assert.match(doc, /report-only connected app capability registry/i);
  assert.match(doc, /package tool metadata is not executable permission/i);
  assert.doesNotMatch(doc, /generic Connected Apps execution engine exists today/i);
  assert.doesNotMatch(doc, /public chat can execute external providers directly/i);
});

test("connected app capability registry lists only report-only known provider-specific metadata", () => {
  const capabilities = listConnectedAppCapabilities();
  const keys = capabilities.map((definition) => definition.key);

  assert.deepEqual(keys, [
    "google.calendar.read",
    "google.calendar.write",
    "google.gmail.read",
    "calendly.booking.webhook",
    "stripe.billing.webhook",
    "twilio.phone.webhook",
    "whatsapp.business.webhook",
    "whatsapp.business.send.template",
    "whatsapp.business.send.session.reply",
  ]);
  assert.equal(keys.length, new Set(keys).size);
  assert.deepEqual(
    listConnectedAppCapabilitiesForProvider(" GOOGLE ").map((definition) => definition.key),
    [
      "google.calendar.read",
      "google.calendar.write",
      "google.gmail.read",
    ]
  );
  assert.deepEqual(
    listConnectedAppCapabilitiesForProvider("calendly").map((definition) => definition.key),
    ["calendly.booking.webhook"]
  );
  assert.deepEqual(
    listConnectedAppCapabilitiesForProvider("whatsapp").map((definition) => definition.key),
    [
      "whatsapp.business.webhook",
      "whatsapp.business.send.template",
      "whatsapp.business.send.session.reply",
    ]
  );

  for (const definition of capabilities) {
    assert.equal(typeof definition.key, "string");
    assert.equal(typeof definition.provider, "string");
    assert.equal(typeof definition.appName, "string");
    assert.equal(typeof definition.capability, "string");
    assert.equal(typeof definition.label, "string");
    assert.equal(typeof definition.description, "string");
    assert.match(definition.status, /^(existing|internal|planned)$/);
    assert.equal(typeof definition.ownerScoped, "boolean");
    assert.equal(typeof definition.agentScoped, "boolean");
    assert.equal(typeof definition.requiresOAuth, "boolean");
    assert.equal(typeof definition.requiresWebhook, "boolean");
    assert.equal(typeof definition.requiresSecret, "boolean");
    assert.equal(typeof definition.externalExecution, "boolean");
    assert.equal(definition.publicChatCallable, false);
    assert.equal(definition.packageActivatable, false);
    assert.equal(Array.isArray(definition.allowedSurfaces), true);
    assert.equal(Array.isArray(definition.proofSources), true);
    assert.equal(Array.isArray(definition.existingCodeRefs), true);
    assert.equal(Array.isArray(definition.safetyNotes), true);
  }

  for (const definition of listConnectedAppCapabilitiesForProvider("whatsapp")) {
    assert.equal(definition.appName, "WhatsApp Business");
    assert.equal(definition.publicChatCallable, false);
    assert.equal(definition.packageActivatable, false);
    assert.equal(definition.externalExecution, false);
  }

  assert.equal(getConnectedAppCapability("whatsapp.business.webhook").requiresWebhook, true);
  assert.equal(getConnectedAppCapability("whatsapp.business.send.template").requiresSecret, true);
  assert.equal(getConnectedAppCapability("whatsapp.business.send.session.reply").requiresSecret, true);
});

test("connected app capability registry safely handles unknown and malformed keys", () => {
  assert.equal(getConnectedAppCapability("missing.provider.capability"), null);
  assert.equal(getConnectedAppCapability(""), null);
  assert.equal(getConnectedAppCapability("google"), null);
  assert.equal(getConnectedAppCapability(null), null);
  assert.equal(hasConnectedAppCapability(" GOOGLE.CALENDAR.READ "), true);
  assert.equal(hasConnectedAppCapability("google.calendar"), false);
  assert.equal(hasConnectedAppCapability({ key: "google.calendar.read" }), false);

  assert.deepEqual(validateConnectedAppCapabilityDeclarations(null), [
    "Connected app capability declarations must be an array.",
  ]);
  assert.deepEqual(validateConnectedAppCapabilityDeclarations([
    "google.calendar.read",
    "GOOGLE.CALENDAR.READ",
    "google.calendar",
    "unknown.provider.capability",
  ]), [
    "Connected app capability declaration includes duplicate key google.calendar.read.",
    "Connected app capability declaration includes a malformed key.",
    "Connected app capability declaration includes unknown key unknown.provider.capability.",
  ]);
});

test("connected app capability registry returns frozen and copy-safe data", () => {
  const capabilities = listConnectedAppCapabilities();
  const nextCapabilities = listConnectedAppCapabilities();
  const calendarRead = getConnectedAppCapability("google.calendar.read");

  assert.equal(Object.isFrozen(capabilities), true);
  assert.equal(Object.isFrozen(capabilities[0]), true);
  assert.equal(Object.isFrozen(capabilities[0].allowedSurfaces), true);
  assert.equal(Object.isFrozen(calendarRead), true);
  assert.notEqual(capabilities, nextCapabilities);
  assert.notEqual(capabilities[0], nextCapabilities[0]);

  assert.throws(() => {
    capabilities.push({ key: "mutated.provider.capability" });
  }, TypeError);
  assert.throws(() => {
    capabilities[0].label = "Mutated";
  }, TypeError);
  assert.throws(() => {
    capabilities[0].allowedSurfaces.push("public_chat");
  }, TypeError);

  assert.equal(getConnectedAppCapability("google.calendar.read").label, "Google Calendar read");
});

test("connected app capability registry exposes no executable handlers or provider secrets", () => {
  const capabilities = listConnectedAppCapabilities();
  const serialized = JSON.stringify(capabilities);
  const secretValuePattern = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/;
  const jwtPattern = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
  const oauthUrlPattern = /https?:\/\/(?:accounts\.google\.com|oauth2\.googleapis\.com|graph\.facebook\.com|api\.calendly\.com|api\.stripe\.com|api\.twilio\.com)/i;

  assert.deepEqual(findExecutableFieldPaths(capabilities), []);
  assert.doesNotMatch(serialized, secretValuePattern);
  assert.doesNotMatch(serialized, jwtPattern);
  assert.doesNotMatch(serialized, oauthUrlPattern);

  for (const definition of capabilities) {
    assert.equal(Object.hasOwn(definition, "handler"), false);
    assert.equal(Object.hasOwn(definition, "handlers"), false);
    assert.equal(Object.hasOwn(definition, "client"), false);
    assert.equal(Object.hasOwn(definition, "providerClient"), false);
    assert.equal(Object.hasOwn(definition, "oauthUrl"), false);
    assert.equal(Object.hasOwn(definition, "token"), false);
    assert.equal(Object.hasOwn(definition, "secret"), false);
  }
});

test("public chat and package activation are disabled for every current connected app capability", () => {
  for (const definition of listConnectedAppCapabilities()) {
    assert.equal(definition.publicChatCallable, false);
    assert.equal(definition.packageActivatable, false);
  }
});

test("connected app docs describe Phase 11 WhatsApp verification foundation without execution expansion", () => {
  const docs = [
    DOC_PATH,
    REGISTRY_DOC_PATH,
    DATA_MODEL_PLAN_DOC_PATH,
    path.join(REPO_ROOT, "docs/architecture/whatsapp-connected-app-plan.md"),
    path.join(REPO_ROOT, "docs/architecture/product-runtime-engine-plan.md"),
    path.join(REPO_ROOT, "docs/architecture/package-manifest-contract.md"),
    path.join(REPO_ROOT, "docs/architecture/agent-package-delivery-summary.md"),
  ].map((filePath) => readRepoFile(filePath)).join("\n");

  assert.match(docs, /No generic OAuth\/provider Connected Apps setup exists yet/i);
  assert.match(docs, /manual\/status-only/i);
  assert.match(docs, /Google Calendar.*first adapter/i);
  assert.match(docs, /Uses existing Google connection flow/i);
  assert.match(docs, /No chat execution/i);
  assert.match(docs, /No provider action without approval/i);
  assert.match(docs, /WhatsApp Business.*foundation/i);
  assert.match(docs, /Phase 11 adds.*webhook verification\/readiness/i);
  assert.match(docs, /manual read-only inbound staff inbox/i);
  assert.match(docs, /No WhatsApp replies sent|no WhatsApp replies/i);
  assert.match(docs, /No AI handoff|no AI handoff/i);
  assert.match(docs, /No outbound messaging|no outbound messaging/i);
  assert.match(docs, /No Meta OAuth\/Embedded Signup yet/i);
  assert.match(docs, /app-secret signature validation.*future/i);
  assert.match(docs, /future WhatsApp work must separate inbound webhooks, session replies, and approved template messages/i);
  assert.match(docs, /report-only/i);
  assert.match(docs, /persistence\/service foundation only/i);
  assert.doesNotMatch(docs, /generic OAuth\/provider Connected Apps setup exists today/i);
  assert.doesNotMatch(docs, /owners can connect any supported app/i);
  assert.doesNotMatch(docs, /packages activate provider execution/i);
  assert.doesNotMatch(docs, /generic OAuth setup is implemented today/i);
});

test("connected apps Phase 5 plan separates owner connections from agent enablements", () => {
  const doc = readRepoFile(DATA_MODEL_PLAN_DOC_PATH);

  assertContainsAll(doc, [
    /Connected Apps Phase 5 implements the minimal generic persistence/i,
    /connected_app_connections/,
    /owner or workspace connects a provider account/i,
    /agent_connected_app_enablements/,
    /owner enables a connected app capability for a specific agent/i,
    /does not itself grant provider execution/i,
    /A connected provider account should not imply every agent can use it/i,
  ]);
});

test("connected apps Phase 4 plan requires redacted token and secret handling", () => {
  const doc = readRepoFile(DATA_MODEL_PLAN_DOC_PATH);

  assertContainsAll(doc, [
    /Raw tokens and secrets are never returned to frontend/i,
    /service-role\/internal only/i,
    /Logs redact bearer tokens, JWTs, provider tokens, API keys, signing secrets/i,
    /Rotation and revocation must be supported/i,
    /Scope requests should be least privilege/i,
    /Public status DTOs should expose only provider, app label, capability keys, status/i,
  ]);
  assert.doesNotMatch(doc, /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/);
  assert.doesNotMatch(doc, /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/);
});

test("connected apps Phase 4 permission contract blocks public chat by default", () => {
  const doc = readRepoFile(DATA_MODEL_PLAN_DOC_PATH);

  assertContainsAll(doc, [
    /fail closed unless all of these are true/i,
    /active `connected_app_connections` row/i,
    /enabled `agent_connected_app_enablements` row/i,
    /package declares or is otherwise explicitly allowed/i,
    /Provider scopes and webhook state satisfy the requested capability/i,
    /request surface is in `allowed_surfaces`/i,
    /`approval_mode` allows the specific operation/i,
    /execution path is permitted for this capability/i,
    /Public chat execution is blocked by default/i,
  ]);
});

test("connected apps Phase 4 migration strategy keeps provider tables adapter-first", () => {
  const doc = readRepoFile(DATA_MODEL_PLAN_DOC_PATH);

  assertContainsAll(doc, [
    /Existing provider-specific tables continue unchanged/i,
    /Destructive migration should not be proposed/i,
    /agent_booking_integrations/,
    /Google OAuth\/calendar tables/i,
    /google_oauth_states/,
    /google_connected_accounts/,
    /Stripe billing\/webhook handling/i,
    /Twilio phone webhook handling/i,
  ]);
});

test("connected apps Phase 5 remains persistence and service only", () => {
  const docs = [
    DATA_MODEL_PLAN_DOC_PATH,
    REGISTRY_DOC_PATH,
    DOC_PATH,
    path.join(REPO_ROOT, "docs/architecture/product-runtime-engine-plan.md"),
    path.join(REPO_ROOT, "docs/architecture/agent-package-delivery-summary.md"),
  ].map((filePath) => readRepoFile(filePath)).join("\n");

  assertContainsAll(docs, [
    /Phase 5 implements only the generic persistence and internal service foundation/i,
    /schema\/migration\/service\/tests\/docs only/i,
    /No OAuth\/provider setup/i,
    /No external API or provider execution/i,
    /No package activation enforcement/i,
    /No secrets committed/i,
    /metadata\/report-only/i,
  ]);
});

test("provider-specific integration tables remain separate from generic connected app tables", () => {
  const schema = readRepoFile(SCHEMA_PATH);

  assert.match(schema, /create table if not exists public\.google_oauth_states/);
  assert.match(schema, /create table if not exists public\.google_connected_accounts/);
  assert.match(schema, /constraint agent_booking_integrations_provider_check\s+check \(provider in \('calendly'\)\)/i);
  assert.match(schema, /constraint agent_phone_numbers_provider_check\s+check \(provider in \('twilio'\)\)/i);
  assert.match(schema, /create table if not exists public\.connected_app_connections\b/i);
  assert.match(schema, /create table if not exists public\.agent_connected_app_enablements\b/i);
  assert.match(schema, /Owners can read connected app connections/i);
  assert.match(schema, /Owners can read connected app enablements/i);
  assert.doesNotMatch(schema, /create table if not exists public\.connected_apps\b/i);
  assert.doesNotMatch(schema, /create table if not exists public\.connected_app_webhooks\b/i);
});

test("tool metadata is not executable connected-app permission", () => {
  const definitions = listToolDefinitions();
  const serialized = JSON.stringify(definitions);

  assert.deepEqual(findExecutableFieldPaths(definitions), []);
  assert.doesNotMatch(serialized, /google_connected_accounts|agent_booking_integrations|stripe|twilio|whatsapp/i);

  for (const definition of definitions) {
    assert.equal(Object.hasOwn(definition, "requiresIntegration"), false);
    assert.equal(Object.hasOwn(definition, "externalExecution"), false);
    assert.equal(Object.hasOwn(definition, "providerScopes"), false);
  }
});

test("tool registry declarations are separate from connected app capabilities", () => {
  const toolKeys = listToolDefinitions().map((definition) => definition.key);
  const connectedCapabilityKeys = listConnectedAppCapabilities().map((definition) => definition.key);

  for (const toolKey of toolKeys) {
    assert.equal(hasConnectedAppCapability(toolKey), false);
  }

  for (const connectedCapabilityKey of connectedCapabilityKeys) {
    assert.equal(toolKeys.includes(connectedCapabilityKey), false);
  }
});

test("package manifests do not activate provider execution", () => {
  for (const agentPackage of listAgentPackages()) {
    const requirements = agentPackage.connectedAppRequirements;

    assert.equal(
      !requirements || (Array.isArray(requirements) && requirements.length === 0),
      true
    );
    assert.equal(Object.hasOwn(agentPackage, "connectedAppGrants"), false);
    assert.equal(Object.hasOwn(agentPackage, "providerExecution"), false);
    assert.equal(Object.hasOwn(agentPackage, "externalExecution"), false);
  }
});

test("package manifest template keeps connected app requirements metadata-only", () => {
  const requirements = examplePackageManifest.connectedAppRequirements;

  assert.equal(requirements.reportOnly, true);
  assert.deepEqual(requirements.requiredCapabilities, []);
  assert.deepEqual(requirements.optionalCapabilities, []);
  assert.deepEqual(findExecutableFieldPaths(requirements), []);
  assert.equal(Object.hasOwn(examplePackageManifest, "connectedAppGrants"), false);
  assert.equal(Object.hasOwn(examplePackageManifest, "providerExecution"), false);
  assert.equal(Object.hasOwn(examplePackageManifest, "externalExecution"), false);
});

test("action request metadata remains staff-review only and non-executable", () => {
  for (const definition of listActionRequestDefinitions()) {
    assert.equal(definition.requiresStaffAction, true);
    assert.equal(definition.requiresIntegration, false);
    assert.equal(definition.externalExecution, false);
  }
});

test("public chat path does not directly execute external providers", () => {
  const chatSource = [
    readRepoFile(CHAT_ROUTE_PATH),
    readRepoFile(CHAT_SERVICE_PATH),
  ].join("\n");

  [
    /oauth2\.googleapis\.com/i,
    /gmail\.googleapis\.com/i,
    /calendar\/v3/i,
    /api\.calendly\.com/i,
    /new Stripe\(/i,
    /twilio/i,
    /graph\.facebook\.com/i,
    /sendMessage\(/i,
    /createCalendarEvent\(/i,
    /updateCalendarEvent\(/i,
    /cancelCalendarEvent\(/i,
  ].forEach((pattern) => {
    assert.doesNotMatch(chatSource, pattern);
  });
});

test("public bundles and connected-app docs do not contain secret-looking values", () => {
  const files = [
    DOC_PATH,
    DATA_MODEL_PLAN_DOC_PATH,
    ...listFilesRecursively(path.join(REPO_ROOT, "frontend"), (filePath) =>
      /\.(?:js|css|html)$/.test(filePath)
    ),
  ];
  const secretValuePattern = /\b(?:sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}\b/;
  const jwtPattern = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;

  for (const filePath of files) {
    const source = readRepoFile(filePath);

    assert.doesNotMatch(source, secretValuePattern, `${filePath} contains a secret-looking value`);
    assert.doesNotMatch(source, jwtPattern, `${filePath} contains a JWT-looking value`);
  }
});
