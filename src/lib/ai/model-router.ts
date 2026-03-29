export type RoutedModel = {
  provider: "openrouter" | "gemini" | "openai" | "claude" | "groq";
  model: string;
  reason: string;
};

function classify(text: string) {
  const t = (text || "").toLowerCase();
  const wantsCode =
    /\b(code|bug|typescript|javascript|react|next\.js|tailwind|supabase|sql|api route|compile|build)\b/.test(t) ||
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
 * NOTE (free-only mode):
 * - Prefer Gemini Flash for most tasks (cheap/free-tier friendly).
 * - Keep hooks for OpenAI/Claude/OpenRouter so you can upgrade later without refactors.
 */
export function routeModel(params: {
  lastUserMessage: string;
  userPreferredProvider?: string | null;
  userPreferredModel?: string | null;
  freeOnly: boolean;
}): RoutedModel {
  const { wantsCode, wantsResearch, wantsWriting } = classify(params.lastUserMessage);

  // If the user explicitly set a model/provider, respect it unless we must force free-only.
  const preferredProvider = (params.userPreferredProvider || "").toLowerCase().trim();
  const preferredModel = (params.userPreferredModel || "").trim();

  if (!params.freeOnly && preferredProvider) {
    return {
      provider: (preferredProvider as any) || "openrouter",
      model: preferredModel || "google/gemini-2.0-flash-001",
      reason: "User preference",
    };
  }

  // Free-only: route by task type.
  // Note: non-BYOK chat already prefers Groq in the stream route when GROQ_API_KEY is present.
  if (wantsResearch) {
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Research/query answering" };
  }
  if (wantsCode) {
    // Code tends to be more reliable on Gemini Flash via OpenRouter in this stack.
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Code/engineering" };
  }
  if (wantsWriting) {
    return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Writing/drafting" };
  }

  return { provider: "openrouter", model: "google/gemini-2.0-flash-001", reason: "Default" };
}

