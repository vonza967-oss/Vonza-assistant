import { COPILOT_PROPOSAL_STATE_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const PROPOSAL_STATE_SELECT = [
  "id",
  "agent_id",
  "business_id",
  "owner_user_id",
  "proposal_key",
  "proposal_type",
  "status",
  "proposal_hash",
  "status_reason",
  "result_type",
  "result_id",
  "result_section",
  "applied_at",
  "dismissed_at",
  "created_at",
  "updated_at",
].join(", ");

const ACTIVE_PROPOSAL_STATES = new Set(["new", "blocked", "stale"]);
const RESOLVED_PROPOSAL_STATES = new Set(["applied", "dismissed"]);

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function isMissingRelationError(error, relationName = "") {
  const message = cleanText(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST205"
    || error?.code === "PGRST204"
    || error?.code === "42P01"
    || error?.code === "42703"
    || message.includes(`'public.${relationName}'`)
    || message.includes(`${relationName} was not found`)
    || (message.includes("column") && message.includes("does not exist"))
  );
}

function cleanTarget(target = {}) {
  return {
    section: cleanText(target.section),
    id: cleanText(target.id),
    label: cleanText(target.label),
  };
}

function mapProposalStateRow(row = {}) {
  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agent_id),
    businessId: cleanText(row.business_id),
    ownerUserId: cleanText(row.owner_user_id),
    proposalKey: cleanText(row.proposal_key),
    proposalType: cleanText(row.proposal_type),
    status: cleanText(row.status) || "new",
    proposalHash: cleanText(row.proposal_hash),
    statusReason: cleanText(row.status_reason),
    resultType: cleanText(row.result_type),
    resultId: cleanText(row.result_id),
    resultSection: cleanText(row.result_section),
    appliedAt: row.applied_at || null,
    dismissedAt: row.dismissed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeProposalCandidate(candidate = {}, sourceKind = "") {
  const proposal = candidate.proposal && typeof candidate.proposal === "object" ? candidate.proposal : null;

  if (!proposal?.key || !proposal?.type) {
    return null;
  }

  return {
    key: cleanText(proposal.key),
    type: cleanText(proposal.type),
    hash: cleanText(proposal.hash),
    title: cleanText(candidate.title) || cleanText(candidate.subject) || "Copilot proposal",
    summary: cleanText(candidate.summary || proposal.summary || candidate.subject),
    why: cleanText(candidate.rationale || proposal.rationale),
    whatHappens: cleanText(proposal.effect),
    approvalNote: cleanText(proposal.approvalNote) || "Owner approval remains required.",
    applyLabel: cleanText(proposal.applyLabel) || "Apply",
    dismissLabel: cleanText(proposal.dismissLabel) || "Dismiss",
    openLabel: cleanText(proposal.openLabel || proposal.target?.label) || "Open",
    blockedReason: cleanText(proposal.blockedReason),
    target: cleanTarget(proposal.target),
    applyPayload:
      proposal.applyPayload && typeof proposal.applyPayload === "object" && !Array.isArray(proposal.applyPayload)
        ? proposal.applyPayload
        : {},
    sourceKind: cleanText(sourceKind),
    sourceId: cleanText(candidate.id),
    confidence: cleanText(candidate.confidence),
    priority: cleanText(candidate.priority),
    writeBehavior: cleanText(candidate.writeBehavior),
  };
}

function resolveProposalState(candidate, existingState = null) {
  const currentHash = cleanText(candidate.hash);
  const storedHash = cleanText(existingState?.proposalHash);
  const storedStatus = cleanText(existingState?.status) || "";

  if (candidate.blockedReason) {
    return {
      state: "blocked",
      stateReason: candidate.blockedReason,
    };
  }

  if (!existingState) {
    return {
      state: "new",
      stateReason: "",
    };
  }

  if (
    currentHash
    && storedHash
    && currentHash !== storedHash
    && RESOLVED_PROPOSAL_STATES.has(storedStatus)
  ) {
    return {
      state: "stale",
      stateReason: "The underlying context changed after the last action, so Copilot surfaced this proposal again.",
    };
  }

  if (storedStatus === "blocked") {
    if (currentHash && storedHash && currentHash !== storedHash) {
      return {
        state: "stale",
        stateReason: "The earlier block may have cleared, so this proposal is ready for review again.",
      };
    }

    return {
      state: "blocked",
      stateReason: cleanText(existingState.statusReason) || "This proposal is currently blocked.",
    };
  }

  return {
    state: storedStatus || "new",
    stateReason: cleanText(existingState.statusReason),
  };
}

function countByState(proposals = []) {
  return proposals.reduce((summary, proposal) => {
    if (!ACTIVE_PROPOSAL_STATES.has(proposal.state)) {
      summary.hiddenCount += 1;
      return summary;
    }

    summary.activeCount += 1;
    if (proposal.state === "blocked") {
      summary.blockedCount += 1;
    }
    return summary;
  }, {
    activeCount: 0,
    blockedCount: 0,
    hiddenCount: 0,
  });
}

function getProposalSortRank(proposal = {}) {
  switch (proposal.type) {
    case "create_follow_up_draft":
      return 10;
    case "create_operator_task":
      return 20;
    case "create_outcome_review":
      return 30;
    case "create_contact_next_step":
      return 40;
    case "open_existing_surface":
      return 50;
    default:
      return 99;
  }
}

function findContact(workspace = {}, contactId = "") {
  return normalizeArray(workspace.contacts?.list).find((contact) => cleanText(contact.id) === cleanText(contactId)) || null;
}

function findFollowUp(workspace = {}, followUpId = "") {
  return normalizeArray(workspace.automations?.followUps).find((followUp) => cleanText(followUp.id) === cleanText(followUpId)) || null;
}

function buildOpenSurfaceResult(target = {}) {
  return {
    status: "applied",
    resultType: "surface",
    resultId: cleanText(target.id),
    resultSection: cleanText(target.section),
    target: cleanTarget(target),
  };
}

async function persistProposalState(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const proposalKey = cleanText(options.proposalKey);
  const proposalType = cleanText(options.proposalType);
  const status = cleanText(options.status) || "new";
  const proposalHash = cleanText(options.proposalHash);

  if (!agentId || !ownerUserId || !proposalKey || !proposalType || !proposalHash) {
    const error = new Error("agent_id, owner_user_id, proposal_key, proposal_type, and proposal_hash are required");
    error.statusCode = 400;
    throw error;
  }

  const lookup = await supabase
    .from(COPILOT_PROPOSAL_STATE_TABLE)
    .select(PROPOSAL_STATE_SELECT)
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .eq("proposal_key", proposalKey)
    .maybeSingle();

  if (lookup.error) {
    if (isMissingRelationError(lookup.error, COPILOT_PROPOSAL_STATE_TABLE)) {
      return {
        record: null,
        persistenceAvailable: false,
      };
    }

    throw lookup.error;
  }

  const payload = {
    agent_id: agentId,
    business_id: cleanText(options.businessId) || null,
    owner_user_id: ownerUserId,
    proposal_key: proposalKey,
    proposal_type: proposalType,
    status,
    proposal_hash: proposalHash,
    status_reason: cleanText(options.statusReason) || null,
    result_type: cleanText(options.resultType) || null,
    result_id: cleanText(options.resultId) || null,
    result_section: cleanText(options.resultSection) || null,
    applied_at: status === "applied" ? (options.appliedAt || nowIso()) : null,
    dismissed_at: status === "dismissed" ? (options.dismissedAt || nowIso()) : null,
    updated_at: nowIso(),
  };

  const query = lookup.data?.id
    ? supabase
      .from(COPILOT_PROPOSAL_STATE_TABLE)
      .update(payload)
      .eq("id", lookup.data.id)
    : supabase
      .from(COPILOT_PROPOSAL_STATE_TABLE)
      .insert(payload);

  const { data, error } = await query
    .select(PROPOSAL_STATE_SELECT)
    .single();

  if (error) {
    if (isMissingRelationError(error, COPILOT_PROPOSAL_STATE_TABLE)) {
      return {
        record: null,
        persistenceAvailable: false,
      };
    }

    throw error;
  }

  return {
    record: mapProposalStateRow(data),
    persistenceAvailable: true,
  };
}

async function executeCreateFollowUpDraft(supabase, options = {}) {
  const proposal = options.proposal || {};
  const workspace = options.workspace || {};
  const payload = proposal.applyPayload || {};
  const contact = findContact(workspace, payload.contactId);
  const contactEmail = cleanText(payload.contactEmail || contact?.primaryEmail);
  const contactPhone = cleanText(payload.contactPhone || contact?.primaryPhone);

  if (!contactEmail && !contactPhone) {
    return {
      status: "blocked",
      statusReason: "A usable email address or phone number is required before Copilot can create this follow-up draft safely.",
    };
  }

  const createManualFollowUpWorkflow = options.deps?.createManualFollowUpWorkflow;

  if (typeof createManualFollowUpWorkflow !== "function") {
    const error = new Error("createManualFollowUpWorkflow dependency is required");
    error.statusCode = 500;
    throw error;
  }

  const result = await createManualFollowUpWorkflow(supabase, {
    agentId: cleanText(options.agent?.id),
    ownerUserId: cleanText(options.ownerUserId),
    businessName: cleanText(options.agent?.assistantName || options.agent?.name),
    assistantName: cleanText(options.agent?.assistantName || options.agent?.name),
    actionType: cleanText(payload.actionType) || "lead_follow_up",
    contactId: cleanText(payload.contactId),
    contactName: cleanText(payload.contactName || contact?.displayName),
    contactEmail,
    contactPhone,
    personKey: cleanText(payload.personKey || contact?.personKey || contact?.primaryPersonKey),
    linkedActionKeys: normalizeArray(payload.linkedActionKeys),
    sourceActionKey: cleanText(payload.sourceActionKey),
    topic: cleanText(payload.topic),
    subject: cleanText(payload.subject),
    draftContent: cleanText(payload.draftContent),
    evidence: cleanText(payload.evidence),
    whyPrepared: cleanText(payload.whyPrepared),
    pageHint: cleanText(payload.pageHint),
    contextQuestion: cleanText(payload.contextQuestion),
    contextSnippet: cleanText(payload.contextSnippet),
  });

  if (result?.persistenceAvailable === false || !result?.followUp?.id) {
    return {
      status: "blocked",
      statusReason: "The follow-up workflow is not available on this workspace yet.",
    };
  }

  return {
    status: "applied",
    resultType: "follow_up_workflow",
    resultId: cleanText(result.followUp.id),
    resultSection: "automations",
    target: {
      section: "automations",
      id: cleanText(result.followUp.id),
      label: "Open Automations",
    },
    followUp: result.followUp,
  };
}

async function executeCreateOperatorTask(supabase, options = {}) {
  const createOperatorTask = options.deps?.createOperatorTask;

  if (typeof createOperatorTask !== "function") {
    const error = new Error("createOperatorTask dependency is required");
    error.statusCode = 500;
    throw error;
  }

  const proposal = options.proposal || {};
  const payload = proposal.applyPayload || {};
  const task = await createOperatorTask(supabase, {
    agent: options.agent,
    ownerUserId: options.ownerUserId,
    sourceType: "copilot_proposal",
    sourceId: proposal.key,
    taskType: cleanText(payload.taskType) || "copilot_owner_next_step",
    title: cleanText(payload.title) || proposal.title,
    description: cleanText(payload.description) || proposal.summary,
    priority: cleanText(payload.priority) || "normal",
    approvalRequired: true,
    contactId: cleanText(payload.contactId),
    relatedLeadId: cleanText(payload.leadId),
    relatedActionKey: cleanText(payload.relatedActionKey || payload.actionKey),
    taskState: {
      proposalKey: proposal.key,
      proposalType: proposal.type,
      recommendationId: cleanText(payload.recommendationId),
      targetSection: cleanText(payload.targetSection),
      targetId: cleanText(payload.targetId),
      targetLabel: cleanText(payload.targetLabel),
    },
  });

  return {
    status: "applied",
    resultType: "operator_task",
    resultId: cleanText(task?.id),
    resultSection: "automations",
    target: {
      section: "automations",
      id: cleanText(task?.id),
      label: "Open Automations",
    },
    task,
  };
}

async function executeCreateOutcomeReview(supabase, options = {}) {
  const proposal = options.proposal || {};
  const payload = proposal.applyPayload || {};
  return executeCreateOperatorTask(supabase, {
    ...options,
    proposal: {
      ...proposal,
      applyPayload: {
        ...payload,
        taskType: cleanText(payload.taskType) || "outcome_review",
        priority: cleanText(payload.priority) || "normal",
      },
    },
  });
}

async function executeCreateContactNextStep(supabase, options = {}) {
  const proposal = options.proposal || {};
  const payload = proposal.applyPayload || {};
  const executionMode = cleanText(payload.executionMode);

  if (executionMode === "create_follow_up_draft") {
    return executeCreateFollowUpDraft(supabase, {
      ...options,
      proposal: {
        ...proposal,
        applyPayload: payload.followUpPayload && typeof payload.followUpPayload === "object"
          ? payload.followUpPayload
          : {},
      },
    });
  }

  if (executionMode === "open_existing_surface") {
    return buildOpenSurfaceResult({
      section: cleanText(payload.targetSection) || proposal.target?.section,
      id: cleanText(payload.targetId) || proposal.target?.id,
      label: proposal.openLabel || proposal.target?.label || "Open workflow",
    });
  }

  return {
    status: "blocked",
    statusReason: proposal.blockedReason || "This next step cannot be created safely from Copilot yet.",
  };
}

async function executeOpenExistingSurface(_supabase, options = {}) {
  const proposal = options.proposal || {};
  return buildOpenSurfaceResult(proposal.target);
}

export async function listCopilotProposalStates(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  if (!agentId || !ownerUserId) {
    return {
      records: [],
      persistenceAvailable: true,
    };
  }

  const { data, error } = await supabase
    .from(COPILOT_PROPOSAL_STATE_TABLE)
    .select(PROPOSAL_STATE_SELECT)
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, COPILOT_PROPOSAL_STATE_TABLE)) {
      return {
        records: [],
        persistenceAvailable: false,
      };
    }

    throw error;
  }

  return {
    records: normalizeArray(data).map(mapProposalStateRow),
    persistenceAvailable: true,
  };
}

