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
  detectUserIntent,
  getFactualReplyGuardrailIssues,
  getReplyRepairIssues,
} from "./prompting.js";
import {
  buildEvidencePack,
  renderEvidencePackForPrompt,
  summarizeEvidencePackForDebug,
} from "./evidencePackService.js";
import { generateAssistantReply } from "./assistantReplyService.js";
import {
  assertMessagesSchemaReady,
  storeAgentMessages,
} from "./messageService.js";
import {
  buildPublicVisitorIdentity,
  normalizeVisitorIdentity,
} from "./visitorIdentityService.js";
import { createSpeechAuthorization } from "../voice/voiceSpeechTokenService.js";
import { ensureWebCallSession } from "../voice/webCallSessionService.js";
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
import { resolveAgentPackage } from "../agents/agentPackageResolver.js";
import { buildHotelConciergeActionDraft } from "../actions/hotelConciergeActionDraftService.js";
import { createAgentActionRequest } from "../actions/agentActionRequestService.js";
import { createAgentBookingRequest } from "../bookings/agentBookingRequestService.js";
import {
  buildChatBookingRequestDraft,
  isBookingRequestsFromChatEnabled,
} from "../bookings/bookingRequestDraftService.js";
import { createAgentQuoteRequest } from "../quotes/agentQuoteRequestService.js";
import {
  buildChatQuoteRequestDraft,
  isQuoteRequestsFromChatEnabled,
} from "../quotes/quoteRequestDraftService.js";
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

function isAnswerContractReportOnlyEnabled(value) {
  const normalized = cleanText(value).toLowerCase().replace(/[\s_]+/g, "-");
  return ["1", "true", "enabled", "report-only", "report"].includes(normalized);
}

function isHotelConciergeActionRequestsEnabled(value = process.env.HOTEL_CONCIERGE_ACTION_REQUESTS_ENABLED) {
  return ["1", "true", "enabled", "on"].includes(String(value || "").trim().toLowerCase());
}

