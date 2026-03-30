import express from "express";
import cors from "cors";
import path from "path";

import { createBusinessRouter } from "../routes/businessRoutes.js";
import { createChatRouter } from "../routes/chatRoutes.js";
import { createPublicRouter } from "../routes/publicRoutes.js";

export function createApp({ rootDir }) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(rootDir, "frontend")));

  app.use(createPublicRouter({ rootDir }));
  app.use(createChatRouter());
  app.use(createBusinessRouter());

  return app;
}
