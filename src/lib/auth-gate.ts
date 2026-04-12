/**
 * Send the user to the login page, preserving return path when they sign in.
 * Use when an action requires an authenticated session (credits, uploads, etc.).
 */
export function redirectToSignIn() {
  if (typeof window === "undefined") return;
  const path = `${window.location.pathname}${window.location.search}`;
  const next = path === "/login" ? "/dashboard" : path;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}
