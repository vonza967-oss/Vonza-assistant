import { resolveAllowedPublicWidgetContext } from "../agents/agentService.js";
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
  buildRetrievedBusinessContextForChat,
  detectUserIntent,
  getFactualReplyGuardrailIssues,
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
import {
  getOwnerBillingSnapshot,
  recordEstimatedUsage,
} from "../billing/billingUsageService.js";
import { evaluateLiveConversionRouting } from "../conversion/liveConversionRoutingService.js";
import { listRecentWidgetEvents } from "../analytics/widgetTelemetryService.js";
import {
  buildApprovedAnswersPrompt,
  selectRelevantApprovedAnswers,
} from "../training/frontDeskTrainingService.js";
import {
  buildBusinessProfileKnowledgeText,
  retrieveSemanticKnowledge,
} from "../rag/frontDeskRagService.js";
import { getOperatorBusinessProfile } from "../operator/operatorBusinessProfileService.js";
import {
  buildEffectiveUserText,
  cleanText,
  detectResponseLanguage,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
  normalizeAssistantReply,
  sanitizeChatHistory,
  selectResponseLanguage,
} from "../../utils/text.js";

function hasLimitedKnowledge(websiteContent) {
  return (websiteContent?.content || "").includes(
    "Limited content available. This assistant may give general answers."
  );
}

function normalizePublicDisplayMode(value) {
  return cleanText(value).toLowerCase() === "page" ? "page" : "widget";
}

