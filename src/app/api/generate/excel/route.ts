import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Try auth header first, then accept user_id from body (for internal agent calls)
  let userId = await getAuthenticatedUserIdFromRequest(req);
  
  if (!userId) {
    // Check if user_id is passed in body (from internal agent calls)
    const bodyClone = await req.clone().json().catch(() => ({}));
    userId = bodyClone.user_id;
  }
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, filename = "export.xlsx", user_id: passedUserId } = body;
    
    // Use passed user_id if present (internal agent call)
    const effectiveUserId = passedUserId || userId;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Excel generation will be available soon",
      filename,
      rowCount: data.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Excel API - use POST" });
}
