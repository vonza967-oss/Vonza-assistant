// Example only. Prompt blocks become runtime behavior only after a real package imports them.
export const examplePromptBlocks = Object.freeze({
  role: `Example package role:
- State the package-specific assistant identity.
- Keep factual claims grounded in approved evidence.
- Ask a practical follow-up question when the visitor intent is unclear.`,
  workflow: `Example package workflow:
- Answer known factual questions from evidence.
- Say when a requested detail is not available here.
- Offer a safe next step instead of inventing unavailable details.`,
});

export default examplePromptBlocks;
