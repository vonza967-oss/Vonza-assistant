import {
  cleanText,
  formatConversationHistory,
  normalizeAssistantReply,
} from "../../utils/text.js";

function buildReferenceMessages(referenceBlocks = []) {
  return referenceBlocks
    .map((block) => ({
      label: cleanText(block?.label),
      content: cleanText(block?.content),
    }))
    .filter((block) => block.label && block.content)
    .map((block) => ({
      role: "system",
      content: `${block.label}:\n\n${block.content}`,
    }));
}

async function rewriteAssistantReply({
  openai,
  model = "gpt-4o-mini",
  temperature = 0.45,
  reply,
  userMessage,
  history = [],
  issues = [],
  systemPrompt,
  postProcess = null,
  onUsage = null,
}) {
  const rewrite = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      {
        role: "system",
        content: cleanText(systemPrompt),
      },
      {
        role: "user",
        content: [
          `Latest user message:\n${cleanText(userMessage)}`,
          `Recent conversation:\n${formatConversationHistory(history)}`,
          `Issues to fix:\n${issues.join(", ")}`,
          `Reply:\n${cleanText(reply)}`,
        ].join("\n\n"),
      },
    ],
  });
  const usage = rewrite?.usage || {};

  if (typeof onUsage === "function") {
    onUsage({
      usageSource: "chat_reply",
      phase: "rewrite",
      model,
      promptTokens: Number(usage.prompt_tokens || 0) || 0,
      completionTokens: Number(usage.completion_tokens || 0) || 0,
      cachedPromptTokens: Number(usage.prompt_tokens_details?.cached_tokens || 0) || 0,
      occurredAt: new Date().toISOString(),
    });
  }

  const rewrittenReply = normalizeAssistantReply(
    rewrite.choices?.[0]?.message?.content || ""
  );

  return typeof postProcess === "function"
    ? cleanText(postProcess(rewrittenReply))
    : cleanText(rewrittenReply);
}

export async function generateAssistantReply({
  openai,
  userMessage,
  history = [],
  systemPrompt,
  referenceBlocks = [],
  conversationGuidance = "",
  model = "gpt-4o-mini",
  temperature = 0.6,
  presencePenalty = 0,
  frequencyPenalty = 0,
  postProcess = null,
  repair = {},
  onUsage = null,
}) {
  if (!openai?.chat?.completions?.create) {
    const error = new Error("OpenAI chat completions are unavailable.");
    error.code = "openai_unavailable";
    throw error;
  }

  const completion = await openai.chat.completions.create({
    model,
    temperature,
    presence_penalty: presencePenalty,
    frequency_penalty: frequencyPenalty,
    messages: [
      {
        role: "system",
        content: cleanText(systemPrompt),
      },
      ...buildReferenceMessages(referenceBlocks),
      ...(cleanText(conversationGuidance)
        ? [
            {
              role: "system",
              content: `Conversation guidance:\n\n${cleanText(conversationGuidance)}`,
            },
          ]
        : []),
      ...history,
      {
        role: "user",
        content: cleanText(userMessage),
      },
    ],
  });
  const usage = completion?.usage || {};

  if (typeof onUsage === "function") {
    onUsage({
      usageSource: "chat_reply",
      phase: "primary",
      model,
      promptTokens: Number(usage.prompt_tokens || 0) || 0,
      completionTokens: Number(usage.completion_tokens || 0) || 0,
      cachedPromptTokens: Number(usage.prompt_tokens_details?.cached_tokens || 0) || 0,
      occurredAt: new Date().toISOString(),
    });
  }

  let reply = normalizeAssistantReply(
    completion.choices?.[0]?.message?.content || ""
  );
  reply = typeof postProcess === "function"
    ? cleanText(postProcess(reply))
    : cleanText(reply);

  const issues = typeof repair.getIssues === "function"
    ? repair.getIssues(reply)
    : [];

  if (issues.length) {
    const rewritePrompt = typeof repair.buildRewritePrompt === "function"
      ? cleanText(repair.buildRewritePrompt())
      : cleanText(repair.rewritePrompt);

    if (rewritePrompt) {
      reply = await rewriteAssistantReply({
        openai,
        model: repair.model || model,
        temperature: repair.temperature ?? 0.45,
        reply,
        userMessage,
        history,
        issues,
        systemPrompt: rewritePrompt,
        postProcess,
        onUsage,
      });
    }
  }

  if (!cleanText(reply)) {
    const error = new Error("The assistant could not generate a reply.");
    error.statusCode = 502;
    throw error;
  }

  return reply;
}
