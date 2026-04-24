-- 029_churn_signals.sql
-- Churn scoring storage for the dedicated FastAPI backend.

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE public.users
SET last_login_at = COALESCE(last_login_at, created_at)
WHERE last_login_at IS NULL;

CREATE TABLE IF NOT EXISTS public.churn_signals (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  account_name TEXT NOT NULL,
  plan TEXT,
  last_login_at TIMESTAMPTZ,
  usage_this_week INTEGER NOT NULL DEFAULT 0,
  usage_last_week INTEGER NOT NULL DEFAULT 0,
  support_ticket_count INTEGER NOT NULL DEFAULT 0,
  login_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  usage_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ticket_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  health_score INTEGER NOT NULL DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
  churn_risk TEXT NOT NULL CHECK (churn_risk IN ('high', 'medium', 'healthy')),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_signals_health_score
  ON public.churn_signals (health_score ASC, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_churn_signals_risk
  ON public.churn_signals (churn_risk, analyzed_at DESC);

ALTER TABLE public.churn_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own churn signals" ON public.churn_signals;
CREATE POLICY "Users can view own churn signals"
  ON public.churn_signals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage churn signals" ON public.churn_signals;
CREATE POLICY "Service role can manage churn signals"
  ON public.churn_signals FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_churn_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_churn_signals_updated_at ON public.churn_signals;
CREATE TRIGGER trg_churn_signals_updated_at
  BEFORE UPDATE ON public.churn_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_churn_signals_updated_at();
