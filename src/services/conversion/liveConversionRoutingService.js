import {
  cleanText,
  isPlaceholderEmail,
  isPlaceholderPhone,
} from "../../utils/text.js";

const SUPPORTED_CTA_MODES = ["booking", "quote", "checkout", "contact", "capture", "chat"];
const SUPPORTED_INTENTS = ["booking", "quote", "checkout", "contact", "general"];

function normalizeOptionalUrl(value) {
  const normalized = cleanText(value);

  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeOptionalEmail(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "";
  }

  return isPlaceholderEmail(normalized) ? "" : normalized;
}

function normalizeOptionalPhone(value) {
  const normalized = cleanText(value);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7) {
    return "";
  }

  return isPlaceholderPhone(normalized) ? "" : normalized;
}

function normalizeCtaMode(value, fallbackValue) {
  const normalized = cleanText(value).toLowerCase();
  return SUPPORTED_CTA_MODES.includes(normalized) ? normalized : fallbackValue;
}

function normalizeIntentType(value) {
  const normalized = cleanText(value).toLowerCase();
  return SUPPORTED_INTENTS.includes(normalized) ? normalized : "general";
}

function normalizeRoutingEvent(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  return {
    eventName: cleanText(row.event_name || row.eventName),
    sessionId: cleanText(row.session_id || row.sessionId),
    createdAt: row.created_at || row.createdAt || null,
    metadata: {
      decisionKey: cleanText(metadata.decisionKey),
      ctaType: cleanText(metadata.ctaType),
      targetType: cleanText(metadata.targetType),
      relatedIntentType: cleanText(metadata.relatedIntentType),
      relatedActionKey: cleanText(metadata.relatedActionKey),
      relatedConversationId: cleanText(metadata.relatedConversationId),
      relatedPersonKey: cleanText(metadata.relatedPersonKey),
      routingMode: cleanText(metadata.routingMode),
    },
  };
}

export function normalizeDirectRoutingSettings(widgetConfig = {}) {
  return {
    bookingUrl: normalizeOptionalUrl(widgetConfig.bookingUrl || widgetConfig.booking_url),
    quoteUrl: normalizeOptionalUrl(widgetConfig.quoteUrl || widgetConfig.quote_url),
    checkoutUrl: normalizeOptionalUrl(widgetConfig.checkoutUrl || widgetConfig.checkout_url),
    contactEmail: normalizeOptionalEmail(widgetConfig.contactEmail || widgetConfig.contact_email),
    contactPhone: normalizeOptionalPhone(widgetConfig.contactPhone || widgetConfig.contact_phone),
    primaryCtaMode: normalizeCtaMode(widgetConfig.primaryCtaMode || widgetConfig.primary_cta_mode, "contact"),
    fallbackCtaMode: normalizeCtaMode(widgetConfig.fallbackCtaMode || widgetConfig.fallback_cta_mode, "capture"),
    businessHoursNote: cleanText(widgetConfig.businessHoursNote || widgetConfig.business_hours_note),
  };
}

function detectContactPreference(message = "") {
  const normalized = cleanText(message).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("email") || normalized.includes("mail")) {
    return "email";
  }

  if (
    normalized.includes("call")
    || normalized.includes("phone")
    || normalized.includes("ring")
    || normalized.includes("callback")
    || normalized.includes("call back")
  ) {
    return "phone";
  }

  return "";
}

