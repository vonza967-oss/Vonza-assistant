import OpenAI from "openai";

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("Missing environment variables: OPENAI_API_KEY");
    error.statusCode = 500;
    throw error;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
