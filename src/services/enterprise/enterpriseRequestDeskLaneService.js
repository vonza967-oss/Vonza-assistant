import { cleanText } from "../../utils/text.js";

export const ENTERPRISE_REQUEST_DESK_LANE_KEYS = Object.freeze([
  "security_guarding",
  "reception_object_protection",
  "facility_management",
  "security_technology",
  "audit_compliance",
  "mixed_enterprise_request",
  "general_enquiry",
]);

const COMMON_SAFE_REQUIRED_FIELDS = Object.freeze([
  "service_need",
  "location_or_site",
  "urgency_or_timing",
  "contact_need",
]);

const COMMON_HANDOFF_SUMMARY_SHAPE = Object.freeze({
  lane: "stable lane key",
  laneLabelHu: "Hungarian service-lane label",
  serviceNeed: "visitor-described service need",
  locationOrSite: "site, city, region, or object type",
  urgencyOrTiming: "start date, review deadline, or urgency",
  contactNeed: "safe contact route or missing-contact marker",
  missingFields: "safe required fields still needed before owner/staff review",
});

function deepFreeze(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreeze(item)));
  }

  if (value && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, deepFreeze(nestedValue)])
      )
    );
  }

  return value;
}

const LANE_DEFINITION_INPUTS = [
  {
    key: "security_guarding",
    labelHu: "Őrzés-védelem",
    covers: [
      "Élőerős vagyonőri szolgálat.",
      "Rendszeres vagy időszakos őrzés telephelyen, irodaházban, rendezvényen vagy ipari területen.",
      "Járőrszolgálat és alapvető vagyonvédelmi feladatok, ha nincs külön recepciós vagy technológiai igény.",
    ],
    keywords: [
      "őrzés-védelem",
      "őrzés",
      "orzes vedelem",
      "orzes",
      "vagyonőr",
      "vagyonor",
      "biztonsági őr",
      "biztonsagi or",
      "élőerős",
      "eloeros",
      "guarding",
      "security guard",
      "járőr",
      "jaror",
      "rendezvénybiztosítás",
      "rendezvenybiztositas",
      "objektumőrzés",
      "objektumorzes",
    ],
    keyQualifyingQuestions: [
      "Milyen objektumot vagy területet kell őrizni?",
      "Folyamatos, időszakos vagy eseményhez kötött őrzésre van szükség?",
      "Mikor indulna a szolgálat, és milyen napi vagy heti lefedettség kell?",
    ],
  },
  {
    key: "reception_object_protection",
    labelHu: "Portaszolgálat / objektumvédelem",
    covers: [
      "Portaszolgálat, beléptetés és recepciós vagyonvédelmi jelenlét.",
      "Objektumvédelmi feladatok, ahol belépési rend, látogatói kezelés vagy recepciós folyamat is része az igénynek.",
      "Irodaház, telephely, ipari park vagy intézményi beléptetési igények előminősítése.",
    ],
    keywords: [
      "portaszolgálat",
      "portaszolgalat",
      "porta",
      "recepció",
      "recepcio",
      "objektumvédelem",
      "objektumvedelem",
      "beléptetés",
      "beleptetes",
      "gatehouse",
      "reception",
      "front desk security",
      "access desk",
    ],
    keyQualifyingQuestions: [
      "Milyen beléptetési vagy portaszolgálati feladatot kell lefedni?",
      "Hány bejárat, műszak vagy látogatói folyamat érintett?",
      "Van meglévő beléptetési szabályzat vagy helyszíni rend, amihez igazodni kell?",
    ],
  },
  {
    key: "facility_management",
    labelHu: "Facility Management",
    covers: [
      "Létesítményüzemeltetés, karbantartási koordináció és FM jellegű támogatás.",
      "Több telephelyes vagy ismétlődő épületüzemeltetési igények első strukturálása.",
      "Takarítási, karbantartási, technikai üzemeltetési, integrált védelmi vagy soft FM jellegű mix előminősítése.",
    ],
    keywords: [
      "facility management",
      "fm",
      "létesítményüzemeltetés",
      "letesitmenyuzemeltetes",
      "épületüzemeltetés",
      "epuletuzemeltetes",
      "karbantartás",
      "karbantartas",
      "technikai karbantartás",
      "technikai karbantartas",
      "üzemeltetés",
      "uzemeltetes",
      "hibabejelentés",
      "hibabejelentes",
      "takarítás",
      "takaritas",
      "soft fm",
      "integrált védelem",
      "integralt vedelem",
      "maintenance",
      "facility maintenance",
      "soft facility",
      "hard facility",
    ],
    keyQualifyingQuestions: [
      "Milyen létesítmény vagy telephely üzemeltetéséről van szó?",
      "Mely FM feladatok tartoznak bele: karbantartás, takarítás, koordináció vagy vegyes támogatás?",
      "Egyszeri feladat, rendszeres szolgáltatás vagy több telephelyes keretigény?",
    ],
  },
  {
    key: "security_technology",
    labelHu: "Biztonságtechnika",
    covers: [
      "Kamerarendszer, beléptető, riasztó, access control vagy kapcsolódó biztonságtechnikai igény.",
      "Telepítés, bővítés, felmérés, karbantartás vagy rendszer-összekapcsolás előminősítése.",
      "Technológiai vagyonvédelmi igények, amelyek nem pusztán élőerős őrzésről szólnak.",
    ],
    keywords: [
      "biztonságtechnika",
      "biztonsagtechnika",
      "kamera",
      "cctv",
      "kamerarendszer",
      "ip kamera",
      "analóg kamera",
      "analog kamera",
      "beléptető",
      "belepteto",
      "access control",
      "riasztó",
      "riaszto",
      "tűzjelző",
      "tuzjelzo",
      "sorompó",
      "sorompo",
      "közterületi megfigyelés",
      "kozteruleti megfigyeles",
      "társasházi kamera",
      "tarsashazi kamera",
      "telefonhálózat",
      "telefonhalozat",
      "optikai hálózat",
      "optikai halozat",
      "it hálózat",
      "it halozat",
      "távfelügyelet",
      "tavfelugyelet",
      "videómegfigyelés",
      "videomegfigyeles",
      "security technology",
    ],
    keyQualifyingQuestions: [
      "Milyen biztonságtechnikai rendszerre van szükség?",
      "Új telepítésről, bővítésről, karbantartásról vagy auditált állapotfelmérésről van szó?",
      "Hány helyszín, bejárat, kamera vagy jogosultsági pont érintett?",
    ],
  },
  {
    key: "audit_compliance",
    labelHu: "Hatósági / audit támogatás",
    covers: [
      "Vagyonvédelmi, biztonsági, üzemeltetési, hatósági vagy megfelelőségi audit előkészítése.",
      "Szabályzat, kockázatértékelés, hatósági engedély, beszerzési támogatás vagy belső ellenőrzési igény első tisztázása.",
      "Olyan kérdések, ahol bizonyíték, dokumentum vagy compliance döntés kell, de Phase 1-ben nem készül dokumentum.",
    ],
    keywords: [
      "audit",
      "compliance",
      "hatósági",
      "hatosagi",
      "engedély",
      "engedely",
      "külkereskedelmi",
      "kulkereskedelmi",
      "védelmi engedély",
      "vedelmi engedely",
      "nato beszállító",
      "nato beszallito",
      "beszerzés támogatás",
      "beszerzes tamogatas",
      "biztonságtudatossági képzés",
      "biztonsagtudatossagi kepzes",
      "szakértői tervezés",
      "szakertoi tervezes",
      "megfelelőség",
      "megfeleloseg",
      "szabályzat",
      "szabalyzat",
      "kockázatértékelés",
      "kockazatertekeles",
      "ellenőrzés",
      "ellenorzes",
      "tanúsítás",
      "tanusitas",
      "risk assessment",
      "belső audit",
      "belso audit",
    ],
    keyQualifyingQuestions: [
      "Milyen hatósági, audit vagy engedélyezési célhoz kell támogatás?",
      "Mely terület érintett: őrzés-védelem, FM, biztonságtechnika, beszerzés vagy belső szabályozás?",
      "Van határidő, auditdátum, engedélytípus vagy konkrét dokumentumlista, amit figyelembe kell venni?",
    ],
  },
  {
    key: "mixed_enterprise_request",
    labelHu: "Vegyes vállalati megkeresés",
    covers: [
      "Több szolgáltatási területet egyszerre érintő enterprise megkeresés.",
      "Olyan széles igény, ahol külön lane-re bontás és owner/staff review szükséges.",
      "Biztonsági, FM, technológiai és compliance elemek kombinációja.",
    ],
    keywords: [
      "vegyes",
      "komplex",
      "több szolgáltatás",
      "tobb szolgaltatas",
      "őrzés és fm",
      "orzes es fm",
      "guarding and facility",
      "security and fm",
      "multi-service",
      "multiple services",
    ],
    keyQualifyingQuestions: [
      "Mely szolgáltatási területeket kell együtt kezelni?",
      "Van elsődleges prioritás, vagy minden lane egyszerre indulna?",
      "Egy helyszínről vagy több telephelyes keretigényről van szó?",
    ],
  },
  {
    key: "general_enquiry",
    labelHu: "Általános érdeklődés",
    covers: [
      "Általános szolgáltatási, elérhetőségi vagy scope kérdés.",
      "Olyan megkeresés, amely még nem tartalmaz elég adatot lane szerinti besoroláshoz.",
      "Biztonságos fallback, amikor a kérdés nem illik konkrét enterprise intake lane-be.",
    ],
    keywords: [
      "mivel foglalkoz",
      "milyen szolgáltatás",
      "milyen szolgaltatas",
      "services",
      "what do you offer",
      "általános",
      "altalanos",
      "érdeklődés",
      "erdeklodes",
    ],
    keyQualifyingQuestions: [
      "Melyik szolgáltatási terület érdekli?",
      "Milyen helyszínhez vagy vállalati igényhez kapcsolódik a kérdés?",
      "Kér visszahívást vagy elég egy általános tájékoztatás?",
    ],
  },
];

