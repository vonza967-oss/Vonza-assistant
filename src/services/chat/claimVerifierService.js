import { cleanText } from "../../utils/text.js";
import { normalizeAnswerContractRiskType } from "./answerContractService.js";

export const CLAIM_VERIFIER_VERSION = 1;
export const CLAIM_VERIFIER_MODE = "report-only";

const RISKY_CLAIM_TYPES = new Set([
  "pricing",
  "contact",
  "service",
  "availability",
  "policy",
  "booking",
]);

const STRONG_TRUST_LEVELS = new Set([
  "owner_approved",
  "reviewed_business_fact",
  "retrieved_website",
]);

const STRONG_SOURCE_TYPES = new Set([
  "approved_answer",
  "business_profile",
  "website",
  "manual",
]);

const WEAK_TRUST_LEVELS = new Set(["weak_fallback"]);
const WEAK_SOURCE_TYPES = new Set(["keyword_fallback"]);

function normalizeConfidence(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return ["high", "medium", "low", "none"].includes(normalized) ? normalized : "none";
}

function uniqueCleanList(value = []) {
  return Array.isArray(value)
    ? [...new Set(value.map(cleanText).filter(Boolean))]
    : [];
}

function hasEvidencePack(evidencePack = {}) {
  return Array.isArray(evidencePack.items);
}

function makeEvidenceMap(evidencePack = {}) {
  const items = Array.isArray(evidencePack.items) ? evidencePack.items : [];
  return new Map(
    items
      .map((item) => [cleanText(item?.id), item])
      .filter(([id]) => id)
  );
}

function getEvidenceStrength(item = {}) {
  const trustLevel = cleanText(item.trustLevel).toLowerCase();
  const sourceType = cleanText(item.sourceType).toLowerCase();

  if (STRONG_TRUST_LEVELS.has(trustLevel) || STRONG_SOURCE_TYPES.has(sourceType)) {
    return "strong";
  }

  if (WEAK_TRUST_LEVELS.has(trustLevel) || WEAK_SOURCE_TYPES.has(sourceType)) {
    return "weak";
  }

  return "unknown";
}

function makeBaseReport(status = "checked", warnings = []) {
  return {
    version: CLAIM_VERIFIER_VERSION,
    mode: CLAIM_VERIFIER_MODE,
    status,
    claimsChecked: 0,
    supportedRiskyClaims: 0,
    unsupportedRiskyClaims: 0,
    invalidEvidenceReferences: 0,
    lowConfidenceClaims: 0,
    results: [],
    warnings: uniqueCleanList(warnings),
  };
}

function shouldSkip(answerContract = {}, evidencePack = {}) {
  if (!answerContract || typeof answerContract !== "object" || Array.isArray(answerContract)) {
    return "missing_answer_contract";
  }

  if (answerContract.parseStatus !== "parsed") {
    return "answer_contract_not_parsed";
  }

  if (!Array.isArray(answerContract.claims)) {
    return "answer_contract_claims_missing";
  }

  if (!hasEvidencePack(evidencePack)) {
    return "evidence_pack_missing";
  }

  return "";
}

