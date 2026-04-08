import {
  cleanText,
  detectResponseLanguage,
  sanitizeChatHistory,
} from "../../utils/text.js";

const SECTION_GUIDES = {
  overview: {
    label: "Today",
    summary:
      "Today is the main Vonza workspace. It keeps the next action, setup health, approvals, and the most important operating context in one place.",
    nextSteps: [
      "Review the single best next action and any needs-attention cards first.",
      "Use Today to see whether setup, approvals, or follow-up work needs owner attention now.",
    ],
  },
  contacts: {
    label: "Contacts",
    summary:
      "Contacts shows the people and companies Vonza is tracking, plus lifecycle state, follow-up risk, recent activity, and the next relationship move.",
    nextSteps: [
      "Use Contacts to review who needs follow-up, who is at risk, and who has progressed.",
      "Open a specific contact when you want to update lifecycle, prepare follow-up, or review context.",
    ],
  },
  customize: {
    label: "Front Desk",
    summary:
      "Front Desk is where you shape the customer-facing Vonza experience: how it sounds, what it knows, how it previews, and how ready it is to go live.",
    nextSteps: [
      "Use Front Desk to tune voice, test the live preview, and improve imported website knowledge.",
      "When preview answers look strong, move to Install to publish Vonza on the website.",
    ],
  },
  analytics: {
    label: "Analytics",
    summary:
      "Analytics explains how Vonza is performing by showing customer questions, proof of outcomes, and where answers or flows should improve.",
    nextSteps: [
      "Use Analytics to understand what customers are asking and where Vonza is helping or missing.",
      "Review improvement areas when you want clearer answers, stronger routing, or better next-step guidance.",
    ],
  },
  install: {
    label: "Install",
    summary:
      "Install is where you publish Vonza to the website, copy the snippet, and verify that the live front desk is actually being detected.",
    nextSteps: [
      "Copy the install snippet, place it on the website, then run verification.",
      "If Vonza is already installed, use this page to confirm it is still live and reporting back correctly.",
    ],
  },
  settings: {
    label: "Settings",
    summary:
      "Settings holds the deeper workspace configuration for business context, front desk behavior, connected tools, and workspace status.",
    nextSteps: [
      "Use Settings when you want to change business context, assistant behavior, or connected-tool setup.",
      "Most day-to-day operating work stays in Today, Contacts, Front Desk, Analytics, and Install.",
    ],
  },
  inbox: {
    label: "Inbox",
    summary:
      "Inbox is an optional Google-connected workspace for review and draft support around customer email. It extends the core workspace rather than replacing it.",
    nextSteps: [
      "Connect Google first if Inbox is not available yet.",
      "Use Inbox when you want approval-first reply drafting tied into the rest of the Vonza workspace.",
    ],
  },
  calendar: {
    label: "Calendar",
    summary:
      "Calendar is an optional Google-connected workspace for schedule context, appointment review, and approval-first calendar actions.",
    nextSteps: [
      "Connect Google first if Calendar is not available yet.",
      "Use Calendar when you want Vonza to surface appointments, review follow-up, and prepare owner-approved calendar changes.",
    ],
  },
  automations: {
    label: "Automations",
    summary:
      "Automations keeps follow-up drafts, campaign drafts, and operator tasks together so owner-reviewed work stays visible and controlled.",
    nextSteps: [
      "Use Automations to review prepared follow-up, campaign steps, and operator tasks.",
      "This area is strongest after the core workspace has enough live signal from setup and usage.",
    ],
  },
};

const SUBSECTION_GUIDES = {
  customize: {
    overview: "The overview explains Front Desk readiness and whether the customer-facing experience is grounded enough to go live.",
    preview: "Preview lets you test how the front desk answers before it is published to the live website.",
    context: "Context shows whether website content has been imported well enough for Vonza to answer accurately.",
    launch: "Launch focuses on getting the customer-facing front desk ready to publish safely.",
  },
};

function getSectionGuide(sectionKey = "") {
  return SECTION_GUIDES[cleanText(sectionKey).toLowerCase()] || SECTION_GUIDES.overview;
}

