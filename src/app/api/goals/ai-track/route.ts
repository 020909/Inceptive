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
  const [emailsRes, researchRes, connectorsRes, memoryRes] = await Promise.all([
    admin.from("emails").select("subject, status").eq("user_id", user.id).limit(10),
    admin.from("research_reports").select("topic").eq("user_id", user.id).limit(5),
    admin.from("connected_accounts").select("provider").eq("user_id", user.id),
    admin.from("agent_memory").select("content,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const emailsCount = emailsRes.data?.length || 0;
  const researchCount = researchRes.data?.length || 0;
  const connectedCount = connectorsRes.data?.length || 0;
  const memoryCount = memoryRes.data?.length || 0;
  const activityScore = emailsCount + researchCount * 2 + connectedCount * 2 + Math.min(10, memoryCount);
  const nudge = Math.min(25, Math.max(5, activityScore));
  const newProgress = Math.min(100, goal.progress_percent + nudge);
  const { data: updated, error } = await admin
    .from("goals")
    .update({ progress_percent: newProgress })
    .eq("id", goal_id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    goal: updated,
    progress: newProgress,
    previous_progress: goal.progress_percent,
    reasoning: `Progress updated using activity from ${emailsCount} emails, ${researchCount} research reports, ${connectedCount} connected tools, and ${memoryCount} memory signals.`,
  });
}
