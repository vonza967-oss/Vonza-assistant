import {
  buildEffectiveUserText,
  cleanText,
  containsQuestion,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
  sanitizeChatHistory,
} from "../../utils/text.js";
import enterpriseRequestDeskManifest from "../../agentPackages/enterprise_request_desk/manifest.js";
import {
  classifyEnterpriseRequestDeskLane,
  getEnterpriseRequestDeskLane,
} from "./enterpriseRequestDeskLaneService.js";

export const ENTERPRISE_REQUEST_DESK_SOURCE = "enterprise_request_desk_intake";
export const ENTERPRISE_REQUEST_DESK_SHARED_CONVERSATION_SOURCE =
  "enterprise_request_desk_shared_front_desk";
export const ENTERPRISE_REQUEST_DESK_REQUIRED_FIELDS = Object.freeze([
  "service_need",
  "location_or_site",
  "urgency_or_timing",
  "contact_need",
]);

const FIELD_LIMITS = Object.freeze({
  organizationName: 140,
  serviceNeed: 220,
  locationOrSite: 180,
  urgencyOrTiming: 120,
  contactName: 140,
  contactEmail: 180,
  contactPhone: 80,
  contactPreference: 120,
  siteType: 120,
  notes: 1200,
});

const FIELD_ALIASES = Object.freeze({
  organizationName: ["organizationName", "organization_name", "company", "companyName", "ceg", "cég"],
  serviceNeed: ["serviceNeed", "service_need", "requestedService", "requested_service", "service"],
  locationOrSite: [
    "locationOrSite",
    "location_or_site",
    "locationText",
    "location_text",
    "location",
    "site",
    "helyszin",
    "helyszín",
  ],
  urgencyOrTiming: ["urgencyOrTiming", "urgency_or_timing", "urgency", "timing", "timeline"],
  contactName: ["contactName", "contact_name", "customerName", "customer_name", "name", "nev", "név"],
  contactEmail: ["contactEmail", "contact_email", "customerEmail", "customer_email", "email"],
  contactPhone: ["contactPhone", "contact_phone", "customerPhone", "customer_phone", "phone", "telefon"],
  contactPreference: ["contactPreference", "contact_preference", "preferredContact", "preferred_contact"],
  siteType: ["siteType", "site_type", "objectType", "object_type", "assetType", "asset_type"],
  notes: ["notes", "projectDetails", "project_details", "details", "description"],
});

const REQUIRED_FIELD_LABELS_HU = Object.freeze({
  service_need: "szolgáltatási igény",
  location_or_site: "helyszín vagy objektum",
  urgency_or_timing: "időzítés vagy sürgősség",
  contact_need: "biztonságos kapcsolati adat",
});

const KNOWN_LOCATION_PATTERN =
  /\b(Budapest(?:\s?(?:[IVXLCDM]+\.?|\d{1,2}\.?\s?ker(?:ület)?|belváros|Buda|Pest))?|Debrecen|Szeged|Miskolc|Pécs|Győr|Nyíregyháza|Kecskemét|Székesfehérvár|Szombathely|Szolnok|Tatabánya|Kaposvár|Békéscsaba|Érd|Veszprém|Sopron|Eger|Nagykanizsa|Dunaújváros|Hódmezővásárhely|Dunakeszi|Szigetszentmiklós|Pest megye|országos|orsz[aá]gos|nationwide)(?:en|on|ban|ben|i|an|re|ra|hoz|hez|höz)?\b/i;
const SERVICE_QUESTION_PATTERN =
  /\b(milyen szolg[aá]ltat[aá]s(?:ok|okat)?|mit v[aá]llal(?:tok|nak)?|mivel foglalkoz|services|what do you offer|what services)\b/i;
const SERVICE_AREA_QUESTION_PATTERN =
  /\b(szolg[aá]ltat[aá]si ter[uü]let|hol v[aá]llal|orsz[aá]gos|budapest|nationwide|service area|where do you serve|do you serve)\b/i;
