import { cleanText } from "../../utils/text.js";
import { listEnterpriseRequestDeskLanes } from "./enterpriseRequestDeskLaneService.js";

const GENERIC_SERVICE_TYPES = Object.freeze([
  "őrzés-védelem",
  "portaszolgálat / objektumvédelem",
  "facility management",
  "biztonságtechnika",
  "hatósági / audit támogatás",
]);

const ESG_SERVICE_TYPES = Object.freeze([
  "Őrzés-védelem",
  "Portaszolgálat / objektumvédelem",
  "Facility Management",
  "Biztonságtechnika",
  "Hatósági / audit támogatás",
  "Vegyes vállalati megkeresés",
]);

export const ENTERPRISE_REQUEST_DESK_PROFILES = Object.freeze({
  enterprise: Object.freeze({
    key: "enterprise",
    productName: "Enterprise Request Desk",
    productNameHu: "Enterprise Megkereséskezelő",
    routePrefix: "/enterprise-request-desk",
    businessNameFallback: "Enterprise Request Desk",
    serviceAreaFallback: "egyeztetett vállalati helyszínek",
    serviceTypes: GENERIC_SERVICE_TYPES,
    customerIntakeGuidanceHu:
      "Ezt a linket add meg a vállalati megkeresések belépési pontjaként. A link nyilvános agent kulcsot használ, nem tulajdonosi azonosítót.",
    missingCustomerIntakeGuidanceHu:
      "Customer intake linkhez aktív, nyilvános agent kulccsal rendelkező Enterprise Request Desk agent szükséges.",
  }),
  esg: Object.freeze({
    key: "esg",
    productName: "ESG Request Desk",
    productNameHu: "ESG Megkereséskezelő",
    routePrefix: "/esg-request-desk",
    businessNameFallback: "ESG Holding Zrt.",
    serviceAreaFallback: "egyeztetett ESG vállalati helyszínek",
    serviceTypes: ESG_SERVICE_TYPES,
    customerIntakeGuidanceHu:
      "Ezt a linket add meg az ESG objektumvédelmi, FM vagy biztonságtechnikai megkeresések belépési pontjaként. A link nyilvános agent kulcsot használ, nem tulajdonosi azonosítót.",
    missingCustomerIntakeGuidanceHu:
      "Aktív nyilvános agent kulcs szükséges, mielőtt az ESG ügyféloldali intake link használható.",
  }),
});

export function resolveEnterpriseRequestDeskProfile(value = "") {
  const source = typeof value === "string"
    ? value
    : `${value?.path || value?.originalUrl || value?.url || ""}`;

  return source.startsWith("/esg-request-desk")
    ? ENTERPRISE_REQUEST_DESK_PROFILES.esg
    : ENTERPRISE_REQUEST_DESK_PROFILES.enterprise;
}

export function buildEnterpriseRequestDeskBusinessContext(agent = {}, profile = ENTERPRISE_REQUEST_DESK_PROFILES.enterprise) {
  return {
    businessName: profile.key === "esg"
      ? profile.businessNameFallback
      : cleanText(agent.name) || profile.businessNameFallback,
    serviceArea: profile.serviceAreaFallback,
    serviceTypes: [...profile.serviceTypes],
  };
}

export function listEnterpriseRequestDeskProfileLanes(profile = ENTERPRISE_REQUEST_DESK_PROFILES.enterprise) {
  const lanes = listEnterpriseRequestDeskLanes().map((lane) => ({
    key: lane.key,
    labelHu: lane.labelHu,
  }));

  if (profile.key !== "esg") {
    return lanes;
  }

  return lanes
    .filter((lane) => lane.key !== "general_enquiry")
    .map((lane) => {
      if (lane.key === "facility_management") {
        return { ...lane, labelHu: "Facility Management" };
      }
      if (lane.key === "audit_compliance") {
        return { ...lane, labelHu: "Hatósági / audit támogatás" };
      }
      return lane;
    });
}

export function buildEnterpriseRequestDeskProfileDto(profile = ENTERPRISE_REQUEST_DESK_PROFILES.enterprise) {
  return {
    key: profile.key,
    productName: profile.productName,
    productNameHu: profile.productNameHu,
    routePrefix: profile.routePrefix,
    serviceTypes: [...profile.serviceTypes],
    lanes: listEnterpriseRequestDeskProfileLanes(profile),
  };
}
