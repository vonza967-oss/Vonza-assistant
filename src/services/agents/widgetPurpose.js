import { cleanText } from "../../utils/text.js";

export const DEFAULT_WIDGET_PURPOSE = "support";

export const WIDGET_PURPOSE_OPTIONS = Object.freeze([
  {
    value: "guidance",
    label: "Guidance",
    description: "Help visitors find what they need quickly and understand where to go next.",
    instruction:
      "Help visitors find the right information quickly, explain the clearest path, and keep the next step easy to understand.",
  },
  {
    value: "support",
    label: "Support",
    description: "Answer customer questions and solve common issues.",
    instruction:
      "Focus on answering customer questions, resolving common confusion, and giving calm support before suggesting a next step.",
  },
  {
    value: "make_decision",
    label: "Make a decision",
    description: "Help visitors choose the right service, product, or next step.",
    instruction:
      "Help visitors compare options, understand tradeoffs in plain language, and choose the right service, product, or next step.",
  },
  {
    value: "lead_capture",
    label: "Lead capture / contact",
    description: "Guide warm visitors toward contact details or a clear follow-up.",
    instruction:
      "When visitors show interest, make the contact or quote path clear and naturally guide them toward sharing details for follow-up.",
  },
  {
    value: "booking_next_step",
    label: "Booking / next step guidance",
    description: "Help visitors book, request a quote, or move to the next step.",
    instruction:
      "Keep answers oriented around the best practical next step, especially booking, quote, contact, or other configured routes.",
  },
]);

const PURPOSE_ALIASES = new Map([
  ["guide", "guidance"],
  ["guidance", "guidance"],
  ["visitor_guidance", "guidance"],
  ["support", "support"],
  ["help", "support"],
  ["help_customers", "support"],
  ["customer_support", "support"],
  ["make_decision", "make_decision"],
  ["make_a_decision", "make_decision"],
  ["decision", "make_decision"],
  ["decide", "make_decision"],
  ["help_customers_decide", "make_decision"],
  ["lead_capture", "lead_capture"],
  ["lead_capture_contact", "lead_capture"],
  ["contact", "lead_capture"],
  ["capture", "lead_capture"],
  ["booking", "booking_next_step"],
  ["booking_next_step", "booking_next_step"],
  ["next_step", "booking_next_step"],
]);

function normalizePurposeToken(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeWidgetPurpose(value) {
  const rawValue = cleanText(value);
  const normalized = normalizePurposeToken(rawValue);

  if (PURPOSE_ALIASES.has(normalized)) {
    return PURPOSE_ALIASES.get(normalized);
  }

  if (/decision|decide|choose|compare/.test(normalized)) {
    return "make_decision";
  }

  if (/lead|capture|contact|follow_up|quote/.test(normalized)) {
    return "lead_capture";
  }

  if (/book|booking|next_step/.test(normalized)) {
    return "booking_next_step";
  }

  if (/guid|find|navigate/.test(normalized)) {
    return "guidance";
  }

  if (/support|question|issue|help/.test(normalized)) {
    return "support";
  }

  return DEFAULT_WIDGET_PURPOSE;
}

export function getWidgetPurposeOption(value) {
  const normalizedPurpose = normalizeWidgetPurpose(value);
  return (
    WIDGET_PURPOSE_OPTIONS.find((option) => option.value === normalizedPurpose)
    || WIDGET_PURPOSE_OPTIONS.find((option) => option.value === DEFAULT_WIDGET_PURPOSE)
  );
}

export function getWidgetPurposeLabel(value) {
  return getWidgetPurposeOption(value).label;
}

export function getWidgetPurposeDescription(value) {
  return getWidgetPurposeOption(value).description;
}

export function getWidgetPurposeInstruction(value) {
  return getWidgetPurposeOption(value).instruction;
}
