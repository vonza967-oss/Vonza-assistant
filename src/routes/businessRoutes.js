import express from "express";

import { getSupabaseClient } from "../clients/supabaseClient.js";
import { getAuthenticatedUser } from "../services/auth/authService.js";
import {
  recordAdminAuditEvent,
  requireAdminUser,
} from "../services/admin/adminAuthorizationService.js";
import {
  extractBusinessWebsiteContent,
  scrapeAllBusinesses,
} from "../services/scraping/websiteContentService.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";

export function createBusinessRouter(deps = {}) {
  const router = express.Router();
  const getSupabase = deps.getSupabaseClient || getSupabaseClient;
  const authenticateUser = deps.getAuthenticatedUser || getAuthenticatedUser;
  const requireAdminUserImpl = deps.requireAdminUser || requireAdminUser;
  const recordAdminAuditEventImpl = deps.recordAdminAuditEvent || recordAdminAuditEvent;

  async function requireBusinessAdmin(req, action, metadata = {}) {
    if (!req.headers.authorization) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      error.code = "auth_required";
      throw error;
    }

    const supabase = getSupabase();
    const adminUser = await requireAdminUserImpl(supabase, req, authenticateUser);
    await recordAdminAuditEventImpl(supabase, {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action,
      metadata,
    }).catch((error) => {
      console.warn("[business admin audit] failed", {
        action,
        adminUserId: adminUser.id,
        message: error?.message || "Audit failed",
      });
    });
    return { supabase, adminUser };
  }

  function sendRouteError(req, res, err, context = {}) {
    const requestId = getRequestId(req);
    logRouteError(err, req, context);
    sendJsonError(res, err, { requestId });
  }

  router.get("/businesses/:id/scrape", async (req, res) => {
    try {
      const { supabase } = await requireBusinessAdmin(req, "businesses.scrape_one", {
        businessId: req.params.id,
      });
      const result = await extractBusinessWebsiteContent(supabase, {
        businessId: req.params.id,
      });

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/businesses/:id/scrape" });
    }
  });

  router.post("/businesses/scrape", async (req, res) => {
    try {
      const { supabase } = await requireBusinessAdmin(req, "businesses.scrape", {
        businessId: req.body.business_id || req.body.businessId,
      });
      const result = await extractBusinessWebsiteContent(supabase, {
        businessId: req.body.business_id || req.body.businessId,
        websiteUrl: req.body.website_url || req.body.websiteUrl,
        name: req.body.name,
      });

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/businesses/scrape" });
    }
  });

  router.post("/businesses/scrape-all", async (req, res) => {
    try {
      const { supabase } = await requireBusinessAdmin(req, "businesses.scrape_all");
      const result = await scrapeAllBusinesses(supabase);

      res.json(result);
    } catch (err) {
      sendRouteError(req, res, err, { route: "/businesses/scrape-all" });
    }
  });

  return router;
}
