import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/computer/sessions — list user's active sessions
export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient();

    const { data: sessions, error } = await supabase
      .from("computer_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("last_activity", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ sessions: sessions || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Computer Sessions GET] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to list sessions" }),
      { status: 500 }
    );
  }
}

// POST /api/computer/sessions — create or get a session
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { session_id = "default" } = await req.json();
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_or_create_computer_session", {
      p_user_id: userId,
      p_session_id: session_id,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ session: data }), { status: 200 });
  } catch (err: any) {
    console.error("[Computer Sessions POST] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create session" }),
      { status: 500 }
    );
  }
}