const PRICE_AMOUNT_PATTERN =
  /(?:[$€£]\s?\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s?(?:huf|forint|ft|eur|euro|usd|dollars?)\b|\b\d+\s?[-–]\s?\d+\s?(?:ezer|millió|m)\s?(?:ft|forint)?\b)/i;
const SECRET_LIKE_PATTERN =
  /(?:SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET|STRIPE_SECRET_KEY|service[_\s-]?role|api[_\s-]?key|secret[_\s-]?key|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/i;
const CUSTOMER_INTERNAL_JARGON_PATTERN =
  /\b(staff review|request-only|enterprise_request_desk|qdh|quote[_\s-]?desk|package|policy|metadata|model|system prompt|developer message|owner[_\s-]?user|agent[_\s-]?id|business[_\s-]?id)\b/i;

function safeText(value = "") {
  return cleanText(String(value ?? ""));
}

function limitText(value, maxLength) {
  return safeText(value).slice(0, maxLength);
}

function readAliasedField(source = {}, aliases = []) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return "";
  }

  for (const alias of aliases) {
    if (Object.hasOwn(source, alias)) {
      return source[alias];
    }
  }

  return "";
}

function normalizeEmail(value = "") {
  const email = safeText(value).toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }

  return isPlaceholderEmail(email) || isInternalPlatformEmail(email) ? "" : email;
}

function normalizePhone(value = "") {
  const phone = safeText(value);

  if (!phone || phone.replace(/\D/g, "").length < 7 || isPlaceholderPhone(phone)) {
    return "";
  }

  return phone;
}

export function normalizeEnterpriseRequestDeskFields(fields = {}) {
  return {
    organizationName: limitText(
      readAliasedField(fields, FIELD_ALIASES.organizationName),
      FIELD_LIMITS.organizationName
    ),
    serviceNeed: limitText(readAliasedField(fields, FIELD_ALIASES.serviceNeed), FIELD_LIMITS.serviceNeed),
    locationOrSite: limitText(
      readAliasedField(fields, FIELD_ALIASES.locationOrSite),
      FIELD_LIMITS.locationOrSite
    ),
    urgencyOrTiming: limitText(
      readAliasedField(fields, FIELD_ALIASES.urgencyOrTiming),
      FIELD_LIMITS.urgencyOrTiming
    ),
    contactName: limitText(readAliasedField(fields, FIELD_ALIASES.contactName), FIELD_LIMITS.contactName),
    contactEmail: limitText(
      normalizeEmail(readAliasedField(fields, FIELD_ALIASES.contactEmail)),
      FIELD_LIMITS.contactEmail
    ),
    contactPhone: limitText(
      normalizePhone(readAliasedField(fields, FIELD_ALIASES.contactPhone)),
      FIELD_LIMITS.contactPhone
    ),
    contactPreference: limitText(
      readAliasedField(fields, FIELD_ALIASES.contactPreference),
      FIELD_LIMITS.contactPreference
    ),
    siteType: limitText(readAliasedField(fields, FIELD_ALIASES.siteType), FIELD_LIMITS.siteType),
    notes: limitText(readAliasedField(fields, FIELD_ALIASES.notes), FIELD_LIMITS.notes),
  };
}

function mergeFields(...fieldSets) {
  return fieldSets.reduce((merged, fields) => {
    const normalized = normalizeEnterpriseRequestDeskFields(fields);

    for (const [key, value] of Object.entries(normalized)) {
      if (!merged[key] && value) {
        merged[key] = value;
      }
    }

    return merged;
  }, normalizeEnterpriseRequestDeskFields());
}

