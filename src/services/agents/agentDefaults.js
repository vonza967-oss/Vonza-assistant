export const DEFAULT_AGENT_NAME = "Vonza AI";
export const DEFAULT_PURPOSE = "support";
export const DEFAULT_TONE = "helpful, natural, concise";
export const DEFAULT_LANGUAGE = "auto";

export const DEFAULT_WIDGET_CONFIG = {
  assistantName: "Vonza AI",
  welcomeMessage: "How may I be of your service today?",
  buttonLabel: "Chat with Vonza",
  launcherText: "YOUR PERSONAL ASSISTANT",
  widgetLogoUrl: "",
  primaryColor: "#10a37f",
  secondaryColor: "#0c7f75",
  themeMode: "dark",
  bookingUrl: "",
  quoteUrl: "",
  checkoutUrl: "",
  bookingStartUrl: "",
  quoteStartUrl: "",
  bookingSuccessUrl: "",
  quoteSuccessUrl: "",
  checkoutSuccessUrl: "",
  successUrlMatchMode: "path_prefix",
  manualOutcomeMode: false,
  contactEmail: "",
  contactPhone: "",
  primaryCtaMode: "contact",
  fallbackCtaMode: "capture",
  businessHoursNote: "",
};

export const FULL_PAGE_ACTION_CARD_TYPES = Object.freeze([
  "services",
  "pricing",
  "quote",
  "booking",
  "contact",
  "custom",
]);

export const DEFAULT_FULL_PAGE_ACTION_CARDS = Object.freeze([
  Object.freeze({
    label: "Ask about services",
    description: "See what this business can help with.",
    prompt: "What services do you offer?",
    type: "services",
    enabled: true,
  }),
  Object.freeze({
    label: "Ask about pricing",
    description: "Ask what affects price, scope, and next steps.",
    prompt: "How much does it cost?",
    type: "pricing",
    enabled: true,
  }),
  Object.freeze({
    label: "Request a quote",
    description: "Share what you need so the business can follow up.",
    prompt: "I'd like to request a quote.",
    type: "quote",
    enabled: true,
  }),
  Object.freeze({
    label: "Contact details",
    description: "Find the best way to reach the team.",
    prompt: "How can I contact you?",
    type: "contact",
    enabled: true,
  }),
]);

export const DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD = Object.freeze({
  label: "Book a time",
  description: "Ask about appointments, calls, visits, or the next step.",
  prompt: "I'd like to book a time.",
  type: "booking",
  enabled: true,
});

export const DEFAULT_FULL_PAGE_TRUST_ITEMS = Object.freeze([
  "Typically replies instantly",
  "AI assistant",
  "Leave your details if needed",
]);

export const DEFAULT_FULL_PAGE_CONFIG = Object.freeze({
  headline: null,
  subtitle: null,
  actionCards: DEFAULT_FULL_PAGE_ACTION_CARDS,
  suggestedQuestions: [],
  accentColor: null,
  logoUrl: null,
  showBooking: false,
  showQuote: true,
  showContact: true,
  trustItems: DEFAULT_FULL_PAGE_TRUST_ITEMS,
});