export function hydrateTodayCopilotProposals(copilot = {}) {
  const stateLookup = new Map(
    normalizeArray(copilot.proposalStates).map((record) => [cleanText(record.proposalKey), record])
  );
  const proposals = normalizeArray(copilot.recommendations)
    .map((entry) => normalizeProposalCandidate(entry, "recommendation"))
    .concat(normalizeArray(copilot.drafts).map((entry) => normalizeProposalCandidate(entry, "draft")))
    .filter(Boolean)
    .map((candidate) => {
      const storedState = stateLookup.get(candidate.key) || null;
      const { state, stateReason } = resolveProposalState(candidate, storedState);
      return {
        ...candidate,
        state,
        stateReason,
        result: storedState
          ? {
            type: cleanText(storedState.resultType),
            id: cleanText(storedState.resultId),
            section: cleanText(storedState.resultSection),
          }
          : null,
      };
    })
    .sort((left, right) => {
      const rankDelta = getProposalSortRank(left) - getProposalSortRank(right);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return left.title.localeCompare(right.title);
    });
  const visibleProposals = proposals.filter((proposal) => ACTIVE_PROPOSAL_STATES.has(proposal.state));

  return {
    ...copilot,
    proposals: visibleProposals,
    proposalSummary: countByState(proposals),
  };
}

