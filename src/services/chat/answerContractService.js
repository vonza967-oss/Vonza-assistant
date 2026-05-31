import {
  cleanText,
  normalizeAssistantReply,
} from "../../utils/text.js";

export const ANSWER_CONTRACT_VERSION = 1;
export const DEFAULT_MAX_ANSWER_CONTRACT_CLAIMS = 8;

const CONFIDENCE_LEVELS = new Set(["high", "medium", "low", "none"]);
const RISK_TYPES = new Set([
  "pricing",
  "contact",
  "service",
  "availability",
  "policy",
  "booking",
  "other",
]);

function normalizeConfidence(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return CONFIDENCE_LEVELS.has(normalized) ? normalized : "none";
}

export function normalizeAnswerContractRiskType(value = "") {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");

  if (RISK_TYPES.has(normalized)) {
    return normalized;
  }

  if (/price|cost|quote|budget|fee|rate/.test(normalized)) {
    return "pricing";
  }

  if (/email|phone|contact|call|reach/.test(normalized)) {
    return "contact";
  }

  if (/service|offer|repair|install|maintenance/.test(normalized)) {
    return "service";
  }

  if (/hours?|available|availability|schedule|open/.test(normalized)) {
    return "availability";
  }

  if (/refund|return|cancel|warranty|guarantee|discount|privacy|policy/.test(normalized)) {
    return "policy";
  }

  if (/book|booking|appointment|reservation/.test(normalized)) {
    return "booking";
  }

  return "other";
}

function listEvidenceIds(evidencePack = {}) {
  return Array.isArray(evidencePack.items)
    ? evidencePack.items.map((item) => cleanText(item?.id)).filter(Boolean)
    : [];
}

function makeEvidenceIdSet(evidencePack = {}) {
  return new Set(listEvidenceIds(evidencePack));
}

function normalizeEvidenceIds(value, evidenceIdSet, warnings) {
  const ids = Array.isArray(value)
    ? value.map(cleanText).filter(Boolean)
    : [];
  const uniqueIds = [...new Set(ids)].slice(0, 12);
  const invalidIds = uniqueIds.filter((id) => !evidenceIdSet.has(id));

  if (invalidIds.length) {
    warnings.push("invalid_evidence_ids");
  }

  return {
    evidenceIds: uniqueIds.filter((id) => evidenceIdSet.has(id)),
    invalidEvidenceIds: invalidIds,
  };
}

function fallbackContract(answer, parseStatus, warnings = []) {
  return {
    version: ANSWER_CONTRACT_VERSION,
    answer: normalizeAssistantReply(answer || ""),
    claims: [],
    confidence: "none",
    needsHandoff: false,
    parseStatus,
    warnings: [...new Set(warnings.map(cleanText).filter(Boolean))],
  };
}

function stripFencedJson(value = "") {
  const trimmed = String(value || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonCandidate(value = "") {
  const stripped = stripFencedJson(value);

  if (!stripped) {
    return "";
  }

  if (stripped.startsWith("{") && stripped.endsWith("}")) {
    return stripped;
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  return start !== -1 && end > start ? stripped.slice(start, end + 1) : "";
}

function extractLooseAnswer(value = "") {
  const stripped = stripFencedJson(value);
  const match = stripped.match(/"answer"\s*:\s*"((?:\\.|[^"\\])*)"/i);

  if (!match) {
    return "";
  }

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\"/g, "\"").replace(/\\n/g, "\n");
  }
}

function normalizeWarnings(value = []) {
  return Array.isArray(value)
    ? [...new Set(value.map(cleanText).filter(Boolean).slice(0, 12))]
    : [];
}

function normalizeClaims(claims, evidenceIdSet, maxClaims) {
  const warnings = [];
  const invalidEvidenceIds = [];
  const normalizedClaims = Array.isArray(claims)
    ? claims.slice(0, maxClaims).map((claim) => {
        const evidence = normalizeEvidenceIds(claim?.evidenceIds, evidenceIdSet, warnings);
        invalidEvidenceIds.push(...evidence.invalidEvidenceIds);

        return {
          text: cleanText(claim?.text).slice(0, 500),
          evidenceIds: evidence.evidenceIds,
          riskType: normalizeAnswerContractRiskType(claim?.riskType),
          confidence: normalizeConfidence(claim?.confidence),
        };
      }).filter((claim) => claim.text)
    : [];

  if (Array.isArray(claims) && claims.length > maxClaims) {
    warnings.push("claim_count_capped");
  }

  return {
    claims: normalizedClaims,
    warnings,
    invalidEvidenceIds: [...new Set(invalidEvidenceIds)],
  };
}