function detectIntentFromMessage(message = "") {
  const normalized = cleanText(message).toLowerCase();

  if (!normalized) {
    return { intentType: "general", source: "none", contactPreference: "" };
  }

  const contactPreference = detectContactPreference(normalized);

  if (
    normalized.includes("call me")
    || normalized.includes("call back")
    || normalized.includes("callback")
    || normalized.includes("phone")
    || normalized.includes("email")
    || normalized.includes("contact")
    || normalized.includes("reach")
    || normalized.includes("get in touch")
    || normalized.includes("talk to")
    || normalized.includes("speak to")
  ) {
    return {
      intentType: "contact",
      source: "message",
      contactPreference,
    };
  }

  if (
    normalized.includes("checkout")
    || normalized.includes("order")
    || normalized.includes("buy now")
    || normalized.includes("purchase")
    || normalized.includes("pay now")
    || normalized.includes("cart")
  ) {
    return {
      intentType: "checkout",
      source: "message",
      contactPreference,
    };
  }

  if (
    normalized.includes("quote")
    || normalized.includes("estimate")
    || normalized.includes("pricing")
    || normalized.includes("price")
    || normalized.includes("cost")
    || normalized.includes("how much")
  ) {
    return {
      intentType: "quote",
      source: "message",
      contactPreference,
    };
  }

  if (
    normalized.includes("book")
    || normalized.includes("booking")
    || normalized.includes("appointment")
    || normalized.includes("schedule")
    || normalized.includes("availability")
    || normalized.includes("reserve")
    || normalized.includes("consultation")
    || normalized.includes("demo")
  ) {
    return {
      intentType: "booking",
      source: "message",
      contactPreference,
    };
  }

  return {
    intentType: "general",
    source: "message",
    contactPreference,
  };
}

function mapActionTypeToIntent(actionType = "", fallbackIntent = "") {
  switch (cleanText(actionType).toLowerCase()) {
    case "booking_intent":
      return "booking";
    case "pricing_interest":
      return "quote";
    case "lead_follow_up":
      return "contact";
    default:
      return normalizeIntentType(fallbackIntent);
  }
}

function resolveIntent(options = {}) {
  const fromMessage = detectIntentFromMessage(options.userMessage);

  if (fromMessage.intentType !== "general") {
    return fromMessage;
  }

  const leadCaptureTrigger = cleanText(options.leadCapture?.trigger);
  const leadCaptureIntent = mapActionTypeToIntent(
    leadCaptureTrigger === "direct_follow_up" ? "lead_follow_up" : leadCaptureTrigger,
    ""
  );

  if (leadCaptureIntent !== "general") {
    return {
      intentType: leadCaptureIntent,
      source: "lead_capture",
      contactPreference: detectContactPreference(options.userMessage),
    };
  }

  const sessionContext = options.sessionContext || {};
  const triggerActionType = cleanText(sessionContext.triggerItem?.actionType || sessionContext.latestSessionItem?.actionType);
  const sessionIntent = mapActionTypeToIntent(triggerActionType, sessionContext.latestSessionItem?.intent);

  return {
    intentType: sessionIntent,
    source: triggerActionType ? "session" : "none",
    contactPreference: detectContactPreference(options.userMessage),
  };
}

function buildContactPrimary(settings, contactPreference = "") {
  if (contactPreference === "email" && settings.contactEmail) {
    return {
      ctaType: "contact",
      targetType: "email",
      label: "Email us",
      href: `mailto:${settings.contactEmail}`,
      targetValue: settings.contactEmail,
    };
  }

  if (contactPreference === "phone" && settings.contactPhone) {
    return {
      ctaType: "contact",
      targetType: "phone",
      label: "Call us",
      href: `tel:${settings.contactPhone}`,
      targetValue: settings.contactPhone,
    };
  }

  if (settings.contactPhone) {
    return {
      ctaType: "contact",
      targetType: "phone",
      label: "Call us",
      href: `tel:${settings.contactPhone}`,
      targetValue: settings.contactPhone,
    };
  }

  if (settings.contactEmail) {
    return {
      ctaType: "contact",
      targetType: "email",
      label: "Email us",
      href: `mailto:${settings.contactEmail}`,
      targetValue: settings.contactEmail,
    };
  }

  return null;
}

