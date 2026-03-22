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
    const result = await listUnreadGmail(userId);
    
    if (result.error === "gmail_not_connected") {
      return NextResponse.json({ error: "Gmail not connected", code: "NOT_CONNECTED" }, { status: 400 });
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
