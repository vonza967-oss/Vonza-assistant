#!/usr/bin/env node
import {
  formatWebCallEvalReport,
  listWebCallEvalScenarios,
  runWebCallEvaluation,
} from "../src/services/evals/webCallEvalRunner.js";

function parseArgs(argv = []) {
  const options = {
    mode: process.env.WEB_CALL_EVAL_MODE || "dry-run",
    scenarioIds: [],
    limit: 0,
    includeReplies: false,
    list: false,
    verbose: false,
    failUnder: null,
  };

  argv.forEach((arg) => {
    if (arg === "--live") {
      options.mode = "live";
      return;
    }

    if (arg === "--dry-run") {
      options.mode = "dry-run";
      return;
    }

    if (arg === "--show-replies") {
      options.includeReplies = true;
      return;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      return;
    }

    if (arg === "--list") {
      options.list = true;
      return;
    }

    if (arg.startsWith("--scenario=")) {
      options.scenarioIds.push(...arg.slice("--scenario=".length).split(",").map((id) => id.trim()).filter(Boolean));
      return;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length)) || 0;
      return;
    }

    if (arg.startsWith("--fail-under=")) {
      options.failUnder = Number(arg.slice("--fail-under=".length));
    }
  });

  return options;
}

const options = parseArgs(process.argv.slice(2));

if (options.list) {
  listWebCallEvalScenarios().forEach((scenario) => {
    console.log(`${scenario.id} [${scenario.categories.join(", ")}] ${scenario.title}`);
  });
  process.exit(0);
}

const report = await runWebCallEvaluation(options);
console.log(formatWebCallEvalReport(report));

if (options.includeReplies) {
  report.results.forEach((result) => {
    if (!result.sanitizedReplies?.length) {
      return;
    }

    console.log("");
    console.log(`${result.scenarioId} sanitized replies:`);
    result.sanitizedReplies.forEach((reply, index) => {
      console.log(`${index + 1}. ${reply}`);
    });
  });
}

if (Number.isFinite(options.failUnder) && Number(report.summary.passRate || 0) < options.failUnder) {
  process.exitCode = 1;
}
