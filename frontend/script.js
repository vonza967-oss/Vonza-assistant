const searchParams = new URLSearchParams(window.location.search);
const ROUTE_AGENT_KEY = getRouteAgentKey();
const DISPLAY_MODE = normalizeDisplayMode(
  searchParams.get("mode") || (ROUTE_AGENT_KEY ? "page" : "widget")
);
const EMBEDDED_MODE = searchParams.get("embedded") === "1";
const EMBEDDED_SURFACE = normalizeEmbeddedSurface(searchParams.get("surface"));
const EMBEDDED_SIZE = normalizeEmbeddedSize(searchParams.get("size"));
const EMBEDDED_LAYOUT = normalizeEmbeddedLayout(searchParams.get("layout"));
const EMBEDDED_VARIANT = normalizeEmbeddedVariant(searchParams.get("variant"));
const EMBEDDED_BACKGROUND_SCOPE = normalizeEmbeddedBackgroundScope(searchParams.get("background_scope"));
const SHOW_EMBED_TITLE = normalizeShowEmbedTitle(searchParams.get("show_title"));
const HOSTED_PAGE_LAYOUT = normalizeHostedPageLayout(searchParams.get("layout"));
const STORED_AGENT_KEY = window.localStorage.getItem("vonza_agent_key") || "";
const INSTALL_ID =
  searchParams.get("install_id") ||
  window.VonzaWidgetConfig?.installId ||
  "";
const AGENT_ID =
  searchParams.get("agent_id") ||
  window.VonzaWidgetConfig?.agentId ||
  "";
const AGENT_KEY =
  searchParams.get("agent_key") ||
  ROUTE_AGENT_KEY ||
  STORED_AGENT_KEY ||
  window.VonzaWidgetConfig?.agentKey ||
  "";
const PUBLIC_PAGE_KEY =
  searchParams.get("k") ||
  searchParams.get("public_page_key") ||
  window.VonzaWidgetConfig?.publicPageKey ||
  "";
const BUSINESS_ID =
  searchParams.get("business_id") ||
  window.VonzaWidgetConfig?.businessId ||
  "";
const WEBSITE_URL =
  searchParams.get("website_url") ||
  window.VonzaWidgetConfig?.websiteUrl ||
  "";
const PAGE_ORIGIN =
  searchParams.get("origin") ||
  window.VonzaWidgetConfig?.origin ||
  "";
const PAGE_URL =
  searchParams.get("page_url") ||
  window.VonzaWidgetConfig?.pageUrl ||
  "";
const EMBED_SESSION_ID =
  searchParams.get("session_id") ||
  window.VonzaWidgetConfig?.sessionId ||
  "";
const EMBED_FINGERPRINT =
  searchParams.get("fingerprint") ||
  window.VonzaWidgetConfig?.fingerprint ||
  "";
let visitorStorageConsentGranted = false;
let transientVisitorSessionKey = "";

const LEGACY_WIDGET_DEFAULTS = {
  assistantName: "Vonza AI",
  welcomeMessage: "How may I be of your service today?",
  launcherText: "YOUR PERSONAL ASSISTANT",
  primaryColor: "#10a37f",
  secondaryColor: "#0c7f75",
};

