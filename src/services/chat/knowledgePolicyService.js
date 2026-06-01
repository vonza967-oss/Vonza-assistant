import { cleanText } from "../../utils/text.js";
import { normalizeAnswerContractRiskType } from "./answerContractService.js";

export const KNOWLEDGE_POLICY_MODE = "report-only";

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePolicyKey(value = "") {
  return cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeSourceType(value = "") {
  return normalizePolicyKey(value);
}

function uniqueCleanList(value = []) {
  return Array.isArray(value)
    ? [...new Set(value.map(cleanText).filter(Boolean))]
    : [];
}

function uniqueSourceTypes(value = []) {
  return Array.isArray(value)
    ? [...new Set(value.map(normalizeSourceType).filter(Boolean))]
    : [];
}

function normalizeMode(value = "") {
  const normalized = cleanText(value).toLowerCase().replace(/[\s_]+/g, "-");
  return normalized === KNOWLEDGE_POLICY_MODE ? KNOWLEDGE_POLICY_MODE : KNOWLEDGE_POLICY_MODE;
}

function normalizeGuidance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, text]) => [normalizePolicyKey(key), cleanText(text)])
      .filter(([key, text]) => key && text)
  );
}

function normalizeConditionalRule(rule = {}, index = 0) {
  const safeRule = toPlainObject(rule);
  const allowedSourceTypes = uniqueSourceTypes(
    safeRule.allowedSourceTypes ||
      safeRule.allowed_source_types ||
      safeRule.allowedEvidenceSourceTypes ||
      safeRule.allowed_evidence_source_types
  );

  if (!allowedSourceTypes.length) {
    return null;
  }

  return {
    key: normalizePolicyKey(safeRule.key || safeRule.ruleKey || `rule_${index + 1}`),
    allowedSourceTypes,
    claimTextIncludesAny: uniqueCleanList(
      safeRule.claimTextIncludesAny ||
        safeRule.claim_text_includes_any ||
        safeRule.includesAny ||
        safeRule.includes_any
    ).map((value) => value.toLowerCase()),
    claimTextPatterns: uniqueCleanList(
      safeRule.claimTextPatterns ||
        safeRule.claim_text_patterns ||
        safeRule.patterns
    ),
    guidance: cleanText(safeRule.guidance),
  };
}

function normalizeClaimPolicy(value = {}) {
  const source = Array.isArray(value)
    ? { allowedSourceTypes: value }
    : toPlainObject(value);
  const allowedSourceTypes = uniqueSourceTypes(
    source.allowedSourceTypes ||
      source.allowed_source_types ||
      source.allowedEvidenceSourceTypes ||
      source.allowed_evidence_source_types ||
      source.strongSourceTypes ||
      source.strong_source_types
  );
  const conditionalRules = Array.isArray(source.conditionalRules || source.conditional_rules)
    ? (source.conditionalRules || source.conditional_rules)
        .map((rule, index) => normalizeConditionalRule(rule, index))
        .filter(Boolean)
    : [];

  return {
    allowedSourceTypes,
    conditionalRules,
    guidance: cleanText(source.guidance),
  };
}

function normalizeClaimTypes(value = {}) {
  const source = toPlainObject(value);

  return Object.fromEntries(
    Object.entries(source)
      .map(([riskType, policy]) => [
        normalizeAnswerContractRiskType(riskType),
        normalizeClaimPolicy(policy),
      ])
      .filter(([riskType, policy]) => riskType && (
        policy.allowedSourceTypes.length ||
        policy.conditionalRules.length ||
        policy.guidance
      ))
  );
}

function extractPolicySource(agentPackageOrPolicy = {}) {
  const source = toPlainObject(agentPackageOrPolicy);
  const nestedPolicy = toPlainObject(source.knowledgePolicy || source.knowledge_policy);

  if (Object.keys(nestedPolicy).length) {
    return {
      packageSource: source,
      policySource: nestedPolicy,
    };
  }

  return {
    packageSource: source,
    policySource: source,
  };
}

export function normalizeKnowledgePolicy(agentPackageOrPolicy = {}) {
  const { packageSource, policySource } = extractPolicySource(agentPackageOrPolicy);
  const claimTypes = normalizeClaimTypes(
    policySource.claimTypes ||
      policySource.claim_types ||
      policySource.allowedSourceTypesByRiskType ||
      policySource.allowed_source_types_by_risk_type
  );
  const packageKey = normalizePolicyKey(
    policySource.packageKey ||
      policySource.package_key ||
      packageSource.key ||
      packageSource.packageKey ||
      packageSource.package_key
  );

  if (!packageKey && !Object.keys(claimTypes).length) {
    return null;
  }

  return {
    version: Number(policySource.version || 1),
    packageKey,
    mode: normalizeMode(policySource.mode),
    claimTypes,
    guidance: normalizeGuidance(policySource.guidance),
  };
}

export function getAllowedEvidenceSourceTypes(agentPackageOrPolicy = {}, riskType = "") {
  const policy = normalizeKnowledgePolicy(agentPackageOrPolicy);
  const normalizedRiskType = normalizeAnswerContractRiskType(riskType);

  return policy?.claimTypes?.[normalizedRiskType]?.allowedSourceTypes || [];
}

function claimTextMatchesRule(claim = {}, rule = {}) {
  const text = cleanText(claim.text || claim.claim || claim.answer).toLowerCase();

  if (!text) {
    return false;
  }

  if ((rule.claimTextIncludesAny || []).some((needle) => needle && text.includes(needle))) {
    return true;
  }

  return (rule.claimTextPatterns || []).some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return false;
    }
  });
}

