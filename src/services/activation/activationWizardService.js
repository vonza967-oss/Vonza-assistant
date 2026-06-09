import { ACTIVATION_WIZARD_PROGRESS_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

export const ACTIVATION_WIZARD_STEPS = Object.freeze([
  "business_basics",
  "import_knowledge",
  "configure_assistant",
  "install_widget",
  "test_improve",
]);

const STEP_LABELS = Object.freeze({
  business_basics: "Paste Website URL",
  import_knowledge: "Import Content",
  configure_assistant: "Choose Template and Tone",
  install_widget: "Install Widget",
  test_improve: "Verify and Improve",
});

const STEP_NEXT_ACTIONS = Object.freeze({
  business_basics: {
    label: "Save website URL",
    action: "save_business_basics",
    target: "wizard",
  },
  import_knowledge: {
    label: "Import website knowledge",
    action: "import_knowledge",
    target: "knowledge",
  },
  configure_assistant: {
    label: "Save template and tone",
    action: "save_configuration",
    target: "settings",
  },
  install_widget: {
    label: "Open WordPress or embed install",
    action: "open_install",
    target: "install",
  },
  test_improve: {
    label: "Preview widget",
    action: "test_preview",
    target: "preview",
  },
});

const VALID_TEST_QUALITY = new Set(["unknown", "strong", "needs_improvement"]);
const VALID_IMPORT_STATUS = new Set(["idle", "running", "success", "limited", "failed"]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeStepKey(value) {
  const normalized = cleanText(value).toLowerCase();
  return ACTIVATION_WIZARD_STEPS.includes(normalized) ? normalized : "";
}

function normalizeStepList(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map(normalizeStepKey).filter(Boolean))];
}

function normalizeImportStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  return VALID_IMPORT_STATUS.has(normalized) ? normalized : "idle";
}

function normalizeTestQuality(value) {
  const normalized = cleanText(value).toLowerCase();
  return VALID_TEST_QUALITY.has(normalized) ? normalized : "unknown";
}

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST205"
    || error?.code === "42P01"
    || message.includes(`'public.${relationName}'`)
    || message.includes(`${relationName} was not found`)
  );
}

function mapProgressRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agent_id),
    ownerUserId: cleanText(row.owner_user_id),
    currentStep: normalizeStepKey(row.current_step) || "business_basics",
    completedSteps: normalizeStepList(row.completed_steps),
    skippedSteps: normalizeStepList(row.skipped_steps),
    exitedAt: row.exited_at || null,
    completedAt: row.completed_at || null,
    importStatus: normalizeImportStatus(row.import_status),
    importError: cleanText(row.import_error),
    testQuestion: cleanText(row.test_question),
    testQuality: normalizeTestQuality(row.test_quality),
    routeTarget: cleanText(row.route_target),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function createDefaultProgress({ agentId = "", ownerUserId = "" } = {}) {
  return {
    id: "",
    agentId: cleanText(agentId),
    ownerUserId: cleanText(ownerUserId),
    currentStep: "business_basics",
    completedSteps: [],
    skippedSteps: [],
    exitedAt: null,
    completedAt: null,
    importStatus: "idle",
    importError: "",
    testQuestion: "",
    testQuality: "unknown",
    routeTarget: "",
    metadata: {},
    createdAt: null,
    updatedAt: null,
  };
}

function buildProgressPayload(progress) {
  return {
    agent_id: progress.agentId,
    owner_user_id: progress.ownerUserId,
    current_step: normalizeStepKey(progress.currentStep) || "business_basics",
    completed_steps: normalizeStepList(progress.completedSteps),
    skipped_steps: normalizeStepList(progress.skippedSteps),
    exited_at: progress.exitedAt || null,
    completed_at: progress.completedAt || null,
    import_status: normalizeImportStatus(progress.importStatus),
    import_error: cleanText(progress.importError) || null,
    test_question: cleanText(progress.testQuestion) || null,
    test_quality: normalizeTestQuality(progress.testQuality),
    route_target: cleanText(progress.routeTarget) || null,
    metadata: progress.metadata && typeof progress.metadata === "object" ? progress.metadata : {},
    updated_at: nowIso(),
  };
}