const DEFAULT_WIDGET_CONFIG = {
  assistantName: "Front Desk",
  welcomeMessage: "Hi! How can we help today?",
  buttonLabel: "Open Front Desk",
  launcherText: "Business front desk",
  widgetLogoUrl: "",
  primaryColor: "#5b61ff",
  secondaryColor: "#7c4dff",
  themeMode: "dark",
};
const CANVAS_TRANSITION_MS = 340;
const CANVAS_MOBILE_TRANSITION_MS = 260;
const DEFAULT_VOICE_CONFIG = Object.freeze({
  voiceInputEnabled: false,
  spokenRepliesEnabled: false,
  webCallEnabled: false,
  autoSendTranscript: false,
  autoPlaySpokenReplies: false,
  voice: "alloy",
  languageBehavior: "auto",
});
const VOICE_TTS_VOICES = Object.freeze(["alloy", "ash", "coral", "nova", "sage", "shimmer"]);
const VOICE_RECORDING_MAX_MS = 30000;
const VOICE_RECORDING_MIME_TYPES = Object.freeze([
  "audio/webm;codecs=opus",
  "audio/webm",
  "video/webm",
  "audio/mp4",
]);
const CALL_MODE_STATES = Object.freeze({
  READY: "ready",
  REQUESTING: "requesting",
  LISTENING: "listening",
  TRANSCRIBING: "transcribing",
  THINKING: "thinking",
  SPEAKING: "speaking",
  MUTED_STOPPED: "muted-stopped",
  STOPPED: "stopped",
  UNAVAILABLE: "unavailable",
});
const DEFAULT_FULL_PAGE_SUBTITLE = "Ask about services, pricing, quotes, or contact details.";
const FULL_PAGE_DESIGN_PRESETS = Object.freeze([
  "clean-light",
  "dark-professional",
  "warm-minimal",
  "bold-gradient",
  "image-hero",
  "video-hero",
]);
const FULL_PAGE_BACKGROUND_TYPES = Object.freeze(["color", "gradient", "image", "video"]);
const FULL_PAGE_BACKGROUND_SOURCES = Object.freeze(["preset", "upload", "url"]);
const FULL_PAGE_BACKGROUND_PRESETS = Object.freeze({
  "clean-light-abstract": {
    key: "clean-light-abstract",
    label: "Clean Light Abstract",
    description: "Soft light background with gold linework.",
    backgroundType: "image",
    imageUrl: "/assets/front-desk/backgrounds/abstract-light-gold.png",
    videoUrl: "",
    backgroundColor: "#f8f4ea",
    backgroundOverlayColor: "#ffffff",
    backgroundOverlayOpacity: 0.18,
    textTheme: "dark",
    disableVideoOnMobile: true,
  },
  "dark-gold-abstract": {
    key: "dark-gold-abstract",
    label: "Dark Gold Abstract",
    description: "Dark background with gold linework.",
    backgroundType: "image",
    imageUrl: "/assets/front-desk/backgrounds/abstract-dark-gold.png",
    videoUrl: "",
    backgroundColor: "#09090b",
    backgroundOverlayColor: "#020617",
    backgroundOverlayOpacity: 0.28,
    textTheme: "light",
    disableVideoOnMobile: true,
  },
  "bright-abstract-motion": {
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
  },
  "dark-abstract-motion": {
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
  },
});
const FULL_PAGE_FOCAL_POINTS = Object.freeze(["center", "top", "left", "right"]);
const FULL_PAGE_TEXT_THEMES = Object.freeze(["dark", "light"]);
const FULL_PAGE_COMPOSER_STYLES = Object.freeze(["soft", "elevated", "minimal"]);
const FULL_PAGE_CHIP_STYLES = Object.freeze(["outline", "soft", "subtle-fill"]);
const FULL_PAGE_STATUS_STYLES = Object.freeze(["subtle", "pill", "minimal"]);
const FULL_PAGE_BACKGROUND_SCOPES = Object.freeze(["section", "iframe", "viewport", "page"]);
const DEFAULT_FULL_PAGE_DESIGN = Object.freeze({
  preset: "clean-light",
  backgroundType: "color",
  backgroundSource: "url",
  backgroundPreset: "",
  backgroundColor: "#ffffff",
  backgroundGradientTo: "#eef4ff",
  backgroundImageUrl: "",
  backgroundVideoUrl: "",
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

const WIDGET_PHASES = Object.freeze({
  ENTRY: "entry",
  CHAT: "chat",
});
const PAGE_QUICK_REPLY_TOPICS = Object.freeze([
  "I'd like to request a quote.",
  "How much does it cost?",
  "What services do you offer?",
  "How can I contact you?",
]);
const EMBEDDED_QUICK_REPLY_LABELS = Object.freeze({
  services: "Services",
  pricing: "Pricing",
  quote: "Request a quote",
  contact: "Contact details",
  booking: "Booking",
});
const EMBEDDED_DEFAULT_QUICK_REPLIES = Object.freeze([
  { label: "Services", prompt: "What services do you offer?", type: "services" },
  { label: "Pricing", prompt: "How much does it cost?", type: "pricing" },
  { label: "Request a quote", prompt: "I'd like to request a quote.", type: "quote" },
  { label: "Contact details", prompt: "How can I contact you?", type: "contact" },
]);
const PAGE_ACTION_CARDS = Object.freeze([
  {
    label: "Ask about services",
    prompt: "What services do you offer?",
    copy: "Get a quick overview of what this business can help with.",
    description: "Get a quick overview of what this business can help with.",
    type: "services",
    enabled: true,
  },
  {
    label: "Ask about pricing",
    prompt: "How much does it cost?",
    copy: "Ask what affects price, scope, and the next step.",
    description: "Ask what affects price, scope, and the next step.",
    type: "pricing",
    enabled: true,
  },
  {
    label: "Request a quote",
    prompt: "I'd like to request a quote.",
    copy: "Share what you need so the business can follow up with the right details.",
    description: "Share what you need so the business can follow up with the right details.",
    type: "quote",
    enabled: true,
  },
  {
    label: "Contact details",
    prompt: "How can I contact you?",
    copy: "Find the best way to reach the team or leave your details.",
    description: "Find the best way to reach the team or leave your details.",
    type: "contact",
    enabled: true,
  },
  {
    label: "Book a time",
    prompt: "I'd like to book a time.",
    copy: "Ask about appointments, calls, visits, or the best next step.",
    description: "Ask about appointments, calls, visits, or the best next step.",
    type: "booking",
    enabled: true,
    requiresBooking: true,
  },
]);
const ASSISTANT_I18N = Object.freeze({
  en: Object.freeze({
    "assistant.loading.eyebrow": "Opening assistant",
    "assistant.loading.title": "Getting everything ready.",
    "assistant.loading.copy": "One moment while the assistant loads.",
    "assistant.unavailable.title": "Assistant unavailable",
    "assistant.unavailable.copy": "This assistant is not available right now. Please contact the business directly.",
    "assistant.defaultName": "Assistant",
    "assistant.defaultFullPageHeadline": "Front Desk",
    "assistant.defaultFullPageSubtitle": "Ask about services, pricing, quotes, or contact details.",
    "assistant.defaultLauncher": "Business front desk",
    "assistant.defaultWelcome": "Hi! How can we help today?",
    "assistant.onlineNow": "Online now",
    "assistant.logoLabel": "{name} logo",
    "assistant.status.typical": "Typically replies instantly",
    "assistant.status.online": "AI assistant online",
    "assistant.status.instant": "Replies instantly",
    "assistant.status.assistant": "AI assistant",
    "assistant.status.leaveDetails": "Leave your details if needed",
    "assistant.sendTo": "Send a message to {name}",
    "assistant.label": "Assistant",
    "assistant.you": "You",
    "assistant.businessAssistant": "Business assistant",
    "assistant.chooseContinue": "Choose how to continue",
    "assistant.startConversation": "Start a conversation",
    "assistant.continueChoice": "Continue with email if you may want follow-up, or ask as a guest.",
    "assistant.emailTitle": "Continue with email",
    "assistant.emailCopy": "Consent to save this session and send the conversation to your inbox.",
    "assistant.guestTitle": "Continue as guest",
    "assistant.guestCopy": "Consent to save this session without sharing your email.",
    "assistant.nameLabel": "Name",
    "assistant.emailLabel": "Email",
    "assistant.namePlaceholder": "Your name (optional)",
    "assistant.emailPlaceholder": "name@example.com",
    "assistant.continueToChat": "Continue to chat",
    "assistant.back": "Back",
    "assistant.cancel": "Cancel",
    "assistant.privacyTrust": "We respect your privacy.",
    "assistant.identityLegal": "Continuing lets Vonza store this chat session for replies, safety, and follow-up. You can review how Vonza handles your data, the terms, and cookies.",
    "assistant.composerPlaceholder": "Type your question...",
    "assistant.canvasPlaceholder": "Ask anything...",
    "assistant.send": "Send message",
    "assistant.composerHint": "Press Enter to send. The assistant replies using the business's latest details.",
    "assistant.composerStatus": "Ask about services, pricing, booking, quotes, contact details, or the next step.",
    "assistant.pageIdentityNote": "You're asking as a guest. If follow-up is needed, the assistant may ask for your contact details.",
    "assistant.identityGuestStatus": "You're chatting as a guest. Ask anything about the business.",
    "assistant.identityGuestCompactStatus": "Asking as guest",
    "assistant.identityEmailStatus": "Using {email} so the business can follow up if needed.",
    "assistant.identityEmailCompactStatus": "Using {email}",
    "assistant.leaveContact": "Leave contact details",
    "assistant.updateContact": "Update contact details",
    "assistant.poweredBy": "Powered by Vonza",
    "assistant.poweredHelp": "We're here to help | Powered by Vonza",
    "assistant.pageIdentityLegal": "Sending a message lets Vonza store this chat session for replies, safety, and follow-up. Review data handling, terms, and cookies.",
    "assistant.voiceTap": "Tap to speak",
    "assistant.voiceSpeakReplies": "Speak replies",
    "assistant.voiceSpeakRepliesOn": "Speak replies on",
    "assistant.voiceSpeakRepliesOff": "Speak replies off",
    "assistant.voiceDisclosure": "Voice is processed to transcribe your question.",
    "assistant.voicePrivacy": "Privacy",
    "assistant.voiceAi": "AI-generated voice.",
    "assistant.voiceUnavailable": "Voice is unavailable right now. You can still type your message.",
    "assistant.voiceHttps": "Voice input requires HTTPS.",
    "assistant.voicePermission": "Microphone permission was denied. You can still type your message.",
    "assistant.voiceDevice": "Microphone is unavailable on this device. You can still type your message.",
    "assistant.voiceBusy": "Voice is busy right now. Try again in a moment.",
    "assistant.voiceTranscribeFailed": "Could not transcribe that recording. Please try again.",
    "assistant.voiceChooseIdentity": "Choose guest or email before using voice input.",
    "assistant.voiceListening": "Listening...",
    "assistant.voiceNoSpeechRecorded": "No speech was recorded.",
    "assistant.voiceProcessing": "Processing voice...",
    "assistant.voiceNoSpeechDetected": "No speech was detected in that recording.",
    "assistant.voiceTranscriptReady": "Transcript ready",
    "assistant.voiceFailed": "Voice input failed.",
    "assistant.voiceRecordingTooLarge": "That recording was too large. Try a shorter message.",
    "assistant.voiceUnavailableType": "Voice is unavailable right now. You can still type your message.",
    "assistant.voiceBusyTryAgain": "Voice is busy right now. Try again in a moment.",
    "assistant.voicePlayReply": "Play spoken reply",
    "assistant.voiceStopReply": "Stop spoken reply",
    "assistant.voiceSpeaking": "Speaking...",
    "assistant.voiceSpokenStopped": "Spoken reply stopped.",
    "assistant.voiceSpokenCouldNotPlay": "Spoken reply could not play. You can still read the answer.",
    "assistant.voiceAudioUnsupported": "Audio playback is not supported in this browser.",
    "assistant.voicePressPlay": "Press Play to hear the spoken reply.",
    "assistant.callKicker": "Browser call",
    "assistant.callTitle": "Call Front Desk",
    "assistant.callReady": "Ready",
    "assistant.callRequesting": "Requesting microphone",
    "assistant.callListening": "Listening",
    "assistant.callTranscribing": "Transcribing",
    "assistant.callThinking": "Thinking",
    "assistant.callSpeaking": "Speaking",
    "assistant.callMutedStopped": "Listening stopped",
    "assistant.callStopped": "Call ended",
    "assistant.callUnavailable": "Call mode is unavailable right now. You can still type your message.",
    "assistant.callStart": "Start call",
    "assistant.callEnd": "End call",
    "assistant.callStopListening": "Stop listening",
    "assistant.resetIdentity": "Reset visitor identity",
    "assistant.resetStatus": "Choose email or guest to start a fresh visitor identity.",
    "assistant.chooseBeforeSend": "Choose guest or email before sending your first message.",
    "assistant.chooseThenSend": "Choose email or guest, then send that question.",
    "assistant.notConfigured": "No assistant configured yet. Please create one first.",
    "assistant.setupFirst": "Set up your Front Desk in Vonza before testing this assistant page.",
    "assistant.preparingReply": "{name} is preparing a reply...",
    "assistant.answering": "Front Desk is answering...",
    "assistant.requestFailed": "I’m sorry, I can’t answer right now. Please try again in a moment or contact the business directly.",
    "assistant.requestFailedStatus": "The Front Desk could not answer just now. You can try again or use the contact option.",
    "assistant.connectionError": "Error connecting to server",
    "assistant.connectionStatus": "Connection was interrupted. Try again when the assistant is ready.",
    "assistant.routeOpening": "Opening {label}...",
    "assistant.routeCaptureStatus": "You can share contact details in chat whenever you want.",
    "assistant.routeDismissedStatus": "No problem. We can keep going here.",
    "assistant.routeBookingTitle": "Ready to book?",
    "assistant.routeQuoteTitle": "Want to request a quote?",
    "assistant.routeCheckoutTitle": "Ready to continue?",
    "assistant.routeContactTitle": "Want to contact the team?",
    "assistant.routeGenericTitle": "Want the next step?",
    "assistant.routeGenericWithLabel": "Want to {label}?",
    "assistant.routeCopy": "I can keep helping here, or you can use this direct option.",
    "assistant.routeContinue": "Continue here",
    "assistant.routeContinueFallback": "Continue",
    "assistant.routeOpenFallback": "Open",
    "assistant.leadSaved": "Thanks. I saved those details so the team can follow up.",
    "assistant.leadPrompt": "What is the best email or phone number to use?",
    "assistant.optionReady": "That option is ready if you want the fastest next step.",
    "assistant.askAnythingElse": "Ask anything else about services, pricing, booking, or contact details.",
    "assistant.feedbackHelpful": "Thanks for the feedback.",
    "assistant.feedbackReview": "Thanks. The business can review this.",
    "assistant.feedbackFailed": "Feedback could not be saved just now.",
    "assistant.canvasAsk": "Ask another question",
    "assistant.canvasContact": "Leave contact details",
    "assistant.canvasQuote": "Request a quote",
    "quick.services": "Services",
    "quick.pricing": "Pricing",
    "quick.quote": "Request a quote",
    "quick.contact": "Contact details",
    "quick.booking": "Booking",
    "prompt.services": "What services do you offer?",
    "prompt.pricing": "How much does it cost?",
    "prompt.quote": "I'd like to request a quote.",
    "prompt.contact": "How can I contact you?",
    "prompt.booking": "I'd like to book a time.",
    "card.services.label": "Ask about services",
    "card.services.copy": "Get a quick overview of what this business can help with.",
    "card.pricing.label": "Ask about pricing",
    "card.pricing.copy": "Ask what affects price, scope, and the next step.",
    "card.quote.label": "Request a quote",
    "card.quote.copy": "Share what you need so the business can follow up with the right details.",
    "card.contact.label": "Contact details",
    "card.contact.copy": "Find the best way to reach the team or leave your details.",
    "card.booking.label": "Book a time",
    "card.booking.copy": "Ask about appointments, calls, visits, or the best next step.",
    "assistant.pageWelcomeBusiness": "Hi, I can help with {businessName}'s services, pricing, quotes, and contact details. What would you like to know?",
    "assistant.pageWelcome": "Hi, I can help with services, pricing, quotes, and contact details. What would you like to know?",
    "assistant.canvasWelcomeBusiness": "Welcome to {businessName}. Choose a topic below or ask anything to get started.",
    "assistant.canvasWelcome": "Choose a topic below or ask anything to get started.",
    "assistant.quickTopicsLabel": "Common questions",
    "assistant.actionTopicsLabel": "Common assistant topics",
    "assistant.nextActionsLabel": "Next actions",
  }),
  hu: Object.freeze({
    "assistant.loading.eyebrow": "Asszisztens megnyitása",
    "assistant.loading.title": "Mindent előkészítünk.",
    "assistant.loading.copy": "Egy pillanat, amíg az asszisztens betölt.",
    "assistant.unavailable.title": "Az asszisztens nem elérhető",
    "assistant.unavailable.copy": "Ez az asszisztens most nem elérhető. Kérlek, vedd fel közvetlenül a kapcsolatot a vállalkozással.",
    "assistant.defaultName": "Asszisztens",
    "assistant.defaultFullPageHeadline": "Front Desk",
    "assistant.defaultFullPageSubtitle": "Kérdezz szolgáltatásokról, árakról, ajánlatról vagy elérhetőségről.",
    "assistant.defaultLauncher": "Üzleti front desk",
    "assistant.defaultWelcome": "Szia! Miben segíthetünk ma?",
    "assistant.onlineNow": "Elérhető",
    "assistant.logoLabel": "{name} logó",
    "assistant.status.typical": "Általában azonnal válaszol",
    "assistant.status.online": "AI asszisztens online",
    "assistant.status.instant": "Azonnal válaszol",
    "assistant.status.assistant": "AI asszisztens",
    "assistant.status.leaveDetails": "Szükség esetén megadhatod az adataidat",
    "assistant.sendTo": "Üzenet küldése: {name}",
    "assistant.label": "Asszisztens",
    "assistant.you": "Te",
    "assistant.businessAssistant": "Üzleti asszisztens",
    "assistant.chooseContinue": "Válaszd ki, hogyan folytatod",
    "assistant.startConversation": "Beszélgetés indítása",
    "assistant.continueChoice": "Folytasd emaillel, ha utánkövetést szeretnél, vagy kérdezz vendégként.",
    "assistant.emailTitle": "Folytatás emaillel",
    "assistant.emailCopy": "Hozzájárulsz a beszélgetés mentéséhez és az összefoglaló elküldéséhez az email címedre.",
    "assistant.guestTitle": "Folytatás vendégként",
    "assistant.guestCopy": "Hozzájárulsz a beszélgetés mentéséhez email megadása nélkül.",
    "assistant.nameLabel": "Név",
    "assistant.emailLabel": "Email",
    "assistant.namePlaceholder": "Neved (opcionális)",
    "assistant.emailPlaceholder": "nev@example.com",
    "assistant.continueToChat": "Tovább a chathez",
    "assistant.back": "Vissza",
    "assistant.cancel": "Mégse",
    "assistant.privacyTrust": "Tiszteletben tartjuk az adatvédelmedet.",
    "assistant.identityLegal": "A folytatással engedélyezed, hogy a Vonza mentse ezt a chatet válaszadás, biztonság és utánkövetés céljából. Átnézheted az adatkezelést, a feltételeket és a cookie tájékoztatót.",
    "assistant.composerPlaceholder": "Írd be a kérdésed...",
    "assistant.canvasPlaceholder": "Kérdezz bármit...",
    "assistant.send": "Üzenet küldése",
    "assistant.composerHint": "Enterrel küldhetsz. Az asszisztens a vállalkozás legfrissebb adatai alapján válaszol.",
    "assistant.composerStatus": "Kérdezz szolgáltatásokról, árakról, foglalásról, ajánlatról, elérhetőségről vagy a következő lépésről.",
    "assistant.pageIdentityNote": "Vendégként kérdezel. Ha utánkövetés kell, az asszisztens elkérheti az elérhetőségedet.",
    "assistant.identityGuestStatus": "Vendégként chatelsz. Kérdezz bármit a vállalkozásról.",
    "assistant.identityGuestCompactStatus": "Vendégként kérdezel",
    "assistant.identityEmailStatus": "{email} címmel folytatod, hogy a vállalkozás utánkövethessen, ha szükséges.",
    "assistant.identityEmailCompactStatus": "{email} címmel folytatod",
    "assistant.leaveContact": "Elérhetőség megadása",
    "assistant.updateContact": "Elérhetőség frissítése",
    "assistant.poweredBy": "Powered by Vonza",
    "assistant.poweredHelp": "Segítünk | Powered by Vonza",
    "assistant.pageIdentityLegal": "Üzenet küldésével engedélyezed, hogy a Vonza mentse ezt a chatet válaszadás, biztonság és utánkövetés céljából. Nézd át az adatkezelést, a feltételeket és a cookie tájékoztatót.",
    "assistant.voiceTap": "Beszéd indítása",
    "assistant.voiceSpeakReplies": "Válaszok felolvasása",
    "assistant.voiceSpeakRepliesOn": "Válaszok felolvasása bekapcsolva",
    "assistant.voiceSpeakRepliesOff": "Válaszok felolvasása kikapcsolva",
    "assistant.voiceDisclosure": "A hangot a kérdésed leírásához dolgozzuk fel.",
    "assistant.voicePrivacy": "Adatvédelem",
    "assistant.voiceAi": "AI által generált hang.",
    "assistant.voiceUnavailable": "A hang most nem elérhető. Továbbra is beírhatod az üzenetedet.",
    "assistant.voiceHttps": "A hangbevitelhez HTTPS szükséges.",
    "assistant.voicePermission": "A mikrofonengedély el lett utasítva. Továbbra is beírhatod az üzenetedet.",
    "assistant.voiceDevice": "A mikrofon nem elérhető ezen az eszközön. Továbbra is beírhatod az üzenetedet.",
    "assistant.voiceBusy": "A hang most foglalt. Próbáld újra egy pillanat múlva.",
    "assistant.voiceTranscribeFailed": "Nem sikerült leírni a felvételt. Próbáld újra.",
    "assistant.voiceChooseIdentity": "Hangbevitel előtt válassz vendég módot vagy emailes folytatást.",
    "assistant.voiceListening": "Figyelek...",
    "assistant.voiceNoSpeechRecorded": "Nem rögzítettünk beszédet.",
    "assistant.voiceProcessing": "Hang feldolgozása...",
    "assistant.voiceNoSpeechDetected": "Nem érzékeltünk beszédet a felvételben.",
    "assistant.voiceTranscriptReady": "A leirat elkészült",
    "assistant.voiceFailed": "A hangbevitel nem sikerült.",
    "assistant.voiceRecordingTooLarge": "Ez a felvétel túl nagy volt. Próbálj rövidebb üzenetet.",
    "assistant.voiceUnavailableType": "A hang most nem elérhető. Továbbra is beírhatod az üzenetedet.",
    "assistant.voiceBusyTryAgain": "A hang most foglalt. Próbáld újra egy pillanat múlva.",
    "assistant.voicePlayReply": "Felolvasás indítása",
    "assistant.voiceStopReply": "Felolvasás leállítása",
    "assistant.voiceSpeaking": "Felolvasás...",
    "assistant.voiceSpokenStopped": "A felolvasás leállt.",
    "assistant.voiceSpokenCouldNotPlay": "A felolvasás nem indult el. A választ továbbra is elolvashatod.",
    "assistant.voiceAudioUnsupported": "A hanglejátszás ebben a böngészőben nem támogatott.",
    "assistant.voicePressPlay": "Nyomd meg a Lejátszás gombot a felolvasáshoz.",
    "assistant.callKicker": "Böngészős hívás",
    "assistant.callTitle": "Front Desk hívása",
    "assistant.callReady": "Készen áll",
    "assistant.callRequesting": "Mikrofonengedély kérése",
    "assistant.callListening": "Figyelek",
    "assistant.callTranscribing": "Leirat készítése",
    "assistant.callThinking": "Gondolkodik",
    "assistant.callSpeaking": "Felolvasás",
    "assistant.callMutedStopped": "A figyelés leállt",
    "assistant.callStopped": "A hívás véget ért",
    "assistant.callUnavailable": "A hívás mód most nem elérhető. Továbbra is beírhatod az üzenetedet.",
    "assistant.callStart": "Hívás indítása",
    "assistant.callEnd": "Hívás befejezése",
    "assistant.callStopListening": "Figyelés leállítása",
    "assistant.resetIdentity": "Látogatói azonosítás törlése",
    "assistant.resetStatus": "Válassz emailes vagy vendég folytatást az új látogatói azonosításhoz.",
    "assistant.chooseBeforeSend": "Az első üzenet elküldése előtt válassz vendég módot vagy emailes folytatást.",
    "assistant.chooseThenSend": "Válassz emailes vagy vendég folytatást, majd küldd el a kérdést.",
    "assistant.notConfigured": "Még nincs beállítva asszisztens. Először hozz létre egyet.",
    "assistant.setupFirst": "Állítsd be a Front Desket a Vonzában, mielőtt teszteled ezt az asszisztensoldalt.",
    "assistant.preparingReply": "{name} előkészíti a választ...",
    "assistant.answering": "A Front Desk válaszol...",
    "assistant.requestFailed": "Sajnálom, most nem tudok válaszolni. Próbáld újra később, vagy vedd fel közvetlenül a kapcsolatot a vállalkozással.",
    "assistant.requestFailedStatus": "A Front Desk most nem tudott válaszolni. Próbáld újra, vagy használd a kapcsolatfelvételi lehetőséget.",
    "assistant.connectionError": "Nem sikerült kapcsolódni a szerverhez",
    "assistant.connectionStatus": "A kapcsolat megszakadt. Próbáld újra, amikor az asszisztens készen áll.",
    "assistant.routeOpening": "Megnyitás: {label}...",
    "assistant.routeCaptureStatus": "Bármikor megadhatod az elérhetőségedet a chatben.",
    "assistant.routeDismissedStatus": "Rendben. Folytathatjuk itt.",
    "assistant.routeBookingTitle": "Készen állsz időpontot foglalni?",
    "assistant.routeQuoteTitle": "Szeretnél ajánlatot kérni?",
    "assistant.routeCheckoutTitle": "Folytatod a következő lépéssel?",
    "assistant.routeContactTitle": "Szeretnéd felvenni a kapcsolatot a csapattal?",
    "assistant.routeGenericTitle": "Jöhet a következő lépés?",
    "assistant.routeGenericWithLabel": "Szeretnéd ezt megnyitni: {label}?",
    "assistant.routeCopy": "Itt is tudok segíteni, vagy használhatod ezt a közvetlen lehetőséget.",
    "assistant.routeContinue": "Folytatás itt",
    "assistant.routeContinueFallback": "Folytatás",
    "assistant.routeOpenFallback": "Megnyitás",
    "assistant.leadSaved": "Köszönjük. Mentettem az adatokat, hogy a csapat utánkövethesse.",
    "assistant.leadPrompt": "Melyik email címen vagy telefonszámon érhetünk el a legjobban?",
    "assistant.optionReady": "Ez a lehetőség készen áll, ha a leggyorsabb következő lépést szeretnéd.",
    "assistant.askAnythingElse": "Kérdezz bármi mást szolgáltatásokról, árakról, foglalásról vagy elérhetőségről.",
    "assistant.feedbackHelpful": "Köszönjük a visszajelzést.",
    "assistant.feedbackReview": "Köszönjük. A vállalkozás át tudja nézni.",
    "assistant.feedbackFailed": "A visszajelzést most nem sikerült menteni.",
    "assistant.canvasAsk": "Új kérdés",
    "assistant.canvasContact": "Elérhetőség megadása",
    "assistant.canvasQuote": "Ajánlatkérés",
    "quick.services": "Szolgáltatások",
    "quick.pricing": "Árak",
    "quick.quote": "Ajánlatkérés",
    "quick.contact": "Elérhetőségek",
    "quick.booking": "Foglalás",
    "prompt.services": "Milyen szolgáltatásokat kínáltok?",
    "prompt.pricing": "Mennyibe kerül?",
    "prompt.quote": "Szeretnék ajánlatot kérni.",
    "prompt.contact": "Hogyan tudlak elérni benneteket?",
    "prompt.booking": "Szeretnék időpontot foglalni.",
    "card.services.label": "Szolgáltatások",
    "card.services.copy": "Gyors áttekintés arról, miben tud segíteni a vállalkozás.",
    "card.pricing.label": "Árak",
    "card.pricing.copy": "Kérdezz arról, mi befolyásolja az árat, a terjedelmet és a következő lépést.",
    "card.quote.label": "Ajánlatkérés",
    "card.quote.copy": "Írd le, mire van szükséged, hogy a vállalkozás megfelelő részletekkel követhessen.",
    "card.contact.label": "Elérhetőségek",
    "card.contact.copy": "Találd meg a legjobb kapcsolatfelvételi módot, vagy hagyd meg az adataidat.",
    "card.booking.label": "Időpontfoglalás",
    "card.booking.copy": "Kérdezz időpontról, hívásról, helyszíni látogatásról vagy a legjobb következő lépésről.",
    "assistant.pageWelcomeBusiness": "Szia, segítek {businessName} szolgáltatásaival, áraival, ajánlatkéréssel és elérhetőségeivel kapcsolatban. Mit szeretnél tudni?",
    "assistant.pageWelcome": "Szia, segítek szolgáltatásokkal, árakkal, ajánlatkéréssel és elérhetőségekkel kapcsolatban. Mit szeretnél tudni?",
    "assistant.canvasWelcomeBusiness": "Üdvözlünk itt: {businessName}. Válassz témát lent, vagy kérdezz bármit a kezdéshez.",
    "assistant.canvasWelcome": "Válassz témát lent, vagy kérdezz bármit a kezdéshez.",
    "assistant.quickTopicsLabel": "Gyakori kérdések",
    "assistant.actionTopicsLabel": "Gyakori asszisztens témák",
    "assistant.nextActionsLabel": "Következő lépések",
  }),
});

const conversationHistory = [];
let widgetConfig = { ...DEFAULT_WIDGET_CONFIG };
let resolvedAgentId = AGENT_ID;
let resolvedAgentKey = AGENT_KEY;
let resolvedBusinessId = BUSINESS_ID;
let liveLeadCapture = null;
let liveDirectRouting = null;
let pageBusinessContext = null;
let visitorIdentity = {
  mode: "",
  email: "",
  name: "",
};
let voiceRecorder = null;
let voiceRecorderChunks = [];
let voiceRecordingStartedAt = 0;
let voiceRecordingStopTimer = 0;
let voiceRecordingSource = "";
let voiceRecordingCancelRequested = false;
let voiceTranscriptRequestActive = false;
let voiceInputStatusState = "";
let callModeActive = false;
let callModeState = CALL_MODE_STATES.READY;
let speakRepliesActive = false;
let speakRepliesUserChanged = false;
let currentVoiceAudio = null;
let currentVoiceButton = null;
let currentVoiceUrl = "";
const voiceReplyAudioCache = new Map();
const voiceSpeechAuthorizations = new Map();
let lastLeadReferenceMessage = "";
let quickRepliesDismissed = false;
let pendingCanvasTopicLabel = "";
let canvasTransitionTimer = null;
let canvasQuickRepliesDismissTimer = null;
let canvasQuickRepliesDismissing = false;
const sentTelemetryKeys = new Set();
const leadCapturePromptShownKeys = new Set();
const submittedReplyFeedbackKeys = new Set();
const OUTCOME_DETECTION_STORAGE_PREFIX = "vonza_detected_outcome_";
const VISITOR_IDENTITY_STORAGE_PREFIX = "vonza_visitor_identity_";
const VISITOR_IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let widgetPhase = WIDGET_PHASES.ENTRY;
let embeddedHeightFrame = 0;

function normalizeDisplayMode(value) {
  return trimText(value).toLowerCase() === "page" ? "page" : "widget";
}

function normalizeEmbeddedSurface(value) {
  const normalized = trimText(value).toLowerCase();
  return ["card", "flat", "transparent"].includes(normalized) ? normalized : "card";
}

function normalizeEmbeddedSize(value) {
  const normalized = trimText(value).toLowerCase();
  return ["compact", "standard", "tall", "full"].includes(normalized) ? normalized : "standard";
}

function normalizeEmbeddedLayout(value) {
  const normalized = trimText(value).toLowerCase();
  return ["canvas", "split"].includes(normalized) ? normalized : "chat";
}

function normalizeHostedPageLayout(value) {
  return trimText(value).toLowerCase() === "classic" ? "classic" : "canvas";
}

function normalizeEmbeddedVariant(value) {
  return trimText(value).toLowerCase() === "smart" ? "smart" : "iframe";
}

function normalizeEmbeddedBackgroundScope(value) {
  const normalized = trimText(value).toLowerCase();
  return ["section", "iframe", "viewport", "page"].includes(normalized) ? normalized : "iframe";
}

function normalizeShowEmbedTitle(value) {
  const normalized = trimText(value).toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
}

function getRouteAgentKey() {
  const match = window.location.pathname.match(/^\/(?:a|assistant)\/([^/?#]+)/);

  if (!match?.[1]) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isPageMode() {
  return DISPLAY_MODE === "page";
}

function isFullEmbeddedPageMode() {
  return isPageMode() && EMBEDDED_MODE && EMBEDDED_SIZE === "full";
}

function isSmartEmbeddedPageMode() {
  return isPageMode() && EMBEDDED_MODE && EMBEDDED_VARIANT === "smart";
}

function isCanvasEmbeddedPageMode() {
  return isFullEmbeddedPageMode() && EMBEDDED_LAYOUT === "canvas";
}

function isHostedCanvasPageMode() {
  return isPageMode() && Boolean(ROUTE_AGENT_KEY) && !EMBEDDED_MODE && HOSTED_PAGE_LAYOUT === "canvas";
}

function isCanvasPageMode() {
  return isCanvasEmbeddedPageMode() || isHostedCanvasPageMode();
}

function isSectionBackgroundScope() {
  return isCanvasEmbeddedPageMode() && EMBEDDED_BACKGROUND_SCOPE === "section";
}

function isMobileViewport() {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 720px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
  }

  return Number(window.innerWidth || 0) > 0 && Number(window.innerWidth || 0) <= 720;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getCanvasTransitionDuration() {
  if (prefersReducedMotion()) {
    return 0;
  }

  return isMobileViewport() ? CANVAS_MOBILE_TRANSITION_MS : CANVAS_TRANSITION_MS;
}

function shouldShowPageTitle() {
  return !isCanvasPageMode() || SHOW_EMBED_TITLE;
}

function getWidgetStorageScope() {
  return (
    trimText(INSTALL_ID)
    || trimText(resolvedAgentId)
    || trimText(resolvedAgentKey)
    || trimText(resolvedBusinessId)
    || trimText(WEBSITE_URL)
    || "default"
  );
}

function getVisitorSessionStorageKey() {
  return `vonza_visitor_session_${getWidgetStorageScope()}`;
}

function getVisitorIdentityStorageKey() {
  return `${VISITOR_IDENTITY_STORAGE_PREFIX}${getWidgetStorageScope()}`;
}

function getVisitorSessionKey() {
  const storageKey = getVisitorSessionStorageKey();

  if (!visitorStorageConsentGranted) {
    if (!transientVisitorSessionKey) {
      transientVisitorSessionKey = EMBED_SESSION_ID || window.crypto?.randomUUID?.() || `visitor_${Date.now()}`;
    }

    return transientVisitorSessionKey;
  }

  let sessionKey = window.localStorage.getItem(storageKey);

  if (!sessionKey) {
    sessionKey = EMBED_SESSION_ID || window.crypto?.randomUUID?.() || `visitor_${Date.now()}`;
    window.localStorage.setItem(storageKey, sessionKey);
  }

  return sessionKey;
}

function grantVisitorStorageConsent() {
  if (!transientVisitorSessionKey) {
    transientVisitorSessionKey = EMBED_SESSION_ID || window.crypto?.randomUUID?.() || `visitor_${Date.now()}`;
  }

  visitorStorageConsentGranted = true;
  if (transientVisitorSessionKey) {
    try {
      window.localStorage.setItem(getVisitorSessionStorageKey(), transientVisitorSessionKey);
    } catch {
      // Storage consent is explicit, but storage availability is still browser-dependent.
    }
  }
}

function trimText(value) {
  return String(value || "").trim();
}

function normalizeAssistantLanguage(value) {
  const normalized = trimText(value).toLowerCase();

  if (["hu", "hu-hu", "hungarian", "magyar"].includes(normalized)) {
    return "hu";
  }

  if (["en", "en-us", "en-gb", "english"].includes(normalized)) {
    return "en";
  }

  return "";
}

function getCachedDashboardLanguage() {
  try {
    return normalizeAssistantLanguage(window.localStorage?.getItem("vonza_dashboard_language"));
  } catch {
    return "";
  }
}

function getAssistantLanguage(config = widgetConfig) {
  const candidates = [
    searchParams.get("language"),
    searchParams.get("lang"),
    searchParams.get("locale"),
    searchParams.get("dashboard_language"),
    config.publicLanguage,
    config.public_language,
    config.visitorLanguage,
    config.visitor_language,
    config.dashboardLanguage,
    config.dashboard_language,
    config.language,
    window.VonzaWidgetConfig?.publicLanguage,
    window.VonzaWidgetConfig?.public_language,
    window.VonzaWidgetConfig?.visitorLanguage,
    window.VonzaWidgetConfig?.visitor_language,
    window.VonzaWidgetConfig?.dashboardLanguage,
    window.VonzaWidgetConfig?.dashboard_language,
    window.VonzaWidgetConfig?.language,
    getCachedDashboardLanguage(),
    document.documentElement?.lang,
    navigator.language,
  ];

  for (const candidate of candidates) {
    const language = normalizeAssistantLanguage(candidate);
    if (language) {
      return language;
    }
  }

  return "en";
}

function assistantT(key, params = {}, config = widgetConfig) {
  const language = getAssistantLanguage(config);
  const template = ASSISTANT_I18N[language]?.[key] || ASSISTANT_I18N.en[key] || key;

  return String(template).replace(/\{(\w+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  ));
}

function setElementText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setElementHtml(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = value;
  }
}

function applyPublicAssistantLanguage(config = widgetConfig) {
  const language = getAssistantLanguage(config);

  if (document.documentElement) {
    document.documentElement.lang = language === "hu" ? "hu" : "en";
  }

  if (document.body?.dataset) {
    document.body.dataset.assistantLanguage = language;
  }

  setElementText("assistant-loading-eyebrow", assistantT("assistant.loading.eyebrow", {}, config));
  setElementText("assistant-loading-title", assistantT("assistant.loading.title", {}, config));
  setElementText("assistant-loading-copy", assistantT("assistant.loading.copy", {}, config));
  setElementText("assistant-unavailable-title", assistantT("assistant.unavailable.title", {}, config));
  setElementText("assistant-unavailable-copy", assistantT("assistant.unavailable.copy", {}, config));
  setElementText("status-pill-text", assistantT("assistant.status.typical", {}, config));
  setElementText("page-online-status", assistantT("assistant.status.online", {}, config));
  setElementText("welcome-brand-subtitle", assistantT("assistant.businessAssistant", {}, config));
  setElementText("welcome-badge", assistantT("assistant.chooseContinue", {}, config));
  setElementText("welcome-title", assistantT("assistant.startConversation", {}, config));
  setElementText("welcome-copy", assistantT("assistant.continueChoice", {}, config));
  setElementText("identity-email-title", assistantT("assistant.emailTitle", {}, config));
  setElementText("identity-email-copy", assistantT("assistant.emailCopy", {}, config));
  setElementText("identity-guest-title", assistantT("assistant.guestTitle", {}, config));
  setElementText("identity-guest-copy", assistantT("assistant.guestCopy", {}, config));
  setElementText("identity-name-label", assistantT("assistant.nameLabel", {}, config));
  setElementText("identity-email-label", assistantT("assistant.emailLabel", {}, config));
  setElementText("identity-email-submit", assistantT("assistant.continueToChat", {}, config));
  setElementText("identity-email-cancel", assistantT("assistant.back", {}, config));
  setElementText("identity-trust", assistantT("assistant.privacyTrust", {}, config));
  setElementText("intro-message-label", assistantT("assistant.label", {}, config));
  setElementText("send-button-sr", assistantT("assistant.send", {}, config));
  setElementText("speak-replies-toggle", assistantT("assistant.voiceSpeakReplies", {}, config));
  const voiceDisclosure = document.getElementById("voice-disclosure");
  const voiceDisclosureTextNode = Array.from(voiceDisclosure?.childNodes || [])
    .find((node) => node?.nodeType === 3);
  if (voiceDisclosureTextNode) {
    voiceDisclosureTextNode.textContent = `${assistantT("assistant.voiceDisclosure", {}, config)} `;
  }
  setElementText("voice-privacy-link", assistantT("assistant.voicePrivacy", {}, config));
  setElementText("voice-ai-note", assistantT("assistant.voiceAi", {}, config));
  setElementText("call-front-desk-kicker", assistantT("assistant.callKicker", {}, config));
  setElementText("call-front-desk-title", assistantT("assistant.callTitle", {}, config));
  setElementText("call-front-desk-start", assistantT("assistant.callStart", {}, config));
  setElementText("call-front-desk-stop", assistantT("assistant.callStopListening", {}, config));
  setElementText("call-front-desk-end", assistantT("assistant.callEnd", {}, config));
  setElementText("page-identity-note", assistantT("assistant.pageIdentityNote", {}, config));
  setElementText("page-identity-email-button", assistantT("assistant.leaveContact", {}, config));
  setElementText("page-identity-powered", assistantT("assistant.poweredBy", {}, config));
  setElementText("page-identity-email-submit", assistantT("assistant.emailTitle", {}, config));
  setElementText("page-identity-email-cancel", assistantT("assistant.cancel", {}, config));
  setElementText("identity-reset-button", assistantT("assistant.resetIdentity", {}, config));
  setElementText("powered-by", assistantT("assistant.poweredHelp", {}, config));
  setElementText("page-powered-by", assistantT("assistant.poweredBy", {}, config));
  setElementText("composer-hint", assistantT("assistant.composerHint", {}, config));
  setElementText("composer-status", assistantT("assistant.composerStatus", {}, config));
  setElementHtml("identity-legal", escapeHtml(assistantT("assistant.identityLegal", {}, config)));
  setElementHtml("page-identity-legal", escapeHtml(assistantT("assistant.pageIdentityLegal", {}, config)));

  const input = document.getElementById("input");
  if (input) {
    input.placeholder = assistantT("assistant.composerPlaceholder", {}, config);
  }

  const identityName = document.getElementById("identity-name");
  if (identityName) {
    identityName.placeholder = assistantT("assistant.namePlaceholder", {}, config);
  }

  const identityEmail = document.getElementById("identity-email");
  if (identityEmail) {
    identityEmail.placeholder = assistantT("assistant.emailPlaceholder", {}, config);
  }

  const pageIdentityName = document.getElementById("page-identity-name");
  if (pageIdentityName) {
    pageIdentityName.placeholder = assistantT("assistant.namePlaceholder", {}, config);
  }

  const pageIdentityEmail = document.getElementById("page-identity-email");
  if (pageIdentityEmail) {
    pageIdentityEmail.placeholder = assistantT("assistant.emailPlaceholder", {}, config);
  }

  const voiceInputButton = document.getElementById("voice-input-button");
  if (voiceInputButton) {
    voiceInputButton.setAttribute("aria-label", assistantT("assistant.voiceTap", {}, config));
    voiceInputButton.setAttribute("title", assistantT("assistant.voiceTap", {}, config));
  }
  setCallModeState(callModeState, "", { silentComposer: true });
}

function normalizeHexColor(value) {
  return trimText(value).toLowerCase();
}

function normalizeEmail(value) {
  const cleaned = trimText(value).toLowerCase();
  const match = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function normalizeVisitorIdentityMode(value) {
  const normalized = trimText(value).toLowerCase();
  return ["guest", "identified"].includes(normalized) ? normalized : "";
}

function normalizeVisitorIdentityState(input = {}) {
  const modeCandidate = normalizeVisitorIdentityMode(
    input.mode || input.visitorMode || input.visitor_mode
  );
  const email = normalizeEmail(input.email || input.visitorEmail || input.visitor_email);
  const name = trimText(input.name || input.visitorName || input.visitor_name);
  const mode = modeCandidate;

  if (mode === "guest") {
    return {
      mode: "guest",
      email: "",
      name: "",
    };
  }

  if (mode === "identified" && email) {
    return {
      mode: "identified",
      email,
      name,
    };
  }

  return {
    mode: "",
    email: "",
    name: "",
  };
}

function getStoredIdentityExpiry() {
  return Date.now() + VISITOR_IDENTITY_TTL_MS;
}

function hasChosenVisitorIdentity() {
  return Boolean(normalizeVisitorIdentityMode(visitorIdentity.mode));
}

function buildVisitorIdentityPayload(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  return {
    visitor_identity: normalized,
    visitor_identity_mode: normalized.mode || "",
    visitor_email: normalized.email || "",
    visitor_name: normalized.name || "",
  };
}

function buildAssistantMessageKey(reply, index = conversationHistory.length) {
  const normalized = trimText(reply).toLowerCase();
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }

  return `${getVisitorSessionKey()}::${index}::${Math.abs(hash)}`;
}

function buildVoiceContextCacheScope() {
  return [
    getVisitorSessionKey(),
    resolvedAgentId,
    resolvedAgentKey,
    resolvedBusinessId,
    INSTALL_ID,
    WEBSITE_URL,
    PUBLIC_PAGE_KEY,
    DISPLAY_MODE,
  ].map((part) => trimText(part)).join("::");
}

function buildScopedVoiceMessageKey(key) {
  const normalizedKey = trimText(key);
  const scope = buildVoiceContextCacheScope();

  return normalizedKey && scope ? `${scope}::${normalizedKey}` : normalizedKey;
}

function saveVisitorIdentity(identity) {
  const normalized = normalizeVisitorIdentityState(identity);

  try {
    if (!visitorStorageConsentGranted) {
      return normalized;
    }

    if (!normalized.mode) {
      window.localStorage.removeItem(getVisitorIdentityStorageKey());
      return normalized;
    }

    window.localStorage.setItem(getVisitorIdentityStorageKey(), JSON.stringify({
      ...normalized,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(getStoredIdentityExpiry()).toISOString(),
    }));
  } catch {
    // Identity persistence is best-effort; blocked storage should not stop chat.
  }

  return normalized;
}

function loadStoredVisitorIdentity() {
  try {
    const value = window.localStorage.getItem(getVisitorIdentityStorageKey());
    const parsed = value ? JSON.parse(value) : null;
    const expiresAt = parsed?.expiresAt || parsed?.expires_at;

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(getVisitorIdentityStorageKey());
      return normalizeVisitorIdentityState();
    }

    const storedIdentity = normalizeVisitorIdentityState(parsed || {});
    if (storedIdentity.mode) {
      visitorStorageConsentGranted = true;
    }

    return storedIdentity;
  } catch {
    return normalizeVisitorIdentityState();
  }
}

function clearVisitorIdentity() {
  try {
    window.localStorage.removeItem(getVisitorIdentityStorageKey());
  } catch {
    // Clearing identity is best-effort when browser storage is unavailable.
  }

  if (isPageMode()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
    setComposerStatus(assistantT("assistant.pageIdentityNote"));
    getPageIdentityEmailForm()?.setAttribute("hidden", "");
    return visitorIdentity;
  }

  visitorIdentity = normalizeVisitorIdentityState();
  syncWidgetPhaseWithIdentity(visitorIdentity);
  setComposerStatus("Choose email or guest to start a fresh visitor identity.");
  return visitorIdentity;
}

function addToHistory(role, content) {
  conversationHistory.push({ role, content });

  if (conversationHistory.length > 12) {
    conversationHistory.splice(0, conversationHistory.length - 12);
  }
}

function normalizeSpeechAuthorization(value = null) {
  const token = trimText(value?.token);
  const expiresAt = trimText(value?.expiresAt || value?.expires_at);

  if (!token) {
    return null;
  }

  return {
    token,
    expiresAt,
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInlineAssistantMarkdown(value) {
  return escapeHtml(String(value || ""))
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

function formatMessageParagraph(lines) {
  const content = lines
    .map((line) => formatInlineAssistantMarkdown(line))
    .join("<br>");

  return content ? `<p>${content}</p>` : "";
}

function formatAssistantMessageHtml(text) {
  const normalized = String(text || "").replace(/\r/g, "").trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      const parts = [];
      let paragraphLines = [];
      let bulletItems = [];

      const flushParagraph = () => {
        if (paragraphLines.length) {
          parts.push(formatMessageParagraph(paragraphLines));
          paragraphLines = [];
        }
      };

      const flushBullets = () => {
        if (bulletItems.length) {
          parts.push(`<ul>${bulletItems.map((item) => `<li>${formatInlineAssistantMarkdown(item)}</li>`).join("")}</ul>`);
          bulletItems = [];
        }
      };

      lines.forEach((line) => {
        const bulletMatch = line.match(/^\s*-\s+(.+)$/);

        if (bulletMatch) {
          flushParagraph();
          bulletItems.push(bulletMatch[1]);
          return;
        }

        flushBullets();
        if (trimText(line)) {
          paragraphLines.push(line);
        }
      });

      flushParagraph();
      flushBullets();
      return parts.join("");
    })
    .filter(Boolean)
    .join("");
}

function getAssistantMark(name = widgetConfig.assistantName) {
  return (name || "V").trim().charAt(0).toUpperCase() || "V";
}

function isDefaultWelcomeMessage(message) {
  const normalized = trimText(message);
  return !normalized || normalized === DEFAULT_WIDGET_CONFIG.welcomeMessage;
}

function isUnsafeCanvasIntroMessage(message) {
  const normalized = trimText(message);
  const lower = normalized.toLowerCase();

  return !normalized
    || lower === DEFAULT_WIDGET_CONFIG.welcomeMessage.toLowerCase()
    || lower === LEGACY_WIDGET_DEFAULTS.welcomeMessage.toLowerCase()
    || /^hi[,!.\s]+my name is vonza\b/i.test(normalized)
    || /^hi[,!.\s]+i'?m vonza\b/i.test(normalized)
    || /^hi[,!.\s]+how can we help today\??$/i.test(normalized);
}

function normalizeBoolean(value, fallbackValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = trimText(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function normalizeFullPageAccentColor(value, fallbackValue = "") {
  const normalized = trimText(value).toLowerCase();

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  return /^#[0-9a-f]{6}$/i.test(trimText(fallbackValue)) ? trimText(fallbackValue) : "";
}

function normalizeFullPageDesignEnum(value, allowedValues, fallbackValue) {
  const normalized = trimText(value).toLowerCase().replace(/_/g, "-");
  return allowedValues.includes(normalized) ? normalized : fallbackValue;
}

function normalizeFullPageDesignNumber(value, fallbackValue, minValue, maxValue, precision = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallbackValue;
  }

  const clamped = Math.max(minValue, Math.min(maxValue, number));
  const multiplier = 10 ** precision;
  return Math.round(clamped * multiplier) / multiplier;
}

function normalizeFullPageMediaUrl(value, allowedExtensions = []) {
  const normalized = trimText(value);

  if (!normalized) {
    return "";
  }

  if (/^\/assets\/front-desk\/backgrounds\/[a-z0-9._/-]+$/i.test(normalized)) {
    const lowerPath = normalized.toLowerCase();
    return allowedExtensions.some((extension) => lowerPath.endsWith(`.${extension}`))
      ? normalized
      : "";
  }

  try {
    const url = new URL(normalized, window.location.origin);
    if (!["https:", "http:"].includes(url.protocol)) {
      return "";
    }

    const pathname = url.pathname.toLowerCase();
    if (allowedExtensions.length && !allowedExtensions.some((extension) => pathname.endsWith(`.${extension}`))) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function getFullPageDesignPresetDefaults(presetValue) {
  const preset = normalizeFullPageDesignEnum(presetValue, FULL_PAGE_DESIGN_PRESETS, DEFAULT_FULL_PAGE_DESIGN.preset);
  const presets = {
    "clean-light": { ...DEFAULT_FULL_PAGE_DESIGN, preset },
    "dark-professional": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundColor: "#111827",
      backgroundGradientTo: "#1f2937",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.36,
      textTheme: "light",
      composerStyle: "elevated",
      chipStyle: "subtle-fill",
      statusStyle: "pill",
    },
    "warm-minimal": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundColor: "#f8f3ea",
      backgroundGradientTo: "#fffaf1",
      backgroundOverlayColor: "#fff7ed",
      backgroundOverlayOpacity: 0.54,
      chipStyle: "soft",
      statusStyle: "minimal",
    },
    "bold-gradient": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundType: "gradient",
      backgroundColor: "#0f766e",
      backgroundGradientTo: "#2563eb",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.18,
      textTheme: "light",
      composerStyle: "elevated",
      chipStyle: "subtle-fill",
      statusStyle: "pill",
    },
    "image-hero": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundType: "image",
      backgroundColor: "#111827",
      backgroundGradientTo: "#1f2937",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.5,
      textTheme: "light",
      composerStyle: "elevated",
      chipStyle: "subtle-fill",
      statusStyle: "pill",
    },
    "video-hero": {
      ...DEFAULT_FULL_PAGE_DESIGN,
      preset,
      backgroundType: "video",
      backgroundColor: "#111827",
      backgroundGradientTo: "#1f2937",
      backgroundOverlayColor: "#020617",
      backgroundOverlayOpacity: 0.56,
      textTheme: "light",
      composerStyle: "elevated",
      chipStyle: "subtle-fill",
      statusStyle: "pill",
      disableVideoOnMobile: true,
    },
  };

  return presets[preset] || presets[DEFAULT_FULL_PAGE_DESIGN.preset];
}

function getFullPageBackgroundPresetDefaults(presetValue) {
  const preset = normalizeFullPageDesignEnum(presetValue, Object.keys(FULL_PAGE_BACKGROUND_PRESETS), "");
  return preset ? FULL_PAGE_BACKGROUND_PRESETS[preset] : null;
}

function normalizeFullPageDesignConfig(rawDesign = {}) {
  const design = rawDesign && typeof rawDesign === "object" && !Array.isArray(rawDesign)
    ? rawDesign
    : {};
  const presetDefaults = getFullPageDesignPresetDefaults(design.preset);
  const rawBackgroundPresetDefaults = getFullPageBackgroundPresetDefaults(design.backgroundPreset || design.background_preset);
  const rawBackgroundSource = normalizeFullPageDesignEnum(
    design.backgroundSource || design.background_source,
    FULL_PAGE_BACKGROUND_SOURCES,
    rawBackgroundPresetDefaults ? "preset" : DEFAULT_FULL_PAGE_DESIGN.backgroundSource
  );
  const backgroundPresetDefaults = rawBackgroundSource === "preset" ? rawBackgroundPresetDefaults : null;
  const backgroundType = normalizeFullPageDesignEnum(
    design.backgroundType || design.background_type,
    FULL_PAGE_BACKGROUND_TYPES,
    backgroundPresetDefaults?.backgroundType || presetDefaults.backgroundType
  );
  const backgroundSource = backgroundPresetDefaults
    ? "preset"
    : rawBackgroundSource === "preset"
      ? DEFAULT_FULL_PAGE_DESIGN.backgroundSource
      : rawBackgroundSource;
  const rawBackgroundImageUrl = normalizeFullPageMediaUrl(design.backgroundImageUrl || design.background_image_url, ["png", "jpg", "jpeg", "webp"]);
  const rawBackgroundVideoUrl = normalizeFullPageMediaUrl(design.backgroundVideoUrl || design.background_video_url, ["mp4", "webm"]);
  const textTheme = normalizeFullPageDesignEnum(design.textTheme || design.text_theme, FULL_PAGE_TEXT_THEMES, backgroundPresetDefaults?.textTheme || presetDefaults.textTheme);
  const isMediaBackground = ["image", "video"].includes(backgroundType);
  const designPresetOwnsMediaBackground = isMediaBackground && presetDefaults.backgroundType === backgroundType;
  const mediaOverlayColor = textTheme === "light" ? "#020617" : "#ffffff";
  const mediaOverlayOpacity = textTheme === "light" ? 0.36 : 0.2;
  const overlayColorFallback =
    backgroundPresetDefaults?.backgroundOverlayColor
    || (designPresetOwnsMediaBackground ? presetDefaults.backgroundOverlayColor : "")
    || (isMediaBackground ? mediaOverlayColor : presetDefaults.backgroundOverlayColor);
  const overlayOpacityFallback =
    backgroundPresetDefaults?.backgroundOverlayOpacity
    ?? (designPresetOwnsMediaBackground ? presetDefaults.backgroundOverlayOpacity : undefined)
    ?? (isMediaBackground ? mediaOverlayOpacity : presetDefaults.backgroundOverlayOpacity);

  return {
    preset: presetDefaults.preset,
    backgroundType,
    backgroundSource,
    backgroundPreset: backgroundPresetDefaults?.key || "",
    backgroundColor: normalizeFullPageAccentColor(design.backgroundColor || design.background_color, backgroundPresetDefaults?.backgroundColor || presetDefaults.backgroundColor),
    backgroundGradientTo: normalizeFullPageAccentColor(design.backgroundGradientTo || design.background_gradient_to, presetDefaults.backgroundGradientTo),
    backgroundImageUrl: backgroundPresetDefaults?.imageUrl || rawBackgroundImageUrl,
    backgroundVideoUrl: backgroundPresetDefaults?.videoUrl || rawBackgroundVideoUrl,
    backgroundOverlayColor: normalizeFullPageAccentColor(design.backgroundOverlayColor || design.background_overlay_color, overlayColorFallback),
    backgroundOverlayOpacity: normalizeFullPageDesignNumber(design.backgroundOverlayOpacity ?? design.background_overlay_opacity, overlayOpacityFallback, 0, 0.92, 2),
    backgroundBlur: normalizeFullPageDesignNumber(design.backgroundBlur ?? design.background_blur, presetDefaults.backgroundBlur, 0, 18),
    backgroundFocalPoint: normalizeFullPageDesignEnum(design.backgroundFocalPoint || design.background_focal_point, FULL_PAGE_FOCAL_POINTS, presetDefaults.backgroundFocalPoint),
    textTheme,
    composerStyle: normalizeFullPageDesignEnum(design.composerStyle || design.composer_style, FULL_PAGE_COMPOSER_STYLES, presetDefaults.composerStyle),
    chipStyle: normalizeFullPageDesignEnum(design.chipStyle || design.chip_style, FULL_PAGE_CHIP_STYLES, presetDefaults.chipStyle),
    statusStyle: normalizeFullPageDesignEnum(design.statusStyle || design.status_style, FULL_PAGE_STATUS_STYLES, presetDefaults.statusStyle),
    backgroundScope: normalizeFullPageDesignEnum(design.backgroundScope || design.background_scope, FULL_PAGE_BACKGROUND_SCOPES, DEFAULT_FULL_PAGE_DESIGN.backgroundScope),
    disableVideoOnMobile: normalizeBoolean(design.disableVideoOnMobile ?? design.disable_video_on_mobile, backgroundPresetDefaults?.disableVideoOnMobile ?? presetDefaults.disableVideoOnMobile),
  };
}

function normalizeLimitedText(value, maxLength) {
  return trimText(value).slice(0, maxLength);
}

function compactEmbeddedPromptLabel(value = "", fallbackType = "") {
  const normalizedType = trimText(fallbackType).toLowerCase();
  if (EMBEDDED_QUICK_REPLY_LABELS[normalizedType]) {
    return assistantT(`quick.${normalizedType}`);
  }

  const text = trimText(value);
  const lower = text.toLowerCase();

  if (/\b(service|offer|do you do|help with)\b/.test(lower)) {
    return assistantT("quick.services");
  }

  if (/\b(price|pricing|cost|rate|fee|charge)\b/.test(lower)) {
    return assistantT("quick.pricing");
  }

  if (/\b(quote|estimate|proposal)\b/.test(lower)) {
    return assistantT("quick.quote");
  }

  if (/\b(contact|email|phone|call|reach|get in touch)\b/.test(lower)) {
    return assistantT("quick.contact");
  }

  if (/\b(book|booking|appointment|schedule)\b/.test(lower)) {
    return assistantT("quick.booking");
  }

  return normalizeLimitedText(text, 24);
}

function getRawFullPageConfig(config = widgetConfig) {
  const rawConfig = config.fullPageConfig || config.full_page_config || {};
  return rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) ? rawConfig : {};
}

function getDefaultPageActionCards(config = widgetConfig) {
  const bookingEnabled = hasBookingSupport(config);
  return PAGE_ACTION_CARDS.filter((card) => !card.requiresBooking || bookingEnabled)
    .map((card) => ({
      ...card,
      label: assistantT(`card.${card.type}.label`, {}, config),
      copy: assistantT(`card.${card.type}.copy`, {}, config),
      description: assistantT(`card.${card.type}.copy`, {}, config),
      prompt: assistantT(`prompt.${card.type}`, {}, config),
    }));
}

function normalizePageActionCard(card = {}, fallbackCard = {}) {
  const label = normalizeLimitedText(card.label || fallbackCard.label, 40);
  const prompt = normalizeLimitedText(card.prompt || fallbackCard.prompt, 200);

  if (!label || !prompt) {
    return null;
  }

  return {
    label,
    description: normalizeLimitedText(card.description || card.copy || fallbackCard.description || fallbackCard.copy, 120),
    prompt,
    type: normalizeLimitedText(card.type || fallbackCard.type || "custom", 24).toLowerCase() || "custom",
    enabled: normalizeBoolean(card.enabled, fallbackCard.enabled !== false),
  };
}

function getFullPageConfig(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  const defaults = getDefaultPageActionCards(config);
  const rawCards = Array.isArray(rawConfig.actionCards)
    ? rawConfig.actionCards
    : Array.isArray(rawConfig.action_cards)
      ? rawConfig.action_cards
      : defaults;
  const suggestedQuestions = (Array.isArray(rawConfig.suggestedQuestions)
    ? rawConfig.suggestedQuestions
    : Array.isArray(rawConfig.suggested_questions)
      ? rawConfig.suggested_questions
      : []
  ).map((question) => normalizeLimitedText(question, 120)).filter(Boolean).slice(0, 5);
  const trustItems = (Array.isArray(rawConfig.trustItems)
    ? rawConfig.trustItems
    : Array.isArray(rawConfig.trust_items)
      ? rawConfig.trust_items
      : [
        assistantT("assistant.status.instant", {}, config),
        assistantT("assistant.status.assistant", {}, config),
        assistantT("assistant.status.leaveDetails", {}, config),
      ]
  ).map((item) => normalizeLimitedText(item, 60)).filter(Boolean).slice(0, 3);
  const bookingSupported = hasBookingSupport(config);

  return {
    headline: normalizeLimitedText(rawConfig.headline, 80),
    subtitle: normalizeLimitedText(rawConfig.subtitle, 180),
    introMessage: normalizeLimitedText(
      rawConfig.introMessage
        || rawConfig.intro_message
        || rawConfig.welcomeMessage
        || rawConfig.welcome_message,
      180
    ),
    actionCards: rawCards
      .slice(0, 6)
      .map((card, index) => normalizePageActionCard(card, defaults[index] || {}))
      .filter(Boolean),
    suggestedQuestions,
    accentColor: normalizeFullPageAccentColor(rawConfig.accentColor || rawConfig.accent_color, config.primaryColor),
    logoUrl: trimText(rawConfig.logoUrl || rawConfig.logo_url || config.widgetLogoUrl),
    showBooking: bookingSupported && normalizeBoolean(rawConfig.showBooking ?? rawConfig.show_booking, bookingSupported),
    showQuote: normalizeBoolean(rawConfig.showQuote ?? rawConfig.show_quote, true),
    showContact: normalizeBoolean(rawConfig.showContact ?? rawConfig.show_contact, true),
    trustItems: trustItems.length ? trustItems : [
      assistantT("assistant.status.instant", {}, config),
      assistantT("assistant.status.assistant", {}, config),
      assistantT("assistant.status.leaveDetails", {}, config),
    ],
    design: normalizeFullPageDesignConfig(rawConfig.design),
  };
}

function hasCustomFullPageSubtitle(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  const rawSubtitle = normalizeLimitedText(rawConfig.subtitle, 180);
  return Boolean(rawSubtitle && rawSubtitle !== DEFAULT_FULL_PAGE_SUBTITLE);
}

function hasConfiguredFullPageActionCards(config = widgetConfig) {
  const rawConfig = getRawFullPageConfig(config);
  return Array.isArray(rawConfig.actionCards) || Array.isArray(rawConfig.action_cards);
}

function getConfiguredQuickReplies(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const limit = EMBEDDED_MODE ? 4 : 5;
  const candidates = [
    ...(isPageMode() ? [fullPageConfig.suggestedQuestions] : []),
    config.suggestedQuestions,
    config.suggested_questions,
    config.quickReplies,
    config.quick_replies,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const values = [...new Set(candidate.map((entry) => trimText(entry)).filter(Boolean))];
      if (values.length) {
        return values.slice(0, limit);
      }
    }

    if (typeof candidate === "string") {
      const values = [...new Set(candidate
        .split(/\n|,/)
        .map((entry) => trimText(entry))
        .filter(Boolean))];
      if (values.length) {
        return values.slice(0, limit);
      }
    }
  }

  return [];
}

function dedupeQuickReplyItems(items = [], limit = 4) {
  const seenPrompts = new Set();
  const seenLabels = new Set();
  const results = [];

  items.forEach((item) => {
    const prompt = normalizeLimitedText(item?.prompt || item?.label, 200);
    const label = normalizeLimitedText(item?.label || prompt, 40);
    const promptKey = prompt.toLowerCase();
    const labelKey = label.toLowerCase();

    if (!prompt || !label || seenPrompts.has(promptKey) || seenLabels.has(labelKey)) {
      return;
    }

    seenPrompts.add(promptKey);
    seenLabels.add(labelKey);
    results.push({
      label,
      prompt,
      type: normalizeLimitedText(item?.type || "", 24),
    });
  });

  return results.slice(0, limit);
}

function getCanvasQuickReplyLabel(card = {}, hasCustomActionCards = false) {
  const configuredLabel = normalizeLimitedText(card.label, 40);

  if (hasCustomActionCards && configuredLabel && !/^ask about\s+/i.test(configuredLabel)) {
    return configuredLabel;
  }

  return compactEmbeddedPromptLabel(card.prompt || configuredLabel, card.type);
}

function getEmbeddedQuickReplyItems(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const hasCustomActionCards = hasConfiguredFullPageActionCards(config);
  const configuredQuestions = Array.isArray(fullPageConfig.suggestedQuestions)
    ? fullPageConfig.suggestedQuestions
    : [];
  const configuredItems = configuredQuestions.map((question) => ({
    label: compactEmbeddedPromptLabel(question),
    prompt: question,
  }));
  const actionItems = getPageActionCards(config).map((card) => ({
    label: isCanvasPageMode()
      ? getCanvasQuickReplyLabel(card, hasCustomActionCards)
      : hasCustomActionCards
        ? normalizeLimitedText(card.label, 40)
        : compactEmbeddedPromptLabel(card.prompt || card.label, card.type),
    prompt: card.prompt,
    type: card.type,
  }));
  const fallbackItems = EMBEDDED_DEFAULT_QUICK_REPLIES.filter((item) => {
    if (item.type === "booking") {
      return hasBookingSupport(config);
    }
    return true;
  }).map((item) => ({
    ...item,
    label: assistantT(`quick.${item.type}`, {}, config),
    prompt: assistantT(`prompt.${item.type}`, {}, config),
  }));

  return dedupeQuickReplyItems([
    ...configuredItems,
    ...actionItems,
    ...fallbackItems,
  ], 4);
}

function getQuickReplyItems(config = widgetConfig) {
  if (isPageMode() && EMBEDDED_MODE) {
    return getEmbeddedQuickReplyItems(config);
  }

  return getQuickReplyTopics(config).map((topic) => ({
    label: topic,
    prompt: topic,
  }));
}

function hasBookingSupport(config = widgetConfig) {
  return Boolean(
    trimText(config.bookingUrl || config.booking_url)
    || trimText(config.bookingStartUrl || config.booking_start_url)
    || trimText(config.bookingSuccessUrl || config.booking_success_url)
    || trimText(config.primaryCtaMode || config.primary_cta_mode).toLowerCase() === "booking"
    || trimText(config.fallbackCtaMode || config.fallback_cta_mode).toLowerCase() === "booking"
  );
}

function getPageActionCards(config = widgetConfig) {
  const fullPageConfig = getFullPageConfig(config);
  const cards = fullPageConfig.actionCards.length
    ? fullPageConfig.actionCards
    : getDefaultPageActionCards(config);

  return cards.filter((card) => {
    if (card.enabled === false) {
      return false;
    }

    if (card.type === "booking") {
      return fullPageConfig.showBooking && hasBookingSupport(config);
    }

    if (card.type === "quote") {
      return fullPageConfig.showQuote;
    }

    if (card.type === "contact") {
      return fullPageConfig.showContact;
    }

    return true;
  });
}

function getQuickReplyTopics(config = widgetConfig) {
  const configured = getConfiguredQuickReplies(config);

  if (configured.length) {
    return configured;
  }

  if (isPageMode()) {
    const topics = [...new Set(getPageActionCards(config).map((card) => card.prompt).filter(Boolean))];
    const fallbackTopics = [...new Set(PAGE_QUICK_REPLY_TOPICS)];
    return (topics.length ? topics : fallbackTopics).slice(0, EMBEDDED_MODE ? 4 : PAGE_QUICK_REPLY_TOPICS.length);
  }

  return [
    assistantT("quick.services", {}, config),
    assistantT("quick.pricing", {}, config),
    assistantT("quick.quote", {}, config),
    assistantT("quick.contact", {}, config),
    assistantT("quick.booking", {}, config),
  ];
}

function getBusinessDisplayName(business = null, config = widgetConfig) {
  const configuredBusinessName = trimText(
    business?.name
    || business?.businessName
    || config.businessName
    || config.business_name
  );
  const assistantName = trimText(config.assistantName);

  if (configuredBusinessName) {
    return configuredBusinessName;
  }

  if (assistantName && (config._hasExplicitAssistantName || !isPageMode())) {
    return assistantName;
  }

  return isPageMode() ? assistantT("assistant.defaultName", {}, config) : DEFAULT_WIDGET_CONFIG.assistantName;
}

function getBusinessDomainLabel(business = null) {
  const websiteUrl = trimText(
    business?.websiteUrl
    || business?.website_url
    || WEBSITE_URL
  );

  if (!websiteUrl) {
    return "";
  }

  try {
    return new URL(websiteUrl).hostname.replace(/^www\./i, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  }
}

function getPageWelcomeMessage({ business = null, config = widgetConfig } = {}) {
  const configuredWelcome = trimText(config.welcomeMessage);

  if (!isPageMode() || !isDefaultWelcomeMessage(configuredWelcome)) {
    return configuredWelcome || DEFAULT_WIDGET_CONFIG.welcomeMessage;
  }

  const businessName = trimText(
    business?.name
    || business?.businessName
    || config.businessName
    || config.business_name
  );

  if (businessName) {
    return assistantT("assistant.pageWelcomeBusiness", { businessName });
  }

  return assistantT("assistant.pageWelcome");
}

function getCanvasIcebreakerLine({ business = pageBusinessContext, config = widgetConfig } = {}) {
  const fullPageConfig = getFullPageConfig(config);
  const configuredIntro = trimText(fullPageConfig.introMessage);
  const configuredSubtitle = trimText(fullPageConfig.subtitle);

  if (
    configuredIntro
    && !isUnsafeCanvasIntroMessage(configuredIntro)
    && configuredIntro.toLowerCase() !== configuredSubtitle.toLowerCase()
    && configuredIntro !== DEFAULT_FULL_PAGE_SUBTITLE
  ) {
    return configuredIntro;
  }

  const businessName = trimText(
    business?.name
    || business?.businessName
    || config.businessName
    || config.business_name
  );

  if (businessName) {
    return assistantT("assistant.canvasWelcomeBusiness", { businessName });
  }

  return assistantT("assistant.canvasWelcome");
}

function hasAssistantConfig() {
  return Boolean(INSTALL_ID || resolvedAgentId || resolvedAgentKey || resolvedBusinessId || WEBSITE_URL);
}

function normalizeWidgetConfig(input = {}) {
  const explicitAssistantName = trimText(input.assistantName || input.assistant_name);
  const hasExplicitAssistantName = Boolean(
    explicitAssistantName
    && explicitAssistantName !== DEFAULT_WIDGET_CONFIG.assistantName
    && explicitAssistantName !== LEGACY_WIDGET_DEFAULTS.assistantName
  );
  const rawInputFullPageConfig =
    input.fullPageConfig && typeof input.fullPageConfig === "object" && !Array.isArray(input.fullPageConfig)
      ? input.fullPageConfig
      : input.full_page_config && typeof input.full_page_config === "object" && !Array.isArray(input.full_page_config)
        ? input.full_page_config
        : {};
  const next = {
    ...DEFAULT_WIDGET_CONFIG,
    ...input,
    _hasExplicitAssistantName: hasExplicitAssistantName,
    _configuredFullPageAccentColor: normalizeFullPageAccentColor(
      rawInputFullPageConfig.accentColor || rawInputFullPageConfig.accent_color
    ),
  };
  next.fullPageConfig = getFullPageConfig(next);
  next.voiceConfig = normalizeVoiceConfig(next);
  const primaryColor = normalizeHexColor(next.primaryColor);
  const secondaryColor = normalizeHexColor(next.secondaryColor);
  const hasLegacyColors =
    primaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.primaryColor)
    && secondaryColor === normalizeHexColor(LEGACY_WIDGET_DEFAULTS.secondaryColor);

  if (hasLegacyColors || (!primaryColor && !secondaryColor)) {
    next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
    next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
  } else {
    if (!primaryColor) {
      next.primaryColor = DEFAULT_WIDGET_CONFIG.primaryColor;
    }

    if (!secondaryColor) {
      next.secondaryColor = DEFAULT_WIDGET_CONFIG.secondaryColor;
    }
  }

  if (!trimText(next.welcomeMessage) || trimText(next.welcomeMessage) === LEGACY_WIDGET_DEFAULTS.welcomeMessage) {
    next.welcomeMessage = DEFAULT_WIDGET_CONFIG.welcomeMessage;
  }

  if (!trimText(next.launcherText) || trimText(next.launcherText) === LEGACY_WIDGET_DEFAULTS.launcherText) {
    next.launcherText = DEFAULT_WIDGET_CONFIG.launcherText;
  }

  if (getAssistantLanguage(next) === "hu") {
    if (isDefaultWelcomeMessage(next.welcomeMessage)) {
      next.welcomeMessage = assistantT("assistant.defaultWelcome", {}, next);
    }

    if (trimText(next.launcherText) === DEFAULT_WIDGET_CONFIG.launcherText) {
      next.launcherText = assistantT("assistant.defaultLauncher", {}, next);
    }
  }

  return next;
}

function normalizeVoiceConfig(config = widgetConfig) {
  const rawConfig = config.voiceConfig || config.voice_config || {};
  const voice = trimText(rawConfig.voice || rawConfig.voice_style).toLowerCase();
  const languageBehavior = trimText(rawConfig.languageBehavior || rawConfig.language_behavior).toLowerCase();

  return {
    voiceInputEnabled: normalizeBoolean(
      rawConfig.voiceInputEnabled ?? rawConfig.voice_input_enabled,
      DEFAULT_VOICE_CONFIG.voiceInputEnabled
    ),
    spokenRepliesEnabled: normalizeBoolean(
      rawConfig.spokenRepliesEnabled ?? rawConfig.spoken_replies_enabled,
      DEFAULT_VOICE_CONFIG.spokenRepliesEnabled
    ),
    webCallEnabled: normalizeBoolean(
      rawConfig.webCallEnabled ?? rawConfig.web_call_enabled,
      DEFAULT_VOICE_CONFIG.webCallEnabled
    ),
    autoSendTranscript: normalizeBoolean(
      rawConfig.autoSendTranscript ?? rawConfig.auto_send_transcript,
      DEFAULT_VOICE_CONFIG.autoSendTranscript
    ),
    autoPlaySpokenReplies: normalizeBoolean(
      rawConfig.autoPlaySpokenReplies ?? rawConfig.auto_play_spoken_replies,
      DEFAULT_VOICE_CONFIG.autoPlaySpokenReplies
    ),
    voice: VOICE_TTS_VOICES.includes(voice) ? voice : DEFAULT_VOICE_CONFIG.voice,
    languageBehavior: ["auto", "business"].includes(languageBehavior)
      ? languageBehavior
      : DEFAULT_VOICE_CONFIG.languageBehavior,
  };
}

function getPageOrigin() {
  if (PAGE_ORIGIN) {
    return trimText(PAGE_ORIGIN);
  }

  if (EMBEDDED_MODE && document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return "";
    }
  }

  return trimText(window.location.origin);
}

function getPageUrl() {
  return trimText(PAGE_URL || (EMBEDDED_MODE ? document.referrer : "") || window.location.href);
}

function getFingerprint() {
  return visitorStorageConsentGranted ? trimText(EMBED_FINGERPRINT) : "";
}

function applyDisplayModeClasses() {
  const hostedCanvas = isHostedCanvasPageMode();
  document.documentElement.classList.toggle("vonza-mode-page", isPageMode());
  document.documentElement.classList.toggle("vonza-mode-widget", !isPageMode());
  document.documentElement.classList.toggle("embedded-mode", EMBEDDED_MODE || hostedCanvas);
  ["card", "flat", "transparent"].forEach((surface) => {
    document.documentElement.classList.toggle(
      `embedded-surface-${surface}`,
      (EMBEDDED_MODE && EMBEDDED_SURFACE === surface) || (hostedCanvas && surface === "flat")
    );
  });
  document.documentElement.classList.toggle("embedded-layout-chat", EMBEDDED_MODE && EMBEDDED_LAYOUT === "chat");
  document.documentElement.classList.toggle("embedded-layout-canvas", (EMBEDDED_MODE && EMBEDDED_LAYOUT === "canvas") || hostedCanvas);
  document.documentElement.classList.toggle("embedded-layout-split", EMBEDDED_MODE && EMBEDDED_LAYOUT === "split");
  document.documentElement.classList.toggle("vonza-page-layout-canvas", isCanvasPageMode());
  document.documentElement.classList.toggle("vonza-canvas-title-hidden", isCanvasPageMode() && !SHOW_EMBED_TITLE);
  document.documentElement.classList.toggle("embedded-smart", isSmartEmbeddedPageMode());
  FULL_PAGE_BACKGROUND_SCOPES.forEach((scope) => {
    document.documentElement.classList.toggle(`embedded-background-scope-${scope}`, isCanvasEmbeddedPageMode() && EMBEDDED_BACKGROUND_SCOPE === scope);
  });
  ["compact", "standard", "tall", "full"].forEach((size) => {
    document.documentElement.classList.toggle(`embedded-size-${size}`, (EMBEDDED_MODE && EMBEDDED_SIZE === size) || (hostedCanvas && size === "full"));
  });
  document.body?.classList.toggle("vonza-mode-page", isPageMode());
  document.body?.classList.toggle("vonza-mode-widget", !isPageMode());
  ["card", "flat", "transparent"].forEach((surface) => {
    document.body?.classList.toggle(
      `embedded-surface-${surface}`,
      (EMBEDDED_MODE && EMBEDDED_SURFACE === surface) || (hostedCanvas && surface === "flat")
    );
  });
  document.body?.classList.toggle("embedded-layout-chat", EMBEDDED_MODE && EMBEDDED_LAYOUT === "chat");
  document.body?.classList.toggle("embedded-layout-canvas", (EMBEDDED_MODE && EMBEDDED_LAYOUT === "canvas") || hostedCanvas);
  document.body?.classList.toggle("embedded-layout-split", EMBEDDED_MODE && EMBEDDED_LAYOUT === "split");
  document.body?.classList.toggle("vonza-page-layout-canvas", isCanvasPageMode());
  document.body?.classList.toggle("vonza-canvas-title-hidden", isCanvasPageMode() && !SHOW_EMBED_TITLE);
  document.body?.classList.toggle("embedded-smart", isSmartEmbeddedPageMode());
  FULL_PAGE_BACKGROUND_SCOPES.forEach((scope) => {
    document.body?.classList.toggle(`embedded-background-scope-${scope}`, isCanvasEmbeddedPageMode() && EMBEDDED_BACKGROUND_SCOPE === scope);
  });
  ["compact", "standard", "tall", "full"].forEach((size) => {
    document.body?.classList.toggle(`embedded-size-${size}`, (EMBEDDED_MODE && EMBEDDED_SIZE === size) || (hostedCanvas && size === "full"));
  });
}

function getAssistantLoadingState() {
  return document.getElementById("assistant-loading-state");
}

function getAssistantUnavailableState() {
  return document.getElementById("assistant-unavailable-state");
}

function getPageAssistantHero() {
  return document.getElementById("page-assistant-hero");
}

function setPageShellState(state, details = {}) {
  if (!isPageMode()) {
    return;
  }

  const loadingState = getAssistantLoadingState();
  const unavailableState = getAssistantUnavailableState();
  const hero = getPageAssistantHero();
  const chatContainer = document.querySelector(".chat-container");
  const isReady = state === "ready";
  const isLoading = state === "loading";
  const isUnavailable = state === "unavailable";

  if (loadingState) {
    loadingState.hidden = !isLoading;
  }

  if (unavailableState) {
    unavailableState.hidden = !isUnavailable;
  }

  if (hero) {
    hero.hidden = !isReady || (EMBEDDED_MODE && !isFullEmbeddedPageMode());
  }

  if (chatContainer) {
    chatContainer.hidden = !isReady;
  }

  if (isUnavailable) {
    const titleEl = document.getElementById("assistant-unavailable-title");
    const copyEl = document.getElementById("assistant-unavailable-copy");
    if (titleEl) {
      titleEl.textContent = details.title || assistantT("assistant.unavailable.title");
    }
    if (copyEl) {
      copyEl.textContent = details.copy || assistantT("assistant.unavailable.copy");
    }
  }
}

function getFriendlyUnavailableState(error = null) {
  const statusCode = Number(error?.statusCode || 0);

  if (statusCode === 404) {
    return {
      title: assistantT("assistant.unavailable.title"),
      copy: assistantT("assistant.unavailable.copy"),
    };
  }

  if (statusCode === 403) {
    return {
      title: assistantT("assistant.unavailable.title"),
      copy: assistantT("assistant.unavailable.copy"),
    };
  }

  if (statusCode === 400) {
    return {
      title: assistantT("assistant.unavailable.title"),
      copy: assistantT("assistant.unavailable.copy"),
    };
  }

  return {
    title: assistantT("assistant.unavailable.title"),
    copy: assistantT("assistant.unavailable.copy"),
  };
}

function syncPageAssistantHeader({ business = pageBusinessContext, config = widgetConfig } = {}) {
  if (!isPageMode()) {
    return;
  }

  const displayName = getBusinessDisplayName(business, config);
  const assistantName = trimText(config.assistantName) || displayName || DEFAULT_WIDGET_CONFIG.assistantName;
  const assistantDisplayName = config._hasExplicitAssistantName ? assistantName : displayName;
  const domain = getBusinessDomainLabel(business);
  const fullPageConfig = getFullPageConfig(config);
  const customLogoUrl = trimText(fullPageConfig.logoUrl || config.widgetLogoUrl);
  const mark = getAssistantMark(displayName);
  const headline = fullPageConfig.headline || assistantT("assistant.defaultFullPageHeadline", {}, config);
  const hasCanvasSubtitle = isCanvasPageMode() && hasCustomFullPageSubtitle(config);
  const subtitle = isCanvasPageMode()
    ? hasCanvasSubtitle
      ? fullPageConfig.subtitle
      : ""
    : fullPageConfig.subtitle || assistantT("assistant.defaultFullPageSubtitle", {}, config);
  const showPageTitle = shouldShowPageTitle();
  const assistantNameEl = document.getElementById("page-assistant-name");
  const subtitleEl = document.getElementById("page-assistant-subtitle");
  const domainEl = document.getElementById("page-business-domain");
  const helpTitleEl = document.getElementById("page-help-title");
  const pageMark = document.getElementById("page-business-mark");
  const pageLogo = document.getElementById("page-business-logo");
  const pageInitial = document.getElementById("page-business-initial");
  const pageActionList = document.getElementById("page-action-list");
  const pageTrustRow = document.getElementById("page-trust-row");
  const chatAssistantNameEl = document.getElementById("assistant-name");
  const launcherTextEl = document.getElementById("launcher-text");
  const sendButton = document.getElementById("send-button");
  const welcomeAssistantNameEl = document.getElementById("welcome-assistant-name");
  const welcomeBrandSubtitleEl = document.querySelector(".welcome-brand-subtitle");
  const welcomeBadgeEl = document.getElementById("welcome-badge");
  const welcomeTitleEl = document.getElementById("welcome-title");
  const welcomeCopyEl = document.getElementById("welcome-copy");
  const welcomeMessageEl = document.getElementById("welcome-message");
  const brandMark = document.querySelector(".brand-mark");
  const welcomeBrandMark = document.querySelector(".welcome-brand-mark");
  const brandLogo = document.getElementById("brand-mark-logo");
  const welcomeBrandLogo = document.getElementById("welcome-brand-logo");
  const brandInitial = document.getElementById("brand-mark-v");
  const welcomeBrandInitial = document.getElementById("welcome-brand-v");
  const introAvatar = document.getElementById("intro-avatar");

  document.title = displayName;

  if (assistantNameEl) {
    assistantNameEl.textContent = displayName;
  }

  if (subtitleEl) {
    subtitleEl.textContent = subtitle;
    subtitleEl.hidden = !showPageTitle || (isCanvasPageMode() && !hasCanvasSubtitle);
  }

  if (domainEl) {
    domainEl.textContent = domain || "";
    domainEl.hidden = !domain;
  }

  if (helpTitleEl) {
    helpTitleEl.textContent = headline;
    helpTitleEl.hidden = !showPageTitle;
  }

  if (pageMark && pageLogo && pageInitial) {
    applyBrandMark(pageMark, pageLogo, pageInitial, customLogoUrl, mark);
  }

  applyBrandMark(brandMark, brandLogo, brandInitial, customLogoUrl, mark);
  applyBrandMark(welcomeBrandMark, welcomeBrandLogo, welcomeBrandInitial, customLogoUrl, mark);

  if (brandMark) {
    brandMark.setAttribute("aria-label", assistantT("assistant.logoLabel", { name: assistantDisplayName }, config));
  }

  if (introAvatar) {
    introAvatar.textContent = mark;
  }

  if (pageActionList) {
    const showPageActionList = !isSmartEmbeddedPageMode() && !isCanvasPageMode();
    pageActionList.hidden = !showPageActionList;
    pageActionList.innerHTML = showPageActionList ? getPageActionCards(config).map((card) => `
      <button
        class="page-action-card"
        type="button"
        data-page-quick-action="${escapeHtml(card.label)}"
        data-page-starter-prompt="${escapeHtml(card.prompt)}"
      >
        <span class="page-action-label">${escapeHtml(card.label)}</span>
        <span class="page-action-copy">${escapeHtml(card.description || card.copy || "")}</span>
      </button>
    `).join("") : "";
  }

  if (pageTrustRow) {
    if (isCanvasPageMode()) {
      pageTrustRow.innerHTML = `
        <span class="canvas-status-pill">
          <span class="canvas-status-title">${escapeHtml(assistantT("assistant.status.online", {}, config))}</span>
          <span class="canvas-status-instant"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(assistantT("assistant.status.instant", {}, config))}</span>
        </span>
      `;
    } else {
      pageTrustRow.innerHTML = fullPageConfig.trustItems
        .slice(0, 3)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join("");
    }
  }

  if (chatAssistantNameEl) {
    chatAssistantNameEl.textContent = assistantDisplayName;
  }

  if (sendButton) {
    const sendLabel = assistantT("assistant.sendTo", { name: assistantDisplayName }, config);
    sendButton.setAttribute("aria-label", sendLabel);
    sendButton.setAttribute("title", sendLabel);
  }

  if (launcherTextEl) {
    launcherTextEl.textContent = assistantT("assistant.onlineNow", {}, config);
  }

  if (welcomeAssistantNameEl) {
    welcomeAssistantNameEl.textContent = assistantDisplayName;
  }

  if (welcomeBrandSubtitleEl) {
    welcomeBrandSubtitleEl.textContent = assistantT("assistant.businessAssistant", {}, config);
  }

  if (welcomeBadgeEl) {
    welcomeBadgeEl.textContent = assistantT("assistant.chooseContinue", {}, config);
  }

  if (welcomeTitleEl) {
    welcomeTitleEl.textContent = assistantT("assistant.startConversation", {}, config);
  }

  if (welcomeCopyEl) {
    welcomeCopyEl.textContent = assistantT("assistant.continueChoice", {}, config);
  }

  if (welcomeMessageEl) {
    welcomeMessageEl.textContent = getPageWelcomeMessage({ business, config });
  }

  const canvasIntroLine = document.getElementById("canvas-intro-line");
  if (canvasIntroLine) {
    if (isCanvasPageMode()) {
      canvasIntroLine.textContent = getCanvasIcebreakerLine({ business, config });
      canvasIntroLine.hidden = false;
    } else {
      canvasIntroLine.textContent = "";
      canvasIntroLine.hidden = true;
    }
  }
}

function getIdentityChoicePanel() {
  return document.getElementById("identity-choice-panel");
}

function getIdentityEmailForm() {
  return document.getElementById("identity-email-form");
}

function getEntryState() {
  return document.getElementById("entry-state");
}

function getChatState() {
  return document.getElementById("chat-state");
}

function getWelcomePanel() {
  return document.getElementById("welcome-panel");
}

function getIntroMessage() {
  return document.getElementById("intro-message");
}

function getComposerShell() {
  return document.getElementById("composer-shell");
}

function getQuickReplies() {
  return document.getElementById("quick-replies");
}

function getPageIdentityInline() {
  return document.getElementById("page-identity-inline");
}

function getPageIdentityEmailForm() {
  return document.getElementById("page-identity-email-form");
}

function syncPageIdentityInline() {
  const inline = getPageIdentityInline();

  if (!inline) {
    return;
  }

  const shouldShow = isPageMode() && widgetPhase === WIDGET_PHASES.CHAT;
  inline.hidden = !shouldShow;

  if (!shouldShow) {
    return;
  }

  const note = document.getElementById("page-identity-note");
  const button = document.getElementById("page-identity-email-button");
  const resetButton = document.getElementById("identity-reset-button");
  const normalized = normalizeVisitorIdentityState(visitorIdentity);

  if (note) {
    if (normalized.mode === "identified" && normalized.email) {
      note.textContent = EMBEDDED_MODE
        ? assistantT("assistant.identityEmailCompactStatus", { email: normalized.email })
        : assistantT("assistant.identityEmailStatus", { email: normalized.email });
    } else {
      note.textContent = EMBEDDED_MODE
        ? assistantT("assistant.identityGuestCompactStatus")
        : assistantT("assistant.pageIdentityNote");
    }
  }

  if (button) {
    button.textContent = normalized.mode === "identified" && normalized.email
      ? assistantT("assistant.updateContact")
      : assistantT("assistant.leaveContact");
  }

  if (resetButton && EMBEDDED_MODE) {
    resetButton.hidden = !(normalized.mode === "identified" && normalized.email);
  }

  queueEmbeddedHeightUpdate();
}

function focusComposerInputIfSafe(options = {}) {
  const input = document.getElementById("input");

  if (!input || input.disabled) {
    return false;
  }

  if (isCanvasPageMode() && options.force !== true && isMobileViewport()) {
    return false;
  }

  if (isCanvasPageMode()) {
    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      input.focus();
    }
    return true;
  }

  input.focus();
  return true;
}

function isMobilePagePromptMode() {
  return isPageMode()
    && !EMBEDDED_MODE
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 720px)").matches;
}

