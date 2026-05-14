import express from "express";
import cors from "cors";
import path from "path";

import { createAgentRouter } from "../routes/agentRoutes.js";
import { createBusinessRouter } from "../routes/businessRoutes.js";
import { createChatRouter } from "../routes/chatRoutes.js";
import { createPublicRouter } from "../routes/publicRoutes.js";

export function createApp({ rootDir }) {
  const app = express();

  app.use(cors());
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(express.static(path.join(rootDir, "frontend"), {
    index: false,
    setHeaders(res, filePath) {
      const normalizedPath = filePath.split(path.sep).join("/");
      if (
        normalizedPath.endsWith("/frontend/dashboard.js")
        || normalizedPath.endsWith("/frontend/dashboard.css")
        || normalizedPath.endsWith("/frontend/dashboardHelpers.js")
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
  app.use(createBusinessRouter());

  return app;
}
