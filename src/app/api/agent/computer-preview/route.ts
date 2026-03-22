import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** GET — latest PNG preview for computer-use session (base64). */
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = new URL(request.url).searchParams.get("session") || "default";

  const { data, error } = await admin()
    .from("computer_session_previews")
    .select("image_base64, updated_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ preview: null, updated_at: null });

  return NextResponse.json({
    preview: data.image_base64,
    updated_at: data.updated_at,
  });
}