function shouldShowQuickReplies() {
  if (isCanvasPageMode()) {
    return widgetPhase === WIDGET_PHASES.CHAT && !hasCanvasVisibleThread();
  }

  if (isPageMode() && !EMBEDDED_MODE && !isMobilePagePromptMode()) {
    return false;
  }

  return widgetPhase === WIDGET_PHASES.CHAT && !quickRepliesDismissed && conversationHistory.length < 2;
}

function renderQuickReplies() {
  const container = getQuickReplies();

  if (!container) {
    return;
  }

  const showReplies = shouldShowQuickReplies();
  container.hidden = !showReplies;

  if (!showReplies) {
    if (isCanvasPageMode() && canvasQuickRepliesDismissing) {
      return;
    }

    if (isCanvasPageMode() && container.innerHTML && dismissCanvasQuickReplies()) {
      return;
    }

    container.innerHTML = "";
    return;
  }

  clearTimeout(canvasQuickRepliesDismissTimer);
  canvasQuickRepliesDismissing = false;
  container.classList.remove("is-exiting");
  container.removeAttribute("aria-hidden");
  container.setAttribute("aria-label", assistantT("assistant.quickTopicsLabel"));
  container.innerHTML = getQuickReplyItems().map((item) => `
    <button
      class="quick-reply-chip"
      type="button"
      data-quick-reply="${escapeHtml(item.prompt)}"
      data-quick-reply-label="${escapeHtml(item.label)}"
    >${escapeHtml(item.label)}</button>
  `).join("");

  queueEmbeddedHeightUpdate();
}

