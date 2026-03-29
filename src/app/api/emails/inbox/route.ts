import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { listUnreadGmail } from "@/lib/email/gmail-api";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "1";
    const limit = Number(searchParams.get("limit") || "25");
    const result = await listUnreadGmail(userId, Number.isFinite(limit) ? Math.min(limit, 50) : 25, { unreadOnly });
    
    if (result.error) {
      const reason = (result as any).reason as string | undefined;
      const codeMap: Record<string, { code: string; error: string }> = {
        gmail_not_connected: { code: "NOT_CONNECTED", error: "Gmail is not connected." },
        gmail_token_decryption_failed: { code: "TOKEN_DECRYPT_FAILED", error: "Gmail token could not be decrypted." },
        gmail_refresh_failed: { code: "TOKEN_REFRESH_FAILED", error: "Gmail token refresh failed." },
        gmail_auth_failed: { code: "GMAIL_AUTH_FAILED", error: "Gmail authentication failed." },
        gmail_api_error: { code: "GMAIL_API_ERROR", error: "Gmail request failed." },
      };

      const mapped = codeMap[result.error] || { code: "GMAIL_ERROR", error: "Gmail error." };
      return NextResponse.json({ error: mapped.error, code: mapped.code, reason }, { status: 400 });
    }

    return NextResponse.json({ 
      messages: result.messages || [],
      count: result.messages?.length || 0
    });
  } catch (err: any) {
    console.error("[api/emails/inbox]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