function extractFirstMatch(message = "", patterns = []) {
  const text = safeText(message);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = safeText(match?.[1] || match?.[0] || "");

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function cleanupServiceNeedCandidate(value = "") {
  return safeText(value)
    .replace(/\b(?:Budapesten|Budapest|országos|orszagos|nationwide|jövő|jovo|ezen|ma|holnap|next|urgent|sürgős|surgos|email|telefon|phone)\b.*$/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim()
    .slice(0, FIELD_LIMITS.serviceNeed);
}

function extractOrganizationName(message = "") {
  return extractFirstMatch(message, [
    /\b(?:c[eé]g|v[aá]llalat|company|organization)\s*[:-]?\s*([^.,!?;]{2,100})/i,
    /\b(?:a|az)\s+([^.,!?;]{2,100}?\s(?:Kft\.?|Zrt\.?|Nyrt\.?|Bt\.?|Ltd\.?|Inc\.?))\b/i,
  ]).slice(0, FIELD_LIMITS.organizationName);
}

function extractContactName(message = "") {
  const candidate = extractFirstMatch(message, [
    /\b(?:a nevem|nevem|[eé]n vagyok|kapcsolattart[oó]|contact person|my name is|i am|i'm)\s+([^.,!?;]{2,80})/i,
    /\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+){1,3})\s+vagyok\b/,
  ]);

  return candidate
    .replace(/\s+\b(?:email|e-mail|telefon|phone|el[eé]rhet[oő]s[eé]g)\b.*$/i, "")
    .slice(0, FIELD_LIMITS.contactName);
}

function extractLocationOrSite(message = "") {
  const text = safeText(message);
  const explicit = extractFirstMatch(text, [
    /\b(?:helysz[ií]n|telephely|objektum|site|location|facility)\s*[:-]\s*([^.,!?;]{2,120})/i,
    /\b(?:office building|warehouse|factory|site|facility)\s+(?:in|near|at)\s+([^.,!?;]{2,80})/i,
    /\b(?:in|near|around|at)\s+([A-Z][A-Za-zÀ-ž\s.-]{2,80})/i,
  ]);
  const knownLocation = text.match(KNOWN_LOCATION_PATTERN)?.[1] || "";
  const candidate = explicit || knownLocation;

  return safeText(candidate)
    .replace(/\s+\b(?:j[oö]v[oő]|next|s[uü]rg[oő]s|urgent|email|telefon|phone)\b.*$/i, "")
    .slice(0, FIELD_LIMITS.locationOrSite);
}

function extractSiteType(message = "") {
  return extractFirstMatch(message, [
    /\b(irodah[aá]z(?:hoz|ban|ba|ra|re)?|iroda|rakt[aá]r(?:hoz|ban|ba|ra|re)?|gy[aá]r(?:hoz|ban|ba|ra|re)?|telephely(?:hez|en|re)?|ipari park|logisztikai k[oö]zpont|office building|warehouse|factory|facility|site)\b/i,
  ]).slice(0, FIELD_LIMITS.siteType);
}

function extractUrgencyOrTiming(message = "") {
  const text = safeText(message);
  const explicit = extractFirstMatch(text, [
    /\b(?:id[oő]z[ií]t[eé]s|hat[aá]rid[oő]|mikor|start|deadline|timing)\s*[:-]?\s*([^.,!?;]{2,100})/i,
    /\b(?:from|starting)\s+([^.,!?;]{2,80})/i,
  ]);

  if (explicit) {
    return explicit.slice(0, FIELD_LIMITS.urgencyOrTiming);
  }

  return extractFirstMatch(text, [
    /\b(ma|holnap(?:t[oó]l)?|azonnal|min[eé]l hamarabb|s[uü]rg[oő]s|asap|urgent|today|tomorrow)\b/i,
    /\b(ezen a h[eé]ten|j[oö]v[oő] h[eé]t(?:en|t[oő]l)?|j[oö]v[oő] h[oó]napt[oó]l|next week|next month|this week)\b/i,
    /\b(1\s?[-–]\s?2 h[eé]t(?:en)?|egy-k[eé]t h[eé]t|k[eé]t h[eé]ten bel[uü]l|1\s?[-–]\s?2 weeks?)\b/i,
    /\b(negyed[eé]v v[eé]g[eé]ig|h[oó]nap v[eé]g[eé]ig|quarter end|end of quarter)\b/i,
    /\b(folyamatos|rendszeres|hossz[uú] t[aá]v[uú]|continuous|ongoing|monthly|quarterly)\b/i,
  ]).slice(0, FIELD_LIMITS.urgencyOrTiming);
}

function extractServiceNeed(message = "", laneKey = "general_enquiry") {
  const text = safeText(message);
  const explicit = extractFirstMatch(text, [
    /\b([^.,!?;]{3,120}?)\s+(?:kellene|kell|sz[uü]ks[eé]ges|needed|required)\b/i,
    /\b(?:sz[uü]ks[eé]g(?:[uü]nk)? van|kellene|kell|szeretn[eé]nk|need|looking for|requesting)\s+(?:egy|a|an|some)?\s*([^.,!?;]{3,160})/i,
  ]);
  const cleanedExplicit = cleanupServiceNeedCandidate(explicit);
  const looksLikeObjectOnly = /\b(irodah[aá]z|rakt[aá]r|gy[aá]r|telephely|office building|warehouse|factory)\b/i.test(cleanedExplicit);

  if (cleanedExplicit && !looksLikeObjectOnly) {
    return cleanedExplicit;
  }

  const lane = getEnterpriseRequestDeskLane(laneKey);

  if (laneKey && laneKey !== "general_enquiry" && laneKey !== "mixed_enterprise_request") {
    return lane?.labelHu || "";
  }

  if (laneKey === "mixed_enterprise_request") {
    return "Vegyes vállalati szolgáltatási igény";
  }

  return "";
}

function extractDeterministicFieldsFromText(message = "", laneKey = "general_enquiry") {
  const email = extractEmails(message)
    .map(normalizeEmail)
    .find(Boolean) || "";
  const phone = extractPhoneCandidates(message)
    .map(normalizePhone)
    .find(Boolean) || "";

  return normalizeEnterpriseRequestDeskFields({
    organizationName: extractOrganizationName(message),
    serviceNeed: extractServiceNeed(message, laneKey),
    locationOrSite: extractLocationOrSite(message),
    urgencyOrTiming: extractUrgencyOrTiming(message),
    contactName: extractContactName(message),
    contactEmail: email,
    contactPhone: phone,
    siteType: extractSiteType(message),
    notes: safeText(message).length >= 30 ? safeText(message).slice(0, FIELD_LIMITS.notes) : "",
  });
}

function extractConversationFields({ conversation = [], laneKey = "general_enquiry" } = {}) {
  const history = sanitizeChatHistory(conversation);
  const userText = history
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content)
    .filter(Boolean)
    .join("\n");

  return userText
    ? extractDeterministicFieldsFromText(userText, laneKey)
    : normalizeEnterpriseRequestDeskFields();
}

