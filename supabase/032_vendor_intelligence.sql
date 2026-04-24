-- 032_vendor_intelligence.sql
-- Vendor operations and invoice intelligence tables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contract_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  sla_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  renewal_date TIMESTAMPTZ,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'parsed',
  raw_text TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_alerts (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  description TEXT NOT NULL,
  dollar_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_status_renewal
  ON public.vendors (status, renewal_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_vendor_created
  ON public.invoices (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_alerts_status_impact
  ON public.vendor_alerts (status, dollar_impact DESC);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage vendors" ON public.vendors;
CREATE POLICY "Service role can manage vendors"
  ON public.vendors FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage invoices" ON public.invoices;
CREATE POLICY "Service role can manage invoices"
  ON public.invoices FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage vendor alerts" ON public.vendor_alerts;
CREATE POLICY "Service role can manage vendor alerts"
  ON public.vendor_alerts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_vendor_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_alerts_updated_at ON public.vendor_alerts;
CREATE TRIGGER trg_vendor_alerts_updated_at
  BEFORE UPDATE ON public.vendor_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vendor_alerts_updated_at();
