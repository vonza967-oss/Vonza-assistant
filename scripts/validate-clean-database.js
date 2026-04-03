import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { validateStartupSchemaReady } from "../src/services/schema/startupSchemaService.js";
import { createPgSupabaseCompat } from "./lib/createPgSupabaseCompat.js";

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dbDir = path.join(repoRoot, "db");

function requireCleanDatabaseUrl() {
  const value = process.env.CLEAN_DATABASE_URL || process.env.DATABASE_URL || "";

  if (!value) {
    throw new Error(
      "Missing CLEAN_DATABASE_URL (or DATABASE_URL) for clean database validation."
    );
  }

  return value;
}

async function applySqlFile(client, fileName) {
  const absolutePath = path.join(dbDir, fileName);
  const sql = readFileSync(absolutePath, "utf8");
  await client.query(sql);
}

async function main() {
  const client = new Client({
    connectionString: requireCleanDatabaseUrl(),
  });

  await client.connect();

  try {
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");

    await applySqlFile(client, "schema.sql");

    const migrationFiles = readdirSync(dbDir)
      .filter((fileName) => fileName.endsWith(".sql") && fileName !== "schema.sql")
      .sort();

    for (const fileName of migrationFiles) {
      await applySqlFile(client, fileName);
    }

    await validateStartupSchemaReady(createPgSupabaseCompat(client), {
      phase: "clean-db-validation",
    });

    console.log("Clean database validation passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Clean database validation failed.");
  console.error(error.message || error);
  process.exit(1);
});
