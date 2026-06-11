(function registerVonzaDashboardCustomers(global) {
  function fallbackTrimText(value) {
    return String(value || "").trim();
  }

  function fallbackEscapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fallbackTranslation(key = "") {
    const labels = {
      "common.guestVisitor": "Guest visitor",
      "common.noCustomerMessage": "No customer message yet",
      "common.viewChat": "View chat",
      "common.hideChat": "Hide chat",
      "common.chatUnavailable": "Chat unavailable",
      "common.noSavedChat": "No saved chat messages yet.",
      "common.noMessageText": "No message text",
      "common.vonza": "Vonza",
      "common.customer": "Customer",
      "common.save": "Save",
      "customers.needsReply": "Needs reply",
      "customers.listCopy": "Review customer records, source context, and the next action Vonza recommends.",
      "customers.title": "Customers",
      "customers.subtitle": "Track leads, guests, and follow-up context from real conversations.",
    };
    return labels[key] || key;
  }

  const CUSTOMER_EMPTY_STATE_BY_PRODUCT = Object.freeze({
    front_desk: Object.freeze({
      title: "No Front Desk customer conversations yet.",
      copy: "After page visitors use the full-page Front Desk or leave contact details, lead capture and follow-up context will appear here.",
      actions: Object.freeze([
        Object.freeze({ label: "Open full-page setup", href: "#install/full-page", shellTarget: "install", installMethod: "full-page" }),
        Object.freeze({ label: "Test Front Desk", href: "#front-desk/practice", shellTarget: "customize" }),
      ]),
    }),
    website_widget: Object.freeze({
      title: "No Website Widget customer conversations yet.",
      copy: "After website visitors use the embedded assistant, leads and conversation context from the widget will appear here.",
      actions: Object.freeze([
        Object.freeze({ label: "Open embed install", href: "#install/embed", shellTarget: "install", installMethod: "widget" }),
        Object.freeze({ label: "Open widget settings", href: "#settings/widget/optional-widget", shellTarget: "settings", settingsTarget: "website_widget" }),
      ]),
    }),
    voice_agent: Object.freeze({
      title: "No Voice Agent conversations yet.",
      copy: "After Web Call conversations are recorded, transcripts, lead handoff context, and follow-up details will appear here.",
      actions: Object.freeze([
        Object.freeze({ label: "Open voice settings", href: "#settings/voice/voice", shellTarget: "settings", settingsTarget: "voice_agent" }),
        Object.freeze({ label: "Review Web Call analytics", href: "#analytics", shellTarget: "analytics" }),
      ]),
    }),
  });

  const DEDICATED_WEBSITE_WIDGET_DASHBOARD_PATHS = Object.freeze([
    "/dashboard/widget",
    "/website-widget/dashboard",
    "/widget/dashboard",
  ]);

  function isDedicatedWebsiteWidgetDashboardPath() {
    const pathname = fallbackTrimText(global.location?.pathname).split(/[?#]/)[0];
    const normalizedPath = `/${pathname.replace(/^\/+|\/+$/g, "")}`;
    return DEDICATED_WEBSITE_WIDGET_DASHBOARD_PATHS.includes(normalizedPath);
  }

  function getDefaultCustomerProductKey() {
    return isDedicatedWebsiteWidgetDashboardPath() ? "website_widget" : "front_desk";
  }

  function normalizeCustomerProductKey(value = "") {
    const rawValue = typeof value === "object" && value ? value.key : value;
    const normalized = fallbackTrimText(rawValue).toLowerCase().replace(/-/g, "_");
    const aliases = {
      frontdesk: "front_desk",
      front_desk: "front_desk",
      widget: "website_widget",
      website: "website_widget",
      website_widget: "website_widget",
      voice: "voice_agent",
      voice_agent: "voice_agent",
    };
    const candidate = aliases[normalized] || normalized;

    return CUSTOMER_EMPTY_STATE_BY_PRODUCT[candidate] ? candidate : getDefaultCustomerProductKey();
  }

  function createCustomerHelpers(dependencies = {}) {
  const sanitizeText = typeof dependencies.trimText === "function" ? dependencies.trimText : fallbackTrimText;
  const sanitizeHtml = typeof dependencies.escapeHtml === "function" ? dependencies.escapeHtml : fallbackEscapeHtml;
  const trimText = sanitizeText;
  const escapeHtml = sanitizeHtml;
  const t = typeof dependencies.t === "function" ? dependencies.t : (key) => fallbackTranslation(key);
  const translateDashboardText = typeof dependencies.translateDashboardText === "function" ? dependencies.translateDashboardText : (value) => sanitizeText(value);
  const localizeDashboardCopy = typeof dependencies.localizeDashboardCopy === "function" ? dependencies.localizeDashboardCopy : (english) => sanitizeText(english);
  const formatSeenAt = typeof dependencies.formatSeenAt === "function" ? dependencies.formatSeenAt : (value) => sanitizeText(value);
  const formatAnalyticsReportNumber = typeof dependencies.formatAnalyticsReportNumber === "function" ? dependencies.formatAnalyticsReportNumber : (value) => String(value || 0);
  const formatDashboardCountLabel = typeof dependencies.formatDashboardCountLabel === "function" ? dependencies.formatDashboardCountLabel : (count, singular, plural) => `${count} ${Number(count) === 1 ? singular : plural}`;
  const formatOperatorCount = typeof dependencies.formatOperatorCount === "function" ? dependencies.formatOperatorCount : (count, singular) => formatDashboardCountLabel(count || 0, singular, `${singular}s`);
  const getUiIconMarkup = typeof dependencies.getUiIconMarkup === "function" ? dependencies.getUiIconMarkup : () => "";
  const createEmptyOperatorWorkspace = typeof dependencies.createEmptyOperatorWorkspace === "function" ? dependencies.createEmptyOperatorWorkspace : () => ({ contacts: { list: [], summary: {}, health: {} }, calendar: { suggestedSlots: [] } });
  const isCapabilityVisibleForWorkspace = typeof dependencies.isCapabilityVisibleForWorkspace === "function" ? dependencies.isCapabilityVisibleForWorkspace : () => false;
  const isCapabilityExplicitlyVisible = typeof dependencies.isCapabilityExplicitlyVisible === "function" ? dependencies.isCapabilityExplicitlyVisible : () => false;
  const buildDisclosureBlock = typeof dependencies.buildDisclosureBlock === "function" ? dependencies.buildDisclosureBlock : ({ contentMarkup = "" } = {}) => contentMarkup;
  const buildDisclosureDetailRows = typeof dependencies.buildDisclosureDetailRows === "function" ? dependencies.buildDisclosureDetailRows : () => "";
  const buildOperatorEmptyState = typeof dependencies.buildOperatorEmptyState === "function" ? dependencies.buildOperatorEmptyState : ({ title = "", copy = "", actionMarkup = "" } = {}) => `<div class="placeholder-card"><h3>${sanitizeHtml(title)}</h3><p>${sanitizeHtml(copy)}</p>${actionMarkup}</div>`;
  const buildPageHeader = typeof dependencies.buildPageHeader === "function" ? dependencies.buildPageHeader : () => "";
  const buildPageToolbar = typeof dependencies.buildPageToolbar === "function" ? dependencies.buildPageToolbar : ({ searchMarkup = "", filtersMarkup = "" } = {}) => `${searchMarkup}${filtersMarkup}`;
  const formatContactLifecycleLabel = typeof dependencies.formatContactLifecycleLabel === "function" ? dependencies.formatContactLifecycleLabel : (value) => sanitizeText(value).replaceAll("_", " ");
  const buildContactFlags = typeof dependencies.buildContactFlags === "function" ? dependencies.buildContactFlags : (contact = {}) => Array.isArray(contact.flags) ? contact.flags : [];
  const buildContactSources = typeof dependencies.buildContactSources === "function" ? dependencies.buildContactSources : (contact = {}) => Array.isArray(contact.sources) ? contact.sources : [];
  const getCustomerSourceLabel = typeof dependencies.getCustomerSourceLabel === "function" ? dependencies.getCustomerSourceLabel : (source = "") => global.VonzaDashboardLabels?.getCustomerSourceLabel?.(source) || sanitizeText(source);
  const getRecommendedCampaignGoal = typeof dependencies.getRecommendedCampaignGoal === "function" ? dependencies.getRecommendedCampaignGoal : () => "quote_follow_up";

    function getCustomerSourceLabels(contact = {}) {
      return [
        ...new Set(
          buildContactSources(contact)
            .map(getCustomerSourceLabel)
            .filter(Boolean)
        ),
      ];
    }

    function buildCustomerSourceBadgeMarkup(contact = {}, limit = 2) {
      const labels = getCustomerSourceLabels(contact);
      const visibleLabels = labels.length ? labels.slice(0, limit) : ["Unknown source"];

      return visibleLabels.map((label) => `
        <span class="customer-source-chip">${escapeHtml(translateDashboardText(label))}</span>
      `).join("");
    }

    function contactNeedsReply(contact = {}) {
      const nextActionKey = trimText(contact.nextAction?.key);

      if (nextActionKey && nextActionKey !== "no_action_needed") {
        return true;
      }

      return Boolean(trimText(contact.nextAction?.title) || trimText(contact.nextAction?.description));
    }

    function customerHasContactDetails(contact = {}) {
      return Boolean(getCustomerEmailLabel(contact.email) || trimText(contact.phone));
    }

    function customerHasActiveReplyableChat(contact = {}) {
      const explicitReplyable = [
        contact.replyPossible,
        contact.chatReplyPossible,
        contact.activeChat,
        contact.chatAvailable,
      ].some((value) => value === true);
      const statuses = [
        contact.chatStatus,
        contact.conversationStatus,
        contact.sessionStatus,
      ].map((value) => trimText(value).toLowerCase());

      return explicitReplyable || statuses.some((value) => ["active", "open", "replyable", "live"].includes(value));
    }

    function customerHasReplyableChannel(contact = {}) {
      return customerHasActiveReplyableChat(contact)
        || customerHasContactDetails(contact)
        || Boolean(trimText(contact.primaryThreadId))
        || Boolean(trimText(contact.nextAction?.followUpId))
        || Boolean(trimText(contact.primaryFollowUpId));
    }

    function customerNeedsOwnerReviewRaw(contact = {}) {
      const lifecycleState = trimText(contact.lifecycleState);

      return contactNeedsReply(contact)
        || isComplaintContact(contact)
        || ["needs_reply", "needs_review"].includes(lifecycleState)
        || buildContactFlags(contact).some((flag) => /follow.?up|reply|attention|due/i.test(trimText(flag)))
        || Boolean(trimText(contact.nextAction?.followUpId))
        || ["draft", "ready", "failed", "missing_contact"].includes(trimText(contact.followUpStatus).toLowerCase());
    }

    function getCustomerActionState(contact = {}) {
      const needsOwnerReview = customerNeedsOwnerReviewRaw(contact);
      const replyPossible = customerHasReplyableChannel(contact);
      const missingContactDetails = isGuestCustomerRow(contact) && !replyPossible;

      return {
        needs_owner_review: needsOwnerReview,
        follow_up_possible: needsOwnerReview && replyPossible,
        missing_contact_details: missingContactDetails,
        reply_possible: replyPossible,
      };
    }

    function customerMissingContactDetails(contact = {}) {
      return getCustomerActionState(contact).missing_contact_details;
    }

    function customerNeedsOwnerReview(contact = {}) {
      return getCustomerActionState(contact).needs_owner_review;
    }

    function customerNeedsFollowUp(contact = {}) {
      return getCustomerActionState(contact).follow_up_possible;
    }

    function isComplaintContact(contact = {}) {
      const lifecycleState = trimText(contact.lifecycleState);
      const flags = buildContactFlags(contact);

      return ["complaint_risk", "support_issue"].includes(lifecycleState) || flags.includes("complaint");
    }

    function isLeadContact(contact = {}) {
      return ["new", "active_lead", "qualified"].includes(trimText(contact.lifecycleState));
    }

    function isResolvedContact(contact = {}) {
      if (contactNeedsReply(contact)) {
        return false;
      }

      return contact.hasMeaningfulOutcome === true || Boolean(trimText(contact.latestOutcome?.label));
    }

    function isReturningContact(contact = {}) {
      return trimText(contact.lifecycleState) === "customer"
        || Number(contact.counts?.outcomes || 0) > 0
        || Number(contact.counts?.inboxThreads || 0) > 1
        || (contact.timeline || []).length > 1;
    }

    function normalizeCustomerLabelForCompare(value = "") {
      return trimText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function isPlaceholderCustomerLabel(value = "") {
      return [
        "unknown",
        "anonymous visitor",
        "guest visitor",
        "unknown visitor",
        "unknown contact",
        "identity unknown",
        "session continuity only",
        "no direct identifier yet",
      ].includes(trimText(value).toLowerCase());
    }

    function isLikelyCustomerMessageLabel(value = "") {
      const label = trimText(value);
      const normalizedLabel = normalizeCustomerLabelForCompare(label);

      if (!label || !normalizedLabel) {
        return false;
      }

      const wordCount = label.split(/\s+/).filter(Boolean).length;

      if (["hi", "hey", "hello"].includes(label.toLowerCase())) {
        return true;
      }

      if (/^(?:hi|hey|hello)[,!.\s]+/i.test(label)) {
        return true;
      }

      if (label.includes("?")) {
        return true;
      }

      if (wordCount >= 3) {
        return (
          /\b(?:what|why|how|when|where|who|which)\b/i.test(label)
          || /\b(?:can|could|would|should|do|does|did|is|are|will)\s+(?:i|we|you|your|they)\b/i.test(label)
          || /\b(?:i|we)\s+(?:need|want|would|am|have)\b/i.test(label)
          || /\b(?:services|pricing|price|cost|quote|booking|appointment|schedule)\b/i.test(label)
        );
      }

      return false;
    }

    function getValidCustomerLabel(value = "") {
      const label = trimText(value);

      return label && !isPlaceholderCustomerLabel(label) && !isLikelyCustomerMessageLabel(label)
        ? label
        : "";
    }

    function getCustomerEmailLabel(value = "") {
      const match = trimText(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return match ? match[0].toLowerCase() : "";
    }

    function getNamedCustomerIdentity(contact = {}) {
      const email = getCustomerEmailLabel(contact.email);
      const phone = trimText(contact.phone);

      return [
        getValidCustomerLabel(contact.name),
        getValidCustomerLabel(contact.bestIdentifier),
      ].find((candidate) => {
        const normalizedCandidate = trimText(candidate);
        const candidateEmail = getCustomerEmailLabel(normalizedCandidate);
        return normalizedCandidate
          && (!candidateEmail || candidateEmail !== email)
          && normalizedCandidate !== phone;
      }) || "";
    }

    function getCustomerName(contact = {}) {
      return getNamedCustomerIdentity(contact)
        || getCustomerEmailLabel(contact.email)
        || trimText(contact.phone)
        || (hasGuestCustomerActivity(contact) ? t("common.guestVisitor") : "")
        || "Unknown";
    }

    function getCustomerRowIdentifier(contact = {}) {
      return getCustomerName(contact);
    }

    function getCustomerIdentityLabel(contact = {}) {
      if (getCustomerEmailLabel(contact.email)) {
        return translateDashboardText("Email user");
      }

      if (trimText(contact.phone)) {
        return translateDashboardText("Phone user");
      }

      if (getNamedCustomerIdentity(contact)) {
        return translateDashboardText("Named visitor");
      }

      return t("common.guestVisitor");
    }

    function getCustomerIdentifier(contact = {}) {
      return getCustomerEmailLabel(contact.email)
        || trimText(contact.phone)
        || getNamedCustomerIdentity(contact)
        || (hasGuestCustomerActivity(contact) ? t("common.guestVisitor") : "")
        || localizeDashboardCopy("No direct identifier yet", "Még nincs közvetlen azonosító");
    }

    function getCustomerLastMessageAt(contact = {}) {
      const directCustomerMessageAt = trimText(contact.lastCustomerMessageAt || contact.last_customer_message_at);

      if (directCustomerMessageAt) {
        return directCustomerMessageAt;
      }

      const legacyLastMessageAt = trimText(contact.lastMessageAt || contact.last_message_at);

      if (
        legacyLastMessageAt
        && (
          trimText(contact.latestCustomerMessageSummary || contact.latestSummary)
          || (Array.isArray(contact.chatMessages) && contact.chatMessages.some((message) => trimText(message.role) === "customer"))
        )
      ) {
        return legacyLastMessageAt;
      }

      return "";
    }

    function hasGuestCustomerActivity(contact = {}) {
      if (getCustomerEmailLabel(contact.email) || trimText(contact.phone) || getNamedCustomerIdentity(contact)) {
        return false;
      }

      const sources = Array.isArray(contact.sources) ? contact.sources.map((source) => trimText(source).toLowerCase()) : [];
      const timeline = Array.isArray(contact.timeline) ? contact.timeline : [];

      return contact.partialIdentity === true
        || sources.includes("chat")
        || sources.includes("inbox")
        || isPlaceholderCustomerLabel(contact.name)
        || isPlaceholderCustomerLabel(contact.bestIdentifier)
        || timeline.some((entry) =>
          ["Visitor message", "Inbox thread"].includes(trimText(entry.label))
          || ["chat", "inbox"].includes(trimText(entry.source))
        );
    }

    function getCustomerLastActivityLabel(contact = {}) {
      const lastCustomerMessageAt = getCustomerLastMessageAt(contact);

      if (lastCustomerMessageAt) {
        return formatSeenAt(lastCustomerMessageAt);
      }

      return t("common.noCustomerMessage");
    }

    function isGuestCustomerRow(contact = {}) {
      return !getCustomerEmailLabel(contact.email)
        && !trimText(contact.phone)
        && !getNamedCustomerIdentity(contact)
        && hasGuestCustomerActivity(contact);
    }

    function getCustomerConversationSourceText(contact = {}) {
      const customerMessageEntry = (contact.timeline || []).find((entry) =>
        ["Visitor message", "Inbox thread"].includes(trimText(entry.label))
        || ["chat", "inbox"].includes(trimText(entry.source))
      ) || {};
      const messageLikeName = isLikelyCustomerMessageLabel(contact.name)
        ? trimText(contact.name)
        : isLikelyCustomerMessageLabel(contact.bestIdentifier)
          ? trimText(contact.bestIdentifier)
          : "";

      return [
        trimText(contact.latestCustomerMessageSummary),
        trimText(customerMessageEntry.summary),
        messageLikeName,
        trimText(contact.nextAction?.description),
        trimText(contact.nextAction?.title),
        trimText(contact.latestOutcome?.label),
        trimText(customerMessageEntry.label),
      ].find((value) => value && !isGenericCustomerNoActionCopy(value) && !isGenericCustomerNoActionTitle(value)) || "";
    }

    function getGuestConversationRowSummary(contact = {}) {
      const sourceText = getCustomerConversationSourceText(contact);
      const signalText = [
        sourceText,
        trimText(contact.nextAction?.description),
        trimText(contact.nextAction?.title),
        trimText(contact.lifecycleState),
        ...(Array.isArray(contact.flags) ? contact.flags : []),
      ].join(" ").toLowerCase();

      if (!signalText) {
        return localizeDashboardCopy("No recent conversation summary yet.", "Még nincs összefoglaló a legutóbbi beszélgetésről.");
      }

      if (/\b(?:complaint|frustrat|refund|cancel|issue|problem|support|upset|angry|unhappy)\b/.test(signalText)) {
        return localizeDashboardCopy("Needed help with a support issue", "Támogatási ügyben kért segítséget");
      }

      if (/\b(?:price|pricing|cost|quote|estimate|package|rate|buy|purchase|checkout)\b/.test(signalText)) {
        return /\b(?:book|booking|appointment|schedule|availability|next step|contact|call|email)\b/.test(signalText)
          ? localizeDashboardCopy("Asked about pricing and next steps", "Árazásról és következő lépésekről kérdezett")
          : localizeDashboardCopy("Asked about pricing or quote details", "Árazásról vagy ajánlatkérés részleteiről kérdezett");
      }

      if (/\b(?:book|booking|appointment|appointments|schedule|scheduling|availability|available|reserve|reservation|consultation|calendar)\b/.test(signalText)) {
        return localizeDashboardCopy("Needed help with booking or availability", "Foglalással vagy elérhetőséggel kapcsolatban kért segítséget");
      }

      if (/\b(?:which|fit|best|recommend|choose|service|services|offer|offers|available|need|looking for)\b/.test(signalText)) {
        return localizeDashboardCopy("Asked which service fits their needs", "Azt kérdezte, melyik szolgáltatás illik az igényeihez");
      }

      if (/\b(?:contact|call|email|phone|reach|message|talk|speak|get in touch)\b/.test(signalText)) {
        return localizeDashboardCopy("Wanted to contact the business", "Kapcsolatba akart lépni a vállalkozással");
      }

      if (/\b(?:hour|hours|open|location|where|area|near|weekend)\b/.test(signalText)) {
        return localizeDashboardCopy("Asked about hours or service area", "Nyitvatartásról vagy kiszolgálási területről kérdezett");
      }

      if (/\b(?:hi|hey|hello)\b/.test(signalText) && sourceText.split(/\s+/).filter(Boolean).length <= 4) {
        return localizeDashboardCopy("Started a new chat with the business", "Új beszélgetést indított a vállalkozással");
      }

      return localizeDashboardCopy("Asked for help choosing a next step", "Segítséget kért a következő lépés kiválasztásához");
    }

    function getCustomerLatestSummary(contact = {}) {
      const customerMessageEntry = (contact.timeline || []).find((entry) =>
        ["Visitor message", "Inbox thread"].includes(trimText(entry.label))
        || ["chat", "inbox"].includes(trimText(entry.source))
      ) || {};
      const messageLikeName = isLikelyCustomerMessageLabel(contact.name)
        ? trimText(contact.name)
        : isLikelyCustomerMessageLabel(contact.bestIdentifier)
          ? trimText(contact.bestIdentifier)
          : "";
      const latestCustomerMessageSummary = trimText(contact.latestCustomerMessageSummary || contact.latestSummary);
      const customerMessageSummary = trimText(customerMessageEntry.summary);

      if (isGuestCustomerRow(contact)) {
        return getGuestConversationRowSummary(contact);
      }

      if (
        messageLikeName
        && (!latestCustomerMessageSummary || isGenericCustomerNoActionCopy(latestCustomerMessageSummary))
        && (!customerMessageSummary || isGenericCustomerNoActionCopy(customerMessageSummary))
      ) {
        return messageLikeName;
      }

      return latestCustomerMessageSummary
        || customerMessageSummary
        || trimText(customerMessageEntry.label)
        || messageLikeName
        || trimText(contact.nextAction?.description)
        || trimText(contact.latestOutcome?.label)
        || localizeDashboardCopy("No recent conversation summary yet.", "Még nincs összefoglaló a legutóbbi beszélgetésről.");
    }

    function getCustomerSecondaryIdentityLine(contact = {}) {
      const email = getCustomerEmailLabel(contact.email);
      const phone = trimText(contact.phone);
      const displayName = getNamedCustomerIdentity(contact);
      const rowIdentifier = getCustomerRowIdentifier(contact);

      if (email && rowIdentifier !== email) {
        return `${localizeDashboardCopy("Email user", "Emailes felhasználó")} · ${email}`;
      }

      if (phone && rowIdentifier !== phone) {
        return `${localizeDashboardCopy("Phone user", "Telefonos felhasználó")} · ${phone}`;
      }

      if (displayName && rowIdentifier !== displayName) {
        return `${localizeDashboardCopy("Named visitor", "Azonosított látogató")} · ${displayName}`;
      }

      return "";
    }

    function getCustomerSituationSummary(contact = {}) {
      const recentTimelineEntry = (contact.timeline || [])[0] || {};

      return trimText(contact.nextAction?.description)
        || trimText(recentTimelineEntry.summary)
        || trimText(contact.latestOutcome?.label)
        || localizeDashboardCopy("No current situation has been captured yet.", "Még nincs rögzítve aktuális helyzet.");
    }

    function getCustomerRiskSummary(contact = {}) {
      if (customerMissingContactDetails(contact)) {
        return localizeDashboardCopy(
          "No contact details captured yet. This guest can’t be followed up outside the chat.",
          "Még nincs rögzített elérhetőség. Ezt a vendéget a chaten kívül nem lehet utánkövetni."
        );
      }

      if (isComplaintContact(contact)) {
        return localizeDashboardCopy(
          "Risk is elevated. This customer may lose trust if the issue stays unanswered.",
          "Emelkedett a kockázat. Ez az ügyfél elveszítheti a bizalmát, ha az ügy megválaszolatlan marad."
        );
      }

      if (isLeadContact(contact) && contactNeedsReply(contact)) {
        return localizeDashboardCopy(
          "Lead intent is present, but momentum could fade if nobody replies soon.",
          "Az érdeklődési szándék látszik, de a lendület gyorsan elfogyhat, ha senki nem válaszol hamar."
        );
      }

      if (contactNeedsReply(contact)) {
        return localizeDashboardCopy(
          "The conversation is still open and likely needs a team reply or follow-up.",
          "A beszélgetés még nyitott, és valószínűleg csapatválaszra vagy utánkövetésre van szükség."
        );
      }

      if (isResolvedContact(contact)) {
        return localizeDashboardCopy(
          "The latest interaction looks settled right now with no urgent action standing out.",
          "A legutóbbi interakció most rendezettnek tűnik, és nem látszik sürgős teendő."
        );
      }

      if (isReturningContact(contact)) {
        return localizeDashboardCopy(
          "This looks like a returning relationship, so continuity matters more than a generic reply.",
          "Ez visszatérő kapcsolatnak látszik, ezért a folytonosság fontosabb, mint egy általános válasz."
        );
      }

      return localizeDashboardCopy("No strong risk signal is standing out yet.", "Még nem látszik erős kockázati jelzés.");
    }

    function getCustomerSuggestedAction(contact = {}) {
      const nextActionDescription = trimText(contact.nextAction?.description);
      const nextActionTitle = trimText(contact.nextAction?.title);

      if (customerMissingContactDetails(contact)) {
        return localizeDashboardCopy(
          "Open the conversation to review what they asked. Ask for contact details before follow-up.",
          "Nyisd meg a beszélgetést, hogy lásd, mit kérdezett. Utánkövetés előtt kérj elérhetőséget."
        );
      }

      return (!isGenericCustomerNoActionCopy(nextActionDescription) ? nextActionDescription : "")
        || (!isGenericCustomerNoActionTitle(nextActionTitle) ? nextActionTitle : "")
        || (isComplaintContact(contact)
          ? localizeDashboardCopy(
            "Send a calm reply, confirm the issue, and give one clear next step.",
            "Küldj nyugodt választ, erősítsd meg a problémát, és adj egy világos következő lépést."
          )
          : isLeadContact(contact)
            ? localizeDashboardCopy(
              "Answer the open question and guide this person toward a quote, booking, or decision.",
              "Válaszold meg a nyitott kérdést, és vezesd ezt az ügyfelet ajánlatkérés, foglalás vagy döntés felé."
            )
            : isReturningContact(contact)
              ? localizeDashboardCopy(
                "Reconnect with context from the last interaction and confirm the next step.",
                "Kapcsolódj vissza az előző interakció kontextusával, és erősítsd meg a következő lépést."
              )
              : localizeDashboardCopy(
                "Review the latest interaction and decide whether a follow-up is still needed.",
                "Nézd át a legutóbbi interakciót, és döntsd el, kell-e még utánkövetés."
              ));
    }

    function isGenericCustomerNoActionCopy(value = "") {
      const copy = trimText(value).toLowerCase();

      return !copy
        || copy === "this contact does not have a higher-priority owner next step right now."
        || copy === "this contact does not have a higher-priority manual next step right now."
        || copy === "no customer message yet.";
    }

    function isGenericCustomerNoActionTitle(value = "") {
      return ["", "no action needed"].includes(trimText(value).toLowerCase());
    }

    function getCustomerDraftPreview(contact = {}) {
      if (isComplaintContact(contact)) {
        return localizeDashboardCopy(
          "Apologize clearly, confirm the issue, and offer one specific next step with timing.",
          "Kérj világosan bocsánatot, erősítsd meg a problémát, és adj egy konkrét következő lépést időzítéssel."
        );
      }

      if (isLeadContact(contact)) {
        return localizeDashboardCopy(
          "Thank them for reaching out, answer the open question, and suggest the clearest next step.",
          "Köszönd meg a megkeresést, válaszold meg a nyitott kérdést, és javasold a legvilágosabb következő lépést."
        );
      }

      if (contactNeedsReply(contact)) {
        return localizeDashboardCopy(
          "Acknowledge the latest message, answer the main question, and confirm what happens next.",
          "Ismerd el a legutóbbi üzenetet, válaszold meg a fő kérdést, és erősítsd meg, mi történik ezután."
        );
      }

      if (isReturningContact(contact)) {
        return localizeDashboardCopy(
          "Reference the previous interaction, check whether they still need help, and keep the reply warm and brief.",
          "Hivatkozz az előző interakcióra, ellenőrizd, hogy még szükségük van-e segítségre, és tartsd a választ meleg hangvételűnek és rövidnek."
        );
      }

      return "";
    }

    function getCustomerStatusList(contact = {}) {
      const statuses = [];
      const pushStatus = (key, label) => {
        if (!statuses.some((status) => status.key === key)) {
          statuses.push({ key, label });
        }
      };

      if (isGuestCustomerRow(contact)) {
        pushStatus("guest", t("common.guestVisitor"));
      }

      if (isComplaintContact(contact)) {
        pushStatus("complaint", translateDashboardText("Complaint"));
      }

      if (isLeadContact(contact)) {
        pushStatus("lead", translateDashboardText("Lead"));
      }

      if (customerMissingContactDetails(contact) && customerNeedsOwnerReview(contact)) {
        pushStatus("needs_review", translateDashboardText("Needs review"));
        pushStatus("missing_contact", translateDashboardText("Missing contact details"));
      } else if (contactNeedsReply(contact)) {
        pushStatus("needs_reply", t("customers.needsReply"));
      } else if (customerNeedsFollowUp(contact)) {
        pushStatus("follow_up", translateDashboardText("Needs follow-up"));
      }

      if (isResolvedContact(contact)) {
        pushStatus("resolved", translateDashboardText("AI handled"));
      }

      if (isReturningContact(contact)) {
        pushStatus("returning", translateDashboardText("Returning"));
      }

      if (!statuses.length) {
        pushStatus("resolved", translateDashboardText("Resolved"));
      }

      return statuses;
    }

    function _buildCustomerStatusMarkup(contact = {}, limit = 2) {
      return getCustomerStatusList(contact)
        .filter((status) => status.key !== "needs_reply")
        .slice(0, limit)
        .map((status) => `
          <span class="customer-status-chip customer-status-chip--${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>
        `)
        .join("");
    }

    function getPrimaryCustomerStatus(contact = {}) {
      const statuses = getCustomerStatusList(contact);
      return statuses.find((status) => !["guest", "missing_contact"].includes(status.key))
        || statuses[0]
        || { key: "resolved", label: translateDashboardText("Resolved") };
    }

    function buildCustomerFilterDefinitions(contacts = []) {
      const countMatching = (predicate) => contacts.filter(predicate).length;

      return [
        { key: "all", label: translateDashboardText("All"), count: contacts.length },
        { key: "identified", label: translateDashboardText("Identified"), count: countMatching((contact) => !isGuestCustomerRow(contact)) },
        { key: "guests", label: translateDashboardText("Guests"), count: countMatching((contact) => isGuestCustomerRow(contact)) },
        {
          key: "needs_review",
          label: translateDashboardText("Needs review"),
          count: countMatching((contact) => customerNeedsOwnerReview(contact)),
        },
        {
          key: "needs_follow_up",
          label: translateDashboardText("Follow-up possible"),
          count: countMatching((contact) => customerNeedsFollowUp(contact)),
        },
        {
          key: "website_widget",
          label: translateDashboardText("Website widget"),
          count: countMatching((contact) => getCustomerSourceLabels(contact).includes("Website widget")),
        },
        {
          key: "full_page_assistant",
          label: translateDashboardText("Front Desk page"),
          count: countMatching((contact) =>
            getCustomerSourceLabels(contact).some((label) => ["Front Desk page", "Full-page assistant", "QR / direct link", "QR touchpoint"].includes(label))
          ),
        },
      ];
    }

    function buildCustomerSummaryItems(contacts = []) {
      const countMatching = (predicate) => contacts.filter(predicate).length;

      return [
        {
          label: translateDashboardText("New leads"),
          value: countMatching((contact) => trimText(contact.lifecycleState) === "new"),
          copy: translateDashboardText("Trend unavailable: daily lead comparison is not in this workflow yet."),
        },
        {
          label: translateDashboardText("Warm leads"),
          value: countMatching((contact) => ["active_lead", "qualified"].includes(trimText(contact.lifecycleState))),
          copy: translateDashboardText("Live count from saved customer records."),
        },
        {
          label: translateDashboardText("Needs review"),
          value: countMatching((contact) => customerNeedsOwnerReview(contact)),
          copy: translateDashboardText("Customers or guests waiting on a reply, decision, or review."),
        },
        {
          label: translateDashboardText("Missing contact details"),
          value: countMatching((contact) => customerMissingContactDetails(contact) || contact.partialIdentity === true),
          copy: translateDashboardText("Chat unavailable on guest visitor rows until identity is captured."),
        },
      ];
    }

    function getCustomerMetricIcon(label = "") {
      const normalized = trimText(label).toLowerCase();

      if (normalized.includes("warm")) {
        return "users";
      }

      if (normalized.includes("reply")) {
        return "chat";
      }

      if (normalized.includes("missing")) {
        return "review";
      }

      return "chat";
    }

    function buildCustomerMetricCards(contacts = []) {
      return `
        <div class="customer-v2-metric-grid">
          ${buildCustomerSummaryItems(contacts).map((item) => `
            <article class="customer-v2-metric-card">
              <div class="customer-v2-metric-label">
                <span class="customer-v2-metric-icon" aria-hidden="true">${getUiIconMarkup(getCustomerMetricIcon(item.label))}</span>
                <span>${escapeHtml(item.label)}</span>
              </div>
              <strong>${escapeHtml(formatAnalyticsReportNumber(item.value || 0))}</strong>
              <p>${escapeHtml(item.copy)}</p>
            </article>
          `).join("")}
        </div>
      `;
    }

    function getContactFirstSeenAt(contact = {}) {
      const timeline = Array.isArray(contact.timeline) ? contact.timeline : [];
      const datedEntries = timeline
        .map((entry) => entry.at || entry.createdAt || entry.created_at || "")
        .filter((value) => !Number.isNaN(new Date(value).getTime()))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

      return trimText(contact.firstSeenAt || contact.first_seen_at || contact.createdAt || contact.created_at)
        || datedEntries[0]
        || "";
    }

    function getCustomerIntentLabel(contact = {}) {
      const nextActionTitle = trimText(contact.nextAction?.title || contact.nextAction?.label);

      if (nextActionTitle && !isGenericCustomerNoActionTitle(nextActionTitle)) {
        return nextActionTitle;
      }

      const outcomeLabel = trimText(contact.latestOutcome?.label);

      if (outcomeLabel) {
        return outcomeLabel;
      }

      const primaryStatus = getPrimaryCustomerStatus(contact);
      return primaryStatus?.label || translateDashboardText("General inquiry");
    }

    function getCustomerDetailMetaRows(contact = {}) {
      const email = getCustomerEmailLabel(contact.email);
      const phone = trimText(contact.phone);
      const firstSeenAt = getContactFirstSeenAt(contact);

      return [
        email ? { icon: "mail", label: email } : { icon: "mail", label: localizeDashboardCopy("Email missing", "Hiányzó email") },
        phone ? { icon: "phone", label: phone } : { icon: "phone", label: localizeDashboardCopy("Phone missing", "Hiányzó telefon") },
        { icon: "link", label: buildContactSourceSummary(contact) },
        {
          icon: "clock",
          label: firstSeenAt
            ? `${localizeDashboardCopy("First seen", "Első megjelenés")} ${formatSeenAt(firstSeenAt)}`
            : localizeDashboardCopy("First seen unavailable", "Első megjelenés nem elérhető"),
        },
      ];
    }

    function buildCustomerInitials(contact = {}) {
      const label = getCustomerRowIdentifier(contact);
      const parts = trimText(label).split(/\s+/).filter(Boolean);

      if (isGuestCustomerRow(contact)) {
        return "G";
      }

      if (parts.length >= 2) {
        return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
      }

      return trimText(label).slice(0, 2).toUpperCase() || "C";
    }

    function buildContactQuickActions(
      contact = {},
      operatorWorkspace = createEmptyOperatorWorkspace(),
      { includeDraftFollowUp = true } = {}
    ) {
      const actions = [];
      const nextAction = contact.nextAction || {};
      const suggestedSlot = (operatorWorkspace.calendar?.suggestedSlots || [])[0] || null;
      const automationsVisible = isCapabilityVisibleForWorkspace("automations", operatorWorkspace);

      if (contact.latestMessageId) {
        actions.push(`<button class="ghost-button" type="button" data-open-conversation data-message-id="${escapeHtml(contact.latestMessageId)}" data-contact-id="${escapeHtml(contact.id || "")}">${escapeHtml(localizeDashboardCopy("Open related conversation", "Kapcsolódó beszélgetés megnyitása"))}</button>`);
      }

      if (contact.primaryThreadId) {
        actions.push(`<button class="ghost-button" type="button" data-open-inbox-thread data-thread-id="${escapeHtml(contact.primaryThreadId)}">${escapeHtml(localizeDashboardCopy("Open inbox thread", "Email-szál megnyitása"))}</button>`);
      }

      if (nextAction.followUpId) {
        if (automationsVisible) {
          actions.push(`<button class="ghost-button" type="button" data-open-follow-up data-follow-up-id="${escapeHtml(nextAction.followUpId)}">${escapeHtml(localizeDashboardCopy("Open follow-up draft", "Utánkövetési piszkozat megnyitása"))}</button>`);
        } else if (contact.id) {
          actions.push(`<button class="ghost-button" type="button" data-shell-target="contacts" data-target-id="${escapeHtml(contact.id)}">Open customer</button>`);
        }
      } else if (customerHasContactDetails(contact) && automationsVisible && includeDraftFollowUp) {
        actions.push(`
          <button
            class="ghost-button"
            type="button"
            data-draft-contact-followup
            data-contact-name="${escapeHtml(contact.name || "")}"
            data-contact-email="${escapeHtml(contact.email || "")}"
            data-contact-phone="${escapeHtml(contact.phone || "")}"
            data-contact-id="${escapeHtml(contact.id || "")}"
            data-person-key="${escapeHtml(contact.personKey || "")}"
            data-lead-id="${escapeHtml(contact.leadId || "")}"
            data-lifecycle-state="${escapeHtml(contact.lifecycleState || "")}"
          >${escapeHtml(localizeDashboardCopy("Review suggested reply", "Javasolt válasz áttekintése"))}</button>
        `);
      }

      if (nextAction.eventId || contact.primaryEventId) {
        actions.push(`<button class="ghost-button" type="button" data-open-calendar-event data-event-id="${escapeHtml(nextAction.eventId || contact.primaryEventId)}">${escapeHtml(localizeDashboardCopy("Review calendar action", "Naptárművelet áttekintése"))}</button>`);
      } else if ((contact.email || contact.phone) && suggestedSlot?.startAt && suggestedSlot?.endAt) {
        actions.push(`
          <button
            class="ghost-button"
            type="button"
            data-draft-contact-calendar
            data-contact-name="${escapeHtml(contact.name || "")}"
            data-contact-email="${escapeHtml(contact.email || "")}"
            data-contact-phone="${escapeHtml(contact.phone || "")}"
            data-contact-id="${escapeHtml(contact.id || "")}"
            data-lead-id="${escapeHtml(contact.leadId || "")}"
            data-slot-start="${escapeHtml(suggestedSlot.startAt || "")}"
            data-slot-end="${escapeHtml(suggestedSlot.endAt || "")}"
          >${escapeHtml(localizeDashboardCopy("Schedule call", "Hívás ütemezése"))}</button>
        `);
      } else {
        actions.push(`<button class="ghost-button" type="button" data-shell-target="calendar">${escapeHtml(localizeDashboardCopy("Open calendar", "Naptár megnyitása"))}</button>`);
      }

      if (contact.email && automationsVisible) {
        actions.push(`
          <button
            class="ghost-button"
            type="button"
            data-draft-contact-campaign
            data-contact-name="${escapeHtml(contact.name || "")}"
            data-contact-email="${escapeHtml(contact.email || "")}"
            data-contact-id="${escapeHtml(contact.id || "")}"
            data-person-key="${escapeHtml(contact.personKey || "")}"
            data-lead-id="${escapeHtml(contact.leadId || "")}"
            data-goal="${escapeHtml(nextAction.recommendedGoal || getRecommendedCampaignGoal(contact))}"
          >${escapeHtml(localizeDashboardCopy("Draft campaign", "Kampánypiszkozat készítése"))}</button>
        `);
      }

      if (Array.isArray(contact.complaintTaskIds) && contact.complaintTaskIds.length) {
        actions.push(`<button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(contact.complaintTaskIds[0])}" data-task-status="resolved">${escapeHtml(localizeDashboardCopy("Mark complaint resolved", "Panasz megoldottnak jelölése"))}</button>`);
        actions.push(`<button class="ghost-button" type="button" data-update-operator-task data-task-id="${escapeHtml(contact.complaintTaskIds[0])}" data-task-status="escalated">${escapeHtml(localizeDashboardCopy("Escalate", "Eszkalálás"))}</button>`);
      }

      return actions.join("");
    }

    function buildContactsAttentionStrip(operatorWorkspace = createEmptyOperatorWorkspace()) {
      const summary = operatorWorkspace.contacts?.summary || createEmptyOperatorWorkspace().contacts.summary;

      return `
        <div class="overview-grid operator-metric-grid operator-people-grid">
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Needs a follow-up", "Utánkövetést igényel"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.contactsNeedingAttention, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("People who would benefit from a reply, a follow-up, or a next step.", "Olyan emberek, akiknek hasznos lenne egy válasz, utánkövetés vagy következő lépés."))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("At-risk relationships", "Kockázatos kapcsolatok"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.complaintRiskContacts, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("Customers or leads where support context should stay front and center.", "Ügyfelek vagy érdeklődők, akiknél a támogatási kontextusnak kell fókuszban maradnia."))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("No clear next step", "Nincs világos következő lépés"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.leadsWithoutNextStep, "lead"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("Interested people who still need a follow-up, booking, or quote path.", "Érdeklődők, akiknek még utánkövetésre, foglalási vagy ajánlatkérési útra van szükségük."))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Customers to check in with", "Ügyfelek, akikkel érdemes egyeztetni"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.customersAwaitingFollowUp, "customer"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("Customers who could benefit from another touchpoint before momentum fades.", "Ügyfelek, akiknek hasznos lehet még egy érintkezési pont, mielőtt elillan a lendület."))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("Customers with wins", "Eredményt hozó ügyfelek"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.contactsWithOutcomes, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("People records where Vonza can already point to a real result.", "Olyan ügyfélrekordok, ahol a Vonza már valódi eredményt tud felmutatni."))}</p>
          </div>
          <div class="overview-card">
            <p class="overview-label">${escapeHtml(localizeDashboardCopy("High-value still open", "Magas érték még nyitott"))}</p>
            <p class="overview-value">${escapeHtml(formatOperatorCount(summary.highValueWithoutOutcome, "contact"))}</p>
            <p class="overview-card-copy">${escapeHtml(localizeDashboardCopy("Qualified or active leads that still need a real outcome, not just activity.", "Minősített vagy aktív érdeklődők, akiknek még valódi eredményre van szükségük, nem csak aktivitásra."))}</p>
          </div>
        </div>
      `;
    }

    function buildContactSourceSummary(contact = {}) {
      const sources = getCustomerSourceLabels(contact);
      return sources.length ? sources.join(" · ") : localizeDashboardCopy("Sparse record", "Hiányos rekord");
    }

    function buildContactCountsSummary(contact = {}) {
      return [
        formatDashboardCountLabel(contact.counts?.leads || 0, "lead", "leads", "érdeklődő"),
        formatDashboardCountLabel(contact.counts?.inboxThreads || 0, "inbox thread", "inbox threads", "email-szál"),
        formatDashboardCountLabel(contact.counts?.calendarEvents || 0, "calendar event", "calendar events", "naptárbejegyzés"),
        formatDashboardCountLabel(contact.counts?.followUps || 0, "follow-up", "follow-ups", "utánkövetés"),
        formatDashboardCountLabel(contact.counts?.outcomes || 0, "outcome", "outcomes", "eredmény"),
      ].join(" · ");
    }

    function getCustomerChatUnavailableReason(contact = {}) {
      if (customerMissingContactDetails(contact)) {
        return localizeDashboardCopy(
          "Guest visitor only. No contact details captured yet.",
          "Csak vendég látogató. Még nincs rögzített elérhetőség."
        );
      }

      if (!customerHasContactDetails(contact) && !trimText(contact.primaryThreadId)) {
        return localizeDashboardCopy(
          "No contact details captured yet.",
          "Még nincs rögzített elérhetőség."
        );
      }

      return localizeDashboardCopy(
        "Conversation closed or no saved chat messages.",
        "A beszélgetés lezárult, vagy nincs mentett chatüzenet."
      );
    }

    function buildCustomerChatPanel(contact = {}) {
      const messages = Array.isArray(contact.chatMessages) ? contact.chatMessages : [];

      if (isGuestCustomerRow(contact) && !customerHasActiveReplyableChat(contact)) {
        return "";
      }

      if (!messages.length) {
        return `
          <div class="customer-chat-panel" data-customer-chat-panel data-contact-id="${escapeHtml(contact.id || "")}" hidden>
            <div class="customer-chat-empty">${escapeHtml(t("common.noSavedChat"))}</div>
          </div>
        `;
      }

      return `
        <div class="customer-chat-panel" data-customer-chat-panel data-contact-id="${escapeHtml(contact.id || "")}" hidden>
          <div class="customer-chat-list">
            ${messages.map((message, index) => {
              const previousCustomer = message.role === "vonza"
                ? messages.slice(0, index).reverse().find((candidate) => candidate.role !== "vonza")
                : null;
              const canTrain = message.role === "vonza" && previousCustomer && trimText(previousCustomer.content) && trimText(message.content);
              return `
              <div class="customer-chat-message customer-chat-message--${escapeHtml(message.role === "vonza" ? "vonza" : "customer")}">
                <div class="customer-chat-message-meta">
                  <strong>${escapeHtml(message.label === "Vonza" ? t("common.vonza") : t("common.customer"))}</strong>
                  ${message.createdAt ? `<span>${escapeHtml(formatSeenAt(message.createdAt))}</span>` : ""}
                </div>
                <p>${escapeHtml(trimText(message.content) || t("common.noMessageText"))}</p>
                ${canTrain ? `
                  <div class="inline-actions customer-training-actions">
                    <button class="ghost-button" type="button" data-conversation-improve-answer data-question="${escapeHtml(previousCustomer.content || "")}" data-answer="${escapeHtml(message.content || "")}" data-message-id="${escapeHtml(message.id || "")}" data-session-key="${escapeHtml(message.sessionKey || previousCustomer.sessionKey || "")}">Improve this answer</button>
                    <button class="ghost-button" type="button" data-conversation-save-approved-answer data-question="${escapeHtml(previousCustomer.content || "")}" data-answer="${escapeHtml(message.content || "")}" data-message-id="${escapeHtml(message.id || "")}">Save as approved answer</button>
                    <button class="ghost-button" type="button" data-conversation-not-helpful data-question="${escapeHtml(previousCustomer.content || "")}" data-answer="${escapeHtml(message.content || "")}" data-message-id="${escapeHtml(message.id || "")}" data-session-key="${escapeHtml(message.sessionKey || previousCustomer.sessionKey || "")}">Mark not helpful</button>
                  </div>
                ` : ""}
              </div>
            `; }).join("")}
          </div>
        </div>
      `;
    }

    function buildContactRow(contact = {}, _operatorWorkspace = createEmptyOperatorWorkspace()) {
      const statusKeys = getCustomerStatusList(contact).map((status) => status.key).join("|");
      const actionState = getCustomerActionState(contact);
      const rowIdentifier = getCustomerRowIdentifier(contact);
      const secondaryIdentityLine = getCustomerSecondaryIdentityLine(contact);
      const visibleLastActivityAt = getCustomerLastMessageAt(contact);
      const chatMessages = Array.isArray(contact.chatMessages) ? contact.chatMessages : [];
      const guestRow = isGuestCustomerRow(contact);
      const canShowChat = (!guestRow || customerHasActiveReplyableChat(contact)) && chatMessages.length > 0;
      const sourceLabels = getCustomerSourceLabels(contact);
      const identityTone = guestRow ? "guest" : "identified";
      const rowStatuses = getCustomerStatusList(contact).filter((status) => !["guest", "lead"].includes(status.key)).slice(0, 2);
      const chatUnavailableReason = getCustomerChatUnavailableReason(contact);

      return `
        <article
          class="contact-row customer-row"
          role="button"
          tabindex="0"
          aria-selected="false"
          data-contact-row
          data-contact-card
          data-contact-id="${escapeHtml(contact.id || "")}"
          data-customer-row-key="${escapeHtml(contact.customerRowKey || "")}"
          data-contact-lifecycle="${escapeHtml(contact.lifecycleState || "")}"
          data-contact-flags="${escapeHtml(buildContactFlags(contact).join("|"))}"
          data-contact-sources="${escapeHtml(buildContactSources(contact).join("|"))}"
          data-contact-source-labels="${escapeHtml((sourceLabels.length ? sourceLabels : ["Unknown source"]).join("|"))}"
          data-contact-statuses="${escapeHtml(statusKeys)}"
          data-contact-identity="${escapeHtml(guestRow ? "guest" : "identified")}"
          data-contact-needs-owner-review="${actionState.needs_owner_review ? "true" : "false"}"
          data-contact-follow-up-possible="${actionState.follow_up_possible ? "true" : "false"}"
          data-contact-missing-contact-details="${actionState.missing_contact_details ? "true" : "false"}"
          data-contact-reply-possible="${actionState.reply_possible ? "true" : "false"}"
          data-contact-last-activity="${escapeHtml(visibleLastActivityAt)}"
        >
          <div class="contact-row-main">
            <span class="customer-row-select" aria-hidden="true"></span>
            <div class="customer-row-top">
              <div class="customer-row-title-group">
                <span class="customer-avatar customer-avatar--${escapeHtml(identityTone)}" aria-hidden="true">${escapeHtml(buildCustomerInitials(contact))}</span>
                <div>
                  <strong class="contact-row-name">${escapeHtml(rowIdentifier)}</strong>
                  ${secondaryIdentityLine ? `<p class="customer-row-identity">${escapeHtml(secondaryIdentityLine)}</p>` : ""}
                </div>
              </div>
              <div class="customer-row-source">${buildCustomerSourceBadgeMarkup(contact, 1)}</div>
              <div class="customer-row-intent"><span class="customer-intent-chip">${escapeHtml(getCustomerIntentLabel(contact))}</span></div>
              <p class="customer-row-summary">${escapeHtml(getCustomerLatestSummary(contact))}</p>
              <strong class="customer-row-last-seen">${escapeHtml(getCustomerLastActivityLabel(contact))}</strong>
              <div class="customer-row-statuses">
                <span class="customer-identity-chip customer-identity-chip--${escapeHtml(identityTone)}">${escapeHtml(guestRow ? t("common.guestVisitor") : translateDashboardText("Identified"))}</span>
                ${rowStatuses.map((status) => `<span class="customer-status-chip customer-status-chip--${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>`).join("")}
              </div>
            </div>
            <div class="customer-row-meta">
              <button
                class="ghost-button customer-chat-toggle"
                type="button"
                data-toggle-customer-chat
                data-contact-id="${escapeHtml(contact.id || "")}"
                aria-expanded="false"
                ${canShowChat ? "" : "disabled"}
              >${canShowChat ? t("common.viewChat") : t("common.chatUnavailable")}</button>
              ${!canShowChat && chatUnavailableReason ? `<span class="customer-chat-unavailable-reason">${escapeHtml(chatUnavailableReason)}</span>` : ""}
            </div>
          </div>
          ${buildCustomerChatPanel(contact)}
        </article>
      `;
    }

    function buildContactDetailPanel(
      agent = {},
      contact = {},
      operatorWorkspace = createEmptyOperatorWorkspace(),
      selected = false
    ) {
      const primaryStatus = getPrimaryCustomerStatus(contact);
      const guestRow = isGuestCustomerRow(contact);
      const chatMessages = Array.isArray(contact.chatMessages) ? contact.chatMessages : [];
      const canShowChat = (!guestRow || customerHasActiveReplyableChat(contact)) && chatMessages.length > 0;
      const automationsVisible = isCapabilityVisibleForWorkspace("automations", operatorWorkspace);
      const canDraftReply = automationsVisible && customerHasContactDetails(contact);
      const chatUnavailableReason = getCustomerChatUnavailableReason(contact);
      const reviewConversationActionMarkup = contact.latestMessageId ? `
        <button class="primary-button" data-customer-primary-action type="button" data-open-conversation data-message-id="${escapeHtml(contact.latestMessageId)}" data-contact-id="${escapeHtml(contact.id || "")}">${escapeHtml(localizeDashboardCopy("Review conversation", "Beszélgetés áttekintése"))}</button>
      ` : `
        <button class="primary-button" data-customer-primary-action type="button" data-shell-target="contacts" data-target-id="${escapeHtml(contact.id || "")}" ${contact.id ? "" : "disabled"}>${escapeHtml(localizeDashboardCopy("Review conversation", "Beszélgetés áttekintése"))}</button>
      `;
      const primaryActionMarkup = canDraftReply ? `
        <button
          class="primary-button"
          data-customer-primary-action
          type="button"
          data-draft-contact-followup
          data-contact-name="${escapeHtml(contact.name || "")}"
          data-contact-email="${escapeHtml(contact.email || "")}"
          data-contact-phone="${escapeHtml(contact.phone || "")}"
          data-contact-id="${escapeHtml(contact.id || "")}"
          data-person-key="${escapeHtml(contact.personKey || "")}"
          data-lead-id="${escapeHtml(contact.leadId || "")}"
          data-lifecycle-state="${escapeHtml(contact.lifecycleState || "")}"
          ${customerHasContactDetails(contact) ? "" : "disabled"}
        >${escapeHtml(localizeDashboardCopy("Review suggested reply", "Javasolt válasz áttekintése"))}</button>
      ` : customerMissingContactDetails(contact) ? reviewConversationActionMarkup : contact.latestMessageId ? `
        <button class="primary-button" data-customer-primary-action type="button" data-open-conversation data-message-id="${escapeHtml(contact.latestMessageId)}" data-contact-id="${escapeHtml(contact.id || "")}">${escapeHtml(localizeDashboardCopy("Review conversation", "Beszélgetés áttekintése"))}</button>
      ` : contact.primaryThreadId ? `
        <button class="primary-button" data-customer-primary-action type="button" data-open-inbox-thread data-thread-id="${escapeHtml(contact.primaryThreadId)}">${escapeHtml(localizeDashboardCopy("Open inbox thread", "Email-szál megnyitása"))}</button>
      ` : contact.primaryEventId ? `
        <button class="primary-button" data-customer-primary-action type="button" data-open-calendar-event data-event-id="${escapeHtml(contact.primaryEventId)}">${escapeHtml(localizeDashboardCopy("Review calendar action", "Naptárművelet áttekintése"))}</button>
      ` : `
        <button class="primary-button" data-customer-primary-action type="button" data-shell-target="contacts" data-target-id="${escapeHtml(contact.id || "")}" ${contact.id ? "" : "disabled"}>${escapeHtml(localizeDashboardCopy("Review customer", "Ügyfél áttekintése"))}</button>
      `;
      const directChatActionMarkup = `
        <button
          class="ghost-button customer-chat-toggle"
          type="button"
          data-toggle-customer-chat
          data-contact-id="${escapeHtml(contact.id || "")}"
          aria-expanded="false"
          ${canShowChat ? "" : "disabled"}
        >${escapeHtml(canShowChat ? t("common.viewChat") : t("common.chatUnavailable"))}</button>
        ${!canShowChat && chatUnavailableReason ? `<span class="customer-chat-unavailable-reason">${escapeHtml(chatUnavailableReason)}</span>` : ""}
      `;
      const timelineMarkup = Array.isArray(contact.timeline) && contact.timeline.length ? `
        <div class="timeline-list customer-timeline-list">
          ${contact.timeline.slice(0, 5).map((entry) => `
            <div class="timeline-row">
              <div>
                <strong>${escapeHtml(entry.at ? formatSeenAt(entry.at) : translateDashboardText(entry.label || "Recent"))}</strong>
                <span>${escapeHtml(translateDashboardText(trimText(entry.label || entry.source || "Activity")))}</span>
              </div>
              <p class="customer-timeline-copy">${escapeHtml(trimText(entry.summary) || localizeDashboardCopy("No additional note stored for this interaction.", "Nincs további megjegyzés eltárolva ehhez az interakcióhoz."))}</p>
            </div>
          `).join("")}
        </div>
      ` : `<div class="placeholder-card">${escapeHtml(localizeDashboardCopy("No timeline details are stored yet.", "Még nincs eltárolt idővonal-részlet."))}</div>`;
      const customerRiskSummary = getCustomerRiskSummary(contact);
      const detailDisclosureMarkup = buildDisclosureBlock({
        label: localizeDashboardCopy("View timeline", "Idővonal megnyitása"),
        summary: `${contact.timeline?.length || 0} interaction${contact.timeline?.length === 1 ? "" : "s"}`,
        className: "customer-detail-disclosure",
        contentMarkup: `
            <div class="customer-detail-disclosure-section">
            ${canDraftReply ? `
              <div class="customer-draft-card">
                <span class="detail-kv-label">${escapeHtml(localizeDashboardCopy("Reply idea", "Válaszötlet"))}</span>
                <strong>${escapeHtml(getCustomerDraftPreview(contact))}</strong>
              </div>
            ` : ""}
          </div>
          ${buildDisclosureDetailRows([
            { label: localizeDashboardCopy("Customer", "Ügyfél"), value: getCustomerName(contact), copy: getCustomerIdentityLabel(contact) },
            { label: localizeDashboardCopy("Identifier", "Azonosító"), value: getCustomerIdentifier(contact), copy: buildContactSourceSummary(contact) },
            { label: localizeDashboardCopy("Previous interactions", "Korábbi interakciók"), value: buildContactCountsSummary(contact) },
            {
              label: localizeDashboardCopy("Latest outcome", "Legutóbbi eredmény"),
              value: trimText(contact.latestOutcome?.label) || localizeDashboardCopy("No recorded result yet", "Még nincs rögzített eredmény"),
              copy: contact.latestOutcome?.occurredAt
                ? `${localizeDashboardCopy("Updated", "Frissítve")} ${formatSeenAt(contact.latestOutcome.occurredAt)}`
                : localizeDashboardCopy("No recent outcome has been recorded.", "Nem lett rögzítve friss eredmény."),
            },
          ])}
          ${timelineMarkup}
          <form class="detail-inline-form" data-contact-lifecycle-form data-contact-id="${escapeHtml(contact.id || "")}">
            <label for="contact-detail-lifecycle-${escapeHtml(contact.id || contact.name || "contact")}">${escapeHtml(localizeDashboardCopy("Customer type", "Ügyféltípus"))}</label>
            <div class="detail-inline-form-row">
              <select id="contact-detail-lifecycle-${escapeHtml(contact.id || contact.name || "contact")}" name="lifecycle_state">
                ${["new", "active_lead", "qualified", "customer", "support_issue", "complaint_risk", "dormant"].map((state) => `
                  <option value="${escapeHtml(state)}" ${state === contact.lifecycleState ? "selected" : ""}>${escapeHtml(formatContactLifecycleLabel(state))}</option>
                `).join("")}
              </select>
              <button class="ghost-button" type="submit" ${contact.id ? "" : "disabled"}>${escapeHtml(t("common.save"))}</button>
            </div>
          </form>
          ${isCapabilityExplicitlyVisible("manual_outcome_marks") ? `
            <form class="action-queue-follow-up-form" data-manual-outcome-form data-contact-id="${escapeHtml(contact.id || "")}" data-lead-id="${escapeHtml(contact.leadId || "")}" data-follow-up-id="${escapeHtml(contact.primaryFollowUpId || "")}" data-inbox-thread-id="${escapeHtml(contact.primaryThreadId || "")}" data-calendar-event-id="${escapeHtml(contact.primaryEventId || "")}" data-person-key="${escapeHtml(contact.personKey || "")}">
              <div class="form-grid two-col">
                <div class="field">
                  <label for="contact-outcome-${escapeHtml(contact.id || contact.name || "contact")}">${escapeHtml(localizeDashboardCopy("Outcome mark", "Eredményjelölés"))}</label>
                  <select id="contact-outcome-${escapeHtml(contact.id || contact.name || "contact")}" name="outcome_type" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
                    <option value="booking_confirmed">${escapeHtml(localizeDashboardCopy("booked", "lefoglalva"))}</option>
                    <option value="quote_requested">${escapeHtml(localizeDashboardCopy("quote requested", "ajánlatkérés érkezett"))}</option>
                    <option value="quote_accepted">${escapeHtml(localizeDashboardCopy("quote accepted", "ajánlat elfogadva"))}</option>
                    <option value="follow_up_replied">${escapeHtml(localizeDashboardCopy("follow-up successful", "utánkövetés sikeres"))}</option>
                    <option value="complaint_resolved">${escapeHtml(localizeDashboardCopy("complaint resolved", "panasz megoldva"))}</option>
                    <option value="manual_outcome_marked">${escapeHtml(localizeDashboardCopy("no outcome / manual note", "nincs eredmény / kézi megjegyzés"))}</option>
                  </select>
                </div>
                <div class="field">
                  <label for="contact-outcome-note-${escapeHtml(contact.id || contact.name || "contact")}">${escapeHtml(localizeDashboardCopy("Note", "Megjegyzés"))}</label>
                  <input id="contact-outcome-note-${escapeHtml(contact.id || contact.name || "contact")}" name="note" type="text" ${agent.manualOutcomeMode === true ? "" : "disabled"}>
                </div>
              </div>
              <div class="action-queue-form-actions">
                <button class="ghost-button" type="submit" ${agent.manualOutcomeMode === true ? "" : "disabled"}>${escapeHtml(localizeDashboardCopy("Record outcome", "Eredmény rögzítése"))}</button>
              </div>
            </form>
          ` : ""}
        `,
      });

      return `
        <article
          class="contact-detail-panel customer-detail-panel ${selected ? "active" : ""}"
          data-contact-detail
          data-contact-card
          data-contact-id="${escapeHtml(contact.id || "")}"
          ${selected ? "" : "hidden"}
        >
          <div class="customer-detail-topbar">
            <span class="customer-avatar customer-avatar--${escapeHtml(guestRow ? "guest" : "identified")}" aria-hidden="true">${escapeHtml(buildCustomerInitials(contact))}</span>
            <div class="customer-detail-intro">
              <div class="customer-detail-heading-row">
                <h2 class="contact-detail-title">${escapeHtml(getCustomerRowIdentifier(contact))}</h2>
                ${primaryStatus ? `<span class="customer-status-chip customer-status-chip--${escapeHtml(primaryStatus.key)}">${escapeHtml(primaryStatus.label)}</span>` : ""}
              </div>
              <p class="contact-detail-copy">${escapeHtml(getCustomerIdentityLabel(contact))}</p>
              <div class="customer-detail-meta-list">
                ${getCustomerDetailMetaRows(contact).map((item) => `
                  <span>${getUiIconMarkup(item.icon)}${escapeHtml(item.label)}</span>
                `).join("")}
              </div>
            </div>
          </div>
          <div class="customer-detail-card customer-detail-summary-card">
            <span class="detail-kv-label">${escapeHtml(localizeDashboardCopy("What happened", "Mi történt"))}</span>
            <p>${escapeHtml(getCustomerSituationSummary(contact))}</p>
            <span class="customer-intent-chip">${escapeHtml(getCustomerIntentLabel(contact))}</span>
          </div>
          <div class="customer-detail-card customer-why-card">
            <span class="detail-kv-label">${escapeHtml(localizeDashboardCopy("Why it matters", "Miért fontos"))}</span>
            <p>${escapeHtml(customerRiskSummary)}</p>
          </div>
          <div class="customer-detail-card customer-suggested-action-card">
            <span class="detail-kv-label">${escapeHtml(localizeDashboardCopy("Next action", "Következő lépés"))}</span>
            <strong>${escapeHtml(getCustomerSuggestedAction(contact))}</strong>
          </div>
          <div class="customer-detail-card customer-timeline-card">
            <div class="customer-card-heading">
              <span class="detail-kv-label">${escapeHtml(localizeDashboardCopy("Recent activity", "Friss aktivitás"))}</span>
              <span>${escapeHtml(formatDashboardCountLabel(contact.timeline?.length || 0, "interaction", "interactions", "interakció"))}</span>
            </div>
            ${timelineMarkup}
          </div>
          <div class="inline-actions customer-primary-actions">
            ${directChatActionMarkup}
            ${primaryActionMarkup}
            <button
              class="ghost-button customer-secondary-button"
              type="button"
              data-contact-quick-status="customer"
              data-contact-id="${escapeHtml(contact.id || "")}"
              ${contact.id ? "" : "disabled"}
            >${escapeHtml(localizeDashboardCopy("Mark reviewed", "Áttekintettnek jelölés"))}</button>
          </div>
          ${detailDisclosureMarkup}
        </article>
      `;
    }

    function buildCustomerOperatorBrief(contacts = [], contactsHealth = {}) {
      const totalContacts = contacts.length;
      const needsReview = contacts.filter(customerNeedsOwnerReview).length;
      const leads = contacts.filter(isLeadContact).length;
      const frontDeskPageContacts = contacts.filter((contact) =>
        buildContactSources(contact).some((source) => normalizeCustomerFilter(source) === "full_page_assistant")
      ).length;
      const primaryCopy = totalContacts
        ? localizeDashboardCopy(
          "Use the list for scanning, then work the selected customer from the inspector without losing context.",
          "A listában gyorsan áttekintheted az ügyfeleket, majd a kiválasztott ügyfél részletein dolgozhatsz a kontextus elvesztése nélkül."
        )
        : localizeDashboardCopy(
          "Customer records will appear here after real Front Desk conversations, leads, or follow-ups exist.",
          "Az ügyfélrekordok akkor jelennek meg itt, amikor valódi Front Desk beszélgetések, érdeklődők vagy utánkövetések jönnek létre."
        );

      return `
        <section class="glass-hero customer-operator-brief" aria-label="${escapeHtml(localizeDashboardCopy("Customer operating brief", "Ügyfél operációs összefoglaló"))}">
          <div class="customer-operator-brief-copy">
            <p class="glass-kicker">${escapeHtml(localizeDashboardCopy("Customer operations", "Ügyfélműveletek"))}</p>
            <h2>${escapeHtml(needsReview > 0
              ? localizeDashboardCopy("Start with customers that need a next step.", "Kezdd azokkal az ügyfelekkel, akiknek következő lépés kell.")
              : localizeDashboardCopy("Customer workspace is ready.", "Az ügyfélmunkaterület készen áll."))}</h2>
            <p>${escapeHtml(primaryCopy)}</p>
          </div>
          <div class="customer-operator-brief-metrics" aria-label="${escapeHtml(localizeDashboardCopy("Customer summary", "Ügyfélösszegzés"))}">
            <span><strong>${escapeHtml(String(totalContacts))}</strong>${escapeHtml(localizeDashboardCopy("total", "összesen"))}</span>
            <span><strong>${escapeHtml(String(needsReview))}</strong>${escapeHtml(localizeDashboardCopy("need review", "áttekintendő"))}</span>
            <span><strong>${escapeHtml(String(leads))}</strong>${escapeHtml(localizeDashboardCopy("leads", "érdeklődő"))}</span>
            <span><strong>${escapeHtml(String(frontDeskPageContacts))}</strong>${escapeHtml(localizeDashboardCopy("Front Desk", "Front Desk"))}</span>
          </div>
          ${contactsHealth.loadError ? `<p class="customer-operator-warning">${escapeHtml(contactsHealth.loadError)}</p>` : ""}
        </section>
      `;
    }

    function getCustomerEmptyStateContext(productKey = "") {
      const normalizedProductKey = normalizeCustomerProductKey(productKey);
      return CUSTOMER_EMPTY_STATE_BY_PRODUCT[normalizedProductKey] || CUSTOMER_EMPTY_STATE_BY_PRODUCT.front_desk;
    }

    function buildCustomerEmptyActionMarkup(action = {}) {
      const attributes = [
        `class="ghost-button"`,
        `href="${escapeHtml(action.href || "#customers")}"`,
        action.shellTarget ? `data-shell-target="${escapeHtml(action.shellTarget)}"` : "",
        action.settingsTarget ? `data-settings-target="${escapeHtml(action.settingsTarget)}"` : "",
        action.installMethod ? `data-install-method-jump="${escapeHtml(action.installMethod)}"` : "",
      ].filter(Boolean);

      return `<a ${attributes.join(" ")}>${escapeHtml(action.label || "Open setup")}</a>`;
    }

    function buildCustomerProductEmptyState(productKey = "") {
      const context = getCustomerEmptyStateContext(productKey);

      return buildOperatorEmptyState({
        title: context.title,
        copy: context.copy,
        actionMarkup: context.actions.map(buildCustomerEmptyActionMarkup).join(""),
      });
    }

    function buildContactsPanel(agent = {}, operatorWorkspace = createEmptyOperatorWorkspace(), options = {}) {
      const contacts = operatorWorkspace.contacts?.list || [];
      const contactsHealth = operatorWorkspace.contacts?.health || createEmptyOperatorWorkspace().contacts.health;
      const activeProductKey = normalizeCustomerProductKey(options.activeProduct || options.productKey || options.product || "");
      const customerFilters = buildCustomerFilterDefinitions(contacts);
      const filtersMarkup = `
        <div class="customer-filter-strip" data-customer-filter-strip>
          ${customerFilters.map((filter, index) => `
            <button class="contact-filter-button customer-filter-pill ${index === 0 ? "active" : ""}" type="button" data-contact-filter="${escapeHtml(filter.key)}" aria-pressed="${index === 0 ? "true" : "false"}">
              <span>${escapeHtml(filter.label)}</span>
              <strong>${escapeHtml(String(filter.count))}</strong>
            </button>
          `).join("")}
        </div>
      `;
      const searchMarkup = `
        <div class="toolbar-search customer-toolbar-search">
          <label class="sr-only" for="customer-search-input">${escapeHtml(translateDashboardText("Search customers"))}</label>
          <input id="customer-search-input" data-contact-search type="search" placeholder="${escapeHtml(translateDashboardText("Search by name, email, phone, or conversation"))}">
        </div>
      `;
      const peopleWorkspaceMarkup = `
        ${buildCustomerOperatorBrief(contacts, contactsHealth)}
        ${buildCustomerMetricCards(contacts)}
        <div class="contacts-workspace" data-contacts-workspace>
          <section class="contacts-list-shell">
            <div class="contacts-list-header">
              <div>
                <h3 class="flat-section-title">${escapeHtml(translateDashboardText("All customers"))}</h3>
                <p class="workspace-panel-copy">${escapeHtml(t("customers.listCopy"))}</p>
              </div>
              <button class="ghost-button customer-banner-button" type="button" data-contact-filter="needs_review">${escapeHtml(localizeDashboardCopy("Show customers needing review", "Áttekintésre váró ügyfelek mutatása"))}</button>
            </div>
            <div class="customer-table-head" aria-hidden="true">
              <span></span>
              <span>${escapeHtml(translateDashboardText("Customer"))}</span>
              <span>${escapeHtml(translateDashboardText("Source"))}</span>
              <span>${escapeHtml(translateDashboardText("Intent"))}</span>
              <span>${escapeHtml(t("common.lastMessage"))}</span>
              <span>${escapeHtml(translateDashboardText("Last seen"))}</span>
              <span>${escapeHtml(translateDashboardText("Status"))}</span>
              <span>${escapeHtml(t("common.viewChat"))}</span>
            </div>
            <div class="contacts-list" data-contact-filter-results>
              ${contacts.map((contact) => buildContactRow(contact, operatorWorkspace)).join("")}
            </div>
          </section>
          <aside class="contacts-detail-shell">
            ${contacts.map((contact, index) => buildContactDetailPanel(agent, contact, operatorWorkspace, index === 0)).join("")}
          </aside>
        </div>
      `;

      return `
        <section class="workspace-page" data-shell-section="contacts" hidden>
          ${buildPageHeader({
            title: t("customers.title"),
            copy: t("customers.subtitle"),
          })}
          ${contacts.length ? buildPageToolbar({ searchMarkup, filtersMarkup }) : ""}
          <div class="workspace-page-body">
            <div class="workspace-section-stack">
              ${contactsHealth.loadError ? `<div class="operator-inline-alert"><p>${escapeHtml(localizeDashboardCopy("Some contact history is still loading:", "Néhány ügyfélelőzmény még töltődik:"))} ${escapeHtml(contactsHealth.loadError)}</p></div>` : ""}
              ${!contacts.length ? buildCustomerProductEmptyState(activeProductKey) : peopleWorkspaceMarkup}
            </div>
          </div>
        </section>
      `;
    }

  function normalizeCustomerFilter(value = "") {
    const normalized = sanitizeText(value).toLowerCase().replace(/[_\s]+/g, "-");
    const aliases = { unresolved: "needs_review", review: "needs_review", followup: "needs_follow_up", "follow-up": "needs_follow_up", guest: "guests", widget: "website_widget", page: "full_page_assistant", fullpage: "full_page_assistant", "full-page": "full_page_assistant" };
    const candidate = aliases[normalized] || normalized.replace(/-/g, "_");
    return ["all", "identified", "guests", "needs_review", "needs_follow_up", "needs_reply", "website_widget", "full_page_assistant", "leads", "complaints", "resolved"].includes(candidate) ? candidate : "all";
  }

  function getCustomerFilterLabel(filterKey = "") {
    const labels = { all: "All", identified: "Identified", guests: "Guests", needs_review: "Needs review", needs_follow_up: "Follow-up possible", needs_reply: "Needs reply", website_widget: "Website widget", full_page_assistant: "Front Desk page", leads: "Leads", complaints: "Complaints", resolved: "Resolved" };
    return translateDashboardText(labels[normalizeCustomerFilter(filterKey)] || labels.all);
  }

  function deriveCustomerReachability(contact = {}) {
    const hasContactDetails = customerHasContactDetails(contact);
    const activeReplyableChat = customerHasActiveReplyableChat(contact);
    const replyPossible = customerHasReplyableChannel(contact);
    const missingContactDetails = customerMissingContactDetails(contact);
    return { hasContactDetails, activeReplyableChat, replyPossible, missingContactDetails, reason: replyPossible ? "" : getCustomerChatUnavailableReason(contact) };
  }

  function deriveCustomerReviewState(contact = {}) {
    const actionState = getCustomerActionState(contact);
    return { ...actionState, needsReply: contactNeedsReply(contact), needsReview: actionState.needs_owner_review, followUpPossible: actionState.follow_up_possible };
  }

  function deriveCustomerStatusBadges(contact = {}) {
    return getCustomerStatusList(contact);
  }

  function getCustomerPrimaryAction(contact = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
    const automationsVisible = isCapabilityVisibleForWorkspace("automations", operatorWorkspace);
    if (automationsVisible && customerHasContactDetails(contact)) return { key: "review_suggested_reply", label: localizeDashboardCopy("Review suggested reply", "Javasolt válasz áttekintése"), enabled: true };
    if (customerMissingContactDetails(contact)) return { key: "review_conversation", label: localizeDashboardCopy("Review conversation", "Beszélgetés áttekintése"), enabled: Boolean(contact.latestMessageId || contact.id), reason: getCustomerChatUnavailableReason(contact) };
    if (contact.latestMessageId) return { key: "review_conversation", label: localizeDashboardCopy("Review conversation", "Beszélgetés áttekintése"), enabled: true };
    if (contact.primaryThreadId) return { key: "open_inbox_thread", label: localizeDashboardCopy("Open inbox thread", "Email-szál megnyitása"), enabled: true };
    if (contact.primaryEventId) return { key: "review_calendar_action", label: localizeDashboardCopy("Review calendar action", "Naptárművelet áttekintése"), enabled: true };
    return { key: "review_customer", label: localizeDashboardCopy("Review customer", "Ügyfél áttekintése"), enabled: Boolean(contact.id) };
  }

  function getCustomerSecondaryActions(contact = {}, operatorWorkspace = createEmptyOperatorWorkspace()) {
    const markup = buildContactQuickActions(contact, operatorWorkspace);
    return { markup, labels: Array.from(markup.matchAll(/>([^<>]+)<\/button>/g)).map((match) => sanitizeText(match[1])).filter(Boolean) };
  }

  function renderConversationMessage(message = {}, index = 0, messages = []) {
    const previousCustomer = message.role === "vonza" ? messages.slice(0, index).reverse().find((candidate) => candidate.role !== "vonza") : null;
    const canTrain = message.role === "vonza" && previousCustomer && sanitizeText(previousCustomer.content) && sanitizeText(message.content);
    const roleClass = sanitizeHtml(message.role === "vonza" ? "vonza" : "customer");
    const label = sanitizeHtml(message.label === "Vonza" ? t("common.vonza") : t("common.customer"));
    const created = message.createdAt ? '<span>' + sanitizeHtml(formatSeenAt(message.createdAt)) + '</span>' : '';
    const training = canTrain ? '<div class="inline-actions customer-training-actions"><button class="ghost-button" type="button" data-conversation-improve-answer data-question="' + sanitizeHtml(previousCustomer.content || "") + '" data-answer="' + sanitizeHtml(message.content || "") + '" data-message-id="' + sanitizeHtml(message.id || "") + '" data-session-key="' + sanitizeHtml(message.sessionKey || previousCustomer.sessionKey || "") + '">Improve this answer</button><button class="ghost-button" type="button" data-conversation-save-approved-answer data-question="' + sanitizeHtml(previousCustomer.content || "") + '" data-answer="' + sanitizeHtml(message.content || "") + '" data-message-id="' + sanitizeHtml(message.id || "") + '">Save as approved answer</button><button class="ghost-button" type="button" data-conversation-not-helpful data-question="' + sanitizeHtml(previousCustomer.content || "") + '" data-answer="' + sanitizeHtml(message.content || "") + '" data-message-id="' + sanitizeHtml(message.id || "") + '" data-session-key="' + sanitizeHtml(message.sessionKey || previousCustomer.sessionKey || "") + '">Mark not helpful</button></div>' : '';
    return '<div class="customer-chat-message customer-chat-message--' + roleClass + '"><div class="customer-chat-message-meta"><strong>' + label + '</strong>' + created + '</div><p>' + sanitizeHtml(sanitizeText(message.content) || t("common.noMessageText")) + '</p>' + training + '</div>';
  }

  function renderCustomerEmptyState(productKey = "") {
    return buildCustomerProductEmptyState(productKey);
  }

  function renderCustomerFilterTabs(contacts = []) {
    return '<div class="customer-filter-strip" data-customer-filter-strip>' + buildCustomerFilterDefinitions(contacts).map((filter, index) => '<button class="contact-filter-button customer-filter-pill ' + (index === 0 ? 'active' : '') + '" type="button" data-contact-filter="' + sanitizeHtml(filter.key) + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '"><span>' + sanitizeHtml(filter.label) + '</span><strong>' + sanitizeHtml(String(filter.count)) + '</strong></button>').join('') + '</div>';
  }

  function formatCustomerTime(value = "") {
    return value ? formatSeenAt(value) : t("common.noCustomerMessage");
  }

  function formatCustomerIdentity(contact = {}) {
    return { name: getCustomerName(contact), identifier: getCustomerIdentifier(contact), label: getCustomerIdentityLabel(contact), secondaryLine: getCustomerSecondaryIdentityLine(contact), isGuest: isGuestCustomerRow(contact) };
  }
  return {
    normalizeCustomerFilter,
    normalizeCustomerProductKey,
    getCustomerEmptyStateContext,
    buildCustomerProductEmptyState,
    getCustomerFilterLabel,
    getCustomerSourceLabel,
    deriveCustomerReachability,
    deriveCustomerReviewState,
    deriveCustomerStatusBadges,
    getCustomerPrimaryAction,
    getCustomerSecondaryActions,
    renderConversationMessage,
    renderCustomerEmptyState,
    renderCustomerFilterTabs,
    formatCustomerTime,
    formatCustomerIdentity,
    contactNeedsReply,
    customerHasContactDetails,
    customerHasActiveReplyableChat,
    customerHasReplyableChannel,
    customerNeedsOwnerReviewRaw,
    getCustomerActionState,
    customerMissingContactDetails,
    customerNeedsOwnerReview,
    customerNeedsFollowUp,
    isComplaintContact,
    isLeadContact,
    isResolvedContact,
    isReturningContact,
    normalizeCustomerLabelForCompare,
    isPlaceholderCustomerLabel,
    isLikelyCustomerMessageLabel,
    getValidCustomerLabel,
    getCustomerEmailLabel,
    getNamedCustomerIdentity,
    getCustomerName,
    getCustomerRowIdentifier,
    getCustomerIdentityLabel,
    getCustomerIdentifier,
    getCustomerLastMessageAt,
    hasGuestCustomerActivity,
    getCustomerLastActivityLabel,
    isGuestCustomerRow,
    getCustomerConversationSourceText,
    getGuestConversationRowSummary,
    getCustomerLatestSummary,
    getCustomerSecondaryIdentityLine,
    getCustomerSituationSummary,
    getCustomerRiskSummary,
    getCustomerSuggestedAction,
    isGenericCustomerNoActionCopy,
    isGenericCustomerNoActionTitle,
    getCustomerDraftPreview,
    getCustomerStatusList,
    getPrimaryCustomerStatus,
    buildCustomerFilterDefinitions,
    buildCustomerSummaryItems,
    getCustomerMetricIcon,
    buildCustomerMetricCards,
    getContactFirstSeenAt,
    getCustomerIntentLabel,
    getCustomerDetailMetaRows,
    buildCustomerInitials,
    getCustomerSourceLabels,
    buildCustomerSourceBadgeMarkup,
    buildContactQuickActions,
    buildContactsAttentionStrip,
    buildContactSourceSummary,
    buildContactCountsSummary,
    getCustomerChatUnavailableReason,
    buildCustomerChatPanel,
    buildContactRow,
    buildContactDetailPanel,
    buildContactsPanel,
    renderCustomerRow: buildContactRow,
    renderCustomerDetailPanel: buildContactDetailPanel,
    buildCustomerStatusMarkup: _buildCustomerStatusMarkup,
  };
  }

  const defaultHelpers = createCustomerHelpers();

  global.VonzaDashboardCustomers = Object.freeze({
    createCustomerHelpers,
    ...defaultHelpers,
  });
})(window);
