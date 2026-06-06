import {
  buildEffectiveUserText,
  cleanText,
  containsQuestion,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderPhone,
  sanitizeChatHistory,
} from "../../utils/text.js";
import { generateSharedChatAssistantTurn } from "../chat/chatService.js";
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
  staffingRequirement: 120,
  assetsCoverageNotes: 280,
  securityTechDetails: 280,
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
  staffingRequirement: [
    "staffingRequirement",
    "staffing_requirement",
    "staffing",
    "staffCount",
    "staff_count",
    "personnel",
    "letszam",
    "létszám",
  ],
  assetsCoverageNotes: [
    "assetsCoverageNotes",
    "assets_coverage_notes",
    "coverageNotes",
    "coverage_notes",
    "assets",
    "assetNotes",
    "asset_notes",
  ],
  securityTechDetails: [
    "securityTechDetails",
    "security_tech_details",
    "cameraAccessControlDetails",
    "camera_access_control_details",
    "techDetails",
    "tech_details",
  ],
  notes: ["notes", "projectDetails", "project_details", "details", "description"],
});

const REQUIRED_FIELD_LABELS_HU = Object.freeze({
  service_need: "szolgáltatási igény",
  location_or_site: "helyszín vagy objektum",
  urgency_or_timing: "időzítés vagy sürgősség",
  contact_need: "biztonságos kapcsolati adat",
});

const KNOWN_LOCATION_PATTERN =
  /\b(Budapest(?:\s?(?:[IVXLCDM]+\.?|\d{1,2}\.?\s?ker(?:ület)?|belváros|Buda|Pest))?|Budakalász|Debrecen|Szeged|Miskolc|Pécs|Győr|Nyíregyháza|Kecskemét|Székesfehérvár|Szombathely|Szolnok|Tatabánya|Kaposvár|Békéscsaba|Érd|Veszprém|Sopron|Eger|Nagykanizsa|Dunaújváros|Hódmezővásárhely|Dunakeszi|Szigetszentmiklós|Pest megye|országos|orsz[aá]gos|nationwide)(?:en|on|ban|ben|i|an|re|ra|hoz|hez|höz)?\b/i;
const SERVICE_QUESTION_PATTERN =
  /\b(milyen szolg[aá]ltat[aá]s(?:ok|okra|okat)?|mire haszn[aá]lhat[oó]|mit v[aá]llal(?:tok|nak)?|mivel foglalkoz|services|what do you offer|what services)\b/i;
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

function normalizeLooseText(value = "") {
  return safeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

  return isInternalPlatformEmail(email) ? "" : email;
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
    staffingRequirement: limitText(
      readAliasedField(fields, FIELD_ALIASES.staffingRequirement),
      FIELD_LIMITS.staffingRequirement
    ),
    assetsCoverageNotes: limitText(
      readAliasedField(fields, FIELD_ALIASES.assetsCoverageNotes),
      FIELD_LIMITS.assetsCoverageNotes
    ),
    securityTechDetails: limitText(
      readAliasedField(fields, FIELD_ALIASES.securityTechDetails),
      FIELD_LIMITS.securityTechDetails
    ),
    notes: limitText(readAliasedField(fields, FIELD_ALIASES.notes), FIELD_LIMITS.notes),
  };
}

function appendDistinctText(existing = "", incoming = "", maxLength = 400) {
  const current = safeText(existing);
  const next = safeText(incoming);

  if (!current) {
    return next.slice(0, maxLength);
  }

  if (!next || normalizeLooseText(current).includes(normalizeLooseText(next))) {
    return current.slice(0, maxLength);
  }

  if (normalizeLooseText(next).includes(normalizeLooseText(current))) {
    return next.slice(0, maxLength);
  }

  return `${current}; ${next}`.slice(0, maxLength);
}

function mergeEnterpriseFieldValue(key, existing = "", incoming = "") {
  const maxLength = FIELD_LIMITS[key] || 400;

  if ([
    "serviceNeed",
    "staffingRequirement",
    "assetsCoverageNotes",
    "securityTechDetails",
  ].includes(key)) {
    return appendDistinctText(existing, incoming, maxLength);
  }

  return safeText(existing) || safeText(incoming);
}