function getSubsectionGuide(sectionKey = "", subsectionKey = "") {
  const sectionGuides = SUBSECTION_GUIDES[cleanText(sectionKey).toLowerCase()] || {};
  return cleanText(sectionGuides[cleanText(subsectionKey).toLowerCase()] || "");
}

function summarizeSetup(agent = {}) {
  const knowledgeState = cleanText(agent?.knowledge?.state || "missing").toLowerCase() || "missing";
  const personalityReady = Boolean(
    cleanText(agent.assistantName || agent.name)
    && cleanText(agent.welcomeMessage)
    && cleanText(agent.tone)
  );
  const hasWebsite = Boolean(cleanText(agent.websiteUrl));
  const previewReady = Boolean(cleanText(agent.publicAgentKey));
  const installState = cleanText(agent?.installStatus?.state || "not_installed").toLowerCase();
  const installDetected = ["installed_unseen", "seen_recently", "seen_stale"].includes(installState);

  return {
    personalityReady,
    hasWebsite,
    previewReady,
    installDetected,
    installState,
    knowledgeState,
    knowledgeReady: knowledgeState === "ready",
    knowledgeLimited: knowledgeState === "limited",
    knowledgeMissing: knowledgeState === "missing",
  };
}

function buildCurrentContext({ currentSection, currentSubsection }) {
  const sectionGuide = getSectionGuide(currentSection);
  const subsectionGuide = getSubsectionGuide(currentSection, currentSubsection);
  return {
    sectionKey: cleanText(currentSection).toLowerCase() || "overview",
    sectionLabel: sectionGuide.label,
    sectionSummary: sectionGuide.summary,
    sectionNextSteps: sectionGuide.nextSteps || [],
    subsectionKey: cleanText(currentSubsection).toLowerCase(),
    subsectionSummary: subsectionGuide,
  };
}

function buildRecommendedNextSteps(agent = {}, operatorWorkspace = {}) {
  const setup = summarizeSetup(agent);
  const steps = [];
  const googleConnected = operatorWorkspace?.status?.googleConnected === true;
  const missingBusinessContext = Number(operatorWorkspace?.businessProfile?.readiness?.missingCount || 0);

  if (!setup.personalityReady) {
    steps.push("Finish the core Front Desk basics so Vonza has a clear name, welcome message, and tone.");
  }

  if (!setup.hasWebsite) {
    steps.push("Add the main website URL so Vonza can learn what the business actually offers.");
  }

  if (setup.knowledgeMissing) {
    steps.push("Run the website knowledge import from Front Desk so answers can be grounded in real site content.");
  } else if (setup.knowledgeLimited) {
    steps.push("Re-run website knowledge import and make sure the site has the strongest public pages available, so answers become sharper.");
  }

  if (!setup.previewReady) {
    steps.push("Finish Front Desk setup and preview the live experience before publishing it.");
  }

  if (!setup.installDetected) {
    steps.push("Open Install, place the Vonza snippet on the site, and verify that the live install is detected.");
  }

  if (!googleConnected) {
    steps.push("Connect Google in Connected tools when you want Inbox, Calendar, and richer Today context inside the workspace.");
  }

  if (missingBusinessContext > 0) {
    steps.push("Fill the missing business context areas so Vonza has stronger guardrails for drafts, next steps, and approvals.");
  }

  return steps.slice(0, 4);
}

