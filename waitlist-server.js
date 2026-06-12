import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createWaitlistApp } from "./src/app/createWaitlistApp.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);
const publicUrl = process.env.WAITLIST_PUBLIC_URL || `http://localhost:${port}`;

const app = createWaitlistApp({ rootDir: __dirname });

app.listen(port, "0.0.0.0", () => {
  console.log(`Widget early access waitlist running on ${publicUrl}`);
});