function dismissCanvasQuickReplies() {
  const container = getQuickReplies();
  const duration = getCanvasTransitionDuration();

  if (!container || !container.innerHTML || duration <= 0) {
    return false;
  }

  clearTimeout(canvasQuickRepliesDismissTimer);
  canvasQuickRepliesDismissing = true;
  container.hidden = false;
  container.classList.add("is-exiting");
  container.setAttribute("aria-hidden", "true");

  canvasQuickRepliesDismissTimer = setTimeout(() => {
    canvasQuickRepliesDismissing = false;
    container.classList.remove("is-exiting");
    container.removeAttribute("aria-hidden");
    container.hidden = true;
    container.innerHTML = "";
    queueEmbeddedHeightUpdate();
  }, duration);

  return true;
}

function hasCanvasVisibleThread() {
  const chat = document.getElementById("chat");

  return Array.from(chat?.children || []).some((child) => {
    const className = String(child.className || "");
    return className.includes("message") && !className.includes("intro") && child.hidden !== true;
  });
}

function getCanvasVisibleMessageCount(chat) {
  if (!isCanvasPageMode()) {
    return 0;
  }

  return Array.from(chat?.children || []).filter((child) => {
    const className = String(child.className || "");
    return className.includes("message") && !className.includes("intro") && child.hidden !== true;
  }).length;
}

