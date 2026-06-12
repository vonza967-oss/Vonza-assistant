import express from "express";
import QRCode from "qrcode";

import { getOpenAIClient } from "../clients/openaiClient.js";
import { getSupabaseClient } from "../clients/supabaseClient.js";
import { getAuthenticatedUser } from "../services/auth/authService.js";
import {
  claimAgentForOwner,
  createAgentForBusinessName,
  deleteAgent,
  getAgentWorkspaceSnapshot,
  getEffectiveOwnerWorkspaceAccessStatus,
  getWidgetBootstrap,
  listAllAgents,
  listAgents,
  requireActiveAgentAccess,
  requirePreClaimAgentAccess,
  resolveAllowedPublicWidgetContext,
  resolveAgentContext,
  updateAgentAccessStatus,
  updateAgentSettings,
} from "../services/agents/agentService.js";
import {
  recordAdminAuditEvent,
  requireAdminUser,
} from "../services/admin/adminAuthorizationService.js";
import {
  listAdminPhoneNumbersForAgent,
  upsertAdminPhoneNumberAssignment,
} from "../services/phone/phoneNumberService.js";
import { uploadFrontDeskBackground } from "../services/agents/frontDeskBackgroundService.js";
import {
  assertMessagesSchemaReady,
  listAgentMessages,
} from "../services/chat/messageService.js";
import { buildAnalyticsSummary } from "../services/analytics/analyticsSummaryService.js";
import { buildOwnerAnalyticsDashboard } from "../services/analytics/ownerAnalyticsDashboardService.js";
import { getProductFunnelSummary, listWebCallHealthEvents, trackProductEvent } from "../services/analytics/productEventService.js";
import {
  ensureWebCallSession,
  recordWebCallTurnTelemetry,
} from "../services/voice/webCallSessionService.js";
import {
  assertWidgetTelemetrySchemaReady,
  listWidgetRoutingEventsByAgentId,
  trackWidgetEvent,
} from "../services/analytics/widgetTelemetryService.js";
import {
  buildKnowledgeImprovementQueueItemsFromFeedback,
  listVisitorReplyFeedbackForOwner,
  recordOwnerAnswerFeedback,
  updateVisitorReplyFeedbackStatus,
} from "../services/analytics/visitorReplyFeedbackService.js";
import {
  buildActionQueue,
  listActionQueueStatuses,
  updateActionQueueStatus,
} from "../services/analytics/actionQueueService.js";
import {
  createManualFollowUpWorkflow,
  syncFollowUpWorkflows,
  updateFollowUpWorkflow,
} from "../services/followup/followUpService.js";
import {
  buildHumanFollowUpWorkflow,
  listHumanFollowUpStatusRows,
  updateHumanFollowUpStatus,
} from "../services/followup/humanFollowUpWorkflowService.js";
import {
  syncOwnerNotifications,
  updateOwnerNotificationStatus,
} from "../services/notifications/ownerNotificationService.js";
import {
  deleteVisitorOrCustomerRecords,
  exportAgentPrivacyData,
  getPrivacySettings,
  savePrivacySettings,
} from "../services/privacy/privacyControlService.js";
import {
  syncKnowledgeFixWorkflows,
  updateKnowledgeFixWorkflow,
} from "../services/knowledge/knowledgeFixService.js";
import {
  KNOWLEDGE_FILE_UPLOAD_LIMITS,
  archiveKnowledgeFile,
  listKnowledgeFiles,
  uploadKnowledgeFile,
} from "../services/knowledge/knowledgeFileService.js";
import {
  assertConversionOutcomeSchemaReady,
  detectConversionOutcomesForPage,
  listConversionOutcomesForAgent,
  markManualConversionOutcome,
  recordTrackedCtaClick,
  trackFollowUpOutcome,
} from "../services/conversion/conversionOutcomeService.js";
import {
  assertLeadCaptureSchemaReady,
  hydrateActionQueueWithLeadCaptures,
  listLeadCaptures,
} from "../services/leads/liveLeadCaptureService.js";
import {
  buildBillingSyncPayloadFromCheckoutSession,
  buildBillingSyncPayloadFromSubscription,
  changeStripeSubscriptionPlan,
  createHostedCheckoutSession,
  constructStripeWebhookEvent,
  getStripeCheckoutConfigurationErrorMessage,
  isStripeConfigError,
  isStripeCheckoutMinimumAmountError,
  verifySuccessfulCheckout,
} from "../services/billing/checkoutService.js";
import { logStripeEntitlementShadow } from "../services/billing/stripeEntitlementShadowService.js";
import {
  getOwnerBillingRecord,
  getOwnerBillingSnapshot,
  simulateOwnerBillingActivation,
  syncOwnerBillingState,
} from "../services/billing/billingUsageService.js";
import { activatePilotWidgetPlan } from "../services/billing/pilotWidgetPlanService.js";
import { getPublicAppUrl, isLocalDevBillingRequestAllowed } from "../config/env.js";
import {
  extractBusinessWebsiteContent,
  getStoredWebsiteContent,
} from "../services/scraping/websiteContentService.js";
import {
  getBusinessWebsiteImportStatus,
  importBusinessWebsiteKnowledge,
} from "../services/scraping/websiteImportCoordinator.js";
import {
  recordInstallPing,
  verifyAgentInstallation,
} from "../services/install/installPresenceService.js";
import { buildFullPageAssistantUrl } from "../services/install/fullPageAssistantUrlService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";
import {
  assertPublicRequestOriginConsistency,
  isPublicRequestOriginConsistencyError,
} from "../utils/publicRequestOriginConsistency.js";
import {
  approveCalendarAction,
  approveCampaignDraft,
  completeGoogleConnection,
  createOperatorTask,
  createCampaignDraft,
  createGoogleConnectionStart,
  disconnectGoogleConnection,
  draftCalendarAction,
  draftInboxReply,
  getOperatorWorkspaceSnapshot,
  resolveCalendarAppointmentReview,
  sendDueCampaignSteps,
  sendInboxReply,
  updateOperatorTaskStatus,
} from "../services/operator/operatorWorkspaceService.js";
import { updateOperatorOnboardingState } from "../services/operator/operatorActivationService.js";
import { updateOperatorContactLifecycleState } from "../services/operator/contactWorkspaceService.js";
import {
  attachBusinessProfilePrefill,
  getOperatorBusinessProfile,
  upsertOperatorBusinessProfile,
} from "../services/operator/operatorBusinessProfileService.js";
import {
  applyTodayCopilotProposal,
  dismissTodayCopilotProposal,
  findTodayCopilotProposal,
} from "../services/operator/copilotProposalService.js";
import {
  PRODUCT_HELP_UNAVAILABLE_MESSAGE,
  answerVonzaProductHelp,
} from "../services/support/productHelpService.js";
import { handleChatRequest } from "../services/chat/chatService.js";
import {
  listFrontDeskTrainingItems,
  saveFrontDeskTrainingItem,
  selectRelevantPracticeAnswers,
  updateFrontDeskTrainingItemStatus,
} from "../services/training/frontDeskTrainingService.js";
import {
  countActiveKnowledgeChunks,
  reindexFrontDeskKnowledge,
  syncApprovedAnswerKnowledgeChunk,
} from "../services/rag/frontDeskRagService.js";
import {
  listAgentActionRequests,
  updateAgentActionRequestStatus,
} from "../services/actions/agentActionRequestService.js";
import { getActionRequestDefinition } from "../services/actions/actionRequestRegistry.js";
import {
  listAgentBookingRequests,
  updateAgentBookingRequestStatus,
} from "../services/bookings/agentBookingRequestService.js";
import {
  createBookingWebhookEndpointToken,
  createBookingWebhookSigningSecret,
  provisionCalendlyBookingIntegration,
} from "../services/bookings/bookingIntegrationService.js";
import {
  createCalendlyWebhookSubscription,
  isCalendlyWebhookSubscriptionConfigured,
} from "../services/bookings/calendlyWebhookSubscriptionService.js";
import {
  listAgentQuoteRequests,
  updateAgentQuoteRequestStatus,
} from "../services/quotes/agentQuoteRequestService.js";
import {
  listConnectedAppCapabilities,
} from "../services/integrations/connectedAppRegistry.js";
import {
  createConnectedAppConnection,
  enableConnectedAppForAgent,
  listAgentConnectedAppEnablements,
  listConnectedAppConnections,
  updateAgentConnectedAppEnablement,
  updateConnectedAppConnectionStatus,
} from "../services/integrations/connectedAppConnectionService.js";
import {
  listConnectedAppInboundEvents,
} from "../services/integrations/connectedAppInboundEventService.js";
import {
  listConnectedAppInboundThreads,
  updateConnectedAppInboundThreadStatus,
} from "../services/integrations/connectedAppInboundThreadService.js";
import {
  getWhatsAppManualReplyFeatureStatus,
  sendWhatsAppManualReply,
} from "../services/integrations/whatsappManualReplyService.js";
import {
  createWhatsAppAiReplyDraft,
  getWhatsAppAiReplyDraftFeatureStatus,
} from "../services/integrations/whatsappAiReplyDraftService.js";
import {
  buildConnectedAppReadinessContext,
} from "../services/integrations/connectedAppReadinessContextService.js";
import {
  evaluateConnectedAppReadiness,
} from "../services/integrations/connectedAppReadinessService.js";
import {
  getDashboardPreferences,
  normalizeDashboardLanguage,
  saveDashboardLanguagePreference,
} from "../services/dashboard/dashboardPreferenceService.js";
import {
  getActivationWizardState,
  updateActivationWizardProgress,
} from "../services/activation/activationWizardService.js";
import { cleanText } from "../utils/text.js";
import {
  createTrackOwnerProductEvent,
  expandGroupedFollowUpItems,
  getCheckoutDraftBusinessName,
  readBodyField,
  readMultipartBackgroundFile,
  readMultipartKnowledgeFile,
} from "./agentRouteHelpers.js";

const CONNECTED_APP_ROUTE_UNSAFE_FIELD_NAMES = new Set([
  "accessToken",
  "access_token",
  "appSecret",
  "app_secret",
  "apiKey",
  "api_key",
  "authUrl",
  "auth_url",
  "authorizationCode",
  "authorization_code",
  "authorizationUrl",
  "authorization_url",
  "bearerToken",
  "bearer_token",
  "body",
  "businessIntegrationSystemUserToken",
  "business_integration_system_user_token",
  "callbackUrl",
  "callback_url",
  "callable",
  "client",
  "clientSecret",
  "client_secret",
  "cloudApiAccessToken",
  "cloud_api_access_token",
  "cloudApiUrl",
  "cloud_api_url",
  "encryptedToken",
  "encrypted_token",
  "embeddedSignupUrl",
  "embedded_signup_url",
  "endpointUrl",
  "endpoint_url",
  "execute",
  "executionRequested",
  "execution_requested",
  "executor",
  "externalExecution",
  "external_execution",
  "handler",
  "handlers",
  "handoff",
  "aiDraft",
  "ai_draft",
  "chatHandoff",
  "chat_handoff",
  "message",
  "messageBody",
  "message_body",
  "oauthUrl",
  "oauth_url",
  "providerClient",
  "provider_client",
  "providerUrl",
  "provider_url",
  "providers",
  "publicChatCallable",
  "public_chat_callable",
  "permanentAccessToken",
  "permanent_access_token",
  "refreshToken",
  "refresh_token",
  "reply",
  "replyText",
  "reply_text",
  "runtimeHandler",
  "runtime_handler",
  "send",
  "sendMessage",
  "send_message",
  "secret",
  "secrets",
  "setupUrl",
  "setup_url",
  "signingSecret",
  "signing_secret",
  "systemUserAccessToken",
  "system_user_access_token",
  "token",
  "tokenSecretRef",
  "token_secret_ref",
  "tokens",
  "text",
  "verifyToken",
  "verify_token",
  "whatsappAccessToken",
  "whatsapp_access_token",
  "whatsappToken",
  "whatsapp_token",
  "webhookEndpoint",
  "webhook_endpoint",
  "webhookEndpointUrl",
  "webhook_endpoint_url",
  "webhookSecret",
  "webhook_secret",
  "webhookUrl",
  "webhook_url",
]);
const CALENDLY_CONNECTED_APP_PROVIDER = "calendly";
const CALENDLY_CONNECTED_APP_KEY = "calendly.booking";
const CALENDLY_CONNECTED_APP_CAPABILITY = "calendly.booking.webhook";
const CALENDLY_CONNECT_ALLOWED_FIELD_NAMES = new Set([
  "booking_url",
  "bookingurl",
  "client_id",
  "clientid",
]);

function buildConnectedAppRouteError(message, statusCode = 400, code = "connected_app_route_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertCalendlyConnectRouteInput(value, path = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeConnectedAppRouteFieldName(key);

    if (
      CONNECTED_APP_ROUTE_UNSAFE_FIELD_NAMES.has(key)
      || CONNECTED_APP_ROUTE_UNSAFE_FIELD_NAMES.has(normalizedKey)
      || !CALENDLY_CONNECT_ALLOWED_FIELD_NAMES.has(normalizedKey)
    ) {
      throw buildConnectedAppRouteError(
        `Calendly connect API does not accept field '${path}.${key}'.`,
        400,
        "calendly_connect_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      throw buildConnectedAppRouteError(
        `Calendly connect API does not accept nested field '${path}.${key}'.`,
        400,
        "calendly_connect_field_rejected"
      );
    }
  }
}

function normalizeCalendlyBookingUrl(value = "") {
  const rawValue = cleanText(value);

  if (!rawValue) {
    return "";
  }

  try {
    const parsed = new URL(rawValue);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (parsed.protocol !== "https:" || (hostname !== "calendly.com" && !hostname.endsWith(".calendly.com"))) {
      return "";
    }

    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function normalizePublicHttpsBaseUrl(value = "") {
  const rawValue = cleanText(value).replace(/\/$/, "");

  if (!rawValue) {
    return "";
  }

  try {
    const parsed = new URL(rawValue);
    const hostname = parsed.hostname.toLowerCase();

    if (
      parsed.protocol !== "https:"
      || hostname === "localhost"
      || hostname === "0.0.0.0"
      || hostname === "127.0.0.1"
      || hostname.endsWith(".local")
    ) {
      return "";
    }

    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_error) {
    return "";
  }
}

function assertNoConnectedAppRouteUnsafeInput(value, path = "body") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (CONNECTED_APP_ROUTE_UNSAFE_FIELD_NAMES.has(key)) {
      throw buildConnectedAppRouteError(
        `Connected app API does not accept secret, OAuth URL, or execution field '${path}.${key}'.`,
        400,
        "connected_app_secret_or_execution_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      assertNoConnectedAppRouteUnsafeInput(nestedValue, `${path}.${key}`);
    }
  }
}

const CONNECTED_APP_REPLY_ALLOWED_FIELD_NAMES = new Set([
  "agent_id",
  "agentid",
  "capability_key",
  "capabilitykey",
  "message_text",
  "messagetext",
  "message_type",
  "messagetype",
  "template_language",
  "templatelanguage",
  "template_name",
  "templatename",
  "thread_id",
  "threadid",
]);

const CONNECTED_APP_AI_DRAFT_ALLOWED_FIELD_NAMES = new Set([
  "agent_id",
  "agentid",
  "instructions",
  "locale",
  "staff_instructions",
  "staffinstructions",
  "thread_id",
  "threadid",
  "tone",
]);

function normalizeConnectedAppRouteFieldName(value) {
  return cleanText(value).replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase();
}

function assertConnectedAppReplyRouteInput(value, path = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeConnectedAppRouteFieldName(key);

    if (!CONNECTED_APP_REPLY_ALLOWED_FIELD_NAMES.has(normalizedKey)) {
      throw buildConnectedAppRouteError(
        `Connected app reply API does not accept field '${path}.${key}'.`,
        400,
        "connected_app_reply_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      throw buildConnectedAppRouteError(
        `Connected app reply API does not accept nested field '${path}.${key}'.`,
        400,
        "connected_app_reply_field_rejected"
      );
    }
  }
}

function assertConnectedAppAiDraftRouteInput(value, path = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeConnectedAppRouteFieldName(key);

    if (!CONNECTED_APP_AI_DRAFT_ALLOWED_FIELD_NAMES.has(normalizedKey)) {
      throw buildConnectedAppRouteError(
        `Connected app AI draft API does not accept field '${path}.${key}'.`,
        400,
        "connected_app_ai_draft_field_rejected"
      );
    }

    if (nestedValue && typeof nestedValue === "object") {
      throw buildConnectedAppRouteError(
        `Connected app AI draft API does not accept nested field '${path}.${key}'.`,
        400,
        "connected_app_ai_draft_field_rejected"
      );
    }
  }
}

function readOptionalBoolean(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = cleanText(value).toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw buildConnectedAppRouteError(`${fieldName} must be a boolean value.`, 400);
}

function readBooleanFlag(value) {
  return readOptionalBoolean(value, "flag") === true;
}

function normalizeRouteList(value) {
  const rawItems = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];

  return rawItems.flatMap((item) =>
    String(item || "")
      .split(",")
      .map((part) => cleanText(part))
      .filter(Boolean)
  );
}

