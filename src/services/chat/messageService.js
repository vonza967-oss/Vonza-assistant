import { MESSAGES_TABLE } from "../../config/constants.js";
import { cleanText } from "../../utils/text.js";
import { normalizeVisitorIdentity } from "./visitorIdentityService.js";

function isMissingMessagesSchemaError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.code === "42P01" ||
    message.includes(`'public.${MESSAGES_TABLE}'`) ||
    message.includes(`${MESSAGES_TABLE} was not found`) ||
    message.includes("session_key")
  );
}

function isMissingDisplayModeColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("display_mode")
  );
}

function normalizeDisplayMode(value) {
  return cleanText(value).toLowerCase() === "page" ? "page" : "widget";
}

function normalizeStoredDisplayMode(value) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized === "page" || normalized === "widget") {
    return normalized;
  }

  return "";
}

function buildMissingMessagesSchemaError(phase = "request") {
  const error = new Error(
    `[${phase}] Missing required message persistence schema for '${MESSAGES_TABLE}'. Apply the latest database migration before running this build.`
  );
  error.statusCode = 500;
  error.code = "schema_not_ready";
  return error;
}

export async function assertMessagesSchemaReady(supabase, options = {}) {
  const { error } = await supabase
    .from(MESSAGES_TABLE)
    .select("id, agent_id, role, content, session_key, visitor_identity_mode, visitor_email, visitor_name, created_at")
    .limit(1);

  if (error) {
    if (isMissingMessagesSchemaError(error)) {
      throw buildMissingMessagesSchemaError(options.phase || "startup");
    }

    throw error;
  }
}

export async function storeAgentMessages(supabase, agentId, entries = [], options = {}) {
  const normalizedAgentId = cleanText(agentId);
  const normalizedSessionKey = cleanText(options.sessionKey);
  const visitorIdentity = normalizeVisitorIdentity(options.visitorIdentity || {});
  const displayMode = normalizeDisplayMode(options.displayMode || options.display_mode);
  const seenEntries = new Set();
  const payload = entries
    .map((entry) => ({
      agent_id: normalizedAgentId,
      role: cleanText(entry.role),
      content: cleanText(entry.content),
      session_key: cleanText(entry.sessionKey || normalizedSessionKey) || null,
      visitor_identity_mode: visitorIdentity.mode || null,
      visitor_email: visitorIdentity.email || null,
      visitor_name: visitorIdentity.name || null,
      display_mode: normalizeDisplayMode(entry.displayMode || entry.display_mode || displayMode),
      created_at: entry.createdAt || entry.created_at || new Date().toISOString(),
    }))
    .filter((entry) => {
      if (!normalizedAgentId || !entry.role || !entry.content) {
        return false;
      }

      const dedupeKey = `${entry.role}::${entry.content}::${entry.session_key || ""}`;

      if (seenEntries.has(dedupeKey)) {
        return false;
      }

      seenEntries.add(dedupeKey);
      return true;
    });

  if (!payload.length) {
    return;
  }

  let { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .insert(payload)
    .select("id, agent_id, role, content, session_key, visitor_identity_mode, visitor_email, visitor_name, display_mode, created_at");

  if (error && isMissingDisplayModeColumnError(error)) {
    ({ data, error } = await supabase
      .from(MESSAGES_TABLE)
      .insert(payload.map(({ display_mode: _displayMode, ...entry }) => entry))
      .select("id, agent_id, role, content, session_key, visitor_identity_mode, visitor_email, visitor_name, created_at"));
  }

  if (error) {
    if (isMissingMessagesSchemaError(error)) {
      throw buildMissingMessagesSchemaError(options.phase || "request");
    }

    console.error(error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    role: row.role,
    content: row.content,
    sessionKey: row.session_key || null,
    visitorIdentityMode: row.visitor_identity_mode || null,
    visitorEmail: row.visitor_email || null,
    visitorName: row.visitor_name || null,
    displayMode: normalizeStoredDisplayMode(row.display_mode),
    createdAt: row.created_at,
  }));
}

export async function listAgentMessages(supabase, agentId, options = {}) {
  const normalizedAgentId = cleanText(agentId);

  if (!normalizedAgentId) {
    const error = new Error("agent_id is required");
    error.statusCode = 400;
    throw error;
  }

  let { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("id, agent_id, role, content, session_key, visitor_identity_mode, visitor_email, visitor_name, display_mode, created_at")
    .eq("agent_id", normalizedAgentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error && isMissingDisplayModeColumnError(error)) {
    ({ data, error } = await supabase
      .from(MESSAGES_TABLE)
      .select("id, agent_id, role, content, session_key, visitor_identity_mode, visitor_email, visitor_name, created_at")
      .eq("agent_id", normalizedAgentId)
      .order("created_at", { ascending: false })
      .limit(50));
  }

  if (error) {
    if (isMissingMessagesSchemaError(error)) {
      throw buildMissingMessagesSchemaError(options.phase || "request");
    }

    console.error(error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    role: row.role,
    content: row.content,
    sessionKey: row.session_key || null,
    visitorIdentityMode: row.visitor_identity_mode || null,
    visitorEmail: row.visitor_email || null,
    visitorName: row.visitor_name || null,
    displayMode: normalizeStoredDisplayMode(row.display_mode),
    createdAt: row.created_at,
  }));
}

export async function getAgentMessageStats(supabase, agentIds = []) {
  const normalizedAgentIds = agentIds.map((agentId) => cleanText(agentId)).filter(Boolean);

  if (!normalizedAgentIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("agent_id, created_at")
    .in("agent_id", normalizedAgentIds)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingMessagesSchemaError(error)) {
      throw buildMissingMessagesSchemaError("request");
    }

    console.error(error);
    throw error;
  }

  const stats = new Map();

  for (const row of data || []) {
    const agentId = row.agent_id;
    const existing = stats.get(agentId);

    if (!existing) {
      stats.set(agentId, {
        messageCount: 1,
        lastMessageAt: row.created_at || null,
      });
      continue;
    }

    existing.messageCount += 1;
  }

  return stats;
}