function hasPromptInjectionRisk(text = "") {
  return /\b(ignore|override|bypass|forget|reveal|show)\b.{0,80}\b(instructions|rules|system|developer|prompt|policy|guardrails?)\b/i.test(text)
    || /\b(system prompt|developer message|jailbreak|prompt injection|act as|do anything now)\b/i.test(text)
    || /\b(hagyd figyelmen k[ií]v[uü]l|fel[uü]l[ií]r|rendszerutas[ií]t[aá]s|kor[aá]bbi utas[ií]t[aá]s|promptot|mutasd meg az utas[ií]t[aá]s)\b/i.test(text);
}

function hasPricingGuaranteeRequest(text = "") {
  return /\b(guaranteed|final|exact|fixed|confirmed)\b.{0,80}\b(price|quote|proposal|estimate)\b/i.test(text)
    || /\b(garant[aá]lt|v[eé]gleges|pontos|fix|biztos)\b.{0,80}(?:[aá]r(?:at|ak|a)?|[aá]raj[aá]nlat(?:ot|ra)?|aj[aá]nlat(?:ot|ra)?|kalkul[aá]ci[oó])/i.test(text)
    || /\b(mennyibe ker[uü]l|mennyi lenne|mennyi lesz|how much|what would it cost|cost)\b/i.test(text);
}

