import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
const getAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function POST(request: NextRequest) {
  const admin = getAdmin();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { goal_id } = body;
  if (!goal_id) return NextResponse.json({ error: "Missing goal_id" }, { status: 400 });
  const { data: goal } = await admin.from("goals").select("*").eq("id", goal_id).eq("user_id", user.id).single();
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  const [emailsRes, researchRes] = await Promise.all([
    admin.from("emails").select("subject, status").eq("user_id", user.id).limit(10),
    admin.from("research_reports").select("topic").eq("user_id", user.id).limit(5),
  ]);
  const activityScore = (emailsRes.data?.length || 0) + (researchRes.data?.length || 0) * 2;
  const nudge = Math.min(20, Math.max(5, activityScore));
  const newProgress = Math.min(100, goal.progress_percent + nudge);
  const { data: updated, error } = await admin.from("goals").update({ progress_percent: newProgress, last_updated: new Date().toISOString(), source: "ai_track" }).eq("id", goal_id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: updated, progress: newProgress, previous_progress: goal.progress_percent, reasoning: "Progress updated based on your recent activity." });
}
