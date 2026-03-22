import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const YAHOO_IMAP = { host: "imap.mail.yahoo.com", port: 993 };
const YAHOO_SMTP = { host: "smtp.mail.yahoo.com", port: 465, secure: true };

export async function saveYahooConnector(userId: string, email: string, appPassword: string) {
  const enc = encryptToken(appPassword.trim());
  await admin()
    .from("connected_accounts")
    .upsert(
      {
        user_id: userId,
        provider: "yahoo",
        access_token: enc,
        account_email: email.trim().toLowerCase(),
        metadata: { imap: YAHOO_IMAP, smtp: YAHOO_SMTP },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );
}

export async function listUnreadYahoo(userId: string, limit = 10) {
  const { data: row, error } = await admin()
    .from("connected_accounts")
    .select("access_token, account_email")
    .eq("user_id", userId)
    .eq("provider", "yahoo")
    .maybeSingle();
  if (error || !row?.access_token || !row.account_email) {
    return { error: "yahoo_not_connected" as const, messages: [] };
  }

  const pass = decryptToken(row.access_token);
  const client = new ImapFlow({
    host: YAHOO_IMAP.host,
    port: YAHOO_IMAP.port,
    secure: true,
    auth: { user: row.account_email, pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false });
      if (!uids) return { error: null, messages: [] };
      const slice = uids.slice(-limit).reverse();
      const list: { uid: number; subject: string; from: string; snippet: string }[] = [];
      for (const uid of slice) {
        const msg = await client.fetchOne(uid, { envelope: true, source: true });
        if (!msg) continue;
        const env = msg.envelope;
        if (!env) continue;
        list.push({
          uid,
          subject: env.subject || "(no subject)",
          from: env.from?.[0]
            ? `${env.from[0].name || ""} <${env.from[0].address}>`.trim()
            : "",
          snippet: (msg.source?.toString() || "").slice(0, 200),
        });
      }
      return { error: null, messages: list };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function sendYahooMail(userId: string, to: string, subject: string, text: string) {
  const { data: row, error } = await admin()
    .from("connected_accounts")
    .select("access_token, account_email")
    .eq("user_id", userId)
    .eq("provider", "yahoo")
    .maybeSingle();
  if (error || !row?.access_token || !row.account_email) {
    return { ok: false as const, error: "yahoo_not_connected" };
  }
  const pass = decryptToken(row.access_token);
  const transporter = nodemailer.createTransport({
    host: YAHOO_SMTP.host,
    port: YAHOO_SMTP.port,
    secure: YAHOO_SMTP.secure,
    auth: { user: row.account_email, pass },
  });
  await transporter.sendMail({ from: row.account_email, to, subject, text });
  return { ok: true as const };
}