function updateCanvasConversationState() {
  if (!isCanvasPageMode()) {
    document.documentElement.classList.remove("vonza-canvas-empty", "vonza-canvas-active", "vonza-canvas-transitioning", "vonza-canvas-answering");
    document.body?.classList.remove("vonza-canvas-empty", "vonza-canvas-active", "vonza-canvas-transitioning", "vonza-canvas-answering");
    return;
  }

  const wasEmpty = document.documentElement.classList.contains("vonza-canvas-empty");
  const wasActive = document.documentElement.classList.contains("vonza-canvas-active");
  const hasVisibleThread = hasCanvasVisibleThread();
  document.documentElement.classList.toggle("vonza-canvas-empty", !hasVisibleThread);
  document.documentElement.classList.toggle("vonza-canvas-active", hasVisibleThread);
  document.body?.classList.toggle("vonza-canvas-empty", !hasVisibleThread);
  document.body?.classList.toggle("vonza-canvas-active", hasVisibleThread);

  if (hasVisibleThread && wasEmpty && !wasActive) {
    startCanvasStateTransition();
  }
}

function startCanvasStateTransition() {
  const duration = getCanvasTransitionDuration();

  clearTimeout(canvasTransitionTimer);

  if (duration <= 0) {
    document.documentElement.classList.remove("vonza-canvas-transitioning");
    document.body?.classList.remove("vonza-canvas-transitioning");
    return;
  }

  document.documentElement.classList.add("vonza-canvas-transitioning");
  document.body?.classList.add("vonza-canvas-transitioning");
  canvasTransitionTimer = setTimeout(() => {
    document.documentElement.classList.remove("vonza-canvas-transitioning");
    document.body?.classList.remove("vonza-canvas-transitioning");
  }, duration);
}

function setCanvasAnsweringState(isAnswering) {
  if (!isCanvasPageMode()) {
    return;
  }

  document.documentElement.classList.toggle("vonza-canvas-answering", isAnswering);
  document.body?.classList.toggle("vonza-canvas-answering", isAnswering);
}

function updateComposerAvailability() {
  const composerShell = getComposerShell();
  const input = document.getElementById("input");
  const button = document.getElementById("send-button");
  const inputArea = document.querySelector(".input-area");
  const chatReady = widgetPhase === WIDGET_PHASES.CHAT;

  if (!composerShell || !input || !button || !inputArea) {
    return;
  }

  composerShell.hidden = !chatReady;
  input.disabled = !chatReady;
  button.disabled = !chatReady;
  input.placeholder = isCanvasPageMode()
    ? assistantT("assistant.canvasPlaceholder")
    : assistantT("assistant.composerPlaceholder");
  inputArea.classList.toggle("is-locked", !chatReady);
  renderQuickReplies();
  syncVoiceControls();
}

function normalizeWidgetPhase(value) {
  return value === WIDGET_PHASES.CHAT ? WIDGET_PHASES.CHAT : WIDGET_PHASES.ENTRY;
}

function getWidgetPhaseForIdentity(identity = visitorIdentity) {
  return normalizeVisitorIdentityState(identity).mode
    ? WIDGET_PHASES.CHAT
    : WIDGET_PHASES.ENTRY;
}

function renderWidgetPhase() {
  widgetPhase = normalizeWidgetPhase(widgetPhase);

  const entryState = getEntryState();
  const chatState = getChatState();
  const welcomePanel = getWelcomePanel();
  const identityPanel = getIdentityChoicePanel();
  const emailForm = getIdentityEmailForm();
  const introMessage = getIntroMessage();
  const chatReady = widgetPhase === WIDGET_PHASES.CHAT;

  if (entryState) {
    entryState.hidden = chatReady;
  }

  if (chatState) {
    chatState.hidden = !chatReady;
  }

  if (welcomePanel) {
    welcomePanel.hidden = chatReady;
  }

  if (identityPanel) {
    identityPanel.hidden = chatReady;
  }

  if (introMessage) {
    introMessage.hidden = !chatReady || isCanvasPageMode();
  }

  if (emailForm && chatReady) {
    emailForm.setAttribute("hidden", "");
  }

  updateComposerAvailability();
  syncPageIdentityInline();
  updateCanvasConversationState();
  queueEmbeddedHeightUpdate();
}

function syncWidgetPhaseWithIdentity(identity = visitorIdentity) {
  widgetPhase = getWidgetPhaseForIdentity(identity);
  renderWidgetPhase();
  return widgetPhase;
}

function setVisitorIdentityState(identity, options = {}) {
  const normalized = normalizeVisitorIdentityState(identity);
  visitorIdentity = options.persist === false
    ? normalized
    : saveVisitorIdentity(normalized);

  syncWidgetPhaseWithIdentity(visitorIdentity);
  return visitorIdentity;
}

function continueIntoChat(identity, options = {}) {
  if (options.persist !== false) {
    grantVisitorStorageConsent();
  }

  const normalized = setVisitorIdentityState(identity, options);

  if (!normalized.mode) {
    return normalized;
  }

  if (normalized.mode === "identified") {
    setComposerStatus(assistantT("assistant.identityEmailStatus", { email: normalized.email }));
  } else {
    setComposerStatus(assistantT("assistant.identityGuestStatus"));
  }

  if (options.track !== false) {
    void trackWidgetEvent("identity_mode_selected", {
      mode: normalized.mode,
      hasName: Boolean(normalized.name),
    }, {
      dedupeKey: `${INSTALL_ID}::identity_mode_selected::${getVisitorSessionKey()}::${normalized.mode}`,
    });
  }

  if (options.capture !== false) {
    void persistVisitorIdentityChoice(normalized);
  }

  focusComposerInputIfSafe();
  return normalized;
}

async function persistVisitorIdentityChoice(identity = visitorIdentity) {
  const normalized = normalizeVisitorIdentityState(identity);

  if (!normalized.mode) {
    return null;
  }

  try {
    const response = await fetch("/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: normalized.mode === "guest" ? "choose_guest" : "submit",
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        public_page_key: PUBLIC_PAGE_KEY,
        display_mode: DISPLAY_MODE,
        visitor_session_key: getVisitorSessionKey(),
        reference_message: normalized.mode === "guest"
          ? "Visitor continued as guest."
          : "Visitor continued with email.",
        name: normalized.name,
        email: normalized.email,
        preferred_channel: normalized.mode === "identified" ? "email" : "",
        ...buildVisitorIdentityPayload(normalized),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Visitor identity capture failed");
    }

    liveLeadCapture = data.leadCapture || liveLeadCapture;
    if (data.visitorIdentity) {
      visitorIdentity = normalizeVisitorIdentityState(data.visitorIdentity);
      syncWidgetPhaseWithIdentity(visitorIdentity);
    }

    return liveLeadCapture;
  } catch (error) {
    console.warn("Vonza visitor identity capture failed:", error);
    return null;
  }
}

function getDirectRoutingSlot() {
  return document.getElementById("direct-routing-slot");
}

function getDismissedRouteStorageKey() {
  return `${getVisitorSessionStorageKey()}_dismissed_routes`;
}

function getDismissedRouteKeys() {
  try {
    const value = window.localStorage.getItem(getDismissedRouteStorageKey());
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => trimText(entry)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isRouteDismissed(decisionKey) {
  return getDismissedRouteKeys().includes(trimText(decisionKey));
}

function rememberDismissedRoute(decisionKey) {
  const normalized = trimText(decisionKey);

  if (!normalized) {
    return;
  }

  const nextKeys = [...new Set([...getDismissedRouteKeys(), normalized])];
  window.localStorage.setItem(getDismissedRouteStorageKey(), JSON.stringify(nextKeys.slice(-12)));
}

function buildRoutingMetadata(routing, cta) {
  return {
    decisionKey: trimText(routing?.decisionKey || ""),
    ctaType: trimText(cta?.ctaType || ""),
    targetType: trimText(cta?.targetType || ""),
    relatedIntentType: trimText(routing?.intentType || ""),
    relatedActionKey: trimText(routing?.relatedActionKey || liveLeadCapture?.latestActionKey || ""),
    relatedConversationId: trimText(routing?.relatedConversationId || ""),
    relatedPersonKey: trimText(routing?.relatedPersonKey || liveLeadCapture?.personKey || ""),
    leadId: trimText(routing?.relatedLeadId || liveLeadCapture?.id || ""),
    followUpId: trimText(routing?.relatedFollowUpId || liveLeadCapture?.relatedFollowUpId || ""),
    routingMode: trimText(routing?.routingMode || routing?.mode || ""),
    sourceUrl: getPageUrl(),
  };
}

function buildTrackedRedirectUrl(routing, cta) {
  const metadata = buildRoutingMetadata(routing, cta);
  const url = new URL("/install/cta", window.location.origin);

  url.searchParams.set("install_id", INSTALL_ID);
  if (getPageUrl()) url.searchParams.set("page_url", getPageUrl());
  if (getPageOrigin()) url.searchParams.set("origin", getPageOrigin());
  if (trimText(cta?.ctaType)) url.searchParams.set("cta_type", trimText(cta.ctaType));
  if (trimText(cta?.targetType)) url.searchParams.set("target_type", trimText(cta.targetType));
  if (trimText(cta?.href)) url.searchParams.set("target_url", trimText(cta.href));
  if (trimText(cta?.label)) url.searchParams.set("label", trimText(cta.label));
  if (metadata.decisionKey) url.searchParams.set("decision_key", metadata.decisionKey);
  if (metadata.relatedIntentType) url.searchParams.set("related_intent_type", metadata.relatedIntentType);
  if (metadata.relatedActionKey) url.searchParams.set("action_key", metadata.relatedActionKey);

  return url.toString();
}

function openRoutingTarget(cta = {}, redirectUrl = "") {
  const href = trimText(redirectUrl || cta.href);

  if (!href) {
    return;
  }

  if (cta.targetType === "phone" || cta.targetType === "email") {
    window.location.href = href;
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
}

function bindDirectRoutingInteractions(slot, routing) {
  const continueButton = slot.querySelector("[data-routing-continue]");
  const ctaButtons = slot.querySelectorAll("[data-routing-cta]");

  ctaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const cta = {
        ctaType: trimText(button.dataset.ctaType),
        targetType: trimText(button.dataset.targetType),
        href: trimText(button.dataset.href),
        targetValue: trimText(button.dataset.targetValue),
      };

      rememberDismissedRoute(routing.decisionKey);
      renderDirectRouting(null);
      setComposerStatus(assistantT("assistant.routeOpening", { label: trimText(button.textContent).toLowerCase() }));
      const redirectUrl = buildTrackedRedirectUrl(routing, cta);
      void trackWidgetEvent("cta_clicked", buildRoutingMetadata(routing, cta), {
        dedupeKey: `${INSTALL_ID}::cta_clicked::${trimText(routing.decisionKey)}::${trimText(cta.ctaType)}::${trimText(cta.targetType)}`,
      });
      openRoutingTarget(cta, redirectUrl);
    });
  });

  if (continueButton) {
    continueButton.addEventListener("click", () => {
      rememberDismissedRoute(routing.decisionKey);
      if (trimText(routing.continueButton?.action) === "reveal_capture" && liveLeadCapture?.shouldPrompt) {
        renderLeadCapture(liveLeadCapture, { force: true });
        void trackWidgetEvent("capture_fallback_offered", {
          relatedConversationId: trimText(routing.relatedConversationId || ""),
          relatedIntentType: trimText(routing.intentType || ""),
          relatedActionKey: trimText(routing.relatedActionKey || ""),
        }, {
          dedupeKey: `${INSTALL_ID}::capture_fallback_offered::${trimText(routing.decisionKey || getVisitorSessionKey())}`,
        });
        setComposerStatus(assistantT("assistant.routeCaptureStatus"));
        return;
      }

      renderDirectRouting(null);
      setComposerStatus(assistantT("assistant.routeDismissedStatus"));
    });
  }
}

function getRoutingSuggestionTitle(routing = {}, cta = {}) {
  const intentType = trimText(routing.intentType);
  const label = trimText(cta.label);

  if (intentType === "booking") {
    return assistantT("assistant.routeBookingTitle");
  }

  if (intentType === "quote") {
    return assistantT("assistant.routeQuoteTitle");
  }

  if (intentType === "checkout") {
    return assistantT("assistant.routeCheckoutTitle");
  }

  if (intentType === "contact") {
    return assistantT("assistant.routeContactTitle");
  }

  return label
    ? assistantT("assistant.routeGenericWithLabel", { label: label.toLowerCase() })
    : assistantT("assistant.routeGenericTitle");
}

function renderDirectRouting(routing) {
  const slot = getDirectRoutingSlot();

  if (!slot) {
    return;
  }

  liveDirectRouting = routing && typeof routing === "object" ? routing : null;

  const shouldShow = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (!shouldShow) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  const primaryCta = liveDirectRouting.primaryCta || {};
  const secondaryCtas = Array.isArray(liveDirectRouting.secondaryCtas)
    ? liveDirectRouting.secondaryCtas.filter((entry) => entry && trimText(entry.href))
    : [];

  slot.hidden = false;
  slot.innerHTML = `
    <article class="customer-next-step">
      <h3 class="customer-next-step-title">${escapeHtml(getRoutingSuggestionTitle(liveDirectRouting, primaryCta))}</h3>
      <p class="customer-next-step-copy">${escapeHtml(assistantT("assistant.routeCopy"))}</p>
      ${trimText(liveDirectRouting.availabilityNote) ? `<p class="customer-next-step-note">${escapeHtml(trimText(liveDirectRouting.availabilityNote))}</p>` : ""}
      <div class="routing-actions">
        <button
          type="button"
          class="routing-primary-button"
          data-routing-cta
          data-cta-type="${escapeHtml(trimText(primaryCta.ctaType))}"
          data-target-type="${escapeHtml(trimText(primaryCta.targetType))}"
          data-href="${escapeHtml(trimText(primaryCta.href))}"
          data-target-value="${escapeHtml(trimText(primaryCta.targetValue))}"
        >${escapeHtml(trimText(primaryCta.label) || assistantT("assistant.routeContinueFallback"))}</button>
        ${secondaryCtas.map((cta) => `
          <button
            type="button"
            class="ghost-button routing-secondary-button"
            data-routing-cta
            data-cta-type="${escapeHtml(trimText(cta.ctaType))}"
            data-target-type="${escapeHtml(trimText(cta.targetType))}"
            data-href="${escapeHtml(trimText(cta.href))}"
            data-target-value="${escapeHtml(trimText(cta.targetValue))}"
          >${escapeHtml(trimText(cta.label) || assistantT("assistant.routeOpenFallback"))}</button>
        `).join("")}
        <button type="button" class="ghost-button routing-secondary-button" data-routing-continue>${escapeHtml(trimText(liveDirectRouting.continueButton?.label) || assistantT("assistant.routeContinue"))}</button>
      </div>
    </article>
  `;

  bindDirectRoutingInteractions(slot, liveDirectRouting);
  void trackWidgetEvent("cta_shown", buildRoutingMetadata(liveDirectRouting, primaryCta), {
    dedupeKey: `${INSTALL_ID}::cta_shown::${trimText(liveDirectRouting.decisionKey)}`,
  });
}