function hasDeferredOperationsRequest(text = "") {
  return /\b(qr|sla|ticket|vendor panel|operations cockpit|provider call|external integration|send email|send whatsapp|crm|create document|generate compliance|compliance document)\b/i.test(text)
    || /\b(jegyet nyiss|sla|qr jelent[eé]s|munkalapot|k[uü]ldd el|whatsapp|e-mailt k[uü]ld|crm|szolg[aá]ltat[oó]i panel|compliance dokumentum)\b/i.test(text);
}

function detectSafetyFlags(text = "") {
  return {
    promptInjection: hasPromptInjectionRisk(text),
    secretLikeInput: SECRET_LIKE_PATTERN.test(text),
    pricingGuaranteeRequested: hasPricingGuaranteeRequest(text),
    deferredOperationsRequested: hasDeferredOperationsRequest(text),
  };
}

function getMissingFields(fields = {}) {
  const normalized = normalizeEnterpriseRequestDeskFields(fields);
  const missing = [];

  if (!normalized.serviceNeed) missing.push("service_need");
  if (!normalized.locationOrSite) missing.push("location_or_site");
  if (!normalized.urgencyOrTiming) missing.push("urgency_or_timing");
  if (!normalized.contactEmail && !normalized.contactPhone && !normalized.contactPreference) {
    missing.push("contact_need");
  }

  return missing;
}

function formatBusinessServices(businessContext = {}) {
  const serviceTypes = Array.isArray(businessContext.serviceTypes)
    ? businessContext.serviceTypes
    : Array.isArray(businessContext.services)
      ? businessContext.services
      : [];

  return serviceTypes.map(safeText).filter(Boolean).slice(0, 8);
}

function normalizeBusinessContext(businessContext = {}) {
  return {
    businessName: safeText(businessContext.businessName || businessContext.name),
    serviceArea: safeText(businessContext.serviceArea || businessContext.service_area),
    serviceTypes: formatBusinessServices(businessContext),
  };
}

function contactNeedFromFields(fields = {}) {
  if (fields.contactEmail || fields.contactPhone) {
    return "Biztonságos elérhetőség megadva a visszajelzéshez.";
  }

  if (fields.contactPreference) {
    return fields.contactPreference;
  }

  return "Kapcsolati adat hiányzik a visszajelzéshez.";
}

function buildStaffSummary({ lane, fields, missingFields, safetyFlags } = {}) {
  const flags = [];

  if (safetyFlags.pricingGuaranteeRequested) flags.push("ár/garancia kérést biztonságosan el kell utasítani");
  if (safetyFlags.promptInjection) flags.push("prompt-befolyásolási kísérlet figyelmen kívül hagyva");
  if (safetyFlags.deferredOperationsRequested) flags.push("Phase 1-en túli operatív művelet nem indítható");

  return [
    `Belső brief: ${lane?.labelHu || "Általános érdeklődés"}.`,
    `Igény: ${fields.serviceNeed || "nincs megadva"}.`,
    `Helyszín/objektum: ${fields.locationOrSite || "nincs megadva"}.`,
    fields.siteType ? `Objektumtípus: ${fields.siteType}.` : "",
    `Időzítés: ${fields.urgencyOrTiming || "nincs megadva"}.`,
    `Kapcsolat: ${fields.contactEmail || fields.contactPhone || fields.contactPreference || "hiányzik"}.`,
    missingFields.length
      ? `Hiányzó mezők: ${missingFields.map((field) => REQUIRED_FIELD_LABELS_HU[field] || field).join(", ")}.`
      : "A minimális intake mezők megvannak.",
    flags.length ? `Biztonsági megjegyzés: ${flags.join(", ")}.` : "",
  ].filter(Boolean).join(" ").slice(0, 1000);
}

