import express from "express";
import path from "path";

import { createAgentRouter } from "../routes/agentRoutes.js";
import { createBusinessRouter } from "../routes/businessRoutes.js";
import { createChatRouter } from "../routes/chatRoutes.js";
import { createPublicRouter } from "../routes/publicRoutes.js";
import { createVoiceRouter } from "../routes/voiceRoutes.js";
import { applyRouteCors } from "../utils/corsPolicy.js";
import { applySecurityHeaders } from "../utils/securityHeaders.js";
import { installSafeConsole } from "../utils/safeLogger.js";

export function createApp({ rootDir }) {
  installSafeConsole();
  const app = express();

  app.use(applySecurityHeaders);
  app.use(applyRouteCors);
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "96kb" }));
  app.use(express.static(path.join(rootDir, "frontend"), {
    index: false,
    setHeaders(res, filePath) {
      const normalizedPath = filePath.split(path.sep).join("/");
      if (
        normalizedPath.endsWith("/frontend/dashboard.js")
        || normalizedPath.endsWith("/frontend/dashboard.css")
        || normalizedPath.endsWith("/frontend/dashboardHelpers.js")
        || normalizedPath.endsWith("/frontend/dashboardState.js")
        || normalizedPath.endsWith("/frontend/dashboardLabels.js")
        || normalizedPath.endsWith("/frontend/dashboardInstall.js")
        || normalizedPath.endsWith("/frontend/dashboardFrontDesk.js")
        || normalizedPath.endsWith("/frontend/i18n/dashboardI18n.js")
        || normalizedPath.endsWith("/frontend/settings/SettingsShell.js")
        || normalizedPath.endsWith("/frontend/settings/settings.css")
      ) {
        res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }));

  app.use(createPublicRouter({ rootDir }));
  app.use(createAgentRouter());
  app.use(createChatRouter());
  app.use(createVoiceRouter());
  app.use(createBusinessRouter());
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.statusCode || 500).json({
      error: err.statusCode === 503
        ? err.message
        : err.message || "Something went wrong",
    });
  });

  return app;
}