export function normalizePublicConversationSource(value, options = {}) {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  const displayMode = normalizePublicDisplayMode(options.displayMode || options.display_mode);

  if ((normalized === "web_call" || normalized === "web_call_eval") && displayMode === "page") {
    return normalized;
  }

  return "";
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

export function buildNoWebsiteContentFallbackReply(language) {
  return language === "Hungarian"
    ? "Sajnálom, ezt még nem tudom biztosan. Kérlek, vedd fel velünk a kapcsolatot az űrlapon vagy a megadott elérhetőségeken."
    : "I’m sorry, I don’t know that yet. Please contact us via our form or the listed contact details.";
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

const APPROVED_CONTACT_GUIDANCE_STOPWORDS = new Set([
  "answer",
  "approved",
  "best",
  "business",
  "call",
  "contact",
  "customer",
  "describe",
  "detail",
  "details",
  "email",
  "follow",
  "guidance",
  "here",
  "intake",
  "join",
  "leave",
  "name",
  "phone",
  "product",
  "question",
  "reach",
  "share",
  "should",
  "team",
  "text",
  "this",
  "their",
  "they",
  "use",
  "visitor",
  "visitors",
  "what",
  "when",
  "with",
  "would",
  "your",
]);

function tokenizeApprovedContactGuidance(value = "") {
  return (cleanText(value).match(/[a-z0-9]+/gi) || [])
    .map((token) => token.toLowerCase())
    .filter((token) =>
      (token.length >= 4 || /\d/.test(token)) &&
      !APPROVED_CONTACT_GUIDANCE_STOPWORDS.has(token)
    );
}

function replyUsesApprovedContactGuidance(reply = "", approvedAnswers = []) {
  const replyTokens = new Set(tokenizeApprovedContactGuidance(reply));
  if (!replyTokens.size) {
    return false;
  }

  return approvedAnswers.some((answer) => {
    const answerText = cleanText(answer.answerText || answer.answer_text);
    if (!answerText) {
      return false;
    }

    const matchingTokens = tokenizeApprovedContactGuidance(answerText)
      .filter((token) => replyTokens.has(token));

    return matchingTokens.some((token) => /\d/.test(token)) || matchingTokens.length >= 2;
  });
}

function replyIncludesMissingInfoFallback(reply = "") {
  return /\b(?:do not have|don't have|does not have|does not list|not listed|not shown|not confirmed|cannot confirm|can(?:'|\u2019)t confirm|Front Desk does not have|I do not have|nem látok|nincs megadva|nem szerepel)\b/i.test(cleanText(reply));
}

function getRequestedUnlistedServiceLabel(userMessage = "") {
  const normalized = cleanText(userMessage).toLowerCase();

  if (/\belectric scooters?\b/i.test(normalized)) {
    return "electric scooter repair";
  }

  if (/\bmotorcycles?\b/i.test(normalized)) {
    return "motorcycle repair";
  }

  if (/\bon-?site\b|\bmobile repair\b/i.test(normalized)) {
    return "on-site mobile repair";
  }

  if (/\b24\/7\b|\bemergency repair\b/i.test(normalized)) {
    return "24/7 emergency repair";
  }

  return "";
}

function trustedContextSaysRequestedServiceIsUnlisted(context = "", userMessage = "") {
  const serviceLabel = getRequestedUnlistedServiceLabel(userMessage);
  if (!serviceLabel) {
    return false;
  }

  const normalizedContext = cleanText(context).toLowerCase();
  const requiredTerms = serviceLabel
    .replace(/\brepair\b/g, "")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const hasMissingServiceSignal = /\b(?:does not|doesn't|do not|don't)\s+list\b|\bnot listed\b|\bnot shown\b/i.test(normalizedContext);

  return hasMissingServiceSignal && requiredTerms.every((term) => normalizedContext.includes(term));
}

export function buildMissingListedServiceReply(language, userMessage = "") {
  const normalizedMessage = cleanText(userMessage).toLowerCase();
  const serviceLabel = /\belectric scooters?\b/i.test(normalizedMessage)
    ? "electric scooter repair"
    : "that service";

  if (language === "Hungarian") {
    return `Front Desk does not have ${serviceLabel} listed for this business here.\n\nYou can share the details and the business can follow up.`;
  }

  return `Front Desk does not have ${serviceLabel} listed for this business here.\n\nYou can share the details and the business can follow up.`;
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
  conversationSource = "",
  storeUserMessage = true,
  userMessageCreatedAt = null,
  storeMessages = storeAgentMessages,
  webCallSessionId = "",
  actionRequest = null,
  bookingRequest = null,
  quoteRequest = null,
}) {
  const entries = [
    storeUserMessage ? { role: "user", content: userMessage, createdAt: userMessageCreatedAt || undefined } : null,
    { role: "assistant", content: reply },
  ].filter(Boolean);

  await storeMessages(supabase, agent.id, entries, {
    sessionKey,
    visitorIdentity,
    displayMode,
    conversationSource,
    webCallSessionId,
  });

  const speech = createSpeechAuthorization({
    agent,
    businessId,
    widgetConfig,
    sessionKey,
    reply,
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
    ...(actionRequest ? { actionRequest } : {}),
    ...(bookingRequest ? { bookingRequest } : {}),
    ...(quoteRequest ? { quoteRequest } : {}),
    ...(speech ? { speech } : {}),
  };
}

function resolveChatServiceDependencies(deps = {}) {
  return {
    resolveWidgetConversationContext: deps.resolveWidgetConversationContext || resolveWidgetConversationContext,
    getStoredWebsiteContent: deps.getStoredWebsiteContent || getStoredWebsiteContent,
    assertMessagesSchemaReady: deps.assertMessagesSchemaReady || assertMessagesSchemaReady,
    getOwnerBillingSnapshot: deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot,
    processLiveChatLeadCapture: deps.processLiveChatLeadCapture || processLiveChatLeadCapture,
    buildChatResponse: deps.buildChatResponse || buildChatResponse,
    buildBusinessContextForChat: deps.buildBusinessContextForChat || buildBusinessContextForChat,
    buildChatSystemPrompt: deps.buildChatSystemPrompt || buildChatSystemPrompt,
    buildConversationGuidance: deps.buildConversationGuidance || buildConversationGuidance,
    resolveAgentPackage: deps.resolveAgentPackage || resolveAgentPackage,
    generateAssistantReply: deps.generateAssistantReply || generateAssistantReply,
    listRecentWidgetEvents: deps.listRecentWidgetEvents || listRecentWidgetEvents,
    evaluateLiveConversionRouting: deps.evaluateLiveConversionRouting || evaluateLiveConversionRouting,
    recordEstimatedUsage: deps.recordEstimatedUsage || recordEstimatedUsage,
    storeMessages: deps.storeAgentMessages || storeAgentMessages,
    ensureWebCallSession: deps.ensureWebCallSession || ensureWebCallSession,
    selectRelevantApprovedAnswers: deps.selectRelevantApprovedAnswers || selectRelevantApprovedAnswers,
    retrieveSemanticKnowledge: deps.retrieveSemanticKnowledge || retrieveSemanticKnowledge,
    getOperatorBusinessProfile: deps.getOperatorBusinessProfile || getOperatorBusinessProfile,
    buildHotelConciergeActionDraft: deps.buildHotelConciergeActionDraft || buildHotelConciergeActionDraft,
    createAgentActionRequest: deps.createAgentActionRequest || createAgentActionRequest,
    buildChatBookingRequestDraft: deps.buildChatBookingRequestDraft || buildChatBookingRequestDraft,
    createAgentBookingRequest: deps.createAgentBookingRequest || createAgentBookingRequest,
    buildChatQuoteRequestDraft: deps.buildChatQuoteRequestDraft || buildChatQuoteRequestDraft,
    createAgentQuoteRequest: deps.createAgentQuoteRequest || createAgentQuoteRequest,
    hotelConciergeActionRequestsEnabled:
      Object.prototype.hasOwnProperty.call(deps, "hotelConciergeActionRequestsEnabled")
        ? deps.hotelConciergeActionRequestsEnabled
        : isHotelConciergeActionRequestsEnabled,
    bookingRequestsFromChatEnabled:
      Object.prototype.hasOwnProperty.call(deps, "bookingRequestsFromChatEnabled")
        ? deps.bookingRequestsFromChatEnabled
        : isBookingRequestsFromChatEnabled,
    quoteRequestsFromChatEnabled:
      Object.prototype.hasOwnProperty.call(deps, "quoteRequestsFromChatEnabled")
        ? deps.quoteRequestsFromChatEnabled
        : isQuoteRequestsFromChatEnabled,
    onEvidencePack: typeof deps.onEvidencePack === "function" ? deps.onEvidencePack : null,
    onAnswerContract: typeof deps.onAnswerContract === "function" ? deps.onAnswerContract : null,
    answerContractEnabled: deps.answerContractMode === true
      || isAnswerContractReportOnlyEnabled(deps.answerContractMode)
      || isAnswerContractReportOnlyEnabled(process.env.FRONT_DESK_ANSWER_CONTRACT_MODE),
    answerContractIncludeClaimText: deps.answerContractIncludeClaimText === true,
  };
}

function resolveHotelConciergeActionRequestFlag(value) {
  const resolvedValue = typeof value === "function" ? value() : value;

  return resolvedValue === true || isHotelConciergeActionRequestsEnabled(resolvedValue);
}

function resolveBookingRequestsFromChatFlag(value) {
  const resolvedValue = typeof value === "function" ? value() : value;

  return resolvedValue === true || isBookingRequestsFromChatEnabled(resolvedValue);
}

function resolveQuoteRequestsFromChatFlag(value) {
  const resolvedValue = typeof value === "function" ? value() : value;

  return resolvedValue === true || isQuoteRequestsFromChatEnabled(resolvedValue);
}

function hasBlockingHotelConciergeActionSafetyNote(draft = {}) {
  const safetyNotes = Array.isArray(draft.safetyNotes) ? draft.safetyNotes : [];

  return safetyNotes.some((note) =>
    /\b(emergency|urgent safety|safety|escalation|refus|pms|staff-only|booking|reservation|payment|checkout mutation|guest-record)\b/i.test(
      cleanText(note)
    )
  );
}

function isCreatableHotelConciergeActionDraft(draft = {}) {
  return draft.matched === true
    && Boolean(cleanText(draft.actionKey))
    && ["high", "medium"].includes(cleanText(draft.confidence).toLowerCase())
    && !hasBlockingHotelConciergeActionSafetyNote(draft);
}

function hotelActionPhrase(actionKey, language) {
  const hungarian = language === "Hungarian";
  const phrases = {
    "hotel.bring_water": hungarian ? "vízbekészítés" : "water",
    "hotel.extra_towels": hungarian ? "extra törölközők vagy ágynemű" : "extra towels or linens",
    "hotel.maintenance_issue": hungarian ? "karbantartási probléma" : "maintenance",
    "hotel.late_checkout_request": hungarian ? "késői kijelentkezési kérés" : "late checkout request",
    "hotel.housekeeping_request": hungarian ? "takarítási kérés" : "housekeeping",
    "hotel.room_service_request": hungarian ? "szobaszerviz kérés" : "room service",
    "hotel.staff_help": hungarian ? "személyzeti segítség" : "staff assistance",
  };

  return phrases[actionKey] || (hungarian ? "vendégkérés" : "guest request");
}

function buildHotelConciergeActionCreatedReply(draft, language) {
  const phrase = hotelActionPhrase(draft.actionKey, language);

  if (language === "Hungarian") {
    return `Elküldtem ezt a kérést a hotel személyzetének átnézésre (${phrase}). Innen ők kezelik; ebben a chatben nem tudok időpontot garantálni.`;
  }

  return `I’ve sent this request to hotel staff for review (${phrase}). They’ll handle it from here; I can’t guarantee timing in this chat.`;
}

function buildHotelConciergeActionCreateFailedReply(draft, language) {
  const phrase = hotelActionPhrase(draft.actionKey, language);

  if (language === "Hungarian") {
    return `Nem tudtam elküldeni ezt a hotel személyzetének ebből a chatből (${phrase}). Kérlek, keresd közvetlenül a recepciót vagy a hotel személyzetét.`;
  }

  return `I couldn’t send this to hotel staff from this chat (${phrase}). Please contact the front desk or hotel staff directly.`;
}

function bookingRequestIntentPhrase(intentType, language) {
  const hungarian = language === "Hungarian";
  const phrases = {
    booking_request: hungarian ? "időpontkérés" : "booking request",
    availability_question: hungarian ? "elérhetőségi kérés" : "availability request",
    cancel_request: hungarian ? "lemondási kérés" : "cancellation request",
    reschedule_request: hungarian ? "módosítási kérés" : "change request",
  };

  return phrases[intentType] || (hungarian ? "kérés" : "request");
}

function bookingRequestedTimePhrase(draft = {}, language) {
  const requestedTimeText = cleanText(draft.requestedTimeText);

  if (!requestedTimeText) {
    return "";
  }

  return language === "Hungarian"
    ? ` a kért időpontra (${requestedTimeText})`
    : ` for ${requestedTimeText}`;
}

function buildBookingRequestCreatedReply(draft, language) {
  const phrase = bookingRequestIntentPhrase(draft.intentType, language);
  const requestedTimePhrase = bookingRequestedTimePhrase(draft, language);

  if (language === "Hungarian") {
    return `Megkaptuk a kérésedet${requestedTimePhrase}, és elküldtük a munkatársaknak átnézésre (${phrase}). A vállalkozásnak közvetlenül kell egyeztetnie a részleteket. Ebben a chatben nincs időpont véglegesítve.`;
  }

  return `I received your request${requestedTimePhrase} and sent it to staff for review (${phrase}). The business will need to confirm the details directly. No time is confirmed in this chat.`;
}

function buildBookingRequestCreateFailedReply(draft, language) {
  const phrase = bookingRequestIntentPhrase(draft.intentType, language);
  const requestedTimeText = cleanText(draft?.requestedTimeText);

  if (language === "Hungarian") {
    return requestedTimeText
      ? `Nem tudtam elküldeni ezt a kérést a munkatársaknak ebből a chatből (${phrase}). A kért időpontot (${requestedTimeText}) innen nem tudom megerősíteni; ebben a chatben nincs időpont véglegesítve. Kérlek, keresd közvetlenül a vállalkozást.`
      : `Nem tudtam elküldeni ezt a kérést a munkatársaknak ebből a chatből (${phrase}). Kérlek, keresd közvetlenül a vállalkozást; ebben a chatben nincs időpont véglegesítve.`;
  }

  return requestedTimeText
    ? `I couldn’t send this request to staff from this chat (${phrase}). I cannot confirm ${requestedTimeText} from here; no time is confirmed in this chat. Please contact the business directly.`
    : `I couldn’t send this request to staff from this chat (${phrase}). Please contact the business directly; no time is confirmed in this chat.`;
}

function quoteRequestIntentPhrase(intentType, language) {
  const hungarian = language === "Hungarian";
  const phrases = {
    quote_intent: hungarian ? "ajánlatkérés" : "quote request",
    pricing_question: hungarian ? "árazási kérdés" : "pricing question",
    quote_mutation_request: hungarian ? "ajánlatmódosítási kérés" : "quote change request",
  };

  return phrases[intentType] || (hungarian ? "ajánlatkérés" : "quote request");
}

function quoteRequestMissingDetailsPrompt(draft = {}, language) {
  const missing = [];

  if (!cleanText(draft.requestedService)) {
    missing.push(language === "Hungarian" ? "milyen szolgáltatásról vagy munkáról van szó" : "what service or work this is for");
  }

  if (!cleanText(draft.locationText)) {
    missing.push(language === "Hungarian" ? "a helyszínt" : "the location");
  }

  if (!cleanText(draft.customerEmail) && !cleanText(draft.customerPhone)) {
    missing.push(language === "Hungarian" ? "egy biztonságos elérhetőséget" : "a safe contact detail");
  }

  if (!missing.length) {
    return "";
  }

  return language === "Hungarian"
    ? ` Ha szeretnéd, add meg még: ${missing.join(", ")}.`
    : ` If you want, share: ${missing.join(", ")}.`;
}

function buildQuoteRequestCreatedReply(draft, language) {
  const phrase = quoteRequestIntentPhrase(draft.intentType, language);
  const missingDetailsPrompt = quoteRequestMissingDetailsPrompt(draft, language);

  if (language === "Hungarian") {
    return `Megkaptuk az ajánlatkérésedet, és elküldtük a munkatársaknak átnézésre (${phrase}). A pontos árat vagy végleges ajánlatot a vállalkozásnak kell megerősítenie. Ebben a chatben nincs végleges ajánlat vagy ár megerősítve.${missingDetailsPrompt}`;
  }

  return `I received your quote request and sent it to staff for review (${phrase}). The exact price or final quote must be confirmed by the business. No final quote or price is confirmed in this chat.${missingDetailsPrompt}`;
}

function buildQuoteRequestCreateFailedReply(draft, language) {
  const phrase = quoteRequestIntentPhrase(draft.intentType, language);

  if (language === "Hungarian") {
    return `Nem tudtam elküldeni ezt az ajánlatkérést a munkatársaknak ebből a chatből (${phrase}). Kérlek, keresd közvetlenül a vállalkozást. Pontos árat vagy végleges ajánlatot csak a vállalkozás erősíthet meg.`;
  }

  return `I couldn’t send this quote request to staff from this chat (${phrase}). Please contact the business directly. Only the business can confirm an exact price or final quote.`;
}

export function normalizeChatRequestBody(body) {
  const message = body.message;
  const displayMode = normalizePublicDisplayMode(body.display_mode || body.displayMode || body.mode);
  const history = sanitizeChatHistory(body.history);
  const effectiveUserText = buildEffectiveUserText(message || "", history);
  const normalizedMessage = cleanText(message || "");

  return {
    message,
    agentId: body.agent_id || body.agentId,
    agentKey: body.agent_key || body.agentKey,
    businessId: body.business_id || body.businessId,
    websiteUrl: cleanText(body.website_url || body.websiteUrl || ""),
    sessionKey: cleanText(body.visitor_session_key || body.visitorSessionKey || ""),
    installId: cleanText(body.install_id || body.installId || ""),
    pageUrl: cleanText(body.page_url || body.pageUrl || ""),
    origin: cleanText(body.origin || ""),
    publicPageKey: cleanText(body.public_page_key || body.publicPageKey || body.k || ""),
    displayMode,
    conversationSource: normalizePublicConversationSource(
      body.conversation_source || body.conversationSource || body.source_type || body.sourceType,
      { displayMode }
    ),
    history,
    visitorIdentity: normalizeVisitorIdentity({
      ...(body.visitor_identity || {}),
      visitor_mode: body.visitor_identity_mode || body.visitorMode || body.visitor_mode,
      visitor_email: body.visitor_email || body.visitorEmail,
      visitor_name: body.visitor_name || body.visitorName,
    }),
    effectiveUserText,
    normalizedMessage,
    language: selectResponseLanguage(normalizedMessage, history),
    businessName: body.name,
    webCallId: body.web_call_id || body.webCallId,
  };
}

export function validateNormalizedChatRequest(request) {
  if (!request.message || !String(request.message).trim()) {
    const error = new Error("Message cannot be empty.");
    error.statusCode = 400;
    throw error;
  }

  if (
    !request.installId &&
    !request.agentId &&
    !request.agentKey &&
    !request.businessId &&
    !request.websiteUrl
  ) {
    const error = new Error(
      "install_id, agent_id, agent_key, website_url, or business_id is required."
    );
    error.statusCode = 400;
    throw error;
  }
}

async function resolvePublicChatContext({
  supabase,
  request,
  services,
}) {
  const { agent, business, widgetConfig } = await services.resolveWidgetConversationContext(supabase, {
    installId: request.installId,
    agentId: request.agentId,
    agentKey: request.agentKey,
    businessId: request.businessId,
    websiteUrl: request.websiteUrl,
    origin: request.origin,
    pageUrl: request.pageUrl,
    publicPageKey: request.publicPageKey,
    businessName: request.businessName,
    displayMode: request.displayMode,
  });
  const webCallSession = request.conversationSource === "web_call"
    ? await services.ensureWebCallSession(supabase, {
      agent,
      business,
      clientSessionKey: request.webCallId,
      visitorSessionKey: request.sessionKey,
      eventName: "web_call_turn_sent",
      metadata: {
        web_call_id: request.webCallId,
      },
    }).catch((error) => {
      console.warn("[web-call] chat session persistence skipped", {
        agentId: agent.id,
        message: error?.message || "Unknown Web Call session error",
      });
      return null;
    })
    : null;
  const agentWithBusinessContext = {
    ...agent,
    vertical: cleanText(business.vertical || agent.vertical),
  };
  const agentPackage = services.resolveAgentPackage(agentWithBusinessContext);
  const conversationGuidance = services.buildConversationGuidance(request.message, request.history, {
    agentPackage,
    vertical: agentWithBusinessContext.vertical,
  });

  return {
    agent,
    business,
    widgetConfig,
    webCallSession,
    agentWithBusinessContext,
    agentPackage,
    conversationGuidance,
  };
}

async function loadChatCapacityContext({
  supabase,
  publicContext,
  services,
}) {
  const { agent, business } = publicContext;
  const websiteContent = await services.getStoredWebsiteContent(supabase, business.id);
  await services.assertMessagesSchemaReady(supabase, { phase: "request" });
  const billingSnapshot = cleanText(agent.ownerUserId)
    ? await services.getOwnerBillingSnapshot(supabase, {
      ownerUserId: agent.ownerUserId,
      accessStatus: agent.accessStatus,
    })
    : null;

  return {
    websiteContent,
    billingSnapshot,
  };
}

function buildLiveLeadCapturePayload({
  request,
  publicContext,
  messageCreatedAt,
}) {
  const { business, widgetConfig, agentWithBusinessContext } = publicContext;

  return {
    agent: agentWithBusinessContext,
    business,
    widgetConfig,
    sessionKey: request.sessionKey,
    installId: request.installId,
    pageUrl: request.pageUrl,
    origin: request.origin,
    userMessage: request.message,
    messageCreatedAt,
    language: request.language,
    visitorIdentity: request.visitorIdentity,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
  };
}

async function buildCapacityReachedChatResponse({
  supabase,
  request,
  publicContext,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    webCallSession,
  } = publicContext;
  const userMessageCreatedAt = new Date().toISOString();
  const leadCapture = await services.processLiveChatLeadCapture(
    supabase,
    buildLiveLeadCapturePayload({
      request,
      publicContext,
      messageCreatedAt: userMessageCreatedAt,
    })
  );

  return services.buildChatResponse({
    supabase,
    agent,
    businessId: business.id,
    widgetConfig,
    userMessage: request.message,
    reply: buildAiCapacityReachedReply(request.language),
    sessionKey: request.sessionKey,
    leadCapture: buildCappedLeadCaptureFallback(leadCapture, request.language),
    visitorIdentity: request.visitorIdentity,
    userMessageCreatedAt,
    storeMessages: services.storeMessages,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
    webCallSessionId: webCallSession?.id || "",
  });
}

function buildNoWebsiteContentResponse({
  supabase,
  request,
  publicContext,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    webCallSession,
  } = publicContext;

  return services.buildChatResponse({
    supabase,
    agent,
    businessId: business.id,
    widgetConfig,
    userMessage: request.message,
    reply: buildNoWebsiteContentFallbackReply(request.language),
    sessionKey: request.sessionKey,
    visitorIdentity: request.visitorIdentity,
    storeMessages: services.storeMessages,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
    webCallSessionId: webCallSession?.id || "",
  });
}

function buildLimitedKnowledgeResponse({
  supabase,
  request,
  publicContext,
  websiteContent,
  services,
}) {
  const {
    agent,
    widgetConfig,
    webCallSession,
    agentWithBusinessContext,
  } = publicContext;

  return services.buildChatResponse({
    supabase,
    agent,
    businessId: websiteContent.businessId,
    widgetConfig,
    userMessage: request.message,
    reply: appendImageLines(
      buildLimitedKnowledgeReply(
        request.language,
        agentWithBusinessContext.name || widgetConfig.assistantName,
        websiteContent
      ),
      websiteContent,
      request.message
    ),
    sessionKey: request.sessionKey,
    visitorIdentity: request.visitorIdentity,
    storeMessages: services.storeMessages,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
    webCallSessionId: webCallSession?.id || "",
  });
}

async function maybeBuildHotelConciergeActionRequestResponse({
  supabase,
  request,
  publicContext,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    webCallSession,
    agentPackage,
  } = publicContext;

  if (agentPackage?.key !== "hotel_concierge") {
    return null;
  }

  if (!resolveHotelConciergeActionRequestFlag(services.hotelConciergeActionRequestsEnabled)) {
    return null;
  }

  const draft = services.buildHotelConciergeActionDraft({
    message: request.message,
    history: request.history,
    guestContext: {
      language: request.language,
    },
    language: request.language,
  });

  if (!isCreatableHotelConciergeActionDraft(draft)) {
    return null;
  }

  const userMessageCreatedAt = new Date().toISOString();

  try {
    const actionRequest = await services.createAgentActionRequest(supabase, {
      ownerUserId: agent.ownerUserId,
      agentId: agent.id,
      packageKey: "hotel_concierge",
      requestType: draft.actionKey,
      visitorSessionKey: request.sessionKey,
      conversationSource: request.conversationSource,
      displayMode: request.displayMode,
      guestContext: draft.guestContext,
      payload: draft.payload,
      sourceMessage: draft.sourceMessage,
    });

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildHotelConciergeActionCreatedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
      actionRequest: {
        created: true,
        status: actionRequest?.status || "new",
        requestType: draft.actionKey,
      },
    });
  } catch (error) {
    console.warn("[hotel concierge] Action request creation failed; returning safe fallback.", {
      agentId: agent.id,
      requestType: draft.actionKey,
      message: error?.message || "Unknown action request error",
    });

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildHotelConciergeActionCreateFailedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
    });
  }
}

