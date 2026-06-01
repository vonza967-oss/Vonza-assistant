import test from "node:test";
import assert from "node:assert/strict";

import { getAgentPackage } from "../src/agentPackages/index.js";
import {
  formatVerticalPromptBlock,
  getVerticalTemplate,
  listVerticals,
  normalizeVertical,
} from "../src/agentPackages/front_desk_general/verticals.js";
import {
  formatBusinessVerticalPromptBlock,
  getBusinessVerticalTemplate,
  listBusinessVerticalTemplates,
  normalizeBusinessVertical,
} from "../src/templates/businessVerticals.js";
import {
  buildBusinessContextForChat,
  buildConversationGuidance,
} from "../src/services/chat/prompting.js";

const SUPPORTED_VERTICALS = ["clinic", "web_studio", "home_services"];

function createContentRecord() {
  return {
    content:
      "Clinic appointments, website design, ecommerce development, plumbing repair, HVAC service, and quote requests. Contact hello@acmefrontdesk.com.",
  };
}

test("front_desk_general vertical wrappers match legacy business vertical templates", () => {
  const samples = [
    "clinic",
    "Web Agency",
    "home service",
    "general",
    "",
    "unknown_vertical",
  ];

  assert.deepEqual(listVerticals(), listBusinessVerticalTemplates());

  for (const sample of samples) {
    assert.equal(normalizeVertical(sample), normalizeBusinessVertical(sample));
    assert.equal(getVerticalTemplate(sample), getBusinessVerticalTemplate(sample));
    assert.equal(formatVerticalPromptBlock(sample), formatBusinessVerticalPromptBlock(sample));
  }
});

test("buildBusinessContextForChat includes the same vertical block through the default package", () => {
  const context = buildBusinessContextForChat(createContentRecord(), "Can I book an appointment?", {
    vertical: "clinic",
  });

  assert.ok(context.includes(formatBusinessVerticalPromptBlock("clinic")));
});

test("buildBusinessContextForChat accepts an explicit package manifest", () => {
  const explicitPackage = {
    ...getAgentPackage("front_desk_general"),
    verticals: {
      formatVerticalPromptBlock: (vertical) => `Explicit package block for ${vertical}.`,
    },
  };

  const context = buildBusinessContextForChat(createContentRecord(), "Can I get a quote?", {
    agentPackage: explicitPackage,
    vertical: "web_studio",
  });

  assert.match(context, /Explicit package block for web_studio\./);
});

test("buildConversationGuidance includes the same vertical guidance through the default package", () => {
  const template = getBusinessVerticalTemplate("home_services");
  const guidance = buildConversationGuidance("Can I get a quote?", [], {
    vertical: "home_services",
  });

  assert.match(guidance, new RegExp(`selected business vertical is ${template.label}`, "i"));
  assert.match(guidance, new RegExp(template.systemInstructions.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("buildConversationGuidance accepts an explicit package manifest", () => {
  const explicitPackage = {
    ...getAgentPackage("front_desk_general"),
    verticals: {
      getVerticalTemplate: (vertical) => ({
        key: vertical,
        label: `Explicit ${vertical}`,
        systemInstructions: "Use explicit package guidance.",
      }),
    },
  };

  const guidance = buildConversationGuidance("Can I get a quote?", [], {
    agentPackage: explicitPackage,
    vertical: "clinic",
  });

  assert.match(guidance, /selected business vertical is Explicit clinic/i);
  assert.match(guidance, /Use explicit package guidance\./);
});

test("clinic, web_studio, and home_services prompt blocks are unchanged", () => {
  for (const vertical of SUPPORTED_VERTICALS) {
    const block = formatBusinessVerticalPromptBlock(vertical);
    const template = getBusinessVerticalTemplate(vertical);
    const context = buildBusinessContextForChat(createContentRecord(), "What can you help with?", {
      vertical,
    });
    const guidance = buildConversationGuidance("What services do you offer?", [], {
      vertical,
    });

    assert.equal(formatVerticalPromptBlock(vertical), block);
    assert.ok(context.includes(block));
    assert.match(guidance, new RegExp(`selected business vertical is ${template.label}`, "i"));
    assert.match(guidance, new RegExp(template.systemInstructions.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("malformed package values fall back to front_desk_general vertical helpers", () => {
  const context = buildBusinessContextForChat(createContentRecord(), "Can you build a website?", {
    agentPackage: { verticals: { formatVerticalPromptBlock: "not-a-function" } },
    vertical: "web_studio",
  });
  const guidance = buildConversationGuidance("Can I book an appointment?", [], {
    agentPackage: "unknown_package",
    vertical: "clinic",
  });

  assert.ok(context.includes(formatBusinessVerticalPromptBlock("web_studio")));
  assert.match(guidance, /selected business vertical is Clinic or healthcare office/i);
});
