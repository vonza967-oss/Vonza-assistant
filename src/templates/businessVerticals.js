import { cleanText } from "../utils/text.js";

export const BUSINESS_VERTICAL_TEMPLATES = Object.freeze([
  Object.freeze({
    key: "clinic",
    label: "Clinic or healthcare office",
    description:
      "Healthcare, wellness, dental, therapy, and appointment-based care businesses.",
    commonQuestions: Object.freeze([
      Object.freeze({
        question: "Can I book an appointment?",
        answer:
          "Explain the available booking route from the website or live settings. If no booking link is configured, ask for the visitor's name, contact detail, preferred time, and the service they need.",
      }),
      Object.freeze({
        question: "Do you accept new patients?",
        answer:
          "Answer only from the available website context. If it is not stated, say that clearly and suggest contacting the clinic with the requested service and preferred appointment window.",
      }),
      Object.freeze({
        question: "What should I bring to my visit?",
        answer:
          "Mention any listed documents, referrals, insurance details, or preparation notes. Avoid inventing medical requirements.",
      }),
    ]),
    systemInstructions:
      "Use a calm, careful, privacy-aware tone. Do not provide diagnosis, treatment decisions, dosage guidance, emergency triage, or medical guarantees. For urgent symptoms or emergencies, advise the visitor to contact local emergency services or the clinic directly. Keep appointment, preparation, pricing, insurance, and contact answers practical and clearly grounded in the provided business information.",
  }),
  Object.freeze({
    key: "web_studio",
    label: "Web studio or agency",
    description:
      "Website design, development, SEO, ecommerce, branding, and digital growth studios.",
    commonQuestions: Object.freeze([
      Object.freeze({
        question: "How much does a website cost?",
        answer:
          "If packages or prices are listed, summarize them clearly. If not, explain that custom scope affects pricing and ask for project type, timeline, must-have features, and contact details for a quote.",
      }),
      Object.freeze({
        question: "Can you build an ecommerce site?",
        answer:
          "Name ecommerce or webshop services only if present in the website content. Ask about product count, payments, shipping, and launch timeline when a quote request fits.",
      }),
      Object.freeze({
        question: "How long does a project take?",
        answer:
          "Use published timeline details if available. Otherwise say the site does not list a fixed timeline and ask what the visitor wants to launch and by when.",
      }),
    ]),
    systemInstructions:
      "Sound like a practical project advisor. Clarify scope before promising pricing or timelines. For quote-ready visitors, ask for business type, desired site or service, timeline, must-have features, and name plus email. Avoid generic agency hype.",
  }),
  Object.freeze({
    key: "home_services",
    label: "Home services",
    description:
      "Plumbing, electrical, HVAC, cleaning, landscaping, renovation, repair, and local field-service businesses.",
    commonQuestions: Object.freeze([
      Object.freeze({
        question: "Do you serve my area?",
        answer:
          "Use listed service areas if available. If coverage is unclear, ask for the visitor's city or ZIP/postal code and the type of job.",
      }),
      Object.freeze({
        question: "Can I get a quote?",
        answer:
          "Ask for the job type, property location, urgency, photos or measurements if relevant, and the best contact detail. Mention any listed quote route.",
      }),
      Object.freeze({
        question: "Do you offer emergency service?",
        answer:
          "Only confirm emergency availability if it is listed. If unclear, say so and provide the fastest available contact route from the website or live settings.",
      }),
    ]),
    systemInstructions:
      "Prioritize urgency, location, job type, and next step. For repair or quote requests, ask concise follow-up questions that help dispatch or estimating. Do not claim licensing, emergency availability, warranties, or service-area coverage unless the business information states it.",
  }),
]);

export function normalizeBusinessVertical(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized || normalized === "general") {
    return "";
  }

  if (["clinic", "clinics", "healthcare", "health", "medical", "dental", "wellness"].includes(normalized)) {
    return "clinic";
  }

  if (["web_studio", "web_studios", "agency", "web_agency", "studio", "digital_agency"].includes(normalized)) {
    return "web_studio";
  }

  if (["home_services", "home_service", "trades", "contractor", "repair", "field_service"].includes(normalized)) {
    return "home_services";
  }

  return BUSINESS_VERTICAL_TEMPLATES.some((template) => template.key === normalized)
    ? normalized
    : "";
}

export function getBusinessVerticalTemplate(value) {
  const normalized = normalizeBusinessVertical(value);
  return BUSINESS_VERTICAL_TEMPLATES.find((template) => template.key === normalized) || null;
}

export function listBusinessVerticalTemplates() {
  return BUSINESS_VERTICAL_TEMPLATES.map((template) => ({
    key: template.key,
    label: template.label,
    description: template.description,
    commonQuestions: template.commonQuestions.map((entry) => ({ ...entry })),
    systemInstructions: template.systemInstructions,
  }));
}

export function formatBusinessVerticalPromptBlock(value) {
  const template = getBusinessVerticalTemplate(value);

  if (!template) {
    return "";
  }

  return [
    `Selected business vertical: ${template.label}`,
    `Business type: ${template.description}`,
    "Vertical-specific guidance:",
    template.systemInstructions,
    "Common visitor questions and suggested answer direction:",
    ...template.commonQuestions.map((entry) => `- ${entry.question}: ${entry.answer}`),
  ].join("\n");
}