function buildContextBlock({
  agent = {},
  operatorWorkspace = {},
  currentSection,
  currentSubsection,
}) {
  const currentContext = buildCurrentContext({ currentSection, currentSubsection });
  const setup = summarizeSetup(agent);
  const recommendedNextSteps = buildRecommendedNextSteps(agent, operatorWorkspace);
  const installHost = cleanText(agent?.installStatus?.host || "");
  const businessContextSummary = cleanText(operatorWorkspace?.businessProfile?.readiness?.summary || "");

  return [
    "Vonza product reference:",
    "- Vonza is an approval-first AI front desk and operator workspace.",
    "- Keep answers focused on using Vonza itself, not on unrelated general knowledge.",
    "- The stable core inside the app is Today, Contacts, Front Desk, Analytics, and Install.",
    "- Inbox, Calendar, and Automations are optional connected-workspace extensions when Google tools are enabled.",
    "",
    `Current page: ${currentContext.sectionLabel}${currentContext.subsectionKey ? ` > ${currentContext.subsectionKey}` : ""}.`,
    `Current page purpose: ${currentContext.sectionSummary}`,
    currentContext.subsectionSummary ? `Open subsection: ${currentContext.subsectionSummary}` : "",
    "",
    "Current setup state:",
    `- Front Desk basics ready: ${setup.personalityReady ? "yes" : "no"}`,
    `- Website connected: ${setup.hasWebsite ? "yes" : "no"}`,
    `- Website knowledge state: ${setup.knowledgeState}`,
    `- Preview ready: ${setup.previewReady ? "yes" : "no"}`,
    `- Install detected: ${setup.installDetected ? "yes" : "no"}`,
    installHost ? `- Install host: ${installHost}` : "",
    `- Google connected: ${operatorWorkspace?.status?.googleConnected === true ? "yes" : "no"}`,
    businessContextSummary ? `- Business context readiness: ${businessContextSummary}` : "",
    "",
    recommendedNextSteps.length
      ? `Recommended next steps right now:\n${recommendedNextSteps.map((step) => `- ${step}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function matchQuestionIntent(question = "", currentSection = "") {
  const normalized = cleanText(question).toLowerCase();

  if (!normalized) {
    return "general";
  }

  if (/what does this page do|what is this page|what does this section do|where am i/i.test(normalized)) {
    return "page_help";
  }

  if (/what should i do next|next step|where should i start/i.test(normalized)) {
    return "next_step";
  }

  if (/install/i.test(normalized)) {
    return "install";
  }

  if (/knowledge|limited content|limited knowledge|improve results|improve setup/i.test(normalized)) {
    return "knowledge";
  }

  if (/email|google|inbox|calendar|connect/i.test(normalized)) {
    return "connected_tools";
  }

  if (/contacts/i.test(normalized)) {
    return "contacts";
  }

  if (/analytics|outcomes|questions|improvements/i.test(normalized)) {
    return "analytics";
  }

  if (/front desk|preview|widget|tone|welcome message/i.test(normalized)) {
    return "customize";
  }

  if (/today/i.test(normalized) || cleanText(currentSection).toLowerCase() === "overview") {
    return "overview";
  }

  return "general";
}

function buildFallbackAnswer({
  question,
  agent = {},
  operatorWorkspace = {},
  currentSection,
  currentSubsection,
}) {
  const intent = matchQuestionIntent(question, currentSection);
  const currentContext = buildCurrentContext({ currentSection, currentSubsection });
  const setup = summarizeSetup(agent);
  const nextSteps = buildRecommendedNextSteps(agent, operatorWorkspace);
  const googleConnected = operatorWorkspace?.status?.googleConnected === true;

  switch (intent) {
    case "page_help":
      return `${currentContext.sectionLabel} helps you ${currentContext.sectionSummary.charAt(0).toLowerCase()}${currentContext.sectionSummary.slice(1)}${currentContext.subsectionSummary ? ` Right now you are in a subsection where ${currentContext.subsectionSummary.charAt(0).toLowerCase()}${currentContext.subsectionSummary.slice(1)}` : ""} ${currentContext.sectionNextSteps[0] || ""}`.trim();
    case "next_step":
      return nextSteps.length
        ? `The best next move is to focus on setup gaps in order: ${nextSteps.join(" ")}`
        : `${currentContext.sectionLabel} looks usable right now. Stay with ${currentContext.sectionLabel} and work through the most visible needs-attention item first.`;
    case "install":
      return setup.installDetected
        ? "Vonza already looks installed, so the main job now is verification: open Install, confirm the snippet is still live, and make sure the detected host matches the right website."
        : "Open Install, copy the Vonza snippet, place it on the website, then run verification. Once the install is detected, Today and Analytics can start reflecting more live signal.";
    case "knowledge":
      return setup.knowledgeLimited
        ? "Your knowledge is limited because Vonza only has a partial website import right now. Re-run the knowledge import from Front Desk, make sure the website URL points to the strongest public pages, and test the preview again after the import finishes."
        : setup.knowledgeMissing
          ? "Vonza needs website knowledge before answers can be properly grounded. Add the website if needed, run the import from Front Desk, and then test the preview with realistic customer questions."
          : "To improve results, review real question patterns in Analytics, sharpen Front Desk wording where answers feel weak, and keep the website import fresh whenever core site content changes.";
    case "connected_tools":
      return googleConnected
        ? "Google is already connected, so Inbox and Calendar can extend the core Vonza workspace. Use Connected tools or Today if you want to confirm which account is active and whether sync has completed."
        : "Connect Google from Settings > Connected tools when you want Vonza to use email and calendar context. The core workspace still works without it, but Inbox, Calendar, and richer Today context depend on that connection.";
    case "contacts":
      return `${SECTION_GUIDES.contacts.summary} Start in Contacts overview for health and risk, then move into People or Follow-up when you need detail or action.`;
    case "analytics":
      return `${SECTION_GUIDES.analytics.summary} Use Questions to see demand, Outcomes to see proof, and Improvements when you want to tighten weak answers or weak routing.`;
    case "customize":
      return `${SECTION_GUIDES.customize.summary} The usual order is basics first, then preview, then knowledge quality, then install.`;
    case "overview":
      return `${SECTION_GUIDES.overview.summary} If you are not sure where to begin, use Today to follow the clearest next action and then jump into the related surface.`;
    default:
      return `I can help with using Vonza itself, like Today, Contacts, Front Desk, Analytics, Install, setup quality, and connected tools. Right now, ${currentContext.sectionLabel} is the active page, and ${currentContext.sectionNextSteps[0] || "that is usually the best place to start."}`;
  }
}

export async function answerVonzaProductHelp({
  openai = null,
  question,
  history,
  agent = {},
  operatorWorkspace = {},
  currentSection = "overview",
  currentSubsection = "",
} = {}) {
  const normalizedQuestion = cleanText(question);

  if (!normalizedQuestion) {
    const error = new Error("Question cannot be empty.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedHistory = sanitizeChatHistory(history);
  const language = detectResponseLanguage(normalizedQuestion);
  const currentContext = buildCurrentContext({ currentSection, currentSubsection });
  const contextBlock = buildContextBlock({
    agent,
    operatorWorkspace,
    currentSection,
    currentSubsection,
  });

  if (!openai?.chat?.completions?.create) {
    return {
      answer: buildFallbackAnswer({
        question: normalizedQuestion,
        agent,
        operatorWorkspace,
        currentSection,
        currentSubsection,
      }),
      usedFallback: true,
      context: currentContext,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: `You are Ask Vonza, the in-app product support assistant inside the Vonza dashboard.

Your job:
- answer only questions about using Vonza itself
- explain features, pages, setup, and next steps inside the app
- use the provided current-page and setup context heavily
- keep the experience feeling like premium product support, not a generic chatbot

Hard rules:
- Do not answer as a broad internet assistant
- Do not invent features, integrations, buttons, or workflows that are not supported by the provided context
- If the question is unrelated to using Vonza, say you only help with using Vonza and redirect to a relevant app area
- Prefer direct answers and practical next steps over abstract advice
- Keep answers concise, usually 2-6 sentences
- Use bullets only when short steps make the answer easier to follow
- Reply in ${language}
- Mention the current page when it genuinely helps the user orient themselves`,
        },
        {
          role: "system",
          content: contextBlock,
        },
        ...normalizedHistory,
        {
          role: "user",
          content: normalizedQuestion,
        },
      ],
    });

    return {
      answer: cleanText(completion.choices?.[0]?.message?.content || "")
        || buildFallbackAnswer({
          question: normalizedQuestion,
          agent,
          operatorWorkspace,
          currentSection,
          currentSubsection,
        }),
      usedFallback: false,
      context: currentContext,
    };
  } catch (error) {
    return {
      answer: buildFallbackAnswer({
        question: normalizedQuestion,
        agent,
        operatorWorkspace,
        currentSection,
        currentSubsection,
      }),
      usedFallback: true,
      context: currentContext,
      fallbackReason: cleanText(error.message || "model_unavailable"),
    };
  }
}
