-- Weekly reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_range_str TEXT NOT NULL DEFAULT '',
  hours_worked TEXT NOT NULL DEFAULT '0',
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  research_reports INTEGER NOT NULL DEFAULT 0,
  social_posts INTEGER NOT NULL DEFAULT 0,
  goals_active INTEGER NOT NULL DEFAULT 0,
  chart_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reports_owner" ON weekly_reports
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_reports_user_id_idx ON weekly_reports(user_id);
