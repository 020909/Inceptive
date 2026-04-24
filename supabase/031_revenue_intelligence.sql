-- 031_revenue_intelligence.sql
-- Revenue leakage storage for the revenue intelligence agent.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  renewal_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revenue_signals (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  dollar_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_account_renewal
  ON public.contracts (account_id, renewal_date DESC);

CREATE INDEX IF NOT EXISTS idx_billing_records_account_period
  ON public.billing_records (account_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_signals_status_impact
  ON public.revenue_signals (status, dollar_impact DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_signals_account_status
  ON public.revenue_signals (account_id, status, detected_at DESC);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contracts" ON public.contracts;
CREATE POLICY "Users can view own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "Service role can manage contracts" ON public.contracts;
CREATE POLICY "Service role can manage contracts"
  ON public.contracts FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own billing records" ON public.billing_records;
CREATE POLICY "Users can view own billing records"
  ON public.billing_records FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "Service role can manage billing records" ON public.billing_records;
CREATE POLICY "Service role can manage billing records"
  ON public.billing_records FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own revenue signals" ON public.revenue_signals;
CREATE POLICY "Users can view own revenue signals"
  ON public.revenue_signals FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "Service role can manage revenue signals" ON public.revenue_signals;
CREATE POLICY "Service role can manage revenue signals"
  ON public.revenue_signals FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_revenue_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revenue_signals_updated_at ON public.revenue_signals;
CREATE TRIGGER trg_revenue_signals_updated_at
  BEFORE UPDATE ON public.revenue_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_revenue_signals_updated_at();
