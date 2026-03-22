/**
 * Gmail Full Connector — full read + write + send + calendar via Google APIs.
 * Uses OAuth refresh tokens stored in connected_accounts (encrypted_tokens).
 */

import { createClient } from "@supabase/supabase-js";
import type { ConnectorContext, GmailFullConnector } from "./types";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getGoogleAccessToken(ctx: ConnectorContext): Promise<string> {
  if (ctx.accessToken) return ctx.accessToken;

  const admin = getAdmin();
  const { data } = await admin
    .from("connected_accounts")
    .select("encrypted_tokens")
    .eq("user_id", ctx.userId)
    .eq("provider", "gmail")
    .single();

  if (!data?.encrypted_tokens) {
    throw new Error("Gmail not connected. Please connect via Settings → Email connectors.");
  }

  const tokens = typeof data.encrypted_tokens === "string"
    ? JSON.parse(data.encrypted_tokens)
    : data.encrypted_tokens;

  // Refresh the access token using the refresh token
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  if (!refreshRes.ok) {
    throw new Error("Failed to refresh Gmail token. Please reconnect your Gmail account.");
  }

  const refreshData = await refreshRes.json();
  return refreshData.access_token;
}

async function gmailAPI(accessToken: string, endpoint: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${error}`);
  }

  return res.json();
}

function createRawEmail(to: string, subject: string, htmlBody: string): string {
  const boundary = `boundary_${Date.now()}`;
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(raw).toString("base64url");
}

export const gmailFullConnector: GmailFullConnector = {
  id: "gmail_full",

  async sendEmail(ctx, to, subject, htmlBody) {
    const accessToken = await getGoogleAccessToken(ctx);
    const raw = createRawEmail(to, subject, htmlBody);
    const result = await gmailAPI(accessToken, "messages/send", {
      method: "POST",
      body: JSON.stringify({ raw }),
    });
    return { messageId: result.id };
  },

  async replyToEmail(ctx, threadId, htmlBody) {
    const accessToken = await getGoogleAccessToken(ctx);

    // Get the original message to extract headers
    const thread = await gmailAPI(accessToken, `threads/${threadId}`);
    const lastMessage = thread.messages?.[thread.messages.length - 1];
    const headers = lastMessage?.payload?.headers || [];
    const subject = headers.find((h: { name: string }) => h.name === "Subject")?.value || "";
    const from = headers.find((h: { name: string }) => h.name === "From")?.value || "";

    const raw = createRawEmail(from, `Re: ${subject}`, htmlBody);
    const result = await gmailAPI(accessToken, "messages/send", {
      method: "POST",
      body: JSON.stringify({ raw, threadId }),
    });
    return { messageId: result.id };
  },

  async archiveEmail(ctx, messageId) {
    const accessToken = await getGoogleAccessToken(ctx);
    await gmailAPI(accessToken, `messages/${messageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    });
    return { success: true };
  },

  async labelEmail(ctx, messageId, labelIds) {
    const accessToken = await getGoogleAccessToken(ctx);
    await gmailAPI(accessToken, `messages/${messageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ addLabelIds: labelIds }),
    });
    return { success: true };
  },

  async draftEmail(ctx, to, subject, htmlBody) {
    const accessToken = await getGoogleAccessToken(ctx);
    const raw = createRawEmail(to, subject, htmlBody);
    const result = await gmailAPI(accessToken, "drafts", {
      method: "POST",
      body: JSON.stringify({ message: { raw } }),
    });
    return { draftId: result.id };
  },

  async createCalendarEvent(ctx, summary, start, end, attendees) {
    const accessToken = await getGoogleAccessToken(ctx);
    const event = {
      summary,
      start: { dateTime: start, timeZone: "UTC" },
      end: { dateTime: end, timeZone: "UTC" },
      attendees: attendees?.map((email) => ({ email })),
    };

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!res.ok) throw new Error(`Calendar API error: ${await res.text()}`);
    const result = await res.json();
    return { eventId: result.id };
  },

  async listEmails(ctx, query, maxResults = 10) {
    const accessToken = await getGoogleAccessToken(ctx);
    const params = new URLSearchParams({ maxResults: String(maxResults) });
    if (query) params.set("q", query);

    const list = await gmailAPI(accessToken, `messages?${params}`);
    const messages = list.messages || [];

    const emails = await Promise.all(
      messages.slice(0, maxResults).map(async (msg: { id: string }) => {
        const full = await gmailAPI(accessToken, `messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
        const headers = full.payload?.headers || [];
        return {
          id: full.id,
          subject: headers.find((h: { name: string }) => h.name === "Subject")?.value || "(no subject)",
          from: headers.find((h: { name: string }) => h.name === "From")?.value || "",
          snippet: full.snippet || "",
          date: headers.find((h: { name: string }) => h.name === "Date")?.value || "",
        };
      })
    );

    return { emails };
  },
};
