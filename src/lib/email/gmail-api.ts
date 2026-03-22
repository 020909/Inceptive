import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/token-crypto";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getGmailClientForUser(userId: string) {
  const supabase = admin();
  const { data: row, error } = await supabase
    .from("connected_accounts")
    .select("access_token, refresh_token, account_email")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .maybeSingle();

  if (error || !row?.access_token) return null;

  let access: string;
  let refresh: string | undefined;
  try {
    access = decryptToken(row.access_token);
    refresh = row.refresh_token ? decryptToken(row.refresh_token) : undefined;
  } catch {
    return null;
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
      await supabase
        .from("connected_accounts")
        .update({
          access_token: encryptToken(tokens.access_token),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "gmail");
    }
  });

  return { gmail: google.gmail({ version: "v1", auth: oauth2 }), accountEmail: row.account_email };
}

export async function listUnreadGmail(userId: string, maxResults = 10) {
  const client = await getGmailClientForUser(userId);
  if (!client) return { error: "gmail_not_connected" as const, messages: [] };

  const list = await client.gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  });

  const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
  const details = await Promise.all(
    ids.map(async (id) => {
      const full = await client.gmail.users.messages.get({ userId: "me", id, format: "metadata" });
      const headers = full.data.payload?.headers || [];
      const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
      const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
      const snippet = full.data.snippet || "";
      return { id, subject, from, snippet };
    })
  );

  return { error: null, messages: details };
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
  if (!client) return { ok: false as const, error: "gmail_not_connected" };

  const { raw } = buildReplyRaw(params.to, params.subject, params.body);
  const requestBody: { raw: string; threadId?: string } = { raw };
  if (params.threadId) requestBody.threadId = params.threadId;
  await client.gmail.users.messages.send({
    userId: "me",
    requestBody,
  });
  return { ok: true as const };
}
