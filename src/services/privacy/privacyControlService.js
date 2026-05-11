import {
  ACTION_QUEUE_STATUS_TABLE,
  FOLLOW_UP_WORKFLOW_TABLE,
  HUMAN_FOLLOW_UP_STATUS_TABLE,
  KNOWLEDGE_FIX_WORKFLOW_TABLE,
  LEAD_CAPTURE_TABLE,
  MESSAGES_TABLE,
  OPERATOR_CONTACT_TABLE,
  OWNER_NOTIFICATION_TABLE,
  PRIVACY_SETTINGS_TABLE,
  VISITOR_REPLY_FEEDBACK_TABLE,
} from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";

const PRIVACY_SETTINGS_SELECT =
  "id, agent_id, owner_user_id, retention_days, delete_unidentified_visitors_after_days, policy_note, widget_identity_guidance, created_at, updated_at";

function normalizePositiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function isPersistenceUnavailable(error, tableName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes(tableName)
  );
}

function normalizeSettings(row = {}) {
  return {
    id: cleanText(row.id),
    agentId: cleanText(row.agentId || row.agent_id),
    ownerUserId: cleanText(row.ownerUserId || row.owner_user_id),
    retentionDays: normalizePositiveInteger(row.retentionDays || row.retention_days, 365),
    deleteUnidentifiedVisitorsAfterDays: normalizePositiveInteger(
      row.deleteUnidentifiedVisitorsAfterDays || row.delete_unidentified_visitors_after_days,
      90
    ),
    policyNote: cleanText(row.policyNote || row.policy_note) || "Vonza stores customer conversations and leads so the owner can answer, improve knowledge, and audit important customer moments.",
    widgetIdentityGuidance: cleanText(row.widgetIdentityGuidance || row.widget_identity_guidance)
      || "To disconnect a visitor identity, clear the visitor email/name in the host site and remove local widget identity storage for that browser. Guest sessions remain safe labels unless the visitor shares contact details.",
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

function toCsvCell(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows = []) {
  if (!rows.length) {
    return "type,id,created_at,customer,content,status\n";
  }

  const header = ["type", "id", "created_at", "customer", "content", "status"];
  const lines = rows.map((row) => header.map((key) => toCsvCell(row[key])).join(","));
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function mapMessageExport(row = {}) {
  return {
    id: cleanText(row.id),
    createdAt: row.created_at || null,
    role: cleanText(row.role),
    content: cleanText(row.content),
    sessionKey: cleanText(row.session_key),
    visitorIdentityMode: cleanText(row.visitor_identity_mode),
    visitorEmail: cleanText(row.visitor_email).toLowerCase(),
    visitorName: cleanText(row.visitor_name),
  };
}

function mapLeadExport(row = {}) {
  return {
    id: cleanText(row.id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    state: cleanText(row.capture_state),
    preferredChannel: cleanText(row.preferred_channel),
    contactName: cleanText(row.contact_name),
    contactEmail: cleanText(row.contact_email).toLowerCase(),
    contactPhone: cleanText(row.contact_phone),
    visitorSessionKey: cleanText(row.visitor_session_key),
    latestIntentType: cleanText(row.latest_intent_type),
    latestActionType: cleanText(row.latest_action_type),
    promptedAt: row.prompted_at || null,
    capturedAt: row.captured_at || null,
  };
}

function mapFollowUpExport(row = {}) {
  return {
    id: cleanText(row.id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    status: cleanText(row.status),
    channel: cleanText(row.channel),
    personKey: cleanText(row.person_key),
    contactName: cleanText(row.contact_name),
    contactEmail: cleanText(row.contact_email).toLowerCase(),
    contactPhone: cleanText(row.contact_phone),
    subject: cleanText(row.subject),
    draftContent: cleanText(row.draft_content),
    sentAt: row.sent_at || null,
    dismissedAt: row.dismissed_at || null,
  };
}

function mapKnowledgeFixExport(row = {}) {
  const evidence = row.evidence && typeof row.evidence === "object" ? row.evidence : {};

  return {
    id: cleanText(row.id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    status: cleanText(row.status),
    topic: cleanText(row.topic),
    issueSummary: cleanText(row.issue_summary),
    mattersSummary: cleanText(row.matters_summary),
    proposedGuidance: cleanText(row.proposed_guidance),
    occurrenceCount: Number(row.occurrence_count || 0) || 0,
    evidence: {
      question: cleanText(evidence.question),
      currentResponse: cleanText(evidence.currentResponse),
      knowledgeState: cleanText(evidence.knowledgeState),
      lastSeenAt: evidence.lastSeenAt || null,
    },
    appliedAt: row.applied_at || null,
    dismissedAt: row.dismissed_at || null,
  };
}

function mapActionStatusExport(row = {}) {
  return {
    id: cleanText(row.id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    actionKey: cleanText(row.action_key),
    status: cleanText(row.status),
    outcome: cleanText(row.outcome),
    nextStep: cleanText(row.next_step),
    followUpNeeded: row.follow_up_needed === true,
    followUpCompleted: row.follow_up_completed === true,
    contactStatus: cleanText(row.contact_status),
  };
}

async function selectRows(supabase, tableName, filters = []) {
  let query = supabase.from(tableName).select("*");
  filters.forEach(([column, value]) => {
    if (cleanText(value)) {
      query = query.eq(column, value);
    }
  });

  const { data, error } = await query;

  if (error) {
    if (isPersistenceUnavailable(error, tableName)) {
      return [];
    }

    throw error;
  }

  return data || [];
}

async function deleteRows(supabase, tableName, filters = []) {
  const activeFilters = filters.filter(([, value]) => cleanText(value));

  if (!activeFilters.length) {
    return 0;
  }

  let query = supabase.from(tableName).delete();
  activeFilters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { data, error, count } = await query.select("*");

  if (error) {
    if (isPersistenceUnavailable(error, tableName)) {
      return 0;
    }

    throw error;
  }

  return Number(count || (Array.isArray(data) ? data.length : 0));
}

export async function getPrivacySettings(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);

  const { data, error } = await supabase
    .from(PRIVACY_SETTINGS_TABLE)
    .select(PRIVACY_SETTINGS_SELECT)
    .eq("agent_id", agentId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    if (isPersistenceUnavailable(error, PRIVACY_SETTINGS_TABLE)) {
      return {
        settings: normalizeSettings({ agent_id: agentId, owner_user_id: ownerUserId }),
        persistenceAvailable: false,
      };
    }

    throw error;
  }

  return {
    settings: normalizeSettings(data || { agent_id: agentId, owner_user_id: ownerUserId }),
    persistenceAvailable: true,
  };
}

export async function savePrivacySettings(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const retentionDays = normalizePositiveInteger(options.retentionDays, 365);
  const unidentifiedDays = normalizePositiveInteger(options.deleteUnidentifiedVisitorsAfterDays, 90);
  const now = new Date().toISOString();

  if (!agentId || !ownerUserId) {
    const error = new Error("agent_id and owner_user_id are required.");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(PRIVACY_SETTINGS_TABLE)
    .upsert({
      agent_id: agentId,
      owner_user_id: ownerUserId,
      retention_days: retentionDays,
      delete_unidentified_visitors_after_days: unidentifiedDays,
      policy_note: cleanText(options.policyNote) || null,
      widget_identity_guidance: cleanText(options.widgetIdentityGuidance) || null,
      updated_at: now,
    }, { onConflict: "agent_id,owner_user_id" })
    .select(PRIVACY_SETTINGS_SELECT)
    .single();

  if (error) {
    if (isPersistenceUnavailable(error, PRIVACY_SETTINGS_TABLE)) {
      const unavailable = new Error("Privacy settings are not ready on this workspace yet.");
      unavailable.statusCode = 503;
      unavailable.code = "privacy_settings_unavailable";
      throw unavailable;
    }

    throw error;
  }

  return {
    ok: true,
    settings: normalizeSettings(data),
  };
}

export async function exportAgentPrivacyData(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const format = cleanText(options.format).toLowerCase() === "csv" ? "csv" : "json";

  if (!agentId || !ownerUserId) {
    const error = new Error("agent_id and owner_user_id are required.");
    error.statusCode = 400;
    throw error;
  }

  const [messages, leads, followUps, knowledgeFixes, actionStatuses] = await Promise.all([
    selectRows(supabase, MESSAGES_TABLE, [["agent_id", agentId]]),
    selectRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId]]),
    selectRows(supabase, FOLLOW_UP_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId]]),
    selectRows(supabase, KNOWLEDGE_FIX_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId]]),
    selectRows(supabase, ACTION_QUEUE_STATUS_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId]]),
  ]);

  if (format === "csv") {
    const rows = [
      ...messages.map((message) => ({
        type: "message",
        id: message.id,
        created_at: message.created_at,
        customer: message.visitor_email || message.visitor_name || message.session_key || "",
        content: message.content,
        status: message.role,
      })),
      ...leads.map((lead) => ({
        type: "lead",
        id: lead.id,
        created_at: lead.created_at,
        customer: lead.contact_email || lead.contact_name || lead.visitor_session_key || "",
        content: lead.latest_intent_type || lead.source_page_url || "",
        status: lead.capture_state,
      })),
      ...followUps.map((followUp) => ({
        type: "follow_up",
        id: followUp.id,
        created_at: followUp.created_at,
        customer: followUp.contact_email || followUp.contact_name || followUp.person_key || "",
        content: followUp.subject || followUp.topic || "",
        status: followUp.status,
      })),
    ];

    return {
      format,
      filename: `vonza-agent-${agentId}-privacy-export.csv`,
      contentType: "text/csv; charset=utf-8",
      body: rowsToCsv(rows),
      counts: {
        messages: messages.length,
        leads: leads.length,
        followUps: followUps.length,
        knowledgeFixes: knowledgeFixes.length,
        actionStatuses: actionStatuses.length,
      },
    };
  }

  return {
    format,
    filename: `vonza-agent-${agentId}-privacy-export.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      agentId,
      guidance: "This export is owner-scoped and excludes billing, auth, and account records.",
      messages: messages.map(mapMessageExport),
      leads: leads.map(mapLeadExport),
      followUps: followUps.map(mapFollowUpExport),
      knowledgeFixes: knowledgeFixes.map(mapKnowledgeFixExport),
      actionStatuses: actionStatuses.map(mapActionStatusExport),
    }, null, 2),
    counts: {
      messages: messages.length,
      leads: leads.length,
      followUps: followUps.length,
      knowledgeFixes: knowledgeFixes.length,
      actionStatuses: actionStatuses.length,
    },
  };
}

export async function deleteVisitorOrCustomerRecords(supabase, options = {}) {
  const agentId = cleanText(options.agentId);
  const ownerUserId = cleanText(options.ownerUserId);
  const contactId = cleanText(options.contactId);
  const sessionKey = cleanText(options.sessionKey);
  const visitorEmail = cleanText(options.visitorEmail).toLowerCase();
  const personKey = cleanText(options.personKey);
  const leadId = cleanText(options.leadId);
  const actionKey = cleanText(options.actionKey);

  if (!agentId || !ownerUserId) {
    const error = new Error("agent_id and owner_user_id are required.");
    error.statusCode = 400;
    throw error;
  }

  if (!contactId && !sessionKey && !visitorEmail && !personKey && !leadId && !actionKey) {
    const error = new Error("Provide a contact, session, visitor email, person, lead, or action key to delete.");
    error.statusCode = 400;
    throw error;
  }

  const deleted = {
    messages: 0,
    leads: 0,
    followUps: 0,
    knowledgeFixes: 0,
    actionStatuses: 0,
    humanFollowUps: 0,
    notifications: 0,
    feedback: 0,
    contacts: 0,
  };

  if (sessionKey) {
    deleted.messages += await deleteRows(supabase, MESSAGES_TABLE, [["agent_id", agentId], ["session_key", sessionKey]]);
    deleted.feedback += await deleteRows(supabase, VISITOR_REPLY_FEEDBACK_TABLE, [["agent_id", agentId], ["session_key", sessionKey]]);
    deleted.leads += await deleteRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["visitor_session_key", sessionKey]]);
  }

  if (visitorEmail) {
    deleted.messages += await deleteRows(supabase, MESSAGES_TABLE, [["agent_id", agentId], ["visitor_email", visitorEmail]]);
    deleted.leads += await deleteRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["contact_email", visitorEmail]]);
    deleted.followUps += await deleteRows(supabase, FOLLOW_UP_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["contact_email", visitorEmail]]);
  }

  if (personKey) {
    deleted.leads += await deleteRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["person_key", personKey]]);
    deleted.followUps += await deleteRows(supabase, FOLLOW_UP_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["person_key", personKey]]);
  }

  if (contactId) {
    deleted.leads += await deleteRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["contact_id", contactId]]);
    deleted.followUps += await deleteRows(supabase, FOLLOW_UP_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["contact_id", contactId]]);
    deleted.contacts += await deleteRows(supabase, OPERATOR_CONTACT_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["id", contactId]]);
  }

  if (leadId) {
    deleted.leads += await deleteRows(supabase, LEAD_CAPTURE_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["id", leadId]]);
  }

  if (actionKey) {
    deleted.actionStatuses += await deleteRows(supabase, ACTION_QUEUE_STATUS_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["action_key", actionKey]]);
    deleted.humanFollowUps += await deleteRows(supabase, HUMAN_FOLLOW_UP_STATUS_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["item_key", actionKey]]);
    deleted.notifications += await deleteRows(supabase, OWNER_NOTIFICATION_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["related_action_key", actionKey]]);
    deleted.knowledgeFixes += await deleteRows(supabase, KNOWLEDGE_FIX_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["source_action_key", actionKey]]);
    deleted.followUps += await deleteRows(supabase, FOLLOW_UP_WORKFLOW_TABLE, [["agent_id", agentId], ["owner_user_id", ownerUserId], ["source_action_key", actionKey]]);
  }

  return {
    ok: true,
    deleted,
    guidance: "Billing, account, and auth records were not deleted. Widget visitor identity should also be cleared in the visitor browser or host site identity layer when applicable.",
  };
}
