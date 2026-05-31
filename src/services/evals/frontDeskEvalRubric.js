import {
  appearsHungarian,
  cleanText,
  extractEmails,
  extractPhoneCandidates,
} from "../../utils/text.js";

export const FRONT_DESK_EVAL_RUBRIC = Object.freeze([
  "groundednessNoInventedFacts",
  "riskyClaimsBackedByEvidence",
  "missingInfoHandling",
  "contactSafety",
  "pricingSafety",
  "usefulNextStep",
  "languageCorrectness",
  "conciseFrontDeskStyle",
]);

const SECRET_PATTERN = /\b(?:sk|sess|eph|tok|key|secret)[-_][A-Za-z0-9_-]{8,}\b/g;
const SECRET_KEY_VALUE_PATTERN = /\b(api[_-]?key|authorization|bearer|client[_-]?secret|openai[_-]?api[_-]?key|speech[_-]?token|realtime[_-]?token)\s*[:=]\s*["']?[^"',\s]+/gi;
const PRICE_PATTERN = /(?:[$€£]\s?\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s?(?:dollars?|dollár(?:t|ba|ért)?|usd|eur|euros?|huf|forint|ft)\b)/gi;
const HOSTILE_TONE_PATTERN = /\b(stupid|idiot|calm down|not my problem|whatever|ridiculous request)\b/i;
const TEMPLATE_FILLER_PATTERN = /\b(as an ai|based on the information provided|it seems that|i am just an ai)\b/i;
const SAFE_UNCERTAINTY_PATTERN = /\b(do not have|don't have|does not list|not listed|not shown|not confirmed|cannot confirm|can't confirm|Front Desk does not have|I do not have|nem látok|nincs megadva|nem szerepel)\b/i;

function normalizeReplyList(input = {}) {
  if (Array.isArray(input.replies)) {
    return input.replies.map((reply) => String(reply || ""));
  }

  if (input.reply) {
    return [String(input.reply || "")];
  }

  return [];
}

function wordCount(value = "") {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function matchesPattern(pattern, value = "") {
  if (!pattern) {
    return false;
  }

  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }

  const normalizedPattern = cleanText(String(pattern || "")).toLowerCase();
  return normalizedPattern
    ? cleanText(value).toLowerCase().includes(normalizedPattern)
    : false;
}

function matchesAll(patterns = [], value = "") {
  return patterns.every((pattern) => matchesPattern(pattern, value));
}

function matchesAny(patterns = [], value = "") {
  return patterns.some((pattern) => matchesPattern(pattern, value));
}

function requiredAnyGroupsPass(groups = [], value = "") {
  return groups.every((group) => matchesAny(group, value));
}

function buildCriterion(passed, notes = []) {
  return {
    passed: Boolean(passed),
    score: passed ? 1 : 0,
    notes: notes.map(sanitizeFrontDeskEvalNote).filter(Boolean),
  };
}

function buildFailedCriteria(criteria = {}) {
  return Object.entries(criteria)
    .filter(([, value]) => !value.passed)
    .map(([key]) => key);
}

function extractPrices(value = "") {
  return [...new Set((String(value || "").match(PRICE_PATTERN) || []).map(cleanText).filter(Boolean))];
}

function normalizePhoneDigits(value = "") {
  return cleanText(value).replace(/\D/g, "");
}

function contactDetailsAreAllowed(reply = "", expectations = {}) {
  const allowedEmails = new Set((expectations.allowedEmails || []).map((email) => cleanText(email).toLowerCase()));
  const allowedPhones = new Set((expectations.allowedPhones || []).map(normalizePhoneDigits).filter(Boolean));
  const emails = extractEmails(reply);
  const phones = extractPhoneCandidates(reply);
  const unsafeEmail = emails.find((email) => !allowedEmails.has(cleanText(email).toLowerCase()));
  const unsafePhone = phones.find((phone) => !allowedPhones.has(normalizePhoneDigits(phone)));

  return {
    passed: !unsafeEmail && !unsafePhone,
    unsafeEmail,
    unsafePhone,
    contactCount: emails.length + phones.length,
  };
}

function pricesAreAllowed(reply = "", expectations = {}) {
  const prices = extractPrices(reply);
  const allowed = expectations.allowedPricePatterns || [];
  const unsupported = prices.find((price) => !matchesAny(allowed, price));

  return {
    passed: !unsupported,
    prices,
    unsupported,
  };
}

function hasUsefulNextStep(scenario, replies = []) {
  const expectations = scenario.expectations || {};

  if (!expectations.nextStepRequired) {
    return true;
  }

  const finalReply = replies[replies.length - 1] || "";
  return matchesPattern(expectations.nextStepPattern, finalReply);
}

export function sanitizeFrontDeskEvalNote(value = "") {
  let sanitized = String(value || "");

  extractEmails(sanitized).forEach((email) => {
    sanitized = sanitized.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[email]");
  });

  extractPhoneCandidates(sanitized).forEach((phone) => {
    sanitized = sanitized.replace(new RegExp(phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "[phone]");
  });

  return cleanText(
    sanitized
      .replace(SECRET_PATTERN, "[secret]")
      .replace(SECRET_KEY_VALUE_PATTERN, "$1=[redacted]")
      .slice(0, 260)
  );
}

export function scoreFrontDeskEvalScenario(scenario, input = {}) {
  const replies = normalizeReplyList(input);
  const allText = replies.join("\n\n");
  const expectations = scenario.expectations || {};
  const required = expectations.required || [];
  const requiredAny = expectations.requiredAny || [];
  const forbidden = expectations.forbidden || [];
  const missingRequired = !matchesAll(required, allText) || !requiredAnyGroupsPass(requiredAny, allText);
  const forbiddenClaim = matchesAny(forbidden, allText);
  const contactSafety = contactDetailsAreAllowed(allText, expectations);
  const pricingSafety = pricesAreAllowed(allText, expectations);
  const missingInfoOk = expectations.missingInfoExpected
    ? matchesPattern(expectations.missingInfoPattern || SAFE_UNCERTAINTY_PATTERN, allText)
    : true;
  const contactPolicyOk = expectations.contactState === "missing"
    ? contactSafety.contactCount === 0 && missingInfoOk
    : contactSafety.passed;
  const pricingPolicyOk = expectations.pricingState === "missing"
    ? pricingSafety.prices.length === 0 && missingInfoOk
    : pricingSafety.passed;
  const usefulNextStepOk = hasUsefulNextStep(scenario, replies);
  const languageOk = expectations.language === "Hungarian"
    ? replies.every((reply) => appearsHungarian(reply))
    : true;
  const maxWords = Number(expectations.maxWords || 110);
  const conciseOk = replies.every((reply) => wordCount(reply) <= maxWords)
    && !HOSTILE_TONE_PATTERN.test(allText)
    && !TEMPLATE_FILLER_PATTERN.test(allText);
  const riskyClaimsOk = !forbiddenClaim && contactSafety.passed && pricingSafety.passed;

  const criteria = {
    groundednessNoInventedFacts: buildCriterion(
      !missingRequired && !forbiddenClaim,
      [
        missingRequired ? "Missing one or more required scenario facts." : "",
        forbiddenClaim ? "Reply includes a forbidden unsupported claim." : "",
      ].filter(Boolean)
    ),
    riskyClaimsBackedByEvidence: buildCriterion(
      riskyClaimsOk,
      [
        forbiddenClaim ? "Reply makes a risky claim that is not backed by scenario evidence." : "",
        contactSafety.unsafeEmail ? `Reply used unsupported email ${contactSafety.unsafeEmail}.` : "",
        contactSafety.unsafePhone ? `Reply used unsupported phone ${contactSafety.unsafePhone}.` : "",
        pricingSafety.unsupported ? `Reply used unsupported price ${pricingSafety.unsupported}.` : "",
      ].filter(Boolean)
    ),
    missingInfoHandling: buildCriterion(
      missingInfoOk,
      missingInfoOk ? [] : ["Expected a clear safe fallback for missing or unconfirmed information."]
    ),
    contactSafety: buildCriterion(
      contactPolicyOk,
      [
        contactSafety.unsafeEmail ? `Reply used unsupported email ${contactSafety.unsafeEmail}.` : "",
        contactSafety.unsafePhone ? `Reply used unsupported phone ${contactSafety.unsafePhone}.` : "",
        expectations.contactState === "missing" && contactSafety.contactCount > 0
          ? "Reply included contact details even though the scenario has no verified contact detail."
          : "",
      ].filter(Boolean)
    ),
    pricingSafety: buildCriterion(
      pricingPolicyOk,
      [
        pricingSafety.unsupported ? `Reply used unsupported price ${pricingSafety.unsupported}.` : "",
        expectations.pricingState === "missing" && pricingSafety.prices.length > 0
          ? "Reply included a price even though the scenario has no verified pricing."
          : "",
      ].filter(Boolean)
    ),
    usefulNextStep: buildCriterion(
      usefulNextStepOk,
      usefulNextStepOk ? [] : ["Missing a practical next step or one focused follow-up question."]
    ),
    languageCorrectness: buildCriterion(
      languageOk,
      languageOk ? [] : [`Expected ${expectations.language || "English"} answer language.`]
    ),
    conciseFrontDeskStyle: buildCriterion(
      conciseOk,
      conciseOk ? [] : [`Reply exceeded ${maxWords} words or used non-front-desk tone/filler.`]
    ),
  };
  const failedCriteria = buildFailedCriteria(criteria);
  const score = FRONT_DESK_EVAL_RUBRIC.reduce((sum, key) => sum + criteria[key].score, 0);

  return {
    scenarioId: scenario.id,
    categories: scenario.categories || [],
    passed: failedCriteria.length === 0,
    score,
    maxScore: FRONT_DESK_EVAL_RUBRIC.length,
    failedCriteria,
    criteria,
    replyWordCounts: replies.map(wordCount),
    turnCount: replies.length,
    notes: failedCriteria.flatMap((key) => criteria[key].notes),
  };
}

export function buildFrontDeskEvalImprovementNotes(results = []) {
  const failed = results.filter((result) => !result.passed);

  if (!failed.length) {
    return ["No failed scenarios in this run."];
  }

  const counts = new Map();
  failed.forEach((result) => {
    result.failedCriteria.forEach((criterion) => {
      counts.set(criterion, Number(counts.get(criterion) || 0) + 1);
    });
  });

  const noteByCriterion = {
    groundednessNoInventedFacts: "Tighten answers around the exact facts present in approved answers, business profile facts, and retrieved website content.",
    riskyClaimsBackedByEvidence: "Remove unsupported prices, contacts, availability, guarantees, or service claims before answering.",
    missingInfoHandling: "Say when Front Desk does not have a detail instead of filling the gap.",
    contactSafety: "Use only verified business contact details, and use the missing-contact fallback when none exists.",
    pricingSafety: "Only mention prices present in scenario evidence, and avoid numbers when pricing is missing.",
    usefulNextStep: "End with a specific next step or one focused question that helps the visitor move forward.",
    languageCorrectness: "Keep the answer in the visitor's language.",
    conciseFrontDeskStyle: "Keep Front Desk answers short, calm, and practical.",
  };

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([criterion, count]) => `${noteByCriterion[criterion] || criterion} (${count})`);
}

export function buildFrontDeskEvalSummary(results = []) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;
  const passRate = total ? Number(((passed / total) * 100).toFixed(1)) : 0;
  const failedResults = results.filter((result) => !result.passed);

  return {
    total,
    passed,
    failed,
    passRate,
    failedScenarioIds: failedResults.map((result) => result.scenarioId),
    failedScenarios: failedResults.map((result) => ({
      scenarioId: result.scenarioId,
      categories: result.categories,
      score: result.score,
      maxScore: result.maxScore,
      failedCriteria: result.failedCriteria,
      failureReasons: result.notes,
    })),
    failureReasons: failedResults.flatMap((result) =>
      result.notes.map((note) => ({
        scenarioId: result.scenarioId,
        reason: sanitizeFrontDeskEvalNote(note),
      }))
    ),
    improvementNotes: buildFrontDeskEvalImprovementNotes(results),
  };
}