function readBodyList(body, snakeCaseKey, camelCaseKey, fallbackKey) {
  const value = readBodyField(body, snakeCaseKey, camelCaseKey);

  return normalizeRouteList(value === undefined && fallbackKey ? body[fallbackKey] : value);
}

function hasBodyField(body, snakeCaseKey, camelCaseKey, fallbackKey) {
  return Object.prototype.hasOwnProperty.call(body, snakeCaseKey)
    || (camelCaseKey && Object.prototype.hasOwnProperty.call(body, camelCaseKey))
    || (fallbackKey && Object.prototype.hasOwnProperty.call(body, fallbackKey));
}

function readQueryList(query, snakeCaseKey, camelCaseKey) {
  const value = Object.prototype.hasOwnProperty.call(query, snakeCaseKey)
    ? query[snakeCaseKey]
    : query[camelCaseKey];

  return normalizeRouteList(value);
}

function sanitizeConnectedAppCapability(definition = {}) {
  return {
    key: definition.key,
    provider: definition.provider,
    appName: definition.appName,
    capability: definition.capability,
    label: definition.label,
    description: definition.description,
    status: definition.status,
    ownerScoped: definition.ownerScoped === true,
    agentScoped: definition.agentScoped === true,
    requiresOAuth: definition.requiresOAuth === true,
    requiresWebhook: definition.requiresWebhook === true,
    requiresSecret: definition.requiresSecret === true,
    externalExecution: definition.externalExecution === true,
    publicChatCallable: definition.publicChatCallable === true,
    packageActivatable: definition.packageActivatable === true,
    allowedSurfaces: Array.isArray(definition.allowedSurfaces) ? [...definition.allowedSurfaces] : [],
    proofSources: Array.isArray(definition.proofSources) ? [...definition.proofSources] : [],
    existingCodeRefs: Array.isArray(definition.existingCodeRefs) ? [...definition.existingCodeRefs] : [],
    safetyNotes: Array.isArray(definition.safetyNotes) ? [...definition.safetyNotes] : [],
  };
}

function shouldIncludeConnectedAppReadiness(query = {}) {
  return readBooleanFlag(query.readiness)
    || readBooleanFlag(query.include_readiness)
    || readBooleanFlag(query.includeReadiness)
    || readQueryList(query, "required_capabilities", "requiredCapabilities").length > 0
    || readQueryList(query, "optional_capabilities", "optionalCapabilities").length > 0;
}

async function buildConnectedAppReadinessRoutePayload({
  supabase,
  ownerUserId,
  agentId,
  query = {},
  buildConnectedAppReadinessContextImpl,
  evaluateConnectedAppReadinessImpl,
}) {
  const context = await buildConnectedAppReadinessContextImpl(supabase, {
    ownerUserId,
    agentId,
    packageKey: query.package_key || query.packageKey,
    requiredCapabilities: readQueryList(query, "required_capabilities", "requiredCapabilities"),
    optionalCapabilities: readQueryList(query, "optional_capabilities", "optionalCapabilities"),
    surface: query.surface,
    executionRequested: readOptionalBoolean(
      query.execution_requested ?? query.executionRequested,
      "execution_requested"
    ) === true,
  });
  const report = evaluateConnectedAppReadinessImpl({
    packageKey: query.package_key || query.packageKey,
    agentId,
    ...context,
  });

  return {
    context,
    report,
  };
}

