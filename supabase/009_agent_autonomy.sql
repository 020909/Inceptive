-- ============================================================
-- 009_agent_autonomy.sql — persistent async agent jobs + tick worker
-- Run in Supabase SQL Editor after prior migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')),
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  result          JSONB,
  error           TEXT,
  logs            JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  schedule_cron   TEXT,
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_created
  ON public.agent_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_pending_next
  ON public.agent_jobs (next_run_at)
  WHERE status = 'pending';

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_agent_jobs"
  ON public.agent_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_agent_jobs"
  ON public.agent_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_agent_jobs"
  ON public.agent_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_agent_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_jobs_updated_at ON public.agent_jobs;
CREATE TRIGGER agent_jobs_updated_at
  BEFORE UPDATE ON public.agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_agent_jobs_updated_at();
