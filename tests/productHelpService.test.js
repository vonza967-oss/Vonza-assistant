import test from "node:test";
import assert from "node:assert/strict";

import { answerVonzaProductHelp } from "../src/services/support/productHelpService.js";

function createAgent(overrides = {}) {
  return {
    id: "agent-1",
    name: "Vonza AI",
    assistantName: "Ask Vonza",
    welcomeMessage: "Welcome to Vonza.",
    tone: "support",
    websiteUrl: "https://example.com",
    publicAgentKey: "public-key",
    knowledge: {
      state: "limited",
    },
    installStatus: {
      state: "not_installed",
      host: "",
    },
    ...overrides,
  };
}

function createOperatorWorkspace(overrides = {}) {
  return {
    status: {
      googleConnected: true,
      googleCapabilities: {
        gmailRead: true,
        gmailSend: true,
        calendarRead: true,
      },
      ...overrides.status,
    },
    connectedAccounts: [
      {
        status: "connected",
        accountEmail: "owner@example.com",
      },
    ],
    inbox: {
      attentionCount: 2,
      ...overrides.inbox,
    },
    summary: {
      pendingCalendarApprovals: 1,
      ...overrides.summary,
    },
    contacts: {
      summary: {
        totalContacts: 42,
        contactsNeedingAttention: 4,
        ...(overrides.contacts?.summary || {}),
      },
      ...(overrides.contacts || {}),
    },
    businessProfile: {
      readiness: {
        missingCount: 1,
        summary: "7 of 8 business context areas are filled. Missing: Policies.",
        ...(overrides.businessProfile?.readiness || {}),
      },
      ...(overrides.businessProfile || {}),
    },
    activation: {
      checklist: [
        { key: "connect_google", complete: true },
        { key: "install_snippet", complete: false },
      ],
      ...overrides.activation,
    },
    nextAction: {
      title: "Finish install verification",
      description: "Add the snippet to the live site and verify the detected host.",
      ...overrides.nextAction,
    },
    briefing: {
      text: "Install is still blocking live signal.",
      ...overrides.briefing,
    },
    ...overrides,
  };
}

test("product help falls back with product-specific readiness guidance", async () => {
  const result = await answerVonzaProductHelp({
    openai: null,
    question: "Why isn't this ready yet?",
    agent: createAgent({
      welcomeMessage: "",
      tone: "",
      websiteUrl: "",
      publicAgentKey: "",
      knowledge: {
        state: "missing",
      },
      installStatus: {
        state: "not_installed",
      },
    }),
    operatorWorkspace: createOperatorWorkspace({
      status: {
        googleConnected: false,
      },
    }),
    currentSection: "customize",
    currentSubsection: "context",
  });

  assert.equal(result.usedFallback, true);
  assert.equal(result.context.sectionLabel, "Front Desk");
  assert.match(result.answer, /not fully ready/i);
  assert.match(result.answer, /Front Desk basics|website knowledge|install/i);
});

test("product help sends support-mode Vonza AI context through the shared reply path", async () => {
  const capturedCalls = [];
  const openai = {
    chat: {
      completions: {
        create: async (payload) => {
          capturedCalls.push(payload);
          return {
            choices: [
              {
                message: {
                  content:
                    "Front Desk shapes the customer-facing assistant, while this drawer helps you use Vonza itself. Right now, your knowledge is limited and install is not detected, so improve the import first and then verify the snippet in Install.",
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await answerVonzaProductHelp({
    openai,
    question: "What does this page do?",
    history: [
      { role: "user", content: "I'm trying to understand this section." },
    ],
    agent: createAgent(),
    operatorWorkspace: createOperatorWorkspace(),
    currentSection: "customize",
    currentSubsection: "context",
  });

  assert.equal(result.usedFallback, false);
  assert.match(result.answer, /Front Desk shapes the customer-facing assistant/i);
  assert.equal(capturedCalls.length, 1);

  const promptText = capturedCalls[0].messages.map((message) => message.content).join("\n\n");
  assert.match(promptText, /same Vonza AI reply pipeline as the website assistant/i);
  assert.match(promptText, /Support mode is in-app and owner-facing/i);
  assert.match(promptText, /Current page: Front Desk > context\./i);
  assert.match(promptText, /Website knowledge state: limited/i);
  assert.match(promptText, /Google connected: yes/i);
  assert.match(promptText, /Enabled Google capabilities: gmail read, gmail send, calendar read/i);
});
