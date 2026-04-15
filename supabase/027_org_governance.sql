-- 027_org_governance.sql
-- Workspace governance settings + durable human review queue

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  manual_runs_require_approval BOOLEAN NOT NULL DEFAULT false,
  workflow_changes_require_approval BOOLEAN NOT NULL DEFAULT false,
  notify_admins_on_review_requests BOOLEAN NOT NULL DEFAULT true,
  require_rejection_reason BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_review_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('manual_run', 'workflow_activate', 'workflow_status_change')),
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  resolution_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_review_queue_org_status_created
  ON public.agent_review_queue (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_queue_requested_by
  ON public.agent_review_queue (requested_by, created_at DESC);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_settings" ON public.organization_settings;
DROP POLICY IF EXISTS "org_admins_insert_settings" ON public.organization_settings;
DROP POLICY IF EXISTS "org_admins_update_settings" ON public.organization_settings;
DROP POLICY IF EXISTS "org_members_select_review_queue" ON public.agent_review_queue;
DROP POLICY IF EXISTS "org_members_insert_review_queue" ON public.agent_review_queue;
DROP POLICY IF EXISTS "org_admins_update_review_queue" ON public.agent_review_queue;

CREATE POLICY "org_members_select_settings"
  ON public.organization_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = organization_settings.organization_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
    )
  );

CREATE POLICY "org_admins_insert_settings"
  ON public.organization_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = organization_settings.organization_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
        AND membership.status = 'active'
    )
  );

CREATE POLICY "org_admins_update_settings"
  ON public.organization_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = organization_settings.organization_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
        AND membership.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = organization_settings.organization_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
        AND membership.status = 'active'
    )
  );

CREATE POLICY "org_members_select_review_queue"
  ON public.agent_review_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = agent_review_queue.organization_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
    )
  );

CREATE POLICY "org_members_insert_review_queue"
  ON public.agent_review_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = agent_review_queue.organization_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
    )
  );

CREATE POLICY "org_admins_update_review_queue"
  ON public.agent_review_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = agent_review_queue.organization_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
        AND membership.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.organization_id = agent_review_queue.organization_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
        AND membership.status = 'active'
    )
  );
