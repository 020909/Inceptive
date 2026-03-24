import { createClient } from "@/lib/supabase";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

// DELETE /api/computer/sessions/{session_id} — close a session
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { session_id } = await params;
    const supabase = createClient();

    // Update session status to closed
    const { error } = await supabase
      .from("computer_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("session_id", session_id);

    if (error) throw error;

    // Close the actual Playwright session
    try {
      const { closeComputerSession } = await import("@/lib/computer-use/session");
      await closeComputerSession(`${userId}:${session_id}`);
    } catch {
      // Session might not exist, that's ok
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[Computer Sessions DELETE] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to close session" }),
      { status: 500 }
    );
  }
}
