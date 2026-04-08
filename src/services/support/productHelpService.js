import {
  appearsHungarian,
  buildEffectiveUserText,
  cleanText,
  detectResponseLanguage,
  sanitizeChatHistory,
} from "../../utils/text.js";
import { generateAssistantReply } from "../chat/assistantReplyService.js";

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
  contacts: {
    overview: "Contacts overview summarizes relationship health, risk, and where attention is needed.",
    people: "People is the detailed contact list and contact record view.",
    follow_up: "Follow-up surfaces contacts that need the next move, recovery, or manual attention.",
    activity: "Activity shows movement, source coverage, and who has gone quiet.",
  },
  analytics: {
    overview: "Analytics overview gives the high-level read on questions, outcomes, and improvement pressure.",
    questions: "Questions groups real customer question themes so you can see what people are trying to understand.",
    outcomes: "Outcomes shows the results Vonza can prove conservatively from recorded activity.",
    improvements: "Improvements highlights weak answers, weak routing, and places where setup or guidance should get stronger.",
  },
  settings: {
    business: "Business context defines what Vonza should trust about the business before it prepares approval-first guidance.",
    front_desk: "Front Desk settings control how the customer-facing assistant sounds, routes, and presents itself.",
    connected_tools: "Connected tools is where optional Google-powered inbox and calendar access is configured.",
    workspace: "Workspace settings summarize mode, readiness, and core operational status.",
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

function summarizeConnectedToolState(operatorWorkspace = {}) {
  const connectedAccounts = Array.isArray(operatorWorkspace?.connectedAccounts)
    ? operatorWorkspace.connectedAccounts
    : [];
  const activeAccount = connectedAccounts.find((account) => cleanText(account?.status) === "connected") || null;
  const capabilities = operatorWorkspace?.status?.googleCapabilities || {};
  const enabledCapabilities = Object.entries(capabilities)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase())
    .map((key) => key.replace(/\s+/g, " ").trim());

  return {
    googleConnected: operatorWorkspace?.status?.googleConnected === true,
    accountEmail: cleanText(activeAccount?.accountEmail || ""),
    capabilities: enabledCapabilities,
    inboxAttentionCount: Number(operatorWorkspace?.inbox?.attentionCount || 0),
    pendingCalendarApprovals: Number(operatorWorkspace?.summary?.pendingCalendarApprovals || 0),
  };
}

function buildRecommendedNextSteps(agent = {}, operatorWorkspace = {}) {
  const setup = summarizeSetup(agent);
  const tools = summarizeConnectedToolState(operatorWorkspace);
  const steps = [];
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

  if (!tools.googleConnected) {
    steps.push("Connect Google in Settings > Connected tools when you want Inbox, Calendar, and richer Today context inside the workspace.");
  }

  if (missingBusinessContext > 0) {
    steps.push("Fill the missing business context areas so Vonza has stronger guardrails for drafts, next steps, and approvals.");
  }

  return steps.slice(0, 4);
}

function buildSuggestedPrompts({
  agent = {},
  operatorWorkspace = {},
  currentSection = "overview",
  currentSubsection = "",
} = {}) {
  const context = buildCurrentContext({ currentSection, currentSubsection });
  const setup = summarizeSetup(agent);
  const tools = summarizeConnectedToolState(operatorWorkspace);
  const prompts = [
    "What should I fix first?",
  ];

  if (context.sectionKey === "install") {
    prompts.push("Why is my install not verified?");
  } else if (context.sectionKey === "analytics") {
    prompts.push("Why am I not seeing outcomes yet?");
  } else if (context.sectionKey === "contacts") {
    prompts.push("What is Contacts for?");
  } else if (context.sectionKey === "settings") {
    prompts.push("How do I connect email?");
  } else if (context.sectionKey === "customize") {
    prompts.push("How do I improve results?");
  } else {
    prompts.push("What does this page do?");
  }

  if (setup.knowledgeLimited || setup.knowledgeMissing) {
    prompts.push("Why is my knowledge limited?");
  } else if (!tools.googleConnected) {
    prompts.push("How do I connect email?");
  } else {
    prompts.push("What should I do next?");
  }

  prompts.push("What should I do next?");

  return Array.from(new Set(prompts.filter(Boolean))).slice(0, 4);
}