function mergeFields(...fieldSets) {
  return fieldSets.reduce((merged, fields) => {
    const normalized = normalizeEnterpriseRequestDeskFields(fields);

    for (const [key, value] of Object.entries(normalized)) {
      if (value) {
        merged[key] = mergeEnterpriseFieldValue(key, merged[key], value);
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

function normalizeLocationCandidate(value = "") {
  return safeText(value)
    .replace(/\b([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}.-]{3,})(?:on|en|ön|ban|ben|nál|nél|re|ra|hoz|hez|höz)\b/gu, "$1")
    .replace(/\s+\b(?:j[oö]v[oő]|next|s[uü]rg[oő]s|urgent|email|telefon|phone)\b.*$/i, "")
    .trim();
}

function extractLocationOrSite(message = "") {
  const text = safeText(message);
  const explicit = extractFirstMatch(text, [
    /\b(?:helysz[ií]n|telephely|objektum|site|location|facility)\s*[:-]\s*([^.,!?;]{2,120})/i,
    /\b(?:helysz[ií]n(?:em|[uü]nk)?|telephely(?:em|[uü]nk)?|objektum(?:unk)?|site|location|facility)\s+(?:van|lesz|lenne|tal[aá]lhat[oó]|m[uű]k[oö]dik)\s+([^.,!?;]{2,120})/i,
    /\b(?:office building|warehouse|factory|site|facility)\s+(?:in|near|at)\s+([^.,!?;]{2,80})/i,
    /\b(?:in|near|around|at)\s+([A-Z][A-Za-zÀ-ž\s.-]{2,80})/i,
  ]);
  const knownLocation = text.match(KNOWN_LOCATION_PATTERN)?.[1] || "";
  const candidate = explicit || knownLocation;

  return normalizeLocationCandidate(candidate)
    .slice(0, FIELD_LIMITS.locationOrSite);
}

function extractSiteType(message = "") {
  return extractFirstMatch(message, [
    /\b(irodah[aá]z(?:hoz|ban|ba|ra|re)?|iroda|rakt[aá]r(?:hoz|ban|ba|ra|re)?|gy[aá]r(?:hoz|ban|ba|ra|re)?|telephely(?:em|[uü]nk|hez|en|re)?|ipari park|logisztikai k[oö]zpont|office building|warehouse|factory|facility|site)\b/i,
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
    /\b(0\s?[-–]?\s?24(?:\s?[-–]?\s?(?:biztons[aá]gi szolg[aá]lat\w*|[oő]rz[eé]s\w*|fel[uü]gyelet\w*))?|24\/7|non[-\s]?stop|[eé]jjel[-\s]?nappal(?:i)?|napi 24 [oó]r[aá]s)\b/i,
    /\b(ma|holnap(?:t[oó]l)?|azonnal|min[eé]l hamarabb|s[uü]rg[oő]s|asap|urgent|today|tomorrow)\b/i,
    /\b(ezen a h[eé]ten|j[oö]v[oő] h[eé]t(?:en|t[oő]l)?|j[oö]v[oő] h[oó]napt[oó]l|next week|next month|this week)\b/i,
    /\b(1\s?[-–]\s?2 h[eé]t(?:en)?|egy-k[eé]t h[eé]t|k[eé]t h[eé]ten bel[uü]l|1\s?[-–]\s?2 weeks?)\b/i,
    /\b(negyed[eé]v v[eé]g[eé]ig|h[oó]nap v[eé]g[eé]ig|quarter end|end of quarter)\b/i,
    /\b(folyamatos|rendszeres|hossz[uú] t[aá]v[uú]|continuous|ongoing|monthly|quarterly)\b/i,
    /\b((?:h[eé]tk[oö]znap(?:okon|on)?|munkanap(?:okon)?|munkaid[oő]ben|weekday(?:s)?)(?:\s+\d{1,2}(?::\d{2})?\s?[-–]\s?\d{1,2}(?::\d{2})?\s*(?:[oó]ra|h)?(?:\s+k[oö]z[oö]tt)?)?)\b/i,
    /\b(\d{1,2}(?::\d{2})?\s?[-–]\s?\d{1,2}(?::\d{2})?\s*(?:[oó]ra|h)(?:\s+k[oö]z[oö]tt)?)\b/i,
  ]).slice(0, FIELD_LIMITS.urgencyOrTiming);
}

function extractStaffingRequirement(message = "") {
  const text = safeText(message);
  const numeric = text.match(/\b(\d{1,2})\s*(?:f[oő]|ember(?:rel|t)?|vagyon[oő]r(?:rel|t)?|biztons[aá]gi\s+[oő]r(?:rel|t)?)\b/i);

  if (numeric?.[1]) {
    return `${numeric[1]} fő`.slice(0, FIELD_LIMITS.staffingRequirement);
  }

  const wordNumber = text.match(/\b(egy|k[eé]t|h[aá]rom|n[eé]gy|[oö]t)\s+(?:f[oő]|ember|vagyon[oő]r|biztons[aá]gi\s+[oő]r)\b/i)?.[1] || "";
  const numberByWord = {
    egy: "1",
    két: "2",
    ket: "2",
    három: "3",
    harom: "3",
    négy: "4",
    negy: "4",
    öt: "5",
    ot: "5",
  };
  const resolved = numberByWord[normalizeLooseText(wordNumber)];

  return resolved ? `${resolved} fő` : "";
}

function extractAssetsCoverageNotes(message = "") {
  const search = normalizeLooseText(message);
  const assetLabels = [];
  const coverageLabels = [];

  if (/\bauto\w*/.test(search)) assetLabels.push("autók");
  if (/\bjarmu\w*/.test(search)) assetLabels.push("járművek");
  if (/\bhajo\w*/.test(search)) assetLabels.push("hajók");
  if (/\beszkoz\w*/.test(search)) assetLabels.push("eszközök");
  if (/\baru\w*|raktarkeszlet\w*/.test(search)) assetLabels.push("áru / raktárkészlet");

  if (/\begesz terulet\w*/.test(search)) coverageLabels.push("egész terület");
  if (/\bbelso\w*\/kulso\w*|\bkulso\w*\/belso\w*|belso\w*.{0,35}kulso\w*|kulso\w*.{0,35}belso\w*/.test(search)) {
    coverageLabels.push("belső/külső lefedés");
  }
  if (/\b0\s?[-–]?\s?24|24\/7|non[-\s]?stop|ejjel[-\s]?nappal/.test(search)) {
    coverageLabels.push("0-24 lefedés");
  }
  if (/\bkamera\w*|cctv|megfigyel\w*/.test(search)) coverageLabels.push("kamerás megfigyelés");

  return [
    assetLabels.length ? `Tárolt értékek: ${assetLabels.join(", ")}` : "",
    coverageLabels.length ? `Lefedés: ${coverageLabels.join(", ")}` : "",
  ].filter(Boolean).join("; ").slice(0, FIELD_LIMITS.assetsCoverageNotes);
}

function extractSecurityTechDetails(message = "") {
  const search = normalizeLooseText(message);
  const details = [];

  if (/\bkamera\w*|cctv/.test(search)) details.push("kamerarendszer / CCTV");
  if (/\bbeleptet\w*|access control/.test(search)) details.push("beléptetés / access control");
  if (/\bmegfigyel\w*|felugyel\w*/.test(search)) details.push("megfigyelés");
  if (/\bbelso\w*\/kulso\w*|\bkulso\w*\/belso\w*|belso\w*.{0,35}kulso\w*|kulso\w*.{0,35}belso\w*/.test(search)) {
    details.push("belső/külső kamerázás");
  }
  if (/\briaszto\w*/.test(search)) details.push("riasztó");
  if (/\bsorompo\w*/.test(search)) details.push("sorompó");
  if (/\bkapu\w*.{0,80}(kishaz\w*|orbode\w*|porta\w*)|\b(kishaz\w*|orbode\w*).{0,80}kapu\w*/.test(search)) {
    details.push("kapunál kialakított felügyeleti pont");
  }

  return [...new Set(details)].join("; ").slice(0, FIELD_LIMITS.securityTechDetails);
}

function extractServiceNeedFromSignals(message = "") {
  const search = normalizeLooseText(message);
  const needs = [];

  if (/\bkamera\w*|cctv/.test(search) && /\bbeleptet\w*|access control/.test(search)) {
    needs.push("kamerarendszer és beléptetés");
  } else if (/\bkamera\w*|cctv/.test(search)) {
    needs.push("kamerarendszer / CCTV");
  } else if (/\bbeleptet\w*|access control/.test(search)) {
    needs.push("beléptetés / access control");
  }

  if (/\b0\s?[-–]?\s?24|24\/7|non[-\s]?stop|ejjel[-\s]?nappal/.test(search) && /\bbiztonsagi szolgalat\w*|orzes\w*|vagyonor\w*|biztonsagi or\w*/.test(search)) {
    needs.push("0-24 biztonsági szolgálat");
  } else if (/\bbiztonsagi szolgalat\w*|orzes\w*|vagyonor\w*|biztonsagi or\w*/.test(search)) {
    needs.push("biztonsági szolgálat");
  }

  return [...new Set(needs)].join("; ").slice(0, FIELD_LIMITS.serviceNeed);
}

function extractServiceNeed(message = "", laneKey = "general_enquiry") {
  const text = safeText(message);
  const signalNeed = extractServiceNeedFromSignals(text);

  if (signalNeed) {
    return signalNeed;
  }

  const explicit = extractFirstMatch(text, [
    /\b([^.,!?;]{3,120}?)\s+(?:kellene|kell|szeretn[eé]nk|sz[uü]ks[eé]ges|needed|required)\b/i,
    /\b(?:sz[uü]ks[eé]g(?:[uü]nk)? van|sz[uü]ks[eé]g lenne|kellene|kell|szeretn[eé]nk|need|looking for|requesting)\s+(?:egy|az|a|an|some)?\s*([^.,!?;]{3,160})/i,
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
    staffingRequirement: extractStaffingRequirement(message),
    assetsCoverageNotes: extractAssetsCoverageNotes(message),
    securityTechDetails: extractSecurityTechDetails(message),
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
    `Belső összefoglaló: ${lane?.labelHu || "Általános érdeklődés"}.`,
    `Igény: ${fields.serviceNeed || "nincs megadva"}.`,
    `Helyszín/objektum: ${fields.locationOrSite || "nincs megadva"}.`,
    fields.siteType ? `Objektumtípus: ${fields.siteType}.` : "",
    `Időzítés: ${fields.urgencyOrTiming || "nincs megadva"}.`,
    fields.staffingRequirement ? `Létszám: ${fields.staffingRequirement}.` : "",
    fields.assetsCoverageNotes ? `Értékek/lefedés: ${fields.assetsCoverageNotes}.` : "",
    fields.securityTechDetails ? `Biztonságtechnika: ${fields.securityTechDetails}.` : "",
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

function buildAcknowledgedDetailList(fields = {}) {
  const normalized = normalizeEnterpriseRequestDeskFields(fields);
  const compactListText = (value = "") => {
    const parts = safeText(value)
      .split(";")
      .map((part) => safeText(part))
      .filter(Boolean);
    const filtered = parts.filter((part, index) => {
      const searchPart = normalizeLooseText(part);

      if (
        /kamerarendszer \/ cctv/.test(searchPart)
        && parts.some((candidate, candidateIndex) =>
          candidateIndex !== index && /kamerarendszer es beleptetes/.test(normalizeLooseText(candidate))
        )
      ) {
        return false;
      }

      return !parts.some((candidate, candidateIndex) => {
        if (candidateIndex === index) return false;
        const searchCandidate = normalizeLooseText(candidate);
        return searchCandidate.includes(searchPart) && searchCandidate.length > searchPart.length;
      });
    });

    return [...new Set(filtered)].join("; ");
  };
  const locationParts = [
    normalized.locationOrSite,
    normalized.siteType && !normalizeLooseText(normalized.locationOrSite).includes(normalizeLooseText(normalized.siteType))
      ? normalized.siteType
      : "",
  ].filter(Boolean);

  return [
    locationParts.length ? `helyszín/objektum: ${locationParts.join(", ")}` : "",
    normalized.serviceNeed ? `igény: ${compactListText(normalized.serviceNeed)}` : "",
    normalized.securityTechDetails ? `biztonságtechnika: ${compactListText(normalized.securityTechDetails)}` : "",
    normalized.assetsCoverageNotes ? `értékek és lefedés: ${compactListText(normalized.assetsCoverageNotes)}` : "",
    normalized.staffingRequirement ? `személyzet: ${normalized.staffingRequirement}` : "",
    normalized.urgencyOrTiming ? `időzítés/lefedettség: ${normalized.urgencyOrTiming}` : "",
  ].filter(Boolean).slice(0, 6);
}

function buildNaturalIntakeReply({ fields, laneKey, missingFields, businessContext } = {}) {
  const details = buildAcknowledgedDetailList(fields);
  const acknowledgement = details.length
    ? `Rögzítettem a fő részleteket: ${details.join("; ")}.`
    : "Rögzítettem, amit megadott.";

  if (missingFields?.length) {
    return `${acknowledgement} ${buildNextQuestion({ laneKey, missingFields })}`;
  }

  const businessName = normalizeBusinessContext(businessContext).businessName || "a csapat";

  return [
    acknowledgement,
    `A minimális intake adatok megvannak; ${businessName} a részletek alapján tud visszajelezni a vállalhatóságról és a következő lépésről. Ez nem végleges ajánlat vagy garantált ár.`,
  ].join("\n\n");
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

function extractReplyQuestions(reply = "") {
  return safeText(reply)
    .split(/(?<=[.!?\n])\s+/u)
    .map((part) => safeText(part))
    .filter((part) => part.endsWith("?") && part.length >= 8)
    .slice(0, 6);
}

function questionAsksForAnsweredField(question = "", fields = {}) {
  const search = normalizeLooseText(question);
  const normalizedFields = normalizeEnterpriseRequestDeskFields(fields);

  if (
    (normalizedFields.locationOrSite || normalizedFields.siteType)
    && /\b(hol|where|site|location|melyik telepules\w*|melyik helyszin\w*|helyszin\w*|objektum\w*|telephely\w*)\b/.test(search)
  ) {
    return true;
  }

  if (
    normalizedFields.serviceNeed
    && /\b(milyen szolgaltatas|melyik szolgaltatasi|milyen igeny|mit kell|service need|what service)\b/.test(search)
  ) {
    return true;
  }

  if (
    normalizedFields.urgencyOrTiming
    && /\b(mikor|idopont|idozites|hatarido|indul|kezdes|timing|when|deadline|start)\b/.test(search)
  ) {
    return true;
  }

  if (
    (normalizedFields.contactEmail || normalizedFields.contactPhone || normalizedFields.contactPreference)
    && /\b(elerhetoseg|email|e-mail|telefon|kapcsolat|contact|phone)\b/.test(search)
  ) {
    return true;
  }

  return false;
}

function sharedReplyNeedsStructuredFallback({ reply = "", analysis = {}, mode = "enterprise_intake" } = {}) {
  if (mode !== "enterprise_intake") {
    return false;
  }

  const questions = extractReplyQuestions(reply);

  if (analysis.missingFields?.length && questions.length > 1) {
    return true;
  }

  return questions.some((question) => questionAsksForAnsweredField(question, analysis.fields));
}

function applyEnterpriseIntakeReplyContract({ reply = "", analysis = {}, businessContext = {} } = {}) {
  const normalizedReply = safeText(reply);
  const questions = extractReplyQuestions(normalizedReply);

  if (!analysis.missingFields?.length || questions.length) {
    return normalizedReply;
  }

  return `${normalizedReply}\n\n${buildNextQuestion({
    laneKey: analysis.laneClassification?.laneKey,
    missingFields: analysis.missingFields,
    businessContext,
  })}`;
}

function chooseEnterpriseAssistantReply({
  analysis,
  sharedTurn,
  mode,
  message,
  businessContext,
} = {}) {
  const sharedReply = safeText(sharedTurn?.reply);

  if (hasSafeSharedReply(sharedReply) && !sharedReplyNeedsStructuredFallback({
    reply: sharedReply,
    analysis,
    mode,
  })) {
    return mode === "enterprise_intake"
      ? applyEnterpriseIntakeReplyContract({
        reply: sharedReply,
        analysis,
        businessContext,
      })
      : sharedReply;
  }

  if (mode === "business_question") {
    return buildBusinessQuestionReply({
      message,
      businessContext,
      laneKey: analysis.laneClassification.laneKey,
    });
  }

  return analysis.assistantReply;
}

function buildFallbackReply({ message, laneKey, missingFields, safetyFlags, businessContext, fields } = {}) {
  if (!safeText(message)) {
    return "Írja le röviden, milyen objektumvédelmi, FM, biztonságtechnikai vagy hatósági/audit jellegű igényről van szó.";
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
    return buildNaturalIntakeReply({
      fields,
      laneKey,
      missingFields,
      businessContext,
    });
  }

  return buildNaturalIntakeReply({
    fields,
    laneKey,
    missingFields,
    businessContext,
  });
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
  const nextQuestion = buildNextQuestion({ laneKey, missingFields });
  const readyForOwnerReview =
    missingFields.length === 0
    && !safetyFlags?.secretLikeInput;

  return {
    lane: laneKey,
    serviceArea: lane?.labelHu || "Általános érdeklődés",
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
    staffingRequirement: normalizedFields.staffingRequirement,
    assetsCoverageNotes: normalizedFields.assetsCoverageNotes,
    securityTechDetails: normalizedFields.securityTechDetails,
    notes: safetyFlags?.promptInjection || safetyFlags?.secretLikeInput ? "" : normalizedFields.notes,
    missingFields,
    nextQuestion,
    readyForOwnerReview,
    readyToSubmit: readyForOwnerReview,
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
      fields,
      businessContext: options.businessContext || {},
    }),
  };
}

export function buildEnterpriseRequestDeskSharedChatInput(options = {}) {
  const businessContext = normalizeBusinessContext(options.businessContext || {});
  const businessName = businessContext.businessName || "Enterprise business";
  const businessId = safeText(options.business?.id || options.agent?.businessId || options.agent?.business_id);
  const agentId = safeText(options.agent?.id || options.agent?.agentId);
  const profileKey = safeText(options.productProfileKey || options.profileKey).toLowerCase();
  const assistantName = profileKey === "esg" ? "ESG Request Desk" : "Enterprise Request Desk";
  const fields = normalizeEnterpriseRequestDeskFields(options.fields || {});
  const missingFields = Array.isArray(options.missingFields)
    ? options.missingFields.map(safeText).filter(Boolean)
    : getMissingFields(fields);
  const knownBriefLines = [
    fields.serviceNeed ? `Felismert igény: ${fields.serviceNeed}.` : "",
    fields.locationOrSite ? `Felismert helyszín: ${fields.locationOrSite}.` : "",
    fields.siteType ? `Felismert objektumtípus: ${fields.siteType}.` : "",
    fields.urgencyOrTiming ? `Felismert időzítés/lefedettség: ${fields.urgencyOrTiming}.` : "",
    fields.staffingRequirement ? `Felismert létszám: ${fields.staffingRequirement}.` : "",
    fields.assetsCoverageNotes ? `Felismert értékek/lefedés: ${fields.assetsCoverageNotes}.` : "",
    fields.securityTechDetails ? `Felismert biztonságtechnika: ${fields.securityTechDetails}.` : "",
    fields.contactEmail || fields.contactPhone || fields.contactPreference
      ? "Kapcsolati út már megadva."
      : "",
    missingFields.length
      ? `Csak ezekből kérdezz vissza, ha fontos: ${missingFields.map((field) => REQUIRED_FIELD_LABELS_HU[field] || field).join(", ")}.`
      : "A minimális intake adatok megvannak; ne kérdezz vissza már megadott helyszínre, objektumra, szolgáltatásra vagy időzítésre.",
    "Egy válaszban legfeljebb egy következő, nagy értékű kérdést tegyél fel.",
  ].filter(Boolean);

  return {
    supabase: options.supabase,
    openai: options.openai,
    agent: {
      id: agentId || "enterprise-request-desk-report-only-agent",
      businessId: businessId || "enterprise-request-desk-report-only-business",
      ownerUserId: safeText(options.agent?.ownerUserId || options.agent?.owner_user_id),
      name: assistantName,
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
      assistantName,
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
        profileKey === "esg"
          ? "Az ESG Request Desk objektumvédelmi, FM, biztonságtechnikai, őrzési és audit jellegű megkereséseket pontosít."
          : "Az Enterprise Request Desk széles vállalati megkereséseket strukturál belső áttekintésre.",
        ...knownBriefLines,
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
  const generateSharedTurn = deps.generateSharedChatAssistantTurn || generateSharedChatAssistantTurn;
  const hasInjectedSharedTurn = typeof deps.generateSharedChatAssistantTurn === "function"
    || Boolean(deps.sharedChatDeps);
  const hasOpenAiChat = Boolean(options.openai?.chat?.completions?.create);
  const profileKey = safeText(options.productProfileKey || options.profileKey).toLowerCase();
  const businessName = normalizeBusinessContext(options.businessContext || {}).businessName;
  const isEsgProfile = profileKey === "esg" || /ESG Holding/i.test(businessName);

  if (
    message
    && (mode === "business_question" || isEsgProfile)
    && (hasInjectedSharedTurn || hasOpenAiChat)
    && !analysis.safetyFlags.secretLikeInput
    && !analysis.safetyFlags.promptInjection
    && !analysis.safetyFlags.pricingGuaranteeRequested
    && !analysis.safetyFlags.deferredOperationsRequested
  ) {
    try {
      sharedTurn = await generateSharedTurn(
        buildEnterpriseRequestDeskSharedChatInput({
          ...options,
          message,
          conversation,
          fields: analysis.fields,
          missingFields: analysis.missingFields,
          productProfileKey: profileKey || (isEsgProfile ? "esg" : "enterprise"),
        }),
        deps.sharedChatDeps || deps
      );
    } catch {
      sharedTurn = null;
    }
  }

  const assistantReply = chooseEnterpriseAssistantReply({
    analysis,
    sharedTurn,
    mode,
    message,
    businessContext: options.businessContext || {},
  });

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
