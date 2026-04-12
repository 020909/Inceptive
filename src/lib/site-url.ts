/** Canonical public URL for metadata, OG tags, absolute asset URLs on the marketing page. */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      /* fall through */
    }
  }
  // Production hostname on Vercel (helps prerendered pages embed correct https://…/logo.png)
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.VERCEL_ENV === "production" && prodHost) {
    try {
      return new URL(prodHost.includes("://") ? prodHost : `https://${prodHost}`);
    } catch {
      /* fall through */
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}
