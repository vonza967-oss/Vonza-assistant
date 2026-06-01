const FRONT_DESK_STRONG_SOURCE_TYPES = Object.freeze([
  "approved_answer",
  "business_profile",
  "website",
  "manual",
]);

function makeFrontDeskClaimPolicy(guidance) {
  return Object.freeze({
    allowedSourceTypes: FRONT_DESK_STRONG_SOURCE_TYPES,
    guidance,
  });
}

export const frontDeskGeneralKnowledgePolicy = Object.freeze({
  version: 1,
  packageKey: "front_desk_general",
  mode: "report-only",
  claimTypes: Object.freeze({
    pricing: makeFrontDeskClaimPolicy(
      "Pricing claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
    contact: makeFrontDeskClaimPolicy(
      "Contact claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
    service: makeFrontDeskClaimPolicy(
      "Service claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
    availability: makeFrontDeskClaimPolicy(
      "Availability claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
    policy: makeFrontDeskClaimPolicy(
      "Policy claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
    booking: makeFrontDeskClaimPolicy(
      "Booking claims may use current strong Front Desk sources. Keyword fallback is not strong support."
    ),
  }),
});

export default frontDeskGeneralKnowledgePolicy;
