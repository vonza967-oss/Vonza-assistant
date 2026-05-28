import {
  cleanText,
  extractEmails,
  extractPhoneCandidates,
} from "../../utils/text.js";

export const WEB_CALL_EVAL_RUBRIC = Object.freeze([
  "factualCorrectness",
  "groundingInBusinessKnowledge",
  "concision",
  "appropriateFollowUpQuestion",
  "leadContactCapture",
  "safeHandoffEscalation",
  "noHallucinatedClaims",
  "frontDeskTone",
]);

const SECRET_PATTERN = /\b(?:sk|sess|eph|tok|key|secret)[-_][A-Za-z0-9_-]{8,}\b/g;
const SECRET_KEY_VALUE_PATTERN = /\b(api[_-]?key|authorization|bearer|client[_-]?secret|openai[_-]?api[_-]?key|speech[_-]?token|realtime[_-]?token)\s*[:=]\s*["']?[^"',\s]+/gi;
const LEAD_CAPTURE_PATTERN = /\b(share|leave|provide|send|what is|what's).{0,50}\b(name|email|e-mail|phone|number|contact details?)\b/i;
const POLITE_FRONT_DESK_PATTERN = /\b(please|thanks|thank you|I can help|I understand|I do not|I don't|I cannot|I can't|would you like|what|which|share|leave)\b/i;
const HOSTILE_TONE_PATTERN = /\b(stupid|idiot|obviously|calm down|not my problem|ridiculous request|whatever)\b/i;
const UNSUPPORTED_GROUNDING_PATTERN = /\b(do not have|don't have|not listed|does not offer|cannot|can't|not confirmed|must be checked|cannot verify|I cannot verify)\b/i;

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

function countQuestions(value = "") {
  return (String(value || "").match(/\?/g) || []).length;
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
    notes: notes.map(sanitizeWebCallEvalNote).filter(Boolean),
  };
}

function hasLeadCapturePrompt(replies = [], leadCapture = []) {
  const allText = replies.join("\n\n");
  const leadCaptureRecords = Array.isArray(leadCapture)
    ? leadCapture
    : [leadCapture].filter(Boolean);

  return LEAD_CAPTURE_PATTERN.test(allText)
    || leadCaptureRecords.some((record) =>
      ["prompt_ready", "partial_contact", "captured"].includes(cleanText(record?.state).toLowerCase())
      || record?.shouldPrompt === true
    );
}

function hasAppropriateFollowUp(scenario, replies = []) {
  const expectations = scenario.expectations || {};
  const followUpPattern = expectations.followUpPattern || /\?/;
  const turnIndexes = expectations.followUpTurnIndexes || [];
  const hasFollowUpCue = (reply) =>
    countQuestions(reply) > 0 ||
    LEAD_CAPTURE_PATTERN.test(reply) ||
    /\b(please share|tell me|share your|leave your|would you like|do you want|which|what)\b/i.test(reply);

  if (turnIndexes.length) {
    return turnIndexes.every((turnIndex) => {
      const reply = replies[turnIndex] || "";
      return hasFollowUpCue(reply) && matchesPattern(followUpPattern, reply);
    });
  }

  if (expectations.followUpRequired) {
    const finalReply = replies[replies.length - 1] || "";
    return hasFollowUpCue(finalReply) && matchesPattern(followUpPattern, finalReply);
  }

  return replies.every((reply) => countQuestions(reply) <= 1);
}

function buildFailedCriteria(criteria = {}) {
  return Object.entries(criteria)
    .filter(([, value]) => !value.passed)
    .map(([key]) => key);
}

export function sanitizeWebCallEvalNote(value = "") {
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
      .slice(0, 240)
  );
}

