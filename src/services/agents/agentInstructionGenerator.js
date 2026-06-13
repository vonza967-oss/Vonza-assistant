import { cleanText } from "../../utils/text.js";
import {
  getWidgetPurposeInstruction,
  getWidgetPurposeLabel,
  normalizeWidgetPurpose,
} from "./widgetPurpose.js";

const MAX_GENERATED_INSTRUCTIONS_LENGTH = 2200;
const TONE_LABELS = Object.freeze({
  friendly: "Friendly",
  professional: "Professional",
  sales: "Sales-focused",
  support: "Support-focused",
});
const HU_TONE_LABELS = Object.freeze({
  friendly: "Barátságos",
  professional: "Professzionális",
  sales: "Értékesítés-központú",
  support: "Támogatás-központú",
});
const HU_PURPOSE_OPTIONS = Object.freeze({
  guidance: {
    label: "Útmutatás",
    instruction:
      "Segítsen a látogatóknak gyorsan megtalálni a megfelelő információt, magyarázza el a legvilágosabb utat, és tegye könnyen érthetővé a következő lépést.",
  },
  support: {
    label: "Támogatás",
    instruction:
      "Válaszoljon ügyfélkérdésekre, oldja a gyakori bizonytalanságot, és nyugodt támogatást adjon, mielőtt következő lépést javasol.",
  },
  make_decision: {
    label: "Döntés támogatása",
    instruction:
      "Segítsen a látogatóknak összehasonlítani az opciókat, érthetően látni a különbségeket, és kiválasztani a megfelelő szolgáltatást, terméket vagy következő lépést.",
  },
  lead_capture: {
    label: "Érdeklődő rögzítése / kapcsolat",
    instruction:
      "Érdeklődés esetén tegye egyértelművé a kapcsolatfelvételi vagy ajánlatkérési utat, és természetesen vezesse a látogatót az utánkövetési adatok megadásához.",
  },
  booking_next_step: {
    label: "Foglalás / következő lépés",
    instruction:
      "Tartsa a válaszokat a legjobb gyakorlati következő lépésre fókuszálva, különösen foglalás, ajánlatkérés, kapcsolatfelvétel vagy más beállított útvonal esetén.",
  },
});

function normalizeTone(value = "") {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  return Object.prototype.hasOwnProperty.call(TONE_LABELS, normalized)
    ? normalized
    : "friendly";
}

function normalizeLanguage(value = "") {
  const normalized = cleanText(value).toLowerCase();
  return ["hu", "hungarian", "magyar"].includes(normalized) ? "hu" : "en";
}

function cleanGeneratedLine(value = "") {
  return Array.from(cleanText(value))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/[<>]/g, "")
    .slice(0, 260);
}

function uniqueList(items = []) {
  const seen = new Set();
  const results = [];

  items.forEach((item) => {
    const value = cleanGeneratedLine(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    results.push(value);
  });

  return results;
}

function hasPresentValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasPresentValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(hasPresentValue);
  }

  return Boolean(cleanText(value));
}

function normalizeQuickPrompts(quickPrompts = []) {
  if (!Array.isArray(quickPrompts)) {
    return [];
  }

  return uniqueList(
    quickPrompts.map((item) => (
      item && typeof item === "object"
        ? cleanText(item.label || item.prompt || item.text || item.value)
        : item
    ))
  ).slice(0, 5);
}

function normalizeContactRoutes(contactSettings = {}) {
  const routes = [];
  const email = cleanGeneratedLine(contactSettings.contactEmail || contactSettings.email);
  const phone = cleanGeneratedLine(contactSettings.contactPhone || contactSettings.phone);
  const bookingUrl = cleanGeneratedLine(contactSettings.bookingUrl || contactSettings.booking_url);
  const quoteUrl = cleanGeneratedLine(contactSettings.quoteUrl || contactSettings.quote_url);
  const checkoutUrl = cleanGeneratedLine(contactSettings.checkoutUrl || contactSettings.checkout_url);

  if (email) {
    routes.push(`email: ${email}`);
  }
  if (phone) {
    routes.push(`phone: ${phone}`);
  }
  if (bookingUrl) {
    routes.push(`booking link: ${bookingUrl}`);
  }
  if (quoteUrl) {
    routes.push(`quote link: ${quoteUrl}`);
  }
  if (checkoutUrl) {
    routes.push(`checkout link: ${checkoutUrl}`);
  }

  return uniqueList(routes);
}

