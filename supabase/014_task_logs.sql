-- Live Task Feed: task_logs table
-- Stores every agent action for real-time transparency

CREATE TABLE IF NOT EXISTS task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,              -- human-readable: "Searching competitors on X"
  status TEXT NOT NULL DEFAULT 'running', -- running | done | error | undone
  icon TEXT DEFAULT '',                   -- no icon
  agent_mode TEXT,                   -- e.g. "Marketing", "Sales", etc.
  details JSONB DEFAULT '{}'::jsonb, -- expandable details (tool args, results, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast polling index
CREATE INDEX IF NOT EXISTS idx_task_logs_user_time
  ON task_logs (user_id, created_at DESC);

-- RLS
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task logs"
  ON task_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can do anything on task_logs"
  ON task_logs FOR ALL
  USING (true)
  WITH CHECK (true);