export function buildAnswerContractInstructions(evidencePack = {}, options = {}) {
  const maxClaims = Number(options.maxClaims || DEFAULT_MAX_ANSWER_CONTRACT_CLAIMS);
  const evidenceIds = listEvidenceIds(evidencePack);

  return [
    "Answer Contract v1 report-only mode:",
    "Return exactly one JSON object and no markdown. Do not wrap it in a code fence.",
    "The public visitor reply must be in the `answer` field. Keep it clean plain text.",
    "List only factual claims that support the answer. Each claim should reference evidence IDs when available.",
    "Use only these riskType values: pricing, contact, service, availability, policy, booking, other.",
    "Use only these confidence values: high, medium, low, none.",
    `Limit claims to ${maxClaims}.`,
    evidenceIds.length
      ? `Allowed evidenceIds: ${evidenceIds.join(", ")}`
      : "Allowed evidenceIds: none",
    "If no evidence supports a claim, leave evidenceIds empty and lower confidence.",
    "Schema:",
    JSON.stringify({
      version: ANSWER_CONTRACT_VERSION,
      answer: "",
      claims: [
        {
          text: "",
          evidenceIds: [],
          riskType: "other",
          confidence: "none",
        },
      ],
      confidence: "none",
      needsHandoff: false,
      warnings: [],
    }),
  ].join("\n");
}

export function parseAnswerContractOutput(rawOutput = "", options = {}) {
  const rawText = normalizeAssistantReply(rawOutput || "");
  const fallbackAnswer = normalizeAssistantReply(options.fallbackAnswer || rawText);
  const jsonCandidate = extractJsonCandidate(rawText);

  if (!jsonCandidate) {
    return fallbackContract(fallbackAnswer, "fallback", ["non_json_output"]);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    const looseAnswer = normalizeAssistantReply(extractLooseAnswer(rawText));
    return fallbackContract(looseAnswer || fallbackAnswer, "invalid", ["invalid_json"]);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallbackContract(fallbackAnswer, "invalid", ["contract_not_object"]);
  }

  const answer = normalizeAssistantReply(parsed.answer || "");
  if (!answer) {
    return fallbackContract(fallbackAnswer, "invalid", ["missing_answer"]);
  }

  const maxClaims = Number(options.maxClaims || DEFAULT_MAX_ANSWER_CONTRACT_CLAIMS);
  const evidenceIdSet = makeEvidenceIdSet(options.evidencePack || {});
  const claimResult = normalizeClaims(parsed.claims, evidenceIdSet, maxClaims);
  const warnings = [
    ...normalizeWarnings(parsed.warnings),
    ...claimResult.warnings,
  ];

  return {
    version: ANSWER_CONTRACT_VERSION,
    answer,
    claims: claimResult.claims,
    confidence: normalizeConfidence(parsed.confidence),
    needsHandoff: Boolean(parsed.needsHandoff),
    parseStatus: "parsed",
    warnings: [...new Set(warnings)],
    ...(claimResult.invalidEvidenceIds.length
      ? { invalidEvidenceIds: claimResult.invalidEvidenceIds }
      : {}),
  };
}

export function summarizeAnswerContractForDebug(contract = {}, options = {}) {
  const claims = Array.isArray(contract.claims) ? contract.claims : [];
  const invalidEvidenceIds = [
    ...new Set([
      ...(Array.isArray(contract.invalidEvidenceIds) ? contract.invalidEvidenceIds : []),
      ...claims.flatMap((claim) =>
        Array.isArray(claim.invalidEvidenceIds) ? claim.invalidEvidenceIds : []
      ),
    ].map(cleanText).filter(Boolean)),
  ];
  const claimSummaries = claims.map((claim) => ({
    riskType: normalizeAnswerContractRiskType(claim.riskType),
    confidence: normalizeConfidence(claim.confidence),
    evidenceIdCount: Array.isArray(claim.evidenceIds) ? claim.evidenceIds.length : 0,
    ...(options.includeClaimText ? { text: cleanText(claim.text).slice(0, 260) } : {}),
  }));

  return {
    version: Number(contract.version || ANSWER_CONTRACT_VERSION),
    parseStatus: cleanText(contract.parseStatus) || "invalid",
    claimCount: claims.length,
    riskTypes: [...new Set(claimSummaries.map((claim) => claim.riskType))],
    evidenceIdCoverageCount: claims.filter((claim) =>
      Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0
    ).length,
    invalidEvidenceIds,
    warnings: normalizeWarnings(contract.warnings),
    confidence: normalizeConfidence(contract.confidence),
    needsHandoff: Boolean(contract.needsHandoff),
    ...(options.includeClaimText ? { claims: claimSummaries } : {}),
  };
}
