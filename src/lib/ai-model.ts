import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";

/**
 * Unified model builder used by all agent routes.
 *
 * DB stores providers as: 'claude', 'openai', 'gemini', 'openrouter'
 * UI-facing aliases also accepted: 'anthropic' → 'claude', 'google' → 'gemini'
 */
export function buildModel(apiKey: string, provider: string, modelName?: string) {
  const p = (provider || "").toLowerCase().trim();

  switch (p) {
    // ── Anthropic / Claude ─────────────────────────────────────────────
    case "claude":
    case "anthropic":
      return createAnthropic({ apiKey })(modelName || "claude-sonnet-4-6");

    // ── OpenAI ─────────────────────────────────────────────────────────
    // IMPORTANT: use .chat() to force the Chat Completions API.
    // createOpenAI()("gpt-4o") auto-routes to OpenAI's Responses API in
    // @ai-sdk/openai v3, which is stateful and breaks multi-turn when you
    // re-send history without a previous_response_id.
    case "openai":
      return createOpenAI({ apiKey }).chat(modelName || "gpt-4o");

    // ── OpenRouter (100+ models via single key) ─────────────────────────
    // Always use .chat() to force Chat Completions API — OpenRouter only
    // supports Chat Completions, not OpenAI's Responses API.
    case "openrouter": {
      const client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": APP_URL,
          "X-Title": "Inceptive AI",
        },
      });
      return client.chat(modelName || "anthropic/claude-3.5-sonnet");
    }

    // ── Groq (OpenAI-compatible, very fast) ─────────────────────────────
    case "groq": {
      const client = createOpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      return client.chat(modelName || "llama-3.3-70b-versatile");
    }

    // ── Google Gemini ──────────────────────────────────────────────────
    case "gemini":
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelName || "gemini-2.0-flash");

    // ── NVIDIA NIM ─────────────────────────────────────────────────────
    case "nvidia": {
      const client = createOpenAI({
        apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });
      return client.chat(modelName || "nvidia/nemotron-4-340b-instruct");
    }

    // ── 10-Agent Council Orchestrator ────────────────────────────────
    case "debate": {
      const client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": APP_URL,
          "X-Title": "Inceptive AI",
        },
      });
      // The orchestrator must be a stable tool-user like Gemini 2.0 Flash.
      // It handles calling the 10-Agent Council via the multiAgentDebate tool.
      return client.chat("google/gemini-2.0-flash-001");
    }

    // ── Fallback: try OpenRouter (most permissive) ─────────────────────
    default: {
      console.warn(`[buildModel] Unknown provider "${p}" — falling back to OpenRouter`);
      const client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": APP_URL,
          "X-Title": "Inceptive AI",
        },
      });
      return client.chat(modelName || "anthropic/claude-3.5-sonnet");
    }
  }
}
