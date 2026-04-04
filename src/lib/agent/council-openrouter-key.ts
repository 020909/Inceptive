/**
 * Council keys: OpenRouter (fallbacks + light agents) and Gemini API / AI Studio (Gemma 4 31B).
 * Per-agent routing: `council-model-router.ts`.
 */
export function resolveCouncilOpenRouterKey(
  envOpenRouter: string,
  user: { api_key_encrypted?: string | null; api_provider?: string | null } | null | undefined
): string {
  const e = (envOpenRouter || "").trim();
  if (e) return e;
  const k = String(user?.api_key_encrypted || "").trim();
  if (!k) return "";
  if (String(user?.api_provider || "").toLowerCase() === "openrouter") return k;
  return "";
}

/** Gemini / Google AI Studio key for Gemma 4 (and future Gemini-native Council steps). */
export function resolveCouncilGeminiKey(
  envGemini: string,
  user: { api_key_encrypted?: string | null; api_provider?: string | null } | null | undefined
): string {
  const e = (envGemini || "").trim();
  if (e) return e;
  const k = String(user?.api_key_encrypted || "").trim();
  if (!k) return "";
  const p = String(user?.api_provider || "").toLowerCase();
  if (p === "gemini" || p === "google") return k;
  return "";
}