function buildNextQuestion({ laneKey, missingFields } = {}) {
  const firstMissing = Array.isArray(missingFields) ? missingFields[0] : "";
  const lane = getEnterpriseRequestDeskLane(laneKey);

  if (firstMissing === "service_need") {
    return lane?.keyQualifyingQuestions?.[0] || "Melyik szolgáltatási területhez kapcsolódik az igény?";
  }

  if (firstMissing === "location_or_site") {
    return "Melyik településen vagy helyszínen lenne a feladat, és milyen típusú objektumról van szó?";
  }

  if (firstMissing === "urgency_or_timing") {
    return "Mikor indulna a feladat, vagy meddig kell visszajelzést kapniuk?";
  }

  if (firstMissing === "contact_need") {
    return "Milyen biztonságos elérhetőségen kérhetnek visszajelzést?";
  }

  return "Van még olyan helyszíni vagy szervezeti részlet, amit a csapatnak látnia kell?";
}

function hasSafeSharedReply(reply = "") {
  const normalized = safeText(reply);

  return Boolean(normalized)
    && normalized.length <= 1200
    && !SECRET_LIKE_PATTERN.test(normalized)
    && !CUSTOMER_INTERNAL_JARGON_PATTERN.test(normalized)
    && !PRICE_AMOUNT_PATTERN.test(normalized);
}

function buildBusinessQuestionReply({ message = "", businessContext = {}, laneKey = "general_enquiry" } = {}) {
  const normalizedBusiness = normalizeBusinessContext(businessContext);
  const services = normalizedBusiness.serviceTypes;
  const serviceArea = normalizedBusiness.serviceArea;

  if (SERVICE_QUESTION_PATTERN.test(message) && services.length) {
    return [
      `A rögzített szolgáltatási kör: ${services.join(", ")}.`,
      "A konkrét vállalhatóságot a csapat a helyszín és az igény részletei alapján tudja megerősíteni.",
      buildNextQuestion({ laneKey, missingFields: ["location_or_site"] }),
    ].join("\n\n");
  }

  if (SERVICE_AREA_QUESTION_PATTERN.test(message) && serviceArea) {
    return [
      `A megadott szolgáltatási terület: ${serviceArea}.`,
      "Egy konkrét telephely vagy országos lefedettség részleteit a csapat tudja visszaigazolni.",
      buildNextQuestion({ laneKey, missingFields: ["service_need"] }),
    ].join("\n\n");
  }

  return [
    "Ezt a rendelkezésre álló vállalati szolgáltatási kontextusból nem látom biztosan.",
    "Írja le röviden a helyszínt, az érintett szolgáltatási területet és az időzítést, és belső egyeztetésre alkalmas briefet készítek belőle.",
  ].join("\n\n");
}

function buildFallbackReply({ message, laneKey, missingFields, safetyFlags, businessContext } = {}) {
  if (!safeText(message)) {
    return "Írja le röviden, milyen vállalati biztonsági, FM vagy compliance jellegű igényről van szó.";
  }

  if (safetyFlags.secretLikeInput || safetyFlags.promptInjection) {
    return `Az igény pontosításában tudok segíteni. ${buildNextQuestion({ laneKey, missingFields })}`;
  }

  if (safetyFlags.pricingGuaranteeRequested) {
    return [
      "Pontos vagy garantált árat itt nem adok. A részletek alapján a csapat tud visszajelezni a következő lépésről.",
      buildNextQuestion({ laneKey, missingFields }),
    ].join("\n\n");
  }

  if (safetyFlags.deferredOperationsRequested) {
    return [
      "Ilyen operatív műveletet innen nem indítok. Most csak a megkeresést tudom strukturáltan előkészíteni belső áttekintésre.",
      buildNextQuestion({ laneKey, missingFields }),
    ].join("\n\n");
  }

  if (missingFields.length) {
    return `Rögzítettem, amit megadott. ${buildNextQuestion({ laneKey, missingFields })}`;
  }

  const businessName = normalizeBusinessContext(businessContext).businessName || "a csapat";

  return [
    "Összegyűjtöttem a minimális adatokat a belső áttekintéshez.",
    `${businessName} a részletek alapján tud visszajelezni a vállalhatóságról és a következő lépésről. Ez nem végleges ajánlat vagy garantált ár.`,
  ].join("\n\n");
}

