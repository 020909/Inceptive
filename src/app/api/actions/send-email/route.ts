import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/token-crypto";
import { getGmailClientForUser } from "@/lib/email/gmail-api";

export const maxDuration = 30;

const getAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

    const { data: emailRecord, error: emailError } = await admin
      .from("emails")
      .select("*")
      .eq("id", email_id)
      .eq("user_id", user.id)
      .single();
    if (emailError || !emailRecord) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    // Check for connected mail providers
    const { data: accounts } = await admin
      .from("connected_accounts")
      .select("provider, access_token, refresh_token, token_expiry, account_email")
      .eq("user_id", user.id)
      .in("provider", ["gmail", "outlook"]);

    let sent = false;
    let method = "manual";

    if (accounts && accounts.length > 0) {
      const gmailAccount = accounts.find((a: any) => a.provider === "gmail");
      const outlookAccount = accounts.find((a: any) => a.provider === "outlook");

      if (gmailAccount) {
        const client = await getGmailClientForUser(user.id);
        if (client) {
          const { buildGmailRaw } = await import("@/lib/email/gmail-api");
          const { raw } = buildGmailRaw(emailRecord.recipient, emailRecord.subject, emailRecord.body, gmailAccount.account_email);
          
          await client.gmail.users.messages.send({
            userId: "me",
            requestBody: { raw }
          });
          method = "gmail";
          sent = true;
        }
      } 
      
      if (!sent && outlookAccount) {
        const accessToken = decryptToken(outlookAccount.access_token);
        await sendViaOutlook(accessToken, emailRecord);
        method = "outlook";
        sent = true;
      }
    }

    const updatePayload: Record<string, unknown> = { status: "sent", updated_at: new Date().toISOString() };
    updatePayload.metadata = { sent_via: method, sent_at: new Date().toISOString() };
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
