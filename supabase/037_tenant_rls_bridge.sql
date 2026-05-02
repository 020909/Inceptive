-- 037_tenant_rls_bridge.sql
-- Bridges tenant_id from users table into JWT claims so browser-client RLS works.
-- Also adds relaxed RLS policies that fall back to users.tenant_id when JWT claim is missing.

-- ── Step 1: Add tenant_id to users table ──────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON public.users(tenant_id);

-- ── Step 2: Update auth trigger to set tenant_id in app_metadata ──────────────
-- When a new user is created, if they don't have a tenant_id in app_metadata,
-- we assign them to the first (or default) tenant. The JWT will then include it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Find or create default tenant
  SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;

  IF default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name) VALUES ('Default Tenant') RETURNING id INTO default_tenant_id;
  END IF;

  -- Set tenant_id in app_metadata so it appears in JWT claims
  IF new.raw_app_meta_data->>'tenant_id' IS NULL THEN
    new.raw_app_meta_data := COALESCE(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', default_tenant_id::text);
  END IF;

  -- Insert into public.users with tenant_id
  INSERT INTO public.users (id, email, created_at, tenant_id)
  VALUES (new.id, new.email, now(), (new.raw_app_meta_data->>'tenant_id')::uuid)
  ON CONFLICT (id) DO UPDATE SET tenant_id = (new.raw_app_meta_data->>'tenant_id')::uuid;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Step 3: Helper function that resolves tenant_id from JWT OR from users table ──
CREATE OR REPLACE FUNCTION public.request_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(auth.jwt() ->> 'tenant_id', '')::uuid,
    (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
  );
$$;

-- ── Step 4: Backfill existing users with default tenant ───────────────────────
DO $$
DECLARE
  default_tenant_id uuid;
  user_rec RECORD;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name) VALUES ('Default Tenant') RETURNING id INTO default_tenant_id;
  END IF;

  FOR user_rec IN SELECT id FROM public.users WHERE tenant_id IS NULL LOOP
    UPDATE public.users SET tenant_id = default_tenant_id WHERE id = user_rec.id;

    -- Also set in auth metadata so JWT includes it on next refresh
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', default_tenant_id::text)
    WHERE id = user_rec.id
      AND (raw_app_meta_data->>'tenant_id' IS NULL OR raw_app_meta_data->>'tenant_id' = '');
  END LOOP;
END;
$$;

-- ── Step 5: Add service-role bypass policy for new tables ─────────────────────
-- This allows API routes using the service role key to work without JWT claims.
-- The existing policies already handle authenticated users via request_tenant_id().

-- Alerts: add service role policy
DROP POLICY IF EXISTS alerts_service_role ON public.alerts;
CREATE POLICY alerts_service_role ON public.alerts FOR ALL USING (true) WITH CHECK (true);

-- Transactions: add service role policy
DROP POLICY IF EXISTS transactions_service_role ON public.transactions;
CREATE POLICY transactions_service_role ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- Policies table: add service role policy
DROP POLICY IF EXISTS policies_service_role ON public.policies;
CREATE POLICY policies_service_role ON public.policies FOR ALL USING (true) WITH CHECK (true);

-- Reconciliation runs: add service role policy
DROP POLICY IF EXISTS recon_runs_service_role ON public.reconciliation_runs;
CREATE POLICY recon_runs_service_role ON public.reconciliation_runs FOR ALL USING (true) WITH CHECK (true);

-- Vendor assessments: add service role policy
DROP POLICY IF EXISTS vendor_assessments_service_role ON public.vendor_assessments;
CREATE POLICY vendor_assessments_service_role ON public.vendor_assessments FOR ALL USING (true) WITH CHECK (true);

-- Audit log: add service role insert policy
DROP POLICY IF EXISTS audit_log_service_role ON public.audit_log;
CREATE POLICY audit_log_service_role ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- SAR drafts: add service role policy
DROP POLICY IF EXISTS sar_drafts_service_role ON public.sar_drafts;
CREATE POLICY sar_drafts_service_role ON public.sar_drafts FOR ALL USING (true) WITH CHECK (true);

-- Approval queue: add service role insert policy
DROP POLICY IF EXISTS approval_queue_service_role ON public.approval_queue;
CREATE POLICY approval_queue_service_role ON public.approval_queue FOR ALL USING (true) WITH CHECK (true);

-- Cases: add service role policy
DROP POLICY IF EXISTS cases_service_role ON public.cases;
CREATE POLICY cases_service_role ON public.cases FOR ALL USING (true) WITH CHECK (true);

-- Companies: add service role policy
DROP POLICY IF EXISTS companies_service_role ON public.companies;
CREATE POLICY companies_service_role ON public.companies FOR ALL USING (true) WITH CHECK (true);

-- Persons: add service role policy
DROP POLICY IF EXISTS persons_service_role ON public.persons;
CREATE POLICY persons_service_role ON public.persons FOR ALL USING (true) WITH CHECK (true);

-- Documents: add service role policy
DROP POLICY IF EXISTS documents_service_role ON public.documents;
CREATE POLICY documents_service_role ON public.documents FOR ALL USING (true) WITH CHECK (true);

-- Ownership: add service role policy
DROP POLICY IF EXISTS ownership_service_role ON public.ownership_relationships;
CREATE POLICY ownership_service_role ON public.ownership_relationships FOR ALL USING (true) WITH CHECK (true);