export function findTodayCopilotProposal(copilot = {}, proposalKey = "") {
  return normalizeArray(copilot.proposals).find((proposal) => cleanText(proposal.key) === cleanText(proposalKey)) || null;
}

export async function dismissTodayCopilotProposal(supabase, options = {}) {
  const proposal = options.proposal || {};
  const saved = await persistProposalState(supabase, {
    agentId: cleanText(options.agentId),
    businessId: cleanText(options.businessId),
    ownerUserId: cleanText(options.ownerUserId),
    proposalKey: cleanText(proposal.key),
    proposalType: cleanText(proposal.type),
    status: "dismissed",
    proposalHash: cleanText(proposal.hash),
    statusReason: "Dismissed by owner from Today.",
  });

  return {
    ok: true,
    state: saved.record || {
      proposalKey: cleanText(proposal.key),
      proposalType: cleanText(proposal.type),
      status: "dismissed",
    },
    persistenceAvailable: saved.persistenceAvailable !== false,
  };
}

export async function applyTodayCopilotProposal(supabase, options = {}) {
  const proposal = options.proposal || {};
  let execution = null;

  try {
    switch (cleanText(proposal.type)) {
      case "create_follow_up_draft":
        execution = await executeCreateFollowUpDraft(supabase, options);
        break;
      case "create_operator_task":
        execution = await executeCreateOperatorTask(supabase, options);
        break;
      case "create_outcome_review":
        execution = await executeCreateOutcomeReview(supabase, options);
        break;
      case "create_contact_next_step":
        execution = await executeCreateContactNextStep(supabase, options);
        break;
      case "open_existing_surface":
        execution = await executeOpenExistingSurface(supabase, options);
        break;
      default: {
        const error = new Error("Unsupported Copilot proposal type.");
        error.statusCode = 400;
        throw error;
      }
    }
  } catch (error) {
    execution = {
      status: "blocked",
      statusReason: cleanText(error?.message) || "Copilot could not apply this proposal safely.",
    };
  }

  const nextStatus = cleanText(execution?.status) || "blocked";
  const saved = await persistProposalState(supabase, {
    agentId: cleanText(options.agent?.id || options.agentId),
    businessId: cleanText(options.agent?.businessId || options.businessId),
    ownerUserId: cleanText(options.ownerUserId),
    proposalKey: cleanText(proposal.key),
    proposalType: cleanText(proposal.type),
    status: nextStatus,
    proposalHash: cleanText(proposal.hash),
    statusReason: cleanText(execution?.statusReason),
    resultType: cleanText(execution?.resultType),
    resultId: cleanText(execution?.resultId),
    resultSection: cleanText(execution?.resultSection),
  });

  return {
    ok: nextStatus === "applied",
    proposal: {
      key: cleanText(proposal.key),
      type: cleanText(proposal.type),
      state: nextStatus,
      stateReason: cleanText(execution?.statusReason),
      target: cleanTarget(execution?.target || proposal.target),
    },
    result: {
      type: cleanText(execution?.resultType),
      id: cleanText(execution?.resultId),
      section: cleanText(execution?.resultSection),
    },
    persistenceAvailable: saved.persistenceAvailable !== false,
    execution,
  };
}
