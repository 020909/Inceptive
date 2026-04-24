import crypto from "crypto";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";

function getSecret(): string {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!raw) throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  // Use full secret entropy via SHA-256; never truncate/pad.
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Create a signed, time-limited OAuth state string.
 * Encodes: userId | timestamp | redirectTo | hmac
 */
export function createOAuthState(userId: string, redirectTo = "/dashboard"): string {
  const safeRedirect = sanitizeOAuthRedirectPath(redirectTo, "/dashboard");
  const timestamp = Date.now().toString();
  const payload = `${userId}|${timestamp}|${safeRedirect}`;
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 20);
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

/**
 * Verify an OAuth state string.
 * Returns { userId, redirectTo } if valid, null otherwise.
 * State expires after 15 minutes.
 */
export function verifyOAuthState(state: string): { userId: string; redirectTo: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length < 4) return null;
    const hmac = parts.pop()!;
    const redirectTo = parts.pop()!;
    const timestamp = parts.pop()!;
    const userId = parts.join("|"); // Handle user IDs with | in them (shouldn't happen but safe)
    if (!userId || !timestamp) return null;
    // 15-minute expiry
    if (Date.now() - parseInt(timestamp) > 15 * 60 * 1000) return null;
    const payload = `${userId}|${timestamp}|${redirectTo}`;
    const expectedHmac = crypto
      .createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex")
      .slice(0, 20);
    if (hmac !== expectedHmac) return null;
    const safeRedirect = sanitizeOAuthRedirectPath(redirectTo, "/dashboard");
    if (safeRedirect !== redirectTo) return null;
    return { userId, redirectTo: safeRedirect };
  } catch {
    return null;
  }
}
