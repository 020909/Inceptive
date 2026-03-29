import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { extractPlainTextFromGmailPayload, getGmailClientForUser } from "@/lib/email/gmail-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const client = await getGmailClientForUser(userId);
    if ("error" in client) {
      const code = client.error === "gmail_not_connected" ? "NOT_CONNECTED" : "GMAIL_TOKEN_INVALID";
      const error = client.error === "gmail_not_connected" ? "Gmail not connected" : "Gmail token invalid";
      return NextResponse.json({ error, code, reason: client.reason }, { status: 400 });
    }

    const full = await client.gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = full.data.payload;

    const body = (payload ? extractPlainTextFromGmailPayload(payload) : "") || full.data.snippet || "";
    return NextResponse.json({ body, snippet: full.data.snippet });
  } catch (err: any) {
    console.error("[emails/full]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
