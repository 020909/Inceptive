import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sendGmailReply } from "@/lib/email/gmail-api";
import { checkCredits, deductCredits } from "@/lib/credits";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { to, subject, body, thread_id } = await request.json();
    if (!to || !subject || !body)
      return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });

    const creditCheck = await checkCredits(userId, "email_send");
    if (!creditCheck.allowed && !creditCheck.unlimited) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 402 });
    }

    const result = await sendGmailReply(userId, { to, subject, body, threadId: thread_id });
    if (!result.ok) return NextResponse.json({ error: result.error || "Failed to send" }, { status: 500 });
    await deductCredits(userId, "email_send").catch(() => {});

    return NextResponse.json({ success: true, message: "Email sent via Gmail" });
  } catch (err: any) {
    console.error("[emails/send]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