export const ENTERPRISE_REQUEST_DESK_LANE_DEFINITIONS = Object.freeze(
  LANE_DEFINITION_INPUTS.map((definition) => deepFreeze({
    ...definition,
    safeRequiredFields: COMMON_SAFE_REQUIRED_FIELDS,
    handoffSummaryShape: COMMON_HANDOFF_SUMMARY_SHAPE,
  }))
);

const LANE_BY_KEY = new Map(
  ENTERPRISE_REQUEST_DESK_LANE_DEFINITIONS.map((definition) => [definition.key, definition])
);

const MATCHABLE_LANE_KEYS = Object.freeze([
  "security_guarding",
  "reception_object_protection",
  "facility_management",
  "security_technology",
  "audit_compliance",
]);

const EXPLICIT_MIXED_PATTERN =
  /\b(vegyes|komplex|t[oö]bb szolg[aá]ltat[aá]s|multi[-\s]?service|multiple services|guarding and facility|security and fm)\b/i;
const GENERAL_ENQUIRY_PATTERN =
  /\b(mivel foglalkoz|milyen szolg[aá]ltat[aá]s|mit v[aá]llal|services|what do you offer|general enquiry|általános|altalanos)\b/i;
const SECURITY_TECH_DOMINANT_PATTERN =
  /\b(kamera\w*|kamerarendszer\w*|cctv|riaszt[oó]\w*|bel[eé]ptet\w*|access control|biztons[aá]gtechnika\w*|vide[oó]megfigyel[eé]s\w*)\b/i;
