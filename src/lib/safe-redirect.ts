const MAX_LEN = 256;

/**
 * Restrict OAuth post-login redirects to same-origin paths only (blocks open redirects).
 */
export function sanitizeOAuthRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard"
): string {
  const p = (path ?? "").trim();
  if (!p || p.length > MAX_LEN) return fallback;
  if (!p.startsWith("/")) return fallback;
  if (p.startsWith("//")) return fallback;
  if (p.includes("://")) return fallback;
  if (p.includes("\\")) return fallback;
  if (p.includes("@")) return fallback;
  if (p.includes("\r") || p.includes("\n")) return fallback;
  if (p.includes("\0")) return fallback;
  return p;
}
