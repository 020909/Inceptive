import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromToken(token: string) {
  const admin = getAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdmin();
  const requestId = crypto.randomUUID();

  // Fetch reports - handle missing table gracefully
  let reports: any[] = [];
  try {
    const { data, error } = await admin
      .from('weekly_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) {
      reports = (data || []).map((r: any) => {
        const extra = (r.report_json || {}) as Record<string, any>;
        return {
          ...r,
          date_range_str: extra.date_range_str || '',
          research_reports: Number(extra.research_reports || 0),
          social_posts: Number(extra.social_posts || 0),
          chart_data: Array.isArray(extra.chart_data) ? extra.chart_data : [],
        };
      });
    }
  } catch (e) {
    console.warn('weekly_reports table may not exist yet');
  }

  // Top goal
  let topGoal = null;
  try {
    const { data: goals } = await admin
      .from('goals')
      .select('title, progress_percent')
      .eq('user_id', user.id)
      .order('progress_percent', { ascending: false })
      .limit(1);
    topGoal = goals?.[0] || null;
  } catch (e) {}

  console.log(`[reports.get][${requestId}]`, { user: user.id, reports: reports.length, hasTopGoal: Boolean(topGoal) });
  return NextResponse.json({ reports, topGoal });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdmin();
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => ({} as any));
  const template = String((body as any)?.template || "Weekly Summary");

  // Pull real stats from user's actual data (tolerate partial schema mismatches)
  const [researchRes, emailsRes, socialRes, goalsRes, reportHistoryRes] = await Promise.allSettled([
    admin.from('research_reports').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('social_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
    admin.from('weekly_reports').select('week_start,tasks_completed').eq('user_id', user.id).order('week_start', { ascending: true }).limit(8),
  ]);

  const safeCount = (r: PromiseSettledResult<any>) =>
    r.status === "fulfilled" ? (r.value.count || 0) : 0;
  const safeData = (r: PromiseSettledResult<any>) =>
    r.status === "fulfilled" ? (r.value.data || []) : [];

  const research = safeCount(researchRes);
  const emails = safeCount(emailsRes);
  const social = safeCount(socialRes);
  const goals = safeCount(goalsRes);
  const tasks = research + emails + social;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const dateRangeStr = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Build chart data from actual historical reports + current week
  const historyRows = safeData(reportHistoryRes);
  const chartData = historyRows.slice(-7).map((r: any, idx: number) => ({
    week: `W${idx + 1}`,
    tasks_completed: Number(r.tasks_completed) || 0,
  }));
  chartData.push({ week: 'Current', tasks_completed: Math.max(tasks, 0) });

  // DB expects integer in some environments; keep this safely numeric.
  const hoursWorked = Math.max(1, Math.round(tasks * 0.5 + research * 2));

  const report = {
    user_id: user.id,
    week_start: weekStart.toISOString(),
    week_end: now.toISOString(),
    hours_worked: hoursWorked,
    tasks_completed: tasks,
    emails_sent: emails,
    goals_active: goals,
    report_json: {
      template,
      date_range_str: dateRangeStr,
      research_reports: research,
      social_posts: social,
      chart_data: chartData,
    },
    created_at: now.toISOString(),
  };

  try {
    console.log(`[reports.post][${requestId}] inserting`, {
      user: user.id,
      template,
      tasks,
      emails,
      research,
      social,
      goals,
      hoursWorked,
    });
    const { data, error } = await admin.from('weekly_reports').insert(report).select().single();
    if (error) {
      console.warn('[reports] Insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log(`[reports.post][${requestId}] success`, { reportId: data?.id });
    const extra = (data?.report_json || {}) as Record<string, any>;
    return NextResponse.json({
      report: {
        ...data,
        date_range_str: extra.date_range_str || '',
        research_reports: Number(extra.research_reports || 0),
        social_posts: Number(extra.social_posts || 0),
        chart_data: Array.isArray(extra.chart_data) ? extra.chart_data : [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to generate report' }, { status: 500 });
  }
}