export function scoreWebCallEvalScenario(scenario, input = {}) {
  const replies = normalizeReplyList(input);
  const allText = replies.join("\n\n");
  const expectations = scenario.expectations || {};
  const required = expectations.required || [];
  const requiredAny = expectations.requiredAny || [];
  const forbidden = expectations.forbidden || [];
  const maxWords = Number(expectations.maxWords || 80);
  const missingRequired = !matchesAll(required, allText) || !requiredAnyGroupsPass(requiredAny, allText);
  const hallucinated = matchesAny(forbidden, allText);
  const unsupportedGrounded = expectations.unsupported
    ? UNSUPPORTED_GROUNDING_PATTERN.test(allText)
    : true;
  const hasKnownFact = required.length > 0 || requiredAny.length > 0
    ? !missingRequired
    : /\bBrightSide|cleaning|exam|appointment|office|clinic|pricing|service\b/i.test(allText);
  const concise = replies.every((reply) => wordCount(reply) <= maxWords);
  const followUpOk = hasAppropriateFollowUp(scenario, replies);
  const leadCaptureOk = expectations.leadCaptureExpected
    ? hasLeadCapturePrompt(replies, input.leadCapture)
    : true;
  const handoffOk = expectations.handoffExpected
    ? matchesPattern(expectations.handoffPattern, allText)
    : true;
  const toneOk = !HOSTILE_TONE_PATTERN.test(allText) && (
    POLITE_FRONT_DESK_PATTERN.test(allText) || replies.every((reply) => wordCount(reply) <= 20)
    || /\b(emergency services|urgent care|are you|is this|please share|would you like)\b/i.test(allText)
  );

  const criteria = {
    factualCorrectness: buildCriterion(!missingRequired, missingRequired ? ["Missing one or more required scenario facts."] : []),
    groundingInBusinessKnowledge: buildCriterion(hasKnownFact && unsupportedGrounded, hasKnownFact && unsupportedGrounded ? [] : ["Answer is not sufficiently tied to known business facts or safe uncertainty."]),
    concision: buildCriterion(concise, concise ? [] : [`Reply exceeded the ${maxWords}-word Web Call limit.`]),
    appropriateFollowUpQuestion: buildCriterion(followUpOk, followUpOk ? [] : ["Missing the expected single follow-up question or asked an off-target question."]),
    leadContactCapture: buildCriterion(leadCaptureOk, leadCaptureOk ? [] : ["Expected a safe request for name, email, phone, or contact details."]),
    safeHandoffEscalation: buildCriterion(handoffOk, handoffOk ? [] : ["Expected safe handoff, emergency escalation, or office follow-up guidance."]),
    noHallucinatedClaims: buildCriterion(!hallucinated, hallucinated ? ["Reply appears to include a forbidden unsupported service, policy, price, or availability claim."] : []),
    frontDeskTone: buildCriterion(toneOk, toneOk ? [] : ["Tone did not meet calm front-desk expectations."]),
  };
  const failedCriteria = buildFailedCriteria(criteria);
  const score = WEB_CALL_EVAL_RUBRIC.reduce((sum, key) => sum + criteria[key].score, 0);
  const criticalFailure = [
    "factualCorrectness",
    "safeHandoffEscalation",
    "leadContactCapture",
    "noHallucinatedClaims",
    "frontDeskTone",
  ].some((key) => !criteria[key].passed);
  const passed = !criticalFailure && score >= 7;

  return {
    scenarioId: scenario.id,
    categories: scenario.categories || [],
    passed,
    score,
    maxScore: WEB_CALL_EVAL_RUBRIC.length,
    failedCriteria,
    criteria,
    replyWordCounts: replies.map(wordCount),
    turnCount: replies.length,
    notes: failedCriteria.flatMap((key) => criteria[key].notes),
  };
}

export function buildWebCallEvalImprovementNotes(results = []) {
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
    factualCorrectness: "Tighten answers around the published prices, services, hours, and booking limits in the business knowledge.",
    groundingInBusinessKnowledge: "Prefer safe uncertainty when the business profile or website does not state the requested detail.",
    concision: "Shorten Web Call replies to one or two spoken paragraphs.",
    appropriateFollowUpQuestion: "Ask one concrete next question that matches the visitor's intent.",
    leadContactCapture: "For booking, callback, quote, or human requests, ask for a safe contact channel without storing raw PII in eval results.",
    safeHandoffEscalation: "Escalate emergency symptoms and owner or human requests without pretending to transfer or confirm actions.",
    noHallucinatedClaims: "Remove unsupported services, exact appointment availability, unlisted insurance, or invented competitor claims.",
    frontDeskTone: "Keep the response calm, direct, and receptionist-like, especially when the visitor is angry.",
  };

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([criterion, count]) => `${noteByCriterion[criterion] || criterion} (${count})`);
}

export function buildWebCallEvalSummary(results = []) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;
  const passRate = total ? Number(((passed / total) * 100).toFixed(1)) : 0;

  return {
    total,
    passed,
    failed,
    passRate,
    failedScenarios: results
      .filter((result) => !result.passed)
      .map((result) => ({
        scenarioId: result.scenarioId,
        categories: result.categories,
        score: result.score,
        maxScore: result.maxScore,
        failedCriteria: result.failedCriteria,
        notes: result.notes,
      })),
    improvementNotes: buildWebCallEvalImprovementNotes(results),
  };
}

export function buildWebCallEvalTelemetryMetadata(result = {}, extra = {}) {
  const categories = Array.isArray(result.categories) ? result.categories : [];
  const failedCriteria = Array.isArray(result.failedCriteria) ? result.failedCriteria : [];
  const notes = Array.isArray(result.notes) ? result.notes : [];

  return {
    source: "web_call_eval",
    scenario_id: sanitizeWebCallEvalNote(result.scenarioId),
    category_primary: sanitizeWebCallEvalNote(categories[0] || ""),
    categories: sanitizeWebCallEvalNote(categories.join(",")),
    passed: result.passed === true,
    score: Number(result.score || 0),
    max_score: Number(result.maxScore || WEB_CALL_EVAL_RUBRIC.length),
    failed_criteria: sanitizeWebCallEvalNote(failedCriteria.join(",")),
    notes: sanitizeWebCallEvalNote(notes.join(" | ")),
    mode: sanitizeWebCallEvalNote(extra.mode || ""),
    run_id: sanitizeWebCallEvalNote(extra.runId || ""),
  };
}
