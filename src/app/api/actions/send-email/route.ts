/**
 * POST /api/actions/send-email
 * Sends an email draft using Gmail API (if connected) or Outlook Graph API (if connected).
 * Falls back to marking as "sent" in the DB if no mail provider is connected.
 */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/token-crypto";

export const maxDuration = 30;

const getAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Refresh a Gmail access token using the refresh_token */
async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token || null;
  } catch { return null; }
}

/** Build a base64url-encoded RFC 2822 email */
function buildGmailRaw(from: string, to: string, subject: string, body: string): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

/** Send via Gmail API */
async function sendViaGmail(accessToken: string, email: { recipient: string; subject: string; body: string; }, fromEmail: string): Promise<boolean> {
  const raw = buildGmailRaw(fromEmail, email.recipient, email.subject, email.body);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gmail API error: ${err.error?.message || JSON.stringify(err)}`);
  }
  return true;
}

/** Send via Microsoft Graph API */
async function sendViaOutlook(accessToken: string, email: { recipient: string; subject: string; body: string; }): Promise<boolean> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: { contentType: "Text", content: email.body },
        toRecipients: [{ emailAddress: { address: email.recipient } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok && res.status !== 202) {
    const err = await res.text();
    throw new Error(`Outlook API error: ${err}`);
  }
  return true;
}

export async function POST(request: Request) {
  const admin = getAdmin();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email_id } = await request.json();
    if (!email_id) return NextResponse.json({ error: "Missing email_id" }, { status: 400 });

    // Fetch the email record
    const { data: emailRecord, error: emailError } = await admin
      .from("emails")
      .select("*")
      .eq("id", email_id)
      .eq("user_id", user.id)
      .single();
    if (emailError || !emailRecord) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    // Check for connected mail providers (prefer Gmail, then Outlook)
    const { data: accounts } = await admin
      .from("connected_accounts")
      .select("provider, access_token, refresh_token, token_expiry, account_email")
      .eq("user_id", user.id)
      .in("provider", ["gmail", "outlook"]);

    let sent = false;
    let method = "manual";

    if (accounts && accounts.length > 0) {
      const gmail = accounts.find((a: any) => a.provider === "gmail");
      const outlook = accounts.find((a: any) => a.provider === "outlook");
      const account = gmail || outlook;

      if (account) {
        let accessToken = decryptToken(account.access_token);

        // Refresh token if expired
        if (account.token_expiry && new Date(account.token_expiry) < new Date()) {
          if (account.refresh_token && account.provider === "gmail") {
            const newToken = await refreshGmailToken(decryptToken(account.refresh_token));
            if (newToken) accessToken = newToken;
          }
        }

        if (account.provider === "gmail") {
          await sendViaGmail(accessToken, emailRecord, account.account_email);
          method = "gmail";
        } else if (account.provider === "outlook") {
          await sendViaOutlook(accessToken, emailRecord);
          method = "outlook";
        }
        sent = true;
      }
    }

    // Update email status in DB (metadata column added by 005_schema_fixes.sql migration)
    const updatePayload: Record<string, unknown> = { status: "sent" };
    try { updatePayload.metadata = { sent_via: method, sent_at: new Date().toISOString() }; } catch {}
    await admin.from("emails").update(updatePayload).eq("id", email_id);

    return NextResponse.json({
      success: true,
      sent,
      method,
      message: sent
        ? `Email sent via ${method === "gmail" ? "Gmail" : "Outlook"}`
        : "Email marked as sent (no mail provider connected)",
    });
  } catch (err: any) {
    console.error("[send-email action]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
