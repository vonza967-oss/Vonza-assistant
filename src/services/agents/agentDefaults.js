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
  "Replies instantly",
  "AI assistant",
  "Leave your details if needed",
]);

export const FULL_PAGE_DESIGN_PRESETS = Object.freeze([
  "clean-light",
  "dark-professional",
  "warm-minimal",
  "bold-gradient",
  "image-hero",
  "video-hero",
]);

export const FULL_PAGE_BACKGROUND_SOURCES = Object.freeze([
  "preset",
  "upload",
  "url",
]);

export const FULL_PAGE_BACKGROUND_PRESETS = Object.freeze({
  "clean-light-abstract": Object.freeze({
    key: "clean-light-abstract",
    label: "Clean Light Abstract",
    imageUrl: "/assets/front-desk/backgrounds/abstract-light-gold.png",
    backgroundColor: "#f8f4ea",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0.18,
    textTheme: "dark",
  }),
  "dark-gold-abstract": Object.freeze({
    key: "dark-gold-abstract",
    label: "Dark Gold Abstract",
    imageUrl: "/assets/front-desk/backgrounds/abstract-dark-gold.png",
    backgroundColor: "#09090b",
    backgroundOverlayColor: "#020617",
    backgroundOverlayOpacity: 0.28,
    textTheme: "light",
  }),
});

export const FULL_PAGE_BACKGROUND_TYPES = Object.freeze([
  "color",
  "gradient",
  "image",
  "video",
]);

export const FULL_PAGE_BACKGROUND_FOCAL_POINTS = Object.freeze([
  "center",
  "top",
  "left",
  "right",
]);

export const FULL_PAGE_TEXT_THEMES = Object.freeze(["dark", "light"]);
export const FULL_PAGE_COMPOSER_STYLES = Object.freeze(["soft", "elevated", "minimal"]);
export const FULL_PAGE_CHIP_STYLES = Object.freeze(["outline", "soft", "subtle-fill"]);
export const FULL_PAGE_STATUS_STYLES = Object.freeze(["subtle", "pill", "minimal"]);
export const FULL_PAGE_BACKGROUND_SCOPES = Object.freeze(["section", "iframe"]);

export const DEFAULT_FULL_PAGE_DESIGN = Object.freeze({
  preset: "clean-light",
  backgroundType: "color",
  backgroundSource: "url",
  backgroundPreset: null,
  backgroundColor: "#ffffff",
  backgroundGradientTo: "#eef4ff",
  backgroundImageUrl: null,
  backgroundVideoUrl: null,
  backgroundOverlayColor: "#ffffff",
  backgroundOverlayOpacity: 0.72,
  backgroundBlur: 0,
  backgroundFocalPoint: "center",
  textTheme: "dark",
  composerStyle: "soft",
  chipStyle: "outline",
  statusStyle: "subtle",
  backgroundScope: "section",
  disableVideoOnMobile: true,
});

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
  design: DEFAULT_FULL_PAGE_DESIGN,
});
