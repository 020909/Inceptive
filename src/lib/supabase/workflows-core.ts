import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type WorkflowCategory = "sales" | "marketing" | "research" | "operations" | "content";
export type OrgWorkflowStatus = "active" | "paused";

export interface WorkflowTemplateStep {
  title: string;
  description: string;
  agent_action: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: WorkflowCategory;
  icon: string;
  steps: WorkflowTemplateStep[];
  estimated_time_saved: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrgWorkflow {
  id: string;
  organization_id: string;
  template_id: string;
  activated_by: string | null;
  settings: Record<string, unknown>;
  status: OrgWorkflowStatus;
  activated_at: string;
}

export interface OrgWorkflowWithTemplate extends OrgWorkflow {
  template: WorkflowTemplate;
  last_run_at: string | null;
}

export type WorkflowSupabaseClient = SupabaseClient<any, "public", any>;

function getServiceRoleClient(): WorkflowSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

export async function queryGetWorkflowTemplates(
  supabase: WorkflowSupabaseClient
): Promise<WorkflowTemplate[]> {
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("id, name, slug, description, category, icon, steps, estimated_time_saved, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WorkflowTemplate[];
}

async function queryGetWorkflowLastRunMap(
  supabase: WorkflowSupabaseClient,
  orgId: string,
  workflowSlugs: string[]
): Promise<Map<string, string>> {
  if (workflowSlugs.length === 0) {
    return new Map<string, string>();
  }

  const db = getServiceRoleClient() ?? supabase;
  const { data, error } = await db
    .from("agent_activity_log")
    .select("created_at, metadata")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    throw new Error(error.message);
  }

  const latestBySlug = new Map<string, string>();

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const workflowSlug = typeof metadata.workflow_slug === "string" ? metadata.workflow_slug : null;
    if (!workflowSlug || latestBySlug.has(workflowSlug) || !workflowSlugs.includes(workflowSlug)) {
      continue;
    }
    latestBySlug.set(workflowSlug, row.created_at as string);
  }

  return latestBySlug;
}

export async function queryGetOrgWorkflows(
  supabase: WorkflowSupabaseClient,
  orgId: string
): Promise<OrgWorkflowWithTemplate[]> {
  const { data, error } = await supabase
    .from("org_workflows")
    .select(
      `
        id,
        organization_id,
        template_id,
        activated_by,
        settings,
        status,
        activated_at,
        template:workflow_templates (
          id,
          name,
          slug,
          description,
          category,
          icon,
          steps,
          estimated_time_saved,
          is_active,
          created_at
        )
      `
    )
    .eq("organization_id", orgId)
    .order("activated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const workflows = (data ?? []).map((item: any) => ({
    id: item.id,
    organization_id: item.organization_id,
    template_id: item.template_id,
    activated_by: item.activated_by,
    settings: item.settings ?? {},
    status: item.status,
    activated_at: item.activated_at,
    template: Array.isArray(item.template) ? item.template[0] : item.template,
    last_run_at: null,
  })) as OrgWorkflowWithTemplate[];

  const workflowActivityMap = await queryGetWorkflowLastRunMap(
    supabase,
    orgId,
    workflows.map((workflow) => workflow.template.slug)
  );

  return workflows.map((workflow) => ({
    ...workflow,
    last_run_at: workflowActivityMap.get(workflow.template.slug) ?? null,
  }));
}

export async function queryActivateWorkflow(
  supabase: WorkflowSupabaseClient,
  params: {
    organizationId: string;
    templateId: string;
    activatedBy: string;
    settings?: Record<string, unknown>;
  }
): Promise<OrgWorkflow> {
  const { data, error } = await supabase
    .from("org_workflows")
    .insert({
      organization_id: params.organizationId,
      template_id: params.templateId,
      activated_by: params.activatedBy,
      settings: params.settings ?? {},
      status: "active",
    })
    .select("id, organization_id, template_id, activated_by, settings, status, activated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrgWorkflow;
}

export async function queryUpdateWorkflowStatus(
  supabase: WorkflowSupabaseClient,
  orgWorkflowId: string,
  status: OrgWorkflowStatus
): Promise<OrgWorkflow> {
  const { data, error } = await supabase
    .from("org_workflows")
    .update({ status })
    .eq("id", orgWorkflowId)
    .select("id, organization_id, template_id, activated_by, settings, status, activated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrgWorkflow;
}