function normalizeBusinessFacts(businessFacts = {}) {
  if (!businessFacts || typeof businessFacts !== "object") {
    return [];
  }

  const labels = [
    ["business summary", businessFacts.businessSummary || businessFacts.business_summary],
    ["services", businessFacts.services],
    ["pricing", businessFacts.pricing],
    ["policies", businessFacts.policies],
    ["service areas", businessFacts.serviceAreas || businessFacts.service_areas],
    ["operating hours", businessFacts.operatingHours || businessFacts.operating_hours],
  ];

  return labels
    .filter(([, value]) => hasPresentValue(value))
    .map(([label]) => label);
}

function normalizeWebsiteKnowledgeStatus(context = {}) {
  const state = cleanText(context.knowledgeState || context.websiteKnowledgeState || context.importState).toLowerCase();
  const hasWebsiteUrl = Boolean(cleanText(context.websiteUrl || context.website_url));
  const pageCount = Number(context.knowledgePageCount || context.pageCount || 0);
  const ready = context.knowledgeReady === true || ["ready", "success", "indexed"].includes(state) || pageCount > 0;
  const limited = context.knowledgeLimited === true || ["limited", "indexing", "running", "queued", "stalled"].includes(state);

  return {
    hasWebsiteUrl,
    ready,
    limited,
    pageCount: Number.isFinite(pageCount) ? Math.max(0, pageCount) : 0,
  };
}

function truncateInstructions(value = "") {
  const cleaned = cleanText(value);
  return cleaned.length > MAX_GENERATED_INSTRUCTIONS_LENGTH
    ? cleaned.slice(0, MAX_GENERATED_INSTRUCTIONS_LENGTH).trimEnd()
    : cleaned;
}

function buildEnglishInstructions({
  purposeLabel,
  purposeInstruction,
  toneLabel,
  websiteKnowledge,
  quickPrompts,
  contactRoutes,
  businessFactLabels,
  hasKnowledgeFiles,
  hasWelcomeMessage,
}) {
  const lines = [
    "You are the client's Website Agent assistant. Help website visitors get clear answers and choose the safest next step.",
    `Agent purpose: ${purposeLabel}. ${purposeInstruction}`,
    `Tone: ${toneLabel}. Keep replies concise, practical, and business-ready.`,
    "Use imported website and approved business knowledge before general guidance. These instructions shape behavior; they do not replace factual sources.",
    "When information is missing, say that politely and ask one useful follow-up question or guide the visitor to a safe next step.",
    "For Hungarian replies, always use formal Hungarian magázódás. Never use informal tegeződés.",
    "Never invent prices, services, guarantees, availability, legal claims, policies, opening hours, booking times, contact details, or routes.",
  ];

  if (websiteKnowledge.ready) {
    lines.push(websiteKnowledge.pageCount
      ? `Website knowledge is available from ${websiteKnowledge.pageCount} imported page${websiteKnowledge.pageCount === 1 ? "" : "s"}; use it first for factual answers.`
      : "Website knowledge is imported; use it first for factual answers.");
  } else if (websiteKnowledge.hasWebsiteUrl || websiteKnowledge.limited) {
    lines.push("Website URL/import is configured but knowledge may be incomplete; be transparent about missing details and avoid guessing.");
  }

  if (hasKnowledgeFiles) {
    lines.push("Use owner-uploaded knowledge files only when they are available in the approved business context.");
  }

  if (businessFactLabels.length) {
    lines.push(`Manual business facts are available for: ${businessFactLabels.join(", ")}. Treat them as approved owner context when relevant.`);
  }

  if (quickPrompts.length) {
    lines.push(`Treat configured quick prompts as likely visitor intents: ${quickPrompts.join("; ")}.`);
  }

  if (contactRoutes.length) {
    lines.push(`Use configured next-step routes only when relevant and available: ${contactRoutes.join(", ")}.`);
  }

  if (hasWelcomeMessage) {
    lines.push("Keep the welcome-message promise in mind, but answer the visitor's actual question first.");
  }

  lines.push("If source knowledge is incomplete, say so briefly and guide the visitor toward contact, quote, booking, or another configured safe next step.");

  return lines.map((line) => `- ${line}`).join("\n");
}

