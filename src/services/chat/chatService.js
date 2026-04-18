import { resolveAgentContext } from "../agents/agentService.js";
import {
  requireAllowedInstallOrigin,
} from "../install/installPresenceService.js";
import {
  getStoredWebsiteContent,
  hasVisualIntent,
  selectRelevantImageUrls,
} from "../scraping/websiteContentService.js";
import {
  buildBusinessContextForChat,
  buildBusinessReplyRepairPrompt,
  buildChatSystemPrompt,
  buildConversationGuidance,
  getReplyRepairIssues,
} from "./prompting.js";
import { generateAssistantReply } from "./assistantReplyService.js";
import {
  assertMessagesSchemaReady,
  storeAgentMessages,
} from "./messageService.js";
import {
  buildPublicVisitorIdentity,
  normalizeVisitorIdentity,
} from "./visitorIdentityService.js";
import {
  applyLeadCaptureAction,
  processLiveChatLeadCapture,
} from "../leads/liveLeadCaptureService.js";
import { evaluateLiveConversionRouting } from "../conversion/liveConversionRoutingService.js";
import { listRecentWidgetEvents } from "../analytics/widgetTelemetryService.js";
import {
  buildEffectiveUserText,
  cleanText,
  detectResponseLanguage,
  extractEmails,
  isPlaceholderEmail,
  sanitizeChatHistory,
} from "../../utils/text.js";

function hasLimitedKnowledge(websiteContent) {
  return (websiteContent?.content || "").includes(
    "Limited content available. This assistant may give general answers."
  );
}