function verifyClaim(claim = {}, claimIndex, evidenceMap) {
  const riskType = normalizeAnswerContractRiskType(claim.riskType);
  const evidenceIds = uniqueCleanList(claim.evidenceIds);
  const explicitInvalidEvidenceIds = uniqueCleanList(claim.invalidEvidenceIds);
  const missingEvidenceIds = evidenceIds.filter((id) => !evidenceMap.has(id));
  const invalidEvidenceIds = uniqueCleanList([
    ...explicitInvalidEvidenceIds,
    ...missingEvidenceIds,
  ]);
  const validEvidenceItems = evidenceIds
    .filter((id) => evidenceMap.has(id))
    .map((id) => evidenceMap.get(id));
  const evidenceStrengths = validEvidenceItems.map(getEvidenceStrength);
  const hasStrongEvidence = evidenceStrengths.includes("strong");
  const hasWeakEvidence = evidenceStrengths.includes("weak");
  const isRisky = RISKY_CLAIM_TYPES.has(riskType);
  const confidence = normalizeConfidence(claim.confidence);
  const notes = [];
  let verdict;

  if (invalidEvidenceIds.length) {
    verdict = "unknown_evidence";
    notes.push("claim_references_evidence_not_in_pack");
  } else if (!isRisky) {
    verdict = "not_risky";
  } else if (!evidenceIds.length) {
    verdict = "unsupported";
    notes.push("risky_claim_has_no_evidence");
  } else if (hasStrongEvidence) {
    verdict = "supported";
  } else if (hasWeakEvidence) {
    verdict = "low_confidence";
    notes.push("risky_claim_only_has_weak_fallback_evidence");
  } else if (confidence === "low" || confidence === "none") {
    verdict = "low_confidence";
    notes.push("risky_claim_has_low_confidence");
  } else {
    verdict = "unsupported";
    notes.push("risky_claim_has_no_strong_evidence");
  }

  if (
    isRisky
    && !hasStrongEvidence
    && !invalidEvidenceIds.length
    && evidenceIds.length
    && (confidence === "low" || confidence === "none")
    && !notes.includes("risky_claim_has_low_confidence")
  ) {
    notes.push("risky_claim_has_low_confidence");
  }

  return {
    claimIndex,
    riskType,
    verdict,
    evidenceIds: evidenceIds.filter((id) => evidenceMap.has(id)),
    invalidEvidenceIds,
    notes,
  };
}

export function verifyClaimSupport(answerContract = {}, evidencePack = {}) {
  const skipReason = shouldSkip(answerContract, evidencePack);

  if (skipReason) {
    return makeBaseReport("skipped", [skipReason]);
  }

  const evidenceMap = makeEvidenceMap(evidencePack);
  const results = answerContract.claims.map((claim, index) =>
    verifyClaim(claim, index, evidenceMap)
  );

  return {
    ...makeBaseReport("checked"),
    claimsChecked: results.length,
    supportedRiskyClaims: results.filter((result) =>
      RISKY_CLAIM_TYPES.has(result.riskType) && result.verdict === "supported"
    ).length,
    unsupportedRiskyClaims: results.filter((result) =>
      RISKY_CLAIM_TYPES.has(result.riskType) && result.verdict === "unsupported"
    ).length,
    invalidEvidenceReferences: results.reduce(
      (sum, result) => sum + result.invalidEvidenceIds.length,
      0
    ),
    lowConfidenceClaims: results.filter((result) =>
      RISKY_CLAIM_TYPES.has(result.riskType) && result.verdict === "low_confidence"
    ).length,
    results,
  };
}

export function summarizeClaimVerifierForDebug(report = {}, options = {}) {
  const results = Array.isArray(report.results) ? report.results : [];

  return {
    version: Number(report.version || CLAIM_VERIFIER_VERSION),
    mode: cleanText(report.mode) || CLAIM_VERIFIER_MODE,
    status: cleanText(report.status) || "skipped",
    claimsChecked: Number(report.claimsChecked || 0),
    supportedRiskyClaims: Number(report.supportedRiskyClaims || 0),
    unsupportedRiskyClaims: Number(report.unsupportedRiskyClaims || 0),
    invalidEvidenceReferences: Number(report.invalidEvidenceReferences || 0),
    lowConfidenceClaims: Number(report.lowConfidenceClaims || 0),
    verdicts: results.reduce((counts, result) => {
      const verdict = cleanText(result.verdict) || "unknown";
      counts[verdict] = Number(counts[verdict] || 0) + 1;
      return counts;
    }, {}),
    results: results.map((result) => ({
      claimIndex: Number(result.claimIndex || 0),
      riskType: normalizeAnswerContractRiskType(result.riskType),
      verdict: cleanText(result.verdict),
      evidenceIdCount: Array.isArray(result.evidenceIds) ? result.evidenceIds.length : 0,
      invalidEvidenceIdCount: Array.isArray(result.invalidEvidenceIds)
        ? result.invalidEvidenceIds.length
        : 0,
      notes: uniqueCleanList(result.notes),
      ...(options.includeEvidenceIds === true
        ? {
            evidenceIds: uniqueCleanList(result.evidenceIds),
            invalidEvidenceIds: uniqueCleanList(result.invalidEvidenceIds),
          }
        : {}),
    })),
    warnings: uniqueCleanList(report.warnings),
  };
}
