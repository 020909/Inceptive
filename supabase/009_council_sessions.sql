-- Council Sessions Table (run manually in Supabase SQL editor)
-- Stores one row per user-initiated council run (multi-step agent chain).

CREATE TABLE IF NOT EXISTS public.council_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt            TEXT NOT NULL,
  plan              TEXT NOT NULL CHECK (plan IN ('free', 'basic', 'pro', 'unlimited')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  current_agent     TEXT,
  agents_completed  TEXT[] NOT NULL DEFAULT '{}',
  outputs           JSONB NOT NULL DEFAULT '{}',
  final_output      TEXT,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS council_sessions_user_id_idx ON public.council_sessions(user_id);
CREATE INDEX IF NOT EXISTS council_sessions_status_idx ON public.council_sessions(status);

ALTER TABLE public.council_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own sessions"
  ON public.council_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.council_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.council_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_council_session_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS council_sessions_updated_at ON public.council_sessions;
CREATE TRIGGER council_sessions_updated_at
  BEFORE UPDATE ON public.council_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_council_session_timestamp();
