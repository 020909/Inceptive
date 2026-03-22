-- 010: goals metadata, credits subscriber flag, computer preview storage
-- Run in Supabase SQL Editor after 009.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_goals_user_updated ON public.goals (user_id, last_updated DESC);

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ;

UPDATE public.user_credits
SET daily_reset_at = COALESCE(daily_reset_at, period_end)
WHERE daily_reset_at IS NULL;

-- Latest screenshot for dashboard “live preview” (base64 PNG, rotated by worker)
CREATE TABLE IF NOT EXISTS public.computer_session_previews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL DEFAULT 'default',
  image_base64 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id)
);

ALTER TABLE public.computer_session_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_computer_preview"
  ON public.computer_session_previews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_computer_preview"
  ON public.computer_session_previews FOR ALL TO service_role
  USING (true) WITH CHECK (true);
