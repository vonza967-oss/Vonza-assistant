#!/usr/bin/env node
import {
  formatEnterpriseRequestDeskEvalReport,
  runEnterpriseRequestDeskEvaluation,
} from "../src/services/evals/enterpriseRequestDeskEvalRunner.js";

function parseArgs(argv = []) {
  const options = {
    includeJson: false,
    scenarioIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      options.includeJson = true;
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
    return runEnterpriseRequestDeskEvaluation(options);
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
    return await runEnterpriseRequestDeskEvaluation(options);
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
  console.log(formatEnterpriseRequestDeskEvalReport(report));
}

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
