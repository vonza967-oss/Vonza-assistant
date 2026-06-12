import express from "express";
import path from "node:path";

import { getSupabaseClient as defaultGetSupabaseClient } from "../clients/supabaseClient.js";
import { createEarlyAccessWaitlistApplication } from "../services/waitlist/earlyAccessWaitlistService.js";
import { createRateLimitMiddleware } from "../utils/rateLimiter.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";

function applyWaitlistSecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
    ].join("; ")
  );
  next();
}

function wantsJson(req) {
  return req.path.startsWith("/api/")
    || String(req.headers.accept || "").includes("application/json");
}

export function createWaitlistApp({
  rootDir,
  getSupabaseClient = defaultGetSupabaseClient,
  createApplication = createEarlyAccessWaitlistApplication,
  limitWaitlistApplications = createRateLimitMiddleware("waitlist_application", {
    windowMs: 60_000,
    max: 4,
  }),
} = {}) {
  const app = express();
  const staticRoot = path.join(rootDir, "early-access-widget-waitlist");

  app.disable("x-powered-by");
  app.use(applyWaitlistSecurityHeaders);
  app.use(express.json({ limit: "24kb" }));
  app.use(express.urlencoded({ extended: false, limit: "24kb" }));
  app.use(express.static(staticRoot, {
    index: "index.html",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }));

  app.get("/ready", (_req, res) => {
    res.json({
      ok: true,
      service: "widget-early-access-waitlist",
    });
  });

  app.options("/api/waitlist/applications", (_req, res) => {
    res.status(204).end();
  });

  app.post("/api/waitlist/applications", limitWaitlistApplications, async (req, res, next) => {
    try {
      const supabase = getSupabaseClient();
      const application = await createApplication(supabase, req.body, {
        userAgent: req.headers["user-agent"],
        referrer: req.headers.referer || req.headers.referrer,
        sourceHost: req.headers.host,
      });

      res.status(201).json({
        received: true,
        status: application.status,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("*", (req, res, next) => {
    if (req.method !== "GET" || wantsJson(req)) {
      next();
      return;
    }

    res.sendFile(path.join(staticRoot, "index.html"));
  });

  app.use((err, req, res, _next) => {
    const requestId = getRequestId(req);
    logRouteError(err, req, { route: "waitlist" });

    if (wantsJson(req)) {
      sendJsonError(res, err, {
        publicSurface: true,
        requestId,
      });
      return;
    }

    res.status(err.statusCode || err.status || 500).send("A jelentkezést most nem sikerült feldolgozni.");
  });

  return app;
}