function buildHungarianInstructions({
  purposeLabel,
  purposeInstruction,
  toneLabel,
  websiteKnowledge,
  quickPrompts,
  contactRoutes,
  businessFactLabels,
  hasKnowledgeFiles,
  hasWelcomeMessage,
}) {
  const lines = [
    "Ön az ügyfél Weboldali agent asszisztense. Segítsen a weboldal látogatóinak világos választ kapni és biztonságos következő lépést választani.",
    `Agent célja: ${purposeLabel}. ${purposeInstruction}`,
    `Hangnem: ${toneLabel}. A válasz legyen tömör, gyakorlati és üzletileg hiteles.`,
    "Először az importált weboldali és jóváhagyott üzleti tudást használja. Ezek az utasítások a viselkedést formálják, nem helyettesítik a tényforrásokat.",
    "Hiányzó információnál mondja ezt udvariasan, majd tegyen fel egy hasznos pontosító kérdést, vagy vezesse a látogatót biztonságos következő lépéshez.",
    "Magyar válaszokban mindig formális magázódást használjon. Soha ne használjon tegeződést.",
    "Soha ne találjon ki árakat, szolgáltatásokat, garanciát, elérhetőséget, jogi állítást, szabályzatot, nyitvatartást, foglalási időpontot, kapcsolatot vagy útvonalat.",
  ];

  if (websiteKnowledge.ready) {
    lines.push(websiteKnowledge.pageCount
      ? `Weboldali tudás elérhető ${websiteKnowledge.pageCount} importált oldalból; tényszerű válaszoknál ezt használja először.`
      : "Weboldali tudás importálva van; tényszerű válaszoknál ezt használja először.");
  } else if (websiteKnowledge.hasWebsiteUrl || websiteKnowledge.limited) {
    lines.push("A weboldal URL/import be van állítva, de a tudás hiányos lehet; hiányzó részleteknél legyen átlátható és ne találgasson.");
  }

  if (hasKnowledgeFiles) {
    lines.push("Tulajdonos által feltöltött tudásfájlokat csak akkor használjon, ha azok megjelennek a jóváhagyott üzleti kontextusban.");
  }

  if (businessFactLabels.length) {
    lines.push(`Kézzel megadott üzleti tények érhetők el ezekhez: ${businessFactLabels.join(", ")}. Releváns kérdésnél kezelje őket jóváhagyott tulajdonosi kontextusként.`);
  }

  if (quickPrompts.length) {
    lines.push(`A beállított gyors kérdéseket kezelje valószínű látogatói szándékként: ${quickPrompts.join("; ")}.`);
  }

  if (contactRoutes.length) {
    lines.push(`Csak akkor használja a beállított következő lépéseket, amikor relevánsak és elérhetők: ${contactRoutes.join(", ")}.`);
  }

  if (hasWelcomeMessage) {
    lines.push("Tartsa szem előtt az üdvözlő üzenet ígéretét, de először a látogató tényleges kérdésére válaszoljon.");
  }

  lines.push("Ha a forrástudás hiányos, jelezze röviden, majd vezesse a látogatót kapcsolatfelvétel, ajánlatkérés, foglalás vagy más beállított biztonságos következő lépés felé.");

  return lines.map((line) => `- ${line}`).join("\n");
}

export function generateWebsiteWidgetAgentInstructions(context = {}) {
  const language = normalizeLanguage(context.language);
  const purpose = normalizeWidgetPurpose(context.widgetPurpose || context.purpose);
  const tone = normalizeTone(context.tone);
  const websiteKnowledge = normalizeWebsiteKnowledgeStatus(context);
  const quickPrompts = normalizeQuickPrompts(context.quickPrompts || context.quick_prompts);
  const contactRoutes = normalizeContactRoutes(context.contactSettings || context);
  const businessFactLabels = normalizeBusinessFacts(context.businessFacts || context.businessProfile || {});
  const hasKnowledgeFiles = hasPresentValue(context.knowledgeFiles || context.uploadedKnowledgeFiles || context.files);
  const hasWelcomeMessage = Boolean(cleanGeneratedLine(context.welcomeMessage || context.welcome_message));
  const purposeLabel = language === "hu"
    ? HU_PURPOSE_OPTIONS[purpose]?.label || getWidgetPurposeLabel(purpose)
    : getWidgetPurposeLabel(purpose);
  const purposeInstruction = language === "hu"
    ? HU_PURPOSE_OPTIONS[purpose]?.instruction || getWidgetPurposeInstruction(purpose)
    : getWidgetPurposeInstruction(purpose);
  const payload = {
    purposeLabel,
    purposeInstruction,
    toneLabel: language === "hu" ? HU_TONE_LABELS[tone] : TONE_LABELS[tone],
    websiteKnowledge,
    quickPrompts,
    contactRoutes,
    businessFactLabels,
    hasKnowledgeFiles,
    hasWelcomeMessage,
  };

  return truncateInstructions(
    language === "hu"
      ? buildHungarianInstructions(payload)
      : buildEnglishInstructions(payload)
  );
}

export {
  MAX_GENERATED_INSTRUCTIONS_LENGTH,
  normalizeBusinessFacts,
  normalizeContactRoutes,
  normalizeQuickPrompts,
  normalizeWebsiteKnowledgeStatus,
};
