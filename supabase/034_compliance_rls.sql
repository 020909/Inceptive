-- 034_compliance_rls.sql
-- Row Level Security for compliance ontology

-- Helper: tenant_id from JWT claim
create or replace function public.request_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

-- Enable RLS for all compliance tables
alter table public.tenants enable row level security;
alter table public.companies enable row level security;
alter table public.persons enable row level security;
alter table public.ownership_relationships enable row level security;
alter table public.documents enable row level security;
alter table public.cases enable row level security;
alter table public.approval_queue enable row level security;
alter table public.sar_drafts enable row level security;
alter table public.audit_log enable row level security;

-- Tenants: allow read if tenant_id matches
drop policy if exists tenants_select_same_tenant on public.tenants;
create policy tenants_select_same_tenant
on public.tenants
for select
to authenticated
using (id = public.request_tenant_id());

-- Companies
drop policy if exists companies_all_same_tenant on public.companies;
create policy companies_all_same_tenant
on public.companies
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Persons
drop policy if exists persons_all_same_tenant on public.persons;
create policy persons_all_same_tenant
on public.persons
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Ownership relationships
drop policy if exists ownership_relationships_all_same_tenant on public.ownership_relationships;
create policy ownership_relationships_all_same_tenant
on public.ownership_relationships
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Documents
drop policy if exists documents_all_same_tenant on public.documents;
create policy documents_all_same_tenant
on public.documents
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Cases
drop policy if exists cases_all_same_tenant on public.cases;
create policy cases_all_same_tenant
on public.cases
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Approval queue: select/update tenant users, inserts typically via server/service role
drop policy if exists approval_queue_select_same_tenant on public.approval_queue;
create policy approval_queue_select_same_tenant
on public.approval_queue
for select
to authenticated
using (tenant_id = public.request_tenant_id());

drop policy if exists approval_queue_update_same_tenant on public.approval_queue;
create policy approval_queue_update_same_tenant
on public.approval_queue
for update
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- SAR drafts
drop policy if exists sar_drafts_all_same_tenant on public.sar_drafts;
create policy sar_drafts_all_same_tenant
on public.sar_drafts
for all
to authenticated
using (tenant_id = public.request_tenant_id())
with check (tenant_id = public.request_tenant_id());

-- Audit log: immutable append-only
drop policy if exists audit_log_select_same_tenant on public.audit_log;
create policy audit_log_select_same_tenant
on public.audit_log
for select
to authenticated
using (tenant_id = public.request_tenant_id());

-- No UPDATE/DELETE policies for audit_log.
-- INSERT is expected from service role on the server (bypasses RLS), so we do not grant insert to authenticated.