export function deriveActivationWizardSignals({
  agent = {},
  messages = [],
  actionQueue = {},
} = {}) {
  const installState = cleanText(agent.installStatus?.state).toLowerCase();
  const hasLiveInstall = ["seen_recently", "seen_stale"].includes(installState);
  const hasDetectedInstall = hasLiveInstall || installState === "installed_unseen";
  const publicFrontDeskPageEnabled = (agent.fullPageConfig?.publicPageEnabled === true || agent.full_page_config?.public_page_enabled === true)
    && Boolean(cleanText(agent.fullPageConfig?.publicPageKey || agent.full_page_config?.public_page_key || agent.publicAgentKey));
  const knowledgeState = cleanText(agent.knowledge?.state).toLowerCase();
  const knowledgeImported = ["ready", "limited"].includes(knowledgeState);
  const hasAssistantConfig = Boolean(
    cleanText(agent.assistantName || agent.name)
    && cleanText(agent.tone)
    && cleanText(agent.purpose)
    && cleanText(agent.welcomeMessage)
    && cleanText(agent.buttonLabel)
  );
  const hasBusinessBasics = Boolean(
    cleanText(agent.name || agent.assistantName)
    && cleanText(agent.websiteUrl)
  );
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const hasUserMessage = normalizedMessages.some((message) => cleanText(message.role).toLowerCase() === "user");
  const hasAssistantMessage = normalizedMessages.some((message) => cleanText(message.role).toLowerCase() === "assistant");
  const weakAnswerCount = Number(
    actionQueue.ownerAnalyticsDashboard?.customerSatisfaction?.weakAnswerCount
    || actionQueue.analyticsSummary?.weakAnswerCount
    || actionQueue.summary?.weakAnswerCount
    || 0
  );
  const knowledgeOpenCount = Number(
    actionQueue.ownerAnalyticsDashboard?.knowledgeImprovement?.openCount
    || actionQueue.knowledgeImprovement?.openCount
    || 0
  );

  return {
    hasBusinessBasics,
    knowledgeImported,
    knowledgeReady: knowledgeState === "ready",
    knowledgeState: knowledgeState || "missing",
    hasAssistantConfig,
    hasDetectedInstall,
    hasLiveInstall,
    publicFrontDeskPageEnabled,
    installState: installState || "not_installed",
    hasPreviewTest: hasUserMessage && hasAssistantMessage,
    weakAnswerCount,
    knowledgeOpenCount,
    needsImprovement: weakAnswerCount > 0 || knowledgeOpenCount > 0,
  };
}

function deriveCompletedSteps(signals) {
  const completed = [];

  if (signals.hasBusinessBasics) {
    completed.push("business_basics");
  }
  if (signals.knowledgeImported) {
    completed.push("import_knowledge");
  }
  if (signals.hasAssistantConfig) {
    completed.push("configure_assistant");
  }
  if (signals.hasDetectedInstall) {
    completed.push("install_widget");
  }
  if (signals.hasPreviewTest) {
    completed.push("test_improve");
  }

  return completed;
}

function chooseCurrentStep(completedSteps, preferredStep = "") {
  const preferred = normalizeStepKey(preferredStep);

  if (preferred && !completedSteps.includes(preferred)) {
    return preferred;
  }

  return ACTIVATION_WIZARD_STEPS.find((step) => !completedSteps.includes(step)) || "test_improve";
}

function buildStepCopy(stepKey, signals, progress) {
  if (stepKey === "business_basics") {
    return signals.hasBusinessBasics
      ? "Business name and website URL are saved."
      : "Paste the business website URL so Vonza can build the widget from the real site.";
  }

  if (stepKey === "import_knowledge") {
    if (progress.importStatus === "failed") {
      return progress.importError || "Website import failed. Retry when the website is reachable.";
    }
    if (signals.knowledgeReady) {
      return "Website content is imported and ready for grounded widget answers.";
    }
    if (signals.knowledgeImported) {
      return "Website content was imported with limited detail. You can retry to strengthen widget answers.";
    }
    return "Import the public website so answers are grounded in real business detail.";
  }

  if (stepKey === "configure_assistant") {
    return signals.hasAssistantConfig
      ? "Template, visible name, tone, and first customer-facing widget settings are saved."
      : "Choose the template, tone, visible name, welcome text, and contact or CTA basics.";
  }

  if (stepKey === "install_widget") {
    if (signals.hasLiveInstall) {
      return "Your Website Widget is live. Vonza has received a ping from the installed site.";
    }
    if (signals.hasDetectedInstall) {
      return "The Website Widget snippet was found. Open the live site once so Vonza can confirm a real page-load ping.";
    }
    return "Install through WordPress or copy the one-line embed snippet, then run verification on the live site.";
  }

  if (signals.needsImprovement) {
    return "A weak-answer signal exists. Review it in Analytics before calling setup complete.";
  }

  if (signals.hasPreviewTest) {
    return "A sample conversation exists. Send the owner to Home to watch the first real usage.";
  }

  return "Preview the widget with one realistic customer question, then improve knowledge if the answer is weak.";
}

