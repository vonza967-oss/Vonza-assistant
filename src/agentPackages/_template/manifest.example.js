// Example only. Do not import this file from src/agentPackages/index.js.
// Copy it into a real package folder and rename every placeholder before registration.
import { examplePromptBlocks } from "./promptBlocks.example.js";
import { exampleToolKeys } from "./tools.example.js";
import { exampleKnowledgePolicy } from "./knowledgePolicy.example.js";

export const examplePackageIntents = Object.freeze([
  "general_question",
  "pricing",
  "availability",
  "booking",
  "human_handoff",
]);

export const examplePackageRiskRules = Object.freeze([
  "Do not invent prices, availability, policies, or booking confirmations.",
  "Use only package-approved evidence for factual claims.",
  "Route account-specific or private-record requests to a verified human handoff.",
]);

export const examplePackageManifest = Object.freeze({
  key: "example_package_key",
  version: "0.1.0",
  label: "Example Package",
  description:
    "Example-only package manifest shape for future agent packages. This is not registered and must not affect runtime.",
  supportedSurfaces: Object.freeze(["widget", "full_page", "web_call"]),
  role: Object.freeze({
    defaultName: "Example Assistant",
    identity: "package-specific front desk assistant",
    tone: "clear, grounded, and practical",
  }),
  intents: examplePackageIntents,
  riskRules: examplePackageRiskRules,
  promptBlocks: examplePromptBlocks,
  tools: exampleToolKeys,
  connectedAppRequirements: Object.freeze({
    reportOnly: true,
    requiredCapabilities: Object.freeze([]),
    optionalCapabilities: Object.freeze([]),
  }),
  knowledgePolicy: exampleKnowledgePolicy,
});

export default examplePackageManifest;