function stripRawAssetUrls(reply = "") {
  return cleanText(
    String(reply || "")
      .replace(/https?:\/\/\S+\.(?:avif|gif|jpe?g|png|webp)(?:[?#]\S*)?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
  );
}

function appendImageLines(reply, websiteContent, userMessage) {
  if (!hasVisualIntent(userMessage)) {
    return reply;
  }

  const imageUrls = selectRelevantImageUrls(websiteContent, userMessage);

  if (!imageUrls.length) {
    return reply;
  }

  return `${reply}\n\nRelevant image links:\n${imageUrls.map((url) => `- ${url}`).join("\n")}`;
}

function buildLimitedKnowledgeReply(language, agentName, websiteContent) {
  const name = cleanText(agentName || websiteContent?.pageTitle || "This assistant");
  const rawMetaDescription = cleanText(websiteContent?.metaDescription || "");
  const metaDescription =
    rawMetaDescription === "Limited content available. This assistant may give general answers."
      ? ""
      : rawMetaDescription;
  const siteLabel = cleanText(
    websiteContent?.pageTitle ||
      websiteContent?.websiteUrl ||
      agentName ||
      "the business"
  );

  if (language === "Hungarian") {
    const summary = metaDescription
      ? `${name} kapcsán ennyi látszik biztosan a weboldalból: ${metaDescription}`
      : `${name} kapcsán nem látok elég részletes információt a weboldalból ehhez a kérdéshez.`;
    return `${summary} Ha szeretnéd, segítek leszűkíteni a következő lépést. Szolgáltatást keresel, árazás érdekel, vagy az a fontos, hogyan tudod felvenni velük a kapcsolatot?`;
  }

  const summary = metaDescription
      ? `The clearest detail I have about ${name} is: ${metaDescription}`
      : `I don't have enough detail to answer that confidently about ${name}.`;
  return `${summary} I can still help with the next step. Are you trying to understand their services, pricing, or how to contact ${siteLabel}?`;
}

async function resolveWidgetConversationContext(supabase, options = {}) {
  const installId = cleanText(options.installId);
  const pageUrl = cleanText(options.pageUrl);

  if (installId) {
    const installContext = await requireAllowedInstallOrigin(supabase, {
      installId,
      origin: options.origin,
      pageUrl,
    });

    return resolveAgentContext(supabase, {
      agentId: installContext.agent.id,
      businessId: installContext.business.id,
      websiteUrl: installContext.business.website_url,
      businessName: installContext.business.name,
    });
  }

  return resolveAgentContext(supabase, {
    agentId: options.agentId,
    agentKey: options.agentKey,
    businessId: options.businessId,
    websiteUrl: options.websiteUrl,
    businessName: options.businessName,
  });
}

function logChatMetadata(eventName, payload = {}) {
  console.info(`[chat] ${eventName}`, {
    agentId: cleanText(payload.agentId) || null,
    businessId: cleanText(payload.businessId) || null,
    installId: cleanText(payload.installId) || null,
    sessionKey: cleanText(payload.sessionKey) || null,
    originPresent: Boolean(cleanText(payload.origin)),
    pageUrlPresent: Boolean(cleanText(payload.pageUrl)),
    messageLength: Number(payload.messageLength || 0),
    historyCount: Number(payload.historyCount || 0),
    businessContextLength: Number(payload.businessContextLength || 0),
    replyLength: Number(payload.replyLength || 0),
    repairIssueCount: Number(payload.repairIssueCount || 0),
    leadCaptureState: cleanText(payload.leadCaptureState) || null,
    routingMode: cleanText(payload.routingMode) || null,
  });
}

function listTrustedReplyEmails({
  websiteContent = {},
  widgetConfig = {},
  userMessage = "",
  history = [],
  visitorIdentity = null,
} = {}) {
  const configuredEmail = cleanText(widgetConfig.contactEmail || widgetConfig.contact_email).toLowerCase();
  return new Set(
    [
      ...extractEmails(websiteContent.content || ""),
      ...extractEmails(userMessage),
      ...history.flatMap((entry) => extractEmails(entry?.content || "")),
      cleanText(visitorIdentity?.email).toLowerCase(),
      configuredEmail,
    ].filter((email) => email && !isPlaceholderEmail(email))
  );
}

function replyContainsUnsafePlaceholderEmail(reply = "", trustedEmails = new Set()) {
  return extractEmails(reply).some((email) => isPlaceholderEmail(email) && !trustedEmails.has(email));
}

function buildMissingVerifiedContactReply(language) {
  if (language === "Hungarian") {
    return "Nem látok megerősített elérhetőséget a weboldalból vagy a jelenlegi élő beállításból, ezért nem akarok kitalálni egy email címet vagy telefonszámot. Ha szeretnéd, segítek megfogalmazni, mit érdemes kérdezni, amint megvan a helyes kapcsolat. Miben szeretnél írni vagy telefonálni nekik?";
  }

  return "I don’t see a verified contact email or phone number from the website or the live setup, so I don’t want to guess. If you want, I can still help you figure out what to ask once the right contact route is confirmed. What are you trying to reach them about?";
}

async function buildChatResponse({
  supabase,
  agent,
  businessId,
  widgetConfig,
  userMessage,
  reply,
  sessionKey,
  leadCapture = null,
  directRouting = null,
  visitorIdentity = null,
  storeUserMessage = true,
  userMessageCreatedAt = null,
}) {
  const entries = [
    storeUserMessage ? { role: "user", content: userMessage, createdAt: userMessageCreatedAt || undefined } : null,
    { role: "assistant", content: reply },
  ].filter(Boolean);

  await storeAgentMessages(supabase, agent.id, entries, {
    sessionKey,
    visitorIdentity,
  });

  return {
    reply,
    agentId: agent.id,
    agentKey: agent.publicAgentKey,
    businessId,
    widgetConfig: {
      ...widgetConfig,
      assistantName: agent.name || widgetConfig.assistantName,
    },
    leadCapture,
    directRouting,
    visitorIdentity: buildPublicVisitorIdentity(visitorIdentity),
  };
}

export async function handleChatRequest({
  supabase,
  openai,
  body,
}) {
  const message = body.message;
  const agentId = body.agent_id || body.agentId;
  const agentKey = body.agent_key || body.agentKey;
  const businessId = body.business_id || body.businessId;
  const websiteUrl = cleanText(body.website_url || body.websiteUrl || "");
  const sessionKey = cleanText(body.visitor_session_key || body.visitorSessionKey || "");
  const installId = cleanText(body.install_id || body.installId || "");
  const pageUrl = cleanText(body.page_url || body.pageUrl || "");
  const origin = cleanText(body.origin || "");
  const history = sanitizeChatHistory(body.history);
  const visitorIdentity = normalizeVisitorIdentity({
    ...(body.visitor_identity || {}),
    visitor_mode: body.visitor_identity_mode || body.visitorMode || body.visitor_mode,
    visitor_email: body.visitor_email || body.visitorEmail,
    visitor_name: body.visitor_name || body.visitorName,
  });
  const effectiveUserText = buildEffectiveUserText(message || "", history);
  const normalizedMessage = cleanText(message || "");
  const language = detectResponseLanguage(normalizedMessage);
  const conversationGuidance = buildConversationGuidance(message, history);

  if (!message || !String(message).trim()) {
    const error = new Error("Message cannot be empty.");
    error.statusCode = 400;
    throw error;
  }

  if (!installId && !agentId && !agentKey && !businessId) {
    const error = new Error(
      "install_id, agent_id, agent_key, or business_id is required."
    );
    error.statusCode = 400;
    throw error;
  }

  const { agent, business, widgetConfig } = await resolveWidgetConversationContext(supabase, {
    installId,
    agentId,
    agentKey,
    businessId,
    websiteUrl,
    origin,
    pageUrl,
    businessName: body.name,
  });

  const websiteContent = await getStoredWebsiteContent(supabase, business.id);
  await assertMessagesSchemaReady(supabase, { phase: "request" });

  if (!websiteContent) {
    const fallbackReply =
      language === "Hungarian"
        ? "Ehhez még nincs betöltött weboldal-tartalom, ezért nem tudok biztos választ adni a weboldal alapján. Kérlek próbáld újra később, vagy kérd meg az adminisztrátort, hogy futtassa a tartalom importálását."
        : "I don't have website content for this assistant yet, so I can't answer that from the site. Please try again later or ask an admin to run the content import.";

    return buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: message,
      reply: fallbackReply,
      sessionKey,
      visitorIdentity,
    });
  }

  if (hasLimitedKnowledge(websiteContent)) {
    return buildChatResponse({
      supabase,
      agent,
      businessId: websiteContent.businessId,
      widgetConfig,
      userMessage: message,
      reply: appendImageLines(
        buildLimitedKnowledgeReply(
          language,
          agent.name || widgetConfig.assistantName,
          websiteContent
        ),
        websiteContent,
        message
      ),
      sessionKey,
      visitorIdentity,
    });
  }

  const businessContext = buildBusinessContextForChat(
    websiteContent,
    effectiveUserText,
    {
      widgetConfig,
    }
  );
  logChatMetadata("request_prepared", {
    agentId: agent.id,
    businessId: business.id,
    installId,
    sessionKey,
    origin,
    pageUrl,
    messageLength: normalizedMessage.length,
    historyCount: history.length,
    businessContextLength: businessContext.length,
  });

  const systemPrompt = buildChatSystemPrompt(language, agent);
  const openaiClient = typeof openai === "function" ? openai() : openai;
  const trustedReplyEmails = listTrustedReplyEmails({
    websiteContent,
    widgetConfig,
    userMessage: message,
    history,
    visitorIdentity,
  });
  let finalReply = await generateAssistantReply({
    openai: openaiClient,
    userMessage: message,
    history,
    systemPrompt,
    referenceBlocks: [
      {
        label: "Business reference",
        content: businessContext,
      },
    ],
    conversationGuidance,
    model: "gpt-4o-mini",
    temperature: 0.85,
    presencePenalty: 0.3,
    frequencyPenalty: 0.35,
    postProcess: stripRawAssetUrls,
    repair: {
      getIssues: (reply) => {
        const issues = getReplyRepairIssues(reply, language);
        logChatMetadata("reply_repair_checked", {
          agentId: agent.id,
          businessId: business.id,
          installId,
          sessionKey,
          origin,
          pageUrl,
          messageLength: normalizedMessage.length,
          historyCount: history.length,
          replyLength: cleanText(reply).length,
          repairIssueCount: issues.length,
        });
        return issues;
      },
      buildRewritePrompt: () => buildBusinessReplyRepairPrompt(language),
      temperature: 0.5,
    },
  });

  if (replyContainsUnsafePlaceholderEmail(finalReply, trustedReplyEmails)) {
    console.warn("[chat] Replacing placeholder contact reply with grounded fallback.", {
      agentId: agent.id,
      installId,
      pageUrl,
    });
    finalReply = buildMissingVerifiedContactReply(language);
  }

  const userMessageCreatedAt = new Date().toISOString();
  const leadCapture = await processLiveChatLeadCapture(supabase, {
    agent,
    business,
    widgetConfig,
    sessionKey,
    installId,
    pageUrl,
    origin,
    userMessage: message,
    messageCreatedAt: userMessageCreatedAt,
    language,
    visitorIdentity,
  });
  const recentWidgetEvents = await listRecentWidgetEvents(supabase, {
    agentId: agent.id,
    installId: installId || widgetConfig.installId,
    sessionId: sessionKey,
  });
  const directRouting = evaluateLiveConversionRouting({
    widgetConfig,
    userMessage: message,
    sessionKey,
    leadCapture,
    recentWidgetEvents,
  });

  console.info("[live routing] Evaluated direct conversion routing.", {
    agentId: agent.id,
    sessionKey,
    mode: directRouting?.mode || "chat_only",
    intentType: directRouting?.intentType || "",
    ctaType: directRouting?.primaryCta?.ctaType || "",
    suppressReason: directRouting?.suppressReason || "",
  });
  logChatMetadata("response_ready", {
    agentId: agent.id,
    businessId: websiteContent.businessId,
    installId,
    sessionKey,
    origin,
    pageUrl,
    messageLength: normalizedMessage.length,
    historyCount: history.length,
    replyLength: finalReply.length,
    leadCaptureState: leadCapture?.state,
    routingMode: directRouting?.mode,
  });

  return buildChatResponse({
    supabase,
    agent,
    businessId: websiteContent.businessId,
    widgetConfig,
    userMessage: message,
    reply: appendImageLines(finalReply, websiteContent, message),
    sessionKey,
    leadCapture,
    directRouting,
    visitorIdentity,
    userMessageCreatedAt,
  });
}

export async function handleLeadCaptureRequest({
  supabase,
  body,
}) {
  const agentId = body.agent_id || body.agentId;
  const agentKey = body.agent_key || body.agentKey;
  const businessId = body.business_id || body.businessId;
  const websiteUrl = cleanText(body.website_url || body.websiteUrl || "");
  const sessionKey = cleanText(body.visitor_session_key || body.visitorSessionKey || "");
  const installId = cleanText(body.install_id || body.installId || "");
  const pageUrl = cleanText(body.page_url || body.pageUrl || "");
  const origin = cleanText(body.origin || "");
  const action = cleanText(body.action).toLowerCase();
  const referenceMessage = cleanText(body.reference_message || body.referenceMessage || "");
  const language = detectResponseLanguage(referenceMessage);
  const visitorIdentity = normalizeVisitorIdentity({
    ...(body.visitor_identity || {}),
    visitor_mode: body.visitor_identity_mode || body.visitorMode || body.visitor_mode,
    visitor_email: body.visitor_email || body.visitorEmail,
    visitor_name: body.visitor_name || body.visitorName,
  });

  if (!installId && !agentKey && !businessId && !agentId) {
    const error = new Error("install_id, agent_id, agent_key, or business_id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!action) {
    const error = new Error("action is required.");
    error.statusCode = 400;
    throw error;
  }

  const { agent, business, widgetConfig } = await resolveWidgetConversationContext(supabase, {
    installId,
    agentId,
    agentKey,
    businessId,
    websiteUrl,
    origin,
    pageUrl,
    businessName: body.name,
  });

  const leadCapture = await applyLeadCaptureAction(supabase, {
    agent,
    business,
    widgetConfig,
    action,
    sessionKey,
    installId,
    pageUrl,
    origin,
    language,
    userMessage: referenceMessage,
    name: body.name,
    email: body.email,
    phone: body.phone,
    preferredChannel: body.preferred_channel || body.preferredChannel,
    visitorIdentity,
  });

  return {
    ok: true,
    agentId: agent.id,
    agentKey: agent.publicAgentKey,
    businessId: business.id,
    leadCapture,
    visitorIdentity: buildPublicVisitorIdentity(visitorIdentity),
  };
}
