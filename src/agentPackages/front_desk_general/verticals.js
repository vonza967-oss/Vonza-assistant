import {
  formatBusinessVerticalPromptBlock,
  getBusinessVerticalTemplate,
  listBusinessVerticalTemplates,
  normalizeBusinessVertical,
} from "../../templates/businessVerticals.js";

export function normalizeVertical(value) {
  return normalizeBusinessVertical(value);
}

export function getVerticalTemplate(value) {
  return getBusinessVerticalTemplate(value);
}

export function listVerticals() {
  return listBusinessVerticalTemplates();
}

export function formatVerticalPromptBlock(value) {
  return formatBusinessVerticalPromptBlock(value);
}
