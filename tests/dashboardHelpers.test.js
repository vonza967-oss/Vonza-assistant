import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadDashboardHelpers() {
  const source = readFileSync(path.join(repoRoot, "frontend", "dashboardHelpers.js"), "utf8");
  const context = {
    window: {},
    console,
  };

  vm.runInNewContext(source, context, { filename: "frontend/dashboardHelpers.js" });
  return context.window.VonzaDashboardHelpers;
}

function createFakeElement(children = {}) {
  const listeners = new Map();
  const element = {
    disabled: false,
    textContent: "",
    className: "",
    title: "",
    value: "",
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    querySelector(selector) {
      return children[selector] || null;
    },
    removeAttribute(name) {
      if (name === "title") {
        this.title = "";
      }
    },
    async dispatch(type, event = {}) {
      const callback = listeners.get(type);
      if (callback) {
        return callback(event);
      }
      return undefined;
    },
  };

  return element;
}

test("dashboard helper normalizes API error payloads outside dashboard.js", () => {
  const helpers = loadDashboardHelpers();

  assert.equal(helpers.getDashboardApiErrorMessage({ message: "Validation failed" }), "Validation failed");
  assert.equal(
    helpers.getDashboardApiErrorMessage({ error: { message: "Owner scoped access required" } }),
    "Owner scoped access required"
  );
  assert.equal(
    helpers.getDashboardApiErrorMessage({ errors: [{ message: "First field failed" }] }),
    "First field failed"
  );
  assert.equal(helpers.getDashboardApiErrorMessage({}, "Fallback message"), "Fallback message");
});

test("runDashboardMutation reports success and restores disabled controls", async () => {
  const helpers = loadDashboardHelpers();
  const button = createFakeElement();
  const statuses = [];
  let finallyCalled = false;

  const result = await helpers.runDashboardMutation({
    button,
    loadingText: "Saving language...",
    successText: "Dashboard language saved.",
    setStatus: (message) => statuses.push(message),
    mutation: async () => {
      assert.equal(button.disabled, true);
      return { saved: true };
    },
    onFinally: () => {
      finallyCalled = true;
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), { saved: true });
  assert.deepEqual(statuses, ["Saving language...", "Dashboard language saved."]);
  assert.equal(button.disabled, false);
  assert.equal(finallyCalled, true);
});

test("runDashboardMutation normalizes errors and restores disabled controls", async () => {
  const helpers = loadDashboardHelpers();
  const button = createFakeElement();
  const statuses = [];
  const errorMessages = [];

  const result = await helpers.runDashboardMutation({
    button,
    loadingText: "Saving language...",
    errorText: "Could not save dashboard language.",
    setStatus: (message) => statuses.push(message),
    mutation: async () => {
      assert.equal(button.disabled, true);
      throw { errors: [{ message: "Owner scoped access required" }] };
    },
    onError: (_error, message) => {
      errorMessages.push(message);
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "Owner scoped access required");
  assert.deepEqual(statuses, ["Saving language...", "Owner scoped access required"]);
  assert.deepEqual(errorMessages, ["Owner scoped access required"]);
  assert.equal(button.disabled, false);
});

test("bindDashboardLanguagePreferenceForms preserves language form status behavior", async () => {
  const helpers = loadDashboardHelpers();
  const saveState = createFakeElement();
  const select = createFakeElement();
  const submitButton = createFakeElement();
  const form = createFakeElement({
    "[data-save-state]": saveState,
    'select[name="dashboard_language"]': select,
    'button[type="submit"]': submitButton,
  });
  const labels = {
    "language.noChanges": "No changes yet.",
    "language.unsaved": "Unsaved changes",
    "language.saving": "Saving language...",
    "language.settingsSaved": "Dashboard language saved.",
    "language.settingsError": "Could not save dashboard language.",
  };
  const statuses = [];
  const savedLanguages = [];
  let renderCount = 0;
  let prevented = false;
  select.value = "en";

  helpers.bindDashboardLanguagePreferenceForms([form], {
    normalizeDashboardLanguage: (value) => value === "en" ? "en" : "hu",
    translate: (key) => labels[key] || key,
    setStatus: (message) => statuses.push(message),
    saveDashboardLanguage: async (language) => {
      assert.equal(submitButton.disabled, true);
      savedLanguages.push(language);
      return language;
    },
    renderWorkspaceFromState: () => {
      renderCount += 1;
    },
  });

  select.value = "hu";
  await form.dispatch("change");

  assert.equal(saveState.textContent, "Unsaved changes");
  assert.equal(saveState.className, "save-state unsaved");

  await form.dispatch("submit", {
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.deepEqual(savedLanguages, ["hu"]);
  assert.deepEqual(statuses, ["Saving language...", "Dashboard language saved."]);
  assert.equal(saveState.textContent, "Dashboard language saved.");
  assert.equal(saveState.className, "save-state saved");
  assert.equal(submitButton.disabled, false);
  assert.equal(renderCount, 1);
});
