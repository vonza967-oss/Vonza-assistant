import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActivationWizardState,
  getActivationWizardState,
  updateActivationWizardProgress,
} from "../src/services/activation/activationWizardService.js";

function buildAgent(overrides = {}) {
  return {
    id: "agent-1",
    ownerUserId: "owner-1",
    name: "",
    websiteUrl: "",
    assistantName: "",
    tone: "friendly",
    purpose: "guidance",
    welcomeMessage: "",
    buttonLabel: "",
    knowledge: { state: "missing", pageCount: 0 },
    installStatus: { state: "not_installed" },
    ...overrides,
  };
}

function createFakeSupabase(initialRows = []) {
  const rows = initialRows.map((row) => ({ ...row }));

  const matches = (row, filters) =>
    filters.every((filter) => row[filter.column] === filter.value);

  return {
    rows,
    from(tableName) {
      assert.equal(tableName, "agent_activation_wizard_progress");
      const filters = [];
      let payload = null;

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters.push({ column, value });
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data: rows.find((row) => matches(row, filters)) || null,
            error: null,
          });
        },
        insert(nextPayload) {
          payload = {
            id: `progress-${rows.length + 1}`,
            created_at: "2026-05-11T10:00:00.000Z",
            ...nextPayload,
          };
          rows.push(payload);
          return builder;
        },
        upsert(nextPayload) {
          const index = rows.findIndex((row) =>
            row.agent_id === nextPayload.agent_id && row.owner_user_id === nextPayload.owner_user_id
          );
          payload = {
            ...(index >= 0 ? rows[index] : { id: `progress-${rows.length + 1}`, created_at: "2026-05-11T10:00:00.000Z" }),
            ...nextPayload,
          };
          if (index >= 0) {
            rows[index] = payload;
          } else {
            rows.push(payload);
          }
          return builder;
        },
        single() {
          return Promise.resolve({
            data: payload,
            error: null,
          });
        },
      };

      return builder;
    },
  };
}

test("new owner sees activation wizard entry state", () => {
  const wizard = buildActivationWizardState({
    agent: buildAgent(),
  });

  assert.equal(wizard.shouldShow, true);
  assert.equal(wizard.currentStep, "business_basics");
  assert.equal(wizard.steps.find((step) => step.key === "business_basics")?.active, true);
});

test("existing configured owner is not forced through activation wizard", () => {
  const wizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Configured Co",
      websiteUrl: "https://example.com",
      assistantName: "Configured Assistant",
      welcomeMessage: "How can we help?",
      buttonLabel: "Ask us",
      knowledge: { state: "ready", pageCount: 3 },
      installStatus: { state: "seen_recently" },
    }),
  });

  assert.equal(wizard.isComplete, true);
  assert.equal(wizard.shouldShow, false);
});

test("wizard progress persists and stays owner scoped", async () => {
  const supabase = createFakeSupabase();
  const agent = buildAgent({ name: "Scoped Co", websiteUrl: "https://example.com" });

  await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-1",
    step: "business_basics",
    action: "complete_step",
  });
  await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-2",
    step: "business_basics",
    action: "skip_step",
  });

  const ownerOne = await getActivationWizardState(supabase, {
    agent,
    ownerUserId: "owner-1",
    createIfMissing: false,
  });
  const ownerTwo = await getActivationWizardState(supabase, {
    agent,
    ownerUserId: "owner-2",
    createIfMissing: false,
  });

  assert.equal(ownerOne.completedSteps.includes("business_basics"), true);
  assert.equal(ownerOne.skippedSteps.includes("business_basics"), false);
  assert.equal(ownerTwo.skippedSteps.includes("business_basics"), true);
});

