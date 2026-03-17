import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(token);
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch counts
    const { count: tasksCount } = await admin.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: emailsCount } = await admin.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'sent');
    const { count: researchCount } = await admin.from('research_reports').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: socialCount } = await admin.from('social_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

    // 2. Fetch active goals
    const { data: goals } = await admin
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('progress_percent', { ascending: false })
      .limit(3);

    // 3. Fetch recent tasks
    const { data: recentTasks } = await admin
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      stats: {
        tasks: tasksCount || 0,
        emails: emailsCount || 0,
        research: researchCount || 0,
        social: socialCount || 0
      },
      goals: goals || [],
      recentTasks: recentTasks || []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
