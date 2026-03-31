export type RoutedModel = {
  provider: "openrouter" | "gemini" | "openai" | "claude" | "groq";
  model: string;
  reason: string;
};

function classify(text: string) {
  const t = (text || "").toLowerCase();
  const wantsCode =
    /\b(code|bug|typescript|javascript|python|react|next\.js|tailwind|supabase|sql|prisma|api route|compile|build|function|algorithm|sort|debug|refactor|implement|fix|architecture|database|schema|deploy|component|hook)\b/.test(t) ||
    /```/.test(t);
  const wantsResearch =
    /\b(research|sources|citations|cite|links|market|landscape|box office|verify|fact check)\b/.test(t);
  const wantsWriting =
    /\b(draft|rewrite|polish|copy|blog|tweet|linkedin post|caption|email)\b/.test(t);
  return { wantsCode, wantsResearch, wantsWriting };
}

/**
 * Route a request to a best-fit model.
 *
 * Smart routing:
 * - Code tasks → Qwen 2.5 Coder (specialized for coding, free via OpenRouter)
 * - Research → Gemini 2.0 Flash (fast, great context)
 * - Writing → Gemini 2.0 Flash
 * - Default → Gemini 2.0 Flash
 *
 * If GROQ_API_KEY is set, stream/route.ts overrides with Groq for non-BYOK users.
 */
export function routeModel(params: {
  lastUserMessage: string;
  userPreferredProvider?: string | null;
  userPreferredModel?: string | null;
  freeOnly: boolean;
}): RoutedModel {
  const { wantsCode, wantsResearch, wantsWriting } = classify(params.lastUserMessage);

  // If the user explicitly set a model/provider, respect it.
  const preferredProvider = (params.userPreferredProvider || "").toLowerCase().trim();
  const preferredModel = (params.userPreferredModel || "").trim();

  if (!params.freeOnly && preferredProvider) {
    return {
      provider: (preferredProvider as any) || "openrouter",
      model: preferredModel || "google/gemini-2.0-flash-001",
      reason: "User preference",
    };
  }

  // Smart routing by task type
  if (wantsCode) {
    // Gemini 2.0 Flash has much better tool-use stability than Qwen on OpenRouter for now.
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Code/engineering → Gemini 2.0 Flash (Reliable Tool User)" };
  }
  if (wantsResearch) {
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Research/query answering" };
  }
  if (wantsWriting) {
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Writing/drafting" };
  }

  return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Default" };
}