function buildAlternateContact(settings, primaryTargetType = "") {
  if (primaryTargetType !== "phone" && settings.contactPhone) {
    return {
      ctaType: "contact",
      targetType: "phone",
      label: "Call us",
      href: `tel:${settings.contactPhone}`,
      targetValue: settings.contactPhone,
    };
  }

  if (primaryTargetType !== "email" && settings.contactEmail) {
    return {
      ctaType: "contact",
      targetType: "email",
      label: "Email us",
      href: `mailto:${settings.contactEmail}`,
      targetValue: settings.contactEmail,
    };
  }

  return null;
}

function buildConfiguredRoute(ctaMode, settings, contactPreference = "") {
  switch (normalizeCtaMode(ctaMode, "")) {
    case "booking":
      return settings.bookingUrl
        ? {
          ctaType: "booking",
          targetType: "url",
          label: "Book now",
          href: settings.bookingUrl,
          targetValue: settings.bookingUrl,
        }
        : null;
    case "quote":
      return settings.quoteUrl
        ? {
          ctaType: "quote",
          targetType: "url",
          label: "Request a quote",
          href: settings.quoteUrl,
          targetValue: settings.quoteUrl,
        }
        : null;
    case "checkout":
      return settings.checkoutUrl
        ? {
          ctaType: "checkout",
          targetType: "url",
          label: "Go to checkout",
          href: settings.checkoutUrl,
          targetValue: settings.checkoutUrl,
        }
        : null;
    case "contact":
      return buildContactPrimary(settings, contactPreference);
    default:
      return null;
  }
}

function buildIntentPreferredRoute(intentType, settings, contactPreference = "") {
  switch (normalizeIntentType(intentType)) {
    case "booking":
      return buildConfiguredRoute("booking", settings, contactPreference);
    case "quote":
      return buildConfiguredRoute("quote", settings, contactPreference);
    case "checkout":
      return buildConfiguredRoute("checkout", settings, contactPreference);
    case "contact":
      return buildConfiguredRoute("contact", settings, contactPreference);
    default:
      return null;
  }
}

function buildRoutingReason(intentType, route, fallbackModeUsed) {
  if (!route) {
    return "No direct conversion destination is configured for this intent yet, so Vonza stays in chat and falls back to capture when needed.";
  }

  if (fallbackModeUsed) {
    return `The preferred route was missing, so Vonza used the configured ${fallbackModeUsed} fallback instead.`;
  }

  switch (intentType) {
    case "booking":
      return "Booking intent was detected and a booking destination is configured.";
    case "quote":
      return "Quote or pricing intent was detected and a quote destination is configured.";
    case "checkout":
      return "Purchase intent was detected and a checkout destination is configured.";
    case "contact":
      return "Direct contact intent was detected and a contact destination is configured.";
    default:
      return "A direct next step is configured for this conversation.";
  }
}

function buildDecisionKey({ sessionKey, route, intentType, relatedActionKey }) {
  return [
    cleanText(sessionKey),
    cleanText(relatedActionKey),
    cleanText(intentType),
    cleanText(route?.ctaType),
    cleanText(route?.targetType),
    cleanText(route?.targetValue),
  ].filter(Boolean).join("::");
}

function wasRouteAlreadyHandled(events = [], decisionKey = "") {
  const normalizedDecisionKey = cleanText(decisionKey);

  if (!normalizedDecisionKey) {
    return {
      shown: false,
      clicked: false,
    };
  }

  return events.reduce((result, event) => {
    if (cleanText(event.metadata.decisionKey) !== normalizedDecisionKey) {
      return result;
    }

    if (event.eventName === "cta_shown") {
      result.shown = true;
    }

    if (event.eventName === "cta_clicked") {
      result.clicked = true;
    }

    return result;
  }, { shown: false, clicked: false });
}

