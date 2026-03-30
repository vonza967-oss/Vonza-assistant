import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { createApp } from "./src/app/createApp.js";
import { getPort, getPublicAppUrl } from "./src/config/env.js";
import {
  getSupabaseClient,
  logSupabaseStartupCheck,
} from "./src/clients/supabaseClient.js";

dotenv.config();

const port = getPort();
const publicAppUrl = getPublicAppUrl(port);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp({ rootDir: __dirname });

try {
  await logSupabaseStartupCheck(getSupabaseClient());
} catch (error) {
  console.error(error);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on ${publicAppUrl}`);
});
