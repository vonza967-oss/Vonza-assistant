#!/usr/bin/env node
import dotenv from "dotenv";

import {
  formatFrontDeskEvalReport,
  listFrontDeskEvalScenarios,
  runFrontDeskEvaluation,
} from "../src/services/evals/frontDeskEvalRunner.js";

dotenv.config({ quiet: true });

function parseArgs(argv = []) {
  const options = {
    mode: process.env.FRONT_DESK_EVAL_MODE || "dry-run",
    scenarioIds: [],
    limit: 0,
    includeReplies: false,
    json: false,
    list: false,
    verbose: false,
    answerContractMode: false,
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

    if (arg === "--json") {
      options.json = true;
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

    if (
      arg === "--answer-contract"
      || arg === "--answer-contract=report-only"
      || arg === "--claim-verifier"
      || arg === "--claim-verifier=report-only"
    ) {
      options.answerContractMode = true;
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
  listFrontDeskEvalScenarios().forEach((scenario) => {
    console.log(`${scenario.id} [${scenario.categories.join(", ")}] ${scenario.title}`);
  });
  process.exit(0);
}

const report = await runFrontDeskEvaluation(options);

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatFrontDeskEvalReport(report));

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
}

if (Number.isFinite(options.failUnder) && Number(report.summary.passRate || 0) < options.failUnder) {
  process.exitCode = 1;
}