function buildStepNextAction(stepKey, signals) {
  if (stepKey === "install_widget" && signals.hasLiveInstall) {
    return {
      label: "Preview widget",
      action: "go_to_test",
      target: "preview",
    };
  }

  if (stepKey === "install_widget" && signals.hasDetectedInstall) {
    return {
      label: "Verify live ping",
      action: "verify_install",
      target: "install",
    };
  }

  if (stepKey === "test_improve" && signals.needsImprovement) {
    return {
      label: "Open Analytics",
      action: "open_analytics",
      target: "analytics",
    };
  }

  if (stepKey === "test_improve" && signals.hasPreviewTest) {
    return {
      label: "Open Home",
      action: "open_home",
      target: "overview",
    };
  }

  return STEP_NEXT_ACTIONS[stepKey];
}

export function buildActivationWizardState({
  agent = {},
  messages = [],
  actionQueue = {},
  progress = null,
  persistenceAvailable = true,
  migrationRequired = false,
} = {}) {
  const normalizedProgress = progress || createDefaultProgress({
    agentId: agent.id,
    ownerUserId: agent.ownerUserId,
  });
  const signals = deriveActivationWizardSignals({ agent, messages, actionQueue });
  const derivedCompletedSteps = deriveCompletedSteps(signals);
  const completedSteps = normalizeStepList([
    ...derivedCompletedSteps,
    ...normalizedProgress.completedSteps,
  ]);
  const existingConfiguredComplete = Boolean(
    signals.hasBusinessBasics
    && signals.knowledgeImported
    && signals.hasAssistantConfig
    && signals.hasLiveInstall
  );
  const completedAt = normalizedProgress.completedAt
    || (existingConfiguredComplete ? nowIso() : null);
  const isComplete = Boolean(completedAt || ACTIVATION_WIZARD_STEPS.every((step) => completedSteps.includes(step)));
  const currentStep = isComplete
    ? "test_improve"
    : chooseCurrentStep(completedSteps, normalizedProgress.currentStep);
  const steps = ACTIVATION_WIZARD_STEPS.map((stepKey) => ({
    key: stepKey,
    label: STEP_LABELS[stepKey],
    complete: completedSteps.includes(stepKey),
    skipped: normalizedProgress.skippedSteps.includes(stepKey),
    active: stepKey === currentStep && !isComplete,
    copy: buildStepCopy(stepKey, signals, normalizedProgress),
    nextAction: buildStepNextAction(stepKey, signals),
  }));

  return {
    available: persistenceAvailable !== false,
    persistenceAvailable: persistenceAvailable !== false,
    migrationRequired: migrationRequired === true,
    agentId: cleanText(agent.id),
    ownerUserId: cleanText(normalizedProgress.ownerUserId || agent.ownerUserId),
    currentStep,
    completedSteps,
    skippedSteps: normalizedProgress.skippedSteps,
    progress,
    importStatus: normalizedProgress.importStatus,
    importError: normalizedProgress.importError,
    testQuestion: normalizedProgress.testQuestion,
    testQuality: normalizedProgress.testQuality,
    routeTarget: normalizedProgress.routeTarget,
    exitedAt: normalizedProgress.exitedAt,
    completedAt,
    isComplete,
    shouldShow: !isComplete && !normalizedProgress.exitedAt,
    canReturn: !isComplete && Boolean(normalizedProgress.exitedAt),
    signals,
    steps,
    nextAction: buildStepNextAction(currentStep, signals),
  };
}

