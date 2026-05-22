(function registerVonzaDashboardLabels(global) {
  function trimText(value) {
    return String(value || "").trim();
  }

  function titleCaseWords(value) {
    return trimText(value).replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function formatDateTimeLocalValue(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  }

  function formatContactLifecycleLabel(value = "") {
    const normalized = trimText(value).replaceAll("_", " ");
    return normalized ? titleCaseWords(normalized) : "New";
  }

  function getCustomerSourceLabel(source = "") {
    const normalized = trimText(source)
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    if (!normalized) {
      return "";
    }

    if (normalized.includes("qr")) {
      return "QR / direct link";
    }

    if (normalized.includes("full page") || normalized === "page" || normalized.includes("assistant page")) {
      return "Front Desk page";
    }

    if (normalized.includes("embedded") || normalized.includes("iframe")) {
      return "Embedded assistant";
    }

    if (normalized.includes("widget") || normalized.includes("chat")) {
      return "Website widget";
    }

    if (normalized.includes("inbox") || normalized.includes("email")) {
      return "Inbox";
    }

    if (normalized.includes("calendar")) {
      return "Calendar";
    }

    if (normalized.includes("campaign")) {
      return "Campaign";
    }

    if (normalized.includes("follow up") || normalized.includes("follow-up")) {
      return "Follow-up";
    }

    if (normalized.includes("conversion")) {
      return "Recorded outcome";
    }

    return titleCaseWords(normalized);
  }

  function normalizeActionQueueStatus(value, allowedStatuses = []) {
    const normalized = trimText(value).toLowerCase();
    return allowedStatuses.includes(normalized) ? normalized : "new";
  }

  function getActionQueueStatusLabel(status, allowedStatuses = []) {
    switch (normalizeActionQueueStatus(status, allowedStatuses)) {
      case "reviewed":
        return "Reviewed";
      case "done":
        return "Done";
      case "dismissed":
        return "Dismissed";
      default:
        return "New";
    }
  }

  function getFollowUpStatusLabel(value) {
    const normalized = trimText(value).toLowerCase();

    switch (normalized) {
      case "draft":
        return "Draft";
      case "ready":
        return "Ready";
      case "sent":
        return "Sent";
      case "failed":
        return "Failed";
      case "dismissed":
        return "Dismissed";
      case "missing_contact":
        return "Missing contact";
      default:
        return "Not prepared";
    }
  }

  function getKnowledgeFixStatusLabel(value) {
    const normalized = trimText(value).toLowerCase();

    switch (normalized) {
      case "new":
      case "draft":
        return "New";
      case "reviewing":
      case "ready":
        return "Reviewing";
      case "approved_fixed":
      case "applied":
        return "Approved/fixed";
      case "dismissed":
        return "Dismissed";
      case "failed":
        return "Failed";
      default:
        return "Not prepared";
    }
  }

  function formatCaptureRate(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "0%";
    }

    return `${Math.round(numeric * 100)}%`;
  }

  function getOutcomeTypeLabel(value) {
    switch (trimText(value).toLowerCase()) {
      case "booking_started":
        return "Booking started";
      case "booking_confirmed":
        return "Booking confirmed";
      case "quote_requested":
        return "Quote requested";
      case "quote_sent":
        return "Quote sent";
      case "quote_accepted":
        return "Quote accepted";
      case "checkout_started":
        return "Checkout started";
      case "checkout_completed":
        return "Checkout completed";
      case "contact_clicked":
        return "Contact clicked";
      case "email_clicked":
        return "Email clicked";
      case "phone_clicked":
        return "Phone clicked";
      case "follow_up_sent":
        return "Follow-up sent";
      case "follow_up_replied":
        return "Follow-up replied";
      case "complaint_opened":
        return "Complaint opened";
      case "complaint_resolved":
        return "Complaint resolved";
      case "campaign_sent":
        return "Campaign sent";
      case "campaign_replied":
        return "Campaign replied";
      case "campaign_converted":
        return "Campaign converted";
      case "manual_outcome_marked":
        return "Fallback outcome";
      default:
        return "Outcome";
    }
  }

  global.VonzaDashboardLabels = Object.freeze({
    formatDateTimeLocalValue,
    formatContactLifecycleLabel,
    getCustomerSourceLabel,
    normalizeActionQueueStatus,
    getActionQueueStatusLabel,
    getFollowUpStatusLabel,
    getKnowledgeFixStatusLabel,
    formatCaptureRate,
    getOutcomeTypeLabel,
  });
})(window);
