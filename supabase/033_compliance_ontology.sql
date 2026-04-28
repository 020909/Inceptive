-- 033_compliance_ontology.sql
-- Compliance ontology schema (Foundry Black Compliance OS)

create extension if not exists "pgcrypto";

-- ── Multi-tenant boundary ─────────────────────────────────────────────────────
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ── Core entities ─────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  registration_number text,
  jurisdiction text,
  incorporation_date date,
  company_type text,
  status text,
  risk_score numeric(5,2),
  risk_tier text,
  gleif_lei text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_tenant_id_idx on public.companies(tenant_id);
create index if not exists companies_name_idx on public.companies(name);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  nationality text,
  id_document_type text,
  id_document_number text,
  pep_status boolean not null default false,
  sanctions_hit boolean not null default false,
  risk_score numeric(5,2),
  created_at timestamptz not null default now()
);

create index if not exists persons_tenant_id_idx on public.persons(tenant_id);
create index if not exists persons_full_name_idx on public.persons(full_name);

-- ── Documents ─────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_id uuid,
  entity_type text,
  file_name text not null,
  file_url text not null,
  file_type text,
  parsed_content text,
  parsing_status text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_id_idx on public.documents(tenant_id);
create index if not exists documents_entity_idx on public.documents(entity_type, entity_id);

-- ── Ownership ────────────────────────────────────────────────────────────────
create table if not exists public.ownership_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_entity_id uuid not null,
  parent_entity_type text not null,
  child_entity_id uuid not null,
  child_entity_type text not null,
  ownership_percentage numeric(5,2),
  relationship_type text,
  source_document_id uuid references public.documents(id) on delete set null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ownership_relationships_tenant_id_idx on public.ownership_relationships(tenant_id);
create index if not exists ownership_relationships_parent_idx on public.ownership_relationships(parent_entity_type, parent_entity_id);
create index if not exists ownership_relationships_child_idx on public.ownership_relationships(child_entity_type, child_entity_id);

-- ── Cases ─────────────────────────────────────────────────────────────────────
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_number text unique not null,
  case_type text,
  title text,
  description text,
  status text,
  priority text,
  entity_id uuid,
  assigned_to uuid,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_tenant_id_idx on public.cases(tenant_id);
create index if not exists cases_case_number_idx on public.cases(case_number);

-- ── Approval queue ────────────────────────────────────────────────────────────
create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_type text,
  entity_id uuid,
  entity_type text,
  ai_draft jsonb not null,
  ai_confidence numeric(3,2),
  citations jsonb,
  status text,
  assigned_to uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_queue_tenant_id_idx on public.approval_queue(tenant_id);
create index if not exists approval_queue_status_idx on public.approval_queue(status);

-- ── SAR drafts ────────────────────────────────────────────────────────────────
create table if not exists public.sar_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  fincen_form_type text,
  subject_entities jsonb,
  suspicious_activity_type text[],
  activity_start_date date,
  activity_end_date date,
  narrative_draft text,
  narrative_version integer not null default 1,
  status text,
  filed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sar_drafts_tenant_id_idx on public.sar_drafts(tenant_id);

-- ── Audit log (append-only) ───────────────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null,
  actor_email text not null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  ai_model_used text,
  ai_prompt_hash text,
  decision text,
  citations jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_id_idx on public.audit_log(tenant_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

