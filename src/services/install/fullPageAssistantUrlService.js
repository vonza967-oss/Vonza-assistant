import { cleanText } from "../../utils/text.js";

export function buildFullPageAssistantUrl(agent = {}, publicAppUrl = "") {
  const baseUrl = cleanText(publicAppUrl).replace(/\/$/, "");

  if (!baseUrl) {
    const error = new Error("PUBLIC_APP_URL is required to build a full-page assistant URL.");
    error.statusCode = 500;
    throw error;
  }

  const agentSlug = cleanText(agent.publicAgentKey || agent.agentSlug || agent.slug);
  if (agentSlug) {
    const url = new URL(`/a/${encodeURIComponent(agentSlug)}`, baseUrl);
    const publicPageKey = cleanText(agent.fullPageConfig?.publicPageKey || agent.full_page_config?.public_page_key);
    if (publicPageKey) {
      url.searchParams.set("k", publicPageKey);
    }
    return url.toString();
  }

  const url = new URL("/widget", baseUrl);
  const agentId = cleanText(agent.id || agent.agentId);
  if (agentId) {
    url.searchParams.set("agent_id", agentId);
  }
  url.searchParams.set("mode", "page");
  const publicPageKey = cleanText(agent.fullPageConfig?.publicPageKey || agent.full_page_config?.public_page_key);
  if (publicPageKey) {
    url.searchParams.set("k", publicPageKey);
  }
  return url.toString();
}