export async function getActivationWizardProgress(
  supabase,
  {
    agent,
    ownerUserId,
    createIfMissing = true,
  } = {}
) {
  const agentId = cleanText(agent?.id);
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const defaultProgress = createDefaultProgress({
    agentId,
    ownerUserId: normalizedOwnerUserId,
  });

  if (!agentId || !normalizedOwnerUserId) {
    return {
      progress: defaultProgress,
      persistenceAvailable: false,
      migrationRequired: false,
    };
  }

  const queryResult = await supabase
    .from(ACTIVATION_WIZARD_PROGRESS_TABLE)
    .select("*")
    .eq("agent_id", agentId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .maybeSingle();

  if (queryResult.error) {
    if (isMissingRelationError(queryResult.error, ACTIVATION_WIZARD_PROGRESS_TABLE)) {
      return {
        progress: defaultProgress,
        persistenceAvailable: false,
        migrationRequired: true,
      };
    }

    throw queryResult.error;
  }

  if (queryResult.data?.id) {
    return {
      progress: mapProgressRow(queryResult.data),
      persistenceAvailable: true,
      migrationRequired: false,
    };
  }

  if (!createIfMissing) {
    return {
      progress: defaultProgress,
      persistenceAvailable: true,
      migrationRequired: false,
    };
  }

  const insertResult = await supabase
    .from(ACTIVATION_WIZARD_PROGRESS_TABLE)
    .insert(buildProgressPayload(defaultProgress))
    .select("*")
    .single();

  if (insertResult.error) {
    if (isMissingRelationError(insertResult.error, ACTIVATION_WIZARD_PROGRESS_TABLE)) {
      return {
        progress: defaultProgress,
        persistenceAvailable: false,
        migrationRequired: true,
      };
    }

    throw insertResult.error;
  }

  return {
    progress: mapProgressRow(insertResult.data),
    persistenceAvailable: true,
    migrationRequired: false,
  };
}

export async function getActivationWizardState(
  supabase,
  {
    agent,
    ownerUserId,
    messages = [],
    actionQueue = {},
    createIfMissing = true,
  } = {}
) {
  const progressResult = await getActivationWizardProgress(supabase, {
    agent,
    ownerUserId,
    createIfMissing,
  });

  return buildActivationWizardState({
    agent,
    messages,
    actionQueue,
    progress: progressResult.progress,
    persistenceAvailable: progressResult.persistenceAvailable,
    migrationRequired: progressResult.migrationRequired,
  });
}

export async function updateActivationWizardProgress(
  supabase,
  {
    agent,
    ownerUserId,
    step,
    action,
    importStatus,
    importError,
    testQuestion,
    testQuality,
    routeTarget,
    metadata,
  } = {}
) {
  const agentId = cleanText(agent?.id);
  const normalizedOwnerUserId = cleanText(ownerUserId);
  const stepKey = normalizeStepKey(step);

  const existing = await getActivationWizardProgress(supabase, {
    agent,
    ownerUserId: normalizedOwnerUserId,
    createIfMissing: true,
  });

  if (existing.persistenceAvailable === false) {
    return buildActivationWizardState({
      agent,
      progress: existing.progress,
      persistenceAvailable: false,
      migrationRequired: existing.migrationRequired,
    });
  }

  const progress = {
    ...existing.progress,
    agentId,
    ownerUserId: normalizedOwnerUserId,
    metadata: {
      ...(existing.progress.metadata || {}),
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
  };

  if (stepKey) {
    progress.currentStep = stepKey;
  }

  if (action === "complete_step" && stepKey) {
    progress.completedSteps = normalizeStepList([...progress.completedSteps, stepKey]);
    progress.skippedSteps = progress.skippedSteps.filter((candidate) => candidate !== stepKey);
    progress.currentStep = chooseCurrentStep(progress.completedSteps, "");
  } else if (action === "skip_step" && stepKey) {
    progress.skippedSteps = normalizeStepList([...progress.skippedSteps, stepKey]);
    progress.currentStep = ACTIVATION_WIZARD_STEPS[
      Math.min(ACTIVATION_WIZARD_STEPS.indexOf(stepKey) + 1, ACTIVATION_WIZARD_STEPS.length - 1)
    ];
  } else if (action === "exit") {
    progress.exitedAt = nowIso();
  } else if (action === "return") {
    progress.exitedAt = null;
  } else if (action === "complete_wizard") {
    progress.completedSteps = [...ACTIVATION_WIZARD_STEPS];
    progress.completedAt = progress.completedAt || nowIso();
    progress.exitedAt = null;
  }

  if (importStatus !== undefined) {
    progress.importStatus = normalizeImportStatus(importStatus);
  }
  if (importError !== undefined) {
    progress.importError = cleanText(importError);
  }
  if (testQuestion !== undefined) {
    progress.testQuestion = cleanText(testQuestion);
  }
  if (testQuality !== undefined) {
    progress.testQuality = normalizeTestQuality(testQuality);
  }
  if (routeTarget !== undefined) {
    progress.routeTarget = cleanText(routeTarget);
  }

  const upsertResult = await supabase
    .from(ACTIVATION_WIZARD_PROGRESS_TABLE)
    .upsert(buildProgressPayload(progress), {
      onConflict: "agent_id,owner_user_id",
    })
    .select("*")
    .single();

  if (upsertResult.error) {
    if (isMissingRelationError(upsertResult.error, ACTIVATION_WIZARD_PROGRESS_TABLE)) {
      return buildActivationWizardState({
        agent,
        progress,
        persistenceAvailable: false,
        migrationRequired: true,
      });
    }

    throw upsertResult.error;
  }

  return buildActivationWizardState({
    agent,
    progress: mapProgressRow(upsertResult.data),
    persistenceAvailable: true,
    migrationRequired: false,
  });
}
