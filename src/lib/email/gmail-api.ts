import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { convert } from "html-to-text";
import { decryptToken } from "@/lib/token-crypto";

function decodeGmailBase64(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/**
 * Prefer plain text; otherwise convert HTML to readable plain text (no tags in UI).
 */
export function extractPlainTextFromGmailPayload(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data && !payload.parts?.length) {
    const mt = (payload.mimeType || "").toLowerCase();
    const raw = decodeGmailBase64(payload.body.data);
    if (mt === "text/plain") return raw.trim();
    if (mt === "text/html") {
      try {
        return convert(raw, { wordwrap: 130 }).trim();
      } catch {
        return raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  let plain = "";
  let html = "";
  const walk = (part: any) => {
    if (!part) return;
    const mt = (part.mimeType || "").toLowerCase();
    if (mt === "text/plain" && part.body?.data) plain = decodeGmailBase64(part.body.data);
    else if (mt === "text/html" && part.body?.data) html = decodeGmailBase64(part.body.data);
    if (part.parts) part.parts.forEach(walk);
  };
  walk(payload);

  if (plain.trim()) return plain.trim();
  if (html) {
    try {
      return convert(html, { wordwrap: 130 }).trim();
    } catch {
      return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

type GmailClientOk = {
  gmail: any;
  accountEmail: string;
  accessToken: string;
};

type GmailClientErr =
  | { error: "gmail_not_connected"; reason: string }
  | { error: "gmail_token_decryption_failed"; reason: string };

type GmailClientResult = GmailClientOk | GmailClientErr;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getGmailClientForUser(userId: string): Promise<GmailClientResult> {
  const supabase = admin();
  const { data: row, error } = await supabase
    .from("connected_accounts")
    .select("access_token, refresh_token, account_email, encrypted_tokens")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .maybeSingle();

  if (error || !row?.access_token) {
    return { error: "gmail_not_connected", reason: "No Gmail tokens found for this account." };
  }

  let access: string;
  let refresh: string | undefined;
  let tokens: { access_token?: string; refresh_token?: string } | null = null;
  
  try {
    // Try encrypted_tokens first (newer format)
    if (row.encrypted_tokens) {
      tokens = typeof row.encrypted_tokens === "string" 
        ? JSON.parse(decryptToken(row.encrypted_tokens))
        : row.encrypted_tokens;
      access = decryptToken(tokens?.access_token || row.access_token);
      refresh = tokens?.refresh_token ? decryptToken(tokens.refresh_token) : undefined;
    } else {
      // Fallback to old format
      access = decryptToken(row.access_token);
      refresh = row.refresh_token ? decryptToken(row.refresh_token) : undefined;
    }
  } catch (e: any) {
    console.error("[getGmailClientForUser] Token decryption failed:", e);
    return { error: "gmail_token_decryption_failed", reason: e?.message || "Token decryption failed." };
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2.setCredentials({
    access_token: access,
    refresh_token: refresh,
  });

  // Listen for automatic token refreshes and save to DB
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const { encryptToken } = await import("@/lib/token-crypto");
      const newEncrypted = encryptToken(tokens.access_token);
      await supabase
        .from("connected_accounts")
        .update({
          access_token: newEncrypted,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "gmail");
    }
  });

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2 }), 
    accountEmail: row.account_email,
    accessToken: access 
  };
}

export async function listUnreadGmail(
  userId: string,
  maxResults = 20,
  options?: { unreadOnly?: boolean }
) {
  const client = await getGmailClientForUser(userId);
  if ("error" in client) return { error: client.error, reason: client.reason, messages: [] };

  const unreadOnly = options?.unreadOnly ?? false;

  try {
    const list = await client.gmail.users.messages.list({
      userId: "me",
      q: unreadOnly ? "is:unread in:inbox" : "in:inbox -in:chats",
      maxResults,
    });

    const ids: string[] = (list.data.messages || [])
      .map((m: any) => m.id as string | undefined)
      .filter((x: any): x is string => !!x);
    const details = await Promise.all(
      ids.map(async (id: string) => {
        const full = await client.gmail.users.messages.get({ userId: "me", id, format: "metadata" });
        const headers = full.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
        const from = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "";
        const snippet = full.data.snippet || "";
        const threadId = full.data.threadId || "";
        return { id, subject, from, snippet, threadId };
      })
    );

    return { error: null, messages: details };
  } catch (err: any) {
    const message = err?.message || "Gmail API request failed.";
    const reasonText =
      err?.errors?.[0]?.reason ||
      err?.errors?.[0]?.message ||
      message;

    // Common auth failure scenarios:
    // - access token expired and refresh fails => invalid_grant
    // - revoked/invalid credentials => invalidCredentials/401
    if (String(reasonText).toLowerCase().includes("invalid_grant")) {
      return { error: "gmail_refresh_failed", reason: String(reasonText), messages: [] };
    }
    if (err?.code === 401 || String(reasonText).toLowerCase().includes("invalidcredentials")) {
      return { error: "gmail_auth_failed", reason: String(reasonText), messages: [] };
    }

    return { error: "gmail_api_error", reason: String(reasonText), messages: [] };
  }
}

/**
 * Get full email body content by ID
 */
export async function getGmailFullBody(userId: string, messageId: string): Promise<{ body: string; subject: string; from: string; threadId?: string } | null> {
  const client = await getGmailClientForUser(userId);
  if ("error" in client) return null;

  try {
    const full = await client.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = full.data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
    const from = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "";
    const threadId = full.data.threadId || "";

    const payload = full.data.payload;
    let body = extractPlainTextFromGmailPayload(payload);
    body = body
      .replace(/=\r\n/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    return { body, subject, from, threadId };
  } catch (error) {
    console.error("[getGmailFullBody] Error:", error);
    return null;
  }
}

export function buildGmailRaw(to: string, subject: string, body: string, from?: string) {
  const lines = [
    from ? `From: ${from}` : "",
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].filter(Boolean);
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  return { raw };
}

export function buildReplyRaw(to: string, subject: string, body: string) {
  return buildGmailRaw(to, `Re: ${subject.replace(/^Re:\s*/i, "")}`, body);
}

export async function sendGmailReply(
  userId: string,
  params: { to: string; subject: string; body: string; threadId?: string }
) {
  const client = await getGmailClientForUser(userId);
  if ("error" in client) return { ok: false as const, error: client.error };

  const { raw } = buildReplyRaw(params.to, params.subject, params.body);
  const requestBody: { raw: string; threadId?: string } = { raw };
  if (params.threadId) requestBody.threadId = params.threadId;
  await client.gmail.users.messages.send({
    userId: "me",
    requestBody,
  });
  return { ok: true as const };
}
