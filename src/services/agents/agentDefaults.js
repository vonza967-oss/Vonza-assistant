export const DEFAULT_AGENT_NAME = "Vonza AI";
export const DEFAULT_PURPOSE = "support";
export const DEFAULT_TONE = "helpful, natural, concise";
export const DEFAULT_LANGUAGE = "auto";

export const DEFAULT_WIDGET_CONFIG = {
  assistantName: "Vonza AI",
  welcomeMessage: "Üdvözöljük! Miben segíthetünk?",
  buttonLabel: "Widget megnyitása",
  launcherText: "Weboldali asszisztens",
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

export const VOICE_TTS_VOICES = Object.freeze([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

export const DEFAULT_VOICE_CONFIG = Object.freeze({
  voiceInputEnabled: false,
  spokenRepliesEnabled: false,
  webCallEnabled: false,
  autoSendTranscript: false,
  autoPlaySpokenReplies: false,
  voice: "alloy",
  languageBehavior: "auto",
});

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
    label: "Szolgáltatások",
    description: "Áttekintés arról, miben tud segíteni ez a vállalkozás.",
    prompt: "Milyen szolgáltatásokat kínálnak?",
    type: "services",
    enabled: true,
  }),
  Object.freeze({
    label: "Árak",
    description: "Érdeklődhet az árakról, a terjedelemről és a következő lépésről.",
    prompt: "Milyen árakkal vagy díjakkal számolhatok?",
    type: "pricing",
    enabled: true,
  }),
  Object.freeze({
    label: "Ajánlatkérés",
    description: "Írja le, mire van szüksége, hogy a vállalkozás megfelelő részletekkel követhesse.",
    prompt: "Szeretnék ajánlatot kérni.",
    type: "quote",
    enabled: true,
  }),
  Object.freeze({
    label: "Elérhetőségek",
    description: "Megtalálhatja a legjobb kapcsolatfelvételi módot, vagy megadhatja az adatait.",
    prompt: "Hogyan tudom felvenni a kapcsolatot?",
    type: "contact",
    enabled: true,
  }),
]);

export const DEFAULT_FULL_PAGE_BOOKING_ACTION_CARD = Object.freeze({
  label: "Időpontfoglalás",
  description: "Érdeklődhet időpontról, hívásról, helyszíni látogatásról vagy a legjobb következő lépésről.",
  prompt: "Szeretnék időpontot foglalni.",
  type: "booking",
  enabled: true,
});

export const DEFAULT_FULL_PAGE_TRUST_ITEMS = Object.freeze([
  "Azonnal válaszol",
  "AI asszisztens",
  "Szükség esetén megadhatja az adatait",
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
    description: "Soft light background with gold linework.",
    backgroundType: "image",
    imageUrl: "/assets/front-desk/backgrounds/abstract-light-gold.png",
    videoUrl: null,
    backgroundColor: "#f8f4ea",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0.18,
    textTheme: "dark",
    disableVideoOnMobile: true,
  }),
  "dark-gold-abstract": Object.freeze({
    key: "dark-gold-abstract",
    label: "Dark Gold Abstract",
    description: "Dark background with gold linework.",
    backgroundType: "image",
    imageUrl: "/assets/front-desk/backgrounds/abstract-dark-gold.png",
    videoUrl: null,
    backgroundColor: "#09090b",
    backgroundOverlayColor: "#020617",
    backgroundOverlayOpacity: 0.28,
    textTheme: "light",
    disableVideoOnMobile: true,
  }),
  "bright-abstract-motion": Object.freeze({
    key: "bright-abstract-motion",
    label: "Bright Abstract Motion",
    description: "Bright abstract motion for a clean Front Desk page.",
    backgroundType: "video",
    imageUrl: "/assets/front-desk/backgrounds/vonza_front_desk_bright_poster.png",
    videoUrl: "/assets/front-desk/backgrounds/vonza_front_desk_bright_loop.mp4",
    backgroundColor: "#f8fafc",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0.1,
    textTheme: "dark",
    disableVideoOnMobile: true,
  }),
  "dark-abstract-motion": Object.freeze({
    key: "dark-abstract-motion",
    label: "Dark Abstract Motion",
    description: "Dark abstract motion with a high-contrast Front Desk style.",
    backgroundType: "video",
    imageUrl: "/assets/front-desk/backgrounds/vonza_front_desk_dark_poster.png",
    videoUrl: "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4",
    backgroundColor: "#08111f",
    backgroundOverlayColor: "#020617",
    backgroundOverlayOpacity: 0.24,
    textTheme: "light",
    disableVideoOnMobile: true,
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
  publicPageEnabled: false,
  publicPageKey: "",
  headline: null,
  subtitle: "Érdeklődhet szolgáltatásokról, árakról, ajánlatról vagy elérhetőségről.",
  actionCards: DEFAULT_FULL_PAGE_ACTION_CARDS,
  suggestedQuestions: [
    "Milyen szolgáltatásokat kínálnak?",
    "Mennyibe kerül?",
    "Szeretnék ajánlatot kérni.",
    "Hogyan tudom felvenni a kapcsolatot?",
  ],
  accentColor: null,
  logoUrl: null,
  showBooking: false,
  showQuote: true,
  showContact: true,
  trustItems: DEFAULT_FULL_PAGE_TRUST_ITEMS,
  design: DEFAULT_FULL_PAGE_DESIGN,
});
