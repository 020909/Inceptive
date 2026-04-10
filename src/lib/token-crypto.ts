import crypto from "crypto";

// Derive a 32-byte AES key via SHA-256 (use TOKEN_ENCRYPTION_KEY; never truncate secrets)
function deriveKey(raw: string): Buffer {
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

function getPrimarySecret(): string {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY must be set for token encryption");
  }
  return raw;
}

function getFallbackSecrets(primary: string): string[] {
  const out: string[] = [];
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (service && service !== primary) out.push(service);
  return out;
}

/** Encrypt a string token using AES-256-GCM */
export function encryptToken(token: string): string {
  const key = deriveKey(getPrimarySecret());
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a token encrypted with encryptToken */
export function decryptToken(encrypted: string): string {
  try {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return encrypted;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedBuffer = Buffer.from(encryptedHex, "hex");

    const primarySecret = getPrimarySecret();
    const candidates = [primarySecret, ...getFallbackSecrets(primarySecret)];

    for (const raw of candidates) {
      try {
        const key = deriveKey(raw);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        return decrypted.toString("utf8");
      } catch {
        // try next candidate
      }
    }

    throw new Error("Failed to decrypt token");
  } catch {
    const segments = encrypted.split(":");
    const looksEncrypted =
      segments.length === 3 &&
      segments.every((s) => /^[0-9a-f]+$/i.test(s) && s.length > 0);
    if (looksEncrypted) {
      throw new Error("Failed to decrypt token");
    }
    return encrypted;
  }
}