function renderLeadCapture(leadCapture, options = {}) {
  const slot = getDirectRoutingSlot();
  const chat = document.getElementById("chat");
  liveLeadCapture = leadCapture && typeof leadCapture === "object" ? leadCapture : null;

  if (!slot || !liveLeadCapture) {
    return;
  }

  const state = trimText(liveLeadCapture.state).toLowerCase();
  const directRouteVisible = Boolean(
    liveDirectRouting
    && ["direct_cta", "direct_then_capture"].includes(trimText(liveDirectRouting.mode))
    && liveDirectRouting.primaryCta
    && !isRouteDismissed(liveDirectRouting.decisionKey)
  );

  if (directRouteVisible && options.force !== true) {
    return;
  }

  if (state === "captured") {
    slot.hidden = true;
    slot.innerHTML = "";

    const promptShownKey = `${trimText(liveLeadCapture?.id) || getVisitorSessionKey()}::captured`;
    if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
      leadCapturePromptShownKeys.add(promptShownKey);
      appendMessage(chat, "bot", trimText(liveLeadCapture.message) || assistantT("assistant.leadSaved"));
    }
    return;
  }

  if (!liveLeadCapture.shouldPrompt) {
    slot.hidden = true;
    slot.innerHTML = "";
    return;
  }

  slot.hidden = true;
  slot.innerHTML = "";

  const promptShownKey = trimText(liveLeadCapture?.id) || `${getVisitorSessionKey()}::${trimText(liveLeadCapture?.trigger)}`;
  if (chat && !leadCapturePromptShownKeys.has(promptShownKey)) {
    leadCapturePromptShownKeys.add(promptShownKey);
    appendMessage(chat, "bot", trimText(liveLeadCapture.prompt?.body) || assistantT("assistant.leadPrompt"));
    void submitLeadCaptureAction("prompt_shown", {}, { silent: true });
  }
}

async function submitLeadCaptureAction(action, fields = {}, options = {}) {
  if (!liveLeadCapture || !trimText(action)) {
    return null;
  }

  try {
    const response = await fetch("/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        public_page_key: PUBLIC_PAGE_KEY,
        display_mode: DISPLAY_MODE,
        visitor_session_key: getVisitorSessionKey(),
        reference_message: lastLeadReferenceMessage,
        ...buildVisitorIdentityPayload(),
        ...fields,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Capture request failed");
    }

    if (options.silent === true) {
      return data.leadCapture || null;
    }

    renderLeadCapture(data.leadCapture || null, { force: true });
    if (trimText(data.leadCapture?.message) && trimText(data.leadCapture?.state).toLowerCase() !== "captured") {
      appendMessage(document.getElementById("chat"), "bot", data.leadCapture.message);
    }
    setComposerStatus(
      trimText(data.leadCapture?.state).toLowerCase() === "captured"
        ? assistantT("assistant.leadSaved")
        : assistantT("assistant.routeDismissedStatus")
    );
    return data.leadCapture || null;
  } catch (error) {
    if (options.silent !== true) {
      setComposerStatus(assistantT("assistant.feedbackFailed"));
    }
    console.warn("Vonza lead capture failed:", error);
    return null;
  }
}

async function trackWidgetEvent(eventName, metadata = {}, options = {}) {
  if (!INSTALL_ID || !visitorStorageConsentGranted) {
    return;
  }

  const dedupeKey = trimText(options.dedupeKey)
    || `${INSTALL_ID}::${eventName}::${options.scope || getVisitorSessionKey()}`;

  if (sentTelemetryKeys.has(dedupeKey)) {
    return;
  }

  sentTelemetryKeys.add(dedupeKey);

  try {
    await fetch("/install/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        event_name: eventName,
        session_id: getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        origin: getPageOrigin(),
        page_url: getPageUrl(),
        public_page_key: PUBLIC_PAGE_KEY,
        display_mode: DISPLAY_MODE,
        dedupe_key: dedupeKey,
        metadata: {
          ...metadata,
          displayMode: DISPLAY_MODE,
        },
      }),
    });
  } catch (error) {
    console.warn("Vonza widget telemetry failed:", error);
  }
}

function getOutcomeDetectionStorageKey() {
  const pageUrl = getPageUrl();

  if (!pageUrl || !INSTALL_ID) {
    return "";
  }

  try {
    const parsed = new URL(pageUrl);
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${parsed.pathname}::${parsed.search}`;
  } catch {
    return `${OUTCOME_DETECTION_STORAGE_PREFIX}${INSTALL_ID}::${pageUrl}`;
  }
}

async function detectConversionOutcomesOnLoad() {
  const pageUrl = getPageUrl();
  const storageKey = getOutcomeDetectionStorageKey();

  if (!INSTALL_ID || !pageUrl || !storageKey || !visitorStorageConsentGranted) {
    return;
  }

  if (window.sessionStorage.getItem(storageKey) === "1") {
    return;
  }

  try {
    const parsedPageUrl = new URL(pageUrl);
    const ctaEventId = trimText(parsedPageUrl.searchParams.get("vz_cta_event_id"));
    const response = await fetch("/install/outcomes/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        install_id: INSTALL_ID,
        session_id: getVisitorSessionKey(),
        visitor_id: getFingerprint() || getVisitorSessionKey(),
        fingerprint: getFingerprint(),
        page_url: pageUrl,
        origin: getPageOrigin(),
        cta_event_id: ctaEventId || null,
      }),
    });

    if (response.ok) {
      window.sessionStorage.setItem(storageKey, "1");
    }
  } catch (error) {
    console.warn("Vonza outcome detection failed:", error);
  }
}

function setComposerStatus(message) {
  const statusEl = document.getElementById("composer-status");

  if (statusEl) {
    statusEl.textContent = message;
  }
}

function getVoiceConfig(config = widgetConfig) {
  return config.voiceConfig || normalizeVoiceConfig(config);
}

function browserSupportsVoiceInput() {
  return Boolean(
    navigator?.mediaDevices?.getUserMedia
    && typeof window.MediaRecorder === "function"
  );
}

function isLocalSecureHost() {
  const hostname = trimText(window.location?.hostname).toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function voiceRequiresHttps() {
  return window.isSecureContext === false
    || (window.location?.protocol === "http:" && !isLocalSecureHost());
}

function getVoiceUnavailableMessage() {
  if (voiceRequiresHttps()) {
    return assistantT("assistant.voiceHttps");
  }

  if (!navigator?.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
    return assistantT("assistant.voiceUnavailable");
  }

  return "";
}

function getMicrophoneStartErrorMessage(error) {
  if (voiceRequiresHttps()) {
    return assistantT("assistant.voiceHttps");
  }

  const errorName = trimText(error?.name);
  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return assistantT("assistant.voicePermission");
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return assistantT("assistant.voiceDevice");
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError" || errorName === "SecurityError") {
    return assistantT("assistant.voicePermission");
  }

  return assistantT("assistant.voicePermission");
}

function getVoiceApiFailureMessage(statusCode, fallbackKey = "assistant.voiceTranscribeFailed") {
  const status = Number(statusCode || 0);

  if ([402, 403, 503].includes(status)) {
    return assistantT("assistant.voiceUnavailableType");
  }

  if (status === 429) {
    return assistantT("assistant.voiceBusyTryAgain");
  }

  if (status === 413) {
    return assistantT("assistant.voiceRecordingTooLarge");
  }

  return assistantT(fallbackKey);
}

function isAutoplayBlockedError(error) {
  const errorName = trimText(error?.name);
  const errorMessage = trimText(error?.message).toLowerCase();

  return errorName === "NotAllowedError"
    || errorName === "AbortError"
    || /notallowed|permission|interact|user gesture|autoplay/.test(errorMessage);
}

function getSpeechPlaybackFailureMessage(error, options = {}) {
  if (error?.code === "audio_unsupported") {
    return assistantT("assistant.voiceAudioUnsupported");
  }

  if (options.auto === true && isAutoplayBlockedError(error)) {
    return assistantT("assistant.voicePressPlay");
  }

  return assistantT("assistant.voiceSpokenCouldNotPlay");
}

function getPreferredRecordingMimeType() {
  const MediaRecorderCtor = window.MediaRecorder;

  if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== "function") {
    return "";
  }

  return VOICE_RECORDING_MIME_TYPES.find((type) => MediaRecorderCtor.isTypeSupported(type)) || "";
}

function getVoiceInputButton() {
  return document.getElementById("voice-input-button");
}

function getSpeakRepliesToggle() {
  return document.getElementById("speak-replies-toggle");
}

function getCallModePanel() {
  return document.getElementById("call-front-desk-panel");
}

function getCallModeStatus() {
  return document.getElementById("call-front-desk-status");
}

function getCallModeStartButton() {
  return document.getElementById("call-front-desk-start");
}

function getCallModeStopButton() {
  return document.getElementById("call-front-desk-stop");
}

function getCallModeEndButton() {
  return document.getElementById("call-front-desk-end");
}

function getCallModeStateMessage(state = callModeState) {
  switch (state) {
    case CALL_MODE_STATES.REQUESTING:
      return assistantT("assistant.callRequesting");
    case CALL_MODE_STATES.LISTENING:
      return assistantT("assistant.callListening");
    case CALL_MODE_STATES.TRANSCRIBING:
      return assistantT("assistant.callTranscribing");
    case CALL_MODE_STATES.THINKING:
      return assistantT("assistant.callThinking");
    case CALL_MODE_STATES.SPEAKING:
      return assistantT("assistant.callSpeaking");
    case CALL_MODE_STATES.MUTED_STOPPED:
      return assistantT("assistant.callMutedStopped");
    case CALL_MODE_STATES.STOPPED:
      return assistantT("assistant.callStopped");
    case CALL_MODE_STATES.UNAVAILABLE:
      return assistantT("assistant.callUnavailable");
    case CALL_MODE_STATES.READY:
    default:
      return assistantT("assistant.callReady");
  }
}

function setCallModeState(state, message = "", options = {}) {
  const panel = getCallModePanel();
  const status = getCallModeStatus();
  const normalizedState = Object.values(CALL_MODE_STATES).includes(state)
    ? state
    : CALL_MODE_STATES.READY;
  const label = message || getCallModeStateMessage(normalizedState);

  callModeState = normalizedState;

  if (panel) {
    panel.dataset.state = normalizedState;
  }

  if (status) {
    status.textContent = label;
  }

  if (label && options.silentComposer !== true) {
    setComposerStatus(label);
  }

  syncCallModeControls();
}

function bindCallModeControls() {
  const startButton = getCallModeStartButton();
  const stopButton = getCallModeStopButton();
  const endButton = getCallModeEndButton();

  if (startButton && startButton.dataset.callModeBound !== "true") {
    startButton.dataset.callModeBound = "true";
    startButton.addEventListener("click", () => {
      void startCallModeTurn();
    });
  }

  if (stopButton && stopButton.dataset.callModeBound !== "true") {
    stopButton.dataset.callModeBound = "true";
    stopButton.addEventListener("click", () => {
      setCallModeState(CALL_MODE_STATES.MUTED_STOPPED);
      stopVoiceRecording();
    });
  }

  if (endButton && endButton.dataset.callModeBound !== "true") {
    endButton.dataset.callModeBound = "true";
    endButton.addEventListener("click", () => {
      endCallMode();
    });
  }
}

function syncCallModeControls() {
  const panel = getCallModePanel();
  const startButton = getCallModeStartButton();
  const stopButton = getCallModeStopButton();
  const endButton = getCallModeEndButton();
  const config = getVoiceConfig();
  const voiceInputEnabled = config.voiceInputEnabled === true;
  const spokenRepliesEnabled = config.spokenRepliesEnabled === true;
  const webCallEnabled = config.webCallEnabled === true;
  const shouldShow = isPageMode() && voiceInputEnabled && spokenRepliesEnabled && webCallEnabled;
  const unavailableMessage = shouldShow ? getVoiceUnavailableMessage() : "";
  const busy = voiceTranscriptRequestActive
    || [
      CALL_MODE_STATES.REQUESTING,
      CALL_MODE_STATES.LISTENING,
      CALL_MODE_STATES.TRANSCRIBING,
      CALL_MODE_STATES.THINKING,
      CALL_MODE_STATES.SPEAKING,
      CALL_MODE_STATES.MUTED_STOPPED,
    ].includes(callModeState);

  bindCallModeControls();

  if (panel) {
    panel.hidden = !shouldShow;
    panel.setAttribute("aria-label", assistantT("assistant.callTitle"));
  }

  if (!shouldShow) {
    callModeActive = false;
    return;
  }

  if (unavailableMessage && !callModeActive) {
    const status = getCallModeStatus();
    if (status) {
      status.textContent = unavailableMessage;
    }
    panel?.setAttribute("data-state", CALL_MODE_STATES.UNAVAILABLE);
  } else if (getCallModeStatus() && !trimText(getCallModeStatus().textContent)) {
    setCallModeState(callModeState, "", { silentComposer: true });
  }

  if (startButton) {
    startButton.hidden = callModeActive && busy;
    startButton.disabled = Boolean(unavailableMessage || busy);
    startButton.textContent = assistantT("assistant.callStart");
    startButton.setAttribute("aria-label", assistantT("assistant.callStart"));
  }

  if (stopButton) {
    stopButton.hidden = !(callModeActive && callModeState === CALL_MODE_STATES.LISTENING && voiceRecorder);
    stopButton.disabled = stopButton.hidden;
    stopButton.textContent = assistantT("assistant.callStopListening");
    stopButton.setAttribute("aria-label", assistantT("assistant.callStopListening"));
  }

  if (endButton) {
    endButton.hidden = !callModeActive;
    endButton.disabled = false;
    endButton.textContent = assistantT("assistant.callEnd");
    endButton.setAttribute("aria-label", assistantT("assistant.callEnd"));
  }
}

async function startCallModeTurn() {
  const config = getVoiceConfig();

  if (
    !isPageMode()
    || config.voiceInputEnabled !== true
    || config.spokenRepliesEnabled !== true
    || config.webCallEnabled !== true
  ) {
    return false;
  }

  const unavailableMessage = getVoiceUnavailableMessage();
  if (unavailableMessage) {
    callModeActive = false;
    setCallModeState(CALL_MODE_STATES.UNAVAILABLE, unavailableMessage);
    return false;
  }

  callModeActive = true;
  setCallModeState(CALL_MODE_STATES.REQUESTING);
  const started = await startVoiceRecording({ source: "call" });

  if (!started && callModeActive && callModeState === CALL_MODE_STATES.REQUESTING) {
    setCallModeState(CALL_MODE_STATES.UNAVAILABLE);
  }

  return started;
}

function endCallMode() {
  callModeActive = false;
  stopCurrentVoiceAudio();

  if (voiceRecorder) {
    stopVoiceRecording({ cancel: true });
  }

  setCallModeState(CALL_MODE_STATES.STOPPED);
}

function bindVoiceInputButton() {
  const button = getVoiceInputButton();

  if (!button || button.dataset.voiceInputBound === "true") {
    return;
  }

  button.dataset.voiceInputBound = "true";
  button.addEventListener("click", () => {
    if (voiceRecorder) {
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  });
}

function buildVoiceContextParams() {
  const params = new URLSearchParams();

  if (resolvedAgentId) params.set("agent_id", resolvedAgentId);
  if (resolvedAgentKey) params.set("agent_key", resolvedAgentKey);
  if (resolvedBusinessId) params.set("business_id", resolvedBusinessId);
  if (INSTALL_ID) params.set("install_id", INSTALL_ID);
  if (WEBSITE_URL) params.set("website_url", WEBSITE_URL);
  if (getPageOrigin()) params.set("origin", getPageOrigin());
  if (getPageUrl()) params.set("page_url", getPageUrl());
  if (PUBLIC_PAGE_KEY) params.set("public_page_key", PUBLIC_PAGE_KEY);
  params.set("display_mode", DISPLAY_MODE);
  params.set("visitor_session_key", getVisitorSessionKey());

  return params;
}

function buildVoiceJsonContext() {
  return {
    agent_id: resolvedAgentId,
    agent_key: resolvedAgentKey,
    business_id: resolvedBusinessId,
    install_id: INSTALL_ID,
    website_url: WEBSITE_URL,
    page_url: getPageUrl(),
    origin: getPageOrigin(),
    public_page_key: PUBLIC_PAGE_KEY,
    display_mode: DISPLAY_MODE,
    visitor_session_key: getVisitorSessionKey(),
  };
}

function setVoiceInputState(state, message = "") {
  const button = getVoiceInputButton();
  const inputArea = document.querySelector(".input-area");
  const normalizedState = trimText(state);
  voiceInputStatusState = normalizedState;
  const label = message || (
    normalizedState === "listening"
      ? assistantT("assistant.voiceListening")
      : normalizedState === "processing"
        ? assistantT("assistant.voiceProcessing")
        : normalizedState === "ready"
          ? assistantT("assistant.voiceTranscriptReady")
          : normalizedState === "error"
            ? "Error"
            : assistantT("assistant.voiceTap")
  );

  if (button) {
    button.classList.toggle("is-recording", normalizedState === "listening");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  inputArea?.classList?.toggle("is-recording", normalizedState === "listening");
  if (normalizedState) {
    setComposerStatus(label);
  }
}

function syncSpeakRepliesToggle() {
  const toggle = getSpeakRepliesToggle();
  const config = getVoiceConfig();
  const enabled = config.spokenRepliesEnabled === true;

  if (!toggle) {
    return;
  }

  if (!enabled) {
    speakRepliesActive = false;
    speakRepliesUserChanged = false;
  } else if (!speakRepliesUserChanged && config.autoPlaySpokenReplies === true) {
    speakRepliesActive = true;
  }

  toggle.hidden = !enabled;
  toggle.setAttribute("aria-pressed", speakRepliesActive ? "true" : "false");
  toggle.textContent = speakRepliesActive
    ? assistantT("assistant.voiceSpeakRepliesOn")
    : assistantT("assistant.voiceSpeakRepliesOff");
}

function syncVoiceControls() {
  bindVoiceInputButton();
  const config = getVoiceConfig();
  const micButton = getVoiceInputButton();
  const voiceControls = document.getElementById("voice-controls");
  const disclosure = document.getElementById("voice-disclosure");
  const voiceInputEnabled = config.voiceInputEnabled !== false;
  const spokenRepliesEnabled = config.spokenRepliesEnabled === true;
  const supportsVoice = browserSupportsVoiceInput();
  const unavailableMessage = getVoiceUnavailableMessage();
  const chatReady = widgetPhase === WIDGET_PHASES.CHAT;

  if (micButton) {
    micButton.hidden = !voiceInputEnabled;
    micButton.disabled = !voiceInputEnabled || !supportsVoice || !chatReady || voiceTranscriptRequestActive;
    if (voiceInputEnabled && unavailableMessage) {
      micButton.setAttribute("aria-label", unavailableMessage);
      micButton.setAttribute("title", unavailableMessage);
    } else if (!voiceRecorder && voiceInputStatusState !== "error") {
      micButton.setAttribute("aria-label", assistantT("assistant.voiceTap"));
      micButton.setAttribute("title", assistantT("assistant.voiceTap"));
    }
  }

  if (voiceControls) {
    voiceControls.hidden = !voiceInputEnabled && !spokenRepliesEnabled;
  }

  if (disclosure) {
    disclosure.hidden = !voiceInputEnabled && !spokenRepliesEnabled;
  }

  syncSpeakRepliesToggle();
  syncCallModeControls();
}

function stopCurrentVoiceAudio() {
  if (currentVoiceAudio) {
    currentVoiceAudio.pause();
    currentVoiceAudio.currentTime = 0;
  }

  if (currentVoiceButton) {
    currentVoiceButton.textContent = assistantT("assistant.voicePlayReply");
    currentVoiceButton.setAttribute("aria-label", assistantT("assistant.voicePlayReply"));
    currentVoiceButton.closest?.(".message")?.classList.remove("is-speaking");
  }

  if (currentVoiceUrl && !voiceReplyAudioCacheHasUrl(currentVoiceUrl)) {
    URL.revokeObjectURL(currentVoiceUrl);
  }

  currentVoiceAudio = null;
  currentVoiceButton = null;
  currentVoiceUrl = "";
}

function voiceReplyAudioCacheHasUrl(url) {
  return Array.from(voiceReplyAudioCache.values()).includes(url);
}

function getSpeechAuthorizationForMessage(key) {
  const normalizedKey = buildScopedVoiceMessageKey(key);
  const authorization = normalizedKey ? voiceSpeechAuthorizations.get(normalizedKey) : null;

  if (!authorization?.token) {
    const error = new Error(assistantT("assistant.voiceSpokenCouldNotPlay"));
    error.code = "speech_authorization_missing";
    throw error;
  }

  return authorization;
}

async function getSpeechAudioUrl(text, key) {
  const messageKey = trimText(key) || buildAssistantMessageKey(text);
  const cacheKey = buildScopedVoiceMessageKey(messageKey);
  if (voiceReplyAudioCache.has(cacheKey)) {
    return voiceReplyAudioCache.get(cacheKey);
  }

  const speechAuthorization = getSpeechAuthorizationForMessage(messageKey);
  const response = await fetch("/api/voice/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...buildVoiceJsonContext(),
      text,
      voice: getVoiceConfig().voice,
      speech_token: speechAuthorization.token,
    }),
  });

  if (!response.ok) {
    const error = new Error(getVoiceApiFailureMessage(
      response.status,
      "assistant.voiceSpokenCouldNotPlay"
    ));
    error.statusCode = response.status;
    error.code = "speech_response_failed";
    throw error;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  voiceReplyAudioCache.set(cacheKey, url);
  return url;
}

async function playSpokenReply(text, button, options = {}) {
  const replyText = trimText(text);

  if (!replyText || !getVoiceConfig().spokenRepliesEnabled) {
    return false;
  }

  if (currentVoiceButton === button && currentVoiceAudio) {
    stopCurrentVoiceAudio();
    setComposerStatus(assistantT("assistant.voiceSpokenStopped"));
    options.onPlaybackEnd?.(false);
    return false;
  }

  stopCurrentVoiceAudio();
  const message = button?.closest?.(".message") || null;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = assistantT("assistant.voiceSpeaking");
    }
    const url = await getSpeechAudioUrl(replyText, options.key);
    const AudioCtor = window.Audio || globalThis.Audio;
    if (typeof AudioCtor !== "function") {
      const error = new Error(assistantT("assistant.voiceAudioUnsupported"));
      error.code = "audio_unsupported";
      throw error;
    }
    const audio = new AudioCtor(url);
    currentVoiceAudio = audio;
    currentVoiceButton = button || null;
    currentVoiceUrl = url;
    if (button) {
      button.disabled = false;
      button.textContent = assistantT("assistant.voiceStopReply");
      button.setAttribute("aria-label", assistantT("assistant.voiceStopReply"));
    }
    message?.classList.add("is-speaking");
    setComposerStatus(assistantT("assistant.voiceSpeaking"));
    audio.addEventListener("ended", () => {
      if (currentVoiceAudio === audio) {
        stopCurrentVoiceAudio();
        setComposerStatus(assistantT("assistant.askAnythingElse"));
        options.onPlaybackEnd?.(true);
      }
    });
    audio.addEventListener("error", () => {
      if (currentVoiceAudio === audio) {
        stopCurrentVoiceAudio();
        setComposerStatus(assistantT("assistant.voiceSpokenCouldNotPlay"));
        options.onPlaybackEnd?.(false);
      }
    });
    await audio.play();
    options.onPlaybackStart?.();
    return true;
  } catch (error) {
    console.warn("Vonza speech playback failed:", error);
    if (button) {
      button.disabled = false;
      button.textContent = assistantT("assistant.voicePlayReply");
      button.setAttribute("aria-label", assistantT("assistant.voicePlayReply"));
    }
    message?.classList.remove("is-speaking");
    setComposerStatus(getSpeechPlaybackFailureMessage(error, options));
    options.onPlaybackEnd?.(false);
    return false;
  }
}

function getVoiceReplyButtonMarkup(messageKey) {
  if (!getVoiceConfig().spokenRepliesEnabled || !trimText(messageKey)) {
    return "";
  }

  return `
    <button class="voice-reply-button" type="button" data-voice-reply-button data-voice-message-key="${escapeHtml(messageKey)}" aria-label="${escapeHtml(assistantT("assistant.voicePlayReply"))}">${escapeHtml(assistantT("assistant.voicePlayReply"))}</button>
  `;
}

async function transcribeVoiceBlob(blob, durationMs) {
  const params = buildVoiceContextParams();
  params.set("duration_ms", String(Math.max(1, Math.round(durationMs))));

  const response = await fetch(`/api/voice/transcribe?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      "X-Voice-Duration-Ms": String(Math.max(1, Math.round(durationMs))),
    },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getVoiceApiFailureMessage(response.status));
  }

  return data;
}

