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
  requireAgentAccess,
  requirePreClaimAgentAccess,
  resolveAgentContext,
  updateAgentAccessStatus,
  updateAgentSettings,
} from "../services/agents/agentService.js";
import {
  assertMessagesSchemaReady,
  listAgentMessages,
} from "../services/chat/messageService.js";
import { buildAnalyticsSummary } from "../services/analytics/analyticsSummaryService.js";
import { buildOwnerAnalyticsDashboard } from "../services/analytics/ownerAnalyticsDashboardService.js";
import { getProductFunnelSummary, trackProductEvent } from "../services/analytics/productEventService.js";
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
import {
  getOwnerBillingRecord,
  getOwnerBillingSnapshot,
  simulateOwnerBillingActivation,
  syncOwnerBillingState,
} from "../services/billing/billingUsageService.js";
import { getPublicAppUrl, isLocalDevBillingRequestAllowed } from "../config/env.js";
import {
  extractBusinessWebsiteContent,
  getStoredWebsiteContent,
} from "../services/scraping/websiteContentService.js";
import {
  recordInstallPing,
  verifyAgentInstallation,
} from "../services/install/installPresenceService.js";
import { buildFullPageAssistantUrl } from "../services/install/fullPageAssistantUrlService.js";
import {
  approveCalendarAction,
  approveCampaignDraft,
  completeGoogleConnection,
  createOperatorTask,
  createCampaignDraft,
  createGoogleConnectionStart,
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
  updateFrontDeskTrainingItemStatus,
} from "../services/training/frontDeskTrainingService.js";
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

function expandGroupedFollowUpItems(queue = {}) {
  const items = Array.isArray(queue.items) ? queue.items : [];
  const expandedItems = [];

  items.forEach((item) => {
    expandedItems.push(item);

    const groupedCount = Number(item.count || 0);
    const actionType = String(item.actionType || "").trim().toLowerCase();

    if (
      groupedCount < 2
      || !item.followUp?.id
      || !["lead_follow_up", "pricing_interest", "booking_intent"].includes(actionType)
    ) {
      return;
    }

    const evidence = item.evidence && typeof item.evidence === "object" ? item.evidence : {};
    const questions = Array.isArray(evidence.questions) ? evidence.questions : [];
    const replies = Array.isArray(evidence.replies) ? evidence.replies : [];
    const snippets = Array.isArray(evidence.snippets) ? evidence.snippets : [];

    for (let index = 1; index < groupedCount; index += 1) {
      expandedItems.push({
        ...item,
        key: `${item.key}:linked-${index}`,
        count: 1,
        question: questions[index] || item.question,
        reply: replies[index] || item.reply,
        snippet: snippets[index] || item.snippet,
        evidence: {
          ...evidence,
          interactionCount: 1,
          question: questions[index] || item.question,
          reply: replies[index] || item.reply,
          questions: questions[index] ? [questions[index]] : [],
          replies: replies[index] ? [replies[index]] : [],
          snippets: snippets[index] ? [snippets[index]] : [],
        },
      });
    }
  });

  if (expandedItems.length === items.length) {
    return queue;
  }

  return {
    ...queue,
    items: expandedItems,
  };
}

