-- 019_user_skills.sql — user-defined Skills library

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Research',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_created
  ON public.user_skills (user_id, created_at DESC);

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_skills" ON public.user_skills;
DROP POLICY IF EXISTS "users_insert_own_skills" ON public.user_skills;
DROP POLICY IF EXISTS "users_delete_own_skills" ON public.user_skills;

CREATE POLICY "users_select_own_skills"
  ON public.user_skills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_skills"
  ON public.user_skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_skills"
  ON public.user_skills FOR DELETE
  USING (auth.uid() = user_id);

