import frontDeskGeneralManifest from "./front_desk_general/manifest.js";
import hotelConciergeManifest from "./hotel_concierge/manifest.js";

export const DEFAULT_AGENT_PACKAGE_KEY = "front_desk_general";

const AGENT_PACKAGES = Object.freeze([
  frontDeskGeneralManifest,
  hotelConciergeManifest,
]);
const AGENT_PACKAGE_BY_KEY = new Map(
  AGENT_PACKAGES.map((agentPackage) => [agentPackage.key, agentPackage])
);

function normalizeAgentPackageKey(key) {
  if (typeof key !== "string") {
    return "";
  }

  return key.trim().toLowerCase();
}

export function isKnownAgentPackageKey(key) {
  return AGENT_PACKAGE_BY_KEY.has(normalizeAgentPackageKey(key));
}

export function getAgentPackage(key = DEFAULT_AGENT_PACKAGE_KEY) {
  const normalizedKey = normalizeAgentPackageKey(key);

  return (
    AGENT_PACKAGE_BY_KEY.get(normalizedKey)
    || AGENT_PACKAGE_BY_KEY.get(DEFAULT_AGENT_PACKAGE_KEY)
  );
}

export function listAgentPackages() {
  return Object.freeze([...AGENT_PACKAGES]);
}
