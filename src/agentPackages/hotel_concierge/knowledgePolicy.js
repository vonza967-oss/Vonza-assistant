const DOCUMENTED_HOTEL_SOURCE_TYPES = Object.freeze([
  "approved_answer",
  "business_profile",
  "website",
  "manual",
]);

const LIVE_BOOKING_SOURCE_TYPES = Object.freeze([
  "live_booking",
]);

const GUEST_RECORD_SOURCE_TYPES = Object.freeze([
  "live_booking",
  "guest_record",
]);

function makeHotelClaimPolicy({ allowedSourceTypes, guidance, conditionalRules = [] }) {
  return Object.freeze({
    allowedSourceTypes,
    guidance,
    ...(conditionalRules.length
      ? { conditionalRules: Object.freeze(conditionalRules.map((rule) => Object.freeze(rule))) }
      : {}),
  });
}

export const hotelConciergeKnowledgePolicy = Object.freeze({
  version: 1,
  packageKey: "hotel_concierge",
  mode: "report-only",
  claimTypes: Object.freeze({
    availability: makeHotelClaimPolicy({
      allowedSourceTypes: LIVE_BOOKING_SOURCE_TYPES,
      guidance:
        "Live hotel availability needs live booking evidence. Website, manual, approved-answer, or profile facts are report-only insufficient for live availability claims.",
    }),
    pricing: makeHotelClaimPolicy({
      allowedSourceTypes: DOCUMENTED_HOTEL_SOURCE_TYPES,
      guidance:
        "Documented fees such as parking or pet fees may use documented hotel sources. Live room rates need live booking evidence.",
      conditionalRules: [
        {
          key: "live_room_rate",
          allowedSourceTypes: LIVE_BOOKING_SOURCE_TYPES,
          claimTextIncludesAny: Object.freeze([
            "current room rate",
            "current room rates",
            "live room rate",
            "live room rates",
            "nightly room rate",
            "nightly room rates",
            "room rate tonight",
            "room rates tonight",
            "available room rate",
            "available room rates",
            "rate for tonight",
            "rates for tonight",
            "rate for today",
            "rates for today",
          ]),
          claimTextPatterns: Object.freeze([
            "\\b(?:room|rooms|suite|suites)\\b.*\\b(?:rate|rates|price|prices|cost|costs)\\b",
            "\\b(?:rate|rates|price|prices|cost|costs)\\b.*\\b(?:room|rooms|suite|suites)\\b",
          ]),
          guidance: "Live room-rate claims require live booking evidence.",
        },
      ],
    }),
    policy: makeHotelClaimPolicy({
      allowedSourceTypes: DOCUMENTED_HOTEL_SOURCE_TYPES,
      guidance:
        "Documented hotel policies may use approved, business-profile, website, or manual evidence. Guest privacy remains staff-gated.",
    }),
    booking: makeHotelClaimPolicy({
      allowedSourceTypes: DOCUMENTED_HOTEL_SOURCE_TYPES,
      guidance:
        "Booking next-step guidance may use documented sources. Confirming, modifying, cancelling, or exposing a specific booking needs live booking or guest-record evidence.",
      conditionalRules: [
        {
          key: "guest_booking_record_action",
          allowedSourceTypes: GUEST_RECORD_SOURCE_TYPES,
          claimTextIncludesAny: Object.freeze([
            "confirmed your booking",
            "confirmed your reservation",
            "changed your booking",
            "changed your reservation",
            "modified your booking",
            "modified your reservation",
            "cancelled your booking",
            "canceled your booking",
            "cancelled your reservation",
            "canceled your reservation",
            "your room number",
            "reservation details",
          ]),
          claimTextPatterns: Object.freeze([
            "\\b(?:confirmed|changed|modified|cancelled|canceled|rescheduled)\\b.*\\b(?:booking|reservation|stay|room)\\b",
            "\\b(?:booking|reservation|stay)\\b.*\\b(?:is|has been|was)\\s+(?:confirmed|changed|modified|cancelled|canceled|rescheduled)\\b",
            "\\b(?:your|guest)\\b.*\\b(?:booking|reservation|room number|stay details)\\b",
          ]),
          guidance:
            "Guest-specific booking actions or reservation details require live booking or guest-record evidence.",
        },
      ],
    }),
    contact: makeHotelClaimPolicy({
      allowedSourceTypes: DOCUMENTED_HOTEL_SOURCE_TYPES,
      guidance:
        "Hotel contact claims may use approved, business-profile, website, or manual evidence.",
    }),
    service: makeHotelClaimPolicy({
      allowedSourceTypes: DOCUMENTED_HOTEL_SOURCE_TYPES,
      guidance:
        "Documented hotel amenities and services may use approved, business-profile, website, or manual evidence.",
    }),
  }),
  guidance: Object.freeze({
    guestPrivacy:
      "Do not expose room numbers, reservation details, or guest-specific stay details without staff-verified guest-record evidence.",
  }),
});

export default hotelConciergeKnowledgePolicy;
