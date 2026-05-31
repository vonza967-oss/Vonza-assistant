import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnswerContractInstructions,
  parseAnswerContractOutput,
  summarizeAnswerContractForDebug,
} from "../src/services/chat/answerContractService.js";
import { generateAssistantReply } from "../src/services/chat/assistantReplyService.js";

function makeEvidencePack() {
  return {
    version: 1,
    items: [
      {
        id: "approved_answer:pricing",
        sourceType: "approved_answer",
        trustLevel: "owner_approved",
      },
      {
        id: "website:contact",
        sourceType: "website",
        trustLevel: "retrieved_website",
      },
    ],
  };
}

test("Answer Contract instructions list schema and allowed evidence IDs", () => {
  const instructions = buildAnswerContractInstructions(makeEvidencePack());

  assert.match(instructions, /Answer Contract v1 report-only mode/);
  assert.match(instructions, /approved_answer:pricing/);
  assert.match(instructions, /website:contact/);
  assert.match(instructions, /"claims"/);
});

test("valid JSON Answer Contract parses and normalizes claims", () => {
  const contract = parseAnswerContractOutput(JSON.stringify({
    version: 1,
    answer: "Tune-ups start at $85.\n\nWould you like to request a quote?",
    claims: [
      {
        text: "Tune-ups start at $85.",
        evidenceIds: ["approved_answer:pricing"],
        riskType: "Price",
        confidence: "HIGH",
      },
    ],
    confidence: "high",
    needsHandoff: false,
  }), {
    evidencePack: makeEvidencePack(),
  });

  assert.equal(contract.parseStatus, "parsed");
  assert.equal(contract.answer, "Tune-ups start at $85.\n\nWould you like to request a quote?");
  assert.equal(contract.claims[0].riskType, "pricing");
  assert.deepEqual(contract.claims[0].evidenceIds, ["approved_answer:pricing"]);
});

test("fenced JSON Answer Contract parses", () => {
  const contract = parseAnswerContractOutput(`\`\`\`json
{"version":1,"answer":"Use the contact form.","claims":[],"confidence":"medium","needsHandoff":false}
\`\`\``, {
    evidencePack: makeEvidencePack(),
  });

  assert.equal(contract.parseStatus, "parsed");
  assert.equal(contract.answer, "Use the contact form.");
});

test("non-JSON output falls back to plain text", () => {
  const contract = parseAnswerContractOutput("Plain visitor answer.\n\nWhat would you like to do next?", {
    evidencePack: makeEvidencePack(),
  });

  assert.equal(contract.parseStatus, "fallback");
  assert.equal(contract.answer, "Plain visitor answer.\n\nWhat would you like to do next?");
  assert.deepEqual(contract.claims, []);
  assert.ok(contract.warnings.includes("non_json_output"));
});

test("invalid evidence IDs are flagged but do not break the answer", () => {
  const contract = parseAnswerContractOutput(JSON.stringify({
    version: 1,
    answer: "Email the shop through the listed contact channel.",
    claims: [
      {
        text: "The shop has a listed contact channel.",
        evidenceIds: ["website:contact", "website:missing"],
        riskType: "email",
        confidence: "high",
      },
    ],
    confidence: "high",
  }), {
    evidencePack: makeEvidencePack(),
  });

  assert.equal(contract.parseStatus, "parsed");
  assert.equal(contract.answer, "Email the shop through the listed contact channel.");
  assert.deepEqual(contract.claims[0].evidenceIds, ["website:contact"]);
  assert.deepEqual(contract.invalidEvidenceIds, ["website:missing"]);
  assert.ok(contract.warnings.includes("invalid_evidence_ids"));
});

test("claim count is capped and risk types normalize", () => {
  const claims = Array.from({ length: 10 }, (_, index) => ({
    text: `Claim ${index + 1}`,
    evidenceIds: [],
    riskType: index === 0 ? "appointment time" : "unknown category",
    confidence: "medium",
  }));
  const contract = parseAnswerContractOutput(JSON.stringify({
    version: 1,
    answer: "Capped answer.",
    claims,
    confidence: "medium",
  }), {
    evidencePack: makeEvidencePack(),
    maxClaims: 3,
  });

  assert.equal(contract.claims.length, 3);
  assert.equal(contract.claims[0].riskType, "booking");
  assert.equal(contract.claims[1].riskType, "other");
  assert.ok(contract.warnings.includes("claim_count_capped"));
});

test("eval/debug metadata is redacted by default", () => {
  const contract = parseAnswerContractOutput(JSON.stringify({
    version: 1,
    answer: "Contact details are listed.",
    claims: [
      {
        text: "Customer can email secret@example.test using api_key=sk-test-secret123456.",
        evidenceIds: ["website:contact"],
        riskType: "contact",
        confidence: "high",
      },
    ],
    confidence: "high",
  }), {
    evidencePack: makeEvidencePack(),
  });
  const summary = summarizeAnswerContractForDebug(contract);

  assert.equal(summary.claimCount, 1);
  assert.deepEqual(summary.riskTypes, ["contact"]);
  assert.equal(summary.evidenceIdCoverageCount, 1);
  assert.equal("claims" in summary, false);
  assert.equal(JSON.stringify(summary).includes("secret@example.test"), false);
});

test("contract-capable generation returns only visitor answer text", async () => {
  let metadata = null;
  const payloads = [];
  const reply = await generateAssistantReply({
    openai: {
      chat: {
        completions: {
          create: async (payload) => {
            payloads.push(payload);

            if (payloads.length === 1) {
              return {
                choices: [
                  {
                    message: {
                      content: "The public answer only.",
                    },
                  },
                ],
              };
            }

            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      version: 1,
                      answer: "The public answer only.",
                      claims: [
                        {
                          text: "The public answer is supported.",
                          evidenceIds: ["approved_answer:pricing"],
                          riskType: "service",
                          confidence: "high",
                        },
                      ],
                      confidence: "high",
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    },
    userMessage: "What do you offer?",
    systemPrompt: "Answer clearly.",
    answerContract: {
      enabled: true,
      evidencePack: makeEvidencePack(),
      onContract(summary) {
        metadata = summary;
      },
    },
    repair: {
      getIssues: () => [],
    },
  });

  assert.equal(reply, "The public answer only.");
  assert.doesNotMatch(reply, /"claims"|evidenceIds/);
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].response_format, undefined);
  assert.deepEqual(payloads[1].response_format, { type: "json_object" });
  assert.equal(metadata.parseStatus, "parsed");
  assert.equal(metadata.claimCount, 1);
});
