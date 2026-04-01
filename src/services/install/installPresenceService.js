import { getPublicAppUrl } from "../../config/env.js";
import { cleanText } from "../../utils/text.js";

const AGENT_INSTALLATIONS_TABLE = "agent_installations";

function isMissingRelationError(error, relationName) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(`'public.${relationName}'`) ||
    message.includes(`${relationName} was not found`)
  );
}

function parsePageUrl(value) {
  const normalizedValue = cleanText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue);
  } catch {
    return null;
  }
}

function getAppHost() {
  try {
    return new URL(getPublicAppUrl()).host.toLowerCase();
  } catch {
    return "";
  }
}

function classifyHost(host) {
  const normalizedHost = cleanText(host).toLowerCase();
  const hostWithoutPort = normalizedHost.split(":")[0];
  const appHost = getAppHost();
  const appHostWithoutPort = appHost.split(":")[0];

  if (!normalizedHost) {
    return "unknown";
  }

  if (
    normalizedHost === appHost ||
    hostWithoutPort === appHostWithoutPort ||
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort === "0.0.0.0" ||
    hostWithoutPort.endsWith(".local")
  ) {
    return "test";
  }

  return "live";
}

function buildInstallStatus(rows = []) {
  if (!rows.length) {
    return {
      state: "not_detected",
      label: "Not detected on a live site yet",
      host: "",
      pageUrl: null,
      lastSeenAt: null,
    };
  }

  const sortedRows = [...rows].sort((left, right) => {
    return new Date(right.last_seen_at || 0).getTime() - new Date(left.last_seen_at || 0).getTime();
  });

  const liveRows = sortedRows.filter((row) => classifyHost(row.host) === "live");
  const testRows = sortedRows.filter((row) => classifyHost(row.host) === "test");

  if (liveRows.length) {
    const latestLiveRow = liveRows[0];
    return {
      state: "live",
      label: `Live on ${latestLiveRow.host}`,
      host: latestLiveRow.host,
      pageUrl: latestLiveRow.page_url || null,
      lastSeenAt: latestLiveRow.last_seen_at || null,
    };
  }

  if (testRows.length) {
    const latestTestRow = testRows[0];
    return {
      state: "test",
      label: "Seen on a test site",
      host: latestTestRow.host,
      pageUrl: latestTestRow.page_url || null,
      lastSeenAt: latestTestRow.last_seen_at || null,
    };
  }

  return {
    state: "not_detected",
    label: "Not detected on a live site yet",
    host: "",
    pageUrl: null,
    lastSeenAt: null,
  };
}

export async function recordInstallPresence(supabase, { agentId, pageUrl }) {
  const parsedPageUrl = parsePageUrl(pageUrl);
  const normalizedAgentId = cleanText(agentId);

  if (!normalizedAgentId || !parsedPageUrl) {
    return { ok: false, skipped: true };
  }

  const host = cleanText(parsedPageUrl.host).toLowerCase();
  const normalizedPageUrl = parsedPageUrl.toString();
  const timestamp = new Date().toISOString();

  const { data: existingRow, error: lookupError } = await supabase
    .from(AGENT_INSTALLATIONS_TABLE)
    .select("id, first_seen_at")
    .eq("agent_id", normalizedAgentId)
    .eq("host", host)
    .maybeSingle();

  if (lookupError) {
    if (isMissingRelationError(lookupError, AGENT_INSTALLATIONS_TABLE)) {
      return { ok: false, skipped: true };
    }

    console.error(lookupError);
    throw lookupError;
  }

  if (existingRow?.id) {
    const { error: updateError } = await supabase
      .from(AGENT_INSTALLATIONS_TABLE)
      .update({
        page_url: normalizedPageUrl,
        last_seen_at: timestamp,
      })
      .eq("id", existingRow.id);

    if (updateError) {
      console.error(updateError);
      throw updateError;
    }

    return { ok: true, host, state: classifyHost(host) };
  }

  const { error: insertError } = await supabase
    .from(AGENT_INSTALLATIONS_TABLE)
    .insert({
      agent_id: normalizedAgentId,
      host,
      page_url: normalizedPageUrl,
      first_seen_at: timestamp,
      last_seen_at: timestamp,
    });

  if (insertError) {
    if (isMissingRelationError(insertError, AGENT_INSTALLATIONS_TABLE)) {
      return { ok: false, skipped: true };
    }

    console.error(insertError);
    throw insertError;
  }

  return { ok: true, host, state: classifyHost(host) };
}

export async function listInstallStatusByAgentIds(supabase, agentIds = []) {
  if (!agentIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from(AGENT_INSTALLATIONS_TABLE)
    .select("agent_id, host, page_url, first_seen_at, last_seen_at")
    .in("agent_id", agentIds);

  if (error) {
    if (isMissingRelationError(error, AGENT_INSTALLATIONS_TABLE)) {
      return new Map();
    }

    console.error(error);
    throw error;
  }

  const rowsByAgentId = new Map();

  (data || []).forEach((row) => {
    const existingRows = rowsByAgentId.get(row.agent_id) || [];
    existingRows.push(row);
    rowsByAgentId.set(row.agent_id, existingRows);
  });

  return new Map(
    agentIds.map((agentId) => [agentId, buildInstallStatus(rowsByAgentId.get(agentId) || [])])
  );
}