export function createAgentRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const listAgentsImpl = deps.listAgents || listAgents;
  const getWidgetBootstrapImpl = deps.getWidgetBootstrap || getWidgetBootstrap;
  const createAgentForBusinessNameImpl = deps.createAgentForBusinessName || createAgentForBusinessName;
  const requirePreClaimAgentAccessImpl = deps.requirePreClaimAgentAccess || deps.requireAgentAccess || requirePreClaimAgentAccess;
  const requireActiveAgentAccessImpl = deps.requireActiveAgentAccess || requireActiveAgentAccess;
  const resolveAllowedPublicWidgetContextImpl =
    deps.resolveAllowedPublicWidgetContext || resolveAllowedPublicWidgetContext;
  const assertMessagesSchemaReadyImpl = deps.assertMessagesSchemaReady || assertMessagesSchemaReady;
  const assertWidgetTelemetrySchemaReadyImpl =
    deps.assertWidgetTelemetrySchemaReady || assertWidgetTelemetrySchemaReady;
  const assertLeadCaptureSchemaReadyImpl =
    deps.assertLeadCaptureSchemaReady || assertLeadCaptureSchemaReady;
  const assertConversionOutcomeSchemaReadyImpl =
    deps.assertConversionOutcomeSchemaReady || assertConversionOutcomeSchemaReady;
  const listAgentMessagesImpl = deps.listAgentMessages || listAgentMessages;
  const buildActionQueueImpl = deps.buildActionQueue || buildActionQueue;
  const listActionQueueStatusesImpl = deps.listActionQueueStatuses || listActionQueueStatuses;
  const updateActionQueueStatusImpl = deps.updateActionQueueStatus || updateActionQueueStatus;
  const syncFollowUpWorkflowsImpl = deps.syncFollowUpWorkflows || syncFollowUpWorkflows;
  const createManualFollowUpWorkflowImpl = deps.createManualFollowUpWorkflow || createManualFollowUpWorkflow;
  const updateFollowUpWorkflowImpl = deps.updateFollowUpWorkflow || updateFollowUpWorkflow;
  const listHumanFollowUpStatusRowsImpl =
    deps.listHumanFollowUpStatusRows || listHumanFollowUpStatusRows;
  const buildHumanFollowUpWorkflowImpl =
    deps.buildHumanFollowUpWorkflow || buildHumanFollowUpWorkflow;
  const updateHumanFollowUpStatusImpl =
    deps.updateHumanFollowUpStatus || updateHumanFollowUpStatus;
  const syncOwnerNotificationsImpl =
    deps.syncOwnerNotifications || syncOwnerNotifications;
  const updateOwnerNotificationStatusImpl =
    deps.updateOwnerNotificationStatus || updateOwnerNotificationStatus;
  const getPrivacySettingsImpl = deps.getPrivacySettings || getPrivacySettings;
  const savePrivacySettingsImpl = deps.savePrivacySettings || savePrivacySettings;
  const exportAgentPrivacyDataImpl = deps.exportAgentPrivacyData || exportAgentPrivacyData;
  const deleteVisitorOrCustomerRecordsImpl =
    deps.deleteVisitorOrCustomerRecords || deleteVisitorOrCustomerRecords;
  const syncKnowledgeFixWorkflowsImpl = deps.syncKnowledgeFixWorkflows || syncKnowledgeFixWorkflows;
  const updateKnowledgeFixWorkflowImpl = deps.updateKnowledgeFixWorkflow || updateKnowledgeFixWorkflow;
  const listKnowledgeFilesImpl = deps.listKnowledgeFiles || listKnowledgeFiles;
  const uploadKnowledgeFileImpl = deps.uploadKnowledgeFile || uploadKnowledgeFile;
  const archiveKnowledgeFileImpl = deps.archiveKnowledgeFile || archiveKnowledgeFile;
  const listConversionOutcomesForAgentImpl =
    deps.listConversionOutcomesForAgent || listConversionOutcomesForAgent;
  const recordTrackedCtaClickImpl = deps.recordTrackedCtaClick || recordTrackedCtaClick;
  const detectConversionOutcomesForPageImpl =
    deps.detectConversionOutcomesForPage || detectConversionOutcomesForPage;
  const markManualConversionOutcomeImpl =
    deps.markManualConversionOutcome || markManualConversionOutcome;
  const trackFollowUpOutcomeImpl = deps.trackFollowUpOutcome || trackFollowUpOutcome;
  const listLeadCapturesImpl = deps.listLeadCaptures || listLeadCaptures;
  const listWidgetRoutingEventsByAgentIdImpl =
    deps.listWidgetRoutingEventsByAgentId || listWidgetRoutingEventsByAgentId;
  const recordInstallPingImpl = deps.recordInstallPing || recordInstallPing;
  const trackWidgetEventImpl = deps.trackWidgetEvent || trackWidgetEvent;
  const listVisitorReplyFeedbackForOwnerImpl =
    deps.listVisitorReplyFeedbackForOwner || listVisitorReplyFeedbackForOwner;
  const recordOwnerAnswerFeedbackImpl =
    deps.recordOwnerAnswerFeedback || recordOwnerAnswerFeedback;
  const updateVisitorReplyFeedbackStatusImpl =
    deps.updateVisitorReplyFeedbackStatus || updateVisitorReplyFeedbackStatus;
  const trackProductEventImpl = deps.trackProductEvent || trackProductEvent;
  const listWebCallHealthEventsImpl = deps.listWebCallHealthEvents || listWebCallHealthEvents;
  const requireAdminUserImpl = deps.requireAdminUser || requireAdminUser;
  const recordAdminAuditEventImpl = deps.recordAdminAuditEvent || recordAdminAuditEvent;
  const listAdminPhoneNumbersForAgentImpl =
    deps.listAdminPhoneNumbersForAgent || listAdminPhoneNumbersForAgent;
  const upsertAdminPhoneNumberAssignmentImpl =
    deps.upsertAdminPhoneNumberAssignment || upsertAdminPhoneNumberAssignment;
  const updateAgentSettingsImpl = deps.updateAgentSettings || updateAgentSettings;
  const uploadFrontDeskBackgroundImpl =
    deps.uploadFrontDeskBackground || uploadFrontDeskBackground;
  const listFrontDeskTrainingItemsImpl =
    deps.listFrontDeskTrainingItems || listFrontDeskTrainingItems;
  const saveFrontDeskTrainingItemImpl =
    deps.saveFrontDeskTrainingItem || saveFrontDeskTrainingItem;
  const selectRelevantPracticeAnswersImpl =
    deps.selectRelevantPracticeAnswers || selectRelevantPracticeAnswers;
  const updateFrontDeskTrainingItemStatusImpl =
    deps.updateFrontDeskTrainingItemStatus || updateFrontDeskTrainingItemStatus;
  const reindexFrontDeskKnowledgeImpl =
    deps.reindexFrontDeskKnowledge || reindexFrontDeskKnowledge;
  const syncApprovedAnswerKnowledgeChunkImpl =
    deps.syncApprovedAnswerKnowledgeChunk || syncApprovedAnswerKnowledgeChunk;
  const countActiveKnowledgeChunksImpl =
    deps.countActiveKnowledgeChunks || countActiveKnowledgeChunks;
  const handleChatRequestImpl = deps.handleChatRequest || handleChatRequest;
  const getActivationWizardStateImpl = deps.getActivationWizardState || getActivationWizardState;
  const updateActivationWizardProgressImpl =
    deps.updateActivationWizardProgress || updateActivationWizardProgress;
  const deleteAgentImpl = deps.deleteAgent || deleteAgent;
  const resolveAgentContextImpl = deps.resolveAgentContext || resolveAgentContext;
  const getAgentWorkspaceSnapshotImpl = deps.getAgentWorkspaceSnapshot || getAgentWorkspaceSnapshot;
  const getEffectiveOwnerWorkspaceAccessStatusImpl =
    deps.getEffectiveOwnerWorkspaceAccessStatus || getEffectiveOwnerWorkspaceAccessStatus;
  const extractBusinessWebsiteContentImpl = deps.extractBusinessWebsiteContent || extractBusinessWebsiteContent;
  const importBusinessWebsiteKnowledgeImpl =
    deps.importBusinessWebsiteKnowledge || importBusinessWebsiteKnowledge;
  const getBusinessWebsiteImportStatusImpl =
    deps.getBusinessWebsiteImportStatus || getBusinessWebsiteImportStatus;
  const getStoredWebsiteContentImpl = deps.getStoredWebsiteContent || getStoredWebsiteContent;
  const getOwnerBillingRecordImpl = deps.getOwnerBillingRecord || getOwnerBillingRecord;
  const getOwnerBillingSnapshotImpl = deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot;
  const simulateOwnerBillingActivationImpl =
    deps.simulateOwnerBillingActivation || simulateOwnerBillingActivation;
  const syncOwnerBillingStateImpl = deps.syncOwnerBillingState || syncOwnerBillingState;
  const activatePilotWidgetPlanImpl = deps.activatePilotWidgetPlan || activatePilotWidgetPlan;
  const createHostedCheckoutSessionImpl =
    deps.createHostedCheckoutSession || createHostedCheckoutSession;
  const buildBillingSyncPayloadFromCheckoutSessionImpl =
    deps.buildBillingSyncPayloadFromCheckoutSession || buildBillingSyncPayloadFromCheckoutSession;
  const buildBillingSyncPayloadFromSubscriptionImpl =
    deps.buildBillingSyncPayloadFromSubscription || buildBillingSyncPayloadFromSubscription;
  const changeStripeSubscriptionPlanImpl =
    deps.changeStripeSubscriptionPlan || changeStripeSubscriptionPlan;
  const constructStripeWebhookEventImpl = deps.constructStripeWebhookEvent || constructStripeWebhookEvent;
  const logStripeEntitlementShadowImpl =
    deps.logStripeEntitlementShadow || logStripeEntitlementShadow;
  const getOperatorWorkspaceSnapshotImpl =
    deps.getOperatorWorkspaceSnapshot || getOperatorWorkspaceSnapshot;
  const createGoogleConnectionStartImpl =
    deps.createGoogleConnectionStart || createGoogleConnectionStart;
  const completeGoogleConnectionImpl =
    deps.completeGoogleConnection || completeGoogleConnection;
  const disconnectGoogleConnectionImpl =
    deps.disconnectGoogleConnection || disconnectGoogleConnection;
  const draftInboxReplyImpl =
    deps.draftInboxReply || draftInboxReply;
  const sendInboxReplyImpl =
    deps.sendInboxReply || sendInboxReply;
  const draftCalendarActionImpl =
    deps.draftCalendarAction || draftCalendarAction;
  const approveCalendarActionImpl =
    deps.approveCalendarAction || approveCalendarAction;
  const createCampaignDraftImpl =
    deps.createCampaignDraft || createCampaignDraft;
  const approveCampaignDraftImpl =
    deps.approveCampaignDraft || approveCampaignDraft;
  const sendDueCampaignStepsImpl =
    deps.sendDueCampaignSteps || sendDueCampaignSteps;
  const createOperatorTaskImpl =
    deps.createOperatorTask || createOperatorTask;
  const updateOperatorTaskStatusImpl =
    deps.updateOperatorTaskStatus || updateOperatorTaskStatus;
  const resolveCalendarAppointmentReviewImpl =
    deps.resolveCalendarAppointmentReview || resolveCalendarAppointmentReview;
  const updateOperatorContactLifecycleStateImpl =
    deps.updateOperatorContactLifecycleState || updateOperatorContactLifecycleState;
  const updateOperatorOnboardingStateImpl =
    deps.updateOperatorOnboardingState || updateOperatorOnboardingState;
  const getOperatorBusinessProfileImpl =
    deps.getOperatorBusinessProfile || getOperatorBusinessProfile;
  const upsertOperatorBusinessProfileImpl =
    deps.upsertOperatorBusinessProfile || upsertOperatorBusinessProfile;
  const applyTodayCopilotProposalImpl =
    deps.applyTodayCopilotProposal || applyTodayCopilotProposal;
  const dismissTodayCopilotProposalImpl =
    deps.dismissTodayCopilotProposal || dismissTodayCopilotProposal;
  const findTodayCopilotProposalImpl =
    deps.findTodayCopilotProposal || findTodayCopilotProposal;
  const answerVonzaProductHelpImpl =
    deps.answerVonzaProductHelp || answerVonzaProductHelp;
  const getDashboardPreferencesImpl =
    deps.getDashboardPreferences || getDashboardPreferences;
  const saveDashboardLanguagePreferenceImpl =
    deps.saveDashboardLanguagePreference || saveDashboardLanguagePreference;
  const listAgentActionRequestsImpl =
    deps.listAgentActionRequests || listAgentActionRequests;
  const updateAgentActionRequestStatusImpl =
    deps.updateAgentActionRequestStatus || updateAgentActionRequestStatus;
  const listAgentBookingRequestsImpl =
    deps.listAgentBookingRequests || listAgentBookingRequests;
  const updateAgentBookingRequestStatusImpl =
    deps.updateAgentBookingRequestStatus || updateAgentBookingRequestStatus;
  const provisionCalendlyBookingIntegrationImpl =
    deps.provisionCalendlyBookingIntegration || provisionCalendlyBookingIntegration;
  const createCalendlyWebhookSubscriptionImpl =
    deps.createCalendlyWebhookSubscription || createCalendlyWebhookSubscription;
  const isCalendlyWebhookSubscriptionConfiguredImpl =
    deps.isCalendlyWebhookSubscriptionConfigured || isCalendlyWebhookSubscriptionConfigured;
  const listAgentQuoteRequestsImpl =
    deps.listAgentQuoteRequests || listAgentQuoteRequests;
  const updateAgentQuoteRequestStatusImpl =
    deps.updateAgentQuoteRequestStatus || updateAgentQuoteRequestStatus;
  const listConnectedAppCapabilitiesImpl =
    deps.listConnectedAppCapabilities || listConnectedAppCapabilities;
  const createConnectedAppConnectionImpl =
    deps.createConnectedAppConnection || createConnectedAppConnection;
  const listConnectedAppConnectionsImpl =
    deps.listConnectedAppConnections || listConnectedAppConnections;
  const updateConnectedAppConnectionStatusImpl =
    deps.updateConnectedAppConnectionStatus || updateConnectedAppConnectionStatus;
  const listConnectedAppInboundThreadsImpl =
    deps.listConnectedAppInboundThreads || listConnectedAppInboundThreads;
  const updateConnectedAppInboundThreadStatusImpl =
    deps.updateConnectedAppInboundThreadStatus || updateConnectedAppInboundThreadStatus;
  const sendWhatsAppManualReplyImpl =
    deps.sendWhatsAppManualReply || sendWhatsAppManualReply;
  const getWhatsAppManualReplyFeatureStatusImpl =
    deps.getWhatsAppManualReplyFeatureStatus || getWhatsAppManualReplyFeatureStatus;
  const createWhatsAppAiReplyDraftImpl =
    deps.createWhatsAppAiReplyDraft || createWhatsAppAiReplyDraft;
  const getWhatsAppAiReplyDraftFeatureStatusImpl =
    deps.getWhatsAppAiReplyDraftFeatureStatus || getWhatsAppAiReplyDraftFeatureStatus;
  const listConnectedAppInboundEventsImpl =
    deps.listConnectedAppInboundEvents || listConnectedAppInboundEvents;
  const enableConnectedAppForAgentImpl =
    deps.enableConnectedAppForAgent || enableConnectedAppForAgent;
  const listAgentConnectedAppEnablementsImpl =
    deps.listAgentConnectedAppEnablements || listAgentConnectedAppEnablements;
  const updateAgentConnectedAppEnablementImpl =
    deps.updateAgentConnectedAppEnablement || updateAgentConnectedAppEnablement;
  const buildConnectedAppReadinessContextImpl =
    deps.buildConnectedAppReadinessContext || buildConnectedAppReadinessContext;
  const evaluateConnectedAppReadinessImpl =
    deps.evaluateConnectedAppReadiness || evaluateConnectedAppReadiness;
  const getActionRequestDefinitionImpl =
    deps.getActionRequestDefinition || getActionRequestDefinition;
  const getPublicAppUrlImpl = deps.getPublicAppUrl || getPublicAppUrl;
  const trackOwnerProductEvent = createTrackOwnerProductEvent(trackProductEventImpl);
  const limitWidgetBootstrap =
    deps.limitWidgetBootstrap || createRateLimitMiddleware("widget_bootstrap");
  const limitPublicInstallSignal =
    deps.limitPublicInstallSignal || createRateLimitMiddleware("public_install_signal");
  const limitPublicInstallCta =
    deps.limitPublicInstallCta || createRateLimitMiddleware("public_install_cta");
  const limitAuthAdjacent =
    deps.limitAuthAdjacent || createRateLimitMiddleware("auth_adjacent");
  const limitInstallVerify =
    deps.limitInstallVerify || createRateLimitMiddleware("install_verify");
  const sendRouteError = (req, res, err, context = {}) => {
    const requestId = getRequestId(req);
    logRouteError(err, req, context);
    sendJsonError(res, err, { requestId });
  };
  async function requireAdminAccess(supabase, req, action, metadata = {}) {
    const adminUser = await requireAdminUserImpl(supabase, req, authenticateUser, {
      env: process.env,
    });

    await recordAdminAuditEventImpl(supabase, {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action,
      metadata,
    }).catch((error) => {
      console.warn("[admin audit] failed", {
        action,
        adminUserId: adminUser.id,
        message: error?.message || "Audit failed",
      });
    });

    return adminUser;
  }

  async function getOptionalAuthenticatedUser(supabase, req) {
    return authenticateUser(supabase, req).catch((error) => {
      if (error.statusCode === 401) {
        return null;
      }
      throw error;
    });
  }

  function buildActionRequestRouteError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  function buildBookingRequestRouteError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  function buildQuoteRequestRouteError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  function buildActionRequestSummary(records = []) {
    const summary = {
      total: 0,
      new: 0,
      accepted: 0,
      done: 0,
      dismissed: 0,
    };

    records.forEach((record) => {
      const status = cleanText(record?.status).toLowerCase();
      summary.total += 1;
      if (Object.prototype.hasOwnProperty.call(summary, status)) {
        summary[status] += 1;
      }
    });

    return summary;
  }

  function isMissingActionRequestsSchemaError(error = {}) {
    const message = cleanText(error.message || "").toLowerCase();
    return (
      error.code === "PGRST205"
      || error.code === "PGRST204"
      || error.code === "42P01"
      || message.includes("agent_action_requests")
    );
  }

  function enrichActionRequestForDashboard(record = {}) {
    const definition = getActionRequestDefinitionImpl(record.requestType || record.request_type);

    return {
      ...record,
      actionLabel: cleanText(definition?.label) || cleanText(record.requestType || record.request_type) || "Staff request",
      actionDescription: cleanText(definition?.description),
    };
  }

  async function runStripeEntitlementShadow(input = {}) {
    try {
      await logStripeEntitlementShadowImpl(input);
    } catch (error) {
      console.warn("[stripe entitlement shadow] failed", {
        event_id: cleanText(input.eventId) || null,
        event_type: cleanText(input.eventType) || null,
        owner_user_id: cleanText(input.ownerUserId) || null,
        subscription_id: cleanText(input.subscription?.id) || null,
        customer_id: cleanText(input.subscription?.customer) || null,
        message: cleanText(error?.message || "Shadow logging failed."),
      });
    }
  }

  router.post("/stripe/webhook", async (req, res) => {
    try {
      const supabase = getSupabase();
      const event = constructStripeWebhookEventImpl({
        payload: req.body,
        signature: req.headers["stripe-signature"],
      });

      if (event.type === "checkout.session.completed") {
        const checkoutSession = event.data?.object;
        const billingPayload = await buildBillingSyncPayloadFromCheckoutSessionImpl(
          checkoutSession
        );

        if (billingPayload) {
          await syncOwnerBillingStateImpl(supabase, billingPayload);
        }

        if (checkoutSession?.subscription && typeof checkoutSession.subscription === "object") {
          await runStripeEntitlementShadow({
            eventId: event.id,
            eventType: event.type,
            ownerUserId: billingPayload?.ownerUserId,
            subscription: checkoutSession.subscription,
          });
        }
        // Otherwise checkout sync retrieves the subscription internally but does not expose
        // it here. Phase 6G intentionally avoids adding a second Stripe retrieval for logs.
      } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const subscription = event.data?.object;
        const billingPayload = await buildBillingSyncPayloadFromSubscriptionImpl(
          subscription
        );

        if (billingPayload) {
          await syncOwnerBillingStateImpl(supabase, billingPayload);
        }

        await runStripeEntitlementShadow({
          eventId: event.id,
          eventType: event.type,
          ownerUserId: billingPayload?.ownerUserId,
          subscription,
        });
      }

      res.json({ received: true });
    } catch (err) {
      if (err?.type === "StripeSignatureVerificationError" || err?.message?.includes("signature")) {
        console.warn("[stripe webhook] Signature verification failed:", err.message);
      } else if (isStripeConfigError(err)) {
        console.warn("[stripe webhook] Stripe webhook configuration error:", err.message);
      } else {
        console.error(err);
      }
      res.status(err.statusCode || 400).json({
        error: err.message || "Webhook error",
      });
    }
  });

  router.get("/widget/bootstrap", limitWidgetBootstrap, async (req, res) => {
    try {
      assertPublicRequestOriginConsistency(req, {
        origin: req.query.origin,
        pageUrl: req.query.page_url || req.query.pageUrl,
        publicAppOrigin: deps.publicAppOrigin || getPublicAppUrl(),
      });

      const result = await getWidgetBootstrapImpl(getSupabase(), {
        installId: req.query.install_id || req.query.installId,
        agentId: req.query.agent_id || req.query.agentId,
        agentKey: req.query.agent_key || req.query.agentKey,
        businessId: req.query.business_id || req.query.businessId,
        websiteUrl: req.query.website_url || req.query.websiteUrl,
        origin: req.query.origin,
        pageUrl: req.query.page_url || req.query.pageUrl,
        displayMode: req.query.display_mode || req.query.displayMode || req.query.mode,
        publicPageKey: req.query.public_page_key || req.query.publicPageKey || req.query.k,
      });

      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      res.json(result);
    } catch (err) {
      const statusCode = Number(err?.statusCode || 500);
      const displayMode = String(req.query.display_mode || req.query.displayMode || req.query.mode || "").trim().toLowerCase();
      const safePublicStatus = [400, 403, 404].includes(statusCode);

      if (safePublicStatus) {
        console.warn("[widget bootstrap] unavailable", {
          statusCode,
          code: err?.code || null,
        });
      } else {
        console.error(err);
      }

      res.status(statusCode).json({
        error: displayMode === "page" && safePublicStatus
          ? "Assistant unavailable"
          : err.message || "Something went wrong",
        ...(isPublicRequestOriginConsistencyError(err) ? { code: err.code } : {}),
      });
    }
  });

  router.post("/install/ping", limitPublicInstallSignal, async (req, res) => {
    try {
      assertPublicRequestOriginConsistency(req, {
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        publicAppOrigin: deps.publicAppOrigin || getPublicAppUrl(),
      });

      const result = await recordInstallPingImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        sessionId: req.body.session_id || req.body.sessionId,
        fingerprint: req.body.fingerprint,
        timestamp: req.body.timestamp,
      });

      res.json(result);
    } catch (err) {
      console.warn("[install ping] ingestion failure", {
        installId: req.body.install_id || req.body.installId || null,
        origin: req.body.origin || null,
        pageUrl: req.body.page_url || req.body.pageUrl || null,
        statusCode: err?.statusCode || 500,
        code: err?.code || null,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
        ...(isPublicRequestOriginConsistencyError(err) ? { code: err.code } : {}),
      });
    }
  });

  router.post("/install/events", limitPublicInstallSignal, async (req, res) => {
    try {
      assertPublicRequestOriginConsistency(req, {
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        publicAppOrigin: deps.publicAppOrigin || getPublicAppUrl(),
      });

      const result = await trackWidgetEventImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        eventName: req.body.event_name || req.body.eventName,
        sessionId: req.body.session_id || req.body.sessionId,
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
        publicPageKey: req.body.public_page_key || req.body.publicPageKey || req.body.k,
        displayMode: req.body.display_mode || req.body.displayMode || req.body.mode,
        fingerprint: req.body.fingerprint,
        dedupeKey: req.body.dedupe_key || req.body.dedupeKey,
        metadata: req.body.metadata,
      });

      res.json(result);
    } catch (err) {
      console.warn("[install events] validation failure", {
        installId: req.body.install_id || req.body.installId || null,
        eventName: req.body.event_name || req.body.eventName || null,
        sessionId: req.body.session_id || req.body.sessionId || null,
        statusCode: err?.statusCode || 500,
        code: err?.code || null,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
        ...(isPublicRequestOriginConsistencyError(err) ? { code: err.code } : {}),
      });
    }
  });

  router.get("/install/cta", limitPublicInstallCta, async (req, res) => {
    try {
      const result = await recordTrackedCtaClickImpl(getSupabase(), {
        installId: req.query.install_id || req.query.installId,
        sessionId: req.query.session_id || req.query.sessionId,
        visitorId: req.query.visitor_id || req.query.visitorId,
        fingerprint: req.query.fingerprint,
        pageUrl: req.query.page_url || req.query.pageUrl,
        origin: req.query.origin,
        ctaType: req.query.cta_type || req.query.ctaType,
        targetType: req.query.target_type || req.query.targetType,
        targetUrl: req.query.target_url || req.query.targetUrl,
        ctaEventId: req.query.cta_event_id || req.query.ctaEventId || req.query.vz_cta_event_id,
        decisionKey: req.query.decision_key || req.query.decisionKey,
        relatedActionType: req.query.related_action_type || req.query.relatedActionType,
        relatedIntentType: req.query.related_intent_type || req.query.relatedIntentType,
        actionKey: req.query.action_key || req.query.actionKey,
        conversationId: req.query.conversation_id || req.query.conversationId,
        personKey: req.query.person_key || req.query.personKey,
        leadId: req.query.lead_id || req.query.leadId,
        followUpId: req.query.follow_up_id || req.query.followUpId,
        label: req.query.label,
      });

      res.redirect(302, result.redirectUrl);
    } catch (err) {
      console.warn("[conversion] CTA redirect failed:", {
        installId: req.query.install_id || req.query.installId || null,
        ctaType: req.query.cta_type || req.query.ctaType || null,
        targetType: req.query.target_type || req.query.targetType || null,
        statusCode: err?.statusCode || 500,
        message: err?.message || "Something went wrong",
      });

      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/install/outcomes/detect", limitPublicInstallSignal, async (req, res) => {
    try {
      const result = await detectConversionOutcomesForPageImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        sessionId: req.body.session_id || req.body.sessionId,
        visitorId: req.body.visitor_id || req.body.visitorId,
        fingerprint: req.body.fingerprint,
        pageUrl: req.body.page_url || req.body.pageUrl,
        origin: req.body.origin,
        ctaEventId: req.body.cta_event_id || req.body.ctaEventId,
        outcomeType: req.body.outcome_type || req.body.outcomeType,
        ctaType: req.body.cta_type || req.body.ctaType,
        targetType: req.body.target_type || req.body.targetType,
        relatedActionType: req.body.related_action_type || req.body.relatedActionType,
        relatedIntentType: req.body.related_intent_type || req.body.relatedIntentType,
        actionKey: req.body.action_key || req.body.actionKey,
        conversationId: req.body.conversation_id || req.body.conversationId,
        personKey: req.body.person_key || req.body.personKey,
        leadId: req.body.lead_id || req.body.leadId,
        followUpId: req.body.follow_up_id || req.body.followUpId,
      });

      res.json(result);
    } catch (err) {
      console.warn("[conversion] Outcome detection failed:", {
        installId: req.body.install_id || req.body.installId || null,
        pageUrl: req.body.page_url || req.body.pageUrl || null,
        statusCode: err?.statusCode || 500,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/install/outcomes/ping", limitPublicInstallSignal, async (req, res) => {
    try {
      const result = await detectConversionOutcomesForPageImpl(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        sessionId: req.body.session_id || req.body.sessionId,
        visitorId: req.body.visitor_id || req.body.visitorId,
        fingerprint: req.body.fingerprint,
        pageUrl: req.body.page_url || req.body.pageUrl,
        origin: req.body.origin,
        ctaEventId: req.body.cta_event_id || req.body.ctaEventId,
        outcomeType: req.body.outcome_type || req.body.outcomeType,
        ctaType: req.body.cta_type || req.body.ctaType,
        targetType: req.body.target_type || req.body.targetType,
        relatedActionType: req.body.related_action_type || req.body.relatedActionType,
        relatedIntentType: req.body.related_intent_type || req.body.relatedIntentType,
        actionKey: req.body.action_key || req.body.actionKey,
        conversationId: req.body.conversation_id || req.body.conversationId,
        personKey: req.body.person_key || req.body.personKey,
        leadId: req.body.lead_id || req.body.leadId,
        followUpId: req.body.follow_up_id || req.body.followUpId,
        source: "ping",
      });

      res.json(result);
    } catch (err) {
      console.warn("[conversion] Outcome ping failed:", {
        installId: req.body.install_id || req.body.installId || null,
        pageUrl: req.body.page_url || req.body.pageUrl || null,
        statusCode: err?.statusCode || 500,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/dashboard/preferences", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const result = await getDashboardPreferencesImpl(supabase, {
        ownerUserId: user.id,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/dashboard/preferences", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const result = await saveDashboardLanguagePreferenceImpl(supabase, {
        ownerUserId: user.id,
        dashboardLanguage: req.body.dashboard_language || req.body.dashboardLanguage,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/create", limitAuthAdjacent, async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const result = await createAgentForBusinessNameImpl(
        supabase,
        req.body.business_name,
        req.body.website_url || req.body.websiteUrl,
        req.body.client_id || req.body.clientId,
        user?.id || null
      );

      const hasInitialSettings = [
        req.body.assistant_name || req.body.assistantName,
        req.body.widget_purpose || req.body.widgetPurpose || req.body.purpose,
        req.body.tone,
        req.body.system_prompt || req.body.systemPrompt,
        req.body.welcome_message || req.body.welcomeMessage,
        req.body.button_label || req.body.buttonLabel,
        req.body.primary_color || req.body.primaryColor,
        req.body.secondary_color || req.body.secondaryColor,
        req.body.website_url || req.body.websiteUrl,
        req.body.vertical,
      ].some((value) => Boolean(String(value || "").trim()));

      if (hasInitialSettings) {
        await updateAgentSettingsImpl(supabase, {
          agentId: result.agent.id,
          name: req.body.business_name,
          assistantName: req.body.assistant_name || req.body.assistantName,
          widgetPurpose: req.body.widget_purpose || req.body.widgetPurpose || req.body.purpose,
          tone: req.body.tone,
          systemPrompt: req.body.system_prompt || req.body.systemPrompt,
          welcomeMessage: req.body.welcome_message || req.body.welcomeMessage,
          buttonLabel: req.body.button_label || req.body.buttonLabel,
          websiteUrl: req.body.website_url || req.body.websiteUrl,
          vertical: req.body.vertical,
          primaryColor: req.body.primary_color || req.body.primaryColor,
          secondaryColor: req.body.secondary_color || req.body.secondaryColor,
        });
      }

      res.json({
        agent_id: result.agent.id,
        agent_key: result.agent.publicAgentKey,
        business_id: result.business.id,
        access_status: getEffectiveOwnerWorkspaceAccessStatusImpl(result.agent.accessStatus, {
          ownerUserId: user?.id || "",
          agentOwnerUserId: result.agent.ownerUserId || user?.id || "",
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/google/connect/start", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;
      const requestedScopes = Array.isArray(req.body.scopes)
        ? req.body.scopes.filter((scope) => typeof scope === "string" && scope.trim())
        : [];

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await createGoogleConnectionStartImpl(supabase, {
        agent,
        ownerUserId: user.id,
        redirectPath: req.body.redirect_path || req.body.redirectPath || "/dashboard",
        selectedMailbox: req.body.selected_mailbox || req.body.selectedMailbox,
        scopes: requestedScopes.length ? requestedScopes : undefined,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/google/disconnect", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      const agent = await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await disconnectGoogleConnectionImpl(supabase, {
        agent: {
          id: agent.id || agentId,
          businessId: agent.businessId || agent.business_id || req.body.business_id || req.body.businessId,
        },
        agentId,
        ownerUserId: user.id,
        connectedAccountId: req.body.connected_account_id || req.body.connectedAccountId,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
        code: err.code || undefined,
      });
    }
  });

  router.get("/google/oauth/callback", async (req, res) => {
    try {
      const result = await completeGoogleConnectionImpl(getSupabase(), {
        stateToken: req.query.state,
        code: req.query.code,
        oauthError: req.query.error,
      });

      res.redirect(302, result.redirectUrl);
    } catch (err) {
      console.warn("[google oauth] callback failed", {
        statusCode: err?.statusCode || 500,
        code: err?.code || "google_oauth_callback_failed",
      });
      const message = encodeURIComponent("Google authorization could not be completed. Reconnect Google Calendar from Connected Apps.");
      res.redirect(302, `/dashboard?google=error&reason=${message}`);
    }
  });

  router.get("/agents/list", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const result = await listAgentsImpl(supabase, {
        clientId: req.query.client_id || req.query.clientId,
        ownerUserId: user?.id || null,
        includeBridgeAgent: Boolean(user),
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/admin-list", async (req, res) => {
    try {
      const supabase = getSupabase();
      const adminUser = await requireAdminAccess(supabase, req, "agents.admin_list", {
        days: 7,
      });
      const agents = await listAllAgents(supabase);
      const funnel = await getProductFunnelSummary(supabase, { days: 7 });
      await recordAdminAuditEventImpl(supabase, {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "agents.admin_list.completed",
        metadata: {
          resultCount: agents.length,
        },
      }).catch(() => {});
      res.json({ agents, funnel });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/admin-list" });
    }
  });

  router.get("/admin/phone-numbers", async (req, res) => {
    try {
      const supabase = getSupabase();
      const adminUser = await requireAdminAccess(supabase, req, "phone_numbers.admin_list", {
        agentId: req.query.agent_id || req.query.agentId,
      });
      const phoneNumbers = await listAdminPhoneNumbersForAgentImpl(supabase, {
        agentId: req.query.agent_id || req.query.agentId,
        businessId: req.query.business_id || req.query.businessId,
        ownerUserId: req.query.owner_user_id || req.query.ownerUserId,
      });

      await recordAdminAuditEventImpl(supabase, {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "phone_numbers.admin_list.completed",
        targetType: "agent",
        targetId: req.query.agent_id || req.query.agentId,
        agentId: req.query.agent_id || req.query.agentId,
        metadata: {
          resultCount: phoneNumbers.length,
        },
      }).catch(() => {});

      res.json({
        ok: true,
        phoneNumbers,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/admin/phone-numbers" });
    }
  });

  router.post("/admin/phone-numbers/upsert", async (req, res) => {
    try {
      const supabase = getSupabase();
      const adminUser = await requireAdminAccess(supabase, req, "phone_numbers.upsert", {
        agentId: req.body.agent_id || req.body.agentId,
        phoneNumberE164: req.body.phone_number_e164 || req.body.phoneNumberE164,
        status: req.body.status,
      });
      const phoneNumber = await upsertAdminPhoneNumberAssignmentImpl(supabase, {
        agentId: req.body.agent_id || req.body.agentId,
        businessId: req.body.business_id || req.body.businessId,
        ownerUserId: req.body.owner_user_id || req.body.ownerUserId,
        phoneNumberE164: req.body.phone_number_e164 || req.body.phoneNumberE164,
        label: req.body.label,
        status: req.body.status,
        phoneChannelEnabled: req.body.phone_channel_enabled ?? req.body.phoneChannelEnabled,
        greetingText: req.body.greeting_text ?? req.body.greetingText,
        disclosureText: req.body.disclosure_text ?? req.body.disclosureText,
        fallbackMode: req.body.fallback_mode ?? req.body.fallbackMode,
      });

      await recordAdminAuditEventImpl(supabase, {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "phone_numbers.upsert.completed",
        targetType: "agent_phone_number",
        targetId: phoneNumber.id,
        ownerUserId: phoneNumber.ownerUserId,
        agentId: phoneNumber.agentId,
        metadata: {
          status: phoneNumber.status,
          phoneChannelEnabled: phoneNumber.phoneChannelEnabled,
        },
      }).catch(() => {});

      res.json({
        ok: true,
        phoneNumber,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/admin/phone-numbers/upsert" });
    }
  });

  router.get("/agents/messages", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      await requireActiveAgentAccessImpl(supabase, {
        agentId: req.query.agent_id || req.query.agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });
      await assertMessagesSchemaReadyImpl(supabase, { phase: "request" });
      const messages = await listAgentMessagesImpl(
        supabase,
        req.query.agent_id || req.query.agentId
      );
      res.json({ messages });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/front-desk/training-items", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const result = await listFrontDeskTrainingItemsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        type: req.query.type,
        status: req.query.status,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/front-desk/training-items", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await saveFrontDeskTrainingItemImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        itemId: req.body.item_id || req.body.itemId,
        type: req.body.type,
        title: req.body.title,
        triggerText: req.body.trigger_text || req.body.triggerText,
        answerText: req.body.answer_text || req.body.answerText,
        tags: req.body.tags,
        sourceType: req.body.source_type || req.body.sourceType,
        sourceMessageId: req.body.source_message_id || req.body.sourceMessageId,
        status: req.body.status,
      });

      try {
        await syncApprovedAnswerKnowledgeChunkImpl(supabase, getOpenAI(), {
          item: result.item,
          agentId,
          ownerUserId: user.id,
        });
      } catch (error) {
        console.warn("[front-desk rag] Approved answer indexing skipped:", error?.message || error);
      }

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/front-desk/training-items/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateFrontDeskTrainingItemStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        itemId: req.body.item_id || req.body.itemId,
        status: req.body.status,
      });

      try {
        await syncApprovedAnswerKnowledgeChunkImpl(supabase, getOpenAI(), {
          item: result.item,
          agentId,
          ownerUserId: user.id,
        });
      } catch (error) {
        console.warn("[front-desk rag] Approved answer indexing skipped:", error?.message || error);
      }

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/api/agents/:agentId/rag/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const result = await countActiveKnowledgeChunksImpl(supabase, {
        agentId,
        ownerUserId: user.id,
      });

      res.json({
        ok: true,
        agentId,
        semanticKnowledgeIndexed: result.count,
        storageUnavailable: result.storageUnavailable,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/api/agents/:agentId/rag/reindex", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await reindexFrontDeskKnowledgeImpl(supabase, getOpenAI(), {
        agent,
        ownerUserId: user.id,
      });

      res.json({
        ok: result.ok,
        agentId,
        chunksCreated: result.chunksCreated,
        chunksUpdated: result.chunksUpdated,
        chunksSkipped: result.chunksSkipped,
        embeddingsCreated: result.embeddingsCreated,
        errors: result.errors,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get([
    "/agents/:agentId/knowledge-files",
    "/api/agents/:agentId/knowledge-files",
  ], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const result = await listKnowledgeFilesImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        status: req.query.status,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        agentId,
        files: result.files || [],
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/api/agents/:agentId/knowledge-files" });
    }
  });

  router.post([
    "/agents/:agentId/knowledge-files",
    "/api/agents/:agentId/knowledge-files",
  ], async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agent = await requireActiveAgentAccessImpl(supabase, {
        agentId: req.params.agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });
      const file = await readMultipartKnowledgeFile(req, {
        maxBytes: KNOWLEDGE_FILE_UPLOAD_LIMITS.maxBytes,
      });
      const result = await uploadKnowledgeFileImpl(supabase, getOpenAI(), {
        agent,
        ownerUserId: user.id,
        file,
      });

      res.status(result.ok === false ? 202 : 201).json({
        ok: result.ok !== false,
        agentId: req.params.agentId,
        file: result.file,
        indexResult: result.indexResult,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/api/agents/:agentId/knowledge-files" });
    }
  });

  const archiveKnowledgeFileRoute = async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId || req.body?.client_id || req.body?.clientId,
      });

      const result = await archiveKnowledgeFileImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        fileId: req.params.fileId,
      });

      res.json({
        ok: true,
        agentId,
        file: result.file,
        chunksDeactivated: result.chunksDeactivated,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/api/agents/:agentId/knowledge-files/:fileId" });
    }
  };

  router.delete([
    "/agents/:agentId/knowledge-files/:fileId",
    "/api/agents/:agentId/knowledge-files/:fileId",
  ], archiveKnowledgeFileRoute);

  router.post([
    "/agents/:agentId/knowledge-files/:fileId/archive",
    "/api/agents/:agentId/knowledge-files/:fileId/archive",
  ], archiveKnowledgeFileRoute);

  router.post("/agents/front-desk/feedback", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await recordOwnerAnswerFeedbackImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        rating: req.body.rating,
        reason: req.body.reason,
        note: req.body.note,
        userQuestion: req.body.user_question || req.body.userQuestion,
        assistantAnswer: req.body.assistant_answer || req.body.assistantAnswer,
        assistantMessageKey: req.body.assistant_message_key || req.body.assistantMessageKey,
        sessionKey: req.body.session_key || req.body.sessionKey,
        displayMode: req.body.display_mode || req.body.displayMode,
        sourceRoute: req.body.source_route || req.body.sourceRoute,
        sourceType: req.body.source_type || req.body.sourceType,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/front-desk/feedback/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateVisitorReplyFeedbackStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        feedbackId: req.body.feedback_id || req.body.feedbackId,
        status: req.body.status,
        trainingItemId: req.body.training_item_id || req.body.trainingItemId,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/api/agents/:agentId/front-desk/practice-message", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId || req.body.agent_id || req.body.agentId;
      const includeDraftTrainingIds = Array.isArray(req.body.includeDraftTrainingIds)
        ? req.body.includeDraftTrainingIds
        : Array.isArray(req.body.include_draft_training_ids)
          ? req.body.include_draft_training_ids
          : [];

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await handleChatRequestImpl({
        supabase,
        openai: getOpenAI(),
        body: {
          agent_id: agentId,
          message: req.body.message,
          history: req.body.history,
          visitor_session_key: `internal-practice:${agentId}:${Date.now()}`,
          display_mode: "page",
        },
      }, {
        processLiveChatLeadCapture: async () => null,
        listRecentWidgetEvents: async () => [],
        recordEstimatedUsage: async () => null,
        selectRelevantApprovedAnswers: (trainingSupabase, options = {}) => selectRelevantPracticeAnswersImpl(trainingSupabase, {
          ...options,
          includeDraftTrainingIds,
        }),
        buildChatResponse: async ({ reply, agent, businessId, widgetConfig, leadCapture, directRouting }) => ({
          reply,
          agentId: agent.id,
          agentKey: agent.publicAgentKey,
          businessId,
          widgetConfig,
          leadCapture,
          directRouting,
          internalPractice: true,
        }),
      });

      res.json({
        ok: true,
        reply: result.reply,
        metadata: {
          internalPractice: true,
          includedDraftTrainingIds: includeDraftTrainingIds.map((id) => cleanText(id)).filter(Boolean),
          displayMode: "page",
        },
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/front-desk/test", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await handleChatRequestImpl({
        supabase,
        openai: getOpenAI(),
        body: {
          agent_id: agentId,
          message: req.body.message,
          history: req.body.history,
          visitor_session_key: `internal-test:${agentId}:${Date.now()}`,
          display_mode: "widget",
        },
      }, {
        processLiveChatLeadCapture: async () => null,
        listRecentWidgetEvents: async () => [],
        buildChatResponse: async ({ reply, agent, businessId, widgetConfig, leadCapture, directRouting }) => ({
          reply,
          agentId: agent.id,
          agentKey: agent.publicAgentKey,
          businessId,
          widgetConfig,
          leadCapture,
          directRouting,
          internalTest: true,
        }),
      });

      res.json({
        ok: true,
        reply: result.reply,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/operator-workspace", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await getOperatorWorkspaceSnapshotImpl(supabase, {
        agent,
        ownerUserId: user.id,
        forceSync: req.query.force_sync === "true",
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/product-help", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      let operatorWorkspace = {};

      try {
        operatorWorkspace = await getOperatorWorkspaceSnapshotImpl(supabase, {
          agent,
          ownerUserId: user.id,
          forceSync: false,
        });
      } catch (error) {
        console.warn("[product help] Could not load operator workspace context:", error.message);
      }

      const openai = getOpenAI();

      const result = await answerVonzaProductHelpImpl({
        openai,
        question: req.body.question,
        history: req.body.history,
        agent,
        operatorWorkspace,
        currentSection: req.body.current_section || req.body.currentSection,
        currentSubsection: req.body.current_subsection || req.body.currentSubsection,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      const statusCode = err.statusCode || 500;
      const errorMessage = err.exposeToClient || statusCode >= 500
        ? (err.exposeToClient ? err.message : PRODUCT_HELP_UNAVAILABLE_MESSAGE)
        : (err.message || "Something went wrong");
      res.status(statusCode).json({
        error: errorMessage,
      });
    }
  });

  router.get("/agents/operator/business-profile", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const profile = await getOperatorBusinessProfileImpl(supabase, {
        agent,
        ownerUserId: user.id,
      });
      const websiteContent = cleanText(agent.businessId)
        ? await getStoredWebsiteContentImpl(supabase, agent.businessId)
        : null;

      res.json({
        profile: attachBusinessProfilePrefill(profile, {
          agent,
          websiteContent,
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/business-profile", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const profile = await upsertOperatorBusinessProfileImpl(supabase, {
        agent,
        ownerUserId: user.id,
        profile: req.body.profile || req.body,
      });
      const websiteContent = cleanText(agent.businessId)
        ? await getStoredWebsiteContentImpl(supabase, agent.businessId)
        : null;

      try {
        await reindexFrontDeskKnowledgeImpl(supabase, getOpenAI(), {
          agent,
          ownerUserId: user.id,
          websiteContent,
          businessProfile: profile,
        });
      } catch (error) {
        console.warn("[front-desk rag] Business profile indexing skipped:", error?.message || error);
      }

      res.json({
        ok: true,
        profile: attachBusinessProfilePrefill(profile, {
          agent,
          websiteContent,
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/update", async (req, res) => {
    let user = null;

    try {
      const supabase = getSupabase();
      user = await getOptionalAuthenticatedUser(supabase, req);
      if (user) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId: req.body.agent_id || req.body.agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
        });
      } else {
        await requirePreClaimAgentAccessImpl(supabase, {
          agentId: req.body.agent_id || req.body.agentId,
          clientId: req.body.client_id || req.body.clientId,
        });
      }
      const updateOptions = {
        agentId: req.body.agent_id || req.body.agentId,
        name: readBodyField(req.body, "name"),
        assistantName: readBodyField(req.body, "assistant_name", "assistantName"),
        widgetPurpose:
          readBodyField(req.body, "widget_purpose", "widgetPurpose")
          ?? readBodyField(req.body, "purpose"),
        tone: readBodyField(req.body, "tone"),
        systemPrompt: readBodyField(req.body, "system_prompt", "systemPrompt"),
        welcomeMessage: readBodyField(req.body, "welcome_message", "welcomeMessage"),
        buttonLabel: readBodyField(req.body, "button_label", "buttonLabel"),
        widgetLogoUrl: readBodyField(req.body, "widget_logo_url", "widgetLogoUrl"),
        websiteUrl: readBodyField(req.body, "website_url", "websiteUrl"),
        primaryColor: readBodyField(req.body, "primary_color", "primaryColor"),
        secondaryColor: readBodyField(req.body, "secondary_color", "secondaryColor"),
        allowedDomains: readBodyField(req.body, "allowed_domains", "allowedDomains"),
        bookingUrl: readBodyField(req.body, "booking_url", "bookingUrl"),
        quoteUrl: readBodyField(req.body, "quote_url", "quoteUrl"),
        checkoutUrl: readBodyField(req.body, "checkout_url", "checkoutUrl"),
        bookingStartUrl: readBodyField(req.body, "booking_start_url", "bookingStartUrl"),
        quoteStartUrl: readBodyField(req.body, "quote_start_url", "quoteStartUrl"),
        bookingSuccessUrl: readBodyField(req.body, "booking_success_url", "bookingSuccessUrl"),
        quoteSuccessUrl: readBodyField(req.body, "quote_success_url", "quoteSuccessUrl"),
        checkoutSuccessUrl: readBodyField(
          req.body,
          "checkout_success_url",
          "checkoutSuccessUrl"
        ),
        successUrlMatchMode: readBodyField(
          req.body,
          "success_url_match_mode",
          "successUrlMatchMode"
        ),
        manualOutcomeMode: req.body.manual_outcome_mode ?? req.body.manualOutcomeMode,
        contactEmail: readBodyField(req.body, "contact_email", "contactEmail"),
        contactPhone: readBodyField(req.body, "contact_phone", "contactPhone"),
        primaryCtaMode: readBodyField(req.body, "primary_cta_mode", "primaryCtaMode"),
        fallbackCtaMode: readBodyField(req.body, "fallback_cta_mode", "fallbackCtaMode"),
        businessHoursNote: readBodyField(
          req.body,
          "business_hours_note",
          "businessHoursNote"
        ),
        vertical: readBodyField(req.body, "vertical"),
      };
      const fullPageConfig = readBodyField(req.body, "full_page_config", "fullPageConfig");
      if (fullPageConfig !== undefined) {
        updateOptions.fullPageConfig = fullPageConfig;
      }
      const bookingProvider = readBodyField(req.body, "booking_provider", "bookingProvider");
      if (bookingProvider !== undefined) {
        updateOptions.bookingProvider = bookingProvider;
      }
      const voiceConfig = readBodyField(req.body, "voice_config", "voiceConfig");
      if (voiceConfig !== undefined) {
        updateOptions.voiceConfig = voiceConfig;
      }
      const regeneratePublicPageKey = readBodyField(
        req.body,
        "regenerate_public_page_key",
        "regeneratePublicPageKey"
      );
      if (regeneratePublicPageKey !== undefined) {
        updateOptions.regeneratePublicPageKey = regeneratePublicPageKey;
      }

      const result = await updateAgentSettingsImpl(supabase, updateOptions);

      res.json({ ok: true, agent: result });
    } catch (err) {
      console.error("[agents/update] Failed to update agent settings:", {
        agentId: req.body.agent_id || req.body.agentId || null,
        ownerUserId: user?.id || null,
        clientId: req.body.client_id || req.body.clientId || null,
        websiteUrl: req.body.website_url || req.body.websiteUrl || null,
        code: err?.code || null,
        statusCode: err?.statusCode || 500,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post([
    "/agents/:agentId/front-desk-background/:kind",
    "/api/agents/:agentId/front-desk-background/:kind",
  ], async (req, res) => {
    try {
      const kind = cleanText(req.params.kind).toLowerCase();
      const maxBytes = kind === "video" ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agent = await requireActiveAgentAccessImpl(supabase, {
        agentId: req.params.agentId,
        ownerUserId: user.id,
      });
      const file = await readMultipartBackgroundFile(req, { maxBytes });
      const upload = await uploadFrontDeskBackgroundImpl(supabase, {
        agent,
        ownerUserId: user.id,
        kind,
        file,
      });

      res.json({
        ok: true,
        kind: upload.kind,
        url: upload.url,
        contentType: upload.contentType,
        size: upload.size,
      });
    } catch (err) {
      console.error("[front-desk-background] Failed to upload background:", {
        agentId: req.params.agentId || null,
        kind: req.params.kind || null,
        statusCode: err?.statusCode || 500,
        message: err?.message || "Something went wrong",
      });
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/delete", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      await requireActiveAgentAccessImpl(supabase, {
        agentId: req.body.agent_id || req.body.agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });
      const result = await deleteAgentImpl(supabase, req.body.agent_id || req.body.agentId);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/action-queue", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });
      await Promise.all([
        assertMessagesSchemaReadyImpl(supabase, { phase: "request" }),
        assertWidgetTelemetrySchemaReadyImpl(supabase),
        assertLeadCaptureSchemaReadyImpl(supabase, { phase: "request" }),
        assertConversionOutcomeSchemaReadyImpl(supabase, { phase: "request" }),
      ]);

      const [messages, statuses, agentListResult, feedback] = await Promise.all([
        listAgentMessagesImpl(supabase, agentId),
        listActionQueueStatusesImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }),
        listAgentsImpl(supabase, {
          ownerUserId: user.id,
          includeBridgeAgent: false,
        }),
        listVisitorReplyFeedbackForOwnerImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }).catch(() => ({
          records: [],
          summary: {
            total: 0,
            helpful: 0,
            notHelpful: 0,
            needsReview: 0,
          },
          persistenceAvailable: false,
        })),
      ]);

      const persistedRecords = Array.isArray(statuses) ? statuses : statuses?.records || [];
      const persistenceAvailable = Array.isArray(statuses)
        ? true
        : statuses?.persistenceAvailable !== false;
      const agentProfile = (agentListResult?.agents || []).find((candidate) => candidate.id === agentId) || null;
      const feedbackKnowledgeItems = buildKnowledgeImprovementQueueItemsFromFeedback(
        messages,
        feedback?.records || []
      );
      const preliminaryQueue = buildActionQueueImpl(messages, persistedRecords, {
        persistenceAvailable,
        additionalItems: feedbackKnowledgeItems,
      });
      const leadCapturesResult = await Promise.allSettled([
        listLeadCapturesImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }),
      ]);
      const leadCaptures = leadCapturesResult[0]?.status === "fulfilled"
        ? leadCapturesResult[0].value
        : { records: [], persistenceAvailable: false };
      const hydratedPreliminaryQueue = hydrateActionQueueWithLeadCaptures(preliminaryQueue, {
        records: leadCaptures.records || [],
        persistenceAvailable: leadCaptures.persistenceAvailable !== false,
      });
      const websiteContent = agentProfile?.businessId
        ? await getStoredWebsiteContentImpl(supabase, agentProfile.businessId)
        : null;
      const [followUpSync, knowledgeFixSync] = await Promise.all([
        syncFollowUpWorkflowsImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          queueItems: hydratedPreliminaryQueue.items || [],
          agentProfile: {
            agentId,
            ownerUserId: user.id,
            businessName: agentProfile?.name || "",
            assistantName: agentProfile?.assistantName || agentProfile?.name || "",
          },
        }),
        syncKnowledgeFixWorkflowsImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          queueItems: preliminaryQueue.items || [],
          agentProfile: {
            agentId,
            ownerUserId: user.id,
            systemPrompt: agentProfile?.systemPrompt || "",
            websiteUrl: agentProfile?.websiteUrl || "",
            knowledge: agentProfile?.knowledge || {},
          },
          websiteContent,
        }),
      ]);
      const latestStatuses = followUpSync?.persistenceAvailable === false && knowledgeFixSync?.persistenceAvailable === false
        ? statuses
        : await listActionQueueStatusesImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        });
      const finalPersistedRecords = Array.isArray(latestStatuses) ? latestStatuses : latestStatuses?.records || [];
      const finalPersistenceAvailable = Array.isArray(latestStatuses)
        ? true
        : latestStatuses?.persistenceAvailable !== false;

      const baseQueue = buildActionQueueImpl(messages, finalPersistedRecords, {
        persistenceAvailable: finalPersistenceAvailable,
        additionalItems: feedbackKnowledgeItems,
        followUps: followUpSync?.records || [],
        knowledgeFixes: knowledgeFixSync?.records || [],
        followUpWorkflowAvailable: followUpSync?.persistenceAvailable !== false,
        knowledgeFixWorkflowAvailable: knowledgeFixSync?.persistenceAvailable !== false,
      });
      const [conversionOutcomesResult] = await Promise.allSettled([
        listConversionOutcomesForAgentImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }),
      ]);
      const conversionOutcomes = conversionOutcomesResult.status === "fulfilled"
        ? conversionOutcomesResult.value
        : { records: [], summary: null, recentOutcomes: [], persistenceAvailable: false };
      const routingEvents = await listWidgetRoutingEventsByAgentIdImpl(supabase, {
        agentId,
      });
      const hydratedQueue = hydrateActionQueueWithLeadCaptures(baseQueue, {
        records: leadCaptures.records || [],
        followUps: followUpSync?.records || [],
        widgetEvents: routingEvents,
        outcomes: conversionOutcomes,
        persistenceAvailable: leadCaptures.persistenceAvailable !== false,
      });
      const responseQueue = expandGroupedFollowUpItems(hydratedQueue);
      const humanFollowUpStatuses = await listHumanFollowUpStatusRowsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
      });
      const humanFollowUps = buildHumanFollowUpWorkflowImpl(responseQueue, humanFollowUpStatuses.records || [], {
        persistenceAvailable: humanFollowUpStatuses.persistenceAvailable !== false,
      });
      const ownerNotifications = await syncOwnerNotificationsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        humanFollowUps,
      });

      res.json({
        ...responseQueue,
        humanFollowUps,
        ownerNotifications,
        analyticsSummary: buildAnalyticsSummary({
          messages,
          actionQueue: hydratedQueue,
          widgetMetrics: agentProfile?.widgetMetrics || {},
          installStatus: agentProfile?.installStatus || {},
          dashboardLanguage: normalizeDashboardLanguage(req.query.dashboard_language || req.query.dashboardLanguage),
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/action-requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);

      if (!agentId) {
        throw buildActionRequestRouteError("agent_id is required", 400);
      }

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const records = await listAgentActionRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status: req.query.status,
        packageKey: req.query.package_key || req.query.packageKey,
        requestType: req.query.request_type || req.query.requestType,
        limit: req.query.limit,
      });
      const enrichedRecords = (Array.isArray(records) ? records : []).map(enrichActionRequestForDashboard);

      res.json({
        ok: true,
        records: enrichedRecords,
        summary: buildActionRequestSummary(enrichedRecords),
      });
    } catch (err) {
      if (isMissingActionRequestsSchemaError(err)) {
        res.json({
          ok: true,
          records: [],
          summary: buildActionRequestSummary([]),
          persistenceAvailable: false,
          migrationRequired: true,
        });
        return;
      }

      sendRouteError(req, res, err, { route: "/agents/action-requests" });
    }
  });

  router.post("/agents/action-requests/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");
      const status = readBodyField(req.body, "status");

      if (!cleanText(requestId)) {
        throw buildActionRequestRouteError("request_id is required", 400);
      }

      if (!cleanText(status)) {
        throw buildActionRequestRouteError("status is required", 400);
      }

      const request = await updateAgentActionRequestStatusImpl(supabase, {
        ownerUserId: user.id,
        requestId,
        status,
        staffNotes: readBodyField(req.body, "staff_notes", "staffNotes"),
      });

      res.json({
        ok: true,
        request: enrichActionRequestForDashboard(request),
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/action-requests/status" });
    }
  });

  router.get("/agents/booking-requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);

      if (agentId) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      const records = await listAgentBookingRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status: req.query.status,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        records,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/booking-requests" });
    }
  });

  router.post("/agents/booking-requests/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");
      const status = readBodyField(req.body, "status");

      if (!cleanText(requestId)) {
        throw buildBookingRequestRouteError("request_id is required", 400);
      }

      if (!cleanText(status)) {
        throw buildBookingRequestRouteError("status is required", 400);
      }

      const updateOptions = {
        ownerUserId: user.id,
        requestId,
        status,
      };
      const statusReason = readBodyField(req.body, "status_reason", "statusReason");
      const staffNotes = readBodyField(req.body, "staff_notes", "staffNotes");
      const evidence = readBodyField(req.body, "evidence");

      if (statusReason !== undefined) {
        updateOptions.statusReason = statusReason;
      }

      if (staffNotes !== undefined) {
        updateOptions.staffNotes = staffNotes;
      }

      if (evidence !== undefined) {
        updateOptions.evidence = evidence;
      }

      const request = await updateAgentBookingRequestStatusImpl(supabase, updateOptions);

      res.json({
        ok: true,
        request,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/booking-requests/status" });
    }
  });

  router.get("/agents/quote-requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);

      if (agentId) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      const records = await listAgentQuoteRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status: req.query.status,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        records,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/quote-requests" });
    }
  });

  router.post("/agents/quote-requests/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");
      const status = readBodyField(req.body, "status");

      if (!cleanText(requestId)) {
        throw buildQuoteRequestRouteError("request_id is required", 400);
      }

      if (!cleanText(status)) {
        throw buildQuoteRequestRouteError("status is required", 400);
      }

      const updateOptions = {
        ownerUserId: user.id,
        requestId,
        status,
      };
      const statusReason = readBodyField(req.body, "status_reason", "statusReason");
      const staffNotes = readBodyField(req.body, "staff_notes", "staffNotes");
      const evidence = readBodyField(req.body, "evidence");
      const metadata = readBodyField(req.body, "metadata");

      if (statusReason !== undefined) {
        updateOptions.statusReason = statusReason;
      }

      if (staffNotes !== undefined) {
        updateOptions.staffNotes = staffNotes;
      }

      if (evidence !== undefined) {
        updateOptions.evidence = evidence;
      }

      if (metadata !== undefined) {
        updateOptions.metadata = metadata;
      }

      const request = await updateAgentQuoteRequestStatusImpl(supabase, updateOptions);

      res.json({
        ok: true,
        request,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/quote-requests/status" });
    }
  });

  router.get("/agents/connected-app-capabilities", async (req, res) => {
    try {
      const supabase = getSupabase();

      await authenticateUser(supabase, req);

      res.json({
        ok: true,
        capabilities: listConnectedAppCapabilitiesImpl().map(sanitizeConnectedAppCapability),
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-capabilities" });
    }
  });

  router.get("/agents/connected-apps", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const connections = await listConnectedAppConnectionsImpl(supabase, {
        ownerUserId: user.id,
        provider: req.query.provider,
        status: req.query.status,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        connections,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-apps" });
    }
  });

  router.post("/agents/connected-apps", async (req, res) => {
    try {
      assertNoConnectedAppRouteUnsafeInput(req.body);

      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const connection = await createConnectedAppConnectionImpl(supabase, {
        ownerUserId: user.id,
        provider: readBodyField(req.body, "provider"),
        appKey: readBodyField(req.body, "app_key", "appKey") || req.body.app,
        capabilityKeys: readBodyList(req.body, "capability_keys", "capabilityKeys", "capabilities"),
        status: readBodyField(req.body, "status"),
        providerAccountId: readBodyField(req.body, "provider_account_id", "providerAccountId"),
        providerAccountLabel: readBodyField(req.body, "provider_account_label", "providerAccountLabel"),
        scopesGranted: readBodyList(req.body, "scopes_granted", "scopesGranted", "scopes"),
        webhookStatus: readBodyField(req.body, "webhook_status", "webhookStatus"),
        lastVerifiedAt: readBodyField(req.body, "last_verified_at", "lastVerifiedAt"),
        needsAttentionReason: readBodyField(req.body, "needs_attention_reason", "needsAttentionReason"),
        metadata: req.body.metadata,
      });

      res.status(201).json({
        ok: true,
        connection,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-apps" });
    }
  });

  router.post("/agents/connected-apps/status", async (req, res) => {
    try {
      assertNoConnectedAppRouteUnsafeInput(req.body);

      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const connection = await updateConnectedAppConnectionStatusImpl(supabase, {
        ownerUserId: user.id,
        connectionId: readBodyField(req.body, "connection_id", "connectionId"),
        status: readBodyField(req.body, "status"),
        webhookStatus: readBodyField(req.body, "webhook_status", "webhookStatus"),
        lastVerifiedAt: readBodyField(req.body, "last_verified_at", "lastVerifiedAt"),
        needsAttentionReason: readBodyField(req.body, "needs_attention_reason", "needsAttentionReason"),
        metadata: req.body.metadata,
      });

      res.json({
        ok: true,
        connection,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-apps/status" });
    }
  });

  router.get("/agents/connected-app-inbound-threads", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const threads = await listConnectedAppInboundThreadsImpl(supabase, {
        ownerUserId: user.id,
        provider: req.query.provider,
        connectionId: req.query.connection_id || req.query.connectionId,
        agentId: req.query.agent_id || req.query.agentId,
        status: req.query.status,
        threadId: req.query.thread_id || req.query.threadId,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        threads,
        manualReplies: getWhatsAppManualReplyFeatureStatusImpl(deps.env || process.env),
        aiDrafts: getWhatsAppAiReplyDraftFeatureStatusImpl(deps.env || process.env),
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-inbound-threads" });
    }
  });

  router.post("/agents/connected-app-inbound-threads/status", async (req, res) => {
    try {
      assertNoConnectedAppRouteUnsafeInput(req.body);

      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const thread = await updateConnectedAppInboundThreadStatusImpl(supabase, {
        ownerUserId: user.id,
        threadId: readBodyField(req.body, "thread_id", "threadId"),
        status: readBodyField(req.body, "status"),
      });

      res.json({
        ok: true,
        thread,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-inbound-threads/status" });
    }
  });

  router.post("/agents/connected-app-inbound-threads/ai-draft", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      assertConnectedAppAiDraftRouteInput(req.body);
      const result = await createWhatsAppAiReplyDraftImpl(
        supabase,
        {
          ownerUserId: user.id,
          actorOwnerUserId: user.id,
          threadId: readBodyField(req.body, "thread_id", "threadId"),
          agentId: readBodyField(req.body, "agent_id", "agentId"),
          staffInstructions:
            readBodyField(req.body, "staff_instructions", "staffInstructions")
            ?? readBodyField(req.body, "instructions"),
          locale: readBodyField(req.body, "locale"),
          tone: readBodyField(req.body, "tone"),
        },
        {
          env: deps.env || process.env,
          now: deps.now,
          sessionWindowHours: deps.whatsappSessionWindowHours,
          getOpenAIClient: getOpenAI,
          openai: deps.openai,
          model: deps.whatsappAiReplyDraftModel,
        }
      );

      res.json({
        ok: result.status === "draft",
        draft: result.draft || result.draftText || "",
        draftText: result.draftText || result.draft || "",
        status: result.status,
        reasonCode: result.reasonCode,
        message: result.message,
        aiDraftOnly: true,
        requiresStaffApproval: true,
        noAutomaticWhatsAppReplies: true,
        noProviderSend: true,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-inbound-threads/ai-draft" });
    }
  });

  router.post("/agents/connected-app-inbound-threads/reply", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      assertConnectedAppReplyRouteInput(req.body);
      const outbound = await sendWhatsAppManualReplyImpl(
        supabase,
        {
          ownerUserId: user.id,
          actorOwnerUserId: user.id,
          threadId: readBodyField(req.body, "thread_id", "threadId"),
          agentId: readBodyField(req.body, "agent_id", "agentId"),
          capabilityKey: readBodyField(req.body, "capability_key", "capabilityKey"),
          messageType: readBodyField(req.body, "message_type", "messageType"),
          messageText: readBodyField(req.body, "message_text", "messageText"),
          templateName: readBodyField(req.body, "template_name", "templateName"),
          templateLanguage: readBodyField(req.body, "template_language", "templateLanguage"),
        },
        {
          env: deps.env || process.env,
          now: deps.now,
          sessionWindowHours: deps.whatsappSessionWindowHours,
          getWhatsAppDestinationRef: deps.getWhatsAppDestinationRef,
          resolveWhatsAppDestinationRef: deps.resolveWhatsAppDestinationRef,
          getWhatsAppCloudApiCredentials: deps.getWhatsAppCloudApiCredentials,
          getWhatsAppManualReplyCredentials: deps.getWhatsAppManualReplyCredentials,
          whatsappProviderClient: deps.whatsappProviderClient,
          providerClient: deps.whatsappProviderClient || deps.providerClient,
          fetch: deps.fetch,
        }
      );

      res.json({
        ok: outbound?.status === "sent",
        outbound,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-inbound-threads/reply" });
    }
  });

  router.get("/agents/connected-app-inbound-events", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const events = await listConnectedAppInboundEventsImpl(supabase, {
        ownerUserId: user.id,
        provider: req.query.provider,
        connectionId: req.query.connection_id || req.query.connectionId,
        agentId: req.query.agent_id || req.query.agentId,
        status: req.query.status,
        threadId: req.query.thread_id || req.query.threadId,
        limit: req.query.limit,
      });

      res.json({
        ok: true,
        events,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/connected-app-inbound-events" });
    }
  });

  router.post("/agents/:agentId/connected-apps/calendly/connect", async (req, res) => {
    try {
      assertCalendlyConnectRouteInput(req.body);

      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.params.agentId);
      const bookingUrl = normalizeCalendlyBookingUrl(readBodyField(req.body, "booking_url", "bookingUrl"));
      const publicAppUrl = normalizePublicHttpsBaseUrl(getPublicAppUrlImpl());

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      if (!bookingUrl) {
        throw buildConnectedAppRouteError(
          "A public HTTPS calendly.com booking link is required.",
          400,
          "calendly_booking_url_required"
        );
      }

      if (!publicAppUrl) {
        throw buildConnectedAppRouteError(
          "PUBLIC_APP_URL must be set to a public HTTPS URL before Calendly can connect.",
          503,
          "calendly_public_app_url_required"
        );
      }

      const env = deps.env || process.env;
      const providerConfigured = isCalendlyWebhookSubscriptionConfiguredImpl(env);
      const endpointToken = createBookingWebhookEndpointToken();
      const webhookSecret = createBookingWebhookSigningSecret();
      const now = new Date().toISOString();
      const baseMetadata = {
        provisioned_by: "dashboard_connected_apps",
        dashboard_surface: "website_widget_connected_apps",
        connected_app_capability: CALENDLY_CONNECTED_APP_CAPABILITY,
      };
      let providerConnected = false;
      let providerFailureCode = "";
      let providerSubscription = null;
      let integrationResult = await provisionCalendlyBookingIntegrationImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        endpointToken,
        webhookSecret,
        publicAppUrl,
        bookingUrl,
        status: "pending",
        metadata: {
          ...baseMetadata,
          provider_onboarding: providerConfigured ? "pending" : "not_configured",
        },
      });

      if (providerConfigured) {
        try {
          providerSubscription = await createCalendlyWebhookSubscriptionImpl(
            {
              webhookUrl: integrationResult.webhookUrl,
              signingKey: webhookSecret,
            },
            {
              env,
              fetch: deps.fetch,
            }
          );
          providerConnected = true;
          integrationResult = await provisionCalendlyBookingIntegrationImpl(supabase, {
            ownerUserId: user.id,
            agentId,
            endpointToken,
            webhookSecret,
            publicAppUrl,
            bookingUrl,
            status: "active",
            providerAccountId:
              providerSubscription.organizationId
              || providerSubscription.userId
              || null,
            providerEventTypeId: providerSubscription.subscriptionId || null,
            metadata: {
              ...baseMetadata,
              provider_onboarding: "connected",
              calendly_scope: providerSubscription.scope || "",
              calendly_events: providerSubscription.events || [],
              calendly_subscription_id: providerSubscription.subscriptionId || "",
            },
          });
        } catch (error) {
          providerFailureCode = cleanText(error?.code) || "calendly_provider_subscription_failed";
          integrationResult = await provisionCalendlyBookingIntegrationImpl(supabase, {
            ownerUserId: user.id,
            agentId,
            endpointToken,
            webhookSecret,
            publicAppUrl,
            bookingUrl,
            status: "needs_attention",
            metadata: {
              ...baseMetadata,
              provider_onboarding: "failed",
              provider_failure_code: providerFailureCode,
            },
          });
        }
      }

      const connectionStatus = providerConnected ? "active" : providerConfigured ? "needs_attention" : "needs_setup";
      const webhookStatus = providerConnected ? "active" : providerConfigured ? "needs_attention" : "needs_setup";
      const needsAttentionReason = providerConnected
        ? ""
        : providerConfigured
          ? providerFailureCode || "calendly_provider_subscription_failed"
          : "calendly_provider_not_configured";
      const connectionMetadata = {
        setupMode: "dashboard_calendly_webhook",
        dashboardSurface: "website_widget_connected_apps",
        providerConnected,
        backendConfigured: providerConfigured,
      };
      const existingConnections = await listConnectedAppConnectionsImpl(supabase, {
        ownerUserId: user.id,
        provider: CALENDLY_CONNECTED_APP_PROVIDER,
        appKey: CALENDLY_CONNECTED_APP_KEY,
      });
      const existingConnection = existingConnections.find((connection) =>
        connection.appKey === CALENDLY_CONNECTED_APP_KEY
        && connection.capabilityKeys.includes(CALENDLY_CONNECTED_APP_CAPABILITY)
      );
      const connection = existingConnection
        ? await updateConnectedAppConnectionStatusImpl(supabase, {
          ownerUserId: user.id,
          connectionId: existingConnection.id,
          status: connectionStatus,
          webhookStatus,
          lastVerifiedAt: providerConnected ? now : "",
          needsAttentionReason,
          metadata: connectionMetadata,
        })
        : await createConnectedAppConnectionImpl(supabase, {
          ownerUserId: user.id,
          provider: CALENDLY_CONNECTED_APP_PROVIDER,
          appKey: CALENDLY_CONNECTED_APP_KEY,
          capabilityKeys: [CALENDLY_CONNECTED_APP_CAPABILITY],
          status: connectionStatus,
          providerAccountLabel: "Calendly booking webhook",
          webhookStatus,
          lastVerifiedAt: providerConnected ? now : "",
          needsAttentionReason,
          metadata: connectionMetadata,
        });
      const existingEnablements = await listAgentConnectedAppEnablementsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
      });
      const existingEnablement = existingEnablements.find((enablement) =>
        enablement.connectionId === connection.id
      );
      const enablementOptions = {
        ownerUserId: user.id,
        agentId,
        connectionId: connection.id,
        capabilityKeys: [CALENDLY_CONNECTED_APP_CAPABILITY],
        enabled: providerConnected,
        approvalMode: providerConnected ? "owner_approved" : "manual_review",
        allowedSurfaces: ["webhook", "internal"],
        metadata: {
          setupMode: "dashboard_calendly_webhook",
          dashboardSurface: "website_widget_connected_apps",
          providerConnected,
        },
      };
      const enablement = existingEnablement
        ? await updateAgentConnectedAppEnablementImpl(supabase, {
          ...enablementOptions,
          enablementId: existingEnablement.id,
        })
        : await enableConnectedAppForAgentImpl(supabase, enablementOptions);

      res.json({
        ok: providerConnected,
        providerConnected,
        backendConfigured: providerConfigured,
        setupRequired: !providerConnected,
        message: providerConnected
          ? "Calendly webhook subscription connected."
          : providerConfigured
            ? "Calendly webhook endpoint needs provider review."
            : "Calendly webhook endpoint saved. Configure Calendly provider onboarding on the server to create the provider subscription.",
        integration: integrationResult.integration || null,
        connection,
        enablement,
        calendly: {
          scope: providerSubscription?.scope || "",
          events: providerSubscription?.events || ["invitee.created", "invitee.canceled"],
        },
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/:agentId/connected-apps/calendly/connect" });
    }
  });

  router.get("/agents/:agentId/connected-apps", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.params.agentId);

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const enablements = await listAgentConnectedAppEnablementsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        limit: req.query.limit,
      });
      const payload = {
        ok: true,
        enablements,
      };

      if (shouldIncludeConnectedAppReadiness(req.query)) {
        payload.readiness = await buildConnectedAppReadinessRoutePayload({
          supabase,
          ownerUserId: user.id,
          agentId,
          query: req.query,
          buildConnectedAppReadinessContextImpl,
          evaluateConnectedAppReadinessImpl,
        });
      }

      res.json(payload);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/:agentId/connected-apps" });
    }
  });

  router.post("/agents/:agentId/connected-apps", async (req, res) => {
    try {
      assertNoConnectedAppRouteUnsafeInput(req.body);

      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.params.agentId);
      const enablementId = readBodyField(req.body, "enablement_id", "enablementId");

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const enabled = readOptionalBoolean(req.body.enabled, "enabled");
      const hasCapabilityInput = hasBodyField(req.body, "capability_keys", "capabilityKeys", "capabilities");
      const hasAllowedSurfaceInput = hasBodyField(req.body, "allowed_surfaces", "allowedSurfaces", "surfaces");
      const baseOptions = {
        ownerUserId: user.id,
        capabilityKeys: readBodyList(req.body, "capability_keys", "capabilityKeys", "capabilities"),
        approvalMode: readBodyField(req.body, "approval_mode", "approvalMode"),
        allowedSurfaces: readBodyList(req.body, "allowed_surfaces", "allowedSurfaces", "surfaces"),
        packageKey: readBodyField(req.body, "package_key", "packageKey"),
        metadata: req.body.metadata,
      };
      let enablement;

      if (enablementId) {
        const updateOptions = {
          ownerUserId: user.id,
          agentId,
          enablementId,
        };

        if (hasCapabilityInput) {
          updateOptions.capabilityKeys = baseOptions.capabilityKeys;
        }

        if (enabled !== undefined) {
          updateOptions.enabled = enabled;
        }

        if (hasBodyField(req.body, "approval_mode", "approvalMode")) {
          updateOptions.approvalMode = baseOptions.approvalMode;
        }

        if (hasAllowedSurfaceInput) {
          updateOptions.allowedSurfaces = baseOptions.allowedSurfaces;
        }

        if (hasBodyField(req.body, "package_key", "packageKey")) {
          updateOptions.packageKey = baseOptions.packageKey;
        }

        if (hasBodyField(req.body, "metadata", "metadata")) {
          updateOptions.metadata = baseOptions.metadata;
        }

        enablement = await updateAgentConnectedAppEnablementImpl(supabase, updateOptions);
      } else {
        const createOptions = {
          ...baseOptions,
          agentId,
          connectionId: readBodyField(req.body, "connection_id", "connectionId"),
        };

        if (enabled !== undefined) {
          createOptions.enabled = enabled;
        }

        enablement = await enableConnectedAppForAgentImpl(supabase, createOptions);
      }

      res.status(enablementId ? 200 : 201).json({
        ok: true,
        enablement,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/:agentId/connected-apps" });
    }
  });

  router.get("/agents/:agentId/connected-app-readiness", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.params.agentId);

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const readiness = await buildConnectedAppReadinessRoutePayload({
        supabase,
        ownerUserId: user.id,
        agentId,
        query: req.query,
        buildConnectedAppReadinessContextImpl,
        evaluateConnectedAppReadinessImpl,
      });

      res.json({
        ok: true,
        ...readiness,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/:agentId/connected-app-readiness" });
    }
  });

  router.get(["/dashboard/analytics", "/dashboard/analytics/summary"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const agentId = req.query.agent_id || req.query.agentId;
      const user = await authenticateUser(supabase, req);

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      await Promise.all([
        assertMessagesSchemaReadyImpl(supabase, { phase: "request" }),
        assertWidgetTelemetrySchemaReadyImpl(supabase),
        assertLeadCaptureSchemaReadyImpl(supabase, { phase: "request" }),
        assertConversionOutcomeSchemaReadyImpl(supabase, { phase: "request" }),
      ]);

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const ownerUserId = user.id;

      const [messages, leadCaptures, conversionOutcomes, billingSnapshot, statuses, feedback, webCallHealthResult] = await Promise.all([
        listAgentMessagesImpl(supabase, agentId),
        listLeadCapturesImpl(supabase, {
          agentId,
          ownerUserId,
        }),
        listConversionOutcomesForAgentImpl(supabase, {
          agentId,
          ownerUserId,
        }),
        ownerUserId
          ? getOwnerBillingSnapshotImpl(supabase, {
              ownerUserId,
              accessStatus: agent.accessStatus,
            })
          : null,
        listActionQueueStatusesImpl(supabase, {
          agentId,
          ownerUserId,
        }).catch(() => []),
        listVisitorReplyFeedbackForOwnerImpl(supabase, {
          agentId,
          ownerUserId,
        }).catch(() => ({
          records: [],
          summary: {
            total: 0,
            helpful: 0,
            notHelpful: 0,
            needsReview: 0,
          },
          persistenceAvailable: false,
        })),
        listWebCallHealthEventsImpl(supabase, {
          agentId,
          ownerUserId,
        }).catch(() => ({
          summary: {
            available: false,
          },
          persistenceAvailable: false,
        })),
      ]);

      const persistedRecords = Array.isArray(statuses) ? statuses : statuses?.records || [];
      const feedbackKnowledgeItems = buildKnowledgeImprovementQueueItemsFromFeedback(
        messages,
        feedback?.records || []
      );
      const actionQueue = buildActionQueueImpl(messages, persistedRecords, {
        persistenceAvailable: Array.isArray(statuses) ? true : statuses?.persistenceAvailable !== false,
        additionalItems: feedbackKnowledgeItems,
      });

      res.json(buildOwnerAnalyticsDashboard({
        agent,
        messages,
        leadCaptures,
        conversionOutcomes,
        widgetMetrics: agent.widgetMetrics || {},
        billingSnapshot,
        actionQueue,
        actionStatuses: persistedRecords,
        feedback,
        webCallHealth: webCallHealthResult?.summary,
        webCallEvents: webCallHealthResult?.records || [],
        ownerUserId,
      }));
    } catch (err) {
      sendRouteError(req, res, err, { route: "/dashboard/analytics" });
    }
  });

  router.get("/dashboard/feedback", async (req, res) => {
    try {
      const supabase = getSupabase();
      const agentId = req.query.agent_id || req.query.agentId;
      const user = await authenticateUser(supabase, req);

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const result = await listVisitorReplyFeedbackForOwnerImpl(supabase, {
        agentId,
        ownerUserId: user.id,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/install-status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user?.id || null,
        clientId: req.query.client_id || req.query.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);

      res.json({ agent });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/full-page-assistant-qr.svg", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      if (agent?.fullPageConfig?.publicPageEnabled !== true || !cleanText(agent?.fullPageConfig?.publicPageKey)) {
        const error = new Error("Enable the public Front Desk page before downloading a QR code.");
        error.statusCode = 409;
        throw error;
      }
      const fullPageUrl = buildFullPageAssistantUrl(agent, getPublicAppUrl());
      const svg = await QRCode.toString(fullPageUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
      });

      res.type("image/svg+xml");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", "inline; filename=\"vonza-full-page-assistant-qr.svg\"");
      res.send(svg);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/install/verify", limitInstallVerify, async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user?.id || null,
        clientId: req.body.client_id || req.body.clientId,
      });

      const verification = await verifyAgentInstallation(supabase, {
        agentId,
      });
      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      if (verification.ok === true) {
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user?.id || agent?.ownerUserId || "",
          clientId: req.body.client_id || req.body.clientId,
          eventName: "install_verification_success",
          source: "install_verify",
          metadata: {
            status: verification.status || "found",
            install_state: agent?.installStatus?.state || "",
          },
          dedupeKey: `install_verification_success:${agentId}`,
        });
      }

      res.json({
        ok: verification.ok === true,
        verification,
        agent,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/activation-wizard", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const [messagesResult, statusesResult] = await Promise.allSettled([
        listAgentMessagesImpl(supabase, agentId),
        listActionQueueStatusesImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }),
      ]);
      const messages = messagesResult.status === "fulfilled" ? messagesResult.value : [];
      const persistedRecords = statusesResult.status === "fulfilled"
        ? (Array.isArray(statusesResult.value) ? statusesResult.value : statusesResult.value?.records || [])
        : [];
      const actionQueue = buildActionQueueImpl(messages, persistedRecords, {
        persistenceAvailable: statusesResult.status === "fulfilled",
      });

      const wizard = await getActivationWizardStateImpl(supabase, {
        agent,
        ownerUserId: user.id,
        messages,
        actionQueue,
      });

      res.json({ wizard });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/activation-wizard/progress", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const wizard = await updateActivationWizardProgressImpl(supabase, {
        agent,
        ownerUserId: user.id,
        step: req.body.step,
        action: req.body.action,
        importStatus: req.body.import_status ?? req.body.importStatus,
        importError: req.body.import_error ?? req.body.importError,
        testQuestion: req.body.test_question ?? req.body.testQuestion,
        testQuality: req.body.test_quality ?? req.body.testQuality,
        routeTarget: req.body.route_target ?? req.body.routeTarget,
        metadata: req.body.metadata,
      });

      res.json({ ok: true, wizard });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/action-queue/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateActionQueueStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        actionKey: req.body.action_key || req.body.actionKey,
        status: req.body.status,
        note: req.body.note,
        outcome: req.body.outcome,
        nextStep: req.body.next_step || req.body.nextStep,
        followUpNeeded: req.body.follow_up_needed ?? req.body.followUpNeeded,
        followUpCompleted: req.body.follow_up_completed ?? req.body.followUpCompleted,
        contactStatus: req.body.contact_status || req.body.contactStatus,
      });

      const item = result?.item || result;
      const persistenceAvailable = result?.persistenceAvailable !== false;
      const [messages, statuses] = await Promise.all([
        listAgentMessagesImpl(supabase, agentId),
        listActionQueueStatusesImpl(supabase, {
          agentId,
          ownerUserId: user.id,
        }),
      ]);
      const persistedRecords = Array.isArray(statuses) ? statuses : statuses?.records || [];
      const queue = buildActionQueueImpl(messages, persistedRecords, {
        persistenceAvailable,
      });

      res.json({
        ok: true,
        item,
        queue,
        persistenceAvailable,
        migrationRequired: !persistenceAvailable,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/human-follow-ups/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;
      const itemKey = req.body.item_key || req.body.itemKey || req.body.action_key || req.body.actionKey;
      const actionKey = req.body.action_key || req.body.actionKey || itemKey;
      const followUpId = req.body.follow_up_id || req.body.followUpId;
      const knowledgeFixId = req.body.knowledge_fix_id || req.body.knowledgeFixId;
      const status = cleanText(req.body.status).toLowerCase();

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateHumanFollowUpStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        itemKey,
        actionKey,
        followUpId,
        knowledgeFixId,
        status,
        note: req.body.note,
        ownerReply: req.body.owner_reply ?? req.body.ownerReply,
        followUpAt: req.body.follow_up_at || req.body.followUpAt,
      });

      if (actionKey) {
        const queuePatch = {
          agentId,
          ownerUserId: user.id,
          actionKey,
          status: status === "dismissed" ? "dismissed" : status === "replied" ? "done" : "reviewed",
          note: req.body.note,
          nextStep: status === "follow_up_later"
            ? "Follow up later."
            : status === "replied"
              ? "Owner replied."
              : undefined,
          followUpNeeded: status === "follow_up_later" ? true : status === "replied" ? false : undefined,
          followUpCompleted: status === "replied" ? true : undefined,
        };

        await updateActionQueueStatusImpl(supabase, queuePatch).catch((error) => {
          if (error?.statusCode >= 500) {
            console.warn("[human follow-up] action queue sync skipped:", error.message);
            return null;
          }
          throw error;
        });
      }

      if (followUpId && ["replied", "dismissed"].includes(status)) {
        await updateFollowUpWorkflowImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          followUpId,
          status: status === "replied" ? "sent" : "dismissed",
          draftContent: req.body.owner_reply ?? req.body.ownerReply,
        }).catch((error) => {
          if (error?.statusCode >= 500) {
            console.warn("[human follow-up] prepared follow-up sync skipped:", error.message);
            return null;
          }
          throw error;
        });
      }
      if (status === "replied") {
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
          eventName: "first_follow_up_completed",
          source: "human_follow_up",
          metadata: {
            status,
            has_follow_up_id: Boolean(followUpId),
            has_knowledge_fix_id: Boolean(knowledgeFixId),
          },
          dedupeKey: `first_follow_up_completed:${agentId}:${user.id}`,
        });
      }

      res.json({
        ok: true,
        item: result.item,
        message: status === "replied"
          ? "Human follow-up marked replied."
          : status === "dismissed"
            ? "Human follow-up dismissed."
            : status === "follow_up_later"
              ? "Human follow-up moved to later."
              : "Human follow-up updated.",
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/notifications/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateOwnerNotificationStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        notificationId: req.body.notification_id || req.body.notificationId,
        dedupeKey: req.body.dedupe_key || req.body.dedupeKey,
        status: req.body.status,
      });
      if (["read", "dismissed"].includes(result?.notification?.status)) {
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
          eventName: result.notification.status === "dismissed" ? "notification_dismissed" : "notification_read",
          source: "owner_notification",
          metadata: {
            status: result.notification.status,
            type: result.notification.type,
          },
          dedupeKey: `${result.notification.status === "dismissed" ? "notification_dismissed" : "notification_read"}:${result.notification.id || result.notification.dedupeKey}`,
        });
      }

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/privacy/settings", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      res.json(await getPrivacySettingsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
      }));
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/privacy/settings", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await savePrivacySettingsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        retentionDays: req.body.retention_days || req.body.retentionDays,
        deleteUnidentifiedVisitorsAfterDays:
          req.body.delete_unidentified_visitors_after_days || req.body.deleteUnidentifiedVisitorsAfterDays,
        policyNote: req.body.policy_note || req.body.policyNote,
        widgetIdentityGuidance: req.body.widget_identity_guidance || req.body.widgetIdentityGuidance,
      });
      await trackOwnerProductEvent(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
        eventName: "privacy_retention_saved",
        source: "privacy_controls",
        metadata: {
          retention_days: req.body.retention_days || req.body.retentionDays,
          delete_unidentified_visitors_after_days:
            req.body.delete_unidentified_visitors_after_days || req.body.deleteUnidentifiedVisitorsAfterDays,
        },
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.get("/agents/privacy/export", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.query.agent_id || req.query.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
      });

      const result = await exportAgentPrivacyDataImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        format: req.query.format,
      });
      await trackOwnerProductEvent(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.query.client_id || req.query.clientId,
        eventName: "data_exported",
        source: "privacy_controls",
        metadata: {
          format: result.format,
          messages_count: result.counts?.messages || 0,
          leads_count: result.counts?.leads || 0,
          follow_ups_count: result.counts?.followUps || 0,
        },
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.body);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/privacy/delete", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await deleteVisitorOrCustomerRecordsImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        contactId: req.body.contact_id || req.body.contactId,
        sessionKey: req.body.session_key || req.body.sessionKey,
        visitorEmail: req.body.visitor_email || req.body.visitorEmail,
        personKey: req.body.person_key || req.body.personKey,
        leadId: req.body.lead_id || req.body.leadId,
        actionKey: req.body.action_key || req.body.actionKey,
      });
      await trackOwnerProductEvent(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
        eventName: "data_deleted",
        source: "privacy_controls",
        metadata: {
          messages_count: result.deleted?.messages || 0,
          leads_count: result.deleted?.leads || 0,
          follow_ups_count: result.deleted?.followUps || 0,
          notifications_count: result.deleted?.notifications || 0,
        },
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/inbox/draft-reply", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await draftInboxReplyImpl(supabase, {
        agent,
        ownerUserId: user.id,
        threadId: req.body.thread_id || req.body.threadId,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/inbox/send-reply", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await sendInboxReplyImpl(supabase, {
        agent,
        ownerUserId: user.id,
        threadId: req.body.thread_id || req.body.threadId,
        subject: req.body.subject,
        body: req.body.body,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/calendar/draft", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await draftCalendarActionImpl(supabase, {
        agent,
        ownerUserId: user.id,
        eventId: req.body.event_id || req.body.eventId,
        actionType: req.body.action_type || req.body.actionType,
        title: req.body.title,
        description: req.body.description,
        startAt: req.body.start_at || req.body.startAt,
        endAt: req.body.end_at || req.body.endAt,
        timezone: req.body.timezone,
        location: req.body.location,
        contactId: req.body.contact_id || req.body.contactId,
        attendeeEmails: req.body.attendee_emails || req.body.attendeeEmails,
        leadId: req.body.lead_id || req.body.leadId,
        relatedActionKey: req.body.related_action_key || req.body.relatedActionKey,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/calendar/approve", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await approveCalendarActionImpl(supabase, {
        agent,
        ownerUserId: user.id,
        eventId: req.body.event_id || req.body.eventId,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/calendar/reviews/resolve", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await resolveCalendarAppointmentReviewImpl(supabase, {
        agent,
        ownerUserId: user.id,
        eventId: req.body.event_id || req.body.eventId,
        resolution: req.body.resolution,
        contactId: req.body.contact_id || req.body.contactId,
        outcomeType: req.body.outcome_type || req.body.outcomeType,
        note: req.body.note,
      }, {
        createManualFollowUpWorkflow: createManualFollowUpWorkflowImpl,
        markManualConversionOutcome: markManualConversionOutcomeImpl,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/campaigns/draft", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const campaign = await createCampaignDraftImpl(supabase, {
        agent,
        ownerUserId: user.id,
        goal: req.body.goal,
        recipientSource: req.body.recipient_source || req.body.recipientSource,
        sendWindowHour: req.body.send_window_hour || req.body.sendWindowHour,
        contactId: req.body.contact_id || req.body.contactId,
        contactName: req.body.contact_name || req.body.contactName,
        contactEmail: req.body.contact_email || req.body.contactEmail,
        personKey: req.body.person_key || req.body.personKey,
        leadId: req.body.lead_id || req.body.leadId,
        latestActionKey: req.body.latest_action_key || req.body.latestActionKey,
      });

      res.json({ campaign });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/campaigns/approve", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const campaign = await approveCampaignDraftImpl(supabase, {
        agent,
        ownerUserId: user.id,
        campaignId: req.body.campaign_id || req.body.campaignId,
        sendWindowHour: req.body.send_window_hour || req.body.sendWindowHour,
      });

      res.json({ campaign });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/campaigns/send-due", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await sendDueCampaignStepsImpl(supabase, {
        agent,
        ownerUserId: user.id,
        campaignId: req.body.campaign_id || req.body.campaignId,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/tasks/update", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const task = await updateOperatorTaskStatusImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        taskId: req.body.task_id || req.body.taskId,
        status: req.body.status,
        taskState: req.body.task_state || req.body.taskState,
      });

      res.json({ task });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/contacts/update", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const contact = await updateOperatorContactLifecycleStateImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        contactId: req.body.contact_id || req.body.contactId,
        lifecycleState: req.body.lifecycle_state || req.body.lifecycleState,
      });

      res.json({
        ok: true,
        contact,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/contacts/follow-up/draft", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await createManualFollowUpWorkflowImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        businessName: agent.assistantName || agent.name,
        assistantName: agent.assistantName || agent.name,
        actionType: req.body.action_type || req.body.actionType,
        contactId: req.body.contact_id || req.body.contactId,
        contactName: req.body.contact_name || req.body.contactName,
        contactEmail: req.body.contact_email || req.body.contactEmail,
        contactPhone: req.body.contact_phone || req.body.contactPhone,
        personKey: req.body.person_key || req.body.personKey,
        linkedActionKeys: req.body.linked_action_keys || req.body.linkedActionKeys,
        sourceActionKey: req.body.source_action_key || req.body.sourceActionKey,
        topic: req.body.topic,
        subject: req.body.subject,
        draftContent: req.body.draft_content || req.body.draftContent,
        evidence: req.body.evidence,
        whyPrepared: req.body.why_prepared || req.body.whyPrepared,
        pageHint: req.body.page_hint || req.body.pageHint,
        contextQuestion: req.body.context_question || req.body.contextQuestion,
        contextSnippet: req.body.context_snippet || req.body.contextSnippet,
      });

      res.json({
        ok: true,
        followUp: result.followUp,
        queueSync: result.queueSync || null,
        persistenceAvailable: result.persistenceAvailable !== false,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/copilot/proposals/apply", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;
      const proposalKey = req.body.proposal_key || req.body.proposalKey;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const operatorWorkspace = await getOperatorWorkspaceSnapshotImpl(supabase, {
        agent,
        ownerUserId: user.id,
      });
      const proposal = findTodayCopilotProposalImpl(operatorWorkspace.copilot || {}, proposalKey);

      if (!proposal) {
        const error = new Error("That Copilot proposal is no longer active.");
        error.statusCode = 404;
        throw error;
      }

      const result = await applyTodayCopilotProposalImpl(supabase, {
        agent,
        ownerUserId: user.id,
        proposal,
        workspace: operatorWorkspace,
        deps: {
          createManualFollowUpWorkflow: createManualFollowUpWorkflowImpl,
          createOperatorTask: createOperatorTaskImpl,
        },
      });

      res.json({
        ok: result.ok === true,
        proposal: result.proposal,
        result: result.result,
        message: result.ok
          ? "Copilot proposal applied."
          : result.proposal?.stateReason || "Copilot blocked this proposal until the required context is available.",
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/copilot/proposals/dismiss", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;
      const proposalKey = req.body.proposal_key || req.body.proposalKey;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const operatorWorkspace = await getOperatorWorkspaceSnapshotImpl(supabase, {
        agent,
        ownerUserId: user.id,
      });
      const proposal = findTodayCopilotProposalImpl(operatorWorkspace.copilot || {}, proposalKey);

      if (!proposal) {
        const error = new Error("That Copilot proposal is no longer active.");
        error.statusCode = 404;
        throw error;
      }

      const result = await dismissTodayCopilotProposalImpl(supabase, {
        agentId,
        businessId: agent.businessId,
        ownerUserId: user.id,
        proposal,
      });

      res.json({
        ok: true,
        proposal: {
          key: cleanText(proposal.key),
          type: cleanText(proposal.type),
          state: "dismissed",
        },
        persistenceAvailable: result.persistenceAvailable !== false,
        message: "Copilot proposal dismissed.",
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/operator/activation", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const activation = await updateOperatorOnboardingStateImpl(supabase, {
        agent,
        ownerUserId: user.id,
        selectedMailbox: req.body.selected_mailbox || req.body.selectedMailbox,
        calendarContext: req.body.calendar_context || req.body.calendarContext,
        markInboxReviewed: req.body.mark_inbox_reviewed === true || req.body.markInboxReviewed === true,
        markCalendarReviewed: req.body.mark_calendar_reviewed === true || req.body.markCalendarReviewed === true,
      });
      if (activation?.activationCompletedAt) {
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
          eventName: "onboarding_completed",
          source: "operator_activation",
          metadata: {
            status: "completed",
            google_connected: activation.googleConnected === true,
            calendar_synced: activation.calendarSynced === true,
          },
          dedupeKey: `onboarding_completed:${agentId}:${user.id}`,
        });
      }

      res.json({ activation });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/follow-ups/update", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const result = await updateFollowUpWorkflowImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        followUpId: req.body.follow_up_id || req.body.followUpId,
        status: req.body.status,
        subject: req.body.subject,
        draftContent: req.body.draft_content ?? req.body.draftContent,
        errorMessage: req.body.error_message ?? req.body.errorMessage,
        reopen: req.body.reopen === true || req.body.reopen === "true",
      });

      if (result?.followUp?.status === "sent") {
        await trackFollowUpOutcomeImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          followUpId: result.followUp.id,
          actionKey: result.followUp.sourceActionKey,
          leadId: req.body.lead_id || req.body.leadId,
          outcomeType: "follow_up_sent",
        });
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
          eventName: "first_follow_up_completed",
          source: "prepared_follow_up",
          metadata: {
            status: "sent",
            action_type: result.followUp.actionType || "",
          },
          dedupeKey: `first_follow_up_completed:${agentId}:${user.id}`,
        });
      }

      res.json({
        ok: true,
        followUp: result?.followUp || null,
        queueSync: result?.queueSync || null,
        persistenceAvailable: result?.persistenceAvailable !== false,
        message: result?.followUp?.status === "sent"
          ? "Follow-up marked sent."
          : result?.followUp?.status === "dismissed"
            ? "Follow-up dismissed."
            : result?.followUp?.status === "ready"
              ? "Follow-up marked ready."
              : result?.followUp?.status === "failed"
                ? "Follow-up marked failed."
                : "Follow-up saved.",
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/conversion-outcomes/manual", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agentProfile = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const result = await markManualConversionOutcomeImpl(supabase, {
        agentId,
        businessId: agentProfile?.businessId || req.body.business_id || req.body.businessId,
        ownerUserId: user.id,
        installId: req.body.install_id || req.body.installId || agentProfile?.installId || "",
        outcomeType: req.body.outcome_type || req.body.outcomeType,
        ctaEventId: req.body.cta_event_id || req.body.ctaEventId,
        ctaType: req.body.cta_type || req.body.ctaType,
        targetType: req.body.target_type || req.body.targetType,
        relatedActionType: req.body.related_action_type || req.body.relatedActionType,
        relatedIntentType: req.body.related_intent_type || req.body.relatedIntentType,
        sessionId: req.body.session_id || req.body.sessionId,
        visitorId: req.body.visitor_id || req.body.visitorId,
        fingerprint: req.body.fingerprint,
        pageUrl: req.body.page_url || req.body.pageUrl,
        origin: req.body.origin,
        conversationId: req.body.conversation_id || req.body.conversationId,
        personKey: req.body.person_key || req.body.personKey,
        leadId: req.body.lead_id || req.body.leadId,
        contactId: req.body.contact_id || req.body.contactId,
        actionKey: req.body.action_key || req.body.actionKey,
        followUpId: req.body.follow_up_id || req.body.followUpId,
        inboxThreadId: req.body.inbox_thread_id || req.body.inboxThreadId,
        calendarEventId: req.body.calendar_event_id || req.body.calendarEventId,
        campaignId: req.body.campaign_id || req.body.campaignId,
        campaignRecipientId: req.body.campaign_recipient_id || req.body.campaignRecipientId,
        operatorTaskId: req.body.operator_task_id || req.body.operatorTaskId,
        manualOutcomeLabel: req.body.manual_outcome_label || req.body.manualOutcomeLabel,
        manualResolution: req.body.manual_resolution || req.body.manualResolution,
        attributionPath: req.body.attribution_path || req.body.attributionPath,
        note: req.body.note,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/knowledge-fixes/update", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.body.agent_id || req.body.agentId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId: req.body.client_id || req.body.clientId,
      });

      const agentListResult = await listAgentsImpl(supabase, {
        ownerUserId: user.id,
        includeBridgeAgent: false,
      });
      const agentProfile = (agentListResult?.agents || []).find((candidate) => candidate.id === agentId) || null;
      const result = await updateKnowledgeFixWorkflowImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        knowledgeFixId: req.body.knowledge_fix_id || req.body.knowledgeFixId,
        status: req.body.status,
        issueSummary: req.body.issue_summary ?? req.body.issueSummary,
        mattersSummary: req.body.matters_summary ?? req.body.mattersSummary,
        proposedGuidance: req.body.proposed_guidance ?? req.body.proposedGuidance,
        errorMessage: req.body.error_message ?? req.body.errorMessage,
        agentProfile: {
          agentId,
          systemPrompt: agentProfile?.systemPrompt || "",
        },
      });
      if (result?.knowledgeFix?.status === "applied") {
        await trackOwnerProductEvent(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
          eventName: "first_knowledge_fix_approved",
          source: "knowledge_improvement",
          metadata: {
            status: "applied",
            action_type: result.knowledgeFix.actionType || "",
            occurrence_count: result.knowledgeFix.occurrenceCount || 0,
          },
          dedupeKey: `first_knowledge_fix_approved:${agentId}:${user.id}`,
        });
      }

      res.json({
        ok: true,
        knowledgeFix: result?.knowledgeFix || null,
        queueSync: result?.queueSync || null,
        updatedAgent: result?.updatedAgent || null,
        persistenceAvailable: result?.persistenceAvailable !== false,
        message: result?.knowledgeFix?.status === "applied"
          ? "Knowledge fix applied to advanced guidance."
          : result?.knowledgeFix?.status === "dismissed"
            ? "Knowledge fix dismissed."
            : result?.knowledgeFix?.status === "ready"
              ? "Knowledge fix marked ready."
              : result?.knowledgeFix?.status === "failed"
                ? "Knowledge fix marked failed."
                : "Knowledge fix saved.",
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/knowledge/import", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const clientId = req.body.client_id || req.body.clientId;
      const context = await resolveAgentContextImpl(supabase, {
        agentKey: req.body.agent_key || req.body.agentKey,
        businessId: req.body.business_id || req.body.businessId,
      });
      await requireActiveAgentAccessImpl(supabase, {
        agentId: context.agent.id,
        ownerUserId: user.id,
        clientId,
      });

      if (req.body.async === true) {
        const statusParams = new URLSearchParams();
        statusParams.set("job_id", "__JOB_ID__");
        if (cleanText(clientId)) {
          statusParams.set("client_id", cleanText(clientId));
        }

        const result = await importBusinessWebsiteKnowledgeImpl(supabase, {
          async: true,
          force: req.body.force === true,
          businessId: context.business.id,
          websiteUrl: context.business.website_url,
          agentId: context.agent.id,
          ownerUserId: user.id,
          agent: context.agent,
          statusUrl: `/api/agents/${encodeURIComponent(context.agent.id)}/knowledge/import/status?${statusParams.toString()}`,
        }, {
          ensureBusinessRecord: async () => context.business,
          extractBusinessWebsiteContent: extractBusinessWebsiteContentImpl,
          reindexFrontDeskKnowledge: reindexFrontDeskKnowledgeImpl,
          getOpenAIClient: getOpenAI,
        });

        const response = {
          ...result,
          statusUrl: cleanText(result.statusUrl).replace("__JOB_ID__", encodeURIComponent(result.import?.jobId || "")),
        };

        res.status(202).json(response);
        return;
      }

      const result = await importBusinessWebsiteKnowledgeImpl(supabase, {
        businessId: context.business.id,
        websiteUrl: context.business.website_url,
        agentId: context.agent.id,
        ownerUserId: user.id,
      }, {
        ensureBusinessRecord: async () => context.business,
        extractBusinessWebsiteContent: extractBusinessWebsiteContentImpl,
      });

      if (cleanText(context.agent?.ownerUserId)) {
        try {
          await reindexFrontDeskKnowledgeImpl(supabase, getOpenAI(), {
            agent: context.agent,
            ownerUserId: context.agent.ownerUserId,
            websiteContent: result,
          });
        } catch (error) {
          console.warn("[front-desk rag] Website content indexing skipped:", error?.message || error);
        }
      }

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/knowledge/import" });
    }
  });

  router.get("/api/agents/:agentId/knowledge/import/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = req.params.agentId;
      const clientId = req.query.client_id || req.query.clientId;

      await requireActiveAgentAccessImpl(supabase, {
        agentId,
        ownerUserId: user.id,
        clientId,
      });

      const result = await getBusinessWebsiteImportStatusImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        jobId: req.query.job_id || req.query.jobId,
        clientId,
      }, {
        getStoredWebsiteContent: getStoredWebsiteContentImpl,
      });

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/api/agents/:agentId/knowledge/import/status" });
    }
  });

  router.post("/product-events", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await getOptionalAuthenticatedUser(supabase, req);
      let ownerUserId = cleanText(user?.id);
      let agentId = cleanText(req.body.agent_id || req.body.agentId);
      let clientId = cleanText(req.body.client_id || req.body.clientId);
      let source = cleanText(req.body.source);
      let webCallSessionId = "";
      let webCallSession = null;
      let publicContext = null;

      if (user) {
        if (agentId) {
          await requireActiveAgentAccessImpl(supabase, {
            agentId,
            ownerUserId,
            clientId,
          });
        }
        clientId = clientId || `owner:${ownerUserId}`;
      } else {
        publicContext = await resolveAllowedPublicWidgetContextImpl(supabase, {
          installId: req.body.install_id || req.body.installId,
          agentId,
          agentKey: req.body.agent_key || req.body.agentKey,
          businessId: req.body.business_id || req.body.businessId,
          websiteUrl: req.body.website_url || req.body.websiteUrl,
          origin: req.body.origin,
          pageUrl: req.body.page_url || req.body.pageUrl,
          displayMode: req.body.display_mode || req.body.displayMode || req.body.mode,
          publicPageKey: req.body.public_page_key || req.body.publicPageKey || req.body.k,
        });

        agentId = cleanText(publicContext.agent?.id);
        ownerUserId = cleanText(publicContext.agent?.owner_user_id || publicContext.agent?.ownerUserId);
        clientId = `agent:${agentId}`;
        source = source || "public_install";
      }

      const eventName = req.body.event_name || req.body.eventName;
      const metadata = req.body.metadata && typeof req.body.metadata === "object"
        ? req.body.metadata
        : {};

      if (cleanText(eventName).startsWith("web_call_")) {
        webCallSession = await ensureWebCallSession(supabase, {
          agent: publicContext?.agent || { id: agentId, owner_user_id: ownerUserId },
          business: publicContext?.business || { id: req.body.business_id || req.body.businessId },
          ownerUserId,
          clientSessionKey: metadata.web_call_id || metadata.webCallId || req.body.web_call_id || req.body.webCallId,
          visitorSessionKey: req.body.visitor_session_key || req.body.visitorSessionKey,
          eventName,
          metadata,
        }).catch((error) => {
          console.warn("[web-call] session event persistence skipped", {
            eventName: cleanText(eventName),
            agentId,
            message: error?.message || "Unknown Web Call session error",
          });
          return null;
        });
        webCallSessionId = cleanText(webCallSession?.id);

        if (webCallSession) {
          await recordWebCallTurnTelemetry(supabase, webCallSession, {
            eventName,
            metadata,
          }).catch((error) => {
            console.warn("[web-call] turn telemetry skipped", {
              eventName: cleanText(eventName),
              agentId,
              message: error?.message || "Unknown Web Call telemetry error",
            });
          });
        }
      }

      const result = await trackProductEventImpl(supabase, {
        clientId,
        agentId,
        ownerUserId,
        eventName,
        source,
        metadata: {
          ...metadata,
          ...(webCallSessionId ? { web_call_session_id: webCallSessionId } : {}),
        },
        webCallSessionId,
        dedupeKey: req.body.dedupe_key || req.body.dedupeKey,
      });

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/product-events" });
    }
  });

  router.post("/create-checkout-session", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const action = req.body.action || "create";
      const planKey = req.body.plan_key || req.body.planKey;

      if (action === "simulate") {
        if (!isLocalDevBillingRequestAllowed(req)) {
          res.status(404).json({
            error: "Not found",
          });
          return;
        }

        await simulateOwnerBillingActivationImpl(supabase, {
          ownerUserId: user.id,
          planKey,
        });

        res.json({
          ok: true,
          simulated: true,
          access_status: "active",
        });
        return;
      }

      if (action === "confirm") {
        const session = await verifySuccessfulCheckout({
          sessionId: req.body.session_id || req.body.sessionId,
          ownerUserId: user.id,
          planKey,
        });
        const billingPayload = await buildBillingSyncPayloadFromCheckoutSessionImpl(session);

        if (billingPayload) {
          await syncOwnerBillingStateImpl(supabase, billingPayload);
        }

        res.json({
          ok: true,
          payment_status: session.payment_status,
          session_id: session.id,
          plan_key: session.vonzaPlanKey || "",
        });
        return;
      }

      const existing = await listAgentsImpl(supabase, {
        ownerUserId: user.id,
        includeBridgeAgent: false,
      });

      if (!existing.agents?.length) {
        const draft = await createAgentForBusinessNameImpl(
          supabase,
          getCheckoutDraftBusinessName(user),
          "",
          "",
          user.id
        );

        await updateAgentSettingsImpl(supabase, {
          agentId: draft.agent.id,
          assistantName: "Your assistant",
        });
      }

      const session = await createHostedCheckoutSessionImpl({
        user,
        email: req.body.email,
        planKey,
      });

      res.json({
        ok: true,
        url: session.url,
        session_id: session.id,
      });
    } catch (err) {
      if (isStripeConfigError(err) || isStripeCheckoutMinimumAmountError(err)) {
        console.warn("[stripe checkout] Stripe configuration error:", err.message);
      } else {
        console.error(err);
      }

      const configurationErrorMessage = getStripeCheckoutConfigurationErrorMessage(err);
      const isCheckoutAuthError = err.statusCode === 401;

      res.status(err.statusCode || 500).json({
        error: isCheckoutAuthError
          ? "Your sign-in session expired. Please sign in again to open checkout."
          : isStripeConfigError(err)
          ? "Stripe checkout is not configured yet. Please check the Stripe environment settings."
          : configurationErrorMessage || err.message || "Something went wrong",
      });
    }
  });

  router.post("/billing/change-plan", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const nextPlanKey = req.body.plan_key || req.body.planKey;
      const existingBilling = await getOwnerBillingRecordImpl(supabase, {
        ownerUserId: user.id,
      });

      if (!existingBilling?.stripeSubscriptionId) {
        const session = await createHostedCheckoutSessionImpl({
          user,
          email: req.body.email || user.email,
          planKey: nextPlanKey,
        });

        res.json({
          ok: true,
          redirect_url: session.url,
          redirect_mode: "checkout",
        });
        return;
      }

      const result = await changeStripeSubscriptionPlanImpl({
        ownerUserId: user.id,
        subscriptionId: existingBilling.stripeSubscriptionId,
        planKey: nextPlanKey,
      });
      const billingPayload = await buildBillingSyncPayloadFromSubscriptionImpl(
        result.subscription,
        {
          ownerUserId: user.id,
        }
      );

      if (!billingPayload) {
        const error = new Error("The updated subscription could not be matched to a Vonza plan.");
        error.statusCode = 409;
        throw error;
      }

      const billing = await syncOwnerBillingStateImpl(supabase, billingPayload);

      res.json({
        ok: true,
        changed: result.changed,
        billing,
      });
    } catch (err) {
      if (isStripeConfigError(err) || isStripeCheckoutMinimumAmountError(err)) {
        console.warn("[stripe plan change] Stripe configuration error:", err.message);
      } else {
        console.error(err);
      }

      const configurationErrorMessage = getStripeCheckoutConfigurationErrorMessage(err);
      const isCheckoutAuthError = err.statusCode === 401;

      res.status(err.statusCode || 500).json({
        error: isCheckoutAuthError
          ? "Your sign-in session expired. Please sign in again to change plans."
          : isStripeConfigError(err)
          ? "Stripe billing is not configured yet. Please check the Stripe environment settings."
          : configurationErrorMessage || err.message || "Something went wrong",
      });
    }
  });

  router.post("/billing/pilot-widget-plan", async (req, res) => {
    try {
      const supabase = getSupabase();
      const ownerUserId = cleanText(req.body.owner_user_id || req.body.ownerUserId);
      const adminUser = await requireAdminAccess(supabase, req, "billing.pilot_widget_plan.activate", {
        ownerUserId,
        planKey: "pilot_free_widget",
      });
      const result = await activatePilotWidgetPlanImpl(supabase, {
        ownerUserId,
        reason: req.body.reason,
        featureCaps: req.body.feature_caps || req.body.featureCaps,
        metadata: req.body.metadata,
        activatedByUserId: adminUser.id,
        activatedByEmail: adminUser.email,
      });

      await recordAdminAuditEventImpl(supabase, {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "billing.pilot_widget_plan.activated",
        targetType: "owner",
        targetId: result.ownerUserId,
        ownerUserId: result.ownerUserId,
        metadata: {
          planKey: result.planKey,
          productKey: result.entitlement?.product_key || "website_widget",
          entitlementStatus: result.entitlement?.entitlement_status || "free",
        },
      }).catch(() => {});

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/billing/pilot-widget-plan" });
    }
  });

  router.post("/agents/claim", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const user = await getAuthenticatedUser(supabase, req);
      const agent = await claimAgentForOwner(supabase, {
        agentId: req.body.agent_id || req.body.agentId,
        clientId: req.body.client_id || req.body.clientId,
        ownerUserId: user.id,
      });

      res.json({
        ok: true,
        agent,
      });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/access-status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const adminUser = await requireAdminAccess(supabase, req, "agents.access_status.update", {
        agentId: req.body.agent_id || req.body.agentId,
        accessStatus: req.body.access_status || req.body.accessStatus,
      });
      const agent = await updateAgentAccessStatus(supabase, {
        agentId: req.body.agent_id || req.body.agentId,
        accessStatus: req.body.access_status || req.body.accessStatus,
      });
      await recordAdminAuditEventImpl(supabase, {
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "agents.access_status.updated",
        targetType: "agent",
        targetId: agent.id,
        ownerUserId: agent.ownerUserId,
        agentId: agent.id,
        metadata: {
          accessStatus: agent.accessStatus,
        },
      }).catch(() => {});

      res.json({
        ok: true,
        agent,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/agents/access-status" });
    }
  });

  return router;
}
