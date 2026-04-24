-- 030_agent_job_scheduling.sql
-- Scheduling, run status, and permanent failure storage for backend agents.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.agent_job_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (interval_minutes > 0),
  run_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running', 'skipped')),
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, agent_id)
);

CREATE TABLE IF NOT EXISTS public.agent_job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES public.agent_job_schedules(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (run_type IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.agent_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES public.agent_job_schedules(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  error_message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_job_schedules_user_agent
  ON public.agent_job_schedules (user_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_job_schedules_due
  ON public.agent_job_schedules (enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_agent_job_runs_schedule_started
  ON public.agent_job_runs (schedule_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_errors_user_created
  ON public.agent_errors (user_id, created_at DESC);

ALTER TABLE public.agent_job_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_agent_job_schedules" ON public.agent_job_schedules;
DROP POLICY IF EXISTS "service_role_manage_agent_job_schedules" ON public.agent_job_schedules;
CREATE POLICY "users_select_own_agent_job_schedules"
  ON public.agent_job_schedules FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "service_role_manage_agent_job_schedules"
  ON public.agent_job_schedules FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_select_own_agent_job_runs" ON public.agent_job_runs;
DROP POLICY IF EXISTS "service_role_manage_agent_job_runs" ON public.agent_job_runs;
CREATE POLICY "users_select_own_agent_job_runs"
  ON public.agent_job_runs FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.agent_job_schedules schedules
      WHERE schedules.id = agent_job_runs.schedule_id
        AND schedules.user_id = auth.uid()
    )
  );
CREATE POLICY "service_role_manage_agent_job_runs"
  ON public.agent_job_runs FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_select_own_agent_errors" ON public.agent_errors;
DROP POLICY IF EXISTS "service_role_manage_agent_errors" ON public.agent_errors;
CREATE POLICY "users_select_own_agent_errors"
  ON public.agent_errors FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "service_role_manage_agent_errors"
  ON public.agent_errors FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_agent_job_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_job_schedules_updated_at ON public.agent_job_schedules;
CREATE TRIGGER trg_agent_job_schedules_updated_at
  BEFORE UPDATE ON public.agent_job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_job_schedule_updated_at();
