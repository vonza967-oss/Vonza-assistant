import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import { getAuthenticatedUser } from "../services/auth/authService.js";
import { requireActiveAgentAccess } from "../services/agents/agentService.js";
import {
  listAgentQuoteRequests,
  updateAgentQuoteRequestStatus,
} from "../services/quotes/agentQuoteRequestService.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";
import { cleanText } from "../utils/text.js";
import { readBodyField } from "./agentRouteHelpers.js";

const QDH_SAFE_REVIEW_STATUSES = Object.freeze([
  "needs_info",
  "needs_staff_review",
  "declined",
  "archived",
]);
const QDH_VISIBLE_REQUEST_STATUSES = Object.freeze([
  "request_received",
  ...QDH_SAFE_REVIEW_STATUSES,
]);

const QDH_SAFE_REVIEW_STATUS_SET = new Set(QDH_SAFE_REVIEW_STATUSES);
const QDH_VISIBLE_REQUEST_STATUS_SET = new Set(QDH_VISIBLE_REQUEST_STATUSES);

function buildQuoteDeskHuRouteError(message, statusCode = 400, code = "qdh_route_invalid") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeQdhStatus(value) {
  return cleanText(value).toLowerCase();
}

function assertQdhReviewStatus(status) {
  const normalized = normalizeQdhStatus(status);

  if (!normalized) {
    throw buildQuoteDeskHuRouteError("status is required", 400, "qdh_status_required");
  }

  if (!QDH_SAFE_REVIEW_STATUS_SET.has(normalized)) {
    throw buildQuoteDeskHuRouteError(
      "Quote Desk HU only supports request-review statuses in this phase.",
      400,
      "qdh_status_not_allowed"
    );
  }

  return normalized;
}

function assertQdhVisibleRequestStatus(status) {
  const normalized = normalizeQdhStatus(status);

  if (!normalized) {
    return "";
  }

  if (!QDH_VISIBLE_REQUEST_STATUS_SET.has(normalized)) {
    throw buildQuoteDeskHuRouteError(
      "Quote Desk HU only shows request-intake and review statuses in this phase.",
      400,
      "qdh_status_not_allowed"
    );
  }

  return normalized;
}

function filterQdhVisibleRequests(records = []) {
  return records.filter((record) =>
    QDH_VISIBLE_REQUEST_STATUS_SET.has(normalizeQdhStatus(record?.status))
  );
}

function buildQuoteDeskHuSummary(records = []) {
  const countByStatus = (statuses) => records.filter((record) =>
    statuses.includes(normalizeQdhStatus(record?.status))
  ).length;

  return {
    total: records.length,
    requestReceived: countByStatus(["request_received"]),
    needsInfo: countByStatus(["needs_info"]),
    needsStaffReview: countByStatus(["needs_staff_review"]),
    declined: countByStatus(["declined"]),
    archived: countByStatus(["archived"]),
    closed: countByStatus(["declined", "archived"]),
    responseTime: {
      available: false,
      label: "Nincs adat",
    },
  };
}

export function createQuoteDeskHuRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const requireActiveAgentAccessImpl =
    deps.requireActiveAgentAccess || requireActiveAgentAccess;
  const listAgentQuoteRequestsImpl =
    deps.listAgentQuoteRequests || listAgentQuoteRequests;
  const updateAgentQuoteRequestStatusImpl =
    deps.updateAgentQuoteRequestStatus || updateAgentQuoteRequestStatus;

  const sendRouteError = (req, res, err, context = {}) => {
    const requestId = getRequestId(req);
    logRouteError(err, req, context);
    sendJsonError(res, err, { requestId });
  };

  router.get("/quote-desk-hu/requests", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const agentId = cleanText(req.query.agent_id || req.query.agentId);
      const status = assertQdhVisibleRequestStatus(req.query.status);

      if (agentId) {
        await requireActiveAgentAccessImpl(supabase, {
          agentId,
          ownerUserId: user.id,
          clientId: req.query.client_id || req.query.clientId,
        });
      }

      const records = filterQdhVisibleRequests(await listAgentQuoteRequestsImpl(supabase, {
        ownerUserId: user.id,
        agentId,
        status,
        limit: req.query.limit || 100,
      }));

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "request_intake_review",
        safeStatuses: QDH_SAFE_REVIEW_STATUSES,
        visibleStatuses: QDH_VISIBLE_REQUEST_STATUSES,
        summary: buildQuoteDeskHuSummary(records),
        records,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/requests" });
    }
  });

  router.post("/quote-desk-hu/requests/status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const user = await authenticateUser(supabase, req);
      const requestId = readBodyField(req.body, "request_id", "requestId");

      if (!cleanText(requestId)) {
        throw buildQuoteDeskHuRouteError("request_id is required", 400, "qdh_request_id_required");
      }

      const status = assertQdhReviewStatus(readBodyField(req.body, "status"));
      const statusReason = readBodyField(req.body, "status_reason", "statusReason");
      const staffNotes = readBodyField(req.body, "staff_notes", "staffNotes");

      const updateOptions = {
        ownerUserId: user.id,
        requestId,
        status,
      };

      if (statusReason !== undefined) {
        updateOptions.statusReason = statusReason;
      }

      if (staffNotes !== undefined) {
        updateOptions.staffNotes = staffNotes;
      }

      const request = await updateAgentQuoteRequestStatusImpl(supabase, updateOptions);

      res.json({
        ok: true,
        product: "quote_desk_hu",
        phase: "request_intake_review",
        request,
      });
    } catch (err) {
      sendRouteError(req, res, err, { route: "/quote-desk-hu/requests/status" });
    }
  });

  return router;
}
