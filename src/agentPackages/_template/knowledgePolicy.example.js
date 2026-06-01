// Example only. Knowledge policy checks are report-only and must not block or rewrite answers.
const EXAMPLE_STRONG_SOURCE_TYPES = Object.freeze([
  "approved_answer",
  "business_profile",
  "website",
  "manual",
]);

function makeExampleClaimPolicy(guidance) {
  return Object.freeze({
    allowedSourceTypes: EXAMPLE_STRONG_SOURCE_TYPES,
    guidance,
  });
}

export const exampleKnowledgePolicy = Object.freeze({
  version: 1,
  packageKey: "example_package_key",
  mode: "report-only",
  claimTypes: Object.freeze({
    pricing: makeExampleClaimPolicy(
      "Example pricing claims need approved, profile, website, or manual evidence."
    ),
    contact: makeExampleClaimPolicy(
      "Example contact claims need approved, profile, website, or manual evidence."
    ),
    service: makeExampleClaimPolicy(
      "Example service claims need approved, profile, website, or manual evidence."
    ),
    availability: makeExampleClaimPolicy(
      "Example availability claims need approved, profile, website, or manual evidence."
    ),
    policy: makeExampleClaimPolicy(
      "Example policy claims need approved, profile, website, or manual evidence."
    ),
    booking: makeExampleClaimPolicy(
      "Example booking claims need approved, profile, website, or manual evidence."
    ),
  }),
});

export default exampleKnowledgePolicy;