test("each activation step exposes the correct next action", () => {
  const importWizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Import Co",
      websiteUrl: "https://example.com",
    }),
    progress: {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      currentStep: "import_knowledge",
      completedSteps: ["business_basics"],
      skippedSteps: [],
      importStatus: "idle",
      importError: "",
      testQuestion: "",
      testQuality: "unknown",
      routeTarget: "",
      metadata: {},
    },
  });
  assert.equal(importWizard.nextAction.action, "import_knowledge");

  const configureWizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Configure Co",
      websiteUrl: "https://example.com",
      knowledge: { state: "ready", pageCount: 2 },
    }),
  });
  assert.equal(configureWizard.currentStep, "configure_assistant");
  assert.equal(configureWizard.nextAction.action, "save_configuration");

  const installWizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Install Co",
      websiteUrl: "https://example.com",
      assistantName: "Install Assistant",
      welcomeMessage: "Hi",
      buttonLabel: "Chat",
      knowledge: { state: "ready", pageCount: 2 },
    }),
  });
  assert.equal(installWizard.currentStep, "install_widget");
  assert.equal(installWizard.nextAction.action, "open_install");
});

test("skip and return behavior keeps dashboard usable", async () => {
  const supabase = createFakeSupabase();
  const agent = buildAgent();

  const skipped = await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-1",
    step: "business_basics",
    action: "skip_step",
  });
  assert.equal(skipped.currentStep, "import_knowledge");
  assert.equal(skipped.skippedSteps.includes("business_basics"), true);

  const exited = await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-1",
    action: "exit",
  });
  assert.equal(exited.shouldShow, false);
  assert.equal(exited.canReturn, true);

  const returned = await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-1",
    action: "return",
  });
  assert.equal(returned.shouldShow, true);
});

test("import retry failure state is durable and actionable", async () => {
  const supabase = createFakeSupabase();
  const agent = buildAgent({ name: "Retry Co", websiteUrl: "https://example.com" });

  const wizard = await updateActivationWizardProgress(supabase, {
    agent,
    ownerUserId: "owner-1",
    step: "import_knowledge",
    action: "return",
    importStatus: "failed",
    importError: "Website timed out.",
  });

  assert.equal(wizard.importStatus, "failed");
  assert.match(wizard.steps.find((step) => step.key === "import_knowledge")?.copy || "", /timed out/i);
});

test("install verified state confirms the owner is live", () => {
  const wizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Live Co",
      websiteUrl: "https://example.com",
      assistantName: "Live Assistant",
      welcomeMessage: "Hi",
      buttonLabel: "Chat",
      knowledge: { state: "ready", pageCount: 2 },
      installStatus: { state: "seen_recently" },
    }),
    progress: {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      currentStep: "install_widget",
      completedSteps: ["business_basics", "import_knowledge", "configure_assistant"],
      skippedSteps: [],
      importStatus: "success",
      importError: "",
      testQuestion: "",
      testQuality: "unknown",
      routeTarget: "",
      metadata: {},
    },
  });

  const installStep = wizard.steps.find((step) => step.key === "install_widget");
  assert.equal(installStep.complete, true);
  assert.match(installStep.copy, /You are live/i);
});

test("weak test state routes to Analytics", () => {
  const wizard = buildActivationWizardState({
    agent: buildAgent({
      name: "Improve Co",
      websiteUrl: "https://example.com",
      assistantName: "Improve Assistant",
      welcomeMessage: "Hi",
      buttonLabel: "Chat",
      knowledge: { state: "ready", pageCount: 2 },
      installStatus: { state: "seen_recently" },
    }),
    actionQueue: {
      ownerAnalyticsDashboard: {
        knowledgeImprovement: {
          openCount: 1,
        },
      },
    },
    progress: {
      agentId: "agent-1",
      ownerUserId: "owner-1",
      currentStep: "test_improve",
      completedSteps: ["business_basics", "import_knowledge", "configure_assistant", "install_widget"],
      skippedSteps: [],
      importStatus: "success",
      importError: "",
      testQuestion: "Do you publish pricing?",
      testQuality: "needs_improvement",
      routeTarget: "",
      metadata: {},
    },
  });

  assert.equal(wizard.currentStep, "test_improve");
  assert.equal(wizard.nextAction.target, "analytics");
  assert.equal(wizard.nextAction.action, "open_analytics");
});
