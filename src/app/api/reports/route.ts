import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
};

const admin = getAdmin();

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // First, see if we have real reports
  const { data: reports, error } = await admin
    .from('weekly_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
     console.error("Reports fetch error:", error);
  }

  // Also get a top goal for the report UI
  const { data: goals } = await admin
    .from('goals')
    .select('title, progress_percent')
    .eq('user_id', user.id)
    .order('progress_percent', { ascending: false })
    .limit(1);

  const topGoal = goals?.[0] || null;

  // If no reports yet, return empty but let UI show the "Generate" button
  return NextResponse.json({ 
    reports: reports || [],
    topGoal
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Generate a realistic mock report
  const report = {
    user_id: user.id,
    week_start: new Date().toISOString(),
    date_range_str: "Mar 15 - Mar 22, 2026",
    hours_worked: (Math.random() * 40 + 20).toFixed(1),
    tasks_completed: Math.floor(Math.random() * 50 + 80),
    emails_sent: Math.floor(Math.random() * 200 + 150),
    research_reports: Math.floor(Math.random() * 5 + 2),
    social_posts: Math.floor(Math.random() * 15 + 5),
    goals_active: 3,
    chart_data: [
      { week: "Feb 1", tasks_completed: 42 },
      { week: "Feb 8", tasks_completed: 55 },
      { week: "Feb 15", tasks_completed: 48 },
      { week: "Feb 22", tasks_completed: 62 },
      { week: "Mar 1", tasks_completed: 75 },
      { week: "Mar 8", tasks_completed: 68 },
      { week: "Mar 15", tasks_completed: 82 },
      { week: "Current", tasks_completed: 94 }
    ],
    created_at: new Date().toISOString()
  };

  const { data, error } = await admin.from('weekly_reports').insert(report).select().single();
  
  // If table doesn't exist, we return mock data anyway so user can see the UI
  if (error && error.code === 'PGRST204') {
     console.warn("weekly_reports table missing, returning mock only");
     return NextResponse.json({ report });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}
