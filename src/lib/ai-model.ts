import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";

/**
 * Unified model builder used by all agent routes.
 * Supports: anthropic, openai, google, openrouter.
 */
export function buildModel(apiKey: string, provider: string, modelName?: string) {
  const p = (provider || "").toLowerCase();

  switch (p) {
    case "openai":
      return createOpenAI({ apiKey })(modelName || "gpt-4o");

    case "claude":
    case "anthropic":
      return createAnthropic({ apiKey })(modelName || "claude-sonnet-4-6");

    case "openrouter": {
      const client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": APP_URL,
          "X-Title": "Inceptive AI",
        },
      });
      // OpenRouter model IDs look like "anthropic/claude-3.5-sonnet"
      return client(modelName || "anthropic/claude-3.5-sonnet");
    }

    case "gemini":
    case "google":
    default:
      return createGoogleGenerativeAI({ apiKey })(modelName || "gemini-2.0-flash");
  }
}
