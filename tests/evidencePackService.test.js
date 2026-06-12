import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidencePack,
  renderEvidencePackForPrompt,
  summarizeEvidencePackForDebug,
} from "../src/services/chat/evidencePackService.js";
import { getAgentPackage } from "../src/agentPackages/index.js";

test("Evidence Pack maps retrieval sources to stable trust levels and counts", () => {
  const pack = buildEvidencePack({
    approvedAnswers: [
      {
        id: "approved-1",
        triggerText: "refund policy",
        answerText: "Refund requests are reviewed within two business days.",
      },
    ],
    businessProfileFacts: "Services: website design. Pricing: quote-based.",
    semanticChunks: [
      {
        id: "profile-chunk-1",
        sourceType: "business_profile",
        title: "Business profile",
        content: "Operating hours: Monday to Friday.",
        similarity: 0.82,
      },
      {
        id: "website-chunk-1",
        sourceType: "website",
        title: "Pricing",
        sourceUrl: "https://acme.test/pricing",
        content: "Project costs are scoped after discovery.",
        similarity: 0.67,
      },
      {
        id: "manual-chunk-1",
        sourceType: "manual",
        title: "Manual note",
        content: "The shop handles priority callbacks by request.",
        similarity: 0.61,
      },
    ],
    keywordFallbackContext: "Most relevant website excerpts:\nFallback note only.",
    retrievalConfidence: "high",
  });

  assert.equal(pack.version, 1);
  assert.equal(pack.confidence, "high");
  assert.deepEqual(pack.counts, {
    approvedAnswers: 1,
    businessProfileFacts: 2,
    websiteChunks: 2,
    keywordFallback: 1,
  });
  assert.equal(pack.items.find((item) => item.id === "approved_answer:approved-1").trustLevel, "owner_approved");
  assert.equal(pack.items.find((item) => item.id === "business_profile:facts").trustLevel, "reviewed_business_fact");
  assert.equal(pack.items.find((item) => item.id === "website:website-chunk-1").trustLevel, "retrieved_website");
  assert.equal(pack.items.find((item) => item.id === "keyword_fallback:context").trustLevel, "weak_fallback");
});

test("Evidence Pack prompt rendering preserves source priority and missing-info rules", () => {
  const pack = buildEvidencePack({
    approvedAnswers: [
      {
        id: "approved-1",
        triggerText: "refund policy",
        answerText: "Refund requests are reviewed within two business days.",
      },
    ],
    businessProfileFacts: "Services: website design.",
    semanticChunks: [
      {
        id: "website-1",
        sourceType: "website",
        title: "Pricing",
        content: "Pricing is quote-based.",
        similarity: 0.5,
      },
    ],
    retrievalConfidence: "medium",
  });
  const rendered = renderEvidencePackForPrompt(pack);

  const ownerIndex = rendered.indexOf("OWNER-APPROVED ANSWERS");
  const businessIndex = rendered.indexOf("BUSINESS PROFILE FACTS:");
  const websiteIndex = rendered.indexOf("WEBSITE CONTEXT:");

  assert.ok(ownerIndex !== -1);
  assert.ok(businessIndex > ownerIndex);
  assert.ok(websiteIndex > businessIndex);
  assert.match(rendered, /Context priority: active owner-approved answers first/);
  assert.match(rendered, /Front Desk does not have that detail/);
  assert.match(rendered, /RETRIEVAL CONFIDENCE:\nmedium/);
});

test("Evidence Pack renders uploaded knowledge files as trusted owner context", () => {
  const pack = buildEvidencePack({
    semanticChunks: [
      {
        id: "uploaded-file-chunk-1",
        sourceType: "manual",
        title: "services.md",
        content: "Emergency support visits are available after owner triage.",
        metadata: {
          origin: "uploaded_knowledge_file",
          knowledge_file_id: "file-1",
          filename: "services.md",
        },
        similarity: 0.74,
      },
    ],
    retrievalConfidence: "medium",
  });
  const uploadedItem = pack.items.find((item) => item.id === "manual:uploaded-file-chunk-1");
  const rendered = renderEvidencePackForPrompt(pack);

  assert.equal(uploadedItem.trustLevel, "reviewed_business_fact");
  assert.equal(uploadedItem.metadata.origin, "uploaded_knowledge_file");
  assert.match(rendered, /OWNER-UPLOADED KNOWLEDGE FILES:/);
  assert.match(rendered, /Emergency support visits are available after owner triage/);
  assert.match(rendered, /Context priority: active owner-approved answers first, business profile facts and owner-uploaded knowledge files second/);
});

test("Evidence Pack sanitizes placeholder contact details and debug summaries omit content", () => {
  const pack = buildEvidencePack({
    approvedAnswers: [
      {
        id: "placeholder-answer",
        triggerText: "contact",
        answerText: "Email test@example.com or call 555-555-5555.",
      },
    ],
    semanticChunks: [
      {
        id: "contact-page",
        sourceType: "website",
        title: "Contact",
        content: "Reach us at support@vonza.app or 123-456-7890.",
      },
    ],
    keywordFallbackContext: "Most relevant website excerpts:\nContact example@test.com.",
    retrievalConfidence: "low",
  });
  const rendered = renderEvidencePackForPrompt(pack);
  const summary = summarizeEvidencePackForDebug(pack);

  assert.doesNotMatch(rendered, /test@example\.com|555-555-5555|support@vonza\.app|123-456-7890|example@test\.com/i);
  assert.ok(summary.items.length > 0);
  assert.ok(summary.items.every((item) =>
    Object.keys(item).sort().join(",") === "id,sourceType,trustLevel"
  ));
  assert.equal(JSON.stringify(summary).includes("Email"), false);
});

test("Evidence Pack debug summary includes safe package knowledge policy metadata", () => {
  const pack = buildEvidencePack({
    agentPackage: getAgentPackage("hotel_concierge"),
    businessProfileFacts: "Guest privacy: staff must handle reservation details.",
    semanticChunks: [
      {
        id: "hotel-policy",
        sourceType: "website",
        title: "Hotel policy",
        content: "Parking and pet fee details are documented on the hotel website.",
      },
    ],
    retrievalConfidence: "medium",
  });
  const summary = summarizeEvidencePackForDebug(pack);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.knowledgePolicy.packageKey, "hotel_concierge");
  assert.equal(summary.knowledgePolicy.mode, "report-only");
  assert.deepEqual(summary.knowledgePolicy.claimTypes.availability.allowedSourceTypes, ["live_booking"]);
  assert.ok(summary.knowledgePolicy.claimTypes.policy.allowedSourceTypes.includes("website"));
  assert.doesNotMatch(serialized, /Guest privacy: staff|Parking and pet fee details/i);
});
