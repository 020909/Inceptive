export type RoutedModel = {
  provider: "openrouter" | "gemini" | "openai" | "claude" | "groq" | "debate";
  model: string;
  reason: string;
};

function classify(text: string) {
  const t = (text || "").toLowerCase();
  const wantsCode =
    /\b(code|bug|typescript|javascript|python|react|next\.js|tailwind|supabase|sql|prisma|api route|compile|build|function|algorithm|sort|debug|refactor|implement|fix|architecture|database|schema|deploy|component|hook)\b/.test(t) ||
    /\b(website|web app|landing page|homepage|multi-?page|saas site|portfolio page|htmx|spa)\b/.test(t) ||
    /```/.test(t);
  const wantsResearch =
    /\b(research|sources|citations|cite|links|market|landscape|box office|verify|fact check)\b/.test(t);
  const wantsWriting =
    /\b(draft|rewrite|polish|copy|blog|tweet|linkedin post|caption|email)\b/.test(t);
  return { wantsCode, wantsResearch, wantsWriting };
}

/**
 * 10-Agent Council per-role routing (Gemma 4 + OpenRouter): see `src/lib/agent/council-model-router.ts`.
 *
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
    return {
      provider: "debate",
      model: "openrouter/free",
      reason:
        "Code/engineering → 10-Agent Council (OpenRouter + Gemini API fallbacks)",
    };
  }
  if (wantsResearch) {
    return {
      provider: "openrouter",
      model: "google/gemini-2.0-flash-001",
      reason: "Research/query → Gemini 2.0 Flash via OpenRouter",
    };
  }
  if (wantsWriting) {
    return { provider: "openrouter", model: "stepfun/step-3.5-flash", reason: "Writing/drafting → Step 3.5 Flash" };
  }

  return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Default" };
}

export {
  getCouncilModelChain,
  councilChainIsRunnable,
  type CouncilModelStep,
  type CouncilModelProvider,
} from "@/lib/agent/council-model-router";
