import { isIPv4, isIPv6 } from "net";

function isPrivateOrLocalIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;

  if (isIPv4(h)) {
    const parts = h.split(".").map((x) => parseInt(x, 10));
    if (parts.some((n) => Number.isNaN(n) || n > 255)) return true;
    return isPrivateOrLocalIPv4(parts);
  }

  if (isIPv6(h)) {
    const lower = h.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.replace(/^::ffff:/, "");
      if (isIPv4(v4)) {
        const parts = v4.split(".").map((x) => parseInt(x, 10));
        return isPrivateOrLocalIPv4(parts);
      }
    }
    return false;
  }

  return false;
}

/**
 * Parse and validate a URL for server-side fetch (mitigate SSRF).
 * Only http/https, no userinfo, blocks obvious private/local targets.
 */
export function assertUrlSafeForServerFetch(urlString: string): URL {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (u.username || u.password) {
    throw new Error("URL must not include credentials");
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error("This host is not allowed");
  }

  return u;
}