function stripRawAssetUrls(reply = "") {
  return normalizeAssistantReply(
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
  return resolveAllowedPublicWidgetContext(supabase, options);
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

function normalizePhoneDigits(value = "") {
  return cleanText(value).replace(/\D/g, "");
}

function extractContactUrls(value = "") {
  return [...new Set(
    (String(value || "").match(/https?:\/\/[^\s<>"')]+/gi) || [])
      .map((url) => {
        try {
          const parsed = new URL(url);
          parsed.hash = "";
          return parsed.toString();
        } catch {
          return "";
        }
      })
      .filter((url) => /(?:contact|book|booking|schedule|appointment|quote|inquiry|enquiry|kapcsolat|foglal)/i.test(url))
  )];
}

function extractTrustedEmails(value = "", { allowInternalPlatform = false } = {}) {
  return extractEmails(value).filter((email) =>
    !isPlaceholderEmail(email) &&
    (allowInternalPlatform || !isInternalPlatformEmail(email))
  );
}

function extractTrustedPhones(value = "") {
  return extractPhoneCandidates(value).filter((phone) => !isPlaceholderPhone(phone));
}

function listTrustedReplyEmails({
  websiteContent = {},
  widgetConfig = {},
  userMessage = "",
  history = [],
  visitorIdentity = null,
  approvedAnswers = [],
} = {}) {
  const configuredEmail = cleanText(widgetConfig.contactEmail || widgetConfig.contact_email).toLowerCase();
  return new Set(
    [
      ...extractTrustedEmails(websiteContent.content || ""),
      ...approvedAnswers.flatMap((item) => extractTrustedEmails(item.answerText || item.answer_text || "", {
        allowInternalPlatform: true,
      })),
      ...extractEmails(userMessage),
      ...history.flatMap((entry) => extractEmails(entry?.content || "")),
      cleanText(visitorIdentity?.email).toLowerCase(),
      configuredEmail,
    ].filter((email) => email && !isPlaceholderEmail(email))
  );
}

function replyContainsUnsafePlaceholderEmail(reply = "", trustedEmails = new Set()) {
  return extractEmails(reply).some((email) =>
    (isPlaceholderEmail(email) || isInternalPlatformEmail(email)) && !trustedEmails.has(email)
  );
}

function collectTrustedBusinessContactEvidence({
  widgetConfig = {},
  approvedAnswers = [],
  businessContext = "",
  retrievedBusinessContext = "",
} = {}) {
  const trustedEmails = new Set();
  const trustedPhones = new Set();
  const trustedUrls = new Set();
  const configuredEmail = cleanText(widgetConfig.contactEmail || widgetConfig.contact_email).toLowerCase();
  const configuredPhone = cleanText(widgetConfig.contactPhone || widgetConfig.contact_phone);

  if (configuredEmail && !isPlaceholderEmail(configuredEmail)) {
    trustedEmails.add(configuredEmail);
  }

  if (configuredPhone && !isPlaceholderPhone(configuredPhone)) {
    trustedPhones.add(normalizePhoneDigits(configuredPhone));
  }

  const approvedText = approvedAnswers
    .map((item) => [item.triggerText || item.trigger_text || item.title, item.answerText || item.answer_text].map(cleanText).join("\n"))
    .join("\n\n");

  extractTrustedEmails(approvedText, { allowInternalPlatform: true }).forEach((email) => trustedEmails.add(email));
  extractTrustedPhones(approvedText).forEach((phone) => trustedPhones.add(normalizePhoneDigits(phone)));
  extractContactUrls(approvedText).forEach((url) => trustedUrls.add(url));

  const contextText = [businessContext, retrievedBusinessContext].map(cleanText).filter(Boolean).join("\n\n");
  extractTrustedEmails(contextText).forEach((email) => trustedEmails.add(email));
  extractTrustedPhones(contextText).forEach((phone) => trustedPhones.add(normalizePhoneDigits(phone)));
  extractContactUrls(contextText).forEach((url) => trustedUrls.add(url));

  return {
    trustedEmails,
    trustedPhones,
    trustedUrls,
    hasApprovedContactGuidance: approvedAnswers.length > 0 && /contact|email|phone|call|reach|whatsapp|book|booking|quote|kapcsolat|telefon/i.test(approvedText),
    hasVerifiedContactDetail: trustedEmails.size > 0 || trustedPhones.size > 0 || trustedUrls.size > 0,
  };
}

function replyContainsUntrustedContactDetail(reply = "", evidence = {}) {
  const emails = extractEmails(reply);
  const phones = extractPhoneCandidates(reply);
  const urls = extractContactUrls(reply);

  return emails.some((email) => !evidence.trustedEmails?.has(email))
    || phones.some((phone) => {
      const digits = normalizePhoneDigits(phone);
      return digits && !evidence.trustedPhones?.has(digits);
    })
    || urls.some((url) => !evidence.trustedUrls?.has(url));
}

function buildMissingVerifiedContactReply(language) {
  if (language === "Hungarian") {
    return "I do not have a confirmed contact detail for this business here.\n\nYou can leave your details and the business can follow up.";
  }

  return "I do not have a confirmed contact detail for this business here.\n\nYou can leave your details and the business can follow up.";
}

function buildAiCapacityReachedReply(language) {
  if (language === "Hungarian") {
    return "Ebben a hónapban elértük az AI kapacitást. Ha szeretnéd, add meg az elérhetőségeidet, és a vállalkozás közvetlenül folytathatja innen.";
  }

  return "We've reached this month's AI capacity. If you'd like, please leave your details and the business can continue from here.";
}

function buildAiCapacityCapturePrompt(language) {
  if (language === "Hungarian") {
    return "Add meg a legjobb email címedet vagy telefonszámodat, és a vállalkozás innen tudja folytatni.";
  }

  return "Share your best email address or phone number and the business can continue from here.";
}

function buildCappedLeadCaptureFallback(leadCapture, language) {
  const normalizedLeadCapture = leadCapture && typeof leadCapture === "object"
    ? { ...leadCapture }
    : {};
  const currentState = cleanText(normalizedLeadCapture.state).toLowerCase();

  if (currentState === "captured") {
    return {
      ...normalizedLeadCapture,
      shouldPrompt: false,
      message: "",
    };
  }

  return {
    ...normalizedLeadCapture,
    state: currentState || "prompt_ready",
    shouldPrompt: true,
    prompt: {
      body: buildAiCapacityCapturePrompt(language),
    },
    reason: "ai_capacity_reached",
    trigger: "ai_capacity_reached",
    message: "",
  };
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
  displayMode = "widget",
  storeUserMessage = true,
  userMessageCreatedAt = null,
  storeMessages = storeAgentMessages,
}) {
  const entries = [
    storeUserMessage ? { role: "user", content: userMessage, createdAt: userMessageCreatedAt || undefined } : null,
    { role: "assistant", content: reply },
  ].filter(Boolean);

  await storeMessages(supabase, agent.id, entries, {
    sessionKey,
    visitorIdentity,
    displayMode,
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
}, deps = {}) {
  const resolveWidgetConversationContextImpl =
    deps.resolveWidgetConversationContext || resolveWidgetConversationContext;
  const getStoredWebsiteContentImpl = deps.getStoredWebsiteContent || getStoredWebsiteContent;
  const assertMessagesSchemaReadyImpl = deps.assertMessagesSchemaReady || assertMessagesSchemaReady;
  const getOwnerBillingSnapshotImpl = deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot;
  const processLiveChatLeadCaptureImpl =
    deps.processLiveChatLeadCapture || processLiveChatLeadCapture;
  const buildChatResponseImpl = deps.buildChatResponse || buildChatResponse;
  const buildBusinessContextForChatImpl =
    deps.buildBusinessContextForChat || buildBusinessContextForChat;
  const buildChatSystemPromptImpl = deps.buildChatSystemPrompt || buildChatSystemPrompt;
  const generateAssistantReplyImpl = deps.generateAssistantReply || generateAssistantReply;
  const listRecentWidgetEventsImpl = deps.listRecentWidgetEvents || listRecentWidgetEvents;
  const evaluateLiveConversionRoutingImpl =
    deps.evaluateLiveConversionRouting || evaluateLiveConversionRouting;
  const recordEstimatedUsageImpl = deps.recordEstimatedUsage || recordEstimatedUsage;
  const storeMessagesImpl = deps.storeAgentMessages || storeAgentMessages;
  const selectRelevantApprovedAnswersImpl =
    deps.selectRelevantApprovedAnswers || selectRelevantApprovedAnswers;
  const retrieveSemanticKnowledgeImpl =
    deps.retrieveSemanticKnowledge || retrieveSemanticKnowledge;
  const getOperatorBusinessProfileImpl =
    deps.getOperatorBusinessProfile || getOperatorBusinessProfile;
  const message = body.message;
  const agentId = body.agent_id || body.agentId;
  const agentKey = body.agent_key || body.agentKey;
  const businessId = body.business_id || body.businessId;
  const websiteUrl = cleanText(body.website_url || body.websiteUrl || "");
  const sessionKey = cleanText(body.visitor_session_key || body.visitorSessionKey || "");
  const installId = cleanText(body.install_id || body.installId || "");
  const pageUrl = cleanText(body.page_url || body.pageUrl || "");
  const origin = cleanText(body.origin || "");
  const publicPageKey = cleanText(body.public_page_key || body.publicPageKey || body.k || "");
  const displayMode = normalizePublicDisplayMode(body.display_mode || body.displayMode || body.mode);
  const history = sanitizeChatHistory(body.history);
  const visitorIdentity = normalizeVisitorIdentity({
    ...(body.visitor_identity || {}),
    visitor_mode: body.visitor_identity_mode || body.visitorMode || body.visitor_mode,
    visitor_email: body.visitor_email || body.visitorEmail,
    visitor_name: body.visitor_name || body.visitorName,
  });
  const effectiveUserText = buildEffectiveUserText(message || "", history);
  const normalizedMessage = cleanText(message || "");
  const language = selectResponseLanguage(normalizedMessage, history);

  if (!message || !String(message).trim()) {
    const error = new Error("Message cannot be empty.");
    error.statusCode = 400;
    throw error;
  }

  if (!installId && !agentId && !agentKey && !businessId && !websiteUrl) {
    const error = new Error(
      "install_id, agent_id, agent_key, website_url, or business_id is required."
    );
    error.statusCode = 400;
    throw error;
  }

  const { agent, business, widgetConfig } = await resolveWidgetConversationContextImpl(supabase, {
    installId,
    agentId,
    agentKey,
    businessId,
    websiteUrl,
    origin,
    pageUrl,
    publicPageKey,
    businessName: body.name,
    displayMode,
  });
  const agentWithBusinessContext = {
    ...agent,
    vertical: cleanText(business.vertical || agent.vertical),
  };
  const conversationGuidance = buildConversationGuidance(message, history, {
    vertical: agentWithBusinessContext.vertical,
  });

  const websiteContent = await getStoredWebsiteContentImpl(supabase, business.id);
  await assertMessagesSchemaReadyImpl(supabase, { phase: "request" });
  const billingSnapshot = cleanText(agent.ownerUserId)
    ? await getOwnerBillingSnapshotImpl(supabase, {
      ownerUserId: agent.ownerUserId,
      accessStatus: agent.accessStatus,
    })
    : null;

  if (billingSnapshot?.usage?.isCapped) {
    const userMessageCreatedAt = new Date().toISOString();
    const leadCapture = await processLiveChatLeadCaptureImpl(supabase, {
      agent: agentWithBusinessContext,
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

    return buildChatResponseImpl({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: message,
      reply: buildAiCapacityReachedReply(language),
      sessionKey,
      leadCapture: buildCappedLeadCaptureFallback(leadCapture, language),
      visitorIdentity,
      userMessageCreatedAt,
      storeMessages: storeMessagesImpl,
      displayMode,
    });
  }

  if (!websiteContent) {
    const fallbackReply =
      language === "Hungarian"
        ? "Sajnálom, ezt még nem tudom biztosan. Kérlek vedd fel velünk a kapcsolatot az űrlapon vagy a megadott elérhetőségen."
        : "I’m sorry, I don’t know that yet. Please contact us via our form or the listed contact details.";

    return buildChatResponseImpl({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: message,
      reply: fallbackReply,
      sessionKey,
      visitorIdentity,
      storeMessages: storeMessagesImpl,
      displayMode,
    });
  }

  if (hasLimitedKnowledge(websiteContent)) {
    return buildChatResponseImpl({
      supabase,
      agent,
      businessId: websiteContent.businessId,
      widgetConfig,
      userMessage: message,
      reply: appendImageLines(
        buildLimitedKnowledgeReply(
          language,
          agentWithBusinessContext.name || widgetConfig.assistantName,
          websiteContent
        ),
        websiteContent,
        message
      ),
      sessionKey,
      visitorIdentity,
      storeMessages: storeMessagesImpl,
      displayMode,
    });
  }

  const businessContext = buildBusinessContextForChatImpl(
    websiteContent,
    effectiveUserText,
    {
      widgetConfig,
      vertical: agentWithBusinessContext.vertical,
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

  const relevantApprovedAnswers = cleanText(agentWithBusinessContext.ownerUserId)
    ? await selectRelevantApprovedAnswersImpl(supabase, {
      agentId: agent.id,
      ownerUserId: agentWithBusinessContext.ownerUserId,
      queryText: effectiveUserText,
      limit: 5,
    }).catch((error) => {
      console.warn("[front-desk training] Could not load approved answers:", error?.message || error);
      return [];
    })
    : [];
  const approvedAnswersPrompt = buildApprovedAnswersPrompt(relevantApprovedAnswers);
  const businessProfile = cleanText(agentWithBusinessContext.ownerUserId)
    ? await getOperatorBusinessProfileImpl(supabase, {
      agent: agentWithBusinessContext,
      ownerUserId: agentWithBusinessContext.ownerUserId,
    }).catch((error) => {
      console.warn("[front-desk rag] Could not load business profile facts:", error?.message || error);
      return null;
    })
    : null;
  const businessProfileFacts = buildBusinessProfileKnowledgeText(businessProfile || {});
  const systemPrompt = [
    buildChatSystemPromptImpl(language, agentWithBusinessContext),
    approvedAnswersPrompt,
  ].filter(Boolean).join("\n\n");
  const openaiClient = typeof openai === "function" ? openai() : openai;
  const semanticRetrieval = await retrieveSemanticKnowledgeImpl(supabase, openaiClient, {
    agentId: agent.id,
    ownerUserId: agentWithBusinessContext.ownerUserId,
    queryText: effectiveUserText,
    approvedAnswerCount: relevantApprovedAnswers.length,
    businessProfileFacts,
  }).catch((error) => {
    console.warn("[front-desk rag] Semantic retrieval failed:", error?.message || error);
    return {
      chunks: [],
      confidence: businessProfileFacts || relevantApprovedAnswers.length ? "medium" : "low",
      sourceLabels: [],
      semanticAvailable: false,
      error: error?.message || "Semantic retrieval failed.",
    };
  });
  const semanticHasWebsiteContext = semanticRetrieval.chunks?.some((chunk) =>
    ["website", "manual"].includes(chunk.sourceType)
  );
  const retrievedBusinessContext = buildRetrievedBusinessContextForChat({
    approvedAnswers: relevantApprovedAnswers,
    businessProfileFacts,
    semanticChunks: semanticRetrieval.chunks || [],
    keywordFallbackContext: semanticHasWebsiteContext ? "" : businessContext,
    retrievalConfidence: semanticHasWebsiteContext || relevantApprovedAnswers.length || businessProfileFacts
      ? semanticRetrieval.confidence
      : "low",
    semanticError: semanticRetrieval.error,
  });
  const trustedReplyEmails = listTrustedReplyEmails({
    websiteContent,
    widgetConfig,
    userMessage: message,
    history,
    visitorIdentity,
    approvedAnswers: relevantApprovedAnswers,
  });
  const trustedBusinessContactEvidence = collectTrustedBusinessContactEvidence({
    widgetConfig,
    approvedAnswers: relevantApprovedAnswers,
    businessContext,
    retrievedBusinessContext,
  });
  const usageEntries = [];
  let finalReply;

  try {
    finalReply = await generateAssistantReplyImpl({
      openai: openaiClient,
      userMessage: message,
      history,
      systemPrompt,
      referenceBlocks: [
        {
          label: "Front Desk retrieved business context",
          content: retrievedBusinessContext,
        },
      ],
      conversationGuidance,
      model: "gpt-4o-mini",
      temperature: 0.3,
      presencePenalty: 0,
      frequencyPenalty: 0,
      postProcess: stripRawAssetUrls,
      repair: {
        getIssues: (reply) => {
          const issues = [
            ...getReplyRepairIssues(reply, language),
            ...getFactualReplyGuardrailIssues({
              reply,
              userMessage: effectiveUserText,
              history,
              businessContext: retrievedBusinessContext,
              approvedAnswersPrompt,
            }),
          ];
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
        temperature: 0.25,
      },
      onUsage(entry) {
        usageEntries.push(entry);
      },
    });
  } finally {
    if (usageEntries.length && billingSnapshot && cleanText(agent.ownerUserId)) {
      try {
        await recordEstimatedUsageImpl(supabase, {
          ownerUserId: agent.ownerUserId,
          agentId: agent.id,
          businessId: business.id,
          billingSnapshot,
          entries: usageEntries,
        });
      } catch (usageError) {
        console.warn("[billing] Failed to record AI usage:", usageError?.message || usageError);
      }
    }
  }

  if (replyContainsUnsafePlaceholderEmail(finalReply, trustedReplyEmails)) {
    console.warn("[chat] Replacing placeholder contact reply with grounded fallback.", {
      agentId: agent.id,
      installId,
      pageUrl,
    });
    finalReply = buildMissingVerifiedContactReply(language);
  }

  if (detectUserIntent(effectiveUserText, history) === "contact") {
    if (!trustedBusinessContactEvidence.hasVerifiedContactDetail && !trustedBusinessContactEvidence.hasApprovedContactGuidance) {
      finalReply = buildMissingVerifiedContactReply(language);
    } else if (replyContainsUntrustedContactDetail(finalReply, trustedBusinessContactEvidence)) {
      console.warn("[chat] Replacing untrusted contact-detail reply with grounded fallback.", {
        agentId: agent.id,
        installId,
        pageUrl,
      });
      finalReply = buildMissingVerifiedContactReply(language);
    }
  }

  const userMessageCreatedAt = new Date().toISOString();
  const leadCapture = await processLiveChatLeadCaptureImpl(supabase, {
    agent: agentWithBusinessContext,
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
  const recentWidgetEvents = await listRecentWidgetEventsImpl(supabase, {
    agentId: agent.id,
    installId: installId || widgetConfig.installId,
    sessionId: sessionKey,
  });
  const directRouting = evaluateLiveConversionRoutingImpl({
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

  return buildChatResponseImpl({
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
    storeMessages: storeMessagesImpl,
    displayMode,
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
  const publicPageKey = cleanText(body.public_page_key || body.publicPageKey || body.k || "");
  const displayMode = normalizePublicDisplayMode(body.display_mode || body.displayMode || body.mode);
  const action = cleanText(body.action).toLowerCase();
  const referenceMessage = cleanText(body.reference_message || body.referenceMessage || "");
  const language = detectResponseLanguage(referenceMessage);
  const visitorIdentity = normalizeVisitorIdentity({
    ...(body.visitor_identity || {}),
    visitor_mode: body.visitor_identity_mode || body.visitorMode || body.visitor_mode,
    visitor_email: body.visitor_email || body.visitorEmail,
    visitor_name: body.visitor_name || body.visitorName,
  });

  if (!installId && !agentKey && !businessId && !agentId && !websiteUrl) {
    const error = new Error("install_id, agent_id, agent_key, website_url, or business_id is required.");
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
    publicPageKey,
    businessName: body.name,
    displayMode,
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
