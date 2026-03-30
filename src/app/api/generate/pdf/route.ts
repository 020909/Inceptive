import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Try auth header first, then accept user_id from body (for internal agent calls)
  let userId = await getAuthenticatedUserIdFromRequest(req);
  
  if (!userId) {
    // Check if user_id is passed in body (from internal agent calls)
    const body = await req.json().catch(() => ({}));
    userId = body.user_id;
  }
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content = "", title = "Document", user_id: passedUserId } = body;
    
    // Use passed user_id if present (internal agent call)
    const effectiveUserId = passedUserId || userId;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "PDF generation will be available soon",
      title,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "PDF API - use POST" });
}
