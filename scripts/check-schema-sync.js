import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERSISTENCE_SCHEMA_HINTS } from "../src/services/schema/persistenceSchema.js";
import {
  buildRequiredTables,
  evaluateSchemaFileChanges,
  evaluateSchemaSync,
  inventoryToObject,
  listChangedFiles,
  parseMigrationInventory,
  parseSqlInventory,
  parseStringConstants,
  readGithubEventPayload,
  resolveBaseSha,
  scanSourceDependencies,
} from "./lib/schemaGate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dbDir = path.join(repoRoot, "db");
const srcDir = path.join(repoRoot, "src");

function listJavaScriptFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listJavaScriptFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith(".js")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function loadSqlFiles() {
  return readdirSync(dbDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => ({
      name: fileName,
      sql: readFileSync(path.join(dbDir, fileName), "utf8"),
    }));
}

function formatInventorySummary(inventory) {
  return JSON.stringify(inventoryToObject(inventory), null, 2);
}

function main() {
  const schemaSql = readFileSync(path.join(dbDir, "schema.sql"), "utf8");
  const sqlFiles = loadSqlFiles();
  const migrationFiles = sqlFiles.filter((entry) => entry.name !== "schema.sql");
  const schemaInventory = parseSqlInventory(schemaSql);
  const { inventory: migrationInventory, coverageByFile } = parseMigrationInventory(migrationFiles);
  const sharedConstants = parseStringConstants(
    readFileSync(path.join(srcDir, "config", "constants.js"), "utf8")
  );
  const sourceInventory = scanSourceDependencies(
    listJavaScriptFiles(srcDir).map((absolutePath) => ({
      path: absolutePath,
      source: readFileSync(absolutePath, "utf8"),
    })),
    sharedConstants
  );
  const requirements = buildRequiredTables({
    sourceInventory,
    schemaHints: PERSISTENCE_SCHEMA_HINTS,
  });

  const errors = evaluateSchemaSync({
    requirements,
    schemaInventory,
    migrationInventory,
    migrationCoverageByFile: coverageByFile,
  });

  const eventPayload = readGithubEventPayload(process.env.GITHUB_EVENT_PATH);
  const baseSha = resolveBaseSha(process.env, eventPayload);

  if (baseSha) {
    const changedFiles = listChangedFiles({
      cwd: repoRoot,
      baseSha,
    });

    errors.push(...evaluateSchemaFileChanges(changedFiles));
  }

  if (errors.length) {
    console.error("Schema sync check failed.");
    errors.forEach((message) => {
      console.error(`- ${message}`);
    });
    console.error("\nDetected source-backed persistence requirements:");
    console.error(formatInventorySummary(sourceInventory));
    process.exit(1);
  }

  console.log("Schema sync check passed.");
  console.log(`Tracked persistence tables: ${requirements.size}`);
}

main();
