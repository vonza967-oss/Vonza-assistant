#!/usr/bin/env node
import {
  formatQuoteDeskHuEvalReport,
  runQuoteDeskHuEvaluation,
} from "../src/services/evals/quoteDeskHuEvalRunner.js";

function parseArgs(argv = []) {
  const options = {
    mode: "dry-run",
    scenarioIds: [],
    includeJson: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      options.includeJson = true;
      continue;
    }

    if (arg === "--live") {
      options.mode = "live";
      continue;
    }

    if (arg === "--scenario" || arg === "--scenario-id") {
      const value = argv[index + 1] || "";
      index += 1;
      if (value) {
        options.scenarioIds.push(value);
      }
      continue;
    }

    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] || 0);
      index += 1;
    }
  }

  return options;
}

async function runEvaluation(options) {
  if (!options.includeJson) {
    return runQuoteDeskHuEvaluation(options);
  }

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalDebug = console.debug;
  const logToStderr = (...args) => console.error(...args);

  try {
    console.log = logToStderr;
    console.info = logToStderr;
    console.warn = logToStderr;
    console.debug = logToStderr;
    return await runQuoteDeskHuEvaluation(options);
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.debug = originalDebug;
  }
}

const options = parseArgs(process.argv.slice(2));
const report = await runEvaluation(options);

if (options.includeJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatQuoteDeskHuEvalReport(report));
}

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
