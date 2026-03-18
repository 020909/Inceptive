import crypto from "crypto";

function getSecret(): string {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return raw.slice(0, 32).padEnd(32, "0");
}

/**
 * Create a signed, time-limited OAuth state string.
 * Encodes: userId | timestamp | redirectTo | hmac
 */
export function createOAuthState(userId: string, redirectTo = "/dashboard"): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}|${timestamp}|${redirectTo}`;
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
    return { userId, redirectTo };
  } catch {
    return null;
  }
}