function detectTurnMode({ message = "", conversation = [] } = {}) {
  const latestMessage = safeText(message);
  const effectiveText = buildEffectiveUserText(latestMessage, conversation);

  if (hasPricingGuaranteeRequest(effectiveText) || hasPromptInjectionRisk(effectiveText)) {
    return "enterprise_intake";
  }

  if (
    containsQuestion(latestMessage)
    || SERVICE_QUESTION_PATTERN.test(latestMessage)
    || SERVICE_AREA_QUESTION_PATTERN.test(latestMessage)
  ) {
    return "business_question";
  }

  return "enterprise_intake";
}

export function buildEnterpriseRequestDeskStructuredBrief({
  laneClassification,
  fields,
  safetyFlags,
} = {}) {
  const normalizedFields = normalizeEnterpriseRequestDeskFields(fields);
  const laneKey = laneClassification?.laneKey || "general_enquiry";
  const lane = getEnterpriseRequestDeskLane(laneKey);
  const missingFields = getMissingFields(normalizedFields);
  const readyForOwnerReview =
    missingFields.length === 0
    && !safetyFlags?.secretLikeInput;

  return {
    lane: laneKey,
    laneLabelHu: lane?.labelHu || "Általános érdeklődés",
    confidence: laneClassification?.confidence || "low",
    serviceNeed: normalizedFields.serviceNeed,
    locationOrSite: normalizedFields.locationOrSite,
    urgencyOrTiming: normalizedFields.urgencyOrTiming,
    contactNeed: contactNeedFromFields(normalizedFields),
    contactName: normalizedFields.contactName,
    contactEmail: normalizedFields.contactEmail,
    contactPhone: normalizedFields.contactPhone,
    organizationName: normalizedFields.organizationName,
    siteType: normalizedFields.siteType,
    notes: safetyFlags?.promptInjection || safetyFlags?.secretLikeInput ? "" : normalizedFields.notes,
    missingFields,
    readyForOwnerReview,
    safetyFlags: {
      promptInjection: safetyFlags?.promptInjection === true,
      secretLikeInput: safetyFlags?.secretLikeInput === true,
      pricingGuaranteeRequested: safetyFlags?.pricingGuaranteeRequested === true,
      deferredOperationsRequested: safetyFlags?.deferredOperationsRequested === true,
    },
    staffSummaryHu: buildStaffSummary({
      lane,
      fields: normalizedFields,
      missingFields,
      safetyFlags: safetyFlags || {},
    }),
  };
}

export function buildDeterministicEnterpriseRequestDeskAnalysis(options = {}) {
  const message = safeText(options.message);
  const conversation = sanitizeChatHistory(options.conversation || []);
  const classificationText = [
    ...conversation.filter((entry) => entry.role === "user").map((entry) => entry.content),
    message,
    options.fields?.serviceNeed,
    options.fields?.service_need,
  ].filter(Boolean).join(" ");
  const laneClassification = classifyEnterpriseRequestDeskLane(classificationText);
  const existingFields = normalizeEnterpriseRequestDeskFields(options.fields || options.currentFields || {});
  const conversationFields = extractConversationFields({
    conversation,
    laneKey: laneClassification.laneKey,
  });
  const deterministicFields = extractDeterministicFieldsFromText(message, laneClassification.laneKey);
  const fields = mergeFields(existingFields, conversationFields, deterministicFields);
  const combinedText = [
    ...conversation.map((entry) => entry.content),
    message,
    ...Object.values(fields),
  ].join(" ");
  const safetyFlags = detectSafetyFlags(combinedText);
  const structuredBrief = buildEnterpriseRequestDeskStructuredBrief({
    laneClassification,
    fields,
    safetyFlags,
  });

  return {
    fields,
    missingFields: structuredBrief.missingFields,
    readyForOwnerReview: structuredBrief.readyForOwnerReview,
    structuredBrief,
    laneClassification,
    safetyFlags,
    assistantReply: buildFallbackReply({
      message,
      laneKey: laneClassification.laneKey,
      missingFields: structuredBrief.missingFields,
      safetyFlags,
      businessContext: options.businessContext || {},
    }),
  };
}