const RECEPTION_DOMINANT_PATTERN =
  /\b(porta|portaszolg[aá]lat|recepci[oó]|objektumv[eé]delem|gatehouse|front desk security|access desk)\b/i;

function normalizeForMatching(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function textFromInput(input = {}) {
  if (typeof input === "string") {
    return cleanText(input);
  }

  if (!input || typeof input !== "object") {
    return "";
  }

  return [
    input.message,
    input.text,
    input.serviceNeed,
    input.service_need,
    input.projectDetails,
    input.project_details,
    input.notes,
  ].map(cleanText).filter(Boolean).join(" ");
}

function keywordMatches(searchText, keyword) {
  const normalizedKeyword = normalizeForMatching(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.length <= 3 && !/\s/.test(normalizedKeyword)) {
    return new RegExp(`(^|[^a-z0-9])${normalizedKeyword}($|[^a-z0-9])`).test(searchText);
  }

  return searchText.includes(normalizedKeyword);
}

function scoreLane(definition, searchText) {
  const matchedKeywords = definition.keywords.filter((keyword) => keywordMatches(searchText, keyword));
  const score = matchedKeywords.reduce((total, keyword) => {
    const normalizedKeyword = normalizeForMatching(keyword);
    return total + (normalizedKeyword.includes(" ") || normalizedKeyword.length > 10 ? 2 : 1);
  }, 0);

  return {
    laneKey: definition.key,
    score,
    matchedKeywords,
  };
}

function confidenceForScore(score) {
  if (score >= 3) {
    return "high";
  }

  return score > 0 ? "medium" : "low";
}

export function normalizeEnterpriseRequestDeskLaneKey(value) {
  const normalized = cleanText(value).toLowerCase();

  return LANE_BY_KEY.has(normalized) ? normalized : "general_enquiry";
}

export function getEnterpriseRequestDeskLane(value) {
  return LANE_BY_KEY.get(normalizeEnterpriseRequestDeskLaneKey(value));
}

export function listEnterpriseRequestDeskLanes() {
  return Object.freeze(ENTERPRISE_REQUEST_DESK_LANE_DEFINITIONS.map((definition) => deepFreeze(definition)));
}

export function classifyEnterpriseRequestDeskLane(input = {}) {
  const text = textFromInput(input);
  const searchText = normalizeForMatching(text);

  if (!searchText) {
    return deepFreeze({
      laneKey: "general_enquiry",
      confidence: "low",
      matchedLaneKeys: [],
      matchedKeywords: [],
      reason: "empty_or_missing_text",
    });
  }

  const laneScores = MATCHABLE_LANE_KEYS
    .map((laneKey) => scoreLane(LANE_BY_KEY.get(laneKey), searchText))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.laneKey.localeCompare(b.laneKey));
  const matchedLaneKeys = laneScores.map((entry) => entry.laneKey);
  const matchedKeywords = laneScores.flatMap((entry) => entry.matchedKeywords);
  const explicitMixed = EXPLICIT_MIXED_PATTERN.test(text);
  const hasSecurityTechnology = laneScores.some((entry) => entry.laneKey === "security_technology");
  const hasReception = laneScores.some((entry) => entry.laneKey === "reception_object_protection");

  if (
    !explicitMixed
    && laneScores.length === 2
    && hasSecurityTechnology
    && hasReception
    && SECURITY_TECH_DOMINANT_PATTERN.test(text)
    && !RECEPTION_DOMINANT_PATTERN.test(text)
  ) {
    return deepFreeze({
      laneKey: "security_technology",
      confidence: "high",
      matchedLaneKeys,
      matchedKeywords,
      reason: "security_technology_dominant_access_control",
    });
  }

  if ((explicitMixed && laneScores.length > 0) || laneScores.length >= 2) {
    return deepFreeze({
      laneKey: "mixed_enterprise_request",
      confidence: laneScores.length >= 2 ? "high" : "medium",
      matchedLaneKeys,
      matchedKeywords,
      reason: explicitMixed ? "explicit_mixed_request" : "multiple_lane_matches",
    });
  }

  if (laneScores.length === 1) {
    return deepFreeze({
      laneKey: laneScores[0].laneKey,
      confidence: confidenceForScore(laneScores[0].score),
      matchedLaneKeys,
      matchedKeywords,
      reason: "keyword_match",
    });
  }

  if (GENERAL_ENQUIRY_PATTERN.test(text)) {
    return deepFreeze({
      laneKey: "general_enquiry",
      confidence: "medium",
      matchedLaneKeys: [],
      matchedKeywords: [],
      reason: "general_service_question",
    });
  }

  return deepFreeze({
    laneKey: "general_enquiry",
    confidence: "low",
    matchedLaneKeys: [],
    matchedKeywords: [],
    reason: "no_lane_match",
  });
}