function clearVoiceRecordingTimer() {
  if (voiceRecordingStopTimer) {
    clearTimeout(voiceRecordingStopTimer);
    voiceRecordingStopTimer = 0;
  }
}

function stopVoiceRecording(options = {}) {
  if (!voiceRecorder) {
    return;
  }

  voiceRecordingCancelRequested = options.cancel === true;
  clearVoiceRecordingTimer();
  if (voiceRecorder.state !== "inactive") {
    voiceRecorder.stop();
  }
}

async function startVoiceRecording(options = {}) {
  if (voiceRecorder) {
    stopVoiceRecording();
    return false;
  }

  const unavailableMessage = getVoiceUnavailableMessage();
  if (unavailableMessage) {
    setVoiceInputState("error", unavailableMessage);
    if (options.source === "call") {
      setCallModeState(CALL_MODE_STATES.UNAVAILABLE, unavailableMessage);
    }
    syncVoiceControls();
    return false;
  }

  if (!hasChosenVisitorIdentity()) {
    renderWidgetPhase();
    setComposerStatus(assistantT("assistant.voiceChooseIdentity"));
    if (options.source === "call") {
      setCallModeState(CALL_MODE_STATES.UNAVAILABLE, assistantT("assistant.voiceChooseIdentity"));
    }
    return false;
  }

  try {
    voiceRecordingSource = options.source === "call" ? "call" : "";
    voiceRecordingCancelRequested = false;
    if (voiceRecordingSource === "call") {
      setCallModeState(CALL_MODE_STATES.REQUESTING);
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getPreferredRecordingMimeType();
    const MediaRecorderCtor = window.MediaRecorder;
    voiceRecorderChunks = [];
    voiceRecordingStartedAt = Date.now();
    try {
      voiceRecorder = mimeType
        ? new MediaRecorderCtor(stream, { mimeType })
        : new MediaRecorderCtor(stream);
    } catch (recorderError) {
      const tracks = stream.getTracks?.() || [];
      tracks.forEach((track) => track.stop?.());
      throw recorderError;
    }
    voiceRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        voiceRecorderChunks.push(event.data);
      }
    });
    voiceRecorder.addEventListener("stop", async () => {
      const stoppedRecorder = voiceRecorder;
      const durationMs = Math.max(1, Date.now() - voiceRecordingStartedAt);
      const tracks = stoppedRecorder?.stream?.getTracks?.() || stream.getTracks?.() || [];
      tracks.forEach((track) => track.stop?.());
      voiceRecorder = null;
      clearVoiceRecordingTimer();
      await handleVoiceRecordingComplete(durationMs, mimeType || stoppedRecorder?.mimeType || "audio/webm");
    });
    voiceRecorder.start();
    setVoiceInputState("listening", assistantT("assistant.voiceListening"));
    if (voiceRecordingSource === "call") {
      setCallModeState(CALL_MODE_STATES.LISTENING);
    }
    syncVoiceControls();
    voiceRecordingStopTimer = setTimeout(stopVoiceRecording, VOICE_RECORDING_MAX_MS);
    return true;
  } catch (error) {
    console.warn("Vonza microphone recording failed:", error);
    voiceRecorder = null;
    voiceRecordingSource = "";
    voiceRecordingCancelRequested = false;
    clearVoiceRecordingTimer();
    setVoiceInputState("error", getMicrophoneStartErrorMessage(error));
    if (options.source === "call") {
      setCallModeState(CALL_MODE_STATES.UNAVAILABLE, getMicrophoneStartErrorMessage(error));
    }
    syncVoiceControls();
    return false;
  }
}

async function handleVoiceRecordingComplete(durationMs, fallbackMimeType) {
  const input = document.getElementById("input");
  const chunks = voiceRecorderChunks.slice();
  const recordingSource = voiceRecordingSource;
  const recordingCancelled = voiceRecordingCancelRequested;
  voiceRecorderChunks = [];
  voiceRecordingSource = "";
  voiceRecordingCancelRequested = false;

  if (recordingCancelled) {
    syncVoiceControls();
    return;
  }

  if (!chunks.length) {
    setVoiceInputState("error", assistantT("assistant.voiceNoSpeechRecorded"));
    if (recordingSource === "call") {
      callModeActive = false;
      setCallModeState(CALL_MODE_STATES.UNAVAILABLE, assistantT("assistant.voiceNoSpeechRecorded"));
    }
    syncVoiceControls();
    return;
  }

  voiceTranscriptRequestActive = true;
  setVoiceInputState("processing", assistantT("assistant.voiceProcessing"));
  if (recordingSource === "call") {
    setCallModeState(CALL_MODE_STATES.TRANSCRIBING);
  }
  syncVoiceControls();

  try {
    const blobType = chunks.find((chunk) => trimText(chunk.type))?.type || fallbackMimeType || "audio/webm";
    const blob = new Blob(chunks, { type: blobType });
    if (!blob.size) {
      throw new Error(assistantT("assistant.voiceNoSpeechRecorded"));
    }
    const result = await transcribeVoiceBlob(blob, durationMs);
    const transcript = trimText(result.text);

    if (!transcript) {
      throw new Error(assistantT("assistant.voiceNoSpeechDetected"));
    }

    if (recordingSource === "call") {
      setCallModeState(CALL_MODE_STATES.THINKING);
      const result = await sendMessage(transcript, {
        playSpokenReply: true,
        onSpokenReplyStart: () => {
          if (callModeActive) {
            setCallModeState(CALL_MODE_STATES.SPEAKING);
          }
        },
        onSpokenReplyEnd: (played) => {
          if (callModeActive) {
            setCallModeState(
              played ? CALL_MODE_STATES.READY : CALL_MODE_STATES.UNAVAILABLE,
              played ? "" : assistantT("assistant.voiceSpokenCouldNotPlay")
            );
          }
        },
      });

      if (!result?.ok) {
        callModeActive = false;
        setCallModeState(CALL_MODE_STATES.UNAVAILABLE, assistantT("assistant.requestFailedStatus"));
      } else if (!result.spokenReplyAttempted) {
        setCallModeState(CALL_MODE_STATES.UNAVAILABLE, assistantT("assistant.voiceSpokenCouldNotPlay"));
      }
      return;
    }

    if (input) {
      input.value = transcript;
      input.focus();
    }
    setVoiceInputState("ready", assistantT("assistant.voiceTranscriptReady"));
    if (getVoiceConfig().autoSendTranscript) {
      await sendMessage(transcript);
    }
  } catch (error) {
    console.warn("Vonza voice transcription failed:", error);
    setVoiceInputState("error", error.message || assistantT("assistant.voiceFailed"));
    if (recordingSource === "call") {
      callModeActive = false;
      setCallModeState(CALL_MODE_STATES.UNAVAILABLE, error.message || assistantT("assistant.voiceFailed"));
    }
  } finally {
    voiceTranscriptRequestActive = false;
    syncVoiceControls();
  }
}

function queueEmbeddedHeightUpdate() {
  if (!EMBEDDED_MODE || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  if (embeddedHeightFrame) {
    window.cancelAnimationFrame?.(embeddedHeightFrame);
  }

  embeddedHeightFrame = window.requestAnimationFrame(() => {
    embeddedHeightFrame = 0;
    postEmbeddedHeightUpdate();
  });
}

function postEmbeddedHeightUpdate() {
  if (!EMBEDDED_MODE || !window.parent || window.parent === window) {
    return;
  }

  const height = Math.ceil(Math.max(
    document.documentElement?.scrollHeight || 0,
    document.body?.scrollHeight || 0,
    document.querySelector(".chat-container")?.scrollHeight || 0
  ));

  if (!height) {
    return;
  }

  window.parent.postMessage({
    type: "vonza:embedded-height",
    source: "vonza-assistant",
    height,
  }, "*");
}

function applyBrandMark(markElement, logoElement, textElement, customLogoUrl, fallbackCharacter) {
  if (!markElement || !logoElement || !textElement) {
    return;
  }

  textElement.textContent = fallbackCharacter;

  if (customLogoUrl) {
    logoElement.src = customLogoUrl;
    logoElement.hidden = false;
    markElement.classList.add("has-custom-logo");
    return;
  }

  logoElement.removeAttribute("src");
  logoElement.hidden = true;
  markElement.classList.remove("has-custom-logo");
}

function setFullPageDesignClass(prefix, value, allowedValues) {
  allowedValues.forEach((token) => {
    document.documentElement.classList.remove(`${prefix}-${token}`);
  });
  document.documentElement.classList.add(`${prefix}-${value}`);
}

function syncFullPageDesignVideo(design) {
  let video = document.getElementById("full-page-design-video-bg");
  const shouldShowVideo =
    isCanvasPageMode()
    && !isSectionBackgroundScope()
    && design.backgroundType === "video"
    && design.backgroundVideoUrl;

  if (!shouldShowVideo) {
    video?.remove?.();
    return;
  }

  if (!video) {
    video = document.createElement("video");
    video.id = "full-page-design-video-bg";
    video.className = "full-page-design-video-bg";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("error", () => {
      video.hidden = true;
    });
    document.body.appendChild(video);
  }

  if (video.src !== design.backgroundVideoUrl) {
    video.src = design.backgroundVideoUrl;
  }
  if (design.backgroundImageUrl) {
    video.setAttribute("poster", design.backgroundImageUrl);
  } else {
    video.removeAttribute("poster");
  }

  video.hidden = false;
}

function applyFullPageDesign(config = widgetConfig) {
  const design = getFullPageConfig(config).design;
  const root = document.documentElement;
  const designStyleTargets = [root, document.body].filter(Boolean);

  if (!isCanvasPageMode()) {
    syncFullPageDesignVideo({ ...DEFAULT_FULL_PAGE_DESIGN, backgroundType: "color" });
    return;
  }

  setFullPageDesignClass("full-page-design-preset", design.preset, FULL_PAGE_DESIGN_PRESETS);
  setFullPageDesignClass("full-page-design-bg", design.backgroundType, FULL_PAGE_BACKGROUND_TYPES);
  setFullPageDesignClass("full-page-design-text", design.textTheme, FULL_PAGE_TEXT_THEMES);
  setFullPageDesignClass("full-page-design-composer", design.composerStyle, FULL_PAGE_COMPOSER_STYLES);
  setFullPageDesignClass("full-page-design-chip", design.chipStyle, FULL_PAGE_CHIP_STYLES);
  setFullPageDesignClass("full-page-design-status", design.statusStyle, FULL_PAGE_STATUS_STYLES);
  root.classList.toggle("full-page-design-disable-mobile-video", design.disableVideoOnMobile);
  designStyleTargets.forEach((target) => {
    target.style.setProperty("--canvas-design-bg", design.backgroundColor);
    target.style.setProperty("--canvas-design-gradient-to", design.backgroundGradientTo);
    target.style.setProperty("--canvas-design-overlay", design.backgroundOverlayColor);
    target.style.setProperty("--canvas-design-overlay-opacity", String(design.backgroundOverlayOpacity));
    target.style.setProperty("--canvas-design-blur", `${design.backgroundBlur}px`);
    target.style.setProperty("--canvas-design-position", design.backgroundFocalPoint);
    target.style.setProperty(
      "--canvas-design-image",
      design.backgroundImageUrl ? `url("${design.backgroundImageUrl.replace(/"/g, "%22")}")` : "none"
    );
  });

  syncFullPageDesignVideo(design);
}

function applyWidgetConfig(config = {}) {
  widgetConfig = normalizeWidgetConfig(config);
  applyPublicAssistantLanguage(widgetConfig);
  if (getVoiceConfig(widgetConfig).spokenRepliesEnabled !== true) {
    speakRepliesActive = false;
    speakRepliesUserChanged = false;
  } else if (!speakRepliesUserChanged && getVoiceConfig(widgetConfig).autoPlaySpokenReplies === true) {
    speakRepliesActive = true;
  }

  const brandMark = document.querySelector(".brand-mark");
  const welcomeBrandMark = document.querySelector(".welcome-brand-mark");
  const brandLogo = document.getElementById("brand-mark-logo");
  const welcomeBrandLogo = document.getElementById("welcome-brand-logo");
  const fullPageConfig = getFullPageConfig(widgetConfig);
  const configuredPageAccentColor = normalizeFullPageAccentColor(widgetConfig._configuredFullPageAccentColor);
  const customLogoUrl = trimText(isPageMode() ? fullPageConfig.logoUrl || widgetConfig.widgetLogoUrl : widgetConfig.widgetLogoUrl);
  const assistantMark = getAssistantMark(widgetConfig.assistantName);
  const pageAccentColor = isPageMode() ? configuredPageAccentColor || fullPageConfig.accentColor : "";
  const brandPrimary = normalizeFullPageAccentColor(
    pageAccentColor || widgetConfig.primaryColor,
    DEFAULT_WIDGET_CONFIG.primaryColor
  ) || DEFAULT_WIDGET_CONFIG.primaryColor;
  const brandSecondary = isPageMode() && EMBEDDED_MODE && configuredPageAccentColor
    ? brandPrimary
    : normalizeFullPageAccentColor(widgetConfig.secondaryColor, DEFAULT_WIDGET_CONFIG.secondaryColor) || DEFAULT_WIDGET_CONFIG.secondaryColor;
  const sendButton = document.getElementById("send-button");
  const poweredBy = document.getElementById("powered-by");
  const welcomeBadge = document.getElementById("welcome-badge");
  const welcomeTitle = document.getElementById("welcome-title");
  const welcomeCopy = document.getElementById("welcome-copy");

  document.title = widgetConfig.assistantName;
  document.documentElement.style.setProperty("--brand-primary", brandPrimary);
  document.documentElement.style.setProperty("--brand-secondary", brandSecondary);
  document.documentElement.style.setProperty("--canvas-send-color", isCanvasPageMode()
    ? configuredPageAccentColor || "#111827"
    : brandPrimary);
  document.documentElement.style.setProperty("--canvas-accent-color", configuredPageAccentColor || brandPrimary);
  applyFullPageDesign(widgetConfig);
  if (isPageMode()) {
    document.documentElement.style.setProperty("--brand-ink", `color-mix(in srgb, ${brandPrimary} 72%, #14201f 28%)`);
    document.documentElement.style.setProperty("--brand-surface", `color-mix(in srgb, ${brandPrimary} 9%, #ffffff 91%)`);
    document.documentElement.style.setProperty("--brand-surface-strong", `color-mix(in srgb, ${brandPrimary} 16%, #ffffff 84%)`);
  }
  document.getElementById("assistant-name").textContent = widgetConfig.assistantName;
  document.getElementById("welcome-assistant-name").textContent = widgetConfig.assistantName;
  document.getElementById("launcher-text").textContent = widgetConfig.launcherText;
  document.getElementById("welcome-message").textContent = widgetConfig.welcomeMessage;
  document.getElementById("intro-avatar").textContent = assistantMark;
  applyBrandMark(
    brandMark,
    brandLogo,
    document.getElementById("brand-mark-v"),
    customLogoUrl,
    assistantMark
  );
  applyBrandMark(
    welcomeBrandMark,
    welcomeBrandLogo,
    document.getElementById("welcome-brand-v"),
    customLogoUrl,
    assistantMark
  );
  if (sendButton) {
    const sendLabel = assistantT("assistant.sendTo", { name: widgetConfig.assistantName });
    sendButton.setAttribute("aria-label", sendLabel);
    sendButton.setAttribute("title", sendLabel);
  }
  if (poweredBy) {
    poweredBy.textContent = assistantT("assistant.poweredHelp");
  }
  if (!isPageMode()) {
    if (welcomeBadge) {
      welcomeBadge.textContent = assistantT("assistant.chooseContinue");
    }
    if (welcomeTitle) {
      welcomeTitle.textContent = assistantT("assistant.defaultWelcome");
    }
    if (welcomeCopy) {
      welcomeCopy.textContent = assistantT("assistant.continueChoice");
    }
  }
  syncPageAssistantHeader({ config: widgetConfig });

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
  }

  if (hasChosenVisitorIdentity()) {
    continueIntoChat(visitorIdentity, {
      persist: false,
      track: false,
      capture: false,
    });
  } else {
    setComposerStatus(assistantT("assistant.composerStatus"));
  }
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", widgetConfig.assistantName);
  syncWidgetPhaseWithIdentity(visitorIdentity);
  syncPageIdentityInline();
  syncVoiceControls();
}

async function loadWidgetBootstrap() {
  if (!hasAssistantConfig()) {
    if (isPageMode()) {
      setPageShellState("unavailable", {
        title: assistantT("assistant.unavailable.title"),
        copy: assistantT("assistant.unavailable.copy"),
      });
      return;
    }
    applyWidgetConfig({
      ...DEFAULT_WIDGET_CONFIG,
      welcomeMessage: assistantT("assistant.notConfigured"),
    });
    setComposerStatus(assistantT("assistant.setupFirst"));
    return;
  }

  const bootstrapUrl = new URL("/widget/bootstrap", window.location.origin);

  if (INSTALL_ID) bootstrapUrl.searchParams.set("install_id", INSTALL_ID);
  if (AGENT_ID) bootstrapUrl.searchParams.set("agent_id", AGENT_ID);
  if (AGENT_KEY) bootstrapUrl.searchParams.set("agent_key", AGENT_KEY);
  if (BUSINESS_ID) bootstrapUrl.searchParams.set("business_id", BUSINESS_ID);
  if (WEBSITE_URL) bootstrapUrl.searchParams.set("website_url", WEBSITE_URL);
  if (getPageOrigin()) bootstrapUrl.searchParams.set("origin", getPageOrigin());
  if (getPageUrl()) bootstrapUrl.searchParams.set("page_url", getPageUrl());
  if (PUBLIC_PAGE_KEY) bootstrapUrl.searchParams.set("k", PUBLIC_PAGE_KEY);
  bootstrapUrl.searchParams.set("mode", DISPLAY_MODE);

  try {
    const response = await fetch(bootstrapUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || "Failed to load assistant configuration");
      error.statusCode = response.status;
      throw error;
    }

    if (isPageMode() && (!data.agent?.id || !data.widgetConfig)) {
      const error = new Error("Assistant is not available");
      error.statusCode = 404;
      throw error;
    }

    pageBusinessContext = data.business || null;
    applyWidgetConfig(data.widgetConfig || {});
    syncPageAssistantHeader({
      business: pageBusinessContext,
      config: widgetConfig,
    });
    resolvedAgentId = trimText(data.agent?.id || resolvedAgentId);
    resolvedAgentKey = trimText(data.agent?.publicAgentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.business?.id || resolvedBusinessId);
    if (isPageMode() && !hasChosenVisitorIdentity()) {
      visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    }
    if (hasChosenVisitorIdentity()) {
      continueIntoChat(visitorIdentity, {
        persist: false,
        track: false,
        capture: false,
      });
    } else {
      setComposerStatus(assistantT("assistant.composerStatus"));
    }
    setPageShellState("ready");
    focusComposerInputIfSafe();
    await detectConversionOutcomesOnLoad();
  } catch (error) {
    console.warn("Vonza assistant bootstrap unavailable", {
      statusCode: error?.statusCode || null,
    });
    if (isPageMode()) {
      setPageShellState("unavailable", getFriendlyUnavailableState(error));
      return;
    }
    applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
    setComposerStatus(assistantT("assistant.composerStatus"));
  }
}

function buildReplyFeedbackMarkup(messageKey, options = {}) {
  if (!trimText(messageKey)) {
    return "";
  }

  return `
    <div class="reply-feedback" data-reply-feedback="${escapeHtml(messageKey)}" data-reply-question="${escapeHtml(options.question || "")}" data-reply-answer="${escapeHtml(options.answer || "")}">
      <span data-reply-feedback-label>Was this helpful?</span>
      <button type="button" data-reply-feedback-rating="helpful" aria-label="Mark this reply helpful">Helpful</button>
      <button type="button" data-reply-feedback-open-reasons aria-label="Mark this reply not helpful">Not helpful</button>
      <form class="reply-feedback-reasons" data-reply-feedback-reasons hidden>
        <label>
          <span>What should be better?</span>
          <select name="reason">
            <option value="incorrect">Incorrect</option>
            <option value="missing_details">Missing details</option>
            <option value="too_vague">Too vague</option>
            <option value="did_not_answer">Did not answer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Optional note</span>
          <input name="note" type="text" maxlength="600" autocomplete="off">
        </label>
        <button type="button" data-reply-feedback-rating="not_helpful">Submit</button>
      </form>
    </div>
  `;
}

