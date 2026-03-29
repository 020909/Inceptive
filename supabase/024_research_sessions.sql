-- 024_research_sessions.sql — persisted deep-research runs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.research_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  depth TEXT NOT NULL DEFAULT 'Deep',
  provider_used TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  sources_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_text TEXT,
  report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_sessions_user_created
  ON public.research_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_sessions_status
  ON public.research_sessions (status, created_at DESC);

ALTER TABLE public.research_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_research_sessions" ON public.research_sessions;
DROP POLICY IF EXISTS "users_insert_own_research_sessions" ON public.research_sessions;
DROP POLICY IF EXISTS "service_role_all_research_sessions" ON public.research_sessions;

CREATE POLICY "users_select_own_research_sessions"
  ON public.research_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_research_sessions"
  ON public.research_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_research_sessions"
  ON public.research_sessions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