export function buildEnterpriseRequestDeskSharedChatInput(options = {}) {
  const businessContext = normalizeBusinessContext(options.businessContext || {});
  const businessName = businessContext.businessName || "Enterprise business";
  const businessId = safeText(options.business?.id || options.agent?.businessId || options.agent?.business_id);
  const agentId = safeText(options.agent?.id || options.agent?.agentId);

  return {
    supabase: options.supabase,
    openai: options.openai,
    agent: {
      id: agentId || "enterprise-request-desk-report-only-agent",
      businessId: businessId || "enterprise-request-desk-report-only-business",
      ownerUserId: safeText(options.agent?.ownerUserId || options.agent?.owner_user_id),
      name: "Enterprise Request Desk",
      purpose: "lead_capture",
      tone: "professional",
      packageKey: "front_desk_general",
      vertical: "",
    },
    business: {
      id: businessId || "enterprise-request-desk-report-only-business",
      name: businessName,
      vertical: "",
      websiteUrl: safeText(options.business?.websiteUrl || options.business?.website_url),
    },
    widgetConfig: {
      assistantName: "Enterprise Request Desk",
    },
    message: safeText(options.message),
    history: sanitizeChatHistory(options.conversation || []),
    language: "Hungarian",
    displayMode: "page",
    conversationSource: ENTERPRISE_REQUEST_DESK_SHARED_CONVERSATION_SOURCE,
    agentPackage: enterpriseRequestDeskManifest,
    fallbackWebsiteContent: {
      businessId: businessId || "enterprise-request-desk-report-only-business",
      websiteUrl: "",
      pageTitle: businessName,
      content: [
        `Vállalkozás neve: ${businessName}.`,
        businessContext.serviceArea ? `Szolgáltatási terület: ${businessContext.serviceArea}.` : "",
        businessContext.serviceTypes.length
          ? `Szolgáltatási kör: ${businessContext.serviceTypes.join(", ")}.`
          : "",
        "Az Enterprise Request Desk széles vállalati megkereséseket strukturál belső áttekintésre.",
        "Pontos ár, végleges ajánlat, megfelelőségi dokumentum vagy külső szolgáltatói művelet nem készül innen.",
      ].filter(Boolean).join("\n"),
    },
    answerContractMode: options.answerContractMode,
    answerContractIncludeClaimText: options.answerContractIncludeClaimText,
  };
}

export async function generateEnterpriseRequestDeskAssistantTurn(options = {}, deps = {}) {
  const message = safeText(options.message);
  const conversation = sanitizeChatHistory(options.conversation || []);
  const analysis = buildDeterministicEnterpriseRequestDeskAnalysis({
    ...options,
    message,
    conversation,
  });
  const mode = detectTurnMode({ message, conversation });
  let sharedTurn = null;

  if (
    mode === "business_question"
    && typeof deps.generateSharedChatAssistantTurn === "function"
    && !analysis.safetyFlags.secretLikeInput
    && !analysis.safetyFlags.promptInjection
  ) {
    try {
      sharedTurn = await deps.generateSharedChatAssistantTurn(
        buildEnterpriseRequestDeskSharedChatInput({
          ...options,
          message,
          conversation,
        }),
        deps.sharedChatDeps || {}
      );
    } catch {
      sharedTurn = null;
    }
  }

  const assistantReply = mode === "business_question"
    ? hasSafeSharedReply(sharedTurn?.reply)
      ? safeText(sharedTurn.reply)
      : buildBusinessQuestionReply({
        message,
        businessContext: options.businessContext || {},
        laneKey: analysis.laneClassification.laneKey,
      })
    : analysis.assistantReply;

  return {
    assistantReply,
    fields: analysis.fields,
    missingFields: analysis.missingFields,
    readyForOwnerReview: analysis.readyForOwnerReview,
    structuredBrief: analysis.structuredBrief,
    safetyFlags: analysis.safetyFlags,
    conversationMode: mode,
    usedSharedChatEngine: sharedTurn?.usedSharedEngine === true,
  };
}