function getCanvasTopicLabelForPrompt(prompt = "") {
  const normalizedPrompt = trimText(prompt).toLowerCase();

  if (!isCanvasPageMode() || !normalizedPrompt) {
    return "";
  }

  const item = getQuickReplyItems().find((entry) => trimText(entry.prompt).toLowerCase() === normalizedPrompt);
  return trimText(item?.label);
}

function canShowCanvasQuoteAction() {
  return isCanvasPageMode()
    && getPageActionCards(widgetConfig).some((card) => card.type === "quote" && trimText(card.prompt));
}

function buildCanvasAnswerActionsMarkup() {
  if (!isCanvasPageMode()) {
    return "";
  }

  return `
    <div class="canvas-answer-actions" aria-label="${escapeHtml(assistantT("assistant.nextActionsLabel"))}">
      <button type="button" data-canvas-answer-action="ask">${escapeHtml(assistantT("assistant.canvasAsk"))}</button>
      <button type="button" data-canvas-answer-action="contact">${escapeHtml(assistantT("assistant.canvasContact"))}</button>
      ${canShowCanvasQuoteAction() ? `<button type="button" data-canvas-answer-action="quote">${escapeHtml(assistantT("assistant.canvasQuote"))}</button>` : ""}
    </div>
  `;
}

function appendMessage(chat, role, text, options = {}) {
  const wrapper = document.createElement("div");
  const canvasVisibleMessageCount = getCanvasVisibleMessageCount(chat);
  const isCanvasAnswer = isCanvasPageMode()
    && role === "bot"
    && !options.typing
    && !options.error
    && trimText(text);
  const isCanvasLoading = isCanvasPageMode()
    && role === "bot"
    && options.typing;
  wrapper.className = `message ${role}${options.typing ? " typing" : ""}${isCanvasAnswer ? " canvas-answer-message" : ""}${isCanvasLoading ? " canvas-answer-loading" : ""}`;
  if (options.error) {
    wrapper.classList.add("error");
  }
  if (isCanvasLoading) {
    wrapper.setAttribute("role", "status");
    wrapper.setAttribute("aria-live", "polite");
    setCanvasAnsweringState(true);
  }
  const voiceMessageKey =
    role === "bot" && !options.typing && !options.error && trimText(text)
      ? trimText(options.voiceKey || options.feedbackKey) || buildAssistantMessageKey(text)
      : "";
  if (voiceMessageKey) {
    wrapper.dataset.voiceMessageKey = voiceMessageKey;
    wrapper.dataset.voiceReplyText = text || "";
  }

  const avatar = role === "user" ? assistantT("assistant.you") : getAssistantMark();
  const label = role === "user" ? assistantT("assistant.you") : widgetConfig.assistantName;
  const body = options.typing
    ? `${isCanvasLoading ? `<span class="canvas-answering-text">${escapeHtml(assistantT("assistant.answering"))}</span>` : ""}<div class="typing-dots"><span></span><span></span><span></span></div>`
    : `<div class="vonza-message-body">${
        role === "bot"
          ? formatAssistantMessageHtml(text)
          : formatMessageParagraph(String(text || "").replace(/\r/g, "").split("\n"))
      }</div>`;

  wrapper.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble">
      <p class="message-label">${escapeHtml(label)}</p>
      ${isCanvasAnswer && trimText(options.canvasTopicLabel) ? `<p class="canvas-answer-topic">${escapeHtml(trimText(options.canvasTopicLabel))}</p>` : ""}
      ${body}
      ${role === "bot" && options.feedbackKey ? buildReplyFeedbackMarkup(options.feedbackKey, {
        question: options.feedbackQuestion || "",
        answer: text || "",
      }) : ""}
      ${voiceMessageKey ? getVoiceReplyButtonMarkup(voiceMessageKey) : ""}
      ${isCanvasAnswer ? buildCanvasAnswerActionsMarkup() : ""}
    </div>
  `;

  chat.appendChild(wrapper);
  const shouldAnchorFirstCanvasAnswer = isCanvasPageMode()
    && (isCanvasAnswer || isCanvasLoading)
    && canvasVisibleMessageCount <= 1;
  chat.scrollTop = shouldAnchorFirstCanvasAnswer ? 0 : chat.scrollHeight;
  updateCanvasConversationState();
  queueEmbeddedHeightUpdate();
  return wrapper;
}

async function submitReplyFeedback(messageKey, rating, options = {}) {
  const normalizedMessageKey = trimText(messageKey);
  const normalizedRating = trimText(rating).toLowerCase();
  const dedupeKey = `${getVisitorSessionKey()}::${normalizedMessageKey}`;

  if (!normalizedMessageKey || submittedReplyFeedbackKeys.has(dedupeKey)) {
    return null;
  }

  submittedReplyFeedbackKeys.add(dedupeKey);

  try {
    const response = await fetch("/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        public_page_key: PUBLIC_PAGE_KEY,
        display_mode: DISPLAY_MODE,
        session_key: getVisitorSessionKey(),
        assistant_message_key: normalizedMessageKey,
        rating: normalizedRating,
        reason: options.reason || "",
        note: options.note || "",
        user_question: options.userQuestion || "",
        assistant_answer: options.assistantAnswer || "",
        source_route: document.body?.classList?.contains("embedded") ? "embedded_assistant" : isPageMode() ? "public_page_assistant" : "public_widget",
        message_context: {
          conversation_index: conversationHistory.length,
          user_question: options.userQuestion || "",
          assistant_answer: options.assistantAnswer || "",
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Feedback request failed");
    }

    setComposerStatus(normalizedRating === "helpful" ? assistantT("assistant.feedbackHelpful") : assistantT("assistant.feedbackReview"));
    return data;
  } catch (error) {
    submittedReplyFeedbackKeys.delete(dedupeKey);
    console.warn("Vonza reply feedback failed:", error);
    setComposerStatus(assistantT("assistant.feedbackFailed"));
    return null;
  }
}

async function sendMessage(messageOverride = "", options = {}) {
  const input = document.getElementById("input");
  const chat = document.getElementById("chat");
  const button = document.getElementById("send-button");

  const message = trimText(messageOverride || input.value);
  const historySnapshot = conversationHistory.slice(-6);
  const canvasTopicLabel = isCanvasPageMode()
    ? trimText(pendingCanvasTopicLabel) || getCanvasTopicLabelForPrompt(message)
    : "";
  pendingCanvasTopicLabel = "";

  if (!message) return { ok: false, reason: "empty" };

  stopVoiceRecording();
  stopCurrentVoiceAudio();

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
  }

  if (!hasChosenVisitorIdentity()) {
    renderWidgetPhase();
    setComposerStatus(assistantT("assistant.chooseBeforeSend"));
    return { ok: false, reason: "identity_required" };
  }

  if (!hasAssistantConfig()) {
    console.error(
      "Vonza assistant configuration error: missing install_id, agent_id, agent_key, business_id, and website_url"
    );
    appendMessage(
      chat,
      "bot",
      assistantT("assistant.notConfigured"),
      { error: true }
    );
    setComposerStatus(assistantT("assistant.setupFirst"));
    return { ok: false, reason: "not_configured" };
  }

  appendMessage(chat, "user", message);
  lastLeadReferenceMessage = message;
  quickRepliesDismissed = true;
  input.value = "";
  renderQuickReplies();
  button.disabled = true;
  input.disabled = true;
  syncVoiceControls();
  setComposerStatus(assistantT("assistant.preparingReply", { name: widgetConfig.assistantName }));

  const loading = appendMessage(chat, "bot", "", { typing: true });

  try {
    const sessionKey = getVisitorSessionKey();
    void trackWidgetEvent("first_message_sent", { messageLength: message.length }, {
      scope: sessionKey,
    });
    void trackWidgetEvent("conversation_started", { messageLength: message.length }, {
      dedupeKey: `${INSTALL_ID}::conversation_started::${sessionKey}`,
    });

    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        agent_id: resolvedAgentId,
        agent_key: resolvedAgentKey,
        business_id: resolvedBusinessId,
        install_id: INSTALL_ID,
        website_url: WEBSITE_URL,
        page_url: getPageUrl(),
        origin: getPageOrigin(),
        public_page_key: PUBLIC_PAGE_KEY,
        display_mode: DISPLAY_MODE,
        visitor_session_key: sessionKey,
        history: historySnapshot,
        ...buildVisitorIdentityPayload(),
      }),
    });

    const data = await res.json();

    loading.remove();
    setCanvasAnsweringState(false);

    if (!res.ok) {
      console.error("Vonza Front Desk request failed:", data.code || res.status || "request_failed");
      appendMessage(
        chat,
        "bot",
        assistantT("assistant.requestFailed"),
        { error: true }
      );
      setComposerStatus(assistantT("assistant.requestFailedStatus"));
      return { ok: false, reason: "request_failed", status: res.status, data };
    }

    if (data.widgetConfig) {
      applyWidgetConfig(data.widgetConfig);
    }

    const feedbackKey = buildAssistantMessageKey(data.reply);
    const speechAuthorization = normalizeSpeechAuthorization(data.speech);
    const speechAuthorizationKey = buildScopedVoiceMessageKey(feedbackKey);
    if (speechAuthorization) {
      voiceSpeechAuthorizations.set(speechAuthorizationKey, speechAuthorization);
    } else {
      voiceSpeechAuthorizations.delete(speechAuthorizationKey);
    }
    const assistantMessage = appendMessage(chat, "bot", data.reply, {
      feedbackKey,
      feedbackQuestion: message,
      canvasTopicLabel,
    });
    resolvedAgentId = trimText(data.agentId || resolvedAgentId);
    resolvedAgentKey = trimText(data.agentKey || resolvedAgentKey);
    resolvedBusinessId = trimText(data.businessId || resolvedBusinessId);
    visitorIdentity = normalizeVisitorIdentityState(data.visitorIdentity || visitorIdentity);
    syncWidgetPhaseWithIdentity(visitorIdentity);
    addToHistory("user", message);
    addToHistory("assistant", data.reply);
    renderQuickReplies();
    liveLeadCapture = data.leadCapture || null;
    renderDirectRouting(data.directRouting || null);
    renderLeadCapture(liveLeadCapture, {
      force: trimText(data.directRouting?.mode) === "capture_only",
    });
    if (trimText(data.leadCapture?.state).toLowerCase() === "captured") {
      void trackWidgetEvent("contact_captured", {
        preferredChannel: trimText(data.leadCapture?.preferredChannel || ""),
        contactPresent: Boolean(trimText(data.leadCapture?.contact?.email || data.leadCapture?.contact?.phone)),
      }, {
        dedupeKey: `${INSTALL_ID}::contact_captured::${sessionKey}::${trimText(data.leadCapture?.id || "")}`,
      });
    }
    void trackWidgetEvent(
      "message_replied",
      {
        replyLength: trimText(data.reply).length,
      },
      {
        dedupeKey: `${INSTALL_ID}::message_replied::${sessionKey}::${conversationHistory.length}`,
      }
    );
    setComposerStatus(
      trimText(data.directRouting?.primaryCta?.label)
        ? assistantT("assistant.optionReady")
        : assistantT("assistant.askAnythingElse")
    );
    let spokenReplyAttempted = false;
    let spokenReplyPlayed = false;
    if (getVoiceConfig().spokenRepliesEnabled && (speakRepliesActive || options.playSpokenReply === true)) {
      const voiceButton = assistantMessage.querySelector?.("[data-voice-reply-button]") || null;
      spokenReplyAttempted = true;
      const playPromise = playSpokenReply(data.reply, voiceButton, {
        key: feedbackKey,
        auto: true,
        onPlaybackStart: options.onSpokenReplyStart,
        onPlaybackEnd: options.onSpokenReplyEnd,
      });
      if (options.awaitSpokenReply === true) {
        spokenReplyPlayed = await playPromise;
      } else {
        void playPromise;
      }
    }
    return {
      ok: true,
      data,
      reply: data.reply,
      feedbackKey,
      assistantMessage,
      speechAuthorization,
      spokenReplyAttempted,
      spokenReplyPlayed,
    };
  } catch (err) {
    console.error("Vonza assistant request failed:", err);
    loading.remove();
    setCanvasAnsweringState(false);
    appendMessage(chat, "bot", assistantT("assistant.connectionError"), { error: true });
    setComposerStatus(assistantT("assistant.connectionStatus"));
    return { ok: false, reason: "connection_error", error: err };
  } finally {
    button.disabled = false;
    input.disabled = false;
    syncVoiceControls();
    focusComposerInputIfSafe();
  }
}

document.getElementById("identity-guest-button")?.addEventListener("click", () => {
  continueIntoChat({
    mode: "guest",
  });
});

document.getElementById("identity-email-button")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.removeAttribute("hidden");
  document.getElementById("identity-name")?.focus();
  setComposerStatus("Add your email to keep this conversation connected.");
});

document.getElementById("identity-email-cancel")?.addEventListener("click", () => {
  document.getElementById("identity-email-form")?.setAttribute("hidden", "");
  setComposerStatus("Choose email or guest, then start chatting.");
});

document.getElementById("identity-email-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const identity = normalizeVisitorIdentityState({
    mode: "identified",
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!identity.email) {
    setComposerStatus("Enter a valid email address to continue with email.");
    document.getElementById("identity-email")?.focus();
    return;
  }

  continueIntoChat(identity);
  form.setAttribute("hidden", "");
});

document.getElementById("page-identity-email-button")?.addEventListener("click", () => {
  openPageIdentityContactForm();
});

function openPageIdentityContactForm() {
  const form = getPageIdentityEmailForm();

  if (!form) {
    return;
  }

  form.hidden = false;
  document.getElementById("page-identity-name")?.focus();
  setComposerStatus(assistantT("assistant.pageIdentityNote"));
}

document.getElementById("page-identity-email-cancel")?.addEventListener("click", () => {
  getPageIdentityEmailForm()?.setAttribute("hidden", "");
  setComposerStatus(assistantT("assistant.routeDismissedStatus"));
});

document.getElementById("page-identity-email-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const identity = normalizeVisitorIdentityState({
    mode: "identified",
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!identity.email) {
    setComposerStatus("Enter a valid email address to continue with email.");
    document.getElementById("page-identity-email")?.focus();
    return;
  }

  continueIntoChat(identity);
  form.setAttribute("hidden", "");
});

document.getElementById("identity-reset-button")?.addEventListener("click", () => {
  clearVisitorIdentity();
});

document.getElementById("chat")?.addEventListener("click", (event) => {
  const canvasActionButton = event.target?.closest?.("[data-canvas-answer-action]");

  if (canvasActionButton) {
    const action = trimText(canvasActionButton.dataset.canvasAnswerAction);

    if (action === "ask") {
      focusComposerInputIfSafe({ force: true });
      setComposerStatus(assistantT("assistant.askAnythingElse"));
      return;
    }

    if (action === "contact") {
      openPageIdentityContactForm();
      return;
    }

    if (action === "quote") {
      const quoteCard = getPageActionCards(widgetConfig).find((card) => card.type === "quote" && trimText(card.prompt));
      pendingCanvasTopicLabel = trimText(quoteCard?.label) || assistantT("quick.quote");
      sendMessage(trimText(quoteCard?.prompt) || assistantT("prompt.quote"));
      return;
    }
  }

  const voiceReplyButton = event.target?.closest?.("[data-voice-reply-button]");

  if (voiceReplyButton) {
    const message = voiceReplyButton.closest?.(".message");
    const replyText = message?.dataset?.voiceReplyText || "";
    void playSpokenReply(replyText, voiceReplyButton, {
      key: voiceReplyButton.dataset.voiceMessageKey || message?.dataset?.voiceMessageKey || "",
    });
    return;
  }

  const openReasonsButton = event.target?.closest?.("[data-reply-feedback-open-reasons]");

  if (openReasonsButton) {
    const container = openReasonsButton.closest("[data-reply-feedback]");
    const form = container?.querySelector("[data-reply-feedback-reasons]");
    if (form) {
      form.hidden = false;
      openReasonsButton.disabled = true;
      form.querySelector("select")?.focus();
      queueEmbeddedHeightUpdate();
    }
    return;
  }

  const button = event.target?.closest?.("[data-reply-feedback-rating]");

  if (!button) {
    return;
  }

  const container = button.closest("[data-reply-feedback]");
  const messageKey = container?.dataset?.replyFeedback || "";
  const rating = button.dataset.replyFeedbackRating || "";
  const form = button.closest("[data-reply-feedback-reasons]");
  const formData = form ? new FormData(form) : null;
  container?.querySelectorAll?.("button").forEach((feedbackButton) => {
    feedbackButton.disabled = true;
  });
  void submitReplyFeedback(messageKey, rating, {
    reason: formData?.get("reason") || "",
    note: formData?.get("note") || "",
    userQuestion: container?.dataset?.replyQuestion || "",
    assistantAnswer: container?.dataset?.replyAnswer || "",
  }).then((result) => {
    if (!result) {
      container?.querySelectorAll?.("button").forEach((feedbackButton) => {
        feedbackButton.disabled = false;
      });
      return;
    }

    container?.classList.add("submitted");
    const label = container?.querySelector("span");
    if (label) {
      label.textContent = rating === "helpful" ? assistantT("assistant.feedbackHelpful") : assistantT("assistant.feedbackReview");
    }
  });
});

document.getElementById("chat")?.addEventListener("submit", (event) => {
  const form = event.target?.closest?.("[data-reply-feedback-reasons]");
  if (!form) {
    return;
  }

  event.preventDefault();
  form.querySelector('[data-reply-feedback-rating="not_helpful"]')?.click();
});

document.getElementById("input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

bindVoiceInputButton();

getSpeakRepliesToggle()?.addEventListener("click", () => {
  if (!getVoiceConfig().spokenRepliesEnabled) {
    return;
  }

  speakRepliesActive = !speakRepliesActive;
  speakRepliesUserChanged = true;
  if (!speakRepliesActive) {
    stopCurrentVoiceAudio();
  }
  syncSpeakRepliesToggle();
  setComposerStatus(speakRepliesActive
    ? assistantT("assistant.voiceSpeakRepliesOn")
    : assistantT("assistant.voiceSpeakRepliesOff"));
});

getQuickReplies()?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-quick-reply]");

  if (!button) {
    return;
  }

  const topic = trimText(button.dataset.quickReply || button.textContent);

  if (topic) {
    pendingCanvasTopicLabel = isCanvasPageMode()
      ? trimText(button.dataset.quickReplyLabel || button.textContent)
      : "";
    sendMessage(topic);
  }
});

document.getElementById("page-action-list")?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-page-quick-action]");

  if (!button) {
    return;
  }

  const topic = trimText(button.dataset.pageStarterPrompt || button.dataset.pageQuickAction || button.textContent);

  if (!topic) {
    return;
  }

  if (isPageMode() && !hasChosenVisitorIdentity()) {
    visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
    syncWidgetPhaseWithIdentity(visitorIdentity);
  }

  if (hasChosenVisitorIdentity()) {
    sendMessage(topic);
    return;
  }

  const input = document.getElementById("input");
  if (input) {
    input.value = topic;
  }
  setComposerStatus(assistantT("assistant.chooseThenSend"));
  document.getElementById("identity-guest-button")?.focus();
});

if (EMBEDDED_MODE) {
  document.body.classList.add("embedded");
  document.body.classList.add(`embedded-surface-${EMBEDDED_SURFACE}`);
  document.body.classList.add(`embedded-size-${EMBEDDED_SIZE}`);
  document.body.classList.add(`embedded-layout-${EMBEDDED_LAYOUT}`);
  if (isCanvasEmbeddedPageMode()) {
    document.body.classList.add("vonza-page-layout-canvas");
    document.body.classList.add("vonza-canvas-empty");
    document.body.classList.add(`embedded-background-scope-${EMBEDDED_BACKGROUND_SCOPE}`);
  }
  if (EMBEDDED_VARIANT === "smart") {
    document.body.classList.add("embedded-smart");
  }
  window.addEventListener("load", queueEmbeddedHeightUpdate);
  window.addEventListener("resize", queueEmbeddedHeightUpdate);
}

applyDisplayModeClasses();
visitorIdentity = loadStoredVisitorIdentity();
if (isPageMode() && !hasChosenVisitorIdentity()) {
  visitorIdentity = normalizeVisitorIdentityState({ mode: "guest" });
}
syncWidgetPhaseWithIdentity(visitorIdentity);
applyWidgetConfig(DEFAULT_WIDGET_CONFIG);
if (isPageMode()) {
  setPageShellState(hasAssistantConfig() ? "loading" : "unavailable", {
    title: "Assistant unavailable",
    copy: "This assistant is not available right now. Please contact the business directly.",
  });
}
loadWidgetBootstrap();

window.__VONZA_WIDGET_TEST_HOOKS__ = {
  applyWidgetConfig,
  getDisplayMode: () => DISPLAY_MODE,
  setPageShellState,
  buildVisitorIdentityPayload,
  buildAssistantMessageKey,
  clearVisitorIdentity,
  continueIntoChat: (identity, options = {}) => continueIntoChat(identity, {
    track: false,
    capture: options.capture === true,
  }),
  getVisitorIdentity: () => ({ ...visitorIdentity }),
  getWidgetPhase: () => widgetPhase,
  hasChosenVisitorIdentity: () => hasChosenVisitorIdentity(),
  formatAssistantMessageHtml,
  renderQuickReplies,
  getQuickReplyItems: () => getQuickReplyItems(),
  getPageActionCards: () => getPageActionCards(),
  getEmbeddedSurface: () => EMBEDDED_SURFACE,
  getEmbeddedSize: () => EMBEDDED_SIZE,
  getEmbeddedLayout: () => EMBEDDED_LAYOUT,
  shouldShowPageTitle,
  isFullEmbeddedPageMode,
  isCanvasEmbeddedPageMode,
  isHostedCanvasPageMode,
  isCanvasPageMode,
  hasBookingSupport: () => hasBookingSupport(),
  getVoiceConfig: () => ({ ...getVoiceConfig() }),
  getAssistantLanguage: () => getAssistantLanguage(),
  assistantT,
  syncVoiceControls,
  syncCallModeControls,
  startCallModeTurn,
  endCallMode,
  getCallModeState: () => callModeState,
  startVoiceRecording,
  stopVoiceRecording,
  setVoiceRecorderChunks: (chunks) => {
    voiceRecorderChunks = Array.isArray(chunks) ? chunks : [];
  },
  handleVoiceRecordingComplete,
  setSpeakRepliesActive: (value) => {
    speakRepliesActive = value === true;
    speakRepliesUserChanged = true;
    syncSpeakRepliesToggle();
  },
  isWelcomePanelHidden: () => getWelcomePanel()?.hidden === true || getEntryState()?.hidden === true,
  normalizeVisitorIdentityState,
  saveVisitorIdentity,
  sendMessage: () => sendMessage(),
  submitReplyFeedback,
};

if ("serviceWorker" in navigator && !EMBEDDED_MODE) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
