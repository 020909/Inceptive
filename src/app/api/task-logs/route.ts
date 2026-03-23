import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/** GET /api/task-logs — poll recent task logs for the authenticated user */
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  const url = new URL(request.url);
  const isBriefing = url.searchParams.get("briefing") === "true";

  let query = admin
    .from("task_logs")
    .select("id, action, status, icon, agent_mode, details, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (isBriefing) {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    query = query.gt("created_at", twelveHoursAgo).limit(10);
  } else {
    query = query.limit(50);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}

/** PATCH /api/task-logs — update a log's status (e.g. undo) */
export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const admin = getAdmin();
    const { error } = await admin
      .from("task_logs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
