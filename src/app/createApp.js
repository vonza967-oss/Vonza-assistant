import express from "express";
import path from "path";

import { createAgentRouter } from "../routes/agentRoutes.js";
import { createBookingRouter } from "../routes/bookingRoutes.js";
import { createBusinessRouter } from "../routes/businessRoutes.js";
import { createChatRouter } from "../routes/chatRoutes.js";
import { createIntegrationRouter } from "../routes/integrationRoutes.js";
import { createPhoneRouter } from "../routes/phoneRoutes.js";
import { createPublicRouter } from "../routes/publicRoutes.js";
import { createQuoteDeskHuRouter } from "../routes/quoteDeskHuRoutes.js";
import { createVoiceRouter } from "../routes/voiceRoutes.js";
import { applyRouteCors } from "../utils/corsPolicy.js";
import { applySecurityHeaders } from "../utils/securityHeaders.js";
import { installSafeConsole } from "../utils/safeLogger.js";
import {
  getRequestId,
  logRouteError,
  sendJsonError,
} from "../utils/httpErrors.js";

export function createApp({ rootDir }) {
  installSafeConsole();
  const app = express();

  app.use(applySecurityHeaders);
  app.use(applyRouteCors);
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use("/bookings/webhooks/calendly", express.raw({ type: "application/json", limit: "128kb" }));
  app.use("/integrations/whatsapp/webhook", express.raw({ type: "application/json", limit: "96kb" }));
  app.use(express.json({ limit: "96kb" }));
  app.use(express.static(path.join(rootDir, "frontend"), {
    index: false,
    setHeaders(res, filePath) {
      const normalizedPath = filePath.split(path.sep).join("/");
      if (
        normalizedPath.endsWith("/frontend/dashboard.js")
        || normalizedPath.endsWith("/frontend/dashboard.css")
        || normalizedPath.endsWith("/frontend/dashboard-customers.css")
        || normalizedPath.endsWith("/frontend/dashboard-install.css")
        || normalizedPath.endsWith("/frontend/dashboard-analytics.css")
        || normalizedPath.endsWith("/frontend/dashboard-front-desk.css")
        || normalizedPath.endsWith("/frontend/dashboard-glass.css")
        || normalizedPath.endsWith("/frontend/dashboardHelpers.js")
        || normalizedPath.endsWith("/frontend/dashboardState.js")
        || normalizedPath.endsWith("/frontend/dashboardLabels.js")
        || normalizedPath.endsWith("/frontend/dashboardInstall.js")
        || normalizedPath.endsWith("/frontend/dashboardFrontDesk.js")
        || normalizedPath.endsWith("/frontend/dashboardCustomers.js")
        || normalizedPath.endsWith("/frontend/dashboardAnalytics.js")
        || normalizedPath.endsWith("/frontend/dashboardToday.js")
        || normalizedPath.endsWith("/frontend/i18n/dashboardI18n.js")
        || normalizedPath.endsWith("/frontend/qdh-product.css")
        || normalizedPath.endsWith("/frontend/qdh-dashboard.css")
        || normalizedPath.endsWith("/frontend/qdh-dashboard.js")
        || normalizedPath.endsWith("/frontend/qdh-setup.js")
        || normalizedPath.endsWith("/frontend/settings/SettingsShell.js")
        || normalizedPath.endsWith("/frontend/settings/settings.css")
      ) {
        res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }));

  app.use(createPublicRouter({ rootDir }));
  app.use(createBookingRouter());
  app.use(createIntegrationRouter());
  app.use(createQuoteDeskHuRouter());
  app.use(createAgentRouter());
  app.use(createChatRouter());
  app.use(createPhoneRouter());
  app.use(createVoiceRouter());
  app.use(createBusinessRouter());
  app.use((err, _req, res, _next) => {
    const requestId = getRequestId(_req);
    logRouteError(err, _req, { route: "global" });
    sendJsonError(res, err, { requestId });
  });

  return app;
}