export function createAgentRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const getOpenAI = deps.getOpenAIClient || getOpenAIClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const listAgentsImpl = deps.listAgents || listAgents;
  const createAgentForBusinessNameImpl = deps.createAgentForBusinessName || createAgentForBusinessName;
  const requireAgentAccessImpl = deps.requireAgentAccess || requireAgentAccess;
  const requirePreClaimAgentAccessImpl = deps.requirePreClaimAgentAccess || deps.requireAgentAccess || requirePreClaimAgentAccess;
  const requireActiveAgentAccessImpl = deps.requireActiveAgentAccess || requireActiveAgentAccess;
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
  const listVisitorReplyFeedbackForOwnerImpl =
    deps.listVisitorReplyFeedbackForOwner || listVisitorReplyFeedbackForOwner;
  const recordOwnerAnswerFeedbackImpl =
    deps.recordOwnerAnswerFeedback || recordOwnerAnswerFeedback;
  const updateVisitorReplyFeedbackStatusImpl =
    deps.updateVisitorReplyFeedbackStatus || updateVisitorReplyFeedbackStatus;
  const trackProductEventImpl = deps.trackProductEvent || trackProductEvent;
  const updateAgentSettingsImpl = deps.updateAgentSettings || updateAgentSettings;
  const listFrontDeskTrainingItemsImpl =
    deps.listFrontDeskTrainingItems || listFrontDeskTrainingItems;
  const saveFrontDeskTrainingItemImpl =
    deps.saveFrontDeskTrainingItem || saveFrontDeskTrainingItem;
  const updateFrontDeskTrainingItemStatusImpl =
    deps.updateFrontDeskTrainingItemStatus || updateFrontDeskTrainingItemStatus;
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
  const getStoredWebsiteContentImpl = deps.getStoredWebsiteContent || getStoredWebsiteContent;
  const getOwnerBillingRecordImpl = deps.getOwnerBillingRecord || getOwnerBillingRecord;
  const getOwnerBillingSnapshotImpl = deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot;
  const simulateOwnerBillingActivationImpl =
    deps.simulateOwnerBillingActivation || simulateOwnerBillingActivation;
  const syncOwnerBillingStateImpl = deps.syncOwnerBillingState || syncOwnerBillingState;
  const createHostedCheckoutSessionImpl =
    deps.createHostedCheckoutSession || createHostedCheckoutSession;
  const buildBillingSyncPayloadFromCheckoutSessionImpl =
    deps.buildBillingSyncPayloadFromCheckoutSession || buildBillingSyncPayloadFromCheckoutSession;
  const buildBillingSyncPayloadFromSubscriptionImpl =
    deps.buildBillingSyncPayloadFromSubscription || buildBillingSyncPayloadFromSubscription;
  const changeStripeSubscriptionPlanImpl =
    deps.changeStripeSubscriptionPlan || changeStripeSubscriptionPlan;
  const constructStripeWebhookEventImpl = deps.constructStripeWebhookEvent || constructStripeWebhookEvent;
  const getOperatorWorkspaceSnapshotImpl =
    deps.getOperatorWorkspaceSnapshot || getOperatorWorkspaceSnapshot;
  const createGoogleConnectionStartImpl =
    deps.createGoogleConnectionStart || createGoogleConnectionStart;
  const completeGoogleConnectionImpl =
    deps.completeGoogleConnection || completeGoogleConnection;
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
  const trackOwnerProductEvent = async (supabase, {
    agentId,
    ownerUserId = "",
    clientId = "",
    eventName,
    source,
    metadata = {},
    dedupeKey = "",
  } = {}) => {
    const resolvedAgentId = cleanText(agentId);
    const resolvedOwnerUserId = cleanText(ownerUserId);
    const resolvedClientId = cleanText(clientId) || (resolvedOwnerUserId ? `owner:${resolvedOwnerUserId}` : `agent:${resolvedAgentId}`);

    if (!resolvedClientId || !eventName) {
      return null;
    }

    return trackProductEventImpl(supabase, {
      clientId: resolvedClientId,
      agentId: resolvedAgentId,
      ownerUserId: resolvedOwnerUserId,
      eventName,
      source,
      metadata,
      dedupeKey,
    }).catch((error) => {
      console.warn("[product-event] tracking skipped", {
        eventName,
        agentId: resolvedAgentId || null,
        ownerUserId: resolvedOwnerUserId || null,
        message: error?.message || "Unknown tracking error",
      });
      return null;
    });
  };
  const getAdminToken = (req) => {
    const bearerToken =
      typeof req.headers.authorization === "string" &&
      req.headers.authorization.toLowerCase().startsWith("bearer ")
        ? req.headers.authorization.slice("Bearer ".length)
        : "";

    return req.headers["x-admin-token"] || bearerToken;
  };
  const readBodyField = (body, snakeCaseKey, camelCaseKey) => {
    if (Object.prototype.hasOwnProperty.call(body, snakeCaseKey)) {
      return body[snakeCaseKey];
    }

    if (camelCaseKey && Object.prototype.hasOwnProperty.call(body, camelCaseKey)) {
      return body[camelCaseKey];
    }

    return undefined;
  };

  function getCheckoutDraftBusinessName(user) {
    const ownerUserId = String(user?.id || "").trim();
    const suffix = ownerUserId ? ownerUserId.slice(0, 8) : "owner";
    return `Vonza setup ${suffix}`;
  }

  function ensureAdminAccess(req) {
    const configuredToken = process.env.ADMIN_TOKEN;

    if (!configuredToken) {
      const error = new Error("ADMIN_TOKEN is not configured on the server.");
      error.statusCode = 503;
      throw error;
    }

    if (getAdminToken(req) !== configuredToken) {
      const error = new Error("Invalid or missing admin token.");
      error.statusCode = 401;
      throw error;
    }
  }

  function hasAdminAccess(req) {
    const configuredToken = process.env.ADMIN_TOKEN;
    return Boolean(configuredToken && getAdminToken(req) === configuredToken);
  }

  async function getOptionalAuthenticatedUser(supabase, req) {
    return authenticateUser(supabase, req).catch((error) => {
      if (error.statusCode === 401) {
        return null;
      }
      throw error;
    });
  }

  router.post("/stripe/webhook", async (req, res) => {
    try {
      const supabase = getSupabase();
      const event = constructStripeWebhookEventImpl({
        payload: req.body,
        signature: req.headers["stripe-signature"],
      });

      if (event.type === "checkout.session.completed") {
        const billingPayload = await buildBillingSyncPayloadFromCheckoutSessionImpl(
          event.data?.object
        );

        if (billingPayload) {
          await syncOwnerBillingStateImpl(supabase, billingPayload);
        }
      } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const billingPayload = await buildBillingSyncPayloadFromSubscriptionImpl(
          event.data?.object
        );

        if (billingPayload) {
          await syncOwnerBillingStateImpl(supabase, billingPayload);
        }
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

  router.get("/widget/bootstrap", async (req, res) => {
    try {
      const result = await getWidgetBootstrap(getSupabase(), {
        installId: req.query.install_id || req.query.installId,
        agentId: req.query.agent_id || req.query.agentId,
        agentKey: req.query.agent_key || req.query.agentKey,
        businessId: req.query.business_id || req.query.businessId,
        websiteUrl: req.query.website_url || req.query.websiteUrl,
        origin: req.query.origin,
        pageUrl: req.query.page_url || req.query.pageUrl,
        displayMode: req.query.display_mode || req.query.displayMode || req.query.mode,
      });

      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/install/ping", async (req, res) => {
    try {
      const result = await recordInstallPing(getSupabase(), {
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
      });
    }
  });

  router.post("/install/events", async (req, res) => {
    try {
      const result = await trackWidgetEvent(getSupabase(), {
        installId: req.body.install_id || req.body.installId,
        eventName: req.body.event_name || req.body.eventName,
        sessionId: req.body.session_id || req.body.sessionId,
        origin: req.body.origin,
        pageUrl: req.body.page_url || req.body.pageUrl,
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
      });
    }
  });

  router.get("/install/cta", async (req, res) => {
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

  router.post("/install/outcomes/detect", async (req, res) => {
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

  router.post("/install/outcomes/ping", async (req, res) => {
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

  router.post("/agents/create", async (req, res) => {
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

  router.get("/google/oauth/callback", async (req, res) => {
    try {
      const result = await completeGoogleConnectionImpl(getSupabase(), {
        stateToken: req.query.state,
        code: req.query.code,
        oauthError: req.query.error,
      });

      res.redirect(302, result.redirectUrl);
    } catch (err) {
      console.error(err);
      const message = encodeURIComponent(err.message || "google_connect_failed");
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
      ensureAdminAccess(req);
      const agents = await listAllAgents(getSupabase());
      const funnel = await getProductFunnelSummary(getSupabase(), { days: 7 });
      res.json({ agents, funnel });
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
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

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

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

  router.get(["/dashboard/analytics", "/dashboard/analytics/summary"], async (req, res) => {
    try {
      const supabase = getSupabase();
      const agentId = req.query.agent_id || req.query.agentId;
      const isAdmin = hasAdminAccess(req);
      const user = isAdmin
        ? null
        : await authenticateUser(supabase, req);

      if (!isAdmin) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      await Promise.all([
        assertMessagesSchemaReadyImpl(supabase, { phase: "request" }),
        assertWidgetTelemetrySchemaReadyImpl(supabase),
        assertLeadCaptureSchemaReadyImpl(supabase, { phase: "request" }),
        assertConversionOutcomeSchemaReadyImpl(supabase, { phase: "request" }),
      ]);

      const agent = await getAgentWorkspaceSnapshotImpl(supabase, agentId);
      const ownerUserId = user?.id || cleanText(req.query.owner_user_id || req.query.ownerUserId) || agent.ownerUserId || "";

      const [messages, leadCaptures, conversionOutcomes, billingSnapshot, statuses, feedback] = await Promise.all([
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
        feedback,
      }));
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
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
      res.setHeader("X-Vonza-QR-Target", fullPageUrl);
      res.send(svg);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/agents/install/verify", async (req, res) => {
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
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const context = await resolveAgentContextImpl(supabase, {
        agentKey: req.body.agent_key || req.body.agentKey,
        businessId: req.body.business_id || req.body.businessId,
      });
      if (user) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId: context.agent.id,
          ownerUserId: user.id,
          clientId: req.body.client_id || req.body.clientId,
        });
      } else {
        await requirePreClaimAgentAccessImpl(supabase, {
          agentId: context.agent.id,
          clientId: req.body.client_id || req.body.clientId,
        });
      }

      const result = await extractBusinessWebsiteContentImpl(supabase, {
        businessId: context.business.id,
        websiteUrl: context.business.website_url,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
    }
  });

  router.post("/product-events", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req).catch((error) => {
        if (error.statusCode === 401) {
          return null;
        }
        throw error;
      });
      const result = await trackProductEventImpl(supabase, {
        clientId: req.body.client_id || req.body.clientId,
        agentId: req.body.agent_id || req.body.agentId,
        ownerUserId: user?.id || "",
        eventName: req.body.event_name || req.body.eventName,
        source: req.body.source,
        metadata: req.body.metadata,
        dedupeKey: req.body.dedupe_key || req.body.dedupeKey,
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Something went wrong",
      });
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
      ensureAdminAccess(req);
      const agent = await updateAgentAccessStatus(getSupabaseClient(), {
        agentId: req.body.agent_id || req.body.agentId,
        accessStatus: req.body.access_status || req.body.accessStatus,
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

  return router;
}
