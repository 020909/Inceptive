import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { data: reports, error } = await admin
      .from('weekly_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false });

    if (error) throw error;
    
    // Check if there's any active goals to attach to the latest report for the UI
    const { data: topGoal } = await admin
      .from('goals')
      .select('title, progress_percent')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('progress_percent', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ reports: reports || [], topGoal: topGoal || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Calculate start and end of current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dateRangeStr = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Generate real data by counting from tables
    const { count: tasksCount } = await admin.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startOfWeek.toISOString()).lte('created_at', endOfWeek.toISOString());
    const { count: emailsCount } = await admin.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'sent').gte('created_at', startOfWeek.toISOString()).lte('created_at', endOfWeek.toISOString());
    const { count: researchCount } = await admin.from('research_reports').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startOfWeek.toISOString()).lte('created_at', endOfWeek.toISOString());
    const { count: socialCount } = await admin.from('social_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startOfWeek.toISOString()).lte('created_at', endOfWeek.toISOString());
    const { count: activeGoalsCount } = await admin.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active');

    // Estimate hours worked (e.g. 1 task = 0.5 hours, 1 research = 1 hour, etc)
    const hoursWorkedStr = ((tasksCount || 0) * 0.5 + (researchCount || 0) * 1.5 + (emailsCount || 0) * 0.2 + (socialCount || 0) * 0.2).toFixed(1);
    
    // Also fetch historical tasks count for the past 8 weeks chart data
    const chartData = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(startOfWeek);
      wStart.setDate(wStart.getDate() - (i * 7));
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      
      const { count } = await admin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', wStart.toISOString())
        .lte('created_at', wEnd.toISOString());
        
      chartData.push({
        week: wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tasks_completed: count || 0
      });
    }

    const { data: savedReport, error: insertError } = await admin
      .from('weekly_reports')
      .insert({
        user_id: user.id,
        week_start: startOfWeek.toISOString(),
        date_range_str: dateRangeStr,
        hours_worked: hoursWorkedStr,
        tasks_completed: tasksCount || 0,
        emails_sent: emailsCount || 0,
        research_reports: researchCount || 0,
        social_posts: socialCount || 0,
        goals_active: activeGoalsCount || 0,
        chart_data: chartData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: savedReport });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
