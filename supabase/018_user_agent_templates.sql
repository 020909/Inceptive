-- 018_user_agent_templates.sql — user-defined autonomous agent templates

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_agent_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_agent_templates_user_created
  ON public.user_agent_templates (user_id, created_at DESC);

ALTER TABLE public.user_agent_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_agent_templates" ON public.user_agent_templates;
DROP POLICY IF EXISTS "users_insert_own_agent_templates" ON public.user_agent_templates;
DROP POLICY IF EXISTS "users_update_own_agent_templates" ON public.user_agent_templates;
DROP POLICY IF EXISTS "users_delete_own_agent_templates" ON public.user_agent_templates;

CREATE POLICY "users_select_own_agent_templates"
  ON public.user_agent_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_agent_templates"
  ON public.user_agent_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_agent_templates"
  ON public.user_agent_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_agent_templates"
  ON public.user_agent_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_agent_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_agent_templates_updated_at ON public.user_agent_templates;
CREATE TRIGGER user_agent_templates_updated_at
  BEFORE UPDATE ON public.user_agent_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_agent_templates_updated_at();