async function maybeBuildChatBookingRequestResponse({
  supabase,
  request,
  publicContext,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    webCallSession,
  } = publicContext;

  if (!resolveBookingRequestsFromChatFlag(services.bookingRequestsFromChatEnabled)) {
    return null;
  }

  const draft = services.buildChatBookingRequestDraft({
    message: request.message,
    visitorIdentity: request.visitorIdentity,
    ownerUserId: agent.ownerUserId,
    agentId: agent.id,
    businessId: business.id,
    sessionKey: request.sessionKey,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
  });

  if (!draft?.matched) {
    return null;
  }

  const userMessageCreatedAt = new Date().toISOString();

  try {
    const createdRequest = await services.createAgentBookingRequest(supabase, draft.createPayload);

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildBookingRequestCreatedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
      bookingRequest: {
        created: true,
        status: createdRequest?.status || draft.status,
      },
    });
  } catch (error) {
    console.warn("[booking request] Chat request creation failed; returning safe fallback.", {
      agentId: agent.id,
      intentType: draft.intentType,
      message: error?.message || "Unknown booking request error",
    });

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildBookingRequestCreateFailedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
      bookingRequest: {
        created: false,
        status: draft.status,
      },
    });
  }
}

async function maybeBuildChatQuoteRequestResponse({
  supabase,
  request,
  publicContext,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    webCallSession,
  } = publicContext;

  if (!resolveQuoteRequestsFromChatFlag(services.quoteRequestsFromChatEnabled)) {
    return null;
  }

  const draft = services.buildChatQuoteRequestDraft({
    message: request.message,
    visitorIdentity: request.visitorIdentity,
    ownerUserId: agent.ownerUserId,
    agentId: agent.id,
    businessId: business.id,
    sessionKey: request.sessionKey,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
  });

  if (!draft?.matched) {
    return null;
  }

  const userMessageCreatedAt = new Date().toISOString();

  try {
    const createdRequest = await services.createAgentQuoteRequest(supabase, draft.createPayload);

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildQuoteRequestCreatedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
      quoteRequest: {
        created: true,
        status: createdRequest?.status || draft.status,
      },
    });
  } catch (error) {
    console.warn("[quote request] Chat request creation failed; returning safe fallback.", {
      agentId: agent.id,
      intentType: draft.intentType,
      message: error?.message || "Unknown quote request error",
    });

    return services.buildChatResponse({
      supabase,
      agent,
      businessId: business.id,
      widgetConfig,
      userMessage: request.message,
      reply: buildQuoteRequestCreateFailedReply(draft, request.language),
      sessionKey: request.sessionKey,
      visitorIdentity: request.visitorIdentity,
      userMessageCreatedAt,
      storeMessages: services.storeMessages,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
      webCallSessionId: webCallSession?.id || "",
    });
  }
}

