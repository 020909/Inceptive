-- 036_compliance_modules.sql
-- Adds alerts, transactions, policies, and reconciliation tables for AML Triage, SAR Drafter,
-- Policy Vault, Reconciliation Tracer, and Vendor Analyst modules.

-- ── Alerts (AML Triage) ─────────────────────────────────────────────────────
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  alert_number text not null,
  alert_type text not null,
  source text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'triaging', 'escalated', 'closed', 'false_positive')),
  risk_score numeric(5,2),
  description text,
  entity_name text,
  entity_type text,
  entity_id uuid,
  transaction_ids uuid[],
  triage_result jsonb,
  triaged_by uuid,
  triaged_at timestamptz,
  assigned_to uuid,
  case_id uuid references public.cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alerts_tenant_id_idx on public.alerts(tenant_id);
create index if not exists alerts_status_idx on public.alerts(status);
create index if not exists alerts_severity_idx on public.alerts(severity);
create index if not exists alerts_alert_number_idx on public.alerts(alert_number);

-- ── Transactions ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_id text not null,
  source_system text not null default 'internal',
  amount numeric(15,2) not null,
  currency text not null default 'USD',
  direction text not null default 'credit' check (direction in ('credit', 'debit')),
  counterparty_name text,
  counterparty_account text,
  account_number text,
  transaction_date timestamptz not null,
  posted_date timestamptz,
  description text,
  category text,
  matched boolean not null default false,
  match_group_id uuid,
  reconciliation_run_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists transactions_tenant_id_idx on public.transactions(tenant_id);
create index if not exists transactions_transaction_id_idx on public.transactions(transaction_id);
create index if not exists transactions_matched_idx on public.transactions(matched);
create index if not exists transactions_recon_run_idx on public.transactions(reconciliation_run_id);

-- ── Policies (Policy Vault) ──────────────────────────────────────────────────
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  policy_number text,
  category text not null default 'general',
  version text not null default '1.0',
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'deprecated')),
  content text,
  summary text,
  effective_date date,
  review_date date,
  owner text,
  tags text[],
  file_url text,
  file_name text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policies_tenant_id_idx on public.policies(tenant_id);
create index if not exists policies_category_idx on public.policies(category);
create index if not exists policies_status_idx on public.policies(status);

-- ── Reconciliation Runs ──────────────────────────────────────────────────────
create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_number text not null,
  source_a_name text not null,
  source_b_name text not null,
  total_source_a integer not null default 0,
  total_source_b integer not null default 0,
  matched_count integer not null default 0,
  exception_count integer not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  exceptions jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recon_runs_tenant_id_idx on public.reconciliation_runs(tenant_id);

-- ── Vendor Risk Assessments (extends existing vendors table) ─────────────────
create table if not exists public.vendor_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null,
  assessment_type text not null default 'soc2' check (assessment_type in ('soc2', 'security_questionnaire', 'penetration_test', 'financial_review')),
  risk_score numeric(5,2),
  risk_tier text check (risk_tier in ('low', 'medium', 'high', 'critical')),
  findings jsonb,
  recommendations text,
  report_url text,
  report_file_name text,
  assessed_by uuid,
  assessed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'requires_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_assessments_tenant_id_idx on public.vendor_assessments(tenant_id);
create index if not exists vendor_assessments_vendor_id_idx on public.vendor_assessments(vendor_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.alerts enable row level security;
alter table public.transactions enable row level security;
alter table public.policies enable row level security;
alter table public.reconciliation_runs enable row level security;
alter table public.vendor_assessments enable row level security;

create policy alerts_all_same_tenant on public.alerts for all to authenticated using (tenant_id = public.request_tenant_id()) with check (tenant_id = public.request_tenant_id());
create policy transactions_all_same_tenant on public.transactions for all to authenticated using (tenant_id = public.request_tenant_id()) with check (tenant_id = public.request_tenant_id());
create policy policies_all_same_tenant on public.policies for all to authenticated using (tenant_id = public.request_tenant_id()) with check (tenant_id = public.request_tenant_id());
create policy recon_runs_select_same_tenant on public.reconciliation_runs for select to authenticated using (tenant_id = public.request_tenant_id());
create policy vendor_assessments_all_same_tenant on public.vendor_assessments for all to authenticated using (tenant_id = public.request_tenant_id()) with check (tenant_id = public.request_tenant_id());

-- ── Updated_at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at before update on public.alerts for each row execute function public.set_updated_at();

drop trigger if exists trg_policies_updated_at on public.policies;
create trigger trg_policies_updated_at before update on public.policies for each row execute function public.set_updated_at();

drop trigger if exists trg_vendor_assessments_updated_at on public.vendor_assessments;
create trigger trg_vendor_assessments_updated_at before update on public.vendor_assessments for each row execute function public.set_updated_at();

-- ── Alert number sequence ────────────────────────────────────────────────────
create or replace function public.next_alert_number(t_id uuid) returns text as $$
declare
  seq_val integer;
  today_str text := to_char(now(), 'YYYYMMDD');
begin
  select coalesce(max((alert_number::text ~ '^\d{8}-\d{4}$'), 0), 0) into seq_val
  from public.alerts where tenant_id = t_id and alert_number like today_str || '-%';
  seq_val := seq_val + 1;
  return today_str || '-' || lpad(seq_val::text, 4, '0');
end;
$$ language plpgsql security definer;