function selectClaimPolicyRule(policy, claim = {}) {
  const riskType = normalizeAnswerContractRiskType(claim.riskType);
  const baseRule = policy?.claimTypes?.[riskType];

  if (!baseRule) {
    return null;
  }

  const conditionalRule = (baseRule.conditionalRules || []).find((rule) =>
    claimTextMatchesRule(claim, rule)
  );

  if (conditionalRule) {
    return {
      ...baseRule,
      ...conditionalRule,
      riskType,
      ruleKey: conditionalRule.key,
    };
  }

  return {
    ...baseRule,
    riskType,
    ruleKey: riskType,
  };
}

function makeEvidenceMap(evidencePack = {}) {
  const items = Array.isArray(evidencePack.items) ? evidencePack.items : [];

  return new Map(
    items
      .map((item) => [cleanText(item?.id), item])
      .filter(([id]) => id)
  );
}

function resolveEvidenceItems({ claim = {}, evidenceItems = [], evidencePack = {} } = {}) {
  if (Array.isArray(evidenceItems) && evidenceItems.length) {
    return evidenceItems;
  }

  const evidenceIds = Array.isArray(claim.evidenceIds)
    ? claim.evidenceIds.map(cleanText).filter(Boolean)
    : [];
  const evidenceMap = makeEvidenceMap(evidencePack);

  return evidenceIds
    .filter((id) => evidenceMap.has(id))
    .map((id) => evidenceMap.get(id));
}

export function evaluateClaimEvidencePolicy({
  claim = {},
  evidenceItems = [],
  agentPackage,
  knowledgePolicy,
  evidencePack = {},
} = {}) {
  const policy = normalizeKnowledgePolicy(
    knowledgePolicy ||
      agentPackage ||
      evidencePack.knowledgePolicy ||
      evidencePack.knowledge_policy
  );
  const riskType = normalizeAnswerContractRiskType(claim.riskType);

  if (!policy) {
    return {
      status: "skipped",
      mode: KNOWLEDGE_POLICY_MODE,
      riskType,
      allowed: false,
      allowedSourceTypes: [],
      matchedSourceTypes: [],
      evidenceIdCount: 0,
      allowedEvidenceCount: 0,
      unsupportedEvidenceCount: 0,
      notes: ["knowledge_policy_unavailable"],
    };
  }

  const selectedRule = selectClaimPolicyRule(policy, { ...claim, riskType });

  if (!selectedRule) {
    return {
      version: policy.version,
      packageKey: policy.packageKey,
      mode: policy.mode,
      status: "skipped",
      riskType,
      allowed: false,
      allowedSourceTypes: [],
      matchedSourceTypes: [],
      evidenceIdCount: 0,
      allowedEvidenceCount: 0,
      unsupportedEvidenceCount: 0,
      notes: ["risk_type_not_configured_by_policy"],
    };
  }

  const resolvedEvidenceItems = resolveEvidenceItems({
    claim,
    evidenceItems,
    evidencePack,
  });
  const allowedSourceTypes = selectedRule.allowedSourceTypes || [];
  const allowedSourceTypeSet = new Set(allowedSourceTypes);
  const matchedSourceTypes = uniqueSourceTypes(
    resolvedEvidenceItems.map((item) => item?.sourceType || item?.source_type)
  );
  const allowedEvidenceCount = resolvedEvidenceItems.filter((item) =>
    allowedSourceTypeSet.has(normalizeSourceType(item?.sourceType || item?.source_type))
  ).length;
  const unsupportedEvidenceCount = Math.max(0, resolvedEvidenceItems.length - allowedEvidenceCount);
  const notes = [];

  if (!resolvedEvidenceItems.length) {
    notes.push("claim_has_no_evidence_for_policy");
  }

  if (unsupportedEvidenceCount > 0) {
    notes.push("source_type_not_allowed_by_package_policy");
  }

  if (selectedRule.ruleKey && selectedRule.ruleKey !== riskType) {
    notes.push(`matched_policy_rule:${selectedRule.ruleKey}`);
  }

  return {
    version: policy.version,
    packageKey: policy.packageKey,
    mode: policy.mode,
    status: "checked",
    riskType,
    ruleKey: selectedRule.ruleKey,
    allowed: allowedEvidenceCount > 0,
    allowedSourceTypes,
    matchedSourceTypes,
    evidenceIdCount: resolvedEvidenceItems.length,
    allowedEvidenceCount,
    unsupportedEvidenceCount,
    notes: [...new Set(notes)],
  };
}

export function summarizeKnowledgePolicyForDebug(agentPackageOrPolicy = {}) {
  const policy = normalizeKnowledgePolicy(agentPackageOrPolicy);

  if (!policy) {
    return null;
  }

  return {
    version: policy.version,
    packageKey: policy.packageKey,
    mode: policy.mode,
    claimTypes: Object.fromEntries(
      Object.entries(policy.claimTypes)
        .map(([riskType, claimPolicy]) => [
          riskType,
          {
            allowedSourceTypes: claimPolicy.allowedSourceTypes,
            ...(claimPolicy.conditionalRules.length
              ? {
                  conditionalRules: claimPolicy.conditionalRules.map((rule) => ({
                    key: rule.key,
                    allowedSourceTypes: rule.allowedSourceTypes,
                    claimTextIncludesAny: rule.claimTextIncludesAny,
                    claimTextPatterns: rule.claimTextPatterns,
                  })),
                }
              : {}),
          },
        ])
    ),
    ...(Object.keys(policy.guidance).length ? { guidance: policy.guidance } : {}),
  };
}