async function assembleChatKnowledge({
  supabase,
  openai,
  request,
  publicContext,
  websiteContent,
  services,
}) {
  const {
    agent,
    business,
    widgetConfig,
    agentWithBusinessContext,
    agentPackage,
  } = publicContext;
  const businessContext = services.buildBusinessContextForChat(
    websiteContent,
    request.effectiveUserText,
    {
      agentPackage,
      widgetConfig,
      vertical: agentWithBusinessContext.vertical,
    }
  );

  logChatMetadata("request_prepared", {
    agentId: agent.id,
    businessId: business.id,
    installId: request.installId,
    sessionKey: request.sessionKey,
    origin: request.origin,
    pageUrl: request.pageUrl,
    messageLength: request.normalizedMessage.length,
    historyCount: request.history.length,
    businessContextLength: businessContext.length,
  });

  const canReadSupabase = typeof supabase?.from === "function";
  const relevantApprovedAnswers = cleanText(agentWithBusinessContext.ownerUserId) && canReadSupabase
    ? await services.selectRelevantApprovedAnswers(supabase, {
      agentId: agent.id,
      ownerUserId: agentWithBusinessContext.ownerUserId,
      queryText: request.effectiveUserText,
      limit: 5,
    }).catch((error) => {
      console.warn("[front-desk training] Could not load approved answers:", error?.message || error);
      return [];
    })
    : [];
  const approvedAnswersPrompt = buildApprovedAnswersPrompt(relevantApprovedAnswers);
  const businessProfile = cleanText(agentWithBusinessContext.ownerUserId) && canReadSupabase
    ? await services.getOperatorBusinessProfile(supabase, {
      agent: agentWithBusinessContext,
      ownerUserId: agentWithBusinessContext.ownerUserId,
    }).catch((error) => {
      console.warn("[front-desk rag] Could not load business profile facts:", error?.message || error);
      return null;
    })
    : null;
  const businessProfileFacts = buildBusinessProfileKnowledgeText(businessProfile || {});
  const systemPrompt = [
    services.buildChatSystemPrompt(request.language, agentWithBusinessContext, {
      agentPackage,
      conversationSource: request.conversationSource,
    }),
    approvedAnswersPrompt,
  ].filter(Boolean).join("\n\n");
  const openaiClient = typeof openai === "function" ? openai() : openai;
  const semanticRetrieval = await services.retrieveSemanticKnowledge(supabase, openaiClient, {
    agentId: agent.id,
    ownerUserId: agentWithBusinessContext.ownerUserId,
    queryText: request.effectiveUserText,
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
  const evidencePack = buildEvidencePack({
    approvedAnswers: relevantApprovedAnswers,
    businessProfileFacts,
    semanticChunks: semanticRetrieval.chunks || [],
    keywordFallbackContext: semanticHasWebsiteContext ? "" : businessContext,
    retrievalConfidence: semanticHasWebsiteContext || relevantApprovedAnswers.length || businessProfileFacts
      ? semanticRetrieval.confidence
      : "low",
    semanticError: semanticRetrieval.error,
    agentPackage,
  });
  const retrievedBusinessContext = renderEvidencePackForPrompt(evidencePack);

  if (services.onEvidencePack) {
    services.onEvidencePack(summarizeEvidencePackForDebug(evidencePack), {
      agentId: agent.id,
      businessId: business.id,
      sessionKey: request.sessionKey,
      displayMode: request.displayMode,
      conversationSource: request.conversationSource,
    });
  }

  return {
    businessContext,
    relevantApprovedAnswers,
    approvedAnswersPrompt,
    systemPrompt,
    openaiClient,
    evidencePack,
    retrievedBusinessContext,
    trustedReplyEmails: listTrustedReplyEmails({
      websiteContent,
      widgetConfig,
      userMessage: request.message,
      history: request.history,
      visitorIdentity: request.visitorIdentity,
      approvedAnswers: relevantApprovedAnswers,
    }),
    trustedBusinessContactEvidence: collectTrustedBusinessContactEvidence({
      widgetConfig,
      approvedAnswers: relevantApprovedAnswers,
      businessContext,
      retrievedBusinessContext,
    }),
  };
}

async function generateRepairedChatReply({
  supabase,
  request,
  publicContext,
  capacityContext,
  knowledge,
  services,
}) {
  const {
    agent,
    business,
    conversationGuidance,
  } = publicContext;
  const usageEntries = [];

  try {
    return await services.generateAssistantReply({
      openai: knowledge.openaiClient,
      userMessage: request.message,
      history: request.history,
      systemPrompt: knowledge.systemPrompt,
      referenceBlocks: [
        {
          label: "Front Desk retrieved business context",
          content: knowledge.retrievedBusinessContext,
        },
      ],
      conversationGuidance,
      model: "gpt-4o-mini",
      temperature: 0.6,
      presencePenalty: 0,
      frequencyPenalty: 0,
      postProcess: stripRawAssetUrls,
      repair: {
        getIssues: (reply) => {
          const issues = [
            ...getReplyRepairIssues(reply, request.language),
            ...getFactualReplyGuardrailIssues({
              reply,
              userMessage: request.effectiveUserText,
              history: request.history,
              businessContext: knowledge.retrievedBusinessContext,
              approvedAnswersPrompt: knowledge.approvedAnswersPrompt,
            }),
          ];
          logChatMetadata("reply_repair_checked", {
            agentId: agent.id,
            businessId: business.id,
            installId: request.installId,
            sessionKey: request.sessionKey,
            origin: request.origin,
            pageUrl: request.pageUrl,
            messageLength: request.normalizedMessage.length,
            historyCount: request.history.length,
            replyLength: cleanText(reply).length,
            repairIssueCount: issues.length,
          });
          return issues;
        },
        buildRewritePrompt: () => buildBusinessReplyRepairPrompt(request.language),
        temperature: 0.5,
      },
      onUsage(entry) {
        usageEntries.push(entry);
      },
      answerContract: services.answerContractEnabled
        ? {
            enabled: true,
            evidencePack: knowledge.evidencePack,
            agentPackage: publicContext.agentPackage,
            includeClaimText: services.answerContractIncludeClaimText,
            onContract(summary) {
              if (services.onAnswerContract) {
                services.onAnswerContract(summary, {
                  agentId: agent.id,
                  businessId: business.id,
                  sessionKey: request.sessionKey,
                  displayMode: request.displayMode,
                  conversationSource: request.conversationSource,
                });
              }
            },
          }
        : { enabled: false },
    });
  } finally {
    if (usageEntries.length && capacityContext.billingSnapshot && cleanText(agent.ownerUserId)) {
      try {
        await services.recordEstimatedUsage(supabase, {
          ownerUserId: agent.ownerUserId,
          agentId: agent.id,
          businessId: business.id,
          billingSnapshot: capacityContext.billingSnapshot,
          entries: usageEntries,
        });
      } catch (usageError) {
        console.warn("[billing] Failed to record AI usage:", usageError?.message || usageError);
      }
    }
  }
}

function applyFinalReplySafetyValidation({
  reply,
  request,
  publicContext,
  knowledge,
}) {
  const { agent } = publicContext;
  let finalReply = reply;

  if (replyContainsUnsafePlaceholderEmail(finalReply, knowledge.trustedReplyEmails)) {
    console.warn("[chat] Replacing placeholder contact reply with grounded fallback.", {
      agentId: agent.id,
      installId: request.installId,
      pageUrl: request.pageUrl,
    });
    finalReply = buildMissingVerifiedContactReply(request.language);
  }

  if (detectUserIntent(request.effectiveUserText, request.history) === "contact") {
    const usesApprovedContactGuidance = knowledge.trustedBusinessContactEvidence.hasApprovedContactGuidance
      && replyUsesApprovedContactGuidance(finalReply, knowledge.relevantApprovedAnswers)
      && !replyContainsUntrustedContactDetail(finalReply, knowledge.trustedBusinessContactEvidence);

    if (!knowledge.trustedBusinessContactEvidence.hasVerifiedContactDetail && !usesApprovedContactGuidance) {
      finalReply = buildMissingVerifiedContactReply(request.language);
    } else if (replyContainsUntrustedContactDetail(finalReply, knowledge.trustedBusinessContactEvidence)) {
      console.warn("[chat] Replacing untrusted contact-detail reply with grounded fallback.", {
        agentId: agent.id,
        installId: request.installId,
        pageUrl: request.pageUrl,
      });
      finalReply = buildMissingVerifiedContactReply(request.language);
    }
  }

  const finalGuardrailIssues = getFactualReplyGuardrailIssues({
    reply: finalReply,
    userMessage: request.effectiveUserText,
    history: request.history,
    businessContext: knowledge.retrievedBusinessContext,
    approvedAnswersPrompt: knowledge.approvedAnswersPrompt,
  });
  if (finalGuardrailIssues.some((issue) => /unsupported service denial/i.test(issue))) {
    console.warn("[chat] Replacing unsupported service-denial reply with grounded fallback.", {
      agentId: agent.id,
      installId: request.installId,
      pageUrl: request.pageUrl,
    });
    finalReply = buildMissingListedServiceReply(request.language, request.effectiveUserText);
  }

  if (
    trustedContextSaysRequestedServiceIsUnlisted(
      [knowledge.retrievedBusinessContext, knowledge.approvedAnswersPrompt].join("\n\n"),
      request.effectiveUserText
    )
    && !replyIncludesMissingInfoFallback(finalReply)
  ) {
    console.warn("[chat] Replacing unlisted-service reply with grounded fallback.", {
      agentId: agent.id,
      installId: request.installId,
      pageUrl: request.pageUrl,
    });
    finalReply = buildMissingListedServiceReply(request.language, request.effectiveUserText);
  }

  return finalReply;
}

function normalizeSharedChatTurnWebsiteContent(websiteContent, business = {}) {
  if (!websiteContent || typeof websiteContent !== "object") {
    return null;
  }

  const content = cleanText(websiteContent.content);
  if (!content) {
    return null;
  }

  return {
    ...websiteContent,
    businessId: cleanText(websiteContent.businessId || websiteContent.business_id || business.id),
    websiteUrl: cleanText(websiteContent.websiteUrl || websiteContent.website_url || business.website_url || business.websiteUrl),
    pageTitle: cleanText(websiteContent.pageTitle || websiteContent.page_title || business.name),
    content,
  };
}

function buildSharedChatTurnRequest({
  message = "",
  history = [],
  language = "",
  sessionKey = "",
  displayMode = "page",
  conversationSource = "",
  visitorIdentity = null,
  pageUrl = "",
  origin = "",
} = {}) {
  const normalizedMessage = cleanText(message);
  const sanitizedHistory = sanitizeChatHistory(history).slice(-8);

  return {
    message: normalizedMessage,
    history: sanitizedHistory,
    effectiveUserText: buildEffectiveUserText(normalizedMessage, sanitizedHistory),
    normalizedMessage,
    language: cleanText(language) || selectResponseLanguage(normalizedMessage, sanitizedHistory),
    sessionKey: cleanText(sessionKey),
    installId: "",
    pageUrl: cleanText(pageUrl),
    origin: cleanText(origin),
    displayMode: normalizePublicDisplayMode(displayMode),
    conversationSource: cleanText(conversationSource),
    visitorIdentity: normalizeVisitorIdentity(visitorIdentity || {}),
  };
}

async function loadSharedChatTurnWebsiteContent({
  supabase,
  business,
  providedWebsiteContent,
  fallbackWebsiteContent,
  services,
}) {
  const provided = normalizeSharedChatTurnWebsiteContent(providedWebsiteContent, business);
  if (provided) {
    return provided;
  }

  const businessId = cleanText(business?.id);
  if (businessId && typeof supabase?.from === "function") {
    try {
      const stored = await services.getStoredWebsiteContent(supabase, businessId);
      const normalizedStored = normalizeSharedChatTurnWebsiteContent(stored, business);
      if (normalizedStored) {
        return normalizedStored;
      }
    } catch (error) {
      console.warn("[chat] Shared turn website content lookup skipped.", {
        businessId,
        message: error?.message || "Unknown website content lookup error",
      });
    }
  }

  return normalizeSharedChatTurnWebsiteContent(fallbackWebsiteContent, business);
}

export async function generateSharedChatAssistantTurn(options = {}, deps = {}) {
  const services = resolveChatServiceDependencies(deps);
  const request = buildSharedChatTurnRequest(options);

  if (!request.normalizedMessage) {
    const error = new Error("message is required.");
    error.statusCode = 400;
    throw error;
  }

  const agent = {
    ...(options.agent || {}),
    id: cleanText(options.agent?.id || options.agentId || "shared-chat-agent"),
    ownerUserId: cleanText(options.agent?.ownerUserId || options.agent?.owner_user_id || options.ownerUserId),
    publicAgentKey: cleanText(options.agent?.publicAgentKey || options.agent?.public_agent_key),
    accessStatus: cleanText(options.agent?.accessStatus || options.agent?.access_status),
  };
  const business = {
    ...(options.business || {}),
    id: cleanText(options.business?.id || options.agent?.businessId || options.agent?.business_id || "shared-chat-business"),
    name: cleanText(options.business?.name || options.business?.businessName || options.businessName),
    vertical: cleanText(options.business?.vertical || options.agent?.vertical),
  };
  const widgetConfig = options.widgetConfig && typeof options.widgetConfig === "object"
    ? options.widgetConfig
    : {};
  const agentWithBusinessContext = {
    ...agent,
    vertical: cleanText(business.vertical || agent.vertical),
  };
  const agentPackage = options.agentPackage || services.resolveAgentPackage(agentWithBusinessContext);
  const publicContext = {
    agent,
    business,
    widgetConfig,
    webCallSession: null,
    agentWithBusinessContext,
    agentPackage,
    conversationGuidance: services.buildConversationGuidance(request.message, request.history, {
      agentPackage,
      vertical: agentWithBusinessContext.vertical,
    }),
  };
  const websiteContent = await loadSharedChatTurnWebsiteContent({
    supabase: options.supabase,
    business,
    providedWebsiteContent: options.websiteContent,
    fallbackWebsiteContent: options.fallbackWebsiteContent,
    services,
  });

  if (!websiteContent) {
    return {
      reply: buildNoWebsiteContentFallbackReply(request.language),
      usedSharedEngine: false,
      fallbackReason: "missing_website_content",
    };
  }

  if (hasLimitedKnowledge(websiteContent)) {
    return {
      reply: appendImageLines(
        buildLimitedKnowledgeReply(
          request.language,
          agentWithBusinessContext.name || widgetConfig.assistantName,
          websiteContent
        ),
        websiteContent,
        request.message
      ),
      usedSharedEngine: false,
      fallbackReason: "limited_website_content",
    };
  }

  const capacityContext = {
    websiteContent,
    billingSnapshot: null,
  };
  const knowledge = await assembleChatKnowledge({
    supabase: options.supabase,
    openai: options.openai,
    request,
    publicContext,
    websiteContent,
    services,
  });
  const generatedReply = await generateRepairedChatReply({
    supabase: options.supabase,
    request,
    publicContext,
    capacityContext,
    knowledge,
    services,
  });
  const finalReply = applyFinalReplySafetyValidation({
    reply: generatedReply,
    request,
    publicContext,
    knowledge,
  });

  return {
    reply: appendImageLines(finalReply, websiteContent, request.message),
    usedSharedEngine: true,
  };
}

async function resolveLeadCaptureAndDirectRouting({
  supabase,
  request,
  publicContext,
  services,
}) {
  const { agent, widgetConfig } = publicContext;
  const userMessageCreatedAt = new Date().toISOString();
  const leadCapture = await services.processLiveChatLeadCapture(
    supabase,
    buildLiveLeadCapturePayload({
      request,
      publicContext,
      messageCreatedAt: userMessageCreatedAt,
    })
  );
  const recentWidgetEvents = await services.listRecentWidgetEvents(supabase, {
    agentId: agent.id,
    installId: request.installId || widgetConfig.installId,
    sessionId: request.sessionKey,
  });
  const directRouting = services.evaluateLiveConversionRouting({
    widgetConfig,
    userMessage: request.message,
    sessionKey: request.sessionKey,
    language: request.language,
    leadCapture,
    recentWidgetEvents,
  });

  console.info("[live routing] Evaluated direct conversion routing.", {
    agentId: agent.id,
    sessionKey: request.sessionKey,
    mode: directRouting?.mode || "chat_only",
    intentType: directRouting?.intentType || "",
    ctaType: directRouting?.primaryCta?.ctaType || "",
    suppressReason: directRouting?.suppressReason || "",
  });

  return {
    userMessageCreatedAt,
    leadCapture,
    directRouting,
  };
}

function buildFinalChatResponse({
  supabase,
  request,
  publicContext,
  websiteContent,
  finalReply,
  leadAndRouting,
  services,
}) {
  const {
    agent,
    widgetConfig,
    webCallSession,
  } = publicContext;

  logChatMetadata("response_ready", {
    agentId: agent.id,
    businessId: websiteContent.businessId,
    installId: request.installId,
    sessionKey: request.sessionKey,
    origin: request.origin,
    pageUrl: request.pageUrl,
    messageLength: request.normalizedMessage.length,
    historyCount: request.history.length,
    replyLength: finalReply.length,
    leadCaptureState: leadAndRouting.leadCapture?.state,
    routingMode: leadAndRouting.directRouting?.mode,
  });

  return services.buildChatResponse({
    supabase,
    agent,
    businessId: websiteContent.businessId,
    widgetConfig,
    userMessage: request.message,
    reply: appendImageLines(finalReply, websiteContent, request.message),
    sessionKey: request.sessionKey,
    leadCapture: leadAndRouting.leadCapture,
    directRouting: leadAndRouting.directRouting,
    visitorIdentity: request.visitorIdentity,
    userMessageCreatedAt: leadAndRouting.userMessageCreatedAt,
    storeMessages: services.storeMessages,
    displayMode: request.displayMode,
    conversationSource: request.conversationSource,
    webCallSessionId: webCallSession?.id || "",
  });
}

export async function handleChatRequest({
  supabase,
  openai,
  body,
}, deps = {}) {
  const services = resolveChatServiceDependencies(deps);
  const request = normalizeChatRequestBody(body);
  validateNormalizedChatRequest(request);
  const publicContext = await resolvePublicChatContext({
    supabase,
    request,
    services,
  });
  const capacityContext = await loadChatCapacityContext({
    supabase,
    publicContext,
    services,
  });
  const { websiteContent, billingSnapshot } = capacityContext;

  if (billingSnapshot?.usage?.isCapped) {
    return buildCapacityReachedChatResponse({
      supabase,
      request,
      publicContext,
      services,
    });
  }

  const hotelConciergeActionResponse = await maybeBuildHotelConciergeActionRequestResponse({
    supabase,
    request,
    publicContext,
    services,
  });

  if (hotelConciergeActionResponse) {
    return hotelConciergeActionResponse;
  }

  const quoteRequestResponse = await maybeBuildChatQuoteRequestResponse({
    supabase,
    request,
    publicContext,
    services,
  });

  if (quoteRequestResponse) {
    return quoteRequestResponse;
  }

  const bookingRequestResponse = await maybeBuildChatBookingRequestResponse({
    supabase,
    request,
    publicContext,
    services,
  });

  if (bookingRequestResponse) {
    return bookingRequestResponse;
  }

  if (!websiteContent) {
    return buildNoWebsiteContentResponse({
      supabase,
      request,
      publicContext,
      services,
    });
  }

  if (hasLimitedKnowledge(websiteContent)) {
    return buildLimitedKnowledgeResponse({
      supabase,
      request,
      publicContext,
      websiteContent,
      services,
    });
  }

  const knowledge = await assembleChatKnowledge({
    supabase,
    openai,
    request,
    publicContext,
    websiteContent,
    services,
  });
  const generatedReply = await generateRepairedChatReply({
    supabase,
    request,
    publicContext,
    capacityContext,
    knowledge,
    services,
  });
  const finalReply = applyFinalReplySafetyValidation({
    reply: generatedReply,
    request,
    publicContext,
    knowledge,
  });
  const leadAndRouting = await resolveLeadCaptureAndDirectRouting({
    supabase,
    request,
    publicContext,
    services,
  });

  return buildFinalChatResponse({
    supabase,
    request,
    publicContext,
    websiteContent,
    finalReply,
    leadAndRouting,
    services,
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
  const conversationSource = normalizePublicConversationSource(
    body.conversation_source || body.conversationSource || body.source_type || body.sourceType,
    { displayMode }
  );
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
    displayMode,
    conversationSource,
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