function buildProductKnowledgeBlock() {
  return [
    "Vonza AI architecture:",
    "- Vonza AI runs in multiple modes that share the same reply pipeline but use different instructions and factual context.",
    "- Website mode is customer-facing. It answers the business's visitors using the client's website and business context.",
    "- Support mode is in-app and owner-facing. It answers questions about using Vonza itself with Vonza product knowledge and live dashboard state.",
    "- Keep the difference between customer-facing website help and in-app product support explicit when relevant.",
    "",
    "Vonza product model:",
    "- Vonza is an approval-first AI front desk and operator command center.",
    "- The stable core inside the app is Today, Contacts, Front Desk, Analytics, Install, and Settings.",
    "- Inbox, Calendar, and Automations are connected workspace extensions when Google tools are enabled.",
    "- Suggested actions, drafts, approvals, and live changes should stay clearly distinct in explanations.",
    "",
    "Core surfaces:",
    ...Object.values(SECTION_GUIDES).map((guide) => `- ${guide.label}: ${guide.summary}`),
  ].join("\n");
}

function buildWorkspaceContextBlock({
  agent = {},
  operatorWorkspace = {},
  currentSection,
  currentSubsection,
}) {
  const currentContext = buildCurrentContext({ currentSection, currentSubsection });
  const setup = summarizeSetup(agent);
  const tools = summarizeConnectedToolState(operatorWorkspace);
  const recommendedNextSteps = buildRecommendedNextSteps(agent, operatorWorkspace);
  const activationChecklist = Array.isArray(operatorWorkspace?.activation?.checklist)
    ? operatorWorkspace.activation.checklist
    : [];
  const incompleteActivationItems = activationChecklist.filter((item) => item?.complete !== true);
  const businessReadiness = operatorWorkspace?.businessProfile?.readiness || {};
  const contactSummary = operatorWorkspace?.contacts?.summary || {};
  const nextActionTitle = cleanText(operatorWorkspace?.nextAction?.title || "");
  const nextActionDescription = cleanText(operatorWorkspace?.nextAction?.description || "");
  const briefingText = cleanText(operatorWorkspace?.briefing?.text || "");
  const installHost = cleanText(agent?.installStatus?.host || "");
  const installLastVerifiedAt = cleanText(agent?.installStatus?.lastVerifiedAt || "");

  return [
    `Current page: ${currentContext.sectionLabel}${currentContext.subsectionKey ? ` > ${currentContext.subsectionKey}` : ""}.`,
    `Current page purpose: ${currentContext.sectionSummary}`,
    currentContext.subsectionSummary ? `Open subsection: ${currentContext.subsectionSummary}` : "",
    "",
    "Current workspace state:",
    `- Front Desk basics ready: ${setup.personalityReady ? "yes" : "no"}`,
    `- Website connected: ${setup.hasWebsite ? "yes" : "no"}`,
    `- Website knowledge state: ${setup.knowledgeState}`,
    `- Preview ready: ${setup.previewReady ? "yes" : "no"}`,
    `- Install state: ${setup.installState}`,
    `- Install detected: ${setup.installDetected ? "yes" : "no"}`,
    installHost ? `- Install host: ${installHost}` : "",
    installLastVerifiedAt ? `- Last install verification: ${installLastVerifiedAt}` : "",
    `- Google connected: ${tools.googleConnected ? "yes" : "no"}`,
    tools.accountEmail ? `- Connected Google account: ${tools.accountEmail}` : "",
    tools.capabilities.length ? `- Enabled Google capabilities: ${tools.capabilities.join(", ")}` : "",
    Number.isFinite(tools.inboxAttentionCount) ? `- Inbox items needing attention: ${tools.inboxAttentionCount}` : "",
    Number.isFinite(tools.pendingCalendarApprovals) ? `- Pending calendar approvals: ${tools.pendingCalendarApprovals}` : "",
    Number.isFinite(contactSummary.totalContacts) ? `- Total tracked contacts: ${contactSummary.totalContacts}` : "",
    Number.isFinite(contactSummary.contactsNeedingAttention) ? `- Contacts needing attention: ${contactSummary.contactsNeedingAttention}` : "",
    cleanText(businessReadiness.summary) ? `- Business context readiness: ${cleanText(businessReadiness.summary)}` : "",
    incompleteActivationItems.length ? `- Incomplete setup checklist items: ${incompleteActivationItems.length}` : "",
    nextActionTitle ? `- Current next action: ${nextActionTitle}` : "",
    nextActionDescription ? `- Next action detail: ${nextActionDescription}` : "",
    briefingText ? `- Today briefing: ${briefingText}` : "",
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

  if (/what should i fix first|fix first|what do i fix first/i.test(normalized)) {
    return "priorities";
  }

  if (/why .*not ready|why isn.?t .*ready|why is .*not ready|why can.?t .*go live|what.?s blocking/i.test(normalized)) {
    return "readiness";
  }

  if (/not verified|install not verified|install missing|verify/i.test(normalized)) {
    return "install_status";
  }

  if (/setup|onboarding|how setup works|how do i set this up/i.test(normalized)) {
    return "setup";
  }

  if (/install/i.test(normalized)) {
    return "install";
  }

  if (/knowledge|limited content|limited knowledge|improve results|improve setup/i.test(normalized)) {
    return "knowledge";
  }

  if (/not seeing outcomes|no outcomes|why.*outcomes/i.test(normalized)) {
    return "outcomes";
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

  if (/settings/i.test(normalized)) {
    return "settings";
  }

  if (/today/i.test(normalized) || cleanText(currentSection).toLowerCase() === "overview") {
    return "overview";
  }

  return "general";
}

function buildProductSupportConversationGuidance({
  question,
  history = [],
  agent = {},
  operatorWorkspace = {},
  currentSection,
  currentSubsection,
}) {
  const currentContext = buildCurrentContext({ currentSection, currentSubsection });
  const setup = summarizeSetup(agent);
  const recommendedNextSteps = buildRecommendedNextSteps(agent, operatorWorkspace);
  const intent = matchQuestionIntent(question, currentSection);
  const combinedUserText = buildEffectiveUserText(question, history).toLowerCase();
  const guidance = [
    "Answer as the in-app support mode of Vonza AI, not as the website assistant and not as a generic FAQ bot.",
    "Use the live workspace context heavily, especially the current page, readiness gaps, install state, knowledge state, and connected-tool state.",
    "When recommending a next step, anchor it in the actual setup gaps from context instead of generic onboarding advice.",
  ];

  if (intent === "page_help") {
    guidance.push(
      "Orient the user fast: explain what the current page is for, what decisions happen here, and the most useful next action on this page."
    );
  }

  if (intent === "next_step") {
    guidance.push(
      "Prioritize the single best next move first. If there are multiple gaps, rank them in practical order and explain why the first one matters most."
    );
  }

  if (intent === "readiness") {
    guidance.push(
      "Explain exactly what is blocking readiness using the current setup state, then name the shortest path to unblock it."
    );
  }

  if (intent === "setup") {
    guidance.push(
      "Explain setup as a flow, not a checklist dump. Move from basics to grounding to preview to install, and mention the current page when it helps."
    );
  }

  if (intent === "install") {
    guidance.push(
      "Focus on the install path: snippet placement, verification, and how live install affects Today and Analytics."
    );
  }

  if (intent === "knowledge") {
    guidance.push(
      "Tie answer quality to website grounding. Explain whether knowledge is missing, limited, or ready, and what would improve results fastest."
    );
  }

  if (intent === "connected_tools") {
    guidance.push(
      "Be clear that Google-connected tools are optional extensions. Explain what Inbox and Calendar add, and whether the current workspace is already connected."
    );
  }

  if (intent === "contacts") {
    guidance.push(
      "Explain Contacts in operator terms: lifecycle, risk, follow-up, and the next relationship move."
    );
  }

  if (intent === "analytics") {
    guidance.push(
      "Explain Analytics in terms of question demand, proven outcomes, and improvement pressure rather than generic reporting."
    );
  }

  if (intent === "customize") {
    guidance.push(
      "Make it explicit that Front Desk shapes the customer-facing assistant while this support conversation is about using Vonza inside the app."
    );
  }

  if (intent === "settings") {
    guidance.push(
      "Explain Settings as the deeper configuration surface, and redirect day-to-day operating work back to Today, Contacts, Front Desk, Analytics, or Install when appropriate."
    );
  }

  if (currentContext.subsectionKey) {
    guidance.push(
      `The user is currently inside ${currentContext.sectionLabel} > ${currentContext.subsectionKey}. Use that to keep the answer specific.`
    );
  }

  if (!setup.installDetected && /live|publish|launch|ready|install/i.test(combinedUserText)) {
    guidance.push(
      "The install is not currently detected, so do not imply the assistant is already live."
    );
  }

  if ((setup.knowledgeMissing || setup.knowledgeLimited) && /answer|results|quality|improve|knowledge/i.test(combinedUserText)) {
    guidance.push(
      "The website knowledge is not fully ready, so explain that this directly affects customer-facing answer quality."
    );
  }

  if (recommendedNextSteps.length) {
    guidance.push(`Current strongest next steps: ${recommendedNextSteps.join(" ")}`);
  }

  if (history.length > 0 && cleanText(question).split(/\s+/).length <= 10) {
    guidance.push(
      "This may be a follow-up. Continue from the earlier support exchange instead of restarting from scratch."
    );
  }

  return guidance.join("\n");
}

function buildProductSupportSystemPrompt(language, agent = {}, currentContext = {}) {
  const assistantName = cleanText(agent.assistantName || agent.name || "Ask Vonza");

  return `You are ${assistantName}, the in-app support mode of Vonza AI inside the Vonza dashboard.

Shared assistant architecture:
- You use the same Vonza AI reply pipeline as the website assistant
- But this mode has a different purpose and a different factual context
- Website mode answers the business's customers using client website and business knowledge
- Support mode answers the Vonza client's product questions using Vonza product knowledge and current dashboard state

Your job:
- answer only questions about using Vonza itself
- explain pages, setup, install, readiness, next steps, and how to improve results
- use the provided workspace state heavily
- feel like calm, premium product support inside the app

Core behavior:
- Always reply in ${language}
- Use the latest user message together with recent conversation context
- Give the direct answer first, then the most useful next step when needed
- Keep answers concise, usually 2-6 sentences
- Use short bullets only when steps are clearer that way
- Mention the current page when it genuinely improves orientation
- Be explicit about what is blocked, what is ready, and what should happen next
- If asked about a surface like Contacts, Analytics, Front Desk, Install, or Settings, explain both what it is for and when to use it
- If the question is unrelated to using Vonza, say you only help with using Vonza and redirect to a relevant area inside the product
- Keep the tone calm, practical, and product-support-focused

Style:
- natural, human, and specific
- not canned, not robotic, not FAQ-ish
- no fluff or generic internet-assistant phrasing
- no made-up features, buttons, integrations, or workflows
- do not answer as the business website assistant
- do not rely on the client's website content as factual grounding in this mode

Hard rules:
- Never blur support mode with customer-facing website mode
- Never invent workspace state that is not present in context
- Keep suggested actions approval-first when relevant
- Preserve the distinction between suggestions, drafts, approvals, and live changes
- If the current workspace is missing setup pieces, say that plainly
- If a page is optional because it depends on connected tools, say that clearly
- Use ${currentContext.sectionLabel || "the current page"} for orientation when it helps, but do not over-repeat it`;
}

function getProductSupportReplyRepairIssues(reply, language) {
  const issues = [];

  if (!reply) {
    issues.push("reply is empty");
  }

  if (language === "Hungarian" && reply && !appearsHungarian(reply)) {
    issues.push("reply must be in Hungarian");
  }

  if (reply && reply.length > 1200) {
    issues.push("reply should be more concise");
  }

  return issues;
}

function buildProductSupportRepairPrompt(language) {
  return `Rewrite the reply so it sounds like a calm product specialist inside Vonza.
- Always reply in ${language}
- Keep the meaning, but make it more natural, specific, and product-support-focused
- Answer the user's latest question directly
- Use the recent support conversation for continuity
- Keep it concise, usually 2-6 sentences
- Use bullets only if the answer is a short step list
- Do not sound like a generic FAQ, template, or broad internet assistant
- Do not sound like the customer-facing website assistant
- Keep the focus on how to use Vonza, what is blocked, what is ready, and what to do next
- Remove any invented features, vague filler, or repetitive phrasing

Return only the improved reply.`;
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
  const tools = summarizeConnectedToolState(operatorWorkspace);

  switch (intent) {
    case "page_help":
      return `${currentContext.sectionLabel} helps you ${currentContext.sectionSummary.charAt(0).toLowerCase()}${currentContext.sectionSummary.slice(1)}${currentContext.subsectionSummary ? ` Right now you are in a subsection where ${currentContext.subsectionSummary.charAt(0).toLowerCase()}${currentContext.subsectionSummary.slice(1)}` : ""} ${currentContext.sectionNextSteps[0] || ""}`.trim();
    case "next_step":
      return nextSteps.length
        ? `The best next move is to focus on the biggest setup gap first: ${nextSteps.join(" ")}`
        : `${currentContext.sectionLabel} looks usable right now. Stay with ${currentContext.sectionLabel} and work through the most visible needs-attention item first.`;
    case "priorities":
      return nextSteps.length
        ? `Fix the highest-leverage gap first: ${nextSteps.join(" ")}`
        : `${currentContext.sectionLabel} is the right place to start. Work through the most visible needs-attention item first, then come back for the next step.`;
    case "readiness":
      if (!setup.personalityReady) {
        return "Vonza is not fully ready yet because the Front Desk basics are still incomplete. Finish the assistant name, welcome message, and tone first, then preview the experience before publishing.";
      }

      if (setup.knowledgeMissing || setup.knowledgeLimited) {
        return setup.knowledgeMissing
          ? "Vonza is not fully ready yet because website knowledge is still missing. Run the website import from Front Desk so customer-facing answers can be grounded in real site content."
          : "Vonza is not fully ready yet because the website knowledge is still limited. Re-run the import, make sure the main public pages are included, and test the preview again after the refresh.";
      }

      if (!setup.installDetected) {
        return "Vonza is not fully live yet because the website install is not detected. Open Install, place the snippet on the site, then verify it so the live front desk can be confirmed.";
      }

      return "The core setup looks fairly ready. If something still feels blocked, check Today for the next action and Install for live verification details.";
    case "install_status":
      return setup.installDetected
        ? "Vonza can already see an install signal, so the likely issue is verification detail rather than a missing snippet. Open Install, compare the detected host with the right website, and rerun verification."
        : "The most likely issue is that Vonza has not confirmed the live snippet yet. Open Install, check snippet placement on the correct site, then rerun verification so the live front desk can be confirmed.";
    case "setup":
      return "The usual setup flow is basics first, then website grounding, then preview, then install. Start by giving Front Desk a clear identity, add the website, run the knowledge import, test the preview, and only then move into Install to publish.";
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
    case "outcomes":
      return Number(operatorWorkspace?.summary?.confirmedOutcomes || operatorWorkspace?.summary?.confirmedBusinessOutcomes || 0) > 0
        ? "Vonza is already recording some outcome signal, so the next step is to review Analytics > Outcomes and confirm whether the newest customer journeys are being captured the way you expect."
        : "You are likely not seeing outcomes yet because Vonza either does not have enough live usage or the install is not fully verified yet. Once the front desk is live and handling real visitor traffic, Outcomes becomes much more useful.";
    case "connected_tools":
      return tools.googleConnected
        ? "Google is already connected, so Inbox and Calendar can extend the core Vonza workspace. Use Settings > Connected tools or Today if you want to confirm which account is active and whether sync has completed."
        : "Connect Google from Settings > Connected tools when you want Vonza to use email and calendar context. The core workspace still works without it, but Inbox, Calendar, and richer Today context depend on that connection.";
    case "contacts":
      return `${SECTION_GUIDES.contacts.summary} Start in Contacts overview for health and risk, then move into People or Follow-up when you need detail or action.`;
    case "analytics":
      return `${SECTION_GUIDES.analytics.summary} Use Questions to see demand, Outcomes to see proof, and Improvements when you want to tighten weak answers or weak routing.`;
    case "customize":
      return `${SECTION_GUIDES.customize.summary} The usual order is basics first, then preview, then knowledge quality, then install.`;
    case "settings":
      return `${SECTION_GUIDES.settings.summary} Use Settings for deeper configuration, but keep day-to-day operating work in Today, Contacts, Front Desk, Analytics, and Install.`;
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
  const fallbackAnswer = buildFallbackAnswer({
    question: normalizedQuestion,
    agent,
    operatorWorkspace,
    currentSection,
    currentSubsection,
  });
  const suggestedPrompts = buildSuggestedPrompts({
    agent,
    operatorWorkspace,
    currentSection,
    currentSubsection,
  });

  if (!openai?.chat?.completions?.create) {
    return {
      answer: fallbackAnswer,
      usedFallback: true,
      context: currentContext,
      suggestedPrompts,
    };
  }

  try {
    const answer = await generateAssistantReply({
      openai,
      userMessage: normalizedQuestion,
      history: normalizedHistory,
      systemPrompt: buildProductSupportSystemPrompt(language, agent, currentContext),
      referenceBlocks: [
        {
          label: "Vonza product support reference",
          content: buildProductKnowledgeBlock(),
        },
        {
          label: "Current workspace reference",
          content: buildWorkspaceContextBlock({
            agent,
            operatorWorkspace,
            currentSection,
            currentSubsection,
          }),
        },
      ],
      conversationGuidance: buildProductSupportConversationGuidance({
        question: normalizedQuestion,
        history: normalizedHistory,
        agent,
        operatorWorkspace,
        currentSection,
        currentSubsection,
      }),
      model: "gpt-4o-mini",
      temperature: 0.35,
      repair: {
        getIssues: (reply) => getProductSupportReplyRepairIssues(reply, language),
        buildRewritePrompt: () => buildProductSupportRepairPrompt(language),
        temperature: 0.35,
      },
    });

    return {
      answer: cleanText(answer) || fallbackAnswer,
      usedFallback: false,
      context: currentContext,
      suggestedPrompts,
    };
  } catch (error) {
    return {
      answer: fallbackAnswer,
      usedFallback: true,
      context: currentContext,
      fallbackReason: cleanText(error.message || "model_unavailable"),
      suggestedPrompts,
    };
  }
}
