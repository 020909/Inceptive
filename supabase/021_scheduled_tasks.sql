-- 021_scheduled_tasks.sql — autonomous scheduled tasks

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  schedule_cron TEXT NOT NULL, -- e.g. "0 9 * * 1" (Mon 9am)
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_next
  ON public.scheduled_tasks (user_id, next_run_at);

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_scheduled_tasks" ON public.scheduled_tasks;
DROP POLICY IF EXISTS "users_insert_own_scheduled_tasks" ON public.scheduled_tasks;
DROP POLICY IF EXISTS "users_update_own_scheduled_tasks" ON public.scheduled_tasks;
DROP POLICY IF EXISTS "users_delete_own_scheduled_tasks" ON public.scheduled_tasks;

CREATE POLICY "users_select_own_scheduled_tasks"
  ON public.scheduled_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_scheduled_tasks"
  ON public.scheduled_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_scheduled_tasks"
  ON public.scheduled_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_scheduled_tasks"
  ON public.scheduled_tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_scheduled_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS scheduled_tasks_updated_at ON public.scheduled_tasks;
CREATE TRIGGER scheduled_tasks_updated_at
  BEFORE UPDATE ON public.scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_scheduled_tasks_updated_at();

