import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sendGmailReply } from "@/lib/email/gmail-api";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { to, subject, body, thread_id } = await request.json();
    if (!to || !subject || !body)
      return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });

    const result = await sendGmailReply(userId, { to, subject, body, threadId: thread_id });
    if (!result.ok) return NextResponse.json({ error: result.error || "Failed to send" }, { status: 500 });

    return NextResponse.json({ success: true, message: "Email sent via Gmail" });
  } catch (err: any) {
    console.error("[emails/send]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
