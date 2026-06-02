import {
  DEFAULT_WIDGET_PURPOSE,
  WIDGET_PURPOSE_OPTIONS,
  getWidgetPurposeDescription,
  getWidgetPurposeInstruction,
  getWidgetPurposeLabel,
  normalizeWidgetPurpose,
} from "../../services/agents/widgetPurpose.js";
import {
  formatVerticalPromptBlock,
  getVerticalTemplate,
  listVerticals,
  normalizeVertical,
} from "./verticals.js";
import { frontDeskGeneralToolKeys } from "./tools.js";
import { frontDeskGeneralKnowledgePolicy } from "./knowledgePolicy.js";

function listWidgetPurposeOptions() {
  return WIDGET_PURPOSE_OPTIONS.map((option) => ({ ...option }));
}

export const frontDeskGeneralManifest = Object.freeze({
  key: "front_desk_general",
  version: "0.1.0",
  label: "AI Front Desk",
  description:
    "Default AI Front Desk package for public business chat, full-page, widget, and web-call interactions.",
  supportedSurfaces: Object.freeze(["widget", "full_page", "web_call"]),
  actions: Object.freeze([]),
  tools: frontDeskGeneralToolKeys,
  knowledgePolicy: frontDeskGeneralKnowledgePolicy,
  verticals: Object.freeze({
    normalizeVertical,
    getVerticalTemplate,
    listVerticals,
    formatVerticalPromptBlock,
  }),
  purposes: Object.freeze({
    defaultPurpose: DEFAULT_WIDGET_PURPOSE,
    options: listWidgetPurposeOptions,
    normalize: normalizeWidgetPurpose,
    getLabel: getWidgetPurposeLabel,
    getDescription: getWidgetPurposeDescription,
    getInstruction: getWidgetPurposeInstruction,
  }),
});

export default frontDeskGeneralManifest;
