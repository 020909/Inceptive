import crypto from "crypto";

// Derive a 32-byte key from env (use TOKEN_ENCRYPTION_KEY or fall back to service role key prefix)
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Buffer.from(raw.slice(0, 32).padEnd(32, "0"));
}

/** Encrypt a string token using AES-256-GCM */
export function encryptToken(token: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a token encrypted with encryptToken */
export function decryptToken(encrypted: string): string {
  try {
    const key = getKey();
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return encrypted;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedBuffer = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return encrypted; // Fallback: return raw (handles unencrypted legacy tokens)
  }
}
