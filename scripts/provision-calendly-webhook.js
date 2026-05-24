import { readFileSync } from "node:fs";

import dotenv from "dotenv";

import { getSupabaseClient } from "../src/clients/supabaseClient.js";
import { getPublicAppUrl } from "../src/config/env.js";
import { provisionCalendlyBookingIntegration } from "../src/services/bookings/bookingIntegrationService.js";
import { cleanText } from "../src/utils/text.js";

dotenv.config();

const BOOLEAN_FLAGS = new Set(["generate-webhook-secret", "webhook-secret-stdin", "help"]);

function parseArgs(argv = []) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];

    if (!raw.startsWith("--")) {
      continue;
    }

    const withoutPrefix = raw.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);

    if (BOOLEAN_FLAGS.has(key)) {
      args[key] = inlineValue === undefined ? true : inlineValue !== "false";
      continue;
    }

    args[key] = inlineValue === undefined ? argv[index + 1] : inlineValue;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return args;
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  npm run provision:calendly-webhook -- --owner-user-id <uuid> --agent-id <uuid> --webhook-secret-env CALENDLY_WEBHOOK_SIGNING_SECRET",
    "",
    "Secret sources:",
    "  --webhook-secret-env <name>    Read the Calendly webhook signing secret from an environment variable.",
    "  --webhook-secret-file <path>   Read the Calendly webhook signing secret from a local file.",
    "  --webhook-secret-stdin         Read the Calendly webhook signing secret from stdin.",
    "  --generate-webhook-secret      Generate and store a signing secret without printing it.",
    "",
    "Optional fields:",
    "  --booking-url <url>",
    "  --provider-account-id <id>",
    "  --provider-event-type-id <id>",
    "  --status <pending|active|disabled|needs_attention>",
    "  --public-app-url <url>",
    "",
  ].join("\n"));
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function getWebhookSecret(args) {
  const sources = [
    args["webhook-secret-env"] ? "env" : "",
    args["webhook-secret-file"] ? "file" : "",
    args["webhook-secret-stdin"] ? "stdin" : "",
    args["generate-webhook-secret"] ? "generate" : "",
  ].filter(Boolean);

  if (sources.length > 1) {
    throw new Error("Choose only one Calendly webhook signing secret source.");
  }

  if (args["webhook-secret-env"]) {
    const envName = cleanText(args["webhook-secret-env"]);
    const value = cleanText(process.env[envName]);

    if (!value) {
      throw new Error(`Environment variable ${envName} is empty or missing.`);
    }

    return value;
  }

  if (args["webhook-secret-file"]) {
    const value = cleanText(readFileSync(args["webhook-secret-file"], "utf8"));

    if (!value) {
      throw new Error("Calendly webhook signing secret file is empty.");
    }

    return value;
  }

  if (args["webhook-secret-stdin"]) {
    const value = cleanText(await readStdin());

    if (!value) {
      throw new Error("Calendly webhook signing secret stdin input is empty.");
    }

    return value;
  }

  if (args["generate-webhook-secret"]) {
    return "";
  }

  throw new Error(
    "Provide a Calendly webhook signing secret via --webhook-secret-env, --webhook-secret-file, --webhook-secret-stdin, or pass --generate-webhook-secret."
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const ownerUserId = cleanText(args["owner-user-id"]);
  const agentId = cleanText(args["agent-id"]);

  if (!ownerUserId || !agentId) {
    printUsage();
    throw new Error("owner-user-id and agent-id are required.");
  }

  const result = await provisionCalendlyBookingIntegration(getSupabaseClient(), {
    ownerUserId,
    agentId,
    bookingUrl: args["booking-url"],
    providerAccountId: args["provider-account-id"],
    providerEventTypeId: args["provider-event-type-id"],
    status: args.status || "active",
    publicAppUrl: args["public-app-url"] || getPublicAppUrl(),
    webhookSecret: await getWebhookSecret(args),
  });

  process.stdout.write(`${result.webhookUrl}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
