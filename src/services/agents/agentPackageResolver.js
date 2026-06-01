import {
  DEFAULT_AGENT_PACKAGE_KEY,
  getAgentPackage,
} from "../../agentPackages/index.js";

function normalizeCandidateKey(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPackageSource(value) {
  return value && typeof value === "object" ? value : {};
}

function firstMatchingPackageKey(source, keys) {
  for (const key of keys) {
    const candidate = normalizeCandidateKey(source[key]);

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function firstPackageKeyCandidate(agent = {}, options = {}) {
  const safeAgent = toPackageSource(agent);
  const safeOptions = toPackageSource(options);
  const optionCandidate = firstMatchingPackageKey(safeOptions, [
    "packageKey",
    "package_key",
    "agentPackageKey",
    "agent_package_key",
  ]);

  if (optionCandidate) {
    return optionCandidate;
  }

  return firstMatchingPackageKey(safeAgent, [
    "packageKey",
    "package_key",
  ]) || DEFAULT_AGENT_PACKAGE_KEY;
}

export function resolveAgentPackage(agent = {}, options = {}) {
  return getAgentPackage(firstPackageKeyCandidate(agent, options));
}
