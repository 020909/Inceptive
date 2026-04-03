/** Normalized OpenRouter key from server env (Vercel). Checks common variable names. */
export function serverOpenRouterKeyFromEnv(): string {
  return (
    process.env.OPENROUTER_KEY?.trim() ||
    process.env.OPENROUTER_DEFAULT_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    ""
  );
}