export function evaluateLiveConversionRouting(options = {}) {
  const settings = normalizeDirectRoutingSettings(options.widgetConfig);
  const intent = resolveIntent(options);
  const intentRoute = buildIntentPreferredRoute(intent.intentType, settings, intent.contactPreference);
  const fallbackMode = normalizeCtaMode(settings.fallbackCtaMode, "capture");
  const fallbackRoute = intentRoute ? null : buildConfiguredRoute(
    fallbackMode,
    settings,
    intent.contactPreference
  );
  const route = intentRoute || fallbackRoute;
  const sessionContext = options.sessionContext || {};
  const relatedActionKey = cleanText(sessionContext.triggerItem?.key || sessionContext.latestSessionItem?.key);
  const relatedConversationId = relatedActionKey || `session:${cleanText(options.sessionKey)}`;
  const recentEvents = (options.recentWidgetEvents || []).map((row) => normalizeRoutingEvent(row));
  const leadCapture = options.leadCapture && typeof options.leadCapture === "object" ? options.leadCapture : null;
  const fallbackCaptureAvailable = leadCapture?.shouldPrompt === true;

  if (!route) {
    return {
      mode: fallbackCaptureAvailable ? "capture_only" : "chat_only",
      intentType: intent.intentType,
      reason: buildRoutingReason(intent.intentType, null, ""),
      shouldShowCapture: fallbackCaptureAvailable,
      shouldStayInChat: true,
      relatedActionKey,
      relatedConversationId,
      relatedMessageId: cleanText(sessionContext.latestSessionItem?.messageId),
      relatedPersonKey: cleanText(sessionContext.personKey),
    };
  }

  const decisionKey = buildDecisionKey({
    sessionKey: options.sessionKey,
    route,
    intentType: intent.intentType,
    relatedActionKey,
  });
  const priorRouteState = wasRouteAlreadyHandled(recentEvents, decisionKey);

  if (priorRouteState.clicked) {
    return {
      mode: fallbackCaptureAvailable ? "capture_only" : "chat_only",
      intentType: intent.intentType,
      reason: "This direct route was already clicked in this session, so Vonza is not prompting it again.",
      suppressReason: "cta_already_clicked",
      shouldShowCapture: fallbackCaptureAvailable,
      shouldStayInChat: true,
      relatedActionKey,
      relatedConversationId,
      relatedMessageId: cleanText(sessionContext.latestSessionItem?.messageId),
      relatedPersonKey: cleanText(sessionContext.personKey),
    };
  }

  if (priorRouteState.shown) {
    return {
      mode: fallbackCaptureAvailable ? "capture_only" : "chat_only",
      intentType: intent.intentType,
      reason: "This direct route was already shown in this session, so Vonza is suppressing a repeated prompt.",
      suppressReason: "cta_already_shown",
      shouldShowCapture: fallbackCaptureAvailable,
      shouldStayInChat: true,
      relatedActionKey,
      relatedConversationId,
      relatedMessageId: cleanText(sessionContext.latestSessionItem?.messageId),
      relatedPersonKey: cleanText(sessionContext.personKey),
    };
  }

  const alternateContact = route.ctaType === "contact"
    ? buildAlternateContact(settings, route.targetType)
    : null;
  const routingMode = fallbackCaptureAvailable ? "direct_then_capture" : "direct_cta";

  return {
    decisionKey,
    mode: routingMode,
    routingMode,
    intentType: intent.intentType,
    reason: buildRoutingReason(intent.intentType, route, intentRoute ? "" : fallbackMode),
    shouldShowCapture: fallbackCaptureAvailable,
    shouldStayInChat: true,
    availabilityNote: settings.businessHoursNote,
    primaryCta: route,
    secondaryCtas: alternateContact ? [alternateContact] : [],
    continueButton: {
      label: "Continue here",
      action: fallbackCaptureAvailable ? "reveal_capture" : "dismiss_route",
    },
    relatedActionKey,
    relatedConversationId,
    relatedMessageId: cleanText(sessionContext.latestSessionItem?.messageId),
    relatedPersonKey: cleanText(sessionContext.personKey),
  };
}
