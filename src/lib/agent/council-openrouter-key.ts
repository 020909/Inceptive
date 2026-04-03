/**
 * Council agents call OpenRouter (Qwen / Minimax / Gemini slugs).
 * Prefer server env key; if missing, use BYOK only when Settings provider is OpenRouter.
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
